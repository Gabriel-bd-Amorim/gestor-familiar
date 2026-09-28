import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, CalendarDays, Check, CircleAlert, Plus, LockKeyhole, WalletCards, Sparkles, Users, ChevronRight, ReceiptText, UserCog } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listEntries, summary, type FullEntry } from "@/lib/finance";
import { listIncomes } from "@/lib/income";
import { listSimulations } from "@/lib/simulation";
import { IncomeSummary, IncomeView } from "@/components/income";
import { ProfileForm } from "@/components/simulation";
import { SimulationView } from "@/components/simulation";
import { balance, money, dateLabel, today } from "@/lib/money";
import { accountAction, createUserAction, manageUserAction, profileAction, simulationAction, deleteSimulationAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { EntryForm } from "@/components/entry-form";
import { Assistant } from "@/components/assistant";
import { Refresh } from "@/components/refresh";

export const dynamic = "force-dynamic";
const titles: Record<string, [string, string]> = {
  overview: ["Visão geral", "Um olhar tranquilo para suas finanças."],
  income: ["Salário e rendas", "Saiba de onde vem seu dinheiro e quanto sobra no mês."],
  simulations: ["Simulações", "Teste o impacto de uma compra no seu orçamento antes de decidir."],
  expenses: ["Minhas despesas", "Cada conta tem uma história. Acompanhe a sua."],
  receiving: ["A receber", "O que você compartilhou, com tudo bem explicado."],
  debts: ["Contas recebidas", "Cobranças direcionadas a você. Acerte no seu ritmo."],
  accounts: ["Contas e cartões", "Organize de onde vêm suas despesas."],
  assistant: ["Seu assistente financeiro", "Transforme seus números em próximos passos."],
  users: ["Pessoas da casa", "Acessos individuais. Finanças independentes."],
  new: ["Novo lançamento", "Dê um lugar para cada conta."],
  profile: ["Perfil", "Atualize seu nome e seu nome de usuário."],
};
function Empty({ text = "Nenhum lançamento por aqui", detail = "Adicione sua primeira conta para começar a organizar o mês." }: { text?: string; detail?: string }) {
  return <div className="empty"><ReceiptText size={30} /><h3>{text}</h3><p>{detail}</p></div>;
}
function Entries({ entries, userId, month }: { entries: FullEntry[]; userId: string; month: string }) {
  if (!entries.length) return <Empty />;
  return <div className="entry-list">{entries.map(entry => {
    const paid = entry.installments.reduce((s, i) => s + i.cents - balance(i), 0);
    const remaining = entry.installments.reduce((s, i) => s + balance(i), 0);
    const current = entry.installments.find(i => i.dueDate.toISOString().startsWith(month)) ?? entry.installments.find(i => balance(i) > 0) ?? entry.installments.at(-1)!;
    return <Link href={`/entries/${entry.id}`} key={entry.id} className="entry-row"><span className={`entry-icon ${entry.debtorId ? "shared" : ""}`}>{entry.debtorId ? <Users size={20} /> : <ReceiptText size={20} />}</span><div className="entry-main"><strong>{entry.description}</strong><small>{entry.category} · {entry.debtorId ? entry.ownerId === userId ? `Para ${entry.debtor?.name}` : `De ${entry.owner.name}` : "Só você"}</small></div><div className="entry-installment"><span>Parcela {current.number}/{entry.count}</span><small>{dateLabel(current.dueDate)}</small></div><div className="entry-amount"><strong>{money(current.cents)}</strong><small>{entry.cancelledAt ? "Cancelada" : remaining === 0 ? "Tudo pago" : paid > 0 ? `${money(remaining)} restante` : "Acompanhar"}</small></div><ChevronRight size={17} /></Link>;
  })}</div>;
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const requested = typeof params.view === "string" ? params.view : "overview";
  const view = titles[requested] && (requested !== "users" || user.admin) ? requested : "overview";
  const month = typeof params.month === "string" && /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : today().slice(0, 7);
  const [entries, incomes, simulations] = await Promise.all([
    listEntries(user.id),
    listIncomes(user.id, month),
    listSimulations(user.id),
  ]);
  const report = summary(entries, user.id, month, incomes);
  const [title, subtitle] = titles[view];
  const privateEntries = entries.filter((e: FullEntry) => !e.debtorId);
  const incoming = entries.filter((e: FullEntry) => e.debtorId && e.ownerId === user.id);
  const debts = entries.filter((e: FullEntry) => e.debtorId === user.id);
  const forecast = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + index + 1);
    const key = date.toISOString().slice(0, 7);
    return { date, key, total: report.rows.filter(r => !r.incoming && r.date.startsWith(key)).reduce((sum, r) => sum + r.remaining, 0) };
  });
  const forecastMax = Math.max(1, ...forecast.map(f => f.total));
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  return <Shell user={user} active={view}><Refresh />
    <div className="page-heading"><div><div className="eyebrow">{view === "overview" ? `OLÁ, ${user.name.split(" ")[0].toUpperCase()} 👋` : "SEU ESPAÇO FINANCEIRO"}</div><h1>{title}</h1><p>{subtitle}</p></div>{view !== "new" && view !== "users" && <Link href="/?view=new" className="button"><Plus size={18} />Novo lançamento</Link>}</div>
    {["overview", "income"].includes(view) && <>
      <div className="section-toolbar"><div className="section-label"><CalendarDays size={18} /><span className="capitalize">{monthLabel}</span></div><form className="month-form"><input type="hidden" name="view" value={view} /><label className="sr-only" htmlFor="month">Mês de referência</label><input id="month" name="month" type="month" min="2000-01" max="2100-12" defaultValue={month} required /><button className="button secondary small">Ver mês</button></form></div>
      <IncomeSummary report={report} month={month} />
    </>}
    {view === "income" && <IncomeView incomes={incomes} month={month} />}
    {view === "overview" && <>
      <section className="stat-grid" aria-label="Resumo financeiro"><article className="stat-card featured"><span className="stat-label">A pagar no mês <ArrowUpRight size={19} /></span><strong>{money(report.due)}</strong><small>Saldo das parcelas com vencimento no mês</small></article><article className="stat-card"><span className="stat-label">A receber no mês <ArrowDownLeft size={19} /></span><strong>{money(report.receiving)}</strong><small>Cobranças compartilhadas pendentes</small></article><article className="stat-card"><span className="stat-label">Pago nas parcelas do mês <Check size={19} /></span><strong>{money(report.paid)}</strong><small>{report.total > 0 ? `${Math.round(report.paid / report.total * 100)}% dos compromissos concluídos` : "Seu progresso começa aqui"}</small></article><article className={`stat-card ${report.overdue > 0 ? "alert-stat" : ""}`}><span className="stat-label">Em atraso <CircleAlert size={19} /></span><strong>{money(report.overdue)}</strong><small>Todos os meses · posição de hoje</small></article></section>
      <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h2>Suas parcelas do mês</h2><p>Um compromisso de cada vez.</p></div><Link href="/?view=expenses" className="text-link">Ver despesas <ArrowRight size={16} /></Link></div>
        {report.rows.filter(r => !r.incoming && r.date.startsWith(month)).length === 0 ? <Empty text="Um novo começo para suas contas" detail="Cadastre suas despesas e acompanhe cada parcela aqui." /> : <div className="table-scroll"><table><thead><tr><th>Descrição</th><th>Parcela</th><th>Vencimento</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>{report.rows.filter(r => !r.incoming && r.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date)).map(r => <tr key={r.installment.id}><td><Link className="table-title" href={`/entries/${r.entry.id}`}>{r.entry.description}</Link><small>{r.entry.category}{r.entry.debtorId ? ` · De ${r.entry.owner.name}` : ""}</small></td><td><span className="parcel-pill">{r.installment.number}/{r.entry.count}</span></td><td>{dateLabel(r.installment.dueDate)}</td><td className="money-cell">{money(r.remaining)}</td><td><span className={`badge ${r.remaining === 0 ? "paid" : r.date < today() ? "late" : ""}`}>{r.remaining === 0 ? "Paga" : r.date < today() ? "Em atraso" : r.remaining < r.installment.cents ? "Parcial" : "Pendente"}</span></td></tr>)}</tbody></table></div>}
        {report.previous > 0 && <div className="panel-note">{money(report.previous)} pendentes em meses anteriores ao selecionado. Consulte o histórico nas despesas.</div>}
      </section><section className="panel"><div className="panel-heading"><div><h2>Para onde vai</h2><p>Compromissos por categoria</p></div></div>{(() => {
        const categories = new Map<string, number>();
        report.rows.filter(r => !r.incoming && r.date.startsWith(month)).forEach(r => categories.set(r.entry.category, (categories.get(r.entry.category) || 0) + r.installment.cents));
        return categories.size ? <div className="category-list">{[...categories].sort((a, b) => b[1] - a[1]).map(([category, cents], i) => <div key={category}><div><span><i className={`category-dot dot-${i % 4}`} />{category}</span><strong>{money(cents)}</strong></div><div className="progress"><span className={`bar-${i % 4}`} style={{ width: `${cents / report.total * 100}%` }} /></div></div>)}</div> : <Empty text="Tudo no seu lugar" detail="Suas categorias aparecem ao adicionar despesas neste mês." />;
      })()}</section></div>
      <div className="dashboard-grid bottom-grid"><section className="panel"><div className="panel-heading"><div><h2>Olhando para frente</h2><p>Saldo a pagar nos próximos seis meses</p></div><CalendarDays size={20} className="muted" /></div><div className="forecast">{forecast.map(({ date, key, total }) => {
        return <div key={key}><strong>{money(total)}</strong><div className="forecast-track"><span style={{ height: total ? `${Math.max(3, total / forecastMax * 100)}%` : "3%" }} /></div><small>{new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(date)}</small></div>;
      })}</div></section><section className="insight-card"><span className="insight-icon"><Sparkles size={23} /></span><span className="eyebrow">MAIS DO QUE NÚMEROS</span><h2>Entenda o momento.<br />Planeje o próximo passo.</h2><p>Seu assistente pode ajudar a entender suas parcelas e o que ainda vem pela frente.</p><Link href="/?view=assistant">Conversar com o assistente <ArrowRight size={17} /></Link></section></div>
      <section className="panel recent-panel"><div className="panel-heading"><div><h2>Últimos pagamentos</h2><p>Registros das suas despesas e cobranças</p></div></div>{(() => {
        const payments = entries.flatMap((e: FullEntry) => e.installments.flatMap((i: any) => i.payments.map((p: any) => ({ ...p, entry: e, number: i.number })))).sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);
        return payments.length ? payments.map(p => <Link className="activity-row" key={p.id} href={`/entries/${p.entry.id}`}><span className="activity-icon"><Check size={16} /></span><div><strong>{p.entry.description}</strong><small>{p.actor.name} · parcela {p.number}/{p.entry.count} · {dateLabel(p.paidAt)}</small></div><strong>{p.reversedAt ? "Estornado · " : ""}{money(p.cents)}</strong></Link>) : <p className="muted padded">Seus pagamentos aparecerão aqui quando você registrar a primeira baixa.</p>;
      })()}</section>
    </>}
    {["expenses", "receiving", "debts"].includes(view) && <><div className="notice privacy-notice"><LockKeyhole size={18} />{view === "expenses" ? "Somente você tem acesso a estas despesas, faturas e observações." : "Cada cobrança é visível somente para você e a outra pessoa envolvida. Nenhuma fatura privada é compartilhada."}</div><section className="panel"><div className="panel-heading"><div><h2>{view === "expenses" ? "Seu histórico de despesas" : view === "receiving" ? "Cobranças que você criou" : "Cobranças para você"}</h2><p>Abra um lançamento para ver todas as parcelas e os pagamentos.</p></div></div><Entries entries={view === "expenses" ? privateEntries : view === "receiving" ? incoming : debts} userId={user.id} month={month} /></section></>}
    {view === "new" && <section className="panel form-panel">{await (async () => {
      const [people, accounts] = await Promise.all([db.user.findMany({ where: { active: true, id: { not: user.id } }, select: { id: true, name: true }, orderBy: { name: "asc" } }), db.account.findMany({ where: { ownerId: user.id }, select: { id: true, name: true, kind: true } })]);
      const usedSources = new Set(entries.map((e: FullEntry) => e.sourceId));
      return <EntryForm people={people} accounts={accounts} sources={privateEntries.filter((e: FullEntry) => !e.cancelledAt && !usedSources.has(e.id)).map((e: FullEntry) => ({ id: e.id, description: e.description }))} date={today()} />;
    })()}</section>}
    {view === "accounts" && <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><h2>Suas contas</h2><LockKeyhole size={18} /></div>{await (async () => {
      const accounts = await db.account.findMany({ where: { ownerId: user.id }, orderBy: { name: "asc" }, include: { _count: { select: { entries: true } } } });
      return accounts.length ? accounts.map((a: { id: string; name: string; kind: string; _count: { entries: number } }) => <div className="account-row" key={a.id}><span className="entry-icon"><WalletCards size={22} /></span><div><strong>{a.name}</strong><small>{a.kind} · {a._count.entries} lançamento(s)</small></div><span className="badge">Manual</span></div>) : <Empty text="Tudo começa com uma conta" detail="Adicione um cartão, conta ou carteira para organizar seus lançamentos." />;
    })()}</section><section className="panel"><h2>Adicionar conta ou cartão</h2><p className="muted">Apenas um nome para organização. Não informe senhas ou números completos de cartões.</p><ActionForm action={accountAction} className="stack"><label>Nome<input name="name" placeholder="Ex.: Cartão principal" required minLength={2} maxLength={60} /></label><label>Tipo<select name="kind"><option>Conta</option><option>Cartão</option><option>Carteira</option></select></label><Submit>Adicionar conta</Submit></ActionForm><p className="helper">Conexão bancária não disponível nesta versão. O cadastro manual funciona sem tokens.</p></section></div>}
    {view === "profile" && <ProfileForm user={user} activeTab={view} />}
    {view === "simulations" && <SimulationView simulations={simulations} month={month} />}
    {view === "assistant" && <Assistant enabled={!!process.env.OPENAI_API_KEY} history={await db.aiMessage.findMany({ where: { userId: user.id, answer: { not: null } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, question: true, answer: true } })} />}
    {view === "users" && user.admin && <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h2>Usuários do servidor</h2><p>Administrar acessos não dá acesso às finanças.</p></div></div>{(await db.user.findMany({ select: { id: true, name: true, username: true, active: true, admin: true }, orderBy: { createdAt: "asc" } })).map(person => <div className="user-item" key={person.id}><div className="account-row"><span className="avatar">{person.name[0]}</span><div><strong>{person.name}</strong><small>@{person.username} · {person.admin ? "Administrador" : person.active ? "Ativo" : "Desativado"}</small></div></div>{!person.admin && <details><summary>Gerenciar acesso</summary><ActionForm action={manageUserAction} className="stack compact"><input type="hidden" name="userId" value={person.id} /><input type="hidden" name="operation" value="reset" /><label>Nova senha temporária<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label><Submit className="button secondary small">Redefinir senha</Submit></ActionForm><ActionForm action={manageUserAction} className="compact"><input type="hidden" name="userId" value={person.id} /><input type="hidden" name="operation" value="toggle" /><Submit className="button secondary small">{person.active ? "Desativar acesso" : "Reativar acesso"}</Submit></ActionForm></details>}</div>)}</section><section className="panel"><h2>Criar novo usuário</h2><p className="muted">Cada pessoa recebe um espaço privado.</p><ActionForm action={createUserAction} className="stack"><label>Nome<input name="name" required minLength={2} maxLength={70} placeholder="Como a pessoa se chama?" /></label><label>Usuário<input name="username" autoCapitalize="none" autoComplete="off" pattern="[a-z0-9._\-]{3,40}" required placeholder="ex.: ana.silva" /></label><label>Senha temporária<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /><small>Pelo menos 12 caracteres; troca obrigatória no primeiro acesso.</small></label><Submit>Criar usuário</Submit></ActionForm></section></div>}
  </Shell>;
}
