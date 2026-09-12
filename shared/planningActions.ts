import { z } from "zod";

export const actionStatuses = ["proposed", "agreed", "in_progress", "blocked", "completed", "verified", "cancelled"] as const;
export type ActionStatus = typeof actionStatuses[number];
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid calendar date");
export const planningActionSchema = z.object({
  title: z.string().trim().min(3).max(200),
  problem: z.string().trim().min(3).max(4000),
  owner: z.string().trim().max(200).default(""),
  supportingPeople: z.string().trim().max(1000).default(""),
  dueDate: dateOnly.nullable().default(null),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(actionStatuses).default("proposed"),
  resources: z.string().trim().max(4000).default(""),
  microplanId: z.number().int().positive().nullable().default(null),
  communityId: z.number().int().positive().nullable().default(null),
  planningLinkType: z.enum(["none", "session", "budget", "population", "mobilization", "microplan"]).default("none"),
  planningLinkReference: z.string().trim().max(500).default(""),
  evidence: z.string().trim().max(4000).default(""),
  resolutionReason: z.string().trim().max(2000).default(""),
  sourceType: z.enum(["manual", "quarterly_review", "supervision", "consultation", "barrier", "microplan"]).default("manual"),
  sourceId: z.number().int().positive().nullable().default(null),
  evidenceId: z.string().uuid().nullable().default(null),
}).strict().superRefine((value, context) => {
  if (!["proposed", "cancelled"].includes(value.status)) {
    if (!value.owner) context.addIssue({ code: "custom", path: ["owner"], message: "An accountable owner is required" });
    if (!value.dueDate) context.addIssue({ code: "custom", path: ["dueDate"], message: "A deadline is required" });
  }
  if (["completed", "verified"].includes(value.status) && !value.evidence)
    context.addIssue({ code: "custom", path: ["evidence"], message: "Completion evidence is required" });
  if (["blocked", "cancelled"].includes(value.status) && !value.resolutionReason)
    context.addIssue({ code: "custom", path: ["resolutionReason"], message: "Explain why the action is blocked or cancelled" });
  if (["quarterly_review", "supervision", "microplan"].includes(value.sourceType) && value.sourceId === null)
    context.addIssue({ code: "custom", path: ["sourceId"], message: "Select a valid source record" });
  if (["manual", "consultation", "barrier"].includes(value.sourceType) && value.sourceId !== null)
    context.addIssue({ code: "custom", path: ["sourceId"], message: "This source uses its evidence link rather than a numeric source record" });
  if (["consultation", "barrier"].includes(value.sourceType) && !value.evidenceId)
    context.addIssue({ code: "custom", path: ["evidenceId"], message: "Link the consultation or barrier record" });
  if (value.planningLinkType !== "none" && !value.planningLinkReference)
    context.addIssue({ code: "custom", path: ["planningLinkReference"], message: "Describe or identify the linked planning decision" });
});
export type PlanningActionInput = z.infer<typeof planningActionSchema>;
export type PlanningAction = PlanningActionInput & {
  id: string; tenantId: string; facilityId: number; version: number;
  createdAt: string; updatedAt: string; updatedBy: string;
};
const transitions: Record<ActionStatus, readonly ActionStatus[]> = {
  proposed: ["agreed", "cancelled"], agreed: ["in_progress", "blocked", "completed", "cancelled"],
  in_progress: ["blocked", "completed", "cancelled"], blocked: ["agreed", "in_progress", "cancelled"],
  completed: ["verified", "in_progress"], verified: ["in_progress"], cancelled: ["proposed"],
};
export function canTransitionAction(from: ActionStatus, to: ActionStatus): boolean {
  return from === to || transitions[from].includes(to);
}
export function isActionOverdue(action: Pick<PlanningActionInput, "status" | "dueDate">, today: string): boolean {
  return Boolean(action.dueDate && action.dueDate < today && !["completed", "verified", "cancelled"].includes(action.status));
}
