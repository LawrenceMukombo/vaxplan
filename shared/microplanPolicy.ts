import { z } from "zod";

export const developmentDaysSchema = z.number().int().min(1).max(3650);
export function minimumDevelopmentDays(settings: unknown): number {
  const result = developmentDaysSchema.safeParse((settings as any)?.minimumPlanDevelopmentDays);
  return result.success ? result.data : 7;
}
// Backward-compatible setting name: this value is now an SLA target used for
// reminders/escalation, not a lock that prevents reviewers from acting.
export function approvalReviewSlaDays(settings: unknown): number {
  const configured = (settings as any)?.approvalReviewSlaDays
    ?? (settings as any)?.minimumPlanDevelopmentDays;
  const result = developmentDaysSchema.safeParse(configured);
  return result.success ? result.data : 7;
}
export function minimumSessionLeadDays(settings: unknown): number {
  const result = developmentDaysSchema.safeParse(
    (settings as any)?.minimumSessionLeadDays ?? (settings as any)?.sessionExecutionLeadDays
  );
  return result.success ? result.data : 7;
}

export function isApprovedPlan(status: unknown): boolean {
  return status === "approved" || status === "auto_approved";
}
export function formatSimpleDateTime(date: Date): string {
  try {
    const y = date.getUTCFullYear();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = months[date.getUTCMonth()];
    const d = date.getUTCDate();
    const h = date.getUTCHours();
    const min = String(date.getUTCMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${d} ${m} ${y}, ${h12}:${min} ${ampm}`;
  } catch {
    return date.toISOString();
  }
}

export function approvalEligibility(submittedAt: string | Date | null | undefined, settings: unknown, now = new Date()) {
  const days = approvalReviewSlaDays(settings);
  const sessionLeadDays = minimumSessionLeadDays(settings);
  const submitted = submittedAt ? new Date(submittedAt) : null;
  const validSubmission = !!submitted && Number.isFinite(submitted.getTime());
  const reviewDueAt = validSubmission ? new Date(submitted.getTime() + days * 86400000) : null;
  const formattedDueDate = reviewDueAt ? formatSimpleDateTime(reviewDueAt) : null;
  void now;
  return {
    days,
    sessionLeadDays,
    eligibleAt: validSubmission ? submitted : null,
    reviewDueAt,
    allowed: validSubmission,
    message: validSubmission
      ? `Approval can start immediately after submission. The ${days}-day review SLA is due by ${formattedDueDate} and is used for reminders and escalation, not as a waiting period. Planned vaccination sessions must remain at least ${sessionLeadDays} days ahead of implementation.`
      : "The plan submission date is missing or invalid; approval is blocked.",
  };
}
