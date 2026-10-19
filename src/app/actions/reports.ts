"use server";

import { db } from "@/db";
import { partnerReports, vasLogRows } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

export interface PreviewRow {
  logDate: string;
  servicePartner: string;
  serviceId: string;
  pricePoint: string;
  productId: string;
  productName: string;
  transaction: string;
  count: number;
  revenue: string;
}

export async function getReportRows(reportId: string): Promise<{ title: string; rows: PreviewRow[]; total: number } | null> {
  await requireUser(); // any authenticated role may preview
  const r = (await db.select().from(partnerReports).where(eq(partnerReports.id, reportId)).limit(1))[0];
  if (!r) return null;

  const rows = await db
    .select()
    .from(vasLogRows)
    .where(
      and(
        eq(vasLogRows.uploadId, r.uploadId),
        eq(vasLogRows.partnerId, r.partnerId ?? ""),
        eq(vasLogRows.serviceName, r.serviceName),
        eq(vasLogRows.matchStatus, "MATCHED"),
        gte(vasLogRows.logDate, r.startDate),
        lte(vasLogRows.logDate, r.endDate)
      )
    )
    .limit(25);

  return {
    title: `${r.partnerName} — ${r.serviceName} (${r.startDate} → ${r.endDate})`,
    total: r.recordCount,
    rows: rows.map((x) => ({
      logDate: x.logDate,
      servicePartner: x.servicePartner,
      serviceId: x.serviceId,
      pricePoint: x.pricePoint,
      productId: x.productId,
      productName: x.productName,
      transaction: x.transaction,
      count: x.count,
      revenue: x.revenue,
    })),
  };
}
