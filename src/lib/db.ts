import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";
import { config } from "./config";

export function openDb(file: string): DatabaseSync {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA_SQL);
  return db;
}

type G = typeof globalThis & { __jbsDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  const g = globalThis as G;
  if (!g.__jbsDb) {
    g.__jbsDb = openDb(path.join(config.dataDir, "app.db"));
  }
  return g.__jbsDb;
}
