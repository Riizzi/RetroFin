import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, Category, BankAccount, AIInsight } from './types';
import { TransactionItem } from './components/TransactionItem';
import { TransactionModal } from './components/TransactionModal';
import { NewTransactionModal } from './components/NewTransactionModal';
import { BankAccountModal } from './components/BankAccountModal';
import { BudgetManager } from './components/BudgetManager';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { AutomationHub } from './components/AutomationHub';
import { AIInsightsCard } from './components/AIInsightsCard';
import { BankBadge } from './components/BankBadge';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
import { ConfirmationModal } from './components/ConfirmationModal';
import { LockScreen } from './components/LockScreen';
import { SecuritySettingsModal } from './components/SecuritySettingsModal';
import { CloudAccountModal } from './components/CloudAccountModal';
import {
  loadSecurityConfig,
  isSessionUnlocked,
  lockAppSession,
  SecurityConfig,
} from './utils/security';
import { categorizeTransactionsWithAI, fetchAIInsights } from './services/categorizer';
import { formatCurrencyBRL, formatMonthName, getTransactionTimestamp } from './utils/formatters';
import { cleanTransactionDescription } from './utils/ofxParser';
import {
  loadLocalAccounts,
  saveLocalAccounts,
  loadLocalTransactions,
  saveLocalTransactions,
  loadLocalCategories,
  saveLocalCategories,
  sortCategoriesAlphabetically,
  loadLocalMonthlyBudget,
  saveLocalMonthlyBudget,
  getAvailableMonthsFromTransactions,
  getSampleSeedData,
  clearLocalDatabase,
} from './utils/localDatabase';
import {
  initAuth,
  signInWithGoogle,
  signOutUser,
  syncAccountsToCloud,
  syncTransactionsToCloud,
  syncCategoriesToCloud,
  saveGlobalMonthlyBudget,
  getUserAccountsCollection,
  getUserTransactionsCollection,
  getUserBudgetGoalsCollection,
  getUserDocRef,
  deleteTransactionFromCloud,
  deleteAccountFromCloud,
  deleteCategoryFromCloud,
  clearCloudDatabase,
} from './firebase';
import { onSnapshot, getDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { INITIAL_CATEGORIES } from './data/categories';

import {
  LayoutDashboard,
  Receipt,
  Target,
  PieChart,
  Zap,
  Plus,
  Sparkles,
  Eye,
  EyeOff,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Edit2,
  Database,
  RotateCcw,
  Banknote,
  Shield,
  Lock,
  Fingerprint,
  Cloud,
  LogIn,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'budgets' | 'analytics' | 'automation'>('dashboard');

  // Persistence State from Local Storage + Cloud Firestore Sync
  const [accounts, setAccounts] = useState<BankAccount[]>(() => loadLocalAccounts());
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadLocalTransactions());
  const [categories, setCategories] = useState<Category[]>(() => loadLocalCategories());
  const [globalMonthlyBudget, setGlobalMonthlyBudget] = useState<number>(() => loadLocalMonthlyBudget());
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Security & Biometric Lock State
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => loadSecurityConfig());
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const cfg = loadSecurityConfig();
    return cfg.pinEnabled && !isSessionUnlocked(cfg);
  });
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);

  // Auto-lock on visibility change or page hide
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && securityConfig.pinEnabled) {
        if (securityConfig.autoLockMinutes === 0) {
          lockAppSession();
          setIsLocked(true);
        }
      } else if (document.visibilityState === 'visible' && securityConfig.pinEnabled) {
        if (!isSessionUnlocked(securityConfig)) {
          setIsLocked(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [securityConfig]);

  // Selected Month (Dynamic from database or current YYYY-MM)
  const availableMonths = useMemo(() => {
    return getAvailableMonthsFromTransactions(transactions);
  }, [transactions]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const list = getAvailableMonthsFromTransactions(transactions);
    return list[0] || new Date().toISOString().substring(0, 7);
  });

  // Keep selectedMonth valid if availableMonths change
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Authenticate user with Firebase for cross-device cloud persistence
  useEffect(() => {
    const unsubscribe = initAuth((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Listen to remote Firestore collections when authenticated
  useEffect(() => {
    if (!currentUser) return;
    const userId = currentUser.uid;

    // Load remote User Doc (global budget, etc.)
    getDoc(getUserDocRef(userId))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.monthlyBudget && data.monthlyBudget > 0) {
            setGlobalMonthlyBudget(data.monthlyBudget);
            saveLocalMonthlyBudget(data.monthlyBudget);
          }
        }
      })
      .catch((err) => {
        console.warn('Firestore user doc read error:', err);
      });

    // Listen to Accounts
    let unsubAccounts = () => {};
    let isInitialAccLoad = true;
    try {
      unsubAccounts = onSnapshot(
        getUserAccountsCollection(userId),
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteAccounts: BankAccount[] = [];
            snapshot.forEach((doc) => {
              remoteAccounts.push(doc.data() as BankAccount);
            });
            if (remoteAccounts.length > 0) {
              setAccounts(remoteAccounts);
              saveLocalAccounts(remoteAccounts);
            }
          } else {
            if (isInitialAccLoad) {
              // Remote has no accounts for this user yet - if local has accounts, upload them to cloud!
              const currentLocal = loadLocalAccounts();
              if (currentLocal.length > 0) {
                syncAccountsToCloud(userId, currentLocal);
              }
            } else {
              setAccounts([]);
              saveLocalAccounts([]);
            }
          }
          isInitialAccLoad = false;
        },
        (error) => {
          console.warn('Firestore accounts listener error:', error);
        }
      );
    } catch (e) {
      console.warn('Failed to attach accounts listener:', e);
    }

    // Listen to Transactions
    let unsubTx = () => {};
    let isInitialTxLoad = true;
    try {
      unsubTx = onSnapshot(
        getUserTransactionsCollection(userId),
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteTx: Transaction[] = [];
            let needsUpdate = false;
            snapshot.forEach((doc) => {
              const tx = doc.data() as Transaction;
              const cleanedDesc = cleanTransactionDescription(tx.description);
              if (cleanedDesc !== tx.description) {
                needsUpdate = true;
                tx.description = cleanedDesc;
              }
              remoteTx.push(tx);
            });
            if (remoteTx.length > 0) {
              setTransactions(remoteTx);
              saveLocalTransactions(remoteTx);
              if (needsUpdate) {
                console.log('[Migration] Automatically cleaning transaction descriptions in Firestore...');
                syncTransactionsToCloud(userId, remoteTx);
              }
            }
          } else {
            if (isInitialTxLoad) {
              // Remote has no transactions yet - if local has transactions, upload them to cloud!
              const currentLocalTx = loadLocalTransactions();
              if (currentLocalTx.length > 0) {
                syncTransactionsToCloud(userId, currentLocalTx);
              }
            } else {
              setTransactions([]);
              saveLocalTransactions([]);
            }
          }
          isInitialTxLoad = false;
        },
        (error) => {
          console.warn('Firestore transactions listener error:', error);
        }
      );
    } catch (e) {
      console.warn('Failed to attach transactions listener:', e);
    }

    return () => {
      unsubAccounts();
      unsubTx();
    };
  }, [currentUser]);

  // Save changes to Local Storage & Cloud
  useEffect(() => {
    saveLocalAccounts(accounts);
    if (currentUser && accounts.length > 0) {
      syncAccountsToCloud(currentUser.uid, accounts);
    }
  }, [accounts, currentUser]);

  useEffect(() => {
    saveLocalTransactions(transactions);
    if (currentUser && transactions.length > 0) {
      syncTransactionsToCloud(currentUser.uid, transactions);
    }
  }, [transactions, currentUser]);

  useEffect(() => {
    saveLocalCategories(categories);
    if (currentUser && categories.length > 0) {
      syncCategoriesToCloud(currentUser.uid, categories);
    }
  }, [categories, currentUser]);

  useEffect(() => {
    saveLocalMonthlyBudget(globalMonthlyBudget);
    if (currentUser) {
      saveGlobalMonthlyBudget(currentUser.uid, globalMonthlyBudget, selectedMonth);
    }
  }, [globalMonthlyBudget, currentUser, selectedMonth]);

  // Account Filter ('ALL' or specific account id)
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<'ALL' | string>('ALL');
  const [hideBalances, setHideBalances] = useState(false);

  // Modals
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<Transaction | null>(null);
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<BankAccount | null>(null);
  const [txToDelete, setTxToDelete] = useState<{ id: string; description: string; amount: number } | null>(null);

  // AI & Batch status
  const [isBatchCategorizing, setIsBatchCategorizing] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState<string | null>(null);

  // Status and Insights
  const [insights, setInsights] = useState<AIInsight[]>([
    {
      title: 'Classificação por Conta',
      type: 'tip',
      message: 'A categorização considera a finalidade informada em cada conta (ex: Casa & Mercado vs Pessoal).',
      action: 'Ajuste o nome e finalidade das contas para refinar as classificações.',
    },
    {
      title: 'Armazenamento Local',
      type: 'positive',
      message: 'Os registros são gravados na memória local deste navegador/dispositivo.',
      action: 'Exporte backups periódicos em arquivo JSON.',
    },
  ]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Search & Filters in Transactions Tab
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'debit' | 'credit'>('ALL');
  const [filterChannel, setFilterChannel] = useState('ALL');
  const [dateSortOrder, setDateSortOrder] = useState<'desc' | 'asc'>('desc');

  const handlePrevMonth = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx !== -1 && idx < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[idx + 1]);
    }
  };

  const handleNextMonth = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx > 0) {
      setSelectedMonth(availableMonths[idx - 1]);
    }
  };

  // Month transactions (optionally filtered by selected account, sorted chronologically by transaction date)
  const monthTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (!t.date.startsWith(selectedMonth)) return false;
        if (selectedAccountFilter !== 'ALL') {
          const matchesId = t.accountId === selectedAccountFilter;
          const acc = accounts.find((a) => a.id === selectedAccountFilter);
          const matchesName = acc && (t.accountName === acc.name || t.account === acc.name);
          const matchesInst = acc && (t.bankInstitution === acc.institution || t.bank === acc.institution);
          if (!matchesId && !matchesName && !matchesInst) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Primary sort: Date + Time descending (newest transaction first)
        const tsDiff = getTransactionTimestamp(b) - getTransactionTimestamp(a);
        if (tsDiff !== 0) return tsDiff;
        // Secondary sort: alphabetical description for deterministic order
        return a.description.localeCompare(b.description);
      });
  }, [transactions, selectedMonth, selectedAccountFilter, accounts]);

  // Financial summary for selected month (Transação Interna is excluded from expense/income analysis)
  const monthSummary = useMemo(() => {
    const credits = monthTransactions.filter((t) => t.type === 'credit' && t.category !== 'transacao_interna');
    const debits = monthTransactions.filter((t) => t.type === 'debit' && t.category !== 'transacao_interna');

    const totalIncome = credits.reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = debits.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const balance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

    return {
      income: totalIncome,
      expense: totalExpense,
      balance,
      savingsRate,
    };
  }, [monthTransactions]);

  // Dynamic Balances for each registered account
  const accountBalances = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;

    accounts.forEach((acc) => {
      const accTxs = transactions.filter(
        (t) =>
          t.accountId === acc.id ||
          t.accountName === acc.name ||
          t.account === acc.name ||
          t.bankInstitution === acc.institution ||
          t.bank === acc.institution
      );
      const net = accTxs.reduce((sum, t) => sum + t.amount, 0);
      const currentBal = (acc.balance || 0) + net;
      map[acc.id] = currentBal;
      total += currentBal;
    });

    return { map, total };
  }, [accounts, transactions]);

  // Filtered transactions for list view (sorted by transaction date)
  const filteredTransactions = useMemo(() => {
    return monthTransactions
      .filter((t) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesDesc = t.description.toLowerCase().includes(q);
          const matchesSubcat = (t.subcategory || '').toLowerCase().includes(q);
          const matchesTags = (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
          if (!matchesDesc && !matchesSubcat && !matchesTags) return false;
        }
        if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
        if (filterType !== 'ALL' && t.type !== filterType) return false;
        if (filterChannel !== 'ALL' && t.channel !== filterChannel) return false;
        return true;
      })
      .sort((a, b) => {
        const timeA = getTransactionTimestamp(a);
        const timeB = getTransactionTimestamp(b);
        if (dateSortOrder === 'desc') {
          const diff = timeB - timeA;
          return diff !== 0 ? diff : a.description.localeCompare(b.description);
        } else {
          const diff = timeA - timeB;
          return diff !== 0 ? diff : a.description.localeCompare(b.description);
        }
      });
  }, [monthTransactions, searchQuery, filterCategory, filterType, filterChannel, dateSortOrder]);

  // AI Categorize action for the current month
  const handleCategorizeMonthWithAI = async () => {
    if (monthTransactions.length === 0) {
      alert('Nenhuma transação encontrada no mês selecionado para categorizar.');
      return;
    }

    setIsBatchCategorizing(true);
    setAiStatusMsg('Analisando seu padrão manual e replicando nas transações...');

    try {
      // Find transactions that the user has already classified manually (or reviewed) in the database
      // These act as high-priority few-shot training examples for Gemini
      const manualExamples = transactions.filter(
        (t) => t.category && t.category !== 'outros' && !t.isCategorizedByAI
      );

      const result = await categorizeTransactionsWithAI(monthTransactions, accounts, manualExamples);
      const updatedMap = new Map(result.updated.map((t) => [t.id, t]));

      setTransactions((prev) => prev.map((t) => updatedMap.get(t.id) || t));
      setAiStatusMsg(
        `Classificação concluída: ${result.updated.length} transações atualizadas com seu padrão.`
      );

      setTimeout(() => {
        setAiStatusMsg(null);
      }, 4000);
    } catch (err: any) {
      setAiStatusMsg(`Erro na categorização: ${err.message}`);
    } finally {
      setIsBatchCategorizing(false);
    }
  };

  // Refresh AI Insights
  const handleRefreshInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const debits = monthTransactions.filter((t) => t.type === 'debit');
      const topExpenses = categories
        .filter((c) => c.id !== 'receitas')
        .map((c) => ({
          category: c.name,
          amount: debits.filter((t) => t.category === c.id).reduce((s, t) => s + Math.abs(t.amount), 0),
        }))
        .filter((x) => x.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4);

      const newInsights = await fetchAIInsights(
        formatMonthName(selectedMonth),
        { income: monthSummary.income, expense: monthSummary.expense, balance: monthSummary.balance },
        topExpenses
      );
      setInsights(newInsights);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  // Account Management Handlers
  const handleSaveAccount = (savedAcc: BankAccount) => {
    setAccounts((prev) => {
      const exists = prev.some((a) => a.id === savedAcc.id);
      if (exists) {
        return prev.map((a) => (a.id === savedAcc.id ? savedAcc : a));
      }
      return [...prev, savedAcc];
    });
  };

  const handleDeleteAccount = (accId: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== accId));
    if (selectedAccountFilter === accId) {
      setSelectedAccountFilter('ALL');
    }
    if (currentUser) {
      deleteAccountFromCloud(currentUser.uid, accId);
    }
  };

  // Transaction Management Handlers
  const handleSaveTransaction = (updated: Transaction) => {
    setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    if (currentUser) {
      deleteTransactionFromCloud(currentUser.uid, id);
    }
  };

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions((prev) => [newTx, ...prev]);
    // If transaction date is in a different month, optionally switch to it
    const txMonth = newTx.date.substring(0, 7);
    if (!availableMonths.includes(txMonth)) {
      setSelectedMonth(txMonth);
    }
  };

  // Batch import transactions (from OFX, CSV, copied text)
  const handleImportTransactions = useCallback((imported: Transaction[]) => {
    setTransactions((prev) => [...imported, ...prev]);
    if (imported.length > 0 && imported[0].date) {
      const newestMonth = imported[0].date.substring(0, 7);
      setSelectedMonth(newestMonth);
    }
    setActiveTab('transactions');
  }, []);

  // Budget handlers: update amount, full category update, add new custom card, delete card
  const handleUpdateCategoryBudget = (catId: string, budget: number) => {
    setCategories((prev) => prev.map((c) => (c.id === catId ? { ...c, monthlyBudget: budget } : c)));
  };

  const handleUpdateCategory = (updatedCat: Category) => {
    setCategories((prev) => sortCategoriesAlphabetically(prev.map((c) => (c.id === updatedCat.id ? updatedCat : c))));
  };

  const handleAddCategory = (newCat: Category) => {
    setCategories((prev) => sortCategoriesAlphabetically([...prev, newCat]));
  };

  const handleDeleteCategory = (catId: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== catId));
    if (currentUser) {
      deleteCategoryFromCloud(currentUser.uid, catId);
    }
  };

  const handleResetDefaultCategories = () => {
    setCategories(sortCategoriesAlphabetically(INITIAL_CATEGORIES));
  };

  // Reset database completely
  const handleResetDatabase = () => {
    clearLocalDatabase();
    setAccounts([]);
    setTransactions([]);
    setSelectedAccountFilter('ALL');
    if (currentUser) {
      clearCloudDatabase(currentUser.uid);
    }
  };

  // Load sample demo data
  const handleLoadDemoData = () => {
    const demo = getSampleSeedData();
    setAccounts(demo.accounts);
    setTransactions(demo.transactions);
    setCategories(demo.categories);
    setSelectedMonth('2026-09');
  };

  // Restore backup
  const handleRestoreBackup = (backup: {
    accounts: BankAccount[];
    transactions: Transaction[];
    categories: Category[];
  }) => {
    setAccounts(backup.accounts);
    setTransactions(backup.transactions);
    setCategories(backup.categories);
    if (backup.transactions.length > 0) {
      setSelectedMonth(backup.transactions[0].date.substring(0, 7));
    }
  };

  const unclassifiedCount = monthTransactions.filter((t) => !t.isCategorizedByAI).length;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#292524] flex flex-col pb-24 sm:pb-28">
      {/* PWA Update Banner */}
      <PWAUpdateNotification />

      {/* Offline Toast */}
      <OfflineIndicator />

      {/* Top Header / Retro App Bar */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8DFD1] px-2 sm:px-8 py-1.5 sm:py-2.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Logo & Identity */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[#292524] flex items-center justify-center text-[#FAF7F2] shadow-[1px_1px_0px_#C68B59] shrink-0 border border-[#292524]">
              <Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C68B59]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <h1 className="font-extrabold text-xs sm:text-base tracking-tight text-[#292524] hidden min-[360px]:inline-block truncate">
                  RetroFin
                </h1>
                <button
                  type="button"
                  onClick={() => setIsCloudModalOpen(true)}
                  title={
                    currentUser && !currentUser.isAnonymous && currentUser.email
                      ? `Conectado como ${currentUser.email}. Clique para gerenciar.`
                      : 'Clique para sincronizar com sua Conta Google no PC e Celular'
                  }
                  className="text-[9px] sm:text-[10px] font-mono px-1 py-0.5 rounded-md sm:rounded-lg bg-[#EDF5EF] hover:bg-[#E2EDE5] text-[#386641] border border-[#CDDACF] font-bold shrink-0 flex items-center gap-1 transition active:scale-95 cursor-pointer max-w-[80px] min-[400px]:max-w-[120px] sm:max-w-none truncate"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4A7C59] animate-pulse shrink-0" />
                  <span className="truncate">
                    {currentUser && !currentUser.isAnonymous && currentUser.email
                      ? currentUser.email.split('@')[0]
                      : 'Nuvem'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
            {/* Accounts count badge */}
            <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F2EBE1] text-[#78716C] border border-[#E5DDD0] font-bold shrink-0">
              {accounts.length > 0
                ? `${accounts.length} Conta${accounts.length > 1 ? 's' : ''}`
                : 'Base Local'}
            </span>

            {/* Manual Refresh & Updates Button */}
            <button
              onClick={async () => {
                setIsManualRefreshing(true);
                if ('serviceWorker' in navigator) {
                  try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const reg of registrations) {
                      await reg.update();
                    }
                  } catch (e) {
                    console.warn('SW update check failed:', e);
                  }
                }
                try {
                  await handleRefreshInsights();
                } catch (e) {}
                
                setTimeout(() => {
                  setIsManualRefreshing(false);
                  window.location.reload();
                }, 800);
              }}
              title="Buscar novas atualizações e sincronizar"
              className="p-1.5 sm:p-2 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] text-[#78716C] hover:text-[#C68B59] hover:bg-[#FDFBF7] transition shadow-[1px_1px_0px_#E5DCD0]"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isManualRefreshing ? 'animate-spin text-[#C68B59]' : ''}`} />
            </button>

            {/* Security / Vault Status Button */}
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              title={
                securityConfig.pinEnabled
                  ? `Segurança Ativa: Senha/PIN ${securityConfig.biometricsEnabled ? '+ Biometria' : ''}`
                  : 'Configurar Senha & Biometria'
              }
              className={`p-1.5 sm:p-2 rounded-xl border transition shadow-[1px_1px_0px_#E5DCD0] flex items-center gap-1 ${
                securityConfig.pinEnabled
                  ? 'bg-[#EDF5EF] border-[#CDDACF] text-[#386641] hover:bg-[#E2EDE5]'
                  : 'bg-[#FFFDF9] border-[#E8DFD1] text-[#78716C] hover:text-[#292524] hover:bg-[#F2EBE1]'
              }`}
            >
              {securityConfig.biometricsEnabled ? (
                <Fingerprint className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#386641]" />
              ) : securityConfig.pinEnabled ? (
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#386641]" />
              ) : (
                <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
              <span className="text-[11px] font-mono font-bold hidden md:inline">
                {securityConfig.pinEnabled ? 'Protegido' : 'Segurança'}
              </span>
            </button>

            {/* Quick Lock Now button (if security enabled) */}
            {securityConfig.pinEnabled && (
              <button
                onClick={() => {
                  lockAppSession();
                  setIsLocked(true);
                }}
                title="Bloquear aplicativo agora"
                className="p-1.5 sm:p-2 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] text-[#78716C] hover:text-[#C85A5A] hover:bg-[#FAF0F0] hover:border-[#E8C0C0] transition shadow-[1px_1px_0px_#E5DCD0]"
              >
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}

            {/* Balance Visibility Toggle */}
            <button
              onClick={() => setHideBalances(!hideBalances)}
              title={hideBalances ? 'Mostrar valores' : 'Ocultar valores'}
              className="p-1.5 sm:p-2 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] text-[#78716C] hover:text-[#292524] hover:bg-[#F2EBE1] transition shadow-[1px_1px_0px_#E5DCD0]"
            >
              {hideBalances ? <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C85A5A]" /> : <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Modern Filter & Controls Strip */}
      <div className="bg-[#FFFDF9] border-b border-[#E8DFD1] px-3 sm:px-8 py-2">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Month Selector */}
          <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 bg-[#F2EBE1] border border-[#E5DDD0] rounded-xl px-1.5 py-0.5 sm:py-1 w-full sm:w-auto justify-between sm:justify-start">
              <button
                onClick={handlePrevMonth}
                disabled={availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1}
                className="p-1 rounded text-[#78716C] hover:text-[#292524] disabled:opacity-30 transition"
                title="Mês anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <span className="text-[11px] sm:text-xs font-mono font-bold text-[#292524] px-1.5 min-w-[85px] sm:min-w-[95px] text-center">
                {formatMonthName(selectedMonth)}
              </span>

              <button
                onClick={handleNextMonth}
                disabled={availableMonths.indexOf(selectedMonth) <= 0}
                className="p-1 rounded text-[#78716C] hover:text-[#292524] disabled:opacity-30 transition"
                title="Próximo mês"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* Bank Filter Pills & "+" Button */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 w-full sm:w-auto no-scrollbar">
            <span className="text-[11px] font-mono text-[#78716C] mr-0.5 shrink-0">Contas:</span>

            {/* If accounts exist, show "Todas as Contas" */}
            {accounts.length > 0 && (
              <button
                onClick={() => setSelectedAccountFilter('ALL')}
                className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-mono font-bold transition shrink-0 ${
                  selectedAccountFilter === 'ALL'
                    ? 'bg-[#292524] text-[#FAF7F2]'
                    : 'bg-[#F2EBE1] text-[#78716C] hover:text-[#292524]'
                }`}
              >
                Todas
              </button>
            )}

            {/* Registered Account Pills */}
            {accounts.map((acc) => {
              const isSelected = selectedAccountFilter === acc.id;
              return (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccountFilter(acc.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'shadow-xs border'
                      : 'bg-[#F2EBE1] text-[#78716C] hover:text-[#292524]'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: acc.bgColor,
                          borderColor: acc.borderColor,
                          color: acc.color,
                        }
                      : {}
                  }
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: acc.color }}
                  />
                  <span>{acc.name}</span>
                </button>
              );
            })}

            {/* "+" Button to Register a New Bank Account */}
            <button
              onClick={() => {
                setEditingAccount(null);
                setIsAccountModalOpen(true);
              }}
              title="Cadastrar nova conta bancária (Nubank, Inter, Itaú, Bradesco, etc.)"
              className="px-2.5 py-1 rounded-lg bg-[#FAF5ED] hover:bg-[#F3E5D3] border border-[#F3E5D3] text-[#C68B59] hover:text-[#292524] text-xs font-mono font-bold transition flex items-center gap-1 shrink-0 shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{accounts.length === 0 ? 'Cadastrar Conta' : 'Conta'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Notification Banner */}
      {aiStatusMsg && (
        <div className="bg-[#FAF5ED] border-b border-[#F3E5D3] px-4 py-2 text-center text-xs font-mono text-[#C68B59] animate-in fade-in flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{aiStatusMsg}</span>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto w-full px-3.5 sm:px-8 py-3.5 sm:py-6 space-y-4 sm:space-y-6 flex-1 pb-28 sm:pb-12">
        {/* Dynamic Account Balances Cards (Nubank, Inter, Itaú, etc.) */}
        {accounts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {accounts.map((acc) => {
              const isSelected = selectedAccountFilter === acc.id;
              const currentBal = accountBalances.map[acc.id] ?? acc.balance;

              return (
                <div
                  key={acc.id}
                  onClick={() =>
                    setSelectedAccountFilter(selectedAccountFilter === acc.id ? 'ALL' : acc.id)
                  }
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition cursor-pointer relative group ${
                    isSelected
                      ? 'shadow-[2px_2px_0px_#292524] ring-1 ring-[#292524]'
                      : 'hover:border-[#D5CBBC] shadow-[1px_1px_0px_#E5DCD0]'
                  }`}
                  style={{
                    backgroundColor: acc.bgColor,
                    borderColor: isSelected ? '#292524' : acc.borderColor,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[11px] font-mono font-bold flex items-center gap-1.5 truncate"
                      style={{ color: acc.color }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: acc.color }}
                      />
                      <span className="truncate">{acc.name}</span>
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingAccount(acc);
                        setIsAccountModalOpen(true);
                      }}
                      title="Editar dados da conta"
                      className="p-1 rounded-md hover:bg-black/10 text-[#78716C] hover:text-[#292524] transition opacity-70 group-hover:opacity-100"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-lg sm:text-2xl font-extrabold font-mono text-[#292524] mt-1 sm:mt-1.5">
                    {hideBalances ? '••••••••' : formatCurrencyBRL(currentBal)}
                  </div>

                  <p className="text-[10px] text-[#57534E] line-clamp-1 mt-0.5 sm:mt-1 font-mono">
                    {acc.purpose || `${acc.institutionName} • ${acc.type}`}
                  </p>
                </div>
              );
            })}

            {/* Compact Add Account Button */}
            <button
              onClick={() => {
                setEditingAccount(null);
                setIsAccountModalOpen(true);
              }}
              className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-dashed border-[#D5CBBC] hover:border-[#292524] bg-[#FAF7F2] hover:bg-[#F2EBE1] transition cursor-pointer flex items-center sm:flex-col justify-center gap-2 text-center"
            >
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#292524] text-[#FAF7F2] flex items-center justify-center font-bold text-xs shrink-0">
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="text-xs font-mono font-bold text-[#292524]">
                Adicionar Conta
              </span>
            </button>
          </div>
        ) : (
          /* Empty State when no accounts exist yet */
          <div className="p-4 sm:p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-xl bg-[#292524] text-[#FAF7F2] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-[#292524] leading-snug">
                  Nenhuma conta bancária cadastrada ainda
                </h3>
                <p className="text-xs text-[#78716C] mt-1 leading-relaxed">
                  Cadastre suas contas (Nubank, Inter, Itaú...) e defina a finalidade de cada uma para a IA interpretar.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setIsAccountModalOpen(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Conta</span>
              </button>

              <button
                onClick={handleLoadDemoData}
                className="w-full sm:w-auto px-3.5 py-2.5 sm:py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F2EBE1] border border-[#E8DFD1] text-xs font-mono text-[#57534E] font-bold transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Carregar Exemplo</span>
              </button>
            </div>
          </div>
        )}

        {/* Subtab Switcher when in Analytics or Automation views */}
        {(activeTab === 'analytics' || activeTab === 'automation') && (
          <div className="flex items-center gap-2 border-b border-[#E8DFD1] pb-3">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 ${
                activeTab === 'analytics'
                  ? 'bg-[#292524] text-[#FAF7F2] shadow-sm'
                  : 'bg-[#FFFDF9] text-[#78716C] hover:text-[#292524] border border-[#E8DFD1]'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>Análises & Histórico</span>
            </button>

            <button
              onClick={() => setActiveTab('automation')}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 ${
                activeTab === 'automation'
                  ? 'bg-[#292524] text-[#FAF7F2] shadow-sm'
                  : 'bg-[#FFFDF9] text-[#78716C] hover:text-[#292524] border border-[#E8DFD1]'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Importar & Celular</span>
            </button>
          </div>
        )}

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Monthly Balance Overview Card */}
            <div className="p-4 sm:p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-[#E8DFD1]">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] font-bold">
                    Resumo Consolidado &bull; {formatMonthName(selectedMonth)}
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#292524] mt-1">
                    {hideBalances
                      ? '••••••••'
                      : formatCurrencyBRL(monthSummary.balance)}
                  </div>
                  <span className="text-xs text-[#78716C] block mt-0.5">
                    Resultado líquido do mês (Receitas - Despesas)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-4 mt-2 sm:mt-0">
                  <div className="p-2.5 sm:p-3 rounded-xl bg-[#EDF5EF] border border-[#CDDACF]">
                    <span className="text-[10px] font-mono uppercase text-[#386641] font-bold block">
                      Receitas (+)
                    </span>
                    <span className="text-xs sm:text-base font-bold font-mono text-[#386641] truncate block">
                      {hideBalances ? '••••' : formatCurrencyBRL(monthSummary.income)}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-3 rounded-xl bg-[#FAF0F0] border border-[#E8C4C4]">
                    <span className="text-[10px] font-mono uppercase text-[#C85A5A] font-bold block">
                      Despesas (-)
                    </span>
                    <span className="text-xs sm:text-base font-bold font-mono text-[#C85A5A] truncate block">
                      {hideBalances ? '••••' : formatCurrencyBRL(monthSummary.expense)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress & Savings rate */}
              <div className="pt-3 sm:pt-4 flex items-center justify-between text-xs font-mono">
                <span className="text-[#78716C]">
                  Taxa de Poupança:{' '}
                  <strong className="text-[#292524]">{monthSummary.savingsRate.toFixed(1)}%</strong>
                </span>
                <span className="text-[#78716C]">
                  {monthTransactions.length} transações no mês
                </span>
              </div>
            </div>

            {/* AI Insights Card */}
            <AIInsightsCard
              insights={insights}
              isLoading={isLoadingInsights}
              onRefresh={handleRefreshInsights}
            />

            {/* Recent Transactions List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm sm:text-base text-[#292524]">
                  Lançamentos Recentes ({formatMonthName(selectedMonth)})
                </h3>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs font-mono font-bold text-[#C68B59] hover:underline"
                >
                  Ver todos ➜
                </button>
              </div>

              {monthTransactions.length > 0 ? (
                <div className="space-y-2.5">
                  {monthTransactions.slice(0, 6).map((tx) => {
                    const cat = categories.find((c) => c.id === tx.category);
                    return (
                      <TransactionItem
                        key={tx.id}
                        transaction={tx}
                        category={cat}
                        onClick={(t) => setSelectedTxForEdit(t)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] text-center space-y-2">
                  <p className="text-xs text-[#78716C]">
                    Nenhuma transação cadastrada neste mês.
                  </p>
                  <button
                    onClick={() => setIsNewTxModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#292524] text-[#FAF7F2] text-xs font-mono font-bold"
                  >
                    + Criar Primeiro Lançamento
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TRANSACTIONS LIST & FILTERS */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            {/* Search and Filters Bar */}
            <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar por estabelecimento, tags ou descrição..."
                  className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] pl-10 pr-4 py-2 text-xs sm:text-sm text-[#292524] focus:outline-none focus:border-[#292524] placeholder:text-[#A8A29E]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Type Filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-1.5 font-mono text-[#292524] focus:outline-none"
                >
                  <option value="ALL">Tipo: Todos</option>
                  <option value="debit">Saídas (Despesas)</option>
                  <option value="credit">Entradas (Receitas)</option>
                </select>

                {/* Category Filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-1.5 font-mono text-[#292524] focus:outline-none"
                >
                  <option value="ALL">Categoria: Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Channel Filter */}
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value)}
                  className="rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-1.5 font-mono text-[#292524] focus:outline-none"
                >
                  <option value="ALL">Canal: Todos</option>
                  <option value="PIX">Pix</option>
                  <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                  <option value="CARTAO_DEBITO">Cartão de Débito</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="TED">TED</option>
                  <option value="INVESTIMENTO">Investimento</option>
                </select>

                {/* Date Sort Order Toggle */}
                <button
                  type="button"
                  onClick={() => setDateSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="rounded-xl bg-[#FAF7F2] hover:bg-[#F2EBE1] border border-[#E8DFD1] px-3 py-1.5 font-mono text-[#292524] flex items-center gap-1.5 transition"
                  title="Alterar ordenação por data"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#78716C]" />
                  <span>{dateSortOrder === 'desc' ? 'Data: Mais recente primeiro' : 'Data: Mais antiga primeiro'}</span>
                </button>

                {(searchQuery || filterCategory !== 'ALL' || filterType !== 'ALL' || filterChannel !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterCategory('ALL');
                      setFilterType('ALL');
                      setFilterChannel('ALL');
                    }}
                    className="text-[11px] font-mono text-[#C85A5A] hover:underline px-2"
                  >
                    Limpar Filtros
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="space-y-2.5">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.category);
                  return (
                    <TransactionItem
                      key={tx.id}
                      transaction={tx}
                      category={cat}
                      onClick={(t) => setSelectedTxForEdit(t)}
                      onQuickDelete={(id, description, amount) => {
                        setTxToDelete({ id, description, amount });
                      }}
                    />
                  );
                })
              ) : (
                <div className="p-12 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] text-center space-y-2">
                  <p className="text-xs text-[#78716C]">
                    Nenhuma movimentação corresponde aos filtros informados.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: BUDGETS */}
        {activeTab === 'budgets' && (
          <BudgetManager
            categories={categories}
            transactions={monthTransactions}
            currentMonth={selectedMonth}
            globalMonthlyBudget={globalMonthlyBudget}
            onUpdateGlobalMonthlyBudget={(val) => setGlobalMonthlyBudget(val)}
            onUpdateBudget={handleUpdateCategoryBudget}
            onUpdateCategory={handleUpdateCategory}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            onResetDefaultCategories={handleResetDefaultCategories}
          />
        )}

        {/* TAB 4: ANALYTICS & HISTORICAL */}
        {activeTab === 'analytics' && (
          <AnalyticsCharts
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            currentMonth={selectedMonth}
            onSelectMonth={(m) => {
              setSelectedMonth(m);
              setActiveTab('transactions');
            }}
          />
        )}

        {/* TAB 5: AUTOMATION & IMPORT */}
        {activeTab === 'automation' && (
          <AutomationHub
            userId={currentUser?.uid}
            accounts={accounts}
            categories={categories}
            transactions={transactions}
            onImportTransactions={handleImportTransactions}
            onResetDatabase={handleResetDatabase}
            onLoadDemoData={handleLoadDemoData}
            onOpenNewAccountModal={() => {
              setEditingAccount(null);
              setIsAccountModalOpen(true);
            }}
            onOpenSecuritySettings={() => setIsSecurityModalOpen(true)}
            onRestoreBackup={handleRestoreBackup}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation Menu with Centered '+' Button */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-t border-[#E8DFD1] px-3 sm:px-6 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(41,37,36,0.06)]">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          {/* Tab 1: Painel */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition ${
              activeTab === 'dashboard'
                ? 'text-[#292524] font-bold'
                : 'text-[#78716C] hover:text-[#292524]'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-mono mt-0.5">Painel</span>
          </button>

          {/* Tab 2: Extrato */}
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition relative ${
              activeTab === 'transactions'
                ? 'text-[#292524] font-bold'
                : 'text-[#78716C] hover:text-[#292524]'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px] font-mono mt-0.5">Extrato</span>
          </button>

          {/* CENTER: Centered '+' Button (Novo Lançamento) */}
          <div className="flex-1 flex flex-col items-center justify-center -mt-6 shrink-0">
            <button
              onClick={() => setIsNewTxModalOpen(true)}
              title="Novo Lançamento"
              className="w-12 h-12 rounded-2xl bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] flex items-center justify-center shadow-[2px_3px_0px_#78716C] active:translate-y-0.5 active:shadow-none transition border-2 border-[#FAF7F2]"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
            <span className="text-[10px] font-mono font-bold text-[#292524] mt-0.5">Lançar</span>
          </div>

          {/* Tab 3: Orçamento */}
          <button
            onClick={() => setActiveTab('budgets')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition ${
              activeTab === 'budgets'
                ? 'text-[#292524] font-bold'
                : 'text-[#78716C] hover:text-[#292524]'
            }`}
          >
            <Target className="w-5 h-5" />
            <span className="text-[10px] font-mono mt-0.5">Orçamento</span>
          </button>

          {/* Tab 4: Análises & Importar */}
          <button
            onClick={() =>
              setActiveTab(activeTab === 'automation' ? 'automation' : 'analytics')
            }
            className={`flex-1 flex flex-col items-center justify-center py-1 transition ${
              activeTab === 'analytics' || activeTab === 'automation'
                ? 'text-[#292524] font-bold'
                : 'text-[#78716C] hover:text-[#292524]'
            }`}
          >
            <PieChart className="w-5 h-5" />
            <span className="text-[10px] font-mono mt-0.5">Análises</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <TransactionModal
        isOpen={!!selectedTxForEdit}
        transaction={selectedTxForEdit}
        categories={categories}
        accounts={accounts}
        onClose={() => setSelectedTxForEdit(null)}
        onSave={handleSaveTransaction}
        onDelete={handleDeleteTransaction}
      />

      <NewTransactionModal
        isOpen={isNewTxModalOpen}
        categories={categories}
        accounts={accounts}
        allTransactions={transactions}
        onClose={() => setIsNewTxModalOpen(false)}
        onAdd={handleAddTransaction}
        onOpenNewAccountModal={() => {
          setEditingAccount(null);
          setIsAccountModalOpen(true);
        }}
      />

      <BankAccountModal
        isOpen={isAccountModalOpen}
        account={editingAccount}
        currentCalculatedBalance={
          editingAccount ? accountBalances.map[editingAccount.id] : undefined
        }
        accountNetTransactionsTotal={
          editingAccount
            ? transactions
                .filter(
                  (t) =>
                    t.accountId === editingAccount.id ||
                    t.accountName === editingAccount.name ||
                    t.account === editingAccount.name ||
                    t.bankInstitution === editingAccount.institution ||
                    t.bank === editingAccount.institution
                )
                .reduce((sum, t) => sum + t.amount, 0)
            : 0
        }
        onClose={() => {
          setIsAccountModalOpen(false);
          setEditingAccount(null);
        }}
        onSave={handleSaveAccount}
        onDelete={(id) => {
          const acc = accounts.find((a) => a.id === id);
          if (acc) {
            setAccountToDelete(acc);
          }
        }}
      />

      {/* Confirmation Modal: Delete Bank Account */}
      <ConfirmationModal
        isOpen={!!accountToDelete}
        title="Excluir Conta Bancária"
        message={`Deseja remover a conta "${accountToDelete?.name}"? Os lançamentos associados a ela continuarão no histórico.`}
        confirmLabel="Sim, excluir conta"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={() => {
          if (accountToDelete) {
            handleDeleteAccount(accountToDelete.id);
            setAccountToDelete(null);
          }
        }}
        onCancel={() => setAccountToDelete(null)}
      />

      {/* Confirmation Modal: Delete Transaction directly from List */}
      <ConfirmationModal
        isOpen={!!txToDelete}
        title="Excluir Lançamento"
        message={`Tem certeza que deseja apagar o lançamento "${txToDelete?.description}" de ${formatCurrencyBRL(Math.abs(txToDelete?.amount || 0))}? Essa ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir lançamento"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={() => {
          if (txToDelete) {
            handleDeleteTransaction(txToDelete.id);
            setTxToDelete(null);
          }
        }}
        onCancel={() => setTxToDelete(null)}
      />

      {/* Security & Biometrics Modal */}
      <SecuritySettingsModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        config={securityConfig}
        onConfigUpdated={(newCfg) => setSecurityConfig(newCfg)}
      />

      {/* Cloud Account & Google Sync Modal */}
      <CloudAccountModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        currentUser={currentUser}
        accountsCount={accounts.length}
        transactionsCount={transactions.length}
      />

      {/* Vault Full Lock Screen (PIN + Biometrics) */}
      {isLocked && securityConfig.pinEnabled && (
        <LockScreen
          config={securityConfig}
          onUnlocked={() => setIsLocked(false)}
        />
      )}
    </div>
  );
}
