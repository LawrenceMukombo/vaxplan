/**
 * Shared TypeScript types for the Reporting Engine client.
 */

export type ReportLevel = "national" | "province" | "district" | "facility";

export interface HierarchyRow {
  level: ReportLevel;
  id:   number | string;
  name: string;
  parent_id?: number | string | null;
  [key: string]: unknown;
}

export interface ReportMeta {
  generatedAt: string;
  filters: {
    year:       number | null;
    quarter:    number | null;
    provinceId: number | null;
    districtId: number | null;
    facilityId: number | null;
    provinceIds?: number[] | null;
    districtIds?: number[] | null;
    facilityIds?: number[] | null;
  };
}

export interface ReportResponse {
  success: boolean;
  data: HierarchyRow[];
  meta: ReportMeta;
}

export interface ReportFilters {
  year?:       number;
  quarter?:    number;
  provinceId?: number;
  districtId?: number;
  facilityId?: number;
  provinceIds?: number[];
  districtIds?: number[];
  facilityIds?: number[];
}


export function sanitizeReportRows(rows: HierarchyRow[], filters: Partial<ReportFilters> | ReportMeta["filters"] | null | undefined): HierarchyRow[] {
  const scope = filters || {};
  if ((scope as any).facilityIds?.length || (scope as any).districtIds?.length || (scope as any).provinceIds?.length) {
    return rows.filter((row) => row.level !== "national");
  }
  const facilityId = Number(scope.facilityId || 0);
  if (facilityId > 0) {
    return rows.filter((row) => row.level === "facility" && Number(row.id) === facilityId);
  }

  const districtId = Number(scope.districtId || 0);
  if (districtId > 0) {
    return rows.filter((row) =>
      (row.level === "district" && Number(row.id) === districtId) ||
      (row.level === "facility" && Number(row.parent_id ?? row.parentId) === districtId)
    );
  }

  const provinceId = Number(scope.provinceId || 0);
  if (provinceId > 0) {
    const districtIds = new Set(
      rows
        .filter((row) => row.level === "district" && Number(row.parent_id ?? row.parentId) === provinceId)
        .map((row) => Number(row.id))
    );
    return rows.filter((row) =>
      (row.level === "province" && Number(row.id) === provinceId) ||
      (row.level === "district" && Number(row.parent_id ?? row.parentId) === provinceId) ||
      (row.level === "facility" && districtIds.has(Number(row.parent_id ?? row.parentId)))
    );
  }

  return rows.filter((row) => row.level !== "national");
}

export function buildReportQueryString(filters: ReportFilters): string {
  const params = new URLSearchParams();
  if (filters.year)       params.set("year",       String(filters.year));
  if (filters.quarter)    params.set("quarter",    String(filters.quarter));
  if (filters.provinceId) params.set("provinceId", String(filters.provinceId));
  if (filters.districtId) params.set("districtId", String(filters.districtId));
  if (filters.facilityId) params.set("facilityId", String(filters.facilityId));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const LEVEL_INDENT: Record<ReportLevel, number> = {
  national: 0,
  province: 0,
  district: 1,
  facility: 2,
};

export const LEVEL_COLOR: Record<ReportLevel, string> = {
  national: "text-foreground font-bold",
  province: "text-blue-700 dark:text-blue-400 font-semibold",
  district: "text-green-700 dark:text-green-400 font-medium",
  facility: "text-muted-foreground font-normal",
};

export const LEVEL_BADGE: Record<ReportLevel, string> = {
  national: "bg-slate-500/10 text-muted-foreground border-border",
  province: "bg-blue-500/10 text-blue-700 border-blue-200",
  district: "bg-green-500/10 text-green-700 border-green-200",
  facility: "bg-orange-500/10 text-orange-700 border-orange-200",
};

