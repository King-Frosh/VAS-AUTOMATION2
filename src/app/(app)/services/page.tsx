import { db } from "@/db";
import { partners, services } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, EmptyState, Td, Th, StatusBadge } from "@/components/ui";
import { Network, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ServiceCountLink } from "../partners/partner-controls";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Service Mappings" };
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const rows = await db
    .select({ service: services, partner: partners })
    .from(services)
    .innerJoin(partners, eq(services.partnerId, partners.id))
    .orderBy(asc(partners.name), asc(services.serviceName));

  const activePartnerList = await db.select().from(partners).where(eq(partners.active, true)).orderBy(asc(partners.name));

  return (
    <div>
      <PageHeader
        title="Service Mappings"
        subtitle="Map each SERVICE ID to one partner and service name. Uploaded rows are assigned using SERVICE ID only; the SERVICE PARTNER column in the source log is not used for matching."
      />

      <div className="mb-5 grid gap-3 rounded-2xl border border-navy-900/[0.06] bg-gradient-to-r from-navy-900 to-navy-800 px-6 py-5 text-white anim-fade-up md:grid-cols-[auto_1fr_auto] md:items-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.08] ring-1 ring-white/10">
          <Network className="h-5 w-5 text-gold-400" strokeWidth={1.7} />
        </div>
        <div>
          <p className="text-[14px] font-bold">How matching works</p>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-slate-300">
Each uploaded row is matched using its <span className="font-mono text-gold-300">SERVICE ID</span> only. The ID identifies
            the mapped partner and service name; the source log&apos;s <span className="font-mono text-gold-300">SERVICE PARTNER</span>
            value is ignored. Each SERVICE ID must map to one partner. Missing or duplicate mappings appear under Unmatched Records
            until you fix the mapping and re-match.
          </p>
        </div>
        <Link href="/unmatched" className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-[12.5px] font-bold text-navy-950 transition hover:bg-gold-400">
          Review unmatched <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <Card className="anim-fade-up">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Network />}
            title="No service mappings yet"
            hint="Open a partner in the Partner Register and add SERVICE ID mappings — or add a partner first if the register is empty."
            action={
              <Link href="/partners" className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-navy-800">
                Open Partner Register <ArrowRight className="h-4 w-4 text-gold-400" />
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Partner</Th>
                  <Th>Service ID (MTN)</Th>
                  <Th>Mapped service name</Th>
                  <Th>Used for</Th>
                  <Th>State</Th>
                  <Th className="text-right">Manage</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ service, partner }) => (
                  <tr key={service.id} className="transition hover:bg-slate-50/60">
                    <Td>
                      <p className="text-[13px] font-bold text-navy-900">{partner.name}</p>
                      <p className="font-mono text-[10.5px] uppercase text-slate-400">{partner.code}</p>
                    </Td>
                    <Td><span className="font-mono text-[12.5px] font-bold text-navy-900">{service.serviceId}</span></Td>
                    <Td><span className="text-[12.5px] font-semibold uppercase tracking-wide text-slate-700">{service.serviceName}</span></Td>
                    <Td className="max-w-[260px]">
                      <p className="truncate font-mono text-[10.5px] text-slate-500" title={`Subject: DAILY UNRECONCILED LOG 2026 - ${service.serviceName}`}>
                        Subject: …2026 - {service.serviceName}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10.5px] text-slate-400">
                        File: BRICCS_VAS_Report_{partner.code}_{service.serviceName.replace(/\s+/g, "_")}_[dates].xlsx
                      </p>
                    </Td>
                    <Td>{service.active ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />}</Td>
                    <Td className="text-right">
                      <ServiceCountLink
                        partnerId={partner.id}
                        partnerName={partner.name}
                        count={rows.filter((r) => r.partner.id === partner.id).length}
                        services={rows.filter((r) => r.partner.id === partner.id).map((r) => ({
                          id: r.service.id, serviceId: r.service.serviceId, serviceName: r.service.serviceName, active: r.service.active,
                        }))}
                        canEdit={isAdmin}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {activePartnerList.length > 0 && (
        <div className="mt-5 grid gap-4 anim-fade-up sm:grid-cols-2 xl:grid-cols-3">
          {activePartnerList.map((p) => {
            const own = rows.filter((r) => r.partner.id === p.id);
            return (
              <Card key={p.id} className="flex items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-navy-900">{p.name}</p>
                  <p className="text-[11.5px] text-slate-500">{own.length} mapped {own.length === 1 ? "service" : "services"}</p>
                </div>
                <ServiceCountLink
                  partnerId={p.id}
                  partnerName={p.name}
                  count={own.length}
                  services={own.map((r) => ({ id: r.service.id, serviceId: r.service.serviceId, serviceName: r.service.serviceName, active: r.service.active }))}
                  canEdit={isAdmin}
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
