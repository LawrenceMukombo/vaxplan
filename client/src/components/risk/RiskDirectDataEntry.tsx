import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Calculator,
  RefreshCw,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Maximize2,
  Minimize2,
  Upload,
  Layers,
} from "lucide-react";

export interface DirectEntryRow {
  id?: string;
  districtId: number;
  districtName?: string;
  provinceId?: number | null;
  provinceName?: string | null;
  population: string | number;
  areaKm2: string | number;
  // Domain 1: Population Immunity (Sheet 4)
  mcv1YearMinus3: string | number;
  mcv1YearMinus2: string | number;
  mcv1YearMinus1: string | number;
  mcv2YearMinus3: string | number;
  mcv2YearMinus2: string | number;
  mcv2YearMinus1: string | number;
  penta1YearMinus1: string | number;
  siaCoveragePct: string | number;
  siaTargetAgeGroup: "WIDE" | "NARROW";
  siaYearsSince: number;
  unvaccinatedCasesPct: string | number;
  // Domain 2: Surveillance Quality (Sheet 5)
  suspectedCases: number;
  discardedCases: number;
  adequateInvestigationPct: string | number;
  adequateSpecimenPct: string | number;
  timelyLabResultsPct: string | number;
  // Domain 4: Threat Assessment (Sheets 7-8)
  threatCasesUnder5: number;
  threatCases5To14: number;
  threatCases15Plus: number;
  borderCaseInPastYear: boolean;
  vulnerabilities: {
    migrantOrUnderserved?: boolean;
    vaccineHesitancyOrRefusal?: boolean;
    securityOrConflictConcerns?: boolean;
    recurrentNaturalDisasters?: boolean;
    poorAccessOrTerrain?: boolean;
    inadequatePoliticalSupport?: boolean;
    highTransitHubOrBorder?: boolean;
    massGatheringsOrEvents?: boolean;
  };
}

interface Props {
  assessmentId: string;
  onCalculationSuccess?: () => void;
  onBack?: () => void;
}

// Baseline column widths (px)
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  index: 44,
  district: 180,
  province: 130,
  // PI
  mcv1Minus3: 72,
  mcv1Minus2: 72,
  mcv1Minus1: 72,
  mcv1Avg: 76,
  mcv1Rp: 52,
  neighborPct: 80,
  neighborRp: 52,
  mcv2Minus3: 72,
  mcv2Minus2: 72,
  mcv2Minus1: 72,
  mcv2Avg: 76,
  mcv2Rp: 52,
  siaCovMinus1: 76,
  siaCovRp: 52,
  siaAgeGroupMinus1: 96,
  siaAgeGroupRp: 52,
  siaYearsMinus1: 68,
  siaYearsRp: 52,
  unvacMinus3Minus1: 80,
  unvacRp: 52,
  piTotalRp: 84,
  // SQ
  population: 110,
  suspectedCases: 96,
  discardedCases: 96,
  discardedRate: 110,
  discardedRateRp: 54,
  adeqInvest: 100,
  adeqInvestRp: 54,
  adeqSpecimen: 100,
  adeqSpecimenRp: 54,
  timelyLab: 100,
  timelyLabRp: 54,
  sqTotalRp: 84,
  // PD
  pd_mcv1_avg: 90,
  pd_mcv1_trend: 105,
  pd_mcv1_rp: 54,
  pd_mcv2_avg: 90,
  pd_mcv2_trend: 105,
  pd_mcv2_rp: 54,
  pd_mcv_dropout: 110,
  pd_mcv_dropout_rp: 54,
  pd_penta_cov: 90,
  pd_penta_dropout: 110,
  pd_penta_dropout_rp: 54,
  pdTotalRp: 84,
  // TA
  threat_under5: 78,
  threat_5to14: 78,
  threat_15plus: 78,
  threat_total: 86,
  threat_inc_rp: 54,
  area_km2: 90,
  density: 90,
  density_rp: 54,
  border_case: 96,
  border_case_rp: 54,
  vuln_items: 72,
  vuln_total_rp: 84,
  taTotalRp: 88,
};

const STRETCH_COL_WIDTHS: Record<string, number> = Object.fromEntries(
  Object.entries(DEFAULT_COL_WIDTHS).map(([k, v]) => [k, Math.round(v * 1.25)])
);

// ---------------------------------------------------------------------------
// Pure Deterministic Scoring Calculations matching WHO Measles Tool V1.8
// ---------------------------------------------------------------------------

export function calcMcv1Rp(avg: number): number {
  if (isNaN(avg) || avg <= 0) return 8;
  if (avg >= 95.0) return 0;
  if (avg >= 90.0) return 2;
  if (avg >= 85.0) return 4;
  if (avg >= 80.0) return 6;
  return 8;
}

export function calcNeighborRp(pct: number): number {
  if (isNaN(pct) || pct <= 0) return 0;
  if (pct >= 75.0) return 4;
  if (pct >= 50.0) return 2;
  return 0;
}

export function calcMcv2Rp(avg: number): number {
  if (isNaN(avg) || avg <= 0) return 8;
  if (avg >= 95.0) return 0;
  if (avg >= 90.0) return 2;
  if (avg >= 85.0) return 4;
  if (avg >= 80.0) return 6;
  return 8;
}

export function calcSiaCovRp(cov: number): number {
  if (isNaN(cov) || cov <= 0) return 6;
  if (cov >= 95.0) return 0;
  if (cov >= 90.0) return 2;
  if (cov >= 85.0) return 4;
  return 6;
}

export function calcSiaAgeRp(target: string): number {
  return target === "WIDE" ? 0 : 2;
}

export function calcSiaYearsRp(years: number): number {
  if (isNaN(years) || years <= 1) return 0;
  if (years === 2) return 2;
  return 4;
}

export function calcUnvacRp(pct: number): number {
  if (isNaN(pct) || pct <= 0) return 0;
  if (pct >= 30.0) return 6;
  if (pct >= 20.0) return 4;
  if (pct >= 10.0) return 2;
  return 0;
}

export function calcDiscardedRateRp(rate: number): number {
  if (isNaN(rate) || rate <= 0) return 4;
  if (rate >= 2.0) return 0;
  if (rate >= 1.0) return 2;
  return 4;
}

export function calcStandardQualityRp(pct: number): number {
  if (isNaN(pct) || pct <= 0) return 4;
  if (pct >= 80.0) return 0;
  if (pct >= 50.0) return 2;
  return 4;
}

export function calcTrendRp(y1: number, y3: number): number {
  if (y1 >= y3) return 0; // Stable / +
  if (y3 - y1 > 10) return 4; // >10% decline
  return 2; // Minor decline
}

export function calcDropoutRp(rate: number): number {
  if (isNaN(rate)) return 0;
  return rate <= 10.0 ? 0 : 4;
}

export function calcDensityRp(density: number): number {
  if (isNaN(density) || density <= 0) return 0;
  if (density >= 1000) return 4;
  if (density >= 500) return 2;
  return 0;
}

export function calcIncidenceRp(totalCases: number, pop: number): number {
  if (isNaN(totalCases) || totalCases <= 0) return 0;
  const inc = (totalCases / Math.max(1, pop)) * 100000;
  if (inc >= 50) return 8;
  if (inc >= 20) return 6;
  if (inc >= 5) return 4;
  if (inc > 0) return 2;
  return 0;
}

export function RiskDirectDataEntry({ assessmentId, onCalculationSuccess, onBack }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeDomainTab, setActiveDomainTab] = useState<"pi" | "sq" | "pd" | "ta">("pi");
  const [searchTerm, setSearchTerm] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<string>("districtName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showAdmin1Row, setShowAdmin1Row] = useState(true);

  // Local working copy for inline editing
  const [localRows, setLocalRows] = useState<DirectEntryRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [bulkDialogField, setBulkDialogField] = useState<string | null>(null);
  const [bulkDialogTitle, setBulkDialogTitle] = useState<string>("");
  const [bulkProvinceId, setBulkProvinceId] = useState<string>("ALL");
  const [bulkValue, setBulkValue] = useState<string>("");

  // Column width management
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS);

  // Fetch direct entry data from backend
  const { data, isLoading } = useQuery<{ assessment: any; entries: DirectEntryRow[] }>({
    queryKey: [`/api/risk/assessments/${assessmentId}/direct-entry`],
    queryFn: async () => {
      return await apiRequest<any>("GET", `/api/risk/assessments/${assessmentId}/direct-entry`);
    },
  });

  // Sync loaded data to local state
  useEffect(() => {
    if (data?.entries) {
      setLocalRows(data.entries);
      setIsDirty(false);
    }
  }, [data?.entries]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ recalculate }: { recalculate: boolean }) => {
      return await apiRequest<any>("POST", `/api/risk/assessments/${assessmentId}/direct-entry`, {
        entries: localRows,
        recalculate,
      });
    },
    onSuccess: (res, vars) => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${assessmentId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${assessmentId}/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${assessmentId}/direct-entry`] });

      toast({
        title: vars.recalculate ? "Data Saved & Risk Scores Calculated" : "Draft Saved",
        description: vars.recalculate
          ? `Processed ${res.totalAreasAssessed || localRows.length} districts. High risk: ${res.distribution?.high || 0}, Very high: ${res.distribution?.veryHigh || 0}.`
          : "District entries updated in database.",
      });

      if (vars.recalculate && onCalculationSuccess) {
        onCalculationSuccess();
      }
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err.message || "Failed to update district entries.",
        variant: "destructive",
      });
    },
  });

  // Unique provinces list
  const provincesList = useMemo(() => {
    const map = new Map<string, { id?: number | null; name: string }>();
    localRows.forEach((r) => {
      if (r.provinceName) {
        map.set(r.provinceName, { id: r.provinceId, name: r.provinceName });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [localRows]);

  // Handle single cell edit
  const handleCellChange = (districtId: number, field: string, value: any) => {
    setLocalRows((prev) =>
      prev.map((r) => {
        if (r.districtId === districtId) {
          if (field.startsWith("vuln_")) {
            const vulnKey = field.replace("vuln_", "");
            return {
              ...r,
              vulnerabilities: {
                ...r.vulnerabilities,
                [vulnKey]: Boolean(value),
              },
            };
          }
          return { ...r, [field]: value };
        }
        return r;
      })
    );
    setIsDirty(true);
  };

  // Open bulk dialog (e.g. from Admin1 "Import..." link)
  const openImportDialog = (field: string, title: string, provinceId: string = "ALL") => {
    setBulkDialogField(field);
    setBulkDialogTitle(title);
    setBulkProvinceId(provinceId);
    setBulkValue("");
  };

  // Apply bulk value across districts (filtered or target province)
  const applyBulkValue = () => {
    if (!bulkDialogField) return;
    const num = Number(bulkValue);
    setLocalRows((prev) =>
      prev.map((r) => {
        if (bulkProvinceId !== "ALL") {
          const matchProv = String(r.provinceId) === String(bulkProvinceId) || r.provinceName === bulkProvinceId;
          if (!matchProv) return r;
        }
        if (bulkDialogField === "siaTargetAgeGroup") {
          return { ...r, siaTargetAgeGroup: bulkValue as any };
        }
        if (bulkDialogField.startsWith("vuln_")) {
          const vulnKey = bulkDialogField.replace("vuln_", "");
          return {
            ...r,
            vulnerabilities: {
              ...r.vulnerabilities,
              [vulnKey]: bulkValue === "true",
            },
          };
        }
        return { ...r, [bulkDialogField]: isNaN(num) ? bulkValue : num };
      })
    );
    setIsDirty(true);
    setBulkDialogField(null);
    setBulkValue("");
    toast({
      title: "Values Applied",
      description: `Updated column ${bulkDialogTitle} across ${bulkProvinceId === "ALL" ? "all districts" : "target province"}.`,
    });
  };

  // Filtered & Sorted Rows
  const filteredRows = useMemo(() => {
    return localRows.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        (r.districtName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.districtId).includes(searchTerm);
      const matchesProvince =
        provinceFilter === "ALL" || (r.provinceName || "") === provinceFilter;
      return matchesSearch && matchesProvince;
    });
  }, [localRows, searchTerm, provinceFilter]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a: any, b: any) => {
      let valA: any;
      let valB: any;

      if (sortField === "mcv1Avg") {
        valA = (Number(a.mcv1YearMinus3 || 0) + Number(a.mcv1YearMinus2 || 0) + Number(a.mcv1YearMinus1 || 0)) / 3;
        valB = (Number(b.mcv1YearMinus3 || 0) + Number(b.mcv1YearMinus2 || 0) + Number(b.mcv1YearMinus1 || 0)) / 3;
      } else if (sortField === "mcv2Avg") {
        valA = (Number(a.mcv2YearMinus3 || 0) + Number(a.mcv2YearMinus2 || 0) + Number(a.mcv2YearMinus1 || 0)) / 3;
        valB = (Number(b.mcv2YearMinus3 || 0) + Number(b.mcv2YearMinus2 || 0) + Number(b.mcv2YearMinus1 || 0)) / 3;
      } else {
        valA = a[sortField];
        valB = b[sortField];
      }

      if (valA === undefined || valA === null) return sortDirection === "asc" ? 1 : -1;
      if (valB === undefined || valB === null) return sortDirection === "asc" ? -1 : 1;

      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }
      return sortDirection === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredRows, sortField, sortDirection]);

  // Paginated Rows
  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-40 shrink-0 inline" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1 text-white shrink-0 inline font-bold" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 text-white shrink-0 inline font-bold" />
    );
  };

  // Sticky offsets for left pane
  const indexWidth = colWidths.index || 44;
  const districtWidth = colWidths.district || 180;
  const provinceWidth = colWidths.province || 130;

  // Column Resizer Handler
  const startResize = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[key] || 100;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(45, startWidth + delta);
      setColWidths((prev) => ({ ...prev, [key]: newWidth }));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div className="space-y-3 font-sans">
      {/* ==================================================================== */}
      {/* 1. WHO TOP HEADER BANNER (Faithfully mirroring WHO Tool V1.8)         */}
      {/* ==================================================================== */}
      <div className="rounded-t-lg border-x border-t overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center bg-[#195b9b] dark:bg-[#133d6b] text-white">
          {/* WHO Emblem & Branding Box */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 text-[#006699] px-4 py-2.5 border-r border-[#195b9b]/30 dark:border-slate-800 shrink-0 select-none">
            <svg className="w-10 h-10 shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="46" stroke="#0093d5" strokeWidth="3" fill="#f0f9ff" />
              <ellipse cx="50" cy="50" rx="36" ry="18" stroke="#0093d5" strokeWidth="1.5" />
              <ellipse cx="50" cy="50" rx="18" ry="36" stroke="#0093d5" strokeWidth="1.5" />
              <line x1="14" y1="50" x2="86" y2="50" stroke="#0093d5" strokeWidth="1.5" />
              <line x1="50" y1="14" x2="50" y2="86" stroke="#0093d5" strokeWidth="1.5" />
              <path d="M50 16 L50 84 M43 28 C57 32 57 40 50 44 C43 48 43 56 50 60 C57 64 57 72 50 76" stroke="#006699" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-black tracking-tight text-[#006699] dark:text-[#38bdf8] uppercase">
                World Health
              </span>
              <span className="text-[11px] font-bold tracking-tight text-[#006699] dark:text-[#38bdf8]">
                Organization
              </span>
            </div>
          </div>

          {/* Return button */}
          <div className="px-3 flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                if (onBack) onBack();
                else window.history.back();
              }}
              className="w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900/80 active:bg-slate-900 border border-white/40 flex items-center justify-center text-white transition-colors shadow-sm"
              title="Return to previous screen"
            >
              <ChevronLeft className="w-5 h-5 -ml-0.5" />
            </button>
          </div>

          {/* Title & Tool metadata */}
          <div className="flex-1 px-4 py-2 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] italic text-blue-100 font-medium tracking-wide">
                Measles Risk Assessment Tool V1.8 -
              </span>
              {isDirty && (
                <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded shadow-sm animate-pulse">
                  Unsaved Changes
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 mt-0.5">
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                {activeDomainTab === "pi" && "Population Immunity"}
                {activeDomainTab === "sq" && "Surveillance Quality"}
                {activeDomainTab === "pd" && "Programme Delivery"}
                {activeDomainTab === "ta" && "Threat Assessment & Vulnerabilities"}
              </h2>

              {/* Action button: Recalculate all */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => saveMutation.mutate({ recalculate: true })}
                  disabled={saveMutation.isPending}
                  className="h-8 px-3.5 text-xs font-bold bg-white hover:bg-slate-100 text-[#195b9b] border border-white shadow-sm transition-transform active:scale-95"
                >
                  {saveMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Recalculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-3.5 h-3.5 mr-1.5" /> Recalculate all
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Domain Selection Tabs (WHO Sheets 4, 5, 6, 7-8) */}
        <div className="bg-slate-100 dark:bg-slate-800 border-b px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
          <Tabs
            value={activeDomainTab}
            onValueChange={(v) => setActiveDomainTab(v as any)}
            className="w-auto"
          >
            <TabsList className="h-8 bg-slate-200/80 dark:bg-slate-700/80 p-0.5">
              <TabsTrigger value="pi" className="text-xs px-3 h-7 font-medium">
                Sheet 4: Pop. Immunity (40 pts)
              </TabsTrigger>
              <TabsTrigger value="sq" className="text-xs px-3 h-7 font-medium">
                Sheet 5: Surv. Quality (20 pts)
              </TabsTrigger>
              <TabsTrigger value="pd" className="text-xs px-3 h-7 font-medium">
                Sheet 6: Prog. Delivery (16 pts)
              </TabsTrigger>
              <TabsTrigger value="ta" className="text-xs px-3 h-7 font-medium">
                Sheets 7-8: Threats & Vuln (24 pts)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Quick Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdmin1Row(!showAdmin1Row)}
              className={`h-7 px-2 text-[11px] gap-1 ${showAdmin1Row ? "bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-950 dark:text-sky-200" : ""}`}
              title="Toggle WHO Admin1 Province Import Row"
            >
              <Layers className="w-3 h-3" /> {showAdmin1Row ? "Hide Admin1 Row" : "Show Admin1 Row"}
            </Button>

            <div className="flex items-center border rounded p-0.5 bg-background text-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setColWidths(STRETCH_COL_WIDTHS)}
                className="h-6 px-2 text-[11px] gap-1 font-medium"
                title="Wide columns"
              >
                <Maximize2 className="w-3 h-3 text-primary" /> Stretch
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setColWidths(DEFAULT_COL_WIDTHS)}
                className="h-6 px-2 text-[11px] gap-1 font-medium"
                title="Compact columns"
              >
                <Minimize2 className="w-3 h-3 text-muted-foreground" /> Compact
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setColWidths(DEFAULT_COL_WIDTHS)}
                className="h-6 px-1.5 text-[11px]"
                title="Reset column widths"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </Button>
            </div>

            <div className="relative w-44">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search area..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-7 h-7 text-xs bg-background"
              />
            </div>

            {provincesList.length > 0 && (
              <Select
                value={provinceFilter}
                onValueChange={(v) => {
                  setProvinceFilter(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-36 bg-background">
                  <SelectValue placeholder="All Provinces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Areas ({localRows.length})</SelectItem>
                  {provincesList.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant="outline"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ recalculate: false })}
              className="h-7 px-2.5 text-xs font-medium"
            >
              Save Draft
            </Button>

            <a
              href="/api/risk/resources/Measles_Risk_Assessment_Tool_v1.8.xlsm"
              download
              className="inline-flex items-center"
              title="Download official WHO Excel template"
            >
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
                <Download className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. TABULAR SPREADSHEET (TWO-TIER ALIGNED TABLE HEADERS)               */}
      {/* ==================================================================== */}
      <div className="border border-t-0 rounded-b-lg shadow-sm bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[620px] relative">
          <table className="w-full text-xs text-left border-collapse table-fixed">
            {/* TWO-TIER STICKY HEADER */}
            <thead className="sticky top-0 z-30 bg-[#1f4e79] text-white border-b shadow-sm font-semibold select-none text-[11px]">
              {/* LEVEL 1: GROUPED HEADERS */}
              <tr className="border-b border-blue-900/60 text-center">
                {/* FROZEN 1: # */}
                <th
                  rowSpan={2}
                  className="p-2 border-r border-blue-900/60 sticky top-0 left-0 z-40 bg-[#1f4e79] text-center cursor-pointer hover:bg-[#275d8d]"
                  style={{ width: `${indexWidth}px`, minWidth: `${indexWidth}px`, maxWidth: `${indexWidth}px` }}
                  onClick={() => handleSort("districtId")}
                >
                  <div className="flex items-center justify-center">
                    <span>#</span>
                    {getSortIcon("districtId")}
                  </div>
                </th>

                {/* FROZEN 2: AREA / DISTRICT (Admin2) */}
                <th
                  rowSpan={2}
                  className="p-2 border-r border-blue-900/60 sticky top-0 z-40 bg-[#1f4e79] text-left cursor-pointer hover:bg-[#275d8d] group/th"
                  style={{ left: `${indexWidth}px`, width: `${districtWidth}px`, minWidth: `${districtWidth}px`, maxWidth: `${districtWidth}px` }}
                  onClick={() => handleSort("districtName")}
                >
                  <div className="flex items-center justify-between pr-2">
                    <span className="font-bold">AREA / District (Admin2)</span>
                    {getSortIcon("districtName")}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/40 select-none z-50"
                    onMouseDown={(e) => startResize("district", e)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>

                {/* FROZEN 3: PROVINCE (Admin1) */}
                <th
                  rowSpan={2}
                  className="p-2 border-r-2 border-blue-950 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)] sticky top-0 z-40 bg-[#1f4e79] text-left cursor-pointer hover:bg-[#275d8d] group/th"
                  style={{ left: `${indexWidth + districtWidth}px`, width: `${provinceWidth}px`, minWidth: `${provinceWidth}px`, maxWidth: `${provinceWidth}px` }}
                  onClick={() => handleSort("provinceName")}
                >
                  <div className="flex items-center justify-between pr-2">
                    <span className="font-bold">Province (Admin1)</span>
                    {getSortIcon("provinceName")}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/40 select-none z-50"
                    onMouseDown={(e) => startResize("province", e)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>

                {/* DOMAIN 1: POPULATION IMMUNITY (SHEET 4) */}
                {activeDomainTab === "pi" && (
                  <>
                    <th colSpan={5} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Administrative MCV1 Coverage Report</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" title="WHO Indicator PI1" />
                    </th>

                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>% of neighboring districts with MCV1 &lt;80%</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" title="WHO Indicator PI2" />
                    </th>

                    <th colSpan={5} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Administrative MCV2 Coverage Report</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" title="WHO Indicator PI3" />
                    </th>

                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Subnational coverage of measles SIA</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" title="WHO Indicator PI4" />
                    </th>

                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Measles SIA target age group</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" title="WHO Indicator PI5" />
                    </th>

                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Years since last measles SIA</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" title="WHO Indicator PI6" />
                    </th>

                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>% suspected measles cases unvaccinated</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" title="WHO Indicator PI7" />
                    </th>

                    <th colSpan={1} className="p-2 border-r border-blue-900/60 bg-[#1a446c] text-white font-black text-center relative">
                      <span>SUBTOTAL RISK POINTS</span>
                    </th>
                  </>
                )}

                {/* DOMAIN 2: SURVEILLANCE QUALITY (SHEET 5) */}
                {activeDomainTab === "sq" && (
                  <>
                    <th colSpan={1} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Target Population</span>
                    </th>
                    <th colSpan={4} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Measles Surveillance Performance</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Investigation Quality (&lt;48h)</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Specimen Adequacy (&lt;28d)</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Timely Lab Results</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-blue-900/60 bg-[#1a446c] text-white font-black text-center relative">
                      <span>SUBTOTAL RISK POINTS</span>
                    </th>
                  </>
                )}

                {/* DOMAIN 3: PROGRAMME DELIVERY (SHEET 6) */}
                {activeDomainTab === "pd" && (
                  <>
                    <th colSpan={3} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>MCV1 Coverage Trajectory (Slope)</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={3} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>MCV2 Coverage Trajectory (Slope)</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>MCV1 to MCV2 Dropout</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={3} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Penta1 to MCV1 Dropout</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-blue-900/60 bg-[#1a446c] text-white font-black text-center relative">
                      <span>SUBTOTAL RISK POINTS</span>
                    </th>
                  </>
                )}

                {/* DOMAIN 4: THREAT ASSESSMENT & VULNERABILITIES (SHEETS 7-8) */}
                {activeDomainTab === "ta" && (
                  <>
                    <th colSpan={5} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Measles Case Threat & Age Profile</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={3} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Geography & Density</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Cross-Border Outbreak</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>WHO Vulnerabilities (8 factors)</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-blue-900/60 bg-[#1a446c] text-white font-black text-center relative">
                      <span>SUBTOTAL RISK POINTS</span>
                    </th>
                  </>
                )}
              </tr>

              {/* LEVEL 2: SUBHEADERS */}
              <tr className="bg-[#205b8f] text-white text-center border-b border-blue-900/80">
                {activeDomainTab === "pi" && (
                  <>
                    {/* MCV1: -3, -2, -1, Avg, RP */}
                    <th className="p-1.5 border-r border-blue-900/60 relative w-[72px]" style={{ width: `${colWidths.mcv1Minus3 || 72}px` }}>
                      <span className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-r-[5px] border-t-emerald-400 border-r-transparent" />
                      <span>-3</span>
                    </th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[72px]" style={{ width: `${colWidths.mcv1Minus2 || 72}px` }}>-2</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[72px]" style={{ width: `${colWidths.mcv1Minus1 || 72}px` }}>-1</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[76px] bg-blue-900/50" style={{ width: `${colWidths.mcv1Avg || 76}px` }}>Avg</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold relative" style={{ width: `${colWidths.mcv1Rp || 52}px` }}>
                      <span className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-r-[5px] border-t-emerald-400 border-r-transparent" />
                      <span>RP</span>
                    </th>

                    {/* Neighboring: -3--1, RP */}
                    <th className="p-1.5 border-r border-blue-900/60 w-[80px]" style={{ width: `${colWidths.neighborPct || 80}px` }}>-3--1</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold" style={{ width: `${colWidths.neighborRp || 52}px` }}>RP</th>

                    {/* MCV2: -3, -2, -1, Avg, RP */}
                    <th className="p-1.5 border-r border-blue-900/60 w-[72px]" style={{ width: `${colWidths.mcv2Minus3 || 72}px` }}>-3</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[72px]" style={{ width: `${colWidths.mcv2Minus2 || 72}px` }}>-2</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[72px]" style={{ width: `${colWidths.mcv2Minus1 || 72}px` }}>-1</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[76px] bg-blue-900/50" style={{ width: `${colWidths.mcv2Avg || 76}px` }}>Avg</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold" style={{ width: `${colWidths.mcv2Rp || 52}px` }}>RP</th>

                    {/* SIA Coverage: -1, RP */}
                    <th className="p-1.5 border-r border-blue-900/60 w-[76px] relative" style={{ width: `${colWidths.siaCovMinus1 || 76}px` }}>
                      <span className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-r-[5px] border-t-emerald-400 border-r-transparent" />
                      <span>-1</span>
                    </th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold" style={{ width: `${colWidths.siaCovRp || 52}px` }}>RP</th>

                    {/* SIA Target Age Group: -1, RP */}
                    <th className="p-1.5 border-r border-blue-900/60 w-[96px]" style={{ width: `${colWidths.siaAgeGroupMinus1 || 96}px` }}>-1</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold" style={{ width: `${colWidths.siaAgeGroupRp || 52}px` }}>RP</th>

                    {/* Years since SIA: -1, RP */}
                    <th className="p-1.5 border-r border-blue-900/60 w-[68px]" style={{ width: `${colWidths.siaYearsMinus1 || 68}px` }}>-1</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold" style={{ width: `${colWidths.siaYearsRp || 52}px` }}>RP</th>

                    {/* % Unvaccinated: -3--1, RP */}
                    <th className="p-1.5 border-r border-blue-900/60 w-[80px]" style={{ width: `${colWidths.unvacMinus3Minus1 || 80}px` }}>-3--1</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold" style={{ width: `${colWidths.unvacRp || 52}px` }}>RP</th>

                    {/* Subtotal Total RP */}
                    <th className="p-1.5 border-r border-blue-900/60 w-[84px] bg-[#1a446c] font-black" style={{ width: `${colWidths.piTotalRp || 84}px` }}>
                      Total RP
                    </th>
                  </>
                )}

                {activeDomainTab === "sq" && (
                  <>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.population || 110}px` }}>Population</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.suspectedCases || 96}px` }}>Suspected</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.discardedCases || 96}px` }}>Discarded</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-900/50" style={{ width: `${colWidths.discardedRate || 110}px` }}>Rate / 100k</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-800/80 font-bold" style={{ width: `${colWidths.discardedRateRp || 54}px` }}>RP</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.adeqInvest || 100}px` }}>% Invest.</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-800/80 font-bold" style={{ width: `${colWidths.adeqInvestRp || 54}px` }}>RP</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.adeqSpecimen || 100}px` }}>% Specimen</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-800/80 font-bold" style={{ width: `${colWidths.adeqSpecimenRp || 54}px` }}>RP</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.timelyLab || 100}px` }}>% Timely</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-800/80 font-bold" style={{ width: `${colWidths.timelyLabRp || 54}px` }}>RP</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-[#1a446c] font-black" style={{ width: `${colWidths.sqTotalRp || 84}px` }}>Total RP</th>
                  </>
                )}

                {activeDomainTab === "pd" && (
                  <>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.pd_mcv1_avg || 90}px` }}>MCV1 Avg %</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.pd_mcv1_trend || 105}px` }}>Trajectory</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-800/80 font-bold" style={{ width: `${colWidths.pd_mcv1_rp || 54}px` }}>RP</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.pd_mcv2_avg || 90}px` }}>MCV2 Avg %</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.pd_mcv2_trend || 105}px` }}>Trajectory</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-800/80 font-bold" style={{ width: `${colWidths.pd_mcv2_rp || 54}px` }}>RP</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.pd_mcv_dropout || 110}px` }}>MCV1-2 Dropout</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-800/80 font-bold" style={{ width: `${colWidths.pd_mcv_dropout_rp || 54}px` }}>RP</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.pd_penta_cov || 90}px` }}>Penta1 %</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.pd_penta_dropout || 110}px` }}>Penta-MCV1 Drop</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-800/80 font-bold" style={{ width: `${colWidths.pd_penta_dropout_rp || 54}px` }}>RP</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-[#1a446c] font-black" style={{ width: `${colWidths.pdTotalRp || 84}px` }}>Total RP</th>
                  </>
                )}

                {activeDomainTab === "ta" && (
                  <>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.threat_under5 || 78}px` }}>&lt;5y</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.threat_5to14 || 78}px` }}>5-14y</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.threat_15plus || 78}px` }}>15+y</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.threat_total || 86}px` }}>Total Cases</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-800/80 font-bold" style={{ width: `${colWidths.threat_inc_rp || 54}px` }}>RP</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.area_km2 || 90}px` }}>Area (km²)</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.density || 90}px` }}>Density</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-800/80 font-bold" style={{ width: `${colWidths.density_rp || 54}px` }}>RP</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.border_case || 96}px` }}>Border Case?</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-800/80 font-bold" style={{ width: `${colWidths.border_case_rp || 54}px` }}>RP</th>
                    <th className="p-1.5 border-r border-blue-900/60" style={{ width: `${colWidths.vuln_items || 72}px` }}>Factors (0-8)</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-blue-800/80 font-bold" style={{ width: `${colWidths.vuln_total_rp || 84}px` }}>Vuln RP</th>
                    <th className="p-1.5 border-r border-blue-900/60 bg-[#1a446c] font-black" style={{ width: `${colWidths.taTotalRp || 88}px` }}>Total RP</th>
                  </>
                )}
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-background text-foreground text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={25} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                      <span>Loading assessment records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={25} className="text-center py-12 text-muted-foreground">
                    <span>No districts matched search filter.</span>
                  </td>
                </tr>
              ) : (
                <>
                  {/* OPTIONAL ADMIN1 PROVINCE IMPORT ROW (Exact match to WHO sheet) */}
                  {showAdmin1Row && (
                    <tr className="bg-[#bdd7ee] dark:bg-blue-950/80 text-slate-900 dark:text-blue-100 font-semibold border-b-2 border-slate-300 dark:border-slate-700 select-none">
                      <td
                        className="p-2 text-center sticky left-0 z-20 bg-[#bdd7ee] dark:bg-blue-950/80 border-r border-slate-300"
                        style={{ width: `${indexWidth}px`, minWidth: `${indexWidth}px`, maxWidth: `${indexWidth}px` }}
                      >
                        <span className="italic text-[11px] text-slate-600 dark:text-slate-400">Admin1</span>
                      </td>
                      <td
                        className="p-2 italic sticky z-20 bg-[#bdd7ee] dark:bg-blue-950/80 border-r border-slate-300"
                        style={{ left: `${indexWidth}px`, width: `${districtWidth}px`, minWidth: `${districtWidth}px`, maxWidth: `${districtWidth}px` }}
                      >
                        <span className="truncate block font-bold">Admin1 Area Summary</span>
                      </td>
                      <td
                        className="p-2 italic sticky z-20 bg-[#bdd7ee] dark:bg-blue-950/80 border-r-2 border-slate-400 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]"
                        style={{ left: `${indexWidth + districtWidth}px`, width: `${provinceWidth}px`, minWidth: `${provinceWidth}px`, maxWidth: `${provinceWidth}px` }}
                      >
                        <span className="truncate block">{provinceFilter === "ALL" ? "All Provinces" : provinceFilter}</span>
                      </td>

                      {/* PI ADMIN1 ACTIONS */}
                      {activeDomainTab === "pi" && (
                        <>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("mcv1YearMinus3", "MCV1 Year -3", provinceFilter)}
                              className="text-red-700 dark:text-red-400 font-medium text-[11px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("mcv1YearMinus2", "MCV1 Year -2", provinceFilter)}
                              className="text-red-700 dark:text-red-400 font-medium text-[11px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("mcv1YearMinus1", "MCV1 Year -1", provinceFilter)}
                              className="text-red-700 dark:text-red-400 font-medium text-[11px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>

                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>

                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("mcv2YearMinus3", "MCV2 Year -3", provinceFilter)}
                              className="text-red-700 dark:text-red-400 font-medium text-[11px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("mcv2YearMinus2", "MCV2 Year -2", provinceFilter)}
                              className="text-red-700 dark:text-red-400 font-medium text-[11px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("mcv2YearMinus1", "MCV2 Year -1", provinceFilter)}
                              className="text-red-700 dark:text-red-400 font-medium text-[11px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>

                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("siaCoveragePct", "SIA Coverage", provinceFilter)}
                              className="text-red-700 dark:text-red-400 font-medium text-[11px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>

                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("siaTargetAgeGroup", "SIA Age Group", provinceFilter)}
                              className="text-red-700 dark:text-red-400 font-medium text-[11px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>

                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("siaYearsSince", "Years Since SIA", provinceFilter)}
                              className="text-red-700 dark:text-red-400 font-medium text-[11px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>

                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("unvaccinatedCasesPct", "% Unvaccinated", provinceFilter)}
                              className="text-red-700 dark:text-red-400 font-medium text-[11px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>

                          <td className="p-1 border-r border-slate-300 text-center bg-[#2e75b6] text-white font-bold font-mono">
                            Subtotal
                          </td>
                        </>
                      )}

                      {/* SQ ADMIN1 */}
                      {activeDomainTab === "sq" && (
                        <>
                          <td colSpan={11} className="p-2 text-center text-slate-700 dark:text-slate-300 font-normal italic">
                            Enter surveillance case and quality metrics per district below.
                          </td>
                          <td className="p-1 text-center bg-[#2e75b6] text-white font-bold font-mono">Subtotal</td>
                        </>
                      )}

                      {/* PD ADMIN1 */}
                      {activeDomainTab === "pd" && (
                        <>
                          <td colSpan={11} className="p-2 text-center text-slate-700 dark:text-slate-300 font-normal italic">
                            Enter trajectory coverage figures per district below.
                          </td>
                          <td className="p-1 text-center bg-[#2e75b6] text-white font-bold font-mono">Subtotal</td>
                        </>
                      )}

                      {/* TA ADMIN1 */}
                      {activeDomainTab === "ta" && (
                        <>
                          <td colSpan={12} className="p-2 text-center text-slate-700 dark:text-slate-300 font-normal italic">
                            Enter case distribution, geographic density and vulnerability flags per district below.
                          </td>
                          <td className="p-1 text-center bg-[#2e75b6] text-white font-bold font-mono">Subtotal</td>
                        </>
                      )}
                    </tr>
                  )}

                  {/* DISTRICT DATA ROWS (Admin2) */}
                  {paginatedRows.map((r, idx) => {
                    const globalIdx = (currentPage - 1) * pageSize + idx + 1;

                    // PI Calculations
                    const mcv1Minus3 = Number(r.mcv1YearMinus3 || 0);
                    const mcv1Minus2 = Number(r.mcv1YearMinus2 || 0);
                    const mcv1Minus1 = Number(r.mcv1YearMinus1 || 0);
                    const mcv1AvgNum = (mcv1Minus3 + mcv1Minus2 + mcv1Minus1) / 3;
                    const mcv1Avg = mcv1AvgNum.toFixed(1);
                    const mcv1Rp = calcMcv1Rp(mcv1AvgNum);

                    // Peer calculation for neighboring districts with MCV1 <80%
                    const peerDistricts = localRows.filter((other) => other.districtId !== r.districtId && (!r.provinceName || other.provinceName === r.provinceName));
                    const lowPeers = peerDistricts.filter((p) => {
                      const avg = (Number(p.mcv1YearMinus3 || 0) + Number(p.mcv1YearMinus2 || 0) + Number(p.mcv1YearMinus1 || 0)) / 3;
                      return avg < 80.0;
                    }).length;
                    const neighborPct = peerDistricts.length > 0 ? Math.round((lowPeers / peerDistricts.length) * 100) : 0;
                    const neighborRp = calcNeighborRp(neighborPct);

                    const mcv2Minus3 = Number(r.mcv2YearMinus3 || 0);
                    const mcv2Minus2 = Number(r.mcv2YearMinus2 || 0);
                    const mcv2Minus1 = Number(r.mcv2YearMinus1 || 0);
                    const mcv2AvgNum = (mcv2Minus3 + mcv2Minus2 + mcv2Minus1) / 3;
                    const mcv2Avg = mcv2AvgNum.toFixed(1);
                    const mcv2Rp = calcMcv2Rp(mcv2AvgNum);

                    const siaCovNum = Number(r.siaCoveragePct || 0);
                    const siaCovRp = calcSiaCovRp(siaCovNum);

                    const siaAgeRp = calcSiaAgeRp(r.siaTargetAgeGroup || "WIDE");

                    const siaYearsNum = Number(r.siaYearsSince || 0);
                    const siaYearsRp = calcSiaYearsRp(siaYearsNum);

                    const unvacNum = Number(r.unvaccinatedCasesPct || 0);
                    const unvacRp = calcUnvacRp(unvacNum);

                    const piSubtotalRp = mcv1Rp + neighborRp + mcv2Rp + siaCovRp + siaAgeRp + siaYearsRp + unvacRp;

                    // SQ Calculations
                    const popNum = Number(r.population) || 100000;
                    const discardedNum = Number(r.discardedCases) || 0;
                    const discardedRateNum = (discardedNum / Math.max(1, popNum)) * 100000;
                    const discardedRate = discardedRateNum.toFixed(2);
                    const discardedRateRp = calcDiscardedRateRp(discardedRateNum);

                    const adeqInvestNum = Number(r.adequateInvestigationPct || 0);
                    const adeqInvestRp = calcStandardQualityRp(adeqInvestNum);

                    const adeqSpecimenNum = Number(r.adequateSpecimenPct || 0);
                    const adeqSpecimenRp = calcStandardQualityRp(adeqSpecimenNum);

                    const timelyLabNum = Number(r.timelyLabResultsPct || 0);
                    const timelyLabRp = calcStandardQualityRp(timelyLabNum);

                    const sqSubtotalRp = discardedRateRp + adeqInvestRp + adeqSpecimenRp + timelyLabRp;

                    // PD Calculations
                    const mcv1TrendRp = calcTrendRp(mcv1Minus1, mcv1Minus3);
                    const mcv2TrendRp = calcTrendRp(mcv2Minus1, mcv2Minus3);
                    const mcv1mcv2Dropout = mcv1Minus1 > 0 ? (((mcv1Minus1 - mcv2Minus1) / mcv1Minus1) * 100) : 0;
                    const mcv1mcv2DropoutRp = calcDropoutRp(mcv1mcv2Dropout);
                    const penta1Cov = Number(r.penta1YearMinus1 || 0);
                    const penta1mcv1Dropout = penta1Cov > 0 ? (((penta1Cov - mcv1Minus1) / penta1Cov) * 100) : 0;
                    const penta1mcv1DropoutRp = calcDropoutRp(penta1mcv1Dropout);

                    const pdSubtotalRp = mcv1TrendRp + mcv2TrendRp + mcv1mcv2DropoutRp + penta1mcv1DropoutRp;

                    // TA Calculations
                    const threatCasesUnder5 = Number(r.threatCasesUnder5 || 0);
                    const threatCases5To14 = Number(r.threatCases5To14 || 0);
                    const threatCases15Plus = Number(r.threatCases15Plus || 0);
                    const totalThreatCases = threatCasesUnder5 + threatCases5To14 + threatCases15Plus;
                    const threatIncRp = calcIncidenceRp(totalThreatCases, popNum);

                    const areaKm2 = Number(r.areaKm2) || 2500;
                    const density = Math.round(popNum / Math.max(1, areaKm2));
                    const densityRp = calcDensityRp(density);

                    const borderCaseRp = r.borderCaseInPastYear ? 4 : 0;

                    const vulnCount = Object.values(r.vulnerabilities || {}).filter(Boolean).length;
                    const vulnRp = Math.min(8, vulnCount);

                    const taSubtotalRp = threatIncRp + densityRp + borderCaseRp + vulnRp;

                    return (
                      <tr
                        key={r.districtId}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition-colors group"
                      >
                        {/* FROZEN 1: INDEX */}
                        <td
                          className="p-1.5 text-center text-muted-foreground border-r sticky left-0 z-20 bg-background group-hover:bg-blue-50/40 dark:group-hover:bg-slate-800/60 font-mono text-[11px]"
                          style={{ width: `${indexWidth}px`, minWidth: `${indexWidth}px`, maxWidth: `${indexWidth}px` }}
                        >
                          {globalIdx}
                        </td>

                        {/* FROZEN 2: DISTRICT NAME (Admin2 area styling) */}
                        <td
                          className="p-1.5 font-semibold border-r whitespace-nowrap sticky z-20 bg-[#deebf7]/40 dark:bg-slate-800 group-hover:bg-[#deebf7]/70 dark:group-hover:bg-slate-800"
                          style={{ left: `${indexWidth}px`, width: `${districtWidth}px`, minWidth: `${districtWidth}px`, maxWidth: `${districtWidth}px` }}
                        >
                          <span className="truncate block text-slate-800 dark:text-slate-200" title={r.districtName || `District ${r.districtId}`}>
                            {r.districtName || `District ${r.districtId}`}
                          </span>
                        </td>

                        {/* FROZEN 3: PROVINCE (Admin1 area styling) */}
                        <td
                          className="p-1.5 text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap sticky z-20 bg-background group-hover:bg-blue-50/40 dark:group-hover:bg-slate-800/60"
                          style={{ left: `${indexWidth + districtWidth}px`, width: `${provinceWidth}px`, minWidth: `${provinceWidth}px`, maxWidth: `${provinceWidth}px` }}
                        >
                          <span className="truncate block font-medium" title={r.provinceName || "-"}>
                            {r.provinceName || "-"}
                          </span>
                        </td>

                        {/* DOMAIN 1: POPULATION IMMUNITY CELLS */}
                        {activeDomainTab === "pi" && (
                          <>
                            {/* MCV1 -3 */}
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.mcv1YearMinus3}
                                onChange={(e) => handleCellChange(r.districtId, "mcv1YearMinus3", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            {/* MCV1 -2 */}
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.mcv1YearMinus2}
                                onChange={(e) => handleCellChange(r.districtId, "mcv1YearMinus2", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            {/* MCV1 -1 */}
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.mcv1YearMinus1}
                                onChange={(e) => handleCellChange(r.districtId, "mcv1YearMinus1", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            {/* MCV1 Avg */}
                            <td className="p-1 border-r text-center font-mono font-medium bg-slate-100/70 dark:bg-slate-800/50">
                              {mcv1Avg}%
                            </td>
                            {/* MCV1 RP (Light Blue Calculated) */}
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {mcv1Rp}
                            </td>

                            {/* Neighboring % */}
                            <td className="p-1 border-r text-center font-mono text-slate-700 dark:text-slate-300">
                              {neighborPct}%
                            </td>
                            {/* Neighboring RP */}
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {neighborRp}
                            </td>

                            {/* MCV2 -3 */}
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.mcv2YearMinus3}
                                onChange={(e) => handleCellChange(r.districtId, "mcv2YearMinus3", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            {/* MCV2 -2 */}
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.mcv2YearMinus2}
                                onChange={(e) => handleCellChange(r.districtId, "mcv2YearMinus2", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            {/* MCV2 -1 */}
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.mcv2YearMinus1}
                                onChange={(e) => handleCellChange(r.districtId, "mcv2YearMinus1", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            {/* MCV2 Avg */}
                            <td className="p-1 border-r text-center font-mono font-medium bg-slate-100/70 dark:bg-slate-800/50">
                              {mcv2Avg}%
                            </td>
                            {/* MCV2 RP */}
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {mcv2Rp}
                            </td>

                            {/* SIA Coverage */}
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.siaCoveragePct}
                                onChange={(e) => handleCellChange(r.districtId, "siaCoveragePct", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            {/* SIA Coverage RP */}
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {siaCovRp}
                            </td>

                            {/* SIA Target Age Group */}
                            <td className="p-1 border-r text-center">
                              <select
                                value={r.siaTargetAgeGroup}
                                onChange={(e) => handleCellChange(r.districtId, "siaTargetAgeGroup", e.target.value)}
                                className="h-6 text-[11px] rounded border bg-transparent px-1 w-full"
                              >
                                <option value="WIDE">Wide (&gt;5 cohorts)</option>
                                <option value="NARROW">Narrow (&lt;5)</option>
                              </select>
                            </td>
                            {/* SIA Age Group RP */}
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {siaAgeRp}
                            </td>

                            {/* Years since SIA */}
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={10}
                                value={r.siaYearsSince}
                                onChange={(e) => handleCellChange(r.districtId, "siaYearsSince", Number(e.target.value))}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            {/* Years since SIA RP */}
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {siaYearsRp}
                            </td>

                            {/* % Unvaccinated */}
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.unvaccinatedCasesPct}
                                onChange={(e) => handleCellChange(r.districtId, "unvaccinatedCasesPct", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            {/* % Unvaccinated RP */}
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {unvacRp}
                            </td>

                            {/* SUBTOTAL RISK POINTS (Calculated Subtotal) */}
                            <td className="p-1 border-r text-center font-mono font-black bg-[#2e75b6] text-white shadow-inner text-xs">
                              {piSubtotalRp}
                            </td>
                          </>
                        )}

                        {/* DOMAIN 2: SURVEILLANCE QUALITY CELLS */}
                        {activeDomainTab === "sq" && (
                          <>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                value={r.population}
                                onChange={(e) => handleCellChange(r.districtId, "population", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.suspectedCases}
                                onChange={(e) => handleCellChange(r.districtId, "suspectedCases", Number(e.target.value))}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.discardedCases}
                                onChange={(e) => handleCellChange(r.districtId, "discardedCases", Number(e.target.value))}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center font-mono font-medium bg-slate-100/70 dark:bg-slate-800/50">
                              {discardedRate}
                            </td>
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {discardedRateRp}
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={r.adequateInvestigationPct}
                                onChange={(e) => handleCellChange(r.districtId, "adequateInvestigationPct", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {adeqInvestRp}
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={r.adequateSpecimenPct}
                                onChange={(e) => handleCellChange(r.districtId, "adequateSpecimenPct", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {adeqSpecimenRp}
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={r.timelyLabResultsPct}
                                onChange={(e) => handleCellChange(r.districtId, "timelyLabResultsPct", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {timelyLabRp}
                            </td>
                            <td className="p-1 border-r text-center font-mono font-black bg-[#2e75b6] text-white shadow-inner text-xs">
                              {sqSubtotalRp}
                            </td>
                          </>
                        )}

                        {/* DOMAIN 3: PROGRAMME DELIVERY CELLS */}
                        {activeDomainTab === "pd" && (
                          <>
                            <td className="p-1 border-r text-center font-mono font-medium">{mcv1Avg}%</td>
                            <td className="p-1 border-r text-center">
                              <Badge variant="outline" className={`text-[10px] ${mcv1TrendRp === 0 ? "bg-emerald-50 text-emerald-700" : mcv1TrendRp === 4 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                                {mcv1Minus1 >= mcv1Minus3 ? "Stable / +" : mcv1Minus3 - mcv1Minus1 > 10 ? ">10% Decl." : "Minor Decl."}
                              </Badge>
                            </td>
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {mcv1TrendRp}
                            </td>

                            <td className="p-1 border-r text-center font-mono font-medium">{mcv2Avg}%</td>
                            <td className="p-1 border-r text-center">
                              <Badge variant="outline" className={`text-[10px] ${mcv2TrendRp === 0 ? "bg-emerald-50 text-emerald-700" : mcv2TrendRp === 4 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                                {mcv2Minus1 >= mcv2Minus3 ? "Stable / +" : mcv2Minus3 - mcv2Minus1 > 10 ? ">10% Decl." : "Minor Decl."}
                              </Badge>
                            </td>
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {mcv2TrendRp}
                            </td>

                            <td className="p-1 border-r text-center font-mono font-medium">
                              {mcv1mcv2Dropout.toFixed(1)}%
                            </td>
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {mcv1mcv2DropoutRp}
                            </td>

                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.penta1YearMinus1}
                                onChange={(e) => handleCellChange(r.districtId, "penta1YearMinus1", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center font-mono font-medium">
                              {penta1mcv1Dropout.toFixed(1)}%
                            </td>
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {penta1mcv1DropoutRp}
                            </td>

                            <td className="p-1 border-r text-center font-mono font-black bg-[#2e75b6] text-white shadow-inner text-xs">
                              {pdSubtotalRp}
                            </td>
                          </>
                        )}

                        {/* DOMAIN 4: THREAT ASSESSMENT CELLS */}
                        {activeDomainTab === "ta" && (
                          <>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.threatCasesUnder5}
                                onChange={(e) => handleCellChange(r.districtId, "threatCasesUnder5", Number(e.target.value))}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.threatCases5To14}
                                onChange={(e) => handleCellChange(r.districtId, "threatCases5To14", Number(e.target.value))}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.threatCases15Plus}
                                onChange={(e) => handleCellChange(r.districtId, "threatCases15Plus", Number(e.target.value))}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center font-mono font-semibold bg-slate-100/70 dark:bg-slate-800/50">
                              {totalThreatCases}
                            </td>
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {threatIncRp}
                            </td>

                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                value={r.areaKm2}
                                onChange={(e) => handleCellChange(r.districtId, "areaKm2", e.target.value)}
                                className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center font-mono font-medium">
                              {density}
                            </td>
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {densityRp}
                            </td>

                            <td className="p-1 border-r text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(r.borderCaseInPastYear)}
                                onChange={(e) => handleCellChange(r.districtId, "borderCaseInPastYear", e.target.checked)}
                                className="h-4 w-4 rounded text-[#195b9b] cursor-pointer"
                              />
                            </td>
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {borderCaseRp}
                            </td>

                            <td className="p-1 border-r text-center font-mono font-semibold">
                              {vulnCount} / 8
                            </td>
                            <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                              {vulnRp}
                            </td>

                            <td className="p-1 border-r text-center font-mono font-black bg-[#2e75b6] text-white shadow-inner text-xs">
                              {taSubtotalRp}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* ==================================================================== */}
        {/* 3. PAGINATION BAR (Rule 24 Enterprise-grade controls)               */}
        {/* ==================================================================== */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t bg-slate-50/70 dark:bg-slate-900/40 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Rows per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-18 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground ml-2">
              Showing {sortedRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(currentPage * pageSize, sortedRows.length)} of {sortedRows.length} districts
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
            </Button>
            <span className="px-2.5 py-1 bg-muted rounded font-medium text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 4. WHO OFFICIAL EXCEL LEGEND (Faithfully matching circled screenshot) */}
        {/* ==================================================================== */}
        <div className="p-4 border-t bg-white dark:bg-slate-950 space-y-2">
          <div className="text-xs font-bold italic text-slate-800 dark:text-slate-200 underline">
            Legend
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {/* Admin1 */}
            <div className="flex items-center gap-3">
              <div className="w-20 h-6 shrink-0 bg-[#bdd7ee] border border-slate-400 text-slate-900 text-[11px] italic font-semibold flex items-center justify-center">
                Admin1
              </div>
              <span className="italic text-slate-600 dark:text-slate-300">
                Read only cells - Admin1 area
              </span>
            </div>

            {/* Admin2 */}
            <div className="flex items-center gap-3">
              <div className="w-20 h-6 shrink-0 bg-[#deebf7] border border-slate-400 text-slate-900 text-[11px] italic font-semibold flex items-center justify-center">
                Admin2
              </div>
              <span className="italic text-slate-600 dark:text-slate-300">
                Read only cells - Admin2 area
              </span>
            </div>

            {/* Editable cells */}
            <div className="flex items-center gap-3">
              <div className="w-20 h-6 shrink-0 bg-[#3b4b59] border border-slate-500 text-white text-[11px] font-bold font-mono flex items-center justify-center">
                X
              </div>
              <span className="italic text-slate-600 dark:text-slate-300">
                Editable cells - Please enter the data in these cells
              </span>
            </div>

            {/* Calculated Risk Points */}
            <div className="flex items-center gap-3">
              <div className="w-20 h-6 shrink-0 bg-[#9bc2e6] border border-blue-400 text-[#1f4e79] text-[11px] font-bold font-mono flex items-center justify-center">
                X
              </div>
              <span className="italic text-slate-600 dark:text-slate-300">
                Read only cells - Calculated Risk Points
              </span>
            </div>

            {/* External data */}
            <div className="flex items-center gap-3">
              <div className="w-20 h-6 shrink-0 bg-[#a6a6a6] border border-slate-400 text-white text-[11px] font-bold font-mono flex items-center justify-center">
                X
              </div>
              <span className="italic text-slate-600 dark:text-slate-300">
                Read only cells - External data replicated from another sheet within the current template
              </span>
            </div>

            {/* Calculated Subtotal Risk Point */}
            <div className="flex items-center gap-3">
              <div className="w-20 h-6 shrink-0 bg-[#2e75b6] border border-blue-700 text-white text-[11px] font-black font-mono flex items-center justify-center shadow-sm">
                X
              </div>
              <span className="italic text-slate-600 dark:text-slate-300 font-medium">
                Read only cells - Calculated Subtotal Risk Point
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 5. BULK COLUMN IMPORT / UPDATE DIALOG                                */}
      {/* ==================================================================== */}
      <Dialog open={Boolean(bulkDialogField)} onOpenChange={(open) => !open && setBulkDialogField(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              Import / Batch Set: {bulkDialogTitle}
            </DialogTitle>
            <DialogDescription>
              Quickly populate or import a uniform baseline value across districts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Target Scope</Label>
              <Select value={bulkProvinceId} onValueChange={setBulkProvinceId}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Districts ({localRows.length})</SelectItem>
                  {provincesList.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name} Province only
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Value to apply</Label>
              {bulkDialogField === "siaTargetAgeGroup" ? (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="Select target age group..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WIDE">Wide (&gt;5 cohorts) - 0 pts</SelectItem>
                    <SelectItem value="NARROW">Narrow (&lt;5 cohorts) - 2 pts</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder="Enter numeric value (e.g. 85.0)..."
                  className="mt-1 h-8 text-xs"
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkDialogField(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={applyBulkValue} disabled={!bulkValue}>
              Apply to Area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
