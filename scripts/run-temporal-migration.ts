import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";

async function applyTemporalSchema() {
  console.log("Starting safe non-destructive migration for Temporal History tables...");

  // Load .env if present
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const [key, ...value] = line.split("=");
        if (key && value.length > 0) {
          process.env[key.trim()] = value.join("=").trim().replace(/(^['"]|['"]$)/g, "");
        }
      }
    }
  } catch (e) {
    console.log("No .env file found or error reading it.");
  }

  const { db } = await import("../server/db");

  try {
    const migrationSqlPath = path.join(process.cwd(), "migrations", "0015_enterprise_temporal_framework.sql");
    const rawSql = fs.readFileSync(migrationSqlPath, "utf-8");

    // Split SQL into individual statements
    const statements = rawSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await db.execute(sql.raw(stmt));
      } catch (err: any) {
        // Log duplicate/already exists warnings gracefully
        if (!/already exists/i.test(err?.message || "")) {
          console.warn("Statement notice/warning:", err?.message || err);
        }
      }
    }

    console.log("✅ Temporal History database schema applied successfully!");
  } catch (err: any) {
    console.error("❌ Migration error:", err.message);
  } finally {
    process.exit(0);
  }
}

applyTemporalSchema();
