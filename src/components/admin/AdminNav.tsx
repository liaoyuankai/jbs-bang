import Link from "next/link";
import { logoutAction } from "@/app/actions/admin";

function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{n}</span>;
}

export function AdminNav({
  active,
  msg,
  openReports = 0,
  openFeedback = 0,
}: {
  active: "reports" | "feedback" | "entries" | "subjects";
  msg?: string;
  openReports?: number;
  openFeedback?: number;
}) {
  const cls = (k: string) =>
    `rounded-md px-3 py-2 text-[15px] ${active === k ? "bg-stone-900 text-white" : "bg-white border border-stone-300"}`;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin" className={cls("reports")}>
          举报
          <Count n={openReports} />
        </Link>
        <Link href="/admin/feedback" className={cls("feedback")}>
          反馈
          <Count n={openFeedback} />
        </Link>
        <Link href="/admin/entries" className={cls("entries")}>
          公开中
        </Link>
        <Link href="/admin/subjects" className={cls("subjects")}>
          对象
        </Link>
        <Link href="/" className="px-1 py-2 text-sm underline">
          回站点
        </Link>
        <form action={logoutAction} className="ml-auto">
          <button type="submit" className="px-1 py-2 text-sm text-stone-500 underline">
            退出
          </button>
        </form>
      </div>
      {msg && <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">{msg}</p>}
    </div>
  );
}
