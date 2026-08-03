import type { Express } from "express";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import {
  facilities,
  gisPolygons,
  microplans,
  monthlyReports,
  sessionPlans,
  sessionVillages,
  villages,
} from "@shared/schema";
import { hasPermission } from "../auth/authorization";
import { getCurrentUserId } from "../auth";
import { db } from "../db";
import { storage } from "../storage";
import { PopulationIntelligenceService } from "../services/populationIntelligenceService";
import {
  comparePolygonVersions,
  validatePolygonLifecycleGeometry,
  type PolygonEntityType,
} from "../services/polygonLifecycleService";

type LifecycleDependencies = {
  auth: readonly any[];
  canAccessGeo: (
    user: any,
    tenantId: string,
    geo: { facilityId?: number | null; districtId?: number | null; provinceId?: number | null },
  ) => Promise<boolean>;
  logAudit: (
    req: any,
    action: string,
    entityType: string,
    entityId: number | string | null,
    oldValue?: any,
    newValue?: any,
  ) => Promise<void>;
};

const supportedEntityTypes = new Set<PolygonEntityType>([
  "facility",
  "village",
  "settlement",
  "outreach",
  "administrative",
  "custom",
]);

function actorId(req: any): string {
  return String(req.dbUser?.id || req.user?.claims?.sub || req.user?.username || "system");
}

function parseEntity(req: any): { entityType: PolygonEntityType; entityId: number } | null {
  const entityType = String(req.params.entityType || "") as PolygonEntityType;
  const entityId = Number(req.params.entityId);
  return supportedEntityTypes.has(entityType) && Number.isInteger(entityId) && entityId > 0
    ? { entityType, entityId }
    : null;
}

async function ownerContext(tenantId: string, entityType: PolygonEntityType, entityId: number) {
  if (entityType === "facility") {
    const [row] = await db.select({
      id: facilities.id,
      name: facilities.name,
      districtId: facilities.districtId,
      latitude: facilities.latitude,
      longitude: facilities.longitude,
      legacyGeometry: facilities.catchmentPolygon,
    }).from(facilities).where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, entityId))).limit(1);
    if (!row) return null;
    return { ...row, facilityId: row.id, parentFacilityId: row.id, ownerPointLabel: "The facility point" };
  }

  if (entityType === "village") {
    const [row] = await db.select({
      id: villages.id,
      name: villages.name,
      districtId: villages.districtId,
      assignedFacilityId: villages.assignedFacilityId,
      latitude: villages.latitude,
      longitude: villages.longitude,
      legacyGeometry: villages.catchmentPolygon,
    }).from(villages).where(and(eq(villages.tenantId, tenantId), eq(villages.id, entityId))).limit(1);
    if (!row) return null;
    const facilityId = Number(row.assignedFacilityId || 0) || null;
    return { ...row, facilityId, parentFacilityId: facilityId, ownerPointLabel: "The community point" };
  }

  return { id: entityId, name: null, districtId: null, facilityId: null, parentFacilityId: null, latitude: null, longitude: null, legacyGeometry: null };
}

async function currentPolygon(tenantId: string, entityType: PolygonEntityType, entityId: number) {
  const [row] = await db.select().from(gisPolygons).where(and(
    eq(gisPolygons.tenantId, tenantId),
    eq(gisPolygons.ownerType, entityType),
    eq(gisPolygons.ownerId, entityId),
    eq(gisPolygons.isActive, true),
    eq(gisPolygons.status, "active"),
  )).orderBy(desc(gisPolygons.version)).limit(1);
  return row || null;
}

async function polygonHistory(tenantId: string, entityType: PolygonEntityType, entityId: number) {
  return db.select().from(gisPolygons).where(and(
    eq(gisPolygons.tenantId, tenantId),
    eq(gisPolygons.ownerType, entityType),
    eq(gisPolygons.ownerId, entityId),
  )).orderBy(desc(gisPolygons.version), desc(gisPolygons.createdAt));
}

async function nextVersion(tenantId: string, entityType: PolygonEntityType, entityId: number): Promise<number> {
  const history = await polygonHistory(tenantId, entityType, entityId);
  return history.reduce((max, item) => Math.max(max, Number(item.version || 0)), 0) + 1;
}

async function validationContext(tenantId: string, entityType: PolygonEntityType, entityId: number, owner: any) {
  let parentGeometry: any = null;
  let siblingPolygons: Array<{ id: number; name?: string | null; geometry: any }> = [];
  let neighbouringPolygons: Array<{ id: number; name?: string | null; geometry: any }> = [];

  if (entityType === "village" && owner?.facilityId) {
    const activeParent = await currentPolygon(tenantId, "facility", Number(owner.facilityId));
    if (activeParent?.geometry) {
      parentGeometry = activeParent.geometry;
    } else {
      const [facility] = await db.select({ catchmentPolygon: facilities.catchmentPolygon })
        .from(facilities)
        .where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, Number(owner.facilityId))))
        .limit(1);
      parentGeometry = facility?.catchmentPolygon || null;
    }

    const siblingOwners = await db.select({ id: villages.id, name: villages.name })
      .from(villages)
      .where(and(
        eq(villages.tenantId, tenantId),
        eq(villages.assignedFacilityId, Number(owner.facilityId)),
        ne(villages.id, entityId),
      ));
    const siblingById = new Map(siblingOwners.map((item) => [item.id, item.name]));
    const siblingRows = await db.select().from(gisPolygons).where(and(
      eq(gisPolygons.tenantId, tenantId),
      eq(gisPolygons.ownerType, "village"),
      eq(gisPolygons.parentFacilityId, Number(owner.facilityId)),
      eq(gisPolygons.isActive, true),
      eq(gisPolygons.status, "active"),
      ne(gisPolygons.ownerId, entityId),
    ));
    siblingPolygons = siblingRows.map((item) => ({
      id: item.ownerId,
      name: siblingById.get(item.ownerId) || item.name,
      geometry: item.geometry,
    }));
  }

  if (entityType === "facility") {
    const facilityOwners = await db.select({ id: facilities.id, name: facilities.name })
      .from(facilities)
      .where(and(eq(facilities.tenantId, tenantId), ne(facilities.id, entityId)));
    const nameById = new Map(facilityOwners.map((item) => [item.id, item.name]));
    const neighbours = await db.select().from(gisPolygons).where(and(
      eq(gisPolygons.tenantId, tenantId),
      eq(gisPolygons.ownerType, "facility"),
      eq(gisPolygons.isActive, true),
      eq(gisPolygons.status, "active"),
      ne(gisPolygons.ownerId, entityId),
    ));
    neighbouringPolygons = neighbours.map((item) => ({
      id: item.ownerId,
      name: nameById.get(item.ownerId) || item.name,
      geometry: item.geometry,
    }));
  }

  return { parentGeometry, siblingPolygons, neighbouringPolygons };
}

async function validateForOwner(tenantId: string, entityType: PolygonEntityType, entityId: number, geometry: any, owner: any, tolerance?: number) {
  const context = await validationContext(tenantId, entityType, entityId, owner);
  return validatePolygonLifecycleGeometry({
    geometry,
    ...context,
    point: {
      latitude: owner?.latitude,
      longitude: owner?.longitude,
      label: owner?.ownerPointLabel,
    },
    overlapTolerancePercent: tolerance,
  });
}

async function planningImpact(tenantId: string, entityType: PolygonEntityType, owner: any) {
  const facilityId = entityType === "facility" ? Number(owner.id) : Number(owner.facilityId || 0);
  if (!facilityId) return { communities: 0, microplans: 0, reports: 0, sessionPlans: 0, historicalUse: false };

  const [communityRows, microplanRows, reportRows, sessionRows] = await Promise.all([
    db.select({ id: villages.id }).from(villages).where(and(
      eq(villages.tenantId, tenantId),
      eq(villages.assignedFacilityId, facilityId),
    )),
    db.select({ id: microplans.id, status: microplans.status }).from(microplans).where(and(
      eq(microplans.tenantId, tenantId),
      eq(microplans.facilityId, facilityId),
    )),
    db.select({ id: monthlyReports.id }).from(monthlyReports).where(and(
      eq(monthlyReports.tenantId, tenantId),
      eq(monthlyReports.facilityId, facilityId),
    )),
    db.select({ id: sessionPlans.id }).from(sessionPlans).where(and(
      eq(sessionPlans.tenantId, tenantId),
      eq(sessionPlans.facilityId, facilityId),
    )),
  ]);

  let villageSessionLinks = 0;
  if (entityType === "village") {
    const links = await db.select({ id: sessionVillages.id }).from(sessionVillages).where(and(
      eq(sessionVillages.tenantId, tenantId),
      eq(sessionVillages.villageId, Number(owner.id)),
    ));
    villageSessionLinks = links.length;
  }

  return {
    communities: entityType === "facility" ? communityRows.length : 1,
    microplans: microplanRows.length,
    approvedMicroplans: microplanRows.filter((row) => row.status !== "draft").length,
    reports: reportRows.length,
    sessionPlans: sessionRows.length,
    villageSessionLinks,
    historicalUse: microplanRows.length + reportRows.length + sessionRows.length + villageSessionLinks > 0,
  };
}

async function authorize(req: any, res: any, deps: LifecycleDependencies, permission: string, owner: any): Promise<boolean> {
  const user = req.dbUser ?? (await storage.getUser(getCurrentUserId(req)));
  if (!user) {
    res.status(403).json({ message: "User context could not be resolved." });
    return false;
  }
  req.dbUser = user;
  const geo = {
    facilityId: owner?.facilityId || owner?.id || null,
    districtId: owner?.districtId || null,
  };
  if (!hasPermission(user, permission, { ...geo, activeTenantId: req.tenantId })) {
    res.status(403).json({ message: "You do not have permission to perform this polygon action.", requiredPermission: permission });
    return false;
  }
  if (!(await deps.canAccessGeo(user, req.tenantId, geo))) {
    res.status(403).json({ message: "This polygon is outside your assigned geographic scope." });
    return false;
  }
  return true;
}

async function estimatePopulation(tenantId: string, entityType: PolygonEntityType, entityId: number, geometry: any) {
  const tenant = await storage.getTenant(tenantId);
  const countryCode = String(tenant?.countryCode || tenant?.code || "ZMB").toUpperCase();
  const intel = await PopulationIntelligenceService.fetchPolygonPopulation(tenantId, geometry, countryCode, entityType, entityId);
  const source = intel?.sources?.[0];
  return {
    estimate: Number(source?.totalPopulation || 0),
    source: source?.source || "Population Hub",
    year: source?.year || new Date().getFullYear(),
    method: source?.method || "polygon intersection",
    confidence: source?.confidence || "Low",
  };
}

async function notifyAffectedUsers(tenantId: string, title: string, message: string, type: string) {
  const recipients = await storage.getUsersByTenantAndRoles(tenantId, [
    "district_manager",
    "provincial_coordinator",
    "gis_specialist",
    "national_admin",
  ]);
  await Promise.all(recipients.map((user: any) => storage.createNotification({
    tenantId,
    userId: user.id,
    type,
    title,
    body: message,
    data: { source: "polygon_lifecycle" },
  }).catch(() => null)));
}

export function registerPolygonLifecycleRoutes(app: Express, deps: LifecycleDependencies): void {
  app.get("/api/polygons/:entityType/:entityId/current", ...deps.auth, async (req: any, res) => {
    const parsed = parseEntity(req);
    if (!parsed) return res.status(400).json({ message: "Invalid polygon owner." });
    const owner = await ownerContext(req.tenantId, parsed.entityType, parsed.entityId);
    if (!owner) return res.status(404).json({ message: "Polygon owner not found." });
    if (!(await authorize(req, res, deps, "polygon.view", owner))) return;
    const current = await currentPolygon(req.tenantId, parsed.entityType, parsed.entityId);
    const impact = await planningImpact(req.tenantId, parsed.entityType, owner);
    res.json({ current, fallbackGeometry: current ? null : owner.legacyGeometry, impact });
  });

  app.get("/api/polygons/:entityType/:entityId/history", ...deps.auth, async (req: any, res) => {
    const parsed = parseEntity(req);
    if (!parsed) return res.status(400).json({ message: "Invalid polygon owner." });
    const owner = await ownerContext(req.tenantId, parsed.entityType, parsed.entityId);
    if (!owner) return res.status(404).json({ message: "Polygon owner not found." });
    if (!(await authorize(req, res, deps, "polygon.view_history", owner))) return;
    res.json(await polygonHistory(req.tenantId, parsed.entityType, parsed.entityId));
  });

  app.post("/api/polygons/:entityType/:entityId/validate", ...deps.auth, async (req: any, res) => {
    const parsed = parseEntity(req);
    if (!parsed) return res.status(400).json({ message: "Invalid polygon owner." });
    const owner = await ownerContext(req.tenantId, parsed.entityType, parsed.entityId);
    if (!owner) return res.status(404).json({ message: "Polygon owner not found." });
    if (!(await authorize(req, res, deps, "polygon.view", owner))) return;
    const validation = await validateForOwner(req.tenantId, parsed.entityType, parsed.entityId, req.body?.geometry, owner, req.body?.overlapTolerancePercent);
    res.status(validation.valid ? 200 : 422).json(validation);
  });

  const createDraft = async (req: any, res: any, changeType: "created" | "edit" | "replace") => {
    const parsed = parseEntity(req);
    if (!parsed) return res.status(400).json({ message: "Invalid polygon owner." });
    const owner = await ownerContext(req.tenantId, parsed.entityType, parsed.entityId);
    if (!owner) return res.status(404).json({ message: "Polygon owner not found." });
    const permission = changeType === "created" ? "polygon.create" : changeType === "replace" ? "polygon.replace" : "polygon.edit";
    if (!(await authorize(req, res, deps, permission, owner))) return;

    const geometry = req.body?.geometry;
    const changeReason = String(req.body?.changeReason || "").trim();
    if (!geometry) return res.status(400).json({ message: "Replacement geometry is required." });
    if (!changeReason) return res.status(400).json({ message: "A change reason is required." });

    const validation = await validateForOwner(req.tenantId, parsed.entityType, parsed.entityId, geometry, owner, req.body?.overlapTolerancePercent);
    if (!validation.valid) return res.status(422).json({ message: "Polygon validation failed.", validation });

    const current = await currentPolygon(req.tenantId, parsed.entityType, parsed.entityId);
    if (changeType === "created" && current) {
      return res.status(409).json({ message: "An active polygon already exists. Use edit or replace to create a new version." });
    }
    const population = await estimatePopulation(req.tenantId, parsed.entityType, parsed.entityId, geometry);
    const impact = await planningImpact(req.tenantId, parsed.entityType, owner);
    const version = await nextVersion(req.tenantId, parsed.entityType, parsed.entityId);
    const comparison = current
      ? comparePolygonVersions(current.geometry, geometry, { from: current.populationEstimate, to: population.estimate })
      : null;

    const [created] = await db.insert(gisPolygons).values({
      tenantId: req.tenantId,
      ownerType: parsed.entityType,
      ownerId: parsed.entityId,
      parentFacilityId: owner.parentFacilityId,
      polygonType: req.body?.polygonType || "catchment",
      name: req.body?.name || owner.name || null,
      geometry,
      centroid: validation.centroid,
      areaSqKm: String(validation.areaSqKm),
      populationEstimate: population.estimate,
      populationSource: population.source,
      populationSourceYear: population.year,
      populationMethod: population.method,
      confidence: population.confidence,
      status: "draft",
      version,
      previousVersionId: current?.id || null,
      isActive: false,
      validationStatus: validation.warnings.length > 0 ? "valid_with_warnings" : "valid",
      approvalStatus: "draft",
      changeType,
      changeReason,
      overrideReason: req.body?.overrideReason || null,
      createdBy: actorId(req),
      metadataJson: { validation, impact, comparison },
      updatedAt: new Date(),
    } as any).returning();

    await deps.logAudit(req, "polygon_" + changeType + "_draft_created", "gis_polygon", created.id, current, created);
    res.status(201).json({ polygon: created, validation, impact, comparison });
  };

  app.post("/api/polygons/:entityType/:entityId/create", ...deps.auth, (req: any, res) => createDraft(req, res, "created"));
  app.post("/api/polygons/:entityType/:entityId/edit", ...deps.auth, (req: any, res) => createDraft(req, res, "edit"));
  app.post("/api/polygons/:entityType/:entityId/replace", ...deps.auth, (req: any, res) => createDraft(req, res, "replace"));

  app.post("/api/polygons/:polygonVersionId/submit", ...deps.auth, async (req: any, res) => {
    const id = Number(req.params.polygonVersionId);
    const [row] = await db.select().from(gisPolygons).where(and(eq(gisPolygons.tenantId, req.tenantId), eq(gisPolygons.id, id))).limit(1);
    if (!row) return res.status(404).json({ message: "Polygon version not found." });
    const owner = await ownerContext(req.tenantId, row.ownerType as PolygonEntityType, row.ownerId);
    const submitPermission = row.changeType === "created" ? "polygon.create" : "polygon.edit";
    if (!(await authorize(req, res, deps, submitPermission, owner))) return;
    if (row.status !== "draft" && row.status !== "needs_correction") return res.status(409).json({ message: "Only a draft or correction version can be submitted." });

    const validation = await validateForOwner(req.tenantId, row.ownerType as PolygonEntityType, row.ownerId, row.geometry, owner);
    if (!validation.valid) return res.status(422).json({ message: "Polygon validation failed.", validation });

    const [updated] = await db.update(gisPolygons).set({
      status: "submitted_for_review",
      approvalStatus: "pending",
      submittedBy: actorId(req),
      submittedAt: new Date(),
      validationStatus: validation.warnings.length > 0 ? "valid_with_warnings" : "valid",
      metadataJson: { ...(row.metadataJson as any || {}), validation },
      updatedAt: new Date(),
    }).where(and(eq(gisPolygons.tenantId, req.tenantId), eq(gisPolygons.id, id))).returning();

    await deps.logAudit(req, "polygon_submitted", "gis_polygon", id, row, updated);
    await notifyAffectedUsers(req.tenantId, "Polygon change awaiting review", (owner?.name || "A polygon") + " version " + row.version + " was submitted for approval.", "polygon_submitted");
    res.json(updated);
  });

  app.post("/api/polygons/:polygonVersionId/approve", ...deps.auth, async (req: any, res) => {
    const id = Number(req.params.polygonVersionId);
    const [row] = await db.select().from(gisPolygons).where(and(eq(gisPolygons.tenantId, req.tenantId), eq(gisPolygons.id, id))).limit(1);
    if (!row) return res.status(404).json({ message: "Polygon version not found." });
    const entityType = row.ownerType as PolygonEntityType;
    const owner = await ownerContext(req.tenantId, entityType, row.ownerId);
    if (!(await authorize(req, res, deps, "polygon.approve", owner))) return;
    if (row.status !== "submitted_for_review") return res.status(409).json({ message: "Only a submitted polygon can be approved." });

    const validation = await validateForOwner(req.tenantId, entityType, row.ownerId, row.geometry, owner);
    if (!validation.valid) return res.status(422).json({ message: "Polygon validation failed.", validation });
    if (validation.warnings.length > 0) {
      const overrideReason = String(req.body?.overrideReason || row.overrideReason || "").trim();
      if (!hasPermission(req.dbUser, "polygon.override_validation", { facilityId: owner?.facilityId, activeTenantId: req.tenantId })) {
        return res.status(422).json({ message: "This version contains warnings and requires validation override permission.", validation });
      }
      if (!overrideReason) return res.status(400).json({ message: "An override reason is required for validation warnings.", validation });
    }

    const now = new Date();
    const impact = await planningImpact(req.tenantId, entityType, owner);
    const updated = await db.transaction(async (tx) => {
      const [prior] = await tx.select().from(gisPolygons).where(and(
        eq(gisPolygons.tenantId, req.tenantId),
        eq(gisPolygons.ownerType, row.ownerType),
        eq(gisPolygons.ownerId, row.ownerId),
        eq(gisPolygons.isActive, true),
        eq(gisPolygons.status, "active"),
      )).limit(1);

      if (prior) {
        await tx.update(gisPolygons).set({
          status: "replaced",
          isActive: false,
          validTo: now,
          replacedVersionId: row.id,
          updatedAt: now,
        }).where(eq(gisPolygons.id, prior.id));
      }

      const [active] = await tx.update(gisPolygons).set({
        status: "active",
        isActive: true,
        approvalStatus: "approved",
        validationStatus: validation.warnings.length > 0 ? "approved_with_override" : "valid",
        approvedBy: actorId(req),
        approvedAt: now,
        validFrom: now,
        validTo: null,
        overrideReason: req.body?.overrideReason || row.overrideReason || null,
        metadataJson: { ...(row.metadataJson as any || {}), validation, impact },
        updatedAt: now,
      }).where(and(eq(gisPolygons.tenantId, req.tenantId), eq(gisPolygons.id, id))).returning();

      if (entityType === "facility") {
        await tx.update(facilities).set({
          catchmentPolygon: row.geometry,
          catchmentGridPopulation: row.populationEstimate,
          updatedAt: now,
        }).where(and(eq(facilities.tenantId, req.tenantId), eq(facilities.id, row.ownerId)));
      } else if (entityType === "village") {
        await tx.update(villages).set({
          catchmentPolygon: row.geometry,
          boundary: row.geometry,
          griddedPopulation: row.populationEstimate,
          populationSourceLabel: row.populationSource,
          updatedAt: now,
        }).where(and(eq(villages.tenantId, req.tenantId), eq(villages.id, row.ownerId)));
      }
      return active;
    });

    await deps.logAudit(req, "polygon_approved", "gis_polygon", id, row, updated);
    await notifyAffectedUsers(req.tenantId, "Polygon change approved", (owner?.name || "A polygon") + " version " + row.version + " is now active. Historical plans were preserved.", "polygon_approved");
    res.json({ polygon: updated, validation, impact, historicalRecordsUpdated: false });
  });

  app.post("/api/polygons/:polygonVersionId/reject", ...deps.auth, async (req: any, res) => {
    const id = Number(req.params.polygonVersionId);
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "A rejection reason is required." });
    const [row] = await db.select().from(gisPolygons).where(and(eq(gisPolygons.tenantId, req.tenantId), eq(gisPolygons.id, id))).limit(1);
    if (!row) return res.status(404).json({ message: "Polygon version not found." });
    const owner = await ownerContext(req.tenantId, row.ownerType as PolygonEntityType, row.ownerId);
    if (!(await authorize(req, res, deps, "polygon.approve", owner))) return;
    if (row.status !== "submitted_for_review") {
      return res.status(409).json({ message: "Only a submitted polygon can be returned for correction." });
    }
    const [updated] = await db.update(gisPolygons).set({
      status: "needs_correction",
      approvalStatus: "rejected",
      rejectionReason: reason,
      isActive: false,
      updatedAt: new Date(),
    }).where(and(eq(gisPolygons.tenantId, req.tenantId), eq(gisPolygons.id, id))).returning();
    await deps.logAudit(req, "polygon_rejected", "gis_polygon", id, row, updated);
    await notifyAffectedUsers(req.tenantId, "Polygon change rejected", (owner?.name || "A polygon") + " version " + row.version + " requires correction: " + reason, "polygon_rejected");
    res.json(updated);
  });

  app.post("/api/polygons/:polygonVersionId/archive", ...deps.auth, async (req: any, res) => {
    const id = Number(req.params.polygonVersionId);
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "An archive reason is required." });
    const [row] = await db.select().from(gisPolygons).where(and(eq(gisPolygons.tenantId, req.tenantId), eq(gisPolygons.id, id))).limit(1);
    if (!row) return res.status(404).json({ message: "Polygon version not found." });
    const owner = await ownerContext(req.tenantId, row.ownerType as PolygonEntityType, row.ownerId);
    if (!(await authorize(req, res, deps, "polygon.archive", owner))) return;
    const impact = await planningImpact(req.tenantId, row.ownerType as PolygonEntityType, owner);
    if (row.isActive || row.status === "active") {
      return res.status(409).json({
        message: "An active polygon cannot be archived directly. Create and approve a replacement so the current version remains available until superseded.",
        impact,
      });
    }
    const [updated] = await db.update(gisPolygons).set({
      status: "archived",
      isActive: false,
      validTo: new Date(),
      changeReason: reason,
      metadataJson: { ...(row.metadataJson as any || {}), impact },
      updatedAt: new Date(),
    }).where(and(eq(gisPolygons.tenantId, req.tenantId), eq(gisPolygons.id, id))).returning();
    await deps.logAudit(req, "polygon_archived", "gis_polygon", id, row, updated);
    res.json({ polygon: updated, impact });
  });

  app.delete("/api/polygons/:polygonVersionId/draft", ...deps.auth, async (req: any, res) => {
    const id = Number(req.params.polygonVersionId);
    const [row] = await db.select().from(gisPolygons).where(and(eq(gisPolygons.tenantId, req.tenantId), eq(gisPolygons.id, id))).limit(1);
    if (!row) return res.status(404).json({ message: "Polygon version not found." });
    const owner = await ownerContext(req.tenantId, row.ownerType as PolygonEntityType, row.ownerId);
    if (!(await authorize(req, res, deps, "polygon.delete_draft", owner))) return;
    const impact = await planningImpact(req.tenantId, row.ownerType as PolygonEntityType, owner);
    if (row.status !== "draft" || row.approvalStatus !== "draft" || row.isActive) {
      return res.status(409).json({
        message: "This polygon has been used in planning or reporting. It cannot be permanently deleted. It will be archived and replaced instead.",
        impact,
      });
    }
    await db.delete(gisPolygons).where(and(eq(gisPolygons.tenantId, req.tenantId), eq(gisPolygons.id, id)));
    await deps.logAudit(req, "polygon_draft_deleted", "gis_polygon", id, row, null);
    res.json({ deleted: true });
  });

  app.get("/api/polygons/:entityType/:entityId/compare", ...deps.auth, async (req: any, res) => {
    const parsed = parseEntity(req);
    if (!parsed) return res.status(400).json({ message: "Invalid polygon owner." });
    const owner = await ownerContext(req.tenantId, parsed.entityType, parsed.entityId);
    if (!(await authorize(req, res, deps, "polygon.compare_versions", owner))) return;
    const fromId = Number(req.query.fromVersionId);
    const toId = Number(req.query.toVersionId);
    const versions = await db.select().from(gisPolygons).where(and(
      eq(gisPolygons.tenantId, req.tenantId),
      eq(gisPolygons.ownerType, parsed.entityType),
      eq(gisPolygons.ownerId, parsed.entityId),
    )).orderBy(asc(gisPolygons.version));
    const from = versions.find((item) => item.id === fromId);
    const to = versions.find((item) => item.id === toId);
    if (!from || !to) return res.status(404).json({ message: "One or both polygon versions were not found." });
    res.json({
      from,
      to,
      comparison: comparePolygonVersions(from.geometry, to.geometry, {
        from: from.populationEstimate,
        to: to.populationEstimate,
      }),
      impact: await planningImpact(req.tenantId, parsed.entityType, owner),
    });
  });

  app.post("/api/polygons/:polygonVersionId/recalculate-population", ...deps.auth, async (req: any, res) => {
    const id = Number(req.params.polygonVersionId);
    const [row] = await db.select().from(gisPolygons).where(and(eq(gisPolygons.tenantId, req.tenantId), eq(gisPolygons.id, id))).limit(1);
    if (!row) return res.status(404).json({ message: "Polygon version not found." });
    const owner = await ownerContext(req.tenantId, row.ownerType as PolygonEntityType, row.ownerId);
    if (!(await authorize(req, res, deps, "polygon.recalculate_population", owner))) return;
    const before = row.populationEstimate;
    const population = await estimatePopulation(req.tenantId, row.ownerType as PolygonEntityType, row.ownerId, row.geometry);
    const [updated] = await db.update(gisPolygons).set({
      populationEstimate: population.estimate,
      populationSource: population.source,
      populationSourceYear: population.year,
      populationMethod: population.method,
      confidence: population.confidence,
      metadataJson: {
        ...(row.metadataJson as any || {}),
        populationRecalculation: {
          previousPopulation: before,
          newPopulation: population.estimate,
          recalculatedAt: new Date().toISOString(),
          recalculatedBy: actorId(req),
        },
      },
      updatedAt: new Date(),
    }).where(and(eq(gisPolygons.tenantId, req.tenantId), eq(gisPolygons.id, id))).returning();
    await deps.logAudit(req, "polygon_population_recalculated", "gis_polygon", id, row, updated);
    res.json(updated);
  });
}
