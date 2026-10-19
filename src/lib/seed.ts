import { db } from "@/db";
import { users, emailTemplates, automationSettings, systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/crypto";
import { DEFAULT_SUBJECT, DEFAULT_BODY } from "@/lib/templates";
import { computeNextRun } from "@/lib/automation";

let seeded = false;

/** Idempotent first-run bootstrap: default admin, default template, automation row, system limits. */
export async function ensureDefaults(): Promise<void> {
  if (seeded) return;
  seeded = true;
  try {
    const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
    if (existingUsers.length === 0) {
      const username = process.env.ADMIN_USERNAME || "admin";
      const password = process.env.ADMIN_PASSWORD || "BRICCS@2026";
      await db.insert(users).values({
        username,
        fullName: "System Administrator",
        role: "ADMIN",
        passwordHash: hashPassword(password),
      });
    }

    const template = await db.select().from(emailTemplates).where(eq(emailTemplates.name, "default")).limit(1);
    if (template.length === 0) {
      await db.insert(emailTemplates).values({ name: "default", subject: DEFAULT_SUBJECT, body: DEFAULT_BODY, updatedBy: "system" });
    }

    const automation = await db.select().from(automationSettings).limit(1);
    if (automation.length === 0) {
      await db.insert(automationSettings).values({
        enabled: false,
        frequency: "DAILY",
        timeOfDay: "07:00",
        timezone: "Africa/Lagos",
        nextRunAt: computeNextRun(new Date(), "07:00", "Africa/Lagos", "DAILY"),
      });
    }

    const defaults: Record<string, string> = {
      upload_max_mb: "25",
      attachment_max_kb: "10240",
      retention_days: "365",
    };
    for (const [key, value] of Object.entries(defaults)) {
      await db.insert(systemSettings).values({ key, value }).onConflictDoNothing();
    }
  } catch (err) {
    seeded = false; // retry on next request
    console.error("ensureDefaults failed:", err);
  }
}
