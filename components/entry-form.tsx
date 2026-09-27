"use client";

import { useState } from "react";
import { LockKeyhole, Users } from "lucide-react";
import { entryAction } from "@/app/actions";
import { ActionForm, Submit } from "./action-form";

export function EntryForm({ people, accounts, sources, date }: {
  people: { id: string; name: string }[];
  accounts: { id: string; name: string; kind: string }[];
  sources: { id: string; description: string }[];
  date: string;
}) {
  const [kind, setKind] = useState("private");
  return <ActionForm action={entryAction}>
    <div className="segmented full" aria-label="Tipo de lançamento"><button type="button" className={kind === "private" ? "selected" : ""} onClick={() => setKind("private")}><LockKeyhole size={16} />Despesa privada</button><button type="button" className={kind === "shared" ? "selected" : ""} onClick={() => setKind("shared")}><Users size={16} />Cobrar alguém</button></div>
    <input type="hidden" name="kind" value={kind} />
    <div className="notice full">{kind === "private" ? "Este lançamento só aparece para você. Descreva uma compra ou uma fatura que deseja acompanhar." : "A cobrança aparece automaticamente para a pessoa escolhida. Descrição, valores, parcelas e pagamentos serão compartilhados."}</div>
    <label className="full">{kind === "private" ? "Descrição / origem da conta" : "Descrição compartilhada"}<input name="description" placeholder="Ex.: Notebook comprado no cartão" required minLength={2} maxLength={120} /></label>
    <label>Valor (R$)<input name="amount" inputMode="decimal" placeholder="0,00" required /></label>
    <label>Esse valor é<select name="amountMode"><option value="total">O total da compra</option><option value="installment">O valor de cada parcela</option></select></label>
    <label>Quantidade total de parcelas<input name="count" type="number" min="1" max="360" defaultValue="1" required /></label>
    <label>Primeira parcela a acompanhar<input name="startNumber" type="number" min="1" max="360" defaultValue="1" required /><small>Compra em andamento? Use, por exemplo, 3 para começar em 3/10.</small></label>
    <label>Data da compra<input type="date" name="purchaseDate" defaultValue={date} required /></label>
    <label>Vencimento da primeira acompanhada<input type="date" name="firstDue" defaultValue={date} required /></label>
    <label>Categoria<select name="category">{["Casa", "Alimentação", "Transporte", "Saúde", "Educação", "Compras", "Lazer", "Serviços", "Outros"].map(c => <option key={c}>{c}</option>)}</select></label>
    {kind === "private" ? <>
      <label>Conta ou cartão<select name="accountId"><option value="">Sem vínculo</option>{accounts.map(a => <option value={a.id} key={a.id}>{a.name} · {a.kind}</option>)}</select></label>
      <label className="full">Observações privadas<textarea name="notes" placeholder="Explique de onde vem esta conta…" maxLength={1000} rows={3} /></label>
    </> : <>
      <label>Quem deve pagar?<select name="debtorId" required defaultValue=""><option value="" disabled>Selecione uma pessoa</option>{people.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
      <label className="full">Vincular a uma despesa sua (opcional)<select name="sourceId"><option value="">Sem vínculo</option>{sources.map(s => <option value={s.id} key={s.id}>{s.description}</option>)}</select><small>A despesa de origem e suas observações continuam privadas. A cobrança não dá baixa nessa despesa.</small></label>
      {people.length === 0 && <p className="notice full">Peça ao administrador para cadastrar outra pessoa antes de criar uma cobrança.</p>}
    </>}
    <div className="form-footer full"><span>Valores em reais · histórico preservado</span><Submit disabled={kind === "shared" && people.length === 0}>Criar {kind === "private" ? "lançamento" : "cobrança"}</Submit></div>
  </ActionForm>;
}
