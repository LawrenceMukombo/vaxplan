import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";
import * as fs from "fs";
import * as path from "path";

const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/vaxplan";

async function exportAll() {
  console.log("🔌 Connecting to local database...");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  const tablesToExport = [
    { name: "tenants", table: schema.tenants },
    { name: "users", table: schema.users },
    { name: "userRoles", table: schema.userRoles },
    { name: "userPermissions", table: schema.userPermissions },
    { name: "provinces", table: schema.provinces },
    { name: "districts", table: schema.districts },
    { name: "llgs", table: schema.llgs },
    { name: "facilities", table: schema.facilities },
    { name: "villages", table: schema.villages },
    { name: "populationData", table: schema.populationData },
    { name: "microplans", table: schema.microplans },
    { name: "sessionPlans", table: schema.sessionPlans },
    { name: "sessionVillages", table: schema.sessionVillages },
    { name: "budgetItems", table: schema.budgetItems },
    { name: "vaccineRequirements", table: schema.vaccineRequirements },
    { name: "mobilizationActivities", table: schema.mobilizationActivities },
    { name: "supervisionVisits", table: schema.supervisionVisits },
    { name: "auditLogs", table: schema.auditLogs },
    { name: "htrScores", table: schema.htrScores },
    { name: "chvProfiles", table: schema.chvProfiles },
    { name: "facilityStaff", table: schema.facilityStaff },
    { name: "customLayers", table: schema.customLayers },
    { name: "facilityCatchments", table: schema.facilityCatchments },
    { name: "vaccineConfigurations", table: schema.vaccineConfigurations },
    { name: "clients", table: schema.clients },
    { name: "clientVaccinations", table: schema.clientVaccinations },
    { name: "sessionDayPlans", table: schema.sessionDayPlans },
    { name: "quarterlyReviews", table: schema.quarterlyReviews },
    { name: "uncoveredCommunities", table: schema.uncoveredCommunities },
    { name: "adminBoundaries", table: schema.adminBoundaries },
    { name: "entityHistoryVersions", table: schema.entityHistoryVersions },
    { name: "userAssignmentHistory", table: schema.userAssignmentHistory },
    { name: "facilityHistoryVersions", table: schema.facilityHistoryVersions },
    { name: "communityHistoryVersions", table: schema.communityHistoryVersions },
    { name: "populationHistoryVersions", table: schema.populationHistoryVersions },
    { name: "vaccineScheduleHistoryVersions", table: schema.vaccineScheduleHistoryVersions },
    { name: "stockReferenceHistoryVersions", table: schema.stockReferenceHistoryVersions },
  ];

  const exportData: Record<string, any[]> = {};

  for (const { name, table } of tablesToExport) {
    try {
      console.log(`📥 Exporting ${name}...`);
      const rows = await db.select().from(table);
      exportData[name] = rows;
      console.log(`   ✓ Exported ${rows.length} rows`);
    } catch (err: any) {
      console.error(`❌ Failed to export ${name}:`, err.message);
    }
  }

  const exportPath = path.join(process.cwd(), "scratch", "localhost_data.json");
  fs.mkdirSync(path.dirname(exportPath), { recursive: true });
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), "utf-8");
  console.log(`🎉 Export complete! Saved to ${exportPath}`);

  await pool.end();
}

exportAll().catch(console.error);
