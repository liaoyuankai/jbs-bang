"use server";

import { errorMessage, type ActionState } from "@/lib/action-state";
import { getDb } from "@/lib/db";
import { checkRate, RATE_MESSAGES } from "@/lib/ratelimit";
import { createComment } from "@/lib/repo/comments";
import { getEntry } from "@/lib/repo/entries";
import { getSubject } from "@/lib/repo/subjects";
import { getClientIp, getOrSetVid, ipHash } from "@/lib/visitor";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function submit(kind: "comment" | "response", formData: FormData): Promise<ActionState> {
  try {
    const body = str(formData, "body");
    const entryId = str(formData, "entryId") || null;
    const subjectIdIn = str(formData, "subjectId");
    const db = getDb();

    let subjectId = subjectIdIn;
    if (kind === "comment") {
      if (!entryId) return { error: "缺少条目" };
      const entry = getEntry(db, entryId);
      if (!entry || entry.status !== "published") return { error: "条目不存在或不可评论" };
      subjectId = entry.subjectId;
    } else if (!getSubject(db, subjectId)) {
      return { error: "对象不存在" };
    }

    const vid = await getOrSetVid();
    const ip = ipHash(await getClientIp());
    if (!checkRate(db, ip, "comment")) return { error: RATE_MESSAGES.comment };

    createComment(db, { entryId: kind === "comment" ? entryId : null, subjectId, kind, body, vid, ipHash: ip });
    return {
      ok: true,
      message: kind === "comment" ? "评论已提交，审核通过后显示。" : "回应已提交，审核通过后会置顶显示。",
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function createCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return submit("comment", formData);
}

export async function createResponseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return submit("response", formData);
}
