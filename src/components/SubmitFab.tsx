"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The floating 投稿 button is for browsing pages on phones; it stays off the submit flow and the admin. */
export function showSubmitFab(pathname: string): boolean {
  return !(
    pathname === "/submit" ||
    pathname.startsWith("/submit/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

export function SubmitFab() {
  const pathname = usePathname();
  if (!showSubmitFab(pathname)) return null;
  return (
    <Link
      href="/submit"
      className="fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-30 rounded-full bg-stone-900 px-5 py-3 text-[15px] font-medium text-white shadow-lg shadow-stone-900/30 active:bg-stone-700 sm:hidden"
    >
      ＋ 写一条
    </Link>
  );
}
