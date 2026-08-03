import { describe, expect, it } from "vitest";
import {
  comparePolygonVersions,
  validatePolygonLifecycleGeometry,
} from "../services/polygonLifecycleService";

const polygon = (coordinates: number[][]) => ({
  type: "Polygon",
  coordinates: [[...coordinates, coordinates[0]]],
});

describe("polygon lifecycle geometry validation", () => {
  it("rejects non-polygon and negligible-area geometry", () => {
    const wrongType = validatePolygonLifecycleGeometry({
      geometry: { type: "Point", coordinates: [28, -15] },
    });
    expect(wrongType.valid).toBe(false);
    expect(wrongType.blockingErrors.map((issue) => issue.code)).toContain("INVALID_GEOMETRY_TYPE");

    const zeroArea = validatePolygonLifecycleGeometry({
      geometry: polygon([[28, -15], [28.000000001, -15], [28.000000001, -15.000000001]]),
    });
    expect(zeroArea.valid).toBe(false);
    expect(zeroArea.blockingErrors.map((issue) => issue.code)).toContain("ZERO_AREA");
  });

  it("blocks self-intersection", () => {
    const result = validatePolygonLifecycleGeometry({
      geometry: polygon([[28, -15], [29, -16], [28, -16], [29, -15]]),
    });
    expect(result.valid).toBe(false);
    expect(result.blockingErrors.map((issue) => issue.code)).toContain("SELF_INTERSECTION");
  });

  it("blocks a community outside its parent and overlapping a sibling", () => {
    const parent = polygon([[28, -16], [30, -16], [30, -14], [28, -14]]);
    const outside = validatePolygonLifecycleGeometry({
      geometry: polygon([[29.5, -15], [30.5, -15], [30.5, -14.5], [29.5, -14.5]]),
      parentGeometry: parent,
    });
    expect(outside.blockingErrors.map((issue) => issue.code)).toContain("OUTSIDE_PARENT");

    const overlap = validatePolygonLifecycleGeometry({
      geometry: polygon([[28.5, -15.5], [29.5, -15.5], [29.5, -14.5], [28.5, -14.5]]),
      parentGeometry: parent,
      siblingPolygons: [{
        id: 44,
        name: "Neighbouring Community",
        geometry: polygon([[29, -15.2], [29.8, -15.2], [29.8, -14.7], [29, -14.7]]),
      }],
    });
    expect(overlap.blockingErrors.map((issue) => issue.code)).toContain("SIBLING_OVERLAP");
  });

  it("reports facility overlap and linked points as warnings", () => {
    const result = validatePolygonLifecycleGeometry({
      geometry: polygon([[28, -16], [30, -16], [30, -14], [28, -14]]),
      neighbouringPolygons: [{
        id: 9,
        name: "Adjacent Facility",
        geometry: polygon([[29, -15.5], [31, -15.5], [31, -13.5], [29, -13.5]]),
      }],
      point: { latitude: -20, longitude: 35, label: "Facility point" },
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["FACILITY_OVERLAP", "POINT_OUTSIDE_POLYGON"]),
    );
  });

  it("compares geometry, population, and spatial differences", () => {
    const comparison = comparePolygonVersions(
      polygon([[28, -16], [29, -16], [29, -15], [28, -15]]),
      polygon([[28, -16], [30, -16], [30, -15], [28, -15]]),
      { from: 1000, to: 1800 },
    );
    expect(comparison.toAreaSqKm).toBeGreaterThan(comparison.fromAreaSqKm);
    expect(comparison.areaDifferenceSqKm).toBeGreaterThan(0);
    expect(comparison.populationDifference).toBe(800);
    expect(comparison.intersectionGeometry).toBeTruthy();
    expect(comparison.addedGeometry).toBeTruthy();
  });
});
