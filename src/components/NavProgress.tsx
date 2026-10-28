"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** A tap on a link that will load another page of this site (not a hash jump, not the current page, not another site). */
export function isPageNavigation(href: string, currentUrl: string): boolean {
  let target: URL;
  let current: URL;
  try {
    current = new URL(currentUrl);
    target = new URL(href, current);
  } catch {
    return false;
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") return false;
  if (target.origin !== current.origin) return false;
  return target.pathname + target.search !== current.pathname + current.search;
}

const MAX_MS = 8000;

/**
 * Thin bar at the top that starts moving the moment a link is tapped and finishes when the
 * new page is in. Pages loaded from history (back/forward) are instant, so no bar there.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest("a[href]");
      if (!a || a.getAttribute("target") === "_blank" || a.hasAttribute("download")) return;
      if (!isPageNavigation((a as HTMLAnchorElement).href, window.location.href)) return;
      setActive(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setActive(false), MAX_MS);
    };
    const onPop = () => setActive(false);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // the new page rendered: finish
  useEffect(() => {
    setActive(false);
    if (timer.current) window.clearTimeout(timer.current);
  }, [pathname, searchParams]);

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5" aria-hidden="true">
      <div className="h-full bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,.6)] animate-nav-progress" />
    </div>
  );
}
