import Link from "next/link";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, LayoutDashboard, WalletCards, Users, Sparkles, ShieldCheck, LogOut, Settings2, Sprout } from "lucide-react";
import { logoutAction } from "@/app/actions";

const nav = [
  ["overview", "Visão geral", LayoutDashboard],
  ["expenses", "Minhas despesas", WalletCards],
  ["receiving", "A receber", ArrowDownLeft],
  ["debts", "Contas recebidas", ArrowUpRight],
  ["accounts", "Contas e cartões", ArrowLeftRight],
  ["assistant", "Assistente IA", Sparkles],
] as const;
export function Shell({ user, active = "overview", children }: { user: { name: string; username: string; admin: boolean }; active?: string; children: React.ReactNode }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-icon"><Sprout size={25} /></span><span>entrecontas<small>FINANÇAS EM FAMÍLIA</small></span></Link>
      <div className="sidebar-label">SEU ESPAÇO</div>
      <nav aria-label="Navegação principal">{nav.map(([key, label, Icon]) => <Link key={key} href={`/?view=${key}`} className={`nav-item ${active === key ? "active" : ""}`} aria-current={active === key ? "page" : undefined}><Icon size={19} />{label}{key === "assistant" && <span className="tiny-label">IA</span>}</Link>)}
        {user.admin && <Link href="/?view=users" className={`nav-item ${active === "users" ? "active" : ""}`}><Users size={19} />Usuários</Link>}
      </nav>
      <div className="privacy-card"><ShieldCheck size={23} /><strong>Seu dinheiro. Seu espaço.</strong><p>Suas finanças são privadas. Você escolhe quais cobranças compartilhar.</p></div>
      <div className="sidebar-user"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>@{user.username}</small></div><Link href="/password" aria-label="Alterar senha" title="Alterar senha"><Settings2 size={18} /></Link><form action={logoutAction}><button className="icon-button" aria-label="Sair" title="Sair"><LogOut size={18} /></button></form></div>
    </aside>
    <div className="workspace"><header className="topbar"><span>Organização para uma vida mais leve.</span><span className="private-label"><span className="status-dot" /> Ambiente privado <ShieldCheck size={15} /></span></header><main>{children}</main><footer>Entrecontas <span>Clareza nas contas. Tranquilidade em família.</span></footer></div>
  </div>;
}
