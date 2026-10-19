import nodemailer from "nodemailer";
import { db } from "@/db";
import { smtpSettings, type SmtpSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";

export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const rows = await db.select().from(smtpSettings).limit(1);
  return rows[0] ?? null;
}

export function smtpConfigured(s: SmtpSettings | null): boolean {
  return !!(s && s.host && s.port && s.login && s.passwordEnc && s.fromEmail);
}

/** Never include secrets in error output. */
function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/pass(word)?[=:]\s*\S+/gi, "password=***").slice(0, 500);
}

export function buildTransport(s: SmtpSettings) {
  const password = decryptSecret(s.passwordEnc);
  const secure = s.security === "TLS" || s.port === 465;
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure,
    auth: { user: s.login, pass: password },
    requireTLS: s.security === "STARTTLS",
    tls: { rejectUnauthorized: true },
    connectionTimeout: 15000,
    socketTimeout: 30000,
  });
}

export async function testSmtpConnection(s: SmtpSettings): Promise<{ ok: boolean; message: string }> {
  if (!s.host || !s.port || !s.login || !s.passwordEnc) {
    return { ok: false, message: "SMTP Server, Port, Login and Password are all required before testing." };
  }
  try {
    const transport = buildTransport(s);
    await transport.verify();
    return {
      ok: true,
      message: `Connected and authenticated with ${s.host}:${s.port} as ${s.login} (${s.security}).`,
    };
  } catch (err) {
    return { ok: false, message: `Connection failed: ${sanitizeError(err)}` };
  }
}

export interface SendMailInput {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  attachment?: { filename: string; content: Buffer };
}

export async function sendMail(
  s: SmtpSettings,
  input: SendMailInput
): Promise<{ ok: boolean; messageId: string; response: string; error: string; durationMs: number }> {
  const start = Date.now();
  try {
    const transport = buildTransport(s);
    const info = await transport.sendMail({
      from: s.fromName ? `"${s.fromName.replace(/"/g, "")}" <${s.fromEmail}>` : s.fromEmail,
      to: input.to,
      cc: input.cc || undefined,
      subject: input.subject,
      text: input.text,
      attachments: input.attachment
        ? [{ filename: input.attachment.filename, content: input.attachment.content }]
        : [],
    });
    return {
      ok: true,
      messageId: info.messageId ?? "",
      response: String(info.response ?? "").slice(0, 400),
      error: "",
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return { ok: false, messageId: "", response: "", error: sanitizeError(err), durationMs: Date.now() - start };
  }
}
