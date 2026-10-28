import Link from "next/link";
import { updateSubjectAction } from "@/app/actions/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { TypeBadge } from "@/components/Label";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { countOpenTargets } from "@/lib/repo/reports";
import { listSubjects, searchSubjects } from "@/lib/repo/subjects";

export const dynamic = "force-dynamic";

export default async function AdminSubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; msg?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 50);
  const db = getDb();
  const subjects = q ? searchSubjects(db, q, { limit: 100 }) : listSubjects(db, { limit: 100 });
  const returnTo = q ? `/admin/subjects?q=${encodeURIComponent(q)}` : "/admin/subjects";

  return (
    <div className="space-y-4">
      <AdminNav active="subjects" msg={sp.msg} openReports={countOpenTargets(db)} />
      <form action="/admin/subjects" method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="按名称、别名、店名搜索"
          className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2"
        />
        <button type="submit" className="rounded-md bg-stone-900 px-4 py-2 text-white">
          搜索
        </button>
      </form>
      <p className="text-xs text-stone-500">别名用逗号分隔。同名不同店的 DM 请在所属店里区分。</p>

      {subjects.map((s) => (
        <form key={s.id} action={updateSubjectAction} className="rounded-lg border border-stone-200 bg-white p-3">
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <TypeBadge type={s.type} />
            <input name="name" defaultValue={s.name} required className="min-w-0 flex-1 basis-40 rounded-md border border-stone-300 px-2 py-1.5" />
            {s.type === "dm" && (
              <input name="shopName" defaultValue={s.shopName ?? ""} placeholder="所属店" className="min-w-0 flex-1 basis-32 rounded-md border border-stone-300 px-2 py-1.5" />
            )}
            <input name="city" defaultValue={s.city} required className="w-24 rounded-md border border-stone-300 px-2 py-1.5" />
            <input
              name="aliases"
              defaultValue={s.aliases.join(", ")}
              placeholder="别名，逗号分隔"
              className="min-w-0 flex-1 basis-48 rounded-md border border-stone-300 px-2 py-1.5"
            />
            <button type="submit" className="rounded-md bg-stone-900 px-4 py-1.5 text-white">
              保存
            </button>
            <Link href={`/s/${s.id}`} className="text-xs underline">
              查看
            </Link>
          </div>
        </form>
      ))}
    </div>
  );
}
