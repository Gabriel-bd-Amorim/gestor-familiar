import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";

const scrypt = promisify(scryptCallback);
const cookieName = "entrecontas_session";
const lifetime = 60 * 60 * 24 * 7;
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const result = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${result.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
function digest(token: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Configure AUTH_SECRET com pelo menos 32 caracteres.");
  return createHmac("sha256", secret).update(token).digest("hex");
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.session.create({ data: { id: digest(token), userId, expiresAt: new Date(Date.now() + lifetime * 1000) } });
  const jar = await cookies();
  jar.set(cookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.APP_URL?.startsWith("https://") ?? false, path: "/", maxAge: lifetime });
}
export async function deleteSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db.session.deleteMany({ where: { id: digest(token) } });
  jar.delete(cookieName);
}
export const currentUser = cache(async () => {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.session.findUnique({ where: { id: digest(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return session.user;
});
export async function requireUser(allowTemporary = false) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !allowTemporary) redirect("/password");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (!user.admin) throw new Error("Acesso restrito ao administrador.");
  return user;
}

export async function loginAllowed(username: string) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`login:${username}`}))`;
    const previous = await tx.loginLimit.findUnique({ where: { username } });
    if (!previous || previous.since.getTime() < Date.now() - 15 * 60 * 1000) {
      await tx.loginLimit.upsert({ where: { username }, create: { username, attempts: 1, since: new Date() }, update: { attempts: 1, since: new Date() } });
      return true;
    }
    if (previous.attempts >= 8) return false;
    await tx.loginLimit.update({ where: { username }, data: { attempts: { increment: 1 } } });
    return true;
  });
}
