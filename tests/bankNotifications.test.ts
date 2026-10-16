import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpretar, montarTransacoes, type NotificacaoBruta } from '../src/services/bankNotifications.ts';
import type { BankAccount } from '../src/types/index.ts';

const n = (pkg: string, title: string, text: string): NotificacaoBruta => ({ id: 'x1', pkg, title, text, postedAt: Date.parse('2026-10-16T15:42:00Z') });

const contas: BankAccount[] = [
  { id: 'nu', name: 'Nubank', institution: 'NUBANK', institutionName: 'Nubank', type: 'CONTA_CORRENTE', purpose: 'Dia a dia', balance: 0, color: '', bgColor: '', borderColor: '' },
  { id: 'inter', name: 'Inter', institution: 'BANCO_INTER', institutionName: 'Banco Inter', type: 'CONTA_CORRENTE', purpose: 'Reserva', balance: 0, color: '', bgColor: '', borderColor: '' },
];

test('compra no crédito do Nubank', () => {
  const r = interpretar(n('com.nu.production', 'Compra aprovada', 'Compra de R$ 38,50 APROVADA em PADARIA BELA VISTA para o cartão com final 1234.'));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.amount, -38.5);
  assert.equal(r.bank, 'NUBANK');
  assert.equal(r.channel, 'CARTAO_CREDITO');
  const [tx] = montarTransacoes(n('com.nu.production', '', ''), r, contas);
  assert.equal(tx.date, '2026-10-16');
  assert.equal(tx.time, '12:42');
  assert.equal(tx.accountId, 'nu');
});

test('pix recebido no Inter vira crédito', () => {
  const r = interpretar(n('br.com.intermedium', 'Pix recebido', 'Você recebeu um Pix de R$ 1.250,00 de MARIA SILVA'));
  assert.ok(r.ok && r.amount === 1250 && r.type === 'credit' && r.channel === 'PIX' && r.bank === 'BANCO_INTER');
});

test('propaganda de limite é ignorada', () => {
  const r = interpretar(n('com.nu.production', 'Boa notícia', 'Você tem R$ 5.000,00 de empréstimo pré-aprovado. Aproveite!'));
  assert.equal(r.ok, false);
});

test('fatura fechada é ignorada', () => {
  const r = interpretar(n('com.nu.production', 'Fatura', 'Sua fatura fechou em R$ 1.234,56 e vence dia 10.'));
  assert.equal(r.ok, false);
});

test('transferência entre contas próprias gera espelho', () => {
  const r = interpretar(n('br.com.intermedium', 'Pix recebido', 'João Pedro Rocha Rizzi te enviou um Pix de R$ 200,00'));
  assert.ok(r.ok);
  if (!r.ok) return;
  const txs = montarTransacoes(n('br.com.intermedium', '', ''), r, contas, 'João Pedro Rocha Rizzi');
  assert.equal(txs.length, 2);
  assert.equal(txs[0].accountId, 'inter');
  assert.equal(txs[0].amount, 200);
  assert.equal(txs[1].accountId, 'nu');
  assert.equal(txs[1].amount, -200);
  assert.equal(txs[0].category, 'transacao_interna');
});
