import { db } from "./db";
import { parseDate, parseMoney, schedule } from "./money";
import { parseMonth } from "./planning";

export function listSalaries(userId: string) {
  return db.salary.findMany({ where: { userId }, orderBy: { startMonth: "desc" } });
}
export async function saveSalary(userId: string, startMonth: string, amount: string) {
  parseMonth(startMonth);
  const cents = /^0([.,]0{1,2})?$/.test(amount.trim()) ? 0 : parseMoney(amount);
  return db.salary.upsert({ where: { userId_startMonth: { userId, startMonth } }, create: { userId, startMonth, cents }, update: { cents } });
}
export async function deleteSalary(userId: string, id: string) {
  const result = await db.salary.deleteMany({ where: { id, userId } });
  if (!result.count) throw new Error("Salário não encontrado.");
}
export function listSimulations(userId: string) {
  return db.purchaseSimulation.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
}
export async function saveSimulation(userId: string, input: { id: string; name: string; amount: string; count: number; firstDue: string }) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) throw new Error("Dê um nome à simulação (2 a 120 caracteres).");
  const totalCents = parseMoney(input.amount);
  const firstDue = parseDate(input.firstDue);
  schedule(totalCents, input.count, 1, firstDue);
  const data = { name, totalCents, count: input.count, firstDue };
  if (!input.id) return db.purchaseSimulation.create({ data: { ...data, userId } });
  const result = await db.purchaseSimulation.updateMany({ where: { id: input.id, userId }, data });
  if (!result.count) throw new Error("Simulação não encontrada.");
  return { id: input.id };
}
export async function deleteSimulation(userId: string, id: string) {
  const result = await db.purchaseSimulation.deleteMany({ where: { id, userId } });
  if (!result.count) throw new Error("Simulação não encontrada.");
}
