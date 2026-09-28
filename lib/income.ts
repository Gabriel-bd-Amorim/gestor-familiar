import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { parseDate, parseMoney, today } from "./money";

const incomeSchema = z.object({
  kind: z.enum(["salary", "other"], { message: "Escolha salário ou outra renda." }),
  source: z.string().trim().min(2, "Informe de onde veio a renda.").max(120, "A origem deve ter até 120 caracteres."),
  amount: z.string(),
  receivedAt: z.string(),
  notes: z.string().trim().max(1000, "As observações devem ter até 1.000 caracteres."),
  requestKey: z.string().uuid("Identificador inválido. Atualize a página."),
});

export function listIncomes(ownerId: string, month: string) {
  const start = parseDate(`${month}-01`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return db.income.findMany({
    where: { ownerId, receivedAt: { gte: start, lt: end } },
    orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function recordIncome(ownerId: string, input: z.input<typeof incomeSchema>) {
  const { amount, receivedAt, ...fields } = incomeSchema.parse(input);
  const cents = parseMoney(amount);
  const date = parseDate(receivedAt);
  if (receivedAt > today()) throw new Error("Registre somente rendas já recebidas. A data não pode estar no futuro.");
  // A chave evita que reenvios ou cliques concorrentes dupliquem o recebimento.
  const income = await db.income.create({ data: { ...fields, cents, receivedAt: date, ownerId } }).catch(async error => {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await db.income.findUnique({ where: { requestKey: fields.requestKey } });
    if (!existing) throw error;
    return existing;
  });
  if (income.ownerId !== ownerId || income.kind !== fields.kind || income.source !== fields.source ||
      income.cents !== cents || income.receivedAt.getTime() !== date.getTime() || income.notes !== fields.notes || income.cancelledAt) {
    throw new Error("Este envio já foi utilizado. Atualize a página para registrar outra renda.");
  }
  return income;
}

export async function cancelIncome(ownerId: string, id: string) {
  const result = await db.income.updateMany({ where: { id, ownerId, cancelledAt: null }, data: { cancelledAt: new Date() } });
  if (!result.count && !await db.income.findFirst({ where: { id, ownerId } })) throw new Error("Renda não encontrada.");
}
