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
  await pool.query("DELETE FROM facilities WHERE tenant_id = $1", [vnmId]);
  await pool.query("DELETE FROM villages WHERE tenant_id = $1", [vnmId]);
  await pool.query("DELETE FROM districts WHERE tenant_id = $1", [vnmId]);
  await pool.query("DELETE FROM provinces WHERE tenant_id = $1", [vnmId]);
  await pool.query("DELETE FROM population_data WHERE tenant_id = $1", [vnmId]);
  console.log("✓ Vietnam data cleared. Now upserting fresh dev instance...");
  await pool.end();

  await upsertEntireDatabase();
}

run().catch((err) => {
  console.error("Reimport failed:", err);
  process.exit(1);
});
