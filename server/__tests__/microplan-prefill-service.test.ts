import { describe, expect, it } from "vitest";
import {
  buildPopulationScenarios,
  canOverrideDenominator,
  pointInsidePolygon,
  polygonCentroid,
  polygonInsidePolygon,
  polygonsOverlap,
  summarizeReadiness,
  validatePolygonGeometry,
  type ReadinessItem,
} from "../services/microplanPrefillService";

describe("microplan prefill service", () => {
  it("groups Population Hub rows into scenario summaries", () => {
    const scenarios = buildPopulationScenarios([
      {
        id: 1,
        source: "nso",
        year: 2026,
        totalPopulation: 1000,
        under1Population: 35,
        under5Population: 160,
        pregnantWomen: 42,
        approvalStatus: "approved",
        confidenceScore: "88",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
      {
        id: 2,
        source: "nso",
        year: 2026,
        totalPopulation: 500,
        under1Population: 18,
        under5Population: 80,
        approvalStatus: "approved",
      },
    ], 2026);

    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toMatchObject({
      id: "population:nso:2026",
      sourceName: "NSO authoritative total",
      method: "Authoritative total",
      confidence: "high",
      status: "approved",
      totalPopulation: 1500,
      targetInfants: 53,
      underFive: 240,
    });
  });

  it("builds a selectable scenario from linked community population rows", () => {
    const scenarios = buildPopulationScenarios([
      { id: 10, villageId: 101, source: "hmis", year: 2026, totalPopulation: 1200, under1Population: 40, approvalStatus: "approved" },
      { id: 11, villageId: 102, source: "hmis", year: 2026, totalPopulation: 800, under1Population: 25, approvalStatus: "approved" },
    ], 2026);

    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toMatchObject({
      id: "population:hmis:2026",
      sourceName: "Imported DHIS2/HMIS denominator",
      totalPopulation: 2000,
      targetInfants: 65,
      status: "approved",
    });
  });
  it("derives target infants from total population when under-one is missing", () => {
    const scenarios = buildPopulationScenarios([
      {
        id: 3,
        source: "worldpop",
        year: 2026,
        totalPopulation: 2000,
        approvalStatus: "approved",
      },
    ], 2026);

    expect(scenarios[0].targetInfants).toBe(70);
    expect(scenarios[0].dataQualityFlags).toContain("Target infants not available");
  });
  it("marks facility workers as unable to override official denominator metadata", () => {
    expect(canOverrideDenominator({ role: "facility_clerk" })).toBe(false);
    expect(canOverrideDenominator({ role: "district_manager" })).toBe(true);
    expect(canOverrideDenominator({ role: "facility_clerk", roles: ["national_admin"] })).toBe(true);
  });

  it("summarizes readiness using blocking issues first", () => {
    const items: ReadinessItem[] = [
      { key: "facility", label: "Facility", status: "ready", message: "Ready" },
      { key: "catchment", label: "Catchment", status: "blocking", message: "Draw catchment" },
      { key: "stock", label: "Stock", status: "warning", message: "No stock history" },
    ];
    expect(summarizeReadiness(items)).toMatchObject({ status: "blocking", blocking: 1, warning: 1, ready: 1, total: 3 });
  });

  it("validates a usable catchment polygon and detects contained points", () => {
    const polygon = {
      type: "Polygon",
      coordinates: [[
        [30, -15],
        [30.1, -15],
        [30.1, -15.1],
        [30, -15.1],
        [30, -15],
      ]],
    };

    const validation = validatePolygonGeometry(polygon);
    expect(validation.valid).toBe(true);
    expect(validation.areaSqKm).toBeGreaterThan(0);
    expect(pointInsidePolygon(-15.05, 30.05, polygon)).toBe(true);
    expect(pointInsidePolygon(-16, 31, polygon)).toBe(false);
  });
  it("validates polygon hierarchy, overlap, and centroid for catchment planning", () => {
    const parent = {
      type: "Polygon",
      coordinates: [[
        [30, -15],
        [30.2, -15],
        [30.2, -15.2],
        [30, -15.2],
        [30, -15],
      ]],
    };
    const childInside = {
      type: "Polygon",
      coordinates: [[
        [30.02, -15.02],
        [30.08, -15.02],
        [30.08, -15.08],
        [30.02, -15.08],
        [30.02, -15.02],
      ]],
    };
    const childOutside = {
      type: "Polygon",
      coordinates: [[
        [30.3, -15.02],
        [30.36, -15.02],
        [30.36, -15.08],
        [30.3, -15.08],
        [30.3, -15.02],
      ]],
    };
    const overlappingSibling = {
      type: "Polygon",
      coordinates: [[
        [30.05, -15.05],
        [30.1, -15.05],
        [30.1, -15.1],
        [30.05, -15.1],
        [30.05, -15.05],
      ]],
    };

    expect(validatePolygonGeometry(parent).valid).toBe(true);
    expect(polygonInsidePolygon(childInside, parent)).toBe(true);
    expect(polygonInsidePolygon(childOutside, parent)).toBe(false);
    expect(polygonsOverlap(childInside, overlappingSibling)).toBe(true);
    expect(polygonsOverlap(childInside, childOutside)).toBe(false);

    const centroid = polygonCentroid(childInside);
    expect(centroid?.latitude).toBeCloseTo(-15.05, 2);
    expect(centroid?.longitude).toBeCloseTo(30.05, 2);
  });

  it("blocks self-intersecting polygons before save", () => {
    const bowtie = {
      type: "Polygon",
      coordinates: [[
        [30, -15],
        [30.1, -15.1],
        [30, -15.1],
        [30.1, -15],
        [30, -15],
      ]],
    };

    const validation = validatePolygonGeometry(bowtie);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Map area cannot self-intersect.");
  });
});

