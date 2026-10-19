import { db } from "@/db";
import { partners, services } from "@/db/schema";
import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, EmptyState, Td, Th, StatusBadge } from "@/components/ui";
import { Handshake, Plus, CircleAlert } from "lucide-react";
import { PartnerActions, ServiceCountLink, AddPartnerButton } from "./partner-controls";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Partner Register" };
export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const allPartners = await db.select().from(partners).orderBy(asc(partners.name));
  const allServices = await db.select().from(services).orderBy(asc(services.serviceName));
  const servicesByPartner = new Map<string, typeof allServices>();
  for (const s of allServices) {
    if (!servicesByPartner.has(s.partnerId)) servicesByPartner.set(s.partnerId, []);
    servicesByPartner.get(s.partnerId)!.push(s);
  }

  return (
    <div>
      <PageHeader
        title="Partner Register"
        subtitle="Official partner identities, recipient addresses and automation preferences. The SERVICE PARTNER column is matched here — service ID/name mappings open from each row."
        actions={isAdmin ? <AddPartnerButton /> : undefined}
      />

      {!isAdmin && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[12.5px] text-slate-500">
          <CircleAlert className="h-4 w-4 text-slate-400" />
          You have read access. Contact an Administrator to change partner details.
        </div>
      )}

      <Card className="anim-fade-up">
        {allPartners.length === 0 ? (
          <EmptyState
            icon={<Handshake />}
            title="Partner Register is empty"
            hint="Add your first VAS partner with their recipient email, then map their SERVICE IDs to service names for continuous matching."
            action={isAdmin ? <AddPartnerButton label="Add your first partner" icon={<Plus className="h-4 w-4" />} /> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Partner</Th>
                  <Th>Recipient</Th>
                  <Th>Services mapped</Th>
                  <Th>Auto delivery</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {allPartners.map((p) => {
                  const svcs = servicesByPartner.get(p.id) ?? [];
                  return (
                    <tr key={p.id} className="transition hover:bg-slate-50/60">
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-900 font-display text-[12px] font-bold text-gold-400">
                            {p.code.slice(0, 3)}
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-navy-900">{p.name}</p>
                            <p className="font-mono text-[10.5px] uppercase tracking-wider text-slate-400">{p.code}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <p className="font-mono text-[12px] text-slate-700">{p.email || <span className="font-sans font-semibold text-rose-600">No recipient set</span>}</p>
                        {p.ccEmails && <p className="max-w-[240px] truncate font-mono text-[10.5px] text-slate-400" title={p.ccEmails}>cc: {p.ccEmails}</p>}
                      </Td>
                      <Td>
                        <ServiceCountLink
                          partnerId={p.id}
                          partnerName={p.name}
                          count={svcs.length}
                          services={svcs.map((s) => ({ id: s.id, serviceId: s.serviceId, serviceName: s.serviceName, active: s.active }))}
                          canEdit={isAdmin}
                        />
                      </Td>
                      <Td>
                        {p.autoSend ? <StatusBadge status="AUTO" label="AUTO ON" /> : <StatusBadge status="INACTIVE" label="AUTO OFF" />}
                      </Td>
                      <Td>
                        {p.active ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />}
                      </Td>
                      <Td className="text-right">
                        <PartnerActions
                          partner={{
                            id: p.id, name: p.name, code: p.code, email: p.email,
                            ccEmails: p.ccEmails, active: p.active, autoSend: p.autoSend, notes: p.notes,
                          }}
                          canEdit={isAdmin}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
