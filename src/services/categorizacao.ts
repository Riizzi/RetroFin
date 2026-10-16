/**
 * Categorização dos lançamentos, em camadas (da mais confiável para a menos):
 *
 *  1. Você      → o que você classificou à mão nunca é sobrescrito.
 *  2. Memória   → estabelecimento que você já classificou antes recebe a mesma categoria.
 *  3. Regras    → palavras-chave conhecidas (Uber, iFood, Cemig, Drogasil…), com limite de palavra.
 *  4. IA        → só o que sobrou vai para o Gemini, com as SUAS categorias e os seus exemplos,
 *                 e a resposta é restrita à lista de categorias (não inventa id).
 *
 * Arquivo puro (sem DOM, sem rede): usado pelo app, pelo servidor e pelos testes.
 */

export interface TxBasica {
  id: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category: string;
  subcategory?: string;
  channel?: string;
  date?: string;
  time?: string;
  accountPurpose?: string;
  isCategorizedByAI?: boolean;
  categorizedBy?: OrigemCategoria;
}

export type OrigemCategoria = 'usuario' | 'memoria' | 'regras' | 'ia';

export interface CategoriaBasica {
  id: string;
  name: string;
}

export interface Classificacao {
  category: string;
  subcategory?: string;
  categorizedBy: OrigemCategoria;
  confidence: number;
  reason: string;
}

// ------------------------------------------------------------------ normalização

const PREFIXOS = /^(?:pag\*|pg \*|ifd\*|ifood \*|mp\*|mercpago\*|picpay\*|pp\*|ec \*|ebanx\*|paypal \*|dl\*|dm\*|cielo\*|stone\*|sumup\*|pagseguro\*|ps\*|zp\*|ton\*|lojas? |compra (?:no )?(?:debito|credito)\s*-?\s*)/i;
const RUIDO_FIM = /\s+(?:belo horizont\w*|bhz?|contagem|betim|sao paulo|sp|rj|mg|br|bra|brasil|ltda|me|epp|eireli|s\.?a\.?|parc(?:ela)?\s*\d+\/\d+|\d{2}\/\d{2})$/i;

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Chave estável do estabelecimento: "IFD*RESTAURANTE SABOR MINEIRO BELO HORIZONT" e
 * "Restaurante Sabor Mineiro" viram "restaurante sabor mineiro".
 */
export function chaveEstabelecimento(desc: string): string {
  let s = semAcento(desc || '').toLowerCase().trim();
  s = s.replace(/^(?:pix (?:enviado |recebido )?(?:para|de)|transferencia (?:enviada |recebida )?(?:para|de)|pagamento (?:de|para)|compra (?:em|no|na))\s+/, (m) => (m.startsWith('pix') ? 'pix ' : m.startsWith('transf') ? 'transf ' : ''));
  for (let i = 0; i < 3; i++) s = s.replace(PREFIXOS, '');
  s = s.replace(/[*#_\-./\\|]+/g, ' ').replace(/\d{3,}/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 4; i++) s = s.replace(RUIDO_FIM, '').trim();
  const palavras = s.split(' ').filter((w) => w.length > 1 || /\d/.test(w));
  return palavras.slice(0, 4).join(' ');
}


/** Esconde nomes de pessoas (Pix/transferência) antes de mandar para a IA. */
export function ocultarPessoas(desc: string): string {
  const d = desc.trim();
  const m = d.match(/^((?:pix|transfer[êe]ncia|ted|doc)(?: (?:enviad[oa]|recebid[oa]))? (?:para|de) )(.+)$/i);
  if (!m) return d;
  const resto = m[2];
  // Mantém nomes de empresa (LTDA, S.A., palavras de comércio); esconde nomes próprios
  if (/\b(ltda|s\.?a\.?|me|eireli|comercio|servicos|loja|mercado|restaurante|farmacia|drogaria|posto|academia|condominio)\b/i.test(semAcento(resto))) return d;
  return `${m[1]}[pessoa]`;
}

// ------------------------------------------------------------------ 1 e 2: você e memória

/** O usuário classificou à mão (inclui lançamentos antigos, de antes deste campo existir). */
export function ehManual(t: TxBasica): boolean {
  if (t.categorizedBy) return t.categorizedBy === 'usuario';
  return !t.isCategorizedByAI && Boolean(t.category) && t.category !== 'outros';
}

export interface RegraMemoria {
  category: string;
  subcategory?: string;
  exemplo: string;
  vezes: number;
}

/** Memória: estabelecimento → categoria, a partir do que você classificou (o mais recente vence). */
export function montarMemoria(todas: TxBasica[]): Map<string, RegraMemoria> {
  const mem = new Map<string, RegraMemoria>();
  const ordenadas = [...todas].sort((a, b) => `${a.date || ''}${a.time || ''}`.localeCompare(`${b.date || ''}${b.time || ''}`));
  for (const t of ordenadas) {
    if (!ehManual(t)) continue;
    const k = chaveEstabelecimento(t.description);
    if (!k || k.length < 3 || /^(pix|transf)$/.test(k)) continue;
    const ant = mem.get(k);
    mem.set(k, { category: t.category, subcategory: t.subcategory, exemplo: t.description, vezes: (ant?.vezes || 0) + 1 });
  }
  return mem;
}

// ------------------------------------------------------------------ 3: regras locais

type Regra = [RegExp, string, string];

/** Ordem importa: o primeiro que bater vence. Tudo com limite de palavra (\b) para evitar "TIM" em "ESTIMA". */
const REGRAS_DEBITO: Regra[] = [
  [/\b(mercado ?livre|mercadolivre|meli|amazon(?! prime)|amzn|shopee|shein|aliexpress|magazine ?luiza|magalu|casas bahia|americanas|kabum|netshoes|centauro|decathlon|renner|riachuelo|c ?& ?a|zara|hering)\b/, 'compras', 'Compras online & lojas'],
  [/\b(ifood|ifd|rappi|uber ?eats|aiqfome|ze delivery|james delivery)\b/, 'alimentacao', 'Delivery'],
  [/\b(uber|99 ?app|99 ?pop|99 ?taxi|cabify|indrive|taxi)\b/, 'transporte', 'Transporte por app'],
  [/\b(posto|shell|ipiranga|petrobras|br mania|ale combustiveis|combustivel|gasolina|estacionamento|estapar|sem parar|conectcar|veloe|pedagio|bhtrans|otimo|metro bh|onibus|move metropolitano)\b/, 'transporte', 'Combustível, estacionamento e transporte'],
  [/\b(supermercado|supermerc|super mercado|mercado|mercearia|sacolao|hortifruti|hortifrut|acougue|feira|atacadao|assai|carrefour|pao de acucar|epa|verdemar|super nosso|supernosso|bh supermercados|mart minas|dia|oxxo|emporio|minimercado|padaria)\b/, 'alimentacao', 'Mercado & padaria'],
  [/\b(restaurante|rest|lanchonete|lanches|pizzaria|pizza|hamburgueria|burger|mc ?donalds?|bk|subway|outback|madero|churrascaria|sushi|temaki|japones|bistro|self service|cantina|refeicao|marmita|spoleto|giraffas|habibs?|coco bambu)\b/, 'alimentacao', 'Restaurantes & lanches'],
  [/\b(cafe|cafeteria|starbucks|sorveteria|sorvete|gelato|doceria|confeitaria|cacau show|kopenhagen|chocolates?|acai|bomboniere|conveniencia|churros|pipoca)\b/, 'snacks', 'Cafés, doces e mimos'],
  [/\b(cemig|copasa|gasmig|enel|cpfl|light|sabesp|sanepar|comgas|ultragaz|liquigas|claro|vivo|tim|oi fibra|algar|net virtua|internet|fibra|telefonia)\b/, 'contas', 'Contas de consumo'],
  [/\b(aluguel|condominio|iptu|quinto ?andar|loft|imobiliaria|taxa condominial)\b/, 'moradia', 'Moradia'],
  [/\b(netflix|spotify|amazon prime|prime video|disney|hbo|max\.com|youtube premium|google one|icloud|apple\.com|deezer|globoplay|paramount|crunchyroll|chatgpt|openai|anthropic|claude\.ai|microsoft|xbox|playstation|psn|steam|nintendo)\b/, 'servicos', 'Assinaturas & digitais'],
  [/\b(drogasil|droga raia|raia|drogaria|farmacia|pacheco|araujo|panvel|ultrafarma|pague menos)\b/, 'farmacia', 'Farmácia & higiene'],
  [/\b(smart ?fit|bluefit|academia|gympass|wellhub|totalpass|crossfit|pilates)\b/, 'saude', 'Academia'],
  [/\b(hospital|laboratorio|hermes pardini|fleury|lavoisier|consultorio|clinica|medico|odonto|dentista|psicolog|unimed|amil|hapvida|bradesco saude)\b/, 'saude', 'Saúde'],
  [/\b(cinema|cinemark|cineart|cinepolis|uci|ingresso|sympla|eventim|teatro|show|museu|parque|balada|boate|bar|boteco|pub|choperia|cervejaria)\b/, 'lazer', 'Lazer & saídas'],
  [/\b(alura|udemy|coursera|faculdade|ufmg|mensalidade escolar|curso|livraria|leitura|saraiva|amazon kindle|kindle)\b/, 'educacao', 'Educação'],
  [/\b(aplicacao|caixinha|cdb|rdb|tesouro|lci|lca|corretora|xp invest|rico|clear|nuinvest|invest)\b/, 'investimentos', 'Aplicações'],
  [/\b(iof|tarifa|anuidade|juros|encargos|multa)\b/, 'servicos', 'Tarifas & encargos'],
];

const REGRAS_CREDITO: Regra[] = [
  [/\b(salario|folha|pro ?labore|pagamento de salario|vencimentos|governo do estado|estado de minas)\b/, 'receitas', 'Salário'],
  [/\b(rendimento|juros|dividendo|resgate)\b/, 'investimentos', 'Rendimentos e resgates'],
  [/\b(estorno|reembolso|cashback|devolucao)\b/, 'receitas', 'Estornos e cashback'],
];

const INTERNA = /\b(transferencia entre contas|transf entre contas|mesma titularidade|entre minhas contas|aplicacao caixinha|resgate caixinha|pagamento de fatura|pagamento fatura)\b/;

export function classificarPorRegras(desc: string, type: 'credit' | 'debit', nomeTitular = ''): { category: string; subcategory: string } | null {
  const d = semAcento(desc).toLowerCase();
  if (INTERNA.test(d)) return { category: 'transacao_interna', subcategory: 'Entre contas próprias' };
  const titular = semAcento(nomeTitular).toLowerCase().trim();
  if (titular.length >= 5 && d.includes(titular)) return { category: 'transacao_interna', subcategory: 'Entre contas próprias' };
  for (const [re, category, subcategory] of type === 'credit' ? REGRAS_CREDITO : REGRAS_DEBITO) {
    if (re.test(d)) return { category, subcategory };
  }
  return null;
}

// ------------------------------------------------------------------ orquestração (camadas 1 a 3)

export interface Separacao<T extends TxBasica = TxBasica> {
  /** já resolvidos sem IA */
  resolvidos: Map<string, Classificacao>;
  /** precisam da IA */
  pendentes: T[];
}

/**
 * Aplica você → memória → regras. O que nenhuma camada resolve fica em `pendentes` para a IA.
 */
export function separar<T extends TxBasica>(alvo: T[], todas: TxBasica[], categoriasValidas: Set<string>, nomeTitular = ''): Separacao<T> {
  const memoria = montarMemoria(todas);
  const resolvidos = new Map<string, Classificacao>();
  const pendentes: T[] = [];
  for (const t of alvo) {
    if (ehManual(t)) continue;
    const k = chaveEstabelecimento(t.description);
    const m = k ? memoria.get(k) : undefined;
    if (m && categoriasValidas.has(m.category)) {
      resolvidos.set(t.id, {
        category: m.category,
        subcategory: m.subcategory,
        categorizedBy: 'memoria',
        confidence: 0.99,
        reason: `Você classificou "${m.exemplo}" assim${m.vezes > 1 ? ` (${m.vezes} vezes)` : ''}.`,
      });
      continue;
    }
    const r = classificarPorRegras(t.description, t.type, nomeTitular);
    if (r && categoriasValidas.has(r.category)) {
      resolvidos.set(t.id, { ...r, categorizedBy: 'regras', confidence: 0.9, reason: 'Estabelecimento conhecido.' });
      continue;
    }
    pendentes.push(t);
  }
  return { resolvidos, pendentes };
}

// ------------------------------------------------------------------ 4: IA (montagem do pedido; usado no servidor)

/** Descrição de cada categoria padrão para a IA (categorias criadas por você vão só com o nome). */
export const DICAS_CATEGORIA: Record<string, string> = {
  alimentacao: 'mercado, supermercado, padaria, açougue, restaurantes, almoço, lanchonete, delivery de comida',
  snacks: 'cafés, doces, sorvete, açaí, chocolate, conveniência: pequenos mimos fora das refeições',
  transporte: 'Uber, 99, táxi, combustível, estacionamento, pedágio, ônibus, metrô',
  contas: 'energia (Cemig), água (Copasa), gás, internet, celular',
  moradia: 'aluguel, condomínio, IPTU, manutenção da casa',
  servicos: 'assinaturas digitais e streaming, apps, tarifas bancárias',
  compras: 'lojas físicas e online, roupas, eletrônicos, marketplaces (Mercado Livre, Amazon, Shopee)',
  farmacia: 'farmácias e drogarias, remédios, higiene pessoal',
  saude: 'médicos, exames, dentista, plano de saúde, academia',
  lazer: 'bares, cinema, shows, ingressos, passeios, viagens',
  educacao: 'cursos, faculdade, livros, material de estudo',
  investimentos: 'aplicações, aportes, resgates e rendimentos',
  receitas: 'salário, Pix recebido de terceiros, reembolsos, vendas',
  transacao_interna: 'transferência entre contas do próprio usuário (não é gasto)',
  outros: 'use só quando não houver pista nenhuma',
};

export interface ItemParaIA {
  id: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  canal?: string;
  quando?: string;
  conta?: string;
}

export interface ExemploParaIA {
  descricao: string;
  categoria: string;
  subcategoria?: string;
}

export function itemParaIA(t: TxBasica): ItemParaIA {
  const quando = t.date ? `${t.date}${t.time ? ` ${t.time.slice(0, 5)}` : ''}` : undefined;
  return {
    id: t.id,
    descricao: ocultarPessoas(t.description).slice(0, 120),
    valor: Math.abs(Math.round(t.amount * 100) / 100),
    tipo: t.amount >= 0 ? 'entrada' : 'saida',
    canal: t.channel,
    quando,
    conta: t.accountPurpose ? t.accountPurpose.slice(0, 60) : undefined,
  };
}

/** Exemplos para a IA: o que você classificou, um por estabelecimento, até `max`. */
export function exemplosParaIA(todas: TxBasica[], max = 60): ExemploParaIA[] {
  const out: ExemploParaIA[] = [];
  for (const [, r] of montarMemoria(todas)) {
    out.push({ descricao: ocultarPessoas(r.exemplo).slice(0, 80), categoria: r.category, subcategoria: r.subcategory });
  }
  return out.slice(-max);
}

export function montarInstrucoes(categorias: CategoriaBasica[], exemplos: ExemploParaIA[]): string {
  const lista = categorias.map((c) => `- ${c.id}: ${c.name}${DICAS_CATEGORIA[c.id] ? ` — ${DICAS_CATEGORIA[c.id]}` : ''}`).join('\n');
  const ex = exemplos.length
    ? `\nCOMO ESTA PESSOA CLASSIFICA (siga o mesmo critério para estabelecimentos parecidos):\n${exemplos.map((e) => `- "${e.descricao}" → ${e.categoria}${e.subcategoria ? ` / ${e.subcategoria}` : ''}`).join('\n')}\n`
    : '';
  return `Você classifica lançamentos bancários de uma pessoa em Belo Horizonte (MG, Brasil).

CATEGORIAS (use só estes ids):
${lista}
${ex}
REGRAS
1. Decida pelo estabelecimento. Descrições vêm abreviadas (ex.: "IFD*", "PAG*", "MP*" são intermediadores de pagamento; olhe o nome depois do asterisco).
2. Os exemplos acima valem mais que o seu palpite: se um estabelecimento parecido aparece lá, use a mesma categoria.
3. "saida" nunca é receitas. "entrada" é receitas, investimentos (rendimento/resgate) ou transacao_interna.
4. Pix ou transferência para "[pessoa]" sem outra pista: use "outros" com confiança baixa. Não invente o motivo.
5. Valor e horário ajudam: R$ 8 às 15h numa cafeteria é snack; R$ 35 às 12h30 num restaurante é almoço (alimentacao).
6. Na dúvida real, use "outros" e confiança abaixo de 0,5. Não chute com confiança alta.
7. subcategoria: 2 a 4 palavras em português (ex.: "Almoço no trabalho", "Mercado do mês").
8. motivo: uma frase curta.`;
}

/** Valida a resposta da IA: id existe, categoria válida, confiança entre 0 e 1. */
export function validarRespostaIA(
  bruto: unknown,
  ids: Set<string>,
  categoriasValidas: Set<string>,
): Map<string, Classificacao> {
  const out = new Map<string, Classificacao>();
  const lista = (bruto as { results?: unknown[] })?.results;
  if (!Array.isArray(lista)) return out;
  for (const r of lista as Record<string, unknown>[]) {
    const id = String(r?.id ?? '');
    const cat = String(r?.category ?? '');
    if (!ids.has(id) || !categoriasValidas.has(cat)) continue;
    const conf = Math.max(0, Math.min(1, Number(r.confidence ?? 0.6)));
    out.set(id, {
      category: cat,
      subcategory: typeof r.subcategory === 'string' ? r.subcategory.slice(0, 60) : undefined,
      categorizedBy: 'ia',
      confidence: conf,
      reason: typeof r.reason === 'string' ? r.reason.slice(0, 200) : 'Classificado pela IA.',
    });
  }
  return out;
}
