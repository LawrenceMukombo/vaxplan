import { describe, expect, it } from "vitest";
import { canTransitionAction, isActionOverdue, planningActionSchema } from "../planningActions";

const draft = { title: "Arrange community meeting", problem: "Session times conflict with market hours" };
describe("planning action safeguards", () => {
  it("allows a proposal but requires accountable ownership and a real deadline before agreement", () => {
    expect(planningActionSchema.safeParse(draft).success).toBe(true);
    expect(planningActionSchema.safeParse({ ...draft, status: "agreed" }).success).toBe(false);
    expect(planningActionSchema.safeParse({ ...draft, status: "agreed", owner: "Facility in-charge", dueDate: "2026-02-30" }).success).toBe(false);
    expect(planningActionSchema.safeParse({ ...draft, status: "agreed", owner: "Facility in-charge", dueDate: "2026-09-30" }).success).toBe(true);
  });
  it("requires evidence for completion and a reason for cancellation", () => {
    expect(planningActionSchema.safeParse({ ...draft, owner: "Lead", dueDate: "2026-09-30", status: "completed" }).success).toBe(false);
    expect(planningActionSchema.safeParse({ ...draft, status: "cancelled" }).success).toBe(false);
  });
  it("prevents skipping agreement or independent verification", () => {
    expect(canTransitionAction("proposed", "verified")).toBe(false);
    expect(canTransitionAction("proposed", "completed")).toBe(false);
    expect(canTransitionAction("completed", "verified")).toBe(true);
  });
  it("does not mark completed actions or today's deadlines overdue", () => {
    expect(isActionOverdue({ status: "agreed", dueDate: "2026-09-08" }, "2026-09-09")).toBe(true);
    expect(isActionOverdue({ status: "completed", dueDate: "2026-09-08" }, "2026-09-09")).toBe(false);
    expect(isActionOverdue({ status: "agreed", dueDate: "2026-09-09" }, "2026-09-09")).toBe(false);
  });
  it("rejects orphaned sources and client-injected scope fields", () => {
    expect(planningActionSchema.safeParse({ ...draft, sourceType: "supervision" }).success).toBe(false);
    expect(planningActionSchema.safeParse({ ...draft, tenantId: "another tenant" }).success).toBe(false);
  });
  it("keeps planning scope additive and requires a concrete planning reference", () => {
    expect(planningActionSchema.safeParse({ ...draft, microplanId: 12, communityId: 44, supportingPeople: "District EPI team" }).success).toBe(true);
    expect(planningActionSchema.safeParse({ ...draft, planningLinkType: "session" }).success).toBe(false);
    expect(planningActionSchema.safeParse({ ...draft, planningLinkType: "session", planningLinkReference: "Session 81" }).success).toBe(true);
  });
});
