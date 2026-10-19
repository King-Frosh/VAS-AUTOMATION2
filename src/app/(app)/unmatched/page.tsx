import { db } from "@/db";
import { vasLogRows, uploads } from "@/db/schema";
import { ne, desc, eq, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardHeader, StatusBadge, EmptyState, Td, Th } from "@/components/ui";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { FileWarning, CircleCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import RematchButton from "./rematch-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Unmatched Records" };
export const dynamic = "force-dynamic";

export default async function UnmatchedPage({ searchParams }: { searchParams: Promise<{ upload?: string }> }) {
  const user = await requireUser();
  const canFix = user.role === "ADMIN" || user.role === "OPS";
  const { upload: filterUpload } = await searchParams;

  const allUploads = await db.select().from(uploads).orderBy(desc(uploads.createdAt)).limit(30);
  const uploadById = new Map(allUploads.map((u) => [u.id, u]));

  let rows = await db
    .select()
    .from(vasLogRows)
    .where(ne(vasLogRows.matchStatus, "MATCHED"))
    .orderBy(desc(vasLogRows.uploadId))
    .limit(200);
  if (filterUpload) rows = rows.filter((r) => r.uploadId === filterUpload);

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      partner: sql<number>`count(*) filter (where ${vasLogRows.matchStatus} = 'UNMATCHED_PARTNER')::int`,
      service: sql<number>`count(*) filter (where ${vasLogRows.matchStatus} = 'UNMAPPED_SERVICE')::int`,
      ambiguous: sql<number>`count(*) filter (where ${vasLogRows.matchStatus} = 'AMBIGUOUS')::int`,
      invalid: sql<number>`count(*) filter (where ${vasLogRows.matchStatus} = 'INVALID')::int`,
    })
    .from(vasLogRows)
    .where(ne(vasLogRows.matchStatus, "MATCHED"));

  const uploadsWithUnresolved = [...new Set(rows.map((r) => r.uploadId))];

  return (
    <div>
      <PageHeader
        title="Unmatched Records"
        subtitle="Rows the console refused to guess about — unknown partners, unmapped service IDs, ambiguous references or invalid values. They stay excluded from outgoing reports until resolved."
        actions={
          <Link href="/services" className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-navy-800">
            Fix mappings <ArrowRight className="h-4 w-4 text-gold-400" />
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 stagger md:grid-cols-5">
        {[
          { label: "Total unresolved", value: counts?.total ?? 0, tone: "text-slate-900" },
          { label: "Unknown partner", value: counts?.partner ?? 0, tone: "text-rose-700" },
          { label: "Unmapped service", value: counts?.service ?? 0, tone: "text-orange-700" },
          { label: "Ambiguous", value: counts?.ambiguous ?? 0, tone: "text-violet-700" },
          { label: "Invalid values", value: counts?.invalid ?? 0, tone: "text-rose-700" },
        ].map((s) => (
          <Card key={s.label} className="px-4 py-3.5 anim-fade-up">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-400">{s.label}</p>
            <p className={`mt-1 font-display text-2xl font-bold ${s.tone}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {uploadsWithUnresolved.length > 0 && canFix && (
        <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 px-5 py-4 anim-fade-up">
          <div className="text-[13px] text-slate-600">
            <span className="font-bold text-navy-900">Added or fixed a mapping?</span> Re-run matching against the current
            register — only partner/service resolution changes; invalid source values stay flagged.
          </div>
          <div className="flex flex-wrap gap-2">
            {uploadsWithUnresolved.slice(0, 4).map((id) => (
              <RematchButton key={id} uploadId={id} filename={uploadById.get(id)?.filename ?? "upload"} />
            ))}
          </div>
        </Card>
      )}

      <Card className="anim-fade-up">
        <CardHeader title={`${rows.length}${rows.length === 200 ? "+" : ""} unresolved rows`} subtitle="Traceable to the original source row numbers of each uploaded file" />
        {rows.length === 0 ? (
          <EmptyState
            icon={<CircleCheck />}
            title="Everything is matched"
            hint="No unresolved rows across imported uploads. New uploads keep validating against the register automatically."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Source</Th>
                  <Th>Date</Th>
                  <Th>Service partner</Th>
                  <Th>Service ID</Th>
                  <Th>Product</Th>
                  <Th>Reason</Th>
                  <Th>Flag</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="transition hover:bg-slate-50/60">
                    <Td>
                      <p className="max-w-[180px] truncate text-[11.5px] font-semibold text-navy-900" title={uploadById.get(r.uploadId)?.filename}>
                        {uploadById.get(r.uploadId)?.filename ?? "upload"}
                      </p>
                      <p className="font-mono text-[10.5px] text-slate-400">row #{r.sourceRow} · {timeAgo(uploadById.get(r.uploadId)?.createdAt)}</p>
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-[11.5px] text-slate-600">{r.logDate || <span className="text-rose-600">{r.rawDate || "—"}</span>}</Td>
                    <Td className="max-w-[180px] truncate text-[12px] font-semibold text-slate-700" title={r.servicePartner}>{r.servicePartner || "—"}</Td>
                    <Td className="font-mono text-[11.5px] text-slate-600">{r.serviceId || "—"}</Td>
                    <Td className="max-w-[160px] truncate text-[11.5px] text-slate-500" title={r.productName}>{r.productName || "—"}</Td>
                    <Td className="max-w-[280px]">
                      <p className="text-[11.5px] leading-snug text-slate-500" title={r.validationMessage}>{r.validationMessage || "—"}</p>
                    </Td>
                    <Td><StatusBadge status={r.matchStatus} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-[11px] text-slate-400">
        Last upload activity: {allUploads[0] ? formatDateTime(allUploads[0].createdAt) : "—"} · Showing up to 200 rows{filterUpload ? " (filtered)" : ""}.
      </p>
    </div>
  );
}
