import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/db';
import { getEntry, listEntries, recordPayment, reversePayment, cancelEntry, summary } from '../lib/finance';
import { schedule, parseDate, balance, today } from '../lib/money';
import { recordIncome, cancelIncome, listIncomes } from '../lib/income';

if (!process.env.DATABASE_URL?.includes('/entrecontas_test')) throw new Error('Os testes de integração exigem o banco isolado entrecontas_test.');
after(async () => { await db.$disconnect(); });

test('isolamento, parcelas, pagamentos concorrentes e auditoria', async () => {
  const suffix = randomUUID();
  const owner = await db.user.create({ data: { username: `owner-${suffix}`, name: 'Credor', passwordHash: 'test', mustChangePassword: false } });
  const debtor = await db.user.create({ data: { username: `debtor-${suffix}`, name: 'Devedor', passwordHash: 'test', mustChangePassword: false } });
  const outsider = await db.user.create({ data: { username: `outsider-${suffix}`, name: 'Terceiro administrador', passwordHash: 'test', admin: true, mustChangePassword: false } });
  const privateEntry = await db.entry.create({ data: { ownerId: owner.id, description: 'Fatura privada secreta', notes: 'Observação secreta', category: 'Casa', totalCents: 10000, count: 1, startNumber: 1, purchaseDate: parseDate(today()), installments: { create: schedule(10000, 1, 1, parseDate(today())) } } });
  const sharedEntry = await db.entry.create({ data: { ownerId: owner.id, debtorId: debtor.id, sourceId: privateEntry.id, description: 'Parte compartilhada', category: 'Casa', totalCents: 10000, count: 1, startNumber: 1, purchaseDate: parseDate(today()), installments: { create: schedule(10000, 1, 1, parseDate(today())) } }, include: { installments: true } });
  const installment = sharedEntry.installments[0];
  assert.equal(await getEntry(debtor.id, privateEntry.id), null);
  assert.equal(await getEntry(outsider.id, sharedEntry.id), null);
  assert.equal(await getEntry(outsider.id, privateEntry.id), null);
  assert.deepEqual((await listEntries(debtor.id)).map(e => e.id), [sharedEntry.id]);
  await assert.rejects(recordPayment(outsider.id, sharedEntry.id, installment.id, 1000, today(), '', randomUUID()), /não encontrado/);
  const results = await Promise.allSettled([
    recordPayment(debtor.id, sharedEntry.id, installment.id, 7000, today(), 'Primeiro', randomUUID()),
    recordPayment(owner.id, sharedEntry.id, installment.id, 7000, today(), 'Segundo', randomUUID()),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1, 'somente um pagamento deve caber no saldo');
  let entry = (await getEntry(debtor.id, sharedEntry.id))!;
  assert.equal(balance(entry.installments[0]), 3000);
  const key = randomUUID();
  const [first, second] = await Promise.all([
    recordPayment(debtor.id, sharedEntry.id, installment.id, 2000, today(), '', key),
    recordPayment(debtor.id, sharedEntry.id, installment.id, 2000, today(), '', key),
  ]);
  assert.equal(first.id, second.id, 'o mesmo envio não pode gerar duas baixas');
  entry = (await getEntry(owner.id, sharedEntry.id))!;
  assert.equal(balance(entry.installments[0]), 1000);
  await assert.rejects(cancelEntry(owner.id, sharedEntry.id), /pagamentos ativos/);
  await assert.rejects(reversePayment(owner.id, sharedEntry.id, first.id, 'Correção'), /Somente quem/);
  await reversePayment(debtor.id, sharedEntry.id, first.id, 'Valor incorreto');
  await reversePayment(debtor.id, sharedEntry.id, first.id, 'Repetição segura');
  entry = (await getEntry(owner.id, sharedEntry.id))!;
  assert.equal(balance(entry.installments[0]), 3000);
  assert.equal(summary([entry], owner.id, today().slice(0, 7)).receiving, 3000);
  assert.equal(summary([entry], debtor.id, today().slice(0, 7)).due, 3000);
  await recordPayment(debtor.id, sharedEntry.id, installment.id, 3000, today(), 'Quitação', randomUUID());
  entry = (await getEntry(owner.id, sharedEntry.id))!;
  assert.equal(balance(entry.installments[0]), 0);
  await assert.rejects(recordPayment(debtor.id, sharedEntry.id, installment.id, 1, today(), '', randomUUID()), /ultrapassa/);
  await assert.rejects(cancelEntry(debtor.id, sharedEntry.id), /criador/);
  for (const payment of entry.installments[0].payments.filter(p => !p.reversedAt)) await reversePayment(payment.actorId, sharedEntry.id, payment.id, 'Estorno para cancelar');
  await cancelEntry(owner.id, sharedEntry.id);
  const cancelled = (await getEntry(debtor.id, sharedEntry.id))!;
  assert.ok(cancelled.cancelledAt);
  assert.equal(summary([cancelled], debtor.id, today().slice(0, 7)).due, 0);
  assert.ok(await db.audit.count({ where: { entryId: sharedEntry.id } }) >= 6);
  await assert.rejects(recordPayment(debtor.id, sharedEntry.id, installment.id, 100, today(), '', randomUUID()), /cancelado/);
});

test('salário, outras rendas, privacidade e planejamento sem descontar pagamentos duas vezes', async () => {
  const suffix = randomUUID();
  const owner = await db.user.create({ data: { username: `income-${suffix}`, name: 'Recebedor', passwordHash: 'test' } });
  const other = await db.user.create({ data: { username: `income-other-${suffix}`, name: 'Outro administrador', passwordHash: 'test', admin: true } });
  const input = { kind: 'salary' as const, source: 'Empresa', amount: '3.000,00', receivedAt: '2024-02-05', notes: 'Líquido', requestKey: randomUUID() };
  const salaries = await Promise.all([recordIncome(owner.id, input), recordIncome(owner.id, input)]);
  assert.equal(salaries[0].id, salaries[1].id, 'reenvios concorrentes não duplicam salário');
  await assert.rejects(recordIncome(other.id, input), /envio já foi utilizado/);
  await assert.rejects(recordIncome(owner.id, { ...input, amount: '4000' }), /envio já foi utilizado/);
  await recordIncome(owner.id, { ...input, kind: 'other', source: 'Freelance', amount: '500', requestKey: randomUUID() });
  await recordIncome(owner.id, { ...input, receivedAt: '2024-01-31', requestKey: randomUUID() });
  const foreign = await recordIncome(other.id, { ...input, requestKey: randomUUID() });
  assert.equal((await listIncomes(owner.id, '2024-02')).length, 2);
  assert.equal((await listIncomes(other.id, '2024-02')).length, 1);
  await assert.rejects(cancelIncome(other.id, salaries[0].id), /não encontrada/);
  for (const amount of ['0', '-10', 'abc', '1000000,01']) {
    await assert.rejects(recordIncome(owner.id, { ...input, amount, requestKey: randomUUID() }));
  }
  await assert.rejects(recordIncome(owner.id, { ...input, receivedAt: '2100-12-31', requestKey: randomUUID() }), /futuro/);
  await assert.rejects(recordIncome(owner.id, { ...input, receivedAt: '2024-02-30', requestKey: randomUUID() }), /data/);
  await assert.rejects(recordIncome(owner.id, { ...input, source: ' ', requestKey: randomUUID() }), /origem|veio/);

  const createEntry = (ownerId: string, debtorId: string | null, cents: number, due: string) => db.entry.create({ data: {
    ownerId, debtorId, description: 'Compromisso', category: 'Casa', totalCents: cents, count: 1, startNumber: 1,
    purchaseDate: parseDate(due), installments: { create: schedule(cents, 1, 1, parseDate(due)) },
  }, include: { installments: true } });
  const expense = await createEntry(owner.id, null, 100000, '2024-02-10');
  const charge = await createEntry(owner.id, other.id, 50000, '2024-02-10');
  await createEntry(other.id, owner.id, 20000, '2024-02-20');
  await createEntry(owner.id, null, 99000, '2024-03-01');
  const cancelled = await createEntry(owner.id, null, 99000, '2024-02-15');
  await cancelEntry(owner.id, cancelled.id);
  const report = async () => summary(await listEntries(owner.id), owner.id, '2024-02', [...await listIncomes(owner.id, '2024-02'), foreign]);
  let result = await report();
  assert.equal(result.salary, 300000);
  assert.equal(result.otherIncome, 50000);
  assert.equal(result.total, 120000, 'inclui cobrança a pagar; exclui cobranças a receber, canceladas e outro mês');
  assert.equal(result.budgetBalance, 230000);
  assert.equal(result.projectedBalance, 280000);
  const receipt = await recordPayment(other.id, charge.id, charge.installments[0].id, 20000, '2024-03-01', '', randomUUID());
  result = await report();
  assert.equal(result.received, 20000, 'baixa ajusta o planejamento do mês do vencimento, não do pagamento');
  assert.equal(result.receiving, 30000);
  assert.equal(result.budgetBalance, 250000);
  assert.equal(result.projectedBalance, 280000);
  await recordPayment(owner.id, expense.id, expense.installments[0].id, 30000, '2024-02-10', '', randomUUID());
  result = await report();
  assert.equal(result.due, 90000);
  assert.equal(result.budgetBalance, 250000, 'pagar despesa não devolve renda disponível');
  await reversePayment(other.id, charge.id, receipt.id, 'Corrigir baixa');
  assert.equal((await report()).budgetBalance, 230000);
  await cancelIncome(owner.id, salaries[0].id);
  await cancelIncome(owner.id, salaries[0].id);
  assert.equal((await listIncomes(owner.id, '2024-02')).length, 2, 'cancelamento preserva histórico');
  result = await report();
  assert.equal(result.salary, 0);
  assert.equal(result.budgetBalance, -70000, 'déficit aparece como saldo negativo');
  await assert.rejects(recordIncome(owner.id, input), /envio já foi utilizado/);
  assert.equal(summary(await listEntries(owner.id), owner.id, '2024-03', await listIncomes(owner.id, '2024-02')).income, 0);
});
