import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardHeader, EmptyState, Td, Th } from "@/components/ui";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { ScrollText } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Audit Logs" };
export const dynamic = "force-dynamic";

const ACTION_TONE: Record<string, string> = {
  EMAIL_SENT: "bg-emerald-50 text-emerald-700 ring-emerald-300/60",
  EMAIL_FAILED: "bg-rose-50 text-rose-700 ring-rose-300/60",
  EMAIL_RESENT: "bg-violet-50 text-violet-700 ring-violet-300/60",
  UPLOAD_PROCESSED: "bg-sky-50 text-sky-700 ring-sky-300/60",
  UPLOAD_FAILED: "bg-rose-50 text-rose-700 ring-rose-300/60",
  REPORTS_GENERATED: "bg-indigo-50 text-indigo-700 ring-indigo-300/60",
  AUTOMATION_RUN: "bg-amber-50 text-amber-700 ring-amber-300/60",
  SMTP_SETTINGS_SAVED: "bg-slate-100 text-slate-600 ring-slate-300/60",
  LOGIN_FAILED: "bg-rose-50 text-rose-700 ring-rose-300/60",
};

export default async function AuditPage() {
  await requireUser();
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Every important administrative and system action — uploads, processing runs, sends, resends, template and SMTP changes. Secrets are never recorded."
      />
      <Card className="anim-fade-up">
        <CardHeader title={`${rows.length} events`} subtitle="Most recent first · retained per the System Settings retention policy" />
        {rows.length === 0 ? (
          <EmptyState icon={<ScrollText />} title="No audit events yet" hint="Actions taken across the console will be recorded here with actor, timestamp and details." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Details</Th>
                  <Th>Timestamp</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  let details: Record<string, unknown> = {};
                  try { details = JSON.parse(a.details || "{}"); } catch { /* ignore */ }
                  const detailText = Object.entries(details)
                    .filter(([, v]) => v !== null && v !== "" && v !== undefined)
                    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                    .join(" · ");
                  return (
                    <tr key={a.id} className="transition hover:bg-slate-50/60">
                      <Td><span className="font-mono text-[12px] font-bold text-navy-900">{a.actor}</span></Td>
                      <Td>
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ring-1 ring-inset ${ACTION_TONE[a.action] ?? "bg-slate-100 text-slate-600 ring-slate-300/60"}`}>
                          {a.action.replace(/_/g, " ")}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-[11.5px] text-slate-500">
                        {a.entityType ? a.entityType.replace(/_/g, " ") : "—"}
                      </Td>
                      <Td className="max-w-[420px]">
                        <p className="truncate font-mono text-[10.5px] text-slate-500" title={detailText}>{detailText || "—"}</p>
                      </Td>
                      <Td className="whitespace-nowrap text-[11.5px] text-slate-500" title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
