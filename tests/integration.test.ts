import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/db';
import { getEntry, listEntries, recordPayment, reversePayment, cancelEntry, summary } from '../lib/finance';
import { schedule, parseDate, balance, today } from '../lib/money';

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
