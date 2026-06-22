import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";

try {
  const envPath = path.join(process.cwd(), ".env");
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const [key, ...value] = line.split("=");
    if (key && value.length > 0) {
      process.env[key.trim()] = value.join("=").trim().replace(/(^['"]|['"]$)/g, '');
    }
  }
} catch (e) {
  console.log("No .env file found or error reading it.");
}

async function main() {
  const { db } = await import("../server/db");
  console.log("Starting safe database index addition for villages...");

  try {
    console.log("Creating index on villages(district_id)...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_villages_district" ON "villages" USING btree ("district_id");
    `);

    console.log("Creating index on villages(assigned_facility_id)...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_villages_facility" ON "villages" USING btree ("assigned_facility_id");
    `);

    console.log("Creating index on villages(name)...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_villages_name" ON "villages" USING btree ("name");
    `);

    console.log("✅ Database indexes created successfully!");
  } catch (err: any) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    process.exit(0);
  }
}

main();
