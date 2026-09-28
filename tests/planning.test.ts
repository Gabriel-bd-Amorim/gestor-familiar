import { describe, expect, it } from 'vitest';
import { parseMonth, projectMonths } from '../lib/planning';

describe('projeção de salário e compras', () => {
  it('aplica reajustes e interrupção a partir do mês correto sem alterar o passado', () => {
    const rows = projectMonths('2026-12', 4, [
      { startMonth: '2027-02', cents: 0 },
      { startMonth: '2026-11', cents: 300000 },
      { startMonth: '2027-01', cents: 350000 },
    ], []);
    expect(rows.map(r => r.salary)).toEqual([300000, 350000, 0, 0]);
    expect(projectMonths('2026-10', 1, [{ startMonth: '2026-11', cents: 300000 }], [])[0].salary).toBe(0);
  });
  it('distribui os centavos e preserva parcelas em fim de mês e virada de ano', () => {
    const rows = projectMonths('2026-12', 4, [], [], { totalCents: 10000, count: 3, firstDue: '2026-12-31' });
    expect(rows.map(r => r.simulated)).toEqual([3334, 3333, 3333, 0]);
    expect(rows[2].month).toBe('2027-02');
    expect(rows.reduce((sum, r) => sum + r.simulated, 0)).toBe(10000);
  });
  it('desconta despesas pagas e pendentes sem inventar renda nem acumular saldos', () => {
    const rows = projectMonths('2026-09', 2, [{ startMonth: '2026-09', cents: 100000 }], [
      { date: '2026-09-02', cents: 60000, remaining: 0 },
      { date: '2026-09-10', cents: 50000, remaining: 30000 },
      { date: '2026-08-10', cents: 90000, remaining: 90000 },
    ], { totalCents: 20000, count: 1, firstDue: '2026-09-30' });
    expect(rows[0]).toMatchObject({ expenses: 110000, pending: 30000, before: -10000, after: -30000 });
    expect(rows[1].after).toBe(100000);
  });
  it('recusa meses, parcelas e datas inválidas e respeita o limite de 2100', () => {
    expect(() => parseMonth('2026-13')).toThrow();
    expect(() => parseMonth('2026-01-extra')).toThrow();
    expect(() => projectMonths('2026-01', 0, [], [])).toThrow();
    expect(() => projectMonths('2026-01', 12, [], [], { totalCents: 1, count: 2, firstDue: '2026-01-01' })).toThrow();
    expect(() => projectMonths('2100-12', 12, [], [], { totalCents: 100, count: 2, firstDue: '2100-12-31' })).toThrow();
    expect(projectMonths('2100-12', 12, [], [])).toHaveLength(1);
  });
});
