import { db } from "../server/db";
import { surveillanceCases, tenants } from "../server/schema";

async function queryCases() {
  const cases = await db.select().from(surveillanceCases);
  console.log(`Found ${cases.length} cases.`);
  if (cases.length > 0) {
    console.log(cases[0]);
  }
  
  const allTenants = await db.select().from(tenants);
  console.log(`Tenants:`, allTenants.map(t => ({ id: t.id, code: t.code, name: t.name })));
  
  process.exit(0);
}

queryCases();
