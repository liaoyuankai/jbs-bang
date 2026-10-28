import Link from "next/link";
import { handleReportAction } from "@/app/actions/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { ListBadge, TypeBadge } from "@/components/Label";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { countOpenFeedback } from "@/lib/repo/feedback";
import { listOpenReports } from "@/lib/repo/reports";
import { shortVid } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const groups = listOpenReports(db);

  return (
    <div className="space-y-5">
      <AdminNav active="reports" msg={msg} openReports={groups.length} openFeedback={countOpenFeedback(db)} />

      <section className="space-y-3">
        <h2 className="font-semibold">待处理举报 {groups.length}</h2>
        <p className="text-sm text-stone-500">内容发布即公开。这里只决定一件事：下架还是留着。下架原因会公开显示在墓碑和透明度页。</p>
        {groups.length === 0 && <p className="text-sm text-stone-500">没有待处理的举报。</p>}
        {groups.map((g) => (
          <article key={`${g.targetKind}:${g.targetId}`} className="rounded-lg border border-stone-200 bg-white p-4">
            {g.target.kind === "entry" ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <ListBadge list={g.target.entry.list} />
                  <TypeBadge type={g.target.entry.subject.type} />
                  <Link href={`/s/${g.target.entry.subject.id}`} className="font-semibold hover:underline">
                    {g.target.entry.subject.name}
                  </Link>
                  {g.target.entry.subject.shopName && <span className="text-stone-500">@{g.target.entry.subject.shopName}</span>}
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">{g.target.entry.category}</span>
                  <Link href={`/e/${g.target.entry.id}`} className="ml-auto text-xs underline">
                    {g.target.entry.source === "import" ? "表格导入" : shortVid(g.target.entry.vid)} · {fmtDate(g.target.entry.createdAt)}
                  </Link>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[15px]">{g.target.entry.body}</p>
                {g.target.entry.evidenceCount > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from({ length: g.target.entry.evidenceCount }, (_, i) => (
                      <a key={i} href={`/admin/evidence/${g.target.kind === "entry" ? g.target.entry.id : ""}/${i + 1}`} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/admin/evidence/${g.target.kind === "entry" ? g.target.entry.id : ""}/${i + 1}`}
                          alt={`证据 ${i + 1}`}
                          className="h-24 rounded border border-stone-200 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${g.target.comment.kind === "response" ? "bg-sky-100 text-sky-900" : "bg-stone-100"}`}
                  >
                    {g.target.comment.kind === "response" ? "当事人回应" : "评论"}
                  </span>
                  <TypeBadge type={g.target.comment.subject.type} />
                  <Link href={`/s/${g.target.comment.subject.id}`} className="font-semibold hover:underline">
                    {g.target.comment.subject.name}
                  </Link>
                  {g.target.comment.entryId && (
                    <Link href={`/e/${g.target.comment.entryId}`} className="text-xs underline">
                      查看条目
                    </Link>
                  )}
                  <span className="ml-auto text-xs text-stone-500">
                    {shortVid(g.target.comment.vid)} · {fmtDate(g.target.comment.createdAt)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[15px]">{g.target.comment.body}</p>
              </>
            )}

            <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p>
                举报 {g.count} 次：{g.reasons.map((r) => `${r.reason} ×${r.n}`).join("，")}
              </p>
              {g.details.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                  {g.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>

            <form action={handleReportAction} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="targetKind" value={g.targetKind} />
              <input type="hidden" name="targetId" value={g.targetId} />
              <input type="hidden" name="returnTo" value="/admin" />
              <input
                name="reason"
                defaultValue={g.reasons[0]?.reason ?? ""}
                placeholder="下架原因（会公开）"
                className="min-w-0 flex-1 basis-48 rounded-md border border-stone-300 px-3 py-2"
              />
              <button type="submit" name="decision" value="remove" className="rounded-md border border-red-300 bg-white px-4 py-2 text-red-700">
                下架
              </button>
              <button type="submit" name="decision" value="dismiss" className="rounded-md border border-stone-300 bg-white px-4 py-2">
                留着，忽略举报
              </button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
