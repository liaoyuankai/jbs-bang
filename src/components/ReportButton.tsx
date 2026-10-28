"use client";

import { useActionState, useState } from "react";
import { reportAction } from "@/app/actions/report";
import { INITIAL_STATE } from "@/lib/action-state";
import { REPORT_REASONS, type ReportTargetKind } from "@/lib/reports";

export function ReportButton({ targetKind, targetId }: { targetKind: ReportTargetKind; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reportAction, INITIAL_STATE);

  if (state.ok) return <span className="text-xs text-stone-500">{state.message}</span>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="py-1 text-xs text-stone-400 hover:underline">
        举报
      </button>
    );
  }
  return (
    <form action={formAction} className="flex basis-full flex-wrap items-center gap-2 rounded-md border border-stone-200 bg-stone-50 p-2 text-sm">
      <input type="hidden" name="targetKind" value={targetKind} />
      <input type="hidden" name="targetId" value={targetId} />
      <select name="reason" required className="basis-full rounded-md border border-stone-300 bg-white px-2 py-1.5 sm:basis-auto">
        {REPORT_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <input
        name="detail"
        maxLength={200}
        placeholder="补充说明（可不填）"
        className="min-w-0 basis-full rounded-md border border-stone-300 bg-white px-2 py-1.5 sm:flex-1 sm:basis-auto"
      />
      <button type="submit" disabled={pending} className="rounded-md bg-stone-900 px-3 py-1.5 text-white disabled:opacity-50">
        {pending ? "提交中…" : "提交举报"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-1 py-1 text-stone-500">
        取消
      </button>
      {state.error && <span className="basis-full text-red-700">{state.error}</span>}
    </form>
  );
}
