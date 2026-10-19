import { db } from "@/db";
import { partners, services, vasLogRows } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type { ParsedRow } from "@/lib/excel";

export function normalizeKey(s: string): string {
  return s.replace(/\s+/g, " ").trim().toUpperCase();
}

/** Deterministic canonical form of a numeric identifier — tolerates leading zeros
 *  lost when a spreadsheet stores the ID as a number. Never guesses: two distinct
 *  register IDs that canonicalize identically surface as AMBIGUOUS. */
export function canonicalId(s: string): string {
  const t = normalizeKey(s);
  if (!/^\d+$/.test(t)) return t;
  const stripped = t.replace(/^0+/, "");
  return `#${stripped === "" ? "0" : stripped}`;
}

export interface MatchOutcome {
  partnerId: string | null;
  serviceName: string;
  serviceIdNormalized: string;
  matchStatus: "MATCHED" | "UNMATCHED_PARTNER" | "UNMAPPED_SERVICE" | "AMBIGUOUS" | "INVALID";
  validationMessage: string;
}

interface RegisterSnapshot {
  // canonical service ID -> registered service mappings. SERVICE PARTNER from the
  // uploaded file is deliberately not used for ownership; SERVICE ID is the key.
  servicesById: Map<string, { id: string; partnerId: string; partnerName: string; serviceName: string }[]>;
}

export async function loadRegister(): Promise<RegisterSnapshot> {
  const allPartners = await db.select().from(partners).where(eq(partners.active, true));
  const allServices = await db.select().from(services).where(eq(services.active, true));
  const partnerById = new Map(allPartners.map((p) => [p.id, p.name]));
  const servicesById = new Map<string, { id: string; partnerId: string; partnerName: string; serviceName: string }[]>();

  for (const service of allServices) {
    const partnerName = partnerById.get(service.partnerId);
    // Ignore mappings owned by inactive partners.
    if (!partnerName) continue;
    const key = canonicalId(service.serviceId);
    servicesById.set(key, [
      ...(servicesById.get(key) ?? []),
      { id: service.id, partnerId: service.partnerId, partnerName, serviceName: service.serviceName },
    ]);
  }
  return { servicesById };
}

export function matchOne(
  reg: RegisterSnapshot,
  row: { servicePartner: string; serviceId: string; errors: string[] }
): MatchOutcome {
  if (row.errors.length > 0) {
    return {
      partnerId: null,
      serviceName: "",
      serviceIdNormalized: normalizeKey(row.serviceId),
      matchStatus: "INVALID",
      validationMessage: row.errors.join("; "),
    };
  }

  const serviceKey = canonicalId(row.serviceId);
  if (!row.serviceId.trim()) {
    return {
      partnerId: null,
      serviceName: "",
      serviceIdNormalized: "",
      matchStatus: "UNMAPPED_SERVICE",
      validationMessage: "Row has no SERVICE ID value to map to a partner.",
    };
  }

  const matches = reg.servicesById.get(serviceKey) ?? [];
  if (matches.length === 0) {
    return {
      partnerId: null,
      serviceName: "",
      serviceIdNormalized: serviceKey,
      matchStatus: "UNMAPPED_SERVICE",
      validationMessage: `SERVICE ID "${row.serviceId}" is not mapped to a partner. Add the SERVICE ID mapping in Service Mappings.`,
    };
  }

  const partnerIds = new Set(matches.map((m) => m.partnerId));
  if (partnerIds.size > 1 || matches.length > 1) {
    return {
      partnerId: null,
      serviceName: "",
      serviceIdNormalized: serviceKey,
      matchStatus: "AMBIGUOUS",
      validationMessage: `SERVICE ID "${row.serviceId}" has multiple mappings. Keep one active mapping for this SERVICE ID so the report is assigned to the correct partner.`,
    };
  }

  const service = matches[0];
  return {
    partnerId: service.partnerId,
    serviceName: service.serviceName || serviceKey,
    serviceIdNormalized: serviceKey,
    matchStatus: "MATCHED",
    validationMessage: "",
  };
}

/** Re-run matching for all rows of an upload using the current register.
 *  INVALID rows (bad dates/numbers from the source file) stay invalid —
 *  rematching can only fix partner/service mapping problems. */
export async function rematchUpload(uploadId: string): Promise<{ matched: number; unresolved: number }> {
  const reg = await loadRegister();
  const rows = await db
    .select()
    .from(vasLogRows)
    .where(eq(vasLogRows.uploadId, uploadId));
  let matched = 0;
  let unresolved = 0;
  const updates: Array<{
    id: string;
    partnerId: string | null;
    serviceName: string;
    matchStatus: MatchOutcome["matchStatus"];
    validationMessage: string;
  }> = [];

  // Compute matches in memory first. INVALID rows remain untouched, as before.
  for (const row of rows) {
    if (row.matchStatus === "INVALID") {
      unresolved++;
      continue;
    }

    const outcome = matchOne(reg, {
      servicePartner: row.servicePartner,
      serviceId: row.serviceId,
      errors: [],
    });

    updates.push({
      id: row.id,
      partnerId: outcome.partnerId,
      serviceName: outcome.serviceName,
      matchStatus: outcome.matchStatus,
      validationMessage: outcome.validationMessage,
    });

    if (outcome.matchStatus === "MATCHED") matched++;
    else unresolved++;
  }

  // The old implementation made one database round trip per row. Batch the
  // updates into a small number of PostgreSQL statements instead (250 rows
  // per statement), which is much faster for large uploads and avoids
  // overwhelming the database with concurrent requests.
  const batchSize = 250;
  for (let offset = 0; offset < updates.length; offset += batchSize) {
    const batch = updates.slice(offset, offset + batchSize);
    const values = batch.map((row) => sql`(
      ${row.id}::uuid,
      ${row.partnerId}::uuid,
      ${row.serviceName},
      ${row.matchStatus},
      ${row.validationMessage}
    )`);

    await db.execute(sql`
      UPDATE vas_log_rows AS target
      SET
        partner_id = source.partner_id,
        service_name = source.service_name,
        match_status = source.match_status,
        validation_message = source.validation_message
      FROM (VALUES ${sql.join(values, sql`, `)}) AS source(
        id, partner_id, service_name, match_status, validation_message
      )
      WHERE target.id = source.id
    `);
  }

  return { matched, unresolved };
}
