import { db } from "@/db";
import { partnerReports, partners } from "@/db/schema";
import { desc, inArray, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getSmtpSettings, smtpConfigured } from "@/lib/mailer";
import { PageHeader, Card } from "@/components/ui";
import { SendHorizonal, ShieldAlert, ArrowRight } from "lucide-react";
import Link from "next/link";
import EmailCentreClient from "./email-centre-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Email Centre" };
export const dynamic = "force-dynamic";

export default async function EmailCentrePage() {
  const user = await requireUser();
  const canSend = user.role === "ADMIN" || user.role === "OPS";

  const rows = await db
    .select()
    .from(partnerReports)
    .where(inArray(partnerReports.status, ["READY_TO_SEND", "FAILED", "SENDING", "SENT"]))
    .orderBy(desc(partnerReports.createdAt))
    .limit(150);

  const partnerRows = await db.select().from(partners);
  const partnerById = new Map(partnerRows.map((p) => [p.id, p]));

  const smtp = await getSmtpSettings();
  const smtpReady = smtpConfigured(smtp);

  const sendable = rows.filter((r) => r.status === "READY_TO_SEND" || r.status === "FAILED");

  return (
    <div>
      <PageHeader
        title="Email Centre"
        subtitle="Review, preview and dispatch partner-service reports. Every email must carry its validated .xlsx attachment — sending is blocked otherwise."
        actions={<StatusPill smtpReady={smtpReady} host={smtp?.host ?? ""} />}
      />

      {!smtpReady && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-5 py-4 anim-fade-in">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-[13px] leading-relaxed text-amber-900">
            <span className="font-bold">SMTP is not fully configured.</span> Sending is disabled until the SMTP Server,
            Port, Login, Password and sender address are saved under Email Settings.
            {user.role === "ADMIN" && (
              <Link href="/email-settings" className="ml-2 inline-flex items-center gap-1 font-bold text-amber-900 underline underline-offset-2">
                Configure now <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      <Card className="anim-fade-up">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <SendHorizonal className="h-5 w-5" />
            </div>
            <p className="text-[14px] font-bold text-navy-900">No reports awaiting dispatch</p>
            <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-slate-500">
              Generate partner-service workbooks under Date Range &amp; Processing — they will appear here as Ready to Send.
            </p>
          </div>
        ) : (
          <EmailCentreClient
            canSend={canSend && smtpReady}
            reports={rows.map((r) => {
              const partner = r.partnerId ? partnerById.get(r.partnerId) : undefined;
              return {
                id: r.id,
                partnerName: r.partnerName,
                serviceName: r.serviceName,
                serviceId: r.serviceId,
                startDate: r.startDate,
                endDate: r.endDate,
                recordCount: r.recordCount,
                totalRevenue: r.totalRevenue,
                filename: r.filename,
                fileSize: r.fileSize,
                status: r.status,
                lastError: r.lastError,
                recipient: partner?.email ?? "",
                hasRecipient: !!(partner?.email),
                sendable: sendable.some((s) => s.id === r.id),
              };
            })}
          />
        )}
      </Card>
    </div>
  );
}

function StatusPill({ smtpReady, host }: { smtpReady: boolean; host: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold ring-1 ring-inset ${smtpReady ? "bg-emerald-50 text-emerald-700 ring-emerald-300/60" : "bg-rose-50 text-rose-700 ring-rose-300/60"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${smtpReady ? "bg-emerald-500" : "bg-rose-500"}`} />
      {smtpReady ? `SMTP ready · ${host}` : "SMTP not configured"}
    </span>
  );
}
