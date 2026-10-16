/**
 * Chamada ao Gemini para categorizar (roda no servidor: RetroFin ou CL4P-RZ).
 * A resposta é presa à lista de categorias por um schema com enum, em lotes de 25.
 */
import { Type, type GoogleGenAI } from '@google/genai';
import {
  montarInstrucoes,
  validarRespostaIA,
  type CategoriaBasica,
  type Classificacao,
  type ExemploParaIA,
  type ItemParaIA,
} from './categorizacao';

export const MAX_ITENS = 200;
const LOTE = 25;

export interface PedidoCategorizacao {
  items: ItemParaIA[];
  categorias: CategoriaBasica[];
  exemplos?: ExemploParaIA[];
}

/** Confere o formato do pedido vindo do app. Retorna mensagem de erro ou null. */
export function validarPedido(p: Partial<PedidoCategorizacao> | undefined): string | null {
  if (!p || !Array.isArray(p.items) || !p.items.length) return 'Nenhum lançamento enviado.';
  if (p.items.length > MAX_ITENS) return `Envie no máximo ${MAX_ITENS} lançamentos por vez.`;
  if (!Array.isArray(p.categorias) || !p.categorias.length) return 'Envie a lista de categorias.';
  if (p.categorias.some((c) => typeof c?.id !== 'string' || typeof c?.name !== 'string')) return 'Categoria inválida.';
  return null;
}

export async function categorizarComGemini(ai: GoogleGenAI, model: string, pedido: PedidoCategorizacao): Promise<Map<string, Classificacao>> {
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
            reason: { type: Type.STRING },
          },
          required: ['id', 'category', 'confidence'],
        },
      },
    },
    required: ['results'],
  };

  const saida = new Map<string, Classificacao>();
  for (let i = 0; i < pedido.items.length; i += LOTE) {
    const lote = pedido.items.slice(i, i + LOTE);
    const resp = await ai.models.generateContent({
      model,
      contents: `Classifique cada lançamento (responda um resultado por id):\n${JSON.stringify(lote)}`,
      config: {
        systemInstruction: instrucoes,
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0,
      },
    });
    let bruto: unknown = {};
    try {
      bruto = JSON.parse(resp.text?.trim() || '{}');
    } catch {
      bruto = {};
    }
    for (const [id, c] of validarRespostaIA(bruto, new Set(lote.map((x) => x.id)), validas)) saida.set(id, c);
  }
  return saida;
}
