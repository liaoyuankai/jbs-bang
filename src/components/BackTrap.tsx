"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const NAV_KEY = "jbs-nav-seen";
export const TRAP_FLAG = "__jbsTrap";
// module-level so a double-mounted effect (React strict mode) still re-attaches the listener
let armed = false;

/**
 * Someone who lands on an inner page from a shared link has nothing to go back to, so the
 * webview's back button leaves the site. Add one history record on that first page; the
 * first "back" lands on it and we send them to the home page instead of out of the site.
 * Pages reached by browsing inside the site are untouched: back works as usual there.
 * Must be mounted before any dialog that pushes its own record, so the trap sits beneath it.
 */
export function BackTrap() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/" || pathname.startsWith("/admin")) return;
    if (!armed) {
      try {
        if (sessionStorage.getItem(NAV_KEY)) return; // not the first page of this visit
        sessionStorage.setItem(NAV_KEY, "1");
      } catch {
        return;
      }
      window.history.pushState({ ...window.history.state, [TRAP_FLAG]: true }, "", window.location.href);
      armed = true;
    }
    const onPop = () => {
      // back onto the trap record itself (returning from deeper pages, or closing a dialog): nothing to do
      if (window.history.state?.[TRAP_FLAG]) return;
      // back onto the page's original record: the next back would leave the site, go home instead
      window.removeEventListener("popstate", onPop);
      window.location.replace("/");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // runs once per page load; later client-side navigations keep their own history
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
