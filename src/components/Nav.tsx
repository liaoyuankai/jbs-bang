import Link from "next/link";
import { config } from "@/lib/config";

export function Nav() {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          {config.siteName}
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/?list=red" className="text-rose-700 hover:underline">
            红榜
          </Link>
          <Link href="/?list=black" className="text-stone-800 hover:underline">
            黑榜
          </Link>
          <Link href="/search" className="hover:underline">
            搜索
          </Link>
          <Link
            href="/submit"
            className="rounded bg-stone-900 px-2.5 py-1 text-white hover:bg-stone-700"
          >
            投稿
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-10 border-t border-stone-200 py-6 text-center text-xs text-stone-500">
      <div className="flex flex-wrap justify-center gap-4">
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
      <p className="mt-2">所有内容先审后发，联系方式自动隐去，下架留痕。</p>
    </footer>
  );
}
