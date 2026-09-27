import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { ArrowLeft, LockKeyhole, Users, History, Check } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEntry } from "@/lib/finance";
import { balance, dateLabel, money, today } from "@/lib/money";
import { paymentAction, reverseAction, cancelAction } from "@/app/actions";
import { Shell } from "@/components/shell";
import { ActionForm, Submit } from "@/components/action-form";
import { Refresh } from "@/components/refresh";

export const dynamic = "force-dynamic";
export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const entry = await getEntry(user.id, (await params).id);
  if (!entry) notFound();
  const remaining = entry.installments.reduce((s, i) => s + balance(i), 0);
  const tracked = entry.installments.reduce((s, i) => s + i.cents, 0);
  const audits = await db.audit.findMany({ where: { entryId: entry.id }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  const account = entry.ownerId === user.id && entry.accountId ? await db.account.findFirst({ where: { id: entry.accountId, ownerId: user.id } }) : null;
  const source = entry.ownerId === user.id && entry.sourceId ? await db.entry.findFirst({ where: { id: entry.sourceId, ownerId: user.id }, select: { id: true, description: true } }) : null;
  return <Shell user={user} active={!entry.debtorId ? "expenses" : entry.ownerId === user.id ? "receiving" : "debts"}><Refresh /><Link className="back-link" href={entry.debtorId ? entry.ownerId === user.id ? "/?view=receiving" : "/?view=debts" : "/?view=expenses"}><ArrowLeft size={16} />Voltar aos lançamentos</Link><div className="page-heading"><div><span className="eyebrow">{entry.debtorId ? "COBRANÇA COMPARTILHADA" : "LANÇAMENTO PRIVADO"}</span><h1>{entry.description}</h1><p>{entry.category} · Compra em {dateLabel(entry.purchaseDate)}{account ? ` · ${account.name}` : ""}</p></div><span className={`badge ${entry.cancelledAt ? "late" : remaining === 0 ? "paid" : ""}`}>{entry.cancelledAt ? "Cancelado" : remaining === 0 ? "Pago" : tracked !== remaining ? "Parcialmente pago" : "Pendente"}</span></div>
    <div className="notice privacy-notice">{entry.debtorId ? <><Users size={18} />{entry.owner.name} cobra de {entry.debtor?.name}. Somente vocês dois veem esta cobrança. Pagamentos informados têm baixa imediata.</> : <><LockKeyhole size={18} />Somente você vê este lançamento e suas observações.</>}</div>
    <div className="stat-grid detail-stats"><article className="stat-card"><span className="stat-label">Valor total original</span><strong>{money(entry.totalCents)}</strong><small>{entry.count} parcela(s) no total</small></article><article className="stat-card"><span className="stat-label">Pago no acompanhamento</span><strong>{money(tracked - remaining)}</strong><small>Pagamentos efetivamente registrados</small></article><article className="stat-card featured"><span className="stat-label">Saldo acompanhado</span><strong>{entry.cancelledAt ? money(0) : money(remaining)}</strong><small>Parcelas {entry.startNumber} a {entry.count}{entry.cancelledAt ? " · canceladas" : ""}</small></article></div>
    {entry.startNumber > 1 && <p className="notice">O acompanhamento começa na parcela {entry.startNumber}/{entry.count}. Parcelas anteriores não foram presumidas pagas e não compõem este saldo.</p>}
    {entry.notes && entry.ownerId === user.id && <section className="panel notes"><h2>Observações privadas</h2><p>{entry.notes}</p></section>}
    {source && <p className="notice">Vínculo privado, visível só para você: <Link href={`/entries/${source.id}`}>{source.description}</Link>. Esta cobrança não altera o pagamento da despesa original.</p>}
    <section className="panel installment-panel"><div className="panel-heading"><div><h2>Parcelas e pagamentos</h2><p>A passagem do mês mantém o histórico. Uma parcela só é paga quando você informa a baixa.</p></div><History size={20} /></div>{entry.installments.map(i => {
      const pending = balance(i);
      const current = i.dueDate.toISOString().startsWith(today().slice(0, 7));
      const late = pending > 0 && i.dueDate.toISOString().slice(0, 10) < today();
      return <div key={i.id} className={`installment ${current ? "current" : ""}`}><div className="installment-header"><span className="parcel-pill">{i.number}/{entry.count}</span><div><strong>{dateLabel(i.dueDate)} {current && <span className="current-label">MÊS ATUAL</span>}</strong><small>Valor da parcela: {money(i.cents)}</small></div><div className="installment-total"><strong>{money(pending)}</strong><span className={`badge ${pending === 0 ? "paid" : late ? "late" : ""}`}>{entry.cancelledAt ? "Cancelada" : pending === 0 ? "Paga" : late ? "Em atraso" : pending < i.cents ? "Parcial" : "Pendente"}</span></div></div>
        {!entry.cancelledAt && pending > 0 && <details className="payment-details"><summary>Registrar pagamento</summary><ActionForm key={`${i.id}:${pending}`} action={paymentAction}><input type="hidden" name="entryId" value={entry.id} /><input type="hidden" name="installmentId" value={i.id} /><input type="hidden" name="requestKey" value={randomUUID()} /><label>Valor pago (R$)<input name="amount" inputMode="decimal" defaultValue={(pending / 100).toFixed(2).replace(".", ",")} required /></label><label>Data do pagamento<input name="paidAt" type="date" defaultValue={today()} max={today()} required /></label><label className="full">Observação {entry.debtorId ? "compartilhada" : "(opcional)"}<input name="note" maxLength={300} placeholder="Ex.: Pix realizado" /></label><div className="form-footer full"><small>Registro manual. Nenhum dinheiro é transferido pela aplicação.</small><Submit>Confirmar baixa</Submit></div></ActionForm></details>}
        {i.payments.length > 0 && <div className="payment-history">{i.payments.map(p => <div key={p.id}><div className="payment-line"><Check size={15} /><span><strong>{money(p.cents)}</strong> · {dateLabel(p.paidAt)} · informado por {p.actor.name}{p.note && <small>{p.note}</small>}</span><span className={`badge ${p.reversedAt ? "late" : "paid"}`}>{p.reversedAt ? "Estornado" : "Registrado"}</span></div>{p.reversedAt && <p className="helper">Estorno em {dateLabel(p.reversedAt)}: {p.reversalNote}</p>}{!p.reversedAt && p.actorId === user.id && <details><summary>Corrigir com estorno</summary><ActionForm action={reverseAction}><input type="hidden" name="entryId" value={entry.id} /><input type="hidden" name="paymentId" value={p.id} /><label>Motivo<input name="reason" required minLength={3} maxLength={300} placeholder="Por que este pagamento precisa ser estornado?" /></label><div className="align-end"><Submit className="button secondary">Estornar pagamento</Submit></div></ActionForm></details>}</div>)}</div>}
      </div>;
    })}</section>
    <div className="dashboard-grid"><section className="panel"><h2>Histórico de atividades</h2><div className="audit-list">{audits.map(a => <div key={a.id}><span className="audit-dot" /><div><strong>{a.message}</strong><small>{a.actor.name} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: process.env.TZ || "America/Sao_Paulo" }).format(a.createdAt)}</small></div></div>)}</div></section>{entry.ownerId === user.id && !entry.cancelledAt && <section className="panel"><h2>Precisa corrigir este lançamento?</h2><p className="muted">Para preservar o histórico, cancele e crie um novo lançamento. Pagamentos ativos precisam ser estornados por quem os registrou.</p><details><summary>Cancelar lançamento</summary><ActionForm action={cancelAction} className="stack"><input type="hidden" name="entryId" value={entry.id} /><label className="checkbox"><input type="checkbox" required /><span>Entendo que as parcelas serão retiradas dos totais e o histórico será preservado.</span></label><Submit className="button danger">Confirmar cancelamento</Submit></ActionForm></details></section>}</div>
  </Shell>;
}
