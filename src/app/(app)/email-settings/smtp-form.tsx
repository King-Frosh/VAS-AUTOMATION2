"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ServerCog, LoaderCircle, PlugZap, Send, ShieldCheck, CircleCheck, CircleAlert, KeyRound, Info,
} from "lucide-react";
import { Card, CardHeader, Field, inputCls, StatusBadge } from "@/components/ui";
import { saveSmtpSettings, testConnectionAction, sendTestEmailAction } from "@/app/actions/settings";
import { formatDateTime } from "@/lib/utils";

interface SmtpState {
  host: string;
  port: number;
  login: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
  security: string;
  testEmail: string;
  lastTestOk: boolean;
  lastTestedAt: string;
}

export default function SmtpForm({ initial }: { initial: SmtpState }) {
  const router = useRouter();
  const [form, setForm] = useState({
    host: initial.host,
    port: initial.port,
    login: initial.login,
    password: "",
    fromName: initial.fromName,
    fromEmail: initial.fromEmail,
    security: initial.security,
    testEmail: initial.testEmail,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [, refresh] = useTransition();

  const requiredFilled = form.host.trim() && form.port && form.login.trim() && (form.password.trim() || initial.hasPassword);

  async function save() {
    setSaving(true);
    const res = await saveSmtpSettings(form);
    setSaving(false);
    if (res.ok) {
      toast.success("SMTP settings saved. Connection test required before automatic sending.");
      setForm((f) => ({ ...f, password: "" }));
      refresh(() => router.refresh());
    } else toast.error(res.error ?? "Could not save settings.");
  }

  async function testConnection() {
    setTesting(true);
    const saveRes = await saveSmtpSettings(form);
    if (!saveRes.ok) {
      setTesting(false);
      toast.error(saveRes.error ?? "Save the settings first.");
      return;
    }
    const res = await testConnectionAction();
    setTesting(false);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    setForm((f) => ({ ...f, password: "" }));
    refresh(() => router.refresh());
  }

  async function sendTestEmail() {
    if (!form.testEmail.trim()) {
      toast.error("Enter a Test Email Address first.");
      return;
    }
    setSendingTest(true);
    const saveRes = await saveSmtpSettings(form);
    if (!saveRes.ok) {
      setSendingTest(false);
      toast.error(saveRes.error ?? "Save the settings first.");
      return;
    }
    const res = await sendTestEmailAction(form.testEmail);
    setSendingTest(false);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    setForm((f) => ({ ...f, password: "" }));
    refresh(() => router.refresh());
  }

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <Card className="anim-fade-up xl:col-span-3">
        <CardHeader
          title="SMTP provider connection"
          subtitle="Server, Port, Login and Password are mandatory — sender details follow your provider's policy."
          action={initial.lastTestOk ? <StatusBadge status="SENT" label="LAST TEST PASSED" /> : <StatusBadge status="PENDING" label="TEST REQUIRED" />}
        />
        <div className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
            <Field label="SMTP Server *" hint="Hostname supplied by your provider">
              <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} className={inputCls("font-mono")} placeholder="smtp.provider.com" />
            </Field>
            <Field label="Port *" hint="587 STARTTLS · 465 TLS">
              <input type="number" value={form.port} min={1} max={65535}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} className={inputCls("font-mono")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Login *" hint="SMTP username / authenticated account">
              <input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} className={inputCls("font-mono")} placeholder="vas@briccsintl.com" autoComplete="off" />
            </Field>
            <Field label="Password *" hint={initial.hasPassword ? "Stored encrypted — enter only to change" : "SMTP password or app credential"}>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={inputCls("pl-9 font-mono")} placeholder={initial.hasPassword ? "••••••••••••  (unchanged)" : "Enter SMTP password"} autoComplete="new-password" />
              </div>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Security" hint="Per provider instructions">
              <select value={form.security} onChange={(e) => setForm({ ...form, security: e.target.value })} className={inputCls()}>
                <option value="STARTTLS">STARTTLS (port 587)</option>
                <option value="TLS">Implicit TLS (port 465)</option>
                <option value="NONE">None (not recommended)</option>
              </select>
            </Field>
            <Field label="From Name">
              <input value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} className={inputCls()} placeholder="BRICCS International" />
            </Field>
            <Field label="From Email" hint="Authorized sender address">
              <input type="email" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} className={inputCls("font-mono")} placeholder="vas@briccsintl.com" />
            </Field>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={save} disabled={saving || !requiredFilled || !form.fromEmail.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-navy-800 disabled:opacity-40">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ServerCog className="h-4 w-4 text-gold-400" />}
              Save settings
            </button>
            <button onClick={testConnection} disabled={testing || !requiredFilled}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-navy-900 transition hover:bg-slate-50 disabled:opacity-40">
              {testing ? <LoaderCircle className="h-4 w-4 animate-spin text-gold-600" /> : <PlugZap className="h-4 w-4 text-gold-600" />}
              Test SMTP connection
            </button>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <Field label="Test Email Address" hint="A successful connection test alone does not prove delivery — send a real test message.">
              <div className="flex gap-2.5">
                <input type="email" value={form.testEmail} onChange={(e) => setForm({ ...form, testEmail: e.target.value })} className={inputCls("flex-1 font-mono")} placeholder="you@company.com" />
                <button onClick={sendTestEmail} disabled={sendingTest || !requiredFilled || !form.fromEmail.trim()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 px-4 py-2 text-[13px] font-bold text-navy-950 transition hover:brightness-105 disabled:opacity-40">
                  {sendingTest ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send test email
                </button>
              </div>
            </Field>
          </div>
        </div>
      </Card>

      <div className="space-y-5 xl:col-span-2">
        <Card className="anim-fade-up p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900">
              <ShieldCheck className="h-5 w-5 text-gold-400" strokeWidth={1.7} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-navy-900">Credential security</h3>
              <p className="text-[12px] text-slate-500">How the console protects your SMTP secrets</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2.5 text-[12.5px] leading-relaxed text-slate-600">
            {[
              "Password is encrypted server-side (AES-256-GCM) and never returned to the browser, API responses or audit logs.",
              "The field above stays masked; enter a value only when rotating credentials.",
              "STARTTLS / TLS is enforced according to the security mode you select.",
              "SMTP authentication credentials are never written to delivery or audit records.",
              "Changes are restricted to Administrator accounts.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                {t}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="anim-fade-up p-6">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-navy-600" />
            <div className="text-[12.5px] leading-relaxed text-slate-600">
              <p className="font-bold text-navy-900">Port & encryption guidance</p>
              <p className="mt-1">Most providers use <b className="font-mono">587</b> with STARTTLS or <b className="font-mono">465</b> with implicit TLS — follow your provider&apos;s exact instructions rather than assuming defaults. If outbound SMTP is blocked by your hosting environment, switch to a provider-supported mail relay or API and update these settings.</p>
              {initial.lastTestedAt && (
                <p className={`mt-2 flex items-center gap-1.5 font-semibold ${initial.lastTestOk ? "text-emerald-700" : "text-amber-700"}`}>
                  {initial.lastTestOk ? <CircleCheck className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
                  Last test: {formatDateTime(initial.lastTestedAt)} — {initial.lastTestOk ? "passed" : "failed"}
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
