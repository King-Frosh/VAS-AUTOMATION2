"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarRange, LoaderCircle, Play, Info } from "lucide-react";
import { Card, Field, inputCls } from "@/components/ui";
import { generateBatchAction } from "@/app/actions/processing";

interface UploadOption {
  id: string;
  filename: string;
  minDate: string;
  maxDate: string;
  matchedRows: number;
  totalRows: number;
}

export default function ProcessForm({
  uploads,
  preselect,
  canProcess,
}: {
  uploads: UploadOption[];
  preselect: string;
  canProcess: boolean;
}) {
  const router = useRouter();
  const [uploadId, setUploadId] = useState(preselect || uploads[0]?.id || "");
  const selected = uploads.find((u) => u.id === uploadId);
  const [startDate, setStartDate] = useState(selected?.minDate || "");
  const [endDate, setEndDate] = useState(selected?.maxDate || "");
  const [pending, start] = useTransition();

  useEffect(() => {
    const u = uploads.find((x) => x.id === uploadId);
    if (u) {
      setStartDate(u.minDate || "");
      setEndDate(u.maxDate || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadId]);

  function submit() {
    if (!uploadId || !startDate || !endDate) return;
    start(async () => {
      const res = await generateBatchAction(uploadId, startDate, endDate);
      if (res.ok) {
        toast.success(`Batch complete: ${res.reportCount} partner-service report${res.reportCount === 1 ? "" : "s"} generated and validated.`);
        if ((res.reportCount ?? 0) > 0) router.push("/email-centre");
        else router.refresh();
      } else {
        toast.error(res.error ?? "Report generation failed.");
        router.refresh();
      }
    });
  }

  return (
    <Card className="anim-fade-up">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="flex items-center gap-2 text-[14px] font-bold text-navy-900">
          <CalendarRange className="h-4 w-4 text-gold-600" /> Generate reports
        </h3>
        <p className="mt-0.5 text-[12px] text-slate-500">Both dates are inclusive. One workbook per partner-service.</p>
      </div>
      <div className="space-y-4 p-5">
        <Field label="Source upload" hint={selected ? `${selected.totalRows} rows in file · ${selected.matchedRows} matched` : "Upload a log file first"}>
          <select value={uploadId} onChange={(e) => setUploadId(e.target.value)} className={inputCls()} disabled={uploads.length === 0}>
            {uploads.length === 0 && <option value="">No validated uploads available</option>}
            {uploads.map((u) => (
              <option key={u.id} value={u.id}>{u.filename}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date (inclusive)">
            <input type="date" value={startDate} min={selected?.minDate || undefined} max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)} className={inputCls("font-mono")} />
          </Field>
          <Field label="End date (inclusive)">
            <input type="date" value={endDate} min={startDate || undefined} max={selected?.maxDate || undefined}
              onChange={(e) => setEndDate(e.target.value)} className={inputCls("font-mono")} />
          </Field>
        </div>

        {selected && selected.matchedRows < selected.totalRows && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-200">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {selected.totalRows - selected.matchedRows} rows in this file are unresolved. They will be excluded from partner
            reports and remain visible under Unmatched Records until mapped.
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={pending || !canProcess || !uploadId || !startDate || !endDate}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-navy-800 disabled:opacity-50"
        >
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 text-gold-400" />}
          {pending ? "Generating workbooks…" : "Generate partner reports"}
        </button>

        <div className="rounded-lg bg-slate-50 px-3.5 py-3 text-[11.5px] leading-relaxed text-slate-500">
          <p className="mb-1 font-bold uppercase tracking-wider text-slate-400">What happens next</p>
          1. Matched rows are filtered by partner, service and the inclusive period.<br />
          2. Each combination becomes a validated .xlsx with a single &quot;Unreconciled Logs&quot; sheet.<br />
          3. Reports land in the Email Centre as <span className="font-semibold">Ready to Send</span>.<br />
          4. Reconciliation: valid source = matched + unresolved (invalid accounted separately).
        </div>
      </div>
    </Card>
  );
}
