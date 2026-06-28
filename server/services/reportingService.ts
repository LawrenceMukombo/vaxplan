/**
 * reportingService.ts
 *
 * Centralised query layer for the VaxPlan Reporting Engine.
 * Each exported function returns a flat array of HierarchyRow objects that the
 * client can render as a collapsible drilldown table.
 *
 * Aggregation chain:  facility  →  district  →  province  →  national
 *
 * RBAC scoping (provinceId / districtId / facilityId filters) is applied by
 * the route layer (server/routes/reports.ts) BEFORE calling these functions.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Shared filter params type
// ---------------------------------------------------------------------------
export interface ReportFilters {
  tenantId: string;
  provinceId?: number;
  districtId?: number;
  facilityId?: number;
  provinceIds?: number[];
  districtIds?: number[];
  facilityIds?: number[];
  year?: number;
  quarter?: number;
}

function intList(values?: number[]): number[] {
  return Array.from(new Set((values || []).map(Number).filter((v) => Number.isInteger(v) && v > 0)));
}

function idInClause(column: string, values?: number[]) {
  const ids = intList(values);
  if (ids.length === 0) return sql``;
  return sql.raw(` AND ${column} IN (${ids.join(",")})`);
}

function facilityScopeClause(filters: ReportFilters) {
  return filters.facilityIds?.length
    ? idInClause("f.id", filters.facilityIds)
    : filters.facilityId
      ? sql` AND f.id = ${filters.facilityId}`
      : sql``;
}

function districtScopeClause(filters: ReportFilters) {
  return filters.districtIds?.length
    ? idInClause("d.id", filters.districtIds)
    : filters.districtId
      ? sql` AND d.id = ${filters.districtId}`
      : sql``;
}

function provinceScopeClause(filters: ReportFilters) {
  return filters.provinceIds?.length
    ? idInClause("p.id", filters.provinceIds)
    : filters.provinceId
      ? sql` AND p.id = ${filters.provinceId}`
      : sql``;
}

// ---------------------------------------------------------------------------
// Common hierarchy row shape returned by every report
// ---------------------------------------------------------------------------
export interface HierarchyRow {
  level: "national" | "province" | "district" | "facility";
  id: number | string;
  name: string;
  parentId?: number | string;
  parent_id?: number | string | null;
  [key: string]: unknown; // report-specific metric columns
}

// ---------------------------------------------------------------------------
// Geographic metadata helper lookups
// ---------------------------------------------------------------------------
async function getProvincesMap(tenantId: string): Promise<Map<number, string>> {
  const provincesList = await db.execute(sql`
    SELECT id, name FROM provinces WHERE tenant_id = ${tenantId}
  `);
  const provincesMap = new Map<number, string>();
  for (const p of provincesList.rows as any) {
    provincesMap.set(Number(p.id), String(p.name));
  }
  return provincesMap;
}

async function getDistrictsMap(tenantId: string): Promise<Map<number, { name: string; provinceId: number }>> {
  const districtsList = await db.execute(sql`
    SELECT id, name, province_id FROM districts WHERE tenant_id = ${tenantId}
  `);
  const districtsMap = new Map<number, { name: string; provinceId: number }>();
  for (const d of districtsList.rows as any) {
    districtsMap.set(Number(d.id), { name: String(d.name), provinceId: Number(d.province_id) });
  }
  return districtsMap;
}

// ---------------------------------------------------------------------------
// Reusable Hierarchical Rollup Engine (TypeScript)
// ---------------------------------------------------------------------------
function rollupHierarchy(
  facilities: any[],
  provincesMap: Map<number, string>,
  districtsMap: Map<number, { name: string; provinceId: number }>,
  sumKeys: string[],
  avgKeys: { key: string; weightKey?: string }[] = [],
  customFinalizer?: (row: any) => void
): HierarchyRow[] {
  const districtMap = new Map<number, any>();
  const provinceMap = new Map<number, any>();

  // Process facilities and roll up to districts and provinces
  for (const f of facilities) {
    const dId = f.parent_id;
    if (dId == null || !districtsMap.has(dId)) continue;
    const distInfo = districtsMap.get(dId)!;
    const pId = distInfo.provinceId;

    // 1. Rollup to District
    if (!districtMap.has(dId)) {
      const dRow: any = {
        level: "district",
        id: dId,
        name: distInfo.name,
        parent_id: pId,
      };
      for (const k of sumKeys) dRow[k] = 0;
      for (const a of avgKeys) {
        dRow[a.key] = 0;
        if (a.weightKey) dRow[`_sum_${a.key}`] = 0;
      }
      dRow._count = 0;
      districtMap.set(dId, dRow);
    }
    const dRow = districtMap.get(dId)!;
    dRow._count++;

    // Sum keys
    for (const k of sumKeys) {
      dRow[k] += Number(f[k] ?? 0);
    }
    // Avg keys
    for (const a of avgKeys) {
      if (a.weightKey) {
        const weight = Number(f[a.weightKey] ?? 0);
        dRow[`_sum_${a.key}`] += Number(f[a.key] ?? 0) * weight;
      } else {
        dRow[a.key] += Number(f[a.key] ?? 0);
      }
    }

    // 2. Rollup to Province
    if (!provinceMap.has(pId)) {
      const pName = provincesMap.get(pId) || `Province ${pId}`;
      const pRow: any = {
        level: "province",
        id: pId,
        name: pName,
        parent_id: null,
      };
      for (const k of sumKeys) pRow[k] = 0;
      for (const a of avgKeys) {
        pRow[a.key] = 0;
        if (a.weightKey) pRow[`_sum_${a.key}`] = 0;
      }
      pRow._count = 0;
      provinceMap.set(pId, pRow);
    }
    const pRow = provinceMap.get(pId)!;
    pRow._count++;

    // Sum keys
    for (const k of sumKeys) {
      pRow[k] += Number(f[k] ?? 0);
    }
    // Avg keys
    for (const a of avgKeys) {
      if (a.weightKey) {
        const weight = Number(f[a.weightKey] ?? 0);
        pRow[`_sum_${a.key}`] += Number(f[a.key] ?? 0) * weight;
      } else {
        pRow[a.key] += Number(f[a.key] ?? 0);
      }
    }
  }

  // Finalize averages and custom finalizers for districts
  const districtRows = Array.from(districtMap.values()).map(dRow => {
    for (const a of avgKeys) {
      if (a.weightKey) {
        const totalWeight = Number(dRow[a.weightKey] ?? 0);
        dRow[a.key] = totalWeight > 0 ? Number((dRow[`_sum_${a.key}`] / totalWeight).toFixed(1)) : 0;
        delete dRow[`_sum_${a.key}`];
      } else {
        dRow[a.key] = dRow._count > 0 ? Number((dRow[a.key] / dRow._count).toFixed(1)) : 0;
      }
    }
    delete dRow._count;
    if (customFinalizer) customFinalizer(dRow);
    return dRow as HierarchyRow;
  });

  // Finalize averages and custom finalizers for provinces
  const provinceRows = Array.from(provinceMap.values()).map(pRow => {
    for (const a of avgKeys) {
      if (a.weightKey) {
        const totalWeight = Number(pRow[a.weightKey] ?? 0);
        pRow[a.key] = totalWeight > 0 ? Number((pRow[`_sum_${a.key}`] / totalWeight).toFixed(1)) : 0;
        delete pRow[`_sum_${a.key}`];
      } else {
        pRow[a.key] = pRow._count > 0 ? Number((pRow[a.key] / pRow._count).toFixed(1)) : 0;
      }
    }
    delete pRow._count;
    if (customFinalizer) customFinalizer(pRow);
    return pRow as HierarchyRow;
  });

  return [
    ...provinceRows,
    ...districtRows,
    ...facilities.map(f => {
      const copy = { ...f };
      for (const a of avgKeys) {
        if (a.weightKey) delete copy[`_sum_${a.key}`];
      }
      delete copy._count;
      return copy as HierarchyRow;
    }),
  ];
}

// ---------------------------------------------------------------------------
// R1 — Session Summary
// ---------------------------------------------------------------------------
export async function getSessionReport(filters: ReportFilters): Promise<HierarchyRow[]> {
  const yearClause    = filters.year    ? sql` AND sp.year = ${filters.year}`    : sql``;
  const quarterClause = filters.quarter ? sql` AND sp.quarter = ${filters.quarter}` : sql``;
  const facilityFilter = facilityScopeClause(filters);
  const districtFilter = districtScopeClause(filters);
  const provinceFilter = provinceScopeClause(filters);


  // Query all facilities in scope, left joined with session plans
  const dbRows = await db.execute(sql`
    SELECT
      f.id                                     AS id,
      f.name                                   AS name,
      f.district_id                            AS parent_id,
      COUNT(sp.id)::int                        AS db_total_sessions,
      SUM(CASE WHEN sp.session_type = 'static'   THEN 1 ELSE 0 END)::int AS static_sessions,
      SUM(CASE WHEN sp.session_type = 'mobile'   THEN 1 ELSE 0 END)::int AS mobile_sessions,
      SUM(CASE WHEN sp.session_type = 'outreach' THEN 1 ELSE 0 END)::int AS outreach_sessions,
      SUM(CASE WHEN sp.status = 'planned'        THEN 1 ELSE 0 END)::int AS planned,
      SUM(CASE WHEN sp.status = 'completed'      THEN 1 ELSE 0 END)::int AS completed,
      SUM(CASE WHEN sp.is_achieved = true        THEN 1 ELSE 0 END)::int AS achieved,
      SUM(CASE WHEN sp.approval_status = 'approved' THEN 1 ELSE 0 END)::int AS approved,
      SUM(COALESCE(sp.target_population, 0))::int                     AS target_population,
      SUM(COALESCE((sp.vaccinated_counts->>'totals')::int, 0))::int   AS vaccinated_totals
    FROM facilities f
    JOIN districts d ON d.id = f.district_id
    JOIN provinces p ON p.id = d.province_id
    LEFT JOIN session_plans sp ON sp.facility_id = f.id${yearClause}${quarterClause}
    WHERE f.tenant_id = ${filters.tenantId}
      ${facilityFilter}
      ${districtFilter}
      ${provinceFilter}
    GROUP BY f.id, f.name, f.district_id
    ORDER BY f.name
  `);

  // Map database rows without synthetic fallback metrics.
  const facilities = (dbRows.rows as any[]).map((row) => {
    const fId = Number(row.id);
    const total_sessions = Number(row.db_total_sessions ?? 0);
    const static_sessions = Number(row.static_sessions ?? 0);
    const mobile_sessions = Number(row.mobile_sessions ?? 0);
    const outreach_sessions = Number(row.outreach_sessions ?? 0);
    const planned = Number(row.planned ?? 0);
    const completed = Number(row.completed ?? 0);
    const achieved = Number(row.achieved ?? 0);
    const approved = Number(row.approved ?? 0);
    const target_population = Number(row.target_population ?? 0);
    const vaccinated_totals = Number(row.vaccinated_totals ?? 0);

    return {
      level: "facility",
      id: fId,
      name: String(row.name),
      parent_id: Number(row.parent_id),
      total_sessions,
      static_sessions,
      mobile_sessions,
      outreach_sessions,
      planned,
      completed,
      achieved,
      approved,
      target_population,
      vaccinated_totals,
    };
  });

  const provincesMap = await getProvincesMap(filters.tenantId);
  const districtsMap = await getDistrictsMap(filters.tenantId);

  return rollupHierarchy(
    facilities,
    provincesMap,
    districtsMap,
    [
      "total_sessions",
      "static_sessions",
      "mobile_sessions",
      "outreach_sessions",
      "planned",
      "completed",
      "achieved",
      "approved",
      "target_population",
      "vaccinated_totals"
    ]
  );
}

// ---------------------------------------------------------------------------
// R2 — Microplan Status
// ---------------------------------------------------------------------------
export async function getMicroplanReport(filters: ReportFilters): Promise<HierarchyRow[]> {
  const yearClause    = filters.year    ? sql` AND m.year = ${filters.year}`    : sql``;
  const quarterClause = filters.quarter ? sql` AND m.quarter = ${filters.quarter}` : sql``;
  const facilityFilter = facilityScopeClause(filters);
  const districtFilter = districtScopeClause(filters);
  const provinceFilter = provinceScopeClause(filters);

  const dbRows = await db.execute(sql`
    SELECT
      f.id                                                                AS id,
      f.name                                                              AS name,
      f.district_id                                                       AS parent_id,
      COUNT(m.id)::int                                                    AS db_total_microplans,
      SUM(CASE WHEN m.plan_type = 'facility_routine' THEN 1 ELSE 0 END)::int AS routine,
      SUM(CASE WHEN m.plan_type = 'sia_campaign'     THEN 1 ELSE 0 END)::int AS campaigns,
      SUM(CASE WHEN m.status = 'draft'    THEN 1 ELSE 0 END)::int        AS draft,
      SUM(CASE WHEN m.status = 'pending'  THEN 1 ELSE 0 END)::int        AS pending,
      SUM(CASE WHEN m.status = 'approved' THEN 1 ELSE 0 END)::int        AS approved,
      SUM(CASE WHEN m.status = 'locked'   THEN 1 ELSE 0 END)::int        AS locked
    FROM facilities f
    JOIN districts d ON d.id = f.district_id
    JOIN provinces p ON p.id = d.province_id
    LEFT JOIN microplans m ON m.facility_id = f.id${yearClause}${quarterClause}
    WHERE f.tenant_id = ${filters.tenantId}
      ${facilityFilter}
      ${districtFilter}
      ${provinceFilter}
    GROUP BY f.id, f.name, f.district_id
    ORDER BY f.name
  `);

  const facilities = (dbRows.rows as any[]).map((row) => {
    const fId = Number(row.id);
    const total_microplans = Number(row.db_total_microplans ?? 0);
    const routine = Number(row.routine ?? 0);
    const campaigns = Number(row.campaigns ?? 0);
    const draft = Number(row.draft ?? 0);
    const pending = Number(row.pending ?? 0);
    const approved = Number(row.approved ?? 0);
    const locked = Number(row.locked ?? 0);

    return {
      level: "facility",
      id: fId,
      name: String(row.name),
      parent_id: Number(row.parent_id),
      total_microplans,
      routine,
      campaigns,
      draft,
      pending,
      approved,
      locked,
    };
  });

  const provincesMap = await getProvincesMap(filters.tenantId);
  const districtsMap = await getDistrictsMap(filters.tenantId);

  return rollupHierarchy(
    facilities,
    provincesMap,
    districtsMap,
    ["total_microplans", "routine", "campaigns", "draft", "pending", "approved", "locked"]
  );
}

// ---------------------------------------------------------------------------
// R3 — Zero-Dose Communities
// ---------------------------------------------------------------------------
export async function getZeroDoseReport(filters: ReportFilters): Promise<HierarchyRow[]> {
  const facilityFilter = facilityScopeClause(filters);
  const districtFilter = districtScopeClause(filters);
  const provinceFilter = provinceScopeClause(filters);

  const dbRows = await db.execute(sql`
    SELECT
      f.id                              AS id,
      f.name                            AS name,
      f.district_id                     AS parent_id,
      COUNT(v.id)::int                  AS db_total_villages,
      SUM(CASE WHEN sv.session_id IS NULL THEN 1 ELSE 0 END)::int        AS db_zero_dose_villages,
      SUM(CASE WHEN v.is_hard_to_reach = true AND sv.session_id IS NULL THEN 1 ELSE 0 END)::int AS db_zero_dose_htr,
      SUM(COALESCE(pd.under_1_population, 0))::int                       AS under1_at_risk,
      SUM(COALESCE(pd.under_5_population, 0))::int                       AS under5_at_risk
    FROM facilities f
    JOIN districts d ON d.id = f.district_id
    JOIN provinces p ON p.id = d.province_id
    LEFT JOIN villages v ON v.assigned_facility_id = f.id
    LEFT JOIN LATERAL (
      SELECT sv2.session_id FROM session_villages sv2
      JOIN session_plans sp2 ON sp2.id = sv2.session_id
      WHERE sv2.village_id = v.id AND sp2.is_achieved = true
      LIMIT 1
    ) sv ON true
    LEFT JOIN (
      SELECT village_id, MAX(under_1_population) AS under_1_population, MAX(under_5_population) AS under_5_population
      FROM population_data WHERE tenant_id = ${filters.tenantId}
      GROUP BY village_id
    ) pd ON pd.village_id = v.id
    WHERE f.tenant_id = ${filters.tenantId}
      ${facilityFilter}
      ${districtFilter}
      ${provinceFilter}
    GROUP BY f.id, f.name, f.district_id
    ORDER BY f.name
  `);

  const facilities = (dbRows.rows as any[]).map((row) => {
    const fId = Number(row.id);
    const dbTotalVillages = Number(row.db_total_villages ?? 0);
    const total_villages = dbTotalVillages;
    const zero_dose_villages = Number(row.db_zero_dose_villages ?? 0);
    const zero_dose_htr = Number(row.db_zero_dose_htr ?? 0);
    const under1_at_risk = Number(row.under1_at_risk ?? 0);
    const under5_at_risk = Number(row.under5_at_risk ?? 0);

    return {
      level: "facility",
      id: fId,
      name: String(row.name),
      parent_id: Number(row.parent_id),
      total_villages,
      zero_dose_villages,
      zero_dose_htr,
      under1_at_risk,
      under5_at_risk,
    };
  });

  const provincesMap = await getProvincesMap(filters.tenantId);
  const districtsMap = await getDistrictsMap(filters.tenantId);

  return rollupHierarchy(
    facilities,
    provincesMap,
    districtsMap,
    ["total_villages", "zero_dose_villages", "zero_dose_htr", "under1_at_risk", "under5_at_risk"]
  );
}

// ---------------------------------------------------------------------------
// R4 — Missed Communities
// ---------------------------------------------------------------------------
export async function getMissedCommunitiesReport(filters: ReportFilters): Promise<HierarchyRow[]> {
  const yearClause    = filters.year    ? sql` AND sp.year = ${filters.year}`    : sql``;
  const quarterClause = filters.quarter ? sql` AND sp.quarter = ${filters.quarter}` : sql``;
  const facilityFilter = facilityScopeClause(filters);
  const districtFilter = districtScopeClause(filters);
  const provinceFilter = provinceScopeClause(filters);


  const dbRows = await db.execute(sql`
    SELECT
      f.id                               AS id,
      f.name                             AS name,
      f.district_id                      AS parent_id,
      COUNT(DISTINCT sv.village_id)::int AS db_villages_planned,
      SUM(CASE WHEN sp.is_achieved = false THEN 1 ELSE 0 END)::int AS db_sessions_not_achieved,
      COUNT(DISTINCT CASE WHEN sp.is_achieved = false THEN sv.village_id END)::int AS db_missed_villages,
      COUNT(DISTINCT CASE WHEN sp.is_achieved = true  THEN sv.village_id END)::int AS db_reached_villages
    FROM facilities f
    JOIN districts d ON d.id = f.district_id
    JOIN provinces p ON p.id = d.province_id
    LEFT JOIN session_plans sp ON sp.facility_id = f.id${yearClause}${quarterClause}
    LEFT JOIN session_villages sv ON sv.session_id = sp.id
    WHERE f.tenant_id = ${filters.tenantId}
      ${facilityFilter}
      ${districtFilter}
      ${provinceFilter}
    GROUP BY f.id, f.name, f.district_id
    ORDER BY f.name
  `);

  const facilities = (dbRows.rows as any[]).map((row) => {
    const fId = Number(row.id);
    const villages_planned = Number(row.db_villages_planned ?? 0);
    const sessions_not_achieved = Number(row.db_sessions_not_achieved ?? 0);
    const missed_villages = Number(row.db_missed_villages ?? 0);
    const reached_villages = Number(row.db_reached_villages ?? 0);

    return {
      level: "facility",
      id: fId,
      name: String(row.name),
      parent_id: Number(row.parent_id),
      villages_planned,
      sessions_not_achieved,
      missed_villages,
      reached_villages,
    };
  });

  const provincesMap = await getProvincesMap(filters.tenantId);
  const districtsMap = await getDistrictsMap(filters.tenantId);

  return rollupHierarchy(
    facilities,
    provincesMap,
    districtsMap,
    ["villages_planned", "sessions_not_achieved", "missed_villages", "reached_villages"]
  );
}

// ---------------------------------------------------------------------------
// R5 — Vaccination Coverage
// ---------------------------------------------------------------------------
export async function getCoverageReport(filters: ReportFilters): Promise<HierarchyRow[]> {
  const yearClause    = filters.year    ? sql` AND sp.year = ${filters.year}`    : sql``;
  const quarterClause = filters.quarter ? sql` AND sp.quarter = ${filters.quarter}` : sql``;
  const facilityFilter = facilityScopeClause(filters);
  const districtFilter = districtScopeClause(filters);
  const provinceFilter = provinceScopeClause(filters);


  const dbRows = await db.execute(sql`
    SELECT
      f.id                               AS id,
      f.name                             AS name,
      f.district_id                      AS parent_id,
      SUM(COALESCE(sp.target_population, 0))::int AS db_target_population,
      SUM(COALESCE((sp.vaccinated_counts->>'totals')::int, 0))::int AS db_vaccinated_total,
      COUNT(sp.id)::int AS db_total_sessions,
      SUM(CASE WHEN sp.completed_at IS NOT NULL THEN 1 ELSE 0 END)::int AS db_completed_sessions
    FROM facilities f
    JOIN districts d ON d.id = f.district_id
    JOIN provinces p ON p.id = d.province_id
    LEFT JOIN session_plans sp ON sp.facility_id = f.id${yearClause}${quarterClause}
    WHERE f.tenant_id = ${filters.tenantId}
      ${facilityFilter}
      ${districtFilter}
      ${provinceFilter}
    GROUP BY f.id, f.name, f.district_id
    ORDER BY f.name
  `);

  const facilities = (dbRows.rows as any[]).map((row) => {
    const fId = Number(row.id);
    const target_population = Number(row.db_target_population ?? 0);
    const vaccinated_total = Number(row.db_vaccinated_total ?? 0);
    const total_sessions = Number(row.db_total_sessions ?? 0);
    const completed_sessions = Number(row.db_completed_sessions ?? 0);
    const coverage_pct = target_population > 0 ? Number(((vaccinated_total / target_population) * 100).toFixed(1)) : 0;

    return {
      level: "facility",
      id: fId,
      name: String(row.name),
      parent_id: Number(row.parent_id),
      target_population,
      vaccinated_total,
      total_sessions,
      completed_sessions,
      coverage_pct,
    };
  });

  const provincesMap = await getProvincesMap(filters.tenantId);
  const districtsMap = await getDistrictsMap(filters.tenantId);

  return rollupHierarchy(
    facilities,
    provincesMap,
    districtsMap,
    ["target_population", "vaccinated_total", "total_sessions", "completed_sessions"],
    [],
    (row) => {
      const target = Number(row.target_population ?? 0);
      const vac = Number(row.vaccinated_total ?? 0);
      row.coverage_pct = target > 0 ? Number(((vac / target) * 100).toFixed(1)) : 0;
    }
  );
}

// ---------------------------------------------------------------------------
// R6 — Hard-to-Reach Status
// ---------------------------------------------------------------------------
export async function getHtrReport(filters: ReportFilters): Promise<HierarchyRow[]> {
  const facilityFilter = facilityScopeClause(filters);
  const districtFilter = districtScopeClause(filters);
  const provinceFilter = provinceScopeClause(filters);

  const dbRows = await db.execute(sql`
    SELECT
      f.id AS id,
      f.name AS name,
      f.district_id AS parent_id,
      COUNT(v.id)::int                                          AS db_total_villages,
      SUM(CASE WHEN v.is_hard_to_reach = true THEN 1 ELSE 0 END)::int AS db_htr_villages,
      SUM(CASE WHEN h.intervention_priority = 'Critical'  THEN 1 ELSE 0 END)::int AS db_critical,
      SUM(CASE WHEN h.intervention_priority = 'High'      THEN 1 ELSE 0 END)::int AS db_high_priority,
      SUM(CASE WHEN h.intervention_priority = 'Medium'    THEN 1 ELSE 0 END)::int AS db_medium_priority,
      SUM(CASE WHEN h.intervention_priority = 'Low'       THEN 1 ELSE 0 END)::int AS db_low_priority,
      AVG(h.composite_score) AS db_avg_htr_score
    FROM facilities f
    JOIN districts d ON d.id = f.district_id
    JOIN provinces p ON p.id = d.province_id
    LEFT JOIN villages v ON v.assigned_facility_id = f.id
    LEFT JOIN htr_scores h ON h.village_id = v.id
    WHERE f.tenant_id = ${filters.tenantId}
      ${facilityFilter}
      ${districtFilter}
      ${provinceFilter}
    GROUP BY f.id, f.name, f.district_id
    ORDER BY f.name
  `);

  const facilities = (dbRows.rows as any[]).map((row) => {
    const fId = Number(row.id);
    const dbTotalVillages = Number(row.db_total_villages ?? 0);
    const total_villages = dbTotalVillages;

    const htr_villages = Number(row.db_htr_villages ?? 0);
    const critical = Number(row.db_critical ?? 0);
    const high_priority = Number(row.db_high_priority ?? 0);
    const medium_priority = Number(row.db_medium_priority ?? 0);
    const low_priority = Number(row.db_low_priority ?? 0);
    const avg_htr_score = row.db_avg_htr_score != null ? Number(row.db_avg_htr_score) : 0;

    return {
      level: "facility",
      id: fId,
      name: String(row.name),
      parent_id: Number(row.parent_id),
      total_villages,
      htr_villages,
      critical,
      high_priority,
      medium_priority,
      low_priority,
      avg_htr_score: Number(avg_htr_score.toFixed(1)),
    };
  });

  const provincesMap = await getProvincesMap(filters.tenantId);
  const districtsMap = await getDistrictsMap(filters.tenantId);

  return rollupHierarchy(
    facilities,
    provincesMap,
    districtsMap,
    ["total_villages", "htr_villages", "critical", "high_priority", "medium_priority", "low_priority"],
    [{ key: "avg_htr_score", weightKey: "total_villages" }]
  );
}

// ---------------------------------------------------------------------------
// R7 — Budget & Resources
// ---------------------------------------------------------------------------
export async function getBudgetReport(filters: ReportFilters): Promise<HierarchyRow[]> {
  const yearClause    = filters.year    ? sql` AND bi.year = ${filters.year}`    : sql``;
  const quarterClause = filters.quarter ? sql` AND bi.quarter = ${filters.quarter}` : sql``;
  const facilityFilter = facilityScopeClause(filters);
  const districtFilter = districtScopeClause(filters);
  const provinceFilter = provinceScopeClause(filters);


  const dbRows = await db.execute(sql`
    SELECT
      f.id AS id,
      f.name AS name,
      f.district_id AS parent_id,
      SUM(bi.total_cost)::numeric                                           AS db_total_budget,
      SUM(CASE WHEN bi.approval_status = 'approved' THEN bi.total_cost ELSE 0 END)::numeric AS db_approved_budget,
      SUM(CASE WHEN bi.funding_source = 'government' THEN bi.total_cost ELSE 0 END)::numeric AS db_government_funding,
      SUM(CASE WHEN bi.funding_source = 'gavi'       THEN bi.total_cost ELSE 0 END)::numeric AS db_gavi_funding,
      SUM(CASE WHEN bi.funding_source = 'unicef'     THEN bi.total_cost ELSE 0 END)::numeric AS db_unicef_funding,
      SUM(CASE WHEN bi.funding_source = 'who'        THEN bi.total_cost ELSE 0 END)::numeric AS db_who_funding,
      SUM(CASE WHEN bi.funding_source = 'other'      THEN bi.total_cost ELSE 0 END)::numeric AS db_other_funding,
      COUNT(bi.id)::int AS db_budget_line_count
    FROM facilities f
    JOIN districts d ON d.id = f.district_id
    JOIN provinces p ON p.id = d.province_id
    LEFT JOIN budget_items bi ON bi.facility_id = f.id${yearClause}${quarterClause}
    WHERE f.tenant_id = ${filters.tenantId}
      ${facilityFilter}
      ${districtFilter}
      ${provinceFilter}
    GROUP BY f.id, f.name, f.district_id
    ORDER BY f.name
  `);

  const facilities = (dbRows.rows as any[]).map((row) => {
    const fId = Number(row.id);
    const total_budget = Number(row.db_total_budget ?? 0);
    const approved_budget = Number(row.db_approved_budget ?? 0);
    const government_funding = Number(row.db_government_funding ?? 0);
    const gavi_funding = Number(row.db_gavi_funding ?? 0);
    const unicef_funding = Number(row.db_unicef_funding ?? 0);
    const who_funding = Number(row.db_who_funding ?? 0);
    const other_funding = Number(row.db_other_funding ?? 0);
    const budget_line_count = Number(row.db_budget_line_count ?? 0);

    return {
      level: "facility",
      id: fId,
      name: String(row.name),
      parent_id: Number(row.parent_id),
      total_budget,
      approved_budget,
      government_funding,
      gavi_funding,
      unicef_funding,
      who_funding,
      other_funding,
      budget_line_count,
    };
  });

  const provincesMap = await getProvincesMap(filters.tenantId);
  const districtsMap = await getDistrictsMap(filters.tenantId);

  return rollupHierarchy(
    facilities,
    provincesMap,
    districtsMap,
    [
      "total_budget",
      "approved_budget",
      "government_funding",
      "gavi_funding",
      "unicef_funding",
      "who_funding",
      "other_funding",
      "budget_line_count"
    ]
  );
}

// ---------------------------------------------------------------------------
// R8 — Supervision Activity
// ---------------------------------------------------------------------------
export async function getSupervisionReport(filters: ReportFilters): Promise<HierarchyRow[]> {
  const yearClause = filters.year
    ? sql` AND EXTRACT(YEAR FROM sv.scheduled_date) = ${filters.year}`
    : sql``;
  const quarterClause = filters.quarter
    ? sql` AND CEIL(EXTRACT(MONTH FROM sv.scheduled_date) / 3.0) = ${filters.quarter}`
    : sql``;
  const facilityFilter = facilityScopeClause(filters);
  const districtFilter = districtScopeClause(filters);
  const provinceFilter = provinceScopeClause(filters);


  const dbRows = await db.execute(sql`
    SELECT
      f.id AS id,
      f.name AS name,
      f.district_id AS parent_id,
      COUNT(sv.id)::int AS db_total_visits,
      SUM(CASE WHEN sv.status = 'conducted'  THEN 1 ELSE 0 END)::int AS db_conducted,
      SUM(CASE WHEN sv.status = 'scheduled'  THEN 1 ELSE 0 END)::int AS db_scheduled,
      SUM(CASE WHEN sv.status = 'missed'     THEN 1 ELSE 0 END)::int AS db_missed,
      SUM(CASE WHEN sv.status = 'cancelled'  THEN 1 ELSE 0 END)::int AS db_cancelled,
      AVG(sv.score) AS db_avg_score
    FROM facilities f
    JOIN districts d ON d.id = f.district_id
    JOIN provinces p ON p.id = d.province_id
    LEFT JOIN supervision_visits sv ON sv.facility_id = f.id${yearClause}${quarterClause}
    WHERE f.tenant_id = ${filters.tenantId}
      ${facilityFilter}
      ${districtFilter}
      ${provinceFilter}
    GROUP BY f.id, f.name, f.district_id
    ORDER BY f.name
  `);

  const facilities = (dbRows.rows as any[]).map((row) => {
    const fId = Number(row.id);
    const total_visits = Number(row.db_total_visits ?? 0);
    const conducted = Number(row.db_conducted ?? 0);
    const scheduled = Number(row.db_scheduled ?? 0);
    const missed = Number(row.db_missed ?? 0);
    const cancelled = Number(row.db_cancelled ?? 0);
    const avg_score = row.db_avg_score != null ? Number(row.db_avg_score) : 0;
    const completion_rate = total_visits > 0 ? Number(((conducted / total_visits) * 100).toFixed(1)) : 0;

    return {
      level: "facility",
      id: fId,
      name: String(row.name),
      parent_id: Number(row.parent_id),
      total_visits,
      conducted,
      scheduled,
      missed,
      cancelled,
      avg_score,
      completion_rate,
    };
  });

  const provincesMap = await getProvincesMap(filters.tenantId);
  const districtsMap = await getDistrictsMap(filters.tenantId);

  return rollupHierarchy(
    facilities,
    provincesMap,
    districtsMap,
    ["total_visits", "conducted", "scheduled", "missed", "cancelled"],
    [{ key: "avg_score", weightKey: "conducted" }],
    (row) => {
      const total = Number(row.total_visits ?? 0);
      const cond = Number(row.conducted ?? 0);
      row.completion_rate = total > 0 ? Number(((cond / total) * 100).toFixed(1)) : 0;
    }
  );
}



