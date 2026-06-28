/**
 * server/routes/reports.ts
 *
 * REST API for the VaxPlan Reporting Engine.
 * All endpoints are:
 *  - GET only (read-only aggregations)
 *  - Tenant-scoped (req.user.tenantId from session)
 *  - RBAC-scoped (facilityId / districtId / provinceId derived from user role)
 *  - Cached for 2 minutes to reduce repeated DB round-trips
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { requireDbUser } from "../auth/loadDbUser";
import { requireTenant } from "../auth/tenantResolver";
import {
  getSessionReport,
  getMicroplanReport,
  getZeroDoseReport,
  getMissedCommunitiesReport,
  getCoverageReport,
  getHtrReport,
  getBudgetReport,
  getSupervisionReport,
  type ReportFilters,
} from "../services/reportingService";

export const reportsRouter = Router();

// ---------------------------------------------------------------------------
// Shared filter schema
// ---------------------------------------------------------------------------
const filterSchema = z.object({
  year:       z.coerce.number().int().min(2000).max(2100).optional(),
  quarter:    z.coerce.number().int().min(1).max(4).optional(),
  provinceId: z.coerce.number().int().positive().optional(),
  districtId: z.coerce.number().int().positive().optional(),
  facilityId: z.coerce.number().int().positive().optional(),
});

// ---------------------------------------------------------------------------
// RBAC scope enforcement
// Facility-level users can only see their own facility; district managers their
// district; provincial coordinators their province; national admin → no extra filter.
// ---------------------------------------------------------------------------
type ScopedReportFilters = ReportFilters & { denied?: boolean; scopeApplied?: boolean };

function roleListFor(user: any): string[] {
  return [
    user?.role,
    ...(Array.isArray(user?.roles) ? user.roles : []),
  ].filter(Boolean);
}

function scopedIds(user: any, key: "provinces" | "districts" | "facilities", fallback?: unknown): number[] {
  const scope = user?.dataAccessScope || {};
  const values = Array.isArray(scope[key]) ? scope[key] : [];
  const ids = [...values, fallback]
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);
  return Array.from(new Set(ids));
}

function singleId(ids: number[]): number | undefined {
  return ids.length === 1 ? ids[0] : undefined;
}

function buildScopedFilters(
  req: Request,
  query: z.infer<typeof filterSchema>
): ScopedReportFilters {
  const u = (req as any).dbUser ?? (req.user as any);
  const tenantId = req.tenantId || u?.tenantId;
  const base: ScopedReportFilters = {
    tenantId,
    year: query.year,
    quarter: query.quarter,
    provinceId: query.provinceId,
    districtId: query.districtId,
    facilityId: query.facilityId,
  };

  if (u?.isPlatformAdmin === true) return base;

  const roles = roleListFor(u);
  const facilityIds = scopedIds(u, "facilities", u?.facilityId);
  const districtIds = scopedIds(u, "districts", u?.districtId);
  const provinceIds = scopedIds(u, "provinces", u?.provinceId);
  const hasFacilityRole = roles.includes("facility_clerk") || roles.includes("facility_in_charge");
  const hasDistrictRole = roles.includes("district_manager");
  const hasProvinceRole = roles.includes("provincial_coordinator");
  const isScopedRole = hasFacilityRole || hasDistrictRole || hasProvinceRole || facilityIds.length > 0 || districtIds.length > 0 || provinceIds.length > 0;
  const isVisitingOtherTenant = !!u?.tenantId && !!tenantId && u.tenantId !== tenantId;
  if (isScopedRole && isVisitingOtherTenant) {
    return { ...base, provinceId: undefined, districtId: undefined, facilityId: undefined, denied: true, scopeApplied: true };
  }

  if (hasFacilityRole || facilityIds.length > 0) {
    if (facilityIds.length === 0) return { ...base, provinceId: undefined, districtId: undefined, facilityId: undefined, denied: true, scopeApplied: true };
    return {
      ...base,
      provinceId: undefined,
      districtId: undefined,
      facilityId: singleId(facilityIds),
      facilityIds: facilityIds.length > 1 ? facilityIds : undefined,
      scopeApplied: true,
    };
  }

  if (hasDistrictRole || districtIds.length > 0) {
    if (districtIds.length === 0) return { ...base, provinceId: undefined, districtId: undefined, facilityId: undefined, denied: true, scopeApplied: true };
    return {
      ...base,
      provinceId: undefined,
      districtId: singleId(districtIds),
      districtIds: districtIds.length > 1 ? districtIds : undefined,
      facilityId: query.facilityId,
      scopeApplied: true,
    };
  }

  if (hasProvinceRole || provinceIds.length > 0) {
    if (provinceIds.length === 0) return { ...base, provinceId: undefined, districtId: undefined, facilityId: undefined, denied: true, scopeApplied: true };
    return {
      ...base,
      provinceId: singleId(provinceIds),
      provinceIds: provinceIds.length > 1 ? provinceIds : undefined,
      districtId: query.districtId,
      facilityId: query.facilityId,
      scopeApplied: true,
    };
  }

  if (roles.includes("national_admin") || roles.includes("gis_specialist") || roles.includes("national_manager")) {
    return base;
  }

  return base;
}
// ---------------------------------------------------------------------------
// Auth guard middleware
// ---------------------------------------------------------------------------
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  next();
}

const CACHE_HEADER = "no-store, max-age=0";

function sanitizeScopedRows(rows: unknown[], filters: ScopedReportFilters): unknown[] {
  const data = Array.isArray(rows) ? rows as any[] : [];
  if (filters.denied) return [];
  if (filters.facilityIds?.length || filters.districtIds?.length || filters.provinceIds?.length) {
    return data.filter((row) => row?.level !== "national");
  }
  if (filters.facilityId) {
    const facilityId = Number(filters.facilityId);
    return data.filter((row) => row?.level === "facility" && Number(row?.id) === facilityId);
  }
  if (filters.districtId) {
    const districtId = Number(filters.districtId);
    return data.filter((row) =>
      (row?.level === "district" && Number(row?.id) === districtId) ||
      (row?.level === "facility" && Number(row?.parent_id ?? row?.parentId) === districtId)
    );
  }
  if (filters.provinceId) {
    const provinceId = Number(filters.provinceId);
    const districtIds = new Set(
      data
        .filter((row) => row?.level === "district" && Number(row?.parent_id ?? row?.parentId) === provinceId)
        .map((row) => Number(row.id))
    );
    return data.filter((row) =>
      (row?.level === "province" && Number(row?.id) === provinceId) ||
      (row?.level === "district" && Number(row?.parent_id ?? row?.parentId) === provinceId) ||
      (row?.level === "facility" && districtIds.has(Number(row?.parent_id ?? row?.parentId)))
    );
  }
  return data.filter((row) => row?.level !== "national");
}
// ---------------------------------------------------------------------------
// Generic handler factory — avoids boilerplate in each route
// ---------------------------------------------------------------------------
function makeReportHandler(
  queryFn: (filters: ReportFilters) => Promise<unknown[]>
) {
  return async (req: Request, res: Response) => {
    try {
      const parsed = filterSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: parsed.error.message });
      }

      const filters = buildScopedFilters(req, parsed.data);
      if (!filters.tenantId) {
        return res.status(400).json({ success: false, message: "No tenant context" });
      }

      const rawData = filters.denied ? [] : await queryFn(filters);
      const data = sanitizeScopedRows(rawData, filters);
      res.setHeader("Cache-Control", CACHE_HEADER);
      return res.json({
        success: true,
        data,
        meta: {
          generatedAt: new Date().toISOString(),
          scopeApplied: filters.scopeApplied === true,
          scopeDenied: filters.denied === true,
          filters: {
            year:       filters.year       ?? null,
            quarter:    filters.quarter    ?? null,
            provinceId: filters.provinceId ?? null,
            districtId: filters.districtId ?? null,
            facilityId: filters.facilityId ?? null,
            provinceIds: filters.provinceIds ?? null,
            districtIds: filters.districtIds ?? null,
            facilityIds: filters.facilityIds ?? null,
          },
        },
      });
    } catch (err: any) {
      console.error("[reports] Error:", err?.message ?? err);
      return res.status(500).json({ success: false, message: "Report generation failed" });
    }
  };
}

// ---------------------------------------------------------------------------
// Route registrations
// ---------------------------------------------------------------------------
reportsRouter.use(isAuthenticated, requireTenant, requireDbUser);

// R1 — Session Summary
reportsRouter.get("/sessions",           makeReportHandler(getSessionReport));

// R2 — Microplan Status
reportsRouter.get("/microplans",         makeReportHandler(getMicroplanReport));

// R3 — Zero-Dose Communities
reportsRouter.get("/zero-dose",          makeReportHandler(getZeroDoseReport));

// R4 — Missed Communities
reportsRouter.get("/missed-communities", makeReportHandler(getMissedCommunitiesReport));

// R5 — Vaccination Coverage
reportsRouter.get("/coverage",           makeReportHandler(getCoverageReport));

// R6 — Hard-to-Reach Status
reportsRouter.get("/htr",                makeReportHandler(getHtrReport));

// R7 — Budget & Resources
reportsRouter.get("/budget",             makeReportHandler(getBudgetReport));

// R8 — Supervision Activity
reportsRouter.get("/supervision",        makeReportHandler(getSupervisionReport));







