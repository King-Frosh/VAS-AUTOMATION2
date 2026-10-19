"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud, LoaderCircle, FileSpreadsheet, TriangleAlert, CircleCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

interface UploadResult {
  ok: boolean;
  error?: string;
  upload?: {
    id: string;
    filename: string;
    total: number;
    matched: number;
    unmatched: number;
    invalid: number;
    minDate: string;
    maxDate: string;
    duplicateOfId: string | null;
    duplicateFilename: string | null;
  };
}

export default function UploadWidget({ canUpload }: { canUpload: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [, startTransition] = useTransition();

  async function upload(file: File) {
    if (!canUpload) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = (await res.json()) as UploadResult;
      setResult(data);
      if (data.ok) {
        toast.success(`"${data.upload!.filename}" processed: ${data.upload!.matched} of ${data.upload!.total} rows matched.`);
        if (data.upload!.duplicateOfId) {
          toast.warning("This file has the same content hash as a previous upload.");
        }
      } else {
        toast.error(data.error ?? "Upload failed.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({ ok: false, error: message });
      toast.error(`Upload failed: ${message}`);
    } finally {
      setBusy(false);
      startTransition(() => router.refresh());
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  return (
    <Card className="anim-fade-up">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-[14px] font-bold text-navy-900">Upload MTN log file</h3>
        <p className="mt-0.5 text-[12px] text-slate-500">.xlsx, .xls or .csv — validated immediately on receipt</p>
      </div>
      <div className="p-5">
        <button
          type="button"
          disabled={!canUpload || busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "group flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all",
            dragging
              ? "border-gold-500 bg-gold-500/[0.06] scale-[1.01]"
              : "border-slate-200 bg-slate-50/50 hover:border-gold-400/70 hover:bg-gold-500/[0.03]",
            (!canUpload || busy) && "cursor-not-allowed opacity-60"
          )}
        >
          {busy ? (
            <LoaderCircle className="mb-3 h-9 w-9 animate-spin text-gold-600" strokeWidth={1.5} />
          ) : (
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-900 shadow-lg shadow-navy-900/20 transition group-hover:scale-105">
              <UploadCloud className="h-6 w-6 text-gold-400" strokeWidth={1.6} />
            </div>
          )}
          <p className="text-[14px] font-bold text-navy-900">
            {busy ? "Validating & matching rows…" : canUpload ? "Drop the MTN log file here" : "Read-only access"}
          </p>
          <p className="mt-1 text-[12px] text-slate-500">
            {busy ? "Parsing headers, dates and partner mappings" : canUpload ? "or click to browse your computer" : "Uploading requires an Administrator or Operations account"}
          </p>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />

        {result && (
          <div className={cn("mt-4 rounded-xl border px-4 py-3.5 anim-scale-in", result.ok ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/60")}>
            <div className="flex items-start gap-2.5">
              {result.ok ? (
                <CircleCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-600" />
              ) : (
                <TriangleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-rose-600" />
              )}
              <div className="min-w-0 text-[12.5px] leading-relaxed">
                {result.ok && result.upload ? (
                  <>
                    <p className="font-bold text-navy-900">{result.upload.filename}</p>
                    <p className="mt-1 text-slate-600">
                      <span className="font-semibold text-emerald-700">{result.upload.matched} matched</span> ·{" "}
                      <span className={result.upload.unmatched ? "font-semibold text-amber-700" : ""}>{result.upload.unmatched} unmatched</span> ·{" "}
                      <span className={result.upload.invalid ? "font-semibold text-rose-700" : ""}>{result.upload.invalid} invalid</span> of{" "}
                      {result.upload.total} rows
                    </p>
                    {result.upload.minDate && (
                      <p className="mt-1 font-mono text-[11px] text-slate-500">Period detected: {result.upload.minDate} → {result.upload.maxDate}</p>
                    )}
                    {result.upload.duplicateOfId && (
                      <p className="mt-1.5 flex items-start gap-1.5 font-semibold text-amber-700">
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Same content hash as &quot;{result.upload.duplicateFilename}&quot; — kept for traceability.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-semibold text-rose-700">{result.error}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          Originals are stored in private Vercel Blob storage and hashed (SHA-256). Generated reports are also private and kept separate from source files.
        </div>
      </div>
    </Card>
  );
}
