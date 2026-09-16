export interface WeightedReadinessItem {
  score: number;
  maxScore: number;
}

/** Convert weighted checklist points into a bounded percentage. */
export function calculateReadinessPercent(items: WeightedReadinessItem[]): number {
  const earned = items.reduce((sum, item) => {
    const score = Number(item.score);
    const maximum = Math.max(0, Number(item.maxScore) || 0);
    return sum + Math.min(maximum, Math.max(0, Number.isFinite(score) ? score : 0));
  }, 0);
  const available = items.reduce((sum, item) => sum + Math.max(0, Number(item.maxScore) || 0), 0);

  if (available === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((earned / available) * 100)));
}
