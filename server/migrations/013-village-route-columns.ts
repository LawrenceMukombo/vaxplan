import { db } from "../db";
import { sql } from "drizzle-orm";

export async function applyVillageColumns(): Promise<void> {
  const statements = [
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS accessibility_score varchar(50)`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS referral_route text`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS linked_settlement_id integer`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS is_mapped_in_hmis boolean DEFAULT false`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS last_verified timestamp`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS detection_source varchar(50)`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS confidence_score decimal(5, 2)`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS high_risk boolean DEFAULT false`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS high_risk_reason varchar(255)`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS settlement_type varchar(50) DEFAULT 'village'`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS border_village_country varchar(100)`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS border_village_facility_name varchar(255)`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS is_cross_border boolean DEFAULT false`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS border_country varchar(100)`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS is_crossing_point boolean DEFAULT false`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS crossing_type varchar(50)`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS daily_movement_volume integer`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS focal_person_name varchar(255)`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS focal_person_phone varchar(50)`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS focal_person_comm_checked boolean DEFAULT false`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS outside_follow_up_made boolean DEFAULT false`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS total_catchment_population integer`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS under5_population integer`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS catchment_polygon jsonb`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS gridded_population integer`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS population_source_label varchar(100)`,
    `ALTER TABLE villages ADD COLUMN IF NOT EXISTS polygon_color varchar(7)`
  ];
  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
      console.log(`[migration] Executed statement: ${stmt}`);
    } catch (err: any) {
      console.error(`[migration] Failed statement: ${stmt} - ${err.message}`);
    }
  }
}
