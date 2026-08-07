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
