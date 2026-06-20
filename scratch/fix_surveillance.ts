import { db } from "../server/db";
import { surveillanceCases, clients, facilities } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

async function run() {
  console.log("Fetching all surveillance cases...");
  const cases = await db.select().from(surveillanceCases);
  
  if (cases.length === 0) {
    console.log("No cases found to update.");
    process.exit(0);
  }

  for (const c of cases) {
    // Pick a random client from the same facility
    const facilityClients = await db
      .select({
        id: clients.id,
        name: clients.name,
        gender: clients.gender,
        dateOfBirth: clients.dateOfBirth,
        villageId: clients.villageId
      })
      .from(clients)
      .where(eq(clients.facilityId, c.facilityId));

    if (facilityClients.length > 0) {
      const client = facilityClients[Math.floor(Math.random() * facilityClients.length)];
      
      const dob = new Date(client.dateOfBirth);
      const diffTime = Math.abs(Date.now() - dob.getTime());
      const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));

      await db
        .update(surveillanceCases)
        .set({
          clientId: client.id,
          patientName: client.name,
          patientGender: client.gender || "unknown",
          patientAgeMonths: diffMonths,
          villageId: client.villageId
        })
        .where(eq(surveillanceCases.id, c.id));
        
      console.log(`Updated case ${c.id} with real client: ${client.name}`);
    } else {
      console.log(`No clients found for facility ${c.facilityId}. Fallback to realistic random name...`);
      // Strip "Demo Case " if it exists
      if (c.patientName.startsWith("Demo Case ")) {
         await db.update(surveillanceCases).set({
           patientName: c.patientName.replace("Demo Case ", "")
         }).where(eq(surveillanceCases.id, c.id));
      }
    }
  }
  
  console.log("Done updating surveillance cases!");
  process.exit(0);
}

run().catch(console.error);
