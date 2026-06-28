import { Router } from "express";
import { db } from "../db";
import { VgieService } from "../services/vgieService";
import { storage } from "../storage";
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
  settlementsMaster,
} from "../../shared/schema";
import { eq, and, sql, count, desc, asc, ilike, or, inArray } from "drizzle-orm";
const router = Router();
type VgieGeoScope = {
  all: boolean;
  provinceIds: number[];
  districtIds: number[];
  facilityIds: number[];
};
function roleListFor(user: any): string[] {
  return [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])].filter(Boolean);
}
async function getVgieGeoScope(req: any): Promise<VgieGeoScope> {
  const user = req.dbUser;
  if (!user) return { all: false, provinceIds: [], districtIds: [], facilityIds: [] };
  const roles = roleListFor(user);
  if (user.isPlatformAdmin || roles.includes("national_admin") || roles.includes("gis_specialist")) {
    return { all: true, provinceIds: [], districtIds: [], facilityIds: [] };
  }
  const scopedRole = roles.some((role) =>
    ["facility_clerk", "facility_in_charge", "district_manager", "provincial_coordinator"].includes(role),
  );
  if (user.tenantId && req.tenantId && user.tenantId !== req.tenantId && scopedRole) {
    return { all: false, provinceIds: [], districtIds: [], facilityIds: [] };
  }
  const scope = user.dataAccessScope || {};
  const provinces = new Set<number>();
  const districtsSet = new Set<number>();
  const facilitiesSet = new Set<number>();
  const addNums = (set: Set<number>, values: unknown) => {
    if (!Array.isArray(values)) return;
    for (const value of values) {
      const n = Number(value);
      if (Number.isFinite(n)) set.add(n);
    }
  };
  if (roles.includes("provincial_coordinator")) {
    addNums(provinces, scope.provinces);
    if (user.provinceId) provinces.add(Number(user.provinceId));
    addNums(districtsSet, scope.districts);
    addNums(facilitiesSet, scope.facilities);
  } else if (roles.includes("district_manager")) {
    addNums(districtsSet, scope.districts);
    if (user.districtId) districtsSet.add(Number(user.districtId));
    addNums(facilitiesSet, scope.facilities);
  } else if (roles.includes("facility_clerk") || roles.includes("facility_in_charge")) {
    addNums(facilitiesSet, scope.facilities);
    if (user.facilityId) facilitiesSet.add(Number(user.facilityId));
  } else {
    addNums(provinces, scope.provinces);
    addNums(districtsSet, scope.districts);
    addNums(facilitiesSet, scope.facilities);
    if (facilitiesSet.size === 0 && districtsSet.size === 0 && provinces.size === 0) {
      return { all: true, provinceIds: [], districtIds: [], facilityIds: [] };
    }
  }
  for (const provinceId of Array.from(provinces)) {
    const rows = await storage.getDistricts(req.tenantId, provinceId);
    rows.forEach((district) => districtsSet.add(Number(district.id)));
  }
  for (const districtId of Array.from(districtsSet)) {
    const rows = await storage.getFacilities(req.tenantId, districtId);
    rows.forEach((facility) => facilitiesSet.add(Number(facility.id)));
  }
  return {
    all: false,
    provinceIds: Array.from(provinces),
    districtIds: Array.from(districtsSet),
    facilityIds: Array.from(facilitiesSet),
  };
}
function vgieSettlementScopeCondition(scope: VgieGeoScope) {
  if (scope.all) return null;
  const parts: any[] = [];
  if (scope.facilityIds.length > 0) {
    parts.push(inArray(settlementsMaster.linkedFacilityId, scope.facilityIds));
    parts.push(inArray(settlementsMaster.nearestFacilityId, scope.facilityIds));
  }
  if (scope.districtIds.length > 0) parts.push(inArray(settlementsMaster.districtId, scope.districtIds));
  if (scope.provinceIds.length > 0) parts.push(inArray(settlementsMaster.provinceId, scope.provinceIds));
  return parts.length === 0 ? sql`false` : or(...parts);
}
// --- /api/vgie/dashboard/summary ---
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
// --- /api/vgie/dashboard/district-stats ---
// --- /api/vgie/dashboard/district-stats ---
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
// --- /api/vgie/dashboard/outreach-coverage ---
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
// --- /api/vgie/dashboard/outreach-feed ---
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
          : "-",
        childrenVaccinated: Number(item.childrenVaccinated || 0),
      }))
    );
  } catch (err) {
    console.error("VGIE outreach-feed error:", err);
    res.status(500).json({ error: "Failed to fetch outreach feed" });
  }
});
// Helper for straight-line geodetic distance (Haversine formula)
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
// Helper to estimate travel time in minutes based on distance and transport mode
function estimateTravelTimeMinutes(distanceKm: number, mode: string): number {
  let speedKmh = 4; // walking default
  if (mode === "bicycle") speedKmh = 10;
  else if (mode === "motorbike") speedKmh = 25;
  else if (mode === "car" || mode === "road") speedKmh = 40;
  else if (mode === "boat") speedKmh = 15;
  else if (mode === "air" || mode === "chopper") speedKmh = 100;
  return Math.max(5, Math.round((distanceKm / speedKmh) * 60));
}
// --- /api/vgie/settlements ---
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
    const scope = await getVgieGeoScope(req);
    const scopedCondition = vgieSettlementScopeCondition(scope);
    const baseConditions: any[] = [
      eq(settlementsMaster.tenantId, req.tenantId),
      eq(settlementsMaster.isActive, true),
    ];
    if (scopedCondition) baseConditions.push(scopedCondition);
    // Build conditions array
    const conditions: any[] = [...baseConditions];
    // 1. Service Status Filter
    if (status && status !== "all") {
      conditions.push(eq(settlementsMaster.serviceStatus, status));
    }
    // 2. Risk Level Filter
    if (risk && risk !== "all") {
      conditions.push(eq(settlementsMaster.riskLevel, risk));
    }
    // 3. Location Filters
    if (provinceId && provinceId !== "all") {
      conditions.push(eq(settlementsMaster.provinceId, Number(provinceId)));
    }
    if (districtId && districtId !== "all") {
      conditions.push(eq(settlementsMaster.districtId, Number(districtId)));
    }
    if (facilityId && facilityId !== "all") {
      conditions.push(eq(settlementsMaster.linkedFacilityId, Number(facilityId)));
    }
    // 4. Search Filter
    if (search) {
      const q = `%${search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(settlementsMaster.name, q),
          ilike(settlementsMaster.provinceName, q),
          ilike(settlementsMaster.districtName, q)
        )
      );
    }
    // Determine Sort Field
    let orderByField: any = settlementsMaster.name;
    if (sortBy === "province") {
      orderByField = settlementsMaster.provinceName;
    } else if (sortBy === "district") {
      orderByField = settlementsMaster.districtName;
    } else if (sortBy === "facility") {
      orderByField = settlementsMaster.linkedFacilityId;
    } else if (sortBy === "population") {
      orderByField = settlementsMaster.populationEstimate;
    } else if (sortBy === "riskScore") {
      orderByField = settlementsMaster.riskLevel;
    } else if (sortBy === "distance") {
      orderByField = settlementsMaster.distanceToLinkedFacilityKm;
    } else if (sortBy === "travelTime") {
      orderByField = settlementsMaster.estimatedWalkingTimeMinutes;
    }
    const sortOrderFunc = sortOrder === "desc" ? desc(orderByField) : asc(orderByField);
    // Query Total Filtered Count for pagination
    const [countResult] = await db
      .select({ count: count() })
      .from(settlementsMaster)
      .where(and(...conditions));
    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / sizeNum);
    // Query Items
    const items = page === "all"
      ? await db
          .select()
          .from(settlementsMaster)
          .where(and(...conditions))
          .orderBy(sortOrderFunc)
      : await db
          .select()
          .from(settlementsMaster)
          .where(and(...conditions))
          .orderBy(sortOrderFunc)
          .limit(sizeNum)
          .offset(offset);
    // Query Summary Counts for Tenant overall
    const countQuery = await db
      .select({
        riskLevel: settlementsMaster.riskLevel,
        serviceStatus: settlementsMaster.serviceStatus,
        count: count(),
      })
      .from(settlementsMaster)
      .where(and(...baseConditions))
      .groupBy(settlementsMaster.riskLevel, settlementsMaster.serviceStatus);
    let totalCount = 0;
    let servedCount = 0;
    let underservedCount = 0;
    let unservedCount = 0;
    let highRiskCount = 0;
    for (const group of countQuery) {
      const c = Number(group.count || 0);
      totalCount += c;
      if (group.riskLevel === "high" || group.riskLevel === "very_high") {
        highRiskCount += c;
      }
      if (group.serviceStatus === "served") {
        servedCount += c;
      } else if (group.serviceStatus === "underserved") {
        underservedCount += c;
      } else {
        unservedCount += c;
      }
    }
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const allFacilitiesForTenant = await db
      .select({ id: facilities.id, name: facilities.name })
      .from(facilities)
      .where(eq(facilities.tenantId, req.tenantId));
    const facilityNameMap = new Map(allFacilitiesForTenant.map(f => [f.id, f.name]));
    const allVillagesForTenant = await db
      .select({ id: villages.id, name: villages.name })
      .from(villages)
      .where(eq(villages.tenantId, req.tenantId));
    const communityNameMap = new Map(allVillagesForTenant.map(v => [v.id, v.name]));
    const itemsMapped = items.map((v) => {
      const pop = Number(v.populationEstimate || 0);
      const riskScore = v.riskLevel === "very_high" ? 85 : v.riskLevel === "high" ? 65 : v.riskLevel === "medium" ? 35 : 15;
      return {
        id: v.id,
        name: v.name,
        province: v.provinceName || "Unknown",
        provinceId: v.provinceId,
        district: v.districtName || "Unknown",
        districtId: v.districtId,
        facilityId: v.linkedFacilityId,
        facility: v.linkedFacilityId ? facilityNameMap.get(v.linkedFacilityId) : null,
        linkedCommunityId: v.linkedCommunityId,
        linkedCommunityName: v.linkedCommunityId ? communityNameMap.get(v.linkedCommunityId) : null,
        latitude: v.latitude ? Number(v.latitude) : null,
        longitude: v.longitude ? Number(v.longitude) : null,
        population: pop,
        serviceStatus: v.serviceStatus,
        riskLevel: v.riskLevel,
        riskScore,
        distanceToFacility: v.distanceToLinkedFacilityKm ? Number(v.distanceToLinkedFacilityKm) : null,
        estimatedWalkingTimeMinutes: v.estimatedWalkingTimeMinutes,
        estimatedDrivingTimeMinutes: v.estimatedDrivingTimeMinutes,
        travelModePlanning: v.travelModePlanning,
        linkStatus: v.linkStatus,
        isHardToReach: v.hardToReach,
        isNewSettlement: v.createdAt != null && new Date(v.createdAt) > thirtyDaysAgo,
        under5Population: v.under5Population,
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
// --- POST /api/vgie/settlements (Manually Add Settlement) ---
router.post("/settlements", async (req: any, res) => {
  try {
    const { name, placeType = "village", latitude, longitude, provinceId, districtId, populationEstimate = 120 } = req.body;
    if (!name || latitude == null || longitude == null) {
      return res.status(400).json({ error: "Missing required fields (name, latitude, longitude)" });
    }
    const [newSettlement] = await db
      .insert(settlementsMaster)
      .values({
        tenantId: req.tenantId,
        name,
        placeType,
        latitude: String(latitude),
        longitude: String(longitude),
        provinceId: provinceId ? Number(provinceId) : null,
        districtId: districtId ? Number(districtId) : null,
        populationEstimate: Number(populationEstimate),
        under5Population: Math.round(Number(populationEstimate) * 0.18),
        validationStatus: "pending",
        source: "manual_input",
        serviceStatus: "unserved",
        linkStatus: "unassigned",
      })
      .returning();
    res.status(201).json({ success: true, data: newSettlement });
  } catch (err) {
    console.error("Failed to create settlement:", err);
    res.status(500).json({ error: "Failed to create settlement" });
  }
});
// --- PUT /api/vgie/settlements/:id (Edit Settlement) ---
router.put("/settlements/:id", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db
      .select()
      .from(settlementsMaster)
      .where(and(eq(settlementsMaster.id, id), eq(settlementsMaster.tenantId, req.tenantId)));
    if (!existing) return res.status(404).json({ error: "Settlement not found" });
    const updates = {
      name: req.body.name ?? existing.name,
      placeType: req.body.placeType ?? existing.placeType,
      latitude: req.body.latitude != null ? String(req.body.latitude) : existing.latitude,
      longitude: req.body.longitude != null ? String(req.body.longitude) : existing.longitude,
      populationEstimate: req.body.populationEstimate != null ? Number(req.body.populationEstimate) : existing.populationEstimate,
      under5Population: req.body.populationEstimate != null ? Math.round(Number(req.body.populationEstimate) * 0.18) : existing.under5Population,
      validationStatus: req.body.validationStatus ?? existing.validationStatus,
      serviceStatus: req.body.serviceStatus ?? existing.serviceStatus,
      riskLevel: req.body.riskLevel ?? existing.riskLevel,
      hardToReach: req.body.hardToReach ?? existing.hardToReach,
      updatedAt: new Date(),
    };
    const [updated] = await db
      .update(settlementsMaster)
      .set(updates)
      .where(eq(settlementsMaster.id, id))
      .returning();
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Failed to update settlement:", err);
    res.status(500).json({ error: "Failed to update settlement" });
  }
});
// --- DELETE /api/vgie/settlements/:id (Archive/Deactivate Settlement) ---
router.delete("/settlements/:id", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db
      .select()
      .from(settlementsMaster)
      .where(and(eq(settlementsMaster.id, id), eq(settlementsMaster.tenantId, req.tenantId)));
    if (!existing) return res.status(404).json({ error: "Settlement not found" });
    await db
      .update(settlementsMaster)
      .set({ isActive: false, validationStatus: "archived", updatedAt: new Date() })
      .where(eq(settlementsMaster.id, id));
    res.json({ success: true, message: "Settlement archived successfully" });
  } catch (err) {
    console.error("Failed to archive settlement:", err);
    res.status(500).json({ error: "Failed to archive settlement" });
  }
});
// --- POST /api/vgie/settlements/:id/link-facility ---
router.post("/settlements/:id/link-facility", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const { facilityId, transportMode = "walking", linkMethod = "manual", notes } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    if (!facilityId) return res.status(400).json({ error: "facilityId is required" });
    const [settlement] = await db
      .select()
      .from(settlementsMaster)
      .where(and(eq(settlementsMaster.id, id), eq(settlementsMaster.tenantId, req.tenantId)));
    if (!settlement) return res.status(404).json({ error: "Settlement not found" });
    const [facility] = await db
      .select()
      .from(facilities)
      .where(and(eq(facilities.id, Number(facilityId)), eq(facilities.tenantId, req.tenantId)));
    if (!facility) return res.status(404).json({ error: "Facility not found" });
    const distance = getHaversineDistance(
      Number(settlement.latitude),
      Number(settlement.longitude),
      Number(facility.latitude),
      Number(facility.longitude)
    );
    const walkingTime = estimateTravelTimeMinutes(distance, "walking");
    const drivingTime = estimateTravelTimeMinutes(distance, transportMode);
    await db
      .update(settlementsMaster)
      .set({
        linkedFacilityId: facility.id,
        distanceToLinkedFacilityKm: String(distance.toFixed(2)),
        estimatedWalkingTimeMinutes: walkingTime,
        estimatedDrivingTimeMinutes: drivingTime,
        travelModePlanning: transportMode,
        drySeasonTravelTimeMinutes: walkingTime,
        rainySeasonTravelTimeMinutes: Math.round(walkingTime * 1.5),
        linkStatus: "linked",
        linkMethod,
        linkNotes: notes,
        serviceStatus: distance <= 5 ? "served" : "underserved",
        updatedAt: new Date(),
      })
      .where(eq(settlementsMaster.id, id));
    res.json({ success: true, message: "Linked to facility successfully", data: { distance, travelTime: drivingTime } });
  } catch (err) {
    console.error("Failed to link facility:", err);
    res.status(500).json({ error: "Failed to link facility" });
  }
});
// --- POST /api/vgie/settlements/:id/link-community ---
router.post("/settlements/:id/link-community", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const { communityId } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    if (!communityId) return res.status(400).json({ error: "communityId is required" });
    const [settlement] = await db
      .select()
      .from(settlementsMaster)
      .where(and(eq(settlementsMaster.id, id), eq(settlementsMaster.tenantId, req.tenantId)));
    if (!settlement) return res.status(404).json({ error: "Settlement not found" });
    const [community] = await db
      .select()
      .from(villages)
      .where(and(eq(villages.id, Number(communityId)), eq(villages.tenantId, req.tenantId)));
    if (!community) return res.status(404).json({ error: "Community not found" });
    await db
      .update(settlementsMaster)
      .set({
        linkedCommunityId: community.id,
        linkStatus: "linked",
        updatedAt: new Date(),
      })
      .where(eq(settlementsMaster.id, id));
    await db
      .update(villages)
      .set({
        linkedSettlementId: settlement.id,
        updatedAt: new Date(),
      })
      .where(eq(villages.id, community.id));
    res.json({ success: true, message: "Linked to community successfully" });
  } catch (err) {
    console.error("Failed to link community:", err);
    res.status(500).json({ error: "Failed to link community" });
  }
});
// --- POST /api/vgie/settlements/:id/convert-to-community ---
router.post("/settlements/:id/convert-to-community", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [settlement] = await db
      .select()
      .from(settlementsMaster)
      .where(and(eq(settlementsMaster.id, id), eq(settlementsMaster.tenantId, req.tenantId)));
    if (!settlement) return res.status(404).json({ error: "Settlement not found" });
    // Generate code
    const countQuery = await db.select({ count: count() }).from(villages).where(eq(villages.tenantId, req.tenantId));
    const nextIdx = (countQuery[0]?.count ?? 0) + 1;
    const [community] = await db
      .insert(villages)
      .values({
        tenantId: req.tenantId,
        name: settlement.name,
        code: `COMM-${nextIdx}`,
        districtId: settlement.districtId || 1, // Default or resolved district
        latitude: settlement.latitude,
        longitude: settlement.longitude,
        assignedFacilityId: settlement.linkedFacilityId,
        distanceToFacility: settlement.distanceToLinkedFacilityKm,
        travelTimeMinutes: settlement.estimatedWalkingTimeMinutes || 30,
        isHardToReach: settlement.hardToReach,
        settlementType: settlement.placeType || "village",
        totalCatchmentPopulation: settlement.populationEstimate || 120,
        under5Population: settlement.under5Population || Math.round((settlement.populationEstimate || 120) * 0.18),
        linkedSettlementId: settlement.id,
      })
      .returning();
    await db
      .update(settlementsMaster)
      .set({
        linkedCommunityId: community.id,
        linkStatus: "linked",
        validationStatus: "approved",
        updatedAt: new Date(),
      })
      .where(eq(settlementsMaster.id, id));
    res.json({ success: true, data: community });
  } catch (err) {
    console.error("Failed to convert settlement to community:", err);
    res.status(500).json({ error: "Failed to convert settlement" });
  }
});
// --- POST /api/vgie/settlements/bulk-assign-facility ---
router.post("/settlements/bulk-assign-facility", async (req: any, res) => {
  try {
    const { settlementIds, facilityId, transportMode = "walking" } = req.body;
    if (!Array.isArray(settlementIds) || settlementIds.length === 0 || !facilityId) {
      return res.status(400).json({ error: "Missing required parameters (settlementIds array, facilityId)" });
    }
    const [facility] = await db
      .select()
      .from(facilities)
      .where(and(eq(facilities.id, Number(facilityId)), eq(facilities.tenantId, req.tenantId)));
    if (!facility) return res.status(404).json({ error: "Facility not found" });
    for (const sid of settlementIds) {
      const [settlement] = await db
        .select()
        .from(settlementsMaster)
        .where(and(eq(settlementsMaster.id, sid), eq(settlementsMaster.tenantId, req.tenantId)));
      if (!settlement) continue;
      const distance = getHaversineDistance(
        Number(settlement.latitude),
        Number(settlement.longitude),
        Number(facility.latitude),
        Number(facility.longitude)
      );
      const walkingTime = estimateTravelTimeMinutes(distance, "walking");
      const drivingTime = estimateTravelTimeMinutes(distance, transportMode);
      await db
        .update(settlementsMaster)
        .set({
          linkedFacilityId: facility.id,
          distanceToLinkedFacilityKm: String(distance.toFixed(2)),
          estimatedWalkingTimeMinutes: walkingTime,
          estimatedDrivingTimeMinutes: drivingTime,
          travelModePlanning: transportMode,
          drySeasonTravelTimeMinutes: walkingTime,
          rainySeasonTravelTimeMinutes: Math.round(walkingTime * 1.5),
          linkStatus: "linked",
          linkMethod: "bulk_assign",
          serviceStatus: distance <= 5 ? "served" : "underserved",
          updatedAt: new Date(),
        })
        .where(eq(settlementsMaster.id, sid));
    }
    res.json({ success: true, message: `Successfully linked ${settlementIds.length} settlements to facility` });
  } catch (err) {
    console.error("Failed to perform bulk link:", err);
    res.status(500).json({ error: "Failed to perform bulk linkage" });
  }
});
// --- /api/vgie/settlements/:id ---
router.get("/settlements/:id", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [v] = await db
      .select()
      .from(settlementsMaster)
      .where(and(eq(settlementsMaster.id, id), eq(settlementsMaster.tenantId, req.tenantId)));
    if (!v) return res.status(404).json({ error: "Settlement not found" });
    const allDistricts = await db
      .select({ id: districts.id, name: districts.name })
      .from(districts)
      .where(eq(districts.tenantId, req.tenantId));
    const districtLookup = new Map(allDistricts.map((d) => [d.id, d.name]));
    let linkedFacility: any = null;
    if (v.linkedFacilityId) {
      const [f] = await db
        .select({ id: facilities.id, name: facilities.name, hmisCode: facilities.hmisCode })
        .from(facilities)
        .where(eq(facilities.id, v.linkedFacilityId));
      linkedFacility = f || null;
    }
    let linkedCommunity: any = null;
    if (v.linkedCommunityId) {
      const [c] = await db
        .select({ id: villages.id, name: villages.name, code: villages.code })
        .from(villages)
        .where(eq(villages.id, v.linkedCommunityId));
      linkedCommunity = c || null;
    }
    // 1. Fetch nearest facility geocoded suggestion
    const allFacilities = await db
      .select({ id: facilities.id, name: facilities.name, latitude: facilities.latitude, longitude: facilities.longitude, hmisCode: facilities.hmisCode })
      .from(facilities)
      .where(eq(facilities.tenantId, req.tenantId));
    let nearestFacility: any = null;
    let nearestDistance = Infinity;
    for (const fac of allFacilities) {
      if (fac.latitude && fac.longitude && v.latitude && v.longitude) {
        const dist = getHaversineDistance(
          Number(v.latitude),
          Number(v.longitude),
          Number(fac.latitude),
          Number(fac.longitude)
        );
        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestFacility = fac;
        }
      }
    }
    // 2. Fetch spatial containment (catchment polygon match)
    let catchmentFacility: any = null;
    try {
      if (v.latitude && v.longitude) {
        const [cf] = await db.execute(sql`
          SELECT id, name FROM facilities
          WHERE tenant_id = ${req.tenantId}
            AND catchment_polygon IS NOT NULL
            AND ST_Contains(
              ST_SetSRID(ST_GeomFromGeoJSON(catchment_polygon::text), 4326),
              ST_SetSRID(ST_MakePoint(${v.longitude}::float, ${v.latitude}::float), 4326)
            )
          LIMIT 1
        `) as any;
        catchmentFacility = cf || null;
      }
    } catch (err) {
      // Ignore geometry parse warnings
    }
    // 3. Duplicate checks & name similarity matches
    let nearbyCommunity: any = null;
    try {
      if (v.latitude && v.longitude) {
        const [nc] = await db.execute(sql`
          SELECT id, name FROM villages
          WHERE tenant_id = ${req.tenantId}
            AND district_id = ${v.districtId || 0}
            AND (ST_Distance(
              ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography,
              ST_SetSRID(ST_MakePoint(${v.longitude}::float, ${v.latitude}::float), 4326)::geography
            ) / 1000.0) <= 0.5
          LIMIT 1
        `) as any;
        nearbyCommunity = nc || null;
      }
    } catch (err) {
      // Ignore spatial distance checks if not postgis-enabled
    }
    // 4. Construct Smart Suggestions (confidence & reason shapes)
    const suggestions = [];
    if (!v.linkedFacilityId && nearestFacility) {
      suggestions.push({
        type: "link_facility",
        title: "Link to Health Facility",
        description: `Settlement is currently unassigned. Nearest health facility is ${nearestFacility.name} (${nearestDistance.toFixed(2)} km).`,
        confidence: 0.90,
        actionable: true,
        suggestedFacilityId: nearestFacility.id,
        reason: "Calculated nearest straight-line distance to operational health post."
      });
    }
    if (catchmentFacility && catchmentFacility.id !== v.linkedFacilityId) {
      suggestions.push({
        type: "catchment_polygon",
        title: "Catchment Containment Match",
        description: `Settlement lies inside the drawn catchment polygon of facility: ${catchmentFacility.name}.`,
        confidence: 0.95,
        actionable: true,
        suggestedFacilityId: catchmentFacility.id,
        reason: "Geographic intersection within facility service area boundaries."
      });
    }
    if (nearestFacility && v.linkedFacilityId && nearestFacility.id !== v.linkedFacilityId) {
      suggestions.push({
        type: "reassign_facility",
        title: "Optimized Catchment Suggestion",
        description: `Linked to ${linkedFacility?.name || "another facility"}, but ${nearestFacility.name} is closer (${nearestDistance.toFixed(2)} km vs ${Number(v.distanceToLinkedFacilityKm || 0).toFixed(2)} km).`,
        confidence: 0.75,
        actionable: true,
        suggestedFacilityId: nearestFacility.id,
        reason: "Proximity checks reveal closer catchment options."
      });
    }
    if (nearestDistance && nearestDistance >= 50.0) {
      suggestions.push({
        type: "htr_district",
        title: "District Outreach Candidate",
        description: `Extremely isolated settlement (${nearestDistance.toFixed(1)} km from facility). Suggest making it a district-level HTR responsibility.`,
        confidence: 0.85,
        actionable: false,
        reason: "Exceeds extreme outreach isolation threshold (>= 50 km)."
      });
    }
    if (nearbyCommunity) {
      suggestions.push({
        type: "merge_community",
        title: "Duplicate Community Overlap",
        description: `Physical overlap detected with registered community: ${nearbyCommunity.name} (within 500m). Suggest merging candidate records to resolve redundancy.`,
        confidence: 0.90,
        actionable: true,
        suggestedCommunityId: nearbyCommunity.id,
        reason: "Spatiotemporal proximity indicates duplicate candidate records."
      });
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
    const pop = Number(v.populationEstimate || 0);
    res.json({
      id: v.id,
      name: v.name,
      district: districtLookup.get(v.districtId || 0) || v.districtName || "Unknown",
      districtId: v.districtId,
      latitude: v.latitude ? Number(v.latitude) : null,
      longitude: v.longitude ? Number(v.longitude) : null,
      population: pop,
      under5Population: v.under5Population,
      serviceStatus: v.serviceStatus,
      highRisk: v.riskLevel === "high" || v.riskLevel === "very_high",
      highRiskReason: v.riskLevel === "very_high" ? "very high risk classification" : "high risk classification",
      isHardToReach: v.hardToReach,
      settlementType: v.placeType || "village",
      distanceToFacility: v.distanceToLinkedFacilityKm ? Number(v.distanceToLinkedFacilityKm) : null,
      travelTimeMinutes: v.estimatedWalkingTimeMinutes || 30,
      estimatedWalkingTimeMinutes: v.estimatedWalkingTimeMinutes,
      estimatedDrivingTimeMinutes: v.estimatedDrivingTimeMinutes,
      drySeasonTravelTimeMinutes: v.drySeasonTravelTimeMinutes,
      rainySeasonTravelTimeMinutes: v.rainySeasonTravelTimeMinutes,
      travelModePlanning: v.travelModePlanning,
      linkStatus: v.linkStatus,
      linkMethod: v.linkMethod,
      linkConfidence: v.linkConfidence,
      linkNotes: v.linkNotes,
      isMappedInHmis: true,
      lastVerified: v.updatedAt,
      assignedFacility: linkedFacility,
      linkedCommunity: linkedCommunity,
      nearestFacility: nearestFacility ? {
        id: nearestFacility.id,
        name: nearestFacility.name,
        distanceKm: nearestDistance,
        travelTimeWalkingMin: Math.round(nearestDistance * 15),
        travelTimeMotorcycleMin: Math.round(nearestDistance * 2.4),
        travelTimeVehicleMin: Math.round(nearestDistance * 1.5)
      } : null,
      suggestions,
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
// --- /api/vgie/facilities ---
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
// --- /api/vgie/facilities/:id ---
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
// --- /api/vgie/alerts ---
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
// --- PATCH /api/vgie/alerts/:id/dismiss ---
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
// --- /api/vgie/recommendations ---
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
// --- PATCH /api/vgie/recommendations/:id ---
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
// --- POST /api/vgie/analyze-catchment ---
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
// --- POST /api/vgie/outreach-sessions ---
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
        name: `Outreach - ${village.name}`,
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
// --- POST /api/vgie/recommendations/ai-generate ---
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
      // --- Gemini AI path ---
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
      // --- Rule-based fallback (no API key) ---
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
// --- VGIE RECOMMENDATION RULES CRUD ---
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