import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ensureDefaults } from "@/lib/seed";
import LoginForm from "./login-form";
import BriccsLogo from "@/components/briccs-logo";
import { ShieldCheck, FileSpreadsheet, Send, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureDefaults();
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-[52%] overflow-hidden bg-navy-950 lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1000px 600px at 15% -10%, rgba(49,84,159,0.35), transparent 60%), radial-gradient(800px 500px at 90% 110%, rgba(201,162,39,0.14), transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3 anim-fade-up">
            <BriccsLogo width={44} square className="h-11 w-11 rounded-lg bg-white/5" />
            <div className="min-w-0">
              <p className="font-display text-[12px] font-bold leading-tight tracking-wide text-white">BRICCS INTERNATIONAL IDEAL LIMITED</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-400">VAS Revenue Console</p>
            </div>
          </div>

          <div className="max-w-md space-y-8">
            <div className="space-y-4 anim-fade-up" style={{ animationDelay: "0.1s" }}>
              <h1 className="font-display text-[42px] font-bold leading-[1.08] text-white">
                VAS Revenue
                <br />
                <span className="gold-text">Console</span>
              </h1>
              <p className="text-[15px] leading-relaxed text-slate-400">
                Automated processing and distribution of MTN unreconciled VAS transaction logs — partner-specific Excel
                reports, validated workbooks, and secure SMTP delivery.
              </p>
            </div>
            <div className="space-y-3 stagger">
              {[
                { icon: FileSpreadsheet, text: "One validated workbook per partner & service — sheet \"Unreconciled Logs\"" },
                { icon: Send, text: "Manual, bulk and scheduled daily, weekly or monthly distribution" },
                { icon: ShieldCheck, text: "Placeholder-safe templates with mandatory attachment checks" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 backdrop-blur-sm">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" strokeWidth={1.8} />
                  <p className="text-[13px] leading-snug text-slate-300">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            &copy; {new Date().getFullYear()} BRICCS International Ideal Limited. All partner financial data is access-controlled.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] anim-scale-in">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BriccsLogo width={44} square className="h-11 w-11 rounded-lg bg-white/5" />
            <div className="min-w-0">
              <p className="font-display text-[11px] font-bold leading-tight tracking-wide text-white">BRICCS INTERNATIONAL IDEAL LIMITED</p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-gold-400">VAS Revenue Console</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_24px_60px_-24px_rgba(10,20,40,0.25)]">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-900">
                <Lock className="h-[18px] w-[18px] text-gold-400" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-navy-900">Administrator Sign-in</h2>
                <p className="text-xs text-slate-500">Protected access to the revenue console</p>
              </div>
            </div>
            <LoginForm />
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
            Default credentials: <span className="font-mono text-slate-500">admin / BRICCS@2026</span>
            <br />
            Change them under System Settings after your first sign-in.
          </p>
        </div>
      </div>
    </main>
  );
}
