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
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }),
}));

import { createEntryAction } from "@/app/actions/entries";
import { getDb } from "@/lib/db";
import { listEntries, listPending } from "@/lib/repo/entries";
import { PII_MASK } from "@/lib/scrub";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jbs-action-"));
  process.env.DATA_DIR = dir;
  process.env.SESSION_SECRET = "test-secret";
  (globalThis as { __jbsDb?: unknown }).__jbsDb = undefined;
  jar.clear();
});

function form(overrides: Record<string, string> = {}, files: File[] = []): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    type: "shop",
    list: "black",
    category: "客服态度",
    body: "客服当着一个顾客的面说另一个顾客的坏话，第二天又发声明说是假的，微信 abc_12345。",
    name: "新店铺",
    city: "西安",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  for (const f of files) fd.append("evidence", f);
  return fd;
}

async function submit(fd: FormData) {
  try {
    const res = await createEntryAction({}, fd);
    return { kind: "state" as const, res };
  } catch (e) {
    const digest = (e as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return { kind: "redirect" as const, to: digest.split(";")[2] };
    throw e;
  }
}

describe("createEntryAction", () => {
  it("creates a pending, scrubbed entry for a new subject and redirects", async () => {
    const r = await submit(form());
    expect(r.kind).toBe("redirect");
    if (r.kind === "redirect") expect(r.to).toMatch(/^\/submit\/done\?id=[0-9a-f]{16}$/);

    const db = getDb();
    const pending = listPending(db);
    expect(pending).toHaveLength(1);
    expect(pending[0].subject.name).toBe("新店铺");
    expect(pending[0].body).toContain(PII_MASK);
    expect(pending[0].body).not.toContain("abc_12345");
    expect(listEntries(db, { city: "西安" })).toHaveLength(0);
    expect(jar.get("vid")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns a Chinese error for a short body and stores nothing", async () => {
    const r = await submit(form({ body: "太差了" }));
    expect(r.kind).toBe("state");
    if (r.kind === "state") expect(r.res.error).toMatch(/正文/);
    expect(listPending(getDb())).toHaveLength(0);
  });

  it("stores evidence images privately and counts them", async () => {
    const png = new File([PNG_BYTES], "shot.png", { type: "image/png" });
    const r = await submit(form({}, [png, png]));
    expect(r.kind).toBe("redirect");
    const e = listPending(getDb())[0];
    expect(e.evidenceCount).toBe(2);
    expect(fs.existsSync(path.join(dir, "uploads", e.id, "2.png"))).toBe(true);
  });

  it("rejects a non-image evidence file before creating anything", async () => {
    const fake = new File([Buffer.from("not an image")], "x.png", { type: "image/png" });
    const r = await submit(form({}, [fake]));
    expect(r.kind).toBe("state");
    if (r.kind === "state") expect(r.res.error).toMatch(/图片/);
    expect(listPending(getDb())).toHaveLength(0);
  });

  it("refuses the fourth submission from one ip within the hour", async () => {
    for (let i = 0; i < 3; i++) expect((await submit(form({ name: `店${i}` }))).kind).toBe("redirect");
    const r = await submit(form({ name: "店3" }));
    expect(r.kind).toBe("state");
    if (r.kind === "state") expect(r.res.error).toMatch(/频繁/);
    expect(listPending(getDb())).toHaveLength(3);
  });

  it("scrubs contact info out of a new subject name before it can be shown anywhere", async () => {
    const r = await submit(form({ name: "骗子张三 vx abc_12345" }));
    expect(r.kind).toBe("redirect");
    const e = listPending(getDb())[0];
    expect(e.subject.name).toContain(PII_MASK);
    expect(e.subject.name).not.toContain("abc_12345");
  });

  it("creates no subject and burns no rate slot when the category is wrong", async () => {
    const r = await submit(form({ name: "不该出现的店", category: "开本摆烂" }));
    expect(r.kind).toBe("state");
    if (r.kind === "state") expect(r.res.error).toMatch(/分类/);
    const db = getDb();
    expect(db.prepare("SELECT COUNT(*) AS n FROM subjects").get()).toMatchObject({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM rate_events").get()).toMatchObject({ n: 0 });
  });

  it("attaches to an existing subject when subjectId is given", async () => {
    await submit(form({ name: "老店" }));
    const first = listPending(getDb())[0];
    const r = await submit(form({ subjectId: first.subjectId, name: "", city: "" }));
    expect(r.kind).toBe("redirect");
    const all = listPending(getDb());
    expect(all).toHaveLength(2);
    expect(new Set(all.map((e) => e.subjectId)).size).toBe(1);
  });
});
