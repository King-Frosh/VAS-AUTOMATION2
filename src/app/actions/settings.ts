"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { smtpSettings, emailTemplates, automationSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, requireRole } from "@/lib/auth";
import { encryptSecret, hashPassword } from "@/lib/crypto";
import { getSmtpSettings, testSmtpConnection, sendMail, smtpConfigured } from "@/lib/mailer";
import { runAutomation, computeNextRun, type Frequency } from "@/lib/automation";
import { audit, setSetting } from "@/lib/audit";
import { DEFAULT_SUBJECT, DEFAULT_BODY } from "@/lib/templates";
import { isValidEmail } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* SMTP settings                                                       */
/* ------------------------------------------------------------------ */

export interface SmtpInput {
  host: string;
  port: number;
  login: string;
  password: string; // empty → keep existing
  fromName: string;
  fromEmail: string;
  security: string;
  testEmail: string;
}

export async function saveSmtpSettings(input: SmtpInput): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);

  if (!input.host.trim() || !input.port || !input.login.trim()) {
    return { ok: false, error: "SMTP Server, Port and Login are required." };
  }
  if (input.fromEmail && !isValidEmail(input.fromEmail)) return { ok: false, error: "From Email is invalid." };
  if (input.testEmail && !isValidEmail(input.testEmail)) return { ok: false, error: "Test Email Address is invalid." };

  const existing = await getSmtpSettings();
  const passwordPlain = input.password.trim();
  if (!existing?.passwordEnc && !passwordPlain) {
    return { ok: false, error: "Password is required for the initial SMTP setup." };
  }
  const passwordEnc = passwordPlain ? encryptSecret(passwordPlain) : existing!.passwordEnc;

  const values = {
    host: input.host.trim(),
    port: input.port,
    login: input.login.trim(),
    passwordEnc,
    fromName: input.fromName.trim(),
    fromEmail: input.fromEmail.trim(),
    security: input.security,
    testEmail: input.testEmail.trim(),
    lastTestOk: false, // credentials changed → must retest
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(smtpSettings).set(values).where(eq(smtpSettings.id, existing.id));
  } else {
    await db.insert(smtpSettings).values(values);
  }
  await audit(user.username, "SMTP_SETTINGS_SAVED", "smtp_settings", "", {
    host: values.host, port: values.port, login: values.login, security: values.security,
    passwordChanged: !!passwordPlain, // never log the secret itself
  });
  revalidatePath("/email-settings");
  revalidatePath("/automation");
  return { ok: true };
}

export async function testConnectionAction(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);
  const s = await getSmtpSettings();
  if (!s) return { ok: false, message: "Save the SMTP settings first." };
  const result = await testSmtpConnection(s);
  await db
    .update(smtpSettings)
    .set({ lastTestedAt: new Date(), lastTestOk: result.ok })
    .where(eq(smtpSettings.id, s.id));
  await audit(user.username, "SMTP_TEST_CONNECTION", "smtp_settings", "", { ok: result.ok, host: s.host, port: s.port });
  revalidatePath("/email-settings");
  revalidatePath("/automation");
  return result;
}

export async function sendTestEmailAction(to: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);
  const s = await getSmtpSettings();
  if (!s || !smtpConfigured(s)) return { ok: false, message: "SMTP is not fully configured." };
  const recipient = (to || s.testEmail).trim();
  if (!recipient || !isValidEmail(recipient)) return { ok: false, message: "Provide a valid test email address." };
  const result = await sendMail(s, {
    to: recipient,
    subject: "BRICCS VAS Revenue Console — SMTP Test",
    text: `Hello,\n\nThis is a test message from the BRICCS VAS Revenue Console confirming that email delivery through ${s.host}:${s.port} is working.\n\nRequested by: ${user.username}\nTime: ${new Date().toISOString()}\n\nIf you received this message, SMTP delivery is operational.`,
  });
  await audit(user.username, "SMTP_TEST_EMAIL", "smtp_settings", "", { ok: result.ok, to: recipient });
  return result.ok
    ? { ok: true, message: `Test email accepted by ${s.host} for ${recipient}. Response: ${result.response || "OK"}` }
    : { ok: false, message: `Test email failed: ${result.error}` };
}

/* ------------------------------------------------------------------ */
/* Email templates                                                     */
/* ------------------------------------------------------------------ */

export async function saveTemplate(subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);
  if (!subject.trim()) return { ok: false, error: "Subject cannot be empty." };
  if (!body.trim()) return { ok: false, error: "Body cannot be empty." };
  const existing = await db.select().from(emailTemplates).where(eq(emailTemplates.name, "default")).limit(1);
  if (existing[0]) {
    await db.update(emailTemplates).set({ subject, body, updatedBy: user.username, updatedAt: new Date() }).where(eq(emailTemplates.id, existing[0].id));
  } else {
    await db.insert(emailTemplates).values({ name: "default", subject, body, updatedBy: user.username });
  }
  await audit(user.username, "TEMPLATE_UPDATED", "email_template", "default", { subject });
  revalidatePath("/templates");
  return { ok: true };
}

export async function restoreDefaultTemplate(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);
  const existing = await db.select().from(emailTemplates).where(eq(emailTemplates.name, "default")).limit(1);
  if (existing[0]) {
    await db.update(emailTemplates).set({ subject: DEFAULT_SUBJECT, body: DEFAULT_BODY, updatedBy: user.username, updatedAt: new Date() }).where(eq(emailTemplates.id, existing[0].id));
  } else {
    await db.insert(emailTemplates).values({ name: "default", subject: DEFAULT_SUBJECT, body: DEFAULT_BODY, updatedBy: user.username });
  }
  await audit(user.username, "TEMPLATE_RESTORED", "email_template", "default", {});
  revalidatePath("/templates");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Automation                                                          */
/* ------------------------------------------------------------------ */

export interface AutomationInput {
  enabled: boolean;
  frequency: Frequency;
  timeOfDay: string;
  timezone: string;
}

export async function saveAutomation(input: AutomationInput): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRe.test(input.timeOfDay)) return { ok: false, error: "Time of day must be HH:MM (24h)." };

  if (input.enabled) {
    const s = await getSmtpSettings();
    if (!smtpConfigured(s)) return { ok: false, error: "SMTP must be configured before enabling automatic sending." };
    if (!s!.lastTestOk) return { ok: false, error: "Test the SMTP connection successfully before enabling automatic sending." };
  }

  const existing = await db.select().from(automationSettings).limit(1);
  const nextRun = input.enabled ? computeNextRun(new Date(), input.timeOfDay, input.timezone, input.frequency) : null;
  const values = {
    enabled: input.enabled,
    frequency: input.frequency,
    timeOfDay: input.timeOfDay,
    timezone: input.timezone,
    nextRunAt: nextRun,
    updatedAt: new Date(),
  };
  if (existing[0]) {
    await db.update(automationSettings).set(values).where(eq(automationSettings.id, existing[0].id));
  } else {
    await db.insert(automationSettings).values(values);
  }
  await audit(user.username, "AUTOMATION_SAVED", "automation_settings", "", { ...input });
  revalidatePath("/automation");
  return { ok: true };
}

export async function runAutomationNow(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);
  const res = await runAutomation("MANUAL", user.username);
  revalidatePath("/automation");
  revalidatePath("/email-centre");
  revalidatePath("/deliveries");
  revalidatePath("/processing");
  revalidatePath("/reports");
  return { ok: res.ok, message: res.message };
}

/* ------------------------------------------------------------------ */
/* System settings                                                     */
/* ------------------------------------------------------------------ */

export async function saveSystemLimits(input: { uploadMaxMb: number; attachmentMaxKb: number; retentionDays: number }): Promise<{ ok: boolean }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);
  await setSetting("upload_max_mb", String(Math.max(1, Math.min(200, input.uploadMaxMb))));
  await setSetting("attachment_max_kb", String(Math.max(100, Math.min(51200, input.attachmentMaxKb))));
  await setSetting("retention_days", String(Math.max(30, input.retentionDays)));
  await audit(user.username, "SYSTEM_SETTINGS_SAVED", "system_settings", "", { ...input });
  revalidatePath("/settings");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* User management                                                     */
/* ------------------------------------------------------------------ */

export async function saveUser(input: {
  id?: string;
  username: string;
  fullName: string;
  role: string;
  password: string;
  active: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const current = await requireUser();
  requireRole(current, ["ADMIN"]);
  const username = input.username.trim();
  if (!username) return { ok: false, error: "Username is required." };
  if (!["ADMIN", "OPS", "VIEWER"].includes(input.role)) return { ok: false, error: "Invalid role." };

  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing[0] && existing[0].id !== input.id) return { ok: false, error: `Username "${username}" is already taken.` };

  if (input.id) {
    const set: Record<string, unknown> = { username, fullName: input.fullName.trim(), role: input.role, active: input.active };
    if (input.password) {
      if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
      set.passwordHash = hashPassword(input.password);
    }
    await db.update(users).set(set).where(eq(users.id, input.id));
    await audit(current.username, "USER_UPDATED", "user", input.id, { username, role: input.role, active: input.active });
  } else {
    if (!input.password || input.password.length < 8) return { ok: false, error: "A password of at least 8 characters is required for new users." };
    const [created] = await db.insert(users).values({
      username,
      fullName: input.fullName.trim(),
      role: input.role,
      passwordHash: hashPassword(input.password),
      active: input.active,
    }).returning();
    await audit(current.username, "USER_CREATED", "user", created.id, { username, role: input.role });
  }
  revalidatePath("/settings");
  return { ok: true };
}
