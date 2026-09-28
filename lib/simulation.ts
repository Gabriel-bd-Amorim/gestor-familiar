import { z } from "zod";
import { db } from "./db";
import { parseDate, parseMoney, schedule, today } from "./money";

const simulationSchema = z.object({
  description: z.string().trim().min(2, "Descreva a origem da simulação.").max(120),
  category: z.string().trim().min(1).max(40),
  notes: z.string().trim().max(1000).optional(),
  firstDue: z.string(),
  count: z.number().int().min(1).max(360),
  startNumber: z.number().int().min(1).max(360),
  amount: z.string(),
  amountMode: z.enum(["total", "installment"]),
});

export function listSimulations(ownerId: string) {
  return db.simulation.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSimulation(ownerId: string, input: z.input<typeof simulationSchema>) {
  const { amount, firstDue, count, startNumber, amountMode, ...fields } = simulationSchema.parse(input);
  const cents = parseMoney(amount);
  const fDue = parseDate(firstDue);
  if (count < startNumber) throw new Error("A primeira parcela não pode ser maior que o total.");

  const totalCents = amountMode === "installment" ? cents * count : cents;
  const installments = schedule(totalCents, count, startNumber, fDue);
  if (installments.length === 0) throw new Error("Nenhuma parcela programada.");

  const simulation = await db.simulation.create({
    data: {
      ownerId,
      ...fields,
      totalCents,
      count,
      startNumber,
      firstDue: fDue,
    },
  });
  return simulation;
}

export async function deleteSimulation(ownerId: string, id: string) {
  const result = await db.simulation.deleteMany({ where: { id, ownerId } });
  if (!result.count) throw new Error("Simulação não encontrada.");
}

export function getSimulationImpact(simulation: { totalCents: number; count: number; startNumber: number; firstDue: Date }, month: string) {
  const cents = parseMoney("0");
  const installments = schedule(simulation.totalCents, simulation.count, simulation.startNumber, simulation.firstDue);
  let impact = 0;
  for (const inst of installments) {
    const dueMonth = inst.dueDate.toISOString().slice(0, 7);
    if (dueMonth === month) impact += inst.cents;
  }
  return impact;
}