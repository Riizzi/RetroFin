import React from 'react';
import { Transaction, Category } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { BankBadge } from './BankBadge';
import { formatCurrencyBRL, formatDateBR, formatTransactionTime } from '../utils/formatters';
import { Sparkles, Trash2 } from 'lucide-react';

interface Props {
  transaction: Transaction;
  category?: Category;
  onClick: (t: Transaction) => void;
  onQuickDelete?: (id: string, description: string, amount: number) => void;
}

export const TransactionItem: React.FC<Props> = ({
  transaction,
  category,
  onClick,
  onQuickDelete,
}) => {
  const isCredit = transaction.type === 'credit';
  const catColor = category?.color || '#78716C';
  const catBg = category?.bgColor || '#F5F5F4';
  const catName = category?.name || 'Diversos';

  const channelLabels: Record<string, string> = {
    PIX: 'Pix',
    CARTAO_CREDITO: 'Crédito',
    CARTAO_DEBITO: 'Débito',
    BOLETO: 'Boleto',
    TED: 'TED',
    INVESTIMENTO: 'Invest',
    DINHEIRO: 'Espécie',
    OUTRO: 'Outro',
  };

  const channelText = channelLabels[transaction.channel] || 'Outro';
  const txTime = formatTransactionTime(transaction);

  return (
    <div
      onClick={() => onClick(transaction)}
      className="group relative flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#FFFDF9] hover:bg-[#FAF5ED] border border-[#E8DFD1] hover:border-[#D5CBBC] shadow-[1px_1px_0px_#E5DCD0] sm:shadow-[2px_2px_0px_#E5DCD0] transition cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
    >
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        {/* Category Icon Stamp */}
        <div
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border border-black/5"
          style={{ backgroundColor: catBg, color: catColor }}
        >
          <CategoryIcon categoryId={transaction.category} iconName={category?.icon} className="w-4 h-4" />
        </div>

        {/* Transaction Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-xs sm:text-sm text-[#292524] truncate group-hover:text-[#C85A5A] transition">
              {transaction.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-0.5 text-xs">
            <span className="text-[#78716C] text-[10px] sm:text-[11px] font-mono">
              {formatDateBR(transaction.date)}
              {txTime && <span className="text-[#A8A29E] font-medium ml-1">{txTime}</span>}
            </span>
            <span className="text-[#D5CBBC]">•</span>
            <span className="text-[#57534E] text-[10px] sm:text-[11px] font-medium truncate max-w-[120px] sm:max-w-none">
              {transaction.subcategory || catName}
            </span>
            <span className="text-[#D5CBBC] hidden sm:inline">•</span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#F2EBE1] text-[#78716C] border border-[#E5DDD0]">
              {channelText}
            </span>

            {/* Bank Badge */}
            <BankBadge
              bank={transaction.bankInstitution || transaction.bank}
              customName={transaction.accountName || transaction.account}
              size="sm"
            />

            {/* AI badge if categorized by AI */}
            {transaction.isCategorizedByAI && (
              <span
                title={transaction.aiReason || 'Classificado por IA'}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#FAF5ED] text-[#C68B59] border border-[#F3E5D3]"
              >
                <Sparkles className="w-2.5 h-2.5 text-[#C68B59]" />
                <span>IA</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Amount Display & Quick Action */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 pl-2">
        <div className="text-right">
          <div
            className={`font-bold font-mono text-xs sm:text-base flex items-center justify-end gap-0.5 ${
              isCredit ? 'text-[#386641]' : 'text-[#C85A5A]'
            }`}
          >
            {isCredit ? '+' : '-'} {formatCurrencyBRL(Math.abs(transaction.amount))}
          </div>
          <span className="text-[9px] sm:text-[10px] font-mono text-[#A8A29E] uppercase tracking-wider block">
            {transaction.status}
          </span>
        </div>

        {/* Quick Delete Trash Button */}
        {onQuickDelete && (
          <button
            type="button"
            title="Excluir este lançamento"
            onClick={(e) => {
              e.stopPropagation();
              onQuickDelete(transaction.id, transaction.description, transaction.amount);
            }}
            className="p-1 sm:p-2 rounded-lg text-[#A8A29E] hover:text-[#C85A5A] hover:bg-[#FAF0F0] opacity-80 sm:opacity-0 group-hover:opacity-100 transition active:scale-90"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
