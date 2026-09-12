export type PopulationRatios = {
  under1: number; // 0–11 months (Infants)
  secondYearOfLife: number; // 12–23 months (2YL)
  children24to59m: number; // 24–59 months (Under 5)
  under5: number; // Total under 5 (0–59 months)
  girls9to14: number; // Girls 9–14 years (HPV)
  pregnant: number; // Pregnant women (Td)
  female: number;
};

function ratio(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 1 ? number : fallback;
}

/** Resolve one stable set of country proportions for population planning. */
export function populationRatios(settings: unknown): PopulationRatios {
  const demographics = (settings as any)?.demographics ?? settings ?? {};
  const under1 = ratio(demographics.under1 ?? demographics.infants0to11m, 0.04);
  const secondYearOfLife = ratio(demographics.secondYearOfLife ?? demographics.children12to23m, 0.038);
  const children24to59m = ratio(demographics.children24to59m, 0.115);
  const defaultUnder5 = Math.min(under1 + secondYearOfLife + children24to59m, 0.25);
  const under5 = Math.max(under1, ratio(demographics.under5, defaultUnder5));
  const girls9to14 = ratio(demographics.girls9to14 ?? demographics.girls9to14y, 0.065);
  const pregnant = ratio(demographics.pregnant ?? demographics.pregnantWomen, 0.045);
  const female = ratio(demographics.female, 0.50);

  return {
    under1,
    secondYearOfLife,
    children24to59m,
    under5,
    girls9to14,
    pregnant,
    female,
  };
}

/** Derive cohorts from the extracted total, never from independently changing totals. */
export function disaggregatePopulation(totalValue: unknown, ratios: PopulationRatios) {
  const parsed = Number(totalValue);
  const totalPopulation = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
  const femalePopulation = Math.min(totalPopulation, Math.round(totalPopulation * ratios.female));
  const under1Population = Math.min(totalPopulation, Math.round(totalPopulation * ratios.under1));
  const secondYearOfLifePopulation = Math.min(totalPopulation, Math.round(totalPopulation * (ratios.secondYearOfLife ?? 0.038)));
  const children24to59m = Math.min(totalPopulation, Math.round(totalPopulation * (ratios.children24to59m ?? 0.115)));
  const under5Population = Math.min(totalPopulation, Math.max(under1Population, Math.round(totalPopulation * ratios.under5)));
  const girls9to14Population = Math.min(totalPopulation, Math.round(totalPopulation * (ratios.girls9to14 ?? 0.065)));
  const pregnantWomen = Math.min(totalPopulation, Math.round(totalPopulation * ratios.pregnant));

  return {
    totalPopulation,
    // Exact standard breakdown:
    under1Population, // 0–11 months (Infants)
    infants0to11m: under1Population,
    secondYearOfLifePopulation, // 12–23 months (2YL)
    children12to23m: secondYearOfLifePopulation,
    children24to59m, // 24–59 months (Under 5)
    under5Population, // Total under 5 (0–59 months)
    girls9to14Population, // Girls 9–14 years (HPV)
    girls9to14: girls9to14Population,
    pregnantWomen, // Pregnant women (Td)
    femalePopulation,
    malePopulation: totalPopulation - femalePopulation,
  };
}
