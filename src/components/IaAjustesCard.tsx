import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getApiBase, setApiBase } from '../services/apiBase';
import { gravarChaveServidor, gravarNomeTitular, lerChaveServidor, lerNomeTitular } from '../services/preferencias';
import { destinoIA } from '../services/categorizer';

const input = 'w-full min-w-0 bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-2.5 rounded-xl text-base text-[#292524] focus:outline-none';
const rotulo = 'block text-[11px] font-mono font-bold uppercase tracking-wider text-[#57534E] mb-1.5';

/** Ajustes da categorização: seu nome (transferência entre contas) e o servidor de IA. */
export const IaAjustesCard: React.FC = () => {
  const [nome, setNome] = useState(lerNomeTitular);
  const [base, setBase] = useState(getApiBase);
  const [chave, setChave] = useState(lerChaveServidor);
  const [salvo, setSalvo] = useState(false);
  const destino = destinoIA('/api/categorize');

  return (
    <div className="bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl p-4 space-y-4 shadow-[2px_2px_0px_#E5DCD0]">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#78716C]" />
        <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#57534E]">Categorização</h3>
      </div>
      <p className="text-xs text-[#78716C] leading-relaxed">
        Ordem: o que você classificou nunca muda; o mesmo estabelecimento herda a sua correção; estabelecimentos conhecidos vão por regra; só o resto vai para a IA, sem nomes de pessoas.
      </p>
      <div>
        <label className={rotulo}>Seu nome como aparece no Pix</label>
        <input className={input} value={nome} onChange={(e) => { setNome(e.target.value); setSalvo(false); }} placeholder="Nome completo" autoComplete="name" />
        <p className="text-[11px] text-[#A8A29E] mt-1">Reconhece transferência entre as suas contas. Fica só neste aparelho.</p>
      </div>
      <div>
        <label className={rotulo}>Servidor de IA (opcional)</label>
        <input className={input} value={base} onChange={(e) => { setBase(e.target.value); setSalvo(false); }} placeholder="https://seu-retrofin.onrender.com" inputMode="url" autoCapitalize="off" autoCorrect="off" />
      </div>
      <div>
        <label className={rotulo}>Chave do servidor (RETROFIN_API_KEY)</label>
        <input className={input} type="password" value={chave} onChange={(e) => { setChave(e.target.value); setSalvo(false); }} autoCapitalize="off" autoCorrect="off" />
      </div>
      <p className="text-[11px] text-[#78716C]">
        IA agora:{' '}
        <strong>{!destino ? 'desligada (só memória e regras)' : destino.origem === 'cl4p' ? 'pelo servidor do CL4P-RZ' : base ? 'pelo servidor configurado' : 'pelo servidor deste site'}</strong>
      </p>
      <button
        type="button"
        onClick={() => {
          gravarNomeTitular(nome);
          setApiBase(base);
          gravarChaveServidor(chave);
          setSalvo(true);
        }}
        className="w-full min-h-11 rounded-xl bg-[#292524] text-[#FAF7F2] text-sm font-bold"
      >
        {salvo ? 'Salvo' : 'Salvar'}
      </button>
    </div>
  );
};
