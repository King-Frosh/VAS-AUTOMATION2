import { db } from "@/db";
import { emailDeliveries } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardHeader, StatusBadge, EmptyState, Td, Th } from "@/components/ui";
import { formatDateTime, timeAgo, truncate } from "@/lib/utils";
import { History, Paperclip } from "lucide-react";
import ResendButton from "./resend-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Delivery History" };
export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const user = await requireUser();
  const canSend = user.role === "ADMIN" || user.role === "OPS";
  const rows = await db.select().from(emailDeliveries).orderBy(desc(emailDeliveries.createdAt)).limit(150);

  return (
    <div>
      <PageHeader
        title="Delivery History"
        subtitle="Immutable record of every email attempt — recipient, subject, attachment and provider response snapshots are preserved exactly as transmitted."
      />

      <Card className="anim-fade-up">
        <CardHeader
          title={`${rows.length} delivery records`}
          subtitle="'Sent' means accepted by the SMTP server — it is not a guarantee of final inbox delivery."
        />
        {rows.length === 0 ? (
          <EmptyState icon={<History />} title="No deliveries recorded yet" hint="Dispatched and failed emails from the Email Centre and Automation will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Recipient · Subject</Th>
                  <Th>Attachment</Th>
                  <Th>Status</Th>
                  <Th>Mode</Th>
                  <Th>Provider response</Th>
                  <Th>Sent by</Th>
                  <Th>Time</Th>
                  {canSend && <Th className="text-right">Resend</Th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="transition hover:bg-slate-50/60">
                    <Td>
                      <p className="font-mono text-[11.5px] font-semibold text-navy-900">{d.recipient}</p>
                      <p className="max-w-[280px] truncate text-[12px] text-slate-600" title={d.subject}>{d.subject}</p>
                      {d.cc && <p className="max-w-[280px] truncate font-mono text-[10px] text-slate-400" title={d.cc}>cc: {d.cc}</p>}
                    </Td>
                    <Td>
                      <span className="inline-flex max-w-[220px] items-center gap-1.5 font-mono text-[10.5px] text-slate-500" title={d.attachmentFilename}>
                        <Paperclip className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">{d.attachmentFilename || "—"}</span>
                        {d.attachmentSize > 0 && <span className="shrink-0 text-slate-400">({(d.attachmentSize / 1024).toFixed(0)}K)</span>}
                      </span>
                    </Td>
                    <Td><StatusBadge status={d.status} /></Td>
                    <Td><StatusBadge status={d.trigger} /></Td>
                    <Td className="max-w-[240px]">
                      {d.status === "SENT" ? (
                        <span className="text-[11px] text-emerald-700" title={d.providerResponse}>{truncate(d.providerResponse || d.messageId || "Accepted", 60)}</span>
                      ) : d.error ? (
                        <span className="text-[11px] text-rose-600" title={d.error}>{truncate(d.error, 60)}</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-[11.5px] text-slate-500">{d.sentBy}</Td>
                    <Td className="whitespace-nowrap text-[11.5px] text-slate-500" title={formatDateTime(d.sentAt ?? d.createdAt)}>
                      {timeAgo(d.sentAt ?? d.createdAt)}
                    </Td>
                    {canSend && (
                      <Td className="text-right">
                        <ResendButton deliveryId={d.id} hasReport={!!d.reportId} />
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
