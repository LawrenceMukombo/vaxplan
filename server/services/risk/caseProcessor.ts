/**
 * Case Linelist Processing & Surveillance Aggregation Service
 * Package: WHO_MEASLES_GLOBAL_RECONCILED_V1
 * 
 * Responsibilities:
 * 1. Canonical case classification mapping & threat qualification
 * 2. Exact age calculation (DOB vs Years/Months) & age-band partitioning (<5, 5-14, 15+)
 * 3. Vaccination status normalization & MCV1 eligibility evaluation
 * 4. 10 core investigation concepts completeness check
 * 5. Timeliness validation (<= 48h investigation, 0-28d specimen, <= 10d lab result)
 * 6. District-year aggregation for scoring engine ingestion
 */

export type CanonicalCaseClassification =
  | "LAB_CONFIRMED_MEASLES"
  | "EPI_LINKED_MEASLES"
  | "CLINICALLY_COMPATIBLE_MEASLES"
  | "DISCARDED_NON_MEASLES"
  | "CONFIRMED_RUBELLA"
  | "PENDING"
  | "UNCLASSIFIED";

export type NormalizedVaccinationStatus =
  | "VACCINATED"
  | "UNVACCINATED"
  | "UNKNOWN"
  | "NOT_RECORDED"
  | "CONFLICTING";

export interface RawSurveillanceCaseRow {
  caseId: string;
  reportingDistrict: string;
  residenceDistrict?: string;
  reportingYear?: number;
  dateOfBirth?: string | Date | null;
  ageYears?: number | null;
  ageMonths?: number | null;
  ageDays?: number | null;
  sex?: string | null;
  finalClassification: string;
  vaccinationStatus?: string | null;
  dosesReceived?: number | null;
  dateOfLastVaccination?: string | Date | null;
  dateRashOnset: string | Date;
  dateNotification?: string | Date | null;
  dateInvestigation?: string | Date | null;
  specimenCollected?: boolean | string | null;
  dateSpecimenCollection?: string | Date | null;
  dateLabResultReceived?: string | Date | null;
  placeOfInfection?: string | null;
  travelHistory?: string | null;
}

export interface ProcessedCaseRecord {
  caseId: string;
  assignedDistrict: string;
  calendarYear: number;
  canonicalClassification: CanonicalCaseClassification;
  isThreatCase: boolean; // Lab Confirmed + Epi Linked + Clinically Compatible
  isDiscarded: boolean;
  isEpiLinked: boolean;
  ageMonths: number | null;
  ageBand: "<5" | "5-14" | "15+" | "UNKNOWN";
  isMcv1Eligible: boolean;
  normalizedVaccinationStatus: NormalizedVaccinationStatus;
  isEligibleUnvaccinatedOrUnknown: boolean;
  isAdequateInvestigation: boolean;
  isAdequateSpecimen: boolean;
  isTimelyLabResult: boolean;
  hasSpecimen: boolean;
  coreFieldsCompleteCount: number;
  validationWarnings: string[];
  dateRashOnset?: string | null;
  rawVaccinationStatus?: string | null;
  dosesReceived?: number | null;
  dateNotification?: string | null;
  dateInvestigation?: string | null;
  dateBloodSample?: string | null;
  dateLabResult?: string | null;
  sex?: string | null;
  placeOfResidence?: string | null;
  placeOfInfection?: string | null;
}

export interface DistrictSurveillanceAggregate {
  district: string;
  year: number;
  suspectedCases: number;
  discardedCases: number;
  adequatelyInvestigatedCases: number;
  epiLinkedCases: number;
  adequateSpecimensNonEpiLinked: number;
  casesWithSpecimensCollected: number;
  timelyLaboratoryResults: number;
  threatCasesUnder5: number;
  threatCasesAge5To14: number;
  threatCasesAge15Plus: number;
  threatCasesUnknownAge: number;
  totalThreatCases: number;
  eligibleSuspectedCases: number;
  eligibleUnvaccinatedOrUnknown: number;
}

/**
 * Normalizes text and maps raw classification strings to canonical states
 */
export function mapClassification(raw: string): CanonicalCaseClassification {
  if (!raw) return "UNCLASSIFIED";
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  if (cleaned.includes("labconfirmed") || cleaned.includes("confirmedlab") || cleaned === "confirmedbylab") {
    return "LAB_CONFIRMED_MEASLES";
  }
  if (cleaned.includes("epilinked") || cleaned.includes("epidemiologicallylinked") || cleaned.includes("epidemiological")) {
    return "EPI_LINKED_MEASLES";
  }
  if (cleaned.includes("clinical") || cleaned.includes("compatible")) {
    return "CLINICALLY_COMPATIBLE_MEASLES";
  }
  if (cleaned.includes("discarded") || cleaned.includes("nonmeasles") || cleaned === "notmeasles") {
    return "DISCARDED_NON_MEASLES";
  }
  if (cleaned.includes("rubella")) {
    return "CONFIRMED_RUBELLA";
  }
  if (cleaned.includes("pending") || cleaned.includes("awaiting")) {
    return "PENDING";
  }
  return "UNCLASSIFIED";
}

/**
 * Normalizes vaccination status strings into standardized states
 */
export function normalizeVaccinationStatus(
  statusStr?: string | null,
  doses?: number | null
): NormalizedVaccinationStatus {
  if (doses !== undefined && doses !== null) {
    if (doses > 0) return "VACCINATED";
    if (doses === 0) return "UNVACCINATED";
  }

  if (!statusStr) return "NOT_RECORDED";
  const cleaned = statusStr.trim().toLowerCase();

  if (cleaned === "yes" || cleaned === "vaccinated" || cleaned.includes("dose")) {
    return "VACCINATED";
  }
  if (cleaned === "no" || cleaned === "unvaccinated" || cleaned === "zero") {
    return "UNVACCINATED";
  }
  if (cleaned === "unknown" || cleaned === "don't know" || cleaned === "uncertain") {
    return "UNKNOWN";
  }
  return "NOT_RECORDED";
}

/**
 * Calculates calendar day differences between two dates (date2 - date1 in days)
 */
export function diffDays(d1?: string | Date | null, d2?: string | Date | null): number | null {
  if (!d1 || !d2) return null;
  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  if (isNaN(t1) || isNaN(t2)) return null;
  return (t2 - t1) / (1000 * 60 * 60 * 24);
}

/**
 * Processes a single raw case row into standardized attributes and flags
 */
export function processSurveillanceCaseRow(
  row: RawSurveillanceCaseRow,
  mcv1EligibilityAgeMonths: number = 9
): ProcessedCaseRecord {
  const warnings: string[] = [];
  const assignedDistrict = (row.reportingDistrict || row.residenceDistrict || "UNKNOWN").trim();

  // 1. Year determination
  let calendarYear = row.reportingYear;
  if (!calendarYear && row.dateRashOnset) {
    const d = new Date(row.dateRashOnset);
    if (!isNaN(d.getTime())) calendarYear = d.getFullYear();
  }
  if (!calendarYear) {
    calendarYear = new Date().getFullYear();
    warnings.push("Missing reporting year and rash onset year; defaulted to current year");
  }

  // 2. Classification
  const canonicalClassification = mapClassification(row.finalClassification);
  const isThreatCase =
    canonicalClassification === "LAB_CONFIRMED_MEASLES" ||
    canonicalClassification === "EPI_LINKED_MEASLES" ||
    canonicalClassification === "CLINICALLY_COMPATIBLE_MEASLES";
  const isDiscarded = canonicalClassification === "DISCARDED_NON_MEASLES";
  const isEpiLinked = canonicalClassification === "EPI_LINKED_MEASLES";

  // 3. Age in months calculation
  let ageMonths: number | null = null;
  if (row.dateOfBirth && row.dateRashOnset) {
    const dob = new Date(row.dateOfBirth);
    const rash = new Date(row.dateRashOnset);
    if (!isNaN(dob.getTime()) && !isNaN(rash.getTime())) {
      const diffMs = rash.getTime() - dob.getTime();
      if (diffMs < 0) {
        warnings.push("Rash onset date is before Date of Birth (negative age)");
      } else {
        ageMonths = diffMs / (1000 * 60 * 60 * 24 * 30.4375); // average month length
      }
    }
  }

  if (ageMonths === null) {
    if (row.ageYears !== undefined && row.ageYears !== null) {
      ageMonths = (row.ageYears * 12) + (row.ageMonths ?? 0);
    } else if (row.ageMonths !== undefined && row.ageMonths !== null) {
      ageMonths = row.ageMonths;
    } else if (row.ageDays !== undefined && row.ageDays !== null) {
      ageMonths = row.ageDays / 30.4375;
    }
  }

  // Age band assignment: <5 (<60m), 5-14 (60 to <180m), 15+ (>=180m)
  let ageBand: "<5" | "5-14" | "15+" | "UNKNOWN" = "UNKNOWN";
  if (ageMonths !== null) {
    if (ageMonths < 60) ageBand = "<5";
    else if (ageMonths < 180) ageBand = "5-14";
    else ageBand = "15+";
  }

  // 4. MCV1 schedule eligibility
  const isMcv1Eligible = ageMonths !== null && ageMonths >= mcv1EligibilityAgeMonths;

  // 5. Vaccination status normalization
  const normalizedVaccinationStatus = normalizeVaccinationStatus(row.vaccinationStatus, row.dosesReceived);
  const isEligibleUnvaccinatedOrUnknown =
    isMcv1Eligible &&
    (normalizedVaccinationStatus === "UNVACCINATED" ||
      normalizedVaccinationStatus === "UNKNOWN" ||
      normalizedVaccinationStatus === "NOT_RECORDED");

  // 6. Completeness of 10 core investigation fields
  let coreCount = 0;
  if (row.caseId) coreCount++;
  if (ageMonths !== null) coreCount++;
  if (row.sex) coreCount++;
  if (row.residenceDistrict || row.reportingDistrict) coreCount++;
  if (row.vaccinationStatus || row.dosesReceived !== undefined) coreCount++;
  if (row.dateRashOnset) coreCount++;
  if (row.dateNotification) coreCount++;
  if (row.dateInvestigation) coreCount++;
  if (row.dateSpecimenCollection || row.specimenCollected) coreCount++;
  if (row.placeOfInfection || row.travelHistory) coreCount++;

  // 7. Adequate investigation:
  // Requires core fields complete and investigated within 2 calendar days (<= 48h) of notification
  const investDays = diffDays(row.dateNotification, row.dateInvestigation);
  let isAdequateInvestigation = false;
  if (investDays !== null) {
    if (investDays < 0) {
      warnings.push("Investigation date is before notification date (negative interval)");
    } else if (investDays <= 2 && coreCount >= 8) {
      isAdequateInvestigation = true;
    }
  }

  // 8. Adequate specimen:
  // Valid specimen collected from 0 through 28 days after rash onset (exclude epi-linked)
  const specimenDays = diffDays(row.dateRashOnset, row.dateSpecimenCollection);
  let isAdequateSpecimen = false;
  const hasSpecimen = Boolean(
    row.dateSpecimenCollection ||
    (typeof row.specimenCollected === "boolean" && row.specimenCollected) ||
    (typeof row.specimenCollected === "string" && row.specimenCollected.toLowerCase() === "yes")
  );

  if (hasSpecimen && specimenDays !== null) {
    if (specimenDays < 0) {
      warnings.push("Specimen collection date is before rash onset date (negative interval)");
    } else if (specimenDays <= 28) {
      isAdequateSpecimen = true;
    }
  }

  // 9. Timely laboratory result:
  // Result received within 0 through 10 days of specimen collection
  const labDays = diffDays(row.dateSpecimenCollection, row.dateLabResultReceived);
  let isTimelyLabResult = false;
  if (hasSpecimen && labDays !== null) {
    if (labDays < 0) {
      warnings.push("Lab result date is before specimen collection date (negative interval)");
    } else if (labDays <= 10) {
      isTimelyLabResult = true;
    }
  }

  return {
    caseId: row.caseId,
    assignedDistrict,
    calendarYear,
    canonicalClassification,
    isThreatCase,
    isDiscarded,
    isEpiLinked,
    ageMonths,
    ageBand,
    isMcv1Eligible,
    normalizedVaccinationStatus,
    isEligibleUnvaccinatedOrUnknown,
    isAdequateInvestigation,
    isAdequateSpecimen,
    isTimelyLabResult,
    hasSpecimen,
    coreFieldsCompleteCount: coreCount,
    validationWarnings: warnings,
    dateRashOnset: row.dateRashOnset ? String(row.dateRashOnset) : null,
    rawVaccinationStatus: row.vaccinationStatus ? String(row.vaccinationStatus) : null,
    dosesReceived: row.dosesReceived ?? null,
    dateNotification: row.dateNotification ? String(row.dateNotification) : null,
    dateInvestigation: row.dateInvestigation ? String(row.dateInvestigation) : null,
    dateBloodSample: row.dateSpecimenCollection ? String(row.dateSpecimenCollection) : null,
    dateLabResult: row.dateLabResultReceived ? String(row.dateLabResultReceived) : null,
    sex: row.sex ? String(row.sex) : null,
    placeOfResidence: row.residenceDistrict ? String(row.residenceDistrict) : null,
    placeOfInfection: row.placeOfInfection ? String(row.placeOfInfection) : (row.travelHistory ? String(row.travelHistory) : null),
  };
}

/**
 * Aggregates a batch of processed cases by district and year
 */
export function aggregateCasesByDistrictAndYear(
  processedCases: ProcessedCaseRecord[]
): Map<string, DistrictSurveillanceAggregate> {
  const map = new Map<string, DistrictSurveillanceAggregate>();

  for (const c of processedCases) {
    const key = `${c.assignedDistrict}__${c.calendarYear}`;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        district: c.assignedDistrict,
        year: c.calendarYear,
        suspectedCases: 0,
        discardedCases: 0,
        adequatelyInvestigatedCases: 0,
        epiLinkedCases: 0,
        adequateSpecimensNonEpiLinked: 0,
        casesWithSpecimensCollected: 0,
        timelyLaboratoryResults: 0,
        threatCasesUnder5: 0,
        threatCasesAge5To14: 0,
        threatCasesAge15Plus: 0,
        threatCasesUnknownAge: 0,
        totalThreatCases: 0,
        eligibleSuspectedCases: 0,
        eligibleUnvaccinatedOrUnknown: 0,
      };
      map.set(key, agg);
    }

    // Suspected cases count
    agg.suspectedCases++;

    if (c.isDiscarded) {
      agg.discardedCases++;
    }

    if (c.isAdequateInvestigation) {
      agg.adequatelyInvestigatedCases++;
    }

    if (c.isEpiLinked) {
      agg.epiLinkedCases++;
    }

    if (c.hasSpecimen) {
      agg.casesWithSpecimensCollected++;
      if (c.isTimelyLabResult) {
        agg.timelyLaboratoryResults++;
      }
    }

    if (!c.isEpiLinked && c.isAdequateSpecimen) {
      agg.adequateSpecimensNonEpiLinked++;
    }

    // Threat cases
    if (c.isThreatCase) {
      agg.totalThreatCases++;
      if (c.ageBand === "<5") agg.threatCasesUnder5++;
      else if (c.ageBand === "5-14") agg.threatCasesAge5To14++;
      else if (c.ageBand === "15+") agg.threatCasesAge15Plus++;
      else agg.threatCasesUnknownAge++;
    }

    // PI7 pooled eligibility
    if (c.isMcv1Eligible) {
      agg.eligibleSuspectedCases++;
      if (c.isEligibleUnvaccinatedOrUnknown) {
        agg.eligibleUnvaccinatedOrUnknown++;
      }
    }
  }

  return map;
}
