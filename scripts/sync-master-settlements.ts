import { db, pool } from '../server/db';
import { villages, settlementsMaster, facilities, tenants } from '../shared/schema';
import { eq, and, like } from 'drizzle-orm';

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function sync() {
  const args = process.argv.slice(2);
  const tenantArg = args.find(a => a.startsWith('--tenant='));
  const targetCode = tenantArg ? tenantArg.split('=')[1] : null;

  console.log('Starting Settlement Synchronization...');
  const client = await pool.connect();

  try {
    // 1. Fetch tenants to sync
    let query = db.select().from(tenants);
    const allTenants = await (targetCode ? query.where(eq(tenants.code, targetCode)) : query);

    for (const tenant of allTenants) {
      console.log(`\nProcessing Tenant: ${tenant.name} (${tenant.code} - ${tenant.id})`);

      // 2. Fetch master settlements for this tenant
      const masterRows = await db
        .select()
        .from(settlementsMaster)
        .where(eq(settlementsMaster.tenantId, tenant.id));
      console.log(`Found ${masterRows.length} master settlements in settlements_master.`);
      if (masterRows.length === 0) {
        console.log('Skipping tenant (no master settlements).');
        continue;
      }

      // 3. Fetch facilities for this tenant
      const tenantFacilities = await db
        .select()
        .from(facilities)
        .where(eq(facilities.tenantId, tenant.id));
      
      const validFacilities = tenantFacilities.filter(f => {
        const lat = parseFloat(f.latitude as any);
        const lng = parseFloat(f.longitude as any);
        return !isNaN(lat) && !isNaN(lng);
      });
      console.log(`Found ${tenantFacilities.length} facilities, ${validFacilities.length} with valid coordinates.`);

      if (validFacilities.length === 0) {
        console.log('Skipping tenant (no geocoded facilities to associate settlements with).');
        continue;
      }

      // 4. Clear previously synced national seeded villages to prevent duplicates
      console.log('Clearing old synced national seeded villages...');
      let proceedWithInsert = true;
      try {
        await db
          .delete(villages)
          .where(and(eq(villages.tenantId, tenant.id), like(villages.code, 'NAT-SEED-%')));
        console.log('Cleared.');
      } catch (err: any) {
        console.warn(`Warning: Could not clear old synced villages due to foreign key constraints: ${err.message}`);
        // Check if there are already seeded villages
        const existing = await db
          .select({ id: villages.id })
          .from(villages)
          .where(and(eq(villages.tenantId, tenant.id), like(villages.code, 'NAT-SEED-%')))
          .limit(1);
        if (existing.length > 0) {
          console.log('Tenant already has seeded villages. Skipping insertion to prevent duplication.');
          proceedWithInsert = false;
        } else {
          console.log('No seeded villages found despite clear failure. Proceeding with insertion.');
        }
      }

      if (!proceedWithInsert) {
        continue;
      }

      // 5. Associate each master settlement with its closest health facility
      console.log('Mapping master settlements to closest facilities...');
      const villagesToInsert = [];
      let seedIdx = 1;

      for (const sm of masterRows) {
        const lat = parseFloat(sm.latitude as any);
        const lng = parseFloat(sm.longitude as any);
        if (isNaN(lat) || isNaN(lng)) continue;

        let closestFac = validFacilities[0];
        let minDistance = Infinity;

        for (const f of validFacilities) {
          const facLat = parseFloat(f.latitude as any);
          const facLng = parseFloat(f.longitude as any);
          const dist = calculateHaversineDistance(lat, lng, facLat, facLng);
          if (dist < minDistance) {
            minDistance = dist;
            closestFac = f;
          }
        }

        // Ignore communities that are extremely isolated (e.g., > 150km from any facility)
        if (minDistance > 150.0) continue;

        const isHtr = minDistance > 5.0 || sm.hardToReach;
        const minutesPerKm = isHtr ? 15 : 2;
        const travelTime = Math.max(5, Math.round(minDistance * minutesPerKm));

        villagesToInsert.push({
          tenantId: tenant.id,
          name: sm.name,
          code: `NAT-SEED-${seedIdx++}`,
          districtId: closestFac.districtId,
          assignedFacilityId: closestFac.id,
          latitude: lat.toString(),
          longitude: lng.toString(),
          distanceToFacility: minDistance.toFixed(2),
          travelTimeMinutes: travelTime,
          isHardToReach: isHtr,
          settlementType: sm.placeType || 'village',
          totalCatchmentPopulation: sm.populationEstimate || 120,
          under5Population: sm.under5Population || Math.round((sm.populationEstimate || 120) * 0.18),
          comments: `Synchronized from Master Settlement Registry (source: ${sm.source})`,
        });
      }

      console.log(`Mapping complete. Inserting ${villagesToInsert.length} villages in batches of 500...`);
      const batchSize = 500;
      for (let i = 0; i < villagesToInsert.length; i += batchSize) {
        const batch = villagesToInsert.slice(i, i + batchSize);
        await db.insert(villages).values(batch as any);
        if (i > 0 && i % 2000 === 0) {
          console.log(`  Inserted ${i} villages...`);
        }
      }
      console.log(`Successfully synced ${villagesToInsert.length} settlements to villages for tenant ${tenant.code}!`);
    }

    console.log('\nSettlement Synchronization completed successfully!');
  } catch (err: any) {
    console.error('Synchronization failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

sync();
