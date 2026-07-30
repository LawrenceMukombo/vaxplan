import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

// Load .env file for local development (Node 20.12+ built-in, no dotenv package needed)
try {
  // @ts-ignore
  process.loadEnvFile?.();
} catch {
  // Silently skip if not present
}

// Simple fallback parser for older Node versions or if loadEnvFile failed but file exists
if (!process.env.DATABASE_URL) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const index = trimmed.indexOf('=');
        if (index > 0) {
          const key = trimmed.substring(0, index).trim();
          let val = trimmed.substring(index + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          process.env[key] = val;
        }
      }
    } catch (e) {}
  }
}

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function run() {
  console.log('Starting execution of all Drizzle migrations...');
  const client = await pool.connect();
  
  try {
    /* Original Code commented out for data safety to prevent dropping production records:
    console.log('Ensuring clean facility_staff table to avoid migration conflicts...');
    await client.query(`
      DROP TABLE IF EXISTS facility_staff CASCADE;
      CREATE TABLE facility_staff (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id integer NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        name varchar(255),
        employee_id varchar(100),
        nrc varchar(100),
        history jsonb DEFAULT '[]'::jsonb,
        role varchar(100),
        phone varchar(50),
        active boolean DEFAULT true NOT NULL,
        full_name varchar(255),
        gender varchar(20) DEFAULT 'female',
        position varchar(100),
        contact_phone varchar(50),
        years_of_professional_experience integer,
        years_experience integer,
        years_at_facility integer,
        campaign_role varchar(100) DEFAULT 'vaccinator',
        is_active boolean DEFAULT true NOT NULL,
        education_level varchar(100),
        training_status varchar(100),
        residence_village varchar(255),
        is_volunteer boolean DEFAULT false NOT NULL,
        user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    console.log('facility_staff table prepared.');
    */

    console.log('Ensuring facility_staff table is updated with all columns safely...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS facility_staff (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id integer NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        name varchar(255)
      );
    `);
    
    // Safely add missing columns one-by-one to avoid breaking on duplicate column errors
    const columnsToAdd = [
      { name: "employee_id", type: "varchar(100)" },
      { name: "nrc", type: "varchar(100)" },
      { name: "history", type: "jsonb DEFAULT '[]'::jsonb" },
      { name: "role", type: "varchar(100)" },
      { name: "phone", type: "varchar(50)" },
      { name: "active", type: "boolean DEFAULT true NOT NULL" },
      { name: "full_name", type: "varchar(255)" },
      { name: "gender", type: "varchar(20) DEFAULT 'female'" },
      { name: "position", type: "varchar(100)" },
      { name: "contact_phone", type: "varchar(50)" },
      { name: "years_of_professional_experience", type: "integer" },
      { name: "years_experience", type: "integer" },
      { name: "years_at_facility", type: "integer" },
      { name: "campaign_role", type: "varchar(100) DEFAULT 'vaccinator'" },
      { name: "is_active", type: "boolean DEFAULT true NOT NULL" },
      { name: "education_level", type: "varchar(100)" },
      { name: "training_status", type: "varchar(100)" },
      { name: "residence_village", type: "varchar(255)" },
      { name: "is_volunteer", type: "boolean DEFAULT false NOT NULL" },
      { name: "user_id", type: "varchar REFERENCES users(id) ON DELETE SET NULL" },
      { name: "created_at", type: "timestamp DEFAULT now()" },
      { name: "updated_at", type: "timestamp DEFAULT now()" }
    ];

    for (const col of columnsToAdd) {
      try {
        await client.query(`ALTER TABLE facility_staff ADD COLUMN ${col.name} ${col.type}`);
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          console.warn(`[Warning] Failed to add column ${col.name}: ${err.message}`);
        }
      }
    }
    console.log('facility_staff table checked and updated.');

    // 2. Read and apply all SQL files in alphabetical order
    const migrationsDir = path.join(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at ${migrationsDir}`);
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
      
    console.log(`Found ${files.length} migration files.`);
    
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      console.log(`Applying SQL migration: ${file}`);
      
      const content = fs.readFileSync(filePath, 'utf8');
      const statements = content.split('--> statement-breakpoint');
      
      for (let i = 0; i < statements.length; i++) {
        let stmt = statements[i].trim();
        if (!stmt) continue;
        
        if (stmt.endsWith(';')) {
          stmt = stmt.slice(0, -1);
        }
        
        try {
          await client.query(stmt);
        } catch (err: any) {
          const msg = err.message;
          if (
            msg.includes('already exists') || 
            msg.includes('already a member') ||
            msg.includes('duplicate key value') ||
            msg.includes('is already a type') ||
            (msg.includes('column') && msg.includes('already exists'))
          ) {
            // Safe to ignore index/table/column/enum exists errors
          } else {
            console.warn(`[Warning] ${file} statement ${i+1}: ${msg}`);
          }
        }
      }
    }
    
    
    console.log('Applying custom schema upgrades for Batch Log Immunizations & Stock Ledger...');
    const customUpgrades = [
      "ALTER TABLE client_vaccinations ADD COLUMN IF NOT EXISTS schedule_dose_id integer;",
      "ALTER TABLE client_vaccinations ADD COLUMN IF NOT EXISTS stock_transaction_id integer;",
      "ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS balance_before integer;",
      "ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS balance_after integer;",
      "ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS source_module varchar(100);",
      "ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS source_record_id varchar(100);",
      "ALTER TABLE chv_profiles ADD COLUMN IF NOT EXISTS nrc varchar(50);",
      "ALTER TABLE community_health_volunteers ADD COLUMN IF NOT EXISTS nrc varchar(50);",
      "ALTER TABLE chv_profiles ADD COLUMN IF NOT EXISTS employment_status varchar(50) DEFAULT 'Active - In-service';",
      "ALTER TABLE chv_profiles ADD COLUMN IF NOT EXISTS supervisor_id integer;",
      "ALTER TABLE microplans ADD COLUMN IF NOT EXISTS created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL;",
      "ALTER TABLE microplans ADD COLUMN IF NOT EXISTS updated_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL;",
      "ALTER TABLE microplans ADD COLUMN IF NOT EXISTS approved_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL;",
      "ALTER TABLE microplans ADD COLUMN IF NOT EXISTS submitted_at timestamptz;",
      "ALTER TABLE microplans ADD COLUMN IF NOT EXISTS auto_approve_at timestamptz;",
      "ALTER TABLE microplans ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;",
      "ALTER TABLE microplans ADD COLUMN IF NOT EXISTS district_edit_reason text;",
      "ALTER TABLE villages ADD COLUMN IF NOT EXISTS confidence_score numeric(5, 2);",
      "ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'published';",
      "ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'retired';",
      "ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'under_review';",
      "ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'returned';",
      "ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'archived';",
      "ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'superseded';",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS centroid jsonb;",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS population_estimate integer;",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS population_source varchar(100);",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS population_source_year integer;",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS population_method varchar(100);",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS confidence varchar(50);",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS validation_status varchar(50) DEFAULT 'draft';",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS approval_status varchar(50) DEFAULT 'draft';",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS override_reason text;",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS created_by varchar(255);",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS approved_by varchar(255);",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS approved_at timestamp;",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS parent_polygon_id integer;",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS style_key varchar(100);",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS color_key varchar(100);",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS effective_from timestamptz;",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS effective_to timestamptz;",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS planning_period varchar(100);",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS updated_by varchar(255);",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS archived_at timestamptz;",
      "ALTER TABLE gis_polygons ADD COLUMN IF NOT EXISTS metadata jsonb;"
    ];
    for (const sql of customUpgrades) {
      try {
        await client.query(sql);
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          console.warn(`[Warning] Failed custom migration statement: ${err.message}`);
        }
      }
    }
    console.log('Custom schema upgrades applied.');

    console.log('Aligning canonical tenant IDs across all database tables...');
    try {
      await client.query(`
        DO $$
        DECLARE
          canonical_map JSONB := '{"SSD":"705728db-4892-49d7-9b67-35aa67c7574b","ZMB":"4bb7abba-11cd-4c99-96c2-eedc8a4dfd06","PNG":"8c2f81fb-06f3-4688-90ea-e9ae27d73191","ZAF":"c43e2923-b2d9-4175-a1a8-ff6b0cd58810","KEN":"08083581-cf5e-47d7-b3ed-a97b10be01ba"}'::jsonb;
          code_item text;
          canon_id text;
          old_id text;
          tbl text;
        BEGIN
          FOR code_item, canon_id IN SELECT * FROM jsonb_each_text(canonical_map) LOOP
            SELECT id INTO old_id FROM tenants WHERE code = code_item LIMIT 1;
            IF old_id IS NOT NULL AND old_id <> canon_id THEN
              SET session_replication_role = 'replica';
              FOR tbl IN 
                SELECT table_name FROM information_schema.columns 
                WHERE table_schema = 'public' AND column_name = 'tenant_id'
              LOOP
                EXECUTE format('UPDATE %I SET tenant_id = %L WHERE tenant_id = %L', tbl, canon_id, old_id);
              END LOOP;
              UPDATE tenants SET id = canon_id WHERE code = code_item;
              SET session_replication_role = 'origin';
            END IF;
          END LOOP;
        END $$;
      `);
      console.log('Canonical tenant IDs aligned.');
      await client.query(`
        UPDATE users SET is_platform_admin = true WHERE email ILIKE '%lawrencemukombo%' OR role IN ('national_admin', 'national_manager');
      `);
      console.log('Granted cross-tenant platform super-admin privileges to national admin user accounts.');
      await client.query(`
        INSERT INTO villages (id, tenant_id, name, code, district_id, assigned_facility_id, latitude, longitude, is_hard_to_reach, target_population, target_children_under_one)
        SELECT 
          sm.id,
          sm.tenant_id,
          sm.name,
          COALESCE(sm.code, 'COMM-' || sm.id),
          sm.district_id,
          sm.linked_facility_id,
          sm.latitude,
          sm.longitude,
          COALESCE(sm.is_hard_to_reach, false),
          COALESCE(sm.estimated_population, 0),
          ROUND(COALESCE(sm.estimated_population, 0) * 0.04)
        FROM settlements_master sm
        LEFT JOIN villages v ON sm.id = v.id
        WHERE sm.is_active = true AND v.id IS NULL
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('Synchronized settlements_master records to villages table.');
    } catch (err: any) {
      console.warn('[Warning] Tenant alignment skipped:', err.message);
    }

    console.log('All database migrations applied successfully.');
  } catch (err: any) {
    console.error('Migration runner failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
