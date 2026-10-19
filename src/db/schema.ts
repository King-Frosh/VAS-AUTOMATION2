import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Auth & users                                                        */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  fullName: text("full_name").notNull().default(""),
  role: text("role").notNull().default("OPS"), // ADMIN | OPS | VIEWER
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: text("token").notNull().unique(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Partner register & service mappings                                 */
/* ------------------------------------------------------------------ */

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    email: text("email").notNull().default(""),
    ccEmails: text("cc_emails").notNull().default(""),
    active: boolean("active").notNull().default(true),
    autoSend: boolean("auto_send").notNull().default(false),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("partners_code_uq").on(t.code)]
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
    serviceId: text("service_id").notNull(), // MTN SERVICE ID, kept as text
    serviceName: text("service_name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("services_partner_idx").on(t.partnerId),
    index("services_service_id_idx").on(t.serviceId),
  ]
);

/* ------------------------------------------------------------------ */
/* Uploads & imported rows                                             */
/* ------------------------------------------------------------------ */

export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    filename: text("filename").notNull(),
    fileHash: text("file_hash").notNull(),
    filePath: text("file_path").notNull(),
    fileSize: integer("file_size").notNull().default(0),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    uploaderName: text("uploader_name").notNull().default(""),
    status: text("status").notNull().default("UNPROCESSED"),
    // UNPROCESSED | PROCESSING | READY_FOR_REVIEW | FAILED
    errorMessage: text("error_message").notNull().default(""),
    totalRows: integer("total_rows").notNull().default(0),
    matchedRows: integer("matched_rows").notNull().default(0),
    unmatchedRows: integer("unmatched_rows").notNull().default(0),
    invalidRows: integer("invalid_rows").notNull().default(0),
    minDate: text("min_date").notNull().default(""),
    maxDate: text("max_date").notNull().default(""),
    duplicateOf: uuid("duplicate_of"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("uploads_hash_idx").on(t.fileHash)]
);

export const vasLogRows = pgTable(
  "vas_log_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    uploadId: uuid("upload_id").notNull().references(() => uploads.id, { onDelete: "cascade" }),
    sourceRow: integer("source_row").notNull(),
    logDate: text("log_date").notNull().default(""), // canonical YYYY-MM-DD
    rawDate: text("raw_date").notNull().default(""),
    servicePartner: text("service_partner").notNull().default(""),
    serviceId: text("service_id").notNull().default(""),
    pricePoint: text("price_point").notNull().default(""),
    productId: text("product_id").notNull().default(""),
    productName: text("product_name").notNull().default(""),
    transaction: text("transaction").notNull().default(""),
    count: integer("count").notNull().default(0),
    revenue: numeric("revenue", { precision: 18, scale: 4 }).notNull().default("0"),
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null" }),
    serviceName: text("service_name").notNull().default(""),
    // MATCHED | UNMATCHED_PARTNER | UNMAPPED_SERVICE | AMBIGUOUS | INVALID
    matchStatus: text("match_status").notNull().default("UNMATCHED_PARTNER"),
    validationMessage: text("validation_message").notNull().default(""),
  },
  (t) => [
    index("vas_rows_upload_idx").on(t.uploadId),
    index("vas_rows_partner_idx").on(t.partnerId),
    index("vas_rows_date_idx").on(t.logDate),
    index("vas_rows_status_idx").on(t.matchStatus),
  ]
);

/* ------------------------------------------------------------------ */
/* Processing batches & generated reports                              */
/* ------------------------------------------------------------------ */

export const reportBatches = pgTable(
  "report_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    uploadId: uuid("upload_id").notNull().references(() => uploads.id, { onDelete: "cascade" }),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    trigger: text("trigger").notNull().default("MANUAL"), // MANUAL | AUTO
    status: text("status").notNull().default("PROCESSING"),
    // PROCESSING | READY_TO_SEND | SENDING | SENT | FAILED | PARTIALLY_FAILED
    sourceTotal: integer("source_total").notNull().default(0),
    matchedTotal: integer("matched_total").notNull().default(0),
    unmatchedTotal: integer("unmatched_total").notNull().default(0),
    invalidTotal: integer("invalid_total").notNull().default(0),
    sourceRevenue: numeric("source_revenue", { precision: 18, scale: 4 }).notNull().default("0"),
    matchedRevenue: numeric("matched_revenue", { precision: 18, scale: 4 }).notNull().default("0"),
    reportCount: integer("report_count").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id),
    createdByName: text("created_by_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("batches_upload_idx").on(t.uploadId), index("batches_status_idx").on(t.status)]
);

export const partnerReports = pgTable(
  "partner_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id").notNull().references(() => reportBatches.id, { onDelete: "cascade" }),
    uploadId: uuid("upload_id").notNull().references(() => uploads.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null" }),
    partnerCode: text("partner_code").notNull().default(""),
    partnerName: text("partner_name").notNull().default(""),
    serviceId: text("service_id").notNull().default(""),
    serviceName: text("service_name").notNull().default(""),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    recordCount: integer("record_count").notNull().default(0),
    totalCount: integer("total_count").notNull().default(0),
    totalRevenue: numeric("total_revenue", { precision: 18, scale: 4 }).notNull().default("0"),
    filename: text("filename").notNull().default(""),
    filePath: text("file_path").notNull().default(""),
    fileSize: integer("file_size").notNull().default(0),
    status: text("status").notNull().default("READY_TO_SEND"),
    // READY_TO_SEND | SENDING | SENT | FAILED | SKIPPED
    lastError: text("last_error").notNull().default(""),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reports_batch_idx").on(t.batchId),
    index("reports_status_idx").on(t.status),
    index("reports_partner_idx").on(t.partnerId),
  ]
);

/* ------------------------------------------------------------------ */
/* Email: templates, SMTP settings, deliveries                         */
/* ------------------------------------------------------------------ */

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(), // 'default'
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const smtpSettings = pgTable("smtp_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  host: text("host").notNull().default(""),
  port: integer("port").notNull().default(587),
  login: text("login").notNull().default(""),
  passwordEnc: text("password_enc").notNull().default(""), // AES-256-GCM
  fromName: text("from_name").notNull().default("BRICCS International"),
  fromEmail: text("from_email").notNull().default(""),
  security: text("security").notNull().default("STARTTLS"), // STARTTLS | TLS | NONE
  testEmail: text("test_email").notNull().default(""),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  lastTestOk: boolean("last_test_ok").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id").references(() => partnerReports.id, { onDelete: "set null" }),
    batchId: uuid("batch_id").references(() => reportBatches.id, { onDelete: "set null" }),
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null" }),
    recipient: text("recipient").notNull().default(""),
    cc: text("cc").notNull().default(""),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    attachmentFilename: text("attachment_filename").notNull().default(""),
    attachmentPath: text("attachment_path").notNull().default(""),
    attachmentSize: integer("attachment_size").notNull().default(0),
    status: text("status").notNull().default("PENDING"),
    // PENDING | SENDING | SENT | FAILED
    trigger: text("trigger").notNull().default("MANUAL"), // MANUAL | BULK | AUTO | RESEND | TEST
    attempts: integer("attempts").notNull().default(0),
    error: text("error").notNull().default(""),
    messageId: text("message_id").notNull().default(""),
    providerResponse: text("provider_response").notNull().default(""),
    resendOf: uuid("resend_of"),
    sentBy: text("sent_by").notNull().default(""),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deliveries_report_idx").on(t.reportId),
    index("deliveries_status_idx").on(t.status),
  ]
);

export const emailDeliveryAttempts = pgTable(
  "email_delivery_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deliveryId: uuid("delivery_id").notNull().references(() => emailDeliveries.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: text("status").notNull().default("SENDING"), // SENT | FAILED
    error: text("error").notNull().default(""),
    providerResponse: text("provider_response").notNull().default(""),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attempts_delivery_idx").on(t.deliveryId)]
);

/* ------------------------------------------------------------------ */
/* Automation, system settings, audit                                  */
/* ------------------------------------------------------------------ */

export const automationSettings = pgTable("automation_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  frequency: text("frequency").notNull().default("DAILY"), // DAILY | WEEKLY | MONTHLY
  timeOfDay: text("time_of_day").notNull().default("07:00"),
  timezone: text("timezone").notNull().default("Africa/Lagos"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastResult: text("last_result").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actor: text("actor").notNull().default("system"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull().default(""),
    entityId: text("entity_id").notNull().default(""),
    details: text("details").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)]
);

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Upload = typeof uploads.$inferSelect;
export type VasLogRow = typeof vasLogRows.$inferSelect;
export type ReportBatch = typeof reportBatches.$inferSelect;
export type PartnerReport = typeof partnerReports.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type SmtpSettings = typeof smtpSettings.$inferSelect;
export type EmailDelivery = typeof emailDeliveries.$inferSelect;
export type AutomationSettings = typeof automationSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
