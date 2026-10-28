import type { DatabaseSync } from "node:sqlite";
import { appendEvent } from "../events";
import { newId } from "../ids";
import { isReportReason, isReportTargetKind, REPORT_DETAIL_MAX, type ReportTargetKind } from "../reports";
import { scrubPII } from "../scrub";
import {
  now,
  prefixedSubject,
  rowToComment,
  rowToEntry,
  SUBJECT_JOIN_COLS,
  type CommentWithSubject,
  type EntryWithSubject,
} from "../types";

export { REPORT_REASONS, isReportTargetKind, type ReportTargetKind } from "../reports";

type Row = Record<string, unknown>;

export type ReportGroup = {
  targetKind: ReportTargetKind;
  targetId: string;
  count: number;
  firstAt: string;
  lastAt: string;
  reasons: { reason: string; n: number }[];
  details: string[];
  target: { kind: "entry"; entry: EntryWithSubject } | { kind: "comment"; comment: CommentWithSubject };
};

function loadTarget(db: DatabaseSync, kind: ReportTargetKind, id: string): ReportGroup["target"] | null {
  if (kind === "entry") {
    const row = db
      .prepare(`SELECT e.*, ${SUBJECT_JOIN_COLS} FROM entries e JOIN subjects s ON s.id = e.subject_id WHERE e.id = ?`)
      .get(id) as Row | undefined;
    if (!row || row.status !== "published") return null;
    return { kind: "entry", entry: { ...rowToEntry(row), subject: prefixedSubject(row) } };
  }
  const row = db
    .prepare(`SELECT c.*, ${SUBJECT_JOIN_COLS} FROM comments c JOIN subjects s ON s.id = c.subject_id WHERE c.id = ?`)
    .get(id) as Row | undefined;
  if (!row || row.status !== "published") return null;
  return { kind: "comment", comment: { ...rowToComment(row), subject: prefixedSubject(row) } };
}

/** Throws a Chinese message when the report could not be accepted; cheap enough to run before the rate limit. */
export function validateReport(db: DatabaseSync, input: { targetKind: string; targetId: string; reason: string }): void {
  if (!isReportTargetKind(input.targetKind)) throw new Error("举报对象不正确");
  if (!isReportReason(input.reason)) throw new Error("请选择举报理由");
  if (!loadTarget(db, input.targetKind, input.targetId)) throw new Error("内容不存在或已下架");
}

/** One report per visitor per target. Returns false when this visitor already reported it. */
export function createReport(
  db: DatabaseSync,
  input: { targetKind: ReportTargetKind; targetId: string; reason: string; detail?: string | null; vid: string; ipHash: string },
): boolean {
  validateReport(db, input);
  const raw = input.detail?.trim();
  const detail = raw ? [...scrubPII(raw)].slice(0, REPORT_DETAIL_MAX).join("") : null;
  const id = newId();
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO reports (id, target_kind, target_id, reason, detail, vid, ip_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    )
    .run(id, input.targetKind, input.targetId, input.reason, detail, input.vid, input.ipHash, now());
  if (Number(res.changes) === 0) return false;
  appendEvent(db, "report.created", id, { targetKind: input.targetKind, targetId: input.targetId, reason: input.reason });
  return true;
}

/** Open reports grouped by target, most recently reported first. Targets that are no longer published are left out. */
export function listOpenReports(db: DatabaseSync): ReportGroup[] {
  const groups = db
    .prepare(
      `SELECT target_kind, target_id, COUNT(*) AS n, MIN(created_at) AS first_at, MAX(created_at) AS last_at
       FROM reports WHERE status = 'open'
       GROUP BY target_kind, target_id
       ORDER BY last_at DESC, MAX(rowid) DESC`,
    )
    .all() as { target_kind: ReportTargetKind; target_id: string; n: number; first_at: string; last_at: string }[];
  const reasonsStmt = db.prepare(
    `SELECT reason, COUNT(*) AS n FROM reports WHERE status = 'open' AND target_kind = ? AND target_id = ?
     GROUP BY reason ORDER BY n DESC, reason ASC`,
  );
  const detailsStmt = db.prepare(
    `SELECT detail FROM reports WHERE status = 'open' AND target_kind = ? AND target_id = ? AND detail IS NOT NULL
     ORDER BY created_at ASC`,
  );
  const out: ReportGroup[] = [];
  for (const g of groups) {
    const target = loadTarget(db, g.target_kind, g.target_id);
    if (!target) continue;
    out.push({
      targetKind: g.target_kind,
      targetId: g.target_id,
      count: Number(g.n),
      firstAt: g.first_at,
      lastAt: g.last_at,
      reasons: (reasonsStmt.all(g.target_kind, g.target_id) as { reason: string; n: number }[]).map((r) => ({
        reason: r.reason,
        n: Number(r.n),
      })),
      details: (detailsStmt.all(g.target_kind, g.target_id) as { detail: string }[]).map((r) => r.detail),
      target,
    });
  }
  return out;
}

/** Marks every open report on the target handled. Returns how many were closed. */
export function handleReports(db: DatabaseSync, targetKind: ReportTargetKind, targetId: string): number {
  const res = db
    .prepare("UPDATE reports SET status = 'handled', handled_at = ? WHERE status = 'open' AND target_kind = ? AND target_id = ?")
    .run(now(), targetKind, targetId);
  const n = Number(res.changes);
  if (n > 0) appendEvent(db, "report.handled", targetId, { targetKind, n });
  return n;
}

export function countReports(db: DatabaseSync): { open: number; handled: number } {
  const rows = db.prepare("SELECT status, COUNT(*) AS n FROM reports GROUP BY status").all() as { status: string; n: number }[];
  const out = { open: 0, handled: 0 };
  for (const r of rows) if (r.status === "open" || r.status === "handled") out[r.status] = Number(r.n);
  return out;
}

/** How many distinct targets have open reports: what the admin sees as queue length. */
export function countOpenTargets(db: DatabaseSync): number {
  const row = db
    .prepare("SELECT COUNT(DISTINCT target_kind || ':' || target_id) AS n FROM reports WHERE status = 'open'")
    .get() as { n: number };
  return Number(row.n);
}
