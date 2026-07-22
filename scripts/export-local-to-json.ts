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
    { name: "users", table: schema.users },
    { name: "userRoles", table: schema.userRoles },
    { name: "userPermissions", table: schema.userPermissions },
    { name: "microplans", table: schema.microplans },
    { name: "chvProfiles", table: schema.chvProfiles },
    { name: "facilityStaff", table: schema.facilityStaff },
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
