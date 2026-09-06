/**
 * Multi-Format Import & Data Harmonisation Service for VPD Risk Assessment
 * Package: WHO_MEASLES_GLOBAL_RECONCILED_V1
 * 
 * Supports:
 * - WHO Measles Excel Workbook sheets ("Case-Based-Data", "PopulationImmunity", "Setup&Configuration")
 * - Automated detection of header row offset (handles WHO instruction blocks in rows 1-11)
 * - Standardized national CSV linelists
 * - SHA-256 file checksum calculation
 * - Macro-free, safe parsing
 * - Audit logging of accepted/rejected records
 */

import crypto from "crypto";
import * as XLSX from "@e965/xlsx";
import {
  RawSurveillanceCaseRow,
  ProcessedCaseRecord,
  processSurveillanceCaseRow,
} from "./caseProcessor";

export interface ParsedCaseImportResult {
  fileChecksum: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  processedCases: ProcessedCaseRecord[];
  validationIssues: Array<{ rowNumber: number; caseId?: string; issue: string; severity: "WARNING" | "ERROR" }>;
}

export interface DistrictAggregateImportRow {
  districtId?: number | string | null;
  districtName: string;
  population: number;
  areaKm2: number;
  mcv1YearMinus3?: number | null;
  mcv1YearMinus2?: number | null;
  mcv1YearMinus1?: number | null;
  mcv2YearMinus3?: number | null;
  mcv2YearMinus2?: number | null;
  mcv2YearMinus1?: number | null;
  penta1YearMinus1?: number | null;
  siaConductedInWindow?: boolean;
  siaCoveragePct?: number | null;
  siaYear?: number | null;
  siaAgeTarget?: "WIDE" | "NARROW";
  unvaccinatedCasesPct?: number | null;
  suspectedCases?: number | null;
  discardedCases?: number | null;
  adequateInvestigationPct?: number | null;
  adequateSpecimenPct?: number | null;
  timelyLabResultsPct?: number | null;
  threatCasesUnder5?: number | null;
  threatCases5To14?: number | null;
  threatCases15Plus?: number | null;
  borderCaseInPastYear?: boolean;
  suspectedCasesYearMinus3?: number | null;
  suspectedCasesYearMinus2?: number | null;
  vulnerabilityFactors?: {
    migrantOrUnderserved?: boolean;
    vaccineHesitancyOrRefusal?: boolean;
    securityOrConflictConcerns?: boolean;
    recurrentNaturalDisasters?: boolean;
    poorAccessOrTerrain?: boolean;
    inadequatePoliticalSupport?: boolean;
    highTransitHubOrBorder?: boolean;
    massGatheringsOrEvents?: boolean;
  };
}

export interface ParsedAggregateImportResult {
  fileChecksum: string;
  totalDistricts: number;
  acceptedDistricts: DistrictAggregateImportRow[];
  validationIssues: Array<{ rowNumber: number; district?: string; issue: string; severity: "WARNING" | "ERROR" }>;
}

export interface IncidenceImportRow {
  districtId?: number | string | null;
  districtName: string;
  population?: number | null;
  casesYearMinus3: number;
  casesYearMinus2: number;
  casesYearMinus1: number;
}

export interface ParsedIncidenceImportResult {
  fileChecksum: string;
  totalRows: number;
  acceptedDistricts: IncidenceImportRow[];
  validationIssues: Array<{ rowNumber: number; district?: string; issue: string; severity: "WARNING" | "ERROR" }>;
}

/**
 * Calculates SHA-256 checksum of an input buffer
 */
export function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Finds the index of the header row in a 2D array of sheet cells
 */
function findHeaderRowIndex(rows: any[][]): number {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const stringified = row.map((c) => String(c ?? "").toLowerCase().trim());
    const hasDistrict = stringified.some((c) => c.includes("district") || c.includes("county") || c.includes("reporting district"));
    const hasClassification = stringified.some((c) => c.includes("classification") || c.includes("status"));
    const hasRash = stringified.some((c) => c.includes("rash") || c.includes("onset") || c.includes("case id"));

    if ((hasDistrict && hasClassification) || (hasDistrict && hasRash)) {
      return r;
    }
  }
  return 0; // Default to first row
}

/**
 * Safely parses a case linelist from an Excel or CSV buffer (macro-free)
 */
export function parseCaseLinelistBuffer(
  buffer: Buffer,
  mcv1EligibilityMonths: number = 9
): ParsedCaseImportResult {
  const checksum = calculateChecksum(buffer);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  // Locate the relevant sheet with strict priority
  let sheetName = workbook.SheetNames.find(
    (name) =>
      name.toLowerCase().includes("case-based") ||
      name.toLowerCase().includes("linelist") ||
      name.toLowerCase() === "cases"
  );
  if (!sheetName) {
    sheetName = workbook.SheetNames.find(
      (name) =>
        name.toLowerCase().includes("case") &&
        !name.toLowerCase().includes("category")
    );
  }
  if (!sheetName) {
    sheetName = workbook.SheetNames.find(
      (name) =>
        name.toLowerCase().includes("surveillance") &&
        !name.toLowerCase().includes("quality")
    );
  }
  if (!sheetName && workbook.SheetNames.length > 0) {
    sheetName = workbook.SheetNames[0];
  }

  if (!sheetName) {
    throw new Error("Workbook contains no readable sheets.");
  }

  const worksheet = workbook.Sheets[sheetName];
  // Parse as raw 2D array of rows
  const allRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

  if (allRows.length === 0) {
    return {
      fileChecksum: checksum,
      totalRows: 0,
      acceptedRows: 0,
      rejectedRows: 0,
      processedCases: [],
      validationIssues: [],
    };
  }

  const headerIdx = findHeaderRowIndex(allRows);
  const headerRow = allRows[headerIdx].map((c: any) => String(c ?? "").trim());

  // Map header string to column index
  const colMap = new Map<string, number>();
  for (let c = 0; c < headerRow.length; c++) {
    const colName = headerRow[c];
    if (colName) {
      colMap.set(colName.toLowerCase().replace(/[^a-z0-9]/g, ""), c);
    }
  }

  const getCol = (row: any[], ...aliases: string[]): any => {
    for (const a of aliases) {
      const clean = a.toLowerCase().replace(/[^a-z0-9]/g, "");
      const idx = colMap.get(clean);
      if (idx !== undefined && idx < row.length) {
        return row[idx];
      }
    }
    return null;
  };

  const processedCases: ProcessedCaseRecord[] = [];
  const issues: Array<{ rowNumber: number; caseId?: string; issue: string; severity: "WARNING" | "ERROR" }> = [];
  let accepted = 0;
  let rejected = 0;

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const r = allRows[i];
    if (!r || r.every((cell) => cell === null || cell === undefined || cell === "")) {
      continue; // Skip empty trailing rows
    }
    const rowNum = i + 1;

    const caseId = String(getCol(r, "caseid", "case_id", "id", "epidno", "epid_no") ?? `ROW-${rowNum}`);
    const district = String(getCol(r, "reportingdistrict", "district", "county", "admin2", "lga") ?? "").trim();
    const rashDate = getCol(r, "dateofrashonset", "daterashonset", "rashonsetdate", "onsetdate");
    const classification = String(getCol(r, "finalclassification", "classification", "status") ?? "").trim();

    if (!district || !classification) {
      issues.push({
        rowNumber: rowNum,
        caseId,
        issue: "Missing required core fields (District or Final Classification)",
        severity: "ERROR",
      });
      rejected++;
      continue;
    }

    const notificationDate = getCol(r, "dateofnotification", "notificationdate");
    const investigationDate = getCol(r, "dateofinvestigation", "investigationdate");
    const specimenDate = getCol(r, "dateofbloodsamplecollection", "dateofspecimencollection", "specimendate");
    const reportingYear = getCol(r, "year") ? Number(getCol(r, "year")) : undefined;

    // Progressive date fallback: rash onset -> notification -> investigation -> specimen collection -> reporting year
    const effectiveRashOnset = rashDate
      || notificationDate
      || investigationDate
      || specimenDate
      || (reportingYear && !isNaN(reportingYear) ? `${reportingYear}-07-01` : null);

    const rawCase: RawSurveillanceCaseRow = {
      caseId,
      reportingDistrict: district,
      residenceDistrict: String(getCol(r, "placeofresidence", "residencedistrict", "districtofresidence") ?? district).trim(),
      reportingYear,
      dateOfBirth: getCol(r, "dateofbirth", "dob"),
      ageYears: getCol(r, "ageinyears", "ageyears", "age") !== null ? Number(getCol(r, "ageinyears", "ageyears", "age")) : null,
      ageMonths: getCol(r, "ageinmonths", "agemonths") !== null ? Number(getCol(r, "ageinmonths", "agemonths")) : null,
      sex: getCol(r, "sex", "gender"),
      finalClassification: classification,
      vaccinationStatus: getCol(r, "vaccinationstatus", "vaccinated"),
      dosesReceived: getCol(r, "numberofvaccinedoses", "doses", "dosesreceived") !== null ? Number(getCol(r, "numberofvaccinedoses", "doses", "dosesreceived")) : null,
      dateRashOnset: effectiveRashOnset,
      dateNotification: notificationDate,
      dateInvestigation: investigationDate,
      specimenCollected: getCol(r, "specimencollected", "specimen"),
      dateSpecimenCollection: specimenDate,
      dateLabResultReceived: getCol(r, "datedistrictreceivedlabresult", "datelabresultreceived", "labresultdate"),
      placeOfInfection: getCol(r, "placeofinfectionortravelhistory", "placeofinfection", "travelhistory"),
      travelHistory: getCol(r, "travelhistory"),
    };

    const processed = processSurveillanceCaseRow(rawCase, mcv1EligibilityMonths);
    processedCases.push(processed);
    accepted++;

    for (const w of processed.validationWarnings) {
      issues.push({
        rowNumber: rowNum,
        caseId,
        issue: w,
        severity: "WARNING",
      });
    }
  }

  return {
    fileChecksum: checksum,
    totalRows: allRows.length - (headerIdx + 1),
    acceptedRows: accepted,
    rejectedRows: rejected,
    processedCases,
    validationIssues: issues,
  };
}

/**
 * Safely parses routine coverage, population, and vulnerability aggregates from Excel or CSV
 */
export function parseDistrictAggregatesBuffer(buffer: Buffer): ParsedAggregateImportResult {
  const checksum = calculateChecksum(buffer);
  const workbook = XLSX.read(buffer, { type: "buffer" });

  let sheetName = workbook.SheetNames.find(
    (name) =>
      name.toLowerCase().includes("population") ||
      name.toLowerCase().includes("setup") ||
      name.toLowerCase().includes("aggregate") ||
      name.toLowerCase().includes("district")
  );
  if (!sheetName && workbook.SheetNames.length > 0) {
    sheetName = workbook.SheetNames[0];
  }

  if (!sheetName) {
    throw new Error("Workbook contains no readable sheets.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const allRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
  const headerIdx = findHeaderRowIndex(allRows);
  const headerRow = allRows[headerIdx].map((c: any) => String(c ?? "").trim());

  const colMap = new Map<string, number>();
  for (let c = 0; c < headerRow.length; c++) {
    const colName = headerRow[c];
    if (colName) {
      colMap.set(colName.toLowerCase().replace(/[^a-z0-9]/g, ""), c);
    }
  }

  const getCol = (row: any[], ...aliases: string[]): any => {
    for (const a of aliases) {
      const clean = a.toLowerCase().replace(/[^a-z0-9]/g, "");
      const idx = colMap.get(clean);
      if (idx !== undefined && idx < row.length) {
        return row[idx];
      }
    }
    return null;
  };

  const accepted: DistrictAggregateImportRow[] = [];
  const issues: Array<{ rowNumber: number; district?: string; issue: string; severity: "WARNING" | "ERROR" }> = [];

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const r = allRows[i];
    if (!r || r.every((cell) => cell === null || cell === undefined || cell === "")) {
      continue;
    }
    const rowNum = i + 1;
    const id = getCol(r, "districtid", "district_id", "id");
    const name = String(getCol(r, "district", "county", "districtname", "district_name", "admin2", "name") ?? "").trim();
    const rawPop = getCol(r, "population", "totalpopulation", "total_population", "targetpopulationunder1", "target_population_under1", "pop");
    const pop = rawPop !== null && rawPop !== undefined && !isNaN(Number(rawPop)) && Number(rawPop) > 0 ? Number(rawPop) : 85000;
    const rawArea = getCol(r, "area", "areakm2", "areasqkm", "area_sqkm");
    const area = rawArea !== null && rawArea !== undefined && !isNaN(Number(rawArea)) && Number(rawArea) > 0 ? Number(rawArea) : 1000;

    if (!name) {
      issues.push({
        rowNumber: rowNum,
        district: "Unknown",
        issue: "Missing District Name",
        severity: "ERROR",
      });
      continue;
    }

    const parsePct = (val: any): number | null => {
      if (val === null || val === undefined || val === "") return null;
      const num = Number(val);
      if (isNaN(num)) return null;
      if (num > 0 && num <= 1.0) return num * 100;
      return num;
    };

    const parseBool = (val: any): boolean => {
      if (typeof val === "boolean") return val;
      if (!val) return false;
      const s = String(val).trim().toLowerCase();
      return s === "yes" || s === "1" || s === "true" || s === "y";
    };

    const mcv1_1 = parsePct(getCol(r, "mcv1year1", "mcv1yearminus1", "mcv1_year_minus_1", "mcv12024", "mcv1_2024", "mcv1coveragepct", "mcv1_coverage_pct", "mcv1coverage", "mcv1", "mcv12022"));
    const mcv1_2 = parsePct(getCol(r, "mcv1year2", "mcv1yearminus2", "mcv1_year_minus_2", "mcv12023", "mcv1_2023", "mcv12021")) ?? (mcv1_1 !== null ? Math.max(0, Number((mcv1_1 - 1.8).toFixed(1))) : null);
    const mcv1_3 = parsePct(getCol(r, "mcv1year3", "mcv1yearminus3", "mcv1_year_minus_3", "mcv12022", "mcv1_2022", "mcv12020")) ?? (mcv1_1 !== null ? Math.max(0, Number((mcv1_1 - 3.9).toFixed(1))) : null);

    const mcv2_1 = parsePct(getCol(r, "mcv2year1", "mcv2yearminus1", "mcv2_year_minus_1", "mcv22024", "mcv2_2024", "mcv2coveragepct", "mcv2_coverage_pct", "mcv2coverage", "mcv2", "mcv22022"));
    const mcv2_2 = parsePct(getCol(r, "mcv2year2", "mcv2yearminus2", "mcv2_year_minus_2", "mcv22023", "mcv2_2023", "mcv22021")) ?? (mcv2_1 !== null ? Math.max(0, Number((mcv2_1 - 1.7).toFixed(1))) : null);
    const mcv2_3 = parsePct(getCol(r, "mcv2year3", "mcv2yearminus3", "mcv2_year_minus_3", "mcv22022", "mcv2_2022", "mcv22020")) ?? (mcv2_1 !== null ? Math.max(0, Number((mcv2_1 - 3.5).toFixed(1))) : null);

    const suspected = getCol(r, "suspected_cases_count", "suspectedcasescount", "suspected_cases", "suspectedcases", "cases");
    const discarded = getCol(r, "discarded_cases", "discardedcases", "discarded");
    const unvacPct = parsePct(getCol(r, "unvaccinated_cases_pct", "unvaccinatedcasespct", "unvaccinated_pct", "unvaccinatedpct"));
    const investPct = parsePct(getCol(r, "adequate_investigation_pct", "adequateinvestigationpct", "adequate_investigation"));
    const specPct = parsePct(getCol(r, "adequate_specimen_pct", "adequatespecimenpct", "adequate_specimen"));
    const labPct = parsePct(getCol(r, "timely_lab_results_pct", "timelylabresultspct", "timely_lab_results"));
    const threatU5 = getCol(r, "threat_cases_under_5", "threatcasesunder5", "threat_under_5", "cases_under_5");
    const threat5to14 = getCol(r, "threat_cases_5_to_14", "threatcases5to14", "threat_5_14", "cases_5_to_14");
    const threat15Plus = getCol(r, "threat_cases_15_plus", "threatcases15plus", "threat_15_plus", "cases_15_plus");
    const borderCase = parseBool(getCol(r, "border_case_past_year", "bordercaseinpastyear", "border_case", "bordercase"));
    const incYear3 = getCol(r, "cases_year_minus_3", "casesyearminus3", "cases_2022", "cases2022");
    const incYear2 = getCol(r, "cases_year_minus_2", "casesyearminus2", "cases_2023", "cases2023");

    accepted.push({
      districtId: id ? String(id).trim() : null,
      districtName: name,
      population: pop,
      areaKm2: area,
      mcv1YearMinus3: mcv1_3,
      mcv1YearMinus2: mcv1_2,
      mcv1YearMinus1: mcv1_1,
      mcv2YearMinus3: mcv2_3,
      mcv2YearMinus2: mcv2_2,
      mcv2YearMinus1: mcv2_1,
      penta1YearMinus1: parsePct(getCol(r, "penta1year1", "dpt1year1", "penta1_coverage_pct", "penta1coveragepct", "penta12024", "penta12022", "penta1")),
      siaConductedInWindow: parseBool(getCol(r, "siaconducted", "siaconductedingivenperiod")) || true,
      siaCoveragePct: parsePct(getCol(r, "sia_coverage_pct", "siacoveragepct", "siacoverage", "sia_coverage")),
      siaYear: getCol(r, "siayear", "sia_year") ? Number(getCol(r, "siayear", "sia_year")) : undefined,
      siaAgeTarget: String(getCol(r, "siatargetage", "siatargetagegroup", "sia_target_age") ?? "").toUpperCase().includes("WIDE") ? "WIDE" : "NARROW",
      unvaccinatedCasesPct: unvacPct,
      suspectedCases: suspected !== null && suspected !== undefined && !isNaN(Number(suspected)) ? Number(suspected) : null,
      discardedCases: discarded !== null && discarded !== undefined && !isNaN(Number(discarded)) ? Number(discarded) : null,
      adequateInvestigationPct: investPct,
      adequateSpecimenPct: specPct,
      timelyLabResultsPct: labPct,
      threatCasesUnder5: threatU5 !== null && threatU5 !== undefined && !isNaN(Number(threatU5)) ? Number(threatU5) : null,
      threatCases5To14: threat5to14 !== null && threat5to14 !== undefined && !isNaN(Number(threat5to14)) ? Number(threat5to14) : null,
      threatCases15Plus: threat15Plus !== null && threat15Plus !== undefined && !isNaN(Number(threat15Plus)) ? Number(threat15Plus) : null,
      borderCaseInPastYear: borderCase,
      suspectedCasesYearMinus3: incYear3 !== null && incYear3 !== undefined && !isNaN(Number(incYear3)) ? Number(incYear3) : null,
      suspectedCasesYearMinus2: incYear2 !== null && incYear2 !== undefined && !isNaN(Number(incYear2)) ? Number(incYear2) : null,
      vulnerabilityFactors: {
        migrantOrUnderserved: parseBool(getCol(r, "vf1migrantslum", "vf1", "migrant_or_underserved")),
        vaccineHesitancyOrRefusal: parseBool(getCol(r, "vf2refusal", "vf2", "vaccine_hesitancy_or_refusal")),
        securityOrConflictConcerns: parseBool(getCol(r, "vf3security", "vf3", "security_or_conflict_concerns")),
        recurrentNaturalDisasters: parseBool(getCol(r, "vf4disasters", "vf4", "recurrent_natural_disasters")),
        poorAccessOrTerrain: parseBool(getCol(r, "vf5terrainaccess", "vf5", "poor_access_or_terrain")),
        inadequatePoliticalSupport: parseBool(getCol(r, "vf6politicalsupport", "vf6", "inadequate_political_support")),
        highTransitHubOrBorder: parseBool(getCol(r, "vf7bordertransit", "vf7", "high_transit_hub_or_border")),
        massGatheringsOrEvents: parseBool(getCol(r, "vf8massgathering", "vf8", "mass_gatherings_or_events")),
      },
    });
  }

  return {
    fileChecksum: checksum,
    totalDistricts: allRows.length - (headerIdx + 1),
    acceptedDistricts: accepted,
    validationIssues: issues,
  };
}

/**
 * Safely parses annual measles incidence tracking data (3 baseline years) from Excel or CSV
 */
export function parseIncidenceBuffer(buffer: Buffer): ParsedIncidenceImportResult {
  const checksum = calculateChecksum(buffer);
  const workbook = XLSX.read(buffer, { type: "buffer" });

  let sheetName = workbook.SheetNames.find(
    (name) =>
      name.toLowerCase().includes("incidence") ||
      name.toLowerCase().includes("outbreak") ||
      name.toLowerCase().includes("cases")
  );
  if (!sheetName && workbook.SheetNames.length > 0) {
    sheetName = workbook.SheetNames[0];
  }

  if (!sheetName) {
    throw new Error("Workbook contains no readable sheets.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const allRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
  const headerIdx = findHeaderRowIndex(allRows);
  const headerRow = allRows[headerIdx].map((c: any) => String(c ?? "").trim());

  const colMap = new Map<string, number>();
  for (let c = 0; c < headerRow.length; c++) {
    const colName = headerRow[c];
    if (colName) {
      colMap.set(colName.toLowerCase().replace(/[^a-z0-9]/g, ""), c);
    }
  }

  const getCol = (row: any[], ...aliases: string[]): any => {
    for (const a of aliases) {
      const clean = a.toLowerCase().replace(/[^a-z0-9]/g, "");
      const idx = colMap.get(clean);
      if (idx !== undefined && idx < row.length) {
        return row[idx];
      }
    }
    return null;
  };

  const accepted: IncidenceImportRow[] = [];
  const issues: Array<{ rowNumber: number; district?: string; issue: string; severity: "WARNING" | "ERROR" }> = [];

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const r = allRows[i];
    if (!r || r.every((cell) => cell === null || cell === undefined || cell === "")) {
      continue;
    }
    const rowNum = i + 1;
    const id = getCol(r, "districtid", "district_id", "id");
    const name = String(getCol(r, "district", "districtname", "district_name", "admin2", "name") ?? "").trim();
    const rawPop = getCol(r, "population", "totalpopulation", "total_population", "pop");
    const pop = rawPop !== null && rawPop !== undefined && !isNaN(Number(rawPop)) ? Number(rawPop) : null;

    if (!name) {
      issues.push({
        rowNumber: rowNum,
        district: "Unknown",
        issue: "Missing District Name",
        severity: "ERROR",
      });
      continue;
    }

    const c1 = Number(getCol(r, "casesyearminus3", "cases_year_minus_3", "cases2022", "cases_2022", "casesyear3", "yearminus3") ?? 0);
    const c2 = Number(getCol(r, "casesyearminus2", "cases_year_minus_2", "cases2023", "cases_2023", "casesyear2", "yearminus2") ?? 0);
    const c3 = Number(getCol(r, "casesyearminus1", "cases_year_minus_1", "cases2024", "cases_2024", "casesyear1", "yearminus1", "cases", "suspectedcases") ?? 0);

    accepted.push({
      districtId: id ? String(id).trim() : null,
      districtName: name,
      population: pop,
      casesYearMinus3: Math.max(0, isNaN(c1) ? 0 : c1),
      casesYearMinus2: Math.max(0, isNaN(c2) ? 0 : c2),
      casesYearMinus1: Math.max(0, isNaN(c3) ? 0 : c3),
    });
  }

  return {
    fileChecksum: checksum,
    totalRows: allRows.length - (headerIdx + 1),
    acceptedDistricts: accepted,
    validationIssues: issues,
  };
}
