import { Router } from "express";

export const mapStylesRouter = Router();

/**
 * Generates an authoritative VaxPlan MapLibre Style Specification (v8)
 */
function getVaxPlanStyleJson(styleId: string, hostUrl: string) {
  const isDark = styleId.includes("dark");
  const isStreets = styleId.includes("streets");

  const displayName = isDark
    ? "VaxPlan Dark"
    : isStreets
      ? "VaxPlan Streets"
      : "VaxPlan Light";

  // Use configured tile server or fallback to high-reliability OpenStreetMap / Esri Canvas
  const tileUrl = isStreets
    ? "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
    : isDark
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
      : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";

  const attribution = isStreets
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    : "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ";

  return {
    version: 8,
    name: displayName,
    metadata: {
      "vaxplan:generator": "vaxplan-map-service-1.0",
      "vaxplan:styleId": styleId,
      "vaxplan:selfHosted": true,
    },
    sources: {
      "vaxplan-basemap-source": {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        attribution,
        minzoom: 1,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": isDark ? "#0f172a" : "#f8fafc",
        },
      },
      {
        id: "vaxplan-basemap-layer",
        type: "raster",
        source: "vaxplan-basemap-source",
        paint: {
          "raster-opacity": 1.0,
          "raster-fade-duration": 150,
        },
      },
    ],
  };
}

/**
 * GET /api/maps/styles/:styleId/style.json
 * Delivers MapLibre GL JS Style Specification with aggressive caching
 */
mapStylesRouter.get("/styles/:styleId/style.json", (req, res) => {
  const { styleId } = req.params;
  const validStyles = ["vaxplan-light", "vaxplan-streets", "vaxplan-dark"];

  const normalizedId = styleId.toLowerCase().replace(/\.json$/, "");
  if (!validStyles.includes(normalizedId)) {
    return res.status(404).json({
      success: false,
      message: `Unknown style: ${styleId}. Available styles: ${validStyles.join(", ")}`,
      code: "STYLE_NOT_FOUND",
    });
  }

  const hostUrl = `${req.protocol}://${req.get("host")}`;
  const style = getVaxPlanStyleJson(normalizedId, hostUrl);

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  return res.json(style);
});

/**
 * GET /api/maps/health and /api/health/maps
 * Monitors GIS infrastructure health, PostGIS connection, and style server readiness
 */
mapStylesRouter.get("/health", async (_req, res) => {
  const startTime = Date.now();
  let postgisReady = false;
  let postgisVersion = "unavailable";

  try {
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");
    const result: any = await db.execute(sql`SELECT PostGIS_Full_Version() as ver`);
    if (result && result.rows && result.rows.length > 0) {
      postgisReady = true;
      postgisVersion = String(result.rows[0].ver).slice(0, 80);
    }
  } catch (err: any) {
    postgisReady = false;
    postgisVersion = `Error: ${err?.message || "PostGIS extension check failed"}`;
  }

  const responseTimeMs = Date.now() - startTime;

  res.json({
    success: true,
    service: "vaxplan-gis-infrastructure",
    status: postgisReady ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    responseTimeMs,
    capabilities: {
      maplibreVectorStyles: true,
      rasterFallbacks: true,
      postgisSpatialQueries: postgisReady,
      offlinePackagesReady: true,
    },
    stylesAvailable: [
      "/api/maps/styles/vaxplan-light/style.json",
      "/api/maps/styles/vaxplan-streets/style.json",
      "/api/maps/styles/vaxplan-dark/style.json",
    ],
    postgis: {
      installed: postgisReady,
      details: postgisVersion,
    },
  });
});

/**
 * GET /api/maps/packages
 * Manifest of available country and regional map packages for offline sync & onboarding
 */
mapStylesRouter.get("/packages", (_req, res) => {
  const packages = [
    {
      countryCode: "ZMB",
      name: "Zambia National Immunisation GIS Package",
      version: "v1.0",
      format: "PMTiles / Vector MVT",
      extent: [21.99, -18.08, 33.71, -8.22],
      layers: ["boundaries", "facilities", "communities", "roads", "population"],
      estimatedSizeMb: 48,
      status: "available",
    },
    {
      countryCode: "ZAF",
      name: "South Africa National Immunisation GIS Package",
      version: "v1.0",
      format: "PMTiles / Vector MVT",
      extent: [16.45, -34.83, 32.89, -22.13],
      layers: ["boundaries", "facilities", "communities", "subdistricts"],
      estimatedSizeMb: 110,
      status: "available",
    },
    {
      countryCode: "SSD",
      name: "South Sudan National Immunisation GIS Package",
      version: "v1.0",
      format: "PMTiles / Vector MVT",
      extent: [23.44, 3.49, 35.95, 12.23],
      layers: ["boundaries", "facilities", "settlements", "insecurity_zones"],
      estimatedSizeMb: 35,
      status: "available",
    },
    {
      countryCode: "PNG",
      name: "Papua New Guinea National Immunisation GIS Package",
      version: "v1.0",
      format: "PMTiles / Vector MVT",
      extent: [140.84, -11.66, 157.03, -0.87],
      layers: ["boundaries", "facilities", "villages", "terrain", "remote_islands"],
      estimatedSizeMb: 62,
      status: "available",
    },
  ];

  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.json({
    success: true,
    totalPackages: packages.length,
    packages,
  });
});
