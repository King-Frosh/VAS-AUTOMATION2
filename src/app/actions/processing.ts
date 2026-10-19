"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { uploads, vasLogRows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, requireRole } from "@/lib/auth";
import { generateReports } from "@/lib/reports";
import { rematchUpload } from "@/lib/matching";
import { audit } from "@/lib/audit";
import { deletePrivateBlob } from "@/lib/blob-storage";

export async function generateBatchAction(
  uploadId: string,
  startDate: string,
  endDate: string
): Promise<{ ok: boolean; error?: string; batchId?: string; reportCount?: number }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN", "OPS"]);
  const result = await generateReports(uploadId, startDate, endDate, user.username, "MANUAL");
  revalidatePath("/processing");
  revalidatePath("/reports");
  revalidatePath("/email-centre");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, batchId: result.batchId, reportCount: result.reportCount };
}

export async function rematchUploadAction(uploadId: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN", "OPS"]);
  const { matched, unresolved } = await rematchUpload(uploadId);

  const rows = await db.select({ matchStatus: vasLogRows.matchStatus }).from(vasLogRows).where(eq(vasLogRows.uploadId, uploadId));
  const matchedCount = rows.filter((r) => r.matchStatus === "MATCHED").length;
  const invalidCount = rows.filter((r) => r.matchStatus === "INVALID").length;
  await db
    .update(uploads)
    .set({ matchedRows: matchedCount, invalidRows: invalidCount, unmatchedRows: rows.length - matchedCount - invalidCount })
    .where(eq(uploads.id, uploadId));

  await audit(user.username, "UPLOAD_REMATCHED", "upload", uploadId, { matched, unresolved });
  revalidatePath("/unmatched");
  revalidatePath("/uploads");
  revalidatePath("/processing");
  return { ok: true, message: `Re-matching complete: ${matched} rows matched, ${unresolved} still unresolved.` };
}

export async function deleteUploadAction(uploadId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);
  const rows = await db.select().from(uploads).where(eq(uploads.id, uploadId)).limit(1);
  if (rows[0]) {
    await deletePrivateBlob(rows[0].filePath).catch(() => {});
    await db.delete(uploads).where(eq(uploads.id, uploadId));
    await audit(user.username, "UPLOAD_DELETED", "upload", uploadId, { filename: rows[0].filename });
  }
  revalidatePath("/uploads");
  return { ok: true };
}
