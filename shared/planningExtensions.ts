import { z } from "zod";
import { redWorksheetSchema } from "./redMicroplanning";
import { lifeCourseForecastSchema } from "./lifeCourseForecast";

const text = z.string().trim().min(1).max(4000);
const note = z.string().trim().max(4000).default("");
const count = z.number().int().min(0).max(1_000_000_000);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid calendar date");
export const extensionKinds = ["consultation", "barrier", "target_group", "population_estimate", "finance", "household_assessment", "service_review", "red_microplanning"] as const;
export type ExtensionKind = typeof extensionKinds[number];
export const extensionSchemas = {
  red_microplanning: redWorksheetSchema,
  consultation: z.object({
    title: text, date: day, facilitator: text, communities: text, participantGroups: text,
    communityLeadersRepresented: z.boolean().default(false), caregiversRepresented: z.boolean().default(false),
    womensGroupsRepresented: z.boolean().default(false), youngPeopleRepresented: z.boolean().default(false),
    chvsRepresented: z.boolean().default(false), underservedGroupsRepresented: z.boolean().default(false),
    actualAttendance: count, issues: text, preferredTimesAndLocations: note,
    decisions: text, unresolvedConcerns: note, validation: z.enum(["not_requested", "pending", "confirmed", "disputed"]),
    validationNotes: note, planningChanges: note, microplanVersion: count.default(0),
    planningChangeType: z.enum(["none", "session", "budget", "action"]).default("none"), planningChangeReference: note,
  }).strict().refine(value => value.planningChangeType === "none" || Boolean(value.planningChangeReference), { path: ["planningChangeReference"], message: "Link or describe the resulting planning proposal" }),
  barrier: z.object({
    title: text, date: day, affectedPopulation: text,
    category: z.enum(["practical_access", "service_experience", "confidence", "social_influence", "gender_related"]),
    subcategory: text.default("Not specified"), communityId: count.default(0),
    source: text, finding: text, priority: z.enum(["low", "medium", "high"]),
    proposedResponse: text, owner: text, dueDate: day, planningChanges: note,
    planningLinkType: z.enum(["action", "session", "budget", "population", "mobilization"]).default("action"),
    planningLinkReference: text.default("Create or link an action"), addressed: z.boolean().default(false),
  }).strict().superRefine((value, context) => {
    if (value.addressed && !value.planningLinkReference) context.addIssue({ code: "custom", path: ["planningLinkReference"], message: "Link the planning decision before marking this barrier addressed" });
    if (value.priority === "high" && value.addressed && !value.owner) context.addIssue({ code: "custom", path: ["owner"], message: "A high-priority response needs an accountable owner" });
  }),
  target_group: z.object({
    title: text, minimumAgeMonths: count, maximumAgeMonths: count,
    eligibility: text, eligibilityAttributes: note, sex: z.enum(["all", "female", "male"]),
    countryScope: z.literal(true).default(true), definitionVersion: count.default(1),
    overlapNotes: text, overlapRule: z.enum(["disjoint", "contains", "overlaps", "unknown"]).default("unknown"), scheduleReferences: note, status: z.enum(["draft", "active", "retired"]),
  }).strict().refine(value => value.maximumAgeMonths >= value.minimumAgeMonths, { path: ["maximumAgeMonths"], message: "Maximum age must not be below minimum age" }),
  population_estimate: z.object({
    title: text, targetGroupId: z.string().uuid(), referenceDate: day, population: count,
    purpose: z.enum(["eligible_denominator", "operational_target"]), source: text, method: text,
    geographicScope: z.enum(["country", "province", "district", "facility", "community"]).default("facility"), communityId: count.default(0),
    confidence: z.enum(["low", "medium", "high"]), status: z.enum(["draft", "reviewed", "approved"]),
    overlapRule: z.enum(["disjoint", "contains", "overlaps", "unknown"]).default("unknown"), reconciliationNotes: text,
    resourceForecast: z.object({ antigen: text, assumptions: lifeCourseForecastSchema }).strict().optional(),
  }).strict().superRefine((value, context) => {
    if (value.resourceForecast && value.resourceForecast.assumptions.population !== value.population) context.addIssue({ code: "custom", path: ["resourceForecast"], message: "Recalculate the forecast after changing the population" });
    if (value.status === "approved" && ["overlaps", "unknown"].includes(value.overlapRule) && !value.reconciliationNotes) context.addIssue({ code: "custom", path: ["reconciliationNotes"], message: "Document overlap reconciliation before approval" });
  }),
  finance: z.object({
    title: text, budgetItemId: z.number().int().positive(),
    type: z.enum(["commitment", "receipt", "expenditure", "in_kind"]),
    amountMinor: z.number().int().positive().max(9_000_000_000_000), currency: z.string().regex(/^[A-Z]{3}$/),
    date: day, expectedDate: day.nullable().default(null), funder: text,
    reference: text, notes: note, correctionReason: note,
  }).strict(),
  household_assessment: z.object({
    title: text, date: day, householdCode: text, consent: z.literal(true),
    method: z.enum(["card_check", "convenience", "lqas", "other"]), samplingDescription: text,
    eligiblePeople: count, cardSeen: count, neverVaccinated: count, partiallyVaccinated: count, fullyVaccinated: count,
    unknownStatus: count, reasonsMissed: note, reconciliationNotes: note,
  }).strict().superRefine((value, context) => {
    if (value.cardSeen > value.eligiblePeople) context.addIssue({ code: "custom", path: ["cardSeen"], message: "Cards seen cannot exceed eligible people" });
    if (value.neverVaccinated + value.partiallyVaccinated + value.fullyVaccinated + value.unknownStatus !== value.eligiblePeople)
      context.addIssue({ code: "custom", path: ["eligiblePeople"], message: "Vaccination status counts must equal eligible people" });
  }),
  service_review: z.object({
    title: text, sessionId: z.number().int().positive(), date: day,
    deliveryStatus: z.enum(["conducted", "partial", "cancelled", "not_held"]),
    attendance: count, otherServices: note, nonDeliveryReasons: note, followUpNeeds: text,
  }).strict().refine(value => value.deliveryStatus === "conducted" || Boolean(value.nonDeliveryReasons), { path: ["nonDeliveryReasons"], message: "Explain partial or missed delivery" }),
};
export type ExtensionRecord = {
  id: string; tenantId: string; facilityId: number; kind: ExtensionKind;
  microplanId: number | null; version: number; payload: Record<string, any>;
  createdAt: string; updatedAt: string;
};

export function summarizeFinance(records: Array<{ type: string; amountMinor: number; currency: string }>) {
  const totals: Record<string, { commitment: number; receipt: number; expenditure: number; in_kind: number; cashRemaining: number }> = {};
  for (const record of records) {
    const item = totals[record.currency] ||= { commitment: 0, receipt: 0, expenditure: 0, in_kind: 0, cashRemaining: 0 };
    if (["commitment", "receipt", "expenditure", "in_kind"].includes(record.type)) item[record.type as "receipt"] += record.amountMinor;
    item.cashRemaining = item.receipt - item.expenditure;
  }
  return totals;
}

export type ExtensionField = { name: string; label: string; type?: "number" | "date" | "select" | "checkbox" | "text"; options?: string[]; optional?: boolean };
const field = (name: string, label: string, type: ExtensionField["type"] = "text", options?: string[], optional = false): ExtensionField => ({ name, label, type, options, optional });
export const extensionForms: Record<ExtensionKind, { title: string; description: string; fields: ExtensionField[] }> = {
  red_microplanning: { title: "RED worksheet", description: "Open the microplanning wizard to edit the structured RED worksheet.", fields: [] },
  consultation: { title: "Community consultations", description: "Record participation, agreed decisions and the changes proposed for the microplan.", fields: [
    field("title", "Consultation title"), field("date", "Date", "date"), field("facilitator", "Facilitator"), field("communities", "Communities represented"), field("participantGroups", "Other participant groups represented"), field("communityLeadersRepresented", "Community leaders represented", "checkbox"), field("caregiversRepresented", "Caregivers represented", "checkbox"), field("womensGroupsRepresented", "Women's groups represented", "checkbox"), field("youngPeopleRepresented", "Young people represented", "checkbox"), field("chvsRepresented", "CHVs represented", "checkbox"), field("underservedGroupsRepresented", "Underserved populations represented", "checkbox"), field("actualAttendance", "Actual attendance", "number"), field("issues", "Issues raised"), field("preferredTimesAndLocations", "Preferred session times and places", "text", undefined, true), field("decisions", "Agreed decisions"), field("unresolvedConcerns", "Unresolved concerns", "text", undefined, true), field("validation", "Community validation", "select", ["not_requested", "pending", "confirmed", "disputed"]), field("validationNotes", "What was validated and by whom", "text", undefined, true), field("planningChanges", "Proposed changes to the plan", "text", undefined, true), field("microplanVersion", "Microplan version informed (0 if not yet assigned)", "number"), field("planningChangeType", "Resulting planning proposal", "select", ["none", "session", "budget", "action"]), field("planningChangeReference", "Linked proposal or record reference", "text", undefined, true),
  ] },
  barrier: { title: "Barriers and responses", description: "Record evidence from the community and an agreed response. Do not infer barriers from identity alone.", fields: [
    field("title", "Barrier title"), field("date", "Evidence date", "date"), field("affectedPopulation", "Affected population or community"), field("category", "Barrier category", "select", ["practical_access", "service_experience", "confidence", "social_influence", "gender_related"]), field("subcategory", "Country-configured subcategory"), field("communityId", "Community ID (0 for facility-wide)", "number"), field("source", "Evidence source"), field("finding", "What people reported"), field("priority", "Priority", "select", ["low", "medium", "high"]), field("proposedResponse", "Proposed response"), field("owner", "Accountable owner"), field("dueDate", "Deadline", "date"), field("planningChanges", "Session, budget or other planning changes", "text", undefined, true), field("planningLinkType", "Concrete planning link", "select", ["action", "session", "budget", "population", "mobilization"]), field("planningLinkReference", "Linked action, session, budget or decision"), field("addressed", "Response implemented", "checkbox"),
  ] },
  target_group: { title: "Life-course groups", description: "Define local target groups. Overlapping groups must not be added together as distinct populations.", fields: [
    field("title", "Group name"), field("minimumAgeMonths", "Minimum age in months", "number"), field("maximumAgeMonths", "Maximum age in months", "number"), field("eligibility", "Eligibility criteria"), field("eligibilityAttributes", "Configurable eligibility attributes", "text", undefined, true), field("sex", "Sex eligibility", "select", ["all", "female", "male"]), field("countryScope", "Available across this country", "checkbox"), field("definitionVersion", "Definition version", "number"), field("overlapNotes", "Potential overlap with other groups"), field("overlapRule", "Relationship to other groups", "select", ["disjoint", "contains", "overlaps", "unknown"]), field("scheduleReferences", "National schedule references", "text", undefined, true), field("status", "Status", "select", ["draft", "active", "retired"]),
  ] },
  population_estimate: { title: "Group estimates", description: "Keep eligible denominators separate from operational vaccination targets. Existing population totals remain unchanged.", fields: [
    field("title", "Estimate title"), field("targetGroupId", "Target group"), field("referenceDate", "Reference date", "date"), field("population", "Population estimate", "number"), field("purpose", "Purpose", "select", ["eligible_denominator", "operational_target"]), field("source", "Population source"), field("method", "Estimation method"), field("geographicScope", "Geographic scope", "select", ["country", "province", "district", "facility", "community"]), field("communityId", "Community ID (0 when not community-scoped)", "number"), field("confidence", "Confidence", "select", ["low", "medium", "high"]), field("status", "Review status", "select", ["draft", "reviewed", "approved"]), field("overlapRule", "Overlap handling", "select", ["disjoint", "contains", "overlaps", "unknown"]), field("reconciliationNotes", "Comparison with other sources and agreed assumptions"),
  ] },
  finance: { title: "Funding and expenditure", description: "Record commitments, actual receipts, expenditure and in-kind support against budget lines. Commitments are not cash received.", fields: [
    field("title", "Entry description"), field("budgetItemId", "Budget item ID", "number"), field("type", "Entry type", "select", ["commitment", "receipt", "expenditure", "in_kind"]), field("amountMinor", "Amount (two decimal places)", "number"), field("currency", "Currency code, for example ZAR"), field("date", "Entry date", "date"), field("expectedDate", "Expected receipt date", "date", undefined, true), field("funder", "Funder or supplier"), field("reference", "Supporting document or transaction reference"), field("correctionReason", "Reason for correction (required when editing)", "text", undefined, true), field("notes", "Notes", "text", undefined, true),
  ] },
  household_assessment: { title: "Household assessments", description: "Use a non-identifying household code. Record consent and sampling method; these findings are not administrative coverage estimates.", fields: [
    field("title", "Assessment title"), field("date", "Visit date", "date"), field("householdCode", "Non-identifying household code"), field("consent", "Consent obtained", "checkbox"), field("method", "Assessment method", "select", ["card_check", "convenience", "lqas", "other"]), field("samplingDescription", "Sampling approach and limitations"), field("eligiblePeople", "Eligible people assessed", "number"), field("cardSeen", "People whose cards were seen", "number"), field("neverVaccinated", "Never vaccinated", "number"), field("partiallyVaccinated", "Partially vaccinated", "number"), field("fullyVaccinated", "Fully vaccinated for age", "number"), field("unknownStatus", "Unknown vaccination status", "number"), field("reasonsMissed", "Reported reasons for missed vaccination", "text", undefined, true), field("reconciliationNotes", "Register discrepancies and proposed corrections", "text", undefined, true),
  ] },
  service_review: { title: "Service reviews", description: "Supplement existing session records with delivery issues and follow-up needs. Record vaccine doses in the existing session or client logbook.", fields: [
    field("title", "Review title"), field("sessionId", "Session ID", "number"), field("date", "Review date", "date"), field("deliveryStatus", "Delivery status", "select", ["conducted", "partial", "cancelled", "not_held"]), field("attendance", "People attending", "number"), field("otherServices", "Other services delivered", "text", undefined, true), field("nonDeliveryReasons", "Reasons for missed or partial delivery", "text", undefined, true), field("followUpNeeds", "Follow-up needs"),
  ] },
};
