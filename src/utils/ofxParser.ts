import { classificarPorRegras } from '../services/categorizacao';
import { lerCsvExtrato, limparDescricaoExtrato } from './extrato';
import { lerNomeTitular } from '../services/preferencias';
import { Transaction, PaymentChannel, BankInstitution, BankAccount } from '../types';

export function cleanTransactionDescription(rawText: string): string {
  let desc = rawText;

  // 0. Strip unreplaced Macrodroid variable brackets/placeholders
  desc = desc.replace(/\[notification_title\]/gi, '');
  desc = desc.replace(/\[notif_title\]/gi, '');
  desc = desc.replace(/\[notification_text\]/gi, '');
  desc = desc.replace(/\[notif_text\]/gi, '');
  desc = desc.replace(/\[notif_app_name\]/gi, '');

  // 1. Remove BRL values (e.g. "R$ 42,00", "42.00")
  desc = desc.replace(/(?:R\$\s*)?\d{1,4}(?:\.\d{3})*,\d{2}/gi, '');
  desc = desc.replace(/(?:R\$\s*)?\d+\.\d{2}/gi, '');

  // 2. Clean typical prefixes and boilerplate phrases (case-insensitive)
  desc = desc.replace(/compra\s+no\s+débito\s*:?/gi, '');
  desc = desc.replace(/compra\s+no\s+crédito\s*:?/gi, '');
  desc = desc.replace(/compra\s+aprovada\s*:?/gi, '');
  desc = desc.replace(/você\s+pagou/gi, '');
  desc = desc.replace(/transferência\s+enviada/gi, '');
  desc = desc.replace(/transferência/gi, '');
  desc = desc.replace(/pix\s+enviado\s+para/gi, '');
  desc = desc.replace(/pix\s+recebido\s+de/gi, '');
  desc = desc.replace(/pix\s+recebidos\s+de/gi, '');
  desc = desc.replace(/no\s+cartão/gi, '');
  desc = desc.replace(/de\s+R\$\s*/gi, '');

  // 3. Remove "No estabelecimento", "no estabelecimento", "estabelecimento"
  desc = desc.replace(/no\s+estabelecimento\s*/gi, '');
  desc = desc.replace(/No\s+estabelecimento\s*/gi, '');
  desc = desc.replace(/estabelecimento\s*/gi, '');

  // 4. Remove bank qualifiers and card endings
  desc = desc.replace(/com\s+o\s+cartão\s+\w+/gi, '');
  desc = desc.replace(/com\s+o\s+cartão/gi, '');
  desc = desc.replace(/no\s+Nubank/gi, '');
  desc = desc.replace(/no\s+Inter/gi, '');
  desc = desc.replace(/com\s+o\s+Nubank/gi, '');
  desc = desc.replace(/com\s+o\s+Inter/gi, '');

  // 5. Clean symbols, brackets, and quotes
  desc = desc.replace(/[\(\)•\-\:"']/g, ' ');

  // 6. Trim and collapse multiple spaces
  desc = desc.replace(/\s+/g, ' ').trim();

  // 7. Capitalize first letter
  if (desc) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  return desc;
}

// Robust monetary string parser handling Brazilian format (1.234,56), standard format (1234.56), and currency symbols
export function parseMonetaryValue(raw: string | number): number {
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  if (!raw) return 0;

  let cleaned = String(raw).trim()
    .replace(/^["']|["']$/g, '')
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '');

  // Detect negative format with trailing '-' (e.g. 50,00- or (50,00))
  let isNegative = cleaned.startsWith('-') || cleaned.endsWith('-');
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.replace(/[+\-]/g, '').trim();

  // If contains both dots and commas (e.g. 1.234,56 or 1,234.56)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Brazilian style: 1.234,56 -> remove dots, comma to dot
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US style: 1,234.56 -> remove commas
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Only comma present: 1234,56 -> replace comma with dot
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes('.')) {
    // Only dot present. Check if it's thousands separator or decimal dot
    const parts = cleaned.split('.');
    if (parts.length === 2) {
      // One dot: if right side has 2 digits (e.g. 120.50), it is a decimal dot.
      // If right side has 3 digits (e.g. 1.500) and it came from an integer/brazilian source, it could be thousands.
      // Standard bank CSVs (Nubank, Inter) format amounts as 1234.56 or 1234,56.
      // Keep dot as decimal separator.
    } else if (parts.length > 2) {
      // Multiple dots (e.g. 1.234.567) -> thousands separator
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return isNegative ? -Math.abs(parsed) : parsed;
}
export function classifyTransactionLocally(
  desc: string,
  type: 'credit' | 'debit',
  accountPurpose?: string
): {
  category: string;
  subcategory: string;
  channel: PaymentChannel;
  institution: BankInstitution;
} {
  const d = desc.toUpperCase();

  // Detect Bank Institution from description
  let institution: BankInstitution = 'OUTRO';
  if (d.includes('NUBANK') || d.includes('ROXINHO') || d.includes('NUCONTA') || d.includes('CAIXINHA') || d.includes('NU PAGAMENTOS')) {
    institution = 'NUBANK';
  } else if (d.includes('INTER') || d.includes('BANCO INTER') || d.includes('INTER SHOP') || d.includes('CDB INTER') || d.includes('077')) {
    institution = 'BANCO_INTER';
  } else if (d.includes('ITAU') || d.includes('ITAÚ') || d.includes('ITAU UNIBANCO') || d.includes('341')) {
    institution = 'ITAU';
  } else if (d.includes('BRADESCO') || d.includes('237')) {
    institution = 'BRADESCO';
  } else if (d.includes('SANTANDER') || d.includes('033')) {
    institution = 'SANTANDER';
  }

  // Detect Payment Channel
  let channel: PaymentChannel = 'OUTRO';
  if (d.includes('PIX')) channel = 'PIX';
  else if (d.includes('CREDITO') || d.includes('CRÉDITO') || d.includes('CARTAO DE CREDITO') || d.includes('ROXINHO')) channel = 'CARTAO_CREDITO';
  else if (d.includes('DEBITO') || d.includes('DÉBITO')) channel = 'CARTAO_DEBITO';
  else if (d.includes('BOLETO') || d.includes('DEBITO AUT') || d.includes('FATURA')) channel = 'BOLETO';
  else if (d.includes('TED') || d.includes('DOC') || d.includes('TRANSF')) channel = 'TED';
  else if (d.includes('CDB') || d.includes('APLICACAO') || d.includes('CAIXINHA') || d.includes('RDB') || d.includes('INVEST')) channel = 'INVESTIMENTO';
  else if (d.includes('DINHEIRO') || d.includes('ESPECIE')) channel = 'DINHEIRO';

  // Categoria: regras com limite de palavra (src/services/categorizacao.ts). Sem pista, "outros":
  // a memória das suas correções e a IA resolvem depois.
  void accountPurpose;
  const r = classificarPorRegras(desc, type, lerNomeTitular());
  if (r) {
    return { ...r, channel: r.category === 'investimentos' ? 'INVESTIMENTO' : channel, institution };
  }
  return { category: type === 'credit' ? 'receitas' : 'outros', subcategory: type === 'credit' ? 'Entrada' : 'Diversos', channel, institution };
}

// Parses OFX file from any bank (Nubank, Inter, Itaú, etc.)
export function parseBankOFX(
  ofxContent: string,
  targetAccount?: BankAccount
): Transaction[] {
  const transactions: Transaction[] = [];

  // Detect bank institution from header
  let detectedInstitution: BankInstitution = targetAccount?.institution || 'OUTRO';
  const upper = ofxContent.toUpperCase();
  if (upper.includes('NUBANK') || upper.includes('NU PAGAMENTOS') || upper.includes('ORG>NUBANK') || upper.includes('BANKID>0260') || upper.includes('BANKID>260')) {
    detectedInstitution = 'NUBANK';
  } else if (upper.includes('BANCO INTER') || upper.includes('ORG>INTER') || upper.includes('BANKID>0077') || upper.includes('BANKID>077')) {
    detectedInstitution = 'BANCO_INTER';
  } else if (upper.includes('ITAU') || upper.includes('ITAÚ') || upper.includes('BANKID>0341') || upper.includes('BANKID>341')) {
    detectedInstitution = 'ITAU';
  } else if (upper.includes('BRADESCO') || upper.includes('BANKID>0237')) {
    detectedInstitution = 'BRADESCO';
  } else if (upper.includes('SANTANDER') || upper.includes('BANKID>0033')) {
    detectedInstitution = 'SANTANDER';
  }

  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  while ((match = trnRegex.exec(ofxContent)) !== null) {
    const block = match[1];

    const dtMatch = block.match(/<DTPOSTED>([^\r\n<]+)/i);
    const amtMatch = block.match(/<TRNAMT>([^\r\n<]+)/i);
    const idMatch = block.match(/<FITID>([^\r\n<]+)/i);
    const nameMatch = block.match(/<NAME>([^\r\n<]+)/i);
    const memoMatch = block.match(/<MEMO>([^\r\n<]+)/i);

    if (amtMatch && dtMatch) {
      const rawAmt = parseFloat(amtMatch[1].trim().replace(',', '.'));
      if (isNaN(rawAmt)) continue;

      const rawDt = dtMatch[1].trim();
      let formattedDate = new Date().toISOString().split('T')[0];
      let formattedTime: string | undefined = undefined;
      if (rawDt.length >= 8) {
        const year = rawDt.substring(0, 4);
        const month = rawDt.substring(4, 6);
        const day = rawDt.substring(6, 8);
        formattedDate = `${year}-${month}-${day}`;
        if (rawDt.length >= 12) {
          const hh = rawDt.substring(8, 10);
          const mm = rawDt.substring(10, 12);
          // 00:00 é só a data (bancos preenchem assim); não vale como horário
          if (!isNaN(Number(hh)) && !isNaN(Number(mm)) && `${hh}${mm}` !== '0000') {
            formattedTime = `${hh}:${mm}`;
          }
        }
      }

      const memo = memoMatch ? memoMatch[1].trim() : '';
      const nome = nameMatch ? nameMatch[1].trim() : '';
      const bruta = memo && nome && !memo.toUpperCase().includes(nome.toUpperCase()) ? `${memo}: ${nome}` : memo || nome || 'Movimentação bancária';
      const description = limparDescricaoExtrato(bruta);
      const type = rawAmt >= 0 ? 'credit' : 'debit';
      const classified = classifyTransactionLocally(description, type, targetAccount?.purpose);

      const inst = targetAccount?.institution || (detectedInstitution !== 'OUTRO' ? detectedInstitution : classified.institution);
      const accId = targetAccount?.id || `acc-${inst.toLowerCase()}`;
      const accName = targetAccount?.name || (inst === 'NUBANK' ? 'Nubank' : inst === 'BANCO_INTER' ? 'Banco Inter' : inst === 'ITAU' ? 'Itaú' : 'Conta Bancária');

      transactions.push({
        id: idMatch ? `ofx-${idMatch[1].trim()}` : `ofx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: formattedDate,
        time: formattedTime,
        createdAt: formattedTime ? `${formattedDate}T${formattedTime}:00` : undefined,
        description,
        amount: rawAmt,
        type,
        category: classified.category,
        subcategory: classified.subcategory,
        channel: classified.channel,
        accountId: accId,
        accountName: accName,
        bankInstitution: inst,
        isCategorizedByAI: false,
        status: 'liquidado',
      });
    }
  }

  return transactions;
}

// Parses CSV file from any bank (Nubank conta e cartão, Inter, Itaú e genéricos) — ver utils/extrato.ts
export function parseBankCSV(
  csvContent: string,
  targetAccount?: BankAccount
): Transaction[] {
  const r = lerCsvExtrato(csvContent, targetAccount?.type === 'CARTAO_CREDITO' ? { cartao: true } : {});
  const inst: BankInstitution = targetAccount?.institution || r.banco;
  const accId = targetAccount?.id || `acc-${inst.toLowerCase()}`;
  const accName = targetAccount?.name || (inst === 'NUBANK' ? 'Nubank' : inst === 'BANCO_INTER' ? 'Banco Inter' : inst === 'ITAU' ? 'Itaú' : 'Conta Bancária');
  return r.linhas.map((l) => {
    const type = l.amount >= 0 ? 'credit' : 'debit';
    // Na fatura do cartão, crédito = pagamento da fatura (dinheiro que já saiu da conta)
    const pagamentoFatura = r.cartao && type === 'credit' && /pagamento|recebido/i.test(l.descricaoOriginal);
    const classified = classifyTransactionLocally(l.description, type, targetAccount?.purpose);
    // id estável: reimportar o mesmo arquivo não duplica
    const chave = l.idBanco || `${l.date}|${l.amount}|${l.descricaoOriginal}`;
    return {
      id: `csv-${inst.toLowerCase()}-${hashCurto(chave)}`,
      date: l.date,
      description: pagamentoFatura ? 'Pagamento de fatura' : l.description,
      amount: l.amount,
      type,
      category: pagamentoFatura ? 'transacao_interna' : classified.category,
      subcategory: pagamentoFatura ? 'Pagamento de fatura' : classified.subcategory,
      channel: r.cartao ? 'CARTAO_CREDITO' : classified.channel,
      accountId: accId,
      accountName: accName,
      bankInstitution: inst,
      isCategorizedByAI: true,
      categorizedBy: 'regras',
      notes: l.descricaoOriginal !== l.description ? `Extrato: ${l.descricaoOriginal}` : undefined,
      status: 'liquidado',
    } as Transaction;
  });
}

function hashCurto(s: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) | 0;
    h2 = ((h2 << 5) + h2 + c * 31) | 0;
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

// Parses raw copied notification or statement text from clipboard
export function parseRawBankText(
  rawText: string,
  targetAccount?: BankAccount
): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const valMatch = line.match(/(?:R\$\s*)?(\d{1,4}(?:\.\d{3})*,\d{2})/i) || line.match(/(\d+\.\d{2})/);
    if (!valMatch) continue;

    const valStr = valMatch[1].replace(/\./g, '').replace(',', '.');
    const parsedVal = parseFloat(valStr);
    if (isNaN(parsedVal)) continue;

    const isDebit = (
      /compra|pagou|enviado|saída|saida|débito|debito/i.test(line) ||
      (/enviou/i.test(line) && !/te\s+enviou/i.test(line))
    );
    const isCreditCheck = /receb|depósito|deposito|crédito em conta|reembolso|salário|salario|estorno|te enviou|recebeu|recebido|creditado/i.test(line);
    const isCredit = isCreditCheck && !isDebit;
    const amount = isCredit ? Math.abs(parsedVal) : -Math.abs(parsedVal);

    let desc = cleanTransactionDescription(line);

    if (!desc || desc.length < 3) {
      desc = `Lançamento ${line.slice(0, 30)}`;
    }

    const type = amount >= 0 ? 'credit' : 'debit';
    const classified = classifyTransactionLocally(desc, type, targetAccount?.purpose);
    const inst = targetAccount?.institution || classified.institution;
    const accId = targetAccount?.id || `acc-${inst.toLowerCase()}`;
    const accName = targetAccount?.name || 'Conta Padrão';

    const now = new Date();
    transactions.push({
      id: `clip-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      createdAt: now.toISOString(),
      description: desc,
      amount,
      type,
      category: classified.category,
      subcategory: classified.subcategory,
      channel: classified.channel,
      accountId: accId,
      accountName: accName,
      bankInstitution: inst,
      isCategorizedByAI: false,
      status: 'liquidado',
    });
  }

  return transactions;
}
