import Link from "next/link";
import { Chip, ChipRow } from "@/components/Chip";
import { TypeBadge } from "@/components/Label";
import { getDb } from "@/lib/db";
import { searchSubjects } from "@/lib/repo/subjects";
import { isSubjectType, SUBJECT_TYPES, typeLabel, type SubjectType } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

function searchHref(q: string, type?: SubjectType): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (type) p.set("type", type);
  const s = p.toString();
  return s ? `/search?${s}` : "/search";
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().slice(0, 50);
  const type: SubjectType | undefined = isSubjectType(sp.type) ? sp.type : undefined;
  const results = query ? searchSubjects(getDb(), query, { type, limit: 50, publicOnly: true }) : [];

  return (
    <div className="space-y-4">
      <form action="/search" method="get" className="flex gap-2">
        {type && <input type="hidden" name="type" value={type} />}
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={type ? `搜${typeLabel(type)}` : "搜店名、DM、玩家昵称"}
          className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2.5"
          autoFocus
        />
        <button type="submit" className="rounded-md bg-stone-900 px-4 py-2 text-white">
          搜索
        </button>
      </form>

      <ChipRow>
        <Chip href={searchHref(query)} active={!type}>
          全部
        </Chip>
        {SUBJECT_TYPES.map((t) => (
          <Chip key={t} href={searchHref(query, t)} active={type === t}>
            {typeLabel(t)}
          </Chip>
        ))}
      </ChipRow>

      {query && results.length === 0 && (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center text-stone-500">
          <p>
            没有找到{type ? `叫「${query}」的${typeLabel(type)}` : `「${query}」`}。
          </p>
          <Link href={`/submit?name=${encodeURIComponent(query)}`} className="mt-2 inline-block text-stone-900 underline">
            去投稿并新建这个对象
          </Link>
        </div>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {results.map((s) => (
            <li key={s.id}>
              <Link href={`/s/${s.id}`} className="flex items-center gap-2 px-4 py-3.5 hover:bg-stone-50 active:bg-stone-50">
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
