import { Prisma } from "@prisma/client";
import { db } from "./db";
import { balance, money, parseDate, today } from "./money";

export const entryInclude = {
  owner: { select: { id: true, name: true } },
  debtor: { select: { id: true, name: true } },
  installments: { orderBy: { number: "asc" as const }, include: { payments: { orderBy: { createdAt: "desc" as const }, include: { actor: { select: { name: true } } } } } },
} satisfies Prisma.EntryInclude;
export type FullEntry = Prisma.EntryGetPayload<{ include: typeof entryInclude }>;
export function visibleEntries(userId: string): Prisma.EntryWhereInput {
  return { OR: [{ ownerId: userId }, { debtorId: userId }] };
}
export function listEntries(userId: string) {
  return db.entry.findMany({ where: visibleEntries(userId), include: entryInclude, orderBy: { createdAt: "desc" } });
}
export function getEntry(userId: string, id: string) {
  return db.entry.findFirst({ where: { id, ...visibleEntries(userId) }, include: entryInclude });
}
export function summary(entries: FullEntry[], userId: string, month: string) {
  const monthStart = `${month}-01`;
  const now = today();
  const rows = entries.filter(e => !e.cancelledAt).flatMap(entry => entry.installments.map(installment => ({ entry, installment, remaining: balance(installment), date: installment.dueDate.toISOString().slice(0, 10), incoming: entry.debtorId !== null && entry.ownerId === userId })));
  const outgoing = rows.filter(r => !r.incoming);
  const inMonth = outgoing.filter(r => r.date.startsWith(month));
  return {
    due: inMonth.reduce((sum, r) => sum + r.remaining, 0),
    paid: inMonth.reduce((sum, r) => sum + r.installment.cents - r.remaining, 0),
    receiving: rows.filter(r => r.incoming && r.date.startsWith(month)).reduce((sum, r) => sum + r.remaining, 0),
    overdue: outgoing.filter(r => r.date < now && r.remaining > 0).reduce((sum, r) => sum + r.remaining, 0),
    previous: outgoing.filter(r => r.date < monthStart && r.remaining > 0).reduce((sum, r) => sum + r.remaining, 0),
    total: inMonth.reduce((sum, r) => sum + r.installment.cents, 0),
    rows,
  };
}

async function lockEntry(tx: Prisma.TransactionClient, entryId: string, userId: string) {
  await tx.$queryRaw`SELECT id FROM "Entry" WHERE id = ${entryId} AND ("ownerId" = ${userId} OR "debtorId" = ${userId}) FOR UPDATE`;
  const entry = await tx.entry.findFirst({ where: { id: entryId, ...visibleEntries(userId) }, include: entryInclude });
  if (!entry) throw new Error("Lançamento não encontrado.");
  return entry;
}

export async function recordPayment(userId: string, entryId: string, installmentId: string, cents: number, paidAt: string, note: string, requestKey: string) {
  if (!Number.isInteger(cents) || cents < 1 || cents > 100_000_000) throw new Error("Valor inválido.");
  if (!/^[0-9a-f-]{36}$/i.test(requestKey)) throw new Error("Identificador de pagamento inválido.");
  const date = parseDate(paidAt);
  if (paidAt > today()) throw new Error("A data de pagamento não pode estar no futuro.");
  if (note.length > 300) throw new Error("A observação deve ter até 300 caracteres.");
  return db.$transaction(async tx => {
    const entry = await lockEntry(tx, entryId, userId);
    if (entry.cancelledAt) throw new Error("Este lançamento foi cancelado.");
    const old = await tx.payment.findUnique({ where: { requestKey } });
    if (old) {
      if (old.actorId === userId && old.installmentId === installmentId && old.cents === cents) return old;
      throw new Error("Identificador de pagamento já utilizado. Atualize a página.");
    }
    const installment = entry.installments.find(i => i.id === installmentId);
    if (!installment) throw new Error("Parcela não encontrada.");
    if (cents > balance(installment)) throw new Error("O pagamento ultrapassa o saldo pendente da parcela. Atualize os valores.");
    const payment = await tx.payment.create({ data: { installmentId, actorId: userId, requestKey, cents, paidAt: date, note } });
    await tx.audit.create({ data: { entryId, actorId: userId, message: `Pagamento de ${money(cents)} na parcela ${installment.number}/${entry.count}.` } });
    return payment;
  });
}

export async function reversePayment(userId: string, entryId: string, paymentId: string, reason: string) {
  if (reason.trim().length < 3 || reason.length > 300) throw new Error("Informe o motivo do estorno (3 a 300 caracteres).");
  await db.$transaction(async tx => {
    const entry = await lockEntry(tx, entryId, userId);
    const payment = entry.installments.flatMap(i => i.payments).find(p => p.id === paymentId);
    if (!payment || payment.actorId !== userId) throw new Error("Somente quem registrou o pagamento pode estorná-lo.");
    if (payment.reversedAt) return;
    await tx.payment.update({ where: { id: paymentId }, data: { reversedAt: new Date(), reversedById: userId, reversalNote: reason } });
    await tx.audit.create({ data: { entryId, actorId: userId, message: `Estorno de ${money(payment.cents)}. Motivo: ${reason}` } });
  });
}

export async function cancelEntry(userId: string, entryId: string) {
  await db.$transaction(async tx => {
    const entry = await lockEntry(tx, entryId, userId);
    if (entry.ownerId !== userId) throw new Error("Somente o criador pode cancelar este lançamento.");
    if (entry.cancelledAt) return;
    if (entry.installments.some(i => balance(i) !== i.cents)) throw new Error("Há pagamentos ativos. Eles precisam ser estornados por quem os registrou antes do cancelamento.");
    await tx.entry.update({ where: { id: entryId }, data: { cancelledAt: new Date() } });
    await tx.audit.create({ data: { entryId, actorId: userId, message: "Lançamento cancelado. Histórico preservado." } });
  });
}
