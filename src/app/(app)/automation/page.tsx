import { db } from "@/db";
import { automationSettings, partners } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getSmtpSettings, smtpConfigured } from "@/lib/mailer";
import { PageHeader } from "@/components/ui";
import { redirect } from "next/navigation";
import AutomationForm from "./automation-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Automation" };
export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");

  const a = (await db.select().from(automationSettings).limit(1))[0];
  const smtp = await getSmtpSettings();
  const autoPartners = await db.select().from(partners).where(eq(partners.autoSend, true)).orderBy(asc(partners.name));
  const allActive = await db.select().from(partners).where(eq(partners.active, true));

  return (
    <div>
      <PageHeader
        title="Automation Settings"
        subtitle="Scheduled automatic processing and distribution — daily, weekly or monthly, in the Africa/Lagos timezone by default. Only partners with automatic delivery enabled receive scheduled emails."
      />
      <AutomationForm
        initial={{
          enabled: a?.enabled ?? false,
          frequency: (a?.frequency as "DAILY" | "WEEKLY" | "MONTHLY") ?? "DAILY",
          timeOfDay: a?.timeOfDay ?? "07:00",
          timezone: a?.timezone ?? "Africa/Lagos",
          lastRunAt: a?.lastRunAt ? a.lastRunAt.toISOString() : "",
          nextRunAt: a?.nextRunAt ? a.nextRunAt.toISOString() : "",
          lastResult: a?.lastResult ?? "",
        }}
        smtpReady={smtpConfigured(smtp)}
        smtpTested={smtp?.lastTestOk ?? false}
        autoPartnerNames={autoPartners.map((p) => p.name)}
        activePartnerCount={allActive.length}
      />
    </div>
  );
}
