import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evidencePath, listEvidence, MAX_BYTES, MAX_FILES, saveEvidence, validateEvidence } from "@/lib/uploads";

// 1x1 transparent PNG
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const ENTRY = "0123456789abcdef";

function png(name = "shot.png") {
  return new File([PNG_BYTES], name, { type: "image/png" });
}

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jbs-uploads-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("saveEvidence", () => {
  it("rejects a file that is not an image even if named .png", async () => {
    const fake = new File([Buffer.from("hello, not an image")], "fake.png", { type: "image/png" });
    await expect(saveEvidence(dir, ENTRY, [fake])).rejects.toThrow(/证据必须是图片/);
    expect(fs.existsSync(path.join(dir, "uploads", ENTRY))).toBe(false);
  });

  it("stores a real png under the entry folder and finds it again", async () => {
    const n = await saveEvidence(dir, ENTRY, [png()]);
    expect(n).toBe(1);
    const p = evidencePath(dir, ENTRY, 1);
    expect(p).toBe(path.join(dir, "uploads", ENTRY, "1.png"));
    expect(fs.existsSync(p!)).toBe(true);
    expect(evidencePath(dir, ENTRY, 2)).toBeNull();
    expect(listEvidence(dir, ENTRY)).toEqual([p]);
  });

  it("refuses more than five files", async () => {
    expect(MAX_FILES).toBe(5);
    const six = Array.from({ length: 6 }, (_, i) => png(`s${i}.png`));
    await expect(saveEvidence(dir, ENTRY, six)).rejects.toThrow(/最多 5 张/);
  });

  it("refuses a file over the size limit", () => {
    const big = new File([Buffer.alloc(MAX_BYTES + 1, 0)], "big.png", { type: "image/png" });
    expect(() => validateEvidence([big])).toThrow(/5 MB/);
  });

  it("ignores empty file inputs", async () => {
    const empty = new File([], "", { type: "application/octet-stream" });
    expect(await saveEvidence(dir, ENTRY, [empty])).toBe(0);
  });

  it("refuses an entry id that could escape the uploads folder", async () => {
    await expect(saveEvidence(dir, "../etc", [png()])).rejects.toThrow();
    expect(evidencePath(dir, "../etc", 1)).toBeNull();
  });
});
