import fs from "node:fs";
import path from "node:path";

export const MAX_FILES = 5;
export const MAX_BYTES = 5 * 1024 * 1024;

type Ext = "png" | "jpg" | "gif" | "webp";
const EXTS: Ext[] = ["png", "jpg", "gif", "webp"];

export function detectImage(buf: Buffer): Ext | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 6 && buf.subarray(0, 4).toString("ascii") === "GIF8") return "gif";
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "webp";
  return null;
}

function safeId(entryId: string): string {
  if (!/^[0-9a-f]{16}$/.test(entryId)) throw new Error("非法的条目编号");
  return entryId;
}

function realFiles(files: File[]): File[] {
  return files.filter((f) => f && typeof f.size === "number" && f.size > 0);
}

/** Cheap checks that need no disk: count and size. Magic bytes are checked in saveEvidence. */
export function validateEvidence(files: File[]): File[] {
  const real = realFiles(files);
  if (real.length > MAX_FILES) throw new Error(`最多 ${MAX_FILES} 张证据图`);
  for (const f of real) {
    if (f.size > MAX_BYTES) throw new Error("每张证据图不超过 5 MB");
  }
  return real;
}

export type EvidenceItem = { buf: Buffer; ext: Ext };

/** Read and fully validate evidence files (count, size, magic bytes) without touching disk. */
export async function readEvidence(files: File[]): Promise<EvidenceItem[]> {
  const real = validateEvidence(files);
  const items: EvidenceItem[] = [];
  for (const f of real) {
    const buf = Buffer.from(await f.arrayBuffer());
    const ext = detectImage(buf);
    if (!ext) throw new Error("证据必须是图片（png/jpg/gif/webp）");
    items.push({ buf, ext });
  }
  return items;
}

/** Write already-validated evidence to dataDir/uploads/<entryId>/<n>.<ext>; returns how many were stored. */
export function writeEvidence(dataDir: string, entryId: string, items: EvidenceItem[]): number {
  const id = safeId(entryId);
  if (items.length === 0) return 0;
  const dir = path.join(dataDir, "uploads", id);
  fs.mkdirSync(dir, { recursive: true });
  items.forEach(({ buf, ext }, i) => {
    fs.writeFileSync(path.join(dir, `${i + 1}.${ext}`), buf);
  });
  return items.length;
}

/** Validate then store. Returns how many files were stored. */
export async function saveEvidence(dataDir: string, entryId: string, files: File[]): Promise<number> {
  safeId(entryId);
  const items = await readEvidence(files);
  return writeEvidence(dataDir, entryId, items);
}

export function evidencePath(dataDir: string, entryId: string, n: number): string | null {
  if (!/^[0-9a-f]{16}$/.test(entryId) || !Number.isInteger(n) || n < 1 || n > MAX_FILES) return null;
  const dir = path.join(dataDir, "uploads", entryId);
  for (const ext of EXTS) {
    const p = path.join(dir, `${n}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function listEvidence(dataDir: string, entryId: string): string[] {
  const out: string[] = [];
  for (let n = 1; n <= MAX_FILES; n++) {
    const p = evidencePath(dataDir, entryId, n);
    if (!p) break;
    out.push(p);
  }
  return out;
}

export function contentTypeFor(file: string): string {
  const ext = path.extname(file).slice(1);
  return { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[ext] ?? "application/octet-stream";
}
