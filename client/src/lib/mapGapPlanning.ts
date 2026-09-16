export interface MapPlanningMicroplan {
  id: number | string;
  facilityId?: number | string | null;
  planType?: string | null;
  status?: string | null;
  year?: number | null;
  quarter?: number | null;
  updatedAt?: string | Date | null;
}

export function isSessionCoverageGap(
  nearestSessionDistanceKm: unknown,
  expectedExtentKm: number,
): boolean {
  const distance = Number(nearestSessionDistanceKm);
  return !Number.isFinite(distance) || distance > expectedExtentKm;
}

/** Pick the most relevant editable routine plan owned by the nearby facility. */
export function findFacilityDraftMicroplan<T extends MapPlanningMicroplan>(
  plans: T[],
  facilityId: number,
  year: number,
  quarter: number,
): T | null {
  const candidates = plans.filter((plan) => {
    const type = String(plan.planType ?? "routine").toLowerCase();
    return (
      Number(plan.facilityId) === facilityId &&
      String(plan.status ?? "draft").toLowerCase() === "draft" &&
      !type.includes("campaign") &&
      !type.includes("sia")
    );
  });

  candidates.sort((a, b) => {
    const score = (plan: T) =>
      (Number(plan.year) === year ? 2 : 0) +
      (Number(plan.quarter) === quarter ? 1 : 0);
    const scoreDiff = score(b) - score(a);
    if (scoreDiff) return scoreDiff;
    return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
  });
  return candidates[0] ?? null;
}

export function buildPointSessionPrefill(point: { lat: number; lng: number }, label = "Mapped service gap") {
  return new URLSearchParams({
    unservedName: label,
    unservedLat: String(point.lat),
    unservedLng: String(point.lng),
    prefillKind: "unserved",
    autoOpen: "1",
  });
}
