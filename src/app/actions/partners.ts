"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { partners, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { isValidEmail } from "@/lib/utils";
import { canonicalId } from "@/lib/matching";

export interface PartnerInput {
  id?: string;
  name: string;
  code: string;
  email: string;
  ccEmails: string;
  active: boolean;
  autoSend: boolean;
  notes: string;
}

export async function savePartner(input: PartnerInput): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);

  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  const email = input.email.trim();
  if (!name || !code) return { ok: false, error: "Partner name and code are required." };
  if (email && !isValidEmail(email)) return { ok: false, error: "Primary recipient email is invalid." };
  const ccList = input.ccEmails.split(/[,;\s]+/).filter(Boolean);
  for (const cc of ccList) {
    if (!isValidEmail(cc)) return { ok: false, error: `CC address "${cc}" is invalid.` };
  }

  // Uniqueness of code (and warn on name collisions)
  const existing = await db.select().from(partners).where(eq(partners.code, code)).limit(1);
  if (existing[0] && existing[0].id !== input.id) {
    return { ok: false, error: `Partner code "${code}" is already in use.` };
  }

  if (input.id) {
    await db
      .update(partners)
      .set({ name, code, email, ccEmails: ccList.join(", "), active: input.active, autoSend: input.autoSend, notes: input.notes, updatedAt: new Date() })
      .where(eq(partners.id, input.id));
    await audit(user.username, "PARTNER_UPDATED", "partner", input.id, { name, code, autoSend: input.autoSend, active: input.active });
  } else {
    const [created] = await db
      .insert(partners)
      .values({ name, code, email, ccEmails: ccList.join(", "), active: input.active, autoSend: input.autoSend, notes: input.notes })
      .returning();
    await audit(user.username, "PARTNER_CREATED", "partner", created.id, { name, code });
  }
  revalidatePath("/partners");
  revalidatePath("/services");
  return { ok: true };
}

export async function togglePartnerField(id: string, field: "active" | "autoSend", value: boolean): Promise<void> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);
  await db.update(partners).set({ [field]: value, updatedAt: new Date() }).where(eq(partners.id, id));
  await audit(user.username, "PARTNER_TOGGLED", "partner", id, { field, value });
  revalidatePath("/partners");
}

export async function deletePartner(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);
  await db.delete(partners).where(eq(partners.id, id));
  await audit(user.username, "PARTNER_DELETED", "partner", id, {});
  revalidatePath("/partners");
  revalidatePath("/services");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Service mappings — manually maintained, reusable, updatable          */
/* ------------------------------------------------------------------ */

export interface ServiceInput {
  id?: string;
  partnerId: string;
  serviceId: string;
  serviceName: string;
  active: boolean;
}

export async function saveService(input: ServiceInput): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);

  const serviceId = input.serviceId.trim();
  const serviceName = input.serviceName.trim();
  if (!input.partnerId) return { ok: false, error: "Select the partner this service belongs to." };
  if (!serviceId || !serviceName) return { ok: false, error: "Both Service ID and Service Name are required." };

  // SERVICE ID is the sole matching key, so it must identify one service/partner
  // globally (not just within a partner).
  const allServices = await db.select().from(services);
  const collision = allServices.find(
    (s) => canonicalId(s.serviceId) === canonicalId(serviceId) && s.id !== input.id
  );
  if (collision) {
    return {
      ok: false,
      error: `SERVICE ID "${serviceId}" is already mapped to "${collision.serviceName}". Each SERVICE ID must map to only one partner.`,
    };
  }

  if (input.id) {
    await db
      .update(services)
      .set({ partnerId: input.partnerId, serviceId, serviceName, active: input.active })
      .where(eq(services.id, input.id));
    await audit(user.username, "SERVICE_UPDATED", "service", input.id, { serviceId, serviceName, partnerId: input.partnerId });
  } else {
    const [created] = await db
      .insert(services)
      .values({ partnerId: input.partnerId, serviceId, serviceName, active: input.active })
      .returning();
    await audit(user.username, "SERVICE_CREATED", "service", created.id, { serviceId, serviceName, partnerId: input.partnerId });
  }
  revalidatePath("/services");
  revalidatePath("/partners");
  return { ok: true };
}

export async function deleteService(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);
  await db.delete(services).where(eq(services.id, id));
  await audit(user.username, "SERVICE_DELETED", "service", id, {});
  revalidatePath("/services");
  revalidatePath("/partners");
  return { ok: true };
}
