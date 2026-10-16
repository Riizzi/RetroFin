import { Capacitor } from '@capacitor/core';
import { Transaction, BankAccount, AIInsight, Category } from '../types';
import { getApiBase } from './apiBase';
import { exemplosParaIA, itemParaIA, separar, validarRespostaIA, type Classificacao } from './categorizacao';
import { cl4pVinculo } from './cl4pLink';
import { lerChaveServidor, lerNomeTitular } from './preferencias';

interface DestinoIA {
  url: string;
  headers: Record<string, string>;
  origem: 'servidor' | 'cl4p';
}

/**
 * Para onde mandar os lançamentos que precisam de IA:
 * 1. servidor do RetroFin configurado nos ajustes; 2. na web, o próprio site (/api);
 * 3. no APK vinculado ao CL4P-RZ, o servidor do hub. Sem nenhum: só memória e regras.
 */
export function destinoIA(caminho: '/api/categorize' | '/api/ai-insights'): DestinoIA | null {
  const chave = lerChaveServidor();
  const auth: Record<string, string> = chave ? { Authorization: `Bearer ${chave}` } : {};
  const base = getApiBase();
  if (base) return { url: base + caminho, headers: auth, origem: 'servidor' };
  if (!Capacitor.isNativePlatform()) return { url: caminho, headers: auth, origem: 'servidor' };
  const v = cl4pVinculo();
  if (v) return { url: `${v.u}/api/retrofin/${caminho === '/api/categorize' ? 'categorize' : 'insights'}`, headers: { Authorization: `Bearer ${v.k}` }, origem: 'cl4p' };
  return null;
}

export interface ResumoCategorizacao {
  memoria: number;
  regras: number;
  ia: number;
  semPista: number;
  avisoIA?: string;
}

function aplicar(t: Transaction, c: Classificacao): Transaction {
  return {
    ...t,
    category: c.category,
    subcategory: c.subcategory || t.subcategory,
    categorizedBy: c.categorizedBy,
    isCategorizedByAI: true,
    aiConfidence: c.confidence,
    aiReason: c.reason,
  };
}

/**
 * Categoriza `alvo` em camadas (ver services/categorizacao.ts). Nunca mexe no que você
 * classificou à mão. `todas` alimenta a memória das suas correções.
 */
export async function categorizarLancamentos(
  alvo: Transaction[],
  todas: Transaction[],
  categories: Category[],
  opcoes: { usarIA?: boolean } = {},
): Promise<{ updated: Transaction[]; resumo: ResumoCategorizacao }> {
  const validas = new Set(categories.map((c) => c.id));
  const { resolvidos, pendentes } = separar(alvo, todas, validas, lerNomeTitular());
  const resumo: ResumoCategorizacao = { memoria: 0, regras: 0, ia: 0, semPista: 0 };
  for (const c of resolvidos.values()) {
    if (c.categorizedBy === 'memoria') resumo.memoria++;
    else resumo.regras++;
  }

  const daIA = new Map<string, Classificacao>();
  const destino = opcoes.usarIA === false ? null : destinoIA('/api/categorize');
  if (pendentes.length && destino) {
    try {
      for (let i = 0; i < pendentes.length; i += 200) {
        const lote = pendentes.slice(i, i + 200);
        const r = await fetch(destino.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...destino.headers },
          body: JSON.stringify({
            items: lote.map(itemParaIA),
            categorias: categories.map((c) => ({ id: c.id, name: c.name })),
            exemplos: exemplosParaIA(todas),
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `Servidor respondeu ${r.status}`);
        const ok = validarRespostaIA(j, new Set(lote.map((t) => t.id)), validas);
        for (const [id, c] of ok) daIA.set(id, c);
      }
    } catch (e) {
      resumo.avisoIA = (e as Error).message === 'Failed to fetch' ? 'Sem conexão com o servidor de IA.' : (e as Error).message;
    }
  } else if (pendentes.length && !destino) {
    resumo.avisoIA = 'IA não configurada: usei só a memória e as regras.';
  }

  const mapa = new Map(alvo.map((t) => [t.id, t]));
  const updated: Transaction[] = [];
  for (const [id, c] of resolvidos) updated.push(aplicar(mapa.get(id)!, c));
  for (const t of pendentes) {
    const c = daIA.get(t.id);
    if (c) {
      resumo.ia++;
      updated.push(aplicar(t, c));
    } else resumo.semPista++;
  }
  return { updated, resumo };
}

/** Compatibilidade: assinatura antiga usada por telas que só querem uma sugestão. */
export async function categorizeTransactionsWithAI(
  transactions: Transaction[],
  _accounts: BankAccount[] = [],
  todas: Transaction[] = [],
  categories: Category[] = [],
): Promise<{ updated: Transaction[]; engine: string; error?: string }> {
  const { updated, resumo } = await categorizarLancamentos(transactions, todas, categories);
  return { updated, engine: resumo.ia ? 'ia' : 'memoria-regras', error: resumo.avisoIA };
}

export async function fetchAIInsights(
  month: string,
  summary: { income: number; expense: number; balance: number },
  topExpenses: { category: string; amount: number }[]
): Promise<AIInsight[]> {
  try {
    const destino = destinoIA('/api/ai-insights');
    if (!destino) throw new Error('IA não configurada');
    const res = await fetch(destino.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...destino.headers },
      body: JSON.stringify({ month, summary, topExpenses }),
    });
    if (!res.ok) throw new Error('Falha ao obter insights');
    const data = await res.json();
    return data.insights || [];
  } catch (e) {
    return [
      {
        title: 'Gestão Inteligente por Conta',
        type: 'tip',
        message: 'Utilizar contas dedicadas (ex: Nubank para despesas de casa e Inter para gastos pessoais) simplifica o controle do orçamento.',
        action: 'Acompanhe os limites por categoria na aba Orçamento.',
      },
      {
        title: 'Aporte de Reserva',
        type: 'positive',
        message: 'Mantenha os aportes nas Caixinhas do Nubank ou CDB Inter para render 100%+ do CDI com liquidez imediata.',
        action: 'Programar aporte recorrente.',
      },
    ];
  }
}
