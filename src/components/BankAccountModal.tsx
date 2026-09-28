import React, { useState, useEffect } from 'react';
import { BankAccount, BankInstitution } from '../types';
import { BANK_TEMPLATES } from '../data/initialAccounts';
import { X, Check, Landmark, Sparkles, Trash2, Calculator, Info } from 'lucide-react';
import { formatCurrencyBRL } from '../utils/formatters';

interface Props {
  isOpen: boolean;
  account: BankAccount | null; // null if creating
  currentCalculatedBalance?: number; // current balance computed from all registered transactions
  accountNetTransactionsTotal?: number; // sum of all transactions for this account
  onClose: () => void;
  onSave: (acc: BankAccount) => void;
  onDelete?: (id: string) => void;
}

export const BankAccountModal: React.FC<Props> = ({
  isOpen,
  account,
  currentCalculatedBalance,
  accountNetTransactionsTotal = 0,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!isOpen) return null;

  const isEditing = !!account;
  const initialInstitution: BankInstitution = account?.institution || 'NUBANK';
  const template = BANK_TEMPLATES[initialInstitution];

  const [name, setName] = useState(account?.name || 'Nubank (Casa & Mercado)');
  const [institution, setInstitution] = useState<BankInstitution>(initialInstitution);
  const [type, setType] = useState<BankAccount['type']>(account?.type || 'CONTA_CORRENTE');
  const [purpose, setPurpose] = useState(account?.purpose || 'Despesas de casa e compras de supermercado');
  const [agency, setAgency] = useState(account?.agency || '0001');
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber || '');
  
  // Balance mode: 'current' (user inputs what they have RIGHT NOW, system reverse-calculates initial) or 'initial'
  const [balanceInputMode, setBalanceInputMode] = useState<'current' | 'initial'>('current');
  const [currentBalanceInput, setCurrentBalanceInput] = useState<string>(
    account
      ? (currentCalculatedBalance !== undefined
          ? currentCalculatedBalance.toString()
          : (account.balance + accountNetTransactionsTotal).toString())
      : '0'
  );
  const [initialBalanceInput, setInitialBalanceInput] = useState<string>(
    account ? account.balance.toString() : '0'
  );

  // Sync state if account changes
  useEffect(() => {
    if (account) {
      setName(account.name);
      setInstitution(account.institution);
      setType(account.type);
      setPurpose(account.purpose);
      setAgency(account.agency || '');
      setAccountNumber(account.accountNumber || '');
      const calcBal = currentCalculatedBalance !== undefined
        ? currentCalculatedBalance
        : (account.balance + accountNetTransactionsTotal);
      setCurrentBalanceInput(calcBal.toString());
      setInitialBalanceInput(account.balance.toString());
    } else {
      setName('Nubank (Casa & Mercado)');
      setInstitution('NUBANK');
      setType('CONTA_CORRENTE');
      setPurpose('Exclusivo para despesas de casa, mercado, feira e contas fixas');
      setAgency('0001');
      setAccountNumber('');
      setCurrentBalanceInput('0');
      setInitialBalanceInput('0');
    }
  }, [account, currentCalculatedBalance, accountNetTransactionsTotal]);

  const handleInstitutionChange = (newInst: BankInstitution) => {
    setInstitution(newInst);
    const tmpl = BANK_TEMPLATES[newInst];
    if (!isEditing) {
      if (newInst === 'NUBANK') {
        setName('Nubank (Casa & Mercado)');
        setPurpose('Exclusivo para despesas de casa, mercado, feira e contas fixas');
      } else if (newInst === 'BANCO_INTER') {
        setName('Inter (Pessoal & Lazer)');
        setPurpose('Gastos pessoais, lazer, saídas e investimentos');
      } else if (newInst === 'ITAU') {
        setName('Itaú (Principal & Salário)');
        setPurpose('Recebimento de salário CLT, proventos e pagamentos');
      } else {
        setName(`${tmpl.name}`);
        setPurpose('Conta geral');
      }
    }
  };

  const setPresetPurpose = (p: string) => {
    setPurpose(p);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Informe um nome para a conta.');
      return;
    }

    let finalInitialBalance = 0;
    if (balanceInputMode === 'current') {
      const curVal = parseFloat(currentBalanceInput.replace(',', '.'));
      const parsedCurrent = isNaN(curVal) ? 0 : curVal;
      // Formula: Initial Balance = Desired Current Balance - Sum of all transactions
      finalInitialBalance = parsedCurrent - accountNetTransactionsTotal;
    } else {
      const initVal = parseFloat(initialBalanceInput.replace(',', '.'));
      finalInitialBalance = isNaN(initVal) ? 0 : initVal;
    }

    const tmpl = BANK_TEMPLATES[institution];

    const updated: BankAccount = {
      id: account?.id || `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      institution,
      institutionName: tmpl.name,
      type,
      agency: agency.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      purpose: purpose.trim() || 'Geral',
      balance: finalInitialBalance,
      color: tmpl.defaultColor,
      bgColor: tmpl.defaultBg,
      borderColor: tmpl.defaultBorder,
    };

    onSave(updated);
    onClose();
  };

  // Preview calculation for the user
  const previewCurrent = parseFloat(currentBalanceInput.replace(',', '.')) || 0;
  const computedInitial = previewCurrent - accountNetTransactionsTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#292524]/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E8DFD1] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#292524] text-[#FAF7F2] flex items-center justify-center font-bold">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#292524]">
                {isEditing ? 'Editar Conta Bancária' : 'Cadastrar Nova Conta'}
              </h3>
              <p className="text-xs text-[#78716C]">
                Configure o saldo atual ou inicial e a finalidade para a IA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#78716C] hover:text-[#292524] hover:bg-[#F2EBE1] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Institution Selector */}
          <div>
            <label className="block text-xs font-mono font-bold text-[#57534E] mb-1.5">
              Banco / Instituição
            </label>
            <select
              value={institution}
              onChange={(e) => handleInstitutionChange(e.target.value as BankInstitution)}
              className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3.5 py-2.5 text-xs sm:text-sm text-[#292524] focus:outline-none focus:border-[#292524]"
            >
              <option value="NUBANK">🟣 Nubank (NuConta / Roxinho)</option>
              <option value="BANCO_INTER">🟠 Banco Inter (077)</option>
              <option value="ITAU">🟧 Itaú Unibanco (341)</option>
              <option value="BRADESCO">🔴 Banco Bradesco (237)</option>
              <option value="SANTANDER">🔴 Banco Santander (033)</option>
              <option value="C6">⚫ C6 Bank</option>
              <option value="CAIXA">🔵 Caixa Econômica Federal</option>
              <option value="CARTEIRA">🟢 Carteira Física / Dinheiro</option>
              <option value="OUTRO">⚪ Outra Instituição</option>
            </select>
          </div>

          {/* Account Custom Name */}
          <div>
            <label className="block text-xs font-mono font-bold text-[#57534E] mb-1">
              Nome da Conta (Apelido personalizado)
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Nubank - Casa & Mercado, Inter - Pessoal, Itaú - Salário"
              className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3.5 py-2 text-xs sm:text-sm text-[#292524] focus:outline-none focus:border-[#292524] font-bold"
            />
          </div>

          {/* Smart Balance Calibration Section */}
          <div className="p-4 rounded-xl bg-[#FAF5ED] border border-[#F3E5D3] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-[#292524] flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-[#C68B59]" />
                <span>Ajuste de Saldo & Cálculo Retroativo</span>
              </label>
              
              <div className="flex items-center rounded-lg bg-[#FFFDF9] border border-[#E8DFD1] p-0.5 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setBalanceInputMode('current')}
                  className={`px-2 py-1 rounded-md transition ${
                    balanceInputMode === 'current'
                      ? 'bg-[#292524] text-[#FAF7F2] font-bold shadow-xs'
                      : 'text-[#78716C] hover:text-[#292524]'
                  }`}
                >
                  Saldo de Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceInputMode('initial')}
                  className={`px-2 py-1 rounded-md transition ${
                    balanceInputMode === 'initial'
                      ? 'bg-[#292524] text-[#FAF7F2] font-bold shadow-xs'
                      : 'text-[#78716C] hover:text-[#292524]'
                  }`}
                >
                  Saldo Inicial
                </button>
              </div>
            </div>

            {balanceInputMode === 'current' ? (
              <div className="space-y-2">
                <p className="text-[11px] text-[#78716C] leading-relaxed">
                  Informe <strong>quanto você tem agora na sua conta</strong>. O RetroFin usará todos os lançamentos do extrato para calcular o saldo anterior retroativamente.
                </p>
                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-mono font-bold text-[#78716C]">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={currentBalanceInput}
                      onChange={(e) => setCurrentBalanceInput(e.target.value)}
                      placeholder="0,00"
                      className="w-full rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] pl-9 pr-3 py-2 text-sm font-mono font-extrabold text-[#292524] focus:outline-none focus:border-[#292524]"
                    />
                  </div>
                </div>

                {accountNetTransactionsTotal !== 0 && (
                  <div className="p-2.5 rounded-lg bg-[#FFFDF9] border border-[#E8DFD1] text-[11px] font-mono space-y-1 text-[#57534E]">
                    <div className="flex justify-between">
                      <span className="text-[#78716C]">Total de movimentações salvas:</span>
                      <span className={accountNetTransactionsTotal >= 0 ? 'text-[#386641] font-bold' : 'text-[#C85A5A] font-bold'}>
                        {accountNetTransactionsTotal >= 0 ? '+' : ''} {formatCurrencyBRL(accountNetTransactionsTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[#F2EBE1] pt-1">
                      <span className="text-[#78716C]">Saldo inicial retroativo deduzido:</span>
                      <span className="font-bold text-[#292524]">
                        {formatCurrencyBRL(computedInitial)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-[#78716C] leading-relaxed">
                  Informe o saldo com o qual a conta começou antes dos lançamentos cadastrados.
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-mono font-bold text-[#78716C]">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={initialBalanceInput}
                    onChange={(e) => setInitialBalanceInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] pl-9 pr-3 py-2 text-sm font-mono font-extrabold text-[#292524] focus:outline-none focus:border-[#292524]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Account Purpose (Crucial for AI Interpretation) */}
          <div className="p-3.5 rounded-xl bg-[#FAF5ED] border border-[#F3E5D3] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-[#C68B59] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Finalidade da Conta (Orientação para classificação)</span>
              </label>
            </div>
            <textarea
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Ex: Despesas de casa, mercado e contas / Gastos pessoais e lazer / Salário"
              className="w-full rounded-lg bg-[#FFFDF9] border border-[#E8DFD1] p-2.5 text-xs text-[#292524] focus:outline-none focus:border-[#292524] resize-none"
            />
            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setPresetPurpose('Contas de casa, supermercado, feira, luz e condomínio')}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#FFFDF9] hover:bg-[#F2EBE1] border border-[#E8DFD1] text-[#78716C]"
              >
                🏠 Casa & Mercado
              </button>
              <button
                type="button"
                onClick={() => setPresetPurpose('Gastos pessoais, lazer, saídas, restaurantes e compras')}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#FFFDF9] hover:bg-[#F2EBE1] border border-[#E8DFD1] text-[#78716C]"
              >
                🎯 Pessoal & Lazer
              </button>
              <button
                type="button"
                onClick={() => setPresetPurpose('Recebimento de salário CLT e pagamentos fixos')}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#FFFDF9] hover:bg-[#F2EBE1] border border-[#E8DFD1] text-[#78716C]"
              >
                💼 Salário & Entradas
              </button>
            </div>
          </div>

          {/* Account Type */}
          <div>
            <label className="block text-xs font-mono font-bold text-[#57534E] mb-1">
              Tipo de Conta
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-2 text-xs text-[#292524] focus:outline-none focus:border-[#292524]"
            >
              <option value="CONTA_CORRENTE">Conta Corrente / NuConta / Inter</option>
              <option value="CARTAO_CREDITO">Cartão de Crédito</option>
              <option value="INVESTIMENTO">Caixinha / CDB / Investimento</option>
              <option value="POUPANCA">Poupança</option>
              <option value="CARTEIRA">Dinheiro Físico / Carteira</option>
            </select>
          </div>

          {/* Agency & Account Number */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono font-bold text-[#57534E] mb-1">
                Agência (Opcional)
              </label>
              <input
                type="text"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                placeholder="0001"
                className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-2 text-xs font-mono text-[#292524] focus:outline-none focus:border-[#292524]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono font-bold text-[#57534E] mb-1">
                Número da Conta (Opcional)
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="12345-6"
                className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-2 text-xs font-mono text-[#292524] focus:outline-none focus:border-[#292524]"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#E8DFD1] flex items-center justify-between gap-2">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(account.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold text-[#C85A5A] hover:bg-[#FAF0F0] rounded-xl transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-mono text-[#78716C] hover:text-[#292524] transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] text-xs font-mono font-bold transition active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Conta</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
