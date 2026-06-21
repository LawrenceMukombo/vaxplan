import { Router } from "express";
import { db } from "../db";
import { VgieService } from "../services/vgieService";
import {
  villages,
  facilities,
  vgieRecommendations,
  vgieAlerts,
  sessionPlans,
  sessionVillages,
  districts,
  provinces,
  vgieRecommendationRules,
  vgieAlertRules,
} from "../../shared/schema";
import { eq, and, sql, count, desc, asc, ilike, or, inArray } from "drizzle-orm";

const router = Router();

// ── /api/vgie/dashboard/summary ──────────────────────────────────────────────
router.get("/dashboard/summary", async (req: any, res) => {
  try {
    const { provinceId, districtId, facilityId } = req.query as Record<string, string | undefined>;

    const allDistricts = await db
      .select({ id: districts.id, provinceId: districts.provinceId })
      .from(districts)
      .where(eq(districts.tenantId, req.tenantId));
    const districtProvinceMap = new Map(allDistricts.map(d => [d.id, d.provinceId]));

    const villageConditions = [eq(villages.tenantId, req.tenantId)];
    if (facilityId && facilityId !== "all") {
      villageConditions.push(eq(villages.assignedFacilityId, Number(facilityId)));
    }
    if (districtId && districtId !== "all") {
      villageConditions.push(eq(villages.districtId, Number(districtId)));
    }
    if (provinceId && provinceId !== "all") {
      villageConditions.push(eq(districts.provinceId, Number(provinceId)));
    }

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
      .leftJoin(districts, eq(villages.districtId, districts.id))
      .where(and(...villageConditions));

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

    const alertsRows = await db
      .select({
        id: vgieAlerts.id,
        villageId: vgieAlerts.villageId,
        facilityId: vgieAlerts.facilityId,
        villageDistrictId: villages.districtId,
        villageAssignedFacilityId: villages.assignedFacilityId,
        facilityDistrictId: facilities.districtId,
      })
      .from(vgieAlerts)
      .leftJoin(villages, eq(vgieAlerts.villageId, villages.id))
      .leftJoin(facilities, eq(vgieAlerts.facilityId, facilities.id))
      .where(
        and(
          eq(vgieAlerts.status, "active"),
          eq(vgieAlerts.tenantId, req.tenantId)
        )
      );

    let filteredAlerts = alertsRows;
    if (facilityId && facilityId !== "all") {
      const fId = Number(facilityId);
      filteredAlerts = filteredAlerts.filter(r => 
        r.facilityId === fId || 
        r.villageAssignedFacilityId === fId
      );
    }
    if (districtId && districtId !== "all") {
      const dId = Number(districtId);
      filteredAlerts = filteredAlerts.filter(r => 
        r.villageDistrictId === dId || 
        r.facilityDistrictId === dId
      );
    }
    if (provinceId && provinceId !== "all") {
      const pId = Number(provinceId);
      filteredAlerts = filteredAlerts.filter(r => {
        const vdId = r.villageDistrictId;
        const fdId = r.facilityDistrictId;
        return (vdId && districtProvinceMap.get(vdId) === pId) || 
               (fdId && districtProvinceMap.get(fdId) === pId);
      });
    }
    const activeAlertsCount = filteredAlerts.length;

    const recsRows = await db
      .select({
        id: vgieRecommendations.id,
        entityType: vgieRecommendations.entityType,
        entityId: vgieRecommendations.entityId,
      })
      .from(vgieRecommendations)
      .where(
        and(
          eq(vgieRecommendations.status, "pending"),
          eq(vgieRecommendations.tenantId, req.tenantId)
        )
      );

    // Resolve recommendation scopes:
    const recVillageIds = recsRows.filter(r => r.entityType === "settlement").map(r => r.entityId);
    let recVillagesLookup = new Map<number, { districtId: number; assignedFacilityId: number | null }>();
    if (recVillageIds.length > 0) {
      const vRecRows = await db
        .select({ id: villages.id, districtId: villages.districtId, assignedFacilityId: villages.assignedFacilityId })
        .from(villages)
        .where(inArray(villages.id, recVillageIds));
      recVillagesLookup = new Map(vRecRows.map(v => [v.id, v]));
    }

    const recFacilityIds = recsRows.filter(r => r.entityType === "facility").map(r => r.entityId);
    let recFacilitiesLookup = new Map<number, { districtId: number }>();
    if (recFacilityIds.length > 0) {
      const fRecRows = await db
        .select({ id: facilities.id, districtId: facilities.districtId })
        .from(facilities)
        .where(inArray(facilities.id, recFacilityIds));
      recFacilitiesLookup = new Map(fRecRows.map(f => [f.id, f]));
    }

    const recSessionIds = recsRows.filter(r => r.entityType === "session").map(r => r.entityId);
    let recSessionsLookup = new Map<number, { facilityId: number; districtId: number }>();
    if (recSessionIds.length > 0) {
      const sRecRows = await db
        .select({ id: sessionPlans.id, facilityId: sessionPlans.facilityId, districtId: facilities.districtId })
        .from(sessionPlans)
        .innerJoin(facilities, eq(sessionPlans.facilityId, facilities.id))
        .where(inArray(sessionPlans.id, recSessionIds));
      recSessionsLookup = new Map(sRecRows.map(s => [s.id, s]));
    }

    let filteredRecs = recsRows;
    if (facilityId && facilityId !== "all") {
      const fId = Number(facilityId);
      filteredRecs = filteredRecs.filter(r => {
        if (r.entityType === "settlement") return recVillagesLookup.get(r.entityId)?.assignedFacilityId === fId;
        if (r.entityType === "facility") return r.entityId === fId;
        if (r.entityType === "session") return recSessionsLookup.get(r.entityId)?.facilityId === fId;
        return false;
      });
    }
    if (districtId && districtId !== "all") {
      const dId = Number(districtId);
      filteredRecs = filteredRecs.filter(r => {
        if (r.entityType === "settlement") return recVillagesLookup.get(r.entityId)?.districtId === dId;
        if (r.entityType === "facility") return recFacilitiesLookup.get(r.entityId)?.districtId === dId;
        if (r.entityType === "session") return recSessionsLookup.get(r.entityId)?.districtId === dId;
        return false;
      });
    }
    if (provinceId && provinceId !== "all") {
      const pId = Number(provinceId);
      filteredRecs = filteredRecs.filter(r => {
        let dId: number | undefined;
        if (r.entityType === "settlement") dId = recVillagesLookup.get(r.entityId)?.districtId;
        else if (r.entityType === "facility") dId = recFacilitiesLookup.get(r.entityId)?.districtId;
        else if (r.entityType === "session") dId = recSessionsLookup.get(r.entityId)?.districtId;
        return dId ? districtProvinceMap.get(dId) === pId : false;
      });
    }
    const pendingRecommendationsCount = filteredRecs.length;

    const facilityConditions = [eq(facilities.tenantId, req.tenantId)];
    if (facilityId && facilityId !== "all") {
      facilityConditions.push(eq(facilities.id, Number(facilityId)));
    }
    if (districtId && districtId !== "all") {
      facilityConditions.push(eq(facilities.districtId, Number(districtId)));
    }
    if (provinceId && provinceId !== "all") {
      facilityConditions.push(eq(districts.provinceId, Number(provinceId)));
    }

    const [{ totalFacilities }] = await db
      .select({ totalFacilities: count() })
      .from(facilities)
      .leftJoin(districts, eq(facilities.districtId, districts.id))
      .where(and(...facilityConditions));

    res.json({
      totalSettlements,
      servedCount,
      underservedCount,
      unservedCount,
      highRiskCount,
      unservedPopulation,
      totalPopulation,
      activeAlertsCount,
      pendingRecommendationsCount,
      newSettlementsCount,
      totalFacilities: Number(totalFacilities),
    });
  } catch (err) {
    console.error("VGIE dashboard summary error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

// ── /api/vgie/dashboard/district-stats ───────────────────────────────────────
// ── /api/vgie/dashboard/district-stats ───────────────────────────────────────
router.get("/dashboard/district-stats", async (req: any, res) => {
  try {
    const { provinceId, districtId, facilityId } = req.query as Record<string, string | undefined>;

    const districtConditions = [eq(districts.tenantId, req.tenantId)];
    if (provinceId && provinceId !== "all") {
      districtConditions.push(eq(districts.provinceId, Number(provinceId)));
    }
    if (districtId && districtId !== "all") {
      districtConditions.push(eq(districts.id, Number(districtId)));
    }

    const allDistricts = await db
      .select({ id: districts.id, name: districts.name })
      .from(districts)
      .where(and(...districtConditions));

    const districtLookup = new Map(allDistricts.map((d) => [d.id, d.name]));

    const villageConditions = [eq(villages.tenantId, req.tenantId)];
    if (facilityId && facilityId !== "all") {
      villageConditions.push(eq(villages.assignedFacilityId, Number(facilityId)));
    }
    if (districtId && districtId !== "all") {
      villageConditions.push(eq(villages.districtId, Number(districtId)));
    }
    if (provinceId && provinceId !== "all") {
      villageConditions.push(eq(districts.provinceId, Number(provinceId)));
    }

    const allVillages = await db
      .select({
        id: villages.id,
        name: villages.name,
        districtId: villages.districtId,
        assignedFacilityId: villages.assignedFacilityId,
        distanceToFacility: villages.distanceToFacility,
        highRisk: villages.highRisk,
        population: villages.griddedPopulation,
      })
      .from(villages)
      .leftJoin(districts, eq(villages.districtId, districts.id))
      .where(and(...villageConditions));

    // Case 1: Facility is selected -> show individual communities/settlements assigned to this facility
    if (facilityId && facilityId !== "all") {
      const result = allVillages.map((v) => {
        const isServed = v.assignedFacilityId && v.distanceToFacility && Number(v.distanceToFacility) <= 5;
        return {
          district: v.name, // using 'district' as key
          totalSettlements: 1,
          servedCount: isServed ? 1 : 0,
          underservedCount: (v.assignedFacilityId && !isServed) ? 1 : 0,
          unservedCount: !v.assignedFacilityId ? 1 : 0,
          totalPopulation: Number(v.population || 0),
          highRiskCount: v.highRisk ? 1 : 0,
        };
      });
      return res.json(result);
    }

    // Case 2: District is selected -> show stats grouped by health facility inside the selected district
    if (districtId && districtId !== "all") {
      const allFacilities = await db
        .select({ id: facilities.id, name: facilities.name })
        .from(facilities)
        .where(
          and(
            eq(facilities.tenantId, req.tenantId),
            eq(facilities.districtId, Number(districtId)),
            eq(facilities.isActive, true)
          )
        );
      const facilityLookup = new Map(allFacilities.map((f) => [f.id, f.name]));

      const groupMap = new Map<string, any>();
      for (const f of allFacilities) {
        groupMap.set(f.name, {
          district: f.name, // using 'district' as key
          totalSettlements: 0,
          servedCount: 0,
          underservedCount: 0,
          unservedCount: 0,
          totalPopulation: 0,
          highRiskCount: 0,
        });
      }
      groupMap.set("Unassigned", {
        district: "Unassigned",
        totalSettlements: 0,
        servedCount: 0,
        underservedCount: 0,
        unservedCount: 0,
        totalPopulation: 0,
        highRiskCount: 0,
      });

      for (const v of allVillages) {
        const facilityName = v.assignedFacilityId
          ? (facilityLookup.get(v.assignedFacilityId) || "Unknown Facility")
          : "Unassigned";

        if (!groupMap.has(facilityName)) {
          groupMap.set(facilityName, {
            district: facilityName,
            totalSettlements: 0,
            servedCount: 0,
            underservedCount: 0,
            unservedCount: 0,
            totalPopulation: 0,
            highRiskCount: 0,
          });
        }
        const entry = groupMap.get(facilityName)!;
        entry.totalSettlements++;

        if (v.assignedFacilityId) {
          if (v.distanceToFacility && Number(v.distanceToFacility) <= 5) {
            entry.servedCount++;
          } else {
            entry.underservedCount++;
          }
        } else {
          entry.unservedCount++;
        }
        entry.totalPopulation += Number(v.population || 0);
        if (v.highRisk) entry.highRiskCount++;
      }

      // Clean up empty entries
      for (const [key, val] of Array.from(groupMap.entries())) {
        if (val.totalSettlements === 0) {
          groupMap.delete(key);
        }
      }

      return res.json(
        Array.from(groupMap.values()).sort(
          (a, b) => b.highRiskCount - a.highRiskCount
        )
      );
    }

    // Case 3: Country or Province level -> group by district name
    const districtMap = new Map<string, any>();

    for (const v of allVillages) {
      const districtName = districtLookup.get(v.districtId) || "Unknown";
      if (districtName === "Unknown" && (provinceId || districtId)) {
        // If filtering by region/district, skip any that didn't match the selected region
        continue;
      }
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
    const { provinceId, districtId, facilityId } = req.query as Record<string, string | undefined>;

    const districtConditions = [eq(districts.tenantId, req.tenantId)];
    if (provinceId && provinceId !== "all") {
      districtConditions.push(eq(districts.provinceId, Number(provinceId)));
    }
    if (districtId && districtId !== "all") {
      districtConditions.push(eq(districts.id, Number(districtId)));
    }

    const allDistricts = await db
      .select({ id: districts.id, name: districts.name })
      .from(districts)
      .where(and(...districtConditions));

    if (allDistricts.length === 0) {
      return res.json([]);
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const villageConditions = [eq(villages.tenantId, req.tenantId)];
    if (facilityId && facilityId !== "all") {
      villageConditions.push(eq(villages.assignedFacilityId, Number(facilityId)));
    }
    if (districtId && districtId !== "all") {
      villageConditions.push(eq(villages.districtId, Number(districtId)));
    }
    if (provinceId && provinceId !== "all") {
      villageConditions.push(eq(districts.provinceId, Number(provinceId)));
    }

    const villageRows = await db
      .select({
        districtId: villages.districtId,
        id: villages.id,
      })
      .from(villages)
      .leftJoin(districts, eq(villages.districtId, districts.id))
      .where(and(...villageConditions));

    const result: any[] = [];

    for (const d of allDistricts) {
      const districtVillageIds = villageRows
        .filter((v) => v.districtId === d.id)
        .map((v) => v.id);

      const totalSettlements = districtVillageIds.length;
      if (totalSettlements === 0) continue;

      let recentCount = 0;
      let overdueCount = 0;

      if (districtVillageIds.length > 0) {
        const sessionConditions = [
          inArray(sessionVillages.villageId, districtVillageIds),
          eq(sessionPlans.tenantId, req.tenantId),
          sql`${sessionPlans.scheduledDate} >= ${sixMonthsAgo.toISOString()}`
        ];
        if (facilityId && facilityId !== "all") {
          sessionConditions.push(eq(sessionPlans.facilityId, Number(facilityId)));
        }

        const recentSessions = await db
          .select({ villageId: sessionVillages.villageId })
          .from(sessionVillages)
          .innerJoin(
            sessionPlans,
            eq(sessionVillages.sessionId, sessionPlans.id)
          )
          .where(and(...sessionConditions));

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
    const { provinceId, districtId, facilityId } = req.query as Record<string, string | undefined>;

    const conditions = [
      eq(sessionPlans.status, "completed"),
      eq(sessionPlans.tenantId, req.tenantId)
    ];

    if (facilityId && facilityId !== "all") {
      conditions.push(eq(sessionPlans.facilityId, Number(facilityId)));
    }
    if (districtId && districtId !== "all") {
      conditions.push(eq(villages.districtId, Number(districtId)));
    }
    if (provinceId && provinceId !== "all") {
      conditions.push(eq(districts.provinceId, Number(provinceId)));
    }

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
      .where(and(...conditions))
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
    const {
      page = "1",
      pageSize = "25",
      search = "",
      provinceId = "",
      districtId = "",
      facilityId = "",
      status = "",
      risk = "",
      sortBy = "name",
      sortOrder = "asc"
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, Number(page || 1));
    const sizeNum = Math.max(1, Math.min(100, Number(pageSize || 25)));
    const offset = (pageNum - 1) * sizeNum;

    // Build conditions array
    const conditions: any[] = [eq(villages.tenantId, req.tenantId)];

    // 1. Status Filter
    if (status && status !== "all") {
      if (status === "served") {
        conditions.push(
          and(
            sql`${villages.assignedFacilityId} IS NOT NULL`,
            sql`${villages.distanceToFacility} <= 5`
          )
        );
      } else if (status === "underserved") {
        conditions.push(
          and(
            sql`${villages.assignedFacilityId} IS NOT NULL`,
            or(
              sql`${villages.distanceToFacility} > 5`,
              sql`${villages.distanceToFacility} IS NULL`
            )
          )
        );
      } else if (status === "unserved") {
        conditions.push(sql`${villages.assignedFacilityId} IS NULL`);
      }
    }

    // 2. Risk Level Filter (based on deterministic risk score computation)
    // riskScore = CASE WHEN highRisk = true THEN 60 + (id % 31) ELSE id % 40 END
    if (risk && risk !== "all") {
      const riskScoreSql = sql`(CASE WHEN ${villages.highRisk} = true THEN 60 + (${villages.id} % 31) ELSE ${villages.id} % 40 END)`;
      if (risk === "very_high") {
        conditions.push(sql`${riskScoreSql} >= 75`);
      } else if (risk === "high") {
        conditions.push(sql`${riskScoreSql} >= 50 AND ${riskScoreSql} < 75`);
      } else if (risk === "medium") {
        conditions.push(sql`${riskScoreSql} >= 25 AND ${riskScoreSql} < 50`);
      } else if (risk === "low") {
        conditions.push(sql`${riskScoreSql} < 25`);
      }
    }

    // 3. Location Filters
    if (provinceId && provinceId !== "all") {
      conditions.push(eq(districts.provinceId, Number(provinceId)));
    }
    if (districtId && districtId !== "all") {
      conditions.push(eq(villages.districtId, Number(districtId)));
    }
    if (facilityId && facilityId !== "all") {
      conditions.push(eq(villages.assignedFacilityId, Number(facilityId)));
    }

    // 4. Search Filter
    if (search) {
      const q = `%${search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(villages.name, q),
          ilike(districts.name, q),
          ilike(villages.code, q)
        )
      );
    }

    // Determine Sort Field
    let orderByField: any = villages.name;
    if (sortBy === "province") {
      orderByField = provinces.name;
    } else if (sortBy === "district") {
      orderByField = districts.name;
    } else if (sortBy === "facility") {
      orderByField = facilities.name;
    } else if (sortBy === "population") {
      orderByField = sql`COALESCE(${villages.griddedPopulation}, ${villages.totalCatchmentPopulation}, 0)`;
    } else if (sortBy === "riskScore") {
      orderByField = sql`CASE WHEN ${villages.highRisk} = true THEN 60 + (${villages.id} % 31) ELSE ${villages.id} % 40 END`;
    }

    const sortOrderFunc = sortOrder === "desc" ? desc(orderByField) : asc(orderByField);

    // Dynamic Select lightweight columns (excluding boundary / catchmentPolygon)
    const selectColumns = {
      id: villages.id,
      name: villages.name,
      code: villages.code,
      districtId: villages.districtId,
      districtName: districts.name,
      provinceId: districts.provinceId,
      provinceName: provinces.name,
      assignedFacilityId: villages.assignedFacilityId,
      facilityName: facilities.name,
      latitude: villages.latitude,
      longitude: villages.longitude,
      griddedPopulation: villages.griddedPopulation,
      totalCatchmentPopulation: villages.totalCatchmentPopulation,
      distanceToFacility: villages.distanceToFacility,
      isHardToReach: villages.isHardToReach,
      highRisk: villages.highRisk,
      settlementType: villages.settlementType,
      isMappedInHmis: villages.isMappedInHmis,
      lastVerified: villages.lastVerified,
      under5Population: villages.under5Population,
      createdAt: villages.createdAt,
    };

    // Query Total Filtered Count for pagination
    const [countResult] = await db
      .select({ count: count() })
      .from(villages)
      .leftJoin(districts, eq(villages.districtId, districts.id))
      .where(and(...conditions));
    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / sizeNum);

    // Query Paginated or Full Items based on page parameter
    const items = page === "all"
      ? await db
          .select(selectColumns)
          .from(villages)
          .leftJoin(districts, eq(villages.districtId, districts.id))
          .leftJoin(provinces, eq(districts.provinceId, provinces.id))
          .leftJoin(facilities, eq(villages.assignedFacilityId, facilities.id))
          .where(and(...conditions))
          .orderBy(sortOrderFunc)
      : await db
          .select(selectColumns)
          .from(villages)
          .leftJoin(districts, eq(villages.districtId, districts.id))
          .leftJoin(provinces, eq(districts.provinceId, provinces.id))
          .leftJoin(facilities, eq(villages.assignedFacilityId, facilities.id))
          .where(and(...conditions))
          .orderBy(sortOrderFunc)
          .limit(sizeNum)
          .offset(offset);

    // Query Summary Counts for Tenant overall
    const countQuery = await db
      .select({
        highRisk: villages.highRisk,
        assignedFacilityId: villages.assignedFacilityId,
        distanceToFacility: villages.distanceToFacility,
        count: count(),
      })
      .from(villages)
      .where(eq(villages.tenantId, req.tenantId))
      .groupBy(villages.highRisk, villages.assignedFacilityId, villages.distanceToFacility);

    let totalCount = 0;
    let servedCount = 0;
    let underservedCount = 0;
    let unservedCount = 0;
    let highRiskCount = 0;

    for (const group of countQuery) {
      const c = Number(group.count || 0);
      totalCount += c;
      if (group.highRisk) {
        highRiskCount += c;
      }
      if (!group.assignedFacilityId) {
        unservedCount += c;
      } else {
        const dist = group.distanceToFacility ? Number(group.distanceToFacility) : null;
        if (dist !== null && dist <= 5) {
          servedCount += c;
        } else {
          underservedCount += c;
        }
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const itemsMapped = items.map((v) => {
      const pop = Number(v.griddedPopulation || v.totalCatchmentPopulation || 0);
      let serviceStatus = "unserved";
      if (v.assignedFacilityId) {
        serviceStatus =
          v.distanceToFacility && Number(v.distanceToFacility) <= 5
            ? "served"
            : "underserved";
      }

      const riskScore = v.highRisk
        ? Math.min(95, 60 + (v.id % 31))
        : v.id % 40;

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
        province: v.provinceName || "Unknown",
        provinceId: v.provinceId,
        district: v.districtName || "Unknown",
        districtId: v.districtId,
        facility: v.facilityName,
        assignedFacilityId: v.assignedFacilityId,
        latitude: v.latitude ? Number(v.latitude) : null,
        longitude: v.longitude ? Number(v.longitude) : null,
        population: pop,
        serviceStatus,
        riskLevel: riskLevelComputed,
        riskScore,
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

    res.json({
      success: true,
      data: {
        items: itemsMapped,
        pagination: {
          page: pageNum,
          pageSize: sizeNum,
          total,
          totalPages,
        },
        counts: {
          total: totalCount,
          served: servedCount,
          underserved: underservedCount,
          unserved: unservedCount,
          highRisk: highRiskCount,
        },
      },
    });
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
    const { severity, provinceId, districtId, facilityId } = req.query as Record<string, string | undefined>;

    const conditions = [
      eq(vgieAlerts.tenantId, req.tenantId),
      eq(vgieAlerts.status, "active")
    ];

    if (severity && severity !== "all") {
      conditions.push(eq(vgieAlerts.severity, severity));
    }

    const rows = await db
      .select({
        id: vgieAlerts.id,
        alertType: vgieAlerts.alertType,
        severity: vgieAlerts.severity,
        title: vgieAlerts.title,
        message: vgieAlerts.message,
        status: vgieAlerts.status,
        createdAt: vgieAlerts.createdAt,
        villageId: vgieAlerts.villageId,
        facilityId: vgieAlerts.facilityId,
        villageDistrictId: villages.districtId,
        villageAssignedFacilityId: villages.assignedFacilityId,
        facilityDistrictId: facilities.districtId,
      })
      .from(vgieAlerts)
      .leftJoin(villages, eq(vgieAlerts.villageId, villages.id))
      .leftJoin(facilities, eq(vgieAlerts.facilityId, facilities.id))
      .where(and(...conditions))
      .orderBy(desc(vgieAlerts.createdAt));

    const allDistricts = await db
      .select({ id: districts.id, provinceId: districts.provinceId })
      .from(districts)
      .where(eq(districts.tenantId, req.tenantId));
    const districtProvinceMap = new Map(allDistricts.map(d => [d.id, d.provinceId]));

    let result = rows.map((a) => ({
      id: a.id,
      alertType: a.alertType,
      severity: a.severity,
      title: a.title,
      message: a.message,
      status: a.status,
      dismissed: a.status !== "active",
      createdAt: a.createdAt,
      villageId: a.villageId,
      facilityId: a.facilityId,
      villageDistrictId: a.villageDistrictId,
      facilityDistrictId: a.facilityDistrictId,
      villageAssignedFacilityId: a.villageAssignedFacilityId,
    }));

    if (facilityId && facilityId !== "all") {
      const fId = Number(facilityId);
      result = result.filter(r => 
        r.facilityId === fId || 
        r.villageAssignedFacilityId === fId
      );
    }
    if (districtId && districtId !== "all") {
      const dId = Number(districtId);
      result = result.filter(r => 
        r.villageDistrictId === dId || 
        r.facilityDistrictId === dId
      );
    }
    if (provinceId && provinceId !== "all") {
      const pId = Number(provinceId);
      result = result.filter(r => {
        const vdId = r.villageDistrictId;
        const fdId = r.facilityDistrictId;
        return (vdId && districtProvinceMap.get(vdId) === pId) || 
               (fdId && districtProvinceMap.get(fdId) === pId);
      });
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
    const { priority, status, provinceId, districtId, facilityId } = req.query as {
      priority?: string;
      status?: string;
      provinceId?: string;
      districtId?: string;
      facilityId?: string;
    };

    const conditions = [eq(vgieRecommendations.tenantId, req.tenantId)];
    if (priority && priority !== "all") {
      conditions.push(eq(vgieRecommendations.priority, priority));
    }
    if (status && status !== "all") {
      conditions.push(eq(vgieRecommendations.status, status));
    }

    const rows = await db
      .select()
      .from(vgieRecommendations)
      .where(and(...conditions))
      .orderBy(desc(vgieRecommendations.createdAt));

    // Join with village name when entityType is "settlement"
    const villageIds = rows
      .filter((r) => r.entityType === "settlement")
      .map((r) => r.entityId)
      .filter((id): id is number => id != null);

    let villageLookup = new Map<number, { name: string; under5Population: number | null; districtId: number; assignedFacilityId: number | null }>();
    if (villageIds.length > 0) {
      const vRows = await db
        .select({ id: villages.id, name: villages.name, under5Population: villages.under5Population, districtId: villages.districtId, assignedFacilityId: villages.assignedFacilityId })
        .from(villages)
        .where(inArray(villages.id, villageIds));
      villageLookup = new Map(vRows.map((v) => [v.id, v]));
    }

    const facilityIds = rows
      .filter((r) => r.entityType === "facility")
      .map((r) => r.entityId)
      .filter((id): id is number => id != null);

    let facilityLookup = new Map<number, { id: number; name: string; districtId: number }>();
    if (facilityIds.length > 0) {
      const fRows = await db
        .select({ id: facilities.id, name: facilities.name, districtId: facilities.districtId })
        .from(facilities)
        .where(inArray(facilities.id, facilityIds));
      facilityLookup = new Map(fRows.map((f) => [f.id, f]));
    }

    const sessionIds = rows
      .filter((r) => r.entityType === "session")
      .map((r) => r.entityId)
      .filter((id): id is number => id != null);

    let sessionLookup = new Map<number, { id: number; facilityId: number; districtId: number }>();
    if (sessionIds.length > 0) {
      const sRows = await db
        .select({ id: sessionPlans.id, facilityId: sessionPlans.facilityId, districtId: facilities.districtId })
        .from(sessionPlans)
        .innerJoin(facilities, eq(sessionPlans.facilityId, facilities.id))
        .where(inArray(sessionPlans.id, sessionIds));
      sessionLookup = new Map(sRows.map((s) => [s.id, s]));
    }

    const allDistricts = await db
      .select({ id: districts.id, provinceId: districts.provinceId })
      .from(districts)
      .where(eq(districts.tenantId, req.tenantId));
    const districtProvinceMap = new Map(allDistricts.map(d => [d.id, d.provinceId]));

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

    if (facilityId && facilityId !== "all") {
      const fId = Number(facilityId);
      result = result.filter((r) => {
        if (r.entityType === "settlement" && r.entityId) {
          return villageLookup.get(r.entityId)?.assignedFacilityId === fId;
        }
        if (r.entityType === "facility") {
          return r.entityId === fId;
        }
        if (r.entityType === "session" && r.entityId) {
          return sessionLookup.get(r.entityId)?.facilityId === fId;
        }
        return false;
      });
    }

    if (districtId && districtId !== "all") {
      const dId = Number(districtId);
      result = result.filter((r) => {
        if (r.entityType === "settlement" && r.entityId) {
          return villageLookup.get(r.entityId)?.districtId === dId;
        }
        if (r.entityType === "facility" && r.entityId) {
          return facilityLookup.get(r.entityId)?.districtId === dId;
        }
        if (r.entityType === "session" && r.entityId) {
          return sessionLookup.get(r.entityId)?.districtId === dId;
        }
        return false;
      });
    }

    if (provinceId && provinceId !== "all") {
      const pId = Number(provinceId);
      result = result.filter((r) => {
        let dId: number | undefined;
        if (r.entityType === "settlement" && r.entityId) {
          dId = villageLookup.get(r.entityId)?.districtId;
        } else if (r.entityType === "facility" && r.entityId) {
          dId = facilityLookup.get(r.entityId)?.districtId;
        } else if (r.entityType === "session" && r.entityId) {
          dId = sessionLookup.get(r.entityId)?.districtId;
        }
        return dId ? districtProvinceMap.get(dId) === pId : false;
      });
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
    const generatedRecs = await VgieService.generateRecommendations(req.tenantId);
    const generatedAlerts = await VgieService.detectCoverageGaps(req.tenantId);
    res.json({ 
      generated: generatedRecs.length, 
      alertsGenerated: generatedAlerts.length, 
      skipped: 0 
    });
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
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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

// ── VGIE RECOMMENDATION RULES CRUD ──────────────────────────────────────────
router.get("/recommendation-rules", async (req: any, res) => {
  try {
    const rules = await db
      .select()
      .from(vgieRecommendationRules)
      .where(eq(vgieRecommendationRules.tenantId, req.tenantId))
      .orderBy(vgieRecommendationRules.name);
    res.json(rules);
  } catch (err) {
    console.error("Failed to fetch recommendation rules:", err);
    res.status(500).json({ error: "Failed to fetch recommendation rules" });
  }
});

router.post("/recommendation-rules", async (req: any, res) => {
  try {
    const { name, description, category, conditionSql, recommendationText, priority, isActive } = req.body;
    if (!name || !category || !conditionSql || !recommendationText) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [rule] = await db
      .insert(vgieRecommendationRules)
      .values({
        tenantId: req.tenantId,
        name,
        description: description ?? null,
        category,
        conditionSql,
        recommendationText,
        priority: priority ?? "medium",
        isActive: isActive !== false,
      })
      .returning();

    res.json(rule);
  } catch (err) {
    console.error("Failed to create recommendation rule:", err);
    res.status(500).json({ error: "Failed to create recommendation rule" });
  }
});

router.patch("/recommendation-rules/:id", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const { name, description, category, conditionSql, recommendationText, priority, isActive } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (conditionSql !== undefined) updateData.conditionSql = conditionSql;
    if (recommendationText !== undefined) updateData.recommendationText = recommendationText;
    if (priority !== undefined) updateData.priority = priority;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [rule] = await db
      .update(vgieRecommendationRules)
      .set(updateData)
      .where(
        and(
          eq(vgieRecommendationRules.id, id),
          eq(vgieRecommendationRules.tenantId, req.tenantId)
        )
      )
      .returning();

    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json(rule);
  } catch (err) {
    console.error("Failed to update recommendation rule:", err);
    res.status(500).json({ error: "Failed to update recommendation rule" });
  }
});

router.delete("/recommendation-rules/:id", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [rule] = await db
      .delete(vgieRecommendationRules)
      .where(
        and(
          eq(vgieRecommendationRules.id, id),
          eq(vgieRecommendationRules.tenantId, req.tenantId)
        )
      )
      .returning();

    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json({ success: true, rule });
  } catch (err) {
    console.error("Failed to delete recommendation rule:", err);
    res.status(500).json({ error: "Failed to delete recommendation rule" });
  }
});

export default router;

