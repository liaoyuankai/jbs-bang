import Link from "next/link";

export default async function SubmitDonePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const entryId = id && /^[0-9a-f]{16}$/.test(id) ? id : null;
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
      <h1 className="text-xl font-bold">已发布</h1>
      <p className="mt-2 text-sm text-stone-600">
        内容已经公开，联系方式已自动隐去。被举报且查实的内容会下架并留痕。
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
        {entryId && (
          <Link href={`/e/${entryId}`} className="rounded-md bg-stone-900 px-4 py-2 text-white">
            查看这条
          </Link>
        )}
        <Link href="/" className="rounded-md border border-stone-300 px-4 py-2">
          回首页
        </Link>
        <Link href="/submit" className="rounded-md border border-stone-300 px-4 py-2">
          再写一条
        </Link>
      </div>
    </div>
  );
}
