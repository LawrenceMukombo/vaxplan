import { describe, expect, it } from 'vitest';
import { assessmentMapRow } from '../../shared/riskPresentation';

describe('assessmentMapRow', () => {
  it('derives report map metrics from saved annual district inputs', () => {
    const row = assessmentMapRow({
      districtId: 7,
      districtName: 'Example',
      mcv1YearMinus3: 72,
      mcv1YearMinus2: 78,
      mcv1YearMinus1: 84,
      mcv2YearMinus3: 60,
      mcv2YearMinus2: 66,
      mcv2YearMinus1: 72,
      penta1YearMinus1: 90,
    });

    expect(row.mcv1Coverage).toBe(78);
    expect(row.mcv2Coverage).toBe(66);
    expect(row.penta1Coverage).toBe(90);
    expect(row.dropoutRate).toBeCloseTo(6.6667, 3);
    expect(row.mcvDropout).toBeCloseTo(15.3846, 3);
  });

  it('keeps missing indicators missing instead of manufacturing zeroes', () => {
    const row = assessmentMapRow({ districtId: 8, districtName: 'Missing' });
    expect(row.mcv1Coverage).toBeNull();
    expect(row.mcv2Coverage).toBeNull();
    expect(row.dropoutRate).toBeNull();
    expect(row.mcvDropout).toBeNull();
  });

  it('preserves explicit calculated metrics when supplied', () => {
    const row = assessmentMapRow({
      districtId: 9,
      mcv1Coverage: 91,
      mcv1YearMinus1: 50,
      dropoutRate: 3.5,
    });
    expect(row.mcv1Coverage).toBe(91);
    expect(row.dropoutRate).toBe(3.5);
  });
});
