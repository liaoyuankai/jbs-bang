import { beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { castSiteVote, getSiteVote, siteVoteTally } from "@/lib/repo/site-votes";

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

  it("rejects anything but up or down", () => {
    expect(() => castSiteVote(db, { vid: "v1", ipHash: "ip", choice: "maybe" as "up" })).toThrow(/无效/);
  });
});
