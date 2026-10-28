import { beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { createComment } from "@/lib/repo/comments";
import { endorse } from "@/lib/repo/endorsements";
import { createEntry, setEntryStatus } from "@/lib/repo/entries";
import { heatScore, rankSubjects } from "@/lib/repo/rank";
import { findOrCreateSubject } from "@/lib/repo/subjects";

let db: ReturnType<typeof openDb>;
beforeEach(() => {
  db = openDb(":memory:");
});

const BODY = "客服当着一个顾客的面说另一个顾客的坏话，第二天又发声明说是假的。";

function entry(subjectId: string, list: "red" | "black", category: string, vid: string) {
  return createEntry(db, { subjectId, list, category, body: `${BODY}${vid}`, vid, ipHash: vid });
}

describe("heatScore", () => {
  it("weights entries over endorsements over comments", () => {
    expect(heatScore({ entries: 1, endorsements: 0, comments: 0 })).toBe(3);
    expect(heatScore({ entries: 0, endorsements: 1, comments: 0 })).toBe(2);
    expect(heatScore({ entries: 0, endorsements: 0, comments: 1 })).toBe(1);
    expect(heatScore({ entries: 2, endorsements: 3, comments: 4 })).toBe(16);
  });
});

describe("rankSubjects", () => {
  it("ranks subjects of one list by heat and reports the parts", () => {
    const quiet = findOrCreateSubject(db, { type: "shop", name: "安静店", city: "西安" });
    const loud = findOrCreateSubject(db, { type: "shop", name: "热闹店", city: "西安" });
    const dm = findOrCreateSubject(db, { type: "dm", name: "阿壬", city: "西安", shopName: "热闹店" });
    entry(quiet.id, "black", "客服态度", "v1");
    const e1 = entry(loud.id, "black", "客服态度", "v2");
    entry(loud.id, "black", "乱收费", "v3");
    endorse(db, e1.id, "x1");
    endorse(db, e1.id, "x2");
    createComment(db, { entryId: e1.id, subjectId: loud.id, kind: "comment", body: "我也遇到过", vid: "c1", ipHash: "c1" });
    entry(dm.id, "black", "开本摆烂", "v4");
    entry(dm.id, "black", "剧透", "v5");
    entry(dm.id, "black", "迟到放鸽", "v6");
    // red entries do not count toward the black ranking
    entry(quiet.id, "red", "服务好", "v7");
    entry(quiet.id, "red", "环境好", "v8");

    const black = rankSubjects(db, { city: "西安", list: "black" });
    expect(black.map((r) => r.subject.name)).toEqual(["热闹店", "阿壬", "安静店"]);
    expect(black[0]).toMatchObject({ entries: 2, endorsements: 2, comments: 1, score: 11 });
    expect(black[1]).toMatchObject({ entries: 3, endorsements: 0, comments: 0, score: 9 });
    expect(black[2]).toMatchObject({ entries: 1, endorsements: 0, comments: 0, score: 3 });

    const red = rankSubjects(db, { city: "西安", list: "red" });
    expect(red.map((r) => r.subject.name)).toEqual(["安静店"]);
    expect(red[0].score).toBe(6);
  });

  it("filters by type and city and ignores removed entries", () => {
    const shop = findOrCreateSubject(db, { type: "shop", name: "店", city: "西安" });
    const dm = findOrCreateSubject(db, { type: "dm", name: "DM甲", city: "西安" });
    const far = findOrCreateSubject(db, { type: "shop", name: "外地店", city: "咸阳" });
    entry(shop.id, "black", "客服态度", "v1");
    const gone = entry(shop.id, "black", "乱收费", "v2");
    setEntryStatus(db, gone.id, "removed", { reason: "测试" });
    entry(dm.id, "black", "剧透", "v3");
    entry(far.id, "black", "客服态度", "v4");

    expect(rankSubjects(db, { city: "西安", list: "black", type: "dm" }).map((r) => r.subject.id)).toEqual([dm.id]);
    expect(rankSubjects(db, { city: "西安", list: "black" }).map((r) => r.subject.id).sort()).toEqual([dm.id, shop.id].sort());
    expect(rankSubjects(db, { city: "西安", list: "black" }).find((r) => r.subject.id === shop.id)?.entries).toBe(1);
    expect(rankSubjects(db, { city: "咸阳", list: "black" }).map((r) => r.subject.id)).toEqual([far.id]);
    expect(rankSubjects(db, { city: "西安", list: "black", limit: 1 })).toHaveLength(1);
  });
});
