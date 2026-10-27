import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { config } from "./config";

export const VID_COOKIE = "vid";
const VID_MAX_AGE = 365 * 24 * 60 * 60;

function isVid(v: string | undefined): v is string {
  return !!v && /^[0-9a-f]{32}$/.test(v);
}

/** Read the visitor id cookie without setting it (safe inside page renders). */
export async function readVid(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(VID_COOKIE)?.value;
  return isVid(v) ? v : null;
}

/** Read the visitor id, minting and setting one if absent. Only call from server actions or route handlers. */
export async function getOrSetVid(): Promise<string> {
  const store = await cookies();
  const v = store.get(VID_COOKIE)?.value;
  if (isVid(v)) return v;
  const fresh = randomBytes(16).toString("hex");
  store.set(VID_COOKIE, fresh, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: VID_MAX_AGE,
  });
  return fresh;
}

/** Public handle for a visitor id: stable per visitor, reveals nothing. */
export function shortVid(vid: string): string {
  return `瓜友#${vid.slice(0, 4).toUpperCase()}`;
}

export function ipHash(ip: string): string {
  return createHash("sha256").update(`${config.sessionSecret}|${ip}`).digest("hex").slice(0, 16);
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}
