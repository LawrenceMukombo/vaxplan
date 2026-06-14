import { Router } from "express";
import { db } from "../db";
import {
  villages,
  facilities,
  vgieRecommendations,
  vgieAlerts,
  sessionPlans,
  sessionVillages,
  districts
} from "../../shared/schema";
import { eq, and, sql, count, desc, inArray } from "drizzle-orm";

const router = Router();

// /api/vgie/dashboard/summary
router.get("/dashboard/summary", async (req: any, res) => {
  try {
    const allVillages = await db.select({
      id: villages.id,
      assignedFacilityId: villages.assignedFacilityId,
      distanceToFacility: villages.distanceToFacility,
      highRisk: villages.highRisk,
      population: villages.griddedPopulation,
      totalCatchmentPopulation: villages.totalCatchmentPopulation,
      createdAt: villages.createdAt,
    }).from(villages).where(
      and(
        eq(villages.tenantId, req.tenantId),
        sql`CAST(latitude AS numeric) BETWEEN -18.5 AND -8.0`,
        sql`CAST(longitude AS numeric) BETWEEN 21.5 AND 34.0`
      )
    );

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

      let status = "unserved";
      if (v.assignedFacilityId) {
        if (v.distanceToFacility && Number(v.distanceToFacility) <= 5) {
          status = "served";
          servedCount++;
        } else {
          status = "underserved";
          underservedCount++;
        }
      } else {
        status = "unserved";
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
      .where(and(eq(vgieAlerts.status, "active"), eq(vgieAlerts.tenantId, req.tenantId)));

    const [{ pendingRecommendationsCount }] = await db
      .select({ pendingRecommendationsCount: count() })
      .from(vgieRecommendations)
      .where(and(eq(vgieRecommendations.status, "pending"), eq(vgieRecommendations.tenantId, req.tenantId)));

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
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

router.get("/dashboard/district-stats", async (req: any, res) => {
  try {
    const allDistricts = await db.select({
      id: districts.id,
      name: districts.name
    }).from(districts).where(eq(districts.tenantId, req.tenantId));
    
    const districtLookup = new Map(allDistricts.map(d => [d.id, d.name]));

    const allVillages = await db.select({
      districtId: villages.districtId,
      assignedFacilityId: villages.assignedFacilityId,
      distanceToFacility: villages.distanceToFacility,
      highRisk: villages.highRisk,
      population: villages.griddedPopulation,
    }).from(villages).where(eq(villages.tenantId, req.tenantId));

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
        if (v.distanceToFacility && Number(v.distanceToFacility) <= 5) d.servedCount++;
        else d.underservedCount++;
      } else {
        d.unservedCount++;
      }
      
      d.totalPopulation += Number(v.population || 0);
      if (v.highRisk) d.highRiskCount++;
    }

    res.json(Array.from(districtMap.values()).sort((a, b) => b.highRiskCount - a.highRiskCount));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch district stats" });
  }
});

router.get("/dashboard/outreach-coverage", async (req, res) => {
  res.json([]);
});

router.get("/dashboard/outreach-feed", async (req: any, res) => {
  try {
    const feed = await db
      .select({
        id: sessionPlans.id,
        settlementName: villages.name,
        district: districts.name,
        visitDate: sessionPlans.scheduledDate,
        vaccineTypes: sql<string[]>`ARRAY['OPV', 'BCG']`, // Mock array since sessionPlans doesn't store this directly yet
        childrenVaccinated: sessionPlans.targetPopulation,
      })
      .from(sessionPlans)
      .innerJoin(sessionVillages, eq(sessionPlans.id, sessionVillages.sessionId))
      .innerJoin(villages, eq(sessionVillages.villageId, villages.id))
      .innerJoin(districts, eq(villages.districtId, districts.id))
      .where(and(eq(sessionPlans.status, "completed"), eq(sessionPlans.tenantId, req.tenantId)))
      .orderBy(desc(sessionPlans.scheduledDate))
      .limit(10);

    res.json(feed);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch outreach feed" });
  }
});

router.get("/alerts", async (req: any, res) => {
  try {
    const alerts = await db.select().from(vgieAlerts).where(eq(vgieAlerts.tenantId, req.tenantId)).orderBy(desc(vgieAlerts.createdAt));
    // map fields
    res.json(alerts.map(a => ({
      id: a.id,
      type: a.alertType,
      severity: a.severity,
      title: a.title,
      message: a.message,
      dismissed: a.status !== "active",
      createdAt: a.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.get("/recommendations", async (req: any, res) => {
  try {
    const recs = await db.select().from(vgieRecommendations).where(eq(vgieRecommendations.tenantId, req.tenantId)).orderBy(desc(vgieRecommendations.createdAt));
    res.json(recs.map(r => ({
      id: r.id,
      type: r.recommendationType,
      priority: r.priority,
      title: r.title,
      description: r.description,
      status: r.status,
      targetId: r.entityId,
      createdAt: r.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

export default router;
