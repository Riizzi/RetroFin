import { Category } from '../types';

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'alimentacao',
    name: 'Alimentação & Mercado',
    color: '#C85A5A', // Muted vintage red
    bgColor: '#FAF0F0',
    icon: 'Utensils',
    monthlyBudget: 1500,
  },
  {
    id: 'investimentos',
    name: 'Aportes & Reserva',
    color: '#386641', // Deep vintage green
    bgColor: '#EDF5EF',
    icon: 'TrendingUp',
    monthlyBudget: 1200,
  },
  {
    id: 'servicos',
    name: 'Assinaturas & Streaming',
    color: '#65717B', // Faded slate
    bgColor: '#F2F4F6',
    icon: 'Tv',
    monthlyBudget: 200,
  },
  {
    id: 'compras',
    name: 'Compras & Vestuário',
    color: '#A06D53', // Muted terracotta
    bgColor: '#F8F3F0',
    icon: 'ShoppingBag',
    monthlyBudget: 500,
  },
  {
    id: 'contas',
    name: 'Contas & Consumo (Luz/Água/Net)',
    color: '#D97706', // Warm amber
    bgColor: '#FEF3C7',
    icon: 'Zap',
    monthlyBudget: 450,
  },
  {
    id: 'educacao',
    name: 'Educação',
    color: '#5C715E', // Olive sage
    bgColor: '#F1F4F1',
    icon: 'GraduationCap',
    monthlyBudget: 250,
  },
  {
    id: 'farmacia',
    name: 'Farmácia & Higiene',
    color: '#0D9488', // Teal / Pharmacy
    bgColor: '#F0FDFA',
    icon: 'HeartPulse',
    monthlyBudget: 250,
  },
  {
    id: 'lazer',
    name: 'Lazer & Saídas',
    color: '#8A6286', // Faded vintage plum
    bgColor: '#F7F2F6',
    icon: 'Sparkles',
    monthlyBudget: 350,
  },
  {
    id: 'moradia',
    name: 'Moradia',
    color: '#4A6984', // Vintage denim blue
    bgColor: '#EFF4F8',
    icon: 'Home',
    monthlyBudget: 1800,
  },
  {
    id: 'receitas',
    name: 'Salário & Entradas',
    color: '#4A7C59', // Vintage forest green
    bgColor: '#EDF5EF',
    icon: 'ArrowDownLeft',
    monthlyBudget: 0,
  },
  {
    id: 'saude',
    name: 'Saúde',
    color: '#10B981', // Emerald green
    bgColor: '#ECFDF5',
    icon: 'Stethoscope',
    monthlyBudget: 300,
  },
  {
    id: 'snacks',
    name: 'Snacks & Mimos',
    color: '#D97706', // Warm Amber
    bgColor: '#FEF3C7',
    icon: 'Cookie',
    monthlyBudget: 250,
  },
  {
    id: 'transacao_interna',
    name: 'Transação Interna',
    color: '#64748B', // Neutral slate grey
    bgColor: '#F1F5F9',
    icon: 'ArrowLeftRight',
    monthlyBudget: 0,
  },
  {
    id: 'transporte',
    name: 'Transporte',
    color: '#C68B59', // Vintage warm mustard / ochre
    bgColor: '#FAF5ED',
    icon: 'Car',
    monthlyBudget: 600,
  },
  {
    id: 'outros',
    name: 'Outros & Diversos',
    color: '#78716C', // Warm stone grey
    bgColor: '#F5F5F4',
    icon: 'Tag',
    monthlyBudget: 200,
  },
];
