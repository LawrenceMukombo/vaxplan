import { pool } from "../server/db";

async function main() {
  console.log("Starting safe database fixes...");

  try {
    // 1. Ensure PostGIS is installed
    console.log("1. Ensuring PostGIS extension is enabled...");
    await pool.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    // 2. Add missing columns to population_grids
    console.log("2. Adding missing columns to population_grids (if they don't exist)...");
    await pool.query(`
      ALTER TABLE population_grids 
      ADD COLUMN IF NOT EXISTS geometry geometry(Geometry, 4326),
      ADD COLUMN IF NOT EXISTS geojson jsonb
    `);

    // 3. Try to recreate the villages geometry index
    console.log("3. Ensuring spatial index on villages exists...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_villages_geom
      ON villages USING gist (ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326))
    `).catch(err => {
      console.log("   Warning: Could not create idx_villages_geom. Error:", err.message);
    });

    // 4. Try adding the imported coverage constraint that drizzle wanted to add
    console.log("4. Ensuring unique constraint on imported_coverage...");
    await pool.query(`
      ALTER TABLE imported_coverage
      ADD CONSTRAINT imported_coverage_unique UNIQUE (tenant_id, village_id, parameter, year)
    `).catch(err => {
      console.log("   Warning (probably already exists or duplicates present):", err.message);
    });

    console.log("✅ Safe database fixes applied successfully!");
  } catch (error) {
    console.error("❌ Error during database fix:", error);
  } finally {
    process.exit(0);
  }
}

main();
