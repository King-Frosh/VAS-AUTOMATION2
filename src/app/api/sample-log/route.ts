import { NextResponse } from "next/server";
import { db } from "@/db";
import { partners, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generates a sample MTN unreconciled-log CSV matching the nine required headers,
 *  prefilled with the register's real partners/services when available. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const activePartners = await db.select().from(partners).where(eq(partners.active, true)).limit(3);
  const allServices = await db.select().from(services).where(eq(services.active, true)).limit(6);

  const now = new Date();
  const dates = [2, 1, 0].map((back) => {
    const d = new Date(now);
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  });

  interface DemoService { partner: string; serviceId: string; serviceName: string; productId: string; productName: string; price: string; }
  const demo: DemoService[] = [];

  if (allServices.length > 0) {
    for (const s of allServices) {
      const p = activePartners.find((x) => x.id === s.partnerId) ?? activePartners[0];
      if (!p) continue;
      demo.push({
        partner: p.name,
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        productId: `0${1100 + demo.length}`,
        productName: s.serviceName,
        price: ["50", "100", "200"][demo.length % 3],
      });
    }
  }
  if (demo.length === 0) {
    demo.push(
      { partner: "GAMEZONE", serviceId: "0123456001", serviceName: "GAMEZONE", productId: "0112201", productName: "GameZone Daily", price: "100" },
      { partner: "GAMEZONE", serviceId: "0123456002", serviceName: "ARCADE HUB", productId: "0112202", productName: "Arcade Hub Weekly", price: "200" },
      { partner: "MUSICPLUS", serviceId: "0123456003", serviceName: "MUSICPLUS", productId: "0113301", productName: "MusicPlus Daily", price: "50" }
    );
  }

  const header = "DATE,SERVICE PARTNER,SERVICE ID,PRICE POINT,PRODUCT ID,PRODUCT NAME,TRANSACTION,COUNT,REVENUE";
  const lines: string[] = [header];
  let i = 0;
  for (const svc of demo) {
    for (const date of dates) {
      const count = 18 + ((i * 7) % 23);
      const revenue = (count * Number(svc.price)).toFixed(2);
      lines.push(`${date},${svc.partner},${svc.serviceId},${svc.price},${svc.productId},${svc.productName},Charged,${count},${revenue}`);
      i++;
    }
  }
  const csv = lines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="MTN_Unreconciled_Sample_${now.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
