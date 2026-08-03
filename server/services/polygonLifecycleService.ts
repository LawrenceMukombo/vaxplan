import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";

export type PolygonEntityType = "facility" | "village" | "settlement" | "outreach" | "administrative" | "custom";
export type ValidationSeverity = "blocking" | "warning" | "information";

export interface PolygonValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  relatedEntityId?: number;
  relatedEntityName?: string;
  geometry?: unknown;
}

export interface PolygonValidationResult {
  valid: boolean;
  areaSqKm: number;
  centroid: { latitude: number; longitude: number } | null;
  issues: PolygonValidationIssue[];
  blockingErrors: PolygonValidationIssue[];
  warnings: PolygonValidationIssue[];
  information: PolygonValidationIssue[];
}

export function asPolygonFeature(input: any): Feature<Polygon | MultiPolygon> | null {
  const geometry = input?.type === "Feature" ? input.geometry : input;
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return null;
  return turf.feature(geometry) as Feature<Polygon | MultiPolygon>;
}

function issue(code: string, severity: ValidationSeverity, message: string, extra: Partial<PolygonValidationIssue> = {}): PolygonValidationIssue {
  return { code, severity, message, ...extra };
}

export function validatePolygonLifecycleGeometry(input: {
  geometry: any;
  parentGeometry?: any;
  siblingPolygons?: Array<{ id: number; name?: string | null; geometry: any }>;
  point?: { latitude?: number | string | null; longitude?: number | string | null; label?: string };
  neighbouringPolygons?: Array<{ id: number; name?: string | null; geometry: any }>;
  overlapTolerancePercent?: number;
}): PolygonValidationResult {
  const issues: PolygonValidationIssue[] = [];
  const feature = asPolygonFeature(input.geometry);

  if (!feature) {
    issues.push(issue("INVALID_GEOMETRY_TYPE", "blocking", "Geometry must be a GeoJSON Polygon or MultiPolygon."));
    return summarize(issues, 0, null);
  }

  let areaSqKm = 0;
  let centroid: { latitude: number; longitude: number } | null = null;
  try {
    areaSqKm = turf.area(feature) / 1_000_000;
    const center = turf.centroid(feature);
    centroid = { longitude: center.geometry.coordinates[0], latitude: center.geometry.coordinates[1] };
  } catch {
    issues.push(issue("INVALID_GEOMETRY", "blocking", "The polygon geometry could not be evaluated."));
    return summarize(issues, 0, null);
  }

  if (!Number.isFinite(areaSqKm) || areaSqKm <= 0.000001) {
    issues.push(issue("ZERO_AREA", "blocking", "The polygon has zero or negligible area."));
  }

  try {
    const kinkResult = turf.kinks(feature as any);
    if (kinkResult.features.length > 0) {
      issues.push(issue("SELF_INTERSECTION", "blocking", "The polygon self-intersects. Move or remove crossing vertices.", {
        geometry: kinkResult,
      }));
    }
  } catch {
    issues.push(issue("INVALID_RING", "blocking", "The polygon contains an invalid or unclosed ring."));
  }

  const parent = asPolygonFeature(input.parentGeometry);
  if (parent) {
    try {
      if (!turf.booleanWithin(feature as any, parent as any)) {
        const outside = turf.difference(turf.featureCollection([feature as any, parent as any]));
        issues.push(issue("OUTSIDE_PARENT", "blocking", "This community polygon extends outside the facility catchment. Please adjust the boundary before saving.", {
          geometry: outside,
        }));
      }
    } catch {
      issues.push(issue("PARENT_VALIDATION_FAILED", "blocking", "The polygon could not be validated against its parent boundary."));
    }
  }

  for (const sibling of input.siblingPolygons || []) {
    const siblingFeature = asPolygonFeature(sibling.geometry);
    if (!siblingFeature) continue;
    try {
      const overlap = turf.intersect(turf.featureCollection([feature as any, siblingFeature as any]));
      if (overlap && turf.area(overlap) > 0.5) {
        issues.push(issue("SIBLING_OVERLAP", "blocking", "This community polygon overlaps " + (sibling.name || "another community polygon") + ".", {
          relatedEntityId: sibling.id,
          relatedEntityName: sibling.name || undefined,
          geometry: overlap,
        }));
      }
    } catch {
      // A malformed sibling should not make a valid edit impossible.
    }
  }

  const tolerance = Math.max(0, Number(input.overlapTolerancePercent || 0));
  for (const neighbour of input.neighbouringPolygons || []) {
    const neighbourFeature = asPolygonFeature(neighbour.geometry);
    if (!neighbourFeature) continue;
    try {
      const overlap = turf.intersect(turf.featureCollection([feature as any, neighbourFeature as any]));
      if (!overlap) continue;
      const overlapArea = turf.area(overlap) / 1_000_000;
      const overlapPercent = areaSqKm > 0 ? (overlapArea / areaSqKm) * 100 : 0;
      if (overlapPercent > tolerance) {
        issues.push(issue("FACILITY_OVERLAP", "warning", "This facility catchment overlaps " + (neighbour.name || "a neighbouring facility catchment") + " by " + overlapPercent.toFixed(1) + "%.", {
          relatedEntityId: neighbour.id,
          relatedEntityName: neighbour.name || undefined,
          geometry: overlap,
        }));
      }
    } catch {
      // Ignore malformed neighbour records; they are reported by their own validation.
    }
  }

  const latitude = Number(input.point?.latitude);
  const longitude = Number(input.point?.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    try {
      if (!turf.booleanPointInPolygon(turf.point([longitude, latitude]), feature as any)) {
        issues.push(issue("POINT_OUTSIDE_POLYGON", "warning", (input.point?.label || "The linked location point") + " is outside this polygon."));
      }
    } catch {
      issues.push(issue("POINT_VALIDATION_FAILED", "warning", "The linked point could not be validated against this polygon."));
    }
  }

  issues.push(issue("AREA_CALCULATED", "information", "Calculated area: " + areaSqKm.toFixed(2) + " km2."));
  return summarize(issues, areaSqKm, centroid);
}

function summarize(
  issues: PolygonValidationIssue[],
  areaSqKm: number,
  centroid: { latitude: number; longitude: number } | null,
): PolygonValidationResult {
  const blockingErrors = issues.filter((item) => item.severity === "blocking");
  const warnings = issues.filter((item) => item.severity === "warning");
  const information = issues.filter((item) => item.severity === "information");
  return {
    valid: blockingErrors.length === 0,
    areaSqKm,
    centroid,
    issues,
    blockingErrors,
    warnings,
    information,
  };
}

export function comparePolygonVersions(fromGeometry: any, toGeometry: any, populations?: { from?: number | null; to?: number | null }) {
  const from = asPolygonFeature(fromGeometry);
  const to = asPolygonFeature(toGeometry);
  if (!from || !to) throw new Error("Both versions must contain valid polygon geometry.");

  const fromAreaSqKm = turf.area(from) / 1_000_000;
  const toAreaSqKm = turf.area(to) / 1_000_000;
  const intersection = turf.intersect(turf.featureCollection([from as any, to as any]));
  const added = turf.difference(turf.featureCollection([to as any, from as any]));
  const removed = turf.difference(turf.featureCollection([from as any, to as any]));
  const fromPopulation = Number(populations?.from || 0);
  const toPopulation = Number(populations?.to || 0);

  return {
    fromAreaSqKm,
    toAreaSqKm,
    areaDifferenceSqKm: toAreaSqKm - fromAreaSqKm,
    areaChangePercent: fromAreaSqKm > 0 ? ((toAreaSqKm - fromAreaSqKm) / fromAreaSqKm) * 100 : null,
    fromPopulation,
    toPopulation,
    populationDifference: toPopulation - fromPopulation,
    intersectionGeometry: intersection,
    addedGeometry: added,
    removedGeometry: removed,
  };
}
