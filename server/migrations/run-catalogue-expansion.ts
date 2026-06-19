import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Starting catalogue expansion migration...");

  try {
    // 1. Create Enums if they don't exist
    await db.execute(sql`
      DO $$ BEGIN
          CREATE TYPE dose_classification AS ENUM ('routine', 'campaign', 'outbreak', 'school_based', 'other');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Alter catalogue_vaccines
    console.log("Altering catalogue_vaccines...");
    await db.execute(sql`
      ALTER TABLE catalogue_vaccines 
      ADD COLUMN IF NOT EXISTS requires_injection_device BOOLEAN DEFAULT true NOT NULL,
      ADD COLUMN IF NOT EXISTS requires_safety_box BOOLEAN DEFAULT true NOT NULL,
      ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(50) DEFAULT 'vials',
      ADD COLUMN IF NOT EXISTS storage_temperature VARCHAR(50) DEFAULT '+2 to +8 °C',
      ADD COLUMN IF NOT EXISTS routine_use BOOLEAN DEFAULT true NOT NULL,
      ADD COLUMN IF NOT EXISTS campaign_use BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS outbreak_use BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '{}'::jsonb NOT NULL;
    `);

    // 3. Alter catalogue_schedule_doses
    console.log("Altering catalogue_schedule_doses...");
    await db.execute(sql`
      ALTER TABLE catalogue_schedule_doses 
      ADD COLUMN IF NOT EXISTS dose_code VARCHAR(100),
      ADD COLUMN IF NOT EXISTS minimum_age VARCHAR(100),
      ADD COLUMN IF NOT EXISTS maximum_age VARCHAR(100),
      ADD COLUMN IF NOT EXISTS minimum_interval VARCHAR(100),
      ADD COLUMN IF NOT EXISTS target_population_group VARCHAR(100) DEFAULT 'infants',
      ADD COLUMN IF NOT EXISTS route VARCHAR(100),
      ADD COLUMN IF NOT EXISTS site VARCHAR(100),
      ADD COLUMN IF NOT EXISTS classification dose_classification DEFAULT 'routine' NOT NULL,
      ADD COLUMN IF NOT EXISTS effective_start_date TIMESTAMP DEFAULT now(),
      ADD COLUMN IF NOT EXISTS approval_status approval_status DEFAULT 'draft' NOT NULL;
    `);

    // Ensure dose_code is populated before making it not null
    await db.execute(sql`
      UPDATE catalogue_schedule_doses SET dose_code = lower(replace(name, ' ', '_')) WHERE dose_code IS NULL;
    `);
    await db.execute(sql`ALTER TABLE catalogue_schedule_doses ALTER COLUMN dose_code SET NOT NULL;`);

    // 4. Alter catalogue_commodities
    console.log("Altering catalogue_commodities...");
    await db.execute(sql`
      ALTER TABLE catalogue_commodities 
      ADD COLUMN IF NOT EXISTS commodity_code VARCHAR(100),
      ADD COLUMN IF NOT EXISTS category VARCHAR(100),
      ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(50) DEFAULT 'pieces',
      ADD COLUMN IF NOT EXISTS requisitionable BOOLEAN DEFAULT true NOT NULL,
      ADD COLUMN IF NOT EXISTS session_supply BOOLEAN DEFAULT true NOT NULL,
      ADD COLUMN IF NOT EXISTS linked_vaccine_id INTEGER REFERENCES catalogue_vaccines(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS buffer_percentage DECIMAL(5,2) DEFAULT 10.00,
      ADD COLUMN IF NOT EXISTS minimum_stock_threshold INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS maximum_stock_threshold INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '{}'::jsonb NOT NULL;
    `);

    await db.execute(sql`
      UPDATE catalogue_commodities SET commodity_code = lower(replace(name, ' ', '_')) WHERE commodity_code IS NULL;
    `);
    await db.execute(sql`ALTER TABLE catalogue_commodities ALTER COLUMN commodity_code SET NOT NULL;`);

    // 5. Create catalogue_wastage_thresholds
    console.log("Creating catalogue_wastage_thresholds...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalogue_wastage_thresholds (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        vaccine_id INTEGER NOT NULL REFERENCES catalogue_vaccines(id) ON DELETE CASCADE,
        wastage_rate DECIMAL(5,2) NOT NULL,
        wastage_factor DECIMAL(5,2) NOT NULL,
        min_acceptable DECIMAL(5,2),
        max_acceptable DECIMAL(5,2),
        strategy VARCHAR(100) DEFAULT 'routine',
        active BOOLEAN DEFAULT true NOT NULL,
        notes TEXT,
        effective_start_date TIMESTAMP DEFAULT now(),
        effective_end_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_catalogue_wastage_tenant ON catalogue_wastage_thresholds(tenant_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_catalogue_wastage_vaccine ON catalogue_wastage_thresholds(vaccine_id);
    `);

    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
