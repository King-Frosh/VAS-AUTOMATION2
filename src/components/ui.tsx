import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

/* ---------------- Page header ---------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 anim-fade-up">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/* ---------------- Card ---------------- */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_3px_rgba(10,20,40,0.04),0_8px_24px_-12px_rgba(10,20,40,0.08)]", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h3 className="text-[14px] font-bold text-navy-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------------- Status badges ---------------- */

const STATUS_STYLES: Record<string, string> = {
  UNPROCESSED: "bg-slate-100 text-slate-600 ring-slate-300/60",
  PROCESSING: "bg-sky-50 text-sky-700 ring-sky-300/60",
  READY_FOR_REVIEW: "bg-indigo-50 text-indigo-700 ring-indigo-300/60",
  READY_TO_SEND: "bg-amber-50 text-amber-700 ring-amber-300/60",
  SENDING: "bg-sky-50 text-sky-700 ring-sky-300/60",
  SENT: "bg-emerald-50 text-emerald-700 ring-emerald-300/60",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-300/60",
  PARTIALLY_FAILED: "bg-orange-50 text-orange-700 ring-orange-300/60",
  SKIPPED: "bg-slate-100 text-slate-500 ring-slate-300/60",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-300/60",
  MATCHED: "bg-emerald-50 text-emerald-700 ring-emerald-300/60",
  UNMATCHED_PARTNER: "bg-rose-50 text-rose-700 ring-rose-300/60",
  UNMAPPED_SERVICE: "bg-orange-50 text-orange-700 ring-orange-300/60",
  AMBIGUOUS: "bg-violet-50 text-violet-700 ring-violet-300/60",
  INVALID: "bg-rose-50 text-rose-700 ring-rose-300/60",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-300/60",
  INACTIVE: "bg-slate-100 text-slate-500 ring-slate-300/60",
  AUTO: "bg-indigo-50 text-indigo-700 ring-indigo-300/60",
  MANUAL: "bg-slate-100 text-slate-600 ring-slate-300/60",
  BULK: "bg-sky-50 text-sky-700 ring-sky-300/60",
  RESEND: "bg-violet-50 text-violet-700 ring-violet-300/60",
  TEST: "bg-slate-100 text-slate-600 ring-slate-300/60",
  ADMIN: "bg-navy-900 text-gold-400 ring-navy-700",
  OPS: "bg-sky-50 text-sky-700 ring-sky-300/60",
  VIEWER: "bg-slate-100 text-slate-600 ring-slate-300/60",
};

const STATUS_DOT: Record<string, string> = {
  SENT: "bg-emerald-500",
  READY_TO_SEND: "bg-amber-500",
  SENDING: "bg-sky-500 anim-pulse-soft",
  FAILED: "bg-rose-500",
  PARTIALLY_FAILED: "bg-orange-500",
  MATCHED: "bg-emerald-500",
  UNMATCHED_PARTNER: "bg-rose-500",
  UNMAPPED_SERVICE: "bg-orange-500",
  AMBIGUOUS: "bg-violet-500",
  INVALID: "bg-rose-500",
  READY_FOR_REVIEW: "bg-indigo-500",
  PROCESSING: "bg-sky-500 anim-pulse-soft",
  PENDING: "bg-amber-500",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 ring-slate-300/60";
  const dot = STATUS_DOT[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", cls)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {(label ?? status).replace(/_/g, " ")}
    </span>
  );
}

/* ---------------- Stat card ---------------- */

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: "default" | "gold" | "success" | "danger" | "info";
}) {
  const tones = {
    default: "bg-navy-900 text-gold-400",
    gold: "bg-gradient-to-br from-gold-400 to-gold-600 text-navy-950",
    success: "bg-emerald-600 text-emerald-50",
    danger: "bg-rose-600 text-rose-50",
    info: "bg-sky-600 text-sky-50",
  };
  return (
    <Card className="p-5 anim-fade-up">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-1.5 font-display text-[30px] font-bold leading-none tracking-tight text-navy-900">{value}</p>
          {hint && <p className="mt-2 truncate text-[12px] text-slate-500">{hint}</p>}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&>svg]:h-[18px] [&>svg]:w-[18px]", tones[tone])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Table primitives ---------------- */

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500 first:pl-5 last:pr-5", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, title }: { children?: ReactNode; className?: string; title?: string }) {
  return <td title={title} className={cn("border-b border-slate-100 px-4 py-3 text-[13px] text-slate-700 first:pl-5 last:pr-5", className)}>{children}</td>;
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      <p className="text-[14px] font-bold text-navy-900">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- Buttons & fields ---------------- */

export function GoldButton({ href, children, onClick }: { href?: string; children: ReactNode; onClick?: () => void }) {
  const cls =
    "inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 px-4 py-2 text-[13px] font-bold text-navy-950 shadow-sm shadow-gold-600/30 transition hover:brightness-105 active:scale-[0.98] [&>svg]:h-4 [&>svg]:w-4";
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button onClick={onClick} className={cls}>{children}</button>;
}

export function inputCls(extra?: string) {
  return cn(
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-navy-900 outline-none transition placeholder:text-slate-400 focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15 disabled:bg-slate-50 disabled:text-slate-400",
    extra
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
