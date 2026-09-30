import React, { useState } from 'react';
import { Transaction, Category, PaymentChannel, TransactionType, BankAccount } from '../types';
import { X, Plus, Sparkles, Landmark } from 'lucide-react';
import { classifyTransactionLocally } from '../utils/ofxParser';
import { categorizeTransactionsWithAI } from '../services/categorizer';

interface Props {
  isOpen: boolean;
  categories: Category[];
  accounts: BankAccount[];
  allTransactions?: Transaction[];
  onClose: () => void;
  onAdd: (t: Transaction) => void;
  onOpenNewAccountModal?: () => void;
}

export const NewTransactionModal: React.FC<Props> = ({
  isOpen,
  categories,
  accounts,
  allTransactions = [],
  onClose,
  onAdd,
  onOpenNewAccountModal,
}) => {
  if (!isOpen) return null;

  const [type, setType] = useState<TransactionType>('debit');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || 'acc-nubank'
  );
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState(categories[0]?.id || 'alimentacao');
  const [subcategory, setSubcategory] = useState('');
  const [channel, setChannel] = useState<PaymentChannel>('PIX');
  const [isCategorizingByAI, setIsCategorizingByAI] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    if (text.length > 2) {
      const auto = classifyTransactionLocally(text, type, selectedAccount?.purpose);
      if (auto.category) {
        setCategory(auto.category);
        setSubcategory(auto.subcategory);
        setChannel(auto.channel);
      }
    }
  };

  const handleAICategorize = async () => {
    if (!description.trim()) return;
    setIsCategorizingByAI(true);
    try {
      const parsedAmount = parseFloat(amountStr.replace(',', '.')) || 0;
      const finalAmount = type === 'debit' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

      const tempTx: Transaction = {
        id: 'temp-manual',
        date,
        description: description.trim(),
        amount: finalAmount,
        type,
        category: 'outros',
        channel,
        accountId: selectedAccountId,
        accountName: selectedAccount?.name || '',
        bankInstitution: selectedAccount?.institution || undefined,
        isCategorizedByAI: false,
        status: 'liquidado',
      };

      // Get high-quality manual classifications from the existing list
      const manualExamples = allTransactions.filter(
        (t) => t.category && t.category !== 'outros' && !t.isCategorizedByAI
      );

      const result = await categorizeTransactionsWithAI([tempTx], accounts, manualExamples);
      if (result.updated && result.updated.length > 0) {
        const classified = result.updated[0];
        setCategory(classified.category);
        if (classified.subcategory) {
          setSubcategory(classified.subcategory);
        }
      }
    } catch (err) {
      console.warn('AI categorization failed:', err);
    } finally {
      setIsCategorizingByAI(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }
    if (!description.trim()) {
      alert('Informe a descrição da movimentação.');
      return;
    }

    const finalAmount = type === 'debit' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

    const accName = selectedAccount?.name || 'Conta Padrão';
    const accInstitution = selectedAccount?.institution || 'OUTRO';

    const now = new Date();
    const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const newTx: Transaction = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date,
      time: currentTime,
      createdAt: now.toISOString(),
      description: description.trim(),
      amount: finalAmount,
      type,
      category,
      subcategory: subcategory.trim() || undefined,
      channel,
      accountId: selectedAccount?.id || selectedAccountId,
      accountName: accName,
      bankInstitution: accInstitution,
      bank: accInstitution,
      account: accName,
      accountPurpose: selectedAccount?.purpose,
      isCategorizedByAI: false,
      status: 'liquidado',
    };

    onAdd(newTx);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#292524]/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E8DFD1] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#292524] text-[#FAF7F2] flex items-center justify-center font-bold text-sm">
              +
            </div>
            <div>
              <h3 className="font-bold text-base text-[#292524]">Novo Lançamento</h3>
              <p className="text-xs text-[#78716C]">Adicione uma receita ou despesa manual</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#78716C] hover:text-[#292524] hover:bg-[#F2EBE1] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Type Toggle: Despesa vs Receita */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#F2EBE1] border border-[#E5DDD0]">
            <button
              type="button"
              onClick={() => {
                setType('debit');
                setCategory('alimentacao');
              }}
              className={`py-1.5 text-xs font-mono font-bold rounded-lg transition ${
                type === 'debit'
                  ? 'bg-[#FFFDF9] text-[#C85A5A] shadow-sm'
                  : 'text-[#78716C] hover:text-[#292524]'
              }`}
            >
              💸 Despesa (Saída)
            </button>
            <button
              type="button"
              onClick={() => {
                setType('credit');
                setCategory('receitas');
              }}
              className={`py-1.5 text-xs font-mono font-bold rounded-lg transition ${
                type === 'credit'
                  ? 'bg-[#FFFDF9] text-[#386641] shadow-sm'
                  : 'text-[#78716C] hover:text-[#292524]'
              }`}
            >
              💰 Receita (Entrada)
            </button>
          </div>

          {/* Account Choice */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono font-bold text-[#57534E]">
                Conta Bancária
              </label>
              {onOpenNewAccountModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNewAccountModal();
                  }}
                  className="text-[11px] font-mono font-bold text-[#C68B59] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Cadastrar Nova
                </button>
              )}
            </div>

            {accounts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {accounts.map((acc) => {
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setSelectedAccountId(acc.id)}
                      className={`p-2.5 rounded-xl text-left border transition flex items-center gap-2 ${
                        isSelected
                          ? 'border-[#292524] bg-[#F2EBE1] shadow-xs'
                          : 'border-[#E8DFD1] bg-[#FAF7F2] text-[#78716C] hover:text-[#292524]'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: acc.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono font-bold text-[#292524] truncate">
                          {acc.name}
                        </p>
                        <p className="text-[10px] text-[#78716C] truncate">
                          {acc.purpose || acc.institutionName}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#FAF5ED] border border-[#F3E5D3] text-xs text-[#78716C] flex items-center justify-between">
                <span>Nenhuma conta cadastrada ainda.</span>
                {onOpenNewAccountModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenNewAccountModal();
                    }}
                    className="px-2 py-1 bg-[#292524] text-[#FAF7F2] font-mono text-[10px] font-bold rounded-lg"
                  >
                    + Criar Conta
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-mono font-bold text-[#57534E] mb-1">
              Valor (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-[#78716C]">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] pl-11 pr-4 py-2.5 text-lg font-mono font-extrabold text-[#292524] focus:outline-none focus:border-[#292524]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono font-bold text-[#57534E] mb-1 flex items-center justify-between">
              <span>Descrição</span>
              <span className="text-[10px] text-[#C68B59] font-normal flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Auto-categorização com contexto
              </span>
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Ex: Mercado Carrefour, Conta Enel, Salário..."
              className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3.5 py-2 text-xs sm:text-sm text-[#292524] focus:outline-none focus:border-[#292524] placeholder:text-[#A8A29E]"
            />
            {description.trim().length > 2 && (
              <button
                type="button"
                onClick={handleAICategorize}
                disabled={isCategorizingByAI}
                className="mt-1.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#FAF5ED] hover:bg-[#F3E5D3] border border-[#F3E5D3] text-[11px] font-mono font-bold text-[#C68B59] transition disabled:opacity-60 cursor-pointer active:scale-95"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isCategorizingByAI ? 'animate-spin' : ''}`} />
                <span>{isCategorizingByAI ? 'IA analisando seus hábitos...' : 'Auto-Categorizar com IA'}</span>
              </button>
            )}
          </div>

          {/* Date & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono font-bold text-[#57534E] mb-1">
                Data
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-2 text-xs text-[#292524] focus:outline-none focus:border-[#292524]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono font-bold text-[#57534E] mb-1">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-2 text-xs text-[#292524] focus:outline-none focus:border-[#292524]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subcategory */}
          <div>
            <label className="block text-xs font-mono font-bold text-[#57534E] mb-1">
              Subcategoria / Detalhe
            </label>
            <input
              type="text"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="Ex: Supermercado (Casa), Lazer, Combustível..."
              className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3.5 py-2 text-xs text-[#292524] focus:outline-none focus:border-[#292524]"
            />
          </div>

          {/* Payment Channel */}
          <div>
            <label className="block text-xs font-mono font-bold text-[#57534E] mb-1">
              Canal de Pagamento
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as PaymentChannel)}
              className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-2 text-xs text-[#292524] focus:outline-none focus:border-[#292524]"
            >
              <option value="PIX">Pix</option>
              <option value="CARTAO_CREDITO">Cartão de Crédito</option>
              <option value="CARTAO_DEBITO">Cartão de Débito</option>
              <option value="BOLETO">Boleto / Débito Automático</option>
              <option value="TED">TED / Transferência</option>
              <option value="INVESTIMENTO">Investimento / Caixinha</option>
              <option value="DINHEIRO">Dinheiro em Espécie</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="pt-2 border-t border-[#E8DFD1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-mono text-[#78716C] hover:text-[#292524] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] text-xs font-mono font-bold transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Salvar Lançamento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
