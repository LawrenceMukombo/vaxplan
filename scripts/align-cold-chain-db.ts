import { db } from "../server/db";
import { sql } from "drizzle-orm";
import fs from "fs";

async function main() {
  console.log("Starting DB migration for cold_chain_equipment...");

  // Load the backup JSON
  const backupPath = "cold_chain_backup.json";
  if (!fs.existsSync(backupPath)) {
    throw new Error("Backup file cold_chain_backup.json not found! Run backup script first.");
  }
  const backupRows = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  console.log(`Loaded ${backupRows.length} rows from backup.`);

  // We run the schema change and reload inside a transaction
  await db.transaction(async (tx) => {
    // 1. Drop existing table
    console.log("Dropping old cold_chain_equipment table...");
    await tx.execute(sql`DROP TABLE IF EXISTS cold_chain_equipment CASCADE;`);

    // 2. Create new table using correct schema
    console.log("Creating new cold_chain_equipment table...");
    await tx.execute(sql`
      CREATE TABLE cold_chain_equipment (
        id                           SERIAL PRIMARY KEY,
        tenant_id                    VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id                  INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

        -- Equipment classification
        equipment_type               VARCHAR(60)  NOT NULL,
        -- refrigerator | freezer | icm | cold_box | vaccine_carrier | generator | temperature_logger | other

        brand                        VARCHAR(100),
        model                        VARCHAR(100),
        serial_number                VARCHAR(100),
        catalog_number               VARCHAR(100),

        -- Physical specs
        capacity_liters              NUMERIC(8,2),
        net_storage_capacity_liters  NUMERIC(8,2),
        temperature_min              NUMERIC(5,1),
        temperature_max              NUMERIC(5,1),

        -- Power & energy
        power_source                 VARCHAR(40),
        energy_consumption_kwh_day   NUMERIC(6,2),

        -- Provenance & lifecycle
        manufacture_year             INTEGER,
        installation_date            VARCHAR(20),
        purchase_cost                NUMERIC(14,2),
        purchase_currency            VARCHAR(5)   DEFAULT 'USD',
        warranty_expiry              VARCHAR(20),
        supplier                     VARCHAR(255),
        donor_funded                 BOOLEAN      DEFAULT FALSE,
        funding_source               VARCHAR(100),

        -- Maintenance & condition
        condition                    VARCHAR(30)  NOT NULL DEFAULT 'functional',
        -- functional | needs_repair | non_functional | condemned | decommissioned
        last_service_date            VARCHAR(20),
        next_service_due             VARCHAR(20),
        last_temperature_check       VARCHAR(20),
        maintenance_notes            TEXT,

        -- Flags & metadata
        is_active                    BOOLEAN      NOT NULL DEFAULT TRUE,
        notes                        TEXT,
        external_id                  VARCHAR(100),

        created_by_user_id           VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id           VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Creating indices...");
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS idx_cce_tenant ON cold_chain_equipment(tenant_id);`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS idx_cce_facility ON cold_chain_equipment(facility_id);`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS idx_cce_condition ON cold_chain_equipment(tenant_id, condition);`);

    // 3. Migrate and insert records
    console.log("Migrating and inserting records...");
    for (const r of backupRows) {
      const capacity_liters = r.volume_litres ? parseFloat(r.volume_litres) : null;
      const net_storage_capacity_liters = r.storage_capacity_litres ? parseFloat(r.storage_capacity_litres) : null;
      const temperature_min = r.min_temp ? parseFloat(r.min_temp) : null;
      const temperature_max = r.max_temp ? parseFloat(r.max_temp) : null;
      
      const installation_date = r.year_installed ? String(r.year_installed) : null;
      const warranty_expiry = r.warranty_expiry_date ? String(r.warranty_expiry_date).substring(0, 10) : null;
      const last_service_date = r.last_maintenance_date ? String(r.last_maintenance_date).substring(0, 10) : null;
      const next_service_due = r.next_maintenance_date ? String(r.next_maintenance_date).substring(0, 10) : null;
      const last_temperature_check = r.last_temperature_check ? String(r.last_temperature_check).substring(0, 10) : null;
      
      const external_id = r.iga_id || null;

      await tx.execute(sql`
        INSERT INTO cold_chain_equipment (
          id, tenant_id, facility_id, equipment_type, brand, model, serial_number, catalog_number,
          capacity_liters, net_storage_capacity_liters, temperature_min, temperature_max,
          power_source, energy_consumption_kwh_day, manufacture_year, installation_date,
          purchase_cost, purchase_currency, warranty_expiry, supplier, donor_funded, funding_source,
          condition, last_service_date, next_service_due, last_temperature_check, maintenance_notes,
          is_active, notes, external_id, created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (
          ${r.id}, ${r.tenant_id}, ${r.facility_id}, ${r.equipment_type}, ${r.brand}, ${r.model}, ${r.serial_number}, ${r.catalog_number},
          ${capacity_liters}, ${net_storage_capacity_liters}, ${temperature_min}, ${temperature_max},
          ${r.power_source}, null, ${r.year_of_manufacture}, ${installation_date},
          null, 'USD', ${warranty_expiry}, null, false, null,
          ${r.condition}, ${last_service_date}, ${next_service_due}, ${last_temperature_check}, ${r.maintenance_notes},
          ${r.is_active}, null, ${external_id}, ${r.created_by_user_id}, null, ${r.created_at}, ${r.updated_at}
        )
      `);
    }

    // 4. Reset the sequence for SERIAL primary key 'id'
    console.log("Resetting auto-increment sequence for id...");
    await tx.execute(sql`SELECT setval(pg_get_serial_sequence('cold_chain_equipment', 'id'), COALESCE(MAX(id), 1)) FROM cold_chain_equipment;`);
  });

  console.log("✅ Database migration and data restoration complete successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
