import type { ListKind, SubjectType } from "./taxonomy";

export type Status = "pending" | "published" | "rejected" | "removed";
export type Source = "web" | "import";

export type Subject = {
  id: string;
  type: SubjectType;
  name: string;
  city: string;
  shopName: string | null;
  aliases: string[];
  createdAt: string;
};

export type Entry = {
  id: string;
  subjectId: string;
  list: ListKind;
  category: string;
  body: string;
  bodyHash: string;
  occurredAt: string | null;
  evidenceCount: number;
  contact: string | null;
  vid: string;
  ipHash: string;
  status: Status;
  source: Source;
  verified: boolean;
  removedReason: string | null;
  removedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type EntryWithSubject = Entry & { subject: Subject };

export type Comment = {
  id: string;
  entryId: string | null;
  subjectId: string;
  kind: "comment" | "response";
  body: string;
  vid: string;
  ipHash: string;
  status: Status;
  removedReason: string | null;
  removedAt: string | null;
  createdAt: string;
};

export type CommentWithSubject = Comment & { subject: Subject };

export const STATUSES: Status[] = ["pending", "published", "rejected", "removed"];

export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as string[]).includes(v);
}

export function now(): string {
  return new Date().toISOString();
}

export function rowToSubject(r: Record<string, unknown>): Subject {
  return {
    id: r.id as string,
    type: r.type as SubjectType,
    name: r.name as string,
    city: r.city as string,
    shopName: (r.shop_name as string | null) ?? null,
    aliases: JSON.parse((r.aliases as string) || "[]"),
    createdAt: r.created_at as string,
  };
}

export function rowToEntry(r: Record<string, unknown>): Entry {
  return {
    id: r.id as string,
    subjectId: r.subject_id as string,
    list: r.list as ListKind,
    category: r.category as string,
    body: r.body as string,
    bodyHash: r.body_hash as string,
    occurredAt: (r.occurred_at as string | null) ?? null,
    evidenceCount: Number(r.evidence_count ?? 0),
    contact: (r.contact as string | null) ?? null,
    vid: r.vid as string,
    ipHash: r.ip_hash as string,
    status: r.status as Status,
    source: r.source as Source,
    verified: Number(r.verified) === 1,
    removedReason: (r.removed_reason as string | null) ?? null,
    removedAt: (r.removed_at as string | null) ?? null,
    reviewedAt: (r.reviewed_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export function rowToComment(r: Record<string, unknown>): Comment {
  return {
    id: r.id as string,
    entryId: (r.entry_id as string | null) ?? null,
    subjectId: r.subject_id as string,
    kind: r.kind as "comment" | "response",
    body: r.body as string,
    vid: r.vid as string,
    ipHash: r.ip_hash as string,
    status: r.status as Status,
    removedReason: (r.removed_reason as string | null) ?? null,
    removedAt: (r.removed_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

/** Columns of a joined subject row prefixed with s_ → Subject. */
export function prefixedSubject(r: Record<string, unknown>): Subject {
  return rowToSubject({
    id: r.s_id,
    type: r.s_type,
    name: r.s_name,
    city: r.s_city,
    shop_name: r.s_shop_name,
    aliases: r.s_aliases,
    created_at: r.s_created_at,
  });
}

export const SUBJECT_JOIN_COLS =
  "s.id AS s_id, s.type AS s_type, s.name AS s_name, s.city AS s_city, s.shop_name AS s_shop_name, s.aliases AS s_aliases, s.created_at AS s_created_at";
