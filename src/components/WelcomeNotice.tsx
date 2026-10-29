"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MaintenanceNotice } from "@/components/MaintenanceNotice";

const DIALOG_FLAG = "__jbsDialog";

/** The notice is for visitors; the admin pages never show it. */
export function showWelcomeNotice(pathname: string): boolean {
  return !(pathname === "/admin" || pathname.startsWith("/admin/"));
}

/** The maintenance notice and volunteer call, shown on every page load (mounted only during maintenance). */
export function WelcomeNotice() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!showWelcomeNotice(pathname)) return;
    setOpen(true);
    // a history record for the dialog, so the webview's back button closes it instead of leaving the site
    if (window.history.state?.[DIALOG_FLAG] !== "welcome") {
      const { __jbsTrap: _trap, ...rest } = (window.history.state ?? {}) as Record<string, unknown>;
      window.history.pushState({ ...rest, [DIALOG_FLAG]: "welcome" }, "", window.location.href);
    }
    // decided once per page load; later navigations within the visit keep it closed
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onPop = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
    };
  }, [open]);

  function close() {
    if (window.history.state?.[DIALOG_FLAG] === "welcome") {
      window.history.back(); // pops our record; the popstate handler closes the dialog
      return;
    }
    setOpen(false);
  }

  function join() {
    if (pathname === "/feedback") return close();
    setOpen(false);
    // replace the dialog's history record, so back from 联系站长 returns to the page underneath
    router.replace("/feedback");
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 p-3 sm:items-center"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:pb-5"
      >
        <h2 id="welcome-title" className="mb-3 text-lg font-bold">
          网站维护中
        </h2>
        <MaintenanceNotice />

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={join} className="flex-1 rounded-md bg-stone-900 px-4 py-3 text-[17px] text-white">
            我想加入
          </button>
          <button type="button" onClick={close} className="flex-1 rounded-md border border-stone-300 bg-white px-4 py-3 text-[17px] hover:bg-stone-50">
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}
