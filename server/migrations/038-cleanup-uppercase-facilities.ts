import { db as defaultDb } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration 038: Cleanup Uppercase Duplicate Facilities
 *
 * In some tenants (e.g. South Sudan), duplicate health facilities were created
 * where one has uppercase type suffixes ("Ateda PHCU", "Biira PHCC") and the other
 * has titlecase type suffixes ("Ateda Phcu", "Biira Phcc").
 *
 * This migration:
 * 1. Identifies facilities whose names contain uppercase "PHCU", "PHCC", or "HOSPITAL".
 * 2. If a canonical titlecase sibling exists in the same tenant and district:
 *    - Re-links all child records across all dependent tables to the canonical facility ID.
 *    - Deletes the uppercase duplicate facility.
 * 3. If no canonical sibling exists:
 *    - Renames the facility to clean titlecase ("Ateda Phcu") so no uppercase abbreviations remain.
 */
export async function applyCleanupUppercaseFacilities(dbInstance?: any) {
  const db = dbInstance || defaultDb;

  try {
    const uppercaseFacs = (await db.execute(sql`
      SELECT id, tenant_id, district_id, name, hmis_code
      FROM facilities
      WHERE name LIKE '%PHCU%' OR name LIKE '%PHCC%' OR name LIKE '%HOSPITAL%'
      ORDER BY id ASC;
    `)).rows as any[];

    if (!uppercaseFacs || uppercaseFacs.length === 0) {
      return { cleaned: 0, renamed: 0 };
    }

    console.log(`[Migration 038] Found ${uppercaseFacs.length} facilities with uppercase suffixes. Processing deduplication...`);

    let cleanedCount = 0;
    let renamedCount = 0;

    for (const u of uppercaseFacs) {
      const normalizedName = u.name
        .replace(/\bPHCU\b/g, "Phcu")
        .replace(/\bPHCC\b/g, "Phcc")
        .replace(/\bHOSPITAL\b/g, "Hospital")
        .replace(/\s+/g, " ")
        .trim();

      // Look for canonical facility in the same tenant and district
      const canonRows = (await db.execute(sql`
        SELECT id, name
        FROM facilities
        WHERE tenant_id = ${u.tenant_id}
          AND district_id IS NOT DISTINCT FROM ${u.district_id}
          AND id != ${u.id}
          AND LOWER(TRIM(name)) = LOWER(TRIM(${normalizedName}))
        ORDER BY id ASC
        LIMIT 1;
      `)).rows as any[];

      if (canonRows.length > 0) {
        const canonicalId = canonRows[0].id;
        console.log(`[Migration 038] Merging duplicate '${u.name}' (id: ${u.id}) -> '${canonRows[0].name}' (id: ${canonicalId})`);

        // Handle unique constraint collisions first
        try {
          await db.execute(sql`
            DELETE FROM facility_catchments
            WHERE facility_id = ${u.id}
              AND EXISTS (SELECT 1 FROM facility_catchments WHERE facility_id = ${canonicalId});
          `);
        } catch (_) {}

        try {
          await db.execute(sql`
            DELETE FROM facility_excluded_villages
            WHERE facility_id = ${u.id}
              AND village_id IN (SELECT village_id FROM facility_excluded_villages WHERE facility_id = ${canonicalId});
          `);
        } catch (_) {}

        // List of all tables and columns that reference facilities.id
        const foreignReferences = [
          { table: "clients", col: "facility_id" },
          { table: "surveillance_cases", col: "facility_id" },
          { table: "mobilization_activities", col: "facility_id" },
          { table: "session_plans", col: "facility_id" },
          { table: "microplans", col: "facility_id" },
          { table: "supervision_visits", col: "facility_id" },
          { table: "stock_transactions", col: "facility_id" },
          { table: "cold_chain_equipment", col: "facility_id" },
          { table: "facility_staff", col: "facility_id" },
          { table: "budget_items", col: "facility_id" },
          { table: "pilot_activities", col: "facility_id" },
          { table: "users", col: "facility_id" },
          { table: "chv_profiles", col: "facility_id" },
          { table: "community_health_volunteers", col: "facility_id" },
          { table: "hfc_committee", col: "facility_id" },
          { table: "hfc_committee_members", col: "facility_id" },
          { table: "uncovered_communities", col: "facility_id" },
          { table: "vgie_settlement_facility_links", col: "facility_id" },
          { table: "vgie_alerts", col: "facility_id" },
          { table: "microplan_denominator_scenarios", col: "facility_id" },
          { table: "microplan_community_denominator_allocations", col: "facility_id" },
          { table: "temporal_employment_assignments", col: "facility_id" },
          { table: "planning_actions", col: "facility_id" },
          { table: "planning_evidence", col: "facility_id" },
          { table: "villages", col: "assigned_facility_id" },
          { table: "imported_coverage", col: "facility_id" },
          { table: "monthly_reports", col: "facility_id" },
          { table: "quarterly_reviews", col: "facility_id" },
          { table: "population_data", col: "facility_id" },
          { table: "facility_catchments", col: "facility_id" },
          { table: "facility_excluded_villages", col: "facility_id" },
          { table: "settlements_master", col: "linked_facility_id" },
          { table: "settlements_master", col: "nearest_facility_id" },
        ];

        for (const ref of foreignReferences) {
          try {
            await db.execute(sql.raw(`
              UPDATE "${ref.table}"
              SET "${ref.col}" = ${canonicalId}
              WHERE "${ref.col}" = ${u.id};
            `));
          } catch (err: any) {
            // Table or column might not exist in all environments or schemas; skip silently
          }
        }

        // Delete the duplicate uppercase facility safely; if foreign keys still block deletion, mark operational_status = 'duplicate_merged'
        try {
          await db.execute(sql`DELETE FROM facilities WHERE id = ${u.id}`);
          cleanedCount++;
        } catch (delErr: any) {
          try {
            await db.execute(sql`
              UPDATE facilities
              SET operational_status = 'duplicate_merged',
                  name = ${normalizedName + ' (Merged ' + canonicalId + ')'},
                  updated_at = NOW()
              WHERE id = ${u.id};
            `);
            cleanedCount++;
          } catch (_) {}
        }
      } else {
        // No canonical sibling exists; rename to titlecase to remove capital letters
        await db.execute(sql`
          UPDATE facilities
          SET name = ${normalizedName}, updated_at = NOW()
          WHERE id = ${u.id};
        `);
        renamedCount++;
      }
    }

    console.log(`[Migration 038] Complete. Deleted ${cleanedCount} duplicate uppercase facilities, renamed ${renamedCount} standalone uppercase facilities.`);
    return { cleaned: cleanedCount, renamed: renamedCount };
  } catch (err: any) {
    console.error(`[Migration 038] Error during facility cleanup: ${err?.message ?? err}`);
    return { error: err?.message ?? String(err) };
  }
}
