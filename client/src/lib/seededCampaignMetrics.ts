export interface SeededCampaignMetricsInput {
  tenantKey: string | number;
  campaignKey: string | number;
  facilityId: string | number;
  facilityName?: string;
  targetPopulation?: number | string | null;
}

export interface SeededCampaignMetrics {
  targetPopulation: number;
  vaccinated: number;
  coveragePercent: number;
  source: "seeded_demo";
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function validPopulation(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

/**
 * Produces reproducible demo telemetry without making every facility identical.
 * Real submitted campaign totals always take precedence at the call site.
 */
export function getSeededCampaignMetrics({
  tenantKey,
  campaignKey,
  facilityId,
  facilityName = "",
  targetPopulation,
}: SeededCampaignMetricsInput): SeededCampaignMetrics {
  const facilitySeed = stableHash(`${tenantKey}|${facilityId}|${facilityName}`);
  const campaignSeed = stableHash(`${tenantKey}|${campaignKey}|${facilityId}|${facilityName}`);

  const suppliedTarget = validPopulation(targetPopulation);
  // 900–6,000 people, rounded to a reporting-friendly multiple of 10.
  const seededTarget = Math.round((900 + (facilitySeed % 5_101)) / 10) * 10;
  const target = suppliedTarget ?? seededTarget;

  // Exercise all WHO SIA bands (critical, substantial lag, near target, target met).
  const coverage = 42 + (campaignSeed % 55); // 42–96%
  const vaccinated = Math.min(target, Math.round(target * (coverage / 100)));
  const coveragePercent = Number(((vaccinated / target) * 100).toFixed(1));

  return {
    targetPopulation: target,
    vaccinated,
    coveragePercent,
    source: "seeded_demo",
  };
}
