import { describe, expect, it } from "vitest";
import { getSeededCampaignMetrics } from "./seededCampaignMetrics";

describe("getSeededCampaignMetrics", () => {
  it("is reproducible for the same tenant, campaign, and facility", () => {
    const input = { tenantKey: 8, campaignKey: "mr-2026", facilityId: 42, facilityName: "Clinic A" };
    expect(getSeededCampaignMetrics(input)).toEqual(getSeededCampaignMetrics(input));
  });

  it("varies facility telemetry instead of applying one shared fallback", () => {
    const facilities = Array.from({ length: 12 }, (_, index) =>
      getSeededCampaignMetrics({
        tenantKey: 8,
        campaignKey: "mr-2026",
        facilityId: index + 1,
        facilityName: `Clinic ${index + 1}`,
      }),
    );

    expect(new Set(facilities.map((row) => row.targetPopulation)).size).toBeGreaterThan(1);
    expect(new Set(facilities.map((row) => row.coveragePercent)).size).toBeGreaterThan(1);
    expect(facilities.every((row) => row.vaccinated <= row.targetPopulation)).toBe(true);
  });

  it("keeps a valid facility target while seeding campaign performance", () => {
    const metrics = getSeededCampaignMetrics({
      tenantKey: "za",
      campaignKey: "mr-2026",
      facilityId: 99,
      targetPopulation: 3_275,
    });

    expect(metrics.targetPopulation).toBe(3_275);
    expect(metrics.coveragePercent).toBeGreaterThanOrEqual(42);
    expect(metrics.coveragePercent).toBeLessThanOrEqual(96);
  });
});
