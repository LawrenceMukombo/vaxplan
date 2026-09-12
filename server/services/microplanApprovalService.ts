import { and, desc, eq, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { approvalRequests, microplans, microplanVersions, users } from "@shared/schema";

export interface MicroplanApprovalAudit {
  status: string;
  isApproved: boolean;
  isAutoApproved: boolean;
  approvedAt: string | null;
  approvedDateLabel: string | null;
  approvedByUserId: string | null;
  approvedByName: string | null;
  approvedByRole: string | null;
  approvedByEmail: string | null;
  approvedByLabel: string | null;
  submittedAt: string | null;
  submittedDateLabel: string | null;
  submittedByUserId: string | null;
  submittedByName: string | null;
  submittedByRole: string | null;
  submittedByLabel: string | null;
  approvalLevel: string | null;
  approvalLevelLabel: string | null;
  comments: string | null;
  decisionReason: string | null;
  requestId: number | null;
  versionNumber: number | null;
}

function formatRoleLabel(role?: string | null): string {
  if (!role) return "Authorized Official";
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDateTime(dateVal?: Date | string | null): string | null {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export async function getMicroplanApprovalAudit(
  db: NodePgDatabase<any>,
  tenantId: string,
  microplan: any
): Promise<MicroplanApprovalAudit | null> {
  if (!microplan || !microplan.id) return null;

  const planId = Number(microplan.id);
  const status = String(microplan.status || "draft").toLowerCase();
  const isApproved = status === "approved" || status === "auto_approved";

  // 1. Fetch latest approval request for this microplan
  let matchingReq: any = null;
  try {
    const [req] = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.tenantId, tenantId),
          eq(approvalRequests.entityType, "microplan"),
          eq(approvalRequests.entityId, planId)
        )
      )
      .orderBy(desc(approvalRequests.id))
      .limit(1);
    matchingReq = req || null;
  } catch (err) {
    console.warn("[approvalService] Failed to load approval_request:", err);
  }

  // 2. Fetch latest approved version snapshot
  let approvedVersion: any = null;
  try {
    const [v] = await db
      .select()
      .from(microplanVersions)
      .where(
        and(
          eq(microplanVersions.tenantId, tenantId),
          eq(microplanVersions.microplanId, planId),
          or(
            eq(microplanVersions.status, "approved"),
            eq(microplanVersions.status, "auto_approved"),
            eq(microplanVersions.eventType, "approved")
          )
        )
      )
      .orderBy(desc(microplanVersions.versionNumber))
      .limit(1);
    approvedVersion = v || null;
  } catch (err) {
    console.warn("[approvalService] Failed to load microplan_versions:", err);
  }

  // 3. Resolve timestamps (handle both camelCase drizzle and snake_case pg driver rows)
  const rawApprovedAt =
    microplan.approvedAt ||
    microplan.approved_at ||
    matchingReq?.resolvedAt ||
    approvedVersion?.createdAt ||
    microplan.autoApprovedAt ||
    microplan.auto_approved_at ||
    (isApproved ? microplan.updatedAt || microplan.updated_at || microplan.createdAt || microplan.created_at : null);

  const approvedAt = rawApprovedAt ? new Date(rawApprovedAt).toISOString() : null;
  const approvedDateLabel = formatDateTime(rawApprovedAt);

  const rawSubmittedAt =
    microplan.submittedAt ||
    microplan.submitted_at ||
    matchingReq?.submittedAt ||
    null;
  const submittedAt = rawSubmittedAt ? new Date(rawSubmittedAt).toISOString() : null;
  const submittedDateLabel = formatDateTime(rawSubmittedAt);

  // 4. Resolve auto-approval
  const isAutoApproved =
    status === "auto_approved" ||
    Boolean(microplan.autoApprovedAt || microplan.auto_approved_at) ||
    matchingReq?.resolvedById === "system" ||
    Boolean(matchingReq?.comments && matchingReq.comments.toLowerCase().includes("auto-approved"));

  // 5. Resolve approver user
  const approverId =
    microplan.approvedByUserId ||
    microplan.approved_by_user_id ||
    matchingReq?.resolvedById ||
    approvedVersion?.createdByUserId ||
    null;

  let approvedByName: string | null = null;
  let approvedByRole: string | null = null;
  let approvedByEmail: string | null = null;

  if (isAutoApproved) {
    approvedByName = "Automated Approval Policy";
    approvedByRole = "14-Day Inactivity Rule";
  } else if (approverId && approverId !== "system") {
    try {
      const [u] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, approverId))
        .limit(1);

      if (u) {
        const full = [u.firstName, u.lastName].filter(Boolean).join(" ");
        approvedByName = full || u.email || "Authorized Approver";
        approvedByRole = formatRoleLabel(u.role);
        approvedByEmail = u.email || null;
      } else {
        approvedByName = "Authorized Approver";
        approvedByRole = "Health Authority";
      }
    } catch (err) {
      console.warn("[approvalService] Failed to resolve approver user:", err);
      approvedByName = "Authorized Approver";
    }
  } else if (isApproved) {
    approvedByName = "Designated Health Authority";
    approvedByRole = "Programme Supervisor";
  }

  const approvedByLabel = approvedByName
    ? `${approvedByName}${approvedByRole ? ` (${approvedByRole})` : ""}`
    : null;

  // 6. Resolve submitter user
  const submitterId =
    matchingReq?.requestedById ||
    microplan.createdByUserId ||
    microplan.created_by_user_id ||
    null;

  let submittedByName: string | null = null;
  let submittedByRole: string | null = null;

  if (submitterId) {
    try {
      const [u] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, submitterId))
        .limit(1);

      if (u) {
        const full = [u.firstName, u.lastName].filter(Boolean).join(" ");
        submittedByName = full || u.email || "Facility In-Charge";
        submittedByRole = formatRoleLabel(u.role);
      }
    } catch (err) {
      console.warn("[approvalService] Failed to resolve submitter user:", err);
    }
  }

  const submittedByLabel = submittedByName
    ? `${submittedByName}${submittedByRole ? ` (${submittedByRole})` : ""}`
    : null;

  // 7. Resolve level and comments
  const rawLevel = matchingReq?.currentLevel || "district";
  const approvalLevelLabel =
    rawLevel.charAt(0).toUpperCase() + rawLevel.slice(1) + " Level Review";

  const comments = matchingReq?.comments || approvedVersion?.reason || null;
  const decisionReason = approvedVersion?.reason || matchingReq?.comments || null;

  return {
    status,
    isApproved,
    isAutoApproved,
    approvedAt,
    approvedDateLabel,
    approvedByUserId: approverId,
    approvedByName,
    approvedByRole,
    approvedByEmail,
    approvedByLabel,
    submittedAt,
    submittedDateLabel,
    submittedByUserId: submitterId,
    submittedByName,
    submittedByRole,
    submittedByLabel,
    approvalLevel: rawLevel,
    approvalLevelLabel,
    comments,
    decisionReason,
    requestId: matchingReq?.id || null,
    versionNumber: approvedVersion?.versionNumber || null,
  };
}
