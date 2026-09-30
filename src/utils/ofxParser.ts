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
  const purpose = (accountPurpose || '').toUpperCase();

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

  // Context-aware bias based on account purpose (e.g., Casa & Mercado vs Pessoal)
  const isHouseholdAccount = purpose.includes('CASA') || purpose.includes('MERCADO') || purpose.includes('CONDOMINIO');

  // Income / Credits
  if (type === 'credit') {
    if (d.includes('SALARIO') || d.includes('FOLHA') || d.includes('PRO-LABORE')) {
      return { category: 'receitas', subcategory: 'Salário / CLT', channel, institution };
    }
    if (d.includes('RENDIMENTO') || d.includes('JUROS') || d.includes('DIVIDENDO') || d.includes('CAIXINHA') || d.includes('CDB')) {
      return { category: 'investimentos', subcategory: 'Rendimento de Aplicação', channel: 'INVESTIMENTO', institution };
    }
    if (d.includes('CASHBACK')) {
      return { category: 'receitas', subcategory: 'Cashback', channel, institution };
    }
    return { category: 'receitas', subcategory: 'PIX Recebido / Depósito', channel, institution };
  }

  // Internal Transfers (Pix between accounts, transfer between user accounts, investments)
  if (
    d.includes('TRANSFERENCIA ENTRE CONTAS') || d.includes('TRANSF ENTRE CONTAS') ||
    d.includes('MESMA TITULARIDADE') || d.includes('ENTRE MINHAS CONTAS') ||
    d.includes('APLICACAO CAIXINHA') || d.includes('RESGATE CAIXINHA') ||
    d.includes('APLICACAO CDB') || d.includes('RESGATE CDB')
  ) {
    return { category: 'transacao_interna', subcategory: 'Transferência Entre Contas / Aplicação', channel: 'INVESTIMENTO', institution };
  }

  // Snacks & Lanches Rápidos
  if (
    d.includes('DOCERIA') || d.includes('SORVETE') || d.includes('GELATO') ||
    d.includes('CACAU SHOW') || d.includes('KOPENHAGEN') || d.includes('HAVANNA') ||
    d.includes('FINI ') || d.includes('PIPOCA') || d.includes('BOMBONIERE') ||
    d.includes('CONVENIENCIA') || d.includes('CONVENIÊNCIA') || d.includes('SNACK') ||
    d.includes('DOCES') || d.includes('CHURROS') || d.includes('ACAI') || d.includes('AÇAÍ')
  ) {
    return { category: 'snacks', subcategory: 'Snacks & Sobremesas', channel, institution };
  }

  // Expenses - Food & Dining
  if (
    d.includes('IFOOD') || d.includes('RAPPI') || d.includes('UBER EATS') || d.includes('AIQFOME') ||
    d.includes('BURGER') || d.includes('MCDONALD') || d.includes('MC DONALD') || d.includes('BK ') ||
    d.includes('SUBWAY') || d.includes('ZE DELIVERY') || d.includes('DELIVERY') || d.includes('DOGAO')
  ) {
    return { category: 'alimentacao', subcategory: 'Delivery & Lanches', channel, institution };
  }
  if (
    d.includes('CARREFOUR') || d.includes('PÃO DE AÇÚCAR') || d.includes('PAO DE ACUCAR') || d.includes('ASSAI') ||
    d.includes('ATACADAO') || d.includes('ATACADÃO') || d.includes('MERCADO') || d.includes('SUPERMERCADO') ||
    d.includes('HORTIFRUTI') || d.includes('HORTOFRUTI') || d.includes('FEIRA') || d.includes('SACOLÃO') ||
    d.includes('SACOLAO') || d.includes('AÇOUGUE') || d.includes('ACOUGUE') || d.includes('MERCEARIA') ||
    d.includes('OXXO') || d.includes('EMPORIO') || d.includes('EMPÓRIO') || d.includes('MINIMERCADO')
  ) {
    return { category: 'alimentacao', subcategory: isHouseholdAccount ? 'Supermercado (Casa)' : 'Supermercado', channel, institution };
  }
  if (
    d.includes('PADARIA') || d.includes('PANIFIC') || d.includes('BAR ') || d.includes('BOTECO') ||
    d.includes('PIZZARIA') || d.includes('PIZZA') || d.includes('LANCHONETE') || d.includes('RESTAURANTE') ||
    d.includes('REST ') || d.includes('CAFE') || d.includes('CAFETERIA') || d.includes('CHURRASC') ||
    d.includes('SUSHI') || d.includes('JAPA') || d.includes('TEMAKI') || d.includes('BISTRÔ') ||
    d.includes('BISTRO')
  ) {
    return { category: 'alimentacao', subcategory: 'Restaurante & Bares', channel, institution };
  }
  if (d.includes('UBER') || d.includes('99APP') || d.includes('99 POP') || d.includes('TAXI') || d.includes('CABIFY')) {
    return { category: 'transporte', subcategory: 'Transporte por App', channel, institution };
  }
  if (d.includes('POSTO') || d.includes('SHELL') || d.includes('IPIRANGA') || d.includes('BR DISTRIBUIDORA') || d.includes('COMBUSTIVEL')) {
    return { category: 'transporte', subcategory: 'Combustível', channel, institution };
  }

  // Contas & Consumo (Luz, Água, Gás, Internet, Celular)
  if (
    d.includes('ENEL') || d.includes('CPFL') || d.includes('CEMIG') || d.includes('LIGHT') ||
    d.includes('SABESP') || d.includes('SANEPAR') || d.includes('COPASA') || d.includes('ENERGIA') ||
    d.includes('LUZ') || d.includes('AGUA') || d.includes('COMGAS') || d.includes('GAS') ||
    d.includes('ULTRAGAZ') || d.includes('LIQUIGAS')
  ) {
    return { category: 'contas', subcategory: 'Contas de Consumo (Luz/Água/Gás)', channel, institution };
  }
  if (
    d.includes('CLARO') || d.includes('VIVO') || d.includes('TIM') || d.includes('OI ') ||
    d.includes('INTERNET') || d.includes('FIBRA') || d.includes('BANDA LARGA')
  ) {
    return { category: 'contas', subcategory: 'Internet & Telefonia', channel, institution };
  }

  // Moradia (Aluguel, Condomínio, IPTU)
  if (d.includes('CONDOMINIO') || d.includes('CONDOMÍNIO') || d.includes('ALUGUEL') || d.includes('QUINTO ANDAR') || d.includes('QUINTOANDAR') || d.includes('LOFT') || d.includes('IPTU')) {
    return { category: 'moradia', subcategory: 'Aluguel & Condomínio', channel, institution };
  }
  // Streaming & Assinaturas
  if (d.includes('NETFLIX') || d.includes('SPOTIFY') || d.includes('AMAZON PRIME') || d.includes('DISNEY') || d.includes('MAX') || d.includes('YOUTUBE') || d.includes('APPLE.COM') || d.includes('DEEZER') || d.includes('GLOBOPLAY')) {
    return { category: 'servicos', subcategory: 'Assinaturas & Streaming', channel, institution };
  }
  // Lazer & Saídas
  if (d.includes('CINEMA') || d.includes('CINEMARK') || d.includes('CINEPOLIS') || d.includes('UCI') || d.includes('INGRESSO') || d.includes('SYMPLA') || d.includes('EVENTIM') || d.includes('SHOW') || d.includes('TEATRO') || d.includes('PARQUE') || d.includes('MUSEU') || d.includes('BALADA') || d.includes('BAR') || d.includes('PUB')) {
    return { category: 'lazer', subcategory: 'Lazer & Saídas', channel, institution };
  }
  if (d.includes('DROGASIL') || d.includes('DROGA RAIA') || d.includes('FARMACIA') || d.includes('DROGARIA') || d.includes('PACHECO') || d.includes('PANVEL') || d.includes('ULTRAFARMA')) {
    return { category: 'farmacia', subcategory: 'Farmácia & Higiene', channel, institution };
  }
  if (d.includes('SMART FIT') || d.includes('BLUEFIT') || d.includes('ACADEMIA') || d.includes('GYMPASS') || d.includes('TOTALPASS')) {
    return { category: 'saude', subcategory: 'Academia & Treinos', channel, institution };
  }
  if (d.includes('HOSPITAL') || d.includes('LABORATORIO') || d.includes('FLEURY') || d.includes('LAVOISIER') || d.includes('CONSULTORIO') || d.includes('MEDICO') || d.includes('MÉDICO') || d.includes('CLINICA') || d.includes('CLÍNICA') || d.includes('ODONTO') || d.includes('DENTISTA') || d.includes('UNIMED') || d.includes('BRADESCO SAUDE')) {
    return { category: 'saude', subcategory: 'Consultas & Exames Médicos', channel, institution };
  }
  if (d.includes('MERCADO LIVRE') || d.includes('AMAZON') || d.includes('SHOPEE') || d.includes('SHEIN') || d.includes('ZARA') || d.includes('RENNER')) {
    return { category: 'compras', subcategory: 'Compras & Shopping', channel, institution };
  }
  if (d.includes('CDB') || d.includes('APLICACAO') || d.includes('TESOURO') || d.includes('CAIXINHA') || d.includes('INVEST')) {
    return { category: 'investimentos', subcategory: 'Aporte de Reserva', channel: 'INVESTIMENTO', institution };
  }

  // Fallback respecting account purpose if available
  if (isHouseholdAccount) {
    return { category: 'moradia', subcategory: 'Despesa Doméstica', channel, institution };
  }

  return { category: 'outros', subcategory: 'Diversos', channel, institution };
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
          if (!isNaN(Number(hh)) && !isNaN(Number(mm))) {
            formattedTime = `${hh}:${mm}`;
          }
        }
      }

      const description = (memoMatch ? memoMatch[1].trim() : '') || (nameMatch ? nameMatch[1].trim() : '') || 'Movimentação Bancária';
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

// Parses CSV file from any bank (Nubank, Inter, Itaú, etc.)
export function parseBankCSV(
  csvContent: string,
  targetAccount?: BankAccount
): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return transactions;

  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';
  const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/["']/g, ''));

  let detectedInstitution: BankInstitution = targetAccount?.institution || 'OUTRO';
  if (firstLine.includes('title') && firstLine.includes('category') && firstLine.includes('amount')) {
    detectedInstitution = 'NUBANK';
  } else if (csvContent.toUpperCase().includes('NUBANK')) {
    detectedInstitution = 'NUBANK';
  } else if (csvContent.toUpperCase().includes('ITAU') || csvContent.toUpperCase().includes('ITAÚ')) {
    detectedInstitution = 'ITAU';
  } else if (csvContent.toUpperCase().includes('INTER')) {
    detectedInstitution = 'BANCO_INTER';
  }

  let dateIdx = headers.findIndex(h => h.includes('date') || h.includes('data'));
  let descIdx = headers.findIndex(h => h.includes('title') || h.includes('descri') || h.includes('hist') || h.includes('estabelecimento'));
  let amtIdx = headers.findIndex(h => h.includes('amount') || h.includes('valor'));

  if (dateIdx === -1) dateIdx = 0;
  if (descIdx === -1) descIdx = 1;
  if (amtIdx === -1) amtIdx = 2;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length <= Math.max(dateIdx, descIdx, amtIdx)) continue;

    const rawDate = cols[dateIdx];
    const rawDesc = cols[descIdx];
    const rawAmt = cols[amtIdx];

    let amount = parseMonetaryValue(rawAmt);
    if (isNaN(amount) || amount === 0) {
      // Check if another column contains the amount if amtIdx was empty or 0
      for (let c = 0; c < cols.length; c++) {
        if (c !== dateIdx && c !== descIdx) {
          const tryAmt = parseMonetaryValue(cols[c]);
          if (tryAmt !== 0) {
            amount = tryAmt;
            break;
          }
        }
      }
    }
    if (amount === 0 && !rawAmt.includes('0')) continue;

    // In Nubank credit card CSVs (header 'title', 'category', 'amount'), purchases are listed as positive numbers; treat as debit
    if (detectedInstitution === 'NUBANK' && headers.includes('title') && amount > 0) {
      amount = -Math.abs(amount);
    }

    let formattedDate = rawDate;
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        formattedDate = `${y}-${m}-${d}`;
      }
    }

    const type = amount >= 0 ? 'credit' : 'debit';
    const classified = classifyTransactionLocally(rawDesc, type, targetAccount?.purpose);
    const inst = targetAccount?.institution || (detectedInstitution !== 'OUTRO' ? detectedInstitution : classified.institution);
    const accId = targetAccount?.id || `acc-${inst.toLowerCase()}`;
    const accName = targetAccount?.name || (inst === 'NUBANK' ? 'Nubank' : inst === 'BANCO_INTER' ? 'Banco Inter' : inst === 'ITAU' ? 'Itaú' : 'Conta Bancária');

    transactions.push({
      id: `csv-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      date: formattedDate,
      description: rawDesc || 'Transação Bancária',
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
