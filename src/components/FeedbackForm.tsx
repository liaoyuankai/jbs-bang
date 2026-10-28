"use client";

import { useActionState, useState } from "react";
import { feedbackAction } from "@/app/actions/feedback";
import { INITIAL_STATE } from "@/lib/action-state";

export function FeedbackForm() {
  const [state, formAction, pending] = useActionState(feedbackAction, INITIAL_STATE);
  const [body, setBody] = useState("");

  if (state.ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
        <p className="font-semibold">{state.message}</p>
        <p className="mt-1 text-sm">还有别的想说，刷新页面再写一条。</p>
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-3">
      <textarea
        name="body"
        required
        maxLength={2000}
        rows={7}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="哪里不好用、想要什么功能、发现了什么问题，都可以写。想收到回复就留个联系方式，只有站长能看到。"
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-2.5"
      />
      <div className="flex items-center justify-between text-xs text-stone-500">
        <span>不公开，不会出现在任何页面</span>
        <span>{[...body].length} / 2000</span>
      </div>
      {state.error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending || body.trim().length === 0}
        className="w-full rounded-md bg-stone-900 px-4 py-3 text-[17px] text-white disabled:opacity-40"
      >
        {pending ? "发送中…" : "发送给站长"}
      </button>
    </form>
  );
}
