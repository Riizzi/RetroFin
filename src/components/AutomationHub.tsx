import React, { useState, useEffect } from 'react';
import { Transaction, BankAccount, Category } from '../types';
import { parseBankOFX, parseBankCSV, parseRawBankText } from '../utils/ofxParser';
import { exportDatabaseToJSON, parseDatabaseBackup } from '../utils/localDatabase';
import { decodificarArquivo } from '../utils/extrato';
import { BankBadge } from './BankBadge';
import { ConfirmationModal } from './ConfirmationModal';
import { NotificationReaderPanel } from './NotificationReaderPanel';
import Cl4pLinkCard from './Cl4pLinkCard';
import { IaAjustesCard } from './IaAjustesCard';
import AtualizacaoCard from './AtualizacaoCard';
import { ehNativo } from '../native/retrofinNative';
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDemoConfirm, setShowDemoConfirm] = useState(false);

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
        // UTF-8 ou Windows-1252 (o Inter exporta assim): acentos certos nos dois casos
        const content = decodificarArquivo(event.target?.result as ArrayBuffer);
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
              text: 'Nenhuma movimentação foi identificada nos arquivos enviados.',
              details: [
                'Formatos aceitos: OFX de qualquer banco e CSV do Nubank (conta e fatura), Inter e Itaú.',
                'No CSV, o arquivo precisa ter colunas de data e de valor.',
              ],
            });
          }
        }
      };
      reader.onerror = () => {
        filesProcessed++;
        setStatusMsg({ type: 'error', text: `Não consegui ler o arquivo ${file.name}.` });
      };
      reader.readAsArrayBuffer(file);
    });
    // Permite escolher o mesmo arquivo de novo depois de uma falha
    e.target.value = '';
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
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-0.5 px-0.5">
          <button
            onClick={() => setActiveSubtab('import')}
            className={`shrink-0 whitespace-nowrap px-3 min-h-9 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeSubtab === 'import'
                ? 'bg-[#292524] text-[#FAF7F2]'
                : 'bg-[#F2EBE1] text-[#57534E] hover:bg-[#EAE2D5]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar extrato</span>
          </button>

          <button
            onClick={() => setActiveSubtab('backup')}
            className={`shrink-0 whitespace-nowrap px-3 min-h-9 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeSubtab === 'backup'
                ? 'bg-[#292524] text-[#FAF7F2]'
                : 'bg-[#F2EBE1] text-[#57534E] hover:bg-[#EAE2D5]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Backup e vínculos</span>
          </button>

          <button
            onClick={() => setActiveSubtab('notifications')}
            className={`shrink-0 whitespace-nowrap px-3 min-h-9 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeSubtab === 'notifications'
                ? 'bg-[#292524] text-[#FAF7F2]'
                : 'bg-[#F2EBE1] text-[#57534E] hover:bg-[#EAE2D5]'
            }`}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Notificações</span>
          </button>

          <button
            onClick={() => setActiveSubtab('mobile')}
            className={`shrink-0 whitespace-nowrap px-3 min-h-9 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeSubtab === 'mobile'
                ? 'bg-[#292524] text-[#FAF7F2]'
                : 'bg-[#F2EBE1] text-[#57534E] hover:bg-[#EAE2D5]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Instalar</span>
          </button>

          <button
            onClick={() => setActiveSubtab('paste')}
            className={`shrink-0 whitespace-nowrap px-3 min-h-9 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeSubtab === 'paste'
                ? 'bg-[#292524] text-[#FAF7F2]'
                : 'bg-[#F2EBE1] text-[#57534E] hover:bg-[#EAE2D5]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Colar texto</span>
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
                className="min-w-0 w-full sm:w-auto rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-1.5 text-xs font-mono font-bold text-[#292524] focus:outline-none"
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
            {/* Sem filtro de tipo: no Android, .ofx não tem tipo registrado e o seletor deixava o arquivo cinza */}
            <input
              type="file"
              multiple
              onChange={handleBatchFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* SUBTAB 2: LOCAL DATABASE & PRIVACY */}
      {activeSubtab === 'backup' && (
        <div className="p-4 sm:p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] space-y-6">
          <IaAjustesCard />
          <Cl4pLinkCard />
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
                  accept=".json,application/json,text/plain,application/octet-stream"
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

      {/* SUBTAB 3: INSTALAR NO CELULAR */}
      {activeSubtab === 'mobile' && ehNativo && <AtualizacaoCard repo="Riizzi/RetroFin" apk="RetroFin.apk" />}
      {activeSubtab === 'mobile' && (
        <div className="p-4 sm:p-6 rounded-2xl bg-[#FFFDF9] border border-[#E8DFD1] shadow-[2px_2px_0px_#E5DCD0] space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#292524]">Instalar no celular</h3>
            <p className="text-xs text-[#57534E] leading-relaxed mt-1">
              <strong>Android:</strong> baixe o <strong>RetroFin.apk</strong> na página de Releases do GitHub. É o app completo, funciona offline e lê as notificações do banco sozinho.
            </p>
            <p className="text-xs text-[#57534E] leading-relaxed mt-2">
              <strong>iPhone:</strong> abra este site no Safari, toque em Compartilhar e escolha <em>Adicionar à Tela de Início</em>. O iOS não permite ler notificações de outros apps; use a importação de extrato.
            </p>
          </div>
          <a
            href="https://github.com/Riizzi/RetroFin/releases/latest"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 min-h-11 rounded-xl bg-[#292524] text-[#FAF7F2] text-sm font-bold"
          >
            <Download className="w-4 h-4" /> Baixar o APK
          </a>
          <p className="text-[11px] text-[#78716C] leading-relaxed">
            Os dados ficam no aparelho (e na sua conta, se fizer login). Para levar os lançamentos da versão web para o APK, exporte um backup em <strong>Backup e vínculos</strong> e restaure no app.
          </p>
        </div>
      )}

      {/* SUBTAB 4: NOTIFICATIONS (leitor nativo no APK) */}
      {activeSubtab === 'notifications' && <NotificationReaderPanel />}

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
