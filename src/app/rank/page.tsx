import Link from "next/link";
import { setCity } from "@/app/actions/city";
import { Chip, ChipRow } from "@/components/Chip";
import { CitySelect } from "@/components/CitySelect";
import { TypeBadge } from "@/components/Label";
import { config } from "@/lib/config";
import { getCurrentCity } from "@/lib/current-city";
import { getDb } from "@/lib/db";
import { rankSubjects } from "@/lib/repo/rank";
import { listCities } from "@/lib/repo/subjects";
import { isSubjectType, SUBJECT_TYPES, typeLabel, type ListKind, type SubjectType } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const LIMIT = 50;

function rankHref(p: { list: ListKind; type?: SubjectType }): string {
  const q = new URLSearchParams({ list: p.list });
  if (p.type) q.set("type", p.type);
  return `/rank?${q.toString()}`;
}

export default async function RankPage({ searchParams }: { searchParams: Promise<{ list?: string; type?: string }> }) {
  const sp = await searchParams;
  const list: ListKind = sp.list === "red" ? "red" : "black";
  const type: SubjectType | undefined = isSubjectType(sp.type) ? sp.type : undefined;
  const city = await getCurrentCity();
  const db = getDb();
  const cities = Array.from(new Set([config.defaultCity, ...listCities(db, { publicOnly: true })]));
  const rows = rankSubjects(db, { city, list, type, limit: LIMIT });
  const agree = list === "black" ? "我也遇到过" : "点了";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-stone-200 p-1 text-[15px]">
          <Link
            href={rankHref({ list: "black", type })}
            className={`rounded-md px-4 py-1.5 ${list === "black" ? "bg-stone-900 text-white" : "text-stone-700"}`}
          >
            黑榜热度
          </Link>
          <Link
            href={rankHref({ list: "red", type })}
            className={`rounded-md px-4 py-1.5 ${list === "red" ? "bg-rose-600 text-white" : "text-stone-700"}`}
          >
            红榜热度
          </Link>
        </div>
        <form action={setCity} className="flex items-center text-[15px]">
          <input type="hidden" name="returnTo" value={rankHref({ list, type })} />
          <CitySelect cities={cities} value={city} />
        </form>
      </div>

      <ChipRow>
        <Chip href={rankHref({ list })} active={!type}>
          全部
        </Chip>
        {SUBJECT_TYPES.map((t) => (
          <Chip key={t} href={rankHref({ list, type: t })} active={type === t}>
            {typeLabel(t)}
          </Chip>
        ))}
      </ChipRow>

      <p className="text-xs text-stone-500">
        热度 = 投稿 ×3 + 「{agree}」 ×2 + 评论 ×1，只算公开中的内容，最多显示 {LIMIT} 名。
      </p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          {city} 还没有{type ? typeLabel(type) : ""}
          {list === "red" ? "红榜" : "黑榜"}内容。
        </div>
      ) : (
        <ol className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {rows.map((r, i) => (
            <li key={r.subject.id}>
              <Link
                href={`/s/${r.subject.id}?list=${list}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 active:bg-stone-50"
              >
                <span
                  className={`w-7 shrink-0 text-center text-lg font-bold ${
                    i < 3 ? (list === "red" ? "text-rose-600" : "text-stone-900") : "text-stone-400"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <TypeBadge type={r.subject.type} />
                    <span className="font-semibold">{r.subject.name}</span>
                    {r.subject.shopName && <span className="text-sm text-stone-500">@{r.subject.shopName}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-stone-500">
                    {r.entries} 条投稿 · {r.endorsements} 人{agree} · {r.comments} 条评论
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-stone-700">{r.score}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
