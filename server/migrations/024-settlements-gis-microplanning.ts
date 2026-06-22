import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function applySettlementsGisMigration(db: NodePgDatabase<any>): Promise<void> {
  // 1. Add linkedSettlementId column to villages table
  try {
    await db.execute(sql`
      ALTER TABLE villages 
      ADD COLUMN IF NOT EXISTS linked_settlement_id integer
    `);
  } catch (err: any) {
    console.error("Migration: failed to add linked_settlement_id to villages:", err.message);
  }

  // 2. Add GIS, linkage, travel times, and status columns to settlements_master table
  try {
    await db.execute(sql`
      ALTER TABLE settlements_master 
      ADD COLUMN IF NOT EXISTS province_id integer,
      ADD COLUMN IF NOT EXISTS district_id integer,
      ADD COLUMN IF NOT EXISTS linked_community_id integer,
      ADD COLUMN IF NOT EXISTS linked_facility_id integer,
      ADD COLUMN IF NOT EXISTS nearest_facility_id integer,
      ADD COLUMN IF NOT EXISTS distance_to_linked_facility_km decimal(8, 2),
      ADD COLUMN IF NOT EXISTS estimated_walking_time_minutes integer,
      ADD COLUMN IF NOT EXISTS estimated_driving_time_minutes integer,
      ADD COLUMN IF NOT EXISTS travel_mode_planning varchar(50),
      ADD COLUMN IF NOT EXISTS dry_season_travel_time_minutes integer,
      ADD COLUMN IF NOT EXISTS rainy_season_travel_time_minutes integer,
      ADD COLUMN IF NOT EXISTS link_status varchar(50) DEFAULT 'unassigned',
      ADD COLUMN IF NOT EXISTS link_method varchar(50),
      ADD COLUMN IF NOT EXISTS link_confidence decimal(5, 2),
      ADD COLUMN IF NOT EXISTS link_notes text,
      ADD COLUMN IF NOT EXISTS service_status varchar(50) DEFAULT 'unserved',
      ADD COLUMN IF NOT EXISTS risk_level varchar(50) DEFAULT 'low',
      ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true
    `);
  } catch (err: any) {
    console.error("Migration: failed to add columns to settlements_master:", err.message);
  }
}
