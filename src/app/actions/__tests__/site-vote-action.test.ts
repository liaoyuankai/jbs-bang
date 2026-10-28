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
    delete: (k: string) => {
      jar.delete(k);
    },
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { siteVoteAction, siteVoteStatusAction } from "@/app/actions/site-vote";

beforeEach(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "jbs-vote-"));
  process.env.SESSION_SECRET = "test-secret";
  (globalThis as { __jbsDb?: unknown }).__jbsDb = undefined;
  jar.clear();
});

describe("siteVoteAction", () => {
  it("reports the tally without minting a visitor id", async () => {
    expect(await siteVoteStatusAction()).toEqual({ up: 0, down: 0, mine: null });
    expect(jar.has("vid")).toBe(false);
  });

  it("records the visitor's vote and returns the new tally", async () => {
    expect(await siteVoteAction("up")).toEqual({ up: 1, down: 0, mine: "up" });
    expect(jar.get("vid")).toMatch(/^[0-9a-f]{32}$/);
    expect(await siteVoteStatusAction()).toEqual({ up: 1, down: 0, mine: "up" });
    expect(await siteVoteAction("down")).toEqual({ up: 0, down: 1, mine: "down" });
  });

  it("ignores repeat clicks and rate limits switching per ip", async () => {
    for (let i = 0; i < 20; i++) await siteVoteAction("up");
    for (let i = 0; i < 9; i++) await siteVoteAction(i % 2 ? "up" : "down");
    // 1 + 9 changes used the hourly 10; ending on "down", an 11th change is refused
    const r = await siteVoteAction("up");
    expect(r.error).toMatch(/频繁/);
    expect(r.mine).toBe("down");
  });

  it("rejects a forged choice", async () => {
    const r = await siteVoteAction("maybe" as "up");
    expect(r.error).toMatch(/无效/);
    expect(r).toMatchObject({ up: 0, down: 0 });
  });
});
