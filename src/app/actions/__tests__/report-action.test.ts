import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => {
      jar.set(k, v);
    },
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { reportAction } from "@/app/actions/report";
import { getDb } from "@/lib/db";
import { createEntry } from "@/lib/repo/entries";
import { countReports, listOpenReports, REPORT_REASONS } from "@/lib/repo/reports";
import { findOrCreateSubject } from "@/lib/repo/subjects";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jbs-report-"));
  process.env.DATA_DIR = dir;
  process.env.SESSION_SECRET = "test-secret";
  (globalThis as { __jbsDb?: unknown }).__jbsDb = undefined;
  jar.clear();
});

function seedEntry() {
  const db = getDb();
  const s = findOrCreateSubject(db, { type: "shop", name: "甲店", city: "西安" });
  return createEntry(db, {
    subjectId: s.id,
    list: "black",
    category: "客服态度",
    body: "客服当着一个顾客的面说另一个顾客的坏话，第二天又否认。",
    vid: "v".repeat(32),
    ipHash: "ip",
  });
}

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("reportAction", () => {
  it("files a report for an anonymous visitor and confirms it", async () => {
    const e = seedEntry();
    const r = await reportAction({}, fd({ targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[0], detail: "" }));
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/收到/);
    expect(jar.get("vid")).toMatch(/^[0-9a-f]{32}$/);
    expect(listOpenReports(getDb())).toHaveLength(1);
  });

  it("tells a repeat reporter their report already counts, without a second row", async () => {
    const e = seedEntry();
    await reportAction({}, fd({ targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[0] }));
    const r = await reportAction({}, fd({ targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[1] }));
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/已经举报过/);
    expect(countReports(getDb())).toEqual({ open: 1, handled: 0 });
  });

  it("returns a Chinese error for a bad target or reason", async () => {
    const r1 = await reportAction({}, fd({ targetKind: "entry", targetId: "nope", reason: REPORT_REASONS[0] }));
    expect(r1.error).toMatch(/不存在/);
    const e = seedEntry();
    const r2 = await reportAction({}, fd({ targetKind: "entry", targetId: e.id, reason: "随便" }));
    expect(r2.error).toMatch(/理由/);
    const r3 = await reportAction({}, fd({ targetKind: "thing", targetId: e.id, reason: REPORT_REASONS[0] }));
    expect(r3.error).toBeTruthy();
  });

  it("rate limits reports per ip", async () => {
    const db = getDb();
    const s = findOrCreateSubject(db, { type: "shop", name: "甲店", city: "西安" });
    const ids: string[] = [];
    for (let i = 0; i < 11; i++) {
      ids.push(
        createEntry(db, {
          subjectId: s.id,
          list: "black",
          category: "客服态度",
          body: `第 ${i} 条：客服当着一个顾客的面说另一个顾客的坏话，第二天又否认。`,
          vid: "v".repeat(32),
          ipHash: "ip",
        }).id,
      );
    }
    for (let i = 0; i < 10; i++) {
      expect((await reportAction({}, fd({ targetKind: "entry", targetId: ids[i], reason: REPORT_REASONS[0] }))).ok).toBe(true);
    }
    const r = await reportAction({}, fd({ targetKind: "entry", targetId: ids[10], reason: REPORT_REASONS[0] }));
    expect(r.error).toMatch(/频繁/);
  });
});
