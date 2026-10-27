import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryCard } from "@/components/EntryCard";
import { SubjectHeader } from "@/components/SubjectHeader";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { confidenceLabel } from "@/lib/labels";
import { listComments } from "@/lib/repo/comments";
import { endorseCounts } from "@/lib/repo/endorsements";
import { listEntries } from "@/lib/repo/entries";
import { getSubject, subjectIsPublic } from "@/lib/repo/subjects";
import type { ListKind } from "@/lib/taxonomy";
import { ResponseForm } from "@/components/CommentForm";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ list?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();
  const subject = getSubject(db, id);
  if (!subject) notFound();
  // a subject with nothing published yet is only visible to the admin, so unreviewed names never leak
  if (!subjectIsPublic(db, id) && !(await isAdmin())) notFound();

  const red = listEntries(db, { subjectId: id, list: "red", limit: 200 });
  const black = listEntries(db, { subjectId: id, list: "black", limit: 200 });
  const list: ListKind = sp.list === "red" ? "red" : sp.list === "black" ? "black" : black.length > 0 ? "black" : "red";
  const entries = list === "red" ? red : black;
  const counts = endorseCounts(db, entries.map((e) => e.id));
  const responses = listComments(db, { subjectId: id, kind: "response" });

  return (
    <div className="space-y-4">
      <SubjectHeader subject={subject} redCount={red.length} blackCount={black.length} />

      {responses.length > 0 && (
        <section className="rounded-lg border border-sky-200 bg-sky-50 p-4">
          <h2 className="text-sm font-semibold text-sky-900">当事人回应</h2>
          <ul className="mt-2 space-y-3">
            {responses.map((r) => (
              <li key={r.id} className="whitespace-pre-wrap text-[15px] leading-relaxed">
                {r.body}
                <div className="mt-1 text-xs text-sky-800/70">{fmtDate(r.createdAt)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-1 rounded-lg bg-stone-200 p-1 text-sm w-fit">
        <Link
          href={`/s/${id}?list=black`}
          className={`rounded-md px-3 py-1 ${list === "black" ? "bg-stone-900 text-white" : "text-stone-700"}`}
        >
          黑榜 {black.length}
        </Link>
        <Link
          href={`/s/${id}?list=red`}
          className={`rounded-md px-3 py-1 ${list === "red" ? "bg-rose-600 text-white" : "text-stone-700"}`}
        >
          红榜 {red.length}
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center text-stone-500">
          还没有{list === "red" ? "红榜" : "黑榜"}内容。
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              label={confidenceLabel(db, e)}
              endorseCount={counts.get(e.id) ?? 0}
              showSubject={false}
            />
          ))}
        </div>
      )}

      <section id="respond" className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">我是当事人，提交回应</h2>
        <p className="mt-1 text-sm text-stone-500">
          回应审核通过后会置顶显示在本页，与投稿并列，不会覆盖投稿。请只写事实经过，不要写联系方式。
        </p>
        <ResponseForm subjectId={id} />
      </section>
    </div>
  );
}
