import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileSpreadsheet,
  Save,
  Calculator,
  RefreshCw,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Sparkles,
  ShieldAlert,
  SlidersHorizontal,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  MoveHorizontal,
  Pin,
} from "lucide-react";

interface DirectEntryRow {
  id?: string;
  districtId: number;
  districtName?: string;
  provinceId?: number | null;
  provinceName?: string | null;
  population: string | number;
  areaKm2: string | number;
  // Domain 1: Population Immunity
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
  // Domain 2: Surveillance Quality
  suspectedCases: number;
  discardedCases: number;
  adequateInvestigationPct: string | number;
  adequateSpecimenPct: string | number;
  timelyLabResultsPct: string | number;
  // Domain 4: Threat Assessment
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
}

// Standard baseline widths
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  index: 48,
  district: 180,
  province: 140,
  // PI
  mcv1YearMinus3: 105,
  mcv1YearMinus2: 105,
  mcv1YearMinus1: 105,
  mcv1Avg: 115,
  mcv2YearMinus3: 105,
  mcv2YearMinus2: 105,
  mcv2YearMinus1: 105,
  mcv2Avg: 115,
  siaCoveragePct: 110,
  siaTargetAgeGroup: 135,
  siaYearsSince: 100,
  unvaccinatedCasesPct: 120,
  // SQ
  population: 115,
  suspectedCases: 115,
  discardedCases: 115,
  discardedRate: 135,
  adequateInvestigationPct: 135,
  adequateSpecimenPct: 135,
  timelyLabResultsPct: 135,
  // PD
  pd_mcv1_avg: 115,
  mcv1Trend: 130,
  pd_mcv2_avg: 115,
  mcv2Trend: 130,
  mcv1mcv2Dropout: 140,
  penta1YearMinus1: 115,
  penta1mcv1Dropout: 140,
  // TA
  threatCasesUnder5: 105,
  threatCases5To14: 105,
  threatCases15Plus: 105,
  areaKm2: 115,
  density: 115,
  borderCaseInPastYear: 120,
  vuln_migrant: 85,
  vuln_hesitancy: 85,
  vuln_security: 85,
  vuln_disaster: 85,
  vuln_terrain: 85,
  vuln_political: 85,
  vuln_transit: 85,
  vuln_gatherings: 85,
  vulnCount: 110,
};

// Generous stretch widths to prevent any value truncation
const STRETCH_COL_WIDTHS: Record<string, number> = {
  index: 52,
  district: 240,
  province: 175,
  // PI
  mcv1YearMinus3: 130,
  mcv1YearMinus2: 130,
  mcv1YearMinus1: 130,
  mcv1Avg: 140,
  mcv2YearMinus3: 130,
  mcv2YearMinus2: 130,
  mcv2YearMinus1: 130,
  mcv2Avg: 140,
  siaCoveragePct: 135,
  siaTargetAgeGroup: 160,
  siaYearsSince: 125,
  unvaccinatedCasesPct: 145,
  // SQ
  population: 140,
  suspectedCases: 135,
  discardedCases: 135,
  discardedRate: 155,
  adequateInvestigationPct: 155,
  adequateSpecimenPct: 155,
  timelyLabResultsPct: 155,
  // PD
  pd_mcv1_avg: 135,
  mcv1Trend: 150,
  pd_mcv2_avg: 135,
  mcv2Trend: 150,
  mcv1mcv2Dropout: 155,
  penta1YearMinus1: 135,
  penta1mcv1Dropout: 155,
  // TA
  threatCasesUnder5: 125,
  threatCases5To14: 125,
  threatCases15Plus: 125,
  areaKm2: 135,
  density: 135,
  borderCaseInPastYear: 145,
  vuln_migrant: 100,
  vuln_hesitancy: 100,
  vuln_security: 100,
  vuln_disaster: 100,
  vuln_terrain: 100,
  vuln_political: 100,
  vuln_transit: 100,
  vuln_gatherings: 100,
  vulnCount: 130,
};

export function RiskDirectDataEntry({ assessmentId, onCalculationSuccess }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeDomainTab, setActiveDomainTab] = useState<"pi" | "sq" | "pd" | "ta">("pi");
  const [searchTerm, setSearchTerm] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<string>("districtName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Local working copy for inline editing
  const [localRows, setLocalRows] = useState<DirectEntryRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [bulkDialogField, setBulkDialogField] = useState<string | null>(null);
  const [bulkValue, setBulkValue] = useState<string>("");

  // Interactive column width management
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS);
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // Fetch direct entry data from backend
  const { data, isLoading, isError, refetch } = useQuery<{ assessment: any; entries: DirectEntryRow[] }>({
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
    const set = new Set<string>();
    localRows.forEach((r) => {
      if (r.provinceName) set.add(r.provinceName);
    });
    return Array.from(set).sort();
  }, [localRows]);

  // Handle cell edit
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

  // Bulk set a column value across all filtered districts
  const applyBulkValue = () => {
    if (!bulkDialogField) return;
    const num = Number(bulkValue);
    setLocalRows((prev) =>
      prev.map((r) => {
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
      title: "Column Updated",
      description: `Applied value across all districts.`,
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

      // Special computed sort columns
      if (sortField === "mcv1Avg") {
        valA = (Number(a.mcv1YearMinus3 || 0) + Number(a.mcv1YearMinus2 || 0) + Number(a.mcv1YearMinus1 || 0)) / 3;
        valB = (Number(b.mcv1YearMinus3 || 0) + Number(b.mcv1YearMinus2 || 0) + Number(b.mcv1YearMinus1 || 0)) / 3;
      } else if (sortField === "mcv2Avg") {
        valA = (Number(a.mcv2YearMinus3 || 0) + Number(a.mcv2YearMinus2 || 0) + Number(a.mcv2YearMinus1 || 0)) / 3;
        valB = (Number(b.mcv2YearMinus3 || 0) + Number(b.mcv2YearMinus2 || 0) + Number(b.mcv2YearMinus1 || 0)) / 3;
      } else if (sortField === "discardedRate") {
        valA = ((Number(a.discardedCases) || 0) / Math.max(1, Number(a.population) || 1)) * 100000;
        valB = ((Number(b.discardedCases) || 0) / Math.max(1, Number(b.population) || 1)) * 100000;
      } else if (sortField === "density") {
        valA = (Number(a.population) || 0) / Math.max(1, Number(a.areaKm2) || 1);
        valB = (Number(b.population) || 0) / Math.max(1, Number(b.areaKm2) || 1);
      } else if (sortField === "mcv1mcv2Dropout") {
        valA = Number(a.mcv1YearMinus1) > 0 ? ((Number(a.mcv1YearMinus1) - Number(a.mcv2YearMinus1)) / Number(a.mcv1YearMinus1)) * 100 : 0;
        valB = Number(b.mcv1YearMinus1) > 0 ? ((Number(b.mcv1YearMinus1) - Number(b.mcv2YearMinus1)) / Number(b.mcv1YearMinus1)) * 100 : 0;
      } else if (sortField === "penta1mcv1Dropout") {
        valA = Number(a.penta1YearMinus1) > 0 ? ((Number(a.penta1YearMinus1) - Number(a.mcv1YearMinus1)) / Number(a.penta1YearMinus1)) * 100 : 0;
        valB = Number(b.penta1YearMinus1) > 0 ? ((Number(b.penta1YearMinus1) - Number(b.mcv1YearMinus1)) / Number(b.penta1YearMinus1)) * 100 : 0;
      } else if (sortField === "vulnCount") {
        valA = Object.values(a.vulnerabilities || {}).filter(Boolean).length;
        valB = Object.values(b.vulnerabilities || {}).filter(Boolean).length;
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
      <ChevronUp className="w-3 h-3 ml-1 text-primary shrink-0 inline font-bold" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 text-primary shrink-0 inline font-bold" />
    );
  };

  // Column Resizer Handler
  const startResize = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[key] || 110;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(50, startWidth + delta);
      setColWidths((prev) => ({ ...prev, [key]: newWidth }));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Sticky offsets for left pane
  const indexWidth = colWidths.index || 48;
  const districtWidth = colWidths.district || 180;
  const provinceWidth = colWidths.province || 140;

  return (
    <div className="space-y-4">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border rounded-lg p-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold">Direct Data Entry Spreadsheet</h3>
            {isDirty && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 text-xs animate-pulse">
                Unsaved Changes
              </Badge>
            )}
            <Badge variant="outline" className="text-[11px] bg-muted/60 font-mono text-muted-foreground">
              WHO Tool v1.8 (16 Sheets)
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Directly edit district indicators across the 4 WHO assessment domains. Enter data into cells and click{" "}
            <strong>Save & Recalculate</strong> to refresh all maps and risk tiers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/risk/resources/Measles_Risk_Assessment_Tool_v1.8.xlsm"
            download
            className="inline-flex items-center"
          >
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" /> WHO Excel Template
            </Button>
          </a>

          <Button
            variant="outline"
            size="sm"
            disabled={!isDirty || saveMutation.isPending}
            onClick={() => {
              if (data?.entries) setLocalRows(data.entries);
              setIsDirty(false);
            }}
            className="h-8 text-xs gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({ recalculate: false })}
            className="h-8 text-xs gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Save Draft
          </Button>

          <Button
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({ recalculate: true })}
            className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Calculator className="w-3.5 h-3.5" />
            {saveMutation.isPending ? "Calculating Scores..." : "Save & Recalculate Scores"}
          </Button>
        </div>
      </div>

      {/* Domain Selection Tabs & Column Toolbar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4">
            <Tabs
              value={activeDomainTab}
              onValueChange={(v) => setActiveDomainTab(v as any)}
              className="w-full lg:w-auto"
            >
              <TabsList className="grid grid-cols-2 md:grid-cols-4 h-9">
                <TabsTrigger value="pi" className="text-xs gap-1.5">
                  <span>1. Pop. Immunity (Sheet 4 • 40 pts)</span>
                </TabsTrigger>
                <TabsTrigger value="sq" className="text-xs gap-1.5">
                  <span>2. Surv. Quality (Sheet 5 • 20 pts)</span>
                </TabsTrigger>
                <TabsTrigger value="pd" className="text-xs gap-1.5">
                  <span>3. Prog. Delivery (Sheet 6 • 16 pts)</span>
                </TabsTrigger>
                <TabsTrigger value="ta" className="text-xs gap-1.5">
                  <span>4. Threats & Vuln (Sheets 7-8 • 24 pts)</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Column Spacing & Search Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center border rounded-md p-0.5 bg-muted/40 text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setColWidths(STRETCH_COL_WIDTHS)}
                  className="h-7 px-2 text-[11px] gap-1 font-medium hover:bg-background"
                  title="Stretch columns so all inputs and headers have wide breathing room"
                >
                  <Maximize2 className="w-3 h-3 text-primary" /> Stretch (Wide)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setColWidths(DEFAULT_COL_WIDTHS)}
                  className="h-7 px-2 text-[11px] gap-1 font-medium hover:bg-background"
                  title="Restore standard column widths"
                >
                  <Minimize2 className="w-3 h-3 text-muted-foreground" /> Compact
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setColWidths(DEFAULT_COL_WIDTHS)}
                  className="h-7 px-2 text-[11px] hover:bg-background text-muted-foreground"
                  title="Reset column widths to default"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </Button>
              </div>

              <div className="relative w-52">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search district..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 h-8 text-xs"
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
                  <SelectTrigger className="h-8 text-xs w-40">
                    <SelectValue placeholder="All Provinces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Provinces ({localRows.length})</SelectItem>
                    {provincesList.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Domain Explanation & Sticky Pin Banner */}
          <div className="text-xs rounded-md bg-muted/50 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="w-4 h-4 text-blue-500 shrink-0" />
              {activeDomainTab === "pi" && (
                <span>
                  <strong>Population Immunity (40 Points Max):</strong> Enter 3-year MCV1, MCV2, SIA Campaign Coverage, and % Unvaccinated Suspected Cases. Average coverage is computed live.
                </span>
              )}
              {activeDomainTab === "sq" && (
                <span>
                  <strong>Surveillance Quality (20 Points Max):</strong> Enter Suspected cases, Discarded cases (rate computed per 100k), % Adequately investigated within 48h (10 core vars), % Specimen within 28d, and % Timely lab results.
                </span>
              )}
              {activeDomainTab === "pd" && (
                <span>
                  <strong>Program Delivery Performance (16 Points Max):</strong> Assesses routine immunization trajectory. MCV1 & MCV2 trends (3-year slope) and MCV1-to-MCV2 and Penta1-to-MCV1 dropouts are auto-evaluated.
                </span>
              )}
              {activeDomainTab === "ta" && (
                <span>
                  <strong>Threat Assessment & Vulnerable Groups (24 Points Max):</strong> Enter measles cases across age brackets (&lt;5y, 5-14y, 15+y), population density, bordering outbreaks, and select from the 8 WHO vulnerable groups.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 text-[11px] font-medium text-foreground">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 gap-1 font-normal text-[10px]">
                <Pin className="w-2.5 h-2.5" /> Frozen: #, District, Province
              </Badge>
              <span>Showing {sortedRows.length} districts</span>
            </div>
          </div>

          {/* ================================================================ */}
          {/* TABULAR SPREADSHEET GRID (STICKY LEFT PANE + DRAGGABLE COLUMNS) */}
          {/* ================================================================ */}
          <div className="overflow-x-auto border rounded-md max-h-[580px] relative shadow-inner bg-card">
            <table className="w-full text-xs text-left border-collapse table-fixed">
              <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 text-foreground border-b shadow-sm font-semibold">
                <tr>
                  {/* FROZEN 1: INDEX (#) */}
                  <th
                    className="p-2.5 text-center border-r sticky top-0 left-0 z-40 bg-slate-100 dark:bg-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                    style={{
                      width: `${indexWidth}px`,
                      minWidth: `${indexWidth}px`,
                      maxWidth: `${indexWidth}px`,
                    }}
                    onClick={() => handleSort("districtId")}
                  >
                    <div className="flex items-center justify-center">
                      <span>#</span>
                      {getSortIcon("districtId")}
                    </div>
                  </th>

                  {/* FROZEN 2: DISTRICT NAME */}
                  <th
                    className="p-2.5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r sticky top-0 z-40 bg-slate-100 dark:bg-slate-800 group/th select-none"
                    style={{
                      left: `${indexWidth}px`,
                      width: `${districtWidth}px`,
                      minWidth: `${districtWidth}px`,
                      maxWidth: `${districtWidth}px`,
                    }}
                    onClick={() => handleSort("districtName")}
                  >
                    <div className="flex items-center justify-between pr-2">
                      <span className="truncate font-bold">District</span>
                      {getSortIcon("districtName")}
                    </div>
                    {/* Drag resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none transition-colors"
                      onMouseDown={(e) => startResize("district", e)}
                      onClick={(e) => e.stopPropagation()}
                      title="Drag to resize District column"
                    />
                  </th>

                  {/* FROZEN 3: PROVINCE (WITH RIGHT DIVIDER SHADOW) */}
                  <th
                    className="p-2.5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r-2 border-slate-300 dark:border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] sticky top-0 z-40 bg-slate-100 dark:bg-slate-800 group/th select-none"
                    style={{
                      left: `${indexWidth + districtWidth}px`,
                      width: `${provinceWidth}px`,
                      minWidth: `${provinceWidth}px`,
                      maxWidth: `${provinceWidth}px`,
                    }}
                    onClick={() => handleSort("provinceName")}
                  >
                    <div className="flex items-center justify-between pr-2">
                      <span className="truncate font-bold">Province</span>
                      {getSortIcon("provinceName")}
                    </div>
                    {/* Drag resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none transition-colors"
                      onMouseDown={(e) => startResize("province", e)}
                      onClick={(e) => e.stopPropagation()}
                      title="Drag to resize Province column"
                    />
                  </th>

                  {/* ======================================================== */}
                  {/* DOMAIN 1: POPULATION IMMUNITY HEADERS */}
                  {/* ======================================================== */}
                  {activeDomainTab === "pi" && (
                    <>
                      {[
                        { key: "mcv1YearMinus3", label: "MCV1 Y-3 (%)", bg: "bg-blue-50/70 dark:bg-blue-950/40" },
                        { key: "mcv1YearMinus2", label: "MCV1 Y-2 (%)", bg: "bg-blue-50/70 dark:bg-blue-950/40" },
                        { key: "mcv1YearMinus1", label: "MCV1 Y-1 (%)", bg: "bg-blue-50/70 dark:bg-blue-950/40" },
                        { key: "mcv1Avg", label: "MCV1 3-Yr Avg", bg: "bg-blue-100/70 dark:bg-blue-900/40" },
                        { key: "mcv2YearMinus3", label: "MCV2 Y-3 (%)", bg: "bg-purple-50/70 dark:bg-purple-950/40" },
                        { key: "mcv2YearMinus2", label: "MCV2 Y-2 (%)", bg: "bg-purple-50/70 dark:bg-purple-950/40" },
                        { key: "mcv2YearMinus1", label: "MCV2 Y-1 (%)", bg: "bg-purple-50/70 dark:bg-purple-950/40" },
                        { key: "mcv2Avg", label: "MCV2 3-Yr Avg", bg: "bg-purple-100/70 dark:bg-purple-900/40" },
                        { key: "siaCoveragePct", label: "SIA Cov. (%)", bg: "" },
                        { key: "siaTargetAgeGroup", label: "SIA Age Group", bg: "" },
                        { key: "siaYearsSince", label: "SIA Yrs Ago", bg: "" },
                        { key: "unvaccinatedCasesPct", label: "% Unvaccinated", bg: "" },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className={`p-2 text-center border-r relative group/th cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none ${col.bg}`}
                          style={{
                            width: `${colWidths[col.key] || 110}px`,
                            minWidth: `${colWidths[col.key] || 110}px`,
                          }}
                          onClick={() => handleSort(col.key)}
                        >
                          <div className="flex items-center justify-center">
                            <span className="truncate">{col.label}</span>
                            {getSortIcon(col.key)}
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none"
                            onMouseDown={(e) => startResize(col.key, e)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      ))}
                    </>
                  )}

                  {/* ======================================================== */}
                  {/* DOMAIN 2: SURVEILLANCE QUALITY HEADERS */}
                  {/* ======================================================== */}
                  {activeDomainTab === "sq" && (
                    <>
                      {[
                        { key: "population", label: "Population", bg: "" },
                        { key: "suspectedCases", label: "Suspected Cases", bg: "" },
                        { key: "discardedCases", label: "Discarded Cases", bg: "" },
                        { key: "discardedRate", label: "Discarded Rate / 100k", bg: "bg-amber-50/70 dark:bg-amber-950/40" },
                        { key: "adequateInvestigationPct", label: "Adeq. Invest. % (48h)", bg: "" },
                        { key: "adequateSpecimenPct", label: "Adeq. Specimen % (28d)", bg: "" },
                        { key: "timelyLabResultsPct", label: "Timely Lab Results %", bg: "" },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className={`p-2 text-center border-r relative group/th cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none ${col.bg}`}
                          style={{
                            width: `${colWidths[col.key] || 115}px`,
                            minWidth: `${colWidths[col.key] || 115}px`,
                          }}
                          onClick={() => handleSort(col.key)}
                        >
                          <div className="flex items-center justify-center">
                            <span className="truncate">{col.label}</span>
                            {getSortIcon(col.key)}
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none"
                            onMouseDown={(e) => startResize(col.key, e)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      ))}
                    </>
                  )}

                  {/* ======================================================== */}
                  {/* DOMAIN 3: PROGRAM DELIVERY HEADERS */}
                  {/* ======================================================== */}
                  {activeDomainTab === "pd" && (
                    <>
                      {[
                        { key: "mcv1Avg", label: "MCV1 3-Yr Avg", bg: "" },
                        { key: "mcv1Trend", label: "MCV1 Trend (Slope)", bg: "" },
                        { key: "mcv2Avg", label: "MCV2 3-Yr Avg", bg: "" },
                        { key: "mcv2Trend", label: "MCV2 Trend (Slope)", bg: "" },
                        { key: "mcv1mcv2Dropout", label: "MCV1-MCV2 Dropout %", bg: "bg-red-50/70 dark:bg-red-950/40" },
                        { key: "penta1YearMinus1", label: "Penta1 Y-1 (%)", bg: "" },
                        { key: "penta1mcv1Dropout", label: "Penta1-MCV1 Dropout %", bg: "bg-red-50/70 dark:bg-red-950/40" },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className={`p-2 text-center border-r relative group/th cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none ${col.bg}`}
                          style={{
                            width: `${colWidths[col.key] || 125}px`,
                            minWidth: `${colWidths[col.key] || 125}px`,
                          }}
                          onClick={() => handleSort(col.key)}
                        >
                          <div className="flex items-center justify-center">
                            <span className="truncate">{col.label}</span>
                            {getSortIcon(col.key)}
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none"
                            onMouseDown={(e) => startResize(col.key, e)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      ))}
                    </>
                  )}

                  {/* ======================================================== */}
                  {/* DOMAIN 4: THREATS & VULNERABILITIES HEADERS */}
                  {/* ======================================================== */}
                  {activeDomainTab === "ta" && (
                    <>
                      {[
                        { key: "threatCasesUnder5", label: "Cases <5y" },
                        { key: "threatCases5To14", label: "Cases 5-14y" },
                        { key: "threatCases15Plus", label: "Cases 15+y" },
                        { key: "areaKm2", label: "Area (km²)" },
                        { key: "density", label: "Density (/km²)" },
                        { key: "borderCaseInPastYear", label: "Border Outbreak?" },
                        { key: "vuln_migrant", label: "Migrants" },
                        { key: "vuln_hesitancy", label: "Hesitancy" },
                        { key: "vuln_security", label: "Security" },
                        { key: "vuln_disaster", label: "Disasters" },
                        { key: "vuln_terrain", label: "Terrain" },
                        { key: "vuln_political", label: "Political" },
                        { key: "vuln_transit", label: "Transit" },
                        { key: "vuln_gatherings", label: "Gatherings" },
                        { key: "vulnCount", label: "Vuln Pts (0-8)" },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className="p-2 text-center border-r relative group/th cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                          style={{
                            width: `${colWidths[col.key] || 105}px`,
                            minWidth: `${colWidths[col.key] || 105}px`,
                          }}
                          onClick={() => handleSort(col.key)}
                        >
                          <div className="flex items-center justify-center">
                            <span className="truncate">{col.label}</span>
                            {getSortIcon(col.key)}
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none"
                            onMouseDown={(e) => startResize(col.key, e)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      ))}
                    </>
                  )}
                </tr>
              </thead>

              {/* ============================================================ */}
              {/* TABLE BODY (FROZEN CELLS + STRETCHED SPREADSHEET INPUTS) */}
              {/* ============================================================ */}
              <tbody className="divide-y text-foreground">
                {isLoading ? (
                  <tr>
                    <td colSpan={25} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                        <span>Loading district data entries from assessment...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={25} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span>No districts matched your search criteria.</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchTerm("");
                            setProvinceFilter("ALL");
                          }}
                        >
                          Reset Search & Filters
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((r, idx) => {
                    const globalIdx = (currentPage - 1) * pageSize + idx + 1;

                    // Precompute helpers
                    const mcv1Avg = (
                      (Number(r.mcv1YearMinus3 || 0) +
                        Number(r.mcv1YearMinus2 || 0) +
                        Number(r.mcv1YearMinus1 || 0)) /
                      3
                    ).toFixed(1);

                    const mcv2Avg = (
                      (Number(r.mcv2YearMinus3 || 0) +
                        Number(r.mcv2YearMinus2 || 0) +
                        Number(r.mcv2YearMinus1 || 0)) /
                      3
                    ).toFixed(1);

                    const popNum = Number(r.population) || 100000;
                    const discardedRate = (
                      ((Number(r.discardedCases) || 0) / Math.max(1, popNum)) *
                      100000
                    ).toFixed(2);

                    const areaKm2 = Number(r.areaKm2) || 2500;
                    const density = Math.round(popNum / Math.max(1, areaKm2));

                    const mcv1mcv2Dropout =
                      Number(r.mcv1YearMinus1) > 0
                        ? (
                            ((Number(r.mcv1YearMinus1) - Number(r.mcv2YearMinus1)) /
                              Number(r.mcv1YearMinus1)) *
                            100
                          ).toFixed(1)
                        : "0.0";

                    const penta1mcv1Dropout =
                      Number(r.penta1YearMinus1) > 0
                        ? (
                            ((Number(r.penta1YearMinus1) - Number(r.mcv1YearMinus1)) /
                              Number(r.penta1YearMinus1)) *
                            100
                          ).toFixed(1)
                        : "0.0";

                    // Total Vulnerability Points
                    const vulnCount = Object.values(r.vulnerabilities || {}).filter(Boolean).length;

                    return (
                      <tr
                        key={r.districtId}
                        className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group"
                      >
                        {/* FROZEN 1: INDEX */}
                        <td
                          className="p-2 text-center text-muted-foreground border-r sticky left-0 z-20 bg-background group-hover:bg-slate-50 dark:group-hover:bg-slate-900"
                          style={{
                            width: `${indexWidth}px`,
                            minWidth: `${indexWidth}px`,
                            maxWidth: `${indexWidth}px`,
                          }}
                        >
                          {globalIdx}
                        </td>

                        {/* FROZEN 2: DISTRICT NAME */}
                        <td
                          className="p-2 font-medium border-r whitespace-nowrap sticky z-20 bg-background group-hover:bg-slate-50 dark:group-hover:bg-slate-900"
                          style={{
                            left: `${indexWidth}px`,
                            width: `${districtWidth}px`,
                            minWidth: `${districtWidth}px`,
                            maxWidth: `${districtWidth}px`,
                          }}
                        >
                          <span className="truncate block font-semibold text-foreground" title={r.districtName || `District ${r.districtId}`}>
                            {r.districtName || `District ${r.districtId}`}
                          </span>
                        </td>

                        {/* FROZEN 3: PROVINCE (WITH RIGHT DIVIDER SHADOW) */}
                        <td
                          className="p-2 text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap sticky z-20 bg-background group-hover:bg-slate-50 dark:group-hover:bg-slate-900"
                          style={{
                            left: `${indexWidth + districtWidth}px`,
                            width: `${provinceWidth}px`,
                            minWidth: `${provinceWidth}px`,
                            maxWidth: `${provinceWidth}px`,
                          }}
                        >
                          <span className="truncate block font-medium" title={r.provinceName || "-"}>
                            {r.provinceName || "-"}
                          </span>
                        </td>

                        {/* ================================================== */}
                        {/* DOMAIN 1: POPULATION IMMUNITY CELLS */}
                        {/* ================================================== */}
                        {activeDomainTab === "pi" && (
                          <>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.mcv1YearMinus3}
                                onChange={(e) => handleCellChange(r.districtId, "mcv1YearMinus3", e.target.value)}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.mcv1YearMinus2}
                                onChange={(e) => handleCellChange(r.districtId, "mcv1YearMinus2", e.target.value)}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.mcv1YearMinus1}
                                onChange={(e) => handleCellChange(r.districtId, "mcv1YearMinus1", e.target.value)}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-2 border-r text-center font-semibold bg-blue-50/50 dark:bg-blue-950/20 font-mono">
                              <span className={Number(mcv1Avg) >= 95 ? "text-emerald-600" : Number(mcv1Avg) < 80 ? "text-red-600" : "text-amber-600"}>
                                {mcv1Avg}%
                              </span>
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.mcv2YearMinus3}
                                onChange={(e) => handleCellChange(r.districtId, "mcv2YearMinus3", e.target.value)}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.mcv2YearMinus2}
                                onChange={(e) => handleCellChange(r.districtId, "mcv2YearMinus2", e.target.value)}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.mcv2YearMinus1}
                                onChange={(e) => handleCellChange(r.districtId, "mcv2YearMinus1", e.target.value)}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-2 border-r text-center font-semibold bg-purple-50/50 dark:bg-purple-950/20 font-mono">
                              <span className={Number(mcv2Avg) >= 95 ? "text-emerald-600" : Number(mcv2Avg) < 80 ? "text-red-600" : "text-amber-600"}>
                                {mcv2Avg}%
                              </span>
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.siaCoveragePct}
                                onChange={(e) => handleCellChange(r.districtId, "siaCoveragePct", e.target.value)}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <select
                                value={r.siaTargetAgeGroup}
                                onChange={(e) => handleCellChange(r.districtId, "siaTargetAgeGroup", e.target.value)}
                                className="h-7 text-xs rounded border bg-transparent px-1.5 w-full max-w-[110px]"
                              >
                                <option value="WIDE">Wide (&gt;5 cohorts)</option>
                                <option value="NARROW">Narrow (&lt;5 cohorts)</option>
                              </select>
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={10}
                                value={r.siaYearsSince}
                                onChange={(e) => handleCellChange(r.districtId, "siaYearsSince", Number(e.target.value))}
                                className="h-7 w-full max-w-[70px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.unvaccinatedCasesPct}
                                onChange={(e) => handleCellChange(r.districtId, "unvaccinatedCasesPct", e.target.value)}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                          </>
                        )}

                        {/* ================================================== */}
                        {/* DOMAIN 2: SURVEILLANCE QUALITY CELLS */}
                        {/* ================================================== */}
                        {activeDomainTab === "sq" && (
                          <>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                value={r.population}
                                onChange={(e) => handleCellChange(r.districtId, "population", e.target.value)}
                                className="h-7 w-full max-w-[95px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.suspectedCases}
                                onChange={(e) => handleCellChange(r.districtId, "suspectedCases", Number(e.target.value))}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.discardedCases}
                                onChange={(e) => handleCellChange(r.districtId, "discardedCases", Number(e.target.value))}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-2 border-r text-center font-semibold bg-amber-50/50 dark:bg-amber-950/20 font-mono">
                              <span className={Number(discardedRate) >= 2 ? "text-emerald-600" : Number(discardedRate) < 1 ? "text-red-600" : "text-amber-600"}>
                                {discardedRate}
                              </span>
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="1"
                                value={r.adequateInvestigationPct}
                                onChange={(e) => handleCellChange(r.districtId, "adequateInvestigationPct", e.target.value)}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="1"
                                value={r.adequateSpecimenPct}
                                onChange={(e) => handleCellChange(r.districtId, "adequateSpecimenPct", e.target.value)}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="1"
                                value={r.timelyLabResultsPct}
                                onChange={(e) => handleCellChange(r.districtId, "timelyLabResultsPct", e.target.value)}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                          </>
                        )}

                        {/* ================================================== */}
                        {/* DOMAIN 3: PROGRAM DELIVERY CELLS */}
                        {/* ================================================== */}
                        {activeDomainTab === "pd" && (
                          <>
                            <td className="p-2 border-r text-center font-medium font-mono">{mcv1Avg}%</td>
                            <td className="p-2 border-r text-center font-semibold">
                              {Number(r.mcv1YearMinus1) >= Number(r.mcv1YearMinus3) ? (
                                <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200 text-[10px]">
                                  Stable / +
                                </Badge>
                              ) : Number(r.mcv1YearMinus3) - Number(r.mcv1YearMinus1) > 10 ? (
                                <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200 text-[10px]">
                                  &gt;10% Decline
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200 text-[10px]">
                                  Minor Decline
                                </Badge>
                              )}
                            </td>
                            <td className="p-2 border-r text-center font-medium font-mono">{mcv2Avg}%</td>
                            <td className="p-2 border-r text-center font-semibold">
                              {Number(r.mcv2YearMinus1) >= Number(r.mcv2YearMinus3) ? (
                                <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200 text-[10px]">
                                  Stable / +
                                </Badge>
                              ) : Number(r.mcv2YearMinus3) - Number(r.mcv2YearMinus1) > 10 ? (
                                <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200 text-[10px]">
                                  &gt;10% Decline
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200 text-[10px]">
                                  Minor Decline
                                </Badge>
                              )}
                            </td>
                            <td className="p-2 border-r text-center font-semibold bg-red-50/50 dark:bg-red-950/20 font-mono">
                              <span className={Number(mcv1mcv2Dropout) <= 10 ? "text-emerald-600" : "text-red-600"}>
                                {mcv1mcv2Dropout}%
                              </span>
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.penta1YearMinus1}
                                onChange={(e) => handleCellChange(r.districtId, "penta1YearMinus1", e.target.value)}
                                className="h-7 w-full max-w-[84px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-2 border-r text-center font-semibold bg-red-50/50 dark:bg-red-950/20 font-mono">
                              <span className={Number(penta1mcv1Dropout) <= 10 ? "text-emerald-600" : "text-red-600"}>
                                {penta1mcv1Dropout}%
                              </span>
                            </td>
                          </>
                        )}

                        {/* ================================================== */}
                        {/* DOMAIN 4: THREATS & VULNERABILITIES CELLS */}
                        {/* ================================================== */}
                        {activeDomainTab === "ta" && (
                          <>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.threatCasesUnder5}
                                onChange={(e) => handleCellChange(r.districtId, "threatCasesUnder5", Number(e.target.value))}
                                className="h-7 w-full max-w-[75px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.threatCases5To14}
                                onChange={(e) => handleCellChange(r.districtId, "threatCases5To14", Number(e.target.value))}
                                className="h-7 w-full max-w-[75px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.threatCases15Plus}
                                onChange={(e) => handleCellChange(r.districtId, "threatCases15Plus", Number(e.target.value))}
                                className="h-7 w-full max-w-[75px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                value={r.areaKm2}
                                onChange={(e) => handleCellChange(r.districtId, "areaKm2", e.target.value)}
                                className="h-7 w-full max-w-[85px] text-center text-xs font-mono mx-auto px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="p-2 border-r text-center font-medium bg-slate-100/60 dark:bg-slate-800/60 font-mono">
                              {density}
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(r.borderCaseInPastYear)}
                                onChange={(e) => handleCellChange(r.districtId, "borderCaseInPastYear", e.target.checked)}
                                className="h-4 w-4 rounded text-primary cursor-pointer"
                              />
                            </td>

                            {/* 8 WHO Vulnerabilities */}
                            <td className="p-1 border-r text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(r.vulnerabilities?.migrantOrUnderserved)}
                                onChange={(e) => handleCellChange(r.districtId, "vuln_migrantOrUnderserved", e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-primary cursor-pointer"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(r.vulnerabilities?.vaccineHesitancyOrRefusal)}
                                onChange={(e) => handleCellChange(r.districtId, "vuln_vaccineHesitancyOrRefusal", e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-primary cursor-pointer"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(r.vulnerabilities?.securityOrConflictConcerns)}
                                onChange={(e) => handleCellChange(r.districtId, "vuln_securityOrConflictConcerns", e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-primary cursor-pointer"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(r.vulnerabilities?.recurrentNaturalDisasters)}
                                onChange={(e) => handleCellChange(r.districtId, "vuln_recurrentNaturalDisasters", e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-primary cursor-pointer"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(r.vulnerabilities?.poorAccessOrTerrain)}
                                onChange={(e) => handleCellChange(r.districtId, "vuln_poorAccessOrTerrain", e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-primary cursor-pointer"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(r.vulnerabilities?.inadequatePoliticalSupport)}
                                onChange={(e) => handleCellChange(r.districtId, "vuln_inadequatePoliticalSupport", e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-primary cursor-pointer"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(r.vulnerabilities?.highTransitHubOrBorder)}
                                onChange={(e) => handleCellChange(r.districtId, "vuln_highTransitHubOrBorder", e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-primary cursor-pointer"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(r.vulnerabilities?.massGatheringsOrEvents)}
                                onChange={(e) => handleCellChange(r.districtId, "vuln_massGatheringsOrEvents", e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-primary cursor-pointer"
                              />
                            </td>
                            <td className="p-2 border-r text-center font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-mono">
                              {vulnCount} / 8
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls (Rule 24) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Rows per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-20 text-xs">
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

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </Button>
              <span className="px-3 py-1 bg-muted rounded font-medium text-xs">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
