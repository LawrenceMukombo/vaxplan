import { db } from "../server/db";
import { villages, facilities } from "../shared/schema";
import { sql } from "drizzle-orm";

async function run() {
  const villageCount = await db.select({ count: sql<number>`count(*)` }).from(villages);
  const facilityCount = await db.select({ count: sql<number>`count(*)` }).from(facilities);
  console.log("Villages:", villageCount[0].count);
  console.log("Facilities:", facilityCount[0].count);
  process.exit(0);
}
run();
