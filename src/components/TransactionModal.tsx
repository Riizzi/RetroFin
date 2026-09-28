import React, { useState, useEffect } from 'react';
import { Transaction, Category, PaymentChannel, BankAccount } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { BankBadge } from './BankBadge';
import { formatCurrencyBRL, formatDateBR } from '../utils/formatters';
import { X, Sparkles, Trash2, Check, FileText } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

interface Props {
  transaction: Transaction | null;
  categories: Category[];
  accounts: BankAccount[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Transaction) => void;
  onDelete: (id: string) => void;
}

export const TransactionModal: React.FC<Props> = ({
  transaction,
  categories,
  accounts,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !transaction) return null;

  const [category, setCategory] = useState(transaction.category);
  const [subcategory, setSubcategory] = useState(transaction.subcategory || '');
  const [channel, setChannel] = useState<PaymentChannel>(transaction.channel);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    transaction.accountId ||
      accounts.find(
        (a) =>
          a.name === transaction.accountName ||
          a.institution === (transaction.bankInstitution || transaction.bank)
      )?.id ||
      ''
  );
  const [notes, setNotes] = useState(transaction.notes || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync internal state when transaction prop changes
  useEffect(() => {
    if (transaction) {
      setCategory(transaction.category);
      setSubcategory(transaction.subcategory || '');
      setChannel(transaction.channel);
      setSelectedAccountId(
        transaction.accountId ||
          accounts.find(
            (a) =>
              a.name === transaction.accountName ||
              a.institution === (transaction.bankInstitution || transaction.bank)
          )?.id ||
          ''
      );
      setNotes(transaction.notes || '');
      setShowDeleteConfirm(false);
    }
  }, [transaction, accounts]);

  const activeAccount = accounts.find((a) => a.id === selectedAccountId);

  const handleSave = () => {
    const accName =
      activeAccount?.name || transaction.accountName || transaction.account || 'Conta Padrão';
    const accInst =
      activeAccount?.institution || transaction.bankInstitution || transaction.bank || 'OUTRO';

    onSave({
      ...transaction,
      category,
      subcategory: subcategory.trim() || undefined,
      channel,
      accountId: activeAccount?.id || transaction.accountId,
      accountName: accName,
      bankInstitution: accInst,
      bank: accInst,
      account: accName,
      accountPurpose: activeAccount?.purpose || transaction.accountPurpose,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const handleConfirmDelete = () => {
    onDelete(transaction.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const isCredit = transaction.type === 'credit';
  const currentCat = categories.find((c) => c.id === category);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#292524]/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
        <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[#E8DFD1] flex items-center justify-between bg-[#FAF7F2]">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border border-black/5"
                style={{
                  backgroundColor: currentCat?.bgColor || '#F5F5F4',
                  color: currentCat?.color || '#78716C',
                }}
              >
                <CategoryIcon categoryId={category} className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-[#292524]">Detalhes do Lançamento</h3>
                  <BankBadge
                    bank={activeAccount?.institution || transaction.bankInstitution || transaction.bank}
                    customName={activeAccount?.name || transaction.accountName}
                    size="sm"
                  />
                </div>
                <p className="text-xs text-[#78716C] font-mono">ID: {transaction.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#78716C] hover:text-[#292524] hover:bg-[#F2EBE1] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content body */}
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Amount Card */}
            <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] text-center">
              <span className="text-[11px] uppercase font-mono font-bold tracking-wider text-[#78716C]">
                Valor {isCredit ? 'Recebido' : 'Gasto'}
              </span>
              <div
                className={`text-2xl sm:text-3xl font-extrabold font-mono mt-0.5 ${
                  isCredit ? 'text-[#386641]' : 'text-[#C85A5A]'
                }`}
              >
                {isCredit ? '+' : '-'} {formatCurrencyBRL(Math.abs(transaction.amount))}
              </div>
              <p className="text-xs text-[#292524] mt-1 font-bold">{transaction.description}</p>
              <p className="text-[11px] text-[#78716C] font-mono mt-0.5">
                {formatDateBR(transaction.date)} • {activeAccount?.name || transaction.accountName || transaction.account}
              </p>
            </div>

            {/* AI Categorization banner if present */}
            {transaction.isCategorizedByAI && (
              <div className="p-3.5 rounded-xl bg-[#FAF5ED] border border-[#F3E5D3] flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-[#C68B59] shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold font-mono text-[#C68B59]">
                    Categorização Automática por IA
                    {transaction.aiConfidence ? ` (${Math.round(transaction.aiConfidence * 100)}%)` : ''}
                  </span>
                  <p className="text-[#57534E] mt-0.5 leading-relaxed">
                    {transaction.aiReason || 'Identificado a partir do histórico de transações e da conta vinculada.'}
                  </p>
                </div>
              </div>
            )}

            {/* Conta / Banco */}
            <div>
              <label className="block text-xs font-mono font-bold text-[#57534E] mb-1.5">
                Conta Vinculada
              </label>
              {accounts.length > 0 ? (
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3.5 py-2 text-xs sm:text-sm text-[#292524] focus:outline-none focus:border-[#292524] font-bold"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.institutionName} - {a.purpose})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-[#78716C]">
                  {transaction.accountName || transaction.account || 'Conta Padrão'}
                </p>
              )}
            </div>

            {/* Category Select */}
            <div>
              <label className="block text-xs font-mono font-bold text-[#57534E] mb-1.5">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3.5 py-2 text-xs sm:text-sm text-[#292524] focus:outline-none focus:border-[#292524]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategory */}
            <div>
              <label className="block text-xs font-mono font-bold text-[#57534E] mb-1.5">
                Subcategoria / Detalhe
              </label>
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="Ex: Supermercado (Casa), iFood, Combustível..."
                className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3.5 py-2 text-xs sm:text-sm text-[#292524] focus:outline-none focus:border-[#292524] placeholder:text-[#A8A29E]"
              />
            </div>

            {/* Channel */}
            <div>
              <label className="block text-xs font-mono font-bold text-[#57534E] mb-1.5">
                Canal de Pagamento
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as PaymentChannel)}
                className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3.5 py-2 text-xs sm:text-sm text-[#292524] focus:outline-none focus:border-[#292524]"
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

            {/* Notes */}
            <div>
              <label className="block text-xs font-mono font-bold text-[#57534E] mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#78716C]" />
                <span>Anotações Pessoais</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Lembrete ou anotação..."
                className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] p-2.5 text-xs sm:text-sm text-[#292524] focus:outline-none focus:border-[#292524] placeholder:text-[#A8A29E] resize-none"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="p-4 border-t border-[#E8DFD1] bg-[#FAF7F2] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold text-[#C85A5A] hover:bg-[#FAF0F0] rounded-xl transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-mono text-[#78716C] hover:text-[#292524] transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold text-[#FAF7F2] bg-[#292524] hover:bg-[#44403C] rounded-xl shadow-sm transition active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* In-app custom confirmation for deleting the transaction */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Excluir Lançamento"
        message={`Tem certeza que deseja apagar o lançamento "${transaction.description}" de ${formatCurrencyBRL(Math.abs(transaction.amount))}? Essa ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir"
        cancelLabel="Voltar"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};
