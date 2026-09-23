import { Express } from "express";
import { and, desc, eq, inArray, ne, sql as dsql } from "drizzle-orm";
import {
  area as turfArea,
  intersect as turfIntersect,
  featureCollection as turfFeatureCollection,
} from "@turf/turf";
import { db, pool } from "../db";
import { storage, refreshFacilityPopulationAggregate } from "../storage";
import {
  villages,
  settlementsMaster,
  candidateUnmappedSettlements,
  gisPolygons,
  adminBoundaries,
  districts,
  facilities,
  populationData,
  populationGrids,
  sessionPlans,
  sessionVillages,
  insertVillageSchema,
} from "@shared/schema";
import { isAuthenticated, getCurrentUserId } from "../auth";
import { requireTenant } from "../auth/tenantResolver";
import { requireDbUser } from "../auth/loadDbUser";
import { safeErrorMessage } from "../errorUtils";
import { sendEmail } from "../services/mailer";
import {
  assignAdminBoundaries,
  getNearestHealthFacility,
  calculateHTRIndex,
  runMissingSettlementDetection,
} from "../pipeline/settlementEngine";
import { resolveSessionLocation } from "../services/proximityCheck";
import {
  computeOutreachSuitability,
  estimateUnder5,
  estimateZeroDoseChildren,
} from "@shared/outreachSuitability";
import {
  outsideVillageIds,
  isLocationOutsideTenantBoundary,
  setCacheHeaders,
  getGeoScope,
  recordInGeoScope,
  userCanAccessGeo,
  logAudit,
  isFacilityMicroplanLocked,
  requireAdmin,
  loadRole,
} from "../routes";

const auth = [isAuthenticated, requireTenant, requireDbUser] as const;

// Helper to compute Haversine distance in kilometers
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// Helper to compute geometric centroid of a Polygon/MultiPolygon geometry
export function normalizeTransportMode(
  mode?: string | null,
  isHardToReach: boolean = false,
): "walking" | "road" | "car" | "motorbike" | "donkey" | "boat" | "air" | "chopper" {
  if (!mode) return isHardToReach ? "walking" : "motorbike";
  const m = mode.toLowerCase().trim();
  if (m === "foot" || m === "walk" || m === "walking" || m === "pedestrian") return "walking";
  if (m === "motorcycle" || m === "motorbike" || m === "bike" || m === "moto") return "motorbike";
  if (m === "car" || m === "vehicle" || m === "automobile" || m === "4wd" || m === "truck") return "car";
  if (m === "road") return "road";
  if (m === "donkey" || m === "horse" || m === "animal") return "donkey";
  if (m === "boat" || m === "canoe" || m === "ship" || m === "water") return "boat";
  if (m === "air" || m === "plane" || m === "airplane") return "air";
  if (m === "chopper" || m === "helicopter") return "chopper";
  return isHardToReach ? "walking" : "motorbike";
}

export function getCentroid(geometry: any): [number, number] | null {
  if (!geometry || !geometry.coordinates) return null;

  let totalLng = 0;
  let totalLat = 0;
  let pointCount = 0;

  function processCoords(coords: any): void {
    if (
      Array.isArray(coords) &&
      coords.length >= 2 &&
      typeof coords[0] === "number" &&
      typeof coords[1] === "number"
    ) {
      totalLng += coords[0];
      totalLat += coords[1];
      pointCount++;
    } else if (Array.isArray(coords)) {
      coords.forEach(processCoords);
    }
  }

  processCoords(geometry.coordinates);

  if (pointCount === 0) return null;
  return [totalLng / pointCount, totalLat / pointCount];
}

// Normalise a stored boundary (GeoJSON geometry or Feature) into a Turf
// Polygon/MultiPolygon Feature; returns null when there is no usable polygon.
export function toBoundaryFeature(geometry: any): any | null {
  if (!geometry || typeof geometry !== "object") return null;
  const geom = geometry.type === "Feature" ? geometry.geometry : geometry;
  if (!geom || !geom.coordinates) return null;
  if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return null;
  return { type: "Feature", geometry: geom, properties: {} };
}

// Returns the communities whose saved boundary intersects `boundary`, with the
// owning facility and the overlap magnitude (as % of the new boundary's area).
export async function detectCommunityBoundaryOverlaps(
  tenantId: string,
  boundary: any,
  excludeVillageId?: number,
): Promise<
  Array<{
    villageId: number;
    villageName: string;
    facilityId: number | null;
    facilityName: string | null;
    overlapPct: number;
    overlapAreaSqKm: number;
  }>
> {
  const feat = toBoundaryFeature(boundary);
  if (!feat) return [];
  let newArea = 0;
  try {
    newArea = turfArea(feat);
  } catch {
    return [];
  }
  if (!newArea || newArea <= 0) return [];

  const all = await storage.getVillages(tenantId);
  const facilityNameCache = new Map<number, string | null>();
  const overlaps: Array<{
    villageId: number;
    villageName: string;
    facilityId: number | null;
    facilityName: string | null;
    overlapPct: number;
    overlapAreaSqKm: number;
  }> = [];

  for (const other of all) {
    if (excludeVillageId && Number(other.id) === Number(excludeVillageId)) continue;
    const otherFeat = toBoundaryFeature((other as any).boundary);
    if (!otherFeat) continue;
    let inter: any = null;
    try {
      inter = turfIntersect(turfFeatureCollection([feat, otherFeat]));
    } catch {
      continue;
    }
    if (!inter) continue;
    let interArea = 0;
    try {
      interArea = turfArea(inter);
    } catch {
      continue;
    }
    if (interArea <= 0) continue;

    const facId = ((other as any).assignedFacilityId ?? null) as number | null;
    let facName: string | null = null;
    if (facId !== null) {
      if (facilityNameCache.has(facId)) {
        facName = facilityNameCache.get(facId)!;
      } else {
        const f = await storage.getFacility(tenantId, facId);
        facName = f?.name ?? null;
        facilityNameCache.set(facId, facName);
      }
    }

    overlaps.push({
      villageId: Number(other.id),
      villageName: (other as any).name,
      facilityId: facId,
      facilityName: facName,
      overlapPct: Math.round((interArea / newArea) * 10000) / 100,
      overlapAreaSqKm: Math.round((interArea / 1_000_000) * 1000) / 1000,
    });
  }
  return overlaps;
}

// Helper to calculate and persist village population from boundary polygon or coordinates
export async function estimateAndSaveVillagePopulation(
  tenantId: string,
  villageId: number,
  dbInstance: any = db,
): Promise<number | null> {
  try {
    const [villageRow] = await dbInstance
      .select({
        id: villages.id,
        boundary: villages.boundary,
        latitude: villages.latitude,
        longitude: villages.longitude,
        districtId: villages.districtId,
        assignedFacilityId: villages.assignedFacilityId,
      })
      .from(villages)
      .where(and(eq(villages.id, villageId), eq(villages.tenantId, tenantId)));

    if (!villageRow) return null;

    let totalPop = 0;
    let under5Pop = 0;

    if (villageRow.boundary) {
      let geomJson =
        typeof villageRow.boundary === "string"
          ? villageRow.boundary
          : JSON.stringify(villageRow.boundary);
      if (typeof villageRow.boundary === "object" && (villageRow.boundary as any).geometry) {
        geomJson = JSON.stringify((villageRow.boundary as any).geometry);
      }

      const res = await pool.query(
        `
        SELECT
          COALESCE(SUM(population_total), 0)::int AS total_pop,
          COALESCE(SUM(under5_population), 0)::int AS under5_pop
        FROM population_grids
        WHERE tenant_id = $1
          AND geometry IS NOT NULL
          AND ST_Intersects(
            geometry,
            ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)
          )
        `,
        [tenantId, geomJson],
      );
      if (res.rows[0]) {
        totalPop = res.rows[0].total_pop || 0;
        under5Pop = res.rows[0].under5_pop || 0;
      }
    } else if (villageRow.latitude && villageRow.longitude) {
      const latVal = parseFloat(villageRow.latitude.toString());
      const lngVal = parseFloat(villageRow.longitude.toString());
      if (!isNaN(latVal) && !isNaN(lngVal)) {
        const res = await pool.query(
          `
          SELECT
            COALESCE(population_total, 0)::int AS total_pop,
            COALESCE(under5_population, 0)::int AS under5_pop
          FROM population_grids
          WHERE tenant_id = $1
            AND geometry IS NOT NULL
            AND ST_Contains(
              geometry,
              ST_SetSRID(ST_MakePoint($2, $3), 4326)
            )
          LIMIT 1
          `,
          [tenantId, lngVal, latVal],
        );
        if (res.rows[0]) {
          totalPop = res.rows[0].total_pop || 0;
          under5Pop = res.rows[0].under5_pop || 0;
        }
      }
    } else {
      return null;
    }

    const under1Pop = Math.round(under5Pop / 5) || Math.round(totalPop * 0.035);

    let provinceId: number | null = null;
    if (villageRow.districtId) {
      const [d] = await dbInstance
        .select({ provinceId: districts.provinceId })
        .from(districts)
        .where(and(eq(districts.id, villageRow.districtId), eq(districts.tenantId, tenantId)));
      if (d) provinceId = d.provinceId;
    }

    const existing = await dbInstance
      .select()
      .from(populationData)
      .where(
        and(
          eq(populationData.tenantId, tenantId),
          eq(populationData.villageId, villageId),
        ),
      )
      .orderBy(desc(populationData.year))
      .limit(1);

    if (existing.length > 0) {
      await dbInstance
        .update(populationData)
        .set({
          totalPopulation: totalPop,
          under5Population: under5Pop,
          under1Population: under1Pop,
          facilityId: villageRow.assignedFacilityId ?? null,
          districtId: villageRow.districtId,
          provinceId: provinceId,
          updatedAt: new Date(),
        })
        .where(eq(populationData.id, existing[0].id));
    } else {
      await dbInstance
        .insert(populationData)
        .values({
          tenantId,
          villageId,
          facilityId: villageRow.assignedFacilityId ?? null,
          districtId: villageRow.districtId,
          provinceId: provinceId,
          source: "nso",
          year: new Date().getFullYear(),
          totalPopulation: totalPop,
          under5Population: under5Pop,
          under1Population: under1Pop,
          approvalStatus: "approved",
        });
    }
    await dbInstance
      .update(villages)
      .set({
        totalCatchmentPopulation: Number(totalPop ?? 0),
        under5Population: Number(under5Pop ?? 0),
        updatedAt: new Date(),
      })
      .where(and(eq(villages.tenantId, tenantId), eq(villages.id, villageId)));
    await refreshFacilityPopulationAggregate(tenantId, villageRow.assignedFacilityId ?? null);
    return totalPop;
  } catch (err) {
    console.error(`Error estimating/saving population for village ${villageId}:`, err);
    return null;
  }
}

export function registerCommunityRoutes(app: Express) {
  // ─── Villages summary (dashboard-optimised — omits heavy geometry/text columns) ─
  app.get("/api/villages/summary", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      const scope = await getGeoScope(dbUser, req.tenantId);

      const rows = await db
        .select({
          id: villages.id,
          name: villages.name,
          districtId: villages.districtId,
          assignedFacilityId: villages.assignedFacilityId,
          isHardToReach: villages.isHardToReach,
          latitude: villages.latitude,
          longitude: villages.longitude,
          code: villages.code,
          distanceToFacility: villages.distanceToFacility,
          travelTimeMinutes: villages.travelTimeMinutes,
          transportMode: villages.transportMode,
          seasonalAccessibility: villages.seasonalAccessibility,
          settlementType: villages.settlementType,
          totalCatchmentPopulation: villages.totalCatchmentPopulation,
          griddedPopulation: villages.griddedPopulation,
          under5Population: villages.under5Population,
          outreachLatitude: villages.outreachLatitude,
          outreachLongitude: villages.outreachLongitude,
          outreachPostName: villages.outreachPostName,
          population: dsql<number>`COALESCE(${villages.griddedPopulation}, ${villages.totalCatchmentPopulation}, 0)`.mapWith(Number),
        })
        .from(villages)
        .where(eq(villages.tenantId, req.tenantId));

      let result = scope.all
        ? rows
        : rows.filter((v) =>
            recordInGeoScope(scope, {
              districtId: (v as any).districtId,
              facilityId: (v as any).assignedFacilityId,
            }),
          );
      result = result.filter((v) => !outsideVillageIds.has(Number(v.id)));
      setCacheHeaders(res, 600); // 10 min — village summary rarely changes
      res.json(result);
    } catch (error) {
      console.error("Error fetching village summary:", error);
      res.status(500).json({ message: "Failed to fetch village summary" });
    }
  });

  app.get("/api/villages", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      const districtId = req.query.districtId ? parseInt(req.query.districtId as string) : undefined;
      const facilityId = req.query.facilityId ? parseInt(req.query.facilityId as string) : undefined;

      setCacheHeaders(res, 300);

      const scope = await getGeoScope(dbUser, req.tenantId);
      const all = await storage.getVillages(req.tenantId, districtId, facilityId);
      let result = scope.all
        ? all
        : all.filter((v) =>
            recordInGeoScope(
              scope,
              {
                districtId: (v as any).districtId,
                facilityId: (v as any).assignedFacilityId,
              },
              true,
            ),
          );
      result = result.filter((v) => !outsideVillageIds.has(Number(v.id)));
      res.set("Pragma", "no-cache");
      res.json(result);
    } catch (error) {
      console.error("Error fetching villages:", error);
      res.status(500).json({ message: "Failed to fetch villages" });
    }
  });

  app.get("/api/villages/:id", ...auth, async (req: any, res) => {
    try {
      const dbUser = req.dbUser!;
      const village = await storage.getVillage(req.tenantId, parseInt(req.params.id));
      if (!village) return res.status(404).json({ message: "Village not found" });
      if (
        !(await userCanAccessGeo(dbUser, req.tenantId, {
          facilityId: (village as any).assignedFacilityId,
          districtId: (village as any).districtId,
          isVillage: true,
        }))
      ) {
        return res.status(404).json({ message: "Village not found" });
      }
      res.json(village);
    } catch (error) {
      console.error("Error fetching village:", error);
      res.status(500).json({ message: "Failed to fetch village" });
    }
  });

  app.post("/api/villages", ...auth, async (req: any, res) => {
    try {
      const body = { ...req.body };

      if (body.assignedFacilityId) {
        const facilityId = parseInt(body.assignedFacilityId);
        const facility = await storage.getFacility(req.tenantId, facilityId);
        if (facility) {
          body.districtId = facility.districtId;

          if (
            body.latitude &&
            body.longitude &&
            facility.latitude &&
            facility.longitude &&
            !body.distanceToFacility
          ) {
            const dist = calculateHaversineDistance(
              parseFloat(body.latitude),
              parseFloat(body.longitude),
              parseFloat(facility.latitude.toString()),
              parseFloat(facility.longitude.toString()),
            );
            body.distanceToFacility = dist.toFixed(2);
          }
        }
      }

      if (body.boundary && !body.latitude && !body.longitude) {
        let geom = body.boundary;
        if (typeof geom === "string") {
          try {
            geom = JSON.parse(geom);
          } catch {
            geom = null;
          }
        }
        if (geom && geom.type === "Feature") geom = geom.geometry;
        const centroid = getCentroid(geom);
        if (centroid) {
          body.longitude = centroid[0];
          body.latitude = centroid[1];
        }
      }

      if (body.assignedFacilityId && body.latitude && body.longitude && !body.distanceToFacility) {
        const facilityId = parseInt(body.assignedFacilityId);
        const facility = await storage.getFacility(req.tenantId, facilityId);
        if (facility && facility.latitude && facility.longitude) {
          const dist = calculateHaversineDistance(
            parseFloat(body.latitude),
            parseFloat(body.longitude),
            parseFloat(facility.latitude.toString()),
            parseFloat(facility.longitude.toString()),
          );
          body.distanceToFacility = dist.toFixed(2);
        }
      }

      if (
        body.districtId === undefined ||
        body.districtId === null ||
        isNaN(parseInt(body.districtId))
      ) {
        return res.status(400).json({
          message:
            "A village must be associated with a valid districtId or an assignedFacilityId from which the district can be derived.",
        });
      }

      const canCreate = await userCanAccessGeo(req.dbUser, req.tenantId, {
        facilityId: body.assignedFacilityId ? parseInt(body.assignedFacilityId) : null,
        districtId: body.districtId ? parseInt(body.districtId) : null,
        isVillage: true,
      });
      if (!canCreate) {
        return res
          .status(403)
          .json({ message: "Forbidden: no access to create villages in this facility or district" });
      }

      if (body.boundary && req.body?.ignoreOverlapWarning !== true) {
        const overlaps = await detectCommunityBoundaryOverlaps(req.tenantId, body.boundary);
        if (overlaps.length > 0) {
          return res.status(409).json({
            code: "COMMUNITY_BOUNDARY_OVERLAP",
            message: `This boundary overlaps with ${overlaps.length} existing community area(s).`,
            overlaps,
          });
        }
      }

      if (body.transportMode) {
        body.transportMode = normalizeTransportMode(body.transportMode, body.isHardToReach);
      }
      const villageData = insertVillageSchema.parse(body);
      const village = await storage.createVillage(req.tenantId, villageData);

      if (village.latitude != null && village.longitude != null) {
        const outside = await isLocationOutsideTenantBoundary(
          req.tenantId,
          Number(village.latitude),
          Number(village.longitude),
        );
        if (outside) {
          outsideVillageIds.add(Number(village.id));
        } else {
          outsideVillageIds.delete(Number(village.id));
        }
      } else {
        outsideVillageIds.delete(Number(village.id));
      }

      await estimateAndSaveVillagePopulation(req.tenantId, village.id);

      const enrichedVillage = await storage.getVillage(req.tenantId, village.id);
      await logAudit(req, "create", "village", village.id, null, enrichedVillage);

      const overlapList = (enrichedVillage as any)?.boundary
        ? await detectCommunityBoundaryOverlaps(
            req.tenantId,
            (enrichedVillage as any).boundary,
            Number(enrichedVillage?.id || village.id),
          )
        : [];

      res.status(201).json({ ...(enrichedVillage || village), overlaps: overlapList });
    } catch (error) {
      console.error("Error creating village:", error);
      res.status(400).json({ message: "Invalid village data" });
    }
  });

  const extractionStatus = new Map<number, { current: number; total: number; stage: string }>();

  app.get("/api/villages/extract/progress", ...auth, (req: any, res) => {
    const status = extractionStatus.get(req.tenantId);
    if (!status) {
      return res.json({ success: false, message: "No active extraction" });
    }
    res.json({ success: true, ...status });
  });

  app.post("/api/villages/extract", ...auth, async (req: any, res) => {
    try {
      extractionStatus.set(req.tenantId, {
        current: 0,
        total: 100,
        stage: "Loading boundary GeoJSON polygons...",
      });
      const boundaries = await db
        .select()
        .from(adminBoundaries)
        .where(eq(adminBoundaries.tenantId, req.tenantId));

      if (boundaries.length === 0) {
        extractionStatus.delete(req.tenantId);
        return res.status(400).json({
          success: false,
          message:
            "No administrative boundary maps seeded for this country. Please upload a map boundary or use the CSV importer.",
        });
      }

      // Sort boundaries by adminLevel descending to prefer finest admin unit (Ward > District > Province)
      const sortedBoundaries = [...boundaries].sort(
        (a, b) => (b.adminLevel || 0) - (a.adminLevel || 0)
      );

      let targetBoundary: any = null;
      let targetFeatures: any[] = [];

      for (const b of sortedBoundaries) {
        if (!b.geojson) continue;
        let parsed: any = b.geojson;
        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            continue;
          }
        }
        const feats = parsed?.features || (parsed?.type === "Feature" ? [parsed] : []);
        if (Array.isArray(feats) && feats.length > 0) {
          targetBoundary = b;
          targetFeatures = feats;
          break;
        }
      }

      if (!targetBoundary || targetFeatures.length === 0) {
        extractionStatus.delete(req.tenantId);
        return res.status(400).json({
          success: false,
          message:
            "No geometric features found in boundary layers. Please upload boundary GeoJSON files in Boundary Manager or import communities via CSV.",
        });
      }

      const allDistricts = await storage.getDistricts(req.tenantId);
      if (allDistricts.length === 0) {
        extractionStatus.delete(req.tenantId);
        return res.status(400).json({
          success: false,
          message:
            "No administrative districts found for this country. Please configure at least one district in Geographic Setup before extracting communities.",
        });
      }

      const requestedProvinceId = Number(req.body?.provinceId) || null;
      const requestedDistrictId = Number(req.body?.districtId) || null;
      const scopedDistricts = requestedDistrictId
        ? allDistricts.filter((d) => Number(d.id) === requestedDistrictId)
        : requestedProvinceId
          ? allDistricts.filter((d: any) => Number(d.provinceId) === requestedProvinceId)
          : allDistricts;

      if (scopedDistricts.length === 0) {
        extractionStatus.delete(req.tenantId);
        return res.status(400).json({
          success: false,
          message: "The selected geographic scope does not contain any configured districts.",
        });
      }

      const scopedDistrictIds = new Set(scopedDistricts.map((d) => Number(d.id)));
      const districtMap = new Map<string, number>();
      scopedDistricts.forEach((d) => districtMap.set(d.name.toLowerCase().trim(), d.id));

      const allFacilities = (await storage.getFacilities(req.tenantId)).filter((facility) =>
        scopedDistrictIds.has(Number(facility.districtId)),
      );

      const existingVillages = await storage.getVillages(req.tenantId);
      const existingByDistrictAndName = new Map(
        existingVillages.map((v) => [
          `${Number(v.districtId)}:${v.name.toLowerCase().trim()}`,
          v,
        ]),
      );

      const created: any[] = [];
      const synchronized: any[] = [];
      const skipped: string[] = [];
      const pendingKeys = new Set<string>();

      extractionStatus.set(req.tenantId, {
        current: 0,
        total: targetFeatures.length,
        stage: "Computing polygon centroids and spatial health facility catchments...",
      });

      for (let i = 0; i < targetFeatures.length; i++) {
        const feature = targetFeatures[i];
        extractionStatus.set(req.tenantId, {
          current: i + 1,
          total: targetFeatures.length,
          stage: `Processing boundary unit ${i + 1} of ${targetFeatures.length}...`,
        });

        const props = feature.properties || {};
        const rawName =
          props.ADM4_EN ||
          props.ADM3_EN ||
          props.ADM2_EN ||
          props.ADM1_EN ||
          props.shapeName ||
          props.name ||
          props.NAME_4 ||
          props.NAME_3 ||
          props.NAME_2 ||
          props.NAME_1 ||
          props.ward ||
          props.SUBCOUNTY ||
          props.VILLAGE ||
          props.COMMUNITY ||
          `Community Cluster ${i + 1}`;
        const name = String(rawName).trim();

        const centroid = getCentroid(feature.geometry);
        if (!centroid) {
          skipped.push(`${name} (No valid polygon coordinates)`);
          continue;
        }

        const [lng, lat] = centroid;

        let districtId: number | null = null;
        const candidateDistrictNames = [
          props.ADM2_EN,
          props.ADM1_EN,
          props.district,
          props.DISTRICT,
          props.District,
          props.NAME_2,
          props.NAME_1,
          props.Province,
          props.PROVINCE,
        ].filter(Boolean);
        for (const cName of candidateDistrictNames) {
          const match = districtMap.get(String(cName).toLowerCase().trim());
          if (match) {
            districtId = match;
            break;
          }
        }
        if (!districtId && requestedDistrictId) {
          districtId = requestedDistrictId;
        }
        if (!districtId && scopedDistricts.length === 1) {
          districtId = scopedDistricts[0].id;
        }
        if (!districtId || !scopedDistrictIds.has(Number(districtId))) {
          skipped.push(`${name} (outside selected scope or district could not be resolved)`);
          continue;
        }

        let assignedFacilityId: number | null = null;
        let minDistance = Infinity;

        for (const fac of allFacilities) {
          if (fac.latitude && fac.longitude) {
            const dist = calculateHaversineDistance(
              lat,
              lng,
              parseFloat(fac.latitude.toString()),
              parseFloat(fac.longitude.toString()),
            );
            if (dist < minDistance) {
              minDistance = dist;
              assignedFacilityId = fac.id;
            }
          }
        }

        const distanceToFacility =
          minDistance !== Infinity ? minDistance.toFixed(2) : null;
        const isHardToReach = minDistance !== Infinity && minDistance > 10.0;

        const village = {
          tenantId: req.tenantId,
          name,
          districtId,
          assignedFacilityId,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
          boundary: feature.geometry,
          distanceToFacility,
          travelTimeMinutes: minDistance !== Infinity ? Math.round(minDistance * 12) : 60,
          transportMode: normalizeTransportMode(null, isHardToReach),
          seasonalAccessibility: isHardToReach ? "difficult" : "accessible",
          settlementType: isHardToReach ? "remote" : "rural",
          isHardToReach,
          notes: `Centroid extracted from administrative boundary layer: ${targetBoundary.levelName || "Admin"}`,
        };

        const villageKey = `${Number(districtId)}:${name.toLowerCase()}`;
        const existing = existingByDistrictAndName.get(villageKey);
        if (existing) {
          const updated = await storage.updateVillage(req.tenantId, existing.id, {
            latitude: village.latitude,
            longitude: village.longitude,
            boundary: village.boundary,
            assignedFacilityId: village.assignedFacilityId,
            distanceToFacility: village.distanceToFacility,
            travelTimeMinutes: village.travelTimeMinutes,
            transportMode: village.transportMode,
            seasonalAccessibility: village.seasonalAccessibility,
            settlementType: village.settlementType,
            isHardToReach: village.isHardToReach,
            notes: village.notes,
          } as any);
          if (updated) synchronized.push(updated);
          continue;
        }
        if (pendingKeys.has(villageKey)) {
          skipped.push(`${name} (duplicate map feature)`);
          continue;
        }

        created.push(village);
        pendingKeys.add(villageKey);
      }

      const inserted: any[] = [];
      for (let j = 0; j < created.length; j++) {
        extractionStatus.set(req.tenantId, {
          current: j + 1,
          total: created.length,
          stage: `Saving extracted community centroids (${j + 1}/${created.length})...`,
        });
        try {
          const vData = insertVillageSchema.parse(created[j]);
          const v = await storage.createVillage(req.tenantId, vData);
          inserted.push(v);
          try {
            await estimateAndSaveVillagePopulation(req.tenantId, v.id);
          } catch (popErr) {
            console.warn(`[ExtractVillages] Population estimation skipped for village ${v.id}:`, popErr);
          }
        } catch (itemErr) {
          console.warn(`[ExtractVillages] Failed to insert village "${created[j]?.name}":`, itemErr);
          skipped.push(`${created[j]?.name || 'Unknown'} (Validation/DB error)`);
        }
      }

      extractionStatus.delete(req.tenantId);

      await logAudit(req, "extract_villages", "villages", null, null, {
        totalExtracted: inserted.length,
        totalSynchronized: synchronized.length,
        skippedCount: skipped.length,
        boundaryLayer: targetBoundary.levelName || "Admin",
      });

      res.status(200).json({
        success: true,
        message: `Map extraction complete: ${inserted.length} created, ${synchronized.length} synchronized, ${skipped.length} skipped from ${targetBoundary.levelName || "Admin"}.`,
        createdCount: inserted.length,
        updatedCount: synchronized.length,
        skippedCount: skipped.length,
        created: inserted,
        updated: synchronized,
      });
    } catch (error: any) {
      extractionStatus.delete(req.tenantId);
      console.error("Error extracting villages from boundaries:", error);
      res.status(500).json({
        message: error?.message || "Failed to extract villages from boundaries",
        detail: error?.detail || undefined,
      });
    }
  });

  app.post(
    "/api/villages/import",
    isAuthenticated,
    requireTenant,
    loadRole,
    requireAdmin,
    async (req: any, res) => {
      try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
          return res
            .status(400)
            .json({ message: "Request body must contain an array of village objects in 'items'." });
        }

        const allDistricts = await storage.getDistricts(req.tenantId);
        const districtMap = new Map<string, number>();
        allDistricts.forEach((d) => districtMap.set(d.name.toLowerCase().trim(), d.id));

        const allFacilities = await storage.getFacilities(req.tenantId);
        const facilityMap = new Map<string, number>();
        allFacilities.forEach((f) => facilityMap.set(f.name.toLowerCase().trim(), f.id));

        const existingVillages = await storage.getVillages(req.tenantId);
        const existingByName = new Map<string, any>();
        existingVillages.forEach((v) => existingByName.set(v.name.toLowerCase().trim(), v));

        let createdCount = 0;
        let updatedCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < items.length; i++) {
          const raw = items[i];
          if (!raw.name) {
            errors.push(`Item ${i + 1}: Name is required`);
            continue;
          }

          let districtId: number | null = raw.districtId ? parseInt(raw.districtId) : null;
          if (!districtId && raw.districtName) {
            districtId = districtMap.get(String(raw.districtName).toLowerCase().trim()) || null;
          }

          let assignedFacilityId: number | null = raw.assignedFacilityId
            ? parseInt(raw.assignedFacilityId)
            : null;
          if (!assignedFacilityId && raw.facilityName) {
            assignedFacilityId =
              facilityMap.get(String(raw.facilityName).toLowerCase().trim()) || null;
          }

          if (assignedFacilityId && !districtId) {
            const fac = allFacilities.find((f) => f.id === assignedFacilityId);
            if (fac) districtId = fac.districtId;
          }

          if (!districtId && allDistricts.length > 0) {
            districtId = allDistricts[0].id;
          }

          let lat = raw.latitude ? parseFloat(raw.latitude) : null;
          let lng = raw.longitude ? parseFloat(raw.longitude) : null;

          if (raw.boundary && (!lat || !lng)) {
            let geom = raw.boundary;
            if (typeof geom === "string") {
              try {
                geom = JSON.parse(geom);
              } catch {
                geom = null;
              }
            }
            if (geom && geom.type === "Feature") geom = geom.geometry;
            const centroid = getCentroid(geom);
            if (centroid) {
              lng = centroid[0];
              lat = centroid[1];
            }
          }

          let distanceToFacility = raw.distanceToFacility || null;
          if (assignedFacilityId && lat && lng && !distanceToFacility) {
            const fac = allFacilities.find((f) => f.id === assignedFacilityId);
            if (fac && fac.latitude && fac.longitude) {
              const dist = calculateHaversineDistance(
                lat,
                lng,
                parseFloat(fac.latitude.toString()),
                parseFloat(fac.longitude.toString()),
              );
              distanceToFacility = dist.toFixed(2);
            }
          }

          const isHardToReach =
            raw.isHardToReach !== undefined
              ? Boolean(raw.isHardToReach)
              : distanceToFacility && parseFloat(distanceToFacility) > 10.0;

          const payload: any = {
            tenantId: req.tenantId,
            name: String(raw.name).trim(),
            districtId,
            assignedFacilityId,
            latitude: lat ? lat.toFixed(6) : null,
            longitude: lng ? lng.toFixed(6) : null,
            boundary: raw.boundary || null,
            distanceToFacility,
            travelTimeMinutes: raw.travelTimeMinutes
              ? parseInt(raw.travelTimeMinutes)
              : distanceToFacility
                ? Math.round(parseFloat(distanceToFacility) * 12)
                : null,
            transportMode: normalizeTransportMode(raw.transportMode, isHardToReach),
            seasonalAccessibility:
              raw.seasonalAccessibility || (isHardToReach ? "difficult" : "accessible"),
            settlementType: raw.settlementType || (isHardToReach ? "remote" : "rural"),
            isHardToReach,
            notes: raw.notes || "Bulk imported",
          };

          const key = payload.name.toLowerCase();
          const existing = existingByName.get(key);

          try {
            if (existing) {
              await storage.updateVillage(req.tenantId, existing.id, payload);
              if (payload.latitude && payload.longitude) {
                const outside = await isLocationOutsideTenantBoundary(
                  req.tenantId,
                  Number(payload.latitude),
                  Number(payload.longitude),
                );
                if (outside) outsideVillageIds.add(Number(existing.id));
                else outsideVillageIds.delete(Number(existing.id));
              }
              await estimateAndSaveVillagePopulation(req.tenantId, existing.id);
              updatedCount++;
            } else {
              const parsed = insertVillageSchema.parse(payload);
              const inserted = await storage.createVillage(req.tenantId, parsed);
              if (inserted.latitude && inserted.longitude) {
                const outside = await isLocationOutsideTenantBoundary(
                  req.tenantId,
                  Number(inserted.latitude),
                  Number(inserted.longitude),
                );
                if (outside) outsideVillageIds.add(Number(inserted.id));
                else outsideVillageIds.delete(Number(inserted.id));
              }
              await estimateAndSaveVillagePopulation(req.tenantId, inserted.id);
              existingByName.set(key, inserted);
              createdCount++;
            }
          } catch (itemErr: any) {
            errors.push(`Item ${i + 1} (${payload.name}): ${itemErr.message}`);
          }
        }

        await logAudit(req, "bulk_import", "villages", null, null, {
          createdCount,
          updatedCount,
          totalSubmitted: items.length,
          errorsCount: errors.length,
        });

        res.status(200).json({
          success: true,
          createdCount,
          updatedCount,
          errors,
        });
      } catch (error: any) {
        console.error("Error in bulk village import:", error);
        res.status(500).json({ message: "Failed to process bulk import: " + error.message });
      }
    },
  );

  app.patch("/api/villages/:id", ...auth, async (req: any, res) => {
    try {
      const entityId = parseInt(req.params.id);
      const oldVillage = await storage.getVillage(req.tenantId, entityId);
      if (!oldVillage) return res.status(404).json({ message: "Village not found" });

      const canEditExisting = await userCanAccessGeo(req.dbUser, req.tenantId, {
        facilityId: (oldVillage as any).assignedFacilityId ?? null,
        districtId: (oldVillage as any).districtId ?? null,
        isVillage: true,
      });
      if (!canEditExisting) return res.status(404).json({ message: "Village not found" });

      let derivedDistrictId: number | null = null;
      if (req.body?.assignedFacilityId !== undefined || req.body?.districtId !== undefined) {
        const destFacilityId =
          req.body?.assignedFacilityId !== undefined
            ? req.body.assignedFacilityId !== null && req.body.assignedFacilityId !== ""
              ? parseInt(req.body.assignedFacilityId)
              : null
            : ((oldVillage as any).assignedFacilityId ?? null);
        let destDistrictId =
          req.body?.districtId !== undefined && req.body.districtId !== null
            ? parseInt(req.body.districtId)
            : ((oldVillage as any).districtId ?? null);
        if (destFacilityId) {
          const destFacility = await storage.getFacility(req.tenantId, destFacilityId);
          if (destFacility) destDistrictId = destFacility.districtId;
        }
        derivedDistrictId = destDistrictId;
        const canWriteDest = await userCanAccessGeo(req.dbUser, req.tenantId, {
          facilityId: destFacilityId,
          districtId: destDistrictId,
          isVillage: true,
        });
        if (!canWriteDest) {
          return res.status(403).json({
            message: "Forbidden: no access to reassign this community to that facility/district",
          });
        }
      }

      const body = { ...req.body };
      if (derivedDistrictId !== null) {
        body.districtId = derivedDistrictId;
      }

      if (
        (body.latitude || body.longitude || body.assignedFacilityId) &&
        !body.distanceToFacility
      ) {
        const facilityId = body.assignedFacilityId
          ? parseInt(body.assignedFacilityId)
          : (oldVillage as any).assignedFacilityId;
        const lat = body.latitude || (oldVillage as any).latitude;
        const lng = body.longitude || (oldVillage as any).longitude;

        if (facilityId && lat && lng) {
          const facility = await storage.getFacility(req.tenantId, facilityId);
          if (facility && facility.latitude && facility.longitude) {
            const dist = calculateHaversineDistance(
              parseFloat(lat),
              parseFloat(lng),
              parseFloat(facility.latitude.toString()),
              parseFloat(facility.longitude.toString()),
            );
            body.distanceToFacility = dist.toFixed(2);
          }
        }
      }

      if (body.transportMode) {
        body.transportMode = normalizeTransportMode(body.transportMode, body.isHardToReach);
      }

      if (body.boundary && req.body?.ignoreOverlapWarning !== true) {
        const overlaps = await detectCommunityBoundaryOverlaps(
          req.tenantId,
          body.boundary,
          entityId,
        );
        if (overlaps.length > 0) {
          return res.status(409).json({
            code: "COMMUNITY_BOUNDARY_OVERLAP",
            message: `This boundary overlaps with ${overlaps.length} existing community area(s).`,
            overlaps,
          });
        }
      }

      const village = await storage.updateVillage(req.tenantId, entityId, body);
      if (!village) return res.status(404).json({ message: "Village not found" });

      if (village.latitude != null && village.longitude != null) {
        const outside = await isLocationOutsideTenantBoundary(
          req.tenantId,
          Number(village.latitude),
          Number(village.longitude),
        );
        if (outside) {
          outsideVillageIds.add(Number(village.id));
        } else {
          outsideVillageIds.delete(Number(village.id));
        }
      } else {
        outsideVillageIds.delete(Number(village.id));
      }

      if (body.boundary || body.latitude || body.longitude) {
        await estimateAndSaveVillagePopulation(req.tenantId, entityId);
      }

      const enrichedVillage = await storage.getVillage(req.tenantId, entityId);
      await logAudit(req, "update", "village", entityId, oldVillage, enrichedVillage);

      const overlapList = (enrichedVillage as any)?.boundary
        ? await detectCommunityBoundaryOverlaps(
            req.tenantId,
            (enrichedVillage as any).boundary,
            entityId,
          )
        : [];

      res.json({ ...(enrichedVillage || village), overlaps: overlapList });
    } catch (error) {
      console.error("Error updating village:", error);
      res.status(400).json({ message: "Invalid village data" });
    }
  });

  app.post("/api/villages/:id/harmonize", ...auth, async (req: any, res) => {
    try {
      const villageId = parseInt(req.params.id);
      const conflictingVillageId = parseInt(req.body?.conflictingVillageId);
      if (!villageId || !conflictingVillageId) {
        return res
          .status(400)
          .json({ message: "villageId and conflictingVillageId are required." });
      }

      const village = await storage.getVillage(req.tenantId, villageId);
      const other = await storage.getVillage(req.tenantId, conflictingVillageId);
      if (!village || !other) {
        return res.status(404).json({ message: "Community not found." });
      }

      const canRaise = await userCanAccessGeo(req.dbUser, req.tenantId, {
        facilityId: (village as any).assignedFacilityId ?? null,
        districtId: (village as any).districtId ?? null,
        isVillage: true,
      });
      if (!canRaise) return res.status(404).json({ message: "Community not found." });

      const ownFeat = toBoundaryFeature((village as any).boundary);
      const otherFeat = toBoundaryFeature((other as any).boundary);
      if (ownFeat && otherFeat) {
        let intersects = false;
        try {
          const inter = turfIntersect(turfFeatureCollection([ownFeat, otherFeat]));
          intersects = !!inter && turfArea(inter) > 0;
        } catch {
          intersects = false;
        }
        if (!intersects) {
          return res.status(400).json({
            message: "Cannot raise harmonization: boundaries do not overlap.",
          });
        }
      }

      const conflictingFacilityId =
        ((other as any).assignedFacilityId ?? null) as number | null;
      const overlapPct =
        req.body?.overlapPct !== undefined && req.body?.overlapPct !== null
          ? Number(req.body.overlapPct)
          : null;
      const conflict = await storage.createCatchmentConflict(req.tenantId, {
        villageId,
        conflictingVillageId,
        facilityId: (village as any).assignedFacilityId ?? null,
        conflictingFacilityId,
        status: "open",
        conflictType: "boundary_overlap",
        overlapPercentage: overlapPct !== null ? String(overlapPct) : null,
        overlapAreaKm2:
          req.body?.overlapAreaSqKm !== undefined && req.body?.overlapAreaSqKm !== null
            ? String(req.body.overlapAreaSqKm)
            : null,
        requestedById: req.dbUser?.id ?? null,
        note: typeof req.body?.note === "string" ? req.body.note.trim() || null : null,
      } as any);
      await logAudit(req, "create", "catchment_conflict", conflict.id, null, conflict);

      let notified = false;
      try {
        if (conflictingFacilityId) {
          const facility = await storage.getFacility(req.tenantId, conflictingFacilityId);
          const candidates = await storage.getUsersByTenantAndRoles(req.tenantId, [
            "facility_in_charge",
            "facility_clerk",
          ]);
          const recipients = candidates
            .filter((u: any) => Number(u.facilityId) === Number(conflictingFacilityId) && u.email)
            .sort((a: any, b: any) => (a.role === "facility_in_charge" ? -1 : 1));
          const to = recipients[0]?.email;
          if (to) {
            const requester = req.dbUser?.email || "A colleague";
            await sendEmail({
              to,
              subject: `Catchment harmonization requested for ${other.name}`,
              text:
                `${requester} drew a community boundary for "${village.name}" that overlaps "${other.name}"` +
                `${facility?.name ? ` (assigned to ${facility.name})` : ""}` +
                `${overlapPct ? `, with about ${overlapPct}% overlap` : ""}.\n\n` +
                `Please review the catchment boundaries together in VaxPlan and agree on who covers the overlapping area.` +
                `${conflict?.note ? `\n\nNote from the requester: ${conflict.note}` : ""}`,
              tenantId: req.tenantId,
            });
            notified = true;
          }
        }
      } catch (mailErr) {
        console.error("Harmonization email failed:", mailErr);
      }

      res.status(201).json({ ...conflict, notified });
    } catch (error) {
      console.error("Error recording harmonization request:", error);
      res.status(400).json({ message: "Failed to record harmonization request." });
    }
  });

  app.delete("/api/villages/:id", ...auth, async (req: any, res) => {
    try {
      const entityId = parseInt(req.params.id);
      const oldVillage = await storage.getVillage(req.tenantId, entityId);
      if (!oldVillage) return res.status(404).json({ message: "Village not found" });
      const canDelete = await userCanAccessGeo(req.dbUser, req.tenantId, {
        facilityId: (oldVillage as any).assignedFacilityId ?? null,
        districtId: (oldVillage as any).districtId ?? null,
      });
      if (!canDelete) {
        return res.status(403).json({ message: "Forbidden: no access to delete this village" });
      }
      const ok = await storage.deleteVillage(req.tenantId, entityId);
      if (!ok) return res.status(404).json({ message: "Village not found" });
      outsideVillageIds.delete(entityId);
      await logAudit(req, "delete", "village", entityId, oldVillage, null);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting village:", error);
      res.status(500).json({ message: "Failed to delete village" });
    }
  });

  // ─── Suggest Nearby Unmapped Communities ──────────────────────────────────
  app.get("/api/villages/suggest-unmapped", ...auth, async (req: any, res) => {
    try {
      const { latitude, longitude, facilityId } = req.query;
      if (!facilityId) {
        return res.status(400).json({ message: "facilityId query parameter is required" });
      }

      const parsedFacilityId = parseInt(facilityId as string, 10);
      if (Number.isNaN(parsedFacilityId)) {
        return res.json([]);
      }

      const facility = await storage.getFacility(req.tenantId, parsedFacilityId);
      const lat = latitude
        ? parseFloat(latitude as string)
        : facility?.latitude
          ? parseFloat(facility.latitude.toString())
          : null;
      const lng = longitude
        ? parseFloat(longitude as string)
        : facility?.longitude
          ? parseFloat(facility.longitude.toString())
          : null;

      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
        return res.json([]);
      }

      try {
        const resQuery = await pool.query(
          `
          SELECT s.id, s.name, s.population_estimate AS population, s.latitude::float AS latitude, s.longitude::float AS longitude,
                 s.dry_season_travel_time_minutes AS dry_season_travel_time,
                 s.rainy_season_travel_time_minutes AS rainy_season_travel_time,
                 s.travel_mode_planning AS travel_mode,
                 s.risk_level,
                 s.link_status,
                 (ST_Distance(
                   ST_SetSRID(ST_MakePoint(s.longitude::float, s.latitude::float), 4326)::geography,
                   ST_SetSRID(ST_MakePoint($3::float, $2::float), 4326)::geography
                 ) / 1000.0) AS distance_km
          FROM settlements_master s
          WHERE s.tenant_id = $1
            AND s.is_active = true
            AND s.latitude IS NOT NULL
            AND s.longitude IS NOT NULL
            AND s.linked_community_id IS NULL
            AND s.name NOT IN (SELECT name FROM villages WHERE tenant_id = $1)
            AND NOT EXISTS (
              SELECT 1 FROM facility_catchments fc
              WHERE fc.tenant_id = s.tenant_id
                AND fc.is_official = true
                AND fc.geojson IS NOT NULL
                AND fc.geojson::text != 'null'
                AND fc.geojson::text != ''
                AND ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(fc.geojson::text), 4326))
                AND ST_Contains(
                  ST_SetSRID(ST_GeomFromGeoJSON(fc.geojson::text), 4326),
                  ST_SetSRID(ST_MakePoint(s.longitude::float, s.latitude::float), 4326)
                )
            )
          ORDER BY distance_km ASC
          LIMIT 10;
          `,
          [req.tenantId, lat, lng],
        );

        return res.json(resQuery.rows);
      } catch (dbErr) {
        console.warn("Complex spatial query failed in suggest-unmapped, falling back to simple distance:", dbErr);
        const fallbackQuery = await pool.query(
          `
          SELECT s.id, s.name, s.population_estimate AS population, s.latitude::float AS latitude, s.longitude::float AS longitude,
                 s.dry_season_travel_time_minutes AS dry_season_travel_time,
                 s.rainy_season_travel_time_minutes AS rainy_season_travel_time,
                 s.travel_mode_planning AS travel_mode,
                 s.risk_level,
                 s.link_status,
                 (ST_Distance(
                   ST_SetSRID(ST_MakePoint(s.longitude::float, s.latitude::float), 4326)::geography,
                   ST_SetSRID(ST_MakePoint($3::float, $2::float), 4326)::geography
                 ) / 1000.0) AS distance_km
          FROM settlements_master s
          WHERE s.tenant_id = $1
            AND s.is_active = true
            AND s.latitude IS NOT NULL
            AND s.longitude IS NOT NULL
            AND s.linked_community_id IS NULL
            AND s.name NOT IN (SELECT name FROM villages WHERE tenant_id = $1)
          ORDER BY distance_km ASC
          LIMIT 10;
          `,
          [req.tenantId, lat, lng],
        );
        return res.json(fallbackQuery.rows);
      }
    } catch (error: any) {
      console.warn("Error suggesting unmapped communities (graceful empty return):", error);
      res.json([]);
    }
  });

  // GET /api/villages/:id/community-polygon — return stored polygon + pop estimate
  app.get("/api/villages/:id/community-polygon", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const villageId = parseInt(req.params.id, 10);
      if (isNaN(villageId)) return res.status(400).json({ message: "Invalid village id" });
      const [row] = await db
        .select({
          catchmentPolygon: villages.catchmentPolygon,
          boundary: villages.boundary,
          griddedPopulation: villages.griddedPopulation,
          polygonColor: villages.polygonColor,
          populationSourceLabel: villages.populationSourceLabel,
        })
        .from(villages)
        .where(and(eq(villages.id, villageId), eq(villages.tenantId, req.tenantId)))
        .limit(1);
      if (!row) return res.status(404).json({ message: "Village not found" });

      const [activeGeo] = await db
        .select()
        .from(gisPolygons)
        .where(
          and(
            eq(gisPolygons.tenantId, req.tenantId),
            eq(gisPolygons.ownerType, "village"),
            eq(gisPolygons.ownerId, villageId),
            eq(gisPolygons.status, "active"),
          ),
        )
        .limit(1);

      const [draftRow] = await db
        .select()
        .from(gisPolygons)
        .where(
          and(
            eq(gisPolygons.tenantId, req.tenantId),
            eq(gisPolygons.ownerType, "village"),
            eq(gisPolygons.ownerId, villageId),
            inArray(gisPolygons.status, ["draft", "submitted_for_review", "needs_correction"]),
          ),
        )
        .orderBy(desc(gisPolygons.version))
        .limit(1);

      res.json({
        // `boundary` is reference geography imported from administrative/GIS
        // sources. It can represent an entire municipality (for example,
        // eThekwini) and must never be presented as a community catchment.
        // Only an explicitly saved community polygon is valid here.
        catchmentPolygon: activeGeo?.geometry || row.catchmentPolygon || null,
        griddedPopulation: activeGeo?.populationEstimate || row.griddedPopulation || null,
        polygonColor: row.polygonColor || null,
        populationSourceLabel: activeGeo?.populationSource || row.populationSourceLabel || null,
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
        population: activeGeo
          ? {
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
              calculatedAt: activeGeo.updatedAt?.toISOString(),
            }
          : null,
      });
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Failed to load community polygon") });
    }
  });

  // PATCH /api/villages/:id/community-polygon — save/update community sub-polygon
  app.patch("/api/villages/:id/community-polygon", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const villageId = parseInt(req.params.id, 10);
      if (isNaN(villageId)) return res.status(400).json({ message: "Invalid village id" });

      const [village] = await db
        .select({
          facilityId: villages.assignedFacilityId,
          name: villages.name,
        })
        .from(villages)
        .where(and(eq(villages.id, villageId), eq(villages.tenantId, req.tenantId)))
        .limit(1);
      if (!village) return res.status(404).json({ message: "Village not found" });

      if (village.facilityId) {
        const locked = await isFacilityMicroplanLocked(req.tenantId, village.facilityId);
        if (locked) {
          return res.status(400).json({
            message:
              "Village's community area editing is locked because there is a submitted microplan for the parent facility.",
          });
        }
      }

      const dbUser = req.dbUser ?? (await storage.getUser(getCurrentUserId(req)));
      if (!dbUser) return res.status(403).json({ message: "Forbidden: User context not resolved" });
      req.dbUser = dbUser;
      if (
        village.facilityId &&
        !(await userCanAccessGeo(dbUser, req.tenantId, { facilityId: Number(village.facilityId) }))
      ) {
        return res
          .status(403)
          .json({ message: "Forbidden: no access to save this community polygon." });
      }

      const {
        geojson,
        griddedPopulation,
        polygonColor,
        populationSourceLabel,
        status = "active",
        overrideReason,
      } = req.body;

      if (status === "active") {
        const [currentActive] = await db
          .select({ id: gisPolygons.id })
          .from(gisPolygons)
          .where(
            and(
              eq(gisPolygons.tenantId, req.tenantId),
              eq(gisPolygons.ownerType, "village"),
              eq(gisPolygons.ownerId, villageId),
              eq(gisPolygons.isActive, true),
              eq(gisPolygons.status, "active"),
            ),
          )
          .limit(1);
        if (currentActive) {
          return res.status(409).json({
            code: "POLYGON_VERSION_REQUIRED",
            message:
              "This approved community boundary cannot be overwritten. Use the polygon edit or replace workflow to create a reviewable version.",
          });
        }
      }

      if (status === "clear_draft") {
        await db
          .update(gisPolygons)
          .set({ status: "archived", isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(gisPolygons.tenantId, req.tenantId),
              eq(gisPolygons.ownerType, "village"),
              eq(gisPolygons.ownerId, villageId),
              eq(gisPolygons.status, "draft"),
            ),
          );
        return res.json({ ok: true, cleared: true });
      }

      if (!geojson || typeof geojson !== "object") {
        return res.status(400).json({ message: "geojson polygon required" });
      }

      const {
        validatePolygonGeometry,
        polygonCentroid,
        polygonInsidePolygon,
        polygonsOverlap,
        canOverrideDenominator,
      } = await import("../services/microplanPrefillService");
      const { PopulationIntelligenceService } = await import(
        "../services/populationIntelligenceService"
      );

      const validation = validatePolygonGeometry(geojson);
      if (!validation.valid) {
        return res.status(400).json({
          message: "Invalid polygon geometry: " + validation.errors.join(", "),
        });
      }

      const areaSqKm = validation.areaSqKm;
      const centroid = polygonCentroid(geojson);

      // Parent facility catchment constraint check
      if (status === "active" && village.facilityId) {
        const [facility] = await db
          .select({
            catchmentPolygon: facilities.catchmentPolygon,
            name: facilities.name,
          })
          .from(facilities)
          .where(eq(facilities.id, village.facilityId))
          .limit(1);

        if (facility?.catchmentPolygon) {
          const isInside = polygonInsidePolygon(geojson, facility.catchmentPolygon);
          if (!isInside) {
            const canOverride = canOverrideDenominator(req.user);
            if (!canOverride) {
              return res.status(400).json({
                message: `This community is outside the catchment area of parent facility "${facility.name}". Only authorized coordinators or admins may override this restriction.`,
              });
            }
            if (!overrideReason || !overrideReason.trim()) {
              return res.status(400).json({
                code: "OUTSIDE_CATCHMENT_OVERRIDABLE",
                message: `This community is outside the catchment area of parent facility "${facility.name}". An override reason is required to proceed.`,
              });
            }
          }
        }
      }

      // Check community overlaps
      if (status === "active" && village.facilityId) {
        const otherVillages = await db
          .select({
            id: villages.id,
            name: villages.name,
            catchmentPolygon: villages.catchmentPolygon,
          })
          .from(villages)
          .where(
            and(
              eq(villages.assignedFacilityId, village.facilityId),
              ne(villages.id, villageId),
              eq(villages.tenantId, req.tenantId),
            ),
          );

        for (const other of otherVillages) {
          if (other.catchmentPolygon) {
            if (polygonsOverlap(geojson, other.catchmentPolygon)) {
              return res.status(400).json({
                message: `Overlap detected: this community polygon overlaps with "${other.name}". Please adjust the boundary.`,
              });
            }
          }
        }
      }

      const activeTenant = req.tenantId ? await storage.getTenant(req.tenantId) : undefined;
      const activeCountryCode = (
        activeTenant?.countryCode ||
        activeTenant?.code ||
        "ZMB"
      ).toUpperCase();
      const intel = await PopulationIntelligenceService.fetchPolygonPopulation(
        req.tenantId,
        geojson,
        activeCountryCode,
        "village",
        villageId,
      );
      const bestSource = intel?.sources?.[0];
      const popEst = bestSource?.totalPopulation ?? 0;
      const popSource = bestSource?.source ?? "WorldPop";
      const popSourceYear = bestSource?.year ?? new Date().getFullYear();
      const popMethod = bestSource?.method ?? "ST_Intersects";
      const confidence = bestSource?.confidence ?? "Low";

      const createdBy = (req.user as any)?.username || "system";
      const polyData = {
        tenantId: req.tenantId,
        ownerType: "village",
        ownerId: villageId,
        parentFacilityId: village.facilityId || null,
        polygonType: "catchment" as
          | "custom"
          | "catchment"
          | "outreach_area"
          | "administrative_boundary",
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
        overrideReason: overrideReason || null,
        createdBy: createdBy,
        updatedAt: new Date(),
      };

      let updatedCatchment = null;
      let updatedPop = null;

      if (status === "active") {
        const [updated] = await db
          .update(villages)
          .set({
            catchmentPolygon: geojson as any,
            boundary: geojson as any,
            griddedPopulation: popEst,
            polygonColor: polygonColor || null,
            populationSourceLabel: popSource || null,
            updatedAt: new Date(),
          })
          .where(and(eq(villages.id, villageId), eq(villages.tenantId, req.tenantId)))
          .returning();
        if (!updated) return res.status(404).json({ message: "Village not found" });
        await logAudit(req, "update_community_polygon", "village", villageId, null, {
          villageId,
          griddedPopulation: popEst,
        });
        updatedCatchment = updated.catchmentPolygon;
        updatedPop = updated.griddedPopulation;
      }

      const existing = await db
        .select({ id: gisPolygons.id })
        .from(gisPolygons)
        .where(
          and(
            eq(gisPolygons.tenantId, req.tenantId),
            eq(gisPolygons.ownerType, "village"),
            eq(gisPolygons.ownerId, villageId),
            eq(gisPolygons.status, status),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await db.update(gisPolygons).set(polyData).where(eq(gisPolygons.id, existing[0].id));
      } else {
        await db.insert(gisPolygons).values(polyData as any);
      }

      if (status === "active") {
        await db
          .update(gisPolygons)
          .set({ status: "archived", isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(gisPolygons.tenantId, req.tenantId),
              eq(gisPolygons.ownerType, "village"),
              eq(gisPolygons.ownerId, villageId),
              eq(gisPolygons.status, "draft"),
            ),
          );
      }

      res.json({
        ok: true,
        catchmentPolygon: updatedCatchment || geojson,
        griddedPopulation: updatedPop || popEst,
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
          calculatedAt: new Date().toISOString(),
        },
        validationStatus: "valid",
        approvalStatus: status === "active" ? "approved" : "draft",
        status,
      });
    } catch (err: any) {
      res.status(500).json({ message: safeErrorMessage(err, "Failed to save community polygon") });
    }
  });

  // DELETE /api/villages/:id/community-polygon — delete community polygon (National Admin & Managers)
  app.delete("/api/villages/:id/community-polygon", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const villageId = parseInt(req.params.id, 10);
      if (isNaN(villageId)) return res.status(400).json({ message: "Invalid village id" });

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
      const isAllowed =
        allowedRoles.includes(userRole) || userRoles.some((r) => allowedRoles.includes(r));

      if (!isAllowed) {
        return res.status(403).json({
          message: "Forbidden: Only National Admins and Managers can delete community polygons.",
        });
      }

      const [village] = await db
        .select()
        .from(villages)
        .where(and(eq(villages.id, villageId), eq(villages.tenantId, req.tenantId)))
        .limit(1);
      if (!village) return res.status(404).json({ message: "Village not found" });

      await db
        .update(gisPolygons)
        .set({ status: "archived", isActive: false, validTo: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(gisPolygons.tenantId, req.tenantId),
            eq(gisPolygons.ownerType, "village"),
            eq(gisPolygons.ownerId, villageId),
          ),
        );

      await db
        .update(villages)
        .set({
          catchmentPolygon: null,
          boundary: null,
          griddedPopulation: null,
          polygonColor: null,
          updatedAt: new Date(),
        })
        .where(and(eq(villages.id, villageId), eq(villages.tenantId, req.tenantId)));

      await logAudit(req, "delete_community_polygon", "village", villageId, village, null);

      res.json({ success: true, message: "Community polygon deleted successfully." });
    } catch (err: any) {
      console.error("DELETE /api/villages/:id/community-polygon error:", err);
      res.status(500).json({ message: safeErrorMessage(err, "Failed to delete community polygon") });
    }
  });

  // ============================================================================
  // NATIONAL SETTLEMENT MASTER REGISTRY & DETECTION ENGINE ENDPOINTS
  // ============================================================================

  // 1. Active Master Settlement Registry - GET /api/settlements
  app.get("/api/settlements", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const scope = await getGeoScope(req.dbUser, req.tenantId);
      const { province, district, ward, hardToReach, status } = req.query;

      const queryConditions: any[] = [eq(settlementsMaster.tenantId, req.tenantId)];

      if (!scope.all) {
        let allowedDistrictNames: string[] = [];

        if (scope.districtIds.size > 0 || scope.provinceIds.size > 0) {
          const allDistricts = await storage.getDistricts(req.tenantId);
          allowedDistrictNames = allDistricts
            .filter(
              (d) =>
                scope.districtIds.has(d.id) ||
                (scope.provinceIds.size > 0 && scope.provinceIds.has(d.provinceId as number)),
            )
            .map((d) => d.name);
        } else if (scope.facilityIds.size > 0) {
          const facilityIdArr = Array.from(scope.facilityIds);
          const facilityRows = await db
            .select({ districtId: facilities.districtId })
            .from(facilities)
            .where(inArray(facilities.id, facilityIdArr));
          const districtIdSet = new Set(
            facilityRows.map((f) => f.districtId).filter(Boolean) as number[],
          );
          if (districtIdSet.size > 0) {
            const allDistricts = await storage.getDistricts(req.tenantId);
            allowedDistrictNames = allDistricts
              .filter((d) => districtIdSet.has(d.id))
              .map((d) => d.name);
          }
        }

        if (allowedDistrictNames.length === 0) return res.json([]);
        queryConditions.push(inArray(settlementsMaster.districtName, allowedDistrictNames));
      }

      if (province) queryConditions.push(eq(settlementsMaster.provinceName, province as string));
      if (district) queryConditions.push(eq(settlementsMaster.districtName, district as string));
      if (ward) queryConditions.push(eq(settlementsMaster.wardName, ward as string));
      if (hardToReach) queryConditions.push(eq(settlementsMaster.hardToReach, hardToReach === "true"));
      if (status) queryConditions.push(eq(settlementsMaster.validationStatus, status as string));

      const settlementsList = await db
        .select()
        .from(settlementsMaster)
        .where(and(...queryConditions))
        .orderBy(desc(settlementsMaster.populationEstimate));

      res.json(settlementsList);
    } catch (err: any) {
      console.error("GET /api/settlements failed:", err);
      res.status(500).json({ message: "Failed to fetch master settlements" });
    }
  });

  // 2. Fetch specific settlement - GET /api/settlements/:id
  app.get("/api/settlements/:id", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID parameter" });

      const settlement = await db
        .select()
        .from(settlementsMaster)
        .where(and(eq(settlementsMaster.id, id), eq(settlementsMaster.tenantId, req.tenantId)))
        .limit(1);

      if (settlement.length === 0) {
        return res.status(404).json({ message: "Settlement not found" });
      }

      res.json(settlement[0]);
    } catch (err: any) {
      console.error("GET /api/settlements/:id failed:", err);
      res.status(500).json({ message: "Failed to fetch settlement details" });
    }
  });

  // 3. Fetch candidate unmapped settlements - GET /api/unmapped-settlements
  app.get("/api/unmapped-settlements", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const { status } = req.query;
      const validationStatus = (status as string) || "pending";

      const candidates = await db
        .select()
        .from(candidateUnmappedSettlements)
        .where(
          and(
            eq(candidateUnmappedSettlements.tenantId, req.tenantId),
            eq(candidateUnmappedSettlements.validationStatus, validationStatus),
          ),
        )
        .orderBy(desc(candidateUnmappedSettlements.estimatedPopulation));

      res.json(candidates);
    } catch (err: any) {
      console.error("GET /api/unmapped-settlements failed:", err);
      res.status(500).json({ message: "Failed to fetch candidate settlements" });
    }
  });

  // 4. One-Click Validation - POST /api/unmapped-settlements/:id/validate
  app.post("/api/unmapped-settlements/:id/validate", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID parameter" });

      const { name, placeType } = req.body;
      if (!name) return res.status(400).json({ message: "Ground-truthed settlement name is required" });

      const candidateList = await db
        .select()
        .from(candidateUnmappedSettlements)
        .where(
          and(
            eq(candidateUnmappedSettlements.id, id),
            eq(candidateUnmappedSettlements.tenantId, req.tenantId),
          ),
        )
        .limit(1);

      if (candidateList.length === 0) {
        return res.status(404).json({ message: "Candidate settlement not found" });
      }

      const candidate = candidateList[0];

      await db
        .update(candidateUnmappedSettlements)
        .set({ validationStatus: "validated", updatedAt: new Date() })
        .where(eq(candidateUnmappedSettlements.id, id));

      const admin = await assignAdminBoundaries(
        req.tenantId,
        parseFloat(candidate.longitude),
        parseFloat(candidate.latitude),
      );

      const facility = await getNearestHealthFacility(
        req.tenantId,
        parseFloat(candidate.longitude),
        parseFloat(candidate.latitude),
      );

      const htr = calculateHTRIndex(facility.distanceKm);

      const [newSettlement] = await db
        .insert(settlementsMaster)
        .values({
          tenantId: req.tenantId,
          name,
          placeType: placeType || "village",
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          geojson: {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [parseFloat(candidate.longitude), parseFloat(candidate.latitude)],
            },
            properties: {
              name,
              place_type: placeType || "village",
              population_estimate: candidate.estimatedPopulation,
              building_count: candidate.buildingCount,
            },
          },
          provinceName: admin.provinceName,
          districtName: admin.districtName,
          constituencyName: admin.constituencyName,
          wardName: admin.wardName,
          healthCatchment: facility.facilityName || "Unassigned Catchment",
          populationEstimate: candidate.estimatedPopulation,
          under5Population: Math.round(candidate.estimatedPopulation * 0.18),
          buildingCount: candidate.buildingCount,
          source: "manual_input",
          sourceConfidence: "0.99",
          nearestHealthFacility: facility.facilityName,
          distanceToFacilityKm: facility.distanceKm.toString(),
          estimatedTravelTime: facility.estimatedTravelTime,
          accessibilityScore: htr.accessibilityScore.toString(),
          hardToReach: htr.hardToReach,
          validationStatus: "approved",
        })
        .returning();

      const actingUserId = req.user?.claims?.sub || null;
      const actingUser = actingUserId ? await storage.getUser(actingUserId) : null;
      await logAudit(req, "validate_settlement", "settlements_master", newSettlement.id, null, {
        candidateId: id,
        name,
        admin,
        facility,
        actingUserHomeTenantId: actingUser?.tenantId || null,
        viewedTenantId: req.tenantId,
        crossTenant: !!(actingUser?.tenantId && actingUser.tenantId !== req.tenantId),
      });

      res.json({
        success: true,
        message: `Settlement "${name}" successfully validated and promoted to Master Registry.`,
        settlement: newSettlement,
      });
    } catch (err: any) {
      console.error("POST /api/unmapped-settlements/:id/validate failed:", err);
      res.status(500).json({ message: "Failed to validate candidate settlement" });
    }
  });

  // 5. Explicitly triggers the missing settlement spatial detection algorithm on-demand
  app.post("/api/unmapped-settlements/run-engine", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const { populationThreshold, buildingThreshold, radiusKm } = req.body;

      const result = await runMissingSettlementDetection(req.tenantId, {
        populationThreshold: populationThreshold ? parseInt(populationThreshold, 10) : undefined,
        buildingThreshold: buildingThreshold ? parseInt(buildingThreshold, 10) : undefined,
        radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
      });

      const actingUserId = req.user?.claims?.sub || null;
      const actingUser = actingUserId ? await storage.getUser(actingUserId) : null;
      await logAudit(req, "run_detection_engine", "candidate_unmapped_settlements", null, null, {
        parameters: req.body,
        detectedCount: result.candidatesDetected,
        actingUserHomeTenantId: actingUser?.tenantId || null,
        viewedTenantId: req.tenantId,
        crossTenant: !!(actingUser?.tenantId && actingUser.tenantId !== req.tenantId),
      });

      res.json(result);
    } catch (err: any) {
      console.error("POST /api/unmapped-settlements/run-engine failed:", err);
      res.status(500).json({ message: "Failed to execute missing settlement detection" });
    }
  });

  // 6. Zero-Dose service gap polygons - GET /api/coverage-gaps
  app.get("/api/coverage-gaps", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const client = pool;
      const query = `
        SELECT
          g.id,
          g.population_total,
          g.under5_population,
          g.geojson,
          ST_Distance(
            g.geometry::geography,
            (
              SELECT ST_Union(ST_SetSRID(ST_MakePoint(f.longitude::float, f.latitude::float), 4326)::geography)
              FROM facilities f
              WHERE f.tenant_id = $1 AND f.latitude IS NOT NULL AND f.longitude IS NOT NULL AND f.is_active = true
            )
          ) as distance_to_nearest_facility
        FROM population_grids g
        WHERE g.tenant_id = $1
        ORDER BY g.population_total DESC
      `;
      const resGrids = await client.query(query, [req.tenantId]);

      const gapGrids = resGrids.rows
        .filter((row: any) => parseFloat(row.distance_to_nearest_facility) >= 5000)
        .map((row: any) => ({
          id: row.id,
          population: parseInt(row.population_total),
          distanceKm: parseFloat((parseFloat(row.distance_to_nearest_facility) / 1000).toFixed(2)),
          geojson: row.geojson,
        }));

      res.json({
        success: true,
        count: gapGrids.length,
        features: gapGrids,
      });
    } catch (err: any) {
      console.error("GET /api/coverage-gaps failed:", err);
      res.status(500).json({ message: "Failed to calculate coverage gaps" });
    }
  });

  // 7. GET /api/outreach-recommendations
  app.get("/api/outreach-recommendations", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const candidates = await db
        .select()
        .from(candidateUnmappedSettlements)
        .where(
          and(
            eq(candidateUnmappedSettlements.tenantId, req.tenantId),
            eq(candidateUnmappedSettlements.validationStatus, "pending"),
          ),
        );

      const recommendations = candidates
        .filter((c) => parseFloat(c.distanceToFacility || "0") >= 5.0)
        .map((c) => ({
          id: c.id,
          name: `Proposed outreach at grid cluster (${parseFloat(c.longitude).toFixed(4)}, ${parseFloat(c.latitude).toFixed(4)})`,
          estimatedPopulation: c.estimatedPopulation,
          buildingCount: c.buildingCount,
          nearestFacility: c.nearestFacility,
          distanceToFacilityKm: parseFloat(c.distanceToFacility || "0"),
          latitude: parseFloat(c.latitude),
          longitude: parseFloat(c.longitude),
        }))
        .sort((a, b) => b.estimatedPopulation - a.estimatedPopulation)
        .slice(0, 15);

      res.json(recommendations);
    } catch (err: any) {
      console.error("GET /api/outreach-recommendations failed:", err);
      res.status(500).json({ message: "Failed to generate outreach recommendations" });
    }
  });

  // 7b. GET /api/unserved-clusters
  app.get("/api/unserved-clusters", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const rawLimit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : null;
      const limit =
        rawLimit != null && Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : null;

      const candidates = await db
        .select()
        .from(candidateUnmappedSettlements)
        .where(
          and(
            eq(candidateUnmappedSettlements.tenantId, req.tenantId),
            eq(candidateUnmappedSettlements.validationStatus, "pending"),
          ),
        )
        .orderBy(desc(candidateUnmappedSettlements.estimatedPopulation));

      let outreachSites: { lat: number; lng: number }[] = [];
      try {
        const allPlans = await storage.getSessionPlans(req.tenantId);
        const outreach = (allPlans as any[]).filter(
          (s) =>
            s.sessionType === "outreach" &&
            s.status !== "cancelled" &&
            s.status !== "completed",
        );
        if (outreach.length > 0) {
          const facList = await storage.getFacilities(req.tenantId);
          const facMap = new Map<number, any>(facList.map((f: any) => [f.id, f]));
          const vilList = await storage.getVillages(req.tenantId);
          const vilMap = new Map<number, any>(vilList.map((v: any) => [v.id, v]));
          const svRows = await db
            .select()
            .from(sessionVillages)
            .where(eq(sessionVillages.tenantId, String(req.tenantId)));
          const svByPlan = new Map<number, number[]>();
          for (const r of svRows as any[]) {
            const arr = svByPlan.get(r.sessionId) ?? [];
            arr.push(r.villageId);
            svByPlan.set(r.sessionId, arr);
          }
          for (const s of outreach) {
            const loc = await resolveSessionLocation(req.tenantId, s, vilMap, facMap, svByPlan);
            if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
              outreachSites.push(loc);
            }
          }
        }
      } catch (e: any) {
        console.error("[unserved-clusters] outreach site resolution failed:", e?.message);
        outreachSites = [];
      }

      const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const R = 6371;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      const ranked = candidates.map((c) => {
        const lat = parseFloat(c.latitude);
        const lng = parseFloat(c.longitude);
        const distanceToFacilityKm =
          c.distanceToFacility != null && Number.isFinite(parseFloat(c.distanceToFacility))
            ? parseFloat(c.distanceToFacility)
            : null;

        let outreachGapKm: number | null = null;
        if (outreachSites.length > 0) {
          let best = Infinity;
          for (const site of outreachSites) {
            const km = haversineKm(lat, lng, site.lat, site.lng);
            if (km < best) best = km;
          }
          outreachGapKm = Number.isFinite(best) ? parseFloat(best.toFixed(2)) : null;
        }

        const estimatedTravelTimeMin =
          distanceToFacilityKm != null ? Math.round(distanceToFacilityKm * 15) : null;

        const result = computeOutreachSuitability({
          estimatedPopulation: c.estimatedPopulation,
          distanceToFacilityKm,
          outreachGapKm,
          travelTimeMin: estimatedTravelTimeMin,
          travelTimeEstimated: true,
          landmarkCount: null,
          landmarkKnown: false,
        });

        return {
          id: c.id,
          latitude: lat,
          longitude: lng,
          estimatedPopulation: c.estimatedPopulation,
          buildingCount: c.buildingCount,
          nearestNamedSettlement: c.nearestNamedSettlement,
          nearestFacility: c.nearestFacility,
          distanceToFacilityKm,
          outreachGapKm,
          estimatedTravelTimeMin,
          estimatedUnder5: estimateUnder5(c.estimatedPopulation),
          estimatedZeroDoseChildren: estimateZeroDoseChildren(
            c.estimatedPopulation,
            distanceToFacilityKm,
          ),
          suitabilityScore: result.score,
          factors: result.factors,
        };
      });

      ranked.sort(
        (a, b) =>
          b.suitabilityScore - a.suitabilityScore ||
          b.estimatedZeroDoseChildren - a.estimatedZeroDoseChildren,
      );

      res.json({
        count: ranked.length,
        outreachSitesKnown: outreachSites.length > 0,
        clusters: limit != null ? ranked.slice(0, limit) : ranked,
      });
    } catch (err: any) {
      console.error("GET /api/unserved-clusters failed:", err);
      res.json({ count: 0, outreachSitesKnown: false, clusters: [] });
    }
  });
}
