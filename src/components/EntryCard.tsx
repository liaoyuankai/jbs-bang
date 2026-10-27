import Link from "next/link";
import type { ConfidenceLabel } from "@/lib/labels";
import type { EntryWithSubject } from "@/lib/types";
import { excerpt, fmtDate } from "@/lib/format";
import { shortVid } from "@/lib/visitor";
import { Label, ListBadge, TypeBadge } from "./Label";

export function EntryCard({
  entry,
  label,
  endorseCount,
  showSubject = true,
}: {
  entry: EntryWithSubject;
  label: ConfidenceLabel;
  endorseCount: number;
  showSubject?: boolean;
}) {
  const s = entry.subject;
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ListBadge list={entry.list} />
        {showSubject && (
          <>
            <TypeBadge type={s.type} />
            <Link href={`/s/${s.id}`} className="font-semibold hover:underline">
              {s.name}
            </Link>
            {s.shopName && <span className="text-stone-500">@{s.shopName}</span>}
          </>
        )}
        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">{entry.category}</span>
        <Label text={label} />
      </div>
      <Link href={`/e/${entry.id}`} className="mt-2 block whitespace-pre-wrap text-[15px] leading-relaxed hover:text-stone-700">
        {excerpt(entry.body, 140)}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
        <span>{entry.source === "import" ? "表格存档" : shortVid(entry.vid)}</span>
        {entry.occurredAt && <span>发生于 {entry.occurredAt}</span>}
        <span>{fmtDate(entry.createdAt)}</span>
        {entry.evidenceCount > 0 && <span>附证据 {entry.evidenceCount} 张</span>}
        <span className="ml-auto">
          {entry.list === "black" ? "我也遇到过" : "点了"} {endorseCount}
        </span>
      </div>
    </article>
  );
}
