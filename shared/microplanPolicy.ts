import { z } from "zod";

export const developmentDaysSchema = z.number().int().min(1).max(3650);
export function minimumDevelopmentDays(settings: unknown): number {
  const result = developmentDaysSchema.safeParse((settings as any)?.minimumPlanDevelopmentDays);
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

export function approvalEligibility(createdAt: string | Date | null | undefined, settings: unknown, now = new Date()) {
  const days = minimumDevelopmentDays(settings);
  const sessionLeadDays = minimumSessionLeadDays(settings);
  const created = createdAt ? new Date(createdAt) : null;
  const eligibleAt = created && Number.isFinite(created.getTime()) ? new Date(created.getTime() + days * 86400000) : null;
  const formattedDate = eligibleAt ? formatSimpleDateTime(eligibleAt) : null;
  return {
    days,
    sessionLeadDays,
    eligibleAt,
    allowed: eligibleAt !== null && now >= eligibleAt,
    message: eligibleAt
      ? `Plan approvals require at least ${days} days of review following submission (approval eligible from ${formattedDate}). All planned vaccination sessions must be scheduled for implementation at least ${sessionLeadDays} days after approval.`
      : "The plan creation date is missing or invalid; approval is blocked.",
  };
}
