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
import { MAINTENANCE_MESSAGE } from "@/lib/maintenance";
import { listEntries } from "@/lib/repo/entries";
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
  it("refuses every submission during maintenance and stores nothing", async () => {
    delete process.env.MAINTENANCE;
    try {
      const r = await submit(form());
      expect(r).toEqual({ kind: "state", res: { error: MAINTENANCE_MESSAGE } });
      expect(listEntries(getDb(), { city: "西安" })).toHaveLength(0);
    } finally {
      process.env.MAINTENANCE = "0";
    }
  });

  it("publishes a scrubbed entry for a new subject at once and redirects", async () => {
    const r = await submit(form());
    expect(r.kind).toBe("redirect");
    if (r.kind === "redirect") expect(r.to).toMatch(/^\/submit\/done\?id=[0-9a-f]{16}$/);

    const db = getDb();
    const live = listEntries(db, { city: "西安" });
    expect(live).toHaveLength(1);
    expect(live[0].status).toBe("published");
    expect(live[0].subject.name).toBe("新店铺");
    expect(live[0].body).toContain(PII_MASK);
    expect(live[0].body).not.toContain("abc_12345");
    expect(jar.get("vid")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns a Chinese error for a short body and stores nothing", async () => {
    const r = await submit(form({ body: "太差了" }));
    expect(r.kind).toBe("state");
    if (r.kind === "state") expect(r.res.error).toMatch(/正文/);
    expect(listEntries(getDb())).toHaveLength(0);
  });

  it("stores evidence images privately and counts them", async () => {
    const png = new File([PNG_BYTES], "shot.png", { type: "image/png" });
    const r = await submit(form({}, [png, png]));
    expect(r.kind).toBe("redirect");
    const e = listEntries(getDb())[0];
    expect(e.evidenceCount).toBe(2);
    expect(fs.existsSync(path.join(dir, "uploads", e.id, "2.png"))).toBe(true);
  });

  it("rejects a non-image evidence file before creating anything", async () => {
    const fake = new File([Buffer.from("not an image")], "x.png", { type: "image/png" });
    const r = await submit(form({}, [fake]));
    expect(r.kind).toBe("state");
    if (r.kind === "state") expect(r.res.error).toMatch(/图片/);
    expect(listEntries(getDb())).toHaveLength(0);
  });

  it("refuses the fourth submission from one ip within the hour", async () => {
    for (let i = 0; i < 3; i++) expect((await submit(form({ name: `店${i}` }))).kind).toBe("redirect");
    const r = await submit(form({ name: "店3" }));
    expect(r.kind).toBe("state");
    if (r.kind === "state") expect(r.res.error).toMatch(/频繁/);
    expect(listEntries(getDb())).toHaveLength(3);
  });

  it("scrubs contact info out of a new subject name before it can be shown anywhere", async () => {
    const r = await submit(form({ name: "骗子张三 vx abc_12345" }));
    expect(r.kind).toBe("redirect");
    const e = listEntries(getDb())[0];
    expect(e.subject.name).toContain(PII_MASK);
    expect(e.subject.name).not.toContain("abc_12345");
  });

  it("stores nothing about the submitter even when a contact field is posted", async () => {
    const r = await submit(form({ contact: "13800138000" }));
    expect(r.kind).toBe("redirect");
    const row = getDb().prepare("SELECT * FROM entries").get() as Record<string, unknown>;
    expect(row.contact ?? null).toBeNull();
    expect(JSON.stringify(row)).not.toContain("13800138000");
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
    const first = listEntries(getDb())[0];
    const r = await submit(form({ subjectId: first.subjectId, name: "", city: "", list: "red", category: "服务好" }));
    expect(r.kind).toBe("redirect");
    const all = listEntries(getDb());
    expect(all).toHaveLength(2);
    expect(new Set(all.map((e) => e.subjectId)).size).toBe(1);
  });

  it("refuses a second post on the same subject and list, by id or by name, without burning a rate slot", async () => {
    await submit(form({ name: "老店" }));
    const first = listEntries(getDb())[0];
    for (const fd of [form({ subjectId: first.subjectId, name: "", city: "" }), form({ name: "老店" })]) {
      const r = await submit(fd);
      expect(r.kind).toBe("state");
      if (r.kind === "state") expect(r.res.error).toMatch(/30 天内已经给「老店」发过黑榜/);
    }
    const db = getDb();
    expect(listEntries(db)).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM rate_events").get()).toMatchObject({ n: 1 });
  });

  it("refuses a repeat from the same cookie even on a different ip", async () => {
    await submit(form({ name: "老店" }));
    const db = getDb();
    db.prepare("UPDATE entries SET ip_hash = 'another-network'").run();
    const r = await submit(form({ name: "老店" }));
    expect(r.kind).toBe("state");
    expect(listEntries(db)).toHaveLength(1);
  });
});
