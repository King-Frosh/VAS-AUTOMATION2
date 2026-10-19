import { db } from "@/db";
import { automationSettings, uploads, partners, partnerReports } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { generateReports, sendReportEmail } from "@/lib/reports";
import { audit } from "@/lib/audit";

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY";

/** Wall-clock parts of `now` in the given IANA timezone (treated as if UTC for date math). */
function wallParts(now: Date, tz: string): { y: number; m: number; d: number; hh: number; mm: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) parts[p.type] = p.value;
  return { y: +parts.year, m: +parts.month, d: +parts.day, hh: +parts.hour, mm: +parts.minute };
}

function offsetMs(now: Date, tz: string): number {
  const w = wallParts(now, tz);
  return Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm) - now.getTime();
}

/** Next scheduled instant (UTC Date) for HH:MM in the given timezone, advancing by frequency. */
export function computeNextRun(now: Date, timeOfDay: string, tz: string, frequency: Frequency): Date {
  const [hh, mm] = timeOfDay.split(":").map(Number);
  const off = offsetMs(now, tz);
  const w = wallParts(now, tz);
  let candidate = Date.UTC(w.y, w.m - 1, w.d, hh, mm) - off;
  if (candidate <= now.getTime()) {
    const base = new Date(Date.UTC(w.y, w.m - 1, w.d));
    if (frequency === "DAILY") base.setUTCDate(base.getUTCDate() + 1);
    else if (frequency === "WEEKLY") base.setUTCDate(base.getUTCDate() + 7);
    else base.setUTCMonth(base.getUTCMonth() + 1);
    candidate = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hh, mm) - offsetMs(base, tz);
  }
  return new Date(candidate);
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Resolve the reporting period covered by an automation run. */
export function resolvePeriod(now: Date, frequency: Frequency, tz: string): { start: string; end: string } {
  const w = wallParts(now, tz);
  const todayWall = new Date(Date.UTC(w.y, w.m - 1, w.d));
  if (frequency === "DAILY") {
    const y = new Date(todayWall);
    y.setUTCDate(y.getUTCDate() - 1);
    return { start: y.toISOString().slice(0, 10), end: y.toISOString().slice(0, 10) };
  }
  if (frequency === "WEEKLY") {
    const dow = (todayWall.getUTCDay() + 6) % 7; // 0 = Monday
    const thisMonday = new Date(todayWall);
    thisMonday.setUTCDate(thisMonday.getUTCDate() - dow);
    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setUTCDate(lastSunday.getUTCDate() - 1);
    return { start: lastMonday.toISOString().slice(0, 10), end: lastSunday.toISOString().slice(0, 10) };
  }
  // MONTHLY: previous calendar month
  const firstOfThisMonth = new Date(Date.UTC(w.y, w.m - 1, 1));
  const lastOfPrev = new Date(firstOfThisMonth);
  lastOfPrev.setUTCDate(0);
  const firstOfPrev = new Date(Date.UTC(lastOfPrev.getUTCFullYear(), lastOfPrev.getUTCMonth(), 1));
  return {
    start: toISO(firstOfPrev.getUTCFullYear(), firstOfPrev.getUTCMonth() + 1, 1),
    end: toISO(lastOfPrev.getUTCFullYear(), lastOfPrev.getUTCMonth() + 1, lastOfPrev.getUTCDate()),
  };
}

export interface AutomationRunResult {
  ok: boolean;
  message: string;
  sent: number;
  failed: number;
  skipped: number;
  period?: { start: string; end: string };
}

/** Run the scheduled (or manually triggered) automatic distribution. */
export async function runAutomation(trigger: "SCHEDULED" | "MANUAL", actor: string): Promise<AutomationRunResult> {
  const rows = await db.select().from(automationSettings).limit(1);
  const settings = rows[0];
  if (!settings) return { ok: false, message: "Automation settings not initialised.", sent: 0, failed: 0, skipped: 0 };
  if (!settings.enabled && trigger === "SCHEDULED") {
    return { ok: false, message: "Automation is disabled.", sent: 0, failed: 0, skipped: 0 };
  }

  const tz = settings.timezone || "Africa/Lagos";
  const period = resolvePeriod(new Date(), settings.frequency as Frequency, tz);

  // Latest successfully processed upload is the data source
  const uploadRows = await db
    .select()
    .from(uploads)
    .where(eq(uploads.status, "READY_FOR_REVIEW"))
    .orderBy(desc(uploads.createdAt))
    .limit(1);
  const upload = uploadRows[0];
  if (!upload) {
    const message = "No processed upload available. Upload and validate an MTN log file first.";
    await finishRun(settings.id, message);
    return { ok: false, message, sent: 0, failed: 0, skipped: 0, period };
  }

  const gen = await generateReports(upload.id, period.start, period.end, actor, "AUTO");
  if (!gen.ok || !gen.batchId) {
    const message = gen.error ?? "Report generation failed.";
    await finishRun(settings.id, `FAILED: ${message}`);
    return { ok: false, message, sent: 0, failed: 0, skipped: 0, period };
  }

  if ((gen.reportCount ?? 0) === 0) {
    const message = `No eligible partner-service reports for ${period.start} to ${period.end}.`;
    await finishRun(settings.id, message);
    await audit(actor, "AUTOMATION_RUN", "report_batch", gen.batchId, { trigger, period, result: message });
    return { ok: true, message, sent: 0, failed: 0, skipped: 0, period };
  }

  // Only partners with automatic delivery enabled are auto-sent
  const autoPartners = new Set(
    (await db.select({ id: partners.id }).from(partners).where(and(eq(partners.autoSend, true), eq(partners.active, true)))).map((p) => p.id)
  );
  const batchReports = await db.select().from(partnerReports).where(eq(partnerReports.batchId, gen.batchId));

  let sent = 0, failed = 0, skipped = 0;
  for (const report of batchReports) {
    if (!report.partnerId || !autoPartners.has(report.partnerId)) {
      skipped++;
      continue;
    }
    const res = await sendReportEmail(report.id, { actor, trigger: "AUTO" });
    if (res.ok) sent++;
    else failed++;
    // Be polite to the SMTP provider between sends
    await new Promise((r) => setTimeout(r, 300));
  }

  const message = `Period ${period.start} → ${period.end}: ${sent} sent, ${failed} failed, ${skipped} skipped (auto-delivery off).`;
  await finishRun(settings.id, message);
  await audit(actor, "AUTOMATION_RUN", "report_batch", gen.batchId, { trigger, period, sent, failed, skipped });
  return { ok: failed === 0, message, sent, failed, skipped, period };

  async function finishRun(id: string, result: string) {
    const nextRun = computeNextRun(new Date(), settings.timeOfDay, tz, settings.frequency as Frequency);
    await db
      .update(automationSettings)
      .set({ lastRunAt: new Date(), nextRunAt: nextRun, lastResult: result, updatedAt: new Date() })
      .where(eq(automationSettings.id, id));
  }
}

/** Called by the cron tick endpoint — runs automation if it is due. */
export async function runDueAutomation(): Promise<{ ran: boolean; result: string }> {
  const rows = await db.select().from(automationSettings).limit(1);
  const settings = rows[0];
  if (!settings || !settings.enabled) return { ran: false, result: "Automation disabled." };
  if (settings.nextRunAt && settings.nextRunAt.getTime() > Date.now()) {
    return { ran: false, result: `Not due until ${settings.nextRunAt.toISOString()}.` };
  }
  const res = await runAutomation("SCHEDULED", "automation");
  return { ran: true, result: res.message };
}
