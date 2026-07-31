import pg from "pg";
import { upsertEntireDatabase } from "./upsert-entire-database.ts";

try {
  // @ts-ignore
  process.loadEnvFile?.();
} catch {}

async function run() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const vnmId = "1a39bf12-bf10-4415-b2dd-96f1ece09b75";

  console.log("--- Wiping existing online Vietnam records ---");
  const tablesToClean = [
    "session_day_plans", "session_villages", "session_plans", "client_vaccinations",
    "surveillance_cases", "supervision_visits", "budget_items", "uncovered_communities",
    "population_data", "villages", "facilities", "districts", "provinces",
  ];
  for (const table of tablesToClean) {
    try {
      await pool.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [vnmId]);
    } catch (err: any) {
      console.warn(`  Notice cleaning ${table}:`, err.message);
    }
  }
  console.log("✓ Vietnam data cleared. Now upserting fresh dev instance...");
  await pool.end();

  await upsertEntireDatabase();
}

run().catch((err) => {
  console.error("Reimport failed:", err);
  process.exit(1);
});
