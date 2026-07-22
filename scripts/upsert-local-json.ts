import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";
import { sql, eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ DATABASE_URL is not set!");
  process.exit(1);
}

// Helper to convert serialized date strings back to Date objects
function parseDates(row: any) {
  if (!row) return row;
  const result = { ...row };
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (val && typeof val === "string") {
      const isDateKey = key.toLowerCase().endsWith("at") ||
                        key.toLowerCase().endsWith("date") ||
                        key.toLowerCase().endsWith("from") ||
                        key.toLowerCase().endsWith("to");
      const isIsoString = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val);
      
      if (isDateKey || isIsoString) {
        const parsed = Date.parse(val);
        if (!isNaN(parsed)) {
          result[key] = new Date(val);
        }
      }
    }
  }
  return result;
}

// Helper to serialize objects/arrays for JSON/JSONB columns
function serializeJsonFields(row: any) {
  if (!row) return row;
  const result = { ...row };
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (val !== null && typeof val === "object" && !(val instanceof Date)) {
      result[key] = JSON.stringify(val);
    }
  }
  return result;
}

async function importAll() {
  const jsonPath = path.join(process.cwd(), "localhost_data.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Data file not found at ${jsonPath}`);
    process.exit(1);
  }

  console.log("📖 Reading localhost_data.json...");
  const exportData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  console.log("🔌 Connecting to production database...");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  const tablesToImport = [
    { name: "users", table: schema.users, key: "id" },
    { name: "userRoles", table: schema.userRoles, key: "id" },
    { name: "userPermissions", table: schema.userPermissions, key: "id" },
    { name: "microplans", table: schema.microplans, key: "id" },
    { name: "chvProfiles", table: schema.chvProfiles, key: "id" },
    { name: "facilityStaff", table: schema.facilityStaff, key: "id" },
    { name: "entityHistoryVersions", table: schema.entityHistoryVersions, key: "id" },
    { name: "userAssignmentHistory", table: schema.userAssignmentHistory, key: "id" },
    { name: "facilityHistoryVersions", table: schema.facilityHistoryVersions, key: "id" },
    { name: "communityHistoryVersions", table: schema.communityHistoryVersions, key: "id" },
    { name: "populationHistoryVersions", table: schema.populationHistoryVersions, key: "id" },
    { name: "vaccineScheduleHistoryVersions", table: schema.vaccineScheduleHistoryVersions, key: "id" },
    { name: "stockReferenceHistoryVersions", table: schema.stockReferenceHistoryVersions, key: "id" },
  ];

  for (const { name, table, key } of tablesToImport) {
    const rows = exportData[name];
    if (!rows || rows.length === 0) {
      console.log(`ℹ️ No rows to import for ${name}`);
      continue;
    }

    console.log(`⚙️ Importing ${rows.length} rows into ${name}...`);
    let inserted = 0;
    let skipped = 0;

    for (const rawRow of rows) {
      let row = parseDates(rawRow);
      row = serializeJsonFields(row);
      try {
        const existing = await db
          .select()
          .from(table)
          .where(eq(table[key], row[key]))
          .limit(1);

        if (existing.length > 0) {
          const tenantId = row.tenantId || existing[0].tenantId;
          const isLocalTenant = tenantId === undefined || tenantId === null || tenantId === "ZMB" || tenantId.includes("4bb7abba");
          
          if (!isLocalTenant) {
            skipped++;
            continue;
          }

          // EXCLUDE PRIMARY KEY FROM UPDATE PAYLOAD TO AVOID IDENTITY COLUMN ERRORS
          const { [key]: _, ...updateFields } = row;
          await db
            .update(table)
            .set(updateFields)
            .where(eq(table[key], row[key]));
        } else {
          // If inserting a record into a table with generated always as identity,
          // we might need to override identity if possible, but Drizzle uses normal insert.
          // In PG, generated always can be bypassed with OVERRIDING SYSTEM VALUE.
          // For safety, let's try standard insert first.
          await db.insert(table).values(row);
        }
        inserted++;
      } catch (err: any) {
        console.error(`   ⚠️ Error importing row ${row[key]} in ${name}:`);
        console.error(err);
      }
    }
    console.log(`   ✓ Completed ${name}: ${inserted} inserted/updated, ${skipped} skipped (protected)`);
  }

  console.log("🔄 Updating database primary key sequences...");
  const serialTables = [
    "provinces", "districts", "llgs", "facilities", "villages", "population_data",
    "microplans", "session_plans", "session_villages", "budget_items", "vaccine_requirements",
    "mobilization_activities", "supervision_visits", "audit_logs", "htr_scores",
    "facility_staff", "custom_layers", "facility_catchments", "vaccine_configurations",
    "session_day_plans", "quarterly_reviews", "uncovered_communities", "entity_history_versions",
    "user_assignment_history", "facility_history_versions", "community_history_versions",
    "population_history_versions", "vaccine_schedule_history_versions", "stock_reference_history_versions"
  ];

  for (const table of serialTables) {
    try {
      await db.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table};`));
    } catch (err: any) {
      // Ignore
    }
  }

  console.log("🎉 Idempotent upsert & merge complete!");
  await pool.end();
}

importAll().catch(console.error);
