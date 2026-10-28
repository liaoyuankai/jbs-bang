import { markFeedbackDoneAction } from "@/app/actions/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { listFeedback } from "@/lib/repo/feedback";
import { countOpenTargets } from "@/lib/repo/reports";
import { siteVoteTally } from "@/lib/repo/site-votes";
import { shortVid } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const open = listFeedback(db, { status: "open" });
  const done = listFeedback(db, { status: "done", limit: 50 });
  const votes = siteVoteTally(db);

  return (
    <div className="space-y-5">
      <AdminNav active="feedback" msg={msg} openReports={countOpenTargets(db)} openFeedback={open.length} />

      <p className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm">
        进站弹窗投票：支持 <strong>{votes.up}</strong> · 不支持 <strong>{votes.down}</strong>
      </p>

      <section className="space-y-3">
        <h2 className="font-semibold">未处理反馈 {open.length}</h2>
        {open.length === 0 && <p className="text-sm text-stone-500">没有新的反馈。</p>}
        {open.map((f) => (
          <article key={f.id} className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{f.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-stone-500">
              <span>
                {shortVid(f.vid)} · {fmtDate(f.createdAt)}
              </span>
              <form action={markFeedbackDoneAction} className="ml-auto">
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="returnTo" value="/admin/feedback" />
                <button type="submit" className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700">
                  已处理
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-stone-500">已处理（最近 {done.length} 条）</h2>
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
            {done.map((f) => (
              <li key={f.id} className="px-4 py-3 text-sm text-stone-500">
                <p className="line-clamp-2 whitespace-pre-wrap">{f.body}</p>
                <p className="mt-1 text-xs">
                  {shortVid(f.vid)} · {fmtDate(f.createdAt)} · 处理于 {fmtDate(f.doneAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
