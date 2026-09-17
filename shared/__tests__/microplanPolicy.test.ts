import { describe, it, expect } from "vitest";
import { approvalEligibility, approvalReviewSlaDays, developmentDaysSchema, isApprovedPlan, minimumDevelopmentDays } from "../microplanPolicy";
describe("microplan approval policy", () => {
 it("defaults to 7 and rejects invalid admin values", () => {
  expect(minimumDevelopmentDays({})).toBe(7);
  for(const value of [0,7.5,"7",null]) expect(developmentDaysSchema.safeParse(value).success).toBe(false);
 });
 it("allows approval immediately after submission and reports the SLA due date", () => {
  const submitted="2026-09-01T12:00:00Z";
  const result = approvalEligibility(submitted,{},new Date("2026-09-01T12:00:01Z"));
  expect(result.allowed).toBe(true);
  expect(result.reviewDueAt).toEqual(new Date("2026-09-08T12:00:00Z"));
 });
 it("treats the configured period as an SLA rather than a lock", () => {
  const result = approvalEligibility("2026-09-01",{approvalReviewSlaDays:30},new Date("2026-09-01"));
  expect(result.allowed).toBe(true);
  expect(result.days).toBe(30);
  expect(approvalReviewSlaDays({minimumPlanDevelopmentDays:21})).toBe(21);
 });
 it("fails closed for invalid or missing creation dates", () => {
  expect(approvalEligibility(null,{}).allowed).toBe(false);
  expect(approvalEligibility("invalid",{}).allowed).toBe(false);
 });
 it("locks both manual and automatic approvals", () => {
  expect(isApprovedPlan("approved")).toBe(true);expect(isApprovedPlan("auto_approved")).toBe(true);expect(isApprovedPlan("draft")).toBe(false);
 });
});
