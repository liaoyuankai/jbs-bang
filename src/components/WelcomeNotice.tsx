"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { siteVoteAction, siteVoteStatusAction, type SiteVoteState } from "@/app/actions/site-vote";
import type { SiteVoteChoice } from "@/lib/repo/site-votes";

const SEEN_KEY = "jbs-welcome-seen";

/** The notice is for visitors; the admin pages never show it. */
export function showWelcomeNotice(pathname: string): boolean {
  return !(pathname === "/admin" || pathname.startsWith("/admin/"));
}

/** Shown once per browser (localStorage): what the site is, what can't be undone, and a 支持 / 不支持 vote. */
export function WelcomeNotice() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [vote, setVote] = useState<SiteVoteState | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!showWelcomeNotice(pathname)) return;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      // storage blocked: still show it, just once per page load
    }
    setOpen(true);
    siteVoteStatusAction().then(setVote, () => {});
    // decided once per page load; later navigations within the visit keep it closed
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setOpen(false);
  }

  function cast(choice: SiteVoteChoice) {
    startTransition(async () => {
      setVote(await siteVoteAction(choice));
    });
  }

  if (!open) return null;
  const mine = vote?.mine ?? null;
  const btn = (active: boolean) =>
    `flex-1 rounded-md border px-4 py-2.5 text-[15px] disabled:opacity-60 ${
      active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white hover:bg-stone-50"
    }`;

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
        <h2 id="welcome-title" className="text-lg font-bold">
          进站须知
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
          <li>本平台用于记录、存档玩家的真实经历。</li>
          <li>所有人都可以匿名发表，不需要注册。</li>
          <li>
            内容发布后<strong>无法修改，也无法删除</strong>；只有涉及人身攻击、辱骂、泄露隐私等情况，经举报后才会下架。
          </li>
          <li>
            有问题请翻到页面最下面点「
            <Link href="/feedback" onClick={close} className="underline">
              反馈
            </Link>
            」，直接告诉站长。
          </li>
        </ul>

        <div className="mt-4 rounded-lg bg-amber-50 p-4 text-[15px] leading-relaxed text-amber-950">
          <p>网站刚起步，制作不易，资源有限。如果你支持这个网站，能不能点个赞？支持的人多，后期会继续维护下去，维护所有玩家的权益。</p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={pending} onClick={() => cast("up")} className={btn(mine === "up")}>
              👍 支持{vote ? ` ${vote.up}` : ""}
            </button>
            <button type="button" disabled={pending} onClick={() => cast("down")} className={btn(mine === "down")}>
              不支持{vote ? ` ${vote.down}` : ""}
            </button>
          </div>
          {vote?.error && <p className="mt-2 text-sm text-red-700">{vote.error}</p>}
          {!vote?.error && mine === "up" && <p className="mt-2 text-sm">谢谢支持！</p>}
          {!vote?.error && mine === "down" && <p className="mt-2 text-sm">收到。哪里不满意，欢迎去「反馈」告诉站长。</p>}
        </div>

        <button type="button" onClick={close} className="mt-4 w-full rounded-md bg-stone-900 px-4 py-3 text-[17px] text-white">
          我知道了
        </button>
      </div>
    </div>
  );
}
