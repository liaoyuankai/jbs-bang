import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { appendEvent, computeHash, latestHash } from "@/lib/events";

describe("event hash chain", () => {
  it("links each event to the previous hash", () => {
    const db = openDb(":memory:");
    expect(latestHash(db)).toBeNull();

    const first = appendEvent(db, "entry.created", "e1", { body: "a" });
    const second = appendEvent(db, "entry.published", "e1", {});

    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(second.seq).toBe(first.seq + 1);

    const row = db.prepare("SELECT prev_hash FROM events WHERE seq = ?").get(second.seq) as {
      prev_hash: string;
    };
    expect(row.prev_hash).toBe(first.hash);
    expect(latestHash(db)).toBe(second.hash);
  });

  it("exposes tampering when a payload is edited after the fact", () => {
    const db = openDb(":memory:");
    const first = appendEvent(db, "entry.created", "e1", { body: "original" });
    db.prepare("UPDATE events SET payload = ? WHERE seq = ?").run("tampered", first.seq);

    const row = db
      .prepare("SELECT kind, ref_id, payload, prev_hash, hash, created_at FROM events WHERE seq = ?")
      .get(first.seq) as {
      kind: string;
      ref_id: string;
      payload: string;
      prev_hash: string;
      hash: string;
      created_at: string;
    };
    const recomputed = computeHash(row.prev_hash, row.kind, row.ref_id, row.payload, row.created_at);
    expect(recomputed).not.toBe(row.hash);
  });
});
