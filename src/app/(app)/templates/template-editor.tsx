"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, LoaderCircle, RotateCcw, PenLine, Eye, CircleAlert, CircleCheck, FlaskConical } from "lucide-react";
import { Card, CardHeader, Field, inputCls } from "@/components/ui";
import { PLACEHOLDER_HELP } from "@/lib/templates";
import { saveTemplate, restoreDefaultTemplate } from "@/app/actions/settings";

const SAMPLE = {
  partnerEmail: "settlement@partnerone.com",
  partnerName: "Partner One Ltd",
  serviceName: "GAMEZONE",
  startDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
  endDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
};

function renderClient(t: string, s: typeof SAMPLE): string {
  const fmt = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  return t
    .split("{{partner_mail address}}").join(s.partnerEmail)
    .split("{{partner_mail_address}}").join(s.partnerEmail)
    .split("{{partner_email}}").join(s.partnerEmail)
    .split("{{SERVICE_NAME}}").join(s.serviceName)
    .split("{{service_name}}").join(s.serviceName)
    .split("{{start_date}}").join(fmt(s.startDate))
    .split("{{end_date}}").join(fmt(s.endDate))
    .split("{{partner_name}}").join(s.partnerName);
}

export default function TemplateEditor({
  initial,
  defaultSubject,
  defaultBody,
  canEdit,
}: {
  initial: { subject: string; body: string; updatedBy: string; updatedAt: string };
  defaultSubject: string;
  defaultBody: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [, refresh] = useTransition();

  const renderedSubject = useMemo(() => renderClient(subject, SAMPLE), [subject]);
  const renderedBody = useMemo(() => renderClient(body, SAMPLE), [body]);
  const unresolved = useMemo(() => {
    const m = `${renderedSubject} ${renderedBody}`.match(/\{\{[^}]+\}\}/g);
    return m ? Array.from(new Set(m)) : [];
  }, [renderedSubject, renderedBody]);

  async function save() {
    setSaving(true);
    const res = await saveTemplate(subject, body);
    setSaving(false);
    if (res.ok) {
      toast.success("Template saved. Future sends will use this version — history keeps its own snapshots.");
      refresh(() => router.refresh());
    } else toast.error(res.error ?? "Could not save the template.");
  }

  async function restore() {
    if (!confirm("Restore the specification default subject and body? Your current edits will be replaced.")) return;
    setRestoring(true);
    await restoreDefaultTemplate();
    setRestoring(false);
    setSubject(defaultSubject);
    setBody(defaultBody);
    toast.success("Default template restored.");
    refresh(() => router.refresh());
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="anim-fade-up">
        <CardHeader
          title="Template editor"
          subtitle={initial.updatedAt ? `Last edited ${initial.updatedAt} by ${initial.updatedBy}` : "Specification defaults loaded"}
          action={
            canEdit ? (
              <button onClick={restore} disabled={restoring}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-navy-900 transition hover:bg-slate-50 disabled:opacity-50">
                {restoring ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 text-gold-600" />}
                Restore default
              </button>
            ) : undefined
          }
        />
        <div className="space-y-4 p-6">
          <Field label="Subject template">
            <div className="relative">
              <PenLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!canEdit}
                className={inputCls("pl-9 font-semibold")} />
            </div>
          </Field>
          <Field label="Body template">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={!canEdit} rows={12}
              className={inputCls("font-mono text-[12.5px] leading-relaxed")} />
          </Field>
          {canEdit && (
            <button onClick={save} disabled={saving || !subject.trim() || !body.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-navy-800 disabled:opacity-40">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-gold-400" />}
              Save template
            </button>
          )}
        </div>
      </Card>

      <div className="space-y-5">
        <Card className="anim-fade-up">
          <CardHeader title="Live preview with sample values" subtitle="Exactly what the partner would receive" action={<Eye className="h-4 w-4 text-slate-300" />} />
          <div className="p-6">
            {unresolved.length > 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3.5 py-2.5 text-[12px] font-semibold text-rose-700">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Unresolved placeholders will block sending: {unresolved.join(", ")}
              </div>
            )}
            {unresolved.length === 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2 text-[12px] font-semibold text-emerald-700">
                <CircleCheck className="h-4 w-4" /> All placeholders resolve cleanly with sample values.
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Subject</p>
                <p className="mt-0.5 text-[13.5px] font-semibold text-navy-900">{renderedSubject}</p>
              </div>
              <pre className="whitespace-pre-wrap px-4 py-3.5 font-sans text-[13px] leading-relaxed text-slate-700">{renderedBody}</pre>
              <div className="border-t border-slate-100 px-4 py-2.5 font-mono text-[10.5px] text-slate-400">
                Attachment: BRICCS_VAS_Report_PARTNER01_{SAMPLE.serviceName}_{SAMPLE.startDate}_{SAMPLE.endDate}.xlsx
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-400">
              <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Sample values: {SAMPLE.partnerEmail} · {SAMPLE.serviceName} · {SAMPLE.startDate} to {SAMPLE.endDate}
            </div>
          </div>
        </Card>

        <Card className="anim-fade-up p-6">
          <h3 className="text-[13px] font-bold text-navy-900">Available placeholders</h3>
          <div className="mt-3 space-y-2">
            {PLACEHOLDER_HELP.map((p) => (
              <div key={p.token} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <code className="shrink-0 font-mono text-[11px] font-bold text-navy-800">{p.token}</code>
                <span className="text-right text-[11px] leading-snug text-slate-500">{p.desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Template edits apply to future sends only. Every historical delivery keeps the exact subject and body that was transmitted.
          </p>
        </Card>
      </div>
    </div>
  );
}
