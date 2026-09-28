import React, { useState } from 'react';
import { Category, Transaction } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { formatCurrencyBRL } from '../utils/formatters';
import { ConfirmationModal } from './ConfirmationModal';
import {
  AlertTriangle,
  SlidersHorizontal,
  Edit3,
  Check,
  Plus,
  Trash2,
  X,
  Target,
  TrendingDown,
  Sparkles,
} from 'lucide-react';

interface Props {
  categories: Category[];
  transactions: Transaction[];
  currentMonth?: string; // YYYY-MM
  globalMonthlyBudget?: number;
  onUpdateGlobalMonthlyBudget?: (budget: number) => void;
  onUpdateCategory?: (cat: Category) => void;
  onAddCategory?: (cat: Category) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onResetDefaultCategories?: () => void;
  // Backward compatibility
  onUpdateBudget?: (categoryId: string, newBudget: number) => void;
  onUpdateCategoryBudget?: (categoryId: string, newBudget: number) => void;
}

const AVAILABLE_COLORS = [
  { color: '#C85A5A', bgColor: '#FAF0F0', label: 'Vinho / Vermelho' },
  { color: '#4A6984', bgColor: '#EFF4F8', label: 'Azul Denim' },
  { color: '#C68B59', bgColor: '#FAF5ED', label: 'Ocre / Mostarda' },
  { color: '#4A7C59', bgColor: '#F0F6F2', label: 'Verde Sálvia' },
  { color: '#8A6286', bgColor: '#F7F2F6', label: 'Ameixa Vintage' },
  { color: '#A06D53', bgColor: '#F8F3F0', label: 'Terracota' },
  { color: '#5C715E', bgColor: '#F1F4F1', label: 'Oliva' },
  { color: '#65717B', bgColor: '#F2F4F6', label: 'Cinza Ardósia' },
  { color: '#386641', bgColor: '#EDF5EF', label: 'Verde Floresta' },
  { color: '#78716C', bgColor: '#F5F5F4', label: 'Pedra / Neutro' },
];

const AVAILABLE_ICONS = [
  { id: 'target', label: 'Meta' },
  { id: 'utensils', label: 'Alimentação' },
  { id: 'home', label: 'Casa' },
  { id: 'car', label: 'Transporte' },
  { id: 'heartpulse', label: 'Saúde' },
  { id: 'tv', label: 'Lazer' },
  { id: 'shoppingbag', label: 'Compras' },
  { id: 'graduationcap', label: 'Educação' },
  { id: 'coffee', label: 'Café & Bares' },
  { id: 'plane', label: 'Viagem' },
  { id: 'gift', label: 'Presentes' },
  { id: 'dumbbell', label: 'Academia' },
  { id: 'zap', label: 'Contas/Luz' },
  { id: 'cookie', label: 'Snacks' },
  { id: 'arrowleftright', label: 'Transf. Interna' },
  { id: 'smartphone', label: 'Celular' },
  { id: 'trendingup', label: 'Investimento' },
  { id: 'shield', label: 'Seguros' },
  { id: 'tag', label: 'Geral' },
];

export const BudgetManager: React.FC<Props> = ({
  categories,
  transactions,
  currentMonth = new Date().toISOString().substring(0, 7),
  globalMonthlyBudget = 0,
  onUpdateGlobalMonthlyBudget,
  onUpdateCategory,
  onAddCategory,
  onDeleteCategory,
  onResetDefaultCategories,
  onUpdateBudget,
  onUpdateCategoryBudget,
}) => {
  // Global Monthly Budget editing state
  const [isEditingGlobalBudget, setIsEditingGlobalBudget] = useState(false);
  const [globalBudgetInput, setGlobalBudgetInput] = useState(globalMonthlyBudget ? globalMonthlyBudget.toString() : '');

  // Editing state for existing cards
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editIcon, setEditIcon] = useState('target');
  const [editColorIdx, setEditColorIdx] = useState(0);

  // New card modal/form state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBudget, setNewBudget] = useState('500');
  const [newIcon, setNewIcon] = useState('target');
  const [newColorIdx, setNewColorIdx] = useState(2);

  // Category deletion confirmation state
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);

  // Calculate actual spending per category in currentMonth (only debits / expenses, excluding transacao_interna)
  const monthTransactions = transactions.filter(
    (t) => (!currentMonth || t.date.startsWith(currentMonth)) && t.type === 'debit' && t.category !== 'transacao_interna'
  );

  const spendingByCategory: Record<string, number> = {};
  monthTransactions.forEach((t) => {
    spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + Math.abs(t.amount);
  });

  // Filter out income and internal transfers from spending limits/metas
  const expenseCategories = categories.filter((c) => c.id !== 'receitas' && c.id !== 'transacao_interna');
  const totalBudget = expenseCategories.reduce((sum, c) => sum + (c.monthlyBudget || 0), 0);
  const effectiveTargetBudget = globalMonthlyBudget > 0 ? globalMonthlyBudget : totalBudget;
  const totalSpent = Object.values(spendingByCategory).reduce((sum, v) => sum + v, 0);
  const totalProgress = effectiveTargetBudget > 0 ? (totalSpent / effectiveTargetBudget) * 100 : 0;

  // Start editing a card
  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditTitle(cat.name);
    setEditBudget(cat.monthlyBudget.toString());
    setEditIcon(cat.icon || 'target');
    const colorIdx = AVAILABLE_COLORS.findIndex((c) => c.color === cat.color);
    setEditColorIdx(colorIdx >= 0 ? colorIdx : 0);
  };

  // Save changes to existing card
  const handleSaveEdit = (cat: Category) => {
    const val = parseFloat(editBudget.replace(',', '.'));
    const validBudget = !isNaN(val) && val >= 0 ? val : 0;
    const chosenColor = AVAILABLE_COLORS[editColorIdx] || AVAILABLE_COLORS[0];

    if (onUpdateCategory) {
      onUpdateCategory({
        ...cat,
        name: editTitle.trim() || cat.name,
        monthlyBudget: validBudget,
        icon: editIcon,
        color: chosenColor.color,
        bgColor: chosenColor.bgColor,
      });
    } else {
      const updateFn = onUpdateBudget || onUpdateCategoryBudget;
      if (updateFn) updateFn(cat.id, validBudget);
    }

    setEditingId(null);
  };

  // Create brand new custom goal / budget card
  const handleCreateNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Informe um título ou nome para a meta.');
      return;
    }

    const val = parseFloat(newBudget.replace(',', '.'));
    const validBudget = !isNaN(val) && val >= 0 ? val : 0;
    const chosenColor = AVAILABLE_COLORS[newColorIdx] || AVAILABLE_COLORS[0];

    // Create URL-safe clean ID
    const newId = `meta_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newCat: Category = {
      id: newId,
      name: newTitle.trim(),
      monthlyBudget: validBudget,
      icon: newIcon,
      color: chosenColor.color,
      bgColor: chosenColor.bgColor,
    };

    if (onAddCategory) {
      onAddCategory(newCat);
    }

    // Reset form
    setIsAddingNew(false);
    setNewTitle('');
    setNewBudget('500');
    setNewIcon('target');
    setNewColorIdx(2);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner Overview */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[1px_1px_0px_#E5DCD0] sm:shadow-[2px_2px_0px_#E5DCD0]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#C85A5A] uppercase tracking-wider">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Orçamento & Metas</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-extrabold text-[#292524] mt-0.5">
              Metas de {currentMonth}
            </h2>
            <p className="text-[11px] sm:text-xs text-[#78716C] mt-0.5">
              Defina seu teto de gastos e acompanhe o consumo em tempo real.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-3 bg-[#FAF7F2] rounded-xl border border-[#E8DFD1] flex items-center gap-2">
              <div>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#78716C] block uppercase tracking-wider">
                  Teto Orçado
                </span>
                {isEditingGlobalBudget ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs font-mono font-bold text-[#78716C]">R$</span>
                    <input
                      type="number"
                      step="50"
                      value={globalBudgetInput}
                      onChange={(e) => setGlobalBudgetInput(e.target.value)}
                      placeholder="Ex: 5000"
                      className="w-20 px-1.5 py-0.5 text-xs font-mono font-bold rounded border border-[#292524] bg-white text-[#292524] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = parseFloat(globalBudgetInput);
                        if (onUpdateGlobalMonthlyBudget && !isNaN(parsed)) {
                          onUpdateGlobalMonthlyBudget(parsed);
                        }
                        setIsEditingGlobalBudget(false);
                      }}
                      className="p-1 rounded bg-[#292524] text-white hover:bg-[#44403C]"
                      title="Salvar Orçamento"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGlobalBudgetInput(globalMonthlyBudget ? globalMonthlyBudget.toString() : '');
                        setIsEditingGlobalBudget(false);
                      }}
                      className="p-1 rounded bg-stone-200 text-stone-700 hover:bg-stone-300"
                      title="Cancelar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-sm sm:text-base font-extrabold font-mono text-[#292524]">
                      {globalMonthlyBudget > 0 ? formatCurrencyBRL(globalMonthlyBudget) : formatCurrencyBRL(totalBudget)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setGlobalBudgetInput((globalMonthlyBudget || totalBudget).toString());
                        setIsEditingGlobalBudget(true);
                      }}
                      className="p-1 rounded-md text-[#78716C] hover:text-[#292524] hover:bg-[#E8DFD1]/50 transition"
                      title="Editar Teto do Mês"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[9px] sm:text-xs font-mono text-[#78716C] block">Gasto Realizado</span>
              <div className="text-base sm:text-2xl font-extrabold font-mono text-[#292524]">
                <span className={totalSpent > (globalMonthlyBudget || totalBudget) && (globalMonthlyBudget || totalBudget) > 0 ? 'text-[#C85A5A]' : 'text-[#292524]'}>
                  {formatCurrencyBRL(totalSpent)}
                </span>
              </div>
            </div>

            {/* Button to Add New Budget Card */}
            <button
              onClick={() => setIsAddingNew(true)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Categoria</span>
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-3 sm:mt-4">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono text-[#78716C] mb-1">
            <span>Consumo ({monthTransactions.length} despesas)</span>
            <span
              className={`font-bold ${
                totalProgress > 100
                  ? 'text-[#C85A5A]'
                  : totalProgress > 80
                  ? 'text-[#C68B59]'
                  : 'text-[#386641]'
              }`}
            >
              {Math.round(totalProgress)}%
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-[#F2EBE1] overflow-hidden p-0.5 border border-[#E5DDD0]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totalProgress > 100
                  ? 'bg-[#C85A5A]'
                  : totalProgress > 80
                  ? 'bg-[#C68B59]'
                  : 'bg-[#4A7C59]'
              }`}
              style={{ width: `${Math.min(totalProgress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* New Category / Goal Modal */}
      {isAddingNew && (
        <div className="p-5 sm:p-6 rounded-2xl bg-[#FFFDF9] border-2 border-[#292524] shadow-[4px_4px_0px_#292524] animate-in fade-in duration-150 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8DFD1] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#FAF5ED] border border-[#F3E5D3] text-[#C68B59] flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-[#292524]">
                Criar Nova Meta / Categoria de Gasto
              </h3>
            </div>
            <button
              onClick={() => setIsAddingNew(false)}
              className="p-1 rounded-lg text-[#78716C] hover:text-[#292524] hover:bg-[#F2EBE1] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateNewCategory} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-mono text-[#78716C] mb-1 font-bold">
                  Nome / Título da Meta:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Viagem de Férias, Pet Shop, Cerveja com Amigos..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-2 text-xs sm:text-sm font-mono text-[#292524] focus:outline-none focus:border-[#292524]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#78716C] mb-1 font-bold">
                  Valor Limite / Meta Mensal (R$):
                </label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  required
                  placeholder="Ex: 500"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-2 text-xs sm:text-sm font-mono text-[#292524] focus:outline-none focus:border-[#292524]"
                />
              </div>
            </div>

            {/* Select Icon */}
            <div>
              <label className="block text-xs font-mono text-[#78716C] mb-1.5 font-bold">
                Ícone:
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_ICONS.map((ico) => {
                  const isSelected = newIcon === ico.id;
                  return (
                    <button
                      type="button"
                      key={ico.id}
                      onClick={() => setNewIcon(ico.id)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition ${
                        isSelected
                          ? 'bg-[#292524] text-[#FAF7F2] border-[#292524]'
                          : 'bg-[#FAF7F2] text-[#57534E] border-[#E8DFD1] hover:border-[#292524]'
                      }`}
                    >
                      <CategoryIcon categoryId={ico.id} iconName={ico.id} className="w-3.5 h-3.5" />
                      <span>{ico.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Select Color */}
            <div>
              <label className="block text-xs font-mono text-[#78716C] mb-1.5 font-bold">
                Cor do Card:
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {AVAILABLE_COLORS.map((c, idx) => (
                  <button
                    type="button"
                    key={c.color}
                    onClick={() => setNewColorIdx(idx)}
                    className={`w-7 h-7 rounded-lg border-2 transition flex items-center justify-center ${
                      newColorIdx === idx ? 'border-[#292524] scale-110 shadow-xs' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.label}
                  >
                    {newColorIdx === idx && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit / Cancel */}
            <div className="flex justify-end items-center gap-2 pt-2 border-t border-[#E8DFD1]">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-3 py-1.5 rounded-xl border border-[#E8DFD1] text-xs font-mono text-[#78716C] hover:text-[#292524] hover:bg-[#F2EBE1] transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] text-xs font-mono font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Salvar Meta</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Budget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {expenseCategories.map((cat) => {
          const spent = spendingByCategory[cat.id] || 0;
          const budget = cat.monthlyBudget || 0;
          const percent = budget > 0 ? (spent / budget) * 100 : 0;
          const remaining = budget - spent;
          const isOver = spent > budget && budget > 0;
          const isNear = percent >= 80 && !isOver;
          const isEditing = editingId === cat.id;

          return (
            <div
              key={cat.id}
              className="p-4 sm:p-5 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] flex flex-col justify-between transition"
            >
              {isEditing ? (
                /* INLINE EDIT MODE: Title, Value, Icon, Color & Save */
                <div className="space-y-3.5 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E8DFD1]">
                    <span className="text-xs font-mono font-bold text-[#C68B59] uppercase tracking-wider">
                      Editando Meta
                    </span>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 rounded text-[#78716C] hover:text-[#292524]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-mono text-[#78716C] mb-1 font-bold">
                        Título:
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-lg bg-[#FAF7F2] border border-[#292524] px-2.5 py-1 text-xs font-mono text-[#292524] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-[#78716C] mb-1 font-bold">
                        Valor da Meta (R$):
                      </label>
                      <input
                        type="number"
                        step="20"
                        min="0"
                        value={editBudget}
                        onChange={(e) => setEditBudget(e.target.value)}
                        className="w-full rounded-lg bg-[#FAF7F2] border border-[#292524] px-2.5 py-1 text-xs font-mono text-[#292524] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Icon options in edit mode */}
                  <div>
                    <label className="block text-[11px] font-mono text-[#78716C] mb-1 font-bold">
                      Ícone:
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {AVAILABLE_ICONS.map((ico) => (
                        <button
                          type="button"
                          key={ico.id}
                          onClick={() => setEditIcon(ico.id)}
                          className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                            editIcon === ico.id
                              ? 'bg-[#292524] text-[#FAF7F2] border-[#292524]'
                              : 'bg-[#FAF7F2] text-[#57534E] border-[#E8DFD1]'
                          }`}
                          title={ico.label}
                        >
                          <CategoryIcon categoryId={ico.id} iconName={ico.id} className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color options in edit mode */}
                  <div>
                    <label className="block text-[11px] font-mono text-[#78716C] mb-1 font-bold">
                      Cor:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {AVAILABLE_COLORS.map((c, idx) => (
                        <button
                          type="button"
                          key={c.color}
                          onClick={() => setEditColorIdx(idx)}
                          className={`w-5 h-5 rounded-md border transition ${
                            editColorIdx === idx ? 'border-[#292524] scale-110 shadow-xs' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#E8DFD1]">
                    <button
                      type="button"
                      onClick={() => setCatToDelete(cat)}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono text-[#C85A5A] hover:bg-[#FAF0F0] border border-[#E8C4C4] transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Excluir</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono text-[#78716C] hover:bg-[#F2EBE1]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat)}
                        className="px-3 py-1 rounded-lg bg-[#292524] text-[#FAF7F2] hover:bg-[#44403C] text-xs font-mono font-bold transition flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Salvar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* NORMAL DISPLAY MODE */
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-black/5"
                        style={{ backgroundColor: cat.bgColor, color: cat.color }}
                      >
                        <CategoryIcon categoryId={cat.id} iconName={cat.icon} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-[#292524] truncate">{cat.name}</h4>
                        <p className="text-[11px] text-[#78716C] font-mono">
                          Gasto no mês: <strong className="text-[#292524]">{formatCurrencyBRL(spent)}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-[#A8A29E] font-mono uppercase tracking-wider block">
                          Meta
                        </span>
                        <span className="text-xs font-bold font-mono text-[#292524]">
                          {formatCurrencyBRL(budget)}
                        </span>
                      </div>

                      {/* Edit Button */}
                      <button
                        onClick={() => handleStartEdit(cat)}
                        title="Personalizar título, valor, cor ou excluir"
                        className="p-1.5 rounded-lg text-[#78716C] hover:text-[#292524] hover:bg-[#F2EBE1] transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => setCatToDelete(cat)}
                        title="Excluir este card de meta"
                        className="p-1.5 rounded-lg text-[#A8A29E] hover:text-[#C85A5A] hover:bg-[#FAF0F0] transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar & Calculation */}
                  <div className="mt-3.5">
                    <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                      <span className="text-[#78716C]">
                        {isOver ? (
                          <span className="text-[#C85A5A] flex items-center gap-1 font-bold">
                            <AlertTriangle className="w-3 h-3" /> Excedeu {formatCurrencyBRL(Math.abs(remaining))}
                          </span>
                        ) : (
                          <span>Resta {formatCurrencyBRL(remaining)}</span>
                        )}
                      </span>
                      <span
                        className={`font-bold ${
                          isOver ? 'text-[#C85A5A]' : isNear ? 'text-[#C68B59]' : 'text-[#57534E]'
                        }`}
                      >
                        {Math.round(percent)}%
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-[#F2EBE1] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOver
                            ? 'bg-[#C85A5A]'
                            : isNear
                            ? 'bg-[#C68B59]'
                            : 'bg-[#4A7C59]'
                        }`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state if user removed all expense cards */}
        {expenseCategories.length === 0 && (
          <div className="col-span-full p-8 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] text-center space-y-3">
            <Target className="w-8 h-8 text-[#78716C] mx-auto opacity-50" />
            <h4 className="font-bold text-sm text-[#292524]">Nenhuma meta configurada</h4>
            <p className="text-xs text-[#78716C] max-w-sm mx-auto">
              Você pode adicionar suas próprias metas personalizadas ou restaurar as categorias padrão.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => setIsAddingNew(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#292524] text-[#FAF7F2] text-xs font-mono font-bold transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar Meta</span>
              </button>
              {onResetDefaultCategories && (
                <button
                  onClick={onResetDefaultCategories}
                  className="px-3.5 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F2EBE1] border border-[#E8DFD1] text-xs font-mono text-[#57534E] font-bold transition"
                >
                  Restaurar Padrões
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal for deleting category */}
      <ConfirmationModal
        isOpen={Boolean(catToDelete)}
        title="Excluir Meta / Categoria"
        message={`Deseja realmente excluir a meta "${catToDelete?.name}"? Esta ação removerá o card e seu orçamento correspondente.`}
        confirmLabel="Sim, excluir meta"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={() => {
          if (catToDelete && onDeleteCategory) {
            onDeleteCategory(catToDelete.id);
          }
          setCatToDelete(null);
        }}
        onCancel={() => setCatToDelete(null)}
      />
    </div>
  );
};
