import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();

  const result = await client.query(`
    SELECT username, active, role
    FROM public.users
    ORDER BY username
  `);

  console.table(result.rows);
} catch (error) {
  console.error("Database check failed:", error.message);
} finally {
  await client.end().catch(() => {});
}
