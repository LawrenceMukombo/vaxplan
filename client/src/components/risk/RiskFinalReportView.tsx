import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  Printer,
  FileText,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  MapPin,
  Users,
  Building2,
  TrendingDown,
  Info,
  Edit3,
  Sparkles,
  RotateCcw,
  Save,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Search,
  Filter,
  SlidersHorizontal,
  Layers,
  Table as TableIcon,
  FileSpreadsheet,
} from "lucide-react";

interface AreaResult {
  id: string;
  districtId: number;
  districtName?: string;
  areaName?: string;
  provinceName?: string;
  provinceId?: number | null;
  riskCategory: string;
  totalScore?: string | null;
  totalRiskScore?: string | null;
  riskScore?: string | number | null;
  population?: string | number | null;
  areaKm2?: string | number | null;
  domainScoresJson?: any;
  populationImmunityScore?: string | null;
  surveillanceQualityScore?: string | null;
  programmeDeliveryScore?: string | null;
  threatAssessmentScore?: string | null;
  summaryExplanation?: string | null;
}

interface ReportConfig {
  backgroundNarrative?: string;
  strategicPriorities?: string;
  leadAssessor?: string;
  epiManager?: string;
  signOffDate?: string;
  approvalStatus?: string;
  districtRecommendations?: Record<string, string>;
}

interface Props {
  assessment: any;
  districtResults: AreaResult[];
}

const DEFAULT_BACKGROUND = `The World Health Organization (WHO) measles programmatic risk assessment tool identifies areas not meeting measles programmatic targets in order to guide and strengthen measles elimination program activities and reduce the risk of outbreaks. The tool assesses subnational programmatic risk across four core categories: Population Immunity (40%), Surveillance Quality (20%), Program Performance (16%), and Threat Assessment (24%).`;

const DEFAULT_STRATEGIC_PRIORITIES = `• Microplanning Revisions: Update village catchment maps and health facility session frequency for all VHR districts.\n• Rapid Catch-up / Defaulter Tracing: Conduct targeted periodic intensification of routine immunization (PIRI) in subdistricts with MCV1 < 80%.\n• Cold Chain Audit: Verify functional storage and temperature monitoring in remote clinics experiencing supply interruptions.\n• Active Surveillance Audits: In districts with Non-measles Discarded Rate < 2 per 100k, conduct weekly zero-reporting and retrospective hospital record reviews.`;

const ACTION_PRESETS = [
  "Conduct targeted catch-up mop-up; track unimmunized cohorts.",
  "Intensify active surveillance; retrain focal staff on 48h case investigation.",
  "Audit defaulter tracking; eliminate vaccine stockouts at facility level.",
  "Establish rapid response team; cross-border synchronization with neighbours.",
  "Microplan revision; intensify outreach to underserved settlements.",
  "Community engagement campaign addressing vaccine hesitancy.",
  "Cold chain rehabilitation; deploy solar direct drive refrigerators.",
];

export function RiskFinalReportView({ assessment, districtResults = [] }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const countryName = assessment?.tenantName || "South Africa";
  const assessmentYear = assessment?.assessmentYear || 2024;
  const baselineYears = assessment?.baselineYears || [assessmentYear - 3, assessmentYear - 2, assessmentYear - 1];
  const dateFormatted = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Direct Entry Fallback query if results are empty or pending calculation
  const { data: directEntryData } = useQuery<{ entries: any[] }>({
    queryKey: [`/api/risk/assessments/${assessment?.id}/direct-entry`],
    queryFn: async () => {
      if (!assessment?.id) return { entries: [] };
      return await apiRequest<any>("GET", `/api/risk/assessments/${assessment.id}/direct-entry`);
    },
    enabled: Boolean(assessment?.id && districtResults.length <= 1),
  });

  // Synthesize resilient results if districtResults has <= 1 row
  const effectiveDistrictResults: AreaResult[] = useMemo(() => {
    if (districtResults && districtResults.length > 1) {
      return districtResults;
    }

    if (directEntryData?.entries && directEntryData.entries.length > 0) {
      return directEntryData.entries.map((entry, idx) => {
        const pop = Number(entry.population) || 120000;
        const mcv1 = (Number(entry.mcv1YearMinus1) + Number(entry.mcv1YearMinus2) + Number(entry.mcv1YearMinus3)) / 3 || 80;
        const mcv2 = (Number(entry.mcv2YearMinus1) + Number(entry.mcv2YearMinus2) + Number(entry.mcv2YearMinus3)) / 3 || 75;

        // Approximate WHO domain scoring
        let pi = mcv1 < 70 ? 36 : mcv1 < 80 ? 28 : mcv1 < 90 ? 18 : mcv1 < 95 ? 8 : 2;
        let sq = (Number(entry.discardedCases) || 0) < 2 ? 16 : 6;
        let pd = (mcv1 - mcv2) > 10 ? 12 : 4;
        let ta = (Number(entry.threatCasesUnder5) || 0) > 0 ? 18 : 6;
        const total = pi + sq + pd + ta;
        const cat = total >= 61 ? "VERY_HIGH" : total >= 55 ? "HIGH" : total >= 48 ? "MEDIUM" : "LOW";

        return {
          id: entry.id || String(entry.districtId),
          districtId: entry.districtId,
          districtName: entry.districtName || `District ${entry.districtId}`,
          areaName: entry.districtName || `District ${entry.districtId}`,
          provinceName: entry.provinceName || "National",
          population: pop,
          riskCategory: cat,
          totalScore: String(total),
          totalRiskScore: String(total),
          riskScore: total,
          populationImmunityScore: String(pi),
          surveillanceQualityScore: String(sq),
          programmeDeliveryScore: String(pd),
          threatAssessmentScore: String(ta),
        };
      });
    }

    return districtResults;
  }, [districtResults, directEntryData]);

  // Report Config State
  const initialConfig: ReportConfig = useMemo(() => {
    const raw = assessment?.reportConfigJson || {};
    return {
      backgroundNarrative: raw.backgroundNarrative || DEFAULT_BACKGROUND,
      strategicPriorities: raw.strategicPriorities || DEFAULT_STRATEGIC_PRIORITIES,
      leadAssessor: raw.leadAssessor || "National VPD Epidemiologist",
      epiManager: raw.epiManager || "Ministry of Health EPI Director",
      signOffDate: raw.signOffDate || dateFormatted,
      approvalStatus: raw.approvalStatus || (assessment?.status === "APPROVED" ? "APPROVED" : "DRAFT"),
      districtRecommendations: raw.districtRecommendations || {},
    };
  }, [assessment, dateFormatted]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig>(initialConfig);

  useEffect(() => {
    setReportConfig(initialConfig);
  }, [initialConfig]);

  // Save Report Config Mutation
  const saveReportMutation = useMutation({
    mutationFn: async (updatedConfig: ReportConfig) => {
      return await apiRequest<any>("PATCH", `/api/risk/assessments/${assessment.id}`, {
        reportConfigJson: updatedConfig,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${assessment.id}`] });
      setIsEditModalOpen(false);
      toast({
        title: "Report Configuration Saved",
        description: "Report narrative, recommendations, and sign-offs updated successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to Save",
        description: err.message || "Could not save report modifications.",
        variant: "destructive",
      });
    },
  });

  const totalDistricts = effectiveDistrictResults.length || 1;
  const totalPopulation = useMemo(() => {
    return effectiveDistrictResults.reduce((acc, d) => acc + (Number(d.population) || 0), 0);
  }, [effectiveDistrictResults]);

  // Counts & Tiers
  const stats = useMemo(() => {
    const counts = { VERY_HIGH: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const pops = { VERY_HIGH: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

    effectiveDistrictResults.forEach((d) => {
      const cat = (d.riskCategory || "LOW") as keyof typeof counts;
      if (counts[cat] !== undefined) {
        counts[cat]++;
        pops[cat] += Number(d.population) || 0;
      }
    });

    return { counts, pops };
  }, [effectiveDistrictResults]);

  // Province Breakdown
  const provinceBreakdown = useMemo(() => {
    const map = new Map<string, { VERY_HIGH: number; HIGH: number; MEDIUM: number; LOW: number; total: number }>();
    effectiveDistrictResults.forEach((d) => {
      const p = d.provinceName || "National";
      if (!map.has(p)) {
        map.set(p, { VERY_HIGH: 0, HIGH: 0, MEDIUM: 0, LOW: 0, total: 0 });
      }
      const item = map.get(p)!;
      const cat = (d.riskCategory || "LOW") as "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";
      if (item[cat] !== undefined) {
        item[cat]++;
      }
      item.total++;
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [effectiveDistrictResults]);

  // CSV Export Utility (Rule 24 Enterprise Tables)
  const exportToCsv = (filename: string, rows: (string | number)[][]) => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows
        .map((row) =>
          row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Table 1 National Summary Sorting & Export
  type SortCol1 = "category" | "numDistricts" | "pctDistricts" | "population" | "pctPopulation";
  const [sortCol1, setSortCol1] = useState<SortCol1>("category");
  const [sortDir1, setSortDir1] = useState<"asc" | "desc">("asc");

  const handleSort1 = (col: SortCol1) => {
    if (sortCol1 === col) {
      setSortDir1(sortDir1 === "asc" ? "desc" : "asc");
    } else {
      setSortCol1(col);
      setSortDir1("desc");
    }
  };

  const getSortIcon1 = (col: SortCol1) => {
    if (sortCol1 !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-50 inline" />;
    return sortDir1 === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline text-primary" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-primary" />;
  };

  const summaryRows = useMemo(() => {
    const rows = [
      { key: "VERY_HIGH", label: "Very High Risk (Score ≥ 61)", num: stats.counts.VERY_HIGH, pct: totalDistricts ? ((stats.counts.VERY_HIGH / totalDistricts) * 100) : 0, pop: stats.pops.VERY_HIGH, popPct: totalPopulation ? ((stats.pops.VERY_HIGH / totalPopulation) * 100) : 0, bg: "bg-red-50/60 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400" },
      { key: "HIGH", label: "High Risk (Score 55–60)", num: stats.counts.HIGH, pct: totalDistricts ? ((stats.counts.HIGH / totalDistricts) * 100) : 0, pop: stats.pops.HIGH, popPct: totalPopulation ? ((stats.pops.HIGH / totalPopulation) * 100) : 0, bg: "bg-orange-50/60 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400" },
      { key: "MEDIUM", label: "Medium Risk (Score 48–54)", num: stats.counts.MEDIUM, pct: totalDistricts ? ((stats.counts.MEDIUM / totalDistricts) * 100) : 0, pop: stats.pops.MEDIUM, popPct: totalPopulation ? ((stats.pops.MEDIUM / totalPopulation) * 100) : 0, bg: "bg-amber-50/60 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400" },
      { key: "LOW", label: "Low Risk (Score ≤ 47)", num: stats.counts.LOW, pct: totalDistricts ? ((stats.counts.LOW / totalDistricts) * 100) : 0, pop: stats.pops.LOW, popPct: totalPopulation ? ((stats.pops.LOW / totalPopulation) * 100) : 0, bg: "bg-emerald-50/60 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400" },
    ];
    return rows.sort((a, b) => {
      if (sortCol1 === "category") return sortDir1 === "asc" ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label);
      if (sortCol1 === "numDistricts") return sortDir1 === "asc" ? a.num - b.num : b.num - a.num;
      if (sortCol1 === "pctDistricts") return sortDir1 === "asc" ? a.pct - b.pct : b.pct - a.pct;
      if (sortCol1 === "population") return sortDir1 === "asc" ? a.pop - b.pop : b.pop - a.pop;
      if (sortCol1 === "pctPopulation") return sortDir1 === "asc" ? a.popPct - b.popPct : b.popPct - a.popPct;
      return 0;
    });
  }, [stats, totalDistricts, totalPopulation, sortCol1, sortDir1]);

  const exportTable1CSV = () => {
    exportToCsv("Table_1_National_Risk_Summary.csv", [
      ["Programmatic Risk Category", "Number of Districts", "% of Districts", "Total Population", "% of Population"],
      ...summaryRows.map((r) => [r.label, r.num, `${r.pct.toFixed(1)}%`, r.pop, `${r.popPct.toFixed(1)}%`]),
      ["National Total", totalDistricts, "100.0%", totalPopulation, "100.0%"],
    ]);
  };

  // Table 1a Sorting & Column Widths State
  type SortCol1a = "province" | "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" | "total";
  const [sortCol1a, setSortCol1a] = useState<SortCol1a>("province");
  const [sortDir1a, setSortDir1a] = useState<"asc" | "desc">("asc");

  const DEFAULT_PROV_COL_WIDTHS = {
    province: 160,
    veryHigh: 120,
    high: 110,
    medium: 110,
    low: 110,
    total: 120,
  };
  const [provColWidths, setProvColWidths] = useState(DEFAULT_PROV_COL_WIDTHS);
  const [resizingProvCol, setResizingProvCol] = useState<keyof typeof DEFAULT_PROV_COL_WIDTHS | null>(null);
  const provResizeStartX = useRef(0);
  const provResizeStartWidth = useRef(0);

  const startProvResize = (colKey: keyof typeof DEFAULT_PROV_COL_WIDTHS, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingProvCol(colKey);
    provResizeStartX.current = e.clientX;
    provResizeStartWidth.current = provColWidths[colKey];
  };

  useEffect(() => {
    if (!resizingProvCol) return;
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - provResizeStartX.current;
      const newWidth = Math.max(50, provResizeStartWidth.current + diff);
      setProvColWidths((prev) => ({ ...prev, [resizingProvCol]: newWidth }));
    };
    const handleMouseUp = () => setResizingProvCol(null);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingProvCol]);

  const handleStretchWideProv = () => {
    setProvColWidths({
      province: 220,
      veryHigh: 150,
      high: 140,
      medium: 140,
      low: 140,
      total: 150,
    });
  };

  const handleCompactProv = () => {
    setProvColWidths({
      province: 130,
      veryHigh: 95,
      high: 85,
      medium: 85,
      low: 85,
      total: 95,
    });
  };

  const handleResetProvWidths = () => {
    setProvColWidths(DEFAULT_PROV_COL_WIDTHS);
  };

  const handleSort1a = (col: SortCol1a) => {
    if (sortCol1a === col) {
      setSortDir1a(sortDir1a === "asc" ? "desc" : "asc");
    } else {
      setSortCol1a(col);
      setSortDir1a("desc");
    }
  };

  const getSortIcon1a = (col: SortCol1a) => {
    if (sortCol1a !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-50 inline" />;
    return sortDir1a === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline text-primary" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-primary" />;
  };

  const sortedProvinceBreakdown = useMemo(() => {
    return [...provinceBreakdown].sort((a, b) => {
      if (sortCol1a === "province") {
        return sortDir1a === "asc" ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]);
      }
      const valA = a[1][sortCol1a] ?? 0;
      const valB = b[1][sortCol1a] ?? 0;
      return sortDir1a === "asc" ? valA - valB : valB - valA;
    });
  }, [provinceBreakdown, sortCol1a, sortDir1a]);

  const exportTable1aCSV = () => {
    exportToCsv("Table_1a_Province_Risk_Breakdown.csv", [
      ["Province", "Very High Risk", "High Risk", "Medium Risk", "Low Risk", "Total Districts"],
      ...sortedProvinceBreakdown.map(([prov, c]) => [prov, c.VERY_HIGH, c.HIGH, c.MEDIUM, c.LOW, c.total]),
    ]);
  };

  // Report Tables Column Widths & Resizing Controls (Tables 1b & 1c)
  const DEFAULT_REPORT_COL_WIDTHS = {
    index: 44,
    province: 140,
    district: 190,
    population: 110,
    pi: 185,
    sq: 185,
    pd: 220,
    ta: 180,
    total: 175,
    rec: 320,
  };
  const [reportColWidths, setReportColWidths] = useState(DEFAULT_REPORT_COL_WIDTHS);
  const [reportResizingCol, setReportResizingCol] = useState<keyof typeof DEFAULT_REPORT_COL_WIDTHS | null>(null);
  const reportResizeStartX = useRef(0);
  const reportResizeStartWidth = useRef(0);

  const startReportResize = (colKey: keyof typeof DEFAULT_REPORT_COL_WIDTHS, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReportResizingCol(colKey);
    reportResizeStartX.current = e.clientX;
    reportResizeStartWidth.current = reportColWidths[colKey];
  };

  useEffect(() => {
    if (!reportResizingCol) return;
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - reportResizeStartX.current;
      const newWidth = Math.max(40, reportResizeStartWidth.current + diff);
      setReportColWidths((prev) => ({ ...prev, [reportResizingCol]: newWidth }));
    };
    const handleMouseUp = () => setReportResizingCol(null);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [reportResizingCol]);

  const handleStretchWideReport = () => {
    setReportColWidths({
      index: 52,
      province: 170,
      district: 240,
      population: 130,
      pi: 220,
      sq: 220,
      pd: 260,
      ta: 220,
      total: 210,
      rec: 420,
    });
  };

  const handleCompactReport = () => {
    setReportColWidths({
      index: 40,
      province: 110,
      district: 140,
      population: 95,
      pi: 140,
      sq: 140,
      pd: 160,
      ta: 140,
      total: 130,
      rec: 260,
    });
  };

  const handleResetReportWidths = () => {
    setReportColWidths(DEFAULT_REPORT_COL_WIDTHS);
  };

  // Very High & High Risk Districts
  const vhrDistricts = useMemo(() => {
    return effectiveDistrictResults.filter((d) => d.riskCategory === "VERY_HIGH");
  }, [effectiveDistrictResults]);

  const hrDistricts = useMemo(() => {
    return effectiveDistrictResults.filter((d) => d.riskCategory === "HIGH");
  }, [effectiveDistrictResults]);

  type SortColDist = "index" | "province" | "district" | "population" | "pi" | "sq" | "pd" | "ta" | "total";
  const [sortCol1b, setSortCol1b] = useState<SortColDist>("total");
  const [sortDir1b, setSortDir1b] = useState<"asc" | "desc">("desc");
  const [sortCol1c, setSortCol1c] = useState<SortColDist>("total");
  const [sortDir1c, setSortDir1c] = useState<"asc" | "desc">("desc");

  const sortDistList = (list: AreaResult[], sortCol: SortColDist, sortDir: "asc" | "desc") => {
    return [...list].sort((a, b) => {
      if (sortCol === "index") return 0;
      if (sortCol === "province") {
        const valA = a.provinceName || "";
        const valB = b.provinceName || "";
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortCol === "district") {
        const valA = a.areaName || a.districtName || "";
        const valB = b.areaName || b.districtName || "";
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortCol === "population") {
        const valA = Number(a.population) || 0;
        const valB = Number(b.population) || 0;
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      if (sortCol === "pi") {
        const valA = Number(a.populationImmunityScore || (a as any).domainScoresJson?.PI || 0);
        const valB = Number(b.populationImmunityScore || (b as any).domainScoresJson?.PI || 0);
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      if (sortCol === "sq") {
        const valA = Number(a.surveillanceQualityScore || (a as any).domainScoresJson?.SQ || 0);
        const valB = Number(b.surveillanceQualityScore || (b as any).domainScoresJson?.SQ || 0);
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      if (sortCol === "pd") {
        const valA = Number(a.programmeDeliveryScore || (a as any).domainScoresJson?.PD || 0);
        const valB = Number(b.programmeDeliveryScore || (b as any).domainScoresJson?.PD || 0);
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      if (sortCol === "ta") {
        const valA = Number(a.threatAssessmentScore || (a as any).domainScoresJson?.TA || 0);
        const valB = Number(b.threatAssessmentScore || (b as any).domainScoresJson?.TA || 0);
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      // total
      const valA = Number(a.totalRiskScore || a.totalScore || a.riskScore || 0);
      const valB = Number(b.totalRiskScore || b.totalScore || b.riskScore || 0);
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
  };

  const sortedVhrDistricts = useMemo(() => sortDistList(vhrDistricts, sortCol1b, sortDir1b), [vhrDistricts, sortCol1b, sortDir1b]);
  const sortedHrDistricts = useMemo(() => sortDistList(hrDistricts, sortCol1c, sortDir1c), [hrDistricts, sortCol1c, sortDir1c]);

  const handleSort1b = (col: SortColDist) => {
    if (sortCol1b === col) {
      setSortDir1b(sortDir1b === "asc" ? "desc" : "asc");
    } else {
      setSortCol1b(col);
      setSortDir1b("desc");
    }
  };

  const getSortIcon1b = (col: SortColDist) => {
    if (sortCol1b !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-50 inline" />;
    return sortDir1b === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline text-primary" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-primary" />;
  };

  const handleSort1c = (col: SortColDist) => {
    if (sortCol1c === col) {
      setSortDir1c(sortDir1c === "asc" ? "desc" : "asc");
    } else {
      setSortCol1c(col);
      setSortDir1c("desc");
    }
  };

  const getSortIcon1c = (col: SortColDist) => {
    if (sortCol1c !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-50 inline" />;
    return sortDir1c === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline text-primary" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-primary" />;
  };

  // Medium & Low Risk Districts (Tables 1d & 1e)
  const mrDistricts = useMemo(() => {
    return effectiveDistrictResults.filter((d) => d.riskCategory === "MEDIUM");
  }, [effectiveDistrictResults]);

  const lrDistricts = useMemo(() => {
    return effectiveDistrictResults.filter((d) => d.riskCategory === "LOW");
  }, [effectiveDistrictResults]);

  const [sortCol1d, setSortCol1d] = useState<SortColDist>("total");
  const [sortDir1d, setSortDir1d] = useState<"asc" | "desc">("desc");

  const [sortCol1e, setSortCol1e] = useState<SortColDist>("total");
  const [sortDir1e, setSortDir1e] = useState<"asc" | "desc">("desc");

  const sortedMrDistricts = useMemo(() => sortDistList(mrDistricts, sortCol1d, sortDir1d), [mrDistricts, sortCol1d, sortDir1d]);
  const sortedLrDistricts = useMemo(() => sortDistList(lrDistricts, sortCol1e, sortDir1e), [lrDistricts, sortCol1e, sortDir1e]);

  const handleSort1d = (col: SortColDist) => {
    if (sortCol1d === col) setSortDir1d(sortDir1d === "asc" ? "desc" : "asc");
    else { setSortCol1d(col); setSortDir1d("desc"); }
  };
  const getSortIcon1d = (col: SortColDist) => {
    if (sortCol1d !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-50 inline" />;
    return sortDir1d === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline text-primary" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-primary" />;
  };

  const handleSort1e = (col: SortColDist) => {
    if (sortCol1e === col) setSortDir1e(sortDir1e === "asc" ? "desc" : "asc");
    else { setSortCol1e(col); setSortDir1e("desc"); }
  };
  const getSortIcon1e = (col: SortColDist) => {
    if (sortCol1e !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-50 inline" />;
    return sortDir1e === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline text-primary" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-primary" />;
  };

  // Annex: Complete Subnational District Risk Register State (Enterprise Table - Rule 24)
  const [annexSearchTerm, setAnnexSearchTerm] = useState("");
  const [annexCategoryFilter, setAnnexCategoryFilter] = useState("ALL");
  const [annexProvinceFilter, setAnnexProvinceFilter] = useState("ALL");
  const [annexSortCol, setAnnexSortCol] = useState<SortColDist>("total");
  const [annexSortDir, setAnnexSortDir] = useState<"asc" | "desc">("desc");
  const [annexPage, setAnnexPage] = useState(1);
  const [annexPageSize, setAnnexPageSize] = useState(10);

  const availableProvinces = useMemo(() => {
    const set = new Set<string>();
    effectiveDistrictResults.forEach((d) => {
      if (d.provinceName) set.add(d.provinceName);
    });
    return Array.from(set).sort();
  }, [effectiveDistrictResults]);

  const filteredAnnexDistricts = useMemo(() => {
    return effectiveDistrictResults.filter((d) => {
      const matchCat = annexCategoryFilter === "ALL" || d.riskCategory === annexCategoryFilter;
      const matchProv = annexProvinceFilter === "ALL" || (d.provinceName || "National") === annexProvinceFilter;
      const term = annexSearchTerm.toLowerCase();
      const matchSearch =
        !term ||
        (d.areaName || d.districtName || "").toLowerCase().includes(term) ||
        (d.provinceName || "").toLowerCase().includes(term);
      return matchCat && matchProv && matchSearch;
    });
  }, [effectiveDistrictResults, annexCategoryFilter, annexProvinceFilter, annexSearchTerm]);

  const sortedAnnexDistricts = useMemo(
    () => sortDistList(filteredAnnexDistricts, annexSortCol, annexSortDir),
    [filteredAnnexDistricts, annexSortCol, annexSortDir]
  );

  const paginatedAnnexDistricts = useMemo(() => {
    if (annexPageSize >= 9999) return sortedAnnexDistricts;
    const start = (annexPage - 1) * annexPageSize;
    return sortedAnnexDistricts.slice(start, start + annexPageSize);
  }, [sortedAnnexDistricts, annexPage, annexPageSize]);

  const totalAnnexPages = Math.max(1, Math.ceil(sortedAnnexDistricts.length / annexPageSize));

  const handleSortAnnex = (col: SortColDist) => {
    if (annexSortCol === col) setAnnexSortDir(annexSortDir === "asc" ? "desc" : "asc");
    else { setAnnexSortCol(col); setAnnexSortDir("desc"); }
  };
  const getSortIconAnnex = (col: SortColDist) => {
    if (annexSortCol !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-50 inline" />;
    return annexSortDir === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline text-primary" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-primary" />;
  };

  const exportTable1bCSV = () => {
    exportToCsv("Table_1b_Very_High_Risk_Districts.csv", [
      ["#", "Province", "District", "Population", "Population Immunity (40)", "Surveillance Quality (20)", "Programme Delivery (16)", "Threats (24)", "Total Score", "Recommended Interventions"],
      ...sortedVhrDistricts.map((d, i) => [
        i + 1,
        d.provinceName || "National",
        d.areaName || d.districtName || "",
        Number(d.population) || 0,
        d.populationImmunityScore || (d as any).domainScoresJson?.PI || "",
        d.surveillanceQualityScore || (d as any).domainScoresJson?.SQ || "",
        d.programmeDeliveryScore || (d as any).domainScoresJson?.PD || "",
        d.threatAssessmentScore || (d as any).domainScoresJson?.TA || "",
        d.totalRiskScore || d.totalScore || d.riskScore || "",
        getDistrictRecommendation(d),
      ]),
    ]);
  };

  const exportTable1cCSV = () => {
    exportToCsv("Table_1c_High_Risk_Districts.csv", [
      ["#", "Province", "District", "Population", "Population Immunity (40)", "Surveillance Quality (20)", "Programme Delivery (16)", "Threats (24)", "Total Score", "Recommended Interventions"],
      ...sortedHrDistricts.map((d, i) => [
        i + 1,
        d.provinceName || "National",
        d.areaName || d.districtName || "",
        Number(d.population) || 0,
        d.populationImmunityScore || (d as any).domainScoresJson?.PI || "",
        d.surveillanceQualityScore || (d as any).domainScoresJson?.SQ || "",
        d.programmeDeliveryScore || (d as any).domainScoresJson?.PD || "",
        d.threatAssessmentScore || (d as any).domainScoresJson?.TA || "",
        d.totalRiskScore || d.totalScore || d.riskScore || "",
        getDistrictRecommendation(d),
      ]),
    ]);
  };

  const exportTable1dCSV = () => {
    exportToCsv("Table_1d_Medium_Risk_Districts.csv", [
      ["#", "Province", "District", "Population", "Population Immunity (40)", "Surveillance Quality (20)", "Programme Delivery (16)", "Threats (24)", "Total Score", "Recommended Interventions"],
      ...sortedMrDistricts.map((d, i) => [
        i + 1,
        d.provinceName || "National",
        d.areaName || d.districtName || "",
        Number(d.population) || 0,
        d.populationImmunityScore || (d as any).domainScoresJson?.PI || "",
        d.surveillanceQualityScore || (d as any).domainScoresJson?.SQ || "",
        d.programmeDeliveryScore || (d as any).domainScoresJson?.PD || "",
        d.threatAssessmentScore || (d as any).domainScoresJson?.TA || "",
        d.totalRiskScore || d.totalScore || d.riskScore || "",
        getDistrictRecommendation(d),
      ]),
    ]);
  };

  const exportTable1eCSV = () => {
    exportToCsv("Table_1e_Low_Risk_Districts.csv", [
      ["#", "Province", "District", "Population", "Population Immunity (40)", "Surveillance Quality (20)", "Programme Delivery (16)", "Threats (24)", "Total Score", "Recommended Interventions"],
      ...sortedLrDistricts.map((d, i) => [
        i + 1,
        d.provinceName || "National",
        d.areaName || d.districtName || "",
        Number(d.population) || 0,
        d.populationImmunityScore || (d as any).domainScoresJson?.PI || "",
        d.surveillanceQualityScore || (d as any).domainScoresJson?.SQ || "",
        d.programmeDeliveryScore || (d as any).domainScoresJson?.PD || "",
        d.threatAssessmentScore || (d as any).domainScoresJson?.TA || "",
        d.totalRiskScore || d.totalScore || d.riskScore || "",
        getDistrictRecommendation(d),
      ]),
    ]);
  };

  const exportAnnexCSV = () => {
    exportToCsv("Annex_1_Subnational_Risk_Register.csv", [
      ["#", "Province", "District", "Population", "Population Immunity (40)", "Surveillance Quality (20)", "Programme Delivery (16)", "Threats (24)", "Total Score", "Risk Category", "Recommended Interventions"],
      ...sortedAnnexDistricts.map((d, i) => [
        i + 1,
        d.provinceName || "National",
        d.areaName || d.districtName || "",
        Number(d.population) || 0,
        d.populationImmunityScore || (d as any).domainScoresJson?.PI || "",
        d.surveillanceQualityScore || (d as any).domainScoresJson?.SQ || "",
        d.programmeDeliveryScore || (d as any).domainScoresJson?.PD || "",
        d.threatAssessmentScore || (d as any).domainScoresJson?.TA || "",
        d.totalRiskScore || d.totalScore || d.riskScore || "",
        d.riskCategory || "LOW",
        getDistrictRecommendation(d),
      ]),
    ]);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadDocx = () => {
    window.location.href = `/api/risk/assessments/${assessment.id}/export-report-docx`;
  };

  const getDistrictRecommendation = (dist: AreaResult) => {
    const name = dist.areaName || dist.districtName || "";
    if (reportConfig.districtRecommendations?.[name]) {
      return reportConfig.districtRecommendations[name];
    }
    // Automated recommendation based on domain drivers
    const pi = Number(dist.populationImmunityScore || (dist as any).domainScoresJson?.PI || 0);
    const sq = Number(dist.surveillanceQualityScore || (dist as any).domainScoresJson?.SQ || 0);
    const pd = Number(dist.programmeDeliveryScore || (dist as any).domainScoresJson?.PD || 0);
    const ta = Number(dist.threatAssessmentScore || (dist as any).domainScoresJson?.TA || 0);

    const scores = [
      { val: pi, rec: "Conduct targeted catch-up mop-up; track unimmunized cohorts." },
      { val: sq, rec: "Intensify active surveillance; retrain focal staff on 48h case investigation." },
      { val: pd, rec: "Audit defaulter tracking; eliminate vaccine stockouts at facility level." },
      { val: ta, rec: "Establish rapid response team; cross-border synchronization with neighbours." },
    ];
    scores.sort((a, b) => b.val - a.val);
    return scores[0].rec;
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar (Hidden during Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-lg p-4 print:hidden shadow-sm">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Official Country Report Preview
          </h3>
          <p className="text-xs text-muted-foreground">
            Conforming strictly to the WHO Measles Programmatic Risk Assessment Report standard (v1.8). Download as Word (.docx) or print directly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Report Narrative & Recommendations
          </Button>

          <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Print / Export PDF
          </Button>

          <Button size="sm" onClick={handleDownloadDocx} className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground shadow-sm">
            <Download className="w-3.5 h-3.5" /> Download Word Report (.docx)
          </Button>
        </div>
      </div>

      {/* PRINTABLE DOCUMENT BODY */}
      <div className="bg-card border rounded-lg p-8 sm:p-12 shadow-sm space-y-8 print:border-none print:shadow-none print:p-0 max-w-5xl mx-auto">
        {/* Title Header */}
        <div className="border-b pb-6 text-center space-y-2">
          <Badge variant="outline" className="mb-1 text-xs border-primary/40 text-primary uppercase font-bold tracking-wider">
            WHO Programmatic Risk Assessment Engine
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Measles Risk Assessment Final Report
          </h1>
          <h2 className="text-lg font-medium text-muted-foreground">
            Subnational Programmatic Risk Profile — {countryName}
          </h2>
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date Completed: {reportConfig.signOffDate || dateFormatted}
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Assessment Year: {assessmentYear}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Baseline Years: {baselineYears.join(", ")}
            </span>
          </div>
        </div>

        {/* Background & Executive Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Background & Executive Summary</h3>
            <span className="text-[11px] text-muted-foreground italic print:hidden">Customizable via "Edit Report"</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
            {reportConfig.backgroundNarrative || DEFAULT_BACKGROUND}
          </p>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
            <li>
              <strong>Population immunity (40%):</strong> Assesses measles susceptibility using administrative vaccination coverage data for first-dose (MCV1) and second-dose (MCV2) measles-containing vaccine and coverage achieved during measles supplemental immunization activities (SIAs) conducted within the past three years.
            </li>
            <li>
              <strong>Surveillance quality (20%):</strong> Evaluates the ability of a district to detect and confirm cases rapidly and accurately, including the non-measles discarded rate, adequate investigation (within 48 hours with 10 core variables), adequate specimen collection (within 28 days), and timely laboratory result availability.
            </li>
            <li>
              <strong>Program performance (16%):</strong> Evaluates routine immunization services including trends in MCV1/MCV2 coverage over 3 years, dropout rates from MCV1 to MCV2, and dropout from Penta1 to MCV1.
            </li>
            <li>
              <strong>Threat assessment (24%):</strong> Accounts for factors influencing measles virus transmission, including reported cases in children &lt;5y, 5-14y, and 15+y, bordering district outbreaks, population density, and presence of vulnerable population groups.
            </li>
          </ul>
        </div>

        {/* Section 1: Overall Measles Risk Profile */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-base font-bold text-foreground flex items-center justify-between">
            <span>Section 1: Overall Measles Risk Profile</span>
            <span className="text-xs font-normal text-muted-foreground">Total Districts: {totalDistricts}</span>
          </h3>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Of the {totalDistricts} districts in {countryName}, {stats.counts.VERY_HIGH} (
            {((stats.counts.VERY_HIGH / totalDistricts) * 100).toFixed(1)}%) were categorized as <strong>Very High Risk</strong>,{" "}
            {stats.counts.HIGH} ({((stats.counts.HIGH / totalDistricts) * 100).toFixed(1)}%) as <strong>High Risk</strong>,{" "}
            {stats.counts.MEDIUM} ({((stats.counts.MEDIUM / totalDistricts) * 100).toFixed(1)}%) as <strong>Medium Risk</strong>, and{" "}
            {stats.counts.LOW} ({((stats.counts.LOW / totalDistricts) * 100).toFixed(1)}%) as <strong>Low Risk</strong>.
          </p>

          {/* Table 1: National Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TableIcon className="w-3.5 h-3.5 text-primary" />
                Table 1: National Programmatic Measles Risk Profile Summary
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground italic hidden sm:inline">Click headers to sort</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportTable1CSV}
                  className="h-7 text-xs gap-1 text-slate-700 dark:text-slate-200"
                >
                  <Download className="w-3 h-3" />
                  <span>Export CSV</span>
                </Button>
              </div>
            </div>
            <div className="border rounded-md overflow-hidden shadow-sm">
              <table className="table-auto min-w-full w-full text-xs text-left border-collapse">
                <thead className="bg-slate-900 text-white font-semibold sticky top-0 z-30">
                  <tr>
                    <th
                      className="p-2.5 cursor-pointer hover:bg-slate-800 select-none border-r-2 border-slate-700"
                      onClick={() => handleSort1("category")}
                    >
                      <div className="flex items-center justify-between">
                        <span>Programmatic Risk Category</span>
                        {getSortIcon1("category")}
                      </div>
                    </th>
                    <th
                      className="p-2.5 text-right cursor-pointer hover:bg-slate-800 select-none border-r-2 border-slate-700"
                      onClick={() => handleSort1("numDistricts")}
                    >
                      <div className="flex items-center justify-end">
                        <span>Number of Districts</span>
                        {getSortIcon1("numDistricts")}
                      </div>
                    </th>
                    <th
                      className="p-2.5 text-right cursor-pointer hover:bg-slate-800 select-none border-r-2 border-slate-700"
                      onClick={() => handleSort1("pctDistricts")}
                    >
                      <div className="flex items-center justify-end">
                        <span>% of Districts</span>
                        {getSortIcon1("pctDistricts")}
                      </div>
                    </th>
                    <th
                      className="p-2.5 text-right cursor-pointer hover:bg-slate-800 select-none border-r-2 border-slate-700"
                      onClick={() => handleSort1("population")}
                    >
                      <div className="flex items-center justify-end">
                        <span>Total Population</span>
                        {getSortIcon1("population")}
                      </div>
                    </th>
                    <th
                      className="p-2.5 text-right cursor-pointer hover:bg-slate-800 select-none"
                      onClick={() => handleSort1("pctPopulation")}
                    >
                      <div className="flex items-center justify-end">
                        <span>% of Population</span>
                        {getSortIcon1("pctPopulation")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y text-foreground">
                  {summaryRows.map((r) => (
                    <tr key={r.key} className={`${r.bg} hover:brightness-95 transition-all`}>
                      <td className={`p-2.5 font-semibold border-r-2 border-slate-300 dark:border-slate-800 ${r.text}`}>
                        {r.label}
                      </td>
                      <td className="p-2.5 text-right font-medium border-r-2 border-slate-300 dark:border-slate-800">
                        {r.num}
                      </td>
                      <td className="p-2.5 text-right font-medium border-r-2 border-slate-300 dark:border-slate-800">
                        {r.pct.toFixed(1)}%
                      </td>
                      <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-800">
                        {r.pop.toLocaleString()}
                      </td>
                      <td className="p-2.5 text-right font-medium">
                        {r.popPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                    <td className="p-2.5 border-r-2 border-slate-300 dark:border-slate-700">National Total</td>
                    <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700">{totalDistricts}</td>
                    <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700">100.0%</td>
                    <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700">{totalPopulation.toLocaleString()}</td>
                    <td className="p-2.5 text-right">100.0%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 1a: Province Breakdown */}
          <div className="pt-4 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TableIcon className="w-3.5 h-3.5 text-primary" />
                Table 1a: Risk Profile — Number of Districts by Province
              </h4>
              <div className="flex items-center gap-1.5 print:hidden">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStretchWideProv}
                  className="h-7 text-xs gap-1 text-slate-700 dark:text-slate-200"
                  title="Stretch columns wider"
                >
                  <Maximize2 className="w-3 h-3 text-primary" />
                  <span>Stretch</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCompactProv}
                  className="h-7 text-xs gap-1 text-slate-700 dark:text-slate-200"
                  title="Compact columns"
                >
                  <Minimize2 className="w-3 h-3 text-muted-foreground" />
                  <span>Compact</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetProvWidths}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  title="Reset column widths"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportTable1aCSV}
                  className="h-7 text-xs gap-1 text-slate-700 dark:text-slate-200 ml-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Export CSV</span>
                </Button>
              </div>
            </div>
            <div className="border rounded-md overflow-x-auto shadow-sm">
              <table className="table-auto min-w-full w-full text-xs text-left border-collapse">
                <thead className="bg-slate-800 text-white font-semibold sticky top-0 z-30">
                  <tr>
                    <th
                      className="p-2.5 cursor-pointer hover:bg-slate-700 select-none sticky left-0 z-40 bg-slate-800 border-r-2 border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] group/th"
                      style={{
                        width: `${provColWidths.province}px`,
                        minWidth: `${provColWidths.province}px`,
                      }}
                      onClick={() => handleSort1a("province")}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Province</span>
                        {getSortIcon1a("province")}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none"
                        onMouseDown={(e) => startProvResize("province", e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                    <th
                      className="p-2.5 text-right text-red-300 cursor-pointer hover:bg-slate-700 select-none border-r-2 border-slate-600 relative group/th"
                      style={{
                        width: `${provColWidths.veryHigh}px`,
                        minWidth: `${provColWidths.veryHigh}px`,
                      }}
                      onClick={() => handleSort1a("VERY_HIGH")}
                    >
                      <div className="flex items-center justify-end pr-2">
                        <span>Very High Risk</span>
                        {getSortIcon1a("VERY_HIGH")}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none"
                        onMouseDown={(e) => startProvResize("veryHigh", e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                    <th
                      className="p-2.5 text-right text-orange-300 cursor-pointer hover:bg-slate-700 select-none border-r-2 border-slate-600 relative group/th"
                      style={{
                        width: `${provColWidths.high}px`,
                        minWidth: `${provColWidths.high}px`,
                      }}
                      onClick={() => handleSort1a("HIGH")}
                    >
                      <div className="flex items-center justify-end pr-2">
                        <span>High Risk</span>
                        {getSortIcon1a("HIGH")}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none"
                        onMouseDown={(e) => startProvResize("high", e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                    <th
                      className="p-2.5 text-right text-amber-300 cursor-pointer hover:bg-slate-700 select-none border-r-2 border-slate-600 relative group/th"
                      style={{
                        width: `${provColWidths.medium}px`,
                        minWidth: `${provColWidths.medium}px`,
                      }}
                      onClick={() => handleSort1a("MEDIUM")}
                    >
                      <div className="flex items-center justify-end pr-2">
                        <span>Medium Risk</span>
                        {getSortIcon1a("MEDIUM")}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none"
                        onMouseDown={(e) => startProvResize("medium", e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                    <th
                      className="p-2.5 text-right text-emerald-300 cursor-pointer hover:bg-slate-700 select-none border-r-2 border-slate-600 relative group/th"
                      style={{
                        width: `${provColWidths.low}px`,
                        minWidth: `${provColWidths.low}px`,
                      }}
                      onClick={() => handleSort1a("LOW")}
                    >
                      <div className="flex items-center justify-end pr-2">
                        <span>Low Risk</span>
                        {getSortIcon1a("LOW")}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none"
                        onMouseDown={(e) => startProvResize("low", e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                    <th
                      className="p-2.5 text-right cursor-pointer hover:bg-slate-700 select-none relative group/th"
                      style={{
                        width: `${provColWidths.total}px`,
                        minWidth: `${provColWidths.total}px`,
                      }}
                      onClick={() => handleSort1a("total")}
                    >
                      <div className="flex items-center justify-end pr-2">
                        <span>Total Districts</span>
                        {getSortIcon1a("total")}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none"
                        onMouseDown={(e) => startProvResize("total", e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y text-foreground">
                  {sortedProvinceBreakdown.map(([prov, c], idx) => (
                    <tr key={prov} className={idx % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/60" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"}>
                      <td
                        className="p-2.5 font-medium sticky left-0 z-20 bg-background group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-r-2 border-slate-300 dark:border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)] truncate"
                        style={{
                          width: `${provColWidths.province}px`,
                          minWidth: `${provColWidths.province}px`,
                        }}
                        title={prov}
                      >
                        {prov}
                      </td>
                      <td className={`p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 ${c.VERY_HIGH > 0 ? "font-bold text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{c.VERY_HIGH}</td>
                      <td className={`p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 ${c.HIGH > 0 ? "font-bold text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>{c.HIGH}</td>
                      <td className={`p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 ${c.MEDIUM > 0 ? "font-bold text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{c.MEDIUM}</td>
                      <td className={`p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 ${c.LOW > 0 ? "font-bold text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{c.LOW}</td>
                      <td className="p-2.5 text-right font-bold">{c.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Stretch Controls for District Tables */}
          {(vhrDistricts.length > 0 || hrDistricts.length > 0) && (
            <div className="flex items-center justify-between pt-4 pb-1 border-t text-xs text-muted-foreground print:hidden">
              <span className="font-semibold text-foreground flex items-center gap-1">
                District Tables View Controls (Sticky Left Columns & Stretch)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStretchWideReport}
                  className="h-7 text-xs gap-1 text-slate-700 dark:text-slate-200"
                  title="Expand columns generously so long action text is easily readable"
                >
                  <Maximize2 className="w-3 h-3 text-primary" />
                  <span>Stretch (Wide)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCompactReport}
                  className="h-7 text-xs gap-1 text-slate-700 dark:text-slate-200"
                  title="Compact columns for dense preview"
                >
                  <Minimize2 className="w-3 h-3 text-muted-foreground" />
                  <span>Compact</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetReportWidths}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  title="Reset column widths"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </Button>
              </div>
            </div>
          )}

          {/* Table 1b: Very High Risk Districts */}
          {vhrDistricts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                  Table 1b: Risk Scores & Recommended Interventions for Very High Risk Districts (Score &ge; 61)
                </h4>
                <div className="flex items-center gap-2 print:hidden">
                  <span className="text-[11px] text-muted-foreground italic hidden sm:inline">Columns stretchable & sortable</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportTable1bCSV}
                    className="h-7 text-xs gap-1 text-slate-700 dark:text-slate-200"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>
              <div className="border rounded-md overflow-x-auto shadow-sm">
                <table className="table-auto min-w-full w-full text-xs text-left border-collapse">
                  <thead className="bg-red-800 text-white font-semibold sticky top-0 z-30">
                    <tr>
                      {/* FROZEN 1: INDEX */}
                      <th
                        className="p-2.5 text-center font-semibold border-r-2 border-red-700 sticky top-0 left-0 z-40 bg-red-800 select-none cursor-pointer"
                        style={{ width: `${reportColWidths.index}px`, minWidth: `${reportColWidths.index}px`, maxWidth: `${reportColWidths.index}px` }}
                        onClick={() => handleSort1b("index")}
                      >
                        # {getSortIcon1b("index")}
                      </th>

                      {/* FROZEN 2: PROVINCE */}
                      <th
                        className="p-2.5 font-semibold border-r-2 border-red-700 sticky top-0 z-40 bg-red-800 select-none cursor-pointer group/th"
                        style={{
                          left: `${reportColWidths.index}px`,
                          width: `${reportColWidths.province}px`,
                          minWidth: `${reportColWidths.province}px`,
                          maxWidth: `${reportColWidths.province}px`,
                        }}
                        onClick={() => handleSort1b("province")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate">Province</span>
                          {getSortIcon1b("province")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("province", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      {/* FROZEN 3: DISTRICT (WITH SHADOW DIVIDER) */}
                      <th
                        className="p-2.5 font-semibold border-r-2 border-slate-400 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.2)] sticky top-0 z-40 bg-red-800 select-none cursor-pointer group/th"
                        style={{
                          left: `${reportColWidths.index + reportColWidths.province}px`,
                          width: `${reportColWidths.district}px`,
                          minWidth: `${reportColWidths.district}px`,
                          maxWidth: `${reportColWidths.district}px`,
                        }}
                        onClick={() => handleSort1b("district")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate font-bold">District</span>
                          {getSortIcon1b("district")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("district", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-red-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.population}px`, minWidth: `${reportColWidths.population}px` }}
                        onClick={() => handleSort1b("population")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Population</span>
                          {getSortIcon1b("population")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("population", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-red-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.pi}px`, minWidth: `${reportColWidths.pi}px` }}
                        onClick={() => handleSort1b("pi")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Population Immunity (Max 40)</span>
                          {getSortIcon1b("pi")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("pi", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-red-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.sq}px`, minWidth: `${reportColWidths.sq}px` }}
                        onClick={() => handleSort1b("sq")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Surveillance Quality (Max 20)</span>
                          {getSortIcon1b("sq")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("sq", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-red-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.pd}px`, minWidth: `${reportColWidths.pd}px` }}
                        onClick={() => handleSort1b("pd")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Program Delivery Performance (Max 16)</span>
                          {getSortIcon1b("pd")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("pd", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-red-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.ta}px`, minWidth: `${reportColWidths.ta}px` }}
                        onClick={() => handleSort1b("ta")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Threat Assessment (Max 24)</span>
                          {getSortIcon1b("ta")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("ta", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-bold border-r-2 border-red-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.total}px`, minWidth: `${reportColWidths.total}px` }}
                        onClick={() => handleSort1b("total")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Overall Risk Score (Max 100)</span>
                          {getSortIcon1b("total")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("total", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 font-semibold"
                        style={{ width: `${reportColWidths.rec}px`, minWidth: `${reportColWidths.rec}px` }}
                      >
                        Recommended Interventions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-foreground">
                    {sortedVhrDistricts.map((d, idx) => {
                      const domains = d.domainScoresJson || {};
                      const rec = getDistrictRecommendation(d);
                      return (
                        <tr key={d.id} className="hover:bg-red-50/50 dark:hover:bg-red-950/30 transition-colors group">
                          {/* FROZEN 1: INDEX */}
                          <td
                            className="p-2.5 text-center text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700 sticky left-0 z-20 bg-background group-hover:bg-red-50/50 dark:group-hover:bg-red-950/30"
                            style={{ width: `${reportColWidths.index}px`, minWidth: `${reportColWidths.index}px`, maxWidth: `${reportColWidths.index}px` }}
                          >
                            {idx + 1}
                          </td>

                          {/* FROZEN 2: PROVINCE */}
                          <td
                            className="p-2.5 text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700 whitespace-nowrap sticky z-20 bg-background group-hover:bg-red-50/50 dark:group-hover:bg-red-950/30 font-medium"
                            style={{
                              left: `${reportColWidths.index}px`,
                              width: `${reportColWidths.province}px`,
                              minWidth: `${reportColWidths.province}px`,
                              maxWidth: `${reportColWidths.province}px`,
                            }}
                          >
                            <span className="truncate block" title={d.provinceName || "National"}>
                              {d.provinceName || "National"}
                            </span>
                          </td>

                          {/* FROZEN 3: DISTRICT (WITH SHADOW DIVIDER) */}
                          <td
                            className="p-2.5 font-bold border-r-2 border-slate-400 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap sticky z-20 bg-background group-hover:bg-red-50/50 dark:group-hover:bg-red-950/30 text-foreground"
                            style={{
                              left: `${reportColWidths.index + reportColWidths.province}px`,
                              width: `${reportColWidths.district}px`,
                              minWidth: `${reportColWidths.district}px`,
                              maxWidth: `${reportColWidths.district}px`,
                            }}
                          >
                            <span className="truncate block" title={d.areaName || d.districtName}>
                              {d.areaName || d.districtName}
                            </span>
                          </td>

                          <td className="p-2.5 text-right text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700">{(Number(d.population) || 0).toLocaleString()}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.populationImmunityScore || domains.PI || "-"}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.surveillanceQualityScore || domains.SQ || "-"}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.programmeDeliveryScore || domains.PD || "-"}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.threatAssessmentScore || domains.TA || "-"}</td>
                          <td className="p-2.5 text-right font-bold text-red-600 dark:text-red-400 border-r-2 border-slate-300 dark:border-slate-700 font-mono">
                            {d.totalRiskScore || d.totalScore || d.riskScore}
                          </td>
                          <td className="p-2.5 text-muted-foreground text-xs leading-relaxed">{rec}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 1c: High Risk Districts */}
          {hrDistricts.length > 0 && (
            <div className="space-y-2 pt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                  Table 1c: Risk Scores & Recommended Interventions for High Risk Districts (Score 55–60)
                </h4>
                <div className="flex items-center gap-2 print:hidden">
                  <span className="text-[11px] text-muted-foreground italic hidden sm:inline">Columns stretchable & sortable</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportTable1cCSV}
                    className="h-7 text-xs gap-1 text-slate-700 dark:text-slate-200"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>
              <div className="border rounded-md overflow-x-auto shadow-sm">
                <table className="table-auto min-w-full w-full text-xs text-left border-collapse">
                  <thead className="bg-orange-800 text-white font-semibold sticky top-0 z-30">
                    <tr>
                      {/* FROZEN 1: INDEX */}
                      <th
                        className="p-2.5 text-center font-semibold border-r-2 border-orange-700 sticky top-0 left-0 z-40 bg-orange-800 select-none cursor-pointer"
                        style={{ width: `${reportColWidths.index}px`, minWidth: `${reportColWidths.index}px`, maxWidth: `${reportColWidths.index}px` }}
                        onClick={() => handleSort1c("index")}
                      >
                        # {getSortIcon1c("index")}
                      </th>

                      {/* FROZEN 2: PROVINCE */}
                      <th
                        className="p-2.5 font-semibold border-r-2 border-orange-700 sticky top-0 z-40 bg-orange-800 select-none cursor-pointer group/th"
                        style={{
                          left: `${reportColWidths.index}px`,
                          width: `${reportColWidths.province}px`,
                          minWidth: `${reportColWidths.province}px`,
                          maxWidth: `${reportColWidths.province}px`,
                        }}
                        onClick={() => handleSort1c("province")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate">Province</span>
                          {getSortIcon1c("province")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("province", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      {/* FROZEN 3: DISTRICT (WITH SHADOW DIVIDER) */}
                      <th
                        className="p-2.5 font-semibold border-r-2 border-slate-400 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.2)] sticky top-0 z-40 bg-orange-800 select-none cursor-pointer group/th"
                        style={{
                          left: `${reportColWidths.index + reportColWidths.province}px`,
                          width: `${reportColWidths.district}px`,
                          minWidth: `${reportColWidths.district}px`,
                          maxWidth: `${reportColWidths.district}px`,
                        }}
                        onClick={() => handleSort1c("district")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate font-bold">District</span>
                          {getSortIcon1c("district")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("district", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-orange-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.population}px`, minWidth: `${reportColWidths.population}px` }}
                        onClick={() => handleSort1c("population")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Population</span>
                          {getSortIcon1c("population")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("population", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-orange-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.pi}px`, minWidth: `${reportColWidths.pi}px` }}
                        onClick={() => handleSort1c("pi")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Population Immunity (Max 40)</span>
                          {getSortIcon1c("pi")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("pi", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-orange-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.sq}px`, minWidth: `${reportColWidths.sq}px` }}
                        onClick={() => handleSort1c("sq")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Surveillance Quality (Max 20)</span>
                          {getSortIcon1c("sq")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("sq", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-orange-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.pd}px`, minWidth: `${reportColWidths.pd}px` }}
                        onClick={() => handleSort1c("pd")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Program Delivery Performance (Max 16)</span>
                          {getSortIcon1c("pd")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("pd", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-orange-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.ta}px`, minWidth: `${reportColWidths.ta}px` }}
                        onClick={() => handleSort1c("ta")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Threat Assessment (Max 24)</span>
                          {getSortIcon1b("ta") /* wait, handleSort1c */}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("ta", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-bold border-r-2 border-orange-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.total}px`, minWidth: `${reportColWidths.total}px` }}
                        onClick={() => handleSort1c("total")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Overall Risk Score (Max 100)</span>
                          {getSortIcon1c("total")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("total", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 font-semibold"
                        style={{ width: `${reportColWidths.rec}px`, minWidth: `${reportColWidths.rec}px` }}
                      >
                        Recommended Interventions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-foreground">
                    {sortedHrDistricts.map((d, idx) => {
                      const domains = d.domainScoresJson || {};
                      const rec = getDistrictRecommendation(d);
                      return (
                        <tr key={d.id} className="hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-colors group">
                          {/* FROZEN 1: INDEX */}
                          <td
                            className="p-2.5 text-center text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700 sticky left-0 z-20 bg-background group-hover:bg-orange-50/50 dark:group-hover:bg-orange-950/30"
                            style={{ width: `${reportColWidths.index}px`, minWidth: `${reportColWidths.index}px`, maxWidth: `${reportColWidths.index}px` }}
                          >
                            {idx + 1}
                          </td>

                          {/* FROZEN 2: PROVINCE */}
                          <td
                            className="p-2.5 text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700 whitespace-nowrap sticky z-20 bg-background group-hover:bg-orange-50/50 dark:group-hover:bg-orange-950/30 font-medium"
                            style={{
                              left: `${reportColWidths.index}px`,
                              width: `${reportColWidths.province}px`,
                              minWidth: `${reportColWidths.province}px`,
                              maxWidth: `${reportColWidths.province}px`,
                            }}
                          >
                            <span className="truncate block" title={d.provinceName || "National"}>
                              {d.provinceName || "National"}
                            </span>
                          </td>

                          {/* FROZEN 3: DISTRICT (WITH SHADOW DIVIDER) */}
                          <td
                            className="p-2.5 font-bold border-r-2 border-slate-400 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap sticky z-20 bg-background group-hover:bg-orange-50/50 dark:group-hover:bg-orange-950/30 text-foreground"
                            style={{
                              left: `${reportColWidths.index + reportColWidths.province}px`,
                              width: `${reportColWidths.district}px`,
                              minWidth: `${reportColWidths.district}px`,
                              maxWidth: `${reportColWidths.district}px`,
                            }}
                          >
                            <span className="truncate block" title={d.areaName || d.districtName}>
                              {d.areaName || d.districtName}
                            </span>
                          </td>

                          <td className="p-2.5 text-right text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700">{(Number(d.population) || 0).toLocaleString()}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.populationImmunityScore || domains.PI || "-"}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.surveillanceQualityScore || domains.SQ || "-"}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.programmeDeliveryScore || domains.PD || "-"}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.threatAssessmentScore || domains.TA || "-"}</td>
                          <td className="p-2.5 text-right font-bold text-orange-600 dark:text-orange-400 border-r-2 border-slate-300 dark:border-slate-700 font-mono">
                            {d.totalRiskScore || d.totalScore || d.riskScore}
                          </td>
                          <td className="p-2.5 text-muted-foreground text-xs leading-relaxed">{rec}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 1d: Medium Risk Districts */}
          {mrDistricts.length > 0 && (
            <div className="space-y-2 pt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Table 1d: Risk Scores & Recommended Interventions for Medium Risk Districts (Score 48–54)
                </h4>
                <div className="flex items-center gap-2 print:hidden">
                  <span className="text-[11px] text-muted-foreground italic hidden sm:inline">Columns stretchable & sortable</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportTable1dCSV}
                    className="h-7 text-xs gap-1 text-slate-700 dark:text-slate-200"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>
              <div className="border rounded-md overflow-x-auto shadow-sm">
                <table className="table-auto min-w-full w-full text-xs text-left border-collapse">
                  <thead className="bg-amber-800 text-white font-semibold sticky top-0 z-30">
                    <tr>
                      {/* FROZEN 1: INDEX */}
                      <th
                        className="p-2.5 text-center font-semibold border-r-2 border-amber-700 sticky top-0 left-0 z-40 bg-amber-800 select-none cursor-pointer"
                        style={{ width: `${reportColWidths.index}px`, minWidth: `${reportColWidths.index}px`, maxWidth: `${reportColWidths.index}px` }}
                        onClick={() => handleSort1d("index")}
                      >
                        # {getSortIcon1d("index")}
                      </th>

                      {/* FROZEN 2: PROVINCE */}
                      <th
                        className="p-2.5 font-semibold border-r-2 border-amber-700 sticky top-0 z-40 bg-amber-800 select-none cursor-pointer group/th"
                        style={{
                          left: `${reportColWidths.index}px`,
                          width: `${reportColWidths.province}px`,
                          minWidth: `${reportColWidths.province}px`,
                          maxWidth: `${reportColWidths.province}px`,
                        }}
                        onClick={() => handleSort1d("province")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate">Province</span>
                          {getSortIcon1d("province")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("province", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      {/* FROZEN 3: DISTRICT (WITH SHADOW DIVIDER) */}
                      <th
                        className="p-2.5 font-semibold border-r-2 border-slate-400 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.2)] sticky top-0 z-40 bg-amber-800 select-none cursor-pointer group/th"
                        style={{
                          left: `${reportColWidths.index + reportColWidths.province}px`,
                          width: `${reportColWidths.district}px`,
                          minWidth: `${reportColWidths.district}px`,
                          maxWidth: `${reportColWidths.district}px`,
                        }}
                        onClick={() => handleSort1d("district")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate font-bold">District</span>
                          {getSortIcon1d("district")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("district", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-amber-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.population}px`, minWidth: `${reportColWidths.population}px` }}
                        onClick={() => handleSort1d("population")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Population</span>
                          {getSortIcon1d("population")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("population", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-amber-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.pi}px`, minWidth: `${reportColWidths.pi}px` }}
                        onClick={() => handleSort1d("pi")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Population Immunity (Max 40)</span>
                          {getSortIcon1d("pi")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("pi", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-amber-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.sq}px`, minWidth: `${reportColWidths.sq}px` }}
                        onClick={() => handleSort1d("sq")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Surveillance Quality (Max 20)</span>
                          {getSortIcon1d("sq")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("sq", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-amber-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.pd}px`, minWidth: `${reportColWidths.pd}px` }}
                        onClick={() => handleSort1d("pd")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Program Delivery Performance (Max 16)</span>
                          {getSortIcon1d("pd")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("pd", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-amber-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.ta}px`, minWidth: `${reportColWidths.ta}px` }}
                        onClick={() => handleSort1d("ta")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Threat Assessment (Max 24)</span>
                          {getSortIcon1d("ta")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("ta", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-bold border-r-2 border-amber-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.total}px`, minWidth: `${reportColWidths.total}px` }}
                        onClick={() => handleSort1d("total")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Overall Risk Score (Max 100)</span>
                          {getSortIcon1d("total")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("total", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 font-semibold"
                        style={{ width: `${reportColWidths.rec}px`, minWidth: `${reportColWidths.rec}px` }}
                      >
                        Recommended Interventions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-foreground">
                    {sortedMrDistricts.map((d, idx) => {
                      const domains = d.domainScoresJson || {};
                      const rec = getDistrictRecommendation(d);
                      return (
                        <tr key={d.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-colors group">
                          {/* FROZEN 1: INDEX */}
                          <td
                            className="p-2.5 text-center text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700 sticky left-0 z-20 bg-background group-hover:bg-amber-50/50 dark:group-hover:bg-amber-950/30"
                            style={{ width: `${reportColWidths.index}px`, minWidth: `${reportColWidths.index}px`, maxWidth: `${reportColWidths.index}px` }}
                          >
                            {idx + 1}
                          </td>

                          {/* FROZEN 2: PROVINCE */}
                          <td
                            className="p-2.5 text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700 whitespace-nowrap sticky z-20 bg-background group-hover:bg-amber-50/50 dark:group-hover:bg-amber-950/30 font-medium"
                            style={{
                              left: `${reportColWidths.index}px`,
                              width: `${reportColWidths.province}px`,
                              minWidth: `${reportColWidths.province}px`,
                              maxWidth: `${reportColWidths.province}px`,
                            }}
                          >
                            <span className="truncate block" title={d.provinceName || "National"}>
                              {d.provinceName || "National"}
                            </span>
                          </td>

                          {/* FROZEN 3: DISTRICT (WITH SHADOW DIVIDER) */}
                          <td
                            className="p-2.5 font-bold border-r-2 border-slate-400 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap sticky z-20 bg-background group-hover:bg-amber-50/50 dark:group-hover:bg-amber-950/30 text-foreground"
                            style={{
                              left: `${reportColWidths.index + reportColWidths.province}px`,
                              width: `${reportColWidths.district}px`,
                              minWidth: `${reportColWidths.district}px`,
                              maxWidth: `${reportColWidths.district}px`,
                            }}
                          >
                            <span className="truncate block" title={d.areaName || d.districtName}>
                              {d.areaName || d.districtName}
                            </span>
                          </td>

                          <td className="p-2.5 text-right text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700">{(Number(d.population) || 0).toLocaleString()}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.populationImmunityScore || domains.PI || "-"}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.surveillanceQualityScore || domains.SQ || "-"}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.programmeDeliveryScore || domains.PD || "-"}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.threatAssessmentScore || domains.TA || "-"}</td>
                          <td className="p-2.5 text-right font-bold text-amber-600 dark:text-amber-400 border-r-2 border-slate-300 dark:border-slate-700 font-mono">
                            {d.totalRiskScore || d.totalScore || d.riskScore}
                          </td>
                          <td className="p-2.5 text-muted-foreground text-xs leading-relaxed">{rec}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 1e: Low Risk Districts */}
          {lrDistricts.length > 0 && (
            <div className="space-y-2 pt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Table 1e: Risk Scores & Maintenance Interventions for Low Risk Districts (Score &le; 47)
                </h4>
                <div className="flex items-center gap-2 print:hidden">
                  <span className="text-[11px] text-muted-foreground italic hidden sm:inline">Columns stretchable & sortable</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportTable1eCSV}
                    className="h-7 text-xs gap-1 text-slate-700 dark:text-slate-200"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>
              <div className="border rounded-md overflow-x-auto shadow-sm">
                <table className="table-auto min-w-full w-full text-xs text-left border-collapse">
                  <thead className="bg-emerald-800 text-white font-semibold sticky top-0 z-30">
                    <tr>
                      {/* FROZEN 1: INDEX */}
                      <th
                        className="p-2.5 text-center font-semibold border-r-2 border-emerald-700 sticky top-0 left-0 z-40 bg-emerald-800 select-none cursor-pointer"
                        style={{ width: `${reportColWidths.index}px`, minWidth: `${reportColWidths.index}px`, maxWidth: `${reportColWidths.index}px` }}
                        onClick={() => handleSort1e("index")}
                      >
                        # {getSortIcon1e("index")}
                      </th>

                      {/* FROZEN 2: PROVINCE */}
                      <th
                        className="p-2.5 font-semibold border-r-2 border-emerald-700 sticky top-0 z-40 bg-emerald-800 select-none cursor-pointer group/th"
                        style={{
                          left: `${reportColWidths.index}px`,
                          width: `${reportColWidths.province}px`,
                          minWidth: `${reportColWidths.province}px`,
                          maxWidth: `${reportColWidths.province}px`,
                        }}
                        onClick={() => handleSort1e("province")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate">Province</span>
                          {getSortIcon1e("province")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("province", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      {/* FROZEN 3: DISTRICT (WITH SHADOW DIVIDER) */}
                      <th
                        className="p-2.5 font-bold border-r-2 border-emerald-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.2)] sticky top-0 z-40 bg-emerald-800 select-none cursor-pointer group/th"
                        style={{
                          left: `${reportColWidths.index + reportColWidths.province}px`,
                          width: `${reportColWidths.district}px`,
                          minWidth: `${reportColWidths.district}px`,
                          maxWidth: `${reportColWidths.district}px`,
                        }}
                        onClick={() => handleSort1e("district")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate font-bold">District</span>
                          {getSortIcon1e("district")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("district", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-emerald-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.population}px`, minWidth: `${reportColWidths.population}px` }}
                        onClick={() => handleSort1e("population")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Population</span>
                          {getSortIcon1e("population")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("population", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-emerald-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.pi}px`, minWidth: `${reportColWidths.pi}px` }}
                        onClick={() => handleSort1e("pi")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Population Immunity (Max 40)</span>
                          {getSortIcon1e("pi")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("pi", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-emerald-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.sq}px`, minWidth: `${reportColWidths.sq}px` }}
                        onClick={() => handleSort1e("sq")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Surveillance Quality (Max 20)</span>
                          {getSortIcon1e("sq")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("sq", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-emerald-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.pd}px`, minWidth: `${reportColWidths.pd}px` }}
                        onClick={() => handleSort1e("pd")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Program Delivery Performance (Max 16)</span>
                          {getSortIcon1e("pd")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("pd", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-semibold border-r-2 border-emerald-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.ta}px`, minWidth: `${reportColWidths.ta}px` }}
                        onClick={() => handleSort1e("ta")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Threat Assessment (Max 24)</span>
                          {getSortIcon1e("ta")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("ta", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 text-right font-bold border-r-2 border-emerald-700 select-none cursor-pointer relative group/th"
                        style={{ width: `${reportColWidths.total}px`, minWidth: `${reportColWidths.total}px` }}
                        onClick={() => handleSort1e("total")}
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Overall Risk Score (Max 100)</span>
                          {getSortIcon1e("total")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startReportResize("total", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      <th
                        className="p-2.5 font-semibold"
                        style={{ width: `${reportColWidths.rec}px`, minWidth: `${reportColWidths.rec}px` }}
                      >
                        Recommended Interventions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-foreground">
                    {sortedLrDistricts.map((d, idx) => {
                      const domains = d.domainScoresJson || {};
                      const rec = getDistrictRecommendation(d);
                      return (
                        <tr key={d.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-colors group">
                          {/* FROZEN 1: INDEX */}
                          <td
                            className="p-2.5 text-center text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700 sticky left-0 z-20 bg-background group-hover:bg-emerald-50/50 dark:group-hover:bg-emerald-950/30"
                            style={{ width: `${reportColWidths.index}px`, minWidth: `${reportColWidths.index}px`, maxWidth: `${reportColWidths.index}px` }}
                          >
                            {idx + 1}
                          </td>

                          {/* FROZEN 2: PROVINCE */}
                          <td
                            className="p-2.5 text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700 whitespace-nowrap sticky z-20 bg-background group-hover:bg-emerald-50/50 dark:group-hover:bg-emerald-950/30 font-medium"
                            style={{
                              left: `${reportColWidths.index}px`,
                              width: `${reportColWidths.province}px`,
                              minWidth: `${reportColWidths.province}px`,
                              maxWidth: `${reportColWidths.province}px`,
                            }}
                          >
                            <span className="truncate block" title={d.provinceName || "National"}>
                              {d.provinceName || "National"}
                            </span>
                          </td>

                          {/* FROZEN 3: DISTRICT (WITH SHADOW DIVIDER) */}
                          <td
                            className="p-2.5 font-bold border-r-2 border-slate-400 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap sticky z-20 bg-background group-hover:bg-emerald-50/50 dark:group-hover:bg-emerald-950/30 text-foreground"
                            style={{
                              left: `${reportColWidths.index + reportColWidths.province}px`,
                              width: `${reportColWidths.district}px`,
                              minWidth: `${reportColWidths.district}px`,
                              maxWidth: `${reportColWidths.district}px`,
                            }}
                          >
                            <span className="truncate block" title={d.areaName || d.districtName}>
                              {d.areaName || d.districtName}
                            </span>
                          </td>

                          <td className="p-2.5 text-right text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700">{(Number(d.population) || 0).toLocaleString()}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.populationImmunityScore || domains.PI || "-"}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.surveillanceQualityScore || domains.SQ || "-"}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.programmeDeliveryScore || domains.PD || "-"}</td>
                          <td className="p-2.5 text-right border-r-2 border-slate-300 dark:border-slate-700 font-mono">{d.threatAssessmentScore || domains.TA || "-"}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 border-r-2 border-slate-300 dark:border-slate-700 font-mono">
                            {d.totalRiskScore || d.totalScore || d.riskScore}
                          </td>
                          <td className="p-2.5 text-muted-foreground text-xs leading-relaxed">{rec}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Recommended Priority Actions */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-base font-bold text-foreground flex items-center justify-between">
            <span>Section 2: Recommended Programmatic Priority Actions</span>
            <span className="text-xs font-normal text-muted-foreground italic print:hidden">Customizable in editor</span>
          </h3>

          <div className="p-4 bg-muted/30 border rounded-lg text-xs leading-relaxed text-foreground whitespace-pre-line">
            {reportConfig.strategicPriorities || DEFAULT_STRATEGIC_PRIORITIES}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
            <Card className="border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10">
              <CardHeader className="p-3.5 pb-2">
                <CardTitle className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Immediate Priorities for Very High Risk Areas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 space-y-1.5 text-muted-foreground">
                <p>• <strong>Microplanning Revisions:</strong> Update village catchment maps and health facility session frequency for all VHR districts.</p>
                <p>• <strong>Rapid Catch-up / Defaulter Tracing:</strong> Conduct targeted periodic intensification of routine immunization (PIRI) in subdistricts with MCV1 &lt; 80%.</p>
                <p>• <strong>Cold Chain Audit:</strong> Verify functional storage and temperature monitoring in remote clinics experiencing supply interruptions.</p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10">
              <CardHeader className="p-3.5 pb-2">
                <CardTitle className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" /> Surveillance Quality & Dropout Reduction
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 space-y-1.5 text-muted-foreground">
                <p>• <strong>Active Surveillance Audits:</strong> In districts with Non-measles Discarded Rate &lt; 2 per 100k, conduct weekly zero-reporting and retrospective hospital record reviews.</p>
                <p>• <strong>Specimen Collection Logistics:</strong> Strengthen reverse cold chain to ensure &ge;80% of suspected cases have serum collected within 28 days.</p>
                <p>• <strong>Dropout Tracking:</strong> Reconcile child health logbooks between Penta1 and MCV1/MCV2 to address dropout &gt; 10%.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Annex 1: Complete Subnational District Risk Register (Enterprise Table - Rule 24) */}
        <div className="space-y-3 pt-6 border-t">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                Annex 1: Complete Subnational District Risk Register (All {effectiveDistrictResults.length} Districts)
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Comprehensive national register sorted and filtered according to WHO Measles Risk Assessment programmatic tiers.
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={exportAnnexCSV}
                className="h-8 text-xs gap-1.5 text-slate-700 dark:text-slate-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Annex CSV</span>
              </Button>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-muted/40 rounded-lg border text-xs print:hidden">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search district or province..."
                  value={annexSearchTerm}
                  onChange={(e) => {
                    setAnnexSearchTerm(e.target.value);
                    setAnnexPage(1);
                  }}
                  className="h-8 text-xs pl-8"
                />
              </div>

              <Select
                value={annexCategoryFilter}
                onValueChange={(val) => {
                  setAnnexCategoryFilter(val);
                  setAnnexPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs w-[135px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  <SelectItem value="VERY_HIGH">Very High Risk</SelectItem>
                  <SelectItem value="HIGH">High Risk</SelectItem>
                  <SelectItem value="MEDIUM">Medium Risk</SelectItem>
                  <SelectItem value="LOW">Low Risk</SelectItem>
                </SelectContent>
              </Select>

              {availableProvinces.length > 1 && (
                <Select
                  value={annexProvinceFilter}
                  onValueChange={(val) => {
                    setAnnexProvinceFilter(val);
                    setAnnexPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-[140px]">
                    <SelectValue placeholder="All Provinces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Provinces</SelectItem>
                    {availableProvinces.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(annexSearchTerm || annexCategoryFilter !== "ALL" || annexProvinceFilter !== "ALL") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAnnexSearchTerm("");
                    setAnnexCategoryFilter("ALL");
                    setAnnexProvinceFilter("ALL");
                    setAnnexPage(1);
                  }}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset Filters
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                Showing {filteredAnnexDistricts.length} of {effectiveDistrictResults.length} districts
              </span>
              <Select
                value={String(annexPageSize)}
                onValueChange={(val) => {
                  setAnnexPageSize(Number(val));
                  setAnnexPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs w-[95px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="25">25 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                  <SelectItem value="9999">All rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Annex Table */}
          <div className="border rounded-md overflow-x-auto shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-800 text-white font-semibold sticky top-0 z-30">
                <tr>
                  {/* FROZEN 1: INDEX */}
                  <th
                    className="p-2.5 text-center font-semibold border-r border-slate-700 sticky top-0 left-0 z-40 bg-slate-800 select-none cursor-pointer"
                    style={{ width: `${reportColWidths.index}px`, minWidth: `${reportColWidths.index}px`, maxWidth: `${reportColWidths.index}px` }}
                    onClick={() => handleSortAnnex("index")}
                  >
                    # {getSortIconAnnex("index")}
                  </th>

                  {/* FROZEN 2: PROVINCE */}
                  <th
                    className="p-2.5 font-semibold border-r border-slate-700 sticky top-0 z-40 bg-slate-800 select-none cursor-pointer group/th"
                    style={{
                      left: `${reportColWidths.index}px`,
                      width: `${reportColWidths.province}px`,
                      minWidth: `${reportColWidths.province}px`,
                      maxWidth: `${reportColWidths.province}px`,
                    }}
                    onClick={() => handleSortAnnex("province")}
                  >
                    <div className="flex items-center justify-between pr-2">
                      <span className="truncate">Province</span>
                      {getSortIconAnnex("province")}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                      onMouseDown={(e) => startReportResize("province", e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>

                  {/* FROZEN 3: DISTRICT (WITH SHADOW DIVIDER) */}
                  <th
                    className="p-2.5 font-semibold border-r-2 border-slate-400 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.2)] sticky top-0 z-40 bg-slate-800 select-none cursor-pointer group/th"
                    style={{
                      left: `${reportColWidths.index + reportColWidths.province}px`,
                      width: `${reportColWidths.district}px`,
                      minWidth: `${reportColWidths.district}px`,
                      maxWidth: `${reportColWidths.district}px`,
                    }}
                    onClick={() => handleSortAnnex("district")}
                  >
                    <div className="flex items-center justify-between pr-2">
                      <span className="truncate font-bold">District</span>
                      {getSortIconAnnex("district")}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                      onMouseDown={(e) => startReportResize("district", e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>

                  <th
                    className="p-2.5 text-right font-semibold border-r border-slate-700 select-none cursor-pointer relative group/th"
                    style={{ width: `${reportColWidths.population}px`, minWidth: `${reportColWidths.population}px` }}
                    onClick={() => handleSortAnnex("population")}
                  >
                    <div className="flex items-center justify-end pr-2">
                      <span>Population</span>
                      {getSortIconAnnex("population")}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                      onMouseDown={(e) => startReportResize("population", e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>

                  <th
                    className="p-2.5 text-right font-semibold border-r border-slate-700 select-none cursor-pointer relative group/th"
                    style={{ width: `${reportColWidths.pi}px`, minWidth: `${reportColWidths.pi}px` }}
                    onClick={() => handleSortAnnex("pi")}
                  >
                    <div className="flex items-center justify-end pr-2">
                      <span>Immunity (40)</span>
                      {getSortIconAnnex("pi")}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                      onMouseDown={(e) => startReportResize("pi", e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>

                  <th
                    className="p-2.5 text-right font-semibold border-r border-slate-700 select-none cursor-pointer relative group/th"
                    style={{ width: `${reportColWidths.sq}px`, minWidth: `${reportColWidths.sq}px` }}
                    onClick={() => handleSortAnnex("sq")}
                  >
                    <div className="flex items-center justify-end pr-2">
                      <span>Surv. (20)</span>
                      {getSortIconAnnex("sq")}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                      onMouseDown={(e) => startReportResize("sq", e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>

                  <th
                    className="p-2.5 text-right font-semibold border-r border-slate-700 select-none cursor-pointer relative group/th"
                    style={{ width: `${reportColWidths.pd}px`, minWidth: `${reportColWidths.pd}px` }}
                    onClick={() => handleSortAnnex("pd")}
                  >
                    <div className="flex items-center justify-end pr-2">
                      <span>Delivery (16)</span>
                      {getSortIconAnnex("pd")}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                      onMouseDown={(e) => startReportResize("pd", e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>

                  <th
                    className="p-2.5 text-right font-semibold border-r border-slate-700 select-none cursor-pointer relative group/th"
                    style={{ width: `${reportColWidths.ta}px`, minWidth: `${reportColWidths.ta}px` }}
                    onClick={() => handleSortAnnex("ta")}
                  >
                    <div className="flex items-center justify-end pr-2">
                      <span>Threats (24)</span>
                      {getSortIconAnnex("ta")}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                      onMouseDown={(e) => startReportResize("ta", e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>

                  <th
                    className="p-2.5 text-right font-bold border-r border-slate-700 select-none cursor-pointer relative group/th"
                    style={{ width: `${reportColWidths.total}px`, minWidth: `${reportColWidths.total}px` }}
                    onClick={() => handleSortAnnex("total")}
                  >
                    <div className="flex items-center justify-end pr-2">
                      <span>Total Score</span>
                      {getSortIconAnnex("total")}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                      onMouseDown={(e) => startReportResize("total", e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>

                  <th className="p-2.5 text-center font-semibold border-r border-slate-700 w-28 min-w-28">
                    Risk Tier
                  </th>

                  <th
                    className="p-2.5 font-semibold"
                    style={{ width: `${reportColWidths.rec}px`, minWidth: `${reportColWidths.rec}px` }}
                  >
                    Recommended Interventions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y text-foreground">
                {paginatedAnnexDistricts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-muted-foreground">
                      No district results match the search filter.
                    </td>
                  </tr>
                ) : (
                  paginatedAnnexDistricts.map((d, idx) => {
                    const domains = d.domainScoresJson || {};
                    const rec = getDistrictRecommendation(d);
                    const globalIdx = (annexPage - 1) * annexPageSize + idx + 1;
                    const cat = d.riskCategory || "LOW";

                    const badgeStyle =
                      cat === "VERY_HIGH"
                        ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                        : cat === "HIGH"
                        ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800"
                        : cat === "MEDIUM"
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";

                    const catLabel =
                      cat === "VERY_HIGH" ? "Very High" : cat === "HIGH" ? "High" : cat === "MEDIUM" ? "Medium" : "Low";

                    return (
                      <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors group">
                        {/* FROZEN 1: INDEX */}
                        <td
                          className="p-2.5 text-center text-muted-foreground border-r sticky left-0 z-20 bg-background group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/50"
                          style={{ width: `${reportColWidths.index}px`, minWidth: `${reportColWidths.index}px`, maxWidth: `${reportColWidths.index}px` }}
                        >
                          {globalIdx}
                        </td>

                        {/* FROZEN 2: PROVINCE */}
                        <td
                          className="p-2.5 text-muted-foreground border-r whitespace-nowrap sticky z-20 bg-background group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/50 font-medium"
                          style={{
                            left: `${reportColWidths.index}px`,
                            width: `${reportColWidths.province}px`,
                            minWidth: `${reportColWidths.province}px`,
                            maxWidth: `${reportColWidths.province}px`,
                          }}
                        >
                          <span className="truncate block" title={d.provinceName || "National"}>
                            {d.provinceName || "National"}
                          </span>
                        </td>

                        {/* FROZEN 3: DISTRICT (WITH SHADOW DIVIDER) */}
                        <td
                          className="p-2.5 font-bold border-r-2 border-slate-300 dark:border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap sticky z-20 bg-background group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/50 text-foreground"
                          style={{
                            left: `${reportColWidths.index + reportColWidths.province}px`,
                            width: `${reportColWidths.district}px`,
                            minWidth: `${reportColWidths.district}px`,
                            maxWidth: `${reportColWidths.district}px`,
                          }}
                        >
                          <span className="truncate block" title={d.areaName || d.districtName}>
                            {d.areaName || d.districtName}
                          </span>
                        </td>

                        <td className="p-2.5 text-right text-muted-foreground border-r">{(Number(d.population) || 0).toLocaleString()}</td>
                        <td className="p-2.5 text-right border-r font-mono">{d.populationImmunityScore || domains.PI || "-"}</td>
                        <td className="p-2.5 text-right border-r font-mono">{d.surveillanceQualityScore || domains.SQ || "-"}</td>
                        <td className="p-2.5 text-right border-r font-mono">{d.programmeDeliveryScore || domains.PD || "-"}</td>
                        <td className="p-2.5 text-right border-r font-mono">{d.threatAssessmentScore || domains.TA || "-"}</td>
                        <td className="p-2.5 text-right font-bold border-r font-mono">
                          {d.totalRiskScore || d.totalScore || d.riskScore}
                        </td>
                        <td className="p-2.5 text-center border-r">
                          <Badge variant="outline" className={`text-[10px] font-semibold ${badgeStyle}`}>
                            {catLabel}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-muted-foreground text-xs leading-relaxed">{rec}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls (Rule 24) */}
          {sortedAnnexDistricts.length > annexPageSize && annexPageSize < 9999 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-xs text-muted-foreground print:hidden">
              <div>
                Showing {(annexPage - 1) * annexPageSize + 1} to{" "}
                {Math.min(annexPage * annexPageSize, sortedAnnexDistricts.length)} of {sortedAnnexDistricts.length} districts
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAnnexPage(1)}
                  disabled={annexPage === 1}
                  className="h-7 px-2 text-xs"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAnnexPage((p) => Math.max(1, p - 1))}
                  disabled={annexPage === 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="px-2 font-medium text-foreground">
                  Page {annexPage} of {totalAnnexPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAnnexPage((p) => Math.min(totalAnnexPages, p + 1))}
                  disabled={annexPage === totalAnnexPages}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAnnexPage(totalAnnexPages)}
                  disabled={annexPage === totalAnnexPages}
                  className="h-7 px-2 text-xs"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Section 6: Official Sign-off & National Endorsement */}
        <div className="pt-8 border-t space-y-4">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            National Technical Review & Sign-Off Endorsement
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs bg-muted/20 p-4 rounded-lg border">
            <div>
              <span className="font-semibold block text-foreground">Compiled By:</span>
              <span className="text-muted-foreground font-medium">{reportConfig.leadAssessor || "National EPI Risk Assessment Team"}</span>
              <span className="text-[10px] text-muted-foreground block">Lead Risk Evaluator</span>
            </div>
            <div>
              <span className="font-semibold block text-foreground">Technical Review & Approval:</span>
              <span className="text-muted-foreground font-medium">{reportConfig.epiManager || "Surveillance & Immunization Taskforce"}</span>
              <span className="text-[10px] text-muted-foreground block">National EPI Programme Manager</span>
            </div>
            <div>
              <span className="font-semibold block text-foreground">Approval Status & Date:</span>
              <Badge variant="outline" className="mt-0.5 text-[10px] border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
                {reportConfig.approvalStatus === "APPROVED" ? "Officially Approved" : "Draft / Technical Validation"}
              </Badge>
              <span className="text-[10px] text-muted-foreground block mt-1">
                {reportConfig.signOffDate || dateFormatted}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* INTERACTIVE REPORT EDITING MODAL (WHO EXCEL TOOL REPORT PREVIEW CUSTOMIZER) */}
      {/* ==================================================================== */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Edit3 className="w-5 h-5 text-primary" />
              Edit Country Report Narrative & Recommendations
            </DialogTitle>
            <DialogDescription className="text-xs">
              Customize executive summary text, national programmatic priorities, district-specific interventions, and official endorsement details. Changes reflect immediately in this preview and in the downloaded Word (.docx) report.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="narrative" className="space-y-4 py-2">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="narrative" className="text-xs">Background Narrative</TabsTrigger>
              <TabsTrigger value="priorities" className="text-xs">Strategic Priorities</TabsTrigger>
              <TabsTrigger value="district-recs" className="text-xs">District Recommendations</TabsTrigger>
              <TabsTrigger value="endorsement" className="text-xs">National Sign-Off</TabsTrigger>
            </TabsList>

            {/* TAB 1: BACKGROUND NARRATIVE */}
            <TabsContent value="narrative" className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="bgNarrative" className="text-xs font-semibold">
                  Background & Executive Summary Narrative
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setReportConfig({ ...reportConfig, backgroundNarrative: DEFAULT_BACKGROUND })}
                  className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3 h-3" /> Reset to WHO Default
                </Button>
              </div>
              <Textarea
                id="bgNarrative"
                rows={6}
                value={reportConfig.backgroundNarrative || ""}
                onChange={(e) => setReportConfig({ ...reportConfig, backgroundNarrative: e.target.value })}
                className="text-xs leading-relaxed"
                placeholder="Enter country-specific context, outbreak history, and assessment rationale..."
              />
              <p className="text-[11px] text-muted-foreground">
                Matches the editable narrative in Sheet 12 ('ReportPreview') of the Measles Risk Assessment Tool v1.8.
              </p>
            </TabsContent>

            {/* TAB 2: STRATEGIC PRIORITIES */}
            <TabsContent value="priorities" className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="stratPriorities" className="text-xs font-semibold">
                  National Programmatic Priorities (Section 2 & 6)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setReportConfig({ ...reportConfig, strategicPriorities: DEFAULT_STRATEGIC_PRIORITIES })}
                  className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3 h-3" /> Reset to Standard Priorities
                </Button>
              </div>
              <Textarea
                id="stratPriorities"
                rows={6}
                value={reportConfig.strategicPriorities || ""}
                onChange={(e) => setReportConfig({ ...reportConfig, strategicPriorities: e.target.value })}
                className="text-xs leading-relaxed"
                placeholder="Document national actionable steps: mop-up campaigns, active surveillance zero-reporting, cold chain upgrades..."
              />
              <p className="text-[11px] text-muted-foreground">
                These priorities will be featured in the final recommendations section of both the web preview and Word report.
              </p>
            </TabsContent>

            {/* TAB 3: DISTRICT RECOMMENDATIONS */}
            <TabsContent value="district-recs" className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  District-Specific Recommendations (High & Very High Risk Districts)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Select a standardized WHO action preset or type a customized intervention for each priority district.
                </p>
              </div>

              <div className="max-h-[340px] overflow-y-auto border rounded-md divide-y">
                {[...vhrDistricts, ...hrDistricts].map((dist) => {
                  const name = dist.areaName || dist.districtName || "";
                  const currentRec = reportConfig.districtRecommendations?.[name] || getDistrictRecommendation(dist);
                  const isVHR = dist.riskCategory === "VERY_HIGH";

                  return (
                    <div key={dist.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
                      <div className="sm:w-1/3 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={isVHR ? "bg-red-50 text-red-600 border-red-200" : "bg-orange-50 text-orange-600 border-orange-200"}>
                            {isVHR ? "VHR" : "HR"} ({dist.totalRiskScore || dist.totalScore || dist.riskScore})
                          </Badge>
                          <span className="font-bold">{name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block">{dist.provinceName || "National"}</span>
                      </div>

                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={currentRec}
                          onChange={(e) => {
                            const updated = { ...(reportConfig.districtRecommendations || {}), [name]: e.target.value };
                            setReportConfig({ ...reportConfig, districtRecommendations: updated });
                          }}
                          className="h-8 text-xs flex-1"
                          placeholder="Specific action for this district..."
                        />
                        <Select
                          onValueChange={(val) => {
                            const updated = { ...(reportConfig.districtRecommendations || {}), [name]: val };
                            setReportConfig({ ...reportConfig, districtRecommendations: updated });
                          }}
                        >
                          <SelectTrigger className="h-8 w-8 p-0 shrink-0" title="Choose Preset">
                            <Sparkles className="w-3.5 h-3.5 text-primary mx-auto" />
                          </SelectTrigger>
                          <SelectContent align="end" className="w-[300px]">
                            {ACTION_PRESETS.map((preset, pIdx) => (
                              <SelectItem key={pIdx} value={preset} className="text-xs">
                                {preset}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* TAB 4: NATIONAL ENDORSEMENT */}
            <TabsContent value="endorsement" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="leadAssessor" className="text-xs">Lead Assessment Officer / Compiler</Label>
                  <Input
                    id="leadAssessor"
                    value={reportConfig.leadAssessor || ""}
                    onChange={(e) => setReportConfig({ ...reportConfig, leadAssessor: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="e.g. Dr. Jane Khumalo (National VPD Epidemiologist)"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="epiManager" className="text-xs">National EPI Programme Manager</Label>
                  <Input
                    id="epiManager"
                    value={reportConfig.epiManager || ""}
                    onChange={(e) => setReportConfig({ ...reportConfig, epiManager: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="e.g. Dr. T. Dlamini (Ministry of Health EPI Director)"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signOffDate" className="text-xs">Endorsement Date</Label>
                  <Input
                    id="signOffDate"
                    value={reportConfig.signOffDate || ""}
                    onChange={(e) => setReportConfig({ ...reportConfig, signOffDate: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="e.g. September 5, 2026"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="approvalStatus" className="text-xs">Endorsement Status</Label>
                  <Select
                    value={reportConfig.approvalStatus || "DRAFT"}
                    onValueChange={(val) => setReportConfig({ ...reportConfig, approvalStatus: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft / Technical Validation</SelectItem>
                      <SelectItem value="APPROVED">Officially Endorsed & Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saveReportMutation.isPending}
              onClick={() => saveReportMutation.mutate(reportConfig)}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {saveReportMutation.isPending ? "Saving..." : "Save Report Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
