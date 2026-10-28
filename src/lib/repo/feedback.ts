import type { DatabaseSync } from "node:sqlite";
import { newId } from "../ids";
import { now } from "../types";

export const FEEDBACK_MAX = 2000;

export type Feedback = {
  id: string;
  body: string;
  vid: string;
  ipHash: string;
  status: "open" | "done";
  createdAt: string;
  doneAt: string | null;
};

type Row = Record<string, unknown>;

function rowToFeedback(r: Row): Feedback {
  return {
    id: r.id as string,
    body: r.body as string,
    vid: r.vid as string,
    ipHash: r.ip_hash as string,
    status: r.status as "open" | "done",
    createdAt: r.created_at as string,
    doneAt: (r.done_at as string | null) ?? null,
  };
}

/** Feedback is private to the developer, so it is stored as written: a visitor may leave a way to reach them. */
export function createFeedback(db: DatabaseSync, input: { body: string; vid: string; ipHash: string }): Feedback {
  const body = input.body.trim();
  if (!body) throw new Error("请写点内容");
  if ([...body].length > FEEDBACK_MAX) throw new Error(`反馈最多 ${FEEDBACK_MAX} 字`);
  const id = newId();
  db.prepare("INSERT INTO feedback (id, body, vid, ip_hash, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)").run(
    id,
    body,
    input.vid,
    input.ipHash,
    now(),
  );
  return getFeedback(db, id)!;
}

export function getFeedback(db: DatabaseSync, id: string): Feedback | null {
  const row = db.prepare("SELECT * FROM feedback WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToFeedback(row) : null;
}

export function listFeedback(db: DatabaseSync, opts: { status?: "open" | "done"; limit?: number } = {}): Feedback[] {
  const rows = db
    .prepare("SELECT * FROM feedback WHERE (? IS NULL OR status = ?) ORDER BY created_at DESC, rowid DESC LIMIT ?")
    .all(opts.status ?? null, opts.status ?? null, opts.limit ?? 200) as Row[];
  return rows.map(rowToFeedback);
}

export function markFeedbackDone(db: DatabaseSync, id: string): Feedback {
  if (!getFeedback(db, id)) throw new Error("反馈不存在");
  db.prepare("UPDATE feedback SET status = 'done', done_at = ? WHERE id = ?").run(now(), id);
  return getFeedback(db, id)!;
}

export function countOpenFeedback(db: DatabaseSync): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE status = 'open'").get() as { n: number };
  return Number(row.n);
}
