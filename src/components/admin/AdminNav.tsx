import Link from "next/link";
import { logoutAction } from "@/app/actions/admin";

export function AdminNav({ active, msg }: { active: "queue" | "entries" | "subjects"; msg?: string }) {
  const cls = (k: string) =>
    `rounded-md px-3 py-2 text-[15px] ${active === k ? "bg-stone-900 text-white" : "bg-white border border-stone-300"}`;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin" className={cls("queue")}>
          待审
        </Link>
        <Link href="/admin/entries" className={cls("entries")}>
          已公开
        </Link>
        <Link href="/admin/subjects" className={cls("subjects")}>
          对象
        </Link>
        <Link href="/" className="text-sm underline">
          回站点
        </Link>
        <form action={logoutAction} className="ml-auto">
          <button type="submit" className="text-sm text-stone-500 underline">
            退出
          </button>
        </form>
      </div>
      {msg && <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">{msg}</p>}
    </div>
  );
}
