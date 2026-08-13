import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, pool } from "../db";
import { gisPolygons } from "@shared/schema";
import { PopulationIntelligenceService } from "../services/populationIntelligenceService";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

export const gisPolygonsRouter = Router();
gisPolygonsRouter.use(isAuthenticated);

// GET /api/gis/polygons?ownerType=...&ownerId=...
gisPolygonsRouter.get("/", async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    const { ownerType, ownerId } = req.query;
    
    let query = db.select().from(gisPolygons).where(eq(gisPolygons.tenantId, tenantId));
    
    if (ownerType && ownerId) {
      query = db.select().from(gisPolygons).where(
        and(
          eq(gisPolygons.tenantId, tenantId),
          eq(gisPolygons.ownerType, String(ownerType)),
          eq(gisPolygons.ownerId, parseInt(String(ownerId), 10))
        )
      );
    }
    
    const results = await query;
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch polygons", error: err.message });
  }
});

// POST /api/gis/polygons
gisPolygonsRouter.post("/", async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    const data = req.body;
    if (data?.status === "active" || data?.isActive === true || data?.approvalStatus === "approved") {
      return res.status(409).json({
        code: "POLYGON_LIFECYCLE_REQUIRED",
        message: "Approved polygons must be created through the polygon lifecycle workflow.",
      });
    }
    
    const [inserted] = await db.insert(gisPolygons).values({
      ...data,
      tenantId
    }).returning();
    
    res.json(inserted);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to create polygon", error: err.message });
  }
});

// PUT /api/gis/polygons/:id
gisPolygonsRouter.put("/:id", async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    const id = parseInt(req.params.id, 10);
    const data = req.body;
    const [current] = await db
      .select({ id: gisPolygons.id, status: gisPolygons.status, isActive: gisPolygons.isActive })
      .from(gisPolygons)
      .where(and(eq(gisPolygons.id, id), eq(gisPolygons.tenantId, tenantId)))
      .limit(1);
    if (current && (current.status === "active" || current.isActive || data?.status === "active" || data?.isActive === true)) {
      return res.status(409).json({
        code: "POLYGON_LIFECYCLE_REQUIRED",
        message: "Approved polygons must be changed through the polygon lifecycle workflow.",
      });
    }
    
    const [updated] = await db.update(gisPolygons)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(gisPolygons.id, id), eq(gisPolygons.tenantId, tenantId)))
      .returning();
      
    if (!updated) return res.status(404).json({ message: "Polygon not found" });
    
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to update polygon", error: err.message });
  }
});

// DELETE /api/gis/polygons/:id
gisPolygonsRouter.delete("/:id", async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    const id = parseInt(req.params.id, 10);
    const [current] = await db
      .select({ id: gisPolygons.id, status: gisPolygons.status, isActive: gisPolygons.isActive })
      .from(gisPolygons)
      .where(and(eq(gisPolygons.id, id), eq(gisPolygons.tenantId, tenantId)))
      .limit(1);
    if (current && (current.status === "active" || current.isActive)) {
      return res.status(409).json({
        code: "POLYGON_LIFECYCLE_REQUIRED",
        message: "Approved polygons must be archived or replaced through the polygon lifecycle workflow.",
      });
    }
    
    await db.delete(gisPolygons)
      .where(and(eq(gisPolygons.id, id), eq(gisPolygons.tenantId, tenantId)));
      
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to delete polygon", error: err.message });
  }
});

// POST /api/gis/polygons/buffer
// Expects: { lat, lng, radiusKm }
// Returns: GeoJSON geometry of the buffer
gisPolygonsRouter.post("/buffer", async (req, res) => {
  try {
    const { lat, lng, radiusKm } = req.body;
    
    // PostGIS ST_Buffer on geography creates a buffer in meters
    const result = await pool.query(`
      SELECT ST_AsGeoJSON(
        ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      )::jsonb as geometry
    `, [lng, lat, radiusKm * 1000]);
    
    res.json(result.rows[0].geometry);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to generate buffer polygon", error: err.message });
  }
});

// POST /api/gis/polygons/suggest
// Expects: { facilityId }
// Returns: GeoJSON geometry of convex hull around assigned villages, or fallback buffer
gisPolygonsRouter.post("/suggest", async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    const { facilityId } = req.body;
    
    const result = await pool.query(`
      SELECT ST_AsGeoJSON(
        ST_ConvexHull(
          ST_Collect(ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326))
        )
      )::jsonb as geometry
      FROM villages
      WHERE tenant_id = $1 AND assigned_facility_id = $2 AND latitude IS NOT NULL AND longitude IS NOT NULL
    `, [tenantId, facilityId]);
    
    let geometry = result.rows[0]?.geometry;
    
    // If no villages or points form a valid polygon (e.g. only 1 village), fallback to a 5km buffer around the facility itself
    if (!geometry || geometry.type === "Point" || geometry.type === "LineString") {
      const facResult = await pool.query(`
        SELECT ST_AsGeoJSON(
          ST_Buffer(ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography, 5000)
        )::jsonb as geometry
        FROM facilities
        WHERE tenant_id = $1 AND id = $2
      `, [tenantId, facilityId]);
      
      geometry = facResult.rows[0]?.geometry;
    }
    
    if (!geometry) {
      return res.status(404).json({ message: "Could not generate suggestion. Ensure facility has coordinates." });
    }
    
    res.json(geometry);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to suggest polygon", error: err.message });
  }
});

// POST /api/gis/polygons/intelligence
// Expects: { geometry, ownerType, ownerId }
gisPolygonsRouter.post("/intelligence", async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    const { geometry, ownerType, ownerId } = req.body;

    const tenant = tenantId ? await storage.getTenant(tenantId) : undefined;
    const countryCode = String(tenant?.countryCode || tenant?.code || "ZMB").toUpperCase();
    const intelligence = await PopulationIntelligenceService.fetchPolygonPopulation(tenantId, geometry, countryCode, ownerType, ownerId);
    res.json(intelligence);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to calculate intelligence", error: err.message });
  }
});
