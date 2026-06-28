import { area as turfArea, intersect as turfIntersect, booleanPointInPolygon, booleanWithin, centroid as turfCentroid, kinks as turfKinks, point as turfPoint } from "@turf/turf";

export type ReadinessSeverity = "ready" | "warning" | "blocking";

export type ReadinessItem = {
  key: string;
  label: string;
  status: ReadinessSeverity;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

export type PopulationScenario = {
  id: string;
  sourceType: string;
  sourceName: string;
  method: string;
  scenarioYear: number;
  confidence: "high" | "medium" | "low";
  status: string;
  version: string;
  totalPopulation: number;
  targetInfants: number;
  underFive: number;
  pregnantWomen: number;
  metadataSource: string;
  lastUpdated: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  dataQualityFlags: string[];
  populationRecordIds: number[];
};

const SOURCE_LABELS: Record<string, string> = {
  nso: "NSO authoritative total",
  hmis: "Imported DHIS2/HMIS denominator",
  worldpop: "WorldPop raster estimate",
  survey: "Local survey",
  community_census: "Community census",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

export function methodForSource(source: string): string {
  if (source === "worldpop") return "Spatial population estimate";
  if (source === "hmis") return "Imported programme denominator";
  if (source === "survey" || source === "community_census") return "Direct community count";
  return "Authoritative total";
}

export function confidenceFromScore(score: unknown, source: string): "high" | "medium" | "low" {
  const n = Number(score);
  if (Number.isFinite(n)) {
    if (n >= 80) return "high";
    if (n >= 50) return "medium";
    return "low";
  }
  if (source === "nso" || source === "hmis") return "high";
  if (source === "worldpop") return "medium";
  return "medium";
}

export function buildPopulationScenarios(records: any[], fallbackYear: number): PopulationScenario[] {
  const groups = new Map<string, any[]>();
  for (const record of records ?? []) {
    const source = String(record.source ?? "unknown");
    const year = Number(record.year ?? fallbackYear);
    const key = `${source}:${year}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  return Array.from(groups.entries())
    .map(([key, rows]: [string, any[]]) => {
      const first = rows[0] ?? {};
      const source = String(first.source ?? key.split(":")[0]);
      const year = Number(first.year ?? fallbackYear);
      const totalPopulation = rows.reduce((sum: number, row: any) => sum + (Number(row.totalPopulation) || 0), 0);
      const targetInfants = rows.reduce((sum: number, row: any) => sum + (Number(row.under1Population) || 0), 0);
      const underFive = rows.reduce((sum: number, row: any) => sum + (Number(row.under5Population) || 0), 0);
      const pregnantWomen = rows.reduce((sum: number, row: any) => sum + (Number(row.pregnantWomen) || 0), 0);
      const updatedDates = rows.map((row: any) => row.updatedAt || row.createdAt).filter(Boolean).map((d: any) => new Date(d));
      const latest = updatedDates.length ? new Date(Math.max(...updatedDates.map((d: Date) => d.getTime()))) : null;
      const flags: string[] = [];
      if (totalPopulation <= 0) flags.push("Population value is missing");
      if (targetInfants <= 0) flags.push("Target infants not available");
      if (rows.some((row: any) => String(row.approvalStatus ?? "draft") !== "approved")) flags.push("Some rows are not approved yet");

      return {
        id: `population:${source}:${year}`,
        sourceType: source,
        sourceName: sourceLabel(source),
        method: methodForSource(source),
        scenarioYear: year,
        confidence: confidenceFromScore(first.confidenceScore, source),
        status: rows.every((row) => String(row.approvalStatus ?? "draft") === "approved") ? "approved" : "draft",
        version: String((first.metadata as any)?.version ?? `v${year}`),
        totalPopulation,
        targetInfants: targetInfants || Math.round(totalPopulation * 0.035),
        underFive,
        pregnantWomen,
        metadataSource: sourceLabel(source),
        lastUpdated: latest ? latest.toISOString() : null,
        createdBy: first.createdByUserId ?? null,
        approvedBy: first.approvedByUserId ?? null,
        dataQualityFlags: flags,
        populationRecordIds: rows.map((row: any) => Number(row.id)).filter(Number.isFinite),
      };
    })
    .sort((a, b) => {
      const approvedRank = Number(b.status === "approved") - Number(a.status === "approved");
      if (approvedRank !== 0) return approvedRank;
      return b.scenarioYear - a.scenarioYear;
    });
}

export function summarizeReadiness(items: ReadinessItem[]) {
  const blocking = items.filter((item) => item.status === "blocking").length;
  const warning = items.filter((item) => item.status === "warning").length;
  return {
    status: blocking > 0 ? "blocking" : warning > 0 ? "warning" : "ready",
    blocking,
    warning,
    ready: items.filter((item) => item.status === "ready").length,
    total: items.length,
  };
}

export function geometryFromGeoJson(input: any): any | null {
  if (!input) return null;
  if (input.type === "Feature") return input.geometry ?? null;
  if (input.type === "Polygon" || input.type === "MultiPolygon") return input;
  return null;
}

export function featureFromGeometry(geometry: any): any {
  return { type: "Feature", properties: {}, geometry };
}

export function polygonVertexCount(geometry: any): number {
  if (!geometry) return 0;
  if (geometry.type === "Polygon") return geometry.coordinates?.[0]?.length ?? 0;
  if (geometry.type === "MultiPolygon") return geometry.coordinates?.reduce((sum: number, poly: any) => sum + (poly?.[0]?.length ?? 0), 0) ?? 0;
  return 0;
}

export function validatePolygonGeometry(geojson: any): { valid: boolean; areaSqKm: number | null; warnings: string[]; errors: string[] } {
  const geometry = geometryFromGeoJson(geojson);
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!geometry) {
    return { valid: false, areaSqKm: null, warnings, errors: ["Map area is missing or invalid."] };
  }
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
    errors.push("Map area must be a polygon.");
  }
  if (polygonVertexCount(geometry) < 4) {
    errors.push("Map area needs at least 3 valid points.");
  }
  let areaSqKm: number | null = null;
  try {
    const feature = featureFromGeometry(geometry);
    const kinked = turfKinks(feature as any);
    if ((kinked as any)?.features?.length > 0) errors.push("Map area cannot self-intersect.");
    areaSqKm = turfArea(feature) / 1_000_000;
    if (areaSqKm <= 0) errors.push("Map area is too small to use.");
    if (areaSqKm > 5000) warnings.push("Map area is unusually large. Please review before approval.");
  } catch {
    errors.push("Map area needs correction before saving.");
  }
  return { valid: errors.length === 0, areaSqKm, warnings, errors };
}

export function polygonCentroid(geojson: any): { latitude: number; longitude: number } | null {
  const geometry = geometryFromGeoJson(geojson);
  if (!geometry) return null;
  try {
    const center = turfCentroid(featureFromGeometry(geometry) as any);
    const [longitude, latitude] = center.geometry.coordinates;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

export function polygonInsidePolygon(childGeoJson: any, parentGeoJson: any): boolean | null {
  const child = geometryFromGeoJson(childGeoJson);
  const parent = geometryFromGeoJson(parentGeoJson);
  if (!child || !parent) return null;
  try {
    return booleanWithin(featureFromGeometry(child) as any, featureFromGeometry(parent) as any);
  } catch {
    return null;
  }
}

export function pointInsidePolygon(lat: unknown, lng: unknown, polygonGeoJson: any): boolean | null {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const geometry = geometryFromGeoJson(polygonGeoJson);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || !geometry) return null;
  try {
    return booleanPointInPolygon(turfPoint([lngNum, latNum]), featureFromGeometry(geometry));
  } catch {
    return null;
  }
}

export function polygonsOverlap(a: any, b: any): boolean {
  const geomA = geometryFromGeoJson(a);
  const geomB = geometryFromGeoJson(b);
  if (!geomA || !geomB) return false;
  try {
    const intersection = turfIntersect({ type: "FeatureCollection", features: [featureFromGeometry(geomA), featureFromGeometry(geomB)] } as any);
    return !!intersection && turfArea(intersection as any) > 0;
  } catch {
    return false;
  }
}

export function canOverrideDenominator(user: any): boolean {
  const roles = new Set<string>([user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])].filter(Boolean));
  return ["district_manager", "provincial_coordinator", "national_admin", "gis_specialist"].some((role) => roles.has(role));
}

export const MicroplanPrefillService = {
  async buildBundle(tenantId: string, facilityId: number, year: number, quarter: number, populationSource = "worldpop") {
    return {
      tenantId,
      facilityId,
      year,
      quarter,
      populationSource,
      facility: null,
      communities: [],
      populationScenarios: [],
      selectedScenario: null,
      readiness: summarizeReadiness([]),
      canOverrideDenominator: false,
    };
  },
};
