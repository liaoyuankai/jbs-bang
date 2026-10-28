/**
 * Re-floor an earlier import. The first converter merged short cells into one body
 * ("甲；乙；丙；丁"); the sheet meant them as separate floors. For every item in a
 * JSON produced by the current converter (which carries `floors`), find the entry the
 * old rule produced, shrink its body to the first floor and add the other floors as
 * comments. Items with no matching old entry are left for `npm run import`.
 *
 * Usage: npx tsx scripts/refloor.ts data/import.json [more.json ...]
 */
import fs from "node:fs";
import { getDb } from "../src/lib/db";
import { scrubPII } from "../src/lib/scrub";
import { createComment, listComments } from "../src/lib/repo/comments";
import { findImportedByHash, hashBody, updateEntryBody } from "../src/lib/repo/entries";
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

/** What scripts/xlsx_to_json.py used to emit as the body for these floors. */
function oldMergedBody(floors: string[]): string {
  let body = floors[0];
  const rest = floors.slice(1);
  while ([...body].length < OLD_MIN_BODY && rest.length) body = `${body}；${rest.shift()}`;
  return body;
}

const norm = (t: string) => t.replace(/[\s，。！？,.!?；;：:~～…]+/g, "").toLowerCase();

const db = getDb();
let entriesSplit = 0;
let commentsAdded = 0;
let untouched = 0;
let noMatch = 0;

for (const file of process.argv.slice(2)) {
  const items = JSON.parse(fs.readFileSync(file, "utf8")) as Item[];
  for (const item of items) {
    const floors = (item.floors ?? []).map((f) => f.trim()).filter(Boolean);
    if (floors.length < 2) {
      untouched++;
      continue;
    }
    const merged = scrubPII(oldMergedBody(floors));
    if (merged === scrubPII(floors[0])) {
      untouched++; // the old rule never merged this one
      continue;
    }
    const subject = findOrCreateSubject(db, { type: item.type, name: item.name, city: item.city, shopName: item.shopName });
    const existing = findImportedByHash(db, subject.id, hashBody(merged));
    if (!existing) {
      noMatch++;
      continue;
    }
    const firstFloor = scrubPII(floors[0]);
    db.exec("BEGIN");
    try {
      updateEntryBody(db, existing.id, firstFloor, { allowShort: true });
      const have = new Set(listComments(db, { entryId: existing.id }).map((c) => norm(c.body)));
      floors.slice(1).forEach((floor, i) => {
        if (have.has(norm(floor))) return;
        try {
          createComment(db, { entryId: existing.id, subjectId: subject.id, kind: "comment", body: floor, vid: `import-f${i}`, ipHash: "import" });
          commentsAdded++;
        } catch (e) {
          console.warn(`floor skipped for ${item.name}: ${(e as Error).message}`);
        }
      });
      db.exec("COMMIT");
      entriesSplit++;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

console.log(JSON.stringify({ entriesSplit, commentsAdded, untouched, noMatch }));
