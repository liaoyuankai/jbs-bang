import Link from "next/link";
import type { Subject } from "@/lib/types";
import { TypeBadge } from "./Label";

export function SubjectHeader({
  subject,
  redCount,
  blackCount,
}: {
  subject: Subject;
  redCount: number;
  blackCount: number;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={subject.type} />
        <h1 className="text-xl font-bold">{subject.name}</h1>
        {subject.shopName && <span className="text-stone-500">@{subject.shopName}</span>}
        <span className="text-sm text-stone-500">{subject.city}</span>
      </div>
      {subject.aliases.length > 0 && (
        <p className="mt-1 text-sm text-stone-500">别名：{subject.aliases.join("、")}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-rose-700">红榜 {redCount}</span>
        <span className="text-stone-800">黑榜 {blackCount}</span>
        <Link
          href={`/submit?subject=${subject.id}`}
          className="ml-auto rounded-md bg-stone-900 px-4 py-2 text-white hover:bg-stone-700"
        >
          写一条
        </Link>
        <a href="#respond" className="rounded-md border border-stone-300 bg-white px-4 py-2 hover:bg-stone-50">
          我是当事人
        </a>
      </div>
    </section>
  );
}
