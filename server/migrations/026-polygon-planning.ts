import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function applyPolygonPlanningMigration(db: NodePgDatabase<any>): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE gis_polygons 
      ADD COLUMN IF NOT EXISTS centroid jsonb,
      ADD COLUMN IF NOT EXISTS population_estimate integer,
      ADD COLUMN IF NOT EXISTS population_source varchar(100),
      ADD COLUMN IF NOT EXISTS population_source_year integer,
      ADD COLUMN IF NOT EXISTS population_method varchar(100),
      ADD COLUMN IF NOT EXISTS confidence varchar(50),
      ADD COLUMN IF NOT EXISTS validation_status varchar(50) DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS approval_status varchar(50) DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS override_reason text,
      ADD COLUMN IF NOT EXISTS created_by varchar(255),
      ADD COLUMN IF NOT EXISTS approved_by varchar(255),
      ADD COLUMN IF NOT EXISTS approved_at timestamp
    `);
  } catch (err: any) {
    console.error("Migration: failed to add columns to gis_polygons:", err.message);
  }
}
