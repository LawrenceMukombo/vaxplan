import { Express } from "express";
import { and, asc, desc, eq, sql as dsql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  microplans,
  microplanVersions,
  approvalRequests,
  auditLogs,
  populationData,
  villages,
  stockTransactions,
  monthlyReports,
  facilityStaff,
  communityHealthVolunteers,
  coldChainEquipment,
  planningEvidenceRecords,
  insertMicroplanSchema,
} from "@shared/schema";
import { isAuthenticated } from "../auth";
import { requireTenant } from "../auth/tenantResolver";
import { requireDbUser } from "../auth/loadDbUser";
import { hasPermission } from "../auth/authorization";
import { isApprovedPlan } from "@shared/microplanPolicy";
import { safeErrorMessage } from "../errorUtils";
import {
  getGeoScope,
  recordInGeoScope,
  userCanAccessGeo,
  logAudit,
  requirePermission,
  getFacilityHierarchy,
} from "../routes";
import { overlayCampaignFromParent } from "./sessions";
import { getMicroplanApprovalAudit } from "../services/microplanApprovalService";
import { getMicroplanAggregations } from "../services/microplanAggregationService";
import {
  createMicroplanVersion,
  getSubmissionSnapshot,
  getMicroplanVersion,
  listMicroplanVersions,
  restoreMicroplanVersionAsDraft,
  compareMicroplanSnapshots,
} from "../services/microplanVersionService";
import { DenominatorHarmonisationService } from "../services/denominatorHarmonisationService";
import { buildMicroplanPrintHtml } from "./microplanPrint";
import {
  seedQuarterlySupervisionVisits,
  cancelSeededSupervisionVisitsForMicroplan,
} from "../routes";

const auth = [isAuthenticated, requireTenant, requireDbUser] as const;

export function registerMicroplanRoutes(app: Express) {
  // ─── Master Microplans (Routine & Campaign) ───────────────────────────
  app.get("/api/microplans", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      const tenantId = req.tenantId as string;
      const list = await storage.getMicroplans(tenantId);

      const isNationalAdmin =
        dbUser.role === "national_admin" ||
        (Array.isArray(dbUser.roles) && (dbUser.roles as string[]).includes("national_admin"));

      // PERFORMANCE FIX: replaced per-plan userCanAccessGeo (N async DB calls)
      // with a precomputed GeoScope checked synchronously per plan row.
      if (!isNationalAdmin && (dbUser.facilityId || dbUser.districtId || dbUser.provinceId)) {
        const scope = await getGeoScope(dbUser, tenantId);
        const scoped = list.filter((plan) =>
          recordInGeoScope(scope, { facilityId: (plan as any).facilityId }),
        );
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.json(scoped);
      }

      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.json(list);
    } catch (error) {
      console.error("Error fetching master microplans:", error);
      res.status(500).json({ message: "Failed to fetch master microplans" });
    }
  });

  // Hierarchical aggregate endpoint for District, Provincial, and National managers
  app.get("/api/microplans/aggregate", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      const tenantId = req.tenantId as string;

      // Resolve user's permitted geographic scope
      const scope = await getGeoScope(dbUser, tenantId);

      const planType = (req.query.planType as "routine" | "campaign" | "all") || "all";
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const quarter = req.query.quarter ? parseInt(req.query.quarter as string, 10) : undefined;
      const requestedProvinceId = req.query.provinceId ? parseInt(req.query.provinceId as string, 10) : undefined;
      const requestedDistrictId = req.query.districtId ? parseInt(req.query.districtId as string, 10) : undefined;

      // Validate that requested geography falls within caller's allowed scope
      if (!scope.all) {
        if (requestedProvinceId && scope.provinceIds.size > 0 && !scope.provinceIds.has(requestedProvinceId)) {
          return res.status(403).json({ message: "Requested province is outside your permitted geographic scope" });
        }
        if (requestedDistrictId && scope.districtIds.size > 0 && !scope.districtIds.has(requestedDistrictId)) {
          return res.status(403).json({ message: "Requested district is outside your permitted geographic scope" });
        }
      }

      const result = await getMicroplanAggregations(db, tenantId, {
        planType,
        year: Number.isFinite(year) ? year : undefined,
        quarter: Number.isFinite(quarter) ? quarter : undefined,
        provinceId: Number.isFinite(requestedProvinceId) ? requestedProvinceId : undefined,
        districtId: Number.isFinite(requestedDistrictId) ? requestedDistrictId : undefined,
        allowedProvinceIds: scope.provinceIds,
        allowedDistrictIds: scope.districtIds,
        allowedFacilityIds: scope.facilityIds,
        allScope: scope.all,
      });

      res.set("Cache-Control", "private, max-age=30, stale-while-revalidate=30");
      res.json(result);
    } catch (error) {
      console.error("Error fetching microplan aggregations:", error);
      res.status(500).json({ message: "Failed to fetch microplan aggregations" });
    }
  });

  app.get("/api/microplans/:id(\\d+)", ...auth, async (req: any, res, next) => {
    try {
      const planId = parseInt(req.params.id, 10);
      if (Number.isNaN(planId)) return next();
      const dbUser = req.dbUser!;
      const plan = await storage.getMicroplan(req.tenantId, planId);
      if (!plan) return res.status(404).json({ message: "Master microplan not found" });
      if (!(await userCanAccessGeo(dbUser, req.tenantId, { facilityId: (plan as any).facilityId }))) {
        return res.status(404).json({ message: "Master microplan not found" });
      }
      const approvalDetails = await getMicroplanApprovalAudit(db as any, req.tenantId, plan);
      res.json({ ...plan, approvalDetails, approvedAt: approvalDetails?.approvedAt || (plan as any).approvedAt });
    } catch (error) {
      console.error("Error fetching master microplan:", error);
      res.status(500).json({ message: "Failed to fetch master microplan" });
    }
  });

  // Consolidated hydration for the microplan wizard
  app.get("/api/microplans/:id/hydration", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      const microplanId = parseInt(req.params.id);
      if (isNaN(microplanId)) {
        return res.status(400).json({ message: "Invalid microplan id" });
      }
      const microplan = await storage.getMicroplan(req.tenantId, microplanId);
      if (!microplan) {
        return res.status(404).json({ message: "Master microplan not found" });
      }
      if (!(await userCanAccessGeo(dbUser, req.tenantId, { facilityId: microplan.facilityId ?? null }))) {
        return res.status(404).json({ message: "Master microplan not found" });
      }

      // Record draft_opened version snapshot when a draft microplan is opened
      if (microplan.status === "draft") {
        try {
          const [latest] = await db.select({ eventType: microplanVersions.eventType, createdAt: microplanVersions.createdAt })
            .from(microplanVersions)
            .where(and(eq(microplanVersions.tenantId, req.tenantId), eq(microplanVersions.microplanId, microplanId)))
            .orderBy(desc(microplanVersions.versionNumber)).limit(1);
          const isRecentOpen = latest?.eventType === "draft_opened" && (Date.now() - new Date(latest.createdAt).getTime() < 15000);
          if (!isRecentOpen) {
            await createMicroplanVersion(db as any, {
              tenantId: req.tenantId,
              microplanId,
              userId: req.user?.claims?.sub ?? null,
              eventType: "draft_opened",
              status: "draft",
              reason: "Draft plan opened",
            });
          }
        } catch (vErr) {
          console.error("Failed to record draft_opened version:", vErr);
        }
      }

      const facilityId = microplan.facilityId ?? undefined;
      const quarter = microplan.quarter ?? undefined;
      const year = microplan.year ?? undefined;
      const isNationalAdmin =
        dbUser.role === "national_admin" ||
        (Array.isArray(dbUser.roles) && (dbUser.roles as string[]).includes("national_admin"));

      let canViewSessions = true;
      let geoContext: any = null;
      if (facilityId) {
        geoContext = await getFacilityHierarchy(facilityId, req.tenantId);
        if (!hasPermission(dbUser, "view_session_plans", geoContext)) {
          canViewSessions = false;
        }
      }

      let canViewFacilityScopedData = true;
      if (!isNationalAdmin && facilityId) {
        if (dbUser.facilityId) {
          canViewFacilityScopedData = dbUser.facilityId === facilityId;
        } else if (dbUser.districtId) {
          canViewFacilityScopedData = !!geoContext && dbUser.districtId === geoContext.districtId;
        } else if (dbUser.provinceId) {
          canViewFacilityScopedData = !!geoContext && dbUser.provinceId === geoContext.provinceId;
        }
      }

      const [
        allSessions,
        sessionDayPlans,
        supervisionVisits,
        population,
        vaccineRequirements,
        mobilization,
        budgetItems,
        htrScores,
        excludedVillageIds,
        excludedVillages,
      ] = await Promise.all([
        canViewSessions
          ? storage.getSessionPlans(req.tenantId, facilityId)
          : Promise.resolve([] as Awaited<ReturnType<typeof storage.getSessionPlans>>),
        canViewSessions
          ? storage.getSessionDayPlansByMicroplan(req.tenantId, microplanId)
          : Promise.resolve([] as Awaited<ReturnType<typeof storage.getSessionDayPlansByMicroplan>>),
        storage.getSupervisionVisits(req.tenantId, { microplanId }),
        facilityId && year && canViewFacilityScopedData
          ? storage.getPopulationData(req.tenantId, { facilityId, year })
          : Promise.resolve([]),
        facilityId
          ? storage.getVaccineRequirements(req.tenantId, facilityId)
          : Promise.resolve([]),
        facilityId
          ? storage.getMobilizationActivities(req.tenantId, facilityId)
          : Promise.resolve([]),
        facilityId && quarter && year
          ? storage.getBudgetItems(req.tenantId, facilityId, quarter, year)
          : Promise.resolve([]),
        storage.getHtrScores(req.tenantId),
        facilityId
          ? storage.getFacilityExcludedVillageIds(req.tenantId, facilityId)
          : Promise.resolve([] as number[]),
        facilityId
          ? storage.getFacilityExcludedVillages(req.tenantId, facilityId)
          : Promise.resolve([] as Awaited<ReturnType<typeof storage.getFacilityExcludedVillages>>),
      ]);

      let sessionsForPlan = allSessions.filter((s) => s.microplanId === microplanId);
      if (canViewSessions && !isNationalAdmin && sessionsForPlan.length) {
        const hierarchyCache = new Map<number, any>();
        const filtered: typeof sessionsForPlan = [];
        for (const session of sessionsForPlan) {
          let geo = hierarchyCache.get(session.facilityId);
          if (!geo) {
            geo = await getFacilityHierarchy(session.facilityId, req.tenantId);
            hierarchyCache.set(session.facilityId, geo);
          }
          if (hasPermission(dbUser, "view_session_plans", geo)) {
            filtered.push(session);
          }
        }
        sessionsForPlan = filtered;
      }
      const sessions = await overlayCampaignFromParent(req.tenantId, sessionsForPlan);

      const visibleSessionIds = new Set(sessions.map((s) => s.id));
      const visibleDayPlans = sessionDayPlans.filter((dp) =>
        visibleSessionIds.has(dp.sessionPlanId),
      );

      const approvalAudit = await getMicroplanApprovalAudit(db as any, req.tenantId, microplan);
      let reviewSnapshot = getSubmissionSnapshot(microplan);
      if (microplan.status !== "draft" && !reviewSnapshot) {
        const [submittedVersion] = await db
          .select({ snapshot: microplanVersions.snapshot })
          .from(microplanVersions)
          .where(and(
            eq(microplanVersions.tenantId, req.tenantId),
            eq(microplanVersions.microplanId, microplanId),
            eq(microplanVersions.eventType, "submitted"),
          ))
          .orderBy(desc(microplanVersions.versionNumber))
          .limit(1);
        reviewSnapshot = (submittedVersion?.snapshot as any)?.submissionSnapshot
          ?? submittedVersion?.snapshot
          ?? null;
      }
      const reviewRequests = microplan.status !== "draft"
        ? await db.select().from(approvalRequests).where(and(
            eq(approvalRequests.tenantId, req.tenantId),
            eq(approvalRequests.entityType, "microplan"),
            eq(approvalRequests.entityId, microplanId),
          )).orderBy(asc(approvalRequests.submittedAt))
        : [];
      const reviewEvents = microplan.status !== "draft"
        ? await db.select().from(auditLogs).where(and(
            eq(auditLogs.tenantId, req.tenantId),
            eq(auditLogs.entityType, "microplan_step_review"),
            eq(auditLogs.entityId, microplanId),
            eq(auditLogs.action, "microplan_step_reviewed"),
          )).orderBy(asc(auditLogs.createdAt))
        : [];
      const latestStepReviews = new Map<string, any>();
      for (const event of reviewEvents) {
        const value = (event.newValue ?? {}) as any;
        latestStepReviews.set(`${value.level}:${value.step}`, {
          ...value,
          reviewerId: event.userId,
          reviewedAt: event.createdAt,
        });
      }
      const currentReviewRequest = [...reviewRequests].reverse().find((request) => request.status === "pending") ?? null;
      const reviewerRoles = new Set<string>([
        String(dbUser.role || ""),
        ...(Array.isArray(dbUser.roles) ? dbUser.roles.map(String) : []),
      ]);
      const requiredRoleByLevel: Record<string, string> = {
        district: "district_manager",
        provincial: "provincial_coordinator",
        national: "national_admin",
      };
      const canReviewCurrentLevel = !!currentReviewRequest
        && reviewerRoles.has(requiredRoleByLevel[String(currentReviewRequest.currentLevel).toLowerCase()]);
      res.json({
        microplan: { ...microplan, approvalDetails: approvalAudit, approvedAt: approvalAudit?.approvedAt || (microplan as any).approvedAt },
        approvalDetails: approvalAudit,
        sessions,
        sessionDayPlans: visibleDayPlans,
        supervisionVisits,
        population,
        vaccineRequirements,
        mobilization,
        budgetItems,
        htrScores,
        excludedVillageIds,
        excludedVillages,
        reviewSnapshot,
        reviewWorkflow: {
          requests: reviewRequests,
          stepReviews: Array.from(latestStepReviews.values()),
          currentRequest: currentReviewRequest,
          canReviewCurrentLevel,
          requiredReviewerRole: currentReviewRequest
            ? requiredRoleByLevel[String(currentReviewRequest.currentLevel).toLowerCase()] ?? null
            : null,
        },
      });
    } catch (error) {
      console.error("Error fetching microplan hydration:", error);
      res.status(500).json({ message: "Failed to fetch microplan hydration" });
    }
  });

  app.post("/api/microplans", ...auth, async (req: any, res) => {
    try {
      const data = insertMicroplanSchema.parse(req.body);
      if (data.status && data.status !== "draft") return res.status(400).json({ message: "New microplans must start in draft status." });

      if (data.facilityId && !(await userCanAccessGeo(req.dbUser, req.tenantId, { facilityId: Number(data.facilityId) }))) {
        return res.status(403).json({ message: "Forbidden: no access to this facility." });
      }

      if (data.facilityId && data.year && data.quarter) {
        const existingPlans = await storage.getMicroplans(req.tenantId);
        const duplicate = existingPlans.find(
          (p) =>
            Number(p.facilityId) === Number(data.facilityId) &&
            String(p.planType ?? "").toLowerCase() === String(data.planType ?? "").toLowerCase() &&
            Number(p.year) === Number(data.year) &&
            Number(p.quarter) === Number(data.quarter) &&
            !["rejected", "archived", "superseded"].includes(String(p.status ?? "").toLowerCase())
        );
        if (duplicate) {
          return res.status(409).json({
            message: `A microplan already exists for this facility and period (Q${data.quarter} ${data.year}). Only one active versioned plan is permitted per period.`,
            existingPlanId: duplicate.id,
            existingPlanName: duplicate.name,
          });
        }
      }

      const plan = await storage.createMicroplan(req.tenantId, data);
      await logAudit(req, "create", "microplan", plan.id, null, plan);
      res.status(201).json(plan);
    } catch (error) {
      console.error("Error creating master microplan:", error);
      res.status(400).json({ message: "Invalid master microplan data" });
    }
  });

  app.patch("/api/microplans/:id", ...auth, async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      const oldPlan = await storage.getMicroplan(req.tenantId, planId);
      if (!oldPlan) return res.status(404).json({ message: "Master microplan not found" });

      if (oldPlan.facilityId && !(await userCanAccessGeo(req.dbUser, req.tenantId, { facilityId: Number(oldPlan.facilityId) }))) {
        return res.status(403).json({ message: "Forbidden: no access to this facility's microplan." });
      }
      if (req.body.facilityId && !(await userCanAccessGeo(req.dbUser, req.tenantId, { facilityId: Number(req.body.facilityId) }))) {
        return res.status(403).json({ message: "Forbidden: no access to target facility." });
      }

      const requestedKeys = Object.keys(req.body).filter((k) => k !== "updatedAt");
      const isRenameOnly = requestedKeys.length === 1 && requestedKeys[0] === "name";

      if (isRenameOnly) {
        const trimmedName = typeof req.body.name === "string" ? req.body.name.trim() : "";
        if (!trimmedName) {
          return res.status(400).json({ message: "Microplan name cannot be empty." });
        }
        req.body.name = trimmedName;
      }

      if ((oldPlan.status === "pending" || oldPlan.status === "locked") && !isRenameOnly) {
        return res.status(403).json({
          message: `Forbidden: Microplans in "${oldPlan.status}" status are read-only.`
        });
      }

      if (isApprovedPlan(oldPlan.status) && !isRenameOnly) {
        return res.status(403).json({ message: "Approved microplans are read-only for all users." });
      }
      if (req.body.status && req.body.status !== oldPlan.status) {
        return res.status(403).json({ message: "Use the approval workflow to change plan status." });
      }

      const plan = await storage.updateMicroplan(req.tenantId, planId, req.body);
      if (!plan) return res.status(404).json({ message: "Master microplan not found" });
      await logAudit(req, "update", "microplan", planId, oldPlan, plan);

      if (plan.status === "draft") {
        try {
          const isEdit = req.body?._eventType === "draft_edited";
          const eventType = isEdit ? "draft_edited" : "draft_saved";
          await createMicroplanVersion(db as any, {
            tenantId: req.tenantId,
            microplanId: planId,
            userId: req.user?.claims?.sub ?? null,
            eventType: eventType as any,
            status: "draft",
            reason: req.body?._reason || (isEdit ? "Draft microplan edited" : "Draft microplan saved"),
          });
        } catch (vErr) {
          console.error("Failed to record draft version on update:", vErr);
        }
      }

      if (plan.status === "approved" && oldPlan.status !== "approved") {
        try {
          const seeded = await seedQuarterlySupervisionVisits(req.tenantId, plan, req.user?.claims?.sub ?? null);
          if (seeded.length > 0) {
            await logAudit(req, "auto_seed_supervision_visits", "microplan", planId, null, {
              microplanId: planId,
              year: plan.year,
              quarter: plan.quarter,
              visitIds: seeded.map((v: any) => v.id),
              facilityIds: seeded.map((v: any) => v.facilityId),
            });
          }
        } catch (seedErr) {
          console.error("Failed to auto-seed supervision visits for microplan", planId, seedErr);
        }
      }

      if (oldPlan.status === "approved" && plan.status !== "approved") {
        try {
          const reason = `Parent microplan #${planId} moved from "approved" to "${plan.status}".`;
          const result = await cancelSeededSupervisionVisitsForMicroplan(req.tenantId, planId, reason);
          if (result.deletedIds.length > 0 || result.cancelledIds.length > 0) {
            await logAudit(req, "auto_cancel_supervision_visits", "microplan", planId, null, {
              microplanId: planId,
              reason: "microplan_unapproved",
              newStatus: plan.status,
              deletedVisitIds: result.deletedIds,
              cancelledVisitIds: result.cancelledIds,
            });
          }
        } catch (cancelErr) {
          console.error("Failed to auto-cancel supervision visits for microplan", planId, cancelErr);
        }
      }

      res.json(plan);
    } catch (error) {
      console.error("Error updating master microplan:", error);
      res.status(400).json({ message: "Failed to update master microplan" });
    }
  });

  app.post("/api/microplans/:id/close", ...auth, async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      if (Number.isNaN(planId)) return res.status(400).json({ message: "Invalid plan ID" });
      const plan = await storage.getMicroplan(req.tenantId, planId);
      if (!plan) return res.status(404).json({ message: "Master microplan not found" });
      if (plan.status === "draft") {
        try {
          await createMicroplanVersion(db as any, {
            tenantId: req.tenantId,
            microplanId: planId,
            userId: req.user?.claims?.sub ?? null,
            eventType: "draft_closed",
            status: "draft",
            reason: req.body?.reason || "Draft plan closed",
          });
        } catch (vErr) {
          console.error("Failed to record draft_closed version:", vErr);
        }
      }
      res.json({ success: true, message: "Draft closed version recorded" });
    } catch (err: any) {
      console.error("Error creating draft_closed version:", err);
      res.status(500).json({ message: "Failed to record draft closed version" });
    }
  });

  app.post("/api/microplans/:id/version-event", ...auth, async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      if (Number.isNaN(planId)) return res.status(400).json({ message: "Invalid plan ID" });
      const plan = await storage.getMicroplan(req.tenantId, planId);
      if (!plan) return res.status(404).json({ message: "Master microplan not found" });
      const eventType = req.body?.eventType || "draft_edited";
      const version = await createMicroplanVersion(db as any, {
        tenantId: req.tenantId,
        microplanId: planId,
        userId: req.user?.claims?.sub ?? null,
        eventType,
        status: plan.status ?? "draft",
        reason: req.body?.reason ? String(req.body.reason) : undefined,
      });
      res.json({ success: true, message: `Version event ${eventType} recorded`, version });
    } catch (err: any) {
      console.error("Error recording version event:", err);
      res.status(500).json({ message: "Failed to record version event" });
    }
  });

  app.delete("/api/microplans/:id", ...auth, async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      if (Number.isNaN(planId)) return res.status(400).json({ message: "Invalid plan ID" });

      const oldPlan = await storage.getMicroplan(req.tenantId, planId);
      if (!oldPlan) {
        return res.status(204).send();
      }

      const status = String(oldPlan.status ?? "draft").toLowerCase();
      if (status !== "draft") {
        return res.status(409).json({ message: "Only draft microplans can be deleted." });
      }

      const geoContext = oldPlan.facilityId ? { facilityId: Number(oldPlan.facilityId) } : undefined;
      if (!hasPermission(req.dbUser, "microplans.update_draft", geoContext)) {
        return res.status(403).json({ message: "Forbidden: you cannot delete this draft microplan." });
      }
      if (oldPlan.facilityId && !(await userCanAccessGeo(req.dbUser, req.tenantId, geoContext!))) {
        return res.status(403).json({ message: "Forbidden: no access to this facility's microplan." });
      }

      try {
        await db
          .delete(planningEvidenceRecords)
          .where(
            and(
              eq(planningEvidenceRecords.microplanId, planId),
              eq(planningEvidenceRecords.tenantId, req.tenantId),
            ),
          );
      } catch (peErr) {
        console.warn("Failed to clear planning evidence before microplan delete:", peErr);
      }

      let cancelResult: { deletedIds: number[]; cancelledIds: number[] } | null = null;
      try {
        cancelResult = await cancelSeededSupervisionVisitsForMicroplan(
          req.tenantId,
          planId,
          `Parent microplan #${planId} was deleted.`,
        );
      } catch (cancelErr) {
        console.error("Failed to auto-cancel supervision visits before microplan delete", planId, cancelErr);
      }

      const ok = await storage.deleteMicroplan(req.tenantId, planId);
      if (ok) {
        await logAudit(req, "delete", "microplan", planId, oldPlan, null);
        if (cancelResult && (cancelResult.deletedIds.length > 0 || cancelResult.cancelledIds.length > 0)) {
          await logAudit(req, "auto_cancel_supervision_visits", "microplan", planId, null, {
            microplanId: planId,
            reason: "microplan_deleted",
            deletedVisitIds: cancelResult.deletedIds,
            cancelledVisitIds: cancelResult.cancelledIds,
          });
        }
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting master microplan:", error);
      res.status(500).json({ message: "Failed to delete master microplan" });
    }
  });

  // ─── Denominator Harmonisation ──────────────────────────
  app.get("/api/microplans/:id/denominator-scenario", ...auth, async (req, res) => {
    try {
      const scenario = await DenominatorHarmonisationService.getActiveScenario(parseInt(req.params.id));
      if (!scenario) return res.status(404).json({ message: "No active scenario found" });
      res.json(scenario);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Error fetching scenario" });
    }
  });

  app.post("/api/microplans/:id/denominator-scenario", ...auth, async (req, res) => {
    try {
      const userId = (req as any).dbUser?.id;
      const microplanId = parseInt(req.params.id);
      const { facilityId, selectedSource, parentTotalPopulation } = req.body;
      if (!selectedSource || !facilityId) return res.status(400).json({ message: "Missing required fields" });

      const scenario = await DenominatorHarmonisationService.generateScenario({
        microplanId,
        tenantId: (req as any).tenantId,
        facilityId,
        selectedSource,
        parentTotalPopulation,
        userId,
      });
      res.json(scenario);
    } catch (e) {
      console.error("Generate Scenario Error:", e);
      res.status(500).json({ message: "Error generating scenario" });
    }
  });

  // ─── Approvals / Multi-Step Reviews ─────────────────────────────
  app.post("/api/microplans/:id/review/steps/:step", ...auth, requirePermission("approve_plans"), async (req: any, res) => {
    try {
      const microplanId = Number(req.params.id);
      const step = Number(req.params.step);
      if (!Number.isInteger(step) || step < 1 || step > 11) {
        return res.status(400).json({ message: "Review step must be between 1 and 11." });
      }
      const plan = await storage.getMicroplan(req.tenantId, microplanId);
      if (!plan || plan.status === "draft") return res.status(404).json({ message: "Submitted microplan not found." });
      if (!(await userCanAccessGeo(req.dbUser, req.tenantId, { facilityId: plan.facilityId }))) {
        return res.status(403).json({ message: "This microplan is outside your assigned review area." });
      }
      const [currentRequest] = await db.select().from(approvalRequests).where(and(
        eq(approvalRequests.tenantId, req.tenantId),
        eq(approvalRequests.entityType, "microplan"),
        eq(approvalRequests.entityId, microplanId),
        eq(approvalRequests.status, "pending"),
      )).orderBy(desc(approvalRequests.submittedAt)).limit(1);
      if (!currentRequest) return res.status(409).json({ message: "No active approval stage exists for this plan." });

      const level = String(currentRequest.currentLevel).toLowerCase();
      const requiredRole: Record<string, string> = {
        district: "district_manager",
        provincial: "provincial_coordinator",
        national: "national_admin",
      };
      const reviewerRoles = new Set<string>([
        String(req.dbUser?.role || ""),
        ...(Array.isArray(req.dbUser?.roles) ? req.dbUser.roles.map(String) : []),
      ]);
      if (!requiredRole[level] || !reviewerRoles.has(requiredRole[level])) {
        return res.status(403).json({ message: `Only the assigned ${level} reviewer may review this stage.` });
      }
      const comment = String(req.body?.comment ?? "").trim().slice(0, 4000);
      await logAudit(req, "microplan_step_reviewed", "microplan_step_review", microplanId, null, {
        requestId: currentRequest.id,
        level,
        step,
        reviewed: true,
        comment: comment || null,
      });
      res.json({
        microplanId,
        requestId: currentRequest.id,
        level,
        step,
        reviewed: true,
        comment: comment || null,
        reviewerId: req.user.claims.sub,
        reviewedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error recording microplan step review:", error);
      res.status(500).json({ message: "Failed to record the step review." });
    }
  });

  app.post("/api/microplans/:id/review/steps-all", ...auth, requirePermission("approve_plans"), async (req: any, res) => {
    try {
      const microplanId = Number(req.params.id);
      const plan = await storage.getMicroplan(req.tenantId, microplanId);
      if (!plan || plan.status === "draft") return res.status(404).json({ message: "Submitted microplan not found." });
      if (!(await userCanAccessGeo(req.dbUser, req.tenantId, { facilityId: plan.facilityId }))) {
        return res.status(403).json({ message: "This microplan is outside your assigned review area." });
      }
      const [currentRequest] = await db.select().from(approvalRequests).where(and(
        eq(approvalRequests.tenantId, req.tenantId),
        eq(approvalRequests.entityType, "microplan"),
        eq(approvalRequests.entityId, microplanId),
        eq(approvalRequests.status, "pending"),
      )).orderBy(desc(approvalRequests.submittedAt)).limit(1);
      if (!currentRequest) return res.status(409).json({ message: "No active approval stage exists for this plan." });

      const level = String(currentRequest.currentLevel).toLowerCase();
      const requiredRole: Record<string, string> = {
        district: "district_manager",
        provincial: "provincial_coordinator",
        national: "national_admin",
      };
      const reviewerRoles = new Set<string>([
        String(req.dbUser?.role || ""),
        ...(Array.isArray(req.dbUser?.roles) ? req.dbUser.roles.map(String) : []),
      ]);
      if (!requiredRole[level] || !reviewerRoles.has(requiredRole[level])) {
        return res.status(403).json({ message: `Only the assigned ${level} reviewer may review this stage.` });
      }
      const comment = String(req.body?.comment ?? "All 11 microplan steps reviewed and verified.").trim().slice(0, 4000);
      for (let step = 1; step <= 11; step++) {
        await logAudit(req, "microplan_step_reviewed", "microplan_step_review", microplanId, null, {
          requestId: currentRequest.id,
          level,
          step,
          reviewed: true,
          comment: comment || null,
        });
      }
      res.json({
        success: true,
        microplanId,
        requestId: currentRequest.id,
        level,
        reviewedStepsCount: 11,
        reviewedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error recording all microplan step reviews:", error);
      res.status(500).json({ message: "Failed to record step reviews." });
    }
  });

  app.get("/api/microplans/:id/versions", ...auth, requirePermission("microplan.view_history"), async (req: any, res) => {
    try {
      const microplanId = Number(req.params.id);
      const plan = await storage.getMicroplan(req.tenantId, microplanId);
      if (!plan) return res.status(404).json({ message: "Microplan not found" });
      res.json(await listMicroplanVersions(db as any, req.tenantId, microplanId));
    } catch (error) {
      console.error("Error listing microplan versions:", error);
      res.status(500).json({ message: "Failed to list microplan versions" });
    }
  });

  app.get("/api/microplans/:id/versions/:versionId", ...auth, requirePermission("microplan.view_history"), async (req: any, res) => {
    try {
      const version = await getMicroplanVersion(db as any, req.tenantId, Number(req.params.id), Number(req.params.versionId));
      if (!version) return res.status(404).json({ message: "Microplan version not found" });
      res.json(version);
    } catch (error) {
      console.error("Error fetching microplan version:", error);
      res.status(500).json({ message: "Failed to fetch microplan version" });
    }
  });

  app.get("/api/microplans/:id/compare-versions/:leftId/:rightId", ...auth, requirePermission("microplan.compare_versions"), async (req: any, res) => {
    try {
      const microplanId = Number(req.params.id);
      const left = await getMicroplanVersion(db as any, req.tenantId, microplanId, Number(req.params.leftId));
      const right = await getMicroplanVersion(db as any, req.tenantId, microplanId, Number(req.params.rightId));
      if (!left || !right) return res.status(404).json({ message: "One or both microplan versions were not found" });
      res.json({ left: left.versionLabel, right: right.versionLabel, changes: compareMicroplanSnapshots(left.snapshot, right.snapshot) });
    } catch (error) {
      console.error("Error comparing microplan versions:", error);
      res.status(500).json({ message: "Failed to compare microplan versions" });
    }
  });

  app.post("/api/microplans/:id/versions/:versionId/restore", ...auth, requirePermission("microplan.restore_version"), async (req: any, res) => {
    try {
      const reason = String(req.body?.reason || "").trim();
      if (!reason) return res.status(400).json({ message: "A restoration reason is required" });
      const currentPlan = await storage.getMicroplan(req.tenantId, Number(req.params.id));
      if (currentPlan && isApprovedPlan(currentPlan.status)) return res.status(403).json({ message: "Approved microplans cannot be restored over. Create a new draft plan." });
      const version = await restoreMicroplanVersionAsDraft(db as any, {
        tenantId: req.tenantId,
        microplanId: Number(req.params.id),
        versionId: Number(req.params.versionId),
        userId: req.user.claims.sub,
        reason,
      });
      await logAudit(req, "restore_version", "microplan", Number(req.params.id), null, {
        sourceVersionId: Number(req.params.versionId),
        restoredVersionId: version.id,
        reason,
      });
      res.status(201).json(version);
    } catch (error: any) {
      console.error("Error restoring microplan version:", error);
      res.status(error?.message?.includes("not found") ? 404 : 400).json({ message: error?.message || "Failed to restore microplan version" });
    }
  });

  // Fetch prefill bundle for microplan wizard
  app.get("/api/microplans/prefill", ...auth, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.query.facilityId as string);
      const year = parseInt(req.query.year as string);
      const quarter = parseInt(req.query.quarter as string);
      const source = (req.query.populationSource as string) || "worldpop";

      if (!facilityId || !year || !quarter) {
        return res.status(400).json({ message: "Missing required query parameters: facilityId, year, quarter" });
      }

      const { MicroplanPrefillService } = await import("../services/microplanPrefillService.js");
      const bundle = await MicroplanPrefillService.buildBundle(
        req.tenantId,
        facilityId,
        year,
        quarter,
        source as any
      );

      res.json(bundle);
    } catch (e) {
      console.error("[Prefill API Error]", e);
      res.status(500).json({ message: "Failed to generate prefill bundle" });
    }
  });

  // ─── Microplanning Readiness Check ───────────────────────────────────────
  app.get("/api/microplans/readiness/:facilityId", ...auth, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId);
      const year = parseInt(req.query.year as string) || new Date().getFullYear();

      if (!facilityId || isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid facilityId parameter" });
      }

      const tenantId = req.tenantId;
      const { summarizeReadiness } = await import("../services/microplanPrefillService.js");

      // 1. Populations check
      const popRecords = await db
        .select({ count: dsql<number>`count(*)` })
        .from(populationData)
        .where(
          and(
            eq(populationData.facilityId, facilityId),
            eq(populationData.tenantId, tenantId),
            eq(populationData.year, year)
          )
        );
      const popCount = Number(popRecords[0]?.count || 0);

      let anyYearPopCount = popCount;
      if (popCount === 0) {
        const anyYearRecords = await db
          .select({ count: dsql<number>`count(*)` })
          .from(populationData)
          .where(
            and(
              eq(populationData.facilityId, facilityId),
              eq(populationData.tenantId, tenantId)
            )
          );
        anyYearPopCount = Number(anyYearRecords[0]?.count || 0);
      }

      // 2. Communities / Villages check
      const villageRecords = await db
        .select({ count: dsql<number>`count(*)` })
        .from(villages)
        .where(
          and(
            eq(villages.assignedFacilityId, facilityId),
            eq(villages.tenantId, tenantId)
          )
        );
      const villageCount = Number(villageRecords[0]?.count || 0);

      // 3. Stock Ledger / Transactions check
      const stockRecords = await db
        .select({ count: dsql<number>`count(*)` })
        .from(stockTransactions)
        .where(
          and(
            eq(stockTransactions.facilityId, facilityId),
            eq(stockTransactions.tenantId, tenantId)
          )
        );
      const stockCount = Number(stockRecords[0]?.count || 0);

      // 4. Coverage Data / Monthly Reports check
      const coverageRecords = await db
        .select({ count: dsql<number>`count(*)` })
        .from(monthlyReports)
        .where(
          and(
            eq(monthlyReports.facilityId, facilityId),
            eq(monthlyReports.tenantId, tenantId)
          )
        );
      const coverageCount = Number(coverageRecords[0]?.count || 0);

      // 5. Staff check
      const staffRecords = await db
        .select({ count: dsql<number>`count(*)` })
        .from(facilityStaff)
        .where(
          and(
            eq(facilityStaff.facilityId, facilityId),
            eq(facilityStaff.tenantId, tenantId)
          )
        );
      const staffCount = Number(staffRecords[0]?.count || 0);

      // 6. Community Health Volunteers (CHVs) check
      const chvRecords = await db
        .select({ count: dsql<number>`count(*)` })
        .from(communityHealthVolunteers)
        .where(
          and(
            eq(communityHealthVolunteers.facilityId, facilityId),
            eq(communityHealthVolunteers.tenantId, tenantId)
          )
        );
      const chvCount = Number(chvRecords[0]?.count || 0);

      // 7. Cold Chain Equipment check
      const coldChainRecords = await db
        .select({ count: dsql<number>`count(*)` })
        .from(coldChainEquipment)
        .where(
          and(
            eq(coldChainEquipment.facilityId, facilityId),
            eq(coldChainEquipment.tenantId, tenantId)
          )
        );
      const coldChainCount = Number(coldChainRecords[0]?.count || 0);

      const items = [
        {
          key: "populations",
          label: "Target Population Denominator",
          status: popCount > 0 ? "ready" : "warning",
          message: popCount > 0
            ? `Baseline population figures for ${year} are registered and ready.`
            : anyYearPopCount > 0
            ? `Population figures exist for earlier years, but not yet finalized for ${year}.`
            : "No baseline population figures found for this facility. Target cohorts may require manual entry in Step 1.",
          actionLabel: "Add Population Data",
          actionHref: "/population",
        },
        {
          key: "communities",
          label: "Catchment Communities & Settlements",
          status: villageCount > 0 ? "ready" : "warning",
          message: villageCount > 0
            ? `${villageCount} catchment village(s)/community(ies) mapped to this facility.`
            : "No catchment communities or villages mapped. Session locations and target populations cannot be auto-filled in Step 2.",
          actionLabel: "Map Communities",
          actionHref: `/facilities?facilityId=${facilityId}`,
        },
        {
          key: "stockledger",
          label: "Stock Ledger & Vaccine Inventory",
          status: stockCount > 0 ? "ready" : "warning",
          message: stockCount > 0
            ? `${stockCount} stock transaction record(s) logged in the facility ledger.`
            : "No vaccine stock ledger transactions recorded for this facility. Vaccine requirements in Step 6 will use default estimates.",
          actionLabel: "Update Stock Ledger",
          actionHref: "/stock",
        },
        {
          key: "coverage",
          label: "Baseline Coverage & Historical Reports",
          status: coverageCount > 0 ? "ready" : "warning",
          message: coverageCount > 0
            ? `${coverageCount} historical monthly immunization report(s) found for drop-out analysis.`
            : "No monthly immunization reports found. Baseline drop-out rates will fall back to regional defaults in Step 1.",
          actionLabel: "View Reports",
          actionHref: "/reports",
        },
        {
          key: "staff",
          label: "Facility Staff Roster",
          status: staffCount > 0 ? "ready" : "warning",
          message: staffCount > 0
            ? `${staffCount} active health worker(s) registered for session allocation.`
            : "No facility health workers registered. Staff allocations in Step 5 will require manual entry.",
          actionLabel: "Manage Staff",
          actionHref: `/facilities?facilityId=${facilityId}`,
        },
        {
          key: "chvs",
          label: "Community Health Volunteers (CHVs)",
          status: chvCount > 0 ? "ready" : "warning",
          message: chvCount > 0
            ? `${chvCount} Community Health Volunteer(s) catalogued.`
            : "No CHVs or community mobilizers registered. Mobilization and outreach in Step 7 will need manual assignment.",
          actionLabel: "Register CHVs",
          actionHref: `/facilities?facilityId=${facilityId}`,
        },
        {
          key: "coldchain",
          label: "Cold Chain Storage Equipment",
          status: coldChainCount > 0 ? "ready" : "warning",
          message: coldChainCount > 0
            ? `${coldChainCount} cold chain storage unit(s) catalogued.`
            : "No cold chain refrigerators or freezers logged. Storage capacity calculations in Step 6 will use facility defaults.",
          actionLabel: "Add Cold Chain",
          actionHref: `/facilities?facilityId=${facilityId}`,
        },
      ];

      const summary = summarizeReadiness(items as any);
      res.json({ summary, items });
    } catch (e: any) {
      console.error("[Readiness API Error]", e);
      res.status(500).json({ message: safeErrorMessage(e, "Failed to load microplanning readiness") });
    }
  });

  // ─── Microplan Map Print ────────────────────────────────────────
  app.get("/api/microplans/:id/print-map", ...auth, async (req: any, res) => {
    try {
      const microplanId = parseInt(req.params.id);
      const mp = await storage.getMicroplan(req.tenantId, microplanId);
      if (!mp) return res.status(404).json({ message: "Microplan not found" });

      const format  = (req.query.format  as string) || "A4";
      const lat     = parseFloat((req.query.lat  as string) || "-6.314");
      const lng     = parseFloat((req.query.lng  as string) || "143.956");
      const zoom    = parseInt((req.query.zoom   as string) || "12", 10);
      const title   = (req.query.title  as string) || mp.name || "Microplan Map";
      const html = buildMicroplanPrintHtml({
        title,
        format,
        latitude: lat,
        longitude: lng,
        zoom,
      });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Print map failed") });
    }
  });

  // ─── Microplan Population Intelligence ──────────────────────────
  app.get("/api/microplans/:microplanId/population-intelligence", ...auth, async (req: any, res) => {
    try {
      const microplanId = parseInt(req.params.microplanId);
      const radiusKm = parseFloat(req.query.radiusKm as string) || 5;

      if (isNaN(microplanId)) {
        return res.status(400).json({ message: "Valid microplanId required." });
      }

      const { PopulationIntelligenceService } = await import("../services/populationIntelligenceService");
      const [microplan] = await db.select().from(microplans).where(and(eq(microplans.id, microplanId), eq(microplans.tenantId, req.tenantId))).limit(1);

      if (!microplan || !microplan.facilityId) {
        return res.status(404).json({ message: "Microplan or associated facility not found." });
      }

      const result = await PopulationIntelligenceService.fetchFacilityPopulation(req.tenantId, microplan.facilityId, radiusKm);
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error("[Pop Intel API]", err);
      res.status(500).json({ message: safeErrorMessage(err, "Failed to load microplan population intelligence") });
    }
  });
}
