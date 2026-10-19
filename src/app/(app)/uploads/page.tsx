import { db } from "@/db";
import { uploads } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardHeader, StatusBadge, EmptyState, Td, Th } from "@/components/ui";
import { formatInt, formatDateTime, timeAgo } from "@/lib/utils";
import { FileUp, FileSpreadsheet, FileText, Download } from "lucide-react";
import UploadWidget from "./upload-widget";
import DeleteUploadButton from "./delete-upload-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Upload Logs" };
export const dynamic = "force-dynamic";

export default async function UploadsPage() {
  const user = await requireUser();
  const rows = await db.select().from(uploads).orderBy(desc(uploads.createdAt)).limit(50);
  const duplicateIds = new Set(rows.map((r) => r.duplicateOf).filter(Boolean));

  return (
    <div>
      <PageHeader
        title="Upload Logs"
        subtitle="Upload MTN unreconciled transaction logs (.xlsx, .xls, .csv). Files are validated against the nine required headers and matched to the Partner Register."
        actions={
          <a href="/api/sample-log" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-navy-900 transition hover:border-slate-300 hover:bg-slate-50">
            <Download className="h-4 w-4 text-gold-600" /> Sample log file
          </a>
        }
      />

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <UploadWidget canUpload={user.role !== "VIEWER"} />

          <Card className="mt-5 anim-fade-up">
            <CardHeader title="Required source headers" subtitle="Recognised in this exact order — capitalization & whitespace tolerant" />
            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-1.5">
                {["DATE", "SERVICE PARTNER", "SERVICE ID", "PRICE POINT", "PRODUCT ID", "PRODUCT NAME", "TRANSACTION", "COUNT", "REVENUE"].map((h, i) => (
                  <span key={h} className="inline-flex items-center gap-1.5 rounded-md bg-navy-900/[0.04] px-2 py-1 font-mono text-[10.5px] font-bold text-navy-800 ring-1 ring-inset ring-navy-900/10">
                    <span className="text-gold-600">{i + 1}</span> {h}
                  </span>
                ))}
              </div>
              <ul className="mt-4 space-y-1.5 text-[12px] leading-relaxed text-slate-500">
                <li>· The <span className="font-semibold text-slate-700">SERVICE PARTNER</span> column identifies the partner — matched case-insensitively against register names and codes.</li>
                <li>· <span className="font-semibold text-slate-700">SERVICE ID</span> is mapped to a service name under Service Mappings.</li>
                <li>· Duplicate-content uploads are flagged by SHA-256 hash but never silently discarded.</li>
                <li>· Legitimate repeated source rows are always preserved.</li>
              </ul>
            </div>
          </Card>
        </div>

        <Card className="anim-fade-up xl:col-span-3">
          <CardHeader title="Upload history" subtitle="Validation state and processing status of each file" />
          {rows.length === 0 ? (
            <EmptyState
              icon={<FileUp />}
              title="No files uploaded yet"
              hint="Upload your first MTN unreconciled log to begin validation and partner matching. A sample file is available above."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>File</Th>
                    <Th>Rows</Th>
                    <Th>Matched</Th>
                    <Th>Needs review</Th>
                    <Th>Period</Th>
                    <Th>Status</Th>
                    <Th>Uploaded</Th>
                    {user.role === "ADMIN" && <Th />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="transition hover:bg-slate-50/60">
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                            {u.filename.toLowerCase().endsWith(".csv") ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-[220px] truncate text-[13px] font-semibold text-navy-900" title={u.filename}>{u.filename}</p>
                            {duplicateIds.has(u.duplicateOf) === false && u.duplicateOf && (
                              <p className="text-[10.5px] font-semibold text-amber-600">Duplicate content of earlier upload</p>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td className="font-mono text-[12px]">{formatInt(u.totalRows)}</Td>
                      <Td><span className="font-mono text-[12px] font-bold text-emerald-700">{formatInt(u.matchedRows)}</span></Td>
                      <Td>
                        {u.unmatchedRows + u.invalidRows > 0 ? (
                          <span className="font-mono text-[12px] font-bold text-amber-700">{formatInt(u.unmatchedRows + u.invalidRows)}</span>
                        ) : (
                          <span className="text-[12px] text-slate-400">—</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap font-mono text-[11.5px] text-slate-500">
                        {u.minDate ? `${u.minDate} → ${u.maxDate}` : "—"}
                      </Td>
                      <Td>
                        <StatusBadge status={u.status} />
                        {u.status === "FAILED" && u.errorMessage && (
                          <p className="mt-1 max-w-[220px] text-[10.5px] leading-tight text-rose-600" title={u.errorMessage}>{u.errorMessage.slice(0, 90)}…</p>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-[12px] text-slate-500" title={formatDateTime(u.createdAt)}>
                        {timeAgo(u.createdAt)}
                        <p className="text-[10.5px] text-slate-400">by {u.uploaderName}</p>
                      </Td>
                      {user.role === "ADMIN" && (
                        <Td className="text-right"><DeleteUploadButton id={u.id} /></Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
