/** Registro das últimas notificações lidas (para conferir o que virou lançamento e o que foi ignorado). */
import type { NotificacaoBruta } from './bankNotifications';

export interface ItemLog {
  id: string;
  app: string;
  texto: string;
  postedAt: number;
  lancada: boolean;
  valor?: number;
  descricao?: string;
  motivo?: string;
}

const CHAVE = 'retrofin_notif_log_v1';
const MAX = 40;

export function lerLog(): ItemLog[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function registrarNoLog(n: NotificacaoBruta, r: { lancada: boolean; valor?: number; descricao?: string; motivo?: string }) {
  const item: ItemLog = { id: n.id, app: n.app || n.pkg, texto: `${n.title || ''} ${n.text || ''}`.trim().slice(0, 240), postedAt: n.postedAt, ...r };
  const lista = [item, ...lerLog().filter((x) => x.id !== n.id)].slice(0, MAX);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    /* sem armazenamento */
  }
  window.dispatchEvent(new Event('retrofin-notif-log'));
}

export function limparLog() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
  window.dispatchEvent(new Event('retrofin-notif-log'));
}
