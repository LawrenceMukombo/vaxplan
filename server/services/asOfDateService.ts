import { EntityHistoryService } from "./entityHistoryService";
import { db } from "../db";
import { users, facilities, villages, populationData } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class AsOfDateService {
  /**
   * Resolve a user's role and facility/location assignment on a specific date
   */
  static async getUserAssignmentAsOf(
    tenantId: string,
    userId: string,
    targetDate: Date | string
  ) {
    const historicalVersion = await EntityHistoryService.getAsOf(
      tenantId,
      "user",
      userId,
      targetDate
    );

    if (historicalVersion && historicalVersion.snapshotData) {
      return {
        userId,
        asOfDate: new Date(targetDate),
        versionNumber: historicalVersion.versionNumber,
        validFrom: historicalVersion.validFrom,
        validTo: historicalVersion.validTo,
        ...(historicalVersion.snapshotData as Record<string, any>),
      };
    }

    // Fallback to active current database state if no temporal snapshot exists
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)));

    return user ? { userId, asOfDate: new Date(targetDate), ...user } : null;
  }

  /**
   * Resolve a facility's attributes and operational status as of a specific date
   */
  static async getFacilityDetailsAsOf(
    tenantId: string,
    facilityId: number,
    targetDate: Date | string
  ) {
    const historicalVersion = await EntityHistoryService.getAsOf(
      tenantId,
      "facility",
      String(facilityId),
      targetDate
    );

    if (historicalVersion && historicalVersion.snapshotData) {
      return {
        facilityId,
        asOfDate: new Date(targetDate),
        versionNumber: historicalVersion.versionNumber,
        validFrom: historicalVersion.validFrom,
        validTo: historicalVersion.validTo,
        ...(historicalVersion.snapshotData as Record<string, any>),
      };
    }

    const [fac] = await db
      .select()
      .from(facilities)
      .where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, facilityId)));

    return fac ? { facilityId, asOfDate: new Date(targetDate), ...fac } : null;
  }

  /**
   * Resolve a community's attributes and linkage as of a specific date
   */
  static async getCommunityDetailsAsOf(
    tenantId: string,
    villageId: number,
    targetDate: Date | string
  ) {
    const historicalVersion = await EntityHistoryService.getAsOf(
      tenantId,
      "community",
      String(villageId),
      targetDate
    );

    if (historicalVersion && historicalVersion.snapshotData) {
      return {
        villageId,
        asOfDate: new Date(targetDate),
        versionNumber: historicalVersion.versionNumber,
        validFrom: historicalVersion.validFrom,
        validTo: historicalVersion.validTo,
        ...(historicalVersion.snapshotData as Record<string, any>),
      };
    }

    const [village] = await db
      .select()
      .from(villages)
      .where(and(eq(villages.tenantId, tenantId), eq(villages.id, villageId)));

    return village ? { villageId, asOfDate: new Date(targetDate), ...village } : null;
  }

  /**
   * Resolve population denominator valid as of a specific date
   */
  static async getPopulationDenominatorAsOf(
    tenantId: string,
    geographicUnitType: string,
    geographicUnitId: number,
    targetDate: Date | string
  ) {
    const entityKey = `${geographicUnitType}_${geographicUnitId}`;
    const historicalVersion = await EntityHistoryService.getAsOf(
      tenantId,
      "population",
      entityKey,
      targetDate
    );

    if (historicalVersion && historicalVersion.snapshotData) {
      return {
        asOfDate: new Date(targetDate),
        versionNumber: historicalVersion.versionNumber,
        validFrom: historicalVersion.validFrom,
        validTo: historicalVersion.validTo,
        ...(historicalVersion.snapshotData as Record<string, any>),
      };
    }

    return null;
  }
}
