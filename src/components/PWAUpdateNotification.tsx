import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';

export const PWAUpdateNotification: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateFunction, setUpdateFunction] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        console.log('[RetroFin] App pronto para funcionar 100% offline.');
      },
    });

    setUpdateFunction(() => updateSW);
  }, []);

  if (!needRefresh) return null;

  const handleUpdate = () => {
    if (updateFunction) {
      updateFunction().then(() => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="fixed top-16 left-4 right-4 md:left-auto md:right-8 md:w-96 z-50 p-3.5 rounded-2xl bg-[#292524] text-[#FAF7F2] shadow-2xl border border-[#44403C] animate-in fade-in slide-in-from-top-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-[#4A7C59] flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4 text-[#FAF7F2]" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold leading-tight truncate">Nova versão disponível!</p>
          <p className="text-[10px] text-[#A8A29E] font-mono leading-snug">
            Toque para atualizar agora.
          </p>
        </div>
      </div>
      <button
        onClick={handleUpdate}
        className="px-3 py-1.5 rounded-xl bg-[#4A7C59] hover:bg-[#386641] text-[#FAF7F2] text-xs font-mono font-bold transition flex items-center gap-1.5 shrink-0 active:scale-95 shadow-xs"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Atualizar</span>
      </button>
    </div>
  );
};
