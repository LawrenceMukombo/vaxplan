/**
 * Reports.tsx
 *
 * Main Reporting Engine hub - standalone module at /reports.
 * Provides period + geo cascade filters, 8 report tabs, and export controls.
 */

import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays, ClipboardList, AlertOctagon, Target,
  Syringe, Shield, DollarSign, ClipboardCheck,
  Download, FileSpreadsheet, Filter, BarChart3, RefreshCw,
  Globe, ChevronRight, ChevronDown, MapPin, Building2, Map, Loader2,
} from "lucide-react";
import { exportToCsv, exportToExcel } from "./reports/ReportExport";
import type { ReportFilters, ReportResponse } from "./reports/types";
import { buildReportQueryString, sanitizeReportRows } from "./reports/types";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { AiCopilot } from "@/components/AiCopilot";

// Lazy-loaded sub-reports
const SessionReport         = lazy(() => import("./reports/SessionReport"));
const MicroplanReport       = lazy(() => import("./reports/MicroplanReport"));
const ZeroDoseReport        = lazy(() => import("./reports/ZeroDoseReport"));
const MissedCommunitiesReport = lazy(() => import("./reports/MissedCommunitiesReport"));
const CoverageReport        = lazy(() => import("./reports/CoverageReport"));
const HtrReport             = lazy(() => import("./reports/HtrReport"));
const BudgetReport          = lazy(() => import("./reports/BudgetReport"));
const SupervisionReport     = lazy(() => import("./reports/SupervisionReport"));

const REPORT_TABS = [
  { id: "sessions",           label: "Sessions",         shortLabel: "Sessions",    icon: CalendarDays },
  { id: "microplans",         label: "Microplans",       shortLabel: "Microplans",  icon: ClipboardList },
  { id: "zero-dose",          label: "Zero-Dose",        shortLabel: "Zero-Dose",   icon: AlertOctagon },
  { id: "missed-communities", label: "Missed Communities", shortLabel: "Missed",    icon: Target },
  { id: "coverage",           label: "Coverage",         shortLabel: "Coverage",    icon: Syringe },
  { id: "htr",                label: "Hard-to-Reach",    shortLabel: "HTR",         icon: Shield },
  { id: "budget",             label: "Budget",           shortLabel: "Budget",      icon: DollarSign },
  { id: "supervision",        label: "Supervision",      shortLabel: "Supervision", icon: ClipboardCheck },
] as const;

type TabId = typeof REPORT_TABS[number]["id"];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

interface GeoOption { id: number; name: string }

function roleListFor(user: any): string[] {
  return [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])].filter(Boolean);
}

function scopedIds(user: any, key: "provinces" | "districts" | "facilities", fallback?: unknown): number[] {
  const scope = user?.dataAccessScope || {};
  const values = Array.isArray(scope[key]) ? scope[key] : [];
  const ids = [...values, fallback]
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);
  return Array.from(new Set(ids));
}

function getLockedReportFilters(user: any): ReportFilters {
  if (user?.isPlatformAdmin === true) return {};

  const roles = roleListFor(user);
  const facilityIds = scopedIds(user, "facilities", user?.facilityId);
  const districtIds = scopedIds(user, "districts", user?.districtId);
  const provinceIds = scopedIds(user, "provinces", user?.provinceId);

  if (roles.includes("facility_clerk") || roles.includes("facility_in_charge") || facilityIds.length > 0) {
    return {
      ...(provinceIds.length === 1 ? { provinceId: provinceIds[0] } : {}),
      ...(districtIds.length === 1 ? { districtId: districtIds[0] } : {}),
      ...(facilityIds.length === 1 ? { facilityId: facilityIds[0] } : {}),
    };
  }
  if (roles.includes("district_manager") || districtIds.length > 0) {
    return {
      ...(provinceIds.length === 1 ? { provinceId: provinceIds[0] } : {}),
      ...(districtIds.length === 1 ? { districtId: districtIds[0] } : {}),
    };
  }
  if (roles.includes("provincial_coordinator") || provinceIds.length > 0) {
    return provinceIds.length === 1 ? { provinceId: provinceIds[0] } : {};
  }
  return {};
}

function hasScopedReportRole(user: any): boolean {
  if (!user || user?.isPlatformAdmin === true) return false;
  const roles = roleListFor(user);
  return roles.includes("facility_clerk") ||
    roles.includes("facility_in_charge") ||
    roles.includes("district_manager") ||
    roles.includes("provincial_coordinator") ||
    scopedIds(user, "facilities", user?.facilityId).length > 0 ||
    scopedIds(user, "districts", user?.districtId).length > 0 ||
    scopedIds(user, "provinces", user?.provinceId).length > 0;
}
function applyLockedReportFilters(filters: ReportFilters, locked: ReportFilters): ReportFilters {
  return { ...filters, ...locked };
}
function TabSkeleton() {
  return (
    <div className="space-y-4 p-2">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<TabId>("sessions");
  const [filters, setFilters] = useState<ReportFilters>({ year: CURRENT_YEAR });
  const { user } = useAuth();

  const lockedGeoFilters = useMemo(() => getLockedReportFilters(user), [user]);
  const isReportScopeLocked = useMemo(() => hasScopedReportRole(user), [user]);
  const canUseNationalOverview = !isReportScopeLocked && !lockedGeoFilters.provinceId && !lockedGeoFilters.districtId && !lockedGeoFilters.facilityId;

  useEffect(() => {
    if (!user) return;
    setFilters((prev) => applyLockedReportFilters({ ...prev, year: prev.year ?? CURRENT_YEAR }, lockedGeoFilters));
  }, [user, lockedGeoFilters]);
  // Fetch geo options for cascade filter
  const { data: provinces } = useQuery<GeoOption[]>({
    queryKey: ["/api/provinces"],
    queryFn: () => fetch("/api/provinces", { credentials: "include" }).then((r) => r.json()),
  });

  const { data: districts, isLoading: districtsLoading } = useQuery<GeoOption[]>({
    queryKey: ["/api/districts", filters.provinceId],
    queryFn: () => {
      const url = filters.provinceId
        ? `/api/districts?provinceId=${filters.provinceId}`
        : "/api/districts";
      return fetch(url, { credentials: "include" }).then((r) => r.json());
    },
    enabled: true,
  });

  const { data: facilities, isLoading: facilitiesLoading } = useQuery<GeoOption[]>({
    queryKey: ["/api/facilities", filters.districtId],
    queryFn: () => {
      const url = filters.districtId
        ? `/api/facilities?districtId=${filters.districtId}`
        : "/api/facilities";
      return fetch(url, { credentials: "include" }).then((r) => r.json());
    },
  });

  // Fetch current tab data for export
  const qs = buildReportQueryString(filters);
  const { data: exportData, isLoading: exportLoading } = useQuery<ReportResponse>({
    queryKey: [`/api/reports/${activeTab}`, qs],
    queryFn: () =>
      fetch(`/api/reports/${activeTab}${qs}`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const currentTab = REPORT_TABS.find((t) => t.id === activeTab)!;
  const scopedExportRows = sanitizeReportRows(exportData?.data ?? [], exportData?.meta?.filters ?? filters);

  const handleExportCsv = () => {
    if (!scopedExportRows.length) return;
    exportToCsv(scopedExportRows, `vaxplan_${activeTab}_${filters.year ?? "all"}`);
  };

  const handleExportExcel = async () => {
    if (!scopedExportRows.length) return;
    await exportToExcel(
      scopedExportRows,
      currentTab.label,
      `vaxplan_${activeTab}_${filters.year ?? "all"}`
    );
  };

  const setFilter = (key: keyof ReportFilters, value: number | undefined) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Cascade reset
      if (key === "provinceId") { delete next.districtId; delete next.facilityId; }
      if (key === "districtId") { delete next.facilityId; }
      return applyLockedReportFilters(next, lockedGeoFilters);
    });
  };

  const [isMobileSelectorOpen, setIsMobileSelectorOpen] = useState(false);

  const getActiveLocationLabel = () => {
    if (filters.facilityId && facilities) {
      const f = facilities.find((item) => item.id === filters.facilityId);
      return f ? f.name : "Facility Scope";
    }
    if (filters.districtId && districts) {
      const d = districts.find((item) => item.id === filters.districtId);
      return d ? d.name : "District Scope";
    }
    if (filters.provinceId && provinces) {
      const p = provinces.find((item) => item.id === filters.provinceId);
      return p ? p.name : "Province Scope";
    }
    return isReportScopeLocked ? "Assigned locations" : "National Overview";
  };

  const renderGeographicTree = () => {
    return (
      <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
        {/* National level */}
        <button
          type="button"
          disabled={!canUseNationalOverview}
          onClick={() => {
            if (canUseNationalOverview) setFilters(prev => ({ year: prev.year, quarter: prev.quarter }));
          }}
          className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border disabled:cursor-not-allowed disabled:opacity-60 ${
            canUseNationalOverview && !filters.provinceId
              ? "bg-gradient-to-r from-sky-500/15 to-indigo-500/5 text-sky-700 dark:text-sky-400 border-sky-500/20 shadow-sm"
              : "hover:bg-accent border-transparent text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-sky-500 shrink-0" />
            <span>National Overview</span>
          </div>
          {canUseNationalOverview && !filters.provinceId && (
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
          )}
        </button>

        <div className="border-t border-border/50 my-2" />

        {/* Provinces list */}
        {provinces?.map((p) => {
          const isProvSelected = filters.provinceId === p.id;
          return (
            <div key={p.id} className="space-y-1">
              {/* Province button */}
              <button
                type="button"
                onClick={() => {
                  if (isProvSelected) {
                    if (canUseNationalOverview) setFilters(prev => ({ year: prev.year, quarter: prev.quarter }));
                  } else {
                    setFilter("provinceId", p.id);
                  }
                }}
                className={`w-full flex items-center justify-between text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isProvSelected
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 shadow-sm"
                    : "hover:bg-accent/70 border border-transparent text-foreground/90"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isProvSelected ? (
                    <ChevronDown className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <Map className="h-3.5 w-3.5 text-blue-500/80 shrink-0" />
                  <span className="truncate">{p.name}</span>
                </div>
                {isProvSelected && !filters.districtId && (
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                )}
              </button>

              {/* Districts inline under active province */}
              {isProvSelected && (
                <div className="pl-4 ml-3 border-l border-border/80 space-y-1.5 pt-1 pb-2">
                  {districtsLoading ? (
                    <div className="flex items-center gap-2 pl-3 py-1 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                      <span>Loading districts...</span>
                    </div>
                  ) : districts && districts.length > 0 ? (
                    districts.map((d) => {
                      const isDistSelected = filters.districtId === d.id;
                      return (
                        <div key={d.id} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (isDistSelected) {
                                setFilter("provinceId", p.id);
                              } else {
                                setFilter("districtId", d.id);
                              }
                            }}
                            className={`w-full flex items-center justify-between text-left px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-150 ${
                              isDistSelected
                                ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                                : "hover:bg-accent/60 border border-transparent text-foreground/80"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isDistSelected ? (
                                <ChevronDown className="h-3 w-3 text-green-500 shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              <MapPin className="h-3 w-3 text-green-500/80 shrink-0" />
                              <span className="truncate">{d.name}</span>
                            </div>
                            {isDistSelected && !filters.facilityId && (
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            )}
                          </button>

                          {/* Health Facilities inline under active district */}
                          {isDistSelected && (
                            <div className="pl-4 ml-2 border-l border-border/80 space-y-1 pt-1 pb-1">
                              {facilitiesLoading ? (
                                <div className="flex items-center gap-2 pl-3 py-0.5 text-[10px] text-muted-foreground">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin text-green-500" />
                                  <span>Loading facilities...</span>
                                </div>
                              ) : facilities && facilities.length > 0 ? (
                                facilities.map((f) => {
                                  const isFacSelected = filters.facilityId === f.id;
                                  return (
                                    <button
                                      key={f.id}
                                      type="button"
                                      onClick={() => {
                                        if (isFacSelected) {
                                          setFilter("districtId", d.id);
                                        } else {
                                          setFilter("facilityId", f.id);
                                        }
                                      }}
                                      className={`w-full flex items-center justify-between text-left px-3 py-0.5 rounded text-[10px] font-normal transition-all duration-150 ${
                                        isFacSelected
                                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-medium"
                                          : "hover:bg-accent/50 border border-transparent text-muted-foreground"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <Building2 className="h-2.5 w-2.5 text-amber-500/70 shrink-0" />
                                        <span className="truncate">{f.name}</span>
                                      </div>
                                      {isFacSelected && (
                                        <span className="h-1 w-1 rounded-full bg-amber-500" />
                                      )}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="text-[10px] text-muted-foreground pl-3 italic">
                                  No facilities found
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[11px] text-muted-foreground pl-3 italic">
                      No districts found
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-20 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Reporting Engine</h1>
              <p className="text-xs text-muted-foreground">
                Aggregate &amp; cumulative - facility - district - province - national
              </p>
            </div>
          </div>

          {/* Export button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={exportLoading || !scopedExportRows.length}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                Export as Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCsv} className="gap-2">
                <Download className="h-4 w-4 text-blue-600" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Filter Bar */}
        <Card className="border-border/60 bg-card/70">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mr-1">
                <Filter className="h-4 w-4" />
                Filters
              </div>

              {/* Year */}
              <div className="flex flex-col gap-1 min-w-[100px]">
                <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Year</span>
                <Select
                  value={String(filters.year ?? "")}
                  onValueChange={(v) => setFilter("year", v === "all" ? undefined : Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quarter */}
              <div className="flex flex-col gap-1 min-w-[100px]">
                <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Quarter</span>
                <Select
                  value={String(filters.quarter ?? "all")}
                  onValueChange={(v) => setFilter("quarter", v === "all" ? undefined : Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All quarters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All quarters</SelectItem>
                    {[1, 2, 3, 4].map((q) => (
                      <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Smart Cascade dropdown location filters */}
              {provinces && provinces.length > 0 && (
                <div className="flex flex-col gap-1 min-w-[140px]">
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Province</span>
                  <Select
                    value={String(filters.provinceId ?? "all")}
                    onValueChange={(v) => setFilter("provinceId", v === "all" ? undefined : Number(v))}
                    disabled={
                      !!lockedGeoFilters.provinceId ||
                      !!lockedGeoFilters.districtId ||
                      !!lockedGeoFilters.facilityId
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="All provinces" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All provinces</SelectItem>
                      {provinces.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {districts && districts.length > 0 && (
                <div className="flex flex-col gap-1 min-w-[140px]">
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">District</span>
                  <Select
                    value={String(filters.districtId ?? "all")}
                    onValueChange={(v) => setFilter("districtId", v === "all" ? undefined : Number(v))}
                    disabled={
                      !!lockedGeoFilters.districtId ||
                      !!lockedGeoFilters.facilityId
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="All districts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All districts</SelectItem>
                      {districts.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {facilities && facilities.length > 0 && (
                <div className="flex flex-col gap-1 min-w-[160px]">
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Facility</span>
                  <Select
                    value={String(filters.facilityId ?? "all")}
                    onValueChange={(v) => setFilter("facilityId", v === "all" ? undefined : Number(v))}
                    disabled={
                      !!lockedGeoFilters.facilityId
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="All facilities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All facilities</SelectItem>
                      {facilities.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 
                EXPLANATION: Refactored geographic cascade filters from simple separate 
                horizontal dropdowns to an inline collapsible vertical tree view (Geographic Scope).
                This ensures that Province, District, and Health Facility (HF) levels render 
                immediately below each other nested when selected, providing a much clearer visual
                representation of geographic relationships and inline exploration of cascade levels.
              */}

              {/* Active Geographic Filter Breadcrumb Display */}
              <div className="hidden sm:flex flex-col gap-1 min-w-[200px] max-w-md ml-2">
                <span className="text-[10px] uppercase font-semibold tracking-wide text-primary">Active Location Scope</span>
                <div className="h-8 flex items-center px-3 rounded-md bg-primary/5 border border-primary/10 text-xs font-semibold text-primary truncate">
                  {getActiveLocationLabel()}
                </div>
              </div>

              {/* Reset button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs mt-auto"
                onClick={() => setFilters(applyLockedReportFilters({ year: CURRENT_YEAR }, lockedGeoFilters))}
              >
                <RefreshCw className="h-3 w-3" />
                Reset
              </Button>

              {/* Generated at */}
              {exportData?.meta?.generatedAt && (
                <span className="text-[10px] text-muted-foreground ml-auto mt-auto">
                  Updated {new Date(exportData.meta.generatedAt).toLocaleDateString()} {new Date(exportData.meta.generatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Two-Column Layout for Cascading Geographic Tree & Report Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left Column: Geographic Cascade Selector (Desktop View) */}
          <div className="hidden lg:block lg:col-span-1">
            <Card className="border-border/60 bg-card/70 sticky top-24">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50 text-sm font-semibold text-foreground">
                  <Globe className="h-4 w-4 text-primary" />
                  <span>Geographic Scope</span>
                </div>
                {renderGeographicTree()}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Mobile Selector & Report Tabs + Contents */}
          <div className="lg:col-span-3 space-y-6">
            {/* Mobile Geographic Selector Accordion (Mobile/Tablet View) */}
            <div className="lg:hidden">
              <Card className="border-border/60 bg-card/70">
                <CardContent className="p-3">
                  <button
                    type="button"
                    onClick={() => setIsMobileSelectorOpen(!isMobileSelectorOpen)}
                    className="w-full flex items-center justify-between text-sm font-medium p-1 text-foreground"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Globe className="h-4 w-4 text-primary shrink-0" />
                      <span className="shrink-0 text-muted-foreground">Scope:</span>
                      <span className="font-semibold text-primary truncate">{getActiveLocationLabel()}</span>
                    </div>
                    {isMobileSelectorOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {isMobileSelectorOpen && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      {renderGeographicTree()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Report Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
              <TabsList className="h-auto flex-wrap gap-1 bg-muted/40 p-1.5 rounded-xl w-full overflow-x-auto">
                {REPORT_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    id={`report-tab-${tab.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Tab contents - each tab mounts on demand; class hides inactive ones from view */}
              <div className="mt-6">
                <Suspense fallback={<TabSkeleton />}>
                  <TabsContent value="sessions"           className={activeTab !== "sessions" ? "hidden" : ""}>
                    <SessionReport filters={filters} setFilter={setFilter} />
                  </TabsContent>
                  <TabsContent value="microplans"         className={activeTab !== "microplans" ? "hidden" : ""}>
                    <MicroplanReport filters={filters} />
                  </TabsContent>
                  <TabsContent value="zero-dose"          className={activeTab !== "zero-dose" ? "hidden" : ""}>
                    <ZeroDoseReport filters={filters} setFilter={setFilter} />
                  </TabsContent>
                  <TabsContent value="missed-communities" className={activeTab !== "missed-communities" ? "hidden" : ""}>
                    <MissedCommunitiesReport filters={filters} setFilter={setFilter} />
                  </TabsContent>
                  <TabsContent value="coverage"           className={activeTab !== "coverage" ? "hidden" : ""}>
                    <CoverageReport filters={filters} setFilter={setFilter} />
                  </TabsContent>
                  <TabsContent value="htr"                className={activeTab !== "htr" ? "hidden" : ""}>
                    <HtrReport filters={filters} setFilter={setFilter} />
                  </TabsContent>
                  <TabsContent value="budget"             className={activeTab !== "budget" ? "hidden" : ""}>
                    <BudgetReport filters={filters} setFilter={setFilter} />
                  </TabsContent>
                  <TabsContent value="supervision"        className={activeTab !== "supervision" ? "hidden" : ""}>
                    <SupervisionReport filters={filters} setFilter={setFilter} />
                  </TabsContent>
                </Suspense>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
      <AiCopilot />
    </div>
  );
}







