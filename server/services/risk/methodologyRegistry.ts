/**
 * WHO Measles Programmatic Risk Assessment Methodology Registry
 * Package: WHO_MEASLES_GLOBAL_RECONCILED_V1
 * 
 * Reconciled against:
 * - WHO Measles Programmatic Risk Assessment Tool v1.8 (Setup Guide v1.5, Technical Appendix)
 * - Lam, E. et al. (2017) Risk Analysis 37(6):1052-1062
 * - Goel, K. et al. (2017) Risk Analysis 37(6):1063-1071
 * 
 * Invariants & Decisions:
 * 1. PI7 cutoff: >= 20% -> 6 pts, < 20% -> 0 pts. Zero cases in 3 years -> 6 pts (POLICY_ASSIGNED).
 * 2. PD3 & PD4 dropout: <= 10.0% -> 0 pts, > 10.0% -> 4 pts.
 * 3. TA1: <60 months (<5y), TA2: 60 to <180 months (5-14y), TA3: >=180 months (>=15y).
 * 4. Density bands: <=50 (0), 50-100 (1), 100-300 (2), 300-1000 (3), >1000 (4).
 * 5. Cutoffs: 0-47 Low, 48-54 Medium, 55-60 High, 61-100 Very High.
 */

export type DomainId = 
  | "POPULATION_IMMUNITY" 
  | "SURVEILLANCE_QUALITY" 
  | "PROGRAMME_DELIVERY" 
  | "THREAT_ASSESSMENT";

export type IndicatorId =
  // Population Immunity (Max 40)
  | "PI1" // MCV1 coverage 3-yr mean (max 8)
  | "PI2" // Neighbouring districts with MCV1 < 80% (max 4)
  | "PI3" // MCV2 coverage (max 8)
  | "PI4" // Measles SIA coverage (max 8)
  | "PI5" // SIA target age group (max 2)
  | "PI6" // Years since last qualifying SIA (max 4)
  | "PI7" // Unvaccinated / unknown age-eligible suspected cases (max 6)
  // Surveillance Quality (Max 20)
  | "SQ1" // Non-measles discarded rate per 100k (max 8)
  | "SQ2" // Adequate investigations % (max 4)
  | "SQ3" // Adequate specimen collection % (max 4)
  | "SQ4" // Timely laboratory results % (max 4)
  // Programme Delivery Performance (Max 16)
  | "PD1" // MCV1 trend OLS slope (max 4)
  | "PD2" // MCV2 trend OLS slope (max 4)
  | "PD3" // MCV1-MCV2 dropout % (max 4)
  | "PD4" // DPT1/Penta1-MCV1 dropout % (max 4)
  // Threat Assessment (Max 24)
  | "TA1" // Qualifying case under age 5 (max 4)
  | "TA2" // Qualifying case aged 5-14 (max 3)
  | "TA3" // Qualifying case aged 15 or older (max 3)
  | "TA4" // Population density per km² (max 4)
  | "TA5" // Measles case in neighbouring area (max 2)
  | "TA6"; // Vulnerable population factors (max 8)

export type RiskCategory = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | "INCOMPLETE";

export interface IndicatorDefinition {
  id: IndicatorId;
  code: string;
  name: string;
  domainId: DomainId;
  maxPoints: number;
  description: string;
  formulaDescription: string;
  requiredDataYears: number; // e.g. 3 years for PI1, 1 for SQ1
  thresholds: Array<{
    condition: string;
    points: number;
    explanation: string;
  }>;
}

export interface DomainDefinition {
  id: DomainId;
  name: string;
  maxPoints: number;
  indicatorIds: IndicatorId[];
}

export interface MethodologyDefinition {
  code: string;
  disease: string;
  name: string;
  version: string;
  sourceOrganization: string;
  publicationReferences: string[];
  maxTotalPoints: number;
  domains: Record<DomainId, DomainDefinition>;
  indicators: Record<IndicatorId, IndicatorDefinition>;
  cutoffs: {
    lowMax: number;       // <= 47
    mediumMin: number;    // 48
    mediumMax: number;    // 54
    highMin: number;      // 55
    highMax: number;      // 60
    veryHighMin: number;  // 61
  };
}

export const WHO_MEASLES_DOMAINS: Record<DomainId, DomainDefinition> = {
  POPULATION_IMMUNITY: {
    id: "POPULATION_IMMUNITY",
    name: "Population Immunity",
    maxPoints: 40,
    indicatorIds: ["PI1", "PI2", "PI3", "PI4", "PI5", "PI6", "PI7"],
  },
  SURVEILLANCE_QUALITY: {
    id: "SURVEILLANCE_QUALITY",
    name: "Surveillance Quality",
    maxPoints: 20,
    indicatorIds: ["SQ1", "SQ2", "SQ3", "SQ4"],
  },
  PROGRAMME_DELIVERY: {
    id: "PROGRAMME_DELIVERY",
    name: "Programme Delivery Performance",
    maxPoints: 16,
    indicatorIds: ["PD1", "PD2", "PD3", "PD4"],
  },
  THREAT_ASSESSMENT: {
    id: "THREAT_ASSESSMENT",
    name: "Threat Assessment",
    maxPoints: 24,
    indicatorIds: ["TA1", "TA2", "TA3", "TA4", "TA5", "TA6"],
  },
};

export const WHO_MEASLES_INDICATORS: Record<IndicatorId, IndicatorDefinition> = {
  PI1: {
    id: "PI1",
    code: "PI1_MCV1_COVERAGE",
    name: "MCV1 Coverage (3-Year Mean)",
    domainId: "POPULATION_IMMUNITY",
    maxPoints: 8,
    description: "Mean analytical MCV1 coverage over the preceding 3 calendar years.",
    formulaDescription: "mean(MCV1_year1, MCV1_year2, MCV1_year3)",
    requiredDataYears: 3,
    thresholds: [
      { condition: ">= 95%", points: 0, explanation: "High population immunity from routine vaccination" },
      { condition: "90% to < 95%", points: 2, explanation: "Moderate-high population immunity" },
      { condition: "85% to < 90%", points: 4, explanation: "Suboptimal population immunity" },
      { condition: "80% to < 85%", points: 6, explanation: "Low population immunity" },
      { condition: "< 80%", points: 8, explanation: "Critically low population immunity" },
    ],
  },
  PI2: {
    id: "PI2",
    code: "PI2_NEIGHBOUR_MCV1_BELOW_80",
    name: "Neighbouring Areas with MCV1 < 80%",
    domainId: "POPULATION_IMMUNITY",
    maxPoints: 4,
    description: "Percentage of approved neighbouring districts with 3-year mean MCV1 coverage below 80%.",
    formulaDescription: "100 * (neighbours_with_MCV1_lt_80 / total_approved_neighbours)",
    requiredDataYears: 3,
    thresholds: [
      { condition: "< 50%", points: 0, explanation: "Fewer than half of neighbouring areas have low coverage" },
      { condition: "50% to < 75%", points: 2, explanation: "Half to three-quarters of neighbours have low coverage" },
      { condition: ">= 75%", points: 4, explanation: "75% or more of neighbours have critically low coverage" },
    ],
  },
  PI3: {
    id: "PI3",
    code: "PI3_MCV2_COVERAGE",
    name: "MCV2 Coverage (3-Year Mean)",
    domainId: "POPULATION_IMMUNITY",
    maxPoints: 8,
    description: "Mean analytical MCV2 coverage over introduced years in the 3-year window. Assigns 8 pts if MCV2 not introduced.",
    formulaDescription: "mean(MCV2_introduced_years) or 8 if NOT_INTRODUCED",
    requiredDataYears: 3,
    thresholds: [
      { condition: ">= 95%", points: 0, explanation: "High second-dose routine immunity" },
      { condition: "90% to < 95%", points: 2, explanation: "Moderate-high second-dose coverage" },
      { condition: "85% to < 90%", points: 4, explanation: "Suboptimal second-dose coverage" },
      { condition: "80% to < 85%", points: 6, explanation: "Low second-dose coverage" },
      { condition: "< 80% or Not Introduced", points: 8, explanation: "Critically low second-dose coverage or vaccine not introduced" },
    ],
  },
  PI4: {
    id: "PI4",
    code: "PI4_MEASLES_SIA_COVERAGE",
    name: "Measles SIA Coverage",
    domainId: "POPULATION_IMMUNITY",
    maxPoints: 8,
    description: "Administrative or validated survey coverage of the most recent qualifying nationwide/districtwide measles SIA.",
    formulaDescription: "Coverage of most recent qualifying campaign within window",
    requiredDataYears: 3,
    thresholds: [
      { condition: ">= 95%", points: 0, explanation: "High campaign coverage" },
      { condition: "90% to < 95%", points: 2, explanation: "Substantial campaign coverage" },
      { condition: "85% to < 90%", points: 4, explanation: "Moderate campaign coverage" },
      { condition: "< 85% or unknown", points: 6, explanation: "Low campaign coverage or conducted without coverage data" },
      { condition: "No qualifying SIA", points: 8, explanation: "No qualifying measles SIA conducted in assessment period" },
    ],
  },
  PI5: {
    id: "PI5",
    code: "PI5_SIA_TARGET_AGE_GROUP",
    name: "SIA Target Age Group",
    domainId: "POPULATION_IMMUNITY",
    maxPoints: 2,
    description: "Target age cohort of the most recent qualifying measles SIA (e.g., wide 6m-14y vs narrow 6m-59m).",
    formulaDescription: "Target age group breadth",
    requiredDataYears: 3,
    thresholds: [
      { condition: "Wide target age group", points: 0, explanation: "Broad cohort vaccinated (e.g. 6-179 months)" },
      { condition: "Narrow target age group or No SIA", points: 2, explanation: "Narrow cohort vaccinated (e.g. <5y only) or no SIA conducted" },
    ],
  },
  PI6: {
    id: "PI6",
    code: "PI6_YEARS_SINCE_LAST_SIA",
    name: "Years Since Last Qualifying SIA",
    domainId: "POPULATION_IMMUNITY",
    maxPoints: 4,
    description: "Number of elapsed calendar years since completion of the most recent qualifying SIA.",
    formulaDescription: "assessment_year - campaign_completion_year",
    requiredDataYears: 3,
    thresholds: [
      { condition: "0 or 1 year", points: 0, explanation: "Recent campaign within 0-1 years" },
      { condition: "2 years", points: 2, explanation: "Campaign conducted 2 years ago" },
      { condition: ">= 3 years or No SIA", points: 4, explanation: "3 or more years elapsed or no qualifying SIA" },
    ],
  },
  PI7: {
    id: "PI7",
    code: "PI7_UNVACCINATED_UNKNOWN_SUSPECTED_CASES",
    name: "Unvaccinated or Unknown Age-Eligible Cases",
    domainId: "POPULATION_IMMUNITY",
    maxPoints: 6,
    description: "Percentage of age-eligible suspected cases who are unvaccinated or have unknown vaccination status over 3 years.",
    formulaDescription: "100 * (eligible_unvaccinated_or_unknown / eligible_suspected_cases)",
    requiredDataYears: 3,
    thresholds: [
      { condition: "< 20%", points: 0, explanation: "Less than 20% of age-eligible cases lacked vaccination confirmation" },
      { condition: ">= 20% (or 0 cases)", points: 6, explanation: ">= 20% unvaccinated/unknown, or 0 cases in complete 3-year period (policy rule)" },
    ],
  },
  SQ1: {
    id: "SQ1",
    code: "SQ1_NON_MEASLES_DISCARDED_RATE",
    name: "Non-Measles Discarded Rate",
    domainId: "SURVEILLANCE_QUALITY",
    maxPoints: 8,
    description: "Annual discarded non-measles non-rubella case rate per 100,000 population in the previous calendar year.",
    formulaDescription: "100,000 * (discarded_cases / population)",
    requiredDataYears: 1,
    thresholds: [
      { condition: ">= 2 per 100k (pop >= 100k) or >= 1 discarded (pop 50k-100k)", points: 0, explanation: "Surveillance sensitivity meets WHO target" },
      { condition: "1 to < 2 per 100k (pop >= 100k)", points: 4, explanation: "Suboptimal surveillance sensitivity" },
      { condition: "< 1 per 100k (pop >= 100k) or 0 discarded (pop 50k-100k)", points: 8, explanation: "Poor surveillance sensitivity (silent district risk)" },
      { condition: "Population < 50,000", points: 0, explanation: "Exempted from scoring per WHO technical appendix" },
    ],
  },
  SQ2: {
    id: "SQ2",
    code: "SQ2_ADEQUATE_INVESTIGATION_PCT",
    name: "Adequate Investigation Rate",
    domainId: "SURVEILLANCE_QUALITY",
    maxPoints: 4,
    description: "Percentage of suspected measles cases adequately investigated within 48 hours with core fields complete.",
    formulaDescription: "100 * (adequately_investigated / suspected_cases)",
    requiredDataYears: 1,
    thresholds: [
      { condition: ">= 80%", points: 0, explanation: "Investigation timeliness and completeness meet target (>= 80%)" },
      { condition: "< 80%", points: 4, explanation: "Investigation timeliness and completeness below target (< 80%)" },
    ],
  },
  SQ3: {
    id: "SQ3",
    code: "SQ3_ADEQUATE_SPECIMEN_COLLECTION_PCT",
    name: "Adequate Specimen Collection Rate",
    domainId: "SURVEILLANCE_QUALITY",
    maxPoints: 4,
    description: "Percentage of non-epidemiologically linked suspected cases with blood specimen collected 0-28 days after rash onset.",
    formulaDescription: "100 * (adequate_specimens / (suspected_cases - epi_linked_cases))",
    requiredDataYears: 1,
    thresholds: [
      { condition: ">= 80%", points: 0, explanation: "Laboratory confirmation rate meets target (>= 80%)" },
      { condition: "< 80%", points: 4, explanation: "Laboratory confirmation rate below target (< 80%)" },
    ],
  },
  SQ4: {
    id: "SQ4",
    code: "SQ4_TIMELY_LAB_RESULTS_PCT",
    name: "Timely Laboratory Results Rate",
    domainId: "SURVEILLANCE_QUALITY",
    maxPoints: 4,
    description: "Percentage of collected specimens with results received within 10 days of collection.",
    formulaDescription: "100 * (timely_results / cases_with_specimen)",
    requiredDataYears: 1,
    thresholds: [
      { condition: ">= 80%", points: 0, explanation: "Laboratory turnaround time meets target (>= 80%)" },
      { condition: "< 80%", points: 4, explanation: "Laboratory turnaround time below target (< 80%)" },
    ],
  },
  PD1: {
    id: "PD1",
    code: "PD1_MCV1_COVERAGE_TREND",
    name: "MCV1 Coverage Trend",
    domainId: "PROGRAMME_DELIVERY",
    maxPoints: 4,
    description: "Annual percentage-point change in MCV1 coverage fitted via ordinary least squares regression over previous 3 years.",
    formulaDescription: "OLS slope of MCV1 coverage over years",
    requiredDataYears: 3,
    thresholds: [
      { condition: "Slope >= 0 pp/year", points: 0, explanation: "Coverage improving or stable" },
      { condition: "-10 <= Slope < 0 pp/year", points: 2, explanation: "Moderate coverage decline (up to 10 pp/year)" },
      { condition: "Slope < -10 pp/year", points: 4, explanation: "Severe coverage decline (> 10 pp/year)" },
    ],
  },
  PD2: {
    id: "PD2",
    code: "PD2_MCV2_COVERAGE_TREND",
    name: "MCV2 Coverage Trend",
    domainId: "PROGRAMME_DELIVERY",
    maxPoints: 4,
    description: "Annual percentage-point change in MCV2 coverage fitted via ordinary least squares regression.",
    formulaDescription: "OLS slope of MCV2 coverage over years (or 4 pts if not introduced)",
    requiredDataYears: 3,
    thresholds: [
      { condition: "Slope >= 0 pp/year", points: 0, explanation: "Second-dose coverage improving or stable" },
      { condition: "-10 <= Slope < 0 pp/year", points: 2, explanation: "Moderate second-dose coverage decline" },
      { condition: "Slope < -10 pp/year or Not Introduced", points: 4, explanation: "Severe decline or vaccine not introduced" },
    ],
  },
  PD3: {
    id: "PD3",
    code: "PD3_MCV1_TO_MCV2_DROPOUT",
    name: "MCV1 to MCV2 Dropout Rate",
    domainId: "PROGRAMME_DELIVERY",
    maxPoints: 4,
    description: "Percentage difference between MCV1 and MCV2 coverage in the previous calendar year.",
    formulaDescription: "100 * (MCV1 - MCV2) / MCV1",
    requiredDataYears: 1,
    thresholds: [
      { condition: "<= 10.0%", points: 0, explanation: "Dropout rate acceptable (<= 10%)" },
      { condition: "> 10.0%", points: 4, explanation: "High dropout rate between first and second doses (> 10%)" },
    ],
  },
  PD4: {
    id: "PD4",
    code: "PD4_PENTA1_TO_MCV1_DROPOUT",
    name: "Penta1/DPT1 to MCV1 Dropout Rate",
    domainId: "PROGRAMME_DELIVERY",
    maxPoints: 4,
    description: "Percentage difference between Penta1/DPT1 and MCV1 coverage in the previous calendar year.",
    formulaDescription: "100 * (Penta1 - MCV1) / Penta1",
    requiredDataYears: 1,
    thresholds: [
      { condition: "<= 10.0%", points: 0, explanation: "Dropout rate acceptable (<= 10%)" },
      { condition: "> 10.0%", points: 4, explanation: "High dropout rate across childhood vaccination schedule (> 10%)" },
    ],
  },
  TA1: {
    id: "TA1",
    code: "TA1_MEASLES_CASE_UNDER_5",
    name: "Measles Threat Case: Under Age 5",
    domainId: "THREAT_ASSESSMENT",
    maxPoints: 4,
    description: "Occurrence of at least one qualifying measles case in children under 5 years (< 60 months) in the previous calendar year.",
    formulaDescription: "Count of confirmed/epi-linked/clinical cases < 60 months > 0",
    requiredDataYears: 1,
    thresholds: [
      { condition: "No cases under 5", points: 0, explanation: "No qualifying measles cases detected under age 5" },
      { condition: ">= 1 case under 5", points: 4, explanation: "Measles transmission detected in children under age 5" },
    ],
  },
  TA2: {
    id: "TA2",
    code: "TA2_MEASLES_CASE_AGE_5_TO_14",
    name: "Measles Threat Case: Age 5 to 14",
    domainId: "THREAT_ASSESSMENT",
    maxPoints: 3,
    description: "Occurrence of at least one qualifying measles case in children aged 5-14 years (60 to < 180 months) in previous calendar year.",
    formulaDescription: "Count of confirmed/epi-linked/clinical cases 60 to < 180 months > 0",
    requiredDataYears: 1,
    thresholds: [
      { condition: "No cases aged 5-14", points: 0, explanation: "No qualifying measles cases detected in school-age cohort" },
      { condition: ">= 1 case aged 5-14", points: 3, explanation: "Measles transmission detected in school-age cohort" },
    ],
  },
  TA3: {
    id: "TA3",
    code: "TA3_MEASLES_CASE_AGE_15_PLUS",
    name: "Measles Threat Case: Age 15 or Older",
    domainId: "THREAT_ASSESSMENT",
    maxPoints: 3,
    description: "Occurrence of at least one qualifying measles case in individuals aged 15 or older (>= 180 months) in previous calendar year.",
    formulaDescription: "Count of confirmed/epi-linked/clinical cases >= 180 months > 0",
    requiredDataYears: 1,
    thresholds: [
      { condition: "No cases aged 15+", points: 0, explanation: "No qualifying measles cases detected in adolescents/adults" },
      { condition: ">= 1 case aged 15+", points: 3, explanation: "Measles transmission detected in adolescents/adults" },
    ],
  },
  TA4: {
    id: "TA4",
    code: "TA4_POPULATION_DENSITY",
    name: "Population Density",
    domainId: "THREAT_ASSESSMENT",
    maxPoints: 4,
    description: "Population density per square kilometre in the assessment area.",
    formulaDescription: "population / area_km2",
    requiredDataYears: 1,
    thresholds: [
      { condition: "<= 50 per km²", points: 0, explanation: "Low transmission risk from low density (<= 50/km²)" },
      { condition: "> 50 to <= 100 per km²", points: 1, explanation: "Moderate-low transmission risk (51-100/km²)" },
      { condition: "> 100 to <= 300 per km²", points: 2, explanation: "Moderate transmission risk (101-300/km²)" },
      { condition: "> 300 to <= 1,000 per km²", points: 3, explanation: "High transmission risk (301-1,000/km²)" },
      { condition: "> 1,000 per km²", points: 4, explanation: "Very high transmission risk in dense urban environment (> 1,000/km²)" },
    ],
  },
  TA5: {
    id: "TA5",
    code: "TA5_MEASLES_CASE_IN_NEIGHBOUR",
    name: "Measles Case in Neighbouring Area",
    domainId: "THREAT_ASSESSMENT",
    maxPoints: 2,
    description: "Occurrence of at least one qualifying measles case in any approved neighbouring district in the previous calendar year.",
    formulaDescription: "Any approved neighbouring area has >= 1 qualifying measles case",
    requiredDataYears: 1,
    thresholds: [
      { condition: "No cases in neighbours", points: 0, explanation: "No confirmed/epi-linked/clinical measles cases reported in neighbouring districts" },
      { condition: ">= 1 case in any neighbour", points: 2, explanation: "Active measles transmission in at least one contiguous neighbouring district" },
    ],
  },
  TA6: {
    id: "TA6",
    code: "TA6_VULNERABLE_POPULATION_FACTORS",
    name: "Vulnerable Population Factors",
    domainId: "THREAT_ASSESSMENT",
    maxPoints: 8,
    description: "Presence of 8 standardized vulnerable population and contextual risk factors (1 point each).",
    formulaDescription: "Sum of present vulnerable factors (1 pt each, max 8)",
    requiredDataYears: 1,
    thresholds: [
      { condition: "0 to 8 factors present", points: 8, explanation: "1 point per verified contextual risk factor present" },
    ],
  },
};

export const WHO_TOOL_V1_8_CUTOFFS = {
  lowMax: 31,
  mediumMin: 32,
  mediumMax: 44,
  highMin: 45,
  highMax: 56,
  veryHighMin: 57,
};

export const GLOBAL_LAM_2017_CUTOFFS = {
  lowMax: 47,
  mediumMin: 48,
  mediumMax: 54,
  highMin: 55,
  highMax: 60,
  veryHighMin: 61,
};

export const WHO_MEASLES_GLOBAL_RECONCILED_V1: MethodologyDefinition = {
  code: "WHO_MEASLES_GLOBAL_RECONCILED_V1",
  disease: "MEASLES",
  name: "WHO Measles Programmatic Risk Assessment (Reconciled V1.0)",
  version: "1.0.0",
  sourceOrganization: "World Health Organization (WHO)",
  publicationReferences: [
    "WHO (n.d.a) Measles Programmatic Risk Assessment Tool",
    "WHO (n.d.b) Technical Appendix: World Health Organization Measles Programmatic Risk Assessment Tool",
    "WHO (n.d.c) Measles Risk Assessment Tool Setup Guide v1.5",
    "Lam, E. et al. (2017) Risk Analysis 37(6):1052-1062",
    "Goel, K. et al. (2017) Risk Analysis 37(6):1063-1071",
  ],
  maxTotalPoints: 100,
  domains: WHO_MEASLES_DOMAINS,
  indicators: WHO_MEASLES_INDICATORS,
  cutoffs: WHO_TOOL_V1_8_CUTOFFS,
};

/**
 * Standard classification helper
 * Defaults to WHO Tool v1.8 Regional cutoff standards:
 * - Low: < 32
 * - Medium: 32 - 44
 * - High: 45 - 56
 * - Very High: >= 57
 * Supports GLOBAL_LAM_2017 model (<=47, 48-54, 55-60, >=61) when specified.
 */
export function classifyRiskScore(
  totalScore: number,
  isIncomplete: boolean = false,
  model: "WHO_TOOL_V1_8" | "GLOBAL_LAM_2017" = "WHO_TOOL_V1_8"
): RiskCategory {
  if (isIncomplete) return "INCOMPLETE";

  if (model === "GLOBAL_LAM_2017") {
    if (totalScore <= 47) return "LOW";
    if (totalScore <= 54) return "MEDIUM";
    if (totalScore <= 60) return "HIGH";
    return "VERY_HIGH";
  }

  // Default: WHO Tool v1.8 Regional standard
  if (totalScore < 32) return "LOW";
  if (totalScore < 45) return "MEDIUM";
  if (totalScore < 57) return "HIGH";
  return "VERY_HIGH";
}

