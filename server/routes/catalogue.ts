import { safeErrorMessage } from "../errorUtils";
import { Router } from "express";
import { db } from "../db";
import { eq, and, or } from "drizzle-orm";
import {
  catalogueVaccines,
  catalogueScheduleDoses,
  catalogueCommodities,
  catalogueWastageThresholds,
  insertCatalogueVaccineSchema,
  insertCatalogueScheduleDoseSchema,
  insertCatalogueCommoditySchema,
  insertCatalogueWastageThresholdSchema
} from "../../shared/schema";
import { isAuthenticated } from "../auth";
import { requireTenant } from "../auth/tenantResolver";
import { hasPermission, type Permission } from "../auth/authorization";
import { requireDbUser } from "../auth/loadDbUser";

const router = Router();

function requirePermission(permissionCode: Permission) {
  return async (req: any, res: any, next: any) => {
    requireDbUser(req, res, async (err?: any) => {
      if (err) return next(err);
      try {
        const allowed = hasPermission(req.dbUser, permissionCode, { activeTenantId: req.tenantId });
        if (!allowed) {
          return res.status(403).json({ message: `Permission '${permissionCode}' required` });
        }
        next();
      } catch (e) {
        next(e);
      }
    });
  };
}

function requireCatalogueEditPermission() {
  return async (req: any, res: any, next: any) => {
    requireDbUser(req, res, async (err?: any) => {
      if (err) return next(err);
      try {
        const user = req.dbUser || req.user;
        if (!user) {
          return res.status(401).json({ message: "Authentication required" });
        }
        const role = String(user.role || "").toLowerCase();
        const allowedRoles = [
          "national_admin",
          "superadmin",
          "super_admin",
          "admin",
          "provincial_coordinator",
          "district_manager",
          "facility_in_charge",
          "epidemiologist",
          "health_informatics_officer",
          "gis_specialist",
          "planner"
        ];
        if (allowedRoles.includes(role)) {
          return next();
        }
        const hasManageUsers = hasPermission(user, "manage_users", { activeTenantId: req.tenantId });
        const hasManageStock = hasPermission(user, "manage_stock", { activeTenantId: req.tenantId });
        const hasApprovePlans = hasPermission(user, "approve_plans", { activeTenantId: req.tenantId });
        if (hasManageUsers || hasManageStock || hasApprovePlans) {
          return next();
        }
        return res.status(403).json({ message: "Permission required to modify national immunization schedule" });
      } catch (e) {
        next(e);
      }
    });
  };
}

// --- VACCINES ---
router.get("/vaccines", isAuthenticated, requireTenant, async (req: any, res) => {
  try {
    const conditions = [eq(catalogueVaccines.tenantId, req.tenantId)];
    if (req.query.activeOnly === "true") conditions.push(eq(catalogueVaccines.active, true));
    const results = await db.select().from(catalogueVaccines).where(and(...conditions)).orderBy(catalogueVaccines.name);
    res.json(results);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch catalogue vaccines" });
  }
});

router.get("/vaccines/:id", isAuthenticated, requireTenant, async (req: any, res) => {
  try {
    const [result] = await db.select().from(catalogueVaccines).where(and(eq(catalogueVaccines.tenantId, req.tenantId), eq(catalogueVaccines.id, parseInt(req.params.id))));
    if (!result) return res.status(404).json({ message: "Vaccine not found" });
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch vaccine" });
  }
});

router.post("/vaccines", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
  try {
    const data = insertCatalogueVaccineSchema.parse({ ...req.body, tenantId: req.tenantId });
    const [inserted] = await db.insert(catalogueVaccines).values(data).returning();
    res.json(inserted);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to insert catalogue vaccine" });
  }
});

router.patch("/vaccines/:id", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
  try {
    const { id, tenantId, createdAt, updatedAt, ...data } = req.body;
    const [updated] = await db.update(catalogueVaccines).set({ ...data, updatedAt: new Date() }).where(and(eq(catalogueVaccines.tenantId, req.tenantId), eq(catalogueVaccines.id, parseInt(req.params.id)))).returning();
    res.json(updated);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to update catalogue vaccine" });
  }
});

// --- SCHEDULE DOSES & PRESETS ---
router.get("/schedules/presets", isAuthenticated, requireTenant, async (req: any, res) => {
  try {
    const { ALL_NATIONAL_PRESETS, AGE_MILESTONES, ROUTE_LABELS, TARGET_POPULATION_GROUPS } = await import("../../shared/nationalSchedules");
    res.json({
      presets: Object.values(ALL_NATIONAL_PRESETS),
      milestones: AGE_MILESTONES,
      routes: ROUTE_LABELS,
      targetGroups: TARGET_POPULATION_GROUPS,
    });
  } catch (err: any) {
    console.error("Failed to load schedule presets:", err);
    res.status(500).json({ message: "Failed to load national schedule presets" });
  }
});

router.post("/schedules/apply-preset", isAuthenticated, requireTenant, requireCatalogueEditPermission(), async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const countryCode = req.body.countryCode || req.body.presetKey;
    const { ALL_NATIONAL_PRESETS, getPresetForCountry } = await import("../../shared/nationalSchedules");
    
    const preset = ALL_NATIONAL_PRESETS[countryCode?.toUpperCase()] || getPresetForCountry(countryCode);
    if (!preset) {
      return res.status(400).json({ message: `Preset for '${countryCode}' not found` });
    }

    // 1. Ensure all vaccines referenced by preset exist for tenant
    const existingVaccines = await db.select().from(catalogueVaccines).where(eq(catalogueVaccines.tenantId, tenantId));
    const vaccineMap = new Map<string, number>();
    for (const v of existingVaccines) {
      vaccineMap.set(v.productId, v.id);
      vaccineMap.set(v.name.toLowerCase(), v.id);
    }

    for (const dose of preset.doses) {
      if (!vaccineMap.has(dose.vaccineProductId)) {
        // Insert vaccine product safely
        const [newVac] = await db.insert(catalogueVaccines).values({
          tenantId,
          productId: dose.vaccineProductId,
          name: dose.vaccineName,
          antigenName: dose.antigen,
          category: "Vaccine",
          presentation: dose.route === "Oral" ? "Liquid" : "Liquid",
          dosesPerVial: dose.route === "Oral" ? 20 : (dose.doseCode.includes("bcg") ? 20 : 10),
          unitOfMeasure: dose.route === "Oral" ? "tubes" : "vials",
          routineUse: true,
          approvalStatus: "approved",
          active: true,
          modules: {},
        } as any).returning();
        vaccineMap.set(dose.vaccineProductId, newVac.id);
        vaccineMap.set(dose.vaccineName.toLowerCase(), newVac.id);
      }
    }

    // 2. Upsert schedule doses
    let upsertedCount = 0;
    for (const d of preset.doses) {
      const vaccineId = vaccineMap.get(d.vaccineProductId) || vaccineMap.get(d.vaccineName.toLowerCase());
      if (!vaccineId) continue;

      // Normalize doseCode: treat penta-1 and penta_1 as equivalent to prevent duplicates
      const altDoseCode = d.doseCode.includes("_")
        ? d.doseCode.replace(/_/g, "-")
        : d.doseCode.replace(/-/g, "_");

      const existingRows = await db.select().from(catalogueScheduleDoses).where(
        and(
          eq(catalogueScheduleDoses.tenantId, tenantId),
          or(
            eq(catalogueScheduleDoses.doseCode, d.doseCode),
            eq(catalogueScheduleDoses.doseCode, altDoseCode)
          )
        )
      );
      // If multiple rows (should not happen after cleanup), keep the canonical one
      const existing = existingRows.find(r => r.doseCode === d.doseCode) || existingRows[0];

      const dosePayload = {
        name: d.name,
        vaccineId,
        doseNumber: d.doseNumber,
        targetAge: d.targetAge,
        minimumAge: d.minimumAge || null,
        maximumAge: d.maximumAge || null,
        minimumInterval: d.minimumInterval || null,
        route: d.route,
        site: d.site,
        targetPopulationGroup: d.targetPopulationGroup,
        classification: d.classification,
        active: true,
        approvalStatus: "approved" as const,
      };

      if (existing) {
        await db.update(catalogueScheduleDoses)
          .set(dosePayload)
          .where(and(eq(catalogueScheduleDoses.tenantId, tenantId), eq(catalogueScheduleDoses.id, existing.id)));
      } else {
        await db.insert(catalogueScheduleDoses).values({
          tenantId,
          doseCode: d.doseCode,
          ...dosePayload,
        });
      }
      upsertedCount++;
    }

    res.json({
      success: true,
      message: `Successfully applied national schedule preset '${preset.scheduleTitle}' (${preset.countryName}).`,
      count: upsertedCount,
      preset: {
        countryCode: preset.countryCode,
        countryName: preset.countryName,
        scheduleTitle: preset.scheduleTitle,
        version: preset.version,
      }
    });
  } catch (err: any) {
    console.error("Failed to apply national schedule preset:", err);
    res.status(500).json({ message: safeErrorMessage(err, "Failed to apply national schedule preset") });
  }
});

router.post("/schedules/batch-toggle", isAuthenticated, requireTenant, requireCatalogueEditPermission(), async (req: any, res) => {
  try {
    const { ids, active } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Invalid or empty IDs array" });
    }

    for (const id of ids) {
      await db.update(catalogueScheduleDoses)
        .set({ active: Boolean(active) })
        .where(and(eq(catalogueScheduleDoses.tenantId, req.tenantId), eq(catalogueScheduleDoses.id, parseInt(id))));
    }

    res.json({ success: true, count: ids.length, active });
  } catch (err: any) {
    console.error("Failed to batch toggle schedule doses:", err);
    res.status(500).json({ message: "Failed to update schedule doses" });
  }
});

router.get("/schedules", isAuthenticated, requireTenant, async (req: any, res) => {
  try {
    const { resolveDoseMilestone, getClinicalMetadataForDose } = await import("../../shared/nationalSchedules");
    const conditions = [eq(catalogueScheduleDoses.tenantId, req.tenantId)];
    if (req.query.activeOnly === "true") conditions.push(eq(catalogueScheduleDoses.active, true));
    const rawResults = await db.select().from(catalogueScheduleDoses).where(and(...conditions)).orderBy(catalogueScheduleDoses.doseNumber);
    
    // Auto-enrich doses that have missing or legacy targetAge or generic administration fields
    const enrichedResults = rawResults.map(dose => {
      const milestone = resolveDoseMilestone(dose);
      const clinicalMeta = getClinicalMetadataForDose(dose.name, dose.doseCode, dose.targetAge);

      const resolvedTargetAge = (!dose.targetAge || dose.targetAge.trim() === "" || dose.targetAge.toLowerCase() === "at birth")
        ? milestone.label
        : dose.targetAge;

      const resolvedSite = (!dose.site || dose.site.trim() === "" || dose.site.toLowerCase() === "standard site" || dose.site.toLowerCase() === "standard")
        ? clinicalMeta.site
        : dose.site;

      const resolvedMinInterval = (!dose.minimumInterval || dose.minimumInterval.trim() === "" || dose.minimumInterval === "—")
        ? clinicalMeta.minimumInterval
        : dose.minimumInterval;

      const resolvedRoute = (!dose.route || dose.route.trim() === "" || (dose.route === "IM" && clinicalMeta.route !== "IM"))
        ? clinicalMeta.route
        : dose.route;

      return {
        ...dose,
        targetAge: resolvedTargetAge,
        site: resolvedSite,
        minimumInterval: resolvedMinInterval,
        route: resolvedRoute,
        clinicalNotes: clinicalMeta.notes,
      };
    });

    res.json(enrichedResults);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch catalogue schedules" });
  }
});

router.post("/schedules", isAuthenticated, requireTenant, requireCatalogueEditPermission(), async (req: any, res) => {
  try {
    const rawData = req.body;
    const sanitizedData = {
      tenantId: req.tenantId,
      name: String(rawData.name || "").trim(),
      doseCode: String(rawData.doseCode || "").trim(),
      vaccineId: Number(rawData.vaccineId),
      doseNumber: Number(rawData.doseNumber || 1),
      targetAge: rawData.targetAge ? String(rawData.targetAge).trim() : null,
      minimumAge: rawData.minimumAge ? String(rawData.minimumAge).trim() : null,
      maximumAge: rawData.maximumAge ? String(rawData.maximumAge).trim() : null,
      minimumInterval: rawData.minimumInterval ? String(rawData.minimumInterval).trim() : null,
      route: rawData.route ? String(rawData.route).trim() : "IM",
      site: rawData.site ? String(rawData.site).trim() : null,
      targetPopulationGroup: rawData.targetPopulationGroup ? String(rawData.targetPopulationGroup).trim() : "infants",
      classification: rawData.classification ? String(rawData.classification).trim() : "routine",
      active: rawData.active !== undefined ? Boolean(rawData.active) : true,
      approvalStatus: (rawData.approvalStatus as any) || "approved",
    };
    const data = insertCatalogueScheduleDoseSchema.parse(sanitizedData);
    const [inserted] = await db.insert(catalogueScheduleDoses).values(data).returning();
    res.json(inserted);
  } catch (err: any) {
    console.error("Failed to insert catalogue schedule:", err);
    res.status(500).json({ message: safeErrorMessage(err, "Failed to insert catalogue schedule") });
  }
});

router.patch("/schedules/:id", isAuthenticated, requireTenant, requireCatalogueEditPermission(), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid schedule dose ID" });
    }

    const { id: _id, tenantId: _tenantId, createdAt: _c, updatedAt: _u, ...rawData } = req.body;
    
    // Sanitize and type-cast numeric and string fields
    const data: Record<string, any> = {};
    if (rawData.name !== undefined) data.name = String(rawData.name).trim();
    if (rawData.doseCode !== undefined) data.doseCode = String(rawData.doseCode).trim();
    if (rawData.vaccineId !== undefined && rawData.vaccineId !== null && !isNaN(Number(rawData.vaccineId))) {
      data.vaccineId = Number(rawData.vaccineId);
    }
    if (rawData.doseNumber !== undefined && rawData.doseNumber !== null && !isNaN(Number(rawData.doseNumber))) {
      data.doseNumber = Number(rawData.doseNumber);
    }
    if (rawData.targetAge !== undefined) data.targetAge = rawData.targetAge ? String(rawData.targetAge).trim() : null;
    if (rawData.minimumAge !== undefined) data.minimumAge = rawData.minimumAge ? String(rawData.minimumAge).trim() : null;
    if (rawData.maximumAge !== undefined) data.maximumAge = rawData.maximumAge ? String(rawData.maximumAge).trim() : null;
    if (rawData.minimumInterval !== undefined) data.minimumInterval = rawData.minimumInterval ? String(rawData.minimumInterval).trim() : null;
    if (rawData.route !== undefined) data.route = rawData.route ? String(rawData.route).trim() : null;
    if (rawData.site !== undefined) data.site = rawData.site ? String(rawData.site).trim() : null;
    if (rawData.targetPopulationGroup !== undefined) data.targetPopulationGroup = rawData.targetPopulationGroup ? String(rawData.targetPopulationGroup).trim() : null;
    
    if (rawData.classification !== undefined) {
      let cls = String(rawData.classification).trim().toLowerCase();
      if (cls.includes("routine")) cls = "routine";
      else if (cls.includes("campaign") || cls.includes("supplementary") || cls.includes("sia")) cls = "campaign";
      else if (cls.includes("outbreak")) cls = "outbreak";
      else if (cls.includes("school")) cls = "school_based";
      else if (cls.includes("catchup") || cls.includes("catch_up") || cls.includes("other")) cls = "other";
      else if (!["routine", "campaign", "outbreak", "school_based", "other"].includes(cls)) cls = "routine";
      data.classification = cls;
    }
    
    if (rawData.active !== undefined) data.active = Boolean(rawData.active);
    if (rawData.approvalStatus !== undefined) {
      const validApprovalStatuses = ["draft", "in_review", "approved", "rejected", "archived"];
      data.approvalStatus = validApprovalStatuses.includes(rawData.approvalStatus) ? rawData.approvalStatus : "approved";
    }

    const [existing] = await db.select().from(catalogueScheduleDoses).where(eq(catalogueScheduleDoses.id, id));
    if (!existing) {
      return res.status(404).json({ message: "Schedule dose not found" });
    }

    const [updated] = await db.update(catalogueScheduleDoses)
      .set(data)
      .where(eq(catalogueScheduleDoses.id, id))
      .returning();

    res.json(updated);
  } catch (err: any) {
    console.error("Failed to update schedule dose:", err);
    res.status(500).json({ message: safeErrorMessage(err, "Failed to update schedule dose") });
  }
});


// --- COMMODITIES ---
router.get("/commodities", isAuthenticated, requireTenant, async (req: any, res) => {
  try {
    const conditions = [eq(catalogueCommodities.tenantId, req.tenantId)];
    if (req.query.activeOnly === "true") conditions.push(eq(catalogueCommodities.active, true));
    const results = await db.select().from(catalogueCommodities).where(and(...conditions)).orderBy(catalogueCommodities.name);
    res.json(results);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch catalogue commodities" });
  }
});

router.post("/commodities", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
  try {
    const rawPayload = {
      category: req.body.category || "Logistics",
      unitOfMeasure: req.body.unitOfMeasure || "pieces",
      stockManaged: req.body.stockManaged ?? true,
      forecastable: req.body.forecastable ?? true,
      requisitionable: req.body.requisitionable ?? true,
      sessionSupply: req.body.sessionSupply ?? true,
      bufferPercentage: req.body.bufferPercentage || "10.00",
      minimumStockThreshold: req.body.minimumStockThreshold ?? 0,
      maximumStockThreshold: req.body.maximumStockThreshold ?? 0,
      reorderLevel: req.body.reorderLevel ?? 0,
      modules: req.body.modules || {},
      consumptionRule: req.body.consumptionRule || {},
      active: req.body.active ?? true,
      ...req.body,
      linkedVaccineId: (req.body.linkedVaccineId && req.body.linkedVaccineId !== "none" && req.body.linkedVaccineId !== 0 && req.body.linkedVaccineId !== "0") ? Number(req.body.linkedVaccineId) : null,
      tenantId: req.tenantId
    };
    const data = insertCatalogueCommoditySchema.parse(rawPayload);
    const [inserted] = await db.insert(catalogueCommodities).values(data).returning();
    res.json(inserted);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to insert catalogue commodity" });
  }
});

router.patch("/commodities/:id", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
  try {
    const { id, tenantId, createdAt, updatedAt, ...data } = req.body;
    const [updated] = await db.update(catalogueCommodities).set(data).where(and(eq(catalogueCommodities.tenantId, req.tenantId), eq(catalogueCommodities.id, parseInt(req.params.id)))).returning();
    res.json(updated);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to update commodity" });
  }
});

// --- WASTAGE THRESHOLDS ---
router.get("/wastage-thresholds", isAuthenticated, requireTenant, async (req: any, res) => {
  try {
    const conditions = [eq(catalogueWastageThresholds.tenantId, req.tenantId)];
    if (req.query.activeOnly === "true") conditions.push(eq(catalogueWastageThresholds.active, true));
    const results = await db.select().from(catalogueWastageThresholds).where(and(...conditions));
    res.json(results);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch wastage thresholds" });
  }
});

router.post("/wastage-thresholds", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
  try {
    const data = insertCatalogueWastageThresholdSchema.parse({ ...req.body, tenantId: req.tenantId });
    const [inserted] = await db.insert(catalogueWastageThresholds).values(data).returning();
    res.json(inserted);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to insert wastage threshold" });
  }
});

router.patch("/wastage-thresholds/:id", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
  try {
    const { id, tenantId, createdAt, updatedAt, ...data } = req.body;
    const [updated] = await db.update(catalogueWastageThresholds).set(data).where(and(eq(catalogueWastageThresholds.tenantId, req.tenantId), eq(catalogueWastageThresholds.id, parseInt(req.params.id)))).returning();
    res.json(updated);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to update wastage threshold" });
  }
});

// --- SEED CATALOGUE ---
router.post("/seed", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
  try {
    const tenantId = req.tenantId;

    // Ensure imports inside the handler if missing
    const { catalogueVaccines, catalogueScheduleDoses, catalogueCommodities, catalogueWastageThresholds } = await import("../../shared/schema");

    const seedVaccines = [
      { productId: 'vaccine_bcg', name: 'BCG', antigenName: 'BCG', category: 'Vaccine', presentation: 'Lyophilized', dosesPerVial: 20, unitOfMeasure: 'vials', requiresDiluent: true, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: true, campaignUse: false, outbreakUse: false, wastageThreshold: "50.00", modules: {} },
      { productId: 'vaccine_opv', name: 'OPV', antigenName: 'Polio', category: 'Vaccine', presentation: 'Liquid', dosesPerVial: 20, unitOfMeasure: 'vials', requiresDiluent: false, requiresInjectionDevice: false, requiresSafetyBox: false, routineUse: true, campaignUse: true, outbreakUse: true, wastageThreshold: "15.00", modules: {} },
      { productId: 'vaccine_ipv', name: 'IPV', antigenName: 'Polio', category: 'Vaccine', presentation: 'Liquid', dosesPerVial: 10, unitOfMeasure: 'vials', requiresDiluent: false, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: true, campaignUse: true, outbreakUse: false, wastageThreshold: "10.00", modules: {} },
      { productId: 'vaccine_penta', name: 'PENTA', antigenName: 'DTP-HepB-Hib', category: 'Vaccine', presentation: 'Liquid', dosesPerVial: 10, unitOfMeasure: 'vials', requiresDiluent: false, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: true, campaignUse: false, outbreakUse: false, wastageThreshold: "10.00", modules: {} },
      { productId: 'vaccine_pcv', name: 'PCV', antigenName: 'Pneumococcal', category: 'Vaccine', presentation: 'Liquid', dosesPerVial: 4, unitOfMeasure: 'vials', requiresDiluent: false, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: true, campaignUse: false, outbreakUse: false, wastageThreshold: "5.00", modules: {} },
      { productId: 'vaccine_rota', name: 'Rotavirus', antigenName: 'Rotavirus', category: 'Vaccine', presentation: 'Liquid', dosesPerVial: 1, unitOfMeasure: 'tubes', requiresDiluent: false, requiresInjectionDevice: false, requiresSafetyBox: false, routineUse: true, campaignUse: false, outbreakUse: false, wastageThreshold: "5.00", modules: {} },
      { productId: 'vaccine_mr', name: 'MR', antigenName: 'Measles-Rubella', category: 'Vaccine', presentation: 'Lyophilized', dosesPerVial: 10, unitOfMeasure: 'vials', requiresDiluent: true, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: true, campaignUse: true, outbreakUse: true, wastageThreshold: "30.00", modules: {} },
      { productId: 'vaccine_td', name: 'TT / Td', antigenName: 'Tetanus-Diphtheria', category: 'Vaccine', presentation: 'Liquid', dosesPerVial: 10, unitOfMeasure: 'vials', requiresDiluent: false, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: true, campaignUse: false, outbreakUse: false, wastageThreshold: "10.00", modules: {} },
      { productId: 'vaccine_hpv', name: 'HPV', antigenName: 'Human Papillomavirus', category: 'Vaccine', presentation: 'Liquid', dosesPerVial: 1, unitOfMeasure: 'vials', requiresDiluent: false, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: true, campaignUse: true, outbreakUse: false, wastageThreshold: "5.00", modules: {} },
      { productId: 'vaccine_covid19', name: 'COVID-19 vaccine', antigenName: 'SARS-CoV-2', category: 'Vaccine', presentation: 'Liquid', dosesPerVial: 10, unitOfMeasure: 'vials', requiresDiluent: false, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: true, campaignUse: true, outbreakUse: false, wastageThreshold: "10.00", modules: {} },
      { productId: 'vaccine_yellow_fever', name: 'Yellow Fever', antigenName: 'Yellow Fever', category: 'Vaccine', presentation: 'Lyophilized', dosesPerVial: 10, unitOfMeasure: 'vials', requiresDiluent: true, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: true, campaignUse: true, outbreakUse: true, wastageThreshold: "30.00", modules: {} },
      { productId: 'vaccine_meningitis', name: 'Meningitis vaccine', antigenName: 'Meningococcal', category: 'Vaccine', presentation: 'Lyophilized', dosesPerVial: 10, unitOfMeasure: 'vials', requiresDiluent: true, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: true, campaignUse: true, outbreakUse: true, wastageThreshold: "30.00", modules: {} },
      { productId: 'vaccine_malaria', name: 'Malaria vaccine', antigenName: 'Malaria', category: 'Vaccine', presentation: 'Lyophilized', dosesPerVial: 2, unitOfMeasure: 'vials', requiresDiluent: true, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: false, campaignUse: false, outbreakUse: false, wastageThreshold: "10.00", active: false, modules: {} },
      { productId: 'vaccine_dengue', name: 'Dengue vaccine', antigenName: 'Dengue', category: 'Vaccine', presentation: 'Lyophilized', dosesPerVial: 5, unitOfMeasure: 'vials', requiresDiluent: true, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: false, campaignUse: false, outbreakUse: false, wastageThreshold: "10.00", active: false, modules: {} },
      { productId: 'vaccine_cholera', name: 'Cholera vaccine', antigenName: 'Cholera', category: 'Vaccine', presentation: 'Liquid', dosesPerVial: 1, unitOfMeasure: 'vials', requiresDiluent: false, requiresInjectionDevice: false, requiresSafetyBox: false, routineUse: false, campaignUse: true, outbreakUse: true, wastageThreshold: "5.00", active: false, modules: {} },
      { productId: 'vaccine_tcv', name: 'Typhoid conjugate vaccine', antigenName: 'Typhoid', category: 'Vaccine', presentation: 'Liquid', dosesPerVial: 5, unitOfMeasure: 'vials', requiresDiluent: false, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: false, campaignUse: true, outbreakUse: true, wastageThreshold: "10.00", active: false, modules: {} },
      { productId: 'vaccine_mpox', name: 'Mpox vaccine', antigenName: 'Mpox', category: 'Vaccine', presentation: 'Liquid', dosesPerVial: 1, unitOfMeasure: 'vials', requiresDiluent: false, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: false, campaignUse: true, outbreakUse: true, wastageThreshold: "5.00", active: false, modules: {} }
    ];

    for (const v of seedVaccines) {
      const [existing] = await db.select().from(catalogueVaccines).where(and(eq(catalogueVaccines.tenantId, tenantId), eq(catalogueVaccines.productId, v.productId)));
      if (!existing) {
        await db.insert(catalogueVaccines).values({ ...v, tenantId, approvalStatus: 'approved' } as any);
      }
    }

    // Fetch newly inserted or existing to link doses and commodities
    const allVaccines = await db.select().from(catalogueVaccines).where(eq(catalogueVaccines.tenantId, tenantId));
    const getVaxId = (pid: string) => allVaccines.find(v => v.productId === pid)?.id;

    const seedSchedules = [
      { doseCode: 'bcg_birth', name: 'BCG at birth', vaccineId: getVaxId('vaccine_bcg'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'opv_0', name: 'OPV-0', vaccineId: getVaxId('vaccine_opv'), doseNumber: 0, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'opv_1', name: 'OPV-1', vaccineId: getVaxId('vaccine_opv'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'opv_2', name: 'OPV-2', vaccineId: getVaxId('vaccine_opv'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'opv_3', name: 'OPV-3', vaccineId: getVaxId('vaccine_opv'), doseNumber: 3, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'ipv_1', name: 'IPV-1', vaccineId: getVaxId('vaccine_ipv'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'ipv_2', name: 'IPV-2', vaccineId: getVaxId('vaccine_ipv'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'penta_1', name: 'PENTA-1', vaccineId: getVaxId('vaccine_penta'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'penta_2', name: 'PENTA-2', vaccineId: getVaxId('vaccine_penta'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'penta_3', name: 'PENTA-3', vaccineId: getVaxId('vaccine_penta'), doseNumber: 3, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'pcv_1', name: 'PCV-1', vaccineId: getVaxId('vaccine_pcv'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'pcv_2', name: 'PCV-2', vaccineId: getVaxId('vaccine_pcv'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'pcv_3', name: 'PCV-3', vaccineId: getVaxId('vaccine_pcv'), doseNumber: 3, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'rota_1', name: 'ROTA-1', vaccineId: getVaxId('vaccine_rota'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'rota_2', name: 'ROTA-2', vaccineId: getVaxId('vaccine_rota'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'mr_1', name: 'MR-1', vaccineId: getVaxId('vaccine_mr'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'infants', targetAge: '9 Months' },
      { doseCode: 'mr_2', name: 'MR-2', vaccineId: getVaxId('vaccine_mr'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'children', targetAge: '18 Months' },
      { doseCode: 'td_6y', name: 'Td (6 Years)', vaccineId: getVaxId('vaccine_td'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'school_age', targetAge: '6 Years' },
      { doseCode: 'hpv_1', name: 'HPV-1', vaccineId: getVaxId('vaccine_hpv'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'adolescents', targetAge: '9 Years' },
      { doseCode: 'hpv_2', name: 'HPV-2', vaccineId: getVaxId('vaccine_hpv'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'adolescents', targetAge: '9 Years' },
      { doseCode: 'td_12y', name: 'Td (12 Years)', vaccineId: getVaxId('vaccine_td'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'adolescents', targetAge: '12 Years' },
      { doseCode: 'td_preg_1', name: 'Td 1 (Pregnancy)', vaccineId: getVaxId('vaccine_td'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'pregnant_women', targetAge: 'Pregnant Women' },
      { doseCode: 'td_preg_2', name: 'Td 2 (Pregnancy)', vaccineId: getVaxId('vaccine_td'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'pregnant_women', targetAge: 'Pregnant Women' },
      { doseCode: 'malaria_1', name: 'Malaria-1', vaccineId: getVaxId('vaccine_malaria'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'infants', targetAge: '6 Months' },
      { doseCode: 'malaria_2', name: 'Malaria-2', vaccineId: getVaxId('vaccine_malaria'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'infants', targetAge: '9 Months' },
      { doseCode: 'malaria_3', name: 'Malaria-3', vaccineId: getVaxId('vaccine_malaria'), doseNumber: 3, classification: 'routine', targetPopulationGroup: 'children', targetAge: '12 Months' },
      { doseCode: 'malaria_4', name: 'Malaria-4', vaccineId: getVaxId('vaccine_malaria'), doseNumber: 4, classification: 'routine', targetPopulationGroup: 'children', targetAge: '18 Months' }
    ];

    for (const s of seedSchedules) {
      if (!s.vaccineId) continue;
      const [existing] = await db.select().from(catalogueScheduleDoses).where(and(eq(catalogueScheduleDoses.tenantId, tenantId), eq(catalogueScheduleDoses.doseCode, s.doseCode)));
      if (!existing) {
        await db.insert(catalogueScheduleDoses).values({ ...s, tenantId, approvalStatus: 'approved' } as any);
      }
    }

    const seedCommodities = [
      { commodityCode: 'diluent_bcg', type: 'diluent', name: 'BCG diluent', linkedVaccineId: getVaxId('vaccine_bcg'), packSize: 100, stockManaged: true },
      { commodityCode: 'diluent_mr', type: 'diluent', name: 'MR diluent', linkedVaccineId: getVaxId('vaccine_mr'), packSize: 100, stockManaged: true },
      { commodityCode: 'diluent_yf', type: 'diluent', name: 'Yellow Fever diluent', linkedVaccineId: getVaxId('vaccine_yellow_fever'), packSize: 100, stockManaged: true },
      { commodityCode: 'syringe_05ml_ad', type: 'syringe', name: 'Auto-disable syringes 0.5ml', packSize: 100, stockManaged: true },
      { commodityCode: 'syringe_005ml_ad', type: 'syringe', name: 'Auto-disable syringes 0.05ml (BCG)', packSize: 100, stockManaged: true },
      { commodityCode: 'syringe_reconstitution_2ml', type: 'syringe', name: 'Reconstitution syringes 2ml', packSize: 100, stockManaged: true },
      { commodityCode: 'syringe_reconstitution_5ml', type: 'syringe', name: 'Reconstitution syringes 5ml', packSize: 100, stockManaged: true },
      { commodityCode: 'safety_box_5l', type: 'safety_box', name: 'Safety boxes 5L', packSize: 25, stockManaged: true },
      { commodityCode: 'ppe_gloves', type: 'ppe', name: 'Examination Gloves', packSize: 100, stockManaged: true },
      { commodityCode: 'ppe_masks', type: 'ppe', name: 'Masks', packSize: 50, stockManaged: true },
      { commodityCode: 'ppe_sanitizer', type: 'ppe', name: 'Hand sanitizer (500ml)', packSize: 1, stockManaged: true },
      { commodityCode: 'cold_chain_vaccine_carrier', type: 'cold_chain', name: 'Vaccine carriers (4L)', packSize: 1, stockManaged: true },
      { commodityCode: 'cold_chain_ice_pack', type: 'cold_chain', name: 'Ice packs', packSize: 1, stockManaged: true },
      { commodityCode: 'cold_chain_foam_pad', type: 'cold_chain', name: 'Foam pads', packSize: 1, stockManaged: true },
      { commodityCode: 'other_cotton_wool', type: 'other', name: 'Absorbent Cotton wool (500g)', packSize: 1, stockManaged: true },
      { commodityCode: 'other_tally_sheets', type: 'other', name: 'EPI Session tally sheets', packSize: 100, stockManaged: true },
      { commodityCode: 'other_vaccination_cards', type: 'other', name: 'Child Health Immunization cards (HBR)', packSize: 100, stockManaged: true },
      { commodityCode: 'other_register_book', type: 'other', name: 'Facility Immunization Register Book', packSize: 1, stockManaged: true },
      { commodityCode: 'other_aefi_form', type: 'other', name: 'AEFI Investigation & Reporting Form', packSize: 1, stockManaged: true }
    ];

    for (const c of seedCommodities) {
      const [existing] = await db.select().from(catalogueCommodities).where(and(eq(catalogueCommodities.tenantId, tenantId), eq(catalogueCommodities.commodityCode, c.commodityCode)));
      if (!existing) {
        await db.insert(catalogueCommodities).values({ ...c, tenantId } as any);
      }
    }

    const seedWastage = [
      { vaccineId: getVaxId('vaccine_bcg'), wastageRate: "50.00", wastageFactor: "2.00", minAcceptable: "10.00", maxAcceptable: "55.00" },
      { vaccineId: getVaxId('vaccine_opv'), wastageRate: "15.00", wastageFactor: "1.18", minAcceptable: "5.00", maxAcceptable: "20.00" },
      { vaccineId: getVaxId('vaccine_ipv'), wastageRate: "10.00", wastageFactor: "1.11", minAcceptable: "0.00", maxAcceptable: "15.00" },
      { vaccineId: getVaxId('vaccine_penta'), wastageRate: "10.00", wastageFactor: "1.11", minAcceptable: "0.00", maxAcceptable: "15.00" },
      { vaccineId: getVaxId('vaccine_pcv'), wastageRate: "5.00", wastageFactor: "1.05", minAcceptable: "0.00", maxAcceptable: "10.00" },
      { vaccineId: getVaxId('vaccine_mr'), wastageRate: "30.00", wastageFactor: "1.43", minAcceptable: "10.00", maxAcceptable: "40.00" }
    ];

    for (const w of seedWastage) {
      if (!w.vaccineId) continue;
      const [existing] = await db.select().from(catalogueWastageThresholds).where(and(eq(catalogueWastageThresholds.tenantId, tenantId), eq(catalogueWastageThresholds.vaccineId, w.vaccineId)));
      if (!existing) {
        await db.insert(catalogueWastageThresholds).values({ ...w, tenantId } as any);
      }
    }

    res.json({ message: "Default immunization catalogue seeded successfully." });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to seed catalogue" });
  }
});

export default router;
