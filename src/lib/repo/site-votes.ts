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
