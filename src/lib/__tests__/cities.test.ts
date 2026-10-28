import { describe, expect, it } from "vitest";
import { cityOptions, MAJOR_CITIES } from "@/lib/cities";
import { config } from "@/lib/config";
import { openDb } from "@/lib/db";
import { createEntry } from "@/lib/repo/entries";
import { findOrCreateSubject } from "@/lib/repo/subjects";

describe("cityOptions", () => {
  it("lists the default city first, every major city once, and other posted cities after them", () => {
    const db = openDb(":memory:");
    const far = findOrCreateSubject(db, { type: "shop", name: "外地店", city: "咸阳" });
    createEntry(db, { subjectId: far.id, list: "red", category: "服务好", body: "店里环境很好，DM 很认真，下次还会再来这家店。", vid: "v", ipHash: "ip" });
    findOrCreateSubject(db, { type: "shop", name: "没投稿的店", city: "宝鸡" });

    const cities = cityOptions(db);
    expect(cities[0]).toBe(config.defaultCity);
    expect(new Set(cities).size).toBe(cities.length);
    for (const c of MAJOR_CITIES) expect(cities).toContain(c);
    expect(cities.at(-1)).toBe("咸阳");
    expect(cities).not.toContain("宝鸡");
  });
});
