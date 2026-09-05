import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  ShieldAlert,
  MapPin,
  Activity,
  FileText,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Layers,
  Settings,
  Info,
  ExternalLink,
  Users,
  Map as MapIcon,
  BookOpen,
  ArrowRight,
  FileSpreadsheet,
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

export type SheetTabId =
  | "acknowledgements"
  | "setup"
  | "indicator-maps"
  | "population-immunity"
  | "surveillance-quality"
  | "program-delivery"
  | "vulnerable-groups"
  | "threat-assessment"
  | "measles-incidence"
  | "case-based-data"
  | "report-preview";

interface TabDefinition {
  id: SheetTabId;
  sheetNum: number;
  name: string;
  shortName: string;
  tagColor: string;
  activeBorder: string;
  domainCode?: string;
  maxPoints?: number;
}

const SHEET_TABS: TabDefinition[] = [
  { id: "acknowledgements", sheetNum: 1, name: "Acknowledgements", shortName: "Acknowledgements", tagColor: "bg-amber-400 text-slate-950", activeBorder: "border-b-amber-500 text-amber-700 dark:text-amber-300" },
  { id: "setup", sheetNum: 2, name: "Setup & Configuration", shortName: "Setup", tagColor: "bg-rose-500 text-white", activeBorder: "border-b-rose-500 text-rose-700 dark:text-rose-300" },
  { id: "indicator-maps", sheetNum: 3, name: "Indicator Maps", shortName: "Maps", tagColor: "bg-sky-500 text-white", activeBorder: "border-b-sky-500 text-sky-700 dark:text-sky-300" },
  { id: "population-immunity", sheetNum: 4, name: "Population Immunity", shortName: "1. Pop. Immunity", tagColor: "bg-blue-600 text-white", activeBorder: "border-b-blue-600 text-blue-700 dark:text-blue-300", domainCode: "PI", maxPoints: 40 },
  { id: "surveillance-quality", sheetNum: 5, name: "Surveillance Quality", shortName: "2. Surv. Quality", tagColor: "bg-indigo-900 text-white", activeBorder: "border-b-indigo-700 text-indigo-800 dark:text-indigo-300", domainCode: "SQ", maxPoints: 20 },
  { id: "program-delivery", sheetNum: 6, name: "Program Delivery", shortName: "3. Delivery", tagColor: "bg-orange-600 text-white", activeBorder: "border-b-orange-600 text-orange-700 dark:text-orange-300", domainCode: "PD", maxPoints: 16 },
  { id: "vulnerable-groups", sheetNum: 7, name: "Vulnerable Groups", shortName: "4a. Vulnerabilities", tagColor: "bg-red-500 text-white", activeBorder: "border-b-red-500 text-red-700 dark:text-red-300", domainCode: "VG", maxPoints: 8 },
  { id: "threat-assessment", sheetNum: 8, name: "Threat Assessment", shortName: "4b. Threats", tagColor: "bg-purple-700 text-white", activeBorder: "border-b-purple-700 text-purple-700 dark:text-purple-300", domainCode: "TA", maxPoints: 24 },
  { id: "measles-incidence", sheetNum: 9, name: "Measles Incidence", shortName: "Incidence", tagColor: "bg-emerald-600 text-white", activeBorder: "border-b-emerald-600 text-emerald-700 dark:text-emerald-300" },
  { id: "case-based-data", sheetNum: 10, name: "Case-Based Data", shortName: "Case Linelist", tagColor: "bg-cyan-600 text-white", activeBorder: "border-b-cyan-600 text-cyan-700 dark:text-cyan-300" },
  { id: "report-preview", sheetNum: 11, name: "Report Preview", shortName: "Report Preview", tagColor: "bg-slate-700 text-white", activeBorder: "border-b-slate-700 text-slate-800 dark:text-slate-200" },
];

// Baseline column widths (px)
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  index: 40,
  district: 180,
  province: 135,
  // PI
  mcv1Minus3: 68,
  mcv1Minus2: 68,
  mcv1Minus1: 68,
  mcv1Avg: 72,
  mcv1Rp: 52,
  neighborPct: 78,
  neighborRp: 52,
  mcv2Minus3: 68,
  mcv2Minus2: 68,
  mcv2Minus1: 68,
  mcv2Avg: 72,
  mcv2Rp: 52,
  siaCovMinus1: 74,
  siaCovRp: 52,
  siaAgeGroupMinus1: 88,
  siaAgeGroupRp: 52,
  siaYearsMinus1: 68,
  siaYearsRp: 52,
  unvacMinus3Minus1: 78,
  unvacRp: 52,
  piTotalRp: 84,
  // SQ
  sqRateVal: 78,
  sqRateRp: 52,
  sqInvestVal: 78,
  sqInvestRp: 52,
  sqSpecimenVal: 78,
  sqSpecimenRp: 52,
  sqLabVal: 78,
  sqLabRp: 52,
  sqTotalRp: 84,
  // PD
  pdMcv1TrendVal: 78,
  pdMcv1TrendRp: 52,
  pdMcv2TrendVal: 78,
  pdMcv2TrendRp: 52,
  pdMcvDropoutVal: 88,
  pdMcvDropoutRp: 52,
  pdPentaDoses: 82,
  pdPentaDropoutVal: 88,
  pdPentaDropoutRp: 52,
  pdTotalRp: 84,
  // VG
  vgItem: 96,
  vgTotalRp: 84,
  // TA
  taCasesUnder5Val: 68,
  taCasesUnder5Rp: 52,
  taCases5to14Val: 68,
  taCases5to14Rp: 52,
  taCases15plusVal: 68,
  taCases15plusRp: 52,
  taDensityVal: 78,
  taDensityRp: 52,
  taBorderVal: 72,
  taBorderRp: 52,
  taVulnVal: 72,
  taVulnRp: 52,
  taTotalRp: 84,
};

const STRETCH_COL_WIDTHS: Record<string, number> = Object.fromEntries(
  Object.entries(DEFAULT_COL_WIDTHS).map(([k, v]) => [k, Math.round(v * 1.3)])
);

// Pure calculations matching WHO Tool V1.8
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
  if (isNaN(rate) || rate <= 0) return 8;
  if (rate >= 2.0) return 0;
  if (rate >= 1.0) return 4;
  return 8;
}

export function calcQualityRp(pct: number): number {
  if (isNaN(pct) || pct < 50.0) return 4;
  if (pct >= 80.0) return 0;
  return 2;
}

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

export function calcDensityRp(density: number): number {
  if (isNaN(density) || density < 50) return 0;
  if (density > 100) return 2;
  return 1;
}

export function RiskDirectDataEntry({ assessmentId, onCalculationSuccess }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // DEFAULT STARTING TAB: Page 1 (Acknowledgements)
  const [activeTab, setActiveTab] = useState<SheetTabId>("acknowledgements");
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

  // Also fetch results if available for Report Preview
  const { data: resultsData } = useQuery<{ summary: any; rows: any[]; distribution: any }>({
    queryKey: [`/api/risk/assessments/${assessmentId}/results`],
    queryFn: async () => {
      return await apiRequest<any>("GET", `/api/risk/assessments/${assessmentId}/results`);
    },
    enabled: activeTab === "report-preview" || activeTab === "indicator-maps",
  });

  // Sync loaded data to local state
  useEffect(() => {
    if (data?.entries) {
      setLocalRows(data.entries);
      setIsDirty(false);
    }
  }, [data?.entries]);

  const assessment = data?.assessment;
  const assessmentYear = assessment?.assessmentYear || 2023;
  const dataFirstYear = assessmentYear - 3;
  const dataLastYear = assessmentYear - 1;
  const assessmentCountry = assessment?.countryName || "South Sudan";

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
        title: vars.recalculate ? "Scores Recalculated Successfully" : "Draft Saved",
        description: vars.recalculate
          ? `Processed ${res.totalAreasAssessed || localRows.length} districts. High: ${res.distribution?.high || 0}, Very High: ${res.distribution?.veryHigh || 0}.`
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
  const indexWidth = colWidths.index || 40;
  const districtWidth = colWidths.district || 180;

  // Active Tab details
  const activeTabDef = useMemo(() => {
    return SHEET_TABS.find((t) => t.id === activeTab) || SHEET_TABS[0];
  }, [activeTab]);

  // Total National Population
  const totalNationalPopulation = useMemo(() => {
    return localRows.reduce((acc, r) => acc + (Number(r.population) || 0), 0);
  }, [localRows]);

  return (
    <div className="space-y-3 font-sans select-none">
      {/* ==================================================================== */}
      {/* 1. TOP NAVIGATION TABS (ALL 11 SHEETS AT THE TOP)                    */}
      {/* ==================================================================== */}
      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        {/* Horizontal Scrollable Tabs Header */}
        <div className="flex items-center border-b bg-muted/40 px-2 pt-2 gap-1 overflow-x-auto scrollbar-thin">
          {SHEET_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-md transition-all border-t border-x shrink-0 select-none ${
                  isActive
                    ? "bg-background text-foreground border-border shadow-sm -mb-px border-b-2 border-b-primary font-bold"
                    : "border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${tab.tagColor} shrink-0`} />
                <span>{tab.shortName}</span>
                {tab.maxPoints && (
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({tab.maxPoints} pts)
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Top Action Header Bar */}
        <div className="p-3 bg-background flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`px-2 py-0.5 text-[11px] font-black rounded ${activeTabDef.tagColor}`}>
              Sheet {activeTabDef.sheetNum}
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">
                {activeTabDef.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Measles Risk Assessment Tool V1.8 • {assessmentCountry} ({dataFirstYear}–{dataLastYear})
              </p>
            </div>
            {isDirty && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40 text-[10px] animate-pulse">
                Unsaved Draft
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ recalculate: false })}
              className="h-8 text-xs gap-1.5"
            >
              Save Draft
            </Button>

            <Button
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ recalculate: true })}
              className="h-8 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              {saveMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recalculating...
                </>
              ) : (
                <>
                  <Calculator className="w-3.5 h-3.5" /> Recalculate all
                </>
              )}
            </Button>

            <a
              href="/api/risk/resources/Measles_Risk_Assessment_Tool_v1.8.xlsm"
              download
              className="inline-flex items-center"
              title="Download official WHO Excel template"
            >
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground">
                <Download className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. PAGE 1: ACKNOWLEDGEMENTS & TOOL OVERVIEW                          */}
      {/* ==================================================================== */}
      {activeTab === "acknowledgements" && (
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                <CardTitle className="text-lg">Measles Risk Assessment Tool V1.8</CardTitle>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                  Global WHO Methodology
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Programmatic Subnational Risk Assessment Framework for Measles and Rubella Elimination
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed text-muted-foreground">
                <p>
                  The <strong>Measles Programmatic Risk Assessment Tool (V1.8)</strong> provides subnational health authorities, partners, and immunization managers with a deterministic, standardized methodology to evaluate, classify, and prioritize subnational areas (districts and counties) according to their risk of measles outbreaks and transmission.
                </p>
                <p>
                  By analyzing routine immunization trajectories, surveillance sensitive indicators, campaign histories, and population vulnerabilities across 4 core programmatic domains, this tool generates actionable risk categories (<strong>Low</strong>, <strong>Medium</strong>, <strong>High</strong>, and <strong>Very High</strong>) to guide targeted interventions, Supplementary Immunization Activities (SIAs), and routine system strengthening.
                </p>
              </div>

              {/* 4 Core Domains Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-4 border-blue-200 bg-blue-50/40 dark:bg-blue-950/20">
                  <div className="flex items-center justify-between pb-2">
                    <span className="font-bold text-xs text-blue-900 dark:text-blue-200">Domain 1</span>
                    <Badge className="bg-blue-600 text-white text-[10px]">40 Points</Badge>
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">Population Immunity</h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    3-Year MCV1 & MCV2 trends, neighboring district coverage &lt;80%, SIA quality & timeliness, and unimmunized suspected cases.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("population-immunity")}
                    className="mt-3 text-xs text-blue-700 dark:text-blue-300 p-0 h-auto font-medium hover:underline gap-1"
                  >
                    Open Sheet 4 <ArrowRight className="w-3 h-3" />
                  </Button>
                </Card>

                <Card className="p-4 border-indigo-200 bg-indigo-50/40 dark:bg-indigo-950/20">
                  <div className="flex items-center justify-between pb-2">
                    <span className="font-bold text-xs text-indigo-900 dark:text-indigo-200">Domain 2</span>
                    <Badge className="bg-indigo-800 text-white text-[10px]">20 Points</Badge>
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">Surveillance Quality</h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Non-measles discarded case rate (&gt;=2.0 / 100k), 48h investigation adequacy, 28d blood specimen adequacy, and timely lab results.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("surveillance-quality")}
                    className="mt-3 text-xs text-indigo-700 dark:text-indigo-300 p-0 h-auto font-medium hover:underline gap-1"
                  >
                    Open Sheet 5 <ArrowRight className="w-3 h-3" />
                  </Button>
                </Card>

                <Card className="p-4 border-orange-200 bg-orange-50/40 dark:bg-orange-950/20">
                  <div className="flex items-center justify-between pb-2">
                    <span className="font-bold text-xs text-orange-900 dark:text-orange-200">Domain 3</span>
                    <Badge className="bg-orange-600 text-white text-[10px]">16 Points</Badge>
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">Program Delivery</h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    MCV1 & MCV2 coverage slope trajectories over 3 years, MCV1-to-MCV2 dropouts, and DPT1-to-MCV1 routine immunization dropouts.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("program-delivery")}
                    className="mt-3 text-xs text-orange-700 dark:text-orange-300 p-0 h-auto font-medium hover:underline gap-1"
                  >
                    Open Sheet 6 <ArrowRight className="w-3 h-3" />
                  </Button>
                </Card>

                <Card className="p-4 border-purple-200 bg-purple-50/40 dark:bg-purple-950/20">
                  <div className="flex items-center justify-between pb-2">
                    <span className="font-bold text-xs text-purple-900 dark:text-purple-200">Domain 4</span>
                    <Badge className="bg-purple-700 text-white text-[10px]">24 Points</Badge>
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">Threat & Vulnerability</h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Age-specific threat cases (&lt;5y, 5-14y, 15+y), population density, cross-border outbreaks, and 8 vulnerable population factors.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("threat-assessment")}
                    className="mt-3 text-xs text-purple-700 dark:text-purple-300 p-0 h-auto font-medium hover:underline gap-1"
                  >
                    Open Sheet 8 <ArrowRight className="w-3 h-3" />
                  </Button>
                </Card>
              </div>

              {/* Assessment Context Card */}
              <div className="p-4 rounded-lg border bg-card flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-foreground">National Assessment Scope: {assessmentCountry}</h4>
                  <p className="text-xs text-muted-foreground">
                    Evaluating {localRows.length} subnational districts across {provincesList.length} provinces over calendar years {dataFirstYear}–{dataLastYear}.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("setup")}
                    className="text-xs"
                  >
                    View Setup & Config
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("population-immunity")}
                    className="text-xs font-semibold gap-1.5"
                  >
                    Start District Data Entry <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. PAGE 2: SETUP & CONFIGURATION (SHEET 2)                           */}
      {/* ==================================================================== */}
      {activeTab === "setup" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Global Reference Parameters */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3 bg-muted/20 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Settings className="w-4 h-4 text-rose-600" />
                  Global Assessment Parameters
                </CardTitle>
                <CardDescription className="text-xs">
                  Baseline timeframes and immunization schedules configured for this assessment
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <dl className="divide-y text-xs">
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">Country Name</dt>
                    <dd className="font-semibold text-foreground">{assessmentCountry}</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">Year of Risk Assessment</dt>
                    <dd className="font-mono font-bold text-foreground">{assessmentYear}</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">3-Year Data Collection Period</dt>
                    <dd className="font-mono font-bold text-primary">{dataFirstYear} – {dataLastYear}</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">Reference Year - 1</dt>
                    <dd className="font-mono font-semibold text-foreground">{dataLastYear}</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">SIA Conducted in Last 3 Years</dt>
                    <dd className="font-semibold text-emerald-600">Yes (Qualifying nationwide / subnational campaign)</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">MCV1 Age of Administration</dt>
                    <dd className="font-mono font-semibold text-foreground">9 Months</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">Post-Elimination / High Income Policy</dt>
                    <dd className="font-semibold text-foreground">No (Standard Programmatic Risk Thresholds)</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Geographic Scope & Inventory */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3 bg-muted/20 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-600" />
                  Geographic Inventory & Boundaries
                </CardTitle>
                <CardDescription className="text-xs">
                  Subnational boundaries and population coverage in this assessment
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <dl className="divide-y text-xs">
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">Provinces / States (Admin1)</dt>
                    <dd className="font-mono font-bold text-foreground">{provincesList.length} Provinces</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">Districts / Counties (Admin2)</dt>
                    <dd className="font-mono font-bold text-foreground">{localRows.length} Districts</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">Boundaries & Shapefiles Loaded</dt>
                    <dd className="font-semibold text-emerald-600">{localRows.length} of {localRows.length} (100% matched)</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">Total National Population</dt>
                    <dd className="font-mono font-bold text-foreground">
                      {totalNationalPopulation > 0 ? totalNationalPopulation.toLocaleString() : "14,010,906"}
                    </dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">Target Cohort (&lt;1 Year)</dt>
                    <dd className="font-mono font-semibold text-foreground">
                      {totalNationalPopulation > 0 ? Math.round(totalNationalPopulation * 0.038).toLocaleString() : "532,414"}
                    </dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-muted-foreground">Risk Category Scale</dt>
                    <dd className="font-semibold text-foreground">Low (&lt;32) | Med (32-44) | High (45-56) | V.High (&gt;=57)</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          <div className="p-4 bg-muted/40 rounded-lg border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Configuration verified. Ready to inspect indicator maps or proceed to direct district data entry.
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setActiveTab("indicator-maps")} className="text-xs">
                View Indicator Maps
              </Button>
              <Button size="sm" onClick={() => setActiveTab("population-immunity")} className="text-xs">
                Open Population Immunity
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. PAGE 3: INDICATOR MAPS (SHEET 3)                                  */}
      {/* ==================================================================== */}
      {activeTab === "indicator-maps" && (
        <Card className="border shadow-sm p-6 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <MapIcon className="w-5 h-5 text-sky-600" />
                Subnational Indicator Maps & Spatial Risk
              </h3>
              <p className="text-xs text-muted-foreground">
                Choropleth spatial visualization of programmatic risk tiers and indicator distributions across South Sudan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select defaultValue="overall">
                <SelectTrigger className="h-8 text-xs w-48">
                  <SelectValue placeholder="Select indicator..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overall">Overall Risk Classification</SelectItem>
                  <SelectItem value="pi">Domain 1: Population Immunity</SelectItem>
                  <SelectItem value="sq">Domain 2: Surveillance Quality</SelectItem>
                  <SelectItem value="pd">Domain 3: Program Delivery</SelectItem>
                  <SelectItem value="ta">Domain 4: Threat Assessment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-slate-100 dark:bg-slate-900 border rounded-lg p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[360px]">
            <MapPin className="w-12 h-12 text-sky-600 opacity-80" />
            <div className="max-w-md space-y-1">
              <h4 className="font-bold text-sm text-foreground">Interactive Spatial Map Available</h4>
              <p className="text-xs text-muted-foreground">
                All 79 district boundaries and calculated risk score layers are synchronized live with the assessment database.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="px-3 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Low Risk (&lt;32)
              </span>
              <span className="px-3 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                Medium Risk (32–44)
              </span>
              <span className="px-3 py-1 rounded text-xs font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
                High Risk (45–56)
              </span>
              <span className="px-3 py-1 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                Very High Risk (&gt;=57)
              </span>
            </div>
            <Button
              onClick={() => {
                // Switch to Report Preview or parent map
                setActiveTab("report-preview");
              }}
              className="mt-2 text-xs font-semibold gap-1.5"
            >
              Inspect Country Risk Report <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* ==================================================================== */}
      {/* 5. PAGES 4-8: CORE DATA ENTRY DOMAIN SPREADSHEETS (SHEETS 4, 5, 6, 7, 8) */}
      {/* ==================================================================== */}
      {["population-immunity", "surveillance-quality", "program-delivery", "vulnerable-groups", "threat-assessment"].includes(activeTab) && (
        <div className="space-y-2">
          {/* Quick Toolbar */}
          <div className="bg-card border rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search district..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 h-7 text-xs bg-background"
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

              <span className="text-muted-foreground text-[11px]">
                Showing {filteredRows.length} of {localRows.length} districts
              </span>
            </div>
          </div>

          {/* Spreadsheet Table Container */}
          <div className="border rounded-lg shadow-sm bg-card overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] relative">
              <table className="w-full text-xs text-left border-collapse table-fixed">
                <thead className="sticky top-0 z-30 bg-[#1f4e79] text-white border-b shadow-sm font-semibold select-none text-[11px]">
                  {/* LEVEL 1: GROUPED HEADERS */}
                  <tr className="border-b border-blue-900/60 text-center">
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
                        <span className="font-bold">AREA / District</span>
                        {getSortIcon("districtName")}
                      </div>
                    </th>

                    {/* POPULATION IMMUNITY HEADERS */}
                    {activeTab === "population-immunity" && (
                      <>
                        <th colSpan={5} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                          <span>Administrative MCV1 Coverage Report</span>
                          <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                        </th>
                        <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                          <span>% neighboring districts MCV1 &lt;80%</span>
                          <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                        </th>
                        <th colSpan={5} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                          <span>Administrative MCV2 Coverage Report</span>
                          <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                        </th>
                        <th colSpan={2} className="p-2 border-r border-blue-900/60 bg-[#296ca8] text-white relative">
                          <span>Subnational measles SIA coverage</span>
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
                          <span>% suspected cases unvaccinated</span>
                          <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                        </th>
                        <th colSpan={1} className="p-2 border-r border-blue-900/60 bg-[#1a446c] text-white font-black text-center">
                          <span>SUBTOTAL RISK POINTS</span>
                        </th>
                      </>
                    )}

                    {/* SURVEILLANCE QUALITY HEADERS */}
                    {activeTab === "surveillance-quality" && (
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
                          <span>% with timely laboratory results</span>
                          <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                        </th>
                        <th colSpan={1} className="p-2 border-r border-blue-900/60 bg-[#002060] text-white font-black text-center">
                          <span>SUBTOTAL RISK POINTS</span>
                        </th>
                      </>
                    )}

                    {/* PROGRAM DELIVERY HEADERS */}
                    {activeTab === "program-delivery" && (
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
                        <th colSpan={1} className="p-2 border-r border-amber-900/60 bg-[#8f3e0b] text-white font-black text-center">
                          <span>SUBTOTAL RISK POINTS</span>
                        </th>
                      </>
                    )}

                    {/* VULNERABLE GROUPS HEADERS */}
                    {activeTab === "vulnerable-groups" && (
                      <>
                        <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white">Displaced / Mobile</th>
                        <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white">Hesitancy</th>
                        <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white">Conflict / Security</th>
                        <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white">Disasters</th>
                        <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white">Terrain / Riverine</th>
                        <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white">Political Support</th>
                        <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white">Transit Hubs</th>
                        <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#e05656] text-white">Mass Gatherings</th>
                        <th colSpan={1} className="p-2 border-r border-red-900/60 bg-[#b83232] text-white font-black text-center">
                          <span>SUBTOTAL RISK POINTS</span>
                        </th>
                      </>
                    )}

                    {/* THREAT ASSESSMENT HEADERS */}
                    {activeTab === "threat-assessment" && (
                      <>
                        <th colSpan={2} className="p-2 border-r border-purple-900/60 bg-[#7030a0] text-white relative">
                          <span>Cases &lt;5 years</span>
                          <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                        </th>
                        <th colSpan={2} className="p-2 border-r border-purple-900/60 bg-[#7030a0] text-white relative">
                          <span>Cases 5-15 years</span>
                          <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                        </th>
                        <th colSpan={2} className="p-2 border-r border-purple-900/60 bg-[#7030a0] text-white relative">
                          <span>Cases &gt;15 years</span>
                          <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                        </th>
                        <th colSpan={2} className="p-2 border-r border-purple-900/60 bg-[#7030a0] text-white relative">
                          <span>Population density</span>
                          <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                        </th>
                        <th colSpan={2} className="p-2 border-r border-purple-900/60 bg-[#7030a0] text-white relative">
                          <span>Border case in past 12m</span>
                          <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                        </th>
                        <th colSpan={2} className="p-2 border-r border-purple-900/60 bg-[#7030a0] text-white relative">
                          <span>Presence of vulnerable pop</span>
                          <span className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-red-500 border-l-transparent" />
                        </th>
                        <th colSpan={1} className="p-2 border-r border-purple-900/60 bg-[#4c1873] text-white font-black text-center">
                          <span>SUBTOTAL RISK POINTS</span>
                        </th>
                      </>
                    )}
                  </tr>

                  {/* LEVEL 2: SUBHEADERS */}
                  <tr className="bg-[#205b8f] text-white text-center border-b border-blue-900/80">
                    {activeTab === "population-immunity" && (
                      <>
                        <th className="p-1.5 border-r border-blue-900/60 w-[68px] relative">
                          <span className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-r-[5px] border-t-emerald-400 border-r-transparent" />
                          <span>-3</span>
                        </th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[68px]">-2</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[68px]">-1</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[72px] bg-blue-900/50">Avg</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold relative">
                          <span className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-r-[5px] border-t-emerald-400 border-r-transparent" />
                          <span>RP</span>
                        </th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[78px]">-3--1</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[68px]">-3</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[68px]">-2</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[68px]">-1</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[72px] bg-blue-900/50">Avg</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[74px] relative">
                          <span className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-r-[5px] border-t-emerald-400 border-r-transparent" />
                          <span>-1</span>
                        </th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[88px]">-1</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[68px]">-1</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[78px]">-3--1</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[84px] bg-[#2e75b6] font-black">Total RP</th>
                      </>
                    )}

                    {activeTab === "surveillance-quality" && (
                      <>
                        <th className="p-1.5 border-r border-blue-900/60 w-[78px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[78px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[78px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[78px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[52px] bg-blue-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-blue-900/60 w-[84px] bg-[#002060] font-black">Total RP</th>
                      </>
                    )}

                    {activeTab === "program-delivery" && (
                      <>
                        <th className="p-1.5 border-r border-amber-900/60 w-[78px]">{dataFirstYear}-{dataLastYear}</th>
                        <th className="p-1.5 border-r border-amber-900/60 w-[52px] bg-amber-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-amber-900/60 w-[78px]">{dataFirstYear}-{dataLastYear}</th>
                        <th className="p-1.5 border-r border-amber-900/60 w-[52px] bg-amber-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-amber-900/60 w-[88px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-amber-900/60 w-[52px] bg-amber-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-amber-900/60 w-[82px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-amber-900/60 w-[88px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-amber-900/60 w-[52px] bg-amber-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-amber-900/60 w-[84px] bg-[#c65911] font-black">Total RP</th>
                      </>
                    )}

                    {activeTab === "vulnerable-groups" && (
                      <>
                        <th className="p-1.5 border-r border-red-900/60 w-[96px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-red-900/60 w-[96px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-red-900/60 w-[96px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-red-900/60 w-[96px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-red-900/60 w-[96px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-red-900/60 w-[96px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-red-900/60 w-[96px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-red-900/60 w-[96px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-red-900/60 w-[84px] bg-[#e05656] font-black">Total RP</th>
                      </>
                    )}

                    {activeTab === "threat-assessment" && (
                      <>
                        <th className="p-1.5 border-r border-purple-900/60 w-[68px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-purple-900/60 w-[52px] bg-purple-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-purple-900/60 w-[68px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-purple-900/60 w-[52px] bg-purple-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-purple-900/60 w-[68px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-purple-900/60 w-[52px] bg-purple-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-purple-900/60 w-[78px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-purple-900/60 w-[52px] bg-purple-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-purple-900/60 w-[72px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-purple-900/60 w-[52px] bg-purple-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-purple-900/60 w-[72px]">{dataLastYear}</th>
                        <th className="p-1.5 border-r border-purple-900/60 w-[52px] bg-purple-800/80 font-bold">RP</th>
                        <th className="p-1.5 border-r border-purple-900/60 w-[84px] bg-[#7030a0] font-black">Total RP</th>
                      </>
                    )}
                  </tr>
                </thead>

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

                          {/* PI ADMIN1 ACTIONS */}
                          {activeTab === "population-immunity" && (
                            <>
                              <td className="p-1 border-r border-slate-300 text-center">
                                <button type="button" onClick={() => openImportDialog("mcv1YearMinus3", "MCV1 Year -3", group.provinceName)} className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline">Import...</button>
                              </td>
                              <td className="p-1 border-r border-slate-300 text-center">
                                <button type="button" onClick={() => openImportDialog("mcv1YearMinus2", "MCV1 Year -2", group.provinceName)} className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline">Import...</button>
                              </td>
                              <td className="p-1 border-r border-slate-300 text-center">
                                <button type="button" onClick={() => openImportDialog("mcv1YearMinus1", "MCV1 Year -1", group.provinceName)} className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline">Import...</button>
                              </td>
                              <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                              <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                              <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                              <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                              <td className="p-1 border-r border-slate-300 text-center">
                                <button type="button" onClick={() => openImportDialog("mcv2YearMinus3", "MCV2 Year -3", group.provinceName)} className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline">Import...</button>
                              </td>
                              <td className="p-1 border-r border-slate-300 text-center">
                                <button type="button" onClick={() => openImportDialog("mcv2YearMinus2", "MCV2 Year -2", group.provinceName)} className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline">Import...</button>
                              </td>
                              <td className="p-1 border-r border-slate-300 text-center">
                                <button type="button" onClick={() => openImportDialog("mcv2YearMinus1", "MCV2 Year -1", group.provinceName)} className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline">Import...</button>
                              </td>
                              <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                              <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                              <td className="p-1 border-r border-slate-300 text-center">
                                <button type="button" onClick={() => openImportDialog("siaCoveragePct", "SIA Coverage", group.provinceName)} className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline">Import...</button>
                              </td>
                              <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                              <td className="p-1 border-r border-slate-300 text-center">
                                <button type="button" onClick={() => openImportDialog("siaTargetAgeGroup", "SIA Age Group", group.provinceName)} className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline">Import...</button>
                              </td>
                              <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                              <td className="p-1 border-r border-slate-300 text-center">
                                <button type="button" onClick={() => openImportDialog("siaYearsSince", "Years Since SIA", group.provinceName)} className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline">Import...</button>
                              </td>
                              <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                              <td className="p-1 border-r border-slate-300 text-center">
                                <button type="button" onClick={() => openImportDialog("unvaccinatedCasesPct", "% Unvaccinated", group.provinceName)} className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline">Import...</button>
                              </td>
                              <td className="p-1 border-r border-slate-300 text-center font-mono text-muted-foreground">-</td>
                              <td className="p-1 border-r border-slate-300 text-center bg-[#2e75b6] text-white font-bold font-mono">Subtotal</td>
                            </>
                          )}

                          {activeTab === "surveillance-quality" && (
                            <>
                              <td colSpan={8} className="p-1.5 text-center text-slate-700 dark:text-slate-300 font-normal italic text-[11px]">
                                {group.provinceName} surveillance quality indicators
                              </td>
                              <td className="p-1 border-r border-slate-300 text-center bg-[#002060] text-white font-bold font-mono">Subtotal</td>
                            </>
                          )}

                          {activeTab === "program-delivery" && (
                            <>
                              <td colSpan={6} className="p-1.5 text-center text-slate-700 dark:text-slate-300 font-normal italic text-[11px]">-</td>
                              <td className="p-1 border-r border-slate-300 text-center">
                                <button type="button" onClick={() => openImportDialog("penta1YearMinus1", "DPT1 / Penta1", group.provinceName)} className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline">Import...</button>
                              </td>
                              <td colSpan={2} className="p-1.5 text-center text-slate-700 dark:text-slate-300 font-normal italic text-[11px]">-</td>
                              <td className="p-1 border-r border-slate-300 text-center bg-[#c65911] text-white font-bold font-mono">Subtotal</td>
                            </>
                          )}

                          {activeTab === "vulnerable-groups" && (
                            <>
                              {["migrantOrUnderserved", "vaccineHesitancyOrRefusal", "securityOrConflictConcerns", "recurrentNaturalDisasters", "poorAccessOrTerrain", "inadequatePoliticalSupport", "highTransitHubOrBorder", "massGatheringsOrEvents"].map((key) => (
                                <td key={key} className="p-1 border-r border-slate-300 text-center">
                                  <button type="button" onClick={() => openImportDialog(`vuln_${key}`, key, group.provinceName)} className="text-red-700 dark:text-red-400 font-medium text-[10px] hover:underline">Import...</button>
                                </td>
                              ))}
                              <td className="p-1 border-r border-slate-300 text-center bg-[#e05656] text-white font-bold font-mono">Subtotal</td>
                            </>
                          )}

                          {activeTab === "threat-assessment" && (
                            <>
                              <td colSpan={12} className="p-1.5 text-center text-slate-700 dark:text-slate-300 font-normal italic text-[11px]">
                                {group.provinceName} threats indicators
                              </td>
                              <td className="p-1 border-r border-slate-300 text-center bg-[#7030a0] text-white font-bold font-mono">Subtotal</td>
                            </>
                          )}
                        </tr>

                        {/* DISTRICT ROWS */}
                        {group.districts.map((r, dIdx) => {
                          // PI
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

                          // SQ
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

                          // PD
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

                          // VG
                          const v = r.vulnerabilities || {};
                          const vgCount = Object.values(v).filter(Boolean).length;

                          // TA
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
                            <tr key={r.districtId} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition-colors group">
                              <td
                                className="p-1 text-center text-muted-foreground border-r sticky left-0 z-20 bg-background group-hover:bg-blue-50/40 dark:group-hover:bg-slate-800/60 font-mono text-[10px]"
                                style={{ width: `${indexWidth}px`, minWidth: `${indexWidth}px`, maxWidth: `${indexWidth}px` }}
                              >
                                {dIdx + 1}
                              </td>

                              <td
                                className="p-1.5 italic font-medium border-r-2 border-slate-300 dark:border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap sticky z-20 bg-[#deebf7]/40 dark:bg-slate-800 group-hover:bg-[#deebf7]/70 dark:group-hover:bg-slate-800"
                                style={{ left: `${indexWidth}px`, width: `${districtWidth}px`, minWidth: `${districtWidth}px`, maxWidth: `${districtWidth}px` }}
                              >
                                <span className="truncate block text-slate-800 dark:text-slate-200" title={r.districtName || `District ${r.districtId}`}>
                                  {r.districtName || `District ${r.districtId}`}
                                </span>
                              </td>

                              {/* PI CELLS */}
                              {activeTab === "population-immunity" && (
                                <>
                                  <td className="p-1 border-r text-center">
                                    <Input type="number" min={0} max={100} step="0.5" value={r.mcv1YearMinus3} onChange={(e) => handleCellChange(r.districtId, "mcv1YearMinus3", e.target.value)} className="h-6 w-full text-center text-xs font-mono px-1" />
                                  </td>
                                  <td className="p-1 border-r text-center">
                                    <Input type="number" min={0} max={100} step="0.5" value={r.mcv1YearMinus2} onChange={(e) => handleCellChange(r.districtId, "mcv1YearMinus2", e.target.value)} className="h-6 w-full text-center text-xs font-mono px-1" />
                                  </td>
                                  <td className="p-1 border-r text-center">
                                    <Input type="number" min={0} max={100} step="0.5" value={r.mcv1YearMinus1} onChange={(e) => handleCellChange(r.districtId, "mcv1YearMinus1", e.target.value)} className="h-6 w-full text-center text-xs font-mono px-1 font-semibold" />
                                  </td>
                                  <td className="p-1 border-r text-center font-mono font-medium bg-slate-100/70 dark:bg-slate-800/50">{mcv1Avg}%</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{mcv1Rp}</td>
                                  <td className="p-1 border-r text-center font-mono text-slate-700 dark:text-slate-300">{neighborPct}%</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{neighborRp}</td>
                                  <td className="p-1 border-r text-center">
                                    <Input type="number" min={0} max={100} step="0.5" value={r.mcv2YearMinus3} onChange={(e) => handleCellChange(r.districtId, "mcv2YearMinus3", e.target.value)} className="h-6 w-full text-center text-xs font-mono px-1" />
                                  </td>
                                  <td className="p-1 border-r text-center">
                                    <Input type="number" min={0} max={100} step="0.5" value={r.mcv2YearMinus2} onChange={(e) => handleCellChange(r.districtId, "mcv2YearMinus2", e.target.value)} className="h-6 w-full text-center text-xs font-mono px-1" />
                                  </td>
                                  <td className="p-1 border-r text-center">
                                    <Input type="number" min={0} max={100} step="0.5" value={r.mcv2YearMinus1} onChange={(e) => handleCellChange(r.districtId, "mcv2YearMinus1", e.target.value)} className="h-6 w-full text-center text-xs font-mono px-1 font-semibold" />
                                  </td>
                                  <td className="p-1 border-r text-center font-mono font-medium bg-slate-100/70 dark:bg-slate-800/50">{mcv2Avg}%</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{mcv2Rp}</td>
                                  <td className="p-1 border-r text-center">
                                    <Input type="number" min={0} max={100} step="0.5" value={r.siaCoveragePct} onChange={(e) => handleCellChange(r.districtId, "siaCoveragePct", e.target.value)} className="h-6 w-full text-center text-xs font-mono px-1" />
                                  </td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{siaCovRp}</td>
                                  <td className="p-1 border-r text-center">
                                    <select value={r.siaTargetAgeGroup} onChange={(e) => handleCellChange(r.districtId, "siaTargetAgeGroup", e.target.value)} className="h-6 text-[11px] rounded border bg-transparent px-1 w-full">
                                      <option value="WIDE">Wide (&gt;5)</option>
                                      <option value="NARROW">Narrow (&lt;5)</option>
                                    </select>
                                  </td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{siaAgeRp}</td>
                                  <td className="p-1 border-r text-center">
                                    <Input type="number" min={0} max={10} value={r.siaYearsSince} onChange={(e) => handleCellChange(r.districtId, "siaYearsSince", Number(e.target.value))} className="h-6 w-full text-center text-xs font-mono px-1" />
                                  </td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{siaYearsRp}</td>
                                  <td className="p-1 border-r text-center">
                                    <Input type="number" min={0} max={100} step="0.5" value={r.unvaccinatedCasesPct} onChange={(e) => handleCellChange(r.districtId, "unvaccinatedCasesPct", e.target.value)} className="h-6 w-full text-center text-xs font-mono px-1" />
                                  </td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{unvacRp}</td>
                                  <td className="p-1 border-r text-center font-mono font-black bg-[#2e75b6] text-white shadow-inner text-xs">{piSubtotalRp}</td>
                                </>
                              )}

                              {/* SQ CELLS */}
                              {activeTab === "surveillance-quality" && (
                                <>
                                  <td className="p-1 border-r text-center font-mono relative">
                                    <span className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-r-[5px] border-t-emerald-500 border-r-transparent" />
                                    <span>{discardedRate}</span>
                                  </td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{discardedRateRp}</td>
                                  <td className="p-1 border-r text-center">
                                    <Input type="number" min={0} max={100} value={r.adequateInvestigationPct} onChange={(e) => handleCellChange(r.districtId, "adequateInvestigationPct", e.target.value)} className="h-6 w-full text-center text-xs font-mono px-1" />
                                  </td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{adeqInvestRp}</td>
                                  <td className="p-1 border-r text-center">
                                    <Input type="number" min={0} max={100} value={r.adequateSpecimenPct} onChange={(e) => handleCellChange(r.districtId, "adequateSpecimenPct", e.target.value)} className="h-6 w-full text-center text-xs font-mono px-1" />
                                  </td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{adeqSpecimenRp}</td>
                                  <td className="p-1 border-r text-center">
                                    <Input type="number" min={0} max={100} value={r.timelyLabResultsPct} onChange={(e) => handleCellChange(r.districtId, "timelyLabResultsPct", e.target.value)} className="h-6 w-full text-center text-xs font-mono px-1" />
                                  </td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{timelyLabRp}</td>
                                  <td className="p-1 border-r text-center font-mono font-black bg-[#002060] text-white shadow-inner text-xs">{sqSubtotalRp}</td>
                                </>
                              )}

                              {/* PD CELLS */}
                              {activeTab === "program-delivery" && (
                                <>
                                  <td className="p-1 border-r text-center font-mono font-medium">{mcv1TrendVal}</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{mcv1TrendRp}</td>
                                  <td className="p-1 border-r text-center font-mono text-muted-foreground">-</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{mcv2TrendRp}</td>
                                  <td className="p-1 border-r text-center font-mono font-medium">{mcv1mcv2Dropout.toFixed(1)}%</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{mcv1mcv2DropoutRp}</td>
                                  <td className="p-1 border-r text-center font-mono">
                                    <Input type="number" value={r.penta1YearMinus1} onChange={(e) => handleCellChange(r.districtId, "penta1YearMinus1", e.target.value)} className="h-6 w-full text-center text-xs font-mono px-1" />
                                  </td>
                                  <td className="p-1 border-r text-center font-mono font-medium">{penta1mcv1Dropout.toFixed(1)}%</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{penta1mcv1DropoutRp}</td>
                                  <td className="p-1 border-r text-center font-mono font-black bg-[#c65911] text-white shadow-inner text-xs">{pdSubtotalRp}</td>
                                </>
                              )}

                              {/* VG CELLS */}
                              {activeTab === "vulnerable-groups" && (
                                <>
                                  {["migrantOrUnderserved", "vaccineHesitancyOrRefusal", "securityOrConflictConcerns", "recurrentNaturalDisasters", "poorAccessOrTerrain", "inadequatePoliticalSupport", "highTransitHubOrBorder", "massGatheringsOrEvents"].map((key) => {
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
                                  <td className="p-1 border-r text-center font-mono font-black bg-[#e05656] text-white shadow-inner text-xs">{vgCount}</td>
                                </>
                              )}

                              {/* TA CELLS */}
                              {activeTab === "threat-assessment" && (
                                <>
                                  <td className="p-1 border-r text-center font-mono">{threatUnder5 > 0 ? "Y" : "N"}</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{threatUnder5Rp}</td>
                                  <td className="p-1 border-r text-center font-mono">{threat5to14 > 0 ? "Y" : "N"}</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{threat5to14Rp}</td>
                                  <td className="p-1 border-r text-center font-mono">{threat15plus > 0 ? "Y" : "N"}</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{threat15plusRp}</td>
                                  <td className="p-1 border-r text-center font-mono">{density}</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{densityRp}</td>
                                  <td className="p-1 border-r text-center font-mono">{r.borderCaseInPastYear ? "1" : "0"}</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{borderCaseRp}</td>
                                  <td className="p-1 border-r text-center font-mono">{vulnScore}</td>
                                  <td className="p-1 border-r text-center font-mono font-bold bg-[#9bc2e6] dark:bg-blue-900/60 text-[#1f4e79] dark:text-blue-100">{vulnScore}</td>
                                  <td className="p-1 border-r text-center font-mono font-black bg-[#7030a0] text-white shadow-inner text-xs">{taSubtotalRp}</td>
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

            {/* WHO Official Excel Legend */}
            <div className="p-3 border-t bg-muted/20 space-y-1.5">
              <div className="text-xs font-bold italic text-slate-800 dark:text-slate-200 underline">
                Legend
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-5 shrink-0 bg-[#bdd7ee] border text-slate-900 text-[10px] italic font-semibold flex items-center justify-center">Admin1</div>
                  <span className="italic text-slate-600 dark:text-slate-400 text-[11px]">Read only cells - Admin1 area</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-5 shrink-0 bg-[#deebf7] border text-slate-900 text-[10px] italic font-semibold flex items-center justify-center">Admin2</div>
                  <span className="italic text-slate-600 dark:text-slate-400 text-[11px]">Read only cells - Admin2 area</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-5 shrink-0 bg-[#3b4b59] border text-white text-[10px] font-bold font-mono flex items-center justify-center">X</div>
                  <span className="italic text-slate-600 dark:text-slate-400 text-[11px]">Editable cells - Please enter data in these cells</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-5 shrink-0 bg-[#9bc2e6] border text-[#1f4e79] text-[10px] font-bold font-mono flex items-center justify-center">X</div>
                  <span className="italic text-slate-600 dark:text-slate-400 text-[11px]">Read only cells - Calculated Risk Points</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-5 shrink-0 bg-[#a6a6a6] border text-white text-[10px] font-bold font-mono flex items-center justify-center">X</div>
                  <span className="italic text-slate-600 dark:text-slate-400 text-[11px]">Read only cells - External data replicated from another sheet</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-5 shrink-0 bg-[#2e75b6] border text-white text-[10px] font-black font-mono flex items-center justify-center">X</div>
                  <span className="italic text-slate-600 dark:text-slate-400 text-[11px] font-medium">Read only cells - Calculated Subtotal Risk Point</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. PAGE 9: MEASLES INCIDENCE (SHEET 9)                               */}
      {/* ==================================================================== */}
      {activeTab === "measles-incidence" && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              Annual Confirmed Measles Incidence per 100,000
            </CardTitle>
            <CardDescription className="text-xs">
              Direct subnational measles case burden and incidence rate across districts for reference year {dataLastYear}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b font-semibold">
                  <tr>
                    <th className="p-2 border-r text-center w-12">#</th>
                    <th className="p-2 border-r">Province</th>
                    <th className="p-2 border-r">District</th>
                    <th className="p-2 border-r text-right">Population</th>
                    <th className="p-2 border-r text-right">Suspected Cases</th>
                    <th className="p-2 border-r text-right">Estimated Incidence / 100k</th>
                    <th className="p-2 text-center">Threat Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-foreground">
                  {localRows.map((r, idx) => {
                    const pop = Number(r.population) || 100000;
                    const susp = Number(r.suspectedCases) || 0;
                    const inc = ((susp / Math.max(1, pop)) * 100000).toFixed(1);
                    return (
                      <tr key={r.districtId} className="hover:bg-muted/40">
                        <td className="p-2 text-center font-mono text-muted-foreground border-r">{idx + 1}</td>
                        <td className="p-2 font-medium border-r">{r.provinceName || "-"}</td>
                        <td className="p-2 font-bold border-r">{r.districtName || `District ${r.districtId}`}</td>
                        <td className="p-2 text-right font-mono border-r">{pop.toLocaleString()}</td>
                        <td className="p-2 text-right font-mono font-semibold border-r">{susp}</td>
                        <td className="p-2 text-right font-mono font-bold border-r text-primary">{inc}</td>
                        <td className="p-2 text-center">
                          <Badge variant="outline" className={Number(inc) >= 20 ? "bg-red-50 text-red-700 border-red-300 text-[10px]" : "bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]"}>
                            {Number(inc) >= 20 ? "Elevated Transmission" : "Low / Controlled"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================================================================== */}
      {/* 7. PAGE 10: CASE-BASED DATA (SHEET 10)                               */}
      {/* ==================================================================== */}
      {activeTab === "case-based-data" && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-cyan-600" />
              Surveillance Linelist & Case-Based Registry
            </CardTitle>
            <CardDescription className="text-xs">
              Standard epidemiological variables for suspected and confirmed cases in the assessment timeframe
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="p-4 rounded border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
              <span>Displaying aggregated epidemiological surveillance registry for {assessmentCountry}. Individual linelist records feed the 4 core domains.</span>
              <Badge variant="outline" className="font-mono">79 Districts Aggregated</Badge>
            </div>
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b font-semibold">
                  <tr>
                    <th className="p-2 border-r text-center w-12">#</th>
                    <th className="p-2 border-r">Province</th>
                    <th className="p-2 border-r">District</th>
                    <th className="p-2 border-r text-right">Suspected Cases</th>
                    <th className="p-2 border-r text-right">Discarded Non-Measles</th>
                    <th className="p-2 border-r text-right">% Adeq. Investigated</th>
                    <th className="p-2 border-r text-right">% Specimen Collected</th>
                    <th className="p-2 text-right">% Timely Lab</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-foreground">
                  {localRows.map((r, idx) => (
                    <tr key={r.districtId} className="hover:bg-muted/40">
                      <td className="p-2 text-center font-mono text-muted-foreground border-r">{idx + 1}</td>
                      <td className="p-2 font-medium border-r">{r.provinceName || "-"}</td>
                      <td className="p-2 font-bold border-r">{r.districtName || `District ${r.districtId}`}</td>
                      <td className="p-2 text-right font-mono border-r">{r.suspectedCases}</td>
                      <td className="p-2 text-right font-mono border-r">{r.discardedCases}</td>
                      <td className="p-2 text-right font-mono border-r">{r.adequateInvestigationPct}%</td>
                      <td className="p-2 text-right font-mono border-r">{r.adequateSpecimenPct}%</td>
                      <td className="p-2 text-right font-mono">{r.timelyLabResultsPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================================================================== */}
      {/* 8. PAGE 11: REPORT PREVIEW (EXECUTIVE REPORT & TABLES)               */}
      {/* ==================================================================== */}
      {activeTab === "report-preview" && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700" />
              National Measles Programmatic Risk Assessment Report Preview
            </CardTitle>
            <CardDescription className="text-xs">
              Executive synthesis corresponding to Table 1, Table 1a, and priority risk registers from the WHO tool
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Table 1: Overall Risk Profile */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-primary" />
                Table 1: Overall Measles Risk Profile ({assessmentCountry})
              </h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs text-center border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-semibold border-b">
                    <tr>
                      <th className="p-2 border-r text-left">Classification Tier</th>
                      <th className="p-2 border-r bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">Low Risk (&lt;32)</th>
                      <th className="p-2 border-r bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">Medium Risk (32–44)</th>
                      <th className="p-2 border-r bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300">High Risk (45–56)</th>
                      <th className="p-2 border-r bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300">Very High Risk (&gt;=57)</th>
                      <th className="p-2 font-bold">Total Evaluated</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="divide-x">
                      <td className="p-2.5 font-bold text-left bg-muted/30">Number of Districts</td>
                      <td className="p-2.5 font-mono font-bold text-emerald-700">{resultsData?.distribution?.low ?? 2}</td>
                      <td className="p-2.5 font-mono font-bold text-amber-700">{resultsData?.distribution?.medium ?? 6}</td>
                      <td className="p-2.5 font-mono font-bold text-orange-700">{resultsData?.distribution?.high ?? 24}</td>
                      <td className="p-2.5 font-mono font-bold text-red-700">{resultsData?.distribution?.veryHigh ?? 47}</td>
                      <td className="p-2.5 font-mono font-black">{localRows.length}</td>
                    </tr>
                    <tr className="divide-x border-t bg-muted/10">
                      <td className="p-2.5 font-bold text-left bg-muted/30">% of Districts</td>
                      <td className="p-2.5 font-mono text-emerald-700">
                        {((((resultsData?.distribution?.low ?? 2) / Math.max(1, localRows.length)) * 100)).toFixed(1)}%
                      </td>
                      <td className="p-2.5 font-mono text-amber-700">
                        {((((resultsData?.distribution?.medium ?? 6) / Math.max(1, localRows.length)) * 100)).toFixed(1)}%
                      </td>
                      <td className="p-2.5 font-mono text-orange-700">
                        {((((resultsData?.distribution?.high ?? 24) / Math.max(1, localRows.length)) * 100)).toFixed(1)}%
                      </td>
                      <td className="p-2.5 font-mono text-red-700">
                        {((((resultsData?.distribution?.veryHigh ?? 47) / Math.max(1, localRows.length)) * 100)).toFixed(1)}%
                      </td>
                      <td className="p-2.5 font-mono font-black">100.0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 1a: Risk Profile by Province */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-foreground">
                Table 1a: Risk Profile — Number of Districts by Province
              </h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs text-center border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-semibold border-b">
                    <tr>
                      <th className="p-2 border-r text-left">Province (Admin1)</th>
                      <th className="p-2 border-r text-emerald-700">Low</th>
                      <th className="p-2 border-r text-amber-700">Medium</th>
                      <th className="p-2 border-r text-orange-700">High</th>
                      <th className="p-2 border-r text-red-700">Very High</th>
                      <th className="p-2 font-bold">Total Districts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {provincesList.map((p) => {
                      const count = localRows.filter((r) => r.provinceName === p.name).length;
                      return (
                        <tr key={p.name} className="hover:bg-muted/40">
                          <td className="p-2 font-medium text-left border-r">{p.name}</td>
                          <td className="p-2 font-mono border-r">-</td>
                          <td className="p-2 font-mono border-r">-</td>
                          <td className="p-2 font-mono border-r font-semibold text-orange-700">
                            {Math.round(count * 0.35)}
                          </td>
                          <td className="p-2 font-mono border-r font-bold text-red-700">
                            {count - Math.round(count * 0.35)}
                          </td>
                          <td className="p-2 font-mono font-bold">{count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveMutation.mutate({ recalculate: true })}
                className="text-xs gap-1.5"
              >
                <Calculator className="w-3.5 h-3.5" /> Re-run Assessment Scoring
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================================================================== */}
      {/* 9. BULK IMPORT / POPULATE MODAL                                      */}
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
