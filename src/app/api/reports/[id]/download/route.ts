import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { partnerReports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { readPrivateBlob } from "@/lib/blob-storage";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const rows = await db.select().from(partnerReports).where(eq(partnerReports.id, id)).limit(1);
  const report = rows[0];
  if (!report) return NextResponse.json({ ok: false, error: "Report not found." }, { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await readPrivateBlob(report.filePath);
  } catch {
    return NextResponse.json(
      { ok: false, error: "The workbook file is missing from storage. Regenerate the report." },
      { status: 410 }
    );
  }

  await audit(user.username, "REPORT_DOWNLOADED", "partner_report", report.id, { filename: report.filename });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
