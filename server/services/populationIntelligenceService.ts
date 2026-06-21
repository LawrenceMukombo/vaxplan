import { db, pool } from "../db";
import { facilities, villages, microplans, populationData } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface PopulationSourceData {
  source: string;
  totalPopulation: number;
  under5Population: number;
  method: string;
  confidence: string;
  year: number;
}

export interface IntelligenceResult {
  radiusKm: number;
  sources: PopulationSourceData[];
  recommended: PopulationSourceData | null;
  discrepancyLevel: "None" | "Minor" | "Moderate" | "Major";
  discrepancyMessage: string;
}

export const PopulationIntelligenceService = {
  
  /**
   * Fetches point-radius population from multiple sources (Grids, synthetic, etc)
   */
  async fetchPointRadiusPopulation(tenantId: string, lat: number, lng: number, radiusKm: number, countryCode: string = "ZMB"): Promise<IntelligenceResult> {
    const sources: PopulationSourceData[] = [];
    
    // 1. Check local grid cache
    try {
      const localResult = await pool.query(
        `SELECT COALESCE(SUM(population_total),0)::int AS total,
                COALESCE(SUM(under5_population),0)::int AS under5
         FROM population_grids
         WHERE tenant_id = $1
           AND geometry IS NOT NULL
           AND ST_DWithin(
             geometry::geography,
             ST_SetSRID(ST_MakePoint($2,$3),4326)::geography,
             $4 * 1000
           )`,
        [tenantId, lng, lat, radiusKm]
      );
      const localTotal = localResult.rows[0]?.total ?? 0;
      if (localTotal > 0) {
        sources.push({
          source: "Local Grid (Cached)",
          totalPopulation: localTotal,
          under5Population: localResult.rows[0]?.under5 ?? 0,
          method: "ST_DWithin Intersection",
          confidence: "High",
          year: 2020
        });
      }
    } catch (e) {
      console.warn("[PopIntel] local DB query failed:", e);
    }

    // 2. WOPR API (WorldPop)
    try {
      const woprUrl = `https://hub.worldpop.org/v1/wopr/pointestimate?iso3=${countryCode}&ver=1.0.0&lat=${lat}&lon=${lng}`;
      const woprRes = await fetch(woprUrl, { signal: AbortSignal.timeout(5000) });
      if (woprRes.ok) {
        const woprData = await woprRes.json() as any;
        const meanPop = woprData?.data?.mean ?? woprData?.result?.mean ?? 0;
        if (meanPop > 0) {
          const areaKm2 = Math.PI * radiusKm * radiusKm;
          const scaled = Math.round(meanPop * areaKm2 / 0.01);
          sources.push({
            source: "GridPop/WOPR API",
            totalPopulation: scaled,
            under5Population: Math.round(scaled * 0.17),
            method: "Scaled Point Estimate",
            confidence: "Moderate",
            year: new Date().getFullYear()
          });
        }
      }
    } catch (e) {
      // ignore
    }

    // 3. Fallback to synthetic if nothing returned (offline/sandbox support)
    if (sources.length === 0) {
      const seed = Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453;
      const density = 150 + Math.abs(seed - Math.floor(seed)) * 450;
      const areaKm2 = Math.PI * radiusKm * radiusKm;
      const mockPop = Math.max(1, Math.round(density * areaKm2));
      sources.push({
        source: "Synthetic Baseline",
        totalPopulation: mockPop,
        under5Population: Math.round(mockPop * 0.17),
        method: "Procedural",
        confidence: "Low",
        year: new Date().getFullYear()
      });
    }

    return this.comparePopulationSources(sources, radiusKm);
  },

  /**
   * Fetches population inside a GeoJSON Polygon
   */
  async fetchPolygonPopulation(tenantId: string, geojsonPolygon: any, countryCode: string = "ZMB"): Promise<IntelligenceResult> {
    const sources: PopulationSourceData[] = [];
    
    // Convert GeoJSON to PostGIS Geometry using raw SQL
    // We assume geojsonPolygon is a valid GeoJSON Feature or Geometry.
    const geomStr = JSON.stringify(geojsonPolygon.geometry || geojsonPolygon);
    
    // We approximate a "radius" for discrepancy reporting (equivalent circle)
    let radiusKm = 5;

    // 1. Check local grid cache
    try {
      const localResult = await pool.query(
        `SELECT COALESCE(SUM(population_total),0)::int AS total,
                COALESCE(SUM(under5_population),0)::int AS under5
         FROM population_grids
         WHERE tenant_id = $1
           AND geometry IS NOT NULL
           AND ST_Intersects(
             geometry,
             ST_GeomFromGeoJSON($2)
           )`,
        [tenantId, geomStr]
      );
      const localTotal = localResult.rows[0]?.total ?? 0;
      if (localTotal > 0) {
        sources.push({
          source: "Local Grid (Cached)",
          totalPopulation: localTotal,
          under5Population: localResult.rows[0]?.under5 ?? 0,
          method: "ST_Intersects Polygon",
          confidence: "High",
          year: 2020
        });
      }

      // Try to calculate the approx radius based on polygon area in PostGIS for the fallback
      const areaResult = await pool.query(`SELECT ST_Area(ST_GeomFromGeoJSON($1)::geography) / 1000000 AS area_sq_km`, [geomStr]);
      const areaSqKm = areaResult.rows[0]?.area_sq_km ?? 0;
      if (areaSqKm > 0) {
        radiusKm = Math.sqrt(areaSqKm / Math.PI);
      }
    } catch (e) {
      console.warn("[PopIntel] local DB polygon query failed:", e);
    }

    // Since WorldPop WOPR doesn't easily accept arbitrary polygons via simple GET without an API key or complex setup in their public hub,
    // we use the local grid or synthetic fallback. If we wanted to hit WOPR for polygon, we'd do a POST to /v1/wopr/polygonestimate.
    // For now we rely on Local Grid which represents GridPop / GRID3 data imported locally.

    // 2. Fallback to synthetic if nothing returned (offline/sandbox support)
    if (sources.length === 0) {
      const areaKm2 = Math.PI * radiusKm * radiusKm;
      // create a mock density
      const mockPop = Math.max(1, Math.round(150 * areaKm2));
      sources.push({
        source: "Synthetic Baseline",
        totalPopulation: mockPop,
        under5Population: Math.round(mockPop * 0.17),
        method: "Procedural Polygon",
        confidence: "Low",
        year: new Date().getFullYear()
      });
    }

    return this.comparePopulationSources(sources, radiusKm);
  },

  /**
   * Fetches populations for a specific facility, including its official stats
   * and spatial catchment queries
   */
  async fetchFacilityPopulation(tenantId: string, facilityId: number, radiusKm: number): Promise<IntelligenceResult> {
    const sources: PopulationSourceData[] = [];
    
    // Get official populations assigned to this facility
    const [facility] = await db.select().from(facilities).where(and(eq(facilities.id, facilityId), eq(facilities.tenantId, tenantId))).limit(1);
    
    if (facility) {
      if (facility.catchmentGridPopulation && facility.catchmentGridPopulation > 0) {
        sources.push({
          source: "Official (HMIS/NSO)",
          totalPopulation: facility.catchmentGridPopulation,
          under5Population: Math.round(facility.catchmentGridPopulation * 0.17), // Fallback, could be fetched from DB specifically if added
          method: "Administrative",
          confidence: "High",
          year: new Date().getFullYear()
        });
      }

      // Add spatial estimates based on facility coordinates
      if (facility.latitude && facility.longitude) {
        const spatialRes = await this.fetchPointRadiusPopulation(tenantId, Number(facility.latitude), Number(facility.longitude), radiusKm);
        sources.push(...spatialRes.sources);
      }
    }

    return this.comparePopulationSources(sources, radiusKm);
  },

  /**
   * Compare a list of sources and compute discrepancy
   */
  comparePopulationSources(sources: PopulationSourceData[], radiusKm: number): IntelligenceResult {
    if (sources.length === 0) {
      return {
        radiusKm,
        sources,
        recommended: null,
        discrepancyLevel: "None",
        discrepancyMessage: "No data available."
      };
    }

    // Recommended is typically the highest confidence or official
    const recommended = sources.find(s => s.confidence === "High") || sources[0];

    // Compute discrepancy
    let discrepancyLevel: "None" | "Minor" | "Moderate" | "Major" = "None";
    let discrepancyMessage = "Populations are aligned.";

    if (sources.length > 1) {
      const pops = sources.map(s => s.totalPopulation);
      const min = Math.min(...pops);
      const max = Math.max(...pops);
      const diffPercent = max > 0 ? ((max - min) / max) * 100 : 0;

      if (diffPercent > 50) {
        discrepancyLevel = "Major";
        discrepancyMessage = "Critical discrepancy between Official and Spatial data. Field verification strongly recommended.";
      } else if (diffPercent > 20) {
        discrepancyLevel = "Moderate";
        discrepancyMessage = "Moderate variance detected across sources. Suggest using the most recent source.";
      } else if (diffPercent > 5) {
        discrepancyLevel = "Minor";
        discrepancyMessage = "Minor variance within acceptable margins.";
      }
    }

    return {
      radiusKm,
      sources,
      recommended,
      discrepancyLevel,
      discrepancyMessage
    };
  }
};
