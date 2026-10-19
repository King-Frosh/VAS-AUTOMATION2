import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();

  const db = await client.query(`
    SELECT current_database() AS database_name,
           current_schema() AS schema_name
  `);

  console.log("\nCONNECTED DATABASE:");
  console.log(db.rows[0]);

  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  console.log("\nEXISTING TABLES:");
  console.log(tables.rows.map(r => r.table_name).join("\n"));

  const columns = await client.query(`
    SELECT table_name, column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  console.log("\nEXISTING COLUMNS:");
  for (const c of columns.rows) {
    console.log(
      `${c.table_name}.${c.column_name} | nullable=${c.is_nullable} | default=${c.column_default ?? "none"}`
    );
  }

  const legacy = await client.query(`
    SELECT to_regclass('public.playing_with_neon') AS legacy_table
  `);

  console.log("\nLEGACY TABLE CHECK:");
  console.log(legacy.rows[0]);
} catch (error) {
  console.error("Diagnostic failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
