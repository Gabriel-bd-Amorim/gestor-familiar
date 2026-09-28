import Link from "next/link";
import { User, UserCog, ShieldCheck, Save, X, Calculator } from "lucide-react";
import { profileAction, simulationAction, deleteSimulationAction } from "@/app/actions";
import { ActionForm, Submit } from "./action-form";
import { Simulation } from "@prisma/client";
import { Plus, Trash2, Calculator as CalculatorIcon } from "lucide-react";
import { dateLabel, money, today } from "@/lib/money";
import { getSimulationImpact } from "@/lib/simulation";

export function ProfileForm({ user, activeTab }: { user: { name: string; username: string }; activeTab: string }) {
  return <section className="panel form-panel" aria-label="Editar perfil">
    <div className="panel-heading"><div><h2>Perfil</h2><p>Altere seu nome exibido e seu nome de usuário.</p></div></div>
    <ActionForm action={profileAction} className="stack">
      <label>Nome<input name="name" required minLength={2} maxLength={70} defaultValue={user.name} /></label>
      <label>Usuário<input name="username" autoCapitalize="none" autoComplete="off" pattern="[a-z0-9._-]{3,40}" required minLength={3} maxLength={40} defaultValue={user.username} placeholder="ex.: ana.silva" /></label>
      <div className="form-footer"><Submit>Salvar alterações</Submit><Link href={`/?view=${activeTab}`} className="button secondary">Cancelar</Link></div>
    </ActionForm>
    <p className="helper">O nome de usuário deve ter 3 a 40 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.</p>
  </section>;
}

export function SimulationView({ simulations, month }: { simulations: { id: string; description: string; category: string; totalCents: number; count: number; startNumber: number; firstDue: Date; notes: string | null; createdAt: Date }[]; month: string }) {
  const date = today();
  return <>
    <div className="notice privacy-notice"><CalculatorIcon size={18} />Simulações são privadas e não entram no planejamento real. Elas mostram o impacto estimado das parcelas em cada mês.</div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Suas simulações</h2><p>Parâmetros e impacto no mês selecionado.</p></div></div>
        {simulations.length ? <div className="simulation-list">{simulations.map(sim => {
          const impact = getSimulationImpact(sim, month);
          return <article key={sim.id} className="simulation-item">
            <div className="simulation-heading">
              <div><strong>{sim.description}</strong><small>{sim.category} · {sim.count}x de {money(sim.totalCents / sim.count)} a partir de {dateLabel(sim.firstDue)}</small></div>
              <div className="simulation-impact"><strong>{impact > 0 ? money(impact) : "—"}</strong><small>impacto no mês</small></div>
            </div>
            {sim.notes && <p className="simulation-notes">{sim.notes}</p>}
            <details><summary>Excluir simulação</summary><p className="helper">Esta ação não pode ser desfeita.</p><ActionForm action={deleteSimulationAction} className="stack compact"><input type="hidden" name="simulationId" value={sim.id} /><Submit className="button danger small">Excluir simulação</Submit></ActionForm></details>
          </article>;
        })}</div> : <div className="empty"><CalculatorIcon size={30} /><h3>Nenhuma simulação salva</h3><p>Crie simulações para testar o impacto de uma compra no seu orçamento.</p></div>}
      </section>
      <section className="panel"><h2>Nova simulação</h2><p className="muted">Preencha os dados da compra que deseja testar.</p>
        <ActionForm key={month} action={simulationAction} className="stack">
          <label>Descrição<input name="description" required minLength={2} maxLength={120} placeholder="Ex.: Geladeira nova" /></label>
          <label>Categoria<select name="category">{["Casa", "Alimentação", "Transporte", "Saúde", "Educação", "Compras", "Lazer", "Serviços", "Outros"].map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Valor (R$)<input name="amount" required inputMode="decimal" placeholder="Ex.: 2.500,00" /></label>
          <label>Esse valor é<select name="amountMode"><option value="total">O total da compra</option><option value="installment">O valor de cada parcela</option></select></label>
          <label>Quantidade total de parcelas<input name="count" type="number" min="1" max="360" defaultValue="1" required /></label>
          <label>Primeira parcela a acompanhar<input name="startNumber" type="number" min="1" max="360" defaultValue="1" required /><small>Ex.: 3 para começar em 3/12.</small></label>
          <label>Data da compra<input type="date" name="purchaseDate" required min="2000-01-01" max={date} defaultValue={date} /></label>
          <label>Vencimento da primeira parcela<input type="date" name="firstDue" required min="2000-01-01" max="2100-12-31" defaultValue={date} /></label>
          <label className="full">Observações<textarea name="notes" maxLength={1000} rows={3} placeholder="Ex.: valor estimado, loja, observações" /></label>
          <Submit>Salvar simulação</Submit>
        </ActionForm>
      </section>
    </div>
  </>;
}