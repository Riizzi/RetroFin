import React from 'react';
import { AIInsight } from '../types';
import { Sparkles, Lightbulb, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';

interface Props {
  insights: AIInsight[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const AIInsightsCard: React.FC<Props> = ({
  insights,
  isLoading,
  onRefresh,
}) => {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0]">
      <div className="flex items-center justify-between pb-4 border-b border-[#E8DFD1]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#FAF5ED] border border-[#F3E5D3] text-[#C68B59] flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#292524] flex items-center gap-2">
              <span>Observações Financeiras</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF5ED] text-[#C68B59] border border-[#F3E5D3] font-bold">
                IA
              </span>
            </h3>
            <p className="text-xs text-[#78716C]">Resumo com base nas movimentações e contas do mês</p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Recalcular observações"
          className="p-1.5 rounded-lg text-[#78716C] hover:text-[#292524] hover:bg-[#F2EBE1] transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#C85A5A]' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
          <RefreshCw className="w-6 h-6 text-[#C68B59] animate-spin" />
          <p className="text-xs font-mono text-[#78716C]">Analisando lançamentos do mês...</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {insights.map((item, idx) => {
            const icons = {
              positive: <TrendingUp className="w-4 h-4 text-[#386641] shrink-0 mt-0.5" />,
              warning: <AlertTriangle className="w-4 h-4 text-[#C85A5A] shrink-0 mt-0.5" />,
              tip: <Lightbulb className="w-4 h-4 text-[#4A6984] shrink-0 mt-0.5" />,
            };

            const styles = {
              positive: 'bg-[#EDF5EF]/60 border-[#CDDACF]',
              warning: 'bg-[#FAF0F0]/60 border-[#E8C4C4]',
              tip: 'bg-[#EFF4F8]/60 border-[#CAD8E2]',
            };

            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border ${styles[item.type]} flex flex-col justify-between space-y-2`}
              >
                <div>
                  <div className="flex items-start gap-2">
                    {icons[item.type]}
                    <h4 className="font-bold text-xs text-[#292524]">{item.title}</h4>
                  </div>
                  <p className="text-[11px] text-[#57534E] mt-1.5 leading-relaxed">{item.message}</p>
                </div>
                {item.action && (
                  <div className="pt-2 border-t border-black/5 text-[10px] font-mono text-[#78716C] font-semibold">
                    ⚡ {item.action}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
