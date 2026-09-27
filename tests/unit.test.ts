import { describe, expect, it } from 'vitest';
import { balance, parseDate, parseMoney, schedule } from '../lib/money';

describe('Dinheiro e programação financeira', () => {
  it('converte reais sem erro de ponto flutuante', () => {
    expect(parseMoney('R$ 1.234,56')).toBe(123456);
    expect(parseMoney('0,29')).toBe(29);
    expect(parseMoney('1234.56')).toBe(123456);
    for (const input of ['-1', '0', '1,999', 'abc', 'NaN', '1000000,01']) expect(() => parseMoney(input)).toThrow();
  });
  it('distribui centavos mantendo exatamente o total original', () => {
    const plan = schedule(10000, 3, 1, parseDate('2026-01-31'));
    expect(plan.map(p => p.cents)).toEqual([3334, 3333, 3333]);
    expect(plan.reduce((sum, p) => sum + p.cents, 0)).toBe(10000);
  });
  it('preserva dia âncora depois de fevereiro e na virada do ano', () => {
    expect(schedule(300, 3, 1, parseDate('2026-01-31')).map(p => p.dueDate.toISOString().slice(0, 10))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(schedule(300, 3, 1, parseDate('2027-12-31')).map(p => p.dueDate.toISOString().slice(0, 10))).toEqual(['2027-12-31', '2028-01-31', '2028-02-29']);
  });
  it('começa na parcela informada sem presumir pagamentos anteriores', () => {
    const plan = schedule(10001, 10, 3, parseDate('2026-09-10'));
    expect(plan).toHaveLength(8);
    expect(plan[0].number).toBe(3);
    expect(plan[0].dueDate.toISOString().slice(0, 10)).toBe('2026-09-10');
    expect(plan.reduce((sum, p) => sum + p.cents, 0)).toBe(8000);
  });
  it('rejeita datas inexistentes e parcelamentos inválidos', () => {
    expect(() => parseDate('2026-02-30')).toThrow();
    expect(() => parseDate('2026-13-01')).toThrow();
    expect(() => schedule(1, 2, 1, new Date())).toThrow();
    expect(() => schedule(100, 2, 3, new Date())).toThrow();
    expect(() => schedule(100, 0, 1, new Date())).toThrow();
  });
  it('ignora estornos e considera somente pagamentos ativos', () => {
    expect(balance({ cents: 10000, payments: [{ cents: 2000, reversedAt: null }, { cents: 4000, reversedAt: new Date() }] })).toBe(8000);
  });
});
