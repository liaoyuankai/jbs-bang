import Link from "next/link";
import { config } from "@/lib/config";

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
        <Link href="/" className="text-lg font-bold tracking-tight">
          {config.siteName}
        </Link>
        <nav className="flex items-center gap-1 text-[15px]">
          <Link href="/" className="px-2 py-2 hover:underline">
            榜单
          </Link>
          <Link href="/rank" className="px-2 py-2 hover:underline">
            热度
          </Link>
          <Link href="/search" className="px-2 py-2 hover:underline">
            搜索
          </Link>
          <Link href="/submit" className="ml-1 rounded-md bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700">
            投稿
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-10 border-t border-stone-200 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] text-center text-xs text-stone-500 sm:pb-6">
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
        <Link href="/rules" className="hover:underline">
          社区规范
        </Link>
        <Link href="/transparency" className="hover:underline">
          透明度
        </Link>
        <Link href="/admin" className="hover:underline">
          管理
        </Link>
      </div>
      <p className="mt-2">内容即时公开，可举报，联系方式自动隐去，下架留痕。</p>
    </footer>
  );
}
