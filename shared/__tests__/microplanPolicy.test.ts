import { describe, it, expect } from "vitest";
import { approvalEligibility, developmentDaysSchema, isApprovedPlan, minimumDevelopmentDays } from "../microplanPolicy";
describe("microplan approval policy", () => {
 it("defaults to 7 and rejects invalid admin values", () => {
  expect(minimumDevelopmentDays({})).toBe(7);
  for(const value of [0,7.5,"7",null]) expect(developmentDaysSchema.safeParse(value).success).toBe(false);
 });
 it("requires the full development period and accepts the exact boundary", () => {
  const created="2026-09-01T12:00:00Z";
  expect(approvalEligibility(created,{},new Date("2026-09-08T11:59:59Z")).allowed).toBe(false);
  expect(approvalEligibility(created,{},new Date("2026-09-08T12:00:00Z")).allowed).toBe(true);
 });
 it("honors a longer configured period", () => {
  expect(approvalEligibility("2026-09-01",{minimumPlanDevelopmentDays:30},new Date("2026-09-22")).allowed).toBe(false);
 });
 it("fails closed for invalid or missing creation dates", () => {
  expect(approvalEligibility(null,{}).allowed).toBe(false);
  expect(approvalEligibility("invalid",{}).allowed).toBe(false);
 });
 it("locks both manual and automatic approvals", () => {
  expect(isApprovedPlan("approved")).toBe(true);expect(isApprovedPlan("auto_approved")).toBe(true);expect(isApprovedPlan("draft")).toBe(false);
 });
});
