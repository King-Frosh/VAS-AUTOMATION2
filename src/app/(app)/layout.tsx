import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { ensureDefaults } from "@/lib/seed";
import Sidebar from "@/components/sidebar";
import { db } from "@/db";
import { partnerReports, vasLogRows, emailDeliveries } from "@/db/schema";
import { eq, inArray, ne, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await ensureDefaults();
  const user = await requireUser();

  let pending = 0, unmatched = 0, failed = 0;
  try {
    const [p] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(partnerReports)
      .where(inArray(partnerReports.status, ["READY_TO_SEND", "FAILED"]));
    pending = p?.n ?? 0;

    const [u] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(vasLogRows)
      .where(ne(vasLogRows.matchStatus, "MATCHED"));
    unmatched = u?.n ?? 0;

    const [f] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(emailDeliveries)
      .where(eq(emailDeliveries.status, "FAILED"));
    failed = f?.n ?? 0;
  } catch {
    // badge counts are non-critical
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        user={{ username: user.username, fullName: user.fullName, role: user.role }}
        badgeCounts={{ failed, unmatched, pending }}
      />
      <div className="pl-[264px]">
        <main className="mx-auto max-w-[1440px] px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
