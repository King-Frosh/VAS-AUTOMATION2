import { db } from "@/db";
import {
  emailDeliveries,
  emailDeliveryAttempts,
  emailTemplates,
  partnerReports,
  partners,
  reportBatches,
  uploads,
  vasLogRows,
  type PartnerReport,
} from "@/db/schema";
import { and, eq, gte, lte, inArray, desc } from "drizzle-orm";
import { putPrivateBlob, readPrivateBlob } from "@/lib/blob-storage";
import { generateWorkbook, validateWorkbook } from "@/lib/excel";
import { sanitizeFilenameComponent, isValidEmail } from "@/lib/utils";
import { renderTemplate, unresolvedPlaceholders } from "@/lib/templates";
import { getSmtpSettings, sendMail, smtpConfigured } from "@/lib/mailer";
import { getSettingInt, audit } from "@/lib/audit";
import { DEFAULT_SUBJECT, DEFAULT_BODY } from "@/lib/templates";


/* ------------------------------------------------------------------ */
/* Batch + report generation                                           */
/* ------------------------------------------------------------------ */

export interface GenerateResult {
  ok: boolean;
  batchId?: string;
  reportCount?: number;
  error?: string;
}

export async function generateReports(
  uploadId: string,
  startDate: string,
  endDate: string,
  actor: string,
  trigger: "MANUAL" | "AUTO"
): Promise<GenerateResult> {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(startDate) || !dateRe.test(endDate) || startDate > endDate) {
    return { ok: false, error: "Invalid reporting period. Dates must be YYYY-MM-DD and the start date must not be after the end date." };
  }

  const uploadRows = await db.select().from(uploads).where(eq(uploads.id, uploadId)).limit(1);
  const upload = uploadRows[0];
  if (!upload) return { ok: false, error: "Upload not found." };
  if (upload.status !== "READY_FOR_REVIEW" && upload.totalRows === 0) {
    return { ok: false, error: "This upload has not been processed successfully yet." };
  }

  const [batch] = await db
    .insert(reportBatches)
    .values({ uploadId, startDate, endDate, trigger, status: "PROCESSING", createdByName: actor })
    .returning();

  try {
    const rows = await db
      .select()
      .from(vasLogRows)
      .where(
        and(
          eq(vasLogRows.uploadId, uploadId),
          gte(vasLogRows.logDate, startDate),
          lte(vasLogRows.logDate, endDate)
        )
      );

    const validRows = rows.filter((r) => r.logDate);
    const matched = validRows.filter((r) => r.matchStatus === "MATCHED" && r.partnerId);
    const unmatched = validRows.filter((r) => r.matchStatus !== "MATCHED");
    const invalid = rows.filter((r) => !r.logDate || r.matchStatus === "INVALID");

    // Group matched rows by partner + service
    const groups = new Map<string, typeof matched>();
    for (const r of matched) {
      const key = `${r.partnerId}::${r.serviceId}::${r.serviceName}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    const partnerIds = [...new Set(matched.map((r) => r.partnerId!))];
    const partnerRows = partnerIds.length
      ? await db.select().from(partners).where(inArray(partners.id, partnerIds))
      : [];
    const partnerById = new Map(partnerRows.map((p) => [p.id, p]));

    let reportCount = 0;
    for (const groupRows of groups.values()) {
      const first = groupRows[0];
      const partner = partnerById.get(first.partnerId!);
      if (!partner) continue;

      groupRows.sort((a, b) => a.sourceRow - b.sourceRow);
      const buffer = generateWorkbook(
        groupRows.map((r) => ({
          logDate: r.logDate,
          servicePartner: r.servicePartner,
          serviceId: r.serviceId,
          pricePoint: r.pricePoint,
          productId: r.productId,
          productName: r.productName,
          transaction: r.transaction,
          count: r.count,
          revenue: Number(r.revenue),
        }))
      );

      const servicePart = sanitizeFilenameComponent(first.serviceName.toUpperCase()) || "SERVICE";
      const codePart = sanitizeFilenameComponent(partner.code.toUpperCase()) || "PARTNER";
      const filename = `BRICCS_VAS_Report_${codePart}_${servicePart}_${startDate}_${endDate}.xlsx`;
      // Generate in memory and persist the report to private Vercel Blob storage.
      const filePath = await putPrivateBlob(`reports/${batch.id}/${filename}`, buffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      const totalRevenue = groupRows.reduce((acc, r) => acc + Number(r.revenue), 0);
      const totalCount = groupRows.reduce((acc, r) => acc + r.count, 0);

      await db.insert(partnerReports).values({
        batchId: batch.id,
        uploadId,
        partnerId: partner.id,
        partnerCode: partner.code,
        partnerName: partner.name,
        serviceId: first.serviceId,
        serviceName: first.serviceName,
        startDate,
        endDate,
        recordCount: groupRows.length,
        totalCount,
        totalRevenue: totalRevenue.toFixed(4),
        filename,
        filePath,
        fileSize: buffer.length,
        status: "READY_TO_SEND",
      });
      reportCount++;
    }

    const sourceRevenue = validRows.reduce((acc, r) => acc + Number(r.revenue), 0);
    const matchedRevenue = matched.reduce((acc, r) => acc + Number(r.revenue), 0);

    await db
      .update(reportBatches)
      .set({
        status: "READY_TO_SEND",
        sourceTotal: validRows.length,
        matchedTotal: matched.length,
        unmatchedTotal: unmatched.length,
        invalidTotal: invalid.length,
        sourceRevenue: sourceRevenue.toFixed(4),
        matchedRevenue: matchedRevenue.toFixed(4),
        reportCount,
      })
      .where(eq(reportBatches.id, batch.id));

    await audit(actor, "REPORTS_GENERATED", "report_batch", batch.id, {
      uploadId, startDate, endDate, trigger, reportCount,
      matched: matched.length, unmatched: unmatched.length, invalid: invalid.length,
    });

    return { ok: true, batchId: batch.id, reportCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(reportBatches).set({ status: "FAILED" }).where(eq(reportBatches.id, batch.id));
    return { ok: false, error: `Report generation failed: ${message}` };
  }
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

async function getTemplate(): Promise<{ subject: string; body: string }> {
  const rows = await db.select().from(emailTemplates).where(eq(emailTemplates.name, "default")).limit(1);
  return rows[0] ? { subject: rows[0].subject, body: rows[0].body } : { subject: DEFAULT_SUBJECT, body: DEFAULT_BODY };
}

export interface SendResult {
  ok: boolean;
  deliveryId?: string;
  error?: string;
}

/**
 * Send (or resend) a single partner report email with its required workbook.
 * Idempotent: only reports in READY_TO_SEND or FAILED state can be claimed;
 * an explicit resend of a SENT report creates a new delivery record.
 */
export async function sendReportEmail(
  reportId: string,
  opts: { actor: string; trigger: "MANUAL" | "BULK" | "AUTO"; resendOf?: string }
): Promise<SendResult> {
  // Idempotent claim (skip when this is an authorized resend of a SENT report)
  const claimable = opts.resendOf ? ["SENT" as const] : ["READY_TO_SEND" as const, "FAILED" as const];
  const claimed = await db
    .update(partnerReports)
    .set({ status: "SENDING", lastError: "" })
    .where(and(eq(partnerReports.id, reportId), inArray(partnerReports.status, claimable)))
    .returning();

  const report = claimed[0];
  if (!report) {
    return { ok: false, error: "Report is not in a sendable state (already sending or sent)." };
  }

  const fail = async (error: string): Promise<SendResult> => {
    await db.update(partnerReports).set({ status: "FAILED", lastError: error }).where(eq(partnerReports.id, report.id));
    await rollupBatchStatus(report.batchId);
    return { ok: false, error };
  };

  // 1. Partner & recipient
  if (!report.partnerId) return fail("Report is not linked to a partner.");
  const partnerRows = await db.select().from(partners).where(eq(partners.id, report.partnerId)).limit(1);
  const partner = partnerRows[0];
  if (!partner) return fail("Partner no longer exists in the register.");
  const recipient = partner.email.trim();
  if (!recipient || !isValidEmail(recipient)) {
    return fail(`No valid recipient email for ${partner.name}. Set the primary recipient in the Partner Register.`);
  }

  // 2. SMTP must be configured
  const smtp = await getSmtpSettings();
  if (!smtpConfigured(smtp)) {
    return fail("SMTP is not fully configured. Complete the Email Settings before sending.");
  }

  // 3. Attachment: must exist, be readable, within size limits and structurally valid
  let attachment: Buffer;
  try {
    attachment = await readPrivateBlob(report.filePath);
  } catch {
    return fail(`Attachment "${report.filename}" is missing or unreadable. Regenerate the report before sending.`);
  }
  const maxKb = await getSettingInt("attachment_max_kb", 10240);
  if (attachment.length > maxKb * 1024) {
    return fail(`Attachment exceeds the configured limit of ${maxKb} KB.`);
  }
  const structural = validateWorkbook(attachment);
  if (!structural.ok) {
    return fail(`Attachment failed validation: ${structural.error} Regenerate the report before sending.`);
  }

  // 4. Template: all placeholders must resolve
  const template = await getTemplate();
  const ctx = {
    partnerEmail: recipient,
    partnerName: partner.name,
    serviceName: report.serviceName,
    startDate: report.startDate,
    endDate: report.endDate,
  };
  const subject = renderTemplate(template.subject, ctx);
  const body = renderTemplate(template.body, ctx);
  const unresolved = [...unresolvedPlaceholders(subject), ...unresolvedPlaceholders(body)];
  if (unresolved.length) {
    return fail(`Unresolved template placeholders: ${unresolved.join(", ")}. Fix the email template before sending.`);
  }

  // 5. Create the delivery record with full snapshots
  const [delivery] = await db
    .insert(emailDeliveries)
    .values({
      reportId: report.id,
      batchId: report.batchId,
      partnerId: partner.id,
      recipient,
      cc: partner.ccEmails || "",
      subject,
      body,
      attachmentFilename: report.filename,
      attachmentPath: report.filePath,
      attachmentSize: attachment.length,
      status: "SENDING",
      trigger: opts.resendOf ? "RESEND" : opts.trigger,
      resendOf: opts.resendOf ?? null,
      sentBy: opts.actor,
      attempts: 1,
    })
    .returning();

  // 6. Transmit
  const result = await sendMail(smtp!, {
    to: recipient,
    cc: partner.ccEmails || undefined,
    subject,
    text: body,
    attachment: { filename: report.filename, content: attachment },
  });

  await db.insert(emailDeliveryAttempts).values({
    deliveryId: delivery.id,
    attemptNumber: 1,
    status: result.ok ? "SENT" : "FAILED",
    error: result.error,
    providerResponse: result.response,
    durationMs: result.durationMs,
  });

  if (result.ok) {
    const now = new Date();
    await db
      .update(emailDeliveries)
      .set({ status: "SENT", messageId: result.messageId, providerResponse: result.response, sentAt: now })
      .where(eq(emailDeliveries.id, delivery.id));
    await db
      .update(partnerReports)
      .set({ status: "SENT", sentAt: now, lastError: "" })
      .where(eq(partnerReports.id, report.id));
    await audit(opts.actor, opts.resendOf ? "EMAIL_RESENT" : "EMAIL_SENT", "email_delivery", delivery.id, {
      reportId: report.id, recipient, subject, attachment: report.filename, provider: result.response,
    });
  } else {
    await db
      .update(emailDeliveries)
      .set({ status: "FAILED", error: result.error })
      .where(eq(emailDeliveries.id, delivery.id));
    await db
      .update(partnerReports)
      .set({ status: "FAILED", lastError: result.error })
      .where(eq(partnerReports.id, report.id));
    await audit(opts.actor, "EMAIL_FAILED", "email_delivery", delivery.id, {
      reportId: report.id, recipient, error: result.error,
    });
  }

  await rollupBatchStatus(report.batchId);
  return result.ok ? { ok: true, deliveryId: delivery.id } : { ok: false, deliveryId: delivery.id, error: result.error };
}

export async function rollupBatchStatus(batchId: string): Promise<void> {
  const reports = await db.select().from(partnerReports).where(eq(partnerReports.batchId, batchId));
  if (reports.length === 0) return;
  const statuses = reports.map((r) => r.status);
  let status = "READY_TO_SEND";
  if (statuses.every((s) => s === "SENT")) status = "SENT";
  else if (statuses.every((s) => s === "FAILED")) status = "FAILED";
  else if (statuses.some((s) => s === "SENDING")) status = "SENDING";
  else if (statuses.some((s) => s === "FAILED") || (statuses.some((s) => s === "SENT") && statuses.some((s) => s === "READY_TO_SEND")))
    status = "PARTIALLY_FAILED";
  await db.update(reportBatches).set({ status }).where(eq(reportBatches.id, batchId));
}

/** Eligible reports for bulk/auto sending within a batch. */
export async function getSendableReports(batchId?: string): Promise<PartnerReport[]> {
  const conditions = [inArray(partnerReports.status, ["READY_TO_SEND", "FAILED"])];
  if (batchId) conditions.push(eq(partnerReports.batchId, batchId));
  return db.select().from(partnerReports).where(and(...conditions)).orderBy(desc(partnerReports.createdAt));
}
