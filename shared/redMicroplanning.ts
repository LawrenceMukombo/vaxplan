import { z } from "zod";

type Field = { key: string; label: string; type?: "number" | "date"; options?: string[] };
const f = (key: string, label: string, type?: Field["type"]): Field => ({ key, label, type });
const choice = (key: string, label: string, options: string[]): Field => ({ key, label, options });
export const redSteps = [
  { id: "analysis", title: "Quantitative analysis of local immunization data", wizard: 1, page: 9, fields: [f("area", "Area / community"), f("periodStart", "12-month period start", "date"), f("periodEnd", "12-month period end", "date"), f("source", "Data source and denominator reconciliation"), f("infants", "Target population under one", "number"), f("pregnant", "Pregnant women denominator", "number"), f("first", "First dose administered (DTP/Penta1)", "number"), f("third", "Third dose administered (DTP/Penta3)", "number"), f("measles", "Measles first doses administered", "number"), f("td", "TT2+/Td doses administered", "number"), f("accessCutoff", "Access coverage threshold (%)", "number"), f("dropoutCutoff", "Dropout threshold (%)", "number"), f("priority", "Agreed unique priority rank", "number"), f("rationale", "Priority rationale / data quality issues")] },
  { id: "map", title: "Preparing and reviewing an operational map", wizard: 2, page: 14, fields: [f("area", "Area / settlement"), f("total", "Total population", "number"), f("target", "Target population", "number"), f("groups", "All population groups, including mobile and urban settlements"), f("mapReference", "Map reference / coordinates"), f("landmarks", "Roads, rivers, mountains and route"), f("distance", "Distance from facility (km)", "number"), f("transport", "Usual transport"), f("travelTime", "Travel time (minutes)", "number"), f("movement", "Nomadic location and movement calendar"), f("season", "Seasonal accessibility and accessible months"), choice("type", "Service strategy", ["fixed", "outreach", "mobile"]), f("site", "Session location"), f("reviewer", "Map reviewed with / by"), f("reviewDate", "Map review date", "date")] },
  { id: "special", title: "Special activities for hard-to-reach and problem areas", wizard: 3, page: 16, fields: [f("area", "Area in priority order"), f("priority", "Priority rank", "number"), choice("category", "Access / utilization category", ["1", "2", "3", "4", "not assessed"]), choice("hardToReach", "Hard to reach", ["yes", "no", "unknown"]), f("reached", "Times reached in previous 12 months", "number"), f("facilityActivities", "Activities deliverable by the facility"), f("districtActivities", "Activities requiring district or higher support"), f("integrated", "Other interventions to deliver together")] },
  { id: "sessions", title: "Preparing a health facility session plan", wizard: 4, page: 19, fields: [f("area", "Area / site"), f("total", "Total population", "number"), f("target", "Target population", "number"), f("group", "Target group / eligibility"), choice("type", "Session type", ["fixed", "outreach", "mobile"]), f("schedule", "National schedule reference and workload assumptions"), f("injections", "Injections per target person per year", "number"), f("capacity", "Realistic injections per session", "number"), f("planned", "Actual sessions planned per year", "number"), f("frequency", "Frequency / accessible months"), f("reason", "Reason for chosen frequency, staffing and travel constraints"), f("integrated", "Integrated interventions"), choice("hardToReach", "Hard to reach", ["yes", "no", "unknown"])] },
  { id: "problems", title: "Problem solving using the RED strategy", wizard: 3, page: 23, fields: [choice("component", "RED component", ["Outreach services", "Supportive supervision", "Community links", "Monitoring and use of data", "Planning and management of resources"]), f("area", "Area or whole catchment"), f("problem", "Problem and supporting evidence"), f("localAction", "Activity with facility resources"), f("districtAction", "Activity needing district assistance"), f("owner", "Responsible person"), f("due", "Action deadline", "date"), f("actionReference", "Action register reference")] },
  { id: "workplan", title: "Making a workplan for one quarter", wizard: 4, page: 26, fields: [f("area", "Area / site"), choice("activityType", "Activity type", ["fixed session", "outreach session", "mobile session", "hard-to-reach activity", "problem-solving activity", "regular activity"]), f("activity", "Activity / existing session reference"), f("date", "Planned date", "date"), f("owner", "Responsible person"), f("transport", "Transport required"), f("districtSupport", "District staff, vehicle or other support required"), f("integrated", "Integrated intervention"), f("conflicts", "Scheduling conflicts and resolution")] },
  { id: "monitoring", title: "Using a monitoring chart", wizard: 12, page: 29, fields: [f("area", "Area"), f("year", "Year", "number"), f("target", "Annual target population", "number"), f("source", "Population source"), f("firstDose", "First vaccine / dose to monitor"), f("lastDose", "Completion vaccine / dose to monitor"), f("chart", "Monitoring chart / dashboard reference"), f("owner", "Person updating the chart"), f("reviewFrequency", "Update and review frequency"), f("trigger", "Trigger and planned response to low coverage / dropout")] },
  { id: "community", title: "Working with the community and tracking defaulters", wizard: 7, page: 32, fields: [f("area", "Community"), f("representatives", "Leaders, volunteers and participant groups"), f("consultation", "Consultation date", "date"), f("preferences", "Community preferences for place and time"), f("feedback", "Service feedback and agreed changes"), f("barriers", "Social, gender, economic and access barriers reported"), f("births", "Method for reporting newborns and pregnancies"), f("notification", "Session notification method and lead time"), f("tracking", "Defaulter identification and follow-up method"), f("owner", "Follow-up owner"), f("frequency", "Register review / follow-up frequency"), f("evidence", "Consultation / barrier record reference")] },
  { id: "supplies", title: "Managing supplies", wizard: 6, page: 34, fields: [f("item", "Vaccine / safe-injection supply"), f("presentation", "Presentation (doses per vial / units per box)"), f("minimum", "Minimum stock (doses / units)", "number"), f("quarterly", "Quarterly supply requirement (doses / units)", "number"), f("stockReference", "Stock record / forecast reference"), f("owner", "Stock review owner"), f("frequency", "Physical stock verification frequency"), f("quality", "Plan for VVM, expiry and cold-chain checks"), f("replenishment", "Replenishment timing and escalation plan")] },
  { id: "report", title: "Making use of the monthly report", wizard: 12, page: 37, fields: [f("month", "Reporting month / year"), f("owner", "Report owner"), f("due", "Report due date", "date"), f("recipient", "District recipient"), f("sources", "Coverage, surveillance, stock and AEFI source references"), f("supervision", "Last supervisory visit date", "date"), f("missed", "Cancelled sessions and reasons / service review references"), f("replanned", "Replacement session plan and dates"), f("solved", "Problems solved since last report"), f("outstanding", "Outstanding facility / district problems"), f("actions", "Action owners, deadlines and register references"), f("feedback", "District feedback and next review date")] },
] as const;
export type RedRow = Record<string, string | number>;
export type RedWorksheet = { title: string; sections: Record<string, RedRow[]>; completedSteps: string[] };
export const redWorksheetSchema = z.object({ title: z.string().trim().min(1).max(200), sections: z.record(z.array(z.record(z.union([z.string().max(4000), z.number().finite().min(0).max(1e9)]))).max(1000)), completedSteps: z.array(z.enum(redSteps.map(step => step.id) as [string, ...string[]])).default([]) }).strict().superRefine((value, ctx) => {
  for (const [section, rows] of Object.entries(value.sections)) {
    const step = redSteps.find(s => s.id === section);
    if (!step) { ctx.addIssue({ code: "custom", path: ["sections", section], message: "Unknown RED step" }); continue; }
    rows.forEach((row, i) => Object.entries(row).forEach(([key, val]) => {
      const field = (step.fields as readonly Field[]).find(f => f.key === key);
      const invalid = !field || (val !== "" && (field.type === "number" ? typeof val !== "number" : typeof val !== "string")) || (val !== "" && field?.options && !field.options.includes(String(val))) || (val !== "" && field?.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(String(val)) || !Number.isFinite(Date.parse(String(val))) || new Date(String(val)).toISOString().slice(0, 10) !== val));
      if (invalid) ctx.addIssue({ code: "custom", path: ["sections", section, i, key], message: "Invalid field value" });
    }));
  }
});
export function redMetrics(section: string, row: RedRow): Record<string, number | string | null> {
  const n = (key: string) => typeof row[key] === "number" ? row[key] as number : null;
  const ratio = (a: number | null, b: number | null) => a !== null && b !== null && b > 0 ? a / b : null;
  const pct = (a: number | null, b: number | null) => { const r = ratio(a, b); return r === null ? null : r * 100; };
  if (section === "analysis") {
    const first = n("first"), third = n("third"), measles = n("measles"), target = n("infants");
    const access = pct(first, target), dropout = pct(first !== null && third !== null ? first - third : null, first);
    const goodAccess = access !== null && n("accessCutoff") !== null ? access >= n("accessCutoff")! : null;
    const goodUse = dropout !== null && n("dropoutCutoff") !== null ? dropout <= n("dropoutCutoff")! : null;
    return { "First-dose coverage %": access, "Third-dose coverage %": pct(third, target), "Measles coverage %": pct(measles, target), "TT2+/Td coverage %": pct(n("td"), n("pregnant")), "Unimmunized third-dose estimate": target !== null && third !== null ? target - third : null, "Unimmunized measles estimate": target !== null && measles !== null ? target - measles : null, "First-to-third dropout %": dropout, "First-to-measles dropout %": pct(first !== null && measles !== null ? first - measles : null, first), "Access": goodAccess === null ? null : goodAccess ? "good" : "poor", "Utilization": goodUse === null ? null : goodUse ? "good" : "poor", "RED category": goodAccess === null || goodUse === null ? null : goodAccess ? goodUse ? 1 : 2 : goodUse ? 3 : 4 };
  }
  if (section === "sessions") { const annual = n("target") !== null && n("injections") !== null ? n("target")! * n("injections")! : null; return { "Annual injections": annual, "Monthly injections": annual === null ? null : annual / 12, "Estimated sessions per month": ratio(annual === null ? null : annual / 12, n("capacity")), "Planned sessions per month (average)": n("planned") === null ? null : n("planned")! / 12 }; }
  if (section === "monitoring") return { "Monthly target": n("target") === null ? null : n("target")! / 12 };
  if (section === "supplies") return { "Maximum stock (minimum + quarterly)": n("minimum") !== null && n("quarterly") !== null ? n("minimum")! + n("quarterly")! : null };
  return {};
}

// ---------------------------------------------------------------------------
// Authoritative WHO RED (2018) & Immunization in Practice (2025) Pure Helpers
// ---------------------------------------------------------------------------

/**
 * Calculates WHO RED 4-Category prioritization (RED Tool 1e & IIP p. 198):
 * - Cat 1: High access (>= 80%), Low dropout (<= 10%) [Lowest risk / maintain]
 * - Cat 2: High access (>= 80%), High dropout (> 10%) [Retention problem]
 * - Cat 3: Low access (< 80%), Low dropout (<= 10%) [Access problem]
 * - Cat 4: Low access (< 80%), High dropout (> 10%) [Dual access & retention crisis / Priority 1]
 */
export function calculateRedCategory(
  accessCoveragePct: number | null,
  dtpDropoutPct: number | null,
  accessThreshold = 80,
  dropoutThreshold = 10
): 1 | 2 | 3 | 4 | null {
  if (accessCoveragePct === null || dtpDropoutPct === null) return null;
  const goodAccess = accessCoveragePct >= accessThreshold;
  const goodUse = dtpDropoutPct <= dropoutThreshold;
  if (goodAccess && goodUse) return 1;
  if (goodAccess && !goodUse) return 2;
  if (!goodAccess && goodUse) return 3;
  return 4;
}

export interface DropoutCalculationInput {
  dtp1?: number | null;
  dtp3?: number | null;
  mcv1?: number | null;
  mcv2?: number | null;
}

export interface DropoutCalculationResult {
  dtp1Dtp3DropoutPct: number | null;
  dtp1Dtp3DropoutCount: number | null;
  dtp1Mcv1DropoutPct: number | null;
  dtp1Mcv1DropoutCount: number | null;
  mcv1Mcv2DropoutPct: number | null;
  mcv1Mcv2DropoutCount: number | null;
}

/**
 * Computes all 3 standard drop-out rates mandated by WHO IIP 2025 Module 4 Fig 4.5/4.6:
 * 1. DTP1 -> DTP3 (retention through primary infant course)
 * 2. DTP1 -> MCV1 (retention through end of infancy)
 * 3. MCV1 -> MCV2 (retention through second year of life / 2YL)
 */
export function calculateDropouts(input: DropoutCalculationInput): DropoutCalculationResult {
  const { dtp1, dtp3, mcv1, mcv2 } = input;
  const calc = (first?: number | null, second?: number | null) => {
    if (first == null || second == null || first <= 0) return { pct: null, count: null };
    const count = first - second;
    const pct = Math.round(((first - second) / first) * 100);
    return { pct, count };
  };
  const dtp = calc(dtp1, dtp3);
  const mcv = calc(dtp1, mcv1);
  const mcv2Drop = calc(mcv1, mcv2);
  return {
    dtp1Dtp3DropoutPct: dtp.pct,
    dtp1Dtp3DropoutCount: dtp.count,
    dtp1Mcv1DropoutPct: mcv.pct,
    dtp1Mcv1DropoutCount: mcv.count,
    mcv1Mcv2DropoutPct: mcv2Drop.pct,
    mcv1Mcv2DropoutCount: mcv2Drop.count,
  };
}

/**
 * Computes Zero-Dose children count and percentage (IIP 2025 Module 4 §3.2):
 * Zero-Dose = Target infants (<1y) - DTP1 vaccinated
 */
export function calculateZeroDose(
  targetInfants: number | null,
  dtp1Doses: number | null
): { zeroDoseCount: number | null; zeroDosePct: number | null } {
  if (targetInfants == null || targetInfants <= 0) return { zeroDoseCount: null, zeroDosePct: null };
  const vaccinated = dtp1Doses ?? 0;
  const zeroDoseCount = Math.max(0, targetInfants - vaccinated);
  const zeroDosePct = Math.min(100, Math.max(0, Math.round((zeroDoseCount / targetInfants) * 100)));
  return { zeroDoseCount, zeroDosePct };
}

/**
 * Calculates WHO workload-driven session frequency (RED Tool 2a & IIP pp. 216-220):
 * Total annual injections = Annual target * Injections per child (default 10)
 * Monthly sessions needed = (Total annual injections / 12) / Capacity per session
 */
export function calculateRecommendedSessions(
  annualTarget: number,
  injectionsPerChild = 10,
  capacityPerSession = 40
): {
  annualInjections: number;
  monthlyInjections: number;
  recommendedSessionsPerMonth: number;
  recommendedSessionsPerYear: number;
} {
  const annualInjections = Math.max(0, annualTarget * injectionsPerChild);
  const monthlyInjections = Math.round(annualInjections / 12);
  const cap = capacityPerSession > 0 ? capacityPerSession : 40;
  const recommendedSessionsPerMonth = Math.max(1, Math.ceil(monthlyInjections / cap));
  const recommendedSessionsPerYear = recommendedSessionsPerMonth * 12;
  return {
    annualInjections,
    monthlyInjections,
    recommendedSessionsPerMonth,
    recommendedSessionsPerYear,
  };
}

export const RED_CATEGORY_DEFINITIONS = {
  1: {
    category: 1,
    name: "High Access, Low Dropout",
    accessLabel: "High (>= 80%)",
    dropoutLabel: "Low (<= 10%)",
    priority: "Priority 4 (Maintain & optimize)",
    problem: "Good access and good utilization",
    description: "Communities have reliable service points and caregivers return to complete immunization schedules.",
    recommendedActions: [
      "Maintain regular session schedules and preserve high quality",
      "Trace remaining unreached pockets and zero-dose infants",
      "Prevent vaccine stockouts and maintain cold chain integrity",
      "Use supportive supervision to preserve good clinical practices",
    ],
    color: "emerald",
  },
  2: {
    category: 2,
    name: "High Access, High Dropout",
    accessLabel: "High (>= 80%)",
    dropoutLabel: "High (> 10%)",
    priority: "Priority 2 (Retention problem)",
    problem: "Service utilization & defaulter tracking failure",
    description: "Caregivers begin immunization (high initial access) but drop out before completing DTP3 or MCV2.",
    recommendedActions: [
      "Strengthen defaulter tracing with CHVs using tickler files or electronic lists",
      "Address caregiver dissatisfaction, clinic wait times, and inconvenient session timing",
      "Train health workers on interpersonal communication and counseling on return dates",
      "Ensure vaccine and injection supply availability at every session so no child is turned away",
    ],
    color: "amber",
  },
  3: {
    category: 3,
    name: "Low Access, Low Dropout",
    accessLabel: "Low (< 80%)",
    dropoutLabel: "Low (<= 10%)",
    priority: "Priority 3 (Access barrier)",
    problem: "Geographic or operational service delivery barrier",
    description: "Those who reach the service complete it, but a substantial proportion of the population never starts.",
    recommendedActions: [
      "Establish new outreach or mobile vaccination posts closer to remote settlements",
      "Review travel barriers, seasonal road access, and scheduling flexibility",
      "Re-evaluate catchment boundaries and identify unmapped settlements",
      "Engage local community leaders and transport partners for regular outreach",
    ],
    color: "blue",
  },
  4: {
    category: 4,
    name: "Low Access, High Dropout",
    accessLabel: "Low (< 80%)",
    dropoutLabel: "High (> 10%)",
    priority: "Priority 1 (Highest urgency)",
    problem: "Dual access and utilization failure",
    description: "Severe programmatic challenge: service is hard to reach initially, and even those reached fail to complete.",
    recommendedActions: [
      "Immediate comprehensive review of service delivery strategy (fixed, outreach, mobile)",
      "Intensive community dialogue to identify social, behavioral, and practical barriers",
      "Mobilize dedicated district transport, per diem, and supply support for catch-up activities",
      "Deploy active defaulter tracing and provide bundled integrated health services",
    ],
    color: "rose",
  },
} as const;

/**
 * WHO BeSD (Behavioral and Social Drivers) of Vaccination Domains (IIP 2025 Module 4 §4)
 */
export const WHO_BESD_DOMAINS = [
  {
    id: "thinking_and_feeling",
    title: "1. Thinking & Feeling",
    description: "Beliefs, vaccine confidence, perceived disease risk, and safety concerns",
    options: [
      { id: "vaccine_confidence", label: "Caregivers perceive vaccines as important and beneficial" },
      { id: "safety_concerns", label: "Hesitancy driven by fear of adverse events / side effects" },
      { id: "low_disease_risk", label: "Perception that vaccine-preventable diseases are no longer severe" },
      { id: "misinformation", label: "Misinformation or rumors circulating in the community" },
    ],
  },
  {
    id: "social_processes",
    title: "2. Social Processes",
    description: "Social norms, gender dynamics, community recommendations, and religious or cultural influences",
    options: [
      { id: "community_support", label: "Community leaders and elders actively endorse immunization" },
      { id: "gender_barriers", label: "Mothers face restrictions in mobility or decision-making autonomy" },
      { id: "cultural_hesitancy", label: "Religious or cultural objections to specific vaccines" },
      { id: "peer_influence", label: "Negative peer norms reducing clinic attendance" },
    ],
  },
  {
    id: "motivation",
    title: "3. Motivation",
    description: "Caregiver readiness, intent to vaccinate, and prioritization amidst competing needs",
    options: [
      { id: "high_intent", label: "Caregivers intend to vaccinate on time" },
      { id: "competing_priorities", label: "Economic, agricultural, or caretaking duties take precedence" },
      { id: "procrastination", label: "Postponing vaccination visits until child falls sick" },
    ],
  },
  {
    id: "practical_issues",
    title: "4. Practical Issues",
    description: "Access, travel time, direct and indirect costs, clinic waiting times, and health worker respect",
    options: [
      { id: "long_distance", label: "Long distance (> 5 km) or costly transport to session" },
      { id: "inconvenient_hours", label: "Session hours clash with farming, market, or employment hours" },
      { id: "long_wait_times", label: "Long waiting times (> 2 hours) at vaccination post" },
      { id: "disrespectful_care", label: "Caregivers report disrespectful treatment or scolding by staff" },
      { id: "vaccine_stockouts", label: "Clients turned away previously due to vaccine or syringe stockouts" },
    ],
  },
] as const;

const WHO_BESD_OPTION_IDS = new Set(
  WHO_BESD_DOMAINS.flatMap((domain) => domain.options.map((option) => option.id)),
);

/**
 * Store the facility-level BeSD selection alongside the legacy HTR comment
 * flags without requiring a destructive schema change. The option ids are
 * controlled constants, so the compact comma-separated representation is
 * stable and remains readable by older versions of the application.
 */
export function formatHtrAssessmentComments(
  flags: string[],
  besdBarriers: string[],
): string | null {
  const validBarriers = Array.from(new Set(besdBarriers)).filter((id) =>
    WHO_BESD_OPTION_IDS.has(id as any),
  );
  const parts = flags.filter(Boolean);
  if (validBarriers.length > 0) parts.push(`besd:${validBarriers.join(",")}`);
  return parts.join("; ") || null;
}

export function parseBesdBarriersFromComments(comments: unknown): string[] {
  if (typeof comments !== "string") return [];
  const segment = comments
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("besd:"));
  if (!segment) return [];
  return Array.from(new Set(segment.slice(5).split(",")))
    .map((id) => id.trim())
    .filter((id) => WHO_BESD_OPTION_IDS.has(id as any));
}

/**
 * Integrated Child Health Interventions (WHO RED Ch 2 & IIP 2025 p. 211)
 */
export const INTEGRATED_CHILD_HEALTH_INTERVENTIONS = [
  { id: "vit_a", name: "Vitamin A Supplementation", targetGroup: "Children 6-59 months (biannual)" },
  { id: "deworming", name: "Deworming (Albendazole/Mebendazole)", targetGroup: "Children 12-59 months" },
  { id: "muac", name: "MUAC Nutrition Screening", targetGroup: "Children 6-59 months" },
  { id: "llin", name: "Long-Lasting Insecticidal Nets (LLINs)", targetGroup: "Infants & Pregnant Women" },
  { id: "maternal_td", name: "Maternal Td / Tetanus Vaccination", targetGroup: "Pregnant Women & WRA" },
  { id: "hpv", name: "HPV Vaccination", targetGroup: "Girls 9-14 years" },
] as const;

/**
 * Defaulter Tracking Protocols (WHO RED Ch 5 & IIP 2025 pp. 211-215)
 */
export const DEFAULTER_TRACKING_PROTOCOLS = [
  { id: "tickler_file", name: "Tickler File Box (Card Reminder System)", description: "Monthly box partitioned by month and antigen for vaccination reminder cards", mechanism: "Health worker flags cards filed under the current month after session" },
  { id: "eir_sms", name: "Electronic Register / SMS Reminders", description: "Automated SMS alerts and digital defaulter lists generated from electronic records", mechanism: "Automated batch SMS triggers 3 days prior and 2 days post missed appointment" },
  { id: "chv_home_visit", name: "Community Health Volunteer Home Visit", description: "Designated CHV performs active household visit with community tracking register", mechanism: "CHVs receive list of unreached children weekly from the health facility in-charge" },
  { id: "rapid_register", name: "Rapid Defaulter Tracking Register", description: "Paper defaulter sheet reviewed at weekly health facility team meetings", mechanism: "Cross-checked with tickler cards and community village head registers" },
] as const;

