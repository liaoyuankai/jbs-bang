import { markFeedbackDoneAction } from "@/app/actions/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { listFeedback } from "@/lib/repo/feedback";
import { countOpenTargets } from "@/lib/repo/reports";
import { siteVoteDaily, siteVoteTally } from "@/lib/repo/site-votes";
import { shortVid } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const open = listFeedback(db, { status: "open" });
  const done = listFeedback(db, { status: "done", limit: 50 });
  const votes = siteVoteTally(db);
  const days = siteVoteDaily(db, 14).reverse();

  return (
    <div className="space-y-5">
      <AdminNav active="feedback" msg={msg} openReports={countOpenTargets(db)} openFeedback={open.length} />

      <section className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm">
        <p>
          进站弹窗投票：支持 <strong>{votes.up}</strong> · 不支持 <strong>{votes.down}</strong>
        </p>
        {days.length > 0 && (
          <table className="mt-2 w-full text-xs">
            <thead className="text-left text-stone-500">
              <tr>
                <th className="py-1 font-normal">日期</th>
                <th className="py-1 font-normal">新增支持</th>
                <th className="py-1 font-normal">新增不支持</th>
                <th className="py-1 font-normal">累计</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-t border-stone-100">
                  <td className="py-1">{d.date}</td>
                  <td className="py-1">{d.up > 0 ? `+${d.up}` : "0"}</td>
                  <td className="py-1">{d.down > 0 ? `+${d.down}` : "0"}</td>
                  <td className="py-1 text-stone-500">
                    {d.totalUp} / {d.totalDown}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-1 text-xs text-stone-400">按北京时间分天，每个访客只算一票，改票不重复计。</p>
      </section>

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
