import { Router } from "express";
import { pool } from "../db";
import { safeErrorMessage } from "../errorUtils";

export const gisRouter = Router();

function setCacheHeaders(res: any, seconds: number) {
  res.setHeader("Cache-Control", `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`);
}

// GET /api/gis/location-intelligence
gisRouter.get("/location-intelligence", async (req: any, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat(req.query.radiusKm as string) || 5;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ message: "Valid lat and lng required." });
    }

    const tenantId = req.tenantId;
    const radiusMeters = radiusKm * 1000;

    // 1. Nearby Facilities
    const facQuery = `
      SELECT
        id, name, facility_type AS "facilityType", operational_status AS status, latitude, longitude,
        ST_Distance(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography
        ) as distance_meters
      FROM facilities
      WHERE tenant_id = $3
        AND latitude IS NOT NULL AND longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography,
          $4
        )
      ORDER BY distance_meters ASC
      LIMIT 10
    `;

    // 2. Nearby Communities/Villages
    const commQuery = `
      SELECT
        id, name, total_catchment_population AS population, assigned_facility_id, is_hard_to_reach, latitude, longitude,
        ST_Distance(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography
        ) as distance_meters
      FROM villages
      WHERE tenant_id = $3
        AND latitude IS NOT NULL AND longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography,
          $4
        )
      ORDER BY distance_meters ASC
      LIMIT 20
    `;

    // 3. Resolve Admin Boundaries for this point
    const adminQuery = `
      SELECT
        b.admin_level,
        COALESCE(
          feat->'properties'->>'shapeName',
          feat->'properties'->>'name',
          feat->'properties'->>'NAME'
        ) AS name
      FROM admin_boundaries b,
           LATERAL jsonb_array_elements(b.geojson->'features') AS feat
      WHERE b.tenant_id = $1
        AND ST_Contains(
          ST_SetSRID(ST_GeomFromGeoJSON(feat->>'geometry'), 4326),
          ST_SetSRID(ST_MakePoint($2, $3), 4326)
        )
    `;

    const [facilitiesRes, communitiesRes, adminRes] = await Promise.all([
      pool.query(facQuery, [lng, lat, tenantId, radiusMeters]),
      pool.query(commQuery, [lng, lat, tenantId, radiusMeters]),
      pool.query(adminQuery, [tenantId, lng, lat]),
    ]);

    const adminHierarchy: Record<number, string> = {};
    adminRes.rows.forEach(r => {
      adminHierarchy[r.admin_level] = r.name;
    });

    let totalPop = 0;
    let totalU5 = 0;
    let zeroDose = 0;

    const communities = communitiesRes.rows.map(c => {
      const pop = Number(c.population) || 0;
      const u5 = Math.round(pop * 0.17);
      const zd = Math.round(u5 * 0.05);
      totalPop += pop;
      totalU5 += u5;
      zeroDose += zd;
      return {
        ...c,
        under5: u5,
        zeroDose: zd,
        distance_km: (c.distance_meters / 1000).toFixed(2),
      };
    });

    const facilitiesList = facilitiesRes.rows.map(f => ({
      ...f,
      distance_km: (f.distance_meters / 1000).toFixed(2),
    }));

    setCacheHeaders(res, 60);
    res.json({
      success: true,
      data: {
        point: { lat, lng },
        radiusKm,
        adminHierarchy,
        aggregated: {
          totalPopulation: totalPop,
          under5: totalU5,
          zeroDoseEstimates: zeroDose,
        },
        facilities: facilitiesList,
        communities,
      },
    });
  } catch (err: any) {
    console.error("[GIS Intelligence API]", err);
    res.status(500).json({ message: safeErrorMessage(err, "Failed to load GIS intelligence data") });
  }
});

export default gisRouter;
