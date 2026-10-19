"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock, LoaderCircle, Save, Play, ShieldAlert, Terminal, ToggleLeft, ToggleRight,
  CircleCheck, Users, Info,
} from "lucide-react";
import { Card, CardHeader, Field, inputCls, StatusBadge } from "@/components/ui";
import { saveAutomation, runAutomationNow } from "@/app/actions/settings";
import { formatDateTime } from "@/lib/utils";

interface AutoState {
  enabled: boolean;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  timeOfDay: string;
  timezone: string;
  lastRunAt: string;
  nextRunAt: string;
  lastResult: string;
}

const PERIOD_HINT: Record<string, string> = {
  DAILY: "Covers the previous calendar day in the selected timezone (e.g. run on Oct 11 → reports Oct 10).",
  WEEKLY: "Covers the previous Monday–Sunday week in the selected timezone.",
  MONTHLY: "Covers the previous calendar month (1st → last day).",
};

export default function AutomationForm({
  initial,
  smtpReady,
  smtpTested,
  autoPartnerNames,
  activePartnerCount,
}: {
  initial: AutoState;
  smtpReady: boolean;
  smtpTested: boolean;
  autoPartnerNames: string[];
  activePartnerCount: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ enabled: initial.enabled, frequency: initial.frequency, timeOfDay: initial.timeOfDay, timezone: initial.timezone });
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [, refresh] = useTransition();

  const canEnable = smtpReady && smtpTested;

  async function save() {
    setSaving(true);
    const res = await saveAutomation(form);
    setSaving(false);
    if (res.ok) {
      toast.success(form.enabled ? "Automation enabled and next run scheduled." : "Automation settings saved (disabled).");
      refresh(() => router.refresh());
    } else toast.error(res.error ?? "Could not save automation settings.");
  }

  async function runNow() {
    if (!confirm("Run the automated distribution now? Reports will be generated for the resolved period and emailed to partners with automatic delivery enabled.")) return;
    setRunning(true);
    const res = await runAutomationNow();
    setRunning(false);
    if (res.ok) toast.success(res.message);
    else toast.warning(res.message);
    refresh(() => router.refresh());
  }

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <Card className="anim-fade-up xl:col-span-3">
        <CardHeader
          title="Schedule configuration"
          subtitle="The scheduler runs server-side — no browser window needs to stay open."
          action={initial.enabled ? <StatusBadge status="ACTIVE" label="AUTOMATION ON" /> : <StatusBadge status="INACTIVE" label="AUTOMATION OFF" />}
        />
        <div className="space-y-5 p-6">
          {form.enabled && !canEnable && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-[12.5px] font-semibold text-amber-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Automatic sending requires a fully configured and successfully tested SMTP connection. Save will be blocked until then.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Frequency">
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as typeof form.frequency })} className={inputCls()}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </Field>
            <Field label="Time of day" hint="24-hour format">
              <input type="time" value={form.timeOfDay} onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })} className={inputCls("font-mono")} />
            </Field>
            <Field label="Timezone">
              <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={inputCls()}>
                <option value="Africa/Lagos">Africa/Lagos (UTC+1)</option>
                <option value="UTC">UTC</option>
                <option value="Africa/Accra">Africa/Accra</option>
                <option value="Africa/Nairobi">Africa/Nairobi</option>
              </select>
            </Field>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-4 py-3 text-[12.5px] leading-relaxed text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-navy-600" />
            <span><b>Resolved period:</b> {PERIOD_HINT[form.frequency]} The period is always explicit — the console never silently assumes a range.</span>
          </div>

          <button type="button" onClick={() => setForm({ ...form, enabled: !form.enabled })}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3.5 transition hover:border-slate-300">
            <span className="text-left">
              <span className="block text-[13px] font-bold text-navy-900">Automatic report delivery</span>
              <span className="block text-[11.5px] text-slate-500">
                {canEnable ? "Generate workbooks and email eligible partners on schedule" : "Unlock by configuring & testing SMTP under Email Settings"}
              </span>
            </span>
            {form.enabled ? <ToggleRight className="h-6 w-6 text-gold-600" /> : <ToggleLeft className="h-6 w-6 text-slate-300" />}
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={save} disabled={saving || (form.enabled && !canEnable)}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-navy-800 disabled:opacity-40">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-gold-400" />}
              Save automation settings
            </button>
            <button onClick={runNow} disabled={running || !smtpReady}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 px-4 py-2 text-[13px] font-bold text-navy-950 transition hover:brightness-105 disabled:opacity-40">
              {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Running distribution…" : "Run automation now"}
            </button>
          </div>
        </div>
      </Card>

      <div className="space-y-5 xl:col-span-2">
        <Card className="anim-fade-up p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900">
              <CalendarClock className="h-5 w-5 text-gold-400" strokeWidth={1.7} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-navy-900">Execution status</h3>
              <p className="text-[12px] text-slate-500">Last and next automatic run</p>
            </div>
          </div>
          <dl className="mt-4 space-y-3 text-[12.5px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="font-semibold text-slate-500">Next scheduled run</dt>
              <dd className="font-mono font-bold text-navy-900">{initial.nextRunAt ? formatDateTime(initial.nextRunAt) : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="font-semibold text-slate-500">Last run</dt>
              <dd className="font-mono text-navy-900">{initial.lastRunAt ? formatDateTime(initial.lastRunAt) : "Never"}</dd>
            </div>
            {initial.lastResult && (
              <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-slate-600">
                <span className="font-bold text-slate-500">Last result:</span> {initial.lastResult}
              </div>
            )}
          </dl>
        </Card>

        <Card className="anim-fade-up p-6">
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-gold-600" />
            <h3 className="text-[13px] font-bold text-navy-900">Auto-delivery partners</h3>
          </div>
          <p className="mt-1 text-[11.5px] text-slate-500">{autoPartnerNames.length} of {activePartnerCount} active partners receive scheduled emails.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {autoPartnerNames.length === 0 && (
              <span className="text-[12px] text-slate-400">None yet — enable auto delivery per partner in the Partner Register.</span>
            )}
            {autoPartnerNames.map((n) => (
              <span key={n} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-300/60">
                <CircleCheck className="h-3 w-3" /> {n}
              </span>
            ))}
          </div>
        </Card>

        <Card className="anim-fade-up p-6">
          <div className="flex items-center gap-2.5">
            <Terminal className="h-4 w-4 text-navy-600" />
            <h3 className="text-[13px] font-bold text-navy-900">External scheduler hook</h3>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
            Point any cron service (system cron, cron-job.org, platform scheduler) at the tick endpoint every few minutes. It executes the run only when the schedule is due — overlapping executions cannot re-send a delivered report (idempotent claims).
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-navy-950 px-3.5 py-3 font-mono text-[11px] leading-relaxed text-slate-300">
{"# every 5 minutes\n*/5 * * * * curl -fsS \\\n  -H \"x-cron-secret: $CRON_SECRET\" \\\n  https://your-host/api/cron/tick"}
          </pre>
        </Card>
      </div>
    </div>
  );
}
