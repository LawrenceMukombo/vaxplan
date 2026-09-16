import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2,
  MapPin,
  Users,
  Calendar,
  Syringe,
  DollarSign,
  TrendingUp,
  BarChart3,
  Layers,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  SlidersHorizontal,
  Eye,
  Plus,
  ShieldCheck,
  Building,
  Home,
  Briefcase,
  PieChart as PieChartIcon,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
} from "recharts";

// Interfaces matching server/services/microplanAggregationService.ts
export interface VaccineAntigenSummary {
  vaccineName: string;
  dosesRequired: number;
  dosesWithWastage: number;
  vialsRequired: number;
  targetPopulation: number;
}

export interface BudgetCategorySummary {
  category: string;
  totalCost: number;
  count: number;
}

export interface BudgetFundingSummary {
  fundingSource: string;
  totalCost: number;
  count: number;
}

export interface StaffRoleSummary {
  role: string;
  headcount: number;
  days: number;
  totalCost: number;
}

export interface MicroplanSummaryMetrics {
  totalPlans: number;
  totalFacilities: number;
  facilitiesWithPlan: number;
  facilityCoveragePct: number;
  statusCounts: {
    draft: number;
    pending: number;
    approved: number;
    locked: number;
    rejected: number;
  };
  totalTargetPopulation: number;
  totalBudget: number;
  sessions: {
    total: number;
    completed: number;
    static: number;
    outreach: number;
    mobile: number;
  };
  vaccines: {
    totalDosesRequired: number;
    totalDosesWithWastage: number;
    totalVialsRequired: number;
    byAntigen: VaccineAntigenSummary[];
  };
  budgetBreakdown: {
    byCategory: BudgetCategorySummary[];
    byFundingSource: BudgetFundingSummary[];
  };
  staffingSummary: {
    totalHeadcount: number;
    totalPersonDays: number;
    roles: StaffRoleSummary[];
  };
}

export interface ProvinceRollupRow {
  provinceId: number;
  provinceName: string;
  provinceCode: string;
  totalDistricts: number;
  totalFacilities: number;
  facilitiesWithPlan: number;
  coveragePct: number;
  totalPlans: number;
  approvedPlans: number;
  pendingPlans: number;
  draftPlans: number;
  totalTargetPopulation: number;
  totalBudget: number;
  totalSessions: number;
  totalDoses: number;
}

export interface DistrictRollupRow {
  districtId: number;
  districtName: string;
  districtCode: string;
  provinceId: number;
  provinceName: string;
  totalFacilities: number;
  facilitiesWithPlan: number;
  coveragePct: number;
  totalPlans: number;
  approvedPlans: number;
  pendingPlans: number;
  draftPlans: number;
  totalTargetPopulation: number;
  totalBudget: number;
  totalSessions: number;
  totalDoses: number;
}

export interface FacilityMicroplanRow {
  facilityId: number;
  facilityName: string;
  facilityHmisCode: string;
  facilityType: string;
  districtId: number;
  districtName: string;
  provinceName: string;
  hasPlan: boolean;
  microplanId: number | null;
  microplanName: string | null;
  planType: string | null;
  year: number | null;
  quarter: number | null;
  status: string | null;
  targetPopulation: number;
  budget: number;
  plannedSessions: number;
  completedSessions: number;
  totalDosesRequired: number;
  totalVialsRequired: number;
  submittedAt: string | null;
  updatedAt: string | null;
}

export interface MicroplanAggregateResponse {
  level: "national" | "province" | "district";
  scope: {
    provinceId?: number;
    provinceName?: string;
    districtId?: number;
    districtName?: string;
  };
  summary: MicroplanSummaryMetrics;
  provinces?: ProvinceRollupRow[];
  districts?: DistrictRollupRow[];
  facilities?: FacilityMicroplanRow[];
}

interface MicroplanRollupDashboardProps {
  initialPlanType?: "routine" | "campaign" | "all";
  onOpenPlan?: (planId: number, planType: string) => void;
}

const PALETTE = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#3b82f6", // Blue
  "#14b8a6", // Teal
  "#f97316", // Orange
];

export function MicroplanRollupDashboard({
  initialPlanType = "all",
  onOpenPlan,
}: MicroplanRollupDashboardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  // Filters
  const [planTypeFilter, setPlanTypeFilter] = useState<"routine" | "campaign" | "all">(initialPlanType);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");

  // Wouter can preserve this component while switching between the Routine and
  // SIA routes. Keep the controlled filter aligned with the active route instead
  // of treating the first mounted prop as permanent state.
  useEffect(() => {
    setPlanTypeFilter(initialPlanType);
    setDrillProvinceId(undefined);
    setDrillDistrictId(undefined);
    setCurrentPage(1);
  }, [initialPlanType]);

  // Geographic drill-down state
  const [drillProvinceId, setDrillProvinceId] = useState<number | undefined>(undefined);
  const [drillDistrictId, setDrillDistrictId] = useState<number | undefined>(undefined);

  // Table controls
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Column visibility state for tables
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    code: true,
    facilities: true,
    plans: true,
    coverage: true,
    targetPop: true,
    sessions: true,
    doses: true,
    budget: true,
    status: true,
    type: true,
    actions: true,
  });

  const toggleColumn = useCallback((colKey: string) => {
    setVisibleColumns((prev) => ({ ...prev, [colKey]: !prev[colKey] }));
  }, []);

  // Determine user geographic constraints
  const userProvinceId = (user as any)?.provinceId ? Number((user as any).provinceId) : undefined;
  const userDistrictId = (user as any)?.districtId ? Number((user as any).districtId) : undefined;
  const isDistrictScoped = Boolean(userDistrictId);
  const isProvinceScoped = Boolean(userProvinceId && !userDistrictId);

  // Active query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (planTypeFilter !== "all") params.set("planType", planTypeFilter);
    if (selectedYear !== "all") params.set("year", selectedYear);
    if (selectedQuarter !== "all") params.set("quarter", selectedQuarter);

    // Geographic selection
    const activeProvinceId = drillProvinceId ?? userProvinceId;
    const activeDistrictId = drillDistrictId ?? userDistrictId;

    if (activeProvinceId) params.set("provinceId", String(activeProvinceId));
    if (activeDistrictId) params.set("districtId", String(activeDistrictId));

    return params.toString();
  }, [planTypeFilter, selectedYear, selectedQuarter, drillProvinceId, drillDistrictId, userProvinceId, userDistrictId]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<MicroplanAggregateResponse>({
    queryKey: [
      "/api/microplans/aggregate",
      planTypeFilter,
      selectedYear,
      selectedQuarter,
      drillProvinceId ?? userProvinceId ?? null,
      drillDistrictId ?? userDistrictId ?? null,
    ],
    queryFn: async () => {
      const res = await fetch(`/api/microplans/aggregate?${queryParams}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load microplan aggregations");
      }
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Handle drill-down navigation
  const handleDrillProvince = (provinceId: number) => {
    setDrillProvinceId(provinceId);
    setDrillDistrictId(undefined);
    setCurrentPage(1);
    setSearchQuery("");
  };

  const handleDrillDistrict = (districtId: number, parentProvinceId?: number) => {
    if (parentProvinceId) setDrillProvinceId(parentProvinceId);
    setDrillDistrictId(districtId);
    setCurrentPage(1);
    setSearchQuery("");
  };

  const handleResetToNational = () => {
    if (isDistrictScoped || isProvinceScoped) return;
    setDrillProvinceId(undefined);
    setDrillDistrictId(undefined);
    setCurrentPage(1);
    setSearchQuery("");
  };

  const handleResetToProvince = () => {
    if (isDistrictScoped) return;
    setDrillDistrictId(undefined);
    setCurrentPage(1);
    setSearchQuery("");
  };

  // Sorting handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Export to Excel / CSV
  const handleExport = async () => {
    if (!data) return;
    try {
      const XLSX = await import("@e965/xlsx");
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryRows = [
        { Metric: "Aggregation Level", Value: data.level.toUpperCase() },
        { Metric: "Scope Province", Value: data.scope.provinceName || "All Provinces" },
        { Metric: "Scope District", Value: data.scope.districtName || "All Districts" },
        { Metric: "Total Microplans", Value: data.summary.totalPlans },
        { Metric: "Total Facilities", Value: data.summary.totalFacilities },
        { Metric: "Facilities with Plan", Value: data.summary.facilitiesWithPlan },
        { Metric: "Facility Coverage Rate (%)", Value: `${data.summary.facilityCoveragePct}%` },
        { Metric: "Approved Plans", Value: data.summary.statusCounts.approved },
        { Metric: "Pending Approval", Value: data.summary.statusCounts.pending },
        { Metric: "Draft Plans", Value: data.summary.statusCounts.draft },
        { Metric: "Total Target Population", Value: data.summary.totalTargetPopulation },
        { Metric: "Total Planned Sessions", Value: data.summary.sessions.total },
        { Metric: "Completed Sessions", Value: data.summary.sessions.completed },
        { Metric: "Static Sessions", Value: data.summary.sessions.static },
        { Metric: "Outreach Sessions", Value: data.summary.sessions.outreach },
        { Metric: "Mobile Sessions", Value: data.summary.sessions.mobile },
        { Metric: "Total Vaccine Doses Required", Value: data.summary.vaccines.totalDosesRequired },
        { Metric: "Total Vaccine Doses with Wastage", Value: data.summary.vaccines.totalDosesWithWastage },
        { Metric: "Total Vaccine Vials Required", Value: data.summary.vaccines.totalVialsRequired },
        { Metric: "Total Financial Budget", Value: data.summary.totalBudget },
        { Metric: "Total Staff Headcount", Value: data.summary.staffingSummary.totalHeadcount },
        { Metric: "Total Staff Person-Days", Value: data.summary.staffingSummary.totalPersonDays },
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      // Antigens breakdown sheet
      if (data.summary.vaccines.byAntigen.length > 0) {
        const wsAntigens = XLSX.utils.json_to_sheet(
          data.summary.vaccines.byAntigen.map((v) => ({
            Vaccine: v.vaccineName,
            "Target Population": v.targetPopulation,
            "Doses Required": v.dosesRequired,
            "Doses (with Wastage)": v.dosesWithWastage,
            "Vials Required": v.vialsRequired,
          }))
        );
        XLSX.utils.book_append_sheet(wb, wsAntigens, "Vaccine Requirements");
      }

      // Budget breakdown sheet
      if (data.summary.budgetBreakdown.byCategory.length > 0) {
        const wsBudget = XLSX.utils.json_to_sheet(
          data.summary.budgetBreakdown.byCategory.map((b) => ({
            Category: b.category,
            "Total Cost": b.totalCost,
            Items: b.count,
          }))
        );
        XLSX.utils.book_append_sheet(wb, wsBudget, "Budget by Category");
      }

      // Breakdown table sheet
      if (data.level === "national" && data.provinces) {
        const wsProvinces = XLSX.utils.json_to_sheet(
          data.provinces.map((p) => ({
            Province: p.provinceName,
            Code: p.provinceCode,
            "Total Districts": p.totalDistricts,
            "Total Facilities": p.totalFacilities,
            "Facilities with Plan": p.facilitiesWithPlan,
            "Coverage %": `${p.coveragePct}%`,
            "Total Plans": p.totalPlans,
            Approved: p.approvedPlans,
            Pending: p.pendingPlans,
            Draft: p.draftPlans,
            "Target Population": p.totalTargetPopulation,
            "Planned Sessions": p.totalSessions,
            "Vaccine Doses": p.totalDoses,
            "Total Budget": p.totalBudget,
          }))
        );
        XLSX.utils.book_append_sheet(wb, wsProvinces, "Provinces Rollup");
      } else if (data.level === "province" && data.districts) {
        const wsDistricts = XLSX.utils.json_to_sheet(
          data.districts.map((d) => ({
            District: d.districtName,
            Code: d.districtCode,
            Province: d.provinceName,
            "Total Facilities": d.totalFacilities,
            "Facilities with Plan": d.facilitiesWithPlan,
            "Coverage %": `${d.coveragePct}%`,
            "Total Plans": d.totalPlans,
            Approved: d.approvedPlans,
            Pending: d.pendingPlans,
            Draft: d.draftPlans,
            "Target Population": d.totalTargetPopulation,
            "Planned Sessions": d.totalSessions,
            "Vaccine Doses": d.totalDoses,
            "Total Budget": d.totalBudget,
          }))
        );
        XLSX.utils.book_append_sheet(wb, wsDistricts, "Districts Rollup");
      } else if (data.level === "district" && data.facilities) {
        const wsFacilities = XLSX.utils.json_to_sheet(
          data.facilities.map((f) => ({
            Facility: f.facilityName,
            "HMIS Code": f.facilityHmisCode,
            Type: f.facilityType,
            District: f.districtName,
            Province: f.provinceName,
            "Has Plan": f.hasPlan ? "Yes" : "No",
            "Plan Status": f.status || "None",
            "Target Population": f.targetPopulation,
            "Planned Sessions": f.plannedSessions,
            "Completed Sessions": f.completedSessions,
            "Vaccine Doses": f.totalDosesRequired,
            "Vaccine Vials": f.totalVialsRequired,
            Budget: f.budget,
            "Last Updated": f.updatedAt ? new Date(f.updatedAt).toLocaleDateString() : "",
          }))
        );
        XLSX.utils.book_append_sheet(wb, wsFacilities, "Facility Microplans");
      }

      const fileName = `Microplan_Rollup_${data.level}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Export Completed",
        description: `Exported rollup data to ${fileName}`,
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: "Could not generate spreadsheet export.",
        variant: "destructive",
      });
    }
  };

  // Prepare table rows based on active view level
  const processedTableRows = useMemo(() => {
    if (!data) return [];

    let rows: any[] = [];
    if (data.level === "national" && data.provinces) {
      rows = data.provinces.map((p) => ({
        id: p.provinceId,
        name: p.provinceName,
        code: p.provinceCode,
        totalDistricts: p.totalDistricts,
        totalFacilities: p.totalFacilities,
        facilitiesWithPlan: p.facilitiesWithPlan,
        coveragePct: p.coveragePct,
        totalPlans: p.totalPlans,
        approvedPlans: p.approvedPlans,
        pendingPlans: p.pendingPlans,
        draftPlans: p.draftPlans,
        targetPop: p.totalTargetPopulation,
        sessions: p.totalSessions,
        doses: p.totalDoses,
        budget: p.totalBudget,
        raw: p,
      }));
    } else if (data.level === "province" && data.districts) {
      rows = data.districts.map((d) => ({
        id: d.districtId,
        name: d.districtName,
        code: d.districtCode,
        provinceId: d.provinceId,
        provinceName: d.provinceName,
        totalFacilities: d.totalFacilities,
        facilitiesWithPlan: d.facilitiesWithPlan,
        coveragePct: d.coveragePct,
        totalPlans: d.totalPlans,
        approvedPlans: d.approvedPlans,
        pendingPlans: d.pendingPlans,
        draftPlans: d.draftPlans,
        targetPop: d.totalTargetPopulation,
        sessions: d.totalSessions,
        doses: d.totalDoses,
        budget: d.totalBudget,
        raw: d,
      }));
    } else if (data.level === "district" && data.facilities) {
      rows = data.facilities.map((f) => ({
        id: f.facilityId,
        name: f.facilityName,
        code: f.facilityHmisCode,
        type: f.facilityType,
        districtId: f.districtId,
        districtName: f.districtName,
        provinceName: f.provinceName,
        hasPlan: f.hasPlan,
        microplanId: f.microplanId,
        planType: f.planType,
        status: f.status,
        targetPop: f.targetPopulation,
        plannedSessions: f.plannedSessions,
        completedSessions: f.completedSessions,
        doses: f.totalDosesRequired,
        vials: f.totalVialsRequired,
        budget: f.budget,
        updatedAt: f.updatedAt,
        raw: f,
      }));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.code?.toLowerCase().includes(q) ||
          r.type?.toLowerCase().includes(q)
      );
    }

    // Sort rows
    rows.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return rows;
  }, [data, searchQuery, sortField, sortDirection]);

  // Paginated rows
  const totalTableItems = processedTableRows.length;
  const totalPages = Math.max(1, Math.ceil(totalTableItems / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedTableRows.slice(start, start + pageSize);
  }, [processedTableRows, currentPage, pageSize]);

  // Antigen Chart Data (Top 8 antigens by dose requirements)
  const antigenChartData = useMemo(() => {
    if (!data?.summary?.vaccines?.byAntigen) return [];
    return [...data.summary.vaccines.byAntigen]
      .sort((a, b) => b.dosesRequired - a.dosesRequired)
      .slice(0, 8)
      .map((a) => ({
        name: a.vaccineName,
        doses: a.dosesRequired,
        vials: a.vialsRequired,
      }));
  }, [data]);

  // Budget Category Chart Data
  const budgetCategoryData = useMemo(() => {
    if (!data?.summary?.budgetBreakdown?.byCategory) return [];
    return data.summary.budgetBreakdown.byCategory.map((b) => ({
      name: b.category,
      cost: b.totalCost,
    }));
  }, [data]);

  // Session Delivery Chart Data
  const sessionStrategyData = useMemo(() => {
    if (!data?.summary?.sessions) return [];
    const { static: stat, outreach, mobile } = data.summary.sessions;
    return [
      { name: "Fixed / Static", value: stat, color: "#6366f1" },
      { name: "Outreach", value: outreach, color: "#10b981" },
      { name: "Mobile", value: mobile, color: "#f59e0b" },
    ].filter((s) => s.value > 0);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1">
              {/* Breadcrumb navigation */}
              {!isDistrictScoped && !isProvinceScoped && (
                <>
                  <button
                    onClick={handleResetToNational}
                    className={`hover:text-foreground transition-colors flex items-center gap-1 ${
                      data?.level === "national" ? "text-indigo-600 dark:text-indigo-400 font-bold" : ""
                    }`}
                    data-testid="breadcrumb-national"
                  >
                    <Home className="h-3.5 w-3.5" />
                    National
                  </button>
                  {(data?.scope.provinceName || data?.level === "province" || data?.level === "district") && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                  )}
                </>
              )}

              {(data?.scope.provinceName || data?.level === "province" || data?.level === "district") && (
                <>
                  <button
                    onClick={handleResetToProvince}
                    disabled={isDistrictScoped}
                    className={`hover:text-foreground transition-colors flex items-center gap-1 ${
                      data?.level === "province" ? "text-indigo-600 dark:text-indigo-400 font-bold" : ""
                    } ${isDistrictScoped ? "cursor-default text-foreground" : ""}`}
                    data-testid="breadcrumb-province"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {data?.scope.provinceName || "Province"}
                  </button>
                  {data?.scope.districtName && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                  )}
                </>
              )}

              {data?.scope.districtName && (
                <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1" data-testid="breadcrumb-district">
                  <Building2 className="h-3.5 w-3.5" />
                  {data.scope.districtName} District
                </span>
              )}
            </div>

            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-500" />
              {data?.level === "district"
                ? `${data?.scope.districtName || "District"} Health Facilities Rollup`
                : data?.level === "province"
                ? `${data?.scope.provinceName || "Province"} District Rollup`
                : "National Immunization Microplan Rollup"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Consolidated totals for target populations, session logistics, antigen requirements, and financial budgets.
            </p>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Plan Type Selector */}
            <Select
              value={planTypeFilter}
              onValueChange={(val: any) => {
                setPlanTypeFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[130px] text-xs font-semibold" data-testid="select-filter-plan-type">
                <SelectValue placeholder="Plan Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="campaign">Campaigns</SelectItem>
              </SelectContent>
            </Select>

            {/* Year Selector */}
            <Select
              value={selectedYear}
              onValueChange={(val) => {
                setSelectedYear(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[100px] text-xs font-semibold" data-testid="select-filter-year">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>

            {/* Quarter Selector */}
            <Select
              value={selectedQuarter}
              onValueChange={(val) => {
                setSelectedQuarter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[110px] text-xs font-semibold" data-testid="select-filter-quarter">
                <SelectValue placeholder="Quarter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Quarters</SelectItem>
                <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 px-3 text-xs gap-1.5 rounded-lg"
              title="Refresh rollup calculations"
              data-testid="button-refresh-rollup"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-indigo-500" : ""}`} />
              Refresh
            </Button>

            {/* Export Button */}
            <Button
              variant="default"
              size="sm"
              onClick={handleExport}
              disabled={!data || isLoading}
              className="h-9 px-3.5 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm"
              data-testid="button-export-rollup"
            >
              <Download className="h-3.5 w-3.5" />
              Export Rollup
            </Button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-16 flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-200 dark:border-indigo-900 animate-pulse"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Consolidating health facility microplans, quantities, and budgets...
          </p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <Card className="border-destructive/40 bg-destructive/5 rounded-2xl">
          <CardContent className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <h3 className="text-base font-bold text-foreground">Could not load microplan aggregations</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              {(error as Error)?.message || "An unexpected error occurred while querying facility aggregations."}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="rounded-xl mt-2">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Aggregation Content */}
      {data && !isLoading && (
        <>
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            {/* Card 1: HF Plan Coverage */}
            <Card className="rounded-2xl border border-border/80 shadow-sm bg-card hover:border-indigo-500/40 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Facility Coverage</span>
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <Building className="h-4 w-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground tracking-tight" data-testid="kpi-coverage-pct">
                    {data.summary.facilityCoveragePct}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-semibold text-foreground">{data.summary.facilitiesWithPlan}</span> of {data.summary.totalFacilities} facilities
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] pt-1 border-t border-border/50">
                  <Badge variant="outline" className="px-1.5 py-0 text-emerald-600 border-emerald-500/30 bg-emerald-500/5">
                    {data.summary.statusCounts.approved} approved
                  </Badge>
                  <Badge variant="outline" className="px-1.5 py-0 text-amber-600 border-amber-500/30 bg-amber-500/5">
                    {data.summary.statusCounts.pending} pending
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Target Population */}
            <Card className="rounded-2xl border border-border/80 shadow-sm bg-card hover:border-indigo-500/40 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Target Population</span>
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground tracking-tight" data-testid="kpi-target-population">
                    {data.summary.totalTargetPopulation.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Total persons targeted
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                  Aggregated from HF catchment targets
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Planned Sessions */}
            <Card className="rounded-2xl border border-border/80 shadow-sm bg-card hover:border-indigo-500/40 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Planned Sessions</span>
                  <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                    <Calendar className="h-4 w-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground tracking-tight" data-testid="kpi-total-sessions">
                    {data.summary.sessions.total.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{data.summary.sessions.completed}</span> completed
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] pt-1 border-t border-border/50 text-muted-foreground">
                  <span>{data.summary.sessions.static} static</span> • <span>{data.summary.sessions.outreach} outreach</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Vaccine Requirements */}
            <Card className="rounded-2xl border border-border/80 shadow-sm bg-card hover:border-indigo-500/40 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Vaccine Doses</span>
                  <div className="p-1.5 bg-cyan-500/10 rounded-lg text-cyan-600 dark:text-cyan-400">
                    <Syringe className="h-4 w-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground tracking-tight" data-testid="kpi-vaccine-doses">
                    {data.summary.vaccines.totalDosesWithWastage.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-semibold text-foreground">{data.summary.vaccines.totalVialsRequired.toLocaleString()}</span> vials required
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                  {data.summary.vaccines.byAntigen.length} antigens budgeted
                </div>
              </CardContent>
            </Card>

            {/* Card 5: Total Financial Budget */}
            <Card className="rounded-2xl border border-border/80 shadow-sm bg-card hover:border-indigo-500/40 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Budget</span>
                  <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground tracking-tight" data-testid="kpi-total-budget">
                    ${data.summary.totalBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Aggregated operational costs
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                  {data.summary.budgetBreakdown.byCategory.length} cost categories
                </div>
              </CardContent>
            </Card>

            {/* Card 6: Human Resources */}
            <Card className="rounded-2xl border border-border/80 shadow-sm bg-card hover:border-indigo-500/40 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Health Workforce</span>
                  <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-400">
                    <Briefcase className="h-4 w-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground tracking-tight" data-testid="kpi-headcount">
                    {data.summary.staffingSummary.totalHeadcount.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Vaccinators & supervisors
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                  {data.summary.staffingSummary.totalPersonDays.toLocaleString()} person-days scheduled
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Visualizations Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Vaccine Doses and Vials by Antigen */}
            <Card className="lg:col-span-2 rounded-2xl border border-border/80 shadow-sm bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-indigo-500" />
                      Antigen Requirements (Top Antigens)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Total doses required (with wastage) vs. vials to be requisitioned from supply chain.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {antigenChartData.length > 0 ? (
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={antigenChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          formatter={(value: any) => [Number(value).toLocaleString(), ""]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "0.75rem",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                        <Bar dataKey="doses" name="Doses Required" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="vials" name="Vials Required" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-xs">
                    <Syringe className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    No antigen forecast data in the selected period.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chart 2: Session Delivery Strategy Distribution */}
            <Card className="rounded-2xl border border-border/80 shadow-sm bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-emerald-500" />
                  Delivery Strategy Mix
                </CardTitle>
                <CardDescription className="text-xs">
                  Proportion of Fixed / Static, Outreach, and Mobile outreach sessions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessionStrategyData.length > 0 ? (
                  <div className="h-64 w-full flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={sessionStrategyData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={3}
                        >
                          {sessionStrategyData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(val: any) => [Number(val).toLocaleString() + " sessions", ""]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "0.75rem",
                            fontSize: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs mt-2">
                      {sessionStrategyData.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                          <span className="text-muted-foreground">{entry.name}:</span>
                          <span className="font-semibold text-foreground">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-xs">
                    <Calendar className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    No session plans recorded for this scope.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Budget Breakdown Row */}
          {budgetCategoryData.length > 0 && (
            <Card className="rounded-2xl border border-border/80 shadow-sm bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-amber-500" />
                  Budget Distribution by Cost Category
                </CardTitle>
                <CardDescription className="text-xs">
                  Operational expenditure breakdown aggregated across all approved and submitted facility budgets.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
                  {budgetCategoryData.map((item, index) => (
                    <div
                      key={item.name}
                      className="p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="text-[11px] font-medium text-muted-foreground truncate uppercase tracking-wider">
                        {item.name}
                      </div>
                      <div className="text-base font-bold text-foreground mt-1">
                        ${item.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {data.summary.totalBudget > 0
                          ? `${((item.cost / data.summary.totalBudget) * 100).toFixed(1)}% of total`
                          : "0%"}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Enterprise Drill-Down Table (Rule 24 Compliant) */}
          <Card className="rounded-3xl border border-border/80 shadow-lg bg-card">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    {data.level === "national" ? (
                      <>
                        <Building2 className="h-5 w-5 text-indigo-500" />
                        Provincial Rollup & Health Facility Progress
                      </>
                    ) : data.level === "province" ? (
                      <>
                        <Building2 className="h-5 w-5 text-indigo-500" />
                        District Rollup & Performance Breakdown
                      </>
                    ) : (
                      <>
                        <Building className="h-5 w-5 text-indigo-500" />
                        Health Facility Microplans ({data.scope.districtName} District)
                      </>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {data.level === "national"
                      ? "Compare coverage and quantities across provinces. Click any province to drill down to district details."
                      : data.level === "province"
                      ? "Compare coverage and quantities across districts. Click any district to inspect facility microplans."
                      : "Detailed list of health facilities, plan statuses, populations, sessions, and vaccine requirements."}
                  </CardDescription>
                </div>

                {/* Table Filter, Column Toggle, and Page Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Search input */}
                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder={data.level === "district" ? "Search facilities..." : "Search locations..."}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-8 h-8 text-xs rounded-lg"
                      data-testid="input-search-rollup-table"
                    />
                  </div>

                  {/* Column Visibility Selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1 rounded-lg" data-testid="button-column-visibility">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuLabel className="text-xs">Toggle Columns</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.name}
                        onCheckedChange={() => toggleColumn("name")}
                      >
                        Name
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.code}
                        onCheckedChange={() => toggleColumn("code")}
                      >
                        Code
                      </DropdownMenuCheckboxItem>
                      {data.level !== "district" && (
                        <>
                          <DropdownMenuCheckboxItem
                            checked={visibleColumns.facilities}
                            onCheckedChange={() => toggleColumn("facilities")}
                          >
                            Facilities
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem
                            checked={visibleColumns.plans}
                            onCheckedChange={() => toggleColumn("plans")}
                          >
                            Submitted Plans
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem
                            checked={visibleColumns.coverage}
                            onCheckedChange={() => toggleColumn("coverage")}
                          >
                            Coverage %
                          </DropdownMenuCheckboxItem>
                        </>
                      )}
                      {data.level === "district" && (
                        <>
                          <DropdownMenuCheckboxItem
                            checked={visibleColumns.type}
                            onCheckedChange={() => toggleColumn("type")}
                          >
                            Facility Type
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem
                            checked={visibleColumns.status}
                            onCheckedChange={() => toggleColumn("status")}
                          >
                            Status
                          </DropdownMenuCheckboxItem>
                        </>
                      )}
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.targetPop}
                        onCheckedChange={() => toggleColumn("targetPop")}
                      >
                        Target Pop
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.sessions}
                        onCheckedChange={() => toggleColumn("sessions")}
                      >
                        Sessions
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.doses}
                        onCheckedChange={() => toggleColumn("doses")}
                      >
                        Vaccine Doses
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.budget}
                        onCheckedChange={() => toggleColumn("budget")}
                      >
                        Total Budget
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Page size selector */}
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => {
                      setPageSize(Number(val));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[80px] text-xs" data-testid="select-page-size">
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / page</SelectItem>
                      <SelectItem value="25">25 / page</SelectItem>
                      <SelectItem value="50">50 / page</SelectItem>
                      <SelectItem value="100">100 / page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase font-semibold text-[11px] border-y border-border/60">
                    <tr>
                      {visibleColumns.name && (
                        <th
                          className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => handleSort("name")}
                        >
                          <div className="flex items-center gap-1">
                            {data.level === "district" ? "Facility Name" : data.level === "province" ? "District" : "Province"}
                            {sortField === "name" && (sortDirection === "asc" ? "▲" : "▼")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.code && (
                        <th
                          className="px-3 py-3 cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => handleSort("code")}
                        >
                          <div className="flex items-center gap-1">
                            {data.level === "district" ? "HMIS Code" : "Code"}
                            {sortField === "code" && (sortDirection === "asc" ? "▲" : "▼")}
                          </div>
                        </th>
                      )}
                      {data.level === "district" && visibleColumns.type && (
                        <th className="px-3 py-3">Type</th>
                      )}
                      {data.level === "district" && visibleColumns.status && (
                        <th className="px-3 py-3">Plan Status</th>
                      )}
                      {data.level !== "district" && visibleColumns.facilities && (
                        <th
                          className="px-3 py-3 text-right cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => handleSort("totalFacilities")}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Total HFs
                            {sortField === "totalFacilities" && (sortDirection === "asc" ? "▲" : "▼")}
                          </div>
                        </th>
                      )}
                      {data.level !== "district" && visibleColumns.plans && (
                        <th
                          className="px-3 py-3 text-right cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => handleSort("facilitiesWithPlan")}
                        >
                          <div className="flex items-center justify-end gap-1">
                            HFs With Plan
                            {sortField === "facilitiesWithPlan" && (sortDirection === "asc" ? "▲" : "▼")}
                          </div>
                        </th>
                      )}
                      {data.level !== "district" && visibleColumns.coverage && (
                        <th
                          className="px-3 py-3 text-right cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => handleSort("coveragePct")}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Coverage %
                            {sortField === "coveragePct" && (sortDirection === "asc" ? "▲" : "▼")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.targetPop && (
                        <th
                          className="px-3 py-3 text-right cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => handleSort("targetPop")}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Target Pop
                            {sortField === "targetPop" && (sortDirection === "asc" ? "▲" : "▼")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.sessions && (
                        <th
                          className="px-3 py-3 text-right cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => handleSort("sessions")}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Sessions
                            {sortField === "sessions" && (sortDirection === "asc" ? "▲" : "▼")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.doses && (
                        <th
                          className="px-3 py-3 text-right cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => handleSort("doses")}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Vaccine Doses
                            {sortField === "doses" && (sortDirection === "asc" ? "▲" : "▼")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.budget && (
                        <th
                          className="px-3 py-3 text-right cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => handleSort("budget")}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Total Budget
                            {sortField === "budget" && (sortDirection === "asc" ? "▲" : "▼")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.actions && (
                        <th className="px-4 py-3 text-center">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {paginatedRows.length > 0 ? (
                      paginatedRows.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-muted/30 transition-colors group"
                          data-testid={`row-rollup-${row.id}`}
                        >
                          {visibleColumns.name && (
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {data.level === "national" ? (
                                <button
                                  onClick={() => handleDrillProvince(row.id)}
                                  className="text-left font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
                                  data-testid={`btn-drill-province-${row.id}`}
                                >
                                  <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                                  {row.name}
                                </button>
                              ) : data.level === "province" ? (
                                <button
                                  onClick={() => handleDrillDistrict(row.id, row.provinceId)}
                                  className="text-left font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
                                  data-testid={`btn-drill-district-${row.id}`}
                                >
                                  <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                                  {row.name}
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{row.name}</span>
                                </div>
                              )}
                            </td>
                          )}

                          {visibleColumns.code && (
                            <td className="px-3 py-3 text-muted-foreground font-mono text-[11px]">
                              {row.code || "—"}
                            </td>
                          )}

                          {data.level === "district" && visibleColumns.type && (
                            <td className="px-3 py-3 text-muted-foreground capitalize">
                              {row.type || "Health Centre"}
                            </td>
                          )}

                          {data.level === "district" && visibleColumns.status && (
                            <td className="px-3 py-3">
                              {row.hasPlan ? (
                                <Badge
                                  variant={
                                    row.status === "approved"
                                      ? "default"
                                      : row.status === "pending"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className="text-[10px] capitalize"
                                >
                                  {row.status || "Draft"}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
                                  No Plan
                                </Badge>
                              )}
                            </td>
                          )}

                          {data.level !== "district" && visibleColumns.facilities && (
                            <td className="px-3 py-3 text-right font-medium text-foreground">
                              {row.totalFacilities}
                            </td>
                          )}

                          {data.level !== "district" && visibleColumns.plans && (
                            <td className="px-3 py-3 text-right font-medium text-foreground">
                              {row.facilitiesWithPlan}
                            </td>
                          )}

                          {data.level !== "district" && visibleColumns.coverage && (
                            <td className="px-3 py-3 text-right">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  row.coveragePct >= 80
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : row.coveragePct >= 50
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {row.coveragePct}%
                              </span>
                            </td>
                          )}

                          {visibleColumns.targetPop && (
                            <td className="px-3 py-3 text-right font-medium text-foreground">
                              {row.targetPop > 0 ? row.targetPop.toLocaleString() : "—"}
                            </td>
                          )}

                          {visibleColumns.sessions && (
                            <td className="px-3 py-3 text-right font-medium text-foreground">
                              {data.level === "district"
                                ? `${row.plannedSessions || 0} (${row.completedSessions || 0} done)`
                                : row.sessions > 0
                                ? row.sessions.toLocaleString()
                                : "—"}
                            </td>
                          )}

                          {visibleColumns.doses && (
                            <td className="px-3 py-3 text-right font-medium text-foreground">
                              {row.doses > 0 ? row.doses.toLocaleString() : "—"}
                            </td>
                          )}

                          {visibleColumns.budget && (
                            <td className="px-3 py-3 text-right font-bold text-foreground">
                              {row.budget > 0
                                ? `$${row.budget.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                : "—"}
                            </td>
                          )}

                          {visibleColumns.actions && (
                            <td className="px-4 py-3 text-center">
                              {data.level === "national" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDrillProvince(row.id)}
                                  className="h-7 text-xs px-2.5 rounded-lg gap-1 font-semibold"
                                  data-testid={`btn-action-drill-province-${row.id}`}
                                >
                                  Districts
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                              ) : data.level === "province" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDrillDistrict(row.id, row.provinceId)}
                                  className="h-7 text-xs px-2.5 rounded-lg gap-1 font-semibold"
                                  data-testid={`btn-action-drill-district-${row.id}`}
                                >
                                  Facilities
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  {row.hasPlan && row.microplanId ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (onOpenPlan) {
                                          onOpenPlan(row.microplanId, row.planType || "routine");
                                        } else {
                                          setLocation(
                                            `/microplans/${
                                              row.planType?.includes("campaign") ? "campaigns" : "routine"
                                            }/${row.microplanId}`
                                          );
                                        }
                                      }}
                                      className="h-7 text-xs px-2 rounded-lg gap-1 text-indigo-600 dark:text-indigo-400 font-semibold"
                                      data-testid={`btn-view-plan-${row.facilityId}`}
                                    >
                                      <Eye className="h-3 w-3" />
                                      View Plan
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setLocation(
                                          `/microplans/routine/new?facilityId=${row.facilityId}`
                                        );
                                      }}
                                      className="h-7 text-xs px-2 rounded-lg gap-1 text-muted-foreground hover:text-foreground"
                                      data-testid={`btn-create-plan-${row.facilityId}`}
                                    >
                                      <Plus className="h-3 w-3" />
                                      Draft
                                    </Button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={12}
                          className="text-center py-10 text-muted-foreground text-xs"
                        >
                          No records match the current filters or search query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Footer */}
              {totalTableItems > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border/60 bg-muted/20 text-xs text-muted-foreground">
                  <div>
                    Showing {(currentPage - 1) * pageSize + 1} to{" "}
                    {Math.min(currentPage * pageSize, totalTableItems)} of {totalTableItems} entries
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="h-7 w-7 p-0 rounded-lg"
                      aria-label="First page"
                    >
                      <ChevronsLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-7 w-7 p-0 rounded-lg"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-2 text-xs font-semibold text-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-7 w-7 p-0 rounded-lg"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="h-7 w-7 p-0 rounded-lg"
                      aria-label="Last page"
                    >
                      <ChevronsRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
