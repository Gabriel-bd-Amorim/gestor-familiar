"use client";

import Link from "next/link";
import { useState } from "react";
import { simulationAction, deleteSimulationAction } from "@/app/actions";
import { parseDate, parseMoney, money } from "@/lib/money";
import { projectMonths, type SalaryValue, type Commitment, type Purchase } from "@/lib/planning";
import { ActionForm, Submit } from "./action-form";
import { PlanningNote, PlanningTable } from "./planning-table";

export type SavedSimulation = Purchase & { id: string; name: string };
export function PurchaseSimulator({ salaries, commitments, saved, selected, date }: { salaries: SalaryValue[]; commitments: Commitment[]; saved: SavedSimulation[]; selected?: SavedSimulation; date: string }) {
  const [name, setName] = useState(selected?.name ?? "");
  const [amount, setAmount] = useState(selected ? (selected.totalCents / 100).toFixed(2).replace(".", ",") : "");
  const [count, setCount] = useState(String(selected?.count ?? 1));
  const [firstDue, setFirstDue] = useState(selected?.firstDue ?? date);
  let rows: ReturnType<typeof projectMonths> = [];
  let error = "";
  if (amount) {
    try {
      parseDate(firstDue);
      rows = projectMonths(firstDue.slice(0, 7), Math.max(12, Number(count)), salaries, commitments, { totalCents: parseMoney(amount), count: Number(count), firstDue });
    } catch (e) { error = e instanceof Error ? e.message : "Confira os valores da compra."; }
  }
  return <div className="stack planning-layout">
    {!salaries.length && <p className="notice">Cadastre seu <Link className="text-link" href="/?view=salary">salário</Link> para calcular a sobra mensal. Por enquanto, a renda considerada é zero.</p>}
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><h2>{selected ? "Editar simulação" : "Planejar uma compra"}</h2>{selected && <Link className="text-link" href="/?view=simulator">Nova simulação</Link>}</div>
      <ActionForm action={simulationAction} className="form-grid">
        <input type="hidden" name="id" value={selected?.id ?? ""} />
        <label className="full">Nome da simulação<input name="name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={120} placeholder="Ex.: Notebook novo" required /></label>
        <label>Valor total da compra (R$)<input name="amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Ex.: 2400,00" required /></label>
        <label>Quantidade de parcelas<input name="count" type="number" min={1} max={360} step={1} value={count} onChange={e => setCount(e.target.value)} required /></label>
        <label className="full">Primeiro vencimento<input name="firstDue" type="date" min="2000-01-01" max="2100-12-31" value={firstDue} onChange={e => setFirstDue(e.target.value)} required /></label>
        <p className="helper full">A prévia muda conforme você preenche. Informe o total final, incluindo juros, se houver. Salvar uma simulação não cria uma despesa.</p>
        <Submit disabled={!rows.length}>{selected ? "Salvar alterações" : "Salvar simulação"}</Submit>
      </ActionForm>
    </section><section className="panel"><h2>Simulações salvas</h2><p className="muted">Reabra para comparar ou editar. Cada cenário é independente e usa seus salários e despesas atualizados.</p>{saved.length ? <div className="stack">{saved.map(s => <div className="saved-simulation" key={s.id}><Link href={`/?view=simulator&simulation=${s.id}`} aria-current={selected?.id === s.id ? "page" : undefined}><strong>{s.name}</strong><small>{money(s.totalCents)} · {s.count} parcela(s)</small></Link><details><summary>Excluir</summary><ActionForm action={deleteSimulationAction}><input type="hidden" name="id" value={s.id} /><Submit className="button secondary small">Confirmar exclusão</Submit></ActionForm></details></div>)}</div> : <p className="muted">Suas simulações ficam guardadas aqui, visíveis apenas para você.</p>}</section></div>
    <section className="panel"><div className="panel-heading"><div><h2>Impacto nos próximos meses</h2><p>Salário menos os compromissos do mês, antes e depois da compra.</p></div></div>{error ? <p className="notice error" role="alert">{error}</p> : rows.length ? <PlanningTable rows={rows} simulation /> : <p className="muted">Preencha o valor e as parcelas para ver a comparação.</p>}<PlanningNote /></section>
  </div>;
}
