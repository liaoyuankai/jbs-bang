import Link from "next/link";

export default function SubmitDonePage() {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
      <h1 className="text-xl font-bold">已提交，等待审核</h1>
      <p className="mt-2 text-sm text-stone-600">
        审核通常在一天内完成。通过后会出现在对应的榜单和对象页，联系方式会被自动隐去。
      </p>
      <div className="mt-5 flex justify-center gap-3 text-sm">
        <Link href="/" className="rounded bg-stone-900 px-4 py-2 text-white">
          回首页
        </Link>
        <Link href="/submit" className="rounded border border-stone-300 px-4 py-2">
          再写一条
        </Link>
      </div>
    </div>
  );
}
