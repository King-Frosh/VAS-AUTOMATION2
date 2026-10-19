/** Default templates per the BRICCS technical specification. */

export const DEFAULT_SUBJECT = "DAILY UNRECONCILED LOG 2026 - {{SERVICE_NAME}}";

export const DEFAULT_BODY = `Dear {{partner_mail address}},

We hope this mail finds you well.

Kindly find attached the UNRECONCILED LOGS for your service from {{start_date}} to {{end_date}}.

Thank you.

---

Best Regards.`;

export interface TemplateContext {
  partnerEmail: string;
  partnerName?: string;
  serviceName: string;
  startDate: string;
  endDate: string;
}

export const PLACEHOLDER_HELP = [
  { token: "{{partner_mail address}}", desc: "Primary recipient email from the Partner Register" },
  { token: "{{start_date}}", desc: "Selected reporting start date (inclusive)" },
  { token: "{{end_date}}", desc: "Selected reporting end date (inclusive)" },
  { token: "{{SERVICE_NAME}}", desc: "Service name represented by the attached report" },
  { token: "{{partner_name}}", desc: "Partner company name (optional extra)" },
];

function displayDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function renderTemplate(template: string, ctx: TemplateContext): string {
  return template
    .split("{{partner_mail address}}").join(ctx.partnerEmail)
    .split("{{partner_mail_address}}").join(ctx.partnerEmail)
    .split("{{partner_email}}").join(ctx.partnerEmail)
    .split("{{SERVICE_NAME}}").join(ctx.serviceName)
    .split("{{service_name}}").join(ctx.serviceName)
    .split("{{start_date}}").join(displayDate(ctx.startDate))
    .split("{{end_date}}").join(displayDate(ctx.endDate))
    .split("{{partner_name}}").join(ctx.partnerName ?? "");
}

/** Returns the list of placeholder tokens still unresolved after rendering. */
export function unresolvedPlaceholders(rendered: string): string[] {
  const matches = rendered.match(/\{\{[^}]+\}\}/g);
  return matches ? Array.from(new Set(matches)) : [];
}
