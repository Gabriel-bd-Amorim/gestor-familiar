"use client";

import { useState } from "react";
import { Sparkles, Send, ShieldCheck } from "lucide-react";
export function Assistant({ enabled, history }: { enabled: boolean; history: { id: string; question: string; answer: string | null }[] }) {
  const [messages, setMessages] = useState(history);
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, consent }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível consultar a IA.");
      setMessages(previous => [{ id: crypto.randomUUID(), question, answer: result.answer }, ...previous]);
      setQuestion("");
    } catch (error) { setError(error instanceof Error ? error.message : "Verifique sua conexão e tente novamente."); }
    finally { setBusy(false); }
  }
  return <div className="assistant-layout"><section className="panel assistant-panel"><div className="assistant-orb"><Sparkles size={28} /></div><h2>Um pouco mais de clareza.</h2><p className="muted">Pergunte sobre suas contas, parcelas e compromissos. O contexto é sempre o seu.</p>
    {!enabled && <p className="notice">Assistente desativado. Para habilitar, configure <code>OPENAI_API_KEY</code> e <code>OPENAI_MODEL</code> no servidor.</p>}
    <div className="suggestions">{["Resuma minha situação financeira atual.", "Quais contas preciso priorizar?", "Quanto tenho para receber este mês?"].map(text => <button key={text} type="button" onClick={() => setQuestion(text)}>{text}</button>)}</div>
    <form onSubmit={send} className="stack"><label htmlFor="question">Sua pergunta<textarea id="question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={1000} minLength={3} rows={4} placeholder="Como estão minhas contas este mês?" required disabled={!enabled} /></label>
      <label className="checkbox"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required disabled={!enabled} /><span>Autorizo enviar minha pergunta e um resumo das minhas finanças à OpenAI para esta consulta.</span></label>
      <button className="button" disabled={!enabled || !consent || busy}>{busy ? "Analisando suas contas…" : "Consultar assistente"}<Send size={16} /></button>{error && <p className="notice error" role="alert">{error}</p>}
    </form><p className="helper"><ShieldCheck size={14} /> Sem acesso a faturas privadas de outras pessoas. Cada pergunta é independente. A IA pode cometer erros; confira os valores.</p>
  </section><section className="panel"><h2>Suas consultas</h2><p className="muted">Histórico privado · últimas 20 consultas</p>{messages.filter(m => m.answer).length === 0 ? <div className="empty"><Sparkles size={30} /><h3>A conversa começa aqui</h3><p>Seu histórico aparecerá após a primeira consulta.</p></div> : <div className="chat-history">{messages.filter(m => m.answer).slice(0, 20).map(m => <article key={m.id}><strong>{m.question}</strong><p>{m.answer}</p></article>)}</div>}</section></div>;
}
