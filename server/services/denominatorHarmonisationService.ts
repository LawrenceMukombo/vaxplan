export type DenominatorScenarioInput = {
  microplanId: number;
  tenantId?: string;
  facilityId: number;
  selectedSource: unknown;
  parentTotalPopulation?: number;
  userId?: string | number | null;
};

export const DenominatorHarmonisationService = {
  async getActiveScenario(microplanId: number) {
    return null;
  },

  async generateScenario(input: DenominatorScenarioInput) {
    return {
      id: `scenario:${input.microplanId}:${Date.now()}`,
      microplanId: input.microplanId,
      tenantId: input.tenantId ?? null,
      facilityId: input.facilityId,
      selectedSource: input.selectedSource,
      parentTotalPopulation: input.parentTotalPopulation ?? null,
      status: "draft",
      createdBy: input.userId ?? null,
      generatedAt: new Date().toISOString(),
    };
  },
};
