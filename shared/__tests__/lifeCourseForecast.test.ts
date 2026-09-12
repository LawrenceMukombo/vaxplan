import { describe, it, expect } from "vitest";
import { calculateLifeCourseForecast } from "../lifeCourseForecast";
describe("life-course forecast", () => {
  it("keeps the denominator unchanged and rounds whole vials once", () => {
    expect(calculateLifeCourseForecast({ population: 103, coveragePercent: 90, dosesPerPerson: 2, dosesPerVial: 10, wastagePercent: 20, peoplePerSession: 40 })).toEqual({ peopleToReach: 93, administrationDoses: 186, vials: 24, supplyDoses: 240, minimumSessionContacts: 5 });
  });
  it("handles zero populations without inventing demand", () => {
    expect(calculateLifeCourseForecast({ population: 0, coveragePercent: 100, dosesPerPerson: 1, dosesPerVial: 10, wastagePercent: 0, peoplePerSession: 40 }).supplyDoses).toBe(0);
  });
  it("rejects invalid wastage and vial assumptions", () => {
    expect(() => calculateLifeCourseForecast({ population: 100, coveragePercent: 100, dosesPerPerson: 1, dosesPerVial: 0, wastagePercent: 100, peoplePerSession: 40 })).toThrow();
  });
});
