import { db } from "../server/db";
import { VgieService } from "../server/services/vgieService";
import { tenants } from "../shared/schema";

async function run() {
  try {
    // Get the first tenant ID to test with
    const allTenants = await db.select().from(tenants);
    if (allTenants.length === 0) {
      console.log("No tenants found.");
      process.exit(1);
    }
    const tenantId = allTenants[0].id;
    console.log(`Running VGIE for tenant: ${tenantId}`);
    
    // Test the function that previously failed with the 500 SQL error
    const recommendations = await VgieService.generateRecommendations(tenantId);
    console.log(`Success! Generated ${recommendations.length} recommendations.`);
    
    const alerts = await VgieService.detectCoverageGaps(tenantId);
    console.log(`Success! Generated ${alerts.length} alerts.`);
    process.exit(0);
  } catch (err) {
    console.error("VGIE Test Failed:", err);
    process.exit(1);
  }
}
run();
