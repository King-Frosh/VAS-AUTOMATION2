import { db } from "@/db";
import { uploads, vasLogRows, partnerReports, emailDeliveries, auditLogs, partners, automationSettings } from "@/db/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { PageHeader, Card, CardHeader, StatCard, StatusBadge, EmptyState, Td, Th } from "@/components/ui";
import { formatInt, formatMoney, formatDateTime, timeAgo, truncate } from "@/lib/utils";
import {
  FileUp, FileSpreadsheet, SendHorizonal, AlertTriangle, Banknote, Handshake,
  CalendarClock, ArrowRight, Inbox, CircleCheck,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [
    [uploadCount], [rowStats], [reportStats], [pendingSends], [sentCount], [failedCount],
    [partnerCount], recentDeliveries, recentAudit, latestUpload, [automation],
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(uploads),
    db.select({
      n: sql<number>`count(*)::int`,
      matched: sql<number>`count(*) filter (where ${vasLogRows.matchStatus} = 'MATCHED')::int`,
      revenue: sql<string>`coalesce(sum(${vasLogRows.revenue}) filter (where ${vasLogRows.matchStatus} = 'MATCHED'), 0)::text`,
    }).from(vasLogRows),
    db.select({ n: sql<number>`count(*)::int` }).from(partnerReports),
    db.select({ n: sql<number>`count(*)::int` }).from(partnerReports).where(inArray(partnerReports.status, ["READY_TO_SEND", "FAILED"])),
    db.select({ n: sql<number>`count(*)::int` }).from(emailDeliveries).where(eq(emailDeliveries.status, "SENT")),
    db.select({ n: sql<number>`count(*)::int` }).from(emailDeliveries).where(eq(emailDeliveries.status, "FAILED")),
    db.select({ n: sql<number>`count(*)::int` }).from(partners).where(eq(partners.active, true)),
    db.select().from(emailDeliveries).orderBy(desc(emailDeliveries.createdAt)).limit(6),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(8),
    db.select().from(uploads).orderBy(desc(uploads.createdAt)).limit(1),
    db.select().from(automationSettings).limit(1),
  ]);

  const upload = latestUpload[0];
  const noPartners = (partnerCount?.n ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Operations Dashboard"
        subtitle="Live status of MTN unreconciled log processing, partner report generation and email distribution."
        actions={
          <>
            <Link href="/uploads" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-navy-900 transition hover:border-slate-300 hover:bg-slate-50">
              <FileUp className="h-4 w-4 text-gold-600" /> Upload Logs
            </Link>
            <Link href="/email-centre" className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-navy-800">
              <SendHorizonal className="h-4 w-4 text-gold-400" /> Email Centre
              {(pendingSends?.n ?? 0) > 0 && (
                <span className="rounded-full bg-gold-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-gold-400">{pendingSends?.n}</span>
              )}
            </Link>
          </>
        }
      />

      {noPartners && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-gold-500/40 bg-gradient-to-r from-gold-500/[0.08] to-transparent px-5 py-4 anim-fade-in">
          <Handshake className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
          <div className="text-[13px] leading-relaxed text-slate-700">
            <span className="font-bold text-navy-900">Set up your Partner Register first.</span> Add each partner with their
            recipient email, then map their Service IDs under Service Mappings. Rows can only be matched to registered
            partners — <Link href="/partners" className="font-semibold text-gold-700 underline underline-offset-2">open the register</Link>.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 stagger xl:grid-cols-4">
        <StatCard label="Log rows imported" value={formatInt(rowStats?.n)} hint={`${formatInt(rowStats?.matched)} matched to partners`} icon={<Inbox strokeWidth={1.8} />} />
        <StatCard label="Matched unreconciled value" value={formatMoney(rowStats?.revenue)} hint="Across all uploads — label: UNRECONCILED" icon={<Banknote strokeWidth={1.8} />} tone="gold" />
        <StatCard label="Reports generated" value={formatInt(reportStats?.n)} hint={`${formatInt(pendingSends?.n)} awaiting dispatch`} icon={<FileSpreadsheet strokeWidth={1.8} />} tone="info" />
        <StatCard label="Emails sent" value={formatInt(sentCount?.n)} hint={`${formatInt(failedCount?.n)} failed attempts`} icon={<CircleCheck strokeWidth={1.8} />} tone="success" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {/* Current pipeline */}
        <Card className="anim-fade-up">
          <CardHeader title="Pipeline State" subtitle="Latest upload, automation schedule and queue" />
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Latest upload</p>
                <p className="mt-1 truncate text-[13px] font-semibold text-navy-900">{upload ? upload.filename : "No uploads yet"}</p>
                {upload && <p className="mt-0.5 text-[11.5px] text-slate-500">{formatInt(upload.totalRows)} rows · {timeAgo(upload.createdAt)}</p>}
              </div>
              {upload && <StatusBadge status={upload.status} />}
            </div>
            <div className="h-px bg-slate-100" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Automation</p>
                <p className="mt-1 text-[13px] font-semibold text-navy-900">
                  {automation?.enabled ? `${automation.frequency} · ${automation.timeOfDay} ${automation.timezone}` : "Disabled"}
                </p>
                <p className="mt-0.5 text-[11.5px] text-slate-500">
                  {automation?.enabled && automation.nextRunAt ? `Next run ${formatDateTime(automation.nextRunAt)}` : "Enable under Automation Settings"}
                </p>
              </div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${automation?.enabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                <CalendarClock className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </div>
            </div>
            <div className="h-px bg-slate-100" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dispatch queue</p>
                <p className="mt-1 text-[13px] font-semibold text-navy-900">{formatInt(pendingSends?.n)} reports waiting</p>
              </div>
              <Link href="/email-centre" className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-navy-800">
                Open <ArrowRight className="h-3.5 w-3.5 text-gold-400" />
              </Link>
            </div>
          </div>
        </Card>

        {/* Recent deliveries */}
        <Card className="anim-fade-up xl:col-span-1">
          <CardHeader title="Recent Email Activity" subtitle="Latest six dispatch records" action={<Link href="/deliveries" className="text-[12px] font-semibold text-gold-700 hover:underline">View all</Link>} />
          <div className="divide-y divide-slate-100">
            {recentDeliveries.length === 0 && <EmptyState icon={<SendHorizonal />} title="No emails sent yet" hint="Send your first partner report from the Email Centre." />}
            {recentDeliveries.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-navy-900">{truncate(d.subject, 44)}</p>
                  <p className="truncate font-mono text-[11px] text-slate-500">{d.recipient}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={d.status} />
                  <span className="text-[10.5px] text-slate-400">{timeAgo(d.sentAt ?? d.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Audit trail */}
        <Card className="anim-fade-up xl:col-span-1">
          <CardHeader title="Audit Trail" subtitle="Latest administrative activity" action={<Link href="/audit" className="text-[12px] font-semibold text-gold-700 hover:underline">View all</Link>} />
          <div className="divide-y divide-slate-100">
            {recentAudit.length === 0 && <EmptyState icon={<AlertTriangle />} title="No activity recorded" />}
            {recentAudit.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                <div className="min-w-0">
                  <p className="text-[12.5px] leading-snug text-slate-700">
                    <span className="font-semibold text-navy-900">{a.actor}</span>{" "}
                    <span className="text-slate-500">{a.action.replace(/_/g, " ").toLowerCase()}</span>
                  </p>
                  <p className="text-[10.5px] text-slate-400">{timeAgo(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Clarifying note about SMTP acceptance vs delivery */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-[12px] leading-relaxed text-slate-500 anim-fade-in">
        <span className="font-bold text-navy-900">Note on status labels:</span> an email marked
        <StatusBadge status="SENT" /> was <span className="font-semibold">accepted by the configured SMTP server</span>.
        SMTP acceptance does not by itself guarantee final inbox delivery — review Delivery History for provider responses.
      </div>
    </div>
  );
}
