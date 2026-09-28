import React, { useState, useMemo } from 'react';
import { Transaction, Category, BankAccount } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { formatCurrencyBRL, formatMonthName } from '../utils/formatters';
import {
  PieChart,
  BarChart3,
  Landmark,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  Layers,
  Percent,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  accounts: BankAccount[];
  currentMonth: string;
  onSelectMonth?: (m: string) => void;
}

export const AnalyticsCharts: React.FC<Props> = ({
  transactions,
  categories,
  accounts,
  currentMonth,
  onSelectMonth,
}) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'accounts' | 'monthly'>('monthly');

  // Multi-Month Filter States
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [selectedPaymentChannel, setSelectedPaymentChannel] = useState<string>('ALL');
  const [viewType, setViewType] = useState<'both' | 'expense' | 'income'>('both');
  const [chartMode, setChartMode] = useState<'bars' | 'trend' | 'breakdown'>('bars');
  const [activeMonthHover, setActiveMonthHover] = useState<string | null>(null);

  // Group by Month (All available unique months in transactions sorted chronologically)
  const allUniqueMonths = useMemo(() => {
    const setM = new Set<string>();
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        setM.add(t.date.substring(0, 7));
      }
    });
    if (setM.size === 0) {
      setM.add(new Date().toISOString().substring(0, 7));
    }
    return Array.from(setM).sort(); // chronological: older -> newer
  }, [transactions]);

  // Current Month calculations for the Categories and Accounts tabs
  const monthTransactions = useMemo(() => {
    return transactions.filter(
      (t) => t.date.startsWith(currentMonth) && t.category !== 'transacao_interna'
    );
  }, [transactions, currentMonth]);

  const currentMonthDebits = monthTransactions.filter((t) => t.type === 'debit');
  const currentMonthCredits = monthTransactions.filter((t) => t.type === 'credit');

  const totalExpense = currentMonthDebits.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const totalIncome = currentMonthCredits.reduce((acc, t) => acc + t.amount, 0);

  // Group expenses by category for current month
  const catExpenses: { category: Category; amount: number; percentage: number }[] = [];
  categories.forEach((cat) => {
    if (cat.id === 'receitas' || cat.id === 'transacao_interna') return;
    const sum = currentMonthDebits
      .filter((t) => t.category === cat.id)
      .reduce((acc, t) => acc + Math.abs(t.amount), 0);
    if (sum > 0) {
      catExpenses.push({
        category: cat,
        amount: sum,
        percentage: totalExpense > 0 ? (sum / totalExpense) * 100 : 0,
      });
    }
  });
  catExpenses.sort((a, b) => b.amount - a.amount);

  // Dynamic spending by accounts for current month
  const accountSpending = accounts.map((acc) => {
    const accDebits = currentMonthDebits.filter(
      (t) =>
        t.accountId === acc.id ||
        t.accountName === acc.name ||
        t.account === acc.name ||
        t.bankInstitution === acc.institution ||
        t.bank === acc.institution
    );
    const sum = accDebits.reduce((s, t) => s + Math.abs(t.amount), 0);
    return {
      account: acc,
      amount: sum,
      count: accDebits.length,
      percentage: totalExpense > 0 ? (sum / totalExpense) * 100 : 0,
    };
  });

  // SVG Donut calculation for Categories tab
  let cumulativeAngle = 0;
  const donutSegments = catExpenses.map((item) => {
    const angle = (item.percentage / 100) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return {
      ...item,
      startAngle,
      angle,
    };
  });

  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const createArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    if (endAngle - startAngle >= 359.9) {
      endAngle = 359.9;
    }
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  // MULTI-MONTH COMPARATIVE ENGINE:
  // Filters applied across all months in the dataset
  const filteredMultiMonthTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Exclude internal transfers by default unless explicitly exploring
      if (t.category === 'transacao_interna' && selectedCategoryId !== 'transacao_interna') {
        return false;
      }
      // Account filter
      if (selectedAccountId !== 'ALL') {
        const acc = accounts.find((a) => a.id === selectedAccountId);
        const matchesId = t.accountId === selectedAccountId;
        const matchesName = acc && (t.accountName === acc.name || t.account === acc.name);
        const matchesInst = acc && (t.bankInstitution === acc.institution || t.bank === acc.institution);
        if (!matchesId && !matchesName && !matchesInst) return false;
      }
      // Category filter
      if (selectedCategoryId !== 'ALL' && t.category !== selectedCategoryId) {
        return false;
      }
      // Channel filter
      if (selectedPaymentChannel !== 'ALL' && t.channel !== selectedPaymentChannel) {
        return false;
      }
      return true;
    });
  }, [transactions, selectedAccountId, selectedCategoryId, selectedPaymentChannel, accounts]);

  // Aggregated data per month
  const multiMonthData = useMemo(() => {
    return allUniqueMonths.map((m, index) => {
      const mTx = filteredMultiMonthTransactions.filter((t) => t.date.startsWith(m));
      const inc = mTx.filter((t) => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
      const exp = mTx.filter((t) => t.type === 'debit').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const balance = inc - exp;
      const savingsRate = inc > 0 ? ((inc - exp) / inc) * 100 : 0;

      // Group by top categories in this month
      const catMap: Record<string, number> = {};
      mTx
        .filter((t) => t.type === 'debit')
        .forEach((t) => {
          catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount);
        });

      return {
        month: m,
        income: inc,
        expense: exp,
        balance,
        savingsRate,
        count: mTx.length,
        categoriesMap: catMap,
        index,
      };
    });
  }, [allUniqueMonths, filteredMultiMonthTransactions]);

  // Multi-month summary totals
  const totalHistoricalIncome = useMemo(
    () => multiMonthData.reduce((sum, d) => sum + d.income, 0),
    [multiMonthData]
  );
  const totalHistoricalExpense = useMemo(
    () => multiMonthData.reduce((sum, d) => sum + d.expense, 0),
    [multiMonthData]
  );
  const totalHistoricalBalance = totalHistoricalIncome - totalHistoricalExpense;
  const avgMonthlyExpense =
    multiMonthData.length > 0 ? totalHistoricalExpense / multiMonthData.length : 0;
  const avgMonthlyIncome =
    multiMonthData.length > 0 ? totalHistoricalIncome / multiMonthData.length : 0;

  // Max value for scaling SVG/Bar heights
  const maxComparisonVal = useMemo(() => {
    const values: number[] = [];
    multiMonthData.forEach((d) => {
      if (viewType === 'both') {
        values.push(d.income, d.expense);
      } else if (viewType === 'income') {
        values.push(d.income);
      } else {
        values.push(d.expense);
      }
    });
    return Math.max(...values, 100);
  }, [multiMonthData, viewType]);

  const activeHighlighted = useMemo(() => {
    const targetMonth = activeMonthHover || currentMonth;
    return multiMonthData.find((d) => d.month === targetMonth) || multiMonthData[multiMonthData.length - 1];
  }, [activeMonthHover, currentMonth, multiMonthData]);

  // Comparison against previous month for the active highlighted month
  const comparisonWithPrevious = useMemo(() => {
    if (!activeHighlighted) return null;
    const idx = multiMonthData.findIndex((d) => d.month === activeHighlighted.month);
    if (idx <= 0) return null;
    const prev = multiMonthData[idx - 1];
    const diffExpense = activeHighlighted.expense - prev.expense;
    const pctExpense = prev.expense > 0 ? (diffExpense / prev.expense) * 100 : 0;
    const diffIncome = activeHighlighted.income - prev.income;
    const pctIncome = prev.income > 0 ? (diffIncome / prev.income) * 100 : 0;
    return {
      prevMonth: prev.month,
      diffExpense,
      pctExpense,
      diffIncome,
      pctIncome,
    };
  }, [activeHighlighted, multiMonthData]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Subtabs Switcher - Responsive on Mobile */}
      <div className="flex items-center gap-1 sm:gap-2 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[1px_1px_0px_#E5DCD0] sm:shadow-[2px_2px_0px_#E5DCD0]">
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-mono font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition ${
            activeTab === 'monthly'
              ? 'bg-[#292524] text-[#FAF7F2] shadow-xs'
              : 'text-[#78716C] hover:text-[#292524]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Multi-Mês ({multiMonthData.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-mono font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition ${
            activeTab === 'categories'
              ? 'bg-[#292524] text-[#FAF7F2] shadow-xs'
              : 'text-[#78716C] hover:text-[#292524]'
          }`}
        >
          <PieChart className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Categorias</span>
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-mono font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition ${
            activeTab === 'accounts'
              ? 'bg-[#292524] text-[#FAF7F2] shadow-xs'
              : 'text-[#78716C] hover:text-[#292524]'
          }`}
        >
          <Landmark className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Por Contas</span>
        </button>
      </div>

      {/* TAB 1: ADVANCED MULTI-MONTH COMPARATIVE */}
      {activeTab === 'monthly' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Header & Comprehensive Filters */}
          <div className="p-4 sm:p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[1px_1px_0px_#E5DCD0] sm:shadow-[2px_2px_0px_#E5DCD0] space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-[#FAF7F2] border border-[#E8DFD1] text-[#292524]">
                    <BarChart3 className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm sm:text-lg font-extrabold text-[#292524]">
                    Comparativo Multi-Mês
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-[#78716C] mt-0.5">
                  Visualize lado a lado tudo o que entrou e saiu mês a mês.
                </p>
              </div>

              {/* View Type Toggle (Ambos / Saídas / Entradas) */}
              <div className="flex items-center bg-[#FAF7F2] p-1 rounded-xl border border-[#E8DFD1] w-full sm:w-auto justify-between sm:justify-start">
                <button
                  onClick={() => setViewType('both')}
                  className={`flex-1 sm:flex-initial px-2.5 py-1 text-[11px] sm:text-xs font-mono font-bold rounded-lg transition text-center ${
                    viewType === 'both'
                      ? 'bg-[#292524] text-[#FAF7F2] shadow-xs'
                      : 'text-[#78716C] hover:text-[#292524]'
                  }`}
                >
                  Ambos
                </button>
                <button
                  onClick={() => setViewType('expense')}
                  className={`flex-1 sm:flex-initial px-2.5 py-1 text-[11px] sm:text-xs font-mono font-bold rounded-lg transition text-center ${
                    viewType === 'expense'
                      ? 'bg-[#C85A5A] text-white shadow-xs'
                      : 'text-[#78716C] hover:text-[#292524]'
                  }`}
                >
                  Despesas
                </button>
                <button
                  onClick={() => setViewType('income')}
                  className={`flex-1 sm:flex-initial px-2.5 py-1 text-[11px] sm:text-xs font-mono font-bold rounded-lg transition text-center ${
                    viewType === 'income'
                      ? 'bg-[#386641] text-white shadow-xs'
                      : 'text-[#78716C] hover:text-[#292524]'
                  }`}
                >
                  Receitas
                </button>
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="pt-2 sm:pt-3 border-t border-[#E8DFD1] flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-[#78716C] font-bold flex items-center gap-1 mr-0.5 text-[11px] shrink-0">
                <Filter className="w-3 h-3" />
                Filtros:
              </span>

              {/* Filter by Account */}
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-2.5 py-1 text-[11px] sm:text-xs font-mono text-[#292524] focus:outline-none cursor-pointer max-w-[150px] sm:max-w-none truncate"
              >
                <option value="ALL">Todas as Contas</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>

              {/* Filter by Category */}
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-2.5 py-1 text-[11px] sm:text-xs font-mono text-[#292524] focus:outline-none cursor-pointer max-w-[150px] sm:max-w-none truncate"
              >
                <option value="ALL">Todas as Categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Chart Mode Toggle */}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setChartMode('bars')}
                  className={`px-2 py-1 rounded-lg font-mono text-[11px] sm:text-xs font-bold border transition ${
                    chartMode === 'bars'
                      ? 'bg-[#292524] text-white border-[#292524]'
                      : 'bg-[#FAF7F2] text-[#78716C] border-[#E8DFD1]'
                  }`}
                  title="Gráfico de Colunas"
                >
                  Colunas
                </button>
                <button
                  onClick={() => setChartMode('trend')}
                  className={`px-2 py-1 rounded-lg font-mono text-[11px] sm:text-xs font-bold border transition ${
                    chartMode === 'trend'
                      ? 'bg-[#292524] text-white border-[#292524]'
                      : 'bg-[#FAF7F2] text-[#78716C] border-[#E8DFD1]'
                  }`}
                  title="Linha de Tendência"
                >
                  Tendência
                </button>
              </div>

              {(selectedAccountId !== 'ALL' ||
                selectedCategoryId !== 'ALL' ||
                selectedPaymentChannel !== 'ALL') && (
                <button
                  onClick={() => {
                    setSelectedAccountId('ALL');
                    setSelectedCategoryId('ALL');
                    setSelectedPaymentChannel('ALL');
                  }}
                  className="text-[11px] font-mono font-bold text-[#C85A5A] hover:underline px-1"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[1px_1px_0px_#E5DCD0]">
              <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-[#78716C] font-bold block truncate">
                Recebido ({multiMonthData.length}M)
              </span>
              <div className="text-base sm:text-2xl font-mono font-extrabold text-[#386641] mt-0.5 truncate">
                {formatCurrencyBRL(totalHistoricalIncome)}
              </div>
              <span className="text-[10px] sm:text-[11px] font-mono text-[#78716C] block truncate">
                Média {formatCurrencyBRL(avgMonthlyIncome)}/mês
              </span>
            </div>

            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[1px_1px_0px_#E5DCD0]">
              <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-[#78716C] font-bold block truncate">
                Gasto ({multiMonthData.length}M)
              </span>
              <div className="text-base sm:text-2xl font-mono font-extrabold text-[#C85A5A] mt-0.5 truncate">
                {formatCurrencyBRL(totalHistoricalExpense)}
              </div>
              <span className="text-[10px] sm:text-[11px] font-mono text-[#78716C] block truncate">
                Média {formatCurrencyBRL(avgMonthlyExpense)}/mês
              </span>
            </div>

            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[1px_1px_0px_#E5DCD0]">
              <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-[#78716C] font-bold block truncate">
                Resultado Líquido
              </span>
              <div
                className={`text-base sm:text-2xl font-mono font-extrabold mt-0.5 truncate ${
                  totalHistoricalBalance >= 0 ? 'text-[#386641]' : 'text-[#C85A5A]'
                }`}
              >
                {totalHistoricalBalance >= 0 ? '+' : ''}
                {formatCurrencyBRL(totalHistoricalBalance)}
              </div>
              <span className="text-[10px] sm:text-[11px] font-mono text-[#78716C] block truncate">
                {totalHistoricalIncome > 0
                  ? `${((totalHistoricalBalance / totalHistoricalIncome) * 100).toFixed(0)}% poupança total`
                  : 'Histórico acumulado'}
              </span>
            </div>

            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#FAF7F2] border border-[#E8DFD1] shadow-[1px_1px_0px_#E5DCD0]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-[#78716C] font-bold truncate">
                  Foco: {formatMonthName(activeHighlighted?.month || currentMonth).split(' ')[0]}
                </span>
                {activeHighlighted && onSelectMonth && activeHighlighted.month !== currentMonth && (
                  <button
                    onClick={() => onSelectMonth(activeHighlighted.month)}
                    className="text-[9px] font-mono text-[#C68B59] hover:underline font-bold shrink-0 ml-1"
                  >
                    Ativar ➜
                  </button>
                )}
              </div>
              <div className="text-base sm:text-lg font-mono font-extrabold text-[#292524] mt-0.5 truncate">
                {activeHighlighted?.month || currentMonth}
              </div>
              <div className="text-[10px] sm:text-xs font-mono text-[#78716C] flex items-center justify-between mt-0.5">
                <span className="text-[#386641] truncate">
                  +{formatCurrencyBRL(activeHighlighted?.income || 0)}
                </span>
                <span className="text-[#C85A5A] truncate ml-1">
                  -{formatCurrencyBRL(activeHighlighted?.expense || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* MAIN VISUAL CHART CANVAS */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] space-y-6">
            {/* Chart Legend & Interactive Instructions */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-4">
                {(viewType === 'both' || viewType === 'income') && (
                  <span className="flex items-center gap-1.5 font-bold text-[#386641]">
                    <span className="w-3 h-3 rounded-sm bg-[#386641]" />
                    Receitas (Entradas)
                  </span>
                )}
                {(viewType === 'both' || viewType === 'expense') && (
                  <span className="flex items-center gap-1.5 font-bold text-[#C85A5A]">
                    <span className="w-3 h-3 rounded-sm bg-[#C85A5A]" />
                    Despesas (Saídas)
                  </span>
                )}
                <span className="text-[11px] text-[#A8A29E] hidden sm:inline">
                  • Passe o mouse ou toque nas barras para detalhar
                </span>
              </div>

              {comparisonWithPrevious && (
                <div className="text-[11px] font-mono text-[#78716C] bg-[#FAF7F2] px-3 py-1 rounded-xl border border-[#E8DFD1]">
                  Vs {formatMonthName(comparisonWithPrevious.prevMonth)}:{' '}
                  <span
                    className={
                      comparisonWithPrevious.diffExpense <= 0
                        ? 'text-[#386641] font-bold'
                        : 'text-[#C85A5A] font-bold'
                    }
                  >
                    Gastos {comparisonWithPrevious.diffExpense <= 0 ? 'reduziram' : 'aumentaram'}{' '}
                    {Math.abs(comparisonWithPrevious.pctExpense).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {/* CHART 1: VERTICAL COMPARATIVE BARS */}
            {chartMode === 'bars' && (
              <div className="space-y-4">
                <div className="h-64 sm:h-72 w-full flex items-end gap-3 sm:gap-6 pt-6 pb-2 border-b border-[#E8DFD1] overflow-x-auto">
                  {multiMonthData.map((d) => {
                    const isHovered = activeHighlighted?.month === d.month;
                    const isSelectedCurrent = d.month === currentMonth;

                    const incomeHeightPct =
                      maxComparisonVal > 0 ? (d.income / maxComparisonVal) * 100 : 0;
                    const expenseHeightPct =
                      maxComparisonVal > 0 ? (d.expense / maxComparisonVal) * 100 : 0;

                    return (
                      <div
                        key={d.month}
                        onMouseEnter={() => setActiveMonthHover(d.month)}
                        onClick={() => onSelectMonth && onSelectMonth(d.month)}
                        className={`flex-1 min-w-[70px] sm:min-w-[90px] h-full flex flex-col justify-end items-center group cursor-pointer relative transition-all rounded-xl p-1.5 ${
                          isHovered
                            ? 'bg-[#F5EFE6]'
                            : isSelectedCurrent
                            ? 'bg-[#FAF7F2]'
                            : 'hover:bg-[#FAF7F2]'
                        }`}
                      >
                        {/* Tooltip on hover/select */}
                        {isHovered && (
                          <div className="absolute -top-12 z-20 bg-[#292524] text-[#FAF7F2] text-[10px] font-mono py-1 px-2.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                            <span className="font-bold">{formatMonthName(d.month)}</span> &bull; Saldo:{' '}
                            <span
                              className={
                                d.balance >= 0 ? 'text-[#86efac]' : 'text-[#fca5a5]'
                              }
                            >
                              {d.balance >= 0 ? '+' : ''}
                              {formatCurrencyBRL(d.balance)}
                            </span>
                          </div>
                        )}

                        {/* Dual Vertical Columns */}
                        <div className="w-full flex items-end justify-center gap-1.5 h-full">
                          {/* Income Bar */}
                          {(viewType === 'both' || viewType === 'income') && (
                            <div className="flex-1 max-w-[28px] h-full flex flex-col justify-end items-center">
                              <span className="text-[9px] font-mono text-[#386641] font-bold mb-1 opacity-0 group-hover:opacity-100 transition truncate max-w-full">
                                {formatCurrencyBRL(d.income)}
                              </span>
                              <div
                                style={{ height: `${Math.max(incomeHeightPct, 4)}%` }}
                                className={`w-full rounded-t-lg transition-all duration-300 ${
                                  isHovered
                                    ? 'bg-[#2b5233] shadow-sm'
                                    : 'bg-[#386641] group-hover:brightness-95'
                                }`}
                              />
                            </div>
                          )}

                          {/* Expense Bar */}
                          {(viewType === 'both' || viewType === 'expense') && (
                            <div className="flex-1 max-w-[28px] h-full flex flex-col justify-end items-center">
                              <span className="text-[9px] font-mono text-[#C85A5A] font-bold mb-1 opacity-0 group-hover:opacity-100 transition truncate max-w-full">
                                {formatCurrencyBRL(d.expense)}
                              </span>
                              <div
                                style={{ height: `${Math.max(expenseHeightPct, 4)}%` }}
                                className={`w-full rounded-t-lg transition-all duration-300 ${
                                  isHovered
                                    ? 'bg-[#ad3e3e] shadow-sm'
                                    : 'bg-[#C85A5A] group-hover:brightness-95'
                                }`}
                              />
                            </div>
                          )}
                        </div>

                        {/* Month Label below bar */}
                        <div className="mt-2 text-center">
                          <span
                            className={`text-xs font-mono block ${
                              isHovered || isSelectedCurrent
                                ? 'font-bold text-[#292524]'
                                : 'text-[#78716C]'
                            }`}
                          >
                            {formatMonthName(d.month).split(' ')[0]}
                          </span>
                          <span className="text-[9px] font-mono text-[#A8A29E] block">
                            {d.month.split('-')[0]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CHART 2: SVG TREND LINE VIEW */}
            {chartMode === 'trend' && (
              <div className="space-y-4">
                <div className="relative h-64 sm:h-72 w-full pt-4">
                  <svg viewBox="0 0 600 240" className="w-full h-full overflow-visible">
                    {/* Background Grid Lines */}
                    {[0, 60, 120, 180, 240].map((y) => (
                      <line
                        key={y}
                        x1="20"
                        y1={y}
                        x2="580"
                        y2={y}
                        stroke="#E8DFD1"
                        strokeDasharray="4 4"
                      />
                    ))}

                    {/* SVG Line Coordinates */}
                    {(() => {
                      const count = multiMonthData.length;
                      const stepX = count > 1 ? 540 / (count - 1) : 270;

                      const getIncomeY = (val: number) =>
                        maxComparisonVal > 0 ? 220 - (val / maxComparisonVal) * 190 : 220;
                      const getExpenseY = (val: number) =>
                        maxComparisonVal > 0 ? 220 - (val / maxComparisonVal) * 190 : 220;

                      const incomePoints = multiMonthData
                        .map((d, i) => `${30 + i * stepX},${getIncomeY(d.income)}`)
                        .join(' ');

                      const expensePoints = multiMonthData
                        .map((d, i) => `${30 + i * stepX},${getExpenseY(d.expense)}`)
                        .join(' ');

                      return (
                        <>
                          {/* Income Line & Dots */}
                          {(viewType === 'both' || viewType === 'income') && (
                            <>
                              <polyline
                                fill="none"
                                stroke="#386641"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={incomePoints}
                              />
                              {multiMonthData.map((d, i) => (
                                <circle
                                  key={`inc-${d.month}`}
                                  cx={30 + i * stepX}
                                  cy={getIncomeY(d.income)}
                                  r={activeHighlighted?.month === d.month ? '6' : '4'}
                                  fill="#386641"
                                  className="transition-all cursor-pointer hover:r-7"
                                  onMouseEnter={() => setActiveMonthHover(d.month)}
                                />
                              ))}
                            </>
                          )}

                          {/* Expense Line & Dots */}
                          {(viewType === 'both' || viewType === 'expense') && (
                            <>
                              <polyline
                                fill="none"
                                stroke="#C85A5A"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={expensePoints}
                              />
                              {multiMonthData.map((d, i) => (
                                <circle
                                  key={`exp-${d.month}`}
                                  cx={30 + i * stepX}
                                  cy={getExpenseY(d.expense)}
                                  r={activeHighlighted?.month === d.month ? '6' : '4'}
                                  fill="#C85A5A"
                                  className="transition-all cursor-pointer hover:r-7"
                                  onMouseEnter={() => setActiveMonthHover(d.month)}
                                />
                              ))}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            )}

            {/* DETAILED MONTH-BY-MONTH COMPARISON CARDS / TABLE */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-[#78716C]">
                  Histórico de Todos os Meses
                </h4>
                <span className="text-[10px] sm:text-[11px] font-mono text-[#78716C]">
                  Toque para alternar
                </span>
              </div>

              <div className="space-y-2">
                {multiMonthData.map((d, i) => {
                  const isCurrent = d.month === currentMonth;
                  const isHovered = activeHighlighted?.month === d.month;
                  const prevMonthData = i > 0 ? multiMonthData[i - 1] : null;

                  const diffWithPrev = prevMonthData ? d.expense - prevMonthData.expense : 0;
                  const incPct = maxComparisonVal > 0 ? (d.income / maxComparisonVal) * 100 : 0;
                  const expPct = maxComparisonVal > 0 ? (d.expense / maxComparisonVal) * 100 : 0;

                  return (
                    <div
                      key={d.month}
                      onClick={() => onSelectMonth && onSelectMonth(d.month)}
                      onMouseEnter={() => setActiveMonthHover(d.month)}
                      className={`p-3 sm:p-4 rounded-xl border transition cursor-pointer ${
                        isHovered
                          ? 'bg-[#F2EBE1] border-[#292524] shadow-xs'
                          : isCurrent
                          ? 'bg-[#FAF7F2] border-[#292524]'
                          : 'bg-[#FAF7F2] border-[#E8DFD1] hover:border-[#D5CBBC]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Month Identification */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-xs sm:text-sm text-[#292524] truncate">
                            {formatMonthName(d.month)}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#292524] text-[#FAF7F2] font-bold shrink-0">
                              Atual
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-[#78716C] shrink-0 hidden sm:inline">
                            ({d.count} txs)
                          </span>
                        </div>

                        {/* Values summary */}
                        <div className="flex items-center gap-3 sm:gap-6 font-mono text-xs shrink-0">
                          <div className="text-right">
                            <span className="text-[9px] text-[#78716C] block leading-tight">Receitas</span>
                            <span className="font-bold text-[11px] sm:text-xs text-[#386641]">
                              +{formatCurrencyBRL(d.income)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] text-[#78716C] block leading-tight">Despesas</span>
                            <span className="font-bold text-[11px] sm:text-xs text-[#C85A5A]">
                              -{formatCurrencyBRL(d.expense)}
                            </span>
                          </div>

                          <div className="text-right min-w-[70px]">
                            <span className="text-[9px] text-[#78716C] block leading-tight">Saldo</span>
                            <span
                              className={`font-bold text-[11px] sm:text-xs ${
                                d.balance >= 0 ? 'text-[#386641]' : 'text-[#C85A5A]'
                              }`}
                            >
                              {d.balance >= 0 ? '+' : ''}
                              {formatCurrencyBRL(d.balance)}
                            </span>
                          </div>

                          <ChevronRight className="w-4 h-4 text-[#A8A29E] shrink-0" />
                        </div>
                      </div>

                      {/* Mini visual comparison bar within card */}
                      <div className="mt-2.5 grid grid-cols-2 gap-2 pt-2 border-t border-black/5">
                        <div className="space-y-0.5">
                          <div className="h-1 rounded-full bg-[#E5DDD0] overflow-hidden">
                            <div
                              style={{ width: `${Math.min(incPct, 100)}%` }}
                              className="h-full bg-[#386641] rounded-full"
                            />
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <div className="h-1 rounded-full bg-[#E5DDD0] overflow-hidden">
                            <div
                              style={{ width: `${Math.min(expPct, 100)}%` }}
                              className="h-full bg-[#C85A5A] rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CURRENT MONTH CATEGORIES DONUT */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0]">
          {/* Chart View */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-48 h-48 sm:w-56 sm:h-56">
              <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                <circle
                  cx="100"
                  cy="100"
                  r="75"
                  fill="none"
                  stroke="#F2EBE1"
                  strokeWidth="24"
                />
                {donutSegments.map((seg, i) => (
                  <path
                    key={i}
                    d={createArc(100, 100, 75, seg.startAngle, seg.startAngle + seg.angle)}
                    fill="none"
                    stroke={seg.category.color}
                    strokeWidth="24"
                    strokeLinecap="butt"
                    className="transition-all duration-300 hover:opacity-85"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-[10px] font-mono uppercase text-[#78716C] font-bold">
                  Total Despesas
                </span>
                <span className="text-base sm:text-lg font-extrabold font-mono text-[#292524]">
                  {formatCurrencyBRL(totalExpense)}
                </span>
                <span className="text-[10px] font-mono text-[#78716C]">
                  {formatMonthName(currentMonth)}
                </span>
              </div>
            </div>
          </div>

          {/* List Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#78716C]">
              Maiores Gastos por Categoria
            </h4>
            {catExpenses.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {catExpenses.map((item) => (
                  <div
                    key={item.category.id}
                    className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: item.category.bgColor,
                          color: item.category.color,
                        }}
                      >
                        <CategoryIcon
                          categoryId={item.category.id}
                          iconName={item.category.icon}
                          className="w-3.5 h-3.5"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#292524] truncate">
                          {item.category.name}
                        </p>
                        <p className="text-[10px] font-mono text-[#78716C]">
                          {item.percentage.toFixed(1)}% do total
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-bold font-mono text-[#292524]">
                        {formatCurrencyBRL(item.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#78716C]">
                Nenhuma despesa registrada neste mês.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ACCOUNTS BREAKDOWN */}
      {activeTab === 'accounts' && (
        <div className="p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] space-y-6">
          <div>
            <h3 className="text-base font-bold text-[#292524]">Distribuição por Conta Bancária</h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              Gastos divididos de acordo com a finalidade de cada conta cadastrada.
            </p>
          </div>

          {accountSpending.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {accountSpending.map((item) => (
                <div
                  key={item.account.id}
                  className="p-5 rounded-2xl border space-y-3 transition"
                  style={{
                    backgroundColor: item.account.bgColor,
                    borderColor: item.account.borderColor,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.account.color }}
                      />
                      <span
                        className="font-mono font-bold text-sm truncate"
                        style={{ color: item.account.color }}
                      >
                        {item.account.name}
                      </span>
                    </div>
                    <span
                      className="text-xs font-mono font-bold shrink-0 ml-1"
                      style={{ color: item.account.color }}
                    >
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>

                  <p className="text-[11px] text-[#57534E] line-clamp-2">
                    {item.account.purpose}
                  </p>

                  <div className="pt-2 border-t border-black/5 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#78716C] block">
                        Gastos no mês
                      </span>
                      <span className="text-xl font-extrabold font-mono text-[#292524]">
                        {formatCurrencyBRL(item.amount)}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#78716C]">
                      {item.count} transações
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#78716C] bg-[#FAF7F2] rounded-xl border border-[#E8DFD1]">
              Nenhuma conta bancária cadastrada. Clique no botão "+" no topo para cadastrar.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
