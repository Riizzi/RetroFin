import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chaveEstabelecimento, classificarPorRegras, ehManual, montarMemoria, ocultarPessoas, separar, validarRespostaIA, type TxBasica } from '../src/services/categorizacao.ts';

const tx = (id: string, description: string, amount: number, extra: Partial<TxBasica> = {}): TxBasica => ({
  id, description, amount, type: amount >= 0 ? 'credit' : 'debit', category: 'outros', date: '2026-10-10', ...extra,
});
const CATS = new Set(['alimentacao', 'snacks', 'transporte', 'contas', 'moradia', 'servicos', 'compras', 'farmacia', 'saude', 'lazer', 'educacao', 'investimentos', 'receitas', 'transacao_interna', 'outros', 'mercado_casa']);

test('chave do estabelecimento ignora intermediador, cidade e números', () => {
  assert.equal(chaveEstabelecimento('IFD*RESTAURANTE SABOR MINEIRO BELO HORIZONT'), 'restaurante sabor mineiro');
  assert.equal(chaveEstabelecimento('Restaurante Sabor Mineiro'), 'restaurante sabor mineiro');
  assert.equal(chaveEstabelecimento('PAG*PadariaBoaVista 0042'), 'padariaboavista');
  assert.equal(chaveEstabelecimento('Pix para Maria Silva'), 'pix maria silva');
});

test('regras usam limite de palavra (TIM não casa com ESTIMA, MERCADO LIVRE não é supermercado)', () => {
  assert.equal(classificarPorRegras('ESTIMATIVA SERVICOS', 'debit'), null);
  assert.equal(classificarPorRegras('MERCADO LIVRE', 'debit')?.category, 'compras');
  assert.equal(classificarPorRegras('Supermercado BH', 'debit')?.category, 'alimentacao');
  assert.equal(classificarPorRegras('UBER* TRIP', 'debit')?.category, 'transporte');
  assert.equal(classificarPorRegras('UBER EATS', 'debit')?.category, 'alimentacao');
  assert.equal(classificarPorRegras('BARBEARIA DO ZE', 'debit'), null);
  assert.equal(classificarPorRegras('CEMIG DISTRIBUICAO', 'debit')?.category, 'contas');
});

test('pix para o próprio titular vira transação interna', () => {
  assert.equal(classificarPorRegras('Pix para João Pedro Rocha Rizzi', 'debit', 'João Pedro Rocha Rizzi')?.category, 'transacao_interna');
});

test('nome de pessoa não vai para a IA; empresa vai', () => {
  assert.equal(ocultarPessoas('Pix para Maria da Silva'), 'Pix para [pessoa]');
  assert.equal(ocultarPessoas('Pix para Padaria Bela Vista LTDA'), 'Pix para Padaria Bela Vista LTDA');
  assert.equal(ocultarPessoas('Drogasil'), 'Drogasil');
});

test('lançamento antigo sem origem: manual se não foi IA e não é outros', () => {
  assert.equal(ehManual(tx('a', 'x', -1, { category: 'lazer', isCategorizedByAI: false })), true);
  assert.equal(ehManual(tx('a', 'x', -1, { category: 'lazer', isCategorizedByAI: true })), false);
  assert.equal(ehManual(tx('a', 'x', -1, { category: 'lazer', categorizedBy: 'usuario', isCategorizedByAI: true })), true);
});

test('memória: sua correção vale para o mesmo estabelecimento e vence as regras', () => {
  const todas = [
    tx('m1', 'IFD*RESTAURANTE SABOR MINEIRO', -40, { category: 'mercado_casa', categorizedBy: 'usuario', date: '2026-10-01' }),
    tx('n1', 'Restaurante Sabor Mineiro', -38),
    tx('n2', 'Lanchonete Desconhecida Xyz', -12),
    tx('m2', 'Pix para Maria Silva', -900, { category: 'moradia', subcategory: 'Aluguel', categorizedBy: 'usuario' }),
    tx('n3', 'Pix para Maria Silva', -900),
  ];
  const { resolvidos, pendentes } = separar(todas, todas, CATS);
  assert.equal(resolvidos.get('n1')?.category, 'mercado_casa');
  assert.equal(resolvidos.get('n1')?.categorizedBy, 'memoria');
  assert.equal(resolvidos.get('n3')?.subcategory, 'Aluguel');
  assert.equal(resolvidos.get('n2')?.category, 'alimentacao'); // regra: lanchonete
  assert.ok(!resolvidos.has('m1') && !resolvidos.has('m2'), 'manuais não são tocados');
  assert.equal(pendentes.length, 0);
  assert.equal(montarMemoria(todas).size, 2);
});

test('resposta da IA com categoria inventada é descartada', () => {
  const r = validarRespostaIA(
    { results: [{ id: 'a', category: 'alimentacao', confidence: 2 }, { id: 'b', category: 'comida', confidence: 0.9 }, { id: 'zz', category: 'lazer' }] },
    new Set(['a', 'b']),
    CATS,
  );
  assert.equal(r.size, 1);
  assert.equal(r.get('a')?.confidence, 1);
});
