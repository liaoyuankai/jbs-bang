import Link from "next/link";
import { setCity } from "@/app/actions/city";
import { Chip, ChipRow } from "@/components/Chip";
import { CitySelect } from "@/components/CitySelect";
import { EntryCard } from "@/components/EntryCard";
import { cityOptions } from "@/lib/cities";
import { getDb } from "@/lib/db";
import { getCurrentCity } from "@/lib/current-city";
import { confidenceLabel } from "@/lib/labels";
import { endorseCounts } from "@/lib/repo/endorsements";
import { countEntriesByType, listEntries } from "@/lib/repo/entries";
import { isSubjectType, SUBJECT_TYPES, typeLabel, type ListKind, type SubjectType } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

function listHref(p: { list: ListKind; type?: SubjectType; page?: number }): string {
  const q = new URLSearchParams({ list: p.list });
  if (p.type) q.set("type", p.type);
  if (p.page && p.page > 1) q.set("page", String(p.page));
  return `/?${q.toString()}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ list?: string; page?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const list: ListKind = sp.list === "red" ? "red" : "black";
  const type: SubjectType | undefined = isSubjectType(sp.type) ? sp.type : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const city = await getCurrentCity();
  const db = getDb();
  const cities = cityOptions(db);
  const entries = listEntries(db, { city, list, type, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE });
  const typeCounts = countEntriesByType(db, { city, list });
  const total = typeCounts.shop + typeCounts.dm + typeCounts.player;
  const hasMore = entries.length > PAGE_SIZE;
  const shown = entries.slice(0, PAGE_SIZE);
  const counts = endorseCounts(db, shown.map((e) => e.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-stone-200 p-1 text-[15px]">
          <Link
            href={listHref({ list: "black", type })}
            className={`rounded-md px-4 py-1.5 ${list === "black" ? "bg-stone-900 text-white" : "text-stone-700"}`}
          >
            黑榜
          </Link>
          <Link
            href={listHref({ list: "red", type })}
            className={`rounded-md px-4 py-1.5 ${list === "red" ? "bg-rose-600 text-white" : "text-stone-700"}`}
          >
            红榜
          </Link>
        </div>
        <form action={setCity} className="flex items-center text-[15px]">
          <input type="hidden" name="returnTo" value={listHref({ list, type })} />
          <CitySelect cities={cities} value={city} />
        </form>
      </div>

      <ChipRow>
        <Chip href={listHref({ list })} active={!type}>
          全部 {total}
        </Chip>
        {SUBJECT_TYPES.map((t) => (
          <Chip key={t} href={listHref({ list, type: t })} active={type === t}>
            {typeLabel(t)} {typeCounts[t]}
          </Chip>
        ))}
      </ChipRow>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          <p>
            {city} 还没有{type ? typeLabel(type) : ""}
            {list === "red" ? "红榜" : "黑榜"}内容。
          </p>
          <Link href="/submit" className="mt-2 inline-block text-stone-900 underline">
            写第一条
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((e) => (
            <EntryCard key={e.id} entry={e} label={confidenceLabel(db, e)} endorseCount={counts.get(e.id) ?? 0} />
          ))}
        </div>
      )}

      <div className="flex justify-between text-[15px]">
        {page > 1 ? (
          <Link href={listHref({ list, type, page: page - 1 })} className="rounded-md border border-stone-300 bg-white px-4 py-2">
            上一页
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link href={listHref({ list, type, page: page + 1 })} className="rounded-md border border-stone-300 bg-white px-4 py-2">
            下一页
          </Link>
        )}
      </div>
    </div>
  );
}
