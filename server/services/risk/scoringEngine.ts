/**
 * Pure Functional WHO Measles Programmatic Risk Scoring Engine
 * Package: WHO_MEASLES_GLOBAL_RECONCILED_V1
 * 
 * Implements deterministic calculation for all 21 indicators across 4 domains.
 * Provides transparent explanations, exact boundary logic, zero-denominator safety,
 * and bounded intervals for missing neighbour data.
 */

import {
  IndicatorId,
  DomainId,
  RiskCategory,
  classifyRiskScore,
  WHO_MEASLES_INDICATORS,
  WHO_MEASLES_DOMAINS,
} from "./methodologyRegistry";

export interface AreaAssessmentInput {
  areaId: string;
  areaName: string;
  assessmentYear: number;
  population: number;
  areaKm2: number;

  // Coverage over 3 years [year-3, year-2, year-1] (e.g. 2020, 2021, 2022 for assessmentYear 2023)
  coverage: {
    mcv1: Array<{ year: number; coveragePct: number | null }>;
    mcv2: Array<{ year: number; coveragePct: number | null }>;
    penta1: Array<{ year: number; coveragePct: number | null }>;
  };

  // SIA history
  sia: {
    hasQualifyingCampaignInWindow: boolean;
    isSiaExempt?: boolean; // Post-elimination / high-coverage national policy
    campaignYear?: number;
    coveragePct?: number | null;
    targetAgeGroup?: "WIDE" | "NARROW" | "UNKNOWN";
  };

  // Linelist surveillance summary for previous calendar year (assessmentYear - 1)
  surveillanceYearMinus1: {
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
  };

  // Linelist 3-year pooled summary for PI7
  surveillance3YearPooled: {
    eligibleSuspectedCases: number;
    eligibleUnvaccinatedOrUnknown: number;
    hasVerifiedZeroSuspectedCases: boolean;
  };

  // Neighbours
  neighbours: Array<{
    areaId: string;
    areaName: string;
    mcv1Mean3YearPct: number | null;
    hasThreatCaseYearMinus1: boolean;
  }>;

  // Vulnerability factors (8 standard items)
  vulnerabilityFactors: {
    migrantOrUnderserved: boolean;
    vaccineHesitancyOrRefusal: boolean;
    securityOrConflictConcerns: boolean;
    recurrentNaturalDisasters: boolean;
    poorAccessOrTerrain: boolean;
    inadequatePoliticalSupport: boolean;
    highTransitHubOrBorder: boolean;
    massGatheringsOrEvents: boolean;
  };

  // Methodology / Country profile overrides
  options?: {
    capCoverageAt100?: boolean;
    mcv2Introduced?: boolean;
  };
}

export interface CalculatedIndicatorResult {
  indicatorId: IndicatorId;
  domainId: DomainId;
  points: number | null;
  maxPoints: number;
  valueState: "OBSERVED" | "VERIFIED_ZERO" | "MISSING" | "INVALID" | "NOT_INTRODUCED" | "NOT_APPLICABLE" | "POLICY_ASSIGNED" | "ZERO_DENOMINATOR";
  rawNumericValue: number | null;
  displayedValue: string;
  numerator: number | null;
  denominator: number | null;
  thresholdApplied: string;
  explanation: string;
  warnings: string[];
}

export interface CalculatedDomainResult {
  domainId: DomainId;
  points: number | null;
  maxPoints: number;
  isIncomplete: boolean;
  indicatorResults: Record<IndicatorId, CalculatedIndicatorResult>;
}

export interface AreaAssessmentScoreResult {
  areaId: string;
  areaName: string;
  assessmentYear: number;
  totalScore: number | null;
  maxTotalPoints: number;
  riskCategory: RiskCategory;
  isIncomplete: boolean;
  minPossibleScore: number;
  maxPossibleScore: number;
  domains: Record<DomainId, CalculatedDomainResult>;
  allIndicators: Record<IndicatorId, CalculatedIndicatorResult>;
  summaryExplanation: string;
  calculatedAt: string;
}

/**
 * Calculates Ordinary Least Squares (OLS) slope: (sum (x - mean_x)(y - mean_y)) / sum (x - mean_x)^2
 */
export function calculateOlsSlope(data: Array<{ year: number; value: number }>): number | null {
  if (data.length < 2) return null;
  const n = data.length;
  const meanX = data.reduce((acc, d) => acc + d.year, 0) / n;
  const meanY = data.reduce((acc, d) => acc + d.value, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (const d of data) {
    const dx = d.year - meanX;
    const dy = d.value - meanY;
    numerator += dx * dy;
    denominator += dx * dx;
  }

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Pure calculation of the 21 indicators for an area
 */
export function calculateAreaRiskScore(input: AreaAssessmentInput): AreaAssessmentScoreResult {
  const indicators: Record<string, CalculatedIndicatorResult> = {};
  const warnings: string[] = [];

  const capCoverage = (val: number | null): number | null => {
    if (val === null) return null;
    if (input.options?.capCoverageAt100 && val > 100) return 100;
    return val;
  };

  // -------------------------------------------------------------
  // DOMAIN 1: POPULATION IMMUNITY (Max 40)
  // -------------------------------------------------------------

  // PI1: MCV1 Coverage (3-year mean, max 8)
  const mcv1Valid = input.coverage.mcv1.filter((c) => c.coveragePct !== null);
  if (mcv1Valid.length < 3) {
    indicators.PI1 = {
      indicatorId: "PI1",
      domainId: "POPULATION_IMMUNITY",
      points: null,
      maxPoints: 8,
      valueState: "MISSING",
      rawNumericValue: null,
      displayedValue: "Incomplete (< 3 years)",
      numerator: null,
      denominator: null,
      thresholdApplied: "None (Missing data)",
      explanation: `MCV1 coverage is missing for one or more of the required 3 preceding years (${mcv1Valid.length}/3 available).`,
      warnings: ["Requires 3 full calendar years of MCV1 coverage"],
    };
  } else {
    const rawMean = mcv1Valid.reduce((acc, c) => acc + (c.coveragePct ?? 0), 0) / 3;
    const analyticalMean = mcv1Valid.reduce((acc, c) => acc + (capCoverage(c.coveragePct) ?? 0), 0) / 3;
    let pts = 8;
    let th = "< 80%";
    if (analyticalMean >= 95.0) {
      pts = 0;
      th = ">= 95%";
    } else if (analyticalMean >= 90.0) {
      pts = 2;
      th = "90% to < 95%";
    } else if (analyticalMean >= 85.0) {
      pts = 4;
      th = "85% to < 90%";
    } else if (analyticalMean >= 80.0) {
      pts = 6;
      th = "80% to < 85%";
    }

    indicators.PI1 = {
      indicatorId: "PI1",
      domainId: "POPULATION_IMMUNITY",
      points: pts,
      maxPoints: 8,
      valueState: "OBSERVED",
      rawNumericValue: analyticalMean,
      displayedValue: `${analyticalMean.toFixed(1)}%`,
      numerator: analyticalMean * 3,
      denominator: 3,
      thresholdApplied: th,
      explanation: `3-year mean MCV1 coverage is ${analyticalMean.toFixed(1)}% (raw: ${rawMean.toFixed(1)}%), qualifying for threshold ${th} (${pts}/8 points).`,
      warnings: rawMean > 100 ? ["One or more years exceeded 100% coverage and was analytically capped at 100%"] : [],
    };
  }

  // PI2: Neighbouring districts with 3-year mean MCV1 < 80% (max 4)
  const totalNeighbours = input.neighbours.length;
  if (totalNeighbours === 0) {
    indicators.PI2 = {
      indicatorId: "PI2",
      domainId: "POPULATION_IMMUNITY",
      points: 0,
      maxPoints: 4,
      valueState: "NOT_APPLICABLE",
      rawNumericValue: 0,
      displayedValue: "No neighbours",
      numerator: 0,
      denominator: 0,
      thresholdApplied: "< 50% (Island/No neighbours exception)",
      explanation: "District has no approved contiguous neighbours (e.g. island or isolated boundary). Assigned 0 points per WHO guidance.",
      warnings: [],
    };
  } else {
    const knownNeighbours = input.neighbours.filter((n) => n.mcv1Mean3YearPct !== null);
    // Strictly < 80%. Exactly 80.0% is NOT below 80%.
    const lowNeighbours = knownNeighbours.filter((n) => (n.mcv1Mean3YearPct ?? 100) < 80.0).length;
    const missingNeighbours = totalNeighbours - knownNeighbours.length;

    const lowerBoundPct = (100 * lowNeighbours) / totalNeighbours;
    const upperBoundPct = (100 * (lowNeighbours + missingNeighbours)) / totalNeighbours;

    // Check if missing neighbours create an ambiguous score across thresholds (50% or 75%)
    const getPointsForPct = (p: number) => (p >= 75.0 ? 4 : p >= 50.0 ? 2 : 0);
    const minPts = getPointsForPct(lowerBoundPct);
    const maxPts = getPointsForPct(upperBoundPct);

    if (missingNeighbours > 0 && minPts !== maxPts) {
      indicators.PI2 = {
        indicatorId: "PI2",
        domainId: "POPULATION_IMMUNITY",
        points: null,
        maxPoints: 4,
        valueState: "MISSING",
        rawNumericValue: null,
        displayedValue: `Incomplete (${lowerBoundPct.toFixed(1)}%–${upperBoundPct.toFixed(1)}%)`,
        numerator: lowNeighbours,
        denominator: totalNeighbours,
        thresholdApplied: "Ambiguous bounds due to missing neighbour coverage",
        explanation: `${lowNeighbours} of ${totalNeighbours} neighbours are confirmed <80% MCV1 (${lowerBoundPct.toFixed(1)}%), but ${missingNeighbours} neighbour(s) have unknown coverage, leaving the score range between ${minPts} and ${maxPts} points.`,
        warnings: [`${missingNeighbours} neighbour(s) missing MCV1 coverage data`],
      };
    } else {
      const pct = lowerBoundPct;
      const pts = getPointsForPct(pct);
      const th = pct >= 75.0 ? ">= 75%" : pct >= 50.0 ? "50% to < 75%" : "< 50%";
      indicators.PI2 = {
        indicatorId: "PI2",
        domainId: "POPULATION_IMMUNITY",
        points: pts,
        maxPoints: 4,
        valueState: "OBSERVED",
        rawNumericValue: pct,
        displayedValue: `${pct.toFixed(1)}% (${lowNeighbours}/${totalNeighbours})`,
        numerator: lowNeighbours,
        denominator: totalNeighbours,
        thresholdApplied: th,
        explanation: `${lowNeighbours} of ${totalNeighbours} approved neighbours have 3-year mean MCV1 coverage < 80% (${pct.toFixed(1)}%), falling in band ${th} (${pts}/4 points).`,
        warnings: [],
      };
    }
  }

  // PI3: MCV2 Coverage (max 8)
  const isMcv2Introduced = input.options?.mcv2Introduced ?? true;
  if (!isMcv2Introduced) {
    indicators.PI3 = {
      indicatorId: "PI3",
      domainId: "POPULATION_IMMUNITY",
      points: 8,
      maxPoints: 8,
      valueState: "NOT_INTRODUCED",
      rawNumericValue: null,
      displayedValue: "Not Introduced",
      numerator: null,
      denominator: null,
      thresholdApplied: "Not Introduced (8 pts)",
      explanation: "MCV2 has not been introduced into the routine childhood immunisation schedule. Assigned 8 points per WHO technical methodology.",
      warnings: [],
    };
  } else {
    const mcv2Valid = input.coverage.mcv2.filter((c) => c.coveragePct !== null);
    if (mcv2Valid.length === 0) {
      indicators.PI3 = {
        indicatorId: "PI3",
        domainId: "POPULATION_IMMUNITY",
        points: null,
        maxPoints: 8,
        valueState: "MISSING",
        rawNumericValue: null,
        displayedValue: "Missing",
        numerator: null,
        denominator: null,
        thresholdApplied: "None (Missing data)",
        explanation: "MCV2 is introduced but no valid coverage observations were recorded in the assessment window.",
        warnings: ["MCV2 coverage missing"],
      };
    } else {
      const analyticalMean = mcv2Valid.reduce((acc, c) => acc + (capCoverage(c.coveragePct) ?? 0), 0) / mcv2Valid.length;
      let pts = 8;
      let th = "< 80%";
      if (analyticalMean >= 95.0) {
        pts = 0;
        th = ">= 95%";
      } else if (analyticalMean >= 90.0) {
        pts = 2;
        th = "90% to < 95%";
      } else if (analyticalMean >= 85.0) {
        pts = 4;
        th = "85% to < 90%";
      } else if (analyticalMean >= 80.0) {
        pts = 6;
        th = "80% to < 85%";
      }

      indicators.PI3 = {
        indicatorId: "PI3",
        domainId: "POPULATION_IMMUNITY",
        points: pts,
        maxPoints: 8,
        valueState: "OBSERVED",
        rawNumericValue: analyticalMean,
        displayedValue: `${analyticalMean.toFixed(1)}%`,
        numerator: analyticalMean * mcv2Valid.length,
        denominator: mcv2Valid.length,
        thresholdApplied: th,
        explanation: `Mean MCV2 coverage across introduced years is ${analyticalMean.toFixed(1)}%, qualifying for threshold ${th} (${pts}/8 points).`,
        warnings: [],
      };
    }
  }

  // PI4: Measles SIA Coverage (max 8)
  if (input.sia.isSiaExempt) {
    indicators.PI4 = {
      indicatorId: "PI4",
      domainId: "POPULATION_IMMUNITY",
      points: 0,
      maxPoints: 8,
      valueState: "NOT_APPLICABLE",
      rawNumericValue: null,
      displayedValue: "Exempt (National SIA Policy)",
      numerator: null,
      denominator: null,
      thresholdApplied: "Exempt (0 pts)",
      explanation: "District is verified exempt from SIA indicators under approved post-elimination or high-routine-coverage policy.",
      warnings: [],
    };
  } else if (!input.sia.hasQualifyingCampaignInWindow) {
    indicators.PI4 = {
      indicatorId: "PI4",
      domainId: "POPULATION_IMMUNITY",
      points: 8,
      maxPoints: 8,
      valueState: "OBSERVED",
      rawNumericValue: null,
      displayedValue: "No Qualifying SIA",
      numerator: null,
      denominator: null,
      thresholdApplied: "No qualifying SIA (8 pts)",
      explanation: "No qualifying nationwide or districtwide measles SIA conducted within the assessment period.",
      warnings: [],
    };
  } else if (input.sia.coveragePct === null || input.sia.coveragePct === undefined) {
    indicators.PI4 = {
      indicatorId: "PI4",
      domainId: "POPULATION_IMMUNITY",
      points: 6,
      maxPoints: 8,
      valueState: "OBSERVED",
      rawNumericValue: null,
      displayedValue: "Conducted (Coverage Unknown)",
      numerator: null,
      denominator: null,
      thresholdApplied: "Conducted but coverage unknown (6 pts)",
      explanation: "Qualifying SIA was conducted in the district, but administrative or survey coverage was not reported.",
      warnings: ["SIA coverage figure missing"],
    };
  } else {
    const cov = capCoverage(input.sia.coveragePct) ?? 0;
    let pts = 6;
    let th = "< 85%";
    if (cov >= 95.0) {
      pts = 0;
      th = ">= 95%";
    } else if (cov >= 90.0) {
      pts = 2;
      th = "90% to < 95%";
    } else if (cov >= 85.0) {
      pts = 4;
      th = "85% to < 90%";
    }

    indicators.PI4 = {
      indicatorId: "PI4",
      domainId: "POPULATION_IMMUNITY",
      points: pts,
      maxPoints: 8,
      valueState: "OBSERVED",
      rawNumericValue: cov,
      displayedValue: `${cov.toFixed(1)}%`,
      numerator: cov,
      denominator: 100,
      thresholdApplied: th,
      explanation: `Most recent qualifying SIA achieved ${cov.toFixed(1)}% coverage, qualifying for threshold ${th} (${pts}/8 points).`,
      warnings: [],
    };
  }

  // PI5: SIA Target Age Group (max 2)
  if (input.sia.isSiaExempt) {
    indicators.PI5 = {
      indicatorId: "PI5",
      domainId: "POPULATION_IMMUNITY",
      points: 0,
      maxPoints: 2,
      valueState: "NOT_APPLICABLE",
      rawNumericValue: null,
      displayedValue: "Exempt",
      numerator: null,
      denominator: null,
      thresholdApplied: "Exempt (0 pts)",
      explanation: "SIA age target is exempt under national policy.",
      warnings: [],
    };
  } else if (!input.sia.hasQualifyingCampaignInWindow) {
    indicators.PI5 = {
      indicatorId: "PI5",
      domainId: "POPULATION_IMMUNITY",
      points: 2,
      maxPoints: 2,
      valueState: "OBSERVED",
      rawNumericValue: null,
      displayedValue: "No Qualifying SIA",
      numerator: null,
      denominator: null,
      thresholdApplied: "No SIA (2 pts)",
      explanation: "No qualifying SIA was conducted in the district.",
      warnings: [],
    };
  } else {
    const isWide = input.sia.targetAgeGroup === "WIDE";
    const pts = isWide ? 0 : 2;
    const th = isWide ? "Wide target age group" : "Narrow target age group";
    indicators.PI5 = {
      indicatorId: "PI5",
      domainId: "POPULATION_IMMUNITY",
      points: pts,
      maxPoints: 2,
      valueState: "OBSERVED",
      rawNumericValue: null,
      displayedValue: input.sia.targetAgeGroup ?? "Narrow",
      numerator: null,
      denominator: null,
      thresholdApplied: th,
      explanation: `SIA targeted a ${th.toLowerCase()} (${pts}/2 points).`,
      warnings: [],
    };
  }

  // PI6: Years Since Last Qualifying SIA (max 4)
  if (input.sia.isSiaExempt) {
    indicators.PI6 = {
      indicatorId: "PI6",
      domainId: "POPULATION_IMMUNITY",
      points: 0,
      maxPoints: 4,
      valueState: "NOT_APPLICABLE",
      rawNumericValue: 0,
      displayedValue: "Exempt",
      numerator: null,
      denominator: null,
      thresholdApplied: "Exempt (0 pts)",
      explanation: "SIA timeliness is exempt under national policy.",
      warnings: [],
    };
  } else if (!input.sia.hasQualifyingCampaignInWindow || !input.sia.campaignYear) {
    indicators.PI6 = {
      indicatorId: "PI6",
      domainId: "POPULATION_IMMUNITY",
      points: 4,
      maxPoints: 4,
      valueState: "OBSERVED",
      rawNumericValue: null,
      displayedValue: ">= 3 years (or None)",
      numerator: null,
      denominator: null,
      thresholdApplied: ">= 3 years or No SIA (4 pts)",
      explanation: "No qualifying SIA conducted within the past 3 years (4/4 points).",
      warnings: [],
    };
  } else {
    const elapsed = input.assessmentYear - input.sia.campaignYear;
    let pts = 4;
    let th = ">= 3 years";
    if (elapsed <= 1) {
      pts = 0;
      th = "0 or 1 year";
    } else if (elapsed === 2) {
      pts = 2;
      th = "2 years";
    }

    indicators.PI6 = {
      indicatorId: "PI6",
      domainId: "POPULATION_IMMUNITY",
      points: pts,
      maxPoints: 4,
      valueState: "OBSERVED",
      rawNumericValue: elapsed,
      displayedValue: `${elapsed} year(s)`,
      numerator: elapsed,
      denominator: null,
      thresholdApplied: th,
      explanation: `${elapsed} calendar year(s) elapsed since the last qualifying SIA (${th}, ${pts}/4 points).`,
      warnings: [],
    };
  }

  // PI7: Unvaccinated or Unknown Age-Eligible Cases (max 6)
  const eligSuspected = input.surveillance3YearPooled.eligibleSuspectedCases;
  const eligUnvacOrUnknown = input.surveillance3YearPooled.eligibleUnvaccinatedOrUnknown;

  if (eligSuspected === 0) {
    if (input.surveillance3YearPooled.hasVerifiedZeroSuspectedCases) {
      indicators.PI7 = {
        indicatorId: "PI7",
        domainId: "POPULATION_IMMUNITY",
        points: 6,
        maxPoints: 6,
        valueState: "POLICY_ASSIGNED",
        rawNumericValue: null,
        displayedValue: "0 cases reported (Policy max)",
        numerator: 0,
        denominator: 0,
        thresholdApplied: "Zero cases over 3 years (6 pts policy assignment)",
        explanation: "No suspected measles cases reported in 3 years. WHO tool assigns maximum risk points (6/6) to avoid penalising silent districts.",
        warnings: ["Verified zero suspected cases over complete 3-year period"],
      };
    } else {
      indicators.PI7 = {
        indicatorId: "PI7",
        domainId: "POPULATION_IMMUNITY",
        points: null,
        maxPoints: 6,
        valueState: "MISSING",
        rawNumericValue: null,
        displayedValue: "Missing linelist",
        numerator: 0,
        denominator: 0,
        thresholdApplied: "None (Missing data)",
        explanation: "No suspected case linelist records available for the 3-year assessment period.",
        warnings: ["Surveillance linelist required for PI7"],
      };
    }
  } else {
    const pct = (100 * eligUnvacOrUnknown) / eligSuspected;
    // Boundary test: exactly 20.0% receives 6 pts. < 20% receives 0 pts.
    const pts = pct >= 20.0 ? 6 : 0;
    const th = pct >= 20.0 ? ">= 20%" : "< 20%";
    indicators.PI7 = {
      indicatorId: "PI7",
      domainId: "POPULATION_IMMUNITY",
      points: pts,
      maxPoints: 6,
      valueState: "OBSERVED",
      rawNumericValue: pct,
      displayedValue: `${pct.toFixed(1)}% (${eligUnvacOrUnknown}/${eligSuspected})`,
      numerator: eligUnvacOrUnknown,
      denominator: eligSuspected,
      thresholdApplied: th,
      explanation: `${pct.toFixed(1)}% (${eligUnvacOrUnknown}/${eligSuspected}) of age-eligible suspected cases over 3 years were unvaccinated or of unknown vaccination status (${th}, ${pts}/6 points).`,
      warnings: [],
    };
  }

  // -------------------------------------------------------------
  // DOMAIN 2: SURVEILLANCE QUALITY (Max 20)
  // -------------------------------------------------------------

  const pop = input.population;
  const discardedCases = input.surveillanceYearMinus1.discardedCases;
  const suspectedCases = input.surveillanceYearMinus1.suspectedCases;

  // SQ1: Non-measles discarded rate per 100k (max 8)
  if (pop <= 0) {
    indicators.SQ1 = {
      indicatorId: "SQ1",
      domainId: "SURVEILLANCE_QUALITY",
      points: null,
      maxPoints: 8,
      valueState: "INVALID",
      rawNumericValue: null,
      displayedValue: "Invalid Population",
      numerator: discardedCases,
      denominator: pop,
      thresholdApplied: "None (Invalid denominator)",
      explanation: "District population must be a positive number.",
      warnings: ["Population <= 0"],
    };
  } else if (pop < 50000) {
    indicators.SQ1 = {
      indicatorId: "SQ1",
      domainId: "SURVEILLANCE_QUALITY",
      points: 0,
      maxPoints: 8,
      valueState: "NOT_APPLICABLE",
      rawNumericValue: (100000 * discardedCases) / pop,
      displayedValue: `${((100000 * discardedCases) / pop).toFixed(2)}/100k (Pop < 50k)`,
      numerator: discardedCases,
      denominator: pop,
      thresholdApplied: "Pop < 50,000 (0 pts)",
      explanation: `District population (${pop.toLocaleString()}) is below 50,000. Exempted from discarded rate scoring (0/8 points) per WHO technical appendix.`,
      warnings: [],
    };
  } else if (pop < 100000) {
    const pts = discardedCases >= 1 ? 0 : 8;
    const th = discardedCases >= 1 ? ">= 1 discarded case (pop 50k-100k)" : "0 discarded cases (pop 50k-100k)";
    indicators.SQ1 = {
      indicatorId: "SQ1",
      domainId: "SURVEILLANCE_QUALITY",
      points: pts,
      maxPoints: 8,
      valueState: "OBSERVED",
      rawNumericValue: (100000 * discardedCases) / pop,
      displayedValue: `${discardedCases} case(s) (Pop ${pop.toLocaleString()})`,
      numerator: discardedCases,
      denominator: pop,
      thresholdApplied: th,
      explanation: `Medium-size district (${pop.toLocaleString()} pop): ${discardedCases} discarded cases reported (${th}, ${pts}/8 points).`,
      warnings: [],
    };
  } else {
    const rate = (100000 * discardedCases) / pop;
    let pts = 8;
    let th = "< 1 per 100k";
    if (rate >= 2.0) {
      pts = 0;
      th = ">= 2 per 100k";
    } else if (rate >= 1.0) {
      pts = 4;
      th = "1 to < 2 per 100k";
    }

    indicators.SQ1 = {
      indicatorId: "SQ1",
      domainId: "SURVEILLANCE_QUALITY",
      points: pts,
      maxPoints: 8,
      valueState: "OBSERVED",
      rawNumericValue: rate,
      displayedValue: `${rate.toFixed(2)} per 100k`,
      numerator: discardedCases,
      denominator: pop,
      thresholdApplied: th,
      explanation: `Annual non-measles discarded rate is ${rate.toFixed(2)} per 100,000 population (${discardedCases} discarded cases in ${pop.toLocaleString()} pop; ${th}, ${pts}/8 points).`,
      warnings: [],
    };
  }

  // SQ2: Adequate investigations % (max 4)
  const investigated = input.surveillanceYearMinus1.adequatelyInvestigatedCases;
  if (suspectedCases === 0) {
    indicators.SQ2 = {
      indicatorId: "SQ2",
      domainId: "SURVEILLANCE_QUALITY",
      points: 0,
      maxPoints: 4,
      valueState: "ZERO_DENOMINATOR",
      rawNumericValue: null,
      displayedValue: "0 suspected cases",
      numerator: 0,
      denominator: 0,
      thresholdApplied: "Zero denominator (0 pts default)",
      explanation: "No suspected cases reported in previous calendar year. Assigned 0 points.",
      warnings: [],
    };
  } else {
    const pct = (100 * investigated) / suspectedCases;
    const pts = pct >= 80.0 ? 0 : 4;
    const th = pct >= 80.0 ? ">= 80%" : "< 80%";
    indicators.SQ2 = {
      indicatorId: "SQ2",
      domainId: "SURVEILLANCE_QUALITY",
      points: pts,
      maxPoints: 4,
      valueState: "OBSERVED",
      rawNumericValue: pct,
      displayedValue: `${pct.toFixed(1)}% (${investigated}/${suspectedCases})`,
      numerator: investigated,
      denominator: suspectedCases,
      thresholdApplied: th,
      explanation: `${pct.toFixed(1)}% (${investigated}/${suspectedCases}) of suspected cases were adequately investigated within 48h with core fields complete (${th}, ${pts}/4 points).`,
      warnings: [],
    };
  }

  // SQ3: Adequate specimen collection % (max 4)
  const nonEpiLinkedDenominator = suspectedCases - input.surveillanceYearMinus1.epiLinkedCases;
  const specimensCollected = input.surveillanceYearMinus1.adequateSpecimensNonEpiLinked;

  if (nonEpiLinkedDenominator <= 0) {
    indicators.SQ3 = {
      indicatorId: "SQ3",
      domainId: "SURVEILLANCE_QUALITY",
      points: 0,
      maxPoints: 4,
      valueState: "ZERO_DENOMINATOR",
      rawNumericValue: null,
      displayedValue: "0 eligible cases",
      numerator: specimensCollected,
      denominator: 0,
      thresholdApplied: "Zero denominator (0 pts default)",
      explanation: "No non-epidemiologically linked suspected cases required specimen collection. Assigned 0 points.",
      warnings: [],
    };
  } else {
    const pct = (100 * specimensCollected) / nonEpiLinkedDenominator;
    const pts = pct >= 80.0 ? 0 : 4;
    const th = pct >= 80.0 ? ">= 80%" : "< 80%";
    indicators.SQ3 = {
      indicatorId: "SQ3",
      domainId: "SURVEILLANCE_QUALITY",
      points: pts,
      maxPoints: 4,
      valueState: "OBSERVED",
      rawNumericValue: pct,
      displayedValue: `${pct.toFixed(1)}% (${specimensCollected}/${nonEpiLinkedDenominator})`,
      numerator: specimensCollected,
      denominator: nonEpiLinkedDenominator,
      thresholdApplied: th,
      explanation: `${pct.toFixed(1)}% (${specimensCollected}/${nonEpiLinkedDenominator}) of non-epi-linked suspected cases had blood specimens collected within 0-28 days of rash onset (${th}, ${pts}/4 points).`,
      warnings: [],
    };
  }

  // SQ4: Timely laboratory results % (max 4)
  const casesWithSpecimen = input.surveillanceYearMinus1.casesWithSpecimensCollected;
  const timelyResults = input.surveillanceYearMinus1.timelyLaboratoryResults;

  if (casesWithSpecimen <= 0) {
    indicators.SQ4 = {
      indicatorId: "SQ4",
      domainId: "SURVEILLANCE_QUALITY",
      points: 0,
      maxPoints: 4,
      valueState: "ZERO_DENOMINATOR",
      rawNumericValue: null,
      displayedValue: "0 specimens collected",
      numerator: timelyResults,
      denominator: 0,
      thresholdApplied: "Zero denominator (0 pts default)",
      explanation: "No specimens collected in previous calendar year. Assigned 0 points.",
      warnings: [],
    };
  } else {
    const pct = (100 * timelyResults) / casesWithSpecimen;
    const pts = pct >= 80.0 ? 0 : 4;
    const th = pct >= 80.0 ? ">= 80%" : "< 80%";
    indicators.SQ4 = {
      indicatorId: "SQ4",
      domainId: "SURVEILLANCE_QUALITY",
      points: pts,
      maxPoints: 4,
      valueState: "OBSERVED",
      rawNumericValue: pct,
      displayedValue: `${pct.toFixed(1)}% (${timelyResults}/${casesWithSpecimen})`,
      numerator: timelyResults,
      denominator: casesWithSpecimen,
      thresholdApplied: th,
      explanation: `${pct.toFixed(1)}% (${timelyResults}/${casesWithSpecimen}) of collected specimens had lab results received within 10 days of collection (${th}, ${pts}/4 points).`,
      warnings: [],
    };
  }

  // -------------------------------------------------------------
  // DOMAIN 3: PROGRAMME DELIVERY PERFORMANCE (Max 16)
  // -------------------------------------------------------------

  // PD1: MCV1 trend OLS slope (max 4)
  const mcv1TrendData = input.coverage.mcv1
    .filter((c): c is { year: number; coveragePct: number } => c.coveragePct !== null)
    .map((c) => ({ year: c.year, value: capCoverage(c.coveragePct) ?? 0 }));

  if (mcv1TrendData.length < 2) {
    indicators.PD1 = {
      indicatorId: "PD1",
      domainId: "PROGRAMME_DELIVERY",
      points: null,
      maxPoints: 4,
      valueState: "MISSING",
      rawNumericValue: null,
      displayedValue: "Insufficient data",
      numerator: null,
      denominator: null,
      thresholdApplied: "None",
      explanation: "Requires at least 2 distinct calendar years of MCV1 coverage to fit a linear trend slope.",
      warnings: ["Insufficient years for trend"],
    };
  } else {
    const slope = calculateOlsSlope(mcv1TrendData) ?? 0;
    let pts = 4;
    let th = "Slope < -10";
    if (slope >= 0.0) {
      pts = 0;
      th = "Slope >= 0";
    } else if (slope >= -10.0) {
      pts = 2;
      th = "-10 <= Slope < 0";
    }

    indicators.PD1 = {
      indicatorId: "PD1",
      domainId: "PROGRAMME_DELIVERY",
      points: pts,
      maxPoints: 4,
      valueState: "OBSERVED",
      rawNumericValue: slope,
      displayedValue: `${slope >= 0 ? "+" : ""}${slope.toFixed(2)} pp/yr`,
      numerator: slope,
      denominator: 1,
      thresholdApplied: th,
      explanation: `MCV1 coverage OLS trend slope is ${slope >= 0 ? "+" : ""}${slope.toFixed(2)} percentage points per year (${th}, ${pts}/4 points).`,
      warnings: [],
    };
  }

  // PD2: MCV2 trend OLS slope (max 4)
  if (!isMcv2Introduced) {
    indicators.PD2 = {
      indicatorId: "PD2",
      domainId: "PROGRAMME_DELIVERY",
      points: 4,
      maxPoints: 4,
      valueState: "NOT_INTRODUCED",
      rawNumericValue: null,
      displayedValue: "Not Introduced (4 pts)",
      numerator: null,
      denominator: null,
      thresholdApplied: "Not Introduced (4 pts)",
      explanation: "MCV2 not introduced into routine schedule. Assigned 4 points per WHO methodology.",
      warnings: [],
    };
  } else {
    const mcv2TrendData = input.coverage.mcv2
      .filter((c): c is { year: number; coveragePct: number } => c.coveragePct !== null)
      .map((c) => ({ year: c.year, value: capCoverage(c.coveragePct) ?? 0 }));

    if (mcv2TrendData.length < 2) {
      indicators.PD2 = {
        indicatorId: "PD2",
        domainId: "PROGRAMME_DELIVERY",
        points: null,
        maxPoints: 4,
        valueState: "MISSING",
        rawNumericValue: null,
        displayedValue: "Insufficient data",
        numerator: null,
        denominator: null,
        thresholdApplied: "None",
        explanation: "Requires at least 2 distinct introduced years of MCV2 coverage to fit trend.",
        warnings: ["Insufficient MCV2 years for trend"],
      };
    } else {
      const slope = calculateOlsSlope(mcv2TrendData) ?? 0;
      let pts = 4;
      let th = "Slope < -10";
      if (slope >= 0.0) {
        pts = 0;
        th = "Slope >= 0";
      } else if (slope >= -10.0) {
        pts = 2;
        th = "-10 <= Slope < 0";
      }

      indicators.PD2 = {
        indicatorId: "PD2",
        domainId: "PROGRAMME_DELIVERY",
        points: pts,
        maxPoints: 4,
        valueState: "OBSERVED",
        rawNumericValue: slope,
        displayedValue: `${slope >= 0 ? "+" : ""}${slope.toFixed(2)} pp/yr`,
        numerator: slope,
        denominator: 1,
        thresholdApplied: th,
        explanation: `MCV2 coverage OLS trend slope is ${slope >= 0 ? "+" : ""}${slope.toFixed(2)} percentage points per year (${th}, ${pts}/4 points).`,
        warnings: [],
      };
    }
  }

  // PD3: MCV1 to MCV2 Dropout % (max 4)
  // Uses previous calendar year (index 2 in 3-year array)
  const prevYearMcv1 = capCoverage(input.coverage.mcv1[input.coverage.mcv1.length - 1]?.coveragePct ?? null);
  const prevYearMcv2 = capCoverage(input.coverage.mcv2[input.coverage.mcv2.length - 1]?.coveragePct ?? null);

  if (!isMcv2Introduced) {
    indicators.PD3 = {
      indicatorId: "PD3",
      domainId: "PROGRAMME_DELIVERY",
      points: 4,
      maxPoints: 4,
      valueState: "NOT_INTRODUCED",
      rawNumericValue: null,
      displayedValue: "Not Introduced (4 pts)",
      numerator: null,
      denominator: null,
      thresholdApplied: "Not Introduced (4 pts)",
      explanation: "MCV2 not introduced into routine schedule. Assigned 4 points.",
      warnings: [],
    };
  } else if (prevYearMcv1 === null || prevYearMcv2 === null) {
    indicators.PD3 = {
      indicatorId: "PD3",
      domainId: "PROGRAMME_DELIVERY",
      points: null,
      maxPoints: 4,
      valueState: "MISSING",
      rawNumericValue: null,
      displayedValue: "Missing previous-year coverage",
      numerator: null,
      denominator: null,
      thresholdApplied: "None",
      explanation: "MCV1 or MCV2 coverage for the previous calendar year is unavailable.",
      warnings: ["Missing previous year MCV1 or MCV2"],
    };
  } else if (prevYearMcv1 <= 0) {
    indicators.PD3 = {
      indicatorId: "PD3",
      domainId: "PROGRAMME_DELIVERY",
      points: 4,
      maxPoints: 4,
      valueState: "ZERO_DENOMINATOR",
      rawNumericValue: null,
      displayedValue: "Zero MCV1 coverage",
      numerator: prevYearMcv1 - prevYearMcv2,
      denominator: prevYearMcv1,
      thresholdApplied: "Zero denominator (4 pts)",
      explanation: "Previous year MCV1 coverage is 0%, indicating complete programme breakdown (4/4 points).",
      warnings: ["Zero MCV1 coverage denominator"],
    };
  } else {
    const dropout = (100 * (prevYearMcv1 - prevYearMcv2)) / prevYearMcv1;
    // Boundary rule: exactly 10.0% is <= 10.0% -> 0 points. > 10.0% -> 4 points.
    const pts = dropout <= 10.0 ? 0 : 4;
    const th = dropout <= 10.0 ? "<= 10%" : "> 10%";
    indicators.PD3 = {
      indicatorId: "PD3",
      domainId: "PROGRAMME_DELIVERY",
      points: pts,
      maxPoints: 4,
      valueState: "OBSERVED",
      rawNumericValue: dropout,
      displayedValue: `${dropout.toFixed(1)}%`,
      numerator: prevYearMcv1 - prevYearMcv2,
      denominator: prevYearMcv1,
      thresholdApplied: th,
      explanation: `MCV1-to-MCV2 dropout rate is ${dropout.toFixed(1)}% (MCV1: ${prevYearMcv1.toFixed(1)}%, MCV2: ${prevYearMcv2.toFixed(1)}%; ${th}, ${pts}/4 points).`,
      warnings: [],
    };
  }

  // PD4: Penta1/DPT1 to MCV1 Dropout % (max 4)
  const prevYearPenta1 = capCoverage(input.coverage.penta1[input.coverage.penta1.length - 1]?.coveragePct ?? null);

  if (prevYearPenta1 === null || prevYearMcv1 === null) {
    indicators.PD4 = {
      indicatorId: "PD4",
      domainId: "PROGRAMME_DELIVERY",
      points: null,
      maxPoints: 4,
      valueState: "MISSING",
      rawNumericValue: null,
      displayedValue: "Missing previous-year coverage",
      numerator: null,
      denominator: null,
      thresholdApplied: "None",
      explanation: "Penta1/DPT1 or MCV1 coverage for the previous calendar year is unavailable.",
      warnings: ["Missing previous year Penta1 or MCV1"],
    };
  } else if (prevYearPenta1 <= 0) {
    indicators.PD4 = {
      indicatorId: "PD4",
      domainId: "PROGRAMME_DELIVERY",
      points: 4,
      maxPoints: 4,
      valueState: "ZERO_DENOMINATOR",
      rawNumericValue: null,
      displayedValue: "Zero Penta1 coverage",
      numerator: prevYearPenta1 - prevYearMcv1,
      denominator: prevYearPenta1,
      thresholdApplied: "Zero denominator (4 pts)",
      explanation: "Previous year Penta1 coverage is 0%, indicating complete immunisation schedule failure (4/4 points).",
      warnings: ["Zero Penta1 coverage denominator"],
    };
  } else {
    const dropout = (100 * (prevYearPenta1 - prevYearMcv1)) / prevYearPenta1;
    // Boundary rule: exactly 10.0% is <= 10.0% -> 0 points. > 10.0% -> 4 points.
    const pts = dropout <= 10.0 ? 0 : 4;
    const th = dropout <= 10.0 ? "<= 10%" : "> 10%";
    indicators.PD4 = {
      indicatorId: "PD4",
      domainId: "PROGRAMME_DELIVERY",
      points: pts,
      maxPoints: 4,
      valueState: "OBSERVED",
      rawNumericValue: dropout,
      displayedValue: `${dropout.toFixed(1)}%`,
      numerator: prevYearPenta1 - prevYearMcv1,
      denominator: prevYearPenta1,
      thresholdApplied: th,
      explanation: `Penta1-to-MCV1 dropout rate is ${dropout.toFixed(1)}% (Penta1: ${prevYearPenta1.toFixed(1)}%, MCV1: ${prevYearMcv1.toFixed(1)}%; ${th}, ${pts}/4 points).`,
      warnings: [],
    };
  }

  // -------------------------------------------------------------
  // DOMAIN 4: THREAT ASSESSMENT (Max 24)
  // -------------------------------------------------------------

  // TA1: Qualifying case under age 5 (< 60 months) (max 4)
  const casesUnder5 = input.surveillanceYearMinus1.threatCasesUnder5;
  const ptsTA1 = casesUnder5 > 0 ? 4 : 0;
  indicators.TA1 = {
    indicatorId: "TA1",
    domainId: "THREAT_ASSESSMENT",
    points: ptsTA1,
    maxPoints: 4,
    valueState: "OBSERVED",
    rawNumericValue: casesUnder5,
    displayedValue: `${casesUnder5} case(s)`,
    numerator: casesUnder5,
    denominator: null,
    thresholdApplied: casesUnder5 > 0 ? ">= 1 case under 5 (4 pts)" : "0 cases (0 pts)",
    explanation: `${casesUnder5} qualifying measles case(s) reported in children under 5 years (< 60 months) in previous year (${ptsTA1}/4 points).`,
    warnings: [],
  };

  // TA2: Qualifying case aged 5 to 14 (60 to < 180 months) (max 3)
  const cases5to14 = input.surveillanceYearMinus1.threatCasesAge5To14;
  const ptsTA2 = cases5to14 > 0 ? 3 : 0;
  indicators.TA2 = {
    indicatorId: "TA2",
    domainId: "THREAT_ASSESSMENT",
    points: ptsTA2,
    maxPoints: 3,
    valueState: "OBSERVED",
    rawNumericValue: cases5to14,
    displayedValue: `${cases5to14} case(s)`,
    numerator: cases5to14,
    denominator: null,
    thresholdApplied: cases5to14 > 0 ? ">= 1 case aged 5-14 (3 pts)" : "0 cases (0 pts)",
    explanation: `${cases5to14} qualifying measles case(s) reported in cohort aged 5-14 years (${ptsTA2}/3 points).`,
    warnings: [],
  };

  // TA3: Qualifying case aged 15 or older (>= 180 months) (max 3)
  const cases15Plus = input.surveillanceYearMinus1.threatCasesAge15Plus;
  const ptsTA3 = cases15Plus > 0 ? 3 : 0;
  indicators.TA3 = {
    indicatorId: "TA3",
    domainId: "THREAT_ASSESSMENT",
    points: ptsTA3,
    maxPoints: 3,
    valueState: "OBSERVED",
    rawNumericValue: cases15Plus,
    displayedValue: `${cases15Plus} case(s)`,
    numerator: cases15Plus,
    denominator: null,
    thresholdApplied: cases15Plus > 0 ? ">= 1 case aged 15+ (3 pts)" : "0 cases (0 pts)",
    explanation: `${cases15Plus} qualifying measles case(s) reported in individuals aged 15 or older (${ptsTA3}/3 points).`,
    warnings: input.surveillanceYearMinus1.threatCasesUnknownAge > 0
      ? [`${input.surveillanceYearMinus1.threatCasesUnknownAge} case(s) had unknown age and did not count towards TA1-TA3 age bands`]
      : [],
  };

  // TA4: Population Density (max 4)
  if (input.areaKm2 <= 0 || pop <= 0) {
    indicators.TA4 = {
      indicatorId: "TA4",
      domainId: "THREAT_ASSESSMENT",
      points: null,
      maxPoints: 4,
      valueState: "INVALID",
      rawNumericValue: null,
      displayedValue: "Invalid Area/Population",
      numerator: pop,
      denominator: input.areaKm2,
      thresholdApplied: "None",
      explanation: "District area in km² and population must be positive numbers.",
      warnings: ["Area <= 0 or population <= 0"],
    };
  } else {
    const density = pop / input.areaKm2;
    let pts = 0;
    let th = "<= 50 per km²";
    if (density > 1000.0) {
      pts = 4;
      th = "> 1,000 per km²";
    } else if (density > 300.0) {
      pts = 3;
      th = "> 300 to <= 1,000 per km²";
    } else if (density > 100.0) {
      pts = 2;
      th = "> 100 to <= 300 per km²";
    } else if (density > 50.0) {
      pts = 1;
      th = "> 50 to <= 100 per km²";
    }

    indicators.TA4 = {
      indicatorId: "TA4",
      domainId: "THREAT_ASSESSMENT",
      points: pts,
      maxPoints: 4,
      valueState: "OBSERVED",
      rawNumericValue: density,
      displayedValue: `${density.toFixed(1)} / km²`,
      numerator: pop,
      denominator: input.areaKm2,
      thresholdApplied: th,
      explanation: `Population density is ${density.toFixed(1)} people per km² (${pop.toLocaleString()} pop / ${input.areaKm2.toLocaleString()} km²; ${th}, ${pts}/4 points).`,
      warnings: [],
    };
  }

  // TA5: Measles Case in Neighbouring Area (max 2)
  if (totalNeighbours === 0) {
    indicators.TA5 = {
      indicatorId: "TA5",
      domainId: "THREAT_ASSESSMENT",
      points: 0,
      maxPoints: 2,
      valueState: "NOT_APPLICABLE",
      rawNumericValue: 0,
      displayedValue: "No neighbours",
      numerator: 0,
      denominator: 0,
      thresholdApplied: "No neighbours exception (0 pts)",
      explanation: "District has no contiguous neighbours. Assigned 0 points.",
      warnings: [],
    };
  } else {
    const neighboursWithCases = input.neighbours.filter((n) => n.hasThreatCaseYearMinus1);
    const pts = neighboursWithCases.length > 0 ? 2 : 0;
    const th = neighboursWithCases.length > 0 ? ">= 1 case in any neighbour (2 pts)" : "No cases in neighbours (0 pts)";
    const affectedNames = neighboursWithCases.map((n) => n.areaName).join(", ");

    indicators.TA5 = {
      indicatorId: "TA5",
      domainId: "THREAT_ASSESSMENT",
      points: pts,
      maxPoints: 2,
      valueState: "OBSERVED",
      rawNumericValue: neighboursWithCases.length,
      displayedValue: `${neighboursWithCases.length}/${totalNeighbours} affected`,
      numerator: neighboursWithCases.length,
      denominator: totalNeighbours,
      thresholdApplied: th,
      explanation: neighboursWithCases.length > 0
        ? `${neighboursWithCases.length} of ${totalNeighbours} neighbouring districts reported qualifying measles transmission in previous year (${affectedNames}; ${pts}/2 points).`
        : `None of the ${totalNeighbours} neighbouring districts reported qualifying measles transmission in previous year (${pts}/2 points).`,
      warnings: [],
    };
  }

  // TA6: Vulnerable Population Factors (max 8)
  const vf = input.vulnerabilityFactors;
  const factorsPresent = [
    vf.migrantOrUnderserved,
    vf.vaccineHesitancyOrRefusal,
    vf.securityOrConflictConcerns,
    vf.recurrentNaturalDisasters,
    vf.poorAccessOrTerrain,
    vf.inadequatePoliticalSupport,
    vf.highTransitHubOrBorder,
    vf.massGatheringsOrEvents,
  ].filter(Boolean).length;

  indicators.TA6 = {
    indicatorId: "TA6",
    domainId: "THREAT_ASSESSMENT",
    points: factorsPresent,
    maxPoints: 8,
    valueState: "OBSERVED",
    rawNumericValue: factorsPresent,
    displayedValue: `${factorsPresent}/8 factors`,
    numerator: factorsPresent,
    denominator: 8,
    thresholdApplied: `${factorsPresent} factors present (${factorsPresent} pts)`,
    explanation: `${factorsPresent} of 8 verified contextual and vulnerable population risk factors are present in this district (${factorsPresent}/8 points).`,
    warnings: [],
  };

  // -------------------------------------------------------------
  // ROLLUP BY DOMAINS AND OVERALL SCORE
  // -------------------------------------------------------------

  const domains: Record<string, CalculatedDomainResult> = {};
  let totalScore: number | null = 0;
  let minPossible = 0;
  let maxPossible = 0;
  let isAnyIncomplete = false;

  for (const [domKey, domDef] of Object.entries(WHO_MEASLES_DOMAINS)) {
    let domPoints: number | null = 0;
    let domIsIncomplete = false;
    const indResults: Record<string, CalculatedIndicatorResult> = {};

    for (const indId of domDef.indicatorIds) {
      const ind = indicators[indId];
      indResults[indId] = ind;

      if (ind.points === null) {
        domIsIncomplete = true;
        isAnyIncomplete = true;
        maxPossible += ind.maxPoints;
      } else {
        if (domPoints !== null) domPoints += ind.points;
        minPossible += ind.points;
        maxPossible += ind.points;
      }
    }

    domains[domKey] = {
      domainId: domDef.id,
      points: domIsIncomplete ? null : domPoints,
      maxPoints: domDef.maxPoints,
      isIncomplete: domIsIncomplete,
      indicatorResults: indResults as Record<IndicatorId, CalculatedIndicatorResult>,
    };
  }

  if (isAnyIncomplete) {
    totalScore = null;
  } else {
    totalScore = Math.min(
      100,
      Math.round(
        (domains.POPULATION_IMMUNITY.points ?? 0) +
        (domains.SURVEILLANCE_QUALITY.points ?? 0) +
        (domains.PROGRAMME_DELIVERY.points ?? 0) +
        (domains.THREAT_ASSESSMENT.points ?? 0)
      )
    );
  }

  const category: RiskCategory = classifyRiskScore(totalScore ?? minPossible, isAnyIncomplete);

  const summary = isAnyIncomplete
    ? `Assessment is incomplete due to missing required indicators. Estimated possible score range is ${minPossible} to ${maxPossible} points.`
    : `Total Risk Score is ${totalScore}/100, classified as ${category} risk. (PI: ${domains.POPULATION_IMMUNITY.points}/40, SQ: ${domains.SURVEILLANCE_QUALITY.points}/20, PD: ${domains.PROGRAMME_DELIVERY.points}/16, TA: ${domains.THREAT_ASSESSMENT.points}/24).`;

  return {
    areaId: input.areaId,
    areaName: input.areaName,
    assessmentYear: input.assessmentYear,
    totalScore,
    maxTotalPoints: 100,
    riskCategory: category,
    isIncomplete: isAnyIncomplete,
    minPossibleScore: minPossible,
    maxPossibleScore: maxPossible,
    domains: domains as Record<DomainId, CalculatedDomainResult>,
    allIndicators: indicators as Record<IndicatorId, CalculatedIndicatorResult>,
    summaryExplanation: summary,
    calculatedAt: new Date().toISOString(),
  };
}
