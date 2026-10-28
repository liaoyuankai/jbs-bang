import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { newId } from "../ids";
import { appendEvent } from "../events";
import { scrubPII } from "../scrub";
import { CATEGORIES, isListKind, type ListKind } from "../taxonomy";
import {
  now,
  prefixedSubject,
  rowToEntry,
  SUBJECT_JOIN_COLS,
  type Entry,
  type EntryWithSubject,
  type Source,
  type Status,
} from "../types";
import { getSubject } from "./subjects";

type Row = Record<string, unknown>;

export const BODY_MIN = 10;
export const BODY_MAX = 2000;

export type NewEntry = {
  subjectId: string;
  list: ListKind;
  category: string;
  body: string;
  vid: string;
  ipHash: string;
  occurredAt?: string | null;
  status?: Status;
  source?: Source;
};

export function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

function validateBody(body: string): string {
  const b = body.trim();
  const len = [...b].length;
  if (len < BODY_MIN || len > BODY_MAX) {
    throw new Error(`正文需在 ${BODY_MIN} 到 ${BODY_MAX} 字之间`);
  }
  return scrubPII(b);
}

export function createEntry(db: DatabaseSync, input: NewEntry): Entry {
  const subject = getSubject(db, input.subjectId);
  if (!subject) throw new Error("对象不存在");
  if (!isListKind(input.list)) throw new Error("榜单类型不正确");
  if (!CATEGORIES[subject.type][input.list].includes(input.category)) {
    throw new Error("分类不正确");
  }
  const body = validateBody(input.body);
  const id = newId();
  const status: Status = input.status ?? "pending";
  const source: Source = input.source ?? "web";
  const occurredAt = input.occurredAt && /^\d{4}-\d{2}$/.test(input.occurredAt) ? input.occurredAt : null;
  const bodyHash = hashBody(body);
  db.prepare(
    `INSERT INTO entries (id, subject_id, list, category, body, body_hash, occurred_at, evidence_count,
       vid, ip_hash, status, source, verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0, ?)`,
  ).run(id, subject.id, input.list, input.category, body, bodyHash, occurredAt, input.vid, input.ipHash, status, source, now());
  appendEvent(db, "entry.created", id, {
    subjectId: subject.id,
    list: input.list,
    category: input.category,
    bodyHash,
    status,
    source,
  });
  return getEntry(db, id)!;
}

export function getEntry(db: DatabaseSync, id: string): Entry | null {
  const row = db.prepare("SELECT * FROM entries WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToEntry(row) : null;
}

export function getEntryWithSubject(db: DatabaseSync, id: string): EntryWithSubject | null {
  const row = db
    .prepare(`SELECT e.*, ${SUBJECT_JOIN_COLS} FROM entries e JOIN subjects s ON s.id = e.subject_id WHERE e.id = ?`)
    .get(id) as Row | undefined;
  return row ? { ...rowToEntry(row), subject: prefixedSubject(row) } : null;
}

export function listEntries(
  db: DatabaseSync,
  opts: {
    city?: string;
    list?: ListKind;
    subjectId?: string;
    status?: Status;
    limit?: number;
    offset?: number;
  } = {},
): EntryWithSubject[] {
  const rows = db
    .prepare(
      `SELECT e.*, ${SUBJECT_JOIN_COLS}
       FROM entries e JOIN subjects s ON s.id = e.subject_id
       WHERE e.status = ?
         AND (? IS NULL OR s.city = ?)
         AND (? IS NULL OR e.list = ?)
         AND (? IS NULL OR e.subject_id = ?)
       ORDER BY e.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(
      opts.status ?? "published",
      opts.city ?? null,
      opts.city ?? null,
      opts.list ?? null,
      opts.list ?? null,
      opts.subjectId ?? null,
      opts.subjectId ?? null,
      opts.limit ?? 50,
      opts.offset ?? 0,
    ) as Row[];
  return rows.map((r) => ({ ...rowToEntry(r), subject: prefixedSubject(r) }));
}

export function listPending(db: DatabaseSync): EntryWithSubject[] {
  const rows = db
    .prepare(
      `SELECT e.*, ${SUBJECT_JOIN_COLS}
       FROM entries e JOIN subjects s ON s.id = e.subject_id
       WHERE e.status = 'pending' ORDER BY e.created_at ASC`,
    )
    .all() as Row[];
  return rows.map((r) => ({ ...rowToEntry(r), subject: prefixedSubject(r) }));
}

export function setEntryStatus(
  db: DatabaseSync,
  id: string,
  status: Status,
  opts: { reason?: string } = {},
): Entry {
  const cur = getEntry(db, id);
  if (!cur) throw new Error("条目不存在");
  const t = now();
  if (status === "removed") {
    const reason = opts.reason?.trim();
    if (!reason) throw new Error("下架必须填写原因");
    db.prepare("UPDATE entries SET status = ?, removed_reason = ?, removed_at = ? WHERE id = ?").run(status, reason, t, id);
  } else {
    db.prepare("UPDATE entries SET status = ?, reviewed_at = ? WHERE id = ?").run(status, t, id);
  }
  appendEvent(db, `entry.${status}`, id, { from: cur.status, reason: opts.reason ?? null });
  return getEntry(db, id)!;
}

export function setVerified(db: DatabaseSync, id: string, verified: boolean): Entry {
  if (!getEntry(db, id)) throw new Error("条目不存在");
  db.prepare("UPDATE entries SET verified = ? WHERE id = ?").run(verified ? 1 : 0, id);
  appendEvent(db, verified ? "entry.verified" : "entry.unverified", id, {});
  return getEntry(db, id)!;
}

export function updateEntryBody(db: DatabaseSync, id: string, body: string): Entry {
  const cur = getEntry(db, id);
  if (!cur) throw new Error("条目不存在");
  const clean = validateBody(body);
  const bodyHash = hashBody(clean);
  db.prepare("UPDATE entries SET body = ?, body_hash = ? WHERE id = ?").run(clean, bodyHash, id);
  appendEvent(db, "entry.edited", id, { previousHash: cur.bodyHash, bodyHash });
  return getEntry(db, id)!;
}

export function setEvidenceCount(db: DatabaseSync, id: string, n: number): void {
  db.prepare("UPDATE entries SET evidence_count = ? WHERE id = ?").run(n, id);
}

export function countByStatus(db: DatabaseSync): Record<Status, number> {
  const rows = db.prepare("SELECT status, COUNT(*) AS n FROM entries GROUP BY status").all() as {
    status: Status;
    n: number;
  }[];
  const out: Record<Status, number> = { pending: 0, published: 0, rejected: 0, removed: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export function listRemoved(db: DatabaseSync, limit = 100): EntryWithSubject[] {
  const rows = db
    .prepare(
      `SELECT e.*, ${SUBJECT_JOIN_COLS}
       FROM entries e JOIN subjects s ON s.id = e.subject_id
       WHERE e.status = 'removed' ORDER BY e.removed_at DESC LIMIT ?`,
    )
    .all(limit) as Row[];
  return rows.map((r) => ({ ...rowToEntry(r), subject: prefixedSubject(r) }));
}

export function findImportedByHash(db: DatabaseSync, subjectId: string, bodyHash: string): Entry | null {
  const row = db
    .prepare("SELECT * FROM entries WHERE subject_id = ? AND body_hash = ? AND source = 'import'")
    .get(subjectId, bodyHash) as Row | undefined;
  return row ? rowToEntry(row) : null;
}
