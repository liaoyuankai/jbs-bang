/**
 * Import data/import.json (from scripts/xlsx_to_json.py) into DATA_DIR/app.db.
 * Idempotent: an item whose scrubbed body already exists for the same subject
 * with source='import' is skipped.
 *
 * Usage: npx tsx scripts/import.ts [data/import.json]
 */
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { scrubPII } from "../src/lib/scrub";
import { createComment } from "../src/lib/repo/comments";
import { endorse } from "../src/lib/repo/endorsements";
import { createEntry, findImportedByHash, hashBody } from "../src/lib/repo/entries";
import { findOrCreateSubject } from "../src/lib/repo/subjects";
import type { ListKind, SubjectType } from "../src/lib/taxonomy";

type Item = {
  type: SubjectType;
  list: ListKind;
  name: string;
  city: string;
  shopName: string | null;
  category: string;
  body: string;
  comments: string[];
  endorsements: number;
};

const file = process.argv[2] ?? path.join("data", "import.json");
const items = JSON.parse(fs.readFileSync(file, "utf8")) as Item[];
const db = getDb();

let inserted = 0;
let skipped = 0;
let comments = 0;
let endorsements = 0;
let failed = 0;

for (const item of items) {
  try {
    const subject = findOrCreateSubject(db, {
      type: item.type,
      name: item.name,
      city: item.city,
      shopName: item.shopName,
    });
    const body = scrubPII(item.body.trim());
    if (findImportedByHash(db, subject.id, hashBody(body))) {
      skipped++;
      continue;
    }
    const entry = createEntry(db, {
      subjectId: subject.id,
      list: item.list,
      category: item.category,
      body,
      vid: "import-sheet",
      ipHash: "import",
      status: "published",
      source: "import",
    });
    inserted++;
    item.comments.forEach((c, i) => {
      try {
        createComment(db, {
          entryId: entry.id,
          subjectId: subject.id,
          kind: "comment",
          body: c,
          vid: `import-c${i}`,
          ipHash: "import",
          status: "published",
        });
        comments++;
      } catch (e) {
        console.warn(`comment skipped for ${item.name}: ${(e as Error).message}`);
      }
    });
    for (let i = 0; i < item.endorsements; i++) {
      endorse(db, entry.id, `import-e${i}`);
      endorsements++;
    }
  } catch (e) {
    failed++;
    console.warn(`failed ${item.type}/${item.name}: ${(e as Error).message}`);
  }
}

console.log(
  JSON.stringify({ file, items: items.length, inserted, skipped, comments, endorsements, failed }, null, 1),
);
