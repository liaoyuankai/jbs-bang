import type { DatabaseSync } from "node:sqlite";
import { newId } from "../ids";
import { appendEvent } from "../events";
import type { SubjectType } from "../taxonomy";
import { now, rowToSubject, type Subject } from "../types";

type Row = Record<string, unknown>;

function clean(s: string | null | undefined): string | null {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  return t.length ? t : null;
}

export function findOrCreateSubject(
  db: DatabaseSync,
  input: { type: SubjectType; name: string; city: string; shopName?: string | null },
): Subject {
  const name = clean(input.name);
  const city = clean(input.city);
  const shopName = input.type === "dm" ? clean(input.shopName) : null;
  if (!name) throw new Error("对象名称不能为空");
  if (!city) throw new Error("城市不能为空");

  const existing = db
    .prepare(
      `SELECT * FROM subjects
       WHERE type = ? AND lower(name) = lower(?) AND city = ?
         AND COALESCE(lower(shop_name), '') = COALESCE(lower(?), '')`,
    )
    .get(input.type, name, city, shopName) as Row | undefined;
  if (existing) return rowToSubject(existing);

  const id = newId();
  db.prepare(
    "INSERT INTO subjects (id, type, name, city, shop_name, aliases, created_at) VALUES (?, ?, ?, ?, ?, '[]', ?)",
  ).run(id, input.type, name, city, shopName, now());
  appendEvent(db, "subject.created", id, { type: input.type, name, city, shopName });
  return getSubject(db, id)!;
}

export function getSubject(db: DatabaseSync, id: string): Subject | null {
  const row = db.prepare("SELECT * FROM subjects WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToSubject(row) : null;
}

function likePattern(q: string): string {
  return `%${q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
}

export function searchSubjects(
  db: DatabaseSync,
  q: string,
  opts: { city?: string; type?: SubjectType; limit?: number } = {},
): Subject[] {
  const pat = likePattern(q);
  if (pat === "%%") return [];
  const rows = db
    .prepare(
      `SELECT * FROM subjects
       WHERE (name LIKE ? ESCAPE '\\' OR aliases LIKE ? ESCAPE '\\' OR COALESCE(shop_name,'') LIKE ? ESCAPE '\\')
         AND (? IS NULL OR city = ?)
         AND (? IS NULL OR type = ?)
       ORDER BY name LIMIT ?`,
    )
    .all(pat, pat, pat, opts.city ?? null, opts.city ?? null, opts.type ?? null, opts.type ?? null, opts.limit ?? 20) as Row[];
  return rows.map(rowToSubject);
}

export function listSubjects(
  db: DatabaseSync,
  opts: { city?: string; type?: SubjectType; limit?: number; offset?: number } = {},
): Subject[] {
  const rows = db
    .prepare(
      `SELECT * FROM subjects
       WHERE (? IS NULL OR city = ?) AND (? IS NULL OR type = ?)
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(opts.city ?? null, opts.city ?? null, opts.type ?? null, opts.type ?? null, opts.limit ?? 200, opts.offset ?? 0) as Row[];
  return rows.map(rowToSubject);
}

export function updateSubject(
  db: DatabaseSync,
  id: string,
  patch: { name?: string; city?: string; shopName?: string | null; aliases?: string[] },
): Subject {
  const cur = getSubject(db, id);
  if (!cur) throw new Error("对象不存在");
  const name = patch.name !== undefined ? clean(patch.name) : cur.name;
  const city = patch.city !== undefined ? clean(patch.city) : cur.city;
  const shopName = patch.shopName !== undefined ? clean(patch.shopName) : cur.shopName;
  const aliases =
    patch.aliases !== undefined
      ? patch.aliases.map((a) => clean(a)).filter((a): a is string => !!a)
      : cur.aliases;
  if (!name) throw new Error("对象名称不能为空");
  if (!city) throw new Error("城市不能为空");
  db.prepare("UPDATE subjects SET name = ?, city = ?, shop_name = ?, aliases = ? WHERE id = ?").run(
    name,
    city,
    cur.type === "dm" ? shopName : null,
    JSON.stringify(aliases),
    id,
  );
  appendEvent(db, "subject.updated", id, { name, city, shopName, aliases });
  return getSubject(db, id)!;
}

export function listCities(db: DatabaseSync): string[] {
  const rows = db.prepare("SELECT DISTINCT city FROM subjects ORDER BY city").all() as { city: string }[];
  return rows.map((r) => r.city);
}
