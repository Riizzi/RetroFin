/**
 * Notificações bancárias → transações.
 *
 * O leitor nativo do Android (BankNotificationListener.java) guarda as notificações dos apps de banco;
 * aqui elas viram lançamentos. Mesma lógica que o antigo webhook do servidor usava com o MacroDroid,
 * agora rodando no próprio app (sem servidor e sem app de terceiros).
 */
import type { BankAccount, BankInstitution, PaymentChannel, Transaction } from '../types';
import { classifyTransactionLocally, cleanTransactionDescription } from '../utils/ofxParser';

export interface NotificacaoBruta {
  /** id único gerado no Android */
  id: string;
  /** pacote do app que postou (ex.: com.nu.production) */
  pkg: string;
  /** nome do app (ex.: Nubank) */
  app?: string;
  title?: string;
  text?: string;
  /** epoch ms em que a notificação foi postada */
  postedAt: number;
}

/** Apps de banco conhecidos → instituição. O leitor nativo usa a mesma lista (ver BANCOS_PADRAO). */
export const PACOTES_BANCO: Record<string, BankInstitution> = {
  'com.nu.production': 'NUBANK',
  'br.com.intermedium': 'BANCO_INTER',
  'com.itau': 'ITAU',
  'com.itau.pers': 'ITAU',
  'com.itau.iti': 'ITAU',
  'com.bradesco': 'BRADESCO',
  'br.com.bradesco.next': 'BRADESCO',
  'com.santander.app': 'SANTANDER',
  'com.c6bank.app': 'C6',
  'br.com.gabba.Caixa': 'CAIXA',
  'br.gov.caixa.tem': 'CAIXA',
  'br.com.bb.android': 'OUTRO',
  'com.mercadopago.wallet': 'OUTRO',
  'com.picpay': 'OUTRO',
};

export const NOMES_APP_BANCO: Record<string, string> = {
  'com.nu.production': 'Nubank',
  'br.com.intermedium': 'Inter',
  'com.itau': 'Itaú',
  'com.itau.pers': 'Itaú Personnalité',
  'com.itau.iti': 'iti',
  'com.bradesco': 'Bradesco',
  'br.com.bradesco.next': 'next',
  'com.santander.app': 'Santander',
  'com.c6bank.app': 'C6 Bank',
  'br.com.gabba.Caixa': 'Caixa',
  'br.gov.caixa.tem': 'Caixa Tem',
  'br.com.bb.android': 'Banco do Brasil',
  'com.mercadopago.wallet': 'Mercado Pago',
  'com.picpay': 'PicPay',
};

export interface Interpretacao {
  ok: true;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  bank: BankInstitution;
  channel: PaymentChannel;
  rawText: string;
}

export type Resultado = Interpretacao | { ok: false; motivo: string; rawText: string };

/** Precisa de um destes sinais para ser movimentação. */
const SINAL_MOVIMENTO = /compra|pagou|pagamento|pix|transfer|receb|enviou|enviad|d[ée]bito|cr[ée]dito em conta|creditad|saque|dep[óo]sito|estorno|reembolso|sal[áa]rio|boleto pago|aprovad/i;
/** Propaganda e avisos que trazem valor mas não são movimentação. */
const SINAL_PROPAGANDA = /pr[ée]-?aprovad|limite (dispon|de at[ée]|aumentou|liberad)|empr[ée]stimo|oferta|ganhe|cashback de at[ée]|convite|parcele|simul|fatura (fechou|est[áa] fechada|vence|dispon)|vence (hoje|amanh)|lembrete|rendeu|rendimento do dia|seguro|cons[óo]rcio|investir|aproveite|desconto de/i;

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para']);

function titulo(t: string): string {
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/\b(Ltda|Me|Sa|Eireli)\b\.?/gi, (m) => m.toUpperCase());
}

const LIMPA_FIM = /\s+(?:para o cart[ãa]o|no cart[ãa]o|com o cart[ãa]o|no d[ée]bito|no cr[ée]dito|foi aprovad[ao]|aprovad[ao]|final\s*\d+|com final|\(.*?\)).*$/i;

/** Nome do estabelecimento ou da pessoa, a partir dos formatos comuns dos bancos. */
export function extrairDescricao(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim();
  const pix = /pix|transfer/i.test(t);
  const recebido = /receb|te enviou|creditad/i.test(t) && !/enviad[oa] para|pagou/i.test(t);
  // "Fulano te enviou um Pix de R$ 200,00"
  let m = t.match(/(?:^|[.!:]\s*)([A-ZÀ-Ú][\wÀ-ú.' ]{2,60}?)\s+te enviou/i);
  if (m) return `Pix de ${titulo(m[1])}`;
  if (pix && recebido) {
    m = t.match(/R\$\s*[\d.,]+\s+(?:de|do|da)\s+([^.,;!]+?)(?:\s+(?:foi|em sua|na sua|na conta)|[.,;!]|$)/i);
    if (m) return `${/pix/i.test(t) ? 'Pix' : 'Transferência'} de ${titulo(m[1])}`;
  }
  if (pix) {
    m = t.match(/\bpara\s+([^.,;!]+?)(?:\s+(?:foi|com sucesso|via)|[.,;!]|$)/i);
    if (m && !/o cart[ãa]o/i.test(m[1])) return `${/pix/i.test(t) ? 'Pix' : 'Transferência'} para ${titulo(m[1])}`;
  }
  m = t.match(/\bem\s+([^.;!]+?)(?:[.;!]|$)/i);
  if (m) {
    const nome = m[1].replace(LIMPA_FIM, '').replace(/\s+aprovad[ao].*$/i, '').trim();
    if (nome.length >= 2 && !/^\d/.test(nome)) return titulo(nome);
  }
  return cleanTransactionDescription(t);
}

function bancoPorTexto(texto: string, app: string): BankInstitution {
  const u = `${app} ${texto}`.toUpperCase();
  if (u.includes('INTER')) return 'BANCO_INTER';
  if (u.includes('NUBANK') || /\bNU\b/.test(u)) return 'NUBANK';
  if (u.includes('ITAU') || u.includes('ITAÚ')) return 'ITAU';
  if (u.includes('BRADESCO')) return 'BRADESCO';
  if (u.includes('SANTANDER')) return 'SANTANDER';
  if (u.includes('C6')) return 'C6';
  if (u.includes('CAIXA')) return 'CAIXA';
  return 'OUTRO';
}

export function interpretar(n: NotificacaoBruta): Resultado {
  const title = (n.title || '').trim();
  const text = (n.text || '').trim();
  const rawText = `${title} ${text}`.replace(/\s+/g, ' ').trim();
  if (!rawText) return { ok: false, motivo: 'Notificação vazia', rawText };

  const valor = rawText.match(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i) || rawText.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
  if (!valor) return { ok: false, motivo: 'Sem valor em reais', rawText };
  const parsed = parseFloat(valor[1].replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) return { ok: false, motivo: 'Valor inválido', rawText };

  if (SINAL_PROPAGANDA.test(rawText) && !/compra aprovada|voc[êe] pagou|pix (enviado|recebido)/i.test(rawText)) {
    return { ok: false, motivo: 'Parece aviso ou propaganda', rawText };
  }
  if (!SINAL_MOVIMENTO.test(rawText)) return { ok: false, motivo: 'Não parece uma movimentação', rawText };

  const ehDebito = /compra|pagou|pagamento (efetuado|realizado|aprovado)|enviad|sa[íi]da|d[ée]bito|saque|boleto pago/i.test(rawText) || (/enviou/i.test(rawText) && !/te\s+enviou/i.test(rawText));
  const ehCredito = /receb|dep[óo]sito|cr[ée]dito em conta|reembolso|sal[áa]rio|estorno|te enviou|creditad/i.test(rawText) && !ehDebito;
  const amount = ehCredito ? parsed : -parsed;

  const bank = PACOTES_BANCO[n.pkg] && PACOTES_BANCO[n.pkg] !== 'OUTRO' ? PACOTES_BANCO[n.pkg] : bancoPorTexto(rawText, n.app || '');

  let description = extrairDescricao(text || rawText);
  if (!description || description.length < 3) description = `Movimentação ${NOMES_APP_BANCO[n.pkg] || n.app || bank}`;

  const channel: PaymentChannel = /pix/i.test(rawText)
    ? 'PIX'
    : /d[ée]bito/i.test(rawText)
      ? 'CARTAO_DEBITO'
      : /boleto/i.test(rawText)
        ? 'BOLETO'
        : /\bted\b|transfer/i.test(rawText)
          ? 'TED'
          : ehCredito
            ? 'OUTRO'
            : 'CARTAO_CREDITO';

  return { ok: true, amount, type: ehCredito ? 'credit' : 'debit', description, bank, channel, rawText };
}

function dataHoraLocal(ts: number): { date: string; time: string } {
  // Fuso de Brasília (UTC-3, sem horário de verão)
  const d = new Date(ts - 3 * 3_600_000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

function contaDoBanco(accounts: BankAccount[], bank: BankInstitution, excluir?: string): BankAccount | undefined {
  const lista = accounts.filter((a) => a.id !== excluir);
  return (
    lista.find((a) => a.institution === bank && a.type !== 'CARTAO_CREDITO') ||
    lista.find((a) => a.institution === bank) ||
    lista.find((a) => a.name.toUpperCase().includes(String(bank).replace('BANCO_', ''))) ||
    undefined
  );
}

/**
 * Monta a(s) transação(ões). Transferência entre contas próprias (Inter ⇄ Nubank) gera também
 * o lançamento espelho na outra conta, como o webhook fazia.
 */
export function montarTransacoes(n: NotificacaoBruta, i: Interpretacao, accounts: BankAccount[], nomeTitular = ''): Transaction[] {
  const { date, time } = dataHoraLocal(n.postedAt);
  const createdAt = new Date(n.postedAt).toISOString();
  const conta = contaDoBanco(accounts, i.bank) || accounts[0];
  const cat = classifyTransactionLocally(i.description, i.type, conta?.purpose);
  const base: Transaction = {
    id: `notif-${n.id}`,
    date,
    time,
    createdAt,
    description: i.description,
    amount: i.amount,
    type: i.type,
    category: cat.category,
    subcategory: cat.subcategory,
    channel: i.channel,
    accountId: conta?.id || 'acc-manual',
    accountName: conta?.name || `Conta ${i.bank}`,
    bankInstitution: i.bank,
    bank: i.bank,
    account: conta?.name,
    accountPurpose: conta?.purpose,
    isCategorizedByAI: true,
    categorizedBy: 'regras',
    aiConfidence: 0.85,
    aiReason: 'Lançado pela notificação do banco no celular',
    notes: `Notificação do app ${NOMES_APP_BANCO[n.pkg] || n.app || n.pkg}`,
    tags: ['notificacao', String(i.bank).toLowerCase()],
    status: 'liquidado',
  };

  const titular = nomeTitular.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const texto = i.rawText.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const interInterna = i.bank === 'NUBANK' && /recebemos sua transferencia|recebemos sua/.test(texto);
  const mesmaPessoa = titular.length >= 5 && texto.includes(titular) && /te enviou|enviou|creditad|recebid|transfer/.test(texto);
  if (!interInterna && !mesmaPessoa) return [base];

  const outra = contaDoBanco(accounts, i.bank === 'NUBANK' ? 'BANCO_INTER' : i.bank === 'BANCO_INTER' ? 'NUBANK' : 'OUTRO', conta?.id) || accounts.find((a) => a.id !== conta?.id);
  const nomeOutra = outra?.name || 'outra conta';
  const principal: Transaction = {
    ...base,
    description: i.amount > 0 ? `Transferência recebida de ${nomeOutra}` : `Transferência enviada para ${nomeOutra}`,
    category: 'transacao_interna',
    subcategory: 'Mesma Titularidade',
    tags: [...(base.tags || []), 'transferencia-interna'],
  };
  if (!outra) return [principal];
  const espelho: Transaction = {
    ...principal,
    id: `notif-${n.id}-espelho`,
    description: i.amount > 0 ? `Transferência enviada para ${conta?.name || 'conta'}` : `Transferência recebida de ${conta?.name || 'conta'}`,
    amount: -i.amount,
    type: i.amount > 0 ? 'debit' : 'credit',
    accountId: outra.id,
    accountName: outra.name,
    account: outra.name,
    bankInstitution: outra.institution,
    bank: outra.institution,
    accountPurpose: outra.purpose,
    notes: 'Contrapartida gerada automaticamente (transferência entre contas próprias)',
  };
  return [principal, espelho];
}
