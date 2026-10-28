import Link from "next/link";
import { config } from "@/lib/config";

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
        <Link href="/" className="min-w-0 truncate text-lg font-bold tracking-tight">
          {config.siteName}
        </Link>
        <nav className="flex shrink-0 items-center gap-0.5 text-[15px] whitespace-nowrap sm:gap-1">
          <Link href="/" className="px-1.5 py-2 hover:underline sm:px-2">
            榜单
          </Link>
          <Link href="/rank" className="px-1.5 py-2 hover:underline sm:px-2">
            热度
          </Link>
          <Link href="/search" className="px-1.5 py-2 hover:underline sm:px-2">
            搜索
          </Link>
          {/* 当事人着急时要一眼找到站长，所以放在每页顶栏；手机上投稿有右下角浮动按钮，顶栏让给它 */}
          <Link
            href="/feedback"
            className="ml-1 rounded-md border border-amber-500 bg-amber-50 px-2.5 py-1.5 font-medium text-amber-900 hover:bg-amber-100"
          >
            联系站长
          </Link>
          <Link href="/submit" className="ml-1 hidden rounded-md bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700 sm:inline-block">
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
        <Link href="/feedback" className="hover:underline">
          联系站长
        </Link>
        <Link href="/admin" className="hover:underline">
          管理
        </Link>
      </div>
      <p className="mt-2">内容即时公开，可举报，联系方式自动隐去，下架留痕。</p>
    </footer>
  );
}
