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
    { name: "tenants", table: schema.tenants, key: "id" },
    { name: "users", table: schema.users, key: "id" },
    { name: "userRoles", table: schema.userRoles, key: "id" },
    { name: "userPermissions", table: schema.userPermissions, key: "id" },
    { name: "provinces", table: schema.provinces, key: "id" },
    { name: "districts", table: schema.districts, key: "id" },
    { name: "llgs", table: schema.llgs, key: "id" },
    { name: "facilities", table: schema.facilities, key: "id" },
    { name: "villages", table: schema.villages, key: "id" },
    { name: "populationData", table: schema.populationData, key: "id" },
    { name: "microplans", table: schema.microplans, key: "id" },
    { name: "sessionPlans", table: schema.sessionPlans, key: "id" },
    { name: "sessionVillages", table: schema.sessionVillages, key: "id" },
    { name: "budgetItems", table: schema.budgetItems, key: "id" },
    { name: "vaccineRequirements", table: schema.vaccineRequirements, key: "id" },
    { name: "mobilizationActivities", table: schema.mobilizationActivities, key: "id" },
    { name: "supervisionVisits", table: schema.supervisionVisits, key: "id" },
    { name: "auditLogs", table: schema.auditLogs, key: "id" },
    { name: "htrScores", table: schema.htrScores, key: "id" },
    { name: "chvProfiles", table: schema.chvProfiles, key: "id" },
    { name: "facilityStaff", table: schema.facilityStaff, key: "id" },
    { name: "customLayers", table: schema.customLayers, key: "id" },
    { name: "facilityCatchments", table: schema.facilityCatchments, key: "id" },
    { name: "vaccineConfigurations", table: schema.vaccineConfigurations, key: "id" },
    { name: "clients", table: schema.clients, key: "id" },
    { name: "clientVaccinations", table: schema.clientVaccinations, key: "id" },
    { name: "sessionDayPlans", table: schema.sessionDayPlans, key: "id" },
    { name: "quarterlyReviews", table: schema.quarterlyReviews, key: "id" },
    { name: "uncoveredCommunities", table: schema.uncoveredCommunities, key: "id" },
    { name: "adminBoundaries", table: schema.adminBoundaries, key: "id" },
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

    for (const row of rows) {
      try {
        // Safe check: If the row contains a tenantId and is NOT Zambia (the local tenant), skip it
        // Or if it matches a production-only tenant, protect it.
        const existing = await db
          .select()
          .from(table)
          .where(eq(table[key], row[key]))
          .limit(1);

        if (existing.length > 0) {
          const tenantId = row.tenantId || existing[0].tenantId;
          const isLocalTenant = tenantId === undefined || tenantId === null || tenantId === "ZMB" || tenantId.includes("4bb7abba");
          
          if (!isLocalTenant) {
            console.log(`   [SKIP] Protecting production row ${row[key]} in ${name} (Tenant: ${tenantId})`);
            skipped++;
            continue;
          }

          await db
            .update(table)
            .set(row)
            .where(eq(table[key], row[key]));
        } else {
          await db.insert(table).values(row);
        }
        inserted++;
      } catch (err: any) {
        console.error(`   ⚠️ Error importing row ${row[key]} in ${name}:`, err.message);
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
      // Ignore if not serial
    }
  }

  console.log("🎉 Idempotent upsert & merge complete!");
  await pool.end();
}

importAll().catch(console.error);
