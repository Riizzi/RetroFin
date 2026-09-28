import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292524]/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] p-5 sm:p-6 shadow-2xl text-[#292524] space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isDestructive
                  ? 'bg-[#FAF0F0] text-[#C85A5A] border border-[#E8C4C4]'
                  : 'bg-[#FAF5ED] text-[#C68B59] border border-[#F3E5D3]'
              }`}
            >
              {isDestructive ? (
                <Trash2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#292524] leading-tight">
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-[#78716C] hover:text-[#292524] hover:bg-[#F2EBE1] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-[#57534E] leading-relaxed">
          {message}
        </p>

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-mono font-medium text-[#78716C] hover:text-[#292524] hover:bg-[#F2EBE1] rounded-xl transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-mono font-bold rounded-xl transition active:scale-95 shadow-xs ${
              isDestructive
                ? 'bg-[#C85A5A] hover:bg-[#B34747] text-white'
                : 'bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
