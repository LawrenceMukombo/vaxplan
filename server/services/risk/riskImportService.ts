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

    const rawCase: RawSurveillanceCaseRow = {
      caseId,
      reportingDistrict: district,
      residenceDistrict: String(getCol(r, "placeofresidence", "residencedistrict", "districtofresidence") ?? district).trim(),
      reportingYear: getCol(r, "year") ? Number(getCol(r, "year")) : undefined,
      dateOfBirth: getCol(r, "dateofbirth", "dob"),
      ageYears: getCol(r, "ageinyears", "ageyears", "age") !== null ? Number(getCol(r, "ageinyears", "ageyears", "age")) : null,
      ageMonths: getCol(r, "ageinmonths", "agemonths") !== null ? Number(getCol(r, "ageinmonths", "agemonths")) : null,
      sex: getCol(r, "sex", "gender"),
      finalClassification: classification,
      vaccinationStatus: getCol(r, "vaccinationstatus", "vaccinated"),
      dosesReceived: getCol(r, "numberofvaccinedoses", "doses", "dosesreceived") !== null ? Number(getCol(r, "numberofvaccinedoses", "doses", "dosesreceived")) : null,
      dateRashOnset: rashDate || new Date(),
      dateNotification: getCol(r, "dateofnotification", "notificationdate"),
      dateInvestigation: getCol(r, "dateofinvestigation", "investigationdate"),
      specimenCollected: getCol(r, "specimencollected", "specimen"),
      dateSpecimenCollection: getCol(r, "dateofbloodsamplecollection", "dateofspecimencollection", "specimendate"),
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
    const name = String(getCol(r, "district", "county", "districtname", "admin2") ?? "").trim();
    const pop = Number(getCol(r, "population", "totalpopulation") ?? 0);
    const area = Number(getCol(r, "area", "areakm2", "areasqkm") ?? 0);

    if (!name || pop <= 0 || area <= 0) {
      issues.push({
        rowNumber: rowNum,
        district: name,
        issue: "Invalid or missing District Name, Population (<= 0), or Area in sq km (<= 0)",
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

    accepted.push({
      districtName: name,
      population: pop,
      areaKm2: area,
      mcv1YearMinus3: parsePct(getCol(r, "mcv1year3", "mcv1yearminus3", "mcv12020")),
      mcv1YearMinus2: parsePct(getCol(r, "mcv1year2", "mcv1yearminus2", "mcv12021")),
      mcv1YearMinus1: parsePct(getCol(r, "mcv1year1", "mcv1yearminus1", "mcv12022")),
      mcv2YearMinus3: parsePct(getCol(r, "mcv2year3", "mcv2yearminus3", "mcv22020")),
      mcv2YearMinus2: parsePct(getCol(r, "mcv2year2", "mcv2yearminus2", "mcv22021")),
      mcv2YearMinus1: parsePct(getCol(r, "mcv2year1", "mcv2yearminus1", "mcv22022")),
      penta1YearMinus1: parsePct(getCol(r, "penta1year1", "dpt1year1", "penta12022")),
      siaConductedInWindow: parseBool(getCol(r, "siaconducted", "siaconductedingivenperiod")),
      siaCoveragePct: parsePct(getCol(r, "siacoverage", "siacoveragepct")),
      siaYear: getCol(r, "siayear") ? Number(getCol(r, "siayear")) : undefined,
      siaAgeTarget: String(getCol(r, "siatargetage", "siatargetagegroup") ?? "").toUpperCase().includes("WIDE") ? "WIDE" : "NARROW",
      vulnerabilityFactors: {
        migrantOrUnderserved: parseBool(getCol(r, "vf1migrantslum", "vf1")),
        vaccineHesitancyOrRefusal: parseBool(getCol(r, "vf2refusal", "vf2")),
        securityOrConflictConcerns: parseBool(getCol(r, "vf3security", "vf3")),
        recurrentNaturalDisasters: parseBool(getCol(r, "vf4disasters", "vf4")),
        poorAccessOrTerrain: parseBool(getCol(r, "vf5terrainaccess", "vf5")),
        inadequatePoliticalSupport: parseBool(getCol(r, "vf6politicalsupport", "vf6")),
        highTransitHubOrBorder: parseBool(getCol(r, "vf7bordertransit", "vf7")),
        massGatheringsOrEvents: parseBool(getCol(r, "vf8massgathering", "vf8")),
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
