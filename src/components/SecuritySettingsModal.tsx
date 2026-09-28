import React, { useState, useEffect } from 'react';
import {
  SecurityConfig,
  hashPassword,
  saveSecurityConfig,
  registerBiometrics,
  isBiometricsSupported,
} from '../utils/security';
import {
  Shield,
  Fingerprint,
  KeyRound,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  X,
  Smartphone,
  Sparkles,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: SecurityConfig;
  onConfigUpdated: (newConfig: SecurityConfig) => void;
}

export const SecuritySettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  config,
  onConfigUpdated,
}) => {
  const [pinEnabled, setPinEnabled] = useState(config.pinEnabled);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPinVerify, setCurrentPinVerify] = useState('');
  const [biometricsEnabled, setBiometricsEnabled] = useState(config.biometricsEnabled);
  const [autoLockMinutes, setAutoLockMinutes] = useState(config.autoLockMinutes);

  const [hasBiometricsHardware, setHasBiometricsHardware] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [isRegisteringBio, setIsRegisteringBio] = useState(false);

  useEffect(() => {
    isBiometricsSupported().then(setHasBiometricsHardware);
    setPinEnabled(config.pinEnabled);
    setBiometricsEnabled(config.biometricsEnabled);
    setAutoLockMinutes(config.autoLockMinutes);
    setNewPin('');
    setConfirmPin('');
    setCurrentPinVerify('');
    setStatusMsg(null);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    // If disabling PIN
    if (!pinEnabled && config.pinEnabled) {
      if (!currentPinVerify.trim()) {
        setStatusMsg({ type: 'error', text: 'Digite sua senha/PIN atual para confirmar a desativação.' });
        return;
      }
      const hashedCurrent = await hashPassword(currentPinVerify);
      if (hashedCurrent !== config.pinHash) {
        setStatusMsg({ type: 'error', text: 'Senha atual incorreta.' });
        return;
      }

      const updated: SecurityConfig = {
        pinEnabled: false,
        pinHash: '',
        biometricsEnabled: false,
        biometricCredentialId: undefined,
        autoLockMinutes: 0,
      };
      saveSecurityConfig(updated);
      onConfigUpdated(updated);
      setStatusMsg({ type: 'success', text: 'Proteção por senha e biometria desativada com sucesso.' });
      setTimeout(onClose, 800);
      return;
    }

    // If enabling or changing PIN
    if (pinEnabled) {
      let finalPinHash = config.pinHash;

      // If user wants to set a new PIN
      if (newPin.trim()) {
        if (newPin.length < 4) {
          setStatusMsg({ type: 'error', text: 'O PIN ou senha deve ter pelo menos 4 dígitos/caracteres.' });
          return;
        }
        if (newPin !== confirmPin) {
          setStatusMsg({ type: 'error', text: 'A confirmação do PIN não confere.' });
          return;
        }

        // If replacing existing PIN, verify current PIN
        if (config.pinEnabled) {
          if (!currentPinVerify.trim()) {
            setStatusMsg({ type: 'error', text: 'Digite sua senha/PIN atual para alterar.' });
            return;
          }
          const hashedCurrent = await hashPassword(currentPinVerify);
          if (hashedCurrent !== config.pinHash) {
            setStatusMsg({ type: 'error', text: 'Senha atual incorreta.' });
            return;
          }
        }

        finalPinHash = await hashPassword(newPin);
      } else if (!config.pinEnabled) {
        setStatusMsg({ type: 'error', text: 'Defina uma senha ou PIN para ativar o bloqueio.' });
        return;
      }

      let credentialId = config.biometricCredentialId;
      // If user toggled biometrics ON and hardware supported
      if (biometricsEnabled && (!config.biometricsEnabled || !credentialId)) {
        setIsRegisteringBio(true);
        try {
          const registeredId = await registerBiometrics();
          if (registeredId) {
            credentialId = registeredId;
          }
        } catch (err: any) {
          setIsRegisteringBio(false);
          setStatusMsg({
            type: 'error',
            text: err.message || 'Falha ao registrar biometria no celular/computador.',
          });
          return;
        }
        setIsRegisteringBio(false);
      }

      const updated: SecurityConfig = {
        pinEnabled: true,
        pinHash: finalPinHash,
        biometricsEnabled: biometricsEnabled && hasBiometricsHardware,
        biometricCredentialId: biometricsEnabled ? credentialId : undefined,
        autoLockMinutes,
      };

      saveSecurityConfig(updated);
      onConfigUpdated(updated);
      setStatusMsg({ type: 'success', text: 'Configurações de segurança salvas!' });
      setTimeout(onClose, 800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8DFD1] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#292524] text-[#FAF7F2] flex items-center justify-center">
              <Shield className="w-4 h-4 text-[#C68B59]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#292524]">Segurança & Biometria</h3>
              <p className="text-[11px] font-mono text-[#78716C]">
                Bloqueio com Senha/PIN e Impressão Digital ou Face ID
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

        {/* Content Form */}
        <form onSubmit={handleSaveSecurity} className="p-5 space-y-5 overflow-y-auto">
          {statusMsg && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-mono font-bold ${
                statusMsg.type === 'success'
                  ? 'bg-[#EDF5EF] border-[#CDDACF] text-[#386641]'
                  : 'bg-[#FAF0F0] border-[#E8C0C0] text-[#C85A5A]'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Toggle PIN Lock */}
          <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#292524]" />
                <span className="text-xs font-bold text-[#292524]">
                  Exigir Senha / PIN ao abrir o App
                </span>
              </div>
              <input
                type="checkbox"
                checked={pinEnabled}
                onChange={(e) => setPinEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#292524] rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-[#78716C]">
              Protege seus dados bancários, despesas e saldos contra acesso não autorizado.
            </p>
          </div>

          {/* PIN Setup Inputs */}
          {pinEnabled && (
            <div className="space-y-3 pt-1">
              {config.pinEnabled && (
                <div>
                  <label className="text-xs font-mono font-bold text-[#292524] block mb-1">
                    Senha / PIN Atual (para confirmar alteração):
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={currentPinVerify}
                    onChange={(e) => setCurrentPinVerify(e.target.value)}
                    placeholder="Digite seu PIN atual"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] text-xs font-mono text-[#292524] focus:outline-none focus:border-[#292524]"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-mono font-bold text-[#292524] block mb-1">
                  {config.pinEnabled ? 'Nova Senha / PIN (opcional):' : 'Cadastre sua Senha / PIN:'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Ex: 1234 ou sua senha"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] text-xs font-mono text-[#292524] focus:outline-none focus:border-[#292524]"
                />
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-[#292524] block mb-1">
                  Confirme a Senha / PIN:
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] text-xs font-mono text-[#292524] focus:outline-none focus:border-[#292524]"
                />
              </div>
            </div>
          )}

          {/* Toggle Biometrics */}
          <div
            className={`p-4 rounded-xl border space-y-2 transition ${
              pinEnabled
                ? 'bg-[#FAF7F2] border-[#E8DFD1]'
                : 'bg-[#F5F2EB] border-[#E8DFD1] opacity-50 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-[#C68B59]" />
                <span className="text-xs font-bold text-[#292524]">
                  Desbloqueio com Biometria do Celular
                </span>
              </div>
              <input
                type="checkbox"
                disabled={!pinEnabled || !hasBiometricsHardware}
                checked={biometricsEnabled}
                onChange={(e) => setBiometricsEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#C68B59] rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-[#78716C]">
              Use Touch ID, Face ID ou sensor de impressão digital do seu smartphone para entrar instantaneamente.
            </p>
            {!hasBiometricsHardware && (
              <span className="text-[10px] font-mono text-[#D97706] block">
                (Sensor biométrico ou WebAuthn não detectado neste navegador/aparelho)
              </span>
            )}
          </div>

          {/* Auto-Lock Timer Selection */}
          {pinEnabled && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-[#292524] block">
                Bloqueio Automático por Inatividade:
              </label>
              <select
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] text-xs font-mono text-[#292524] focus:outline-none cursor-pointer"
              >
                <option value={0}>Imediatamente ao fechar ou sair do app</option>
                <option value={1}>Após 1 minuto em segundo plano</option>
                <option value={5}>Após 5 minutos em segundo plano</option>
                <option value={15}>Após 15 minutos em segundo plano</option>
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-[#E8DFD1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#E5DDD0] text-xs font-mono font-bold text-[#78716C] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isRegisteringBio}
              className="px-5 py-2 rounded-xl bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] text-xs font-mono font-bold shadow-[2px_2px_0px_#C68B59] active:translate-y-0.5 transition flex items-center gap-1.5"
            >
              {isRegisteringBio ? (
                <>
                  <Fingerprint className="w-3.5 h-3.5 animate-pulse" />
                  <span>Cadastrando Biometria...</span>
                </>
              ) : (
                <span>Salvar Configurações</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
