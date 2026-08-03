import { and, desc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  budgetItems,
  facilityStaff,
  microplans,
  microplanVersions,
  mobilizationActivities,
  sessionPlans,
  sessionVillages,
  vaccineRequirements,
  villages,
} from "@shared/schema";

type VersionEvent =
  | "draft_saved"
  | "submitted"
  | "approved"
  | "returned"
  | "rejected"
  | "restored"
  | "rebaseline";

export async function buildMicroplanSnapshot(db: NodePgDatabase<any>, tenantId: string, microplanId: number) {
  const [microplan] = await db.select().from(microplans)
    .where(and(eq(microplans.tenantId, tenantId), eq(microplans.id, microplanId))).limit(1);
  if (!microplan) throw new Error("Microplan not found");

  const sessions = await db.select().from(sessionPlans)
    .where(and(eq(sessionPlans.tenantId, tenantId), eq(sessionPlans.microplanId, microplanId)));
  const sessionIds = sessions.map((session: any) => session.id);
  const linkedVillages = sessionIds.length
    ? await db.select().from(sessionVillages).where(and(eq(sessionVillages.tenantId, tenantId), inArray(sessionVillages.sessionId, sessionIds)))
    : [];
  const communities = microplan.facilityId
    ? await db.select().from(villages).where(and(eq(villages.tenantId, tenantId), eq(villages.assignedFacilityId, microplan.facilityId)))
    : [];
  const staff = microplan.facilityId
    ? await db.select().from(facilityStaff).where(and(eq(facilityStaff.tenantId, tenantId), eq(facilityStaff.facilityId, microplan.facilityId)))
    : [];
  const vaccines = microplan.facilityId
    ? await db.select().from(vaccineRequirements).where(and(
        eq(vaccineRequirements.tenantId, tenantId),
        eq(vaccineRequirements.facilityId, microplan.facilityId),
        eq(vaccineRequirements.year, microplan.year),
        eq(vaccineRequirements.quarter, microplan.quarter),
      ))
    : [];
  const mobilization = microplan.facilityId
    ? await db.select().from(mobilizationActivities).where(and(eq(mobilizationActivities.tenantId, tenantId), eq(mobilizationActivities.facilityId, microplan.facilityId)))
    : [];
  const budget = sessionIds.length
    ? await db.select().from(budgetItems).where(and(eq(budgetItems.tenantId, tenantId), inArray(budgetItems.sessionId, sessionIds)))
    : [];

  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    microplan,
    communities,
    sessions,
    sessionVillages: linkedVillages,
    facilityStaff: staff,
    vaccineRequirements: vaccines,
    mobilizationActivities: mobilization,
    budgetItems: budget,
  };
}

export async function createMicroplanVersion(
  db: NodePgDatabase<any>,
  input: {
    tenantId: string;
    microplanId: number;
    userId?: string | null;
    eventType: VersionEvent;
    reason?: string | null;
    status?: string;
  },
) {
  const snapshot = await buildMicroplanSnapshot(db, input.tenantId, input.microplanId);
  const [latest] = await db.select({ versionNumber: microplanVersions.versionNumber })
    .from(microplanVersions)
    .where(and(eq(microplanVersions.tenantId, input.tenantId), eq(microplanVersions.microplanId, input.microplanId)))
    .orderBy(desc(microplanVersions.versionNumber)).limit(1);
  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  const status = input.status ?? String((snapshot as any).microplan.status ?? "draft");
  const [version] = await db.insert(microplanVersions).values({
    tenantId: input.tenantId,
    microplanId: input.microplanId,
    versionNumber,
    versionLabel: "v" + versionNumber,
    eventType: input.eventType,
    status,
    reason: input.reason || null,
    snapshot,
    createdByUserId: input.userId || null,
  }).returning();
  return version;
}

export async function listMicroplanVersions(db: NodePgDatabase<any>, tenantId: string, microplanId: number) {
  return db.select({
    id: microplanVersions.id,
    microplanId: microplanVersions.microplanId,
    versionNumber: microplanVersions.versionNumber,
    versionLabel: microplanVersions.versionLabel,
    eventType: microplanVersions.eventType,
    status: microplanVersions.status,
    reason: microplanVersions.reason,
    createdByUserId: microplanVersions.createdByUserId,
    createdAt: microplanVersions.createdAt,
  }).from(microplanVersions)
    .where(and(eq(microplanVersions.tenantId, tenantId), eq(microplanVersions.microplanId, microplanId)))
    .orderBy(desc(microplanVersions.versionNumber));
}

export async function getMicroplanVersion(db: NodePgDatabase<any>, tenantId: string, microplanId: number, versionId: number) {
  const [version] = await db.select().from(microplanVersions).where(and(
    eq(microplanVersions.tenantId, tenantId),
    eq(microplanVersions.microplanId, microplanId),
    eq(microplanVersions.id, versionId),
  )).limit(1);
  return version;
}

function flatten(value: unknown, prefix = "", result: Record<string, unknown> = {}) {
  if (Array.isArray(value)) {
    result[prefix] = value;
    return result;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix ? prefix + "." + key : key, result);
    }
    return result;
  }
  result[prefix] = value;
  return result;
}

export function compareMicroplanSnapshots(left: unknown, right: unknown) {
  const leftFlat = flatten(left);
  const rightFlat = flatten(right);
  const keys = Array.from(new Set([...Object.keys(leftFlat), ...Object.keys(rightFlat)])).sort();
  return keys.flatMap((path) => {
    const before = leftFlat[path];
    const after = rightFlat[path];
    return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ path, before, after }];
  });
}

export async function restoreMicroplanVersionAsDraft(
  db: NodePgDatabase<any>,
  input: { tenantId: string; microplanId: number; versionId: number; userId?: string | null; reason: string },
) {
  const source = await getMicroplanVersion(db, input.tenantId, input.microplanId, input.versionId);
  if (!source) throw new Error("Microplan version not found");
  const sourcePlan = (source.snapshot as any)?.microplan;
  if (!sourcePlan) throw new Error("Microplan version has no plan snapshot");

  await db.update(microplans).set({
    name: sourcePlan.name,
    targetPopulation: sourcePlan.targetPopulation,
    budget: sourcePlan.budget,
    staffing: sourcePlan.staffing,
    campaignAntigen: sourcePlan.campaignAntigen,
    campaignTargetAge: sourcePlan.campaignTargetAge,
    campaignScope: sourcePlan.campaignScope,
    campaignScopeDetails: sourcePlan.campaignScopeDetails,
    status: "draft",
    submittedAt: null,
    autoApproveAt: null,
    reminderSentAt: null,
    districtEditReason: input.reason,
    updatedByUserId: input.userId || null,
    updatedAt: new Date(),
  }).where(and(eq(microplans.tenantId, input.tenantId), eq(microplans.id, input.microplanId)));

  return createMicroplanVersion(db, {
    tenantId: input.tenantId,
    microplanId: input.microplanId,
    userId: input.userId,
    eventType: "restored",
    reason: input.reason,
    status: "draft",
  });
}
