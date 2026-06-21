import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function applySafeGeometryFixes(db: NodePgDatabase<any>): Promise<void> {
  // 1. Ensure PostGIS is enabled
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis`);

  // 2. Add missing columns to population_grids safely
  await db.execute(sql`
    ALTER TABLE population_grids 
    ADD COLUMN IF NOT EXISTS geometry geometry(Geometry, 4326),
    ADD COLUMN IF NOT EXISTS geojson jsonb
  `);

  // 3. Try to add imported_coverage constraint
  try {
    await db.execute(sql`
      ALTER TABLE imported_coverage
      ADD CONSTRAINT imported_coverage_unique UNIQUE (tenant_id, village_id, parameter, year)
    `);
  } catch (err: any) {
    // Constraint might already exist, or duplicates exist. Ignore safely.
  }
}
