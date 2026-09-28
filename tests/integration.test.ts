import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/db';
import { getEntry, listEntries, recordPayment, reversePayment, cancelEntry, summary } from '../lib/finance';
import { schedule, parseDate, balance, today } from '../lib/money';
import { saveSalary, listSalaries, deleteSalary, saveSimulation, listSimulations, deleteSimulation } from '../lib/planning-store';

if (!process.env.DATABASE_URL?.includes('/entrecontas_test')) throw new Error('Os testes de integração exigem o banco isolado entrecontas_test.');
after(async () => { await db.$disconnect(); });

test('salários e simulações persistidos são privados, inclusive para outro administrador', async () => {
  const suffix = randomUUID();
  const owner = await db.user.create({ data: { username: `planner-${suffix}`, name: 'Planejador', passwordHash: 'test' } });
  const outsider = await db.user.create({ data: { username: `admin-${suffix}`, name: 'Administrador', passwordHash: 'test', admin: true } });
  const salary = await saveSalary(owner.id, '2026-09', '3000,00');
  await saveSalary(owner.id, '2026-09', '3500,00');
  assert.equal((await listSalaries(owner.id)).length, 1);
  assert.equal((await listSalaries(owner.id))[0].cents, 350000);
  assert.deepEqual(await listSalaries(outsider.id), []);
  await assert.rejects(deleteSalary(outsider.id, salary.id), /não encontrado/);
  await assert.rejects(saveSalary(owner.id, '2026-13', '500'), /data/);
  await assert.rejects(saveSalary(owner.id, '2026-10', '-10'), /válido/);
  const zero = await saveSalary(owner.id, '2026-10', '0,00');
  assert.equal(zero.cents, 0);

  const input = { id: '', name: 'Compra privada', amount: '1000,01', count: 3, firstDue: '2026-10-31' };
  const saved = await saveSimulation(owner.id, input);
  assert.equal((await listSimulations(owner.id))[0].totalCents, 100001);
  assert.deepEqual(await listSimulations(outsider.id), []);
  await assert.rejects(saveSimulation(outsider.id, { ...input, id: saved.id, amount: '1' }), /não encontrada/);
  await assert.rejects(deleteSimulation(outsider.id, saved.id), /não encontrada/);
  await saveSimulation(owner.id, { ...input, id: saved.id, amount: '2000,00' });
  assert.equal((await listSimulations(owner.id))[0].totalCents, 200000);
  assert.equal(await db.entry.count({ where: { ownerId: owner.id } }), 0, 'simular não cria despesa');
  await deleteSimulation(owner.id, saved.id);
  assert.deepEqual(await listSimulations(owner.id), []);
  await deleteSalary(owner.id, salary.id);
  assert.equal((await listSalaries(owner.id)).length, 1);
});

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
