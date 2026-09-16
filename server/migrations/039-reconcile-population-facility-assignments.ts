import { db as defaultDb } from "../db";
import { sql } from "drizzle-orm";

/**
 * Reconcile denormalised population_data.facility_id with the live community
 * registry. A community can move between facility catchments; population rows
 * must follow that assignment or facility totals and community lists diverge.
 */
export async function applyPopulationFacilityAssignmentReconciliation(dbInstance?: any) {
  const db = dbInstance || defaultDb;
  const result = await db.execute(sql`
    UPDATE population_data AS population
       SET facility_id = community.assigned_facility_id,
           updated_at = NOW()
      FROM villages AS community
     WHERE population.tenant_id = community.tenant_id
       AND population.village_id = community.id
       AND population.facility_id IS DISTINCT FROM community.assigned_facility_id
  `);

  return { reconciled: Number(result.rowCount ?? 0) };
}
