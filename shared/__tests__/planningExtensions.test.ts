import { describe, expect, it } from "vitest";
import { extensionSchemas, summarizeFinance } from "../planningExtensions";
describe("planning evidence safeguards", () => {
  it("rejects reversed age ranges", () => {
    expect(extensionSchemas.target_group.safeParse({ title: "Children", minimumAgeMonths: 24, maximumAgeMonths: 12, eligibility: "Resident", sex: "all", overlapNotes: "Under five", status: "draft" }).success).toBe(false);
  });
  it("separates commitments and in-kind contributions from cash receipts", () => {
    expect(summarizeFinance([{ currency: "ZAR", type: "commitment", amountMinor: 10000 }, { currency: "ZAR", type: "receipt", amountMinor: 4000 }, { currency: "ZAR", type: "expenditure", amountMinor: 2500 }, { currency: "ZAR", type: "in_kind", amountMinor: 3000 }, { currency: "USD", type: "receipt", amountMinor: 100 }])).toEqual({ ZAR: { commitment: 10000, receipt: 4000, expenditure: 2500, in_kind: 3000, cashRemaining: 1500 }, USD: { commitment: 0, receipt: 100, expenditure: 0, in_kind: 0, cashRemaining: 100 } });
  });
  it("requires consent and internally consistent assessment counts", () => {
    const input = { title: "Card check", date: "2026-09-09", householdCode: "H001", consent: true, method: "card_check", samplingDescription: "Convenience sample", eligiblePeople: 2, cardSeen: 1, neverVaccinated: 1, partiallyVaccinated: 0, fullyVaccinated: 1, unknownStatus: 0 };
    expect(extensionSchemas.household_assessment.safeParse(input).success).toBe(true);
    expect(extensionSchemas.household_assessment.safeParse({ ...input, consent: false }).success).toBe(false);
    expect(extensionSchemas.household_assessment.safeParse({ ...input, unknownStatus: 1 }).success).toBe(false);
  });
  it("requires an explanation for a cancelled session", () => {
    expect(extensionSchemas.service_review.safeParse({ title: "Review", sessionId: 1, date: "2026-09-09", deliveryStatus: "cancelled", attendance: 0, followUpNeeds: "Rebook" }).success).toBe(false);
  });
  it("captures structured consultation representation and a traceable proposal", () => {
    const consultation = { title: "Market-day consultation", date: "2026-09-09", facilitator: "Facility lead", communities: "North ward", participantGroups: "Disability representative", communityLeadersRepresented: true, caregiversRepresented: true, actualAttendance: 12, issues: "Clinic hours overlap with market", decisions: "Move outreach to afternoon", validation: "confirmed", planningChangeType: "session", planningChangeReference: "Draft session change" };
    expect(extensionSchemas.consultation.safeParse(consultation).success).toBe(true);
    expect(extensionSchemas.consultation.safeParse({ ...consultation, planningChangeReference: "" }).success).toBe(false);
  });
  it("blocks unsafe approval of overlapping life-course estimates without reconciliation", () => {
    const estimate = { title: "Girls 9-14", targetGroupId: "123e4567-e89b-12d3-a456-426614174000", referenceDate: "2026-09-09", population: 1200, purpose: "eligible_denominator", source: "School census", method: "Roster count", confidence: "high", status: "approved", overlapRule: "overlaps", reconciliationNotes: "" };
    expect(extensionSchemas.population_estimate.safeParse(estimate).success).toBe(false);
    expect(extensionSchemas.population_estimate.safeParse({ ...estimate, reconciliationNotes: "School and community rosters deduplicated" }).success).toBe(true);
  });
});
