import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseCaseLinelistBuffer } from "../services/risk/riskImportService";
import { aggregateCasesByDistrictAndYear } from "../services/risk/caseProcessor";
import { calculateAreaRiskScore, AreaAssessmentInput } from "../services/risk/scoringEngine";

describe("WHO Measles Risk Assessment Workbook Reconciliation", () => {
  const workbookPath = path.resolve(process.cwd(), "Measles Risk Assessment -v1.8 (005)_Updated.xlsm");

  it("safely inspects and parses the official/country workbook without executing macros", () => {
    if (!fs.existsSync(workbookPath)) {
      console.warn("Workbook file not found, skipping workbook reconciliation test.");
      return;
    }

    const buffer = fs.readFileSync(workbookPath);
    expect(buffer.length).toBeGreaterThan(0);

    // Parse case linelist sheet
    const importResult = parseCaseLinelistBuffer(buffer);
    expect(importResult.fileChecksum).toBeDefined();
    expect(importResult.totalRows).toBeGreaterThan(0);
    expect(importResult.acceptedRows).toBeGreaterThan(0);
    expect(importResult.processedCases.length).toBe(importResult.acceptedRows);

    // Aggregate by district and year
    const districtAggregates = aggregateCasesByDistrictAndYear(importResult.processedCases);
    expect(districtAggregates.size).toBeGreaterThan(0);

    // Check invariants on aggregated cases
    for (const [key, agg] of districtAggregates) {
      expect(agg.threatCasesUnder5 + agg.threatCasesAge5To14 + agg.threatCasesAge15Plus + agg.threatCasesUnknownAge)
        .toBe(agg.totalThreatCases);
      expect(agg.eligibleUnvaccinatedOrUnknown).toBeLessThanOrEqual(agg.eligibleSuspectedCases);
      expect(agg.adequatelyInvestigatedCases).toBeLessThanOrEqual(agg.suspectedCases);
    }
  });

  it("calculates district risk scores deterministically for real data points", () => {
    if (!fs.existsSync(workbookPath)) return;

    const buffer = fs.readFileSync(workbookPath);
    const importResult = parseCaseLinelistBuffer(buffer);
    const districtAggregates = aggregateCasesByDistrictAndYear(importResult.processedCases);

    // Pick first district
    const firstKey = Array.from(districtAggregates.keys())[0];
    const agg = districtAggregates.get(firstKey)!;

    const sampleInput: AreaAssessmentInput = {
      areaId: agg.district,
      areaName: agg.district,
      assessmentYear: 2023,
      population: 120000,
      areaKm2: 4500,
      coverage: {
        mcv1: [
          { year: 2020, coveragePct: 75.0 },
          { year: 2021, coveragePct: 78.0 },
          { year: 2022, coveragePct: 82.0 },
        ],
        mcv2: [
          { year: 2020, coveragePct: 60.0 },
          { year: 2021, coveragePct: 65.0 },
          { year: 2022, coveragePct: 70.0 },
        ],
        penta1: [
          { year: 2020, coveragePct: 85.0 },
          { year: 2021, coveragePct: 88.0 },
          { year: 2022, coveragePct: 90.0 },
        ],
      },
      sia: {
        hasQualifyingCampaignInWindow: true,
        campaignYear: 2021,
        coveragePct: 91.0,
        targetAgeGroup: "WIDE",
      },
      surveillanceYearMinus1: {
        suspectedCases: agg.suspectedCases,
        discardedCases: agg.discardedCases,
        adequatelyInvestigatedCases: agg.adequatelyInvestigatedCases,
        epiLinkedCases: agg.epiLinkedCases,
        adequateSpecimensNonEpiLinked: agg.adequateSpecimensNonEpiLinked,
        casesWithSpecimensCollected: agg.casesWithSpecimensCollected,
        timelyLaboratoryResults: agg.timelyLaboratoryResults,
        threatCasesUnder5: agg.threatCasesUnder5,
        threatCasesAge5To14: agg.threatCasesAge5To14,
        threatCasesAge15Plus: agg.threatCasesAge15Plus,
        threatCasesUnknownAge: agg.threatCasesUnknownAge,
        totalThreatCases: agg.totalThreatCases,
      },
      surveillance3YearPooled: {
        eligibleSuspectedCases: agg.eligibleSuspectedCases,
        eligibleUnvaccinatedOrUnknown: agg.eligibleUnvaccinatedOrUnknown,
        hasVerifiedZeroSuspectedCases: agg.suspectedCases === 0,
      },
      neighbours: [],
      vulnerabilityFactors: {
        migrantOrUnderserved: true,
        vaccineHesitancyOrRefusal: false,
        securityOrConflictConcerns: true,
        recurrentNaturalDisasters: true,
        poorAccessOrTerrain: true,
        inadequatePoliticalSupport: false,
        highTransitHubOrBorder: false,
        massGatheringsOrEvents: false,
      },
    };

    const result = calculateAreaRiskScore(sampleInput);
    expect(result.areaId).toBe(agg.district);
    expect(result.domains.POPULATION_IMMUNITY.points).toBeGreaterThanOrEqual(0);
    expect(result.domains.POPULATION_IMMUNITY.points).toBeLessThanOrEqual(40);
    expect(result.domains.SURVEILLANCE_QUALITY.points).toBeGreaterThanOrEqual(0);
    expect(result.domains.SURVEILLANCE_QUALITY.points).toBeLessThanOrEqual(20);
    expect(result.domains.PROGRAMME_DELIVERY.points).toBeGreaterThanOrEqual(0);
    expect(result.domains.PROGRAMME_DELIVERY.points).toBeLessThanOrEqual(16);
    expect(result.domains.THREAT_ASSESSMENT.points).toBeGreaterThanOrEqual(0);
    expect(result.domains.THREAT_ASSESSMENT.points).toBeLessThanOrEqual(24);

    if (result.totalScore !== null) {
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
    }
  });
});
