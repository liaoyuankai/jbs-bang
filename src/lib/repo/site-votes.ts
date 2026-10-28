import type { DatabaseSync } from "node:sqlite";
import { now } from "../types";

export type SiteVoteChoice = "up" | "down";
export type SiteVoteTally = { up: number; down: number };

export function isSiteVoteChoice(v: unknown): v is SiteVoteChoice {
  return v === "up" || v === "down";
}

/** "支持站长继续维护吗". One vote per visitor; voting again changes the choice. */
export function castSiteVote(db: DatabaseSync, input: { vid: string; ipHash: string; choice: SiteVoteChoice }): void {
  if (!isSiteVoteChoice(input.choice)) throw new Error("无效的选择");
  const t = now();
  db.prepare(
    `INSERT INTO site_votes (vid, choice, ip_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(vid) DO UPDATE SET choice = excluded.choice, ip_hash = excluded.ip_hash, updated_at = excluded.updated_at`,
  ).run(input.vid, input.choice, input.ipHash, t, t);
}

export function getSiteVote(db: DatabaseSync, vid: string): SiteVoteChoice | null {
  const row = db.prepare("SELECT choice FROM site_votes WHERE vid = ?").get(vid) as { choice: string } | undefined;
  return row && isSiteVoteChoice(row.choice) ? row.choice : null;
}

export function siteVoteTally(db: DatabaseSync): SiteVoteTally {
  const rows = db.prepare("SELECT choice, COUNT(*) AS n FROM site_votes GROUP BY choice").all() as {
    choice: string;
    n: number;
  }[];
  const out: SiteVoteTally = { up: 0, down: 0 };
  for (const r of rows) if (isSiteVoteChoice(r.choice)) out[r.choice] = Number(r.n);
  return out;
}

export type SiteVoteDay = { date: string; up: number; down: number; totalUp: number; totalDown: number };

/** Votes per Beijing-time day (days with activity only), oldest first, with running totals; `last` keeps only the most recent N days. */
export function siteVoteDaily(db: DatabaseSync, last?: number): SiteVoteDay[] {
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m-%d', created_at, '+8 hours') AS d, choice, COUNT(*) AS n
       FROM site_votes GROUP BY d, choice ORDER BY d ASC`,
    )
    .all() as { d: string; choice: string; n: number }[];
  const byDay = new Map<string, { up: number; down: number }>();
  for (const r of rows) {
    const day = byDay.get(r.d) ?? { up: 0, down: 0 };
    if (isSiteVoteChoice(r.choice)) day[r.choice] += Number(r.n);
    byDay.set(r.d, day);
  }
  let totalUp = 0;
  let totalDown = 0;
  const out: SiteVoteDay[] = [];
  for (const [date, c] of byDay) {
    totalUp += c.up;
    totalDown += c.down;
    out.push({ date, up: c.up, down: c.down, totalUp, totalDown });
  }
  return last ? out.slice(-last) : out;
}
