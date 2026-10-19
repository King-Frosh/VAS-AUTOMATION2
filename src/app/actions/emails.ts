"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { emailDeliveries, partnerReports, partners, emailTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, requireRole } from "@/lib/auth";
import { sendReportEmail } from "@/lib/reports";
import { renderTemplate } from "@/lib/templates";
import { DEFAULT_SUBJECT, DEFAULT_BODY } from "@/lib/templates";

export async function sendSingleReport(
  reportId: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN", "OPS"]);
  const res = await sendReportEmail(reportId, { actor: user.username, trigger: "MANUAL" });
  revalidatePath("/email-centre");
  revalidatePath("/reports");
  revalidatePath("/deliveries");
  revalidatePath("/processing");
  return { ok: res.ok, error: res.error };
}

export async function bulkSendReports(
  reportIds: string[]
): Promise<{ ok: boolean; sent: number; failed: number; errors: string[] }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN", "OPS"]);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const id of reportIds.slice(0, 200)) {
    const res = await sendReportEmail(id, { actor: user.username, trigger: "BULK" });
    if (res.ok) sent++;
    else {
      failed++;
      if (res.error) errors.push(res.error);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  revalidatePath("/email-centre");
  revalidatePath("/reports");
  revalidatePath("/deliveries");
  revalidatePath("/processing");
  return { ok: failed === 0, sent, failed, errors: errors.slice(0, 5) };
}

export async function resendDelivery(
  deliveryId: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN", "OPS"]);
  const rows = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, deliveryId)).limit(1);
  const delivery = rows[0];
  if (!delivery?.reportId) return { ok: false, error: "This delivery is not linked to a report and cannot be resent." };
  const res = await sendReportEmail(delivery.reportId, { actor: user.username, trigger: "MANUAL", resendOf: deliveryId });
  revalidatePath("/deliveries");
  revalidatePath("/reports");
  revalidatePath("/email-centre");
  return { ok: res.ok, error: res.error };
}

export interface EmailPreview {
  to: string;
  cc: string;
  subject: string;
  body: string;
  attachment: string;
  partnerName: string;
  ready: boolean;
  problems: string[];
}

export async function previewReportEmail(reportId: string): Promise<EmailPreview | null> {
  await requireUser();
  const rows = await db.select().from(partnerReports).where(eq(partnerReports.id, reportId)).limit(1);
  const report = rows[0];
  if (!report) return null;

  const problems: string[] = [];
  let partner = null;
  if (report.partnerId) {
    partner = (await db.select().from(partners).where(eq(partners.id, report.partnerId)).limit(1))[0] ?? null;
  }
  const recipient = partner?.email?.trim() ?? "";
  if (!recipient) problems.push("Partner has no primary recipient email configured.");

  const tpl = (await db.select().from(emailTemplates).where(eq(emailTemplates.name, "default")).limit(1))[0];
  const subject = renderTemplate(tpl?.subject ?? DEFAULT_SUBJECT, {
    partnerEmail: recipient,
    partnerName: partner?.name ?? "",
    serviceName: report.serviceName,
    startDate: report.startDate,
    endDate: report.endDate,
  });
  const body = renderTemplate(tpl?.body ?? DEFAULT_BODY, {
    partnerEmail: recipient,
    partnerName: partner?.name ?? "",
    serviceName: report.serviceName,
    startDate: report.startDate,
    endDate: report.endDate,
  });

  return {
    to: recipient,
    cc: partner?.ccEmails ?? "",
    subject,
    body,
    attachment: report.filename,
    partnerName: partner?.name ?? report.partnerName,
    ready: problems.length === 0,
    problems,
  };
}
