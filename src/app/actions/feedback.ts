"use server";

import { revalidatePath } from "next/cache";
import { errorMessage, type ActionState } from "@/lib/action-state";
import { getDb } from "@/lib/db";
import { checkRate, RATE_MESSAGES } from "@/lib/ratelimit";
import { createFeedback, FEEDBACK_MAX } from "@/lib/repo/feedback";
import { getClientIp, getOrSetVid, ipHash } from "@/lib/visitor";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function feedbackAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const body = str(formData, "body");
    if (!body) return { error: "请写点内容" };
    if ([...body].length > FEEDBACK_MAX) return { error: `反馈最多 ${FEEDBACK_MAX} 字` };
    const db = getDb();
    const vid = await getOrSetVid();
    const ip = ipHash(await getClientIp());
    if (!checkRate(db, ip, "feedback")) return { error: RATE_MESSAGES.feedback };
    createFeedback(db, { body, vid, ipHash: ip });
    revalidatePath("/admin/feedback");
    return { ok: true, message: "收到，谢谢。站长会看到这条反馈。" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
