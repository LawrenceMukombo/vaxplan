import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  const res = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'cold_chain_equipment'
  `);
  console.log("=== DB Columns After Migration ===");
  console.log(res.rows);
  process.exit(0);
}

main().catch(console.error);
