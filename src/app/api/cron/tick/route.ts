import { NextRequest, NextResponse } from "next/server";
import { runDueAutomation } from "@/lib/automation";
import { ensureDefaults } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduler entry point. Point an external cron (system cron, cron-job.org,
 * Vercel cron, etc.) at this endpoint every few minutes:
 *   curl -fsS -H "x-cron-secret: $CRON_SECRET" https://your-host/api/cron/tick
 * It runs the automatic distribution only when the configured schedule is due.
 */
export async function GET(req: NextRequest) {
  await ensureDefaults();
  const secret = process.env.CRON_SECRET || "briccs-cron-dev";
  const provided = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret") || "";
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "Invalid cron secret." }, { status: 401 });
  }
  try {
    const result = await runDueAutomation();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
