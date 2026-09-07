export function riskNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function assessmentMapRow(row: any) {
  return {
    districtId: Number(row.districtId ?? row.administrativeAreaId ?? row.id),
    districtName: row.districtName || row.areaName || row.name || 'Unknown district',
    provinceId: row.provinceId ?? null,
    provinceName: row.provinceName || 'National',
    population: riskNumber(row.population) ?? 0,
    targetUnder1: riskNumber(row.targetUnder1) ?? 0,
    mcv1Coverage: riskNumber(row.mcv1Coverage),
    mcv2Coverage: riskNumber(row.mcv2Coverage),
    penta1Coverage: riskNumber(row.penta1Coverage),
    dropoutRate: riskNumber(row.dropoutRate),
    mcvDropout: riskNumber(row.mcvDropout),
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
