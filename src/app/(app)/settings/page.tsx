import { db } from "@/db";
import { users } from "@/db/schema";
import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/audit";
import { PageHeader } from "@/components/ui";
import { redirect } from "next/navigation";
import SettingsClient from "./settings-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "System Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");

  const allUsers = await db.select().from(users).orderBy(asc(users.username));
  const uploadMaxMb = await getSetting("upload_max_mb", "25");
  const attachmentMaxKb = await getSetting("attachment_max_kb", "10240");
  const retentionDays = await getSetting("retention_days", "365");

  return (
    <div>
      <PageHeader
        title="System Settings"
        subtitle="Access control, processing limits and operational configuration. Administrator access required."
      />
      <SettingsClient
        users={allUsers.map((u) => ({
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          role: u.role,
          active: u.active,
          createdAt: u.createdAt.toISOString(),
        }))}
        limits={{ uploadMaxMb: Number(uploadMaxMb), attachmentMaxKb: Number(attachmentMaxKb), retentionDays: Number(retentionDays) }}
        currentUserId={user.id}
      />
    </div>
  );
}
