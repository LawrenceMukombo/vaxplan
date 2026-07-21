import { db } from "../db";
import {
  entityHistoryVersions,
  userAssignmentHistory,
  facilityHistoryVersions,
  communityHistoryVersions,
  populationHistoryVersions,
  vaccineScheduleHistoryVersions,
  stockReferenceHistoryVersions,
  reportEntitySnapshots,
  type EntityHistoryVersion,
} from "@shared/schema";
import { eq, and, lte, gte, or, isNull, desc, asc } from "drizzle-orm";

export interface CreateChangePayload {
  changeType?: string;
  changeReason?: string;
  changeSummary?: string;
  sourceType?: string;
  sourceReference?: string;
  sourceDocumentUrl?: string;
  validFrom?: Date | string;
  validTo?: Date | string;
  metadataJson?: Record<string, any>;
  snapshotData?: Record<string, any>;
  countryId?: number;
  provinceId?: number;
  districtId?: number;
  facilityId?: number;
}

export class EntityHistoryService {
  /**
   * Get the active current version of an entity
   */
  static async getCurrent(
    tenantId: string,
    entityType: string,
    stableEntityId: string
  ): Promise<EntityHistoryVersion | null> {
    const [row] = await db
      .select()
      .from(entityHistoryVersions)
      .where(
        and(
          eq(entityHistoryVersions.tenantId, tenantId),
          eq(entityHistoryVersions.entityType, entityType),
          eq(entityHistoryVersions.stableEntityId, String(stableEntityId)),
          eq(entityHistoryVersions.isCurrent, true),
          eq(entityHistoryVersions.status, "active")
        )
      )
      .limit(1);

    return row || null;
  }

  /**
   * Get full chronological version history of an entity
   */
  static async getHistory(
    tenantId: string,
    entityType: string,
    stableEntityId: string
  ): Promise<EntityHistoryVersion[]> {
    return await db
      .select()
      .from(entityHistoryVersions)
      .where(
        and(
          eq(entityHistoryVersions.tenantId, tenantId),
          eq(entityHistoryVersions.entityType, entityType),
          eq(entityHistoryVersions.stableEntityId, String(stableEntityId))
        )
      )
      .orderBy(desc(entityHistoryVersions.versionNumber));
  }

  /**
   * Resolve state of an entity as of a specific date
   */
  static async getAsOf(
    tenantId: string,
    entityType: string,
    stableEntityId: string,
    targetDate: Date | string
  ): Promise<EntityHistoryVersion | null> {
    const date = new Date(targetDate);

    const versions = await db
      .select()
      .from(entityHistoryVersions)
      .where(
        and(
          eq(entityHistoryVersions.tenantId, tenantId),
          eq(entityHistoryVersions.entityType, entityType),
          eq(entityHistoryVersions.stableEntityId, String(stableEntityId)),
          lte(entityHistoryVersions.validFrom, date)
        )
      )
      .orderBy(desc(entityHistoryVersions.validFrom), desc(entityHistoryVersions.versionNumber));

    const validVersion = versions.find((v) => {
      if (v.status !== "active" && v.status !== "superseded" && v.status !== "approved") {
        return false;
      }
      if (!v.validTo) return true;
      return new Date(v.validTo) >= date;
    });

    return validVersion || null;
  }

  /**
   * Propose a new change/version for an entity
   */
  static async createChange(
    tenantId: string,
    entityType: string,
    stableEntityId: string,
    payload: CreateChangePayload,
    userId?: string
  ): Promise<EntityHistoryVersion> {
    const existing = await this.getHistory(tenantId, entityType, stableEntityId);
    const nextVersionNumber = existing.length > 0 ? Math.max(...existing.map((e) => e.versionNumber)) + 1 : 1;

    const validFromDate = payload.validFrom ? new Date(payload.validFrom) : new Date();
    const validToDate = payload.validTo ? new Date(payload.validTo) : null;
    const isFutureDated = validFromDate > new Date();

    const [newVersion] = await db
      .insert(entityHistoryVersions)
      .values({
        tenantId,
        stableEntityId: String(stableEntityId),
        entityType,
        versionNumber: nextVersionNumber,
        countryId: payload.countryId ?? null,
        provinceId: payload.provinceId ?? null,
        districtId: payload.districtId ?? null,
        facilityId: payload.facilityId ?? null,
        validFrom: validFromDate,
        validTo: validToDate,
        status: isFutureDated ? "pending_review" : "draft",
        isCurrent: false,
        changeType: payload.changeType || "updated",
        changeReason: payload.changeReason || null,
        changeSummary: payload.changeSummary || null,
        sourceType: payload.sourceType || "manual",
        sourceReference: payload.sourceReference || null,
        sourceDocumentUrl: payload.sourceDocumentUrl || null,
        createdBy: userId || null,
        metadataJson: payload.metadataJson || {},
        snapshotData: payload.snapshotData || {},
      })
      .returning();

    // Insert domain specific version detail table
    await this.insertDomainVersionDetail(tenantId, newVersion.id, entityType, stableEntityId, payload, userId);

    return newVersion;
  }

  /**
   * Automatically record an active entity version snapshot on entity creation or update
   */
  static async recordAutoSnapshot(
    tenantId: string,
    entityType: string,
    stableEntityId: string,
    snapshotData: Record<string, any>,
    changeType = "updated",
    changeReason?: string,
    userId?: string
  ): Promise<EntityHistoryVersion> {
    const current = await this.getCurrent(tenantId, entityType, stableEntityId);
    const existingHistory = await this.getHistory(tenantId, entityType, stableEntityId);
    const versionNumber = existingHistory.length > 0 ? Math.max(...existingHistory.map((e) => e.versionNumber)) + 1 : 1;

    const now = new Date();

    // Mark current active version as superseded
    if (current) {
      await db
        .update(entityHistoryVersions)
        .set({
          isCurrent: false,
          status: "superseded",
          validTo: now,
          recordedUntil: now,
          updatedAt: now,
        })
        .where(eq(entityHistoryVersions.id, current.id));
    }

    const [newVersion] = await db
      .insert(entityHistoryVersions)
      .values({
        tenantId,
        stableEntityId: String(stableEntityId),
        entityType,
        versionNumber,
        countryId: snapshotData.countryId ? Number(snapshotData.countryId) : null,
        provinceId: snapshotData.provinceId ? Number(snapshotData.provinceId) : null,
        districtId: snapshotData.districtId ? Number(snapshotData.districtId) : null,
        facilityId: snapshotData.facilityId ? Number(snapshotData.facilityId) : null,
        validFrom: now,
        validTo: null,
        recordedAt: now,
        status: "active",
        isCurrent: true,
        changeType,
        changeReason: changeReason || "Operational system update",
        changeSummary: `${entityType} version ${versionNumber} activated`,
        sourceType: "system",
        createdBy: userId || "system",
        snapshotData,
      })
      .returning();

    // Link domain history table
    await this.insertDomainVersionDetail(tenantId, newVersion.id, entityType, stableEntityId, { snapshotData }, userId);

    return newVersion;
  }

  /**
   * Submit change proposal for review
   */
  static async submitChange(tenantId: string, versionId: number, userId?: string): Promise<EntityHistoryVersion> {
    const [row] = await db
      .update(entityHistoryVersions)
      .set({
        status: "pending_review",
        updatedAt: new Date(),
      })
      .where(and(eq(entityHistoryVersions.tenantId, tenantId), eq(entityHistoryVersions.id, versionId)))
      .returning();

    if (!row) throw new Error("Entity version record not found");
    return row;
  }

  /**
   * Approve a change proposal and activate if validFrom <= now
   */
  static async approveChange(tenantId: string, versionId: number, userId?: string): Promise<EntityHistoryVersion> {
    const [version] = await db
      .select()
      .from(entityHistoryVersions)
      .where(and(eq(entityHistoryVersions.tenantId, tenantId), eq(entityHistoryVersions.id, versionId)));

    if (!version) throw new Error("Version record not found");

    const now = new Date();
    const isEffectiveNow = new Date(version.validFrom) <= now;

    if (isEffectiveNow) {
      // Supersede previous current active version
      const current = await this.getCurrent(tenantId, version.entityType, version.stableEntityId);
      if (current && current.id !== versionId) {
        await db
          .update(entityHistoryVersions)
          .set({
            isCurrent: false,
            status: "superseded",
            validTo: version.validFrom,
            recordedUntil: now,
            supersededBy: versionId,
            updatedAt: now,
          })
          .where(eq(entityHistoryVersions.id, current.id));
      }
    }

    const [approved] = await db
      .update(entityHistoryVersions)
      .set({
        status: isEffectiveNow ? "active" : "approved",
        isCurrent: isEffectiveNow,
        reviewedBy: userId || null,
        approvedBy: userId || null,
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(entityHistoryVersions.id, versionId))
      .returning();

    return approved;
  }

  /**
   * Reject proposed change
   */
  static async rejectChange(tenantId: string, versionId: number, userId?: string, reason?: string): Promise<EntityHistoryVersion> {
    const [rejected] = await db
      .update(entityHistoryVersions)
      .set({
        status: "rejected",
        isCurrent: false,
        reviewedBy: userId || null,
        changeReason: reason ? `Rejected: ${reason}` : "Change rejected by reviewer",
        updatedAt: new Date(),
      })
      .where(and(eq(entityHistoryVersions.tenantId, tenantId), eq(entityHistoryVersions.id, versionId)))
      .returning();

    if (!rejected) throw new Error("Version record not found");
    return rejected;
  }

  /**
   * Retroactively correct a mistake in a version without wiping history
   */
  static async correctVersion(
    tenantId: string,
    versionId: number,
    payload: CreateChangePayload,
    userId?: string
  ): Promise<EntityHistoryVersion> {
    const [original] = await db
      .select()
      .from(entityHistoryVersions)
      .where(and(eq(entityHistoryVersions.tenantId, tenantId), eq(entityHistoryVersions.id, versionId)));

    if (!original) throw new Error("Original version not found");

    // Mark original as corrected
    await db
      .update(entityHistoryVersions)
      .set({
        status: "corrected",
        isCurrent: false,
        updatedAt: new Date(),
      })
      .where(eq(entityHistoryVersions.id, versionId));

    // Insert corrected version linking to original
    const [corrected] = await db
      .insert(entityHistoryVersions)
      .values({
        tenantId,
        stableEntityId: original.stableEntityId,
        entityType: original.entityType,
        versionNumber: original.versionNumber,
        countryId: payload.countryId ?? original.countryId,
        provinceId: payload.provinceId ?? original.provinceId,
        districtId: payload.districtId ?? original.districtId,
        facilityId: payload.facilityId ?? original.facilityId,
        validFrom: payload.validFrom ? new Date(payload.validFrom) : original.validFrom,
        validTo: payload.validTo ? new Date(payload.validTo) : original.validTo,
        status: "active",
        isCurrent: true,
        changeType: "corrected",
        changeReason: payload.changeReason || `Correction for version ${original.versionNumber}`,
        changeSummary: payload.changeSummary || `Retroactive correction applied`,
        createdBy: userId || null,
        approvedBy: userId || null,
        approvedAt: new Date(),
        correctedFromVersionId: versionId,
        snapshotData: { ...((original.snapshotData as any) || {}), ...((payload.snapshotData as any) || {}) },
      })
      .returning();

    return corrected;
  }

  /**
   * Compare two versions side by side
   */
  static async compareVersions(
    tenantId: string,
    versionAId: number,
    versionBId: number
  ): Promise<{
    versionA: EntityHistoryVersion;
    versionB: EntityHistoryVersion;
    differences: Array<{ field: string; valueA: any; valueB: any }>;
  }> {
    const [vA] = await db
      .select()
      .from(entityHistoryVersions)
      .where(and(eq(entityHistoryVersions.tenantId, tenantId), eq(entityHistoryVersions.id, versionAId)));

    const [vB] = await db
      .select()
      .from(entityHistoryVersions)
      .where(and(eq(entityHistoryVersions.tenantId, tenantId), eq(entityHistoryVersions.id, versionBId)));

    if (!vA || !vB) throw new Error("One or both version records not found");

    const snapA = (vA.snapshotData as Record<string, any>) || {};
    const snapB = (vB.snapshotData as Record<string, any>) || {};

    const allKeys = Array.from(new Set([...Object.keys(snapA), ...Object.keys(snapB)]));
    const differences: Array<{ field: string; valueA: any; valueB: any }> = [];

    for (const key of allKeys) {
      if (JSON.stringify(snapA[key]) !== JSON.stringify(snapB[key])) {
        differences.push({
          field: key,
          valueA: snapA[key] ?? null,
          valueB: snapB[key] ?? null,
        });
      }
    }

    return { versionA: vA, versionB: vB, differences };
  }

  /**
   * Helper to write domain specific history record
   */
  private static async insertDomainVersionDetail(
    tenantId: string,
    versionId: number,
    entityType: string,
    stableEntityId: string,
    payload: any,
    userId?: string
  ) {
    try {
      const data = payload.snapshotData || {};
      if (entityType === "user") {
        await db.insert(userAssignmentHistory).values({
          tenantId,
          versionId,
          userId: stableEntityId,
          roleId: data.roleId || data.role || null,
          roleName: data.roleName || data.campaignRole || data.role || null,
          assignmentType: data.assignmentType || "substantive",
          facilityId: data.facilityId ? Number(data.facilityId) : null,
          districtId: data.districtId ? Number(data.districtId) : null,
          provinceId: data.provinceId ? Number(data.provinceId) : null,
          countryId: data.countryId ? Number(data.countryId) : null,
          validFrom: payload.validFrom ? new Date(payload.validFrom) : new Date(),
          validTo: payload.validTo ? new Date(payload.validTo) : null,
          status: "active",
          assignedBy: userId || null,
          reason: payload.changeReason || null,
        });
      } else if (entityType === "facility") {
        await db.insert(facilityHistoryVersions).values({
          tenantId,
          versionId,
          facilityId: Number(stableEntityId),
          name: data.name || "Facility",
          hmisCode: data.hmisCode || data.code || null,
          facilityType: data.facilityType || data.type || null,
          ownership: data.ownership || null,
          operationalStatus: data.operationalStatus || "operational",
          districtId: data.districtId ? Number(data.districtId) : null,
          provinceId: data.provinceId ? Number(data.provinceId) : null,
          countryId: data.countryId ? Number(data.countryId) : null,
          coldChainStatus: data.coldChainStatus || "No",
          staffCount: data.staffCount ? Number(data.staffCount) : 0,
          validFrom: payload.validFrom ? new Date(payload.validFrom) : new Date(),
          status: "active",
          changeReason: payload.changeReason || null,
        });
      } else if (entityType === "community") {
        await db.insert(communityHistoryVersions).values({
          tenantId,
          versionId,
          villageId: Number(stableEntityId),
          name: data.name || "Community",
          code: data.code || null,
          assignedFacilityId: data.assignedFacilityId ? Number(data.assignedFacilityId) : null,
          districtId: data.districtId ? Number(data.districtId) : null,
          populationEstimate: data.targetPopulation ? Number(data.targetPopulation) : null,
          validFrom: payload.validFrom ? new Date(payload.validFrom) : new Date(),
          status: "active",
          changeReason: payload.changeReason || null,
        });
      } else if (entityType === "population") {
        await db.insert(populationHistoryVersions).values({
          tenantId,
          versionId,
          populationEntityId: stableEntityId,
          geographicUnitType: data.geographicUnitType || "facility",
          geographicUnitId: data.geographicUnitId ? Number(data.geographicUnitId) : 0,
          source: data.source || "NSO",
          sourceYear: data.year ? Number(data.year) : new Date().getFullYear(),
          totalPopulation: data.totalPopulation ? Number(data.totalPopulation) : 0,
          planningStatus: data.planningStatus || "official",
          validFrom: payload.validFrom ? new Date(payload.validFrom) : new Date(),
          status: "active",
          changeReason: payload.changeReason || null,
        });
      }
    } catch (err) {
      console.error("Error writing domain version detail:", err);
    }
  }
}
