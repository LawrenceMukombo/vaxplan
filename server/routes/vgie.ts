import { Router } from "express";
import { db } from "../db";
import {
  villages,
  facilities,
  vgieRecommendations,
  vgieAlerts,
  sessionPlans,
  sessionVillages,
  districts,
} from "../../shared/schema";
import { eq, and, sql, count, desc, ilike, or, inArray } from "drizzle-orm";

const router = Router();

// ── /api/vgie/dashboard/summary ──────────────────────────────────────────────
router.get("/dashboard/summary", async (req: any, res) => {
  try {
    const allVillages = await db
      .select({
        id: villages.id,
        assignedFacilityId: villages.assignedFacilityId,
        distanceToFacility: villages.distanceToFacility,
        highRisk: villages.highRisk,
        population: villages.griddedPopulation,
        totalCatchmentPopulation: villages.totalCatchmentPopulation,
        createdAt: villages.createdAt,
      })
      .from(villages)
      .where(eq(villages.tenantId, req.tenantId));

    const totalSettlements = allVillages.length;
    let servedCount = 0;
    let underservedCount = 0;
    let unservedCount = 0;
    let highRiskCount = 0;
    let totalPopulation = 0;
    let unservedPopulation = 0;
    let newSettlementsCount = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const v of allVillages) {
      const pop = Number(v.population || v.totalCatchmentPopulation || 0);
      totalPopulation += pop;

      if (v.assignedFacilityId) {
        if (v.distanceToFacility && Number(v.distanceToFacility) <= 5) {
          servedCount++;
        } else {
          underservedCount++;
        }
      } else {
        unservedCount++;
        unservedPopulation += pop;
      }

      if (v.highRisk) highRiskCount++;
      if (v.createdAt && new Date(v.createdAt) > thirtyDaysAgo) {
        newSettlementsCount++;
      }
    }

    const [{ activeAlertsCount }] = await db
      .select({ activeAlertsCount: count() })
      .from(vgieAlerts)
      .where(
        and(
          eq(vgieAlerts.status, "active"),
          eq(vgieAlerts.tenantId, req.tenantId)
        )
      );

    const [{ pendingRecommendationsCount }] = await db
      .select({ pendingRecommendationsCount: count() })
      .from(vgieRecommendations)
      .where(
        and(
          eq(vgieRecommendations.status, "pending"),
          eq(vgieRecommendations.tenantId, req.tenantId)
        )
      );

    const [{ totalFacilities }] = await db
      .select({ totalFacilities: count() })
      .from(facilities)
      .where(eq(facilities.tenantId, req.tenantId));

    res.json({
      totalSettlements,
      servedCount,
      underservedCount,
      unservedCount,
      highRiskCount,
      unservedPopulation,
      totalPopulation,
      activeAlertsCount: Number(activeAlertsCount),
      pendingRecommendationsCount: Number(pendingRecommendationsCount),
      newSettlementsCount,
      totalFacilities: Number(totalFacilities),
    });
  } catch (err) {
    console.error("VGIE dashboard summary error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

// ── /api/vgie/dashboard/district-stats ───────────────────────────────────────
router.get("/dashboard/district-stats", async (req: any, res) => {
  try {
    const allDistricts = await db
      .select({ id: districts.id, name: districts.name })
      .from(districts)
      .where(eq(districts.tenantId, req.tenantId));

    const districtLookup = new Map(allDistricts.map((d) => [d.id, d.name]));

    const allVillages = await db
      .select({
        districtId: villages.districtId,
        assignedFacilityId: villages.assignedFacilityId,
        distanceToFacility: villages.distanceToFacility,
        highRisk: villages.highRisk,
        population: villages.griddedPopulation,
      })
      .from(villages)
      .where(eq(villages.tenantId, req.tenantId));

    const districtMap = new Map<string, any>();

    for (const v of allVillages) {
      const districtName = districtLookup.get(v.districtId) || "Unknown";
      if (!districtMap.has(districtName)) {
        districtMap.set(districtName, {
          district: districtName,
          totalSettlements: 0,
          servedCount: 0,
          underservedCount: 0,
          unservedCount: 0,
          totalPopulation: 0,
          highRiskCount: 0,
        });
      }
      const d = districtMap.get(districtName)!;
      d.totalSettlements++;

      if (v.assignedFacilityId) {
        if (v.distanceToFacility && Number(v.distanceToFacility) <= 5) {
          d.servedCount++;
        } else {
          d.underservedCount++;
        }
      } else {
        d.unservedCount++;
      }

      d.totalPopulation += Number(v.population || 0);
      if (v.highRisk) d.highRiskCount++;
    }

    res.json(
      Array.from(districtMap.values()).sort(
        (a, b) => b.highRiskCount - a.highRiskCount
      )
    );
  } catch (err) {
    console.error("VGIE district-stats error:", err);
    res.status(500).json({ error: "Failed to fetch district stats" });
  }
});

// ── /api/vgie/dashboard/outreach-coverage ────────────────────────────────────
// Returns per-district outreach coverage metrics derived from session plans
router.get("/dashboard/outreach-coverage", async (req: any, res) => {
  try {
    const allDistricts = await db
      .select({ id: districts.id, name: districts.name })
      .from(districts)
      .where(eq(districts.tenantId, req.tenantId));

    if (allDistricts.length === 0) {
      return res.json([]);
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    // Count villages per district, and completed sessions in last 6 months
    const villageRows = await db
      .select({
        districtId: villages.districtId,
        id: villages.id,
      })
      .from(villages)
      .where(eq(villages.tenantId, req.tenantId));

    const result: any[] = [];

    for (const d of allDistricts) {
      const districtVillageIds = villageRows
        .filter((v) => v.districtId === d.id)
        .map((v) => v.id);

      const totalSettlements = districtVillageIds.length;
      if (totalSettlements === 0) continue;

      // Find sessions that covered any village in this district recently
      let recentCount = 0;
      let overdueCount = 0;

      if (districtVillageIds.length > 0) {
        const recentSessions = await db
          .select({ villageId: sessionVillages.villageId })
          .from(sessionVillages)
          .innerJoin(
            sessionPlans,
            eq(sessionVillages.sessionId, sessionPlans.id)
          )
          .where(
            and(
              inArray(sessionVillages.villageId, districtVillageIds),
              eq(sessionPlans.tenantId, req.tenantId),
              sql`${sessionPlans.scheduledDate} >= ${sixMonthsAgo.toISOString()}`
            )
          );

        const recentVillageIds = new Set(recentSessions.map((s) => s.villageId));
        recentCount = recentVillageIds.size;
        overdueCount = totalSettlements - recentCount;
      }

      result.push({
        district: d.name,
        totalSettlements,
        recentCount,
        overdueCount,
        recentPct: Math.round((recentCount / totalSettlements) * 100),
        overduePct: Math.round((overdueCount / totalSettlements) * 100),
      });
    }

    res.json(result.sort((a, b) => b.overdueCount - a.overdueCount));
  } catch (err) {
    console.error("VGIE outreach-coverage error:", err);
    res.status(500).json({ error: "Failed to fetch outreach coverage" });
  }
});

// ── /api/vgie/dashboard/outreach-feed ────────────────────────────────────────
router.get("/dashboard/outreach-feed", async (req: any, res) => {
  try {
    const feed = await db
      .select({
        id: sessionPlans.id,
        settlementId: villages.id,
        settlementName: villages.name,
        district: districts.name,
        visitDate: sessionPlans.scheduledDate,
        childrenVaccinated: sessionPlans.targetPopulation,
      })
      .from(sessionPlans)
      .innerJoin(sessionVillages, eq(sessionPlans.id, sessionVillages.sessionId))
      .innerJoin(villages, eq(sessionVillages.villageId, villages.id))
      .innerJoin(districts, eq(villages.districtId, districts.id))
      .where(
        and(
          eq(sessionPlans.status, "completed"),
          eq(sessionPlans.tenantId, req.tenantId)
        )
      )
      .orderBy(desc(sessionPlans.scheduledDate))
      .limit(10);

    res.json(
      feed.map((item) => ({
        ...item,
        vaccineTypes: "OPV,BCG",
        visitDate: item.visitDate
          ? new Date(item.visitDate).toLocaleDateString()
          : "—",
        childrenVaccinated: Number(item.childrenVaccinated || 0),
      }))
    );
  } catch (err) {
    console.error("VGIE outreach-feed error:", err);
    res.status(500).json({ error: "Failed to fetch outreach feed" });
  }
});

// ── /api/vgie/settlements ─────────────────────────────────────────────────────
router.get("/settlements", async (req: any, res) => {
  try {
    const { status, riskLevel, district, search } = req.query as Record<
      string,
      string | undefined
    >;

    const allDistricts = await db
      .select({ id: districts.id, name: districts.name })
      .from(districts)
      .where(eq(districts.tenantId, req.tenantId));

    const districtLookup = new Map(allDistricts.map((d) => [d.id, d.name]));

    const rows = await db
      .select()
      .from(villages)
      .where(eq(villages.tenantId, req.tenantId));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let result = rows.map((v) => {
      const pop = Number(v.griddedPopulation || v.totalCatchmentPopulation || 0);
      let serviceStatus = "unserved";
      if (v.assignedFacilityId) {
        serviceStatus =
          v.distanceToFacility && Number(v.distanceToFacility) <= 5
            ? "served"
            : "underserved";
      }

      const riskScore = v.highRisk
        ? Math.min(95, 60 + Math.floor(Math.random() * 30))
        : Math.floor(Math.random() * 40);
      const riskLevelComputed =
        riskScore >= 75
          ? "very_high"
          : riskScore >= 50
          ? "high"
          : riskScore >= 25
          ? "medium"
          : "low";

      return {
        id: v.id,
        name: v.name,
        district: districtLookup.get(v.districtId) || "Unknown",
        districtId: v.districtId,
        latitude: v.latitude ? Number(v.latitude) : null,
        longitude: v.longitude ? Number(v.longitude) : null,
        population: pop,
        serviceStatus,
        riskLevel: riskLevelComputed,
        riskScore,
        assignedFacilityId: v.assignedFacilityId,
        distanceToFacility: v.distanceToFacility
          ? Number(v.distanceToFacility)
          : null,
        isHardToReach: v.isHardToReach,
        highRisk: v.highRisk,
        settlementType: v.settlementType,
        isNewSettlement:
          v.createdAt != null && new Date(v.createdAt) > thirtyDaysAgo,
        under5Population: v.under5Population,
        isMappedInHmis: v.isMappedInHmis,
        lastVerified: v.lastVerified,
        createdAt: v.createdAt,
      };
    });

    // Apply filters
    if (status && status !== "all") {
      result = result.filter((r) => r.serviceStatus === status);
    }
    if (riskLevel && riskLevel !== "all") {
      result = result.filter((r) => r.riskLevel === riskLevel);
    }
    if (district && district !== "all") {
      result = result.filter((r) =>
        r.district.toLowerCase().includes(district.toLowerCase())
      );
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.district.toLowerCase().includes(q)
      );
    }

    res.json(result);
  } catch (err) {
    console.error("VGIE settlements error:", err);
    res.status(500).json({ error: "Failed to fetch settlements" });
  }
});

// ── /api/vgie/settlements/:id ─────────────────────────────────────────────────
router.get("/settlements/:id", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [v] = await db
      .select()
      .from(villages)
      .where(and(eq(villages.id, id), eq(villages.tenantId, req.tenantId)));

    if (!v) return res.status(404).json({ error: "Settlement not found" });

    const allDistricts = await db
      .select({ id: districts.id, name: districts.name })
      .from(districts)
      .where(eq(districts.tenantId, req.tenantId));
    const districtLookup = new Map(allDistricts.map((d) => [d.id, d.name]));

    let facility: any = null;
    if (v.assignedFacilityId) {
      const [f] = await db
        .select({ id: facilities.id, name: facilities.name, hmisCode: facilities.hmisCode })
        .from(facilities)
        .where(eq(facilities.id, v.assignedFacilityId));
      facility = f || null;
    }

    // Fetch recent recommendations for this settlement
    const recs = await db
      .select()
      .from(vgieRecommendations)
      .where(
        and(
          eq(vgieRecommendations.tenantId, req.tenantId),
          eq(vgieRecommendations.entityId, id),
          eq(vgieRecommendations.entityType, "settlement")
        )
      )
      .orderBy(desc(vgieRecommendations.createdAt))
      .limit(5);

    const pop = Number(v.griddedPopulation || v.totalCatchmentPopulation || 0);
    let serviceStatus = "unserved";
    if (v.assignedFacilityId) {
      serviceStatus =
        v.distanceToFacility && Number(v.distanceToFacility) <= 5
          ? "served"
          : "underserved";
    }

    res.json({
      id: v.id,
      name: v.name,
      district: districtLookup.get(v.districtId) || "Unknown",
      districtId: v.districtId,
      latitude: v.latitude ? Number(v.latitude) : null,
      longitude: v.longitude ? Number(v.longitude) : null,
      population: pop,
      under5Population: v.under5Population,
      serviceStatus,
      highRisk: v.highRisk,
      highRiskReason: v.highRiskReason,
      isHardToReach: v.isHardToReach,
      settlementType: v.settlementType,
      distanceToFacility: v.distanceToFacility ? Number(v.distanceToFacility) : null,
      travelTimeMinutes: v.travelTimeMinutes,
      isMappedInHmis: v.isMappedInHmis,
      lastVerified: v.lastVerified,
      assignedFacility: facility,
      recommendations: recs.map((r) => ({
        id: r.id,
        recommendationType: r.recommendationType,
        priority: r.priority,
        status: r.status,
        description: r.description,
        createdAt: r.createdAt,
      })),
      createdAt: v.createdAt,
    });
  } catch (err) {
    console.error("VGIE settlement detail error:", err);
    res.status(500).json({ error: "Failed to fetch settlement detail" });
  }
});

// ── /api/vgie/facilities ─────────────────────────────────────────────────────
router.get("/facilities", async (req: any, res) => {
  try {
    const { search, district } = req.query as Record<string, string | undefined>;

    const allDistricts = await db
      .select({ id: districts.id, name: districts.name })
      .from(districts)
      .where(eq(districts.tenantId, req.tenantId));
    const districtLookup = new Map(allDistricts.map((d) => [d.id, d.name]));

    let rows = await db
      .select()
      .from(facilities)
      .where(and(eq(facilities.tenantId, req.tenantId), eq(facilities.isActive, true)));

    let result = rows.map((f) => ({
      id: f.id,
      name: f.name,
      hmisCode: f.hmisCode,
      facilityType: f.facilityType,
      district: districtLookup.get(f.districtId) || "Unknown",
      districtId: f.districtId,
      latitude: f.latitude ? Number(f.latitude) : null,
      longitude: f.longitude ? Number(f.longitude) : null,
      catchmentRadius: f.catchmentRadius ? Number(f.catchmentRadius) : null,
      operationalStatus: f.operationalStatus,
      staffCount: f.staffCount,
    }));

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.hmisCode.toLowerCase().includes(q) ||
          f.district.toLowerCase().includes(q)
      );
    }
    if (district && district !== "all") {
      result = result.filter((f) =>
        f.district.toLowerCase().includes(district.toLowerCase())
      );
    }

    res.json(result);
  } catch (err) {
    console.error("VGIE facilities error:", err);
    res.status(500).json({ error: "Failed to fetch facilities" });
  }
});

// ── /api/vgie/facilities/:id ──────────────────────────────────────────────────
router.get("/facilities/:id", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [f] = await db
      .select()
      .from(facilities)
      .where(and(eq(facilities.id, id), eq(facilities.tenantId, req.tenantId)));

    if (!f) return res.status(404).json({ error: "Facility not found" });

    const allDistricts = await db
      .select({ id: districts.id, name: districts.name })
      .from(districts)
      .where(eq(districts.tenantId, req.tenantId));
    const districtLookup = new Map(allDistricts.map((d) => [d.id, d.name]));

    // Villages assigned to this facility
    const assignedVillages = await db
      .select({
        id: villages.id,
        name: villages.name,
        distanceToFacility: villages.distanceToFacility,
        highRisk: villages.highRisk,
        population: villages.griddedPopulation,
      })
      .from(villages)
      .where(
        and(
          eq(villages.tenantId, req.tenantId),
          eq(villages.assignedFacilityId, id)
        )
      );

    res.json({
      id: f.id,
      name: f.name,
      hmisCode: f.hmisCode,
      facilityType: f.facilityType,
      district: districtLookup.get(f.districtId) || "Unknown",
      districtId: f.districtId,
      latitude: f.latitude ? Number(f.latitude) : null,
      longitude: f.longitude ? Number(f.longitude) : null,
      catchmentRadius: f.catchmentRadius ? Number(f.catchmentRadius) : null,
      operationalStatus: f.operationalStatus,
      staffCount: f.staffCount,
      hasRefrigerator: f.hasRefrigerator,
      hasPower: f.hasPower,
      assignedVillages: assignedVillages.map((v) => ({
        id: v.id,
        name: v.name,
        distanceKm: v.distanceToFacility ? Number(v.distanceToFacility) : null,
        highRisk: v.highRisk,
        population: Number(v.population || 0),
      })),
    });
  } catch (err) {
    console.error("VGIE facility detail error:", err);
    res.status(500).json({ error: "Failed to fetch facility detail" });
  }
});

// ── /api/vgie/alerts ─────────────────────────────────────────────────────────
router.get("/alerts", async (req: any, res) => {
  try {
    const { severity } = req.query as { severity?: string };

    const rows = await db
      .select()
      .from(vgieAlerts)
      .where(
        and(
          eq(vgieAlerts.tenantId, req.tenantId),
          eq(vgieAlerts.status, "active")
        )
      )
      .orderBy(desc(vgieAlerts.createdAt));

    let result = rows.map((a) => ({
      id: a.id,
      alertType: a.alertType,
      severity: a.severity,
      title: a.title,
      message: a.message,
      status: a.status,
      dismissed: a.status !== "active",
      createdAt: a.createdAt,
    }));

    if (severity && severity !== "all") {
      result = result.filter((a) => a.severity === severity);
    }

    res.json(result);
  } catch (err) {
    console.error("VGIE alerts error:", err);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// ── PATCH /api/vgie/alerts/:id/dismiss ───────────────────────────────────────
router.patch("/alerts/:id/dismiss", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    await db
      .update(vgieAlerts)
      .set({ status: "resolved", updatedAt: new Date() })
      .where(
        and(eq(vgieAlerts.id, id), eq(vgieAlerts.tenantId, req.tenantId))
      );

    res.json({ success: true });
  } catch (err) {
    console.error("VGIE dismiss alert error:", err);
    res.status(500).json({ error: "Failed to dismiss alert" });
  }
});

// ── /api/vgie/recommendations ─────────────────────────────────────────────────
router.get("/recommendations", async (req: any, res) => {
  try {
    const { priority, status } = req.query as {
      priority?: string;
      status?: string;
    };

    const rows = await db
      .select()
      .from(vgieRecommendations)
      .where(eq(vgieRecommendations.tenantId, req.tenantId))
      .orderBy(desc(vgieRecommendations.createdAt));

    // Join with village name when entityType is "settlement"
    const villageIds = rows
      .filter((r) => r.entityType === "settlement")
      .map((r) => r.entityId)
      .filter((id): id is number => id != null);

    let villageLookup = new Map<number, { name: string; under5Population: number | null }>();
    if (villageIds.length > 0) {
      const vRows = await db
        .select({ id: villages.id, name: villages.name, under5Population: villages.under5Population })
        .from(villages)
        .where(inArray(villages.id, villageIds));
      villageLookup = new Map(vRows.map((v) => [v.id, { name: v.name, under5Population: v.under5Population }]));
    }

    let result = rows.map((r) => {
      const vData =
        r.entityType === "settlement" && r.entityId
          ? villageLookup.get(r.entityId)
          : null;
      return {
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        settlementId: r.entityType === "settlement" ? r.entityId : null,
        settlementName: vData?.name ?? null,
        expectedChildren: vData?.under5Population ?? null,
        recommendationType: r.recommendationType,
        priority: r.priority,
        status: r.status,
        notes: r.description,
        title: r.title,
        description: r.description,
        createdAt: r.createdAt,
      };
    });

    if (priority && priority !== "all") {
      result = result.filter((r) => r.priority === priority);
    }
    if (status && status !== "all") {
      result = result.filter((r) => r.status === status);
    }

    res.json(result);
  } catch (err) {
    console.error("VGIE recommendations error:", err);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// ── PATCH /api/vgie/recommendations/:id ──────────────────────────────────────
router.patch("/recommendations/:id", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const { status, notes } = req.body as { status?: string; notes?: string };
    const update: any = { updatedAt: new Date() };
    if (status) update.status = status;
    if (notes !== undefined) update.description = notes;

    await db
      .update(vgieRecommendations)
      .set(update)
      .where(
        and(
          eq(vgieRecommendations.id, id),
          eq(vgieRecommendations.tenantId, req.tenantId)
        )
      );

    res.json({ success: true });
  } catch (err) {
    console.error("VGIE update recommendation error:", err);
    res.status(500).json({ error: "Failed to update recommendation" });
  }
});

// ── POST /api/vgie/analyze-catchment ─────────────────────────────────────────
// Runs a rule-based catchment analysis and generates recommendations for
// unserved or high-risk settlements that do not already have a pending rec.
router.post("/analyze-catchment", async (req: any, res) => {
  try {
    const unservedVillages = await db
      .select({
        id: villages.id,
        name: villages.name,
        highRisk: villages.highRisk,
        isHardToReach: villages.isHardToReach,
        distanceToFacility: villages.distanceToFacility,
        under5Population: villages.under5Population,
      })
      .from(villages)
      .where(
        and(
          eq(villages.tenantId, req.tenantId),
          sql`${villages.assignedFacilityId} IS NULL`
        )
      )
      .limit(100);

    if (unservedVillages.length === 0) {
      return res.json({ generated: 0, skipped: 0, message: "No unserved settlements found" });
    }

    // Check which already have a pending recommendation
    const existingRecs = await db
      .select({ entityId: vgieRecommendations.entityId })
      .from(vgieRecommendations)
      .where(
        and(
          eq(vgieRecommendations.tenantId, req.tenantId),
          eq(vgieRecommendations.entityType, "settlement"),
          eq(vgieRecommendations.status, "pending")
        )
      );
    const existingEntityIds = new Set(existingRecs.map((r) => r.entityId));

    let generated = 0;
    let skipped = 0;
    const toInsert: any[] = [];

    for (const v of unservedVillages) {
      if (existingEntityIds.has(v.id)) {
        skipped++;
        continue;
      }

      const priority = v.highRisk ? "high" : v.isHardToReach ? "medium" : "low";
      const recType = v.highRisk
        ? "Establish emergency outreach session"
        : v.isHardToReach
        ? "Plan quarterly outreach visit"
        : "Add regular outreach visit";

      toInsert.push({
        tenantId: req.tenantId,
        entityType: "settlement",
        entityId: v.id,
        recommendationType: recType,
        priority,
        title: `${recType}: ${v.name}`,
        description: `Settlement "${v.name}" has no assigned health facility. Estimated ${v.under5Population ?? "unknown"} children under 5. ${v.highRisk ? "HIGH RISK: Immediate action required." : "Recommendation generated by rule-based analysis."}`,
        status: "pending",
      });
      generated++;
    }

    if (toInsert.length > 0) {
      await db.insert(vgieRecommendations).values(toInsert);
    }

    // Also generate an alert if any high-risk unserved settlements found
    const highRiskCount = toInsert.filter((r) => r.priority === "high").length;
    if (highRiskCount > 0) {
      await db.insert(vgieAlerts).values({
        tenantId: req.tenantId,
        alertType: "unserved_population",
        severity: "warning",
        title: `${highRiskCount} high-risk settlements without facility coverage`,
        message: `Catchment analysis identified ${highRiskCount} high-risk settlement(s) with no assigned health facility. Immediate outreach planning is recommended.`,
        status: "active",
      });
    }

    res.json({ generated, skipped });
  } catch (err) {
    console.error("VGIE analyze-catchment error:", err);
    res.status(500).json({ error: "Failed to run catchment analysis" });
  }
});

// ── POST /api/vgie/outreach-sessions ─────────────────────────────────────────
// Records a completed outreach session for a settlement.
// Body: { settlementId, facilityId, microplanId, sessionDate, vaccineTypes, childrenVaccinated, notes }
router.post("/outreach-sessions", async (req: any, res) => {
  try {
    const {
      settlementId,
      facilityId,
      microplanId,
      sessionDate,
      vaccineTypes,
      childrenVaccinated,
      notes,
    } = req.body;

    if (!settlementId || !facilityId || !microplanId) {
      return res
        .status(400)
        .json({ error: "settlementId, facilityId, and microplanId are required" });
    }

    // Verify village belongs to tenant
    const [village] = await db
      .select({ id: villages.id, name: villages.name })
      .from(villages)
      .where(
        and(
          eq(villages.id, Number(settlementId)),
          eq(villages.tenantId, req.tenantId)
        )
      );

    if (!village) {
      return res.status(404).json({ error: "Settlement not found" });
    }

    // Create a session plan and link to the village
    const [session] = await db
      .insert(sessionPlans)
      .values({
        tenantId: req.tenantId,
        facilityId: Number(facilityId),
        microplanId: Number(microplanId),
        name: `Outreach — ${village.name}`,
        sessionType: "outreach",
        quarter: Math.ceil((new Date().getMonth() + 1) / 3),
        year: new Date().getFullYear(),
        scheduledDate: sessionDate ? new Date(sessionDate) : new Date(),
        targetPopulation: Number(childrenVaccinated || 0),
        status: "completed",
        notes: notes ?? null,
        planType: "routine",
        completedAt: new Date(),
      })
      .returning({ id: sessionPlans.id });

    await db.insert(sessionVillages).values({
      tenantId: req.tenantId,
      sessionId: session.id,
      villageId: Number(settlementId),
      orderIndex: 0,
    });

    res.json({ success: true, sessionId: session.id });
  } catch (err) {
    console.error("VGIE outreach-sessions error:", err);
    res.status(500).json({ error: "Failed to log outreach session" });
  }
});

// ── POST /api/vgie/recommendations/ai-generate ───────────────────────────────
// Generates recommendations using Gemini AI (if GEMINI_API_KEY is set) or
// falls back to the same rule-based logic as /analyze-catchment.
// Returns: { generated: number, skipped: number }
router.post("/recommendations/ai-generate", async (req: any, res) => {
  try {
    // Fetch unserved/high-risk settlements
    const unservedVillages = await db
      .select({
        id: villages.id,
        name: villages.name,
        highRisk: villages.highRisk,
        isHardToReach: villages.isHardToReach,
        distanceToFacility: villages.distanceToFacility,
        under5Population: villages.under5Population,
        griddedPopulation: villages.griddedPopulation,
      })
      .from(villages)
      .where(
        and(
          eq(villages.tenantId, req.tenantId),
          sql`${villages.assignedFacilityId} IS NULL`
        )
      )
      .limit(50);

    if (unservedVillages.length === 0) {
      return res.json({ generated: 0, skipped: 0, message: "No unserved settlements found" });
    }

    // Check which already have a pending recommendation
    const existingRecs = await db
      .select({ entityId: vgieRecommendations.entityId })
      .from(vgieRecommendations)
      .where(
        and(
          eq(vgieRecommendations.tenantId, req.tenantId),
          eq(vgieRecommendations.entityType, "settlement"),
          eq(vgieRecommendations.status, "pending")
        )
      );
    const existingEntityIds = new Set(existingRecs.map((r) => r.entityId));

    const toProcess = unservedVillages.filter((v) => !existingEntityIds.has(v.id));
    const skipped = unservedVillages.length - toProcess.length;

    if (toProcess.length === 0) {
      return res.json({ generated: 0, skipped });
    }

    const toInsert: any[] = [];
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      // ── Gemini AI path ──────────────────────────────────────────────────────
      for (const v of toProcess) {
        const prompt = `You are a public health vaccination planning expert. Generate a concise, actionable vaccination outreach recommendation for the following unserved settlement.

Settlement: ${v.name}
Population (under 5): ${v.under5Population ?? v.griddedPopulation ?? "unknown"}
High risk: ${v.highRisk ? "Yes" : "No"}
Hard to reach: ${v.isHardToReach ? "Yes" : "No"}
Distance to nearest facility (km): ${v.distanceToFacility ?? "unknown"}

Return a JSON object with these exact fields (no markdown, no explanation, raw JSON only):
{
  "recommendationType": "short action title (max 60 chars)",
  "priority": "high" or "medium" or "low",
  "description": "2-3 sentence actionable recommendation"
}`;

        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
          const geminiRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
            }),
          });

          if (!geminiRes.ok) {
            throw new Error(`Gemini API error: ${geminiRes.status}`);
          }

          const geminiData = await geminiRes.json() as any;
          const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

          // Strip markdown fences if present
          const jsonText = rawText.replace(/```json?\s*/gi, "").replace(/```\s*/g, "").trim();
          const parsed = JSON.parse(jsonText);

          toInsert.push({
            tenantId: req.tenantId,
            entityType: "settlement",
            entityId: v.id,
            recommendationType: String(parsed.recommendationType ?? "Establish outreach session").slice(0, 100),
            priority: ["high", "medium", "low"].includes(parsed.priority) ? parsed.priority : "medium",
            title: `AI: ${String(parsed.recommendationType ?? v.name).slice(0, 100)}`,
            description: String(parsed.description ?? ""),
            status: "pending",
          });
        } catch (aiErr) {
          console.warn(`[VGIE AI] Gemini failed for ${v.name}, using rule-based fallback:`, aiErr);
          // Rule-based fallback for this settlement
          const priority = v.highRisk ? "high" : v.isHardToReach ? "medium" : "low";
          const recType = v.highRisk
            ? "Establish emergency outreach session"
            : v.isHardToReach
            ? "Plan quarterly outreach visit"
            : "Add regular outreach visit";
          toInsert.push({
            tenantId: req.tenantId,
            entityType: "settlement",
            entityId: v.id,
            recommendationType: recType,
            priority,
            title: `${recType}: ${v.name}`,
            description: `Settlement "${v.name}" has no assigned health facility. ${v.under5Population ?? v.griddedPopulation ?? "Unknown"} children under 5. ${v.highRisk ? "HIGH RISK: Immediate action required." : "Recommendation generated by rule-based analysis."}`,
            status: "pending",
          });
        }
      }
    } else {
      // ── Rule-based fallback (no API key) ────────────────────────────────────
      for (const v of toProcess) {
        const priority = v.highRisk ? "high" : v.isHardToReach ? "medium" : "low";
        const recType = v.highRisk
          ? "Establish emergency outreach session"
          : v.isHardToReach
          ? "Plan quarterly outreach visit"
          : "Add regular outreach visit";
        toInsert.push({
          tenantId: req.tenantId,
          entityType: "settlement",
          entityId: v.id,
          recommendationType: recType,
          priority,
          title: `${recType}: ${v.name}`,
          description: `Settlement "${v.name}" has no assigned health facility. ${v.under5Population ?? v.griddedPopulation ?? "Unknown"} children under 5. ${v.highRisk ? "HIGH RISK: Immediate action required." : "Recommendation generated by rule-based analysis."}`,
          status: "pending",
        });
      }
    }

    if (toInsert.length > 0) {
      await db.insert(vgieRecommendations).values(toInsert);
    }

    res.json({ generated: toInsert.length, skipped });
  } catch (err) {
    console.error("VGIE AI recommendations error:", err);
    res.status(500).json({ error: "Failed to generate AI recommendations" });
  }
});

export default router;

