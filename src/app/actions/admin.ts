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
import { getComment, setCommentStatus } from "@/lib/repo/comments";
import { getEntry, setEntryStatus, setVerified } from "@/lib/repo/entries";
import { handleReports, isReportTargetKind } from "@/lib/repo/reports";
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

/** Same-origin paths only; an admin acting from a public page lands back on that page. */
function back(returnTo: string, msg?: string): never {
  const base = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/admin";
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

/** Content is live the moment it is posted; removal (with a public reason) is the only moderation step. */
function removeEntry(db: ReturnType<typeof getDb>, id: string, reason: string) {
  const cur = getEntry(db, id);
  if (!cur) throw new Error("条目不存在");
  if (cur.status !== "published") throw new Error("只有公开中的条目可以下架；已下架的保留原墓碑");
  setEntryStatus(db, id, "removed", { reason });
  handleReports(db, "entry", id);
  revalidateEntry(id, cur.subjectId);
}

function removeComment(db: ReturnType<typeof getDb>, id: string, reason: string) {
  const cur = getComment(db, id);
  if (!cur) throw new Error("评论不存在");
  if (cur.status !== "published") throw new Error("只有公开中的评论可以下架");
  setCommentStatus(db, id, "removed", { reason });
  handleReports(db, "comment", id);
  revalidatePath("/admin");
  revalidatePath(`/s/${cur.subjectId}`);
  if (cur.entryId) revalidatePath(`/e/${cur.entryId}`);
}

export async function moderateEntryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, "id");
  const decision = str(formData, "decision");
  const reason = str(formData, "reason");
  const returnTo = str(formData, "returnTo") || "/admin";
  let msg: string | undefined;
  try {
    if (decision !== "remove") throw new Error("未知操作");
    removeEntry(getDb(), id, reason);
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
    if (decision !== "remove") throw new Error("未知操作");
    removeComment(getDb(), id, reason);
  } catch (e) {
    msg = errorMessage(e);
  }
  back(returnTo, msg);
}

/** Resolves every open report on one target: take the content down, or leave it up and close the reports. */
export async function handleReportAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const targetKind = str(formData, "targetKind");
  const targetId = str(formData, "targetId");
  const decision = str(formData, "decision");
  const reason = str(formData, "reason");
  const returnTo = str(formData, "returnTo") || "/admin";
  let msg: string | undefined;
  try {
    if (!isReportTargetKind(targetKind)) throw new Error("举报对象不正确");
    const db = getDb();
    if (decision === "remove") {
      if (targetKind === "entry") removeEntry(db, targetId, reason);
      else removeComment(db, targetId, reason);
    } else if (decision === "dismiss") {
      handleReports(db, targetKind, targetId);
      revalidatePath("/admin");
    } else {
      throw new Error("未知操作");
    }
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
