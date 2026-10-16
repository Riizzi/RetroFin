/** Ponte com o lado Android (leitor de notificações). Na web, tudo responde "indisponível". */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { NotificacaoBruta } from '../services/bankNotifications';

export interface StatusLeitor {
  /** o usuário liberou "Acesso a notificações" para o RetroFin */
  permitido: boolean;
  /** notificações guardadas esperando o app abrir */
  pendentes: number;
  /** epoch ms da última notificação de banco capturada (0 = nunca) */
  ultima: number;
  /** pacotes monitorados */
  pacotes: string[];
}

interface RetroFinNativePlugin {
  getStatus(): Promise<StatusLeitor>;
  openListenerSettings(): Promise<void>;
  pull(): Promise<{ items: NotificacaoBruta[] }>;
  ack(o: { ids: string[] }): Promise<void>;
  setPackages(o: { packages: string[] }): Promise<void>;
  addListener(evento: 'notificacao', f: () => void): Promise<PluginListenerHandle>;
}

const Plugin = registerPlugin<RetroFinNativePlugin>('RetroFinNative');

export const ehNativo = Capacitor.isNativePlatform();

export const leitor = {
  status: (): Promise<StatusLeitor | null> => (ehNativo ? Plugin.getStatus() : Promise.resolve(null)),
  abrirAjustes: () => (ehNativo ? Plugin.openListenerSettings() : Promise.resolve()),
  puxar: async (): Promise<NotificacaoBruta[]> => (ehNativo ? (await Plugin.pull()).items : []),
  confirmar: (ids: string[]) => (ehNativo && ids.length ? Plugin.ack({ ids }) : Promise.resolve()),
  definirPacotes: (packages: string[]) => (ehNativo ? Plugin.setPackages({ packages }) : Promise.resolve()),
  aoChegar: (f: () => void): (() => void) => {
    if (!ehNativo) return () => {};
    const h = Plugin.addListener('notificacao', f);
    return () => void h.then((x) => x.remove());
  },
};
