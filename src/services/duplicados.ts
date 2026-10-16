/**
 * Evita lançamento duplicado ao importar extrato: a mesma compra pode já ter entrado pela
 * notificação do banco ou por uma importação anterior.
 * Regra: mesmo id, ou mesmo valor (±1 centavo) com até 1 dia de diferença. Cada lançamento
 * existente "casa" com no máximo um do extrato, então duas compras iguais no mesmo dia continuam duas.
 */
import type { Transaction } from '../types';

const DIA = 86_400_000;

export function separarRepetidos(importados: Transaction[], existentes: Transaction[]): { novos: Transaction[]; repetidos: number } {
  const ids = new Set(existentes.map((t) => t.id));
  const usados = new Set<string>();
  const porValor = new Map<number, Transaction[]>();
  for (const t of existentes) {
    const k = Math.round(t.amount * 100);
    porValor.set(k, [...(porValor.get(k) ?? []), t]);
  }
  const novos: Transaction[] = [];
  let repetidos = 0;
  const vistosNoArquivo = new Set<string>();
  for (const t of importados) {
    if (ids.has(t.id) || vistosNoArquivo.has(t.id)) {
      repetidos++;
      continue;
    }
    vistosNoArquivo.add(t.id);
    const k = Math.round(t.amount * 100);
    const candidatos = [k - 1, k, k + 1].flatMap((v) => porValor.get(v) ?? []);
    const par = candidatos.find((e) => !usados.has(e.id) && Math.abs(Date.parse(e.date) - Date.parse(t.date)) <= DIA);
    if (par) {
      usados.add(par.id);
      repetidos++;
      continue;
    }
    novos.push(t);
  }
  return { novos, repetidos };
}
