import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "@/lib/db";
import {
  findOrCreateSubject,
  getSubject,
  listCities,
  searchSubjects,
  subjectIsPublic,
  updateSubject,
} from "@/lib/repo/subjects";
import {
  countEntriesByType,
  createEntry,
  getEntry,
  listEntries,
  setEntryStatus,
  setEvidenceCount,
  setVerified,
  updateEntryBody,
} from "@/lib/repo/entries";
import { createComment, listComments, setCommentStatus } from "@/lib/repo/comments";
import { endorse, endorseCount } from "@/lib/repo/endorsements";
import { confidenceLabel } from "@/lib/labels";
import { PII_MASK } from "@/lib/scrub";

let db: DatabaseSync;
const BODY = "客服当着一个顾客的面说另一个顾客的坏话，第二天又发声明说是假的。";

function shop() {
  return findOrCreateSubject(db, { type: "shop", name: "甲店", city: "西安" });
}

function black(subjectId: string, vid: string, extra: Partial<Parameters<typeof createEntry>[1]> = {}) {
  return createEntry(db, {
    subjectId,
    list: "black",
    category: "客服态度",
    body: BODY,
    vid,
    ipHash: "ip1",
    ...extra,
  });
}

beforeEach(() => {
  db = openDb(":memory:");
});

describe("subjects", () => {
  it("returns the same subject for the same identity ignoring case and spaces", () => {
    const a = findOrCreateSubject(db, { type: "dm", name: "Doy", city: "西安", shopName: "乙丙店" });
    const b = findOrCreateSubject(db, { type: "dm", name: " doy ", city: "西安", shopName: "乙丙店 " });
    expect(b.id).toBe(a.id);
  });

  it("treats a different shop as a different DM", () => {
    const a = findOrCreateSubject(db, { type: "dm", name: "阿甲", city: "西安", shopName: "乙丙店" });
    const b = findOrCreateSubject(db, { type: "dm", name: "阿甲", city: "西安", shopName: "庚店" });
    expect(b.id).not.toBe(a.id);
  });

  it("searches by name and alias", () => {
    const s = shop();
    updateSubject(db, s.id, { aliases: ["示例剧本杀"] });
    expect(searchSubjects(db, "甲店").map((x) => x.id)).toContain(s.id);
    expect(searchSubjects(db, "剧本杀").map((x) => x.id)).toContain(s.id);
    expect(searchSubjects(db, "不存在")).toHaveLength(0);
    findOrCreateSubject(db, { type: "dm", name: "甲店阿壬", city: "西安", shopName: "甲店" });
    expect(searchSubjects(db, "甲店", { type: "dm" }).map((x) => x.name)).toEqual(["甲店阿壬"]);
    expect(searchSubjects(db, "甲店", { type: "player" })).toHaveLength(0);
    expect(getSubject(db, s.id)?.aliases).toEqual(["示例剧本杀"]);
  });

  it("lists distinct cities", () => {
    shop();
    findOrCreateSubject(db, { type: "shop", name: "某店", city: "咸阳" });
    expect(listCities(db).sort()).toEqual(["咸阳", "西安"]);
  });

  it("scrubs contact info and caps length in subject fields", () => {
    const s = findOrCreateSubject(db, {
      type: "dm",
      name: "骗子张三 vx abc_12345 电话13812345678",
      city: "西安".repeat(30),
      shopName: "某店 微信：hstl05302",
    });
    expect(s.name).toContain(PII_MASK);
    expect(s.name).not.toContain("abc_12345");
    expect(s.name).not.toContain("13812345678");
    expect([...s.name].length).toBeLessThanOrEqual(40);
    expect([...s.city].length).toBeLessThanOrEqual(20);
    expect(s.shopName).toContain(PII_MASK);
    const edited = updateSubject(db, s.id, { aliases: ["小号 qq 123456789"] });
    expect(edited.aliases[0]).toContain(PII_MASK);
  });

  it("shows a subject publicly only while it has live content", () => {
    const s = shop();
    expect(searchSubjects(db, "甲店", { publicOnly: true })).toHaveLength(0);
    expect(subjectIsPublic(db, s.id)).toBe(false);
    const e = black(s.id, "v1");
    expect(searchSubjects(db, "甲店", { publicOnly: true }).map((x) => x.id)).toEqual([s.id]);
    expect(subjectIsPublic(db, s.id)).toBe(true);
    setEntryStatus(db, e.id, "removed", { reason: "泄露联系方式" });
    expect(searchSubjects(db, "甲店", { publicOnly: true })).toHaveLength(0);
    expect(subjectIsPublic(db, s.id)).toBe(false);
  });

  it("treats a live response as public content too", () => {
    const s = shop();
    const r = createComment(db, { subjectId: s.id, kind: "response", body: "我们是店家，回应如下。", vid: "v9", ipHash: "ip" });
    expect(subjectIsPublic(db, s.id)).toBe(true);
    setCommentStatus(db, r.id, "removed", { reason: "辱骂" });
    expect(subjectIsPublic(db, s.id)).toBe(false);
  });

  it("lists only cities that have published content when asked", () => {
    const s = shop();
    findOrCreateSubject(db, { type: "shop", name: "某店", city: "咸阳" });
    expect(listCities(db, { publicOnly: true })).toEqual([]);
    black(s.id, "v1");
    expect(listCities(db, { publicOnly: true })).toEqual(["西安"]);
  });
});

describe("entries", () => {
  it("rejects a body shorter than 10 characters", () => {
    const s = shop();
    expect(() => black(s.id, "v1", { body: "太差了太差了" })).toThrow(/正文/);
  });

  it("rejects a body longer than 2000 characters", () => {
    const s = shop();
    expect(() => black(s.id, "v1", { body: "差".repeat(2001) })).toThrow(/正文/);
  });

  it("rejects a category that does not belong to the subject type and list", () => {
    const s = shop();
    expect(() => black(s.id, "v1", { category: "开本摆烂" })).toThrow(/分类/);
  });

  it("scrubs contact info and is published at once", () => {
    const s = shop();
    const e = black(s.id, "v1", { body: `${BODY} 加微信：abc_12345 细聊` });
    expect(e.status).toBe("published");
    expect(e.body).toContain(PII_MASK);
    expect(e.body).not.toContain("abc_12345");
    expect(e.bodyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(getEntry(db, e.id)?.id).toBe(e.id);
  });

  it("lists a new entry publicly at once, filtered by city and list", () => {
    const s = shop();
    const e = black(s.id, "v1");
    const listed = listEntries(db, { city: "西安", list: "black" });
    expect(listed.map((x) => x.id)).toEqual([e.id]);
    expect(listed[0].subject.name).toBe("甲店");
    expect(listEntries(db, { city: "西安", list: "red" })).toHaveLength(0);
    expect(listEntries(db, { city: "咸阳" })).toHaveLength(0);
  });

  it("filters the public list by subject type and counts live entries per type", () => {
    const s = shop();
    const d = findOrCreateSubject(db, { type: "dm", name: "阿壬", city: "西安", shopName: "甲店" });
    black(s.id, "v1");
    createEntry(db, { subjectId: d.id, list: "black", category: "开本摆烂", body: BODY, vid: "v2", ipHash: "ip2" });
    const other = createEntry(db, { subjectId: d.id, list: "black", category: "剧透", body: `${BODY}另一件事。`, vid: "v3", ipHash: "ip3" });
    setEntryStatus(db, other.id, "removed", { reason: "测试" });
    expect(listEntries(db, { city: "西安", list: "black", type: "dm" }).map((x) => x.subject.id)).toEqual([d.id]);
    expect(listEntries(db, { city: "西安", list: "black", type: "player" })).toHaveLength(0);
    expect(listEntries(db, { city: "西安", list: "black" })).toHaveLength(2);
    expect(countEntriesByType(db, { city: "西安", list: "black" })).toEqual({ shop: 1, dm: 1, player: 0 });
    expect(countEntriesByType(db, { city: "西安", list: "red" })).toEqual({ shop: 0, dm: 0, player: 0 });
  });

  it("lets imported history keep a body shorter than the web minimum, and edits it the same way", () => {
    const s = shop();
    expect(() => black(s.id, "v1", { body: "小乙" })).toThrow(/正文/);
    const e = black(s.id, "v1", { body: "小乙", source: "import" });
    expect(e.body).toBe("小乙");
    expect(() => updateEntryBody(db, e.id, "小丙")).toThrow(/正文/);
    expect(updateEntryBody(db, e.id, "小丙", { allowShort: true }).body).toBe("小丙");
    expect(() => black(s.id, "v2", { body: "", source: "import" })).toThrow(/正文/);
  });

  it("keeps a removed entry on record with reason and time", () => {
    const s = shop();
    const e = black(s.id, "v1");
    setEntryStatus(db, e.id, "removed", { reason: "当事人申诉成立" });
    const after = getEntry(db, e.id)!;
    expect(after.status).toBe("removed");
    expect(after.removedReason).toBe("当事人申诉成立");
    expect(after.removedAt).toBeTruthy();
    expect(listEntries(db, { city: "西安" })).toHaveLength(0);
  });

  it("refuses to verify an entry that does not exist", () => {
    expect(() => setVerified(db, "0000000000000000", true)).toThrow(/条目不存在/);
  });

  it("edits a body with scrubbing and records evidence count and verification", () => {
    const s = shop();
    const e = black(s.id, "v1");
    updateEntryBody(db, e.id, "改过的正文，电话13812345678也会被隐去。");
    setEvidenceCount(db, e.id, 2);
    setVerified(db, e.id, true);
    const after = getEntry(db, e.id)!;
    expect(after.body).toContain(PII_MASK);
    expect(after.evidenceCount).toBe(2);
    expect(after.verified).toBe(true);
  });
});

describe("comments", () => {
  it("publishes comments and responses at once and removes them only with a reason", () => {
    const s = shop();
    const e = black(s.id, "v1");
    const c = createComment(db, { entryId: e.id, subjectId: s.id, kind: "comment", body: "我也遇到过一样的事", vid: "v2", ipHash: "ip2" });
    const r = createComment(db, { subjectId: s.id, kind: "response", body: "我们是店家，这件事的经过是这样的……", vid: "v3", ipHash: "ip3" });
    expect(c.status).toBe("published");
    expect(listComments(db, { entryId: e.id }).map((x) => x.id)).toEqual([c.id]);
    expect(listComments(db, { subjectId: s.id, kind: "response" }).map((x) => x.id)).toEqual([r.id]);
    expect(() => setCommentStatus(db, c.id, "removed", {})).toThrow(/原因/);
    setCommentStatus(db, c.id, "removed", { reason: "辱骂" });
    expect(listComments(db, { entryId: e.id })).toHaveLength(0);
  });

  it("rejects a comment shorter than 2 characters", () => {
    const s = shop();
    expect(() =>
      createComment(db, { subjectId: s.id, kind: "comment", body: "顶", vid: "v2", ipHash: "ip2" }),
    ).toThrow(/评论/);
  });
});

describe("endorsements", () => {
  it("counts each visitor once", () => {
    const s = shop();
    const e = black(s.id, "v1");
    expect(endorse(db, e.id, "v2")).toBe(1);
    expect(endorse(db, e.id, "v2")).toBe(1);
    expect(endorse(db, e.id, "v3")).toBe(2);
    expect(endorseCount(db, e.id)).toBe(2);
  });
});

describe("confidenceLabel", () => {
  it("is 单方陈述 with fewer than three independent reports", () => {
    const s = shop();
    const e1 = black(s.id, "v1");
    const e2 = black(s.id, "v2");
    setEntryStatus(db, e1.id, "published");
    setEntryStatus(db, e2.id, "published");
    expect(confidenceLabel(db, getEntry(db, e1.id)!)).toBe("单方陈述");
  });

  it("is 多方印证 with three independent published reports in the same category", () => {
    const s = shop();
    const ids = ["v1", "v2", "v3"].map((v) => black(s.id, v).id);
    ids.forEach((id) => setEntryStatus(db, id, "published"));
    expect(confidenceLabel(db, getEntry(db, ids[0])!)).toBe("多方印证");
  });

  it("prefers 已撤下, then 平台核验, then 历史存档", () => {
    const s = shop();
    const removed = black(s.id, "v1");
    setEntryStatus(db, removed.id, "removed", { reason: "x" });
    expect(confidenceLabel(db, getEntry(db, removed.id)!)).toBe("已撤下");

    const verified = black(s.id, "v2");
    setVerified(db, verified.id, true);
    expect(confidenceLabel(db, getEntry(db, verified.id)!)).toBe("平台核验");

    const imported = black(s.id, "v3", { source: "import", status: "published" });
    expect(confidenceLabel(db, getEntry(db, imported.id)!)).toBe("历史存档·单方陈述");
  });
});
