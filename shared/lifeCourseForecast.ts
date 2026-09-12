import { z } from "zod";

export const lifeCourseForecastSchema = z.object({
  population: z.number().int().min(0).max(1_000_000_000),
  coveragePercent: z.number().min(0).max(100),
  dosesPerPerson: z.number().int().min(1).max(100),
  dosesPerVial: z.number().int().min(1).max(1000),
  wastagePercent: z.number().min(0).max(99),
  peoplePerSession: z.number().int().min(1).max(10000),
});
export function calculateLifeCourseForecast(input: z.infer<typeof lifeCourseForecastSchema>) {
  const valid = lifeCourseForecastSchema.parse(input);
  const peopleToReach = Math.ceil(valid.population * valid.coveragePercent / 100);
  const administrationDoses = peopleToReach * valid.dosesPerPerson;
  const vials = Math.ceil(administrationDoses / (1 - valid.wastagePercent / 100) / valid.dosesPerVial);
  return { peopleToReach, administrationDoses, vials, supplyDoses: vials * valid.dosesPerVial,
    minimumSessionContacts: Math.ceil(peopleToReach * valid.dosesPerPerson / valid.peoplePerSession) };
}
