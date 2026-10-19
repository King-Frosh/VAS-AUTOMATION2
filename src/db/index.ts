import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const configuredDatabaseUrl = process.env.DATABASE_URL;

if (!configuredDatabaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// pg-connection-string v3 warns that "require" is an alias for
// "verify-full". Make the intended TLS verification mode explicit so the
// development error overlay does not report this compatibility warning.
function normalizeDatabaseUrl(value: string): string {
  try {
    const parsed = new URL(value);
    const sslMode = parsed.searchParams.get("sslmode");
    if (sslMode && ["prefer", "require", "verify-ca"].includes(sslMode.toLowerCase())) {
      parsed.searchParams.set("sslmode", "verify-full");
    }
    return parsed.toString();
  } catch {
    // Let pg produce its normal connection error for a malformed URL.
    return value;
  }
}

const databaseUrl = normalizeDatabaseUrl(configuredDatabaseUrl);

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
