import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export const GENESIS_HASH = "0".repeat(64);

export function computeHash(
  prevHash: string,
  kind: string,
  refId: string,
  payload: string,
  createdAt: string,
): string {
  return createHash("sha256")
    .update(`${prevHash}|${kind}|${refId}|${payload}|${createdAt}`)
    .digest("hex");
}

export function latestHash(db: DatabaseSync): string | null {
  const row = db.prepare("SELECT hash FROM events ORDER BY seq DESC LIMIT 1").get() as
    | { hash: string }
    | undefined;
  return row?.hash ?? null;
}

/** Append one immutable event to the chain. Every state change in the app goes through here. */
export function appendEvent(
  db: DatabaseSync,
  kind: string,
  refId: string,
  payload: object,
): { seq: number; hash: string } {
  const prev = latestHash(db) ?? GENESIS_HASH;
  const createdAt = new Date().toISOString();
  const body = JSON.stringify(payload);
  const hash = computeHash(prev, kind, refId, body, createdAt);
  const result = db
    .prepare(
      "INSERT INTO events (kind, ref_id, payload, prev_hash, hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(kind, refId, body, prev, hash, createdAt);
  return { seq: Number(result.lastInsertRowid), hash };
}

export function eventCount(db: DatabaseSync): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number };
  return row.n;
}
