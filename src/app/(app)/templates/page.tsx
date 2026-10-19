import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DEFAULT_SUBJECT, DEFAULT_BODY } from "@/lib/templates";
import { formatDateTime } from "@/lib/utils";
import TemplateEditor from "./template-editor";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Email Templates" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requireUser();
  const tpl = (await db.select().from(emailTemplates).where(eq(emailTemplates.name, "default")).limit(1))[0];

  return (
    <div>
      <PageHeader
        title="Email Templates"
        subtitle="The default subject and body applied to every partner report email. All placeholders must resolve before an email is allowed to send."
      />
      <TemplateEditor
        canEdit={user.role === "ADMIN"}
        initial={{
          subject: tpl?.subject ?? DEFAULT_SUBJECT,
          body: tpl?.body ?? DEFAULT_BODY,
          updatedBy: tpl?.updatedBy ?? "system",
          updatedAt: tpl?.updatedAt ? formatDateTime(tpl.updatedAt) : "",
        }}
        defaultSubject={DEFAULT_SUBJECT}
        defaultBody={DEFAULT_BODY}
      />
    </div>
  );
}
