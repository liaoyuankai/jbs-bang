import { beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { countOpenFeedback, createFeedback, FEEDBACK_MAX, listFeedback, markFeedbackDone } from "@/lib/repo/feedback";

let db: ReturnType<typeof openDb>;
beforeEach(() => {
  db = openDb(":memory:");
});

describe("feedback", () => {
  it("stores the message verbatim, private to the developer, newest first", () => {
    const a = createFeedback(db, { body: "搜索框在我手机上点不动。微信 abc_12345 可以联系我", vid: "v1", ipHash: "ip1" });
    const b = createFeedback(db, { body: "建议加一个按城市订阅", vid: "v2", ipHash: "ip2" });
    expect(a.body).toContain("abc_12345");
    const rows = listFeedback(db);
    expect(rows.map((r) => r.id)).toEqual([b.id, a.id]);
    expect(rows[0].status).toBe("open");
    expect(countOpenFeedback(db)).toBe(2);
  });

  it("rejects an empty message and caps length", () => {
    expect(() => createFeedback(db, { body: "   ", vid: "v1", ipHash: "ip" })).toThrow(/内容/);
    expect(() => createFeedback(db, { body: "长".repeat(FEEDBACK_MAX + 1), vid: "v1", ipHash: "ip" })).toThrow(/字/);
    expect(createFeedback(db, { body: "长".repeat(FEEDBACK_MAX), vid: "v1", ipHash: "ip" }).body).toHaveLength(FEEDBACK_MAX);
  });

  it("marks a message done and drops it from the open count but not the list", () => {
    const a = createFeedback(db, { body: "页面有个错别字", vid: "v1", ipHash: "ip" });
    expect(markFeedbackDone(db, a.id).status).toBe("done");
    expect(countOpenFeedback(db)).toBe(0);
    expect(listFeedback(db).map((r) => r.status)).toEqual(["done"]);
    expect(listFeedback(db, { status: "open" })).toEqual([]);
    expect(() => markFeedbackDone(db, "nope")).toThrow(/不存在/);
  });
});
