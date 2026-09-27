"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, deleteSession, hashPassword, loginAllowed, requireAdmin, requireUser, verifyPassword } from "@/lib/auth";
import { cancelEntry, recordPayment, reversePayment } from "@/lib/finance";
import { parseDate, parseMoney, schedule } from "@/lib/money";

export type ActionState = { error?: string; success?: string };
const value = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const passwordSchema = z.string().min(12, "Use uma senha com pelo menos 12 caracteres.").max(128, "A senha deve ter até 128 caracteres.");
const usernameSchema = z.string().regex(/^[a-z0-9._-]{3,40}$/, "Use um usuário de 3 a 40 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.");
function failure(error: unknown): ActionState {
  if (error instanceof z.ZodError) return { error: error.issues[0].message };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { error: "Este registro já existe. Confira os dados antes de tentar novamente." };
    return { error: "Não foi possível salvar os dados. Atualize a página e tente novamente." };
  }
  return { error: error instanceof Error ? error.message : "Não foi possível concluir a operação." };
}
function refreshed(success: string) {
  revalidatePath("/", "layout");
  return { success };
}

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const username = value(form, "username").toLowerCase();
  const password = String(form.get("password") || "");
  let temporary = false;
  try {
    usernameSchema.parse(username);
    if (password.length > 128) return { error: "Usuário ou senha inválidos." };
    if (!await loginAllowed(username)) return { error: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente." };
    const user = await db.user.findUnique({ where: { username } });
    const dummy = "00000000000000000000000000000000:" + "0".repeat(128);
    const valid = await verifyPassword(password, user?.passwordHash ?? dummy);
    if (!user || !user.active || !valid) return { error: "Usuário ou senha inválidos." };
    await db.loginLimit.deleteMany({ where: { username } });
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await createSession(user.id);
    temporary = user.mustChangePassword;
  } catch { return { error: "Não foi possível entrar. Confira os dados ou tente novamente em alguns minutos." }; }
  redirect(temporary ? "/password" : "/");
}
export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
export async function passwordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(true);
  try {
    const oldPassword = String(form.get("currentPassword") || "");
    const password = passwordSchema.parse(String(form.get("password") || ""));
    if (oldPassword.length > 128 || !await verifyPassword(oldPassword, user.passwordHash)) throw new Error("A senha atual está incorreta.");
    if (password === oldPassword) throw new Error("Escolha uma senha diferente da atual.");
    if (password !== form.get("confirmPassword")) throw new Error("A confirmação de senha não confere.");
    const passwordHash = await hashPassword(password);
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } }),
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);
    await createSession(user.id);
  } catch (error) { return failure(error); }
  redirect("/");
}
export async function createUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const username = usernameSchema.parse(value(form, "username").toLowerCase());
    const name = z.string().min(2).max(70).parse(value(form, "name"));
    const password = passwordSchema.parse(String(form.get("password") || ""));
    await db.user.create({ data: { username, name, passwordHash: await hashPassword(password) } });
    return refreshed("Usuário criado. Entregue a senha temporária de forma privada.");
  } catch (error) { return failure(error); }
}
export async function manageUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const id = value(form, "userId");
    if (id === admin.id) throw new Error("Use seu perfil para alterar sua própria senha.");
    const user = await db.user.findUnique({ where: { id } });
    if (!user || user.admin) throw new Error("Usuário não disponível para esta operação.");
    const operation = value(form, "operation");
    if (operation === "reset") {
      const password = passwordSchema.parse(String(form.get("password") || ""));
      const passwordHash = await hashPassword(password);
      await db.$transaction([
        db.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } }),
        db.session.deleteMany({ where: { userId: id } }),
      ]);
      return refreshed("Senha temporária redefinida e sessões encerradas.");
    }
    if (operation !== "toggle") throw new Error("Operação inválida.");
    await db.$transaction([
      db.user.update({ where: { id }, data: { active: !user.active } }),
      db.session.deleteMany({ where: { userId: id } }),
    ]);
    return refreshed(user.active ? "Usuário desativado." : "Usuário reativado.");
  } catch (error) { return failure(error); }
}
export async function accountAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    const name = z.string().min(2, "Informe o nome da conta.").max(60).parse(value(form, "name"));
    const kind = z.enum(["Conta", "Cartão", "Carteira"]).parse(value(form, "kind"));
    await db.account.create({ data: { name, kind, ownerId: user.id } });
    return refreshed("Conta adicionada.");
  } catch (error) { return failure(error); }
}
export async function entryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id = "";
  try {
    const description = z.string().min(2, "Descreva a origem da conta.").max(120).parse(value(form, "description"));
    const category = z.string().min(1).max(40).parse(value(form, "category"));
    const notes = z.string().max(1000).parse(value(form, "notes"));
    const purchaseDate = parseDate(value(form, "purchaseDate"));
    const firstDue = parseDate(value(form, "firstDue"));
    const count = Number(value(form, "count"));
    const startNumber = Number(value(form, "startNumber"));
    const amount = parseMoney(value(form, "amount"));
    const mode = z.enum(["total", "installment"]).parse(value(form, "amountMode"));
    const totalCents = mode === "installment" ? amount * count : amount;
    const installments = schedule(totalCents, count, startNumber, firstDue);
    const kind = z.enum(["private", "shared"]).parse(value(form, "kind"));
    const debtorId = kind === "shared" ? value(form, "debtorId") : null;
    if (kind === "shared" && (!debtorId || debtorId === user.id || !await db.user.findFirst({ where: { id: debtorId, active: true } }))) throw new Error("Escolha outro usuário ativo para a cobrança.");
    const accountId = kind === "private" ? value(form, "accountId") || null : null;
    if (accountId && !await db.account.findFirst({ where: { id: accountId, ownerId: user.id } })) throw new Error("Conta inválida.");
    const sourceId = kind === "shared" ? value(form, "sourceId") || null : null;
    if (sourceId && !await db.entry.findFirst({ where: { id: sourceId, ownerId: user.id, debtorId: null, cancelledAt: null } })) throw new Error("Lançamento de origem inválido.");
    const entry = await db.entry.create({ data: {
      ownerId: user.id, description, category, notes: kind === "private" ? notes : "", purchaseDate, accountId, sourceId,
      debtorId, totalCents, count, startNumber, installments: { create: installments },
      audits: { create: { actorId: user.id, message: kind === "shared" ? "Cobrança compartilhada criada; disponível automaticamente ao destinatário." : "Lançamento privado criado." } },
    } });
    id = entry.id;
    revalidatePath("/", "layout");
  } catch (error) { return failure(error); }
  redirect(`/entries/${id}`);
}
export async function paymentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await recordPayment(user.id, value(form, "entryId"), value(form, "installmentId"), parseMoney(value(form, "amount")), value(form, "paidAt"), value(form, "note"), value(form, "requestKey"));
    return refreshed("Pagamento registrado. O saldo já foi atualizado.");
  } catch (error) { return failure(error); }
}
export async function reverseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await reversePayment(user.id, value(form, "entryId"), value(form, "paymentId"), value(form, "reason"));
    return refreshed("Pagamento estornado; histórico preservado.");
  } catch (error) { return failure(error); }
}
export async function cancelAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await cancelEntry(user.id, value(form, "entryId"));
    return refreshed("Lançamento cancelado.");
  } catch (error) { return failure(error); }
}
