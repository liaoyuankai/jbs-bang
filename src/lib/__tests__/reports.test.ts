import { beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { eventCount } from "@/lib/events";
import { createComment, setCommentStatus } from "@/lib/repo/comments";
import { createEntry, setEntryStatus } from "@/lib/repo/entries";
import {
  countReports,
  createReport,
  handleReports,
  listOpenReports,
  REPORT_REASONS,
} from "@/lib/repo/reports";
import { findOrCreateSubject } from "@/lib/repo/subjects";
import { PII_MASK } from "@/lib/scrub";

let db: ReturnType<typeof openDb>;
beforeEach(() => {
  db = openDb(":memory:");
});

function seed() {
  const s = findOrCreateSubject(db, { type: "shop", name: "甲店", city: "西安" });
  const e = createEntry(db, {
    subjectId: s.id,
    list: "black",
    category: "客服态度",
    body: "客服当着一个顾客的面说另一个顾客的坏话，第二天又否认。",
    vid: "a".repeat(32),
    ipHash: "ip-a",
  });
  const c = createComment(db, { entryId: e.id, subjectId: s.id, kind: "comment", body: "我也遇到过", vid: "b".repeat(32), ipHash: "ip-b" });
  return { s, e, c };
}

describe("createReport", () => {
  it("records one report per visitor per target and logs an event", () => {
    const { e } = seed();
    const before = eventCount(db);
    expect(createReport(db, { targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[0], vid: "v1", ipHash: "ip" })).toBe(true);
    expect(createReport(db, { targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[1], vid: "v1", ipHash: "ip" })).toBe(false);
    expect(createReport(db, { targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[1], vid: "v2", ipHash: "ip" })).toBe(true);
    expect(eventCount(db)).toBe(before + 2);
    expect(countReports(db)).toEqual({ open: 2, handled: 0 });
  });

  it("refuses an unknown reason and a target that is not published", () => {
    const { e, c } = seed();
    expect(() => createReport(db, { targetKind: "entry", targetId: e.id, reason: "随便", vid: "v1", ipHash: "ip" })).toThrow(/理由/);
    setCommentStatus(db, c.id, "removed", { reason: "辱骂" });
    expect(() => createReport(db, { targetKind: "comment", targetId: c.id, reason: REPORT_REASONS[0], vid: "v1", ipHash: "ip" })).toThrow(/不存在/);
    expect(() => createReport(db, { targetKind: "entry", targetId: "nope", reason: REPORT_REASONS[0], vid: "v1", ipHash: "ip" })).toThrow(/不存在/);
  });

  it("scrubs contact info out of the free-text detail and caps it", () => {
    const { e } = seed();
    createReport(db, { targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[4], detail: "这人微信 abc_12345 " + "长".repeat(300), vid: "v1", ipHash: "ip" });
    const [g] = listOpenReports(db);
    expect(g.details[0]).toContain(PII_MASK);
    expect(g.details[0]).not.toContain("abc_12345");
    expect([...g.details[0]].length).toBeLessThanOrEqual(200);
  });
});

describe("listOpenReports / handleReports", () => {
  it("groups open reports by target with counts per reason, newest activity first", () => {
    const { e, c } = seed();
    createReport(db, { targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[0], vid: "v1", ipHash: "ip" });
    createReport(db, { targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[0], vid: "v2", ipHash: "ip" });
    createReport(db, { targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[2], vid: "v3", ipHash: "ip" });
    createReport(db, { targetKind: "comment", targetId: c.id, reason: REPORT_REASONS[1], vid: "v1", ipHash: "ip" });
    const groups = listOpenReports(db);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ targetKind: "comment", targetId: c.id, count: 1 });
    expect(groups[1]).toMatchObject({ targetKind: "entry", targetId: e.id, count: 3 });
    expect(groups[1].reasons).toEqual([
      { reason: REPORT_REASONS[0], n: 2 },
      { reason: REPORT_REASONS[2], n: 1 },
    ]);
    expect(groups[1].target.kind).toBe("entry");
    if (groups[1].target.kind === "entry") expect(groups[1].target.entry.subject.name).toBe("甲店");
    if (groups[0].target.kind === "comment") expect(groups[0].target.comment.body).toBe("我也遇到过");
  });

  it("marks every open report on a target handled and drops it from the queue", () => {
    const { e } = seed();
    createReport(db, { targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[0], vid: "v1", ipHash: "ip" });
    createReport(db, { targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[0], vid: "v2", ipHash: "ip" });
    expect(handleReports(db, "entry", e.id)).toBe(2);
    expect(listOpenReports(db)).toEqual([]);
    expect(countReports(db)).toEqual({ open: 0, handled: 2 });
    expect(handleReports(db, "entry", e.id)).toBe(0);
  });

  it("keeps a report on a removed target out of the queue instead of crashing", () => {
    const { e } = seed();
    createReport(db, { targetKind: "entry", targetId: e.id, reason: REPORT_REASONS[0], vid: "v1", ipHash: "ip" });
    setEntryStatus(db, e.id, "removed", { reason: "当事人申诉成立" });
    expect(listOpenReports(db)).toEqual([]);
  });
});
