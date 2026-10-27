import { endorseAction } from "@/app/actions/endorse";

export function EndorseButton({
  entryId,
  list,
  count,
  done,
}: {
  entryId: string;
  list: "red" | "black";
  count: number;
  done: boolean;
}) {
  const label = list === "black" ? "我也遇到过" : "点了";
  return (
    <form action={endorseAction.bind(null, entryId)}>
      <button
        type="submit"
        disabled={done}
        className={`rounded border px-3 py-1.5 text-sm ${
          done ? "border-stone-200 bg-stone-100 text-stone-500" : "border-stone-300 bg-white hover:bg-stone-50"
        }`}
      >
        {done ? `已${label}` : label} {count}
      </button>
    </form>
  );
}
