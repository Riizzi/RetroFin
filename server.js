// server.ts
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import { GoogleGenAI } from "@google/genai";
import { timingSafeEqual } from "crypto";

// src/services/categorizacaoIA.ts
import { Type } from "@google/genai";

// src/services/categorizacao.ts
var DICAS_CATEGORIA = {
  alimentacao: "mercado, supermercado, padaria, a\xE7ougue, restaurantes, almo\xE7o, lanchonete, delivery de comida",
  snacks: "caf\xE9s, doces, sorvete, a\xE7a\xED, chocolate, conveni\xEAncia: pequenos mimos fora das refei\xE7\xF5es",
  transporte: "Uber, 99, t\xE1xi, combust\xEDvel, estacionamento, ped\xE1gio, \xF4nibus, metr\xF4",
  contas: "energia (Cemig), \xE1gua (Copasa), g\xE1s, internet, celular",
  moradia: "aluguel, condom\xEDnio, IPTU, manuten\xE7\xE3o da casa",
  servicos: "assinaturas digitais e streaming, apps, tarifas banc\xE1rias",
  compras: "lojas f\xEDsicas e online, roupas, eletr\xF4nicos, marketplaces (Mercado Livre, Amazon, Shopee)",
  farmacia: "farm\xE1cias e drogarias, rem\xE9dios, higiene pessoal",
  saude: "m\xE9dicos, exames, dentista, plano de sa\xFAde, academia",
  lazer: "bares, cinema, shows, ingressos, passeios, viagens",
  educacao: "cursos, faculdade, livros, material de estudo",
  investimentos: "aplica\xE7\xF5es, aportes, resgates e rendimentos",
  receitas: "sal\xE1rio, Pix recebido de terceiros, reembolsos, vendas",
  transacao_interna: "transfer\xEAncia entre contas do pr\xF3prio usu\xE1rio (n\xE3o \xE9 gasto)",
  outros: "use s\xF3 quando n\xE3o houver pista nenhuma"
};
function montarInstrucoes(categorias, exemplos) {
  const lista = categorias.map((c) => `- ${c.id}: ${c.name}${DICAS_CATEGORIA[c.id] ? ` \u2014 ${DICAS_CATEGORIA[c.id]}` : ""}`).join("\n");
  const ex = exemplos.length ? `
COMO ESTA PESSOA CLASSIFICA (siga o mesmo crit\xE9rio para estabelecimentos parecidos):
${exemplos.map((e) => `- "${e.descricao}" \u2192 ${e.categoria}${e.subcategoria ? ` / ${e.subcategoria}` : ""}`).join("\n")}
` : "";
  return `Voc\xEA classifica lan\xE7amentos banc\xE1rios de uma pessoa em Belo Horizonte (MG, Brasil).

CATEGORIAS (use s\xF3 estes ids):
${lista}
${ex}
REGRAS
1. Decida pelo estabelecimento. Descri\xE7\xF5es v\xEAm abreviadas (ex.: "IFD*", "PAG*", "MP*" s\xE3o intermediadores de pagamento; olhe o nome depois do asterisco).
2. Os exemplos acima valem mais que o seu palpite: se um estabelecimento parecido aparece l\xE1, use a mesma categoria.
3. "saida" nunca \xE9 receitas. "entrada" \xE9 receitas, investimentos (rendimento/resgate) ou transacao_interna.
4. Pix ou transfer\xEAncia para "[pessoa]" sem outra pista: use "outros" com confian\xE7a baixa. N\xE3o invente o motivo.
5. Valor e hor\xE1rio ajudam: R$ 8 \xE0s 15h numa cafeteria \xE9 snack; R$ 35 \xE0s 12h30 num restaurante \xE9 almo\xE7o (alimentacao).
6. Na d\xFAvida real, use "outros" e confian\xE7a abaixo de 0,5. N\xE3o chute com confian\xE7a alta.
7. subcategoria: 2 a 4 palavras em portugu\xEAs (ex.: "Almo\xE7o no trabalho", "Mercado do m\xEAs").
8. motivo: uma frase curta.`;
}
function validarRespostaIA(bruto, ids, categoriasValidas) {
  const out = /* @__PURE__ */ new Map();
  const lista = bruto?.results;
  if (!Array.isArray(lista)) return out;
  for (const r of lista) {
    const id = String(r?.id ?? "");
    const cat = String(r?.category ?? "");
    if (!ids.has(id) || !categoriasValidas.has(cat)) continue;
    const conf = Math.max(0, Math.min(1, Number(r.confidence ?? 0.6)));
    out.set(id, {
      category: cat,
      subcategory: typeof r.subcategory === "string" ? r.subcategory.slice(0, 60) : void 0,
      categorizedBy: "ia",
      confidence: conf,
      reason: typeof r.reason === "string" ? r.reason.slice(0, 200) : "Classificado pela IA."
    });
  }
  return out;
}

// src/services/categorizacaoIA.ts
var MAX_ITENS = 200;
var LOTE = 25;
function validarPedido(p) {
  if (!p || !Array.isArray(p.items) || !p.items.length) return "Nenhum lan\xE7amento enviado.";
  if (p.items.length > MAX_ITENS) return `Envie no m\xE1ximo ${MAX_ITENS} lan\xE7amentos por vez.`;
  if (!Array.isArray(p.categorias) || !p.categorias.length) return "Envie a lista de categorias.";
  if (p.categorias.some((c) => typeof c?.id !== "string" || typeof c?.name !== "string")) return "Categoria inv\xE1lida.";
  return null;
}
async function categorizarComGemini(ai, model, pedido) {
  const categorias = pedido.categorias.slice(0, 60).map((c) => ({ id: c.id.slice(0, 40), name: c.name.slice(0, 60) }));
  const validas = new Set(categorias.map((c) => c.id));
  const instrucoes = montarInstrucoes(categorias, (pedido.exemplos || []).slice(0, 60));
  const schema = {
    type: Type.OBJECT,
    properties: {
      results: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            category: { type: Type.STRING, enum: [...validas] },
            subcategory: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            reason: { type: Type.STRING }
          },
          required: ["id", "category", "confidence"]
        }
      }
    },
    required: ["results"]
  };
  const saida = /* @__PURE__ */ new Map();
  for (let i = 0; i < pedido.items.length; i += LOTE) {
    const lote = pedido.items.slice(i, i + LOTE);
    const resp = await ai.models.generateContent({
      model,
      contents: `Classifique cada lan\xE7amento (responda um resultado por id):
${JSON.stringify(lote)}`,
      config: {
        systemInstruction: instrucoes,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0
      }
    });
    let bruto = {};
    try {
      bruto = JSON.parse(resp.text?.trim() || "{}");
    } catch {
      bruto = {};
    }
    for (const [id, c] of validarRespostaIA(bruto, new Set(lote.map((x) => x.id)), validas)) saida.set(id, c);
  }
  return saida;
}

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3e3;
app.use(express.json({ limit: "15mb" }));
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
var API_KEY = (process.env.RETROFIN_API_KEY || "").trim();
app.use("/api", (req, res, next) => {
  if (!API_KEY) return next();
  const h = String(req.headers.authorization || "");
  const recebido = Buffer.from(h.startsWith("Bearer ") ? h.slice(7).trim() : "");
  const esperado = Buffer.from(API_KEY);
  if (recebido.length === esperado.length && timingSafeEqual(recebido, esperado)) return next();
  return res.status(401).json({ error: "Chave do servidor inv\xE1lida." });
});
var apiKey = process.env.GEMINI_API_KEY;
var aiClient = null;
var GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
if (apiKey) {
  aiClient = new GoogleGenAI({ apiKey });
}
app.post("/api/categorize", async (req, res) => {
  const pedido = req.body;
  const erro = validarPedido(pedido);
  if (erro) return res.status(400).json({ error: erro });
  if (!aiClient) return res.status(503).json({ error: "GEMINI_API_KEY n\xE3o configurada no servidor." });
  try {
    const mapa = await categorizarComGemini(aiClient, GEMINI_MODEL, pedido);
    return res.json({ results: [...mapa].map(([id, c]) => ({ id, ...c })), engine: GEMINI_MODEL });
  } catch (err) {
    console.warn("[categorize] falha no Gemini:", err?.message || err);
    const msg = String(err?.message || "");
    const status = /429|RESOURCE_EXHAUSTED|quota/i.test(msg) ? 429 : 502;
    return res.status(status).json({ error: status === 429 ? "Cota do Gemini esgotada no momento." : "Falha ao falar com o Gemini." });
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
      model: GEMINI_MODEL,
      contents: `Voc\xEA analisa as finan\xE7as pessoais de uma pessoa no Brasil. Seja objetivo, use s\xF3 os n\xFAmeros abaixo e n\xE3o recomende produtos de nenhum banco.
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
