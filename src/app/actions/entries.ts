"use server";

import { redirect } from "next/navigation";
import { errorMessage, type ActionState } from "@/lib/action-state";
import { config } from "@/lib/config";
import { getDb } from "@/lib/db";
import { checkRate, RATE_MESSAGES } from "@/lib/ratelimit";
import { BODY_MAX, BODY_MIN, createEntry, setEvidenceCount } from "@/lib/repo/entries";
import { findOrCreateSubject, getSubject } from "@/lib/repo/subjects";
import { isListKind, isSubjectType } from "@/lib/taxonomy";
import { readEvidence, writeEvidence } from "@/lib/uploads";
import { getClientIp, getOrSetVid, ipHash } from "@/lib/visitor";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function createEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let entryId: string;
  try {
    const type = str(formData, "type");
    const list = str(formData, "list");
    const category = str(formData, "category");
    const body = str(formData, "body");
    const occurredAt = str(formData, "occurredAt") || null;
    const contact = str(formData, "contact") || null;
    const subjectId = str(formData, "subjectId");
    const files = formData.getAll("evidence").filter((f): f is File => f instanceof File);

    if (!isSubjectType(type)) return { error: "请选择对象类型" };
    if (!isListKind(list)) return { error: "请选择红榜或黑榜" };
    if (!category) return { error: "请选择分类" };
    const len = [...body].length;
    if (len < BODY_MIN || len > BODY_MAX) return { error: `正文需在 ${BODY_MIN} 到 ${BODY_MAX} 字之间` };
    const evidence = await readEvidence(files);

    const db = getDb();
    const vid = await getOrSetVid();
    const ip = ipHash(await getClientIp());
    if (!checkRate(db, ip, "entry")) return { error: RATE_MESSAGES.entry };

    const subject = subjectId
      ? getSubject(db, subjectId)
      : findOrCreateSubject(db, {
          type,
          name: str(formData, "name"),
          city: str(formData, "city") || config.defaultCity,
          shopName: str(formData, "shopName") || null,
        });
    if (!subject) return { error: "对象不存在" };
    if (subject.type !== type) return { error: "对象类型不匹配" };

    const entry = createEntry(db, { subjectId: subject.id, list, category, body, vid, ipHash: ip, occurredAt, contact });
    const n = writeEvidence(config.dataDir, entry.id, evidence);
    if (n > 0) setEvidenceCount(db, entry.id, n);
    entryId = entry.id;
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect(`/submit/done?id=${entryId}`);
}
