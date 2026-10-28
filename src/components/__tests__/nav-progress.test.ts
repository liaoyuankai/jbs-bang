import { describe, expect, it } from "vitest";
import { isPageNavigation } from "@/components/NavProgress";

const here = "https://aid.lovie.me/?list=red";

describe("isPageNavigation", () => {
  it("is true for a same-origin link to a different page", () => {
    expect(isPageNavigation("https://aid.lovie.me/e/abc", here)).toBe(true);
    expect(isPageNavigation("https://aid.lovie.me/?list=black", here)).toBe(true);
    expect(isPageNavigation("https://aid.lovie.me/rank", here)).toBe(true);
  });

  it("is false for the same page, hash jumps, other sites and non-http links", () => {
    expect(isPageNavigation("https://aid.lovie.me/?list=red", here)).toBe(false);
    expect(isPageNavigation("https://aid.lovie.me/?list=red#respond", here)).toBe(false);
    expect(isPageNavigation("https://example.com/x", here)).toBe(false);
    expect(isPageNavigation("mailto:a@b.c", here)).toBe(false);
    expect(isPageNavigation("javascript:void(0)", here)).toBe(false);
  });
});
