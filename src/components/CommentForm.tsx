"use client";

import { useActionState } from "react";
import { createCommentAction, createResponseAction } from "@/app/actions/comments";
import { INITIAL_STATE } from "@/lib/action-state";

function Form({
  action,
  hidden,
  placeholder,
  submitLabel,
}: {
  action: typeof createCommentAction;
  hidden: Record<string, string>;
  placeholder: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  return (
    <form action={formAction} className="mt-3 space-y-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <textarea
        name="body"
        required
        minLength={2}
        maxLength={1000}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-2"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-stone-900 px-4 py-2 text-[15px] text-white disabled:opacity-50"
        >
          {pending ? "提交中…" : submitLabel}
        </button>
        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-700">{state.message}</span>}
      </div>
    </form>
  );
}

export function CommentForm({ entryId }: { entryId: string }) {
  return (
    <Form
      action={createCommentAction}
      hidden={{ entryId }}
      placeholder="写评论。不要写联系方式。"
      submitLabel="提交评论"
    />
  );
}

export function ResponseForm({ subjectId }: { subjectId: string }) {
  return (
    <Form
      action={createResponseAction}
      hidden={{ subjectId }}
      placeholder="说明事情经过，会置顶显示在本页。"
      submitLabel="提交回应"
    />
  );
}
