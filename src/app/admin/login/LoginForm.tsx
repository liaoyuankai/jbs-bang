"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/admin";
import { INITIAL_STATE } from "@/lib/action-state";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <input
        type="password"
        name="password"
        required
        autoFocus
        placeholder="管理口令"
        className="w-full rounded border border-stone-300 bg-white px-3 py-2"
      />
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "登录中…" : "登录"}
      </button>
    </form>
  );
}
