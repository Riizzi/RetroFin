import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, X, Check, Banknote, Share2 } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = () => {
    if (isInstallable) {
      install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        title="Instalar aplicativo no celular (Android / iOS)"
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-mono font-bold text-[#FAF7F2] bg-[#292524] hover:bg-[#44403C] rounded-xl shadow-xs transition active:scale-95 shrink-0"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#DDA15E]" />
        <span className="hidden sm:inline">Instalar App</span>
        <span className="inline sm:hidden text-[11px]">Instalar</span>
      </button>

      {/* Guided Modal for Android or iOS */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292524]/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] p-5 sm:p-6 shadow-2xl text-[#292524]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DFD1]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#66696E] flex items-center justify-center text-[#0D0E10] font-bold shadow-xs border border-[#525559]">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Como baixar no Celular</h3>
                  <span className="text-[10px] font-mono text-[#78716C]">
                    {isIOS ? 'Apple iOS (Safari)' : 'Android (Google Chrome)'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-lg text-[#78716C] hover:text-[#292524] hover:bg-[#F2EBE1] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              /* iOS Safari instructions */
              <div className="mt-4 space-y-3 text-xs text-[#57534E]">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    No <strong>Safari</strong> do iPhone, toque no botão <strong>Compartilhar</strong> (ícone com quadrado e seta na barra inferior).
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    Role o menu para baixo e selecione <strong>Adicionar à Tela de Início</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold shrink-0 mt-0.5">
                    3
                  </span>
                  <p>
                    Toque em <strong>Adicionar</strong> para fixar o ícone cinza escuro na sua tela inicial.
                  </p>
                </div>
              </div>
            ) : (
              /* Android Chrome instructions */
              <div className="mt-4 space-y-3 text-xs text-[#57534E]">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    Abra o menu de <strong>três pontinhos (⋮)</strong> no canto superior direito do Google Chrome.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-[#292524]">
                      Se aparecer "Não é possível instalar":
                    </p>
                    <p className="mt-0.5 text-[#78716C] leading-relaxed">
                      Toque na opção de baixo: <strong>"Criar atalho"</strong>. O atalho é criado instantaneamente com o ícone cinza escuro e abre em tela cheia!
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-xl bg-[#292524] hover:bg-[#44403C] py-2.5 px-3 text-xs font-mono font-bold text-[#FAF7F2] transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Entendi</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
