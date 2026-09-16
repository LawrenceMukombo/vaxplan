import { describe, expect, it } from "vitest";
import { findFacilityDraftMicroplan, isSessionCoverageGap } from "../mapGapPlanning";

describe("map gap planning", () => {
  it("treats no session or a session outside the selected extent as a gap", () => {
    expect(isSessionCoverageGap(undefined, 5)).toBe(true);
    expect(isSessionCoverageGap(5.01, 5)).toBe(true);
    expect(isSessionCoverageGap(5, 5)).toBe(false);
  });

  it("selects the nearby facility's current-period routine draft", () => {
    const plans = [
      { id: 1, facilityId: 9, status: "draft", planType: "routine", year: 2025, quarter: 4 },
      { id: 2, facilityId: 9, status: "draft", planType: "facility_routine", year: 2026, quarter: 3 },
      { id: 3, facilityId: 9, status: "approved", planType: "routine", year: 2026, quarter: 3 },
      { id: 4, facilityId: 10, status: "draft", planType: "routine", year: 2026, quarter: 3 },
    ];
    expect(findFacilityDraftMicroplan(plans, 9, 2026, 3)?.id).toBe(2);
  });
});
