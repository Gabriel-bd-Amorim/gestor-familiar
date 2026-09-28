import { parseDate, schedule } from "./money";

export type SalaryValue = { startMonth: string; cents: number };
export type Commitment = { date: string; cents: number; remaining: number };
export type Purchase = { totalCents: number; count: number; firstDue: string };

export function parseMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Informe um mês válido.");
  parseDate(`${month}-01`);
  return month;
}

export function projectMonths(startMonth: string, months: number, salaries: SalaryValue[], commitments: Commitment[], purchase?: Purchase) {
  const start = parseDate(`${parseMonth(startMonth)}-01`);
  if (!Number.isInteger(months) || months < 1 || months > 360) throw new Error("Escolha de 1 a 360 meses.");
  const installments = purchase ? schedule(purchase.totalCents, purchase.count, 1, parseDate(purchase.firstDue)) : [];
  const orderedSalaries = [...salaries].sort((a, b) => b.startMonth.localeCompare(a.startMonth));
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    if (date.getUTCFullYear() > 2100) return null;
    const month = date.toISOString().slice(0, 7);
    const salary = orderedSalaries.find(s => s.startMonth <= month)?.cents ?? 0;
    const rows = commitments.filter(c => c.date.startsWith(month));
    // Use the full monthly expense: paying an installment does not create extra income.
    const expenses = rows.reduce((sum, c) => sum + c.cents, 0);
    const pending = rows.reduce((sum, c) => sum + c.remaining, 0);
    const simulated = installments.filter(i => i.dueDate.toISOString().startsWith(month)).reduce((sum, i) => sum + i.cents, 0);
    return { month, salary, expenses, pending, simulated, before: salary - expenses, after: salary - expenses - simulated };
  }).filter(row => row !== null);
}
