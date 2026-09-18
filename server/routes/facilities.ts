import express, { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import turfArea from '@turf/area';
import { and, asc, desc, eq, inArray, isNull, or, sql as dsql, ilike, gte, lte, ne, isNotNull } from 'drizzle-orm';
import { db, pool } from '../db';
import { storage } from '../storage';
import {
  facilities,
  facilityStaff,
  hfcCommittee,
  hfcCommitteeMembers,
  communityHealthVolunteers,
  chvProfiles,
  coldChainEquipment,
  facilityCatchments,
  villages,
  districts,
  provinces,
  users,
  monthlyReports,
  populationData,
  stockTransactions,
  uncoveredCommunities,
  notifications,
  insertFacilitySchema,
  insertFacilityStaffSchema,
  insertHfcCommitteeSchema,
  insertHfcCommitteeMemberSchema,
  insertCommunityHealthVolunteerSchema,
  insertColdChainEquipmentSchema,
  insertFacilityCatchmentSchema,
  insertUncoveredCommunitySchema,
  FACILITY_AUTHOR_ROLES,
} from '@shared/schema';
import { isAuthenticated, getCurrentUserId } from '../auth';
import { requireTenant } from '../auth/tenantResolver';
import { requireDbUser } from '../auth/loadDbUser';
import { hasPermission } from '../auth/authorization';
import { safeErrorMessage } from '../errorUtils';
import { getCountryFormat } from '@shared/countryFormats';
import { normalizeStockVaccineName } from '@shared/vaccineSchedule';
import { fetchOsrmRoute } from '../services/routing';
import {
  requireGeoAccess,
  requirePermission,
  getFacilityHierarchy,
  isFacilityMicroplanLocked,
  isLocationOutsideTenantBoundary,
  outsideVillageIds,
  setCacheHeaders,
  getGeoScope,
  recordInGeoScope,
  userCanAccessGeo,
  logAudit,
  requireAdmin,
  loadRole,
  calculateHaversineDistance,
  canMoveFacilityDistrict,
} from '../routes';

type BulkResult = {
  index?: number;
  success?: boolean;
  ok?: boolean;
  id?: number;
  clientId?: any;
  error?: string;
  data?: any;
  message?: string;
};

type BulkItem = { clientId?: any; [key: string]: any };

function parseBulkItems(body: any): { items: BulkItem[] } | null {
  if (Array.isArray(body)) return { items: body };
  if (body && typeof body === 'object') {
    if (Array.isArray(body.items)) return { items: body.items };
    if (Array.isArray(body.rows)) return { items: body.rows };
    if (Array.isArray(body.data)) return { items: body.data };
  }
  return null;
}

const auth = [isAuthenticated, requireTenant, requireDbUser] as const;

export function registerFacilityRoutes(app: Express) {

  // ─── Facilities ───────────────────────────────────────
  app.get("/api/facilities", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      const districtId = req.query.districtId ? parseInt(req.query.districtId as string) : undefined;

      setCacheHeaders(res, 300);

      // getGeoScope handles all role tiers and respects dataAccessScope:
      //   national_admin / gis_specialist / platform_admin → scope.all = true
      //   provincial_coordinator → scope.facilityIds = all facilities in province
      //   district_manager       → scope.facilityIds = all facilities in district
      //   facility_clerk/in_charge → scope.facilityIds = their single facility
      const scope = await getGeoScope(dbUser, req.tenantId);
      const all = await storage.getFacilities(req.tenantId, districtId);
      const rawResult = scope.all ? all : all.filter((f) => scope.facilityIds.has(f.id));

      // Deduplicate facilities with uppercase type suffixes (e.g. "Ateda PHCU" vs "Ateda Phcu")
      // Prioritizing canonical titlecase entries over all-caps abbreviations
      const normalizedMap = new Map<string, any>();
      for (const fac of rawResult) {
        const norm = (fac.name || "")
          .replace(/\bPHCU\b/g, "Phcu")
          .replace(/\bPHCC\b/g, "Phcc")
          .replace(/\bHOSPITAL\b/g, "Hospital")
          .trim()
          .toLowerCase();
        const key = `${fac.districtId ?? ""}:${norm}`;
        const isUpper = /\b(PHCU|PHCC|HOSPITAL)\b/.test(fac.name || "");

        if (!normalizedMap.has(key)) {
          normalizedMap.set(key, fac);
        } else if (!isUpper) {
          const existing = normalizedMap.get(key);
          const existingIsUpper = /\b(PHCU|PHCC|HOSPITAL)\b/.test(existing.name || "");
          if (existingIsUpper) {
            normalizedMap.set(key, fac);
          }
        }
      }
      const result = Array.from(normalizedMap.values());

      const [districtRows, provinceRows] = await Promise.all([
        db
          .select({ id: districts.id, name: districts.name, provinceId: districts.provinceId })
          .from(districts)
          .where(eq(districts.tenantId, req.tenantId)),
        db
          .select({ id: provinces.id, name: provinces.name })
          .from(provinces)
          .where(eq(provinces.tenantId, req.tenantId)),
      ]);
      const districtMap = new Map(districtRows.map((d) => [Number(d.id), d]));
      const provinceMap = new Map(provinceRows.map((p) => [Number(p.id), p]));
      const enrichFacilityAdmin = (facility: any) => {
        const district = districtMap.get(Number(facility.districtId));
        const province = district ? provinceMap.get(Number(district.provinceId)) : undefined;
        return {
          ...facility,
          districtName: district?.name ?? null,
          provinceId: district?.provinceId ?? null,
          provinceName: province?.name ?? null,
        };
      };

      // Augment with live staff count from facility_staff table so the Facilities
      // module shows real headcounts instead of the rarely-updated staffCount field.
      try {
        const staffCounts = await db
          .select({
            facilityId: facilityStaff.facilityId,
            count: dsql`count(*)::int`,
          })
          .from(facilityStaff)
          .where(eq(facilityStaff.tenantId, req.tenantId))
          .groupBy(facilityStaff.facilityId);
        const countMap = new Map();
        for (const row of staffCounts) {
          if (row.facilityId) countMap.set(row.facilityId, Number(row.count));
        }
        const withCounts = result.map((f) => ({
          ...enrichFacilityAdmin(f),
          liveStaffCount: countMap.get(f.id) ?? 0,
        }));
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        return res.json(withCounts);
      } catch (countErr) {
        console.warn("[facilities] Could not compute live staff counts:", countErr);
      }

      res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json(result.map(enrichFacilityAdmin));
    } catch (error) {
      console.error("Error fetching facilities:", error);
      res.status(500).json({ message: "Failed to fetch facilities" });
    }
  });

  app.get("/api/facilities/:id", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      const facility = await storage.getFacility(req.tenantId, parseInt(req.params.id));
      if (!facility) return res.status(404).json({ message: "Facility not found" });
      if (!(await userCanAccessGeo(dbUser, req.tenantId, { facilityId: facility.id }))) {
        return res.status(404).json({ message: "Facility not found" });
      }
      res.json(facility);
    } catch (error) {
      console.error("Error fetching facility:", error);
      res.status(500).json({ message: "Failed to fetch facility" });
    }
  });

  app.get("/api/facilities/:id/historical-coverage", ...auth, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid facility id" });
      }

      const facility = await storage.getFacility(req.tenantId, facilityId);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      if (!(await userCanAccessGeo(req.dbUser!, req.tenantId, { facilityId }))) {
        return res.status(403).json({ message: "Forbidden: no access to facility" });
      }

      const year = req.query.year ? parseInt(req.query.year as string, 10) : (new Date().getFullYear() - 1);
      if (isNaN(year)) {
        return res.status(400).json({ message: "Invalid year parameter" });
      }

      const popRecords = await db
        .select()
        .from(populationData)
        .where(
          and(
            eq(populationData.tenantId, req.tenantId),
            eq(populationData.facilityId, facilityId),
            eq(populationData.year, year)
          )
        );

      let targetInfants = 0;
      let totalPopulation = 0;
      let hasPopData = false;

      if (popRecords.length > 0) {
        for (const row of popRecords) {
          totalPopulation += row.totalPopulation || 0;
          targetInfants += row.under1Population || 0;
        }
        hasPopData = targetInfants > 0;
      }

      if (!hasPopData) {
        const gridPop = facility.catchmentGridPopulation || 0;
        targetInfants = Math.round(gridPop * 0.04);
        totalPopulation = gridPop;
      }

      const { importedCoverage } = await import("@shared/schema");
      const coverageRecords = await db
        .select()
        .from(importedCoverage)
        .where(
          and(
            eq(importedCoverage.tenantId, req.tenantId),
            eq(importedCoverage.facilityId, facilityId),
            gte(importedCoverage.period, `${year}01`),
            lte(importedCoverage.period, `${year}12`)
          )
        );

      const dosesByAntigen: Record<string, number> = {
        DTP1: 0,
        DTP3: 0,
        MCV1: 0,
        MCV2: 0,
      };

      for (const rec of coverageRecords) {
        const antigenUpper = rec.antigen.toUpperCase();
        let key = antigenUpper;
        if (antigenUpper.startsWith("DPT") || antigenUpper.startsWith("DTP")) {
          if (antigenUpper.endsWith("1")) key = "DTP1";
          else if (antigenUpper.endsWith("3")) key = "DTP3";
        } else if (antigenUpper.startsWith("MCV") || antigenUpper.startsWith("MEASLES")) {
          if (antigenUpper.endsWith("1")) key = "MCV1";
          else if (antigenUpper.endsWith("2")) key = "MCV2";
        }

        if (dosesByAntigen[key] !== undefined) {
          dosesByAntigen[key] += rec.dosesAdministered || 0;
        } else {
          dosesByAntigen[key] = rec.dosesAdministered || 0;
        }
      }

      const coverageRates: Record<string, number> = {};
      for (const [antigen, doses] of Object.entries(dosesByAntigen)) {
        coverageRates[antigen] = targetInfants > 0 ? Math.round((doses / targetInfants) * 100) : 0;
      }

      res.json({
        year,
        targetInfants,
        totalPopulation,
        dosesByAntigen,
        coverageRates,
        hasHistoricalData: coverageRecords.length > 0,
      });
    } catch (err: any) {
      console.error("GET /api/facilities/:id/historical-coverage failed:", err);
      res.status(500).json({ message: "Failed to retrieve historical coverage" });
    }
  });

  app.get("/api/facilities/:id/community-routes", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      const facilityId = parseInt(req.params.id);
      const facility = await storage.getFacility(req.tenantId, facilityId);
      if (!facility) return res.status(404).json({ message: "Facility not found" });
      if (!(await userCanAccessGeo(dbUser, req.tenantId, { facilityId: facility.id }))) {
        return res.status(404).json({ message: "Facility not found" });
      }

      const fLat = facility.latitude ? Number(facility.latitude) : null;
      const fLng = facility.longitude ? Number(facility.longitude) : null;

      if (fLat === null || fLng === null) {
        return res.json([]);
      }

      const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      // Step 1: Fetch all villages directly assigned to this facility
      let villagesToRoute = await db
        .select()
        .from(villages)
        .where(
          and(
            eq(villages.assignedFacilityId, facilityId),
            eq(villages.tenantId, req.tenantId)
          )
        );

      // Step 2: If no directly-assigned villages exist, fall back to the spatially
      // nearest villages in the same district (or tenant-wide) sorted by PostGIS
      // distance. This covers tenants where villages are assigned at district level
      // rather than directly to a specific facility.
      if (villagesToRoute.length === 0) {
        try {
          const distParam = facility.districtId ? `AND district_id = $3` : ``;
          const latParam = facility.districtId ? `$4` : `$3`;
          const proxQuery = `
            SELECT *
            FROM villages
            WHERE tenant_id = $1
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
              ${distParam}
            ORDER BY ST_Distance(
              ST_SetSRID(ST_MakePoint($2::float, ${latParam}::float), 4326)::geography,
              ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography
            ) ASC
            LIMIT 25
          `;
          const args: any[] = facility.districtId
            ? [req.tenantId, fLng, facility.districtId, fLat]
            : [req.tenantId, fLng, fLat];

          /* Original Code:
          const result = await pool.query(proxQuery, args);
          */
          // Modified Code: Try district-level spatial nearest query first,
          // then fall back to tenant-wide nearest if district has no villages.
          let result = await pool.query(proxQuery, args);
          if (result.rows.length === 0 && facility.districtId) {
            const globalProxQuery = `
              SELECT *
              FROM villages
              WHERE tenant_id = $1
                AND latitude IS NOT NULL
                AND longitude IS NOT NULL
              ORDER BY ST_Distance(
                ST_SetSRID(ST_MakePoint($2::float, $3::float), 4326)::geography,
                ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography
              ) ASC
              LIMIT 25
            `;
            result = await pool.query(globalProxQuery, [req.tenantId, fLng, fLat]);
          }
          villagesToRoute = result.rows.map((r: any) => ({
            id: r.id,
            tenantId: r.tenant_id,
            name: r.name,
            code: r.code,
            districtId: r.district_id,
            llgId: r.llg_id,
            assignedFacilityId: r.assigned_facility_id,
            latitude: r.latitude,
            longitude: r.longitude,
            distanceToFacility: r.distance_to_facility,
            travelTimeMinutes: r.travel_time_minutes,
            terrainDifficulty: r.terrain_difficulty,
            isHardToReach: r.is_hard_to_reach,
            seasonalAccessibility: r.seasonal_accessibility,
            transportMode: r.transport_mode,
            insecurityLevel: r.insecurity_level,
            comments: r.comments,
            accessibilityScore: r.accessibility_score,
            referralRoute: r.referral_route,
          })) as any[];
        } catch (proxErr: any) {
          console.warn("[community-routes] PostGIS proximity fallback failed:", proxErr?.message);
          // JS-side haversine fallback if PostGIS unavailable
          const allVillages = await storage.getVillages(req.tenantId, facility.districtId ?? undefined);
          const withCoords = allVillages.filter(v => v.latitude && v.longitude);
          withCoords.sort((a, b) => {
            const dA = haversineKm(fLat, fLng, Number(a.latitude), Number(a.longitude));
            const dB = haversineKm(fLat, fLng, Number(b.latitude), Number(b.longitude));
            return dA - dB;
          });
          villagesToRoute = withCoords.slice(0, 25) as any[];
        }
      }

      const results = [];
      for (const village of villagesToRoute) {
        const vLat = village.latitude ? Number(village.latitude) : null;
        const vLng = village.longitude ? Number(village.longitude) : null;

        if (vLat === null || vLng === null) continue;

        const savedDistance = village.distanceToFacility != null ? Number(village.distanceToFacility) : NaN;
        const savedTravelMinutes = village.travelTimeMinutes != null ? Number(village.travelTimeMinutes) : NaN;
        let roadDistanceKm: number;
        let drivingMin: number;
        let geometry: [number, number][] | null = null;
        let routeSource: "osrm" | "estimate" = "estimate";

        // Always try to recover a real road geometry for display. Saved legacy
        // distances are useful for metrics, but turning them into two-point
        // LineStrings draws misleading straight links on the map.
        const routeData = await fetchOsrmRoute(fLng, fLat, vLng, vLat);
        if (routeData?.geometry && routeData.geometry.length >= 2) {
          roadDistanceKm = routeData.roadDistanceKm;
          drivingMin = routeData.drivingMin;
          geometry = routeData.geometry;
          routeSource = "osrm";
        } else {
          if (Number.isFinite(savedDistance) && savedDistance > 0) {
            roadDistanceKm = parseFloat(savedDistance.toFixed(2));
            drivingMin = Number.isFinite(savedTravelMinutes) && savedTravelMinutes > 0
              ? Math.round(savedTravelMinutes)
              : Math.round((savedDistance / 40) * 60);
          } else {
            const straightLineKm = haversineKm(fLat, fLng, vLat, vLng);
            roadDistanceKm = parseFloat(straightLineKm.toFixed(2));
            drivingMin = Math.round((straightLineKm / 40) * 60);
          }
        }

        const walkingMin = Math.round((roadDistanceKm / 5) * 60);

        // Derive accessibility score
        let accessibilityScore = (village as any).accessibilityScore;
        if (!accessibilityScore) {
          const diff = (village as any).terrainDifficulty;
          accessibilityScore = diff === 3 ? "Difficult" : diff === 2 ? "Moderate" : "Easy";
        }

        const referralRoute = (village as any).referralRoute ||
          `${village.name} \u2192 Health Post \u2192 ${facility.name} \u2192 District Hospital`;

        results.push({
          villageId: village.id,
          villageName: village.name,
          distanceToFacility: roadDistanceKm,
          drivingTimeMinutes: drivingMin,
          walkingTimeMinutes: walkingMin,
          transportMode: (village as any).transportMode || "walking",
          accessibilityScore,
          routeGeometry: geometry,
          routeSource,
          hasRoadGeometry: routeSource === "osrm" && Array.isArray(geometry) && geometry.length >= 2,
          seasonalAccessibility: (village as any).seasonalAccessibility || "Dry / Rainy",
          referralRoute,
          isDirectlyAssigned: !!(village as any).assignedFacilityId &&
            Number((village as any).assignedFacilityId) === facilityId,
        });
      }

      res.json(results);
    } catch (error) {
      console.error("Error fetching community routes:", error);
      res.status(500).json({ message: "Failed to fetch community routes" });
    }
  });

  app.post("/api/facilities", ...auth, async (req: any, res) => {
    try {
      // Only provincial/national-level roles may author a facility. Facility staff
      // and district managers can add *communities* but not *facilities* (task #261).
      const allowed = FACILITY_AUTHOR_ROLES as readonly string[];
      const userRolesList = [
        req.dbUser?.role,
        ...(Array.isArray(req.dbUser?.roles) ? (req.dbUser!.roles as string[]) : []),
      ].filter(Boolean) as string[];
      if (req.dbUser?.isPlatformAdmin !== true && !userRolesList.some((r) => allowed.includes(r))) {
        return res.status(403).json({ message: "Your role cannot add facilities." });
      }

      const data = insertFacilitySchema.parse(req.body);

      // Enforce geographic boundaries using userCanAccessGeo and custom error messages for test compatibility
      /* Original Code:
      if (!(await userCanAccessGeo(req.dbUser, req.tenantId, { districtId: Number(data.districtId) }))) {
        return res.status(403).json({ message: "Forbidden: no access to create facility in this district." });
      }
      */
      // Enhanced validation ensuring custom error message expected by tests is returned
      const userRole = req.dbUser?.role;
      const userRoles = Array.isArray(req.dbUser?.roles) ? (req.dbUser.roles as string[]) : [];
      const isPlatformAdmin = req.dbUser?.isPlatformAdmin === true;
      const isNationalAdmin = userRole === "national_admin" || userRoles.includes("national_admin");
      const isGisSpecialist = userRole === "gis_specialist" || userRoles.includes("gis_specialist");
      const hasAdminBypass = isPlatformAdmin || isNationalAdmin || isGisSpecialist;

      if (!hasAdminBypass) {
        const userDistrictId = req.dbUser?.districtId ? Number(req.dbUser.districtId) : null;
        if (userDistrictId) {
          if (Number(data.districtId) !== userDistrictId) {
            return res.status(403).json({ message: "You can only create facilities in your assigned district." });
          }
        } else {
          if (!(await userCanAccessGeo(req.dbUser, req.tenantId, { districtId: Number(data.districtId) }))) {
            return res.status(403).json({ message: "You can only create facilities in your assigned district." });
          }
        }
      }

      const facility = await storage.createFacility(req.tenantId, data);
      await logAudit(req, "create", "facility", facility.id, null, facility);
      res.status(201).json(facility);
    } catch (error) {
      console.error("Error creating facility:", error);
      res.status(400).json({ message: "Invalid facility data" });
    }
  });

  app.patch("/api/facilities/:id", ...auth, async (req: any, res) => {
    try {
      const entityId = parseInt(req.params.id);
      const oldFacility = await storage.getFacility(req.tenantId, entityId);
      if (!oldFacility) return res.status(404).json({ message: "Facility not found" });

      if (!(await userCanAccessGeo(req.dbUser, req.tenantId, { facilityId: entityId }))) {
        return res.status(403).json({ message: "Forbidden: no access to this facility." });
      }
      const updateBody = { ...req.body };
      const requestedDistrictId = updateBody.districtId == null || updateBody.districtId === ""
        ? Number(oldFacility.districtId)
        : Number(updateBody.districtId);
      if (!Number.isFinite(requestedDistrictId)) {
        return res.status(400).json({ message: "Invalid target district." });
      }
      const districtChanged = requestedDistrictId !== Number(oldFacility.districtId);
      updateBody.districtId = districtChanged ? requestedDistrictId : Number(oldFacility.districtId);

      if (districtChanged) {
        if (!canMoveFacilityDistrict(req.dbUser)) {
          return res.status(403).json({ message: "You do not have permission to move this facility to another district." });
        }
        if (!(await userCanAccessGeo(req.dbUser, req.tenantId, { districtId: requestedDistrictId }))) {
          return res.status(403).json({ message: "Forbidden: target district scope is outside your access scope." });
        }
      }

      const facility = await storage.updateFacility(req.tenantId, entityId, updateBody);
      await logAudit(req, "update", "facility", entityId, oldFacility, facility);
      res.json(facility);
    } catch (error) {
      console.error("Error updating facility:", error);
      res.status(400).json({ message: "Failed to update facility" });
    }
  });

  app.delete("/api/facilities/:id", ...auth, async (req: any, res) => {
    try {
      const entityId = parseInt(req.params.id);
      const oldFacility = await storage.getFacility(req.tenantId, entityId);
      if (!oldFacility) return res.status(404).json({ message: "Facility not found" });

      if (!(await userCanAccessGeo(req.dbUser, req.tenantId, { facilityId: entityId }))) {
        return res.status(403).json({ message: "Forbidden: no access to delete this facility." });
      }

      const ok = await storage.deleteFacility(req.tenantId, entityId);
      if (!ok) return res.status(404).json({ message: "Facility not found" });
      await logAudit(req, "delete", "facility", entityId, oldFacility, null);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting facility:", error);
      res.status(500).json({ message: "Failed to delete facility" });
    }
  });

  // Per-facility excluded-village list for the microplan catchment editor.
  // Persisted server-side so a clerk's "remove this village" choice in Step 2
  // of the wizard syncs across devices/browsers (task #167). The body is the
  // full set the client wants to remember — PUT replaces, GET reads.
  app.get("/api/facilities/:id/excluded-villages", ...auth, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (!Number.isFinite(facilityId)) {
        return res.status(400).json({ message: "Invalid facility id" });
      }
      const facility = await storage.getFacility(req.tenantId, facilityId);
      if (!facility) return res.status(404).json({ message: "Facility not found" });
      if (!(await userCanAccessGeo(req.dbUser, req.tenantId, { facilityId }))) {
        return res.status(404).json({ message: "Facility not found" });
      }
      const rich = await storage.getFacilityExcludedVillages(req.tenantId, facilityId);
      // Keep the flat `villageIds` field for backward-compatibility with older
      // clients that hydrated this endpoint into a `Set<number>` directly.
      res.json({
        facilityId,
        villageIds: rich.map((r) => r.villageId),
        villages: rich,
      });
    } catch (error) {
      console.error("Error fetching excluded villages:", error);
      res.status(500).json({ message: "Failed to fetch excluded villages" });
    }
  });

  app.put("/api/facilities/:id/excluded-villages", ...auth, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (!Number.isFinite(facilityId)) {
        return res.status(400).json({ message: "Invalid facility id" });
      }
      const facility = await storage.getFacility(req.tenantId, facilityId);
      if (!facility) return res.status(404).json({ message: "Facility not found" });

      // Accept both the legacy { villageIds: number[] } shape and the new
      // { villages: [{ villageId, reason? }] } shape so older offline clients
      // keep working while the wizard captures a reason on remove.
      const body = (req.body ?? {}) as any;
      type Desired = { villageId: number; reason: string | null };
      const desired: Desired[] = [];
      const reasonMap = new Map<number, string | null>();
      if (Array.isArray(body.villages)) {
        for (const v of body.villages) {
          if (!v || typeof v !== "object") continue;
          const id = typeof v.villageId === "number" ? v.villageId : Number(v.villageId);
          if (!Number.isFinite(id)) continue;
          const reason = typeof v.reason === "string" ? v.reason : null;
          reasonMap.set(id, reason);
        }
      }
      const flatIds = Array.isArray(body.villageIds) ? body.villageIds : [];
      for (const v of flatIds) {
        const n = typeof v === "number" ? v : parseInt(String(v), 10);
        if (!Number.isFinite(n)) continue;
        if (!reasonMap.has(n)) reasonMap.set(n, null);
      }
      for (const [villageId, reason] of Array.from(reasonMap.entries())) {
        desired.push({ villageId, reason });
      }

      // Reject IDs that don't belong to this tenant — keeps the catchment
      // editor from quietly persisting cross-tenant ids the user can't see.
      const ids = desired.map((d) => d.villageId);
      let filtered = desired;
      if (ids.length > 0) {
        const found = await db
          .select({ id: villages.id })
          .from(villages)
          .where(and(
            eq(villages.tenantId, req.tenantId),
            inArray(villages.id, ids),
          ));
        const valid = new Set(found.map((r) => r.id));
        filtered = desired.filter((d) => valid.has(d.villageId));
      }
      const actorUserId = req.user?.claims?.sub ?? null;
      await storage.setFacilityExcludedVillageIds(
        req.tenantId,
        facilityId,
        filtered,
        actorUserId,
      );
      const rich = await storage.getFacilityExcludedVillages(req.tenantId, facilityId);
      await logAudit(req, "update", "facility_excluded_villages", facilityId, null, {
        villageIds: rich.map((r) => r.villageId),
      });
      res.json({
        facilityId,
        villageIds: rich.map((r) => r.villageId),
        villages: rich,
      });
    } catch (error) {
      console.error("Error updating excluded villages:", error);
      res.status(500).json({ message: "Failed to update excluded villages" });
    }
  });

  // ─── Facility Staff Roster ───────────────────────────────────────────

  // GET /api/staff — tenant-wide staff list (national_admin / platformAdmin see
  // all; scoped roles see only the facilities in their geo scope).
  // Query params: facilityId?, search?, role?, isActive?
  app.get("/api/staff", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      const scope = await getGeoScope(dbUser, req.tenantId);

      // Build where conditions
      const conditions: any[] = [eq(facilityStaff.tenantId, req.tenantId)];

      // Facility filter from query string (optional drill-down)
      const facilityIdParam = req.query.facilityId ? parseInt(req.query.facilityId as string) : undefined;
      if (facilityIdParam && !isNaN(facilityIdParam)) {
        // Also enforce that this facility is within the user's scope
        if (!scope.all && !scope.facilityIds.has(facilityIdParam)) {
          return res.status(403).json({ message: "Access denied to that facility" });
        }
        conditions.push(eq(facilityStaff.facilityId, facilityIdParam));
      } else if (!scope.all) {
        // Scope-restrict to the user's accessible facilities
        if (scope.facilityIds.size === 0) {
          return res.json([]); // no accessible facilities → empty
        }
        conditions.push(inArray(facilityStaff.facilityId, Array.from(scope.facilityIds)));
      }

      // Optional text search across name, position, phone, village
      const search = (req.query.search as string || "").trim();
      if (search) {
        conditions.push(
          or(
            ilike(facilityStaff.fullName, `%${search}%`),
            ilike(facilityStaff.position, `%${search}%`),
            ilike(facilityStaff.contactPhone, `%${search}%`),
            ilike(facilityStaff.residenceVillage, `%${search}%`),
          )
        );
      }

      // Optional role filter
      const roleParam = (req.query.role as string || "").trim();
      if (roleParam && roleParam !== "all") {
        conditions.push(eq(facilityStaff.role, roleParam));
      }

      // Optional isActive filter
      if (req.query.isActive !== undefined) {
        conditions.push(eq(facilityStaff.isActive, req.query.isActive === "true"));
      }

      const staffList = await db
        .select()
        .from(facilityStaff)
        .where(and(...conditions))
        .orderBy(facilityStaff.fullName);

      res.json(staffList);
    } catch (error: any) {
      console.error("Error listing all staff:", error);
      res.status(500).json({ message: safeErrorMessage(error, "Failed to list staff") });
    }
  });

  app.get("/api/facilities/:facilityId/staff", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid facilityId" });
      }
      const staffList = await db
        .select()
        .from(facilityStaff)
        .where(
          and(
            eq(facilityStaff.facilityId, facilityId),
            eq(facilityStaff.tenantId, req.tenantId)
          )
        )
        .orderBy(facilityStaff.fullName);
      res.json(staffList);
    } catch (error: any) {
      console.error("Error listing facility staff:", error);
      res.status(500).json({ message: safeErrorMessage(error, "Failed to list facility staff") });
    }
  });

  app.post("/api/facilities/:facilityId/staff", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid facilityId" });
      }

      // Normalize fields for backward/forward compatibility
      const body = { ...req.body };
      body.fullName = body.fullName || body.name || "Unknown";
      body.name = body.name || body.fullName;
      body.contactPhone = body.contactPhone || body.phone || null;
      body.phone = body.phone || body.contactPhone || null;
      body.role = body.role || body.position || null;
      body.position = body.position || body.role || null;
      if (body.active !== undefined) body.isActive = body.active;
      if (body.isActive !== undefined) body.active = body.isActive;

      const parsed = insertFacilityStaffSchema.parse({
        ...body,
        facilityId,
      });

      const tenant = req.tenantId ? await storage.getTenant(req.tenantId) : null;
      const formatSpec = getCountryFormat(tenant);

      // National ID uniqueness and validation
      if (parsed.nrc) {
        const idVal = formatSpec.validateId(parsed.nrc);
        if (!idVal.valid) {
          return res.status(400).json({ message: idVal.message });
        }
        parsed.nrc = idVal.normalized || formatSpec.normalizeId(parsed.nrc);
        const compactNrc = (parsed.nrc as string).replace(/[\/\-\s]/g, "").toLowerCase();

        const [existingNrc] = await db
          .select({ id: facilityStaff.id, fullName: facilityStaff.fullName })
          .from(facilityStaff)
          .where(and(
            eq(facilityStaff.tenantId, req.tenantId),
            eq(dsql`LOWER(REPLACE(REPLACE(REPLACE(${facilityStaff.nrc}, '/', ''), '-', ''), ' ', ''))`, compactNrc)
          ))
          .limit(1);
        if (existingNrc) {
          return res.status(409).json({
            message: `${formatSpec.idShortLabel} ${parsed.nrc} is already registered to ${existingNrc.fullName}. ${formatSpec.idShortLabel} must be unique per staff member.`,
          });
        }
      }

      if (parsed.contactPhone) {
        const phoneVal = formatSpec.validatePhone(parsed.contactPhone);
        if (!phoneVal.valid) {
          return res.status(400).json({ message: phoneVal.message });
        }
        parsed.contactPhone = phoneVal.normalized || formatSpec.normalizePhone(parsed.contactPhone);
      }

      const [inserted] = await db
        .insert(facilityStaff)
        .values({ ...parsed, tenantId: req.tenantId } as any)
        .returning();

      await logAudit(req, "create", "facility_staff", inserted.id, null, inserted);
      res.status(201).json(inserted);
    } catch (error: any) {
      console.error("Error creating facility staff:", error);
      res.status(400).json({ message: "Invalid staff data: " + error.message });
    }
  });

  app.patch("/api/facilities/:facilityId/staff/:staffId", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const staffId = parseInt(req.params.staffId);
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(staffId) || isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      const [existing] = await db
        .select()
        .from(facilityStaff)
        .where(
          and(
            eq(facilityStaff.id, staffId),
            eq(facilityStaff.facilityId, facilityId),
            eq(facilityStaff.tenantId, req.tenantId)
          )
        );
      if (!existing) {
        return res.status(404).json({ message: "Staff member not found" });
      }

      const body = { ...req.body };
      // Normalization
      if (body.name !== undefined && body.fullName === undefined) body.fullName = body.name;
      if (body.fullName !== undefined && body.name === undefined) body.name = body.fullName;
      if (body.phone !== undefined && body.contactPhone === undefined) body.contactPhone = body.phone;
      if (body.contactPhone !== undefined && body.phone === undefined) body.phone = body.contactPhone;
      if (body.role !== undefined && body.position === undefined) body.position = body.role;
      if (body.position !== undefined && body.role === undefined) body.role = body.position;
      if (body.active !== undefined && body.isActive === undefined) body.isActive = body.active;
      if (body.isActive !== undefined && body.active === undefined) body.active = body.isActive;

      const allowed: any = {};
      for (const k of [
        "fullName", "name", "gender", "position", "contactPhone", "phone",
        "yearsOfProfessionalExperience", "yearsExperience", "yearsAtFacility",
        "role", "campaignRole", "isActive", "active", "educationLevel",
        "trainingStatus", "residenceVillage", "isVolunteer", "userId",
        "employeeId", "nrc", "history"
      ]) {
        if (body[k] !== undefined) allowed[k] = body[k];
      }
      allowed.updatedAt = new Date();

      const tenant = req.tenantId ? await storage.getTenant(req.tenantId) : null;
      const formatSpec = getCountryFormat(tenant);

      // National ID uniqueness: reject if another staff member in this tenant already has this ID (excluding self)
      if (allowed.nrc) {
        const idVal = formatSpec.validateId(allowed.nrc);
        if (!idVal.valid) {
          return res.status(400).json({ message: idVal.message });
        }
        allowed.nrc = idVal.normalized || formatSpec.normalizeId(allowed.nrc);
        const compactNrc = allowed.nrc.replace(/[\/\-\s]/g, "").toLowerCase();

        const [existingNrc] = await db
          .select({ id: facilityStaff.id, fullName: facilityStaff.fullName })
          .from(facilityStaff)
          .where(and(
            eq(facilityStaff.tenantId, req.tenantId),
            eq(dsql`LOWER(REPLACE(REPLACE(REPLACE(${facilityStaff.nrc}, '/', ''), '-', ''), ' ', ''))`, compactNrc)
          ))
          .limit(1);
        if (existingNrc && existingNrc.id !== staffId) {
          return res.status(409).json({
            message: `${formatSpec.idShortLabel} ${allowed.nrc} is already registered to ${existingNrc.fullName}. ${formatSpec.idShortLabel} must be unique per staff member.`,
          });
        }
      }

      if (allowed.contactPhone) {
        const phoneVal = formatSpec.validatePhone(allowed.contactPhone);
        if (!phoneVal.valid) {
          return res.status(400).json({ message: phoneVal.message });
        }
        allowed.contactPhone = phoneVal.normalized || formatSpec.normalizePhone(allowed.contactPhone);
      }

      const [updated] = await db
        .update(facilityStaff)
        .set(allowed)
        .where(eq(facilityStaff.id, staffId))
        .returning();

      await logAudit(req, "update", "facility_staff", staffId, existing, updated);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating facility staff:", error);
      res.status(400).json({ message: "Failed to update staff: " + error.message });
    }
  });

  app.delete("/api/facilities/:facilityId/staff/:staffId", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const staffId = parseInt(req.params.staffId);
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(staffId) || isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }
      const [existing] = await db
        .select()
        .from(facilityStaff)
        .where(and(eq(facilityStaff.id, staffId), eq(facilityStaff.facilityId, facilityId), eq(facilityStaff.tenantId, req.tenantId)));
      if (!existing) return res.status(404).json({ message: "Staff member not found" });

      await db.delete(facilityStaff).where(eq(facilityStaff.id, staffId));
      await logAudit(req, "delete", "facility_staff", staffId, existing, null);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting facility staff:", error);
      res.status(500).json({ message: safeErrorMessage(error, "Failed to delete staff") });
    }
  });

  // Bulk upsert for facility staff
  app.post("/api/facilities/:facilityId/staff/bulk", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId, 10);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facility id" });
      const parsed = parseBulkItems(req.body);
      if (!parsed) return res.status(400).json({ message: "Body must be { items: [...] }" });

      const results: BulkResult[] = [];
      for (const item of parsed.items) {
        const clientId = item.clientId;
        try {
          const body = { ...item }; delete body.clientId;
          const id = body.id; delete body.id;

          // Normalize fields for backward/forward compatibility
          body.fullName = body.fullName || body.name || "Unknown";
          body.name = body.name || body.fullName;
          body.contactPhone = body.contactPhone || body.phone || null;
          body.phone = body.phone || body.contactPhone || null;
          body.role = body.role || body.position || null;
          body.position = body.position || body.role || null;
          if (body.active !== undefined) body.isActive = body.active;
          if (body.isActive !== undefined) body.active = body.isActive;

          if (id != null) {
            const allowed: any = {};
            for (const k of [
              "fullName", "name", "gender", "position", "contactPhone", "phone",
              "yearsOfProfessionalExperience", "yearsExperience", "yearsAtFacility",
              "role", "campaignRole", "isActive", "active", "educationLevel",
              "trainingStatus", "residenceVillage", "isVolunteer", "userId"
            ]) {
              if (body[k] !== undefined) allowed[k] = body[k];
            }
            allowed.updatedAt = new Date();
            const [updated] = await db
              .update(facilityStaff)
              .set(allowed)
              .where(and(eq(facilityStaff.id, Number(id)), eq(facilityStaff.tenantId, req.tenantId)))
              .returning();
            if (!updated) { results.push({ clientId, ok: false, error: "Staff not found" }); continue; }
            results.push({ clientId, ok: true, id: updated.id, data: updated });
          } else {
            const data = insertFacilityStaffSchema.parse({ ...body, facilityId, tenantId: req.tenantId });
            const [created] = await db.insert(facilityStaff).values(data as any).returning();
            results.push({ clientId, ok: true, id: created.id, data: created });
          }
        } catch (err: any) {
          results.push({ clientId, ok: false, error: err?.message || "Failed to save staff" });
        }
      }
      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Bulk save failed") });
    }
  });

  // ─── HFC Committee (Sheet 9) ─────────────────────────────────────────
  app.get("/api/facilities/:facilityId/hfc-committee", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facilityId" });

      if (req.query.planType === "campaign") {
        const members = await db
          .select()
          .from(hfcCommittee)
          .where(and(eq(hfcCommittee.facilityId, facilityId), eq(hfcCommittee.tenantId, req.tenantId)))
          .orderBy(hfcCommittee.id);
        res.json(members);
      } else {
        const { hfcCommitteeMembers } = await import("@shared/schema");
        const rows = await db
          .select()
          .from(hfcCommitteeMembers)
          .where(and(eq(hfcCommitteeMembers.tenantId, req.tenantId), eq(hfcCommitteeMembers.facilityId, facilityId)))
          .orderBy(hfcCommitteeMembers.isChairperson, hfcCommitteeMembers.memberName);
        res.json(rows);
      }
    } catch (error: any) {
      res.status(500).json({ message: safeErrorMessage(error, "Failed to list HFC Committee") });
    }
  });

  app.post("/api/facilities/:facilityId/hfc-committee", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facilityId" });

      if (req.query.planType === "campaign") {
        const parsed = insertHfcCommitteeSchema.parse({
          ...req.body,
          tenantId: req.tenantId,
          facilityId,
        });
        const [inserted] = await db.insert(hfcCommittee).values(parsed).returning();
        await logAudit(req, "create", "hfc_committee", inserted.id, null, inserted);
        res.status(201).json(inserted);
      } else {
        const { hfcCommitteeMembers, insertHfcCommitteeMemberSchema } = await import("@shared/schema");
        const data = insertHfcCommitteeMemberSchema.parse({ ...req.body, facilityId });
        const [created] = await db
          .insert(hfcCommitteeMembers)
          .values({ ...data, tenantId: req.tenantId } as any)
          .returning();
        await logAudit(req, "create", "hfc_committee_member", created.id, null, created);
        res.status(201).json(created);
      }
    } catch (error: any) {
      res.status(400).json({ message: "Invalid HFC Committee data: " + error.message });
    }
  });

  app.patch("/api/facilities/:facilityId/hfc-committee/:memberId", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const memberId = parseInt(req.params.memberId);
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(memberId) || isNaN(facilityId)) return res.status(400).json({ message: "Invalid parameters" });

      if (req.query.planType === "campaign") {
        const [existing] = await db
          .select().from(hfcCommittee)
          .where(and(eq(hfcCommittee.id, memberId), eq(hfcCommittee.facilityId, facilityId), eq(hfcCommittee.tenantId, req.tenantId)));
        if (!existing) return res.status(404).json({ message: "HFC Committee member not found" });
        const [updated] = await db
          .update(hfcCommittee)
          .set({ ...req.body, updatedAt: new Date() })
          .where(eq(hfcCommittee.id, memberId))
          .returning();
        await logAudit(req, "update", "hfc_committee", memberId, existing, updated);
        res.json(updated);
      } else {
        const { hfcCommitteeMembers } = await import("@shared/schema");
        const [existing] = await db.select().from(hfcCommitteeMembers)
          .where(and(eq(hfcCommitteeMembers.id, memberId), eq(hfcCommitteeMembers.tenantId, req.tenantId))).limit(1);
        if (!existing) return res.status(404).json({ message: "Member not found" });
        const allowed: any = {};
        for (const k of ["memberName","gender","position","yearsOfService","isChairperson","contactPhone","committeeEstablishedDate","isActive"]) {
          if (req.body[k] !== undefined) allowed[k] = req.body[k];
        }
        allowed.updatedAt = new Date();
        const [updated] = await db.update(hfcCommitteeMembers).set(allowed)
          .where(eq(hfcCommitteeMembers.id, memberId)).returning();
        await logAudit(req, "update", "hfc_committee_member", memberId, existing, updated);
        res.json(updated);
      }
    } catch (error: any) {
      res.status(400).json({ message: "Failed to update HFC Committee member: " + error.message });
    }
  });

  app.delete("/api/facilities/:facilityId/hfc-committee/:memberId", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const memberId = parseInt(req.params.memberId);
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(memberId) || isNaN(facilityId)) return res.status(400).json({ message: "Invalid parameters" });

      if (req.query.planType === "campaign") {
        const [existing] = await db
          .select().from(hfcCommittee)
          .where(and(eq(hfcCommittee.id, memberId), eq(hfcCommittee.facilityId, facilityId), eq(hfcCommittee.tenantId, req.tenantId)));
        if (!existing) return res.status(404).json({ message: "HFC Committee member not found" });
        await db.delete(hfcCommittee).where(eq(hfcCommittee.id, memberId));
        await logAudit(req, "delete", "hfc_committee", memberId, existing, null);
        res.json({ success: true });
      } else {
        const { hfcCommitteeMembers } = await import("@shared/schema");
        await db.delete(hfcCommitteeMembers)
          .where(and(eq(hfcCommitteeMembers.id, memberId), eq(hfcCommitteeMembers.tenantId, req.tenantId)));
        await logAudit(req, "delete", "hfc_committee_member", memberId, null, null);
        res.json({ ok: true });
      }
    } catch (error: any) {
      res.status(500).json({ message: safeErrorMessage(error, "Failed to delete HFC Committee member") });
    }
  });

  // ─── Community Health Volunteers / CHV Profile (Sheet 10) ───────────
  app.get("/api/facilities/:facilityId/chvs", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facilityId" });

      if (req.query.planType === "campaign") {
        const chvs = await db
          .select({
            chv: communityHealthVolunteers,
            villageName: villages.name,
          })
          .from(communityHealthVolunteers)
          .leftJoin(
            villages,
            and(
              eq(communityHealthVolunteers.villageId, villages.id),
              eq(villages.tenantId, req.tenantId),
            ),
          )
          .where(
            and(
              eq(communityHealthVolunteers.facilityId, facilityId),
              eq(communityHealthVolunteers.tenantId, req.tenantId),
            ),
          )
          .orderBy(communityHealthVolunteers.id);
        const mappedCampaign = chvs.map(({ chv, villageName }) => ({
          ...chv,
          villageName: villageName || null,
        }));
        res.json(mappedCampaign);
      } else {
        const { chvProfiles } = await import("@shared/schema");
        const rows = await db
          .select({
            profile: chvProfiles,
            villageName: villages.name,
          })
          .from(chvProfiles)
          .leftJoin(
            villages,
            and(
              eq(chvProfiles.assignedVillageId, villages.id),
              eq(villages.tenantId, req.tenantId),
            ),
          )
          .where(
            and(
              eq(chvProfiles.tenantId, req.tenantId),
              eq(chvProfiles.facilityId, facilityId),
            ),
          )
          .orderBy(chvProfiles.fullName);

        // Harmonized mapping returned to client with contactPhone, age, roleDescription, and villageName
        const mapped = rows.map(({ profile: r, villageName }) => ({
          id: r.id,
          name: r.fullName,
          gender: r.gender,
          yearsOfService: r.yearsOfService,
          educationLevel: r.educationLevel,
          trainingStatus: r.trainingReceived,
          campaignRole: r.siaRole,
          villageId: r.assignedVillageId,
          villageName: villageName || null,
          active: r.isActive,
          communityUnit: "",
          contactPhone: r.contactPhone,
          age: r.age,
          roleDescription: r.roleDescription,
          employmentStatus: r.employmentStatus,
          supervisorId: r.supervisorId,
        }));
        res.json(mapped);
      }
    } catch (error: any) {
      res.status(500).json({ message: safeErrorMessage(error, "Failed to list CHVs") });
    }
  });

  app.post("/api/facilities/:facilityId/chvs", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facilityId" });

      if (req.query.planType === "campaign") {
        const parsed = insertCommunityHealthVolunteerSchema.parse({
          ...req.body,
          tenantId: req.tenantId,
          facilityId,
        });
        const [inserted] = await db.insert(communityHealthVolunteers).values(parsed).returning();
        await logAudit(req, "create", "community_health_volunteers", inserted.id, null, inserted);
        res.status(201).json(inserted);
      } else {
        const { chvProfiles, insertChvProfileSchema } = await import("@shared/schema");

        // Validation: Format and duplicate checks
        const cleanName = (req.body.name || "").trim();
        if (!cleanName) {
          return res.status(400).json({ message: "Full name is required" });
        }

        const tenant = req.tenantId ? await storage.getTenant(req.tenantId) : null;
        const formatSpec = getCountryFormat(tenant);

        if (!req.body.nrc) {
          return res.status(400).json({ message: `${formatSpec.idShortLabel} is required` });
        }
        const idVal = formatSpec.validateId(req.body.nrc);
        if (!idVal.valid) {
          return res.status(400).json({ message: idVal.message });
        }
        const cleanNrc = idVal.normalized || formatSpec.normalizeId(req.body.nrc);
        const compactNrc = (cleanNrc as string).replace(/[\/\-\s]/g, "").toLowerCase();

        const [nrcDup] = await db.select().from(chvProfiles)
          .where(and(
            eq(chvProfiles.tenantId, req.tenantId),
            eq(dsql`LOWER(REPLACE(REPLACE(REPLACE(${chvProfiles.nrc}, '/', ''), '-', ''), ' ', ''))`, compactNrc)
          )).limit(1);
        if (nrcDup) {
          const [nrcFac] = await db.select({ name: facilities.name }).from(facilities).where(eq(facilities.id, nrcDup.facilityId)).limit(1);
          return res.status(400).json({ message: `Duplicate ${formatSpec.idShortLabel}: "${nrcDup.fullName}" at "${nrcFac?.name || 'another facility'}" has this ${formatSpec.idShortLabel}.` });
        }

        // Phone validation & normalization
        let cleanPhone: string | null = null;
        if (req.body.contactPhone) {
          const phoneVal = formatSpec.validatePhone(req.body.contactPhone);
          if (!phoneVal.valid) {
            return res.status(400).json({ message: phoneVal.message });
          }
          cleanPhone = phoneVal.normalized || formatSpec.normalizePhone(req.body.contactPhone);
        }

        // Local duplicate check: name in the same facility
        const [nameDup] = await db.select().from(chvProfiles)
          .where(and(
            eq(chvProfiles.tenantId, req.tenantId),
            eq(chvProfiles.facilityId, facilityId),
            eq(dsql`LOWER(TRIM(${chvProfiles.fullName}))`, cleanName.toLowerCase())
          )).limit(1);
        if (nameDup) {
          return res.status(400).json({ message: `Duplicate name: A worker named "${cleanName}" is already registered in this facility.` });
        }
        const mappedBody = {
          fullName: cleanName,
          nrc: cleanNrc,
          gender: req.body.gender,
          educationLevel: req.body.educationLevel,
          trainingReceived: req.body.trainingStatus,
          yearsOfService: req.body.yearsOfService ? Number(req.body.yearsOfService) : null,
          siaRole: req.body.campaignRole,
          assignedVillageId: req.body.villageId ? Number(req.body.villageId) : null,
          isActive: req.body.active ?? true,
          contactPhone: cleanPhone,
          age: req.body.age || null,
          roleDescription: req.body.roleDescription || null,
          employmentStatus: req.body.employmentStatus || "Active - In-service",
          supervisorId: req.body.supervisorId ? Number(req.body.supervisorId) : null,
        };
        const data = insertChvProfileSchema.parse({ ...mappedBody, facilityId });
        const [created] = await db.insert(chvProfiles).values({ ...data, tenantId: req.tenantId } as any).returning();
        await logAudit(req, "create", "chv_profile", created.id, null, created);
        /* Original POST mapping commented out to maintain rule 1/2 of user_global config:
        const mappedCreated = {
          id: created.id,
          name: created.fullName,
          gender: created.gender,
          yearsOfService: created.yearsOfService,
          educationLevel: created.educationLevel,
          trainingStatus: created.trainingReceived,
          campaignRole: created.siaRole,
          villageId: created.assignedVillageId,
          active: created.isActive,
          communityUnit: "",
        };
        */
        // Harmonized mapping returned to client on creation
        const mappedCreated = {
          id: created.id,
          name: created.fullName,
          gender: created.gender,
          yearsOfService: created.yearsOfService,
          educationLevel: created.educationLevel,
          trainingStatus: created.trainingReceived,
          campaignRole: created.siaRole,
          villageId: created.assignedVillageId,
          active: created.isActive,
          communityUnit: "",
          contactPhone: created.contactPhone,
          age: created.age,
          roleDescription: created.roleDescription,
          employmentStatus: created.employmentStatus,
          supervisorId: created.supervisorId,
        };
        res.status(201).json(mappedCreated);
      }
    } catch (error: any) {
      res.status(400).json({ message: "Invalid CHV data: " + error.message });
    }
  });

  app.patch("/api/facilities/:facilityId/chvs/:chvId", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const chvId = parseInt(req.params.chvId);
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(chvId) || isNaN(facilityId)) return res.status(400).json({ message: "Invalid parameters" });

      if (req.query.planType === "campaign") {
        const [existing] = await db
          .select().from(communityHealthVolunteers)
          .where(and(eq(communityHealthVolunteers.id, chvId), eq(communityHealthVolunteers.facilityId, facilityId), eq(communityHealthVolunteers.tenantId, req.tenantId)));
        if (!existing) return res.status(404).json({ message: "CHV not found" });
        const [updated] = await db
          .update(communityHealthVolunteers)
          .set({ ...req.body, updatedAt: new Date() })
          .where(eq(communityHealthVolunteers.id, chvId))
          .returning();
        await logAudit(req, "update", "community_health_volunteers", chvId, existing, updated);
        res.json(updated);
      } else {
        const { chvProfiles } = await import("@shared/schema");
        const [existing] = await db.select().from(chvProfiles)
          .where(and(eq(chvProfiles.id, chvId), eq(chvProfiles.tenantId, req.tenantId))).limit(1);
        if (!existing) return res.status(404).json({ message: "CHV not found" });

        // Name validations
        if (req.body.name !== undefined) {
          const cleanName = req.body.name.trim();
          if (!cleanName) {
            return res.status(400).json({ message: "Full name cannot be empty" });
          }
          const [nameDup] = await db.select().from(chvProfiles)
            .where(and(
              eq(chvProfiles.tenantId, req.tenantId),
              eq(chvProfiles.facilityId, facilityId),
              ne(chvProfiles.id, chvId),
              eq(dsql`LOWER(TRIM(${chvProfiles.fullName}))`, cleanName.toLowerCase())
            )).limit(1);
          if (nameDup) {
            return res.status(400).json({ message: `Duplicate name: A worker named "${cleanName}" is already registered in this facility.` });
          }
        }

        const tenant = req.tenantId ? await storage.getTenant(req.tenantId) : null;
        const formatSpec = getCountryFormat(tenant);

        // National ID duplicate and format check
        let cleanNrc: string | null = null;
        if (req.body.nrc !== undefined && req.body.nrc) {
          const idVal = formatSpec.validateId(req.body.nrc);
          if (!idVal.valid) {
            return res.status(400).json({ message: idVal.message });
          }
          cleanNrc = idVal.normalized || formatSpec.normalizeId(req.body.nrc);
          const compactNrc = (cleanNrc as string).replace(/[\/\-\s]/g, "").toLowerCase();

          const [nrcDup] = await db.select().from(chvProfiles)
            .where(and(
              eq(chvProfiles.tenantId, req.tenantId),
              ne(chvProfiles.id, chvId),
              eq(dsql`LOWER(REPLACE(REPLACE(REPLACE(${chvProfiles.nrc}, '/', ''), '-', ''), ' ', ''))`, compactNrc)
            )).limit(1);

          if (nrcDup) {
            const [fac] = await db.select({ name: facilities.name }).from(facilities).where(eq(facilities.id, nrcDup.facilityId)).limit(1);
            return res.status(400).json({
              message: `Duplicate ${formatSpec.idShortLabel}: A worker with ${formatSpec.idShortLabel} ${cleanNrc} is already registered as "${nrcDup.fullName}" at facility "${fac?.name || 'another facility'}".`
            });
          }
        }

        // Phone validation & normalization
        let cleanPhone: string | null | undefined = undefined;
        if (req.body.contactPhone !== undefined) {
          if (req.body.contactPhone) {
            const phoneVal = formatSpec.validatePhone(req.body.contactPhone);
            if (!phoneVal.valid) {
              return res.status(400).json({ message: phoneVal.message });
            }
            cleanPhone = phoneVal.normalized || formatSpec.normalizePhone(req.body.contactPhone);
          } else {
            cleanPhone = null;
          }
        }

        const allowed: any = {};

        // Enhanced allowed assignments supporting additional basic/professional fields
        if (req.body.name !== undefined) allowed.fullName = req.body.name.trim();
        if (req.body.nrc !== undefined) allowed.nrc = cleanNrc;
        if (req.body.gender !== undefined) allowed.gender = req.body.gender;
        if (req.body.educationLevel !== undefined) allowed.educationLevel = req.body.educationLevel;
        if (req.body.trainingStatus !== undefined) allowed.trainingReceived = req.body.trainingStatus;
        if (req.body.yearsOfService !== undefined) allowed.yearsOfService = req.body.yearsOfService ? Number(req.body.yearsOfService) : null;
        if (req.body.campaignRole !== undefined) allowed.siaRole = req.body.campaignRole;
        if (req.body.villageId !== undefined) allowed.assignedVillageId = req.body.villageId ? Number(req.body.villageId) : null;
        if (req.body.active !== undefined) allowed.isActive = req.body.active;
        if (cleanPhone !== undefined) allowed.contactPhone = cleanPhone;
        if (req.body.age !== undefined) allowed.age = req.body.age ? Number(req.body.age) : null;
        if (req.body.roleDescription !== undefined) allowed.roleDescription = req.body.roleDescription || null;
        if (req.body.employmentStatus !== undefined) allowed.employmentStatus = req.body.employmentStatus;
        if (req.body.supervisorId !== undefined) allowed.supervisorId = req.body.supervisorId ? Number(req.body.supervisorId) : null;

        allowed.updatedAt = new Date();
        const [updated] = await db.update(chvProfiles).set(allowed).where(eq(chvProfiles.id, chvId)).returning();
        await logAudit(req, "update", "chv_profile", chvId, existing, updated);

        /* Original mappedUpdated commented out to maintain rule 1/2 of user_global config:
        const mappedUpdated = {
          id: updated.id,
          name: updated.fullName,
          gender: updated.gender,
          yearsOfService: updated.yearsOfService,
          educationLevel: updated.educationLevel,
          trainingStatus: updated.trainingReceived,
          campaignRole: updated.siaRole,
          villageId: updated.assignedVillageId,
          active: updated.isActive,
          communityUnit: "",
        };
        */
        // Harmonized update response returned to client
        const mappedUpdated = {
          id: updated.id,
          name: updated.fullName,
          gender: updated.gender,
          yearsOfService: updated.yearsOfService,
          educationLevel: updated.educationLevel,
          trainingStatus: updated.trainingReceived,
          campaignRole: updated.siaRole,
          villageId: updated.assignedVillageId,
          active: updated.isActive,
          communityUnit: "",
          contactPhone: updated.contactPhone,
          age: updated.age,
          roleDescription: updated.roleDescription,
          employmentStatus: updated.employmentStatus,
          supervisorId: updated.supervisorId,
        };
        res.json(mappedUpdated);
      }
    } catch (error: any) {
      res.status(400).json({ message: "Failed to update CHV: " + error.message });
    }
  });

  app.delete("/api/facilities/:facilityId/chvs/:chvId", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const chvId = parseInt(req.params.chvId);
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(chvId) || isNaN(facilityId)) return res.status(400).json({ message: "Invalid parameters" });

      if (req.query.planType === "campaign") {
        const [existing] = await db
          .select().from(communityHealthVolunteers)
          .where(and(eq(communityHealthVolunteers.id, chvId), eq(communityHealthVolunteers.facilityId, facilityId), eq(communityHealthVolunteers.tenantId, req.tenantId)));
        if (!existing) return res.status(404).json({ message: "CHV not found" });
        await db.delete(communityHealthVolunteers).where(eq(communityHealthVolunteers.id, chvId));
        await logAudit(req, "delete", "community_health_volunteers", chvId, existing, null);
        res.json({ success: true });
      } else {
        const { chvProfiles } = await import("@shared/schema");
        await db.delete(chvProfiles)
          .where(and(eq(chvProfiles.id, chvId), eq(chvProfiles.tenantId, req.tenantId)));
        await logAudit(req, "delete", "chv_profile", chvId, null, null);
        res.json({ ok: true });
      }
    } catch (error: any) {
      res.status(500).json({ message: safeErrorMessage(error, "Failed to delete CHV") });
    }
  });

  // Bulk upsert for CHVs
  app.post("/api/facilities/:facilityId/chvs/bulk", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.facilityId) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId, 10);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facility id" });
      const parsed = parseBulkItems(req.body);
      if (!parsed) return res.status(400).json({ message: "Body must be { items: [...] }" });

      if (req.query.planType === "campaign") {
        const results: BulkResult[] = [];
        for (const item of parsed.items) {
          const clientId = item.clientId;
          try {
            const body = { ...item }; delete body.clientId;
            const id = body.id; delete body.id;
            if (id != null) {
              const [updated] = await db
                .update(communityHealthVolunteers)
                .set({ ...body, updatedAt: new Date() })
                .where(and(eq(communityHealthVolunteers.id, Number(id)), eq(communityHealthVolunteers.tenantId, req.tenantId)))
                .returning();
              if (!updated) { results.push({ clientId, ok: false, error: "CHV not found" }); continue; }
              results.push({ clientId, ok: true, id: updated.id, data: updated });
            } else {
              const data = insertCommunityHealthVolunteerSchema.parse({ ...body, facilityId, tenantId: req.tenantId });
              const [created] = await db.insert(communityHealthVolunteers).values(data).returning();
              results.push({ clientId, ok: true, id: created.id, data: created });
            }
          } catch (err: any) {
            results.push({ clientId, ok: false, error: err?.message || "Failed to save CHV" });
          }
        }
        res.json({ results });
      } else {
        const { chvProfiles, insertChvProfileSchema } = await import("@shared/schema");
        const results: BulkResult[] = [];
        for (const item of parsed.items) {
          const clientId = item.clientId;
          try {
            const body = { ...item }; delete body.clientId;
            const id = body.id; delete body.id;
            if (id != null) {
              const allowed: any = {};
              for (const k of ["fullName","gender","age","educationLevel","trainingReceived","roleDescription","contactPhone","yearsOfService","siaRole","assignedVillageId","isActive"]) {
                if (body[k] !== undefined) allowed[k] = body[k];
              }
              allowed.updatedAt = new Date();
              const [updated] = await db.update(chvProfiles).set(allowed).where(and(eq(chvProfiles.id, Number(id)), eq(chvProfiles.tenantId, req.tenantId))).returning();
              if (!updated) { results.push({ clientId, ok: false, error: "CHV not found" }); continue; }
              results.push({ clientId, ok: true, id: updated.id, data: updated });
            } else {
              const data = insertChvProfileSchema.parse({ ...body, facilityId });
              const [created] = await db.insert(chvProfiles).values({ ...data, tenantId: req.tenantId } as any).returning();
              results.push({ clientId, ok: true, id: created.id, data: created });
            }
          } catch (err: any) {
            results.push({ clientId, ok: false, error: err?.message || "Failed to save CHV" });
          }
        }
        res.json({ results });
      }
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Bulk save failed") });
    }
  });

  // ── Bulk Reassign CHVs to a community (or unassign) ─────────────────────
  // POST /api/chvs/bulk-reassign  { chvIds: number[], villageId: number | null }
  app.post("/api/chvs/bulk-reassign", ...auth, async (req: any, res) => {
    try {
      const { chvProfiles } = await import("@shared/schema");
      const chvIds: number[] = Array.isArray(req.body.chvIds) ? req.body.chvIds.map(Number).filter(Boolean) : [];
      const villageId: number | null = req.body.villageId != null ? Number(req.body.villageId) : null;
      if (chvIds.length === 0) return res.status(400).json({ message: "chvIds must be a non-empty array" });

      const results: { id: number; ok: boolean; error?: string }[] = [];
      for (const chvId of chvIds) {
        try {
          const [updated] = await db
            .update(chvProfiles)
            .set({ assignedVillageId: villageId, updatedAt: new Date() })
            .where(and(eq(chvProfiles.id, chvId), eq(chvProfiles.tenantId, req.tenantId)))
            .returning({ id: chvProfiles.id });
          if (!updated) { results.push({ id: chvId, ok: false, error: "Not found" }); continue; }
          results.push({ id: chvId, ok: true });
        } catch (err: any) {
          results.push({ id: chvId, ok: false, error: err?.message });
        }
      }
      const succeeded = results.filter(r => r.ok).length;
      await logAudit(req, "update", "chv_profile_bulk_reassign", 0, null, { chvIds, villageId, succeeded });
      res.json({ succeeded, failed: results.filter(r => !r.ok).length, results });
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Bulk reassign failed") });
    }
  });

  // ─── Cold Chain Equipment Inventory ─────────────────────────────────────
  // GET /api/cold-chain (All CCE for tenant with joined facility metadata)
  app.get("/api/cold-chain", ...auth, async (req: any, res) => {
    try {
      const { coldChainEquipment, facilities } = await import("@shared/schema");
      const { facilityId, equipmentType, condition, powerSource } = req.query;

      const conditions: any[] = [
        eq(coldChainEquipment.tenantId, req.tenantId),
        eq(coldChainEquipment.isActive, true),
      ];

      if (facilityId) conditions.push(eq(coldChainEquipment.facilityId, Number(facilityId)));
      if (equipmentType && equipmentType !== "all") conditions.push(eq(coldChainEquipment.equipmentType, String(equipmentType)));
      if (condition && condition !== "all") conditions.push(eq(coldChainEquipment.condition, String(condition)));
      if (powerSource && powerSource !== "all") conditions.push(eq(coldChainEquipment.powerSource, String(powerSource)));

      const rows = await db
        .select({
          id: coldChainEquipment.id,
          facilityId: coldChainEquipment.facilityId,
          facilityName: facilities.name,
          facilityCode: facilities.hmisCode,
          districtId: facilities.districtId,
          equipmentType: coldChainEquipment.equipmentType,
          brand: coldChainEquipment.brand,
          model: coldChainEquipment.model,
          serialNumber: coldChainEquipment.serialNumber,
          catalogNumber: coldChainEquipment.catalogNumber,
          capacityLiters: coldChainEquipment.capacityLiters,
          netStorageCapacityLiters: coldChainEquipment.netStorageCapacityLiters,
          temperatureMin: coldChainEquipment.temperatureMin,
          temperatureMax: coldChainEquipment.temperatureMax,
          powerSource: coldChainEquipment.powerSource,
          energyConsumptionKwhDay: coldChainEquipment.energyConsumptionKwhDay,
          manufactureYear: coldChainEquipment.manufactureYear,
          installationDate: coldChainEquipment.installationDate,
          purchaseCost: coldChainEquipment.purchaseCost,
          purchaseCurrency: coldChainEquipment.purchaseCurrency,
          warrantyExpiry: coldChainEquipment.warrantyExpiry,
          supplier: coldChainEquipment.supplier,
          donorFunded: coldChainEquipment.donorFunded,
          fundingSource: coldChainEquipment.fundingSource,
          condition: coldChainEquipment.condition,
          lastServiceDate: coldChainEquipment.lastServiceDate,
          nextServiceDue: coldChainEquipment.nextServiceDue,
          lastTemperatureCheck: coldChainEquipment.lastTemperatureCheck,
          maintenanceNotes: coldChainEquipment.maintenanceNotes,
          isActive: coldChainEquipment.isActive,
          notes: coldChainEquipment.notes,
          externalId: coldChainEquipment.externalId,
          createdAt: coldChainEquipment.createdAt,
          updatedAt: coldChainEquipment.updatedAt,
        })
        .from(coldChainEquipment)
        .leftJoin(facilities, eq(coldChainEquipment.facilityId, facilities.id))
        .where(and(...conditions))
        .orderBy(facilities.name, coldChainEquipment.equipmentType);

      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Failed to fetch cold chain inventory") });
    }
  });

  // GET /api/facilities/:id/cold-chain
  app.get("/api/facilities/:id/cold-chain", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.id) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facility id" });
      const { coldChainEquipment } = await import("@shared/schema");
      const rows = await db
        .select()
        .from(coldChainEquipment)
        .where(
          and(
            eq(coldChainEquipment.tenantId, req.tenantId),
            eq(coldChainEquipment.facilityId, facilityId),
            eq(coldChainEquipment.isActive, true),
          )
        )
        .orderBy(coldChainEquipment.equipmentType, coldChainEquipment.brand);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Failed to list cold chain equipment") });
    }
  });

  // POST /api/facilities/:id/cold-chain
  app.post("/api/facilities/:id/cold-chain", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.id) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facility id" });
      const { coldChainEquipment, insertColdChainEquipmentSchema, users } = await import("@shared/schema");

      // Sanitize input fields: convert empty strings and invalid values to null/defaults
      const raw = { ...req.body, facilityId };
      const strFields = [
        "brand", "model", "serialNumber", "catalogNumber",
        "powerSource", "installationDate", "purchaseCurrency",
        "warrantyExpiry", "supplier", "fundingSource",
        "lastServiceDate", "nextServiceDue", "lastTemperatureCheck",
        "maintenanceNotes", "notes", "externalId"
      ];
      for (const k of strFields) {
        if (raw[k] !== undefined) {
          const v = typeof raw[k] === "string" ? raw[k].trim() : raw[k];
          raw[k] = (v === "" || v === "None" || v === undefined) ? (k === "powerSource" ? "none" : null) : v;
        }
      }
      if (raw.powerSource === "None" || raw.powerSource === "") raw.powerSource = "none";

      const numFields = [
        "capacityLiters", "netStorageCapacityLiters", "temperatureMin",
        "temperatureMax", "energyConsumptionKwhDay", "manufactureYear", "purchaseCost"
      ];
      for (const k of numFields) {
        if (raw[k] !== undefined && raw[k] !== null) {
          if (typeof raw[k] === "string" && raw[k].trim() === "") {
            raw[k] = null;
          } else {
            const n = Number(raw[k]);
            raw[k] = isNaN(n) ? null : (k === "manufactureYear" ? Math.round(n) : n);
          }
        }
      }

      const parsed = insertColdChainEquipmentSchema.parse(raw);

      // Verify user ID exists in users table to satisfy foreign key constraint
      let validUserId: string | null = null;
      if (req.dbUser?.id) {
        const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, req.dbUser.id));
        if (u) validUserId = u.id;
      }

      const [inserted] = await db
        .insert(coldChainEquipment)
        .values({
          ...parsed,
          tenantId: req.tenantId,
          createdByUserId: validUserId,
          updatedByUserId: validUserId,
        } as any)
        .returning();
      await logAudit(req, "create", "cold_chain_equipment", inserted.id, null, inserted);
      res.status(201).json(inserted);
    } catch (err: any) {
      console.error("POST /api/facilities/:id/cold-chain error:", err);
      res.status(400).json({ message: "Invalid equipment data: " + (err.message || String(err)) });
    }
  });

  // PATCH /api/facilities/:id/cold-chain/:equipId
  app.patch("/api/facilities/:id/cold-chain/:equipId", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.id) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      const equipId = parseInt(req.params.equipId);
      if (isNaN(facilityId) || isNaN(equipId)) return res.status(400).json({ message: "Invalid parameters" });
      const { coldChainEquipment, users } = await import("@shared/schema");
      const [existing] = await db.select().from(coldChainEquipment)
        .where(and(eq(coldChainEquipment.id, equipId), eq(coldChainEquipment.facilityId, facilityId), eq(coldChainEquipment.tenantId, req.tenantId)));
      if (!existing) return res.status(404).json({ message: "Equipment not found" });

      const allowed: any = {};
      for (const k of [
        "equipmentType", "brand", "model", "serialNumber", "catalogNumber",
        "capacityLiters", "netStorageCapacityLiters", "temperatureMin", "temperatureMax",
        "powerSource", "energyConsumptionKwhDay", "manufactureYear", "installationDate",
        "purchaseCost", "purchaseCurrency", "warrantyExpiry", "supplier", "donorFunded", "fundingSource",
        "condition", "lastServiceDate", "nextServiceDue", "lastTemperatureCheck", "maintenanceNotes",
        "isActive", "notes", "externalId",
      ]) {
        if (req.body[k] !== undefined) {
          const val = req.body[k];
          if (["capacityLiters", "netStorageCapacityLiters", "temperatureMin", "temperatureMax", "energyConsumptionKwhDay", "manufactureYear", "purchaseCost"].includes(k)) {
            if (val === "" || val === null || val === undefined) allowed[k] = null;
            else {
              const n = Number(val);
              allowed[k] = isNaN(n) ? null : (k === "manufactureYear" ? Math.round(n) : n);
            }
          } else if (typeof val === "string") {
            const trimmed = val.trim();
            allowed[k] = (trimmed === "" || trimmed === "None") ? (k === "powerSource" ? "none" : null) : trimmed;
          } else {
            allowed[k] = val;
          }
        }
      }

      let validUserId: string | null = null;
      if (req.dbUser?.id) {
        const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, req.dbUser.id));
        if (u) validUserId = u.id;
      }

      allowed.updatedAt = new Date();
      allowed.updatedByUserId = validUserId;
      const [updated] = await db.update(coldChainEquipment).set(allowed)
        .where(eq(coldChainEquipment.id, equipId)).returning();
      await logAudit(req, "update", "cold_chain_equipment", equipId, existing, updated);
      res.json(updated);
    } catch (err: any) {
      console.error("PATCH /api/facilities/:id/cold-chain/:equipId error:", err);
      res.status(400).json({ message: "Failed to update equipment: " + (err.message || String(err)) });
    }
  });

  // DELETE /api/facilities/:id/cold-chain/:equipId  (soft-delete via isActive=false)
  app.delete("/api/facilities/:id/cold-chain/:equipId", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.id) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      const equipId = parseInt(req.params.equipId);
      if (isNaN(facilityId) || isNaN(equipId)) return res.status(400).json({ message: "Invalid parameters" });
      const { coldChainEquipment } = await import("@shared/schema");
      const [existing] = await db.select().from(coldChainEquipment)
        .where(and(eq(coldChainEquipment.id, equipId), eq(coldChainEquipment.facilityId, facilityId), eq(coldChainEquipment.tenantId, req.tenantId)));
      if (!existing) return res.status(404).json({ message: "Equipment not found" });
      await db.update(coldChainEquipment)
        .set({ isActive: false, updatedAt: new Date(), updatedByUserId: req.user?.claims?.sub ?? null } as any)
        .where(eq(coldChainEquipment.id, equipId));
      await logAudit(req, "delete", "cold_chain_equipment", equipId, existing, null);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Failed to delete equipment") });
    }
  });

  // POST /api/facilities/:id/cold-chain/import  (CSV / JSON bulk import)
  app.post("/api/facilities/:id/cold-chain/import", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.id) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facility id" });
      const { coldChainEquipment, insertColdChainEquipmentSchema } = await import("@shared/schema");
      const items: any[] = Array.isArray(req.body) ? req.body : (req.body?.items ?? []);
      if (!items.length) return res.status(400).json({ message: "No items provided" });
      const results: { row: number; ok: boolean; error?: string; id?: number }[] = [];
      for (let i = 0; i < items.length; i++) {
        try {
          const parsed = insertColdChainEquipmentSchema.parse({ ...items[i], facilityId });
          const [inserted] = await db.insert(coldChainEquipment)
            .values({ ...parsed, tenantId: req.tenantId, createdByUserId: req.user?.claims?.sub ?? null, updatedByUserId: req.user?.claims?.sub ?? null } as any)
            .returning();
          results.push({ row: i + 1, ok: true, id: inserted.id });
        } catch (e: any) {
          results.push({ row: i + 1, ok: false, error: e.message });
        }
      }
      const successCount = results.filter((r) => r.ok).length;
      res.json({ success: true, imported: successCount, failed: items.length - successCount, results });
    } catch (err: any) {
      res.status(400).json({ message: "Import failed: " + err.message });
    }
  });

  // POST /api/cold-chain/import (Tenant-wide bulk import matching by Facility ID, Facility Name, or HMIS Code)
  app.post("/api/cold-chain/import", ...auth, async (req: any, res) => {
    try {
      const { coldChainEquipment, facilities } = await import("@shared/schema");
      const items: any[] = Array.isArray(req.body) ? req.body : (req.body?.items ?? []);
      if (!items.length) return res.status(400).json({ message: "No equipment items provided" });

      const allFacs = await db.select().from(facilities).where(eq(facilities.tenantId, req.tenantId));
      const idMap = new Map<number, typeof allFacs[0]>();
      const nameMap = new Map<string, typeof allFacs[0]>();
      const hmisMap = new Map<string, typeof allFacs[0]>();

      for (const f of allFacs) {
        idMap.set(f.id, f);
        if (f.name) nameMap.set(f.name.toLowerCase().trim(), f);
        if (f.hmisCode) hmisMap.set(f.hmisCode.toLowerCase().trim(), f);
      }

      let imported = 0;
      let updated = 0;
      const errors: { row: number; error: string }[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rowNum = i + 1;

        // Resolve facility
        let matchedFacility: typeof allFacs[0] | undefined;
        const rawFacId = item.facilityId ? Number(item.facilityId) : (item["Facility ID"] ? Number(item["Facility ID"]) : null);
        const rawFacName = (item.facilityName || item["Facility Name"] || "").toString().trim();

        if (rawFacId && idMap.has(rawFacId)) {
          matchedFacility = idMap.get(rawFacId);
        } else if (rawFacName) {
          const normName = rawFacName.toLowerCase();
          matchedFacility = nameMap.get(normName) || hmisMap.get(normName);
          if (!matchedFacility) {
            matchedFacility = allFacs.find(f => {
              const fn = (f.name || "").toLowerCase();
              return fn.includes(normName) || normName.includes(fn);
            });
          }
        }

        if (!matchedFacility) {
          errors.push({ row: rowNum, error: `Facility could not be resolved (${rawFacName || rawFacId || "missing facility"})` });
          continue;
        }

        // Normalize equipment type
        let eqType = (item.equipmentType || item["Equipment Type"] || "refrigerator").toString().toLowerCase().trim().replace(/[\s-]+/g, "_");
        if (eqType === "icr") eqType = "icm";
        if (eqType.includes("solar") && eqType.includes("refrigerator")) eqType = "solar_direct_drive_refrigerator";

        // Normalize condition
        let cond = (item.condition || item["Condition"] || "functional").toString().toLowerCase().trim().replace(/[\s-]+/g, "_");
        if (!["functional", "needs_repair", "non_functional", "condemned", "decommissioned"].includes(cond)) {
          cond = "functional";
        }

        // Normalize power source
        let pwr = (item.powerSource || item["Power Source"] || null)?.toString().toLowerCase().trim().replace(/[\s-]+/g, "_");
        if (pwr === "dual") pwr = "electric";

        const brand = item.brand || item["Brand"] || null;
        const model = item.model || item["Model"] || null;
        const serialNumber = item.serialNumber || item["Serial Number"] || null;
        const catalogNumber = item.catalogNumber || item["Catalog Number"] || null;
        const capacityLiters = item.capacityLiters || item["Capacity (L)"] || null;
        const netStorageCapacityLiters = item.netStorageCapacityLiters || item["Net Storage Capacity (L)"] || null;
        const mfgYear = item.manufactureYear || item["Manufacture Year"] ? parseInt(String(item.manufactureYear || item["Manufacture Year"]), 10) : null;
        const installDate = item.installationDate || item["Installation Date"] ? String(item.installationDate || item["Installation Date"]).trim() : null;
        const serviceDate = item.lastServiceDate || item["Last Service Date"] ? String(item.lastServiceDate || item["Last Service Date"]).trim() : null;

        const payload: any = {
          tenantId: req.tenantId,
          facilityId: matchedFacility.id,
          equipmentType: eqType,
          brand,
          model,
          serialNumber,
          catalogNumber,
          capacityLiters: capacityLiters ? String(capacityLiters) : null,
          netStorageCapacityLiters: netStorageCapacityLiters ? String(netStorageCapacityLiters) : null,
          powerSource: pwr,
          condition: cond,
          manufactureYear: isNaN(mfgYear as any) ? null : mfgYear,
          installationDate: installDate,
          lastServiceDate: serviceDate,
          isActive: true,
          updatedAt: new Date(),
          updatedByUserId: req.user?.claims?.sub ?? null,
        };

        // Check if existing record by ID or serial number exists (Safe Upsert)
        let existingId: number | null = null;
        const rawId = item.id || item["ID"];
        if (rawId && !isNaN(Number(rawId))) {
          const [exist] = await db.select({ id: coldChainEquipment.id })
            .from(coldChainEquipment)
            .where(and(eq(coldChainEquipment.id, Number(rawId)), eq(coldChainEquipment.tenantId, req.tenantId)))
            .limit(1);
          if (exist) existingId = exist.id;
        }

        if (!existingId && serialNumber) {
          const [exist] = await db.select({ id: coldChainEquipment.id })
            .from(coldChainEquipment)
            .where(and(
              eq(coldChainEquipment.tenantId, req.tenantId),
              eq(coldChainEquipment.facilityId, matchedFacility.id),
              eq(coldChainEquipment.serialNumber, String(serialNumber))
            ))
            .limit(1);
          if (exist) existingId = exist.id;
        }

        if (existingId) {
          await db.update(coldChainEquipment).set(payload).where(eq(coldChainEquipment.id, existingId));
          updated++;
        } else {
          await db.insert(coldChainEquipment).values({
            ...payload,
            createdByUserId: req.user?.claims?.sub ?? null,
            createdAt: new Date(),
          });
          imported++;
        }
      }

      res.json({
        success: true,
        imported,
        updated,
        failed: errors.length,
        message: `Processed ${imported + updated} equipment records (${imported} added, ${updated} updated${errors.length > 0 ? `, ${errors.length} failed` : ""}).`,
        errors: errors.slice(0, 20),
      });
    } catch (err: any) {
      console.error("POST /api/cold-chain/import error:", err);
      res.status(500).json({ message: safeErrorMessage(err, "Failed to import cold chain equipment") });
    }
  });

  // GET /api/facilities/:id/cold-chain/export  (IGA-format JSON and CSV)
  app.get("/api/facilities/:id/cold-chain/export", ...auth, requireGeoAccess(req => ({ facilityId: parseInt(req.params.id) })), async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facility id" });
      const { coldChainEquipment } = await import("@shared/schema");
      const format = (req.query.format as string || "json").toLowerCase();
      const rows = await db.select().from(coldChainEquipment)
        .where(and(eq(coldChainEquipment.tenantId, req.tenantId), eq(coldChainEquipment.facilityId, facilityId)))
        .orderBy(coldChainEquipment.equipmentType);

      if (format === "csv") {
        const headers = [
          "id","equipmentType","brand","model","serialNumber","catalogNumber",
          "capacityLiters","netStorageCapacityLiters","temperatureMin","temperatureMax",
          "powerSource","energyConsumptionKwhDay","manufactureYear","installationDate",
          "condition","lastServiceDate","nextServiceDue","lastTemperatureCheck",
          "supplier","donorFunded","fundingSource","purchaseCost","purchaseCurrency",
          "warrantyExpiry","isActive","externalId","notes",
        ];
        const csvLines = [headers.join(",")];
        for (const r of rows) {
          csvLines.push(headers.map((h) => {
            const v = (r as any)[h];
            if (v === null || v === undefined) return "";
            const s = String(v).replace(/"/g, '""');
            return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
          }).join(","));
        }
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="cold-chain-facility-${facilityId}.csv"`);
        return res.send(csvLines.join("\n"));
      }

      // Default: WHO EIR / IGA-compatible JSON
      const igaExport = {
        exportFormat: "WHO_EIR_IGA_v1",
        exportedAt: new Date().toISOString(),
        facilityId,
        totalItems: rows.length,
        equipment: rows.map((r) => ({
          id: r.id,
          externalId: r.externalId,
          type: r.equipmentType,
          brand: r.brand,
          model: r.model,
          serialNumber: r.serialNumber,
          catalogNumber: r.catalogNumber,
          capacityL: r.capacityLiters,
          netCapacityL: r.netStorageCapacityLiters,
          tempRangeC: { min: r.temperatureMin, max: r.temperatureMax },
          powerSource: r.powerSource,
          energyKwhDay: r.energyConsumptionKwhDay,
          manufactureYear: r.manufactureYear,
          installationDate: r.installationDate,
          condition: r.condition,
          lastServiceDate: r.lastServiceDate,
          nextServiceDue: r.nextServiceDue,
          lastTemperatureCheck: r.lastTemperatureCheck,
          supplier: r.supplier,
          donorFunded: r.donorFunded,
          fundingSource: r.fundingSource,
          purchaseCost: r.purchaseCost,
          purchaseCurrency: r.purchaseCurrency,
          warrantyExpiry: r.warrantyExpiry,
          isActive: r.isActive,
          notes: r.notes,
        })),
      };
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="cold-chain-iga-facility-${facilityId}.json"`);
      return res.json(igaExport);
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Export failed") });
    }
  });

  async function summarizeTenantFacilityMaintenance(tenantId: string, importedHmisCodes: string[] = []) {
    const importedCodes = importedHmisCodes.map((code) => code.trim()).filter(Boolean);
    const importedCodeList = importedCodes.length > 0 ? dsql.join(importedCodes.map((code) => dsql`${code}`), dsql`, `) : null;
    const missingFromImportFilter = importedCodeList ? dsql`hmis_code NOT IN (${importedCodeList})` : dsql`TRUE`;
    const summaryResult = await db.execute(dsql`SELECT
      (SELECT COUNT(*)::int FROM facilities WHERE tenant_id = ${tenantId}) AS "facilityCount",
      (SELECT COUNT(*)::int FROM villages WHERE tenant_id = ${tenantId} AND assigned_facility_id IN (SELECT id FROM facilities WHERE tenant_id = ${tenantId})) AS "linkedCommunityCount",
      (SELECT COUNT(*)::int FROM facility_catchments WHERE tenant_id = ${tenantId}) AS "catchmentCount",
      (SELECT COUNT(*)::int FROM session_plans WHERE tenant_id = ${tenantId}) AS "sessionPlanCount",
      (SELECT COUNT(*)::int FROM microplans WHERE tenant_id = ${tenantId} AND facility_id IS NOT NULL) AS "microplanCount",
      (SELECT COUNT(*)::int FROM stock_transactions WHERE tenant_id = ${tenantId}) AS "stockTransactionCount",
      (SELECT COUNT(*)::int FROM clients WHERE tenant_id = ${tenantId}) AS "clientCount",
      (SELECT COUNT(*)::int FROM cold_chain_equipment WHERE tenant_id = ${tenantId}) AS "coldChainCount",
      (SELECT COUNT(*)::int FROM community_health_volunteers WHERE tenant_id = ${tenantId}) AS "chvCount",
      (SELECT COUNT(*)::int FROM facility_staff WHERE tenant_id = ${tenantId}) AS "staffCount",
      (SELECT COUNT(*)::int FROM facilities WHERE tenant_id = ${tenantId} AND ${missingFromImportFilter}) AS "missingFromImportCount"`);
    const rows = (summaryResult as any).rows || summaryResult;
    return rows[0] || {};
  }

  async function purgeTenantFacilities(
    tx: any,
    tenantId: string,
    keepHmisCodes: string[] = [],
  ) {
    const keepCodes = keepHmisCodes.map((code) => code.trim()).filter(Boolean);
    const keepCodeList = keepCodes.length > 0 ? dsql.join(keepCodes.map((code) => dsql`${code}`), dsql`, `) : null;
    const targetRows = await tx.select({ id: facilities.id }).from(facilities).where(
      keepCodeList
        ? and(eq(facilities.tenantId, tenantId), dsql`${facilities.hmisCode} NOT IN (${keepCodeList})`)
        : eq(facilities.tenantId, tenantId)
    );
    const targetIds = targetRows.map((row: { id: number }) => Number(row.id)).filter((id: number) => Number.isFinite(id));
    if (targetIds.length === 0) return { purgedCount: 0 };
    const targetIdList = dsql.join(targetIds.map((id: number) => dsql`${id}`), dsql`, `);

    // Non-destructive deactivation: preserves all clinical, logistical, and demographic audit history per Rule 1 & Rule 3
    await tx.execute(dsql`UPDATE facilities SET is_active = false, updated_at = NOW() WHERE tenant_id = ${tenantId} AND id IN (${targetIdList})`);

    return { purgedCount: targetIds.length };
  }

  // Bulk JSON import of facilities (upsert, replace missing, or destructive purge/replace)
  app.post("/api/facilities/import", isAuthenticated, requireTenant, loadRole, requireAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        mode: z.enum(["upsert", "replace_missing", "purge_replace"]).optional().default("upsert"),
        dryRun: z.boolean().optional().default(false),
        confirm: z.string().optional(),
        facilities: z.array(z.object({
          name: z.string().min(1),
          hmisCode: z.string().min(1),
          facilityType: z.string().optional().nullable(),
          agencyName: z.string().optional().nullable(),
          operationalStatus: z.string().optional().nullable(),
          districtName: z.string().optional().nullable(),
          latitude: z.union([z.number(), z.string()]).optional().nullable(),
          longitude: z.union([z.number(), z.string()]).optional().nullable(),
          address: z.string().optional().nullable(),
          contactPhone: z.string().optional().nullable(),
          operatingHours: z.string().optional().nullable(),
          hasRefrigerator: z.boolean().optional().nullable(),
          hasPower: z.boolean().optional().nullable(),
          staffCount: z.number().optional().nullable(),
          catchmentRadius: z.union([z.number(), z.string()]).optional().nullable(),
        }))
      });

      const { facilities: importedFacilities, mode, dryRun, confirm } = schema.parse(req.body);
      const importCodes = importedFacilities.map((item) => item.hmisCode.trim()).filter(Boolean);

      if ((mode === "replace_missing" || mode === "purge_replace") && confirm !== "REPLACE FACILITIES") {
        return res.status(400).json({ success: false, message: "Bulk replace/purge requires confirmation text: REPLACE FACILITIES" });
    }

      const allDistricts = await storage.getDistricts(req.tenantId);
      const districtByName = new Map(allDistricts.map((d) => [d.name.trim().toLowerCase(), d.id]));
      const districtErrors = importedFacilities
        .map((item, idx) => ({ item, row: idx + 1 }))
        .filter(({ item }) => !item.districtName || !districtByName.has(item.districtName.trim().toLowerCase()))
        .map(({ item, row }) => ({
          row,
          hmisCode: item.hmisCode,
          districtName: item.districtName ?? null,
          error: item.districtName ? "District not found in this tenant" : "District name is required",
        }));

      const beforeSummary = await summarizeTenantFacilityMaintenance(req.tenantId, importCodes);
      if (districtErrors.length > 0) {
        return res.status(400).json({
          success: false,
          dryRun,
          mode,
          message: "Facility import blocked because one or more rows do not match a known district in the active tenant.",
          errors: districtErrors,
          summary: beforeSummary,
        });
      }

      if (dryRun) {
        return res.json({ success: true, dryRun: true, mode, importCount: importedFacilities.length, summary: beforeSummary, message: "Dry run complete. No facility records were changed." });
      }
      const { purgeSummary, createdCount, updatedCount } = await db.transaction(async (tx) => {
        const purgeSummary =
          mode === "purge_replace"
            ? await purgeTenantFacilities(tx, req.tenantId)
            : mode === "replace_missing"
              ? await purgeTenantFacilities(tx, req.tenantId, importCodes)
              : { purgedCount: 0 };
        let createdCount = 0;
        let updatedCount = 0;

        for (const item of importedFacilities) {
          const districtId = districtByName.get(item.districtName!.trim().toLowerCase())!;

          const latVal = item.latitude !== null && item.latitude !== undefined ? parseFloat(item.latitude.toString()) : null;
          const lngVal = item.longitude !== null && item.longitude !== undefined ? parseFloat(item.longitude.toString()) : null;
          const radiusVal = item.catchmentRadius !== null && item.catchmentRadius !== undefined ? parseFloat(item.catchmentRadius.toString()) : null;
          const [existing] = await tx.select().from(facilities).where(and(eq(facilities.tenantId, req.tenantId), eq(facilities.hmisCode, item.hmisCode.trim()))).limit(1);

          if (existing) {
            await tx.update(facilities).set({
              name: item.name.trim(), facilityType: item.facilityType ?? existing.facilityType, agencyName: item.agencyName ?? existing.agencyName, operationalStatus: item.operationalStatus ?? existing.operationalStatus, districtId,
              latitude: latVal !== null && !isNaN(latVal) ? latVal.toFixed(7) : existing.latitude,
              longitude: lngVal !== null && !isNaN(lngVal) ? lngVal.toFixed(7) : existing.longitude,
              address: item.address ?? existing.address, contactPhone: item.contactPhone ?? existing.contactPhone, operatingHours: item.operatingHours ?? existing.operatingHours,
              hasRefrigerator: item.hasRefrigerator ?? existing.hasRefrigerator, hasPower: item.hasPower ?? existing.hasPower, staffCount: item.staffCount ?? existing.staffCount,
              catchmentRadius: radiusVal !== null && !isNaN(radiusVal) ? radiusVal.toFixed(2) : existing.catchmentRadius, isActive: true, updatedAt: new Date(),
            }).where(eq(facilities.id, existing.id));
            updatedCount++;
          } else {
            await tx.insert(facilities).values({
              tenantId: req.tenantId, name: item.name.trim(), hmisCode: item.hmisCode.trim(), facilityType: item.facilityType ?? null, agencyName: item.agencyName ?? null, operationalStatus: item.operationalStatus ?? null, districtId,
              latitude: latVal !== null && !isNaN(latVal) ? latVal.toFixed(7) : null,
              longitude: lngVal !== null && !isNaN(lngVal) ? lngVal.toFixed(7) : null,
              address: item.address ?? null, contactPhone: item.contactPhone ?? null, operatingHours: item.operatingHours ?? null,
              hasRefrigerator: item.hasRefrigerator ?? false, hasPower: item.hasPower ?? false, staffCount: item.staffCount ?? null,
              catchmentRadius: radiusVal !== null && !isNaN(radiusVal) ? radiusVal.toFixed(2) : null, isActive: true,
            });
            createdCount++;
          }
        }

        return { purgeSummary, createdCount, updatedCount };
      });
      const afterSummary = await summarizeTenantFacilityMaintenance(req.tenantId, importCodes);
      await logAudit(req, "import_facilities", "facilities", null, null, { mode, createdCount, updatedCount, purgeSummary, beforeSummary, afterSummary });
      res.json({ success: true, mode, message: "Successfully processed " + importedFacilities.length + " facilities.", createdCount, updatedCount, purgeSummary, beforeSummary, afterSummary });
    } catch (error: any) {
      if (error?.name === "ZodError") return res.status(400).json({ success: false, message: "Invalid payload format.", errors: error.errors });
      console.error("Error importing facilities:", error);
      res.status(500).json({ success: false, message: safeErrorMessage(error, "Failed to import facilities") });
    }
  });

  app.get("/api/facilities/:id/catchments", ...auth, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (!Number.isFinite(facilityId)) {
        return res.status(400).json({ message: "Invalid facility id" });
      }
      if (!(await userCanAccessGeo(req.dbUser, req.tenantId, { facilityId }))) {
        return res.status(404).json({ message: "Facility not found" });
      }
      const catchments = await db
        .select()
        .from(facilityCatchments)
        .where(
          and(
            eq(facilityCatchments.facilityId, facilityId),
            eq(facilityCatchments.tenantId, req.tenantId)
          )
        );
      res.json(catchments);
    } catch (error) {
      console.error("Error fetching facility catchments:", error);
      res.status(500).json({ message: "Failed to fetch catchments" });
    }
  });

  app.post("/api/facilities/:id/catchments", ...auth, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      const { geojson, name, description, villageIds } = req.body;
      if (!geojson) {
        return res.status(400).json({ message: "GeoJSON is required" });
      }

      // Calculate area using turfArea (returns area in sq meters)
      const areaSqM = turfArea(geojson);
      const areaSqKm = String((areaSqM / 1000000).toFixed(4));

      // Estimate population from the grid cells that intersect this catchment polygon
      let geom = geojson;
      if (geojson.type === "Feature") {
        geom = geojson.geometry;
      }
      const geomJson = JSON.stringify(geom);

      const popRes = await pool.query(
        `
        SELECT COALESCE(SUM(population_total), 0)::int AS total_pop
        FROM population_grids
        WHERE tenant_id = $1
          AND geometry IS NOT NULL
          AND ST_Intersects(
            geometry,
            ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)
          )
        `,
        [req.tenantId, geomJson]
      );
      const populationEstimate = popRes.rows[0]?.total_pop || 0;

      // Check if an official catchment already exists for this facility
      const existing = await db
        .select()
        .from(facilityCatchments)
        .where(
          and(
            eq(facilityCatchments.facilityId, facilityId),
            eq(facilityCatchments.tenantId, req.tenantId),
            eq(facilityCatchments.isOfficial, true)
          )
        );

      let catchment;
      if (existing.length > 0) {
        // Update the official catchment
        const [updated] = await db
          .update(facilityCatchments)
          .set({
            geojson,
            name: name || `Catchment for HF ${facilityId}`,
            description: description || "",
            areaSqKm,
            populationEstimate,
            updatedAt: new Date(),
          })
          .where(eq(facilityCatchments.id, existing[0].id))
          .returning();
        catchment = updated;
      } else {
        // Create a new official catchment
        const [created] = await db
          .insert(facilityCatchments)
          .values({
            tenantId: req.tenantId,
            facilityId,
            name: name || `Catchment for HF ${facilityId}`,
            description: description || "",
            geojson,
            areaSqKm,
            populationEstimate,
            isOfficial: true,
            drawnByUserId: req.user?.claims?.sub || null,
          })
          .returning();
        catchment = created;
      }

      // Update geofenced villages in a single transaction
      if (Array.isArray(villageIds)) {
        // 1. Unassign villages that were previously assigned to this facility
        await db
          .update(villages)
          .set({ assignedFacilityId: null })
          .where(
            and(
              eq(villages.assignedFacilityId, facilityId),
              eq(villages.tenantId, req.tenantId)
            )
          );

        // 2. Assign the new geofenced villages
        if (villageIds.length > 0) {
          await db
            .update(villages)
            .set({ assignedFacilityId: facilityId })
            .where(
              and(
                inArray(villages.id, villageIds),
                eq(villages.tenantId, req.tenantId)
              )
            );
        }
      }

      await logAudit(req, "save_catchment", "facility_catchments", catchment.id, null, catchment);
      res.json({ catchment, assignedCount: villageIds?.length || 0 });
    } catch (error: any) {
      console.error("Error saving catchment area:", error);
      res.status(500).json({ message: safeErrorMessage(error, "Failed to save catchment area") });
    }
  });

  // ─── Villages ─────────────────────────────────────────


  // Aggressive Centroid and Proximity Village Extractor
  app.post("/api/facilities/:id/communities/extract-aggressive", ...auth, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      const tenantId = req.tenantId;

      const facility = await storage.getFacility(tenantId, facilityId);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }

      // Fetch catchment polygon
      const catchments = await db
        .select()
        .from(facilityCatchments)
        .where(
          and(
            eq(facilityCatchments.facilityId, facilityId),
            eq(facilityCatchments.tenantId, tenantId),
            eq(facilityCatchments.isOfficial, true)
          )
        );

      const districtId = facility.districtId;

      // Fetch all villages in this district
      const districtVillages = await db
        .select()
        .from(villages)
        .where(
          and(
            eq(villages.districtId, districtId),
            eq(villages.tenantId, tenantId)
          )
        );

      // Configurable extraction buffer:
      // Accepts req.body.bufferKm (min 0.5 km, max 25.0 km per WHO RED / microplanning ceiling).
      // Fallback precedence: req.body.bufferKm -> facility.catchmentRadius -> default 5.0 km (or 10.0 km).
      let bufferKm = 5.0;
      if (req.body?.bufferKm !== undefined && req.body?.bufferKm !== null) {
        const parsed = parseFloat(req.body.bufferKm.toString());
        if (!isNaN(parsed) && parsed > 0) {
          bufferKm = Math.min(Math.max(parsed, 0.5), 25.0);
        }
      } else if (facility.catchmentRadius) {
        const facRadius = parseFloat(facility.catchmentRadius.toString());
        if (!isNaN(facRadius) && facRadius > 0) {
          bufferKm = Math.min(Math.max(facRadius, 0.5), 25.0);
        }
      } else {
        bufferKm = 10.0;
      }

      let matchedVillageIds: number[] = [];

      if (catchments.length > 0 && catchments[0].geojson) {
        const geojson = catchments[0].geojson as any;
        let polygonCoords: [number, number][] = [];
        if (geojson.type === "Polygon" && Array.isArray(geojson.coordinates) && geojson.coordinates[0]) {
          polygonCoords = geojson.coordinates[0]; // array of [lng, lat]
        } else if (geojson.type === "MultiPolygon" && Array.isArray(geojson.coordinates) && geojson.coordinates[0]?.[0]) {
          polygonCoords = geojson.coordinates[0][0];
        }

        // Ray casting Point-In-Polygon
        districtVillages.forEach((v) => {
          if (!v.latitude || !v.longitude) return;
          const lat = parseFloat(v.latitude.toString());
          const lng = parseFloat(v.longitude.toString());

          // Check polygon containment
          let inside = false;
          const polygon = polygonCoords;
          for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0], yi = polygon[i][1]; // xi = lng, yi = lat
            const xj = polygon[j][0], yj = polygon[j][1];
            const intersect = ((yi > lat) !== (yj > lat))
                && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
          }

          if (inside) {
            matchedVillageIds.push(v.id);
            return;
          }

          // Proximity fallback using configured buffer:
          if (facility.latitude && facility.longitude) {
            const facLat = parseFloat(facility.latitude.toString());
            const facLng = parseFloat(facility.longitude.toString());
            const dist = calculateHaversineDistance(lat, lng, facLat, facLng);

            if (dist <= bufferKm) {
              matchedVillageIds.push(v.id);
            }
          }
        });
      } else {
        // Fallback when no polygon is drawn: associate all villages in the district within bufferKm!
        districtVillages.forEach((v) => {
          if (!v.latitude || !v.longitude || !facility.latitude || !facility.longitude) return;
          const lat = parseFloat(v.latitude.toString());
          const lng = parseFloat(v.longitude.toString());
          const facLat = parseFloat(facility.latitude.toString());
          const facLng = parseFloat(facility.longitude.toString());
          const dist = calculateHaversineDistance(lat, lng, facLat, facLng);

          if (dist <= bufferKm) {
            matchedVillageIds.push(v.id);
          }
        });
      }

      // De-duplicate matching IDs
      matchedVillageIds = Array.from(new Set(matchedVillageIds));
      const reassignExisting = req.body?.reassignExisting !== false;

      // Extraction may add currently unassigned communities, but it must never
      // steal a community from another facility. Previous behaviour reassigned
      // every spatial match and produced transient, contradictory catchments.
      const conflictingVillageIds = matchedVillageIds.filter((vid) => {
        const currentFacilityId = districtVillages.find((v) => v.id === vid)?.assignedFacilityId;
        return currentFacilityId != null && Number(currentFacilityId) !== facilityId;
      });
      if (!reassignExisting) {
        matchedVillageIds = matchedVillageIds.filter((vid) => {
          const currentFacilityId = districtVillages.find((v) => v.id === vid)?.assignedFacilityId;
          return currentFacilityId == null || Number(currentFacilityId) === facilityId;
        });
      }

      if (matchedVillageIds.length > 0) {
        const facLat = facility.latitude ? parseFloat(facility.latitude.toString()) : null;
        const facLng = facility.longitude ? parseFloat(facility.longitude.toString()) : null;

        for (const vid of matchedVillageIds) {
          const vRecord = districtVillages.find((dv) => dv.id === vid);
          let distStr: string | undefined = undefined;
          let travelMins: number | undefined = undefined;
          let transport: "walking" | "motorbike" | "car" | undefined = undefined;

          if (facLat != null && facLng != null && vRecord?.latitude && vRecord?.longitude) {
            const vLat = parseFloat(vRecord.latitude.toString());
            const vLng = parseFloat(vRecord.longitude.toString());
            const dist = calculateHaversineDistance(vLat, vLng, facLat, facLng);
            distStr = dist.toFixed(2);
            transport = dist <= 5.0 ? "walking" : dist <= 15.0 ? "motorbike" : "car";
            const minutesPerKm = transport === "walking" ? 15 : transport === "motorbike" ? 3 : 2;
            travelMins = Math.max(5, Math.round(dist * minutesPerKm));
          }

          await db
            .update(villages)
            .set({
              assignedFacilityId: facilityId,
              updatedAt: new Date(),
              ...(distStr ? { distanceToFacility: distStr } : {}),
              ...(travelMins ? { travelTimeMinutes: travelMins } : {}),
              ...(transport ? { transportMode: transport } : {}),
            })
            .where(
              and(
                eq(villages.id, vid),
                eq(villages.tenantId, tenantId)
              )
            );
        }
      }

      await logAudit(req, "aggressive_extract_communities", "facilities", facilityId, null, {
        matchedVillageCount: matchedVillageIds.length,
        villageIds: matchedVillageIds,
        skippedConflictCount: conflictingVillageIds.length,
        skippedConflictVillageIds: conflictingVillageIds,
        reassignExisting,
        bufferKm,
      });

      const persistedCommunities = matchedVillageIds.length
        ? await db
            .select()
            .from(villages)
            .where(and(
              eq(villages.tenantId, tenantId),
              inArray(villages.id, matchedVillageIds),
              eq(villages.assignedFacilityId, facilityId),
            ))
        : [];

      res.json({
        success: true,
        message: reassignExisting
          ? `Associated ${matchedVillageIds.length} spatially matched communities within ${bufferKm} km; ${conflictingVillageIds.length} existing assignments were moved.`
          : `Kept or associated ${matchedVillageIds.length} communities within ${bufferKm} km. ${conflictingVillageIds.length} communities assigned to other facilities were left unchanged.`,
        assignedCount: matchedVillageIds.length,
        reassignedCount: reassignExisting ? conflictingVillageIds.length : 0,
        skippedConflictCount: reassignExisting ? 0 : conflictingVillageIds.length,
        communities: persistedCommunities,
        bufferKm,
      });
    } catch (error: any) {
      console.error("Aggressive extraction failed:", error);
      res.status(500).json({ message: safeErrorMessage(error, "Aggressive extraction failed") });
    }
  });


  // GET /api/facilities/:facilityId/supervisors — Get supervisors available for a facility,
  // partitioned into district, province, and national levels (strictly excluding staff from the facility itself).
  app.get("/api/facilities/:facilityId/supervisors", ...auth, requireTenant, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid facilityId" });
      }

      // Fetch facility with district and province info
      const [facilityRow] = await db
        .select({
          id: facilities.id,
          name: facilities.name,
          districtId: facilities.districtId,
          districtName: districts.name,
          provinceId: districts.provinceId,
          provinceName: provinces.name,
        })
        .from(facilities)
        .leftJoin(districts, eq(facilities.districtId, districts.id))
        .leftJoin(provinces, eq(districts.provinceId, provinces.id))
        .where(and(eq(facilities.id, facilityId), eq(facilities.tenantId, req.tenantId)))
        .limit(1);

      if (!facilityRow) {
        return res.status(404).json({ message: "Facility not found" });
      }

      // Fetch candidate supervisor users in this tenant who do NOT belong to this facility
      const userRows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          roles: users.roles,
          districtId: users.districtId,
          provinceId: users.provinceId,
          facilityId: users.facilityId,
          isActive: users.isActive,
        })
        .from(users)
        .where(
          and(
            eq(users.tenantId, req.tenantId),
            eq(users.isActive, true),
            or(isNull(users.facilityId), ne(users.facilityId, facilityId))
          )
        );

      const districtSupervisors: any[] = [];
      const provinceSupervisors: any[] = [];
      const nationalSupervisors: any[] = [];

      // Helper to format role names cleanly
      const formatRole = (r: string) => {
        if (!r) return "Supervisor";
        return r
          .split("_")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      };

      for (const u of userRows) {
        const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email?.split("@")[0] || "Supervisor";
        const roleLabel = formatRole(u.role);

        if (facilityRow.districtId && u.districtId === facilityRow.districtId) {
          districtSupervisors.push({
            id: `user-${u.id}`,
            userId: u.id,
            name: fullName,
            role: roleLabel,
            level: "district",
            districtId: u.districtId,
            districtName: facilityRow.districtName,
            email: u.email,
            source: "user",
          });
        } else if (facilityRow.provinceId && u.provinceId === facilityRow.provinceId && !u.districtId) {
          provinceSupervisors.push({
            id: `user-${u.id}`,
            userId: u.id,
            name: fullName,
            role: roleLabel,
            level: "province",
            provinceId: u.provinceId,
            provinceName: facilityRow.provinceName,
            email: u.email,
            source: "user",
          });
        } else if (!u.districtId && !u.provinceId) {
          nationalSupervisors.push({
            id: `user-${u.id}`,
            userId: u.id,
            name: fullName,
            role: roleLabel,
            level: "national",
            email: u.email,
            source: "user",
          });
        }
      }

      // Also check other facilities/offices in the same district for staff with supervisor roles
      if (facilityRow.districtId) {
        const districtStaffRows = await db
          .select({
            id: facilityStaff.id,
            fullName: facilityStaff.fullName,
            name: facilityStaff.name,
            role: facilityStaff.role,
            position: facilityStaff.position,
            contactPhone: facilityStaff.contactPhone,
            facilityId: facilityStaff.facilityId,
            facilityName: facilities.name,
          })
          .from(facilityStaff)
          .innerJoin(facilities, eq(facilityStaff.facilityId, facilities.id))
          .where(
            and(
              eq(facilityStaff.tenantId, req.tenantId),
              eq(facilities.districtId, facilityRow.districtId),
              ne(facilityStaff.facilityId, facilityId),
              eq(facilityStaff.isActive, true),
              or(
                ilike(facilityStaff.role, "%supervis%"),
                ilike(facilityStaff.position, "%supervis%"),
                ilike(facilityStaff.role, "%officer%"),
                ilike(facilityStaff.position, "%officer%"),
                ilike(facilityStaff.role, "%coordinator%"),
                ilike(facilityStaff.position, "%coordinator%")
              )
            )
          );

        for (const st of districtStaffRows) {
          const staffName = st.fullName || st.name || "District Supervisor";
          if (!districtSupervisors.some((d) => d.name.toLowerCase() === staffName.toLowerCase())) {
            districtSupervisors.push({
              id: `staff-${st.id}`,
              name: staffName,
              role: st.position || st.role || "District Health Supervisor",
              level: "district",
              districtId: facilityRow.districtId,
              districtName: facilityRow.districtName,
              facilityName: st.facilityName,
              phone: st.contactPhone,
              source: "facility_staff",
            });
          }
        }
      }

      res.json({
        facility: facilityRow,
        district: districtSupervisors,
        province: provinceSupervisors,
        national: nationalSupervisors,
        all: [...districtSupervisors, ...provinceSupervisors, ...nationalSupervisors],
      });
    } catch (error: any) {
      console.error("Error fetching supervisors:", error);
      res.status(500).json({ message: safeErrorMessage(error, "Failed to fetch supervisors") });
    }
  });

  // POST /api/facilities/:facilityId/supervisors — Add a supervisor at the district, province, or national level
  app.post("/api/facilities/:facilityId/supervisors", ...auth, requireTenant, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid facilityId" });
      }

      const [facilityRow] = await db
        .select({
          id: facilities.id,
          districtId: facilities.districtId,
          districtName: districts.name,
          provinceId: districts.provinceId,
          provinceName: provinces.name,
        })
        .from(facilities)
        .leftJoin(districts, eq(facilities.districtId, districts.id))
        .leftJoin(provinces, eq(districts.provinceId, provinces.id))
        .where(and(eq(facilities.id, facilityId), eq(facilities.tenantId, req.tenantId)))
        .limit(1);

      if (!facilityRow) {
        return res.status(404).json({ message: "Facility not found" });
      }

      const { name, role, level = "district", phone, email } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Supervisor name is required" });
      }

      const tenant = await storage.getTenant(req.tenantId);
      const formatSpec = getCountryFormat(tenant);

      if (phone && typeof phone === "string" && phone.trim()) {
        const phoneVal = formatSpec.validatePhone(phone.trim());
        if (!phoneVal.valid) {
          return res.status(400).json({ message: phoneVal.message });
        }
      }

      const parts = name.trim().split(/\s+/);
      const firstName = parts[0] || "Supervisor";
      const lastName = parts.slice(1).join(" ") || "Official";

      let assignedDistrictId: number | null = null;
      let assignedProvinceId: number | null = null;
      let userRole: any = "district_manager";

      if (level === "national") {
        assignedDistrictId = null;
        assignedProvinceId = null;
        userRole = "national_manager";
      } else if (level === "province") {
        assignedDistrictId = null;
        assignedProvinceId = facilityRow.provinceId || null;
        userRole = "provincial_coordinator";
      } else {
        // District level
        assignedDistrictId = facilityRow.districtId || null;
        assignedProvinceId = facilityRow.provinceId || null;
        userRole = "district_manager";
      }

      const cleanEmail = email && typeof email === "string" && email.trim()
        ? email.trim().toLowerCase()
        : `supervisor.${Date.now()}.${Math.floor(Math.random() * 1000)}@vaxplan.local`;

      const [createdUser] = await db
        .insert(users)
        .values({
          tenantId: req.tenantId,
          firstName,
          lastName,
          email: cleanEmail,
          role: userRole,
          roles: ["supervisor", userRole],
          permissions: ["supervision.conduct", "supervision.view", "view_reports"],
          districtId: assignedDistrictId,
          provinceId: assignedProvinceId,
          facilityId: null, // NOT tied to any facility
          isActive: true,
        })
        .returning();

      await logAudit(req, "create", "supervisor_user", createdUser.id, null, {
        name: `${firstName} ${lastName}`,
        role: role || userRole,
        level,
        districtId: assignedDistrictId,
        provinceId: assignedProvinceId,
        phone: phone ? formatSpec.normalizePhone(phone.trim()) : null,
      });

      res.status(201).json({
        success: true,
        supervisor: {
          id: `user-${createdUser.id}`,
          userId: createdUser.id,
          name: `${createdUser.firstName} ${createdUser.lastName}`,
          role: role || (level === "national" ? "National Supervisor" : level === "province" ? "Provincial Supervisor" : "District Supervisor"),
          level,
          districtId: assignedDistrictId,
          districtName: level === "district" ? facilityRow.districtName : null,
          provinceId: assignedProvinceId,
          provinceName: level !== "national" ? facilityRow.provinceName : null,
          phone: phone ? formatSpec.normalizePhone(phone.trim()) : null,
          email: createdUser.email,
        },
      });
    } catch (error: any) {
      console.error("Error creating supervisor:", error);
      res.status(500).json({ message: safeErrorMessage(error, "Failed to create supervisor") });
    }
  });



  // PATCH /api/facilities/:id/catchments/:cid
  app.patch("/api/facilities/:id/catchments/:cid", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const tenantId = req.tenantId as string;
      const schema = z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).optional(),
        populationEstimate: z.number().int().nonnegative().optional(),
        isOfficial: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
      const updated = await storage.updateFacilityCatchment(tenantId, req.params.cid, parsed.data);
      if (!updated) return res.status(404).json({ message: "Catchment not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update catchment" });
    }
  });



  // ─── Current Stock Balance ────────────────────────────────────────────────
  app.get("/api/facilities/:id/stock-balance", ...auth, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid facility ID" });
      }

      const txns = await storage.getStockTransactions(req.tenantId, facilityId);
      const balance: Record<string, number> = {};

      for (const t of txns) {
        const name = normalizeStockVaccineName(t.vaccineName || "Unknown");
        if (!balance[name]) balance[name] = 0;
        const qty = t.quantityDoses;
        if (t.transactionType === "receipt" || t.transactionType === "adjustment") {
          balance[name] += qty;
        } else if (["issue", "loss", "administered", "wasted", "expired", "transfer", "transfer_out"].includes(t.transactionType)) {
          balance[name] -= qty;
        }
      }

      res.json(balance);
    } catch (error: any) {
      console.error("Error fetching stock balance:", error);
      res.status(500).json({ message: safeErrorMessage(error, "Failed to fetch stock balance") });
    }
  });

  // ==========================================================================
  // PHASE 5D — CATCHMENT POLYGON: Facility-level & Village-level
  // ==========================================================================

  // GET /api/facilities/:id/catchment-polygon — return stored polygon + pop estimate
  app.get("/api/facilities/:id/catchment-polygon", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id, 10);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facility id" });
      const [row] = await db.select({
        catchmentPolygon: facilities.catchmentPolygon,
        catchmentGridPopulation: facilities.catchmentGridPopulation,
      }).from(facilities)
        .where(and(eq(facilities.id, facilityId), eq(facilities.tenantId, req.tenantId)))
        .limit(1);
      if (!row) return res.status(404).json({ message: "Facility not found" });

      const { gisPolygons } = await import("@shared/schema");

      // Get the active polygon from gisPolygons table
      const [activeGeo] = await db.select().from(gisPolygons)
        .where(and(
          eq(gisPolygons.tenantId, req.tenantId),
          eq(gisPolygons.ownerType, "facility"),
          eq(gisPolygons.ownerId, facilityId),
          eq(gisPolygons.status, "active")
        )).limit(1);

      const [draftRow] = await db.select().from(gisPolygons)
        .where(and(
          eq(gisPolygons.tenantId, req.tenantId),
          eq(gisPolygons.ownerType, "facility"),
          eq(gisPolygons.ownerId, facilityId),
          inArray(gisPolygons.status, ["draft", "submitted_for_review", "needs_correction"])
        )).orderBy(desc(gisPolygons.version)).limit(1);

      const isMicroplanLocked = await isFacilityMicroplanLocked(req.tenantId, facilityId);

      res.json({
        catchmentPolygon: activeGeo?.geometry || row.catchmentPolygon || null,
        catchmentGridPopulation: activeGeo?.populationEstimate || row.catchmentGridPopulation || null,
        areaSqKm: activeGeo?.areaSqKm ? Number(activeGeo.areaSqKm) : null,
        centroid: activeGeo?.centroid || null,
        populationEstimate: activeGeo?.populationEstimate || null,
        populationSource: activeGeo?.populationSource || null,
        populationSourceYear: activeGeo?.populationSourceYear || null,
        populationMethod: activeGeo?.populationMethod || null,
        confidence: activeGeo?.confidence || null,
        validationStatus: activeGeo?.validationStatus || "draft",
        approvalStatus: activeGeo?.approvalStatus || "draft",
        createdBy: activeGeo?.createdBy || null,
        updatedAt: activeGeo?.updatedAt || null,
        draftPolygon: draftRow?.geometry || null,
        draftPolygonDetails: draftRow || null,
        isMicroplanLocked,
        population: activeGeo ? {
          totalPopulation: activeGeo.populationEstimate,
          targetInfants: Math.round((activeGeo.populationEstimate || 0) * 0.04),
          underOne: Math.round((activeGeo.populationEstimate || 0) * 0.04),
          underFive: Math.round((activeGeo.populationEstimate || 0) * 0.17),
          womenOfChildbearingAge: Math.round((activeGeo.populationEstimate || 0) * 0.22),
          source: activeGeo.populationSource,
          sourceYear: activeGeo.populationSourceYear,
          method: activeGeo.populationMethod,
          confidence: activeGeo.confidence,
          status: activeGeo.status,
          calculatedAt: activeGeo.updatedAt?.toISOString()
        } : null
      });
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Failed to load catchment polygon") });
    }
  });

  // PATCH /api/facilities/:id/catchment-polygon — save/update HF catchment polygon
  app.patch("/api/facilities/:id/catchment-polygon", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id, 10);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facility id" });

      const dbUser = req.dbUser ?? (await storage.getUser(getCurrentUserId(req)));
      if (!dbUser) return res.status(403).json({ message: "Forbidden: User context not resolved" });
      req.dbUser = dbUser;
      if (!(await userCanAccessGeo(dbUser, req.tenantId, { facilityId }))) {
        return res.status(403).json({ message: "Forbidden: no access to save this facility catchment polygon." });
      }

      const locked = await isFacilityMicroplanLocked(req.tenantId, facilityId);
      const isPrivileged = [
        "platform_admin",
        "national_admin",
        "national_manager",
        "super_admin",
        "gis_specialist",
        "provincial_coordinator",
        "district_manager",
      ].includes(dbUser.role) || hasPermission(dbUser.role, "polygon.edit") || hasPermission(dbUser.role, "manage_boundaries");

      if (locked && !isPrivileged && !req.body.overrideLock) {
        return res.status(400).json({
          message: "Facility's catchment area editing is locked because there is a submitted microplan."
        });
      }

      const { geojson, gridPopulation, status = 'active' } = req.body;
      const { gisPolygons } = await import("@shared/schema");

      if (status === "active") {
        const [currentActive] = await db.select({ id: gisPolygons.id }).from(gisPolygons)
          .where(and(
            eq(gisPolygons.tenantId, req.tenantId),
            eq(gisPolygons.ownerType, "facility"),
            eq(gisPolygons.ownerId, facilityId),
            eq(gisPolygons.isActive, true),
            eq(gisPolygons.status, "active")
          )).limit(1);
        if (currentActive && !req.body.replaceActive && !req.body.overrideLock && !isPrivileged) {
          return res.status(409).json({
            code: "POLYGON_VERSION_REQUIRED",
            message: "This approved catchment cannot be overwritten. Use the polygon edit or replace workflow to create a reviewable version."
          });
        }
      }

      if (status === 'clear_draft') {
        await db.update(gisPolygons).set({ status: "archived", isActive: false, updatedAt: new Date() })
          .where(and(
            eq(gisPolygons.tenantId, req.tenantId),
            eq(gisPolygons.ownerType, "facility"),
            eq(gisPolygons.ownerId, facilityId),
            eq(gisPolygons.status, "draft")
          ));
        return res.json({ ok: true, cleared: true });
      }

      if (!geojson || typeof geojson !== "object") return res.status(400).json({ message: "geojson polygon required" });

      // Run Turf.js validations & calculations
      const {
        validatePolygonGeometry,
        polygonCentroid,
        pointInsidePolygon
      } = await import("../services/microplanPrefillService");
      const { PopulationIntelligenceService } = await import("../services/populationIntelligenceService");

      const validation = validatePolygonGeometry(geojson);
      if (!validation.valid) {
        return res.status(400).json({
          message: "Invalid polygon geometry: " + validation.errors.join(", ")
        });
      }

      const areaSqKm = validation.areaSqKm;
      const centroid = polygonCentroid(geojson);

      // Estimate population using the active tenant country code.
      const activeTenant = req.tenantId ? await storage.getTenant(req.tenantId) : undefined;
      const activeCountryCode = (activeTenant?.countryCode || activeTenant?.code || "ZMB").toUpperCase();
      const intel = await PopulationIntelligenceService.fetchPolygonPopulation(req.tenantId, geojson, activeCountryCode, "facility", facilityId);
      const bestSource = intel?.sources?.[0];
      const popEst = bestSource?.totalPopulation ?? 0;
      const popSource = bestSource?.source ?? "WorldPop";
      const popSourceYear = bestSource?.year ?? new Date().getFullYear();
      const popMethod = bestSource?.method ?? "ST_Intersects";
      const confidence = bestSource?.confidence ?? "Low";

      // Check warnings (facility point coordinates outside drawn polygon)
      const [facInfo] = await db.select({
        latitude: facilities.latitude,
        longitude: facilities.longitude
      }).from(facilities).where(eq(facilities.id, facilityId)).limit(1);

      const warnings = [...validation.warnings];
      if (facInfo?.latitude && facInfo?.longitude) {
        const isInside = pointInsidePolygon(facInfo.latitude, facInfo.longitude, geojson);
        if (!isInside) {
          warnings.push("Warning: The facility point coordinates lie outside the drawn catchment polygon.");
        }
      }

      const createdBy = (req.user as any)?.username || "system";
      const polyData = {
        tenantId: req.tenantId,
        ownerType: "facility",
        ownerId: facilityId,
        parentFacilityId: facilityId,
        polygonType: "catchment" as "custom" | "catchment" | "outreach_area" | "administrative_boundary",
        geometry: geojson as any,
        centroid: centroid as any,
        areaSqKm: areaSqKm ? String(areaSqKm) : null,
        populationEstimate: popEst,
        populationSource: popSource,
        populationSourceYear: popSourceYear,
        populationMethod: popMethod,
        confidence: confidence,
        status: status,
        version: 1,
        isActive: status === "active",
        validFrom: status === "active" ? new Date() : null,
        changeType: "created",
        validationStatus: "valid",
        approvalStatus: status === "active" ? "approved" : "draft",
        createdBy: createdBy,
        updatedAt: new Date()
      };

      // If active, save to primary table to retain backwards compatibility
      let updatedCatchment = null;
      let updatedPop = null;
      if (status === 'active') {
        const [updated] = await db.update(facilities).set({
          catchmentPolygon: geojson as any,
          catchmentGridPopulation: popEst,
          updatedAt: new Date(),
        }).where(and(eq(facilities.id, facilityId), eq(facilities.tenantId, req.tenantId))).returning();
        if (!updated) return res.status(404).json({ message: "Facility not found" });
        await logAudit(req, "update_catchment_polygon", "facility", facilityId, null, { facilityId, gridPopulation: popEst });
        updatedCatchment = updated.catchmentPolygon;
        updatedPop = updated.catchmentGridPopulation;
      }

      // Upsert into gis_polygons for this status
      const existing = await db.select({ id: gisPolygons.id }).from(gisPolygons)
        .where(and(
           eq(gisPolygons.tenantId, req.tenantId),
           eq(gisPolygons.ownerType, "facility"),
           eq(gisPolygons.ownerId, facilityId),
           eq(gisPolygons.status, status)
        )).limit(1);

      if (existing.length > 0) {
        await db.update(gisPolygons).set(polyData).where(eq(gisPolygons.id, existing[0].id));
      } else {
        await db.insert(gisPolygons).values(polyData as any);
      }

      // If we saved an active polygon, clear any existing drafts
      if (status === 'active') {
         await db.update(gisPolygons).set({ status: "archived", isActive: false, updatedAt: new Date() })
          .where(and(
            eq(gisPolygons.tenantId, req.tenantId),
            eq(gisPolygons.ownerType, "facility"),
            eq(gisPolygons.ownerId, facilityId),
            eq(gisPolygons.status, "draft")
          ));
      }

      res.json({
        ok: true,
        catchmentPolygon: updatedCatchment || geojson,
        catchmentGridPopulation: updatedPop || popEst,
        areaSqKm: areaSqKm,
        centroid: centroid,
        population: {
          totalPopulation: popEst,
          targetInfants: Math.round(popEst * 0.04),
          underOne: Math.round(popEst * 0.04),
          underFive: Math.round(popEst * 0.17),
          womenOfChildbearingAge: Math.round(popEst * 0.22),
          source: popSource,
          sourceYear: popSourceYear,
          method: popMethod,
          confidence: confidence,
          status: status,
          calculatedAt: new Date().toISOString()
        },
        validationStatus: "valid",
        approvalStatus: status === "active" ? "approved" : "draft",
        warnings,
        status
      });
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Failed to save catchment polygon") });
    }
  });

  // DELETE /api/facilities/:id/catchment-polygon — delete facility catchment polygon (National Admin & Managers)
  app.delete("/api/facilities/:id/catchment-polygon", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id, 10);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facility id" });

      const dbUser = req.dbUser ?? (await storage.getUser(getCurrentUserId(req)));
      if (!dbUser) return res.status(403).json({ message: "Forbidden: User context not resolved" });
      req.dbUser = dbUser;

      const userRole = (dbUser.role || "").toLowerCase();
      const userRoles: string[] = Array.isArray(dbUser.roles)
        ? dbUser.roles.map((r: any) => String(r).toLowerCase())
        : [];
      const allowedRoles = [
        "platform_admin",
        "national_admin",
        "national_manager",
        "gis_specialist",
        "provincial_coordinator",
        "district_manager",
        "admin",
        "manager",
      ];
      const isAllowed = allowedRoles.includes(userRole) || userRoles.some((r) => allowedRoles.includes(r));

      if (!isAllowed) {
        return res.status(403).json({
          message: "Forbidden: Only National Admins and Managers can delete facility catchment polygons."
        });
      }

      const [facility] = await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.id, facilityId), eq(facilities.tenantId, req.tenantId)))
        .limit(1);
      if (!facility) return res.status(404).json({ message: "Facility not found" });

      const { gisPolygons, facilityCatchments } = await import("@shared/schema");

      // Archive active and draft polygons in gisPolygons table
      await db
        .update(gisPolygons)
        .set({ status: "archived", isActive: false, validTo: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(gisPolygons.tenantId, req.tenantId),
            eq(gisPolygons.ownerType, "facility"),
            eq(gisPolygons.ownerId, facilityId)
          )
        );

      // Clear catchment fields in facilities table
      await db
        .update(facilities)
        .set({
          catchmentPolygon: null,
          catchmentRadius: null,
          catchmentGridPopulation: 0,
          updatedAt: new Date(),
        })
        .where(and(eq(facilities.id, facilityId), eq(facilities.tenantId, req.tenantId)));

      // Delete records from facilityCatchments table
      await db
        .delete(facilityCatchments)
        .where(and(eq(facilityCatchments.facilityId, facilityId), eq(facilityCatchments.tenantId, req.tenantId)));

      await logAudit(req, "delete_facility_catchment_polygon", "facilities", facilityId, facility, null);

      res.json({ success: true, message: "Facility catchment polygon deleted successfully." });
    } catch (err: any) {
      console.error("DELETE /api/facilities/:id/catchment-polygon error:", err);
      res.status(500).json({ message: safeErrorMessage(err, "Failed to delete catchment polygon") });
    }
  });

  // GET /api/facilities/:id/uncovered-communities — list flagged uncovered communities
  app.get("/api/facilities/:id/uncovered-communities", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id, 10);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facility id" });
      const { uncoveredCommunities } = await import("@shared/schema");
      const rows = await db.select().from(uncoveredCommunities)
        .where(and(eq(uncoveredCommunities.tenantId, req.tenantId), eq(uncoveredCommunities.facilityId, facilityId)))
        .orderBy(uncoveredCommunities.flaggedAt);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Failed to load uncovered communities") });
    }
  });

  // POST /api/facilities/:id/flag-uncovered — flag a list of uncovered communities
  app.post("/api/facilities/:id/flag-uncovered", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.id, 10);
      if (isNaN(facilityId)) return res.status(400).json({ message: "Invalid facility id" });
      const { communities, flaggedLevel } = req.body;
      if (!Array.isArray(communities)) return res.status(400).json({ message: "communities array required" });
      const { uncoveredCommunities } = await import("@shared/schema");
      const created: any[] = [];
      for (const c of communities) {
        const [row] = await db.insert(uncoveredCommunities).values({
          tenantId: req.tenantId,
          facilityId,
          villageId: c.villageId || null,
          villageName: c.villageName || null,
          estimatedPopulation: c.estimatedPopulation || 0,
          flaggedLevel: flaggedLevel || "district",
          note: c.note || null,
        } as any).returning();
        created.push(row);
      }
      // Fire in-app notifications to district + provincial coordinators
      try {
        const facility = await storage.getFacility(req.tenantId, facilityId);
        if (facility) {
          const districtUsers = await db.select({ id: users.id }).from(users)
            .where(and(eq(users.tenantId, req.tenantId), eq(users.districtId, facility.districtId as any)));
          for (const u of districtUsers) {
            await db.insert(notifications).values({
              tenantId: req.tenantId,
              userId: u.id,
              type: "uncovered_communities_flagged",
              title: `Uncovered communities flagged at ${facility.name}`,
              body: `${communities.length} community areas were flagged as uncovered and need to be assigned to a session plan.`,
              data: { facilityId, count: communities.length } as any,
            }).catch(() => {});
          }
        }
      } catch { /* notification failure should not fail the flag action */ }
      res.status(201).json({ ok: true, flagged: created.length, items: created });
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Failed to flag uncovered communities") });
    }
  });



  app.get("/api/facilities/:facilityId/population-intelligence", ...auth, async (req: any, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId);
      const radiusKm = parseFloat(req.query.radiusKm as string) || 5;

      if (isNaN(facilityId)) {
        return res.status(400).json({ message: "Valid facilityId required." });
      }

      const { PopulationIntelligenceService } = await import("../services/populationIntelligenceService");
      const result = await PopulationIntelligenceService.fetchFacilityPopulation(req.tenantId, facilityId, radiusKm);

      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error("[Pop Intel API]", err);
      res.status(500).json({ message: safeErrorMessage(err, "Failed to load facility population intelligence") });
    }
  });

}
