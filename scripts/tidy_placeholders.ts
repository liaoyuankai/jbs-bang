/**
 * The first pass over the DM blacklist sheet (read with a mode that dropped columns)
 * created one placeholder entry per name. Now that the real floors are in, a placeholder
 * whose subject already has black content (its own, or DMs filed under that shop) is
 * redundant: take it down with a public reason. Placeholders that are the only trace
 * of a listing stay.
 *
 * Usage: npx tsx scripts/tidy_placeholders.ts
 */
import { getDb } from "../src/lib/db";
import { setEntryStatus } from "../src/lib/repo/entries";

const PLACEHOLDER = "原表格「DM 黑榜」中被人列出，表里没有写事由。";
const REASON = "导入整理：这条只是名字占位，该店/该 DM 的具体评价已另成条目";

const db = getDb();
const rows = db
  .prepare(
    `SELECT e.id, s.id AS sid, s.type, s.name FROM entries e JOIN subjects s ON s.id = e.subject_id
     WHERE e.status = 'published' AND e.body = ?`,
  )
  .all(PLACEHOLDER) as { id: string; sid: string; type: string; name: string }[];
const others = db.prepare(
  `SELECT COUNT(*) AS n FROM entries e2 JOIN subjects s2 ON s2.id = e2.subject_id
   WHERE e2.list = 'black' AND e2.status = 'published' AND e2.id <> ?
     AND (e2.subject_id = ? OR (s2.type = 'dm' AND lower(COALESCE(s2.shop_name, '')) = lower(?)))`,
);
let removed = 0;
const kept: string[] = [];
for (const r of rows) {
  const n = Number((others.get(r.id, r.sid, r.name) as { n: number }).n);
  if (n > 0) {
    setEntryStatus(db, r.id, "removed", { reason: REASON });
    removed++;
  } else {
    kept.push(`${r.type}:${r.name}`);
  }
}
console.log(JSON.stringify({ placeholders: rows.length, removedAsRedundant: removed, kept }));
