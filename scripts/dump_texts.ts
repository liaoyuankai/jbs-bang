/**
 * Dump every entry body and comment in the database as an import-shaped JSON, so
 * scripts/filter_new.py can drop texts the site already has.
 *
 * Usage: npx tsx scripts/dump_texts.ts data/texts-in-db.json
 */
import fs from "node:fs";
import { getDb } from "../src/lib/db";

const out = process.argv[2];
if (!out) throw new Error("usage: dump_texts.ts <out.json>");
const db = getDb();
const entries = db.prepare("SELECT id, body FROM entries").all() as { id: string; body: string }[];
const comments = db.prepare("SELECT entry_id, body FROM comments").all() as { entry_id: string | null; body: string }[];
const byEntry = new Map<string, string[]>();
for (const c of comments) {
  if (!c.entry_id) continue;
  byEntry.set(c.entry_id, [...(byEntry.get(c.entry_id) ?? []), c.body]);
}
const items = entries.map((e) => ({ body: e.body, comments: byEntry.get(e.id) ?? [] }));
// responses live on subjects, not entries; include them so they count as seen too
const responses = comments.filter((c) => !c.entry_id).map((c) => ({ body: c.body, comments: [] }));
fs.writeFileSync(out, JSON.stringify([...items, ...responses]), "utf8");
console.log(JSON.stringify({ entries: entries.length, comments: comments.length, out }));
