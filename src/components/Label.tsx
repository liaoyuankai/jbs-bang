import { labelTone, type ConfidenceLabel } from "@/lib/labels";

const TONE_CLASS: Record<ReturnType<typeof labelTone>, string> = {
  strong: "bg-amber-100 text-amber-900 border-amber-300",
  good: "bg-emerald-50 text-emerald-800 border-emerald-200",
  muted: "bg-stone-100 text-stone-500 border-stone-200",
  neutral: "bg-stone-50 text-stone-600 border-stone-200",
};

export function Label({ text }: { text: ConfidenceLabel }) {
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-xs leading-none ${TONE_CLASS[labelTone(text)]}`}>
      {text}
    </span>
  );
}

export function TypeBadge({ type }: { type: "shop" | "dm" | "player" }) {
  const map = {
    shop: ["店家", "bg-sky-50 text-sky-800 border-sky-200"],
    dm: ["DM", "bg-violet-50 text-violet-800 border-violet-200"],
    player: ["玩家", "bg-teal-50 text-teal-800 border-teal-200"],
  } as const;
  const [text, cls] = map[type];
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-xs leading-none ${cls}`}>{text}</span>;
}

export function ListBadge({ list }: { list: "red" | "black" }) {
  return list === "red" ? (
    <span className="inline-block rounded bg-rose-600 px-1.5 py-0.5 text-xs leading-none text-white">红榜</span>
  ) : (
    <span className="inline-block rounded bg-stone-800 px-1.5 py-0.5 text-xs leading-none text-white">黑榜</span>
  );
}
