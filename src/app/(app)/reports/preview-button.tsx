"use client";

import { useState, useTransition } from "react";
import { Eye, LoaderCircle, X } from "lucide-react";
import { getReportRows, type PreviewRow } from "@/app/actions/reports";
import { formatMoney } from "@/lib/utils";

export default function ReportPreviewButton({ reportId }: { reportId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ title: string; rows: PreviewRow[]; total: number } | null>(null);
  const [pending, start] = useTransition();

  function show() {
    setOpen(true);
    start(async () => {
      const res = await getReportRows(reportId);
      setData(res);
    });
  }

  if (!open) {
    return (
      <button onClick={show} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-bold text-navy-900 transition hover:border-navy-300 hover:bg-slate-100">
        <Eye className="h-3.5 w-3.5 text-navy-600" /> Preview
      </button>
    );
  }

  return (
    <div className="dialog-backdrop fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 pt-[6vh] anim-fade-in" onClick={() => setOpen(false)}>
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl anim-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="font-display text-[15px] font-bold text-navy-900">{data?.title ?? "Report preview"}</h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Worksheet <span className="font-mono font-semibold">Unreconciled Logs</span> — first 25 of {data?.total ?? "…"} records. Label: <span className="font-bold text-amber-700">UNRECONCILED LOGS</span>
            </p>
          </div>
          <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-navy-900">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[62vh] overflow-auto p-6 pt-0">
          {pending && (
            <div className="flex items-center justify-center gap-2 py-14 text-[13px] font-semibold text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin text-gold-600" /> Loading rows…
            </div>
          )}
          {!pending && data && (
            <table className="w-full border-collapse text-[12px]">
              <thead className="sticky top-0">
                <tr>
                  {["DATE", "SERVICE PARTNER", "SERVICE ID", "PRICE POINT", "PRODUCT ID", "PRODUCT NAME", "TRANSACTION", "COUNT", "REVENUE"].map((h) => (
                    <th key={h} className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-mono text-[10px] font-bold tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-3 py-2 font-mono">{r.logDate}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{r.servicePartner}</td>
                    <td className="border-b border-slate-100 px-3 py-2 font-mono">{r.serviceId}</td>
                    <td className="border-b border-slate-100 px-3 py-2 font-mono">{r.pricePoint}</td>
                    <td className="border-b border-slate-100 px-3 py-2 font-mono">{r.productId}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{r.productName}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{r.transaction}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-right font-mono">{r.count}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-right font-mono font-semibold">{formatMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
