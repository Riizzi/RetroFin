import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodificarArquivo, lerCsvExtrato, limparDescricaoExtrato, valorMonetario } from '../src/utils/extrato.ts';
import { parseBankCSV, parseBankOFX } from '../src/utils/ofxParser.ts';
import { separarRepetidos } from '../src/services/duplicados.ts';
import type { Transaction } from '../src/types/index.ts';

const NUBANK_CONTA = `Data,Valor,Identificador,Descrição
01/10/2026,-38.50,6512a1b2-0001,Compra no débito - Padaria Bella Vista
02/10/2026,1250.00,6512a1b2-0002,Transferência recebida pelo Pix - MARIA SILVA - •••.123.456-•• - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 1234-5
03/10/2026,-200.00,6512a1b2-0003,Transferência enviada pelo Pix - JOAO - •••.111.222-•• - BCO INTER`;

const NUBANK_CARTAO = `date,title,amount
2026-10-01,Uber *Trip,23.90
2026-10-02,Ifood *Restaurante,45.10
2026-10-03,Pagamento recebido,-500.00`;

const INTER_CSV = `Extrato Conta Corrente
Conta ;12345678
Período ;01/10/2026 a 15/10/2026
Saldo ;1.234,56

Data Lançamento;Descrição;Valor;Saldo
01/10/2026;Pix enviado: "Cp :18236120-PADARIA BOA";-12,50;1.222,06
02/10/2026;Compra no debito: "No estabelecimento SUPERMERCADO BH";-1.152,37;69,69
05/10/2026;Pix recebido: "Cp :00000000-GOVERNO DE MG";5.200,00;5.269,69`;

const INTER_OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>077</BANKACCTFROM><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261001
<TRNAMT>-12.50
<FITID>202610010001
<MEMO>Pix enviado: PADARIA BOA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261005000000[-3:BRT]
<TRNAMT>5200.00
<FITID>202610050002
<NAME>GOVERNO DE MG
<MEMO>Pix recebido
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

test('Nubank conta: descrição limpa e id estável', () => {
  const t = parseBankCSV(NUBANK_CONTA);
  assert.deepEqual(t.map((x) => [x.date, x.amount, x.description]), [
    ['2026-10-01', -38.5, 'Padaria Bella Vista'],
    ['2026-10-02', 1250, 'Pix de Maria Silva'],
    ['2026-10-03', -200, 'Pix para Joao'],
  ]);
  assert.equal(parseBankCSV(NUBANK_CONTA)[0].id, t[0].id, 'mesmo arquivo, mesmo id');
});

test('Nubank fatura: compras viram saída e o pagamento vira transação interna', () => {
  const t = parseBankCSV(NUBANK_CARTAO);
  assert.equal(t[0].amount, -23.9);
  assert.equal(t[0].category, 'transporte');
  assert.equal(t[2].amount, 500);
  assert.equal(t[2].category, 'transacao_interna');
});

test('Inter CSV com preâmbulo, ponto e vírgula e valores 1.152,37', () => {
  const t = parseBankCSV(INTER_CSV);
  assert.deepEqual(t.map((x) => [x.date, x.amount, x.description]), [
    ['2026-10-01', -12.5, 'Pix para Padaria Boa'],
    ['2026-10-02', -1152.37, 'Supermercado Bh'],
    ['2026-10-05', 5200, 'Pix de Governo de Mg'],
  ]);
});

test('Inter CSV em Windows-1252 é lido com acentos', () => {
  const bytes = new Uint8Array([...'Data Lan'].map((c) => c.charCodeAt(0)).concat([0xe7], [...'amento;Valor\n01/10/2026;-1,00'].map((c) => c.charCodeAt(0))));
  const txt = decodificarArquivo(bytes.buffer);
  assert.ok(txt.startsWith('Data Lançamento'));
  assert.equal(lerCsvExtrato(txt).linhas.length, 1);
});

test('OFX junta NAME e MEMO e ignora horário 00:00', () => {
  const t = parseBankOFX(INTER_OFX);
  assert.equal(t[1].description, 'Pix de Governo de Mg');
  assert.equal(t[1].time, undefined);
});

test('valores em vários formatos', () => {
  assert.equal(valorMonetario('-1.152,37'), -1152.37);
  assert.equal(valorMonetario('23.90'), 23.9);
  assert.equal(valorMonetario('R$ 1,234.56'), 1234.56);
  assert.equal(valorMonetario('50,00-'), -50);
  assert.equal(valorMonetario('(10,00)'), -10);
});

test('limpeza de descrições conhecidas', () => {
  assert.equal(limparDescricaoExtrato('Pagamento de boleto efetuado - CEMIG DISTRIBUICAO'), 'Boleto Cemig Distribuicao');
  assert.equal(limparDescricaoExtrato('Compra no débito via NuPay - iFood'), 'Ifood');
});

test('importar extrato não duplica o que já entrou pela notificação', () => {
  const base = { type: 'debit', category: 'outros', channel: 'PIX', isCategorizedByAI: true, status: 'liquidado' } as const;
  const existentes = [{ ...base, id: 'notif-1', date: '2026-10-01', amount: -12.5, description: 'Pix para Padaria Boa' }] as Transaction[];
  const importados = parseBankCSV(INTER_CSV);
  const { novos, repetidos } = separarRepetidos(importados, existentes);
  assert.equal(repetidos, 1);
  assert.equal(novos.length, 2);
  // reimportar o mesmo arquivo depois não duplica nada
  assert.equal(separarRepetidos(importados, [...existentes, ...novos]).novos.length, 0);
});
