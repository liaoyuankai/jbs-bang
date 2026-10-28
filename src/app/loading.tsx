/** Shown while the next page is being fetched: the shape of a list page, so the screen never looks frozen. */
export default function Loading() {
  return (
    <div className="space-y-3 animate-pulse" data-loading-skeleton aria-busy="true" aria-label="加载中">
      <div className="flex items-center justify-between">
        <div className="h-9 w-40 rounded-lg bg-stone-200" />
        <div className="h-9 w-20 rounded-md bg-stone-200" />
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex gap-2">
            <div className="h-5 w-10 rounded bg-stone-200" />
            <div className="h-5 w-12 rounded bg-stone-200" />
            <div className="h-5 w-24 rounded bg-stone-200" />
          </div>
          <div className="mt-3 h-4 w-full rounded bg-stone-100" />
          <div className="mt-2 h-4 w-5/6 rounded bg-stone-100" />
          <div className="mt-3 h-3 w-1/3 rounded bg-stone-100" />
        </div>
      ))}
    </div>
  );
}
