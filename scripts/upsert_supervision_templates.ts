import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Auto-load .env synchronously BEFORE importing db modules
if (!process.env.DATABASE_URL) {
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...valParts] = trimmed.split("=");
        const val = valParts.join("=").trim().replace(/^["']|["']$/g, "");
        const k = key.trim();
        if (k && !process.env[k]) {
          process.env[k] = val;
        }
      }
    }
  }
}

async function main() {
  console.log("=================================================");
  console.log("  VaxPlan Supportive Supervision Templates Upsert ");
  console.log("=================================================");

  try {
    // Dynamic import to ensure process.env.DATABASE_URL is set BEFORE server/db.ts is evaluated
    const { applySupervisionTemplatesSeed } = await import("../server/migrations/028-supervision-templates-seed");
    await applySupervisionTemplatesSeed();
    console.log("SUCCESS: Supportive Supervision Checklist Templates upserted successfully for all tenants.");
    process.exit(0);
  } catch (error: any) {
    console.error("ERROR: Failed to upsert supervision templates:", error?.message || error);
    process.exit(1);
  }
}

main();
