"use server";

import { revalidatePath } from "next/cache";
import { errorMessage, type ActionState } from "@/lib/action-state";
import { getDb } from "@/lib/db";
import { isMaintenance, MAINTENANCE_MESSAGE } from "@/lib/maintenance";
import { checkRate, RATE_MESSAGES } from "@/lib/ratelimit";
import { isReportTargetKind } from "@/lib/reports";
import { createReport, validateReport } from "@/lib/repo/reports";
import { getClientIp, getOrSetVid, ipHash } from "@/lib/visitor";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function reportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (isMaintenance()) return { error: MAINTENANCE_MESSAGE };
  try {
    const targetKind = str(formData, "targetKind");
    const targetId = str(formData, "targetId");
    const reason = str(formData, "reason");
    const detail = str(formData, "detail");
    if (!isReportTargetKind(targetKind)) return { error: "举报对象不正确" };

    const db = getDb();
    validateReport(db, { targetKind, targetId, reason });
    const vid = await getOrSetVid();
    const ip = ipHash(await getClientIp());
    if (!checkRate(db, ip, "report")) return { error: RATE_MESSAGES.report };

    const inserted = createReport(db, { targetKind, targetId, reason, detail, vid, ipHash: ip });
    revalidatePath("/admin");
    return inserted
      ? { ok: true, message: "已收到举报，站长会尽快处理。" }
      : { ok: true, message: "你已经举报过这条了，站长会处理。" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
