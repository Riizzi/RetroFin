import { BankAccount, BankInstitution } from '../types';

export interface BankTemplate {
  institution: BankInstitution;
  name: string;
  defaultColor: string;
  defaultBg: string;
  defaultBorder: string;
  code: string;
}

export const BANK_TEMPLATES: Record<BankInstitution, BankTemplate> = {
  NUBANK: {
    institution: 'NUBANK',
    name: 'Nubank (NuConta / Cartão)',
    defaultColor: '#820AD1',
    defaultBg: '#F4EEF7',
    defaultBorder: '#D9C4E0',
    code: '260',
  },
  BANCO_INTER: {
    institution: 'BANCO_INTER',
    name: 'Banco Inter (077)',
    defaultColor: '#FF7A00',
    defaultBg: '#FFF5EB',
    defaultBorder: '#FBD8BA',
    code: '077',
  },
  ITAU: {
    institution: 'ITAU',
    name: 'Itaú Unibanco',
    defaultColor: '#EC7000',
    defaultBg: '#FFF6ED',
    defaultBorder: '#FED7AA',
    code: '341',
  },
  BRADESCO: {
    institution: 'BRADESCO',
    name: 'Banco Bradesco',
    defaultColor: '#CC092F',
    defaultBg: '#FDF2F4',
    defaultBorder: '#FECDD3',
    code: '237',
  },
  SANTANDER: {
    institution: 'SANTANDER',
    name: 'Banco Santander',
    defaultColor: '#EC0000',
    defaultBg: '#FEF2F2',
    defaultBorder: '#FECACA',
    code: '033',
  },
  C6: {
    institution: 'C6',
    name: 'C6 Bank',
    defaultColor: '#242424',
    defaultBg: '#F5F5F4',
    defaultBorder: '#D6D3D1',
    code: '336',
  },
  CAIXA: {
    institution: 'CAIXA',
    name: 'Caixa Econômica',
    defaultColor: '#0066B3',
    defaultBg: '#EFF6FF',
    defaultBorder: '#BFDBFE',
    code: '104',
  },
  CARTEIRA: {
    institution: 'CARTEIRA',
    name: 'Carteira Física (Dinheiro)',
    defaultColor: '#4A7C59',
    defaultBg: '#EDF5EF',
    defaultBorder: '#CDDACF',
    code: '000',
  },
  OUTRO: {
    institution: 'OUTRO',
    name: 'Outra Instituição',
    defaultColor: '#78716C',
    defaultBg: '#F5F5F4',
    defaultBorder: '#E7E5E4',
    code: '999',
  },
};

export const INITIAL_ACCOUNTS: BankAccount[] = [
  {
    id: 'acc-nubank',
    name: 'Nubank (Casa & Mercado)',
    institution: 'NUBANK',
    institutionName: 'Nubank',
    type: 'CARTAO_CREDITO',
    agency: '0001',
    accountNumber: '839210-4',
    purpose: 'Despesas de casa, condomínio, supermercado, luz, água e feira',
    balance: 3420.00,
    color: '#820AD1',
    bgColor: '#F4EEF7',
    borderColor: '#D9C4E0',
  },
  {
    id: 'acc-inter',
    name: 'Inter (Pessoal & Lazer)',
    institution: 'BANCO_INTER',
    institutionName: 'Banco Inter',
    type: 'CONTA_CORRENTE',
    agency: '0001',
    accountNumber: '109845-2',
    purpose: 'Gastos pessoais, saídas, lazer, compras individuais e investimentos no CDB',
    balance: 4850.32,
    color: '#FF7A00',
    bgColor: '#FFF5EB',
    borderColor: '#FBD8BA',
  },
  {
    id: 'acc-itau',
    name: 'Itaú (Principal & Salário)',
    institution: 'ITAU',
    institutionName: 'Itaú Unibanco',
    type: 'CONTA_CORRENTE',
    agency: '0342',
    accountNumber: '48219-0',
    purpose: 'Conta principal para recebimento de salário CLT, proventos e pagamentos fixos',
    balance: 2150.00,
    color: '#EC7000',
    bgColor: '#FFF6ED',
    borderColor: '#FED7AA',
  },
];
