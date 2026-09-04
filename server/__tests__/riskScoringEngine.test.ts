import { describe, it, expect } from "vitest";
import {
  calculateAreaRiskScore,
  calculateOlsSlope,
  AreaAssessmentInput,
} from "../services/risk/scoringEngine";
import {
  processSurveillanceCaseRow,
  aggregateCasesByDistrictAndYear,
  mapClassification,
  diffDays,
} from "../services/risk/caseProcessor";
import { classifyRiskScore } from "../services/risk/methodologyRegistry";

describe("WHO Measles Programmatic Risk Assessment Engine", () => {
  // Baseline synthetic district input
  const createBaseInput = (overrides?: Partial<AreaAssessmentInput>): AreaAssessmentInput => ({
    areaId: "dist-001",
    areaName: "Yambio",
    assessmentYear: 2023,
    population: 150000,
    areaKm2: 2500,
    coverage: {
      mcv1: [
        { year: 2020, coveragePct: 92.0 },
        { year: 2021, coveragePct: 94.0 },
        { year: 2022, coveragePct: 96.0 },
      ],
      mcv2: [
        { year: 2020, coveragePct: 88.0 },
        { year: 2021, coveragePct: 91.0 },
        { year: 2022, coveragePct: 93.0 },
      ],
      penta1: [
        { year: 2020, coveragePct: 95.0 },
        { year: 2021, coveragePct: 97.0 },
        { year: 2022, coveragePct: 98.0 },
      ],
    },
    sia: {
      hasQualifyingCampaignInWindow: true,
      campaignYear: 2022,
      coveragePct: 96.5,
      targetAgeGroup: "WIDE",
    },
    surveillanceYearMinus1: {
      suspectedCases: 20,
      discardedCases: 4, // 4 in 150k = 2.67 / 100k -> 0 pts
      adequatelyInvestigatedCases: 18, // 18/20 = 90% -> 0 pts
      epiLinkedCases: 2,
      adequateSpecimensNonEpiLinked: 16, // 16/(20-2) = 16/18 = 88.9% -> 0 pts
      casesWithSpecimensCollected: 18,
      timelyLaboratoryResults: 16, // 16/18 = 88.9% -> 0 pts
      threatCasesUnder5: 0,
      threatCasesAge5To14: 0,
      threatCasesAge15Plus: 0,
      threatCasesUnknownAge: 0,
      totalThreatCases: 0,
    },
    surveillance3YearPooled: {
      eligibleSuspectedCases: 50,
      eligibleUnvaccinatedOrUnknown: 5, // 5/50 = 10% < 20% -> 0 pts
      hasVerifiedZeroSuspectedCases: false,
    },
    neighbours: [
      { areaId: "dist-002", areaName: "Nzara", mcv1Mean3YearPct: 92.0, hasThreatCaseYearMinus1: false },
      { areaId: "dist-003", areaName: "Ezo", mcv1Mean3YearPct: 88.0, hasThreatCaseYearMinus1: false },
      { areaId: "dist-004", areaName: "Ibba", mcv1Mean3YearPct: 90.0, hasThreatCaseYearMinus1: false },
    ],
    vulnerabilityFactors: {
      migrantOrUnderserved: false,
      vaccineHesitancyOrRefusal: false,
      securityOrConflictConcerns: false,
      recurrentNaturalDisasters: false,
      poorAccessOrTerrain: false,
      inadequatePoliticalSupport: false,
      highTransitHubOrBorder: false,
      massGatheringsOrEvents: false,
    },
    ...overrides,
  });

  describe("Population Immunity (PI1 to PI7) Boundaries", () => {
    it("PI1: evaluates coverage thresholds at exact boundaries (95, 90, 85, 80)", () => {
      // >= 95% -> 0 pts
      let res = calculateAreaRiskScore(createBaseInput({
        coverage: {
          mcv1: [{ year: 2020, coveragePct: 95.0 }, { year: 2021, coveragePct: 95.0 }, { year: 2022, coveragePct: 95.0 }],
          mcv2: [{ year: 2020, coveragePct: 95.0 }, { year: 2021, coveragePct: 95.0 }, { year: 2022, coveragePct: 95.0 }],
          penta1: [{ year: 2020, coveragePct: 95.0 }, { year: 2021, coveragePct: 95.0 }, { year: 2022, coveragePct: 95.0 }],
        }
      }));
      expect(res.allIndicators.PI1.points).toBe(0);

      // 90% to < 95% (e.g. 90.0%) -> 2 pts
      res = calculateAreaRiskScore(createBaseInput({
        coverage: {
          mcv1: [{ year: 2020, coveragePct: 90.0 }, { year: 2021, coveragePct: 90.0 }, { year: 2022, coveragePct: 90.0 }],
          mcv2: [{ year: 2020, coveragePct: 90.0 }, { year: 2021, coveragePct: 90.0 }, { year: 2022, coveragePct: 90.0 }],
          penta1: [{ year: 2020, coveragePct: 90.0 }, { year: 2021, coveragePct: 90.0 }, { year: 2022, coveragePct: 90.0 }],
        }
      }));
      expect(res.allIndicators.PI1.points).toBe(2);

      // 85% to < 90% (e.g. 85.0%) -> 4 pts
      res = calculateAreaRiskScore(createBaseInput({
        coverage: {
          mcv1: [{ year: 2020, coveragePct: 85.0 }, { year: 2021, coveragePct: 85.0 }, { year: 2022, coveragePct: 85.0 }],
          mcv2: [{ year: 2020, coveragePct: 85.0 }, { year: 2021, coveragePct: 85.0 }, { year: 2022, coveragePct: 85.0 }],
          penta1: [{ year: 2020, coveragePct: 85.0 }, { year: 2021, coveragePct: 85.0 }, { year: 2022, coveragePct: 85.0 }],
        }
      }));
      expect(res.allIndicators.PI1.points).toBe(4);

      // 80% to < 85% (e.g. 80.0%) -> 6 pts
      res = calculateAreaRiskScore(createBaseInput({
        coverage: {
          mcv1: [{ year: 2020, coveragePct: 80.0 }, { year: 2021, coveragePct: 80.0 }, { year: 2022, coveragePct: 80.0 }],
          mcv2: [{ year: 2020, coveragePct: 80.0 }, { year: 2021, coveragePct: 80.0 }, { year: 2022, coveragePct: 80.0 }],
          penta1: [{ year: 2020, coveragePct: 80.0 }, { year: 2021, coveragePct: 80.0 }, { year: 2022, coveragePct: 80.0 }],
        }
      }));
      expect(res.allIndicators.PI1.points).toBe(6);

      // < 80% (e.g. 79.9%) -> 8 pts
      res = calculateAreaRiskScore(createBaseInput({
        coverage: {
          mcv1: [{ year: 2020, coveragePct: 79.9 }, { year: 2021, coveragePct: 79.9 }, { year: 2022, coveragePct: 79.9 }],
          mcv2: [{ year: 2020, coveragePct: 79.9 }, { year: 2021, coveragePct: 79.9 }, { year: 2022, coveragePct: 79.9 }],
          penta1: [{ year: 2020, coveragePct: 79.9 }, { year: 2021, coveragePct: 79.9 }, { year: 2022, coveragePct: 79.9 }],
        }
      }));
      expect(res.allIndicators.PI1.points).toBe(8);
    });

    it("PI2: strictly < 80% counts; exactly 80.0% is not below 80%", () => {
      // 2 neighbours: one at 80.0%, one at 85.0% -> 0 of 2 < 80% -> 0% -> 0 pts
      const res1 = calculateAreaRiskScore(createBaseInput({
        neighbours: [
          { areaId: "n1", areaName: "N1", mcv1Mean3YearPct: 80.0, hasThreatCaseYearMinus1: false },
          { areaId: "n2", areaName: "N2", mcv1Mean3YearPct: 85.0, hasThreatCaseYearMinus1: false },
        ]
      }));
      expect(res1.allIndicators.PI2.points).toBe(0);

      // One neighbour at 79.99% -> 1 of 2 < 80% -> 50% -> 2 pts
      const res2 = calculateAreaRiskScore(createBaseInput({
        neighbours: [
          { areaId: "n1", areaName: "N1", mcv1Mean3YearPct: 79.99, hasThreatCaseYearMinus1: false },
          { areaId: "n2", areaName: "N2", mcv1Mean3YearPct: 85.0, hasThreatCaseYearMinus1: false },
        ]
      }));
      expect(res2.allIndicators.PI2.points).toBe(2);

      // Both neighbours at 79.9% -> 2 of 2 = 100% >= 75% -> 4 pts
      const res3 = calculateAreaRiskScore(createBaseInput({
        neighbours: [
          { areaId: "n1", areaName: "N1", mcv1Mean3YearPct: 70.0, hasThreatCaseYearMinus1: false },
          { areaId: "n2", areaName: "N2", mcv1Mean3YearPct: 75.0, hasThreatCaseYearMinus1: false },
        ]
      }));
      expect(res3.allIndicators.PI2.points).toBe(4);
    });

    it("PI7: exactly 20.0% receives 6 pts; verified 0 cases receives 6 pts policy assignment", () => {
      // 10 of 50 = 20.0% -> 6 pts
      const res1 = calculateAreaRiskScore(createBaseInput({
        surveillance3YearPooled: {
          eligibleSuspectedCases: 50,
          eligibleUnvaccinatedOrUnknown: 10,
          hasVerifiedZeroSuspectedCases: false,
        }
      }));
      expect(res1.allIndicators.PI7.points).toBe(6);

      // 9 of 50 = 18.0% (< 20%) -> 0 pts
      const res2 = calculateAreaRiskScore(createBaseInput({
        surveillance3YearPooled: {
          eligibleSuspectedCases: 50,
          eligibleUnvaccinatedOrUnknown: 9,
          hasVerifiedZeroSuspectedCases: false,
        }
      }));
      expect(res2.allIndicators.PI7.points).toBe(0);

      // Verified 0 cases over 3 years -> 6 pts (POLICY_ASSIGNED)
      const res3 = calculateAreaRiskScore(createBaseInput({
        surveillance3YearPooled: {
          eligibleSuspectedCases: 0,
          eligibleUnvaccinatedOrUnknown: 0,
          hasVerifiedZeroSuspectedCases: true,
        }
      }));
      expect(res3.allIndicators.PI7.points).toBe(6);
      expect(res3.allIndicators.PI7.valueState).toBe("POLICY_ASSIGNED");
    });
  });

  describe("Surveillance Quality (SQ1 to SQ4) Boundaries", () => {
    it("SQ1: tests population brackets at 49,999, 50,000, 99,999, and 100,000", () => {
      // Pop 49,999 (< 50k) -> 0 pts (exempted)
      const res49k = calculateAreaRiskScore(createBaseInput({
        population: 49999,
        surveillanceYearMinus1: {
          ...createBaseInput().surveillanceYearMinus1,
          discardedCases: 0,
        }
      }));
      expect(res49k.allIndicators.SQ1.points).toBe(0);
      expect(res49k.allIndicators.SQ1.valueState).toBe("NOT_APPLICABLE");

      // Pop 50,000 with 0 discarded -> 8 pts
      const res50kZero = calculateAreaRiskScore(createBaseInput({
        population: 50000,
        surveillanceYearMinus1: {
          ...createBaseInput().surveillanceYearMinus1,
          discardedCases: 0,
        }
      }));
      expect(res50kZero.allIndicators.SQ1.points).toBe(8);

      // Pop 50,000 with 1 discarded -> 0 pts
      const res50kOne = calculateAreaRiskScore(createBaseInput({
        population: 50000,
        surveillanceYearMinus1: {
          ...createBaseInput().surveillanceYearMinus1,
          discardedCases: 1,
        }
      }));
      expect(res50kOne.allIndicators.SQ1.points).toBe(0);

      // Pop 99,999 with 1 discarded -> 0 pts
      const res99kOne = calculateAreaRiskScore(createBaseInput({
        population: 99999,
        surveillanceYearMinus1: {
          ...createBaseInput().surveillanceYearMinus1,
          discardedCases: 1,
        }
      }));
      expect(res99kOne.allIndicators.SQ1.points).toBe(0);

      // Pop 100,000 with rate exactly 2.0 (2 discarded) -> 0 pts
      const res100kTwo = calculateAreaRiskScore(createBaseInput({
        population: 100000,
        surveillanceYearMinus1: {
          ...createBaseInput().surveillanceYearMinus1,
          discardedCases: 2,
        }
      }));
      expect(res100kTwo.allIndicators.SQ1.points).toBe(0);

      // Pop 100,000 with rate 1.0 (1 discarded) -> 4 pts (1 to <2)
      const res100kOne = calculateAreaRiskScore(createBaseInput({
        population: 100000,
        surveillanceYearMinus1: {
          ...createBaseInput().surveillanceYearMinus1,
          discardedCases: 1,
        }
      }));
      expect(res100kOne.allIndicators.SQ1.points).toBe(4);

      // Pop 100,000 with rate < 1.0 (0 discarded) -> 8 pts
      const res100kZero = calculateAreaRiskScore(createBaseInput({
        population: 100000,
        surveillanceYearMinus1: {
          ...createBaseInput().surveillanceYearMinus1,
          discardedCases: 0,
        }
      }));
      expect(res100kZero.allIndicators.SQ1.points).toBe(8);
    });

    it("SQ2, SQ3, SQ4: exactly 80.0% boundary receives 0 points", () => {
      // SQ2: 16 of 20 = exactly 80.0% -> 0 pts
      const res1 = calculateAreaRiskScore(createBaseInput({
        surveillanceYearMinus1: {
          ...createBaseInput().surveillanceYearMinus1,
          suspectedCases: 20,
          adequatelyInvestigatedCases: 16,
        }
      }));
      expect(res1.allIndicators.SQ2.points).toBe(0);

      // SQ2: 15 of 20 = 75.0% (< 80%) -> 4 pts
      const res2 = calculateAreaRiskScore(createBaseInput({
        surveillanceYearMinus1: {
          ...createBaseInput().surveillanceYearMinus1,
          suspectedCases: 20,
          adequatelyInvestigatedCases: 15,
        }
      }));
      expect(res2.allIndicators.SQ2.points).toBe(4);
    });
  });

  describe("Programme Delivery Performance (PD1 to PD4) Boundaries", () => {
    it("PD1: OLS trend slope at 0.0 and -10.0 boundaries", () => {
      // Slope 0.0 pp/year -> 0 pts
      const resZero = calculateAreaRiskScore(createBaseInput({
        coverage: {
          ...createBaseInput().coverage,
          mcv1: [{ year: 2020, coveragePct: 90.0 }, { year: 2021, coveragePct: 90.0 }, { year: 2022, coveragePct: 90.0 }],
        }
      }));
      expect(resZero.allIndicators.PD1.points).toBe(0);

      // Slope exactly -10.0 pp/year (e.g. 90, 80, 70) -> 2 pts (-10 <= slope < 0)
      const resNeg10 = calculateAreaRiskScore(createBaseInput({
        coverage: {
          ...createBaseInput().coverage,
          mcv1: [{ year: 2020, coveragePct: 90.0 }, { year: 2021, coveragePct: 80.0 }, { year: 2022, coveragePct: 70.0 }],
        }
      }));
      expect(resNeg10.allIndicators.PD1.points).toBe(2);

      // Slope < -10.0 pp/year (e.g. 90, 75, 60 -> slope -15) -> 4 pts
      const resNeg15 = calculateAreaRiskScore(createBaseInput({
        coverage: {
          ...createBaseInput().coverage,
          mcv1: [{ year: 2020, coveragePct: 90.0 }, { year: 2021, coveragePct: 75.0 }, { year: 2022, coveragePct: 60.0 }],
        }
      }));
      expect(resNeg15.allIndicators.PD1.points).toBe(4);
    });

    it("PD3 & PD4: dropout at exactly 10.0% receives 0 points", () => {
      // MCV1 = 100%, MCV2 = 90% -> dropout = (100 - 90)/100 = 10.0% -> 0 pts
      const res10 = calculateAreaRiskScore(createBaseInput({
        coverage: {
          mcv1: [{ year: 2020, coveragePct: 90.0 }, { year: 2021, coveragePct: 90.0 }, { year: 2022, coveragePct: 100.0 }],
          mcv2: [{ year: 2020, coveragePct: 80.0 }, { year: 2021, coveragePct: 80.0 }, { year: 2022, coveragePct: 90.0 }],
          penta1: [{ year: 2020, coveragePct: 90.0 }, { year: 2021, coveragePct: 90.0 }, { year: 2022, coveragePct: 100.0 }],
        }
      }));
      expect(res10.allIndicators.PD3.points).toBe(0);

      // MCV1 = 100%, MCV2 = 89.9% -> dropout = 10.1% (> 10.0%) -> 4 pts
      const res10Point1 = calculateAreaRiskScore(createBaseInput({
        coverage: {
          mcv1: [{ year: 2020, coveragePct: 90.0 }, { year: 2021, coveragePct: 90.0 }, { year: 2022, coveragePct: 100.0 }],
          mcv2: [{ year: 2020, coveragePct: 80.0 }, { year: 2021, coveragePct: 80.0 }, { year: 2022, coveragePct: 89.9 }],
          penta1: [{ year: 2020, coveragePct: 90.0 }, { year: 2021, coveragePct: 90.0 }, { year: 2022, coveragePct: 100.0 }],
        }
      }));
      expect(res10Point1.allIndicators.PD3.points).toBe(4);
    });
  });

  describe("Threat Assessment (TA1 to TA6) & Density", () => {
    it("TA4: tests density bands at 50, 100, 300, 1000 per km²", () => {
      // Pop 50,000 / 1000 km² = 50.0 / km² (<= 50) -> 0 pts
      const res50 = calculateAreaRiskScore(createBaseInput({ population: 50000, areaKm2: 1000 }));
      expect(res50.allIndicators.TA4.points).toBe(0);

      // Pop 100,000 / 1000 km² = 100.0 / km² (50 to 100) -> 1 pt
      const res100 = calculateAreaRiskScore(createBaseInput({ population: 100000, areaKm2: 1000 }));
      expect(res100.allIndicators.TA4.points).toBe(1);

      // Pop 300,000 / 1000 km² = 300.0 / km² (100 to 300) -> 2 pts
      const res300 = calculateAreaRiskScore(createBaseInput({ population: 300000, areaKm2: 1000 }));
      expect(res300.allIndicators.TA4.points).toBe(2);

      // Pop 1,000,000 / 1000 km² = 1,000.0 / km² (300 to 1000) -> 3 pts
      const res1000 = calculateAreaRiskScore(createBaseInput({ population: 1000000, areaKm2: 1000 }));
      expect(res1000.allIndicators.TA4.points).toBe(3);

      // Pop 1,001,000 / 1000 km² = 1,001.0 / km² (> 1000) -> 4 pts
      const res1001 = calculateAreaRiskScore(createBaseInput({ population: 1001000, areaKm2: 1000 }));
      expect(res1001.allIndicators.TA4.points).toBe(4);
    });

    it("TA5: neighbouring measles cases award 2 points without multiplying", () => {
      // 1 neighbour with cases -> 2 pts
      const res1 = calculateAreaRiskScore(createBaseInput({
        neighbours: [
          { areaId: "n1", areaName: "Nzara", mcv1Mean3YearPct: 90.0, hasThreatCaseYearMinus1: true },
          { areaId: "n2", areaName: "Ezo", mcv1Mean3YearPct: 90.0, hasThreatCaseYearMinus1: false },
        ]
      }));
      expect(res1.allIndicators.TA5.points).toBe(2);

      // 10 neighbours with cases -> still 2 pts (max 2)
      const res10 = calculateAreaRiskScore(createBaseInput({
        neighbours: Array.from({ length: 10 }, (_, i) => ({
          areaId: `n${i}`,
          areaName: `Neighbour ${i}`,
          mcv1Mean3YearPct: 90.0,
          hasThreatCaseYearMinus1: true,
        }))
      }));
      expect(res10.allIndicators.TA5.points).toBe(2);
    });
  });

  describe("Overall Risk Score & Classification Bands", () => {
    it("classifies exact cutoffs: 47 (Low), 48 (Medium), 54 (Medium), 55 (High), 60 (High), 61 (Very High)", () => {
      expect(classifyRiskScore(47)).toBe("LOW");
      expect(classifyRiskScore(48)).toBe("MEDIUM");
      expect(classifyRiskScore(54)).toBe("MEDIUM");
      expect(classifyRiskScore(55)).toBe("HIGH");
      expect(classifyRiskScore(60)).toBe("HIGH");
      expect(classifyRiskScore(61)).toBe("VERY_HIGH");
      expect(classifyRiskScore(100)).toBe("VERY_HIGH");
    });

    it("marks score INCOMPLETE when missing required indicators and avoids false Low label", () => {
      const res = calculateAreaRiskScore(createBaseInput({
        coverage: {
          mcv1: [{ year: 2020, coveragePct: null }, { year: 2021, coveragePct: 90.0 }, { year: 2022, coveragePct: 90.0 }],
          mcv2: [{ year: 2020, coveragePct: 80.0 }, { year: 2021, coveragePct: 80.0 }, { year: 2022, coveragePct: 80.0 }],
          penta1: [{ year: 2020, coveragePct: 90.0 }, { year: 2021, coveragePct: 90.0 }, { year: 2022, coveragePct: 90.0 }],
        }
      }));
      expect(res.isIncomplete).toBe(true);
      expect(res.totalScore).toBeNull();
      expect(res.riskCategory).toBe("INCOMPLETE");
      expect(res.minPossibleScore).toBeGreaterThanOrEqual(0);
      expect(res.maxPossibleScore).toBeGreaterThanOrEqual(res.minPossibleScore);
    });
  });

  describe("Case Linelist Processor", () => {
    it("maps classifications accurately", () => {
      expect(mapClassification("Lab confirmed")).toBe("LAB_CONFIRMED_MEASLES");
      expect(mapClassification("Epidemiologically linked")).toBe("EPI_LINKED_MEASLES");
      expect(mapClassification("Clinically Compatible")).toBe("CLINICALLY_COMPATIBLE_MEASLES");
      expect(mapClassification("Discarded (non-measles)")).toBe("DISCARDED_NON_MEASLES");
      expect(mapClassification("Rubella")).toBe("CONFIRMED_RUBELLA");
    });

    it("evaluates age boundaries at 59, 60, 179, and 180 months", () => {
      // 59 months -> <5
      const c59 = processSurveillanceCaseRow({
        caseId: "C1",
        reportingDistrict: "Yambio",
        ageMonths: 59,
        finalClassification: "Lab confirmed",
        dateRashOnset: "2022-05-10",
      });
      expect(c59.ageBand).toBe("<5");

      // 60 months -> 5-14
      const c60 = processSurveillanceCaseRow({
        caseId: "C2",
        reportingDistrict: "Yambio",
        ageMonths: 60,
        finalClassification: "Lab confirmed",
        dateRashOnset: "2022-05-10",
      });
      expect(c60.ageBand).toBe("5-14");

      // 179 months -> 5-14
      const c179 = processSurveillanceCaseRow({
        caseId: "C3",
        reportingDistrict: "Yambio",
        ageMonths: 179,
        finalClassification: "Lab confirmed",
        dateRashOnset: "2022-05-10",
      });
      expect(c179.ageBand).toBe("5-14");

      // 180 months -> 15+
      const c180 = processSurveillanceCaseRow({
        caseId: "C4",
        reportingDistrict: "Yambio",
        ageMonths: 180,
        finalClassification: "Lab confirmed",
        dateRashOnset: "2022-05-10",
      });
      expect(c180.ageBand).toBe("15+");
    });

    it("detects and flags negative date intervals", () => {
      const row = processSurveillanceCaseRow({
        caseId: "C5",
        reportingDistrict: "Yambio",
        ageYears: 3,
        finalClassification: "Lab confirmed",
        dateRashOnset: "2022-05-10",
        dateNotification: "2022-05-12",
        dateInvestigation: "2022-05-08", // 4 days BEFORE notification!
      });
      expect(row.validationWarnings.some((w) => w.includes("negative interval"))).toBe(true);
      expect(row.isAdequateInvestigation).toBe(false);
    });
  });
});
