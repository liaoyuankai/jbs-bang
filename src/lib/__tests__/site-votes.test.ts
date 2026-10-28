import { beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { castSiteVote, getSiteVote, siteVoteDaily, siteVoteTally } from "@/lib/repo/site-votes";

let db: ReturnType<typeof openDb>;
beforeEach(() => {
  db = openDb(":memory:");
});

describe("site votes", () => {
  it("counts one vote per visitor and lets a visitor change their mind", () => {
    expect(siteVoteTally(db)).toEqual({ up: 0, down: 0 });
    castSiteVote(db, { vid: "v1", ipHash: "ip", choice: "up" });
    castSiteVote(db, { vid: "v1", ipHash: "ip", choice: "up" });
    castSiteVote(db, { vid: "v2", ipHash: "ip", choice: "down" });
    expect(siteVoteTally(db)).toEqual({ up: 1, down: 1 });
    castSiteVote(db, { vid: "v2", ipHash: "ip", choice: "up" });
    expect(siteVoteTally(db)).toEqual({ up: 2, down: 0 });
    expect(getSiteVote(db, "v2")).toBe("up");
    expect(getSiteVote(db, "nobody")).toBeNull();
  });

  it("breaks votes down by Beijing-time day with running totals, oldest first", () => {
    const ins = db.prepare("INSERT INTO site_votes (vid, choice, ip_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
    ins.run("a", "up", "ip", "2026-10-27T15:30:00.000Z", "2026-10-27T15:30:00.000Z"); // 10-27 23:30 北京
    ins.run("b", "up", "ip", "2026-10-27T16:30:00.000Z", "2026-10-27T16:30:00.000Z"); // 10-28 00:30 北京
    ins.run("c", "down", "ip", "2026-10-28T03:00:00.000Z", "2026-10-28T03:00:00.000Z");
    ins.run("d", "up", "ip", "2026-10-30T03:00:00.000Z", "2026-10-30T03:00:00.000Z");
    expect(siteVoteDaily(db)).toEqual([
      { date: "2026-10-27", up: 1, down: 0, totalUp: 1, totalDown: 0 },
      { date: "2026-10-28", up: 1, down: 1, totalUp: 2, totalDown: 1 },
      { date: "2026-10-30", up: 1, down: 0, totalUp: 3, totalDown: 1 },
    ]);
    expect(siteVoteDaily(db, 2)).toHaveLength(2);
    expect(siteVoteDaily(db, 2)[0].date).toBe("2026-10-28");
  });

  it("rejects anything but up or down", () => {
    expect(() => castSiteVote(db, { vid: "v1", ipHash: "ip", choice: "maybe" as "up" })).toThrow(/无效/);
  });
});
