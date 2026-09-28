import React from 'react';
import { BankInstitution } from '../types';
import { BANK_TEMPLATES } from '../data/initialAccounts';

interface Props {
  bank?: BankInstitution;
  customName?: string;
  size?: 'sm' | 'md';
}

export const BankBadge: React.FC<Props> = ({ bank = 'OUTRO', customName, size = 'sm' }) => {
  const tmpl = BANK_TEMPLATES[bank] || BANK_TEMPLATES.OUTRO;
  const displayName = customName || (bank === 'BANCO_INTER' ? 'Inter' : tmpl.name.split(' ')[0]);

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-bold rounded border ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
      }`}
      style={{
        backgroundColor: tmpl.defaultBg,
        borderColor: tmpl.defaultBorder,
        color: tmpl.defaultColor,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: tmpl.defaultColor }}
      />
      <span className="truncate max-w-[120px]">{displayName}</span>
    </span>
  );
};
