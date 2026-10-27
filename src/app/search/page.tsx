import Link from "next/link";
import { TypeBadge } from "@/components/Label";
import { getDb } from "@/lib/db";
import { searchSubjects } from "@/lib/repo/subjects";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 50);
  const results = query ? searchSubjects(getDb(), query, { limit: 50, publicOnly: true }) : [];

  return (
    <div className="space-y-4">
      <form action="/search" method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="搜店名、DM、玩家昵称"
          className="flex-1 rounded border border-stone-300 bg-white px-3 py-2"
          autoFocus
        />
        <button type="submit" className="rounded bg-stone-900 px-4 py-2 text-white">
          搜索
        </button>
      </form>

      {query && results.length === 0 && (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center text-stone-500">
          <p>没有找到「{query}」。</p>
          <Link href={`/submit?name=${encodeURIComponent(query)}`} className="mt-2 inline-block text-stone-900 underline">
            去投稿并新建这个对象
          </Link>
        </div>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {results.map((s) => (
            <li key={s.id}>
              <Link href={`/s/${s.id}`} className="flex items-center gap-2 px-4 py-3 hover:bg-stone-50">
                <TypeBadge type={s.type} />
                <span className="font-medium">{s.name}</span>
                {s.shopName && <span className="text-sm text-stone-500">@{s.shopName}</span>}
                <span className="ml-auto text-sm text-stone-500">{s.city}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
