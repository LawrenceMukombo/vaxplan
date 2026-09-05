import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  Plus,
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
  // Domain 4: Threat Assessment & Vulnerabilities (Sheets 7-8)
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

export type DomainTab =
  | "PopulationImmunity"
  | "SurveillanceQuality"
  | "ProgramDeliveryPerformance"
  | "VulnerableGroups"
  | "ThreatAssessment"
  | "IndicatorMaps"
  | "Setup&Configuration"
  | "Acknowledgements"
  | "MeaslesIncidence"
  | "Case-Based-Data";

// Baseline column widths (px)
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  index: 38,
  district: 175,
  province: 135,
  // PI
  mcv1Minus3: 65,
  mcv1Minus2: 65,
  mcv1Minus1: 65,
  mcv1Avg: 70,
  mcv1Rp: 50,
  neighborPct: 75,
  neighborRp: 50,
  mcv2Minus3: 65,
  mcv2Minus2: 65,
  mcv2Minus1: 65,
  mcv2Avg: 70,
  mcv2Rp: 50,
  siaCovMinus1: 72,
  siaCovRp: 50,
  siaAgeGroupMinus1: 85,
  siaAgeGroupRp: 50,
  siaYearsMinus1: 65,
  siaYearsRp: 50,
  unvacMinus3Minus1: 75,
  unvacRp: 50,
  piTotalRp: 80,
  // SQ
  sqRateVal: 75,
  sqRateRp: 52,
  sqInvestVal: 75,
  sqInvestRp: 52,
  sqSpecimenVal: 75,
  sqSpecimenRp: 52,
  sqLabVal: 75,
  sqLabRp: 52,
  sqTotalRp: 84,
  // PD
  pdMcv1TrendVal: 75,
  pdMcv1TrendRp: 52,
  pdMcv2TrendVal: 75,
  pdMcv2TrendRp: 52,
  pdMcvDropoutVal: 85,
  pdMcvDropoutRp: 52,
  pdPentaDoses: 80,
  pdPentaDropoutVal: 85,
  pdPentaDropoutRp: 52,
  pdTotalRp: 84,
  // VG
  vgItem: 95,
  vgTotalRp: 84,
  // TA
  taCasesUnder5Val: 65,
  taCasesUnder5Rp: 50,
  taCases5to14Val: 65,
  taCases5to14Rp: 50,
  taCases15plusVal: 65,
  taCases15plusRp: 50,
  taDensityVal: 75,
  taDensityRp: 50,
  taBorderVal: 70,
  taBorderRp: 50,
  taVulnVal: 70,
  taVulnRp: 50,
  taTotalRp: 84,
};

const STRETCH_COL_WIDTHS: Record<string, number> = Object.fromEntries(
  Object.entries(DEFAULT_COL_WIDTHS).map(([k, v]) => [k, Math.round(v * 1.28)])
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

// Surveillance Quality: Discarded Rate RP (0.0 -> 8; 1.0-1.99 -> 4; >=2.0 -> 0)
export function calcDiscardedRateRp(rate: number): number {
  if (isNaN(rate) || rate <= 0) return 8;
  if (rate >= 2.0) return 0;
  if (rate >= 1.0) return 4;
  return 8;
}

// Investigation / Specimen / Timely Results (>=80% -> 0; 50-79% -> 2; <50% or 0% -> 4)
export function calcQualityRp(pct: number): number {
  if (isNaN(pct) || pct < 50.0) return 4;
  if (pct >= 80.0) return 0;
  return 2;
}

// Program Delivery: Trend RP (Stable / Positive -> 0; Minor decline -> 2; >10% decline -> 4)
export function calcTrendRp(slopeVal: number): number {
  if (isNaN(slopeVal)) return 0;
  if (slopeVal >= 0) return 0;
  if (slopeVal <= -10) return 4;
  return 2;
}

export function calcDropoutRp(rate: number): number {
  if (isNaN(rate)) return 0;
  return rate <= 10.0 ? 0 : 4;
}

// Threat Assessment: Density (<50 -> 0; 50-100 -> 1; >100 -> 2)
export function calcDensityRp(density: number): number {
  if (isNaN(density) || density < 50) return 0;
  if (density > 100) return 2;
  return 1;
}

export function RiskDirectDataEntry({ assessmentId, onCalculationSuccess }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<DomainTab>("PopulationImmunity");
  const [searchTerm, setSearchTerm] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortField, setSortField] = useState<string>("districtName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

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

  const assessmentYear = data?.assessment?.assessmentYear || 2022;
  const assessmentCountry = data?.assessment?.countryName || "South Sudan";

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
              [vulnKey]: bulkValue === "true" || bulkValue === "Y",
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
      // Group by province first if not sorted explicitly by district
      if (sortField === "provinceName") {
        const pComp = (a.provinceName || "").localeCompare(b.provinceName || "");
        if (pComp !== 0) return sortDirection === "asc" ? pComp : -pComp;
      }
      let valA = a[sortField];
      let valB = b[sortField];

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

  // Grouped by Province for rendering Admin1 header rows seamlessly
  const groupedByProvince = useMemo(() => {
    const groups: Array<{ provinceName: string; provinceId?: number | null; districts: DirectEntryRow[] }> = [];
    const map = new Map<string, DirectEntryRow[]>();

    sortedRows.forEach((r) => {
      const pName = r.provinceName || "Unassigned Province";
      if (!map.has(pName)) {
        map.set(pName, []);
      }
      map.get(pName)!.push(r);
    });

    map.forEach((districts, pName) => {
      groups.push({
        provinceName: pName,
        provinceId: districts[0]?.provinceId,
        districts,
      });
    });

    return groups;
  }, [sortedRows]);

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
  const indexWidth = colWidths.index || 38;
  const districtWidth = colWidths.district || 175;

  // Column Resizer Handler
  const startResize = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[key] || 90;

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

  // Color theme per active domain matching screenshots
  const domainHeaderTheme = useMemo(() => {
    switch (activeTab) {
      case "PopulationImmunity":
        return {
          barBg: "bg-[#1f4e79]",
          bannerBorder: "border-[#153655]",
          badgeBg: "bg-[#13385b]",
          badgeText: "text-white",
          totalColBg: "bg-[#2e75b6]",
          title: "Population Immunity",
        };
      case "SurveillanceQuality":
        return {
          barBg: "bg-[#002060]",
          bannerBorder: "border-[#00143d]",
          badgeBg: "bg-[#001745]",
          badgeText: "text-white",
          totalColBg: "bg-[#002060]",
          title: "Surveillance Quality",
        };
      case "ProgramDeliveryPerformance":
        return {
          barBg: "bg-[#c65911]",
          bannerBorder: "border-[#96420c]",
          badgeBg: "bg-[#8f3e0b]",
          badgeText: "text-white",
          totalColBg: "bg-[#c65911]",
          title: "Program Delivery Performance",
        };
      case "VulnerableGroups":
        return {
          barBg: "bg-[#e05656]",
          bannerBorder: "border-[#c43b3b]",
          badgeBg: "bg-[#b83232]",
          badgeText: "text-white",
          totalColBg: "bg-[#e05656]",
          title: "Vulnerable Groups",
        };
      case "ThreatAssessment":
        return {
          barBg: "bg-[#7030a0]",
          bannerBorder: "border-[#521e78]",
          badgeBg: "bg-[#4c1873]",
          badgeText: "text-white",
          totalColBg: "bg-[#7030a0]",
          title: "Threat Assessment",
        };
      default:
        return {
          barBg: "bg-[#1f4e79]",
          bannerBorder: "border-[#153655]",
          badgeBg: "bg-[#13385b]",
          badgeText: "text-white",
          totalColBg: "bg-[#2e75b6]",
          title: activeTab,
        };
    }
  }, [activeTab]);

  return (
    <div className="space-y-2 font-sans select-none">
      {/* ==================================================================== */}
      {/* 1. CLEAN WHO-STYLED HEADER BANNER (NO LOGOS, NO BACK BUTTON)         */}
      {/* ==================================================================== */}
      <div className={`rounded-t-lg border-x border-t ${domainHeaderTheme.bannerBorder} ${domainHeaderTheme.barBg} text-white shadow-sm overflow-hidden`}>
        <div className="px-4 py-2 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Metadata title (left) */}
          <div className="flex items-center gap-2">
            <span className="text-xs italic text-blue-100/90 font-semibold tracking-wide">
              Measles Risk Assessment Tool V1.8 - {assessmentCountry}
            </span>
            {isDirty && (
              <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded shadow-sm animate-pulse">
                Unsaved Changes
              </span>
            )}
          </div>

          {/* Centered Domain Title inside rounded capsule banner matching screenshots */}
          <div className="flex-1 flex items-center justify-center">
            <div className={`px-8 py-1 rounded-full border border-white/30 shadow-inner ${domainHeaderTheme.badgeBg}`}>
              <h2 className="text-lg md:text-xl font-black text-white tracking-wide text-center">
                {domainHeaderTheme.title}
              </h2>
            </div>
          </div>

          {/* Action button: Recalculate all */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => saveMutation.mutate({ recalculate: true })}
              disabled={saveMutation.isPending}
              className="h-8 px-4 text-xs font-bold bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 shadow-sm transition-transform active:scale-95"
            >
              {saveMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-primary" /> Recalculating...
                </>
              ) : (
                <>
                  <Calculator className="w-3.5 h-3.5 mr-1.5 text-primary" /> Recalculate all
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Secondary Quick Filter Toolbar */}
        <div className="bg-slate-100 dark:bg-slate-800 text-foreground border-t border-slate-200 dark:border-slate-700 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[11px] text-slate-600 dark:text-slate-300">Quick Filter:</span>
            <div className="relative w-44">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search district / province..."
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
                <SelectTrigger className="h-7 text-xs w-40 bg-background">
                  <SelectValue placeholder="All Provinces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Provinces ({localRows.length})</SelectItem>
                  {provincesList.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2">
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
      {/* 2. TABULAR SPREADSHEET (ALIGNED TWO-TIER HEADERS)                     */}
      {/* ==================================================================== */}
      <div className="border border-t-0 rounded-b shadow-sm bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[640px] relative">
          <table className="w-full text-xs text-left border-collapse table-fixed">
            {/* TWO-TIER HEADER */}
            <thead className="sticky top-0 z-30 bg-[#1f4e79] text-white border-b shadow-sm font-semibold select-none text-[11px]">
              {/* LEVEL 1: GROUPED HEADERS */}
              <tr className="border-b border-blue-900/60 text-center">
                {/* FROZEN 1: AREA (Spans District & Province) */}
                <th
                  rowSpan={2}
                  className="p-2 border-r border-blue-900/60 sticky top-0 left-0 z-40 bg-[#1f4e79] text-center"
                  style={{ width: `${indexWidth}px`, minWidth: `${indexWidth}px`, maxWidth: `${indexWidth}px` }}
                >
                  #
                </th>

                <th
                  rowSpan={2}
                  className="p-2 border-r-2 border-blue-950 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)] sticky top-0 z-40 bg-[#1f4e79] text-left cursor-pointer hover:bg-[#275d8d] group/th"
                  style={{ left: `${indexWidth}px`, width: `${districtWidth}px`, minWidth: `${districtWidth}px`, maxWidth: `${districtWidth}px` }}
                  onClick={() => handleSort("districtName")}
                >
                  <div className="flex items-center justify-between pr-2">
                    <span className="font-bold">AREA</span>
                    {getSortIcon("districtName")}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/40 select-none z-50"
                    onMouseDown={(e) => startResize("district", e)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>

                {/* -------------------------------------------------------- */}
                {/* DOMAIN 1: POPULATION IMMUNITY HEADERS (Screenshot 1)     */}
                {/* -------------------------------------------------------- */}
                {activeTab === "PopulationImmunity" && (
                  <>
                    <th colSpan={5} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Administrative MCV1 Coverage Report</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>% of neighboring districts with MCV1 &lt;80%</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={5} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Administrative MCV2 Coverage Report</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Subnational coverage of measles SIA</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Measles SIA target age group</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>Years since last measles SIA</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                      <span>% suspected measles cases unvaccinated</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-blue-900/60 bg-[#1a446c] text-white font-black text-center relative">
                      <span>SUBTOTAL RISK POINTS</span>
                    </th>
                  </>
                )}

                {/* -------------------------------------------------------- */}
                {/* DOMAIN 2: SURVEILLANCE QUALITY HEADERS (Screenshot 2)    */}
                {/* -------------------------------------------------------- */}
                {activeTab === "SurveillanceQuality" && (
                  <>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#1f4e79] text-white relative">
                      <span>Non-measles discarded rate</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#1f4e79] text-white relative">
                      <span>% with adequate investigation</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#1f4e79] text-white relative">
                      <span>% adequate blood specimen collection</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#1f4e79] text-white relative">
                      <span>% with timely availability of laboratory results</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-blue-900/60 bg-[#002060] text-white font-black text-center relative">
                      <span>SUBTOTAL RISK POINTS</span>
                    </th>
                  </>
                )}

                {/* -------------------------------------------------------- */}
                {/* DOMAIN 3: PROGRAM DELIVERY HEADERS (Screenshot 3)        */}
                {/* -------------------------------------------------------- */}
                {activeTab === "ProgramDeliveryPerformance" && (
                  <>
                    <th colSpan={2} className="p-2 border-r border-amber-900/60 bg-[#c65911] text-white relative">
                      <span>MCV1 Trend</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-amber-900/60 bg-[#c65911] text-white relative">
                      <span>MCV2 Trend</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-amber-900/60 bg-[#c65911] text-white relative">
                      <span>Drop-out Rate MCV1-MCV2</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-amber-900/60 bg-[#c65911] text-white relative">
                      <span>DPT1 / Penta1</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-amber-900/60 bg-[#c65911] text-white relative">
                      <span>Drop-out Rate DPT1-MCV1</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-amber-900/60 bg-[#8f3e0b] text-white font-black text-center relative">
                      <span>SUBTOTAL RISK POINTS</span>
                    </th>
                  </>
                )}

                {/* -------------------------------------------------------- */}
                {/* DOMAIN 4: VULNERABLE GROUPS HEADERS (Screenshot 4)       */}
                {/* -------------------------------------------------------- */}
                {activeTab === "VulnerableGroups" && (
                  <>
                    <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white relative">
                      <span>Displaced / Refugees / Mobile</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white relative">
                      <span>Vaccine Hesitancy / Refusal</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white relative">
                      <span>Armed Conflict / Insecurity</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white relative">
                      <span>Natural Disasters</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white relative">
                      <span>Difficult Terrain / Riverine</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white relative">
                      <span>Lack of local political support</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white relative">
                      <span>High-traffic transit hubs / major roads / urban border</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white relative">
                      <span>Areas with mass gatherings / trade / markets</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#b83232] text-white font-black text-center relative">
                      <span>SUBTOTAL RISK POINTS</span>
                    </th>
                  </>
                )}

                {/* -------------------------------------------------------- */}
                {/* DOMAIN 5: THREAT ASSESSMENT HEADERS (Screenshot 5)       */}
                {/* -------------------------------------------------------- */}
                {activeTab === "ThreatAssessment" && (
                  <>
                    <th colSpan={2} className="p-2 border-r border-purple-900/60 bg-[#7030a0] text-white relative">
                      <span>Evidence of recent measles cases among &lt;5 years</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-purple-900/60 bg-[#7030a0] text-white relative">
                      <span>Evidence of recent measles cases among 5-15 years</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-purple-900/60 bg-[#7030a0] text-white relative">
                      <span>Evidence of recent measles cases among &gt;15 years</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-purple-900/60 bg-[#7030a0] text-white relative">
                      <span>Population density (Pers./Km2)</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-purple-900/60 bg-[#7030a0] text-white relative">
                      <span>Bordering areas with measles case in the past 12 months</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={2} className="p-2 border-r border-purple-900/60 bg-[#7030a0] text-white relative">
                      <span>Presence of vulnerable population</span>
                      <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                    </th>
                    <th colSpan={1} className="p-2 border-r border-purple-900/60 bg-[#4c1873] text-white font-black text-center relative">
                      <span>SUBTOTAL RISK POINTS</span>
                    </th>
                  </>
                )}
              </tr>

              {/* LEVEL 2: SUBHEADERS */}
              <tr className="bg-[#205b8f] text-white text-center border-b border-blue-900/80">
                {activeTab === "PopulationImmunity" && (
                  <>
                    <th className="p-1.5 border-r border-blue-900/60 relative w-[65px]" style={{ width: `${colWidths.mcv1Minus3 || 65}px` }}>
                      <span className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-r-[5px] border-t-emerald-400 border-r-transparent" />
                      <span>-3</span>
                    </th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[65px]">-2</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[65px]">-1</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[70px] bg-blue-900/50">Avg</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[50px] bg-blue-800/80 font-bold relative">
                      <span className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-r-[5px] border-t-emerald-400 border-r-transparent" />
                      <span>RP</span>
                    </th>

                    <th className="p-1.5 border-r border-blue-900/60 w-[75px]">-3--1</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[50px] bg-blue-800/80 font-bold">RP</th>

                    <th className="p-1.5 border-r border-blue-900/60 w-[65px]">-3</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[65px]">-2</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[65px]">-1</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[70px] bg-blue-900/50">Avg</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[50px] bg-blue-800/80 font-bold">RP</th>

                    <th className="p-1.5 border-r border-blue-900/60 w-[72px] relative">
                      <span className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-r-[5px] border-t-emerald-400 border-r-transparent" />
                      <span>-1</span>
                    </th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[50px] bg-blue-800/80 font-bold">RP</th>

                    <th className="p-1.5 border-r border-blue-900/60 w-[85px]">-1</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[50px] bg-blue-800/80 font-bold">RP</th>

                    <th className="p-1.5 border-r border-blue-900/60 w-[65px]">-1</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[50px] bg-blue-800/80 font-bold">RP</th>

                    <th className="p-1.5 border-r border-blue-900/60 w-[75px]">-3--1</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[50px] bg-blue-800/80 font-bold">RP</th>

                    <th className="p-1.5 border-r border-blue-900/60 w-[80px] bg-[#2e75b6] font-black">Total RP</th>
                  </>
                )}

                {activeTab === "SurveillanceQuality" && (
                  <>
                    <th className="p-1.5 border-r border-blue-900/60 w-[75px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[75px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[75px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[75px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-blue-900/60 w-[84px] bg-[#002060] font-black">Total RP</th>
                  </>
                )}

                {activeTab === "ProgramDeliveryPerformance" && (
                  <>
                    <th className="p-1.5 border-r border-amber-900/60 w-[75px]">{assessmentYear - 2}-{assessmentYear}</th>
                    <th className="p-1.5 border-r border-amber-900/60 w-[52px] bg-amber-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-amber-900/60 w-[75px]">{assessmentYear - 2}-{assessmentYear}</th>
                    <th className="p-1.5 border-r border-amber-900/60 w-[52px] bg-amber-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-amber-900/60 w-[85px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-amber-900/60 w-[52px] bg-amber-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-amber-900/60 w-[80px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-amber-900/60 w-[85px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-amber-900/60 w-[52px] bg-amber-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-amber-900/60 w-[84px] bg-[#c65911] font-black">Total RP</th>
                  </>
                )}

                {activeTab === "VulnerableGroups" && (
                  <>
                    <th className="p-1.5 border-r border-red-900/60 w-[95px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-red-900/60 w-[95px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-red-900/60 w-[95px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-red-900/60 w-[95px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-red-900/60 w-[95px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-red-900/60 w-[95px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-red-900/60 w-[95px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-red-900/60 w-[95px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-red-900/60 w-[84px] bg-[#e05656] font-black">Total RP</th>
                  </>
                )}

                {activeTab === "ThreatAssessment" && (
                  <>
                    <th className="p-1.5 border-r border-purple-900/60 w-[65px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-purple-900/60 w-[50px] bg-purple-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-purple-900/60 w-[65px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-purple-900/60 w-[50px] bg-purple-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-purple-900/60 w-[65px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-purple-900/60 w-[50px] bg-purple-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-purple-900/60 w-[75px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-purple-900/60 w-[50px] bg-purple-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-purple-900/60 w-[70px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-purple-900/60 w-[50px] bg-purple-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-purple-900/60 w-[70px]">{assessmentYear}</th>
                    <th className="p-1.5 border-r border-purple-900/60 w-[50px] bg-purple-800/80 font-bold">RP</th>
                    <th className="p-1.5 border-r border-purple-900/60 w-[84px] bg-[#7030a0] font-black">Total RP</th>
                  </>
                )}
              </tr>
            </thead>

            {/* TABLE BODY (GROUPED PROVINCES & DISTRICTS) */}
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-background text-foreground text-xs font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={25} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                      <span>Loading assessment records...</span>
                    </div>
                  </td>
                </tr>
              ) : groupedByProvince.length === 0 ? (
                <tr>
                  <td colSpan={25} className="text-center py-12 text-muted-foreground">
                    <span>No districts found matching filter.</span>
                  </td>
                </tr>
              ) : (
                groupedByProvince.map((group, gIdx) => (
                  <React.Fragment key={group.provinceName}>
                    {/* PROVINCE HEADER ROW (Admin1) */}
                    <tr className="bg-[#bdd7ee] dark:bg-blue-950/80 text-slate-900 dark:text-blue-100 font-semibold border-b border-slate-300 dark:border-slate-700 select-none">
                      <td
                        className="p-1.5 text-center sticky left-0 z-20 bg-[#bdd7ee] dark:bg-blue-950/80 border-r border-slate-300 font-mono text-[10px] text-slate-600"
                        style={{ width: `${indexWidth}px`, minWidth: `${indexWidth}px`, maxWidth: `${indexWidth}px` }}
                      >
                        {gIdx + 1}
                      </td>
                      <td
                        className="p-1.5 italic font-bold sticky z-20 bg-[#bdd7ee] dark:bg-blue-950/80 border-r-2 border-slate-400 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]"
                        style={{ left: `${indexWidth}px`, width: `${districtWidth}px`, minWidth: `${districtWidth}px`, maxWidth: `${districtWidth}px` }}
                      >
                        <span className="truncate block">{group.provinceName}</span>
                      </td>

                      {/* POPULATION IMMUNITY ADMIN1 ACTIONS */}
                      {activeTab === "PopulationImmunity" && (
                        <>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("mcv1YearMinus3", "MCV1 Year -3", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("mcv1YearMinus2", "MCV1 Year -2", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("mcv1YearMinus1", "MCV1 Year -1", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
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
                              onClick={() => openImportDialog("mcv2YearMinus3", "MCV2 Year -3", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("mcv2YearMinus2", "MCV2 Year -2", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("mcv2YearMinus1", "MCV2 Year -1", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>

                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("siaCoveragePct", "SIA Coverage", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>

                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("siaTargetAgeGroup", "SIA Age Group", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>

                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("siaYearsSince", "Years Since SIA", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>

                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("unvaccinatedCasesPct", "% Unvaccinated", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
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

                      {/* SURVEILLANCE QUALITY ADMIN1 */}
                      {activeTab === "SurveillanceQuality" && (
                        <>
                          <td colSpan={8} className="p-1.5 text-center text-slate-700 dark:text-slate-300 font-normal italic text-[11px]">
                            {group.provinceName} surveillance indicators
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center bg-[#002060] text-white font-bold font-mono">
                            Subtotal
                          </td>
                        </>
                      )}

                      {/* PROGRAM DELIVERY ADMIN1 */}
                      {activeTab === "ProgramDeliveryPerformance" && (
                        <>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("penta1YearMinus1", "DPT1 / Penta1", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                          <td className="p-1 border-r border-slate-300 text-center bg-[#c65911] text-white font-bold font-mono">
                            Subtotal
                          </td>
                        </>
                      )}

                      {/* VULNERABLE GROUPS ADMIN1 */}
                      {activeTab === "VulnerableGroups" && (
                        <>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("vuln_migrantOrUnderserved", "Displaced / Mobile", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("vuln_vaccineHesitancyOrRefusal", "Hesitancy", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("vuln_securityOrConflictConcerns", "Conflict", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("vuln_recurrentNaturalDisasters", "Disasters", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("vuln_poorAccessOrTerrain", "Terrain", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("vuln_inadequatePoliticalSupport", "Political Support", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("vuln_highTransitHubOrBorder", "Transit Hubs", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">
                            <button
                              type="button"
                              onClick={() => openImportDialog("vuln_massGatheringsOrEvents", "Mass Gatherings", group.provinceName)}
                              className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline"
                            >
                              Import...
                            </button>
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center bg-[#e05656] text-white font-bold font-mono">
                            Subtotal
                          </td>
                        </>
                      )}

                      {/* THREAT ASSESSMENT ADMIN1 */}
                      {activeTab === "ThreatAssessment" && (
                        <>
                          <td colSpan={12} className="p-1.5 text-center text-slate-700 dark:text-slate-300 font-normal italic text-[11px]">
                            {group.provinceName} threat indicators
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center bg-[#7030a0] text-white font-bold font-mono">
                            Subtotal
                          </td>
                        </>
                      )}
                    </tr>

                    {/* DISTRICT ROWS UNDER THIS PROVINCE */}
                    {group.districts.map((r, dIdx) => {
                      // PI calculations
                      const mcv1Minus3 = Number(r.mcv1YearMinus3 || 0);
                      const mcv1Minus2 = Number(r.mcv1YearMinus2 || 0);
                      const mcv1Minus1 = Number(r.mcv1YearMinus1 || 0);
                      const mcv1AvgNum = (mcv1Minus3 + mcv1Minus2 + mcv1Minus1) / 3;
                      const mcv1Avg = mcv1AvgNum.toFixed(1);
                      const mcv1Rp = calcMcv1Rp(mcv1AvgNum);

                      const peerDistricts = localRows.filter((o) => o.districtId !== r.districtId && (!r.provinceName || o.provinceName === r.provinceName));
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

                      // SQ calculations
                      const popNum = Number(r.population) || 100000;
                      const discardedNum = Number(r.discardedCases) || 0;
                      const discardedRateNum = (discardedNum / Math.max(1, popNum)) * 100000;
                      const discardedRate = discardedRateNum.toFixed(1);
                      const discardedRateRp = calcDiscardedRateRp(discardedRateNum);

                      const adeqInvestNum = Number(r.adequateInvestigationPct || 0);
                      const adeqInvestRp = calcQualityRp(adeqInvestNum);

                      const adeqSpecimenNum = Number(r.adequateSpecimenPct || 0);
                      const adeqSpecimenRp = calcQualityRp(adeqSpecimenNum);

                      const timelyLabNum = Number(r.timelyLabResultsPct || 0);
                      const timelyLabRp = calcQualityRp(timelyLabNum);

                      const sqSubtotalRp = discardedRateRp + adeqInvestRp + adeqSpecimenRp + timelyLabRp;

                      // PD calculations
                      const mcv1TrendVal = Math.round(mcv1Minus1 - mcv1Minus3);
                      const mcv1TrendRp = calcTrendRp(mcv1TrendVal);

                      const mcv2TrendVal = mcv2Minus3 > 0 ? Math.round(mcv2Minus1 - mcv2Minus3) : 0;
                      const mcv2TrendRp = mcv2Minus3 > 0 ? calcTrendRp(mcv2TrendVal) : 4;

                      const mcv1mcv2Dropout = mcv1Minus1 > 0 ? (((mcv1Minus1 - mcv2Minus1) / mcv1Minus1) * 100) : 100.0;
                      const mcv1mcv2DropoutRp = calcDropoutRp(mcv1mcv2Dropout);

                      const penta1Cov = Number(r.penta1YearMinus1 || 0);
                      const penta1mcv1Dropout = penta1Cov > 0 ? (((penta1Cov - mcv1Minus1) / penta1Cov) * 100) : 99.0;
                      const penta1mcv1DropoutRp = calcDropoutRp(penta1mcv1Dropout);

                      const pdSubtotalRp = mcv1TrendRp + mcv2TrendRp + mcv1mcv2DropoutRp + penta1mcv1DropoutRp;

                      // VG calculations
                      const v = r.vulnerabilities || {};
                      const vgCount = Object.values(v).filter(Boolean).length;

                      // TA calculations
                      const threatUnder5 = Number(r.threatCasesUnder5 || 0);
                      const threatUnder5Rp = threatUnder5 > 0 ? 4 : 0;

                      const threat5to14 = Number(r.threatCases5To14 || 0);
                      const threat5to14Rp = threat5to14 > 0 ? 2 : 0;

                      const threat15plus = Number(r.threatCases15Plus || 0);
                      const threat15plusRp = threat15plus > 0 ? 2 : 0;

                      const areaKm2 = Number(r.areaKm2) || 2500;
                      const density = Math.round(popNum / Math.max(1, areaKm2));
                      const densityRp = calcDensityRp(density);

                      const borderCaseRp = r.borderCaseInPastYear ? 2 : 0;
                      const vulnScore = Math.min(4, vgCount);

                      const taSubtotalRp = threatUnder5Rp + threat5to14Rp + threat15plusRp + densityRp + borderCaseRp + vulnScore;

                      return (
                        <tr
                          key={r.districtId}
                          className="hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition-colors group"
                        >
                          {/* FROZEN 1: INDEX */}
                          <td
                            className="p-1 text-center text-muted-foreground border-r sticky left-0 z-20 bg-background group-hover:bg-blue-50/40 dark:group-hover:bg-slate-800/60 font-mono text-[10px]"
                            style={{ width: `${indexWidth}px`, minWidth: `${indexWidth}px`, maxWidth: `${indexWidth}px` }}
                          >
                            {dIdx + 1}
                          </td>

                          {/* FROZEN 2: DISTRICT NAME (Admin2 area italic) */}
                          <td
                            className="p-1.5 italic font-medium border-r-2 border-slate-300 dark:border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap sticky z-20 bg-[#deebf7]/40 dark:bg-slate-800 group-hover:bg-[#deebf7]/70 dark:group-hover:bg-slate-800"
                            style={{ left: `${indexWidth}px`, width: `${districtWidth}px`, minWidth: `${districtWidth}px`, maxWidth: `${districtWidth}px` }}
                          >
                            <span className="truncate block text-slate-800 dark:text-slate-200" title={r.districtName || `District ${r.districtId}`}>
                              {r.districtName || `District ${r.districtId}`}
                            </span>
                          </td>

                          {/* -------------------------------------------------- */}
                          {/* DOMAIN 1: POPULATION IMMUNITY CELLS                */}
                          {/* -------------------------------------------------- */}
                          {activeTab === "PopulationImmunity" && (
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
                              {/* MCV1 RP */}
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
                                  <option value="WIDE">Wide (&gt;5)</option>
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

                              {/* SUBTOTAL TOTAL RP */}
                              <td className="p-1 border-r text-center font-mono font-black bg-[#2e75b6] text-white shadow-inner text-xs">
                                {piSubtotalRp}
                              </td>
                            </>
                          )}

                          {/* -------------------------------------------------- */}
                          {/* DOMAIN 2: SURVEILLANCE QUALITY CELLS (Screenshot 2)*/}
                          {/* -------------------------------------------------- */}
                          {activeTab === "SurveillanceQuality" && (
                            <>
                              {/* Discarded Rate (2022) */}
                              <td className="p-1 border-r text-center font-mono relative">
                                <span className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-r-[5px] border-t-emerald-500 border-r-transparent" />
                                <span>{discardedRate}</span>
                              </td>
                              {/* Discarded Rate RP */}
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {discardedRateRp}
                              </td>

                              {/* Investigation % (2022) */}
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
                              {/* Investigation RP */}
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {adeqInvestRp}
                              </td>

                              {/* Specimen % (2022) */}
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
                              {/* Specimen RP */}
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {adeqSpecimenRp}
                              </td>

                              {/* Timely Lab % (2022) */}
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
                              {/* Timely Lab RP */}
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {timelyLabRp}
                              </td>

                              {/* SUBTOTAL TOTAL RP */}
                              <td className="p-1 border-r text-center font-mono font-black bg-[#002060] text-white shadow-inner text-xs">
                                {sqSubtotalRp}
                              </td>
                            </>
                          )}

                          {/* -------------------------------------------------- */}
                          {/* DOMAIN 3: PROGRAM DELIVERY CELLS (Screenshot 3)    */}
                          {/* -------------------------------------------------- */}
                          {activeTab === "ProgramDeliveryPerformance" && (
                            <>
                              {/* MCV1 Trend */}
                              <td className="p-1 border-r text-center font-mono font-medium">
                                {mcv1TrendVal}
                              </td>
                              {/* MCV1 Trend RP */}
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {mcv1TrendRp}
                              </td>

                              {/* MCV2 Trend */}
                              <td className="p-1 border-r text-center font-mono text-muted-foreground">
                                -
                              </td>
                              {/* MCV2 Trend RP */}
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {mcv2TrendRp}
                              </td>

                              {/* Drop-out Rate MCV1-MCV2 */}
                              <td className="p-1 border-r text-center font-mono font-medium">
                                {mcv1mcv2Dropout.toFixed(1)}%
                              </td>
                              {/* Dropout MCV1-2 RP */}
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {mcv1mcv2DropoutRp}
                              </td>

                              {/* DPT1 / Penta1 Doses */}
                              <td className="p-1 border-r text-center font-mono">
                                <Input
                                  type="number"
                                  value={r.penta1YearMinus1}
                                  onChange={(e) => handleCellChange(r.districtId, "penta1YearMinus1", e.target.value)}
                                  className="h-6 w-full text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </td>

                              {/* Drop-out Rate DPT1-MCV1 */}
                              <td className="p-1 border-r text-center font-mono font-medium">
                                {penta1mcv1Dropout.toFixed(1)}%
                              </td>
                              {/* Dropout DPT1-MCV1 RP */}
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {penta1mcv1DropoutRp}
                              </td>

                              {/* SUBTOTAL TOTAL RP */}
                              <td className="p-1 border-r text-center font-mono font-black bg-[#c65911] text-white shadow-inner text-xs">
                                {pdSubtotalRp}
                              </td>
                            </>
                          )}

                          {/* -------------------------------------------------- */}
                          {/* DOMAIN 4: VULNERABLE GROUPS CELLS (Screenshot 4)   */}
                          {/* -------------------------------------------------- */}
                          {activeTab === "VulnerableGroups" && (
                            <>
                              {[
                                "migrantOrUnderserved",
                                "vaccineHesitancyOrRefusal",
                                "securityOrConflictConcerns",
                                "recurrentNaturalDisasters",
                                "poorAccessOrTerrain",
                                "inadequatePoliticalSupport",
                                "highTransitHubOrBorder",
                                "massGatheringsOrEvents",
                              ].map((key) => {
                                const isChecked = Boolean((v as any)[key]);
                                return (
                                  <td
                                    key={key}
                                    onClick={() => handleCellChange(r.districtId, `vuln_${key}`, !isChecked)}
                                    className="p-1 border-r text-center cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/40 font-mono font-semibold"
                                  >
                                    <span className={isChecked ? "text-slate-950 dark:text-white font-bold" : "text-slate-400 dark:text-slate-600"}>
                                      {isChecked ? "Y" : "N"}
                                    </span>
                                  </td>
                                );
                              })}
                              {/* SUBTOTAL TOTAL RP */}
                              <td className="p-1 border-r text-center font-mono font-black bg-[#e05656] text-white shadow-inner text-xs">
                                {vgCount}
                              </td>
                            </>
                          )}

                          {/* -------------------------------------------------- */}
                          {/* DOMAIN 5: THREAT ASSESSMENT CELLS (Screenshot 5)   */}
                          {/* -------------------------------------------------- */}
                          {activeTab === "ThreatAssessment" && (
                            <>
                              {/* Cases <5y */}
                              <td className="p-1 border-r text-center font-mono">
                                {threatUnder5 > 0 ? "Y" : "N"}
                              </td>
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {threatUnder5Rp}
                              </td>

                              {/* Cases 5-14y */}
                              <td className="p-1 border-r text-center font-mono">
                                {threat5to14 > 0 ? "Y" : "N"}
                              </td>
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {threat5to14Rp}
                              </td>

                              {/* Cases 15+y */}
                              <td className="p-1 border-r text-center font-mono">
                                {threat15plus > 0 ? "Y" : "N"}
                              </td>
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {threat15plusRp}
                              </td>

                              {/* Population density */}
                              <td className="p-1 border-r text-center font-mono">
                                {density}
                              </td>
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {densityRp}
                              </td>

                              {/* Border case */}
                              <td className="p-1 border-r text-center font-mono">
                                {r.borderCaseInPastYear ? "1" : "0"}
                              </td>
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {borderCaseRp}
                              </td>

                              {/* Vulnerable score */}
                              <td className="p-1 border-r text-center font-mono">
                                {vulnScore}
                              </td>
                              <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">
                                {vulnScore}
                              </td>

                              {/* SUBTOTAL TOTAL RP */}
                              <td className="p-1 border-r text-center font-mono font-black bg-[#7030a0] text-white shadow-inner text-xs">
                                {taSubtotalRp}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ==================================================================== */}
        {/* 3. WHO OFFICIAL EXCEL LEGEND                                         */}
        {/* ==================================================================== */}
        <div className="p-3 border-t bg-white dark:bg-slate-950 space-y-2">
          <div className="text-xs font-bold italic text-slate-800 dark:text-slate-200 underline">
            Legend
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {/* Admin1 */}
            <div className="flex items-center gap-2.5">
              <div className="w-18 h-5 shrink-0 bg-[#bdd7ee] border border-slate-400 text-slate-900 text-[10px] italic font-semibold flex items-center justify-center">
                Admin1
              </div>
              <span className="italic text-slate-600 dark:text-slate-300 text-[11px]">
                Read only cells - Admin1 area
              </span>
            </div>

            {/* Admin2 */}
            <div className="flex items-center gap-2.5">
              <div className="w-18 h-5 shrink-0 bg-[#deebf7] border border-slate-400 text-slate-900 text-[10px] italic font-semibold flex items-center justify-center">
                Admin2
              </div>
              <span className="italic text-slate-600 dark:text-slate-300 text-[11px]">
                Read only cells - Admin2 area
              </span>
            </div>

            {/* Editable cells */}
            <div className="flex items-center gap-2.5">
              <div className="w-18 h-5 shrink-0 bg-[#3b4b59] border border-slate-500 text-white text-[10px] font-bold font-mono flex items-center justify-center">
                X
              </div>
              <span className="italic text-slate-600 dark:text-slate-300 text-[11px]">
                Editable cells - Please enter data in these cells
              </span>
            </div>

            {/* Calculated Risk Points */}
            <div className="flex items-center gap-2.5">
              <div className="w-18 h-5 shrink-0 bg-[#9bc2e6] border border-blue-400 text-[#1f4e79] text-[10px] font-bold font-mono flex items-center justify-center">
                X
              </div>
              <span className="italic text-slate-600 dark:text-slate-300 text-[11px]">
                Read only cells - Calculated Risk Points
              </span>
            </div>

            {/* External data */}
            <div className="flex items-center gap-2.5">
              <div className="w-18 h-5 shrink-0 bg-[#a6a6a6] border border-slate-400 text-white text-[10px] font-bold font-mono flex items-center justify-center">
                X
              </div>
              <span className="italic text-slate-600 dark:text-slate-300 text-[11px]">
                Read only cells - External data replicated from another sheet
              </span>
            </div>

            {/* Calculated Subtotal Risk Point */}
            <div className="flex items-center gap-2.5">
              <div className="w-18 h-5 shrink-0 bg-[#2e75b6] border border-blue-700 text-white text-[10px] font-black font-mono flex items-center justify-center shadow-sm">
                X
              </div>
              <span className="italic text-slate-600 dark:text-slate-300 text-[11px] font-medium">
                Read only cells - Calculated Subtotal Risk Point
              </span>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 4. REAL EXCEL-STYLE BOTTOM TAB BAR (Matching all 5 screenshots)      */}
        {/* ==================================================================== */}
        <div className="flex items-center justify-between bg-slate-200 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 px-2 py-1 overflow-x-auto select-none">
          {/* Left Arrow Controls */}
          <div className="flex items-center gap-0.5 text-slate-600 dark:text-slate-400 shrink-0 mr-1">
            <button
              type="button"
              className="p-1 hover:bg-slate-300 dark:hover:bg-slate-800 rounded text-xs"
              onClick={() => {
                const tabs: DomainTab[] = [
                  "Acknowledgements",
                  "Setup&Configuration",
                  "IndicatorMaps",
                  "PopulationImmunity",
                  "SurveillanceQuality",
                  "ProgramDeliveryPerformance",
                  "VulnerableGroups",
                  "ThreatAssessment",
                  "MeaslesIncidence",
                  "Case-Based-Data",
                ];
                const curIdx = tabs.indexOf(activeTab);
                if (curIdx > 0) setActiveTab(tabs[curIdx - 1]);
              }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="p-1 hover:bg-slate-300 dark:hover:bg-slate-800 rounded text-xs"
              onClick={() => {
                const tabs: DomainTab[] = [
                  "Acknowledgements",
                  "Setup&Configuration",
                  "IndicatorMaps",
                  "PopulationImmunity",
                  "SurveillanceQuality",
                  "ProgramDeliveryPerformance",
                  "VulnerableGroups",
                  "ThreatAssessment",
                  "MeaslesIncidence",
                  "Case-Based-Data",
                ];
                const curIdx = tabs.indexOf(activeTab);
                if (curIdx < tabs.length - 1) setActiveTab(tabs[curIdx + 1]);
              }}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 text-xs font-mono font-bold text-slate-500">...</span>
          </div>

          {/* Colored Excel Sheet Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto flex-nowrap py-0.5">
            {/* Acknowledgements */}
            <button
              type="button"
              onClick={() => setActiveTab("Acknowledgements")}
              className={`px-3 py-1 text-xs font-semibold rounded-t border-t border-x transition-all shrink-0 ${
                activeTab === "Acknowledgements"
                  ? "bg-[#fffc00] text-slate-950 border-amber-400 shadow-sm border-b-2 border-b-emerald-600 ring-1 ring-amber-300"
                  : "bg-[#fffc00]/80 text-slate-900 border-amber-300/60 hover:bg-[#fffc00]"
              }`}
            >
              Acknowledgements
            </button>

            {/* Setup&Configuration */}
            <button
              type="button"
              onClick={() => setActiveTab("Setup&Configuration")}
              className={`px-3 py-1 text-xs font-semibold rounded-t border-t border-x transition-all shrink-0 ${
                activeTab === "Setup&Configuration"
                  ? "bg-[#ff0000] text-white border-red-700 shadow-sm border-b-2 border-b-emerald-600 ring-1 ring-red-400"
                  : "bg-[#ff0000]/85 text-white border-red-600 hover:bg-[#ff0000]"
              }`}
            >
              Setup&Configuration
            </button>

            {/* IndicatorMaps */}
            <button
              type="button"
              onClick={() => setActiveTab("IndicatorMaps")}
              className={`px-3 py-1 text-xs font-semibold rounded-t border-t border-x transition-all shrink-0 ${
                activeTab === "IndicatorMaps"
                  ? "bg-[#5b9bd5] text-white border-blue-600 shadow-sm border-b-2 border-b-emerald-600 ring-1 ring-blue-300"
                  : "bg-[#5b9bd5]/85 text-white border-blue-400 hover:bg-[#5b9bd5]"
              }`}
            >
              IndicatorMaps
            </button>

            {/* PopulationImmunity (Sheet 4) */}
            <button
              type="button"
              onClick={() => setActiveTab("PopulationImmunity")}
              className={`px-3 py-1 text-xs font-semibold rounded-t border-t border-x transition-all shrink-0 ${
                activeTab === "PopulationImmunity"
                  ? "bg-[#2e75b6] text-white border-blue-800 shadow-sm border-b-2 border-b-emerald-500 ring-2 ring-emerald-500/80"
                  : "bg-[#2e75b6]/85 text-white border-blue-700 hover:bg-[#2e75b6]"
              }`}
            >
              PopulationImmunity
            </button>

            {/* SurveillanceQuality (Sheet 5) */}
            <button
              type="button"
              onClick={() => setActiveTab("SurveillanceQuality")}
              className={`px-3 py-1 text-xs font-semibold rounded-t border-t border-x transition-all shrink-0 ${
                activeTab === "SurveillanceQuality"
                  ? "bg-[#002060] text-white border-blue-950 shadow-sm border-b-2 border-b-emerald-500 ring-2 ring-emerald-500/80"
                  : "bg-[#002060]/85 text-white border-blue-900 hover:bg-[#002060]"
              }`}
            >
              SurveillanceQuality
            </button>

            {/* ProgramDeliveryPerformance (Sheet 6) */}
            <button
              type="button"
              onClick={() => setActiveTab("ProgramDeliveryPerformance")}
              className={`px-3 py-1 text-xs font-semibold rounded-t border-t border-x transition-all shrink-0 ${
                activeTab === "ProgramDeliveryPerformance"
                  ? "bg-[#c65911] text-white border-amber-800 shadow-sm border-b-2 border-b-emerald-500 ring-2 ring-emerald-500/80"
                  : "bg-[#c65911]/85 text-white border-amber-700 hover:bg-[#c65911]"
              }`}
            >
              ProgramDeliveryPerformance
            </button>

            {/* VulnerableGroups (Sheet 7) */}
            <button
              type="button"
              onClick={() => setActiveTab("VulnerableGroups")}
              className={`px-3 py-1 text-xs font-semibold rounded-t border-t border-x transition-all shrink-0 ${
                activeTab === "VulnerableGroups"
                  ? "bg-[#e05656] text-white border-red-700 shadow-sm border-b-2 border-b-emerald-500 ring-2 ring-emerald-500/80"
                  : "bg-[#e05656]/85 text-white border-red-600 hover:bg-[#e05656]"
              }`}
            >
              VulnerableGroups
            </button>

            {/* ThreatAssessment (Sheet 8) */}
            <button
              type="button"
              onClick={() => setActiveTab("ThreatAssessment")}
              className={`px-3 py-1 text-xs font-semibold rounded-t border-t border-x transition-all shrink-0 ${
                activeTab === "ThreatAssessment"
                  ? "bg-[#7030a0] text-white border-purple-900 shadow-sm border-b-2 border-b-emerald-500 ring-2 ring-emerald-500/80"
                  : "bg-[#7030a0]/85 text-white border-purple-800 hover:bg-[#7030a0]"
              }`}
            >
              ThreatAssessment
            </button>

            {/* MeaslesIncidence */}
            <button
              type="button"
              onClick={() => setActiveTab("MeaslesIncidence")}
              className={`px-3 py-1 text-xs font-semibold rounded-t border-t border-x transition-all shrink-0 ${
                activeTab === "MeaslesIncidence"
                  ? "bg-[#00b050] text-white border-emerald-700 shadow-sm border-b-2 border-b-emerald-400 ring-1 ring-emerald-300"
                  : "bg-[#00b050]/85 text-white border-emerald-600 hover:bg-[#00b050]"
              }`}
            >
              MeaslesIncidence
            </button>

            {/* Case-Based-Data */}
            <button
              type="button"
              onClick={() => setActiveTab("Case-Based-Data")}
              className={`px-3 py-1 text-xs font-semibold rounded-t border-t border-x transition-all shrink-0 ${
                activeTab === "Case-Based-Data"
                  ? "bg-[#00b0f0] text-white border-cyan-600 shadow-sm border-b-2 border-b-emerald-400 ring-1 ring-cyan-300"
                  : "bg-[#00b0f0]/85 text-white border-cyan-500 hover:bg-[#00b0f0]"
              }`}
            >
              Case-Based-Data
            </button>
          </div>

          {/* Right Scroll Tools */}
          <div className="flex items-center gap-1 text-slate-500 shrink-0 ml-2">
            <button type="button" className="p-1 hover:bg-slate-300 dark:hover:bg-slate-800 rounded">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <div className="w-16 h-2 bg-slate-300 dark:bg-slate-700 rounded-full" />
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
              ) : bulkDialogField?.startsWith("vuln_") ? (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="Select Y or N..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Y">Y (Yes - Active factor)</SelectItem>
                    <SelectItem value="N">N (No - Factor not present)</SelectItem>
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
              Apply to Scope
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
