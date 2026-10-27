import { describe, expect, it } from "vitest";
import { isLowValue, scrubPII } from "@/lib/scrub";

const MASK = "[已隐去联系方式]";

describe("scrubPII", () => {
  const cases: [string, string][] = [
    ["plain mobile", "联系 13812345678 投诉"],
    ["mobile with spaces", "电话 138 1234 5678 可以打"],
    ["mobile with dashes", "电话 138-1234-5678 可以打"],
    ["wechat label", "加我微信：abc_123 聊"],
    ["vx label", "vx: Im13800138000 找客服"],
    ["spaced vx label", "v x：abc_123 找我"],
    ["qq chinese label", "扣扣 123456789 联系"],
    ["qq label", "QQ123456789 联系"],
    ["id card", "身份证 110101199001011234 的那位"],
    ["unlabeled alphanumeric handle", "hstl05302，客服号在这，快去玩！"],
    ["handle after 号", "客服号 Im13800138000 快去"],
  ];

  for (const [name, input] of cases) {
    it(`masks ${name}`, () => {
      const out = scrubPII(input);
      expect(out).toContain(MASK);
      expect(out).not.toMatch(/\d{7,}/);
      expect(out).not.toContain("abc_123");
      expect(out).not.toContain("Im13800138000");
      expect(out).not.toContain("hstl05302");
    });
  }

  it("keeps short alphanumeric tokens that are not handles", () => {
    const text = "F4夯爆了，COC7人本，拼了3车，DM开本2小时";
    expect(scrubPII(text)).toBe(text);
  });

  it("leaves ordinary complaint text untouched", () => {
    const text = "客服态度很差，换了两次DM，优惠券也不认，2024年3月的事";
    expect(scrubPII(text)).toBe(text);
  });

  it("keeps short numbers like prices and dates", () => {
    const text = "原价168，补了20块，3月15号";
    expect(scrubPII(text)).toBe(text);
  });
});

describe("isLowValue", () => {
  it("treats +1 style cells as low value", () => {
    for (const s of ["点了！！", "同意", "+1", "是的是的，支持。", "赞同！", "确实"]) {
      expect(isLowValue(s)).toBe(true);
    }
  });

  it("treats real sentences as content", () => {
    for (const s of ["开本很认真", "客服最靠谱 没有之一！！", "点了！要和小辛打一辈子本"]) {
      expect(isLowValue(s)).toBe(false);
    }
  });
});
