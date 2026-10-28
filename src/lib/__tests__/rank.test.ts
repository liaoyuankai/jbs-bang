import { beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { createComment } from "@/lib/repo/comments";
import { endorse } from "@/lib/repo/endorsements";
import { createEntry, setEntryStatus } from "@/lib/repo/entries";
import { heatScore, rankSubjects, rankSubjectsNet } from "@/lib/repo/rank";
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

describe("rankSubjectsNet", () => {
  it("scores each subject 红 − 黑 by entry count, one row per subject", () => {
    const good = findOrCreateSubject(db, { type: "dm", name: "好DM", city: "西安" });
    const bad = findOrCreateSubject(db, { type: "dm", name: "坏DM", city: "西安" });
    const even = findOrCreateSubject(db, { type: "dm", name: "平DM", city: "西安" });
    const onlyBlack = findOrCreateSubject(db, { type: "dm", name: "黑DM", city: "西安" });
    entry(good.id, "red", "开本认真", "v1");
    entry(good.id, "red", "演绎好", "v2");
    entry(good.id, "red", "带新人", "v3");
    entry(good.id, "black", "剧透", "v4");
    entry(bad.id, "red", "性格好", "v5");
    entry(bad.id, "black", "剧透", "v6");
    entry(bad.id, "black", "开本摆烂", "v7");
    entry(bad.id, "black", "迟到放鸽", "v8");
    entry(even.id, "red", "性格好", "v9");
    entry(even.id, "black", "剧透", "v10");
    entry(onlyBlack.id, "black", "剧透", "v11");
    // endorsements do not move the net score
    const b = entry(onlyBlack.id, "black", "开本摆烂", "v12");
    endorse(db, b.id, "x1");

    const rows = rankSubjectsNet(db, { city: "西安", type: "dm" });
    expect(rows.map((r) => r.subject.name)).toEqual(["好DM", "平DM", "坏DM", "黑DM"]);
    expect(rows[0]).toMatchObject({ red: 3, black: 1, net: 2 });
    expect(rows[1]).toMatchObject({ red: 1, black: 1, net: 0 });
    expect(rows[2]).toMatchObject({ red: 1, black: 3, net: -2 });
    expect(rows[3]).toMatchObject({ red: 0, black: 2, net: -2 });
  });

  it("filters by type and city, ignores removed entries, and breaks ties by entry count", () => {
    const busy = findOrCreateSubject(db, { type: "shop", name: "乙店", city: "西安" });
    const quiet = findOrCreateSubject(db, { type: "shop", name: "甲店", city: "西安" });
    const dm = findOrCreateSubject(db, { type: "dm", name: "DM甲", city: "西安" });
    const far = findOrCreateSubject(db, { type: "shop", name: "外地店", city: "咸阳" });
    entry(busy.id, "red", "服务好", "v1");
    entry(busy.id, "red", "环境好", "v2");
    entry(busy.id, "black", "乱收费", "v3");
    entry(quiet.id, "red", "服务好", "v4");
    const gone = entry(quiet.id, "black", "乱收费", "v5");
    setEntryStatus(db, gone.id, "removed", { reason: "测试" });
    entry(dm.id, "red", "开本认真", "v6");
    entry(far.id, "red", "服务好", "v7");

    const rows = rankSubjectsNet(db, { city: "西安", type: "shop" });
    expect(rows.map((r) => r.subject.name)).toEqual(["乙店", "甲店"]);
    expect(rows[1]).toMatchObject({ red: 1, black: 0, net: 1 });
    expect(rankSubjectsNet(db, { city: "咸阳", type: "shop" }).map((r) => r.subject.id)).toEqual([far.id]);
    expect(rankSubjectsNet(db, { city: "西安", type: "dm" }).map((r) => r.subject.id)).toEqual([dm.id]);
  });

  it("counts one ip once per list however many times it posts, but every imported entry separately", () => {
    const dm = findOrCreateSubject(db, { type: "dm", name: "被刷DM", city: "西安" });
    for (let i = 0; i < 5; i++) {
      createEntry(db, { subjectId: dm.id, list: "black", category: "剧透", body: `${BODY}刷${i}`, vid: `v${i}`, ipHash: "same-ip" });
    }
    createEntry(db, { subjectId: dm.id, list: "black", category: "剧透", body: `${BODY}另一人`, vid: "w", ipHash: "other-ip" });
    // the same ip may still be one voice on the other list
    createEntry(db, { subjectId: dm.id, list: "red", category: "性格好", body: `${BODY}红`, vid: "v0", ipHash: "same-ip" });
    for (let i = 0; i < 3; i++) {
      createEntry(db, { subjectId: dm.id, list: "red", category: "开本认真", body: `${BODY}导入${i}`, vid: "import-sheet", ipHash: "import", source: "import" });
    }
    expect(rankSubjectsNet(db, { city: "西安", type: "dm" })[0]).toMatchObject({ red: 4, black: 2, net: 2 });
  });
});
