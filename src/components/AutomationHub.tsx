import React, { useState, useEffect } from 'react';
import { Transaction, BankAccount, Category } from '../types';
import { parseBankOFX, parseBankCSV, parseRawBankText } from '../utils/ofxParser';
import { exportDatabaseToJSON, parseDatabaseBackup } from '../utils/localDatabase';
import { BankBadge } from './BankBadge';
import { ConfirmationModal } from './ConfirmationModal';
import QRCode from 'qrcode';
import {
  Smartphone,
  Zap,
  FileText,
  Upload,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  BellRing,
  FoldHorizontal,
  Download,
  RotateCcw,
  Plus,
  Database,
  Calendar,
  Layers,
  Fingerprint,
  KeyRound,
} from 'lucide-react';

interface Props {
  userId?: string;
  accounts: BankAccount[];
  categories: Category[];
  transactions: Transaction[];
  onImportTransactions: (transactions: Transaction[]) => void;
  onResetDatabase?: () => void;
  onLoadDemoData?: () => void;
  onOpenNewAccountModal?: () => void;
  onOpenSecuritySettings?: () => void;
  onRestoreBackup?: (backup: {
    accounts: BankAccount[];
    transactions: Transaction[];
    categories: Category[];
  }) => void;
}

export const AutomationHub: React.FC<Props> = ({
  userId,
  accounts,
  categories,
  transactions,
  onImportTransactions,
  onResetDatabase,
  onLoadDemoData,
  onOpenNewAccountModal,
  onOpenSecuritySettings,
  onRestoreBackup,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || 'AUTO_DETECT'
  );
  const [rawText, setRawText] = useState('');
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
    details?: string[];
  } | null>(null);
  const [activeSubtab, setActiveSubtab] = useState<'import' | 'notifications' | 'backup' | 'mobile' | 'paste'>('import');
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDemoConfirm, setShowDemoConfirm] = useState(false);

  // Live Notification Polling state
  const [isListeningNotifications, setIsListeningNotifications] = useState(true);
  const [receivedPushCount, setReceivedPushCount] = useState(0);

  // App URL for mobile install (Android / iOS):
  // Support Published custom domain (https://retrofin.ai.studio), Active Dev, and Published cloud run link
  const [urlMode, setUrlMode] = useState<'custom' | 'dev' | 'cloudrun'>(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (origin.includes('retrofin.ai.studio')) return 'custom';
      if (origin.includes('-dev-') || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes(':3000')) return 'dev';
      if (origin.includes('-pre-') || origin.includes('.run.app')) return 'cloudrun';
    }
    return 'custom';
  });

  const customDomainUrl = 'https://retrofin.ai.studio';
  const liveOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const devUrl = liveOrigin.includes('ais-pre-')
    ? liveOrigin.replace('ais-pre-', 'ais-dev-')
    : liveOrigin;
  const cloudRunPublishedUrl = liveOrigin.includes('ais-dev-')
    ? liveOrigin.replace('ais-dev-', 'ais-pre-')
    : liveOrigin;

  const currentAppUrl =
    urlMode === 'custom'
      ? customDomainUrl
      : urlMode === 'dev'
      ? devUrl
      : cloudRunPublishedUrl;
  const baseWebhookUrl = `${currentAppUrl}/api/notifications/webhook`;
  const webhookUrl = userId
    ? `${baseWebhookUrl}?userId=${userId}`
    : baseWebhookUrl;

  // Generate QR Code for mobile camera scanning
  useEffect(() => {
    if (!currentAppUrl) return;
    QRCode.toDataURL(currentAppUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#292524',
        light: '#FAF7F2',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error(err));
  }, [currentAppUrl]);

  // Live polling for incoming notifications from MacroDroid / Webhook
  useEffect(() => {
    if (!isListeningNotifications) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/notifications/poll');
        if (res.ok) {
          const data = await res.json();
          if (data.count > 0 && Array.isArray(data.items)) {
            const mappedTxs: Transaction[] = data.items.map((item: any) => {
              const matchedAcc =
                accounts.find((a) => a.institution === item.bank) || accounts[0];

              return {
                id: item.id,
                date: item.receivedAt.split('T')[0],
                description: item.description,
                amount: item.amount,
                type: item.type,
                category: item.category,
                subcategory: item.subcategory,
                channel: item.channel as any,
                accountId: matchedAcc?.id || `acc-${item.bank?.toLowerCase()}`,
                accountName: matchedAcc?.name || item.account || 'Conta Bancária',
                bankInstitution: item.bank as any,
                bank: item.bank as any,
                account: matchedAcc?.name || item.account,
                accountPurpose: matchedAcc?.purpose,
                isCategorizedByAI: true,
                aiConfidence: 0.96,
                aiReason: `Capturado via Webhook Push (${item.source}) para ${matchedAcc?.name || 'conta'}`,
                status: 'liquidado',
              };
            });

            onImportTransactions(mappedTxs);
            setReceivedPushCount((prev) => prev + mappedTxs.length);
            setStatusMsg({
              type: 'success',
              text: `${mappedTxs.length} transação(ões) recebida(s) da notificação.`,
            });

            // Clear buffer on server
            await fetch('/api/notifications/clear', { method: 'POST' });
          }
        }
      } catch (err) {
        // Silently retry on next tick
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isListeningNotifications, accounts, onImportTransactions]);

  // Dynamic Batch File Upload (Extracts dates dynamically, NO fixed months!)
  const handleBatchFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const targetAccount = accounts.find((a) => a.id === selectedAccountId);
    let allParsed: Transaction[] = [];
    let filesProcessed = 0;
    const totalFiles = files.length;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        let parsed: Transaction[] = [];

        if (
          file.name.toLowerCase().endsWith('.ofx') ||
          content.includes('<OFX>') ||
          content.includes('<STMTTRN>')
        ) {
          parsed = parseBankOFX(content, targetAccount);
        } else {
          parsed = parseBankCSV(content, targetAccount);
        }

        allParsed = [...allParsed, ...parsed];
        filesProcessed++;

        if (filesProcessed === totalFiles) {
          if (allParsed.length > 0) {
            // Deduplicate by ID
            const uniqueMap = new Map<string, Transaction>();
            allParsed.forEach((tx) => uniqueMap.set(tx.id, tx));
            const uniqueList = Array.from(uniqueMap.values());

            // Dynamically identify months found in this import!
            const monthCounts: Record<string, number> = {};
            uniqueList.forEach((tx) => {
              const m = tx.date ? tx.date.substring(0, 7) : 'Indeterminado';
              monthCounts[m] = (monthCounts[m] || 0) + 1;
            });

            const monthBreakdown = Object.entries(monthCounts)
              .sort()
              .reverse()
              .map(([m, count]) => `• ${m}: ${count} transações identificadas`);

            onImportTransactions(uniqueList);
            setStatusMsg({
              type: 'success',
              text: `Importação concluída: ${uniqueList.length} transações processadas em ${Object.keys(monthCounts).length} mês(es).`,
              details: monthBreakdown,
            });
          } else {
            setStatusMsg({
              type: 'error',
              text: 'Nenhuma movimentação bancária foi identificada nos arquivos enviados.',
            });
          }
        }
      };
      reader.readAsText(file);
    });
  };

  // Paste text handler
  const handleParsePastedText = () => {
    if (!rawText.trim()) {
      setStatusMsg({
        type: 'error',
        text: 'Cole o texto do extrato ou de uma notificação antes de importar.',
      });
      return;
    }

    const targetAccount = accounts.find((a) => a.id === selectedAccountId);
    const parsed = parseRawBankText(rawText, targetAccount);
    if (parsed.length > 0) {
      onImportTransactions(parsed);
      setStatusMsg({
        type: 'success',
        text: `${parsed.length} lançamento(s) extraído(s) do texto e salvos na base local.`,
      });
      setRawText('');
    } else {
      setStatusMsg({
        type: 'error',
        text: 'Não foi possível extrair valores monetários (ex: R$ 45,90) do texto informado.',
      });
    }
  };

  // Restore backup from JSON
  const handleFileBackupRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const backup = parseDatabaseBackup(content);
        if (onRestoreBackup) {
          onRestoreBackup(backup);
          setStatusMsg({
            type: 'success',
            text: `Base local restaurada com sucesso! ${backup.accounts.length} conta(s) e ${backup.transactions.length} transação(ões) carregadas.`,
          });
        }
      } catch (err: any) {
        setStatusMsg({
          type: 'error',
          text: `Erro ao restaurar backup: ${err.message}`,
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Navigation Pills */}
      <div className="p-1.5 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0]">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveSubtab('import')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeSubtab === 'import'
                ? 'bg-[#292524] text-[#FAF7F2]'
                : 'bg-[#F2EBE1] text-[#57534E] hover:bg-[#EAE2D5]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importador Multi-Mês (OFX/CSV)</span>
          </button>

          <button
            onClick={() => setActiveSubtab('backup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeSubtab === 'backup'
                ? 'bg-[#292524] text-[#FAF7F2]'
                : 'bg-[#F2EBE1] text-[#57534E] hover:bg-[#EAE2D5]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Base Local & Segurança</span>
          </button>

          <button
            onClick={() => setActiveSubtab('notifications')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeSubtab === 'notifications'
                ? 'bg-[#292524] text-[#FAF7F2]'
                : 'bg-[#F2EBE1] text-[#57534E] hover:bg-[#EAE2D5]'
            }`}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Leitor de Notificações</span>
          </button>

          <button
            onClick={() => setActiveSubtab('mobile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeSubtab === 'mobile'
                ? 'bg-[#292524] text-[#FAF7F2]'
                : 'bg-[#F2EBE1] text-[#57534E] hover:bg-[#EAE2D5]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Instalar no Celular (Android & iOS)</span>
          </button>

          <button
            onClick={() => setActiveSubtab('paste')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeSubtab === 'paste'
                ? 'bg-[#292524] text-[#FAF7F2]'
                : 'bg-[#F2EBE1] text-[#57534E] hover:bg-[#EAE2D5]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Colar Texto</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono space-y-1.5 ${
            statusMsg.type === 'success'
              ? 'bg-[#EDF5EF] border-[#CDDACF] text-[#386641]'
              : 'bg-[#FAF0F0] border-[#E8C4C4] text-[#C85A5A]'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span className="font-bold">{statusMsg.text}</span>
          </div>
          {statusMsg.details && statusMsg.details.length > 0 && (
            <div className="pl-6 pt-1 text-[11px] opacity-90 space-y-0.5">
              {statusMsg.details.map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 1: MULTI-MONTH IMPORT */}
      {activeSubtab === 'import' && (
        <div className="p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#292524]">
                Importador de Extratos (OFX / CSV)
              </h3>
              <p className="text-xs text-[#78716C] mt-0.5">
                Carregue extratos de qualquer período. Os lançamentos são identificados por data e organizados automaticamente por mês.
              </p>
            </div>

            {/* Target Account Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#78716C] shrink-0">Conta destino:</span>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-1.5 text-xs font-mono font-bold text-[#292524] focus:outline-none"
              >
                <option value="AUTO_DETECT">🔍 Auto-detectar pelo arquivo</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.institutionName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Bank Guide */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#F4EEF7]/60 border border-[#D9C4E0] space-y-1">
              <span className="font-bold text-[#6B3E75] block font-mono">🟣 Nubank:</span>
              <p className="text-[11px] text-[#57534E] leading-relaxed">
                App Nubank ➜ <em>Conta</em> ou <em>Fatura</em> ➜ <em>Exportar Extrato</em> ➜ escolha <strong>OFX</strong> ou <strong>CSV</strong>.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FFF5EB]/60 border border-[#FBD8BA] space-y-1">
              <span className="font-bold text-[#B85714] block font-mono">🟠 Banco Inter:</span>
              <p className="text-[11px] text-[#57534E] leading-relaxed">
                App Inter ➜ <em>Extrato</em> ➜ filtre qualquer período (30, 60, 90 dias) ➜ <em>Exportar</em> ➜ <strong>OFX</strong>.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FFF6ED]/60 border border-[#FED7AA] space-y-1">
              <span className="font-bold text-[#EC7000] block font-mono">🟧 Itaú:</span>
              <p className="text-[11px] text-[#57534E] leading-relaxed">
                App ou Web Itaú ➜ <em>Extrato de Conta</em> ➜ <em>Exportar</em> ➜ escolha <strong>OFX</strong> ou <strong>Excel/CSV</strong>.
              </p>
            </div>
          </div>

          {/* Multi-file dropzone */}
          <label className="relative flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#D5CBBC] hover:border-[#292524] rounded-2xl cursor-pointer bg-[#FAF7F2] hover:bg-[#F5F0E6] transition group text-center">
            <Upload className="w-10 h-10 text-[#78716C] group-hover:text-[#292524] mb-2 transition" />
            <span className="text-sm font-bold text-[#292524]">
              Selecione 1 ou múltiplos arquivos (.OFX ou .CSV) de qualquer mês
            </span>
            <span className="text-xs text-[#78716C] font-mono mt-1">
              Os lançamentos são distribuídos por mês de acordo com a data de cada movimentação
            </span>
            <span className="mt-2 text-[10px] font-mono px-2 py-0.5 rounded bg-[#EDF5EF] text-[#386641] font-bold border border-[#CDDACF]">
              Processamento local no navegador
            </span>
            <input
              type="file"
              multiple
              accept=".ofx,.csv,.txt"
              onChange={handleBatchFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* SUBTAB 2: LOCAL DATABASE & PRIVACY */}
      {activeSubtab === 'backup' && (
        <div className="p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#386641]/10 text-[#386641] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#292524]">
                Armazenamento Local & Backup
              </h3>
              <p className="text-xs text-[#78716C]">
                Os dados são gravados localmente neste navegador. Cada usuário ou dispositivo possui uma base própria.
              </p>
            </div>
          </div>

          {/* Architecture Guarantee Card */}
          <div className="p-4 rounded-xl bg-[#FAF5ED] border border-[#F3E5D3] space-y-2 text-xs text-[#57534E]">
            <span className="font-mono font-bold text-[#C68B59] block">
              Como funciona o armazenamento:
            </span>
            <ul className="space-y-1 list-disc list-inside text-[11px] leading-relaxed">
              <li>
                <strong>Memória do navegador</strong>: Contas e transações ficam gravadas no LocalStorage deste aparelho.
              </li>
              <li>
                <strong>Sem banco de dados em nuvem</strong>: Não há envio de extratos para servidores externos.
              </li>
              <li>
                <strong>Uso individual</strong>: Ao abrir o link em outro celular ou navegador, inicia-se uma base limpa e separada.
              </li>
            </ul>
          </div>

          {/* Security & Biometrics Card */}
          {onOpenSecuritySettings && (
            <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[1px_1px_0px_#E5DCD0]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#292524] text-[#FAF7F2] flex items-center justify-center shrink-0">
                  <Fingerprint className="w-5 h-5 text-[#C68B59]" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-[#292524] truncate">
                    Proteção com Senha / PIN & Biometria do Celular
                  </h4>
                  <p className="text-[11px] text-[#78716C]">
                    Ative o bloqueio automático ao abrir o app e utilize impressão digital ou Face ID para desbloquear.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenSecuritySettings}
                className="py-2 px-3.5 rounded-xl bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-[2px_2px_0px_#C68B59] active:translate-y-0.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#C68B59]" />
                <span>Configurar Senha & Biometria</span>
              </button>
            </div>
          )}

          {/* Database Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Export JSON */}
            <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#292524] font-mono">
                  📦 Exportar Backup Completo
                </span>
                <span className="text-[10px] font-mono text-[#78716C]">
                  {transactions.length} transações / {accounts.length} contas
                </span>
              </div>
              <p className="text-[11px] text-[#78716C] leading-relaxed">
                Baixe um arquivo seguro .JSON contendo todas as contas, transações históricas e categorias.
              </p>
              <button
                onClick={() => exportDatabaseToJSON(accounts, transactions, categories)}
                className="w-full py-2 px-3 rounded-xl bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] text-xs font-mono font-bold transition flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Base (Download JSON)</span>
              </button>
            </div>

            {/* Import JSON */}
            <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] space-y-2.5">
              <span className="font-bold text-xs text-[#292524] font-mono block">
                📥 Restaurar Backup de Arquivo
              </span>
              <p className="text-[11px] text-[#78716C] leading-relaxed">
                Restaure uma base de dados previamente exportada em outro celular ou navegador.
              </p>
              <label className="w-full py-2 px-3 rounded-xl bg-[#FAF7F2] hover:bg-[#F2EBE1] border border-[#E8DFD1] text-[#292524] text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Selecionar Arquivo .JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileBackupRestore}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Reset / Demo Data Tools */}
          <div className="pt-3 border-t border-[#E8DFD1] flex flex-wrap items-center justify-between gap-3">
            {onLoadDemoData && (
              <button
                type="button"
                onClick={() => setShowDemoConfirm(true)}
                className="px-3.5 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F2EBE1] border border-[#E8DFD1] text-xs font-mono text-[#57534E] font-bold transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Carregar Dados de Exemplo (Nubank/Inter/Itaú)</span>
              </button>
            )}

            {onResetDatabase && (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="px-3.5 py-2 rounded-xl bg-[#FAF0F0] hover:bg-[#FCE8E8] text-[#C85A5A] border border-[#E8C4C4] text-xs font-mono font-bold transition"
              >
                Zerar Base Local (Iniciar 100% Limpo)
              </button>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: MOBILE INSTALL GUIDE (ANDROID & IOS) */}
      {activeSubtab === 'mobile' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0]">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* QR Code */}
              <div className="md:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] text-center">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="QR Code RetroFin"
                    className="w-44 h-44 rounded-lg shadow-sm border border-[#E8DFD1]"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-xs font-mono text-[#78716C]">
                    Carregando QR Code...
                  </div>
                )}
                <span className="text-[11px] font-mono font-bold text-[#292524] mt-2.5 block">
                  Aponte a câmera do seu celular
                </span>
                <span className="text-[10px] font-mono text-[#78716C]">
                  Compatível com Android e Apple iOS (iPhone & iPad)
                </span>
              </div>

              {/* Instructions */}
              <div className="md:col-span-8 space-y-4">
                <div>
                  <span className="px-2 py-0.5 rounded bg-[#EDF5EF] text-[#386641] text-[10px] font-mono font-bold uppercase tracking-wider border border-[#CDDACF]">
                    Web App Progressivo (PWA)
                  </span>
                  <h3 className="text-lg font-bold text-[#292524] mt-1">
                    Como instalar no seu Celular (Android & iOS)
                  </h3>
                  <p className="text-xs text-[#57534E] leading-relaxed mt-0.5">
                    O <strong>RetroFin</strong> é um aplicativo completo instalável diretamente pelo navegador em qualquer smartphone ou tablet, sem necessidade de baixar de lojas de aplicativos. Funciona 100% offline, em tela cheia e com privacidade total.
                  </p>
                </div>

                {/* URL Mode Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono text-[#78716C]">Modo do Link:</span>
                  <div className="flex flex-wrap p-0.5 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1]">
                    <button
                      onClick={() => setUrlMode('custom')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                        urlMode === 'custom'
                          ? 'bg-[#292524] text-[#FAF7F2] shadow-xs'
                          : 'text-[#78716C] hover:text-[#292524]'
                      }`}
                    >
                      🚀 retrofin.ai.studio (Oficial)
                    </button>
                    <button
                      onClick={() => setUrlMode('dev')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                        urlMode === 'dev'
                          ? 'bg-[#292524] text-[#FAF7F2] shadow-xs'
                          : 'text-[#78716C] hover:text-[#292524]'
                      }`}
                    >
                      ⚡ Teste Ativo (Dev)
                    </button>
                    <button
                      onClick={() => setUrlMode('cloudrun')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                        urlMode === 'cloudrun'
                          ? 'bg-[#292524] text-[#FAF7F2] shadow-xs'
                          : 'text-[#78716C] hover:text-[#292524]'
                      }`}
                    >
                      🌐 Cloud Run
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8DFD1] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
                  <div className="truncate flex-1 max-w-full">
                    <span className="text-[10px] text-[#78716C] block">
                      {urlMode === 'custom'
                        ? 'Link oficial publicado do RetroFin:'
                        : urlMode === 'dev'
                        ? 'Link ativo de desenvolvimento (despublicado):'
                        : 'Link direto Cloud Run:'}
                    </span>
                    <span className="text-[#292524] font-bold truncate block">{currentAppUrl}</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentAppUrl);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#292524] text-[#FAF7F2] hover:bg-[#44403C] text-xs font-mono font-bold transition flex items-center gap-1.5 shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedUrl ? 'Copiado!' : 'Copiar Link'}</span>
                  </button>
                </div>

                {urlMode === 'custom' && (
                  <p className="text-[11px] text-[#386641] bg-[#EDF5EF] border border-[#CDDACF] p-2.5 rounded-xl leading-relaxed">
                    ✨ <strong>Link Oficial Publicado:</strong> <code>https://retrofin.ai.studio</code>. Use este link no navegador do seu smartphone para instalar o PWA na tela inicial.
                  </p>
                )}

                {urlMode === 'dev' && (
                  <p className="text-[11px] text-[#78716C] bg-[#FAF5ED] border border-[#F3E5D3] p-2.5 rounded-xl leading-relaxed">
                    💡 <strong>Para testar despublicado no celular:</strong> Abra este link no Google Chrome do celular conectado à mesma conta Google (<code>jprizzi2003@gmail.com</code>).
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Android vs iOS Guides */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Android Guide */}
            <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] space-y-3">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#E8DFD1]">
                <div className="w-8 h-8 rounded-lg bg-[#386641]/10 text-[#386641] flex items-center justify-center font-bold text-sm">
                  🤖
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#292524]">Smartphones Android</h4>
                  <p className="text-[10px] font-mono text-[#78716C]">Google Chrome, Samsung Internet, Edge, etc.</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-[#57534E]">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    Abra o link no navegador <strong>Google Chrome</strong> ou <strong>Samsung Internet</strong> (se abrir na câmera, toque em ⋮ ➔ <em>Abrir no Chrome</em>).
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <p>Abra o menu de <strong>três pontinhos (⋮)</strong> no canto superior direito do Google Chrome.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <p>Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</p>
                    <p className="mt-1 text-[11px] text-[#386641] leading-relaxed">
                      💡 Com o aplicativo publicado em <strong>https://retrofin.ai.studio</strong>, o Google Chrome oferece instalação nativa direta com o ícone oficial da cédula RetroFin!
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    4
                  </span>
                  <p>Pronto! O aplicativo aparecerá na sua tela inicial com o ícone cinza escuro e abrirá em tela inteira sem barra de endereço.</p>
                </div>
              </div>
            </div>

            {/* iOS Guide */}
            <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] space-y-3">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#E8DFD1]">
                <div className="w-8 h-8 rounded-lg bg-[#292524]/10 text-[#292524] flex items-center justify-center font-bold text-sm">
                  🍏
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#292524]">Apple iOS (iPhone / iPad)</h4>
                  <p className="text-[10px] font-mono text-[#78716C]">Navegador Safari nativo</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-[#57534E]">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <p>Abra o link do aplicativo no <strong>Safari</strong> do seu iPhone.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <p>Toque no botão <strong>Compartilhar</strong> (ícone com quadrado e seta para cima na barra inferior).</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    3
                  </span>
                  <p>Role para baixo nas opções e toque em <strong>"Adicionar à Tela de Início"</strong>.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F2EBE1] text-[#292524] flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    4
                  </span>
                  <p>Toque em <strong>"Adicionar"</strong> no canto superior direito para fixar o ícone na tela do seu iPhone!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: NOTIFICATIONS */}
      {activeSubtab === 'notifications' && (
        <div className="p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#292524]">
                  Leitor de Notificações em Tempo Real
                </h3>
                <span className="w-2 h-2 rounded-full bg-[#4A7C59] animate-pulse" />
              </div>
              <p className="text-xs text-[#78716C] mt-0.5">
                Receba compras e Pix do Nubank, Inter e Itaú diretamente no RetroFin assim que chegam no seu celular.
              </p>
            </div>

            <div className="flex items-center gap-3 text-right text-xs font-mono">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetch('/api/notifications/webhook', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        app: 'Nubank',
                        title: 'Compra aprovada no cartão',
                        text: 'Você pagou R$ 38,50 em Padaria Bella Vista com o cartão Nubank Mastercard',
                      }),
                    });
                    setStatusMsg({
                      type: 'success',
                      text: 'Notificação de teste enviada! O leitor vai capturar e categorizar em alguns segundos.',
                    });
                  } catch (e: any) {
                    setStatusMsg({
                      type: 'error',
                      text: 'Erro ao enviar notificação de teste.',
                    });
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-[#FAF5ED] border border-[#F3E5D3] text-[#C68B59] hover:text-[#292524] text-[11px] font-bold transition flex items-center gap-1 shrink-0"
                title="Testar recepção simulando uma notificação do Nubank"
              >
                <span>🧪 Testar Notificação</span>
              </button>

              <div>
                <span className="text-[#78716C] block text-[10px]">Capturados nesta sessão:</span>
                <span className="font-extrabold text-[#386641] text-sm">
                  {receivedPushCount} transação(ões)
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#292524] block">
                🔗 Endereço Webhook do seu RetroFin:
              </span>
              <span className="text-[10px] font-mono text-[#386641] bg-[#EDF5EF] border border-[#CDDACF] px-2 py-0.5 rounded font-bold">
                POST / JSON
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="w-full sm:flex-1 rounded-lg bg-[#FFFDF9] border border-[#E8DFD1] px-3 py-1.5 text-xs font-mono text-[#292524] font-bold"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  setCopiedScript(true);
                  setTimeout(() => setCopiedScript(false), 2000);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] text-xs font-mono font-bold transition flex items-center gap-1 shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedScript ? 'Copiado!' : 'Copiar URL'}</span>
              </button>
            </div>

            {userId ? (
              <p className="text-[11px] text-[#386641] font-mono leading-relaxed bg-[#EDF5EF] p-2.5 rounded-lg border border-[#CDDACF] mt-2">
                ✨ <strong>Modo Persistente Ativo!</strong> Esta URL já contém o seu identificador seguro. Com ele, o servidor grava as notificações <strong>diretamente no seu banco de dados Firestore</strong> em tempo real, sem depender de o aplicativo estar aberto ou de ficar na aba "Automação"!
              </p>
            ) : (
              <p className="text-[11px] text-[#C68B59] font-mono leading-relaxed bg-[#FAF5ED] p-2.5 rounded-lg border border-[#F3E5D3] mt-2">
                ⚠️ <strong>Aviso:</strong> Faça login com o Google para habilitar o <strong>Modo Persistente</strong>. Sem ele, as notificações recebidas ficarão apenas na memória temporária do servidor e serão perdidas se o app for fechado.
              </p>
            )}

            {/* CRITICAL WARNING ABOUT GOOGLE REDIRECT WRAPPING */}
            <div className="p-3 rounded-lg bg-[#FAF0F0] border border-[#E8C4C4] text-[#C85A5A] text-[11px] leading-relaxed space-y-1.5 mt-2">
              <p className="font-bold flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#C85A5A]" />
                CUIDADO COM LINKS REDIRECIONADOS DO GOOGLE (MUITO IMPORTANTE!)
              </p>
              <p>
                Nas capturas de tela do seu celular, percebemos que o MacroDroid está chamando uma URL do tipo <code>https://www.google.com/url?sa=E&q=...</code>.
              </p>
              <p>
                <strong>Isso impede o funcionamento do webhook!</strong> O Google bloqueia o envio de dados via POST através de links de redirecionamento dele.
              </p>
              <p>
                Cole exatamente a URL limpa copiada acima (iniciando em <code>https://ais-dev-...</code> ou <code>https://ais-pre-...</code>) diretamente na configuração de Requisição HTTP do seu MacroDroid.
              </p>
            </div>
          </div>

          {/* Step-by-Step MacroDroid Tutorial */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E8DFD1]">
              <span className="w-6 h-6 rounded-lg bg-[#FAF5ED] border border-[#F3E5D3] text-[#C68B59] flex items-center justify-center font-bold text-xs">
                🤖
              </span>
              <h4 className="font-bold text-sm text-[#292524]">
                Passo a Passo: Como Configurar o MacroDroid no Android
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Step 1: Gatilho */}
              <div className="p-4 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#FAF0F0] text-[#C85A5A] font-mono font-bold text-[11px] flex items-center justify-center border border-[#E8C4C4]">
                    1
                  </span>
                  <span className="font-bold text-[#292524]">Gatilho (Trigger)</span>
                </div>
                <p className="text-[11px] text-[#57534E] leading-relaxed">
                  No MacroDroid, toque em <strong>"Adicionar Macro"</strong>. Em <strong>Gatilhos (+)</strong>, selecione:
                </p>
                <div className="bg-[#FAF7F2] p-2.5 rounded-lg border border-[#E8DFD1] font-mono text-[11px] space-y-1">
                  <p>➜ <strong>Dispositivo / Notificação</strong></p>
                  <p>➜ <strong>Notificação Recebida</strong></p>
                  <p>➜ Escolha os apps dos seus bancos: <strong>Nubank</strong>, <strong>Inter</strong>, <strong>Itaú</strong>, etc.</p>
                  <p className="text-[10px] text-[#78716C] pt-0.5">Deixe "Qualquer conteúdo" selecionado.</p>
                </div>
              </div>

              {/* Step 2: Ação HTTP */}
              <div className="p-4 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#EFF4F8] text-[#4A6984] font-mono font-bold text-[11px] flex items-center justify-center border border-[#D0DFEB]">
                    2
                  </span>
                  <span className="font-bold text-[#292524]">Ação (Action)</span>
                </div>
                <p className="text-[11px] text-[#57534E] leading-relaxed">
                  Na seção <strong>Ações (+)</strong> do MacroDroid, escolha:
                </p>
                <div className="bg-[#FAF7F2] p-2.5 rounded-lg border border-[#E8DFD1] font-mono text-[11px] space-y-1">
                  <p>➜ <strong>Conectividade / Web</strong></p>
                  <p>➜ <strong>Requisição HTTP (HTTP Request)</strong></p>
                  <p>➜ Método: <strong>POST</strong></p>
                  <p>➜ URL: cole o endereço webhook copiado acima.</p>
                </div>
              </div>

              {/* Step 3: Corpo JSON */}
              <div className="p-4 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#EDF5EF] text-[#386641] font-mono font-bold text-[11px] flex items-center justify-center border border-[#CDDACF]">
                    3
                  </span>
                  <span className="font-bold text-[#292524]">Conteúdo (Body)</span>
                </div>
                <p className="text-[11px] text-[#57534E] leading-relaxed">
                  Configure o envio dos dados da notificação:
                </p>
                <div className="bg-[#FAF7F2] p-2.5 rounded-lg border border-[#E8DFD1] font-mono text-[11px] space-y-1">
                  <p>➜ Content-Type: <strong>application/json</strong></p>
                  <p>➜ Corpo do Texto (Body): copie o modelo JSON no quadro abaixo.</p>
                  <p className="text-[10px] text-[#78716C] pt-0.5">As variáveis serão preenchidas pelo Android!</p>
                </div>
              </div>
            </div>

            {/* JSON Code Box ready to copy */}
            <div className="p-4 rounded-xl bg-[#292524] text-[#FAF7F2] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#DDA15E]">
                  📄 Corpo JSON para colar no MacroDroid (Body / Conteúdo do POST):
                </span>
                <button
                  onClick={() => {
                    const jsonPayload = '{\n  "app": "{notif_app_name}",\n  "title": "{notif_title}",\n  "text": "{notification_text}"\n}';
                    navigator.clipboard.writeText(jsonPayload);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded bg-[#44403C] hover:bg-[#57534E] text-xs font-mono transition flex items-center gap-1 text-[#FAF7F2]"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedScript ? 'Copiado!' : 'Copiar JSON'}</span>
                </button>
              </div>

              <pre className="text-xs font-mono text-[#E5DDD0] bg-[#1C1917] p-3 rounded-lg overflow-x-auto leading-relaxed border border-[#44403C]">
{`{
  "app": "{notif_app_name}",
  "title": "{notif_title}",
  "text": "{notification_text}"
}`}
              </pre>
              <p className="text-[11px] text-[#A8A29E] leading-relaxed">
                💡 <em>Dica do MacroDroid:</em> No campo de texto, você pode usar os botões de três pontinhos <strong>(...)</strong> para selecionar as variáveis nativas <code>[notif_app_name]</code>, <code>[notif_title]</code> e <code>[notification_text]</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: PASTE TEXT */}
      {activeSubtab === 'paste' && (
        <div className="p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#292524]">
                Colar Linhas de Extrato ou Notificação
              </h3>
              <p className="text-xs text-[#78716C] mt-0.5">
                Copie do seu WhatsApp, bloco de notas ou notificação e cole abaixo.
              </p>
            </div>
          </div>

          <textarea
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Exemplo:&#10;Você pagou R$ 42,00 no Cartão Nubank em Padaria Bella&#10;Pix enviado R$ 150,00 Quinto Andar&#10;Compra de R$ 89,90 aprovada em Posto Ipiranga"
            className="w-full rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] p-3 text-xs sm:text-sm text-[#292524] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#292524] font-mono"
          />

          <div className="flex justify-end">
            <button
              onClick={handleParsePastedText}
              className="px-5 py-2.5 rounded-xl bg-[#292524] hover:bg-[#44403C] text-[#FAF7F2] text-xs font-mono font-bold transition active:scale-95 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-[#DDA15E]" />
              <span>Importar & Categorizar com IA</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Reset Local Database */}
      <ConfirmationModal
        isOpen={showResetConfirm}
        title="Zerar Base de Dados Local"
        message="ATENÇÃO: Deseja apagar todas as contas e transações gravadas neste navegador para começar 100% do zero? Esta operação limpa a memória local imediatamente."
        confirmLabel="Sim, zerar tudo"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={() => {
          if (onResetDatabase) {
            onResetDatabase();
            setStatusMsg({
              type: 'success',
              text: 'Base de dados zerada com sucesso. Você pode cadastrar novas contas do zero.',
            });
          }
          setShowResetConfirm(false);
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Confirmation Modal: Load Demo Data */}
      <ConfirmationModal
        isOpen={showDemoConfirm}
        title="Carregar Dados de Exemplo"
        message="Deseja carregar as contas e transações pré-configuradas de demonstração (Nubank, Inter e Itaú)?"
        confirmLabel="Carregar Exemplo"
        cancelLabel="Cancelar"
        isDestructive={false}
        onConfirm={() => {
          if (onLoadDemoData) {
            onLoadDemoData();
            setStatusMsg({
              type: 'success',
              text: 'Dados de demonstração carregados com sucesso!',
            });
          }
          setShowDemoConfirm(false);
        }}
        onCancel={() => setShowDemoConfirm(false)}
      />
    </div>
  );
};
