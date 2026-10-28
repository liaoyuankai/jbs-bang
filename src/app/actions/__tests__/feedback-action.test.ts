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
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { markFeedbackDoneAction } from "@/app/actions/admin";
import { feedbackAction } from "@/app/actions/feedback";
import { signAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { countOpenFeedback, listFeedback } from "@/lib/repo/feedback";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jbs-feedback-"));
  process.env.DATA_DIR = dir;
  process.env.SESSION_SECRET = "test-secret";
  (globalThis as { __jbsDb?: unknown }).__jbsDb = undefined;
  jar.clear();
});

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

async function call<T>(fn: () => Promise<T>) {
  try {
    return { kind: "state" as const, res: await fn() };
  } catch (e) {
    const digest = (e as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return { kind: "redirect" as const, to: digest.split(";")[2] };
    throw e;
  }
}

describe("feedbackAction", () => {
  it("stores anonymous feedback and thanks the visitor", async () => {
    const r = await feedbackAction({}, fd({ body: "首页加载有点慢" }));
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/收到/);
    expect(jar.get("vid")).toMatch(/^[0-9a-f]{32}$/);
    expect(listFeedback(getDb())[0].body).toBe("首页加载有点慢");
  });

  it("returns a Chinese error for an empty message and stores nothing", async () => {
    const r = await feedbackAction({}, fd({ body: " " }));
    expect(r.error).toMatch(/内容/);
    expect(listFeedback(getDb())).toHaveLength(0);
  });

  it("rate limits per ip", async () => {
    for (let i = 0; i < 5; i++) expect((await feedbackAction({}, fd({ body: `第 ${i} 条反馈` }))).ok).toBe(true);
    const r = await feedbackAction({}, fd({ body: "第 6 条" }));
    expect(r.error).toMatch(/频繁/);
  });
});

describe("markFeedbackDoneAction", () => {
  it("needs an admin session", async () => {
    await feedbackAction({}, fd({ body: "一条反馈" }));
    const id = listFeedback(getDb())[0].id;
    const r = await call(() => markFeedbackDoneAction(fd({ id })));
    expect(r).toEqual({ kind: "redirect", to: "/admin/login" });
    expect(countOpenFeedback(getDb())).toBe(1);
  });

  it("marks the message done and returns to the feedback page", async () => {
    await feedbackAction({}, fd({ body: "一条反馈" }));
    const id = listFeedback(getDb())[0].id;
    jar.set("admin", signAdmin("test-secret", Date.now() + 60_000));
    const r = await call(() => markFeedbackDoneAction(fd({ id })));
    expect(r).toEqual({ kind: "redirect", to: "/admin/feedback" });
    expect(countOpenFeedback(getDb())).toBe(0);
  });
});
