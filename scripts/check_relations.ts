import { db } from '../server/db.ts';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import * as turf from '@turf/turf';

async function run() {
  const zmbRaw = fs.readFileSync('data/zambia/zmb_constituencies.geojson', 'utf-8');
  const zmbFC = JSON.parse(zmbRaw);
  
  const res = await db.execute(sql`SELECT id, name, latitude, longitude FROM villages WHERE latitude IS NOT NULL AND longitude IS NOT NULL`);
  const allVillages = res.rows || res;
  
  console.log(`Checking ${allVillages.length} villages...`);
  
  const outsideIds: number[] = [];
  for (const v of allVillages) {
    const lat = Number(v.latitude);
    const lng = Number(v.longitude);
    if (isNaN(lat) || isNaN(lng)) continue;
    
    const pt = turf.point([lng, lat]);
    let isInside = false;
    for (const feature of zmbFC.features) {
      if (turf.booleanPointInPolygon(pt, feature)) {
        isInside = true;
        break;
      }
    }
    if (!isInside) {
      outsideIds.push(Number(v.id));
    }
  }
  
  console.log(`Found ${outsideIds.length} villages outside Zambia polygons.`);
  if (outsideIds.length === 0) {
    process.exit(0);
  }
  
  // Chunk outsideIds to avoid parameter limits or long query strings if needed, but 1855 is fine for simple IN query.
  const idList = outsideIds.join(',');

  // Check session_villages
  const svRes = await db.execute(sql.raw(`SELECT COUNT(*)::int as count FROM session_villages WHERE village_id IN (${idList})`));
  console.log(`session_villages references:`, (svRes.rows || svRes)[0]);
  
  // Check clients
  const clientRes = await db.execute(sql.raw(`SELECT COUNT(*)::int as count FROM clients WHERE village_id IN (${idList})`));
  console.log(`clients references:`, (clientRes.rows || clientRes)[0]);

  // Check facility_excluded_villages
  const feRes = await db.execute(sql.raw(`SELECT COUNT(*)::int as count FROM facility_excluded_villages WHERE village_id IN (${idList})`));
  console.log(`facility_excluded_villages references:`, (feRes.rows || feRes)[0]);
  
  process.exit(0);
}
run().catch(console.error);
