/** Resumo do RetroFin enviado ao hub CL4P-RZ (contrato "retrofin", schema 1). */
import type { BankAccount, Category, Transaction } from '../types';

const DIAS_HISTORICO = 400;

function origem(t: Transaction): string {
  if (t.id.startsWith('notif-') || t.id.startsWith('push-') || t.tags?.includes('webhook') || t.tags?.includes('notificacao')) return 'notificacao';
  if (/^(ofx|csv|clip)-/.test(t.id)) return 'extrato';
  return 'manual';
}

export function montarResumoRetroFin(accounts: BankAccount[], transactions: Transaction[], categories: Category[], monthlyBudget: number) {
  const nomeCat = new Map(categories.map((c) => [c.id, c.name]));
  const limite = new Date(Date.now() - DIAS_HISTORICO * 86_400_000).toISOString().slice(0, 10);
  return {
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, institution: a.institution, type: a.type, balance: a.balance, purpose: a.purpose })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, monthlyBudget: c.monthlyBudget || 0 })),
    monthlyBudget,
    transactions: transactions
      .filter((t) => t.date >= limite)
      .map((t) => ({
        id: t.id,
        date: t.date,
        ...(t.time ? { time: t.time.slice(0, 5) } : {}),
        ...(t.createdAt ? { createdAt: t.createdAt } : {}),
        description: t.description,
        amount: t.amount,
        category: nomeCat.get(t.category) || t.category,
        channel: t.channel,
        accountName: t.accountName || t.account,
        source: origem(t),
      })),
  };
}
