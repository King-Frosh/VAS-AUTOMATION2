"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { LoaderCircle, LogIn } from "lucide-react";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, { ok: false } as { ok: boolean; error?: string });

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
          {state.error}
        </div>
      )}
      <div>
        <label htmlFor="username" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          placeholder="admin"
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-navy-900 outline-none transition focus:border-gold-500 focus:bg-white focus:ring-4 focus:ring-gold-500/15"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••••"
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-navy-900 outline-none transition focus:border-gold-500 focus:bg-white focus:ring-4 focus:ring-gold-500/15"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="group flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 focus:outline-none focus:ring-4 focus:ring-navy-900/20 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4 text-gold-400 transition group-hover:translate-x-0.5" />}
        {pending ? "Signing in…" : "Sign in to Console"}
      </button>
    </form>
  );
}
