/**
 * Leitura de extratos em CSV (Nubank conta e cartão, Inter, Itaú e genéricos) e limpeza das
 * descrições que os bancos exportam. Funções puras; testes em tests/extrato.test.ts.
 */

/** Texto do arquivo: tenta UTF-8 e, se tiver bytes inválidos, Windows-1252 (o Inter exporta assim). */
export function decodificarArquivo(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

const MINUSC = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para']);
function titulo(t: string): string {
  return t
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && MINUSC.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Tira CPF mascarado, banco, agência e conta que o Nubank cola no fim do Pix. */
function soNome(s: string): string {
  return s
    .split(/\s+-\s+/)[0]
    .replace(/[•*]{2,}[\d.•*-]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * "Transferência enviada pelo Pix - MARIA SILVA - •••.123.456-•• - NU PAGAMENTOS…" → "Pix para Maria Silva";
 * 'Compra no debito: "No estabelecimento SUPERMERCADO BH"' → "Supermercado Bh"; etc.
 */
export function limparDescricaoExtrato(bruta: string): string {
  const d = bruta.replace(/\s+/g, ' ').trim();
  let m: RegExpMatchArray | null;

  // Nubank (conta)
  if ((m = d.match(/^transfer[êe]ncia enviada pelo pix\s*-\s*(.+)$/i))) return `Pix para ${titulo(soNome(m[1]))}`;
  if ((m = d.match(/^transfer[êe]ncia recebida pelo pix\s*-\s*(.+)$/i))) return `Pix de ${titulo(soNome(m[1]))}`;
  if ((m = d.match(/^transfer[êe]ncia (enviada|recebida)\s*-\s*(.+)$/i))) return `Transferência ${m[1].toLowerCase() === 'enviada' ? 'para' : 'de'} ${titulo(soNome(m[2]))}`;
  if ((m = d.match(/^compra no d[ée]bito\s*(?:via nupay)?\s*-\s*(.+)$/i))) return titulo(m[1]);
  if ((m = d.match(/^pagamento de boleto efetuado\s*-\s*(.+)$/i))) return `Boleto ${titulo(m[1])}`;
  if ((m = d.match(/^estorno\s*-\s*(.+)$/i))) return `Estorno ${titulo(soNome(m[1]))}`;

  // Inter
  if ((m = d.match(/^pix enviado:?\s*"?(?:cp\s*:\s*\d+-)?([^"]+)"?$/i))) return `Pix para ${titulo(m[1].trim())}`;
  if ((m = d.match(/^pix recebido:?\s*"?(?:cp\s*:\s*\d+-)?([^"]+)"?$/i))) return `Pix de ${titulo(m[1].trim())}`;
  if ((m = d.match(/^compra no (?:d[ée]bito|cr[ée]dito):?\s*"?(?:no estabelecimento\s+)?([^"]+)"?$/i))) return titulo(m[1].trim());
  if ((m = d.match(/^pagamento efetuado:?\s*"?([^"]+)"?$/i))) return `Pagamento ${titulo(m[1].trim())}`;

  // Genérico: tira aspas e prefixos comuns
  return d.replace(/^"|"$/g, '').trim() || 'Movimentação bancária';
}

// ------------------------------------------------------------------ CSV

/** Separa uma linha respeitando aspas ("a;b";c). */
export function dividirLinha(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else aspas = !aspas;
    } else if (c === sep && !aspas) {
      out.push(atual.trim());
      atual = '';
    } else atual += c;
  }
  out.push(atual.trim());
  return out;
}

export function valorMonetario(bruto: string): number | null {
  let s = (bruto || '').replace(/R\$|\s/g, '').trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    neg = !neg;
    s = s.slice(1);
  } else if (s.endsWith('-')) {
    neg = !neg;
    s = s.slice(0, -1);
  }
  s = s.replace(/^\+/, '');
  const virg = s.lastIndexOf(',');
  const ponto = s.lastIndexOf('.');
  if (virg > ponto) s = s.replace(/\./g, '').replace(',', '.');
  else if (ponto > virg && virg !== -1) s = s.replace(/,/g, '');
  else if (ponto !== -1 && s.split('.').length > 2) s = s.replace(/\./g, '');
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return neg ? -v : v;
}

export function dataIso(bruta: string): string | null {
  const s = bruta.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export interface LinhaExtrato {
  linha: number;
  date: string;
  description: string;
  descricaoOriginal: string;
  amount: number;
  /** id estável vindo do banco (Identificador do Nubank), quando existe */
  idBanco?: string;
}

export interface ResultadoCsv {
  linhas: LinhaExtrato[];
  /** fatura de cartão: compras vêm positivas e foram invertidas */
  cartao: boolean;
  banco: 'NUBANK' | 'BANCO_INTER' | 'ITAU' | 'OUTRO';
  erro?: string;
}

const COL_DATA = /^(data|date|data (de )?lan[cç]amento|data (do )?movimento|dt\.?)$/;
const COL_DESC = /(descri|title|t[ií]tulo|hist[oó]rico|estabelecimento|lan[cç]amento$|memo)/;
const COL_VALOR = /^(valor|amount|valor \(r\$\)|valor r\$|quantia)$/;
const COL_ID = /^(identificador|id)$/;

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function lerCsvExtrato(texto: string, opcoes: { cartao?: boolean } = {}): ResultadoCsv {
  const linhas = texto.split(/\r?\n/);
  // Cabeçalho = primeira linha (das 30 primeiras) que tem coluna de data e de valor; ignora o preâmbulo do Inter.
  let iCab = -1;
  let sep = ',';
  let cols: string[] = [];
  for (let i = 0; i < Math.min(linhas.length, 30); i++) {
    const l = linhas[i];
    const s = [';', ',', '\t'].sort((a, b) => l.split(b).length - l.split(a).length)[0];
    const c = dividirLinha(l, s).map((x) => semAcento(x.toLowerCase().replace(/"/g, '').trim()));
    if (c.some((x) => COL_DATA.test(x)) && c.some((x) => COL_VALOR.test(x))) {
      iCab = i;
      sep = s;
      cols = c;
      break;
    }
  }
  const banco: ResultadoCsv['banco'] = /nubank|nu pagamentos/i.test(texto) || (cols.includes('title') && cols.includes('amount'))
    ? 'NUBANK'
    : /intermedium|banco inter|\binter\b|cp\s*:/i.test(texto)
      ? 'BANCO_INTER'
      : /ita[uú]/i.test(texto)
        ? 'ITAU'
        : 'OUTRO';
  if (iCab === -1) return { linhas: [], cartao: false, banco, erro: 'Não encontrei as colunas de data e valor no arquivo.' };

  const iData = cols.findIndex((x) => COL_DATA.test(x));
  const iValor = cols.findIndex((x) => COL_VALOR.test(x));
  const iDesc = cols.findIndex((x, k) => k !== iData && k !== iValor && COL_DESC.test(x));
  const iId = cols.findIndex((x) => COL_ID.test(x));
  // Fatura do Nubank: "date,title,amount" com compras positivas.
  const cartao = opcoes.cartao ?? (cols.includes('title') && cols.includes('amount'));

  const out: LinhaExtrato[] = [];
  for (let i = iCab + 1; i < linhas.length; i++) {
    if (!linhas[i].trim()) continue;
    const c = dividirLinha(linhas[i], sep);
    const date = dataIso(c[iData] ?? '');
    let amount = valorMonetario(c[iValor] ?? '');
    if (!date || amount === null || amount === 0) continue;
    if (cartao) amount = -amount;
    const original = (iDesc >= 0 ? c[iDesc] : '') || 'Movimentação bancária';
    out.push({
      linha: i + 1,
      date,
      amount: Math.round(amount * 100) / 100,
      descricaoOriginal: original,
      description: limparDescricaoExtrato(original),
      ...(iId >= 0 && c[iId] ? { idBanco: c[iId] } : {}),
    });
  }
  return { linhas: out, cartao, banco, ...(out.length ? {} : { erro: 'O arquivo não tem lançamentos com data e valor.' }) };
}
