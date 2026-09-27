export function parseMoney(input: string): number {
  let normalized = input.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) throw new Error("Informe um valor válido, como 125,90.");
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100_000_000) throw new Error("O valor deve estar entre R$ 0,01 e R$ 1.000.000,00.");
  return cents;
}

export const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
export const dateLabel = (date: Date | string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(date));
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: process.env.TZ || "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Informe uma data válida.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < "2000-01-01" || value > "2100-12-31") throw new Error("Informe uma data entre 2000 e 2100.");
  return date;
}

export function schedule(totalCents: number, count: number, startNumber: number, firstDue: Date) {
  if (!Number.isInteger(count) || count < 1 || count > 360 || !Number.isInteger(startNumber) || startNumber < 1 || startNumber > count) throw new Error("Confira o total de parcelas e a primeira parcela acompanhada (1 a 360).");
  if (!Number.isSafeInteger(totalCents) || totalCents < count || totalCents > 100_000_000) throw new Error("O valor total é inválido ou menor que a quantidade de parcelas em centavos.");
  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  return Array.from({ length: count - startNumber + 1 }, (_, index) => {
    const number = startNumber + index;
    const month = firstDue.getUTCMonth() + index;
    const year = firstDue.getUTCFullYear();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const dueDate = new Date(Date.UTC(year, month, Math.min(firstDue.getUTCDate(), lastDay)));
    if (dueDate.getUTCFullYear() > 2100) throw new Error("A programação ultrapassa o ano 2100.");
    return { number, dueDate, cents: base + (number <= remainder ? 1 : 0) };
  });
}

export function balance(installment: { cents: number; payments: { cents: number; reversedAt: Date | null }[] }) {
  return installment.cents - installment.payments.filter(p => !p.reversedAt).reduce((sum, p) => sum + p.cents, 0);
}
