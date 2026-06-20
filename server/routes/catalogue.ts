import { Router } from "express";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
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
  return [
    requireDbUser,
    async (req: any, res: any, next: any) => {
      try {
        const allowed = hasPermission(req.dbUser, permissionCode, { activeTenantId: req.tenantId });
        if (!allowed) {
          return res.status(403).json({ message: `Permission '${permissionCode}' required` });
        }
        next();
      } catch (err) {
        next(err);
      }
    }
  ];
}

// --- VACCINES ---
router.get("/vaccines", isAuthenticated, requireTenant, async (req: any, res) => {
  try {
    const results = await db.select().from(catalogueVaccines).where(eq(catalogueVaccines.tenantId, req.tenantId)).orderBy(catalogueVaccines.name);
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
    res.status(500).json({ message: "Failed to insert catalogue vaccine", error: err.message });
  }
});

router.patch("/vaccines/:id", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
  try {
    const { id, tenantId, createdAt, updatedAt, ...data } = req.body;
    const [updated] = await db.update(catalogueVaccines).set({ ...data, updatedAt: new Date() }).where(and(eq(catalogueVaccines.tenantId, req.tenantId), eq(catalogueVaccines.id, parseInt(req.params.id)))).returning();
    res.json(updated);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to update catalogue vaccine", error: err.message });
  }
});

// --- SCHEDULE DOSES ---
router.get("/schedules", isAuthenticated, requireTenant, async (req: any, res) => {
  try {
    const results = await db.select().from(catalogueScheduleDoses).where(eq(catalogueScheduleDoses.tenantId, req.tenantId)).orderBy(catalogueScheduleDoses.doseNumber);
    res.json(results);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch catalogue schedules" });
  }
});

router.post("/schedules", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
  try {
    const data = insertCatalogueScheduleDoseSchema.parse({ ...req.body, tenantId: req.tenantId });
    const [inserted] = await db.insert(catalogueScheduleDoses).values(data).returning();
    res.json(inserted);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to insert catalogue schedule", error: err.message });
  }
});

router.patch("/schedules/:id", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
  try {
    const { id, tenantId, createdAt, updatedAt, ...data } = req.body;
    const [updated] = await db.update(catalogueScheduleDoses).set(data).where(and(eq(catalogueScheduleDoses.tenantId, req.tenantId), eq(catalogueScheduleDoses.id, parseInt(req.params.id)))).returning();
    res.json(updated);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to update schedule dose" });
  }
});


// --- COMMODITIES ---
router.get("/commodities", isAuthenticated, requireTenant, async (req: any, res) => {
  try {
    const results = await db.select().from(catalogueCommodities).where(eq(catalogueCommodities.tenantId, req.tenantId)).orderBy(catalogueCommodities.name);
    res.json(results);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch catalogue commodities" });
  }
});

router.post("/commodities", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
  try {
    const data = insertCatalogueCommoditySchema.parse({ ...req.body, tenantId: req.tenantId });
    const [inserted] = await db.insert(catalogueCommodities).values(data).returning();
    res.json(inserted);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to insert catalogue commodity", error: err.message });
  }
});

router.patch("/commodities/:id", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
  try {
    const { id, tenantId, createdAt, updatedAt, ...data } = req.body;
    const [updated] = await db.update(catalogueCommodities).set(data).where(and(eq(catalogueCommodities.tenantId, req.tenantId), eq(catalogueCommodities.id, parseInt(req.params.id)))).returning();
    res.json(updated);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to update commodity", error: err.message });
  }
});

// --- WASTAGE THRESHOLDS ---
router.get("/wastage-thresholds", isAuthenticated, requireTenant, async (req: any, res) => {
  try {
    const results = await db.select().from(catalogueWastageThresholds).where(eq(catalogueWastageThresholds.tenantId, req.tenantId));
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
    res.status(500).json({ message: "Failed to insert wastage threshold", error: err.message });
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
      { doseCode: 'mr_1', name: 'MR-1', vaccineId: getVaxId('vaccine_mr'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'mr_2', name: 'MR-2', vaccineId: getVaxId('vaccine_mr'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'hpv_1', name: 'HPV-1', vaccineId: getVaxId('vaccine_hpv'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'girls' },
      { doseCode: 'hpv_2', name: 'HPV-2', vaccineId: getVaxId('vaccine_hpv'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'girls' },
      { doseCode: 'malaria_1', name: 'Malaria-1', vaccineId: getVaxId('vaccine_malaria'), doseNumber: 1, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'malaria_2', name: 'Malaria-2', vaccineId: getVaxId('vaccine_malaria'), doseNumber: 2, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'malaria_3', name: 'Malaria-3', vaccineId: getVaxId('vaccine_malaria'), doseNumber: 3, classification: 'routine', targetPopulationGroup: 'infants' },
      { doseCode: 'malaria_4', name: 'Malaria-4', vaccineId: getVaxId('vaccine_malaria'), doseNumber: 4, classification: 'routine', targetPopulationGroup: 'children' }
    ];

    for (const s of seedSchedules) {
      if (!s.vaccineId) continue;
      const [existing] = await db.select().from(catalogueScheduleDoses).where(and(eq(catalogueScheduleDoses.tenantId, tenantId), eq(catalogueScheduleDoses.doseCode, s.doseCode)));
      if (!existing) {
        await db.insert(catalogueScheduleDoses).values({ ...s, tenantId, approvalStatus: 'approved' } as any);
      }
    }

    const seedCommodities = [
      { commodityCode: 'diluent_bcg', type: 'diluent', name: 'BCG diluent', linkedVaccineId: getVaxId('vaccine_bcg'), packSize: 100 },
      { commodityCode: 'diluent_mr', type: 'diluent', name: 'MR diluent', linkedVaccineId: getVaxId('vaccine_mr'), packSize: 100 },
      { commodityCode: 'diluent_yf', type: 'diluent', name: 'Yellow Fever diluent', linkedVaccineId: getVaxId('vaccine_yellow_fever'), packSize: 100 },
      { commodityCode: 'syringe_05ml_ad', type: 'syringe', name: 'Auto-disable syringes 0.5ml', packSize: 100 },
      { commodityCode: 'syringe_005ml_ad', type: 'syringe', name: 'Auto-disable syringes 0.05ml (BCG)', packSize: 100 },
      { commodityCode: 'syringe_reconstitution_2ml', type: 'syringe', name: 'Reconstitution syringes 2ml', packSize: 100 },
      { commodityCode: 'syringe_reconstitution_5ml', type: 'syringe', name: 'Reconstitution syringes 5ml', packSize: 100 },
      { commodityCode: 'safety_box_5l', type: 'safety_box', name: 'Safety boxes 5L', packSize: 25 },
      { commodityCode: 'ppe_gloves', type: 'ppe', name: 'Gloves', packSize: 100, stockManaged: false },
      { commodityCode: 'ppe_masks', type: 'ppe', name: 'Masks', packSize: 50, stockManaged: false },
      { commodityCode: 'ppe_sanitizer', type: 'ppe', name: 'Hand sanitizer', packSize: 1, stockManaged: false },
      { commodityCode: 'cold_chain_vaccine_carrier', type: 'cold_chain', name: 'Vaccine carriers', packSize: 1, stockManaged: true },
      { commodityCode: 'cold_chain_ice_pack', type: 'cold_chain', name: 'Ice packs', packSize: 1, stockManaged: true },
      { commodityCode: 'other_cotton_wool', type: 'other', name: 'Cotton wool', packSize: 1, stockManaged: false },
      { commodityCode: 'other_tally_sheets', type: 'other', name: 'Session tally sheets', packSize: 100, stockManaged: false },
      { commodityCode: 'other_vaccination_cards', type: 'other', name: 'Vaccination cards', packSize: 100, stockManaged: true }
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
    res.status(500).json({ message: "Failed to seed catalogue", error: err.message });
  }
});

export default router;
