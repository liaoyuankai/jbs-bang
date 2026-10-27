import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "./config";

export const ADMIN_COOKIE = "admin";
export const ADMIN_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function sig(secret: string, expiresAt: number): string {
  return createHmac("sha256", secret).update(String(expiresAt)).digest("hex");
}

export function signAdmin(secret: string, expiresAt: number): string {
  return `${expiresAt}.${sig(secret, expiresAt)}`;
}

export function verifyAdmin(secret: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresAt = Number(token.slice(0, dot));
  const given = token.slice(dot + 1);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = sig(secret, expiresAt);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, "utf8"), Buffer.from(expected, "utf8"));
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdmin(config.sessionSecret, store.get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
