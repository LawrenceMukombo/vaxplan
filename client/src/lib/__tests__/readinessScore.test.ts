import { describe, expect, it } from "vitest";
import { calculateReadinessPercent } from "../readinessScore";

describe("calculateReadinessPercent", () => {
  it("normalizes a fully earned 110-point checklist to 100 percent", () => {
    expect(calculateReadinessPercent([
      { score: 10, maxScore: 10 },
      { score: 15, maxScore: 15 },
      { score: 85, maxScore: 85 },
    ])).toBe(100);
  });

  it("normalizes partial weighted scores", () => {
    expect(calculateReadinessPercent([
      { score: 10, maxScore: 10 },
      { score: 5, maxScore: 10 },
    ])).toBe(75);
  });

  it("returns zero for an empty checklist", () => {
    expect(calculateReadinessPercent([])).toBe(0);
  });

  it("clamps invalid and excessive item scores", () => {
    expect(calculateReadinessPercent([
      { score: 20, maxScore: 10 },
      { score: -5, maxScore: 10 },
      { score: Number.NaN, maxScore: 10 },
    ])).toBe(33);
  });
});
