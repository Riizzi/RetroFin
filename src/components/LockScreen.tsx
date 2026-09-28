import React, { useState, useEffect } from 'react';
import {
  SecurityConfig,
  hashPassword,
  authenticateWithBiometrics,
  recordUnlock,
  isBiometricsSupported,
} from '../utils/security';
import { Lock, Fingerprint, KeyRound, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';

interface Props {
  config: SecurityConfig;
  onUnlocked: () => void;
}

export const LockScreen: React.FC<Props> = ({ config, onUnlocked }) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifyingBiometrics, setIsVerifyingBiometrics] = useState(false);
  const [hasBiometricsHardware, setHasBiometricsHardware] = useState(false);

  useEffect(() => {
    isBiometricsSupported().then((supported) => {
      setHasBiometricsHardware(supported);
      // Auto trigger biometrics prompt on screen load if enabled
      if (supported && config.biometricsEnabled) {
        handleBiometricAuth();
      }
    });
  }, [config.biometricsEnabled]);

  const handleBiometricAuth = async () => {
    setErrorMsg('');
    setIsVerifyingBiometrics(true);
    try {
      const ok = await authenticateWithBiometrics(config.biometricCredentialId);
      if (ok) {
        recordUnlock();
        onUnlocked();
      } else {
        setErrorMsg('Autenticação biométrica falhou.');
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('cancelada')) {
        setErrorMsg(err.message || 'Erro na verificação biométrica.');
      }
    } finally {
      setIsVerifyingBiometrics(false);
    }
  };

  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput.trim()) {
      setErrorMsg('Digite sua senha ou PIN.');
      return;
    }

    const hashed = await hashPassword(pinInput);
    if (hashed === config.pinHash) {
      recordUnlock();
      onUnlocked();
    } else {
      setErrorMsg('Senha ou PIN incorreto. Tente novamente.');
      setPinInput('');
    }
  };

  // Quick PIN pad helper
  const handleKeyPadPress = (num: string) => {
    if (pinInput.length < 12) {
      const newPin = pinInput + num;
      setPinInput(newPin);
      setErrorMsg('');
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF7F2] flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6">
        {/* App Logo / Vault Lock Icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-[#292524] text-[#FAF7F2] flex items-center justify-center shadow-[4px_4px_0px_#C68B59] border-2 border-[#292524]">
            <Lock className="w-10 h-10 text-[#C68B59]" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#386641] text-white flex items-center justify-center border-2 border-[#FAF7F2]">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-2xl font-black text-[#292524] tracking-tight">RetroFin Seguro</h2>
          <p className="text-xs text-[#78716C] font-mono mt-1">
            Digite sua senha/PIN ou use a biometria para acessar suas finanças.
          </p>
        </div>

        {/* Pin Input Display */}
        <form onSubmit={handlePinSubmit} className="w-full space-y-4">
          <div className="relative">
            <input
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setErrorMsg('');
              }}
              placeholder="Digite a senha ou PIN..."
              className="w-full py-3.5 px-4 text-center tracking-[0.3em] font-mono font-bold text-lg rounded-2xl bg-[#FFFDF9] border-2 border-[#E8DFD1] text-[#292524] focus:outline-none focus:border-[#292524] shadow-[2px_2px_0px_#E5DCD0]"
              autoFocus
            />
          </div>

          {errorMsg && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-[#C85A5A] font-mono font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] font-mono font-bold text-sm shadow-[2px_2px_0px_#C68B59] active:translate-y-0.5 transition"
            >
              Desbloquear
            </button>

            {config.biometricsEnabled && hasBiometricsHardware && (
              <button
                type="button"
                onClick={handleBiometricAuth}
                disabled={isVerifyingBiometrics}
                title="Autenticar com Digital / Face ID"
                className="py-3 px-4 rounded-xl bg-[#FAF5ED] hover:bg-[#F3E5D3] border border-[#C68B59]/40 text-[#C68B59] font-mono font-bold text-sm flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#E5DCD0] active:translate-y-0.5 transition"
              >
                <Fingerprint className={`w-5 h-5 ${isVerifyingBiometrics ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">Biometria</span>
              </button>
            )}
          </div>
        </form>

        {/* Quick Numeric Keypad for mobile convenience */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px] pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPadPress(digit)}
              className="h-12 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] hover:border-[#292524] hover:bg-[#F2EBE1] font-mono font-bold text-lg text-[#292524] shadow-[1px_1px_0px_#E5DCD0] active:scale-95 transition"
            >
              {digit}
            </button>
          ))}

          {/* Biometrics button on keypad */}
          {config.biometricsEnabled && hasBiometricsHardware ? (
            <button
              type="button"
              onClick={handleBiometricAuth}
              className="h-12 rounded-xl bg-[#FAF5ED] border border-[#C68B59]/40 text-[#C68B59] flex items-center justify-center shadow-[1px_1px_0px_#E5DCD0] active:scale-95 transition"
              title="Biometria"
            >
              <Fingerprint className="w-5 h-5" />
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={() => handleKeyPadPress('0')}
            className="h-12 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] hover:border-[#292524] hover:bg-[#F2EBE1] font-mono font-bold text-lg text-[#292524] shadow-[1px_1px_0px_#E5DCD0] active:scale-95 transition"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] hover:border-[#C85A5A] hover:bg-[#FAF0F0] font-mono font-bold text-xs text-[#78716C] hover:text-[#C85A5A] flex items-center justify-center shadow-[1px_1px_0px_#E5DCD0] active:scale-95 transition"
          >
            Apagar
          </button>
        </div>

        {/* Footer info */}
        <p className="text-[10px] font-mono text-[#A8A29E] pt-4">
          RetroFin Vault &bull; Seus dados são criptografados e protegidos localmente.
        </p>
      </div>
    </div>
  );
};
