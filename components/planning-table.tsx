import { money } from "@/lib/money";
import { projectMonths } from "@/lib/planning";

export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}
export function PlanningTable({ rows, simulation = false }: { rows: ReturnType<typeof projectMonths>; simulation?: boolean }) {
  return <div className="table-scroll planning-table"><table>
    <caption className="sr-only">{simulation ? "Comparação mensal antes e depois da compra" : "Salário e despesas por mês"}</caption>
    <thead><tr><th>Mês</th><th>Salário líquido</th><th>Faturas e despesas</th>{simulation ? <><th>Nova parcela</th><th>Sobra sem compra</th><th>Sobra com compra</th></> : <><th>Ainda a pagar</th><th>Sobra prevista</th></>}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.month}><th scope="row" className="capitalize">{monthLabel(row.month)}</th><td>{money(row.salary)}</td><td>{money(row.expenses)}</td>{simulation ? <><td>{money(row.simulated)}</td><td>{money(row.before)}</td></> : <td>{money(row.pending)}</td>}<td className={`money-cell ${row.after < 0 ? "negative-amount" : "green"}`}>{money(row.after)}{row.after < 0 && <small>Falta no orçamento</small>}</td></tr>)}</tbody>
  </table></div>;
}
export function PlanningNote() {
  return <p className="helper">Projeção mensal, não saldo bancário acumulado. Desconta o valor integral das faturas, despesas e cobranças recebidas no mês, inclusive parcelas já pagas. Cobranças a receber não são tratadas como salário. Atrasos de outros meses não são transferidos para esta projeção.</p>;
}
