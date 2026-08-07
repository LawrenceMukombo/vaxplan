import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Auto-load .env if process.env.DATABASE_URL is missing during CLI execution
if (!process.env.DATABASE_URL) {
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...valParts] = trimmed.split("=");
        const val = valParts.join("=").replace(/^["']|["']$/g, "");
        if (key && !process.env[key.trim()]) {
          process.env[key.trim()] = val.trim();
        }
      }
    }
  }
}

import { applySupervisionTemplatesSeed } from "../server/migrations/028-supervision-templates-seed";

async function main() {
  console.log("=================================================");
  console.log("  VaxPlan Supportive Supervision Templates Upsert ");
  console.log("=================================================");

  try {
    await applySupervisionTemplatesSeed();
    console.log("SUCCESS: Supportive Supervision Checklist Templates upserted successfully for all tenants.");
    process.exit(0);
  } catch (error: any) {
    console.error("ERROR: Failed to upsert supervision templates:", error?.message || error);
    process.exit(1);
  }
}

main();
