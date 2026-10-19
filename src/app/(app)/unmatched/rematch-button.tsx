"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, LoaderCircle } from "lucide-react";
import { rematchUploadAction } from "@/app/actions/processing";

export default function RematchButton({ uploadId, filename }: { uploadId: string; filename: string }) {
  const [busy, setBusy] = useState(false);
  const [, refresh] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={busy}
      onClick={() => {
        if (busy) return;
        setBusy(true);
        (async () => {
          try {
            const res = await rematchUploadAction(uploadId);
            if (res.ok) toast.success(res.message ?? "Re-matching complete.");
            else toast.error(res.error ?? "Re-matching failed.");
            refresh(() => router.refresh());
          } catch (error) {
            console.error("Re-matching failed:", error);
            toast.error("Re-matching failed. Check the terminal for the error, then try again.");
          } finally {
            // Always clear the spinner, including when the server action throws.
            setBusy(false);
          }
        })();
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-navy-900 transition hover:border-gold-500/50 hover:bg-gold-500/[0.06] disabled:opacity-50"
      title={`Re-match rows from ${filename}`}
    >
      {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 text-gold-600" />}
      <span className="max-w-[140px] truncate">{filename}</span>
    </button>
  );
}
