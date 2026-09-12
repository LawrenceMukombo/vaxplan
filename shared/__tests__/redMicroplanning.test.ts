import { describe, it, expect } from "vitest";
import {
  redMetrics,
  redWorksheetSchema,
  calculateRedCategory,
  calculateDropouts,
  calculateZeroDose,
  calculateRecommendedSessions,
  RED_CATEGORY_DEFINITIONS,
} from "../redMicroplanning";

describe("RED planning calculations", () => {
  it("does not turn missing denominators or zero first doses into coverage", () => {
    const result = redMetrics("analysis", { first: 0, third: 0, infants: 0 });
    expect(result["First-dose coverage %"]).toBeNull();
    expect(result["First-to-third dropout %"]).toBeNull();
    expect(result["RED category"]).toBeNull();
  });
  it("uses inclusive access and dropout boundaries and distinct maternal denominator", () => {
    const result = redMetrics("analysis", { infants: 100, pregnant: 50, first: 80, third: 72, measles: 70, td: 25, accessCutoff: 80, dropoutCutoff: 10 });
    expect(result["RED category"]).toBe(1);
    expect(result["TT2+/Td coverage %"]).toBe(50);
    expect(result["Unimmunized third-dose estimate"]).toBe(28);
  });
  it("preserves data anomalies for reconciliation", () => {
    expect(redMetrics("analysis", { infants: 100, third: 120 })["Unimmunized third-dose estimate"]).toBe(-20);
  });
  it("calculates workload using entered national assumptions", () => {
    expect(redMetrics("sessions", { target: 120, injections: 10, capacity: 40, planned: 24 })).toMatchObject({ "Annual injections": 1200, "Estimated sessions per month": 2.5, "Planned sessions per month (average)": 2 });
  });
  it("validates field types and real dates while accepting incomplete drafts", () => {
    const valid = redWorksheetSchema.safeParse({ title: "Plan", sections: { analysis: [{ infants: "" }] } });
    expect(valid.success).toBe(true);
    if (valid.success) expect(valid.data.completedSteps).toEqual([]);
    expect(redWorksheetSchema.safeParse({ title: "Plan", sections: { analysis: [{ infants: "100" }] } }).success).toBe(false);
    expect(redWorksheetSchema.safeParse({ title: "Plan", sections: { workplan: [{ date: "2026-02-30" }] } }).success).toBe(false);
  });

  describe("WHO RED 4-Category Prioritization", () => {
    it("categorizes properly according to access and dropout cutoffs", () => {
      // Category 1: High access (>=80%), Low dropout (<=10%)
      expect(calculateRedCategory(85, 5)).toBe(1);
      expect(calculateRedCategory(80, 10)).toBe(1);

      // Category 2: High access (>=80%), High dropout (>10%)
      expect(calculateRedCategory(85, 15)).toBe(2);
      expect(calculateRedCategory(80, 11)).toBe(2);

      // Category 3: Low access (<80%), Low dropout (<=10%)
      expect(calculateRedCategory(75, 5)).toBe(3);
      expect(calculateRedCategory(60, 10)).toBe(3);

      // Category 4: Low access (<80%), High dropout (>10%)
      expect(calculateRedCategory(70, 15)).toBe(4);
      expect(calculateRedCategory(50, 25)).toBe(4);

      // Null handling
      expect(calculateRedCategory(null, 5)).toBeNull();
      expect(calculateRedCategory(85, null)).toBeNull();
    });

    it("has metadata definitions for all 4 categories", () => {
      expect(RED_CATEGORY_DEFINITIONS[1].color).toBe("emerald");
      expect(RED_CATEGORY_DEFINITIONS[2].color).toBe("amber");
      expect(RED_CATEGORY_DEFINITIONS[3].color).toBe("blue");
      expect(RED_CATEGORY_DEFINITIONS[4].color).toBe("rose");
      expect(RED_CATEGORY_DEFINITIONS[4].priority).toContain("Priority 1");
    });
  });

  describe("WHO Dropouts and Zero-Dose Calculations", () => {
    it("computes 3 drop-out rates: DTP1->DTP3, DTP1->MCV1, and MCV1->MCV2", () => {
      const dropouts = calculateDropouts({
        dtp1: 100,
        dtp3: 85,
        mcv1: 80,
        mcv2: 60,
      });

      expect(dropouts.dtp1Dtp3DropoutPct).toBe(15);
      expect(dropouts.dtp1Dtp3DropoutCount).toBe(15);

      expect(dropouts.dtp1Mcv1DropoutPct).toBe(20);
      expect(dropouts.dtp1Mcv1DropoutCount).toBe(20);

      expect(dropouts.mcv1Mcv2DropoutPct).toBe(25);
      expect(dropouts.mcv1Mcv2DropoutCount).toBe(20);
    });

    it("handles missing or zero values gracefully in dropouts", () => {
      const dropouts = calculateDropouts({ dtp1: 0, dtp3: 0, mcv1: null });
      expect(dropouts.dtp1Dtp3DropoutPct).toBeNull();
      expect(dropouts.dtp1Mcv1DropoutPct).toBeNull();
      expect(dropouts.mcv1Mcv2DropoutPct).toBeNull();
    });

    it("computes zero-dose children count and percentage correctly", () => {
      const zd = calculateZeroDose(200, 150);
      expect(zd.zeroDoseCount).toBe(50);
      expect(zd.zeroDosePct).toBe(25);

      const allCovered = calculateZeroDose(100, 110);
      expect(allCovered.zeroDoseCount).toBe(0);
      expect(allCovered.zeroDosePct).toBe(0);

      const noneCovered = calculateZeroDose(100, 0);
      expect(noneCovered.zeroDoseCount).toBe(100);
      expect(noneCovered.zeroDosePct).toBe(100);

      const invalid = calculateZeroDose(0, 50);
      expect(invalid.zeroDoseCount).toBeNull();
      expect(invalid.zeroDosePct).toBeNull();
    });
  });

  describe("WHO Workload-Driven Session Frequency", () => {
    it("calculates monthly session recommendation based on injection workload", () => {
      // 120 target infants * 10 injections/child = 1200 annual injections
      // 1200 / 12 = 100 monthly injections
      // 100 monthly injections / 40 capacity per session = ceil(2.5) = 3 sessions/month
      const sessions = calculateRecommendedSessions(120, 10, 40);
      expect(sessions.annualInjections).toBe(1200);
      expect(sessions.monthlyInjections).toBe(100);
      expect(sessions.recommendedSessionsPerMonth).toBe(3);
      expect(sessions.recommendedSessionsPerYear).toBe(36);
    });
  });
});

