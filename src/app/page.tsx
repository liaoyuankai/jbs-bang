import Link from "next/link";
import { setCity } from "@/app/actions/city";
import { EntryCard } from "@/components/EntryCard";
import { getDb } from "@/lib/db";
import { config } from "@/lib/config";
import { getCurrentCity } from "@/lib/current-city";
import { confidenceLabel } from "@/lib/labels";
import { endorseCounts } from "@/lib/repo/endorsements";
import { listEntries } from "@/lib/repo/entries";
import { listCities } from "@/lib/repo/subjects";
import type { ListKind } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ list?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const list: ListKind = sp.list === "red" ? "red" : "black";
  const page = Math.max(1, Number(sp.page) || 1);
  const city = await getCurrentCity();
  const db = getDb();
  const cities = Array.from(new Set([config.defaultCity, ...listCities(db)]));
  const entries = listEntries(db, { city, list, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE });
  const hasMore = entries.length > PAGE_SIZE;
  const shown = entries.slice(0, PAGE_SIZE);
  const counts = endorseCounts(db, shown.map((e) => e.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-stone-200 p-1 text-sm">
          <Link
            href="/?list=black"
            className={`rounded-md px-3 py-1 ${list === "black" ? "bg-stone-900 text-white" : "text-stone-700"}`}
          >
            黑榜
          </Link>
          <Link
            href="/?list=red"
            className={`rounded-md px-3 py-1 ${list === "red" ? "bg-rose-600 text-white" : "text-stone-700"}`}
          >
            红榜
          </Link>
        </div>
        <form action={setCity} className="flex items-center gap-1 text-sm">
          <input type="hidden" name="returnTo" value={`/?list=${list}`} />
          <select
            name="city"
            defaultValue={city}
            className="rounded border border-stone-300 bg-white px-2 py-1"
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded border border-stone-300 bg-white px-2 py-1">
            切换
          </button>
        </form>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          <p>{city} 还没有{list === "red" ? "红榜" : "黑榜"}内容。</p>
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

      <div className="flex justify-between text-sm">
        {page > 1 ? (
          <Link href={`/?list=${list}&page=${page - 1}`} className="underline">
            上一页
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link href={`/?list=${list}&page=${page + 1}`} className="underline">
            下一页
          </Link>
        )}
      </div>
    </div>
  );
}
