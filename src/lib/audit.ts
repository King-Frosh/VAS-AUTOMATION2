import { db } from "@/db";
import { auditLogs, systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function audit(
  actor: string,
  action: string,
  entityType = "",
  entityId = "",
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actor,
      action,
      entityType,
      entityId,
      details: JSON.stringify(details),
    });
  } catch {
    // auditing must never break the main flow
  }
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  return rows[0]?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(systemSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value } });
}

export async function getSettingInt(key: string, fallback: number): Promise<number> {
  const v = await getSetting(key, String(fallback));
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
