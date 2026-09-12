import { describe, expect, it } from "vitest";
import { disaggregatePopulation, populationRatios } from "../populationDisaggregation";

describe("population disaggregation", () => {
  it("uses configured country proportions for all WHO life-course cohorts", () => {
    const ratios = populationRatios({
      demographics: {
        under1: 0.04, // 0–11 months (Infants)
        secondYearOfLife: 0.038, // 12–23 months (2YL)
        children24to59m: 0.115, // 24–59 months (Under 5)
        under5: 0.193,
        girls9to14: 0.065, // Girls 9–14 years (HPV)
        pregnant: 0.045, // Pregnant women (Td)
        female: 0.51,
      },
    });

    const result = disaggregatePopulation(10000, ratios);
    expect(result.totalPopulation).toBe(10000);
    expect(result.under1Population).toBe(400); // 0-11m
    expect(result.infants0to11m).toBe(400);
    expect(result.secondYearOfLifePopulation).toBe(380); // 12-23m (2YL)
    expect(result.children12to23m).toBe(380);
    expect(result.children24to59m).toBe(1150); // 24-59m
    expect(result.under5Population).toBe(1930); // Total under 5
    expect(result.girls9to14Population).toBe(650); // Girls 9-14y
    expect(result.pregnantWomen).toBe(450); // Pregnant women (Td)
    expect(result.femalePopulation).toBe(5100);
    expect(result.malePopulation).toBe(4900);
  });

  it("derives under-five from default cohorts when under5 is not explicitly set", () => {
    const ratios = populationRatios({ under1: 0.04 });
    expect(ratios.under5).toBeGreaterThanOrEqual(0.04);
    expect(ratios.secondYearOfLife).toBeCloseTo(0.038);
    expect(ratios.children24to59m).toBeCloseTo(0.115);
    expect(ratios.girls9to14).toBeCloseTo(0.065);
    expect(ratios.pregnant).toBeCloseTo(0.045);
  });

  it("never produces a cohort larger than the extracted total", () => {
    const result = disaggregatePopulation(100, {
      under1: 0.8,
      secondYearOfLife: 0.5,
      children24to59m: 0.8,
      under5: 1.2,
      girls9to14: 0.9,
      pregnant: 2,
      female: 1.5,
    });
    expect(result.under5Population).toBe(100);
    expect(result.under1Population).toBeLessThanOrEqual(result.under5Population);
    expect(result.secondYearOfLifePopulation).toBeLessThanOrEqual(100);
    expect(result.girls9to14Population).toBeLessThanOrEqual(100);
    expect(result.pregnantWomen).toBeLessThanOrEqual(100);
    expect(result.malePopulation + result.femalePopulation).toBe(100);
  });

  it("returns zeroes for missing or invalid totals", () => {
    expect(disaggregatePopulation("invalid", populationRatios({})).totalPopulation).toBe(0);
  });
});
