import { describe, it, expect } from "vitest";
import {
  calculateConsumptionTrend,
  predictVaccineStockLogistics,
  WHO_PQS_ANTIGEN_SPECS,
  type StockForecastInput,
} from "../../shared/aiStockPredictor";

describe("AI Predictive Stock Logistics Engine", () => {
  it("calculates consumption trend slope and daily baseline accurately", () => {
    const linearHistory = [
      { date: "2025-01-01", dosesAdministered: 10 },
      { date: "2025-01-02", dosesAdministered: 12 },
      { date: "2025-01-03", dosesAdministered: 14 },
      { date: "2025-01-04", dosesAdministered: 16 },
      { date: "2025-01-05", dosesAdministered: 18 },
    ];

    const { dailyBaseline, trendSlope } = calculateConsumptionTrend(linearHistory);
    expect(dailyBaseline).toBeGreaterThanOrEqual(18);
    expect(trendSlope).toBeCloseTo(2.0, 1);
  });

  it("detects critical stockout risk when stock will exhaust within 7 days", () => {
    const input: StockForecastInput = {
      facilityId: 101,
      facilityName: "Kanyama Health Centre",
      antigen: "PENTA",
      currentStockDoses: 40, // only ~2 days of supply
      refrigerator: {
        id: 1,
        model: "TCW 2000 AC",
        netVaccineStorageLiters: 120,
        grossVolumeLiters: 150,
        temperatureOk: true,
      },
      consumptionHistory: [
        { date: "2025-03-01", dosesAdministered: 20 },
        { date: "2025-03-02", dosesAdministered: 22 },
        { date: "2025-03-03", dosesAdministered: 18 },
      ],
      upcomingOutreachCampaigns: [],
      forecastDays: 60,
    };

    const result = predictVaccineStockLogistics(input);

    expect(result.riskLevel).toBe("critical");
    expect(result.stockoutProbabilityScore).toBeGreaterThanOrEqual(85);
    expect(result.daysUntilStockout).toBeLessThanOrEqual(5);
    expect(result.recommendedReorderQuantity).toBeGreaterThan(0);
    expect(result.recommendations.some((r) => r.includes("URGENT"))).toBe(true);
  });

  it("models campaign surge and flags stockout before outreach date", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const campaignDateStr = futureDate.toISOString().slice(0, 10);

    const input: StockForecastInput = {
      facilityId: 102,
      facilityName: "Chipata District Hospital",
      antigen: "MR",
      currentStockDoses: 150,
      refrigerator: {
        id: 2,
        model: "Vestfrost VLS 024",
        netVaccineStorageLiters: 60,
        grossVolumeLiters: 80,
        temperatureOk: true,
      },
      consumptionHistory: [
        { date: "2025-03-01", dosesAdministered: 15 },
        { date: "2025-03-02", dosesAdministered: 15 },
      ],
      upcomingOutreachCampaigns: [
        {
          id: 50,
          name: "High-Density Village Outreach",
          scheduledDate: campaignDateStr,
          targetChildren: 120,
          antigensTargeted: ["MR"],
        },
      ],
      forecastDays: 30,
    };

    const result = predictVaccineStockLogistics(input);

    expect(result.upcomingOutreachImpact.campaignCount).toBe(1);
    expect(result.upcomingOutreachImpact.additionalDosesDemanded).toBe(120);
    expect(result.daysUntilStockout).toBeLessThanOrEqual(12);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("calculates cold chain volume footprint and warns against refrigerator capacity overload", () => {
    const input: StockForecastInput = {
      facilityId: 103,
      facilityName: "Remote Sub-post",
      antigen: "ROTA", // bulky 17.5 cm3 per dose
      currentStockDoses: 200,
      refrigerator: {
        id: 3,
        model: "Small Solar Direct Drive",
        netVaccineStorageLiters: 20, // very small 20L
        grossVolumeLiters: 25,
        temperatureOk: true,
      },
      consumptionHistory: [
        { date: "2025-03-01", dosesAdministered: 30 },
      ],
      upcomingOutreachCampaigns: [
        {
          id: 88,
          name: "District Rota Campaign",
          scheduledDate: "2025-04-01",
          targetChildren: 1500,
          antigensTargeted: ["ROTA"],
        },
      ],
      forecastDays: 60,
    };

    const result = predictVaccineStockLogistics(input);

    expect(result.capacityOverloadRisk).toBe(true);
    expect(result.capacityUtilizationPercent).toBeGreaterThan(95);
    expect(result.recommendations.some((r) => r.includes("COLD CHAIN WARNING"))).toBe(true);
  });
});
