import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { uploads, vasLogRows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, canOperate } from "@/lib/auth";
import { ensureDefaults } from "@/lib/seed";
import { parseSourceFile } from "@/lib/excel";
import { sha256Hex } from "@/lib/crypto";
import { loadRegister, matchOne } from "@/lib/matching";
import { getSettingInt, audit } from "@/lib/audit";
import path from "path";
import { putPrivateBlob } from "@/lib/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

export async function POST(req: NextRequest) {
  try {
    await ensureDefaults();
    const user = await getCurrentUser();
    if (!user || !canOperate(user.role)) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file was provided." }, { status: 400 });
    }

    const filename = file.name || "upload";
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { ok: false, error: `Unsupported file type "${ext}". Only .xlsx, .xls and .csv files are accepted.` },
        { status: 400 }
      );
    }

    const maxMb = await getSettingInt("upload_max_mb", 25);
    if (file.size > maxMb * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: `File exceeds the ${maxMb} MB upload limit. Adjust the limit under System Settings if needed.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = sha256Hex(buffer);

    // Duplicate content warning (does not block)
    const duplicate = await db.select().from(uploads).where(eq(uploads.fileHash, hash)).limit(1);
    const duplicateOf = duplicate[0]?.id ?? null;

    // Persist the original file in private Vercel Blob storage; no public URL is exposed.
    const safeName = `${Date.now()}_${filename.replace(/[^\w.\-]+/g, "_").slice(-80)}`;
    const filePath = await putPrivateBlob(`source-logs/${safeName}`, buffer, file.type || "application/octet-stream");

    // Parse & validate
    const parsed = parseSourceFile(buffer, filename);

    const [upload] = await db
      .insert(uploads)
      .values({
        filename,
        fileHash: hash,
        filePath,
        fileSize: file.size,
        uploadedBy: user.id,
        uploaderName: user.username,
        status: parsed.ok ? "READY_FOR_REVIEW" : "FAILED",
        errorMessage: parsed.ok ? "" : parsed.errors.join(" "),
        totalRows: parsed.rows.length,
        invalidRows: parsed.ok ? parsed.rows.filter((r) => r.errors.length > 0).length : 0,
        minDate: parsed.minDate,
        maxDate: parsed.maxDate,
        duplicateOf,
      })
      .returning();

    if (!parsed.ok) {
      await audit(user.username, "UPLOAD_FAILED", "upload", upload.id, { filename, errors: parsed.errors });
      return NextResponse.json({
        ok: false,
        uploadId: upload.id,
        error: parsed.errors.join(" "),
      });
    }

    // Match rows against register
    const register = await loadRegister();
    const matchedRowsData = parsed.rows.map((row) => {
      const outcome = matchOne(register, row);
      return { row, outcome };
    });

    const CHUNK = 400;
    for (let i = 0; i < matchedRowsData.length; i += CHUNK) {
      await db.insert(vasLogRows).values(
        matchedRowsData.slice(i, i + CHUNK).map(({ row, outcome }) => ({
          uploadId: upload.id,
          sourceRow: row.sourceRow,
          logDate: row.logDate,
          rawDate: row.rawDate,
          servicePartner: row.servicePartner,
          serviceId: row.serviceId,
          pricePoint: row.pricePoint,
          productId: row.productId,
          productName: row.productName,
          transaction: row.transaction,
          count: row.count,
          revenue: row.revenue.toFixed(4),
          partnerId: outcome.partnerId,
          serviceName: outcome.serviceName,
          matchStatus: outcome.matchStatus,
          validationMessage: outcome.validationMessage,
        }))
      );
    }

    const matched = matchedRowsData.filter((m) => m.outcome.matchStatus === "MATCHED").length;
    const invalid = matchedRowsData.filter((m) => m.outcome.matchStatus === "INVALID").length;
    const unmatched = parsed.rows.length - matched - invalid;

    await db
      .update(uploads)
      .set({ matchedRows: matched, invalidRows: invalid, unmatchedRows: unmatched })
      .where(eq(uploads.id, upload.id));

    await audit(user.username, "UPLOAD_PROCESSED", "upload", upload.id, {
      filename, total: parsed.rows.length, matched, unmatched, invalid,
      duplicate: duplicateOf ? duplicate[0]?.filename : null,
    });

    return NextResponse.json({
      ok: true,
      upload: {
        id: upload.id,
        filename,
        total: parsed.rows.length,
        matched,
        unmatched,
        invalid,
        minDate: parsed.minDate,
        maxDate: parsed.maxDate,
        duplicateOfId: duplicateOf,
        duplicateFilename: duplicate[0]?.filename ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `Upload failed: ${message}` }, { status: 500 });
  }
}
