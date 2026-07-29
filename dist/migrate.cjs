"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scripts/migrate.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_pg = __toESM(require("pg"), 1);
try {
  process.loadEnvFile?.();
} catch {
}
if (!process.env.DATABASE_URL) {
  const envPath = import_node_path.default.join(process.cwd(), ".env");
  if (import_node_fs.default.existsSync(envPath)) {
    try {
      const envContent = import_node_fs.default.readFileSync(envPath, "utf8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const index = trimmed.indexOf("=");
        if (index > 0) {
          const key = trimmed.substring(0, index).trim();
          let val = trimmed.substring(index + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          process.env[key] = val;
        }
      }
    } catch (e) {
    }
  }
}
var { Pool } = import_pg.default;
var connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable is not set.");
  process.exit(1);
}
var pool = new Pool({ connectionString });
async function run() {
  console.log("Starting execution of all Drizzle migrations...");
  const client = await pool.connect();
  try {
    console.log("Ensuring facility_staff table is updated with all columns safely...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS facility_staff (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        facility_id integer NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        name varchar(255)
      );
    `);
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
      } catch (err) {
        if (!err.message.includes("already exists")) {
          console.warn(`[Warning] Failed to add column ${col.name}: ${err.message}`);
        }
      }
    }
    console.log("facility_staff table checked and updated.");
    const migrationsDir = import_node_path.default.join(process.cwd(), "migrations");
    if (!import_node_fs.default.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at ${migrationsDir}`);
    }
    const files = import_node_fs.default.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
    console.log(`Found ${files.length} migration files.`);
    for (const file of files) {
      const filePath = import_node_path.default.join(migrationsDir, file);
      console.log(`Applying SQL migration: ${file}`);
      const content = import_node_fs.default.readFileSync(filePath, "utf8");
      const statements = content.split("--> statement-breakpoint");
      for (let i = 0; i < statements.length; i++) {
        let stmt = statements[i].trim();
        if (!stmt) continue;
        if (stmt.endsWith(";")) {
          stmt = stmt.slice(0, -1);
        }
        try {
          await client.query(stmt);
        } catch (err) {
          const msg = err.message;
          if (msg.includes("already exists") || msg.includes("already a member") || msg.includes("duplicate key value") || msg.includes("is already a type") || msg.includes("column") && msg.includes("already exists")) {
          } else {
            console.warn(`[Warning] ${file} statement ${i + 1}: ${msg}`);
          }
        }
      }
    }
    console.log("Applying custom schema upgrades for Batch Log Immunizations & Stock Ledger...");
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
      "ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'superseded';"
    ];
    for (const sql of customUpgrades) {
      try {
        await client.query(sql);
      } catch (err) {
        if (!err.message.includes("already exists")) {
          console.warn(`[Warning] Failed custom migration statement: ${err.message}`);
        }
      }
    }
    console.log("Custom schema upgrades applied.");
    console.log("All database migrations applied successfully.");
  } catch (err) {
    console.error("Migration runner failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
//# sourceMappingURL=migrate.cjs.map
