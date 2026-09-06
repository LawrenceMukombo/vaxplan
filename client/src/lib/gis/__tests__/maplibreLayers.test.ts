import { describe, it, expect } from "vitest";
import {
  facilitiesToGeoJSON,
  villagesToGeoJSON,
  sessionsToGeoJSON,
  unservedPlacesToGeoJSON,
  createPointLayersForSource,
  createClusteredGeoJSONSource,
} from "../maplibreLayers";

describe("MapLibre GPU Layers & GeoJSON Transformers", () => {
  it("converts health facilities to GeoJSON FeatureCollection", () => {
    const mockFacilities = [
      {
        id: 101,
        name: "Central Health Post",
        latitude: "-15.421",
        longitude: "28.322",
        facilityType: "Health Post",
        hasRefrigerator: true,
        hasPower: false,
      },
      {
        id: 102,
        name: "Invalid Facility",
        latitude: "NaN",
        longitude: null,
      },
    ];

    const fc = facilitiesToGeoJSON(mockFacilities);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1); // Invalid coords filtered out

    const feat = fc.features[0];
    expect(feat.id).toBe(101);
    expect(feat.geometry.coordinates).toEqual([28.322, -15.421]); // [lng, lat]
    expect(feat.properties.type).toBe("facility");
    expect(feat.properties.hasRefrigerator).toBe(true);
    expect(feat.properties.color).toBe("#2563eb");
  });

  it("converts villages with EPI color-coding for planned vs hard-to-reach", () => {
    const mockVillages = [
      {
        id: 1,
        name: "Planned Village",
        latitude: -15.1,
        longitude: 28.1,
        isHardToReach: false,
      },
      {
        id: 2,
        name: "Hard-to-Reach Unplanned",
        latitude: -15.2,
        longitude: 28.2,
        isHardToReach: true,
      },
      {
        id: 3,
        name: "Standard Unplanned",
        latitude: -15.3,
        longitude: 28.3,
        isHardToReach: false,
      },
    ];

    const plannedIds = new Set([1]);
    const fc = villagesToGeoJSON(mockVillages, plannedIds);
    expect(fc.features).toHaveLength(3);

    // Planned -> Emerald green (#10b981)
    expect(fc.features[0].properties.isPlanned).toBe(true);
    expect(fc.features[0].properties.color).toBe("#10b981");

    // HTR Unplanned -> Rose red (#f43f5e)
    expect(fc.features[1].properties.isPlanned).toBe(false);
    expect(fc.features[1].properties.isHardToReach).toBe(true);
    expect(fc.features[1].properties.color).toBe("#f43f5e");

    // Standard Unplanned -> Slate (#64748b)
    expect(fc.features[2].properties.isPlanned).toBe(false);
    expect(fc.features[2].properties.color).toBe("#64748b");
  });

  it("converts sessions with lifecycle color-coding", () => {
    const mockSessions = [
      { id: 10, name: "S1", latitude: -15.1, longitude: 28.1, status: "planned" },
      { id: 11, name: "S2", latitude: -15.2, longitude: 28.2, status: "in_progress" },
      { id: 12, name: "S3", latitude: -15.3, longitude: 28.3, status: "overdue" },
      { id: 13, name: "S4", latitude: -15.4, longitude: 28.4, status: "completed" },
    ];

    const fc = sessionsToGeoJSON(mockSessions);
    expect(fc.features).toHaveLength(4);
    expect(fc.features[0].properties.color).toBe("#2563eb");
    expect(fc.features[1].properties.color).toBe("#f59e0b");
    expect(fc.features[2].properties.color).toBe("#f43f5e");
    expect(fc.features[3].properties.color).toBe("#059669");
  });

  it("converts unserved places to GeoJSON", () => {
    const mockPlaces = [
      { id: 99, name: "Gap Hamlet", latitude: -15.5, longitude: 28.5 },
    ];
    const fc = unservedPlacesToGeoJSON(mockPlaces);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties.type).toBe("unserved");
    expect(fc.features[0].properties.color).toBe("#dc2626");
  });

  it("generates valid layer specifications with clusters, counts, and points", () => {
    const layers = createPointLayersForSource("test-src", "test-prefix", "#2563eb");
    expect(layers).toHaveLength(3);

    const clusterBg = layers[0];
    const clusterCount = layers[1];
    const points = layers[2];

    expect(clusterBg.type).toBe("circle");
    expect(clusterCount.type).toBe("symbol");
    expect(points.type).toBe("circle");

    expect(clusterBg.id).toBe("test-prefix-clusters");
    expect(clusterCount.id).toBe("test-prefix-cluster-count");
    expect(points.id).toBe("test-prefix-points");
  });

  it("creates clustered GeoJSON source configuration", () => {
    const fc = facilitiesToGeoJSON([]);
    const sourceConfig = createClusteredGeoJSONSource(fc, 14, 50);
    expect(sourceConfig.type).toBe("geojson");
    expect(sourceConfig.cluster).toBe(true);
    expect(sourceConfig.clusterMaxZoom).toBe(14);
    expect(sourceConfig.clusterRadius).toBe(50);
  });
});
