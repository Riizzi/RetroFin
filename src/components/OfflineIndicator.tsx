import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50 flex items-center justify-center gap-2 rounded-xl bg-[#FAF5ED] border border-[#F3E5D3] px-4 py-2.5 text-xs font-mono font-bold text-[#C68B59] shadow-md">
      <WifiOff className="w-4 h-4 animate-pulse text-[#C85A5A]" />
      <span>Modo Offline — Dados locais em cache no seu celular.</span>
    </div>
  );
};
