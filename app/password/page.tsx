import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { passwordAction, logoutAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/action-form";
export default async function PasswordPage() {
  const user = await requireUser(true);
  return <main className="centered-page"><section className="panel password-panel"><ShieldCheck size={30} className="green" /><h1>{user.mustChangePassword ? "Crie sua senha pessoal" : "Alterar senha"}</h1><p className="muted">Olá, {user.name}. Use pelo menos 6 caracteres; pode ser somente números. Suas outras sessões serão encerradas.</p><ActionForm action={passwordAction} className="stack"><label>Senha atual ou temporária<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></label><label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={6} maxLength={128} required /></label><label>Confirmar nova senha<input name="confirmPassword" type="password" autoComplete="new-password" minLength={6} maxLength={128} required /></label><Submit>Salvar minha senha</Submit></ActionForm><div className="form-footer">{!user.mustChangePassword && <Link href="/">Voltar ao painel</Link>}<form action={logoutAction}><button className="button secondary">Sair</button></form></div></section></main>;
}
