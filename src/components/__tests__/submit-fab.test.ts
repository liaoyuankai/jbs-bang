import { describe, expect, it } from "vitest";
import { showSubmitFab } from "@/components/SubmitFab";

describe("showSubmitFab", () => {
  it("shows the floating 投稿 button on browsing pages", () => {
    for (const p of ["/", "/search", "/s/abc123", "/e/abc123", "/rules", "/transparency"]) {
      expect(showSubmitFab(p), p).toBe(true);
    }
  });

  it("hides it where it would be redundant or in the way", () => {
    for (const p of ["/submit", "/submit/done", "/admin", "/admin/login", "/admin/entries"]) {
      expect(showSubmitFab(p), p).toBe(false);
    }
  });
});
