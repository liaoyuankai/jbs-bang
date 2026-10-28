import Link from "next/link";
import { setCity } from "@/app/actions/city";
import { Chip, ChipRow } from "@/components/Chip";
import { CitySelect } from "@/components/CitySelect";
import { TypeBadge } from "@/components/Label";
import { config } from "@/lib/config";
import { getCurrentCity } from "@/lib/current-city";
import { getDb } from "@/lib/db";
import { rankSubjects, rankSubjectsNet } from "@/lib/repo/rank";
import { listCities } from "@/lib/repo/subjects";
import { isSubjectType, SUBJECT_TYPES, typeLabel, type ListKind, type SubjectType } from "@/lib/taxonomy";
import type { Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

const LIMIT = 50;

/** "net" is the 红 − 黑 board; red/black are the per-list heat boards. */
type Board = ListKind | "net";

function rankHref(p: { list: Board; type?: SubjectType }): string {
  const q = new URLSearchParams({ list: p.list });
  if (p.type) q.set("type", p.type);
  return `/rank?${q.toString()}`;
}

function SubjectName({ subject }: { subject: Subject }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TypeBadge type={subject.type} />
      <span className="font-semibold">{subject.name}</span>
      {subject.shopName && <span className="text-sm text-stone-500">@{subject.shopName}</span>}
    </div>
  );
}

export default async function RankPage({ searchParams }: { searchParams: Promise<{ list?: string; type?: string }> }) {
  const sp = await searchParams;
  const list: Board = sp.list === "red" ? "red" : sp.list === "net" ? "net" : "black";
  const typeParam: SubjectType | undefined = isSubjectType(sp.type) ? sp.type : undefined;
  // the net board is always one type at a time, so it falls back to the first type instead of 全部
  const type = list === "net" ? (typeParam ?? SUBJECT_TYPES[0]) : typeParam;
  const city = await getCurrentCity();
  const db = getDb();
  const cities = Array.from(new Set([config.defaultCity, ...listCities(db, { publicOnly: true })]));

  const boards: { list: Board; label: string; active: string }[] = [
    { list: "black", label: "黑榜热度", active: "bg-stone-900 text-white" },
    { list: "red", label: "红榜热度", active: "bg-rose-600 text-white" },
    { list: "net", label: "净分榜", active: "bg-white font-semibold text-stone-900" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-stone-200 p-1 text-[15px]">
          {boards.map((b) => (
            <Link
              key={b.list}
              href={rankHref({ list: b.list, type })}
              className={`rounded-md px-3 py-1.5 ${list === b.list ? b.active : "text-stone-700"}`}
            >
              {b.label}
            </Link>
          ))}
        </div>
        <form action={setCity} className="flex items-center text-[15px]">
          <input type="hidden" name="returnTo" value={rankHref({ list, type })} />
          <CitySelect cities={cities} value={city} />
        </form>
      </div>

      <ChipRow>
        {list !== "net" && (
          <Chip href={rankHref({ list })} active={!type}>
            全部
          </Chip>
        )}
        {SUBJECT_TYPES.map((t) => (
          <Chip key={t} href={rankHref({ list, type: t })} active={type === t}>
            {typeLabel(t)}
          </Chip>
        ))}
      </ChipRow>

      {list === "net" ? <NetBoard city={city} type={type!} /> : <HeatBoard city={city} list={list} type={type} />}
    </div>
  );
}

function NetBoard({ city, type }: { city: string; type: SubjectType }) {
  const rows = rankSubjectsNet(getDb(), { city, type });
  return (
    <>
      <p className="text-xs text-stone-500">
        净分 = 发红榜的人数 − 发黑榜的人数，只算公开中的投稿；同一个人给同一个对象发多条只算一次。净分相同时人数多的在前。全部列出。
      </p>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          {city} 还没有{typeLabel(type)}的投稿。
        </div>
      ) : (
        <ol className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {rows.map((r, i) => (
            <li key={r.subject.id}>
              <Link
                href={`/s/${r.subject.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 active:bg-stone-50"
              >
                <span className={`w-7 shrink-0 text-center text-lg font-bold ${i < 3 ? "text-stone-900" : "text-stone-400"}`}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <SubjectName subject={r.subject} />
                  <div className="mt-0.5 text-xs text-stone-500">
                    <span className="text-rose-600">红 {r.red} 人</span> · <span className="text-stone-900">黑 {r.black} 人</span>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-base font-bold ${
                    r.net > 0 ? "text-rose-600" : r.net < 0 ? "text-stone-900" : "text-stone-400"
                  }`}
                >
                  {r.net > 0 ? `+${r.net}` : r.net}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function HeatBoard({ city, list, type }: { city: string; list: ListKind; type?: SubjectType }) {
  const rows = rankSubjects(getDb(), { city, list, type, limit: LIMIT });
  const agree = list === "black" ? "我也遇到过" : "点了";
  return (
    <>
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
                  <SubjectName subject={r.subject} />
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
    </>
  );
}
