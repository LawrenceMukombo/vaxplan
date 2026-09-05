import React, { useState, useMemo, useEffect } from "react";
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

      {/* Domain Selection Tabs */}
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
                  <span>1. Pop. Immunity (40 pts)</span>
                </TabsTrigger>
                <TabsTrigger value="sq" className="text-xs gap-1.5">
                  <span>2. Surv. Quality (20 pts)</span>
                </TabsTrigger>
                <TabsTrigger value="pd" className="text-xs gap-1.5">
                  <span>3. Prog. Delivery (16 pts)</span>
                </TabsTrigger>
                <TabsTrigger value="ta" className="text-xs gap-1.5">
                  <span>4. Threats & Vuln (24 pts)</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search & Province Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
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
                  <SelectTrigger className="h-8 text-xs w-44">
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

          {/* Domain Explanation Banner */}
          <div className="text-xs rounded-md bg-muted/50 p-2.5 flex items-center justify-between">
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

            <span className="text-[11px] font-medium text-foreground shrink-0 ml-2">
              Showing {sortedRows.length} districts
            </span>
          </div>

          {/* Tabular Grid (Rule 24 Enterprise Table) */}
          <div className="overflow-x-auto border rounded-md max-h-[560px] relative">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-foreground border-b z-10 shadow-sm font-semibold">
                <tr>
                  <th className="p-2.5 w-10 text-center border-r">#</th>
                  <th
                    className="p-2.5 min-w-[160px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r"
                    onClick={() => handleSort("districtName")}
                  >
                    <div className="flex items-center justify-between">
                      <span>District</span>
                      <ChevronsUpDown className="w-3 h-3 ml-1 opacity-60" />
                    </div>
                  </th>
                  <th className="p-2.5 min-w-[120px] border-r">Province</th>

                  {/* DOMAIN 1: POPULATION IMMUNITY */}
                  {activeDomainTab === "pi" && (
                    <>
                      <th className="p-2 text-center border-r bg-blue-50/70 dark:bg-blue-950/40 min-w-[85px]">
                        MCV1 Y-3 (%)
                      </th>
                      <th className="p-2 text-center border-r bg-blue-50/70 dark:bg-blue-950/40 min-w-[85px]">
                        MCV1 Y-2 (%)
                      </th>
                      <th className="p-2 text-center border-r bg-blue-50/70 dark:bg-blue-950/40 min-w-[85px]">
                        MCV1 Y-1 (%)
                      </th>
                      <th className="p-2 text-center border-r bg-blue-100/70 dark:bg-blue-900/40 min-w-[85px]">
                        MCV1 3-Yr Avg
                      </th>
                      <th className="p-2 text-center border-r bg-purple-50/70 dark:bg-purple-950/40 min-w-[85px]">
                        MCV2 Y-3 (%)
                      </th>
                      <th className="p-2 text-center border-r bg-purple-50/70 dark:bg-purple-950/40 min-w-[85px]">
                        MCV2 Y-2 (%)
                      </th>
                      <th className="p-2 text-center border-r bg-purple-50/70 dark:bg-purple-950/40 min-w-[85px]">
                        MCV2 Y-1 (%)
                      </th>
                      <th className="p-2 text-center border-r bg-purple-100/70 dark:bg-purple-900/40 min-w-[85px]">
                        MCV2 3-Yr Avg
                      </th>
                      <th className="p-2 text-center border-r min-w-[90px]">SIA Cov. (%)</th>
                      <th className="p-2 text-center border-r min-w-[90px]">SIA Age Group</th>
                      <th className="p-2 text-center border-r min-w-[80px]">SIA Yrs Ago</th>
                      <th className="p-2 text-center min-w-[100px]">% Unvaccinated</th>
                    </>
                  )}

                  {/* DOMAIN 2: SURVEILLANCE QUALITY */}
                  {activeDomainTab === "sq" && (
                    <>
                      <th className="p-2 text-center border-r min-w-[90px]">Population</th>
                      <th className="p-2 text-center border-r min-w-[85px]">Suspected Cases</th>
                      <th className="p-2 text-center border-r min-w-[85px]">Discarded Cases</th>
                      <th className="p-2 text-center border-r bg-amber-50/70 dark:bg-amber-950/40 min-w-[110px]">
                        Discarded Rate / 100k
                      </th>
                      <th className="p-2 text-center border-r min-w-[110px]">Adeq. Invest. % (48h)</th>
                      <th className="p-2 text-center border-r min-w-[110px]">Adeq. Specimen % (28d)</th>
                      <th className="p-2 text-center min-w-[110px]">Timely Lab Results %</th>
                    </>
                  )}

                  {/* DOMAIN 3: PROGRAM DELIVERY */}
                  {activeDomainTab === "pd" && (
                    <>
                      <th className="p-2 text-center border-r min-w-[95px]">MCV1 3-Yr Avg</th>
                      <th className="p-2 text-center border-r min-w-[110px]">MCV1 Trend (Slope)</th>
                      <th className="p-2 text-center border-r min-w-[95px]">MCV2 3-Yr Avg</th>
                      <th className="p-2 text-center border-r min-w-[110px]">MCV2 Trend (Slope)</th>
                      <th className="p-2 text-center border-r bg-red-50/70 dark:bg-red-950/40 min-w-[120px]">
                        MCV1-MCV2 Dropout %
                      </th>
                      <th className="p-2 text-center border-r min-w-[95px]">Penta1 Y-1 (%)</th>
                      <th className="p-2 text-center bg-red-50/70 dark:bg-red-950/40 min-w-[120px]">
                        Penta1-MCV1 Dropout %
                      </th>
                    </>
                  )}

                  {/* DOMAIN 4: THREATS & VULNERABILITIES */}
                  {activeDomainTab === "ta" && (
                    <>
                      <th className="p-2 text-center border-r min-w-[85px]">Cases &lt;5y</th>
                      <th className="p-2 text-center border-r min-w-[85px]">Cases 5-14y</th>
                      <th className="p-2 text-center border-r min-w-[85px]">Cases 15+y</th>
                      <th className="p-2 text-center border-r min-w-[95px]">Area (km²)</th>
                      <th className="p-2 text-center border-r bg-slate-200/60 dark:bg-slate-700/60 min-w-[95px]">
                        Density (/km²)
                      </th>
                      <th className="p-2 text-center border-r min-w-[105px]">Border Outbreak?</th>
                      <th className="p-2 text-center border-r min-w-[75px]" title="Migrant/IDP/Slums">
                        Migrants
                      </th>
                      <th className="p-2 text-center border-r min-w-[75px]" title="Vaccine Hesitancy">
                        Hesitancy
                      </th>
                      <th className="p-2 text-center border-r min-w-[75px]" title="Security Concerns">
                        Security
                      </th>
                      <th className="p-2 text-center border-r min-w-[75px]" title="Disasters / Calamities">
                        Disasters
                      </th>
                      <th className="p-2 text-center border-r min-w-[75px]" title="Poor Access / Terrain">
                        Terrain
                      </th>
                      <th className="p-2 text-center border-r min-w-[75px]" title="Lack of Political Support">
                        Political
                      </th>
                      <th className="p-2 text-center border-r min-w-[75px]" title="High Transit Corridors">
                        Transit
                      </th>
                      <th className="p-2 text-center border-r min-w-[75px]" title="Mass Gatherings">
                        Gatherings
                      </th>
                      <th className="p-2 text-center min-w-[80px] bg-amber-100/70 dark:bg-amber-900/40">
                        Vuln Pts (0-8)
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="text-center py-8 text-muted-foreground">
                      No districts matched your search criteria.
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
                        className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                      >
                        <td className="p-2 text-center text-muted-foreground border-r">{globalIdx}</td>
                        <td className="p-2 font-medium border-r whitespace-nowrap">
                          {r.districtName || `District ${r.districtId}`}
                        </td>
                        <td className="p-2 text-muted-foreground border-r whitespace-nowrap">
                          {r.provinceName || "-"}
                        </td>

                        {/* DOMAIN 1: POPULATION IMMUNITY */}
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
                                className="h-7 w-16 text-center text-xs mx-auto"
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
                                className="h-7 w-16 text-center text-xs mx-auto"
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
                                className="h-7 w-16 text-center text-xs mx-auto font-medium"
                              />
                            </td>
                            <td className="p-2 border-r text-center font-semibold bg-blue-50/50 dark:bg-blue-950/20">
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
                                className="h-7 w-16 text-center text-xs mx-auto"
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
                                className="h-7 w-16 text-center text-xs mx-auto"
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
                                className="h-7 w-16 text-center text-xs mx-auto font-medium"
                              />
                            </td>
                            <td className="p-2 border-r text-center font-semibold bg-purple-50/50 dark:bg-purple-950/20">
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
                                className="h-7 w-16 text-center text-xs mx-auto"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <select
                                value={r.siaTargetAgeGroup}
                                onChange={(e) => handleCellChange(r.districtId, "siaTargetAgeGroup", e.target.value)}
                                className="h-7 text-xs rounded border bg-transparent px-1"
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
                                className="h-7 w-14 text-center text-xs mx-auto"
                              />
                            </td>
                            <td className="p-1 text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={r.unvaccinatedCasesPct}
                                onChange={(e) => handleCellChange(r.districtId, "unvaccinatedCasesPct", e.target.value)}
                                className="h-7 w-16 text-center text-xs mx-auto"
                              />
                            </td>
                          </>
                        )}

                        {/* DOMAIN 2: SURVEILLANCE QUALITY */}
                        {activeDomainTab === "sq" && (
                          <>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                value={r.population}
                                onChange={(e) => handleCellChange(r.districtId, "population", e.target.value)}
                                className="h-7 w-20 text-center text-xs mx-auto"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.suspectedCases}
                                onChange={(e) => handleCellChange(r.districtId, "suspectedCases", Number(e.target.value))}
                                className="h-7 w-16 text-center text-xs mx-auto font-medium"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.discardedCases}
                                onChange={(e) => handleCellChange(r.districtId, "discardedCases", Number(e.target.value))}
                                className="h-7 w-16 text-center text-xs mx-auto"
                              />
                            </td>
                            <td className="p-2 border-r text-center font-semibold bg-amber-50/50 dark:bg-amber-950/20">
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
                                className="h-7 w-18 text-center text-xs mx-auto"
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
                                className="h-7 w-18 text-center text-xs mx-auto"
                              />
                            </td>
                            <td className="p-1 text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="1"
                                value={r.timelyLabResultsPct}
                                onChange={(e) => handleCellChange(r.districtId, "timelyLabResultsPct", e.target.value)}
                                className="h-7 w-18 text-center text-xs mx-auto font-medium"
                              />
                            </td>
                          </>
                        )}

                        {/* DOMAIN 3: PROGRAM DELIVERY */}
                        {activeDomainTab === "pd" && (
                          <>
                            <td className="p-2 border-r text-center font-medium">{mcv1Avg}%</td>
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
                            <td className="p-2 border-r text-center font-medium">{mcv2Avg}%</td>
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
                            <td className="p-2 border-r text-center font-semibold bg-red-50/50 dark:bg-red-950/20">
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
                                className="h-7 w-16 text-center text-xs mx-auto"
                              />
                            </td>
                            <td className="p-2 text-center font-semibold bg-red-50/50 dark:bg-red-950/20">
                              <span className={Number(penta1mcv1Dropout) <= 10 ? "text-emerald-600" : "text-red-600"}>
                                {penta1mcv1Dropout}%
                              </span>
                            </td>
                          </>
                        )}

                        {/* DOMAIN 4: THREATS & VULNERABILITIES */}
                        {activeDomainTab === "ta" && (
                          <>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.threatCasesUnder5}
                                onChange={(e) => handleCellChange(r.districtId, "threatCasesUnder5", Number(e.target.value))}
                                className="h-7 w-14 text-center text-xs mx-auto"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.threatCases5To14}
                                onChange={(e) => handleCellChange(r.districtId, "threatCases5To14", Number(e.target.value))}
                                className="h-7 w-14 text-center text-xs mx-auto"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                min={0}
                                value={r.threatCases15Plus}
                                onChange={(e) => handleCellChange(r.districtId, "threatCases15Plus", Number(e.target.value))}
                                className="h-7 w-14 text-center text-xs mx-auto"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <Input
                                type="number"
                                value={r.areaKm2}
                                onChange={(e) => handleCellChange(r.districtId, "areaKm2", e.target.value)}
                                className="h-7 w-16 text-center text-xs mx-auto"
                              />
                            </td>
                            <td className="p-2 border-r text-center font-medium bg-slate-100/60 dark:bg-slate-800/60">
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

                            {/* 8 Vulnerabilities */}
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
                            <td className="p-2 text-center font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
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
                  <SelectItem value="500">All</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-muted-foreground ml-2">
                Page {currentPage} of {totalPages} ({sortedRows.length} total districts)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0 text-xs"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
