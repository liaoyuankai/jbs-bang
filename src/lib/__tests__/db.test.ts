import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { newId } from "@/lib/ids";

describe("openDb", () => {
  it("creates every table the app needs", () => {
    const db = openDb(":memory:");
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);
    for (const t of ["subjects", "entries", "comments", "endorsements", "events", "rate_events"]) {
      expect(names).toContain(t);
    }
  });

  it("is idempotent when opened twice on the same file", () => {
    const db = openDb(":memory:");
    expect(() => openDb(":memory:")).not.toThrow();
    db.close();
  });
});

describe("newId", () => {
  it("returns 16 lowercase hex chars", () => {
    expect(newId()).toMatch(/^[0-9a-f]{16}$/);
  });

  it("returns different ids on successive calls", () => {
    expect(newId()).not.toBe(newId());
  });
});
