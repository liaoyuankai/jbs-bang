import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
const setOptions = new Map<string, Record<string, unknown>>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string, opts?: Record<string, unknown>) => {
      jar.set(k, v);
      setOptions.set(k, opts ?? {});
    },
    delete: (k: string) => {
      jar.delete(k);
    },
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import {
  loginAction,
  logoutAction,
  moderateCommentAction,
  moderateEntryAction,
  toggleVerifiedAction,
  updateSubjectAction,
} from "@/app/actions/admin";
import { signAdmin, verifyAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { createComment, getComment } from "@/lib/repo/comments";
import { createEntry, getEntry } from "@/lib/repo/entries";
import { findOrCreateSubject, getSubject } from "@/lib/repo/subjects";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jbs-admin-"));
  process.env.DATA_DIR = dir;
  process.env.SESSION_SECRET = "test-secret";
  process.env.ADMIN_PASSWORD = "hunter2";
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

function loginAsAdmin() {
  jar.set("admin", signAdmin("test-secret", Date.now() + 60_000));
}

function seedPendingEntry() {
  const db = getDb();
  const s = findOrCreateSubject(db, { type: "shop", name: "甲店", city: "西安" });
  const e = createEntry(db, {
    subjectId: s.id,
    list: "black",
    category: "客服态度",
    body: "客服当着一个顾客的面说另一个顾客的坏话，第二天又否认。",
    vid: "v".repeat(32),
    ipHash: "ip",
  });
  return { s, e };
}

describe("loginAction", () => {
  it("rejects a wrong password", async () => {
    const r = await call(() => loginAction({}, fd({ password: "nope" })));
    expect(r.kind).toBe("state");
    if (r.kind === "state") expect(r.res.error).toBe("口令错误");
    expect(jar.has("admin")).toBe(false);
  });

  it("sets a verifiable session cookie and redirects on the right password", async () => {
    const r = await call(() => loginAction({}, fd({ password: "hunter2" })));
    expect(r).toEqual({ kind: "redirect", to: "/admin" });
    expect(verifyAdmin("test-secret", jar.get("admin"))).toBe(true);
  });

  it("refuses to log in when no password is configured", async () => {
    process.env.ADMIN_PASSWORD = "";
    const r = await call(() => loginAction({}, fd({ password: "" })));
    expect(r.kind).toBe("state");
    if (r.kind === "state") expect(r.res.error).toMatch(/ADMIN_PASSWORD/);
  });

  it("logs out", async () => {
    loginAsAdmin();
    const r = await call(() => logoutAction());
    expect(r).toEqual({ kind: "redirect", to: "/admin/login" });
    expect(jar.has("admin")).toBe(false);
  });

  it("refuses to log in on a production build with a placeholder or short SESSION_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      vi.stubEnv("SESSION_SECRET", "change-me-too");
      let r = await call(() => loginAction({}, fd({ password: "hunter2" })));
      expect(r.kind).toBe("state");
      if (r.kind === "state") expect(r.res.error).toMatch(/SESSION_SECRET/);
      vi.stubEnv("SESSION_SECRET", "short");
      r = await call(() => loginAction({}, fd({ password: "hunter2" })));
      expect(r.kind).toBe("state");
      if (r.kind === "state") expect(r.res.error).toMatch(/SESSION_SECRET/);
      expect(jar.has("admin")).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("sets the admin cookie with secure on a production build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "a-long-enough-production-secret-0123456789");
    try {
      await call(() => loginAction({}, fd({ password: "hunter2" })));
      expect(setOptions.get("admin")).toMatchObject({ httpOnly: true, secure: true });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rate limits password guesses per ip", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await call(() => loginAction({}, fd({ password: `wrong${i}` })));
      expect(r.kind).toBe("state");
    }
    const r = await call(() => loginAction({}, fd({ password: "hunter2" })));
    expect(r.kind).toBe("state");
    if (r.kind === "state") expect(r.res.error).toMatch(/频繁|稍后/);
    expect(jar.has("admin")).toBe(false);
  });
});

describe("moderateEntryAction", () => {
  it("redirects to login and changes nothing without a session", async () => {
    const { e } = seedPendingEntry();
    const r = await call(() => moderateEntryAction(fd({ id: e.id, decision: "approve" })));
    expect(r).toEqual({ kind: "redirect", to: "/admin/login" });
    expect(getEntry(getDb(), e.id)!.status).toBe("pending");
  });

  it("approves, optionally with an edited body", async () => {
    loginAsAdmin();
    const { e } = seedPendingEntry();
    await call(() => moderateEntryAction(fd({ id: e.id, decision: "approve", body: "编辑后的正文，去掉了情绪化的词，保留事实经过。" })));
    const after = getEntry(getDb(), e.id)!;
    expect(after.status).toBe("published");
    expect(after.body).toBe("编辑后的正文，去掉了情绪化的词，保留事实经过。");
  });

  it("rejects", async () => {
    loginAsAdmin();
    const { e } = seedPendingEntry();
    await call(() => moderateEntryAction(fd({ id: e.id, decision: "reject" })));
    expect(getEntry(getDb(), e.id)!.status).toBe("rejected");
  });

  it("removes with a reason and refuses removal without one", async () => {
    loginAsAdmin();
    const { e } = seedPendingEntry();
    await call(() => moderateEntryAction(fd({ id: e.id, decision: "approve" })));
    const r = await call(() => moderateEntryAction(fd({ id: e.id, decision: "remove", reason: "" })));
    expect(r.kind).toBe("redirect");
    if (r.kind === "redirect") expect(r.to).toContain("msg=");
    expect(getEntry(getDb(), e.id)!.status).toBe("published");
    await call(() => moderateEntryAction(fd({ id: e.id, decision: "remove", reason: "当事人申诉成立" })));
    const after = getEntry(getDb(), e.id)!;
    expect(after.status).toBe("removed");
    expect(after.removedReason).toBe("当事人申诉成立");
  });

  it("refuses to re-publish a removed entry so the tombstone stays", async () => {
    loginAsAdmin();
    const { e } = seedPendingEntry();
    await call(() => moderateEntryAction(fd({ id: e.id, decision: "approve" })));
    await call(() => moderateEntryAction(fd({ id: e.id, decision: "remove", reason: "当事人申诉成立" })));
    const r = await call(() => moderateEntryAction(fd({ id: e.id, decision: "approve" })));
    expect(r.kind).toBe("redirect");
    if (r.kind === "redirect") expect(r.to).toContain("msg=");
    const after = getEntry(getDb(), e.id)!;
    expect(after.status).toBe("removed");
    expect(after.removedReason).toBe("当事人申诉成立");
  });

  it("toggles verification", async () => {
    loginAsAdmin();
    const { e } = seedPendingEntry();
    await call(() => toggleVerifiedAction(fd({ id: e.id, verified: "1" })));
    expect(getEntry(getDb(), e.id)!.verified).toBe(true);
    await call(() => toggleVerifiedAction(fd({ id: e.id, verified: "0" })));
    expect(getEntry(getDb(), e.id)!.verified).toBe(false);
  });
});

describe("moderateCommentAction", () => {
  it("approves and removes comments", async () => {
    loginAsAdmin();
    const { s, e } = seedPendingEntry();
    const c = createComment(getDb(), { entryId: e.id, subjectId: s.id, kind: "comment", body: "我也遇到过", vid: "w".repeat(32), ipHash: "ip" });
    await call(() => moderateCommentAction(fd({ id: c.id, decision: "approve" })));
    expect(getComment(getDb(), c.id)!.status).toBe("published");
    await call(() => moderateCommentAction(fd({ id: c.id, decision: "remove", reason: "辱骂" })));
    expect(getComment(getDb(), c.id)!.status).toBe("removed");
  });
});

describe("updateSubjectAction", () => {
  it("renames and sets aliases", async () => {
    loginAsAdmin();
    const { s } = seedPendingEntry();
    await call(() => updateSubjectAction(fd({ id: s.id, name: "示例剧本杀", city: "西安", aliases: "甲店, 甲店店" })));
    const after = getSubject(getDb(), s.id)!;
    expect(after.name).toBe("示例剧本杀");
    expect(after.aliases).toEqual(["甲店", "甲店店"]);
  });
});
