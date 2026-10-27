import type { DatabaseSync } from "node:sqlite";
import { newId } from "../ids";
import { appendEvent } from "../events";
import { scrubPII } from "../scrub";
import type { SubjectType } from "../taxonomy";
import { now, rowToSubject, type Subject } from "../types";

type Row = Record<string, unknown>;

export const NAME_MAX = 40;
export const CITY_MAX = 20;

/** Trim, collapse whitespace, scrub contact info, cap length. Null when nothing is left. */
function clean(s: string | null | undefined, max: number): string | null {
  const t = scrubPII((s ?? "").trim().replace(/\s+/g, " "));
  const capped = [...t].slice(0, max).join("").trim();
  return capped.length ? capped : null;
}

// A subject is public once anything about it is published; before that only the admin sees it.
const PUBLIC_FILTER = `(
  EXISTS (SELECT 1 FROM entries e WHERE e.subject_id = subjects.id AND e.status = 'published')
  OR EXISTS (SELECT 1 FROM comments c WHERE c.subject_id = subjects.id AND c.kind = 'response' AND c.status = 'published')
)`;

export function findOrCreateSubject(
  db: DatabaseSync,
  input: { type: SubjectType; name: string; city: string; shopName?: string | null },
): Subject {
  const name = clean(input.name, NAME_MAX);
  const city = clean(input.city, CITY_MAX);
  const shopName = input.type === "dm" ? clean(input.shopName, NAME_MAX) : null;
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

export function subjectIsPublic(db: DatabaseSync, id: string): boolean {
  const row = db.prepare(`SELECT 1 AS x FROM subjects WHERE id = ? AND ${PUBLIC_FILTER}`).get(id);
  return !!row;
}

function likePattern(q: string): string {
  return `%${q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
}

export function searchSubjects(
  db: DatabaseSync,
  q: string,
  opts: { city?: string; type?: SubjectType; limit?: number; publicOnly?: boolean } = {},
): Subject[] {
  const pat = likePattern(q);
  if (pat === "%%") return [];
  const rows = db
    .prepare(
      `SELECT * FROM subjects
       WHERE (name LIKE ? ESCAPE '\\' OR aliases LIKE ? ESCAPE '\\' OR COALESCE(shop_name,'') LIKE ? ESCAPE '\\')
         AND (? IS NULL OR city = ?)
         AND (? IS NULL OR type = ?)
         AND (? = 0 OR ${PUBLIC_FILTER})
       ORDER BY name LIMIT ?`,
    )
    .all(
      pat,
      pat,
      pat,
      opts.city ?? null,
      opts.city ?? null,
      opts.type ?? null,
      opts.type ?? null,
      opts.publicOnly ? 1 : 0,
      opts.limit ?? 20,
    ) as Row[];
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
  const name = patch.name !== undefined ? clean(patch.name, NAME_MAX) : cur.name;
  const city = patch.city !== undefined ? clean(patch.city, CITY_MAX) : cur.city;
  const shopName = patch.shopName !== undefined ? clean(patch.shopName, NAME_MAX) : cur.shopName;
  const aliases =
    patch.aliases !== undefined
      ? patch.aliases.map((a) => clean(a, NAME_MAX)).filter((a): a is string => !!a)
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

export function listCities(db: DatabaseSync, opts: { publicOnly?: boolean } = {}): string[] {
  const rows = db
    .prepare(`SELECT DISTINCT city FROM subjects WHERE (? = 0 OR ${PUBLIC_FILTER}) ORDER BY city`)
    .all(opts.publicOnly ? 1 : 0) as { city: string }[];
  return rows.map((r) => r.city);
}
