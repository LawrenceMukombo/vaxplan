import { describe, it, expect } from "vitest";
import {
  calculateLegMetrics,
  optimizeDynamicOutreachRoute,
  type DynamicRouteParams,
} from "../services/routing";

describe("Dynamic GIS Route Optimization Engine", () => {
  const origin = {
    name: "Chawama Health Center Base",
    latitude: -15.4512,
    longitude: 28.2831,
  };

  const villageA = {
    id: 1,
    name: "Village Alpha (Accessible)",
    latitude: -15.4600,
    longitude: 28.2900,
  };

  const villageB = {
    id: 2,
    name: "Village Beta (Across River Kafue)",
    latitude: -15.5200,
    longitude: 28.3400,
  };

  const riverCrossings = [
    {
      name: "Kafue River Bridge/Ford",
      latitude: -15.4900,
      longitude: 28.3150,
      passableInRain: false,
      requiresBoat: true,
    },
  ];

  it("applies weather and seasonal friction multipliers to rural dirt tracks", () => {
    const dryLeg = calculateLegMetrics(origin, villageA, "dry", "clear", "motorbike");
    const rainyLeg = calculateLegMetrics(origin, villageA, "rainy", "moderate_rain", "motorbike");

    expect(dryLeg.distanceKm).toBeGreaterThan(0);
    expect(rainyLeg.durationMinutes).toBeGreaterThan(dryLeg.durationMinutes);
    expect(rainyLeg.weatherFrictionPenalty).toBeGreaterThan(dryLeg.weatherFrictionPenalty);
  });

  it("detects river crossings and flags boat shuttle requirements in rainy season", () => {
    const rainyLeg = calculateLegMetrics(origin, villageB, "rainy", "moderate_rain", "motorbike", riverCrossings);

    expect(rainyLeg.riverCrossingDetected).toBeDefined();
    expect(rainyLeg.riverCrossingDetected?.status).toBe("requires_boat_detour");
    expect(rainyLeg.riverCrossingDetected?.delayMinutes).toBe(45);
    expect(rainyLeg.warnings.some((w) => w.includes("RIVER DETOUR"))).toBe(true);
  });

  it("marks river crossing as impassable during heavy flood events", () => {
    const floodLeg = calculateLegMetrics(origin, villageB, "rainy", "heavy_flood", "car", riverCrossings);

    expect(floodLeg.riverCrossingDetected?.status).toBe("impassable");
    expect(floodLeg.warnings.some((w) => w.includes("IMPASSABLE"))).toBe(true);
  });

  it("optimizes multi-stop outreach path and generates sequenced stops with GeoJSON", async () => {
    const villageC = {
      id: 3,
      name: "Village Gamma (Nearby)",
      latitude: -15.4550,
      longitude: 28.2850,
    };

    const params: DynamicRouteParams = {
      origin,
      stops: [villageB, villageA, villageC],
      season: "dry",
      weatherCondition: "clear",
      transportMode: "motorbike",
      knownRiverCrossings: riverCrossings,
    };

    const result = await optimizeDynamicOutreachRoute(params);

    expect(result).toBeDefined();
    expect(result.orderedStops.length).toBe(3);
    // Nearest stop (villageC) should be visited first
    expect(result.orderedStops[0].name).toBe("Village Gamma (Nearby)");
    expect(result.totalDistanceKm).toBeGreaterThan(0);
    expect(result.totalDurationMinutes).toBeGreaterThan(0);
    expect(result.legs.length).toBe(3);
    expect(result.routeCoordinates.length).toBeGreaterThanOrEqual(4);
  });
});
