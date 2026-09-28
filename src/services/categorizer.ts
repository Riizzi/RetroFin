import { Transaction, BankAccount, AIInsight } from '../types';
import { classifyTransactionLocally } from '../utils/ofxParser';

export async function categorizeTransactionsWithAI(
  transactions: Transaction[],
  accounts: BankAccount[] = [],
  manualExamples: Transaction[] = []
): Promise<{ updated: Transaction[]; engine: string; error?: string }> {
  if (transactions.length === 0) {
    return { updated: [], engine: 'none' };
  }

  const accountMap = new Map(accounts.map(a => [a.id, a]));

  try {
    const payload = transactions.map(t => {
      const acc = (t.accountId ? accountMap.get(t.accountId) : undefined) ||
        accounts.find(a => a.name === t.accountName || a.institution === (t.bankInstitution || t.bank));
      return {
        id: t.id,
        description: t.description,
        amount: t.amount,
        type: t.type,
        date: t.date,
        accountName: acc?.name || t.accountName || t.account || 'Conta Bancária',
        accountPurpose: acc?.purpose || t.accountPurpose || 'Geral',
      };
    });

    // Provide few-shot manual classifications from the user as gold standard examples
    const examplesPayload = manualExamples.slice(0, 40).map(t => {
      const acc = (t.accountId ? accountMap.get(t.accountId) : undefined) ||
        accounts.find(a => a.name === t.accountName || a.institution === (t.bankInstitution || t.bank));
      return {
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.category,
        subcategory: t.subcategory || '',
        accountName: acc?.name || t.accountName || '',
        accountPurpose: acc?.purpose || '',
      };
    });

    const response = await fetch('/api/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: payload, manualExamples: examplesPayload }),
    });

    if (!response.ok) {
      throw new Error(`Servidor retornou erro: ${response.status}`);
    }

    const data = await response.json();
    const resultsMap = new Map<string, any>((data.results || []).map((r: any) => [r.id, r]));

    const updated = transactions.map(t => {
      const match = resultsMap.get(t.id);
      if (match) {
        return {
          ...t,
          category: match.category || t.category,
          subcategory: match.subcategory || t.subcategory,
          isCategorizedByAI: true,
          aiConfidence: match.confidence ?? 0.95,
          aiReason: match.reason || 'Classificado pelo assistente de IA com base no contexto da conta',
        };
      }
      return t;
    });

    return {
      updated,
      engine: data.engine || 'gemini-3.8-flash',
      error: data.warning,
    };
  } catch (err: any) {
    console.warn('API categorization failed, falling back to local Brazilian classifier:', err);
    const updated = transactions.map(t => {
      const acc = (t.accountId ? accountMap.get(t.accountId) : undefined) ||
        accounts.find(a => a.name === t.accountName || a.institution === (t.bankInstitution || t.bank));
      const local = classifyTransactionLocally(t.description || '', t.type, acc?.purpose);
      return {
        ...t,
        category: local.category,
        subcategory: local.subcategory,
        isCategorizedByAI: true,
        aiConfidence: 0.85,
        aiReason: 'Classificado pelo motor rápido local com base no contexto da conta',
      };
    });

    return {
      updated,
      engine: 'local-rules-fallback',
      error: err.message,
    };
  }
}

export async function fetchAIInsights(
  month: string,
  summary: { income: number; expense: number; balance: number },
  topExpenses: { category: string; amount: number }[]
): Promise<AIInsight[]> {
  try {
    const res = await fetch('/api/ai-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, summary, topExpenses }),
    });
    if (!res.ok) throw new Error('Falha ao obter insights');
    const data = await res.json();
    return data.insights || [];
  } catch (e) {
    return [
      {
        title: 'Gestão Inteligente por Conta',
        type: 'tip',
        message: 'Utilizar contas dedicadas (ex: Nubank para despesas de casa e Inter para gastos pessoais) simplifica o controle do orçamento.',
        action: 'Acompanhe os limites por categoria na aba Orçamento.',
      },
      {
        title: 'Aporte de Reserva',
        type: 'positive',
        message: 'Mantenha os aportes nas Caixinhas do Nubank ou CDB Inter para render 100%+ do CDI com liquidez imediata.',
        action: 'Programar aporte recorrente.',
      },
    ];
  }
}
