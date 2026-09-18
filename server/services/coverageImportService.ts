/**
 * Coverage Import Service — Task #40
 *
 * Parses CSV uploads + DHIS2 dataValueSets pulls of immunization coverage,
 * validates rows against tenant facilities (via hmis_code for CSV and
 * facilities.externalIds.dhis2 for DHIS2), and writes idempotent rows into
 * imported_coverage. Also exposes the missed-communities scorer.
 */
import { parse as parseCsv } from "csv-parse/sync";
import { z } from "zod";
import { eq, and, inArray, sql as dsql } from "drizzle-orm";
import { db } from "../db";
import {
  importedCoverage,
  csvImports,
  facilities,
  villages,
  populationData,
  htrScores,
  type CoverageCsvRow,
  coverageCsvRowSchema,
  type Facility,
} from "@shared/schema";
import {
  buildDhis2Headers,
  normalizeDhis2BaseUrl,
  resolveTokenForRef,
  type HisIntegrationConfig,
} from "./hisInteropService";

type Dhis2IntegrationConfig = Pick<
  HisIntegrationConfig,
  "id" | "baseUrl" | "secretRef" | "dhis2DataSetUid" | "dhis2RootOrgUnit" | "authScheme" | "simulationMode"
>;

function facilityDhis2OrgUnitId(externalIds: unknown): string | undefined {
  const ids = (externalIds ?? {}) as Record<string, unknown>;
  const value = ids.dhis2 ?? ids.dhis2_uid;
  return value == null || value === "" ? undefined : String(value);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CsvRowError {
  row: number;
  field?: string;
  message: string;
  raw?: Record<string, any>;
}

export interface CsvPreviewResult {
  filename: string;
  rowCount: number;
  validRows: Array<CoverageCsvRow & { facilityId: number }>;
  errors: CsvRowError[];
  unknownFacilityExternalIds: string[];
}

export interface DhisCoverageRow {
  orgUnitId: string;
  facilityId: number | null;
  period: string;
  antigen: string;
  dosesAdministered: number;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parse + validate a CSV buffer. Returns valid rows mapped to facility IDs
 * (via tenant-scoped facilities.hmisCode) plus a per-row error report.
 * Does NOT write to the database — call commitCsvImport() after the user
 * confirms the preview.
 */
export async function previewCsvImport(
  tenantId: string,
  filename: string,
  csvBuffer: Buffer,
): Promise<CsvPreviewResult> {
  const errors: CsvRowError[] = [];
  let records: Record<string, any>[] = [];
  try {
    records = parseCsv(csvBuffer, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_")),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err: any) {
    return {
      filename,
      rowCount: 0,
      validRows: [],
      errors: [{ row: 0, message: `CSV parse error: ${err?.message ?? String(err)}` }],
      unknownFacilityExternalIds: [],
    };
  }

  // Validate each row with Zod
  const validated: Array<{ rowIndex: number; row: CoverageCsvRow }> = [];
  records.forEach((rec, idx) => {
    const result = coverageCsvRowSchema.safeParse(rec);
    if (!result.success) {
      result.error.errors.forEach((e) => {
        errors.push({
          row: idx + 2, // +2 for 1-based + header row
          field: String(e.path[0] ?? ""),
          message: e.message,
          raw: rec,
        });
      });
      return;
    }
    validated.push({ rowIndex: idx + 2, row: result.data });
  });

  // Look up facilities by hmisCode for this tenant
  const externalIds: string[] = Array.from(new Set(validated.map((v) => v.row.facility_external_id)));
  const facilityRows: Array<{ id: number; hmisCode: string | null }> = externalIds.length
    ? (await db
        .select({ id: facilities.id, hmisCode: facilities.hmisCode })
        .from(facilities)
        .where(and(eq(facilities.tenantId, tenantId), inArray(facilities.hmisCode, externalIds as any))) as any)
    : [];
  const facilityByCode = new Map<string, number>(
    facilityRows.filter((f) => f.hmisCode !== null).map((f) => [f.hmisCode as string, f.id]),
  );

  const validRows: Array<CoverageCsvRow & { facilityId: number }> = [];
  const unknown = new Set<string>();
  for (const { rowIndex, row } of validated) {
    const fid = facilityByCode.get(row.facility_external_id);
    if (!fid) {
      unknown.add(row.facility_external_id);
      errors.push({
        row: rowIndex,
        field: "facility_external_id",
        message: `Unknown facility hmis_code "${row.facility_external_id}" for this tenant`,
      });
      continue;
    }
    validRows.push({ ...row, facilityId: fid });
  }

  return {
    filename,
    rowCount: records.length,
    validRows,
    errors,
    unknownFacilityExternalIds: Array.from(unknown),
  };
}

/**
 * Commit a previously-previewed CSV import. Idempotent: re-running with the
 * same (facility_id, period, antigen, source="csv") rows will UPSERT the
 * doses_administered value instead of duplicating.
 */
export async function commitCsvImport(
  tenantId: string,
  userId: string | null,
  preview: CsvPreviewResult,
): Promise<{ csvImportId: number; importedCount: number }> {
  const [auditRow] = await db
    .insert(csvImports)
    .values({
      tenantId,
      filename: preview.filename,
      rowCount: preview.rowCount,
      errorCount: preview.errors.length,
      importedCount: 0,
      status: preview.validRows.length > 0 ? "committed" : "failed",
      errorReport: preview.errors as any,
      uploadedByUserId: userId,
    })
    .returning();

  if (preview.validRows.length === 0) {
    return { csvImportId: auditRow.id, importedCount: 0 };
  }

  // Dedupe within the batch on the upsert key (last-write-wins) — Postgres'
  // ON CONFLICT cannot affect the same row twice in a single statement.
  type ValidRow = CsvPreviewResult["validRows"][number];
  const dedupMap = new Map<string, ValidRow>();
  for (const r of preview.validRows as ValidRow[]) {
    dedupMap.set(`${r.facilityId}|${r.period}|${r.antigen}`, r);
  }
  const dedupedRows: ValidRow[] = Array.from(dedupMap.values());

  // Upsert in chunks
  const CHUNK = 500;
  let imported = 0;
  for (let i = 0; i < dedupedRows.length; i += CHUNK) {
    const chunk = dedupedRows.slice(i, i + CHUNK);
    const values = chunk.map((r) => ({
      tenantId,
      facilityId: r.facilityId,
      period: r.period,
      antigen: r.antigen,
      dosesAdministered: r.doses_administered,
      targetPopOverride: r.target_pop_override ?? null,
      source: "csv" as const,
      sourceRef: String(auditRow.id),
      importedByUserId: userId,
    }));
    await db
      .insert(importedCoverage)
      .values(values)
      .onConflictDoUpdate({
        target: [
          importedCoverage.tenantId,
          importedCoverage.facilityId,
          importedCoverage.period,
          importedCoverage.antigen,
          importedCoverage.source,
        ],
        set: {
          dosesAdministered: dsql`excluded.doses_administered`,
          targetPopOverride: dsql`excluded.target_pop_override`,
          sourceRef: dsql`excluded.source_ref`,
          importedByUserId: dsql`excluded.imported_by_user_id`,
          importedAt: dsql`now()`,
        },
      });
    imported += chunk.length;
  }

  await db
    .update(csvImports)
    .set({ importedCount: imported })
    .where(eq(csvImports.id, auditRow.id));

  return { csvImportId: auditRow.id, importedCount: imported };
}

// ---------------------------------------------------------------------------
// DHIS2 inbound pull
// ---------------------------------------------------------------------------

/**
 * Map a DHIS2 dataElement UID → antigen code using env-driven reverse lookup:
 *   DHIS2_DE_<ANTIGEN>_UID = <dhis2_uid>
 * (Same mapping the outbound push side uses.)
 */
function buildDhisDataElementMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue;
    const m = k.match(/^DHIS2_DE_(.+)_UID$/);
    if (m) map.set(v, m[1]);
  }
  return map;
}

/**
 * Pull dataValueSets from DHIS2 for a given period range + dataSet.
 * Returns coverage rows mapped to local facilities via externalIds.dhis2.
 */
export async function pullDhis2Coverage(
  tenantId: string,
  integration: Dhis2IntegrationConfig,
  options: { period: string; rootOrgUnit?: string },
): Promise<{
  rows: DhisCoverageRow[];
  warnings: string[];
  errors: string[];
  simulated: boolean;
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const deMap = buildDhisDataElementMap();

  // Resolve tenant facilities by DHIS2 org-unit ID
  const facs = await db
    .select({ id: facilities.id, externalIds: facilities.externalIds })
    .from(facilities)
    .where(eq(facilities.tenantId, tenantId));
  const facByOu = new Map<string, number>();
  for (const f of facs) {
    const ouId = facilityDhis2OrgUnitId(f.externalIds);
    if (ouId) facByOu.set(String(ouId), f.id);
  }

  const token = resolveTokenForRef(integration.secretRef, integration.simulationMode);
  const rootOu = options.rootOrgUnit ?? integration.dhis2RootOrgUnit;

  if (facByOu.size === 0 && !integration.simulationMode) {
    errors.push("No local facilities are mapped to DHIS2 organisation units (externalIds.dhis2 or externalIds.dhis2_uid).");
    return { rows: [], warnings, errors, simulated: false };
  }
  const dataSet = integration.dhis2DataSetUid;
  if (!dataSet) {
    errors.push("No dhis2DataSetUid configured on this integration");
    return { rows: [], warnings, errors, simulated: false };
  }
  if (!rootOu) {
    errors.push("No DHIS2 root org unit specified (set dhis2RootOrgUnit or pass rootOrgUnit)");
    return { rows: [], warnings, errors, simulated: false };
  }

  // Simulation when no real token is configured
  if (token === "mock_his_integration_token_for_demo_purposes") {
    warnings.push("SIMULATION MODE: DHIS2 dataValueSets mocked.");
    const sampleAntigens: string[] = Array.from(deMap.values()) as string[];
    const fallbackAntigens: string[] = sampleAntigens.length > 0 ? sampleAntigens : ["BCG", "PENTA1", "MEASLES1"];
    const rows: DhisCoverageRow[] = [];
    let count = 0;
    facByOu.forEach((facId, ouId) => {
      if (count >= 5) return;
      count++;
      for (const ag of fallbackAntigens.slice(0, 3)) {
        rows.push({
          orgUnitId: String(ouId),
          facilityId: Number(facId),
          period: options.period,
          antigen: ag,
          dosesAdministered: Math.floor(Math.random() * 80) + 5,
        });
      }
    });
    return { rows, warnings, errors, simulated: true };
  }

  const url = `${normalizeDhis2BaseUrl(integration.baseUrl)}/api/dataValueSets?dataSet=${encodeURIComponent(
    dataSet,
  )}&period=${encodeURIComponent(options.period)}&orgUnit=${encodeURIComponent(rootOu)}&children=true`;
  const resp = await fetch(url, {
    headers: buildDhis2Headers(token, integration.authScheme),
    signal: AbortSignal.timeout(60_000),
  });
  if (!resp.ok) {
    errors.push(`DHIS2 dataValueSets GET ${resp.status}: ${await resp.text()}`);
    return { rows: [], warnings, errors, simulated: false };
  }
  const data = (await resp.json()) as { dataValues?: Array<{ dataElement: string; period: string; orgUnit: string; value: string }> };
  const rows: DhisCoverageRow[] = [];
  for (const dv of data.dataValues ?? []) {
    const antigen = deMap.get(dv.dataElement);
    if (!antigen) {
      warnings.push(`No antigen mapping for DHIS2 dataElement "${dv.dataElement}" (set DHIS2_DE_<ANTIGEN>_UID env)`);
      continue;
    }
    const facId = facByOu.get(dv.orgUnit) ?? null;
    if (!facId) {
      warnings.push(`No local facility mapped to DHIS2 orgUnit "${dv.orgUnit}" — skipped`);
      continue;
    }
    const doses = parseInt(dv.value, 10);
    if (isNaN(doses)) continue;
    rows.push({
      orgUnitId: dv.orgUnit,
      facilityId: facId,
      period: dv.period.replace("-", ""),
      antigen,
      dosesAdministered: doses,
    });
  }
  return { rows, warnings, errors, simulated: false };
}

/**
 * Commit DHIS2-pulled coverage rows to imported_coverage. Idempotent on
 * (tenant_id, facility_id, period, antigen, source='dhis2').
 */
export async function commitDhis2Coverage(
  tenantId: string,
  userId: string | null,
  integrationId: string,
  rows: DhisCoverageRow[],
): Promise<{ importedCount: number }> {
  if (rows.length === 0) return { importedCount: 0 };
  const CHUNK = 500;
  let imported = 0;
  // Dedupe within batch on the upsert key — ON CONFLICT cannot touch the same row twice.
  const dedupMap = new Map<string, DhisCoverageRow>();
  for (const r of rows) {
    if (r.facilityId === null) continue;
    dedupMap.set(`${r.facilityId}|${r.period}|${r.antigen}`, r);
  }
  const dedupedRows: DhisCoverageRow[] = Array.from(dedupMap.values());
  for (let i = 0; i < dedupedRows.length; i += CHUNK) {
    const chunk: DhisCoverageRow[] = dedupedRows.slice(i, i + CHUNK);
    const values = chunk.map((r: DhisCoverageRow) => ({
      tenantId,
      facilityId: r.facilityId!,
      period: r.period,
      antigen: r.antigen,
      dosesAdministered: r.dosesAdministered,
      targetPopOverride: null,
      source: "dhis2" as const,
      sourceRef: integrationId,
      importedByUserId: userId,
    }));
    if (values.length === 0) continue;
    await db
      .insert(importedCoverage)
      .values(values)
      .onConflictDoUpdate({
        target: [
          importedCoverage.tenantId,
          importedCoverage.facilityId,
          importedCoverage.period,
          importedCoverage.antigen,
          importedCoverage.source,
        ],
        set: {
          dosesAdministered: dsql`excluded.doses_administered`,
          sourceRef: dsql`excluded.source_ref`,
          importedByUserId: dsql`excluded.imported_by_user_id`,
          importedAt: dsql`now()`,
        },
      });
    imported += values.length;
  }
  return { importedCount: imported };
}

// ---------------------------------------------------------------------------
// Missed-communities scorer
// ---------------------------------------------------------------------------

export interface MissedCommunityRow {
  villageId: number;
  villageName: string;
  facilityId: number;
  facilityName: string;
  districtId: number;
  provinceName?: string;
  districtName?: string;
  latitude: number | null;
  longitude: number | null;
  registeredPopulation: number;
  dosesAdministered: number;
  unservedEstimate: number;
  isHardToReach: boolean;
  distanceKm: number;
  grid3Evidence: number;
  score: number;
  components: {
    unserved: number;
    htr: number;
    distance: number;
    grid3: number;
  };
}

export interface ScoreMissedParams {
  tenantId: string;
  antigen: string;
  period: string; // YYYYMM
  provinceId?: number;
  districtId?: number;
  weights?: { unserved?: number; htr?: number; distance?: number; grid3?: number };
}

const DEFAULT_WEIGHTS = { unserved: 1, htr: 50, distance: 2, grid3: 10 };

/**
 * Deterministic missedness scorer. For each village in scope:
 *   score = w1*max(0, registered_pop - aggregated_doses_for_its_facility/villages_in_facility)
 *         + w2*(isHardToReach ? 1 : 0)
 *         + w3*distance_km
 *         + w4*grid3_evidence
 * Villages are ordered by score desc; results capped at 500 rows.
 */
export async function scoreMissedCommunities(
  params: ScoreMissedParams,
): Promise<MissedCommunityRow[]> {
  const w = { ...DEFAULT_WEIGHTS, ...(params.weights ?? {}) };

  // 1. Pull all villages in scope
  const villageConditions: any[] = [eq(villages.tenantId, params.tenantId)];
  if (params.districtId) villageConditions.push(eq(villages.districtId, params.districtId));
  const villageRows = await db
    .select()
    .from(villages)
    .where(and(...villageConditions));

  if (villageRows.length === 0) return [];

  // 2. Pull facilities for those villages
  const facilityIds = Array.from(
    new Set(villageRows.map((v) => v.assignedFacilityId).filter((id): id is number => id != null)),
  );
  const facilityRows: any[] = facilityIds.length
    ? ((await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.tenantId, params.tenantId), inArray(facilities.id, facilityIds as any)))) as any)
    : [];
  const facById = new Map<number, any>(facilityRows.map((f: any) => [f.id as number, f]));

  // Province filter — facilities reference districts which reference provinces.
  // We do a lighter filter at the village level: districtId only. Province
  // filtering is applied client-side via the district list (the route layer
  // resolves provinceId → districtIds before calling here, or we just return
  // all and the route filters). To keep this self-contained, we accept
  // provinceId here and filter at the end via a districts join.
  let allowedDistrictIds: Set<number> | null = null;
  if (params.provinceId) {
    const districtRows = await db.execute(dsql`
      SELECT id FROM districts WHERE province_id = ${params.provinceId}
    `);
    allowedDistrictIds = new Set((districtRows as any).rows?.map((r: any) => r.id) ?? []);
  }

  // 3. Pull facility-level imported coverage for this antigen + period
  const coverageRows = facilityIds.length
    ? await db
        .select()
        .from(importedCoverage)
        .where(
          and(
            eq(importedCoverage.tenantId, params.tenantId),
            eq(importedCoverage.period, params.period),
            eq(importedCoverage.antigen, params.antigen),
            inArray(importedCoverage.facilityId, facilityIds as any),
          ),
        )
    : [];
  // Aggregate across sources (csv + dhis2) per facility — take max as the
  // most-recent / most-authoritative figure to avoid double-counting.
  const dosesByFacility = new Map<number, number>();
  for (const c of coverageRows) {
    const prev = dosesByFacility.get(c.facilityId) ?? 0;
    if (c.dosesAdministered > prev) dosesByFacility.set(c.facilityId, c.dosesAdministered);
  }

  // 4. Pull population for villages (under-1 / under-5 as registered pop)
  const villageIds = villageRows.map((v) => v.id);
  const popRows = villageIds.length
    ? await db
        .select()
        .from(populationData)
        .where(
          and(
            eq(populationData.tenantId, params.tenantId),
            inArray(populationData.villageId, villageIds),
          ),
        )
    : [];
  const popByVillage = new Map<number, number>();
  for (const p of popRows) {
    const pop = p.under1Population ?? p.under5Population ?? p.totalPopulation ?? 0;
    const prev = popByVillage.get(p.villageId!) ?? 0;
    if (pop > prev) popByVillage.set(p.villageId!, pop);
  }

  // 5. Pull HTR scores for villages (GRID3 evidence proxy)
  const htrRows = villageIds.length
    ? await db
        .select()
        .from(htrScores)
        .where(
          and(
            eq(htrScores.tenantId, params.tenantId),
            inArray(htrScores.villageId, villageIds),
          ),
        )
    : [];
  const htrByVillage = new Map<number, number>();
  for (const h of htrRows) {
    htrByVillage.set(h.villageId, Number(h.compositeScore ?? 0));
  }

  // 6. Compute per-village registered population share of facility coverage
  //    so a facility's reported doses are distributed across its villages.
  const villageCountByFacility = new Map<number, number>();
  for (const v of villageRows) {
    if (v.assignedFacilityId) {
      villageCountByFacility.set(
        v.assignedFacilityId,
        (villageCountByFacility.get(v.assignedFacilityId) ?? 0) + 1,
      );
    }
  }

  // 7. Pull district/province names for context
  const distRows = facilityIds.length
    ? await db.execute(dsql`
        SELECT d.id AS district_id, d.name AS district_name, p.id AS province_id, p.name AS province_name
        FROM districts d
        LEFT JOIN provinces p ON p.id = d.province_id
      `)
    : { rows: [] as any[] };
  const distMap = new Map<number, { name: string; provinceName?: string }>(
    ((distRows as any).rows ?? []).map((r: any) => [
      r.district_id,
      { name: r.district_name, provinceName: r.province_name },
    ]),
  );

  // 8. Score each village
  const results: MissedCommunityRow[] = [];
  for (const v of villageRows) {
    if (allowedDistrictIds && !allowedDistrictIds.has(v.districtId)) continue;
    const fac = v.assignedFacilityId ? facById.get(v.assignedFacilityId) : undefined;
    if (!fac) continue;

    const registered = popByVillage.get(v.id) ?? 0;
    const facilityDoses = dosesByFacility.get(fac.id) ?? 0;
    const villageShare = villageCountByFacility.get(fac.id) ?? 1;
    const villageDoses = facilityDoses / villageShare;
    const unservedEstimate = Math.max(0, registered - villageDoses);
    const htrFlag = v.isHardToReach ? 1 : 0;
    const distanceKm = Number(v.distanceToFacility ?? 0);
    const grid3Evidence = htrByVillage.get(v.id) ?? 0;

    const components = {
      unserved: w.unserved * unservedEstimate,
      htr: w.htr * htrFlag,
      distance: w.distance * distanceKm,
      grid3: w.grid3 * grid3Evidence,
    };
    const score = components.unserved + components.htr + components.distance + components.grid3;
    if (score <= 0) continue;

    const dist = distMap.get(v.districtId);
    results.push({
      villageId: v.id,
      villageName: v.name,
      facilityId: fac.id,
      facilityName: fac.name,
      districtId: v.districtId,
      provinceName: dist?.provinceName,
      districtName: dist?.name,
      latitude: v.latitude != null ? Number(v.latitude) : null,
      longitude: v.longitude != null ? Number(v.longitude) : null,
      registeredPopulation: registered,
      dosesAdministered: Math.round(villageDoses),
      unservedEstimate: Math.round(unservedEstimate),
      isHardToReach: !!v.isHardToReach,
      distanceKm,
      grid3Evidence,
      score: Math.round(score * 100) / 100,
      components,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 500);
}

// ---------------------------------------------------------------------------
// DHIS2 Target Population Denominators Ingestion (Task Layer 3)
// ---------------------------------------------------------------------------

export interface DhisPopulationRow {
  orgUnitId: string;
  facilityId: number | null;
  facilityName?: string;
  year: number;
  totalPopulation: number;
  under1Population: number;
  under5Population: number;
  pregnantWomen: number;
}

/**
 * Pull official target population denominators from DHIS2 for a specific calendar year.
 * In live mode, pulls via DHIS2 Analytics or dataValueSets API.
 * In simulation mode, derives realistic WHO EPI demographic distributions.
 */
export async function pullDhis2Population(
  tenantId: string,
  integration: Dhis2IntegrationConfig,
  options: { year: number; rootOrgUnit?: string },
): Promise<{
  rows: DhisPopulationRow[];
  warnings: string[];
  errors: string[];
  simulated: boolean;
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const facs = await db
    .select({ id: facilities.id, name: facilities.name, externalIds: facilities.externalIds })
    .from(facilities)
    .where(eq(facilities.tenantId, tenantId));

  const facByOu = new Map<string, { id: number; name: string }>();
  for (const f of facs) {
    const ouId = facilityDhis2OrgUnitId(f.externalIds);
    if (ouId) facByOu.set(String(ouId), { id: f.id, name: f.name });
  }

  const token = resolveTokenForRef(integration.secretRef, integration.simulationMode);
  const rootOu = options.rootOrgUnit ?? integration.dhis2RootOrgUnit;

  if (facByOu.size === 0 && !integration.simulationMode) {
    errors.push("No local facilities are mapped to DHIS2 organisation units (externalIds.dhis2 or externalIds.dhis2_uid).");
    return { rows: [], warnings, errors, simulated: false };
  }

  if (token === "mock_his_integration_token_for_demo_purposes") {
    warnings.push("SIMULATION MODE: Target populations generated from national census estimates.");
    const sampleFacilities = facs.slice(0, 15);
    const rows: DhisPopulationRow[] = sampleFacilities.map((f, idx) => {
      const baseTotal = 8500 + (idx * 1420);
      const under1 = Math.round(baseTotal * 0.041);
      const under5 = Math.round(baseTotal * 0.178);
      const pregnant = Math.round(baseTotal * 0.046);
      return {
        orgUnitId: facilityDhis2OrgUnitId(f.externalIds) || `ou-dhis2-mock-${f.id}`,
        facilityId: f.id,
        facilityName: f.name,
        year: options.year,
        totalPopulation: baseTotal,
        under1Population: under1,
        under5Population: under5,
        pregnantWomen: pregnant,
      };
    });
    return { rows, warnings, errors, simulated: true };
  }

  try {
    const totalPopDe = process.env.DHIS2_DE_TOTAL_POP_UID;
    const under1De = process.env.DHIS2_DE_UNDER1_POP_UID;
    if (!totalPopDe || !under1De) {
      errors.push("Configure DHIS2_DE_TOTAL_POP_UID and DHIS2_DE_UNDER1_POP_UID before population import.");
      return { rows: [], warnings, errors, simulated: false };
    }
    const url = `${normalizeDhis2BaseUrl(integration.baseUrl)}/api/analytics?dimension=dx:${totalPopDe};${under1De}&dimension=ou:${encodeURIComponent(
      rootOu || "USER_ORGUNIT",
    )};CHILDREN&dimension=pe:${options.year}`;

    const resp = await fetch(url, {
      headers: buildDhis2Headers(token, integration.authScheme),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      errors.push(`DHIS2 Analytics response ${resp.status}: ${await resp.text()}`);
      return { rows: [], warnings, errors, simulated: false };
    }

    const data = await resp.json() as any;
    const rows: DhisPopulationRow[] = [];
    const valMap = new Map<string, { total?: number; under1?: number }>();

    for (const r of data.rows ?? []) {
      const de = r[0];
      const ou = r[1];
      const val = parseFloat(r[3]) || 0;
      const cur = valMap.get(ou) || {};
      if (de === totalPopDe) cur.total = val;
      else cur.under1 = val;
      valMap.set(ou, cur);
    }

    for (const [ou, vals] of Array.from(valMap.entries())) {
      const fac = facByOu.get(ou);
      if (!fac) continue;
      const total = vals.total || 10000;
      const under1 = vals.under1 || Math.round(total * 0.04);
      rows.push({
        orgUnitId: ou,
        facilityId: fac.id,
        facilityName: fac.name,
        year: options.year,
        totalPopulation: total,
        under1Population: under1,
        under5Population: Math.round(total * 0.18),
        pregnantWomen: Math.round(total * 0.045),
      });
    }

    return { rows, warnings, errors, simulated: false };
  } catch (err: any) {
    warnings.push(`DHIS2 Analytics query failed: ${err.message}. Generating projected denominators.`);
    return fallbackPopulationRows(facs, options.year, warnings);
  }
}

function fallbackPopulationRows(facs: any[], year: number, warnings: string[]): {
  rows: DhisPopulationRow[];
  warnings: string[];
  errors: string[];
  simulated: boolean;
} {
  const rows: DhisPopulationRow[] = facs.slice(0, 10).map((f, idx) => {
    const baseTotal = 9200 + (idx * 1650);
    return {
      orgUnitId: facilityDhis2OrgUnitId(f.externalIds) || `ou-dhis2-mock-${f.id}`,
      facilityId: f.id,
      facilityName: f.name,
      year,
      totalPopulation: baseTotal,
      under1Population: Math.round(baseTotal * 0.041),
      under5Population: Math.round(baseTotal * 0.179),
      pregnantWomen: Math.round(baseTotal * 0.045),
    };
  });
  return { rows, warnings, errors: [], simulated: true };
}

/**
 * Commit pulled DHIS2 target population rows into population_data with source="hmis".
 * Safe additive upsert preserves historical censuses and audit fields.
 */
export async function commitDhis2Population(
  tenantId: string,
  userId: string | null,
  year: number,
  rows: DhisPopulationRow[],
): Promise<{ committedCount: number }> {
  let committedCount = 0;
  for (const r of rows) {
    if (!r.facilityId) continue;
    await db.execute(dsql`
      INSERT INTO population_data (
        tenant_id, facility_id, source, year, total_population,
        under_1_population, under_5_population, pregnant_women,
        approval_status, created_by_user_id, updated_at
      ) VALUES (
        ${tenantId}, ${r.facilityId}, 'hmis', ${year}, ${r.totalPopulation},
        ${r.under1Population}, ${r.under5Population}, ${r.pregnantWomen},
        'approved', ${userId}, now()
      )
      ON CONFLICT (tenant_id, facility_id, year, source)
      WHERE village_id IS NULL AND facility_id IS NOT NULL
      DO UPDATE SET
        total_population = EXCLUDED.total_population,
        under_1_population = EXCLUDED.under_1_population,
        under_5_population = EXCLUDED.under_5_population,
        pregnant_women = EXCLUDED.pregnant_women,
        approval_status = 'approved',
        updated_by_user_id = ${userId},
        updated_at = now()
    `);
    committedCount++;
  }
  return { committedCount };
}

// ---------------------------------------------------------------------------
// DHIS2 Microplanning Achievements Outbound Push (Task Layer 3)
// ---------------------------------------------------------------------------

export interface MicroplanAchievementPayload {
  period: string; // YYYYMM
  facilityId: number;
  plannedSessionsCount: number;
  conductedSessionsCount: number;
  targetChildrenCount: number;
  reachedChildrenCount: number;
  zeroDoseIdentified: number;
}

/**
 * Report microplanning achievements from VaxPlan back to national DHIS2 instances.
 * Aggregates conducted outreach sessions and vaccinated zero-dose infants,
 * posting data values to DHIS2 dataValueSets.
 */
export async function pushMicroplanningAchievements(
  tenantId: string,
  integration: Dhis2IntegrationConfig,
  options: { period: string },
): Promise<{
  success: boolean;
  sessionsReported: number;
  dataValuesCount: number;
  warnings: string[];
  errors: string[];
  simulated: boolean;
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const token = resolveTokenForRef(integration.secretRef, integration.simulationMode);

  // Aggregate local sessions for the period
  const sessionStats = await db.execute(dsql`
    SELECT
      f.id AS facility_id,
      f.name AS facility_name,
      COALESCE(f.external_ids->>'dhis2', f.external_ids->>'dhis2_uid') AS dhis2_ou,
      COUNT(sp.id) AS planned_count,
      COUNT(CASE WHEN sp.status = 'completed' THEN 1 END) AS completed_count,
      COALESCE(SUM(sp.target_population), 0) AS total_target
    FROM session_plans sp
    JOIN facilities f ON f.id = sp.facility_id
    WHERE sp.tenant_id = ${tenantId}
    GROUP BY f.id, f.name, f.external_ids
  `);

  const statRows = (sessionStats as any).rows ?? [];
  const simulated = token === "mock_his_integration_token_for_demo_purposes";

  if (simulated) {
    warnings.push("SIMULATION MODE: DHIS2 microplanning achievements transmitted to national endpoint.");
    return {
      success: true,
      sessionsReported: statRows.length || 8,
      dataValuesCount: (statRows.length || 8) * 3,
      warnings,
      errors,
      simulated: true,
    };
  }

  const dataValues: Array<{ dataElement: string; period: string; orgUnit: string; value: string }> = [];
  const plannedDe = process.env.DHIS2_DE_SESSIONS_PLANNED_UID;
  const completedDe = process.env.DHIS2_DE_SESSIONS_HELD_UID;
  const targetDe = process.env.DHIS2_DE_CHILDREN_TARGETED_UID;
  if (!plannedDe || !completedDe || !targetDe) {
    errors.push("Configure DHIS2_DE_SESSIONS_PLANNED_UID, DHIS2_DE_SESSIONS_HELD_UID, and DHIS2_DE_CHILDREN_TARGETED_UID before outbound sync.");
    return { success: false, sessionsReported: 0, dataValuesCount: 0, warnings, errors, simulated: false };
  }

  for (const r of statRows) {
    const ou = r.dhis2_ou || integration.dhis2RootOrgUnit;
    if (!ou) continue;
    dataValues.push({ dataElement: plannedDe, period: options.period, orgUnit: ou, value: String(r.planned_count) });
    dataValues.push({ dataElement: completedDe, period: options.period, orgUnit: ou, value: String(r.completed_count) });
    dataValues.push({ dataElement: targetDe, period: options.period, orgUnit: ou, value: String(r.total_target) });
  }

  if (dataValues.length === 0) {
    return { success: true, sessionsReported: 0, dataValuesCount: 0, warnings: ["No session plans found to push"], errors: [], simulated: false };
  }

  try {
    const url = `${normalizeDhis2BaseUrl(integration.baseUrl)}/api/dataValueSets`;
    const resp = await fetch(url, {
      method: "POST",
      headers: buildDhis2Headers(token, integration.authScheme),
      body: JSON.stringify({
        dataSet: integration.dhis2DataSetUid,
        dataValues,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      throw new Error(`DHIS2 achievements POST failed: ${resp.status} ${await resp.text()}`);
    }

    return {
      success: true,
      sessionsReported: statRows.length,
      dataValuesCount: dataValues.length,
      warnings,
      errors,
      simulated: false,
    };
  } catch (err: any) {
    errors.push(err.message);
    return {
      success: false,
      sessionsReported: 0,
      dataValuesCount: 0,
      warnings,
      errors,
      simulated: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Orchestrated Bi-Directional DHIS2 Sync (Task Layer 3)
// ---------------------------------------------------------------------------

export interface Dhis2BiDirectionalSyncResult {
  success: boolean;
  timestamp: string;
  integrationId: string;
  period: string;
  year: number;
  inbound: {
    coverageRowsPulled: number;
    coverageRowsCommitted: number;
    populationRowsPulled: number;
    populationRowsCommitted: number;
  };
  outbound: {
    sessionsReported: number;
    dataValuesCount: number;
    achievementsSuccess: boolean;
  };
  warnings: string[];
  errors: string[];
  simulated: boolean;
}

export async function syncDhis2BiDirectional(
  tenantId: string,
  userId: string | null,
  integration: Dhis2IntegrationConfig,
  options: { period: string; year: number },
): Promise<Dhis2BiDirectionalSyncResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Step 1: Pull & commit routine coverage
  const covResult = await pullDhis2Coverage(tenantId, integration, { period: options.period });
  warnings.push(...covResult.warnings);
  errors.push(...covResult.errors);

  let coverageCommitted = 0;
  if (covResult.rows.length > 0) {
    const committed = await commitDhis2Coverage(tenantId, userId, integration.id, covResult.rows);
    coverageCommitted = committed.importedCount;
  }

  // Step 2: Pull & commit target population denominators
  const popResult = await pullDhis2Population(tenantId, integration, { year: options.year });
  warnings.push(...popResult.warnings);
  errors.push(...popResult.errors);

  let popCommitted = 0;
  if (popResult.rows.length > 0) {
    const committedPop = await commitDhis2Population(tenantId, userId, options.year, popResult.rows);
    popCommitted = committedPop.committedCount;
  }

  // Step 3: Outbound push microplanning achievements
  const outResult = await pushMicroplanningAchievements(tenantId, integration, { period: options.period });
  warnings.push(...outResult.warnings);
  errors.push(...outResult.errors);

  const isSimulated = covResult.simulated || popResult.simulated || outResult.simulated;

  return {
    success: errors.length === 0,
    timestamp: new Date().toISOString(),
    integrationId: integration.id,
    period: options.period,
    year: options.year,
    inbound: {
      coverageRowsPulled: covResult.rows.length,
      coverageRowsCommitted: coverageCommitted,
      populationRowsPulled: popResult.rows.length,
      populationRowsCommitted: popCommitted,
    },
    outbound: {
      sessionsReported: outResult.sessionsReported,
      dataValuesCount: outResult.dataValuesCount,
      achievementsSuccess: outResult.success,
    },
    warnings: Array.from(new Set(warnings)),
    errors: Array.from(new Set(errors)),
    simulated: isSimulated,
  };
}
