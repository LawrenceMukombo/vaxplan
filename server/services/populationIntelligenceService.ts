import { db, pool } from "../db";
import { facilities, villages, microplans, populationData } from "@shared/schema";
import { eq, and, or, inArray } from "drizzle-orm";

export interface PopulationSourceData {
  source: string;
  totalPopulation: number;
  under5Population: number;
  method: string;
  confidence: string;
  year: number;
  communityName?: string;
  communityCode?: string;
  villageId?: number | null;
  facilityId?: number | null;
  entityType?: "community" | "facility" | "grid" | "estimate";
}

export interface IntelligenceResult {
  radiusKm: number;
  sources: PopulationSourceData[];
  recommended: PopulationSourceData | null;
  discrepancyLevel: "None" | "Minor" | "Moderate" | "Major";
  discrepancyMessage: string;
}

export interface LocalRadiusPopulation {
  totalPopulation: number;
  under5Population: number;
  coverageRatio: number;
}

/**
 * Estimate population inside an actual radius, rather than summing every grid
 * polygon that merely touches it. Partial cells are prorated by intersected
 * area. When local cells cover only part of the circle, their observed density
 * is extrapolated across the requested area instead of returning the same cell
 * total for every radius.
 */
export async function fetchLocalRadiusPopulation(
  tenantId: string,
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<LocalRadiusPopulation> {
  const result = await pool.query(
    `WITH params AS (
       SELECT ST_Buffer(
         ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
         ($4::double precision) * 1000
       )::geometry AS circle
     ), clipped AS (
       SELECT
         pg.population_total,
         pg.under5_population,
         ST_MakeValid(pg.geometry) AS cell,
         ST_Intersection(ST_MakeValid(pg.geometry), params.circle) AS overlap,
         params.circle
       FROM population_grids pg
       CROSS JOIN params
       WHERE pg.tenant_id = $1
         AND pg.geometry IS NOT NULL
         AND ST_Intersects(ST_MakeValid(pg.geometry), params.circle)
     ), measured AS (
       SELECT
         COALESCE(SUM(population_total * ST_Area(overlap::geography) /
           NULLIF(ST_Area(cell::geography), 0)), 0) AS weighted_total,
         COALESCE(SUM(under5_population * ST_Area(overlap::geography) /
           NULLIF(ST_Area(cell::geography), 0)), 0) AS weighted_under5,
         COALESCE(ST_Area(ST_Union(overlap)::geography), 0) AS covered_area,
         COALESCE(MAX(ST_Area(circle::geography)), 0) AS circle_area
       FROM clipped
     )
     SELECT
       ROUND(weighted_total * GREATEST(1, circle_area / NULLIF(covered_area, 0)))::int AS total,
       ROUND(weighted_under5 * GREATEST(1, circle_area / NULLIF(covered_area, 0)))::int AS under5,
       LEAST(1, covered_area / NULLIF(circle_area, 0))::double precision AS coverage_ratio
     FROM measured`,
    [tenantId, lng, lat, radiusKm],
  );

  return {
    totalPopulation: Number(result.rows[0]?.total) || 0,
    under5Population: Number(result.rows[0]?.under5) || 0,
    coverageRatio: Number(result.rows[0]?.coverage_ratio) || 0,
  };
}

export const PopulationIntelligenceService = {
  
  /**
   * Fetches point-radius population from multiple sources (Grids, synthetic, etc)
   */
  async fetchPointRadiusPopulation(tenantId: string, lat: number, lng: number, radiusKm: number, countryCode: string = "ZMB"): Promise<IntelligenceResult> {
    const sources: PopulationSourceData[] = [];
    
    // 1. Check local grid cache
    try {
      const localResult = await fetchLocalRadiusPopulation(tenantId, lat, lng, radiusKm);
      const localTotal = localResult.totalPopulation;
      if (localTotal > 0) {
        sources.push({
          source: "Local Grid (Area-adjusted)",
          totalPopulation: localTotal,
          under5Population: localResult.under5Population,
          method: localResult.coverageRatio >= 0.8 ? "Radius-weighted grid intersection" : "Radius-weighted local density estimate",
          confidence: localResult.coverageRatio >= 0.8 ? "High" : "Moderate",
          year: 2020
        });
      }
    } catch (e) {
      console.warn("[PopIntel] local DB query failed:", e);
    }

    // 2. WOPR API (WorldPop). A high-confidence local grid is authoritative for
    // this interaction; do not add up to five seconds of network latency merely
    // to obtain a secondary comparison source.
    if (sources.length === 0) try {
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
  async fetchPolygonPopulation(tenantId: string, geojsonPolygon: any, countryCode: string = "ZMB", ownerType?: string, ownerId?: number): Promise<IntelligenceResult> {
    const sources: PopulationSourceData[] = [];
    
    if (ownerType && ownerId) {
      let popDataQuery;
      let entityName = "Catchment Entity";
      let entityCode: string | undefined;

      if (ownerType === "facility") {
        popDataQuery = db.select().from(populationData).where(and(eq(populationData.facilityId, ownerId), eq(populationData.tenantId, tenantId)));
        const [fac] = await db.select().from(facilities).where(and(eq(facilities.id, ownerId), eq(facilities.tenantId, tenantId))).limit(1);
        if (fac) {
          entityName = fac.name;
          entityCode = fac.hmisCode || undefined;
        }
      } else if (ownerType === "village") {
        popDataQuery = db.select().from(populationData).where(and(eq(populationData.villageId, ownerId), eq(populationData.tenantId, tenantId)));
        const [vil] = await db.select().from(villages).where(and(eq(villages.id, ownerId), eq(villages.tenantId, tenantId))).limit(1);
        if (vil) {
          entityName = vil.name;
          entityCode = vil.code || undefined;
        }
      }
      
      if (popDataQuery) {
        const popDataResult = await popDataQuery;
        for (const pd of popDataResult) {
          sources.push({
            source: pd.source.toUpperCase(),
            communityName: entityName,
            communityCode: entityCode,
            villageId: pd.villageId || null,
            facilityId: pd.facilityId || null,
            entityType: ownerType === "village" ? "community" : "facility",
            totalPopulation: pd.totalPopulation,
            under5Population: pd.under5Population || Math.round(pd.totalPopulation * 0.17),
            method: pd.metadata ? (pd.metadata as any).method || "Administrative" : "Administrative",
            confidence: pd.confidenceScore ? (Number(pd.confidenceScore) > 0.8 ? "High" : Number(pd.confidenceScore) > 0.5 ? "Moderate" : "Low") : "Moderate",
            year: pd.year || new Date().getFullYear()
          });
        }
      }
    }
    
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
          communityName: "Polygon Area Grid",
          entityType: "grid",
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

    // 2. Fallback to synthetic if nothing returned (offline/sandbox support)
    if (sources.length === 0) {
      const areaKm2 = Math.PI * radiusKm * radiusKm;
      // create a mock density
      const mockPop = Math.max(1, Math.round(150 * areaKm2));
      sources.push({
        source: "Synthetic Baseline",
        communityName: "Polygon Synthetic Estimate",
        entityType: "estimate",
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
   * Fetches populations for a specific facility, including its official stats,
   * its catchment communities' demographic figures, and spatial catchment queries
   */
  async fetchFacilityPopulation(tenantId: string, facilityId: number, radiusKm: number): Promise<IntelligenceResult> {
    const sources: PopulationSourceData[] = [];
    
    // 1. Get facility
    const [facility] = await db.select().from(facilities).where(and(eq(facilities.id, facilityId), eq(facilities.tenantId, tenantId))).limit(1);
    
    // 2. Load all catchment communities for this facility
    const facilityVillages = await db.select().from(villages).where(and(eq(villages.assignedFacilityId, facilityId), eq(villages.tenantId, tenantId)));
    const villageMap = new Map<number, { name: string; code?: string; pop?: number }>();
    const villageIds: number[] = [];
    facilityVillages.forEach(v => {
      villageMap.set(v.id, { name: v.name, code: v.code || undefined, pop: v.griddedPopulation || undefined });
      villageIds.push(v.id);
    });

    // 3. Query all populationData records for this facility or its catchment villages
    const conditions = [eq(populationData.tenantId, tenantId)];
    if (villageIds.length > 0) {
      conditions.push(or(eq(populationData.facilityId, facilityId), inArray(populationData.villageId, villageIds))!);
    } else {
      conditions.push(eq(populationData.facilityId, facilityId));
    }

    const popData = await db.select().from(populationData).where(and(...conditions));
    const processedVillageIds = new Set<number>();
    
    if (popData.length > 0) {
      for (const pd of popData) {
        if (pd.villageId) processedVillageIds.add(Number(pd.villageId));
        const vInfo = pd.villageId ? villageMap.get(Number(pd.villageId)) : null;
        const metaVillageName = (pd.metadata as any)?.villageName || (pd.metadata as any)?.communityName || (pd.metadata as any)?.location;
        
        const communityName = vInfo
          ? vInfo.name
          : metaVillageName
          ? metaVillageName
          : (facility ? `${facility.name} (Whole Facility Catchment)` : "Whole Facility Catchment");
        const communityCode = vInfo ? vInfo.code : (facility ? facility.hmisCode || undefined : undefined);

        sources.push({
          source: pd.source.toUpperCase(),
          communityName,
          communityCode,
          villageId: pd.villageId || null,
          facilityId: pd.facilityId || null,
          entityType: pd.villageId ? "community" : "facility",
          totalPopulation: pd.totalPopulation,
          under5Population: pd.under5Population || Math.round(pd.totalPopulation * 0.17),
          method: pd.metadata ? (pd.metadata as any).method || "Administrative" : "Administrative",
          confidence: pd.confidenceScore ? (Number(pd.confidenceScore) > 0.8 ? "High" : Number(pd.confidenceScore) > 0.5 ? "Moderate" : "Low") : "High",
          year: pd.year || new Date().getFullYear()
        });
      }
    } else if (facility) {
      if (facility.catchmentGridPopulation && facility.catchmentGridPopulation > 0) {
        sources.push({
          source: "Official (HMIS/NSO)",
          communityName: `${facility.name} (Whole Facility Catchment)`,
          communityCode: facility.hmisCode || undefined,
          facilityId: facility.id,
          entityType: "facility",
          totalPopulation: facility.catchmentGridPopulation,
          under5Population: Math.round(facility.catchmentGridPopulation * 0.17),
          method: "Administrative",
          confidence: "High",
          year: new Date().getFullYear()
        });
      }
    }

    // 4. Always include all catchment villages that are assigned to this facility
    if (facilityVillages.length > 0) {
      for (const v of facilityVillages) {
        if (!processedVillageIds.has(v.id)) {
          const popVal = v.griddedPopulation && v.griddedPopulation > 0 ? v.griddedPopulation : 0;
          if (popVal > 0) {
            sources.push({
              source: v.populationSourceLabel ? v.populationSourceLabel.toUpperCase() : "COMMUNITY CENSUS",
              communityName: v.name,
              communityCode: v.code || undefined,
              villageId: v.id,
              facilityId,
              entityType: "community",
              totalPopulation: popVal,
              under5Population: Math.round(popVal * 0.17),
              method: "Local Community / Ward Census",
              confidence: "High",
              year: new Date().getFullYear()
            });
          }
        }
      }
    }

    if (facility) {
      // Add spatial estimates based on facility coordinates
      if (facility.latitude && facility.longitude) {
        const spatialRes = await this.fetchPointRadiusPopulation(tenantId, Number(facility.latitude), Number(facility.longitude), radiusKm);
        for (const s of spatialRes.sources) {
          sources.push({
            ...s,
            communityName: `${facility.name} (${radiusKm}km Spatial Grid Buffer)`,
            entityType: "grid",
          });
        }
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
