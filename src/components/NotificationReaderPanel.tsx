import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Download, ExternalLink, XCircle } from 'lucide-react';
import { ehNativo, leitor, type StatusLeitor } from '../native/retrofinNative';
import { NOMES_APP_BANCO } from '../services/bankNotifications';
import { lerLog, limparLog, type ItemLog } from '../services/notifLog';
import { formatCurrencyBRL } from '../utils/formatters';

const RELEASES = 'https://github.com/Riizzi/RetroFin/releases/latest';

const cartao = 'p-4 sm:p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0]';
const rotulo = 'text-[11px] font-mono font-bold uppercase tracking-wider text-[#57534E]';

function quando(ts: number) {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Configuração do leitor nativo de notificações (APK) ou instruções de instalação (web). */
export const NotificationReaderPanel: React.FC = () => {
  const [status, setStatus] = useState<StatusLeitor | null>(null);
  const [log, setLog] = useState<ItemLog[]>(lerLog);

  const atualizar = useCallback(async () => {
    setStatus(await leitor.status().catch(() => null));
    setLog(lerLog());
  }, []);

  useEffect(() => {
    void atualizar();
    const aoVoltar = () => document.visibilityState === 'visible' && void atualizar();
    const aoLogar = () => setLog(lerLog());
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('retrofin-notif-log', aoLogar);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('retrofin-notif-log', aoLogar);
    };
  }, [atualizar]);

  if (!ehNativo) {
    return (
      <div className={`${cartao} space-y-4`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F2EBE1] border border-[#E8DFD1] flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 text-[#292524]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#292524]">Lançamentos pelas notificações do banco</h3>
            <p className="text-xs text-[#57534E] leading-relaxed mt-1">
              A leitura de notificações funciona no app Android do RetroFin. Ele lê as notificações do Nubank, Inter e outros bancos direto no celular e cria os lançamentos, sem MacroDroid e sem servidor.
            </p>
          </div>
        </div>
        <ol className="text-xs text-[#57534E] space-y-1.5 list-decimal pl-5 leading-relaxed">
          <li>Na versão web, exporte um backup em <strong>Backup e vínculos</strong>.</li>
          <li>Baixe e instale o <strong>RetroFin.apk</strong> pela página de Releases do GitHub.</li>
          <li>No app, restaure o backup e libere o acesso às notificações nesta mesma aba.</li>
        </ol>
        <a href={RELEASES} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 min-h-11 rounded-xl bg-[#292524] text-[#FAF7F2] text-sm font-bold">
          <Download className="w-4 h-4" /> Baixar o APK
        </a>
      </div>
    );
  }

  const nomes = (status?.pacotes || []).map((p) => NOMES_APP_BANCO[p] || p);

  return (
    <div className="space-y-4">
      <div className={`${cartao} space-y-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#292524]">Leitor de notificações</h3>
            <p className="text-xs text-[#78716C] mt-0.5">Compras e Pix entram sozinhos assim que o banco notifica.</p>
          </div>
          <span className={`shrink-0 text-[10px] font-mono font-bold uppercase px-2 py-1 rounded-md border ${status?.permitido ? 'text-[#386641] bg-[#EDF5EF] border-[#CDDACF]' : 'text-[#C85A5A] bg-[#FAF0F0] border-[#E8C4C4]'}`}>
            {status?.permitido ? 'ligado' : 'desligado'}
          </span>
        </div>

        {!status?.permitido && (
          <div className="space-y-3">
            <ol className="text-xs text-[#57534E] space-y-1.5 list-decimal pl-5 leading-relaxed">
              <li>Toque em <strong>Liberar acesso</strong> e ative o <strong>RetroFin</strong> na lista.</li>
              <li>
                Se o Android mostrar <em>"Configuração restrita"</em> (comum em apps instalados por APK): abra <strong>Ajustes → Apps → RetroFin</strong>, toque nos três pontinhos e escolha <strong>Permitir configurações restritas</strong>. Depois repita o passo 1.
              </li>
              <li>Em <strong>Bateria</strong>, deixe o RetroFin como <strong>Sem restrições</strong> para o leitor não ser encerrado.</li>
            </ol>
            <button type="button" onClick={() => void leitor.abrirAjustes()} className="w-full min-h-11 rounded-xl bg-[#292524] text-[#FAF7F2] text-sm font-bold inline-flex items-center justify-center gap-2">
              <ExternalLink className="w-4 h-4" /> Liberar acesso
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1]">
            <p className={rotulo}>Última captura</p>
            <p className="text-sm font-mono font-bold text-[#292524] mt-1">{status?.ultima ? quando(status.ultima) : 'nenhuma'}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1]">
            <p className={rotulo}>Na fila</p>
            <p className="text-sm font-mono font-bold text-[#292524] mt-1">{status?.pendentes ?? 0}</p>
          </div>
        </div>
        {nomes.length > 0 && (
          <p className="text-[11px] text-[#78716C] leading-relaxed">
            <strong>Bancos monitorados:</strong> {nomes.join(', ')}. Só notificações desses apps com valor em reais são lidas, e o texto não sai do celular.
          </p>
        )}
      </div>

      <div className={`${cartao} space-y-3`}>
        <div className="flex items-center justify-between gap-3">
          <p className={rotulo}>Últimas notificações lidas</p>
          {log.length > 0 && (
            <button type="button" onClick={() => limparLog()} className="text-[11px] font-mono font-bold text-[#78716C] underline">
              limpar
            </button>
          )}
        </div>
        {log.length === 0 ? (
          <p className="text-xs text-[#78716C]">Nada por enquanto. Faça uma compra ou um Pix e volte aqui.</p>
        ) : (
          <ul className="divide-y divide-dashed divide-[#E8DFD1]">
            {log.map((it) => (
              <li key={it.id} className="py-2.5 flex gap-2.5">
                {it.lancada ? <CheckCircle2 className="w-4 h-4 text-[#386641] shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-[#A8A29E] shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-xs font-bold text-[#292524] truncate">{it.lancada ? it.descricao : it.motivo}</span>
                    {it.valor !== undefined && <span className={`text-xs font-mono font-bold shrink-0 ${it.valor < 0 ? 'text-[#292524]' : 'text-[#386641]'}`}>{formatCurrencyBRL(it.valor)}</span>}
                  </div>
                  <p className="text-[11px] text-[#78716C] break-words">
                    {it.app} · {quando(it.postedAt)} · “{it.texto}”
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
};
