// Consistent SQLite backup using the online backup API. Runs inside the app container:
//   docker compose exec -T app node scripts/backup.mjs
// Writes DATA_DIR/backups/app-<timestamp>.db and prunes backups older than KEEP_DAYS (default 14).
import { backup, DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR || "/data";
const keepDays = Number(process.env.KEEP_DAYS || 14);
const src = path.join(dataDir, "app.db");
const outDir = path.join(dataDir, "backups");
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const dest = path.join(outDir, `app-${stamp}.db`);

const db = new DatabaseSync(src, { readOnly: true });
await backup(db, dest);
db.close();

const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
let pruned = 0;
for (const f of fs.readdirSync(outDir)) {
  const p = path.join(outDir, f);
  if (/^app-.*\.db$/.test(f) && fs.statSync(p).mtimeMs < cutoff) {
    fs.unlinkSync(p);
    pruned++;
  }
}
console.log(JSON.stringify({ backup: dest, bytes: fs.statSync(dest).size, pruned }));
