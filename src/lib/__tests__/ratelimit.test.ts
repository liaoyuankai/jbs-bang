import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { checkRate, RATE_LIMITS } from "@/lib/ratelimit";

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
});
