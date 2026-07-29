import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { isAuthenticated, getCurrentUserId } from "../auth";
import { tenantContext, requireTenant } from "../auth/tenantResolver";
import { loadDbUser } from "../auth/loadDbUser";
import { hasPermission, ensureTenantRolesCache, type Permission } from "../auth/authorization";
import { temporalService, parseTemporalDate } from "../services/temporalService";

const createVersionSchema = z.object({
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().optional().nullable(),
  status: z.string().optional(),
  changeType: z.string().optional(),
  changeReason: z.string().optional().nullable(),
  changeSummary: z.string().optional().nullable(),
  sourceRecordId: z.string().optional().nullable(),
  sourceType: z.string().optional().nullable(),
  sourceReference: z.string().optional().nullable(),
  sourceDocumentUrl: z.string().optional().nullable(),
  sourceSystem: z.string().optional().nullable(),
  snapshot: z.record(z.unknown()).default({}),
  affectedRecords: z.array(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const correctionSchema = createVersionSchema.partial().extend({
  snapshot: z.record(z.unknown()).optional(),
});

function actorFrom(req: any) {
  return {
    userId: getCurrentUserId(req) ?? req.dbUser?.id ?? null,
    ipAddress: typeof req.ip === "string" ? req.ip : null,
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
  };
}

function requireTemporalPermission(permission: Permission) {
  return async (req: any, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (req.tenantId) await ensureTenantRolesCache(req.tenantId);
    const user = req.dbUser;
    if (!user) return res.status(500).json({ message: "Could not resolve active user account." });
    if (!hasPermission(user, permission, { activeTenantId: req.tenantId })) {
      return res.status(403).json({ message: "Forbidden: temporal permission required", requiredPermission: permission });
    }
    next();
  };
}

const baseAuth = [isAuthenticated, tenantContext, requireTenant, loadDbUser];

export function registerTemporalRoutes(app: Express) {
  app.get(
    "/api/temporal/inventory",
    ...baseAuth,
    requireTemporalPermission("temporal.view"),
    async (_req: any, res) => {
      res.json({
        bitemporalModel: {
          validTime: "valid_from / valid_to",
          systemTime: "recorded_at / recorded_until",
          currentFlag: "is_current with tenant/entity/stable id uniqueness",
        },
        highPriorityEntities: [
          "users",
          "temporal_role_assignments",
          "temporal_employment_assignments",
          "regions",
          "provinces",
          "districts",
          "llgs",
          "facilities",
          "villages",
          "admin_boundaries",
          "facility_catchments",
          "population_data",
          "temporal_population_denominators",
          "microplans",
          "session_plans",
          "vaccine_configurations",
          "stock_transactions",
          "supervision_checklist_templates",
          "annual_immunization_plans",
          "tenant_settings",
          "integration_mappings",
        ],
      });
    }
  );

  app.get(
    "/api/temporal/:entityType/:entityId/current",
    ...baseAuth,
    requireTemporalPermission("temporal.view"),
    async (req: any, res) => {
      const row = await temporalService.getCurrentVersion(req.tenantId, req.params.entityType, req.params.entityId);
      if (!row) return res.status(404).json({ message: "No current temporal version found." });
      res.json(row);
    }
  );

  app.get(
    "/api/temporal/:entityType/:entityId/history",
    ...baseAuth,
    requireTemporalPermission("temporal.view_history"),
    async (req: any, res) => {
      res.json(await temporalService.getHistory(req.tenantId, req.params.entityType, req.params.entityId));
    }
  );

  app.get(
    "/api/temporal/:entityType/:entityId/as-of",
    ...baseAuth,
    requireTemporalPermission("temporal.view_history"),
    async (req: any, res) => {
      const validDate = parseTemporalDate(req.query.validDate ?? req.query.date);
      const recordedDate = req.query.recordedDate ? parseTemporalDate(req.query.recordedDate) : null;
      const row = recordedDate
        ? await temporalService.getSystemVersionAsOf(req.tenantId, req.params.entityType, req.params.entityId, recordedDate)
        : await temporalService.getVersionAsOf(req.tenantId, req.params.entityType, req.params.entityId, validDate);
      if (!row) return res.status(404).json({ message: "No temporal version valid for the selected date." });
      res.json({ mode: recordedDate ? "system_time" : "valid_time", selectedDate: (recordedDate ?? validDate).toISOString(), version: row });
    }
  );

  app.get(
    "/api/temporal/:entityType/:entityId/future",
    ...baseAuth,
    requireTemporalPermission("temporal.view"),
    async (req: any, res) => {
      const asOf = req.query.asOf ? parseTemporalDate(req.query.asOf) : new Date();
      res.json(await temporalService.getFutureChanges(req.tenantId, req.params.entityType, req.params.entityId, asOf));
    }
  );

  app.get(
    "/api/temporal/:entityType/:entityId/compare",
    ...baseAuth,
    requireTemporalPermission("temporal.view_history"),
    async (req: any, res) => {
      const history = await temporalService.getHistory(req.tenantId, req.params.entityType, req.params.entityId);
      const from = history.find((row) => row.id === req.query.fromVersionId || String(row.versionNumber) === String(req.query.fromVersion));
      const to = history.find((row) => row.id === req.query.toVersionId || String(row.versionNumber) === String(req.query.toVersion)) ?? history[0];
      res.json(temporalService.compareVersions(from, to));
    }
  );

  app.post(
    "/api/temporal/:entityType/:entityId/versions",
    ...baseAuth,
    requireTemporalPermission("temporal.propose_change"),
    async (req: any, res) => {
      const body = createVersionSchema.parse(req.body);
      const version = await temporalService.createDraftVersion({
        tenantId: req.tenantId,
        entityType: req.params.entityType,
        stableEntityId: req.params.entityId,
        sourceRecordId: body.sourceRecordId ?? null,
        validFrom: parseTemporalDate(body.validFrom),
        validTo: body.validTo ? parseTemporalDate(body.validTo) : null,
        status: body.status ?? "draft",
        changeType: body.changeType ?? "amendment",
        changeReason: body.changeReason ?? null,
        changeSummary: body.changeSummary ?? null,
        sourceType: body.sourceType ?? null,
        sourceReference: body.sourceReference ?? null,
        sourceDocumentUrl: body.sourceDocumentUrl ?? null,
        sourceSystem: body.sourceSystem ?? null,
        snapshot: body.snapshot,
        affectedRecords: body.affectedRecords,
        metadata: body.metadata,
      }, actorFrom(req));
      res.status(201).json(version);
    }
  );

  app.post(
    "/api/temporal/versions/:versionId/submit",
    ...baseAuth,
    requireTemporalPermission("temporal.propose_change"),
    async (req: any, res) => {
      const row = await temporalService.submitVersion(req.params.versionId, req.tenantId, actorFrom(req), req.body?.reason);
      if (!row) return res.status(404).json({ message: "Temporal version not found." });
      res.json(row);
    }
  );

  app.post(
    "/api/temporal/versions/:versionId/approve",
    ...baseAuth,
    requireTemporalPermission("temporal.approve_change"),
    async (req: any, res) => {
      const row = await temporalService.approveVersion(req.params.versionId, req.tenantId, actorFrom(req), req.body?.comments);
      if (!row) return res.status(404).json({ message: "Temporal version not found." });
      res.json(row);
    }
  );

  app.post(
    "/api/temporal/versions/:versionId/reject",
    ...baseAuth,
    requireTemporalPermission("temporal.review_change"),
    async (req: any, res) => {
      const row = await temporalService.rejectVersion(req.params.versionId, req.tenantId, actorFrom(req), req.body?.comments);
      if (!row) return res.status(404).json({ message: "Temporal version not found." });
      res.json(row);
    }
  );

  app.post(
    "/api/temporal/versions/:versionId/correct",
    ...baseAuth,
    requireTemporalPermission("temporal.correct_history"),
    async (req: any, res) => {
      const body = correctionSchema.parse(req.body);
      const row = await temporalService.correctVersion(req.params.versionId, req.tenantId, {
        ...body,
        validFrom: body.validFrom ? parseTemporalDate(body.validFrom) : undefined,
        validTo: body.validTo ? parseTemporalDate(body.validTo) : undefined,
      }, actorFrom(req));
      if (!row) return res.status(404).json({ message: "Temporal version not found." });
      res.json(row);
    }
  );

  app.post(
    "/api/temporal/versions/:versionId/cancel",
    ...baseAuth,
    requireTemporalPermission("temporal.cancel_future_change"),
    async (req: any, res) => {
      const row = await temporalService.cancelFutureVersion(req.params.versionId, req.tenantId, actorFrom(req), req.body?.reason);
      if (!row) return res.status(404).json({ message: "Temporal version not found." });
      res.json(row);
    }
  );

  app.get(
    "/api/temporal/users/:userId/effective-roles",
    ...baseAuth,
    requireTemporalPermission("temporal.view_history"),
    async (req: any, res) => {
      const asOf = req.query.asOf ? parseTemporalDate(req.query.asOf) : new Date();
      res.json(await temporalService.getRoleAssignmentsAsOf(req.tenantId, req.params.userId, asOf));
    }
  );

  app.get(
    "/api/temporal/population/as-of",
    ...baseAuth,
    requireTemporalPermission("temporal.view_history"),
    async (req: any, res) => {
      const geographyType = String(req.query.geographyType || "");
      const geographyStableId = String(req.query.geographyStableId || "");
      if (!geographyType || !geographyStableId) {
        return res.status(400).json({ message: "geographyType and geographyStableId are required." });
      }
      const asOf = req.query.asOf ? parseTemporalDate(req.query.asOf) : new Date();
      const referenceYear = req.query.referenceYear ? Number(req.query.referenceYear) : undefined;
      res.json(await temporalService.getPopulationAsOf(req.tenantId, geographyType, geographyStableId, asOf, referenceYear));
    }
  );

  app.post(
    "/api/temporal/role-assignments",
    ...baseAuth,
    requireTemporalPermission("temporal.propose_change"),
    async (req: any, res) => {
      try {
        const schema = z.object({
          userId: z.string(),
          roleCode: z.string(),
          scopeType: z.string().optional(),
          scopeId: z.string().optional(),
          effectiveStart: z.string(),
          effectiveEnd: z.string().optional().nullable(),
          assignmentType: z.string().optional(),
          delegatedAuthority: z.boolean().optional(),
          approvalLimit: z.number().optional(),
          appointmentSource: z.string().optional(),
          reason: z.string().optional(),
          status: z.string().optional(),
        });
        const body = schema.parse(req.body);
        const row = await temporalService.createRoleAssignment(req.tenantId, {
          ...body,
          effectiveStart: parseTemporalDate(body.effectiveStart),
          effectiveEnd: body.effectiveEnd ? parseTemporalDate(body.effectiveEnd) : null,
        }, actorFrom(req));
        res.status(201).json(row);
      } catch (err: any) {
        res.status(400).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/temporal/role-assignments/:id/approve",
    ...baseAuth,
    requireTemporalPermission("temporal.approve_change"),
    async (req: any, res) => {
      try {
        const row = await temporalService.approveRoleAssignment(req.tenantId, req.params.id, actorFrom(req), req.body?.comments);
        if (!row) return res.status(404).json({ message: "Role assignment not found." });
        res.json(row);
      } catch (err: any) {
        res.status(400).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/temporal/employment-assignments",
    ...baseAuth,
    requireTemporalPermission("temporal.propose_change"),
    async (req: any, res) => {
      try {
        const schema = z.object({
          personUserId: z.string().optional().nullable(),
          stablePersonId: z.string(),
          employer: z.string().optional(),
          department: z.string().optional(),
          programme: z.string().optional(),
          employmentNumber: z.string().optional(),
          jobTitle: z.string().optional(),
          cadre: z.string().optional(),
          employmentType: z.string().optional(),
          contractType: z.string().optional(),
          employmentStatus: z.string().optional(),
          dutyStation: z.string().optional(),
          facilityId: z.number().optional().nullable(),
          districtId: z.number().optional().nullable(),
          provinceId: z.number().optional().nullable(),
          supervisorUserId: z.string().optional().nullable(),
          startDate: z.string(),
          endDate: z.string().optional().nullable(),
          appointmentReference: z.string().optional(),
          actingOrSubstantive: z.string().optional(),
          secondment: z.boolean().optional(),
          reasonForChange: z.string().optional(),
        });
        const body = schema.parse(req.body);
        const row = await temporalService.createEmploymentAssignment(req.tenantId, {
          ...body,
          startDate: parseTemporalDate(body.startDate),
          endDate: body.endDate ? parseTemporalDate(body.endDate) : null,
        }, actorFrom(req));
        res.status(201).json(row);
      } catch (err: any) {
        res.status(400).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/temporal/employment-assignments/:id/terminate",
    ...baseAuth,
    requireTemporalPermission("temporal.propose_change"),
    async (req: any, res) => {
      try {
        const row = await temporalService.terminateEmploymentAssignment(
          req.tenantId,
          req.params.id,
          actorFrom(req),
          req.body?.reason,
          req.body?.endDate ? parseTemporalDate(req.body.endDate) : new Date()
        );
        if (!row) return res.status(404).json({ message: "Employment assignment not found." });
        res.json(row);
      } catch (err: any) {
        res.status(400).json({ message: err.message });
      }
    }
  );
}
