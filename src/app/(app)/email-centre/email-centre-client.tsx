"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Send, SendHorizonal, LoaderCircle, Eye, X, Paperclip, CircleAlert,
  FileSpreadsheet, RotateCcw, Mail,
} from "lucide-react";
import { StatusBadge, Th, Td } from "@/components/ui";
import { formatInt, formatMoney } from "@/lib/utils";
import { sendSingleReport, bulkSendReports, previewReportEmail, type EmailPreview } from "@/app/actions/emails";
import { cn } from "@/lib/utils";

export interface CentreReport {
  id: string;
  partnerName: string;
  serviceName: string;
  serviceId: string;
  startDate: string;
  endDate: string;
  recordCount: number;
  totalRevenue: string;
  filename: string;
  fileSize: number;
  status: string;
  lastError: string;
  recipient: string;
  hasRecipient: boolean;
  sendable: boolean;
}

export default function EmailCentreClient({ reports, canSend }: { reports: CentreReport[]; canSend: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [, startRefresh] = useTransition();
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const sendableIds = reports.filter((r) => r.sendable && r.hasRecipient).map((r) => r.id);
  const allSelected = sendableIds.length > 0 && sendableIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sendableIds));
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function sendOne(id: string) {
    setSendingId(id);
    const res = await sendSingleReport(id);
    setSendingId(null);
    if (res.ok) toast.success("Report delivered to the SMTP server (accepted).");
    else toast.error(res.error ?? "Sending failed.");
    startRefresh(() => router.refresh());
  }

  async function sendBulk() {
    if (selected.size === 0) return;
    setBulkPending(true);
    const res = await bulkSendReports([...selected]);
    setBulkPending(false);
    setSelected(new Set());
    if (res.ok) toast.success(`Bulk dispatch complete: ${res.sent} email${res.sent === 1 ? "" : "s"} accepted by the SMTP server.`);
    else toast.warning(`Bulk dispatch finished: ${res.sent} sent, ${res.failed} failed. ${res.errors[0] ?? ""}`);
    startRefresh(() => router.refresh());
  }

  async function showPreview(id: string) {
    setPreviewLoading(true);
    const p = await previewReportEmail(id);
    setPreview(p);
    setPreviewLoading(false);
  }

  const pending = reports.filter((r) => r.status !== "SENT");
  const sent = reports.filter((r) => r.status === "SENT");

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="text-[13px] text-slate-600">
          <span className="font-bold text-navy-900">{pending.length}</span> awaiting dispatch
          {sent.length > 0 && <span className="text-slate-400"> · {sent.length} sent in view</span>}
        </div>
        <div className="flex items-center gap-2.5">
          {selected.size > 0 && (
            <span className="rounded-full bg-navy-900/[0.05] px-3 py-1 text-[11.5px] font-bold text-navy-900 ring-1 ring-inset ring-navy-900/10">
              {selected.size} selected
            </span>
          )}
          <button
            onClick={sendBulk}
            disabled={!canSend || selected.size === 0 || bulkPending}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-navy-800 disabled:opacity-40"
          >
            {bulkPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4 text-gold-400" />}
            {bulkPending ? "Dispatching…" : `Send selected (${selected.size})`}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th className="w-10">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!canSend || sendableIds.length === 0}
                  className="h-3.5 w-3.5 cursor-pointer rounded accent-[#c9a227]" title="Select all sendable reports" />
              </Th>
              <Th>Report</Th>
              <Th>Recipient</Th>
              <Th className="text-right">Records</Th>
              <Th className="text-right">Revenue</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className={cn("transition hover:bg-slate-50/60", selected.has(r.id) && "bg-gold-500/[0.05]")}>
                <Td>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)}
                    disabled={!canSend || !r.sendable || !r.hasRecipient}
                    className="h-3.5 w-3.5 cursor-pointer rounded accent-[#c9a227] disabled:cursor-not-allowed" />
                </Td>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-navy-900">{r.partnerName} <span className="font-semibold text-slate-400">·</span> <span className="uppercase">{r.serviceName}</span></p>
                      <p className="max-w-[320px] truncate font-mono text-[10.5px] text-slate-400" title={r.filename}>
                        {r.filename} · {(r.fileSize / 1024).toFixed(1)} KB
                      </p>
                      <p className="font-mono text-[10.5px] text-slate-400">{r.startDate} → {r.endDate}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  {r.hasRecipient ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-slate-600"><Mail className="h-3.5 w-3.5 text-slate-400" />{r.recipient}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-rose-600"><CircleAlert className="h-3.5 w-3.5" />Set recipient in register</span>
                  )}
                </Td>
                <Td className="text-right font-mono text-[12px]">{formatInt(r.recordCount)}</Td>
                <Td className="text-right font-mono text-[12px] font-bold">{formatMoney(r.totalRevenue)}</Td>
                <Td>
                  <StatusBadge status={r.status} />
                  {r.lastError && r.status === "FAILED" && (
                    <p className="mt-0.5 max-w-[200px] truncate text-[10px] text-rose-600" title={r.lastError}>{r.lastError}</p>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => showPreview(r.id)} disabled={previewLoading}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-bold text-navy-900 transition hover:bg-slate-100">
                      <Eye className="h-3.5 w-3.5 text-navy-600" /> Preview
                    </button>
                    {r.sendable && canSend && (
                      <button onClick={() => sendOne(r.id)} disabled={sendingId !== null || !r.hasRecipient}
                        title={!r.hasRecipient ? "Configure the recipient in the Partner Register first" : "Send now with attachment"}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-navy-900 px-3 text-[11.5px] font-bold text-white transition hover:bg-navy-800 disabled:opacity-40">
                        {sendingId === r.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : r.status === "FAILED" ? <RotateCcw className="h-3.5 w-3.5 text-gold-400" /> : <Send className="h-3.5 w-3.5 text-gold-400" />}
                        {r.status === "FAILED" ? "Retry" : "Send"}
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="dialog-backdrop fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 pt-[7vh] anim-fade-in" onClick={() => setPreview(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="font-display text-[15px] font-bold text-navy-900">Email preview — {preview.partnerName}</h3>
                <p className="mt-0.5 text-[12px] text-slate-500">Exactly as it will be sent, with resolved placeholders</p>
              </div>
              <button onClick={() => setPreview(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-navy-900">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-6">
              <div className="rounded-xl border border-slate-200">
                <div className="space-y-1.5 border-b border-slate-100 px-4 py-3 text-[12.5px]">
                  <p><span className="mr-2 inline-block w-14 font-bold text-slate-500">To</span><span className="font-mono text-navy-900">{preview.to || "—"}</span></p>
                  {preview.cc && <p><span className="mr-2 inline-block w-14 font-bold text-slate-500">CC</span><span className="font-mono text-slate-600">{preview.cc}</span></p>}
                  <p><span className="mr-2 inline-block w-14 font-bold text-slate-500">Subject</span><span className="font-semibold text-navy-900">{preview.subject}</span></p>
                </div>
                <pre className="whitespace-pre-wrap px-4 py-3.5 font-sans text-[13px] leading-relaxed text-slate-700">{preview.body}</pre>
                <div className="flex items-center gap-2 border-t border-slate-100 bg-emerald-50/50 px-4 py-2.5 text-[12px] font-semibold text-emerald-800">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span className="font-mono">{preview.attachment}</span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold">validated .xlsx</span>
                </div>
              </div>
              {!preview.ready && (
                <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3.5 py-2.5 text-[12px] font-semibold text-rose-700">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {preview.problems.join(" ")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
