import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { spawn } from "child_process";
import path from "path";

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Running command: ${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command ${command} exited with code ${code}`));
      }
    });
    child.on("error", (err) => {
      reject(err);
    });
  });
}

async function bootstrap() {
  console.log("[Railway Bootstrap] Starting database migration...");
  
  // 1. Run migrations
  try {
    await runCommand("node", ["dist/migrate.cjs"]);
    console.log("[Railway Bootstrap] Migrations applied successfully.");
  } catch (err: any) {
    console.error("[Railway Bootstrap] Migration run failed:", err.message);
    process.exit(1);
  }

  // 2. Check if database has any tenants seeded
  console.log("[Railway Bootstrap] Checking database content state...");
  try {
    const result = await db.execute(sql`SELECT COUNT(*)::int as count FROM tenants`);
    const count = result.rows[0]?.count ?? 0;
    
    if (count === 0) {
      console.log("[Railway Bootstrap] Database is empty (0 tenants found). Triggering first-run database seed...");
      await runCommand("npx", ["tsx", "scripts/seed-all.ts"]);
      console.log("[Railway Bootstrap] Seeding sequence completed successfully.");
    } else {
      console.log(`[Railway Bootstrap] Database already initialized with ${count} tenant(s). Skipping seeding.`);
    }
  } catch (err: any) {
    console.error("[Railway Bootstrap] Error checking database state:", err.message);
    // Don't crash server startup if check fails, just log it and proceed
  }
  
  console.log("[Railway Bootstrap] Bootstrapping complete.");
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error("[Railway Bootstrap] Uncaught error during bootstrap:", err);
  process.exit(1);
});
