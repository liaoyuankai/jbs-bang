import { afterEach, describe, expect, it } from "vitest";
import { isMaintenance, maintenanceAllows } from "@/lib/maintenance";

describe("maintenanceAllows", () => {
  it("keeps 联系站长, the admin and the maintenance page open", () => {
    for (const p of ["/maintenance", "/feedback", "/admin", "/admin/login", "/admin/evidence/abc/1"]) {
      expect(maintenanceAllows(p), p).toBe(true);
    }
  });
  it("closes everything else", () => {
    for (const p of ["/", "/rank", "/search", "/submit", "/submit/done", "/e/abc", "/s/abc", "/rules", "/transparency", "/api/subjects", "/administrator", "/feedbackx"]) {
      expect(maintenanceAllows(p), p).toBe(false);
    }
  });
});

describe("isMaintenance", () => {
  const saved = process.env.MAINTENANCE;
  afterEach(() => {
    process.env.MAINTENANCE = saved;
  });
  it("is on unless MAINTENANCE=0", () => {
    delete process.env.MAINTENANCE;
    expect(isMaintenance()).toBe(true);
    process.env.MAINTENANCE = "0";
    expect(isMaintenance()).toBe(false);
  });
});
