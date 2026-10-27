import Link from "next/link";
import { moderateEntryAction, toggleVerifiedAction } from "@/app/actions/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { Label, ListBadge, TypeBadge } from "@/components/Label";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { confidenceLabel } from "@/lib/labels";
import { listEntries } from "@/lib/repo/entries";
import { isStatus, type Status } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS: { key: Status; label: string }[] = [
  { key: "published", label: "已公开" },
  { key: "removed", label: "已下架" },
  { key: "rejected", label: "已驳回" },
];

export default async function AdminEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status: Status = isStatus(sp.status) && sp.status !== "pending" ? sp.status : "published";
  const page = Math.max(1, Number(sp.page) || 1);
  const db = getDb();
  const entries = listEntries(db, { status, limit: 51, offset: (page - 1) * 50 });
  const shown = entries.slice(0, 50);
  const returnTo = `/admin/entries?status=${status}&page=${page}`;

  return (
    <div className="space-y-4">
      <AdminNav active="entries" msg={sp.msg} />
      <div className="flex gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/entries?status=${t.key}`}
            className={`rounded px-3 py-1 ${status === t.key ? "bg-stone-900 text-white" : "border border-stone-300 bg-white"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {shown.length === 0 && <p className="text-sm text-stone-500">没有内容。</p>}
      {shown.map((e) => (
        <article key={e.id} className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <ListBadge list={e.list} />
            <TypeBadge type={e.subject.type} />
            <Link href={`/s/${e.subject.id}`} className="font-semibold hover:underline">
              {e.subject.name}
            </Link>
            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">{e.category}</span>
            <Label text={confidenceLabel(db, e)} />
            <Link href={`/e/${e.id}`} className="ml-auto text-xs underline">
              {fmtDate(e.createdAt)}
            </Link>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{e.body}</p>
          {e.status === "removed" && (
            <p className="mt-1 text-xs text-stone-500">
              下架于 {fmtDate(e.removedAt)}，原因：{e.removedReason}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {e.status === "published" && (
              <>
                <form action={moderateEntryAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="decision" value="remove" />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input
                    name="reason"
                    required
                    placeholder="下架原因（会公开）"
                    className="rounded border border-stone-300 px-2 py-1 text-sm"
                  />
                  <button type="submit" className="rounded border border-red-300 px-3 py-1 text-sm text-red-700">
                    下架
                  </button>
                </form>
                <form action={toggleVerifiedAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="verified" value={e.verified ? "0" : "1"} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button type="submit" className="rounded border border-amber-300 px-3 py-1 text-sm text-amber-900">
                    {e.verified ? "取消核验" : "标记平台核验"}
                  </button>
                </form>
              </>
            )}
            {e.status === "rejected" && (
              <form action={moderateEntryAction}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="decision" value="approve" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button type="submit" className="rounded bg-emerald-700 px-3 py-1 text-sm text-white">
                  改为通过
                </button>
              </form>
            )}
          </div>
        </article>
      ))}

      <div className="flex justify-between text-sm">
        {page > 1 ? (
          <Link href={`/admin/entries?status=${status}&page=${page - 1}`} className="underline">
            上一页
          </Link>
        ) : (
          <span />
        )}
        {entries.length > 50 && (
          <Link href={`/admin/entries?status=${status}&page=${page + 1}`} className="underline">
            下一页
          </Link>
        )}
      </div>
    </div>
  );
}
