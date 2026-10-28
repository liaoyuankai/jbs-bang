/**
 * Bring an existing import in line with the sheet's floors.
 *
 * For every item of a JSON produced by the current converter (which carries `floors`),
 * find the entry an earlier import created for the same subject, by any of:
 *   - the body the old merging rule produced ("甲；乙；丙；丁"),
 *   - the first floor itself,
 *   - the DM-blacklist placeholder body.
 * Then make its body the first floor and add every floor it does not already have as
 * a comment. Items with no matching entry are left for `npm run import`.
 *
 * Usage: npx tsx scripts/refloor.ts data/import-floors-all.json [more.json ...]
 */
import fs from "node:fs";
import { getDb } from "../src/lib/db";
import { scrubPII } from "../src/lib/scrub";
import { createComment, listComments } from "../src/lib/repo/comments";
import { findImportedByHash, hashBody, updateEntryBody, type Entry } from "../src/lib/repo/entries";
import { findOrCreateSubject } from "../src/lib/repo/subjects";
import type { ListKind, SubjectType } from "../src/lib/taxonomy";

type Item = {
  type: SubjectType;
  list: ListKind;
  name: string;
  city: string;
  shopName: string | null;
  floors?: string[];
};

const OLD_MIN_BODY = 10;
const PLACEHOLDER = "原表格「DM 黑榜」中被人列出，表里没有写事由。";

/** What scripts/xlsx_to_json.py used to emit as the body for these floors. */
function oldMergedBody(floors: string[]): string {
  let body = floors[0];
  const rest = floors.slice(1);
  while ([...body].length < OLD_MIN_BODY && rest.length) body = `${body}；${rest.shift()}`;
  return body;
}

const norm = (t: string) => t.replace(/[\s，。！？,.!?；;：:~～…]+/g, "").toLowerCase();

const db = getDb();
let bodiesChanged = 0;
let commentsAdded = 0;
let matched = 0;
let noMatch = 0;

for (const file of process.argv.slice(2)) {
  const items = JSON.parse(fs.readFileSync(file, "utf8")) as Item[];
  for (const item of items) {
    const floors = (item.floors ?? []).map((f) => scrubPII(f.trim())).filter(Boolean);
    if (floors.length === 0) continue;
    const subject = findOrCreateSubject(db, { type: item.type, name: item.name, city: item.city, shopName: item.shopName });
    let existing: Entry | null = null;
    for (const candidate of [scrubPII(oldMergedBody(floors)), floors[0], PLACEHOLDER]) {
      existing = findImportedByHash(db, subject.id, hashBody(candidate));
      if (existing) break;
    }
    if (!existing) {
      noMatch++;
      continue;
    }
    matched++;
    db.exec("BEGIN");
    try {
      if (existing.body !== floors[0]) {
        updateEntryBody(db, existing.id, floors[0], { allowShort: true });
        bodiesChanged++;
      }
      const have = new Set(listComments(db, { entryId: existing.id }).map((c) => norm(c.body)));
      have.add(norm(floors[0]));
      floors.slice(1).forEach((floor, i) => {
        if (have.has(norm(floor))) return;
        try {
          createComment(db, { entryId: existing!.id, subjectId: subject.id, kind: "comment", body: floor, vid: `import-f${i}`, ipHash: "import" });
          have.add(norm(floor));
          commentsAdded++;
        } catch (e) {
          console.warn(`floor skipped for ${item.name}: ${(e as Error).message}`);
        }
      });
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

console.log(JSON.stringify({ matched, bodiesChanged, commentsAdded, noMatch }));
