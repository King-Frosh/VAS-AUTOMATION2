"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, LoaderCircle } from "lucide-react";
import { deleteUploadAction } from "@/app/actions/processing";

export default function DeleteUploadButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this upload and all of its imported rows? Generated reports from earlier batches are kept.")) return;
        start(async () => {
          await deleteUploadAction(id);
          toast.success("Upload deleted.");
          router.refresh();
        });
      }}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
      title="Delete upload"
    >
      {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}
