export function riskNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function riskMean(values: unknown[]): number | null {
  const numbers = values.map(riskNumber).filter((value): value is number => value !== null);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
}

function percentageDropout(start: number | null, end: number | null): number | null {
  return start !== null && start > 0 && end !== null ? ((start - end) / start) * 100 : null;
}

export function assessmentMapRow(row: any) {
  const mcv1Coverage = riskNumber(row.mcv1Coverage) ?? riskMean([row.mcv1YearMinus3, row.mcv1YearMinus2, row.mcv1YearMinus1]);
  const mcv2Coverage = riskNumber(row.mcv2Coverage) ?? riskMean([row.mcv2YearMinus3, row.mcv2YearMinus2, row.mcv2YearMinus1]);
  const penta1Coverage = riskNumber(row.penta1Coverage) ?? riskNumber(row.penta1YearMinus1);
  const latestMcv1Coverage = riskNumber(row.mcv1YearMinus1) ?? mcv1Coverage;

  return {
    districtId: Number(row.districtId ?? row.administrativeAreaId ?? row.id),
    districtName: row.districtName || row.areaName || row.name || 'Unknown district',
    provinceId: row.provinceId ?? null,
    provinceName: row.provinceName || 'National',
    population: riskNumber(row.population) ?? 0,
    targetUnder1: riskNumber(row.targetUnder1) ?? 0,
    mcv1Coverage,
    mcv2Coverage,
    penta1Coverage,
    dropoutRate: riskNumber(row.dropoutRate) ?? percentageDropout(penta1Coverage, latestMcv1Coverage),
    mcvDropout: riskNumber(row.mcvDropout) ?? percentageDropout(mcv1Coverage, mcv2Coverage),
    suspectedCases: riskNumber(row.suspectedCases),
    riskScore: riskNumber(row.totalRiskScore ?? row.totalScore ?? row.riskScore),
    riskCategory: row.riskCategory || 'INCOMPLETE',
    hasAssessmentRun: Boolean(row.runId || row.hasAssessmentRun),
  };
}

export function savedCoverageMetrics(indicators: Array<{indicatorCode: string; valueAnalytical: unknown; valueState: string}>) {
  const value = (code: string) => {
    const indicator = indicators.find(i => i.indicatorCode === code);
    return indicator && ['OBSERVED', 'VERIFIED_ZERO'].includes(indicator.valueState)
      ? riskNumber(indicator.valueAnalytical) : null;
  };
  return { mcv1Coverage: value('PI1'), mcv2Coverage: value('PI3'), dropoutRate: value('PD4'), mcvDropout: value('PD3') };
}
