import Link from "next/link";

/** One filter pill. */
export function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 ${
        active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-700"
      }`}
    >
      {children}
    </Link>
  );
}

/** A row of pills that scrolls sideways on narrow screens instead of wrapping. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 flex gap-2 overflow-x-auto px-4 text-sm [scrollbar-width:none]">{children}</div>;
}
