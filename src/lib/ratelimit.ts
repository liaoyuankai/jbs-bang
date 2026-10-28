import type { DatabaseSync } from "node:sqlite";

export type RateKind = "entry" | "comment" | "report" | "feedback" | "vote" | "login";

export const RATE_LIMITS: Record<RateKind, number> = { entry: 3, comment: 10, report: 10, feedback: 5, vote: 10, login: 10 };
export const RATE_WINDOW_MS = 60 * 60 * 1000;
/** A second, 24-hour cap on top of the hourly one, so a steady 3/hour cannot add up to 72 posts a day. */
export const DAILY_LIMITS: Partial<Record<RateKind, number>> = { entry: 10 };
const DAY_MS = 24 * RATE_WINDOW_MS;

export const RATE_MESSAGES: Record<RateKind, string> = {
  entry: "提交太频繁了，每小时最多 3 条、每天最多 10 条投稿，请稍后再试",
  comment: "评论太频繁了，每小时最多 10 条，请稍后再试",
  report: "举报太频繁了，每小时最多 10 次，请稍后再试",
  feedback: "反馈太频繁了，每小时最多 5 条，请稍后再试",
  vote: "操作太频繁了，请稍后再试",
  login: "尝试太频繁了，请一小时后再试",
};

/** Returns true and records the attempt when under the limit; false (and records nothing) otherwise. */
export function checkRate(db: DatabaseSync, ipHash: string, kind: RateKind, now: number = Date.now()): boolean {
  const count = (since: number) =>
    (
      db
        .prepare("SELECT COUNT(*) AS n FROM rate_events WHERE ip_hash = ? AND kind = ? AND created_at > ?")
        .get(ipHash, kind, since) as { n: number }
    ).n;
  if (count(now - RATE_WINDOW_MS) >= RATE_LIMITS[kind]) return false;
  const daily = DAILY_LIMITS[kind];
  if (daily !== undefined && count(now - DAY_MS) >= daily) return false;
  db.prepare("INSERT INTO rate_events (ip_hash, kind, created_at) VALUES (?, ?, ?)").run(ipHash, kind, now);
  // keep the table small; these rows carry no content, and nothing reads further back than a day
  db.prepare("DELETE FROM rate_events WHERE created_at < ?").run(now - DAY_MS);
  return true;
}
