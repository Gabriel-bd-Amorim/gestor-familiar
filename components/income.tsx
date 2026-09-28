import { randomUUID } from "node:crypto";
import Link from "next/link";
import type { Income } from "@prisma/client";
import { Banknote, Plus } from "lucide-react";
import { incomeAction, cancelIncomeAction } from "@/app/actions";
import { ActionForm, Submit } from "./action-form";
import type { summary } from "@/lib/finance";
import { dateLabel, money, today } from "@/lib/money";

export function IncomeSummary({ report, month }: { report: ReturnType<typeof summary>; month: string }) {
  return <section className="panel income-summary" aria-label="Renda e planejamento do mês">
    <div className="panel-heading"><div><h2>Quanto sobra no mês?</h2><p>Salário e outras rendas comparados aos seus compromissos.</p></div><Link href={`/?view=income&month=${month}`} className="text-link"><Plus size={16} />Registrar renda</Link></div>
    <div className="stat-grid">
      <article className="stat-card"><span className="stat-label">Salário recebido <Banknote size={19} /></span><strong>{money(report.salary)}</strong><small>Valor líquido registrado no mês</small></article>
      <article className="stat-card"><span className="stat-label">Outras rendas</span><strong>{money(report.otherIncome)}</strong><small>Freelances, vendas, benefícios e outras origens</small></article>
      <article className={`stat-card ${report.budgetBalance < 0 ? "alert-stat" : ""}`}><span className="stat-label">Saldo do planejamento</span><strong>{money(report.budgetBalance)}</strong><small>{report.budgetBalance < 0 ? "Falta para cobrir os compromissos do mês" : "Sobra após reservar todos os compromissos do mês"}</small></article>
      <article className="stat-card"><span className="stat-label">Se receber as pendências</span><strong>{money(report.projectedBalance)}</strong><small>Projeção com {money(report.receiving)} ainda a receber</small></article>
    </div>
    <p className="helper">Rendas ({money(report.income)}) + recebido das cobranças do mês ({money(report.received)}) − despesas e cobranças a pagar do mês ({money(report.total)}) = {money(report.budgetBalance)}.</p>
    <p className="helper">Este é um planejamento, não um saldo bancário. Inclui parcelas pagas e pendentes pelo mês de vencimento; baixas e estornos das cobranças ajustam esse mesmo mês. Rendas entram pela data do recebimento. Saldos anteriores não são transportados.</p>
    {report.previous > 0 && <p className="notice">Além deste planejamento, há {money(report.previous)} pendentes de meses anteriores.</p>}
  </section>;
}

export function IncomeView({ incomes, month }: { incomes: Income[]; month: string }) {
  const date = today();
  return <>
    <p className="notice privacy-notice">Suas rendas são privadas. Registre cada recebimento uma vez, inclusive o salário de cada mês. Cobranças recebidas já entram no cálculo automaticamente: não as cadastre como outra renda.</p>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Recebimentos do mês</h2><p>Origem e valor de cada entrada.</p></div></div>
        {incomes.length ? <div className="income-list">{incomes.map(income => <article key={income.id} className="income-item">
          <div className="income-heading"><div><strong>{income.source}</strong><small>{income.kind === "salary" ? "Salário" : "Outra renda"} · {dateLabel(income.receivedAt)}</small></div><strong>{money(income.cents)}</strong></div>
          {income.notes && <p className="income-notes">{income.notes}</p>}
          {income.cancelledAt ? <span className="badge">Cancelada · fora do cálculo</span> : <details><summary>Corrigir recebimento</summary><p className="helper">Cancele este registro e cadastre o valor correto. O histórico será preservado.</p><ActionForm action={cancelIncomeAction} className="stack compact"><input type="hidden" name="incomeId" value={income.id} /><Submit className="button danger small">Cancelar renda de {income.source}</Submit></ActionForm></details>}
        </article>)}</div> : <div className="empty"><Banknote size={30} /><h3>Nenhuma renda registrada neste mês</h3><p>Adicione seu salário líquido e diga de onde vieram suas outras rendas.</p></div>}
      </section>
      <section className="panel"><h2>Registrar recebimento</h2><p className="muted">Informe o valor que efetivamente recebeu.</p>
        <ActionForm key={month} action={incomeAction} className="stack">
          <input type="hidden" name="requestKey" value={randomUUID()} />
          <label>Tipo de renda<select name="kind"><option value="salary">Salário</option><option value="other">Outra renda</option></select></label>
          <label>Origem da renda<input name="source" required minLength={2} maxLength={120} placeholder="Ex.: Empresa onde trabalho, freelance, venda" /></label>
          <label>Valor recebido (R$)<input name="amount" required inputMode="decimal" placeholder="Ex.: 3.000,00" /></label>
          <label>Data do recebimento<input name="receivedAt" type="date" required min="2000-01-01" max={date} defaultValue={month === date.slice(0, 7) || month > date.slice(0, 7) ? date : `${month}-01`} /></label>
          <label>Observações privadas<textarea name="notes" maxLength={1000} rows={3} placeholder="Ex.: salário líquido, adiantamento ou serviço realizado" /></label>
          <Submit>Registrar renda</Submit>
        </ActionForm>
      </section>
    </div>
  </>;
}
