import Link from "next/link";
import { getDb } from "@/lib/db";
import { eventCount, latestHash } from "@/lib/events";
import { fmtDate } from "@/lib/format";
import { countCommentsByStatus } from "@/lib/repo/comments";
import { countByStatus, listRemoved } from "@/lib/repo/entries";

export const dynamic = "force-dynamic";

export default function TransparencyPage() {
  const db = getDb();
  const entries = countByStatus(db);
  const comments = countCommentsByStatus(db);
  const seq = eventCount(db);
  const head = latestHash(db);
  const removed = listRemoved(db, 200);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">透明度</h1>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">内容统计</h2>
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-stone-500">
            <tr>
              <th className="py-1">状态</th>
              <th className="py-1">投稿</th>
              <th className="py-1">评论与回应</th>
            </tr>
          </thead>
          <tbody>
            {(["published", "pending", "rejected", "removed"] as const).map((s) => (
              <tr key={s} className="border-t border-stone-100">
                <td className="py-1">{{ published: "已公开", pending: "待审核", rejected: "已驳回", removed: "已下架" }[s]}</td>
                <td className="py-1">{entries[s]}</td>
                <td className="py-1">{comments[s]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">事件链</h2>
        <p className="mt-1 text-sm text-stone-600">
          每一次创建、审核、编辑、下架都追加一条事件，每条事件的哈希包含前一条的哈希。链头如下，任何人可以留存比对。
        </p>
        <dl className="mt-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-stone-500">事件数</dt>
            <dd>{seq}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-stone-500">链头</dt>
            <dd className="break-all font-mono text-xs">{head ?? "（尚无事件）"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">下架记录</h2>
        {removed.length === 0 ? (
          <p className="mt-1 text-sm text-stone-500">尚无下架记录。</p>
        ) : (
          <ul className="mt-2 divide-y divide-stone-100 text-sm">
            {removed.map((e) => (
              <li key={e.id} className="py-2">
                <Link href={`/e/${e.id}`} className="font-medium hover:underline">
                  {e.subject.name}
                </Link>
                <span className="text-stone-500">
                  {" "}
                  · {e.list === "red" ? "红榜" : "黑榜"} · {e.category} · {fmtDate(e.removedAt)}
                </span>
                <div className="text-stone-600">原因：{e.removedReason}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
