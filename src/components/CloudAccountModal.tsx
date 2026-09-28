import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { signInWithGoogle, signOutUser } from '../firebase';
import { LogIn, LogOut, CheckCircle2, Cloud, Smartphone, Monitor, Shield, X, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  accountsCount: number;
  transactionsCount: number;
}

export const CloudAccountModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  accountsCount,
  transactionsCount,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const isGoogleUser = !!(currentUser && !currentUser.isAnonymous && currentUser.email);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Falha ao conectar com o Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await signOutUser();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao desconectar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8DFD1] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#386641] text-[#FAF7F2] flex items-center justify-center">
              <Cloud className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#292524]">
                Sincronização em Nuvem (PC & Celular)
              </h3>
              <p className="text-[11px] font-mono text-[#78716C]">
                Mantenha suas contas e transações idênticas em todos os dispositivos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#78716C] hover:text-[#292524] hover:bg-[#E5DDD0] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FAF0F0] border border-[#E8C0C0] text-[#C85A5A] text-xs font-mono font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isGoogleUser ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#EDF5EF] border border-[#CDDACF] flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#386641] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'G'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#292524] truncate">
                      {currentUser.displayName || 'Conta Google Conectada'}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#386641] text-white font-bold">
                      Ativo
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[#57534E] truncate mt-0.5">
                    {currentUser.email}
                  </p>
                  <p className="text-[11px] text-[#386641] mt-1 font-bold">
                    ✓ Sincronização em tempo real ativada com o banco de dados.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] text-xs text-[#57534E] space-y-1.5">
                <p className="font-bold font-mono text-[#292524]">
                  Base sincronizada:
                </p>
                <div className="flex items-center justify-between text-xs font-mono text-[#78716C]">
                  <span>Contas Bancárias:</span>
                  <span className="font-bold text-[#292524]">{accountsCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-[#78716C]">
                  <span>Total de Lançamentos:</span>
                  <span className="font-bold text-[#292524]">{transactionsCount}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#FAF0F0] hover:bg-[#FCE8E8] text-[#C85A5A] text-xs font-mono font-bold transition flex items-center justify-center gap-2 border border-[#E8C0C0]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Desconectar desta Conta Google</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#FAF5ED] border border-[#F3E5D3] text-[#C68B59]">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-[#292524]">
                      Acesse a mesma base no Computador e no Celular
                    </h4>
                    <p className="text-[11px] text-[#78716C] mt-0.5">
                      Ao entrar com sua Conta Google no celular e no computador, todas as contas, lançamentos e orçamentos ficam automaticamente sincronizados entre os dois.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E8DFD1] flex items-center justify-between text-[11px] font-mono text-[#78716C]">
                  <span>Dados atuais locais:</span>
                  <span className="font-bold text-[#292524]">
                    {accountsCount} contas &bull; {transactionsCount} transações
                  </span>
                </div>
              </div>

              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] text-xs font-mono font-bold transition flex items-center justify-center gap-2.5 shadow-[2px_2px_0px_#C68B59] active:translate-y-0.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isLoading ? 'Conectando...' : 'Entrar com Conta Google'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
