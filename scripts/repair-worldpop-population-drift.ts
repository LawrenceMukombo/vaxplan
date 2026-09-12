import pg from "pg";
import { disaggregatePopulation, populationRatios } from "../shared/populationDisaggregation";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const result = await connection.query(`
      SELECT p.*, t.settings
      FROM population_data p
      JOIN tenants t ON t.id=p.tenant_id
      WHERE p.source='worldpop'
        AND COALESCE(p.male_population,0)+COALESCE(p.female_population,0)>p.total_population
        AND (COALESCE(p.under_1_population,0)>p.total_population OR COALESCE(p.under_5_population,0)>p.total_population)
      FOR UPDATE OF p
    `);
    const facilityScopes = new Set<string>();
    for (const row of result.rows) {
      const recoveredTotal = Number(row.male_population || 0) + Number(row.female_population || 0);
      const cohorts = disaggregatePopulation(recoveredTotal, populationRatios(row.settings));
      await connection.query(`UPDATE population_data SET
        total_population=$1,under_1_population=$2,under_5_population=$3,pregnant_women=$4,
        male_population=$5,female_population=$6,
        metadata=COALESCE(metadata,'{}'::jsonb)||$7::jsonb,updated_at=now()
        WHERE id=$8`, [cohorts.totalPopulation, cohorts.under1Population, cohorts.under5Population,
        cohorts.pregnantWomen, cohorts.malePopulation, cohorts.femalePopulation,
        JSON.stringify({ repairedPopulationDrift: true, cohortRatios: populationRatios(row.settings) }), row.id]);
      if (row.village_id) {
        const village = await connection.query(`UPDATE villages SET total_catchment_population=$1,
          gridded_population=$1,under5_population=$2,population_source_label='WorldPop',updated_at=now()
          WHERE tenant_id=$3 AND id=$4 RETURNING assigned_facility_id`,
          [cohorts.totalPopulation, cohorts.under5Population, row.tenant_id, row.village_id]);
        const facilityId = row.facility_id || village.rows[0]?.assigned_facility_id;
        if (facilityId) facilityScopes.add(`${row.tenant_id}:${facilityId}`);
      } else if (row.facility_id) facilityScopes.add(`${row.tenant_id}:${row.facility_id}`);
    }
    for (const scope of facilityScopes) {
      const [tenantId, facilityId] = scope.split(":");
      await connection.query(`UPDATE facilities f SET catchment_grid_population=(SELECT COALESCE(SUM(
        COALESCE(v.gridded_population,v.total_catchment_population,0)),0) FROM villages v
        WHERE v.tenant_id=$1 AND v.assigned_facility_id=$2),updated_at=now()
        WHERE f.tenant_id=$1 AND f.id=$2`, [tenantId, Number(facilityId)]);
    }
    const apply = process.argv.includes("--apply");
    await connection.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(`${apply ? "Repaired" : "Would repair"} ${result.rowCount} corrupted WorldPop rows; ${facilityScopes.size} facility aggregates ${apply ? "updated" : "unchanged"}.`);
  } catch (error) { await connection.query("ROLLBACK"); throw error; }
  finally { connection.release(); await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
