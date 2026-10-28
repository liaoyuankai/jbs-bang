import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { checkRate, DAILY_LIMITS, RATE_LIMITS } from "@/lib/ratelimit";

describe("checkRate", () => {
  it("allows three entries per hour from one ip and refuses the fourth", () => {
    const db = openDb(":memory:");
    const t0 = 1_700_000_000_000;
    expect(RATE_LIMITS.entry).toBe(3);
    expect(checkRate(db, "ipA", "entry", t0)).toBe(true);
    expect(checkRate(db, "ipA", "entry", t0 + 1)).toBe(true);
    expect(checkRate(db, "ipA", "entry", t0 + 2)).toBe(true);
    expect(checkRate(db, "ipA", "entry", t0 + 3)).toBe(false);
  });

  it("opens the window again after an hour", () => {
    const db = openDb(":memory:");
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < 3; i++) checkRate(db, "ipA", "entry", t0 + i);
    expect(checkRate(db, "ipA", "entry", t0 + 3)).toBe(false);
    expect(checkRate(db, "ipA", "entry", t0 + 3_600_001)).toBe(true);
  });

  it("counts kinds and ips separately", () => {
    const db = openDb(":memory:");
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < 3; i++) checkRate(db, "ipA", "entry", t0 + i);
    expect(checkRate(db, "ipB", "entry", t0)).toBe(true);
    for (let i = 0; i < 10; i++) expect(checkRate(db, "ipA", "comment", t0 + i)).toBe(true);
    expect(checkRate(db, "ipA", "comment", t0 + 10)).toBe(false);
  });

  it("allows ten login attempts per hour and refuses the eleventh", () => {
    const db = openDb(":memory:");
    const t0 = 1_700_000_000_000;
    expect(RATE_LIMITS.login).toBe(10);
    for (let i = 0; i < 10; i++) expect(checkRate(db, "ipA", "login", t0 + i)).toBe(true);
    expect(checkRate(db, "ipA", "login", t0 + 10)).toBe(false);
  });

  it("does not record a refused attempt", () => {
    const db = openDb(":memory:");
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < 4; i++) checkRate(db, "ipA", "entry", t0 + i);
    const row = db.prepare("SELECT COUNT(*) AS n FROM rate_events").get() as { n: number };
    expect(row.n).toBe(3);
  });

  it("caps entries at ten per 24 hours even when spread out under the hourly limit", () => {
    const db = openDb(":memory:");
    const t0 = 1_700_000_000_000;
    const hour = 3_600_001;
    expect(DAILY_LIMITS.entry).toBe(10);
    for (let i = 0; i < 10; i++) expect(checkRate(db, "ipA", "entry", t0 + Math.floor(i / 2) * hour + i)).toBe(true);
    expect(checkRate(db, "ipA", "entry", t0 + 6 * hour)).toBe(false);
    expect(checkRate(db, "ipB", "entry", t0 + 6 * hour)).toBe(true);
    // a day after the first post the oldest ones age out
    expect(checkRate(db, "ipA", "entry", t0 + 24 * 3_600_000 + 1)).toBe(true);
  });

  it("puts no daily cap on kinds without one", () => {
    const db = openDb(":memory:");
    const t0 = 1_700_000_000_000;
    for (let h = 0; h < 3; h++) for (let i = 0; i < 10; i++) expect(checkRate(db, "ipA", "comment", t0 + h * 3_600_001 + i)).toBe(true);
  });
});
