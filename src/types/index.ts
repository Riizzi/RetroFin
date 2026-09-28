export type TransactionType = 'credit' | 'debit';

export type PaymentChannel = 
  | 'PIX' 
  | 'CARTAO_CREDITO' 
  | 'CARTAO_DEBITO' 
  | 'BOLETO' 
  | 'TED' 
  | 'INVESTIMENTO' 
  | 'DINHEIRO'
  | 'OUTRO';

export type BankInstitution = 
  | 'NUBANK' 
  | 'BANCO_INTER' 
  | 'ITAU' 
  | 'BRADESCO' 
  | 'SANTANDER' 
  | 'C6' 
  | 'CAIXA' 
  | 'CARTEIRA' 
  | 'OUTRO';

export type BankAccountType = BankInstitution;

export interface BankAccount {
  id: string;
  name: string; // e.g. "Nubank - Casa & Mercado"
  institution: BankInstitution;
  institutionName: string; // "Nubank", "Banco Inter", "Itaú Unibanco"
  type: 'CONTA_CORRENTE' | 'CARTAO_CREDITO' | 'POUPANCA' | 'INVESTIMENTO' | 'CARTEIRA';
  agency?: string;
  accountNumber?: string;
  purpose: string; // e.g. "Contas de casa e mercado" (used by AI to contextualize)
  balance: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive for income, negative for expense
  type: TransactionType;
  category: string;
  subcategory?: string;
  channel: PaymentChannel;
  accountId?: string; // links to BankAccount.id
  accountName?: string; // e.g. "Nubank - Casa & Mercado"
  bankInstitution?: BankInstitution;
  bank?: BankInstitution; // alias for institution
  account?: string; // alias for accountName
  accountPurpose?: string; // purpose for contextual AI analysis
  isCategorizedByAI: boolean;
  aiConfidence?: number;
  aiReason?: string;
  notes?: string;
  tags?: string[];
  status: 'liquidado' | 'pendente' | 'agendado';
}

export interface Category {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  icon: string;
  monthlyBudget: number; // in BRL
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  balance: number;
  savingsRate: number;
  byCategory: Record<string, number>;
}

export interface AIInsight {
  title: string;
  type: 'positive' | 'warning' | 'tip';
  message: string;
  action: string;
}
