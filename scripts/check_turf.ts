import { db } from '../server/db.ts';
import { villages } from '../shared/schema.ts';
import fs from 'fs';
import * as turf from '@turf/turf';

async function run() {
  const zmbRaw = fs.readFileSync('../data/zambia/zmb_constituencies.geojson', 'utf-8');
  const zmbFC = JSON.parse(zmbRaw);
  
  const res = await db.execute(`SELECT id, name, latitude, longitude, district_id FROM villages WHERE latitude IS NOT NULL AND longitude IS NOT NULL`);
  const allVillages = res.rows || res;
  
  console.log(`Checking ${allVillages.length} villages against Zambia constituencies...`);
  
  const outsideVillages = [];
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
      outsideVillages.push(v);
    }
  }
  
  console.log(`Found ${outsideVillages.length} villages outside Zambia polygons.`);
  console.log(outsideVillages.slice(0, 10));
  
  process.exit(0);
}
run();
