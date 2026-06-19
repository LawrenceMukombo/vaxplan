import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runMigration() {
  console.log("Starting catalogue migration...");

  try {
    // 1. Create enum if it doesn't exist
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE commodity_type AS ENUM ('diluent', 'syringe', 'safety_box', 'ppe', 'cold_chain', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 1b. Alter existing approval_status enum
    await db.execute(sql`
      ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'published';
      ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'retired';
    `);
    
    // 2. Create catalogue_vaccines table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalogue_vaccines (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
        product_id VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        antigen_name VARCHAR(255),
        category VARCHAR(100),
        presentation VARCHAR(100),
        doses_per_vial INTEGER NOT NULL DEFAULT 1,
        wastage_threshold DECIMAL(5,2) DEFAULT '10.00',
        stock_managed BOOLEAN NOT NULL DEFAULT true,
        forecastable BOOLEAN NOT NULL DEFAULT true,
        requisitionable BOOLEAN NOT NULL DEFAULT true,
        requires_diluent BOOLEAN NOT NULL DEFAULT false,
        active BOOLEAN NOT NULL DEFAULT true,
        approval_status approval_status NOT NULL DEFAULT 'draft',
        effective_start_date TIMESTAMP,
        effective_end_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_catalogue_vaccines_tenant ON catalogue_vaccines(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_catalogue_vaccines_product ON catalogue_vaccines(product_id);
    `);

    // 3. Create catalogue_schedule_doses
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalogue_schedule_doses (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
        vaccine_id INTEGER REFERENCES catalogue_vaccines(id) ON DELETE CASCADE NOT NULL,
        name VARCHAR(100) NOT NULL,
        dose_number INTEGER NOT NULL DEFAULT 1,
        target_age VARCHAR(100),
        stock_deducting BOOLEAN NOT NULL DEFAULT true,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_catalogue_doses_tenant ON catalogue_schedule_doses(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_catalogue_doses_vaccine ON catalogue_schedule_doses(vaccine_id);
    `);

    // 4. Create catalogue_commodities
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalogue_commodities (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
        type commodity_type NOT NULL,
        name VARCHAR(255) NOT NULL,
        pack_size INTEGER NOT NULL DEFAULT 100,
        stock_managed BOOLEAN NOT NULL DEFAULT true,
        forecastable BOOLEAN NOT NULL DEFAULT true,
        consumption_rule JSONB DEFAULT '{}',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_catalogue_commodities_tenant ON catalogue_commodities(tenant_id);
    `);

    // 5. Add optional FKs to stock_transactions
    await db.execute(sql`
      ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS catalogue_vaccine_id INTEGER;
      ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS catalogue_commodity_id INTEGER;
    `);

    // 6. Seed default WHO catalogue for existing tenants
    const tenants = await db.execute(sql`SELECT id FROM tenants`);
    
    for (const tenantRow of tenants.rows) {
      const tenantId = tenantRow.id;

      // Seed PENTA
      const pentaResult = await db.execute(sql`
        INSERT INTO catalogue_vaccines (tenant_id, product_id, name, antigen_name, doses_per_vial, wastage_threshold, active, approval_status)
        VALUES (${tenantId}, 'vaccine_product_penta', 'PENTA', 'DTP-HepB-Hib', 10, 10.00, true, 'published')
        ON CONFLICT DO NOTHING
        RETURNING id;
      `);
      
      let pentaId = pentaResult.rows[0]?.id;
      if (!pentaId) {
        const existingPenta = await db.execute(sql`SELECT id FROM catalogue_vaccines WHERE tenant_id = ${tenantId} AND product_id = 'vaccine_product_penta'`);
        pentaId = existingPenta.rows[0]?.id;
      }

      if (pentaId) {
        await db.execute(sql`
          INSERT INTO catalogue_schedule_doses (tenant_id, vaccine_id, name, dose_number, target_age, stock_deducting)
          VALUES 
            (${tenantId}, ${pentaId}, 'PENTA-1', 1, '6 weeks', true),
            (${tenantId}, ${pentaId}, 'PENTA-2', 2, '10 weeks', true),
            (${tenantId}, ${pentaId}, 'PENTA-3', 3, '14 weeks', true)
          ON CONFLICT DO NOTHING;
        `);
      }

      // We will seed more vaccines later or via admin UI. PENTA acts as base test for migration.
    }

    console.log("Catalogue migration completed successfully.");
    return { success: true };
  } catch (error) {
    console.error("Migration failed:", error);
    return { success: false, error };
  }
}
