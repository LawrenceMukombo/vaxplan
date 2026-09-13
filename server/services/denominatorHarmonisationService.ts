import { db } from "../db";
import { microplans, facilities, villages, populationData, tenants } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { disaggregatePopulation, populationRatios } from "../../shared/populationDisaggregation";

export type DenominatorScenarioInput = {
  microplanId: number;
  tenantId?: string;
  facilityId: number;
  selectedSource: unknown;
  parentTotalPopulation?: number;
  userId?: string | number | null;
};

export interface DenominatorSourceBreakdown {
  source: string;
  label: string;
  totalPopulation: number;
  under1Population: number;
  under5Population: number;
  pregnantWomen: number;
  confidenceScore?: number | null;
}

export interface HarmonisedDenominatorScenario {
  id: string;
  microplanId: number;
  tenantId: string | null;
  facilityId: number;
  facilityName: string;
  status: "active" | "draft";
  selectedSource: string;
  sources: DenominatorSourceBreakdown[];
  variancePercent: number;
  harmonisedTotal: number;
  cohorts: {
    under1: number;
    under5: number;
    pregnantWomen: number;
  };
  villageCount: number;
  villagesTotalPopulation: number;
  recommendedAction: string;
  generatedAt: string;
}

export const DenominatorHarmonisationService = {
  async getActiveScenario(microplanId: number): Promise<HarmonisedDenominatorScenario | null> {
    const [microplan] = await db
      .select()
      .from(microplans)
      .where(eq(microplans.id, microplanId))
      .limit(1);

    if (!microplan || !microplan.facilityId) {
      return null;
    }

    return this.generateScenario({
      microplanId,
      tenantId: microplan.tenantId || undefined,
      facilityId: microplan.facilityId,
      selectedSource: "nso",
      userId: null,
    });
  },

  async generateScenario(input: DenominatorScenarioInput): Promise<HarmonisedDenominatorScenario> {
    const [facility] = await db
      .select()
      .from(facilities)
      .where(eq(facilities.id, input.facilityId))
      .limit(1);

    const facilityName = facility?.name || `Facility #${input.facilityId}`;
    const effectiveTenantId = input.tenantId || facility?.tenantId || null;

    // Fetch tenant settings to get standard cohort demographic ratios
    let tenantSettings = {};
    if (effectiveTenantId) {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, effectiveTenantId))
        .limit(1);
      if (tenant?.settings) tenantSettings = tenant.settings;
    }
    const ratios = populationRatios(tenantSettings);

    // Fetch facility population data across all recorded sources
    const popRows = await db
      .select()
      .from(populationData)
      .where(
        and(
          eq(populationData.facilityId, input.facilityId),
          sql`${populationData.villageId} IS NULL`
        )
      );

    // Fetch community villages catchment population for comparison
    const linkedVillages = await db
      .select()
      .from(villages)
      .where(eq(villages.assignedFacilityId, input.facilityId));

    const villagesTotal = linkedVillages.reduce(
      (sum, v) => sum + (v.totalCatchmentPopulation || v.griddedPopulation || 0),
      0
    );

    const sourceMap = new Map<string, typeof popRows[0]>();
    for (const row of popRows) {
      if (!sourceMap.has(row.source) || (row.year && row.year >= (sourceMap.get(row.source)?.year || 0))) {
        sourceMap.set(row.source, row);
      }
    }

    const standardSources = [
      { key: "nso", label: "National Statistics Office (Census)" },
      { key: "worldpop", label: "WorldPop 100m High-Resolution Gridded" },
      { key: "hmis", label: "HMIS / DHIS2 Routine Annual Target" },
      { key: "community_census", label: "Community CHW Headcount Census" },
    ];

    const fallbackFacilityPop = facility?.catchmentGridPopulation || villagesTotal || 5000;

    const sources: DenominatorSourceBreakdown[] = standardSources.map((s) => {
      const row = sourceMap.get(s.key);
      const total = row?.totalPopulation || (s.key === "community_census" && villagesTotal > 0 ? villagesTotal : fallbackFacilityPop);
      const cohorts = disaggregatePopulation(total, ratios);

      return {
        source: s.key,
        label: s.label,
        totalPopulation: total,
        under1Population: row?.under1Population ?? cohorts.under1Population,
        under5Population: row?.under5Population ?? cohorts.under5Population,
        pregnantWomen: row?.pregnantWomen ?? cohorts.pregnantWomen,
        confidenceScore: row?.confidenceScore ? parseFloat(String(row.confidenceScore)) : null,
      };
    });

    const selectedSourceStr = String(input.selectedSource || "nso");
    const chosen = sources.find((s) => s.source === selectedSourceStr) || sources[0];

    // Compute maximum variance percentage across available sources
    const totals = sources.map((s) => s.totalPopulation).filter((t) => t > 0);
    const minTotal = Math.min(...totals);
    const maxTotal = Math.max(...totals);
    const variancePercent = minTotal > 0 ? Math.round(((maxTotal - minTotal) / minTotal) * 100) : 0;

    let recommendedAction = "Target denominators are consistent across sources (<10% variance).";
    if (variancePercent >= 25) {
      recommendedAction = `High variance (${variancePercent}%) between Census and Gridded estimates. Microplanning review recommended to prevent vaccine stockouts.`;
    } else if (variancePercent >= 10) {
      recommendedAction = `Moderate variance (${variancePercent}%) between sources. Validate with local CHW headcounts.`;
    }

    return {
      id: `scenario:${input.microplanId}:${selectedSourceStr}`,
      microplanId: input.microplanId,
      tenantId: effectiveTenantId,
      facilityId: input.facilityId,
      facilityName,
      status: "active",
      selectedSource: selectedSourceStr,
      sources,
      variancePercent,
      harmonisedTotal: chosen.totalPopulation,
      cohorts: {
        under1: chosen.under1Population,
        under5: chosen.under5Population,
        pregnantWomen: chosen.pregnantWomen,
      },
      villageCount: linkedVillages.length,
      villagesTotalPopulation: villagesTotal,
      recommendedAction,
      generatedAt: new Date().toISOString(),
    };
  },
};
