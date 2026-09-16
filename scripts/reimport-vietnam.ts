import pg from "pg";
import { upsertEntireDatabase } from "./upsert-entire-database.ts";

try {
  // @ts-ignore
  process.loadEnvFile?.();
} catch {}

async function run() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const vnmId = "1a39bf12-bf10-4415-b2dd-96f1ece09b75";

  // Enforce DATA SAFETY: NO WIPE, NO OVERWRITE, UPSERT ONLY.
  // Destructive DELETE FROM calls have been removed to preserve data integrity.
  console.log("--- Safely upserting Vietnam records (UPSERT ONLY) ---");
  await pool.end();

  await upsertEntireDatabase();
}

run().catch((err) => {
  console.error("Reimport failed:", err);
  process.exit(1);
});
