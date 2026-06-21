import { db, pool } from "./server/db";
import { PopulationIntelligenceService } from "./server/services/populationIntelligenceService";

async function run() {
  try {
    const res = await PopulationIntelligenceService.fetchFacilityPopulation("tenant-123", 1, 5);
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}
run();
