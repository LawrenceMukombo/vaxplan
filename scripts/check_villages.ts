import { db } from '../server/db.ts';
import { villages } from '../shared/schema.ts';
import { sql } from 'drizzle-orm';

async function run() {
  const res = await db.execute(sql`SELECT id, name, latitude, longitude, district_id FROM villages WHERE latitude >= -18.5 AND latitude <= -8.0 AND longitude >= 21.5 AND longitude <= 34.0`);
  console.log("Total villages in BBOX:", res.rows?.length || res.length);
  const zambiaFilter = res.filter ? res.filter((v: any) => v.district_id != null) : (res.rows || []).filter((v: any) => v.district_id != null);
  const rogueFilter = res.filter ? res.filter((v: any) => v.district_id == null) : (res.rows || []).filter((v: any) => v.district_id == null);
  
  console.log("Villages with a district:", zambiaFilter.length);
  console.log("Rogue villages (no district):", rogueFilter.length);
  if (rogueFilter.length > 0) {
     console.log("Sample rogue villages:");
     console.log(rogueFilter.slice(0, 5));
  }
  process.exit(0);
}
run();
