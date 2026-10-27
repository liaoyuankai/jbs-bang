import { describe, expect, it } from "vitest";
import { signAdmin, verifyAdmin } from "@/lib/admin-auth";
import { ipHash, shortVid } from "@/lib/visitor";

describe("admin session token", () => {
  const secret = "test-secret";

  it("verifies a token it signed", () => {
    const token = signAdmin(secret, Date.now() + 60_000);
    expect(verifyAdmin(secret, token)).toBe(true);
  });

  it("rejects an expired token", () => {
    const token = signAdmin(secret, Date.now() - 1);
    expect(verifyAdmin(secret, token)).toBe(false);
  });

  it("rejects a tampered token", () => {
    const token = signAdmin(secret, Date.now() + 60_000);
    const [exp, sig] = token.split(".");
    expect(verifyAdmin(secret, `${Number(exp) + 999999}.${sig}`)).toBe(false);
    expect(verifyAdmin(secret, `${exp}.${"0".repeat(sig.length)}`)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const token = signAdmin("other", Date.now() + 60_000);
    expect(verifyAdmin(secret, token)).toBe(false);
  });

  it("rejects garbage", () => {
    expect(verifyAdmin(secret, "")).toBe(false);
    expect(verifyAdmin(secret, "abc")).toBe(false);
    expect(verifyAdmin(secret, undefined)).toBe(false);
  });
});

describe("visitor helpers", () => {
  it("renders a short public handle from a vid", () => {
    expect(shortVid("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6")).toBe("瓜友#A1B2");
  });

  it("hashes ips to 16 hex chars and never exposes the ip", () => {
    const h = ipHash("203.0.113.9");
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(h).not.toContain("203");
    expect(ipHash("203.0.113.9")).toBe(h);
    expect(ipHash("203.0.113.10")).not.toBe(h);
  });
});
