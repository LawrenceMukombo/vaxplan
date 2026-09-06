import type {
  LayerSpecification,
  GeoJSONSourceSpecification,
  Map as MapLibreMap,
} from "maplibre-gl";

export interface GeoPointFeatureProperties {
  id: number | string;
  name: string;
  type: "facility" | "village" | "session" | "unserved";
  category?: string;
  status?: string;
  districtId?: number | null;
  districtName?: string | null;
  provinceId?: number | null;
  provinceName?: string | null;
  facilityType?: string | null;
  isHardToReach?: boolean;
  isPlanned?: boolean;
  hasRefrigerator?: boolean;
  hasPower?: boolean;
  totalPopulation?: number | null;
  color?: string;
}

export interface VaxPlanGeoJSONFeature {
  type: "Feature";
  id: number | string;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: GeoPointFeatureProperties;
}

export interface VaxPlanFeatureCollection {
  type: "FeatureCollection";
  features: VaxPlanGeoJSONFeature[];
}

/**
 * Transforms an array of facilities into a GeoJSON FeatureCollection
 */
export function facilitiesToGeoJSON(facilities: any[] = []): VaxPlanFeatureCollection {
  const features: VaxPlanGeoJSONFeature[] = [];

  for (const f of facilities) {
    const lat = Number(f.latitude);
    const lng = Number(f.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    features.push({
      type: "Feature",
      id: f.id,
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
      properties: {
        id: f.id,
        name: f.name || "Health Facility",
        type: "facility",
        facilityType: f.facilityType || "Health Facility",
        districtId: f.districtId ? Number(f.districtId) : null,
        districtName: f.districtName || null,
        provinceId: f.provinceId ? Number(f.provinceId) : null,
        provinceName: f.provinceName || null,
        hasRefrigerator: Boolean(f.hasRefrigerator),
        hasPower: Boolean(f.hasPower),
        color: "#2563eb", // Blue
      },
    });
  }

  return { type: "FeatureCollection", features };
}

/**
 * Transforms an array of villages / communities into a GeoJSON FeatureCollection
 */
export function villagesToGeoJSON(
  villages: any[] = [],
  plannedVillageIds: Set<number> = new Set(),
): VaxPlanFeatureCollection {
  const features: VaxPlanGeoJSONFeature[] = [];

  for (const v of villages) {
    const lat = Number(v.latitude);
    const lng = Number(v.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const isPlanned = plannedVillageIds.has(Number(v.id));
    const isHtr = Boolean(v.isHardToReach);

    // Color code conforming to VaxPlan EPI planning standards
    let color = "#64748b"; // Standard unplanned (slate)
    if (isPlanned) {
      color = "#10b981"; // Planned community (emerald green)
    } else if (isHtr) {
      color = "#f43f5e"; // Hard-to-reach unplanned (rose red)
    }

    features.push({
      type: "Feature",
      id: v.id,
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
      properties: {
        id: v.id,
        name: v.name || "Community",
        type: "village",
        districtId: v.districtId ? Number(v.districtId) : null,
        isHardToReach: isHtr,
        isPlanned,
        totalPopulation: v.totalCatchmentPopulation || v.populationEstimate || null,
        color,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

/**
 * Transforms an array of immunization session locations into a GeoJSON FeatureCollection
 */
export function sessionsToGeoJSON(sessions: any[] = []): VaxPlanFeatureCollection {
  const features: VaxPlanGeoJSONFeature[] = [];

  for (const s of sessions) {
    const lat = Number(s.latitude);
    const lng = Number(s.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const status = String(s.status || "planned").toLowerCase();
    let color = "#2563eb"; // Planned (blue)
    if (status === "in_progress") color = "#f59e0b"; // In progress (amber)
    if (status === "overdue") color = "#f43f5e"; // Overdue (rose)
    if (status === "completed") color = "#059669"; // Completed (green)

    features.push({
      type: "Feature",
      id: s.id,
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
      properties: {
        id: s.id,
        name: s.name || s.sessionName || "Immunisation Session",
        type: "session",
        status,
        color,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

/**
 * Transforms an array of unserved places / missed communities into a GeoJSON FeatureCollection
 */
export function unservedPlacesToGeoJSON(places: any[] = []): VaxPlanFeatureCollection {
  const features: VaxPlanGeoJSONFeature[] = [];

  for (const p of places) {
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    features.push({
      type: "Feature",
      id: p.id,
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
      properties: {
        id: p.id,
        name: p.name || "Unserved Place",
        type: "unserved",
        color: "#dc2626", // Red
      },
    });
  }

  return { type: "FeatureCollection", features };
}

/**
 * Builds cluster and point layer specifications for a specific source
 */
export function createPointLayersForSource(
  sourceId: string,
  layerPrefix: string,
  defaultColor: string,
): LayerSpecification[] {
  return [
    // 1. Cluster background circle
    {
      id: `${layerPrefix}-clusters`,
      type: "circle",
      source: sourceId,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          defaultColor,
          15,
          "#4f46e5",
          50,
          "#7c3aed",
          150,
          "#be185d",
        ],
        "circle-radius": [
          "step",
          ["get", "point_count"],
          16,
          15,
          20,
          50,
          26,
          150,
          32,
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.9,
      },
    },
    // 2. Cluster count label
    {
      id: `${layerPrefix}-cluster-count`,
      type: "symbol",
      source: sourceId,
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-size": 11,
      },
      paint: {
        "text-color": "#ffffff",
      },
    },
    // 3. Unclustered individual points
    {
      id: `${layerPrefix}-points`,
      type: "circle",
      source: sourceId,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["coalesce", ["get", "color"], defaultColor],
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          4,
          10,
          6.5,
          14,
          9,
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    },
  ];
}

/**
 * Creates the clustered GeoJSON source configuration
 */
export function createClusteredGeoJSONSource(
  data: VaxPlanFeatureCollection,
  maxZoom = 15,
  clusterRadius = 45,
): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data,
    cluster: true,
    clusterMaxZoom: maxZoom,
    clusterRadius,
  };
}

/**
 * Attaches a zoom-to-cluster click handler on a cluster layer
 */
export function handleClusterClick(
  map: MapLibreMap,
  sourceId: string,
  e: any,
) {
  const features = map.queryRenderedFeatures(e.point, {
    layers: [`${sourceId}-clusters`],
  });
  if (!features.length) return;

  const clusterId = features[0].properties.cluster_id;
  const source = map.getSource(sourceId) as any;

  if (source && typeof source.getClusterExpansionZoom === "function") {
    source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
      if (err) return;
      const geom = features[0].geometry as any;
      map.easeTo({
        center: geom.coordinates,
        zoom: zoom + 0.5,
        duration: 400,
      });
    });
  }
}
