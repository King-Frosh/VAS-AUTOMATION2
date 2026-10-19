import { db } from "@/db";
import { uploads, reportBatches } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardHeader, StatusBadge, EmptyState, Td, Th } from "@/components/ui";
import { formatInt, formatMoney, formatDateTime, timeAgo } from "@/lib/utils";
import { CalendarRange, SquareCheckBig } from "lucide-react";
import Link from "next/link";
import ProcessForm from "./process-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Date Range & Processing" };
export const dynamic = "force-dynamic";

export default async function ProcessingPage({
  searchParams,
}: {
  searchParams: Promise<{ upload?: string }>;
}) {
  const user = await requireUser();
  const { upload: preselect } = await searchParams;

  const readyUploads = await db
    .select()
    .from(uploads)
    .where(eq(uploads.status, "READY_FOR_REVIEW"))
    .orderBy(desc(uploads.createdAt))
    .limit(20);

  const batches = await db.select().from(reportBatches).orderBy(desc(reportBatches.createdAt)).limit(25);
  const uploadById = new Map((await db.select().from(uploads)).map((u) => [u.id, u]));

  return (
    <div>
      <PageHeader
        title="Date Range & Processing"
        subtitle="Choose an inclusive reporting period, then generate one Excel workbook per eligible partner-service combination from a validated upload."
      />

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <ProcessForm
            canProcess={user.role !== "VIEWER"}
            uploads={readyUploads.map((u) => ({
              id: u.id,
              filename: u.filename,
              minDate: u.minDate,
              maxDate: u.maxDate,
              matchedRows: u.matchedRows,
              totalRows: u.totalRows,
            }))}
            preselect={preselect ?? ""}
          />
        </div>

        <Card className="anim-fade-up xl:col-span-3">
          <CardHeader
            title="Processing runs"
            subtitle="Each batch covers one upload and one inclusive period — reconciliation enforced before dispatch"
          />
          {batches.length === 0 ? (
            <EmptyState
              icon={<CalendarRange />}
              title="No processing runs yet"
              hint="Select an upload and a date range on the left to generate your first set of partner-service reports."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Period</Th>
                    <Th>Source</Th>
                    <Th>Reports</Th>
                    <Th>Reconciliation</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => {
                    const reconciled = b.sourceTotal === b.matchedTotal + b.unmatchedTotal;
                    return (
                      <tr key={b.id} className="transition hover:bg-slate-50/60">
                        <Td>
                          <p className="whitespace-nowrap font-mono text-[12px] font-bold text-navy-900">{b.startDate} → {b.endDate}</p>
                          <StatusBadge status={b.trigger} label={b.trigger === "AUTO" ? "AUTO" : "MANUAL"} />
                        </Td>
                        <Td>
                          <p className="max-w-[160px] truncate text-[12px] text-slate-600" title={uploadById.get(b.uploadId)?.filename}>
                            {uploadById.get(b.uploadId)?.filename ?? "—"}
                          </p>
                          <p className="font-mono text-[10.5px] text-slate-400">{formatInt(b.sourceTotal)} valid rows · {formatMoney(b.sourceRevenue)}</p>
                        </Td>
                        <Td>
                          <Link href={`/reports?batch=${b.id}`} className="inline-flex items-center gap-1.5 font-mono text-[13px] font-bold text-navy-900 hover:text-gold-700">
                            {formatInt(b.reportCount)} <SquareCheckBig className="h-3.5 w-3.5 text-gold-600" />
                          </Link>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${reconciled ? "bg-emerald-500" : "bg-rose-500"}`} />
                            <span className="font-mono text-[11px] text-slate-600" title={`Valid source ${b.sourceTotal} = matched ${b.matchedTotal} + unresolved ${b.unmatchedTotal} (invalid excluded: ${b.invalidTotal})`}>
                              {b.sourceTotal} = {b.matchedTotal} + {b.unmatchedTotal}
                            </span>
                          </div>
                        </Td>
                        <Td><StatusBadge status={b.status} /></Td>
                        <Td className="whitespace-nowrap text-[12px] text-slate-500" title={formatDateTime(b.createdAt)}>
                          {timeAgo(b.createdAt)}
                          <p className="text-[10.5px] text-slate-400">{b.createdByName}</p>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
