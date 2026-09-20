import { Express } from "express";
import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  insertSessionPlanSchema,
  insertSessionDayPlanSchema,
  sessionPlans,
  sessionVillages,
  sessionDayPlans,
  villages,
  clients,
  clientVaccinations,
  budgetItems,
  populationData,
} from "@shared/schema";
import { hasPermission } from "../auth/authorization";
import { expandVaccineSchedule, canonicalizePerAntigen } from "@shared/vaccineSchedule";
import { isAuthenticated } from "../auth";
import { requireTenant } from "../auth/tenantResolver";
import { requireDbUser } from "../auth/loadDbUser";
import { safeErrorMessage } from "../errorUtils";
import {
  checkProximityAndPopulation,
  resolveSessionLocation,
} from "../services/proximityCheck";
import {
  logAudit,
  getFacilityHierarchy,
  getGeoScope,
  recordInGeoScope,
  userCanAccessGeo,
  validatePlanningLeadTimeAndNoConflict,
  sendMobilizationSmsForSession,
  indicatorCache,
  invalidateTenantIndicatorCache,
} from "../routes";

const auth = [isAuthenticated, requireTenant, requireDbUser] as const;

// ─── Sessions ─────────────────────────────────────────
// Read-time inheritance: overlay campaign* fields from the parent microplan
// so session responses always reflect the current parent values rather than
// a stale denormalised copy. The columns are kept on session_plans for
// offline-client back-compat but are no longer the source of truth.
export async function overlayCampaignFromParent<T extends { microplanId: number | null }>(
  tenantId: string,
  sessions: T[],
): Promise<T[]> {
  if (!sessions.length) return sessions;
  const ids = Array.from(new Set(sessions.map((s) => s.microplanId).filter((x): x is number => x != null)));
  const parents = new Map<number, any>();
  for (const id of ids) {
    const p = await storage.getMicroplan(tenantId, id);
    if (p) parents.set(id, p);
  }
  return sessions.map((s) => {
    const p = s.microplanId ? parents.get(s.microplanId) : null;
    if (!p) return s;
    const isCampaign = p.planType === "sia_campaign";
    return {
      ...s,
      planType: isCampaign ? "campaign" : "routine",
      campaignAntigen: isCampaign ? p.campaignAntigen ?? null : null,
      campaignTargetAge: isCampaign ? p.campaignTargetAge ?? null : null,
      campaignScope: isCampaign ? p.campaignScope ?? null : null,
      microplanName: p.name,
      microplanStatus: p.status,
      microplanYear: p.year,
      microplanQuarter: p.quarter,
    } as T;
  });
}

// Returns either { ok: true, parent, sessionPlanType } or { ok: false, status, message }.
// - parent must exist in same tenant
// - parent must not be locked (status='locked' or status='approved' is read-only)
// - if expected planType is provided, it must match the parent's
export async function validateParentMicroplan(
  tenantId: string,
  microplanId: number | null | undefined,
  expectedPlanType?: "routine" | "campaign",
): Promise<
  | { ok: true; parent: any; sessionPlanType: "routine" | "campaign" }
  | { ok: false; status: number; message: string }
> {
  if (!microplanId || !Number.isFinite(Number(microplanId))) {
    return { ok: false, status: 400, message: "microplanId is required: a session must belong to a parent microplan." };
  }
  const parent = await storage.getMicroplan(tenantId, Number(microplanId));
  if (!parent) {
    return { ok: false, status: 400, message: `Parent microplan ${microplanId} not found in this tenant.` };
  }
  if (parent.status !== "draft") {
    return { ok: false, status: 400, message: `Parent microplan "${parent.name}" is in "${parent.status}" status and is read-only; its sessions cannot be modified.` };
  }
  const parentSessionPlanType: "routine" | "campaign" =
    parent.planType === "sia_campaign" ? "campaign" : "routine";
  if (expectedPlanType && expectedPlanType !== parentSessionPlanType) {
    return {
      ok: false,
      status: 400,
      message: `Session planType "${expectedPlanType}" does not match parent microplan planType "${parentSessionPlanType}".`,
    };
  }
  return { ok: true, parent, sessionPlanType: parentSessionPlanType };
}

// Routine RI antigens we recognise for defaulters caught-up check.
const isCampaignDose = (name: string | null | undefined) => {
  if (!name) return false;
  const u = name.toUpperCase();
  return u.includes("SIA") || u.includes("CAMPAIGN");
};

const normAntigen = (name: string | null | undefined): string | null => {
  if (!name) return null;
  const u = name.toUpperCase().replace(/[\s\-_]/g, "");
  if (u.startsWith("PENTA")) {
    if (u.endsWith("1")) return "PENTA_1";
    if (u.endsWith("2")) return "PENTA_2";
    if (u.endsWith("3")) return "PENTA_3";
  }
  if (u.startsWith("DTP")) {
    if (u.endsWith("1")) return "PENTA_1";
    if (u.endsWith("2")) return "PENTA_2";
    if (u.endsWith("3")) return "PENTA_3";
  }
  if (u.startsWith("MR") || u.startsWith("MEASLES")) {
    if (u.endsWith("1")) return "MR_1";
    if (u.endsWith("2")) return "MR_2";
  }
  return null;
};

type BulkItem = { clientId?: string | number; id?: number | null; [k: string]: any };
type BulkResult = {
  clientId?: string | number;
  ok: boolean;
  id?: number;
  data?: any;
  error?: string;
};

function parseBulkItems(body: any): { items: BulkItem[] } | null {
  if (!body || !Array.isArray(body.items)) return null;
  return { items: body.items as BulkItem[] };
}

export function registerSessionRoutes(app: Express) {
  app.get(["/api/sessions", "/api/session-plans"], ...auth, async (req: any, res) => {
    try {
      const user = req.user as any;
      const dbUser = req.dbUser!;

      const facilityId = req.query.facilityId ? parseInt(req.query.facilityId as string) : undefined;

      if (facilityId) {
        const geoContext = await getFacilityHierarchy(facilityId, req.tenantId);
        if (!hasPermission(dbUser, "view_session_plans", geoContext)) {
          return res.json([]);
        }
      }

      let list = await storage.getSessionPlans(req.tenantId, facilityId);

      // Role-aware geographic scoping (facility staff → own facility, etc.).
      const scope = await getGeoScope(dbUser, req.tenantId);
      if (!scope.all) {
        list = list.filter((s: any) => recordInGeoScope(scope, { facilityId: s.facilityId }));
      }

      const overlaid = await overlayCampaignFromParent(req.tenantId, list);

      // Attach the real linked communities in one bulk query. The master
      // calendar needs this context to describe where a session will run;
      // `session_plans` intentionally stores that relation in the junction
      // table rather than in presentation-only `location` fields.
      const sessionIds = overlaid.map((s: any) => Number(s.id)).filter(Number.isFinite);
      const linkedRows = sessionIds.length
        ? await db
            .select({
              sessionId: sessionVillages.sessionId,
              villageId: villages.id,
              name: villages.name,
              isHardToReach: villages.isHardToReach,
              distanceKm: villages.distanceToFacility,
            })
            .from(sessionVillages)
            .innerJoin(villages, eq(villages.id, sessionVillages.villageId))
            .where(and(
              eq(sessionVillages.tenantId, req.tenantId),
              inArray(sessionVillages.sessionId, sessionIds),
            ))
        : [];
      const communitiesBySession = new Map<number, any[]>();
      const linkedVillageIds = Array.from(new Set(linkedRows.map((row) => row.villageId)));
      const populationRows = linkedVillageIds.length
        ? await db
            .select({
              villageId: populationData.villageId,
              under1Population: populationData.under1Population,
              year: populationData.year,
            })
            .from(populationData)
            .where(and(
              eq(populationData.tenantId, req.tenantId),
              inArray(populationData.villageId, linkedVillageIds),
            ))
        : [];
      const under1ByVillage = new Map<number, { year: number; value: number }>();
      for (const row of populationRows) {
        if (row.villageId == null || row.under1Population == null) continue;
        const candidate = { year: Number(row.year), value: Number(row.under1Population) };
        const existing = under1ByVillage.get(row.villageId);
        if (!existing || candidate.year > existing.year) under1ByVillage.set(row.villageId, candidate);
      }
      for (const row of linkedRows) {
        const entries = communitiesBySession.get(row.sessionId) ?? [];
        entries.push({
          id: row.villageId,
          name: row.name,
          isHardToReach: Boolean(row.isHardToReach),
          distanceKm: row.distanceKm == null ? null : Number(row.distanceKm),
          registeredUnder1: under1ByVillage.get(row.villageId)?.value ?? null,
        });
        communitiesBySession.set(row.sessionId, entries);
      }

      res.json(overlaid.map((session: any) => {
        const communities = communitiesBySession.get(session.id) ?? [];
        const registeredUnder1 = communities.reduce(
          (sum: number, community: any) => sum + (Number(community.registeredUnder1) || 0),
          0,
        );
        const plannedTarget = Number(session.targetPopulation) || 0;
        return {
          ...session,
          communities,
          registeredUnder1,
          effectiveTargetPopulation: plannedTarget > 0 ? plannedTarget : registeredUnder1,
          targetPopulationSource: plannedTarget > 0
            ? "session_plan"
            : registeredUnder1 > 0
              ? "linked_community_under1"
              : "not_available",
        };
      }));
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/villages", ...auth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) return res.json([]);
      let list = await db.select().from(sessionVillages).where(eq(sessionVillages.tenantId, String(tenantId)));
      const scope = await getGeoScope(req.dbUser, req.tenantId);
      if (!scope.all) {
        // Scope session-village linkage by the OWNING session's facility — the
        // same boundary /api/sessions enforces — so a foreign-facility session
        // can never expose its village links even via malformed data.
        const plans = await storage.getSessionPlans(req.tenantId);
        const allowedSessionIds = new Set(
          plans
            .filter((p: any) => recordInGeoScope(scope, { facilityId: p.facilityId }))
            .map((p: any) => p.id),
        );
        list = list.filter((r: any) => allowedSessionIds.has(r.sessionId));
      }
      res.json(list);
    } catch (error: any) {
      console.error("Error fetching session villages:", error);
      res.status(500).json({
        message: "Failed to fetch session villages",
        error: safeErrorMessage(error, "Unable to load session villages"),
        stack: error.stack,
      });
    }
  });

  app.get("/api/sessions/:id", ...auth, async (req: any, res, next) => {
    try {
      // Session ids are integers. This param route is registered before the
      // more specific string routes (/map, /history, /unmapped-antigens), so a
      // non-numeric param (e.g. "map") must fall through to those handlers
      // instead of being treated as an id (which threw and surfaced as a 500
      // "Failed to fetch session" on GET /api/sessions/map).
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id) || String(id) !== req.params.id) return next();
      const dbUser = req.dbUser!;
      const session = await storage.getSessionPlan(req.tenantId, id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      const geoContext = await getFacilityHierarchy(session.facilityId, req.tenantId);
      if (!hasPermission(dbUser, "view_session_plans", geoContext)) {
        return res.status(404).json({ message: "Session not found" });
      }
      const [overlaid] = await overlayCampaignFromParent(req.tenantId, [session]);
      res.json(overlaid);
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.post("/api/sessions", ...auth, async (req: any, res) => {
    try {
      const user = req.user as any;
      const dbUser = req.dbUser!;

      // Hard-reject any client attempt to dictate planType / campaign* — they're inherited.
      for (const f of ["planType", "campaignAntigen", "campaignTargetAge", "campaignScope"] as const) {
        if ((req.body as any)?.[f] !== undefined) {
          return res.status(400).json({
            message: `${f} is inherited from the parent microplan and must not be set on the session payload.`,
          });
        }
      }

      // Task #197 — outreachPurpose is a small whitelist so older offline
      // clients can't smuggle arbitrary values into the column.
      const ALLOWED_OUTREACH_PURPOSES = new Set([
        "defaulter_followup",
        "unserved",
        "routine_outreach",
      ]);
      if (
        (req.body as any)?.outreachPurpose != null &&
        !ALLOWED_OUTREACH_PURPOSES.has(String((req.body as any).outreachPurpose))
      ) {
        return res.status(400).json({
          message: `outreachPurpose must be one of: ${Array.from(ALLOWED_OUTREACH_PURPOSES).join(", ")}`,
        });
      }

      // Coerce client-supplied ISO scheduledDate string into a Date object
      // so the Drizzle/Zod timestamp validator accepts it.
      if (req.body?.scheduledDate && typeof req.body.scheduledDate === "string") {
        const parsed = new Date(req.body.scheduledDate);
        if (!isNaN(parsed.getTime())) req.body.scheduledDate = parsed;
      }

      const data = insertSessionPlanSchema.parse(req.body);

      // Enforce: only facility staff (and national_admin for testing/seed) can author session plans.
      const authorRoles = new Set(["facility_clerk", "facility_in_charge", "national_admin"]);
      if (!authorRoles.has(dbUser.role)) {
        return res.status(403).json({
          message: "Forbidden: only facility staff may author session plans. District/provincial/national roles are reviewers only.",
        });
      }

      // Validate parent microplan: required, same tenant, not locked.
      const parentCheck = await validateParentMicroplan(req.tenantId, (data as any).microplanId);
      if (!parentCheck.ok) {
        return res.status(parentCheck.status).json({ message: parentCheck.message });
      }

      if (!(await userCanAccessGeo(req.dbUser, req.tenantId, { facilityId: data.facilityId }))) {
        return res.status(403).json({
          message: "Forbidden: You do not have permission to manage session plans for this geographic scope.",
        });
      }

      // Enforce lead time and double booking validation if scheduledDate is provided
      if (data.scheduledDate) {
        const dateVal = await validatePlanningLeadTimeAndNoConflict(
          req.tenantId,
          data.facilityId,
          data.scheduledDate,
        );
        if (!dateVal.isValid) {
          return res.status(400).json({ message: dateVal.message });
        }
      }

      // Proximity + population enforcement. Block on warnings unless the
      // request carries `override: true`.
      if (data.scheduledDate && req.body?.override !== true) {
        const villageIds = Array.isArray(req.body?.villageIds) ? req.body.villageIds : undefined;
        const prox = await checkProximityAndPopulation(req.tenantId, {
          facilityId: data.facilityId,
          scheduledDate: data.scheduledDate as any,
          targetPopulation: Number(data.targetPopulation ?? 0),
          villageIds,
        });
        if (prox.warnings.length > 0) {
          return res.status(409).json({
            message: prox.warnings.join(" "),
            code: "proximity_population_warning",
            warnings: prox.warnings,
            nearbySessions: prox.nearbySessions,
            availablePopulation: prox.availablePopulation,
            committedPopulation: prox.committedPopulation,
          });
        }
      }

      const parentFacilityId = parentCheck.parent.facilityId;
      const parentYear = parentCheck.parent.year;
      const parentQuarter = parentCheck.parent.quarter;
      if (data.facilityId !== parentFacilityId) {
        return res.status(400).json({
          message: `facilityId ${data.facilityId} does not match parent microplan facilityId ${parentFacilityId}.`,
        });
      }
      if (data.year !== parentYear) {
        return res.status(400).json({
          message: `year ${data.year} does not match parent microplan year ${parentYear}.`,
        });
      }
      if (data.quarter !== parentQuarter) {
        return res.status(400).json({
          message: `quarter ${data.quarter} does not match parent microplan quarter ${parentQuarter}.`,
        });
      }

      const inherited: any = {
        ...data,
        facilityId: parentFacilityId,
        year: parentYear,
        quarter: parentQuarter,
        planType: parentCheck.sessionPlanType,
        campaignAntigen: parentCheck.sessionPlanType === "campaign" ? parentCheck.parent.campaignAntigen ?? null : null,
        campaignTargetAge: parentCheck.sessionPlanType === "campaign" ? parentCheck.parent.campaignTargetAge ?? null : null,
        campaignScope: parentCheck.sessionPlanType === "campaign" ? parentCheck.parent.campaignScope ?? null : null,
      };

      const session = await storage.createSessionPlan(req.tenantId, inherited);

      const rawVillageIds = Array.isArray(req.body?.villageIds) ? req.body.villageIds : [];
      const villageIdSet = Array.from(new Set(
        rawVillageIds
          .map((x: any) => Number(x))
          .filter((n: number) => Number.isFinite(n) && n > 0),
      )) as number[];
      if (villageIdSet.length > 0) {
        const tenantVillages = await db
          .select({ id: villages.id })
          .from(villages)
          .where(and(eq(villages.tenantId, req.tenantId), inArray(villages.id, villageIdSet)));
        const validIds = tenantVillages.map((v) => v.id);
        if (validIds.length > 0) {
          await db.insert(sessionVillages).values(
            validIds.map((vid, idx) => ({
              tenantId: req.tenantId,
              sessionId: session.id,
              villageId: vid,
              orderIndex: idx,
            })),
          );
        }
      }

      await logAudit(req, "create", "session_plan", session.id, null, session);
      try {
        await sendMobilizationSmsForSession(req.tenantId, session.id);
      } catch (smsErr) {
        console.error("Failed to send mobilization SMS for session:", smsErr);
      }
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid session data" });
    }
  });

  app.patch("/api/sessions/:id", ...auth, async (req: any, res) => {
    try {
      const user = req.user as any;
      const dbUser = req.dbUser!;
      const authorRoles = new Set(["facility_clerk", "facility_in_charge", "national_admin"]);
      if (!authorRoles.has(dbUser.role)) {
        return res.status(403).json({
          message: "Forbidden: only facility staff may modify session plans. District/provincial/national roles are reviewers only.",
        });
      }

      const entityId = parseInt(req.params.id);
      const oldSession = await storage.getSessionPlan(req.tenantId, entityId);
      if (!oldSession) return res.status(404).json({ message: "Session not found" });

      if (!(await userCanAccessGeo(req.dbUser, req.tenantId, { facilityId: oldSession.facilityId }))) {
        return res.status(403).json({
          message: "Forbidden: You do not have permission to manage session plans for this geographic scope.",
        });
      }

      const body = { ...req.body };
      if (body.microplanId !== undefined && Number(body.microplanId) !== Number(oldSession.microplanId)) {
        return res.status(400).json({ message: "Cannot reparent a session to a different microplan; delete and recreate it instead." });
      }
      if (body.planType !== undefined && body.planType !== oldSession.planType) {
        return res.status(400).json({ message: "planType is inherited from the parent microplan and cannot be changed on a session." });
      }
      for (const f of ["campaignAntigen", "campaignTargetAge", "campaignScope"] as const) {
        if (body[f] !== undefined && body[f] !== (oldSession as any)[f]) {
          return res.status(400).json({ message: `${f} is inherited from the parent microplan and cannot be changed on a session.` });
        }
      }
      for (const f of ["facilityId", "year", "quarter"] as const) {
        if (body[f] !== undefined && body[f] !== (oldSession as any)[f]) {
          return res.status(400).json({
            message: `${f} is derived from the parent microplan and cannot be changed on a session.`,
          });
        }
      }
      delete body.microplanId;
      delete body.planType;
      delete body.campaignAntigen;
      delete body.campaignTargetAge;
      delete body.campaignScope;
      delete body.facilityId;
      delete body.year;
      delete body.quarter;
      delete body.tenantId;

      const ALLOWED_OUTREACH_PURPOSES = new Set([
        "defaulter_followup",
        "unserved",
        "routine_outreach",
      ]);
      if (
        body.outreachPurpose !== undefined &&
        body.outreachPurpose !== null &&
        !ALLOWED_OUTREACH_PURPOSES.has(String(body.outreachPurpose))
      ) {
        return res.status(400).json({
          message: `outreachPurpose must be one of: ${Array.from(ALLOWED_OUTREACH_PURPOSES).join(", ")}`,
        });
      }

      const parentCheck = await validateParentMicroplan(req.tenantId, oldSession.microplanId);
      if (!parentCheck.ok) {
        return res.status(parentCheck.status).json({ message: parentCheck.message });
      }

      if (body.scheduledDate) {
        const dateVal = await validatePlanningLeadTimeAndNoConflict(
          req.tenantId,
          oldSession.facilityId,
          body.scheduledDate,
          entityId,
        );
        if (!dateVal.isValid) {
          return res.status(400).json({ message: dateVal.message });
        }
      }

      const effectiveDate = body.scheduledDate ?? oldSession.scheduledDate;
      if (effectiveDate && req.body?.override !== true) {
        const villageIds = Array.isArray(req.body?.villageIds) ? req.body.villageIds : undefined;
        const prox = await checkProximityAndPopulation(req.tenantId, {
          facilityId: oldSession.facilityId,
          scheduledDate: effectiveDate as any,
          targetPopulation: Number(body.targetPopulation ?? oldSession.targetPopulation ?? 0),
          villageIds,
          excludeSessionId: entityId,
        });
        if (prox.warnings.length > 0) {
          return res.status(409).json({
            message: prox.warnings.join(" "),
            code: "proximity_population_warning",
            warnings: prox.warnings,
            nearbySessions: prox.nearbySessions,
            availablePopulation: prox.availablePopulation,
            committedPopulation: prox.committedPopulation,
          });
        }
      }
      delete (body as any).override;
      const incomingVillageIds = req.body?.villageIds;
      delete (body as any).villageIds;

      const session = await storage.updateSessionPlan(req.tenantId, entityId, body);
      if (!session) return res.status(404).json({ message: "Session not found" });

      let villageLinkChange: { before: number[]; after: number[] } | null = null;
      if (Array.isArray(incomingVillageIds)) {
        const sanitized = Array.from(new Set(
          incomingVillageIds
            .map((x: any) => Number(x))
            .filter((n: number) => Number.isFinite(n) && n > 0),
        )) as number[];

        let validIds: number[] = [];
        if (sanitized.length > 0) {
          const tenantVillages = await db
            .select({ id: villages.id })
            .from(villages)
            .where(and(eq(villages.tenantId, req.tenantId), inArray(villages.id, sanitized)));
          validIds = tenantVillages.map((v) => v.id);
        }

        const existingRows = await db
          .select({ villageId: sessionVillages.villageId })
          .from(sessionVillages)
          .where(
            and(
              eq(sessionVillages.tenantId, String(req.tenantId)),
              eq(sessionVillages.sessionId, entityId),
            ),
          );
        const before = existingRows.map((r) => r.villageId);
        const beforeSet = new Set(before);
        const afterSet = new Set(validIds);

        const toAdd = validIds.filter((id) => !beforeSet.has(id));
        const toRemove = before.filter((id) => !afterSet.has(id));

        if (toRemove.length > 0) {
          await db
            .delete(sessionVillages)
            .where(
              and(
                eq(sessionVillages.tenantId, String(req.tenantId)),
                eq(sessionVillages.sessionId, entityId),
                inArray(sessionVillages.villageId, toRemove),
              ),
            );
        }
        if (toAdd.length > 0) {
          const baseIdx = before.length;
          await db.insert(sessionVillages).values(
            toAdd.map((vid, idx) => ({
              tenantId: req.tenantId,
              sessionId: entityId,
              villageId: vid,
              orderIndex: baseIdx + idx,
            })),
          );
        }

        if (toAdd.length > 0 || toRemove.length > 0) {
          villageLinkChange = { before, after: validIds };
        }
      }

      await logAudit(
        req,
        "update",
        "session_plan",
        entityId,
        villageLinkChange ? { ...oldSession, villageIds: villageLinkChange.before } : oldSession,
        villageLinkChange ? { ...session, villageIds: villageLinkChange.after } : session,
      );
      try {
        await sendMobilizationSmsForSession(req.tenantId, session.id);
      } catch (smsErr) {
        console.error("Failed to send mobilization SMS for session:", smsErr);
      }
      res.json(session);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update session" });
    }
  });

  app.delete("/api/sessions/:id", ...auth, async (req: any, res) => {
    try {
      const user = req.user as any;
      const dbUser = req.dbUser!;
      const authorRoles = new Set(["facility_clerk", "facility_in_charge", "national_admin"]);
      if (!authorRoles.has(dbUser.role)) {
        return res.status(403).json({
          message: "Forbidden: only facility staff may delete session plans. District/provincial/national roles are reviewers only.",
        });
      }

      const entityId = parseInt(req.params.id);
      const oldSession = await storage.getSessionPlan(req.tenantId, entityId);
      if (!oldSession) return res.status(404).json({ message: "Session not found" });

      if (!(await userCanAccessGeo(req.dbUser, req.tenantId, { facilityId: oldSession.facilityId }))) {
        return res.status(403).json({
          message: "Forbidden: You do not have permission to manage session plans for this geographic scope.",
        });
      }

      const parentCheck = await validateParentMicroplan(req.tenantId, oldSession.microplanId);
      if (!parentCheck.ok) {
        return res.status(parentCheck.status).json({ message: parentCheck.message });
      }

      const ok = await storage.deleteSessionPlan(req.tenantId, entityId);
      if (!ok) return res.status(404).json({ message: "Session not found" });
      await logAudit(req, "delete", "session_plan", entityId, oldSession, null);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ message: safeErrorMessage(error, "Failed to delete session") });
    }
  });

  app.get("/api/sessions/map", ...auth, async (req: any, res) => {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const all = await storage.getSessionPlans(req.tenantId);
      let overlaid: any[];
      try {
        overlaid = await overlayCampaignFromParent(req.tenantId, all as any[]);
      } catch (overlayErr) {
        console.error("GET /api/sessions/map overlay failed (using raw):", overlayErr);
        overlaid = all as any[];
      }
      const activeAll = overlaid.filter((s: any) => {
        if (s.status === "cancelled" || s.status === "archived") return false;
        if (s.status !== "completed") return true;
        return s.completedAt && new Date(s.completedAt) >= cutoff;
      });
      const scope = await getGeoScope(req.dbUser, req.tenantId);
      const active = scope.all
        ? activeAll
        : activeAll.filter((s: any) => recordInGeoScope(scope, { facilityId: s.facilityId }));

      const facList = await storage.getFacilities(req.tenantId);
      const facMap = new Map<number, any>(facList.map((f: any) => [f.id, f]));
      const vilList = await storage.getVillages(req.tenantId);
      const vilMap = new Map<number, any>(vilList.map((v: any) => [v.id, v]));

      const activeSessionIds = active.map((s: any) => s.id);
      let svRows: any[] = [];
      if (activeSessionIds.length > 0) {
        svRows = await db
          .select()
          .from(sessionVillages)
          .where(
            and(
              eq(sessionVillages.tenantId, String(req.tenantId)),
              inArray(sessionVillages.sessionId, activeSessionIds),
            ),
          );
      }

      const svByPlan = new Map<number, number[]>();
      for (const r of svRows) {
        const arr = svByPlan.get(r.sessionId) ?? [];
        arr.push(r.villageId);
        svByPlan.set(r.sessionId, arr);
      }

      const out: any[] = [];
      for (const s of active) {
        let loc: { lat: number; lng: number } | null = null;
        try {
          loc = await resolveSessionLocation(req.tenantId, s, vilMap, facMap, svByPlan);
        } catch (locErr) {
          console.error(`GET /api/sessions/map: location resolve failed for session ${s.id}:`, locErr);
          continue;
        }
        if (
          !loc ||
          !Number.isFinite(loc.lat) ||
          !Number.isFinite(loc.lng) ||
          loc.lat < -90 || loc.lat > 90 ||
          loc.lng < -180 || loc.lng > 180
        )
          continue;
        const vc = (s.vaccinatedCounts as any) || null;
        out.push({
          id: s.id,
          name: s.name,
          status: s.status,
          completedAt: s.completedAt,
          scheduledDate: s.scheduledDate,
          facilityId: s.facilityId,
          microplanId: (s as any).microplanId ?? null,
          targetPopulation: s.targetPopulation,
          vaccinatedTotal: vc?.totals ?? null,
          isAchieved: s.isAchieved,
          sessionType: s.sessionType,
          planType: s.planType,
          lat: loc.lat,
          lng: loc.lng,
        });
      }
      res.json(out);
    } catch (err) {
      console.error("GET /api/sessions/map failed:", err);
      res.status(500).json({ message: "Failed to load sessions for map" });
    }
  });

  app.get("/api/sessions/history", ...auth, async (req: any, res) => {
    try {
      const facilityId = req.query.facilityId ? parseInt(req.query.facilityId as string) : undefined;
      const all = await storage.getSessionPlans(req.tenantId, facilityId);
      const overlaid = await overlayCampaignFromParent(req.tenantId, all as any[]);
      const scope = await getGeoScope(req.dbUser, req.tenantId);
      const visible = scope.all
        ? overlaid
        : overlaid.filter((s: any) => recordInGeoScope(scope, { facilityId: s.facilityId }));
      const archived = visible.filter((s: any) => s.status === "completed" || s.status === "cancelled" || s.status === "archived");
      archived.sort((a: any, b: any) => {
        const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bt - at;
      });
      res.json(archived);
    } catch (err) {
      console.error("GET /api/sessions/history failed:", err);
      res.status(500).json({ message: "Failed to load session history" });
    }
  });

  app.post("/api/sessions/validate-proximity", ...auth, async (req: any, res) => {
    try {
      const { facilityId, scheduledDate, targetPopulation, villageIds, lat, lng, excludeSessionId } = req.body || {};
      if (!facilityId || !scheduledDate) {
        return res.status(400).json({ message: "facilityId and scheduledDate are required." });
      }
      const result = await checkProximityAndPopulation(req.tenantId, {
        facilityId: Number(facilityId),
        scheduledDate,
        targetPopulation: Number(targetPopulation ?? 0),
        villageIds: Array.isArray(villageIds) ? villageIds.map((x: any) => Number(x)) : undefined,
        lat: lat != null ? Number(lat) : undefined,
        lng: lng != null ? Number(lng) : undefined,
        excludeSessionId: excludeSessionId != null ? Number(excludeSessionId) : undefined,
      });
      res.json(result);
    } catch (err) {
      console.error("POST /api/sessions/validate-proximity failed:", err);
      res.status(500).json({ message: "Proximity validation failed" });
    }
  });

  app.post("/api/sessions/:id/mark-done", ...auth, async (req: any, res) => {
    try {
      const user = req.user as any;
      const dbUser = req.dbUser!;
      const authorRoles = new Set(["facility_clerk", "facility_in_charge", "national_admin"]);
      if (!authorRoles.has(dbUser.role)) {
        return res.status(403).json({ message: "Forbidden: only facility staff may mark sessions done." });
      }
      const entityId = parseInt(req.params.id);
      const oldSession = await storage.getSessionPlan(req.tenantId, entityId);
      if (!oldSession) return res.status(404).json({ message: "Session not found" });

      const geoContext = await getFacilityHierarchy(oldSession.facilityId, req.tenantId);
      if (!hasPermission(dbUser, "manage_session_plans", geoContext)) {
        return res.status(403).json({ message: "Forbidden: scope mismatch." });
      }

      const body = req.body || {};
      const rawPerAntigen = (body.perAntigen && typeof body.perAntigen === "object") ? body.perAntigen : {};

      const tenantConfigs = await storage.getCatalogueScheduleDoses(req.tenantId);
      const scheduleStages = expandVaccineSchedule(tenantConfigs);
      const { perAntigen, perAntigenUnmapped } = canonicalizePerAntigen(rawPerAntigen, tenantConfigs);

      const totals = Number(
        body.totals != null
          ? body.totals
          : Object.values(perAntigen).reduce((s: number, n: any) => s + Number(n || 0), 0)
            + Object.values(perAntigenUnmapped).reduce((s: number, n: any) => s + Number(n || 0), 0),
      );
      if (!Number.isFinite(totals) || totals < 0) {
        return res.status(400).json({ message: "totals must be a non-negative number." });
      }
      const vc: Record<string, any> = {
        totals,
        perAntigen,
        actualDate: body.actualDate || new Date().toISOString(),
        note: body.note ?? null,
      };
      const unmappedCodes = Object.keys(perAntigenUnmapped);
      if (unmappedCodes.length > 0) {
        vc.perAntigenUnmapped = perAntigenUnmapped;
      }

      let defaultersCaughtUp: number | null = null;
      let defaulterVillageIds: number[] = [];
      try {
        const villageRows = await db
          .select({ villageId: sessionVillages.villageId })
          .from(sessionVillages)
          .where(
            and(
              eq(sessionVillages.tenantId, String(req.tenantId)),
              eq(sessionVillages.sessionId, entityId),
            ),
          );
        defaulterVillageIds = villageRows
          .map((r) => Number(r.villageId))
          .filter((n) => Number.isFinite(n));

        if (defaulterVillageIds.length > 0) {
          const actualDate = new Date(vc.actualDate as string);
          if (!Number.isFinite(actualDate.getTime())) {
            throw new Error("invalid actualDate");
          }
          const dayStart = new Date(actualDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(actualDate);
          dayEnd.setHours(23, 59, 59, 999);

          const childrenInVills = await db
            .select({ id: clients.id })
            .from(clients)
            .where(
              and(
                eq(clients.tenantId, req.tenantId),
                eq(clients.clientType, "child"),
                inArray(clients.villageId, defaulterVillageIds),
              ),
            );

          if (childrenInVills.length > 0) {
            const cids = childrenInVills.map((c) => c.id);
            const allDoses = await db
              .select({
                clientId: clientVaccinations.clientId,
                vaccineName: clientVaccinations.vaccineName,
                administeredDate: clientVaccinations.administeredDate,
              })
              .from(clientVaccinations)
              .where(
                and(
                  eq(clientVaccinations.tenantId, req.tenantId),
                  inArray(clientVaccinations.clientId, cids),
                ),
              );
            const byChild = new Map<
              string,
              { hadPenta3Before: boolean; gotPentaToday: boolean }
            >();
            for (const d of allDoses) {
              if (isCampaignDose(d.vaccineName)) continue;
              const code = normAntigen(d.vaccineName);
              if (code !== "PENTA_1" && code !== "PENTA_2" && code !== "PENTA_3") continue;
              const rec = byChild.get(d.clientId) ?? {
                hadPenta3Before: false,
                gotPentaToday: false,
              };
              const dt = new Date(d.administeredDate as any);
              if (code === "PENTA_3" && dt < dayStart) rec.hadPenta3Before = true;
              if (dt >= dayStart && dt <= dayEnd) rec.gotPentaToday = true;
              byChild.set(d.clientId, rec);
            }
            let count = 0;
            byChild.forEach((rec) => {
              if (rec.gotPentaToday && !rec.hadPenta3Before) count += 1;
            });
            defaultersCaughtUp = count;
            vc.defaultersCaughtUp = count;
            vc.defaulterVillageIds = defaulterVillageIds;
          } else {
            defaultersCaughtUp = 0;
            vc.defaultersCaughtUp = 0;
            vc.defaulterVillageIds = defaulterVillageIds;
          }
        }
      } catch (e) {
        console.warn(
          `[mark-done] defaulters-caught-up computation failed for session ${entityId}:`,
          e,
        );
      }

      const updated = await storage.updateSessionPlan(req.tenantId, entityId, {
        status: "completed",
        isAchieved: true,
        completedAt: new Date() as any,
        vaccinatedCounts: vc as any,
      } as any);
      if (!updated) return res.status(404).json({ message: "Session not found" });
      await logAudit(req, "mark_done", "session_plan", entityId, oldSession, updated);
      if (unmappedCodes.length > 0) {
        await logAudit(req, "mark_done_unmapped_antigens", "session_plan", entityId, null, {
          unmappedCodes,
          perAntigenUnmapped,
          knownCodeCount: scheduleStages.length,
        });
        console.warn(
          `[mark-done] session ${entityId} (tenant ${req.tenantId}) submitted antigen codes outside the configured schedule:`,
          unmappedCodes,
        );
      }

      if (defaultersCaughtUp !== null) {
        try {
          const prefix = `zero-dose:${req.tenantId}:`;
          const keysToDelete: string[] = [];
          indicatorCache.forEach((_v: any, k: any) => {
            if (typeof k === "string" && k.startsWith(prefix)) keysToDelete.push(k);
          });
          for (const k of keysToDelete) indicatorCache.delete(k);
        } catch {}
      }
      invalidateTenantIndicatorCache(req.tenantId);
      res.json({
        ...updated,
        unmappedAntigenCodes: unmappedCodes,
        defaultersCaughtUp,
        defaulterVillageCount: defaulterVillageIds.length,
      });
    } catch (err) {
      console.error("POST /api/sessions/:id/mark-done failed:", err);
      res.status(500).json({ message: "Failed to mark session done" });
    }
  });

  const reconcileRoles = new Set(["national_admin", "district_manager"]);

  app.get("/api/sessions/unmapped-antigens", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      if (!reconcileRoles.has(dbUser.role)) {
        return res.status(403).json({ message: "Forbidden: admin only." });
      }
      const tenantConfigs = await storage.getCatalogueScheduleDoses(req.tenantId);
      const stages = expandVaccineSchedule(tenantConfigs);
      const rows = await db
        .select({ id: sessionPlans.id, vc: sessionPlans.vaccinatedCounts })
        .from(sessionPlans)
        .where(eq(sessionPlans.tenantId, String(req.tenantId)));

      const byCode = new Map<string, { code: string; sessionCount: number; totalDoses: number }>();
      for (const r of rows) {
        const pa = (r.vc as any)?.perAntigenUnmapped;
        if (!pa || typeof pa !== "object") continue;
        for (const [code, n] of Object.entries(pa)) {
          const val = Number(n);
          if (!Number.isFinite(val) || val <= 0) continue;
          const key = String(code).trim();
          if (!key) continue;
          const prev = byCode.get(key) ?? { code: key, sessionCount: 0, totalDoses: 0 };
          prev.sessionCount += 1;
          prev.totalDoses += val;
          byCode.set(key, prev);
        }
      }
      const unmapped = (Array.from(byCode.values()) as Array<{ code: string; sessionCount: number; totalDoses: number }>)
        .sort((a, b) => b.totalDoses - a.totalDoses);
      const canonical = stages.map((s) => ({ code: s.code, label: s.label, antigen: s.antigen, doseNumber: s.doseNumber }));
      res.json({ unmapped, canonical });
    } catch (err) {
      console.error("GET /api/sessions/unmapped-antigens failed:", err);
      res.status(500).json({ message: "Failed to load unmapped antigens" });
    }
  });

  app.post("/api/sessions/reconcile-unmapped-antigens", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      if (!reconcileRoles.has(dbUser.role)) {
        return res.status(403).json({ message: "Forbidden: admin only." });
      }
      const { fromCode, toCode } = req.body || {};
      const from = typeof fromCode === "string" ? fromCode.trim() : "";
      const to = typeof toCode === "string" ? toCode.trim() : "";
      if (!from || !to) {
        return res.status(400).json({ message: "fromCode and toCode are required." });
      }
      const tenantConfigs = await storage.getCatalogueScheduleDoses(req.tenantId);
      const stages = expandVaccineSchedule(tenantConfigs);
      const canonical = stages.find((s) => s.code === to);
      if (!canonical) {
        return res.status(400).json({ message: `toCode '${to}' is not in the tenant vaccine schedule.` });
      }

      const rows = await db
        .select({ id: sessionPlans.id, vc: sessionPlans.vaccinatedCounts })
        .from(sessionPlans)
        .where(eq(sessionPlans.tenantId, String(req.tenantId)));

      const updatedSessionIds: number[] = [];
      let totalDosesMoved = 0;
      for (const r of rows) {
        const vc = r.vc as any;
        const pa = vc?.perAntigenUnmapped;
        if (!pa || typeof pa !== "object") continue;
        if (!Object.prototype.hasOwnProperty.call(pa, from)) continue;
        const moveRaw = Number(pa[from]);
        if (!Number.isFinite(moveRaw) || moveRaw <= 0) {
          const nextUnmapped = { ...pa };
          delete nextUnmapped[from];
          const nextVc = { ...vc };
          if (Object.keys(nextUnmapped).length === 0) {
            delete nextVc.perAntigenUnmapped;
          } else {
            nextVc.perAntigenUnmapped = nextUnmapped;
          }
          await storage.updateSessionPlan(req.tenantId, r.id, { vaccinatedCounts: nextVc } as any);
          continue;
        }
        const nextPerAntigen = { ...(vc.perAntigen && typeof vc.perAntigen === "object" ? vc.perAntigen : {}) };
        nextPerAntigen[to] = Number(nextPerAntigen[to] ?? 0) + moveRaw;
        const nextUnmapped = { ...pa };
        delete nextUnmapped[from];
        const nextVc: Record<string, any> = { ...vc, perAntigen: nextPerAntigen };
        if (Object.keys(nextUnmapped).length === 0) {
          delete nextVc.perAntigenUnmapped;
        } else {
          nextVc.perAntigenUnmapped = nextUnmapped;
        }
        const before = await storage.getSessionPlan(req.tenantId, r.id);
        const updated = await storage.updateSessionPlan(req.tenantId, r.id, { vaccinatedCounts: nextVc } as any);
        if (updated) {
          updatedSessionIds.push(r.id);
          totalDosesMoved += moveRaw;
          await logAudit(req, "reconcile_unmapped_antigens", "session_plan", r.id, before, {
            fromCode: from,
            toCode: to,
            dosesMoved: moveRaw,
          });
        }
      }

      res.json({
        fromCode: from,
        toCode: to,
        canonicalLabel: canonical.label,
        updatedSessionCount: updatedSessionIds.length,
        totalDosesMoved,
        updatedSessionIds,
      });
    } catch (err) {
      console.error("POST /api/sessions/reconcile-unmapped-antigens failed:", err);
      res.status(500).json({ message: "Failed to reconcile unmapped antigens" });
    }
  });

  // ─── Session Day Plans ─────────────────────────────────
  app.get("/api/session-day-plans", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const microplanIdRaw = req.query.microplanId;
      if (microplanIdRaw !== undefined) {
        const microplanId = parseInt(String(microplanIdRaw));
        if (isNaN(microplanId)) {
          return res.status(400).json({ message: "Invalid microplanId" });
        }
        const list = await storage.getSessionDayPlansByMicroplan(req.tenantId, microplanId);
        return res.json(list);
      }
      const list = await db
        .select()
        .from(sessionDayPlans)
        .where(eq(sessionDayPlans.tenantId, req.tenantId));
      res.json(list);
    } catch (err: any) {
      console.error("GET /api/session-day-plans failed:", err);
      res.status(500).json({ message: "Failed to fetch all session day plans" });
    }
  });

  app.get("/api/sessions/:sessionId/days", ...auth, async (req: any, res) => {
    try {
      const sessionPlanId = parseInt(req.params.sessionId);
      if (isNaN(sessionPlanId)) return res.status(400).json({ message: "Invalid session plan ID" });
      const session = await storage.getSessionPlan(req.tenantId, sessionPlanId);
      if (!session) return res.status(404).json({ message: "Session plan not found" });
      const geoContext = await getFacilityHierarchy(session.facilityId, req.tenantId);
      if (!hasPermission(req.dbUser, "view_session_plans", geoContext)) {
        return res.status(404).json({ message: "Session plan not found" });
      }
      const list = await storage.getSessionDayPlans(req.tenantId, sessionPlanId);
      res.json(list);
    } catch (err: any) {
      console.error("GET /api/sessions/:sessionId/days failed:", err);
      res.status(500).json({ message: "Failed to fetch session day plans" });
    }
  });

  app.post("/api/sessions/:sessionId/days", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const sessionPlanId = parseInt(req.params.sessionId);
      if (isNaN(sessionPlanId)) return res.status(400).json({ message: "Invalid session plan ID" });

      const session = await storage.getSessionPlan(req.tenantId, sessionPlanId);
      if (!session) return res.status(404).json({ message: "Session plan not found" });

      const parentCheck = await validateParentMicroplan(req.tenantId, session.microplanId);
      if (!parentCheck.ok) {
        return res.status(parentCheck.status).json({ message: parentCheck.message });
      }

      const schema = insertSessionDayPlanSchema.omit({ sessionPlanId: true });
      const parsed = schema.parse(req.body);

      const dateVal = await validatePlanningLeadTimeAndNoConflict(
        req.tenantId,
        session.facilityId,
        parsed.sessionDate,
      );
      if (!dateVal.isValid) {
        return res.status(400).json({ message: dateVal.message });
      }

      const created = await storage.createSessionDayPlan(req.tenantId, {
        ...parsed,
        sessionPlanId,
      });
      res.status(201).json(created);
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json({ message: "Invalid payload details", errors: err.errors });
      }
      console.error("POST /api/sessions/:sessionId/days failed:", err);
      res.status(500).json({ message: "Failed to create session day plan" });
    }
  });

  app.patch("/api/sessions/days/:id", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid day plan ID" });

      const [dayPlan] = await db
        .select({ sessionPlanId: sessionDayPlans.sessionPlanId })
        .from(sessionDayPlans)
        .where(eq(sessionDayPlans.id, id))
        .limit(1);
      if (!dayPlan) return res.status(404).json({ message: "Session day plan not found" });

      const session = await storage.getSessionPlan(req.tenantId, dayPlan.sessionPlanId);
      if (!session) return res.status(404).json({ message: "Session plan not found" });

      const parentCheck = await validateParentMicroplan(req.tenantId, session.microplanId);
      if (!parentCheck.ok) {
        return res.status(parentCheck.status).json({ message: parentCheck.message });
      }

      const parsed = insertSessionDayPlanSchema.partial().parse(req.body);

      if (parsed.sessionDate) {
        const dateVal = await validatePlanningLeadTimeAndNoConflict(
          req.tenantId,
          session.facilityId,
          parsed.sessionDate,
          undefined,
          id,
        );
        if (!dateVal.isValid) {
          return res.status(400).json({ message: dateVal.message });
        }
      }

      const updated = await storage.updateSessionDayPlan(req.tenantId, id, parsed);
      if (!updated) return res.status(404).json({ message: "Session day plan not found" });
      res.json(updated);
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json({ message: "Invalid payload details", errors: err.errors });
      }
      console.error("PATCH /api/sessions/days/:id failed:", err);
      res.status(500).json({ message: "Failed to update session day plan" });
    }
  });

  app.delete("/api/sessions/days/:id", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid day plan ID" });

      const [dayRow] = await db
        .select({ sessionPlanId: sessionDayPlans.sessionPlanId, dayNumber: sessionDayPlans.dayNumber })
        .from(sessionDayPlans)
        .where(and(eq(sessionDayPlans.id, id), eq(sessionDayPlans.tenantId, req.tenantId)));
      if (!dayRow) return res.status(404).json({ message: "Session day plan not found" });

      const session = await storage.getSessionPlan(req.tenantId, dayRow.sessionPlanId);
      if (!session) return res.status(404).json({ message: "Session plan not found" });

      const parentCheck = await validateParentMicroplan(req.tenantId, session.microplanId);
      if (!parentCheck.ok) {
        return res.status(parentCheck.status).json({ message: parentCheck.message });
      }

      const deleted = await storage.deleteSessionDayPlan(req.tenantId, id);
      if (!deleted) return res.status(404).json({ message: "Session day plan not found" });
      let prunedPersonnelLines = 0;
      if (dayRow) {
        const pruneRes = await db
          .delete(budgetItems)
          .where(
            and(
              eq(budgetItems.tenantId, req.tenantId),
              eq(budgetItems.sessionId, dayRow.sessionPlanId),
              eq(budgetItems.category, "Personnel"),
              like(budgetItems.description, `Personnel · Day ${dayRow.dayNumber} · %`),
            ),
          );
        prunedPersonnelLines = pruneRes.rowCount ?? 0;
      }
      res.json({ success: true, prunedPersonnelLines });
    } catch (err: any) {
      console.error("DELETE /api/sessions/days/:id failed:", err);
      res.status(500).json({ message: "Failed to delete session day plan" });
    }
  });

  // ─── Bulk Sessions & Days ──────────────────────────────
  app.post("/api/sessions/bulk", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      const authorRoles = new Set(["facility_clerk", "facility_in_charge", "national_admin"]);
      if (!authorRoles.has(dbUser.role)) {
        return res.status(403).json({
          message: "Forbidden: only facility staff may author session plans. District/provincial/national roles are reviewers only.",
        });
      }
      const parsed = parseBulkItems(req.body);
      if (!parsed) return res.status(400).json({ message: "Body must be { items: [...] }" });

      const results: BulkResult[] = [];
      const parentCache = new Map<number, Awaited<ReturnType<typeof validateParentMicroplan>>>();
      const geoCache = new Map<number, any>();

      for (const item of parsed.items) {
        const clientId = item.clientId;
        try {
          const body = { ...item };
          delete body.clientId;
          const incomingId = body.id;
          delete body.id;

          if (incomingId == null) {
            let blocked = false;
            for (const f of ["planType", "campaignAntigen", "campaignTargetAge", "campaignScope"] as const) {
              if (body[f] !== undefined) {
                results.push({ clientId, ok: false, error: `${f} is inherited from the parent microplan and must not be set on the session payload.` });
                blocked = true;
                break;
              }
            }
            if (blocked) continue;
          }

          if (body.scheduledDate && typeof body.scheduledDate === "string") {
            const d = new Date(body.scheduledDate);
            if (!isNaN(d.getTime())) body.scheduledDate = d;
          }

          if (incomingId != null) {
            // Update path
            const entityId = Number(incomingId);
            const old = await storage.getSessionPlan(req.tenantId, entityId);
            if (!old) {
              results.push({ clientId, ok: false, error: "Session not found" });
              continue;
            }
            let parentCheck = parentCache.get(old.microplanId);
            if (!parentCheck) {
              parentCheck = await validateParentMicroplan(req.tenantId, old.microplanId);
              parentCache.set(old.microplanId, parentCheck);
            }
            if (!parentCheck.ok) {
              results.push({ clientId, ok: false, error: parentCheck.message });
              continue;
            }
            let geo = geoCache.get(old.facilityId);
            if (!geo) {
              geo = await getFacilityHierarchy(old.facilityId, req.tenantId);
              geoCache.set(old.facilityId, geo);
            }
            if (!hasPermission(dbUser, "manage_session_plans", geo)) {
              results.push({ clientId, ok: false, error: "Forbidden: insufficient geographic scope." });
              continue;
            }
            for (const f of ["microplanId", "planType", "campaignAntigen", "campaignTargetAge", "campaignScope", "facilityId", "year", "quarter", "tenantId"] as const) {
              delete (body as any)[f];
            }
            if (body.scheduledDate) {
              const dv = await validatePlanningLeadTimeAndNoConflict(
                req.tenantId, old.facilityId, body.scheduledDate, entityId,
              );
              if (!dv.isValid) {
                results.push({ clientId, ok: false, error: dv.message });
                continue;
              }
            }
            delete (body as any).override;
            delete (body as any).villageIds;
            const updated = await storage.updateSessionPlan(req.tenantId, entityId, body as any);
            if (!updated) {
              results.push({ clientId, ok: false, error: "Session not found" });
              continue;
            }
            await logAudit(req, "update", "session_plan", entityId, old, updated);
            results.push({ clientId, ok: true, id: updated.id, data: updated });
          } else {
            // Create path
            const data = insertSessionPlanSchema.parse(body);
            const mpId = Number((data as any).microplanId);
            let parentCheck = parentCache.get(mpId);
            if (!parentCheck) {
              parentCheck = await validateParentMicroplan(req.tenantId, mpId);
              parentCache.set(mpId, parentCheck);
            }
            if (!parentCheck.ok) {
              results.push({ clientId, ok: false, error: parentCheck.message });
              continue;
            }
            let geo = geoCache.get(data.facilityId);
            if (!geo) {
              geo = await getFacilityHierarchy(data.facilityId, req.tenantId);
              geoCache.set(data.facilityId, geo);
            }
            if (!hasPermission(dbUser, "manage_session_plans", geo)) {
              results.push({ clientId, ok: false, error: "Forbidden: insufficient geographic scope." });
              continue;
            }
            if (data.scheduledDate) {
              const dv = await validatePlanningLeadTimeAndNoConflict(
                req.tenantId, data.facilityId, data.scheduledDate,
              );
              if (!dv.isValid) {
                results.push({ clientId, ok: false, error: dv.message });
                continue;
              }
            }
            const parentFacilityId = parentCheck.parent.facilityId;
            if (data.facilityId !== parentFacilityId) {
              results.push({ clientId, ok: false, error: `facilityId ${data.facilityId} does not match parent microplan facilityId ${parentFacilityId}.` });
              continue;
            }
            if (data.year !== parentCheck.parent.year || data.quarter !== parentCheck.parent.quarter) {
              results.push({ clientId, ok: false, error: "year/quarter must match parent microplan." });
              continue;
            }
            const inherited: any = {
              ...data,
              facilityId: parentFacilityId,
              year: parentCheck.parent.year,
              quarter: parentCheck.parent.quarter,
              planType: parentCheck.sessionPlanType,
              campaignAntigen: parentCheck.sessionPlanType === "campaign" ? parentCheck.parent.campaignAntigen ?? null : null,
              campaignTargetAge: parentCheck.sessionPlanType === "campaign" ? parentCheck.parent.campaignTargetAge ?? null : null,
              campaignScope: parentCheck.sessionPlanType === "campaign" ? parentCheck.parent.campaignScope ?? null : null,
            };
            const created = await storage.createSessionPlan(req.tenantId, inherited);
            await logAudit(req, "create", "session_plan", created.id, null, created);
            results.push({ clientId, ok: true, id: created.id, data: created });
          }
        } catch (err: any) {
          results.push({
            clientId,
            ok: false,
            error: err?.message || "Failed to save session",
          });
        }
      }
      res.json({ results });
    } catch (err: any) {
      console.error("POST /api/sessions/bulk failed:", err);
      res.status(500).json({ message: safeErrorMessage(err, "Bulk save failed") });
    }
  });

  app.post("/api/sessions/days/bulk", ...auth, async (req: any, res) => {
    try {
      const parsed = parseBulkItems(req.body);
      if (!parsed) return res.status(400).json({ message: "Body must be { items: [...] }" });
      const results: BulkResult[] = [];
      const sessionCache = new Map<number, any>();
      for (const item of parsed.items) {
        const clientId = item.clientId;
        try {
          const body = { ...item };
          delete body.clientId;
          const id = body.id;
          delete body.id;
          if (body.sessionDate && typeof body.sessionDate === "string") {
            const d = new Date(body.sessionDate);
            if (!isNaN(d.getTime())) body.sessionDate = d;
          }
          if (id != null) {
            const parsedBody = insertSessionDayPlanSchema.partial().parse(body);
            const [dayPlan] = await db
              .select({ sessionPlanId: sessionDayPlans.sessionPlanId })
              .from(sessionDayPlans)
              .where(eq(sessionDayPlans.id, Number(id)))
              .limit(1);
            if (!dayPlan) {
              results.push({ clientId, ok: false, error: "Day plan not found" });
              continue;
            }
            let session = sessionCache.get(dayPlan.sessionPlanId);
            if (session === undefined) {
              session = await storage.getSessionPlan(req.tenantId, dayPlan.sessionPlanId);
              sessionCache.set(dayPlan.sessionPlanId, session);
            }
            if (!session) {
              results.push({ clientId, ok: false, error: "Session plan not found" });
              continue;
            }
            const parentCheck = await validateParentMicroplan(req.tenantId, session.microplanId);
            if (!parentCheck.ok) {
              results.push({ clientId, ok: false, error: parentCheck.message });
              continue;
            }
            const updated = await storage.updateSessionDayPlan(req.tenantId, Number(id), parsedBody);
            if (!updated) {
              results.push({ clientId, ok: false, error: "Day plan not found" });
              continue;
            }
            results.push({ clientId, ok: true, id: updated.id, data: updated });
          } else {
            const sessionPlanId = Number(body.sessionPlanId);
            if (!Number.isFinite(sessionPlanId)) {
              results.push({ clientId, ok: false, error: "sessionPlanId is required" });
              continue;
            }
            delete body.sessionPlanId;
            let session = sessionCache.get(sessionPlanId);
            if (session === undefined) {
              session = await storage.getSessionPlan(req.tenantId, sessionPlanId);
              sessionCache.set(sessionPlanId, session);
            }
            if (!session) {
              results.push({ clientId, ok: false, error: "Session plan not found" });
              continue;
            }
            const parentCheck = await validateParentMicroplan(req.tenantId, session.microplanId);
            if (!parentCheck.ok) {
              results.push({ clientId, ok: false, error: parentCheck.message });
              continue;
            }
            const schema = insertSessionDayPlanSchema.omit({ sessionPlanId: true });
            const parsedBody = schema.parse(body);
            const dv = await validatePlanningLeadTimeAndNoConflict(
              req.tenantId, session.facilityId, parsedBody.sessionDate,
            );
            if (!dv.isValid) {
              results.push({ clientId, ok: false, error: dv.message });
              continue;
            }
            const created = await storage.createSessionDayPlan(req.tenantId, {
              ...parsedBody,
              sessionPlanId,
            });
            results.push({ clientId, ok: true, id: created.id, data: created });
          }
        } catch (err: any) {
          results.push({ clientId, ok: false, error: err?.message || "Failed to save day plan" });
        }
      }
      res.json({ results });
    } catch (err: any) {
      console.error("POST /api/sessions/days/bulk failed:", err);
      res.status(500).json({ message: safeErrorMessage(err, "Bulk save failed") });
    }
  });

  // ─── National Calendar Events & Custom Health Days ──────────────────────────
  const customTenantEventsMap = new Map<string, any[]>();

  app.get("/api/national/calendar-events", ...auth, async (req: any, res) => {
    try {
      const { getNationalCalendarEventsForCountry } = await import("../../shared/countryHolidays");
      const tenant = await storage.getTenant(req.tenantId);
      const countryCode = (req.query.countryCode as string) || tenant?.countryCode || tenant?.code || "ZAF";
      const standardEvents = getNationalCalendarEventsForCountry(countryCode);
      const tenantCustom = customTenantEventsMap.get(req.tenantId) || [];

      // Merge standard country events with tenant custom events
      const allEvents = [...standardEvents, ...tenantCustom];
      res.json({
        countryCode,
        events: allEvents,
      });
    } catch (error: any) {
      console.error("Error fetching national calendar events:", error);
      res.status(500).json({ message: "Failed to fetch national calendar events" });
    }
  });

  app.post("/api/national/calendar-events", ...auth, async (req: any, res) => {
    try {
      const { title, eventType, startDate, endDate, description, impactOnSessions, color } = req.body;
      if (!title || !startDate) {
        return res.status(400).json({ message: "Title and start date are required" });
      }

      const tenant = await storage.getTenant(req.tenantId);
      const countryCode = tenant?.countryCode || tenant?.code || "ZAF";

      const newEvent = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tenantId: req.tenantId,
        countryCode,
        title: String(title).trim(),
        eventType: eventType || "health_event",
        startDate: String(startDate).trim(),
        endDate: endDate ? String(endDate).trim() : undefined,
        isNational: true,
        description: description ? String(description).trim() : "",
        impactOnSessions: impactOnSessions || "routine",
        color: color || "#4f46e5",
        customized: true,
      };

      const existing = customTenantEventsMap.get(req.tenantId) || [];
      existing.push(newEvent);
      customTenantEventsMap.set(req.tenantId, existing);

      res.json({
        success: true,
        message: "National calendar event created successfully",
        event: newEvent,
      });
    } catch (error: any) {
      console.error("Error creating national calendar event:", error);
      res.status(500).json({ message: "Failed to save national calendar event" });
    }
  });

  app.delete("/api/national/calendar-events/:id", ...auth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = customTenantEventsMap.get(req.tenantId) || [];
      const filtered = existing.filter((e) => e.id !== id);
      customTenantEventsMap.set(req.tenantId, filtered);

      res.json({
        success: true,
        message: "Calendar event deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting calendar event:", error);
      res.status(500).json({ message: "Failed to delete calendar event" });
    }
  });
}
