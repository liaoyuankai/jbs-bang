import type { DatabaseSync } from "node:sqlite";
import { newId } from "../ids";
import { appendEvent } from "../events";
import { scrubPII } from "../scrub";
import {
  now,
  prefixedSubject,
  rowToComment,
  SUBJECT_JOIN_COLS,
  type Comment,
  type CommentWithSubject,
  type Status,
} from "../types";

type Row = Record<string, unknown>;

export const COMMENT_MIN = 2;
export const COMMENT_MAX = 1000;

export function createComment(
  db: DatabaseSync,
  input: {
    entryId?: string | null;
    subjectId: string;
    kind: "comment" | "response";
    body: string;
    vid: string;
    ipHash: string;
    status?: Status;
  },
): Comment {
  const b = input.body.trim();
  const len = [...b].length;
  if (len < COMMENT_MIN || len > COMMENT_MAX) {
    throw new Error(`评论需在 ${COMMENT_MIN} 到 ${COMMENT_MAX} 字之间`);
  }
  const body = scrubPII(b);
  const id = newId();
  const status: Status = input.status ?? "pending";
  db.prepare(
    `INSERT INTO comments (id, entry_id, subject_id, kind, body, vid, ip_hash, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.entryId ?? null, input.subjectId, input.kind, body, input.vid, input.ipHash, status, now());
  appendEvent(db, "comment.created", id, {
    entryId: input.entryId ?? null,
    subjectId: input.subjectId,
    kind: input.kind,
    status,
  });
  return getComment(db, id)!;
}

export function getComment(db: DatabaseSync, id: string): Comment | null {
  const row = db.prepare("SELECT * FROM comments WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToComment(row) : null;
}

export function listComments(
  db: DatabaseSync,
  opts: { entryId?: string; subjectId?: string; kind?: "comment" | "response"; status?: Status } = {},
): Comment[] {
  const rows = db
    .prepare(
      `SELECT * FROM comments
       WHERE status = ?
         AND (? IS NULL OR entry_id = ?)
         AND (? IS NULL OR subject_id = ?)
         AND (? IS NULL OR kind = ?)
       ORDER BY created_at ASC`,
    )
    .all(
      opts.status ?? "published",
      opts.entryId ?? null,
      opts.entryId ?? null,
      opts.subjectId ?? null,
      opts.subjectId ?? null,
      opts.kind ?? null,
      opts.kind ?? null,
    ) as Row[];
  return rows.map(rowToComment);
}

export function listPendingComments(db: DatabaseSync): CommentWithSubject[] {
  const rows = db
    .prepare(
      `SELECT c.*, ${SUBJECT_JOIN_COLS}
       FROM comments c JOIN subjects s ON s.id = c.subject_id
       WHERE c.status = 'pending' ORDER BY c.created_at ASC`,
    )
    .all() as Row[];
  return rows.map((r) => ({ ...rowToComment(r), subject: prefixedSubject(r) }));
}

export function setCommentStatus(
  db: DatabaseSync,
  id: string,
  status: Status,
  opts: { reason?: string } = {},
): Comment {
  const cur = getComment(db, id);
  if (!cur) throw new Error("评论不存在");
  if (status === "removed") {
    const reason = opts.reason?.trim();
    if (!reason) throw new Error("下架必须填写原因");
    db.prepare("UPDATE comments SET status = ?, removed_reason = ?, removed_at = ? WHERE id = ?").run(status, reason, now(), id);
  } else {
    db.prepare("UPDATE comments SET status = ? WHERE id = ?").run(status, id);
  }
  appendEvent(db, `comment.${status}`, id, { from: cur.status, reason: opts.reason ?? null });
  return getComment(db, id)!;
}

export function countCommentsByStatus(db: DatabaseSync): Record<Status, number> {
  const rows = db.prepare("SELECT status, COUNT(*) AS n FROM comments GROUP BY status").all() as {
    status: Status;
    n: number;
  }[];
  const out: Record<Status, number> = { pending: 0, published: 0, rejected: 0, removed: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}
