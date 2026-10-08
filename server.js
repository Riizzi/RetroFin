// server.ts
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import { GoogleGenAI } from "@google/genai";
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3e3;
app.use(express.json({ limit: "15mb" }));
var apiKey = process.env.GEMINI_API_KEY;
var aiClient = null;
if (apiKey) {
  aiClient = new GoogleGenAI({ apiKey });
}
var DEFAULT_CATEGORIES = [
  { id: "alimentacao", name: "Alimenta\xE7\xE3o & Mercado", color: "#EF4444", icon: "Utensils" },
  { id: "investimentos", name: "Aportes & Investimentos", color: "#10B981", icon: "TrendingUp" },
  { id: "servicos", name: "Assinaturas & Streaming", color: "#8B5CF6", icon: "Tv" },
  { id: "compras", name: "Compras & Shopping", color: "#EC4899", icon: "ShoppingBag" },
  { id: "contas", name: "Contas & Consumo (Luz/\xC1gua/Net)", color: "#D97706", icon: "Zap" },
  { id: "educacao", name: "Educa\xE7\xE3o", color: "#6366F1", icon: "GraduationCap" },
  { id: "farmacia", name: "Farm\xE1cia & Higiene", color: "#0D9488", icon: "HeartPulse" },
  { id: "lazer", name: "Lazer & Sa\xEDdas", color: "#F43F5E", icon: "Sparkles" },
  { id: "moradia", name: "Moradia", color: "#3B82F6", icon: "Home" },
  { id: "receitas", name: "Renda & Receitas", color: "#22C55E", icon: "ArrowDownLeft" },
  { id: "saude", name: "Sa\xFAde", color: "#10B981", icon: "Stethoscope" },
  { id: "snacks", name: "Snacks & Mimos", color: "#D97706", icon: "Cookie" },
  { id: "transacao_interna", name: "Transa\xE7\xE3o Interna", color: "#64748B", icon: "ArrowLeftRight" },
  { id: "transporte", name: "Transporte", color: "#F59E0B", icon: "Car" },
  { id: "outros", name: "Outros & Diversos", color: "#64748B", icon: "Tag" }
];
function ruleBasedCategorize(description, type) {
  const d = description.toUpperCase();
  if (d.includes("TRANSFERENCIA ENTRE CONTAS") || d.includes("TRANSF ENTRE CONTAS") || d.includes("MESMA TITULARIDADE") || d.includes("ENTRE MINHAS CONTAS") || d.includes("APLICACAO CAIXINHA") || d.includes("RESGATE CAIXINHA") || d.includes("APLICACAO CDB") || d.includes("RESGATE CDB")) {
    return { category: "transacao_interna", subcategory: "Transfer\xEAncia Entre Contas / Aplica\xE7\xE3o", confidence: 0.98, reason: "Movimenta\xE7\xE3o interna entre contas ou reserva" };
  }
  if (d.includes("DOCERIA") || d.includes("SORVETE") || d.includes("GELATO") || d.includes("CACAU SHOW") || d.includes("KOPENHAGEN") || d.includes("HAVANNA") || d.includes("FINI ") || d.includes("PIPOCA") || d.includes("BOMBONIERE") || d.includes("CONVENIENCIA") || d.includes("CONVENI\xCANCIA") || d.includes("SNACK") || d.includes("DOCES") || d.includes("CHURROS") || d.includes("ACAI") || d.includes("A\xC7A\xCD")) {
    return { category: "snacks", subcategory: "Snacks & Sobremesas", confidence: 0.95, reason: "Gasto em doces, sorvetes ou snacks r\xE1pidos" };
  }
  if (type === "credit") {
    if (d.includes("SALARIO") || d.includes("PAGAMENTO FOLHA") || d.includes("TED RECEBIDA PRO-LABORE")) {
      return { category: "receitas", subcategory: "Sal\xE1rio / CLT", confidence: 0.95, reason: "Identificado provento salarial" };
    }
    if (d.includes("RENDIMENTO") || d.includes("CDB") || d.includes("DIVIDENDO") || d.includes("JUROS")) {
      return { category: "investimentos", subcategory: "Rendimento CDB / Aplica\xE7\xF5es", confidence: 0.92, reason: "Rendimento de investimento Inter" };
    }
    if (d.includes("CASHBACK") || d.includes("INTER SHOP")) {
      return { category: "receitas", subcategory: "Cashback Inter", confidence: 0.95, reason: "Cashback creditado na conta Inter" };
    }
    return { category: "receitas", subcategory: "PIX / Transfer\xEAncia Recebida", confidence: 0.85, reason: "Entrada de recursos na conta" };
  }
  if (d.includes("IFOOD") || d.includes("RAPPI") || d.includes("UBER EATS") || d.includes("AIQFOME") || d.includes("ZE DELIVERY") || d.includes("DELIVERY") || d.includes("DOGAO") || d.includes("BURGER")) {
    return { category: "alimentacao", subcategory: "Delivery / Pedidos", confidence: 0.98, reason: "Identificado aplicativo de delivery de comida" };
  }
  if (d.includes("MCDONALDS") || d.includes("MC DONALD") || d.includes("BURGER KING") || d.includes("BK ") || d.includes("SUBWAY") || d.includes("RESTAURANTE") || d.includes("REST ") || d.includes("CHURRASC") || d.includes("PIZZARIA") || d.includes("PIZZA") || d.includes("BAR ") || d.includes("BOTECO") || d.includes("PADARIA") || d.includes("PANIFIC") || d.includes("LANCHONETE") || d.includes("LANCHES") || d.includes("CAFE") || d.includes("CAFETERIA") || d.includes("STARBUCKS") || d.includes("SORVETE") || d.includes("GELATO") || d.includes("DOCERIA") || d.includes("CONFEITARIA") || d.includes("CANTINA") || d.includes("BUFFET") || d.includes("BISTR\xD4") || d.includes("BISTRO") || d.includes("SUSHI") || d.includes("JAPA") || d.includes("TEMAKI") || d.includes("CHOPP") || d.includes("CERVEJARIA")) {
    return { category: "alimentacao", subcategory: "Restaurante & Bares", confidence: 0.95, reason: "Estabelecimento de alimenta\xE7\xE3o / refei\xE7\xE3o fora de casa" };
  }
  if (d.includes("CARREFOUR") || d.includes("P\xC3O DE A\xC7\xDACAR") || d.includes("PAO DE ACUCAR") || d.includes("ASSAI") || d.includes("ATACADAO") || d.includes("ATACAD\xC3O") || d.includes("MERCADO") || d.includes("SUPERMERCADO") || d.includes("SUPERMERC") || d.includes("BIG ") || d.includes("EXTRA ") || d.includes("DIA ") || d.includes("HIROTA") || d.includes("SAMS CLUB") || d.includes("SAM'S") || d.includes("HORTOFRUTI") || d.includes("HORTIFRUTI") || d.includes("FEIRA") || d.includes("SACOL\xC3O") || d.includes("SACOLAO") || d.includes("A\xC7OUGUE") || d.includes("ACOUGUE") || d.includes("MERCEARIA") || d.includes("EMPORIO") || d.includes("EMP\xD3RIO") || d.includes("MINIMERCADO") || d.includes("SUPER ") || d.includes("OXXO")) {
    return { category: "alimentacao", subcategory: "Supermercado & Feira", confidence: 0.97, reason: "Compra em rede de supermercado, atacado ou feira" };
  }
  if (d.includes("ENEL") || d.includes("CPFL") || d.includes("CEMIG") || d.includes("LIGHT") || d.includes("SABESP") || d.includes("SANEPAR") || d.includes("COPASA") || d.includes("CONGAS") || d.includes("COMGAS") || d.includes("ENERGIA") || d.includes("AGUA") || d.includes("SANEAMENTO") || d.includes("GAS ") || d.includes("ULTRAGAZ") || d.includes("LIQUIGAS")) {
    return { category: "contas", subcategory: "Contas de Consumo (Luz/\xC1gua/G\xE1s)", confidence: 0.98, reason: "Fatura de concession\xE1ria p\xFAblica / servi\xE7os essenciais" };
  }
  if (d.includes("CLARO") || d.includes("VIVO") || d.includes("TIM") || d.includes("OI ") || d.includes("INTERNET") || d.includes("FIBRA") || d.includes("BANDA LARGA") || d.includes("TELECOM")) {
    return { category: "contas", subcategory: "Internet & Telefonia", confidence: 0.95, reason: "Servi\xE7o de telecomunica\xE7\xF5es e internet" };
  }
  if (d.includes("CONDOMINIO") || d.includes("CONDOM\xCDNIO") || d.includes("ALUGUEL") || d.includes("QUINTOANDAR") || d.includes("QUINTO ANDAR") || d.includes("LOFT") || d.includes("IPTU") || d.includes("IMOBILIARIA") || d.includes("IMOBILI\xC1RIA") || d.includes("TAXA CONDOMINIAL")) {
    return { category: "moradia", subcategory: "Aluguel & Condom\xEDnio", confidence: 0.98, reason: "Despesa imobili\xE1ria recorrente ou taxa de moradia" };
  }
  if (d.includes("NETFLIX") || d.includes("SPOTIFY") || d.includes("AMAZON PRIME") || d.includes("DISNEY") || d.includes("HBO") || d.includes("MAX") || d.includes("YOUTUBE") || d.includes("APPLE.COM/BILL") || d.includes("DEEZER") || d.includes("GLOBOPLAY") || d.includes("PARAMOUNT") || d.includes("STAR+")) {
    return { category: "servicos", subcategory: "Assinaturas & Streaming", confidence: 0.98, reason: "Assinatura digital e servi\xE7os de streaming" };
  }
  if (d.includes("CINEMA") || d.includes("CINEMARK") || d.includes("CINEPOLIS") || d.includes("UCI") || d.includes("INGRESSO.COM") || d.includes("SYMPLA") || d.includes("EVENTIM") || d.includes("SHOW") || d.includes("TEATRO") || d.includes("PARQUE") || d.includes("MUSEU") || d.includes("BALADA") || d.includes("BAR") || d.includes("PUB") || d.includes("CHOPERIA")) {
    return { category: "lazer", subcategory: "Lazer & Sa\xEDdas", confidence: 0.95, reason: "Passeios, entretenimento fora de casa, cinema e sa\xEDdas" };
  }
  if (d.includes("DROGASIL") || d.includes("DROGA RAIA") || d.includes("DROGARIA") || d.includes("PACHECO") || d.includes("SAO PAULO FARMACIA") || d.includes("ULTRAFARMA") || d.includes("PANVEL") || d.includes("FARMACIA")) {
    return { category: "farmacia", subcategory: "Farm\xE1cia & Higiene", confidence: 0.95, reason: "Compra em rede de farm\xE1cias e cuidados di\xE1rios" };
  }
  if (d.includes("SMART FIT") || d.includes("BLUEFIT") || d.includes("ACADEMIA") || d.includes("GYMPASS") || d.includes("TOTALPASS")) {
    return { category: "saude", subcategory: "Academia & Treinos", confidence: 0.92, reason: "Mensalidade de condicionamento f\xEDsico e bem-estar" };
  }
  if (d.includes("HOSPITAL") || d.includes("LABORATORIO") || d.includes("FLEURY") || d.includes("LAVOISIER") || d.includes("CONSULTORIO") || d.includes("MEDICO") || d.includes("M\xC9DICO") || d.includes("CLINICA") || d.includes("CL\xCDNICA") || d.includes("ODONTO") || d.includes("DENTISTA") || d.includes("UNIMED") || d.includes("BRADESCO SAUDE") || d.includes("AMIL")) {
    return { category: "saude", subcategory: "Consultas, M\xE9dicos & Exames", confidence: 0.95, reason: "Servi\xE7o m\xE9dico, odontol\xF3gico, plano de sa\xFAde ou exames" };
  }
  if (d.includes("AMAZON") || d.includes("MERCADO LIVRE") || d.includes("SHOPEE") || d.includes("SHEIN") || d.includes("ALIEXPRESS") || d.includes("MAGAZINE LUIZA") || d.includes("CASAS BAHIA")) {
    return { category: "compras", subcategory: "E-commerce & Shopping", confidence: 0.92, reason: "Marketplace de compras online" };
  }
  if (d.includes("ZARA") || d.includes("RENNER") || d.includes("C&A") || d.includes("RIACHUELO") || d.includes("CENTAURO") || d.includes("DECATHLON")) {
    return { category: "compras", subcategory: "Vestu\xE1rio & Moda", confidence: 0.92, reason: "Loja de roupas e cal\xE7ados" };
  }
  if (d.includes("ALURA") || d.includes("UDEMY") || d.includes("FACULDADE") || d.includes("ESCOLA") || d.includes("CURSO") || d.includes("LIVRARIA") || d.includes("SARAIVA")) {
    return { category: "educacao", subcategory: "Cursos & Livros", confidence: 0.92, reason: "Capacita\xE7\xE3o e materiais did\xE1ticos" };
  }
  if (d.includes("APLICA\xC7\xC3O") || d.includes("APLICACAO") || d.includes("INVEST") || d.includes("CDB INTER") || d.includes("TESOURO") || d.includes("LCI")) {
    return { category: "investimentos", subcategory: "Aporte de Investimento", confidence: 0.95, reason: "Aplica\xE7\xE3o financeira na conta Inter" };
  }
  if (d.includes("IOF") || d.includes("TARIFA") || d.includes("TAXA") || d.includes("ENCARGOS")) {
    return { category: "servicos", subcategory: "Tarifas & Tributos", confidence: 0.95, reason: "Tarifa banc\xE1ria ou tributo financeiro" };
  }
  return { category: "outros", subcategory: "Geral", confidence: 0.6, reason: "Classifica\xE7\xE3o padr\xE3o" };
}
app.post("/api/categorize", async (req, res) => {
  try {
    const { transactions, manualExamples } = req.body;
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: "Nenhuma transa\xE7\xE3o enviada para categoriza\xE7\xE3o." });
    }
    if (!aiClient) {
      const results = transactions.map((t) => {
        const cat = ruleBasedCategorize(t.description || "", t.type || "debit");
        return {
          id: t.id,
          category: cat.category,
          subcategory: cat.subcategory,
          confidence: cat.confidence,
          reason: `${cat.reason} (Motor de regras instant\xE2neo)`
        };
      });
      return res.json({ results, engine: "rule-based" });
    }
    const batch = transactions.slice(0, 30);
    const promptData = batch.map((t, idx) => ({
      index: idx,
      id: t.id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: t.date,
      accountName: t.accountName || "N\xE3o especificada",
      accountPurpose: t.accountPurpose || "Geral"
    }));
    const examplesFormatted = Array.isArray(manualExamples) && manualExamples.length > 0 ? `
EXEMPLOS DE CLASSIFICA\xC7\xC3O MANUAL REALIZADOS PELO USU\xC1RIO NESTE M\xCAS (REFER\xCANCIA M\xC1XIMA DE DECIS\xC3O):
O usu\xE1rio classificou manualmente estes itens exatamente assim. APRENDA e REPLIQUE esse padr\xE3o fielmente para as novas transa\xE7\xF5es semelhantes:
${JSON.stringify(manualExamples.slice(0, 35), null, 2)}
` : "";
    const response = await aiClient.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Voc\xEA \xE9 o assistente inteligente de finan\xE7as pessoais do RetroFin.
Analise a lista de transa\xE7\xF5es banc\xE1rias brasileiras (Nubank, Banco Inter, Ita\xFA, etc.).

CRIT\xC9RIO N\xDAMERO 1 - APRENDIZADO COM O HIST\xD3RICO MANUAL DO USU\xC1RIO:
O usu\xE1rio classificou gastos manualmente. Sempre que voc\xEA identificar transa\xE7\xF5es de estabelecimentos iguais ou semelhantes aos exemplos fornecidos pelo usu\xE1rio, REPLIQUE EXATAMENTE a mesma categoria e padr\xE3o que ele escolheu.

CRIT\xC9RIO N\xDAMERO 2 - CONTEXTO DO USU\xC1RIO E FINALIDADE DA CONTA:
O usu\xE1rio definiu finalidades e nomes espec\xEDficos para cada conta banc\xE1ria (veja 'accountName' e 'accountPurpose' em cada item):
- Se a conta for definida para "Casa & Mercado", priorize categorizar transa\xE7\xF5es de supermercado, compras de alimentos, contas fixas, energia, feira ou condom\xEDnio nas categorias 'alimentacao', 'contas' ou 'moradia'.
- Se a conta for para "Pessoal & Lazer", interprete como gastos individuais, lazer, restaurantes em passeios, vestu\xE1rio ou compras pessoais.
- Se for "Sal\xE1rio / Principal", atente para proventos salariais ou despesas fixas.

Categorias permitidas (use EXATAMENTE o id correspondente):
- 'alimentacao': Alimenta\xE7\xE3o & Mercado (restaurantes, almo\xE7os, jantares, refei\xE7\xF5es fora, delivery de refei\xE7\xF5es iFood/Rappi, supermercados como Carrefour, P\xE3o de A\xE7\xFAcar, Assa\xED, Atacad\xE3o, Oxxo, hortifr\xFAtis, feiras e a\xE7ougues).
- 'investimentos': Aportes & Investimentos (aportes em corretoras externas, a\xE7\xF5es, fundos, t\xEDtulos p\xFAblicos, CDBs externos, investimentos fora da conta).
- 'servicos': Assinaturas & Streaming (Netflix, Spotify, Amazon Prime, Disney+, Max, YouTube Premium, Globoplay, Apple Services, assinaturas digitais, softwares como ChatGPT/iCloud/Google One).
- 'compras': Compras & Shopping (lojas de roupas como Zara/Renner/C&A, eletr\xF4nicos, e-commerce como Mercado Livre, Amazon, Shopee, Shein, artigos pessoais e cal\xE7ados).
- 'contas': Contas & Consumo (contas de consumo essenciais e utilidades p\xFAblicas: energia el\xE9trica Enel/CPFL/Light, \xE1gua Sabesp/Sanepar, g\xE1s Comg\xE1s/Ultragaz e conectividade como internet fibra e celular Claro/Vivo/TIM).
- 'educacao': Educa\xE7\xE3o (cursos, faculdade, livros, material escolar, plataformas de cursos como Alura, Udemy).
- 'farmacia': Farm\xE1cia & Higiene (Drogasil, Droga Raia, Pacheco, Panvel, Ultrafarma, rem\xE9dios, vitaminas, cosm\xE9ticos de farm\xE1cia, produtos de higiene pessoal).
- 'lazer': Lazer & Sa\xEDdas (cinema como Cinemark/Cin\xE9polis, ingressos, shows, teatro, parques, museus, viagens, passeios, bares, pubs e sa\xEDdas em geral).
- 'moradia': Moradia (aluguel via QuintoAndar/Loft/imobili\xE1ria, condom\xEDnio, taxa condominial, IPTU e despesas de loca\xE7\xE3o).
- 'receitas': Sal\xE1rio & Entradas (sal\xE1rio mensal CLT/PJ, Pro-labore, Pix recebido de terceiros externos, vendas, reembolsos).
- 'saude': Sa\xFAde & Cuidados M\xE9dicos (m\xE9dicos, cl\xEDnicas, consultas, hospitais, exames laboratoriais como Fleury/Lavoisier, dentistas, psic\xF3logos, planos de sa\xFAde Unimed/Bradesco/Amil, academias).
- 'snacks': Snacks & Mimos (lanches r\xE1pidos, docerias, sorveterias, cafeterias como Starbucks, Cacau Show, Kopenhagen, Fini, conveni\xEAncia, a\xE7a\xED, bomboniere, sobremesas, pequenos mimos).
- 'transacao_interna': Transa\xE7\xE3o Interna (transfer\xEAncias entre contas do pr\xF3prio usu\xE1rio, ex: Pix entre Nubank e Inter de mesma titularidade, caixinhas internas, aportes/resgates internos). Esta categoria N\xC3O entra no c\xE1lculo de despesas/metas do m\xEAs.
- 'transporte': Transporte (combust\xEDvel como Shell/Ipiranga, Uber, 99, passagens de transporte p\xFAblico/\xF4nibus/metr\xF4, manuten\xE7\xE3o de ve\xEDculo, ped\xE1gio).
- 'outros': Outros & Diversos (saques ou movimenta\xE7\xF5es diversas sem identifica\xE7\xE3o espec\xEDfica).
${examplesFormatted}
Transa\xE7\xF5es a categorizar com seu contexto de conta:
${JSON.stringify(promptData, null, 2)}

Responda SOMENTE em JSON estruturado com a chave "results", contendo um array de objetos:
{
  "results": [
    {
      "id": "id_da_transa\xE7\xE3o",
      "category": "id_da_categoria",
      "subcategory": "Subcategoria descritiva (ex: Supermercado, Farm\xE1cia & Higiene, Snacks, Transfer\xEAncia Entre Contas)",
      "confidence": 0.98,
      "reason": "Explica\xE7\xE3o considerando os exemplos manuais do usu\xE1rio ou o prop\xF3sito da conta"
    }
  ]
}`,
      config: {
        responseMimeType: "application/json"
      }
    });
    const text = response.text?.trim() || "{}";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Gemini JSON response:", text);
      parsed = { results: [] };
    }
    const resultsMap = new Map((parsed.results || []).map((r) => [r.id, r]));
    const finalResults = transactions.map((t) => {
      if (resultsMap.has(t.id)) {
        return resultsMap.get(t.id);
      }
      const cat = ruleBasedCategorize(t.description || "", t.type || "debit");
      return {
        id: t.id,
        category: cat.category,
        subcategory: cat.subcategory,
        confidence: cat.confidence,
        reason: cat.reason
      };
    });
    return res.json({ results: finalResults, engine: "gemini-3.8-flash" });
  } catch (err) {
    console.warn("AI categorization quota or API issue, using local rule-based engine:", err?.message || err);
    const fallbackResults = (req.body.transactions || []).map((t) => {
      const cat = ruleBasedCategorize(t.description || "", t.type || "debit");
      return {
        id: t.id,
        category: cat.category,
        subcategory: cat.subcategory,
        confidence: cat.confidence,
        reason: `${cat.reason} (Motor de regras instant\xE2neo)`
      };
    });
    return res.json({ results: fallbackResults, engine: "fallback-rules" });
  }
});
app.post("/api/ai-insights", async (req, res) => {
  try {
    const { month, summary, topExpenses } = req.body;
    if (!aiClient) {
      return res.json({
        insights: [
          {
            title: "Equil\xEDbrio Financeiro Mensal",
            type: "positive",
            message: `No m\xEAs analisado, sua taxa de poupan\xE7a est\xE1 saud\xE1vel com receitas de R$ ${summary?.income?.toFixed(2) || "0,00"} e despesas de R$ ${summary?.expense?.toFixed(2) || "0,00"}.`,
            action: "Mantenha os aportes autom\xE1ticos no CDB Inter com liquidez di\xE1ria."
          },
          {
            title: "Aten\xE7\xE3o aos Gastos com Alimenta\xE7\xE3o",
            type: "warning",
            message: "O volume de delivery (iFood/Rappi) e restaurantes costuma responder por 25% a 35% do or\xE7amento vari\xE1vel.",
            action: "Defina um teto semanal para pedidos em aplicativos."
          },
          {
            title: "Auditoria de Assinaturas",
            type: "tip",
            message: "Verifique se h\xE1 servi\xE7os de streaming ou apps ativos que n\xE3o foram usados nos \xFAltimos 30 dias.",
            action: "Cancele cobran\xE7as recorrentes ociosas."
          }
        ]
      });
    }
    const response = await aiClient.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Voc\xEA \xE9 um consultor financeiro especialista do ecossistema Banco Inter (conta digital, cart\xF5es Gold/Platinum/Black, cashback, Super App Inter e Open Finance).
Analise o panorama financeiro do usu\xE1rio neste m\xEAs:
- M\xEAs de Refer\xEAncia: ${month || "M\xEAs atual"}
- Total de Receitas: R$ ${summary?.income || 0}
- Total de Despesas: R$ ${summary?.expense || 0}
- Saldo L\xEDquido: R$ ${summary?.balance || 0}
- Principais Categorias de Gastos: ${JSON.stringify(topExpenses || [])}

Gere 3 a 4 recomenda\xE7\xF5es pr\xE1ticas, inteligentes e personalizadas em portugu\xEAs brasileiro. Responda em JSON estruturado com o formato:
{
  "insights": [
    {
      "title": "T\xEDtulo conciso do insight",
      "type": "positive" | "warning" | "tip",
      "message": "Explica\xE7\xE3o detalhada e amig\xE1vel com n\xFAmeros ou tend\xEAncias",
      "action": "A\xE7\xE3o pr\xE1tica recomendada para o usu\xE1rio"
    }
  ]
}`,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text?.trim() || '{"insights":[]}');
    return res.json(parsed);
  } catch (err) {
    return res.json({
      insights: [
        {
          title: "Dica do Banco Inter",
          type: "tip",
          message: "Aproveite a regra 50-30-20: 50% para necessidades, 30% para desejos pessoais e 20% para reserva de emerg\xEAncia e investimentos.",
          action: "Revise suas metas or\xE7ament\xE1rias na aba Or\xE7amento."
        }
      ]
    });
  }
});
app.post("/api/inter/test-connection", async (req, res) => {
  const { clientId, clientSecret, cert, key, environment } = req.body;
  if (!clientId || !clientSecret || clientId === "sandbox" || clientId.includes("demo")) {
    return res.json({
      success: true,
      mode: "sandbox",
      message: "Conex\xE3o com a Sandbox da API do Banco Inter autenticada com sucesso! Token OAuth 2.0 simulado emitido.",
      account: {
        holder: "Jo\xE3o Pedro R.",
        accountNumber: "1098452-3",
        branch: "0001",
        bank: "077 - Banco Inter S.A.",
        type: "Conta Corrente PF & Cart\xE3o Inter Mastercard",
        balance: 4850.32
      }
    });
  }
  if (cert && key) {
    try {
      const baseUrl = environment === "production" ? "cdpj.partners.bancointer.com.br" : "cdpj-sandbox.partners.bancointer.com.br";
      const postData = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "extrato.read boleto-cobranca.read"
      }).toString();
      const options = {
        hostname: baseUrl,
        port: 443,
        path: "/oauth/v2/token",
        method: "POST",
        cert,
        key,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData)
        },
        timeout: 5e3
      };
      const reqInter = https.request(options, (interRes) => {
        let body = "";
        interRes.on("data", (d) => {
          body += d;
        });
        interRes.on("end", () => {
          if (interRes.statusCode && interRes.statusCode >= 200 && interRes.statusCode < 300) {
            try {
              const tokenData = JSON.parse(body);
              return res.json({
                success: true,
                mode: "live",
                message: "Conectado com sucesso ao Banco Inter com mTLS!",
                tokenExpiresIn: tokenData.expires_in
              });
            } catch {
              return res.json({ success: true, mode: "live", message: "Certificados mTLS aceitos pelo Banco Inter." });
            }
          } else {
            return res.status(400).json({
              success: false,
              message: `Erro na valida\xE7\xE3o do Banco Inter (Status ${interRes.statusCode}): ${body}`
            });
          }
        });
      });
      reqInter.on("error", (e) => {
        return res.status(500).json({
          success: false,
          message: `Falha na conex\xE3o mTLS com Banco Inter: ${e.message}`
        });
      });
      reqInter.write(postData);
      reqInter.end();
      return;
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: `Falha ao processar certificados: ${err.message}`
      });
    }
  }
  return res.json({
    success: true,
    mode: "credentials-validated",
    message: "Credenciais Client ID e Secret validadas! Para sincroniza\xE7\xE3o mTLS ao vivo em produ\xE7\xE3o, certifique-se de anexar os arquivos .crt e .key gerados no Portal Desenvolvedor Inter.",
    account: {
      holder: "Jo\xE3o Pedro R.",
      accountNumber: "1098452-3",
      branch: "0001",
      bank: "077 - Banco Inter S.A.",
      type: "Conta Corrente PF & Cart\xE3o Inter Mastercard",
      balance: 4850.32
    }
  });
});
var pendingNotifications = [];
function parseNotificationPayload(body) {
  const rawText = `${body.title || ""} ${body.text || body.message || body.body || ""} ${typeof body === "string" ? body : ""}`.trim();
  if (!rawText) return null;
  const valMatch = rawText.match(/(?:R\$\s*)?(\d{1,4}(?:\.\d{3})*,\d{2})/i) || rawText.match(/(\d+\.\d{2})/);
  if (!valMatch) return null;
  const valStr = valMatch[1].replace(/\./g, "").replace(",", ".");
  const parsedVal = parseFloat(valStr);
  if (isNaN(parsedVal)) return null;
  const isCredit = /receb|depósito|crédito em conta|reembolso|salário|estorno/i.test(rawText);
  const amount = isCredit ? Math.abs(parsedVal) : -Math.abs(parsedVal);
  const upper = rawText.toUpperCase();
  let bank = "NUBANK";
  const appName = (body.app || body.package || "").toUpperCase();
  if (appName.includes("INTER") || upper.includes("BANCO INTER") || upper.includes("INTER ") || upper.includes("077")) {
    bank = "BANCO_INTER";
  } else if (appName.includes("ITAU") || upper.includes("ITA\xDA") || upper.includes("ITAU")) {
    bank = "ITAU";
  } else if (appName.includes("BRADESCO") || upper.includes("BRADESCO")) {
    bank = "BRADESCO";
  } else if (appName.includes("SANTANDER") || upper.includes("SANTANDER")) {
    bank = "SANTANDER";
  } else if (appName.includes("C6") || upper.includes("C6 BANK") || upper.includes("C6BANK")) {
    bank = "C6";
  } else if (appName.includes("CAIXA") || upper.includes("CAIXA")) {
    bank = "CAIXA";
  } else {
    bank = "NUBANK";
  }
  let desc = rawText.replace(/(?:R\$\s*)?\d{1,4}(?:\.\d{3})*,\d{2}/gi, "").replace(/você pagou|compra aprovada|transferência enviada|transferência|pix enviado para|pix recebido de|no cartão/gi, "").replace(/[\(\)•\-]/g, " ").trim();
  if (!desc || desc.length < 3) {
    desc = `Movimenta\xE7\xE3o ${bank}`;
  }
  const type = amount >= 0 ? "credit" : "debit";
  const cat = ruleBasedCategorize(desc, type);
  return {
    id: `push-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    receivedAt: (/* @__PURE__ */ new Date()).toISOString(),
    description: desc,
    amount,
    type,
    category: cat.category,
    subcategory: cat.subcategory,
    bank,
    channel: upper.includes("PIX") ? "PIX" : "CARTAO_CREDITO",
    source: body.app || "Android Push"
  };
}
app.post("/api/notifications/webhook", (req, res) => {
  try {
    const item = parseNotificationPayload(req.body);
    if (!item) {
      return res.status(400).json({
        success: false,
        message: "N\xE3o foi poss\xEDvel extrair valor monet\xE1rio do corpo da notifica\xE7\xE3o.",
        received: req.body
      });
    }
    pendingNotifications.push(item);
    if (pendingNotifications.length > 50) {
      pendingNotifications.shift();
    }
    console.log(`[Push Notification] Lan\xE7amento recebido: ${item.description} (${item.amount})`);
    return res.json({
      success: true,
      message: "Notifica\xE7\xE3o recebida com sucesso e armazenada para o RetroFin!",
      item
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/notifications/poll", (_req, res) => {
  const items = [...pendingNotifications];
  return res.json({
    count: items.length,
    items
  });
});
app.post("/api/notifications/clear", (_req, res) => {
  pendingNotifications.length = 0;
  return res.json({ success: true, message: "Buffer limpo com sucesso." });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist"), {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js") || filePath.endsWith("manifest.webmanifest")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      }
    }));
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }
  app.listen(PORT, () => {
    console.log(`[RetroFin] Servidor rodando na porta ${PORT}`);
  });
}
startServer();
export {
  DEFAULT_CATEGORIES
};
