/**
 * AI Predictive Stock Logistics Engine
 *
 * Implements machine learning regression and WHO EPI cold chain logistics formulas
 * to predict vaccine stock consumption, model campaign demand spikes, evaluate
 * refrigerator volumetric limits, and calculate stockout probability before outreach sessions begin.
 */

export interface VaccineAntigenSpec {
  antigen: string;
  dosesPerVial: number;
  cm3PerDose: number; // Packed volume per dose in cm3 (WHO PQS standard)
  bufferMultiplier: number; // e.g., 1.25 for 25% safety stock
  minLeadTimeDays: number; // Standard supply lead time
  maxLeadTimeDays: number;
}

export const WHO_PQS_ANTIGEN_SPECS: Record<string, VaccineAntigenSpec> = {
  BCG: { antigen: "BCG", dosesPerVial: 20, cm3PerDose: 1.2, bufferMultiplier: 1.25, minLeadTimeDays: 14, maxLeadTimeDays: 28 },
  OPV: { antigen: "OPV", dosesPerVial: 10, cm3PerDose: 1.5, bufferMultiplier: 1.20, minLeadTimeDays: 14, maxLeadTimeDays: 28 },
  PENTA: { antigen: "PENTA", dosesPerVial: 10, cm3PerDose: 3.5, bufferMultiplier: 1.15, minLeadTimeDays: 14, maxLeadTimeDays: 30 },
  PCV: { antigen: "PCV", dosesPerVial: 4, cm3PerDose: 4.8, bufferMultiplier: 1.20, minLeadTimeDays: 14, maxLeadTimeDays: 30 },
  ROTA: { antigen: "ROTA", dosesPerVial: 1, cm3PerDose: 17.5, bufferMultiplier: 1.15, minLeadTimeDays: 14, maxLeadTimeDays: 30 },
  MR: { antigen: "MR", dosesPerVial: 10, cm3PerDose: 2.8, bufferMultiplier: 1.20, minLeadTimeDays: 14, maxLeadTimeDays: 28 },
  HPV: { antigen: "HPV", dosesPerVial: 2, cm3PerDose: 5.2, bufferMultiplier: 1.15, minLeadTimeDays: 21, maxLeadTimeDays: 45 },
  COVID19: { antigen: "COVID19", dosesPerVial: 6, cm3PerDose: 3.0, bufferMultiplier: 1.10, minLeadTimeDays: 14, maxLeadTimeDays: 21 },
};

export interface HistoricalConsumptionPoint {
  date: string; // ISO date YYYY-MM-DD
  dosesAdministered: number;
  isOutreachSession?: boolean;
}

export interface PlannedOutreachEvent {
  id: number;
  name: string;
  scheduledDate: string; // YYYY-MM-DD
  targetChildren: number;
  antigensTargeted: string[];
}

export interface FacilityColdChainAsset {
  id: number;
  model: string;
  netVaccineStorageLiters: number;
  grossVolumeLiters: number;
  temperatureOk: boolean;
}

export interface StockForecastInput {
  facilityId: number;
  facilityName: string;
  antigen: string;
  currentStockDoses: number;
  refrigerator: FacilityColdChainAsset;
  consumptionHistory: HistoricalConsumptionPoint[];
  upcomingOutreachCampaigns: PlannedOutreachEvent[];
  forecastDays?: number; // default 60
}

export interface DailyProjectionPoint {
  dayIndex: number;
  date: string;
  projectedRemainingDoses: number;
  projectedDailyBurn: number;
  isOutreachDay: boolean;
  campaignName?: string;
  volumeLitersRequired: number;
}

export interface StockoutRiskAnalysis {
  antigen: string;
  currentStockDoses: number;
  dailyBurnRateDoses: number;
  daysUntilStockout: number; // Infinity if stable
  stockoutProbabilityScore: number; // 0 to 100%
  riskLevel: "critical" | "high" | "medium" | "low" | "optimal";
  safetyStockDosesRequired: number;
  recommendedReorderQuantity: number;
  recommendedOrderDate: string;
  storageVolumeLitersCurrent: number;
  storageVolumeLitersReordered: number;
  refrigeratorCapacityLiters: number;
  capacityUtilizationPercent: number;
  capacityOverloadRisk: boolean;
  upcomingOutreachImpact: {
    campaignCount: number;
    additionalDosesDemanded: number;
    firstCampaignDate: string | null;
    stockoutBeforeCampaign: boolean;
  };
  recommendations: string[];
  trajectory: DailyProjectionPoint[];
}

/**
 * Perform least-squares linear regression over consumption points to extract
 * trend slope and baseline daily demand rate.
 */
export function calculateConsumptionTrend(history: HistoricalConsumptionPoint[]): {
  dailyBaseline: number;
  trendSlope: number;
} {
  if (!history || history.length === 0) {
    return { dailyBaseline: 15, trendSlope: 0 }; // Conservative default
  }

  const n = history.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  history.forEach((point, i) => {
    const x = i;
    const y = Math.max(0, point.dosesAdministered);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const slopeDenominator = n * sumXX - sumX * sumX;
  const slope = slopeDenominator !== 0 ? (n * sumXY - sumX * sumY) / slopeDenominator : 0;
  const intercept = (sumY - slope * sumX) / n;

  // Baseline must be positive
  const dailyBaseline = Math.max(1, Math.round(intercept + (slope * n)));
  return { dailyBaseline, trendSlope: Math.round(slope * 100) / 100 };
}

/**
 * Predict vaccine stock trajectories and evaluate multi-parameter risk
 */
export function predictVaccineStockLogistics(input: StockForecastInput): StockoutRiskAnalysis {
  const days = input.forecastDays ?? 60;
  const spec = WHO_PQS_ANTIGEN_SPECS[input.antigen.toUpperCase()] ?? {
    antigen: input.antigen,
    dosesPerVial: 10,
    cm3PerDose: 3.0,
    bufferMultiplier: 1.20,
    minLeadTimeDays: 14,
    maxLeadTimeDays: 28,
  };

  const { dailyBaseline, trendSlope } = calculateConsumptionTrend(input.consumptionHistory);

  // Map upcoming outreach campaigns impacting this antigen
  const relevantCampaigns = input.upcomingOutreachCampaigns.filter((c) =>
    !c.antigensTargeted.length || c.antigensTargeted.some((a) => a.toUpperCase() === input.antigen.toUpperCase())
  );

  const campaignDaysMap = new Map<string, { target: number; name: string }>();
  let additionalOutreachDoses = 0;
  let firstCampaignDate: string | null = null;

  relevantCampaigns.forEach((camp) => {
    const dStr = camp.scheduledDate.slice(0, 10);
    const existing = campaignDaysMap.get(dStr) || { target: 0, name: camp.name };
    existing.target += camp.targetChildren;
    campaignDaysMap.set(dStr, existing);
    additionalOutreachDoses += camp.targetChildren;
    if (!firstCampaignDate || dStr < firstCampaignDate) {
      firstCampaignDate = dStr;
    }
  });

  // Calculate safety stock according to WHO EPI guidelines:
  // Safety Stock = Daily Baseline * Lead Time * Buffer
  const safetyStockDosesRequired = Math.round(dailyBaseline * spec.minLeadTimeDays * (spec.bufferMultiplier - 1.0));
  const maxStockCapacityDoses = Math.floor((input.refrigerator.netVaccineStorageLiters * 1000) / spec.cm3PerDose);

  // Day by day simulation
  let runningDoses = input.currentStockDoses;
  let daysUntilStockout = Infinity;
  let stockoutBeforeCampaign = false;
  const trajectory: DailyProjectionPoint[] = [];

  const startDate = new Date();

  for (let d = 1; d <= days; d++) {
    const curDate = new Date(startDate);
    curDate.setDate(startDate.getDate() + d);
    const dateStr = curDate.toISOString().slice(0, 10);

    // Baseline daily demand with linear trend factor
    const routineBurn = Math.max(1, Math.round(dailyBaseline + (trendSlope * (d / 30))));
    const campaign = campaignDaysMap.get(dateStr);
    const campaignBurn = campaign ? campaign.target : 0;
    const totalDayBurn = routineBurn + campaignBurn;

    runningDoses -= totalDayBurn;

    if (runningDoses <= 0 && daysUntilStockout === Infinity) {
      daysUntilStockout = d;
      if (firstCampaignDate && dateStr <= (firstCampaignDate as string)) {
        stockoutBeforeCampaign = true;
      }
    }

    const remaining = Math.max(0, runningDoses);
    const volumeLiters = (remaining * spec.cm3PerDose) / 1000;

    trajectory.push({
      dayIndex: d,
      date: dateStr,
      projectedRemainingDoses: remaining,
      projectedDailyBurn: totalDayBurn,
      isOutreachDay: !!campaign,
      campaignName: campaign?.name,
      volumeLitersRequired: Math.round(volumeLiters * 100) / 100,
    });
  }

  // Stockout Risk Scoring (0 to 100)
  let stockoutProbabilityScore = 0;
  let riskLevel: StockoutRiskAnalysis["riskLevel"] = "optimal";

  if (daysUntilStockout <= 7 || input.currentStockDoses <= 0) {
    stockoutProbabilityScore = 98;
    riskLevel = "critical";
  } else if (daysUntilStockout <= 14) {
    stockoutProbabilityScore = 85;
    riskLevel = "critical";
  } else if (daysUntilStockout <= 25 || stockoutBeforeCampaign) {
    stockoutProbabilityScore = 68;
    riskLevel = "high";
  } else if (daysUntilStockout <= 45) {
    stockoutProbabilityScore = 42;
    riskLevel = "medium";
  } else if (daysUntilStockout <= 60) {
    stockoutProbabilityScore = 20;
    riskLevel = "low";
  } else {
    stockoutProbabilityScore = 5;
    riskLevel = "optimal";
  }

  // Reorder quantity calculation: bring back to 45 days of supply + safety stock
  const targetStock = (dailyBaseline * 45) + safetyStockDosesRequired + additionalOutreachDoses;
  const recommendedReorderQuantity = Math.max(0, targetStock - input.currentStockDoses);

  // Order timing: must arrive at least 3 days before projected safety threshold
  const daysUntilOrder = Math.max(0, Math.min(daysUntilStockout - spec.minLeadTimeDays - 3, 30));
  const orderDateObj = new Date();
  orderDateObj.setDate(orderDateObj.getDate() + (Number.isFinite(daysUntilOrder) ? daysUntilOrder : 1));
  const recommendedOrderDate = orderDateObj.toISOString().slice(0, 10);

  // Volumetric cold space metrics
  const storageVolumeLitersCurrent = Math.round(((input.currentStockDoses * spec.cm3PerDose) / 1000) * 100) / 100;
  const totalDosesAfterReorder = input.currentStockDoses + recommendedReorderQuantity;
  const storageVolumeLitersReordered = Math.round(((totalDosesAfterReorder * spec.cm3PerDose) / 1000) * 100) / 100;
  const refrigeratorCapacityLiters = input.refrigerator.netVaccineStorageLiters || 120;
  const capacityUtilizationPercent = Math.round((storageVolumeLitersReordered / refrigeratorCapacityLiters) * 100);
  const capacityOverloadRisk = capacityUtilizationPercent > 95;

  // Synthesize AI Recommendations
  const recommendations: string[] = [];

  if (riskLevel === "critical") {
    recommendations.push(
      `URGENT: ${input.antigen} stock is projected to run out in ${daysUntilStockout} days. Submit an expedited requisition for ${recommendedReorderQuantity.toLocaleString()} doses immediately.`
    );
  } else if (riskLevel === "high") {
    recommendations.push(
      `HIGH RISK: Outreach campaigns require ${additionalOutreachDoses} additional doses. Reorder ${recommendedReorderQuantity.toLocaleString()} doses before ${recommendedOrderDate} to prevent campaign cancellation.`
    );
  } else if (riskLevel === "medium") {
    recommendations.push(
      `Plan routine replenishment order of ${recommendedReorderQuantity.toLocaleString()} doses by ${recommendedOrderDate} to maintain required buffer stock (${safetyStockDosesRequired} doses).`
    );
  } else {
    recommendations.push(
      `Stock levels for ${input.antigen} are optimal. Projected buffer is sufficient for next 60+ days of routine and outreach sessions.`
    );
  }

  if (capacityOverloadRisk) {
    recommendations.push(
      `COLD CHAIN WARNING: Reordering full quantity will exceed refrigerator capacity (${capacityUtilizationPercent}% saturation). Stage delivery in two tranches or shift excess volume to district cold store.`
    );
  }

  if (!input.refrigerator.temperatureOk) {
    recommendations.push(
      `CRITICAL COLD CHAIN ALERT: Refrigerator temperature telemetry out of range (2°C - 8°C). Relocate cold-sensitive ${input.antigen} vials to cold boxes immediately.`
    );
  }

  return {
    antigen: input.antigen,
    currentStockDoses: input.currentStockDoses,
    dailyBurnRateDoses: dailyBaseline,
    daysUntilStockout: Number.isFinite(daysUntilStockout) ? daysUntilStockout : 999,
    stockoutProbabilityScore,
    riskLevel,
    safetyStockDosesRequired,
    recommendedReorderQuantity,
    recommendedOrderDate,
    storageVolumeLitersCurrent,
    storageVolumeLitersReordered,
    refrigeratorCapacityLiters,
    capacityUtilizationPercent,
    capacityOverloadRisk,
    upcomingOutreachImpact: {
      campaignCount: relevantCampaigns.length,
      additionalDosesDemanded: additionalOutreachDoses,
      firstCampaignDate,
      stockoutBeforeCampaign,
    },
    recommendations,
    trajectory,
  };
}
