import Link from "next/link";
import { notFound } from "next/navigation";
import { moderateCommentAction } from "@/app/actions/admin";
import { CommentForm } from "@/components/CommentForm";
import { EndorseButton } from "@/components/EndorseButton";
import { ReportButton } from "@/components/ReportButton";
import { Label, ListBadge, TypeBadge } from "@/components/Label";
import { isAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { confidenceLabel } from "@/lib/labels";
import { listComments } from "@/lib/repo/comments";
import { endorseCount, hasEndorsed } from "@/lib/repo/endorsements";
import { getEntryWithSubject } from "@/lib/repo/entries";
import { readVid, shortVid } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const entry = getEntryWithSubject(db, id);
  if (!entry) notFound();
  const admin = await isAdmin();
  if ((entry.status === "pending" || entry.status === "rejected") && !admin) notFound();

  const s = entry.subject;
  const label = confidenceLabel(db, entry);
  const count = endorseCount(db, id);
  const vid = await readVid();
  const done = vid ? hasEndorsed(db, id, vid) : false;
  const comments = listComments(db, { entryId: id, kind: "comment" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ListBadge list={entry.list} />
        <TypeBadge type={s.type} />
        <Link href={`/s/${s.id}`} className="font-semibold hover:underline">
          {s.name}
        </Link>
        {s.shopName && <span className="text-stone-500">@{s.shopName}</span>}
        <span className="text-stone-500">{s.city}</span>
        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">{entry.category}</span>
        <Label text={label} />
      </div>

      {entry.status === "removed" ? (
        <section className="rounded-lg border border-stone-300 bg-stone-100 p-6 text-stone-600">
          <p className="font-semibold">本条已下架</p>
          <p className="mt-1 text-sm">
            本条于 {fmtDate(entry.removedAt)} 下架，原因：{entry.removedReason}
          </p>
          <p className="mt-1 text-xs text-stone-500">原文内容已不再展示，下架记录保留在透明度页。</p>
        </section>
      ) : (
        <>
          {entry.status !== "published" && (
            <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
              状态：{entry.status === "pending" ? "待审核" : "已驳回"}（仅管理员可见）
            </p>
          )}
          <article className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{entry.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
              <span>{entry.source === "import" ? "表格存档" : shortVid(entry.vid)}</span>
              {entry.occurredAt && <span>发生于 {entry.occurredAt}</span>}
              <span>{fmtDate(entry.createdAt)}</span>
              {entry.evidenceCount > 0 && <span>附证据 {entry.evidenceCount} 张，仅站长可见</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <EndorseButton entryId={id} list={entry.list} count={count} done={done} />
              <ReportButton targetKind="entry" targetId={id} />
            </div>
          </article>

          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold">评论 {comments.length}</h2>
            {comments.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">还没有评论。</p>
            ) : (
              <ul className="mt-2 divide-y divide-stone-100">
                {comments.map((c) => (
                  <li key={c.id} className="py-2">
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{c.body}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <span>
                        {c.vid.startsWith("import-") ? "表格存档" : shortVid(c.vid)} · {fmtDate(c.createdAt)}
                      </span>
                      <ReportButton targetKind="comment" targetId={c.id} />
                      {admin && (
                        <form action={moderateCommentAction} className="flex basis-full items-center gap-2 pt-1">
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="decision" value="remove" />
                          <input type="hidden" name="returnTo" value={`/e/${id}`} />
                          <input name="reason" required placeholder="站长下架原因" className="min-w-0 flex-1 rounded-md border border-stone-300 px-2 py-1" />
                          <button type="submit" className="rounded-md border border-red-300 bg-white px-3 py-1 text-red-700">
                            下架
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {entry.status === "published" && <CommentForm entryId={id} />}
          </section>
        </>
      )}
    </div>
  );
}
