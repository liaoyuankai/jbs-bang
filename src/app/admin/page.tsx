import Link from "next/link";
import { moderateCommentAction, moderateEntryAction } from "@/app/actions/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { ListBadge, TypeBadge } from "@/components/Label";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { listPendingComments } from "@/lib/repo/comments";
import { listPending } from "@/lib/repo/entries";
import { shortVid } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export default async function AdminQueuePage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const entries = listPending(db);
  const comments = listPendingComments(db);

  return (
    <div className="space-y-5">
      <AdminNav active="queue" msg={msg} />

      <section className="space-y-3">
        <h2 className="font-semibold">待审投稿 {entries.length}</h2>
        {entries.length === 0 && <p className="text-sm text-stone-500">队列是空的。</p>}
        {entries.map((e) => (
          <article key={e.id} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <ListBadge list={e.list} />
              <TypeBadge type={e.subject.type} />
              <Link href={`/s/${e.subject.id}`} className="font-semibold hover:underline">
                {e.subject.name}
              </Link>
              {e.subject.shopName && <span className="text-stone-500">@{e.subject.shopName}</span>}
              <span className="text-stone-500">{e.subject.city}</span>
              <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">{e.category}</span>
              <span className="ml-auto text-xs text-stone-500">
                {e.source === "import" ? "表格导入" : shortVid(e.vid)} · {fmtDate(e.createdAt)}
                {e.occurredAt && ` · 发生于 ${e.occurredAt}`}
              </span>
            </div>
            {e.evidenceCount > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from({ length: e.evidenceCount }, (_, i) => (
                  <a key={i} href={`/admin/evidence/${e.id}/${i + 1}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/admin/evidence/${e.id}/${i + 1}`} alt={`证据 ${i + 1}`} className="h-24 rounded border border-stone-200 object-cover" />
                  </a>
                ))}
              </div>
            )}
            <form action={moderateEntryAction} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="returnTo" value="/admin" />
              <textarea
                name="body"
                defaultValue={e.body}
                rows={4}
                className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-[15px]"
              />
              <div className="flex gap-2">
                <button type="submit" name="decision" value="approve" className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white">
                  通过（含编辑）
                </button>
                <button type="submit" name="decision" value="reject" className="rounded border border-stone-300 px-3 py-1.5 text-sm">
                  驳回
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">待审评论与回应 {comments.length}</h2>
        {comments.length === 0 && <p className="text-sm text-stone-500">没有待审评论。</p>}
        {comments.map((c) => (
          <article key={c.id} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded px-1.5 py-0.5 text-xs ${c.kind === "response" ? "bg-sky-100 text-sky-900" : "bg-stone-100"}`}>
                {c.kind === "response" ? "当事人回应" : "评论"}
              </span>
              <TypeBadge type={c.subject.type} />
              <Link href={`/s/${c.subject.id}`} className="font-semibold hover:underline">
                {c.subject.name}
              </Link>
              {c.entryId && (
                <Link href={`/e/${c.entryId}`} className="text-xs underline">
                  查看条目
                </Link>
              )}
              <span className="ml-auto text-xs text-stone-500">
                {shortVid(c.vid)} · {fmtDate(c.createdAt)}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[15px]">{c.body}</p>
            <form action={moderateCommentAction} className="mt-2 flex gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="returnTo" value="/admin" />
              <button type="submit" name="decision" value="approve" className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white">
                通过
              </button>
              <button type="submit" name="decision" value="reject" className="rounded border border-stone-300 px-3 py-1.5 text-sm">
                驳回
              </button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
