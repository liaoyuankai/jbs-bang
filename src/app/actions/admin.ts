"use server";

import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { errorMessage, type ActionState } from "@/lib/action-state";
import { ADMIN_COOKIE, ADMIN_SESSION_MS, requireAdmin, signAdmin } from "@/lib/admin-auth";
import { config } from "@/lib/config";
import { getDb } from "@/lib/db";
import { checkRate, RATE_MESSAGES } from "@/lib/ratelimit";
import { setCommentStatus } from "@/lib/repo/comments";
import { getEntry, setEntryStatus, setVerified, updateEntryBody } from "@/lib/repo/entries";
import { updateSubject } from "@/lib/repo/subjects";
import { getClientIp, ipHash } from "@/lib/visitor";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const expected = config.adminPassword;
  if (!expected) return { error: "未配置 ADMIN_PASSWORD，请在 .env 中设置后重启" };
  const secretProblem = config.sessionSecretProblem;
  if (secretProblem) return { error: `${secretProblem}，请在 .env 中设置后重启` };

  const ip = ipHash(await getClientIp());
  if (!checkRate(getDb(), ip, "login")) return { error: RATE_MESSAGES.login };

  const given = str(formData, "password");
  if (!given || !safeEqual(given, expected)) return { error: "口令错误" };
  const store = await cookies();
  store.set(ADMIN_COOKIE, signAdmin(config.sessionSecret, Date.now() + ADMIN_SESSION_MS), {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MS / 1000,
  });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

function back(returnTo: string, msg?: string): never {
  const base = returnTo.startsWith("/admin") && !returnTo.startsWith("//") ? returnTo : "/admin";
  const sep = base.includes("?") ? "&" : "?";
  redirect(msg ? `${base}${sep}msg=${encodeURIComponent(msg)}` : base);
}

function revalidateEntry(id: string, subjectId: string) {
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath(`/e/${id}`);
  revalidatePath(`/s/${subjectId}`);
  revalidatePath("/transparency");
  revalidatePath("/admin");
  revalidatePath("/admin/entries");
}

export async function moderateEntryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, "id");
  const decision = str(formData, "decision");
  const reason = str(formData, "reason");
  const body = str(formData, "body");
  const returnTo = str(formData, "returnTo") || "/admin";
  let msg: string | undefined;
  try {
    const db = getDb();
    const cur = getEntry(db, id);
    if (!cur) throw new Error("条目不存在");
    if (decision === "approve") {
      if (cur.status !== "pending" && cur.status !== "rejected") {
        throw new Error("只有待审或已驳回的条目可以通过；已下架的条目保留墓碑，不能重新公开");
      }
      if (body && body !== cur.body) updateEntryBody(db, id, body);
      setEntryStatus(db, id, "published");
    } else if (decision === "reject") {
      if (cur.status !== "pending") throw new Error("只有待审条目可以驳回");
      setEntryStatus(db, id, "rejected");
    } else if (decision === "remove") {
      if (cur.status !== "published") throw new Error("只有已公开条目可以下架");
      setEntryStatus(db, id, "removed", { reason });
    } else {
      throw new Error("未知操作");
    }
    revalidateEntry(id, cur.subjectId);
  } catch (e) {
    msg = errorMessage(e);
  }
  back(returnTo, msg);
}

export async function moderateCommentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, "id");
  const decision = str(formData, "decision");
  const reason = str(formData, "reason");
  const returnTo = str(formData, "returnTo") || "/admin";
  let msg: string | undefined;
  try {
    const db = getDb();
    const status = decision === "approve" ? "published" : decision === "reject" ? "rejected" : decision === "remove" ? "removed" : null;
    if (!status) throw new Error("未知操作");
    const c = setCommentStatus(db, id, status, { reason });
    revalidatePath("/admin");
    revalidatePath("/search");
    revalidatePath(`/s/${c.subjectId}`);
    if (c.entryId) revalidatePath(`/e/${c.entryId}`);
  } catch (e) {
    msg = errorMessage(e);
  }
  back(returnTo, msg);
}

export async function toggleVerifiedAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, "id");
  const verified = str(formData, "verified") === "1";
  const returnTo = str(formData, "returnTo") || "/admin/entries";
  let msg: string | undefined;
  try {
    const db = getDb();
    const e = setVerified(db, id, verified);
    revalidateEntry(id, e.subjectId);
  } catch (e) {
    msg = errorMessage(e);
  }
  back(returnTo, msg);
}

export async function updateSubjectAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, "id");
  const returnTo = str(formData, "returnTo") || "/admin/subjects";
  let msg: string | undefined;
  try {
    const db = getDb();
    const aliases = str(formData, "aliases")
      .split(/[,，、\n]/)
      .map((a) => a.trim())
      .filter(Boolean);
    updateSubject(db, id, {
      name: str(formData, "name"),
      city: str(formData, "city"),
      shopName: str(formData, "shopName") || null,
      aliases,
    });
    revalidatePath(`/s/${id}`);
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath("/admin/subjects");
  } catch (e) {
    msg = errorMessage(e);
  }
  back(returnTo, msg);
}
