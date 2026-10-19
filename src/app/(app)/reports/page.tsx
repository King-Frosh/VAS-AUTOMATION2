import { db } from "@/db";
import { partnerReports, reportBatches } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardHeader, StatusBadge, EmptyState, Td, Th } from "@/components/ui";
import { formatInt, formatMoney, formatDateTime, timeAgo } from "@/lib/utils";
import { FileSpreadsheet, Download, CalendarRange } from "lucide-react";
import Link from "next/link";
import ReportPreviewButton from "./preview-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Generated Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ batch?: string; status?: string }> }) {
  await requireUser();
  const { batch, status } = await searchParams;

  let rows = await db.select().from(partnerReports).orderBy(desc(partnerReports.createdAt)).limit(150);
  if (batch) rows = rows.filter((r) => r.batchId === batch);
  if (status) rows = rows.filter((r) => r.status === status);

  const batchRow = batch ? (await db.select().from(reportBatches).where(eq(reportBatches.id, batch)).limit(1))[0] : null;

  const totalRevenue = rows.reduce((a, r) => a + Number(r.totalRevenue), 0);

  return (
    <div>
      <PageHeader
        title="Generated Reports"
        subtitle="Validated partner-service workbooks — exactly one &quot;Unreconciled Logs&quot; worksheet, nine original headers, only records of the matching partner, service and inclusive period."
        actions={
          batch ? (
            <Link href="/reports" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-navy-900 hover:bg-slate-50">
              Clear batch filter
            </Link>
          ) : undefined
        }
      />

      {batchRow && (
        <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-gold-500/40 bg-gold-500/[0.07] px-5 py-3.5 text-[12.5px] anim-fade-in">
          <span className="inline-flex items-center gap-1.5 font-bold text-navy-900">
            <CalendarRange className="h-4 w-4 text-gold-600" /> Batch filter active
          </span>
          <span className="font-mono text-slate-600">{batchRow.startDate} → {batchRow.endDate}</span>
          <span className="text-slate-600">Valid source <b className="font-mono">{formatInt(batchRow.sourceTotal)}</b> = matched <b className="font-mono text-emerald-700">{formatInt(batchRow.matchedTotal)}</b> + unresolved <b className="font-mono text-amber-700">{formatInt(batchRow.unmatchedTotal)}</b></span>
          <span className="text-slate-600">Invalid excluded: <b className="font-mono text-rose-700">{formatInt(batchRow.invalidTotal)}</b></span>
          <StatusBadge status={batchRow.status} />
        </div>
      )}

      <Card className="anim-fade-up">
        <CardHeader
          title={`${formatInt(rows.length)} workbooks`}
          subtitle={`Aggregate unreconciled revenue in view: ${formatMoney(totalRevenue)}`}
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet />}
            title="No reports generated yet"
            hint="Head to Date Range & Processing to generate partner-service workbooks from a validated upload."
            action={
              <Link href="/processing" className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-navy-800">
                Open processing <CalendarRange className="h-4 w-4 text-gold-400" />
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Workbook</Th>
                  <Th>Partner · Service</Th>
                  <Th>Period</Th>
                  <Th className="text-right">Records</Th>
                  <Th className="text-right">Unreconciled revenue</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="transition hover:bg-slate-50/60">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                          <FileSpreadsheet className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[280px] truncate font-mono text-[11px] font-bold text-navy-900" title={r.filename}>{r.filename}</p>
                          <p className="text-[10.5px] text-slate-400">{(r.fileSize / 1024).toFixed(1)} KB · {timeAgo(r.createdAt)}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <p className="text-[13px] font-semibold text-navy-900">{r.partnerName}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">{r.serviceName} <span className="font-mono normal-case text-slate-400">· {r.serviceId}</span></p>
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-[11.5px] text-slate-500">{r.startDate} → {r.endDate}</Td>
                    <Td className="text-right font-mono text-[12px]">{formatInt(r.recordCount)}</Td>
                    <Td className="text-right font-mono text-[12px] font-bold text-navy-900">{formatMoney(r.totalRevenue)}</Td>
                    <Td>
                      <StatusBadge status={r.status} />
                      {r.sentAt && <p className="mt-0.5 text-[10px] text-slate-400" title={formatDateTime(r.sentAt)}>{timeAgo(r.sentAt)}</p>}
                      {r.lastError && <p className="mt-0.5 max-w-[160px] truncate text-[10px] text-rose-600" title={r.lastError}>{r.lastError}</p>}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        <ReportPreviewButton reportId={r.id} />
                        <a
                          href={`/api/reports/${r.id}/download`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-bold text-navy-900 transition hover:border-emerald-300 hover:bg-emerald-50"
                          title="Download workbook (authenticated)"
                        >
                          <Download className="h-3.5 w-3.5 text-emerald-600" /> .xlsx
                        </a>
                      </div>
                    </Td>
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
