import type { DatabaseSync } from "node:sqlite";
import { now } from "../types";

/** "点了 / 我也遇到过". One per visitor per entry; returns the new count. */
export function endorse(db: DatabaseSync, entryId: string, vid: string): number {
  db.prepare("INSERT OR IGNORE INTO endorsements (entry_id, vid, created_at) VALUES (?, ?, ?)").run(
    entryId,
    vid,
    now(),
  );
  return endorseCount(db, entryId);
}

export function endorseCount(db: DatabaseSync, entryId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM endorsements WHERE entry_id = ?").get(entryId) as {
    n: number;
  };
  return row.n;
}

export function hasEndorsed(db: DatabaseSync, entryId: string, vid: string): boolean {
  const row = db.prepare("SELECT 1 AS x FROM endorsements WHERE entry_id = ? AND vid = ?").get(entryId, vid);
  return !!row;
}

export function endorseCounts(db: DatabaseSync, entryIds: string[]): Map<string, number> {
  const out = new Map<string, number>();
  if (entryIds.length === 0) return out;
  const placeholders = entryIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT entry_id, COUNT(*) AS n FROM endorsements WHERE entry_id IN (${placeholders}) GROUP BY entry_id`)
    .all(...entryIds) as { entry_id: string; n: number }[];
  for (const r of rows) out.set(r.entry_id, r.n);
  return out;
}
