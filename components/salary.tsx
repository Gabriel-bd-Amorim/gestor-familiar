import { salaryAction, deleteSalaryAction } from "@/app/actions";
import { ActionForm, Submit } from "./action-form";
import { PlanningNote, PlanningTable, monthLabel } from "./planning-table";
import { projectMonths, type SalaryValue, type Commitment } from "@/lib/planning";
import { money } from "@/lib/money";

export function Salary({ salaries, commitments, month }: { salaries: (SalaryValue & { id: string })[]; commitments: Commitment[]; month: string }) {
  const rows = projectMonths(month, 12, salaries, commitments);
  return <div className="stack planning-layout">
    <div className="dashboard-grid"><section className="panel"><h2>Meu salário líquido</h2><p className="muted">Informe o valor que recebe por mês. Ele se repete a partir do mês escolhido até o próximo reajuste cadastrado.</p>
      <ActionForm action={salaryAction} className="stack"><label>Salário mensal (R$)<input name="amount" inputMode="decimal" defaultValue={(rows[0].salary / 100).toFixed(2).replace(".", ",")} required placeholder="Ex.: 3500,00" /></label><label>A partir do mês<input name="startMonth" type="month" defaultValue={month} min="2000-01" max="2100-12" required /></label><Submit>Salvar salário</Submit></ActionForm>
      <p className="helper">Para corrigir, salve novamente no mesmo mês. Para interromper o salário, cadastre R$ 0,00 a partir do mês desejado. Somente você vê estes valores.</p>
    </section><section className="panel"><h2>Histórico de salários</h2>{salaries.length ? <div className="stack">{salaries.map(s => <div className="salary-item" key={s.id}><div><strong>{money(s.cents)} / mês</strong><small>A partir de {monthLabel(s.startMonth)}</small></div><details><summary>Remover</summary><p className="helper">O salário anterior volta a valer nos meses seguintes, se houver.</p><ActionForm action={deleteSalaryAction}><input type="hidden" name="id" value={s.id} /><Submit className="button secondary small">Confirmar remoção</Submit></ActionForm></details></div>)}</div> : <p className="muted">Cadastre seu salário para visualizar quanto pode sobrar.</p>}</section></div>
    <section className="panel"><div className="panel-heading"><h2>Quanto sobra em cada mês</h2><form className="month-form"><input type="hidden" name="view" value="salary" /><label className="sr-only" htmlFor="salary-month">Mês de referência</label><input id="salary-month" name="month" type="month" defaultValue={month} min="2000-01" max="2100-12" required /><button className="button secondary small">Ver mês</button></form></div><PlanningTable rows={rows} /><PlanningNote /></section>
  </div>;
}
