import { and, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  temporalAuditEvents,
  temporalChangeRequests,
  temporalEntityVersions,
  temporalPopulationDenominators,
  temporalRoleAssignments,
  temporalEmploymentAssignments,
  type TemporalEntityVersion,
} from "@shared/schema";

export const TEMPORAL_STATUSES = [
  "draft",
  "pending_review",
  "pending_approval",
  "scheduled",
  "active",
  "superseded",
  "corrected",
  "cancelled",
  "rejected",
  "archived",
] as const;

export const TEMPORAL_CHANGE_TYPES = [
  "creation",
  "amendment",
  "correction",
  "transfer",
  "promotion",
  "demotion",
  "temporary_assignment",
  "suspension",
  "termination",
  "reactivation",
  "rename",
  "recode",
  "split",
  "merge",
  "boundary_change",
  "hierarchy_change",
  "reclassification",
  "population_revision",
  "source_update",
  "role_assignment",
  "permission_change",
  "data_import",
  "system_synchronisation",
] as const;

export type TemporalActor = {
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CreateVersionInput = {
  tenantId: string;
  entityType: string;
  stableEntityId: string;
  sourceRecordId?: string | null;
  validFrom: Date;
  validTo?: Date | null;
  status?: string;
  changeType?: string;
  changeReason?: string | null;
  changeSummary?: string | null;
  sourceType?: string | null;
  sourceReference?: string | null;
  sourceDocumentUrl?: string | null;
  sourceSystem?: string | null;
  snapshot: Record<string, unknown>;
  affectedRecords?: unknown[];
  metadata?: Record<string, unknown>;
  isCorrection?: boolean;
  correctedFromVersionId?: string | null;
};

export function parseTemporalDate(value: unknown, fallback = new Date()): Date {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date/time: ${value}`);
  }
  return d;
}

function isOpenAt(validFrom: Date, validTo: Date | null | undefined, at: Date): boolean {
  return validFrom <= at && (!validTo || validTo > at);
}

function changedFields(previous: any, next: any): string[] {
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(next || {})]);
  const changed: string[] = [];
  for (const key of Array.from(keys)) {
    if (JSON.stringify(previous?.[key]) !== JSON.stringify(next?.[key])) changed.push(key);
  }
  return changed.sort();
}

export class TemporalService {
  async getCurrentVersion(tenantId: string, entityType: string, stableEntityId: string) {
    const [row] = await db
      .select()
      .from(temporalEntityVersions)
      .where(and(
        eq(temporalEntityVersions.tenantId, tenantId),
        eq(temporalEntityVersions.entityType, entityType),
        eq(temporalEntityVersions.stableEntityId, stableEntityId),
        eq(temporalEntityVersions.isCurrent, true),
        isNull(temporalEntityVersions.recordedUntil),
      ))
      .orderBy(desc(temporalEntityVersions.versionNumber))
      .limit(1);
    return row;
  }

  async getVersionAsOf(tenantId: string, entityType: string, stableEntityId: string, validDate: Date) {
    const [row] = await db
      .select()
      .from(temporalEntityVersions)
      .where(and(
        eq(temporalEntityVersions.tenantId, tenantId),
        eq(temporalEntityVersions.entityType, entityType),
        eq(temporalEntityVersions.stableEntityId, stableEntityId),
        lte(temporalEntityVersions.validFrom, validDate),
        or(isNull(temporalEntityVersions.validTo), gt(temporalEntityVersions.validTo, validDate)),
        isNull(temporalEntityVersions.recordedUntil),
      ))
      .orderBy(desc(temporalEntityVersions.versionNumber))
      .limit(1);
    return row;
  }

  async getSystemVersionAsOf(tenantId: string, entityType: string, stableEntityId: string, recordedDate: Date) {
    const [row] = await db
      .select()
      .from(temporalEntityVersions)
      .where(and(
        eq(temporalEntityVersions.tenantId, tenantId),
        eq(temporalEntityVersions.entityType, entityType),
        eq(temporalEntityVersions.stableEntityId, stableEntityId),
        lte(temporalEntityVersions.recordedAt, recordedDate),
        or(isNull(temporalEntityVersions.recordedUntil), gt(temporalEntityVersions.recordedUntil, recordedDate)),
      ))
      .orderBy(desc(temporalEntityVersions.versionNumber))
      .limit(1);
    return row;
  }

  async getHistory(tenantId: string, entityType: string, stableEntityId: string) {
    return db
      .select()
      .from(temporalEntityVersions)
      .where(and(
        eq(temporalEntityVersions.tenantId, tenantId),
        eq(temporalEntityVersions.entityType, entityType),
        eq(temporalEntityVersions.stableEntityId, stableEntityId),
      ))
      .orderBy(desc(temporalEntityVersions.versionNumber), desc(temporalEntityVersions.recordedAt));
  }

  async getFutureChanges(tenantId: string, entityType: string, stableEntityId: string, asOf = new Date()) {
    return db
      .select()
      .from(temporalEntityVersions)
      .where(and(
        eq(temporalEntityVersions.tenantId, tenantId),
        eq(temporalEntityVersions.entityType, entityType),
        eq(temporalEntityVersions.stableEntityId, stableEntityId),
        gt(temporalEntityVersions.validFrom, asOf),
        isNull(temporalEntityVersions.recordedUntil),
      ))
      .orderBy(temporalEntityVersions.validFrom);
  }

  async createDraftVersion(input: CreateVersionInput, actor: TemporalActor = {}) {
    if (input.validTo && input.validTo <= input.validFrom) {
      throw new Error("valid_to must be later than valid_from");
    }
    const overlaps = await this.detectOverlaps(input.tenantId, input.entityType, input.stableEntityId, input.validFrom, input.validTo ?? null);
    const latest = await this.getLatestVersionNumber(input.tenantId, input.entityType, input.stableEntityId);
    const now = new Date();
    const isFuture = input.validFrom > now;
    const [row] = await db.insert(temporalEntityVersions).values({
      tenantId: input.tenantId,
      entityType: input.entityType,
      stableEntityId: input.stableEntityId,
      sourceRecordId: input.sourceRecordId ?? null,
      versionNumber: latest + 1,
      validFrom: input.validFrom,
      validTo: input.validTo ?? null,
      status: input.status ?? "draft",
      isCurrent: false,
      isFuture,
      isCorrection: input.isCorrection ?? false,
      correctedFromVersionId: input.correctedFromVersionId ?? null,
      changeType: input.changeType ?? "creation",
      changeReason: input.changeReason ?? null,
      changeSummary: input.changeSummary ?? null,
      sourceType: input.sourceType ?? null,
      sourceReference: input.sourceReference ?? null,
      sourceDocumentUrl: input.sourceDocumentUrl ?? null,
      sourceSystem: input.sourceSystem ?? null,
      createdBy: actor.userId ?? null,
      snapshot: input.snapshot,
      affectedRecords: input.affectedRecords ?? overlaps,
      metadata: { ...(input.metadata ?? {}), overlapWarnings: overlaps },
    }).returning();
    await this.logEvent(input.tenantId, input.entityType, input.stableEntityId, row.id, "version_created", row.changeSummary || "Temporal version created.", null, row.snapshot, actor);
    return row;
  }

  async submitVersion(versionId: string, tenantId: string, actor: TemporalActor = {}, reason?: string) {
    const [row] = await db.update(temporalEntityVersions)
      .set({ status: "pending_approval", updatedAt: new Date() })
      .where(and(eq(temporalEntityVersions.id, versionId), eq(temporalEntityVersions.tenantId, tenantId)))
      .returning();
    if (!row) return undefined;
    await db.insert(temporalChangeRequests).values({
      tenantId,
      entityType: row.entityType,
      stableEntityId: row.stableEntityId,
      versionId,
      workflowStatus: "pending_approval",
      requestedAction: "approve_version",
      retroactive: row.validFrom < new Date(),
      requiresImpactAssessment: row.validFrom < new Date() || (Array.isArray(row.affectedRecords) && row.affectedRecords.length > 0),
      requestedBy: actor.userId ?? null,
      requestReason: reason ?? row.changeReason ?? null,
      submittedAt: new Date(),
    });
    await this.logEvent(tenantId, row.entityType, row.stableEntityId, row.id, "version_submitted", "Temporal version submitted for approval.", null, row.snapshot, actor);
    return row;
  }

  async approveVersion(versionId: string, tenantId: string, actor: TemporalActor = {}, comments?: string) {
    return db.transaction(async (tx) => {
      const [version] = await tx.select().from(temporalEntityVersions)
        .where(and(eq(temporalEntityVersions.id, versionId), eq(temporalEntityVersions.tenantId, tenantId)))
        .limit(1);
      if (!version) return undefined;
      const now = new Date();
      const activeNow = isOpenAt(version.validFrom, version.validTo, now);
      if (activeNow) {
        await tx.update(temporalEntityVersions)
          .set({ isCurrent: false, recordedUntil: now, status: "superseded", updatedAt: now, supersededBy: version.id })
          .where(and(
            eq(temporalEntityVersions.tenantId, tenantId),
            eq(temporalEntityVersions.entityType, version.entityType),
            eq(temporalEntityVersions.stableEntityId, version.stableEntityId),
            eq(temporalEntityVersions.isCurrent, true),
            isNull(temporalEntityVersions.recordedUntil),
          ));
      }
      const [approved] = await tx.update(temporalEntityVersions)
        .set({
          status: activeNow ? "active" : "scheduled",
          isCurrent: activeNow,
          isFuture: version.validFrom > now,
          approvedBy: actor.userId ?? null,
          approvedAt: now,
          updatedAt: now,
        })
        .where(and(eq(temporalEntityVersions.id, versionId), eq(temporalEntityVersions.tenantId, tenantId)))
        .returning();
      await tx.update(temporalChangeRequests)
        .set({ workflowStatus: "approved", approvedBy: actor.userId ?? null, approvedAt: now, approvalComments: comments ?? null, updatedAt: now })
        .where(and(eq(temporalChangeRequests.versionId, versionId), eq(temporalChangeRequests.tenantId, tenantId)));
      await tx.insert(temporalAuditEvents).values({
        tenantId,
        entityType: approved.entityType,
        stableEntityId: approved.stableEntityId,
        versionId: approved.id,
        eventType: "version_approved",
        eventSummary: `Temporal version ${approved.versionNumber} approved${activeNow ? " and activated" : " and scheduled"}.`,
        newValues: approved.snapshot,
        changedFields: [],
        actorId: actor.userId ?? null,
        approverId: actor.userId ?? null,
        sourceIpAddress: actor.ipAddress ?? null,
        userAgent: actor.userAgent ?? null,
      });
      return approved;
    });
  }

  async rejectVersion(versionId: string, tenantId: string, actor: TemporalActor = {}, comments?: string) {
    const now = new Date();
    const [row] = await db.update(temporalEntityVersions)
      .set({ status: "rejected", updatedAt: now })
      .where(and(eq(temporalEntityVersions.id, versionId), eq(temporalEntityVersions.tenantId, tenantId)))
      .returning();
    if (!row) return undefined;
    await db.update(temporalChangeRequests)
      .set({ workflowStatus: "rejected", reviewedBy: actor.userId ?? null, rejectedAt: now, reviewComments: comments ?? null, updatedAt: now })
      .where(and(eq(temporalChangeRequests.versionId, versionId), eq(temporalChangeRequests.tenantId, tenantId)));
    await this.logEvent(tenantId, row.entityType, row.stableEntityId, row.id, "version_rejected", comments || "Temporal version rejected.", null, row.snapshot, actor);
    return row;
  }

  async correctVersion(versionId: string, tenantId: string, correction: Partial<CreateVersionInput>, actor: TemporalActor = {}) {
    const [existing] = await db.select().from(temporalEntityVersions)
      .where(and(eq(temporalEntityVersions.id, versionId), eq(temporalEntityVersions.tenantId, tenantId)))
      .limit(1);
    if (!existing) return undefined;
    await db.update(temporalEntityVersions)
      .set({ recordedUntil: new Date(), status: "corrected", isCurrent: false, updatedAt: new Date() })
      .where(and(eq(temporalEntityVersions.id, versionId), eq(temporalEntityVersions.tenantId, tenantId)));
    return this.createDraftVersion({
      tenantId,
      entityType: existing.entityType,
      stableEntityId: existing.stableEntityId,
      sourceRecordId: existing.sourceRecordId,
      validFrom: correction.validFrom ?? existing.validFrom,
      validTo: correction.validTo ?? existing.validTo,
      status: "pending_approval",
      changeType: correction.changeType ?? "correction",
      changeReason: correction.changeReason ?? "Correction to previously recorded temporal version.",
      changeSummary: correction.changeSummary ?? `Corrects version ${existing.versionNumber}.`,
      sourceType: correction.sourceType ?? existing.sourceType,
      sourceReference: correction.sourceReference ?? existing.sourceReference,
      sourceDocumentUrl: correction.sourceDocumentUrl ?? existing.sourceDocumentUrl,
      sourceSystem: correction.sourceSystem ?? existing.sourceSystem,
      snapshot: correction.snapshot ?? (existing.snapshot as Record<string, unknown>),
      affectedRecords: correction.affectedRecords ?? [],
      metadata: { ...(existing.metadata as any), ...(correction.metadata ?? {}) },
      isCorrection: true,
      correctedFromVersionId: existing.id,
    }, actor);
  }

  async cancelFutureVersion(versionId: string, tenantId: string, actor: TemporalActor = {}, reason?: string) {
    const [row] = await db.update(temporalEntityVersions)
      .set({ status: "cancelled", cancelledAt: new Date(), isCurrent: false, isFuture: false, updatedAt: new Date(), changeReason: reason ?? undefined })
      .where(and(eq(temporalEntityVersions.id, versionId), eq(temporalEntityVersions.tenantId, tenantId)))
      .returning();
    if (!row) return undefined;
    await this.logEvent(tenantId, row.entityType, row.stableEntityId, row.id, "version_cancelled", reason || "Future temporal version cancelled.", null, row.snapshot, actor);
    return row;
  }

  compareVersions(a?: TemporalEntityVersion | null, b?: TemporalEntityVersion | null) {
    const before = (a?.snapshot ?? {}) as Record<string, unknown>;
    const after = (b?.snapshot ?? {}) as Record<string, unknown>;
    return {
      fromVersionId: a?.id ?? null,
      toVersionId: b?.id ?? null,
      changedFields: changedFields(before, after),
      before,
      after,
    };
  }

  async detectOverlaps(tenantId: string, entityType: string, stableEntityId: string, validFrom: Date, validTo: Date | null) {
    const rows = await db.select().from(temporalEntityVersions)
      .where(and(
        eq(temporalEntityVersions.tenantId, tenantId),
        eq(temporalEntityVersions.entityType, entityType),
        eq(temporalEntityVersions.stableEntityId, stableEntityId),
        isNull(temporalEntityVersions.recordedUntil),
        sql`${temporalEntityVersions.status} IN ('active','scheduled','pending_approval')`,
        sql`${temporalEntityVersions.validFrom} < COALESCE(${validTo}, 'infinity'::timestamptz)`,
        sql`COALESCE(${temporalEntityVersions.validTo}, 'infinity'::timestamptz) > ${validFrom}`,
      ));
    return rows.map((row) => ({
      versionId: row.id,
      versionNumber: row.versionNumber,
      status: row.status,
      validFrom: row.validFrom,
      validTo: row.validTo,
    }));
  }

  async getAffectedRecords(tenantId: string, entityType: string, stableEntityId: string, validFrom: Date, validTo: Date | null) {
    return this.detectOverlaps(tenantId, entityType, stableEntityId, validFrom, validTo);
  }

  async getRoleAssignmentsAsOf(tenantId: string, userId: string, at = new Date()) {
    return db.select().from(temporalRoleAssignments)
      .where(and(
        eq(temporalRoleAssignments.tenantId, tenantId),
        eq(temporalRoleAssignments.userId, userId),
        lte(temporalRoleAssignments.effectiveStart, at),
        or(isNull(temporalRoleAssignments.effectiveEnd), gt(temporalRoleAssignments.effectiveEnd, at)),
        sql`${temporalRoleAssignments.status} IN ('active','approved')`,
      ));
  }

  async getPopulationAsOf(tenantId: string, geographyType: string, geographyStableId: string, at: Date, referenceYear?: number) {
    const filters = [
      eq(temporalPopulationDenominators.tenantId, tenantId),
      eq(temporalPopulationDenominators.geographyType, geographyType),
      eq(temporalPopulationDenominators.geographyStableId, geographyStableId),
      lte(temporalPopulationDenominators.validFrom, at),
      or(isNull(temporalPopulationDenominators.validTo), gt(temporalPopulationDenominators.validTo, at)),
      sql`${temporalPopulationDenominators.status} IN ('active','approved')`,
    ];
    if (referenceYear) filters.push(eq(temporalPopulationDenominators.referenceYear, referenceYear));
    return db.select().from(temporalPopulationDenominators)
      .where(and(...filters))
      .orderBy(desc(temporalPopulationDenominators.approvedPlanningValue), desc(temporalPopulationDenominators.createdAt));
  }

  private async getLatestVersionNumber(tenantId: string, entityType: string, stableEntityId: string) {
    const [latest] = await db.select({ versionNumber: temporalEntityVersions.versionNumber })
      .from(temporalEntityVersions)
      .where(and(
        eq(temporalEntityVersions.tenantId, tenantId),
        eq(temporalEntityVersions.entityType, entityType),
        eq(temporalEntityVersions.stableEntityId, stableEntityId),
      ))
      .orderBy(desc(temporalEntityVersions.versionNumber))
      .limit(1);
    return latest?.versionNumber ?? 0;
  }

  async createRoleAssignment(
    tenantId: string,
    data: {
      userId: string;
      roleCode: string;
      scopeType?: string;
      scopeId?: string;
      effectiveStart: Date;
      effectiveEnd?: Date | null;
      assignmentType?: string;
      delegatedAuthority?: boolean;
      approvalLimit?: number;
      appointmentSource?: string;
      reason?: string;
      status?: string;
    },
    actor: TemporalActor = {}
  ) {
    if (data.effectiveEnd && data.effectiveEnd <= data.effectiveStart) {
      throw new Error("effectiveEnd must be later than effectiveStart");
    }
    const overlaps = await db.select().from(temporalRoleAssignments).where(
      and(
        eq(temporalRoleAssignments.tenantId, tenantId),
        eq(temporalRoleAssignments.userId, data.userId),
        eq(temporalRoleAssignments.roleCode, data.roleCode),
        sql`${temporalRoleAssignments.status} IN ('active','approved','pending_approval')`,
        sql`${temporalRoleAssignments.effectiveStart} < COALESCE(${data.effectiveEnd ? data.effectiveEnd.toISOString() : null}::timestamptz, 'infinity'::timestamptz)`,
        sql`COALESCE(${temporalRoleAssignments.effectiveEnd}, 'infinity'::timestamptz) > ${data.effectiveStart.toISOString()}::timestamptz`
      )
    );
    if (overlaps.length > 0) {
      throw new Error(`Role assignment overlaps with ${overlaps.length} existing assignment(s).`);
    }

    const [row] = await db.insert(temporalRoleAssignments).values({
      tenantId,
      userId: data.userId,
      roleCode: data.roleCode,
      scopeType: data.scopeType ?? "tenant",
      scopeId: data.scopeId ?? null,
      effectiveStart: data.effectiveStart,
      effectiveEnd: data.effectiveEnd ?? null,
      assignmentType: data.assignmentType ?? "substantive",
      delegatedAuthority: data.delegatedAuthority ?? false,
      approvalLimit: data.approvalLimit ? String(data.approvalLimit) as any : null,
      appointmentSource: data.appointmentSource ?? null,
      assignedBy: actor.userId ?? null,
      reason: data.reason ?? null,
      status: data.status ?? "pending_approval",
    }).returning();

    await this.logEvent(
      tenantId,
      "role_assignment",
      row.id,
      null,
      "role_assignment_proposed",
      `Role assignment for ${row.roleCode} proposed.`,
      null,
      row,
      actor
    );
    return row;
  }

  async approveRoleAssignment(tenantId: string, id: string, actor: TemporalActor = {}, comments?: string) {
    const now = new Date();
    const [existing] = await db.select().from(temporalRoleAssignments)
      .where(and(eq(temporalRoleAssignments.id, id), eq(temporalRoleAssignments.tenantId, tenantId)))
      .limit(1);
    if (!existing) return undefined;

    const [row] = await db.update(temporalRoleAssignments)
      .set({
        status: existing.effectiveStart <= now ? "active" : "approved",
        approvedBy: actor.userId ?? null,
        updatedAt: now,
        metadata: { ...(existing.metadata as any), approvalComments: comments ?? null },
      })
      .where(and(eq(temporalRoleAssignments.id, id), eq(temporalRoleAssignments.tenantId, tenantId)))
      .returning();

    await this.logEvent(
      tenantId,
      "role_assignment",
      row.id,
      null,
      "role_assignment_approved",
      `Role assignment for ${row.roleCode} approved.`,
      null,
      row,
      actor
    );
    return row;
  }

  async createEmploymentAssignment(
    tenantId: string,
    data: {
      personUserId?: string | null;
      stablePersonId: string;
      employer?: string;
      department?: string;
      programme?: string;
      employmentNumber?: string;
      jobTitle?: string;
      cadre?: string;
      employmentType?: string;
      contractType?: string;
      employmentStatus?: string;
      dutyStation?: string;
      facilityId?: number | null;
      districtId?: number | null;
      provinceId?: number | null;
      supervisorUserId?: string | null;
      startDate: Date;
      endDate?: Date | null;
      appointmentReference?: string;
      actingOrSubstantive?: string;
      secondment?: boolean;
      reasonForChange?: string;
    },
    actor: TemporalActor = {}
  ) {
    if (data.endDate && data.endDate <= data.startDate) {
      throw new Error("endDate must be later than startDate");
    }

    const [row] = await db.insert(temporalEmploymentAssignments).values({
      tenantId,
      personUserId: data.personUserId ?? null,
      stablePersonId: data.stablePersonId,
      employer: data.employer ?? null,
      department: data.department ?? null,
      programme: data.programme ?? null,
      employmentNumber: data.employmentNumber ?? null,
      jobTitle: data.jobTitle ?? null,
      cadre: data.cadre ?? null,
      employmentType: data.employmentType ?? null,
      contractType: data.contractType ?? null,
      employmentStatus: data.employmentStatus ?? "active",
      dutyStation: data.dutyStation ?? null,
      facilityId: data.facilityId ?? null,
      districtId: data.districtId ?? null,
      provinceId: data.provinceId ?? null,
      supervisorUserId: data.supervisorUserId ?? null,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      appointmentReference: data.appointmentReference ?? null,
      actingOrSubstantive: data.actingOrSubstantive ?? "substantive",
      secondment: data.secondment ?? false,
      reasonForChange: data.reasonForChange ?? null,
      status: "active",
      createdBy: actor.userId ?? null,
    }).returning();

    await this.logEvent(
      tenantId,
      "employment_assignment",
      row.id,
      null,
      "employment_created",
      `Employment assignment for person ${row.stablePersonId} created.`,
      null,
      row,
      actor
    );
    return row;
  }

  async terminateEmploymentAssignment(
    tenantId: string,
    id: string,
    actor: TemporalActor = {},
    reason?: string,
    endDate = new Date()
  ) {
    const [existing] = await db.select().from(temporalEmploymentAssignments)
      .where(and(eq(temporalEmploymentAssignments.id, id), eq(temporalEmploymentAssignments.tenantId, tenantId)))
      .limit(1);
    if (!existing) return undefined;

    const [row] = await db.update(temporalEmploymentAssignments)
      .set({
        endDate,
        employmentStatus: "terminated",
        status: "terminated",
        reasonForChange: reason ?? "Employment assignment terminated.",
        updatedAt: new Date(),
      })
      .where(and(eq(temporalEmploymentAssignments.id, id), eq(temporalEmploymentAssignments.tenantId, tenantId)))
      .returning();

    // Also end associated temporal role assignments
    if (existing.personUserId) {
      await db.update(temporalRoleAssignments)
        .set({ status: "expired", effectiveEnd: endDate, updatedAt: new Date() })
        .where(
          and(
            eq(temporalRoleAssignments.tenantId, tenantId),
            eq(temporalRoleAssignments.userId, existing.personUserId),
            eq(temporalRoleAssignments.status, "active"),
            isNull(temporalRoleAssignments.effectiveEnd)
          )
        );
    }

    await this.logEvent(
      tenantId,
      "employment_assignment",
      row.id,
      null,
      "employment_terminated",
      `Employment assignment for person ${row.stablePersonId} terminated.`,
      existing,
      row,
      actor
    );
    return row;
  }

  /**
   * Scans and activates scheduled temporal entities, role assignments, and employment profiles
   * whose effective valid dates have reached the current date. Expired profiles are closed.
   */
  async activateScheduledVersions(tenantId: string, now = new Date()) {
    const results = {
      activatedVersions: 0,
      activatedRoles: 0,
      expiredRoles: 0,
      expiredEmployments: 0,
    };

    await db.transaction(async (tx) => {
      // 1. Generic scheduled versions
      const scheduled = await tx.select().from(temporalEntityVersions).where(
        and(
          eq(temporalEntityVersions.tenantId, tenantId),
          eq(temporalEntityVersions.status, "scheduled"),
          lte(temporalEntityVersions.validFrom, now),
          isNull(temporalEntityVersions.recordedUntil)
        )
      );

      for (const ver of scheduled) {
        // Supersede active current version of same entity
        await tx.update(temporalEntityVersions)
          .set({ isCurrent: false, recordedUntil: now, status: "superseded", updatedAt: now, supersededBy: ver.id })
          .where(
            and(
              eq(temporalEntityVersions.tenantId, tenantId),
              eq(temporalEntityVersions.entityType, ver.entityType),
              eq(temporalEntityVersions.stableEntityId, ver.stableEntityId),
              eq(temporalEntityVersions.isCurrent, true),
              isNull(temporalEntityVersions.recordedUntil)
            )
          );

        // Activate scheduled version
        await tx.update(temporalEntityVersions)
          .set({ status: "active", isCurrent: true, isFuture: false, updatedAt: now })
          .where(eq(temporalEntityVersions.id, ver.id));

        await tx.insert(temporalAuditEvents).values({
          tenantId,
          entityType: ver.entityType,
          stableEntityId: ver.stableEntityId,
          versionId: ver.id,
          eventType: "version_activated",
          eventSummary: `Scheduled temporal version ${ver.versionNumber} reached effective date and was activated.`,
          newValues: ver.snapshot,
          changedFields: [],
          actorId: null,
          occurredAt: now,
        });

        results.activatedVersions++;
      }

      // 2. Scheduled role assignments
      const scheduledRoles = await tx.update(temporalRoleAssignments)
        .set({ status: "active", updatedAt: now })
        .where(
          and(
            eq(temporalRoleAssignments.tenantId, tenantId),
            eq(temporalRoleAssignments.status, "approved"),
            lte(temporalRoleAssignments.effectiveStart, now),
            or(isNull(temporalRoleAssignments.effectiveEnd), gt(temporalRoleAssignments.effectiveEnd, now))
          )
        )
        .returning();
      results.activatedRoles += scheduledRoles.length;

      // 3. Expired role assignments
      const expiredRoles = await tx.update(temporalRoleAssignments)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(temporalRoleAssignments.tenantId, tenantId),
            eq(temporalRoleAssignments.status, "active"),
            sql`COALESCE(${temporalRoleAssignments.effectiveEnd}, 'infinity'::timestamptz) > '1970-01-01'::timestamptz`,
            lte(temporalRoleAssignments.effectiveEnd, now)
          )
        )
        .returning();
      results.expiredRoles += expiredRoles.length;

      // 4. Expired employment assignments
      const expiredEmps = await tx.update(temporalEmploymentAssignments)
        .set({ status: "terminated", employmentStatus: "terminated", updatedAt: now })
        .where(
          and(
            eq(temporalEmploymentAssignments.tenantId, tenantId),
            eq(temporalEmploymentAssignments.status, "active"),
            sql`COALESCE(${temporalEmploymentAssignments.endDate}, 'infinity'::timestamptz) > '1970-01-01'::timestamptz`,
            lte(temporalEmploymentAssignments.endDate, now)
          )
        )
        .returning();
      results.expiredEmployments += expiredEmps.length;
    });

    return results;
  }

  private async logEvent(
    tenantId: string,
    entityType: string,
    stableEntityId: string,
    versionId: string | null,
    eventType: string,
    eventSummary: string,
    previousValues: unknown,
    newValues: unknown,
    actor: TemporalActor,
  ) {
    await db.insert(temporalAuditEvents).values({
      tenantId,
      entityType,
      stableEntityId,
      versionId,
      eventType,
      eventSummary,
      previousValues: previousValues as any,
      newValues: newValues as any,
      changedFields: changedFields(previousValues, newValues),
      actorId: actor.userId ?? null,
      sourceIpAddress: actor.ipAddress ?? null,
      userAgent: actor.userAgent ?? null,
    });
  }
}

export const temporalService = new TemporalService();

