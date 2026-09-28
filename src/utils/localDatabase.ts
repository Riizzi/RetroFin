import { BankAccount, Category, Transaction, MonthlySummary } from '../types';
import { INITIAL_CATEGORIES } from '../data/categories';
import { INITIAL_ACCOUNTS } from '../data/initialAccounts';
import { INITIAL_TRANSACTIONS } from '../data/mockTransactions';

export const DB_KEYS = {
  ACCOUNTS: 'retrofin_accounts_v3',
  TRANSACTIONS: 'retrofin_transactions_v3',
  CATEGORIES: 'retrofin_categories_v3',
  APP_CONFIG: 'retrofin_config_v3',
  MONTHLY_BUDGET: 'retrofin_monthly_budget_v3',
};

export interface LocalDatabaseExport {
  version: string;
  exportedAt: string;
  app: string;
  accounts: BankAccount[];
  transactions: Transaction[];
  categories: Category[];
}

// Load Accounts from local storage
export function loadLocalAccounts(): BankAccount[] {
  try {
    const raw = localStorage.getItem(DB_KEYS.ACCOUNTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load accounts from localStorage', e);
  }
  // Start with empty accounts array if user has not created any yet
  return [];
}

// Save Accounts to local storage
export function saveLocalAccounts(accounts: BankAccount[]): void {
  try {
    localStorage.setItem(DB_KEYS.ACCOUNTS, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save accounts to localStorage', e);
  }
}

// Load Transactions from local storage
export function loadLocalTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(DB_KEYS.TRANSACTIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load transactions from localStorage', e);
  }
  return [];
}

// Save Transactions to local storage
export function saveLocalTransactions(transactions: Transaction[]): void {
  try {
    localStorage.setItem(DB_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  } catch (e) {
    console.error('Failed to save transactions to localStorage', e);
  }
}

// Sort categories alphabetically by name, with 'outros' always at the end
export function sortCategoriesAlphabetically(cats: Category[]): Category[] {
  return [...cats].sort((a, b) => {
    if (a.id === 'outros') return 1;
    if (b.id === 'outros') return -1;
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
  });
}

// Load Categories from local storage
export function loadLocalCategories(): Category[] {
  try {
    const raw = localStorage.getItem(DB_KEYS.CATEGORIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure new 'contas' category exists
        if (!parsed.some((c: Category) => c.id === 'contas')) {
          const cat = INITIAL_CATEGORIES.find((c) => c.id === 'contas');
          if (cat) parsed.push(cat);
        }
        // Ensure new 'snacks' category exists and has updated name
        const snacksCat = parsed.find((c: Category) => c.id === 'snacks');
        if (!snacksCat) {
          const cat = INITIAL_CATEGORIES.find((c) => c.id === 'snacks');
          if (cat) parsed.push(cat);
        } else if (snacksCat.name !== 'Snacks & Mimos') {
          snacksCat.name = 'Snacks & Mimos';
        }
        // Ensure new 'transacao_interna' category exists
        if (!parsed.some((c: Category) => c.id === 'transacao_interna')) {
          const cat = INITIAL_CATEGORIES.find((c) => c.id === 'transacao_interna');
          if (cat) parsed.push(cat);
        }
        // Ensure separate 'farmacia' category exists
        if (!parsed.some((c: Category) => c.id === 'farmacia')) {
          const cat = INITIAL_CATEGORIES.find((c) => c.id === 'farmacia');
          if (cat) parsed.push(cat);
        }
        // Ensure 'saude' is named Saúde
        const saudeCat = parsed.find((c: Category) => c.id === 'saude');
        if (saudeCat) {
          saudeCat.name = 'Saúde';
          saudeCat.color = '#10B981';
          saudeCat.bgColor = '#ECFDF5';
          saudeCat.icon = 'Stethoscope';
        }
        // Update 'moradia' to Moradia
        const moradiaCat = parsed.find((c: Category) => c.id === 'moradia');
        if (moradiaCat) {
          moradiaCat.name = 'Moradia';
        }
        // Update 'educacao' to Educação
        const educacaoCat = parsed.find((c: Category) => c.id === 'educacao');
        if (educacaoCat) {
          educacaoCat.name = 'Educação';
        }
        // Update 'lazer' to Lazer & Saídas
        const lazerCat = parsed.find((c: Category) => c.id === 'lazer');
        if (lazerCat) {
          lazerCat.name = 'Lazer & Saídas';
          lazerCat.icon = 'Sparkles';
        }
        // Update 'servicos' to Assinaturas & Streaming
        const servicosCat = parsed.find((c: Category) => c.id === 'servicos');
        if (servicosCat) {
          servicosCat.name = 'Assinaturas & Streaming';
          servicosCat.icon = 'Tv';
        }
        // Return sorted alphabetically, with Outros at the end
        return sortCategoriesAlphabetically(parsed);
      }
    }
  } catch (e) {
    console.error('Failed to load categories from localStorage', e);
  }
  return sortCategoriesAlphabetically(INITIAL_CATEGORIES);
}

// Save Categories to local storage
export function saveLocalCategories(categories: Category[]): void {
  try {
    localStorage.setItem(DB_KEYS.CATEGORIES, JSON.stringify(categories));
  } catch (e) {
    console.error('Failed to save categories to localStorage', e);
  }
}

// Load Global Monthly Budget
export function loadLocalMonthlyBudget(): number {
  try {
    const raw = localStorage.getItem(DB_KEYS.MONTHLY_BUDGET);
    if (raw) {
      const val = parseFloat(raw);
      if (!isNaN(val) && val >= 0) return val;
    }
  } catch (e) {
    console.error('Failed to load monthly budget', e);
  }
  return 6000; // Default sensible budget target
}

// Save Global Monthly Budget
export function saveLocalMonthlyBudget(budget: number): void {
  try {
    localStorage.setItem(DB_KEYS.MONTHLY_BUDGET, budget.toString());
  } catch (e) {
    console.error('Failed to save monthly budget', e);
  }
}

// Export complete local database to JSON file download
export function exportDatabaseToJSON(
  accounts: BankAccount[],
  transactions: Transaction[],
  categories: Category[]
): void {
  const exportData: LocalDatabaseExport = {
    version: '3.0.0',
    exportedAt: new Date().toISOString(),
    app: 'RetroFin - Gestão Financeira Local & Segura',
    accounts,
    transactions,
    categories,
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.href = url;
  link.setAttribute('download', `retrofin_backup_${dateStr}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Parse imported JSON backup
export function parseDatabaseBackup(jsonContent: string): {
  accounts: BankAccount[];
  transactions: Transaction[];
  categories: Category[];
} {
  const parsed = JSON.parse(jsonContent);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Arquivo de backup inválido.');
  }

  const accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
  const transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
  const categories = Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : INITIAL_CATEGORIES;

  return { accounts, transactions, categories };
}

// Wipe local database completely
export function clearLocalDatabase(): void {
  localStorage.removeItem(DB_KEYS.ACCOUNTS);
  localStorage.removeItem(DB_KEYS.TRANSACTIONS);
  localStorage.removeItem(DB_KEYS.CATEGORIES);
}

// Seed sample demo data (Nubank, Inter, Itaú across multiple months)
export function getSampleSeedData(): {
  accounts: BankAccount[];
  transactions: Transaction[];
  categories: Category[];
} {
  return {
    accounts: INITIAL_ACCOUNTS,
    transactions: INITIAL_TRANSACTIONS,
    categories: INITIAL_CATEGORIES,
  };
}

// Dynamic Historical Month Extraction: identifies all unique YYYY-MM months from transactions
export function getAvailableMonthsFromTransactions(transactions: Transaction[]): string[] {
  const setM = new Set<string>();
  transactions.forEach((t) => {
    if (t.date && t.date.length >= 7) {
      setM.add(t.date.substring(0, 7));
    }
  });

  // If no transactions exist, include current month
  if (setM.size === 0) {
    const currentMonth = new Date().toISOString().substring(0, 7);
    setM.add(currentMonth);
  }

  return Array.from(setM).sort().reverse();
}

// Calculate Historical Summary across all months
export function calculateHistoricalSummaries(
  transactions: Transaction[],
  categories: Category[]
): MonthlySummary[] {
  const months = getAvailableMonthsFromTransactions(transactions);

  return months.map((month) => {
    const monthTx = transactions.filter((t) => t.date.startsWith(month));
    const credits = monthTx.filter((t) => t.type === 'credit');
    const debits = monthTx.filter((t) => t.type === 'debit');

    const totalIncome = credits.reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = debits.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const balance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

    const byCat: Record<string, number> = {};
    categories.forEach((cat) => {
      byCat[cat.id] = debits
        .filter((t) => t.category === cat.id)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    });

    return {
      month,
      income: totalIncome,
      expense: totalExpense,
      balance,
      savingsRate,
      byCategory: byCat,
    };
  });
}
