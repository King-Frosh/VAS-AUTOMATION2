"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, LoaderCircle } from "lucide-react";
import { resendDelivery } from "@/app/actions/emails";

export default function ResendButton({ deliveryId, hasReport }: { deliveryId: string; hasReport: boolean }) {
  const [busy, setBusy] = useState(false);
  const [, refresh] = useTransition();
  const router = useRouter();

  if (!hasReport) return <span className="text-[11px] text-slate-300">—</span>;

  return (
    <button
      disabled={busy}
      onClick={() => {
        if (!confirm("Explicitly resend this report email? A new delivery record will be created and logged — a resend never silently duplicates.")) return;
        setBusy(true);
        (async () => {
          const res = await resendDelivery(deliveryId);
          setBusy(false);
          if (res.ok) toast.success("Resend accepted by the SMTP server.");
          else toast.error(res.error ?? "Resend failed.");
          refresh(() => router.refresh());
        })();
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-bold text-navy-900 transition hover:bg-slate-100 disabled:opacity-40"
      title="Authorized resend — recorded as a new delivery action"
    >
      {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 text-gold-600" />}
      Resend
    </button>
  );
}
