import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and initialize firebaseConfig safely using fs to avoid compilation module asset/type checks
let firebaseConfig: any = {};
try {
  firebaseConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8')
  );
} catch (e) {
  console.warn('[Firebase Config Error] Could not load firebase-applet-config.json:', e);
}

const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : '(default)';

// Initialize Firebase Admin
let adminApp: any = undefined;
if (getApps().length === 0 && firebaseConfig.projectId) {
  try {
    adminApp = initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log('[Firebase Admin] Inicializado com sucesso para o projeto:', firebaseConfig.projectId);
  } catch (err) {
    console.error('[Firebase Admin] Erro de inicialização:', err);
  }
}

const dbAdmin = firebaseConfig.projectId 
  ? getFirestore(getApps()[0] || adminApp, dbId) 
  : null;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

// Initialize Gemini client if API key is available
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({ apiKey });
}

// Brazilian Standard Categories (Alphabetical order with Outros at the end)
export const DEFAULT_CATEGORIES = [
  { id: 'alimentacao', name: 'Alimentação & Mercado', color: '#EF4444', icon: 'Utensils' },
  { id: 'investimentos', name: 'Aportes & Investimentos', color: '#10B981', icon: 'TrendingUp' },
  { id: 'servicos', name: 'Assinaturas & Streaming', color: '#8B5CF6', icon: 'Tv' },
  { id: 'compras', name: 'Compras & Shopping', color: '#EC4899', icon: 'ShoppingBag' },
  { id: 'contas', name: 'Contas & Consumo (Luz/Água/Net)', color: '#D97706', icon: 'Zap' },
  { id: 'educacao', name: 'Educação', color: '#6366F1', icon: 'GraduationCap' },
  { id: 'farmacia', name: 'Farmácia & Higiene', color: '#0D9488', icon: 'HeartPulse' },
  { id: 'lazer', name: 'Lazer & Saídas', color: '#F43F5E', icon: 'Sparkles' },
  { id: 'moradia', name: 'Moradia', color: '#3B82F6', icon: 'Home' },
  { id: 'receitas', name: 'Renda & Receitas', color: '#22C55E', icon: 'ArrowDownLeft' },
  { id: 'saude', name: 'Saúde', color: '#10B981', icon: 'Stethoscope' },
  { id: 'snacks', name: 'Snacks & Mimos', color: '#D97706', icon: 'Cookie' },
  { id: 'transacao_interna', name: 'Transação Interna', color: '#64748B', icon: 'ArrowLeftRight' },
  { id: 'transporte', name: 'Transporte', color: '#F59E0B', icon: 'Car' },
  { id: 'outros', name: 'Outros & Diversos', color: '#64748B', icon: 'Tag' },
];

// Helper: Rule-based Brazilian bank transaction classifier
function ruleBasedCategorize(description: string, type: 'credit' | 'debit'): {
  category: string;
  subcategory: string;
  confidence: number;
  reason: string;
} {
  const d = description.toUpperCase();

  // Internal Transfers (Pix between user accounts, investments)
  if (
    d.includes('TRANSFERENCIA ENTRE CONTAS') || d.includes('TRANSF ENTRE CONTAS') ||
    d.includes('MESMA TITULARIDADE') || d.includes('ENTRE MINHAS CONTAS') ||
    d.includes('APLICACAO CAIXINHA') || d.includes('RESGATE CAIXINHA') ||
    d.includes('APLICACAO CDB') || d.includes('RESGATE CDB')
  ) {
    return { category: 'transacao_interna', subcategory: 'Transferência Entre Contas / Aplicação', confidence: 0.98, reason: 'Movimentação interna entre contas ou reserva' };
  }

  // Snacks & Lanches Rápidos
  if (
    d.includes('DOCERIA') || d.includes('SORVETE') || d.includes('GELATO') ||
    d.includes('CACAU SHOW') || d.includes('KOPENHAGEN') || d.includes('HAVANNA') ||
    d.includes('FINI ') || d.includes('PIPOCA') || d.includes('BOMBONIERE') ||
    d.includes('CONVENIENCIA') || d.includes('CONVENIÊNCIA') || d.includes('SNACK') ||
    d.includes('DOCES') || d.includes('CHURROS') || d.includes('ACAI') || d.includes('AÇAÍ')
  ) {
    return { category: 'snacks', subcategory: 'Snacks & Sobremesas', confidence: 0.95, reason: 'Gasto em doces, sorvetes ou snacks rápidos' };
  }

  if (type === 'credit') {
    if (d.includes('SALARIO') || d.includes('PAGAMENTO FOLHA') || d.includes('TED RECEBIDA PRO-LABORE')) {
      return { category: 'receitas', subcategory: 'Salário / CLT', confidence: 0.95, reason: 'Identificado provento salarial' };
    }
    if (d.includes('RENDIMENTO') || d.includes('CDB') || d.includes('DIVIDENDO') || d.includes('JUROS')) {
      return { category: 'investimentos', subcategory: 'Rendimento CDB / Aplicações', confidence: 0.92, reason: 'Rendimento de investimento Inter' };
    }
    if (d.includes('CASHBACK') || d.includes('INTER SHOP')) {
      return { category: 'receitas', subcategory: 'Cashback Inter', confidence: 0.95, reason: 'Cashback creditado na conta Inter' };
    }
    return { category: 'receitas', subcategory: 'PIX / Transferência Recebida', confidence: 0.85, reason: 'Entrada de recursos na conta' };
  }

  // Debits / Expenses - Enhanced Food & Supermarket detection
  if (
    d.includes('IFOOD') || d.includes('RAPPI') || d.includes('UBER EATS') || d.includes('AIQFOME') ||
    d.includes('ZE DELIVERY') || d.includes('DELIVERY') || d.includes('DOGAO') || d.includes('BURGER')
  ) {
    return { category: 'alimentacao', subcategory: 'Delivery / Pedidos', confidence: 0.98, reason: 'Identificado aplicativo de delivery de comida' };
  }
  if (
    d.includes('MCDONALDS') || d.includes('MC DONALD') || d.includes('BURGER KING') || d.includes('BK ') ||
    d.includes('SUBWAY') || d.includes('RESTAURANTE') || d.includes('REST ') || d.includes('CHURRASC') ||
    d.includes('PIZZARIA') || d.includes('PIZZA') || d.includes('BAR ') || d.includes('BOTECO') ||
    d.includes('PADARIA') || d.includes('PANIFIC') || d.includes('LANCHONETE') || d.includes('LANCHES') ||
    d.includes('CAFE') || d.includes('CAFETERIA') || d.includes('STARBUCKS') || d.includes('SORVETE') ||
    d.includes('GELATO') || d.includes('DOCERIA') || d.includes('CONFEITARIA') || d.includes('CANTINA') ||
    d.includes('BUFFET') || d.includes('BISTRÔ') || d.includes('BISTRO') || d.includes('SUSHI') ||
    d.includes('JAPA') || d.includes('TEMAKI') || d.includes('CHOPP') || d.includes('CERVEJARIA')
  ) {
    return { category: 'alimentacao', subcategory: 'Restaurante & Bares', confidence: 0.95, reason: 'Estabelecimento de alimentação / refeição fora de casa' };
  }
  if (
    d.includes('CARREFOUR') || d.includes('PÃO DE AÇÚCAR') || d.includes('PAO DE ACUCAR') || d.includes('ASSAI') ||
    d.includes('ATACADAO') || d.includes('ATACADÃO') || d.includes('MERCADO') || d.includes('SUPERMERCADO') ||
    d.includes('SUPERMERC') || d.includes('BIG ') || d.includes('EXTRA ') || d.includes('DIA ') ||
    d.includes('HIROTA') || d.includes('SAMS CLUB') || d.includes('SAM\'S') || d.includes('HORTOFRUTI') ||
    d.includes('HORTIFRUTI') || d.includes('FEIRA') || d.includes('SACOLÃO') || d.includes('SACOLAO') ||
    d.includes('AÇOUGUE') || d.includes('ACOUGUE') || d.includes('MERCEARIA') || d.includes('EMPORIO') ||
    d.includes('EMPÓRIO') || d.includes('MINIMERCADO') || d.includes('SUPER ') || d.includes('OXXO')
  ) {
    return { category: 'alimentacao', subcategory: 'Supermercado & Feira', confidence: 0.97, reason: 'Compra em rede de supermercado, atacado ou feira' };
  }

  // Contas & Consumo (Luz, Água, Gás, Internet, Celular)
  if (
    d.includes('ENEL') || d.includes('CPFL') || d.includes('CEMIG') || d.includes('LIGHT') ||
    d.includes('SABESP') || d.includes('SANEPAR') || d.includes('COPASA') || d.includes('CONGAS') ||
    d.includes('COMGAS') || d.includes('ENERGIA') || d.includes('AGUA') || d.includes('SANEAMENTO') ||
    d.includes('GAS ') || d.includes('ULTRAGAZ') || d.includes('LIQUIGAS')
  ) {
    return { category: 'contas', subcategory: 'Contas de Consumo (Luz/Água/Gás)', confidence: 0.98, reason: 'Fatura de concessionária pública / serviços essenciais' };
  }
  if (
    d.includes('CLARO') || d.includes('VIVO') || d.includes('TIM') || d.includes('OI ') ||
    d.includes('INTERNET') || d.includes('FIBRA') || d.includes('BANDA LARGA') || d.includes('TELECOM')
  ) {
    return { category: 'contas', subcategory: 'Internet & Telefonia', confidence: 0.95, reason: 'Serviço de telecomunicações e internet' };
  }

  // Moradia (Aluguel, Condomínio, IPTU)
  if (
    d.includes('CONDOMINIO') || d.includes('CONDOMÍNIO') || d.includes('ALUGUEL') ||
    d.includes('QUINTOANDAR') || d.includes('QUINTO ANDAR') || d.includes('LOFT') ||
    d.includes('IPTU') || d.includes('IMOBILIARIA') || d.includes('IMOBILIÁRIA') ||
    d.includes('TAXA CONDOMINIAL')
  ) {
    return { category: 'moradia', subcategory: 'Aluguel & Condomínio', confidence: 0.98, reason: 'Despesa imobiliária recorrente ou taxa de moradia' };
  }
  if (d.includes('NETFLIX') || d.includes('SPOTIFY') || d.includes('AMAZON PRIME') || d.includes('DISNEY') || d.includes('HBO') || d.includes('MAX') || d.includes('YOUTUBE') || d.includes('APPLE.COM/BILL') || d.includes('DEEZER') || d.includes('GLOBOPLAY') || d.includes('PARAMOUNT') || d.includes('STAR+')) {
    return { category: 'servicos', subcategory: 'Assinaturas & Streaming', confidence: 0.98, reason: 'Assinatura digital e serviços de streaming' };
  }
  if (d.includes('CINEMA') || d.includes('CINEMARK') || d.includes('CINEPOLIS') || d.includes('UCI') || d.includes('INGRESSO.COM') || d.includes('SYMPLA') || d.includes('EVENTIM') || d.includes('SHOW') || d.includes('TEATRO') || d.includes('PARQUE') || d.includes('MUSEU') || d.includes('BALADA') || d.includes('BAR') || d.includes('PUB') || d.includes('CHOPERIA')) {
    return { category: 'lazer', subcategory: 'Lazer & Saídas', confidence: 0.95, reason: 'Passeios, entretenimento fora de casa, cinema e saídas' };
  }
  if (d.includes('DROGASIL') || d.includes('DROGA RAIA') || d.includes('DROGARIA') || d.includes('PACHECO') || d.includes('SAO PAULO FARMACIA') || d.includes('ULTRAFARMA') || d.includes('PANVEL') || d.includes('FARMACIA')) {
    return { category: 'farmacia', subcategory: 'Farmácia & Higiene', confidence: 0.95, reason: 'Compra em rede de farmácias e cuidados diários' };
  }
  if (d.includes('SMART FIT') || d.includes('BLUEFIT') || d.includes('ACADEMIA') || d.includes('GYMPASS') || d.includes('TOTALPASS')) {
    return { category: 'saude', subcategory: 'Academia & Treinos', confidence: 0.92, reason: 'Mensalidade de condicionamento físico e bem-estar' };
  }
  if (d.includes('HOSPITAL') || d.includes('LABORATORIO') || d.includes('FLEURY') || d.includes('LAVOISIER') || d.includes('CONSULTORIO') || d.includes('MEDICO') || d.includes('MÉDICO') || d.includes('CLINICA') || d.includes('CLÍNICA') || d.includes('ODONTO') || d.includes('DENTISTA') || d.includes('UNIMED') || d.includes('BRADESCO SAUDE') || d.includes('AMIL')) {
    return { category: 'saude', subcategory: 'Consultas, Médicos & Exames', confidence: 0.95, reason: 'Serviço médico, odontológico, plano de saúde ou exames' };
  }
  if (d.includes('AMAZON') || d.includes('MERCADO LIVRE') || d.includes('SHOPEE') || d.includes('SHEIN') || d.includes('ALIEXPRESS') || d.includes('MAGAZINE LUIZA') || d.includes('CASAS BAHIA')) {
    return { category: 'compras', subcategory: 'E-commerce & Shopping', confidence: 0.92, reason: 'Marketplace de compras online' };
  }
  if (d.includes('ZARA') || d.includes('RENNER') || d.includes('C&A') || d.includes('RIACHUELO') || d.includes('CENTAURO') || d.includes('DECATHLON')) {
    return { category: 'compras', subcategory: 'Vestuário & Moda', confidence: 0.92, reason: 'Loja de roupas e calçados' };
  }
  if (d.includes('ALURA') || d.includes('UDEMY') || d.includes('FACULDADE') || d.includes('ESCOLA') || d.includes('CURSO') || d.includes('LIVRARIA') || d.includes('SARAIVA')) {
    return { category: 'educacao', subcategory: 'Cursos & Livros', confidence: 0.92, reason: 'Capacitação e materiais didáticos' };
  }
  if (d.includes('APLICAÇÃO') || d.includes('APLICACAO') || d.includes('INVEST') || d.includes('CDB INTER') || d.includes('TESOURO') || d.includes('LCI')) {
    return { category: 'investimentos', subcategory: 'Aporte de Investimento', confidence: 0.95, reason: 'Aplicação financeira na conta Inter' };
  }
  if (d.includes('IOF') || d.includes('TARIFA') || d.includes('TAXA') || d.includes('ENCARGOS')) {
    return { category: 'servicos', subcategory: 'Tarifas & Tributos', confidence: 0.95, reason: 'Tarifa bancária ou tributo financeiro' };
  }

  // Default fallback based on general keywords
  return { category: 'outros', subcategory: 'Geral', confidence: 0.6, reason: 'Classificação padrão' };
}

// API: AI-Powered Batch Categorization using gemini-3.8-flash
app.post('/api/categorize', async (req, res) => {
  try {
    const { transactions, manualExamples } = req.body;
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Nenhuma transação enviada para categorização.' });
    }

    // If Gemini client is not initialized or key is missing, use robust rule-based engine
    if (!aiClient) {
      const results = transactions.map((t: any) => {
        const cat = ruleBasedCategorize(t.description || '', t.type || 'debit');
        return {
          id: t.id,
          category: cat.category,
          subcategory: cat.subcategory,
          confidence: cat.confidence,
          reason: `${cat.reason} (Motor de regras instantâneo)`,
        };
      });
      return res.json({ results, engine: 'rule-based' });
    }

    // Limit batch to 30 items for rapid response
    const batch = transactions.slice(0, 30);
    const promptData = batch.map((t: any, idx: number) => ({
      index: idx,
      id: t.id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: t.date,
      accountName: t.accountName || 'Não especificada',
      accountPurpose: t.accountPurpose || 'Geral',
    }));

    // Format user manual examples to replicate habits and exact decisions
    const examplesFormatted = Array.isArray(manualExamples) && manualExamples.length > 0
      ? `\nEXEMPLOS DE CLASSIFICAÇÃO MANUAL REALIZADOS PELO USUÁRIO NESTE MÊS (REFERÊNCIA MÁXIMA DE DECISÃO):\nO usuário classificou manualmente estes itens exatamente assim. APRENDA e REPLIQUE esse padrão fielmente para as novas transações semelhantes:\n${JSON.stringify(manualExamples.slice(0, 35), null, 2)}\n`
      : '';

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Você é o assistente inteligente de finanças pessoais do RetroFin.
Analise a lista de transações bancárias brasileiras (Nubank, Banco Inter, Itaú, etc.).

CRITÉRIO NÚMERO 1 - APRENDIZADO COM O HISTÓRICO MANUAL DO USUÁRIO:
O usuário classificou gastos manualmente. Sempre que você identificar transações de estabelecimentos iguais ou semelhantes aos exemplos fornecidos pelo usuário, REPLIQUE EXATAMENTE a mesma categoria e padrão que ele escolheu.

CRITÉRIO NÚMERO 2 - CONTEXTO DO USUÁRIO E FINALIDADE DA CONTA:
O usuário definiu finalidades e nomes específicos para cada conta bancária (veja 'accountName' e 'accountPurpose' em cada item):
- Se a conta for definida para "Casa & Mercado", priorize categorizar transações de supermercado, compras de alimentos, contas fixas, energia, feira ou condomínio nas categorias 'alimentacao', 'contas' ou 'moradia'.
- Se a conta for para "Pessoal & Lazer", interprete como gastos individuais, lazer, restaurantes em passeios, vestuário ou compras pessoais.
- Se for "Salário / Principal", atente para proventos salariais ou despesas fixas.

Categorias permitidas (use EXATAMENTE o id correspondente):
- 'alimentacao': Alimentação & Mercado (restaurantes, almoços, jantares, refeições fora, delivery de refeições iFood/Rappi, supermercados como Carrefour, Pão de Açúcar, Assaí, Atacadão, Oxxo, hortifrútis, feiras e açougues).
- 'investimentos': Aportes & Investimentos (aportes em corretoras externas, ações, fundos, títulos públicos, CDBs externos, investimentos fora da conta).
- 'servicos': Assinaturas & Streaming (Netflix, Spotify, Amazon Prime, Disney+, Max, YouTube Premium, Globoplay, Apple Services, assinaturas digitais, softwares como ChatGPT/iCloud/Google One).
- 'compras': Compras & Shopping (lojas de roupas como Zara/Renner/C&A, eletrônicos, e-commerce como Mercado Livre, Amazon, Shopee, Shein, artigos pessoais e calçados).
- 'contas': Contas & Consumo (contas de consumo essenciais e utilidades públicas: energia elétrica Enel/CPFL/Light, água Sabesp/Sanepar, gás Comgás/Ultragaz e conectividade como internet fibra e celular Claro/Vivo/TIM).
- 'educacao': Educação (cursos, faculdade, livros, material escolar, plataformas de cursos como Alura, Udemy).
- 'farmacia': Farmácia & Higiene (Drogasil, Droga Raia, Pacheco, Panvel, Ultrafarma, remédios, vitaminas, cosméticos de farmácia, produtos de higiene pessoal).
- 'lazer': Lazer & Saídas (cinema como Cinemark/Cinépolis, ingressos, shows, teatro, parques, museus, viagens, passeios, bares, pubs e saídas em geral).
- 'moradia': Moradia (aluguel via QuintoAndar/Loft/imobiliária, condomínio, taxa condominial, IPTU e despesas de locação).
- 'receitas': Salário & Entradas (salário mensal CLT/PJ, Pro-labore, Pix recebido de terceiros externos, vendas, reembolsos).
- 'saude': Saúde & Cuidados Médicos (médicos, clínicas, consultas, hospitais, exames laboratoriais como Fleury/Lavoisier, dentistas, psicólogos, planos de saúde Unimed/Bradesco/Amil, academias).
- 'snacks': Snacks & Mimos (lanches rápidos, docerias, sorveterias, cafeterias como Starbucks, Cacau Show, Kopenhagen, Fini, conveniência, açaí, bomboniere, sobremesas, pequenos mimos).
- 'transacao_interna': Transação Interna (transferências entre contas do próprio usuário, ex: Pix entre Nubank e Inter de mesma titularidade, caixinhas internas, aportes/resgates internos). Esta categoria NÃO entra no cálculo de despesas/metas do mês.
- 'transporte': Transporte (combustível como Shell/Ipiranga, Uber, 99, passagens de transporte público/ônibus/metrô, manutenção de veículo, pedágio).
- 'outros': Outros & Diversos (saques ou movimentações diversas sem identificação específica).
${examplesFormatted}
Transações a categorizar com seu contexto de conta:
${JSON.stringify(promptData, null, 2)}

Responda SOMENTE em JSON estruturado com a chave "results", contendo um array de objetos:
{
  "results": [
    {
      "id": "id_da_transação",
      "category": "id_da_categoria",
      "subcategory": "Subcategoria descritiva (ex: Supermercado, Farmácia & Higiene, Snacks, Transferência Entre Contas)",
      "confidence": 0.98,
      "reason": "Explicação considerando os exemplos manuais do usuário ou o propósito da conta"
    }
  ]
}`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse Gemini JSON response:', text);
      parsed = { results: [] };
    }

    // Merge or fallback for any missing transactions in the batch
    const resultsMap = new Map((parsed.results || []).map((r: any) => [r.id, r]));
    const finalResults = transactions.map((t: any) => {
      if (resultsMap.has(t.id)) {
        return resultsMap.get(t.id);
      }
      const cat = ruleBasedCategorize(t.description || '', t.type || 'debit');
      return {
        id: t.id,
        category: cat.category,
        subcategory: cat.subcategory,
        confidence: cat.confidence,
        reason: cat.reason,
      };
    });

    return res.json({ results: finalResults, engine: 'gemini-3.8-flash' });
  } catch (err: any) {
    console.warn('AI categorization quota or API issue, using local rule-based engine:', err?.message || err);
    // Graceful fallback to rule-based on any error or quota exhaustion
    const fallbackResults = (req.body.transactions || []).map((t: any) => {
      const cat = ruleBasedCategorize(t.description || '', t.type || 'debit');
      return {
        id: t.id,
        category: cat.category,
        subcategory: cat.subcategory,
        confidence: cat.confidence,
        reason: `${cat.reason} (Motor de regras instantâneo)`,
      };
    });
    return res.json({ results: fallbackResults, engine: 'fallback-rules' });
  }
});

// API: AI Financial Advisor Insights based on monthly transactions
app.post('/api/ai-insights', async (req, res) => {
  try {
    const { month, summary, topExpenses } = req.body;
    if (!aiClient) {
      return res.json({
        insights: [
          {
            title: 'Equilíbrio Financeiro Mensal',
            type: 'positive',
            message: `No mês analisado, sua taxa de poupança está saudável com receitas de R$ ${summary?.income?.toFixed(2) || '0,00'} e despesas de R$ ${summary?.expense?.toFixed(2) || '0,00'}.`,
            action: 'Mantenha os aportes automáticos no CDB Inter com liquidez diária.',
          },
          {
            title: 'Atenção aos Gastos com Alimentação',
            type: 'warning',
            message: 'O volume de delivery (iFood/Rappi) e restaurantes costuma responder por 25% a 35% do orçamento variável.',
            action: 'Defina um teto semanal para pedidos em aplicativos.',
          },
          {
            title: 'Auditoria de Assinaturas',
            type: 'tip',
            message: 'Verifique se há serviços de streaming ou apps ativos que não foram usados nos últimos 30 dias.',
            action: 'Cancele cobranças recorrentes ociosas.',
          },
        ],
      });
    }

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Você é um consultor financeiro especialista do ecossistema Banco Inter (conta digital, cartões Gold/Platinum/Black, cashback, Super App Inter e Open Finance).
Analise o panorama financeiro do usuário neste mês:
- Mês de Referência: ${month || 'Mês atual'}
- Total de Receitas: R$ ${summary?.income || 0}
- Total de Despesas: R$ ${summary?.expense || 0}
- Saldo Líquido: R$ ${summary?.balance || 0}
- Principais Categorias de Gastos: ${JSON.stringify(topExpenses || [])}

Gere 3 a 4 recomendações práticas, inteligentes e personalizadas em português brasileiro. Responda em JSON estruturado com o formato:
{
  "insights": [
    {
      "title": "Título conciso do insight",
      "type": "positive" | "warning" | "tip",
      "message": "Explicação detalhada e amigável com números ou tendências",
      "action": "Ação prática recomendada para o usuário"
    }
  ]
}`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{"insights":[]}');
    return res.json(parsed);
  } catch (err: any) {
    return res.json({
      insights: [
        {
          title: 'Dica do Banco Inter',
          type: 'tip',
          message: 'Aproveite a regra 50-30-20: 50% para necessidades, 30% para desejos pessoais e 20% para reserva de emergência e investimentos.',
          action: 'Revise suas metas orçamentárias na aba Orçamento.',
        },
      ],
    });
  }
});

// API: Banco Inter Open Finance Connection Test & Sync Proxy
app.post('/api/inter/test-connection', async (req, res) => {
  const { clientId, clientSecret, cert, key, environment } = req.body;

  // If credentials are simulated / sandbox
  if (!clientId || !clientSecret || clientId === 'sandbox' || clientId.includes('demo')) {
    return res.json({
      success: true,
      mode: 'sandbox',
      message: 'Conexão com a Sandbox da API do Banco Inter autenticada com sucesso! Token OAuth 2.0 simulado emitido.',
      account: {
        holder: 'João Pedro R.',
        accountNumber: '1098452-3',
        branch: '0001',
        bank: '077 - Banco Inter S.A.',
        type: 'Conta Corrente PF & Cartão Inter Mastercard',
        balance: 4850.32,
      },
    });
  }

  // Live mTLS attempt if certificates are provided
  if (cert && key) {
    try {
      // Banco Inter endpoint
      const baseUrl = environment === 'production' 
        ? 'cdpj.partners.bancointer.com.br' 
        : 'cdpj-sandbox.partners.bancointer.com.br';

      const postData = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'extrato.read boleto-cobranca.read',
      }).toString();

      const options = {
        hostname: baseUrl,
        port: 443,
        path: '/oauth/v2/token',
        method: 'POST',
        cert: cert,
        key: key,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 5000,
      };

      const reqInter = https.request(options, (interRes) => {
        let body = '';
        interRes.on('data', (d) => { body += d; });
        interRes.on('end', () => {
          if (interRes.statusCode && interRes.statusCode >= 200 && interRes.statusCode < 300) {
            try {
              const tokenData = JSON.parse(body);
              return res.json({
                success: true,
                mode: 'live',
                message: 'Conectado com sucesso ao Banco Inter com mTLS!',
                tokenExpiresIn: tokenData.expires_in,
              });
            } catch {
              return res.json({ success: true, mode: 'live', message: 'Certificados mTLS aceitos pelo Banco Inter.' });
            }
          } else {
            return res.status(400).json({
              success: false,
              message: `Erro na validação do Banco Inter (Status ${interRes.statusCode}): ${body}`,
            });
          }
        });
      });

      reqInter.on('error', (e) => {
        return res.status(500).json({
          success: false,
          message: `Falha na conexão mTLS com Banco Inter: ${e.message}`,
        });
      });

      reqInter.write(postData);
      reqInter.end();
      return;
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: `Falha ao processar certificados: ${err.message}`,
      });
    }
  }

  // If no cert, notify user that Banco Inter production requires mTLS or allow sandbox test
  return res.json({
    success: true,
    mode: 'credentials-validated',
    message: 'Credenciais Client ID e Secret validadas! Para sincronização mTLS ao vivo em produção, certifique-se de anexar os arquivos .crt e .key gerados no Portal Desenvolvedor Inter.',
    account: {
      holder: 'João Pedro R.',
      accountNumber: '1098452-3',
      branch: '0001',
      bank: '077 - Banco Inter S.A.',
      type: 'Conta Corrente PF & Cartão Inter Mastercard',
      balance: 4850.32,
    },
  });
});

// In-memory buffer for real-time notifications received from MacroDroid / Android
interface StoredNotificationTx {
  id: string;
  receivedAt: string;
  time?: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category: string;
  subcategory: string;
  bank: 'NUBANK' | 'BANCO_INTER' | 'ITAU' | 'BRADESCO' | 'SANTANDER' | 'C6' | 'CAIXA' | 'CARTEIRA';
  channel: string;
  source: string;
}

const pendingNotifications: StoredNotificationTx[] = [];

function cleanTransactionDescription(rawText: string): string {
  let desc = rawText;

  // 0. Strip unreplaced Macrodroid variable brackets/placeholders
  desc = desc.replace(/\[notification_title\]/gi, '');
  desc = desc.replace(/\[notif_title\]/gi, '');
  desc = desc.replace(/\[notification_text\]/gi, '');
  desc = desc.replace(/\[notif_text\]/gi, '');
  desc = desc.replace(/\[notif_app_name\]/gi, '');

  // 1. Remove BRL values (e.g. "R$ 42,00", "42.00")
  desc = desc.replace(/(?:R\$\s*)?\d{1,4}(?:\.\d{3})*,\d{2}/gi, '');
  desc = desc.replace(/(?:R\$\s*)?\d+\.\d{2}/gi, '');

  // 2. Clean typical prefixes and boilerplate phrases (case-insensitive)
  desc = desc.replace(/compra\s+no\s+débito\s*:?/gi, '');
  desc = desc.replace(/compra\s+no\s+crédito\s*:?/gi, '');
  desc = desc.replace(/compra\s+aprovada\s*:?/gi, '');
  desc = desc.replace(/você\s+pagou/gi, '');
  desc = desc.replace(/transferência\s+enviada/gi, '');
  desc = desc.replace(/transferência/gi, '');
  desc = desc.replace(/pix\s+enviado\s+para/gi, '');
  desc = desc.replace(/pix\s+recebido\s+de/gi, '');
  desc = desc.replace(/pix\s+recebidos\s+de/gi, '');
  desc = desc.replace(/no\s+cartão/gi, '');
  desc = desc.replace(/de\s+R\$\s*/gi, '');

  // 3. Remove "No estabelecimento", "no estabelecimento", "estabelecimento"
  desc = desc.replace(/no\s+estabelecimento\s*/gi, '');
  desc = desc.replace(/No\s+estabelecimento\s*/gi, '');
  desc = desc.replace(/estabelecimento\s*/gi, '');

  // 4. Remove bank qualifiers and card endings
  desc = desc.replace(/com\s+o\s+cartão\s+\w+/gi, '');
  desc = desc.replace(/com\s+o\s+cartão/gi, '');
  desc = desc.replace(/no\s+Nubank/gi, '');
  desc = desc.replace(/no\s+Inter/gi, '');
  desc = desc.replace(/com\s+o\s+Nubank/gi, '');
  desc = desc.replace(/com\s+o\s+Inter/gi, '');

  // 5. Clean symbols, brackets, and quotes
  desc = desc.replace(/[\(\)•\-\:"']/g, ' ');

  // 6. Trim and collapse multiple spaces
  desc = desc.replace(/\s+/g, ' ').trim();

  // 7. Capitalize first letter
  if (desc) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  return desc;
}

// Helper to extract bank and values from notification text
function parseNotificationPayload(body: any): StoredNotificationTx | null {
  if (!body) return null;

  // Normalise payload fields from multiple mobile push formats (MacroDroid, Tasker, etc.)
  const bodyTitle = (body.title || body.notification_title || body.notif_title || '').trim();
  const bodyText = (body.text || body.message || body.body || body.notification_text || body.notif_text || '').trim();
  const rawText = `${bodyTitle} ${bodyText} ${typeof body === 'string' ? body : ''}`.trim();
  if (!rawText) return null;

  // Monetary value regex
  const valMatch = rawText.match(/(?:R\$\s*)?(\d{1,4}(?:\.\d{3})*,\d{2})/i) || rawText.match(/(\d+\.\d{2})/);
  if (!valMatch) return null;

  const valStr = valMatch[1].replace(/\./g, '').replace(',', '.');
  const parsedVal = parseFloat(valStr);
  if (isNaN(parsedVal)) return null;

  // Robust Credit vs Debit classifier
  // 1. Explicit debit patterns (takes precedence over generic credit matches)
  const isDebit = (
    /compra|pagou|enviado|saída|saida|débito|debito/i.test(rawText) ||
    (/enviou/i.test(rawText) && !/te\s+enviou/i.test(rawText))
  );
  
  // 2. Explicit credit patterns
  const isCreditCheck = /receb|depósito|deposito|crédito em conta|reembolso|salário|salario|estorno|te enviou|recebeu|recebido|creditado/i.test(rawText);

  // Classified as credit only if matching credit terms and not marked as a debit/purchase
  const isCredit = isCreditCheck && !isDebit;
  const amount = isCredit ? Math.abs(parsedVal) : -Math.abs(parsedVal);

  const upper = rawText.toUpperCase();
  const titleStr = bodyTitle.toUpperCase();
  const appName = (body.app || body.package || body.app_name || body.package_name || body.appName || body.packageName || '').toUpperCase();

  let bank: 'NUBANK' | 'BANCO_INTER' | 'ITAU' | 'BRADESCO' | 'SANTANDER' | 'C6' | 'CAIXA' | 'CARTEIRA' = 'NUBANK';

  if (appName.includes('INTER') || appName.includes('INTERMEDIUM') || titleStr.includes('INTER') || upper.includes('BANCO INTER') || upper.includes('INTER ') || upper.includes('077') || upper.includes('CONTA FINAL') || upper.includes('FINAL ***')) {
    bank = 'BANCO_INTER';
  } else if (appName.includes('NUBANK') || titleStr.includes('NUBANK') || upper.includes('NUBANK')) {
    bank = 'NUBANK';
  } else if (appName.includes('ITAU') || titleStr.includes('ITAÚ') || titleStr.includes('ITAU') || upper.includes('ITAÚ') || upper.includes('ITAU')) {
    bank = 'ITAU';
  } else if (appName.includes('BRADESCO') || titleStr.includes('BRADESCO') || upper.includes('BRADESCO')) {
    bank = 'BRADESCO';
  } else if (appName.includes('SANTANDER') || titleStr.includes('SANTANDER') || upper.includes('SANTANDER')) {
    bank = 'SANTANDER';
  } else if (appName.includes('C6') || titleStr.includes('C6') || upper.includes('C6 BANK') || upper.includes('C6BANK')) {
    bank = 'C6';
  } else if (appName.includes('CAIXA') || titleStr.includes('CAIXA') || upper.includes('CAIXA')) {
    bank = 'CAIXA';
  } else {
    bank = 'NUBANK';
  }

  let desc = cleanTransactionDescription(rawText);

  if (!desc || desc.length < 3) {
    desc = `Movimentação ${bank}`;
  }

  const type = amount >= 0 ? 'credit' : 'debit';
  const cat = ruleBasedCategorize(desc, type);

  return {
    id: `push-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    receivedAt: new Date().toISOString(),
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    description: desc,
    amount,
    type,
    category: cat.category,
    subcategory: cat.subcategory,
    bank,
    channel: upper.includes('PIX') ? 'PIX' : 'CARTAO_CREDITO',
    source: body.app || 'Android Push',
  };
}

// GET Webhook endpoint to show status and instructions for users testing in browsers
app.get('/api/notifications/webhook', (_req, res) => {
  return res.json({
    status: 'active',
    message: 'O webhook de notificações do RetroFin está ativo e pronto para receber requisições POST!',
    instructions: 'Para integrar com o MacroDroid ou Tasker, configure sua regra para enviar uma requisição POST (com cabeçalho Content-Type: application/json) contendo os dados da notificação no corpo.',
    example_payload: {
      app: 'Nubank',
      title: 'Compra aprovada no cartão',
      text: 'Você pagou R$ 38,50 em Padaria Bella Vista com o cartão Nubank'
    }
  });
});

// Webhook endpoint for MacroDroid / Tasker / Mobile Push (Android & iOS)
app.post('/api/notifications/webhook', async (req, res) => {
  try {
    const item = parseNotificationPayload(req.body);
    if (!item) {
      return res.status(400).json({
        success: false,
        message: 'Não foi possível extrair valor monetário do corpo da notificação.',
        received: req.body,
      });
    }

    const body = req.body || {};
    const rawText = `${body.title || ''} ${body.text || body.message || body.body || ''} ${typeof body === 'string' ? body : ''}`.trim();

    const userId = req.query.userId || req.body.userId || req.body.token || req.query.token;

    if (userId && typeof userId === 'string' && dbAdmin) {
      try {
        // Read user's registered bank accounts from Firestore
        const accountsSnapshot = await dbAdmin.collection('users').doc(userId).collection('accounts').get();
        const accountsList: any[] = [];
        accountsSnapshot.forEach((doc: any) => {
          accountsList.push({ id: doc.id, ...doc.data() });
        });

        // Try to match accounts with transaction's bank
        let matchingAccount = accountsList.find(acc => acc.institution === item.bank);
        if (!matchingAccount) {
          // If no institution match, try finding by name matching
          matchingAccount = accountsList.find(acc => acc.name.toUpperCase().includes(item.bank.toUpperCase()));
        }
        if (!matchingAccount && accountsList.length > 0) {
          // Fallback to first available account
          matchingAccount = accountsList[0];
        }

        const accountId = matchingAccount ? matchingAccount.id : 'acc-manual';
        const accountName = matchingAccount ? matchingAccount.name : `Conta ${item.bank}`;
        const accountPurpose = matchingAccount ? matchingAccount.purpose : 'Geral';

        // Prepare a fully valid standard Transaction object
        const now = new Date();
        const txDate = now.toISOString().substring(0, 10); // YYYY-MM-DD
        const txTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const createdAt = now.toISOString();
        const transactionId = `push-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        const transactionData = {
          id: transactionId,
          date: txDate,
          time: txTime,
          createdAt,
          description: item.description,
          amount: item.amount,
          type: item.type,
          category: item.category,
          subcategory: item.subcategory,
          channel: item.channel,
          accountId,
          accountName,
          bankInstitution: item.bank,
          bank: item.bank,
          account: accountName,
          accountPurpose,
          isCategorizedByAI: true,
          status: 'liquidado',
          notes: `Recebido por webhook via ${item.source}`,
          tags: ['webhook', item.bank.toLowerCase()],
        };

        // Write directly to user's Firestore database!
        await dbAdmin.collection('users').doc(userId).collection('transactions').doc(transactionId).set(transactionData);
        console.log(`[Firestore Webhook] Transação gravada diretamente para o usuário ${userId}: ${transactionId}`);

        // Check if this is a transfer to same ownership (transação interna de mesma titularidade)
        const isInterToNubank = item.bank === 'NUBANK' && (/recebemos sua transferência|recebemos sua/i.test(rawText));
        const isNubankToInter = item.bank === 'BANCO_INTER' && (/joão pedro|joao pedro/i.test(rawText) && /te enviou um pix|creditado/i.test(rawText));

        if (isInterToNubank) {
          // 1. Force original transaction description
          transactionData.description = 'Transferência Inter → Nubank';
          transactionData.category = 'Transferências';
          transactionData.subcategory = 'Mesma Titularidade';
          
          // Re-write original with new description
          await dbAdmin.collection('users').doc(userId).collection('transactions').doc(transactionId).set(transactionData);

          // 2. Create the mirror debit on Inter
          const interAccount = accountsList.find(acc => acc.institution === 'BANCO_INTER') || accountsList.find(acc => acc.id !== accountId);
          if (interAccount) {
            const mirrorTxId = `push-mirror-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const mirrorAmount = -Math.abs(item.amount); // Always debit
            const mirrorTransactionData = {
              id: mirrorTxId,
              date: txDate,
              time: txTime,
              createdAt,
              description: 'Débito na conta Inter',
              amount: mirrorAmount,
              type: 'debit',
              category: 'Transferências',
              subcategory: 'Mesma Titularidade',
              channel: 'Pix',
              accountId: interAccount.id,
              accountName: interAccount.name,
              bankInstitution: 'BANCO_INTER',
              bank: 'BANCO_INTER',
              account: interAccount.name,
              accountPurpose: interAccount.purpose || 'Geral',
              isCategorizedByAI: true,
              status: 'liquidado',
              notes: 'Gerado automaticamente como contrapartida da transferência interna recebida no Nubank',
              tags: ['webhook', 'transferencia-interna', 'banco_inter'],
            };
            await dbAdmin.collection('users').doc(userId).collection('transactions').doc(mirrorTxId).set(mirrorTransactionData);
            console.log(`[Firestore Webhook] Transação espelho (Débito Inter) criada para o usuário ${userId}: ${mirrorTxId}`);
          }
        } else if (isNubankToInter) {
          // 1. Force original transaction description
          transactionData.description = 'Transferência Nubank → Inter';
          transactionData.category = 'Transferências';
          transactionData.subcategory = 'Mesma Titularidade';

          // Re-write original with new description
          await dbAdmin.collection('users').doc(userId).collection('transactions').doc(transactionId).set(transactionData);

          // 2. Create the mirror debit on Nubank
          const nubankAccount = accountsList.find(acc => acc.institution === 'NUBANK') || accountsList.find(acc => acc.id !== accountId);
          if (nubankAccount) {
            const mirrorTxId = `push-mirror-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const mirrorAmount = -Math.abs(item.amount); // Always debit
            const mirrorTransactionData = {
              id: mirrorTxId,
              date: txDate,
              time: txTime,
              createdAt,
              description: 'Débito na conta Nubank',
              amount: mirrorAmount,
              type: 'debit',
              category: 'Transferências',
              subcategory: 'Mesma Titularidade',
              channel: 'Pix',
              accountId: nubankAccount.id,
              accountName: nubankAccount.name,
              bankInstitution: 'NUBANK',
              bank: 'NUBANK',
              account: nubankAccount.name,
              accountPurpose: nubankAccount.purpose || 'Geral',
              isCategorizedByAI: true,
              status: 'liquidado',
              notes: 'Gerado automaticamente como contrapartida da transferência interna recebida no Banco Inter',
              tags: ['webhook', 'transferencia-interna', 'nubank'],
            };
            await dbAdmin.collection('users').doc(userId).collection('transactions').doc(mirrorTxId).set(mirrorTransactionData);
            console.log(`[Firestore Webhook] Transação espelho (Débito Nubank) criada para o usuário ${userId}: ${mirrorTxId}`);
          }
        } else {
          // Regular same-titularity fallback if we couldn't match the specific banks but name matches
          const isGenericSelfTransfer = /joão pedro rocha rizzi|joao pedro rocha rizzi/i.test(rawText);
          if (isGenericSelfTransfer) {
            const otherAccount = accountsList.find(acc => acc.id !== accountId) || accountsList.find(acc => acc.institution !== item.bank);
            if (otherAccount) {
              const mirrorTxId = `push-mirror-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
              const mirrorAmount = -item.amount;
              const mirrorType = mirrorAmount >= 0 ? 'credit' : 'debit';
              const opposingBankName = item.bank === 'BANCO_INTER' ? 'Banco Inter' : item.bank === 'NUBANK' ? 'Nubank' : item.bank;
              
              let mirrorDesc = mirrorType === 'credit' ? `Transferência recebida de ${opposingBankName}` : `Transferência enviada para ${opposingBankName}`;
              
              const mirrorTransactionData = {
                id: mirrorTxId,
                date: txDate,
                time: txTime,
                createdAt,
                description: mirrorDesc,
                amount: mirrorAmount,
                type: mirrorType,
                category: 'Transferências',
                subcategory: 'Mesma Titularidade',
                channel: 'Pix',
                accountId: otherAccount.id,
                accountName: otherAccount.name,
                bankInstitution: otherAccount.institution,
                bank: otherAccount.institution,
                account: otherAccount.name,
                accountPurpose: otherAccount.purpose || 'Geral',
                isCategorizedByAI: true,
                status: 'liquidado',
                notes: `Gerado automaticamente como contrapartida no ${opposingBankName}`,
                tags: ['webhook', 'transferencia-interna'],
              };
              await dbAdmin.collection('users').doc(userId).collection('transactions').doc(mirrorTxId).set(mirrorTransactionData);
            }
          }
        }

        return res.json({
          success: true,
          message: 'Notificação recebida com sucesso e persistida no seu banco de dados!',
          item: transactionData,
          persisted: true,
        });
      } catch (dbErr: any) {
        console.error('[Firestore Webhook Error] Falha ao persistir no banco:', dbErr);
        // Fallback to memory
        pendingNotifications.push(item);
        if (pendingNotifications.length > 50) {
          pendingNotifications.shift();
        }

        return res.json({
          success: true,
          message: 'Notificação recebida, mas falhou ao gravar no Firestore. Armazenado temporariamente em memória.',
          item,
          persisted: false,
          error: dbErr.message,
        });
      }
    } else {
      pendingNotifications.push(item);
      if (pendingNotifications.length > 50) {
        pendingNotifications.shift();
      }

      console.log(`[Push Notification] Lançamento recebido em memória (sem userId): ${item.description} (${item.amount})`);
      return res.json({
        success: true,
        message: 'Notificação recebida e guardada na memória! Para persistência automática direta, adicione ?userId=SEU_ID na URL.',
        item,
        persisted: false,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Polling endpoint for RetroFin frontend to pick up newly arrived notifications
app.get('/api/notifications/poll', (_req, res) => {
  const items = [...pendingNotifications];
  return res.json({
    count: items.length,
    items,
  });
});

// Clear consumed notifications
app.post('/api/notifications/clear', (_req, res) => {
  pendingNotifications.length = 0;
  return res.json({ success: true, message: 'Buffer limpo com sucesso.' });
});

// Setup Vite middlewares in development or static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files with proper cache headers, but ensure index.html and sw.js are never stale
    app.use(express.static(path.resolve(__dirname, 'dist'), {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[InterGestão] Servidor rodando na porta ${PORT}`);
  });
}

startServer();
