import type { DatabaseSync } from "node:sqlite";
import type { ListKind, SubjectType } from "../taxonomy";
import { rowToSubject, type Subject } from "../types";

export type RankRow = {
  subject: Subject;
  entries: number;
  endorsements: number;
  comments: number;
  score: number;
};

/** 热度 = 投稿 ×3 + 附和 ×2 + 评论 ×1. Entries are the strongest signal because each one is a separate person's account. */
export function heatScore(p: { entries: number; endorsements: number; comments: number }): number {
  return p.entries * 3 + p.endorsements * 2 + p.comments;
}

/** Subjects of one list ordered by heat; only live content counts, so a subject with everything removed drops out. */
export function rankSubjects(
  db: DatabaseSync,
  opts: { city?: string; list: ListKind; type?: SubjectType; limit?: number },
): RankRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT s.*,
           COUNT(e.id) AS entries,
           (SELECT COUNT(*) FROM endorsements en JOIN entries e2 ON e2.id = en.entry_id
             WHERE e2.subject_id = s.id AND e2.list = ? AND e2.status = 'published') AS endorsements,
           (SELECT COUNT(*) FROM comments c JOIN entries e3 ON e3.id = c.entry_id
             WHERE e3.subject_id = s.id AND e3.list = ? AND e3.status = 'published' AND c.status = 'published') AS comments
         FROM subjects s
         JOIN entries e ON e.subject_id = s.id AND e.status = 'published' AND e.list = ?
         WHERE (? IS NULL OR s.city = ?)
           AND (? IS NULL OR s.type = ?)
         GROUP BY s.id
       )
       ORDER BY (entries * 3 + endorsements * 2 + comments) DESC, entries DESC, name ASC
       LIMIT ?`,
    )
    .all(
      opts.list,
      opts.list,
      opts.list,
      opts.city ?? null,
      opts.city ?? null,
      opts.type ?? null,
      opts.type ?? null,
      opts.limit ?? 50,
    ) as Record<string, unknown>[];
  return rows.map((r) => {
    const parts = { entries: Number(r.entries), endorsements: Number(r.endorsements), comments: Number(r.comments) };
    return { subject: rowToSubject(r), ...parts, score: heatScore(parts) };
  });
}

export type NetRankRow = {
  subject: Subject;
  /** people, not posts: see VOTER */
  red: number;
  black: number;
  net: number;
};

/**
 * Who an entry counts for on the net board: one ip is one voice per subject and list, however many times it posts.
 * Imported entries all share the "import" ip but each came from a different person, so each one counts by itself.
 */
const VOTER = "CASE WHEN e.source = 'import' THEN 'entry:' || e.id ELSE 'ip:' || e.ip_hash END";

/** One row per subject of one type, scored 红榜人数 − 黑榜人数 over live entries; ties go to the subject with more people. */
export function rankSubjectsNet(db: DatabaseSync, opts: { city?: string; type: SubjectType }): NetRankRow[] {
  const rows = db
    .prepare(
      `SELECT s.*,
         COUNT(DISTINCT CASE WHEN e.list = 'red' THEN ${VOTER} END) AS red,
         COUNT(DISTINCT CASE WHEN e.list = 'black' THEN ${VOTER} END) AS black
       FROM subjects s
       JOIN entries e ON e.subject_id = s.id AND e.status = 'published'
       WHERE (? IS NULL OR s.city = ?) AND s.type = ?
       GROUP BY s.id
       ORDER BY (red - black) DESC, (red + black) DESC, s.name ASC`,
    )
    .all(opts.city ?? null, opts.city ?? null, opts.type) as Record<string, unknown>[];
  return rows.map((r) => {
    const red = Number(r.red);
    const black = Number(r.black);
    return { subject: rowToSubject(r), red, black, net: red - black };
  });
}
