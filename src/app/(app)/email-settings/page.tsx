import { requireUser } from "@/lib/auth";
import { getSmtpSettings } from "@/lib/mailer";
import { PageHeader } from "@/components/ui";
import { redirect } from "next/navigation";
import SmtpForm from "./smtp-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Email Settings" };
export const dynamic = "force-dynamic";

export default async function EmailSettingsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");

  const s = await getSmtpSettings();

  return (
    <div>
      <PageHeader
        title="Email Settings"
        subtitle="Configure the SMTP provider used to distribute partner reports. The four mandatory fields are SMTP Server, Port, Login and Password."
      />
      <SmtpForm
        initial={{
          host: s?.host ?? "",
          port: s?.port ?? 587,
          login: s?.login ?? "",
          hasPassword: !!s?.passwordEnc,
          fromName: s?.fromName ?? "BRICCS International",
          fromEmail: s?.fromEmail ?? "",
          security: s?.security ?? "STARTTLS",
          testEmail: s?.testEmail ?? "",
          lastTestOk: s?.lastTestOk ?? false,
          lastTestedAt: s?.lastTestedAt ? s.lastTestedAt.toISOString() : "",
        }}
      />
    </div>
  );
}
