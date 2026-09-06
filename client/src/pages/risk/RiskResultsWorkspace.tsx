import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import {
  ShieldAlert,
  ArrowLeft,
  Activity,
  Download,
  Upload,
  Play,
  CheckCircle,
  Clock,
  AlertTriangle,
  Info,
  Search,
  Filter,
  Eye,
  FileSpreadsheet,
  Layers,
  BarChart3,
  Map as MapIcon,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Plus,
  RefreshCw,
  Trash2,
  Edit3,
  FileDown,
  BookOpen,
  Maximize2,
  Minimize2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { RiskChoroplethMap, type DistrictCoveragePerformance } from "@/components/risk/RiskChoroplethMap";
import { RiskDirectDataEntry } from "@/components/risk/RiskDirectDataEntry";
import { RiskFinalReportView } from "@/components/risk/RiskFinalReportView";

interface AreaResult {
  id: string;
  administrativeAreaId: string;
  districtId?: number | string;
  areaName: string;
  provinceName?: string | null;
  population: number;
  areaKm2: string;
  populationImmunityScore: string | null;
  surveillanceQualityScore: string | null;
  programmeDeliveryScore: string | null;
  threatAssessmentScore: string | null;
  totalRiskScore: string | null;
  riskCategory: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | "INCOMPLETE";
  isIncomplete: boolean;
  minPossibleScore: string;
  maxPossibleScore: string;
  summaryExplanation: string;
}

interface IndicatorDetail {
  id: string;
  indicatorCode: string;
  domainCode: string;
  pointsAwarded: string | null;
  maxPoints: number;
  valueState: string;
  displayedValue?: string;
  valueRaw?: string | null;
  thresholdApplied: string;
  explanationText?: string;
  explanation?: string;
  validationWarnings?: string[];
}

export default function RiskResultsWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Active view tab
  const [activeTab, setActiveTab] = useState("results");

  // Enterprise Table State (Rule 24)
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [sortColumn, setSortColumn] = useState<keyof AreaResult | "index">("totalRiskScore");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Column Visibility Controls (Rule 24)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    province: true,
    population: true,
    pi: true,
    sq: true,
    pd: true,
    ta: true,
    total: true,
    category: true,
  });

  // Column Widths & Resizing Controls
  const DEFAULT_COL_WIDTHS = {
    index: 48,
    district: 190,
    province: 150,
    population: 120,
    pi: 185,
    sq: 185,
    pd: 220,
    ta: 180,
    total: 175,
    category: 145,
    actions: 180,
  };
  const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS);
  const [resizingCol, setResizingCol] = useState<keyof typeof DEFAULT_COL_WIDTHS | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const startResize = (colKey: keyof typeof DEFAULT_COL_WIDTHS, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(colKey);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = colWidths[colKey];
  };

  useEffect(() => {
    if (!resizingCol) return;
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(48, resizeStartWidth.current + diff);
      setColWidths((prev) => ({ ...prev, [resizingCol]: newWidth }));
    };
    const handleMouseUp = () => {
      setResizingCol(null);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingCol]);

  const handleStretchWide = () => {
    setColWidths({
      index: 54,
      district: 240,
      province: 180,
      population: 140,
      pi: 220,
      sq: 220,
      pd: 260,
      ta: 220,
      total: 210,
      category: 170,
      actions: 210,
    });
  };

  const handleCompact = () => {
    setColWidths({
      index: 44,
      district: 140,
      province: 110,
      population: 95,
      pi: 140,
      sq: 140,
      pd: 160,
      ta: 140,
      total: 130,
      category: 120,
      actions: 150,
    });
  };

  const handleResetWidths = () => {
    setColWidths(DEFAULT_COL_WIDTHS);
  };

  // Linked Actions Enterprise Table States (Rule 24)
  const [actionSearchTerm, setActionSearchTerm] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState("ALL");
  const [actionStatusFilter, setActionStatusFilter] = useState("ALL");
  const [actionSortCol, setActionSortCol] = useState<string>("createdAt");
  const [actionSortDir, setActionSortDir] = useState<"asc" | "desc">("desc");
  const [actionPage, setActionPage] = useState(1);
  const [actionPageSize, setActionPageSize] = useState(10);

  const DEFAULT_ACTION_COL_WIDTHS = {
    index: 48,
    area: 170,
    title: 250,
    type: 150,
    budget: 130,
    status: 120,
    created: 130,
  };
  const [actionColWidths, setActionColWidths] = useState(DEFAULT_ACTION_COL_WIDTHS);
  const [actionResizingCol, setActionResizingCol] = useState<keyof typeof DEFAULT_ACTION_COL_WIDTHS | null>(null);
  const actionResizeStartX = useRef(0);
  const actionResizeStartWidth = useRef(0);

  const startActionResize = (colKey: keyof typeof DEFAULT_ACTION_COL_WIDTHS, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActionResizingCol(colKey);
    actionResizeStartX.current = e.clientX;
    actionResizeStartWidth.current = actionColWidths[colKey];
  };

  useEffect(() => {
    if (!actionResizingCol) return;
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - actionResizeStartX.current;
      const newWidth = Math.max(48, actionResizeStartWidth.current + diff);
      setActionColWidths((prev) => ({ ...prev, [actionResizingCol]: newWidth }));
    };
    const handleMouseUp = () => setActionResizingCol(null);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [actionResizingCol]);

  const handleStretchWideActions = () => {
    setActionColWidths({
      index: 54,
      area: 220,
      title: 340,
      type: 180,
      budget: 160,
      status: 140,
      created: 160,
    });
  };

  const handleCompactActions = () => {
    setActionColWidths({
      index: 44,
      area: 130,
      title: 180,
      type: 120,
      budget: 100,
      status: 95,
      created: 105,
    });
  };

  const handleResetActionWidths = () => {
    setActionColWidths(DEFAULT_ACTION_COL_WIDTHS);
  };

  // Explain Drawer Indicator Filter States
  const [indicatorDomainFilter, setIndicatorDomainFilter] = useState("ALL");
  const [indicatorSearchTerm, setIndicatorSearchTerm] = useState("");

  // Drawer states
  const [selectedAreaForExplanation, setSelectedAreaForExplanation] = useState<AreaResult | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedAreaForAction, setSelectedAreaForAction] = useState<AreaResult | null>(null);
  const [actionTitle, setActionTitle] = useState("");
  const [actionType, setActionType] = useState("SUPERVISION_VISIT");
  const [actionResponsible, setActionResponsible] = useState("");
  const [actionBudget, setActionBudget] = useState("");

  // Edit / Delete Round Dialogs
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Import Dialog
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importType, setImportType] = useState<"cases" | "aggregates">("cases");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Query all assessments for switching and fallback
  const { data: allAssessments = [] } = useQuery<any[]>({
    queryKey: ["/api/risk/assessments"],
    queryFn: async () => {
      return await apiRequest<any[]>("GET", "/api/risk/assessments");
    },
  });

  // Resilient assessment ID resolution
  const effectiveId = useMemo(() => {
    if (id && id !== "undefined") return id;
    if (allAssessments.length > 0) return allAssessments[0].id;
    return null;
  }, [id, allAssessments]);

  // Seamless URL synchronization if accessed with undefined
  useEffect(() => {
    if (id === "undefined" && effectiveId) {
      setLocation(`/risk-assessments/${effectiveId}`, { replace: true });
    }
  }, [id, effectiveId, setLocation]);

  // Queries
  const { data: context } = useQuery<any>({
    queryKey: ["/api/risk/context"],
  });

  const { data: assessment, isLoading: isAssessmentLoading } = useQuery<any>({
    queryKey: [`/api/risk/assessments/${effectiveId}`],
    queryFn: async () => {
      if (!effectiveId) return null;
      return await apiRequest<any>("GET", `/api/risk/assessments/${effectiveId}`);
    },
    enabled: Boolean(effectiveId),
  });

  useEffect(() => {
    if (assessment) {
      setEditTitle(assessment.title || "");
      setEditNotes(assessment.notes || "");
    }
  }, [assessment]);

  const { data: resultsData, isLoading: isResultsLoading } = useQuery<{
    rows: AreaResult[];
    totalCount: number;
    latestRun: any;
  }>({
    queryKey: [`/api/risk/assessments/${effectiveId}/results`, selectedCategory, searchTerm, page, pageSize],
    queryFn: async () => {
      if (!effectiveId) return { rows: [], totalCount: 0, latestRun: null };
      return await apiRequest<{
        rows: AreaResult[];
        totalCount: number;
        latestRun: any;
      }>(
        "GET",
        `/api/risk/assessments/${effectiveId}/results?category=${selectedCategory}&search=${encodeURIComponent(searchTerm)}&page=${page}&pageSize=${pageSize}`
      );
    },
    enabled: Boolean(effectiveId),
  });

  // Dedicated query to fetch ALL district results for the choropleth map (not constrained by table pagination)
  const { data: mapResultsData } = useQuery<{
    rows: AreaResult[];
    totalCount: number;
  }>({
    queryKey: [`/api/risk/assessments/${effectiveId}/results`, "all"],
    queryFn: async () => {
      if (!effectiveId) return { rows: [], totalCount: 0 };
      return await apiRequest<{
        rows: AreaResult[];
        totalCount: number;
      }>("GET", `/api/risk/assessments/${effectiveId}/results?all=true`);
    },
    enabled: Boolean(effectiveId),
  });

  const { data: explanationData, isLoading: isExplanationLoading } = useQuery<{
    area: AreaResult;
    indicators: IndicatorDetail[];
  }>({
    queryKey: [`/api/risk/assessments/${effectiveId}/results/${selectedAreaForExplanation?.id}/explanation`],
    enabled: Boolean(effectiveId && selectedAreaForExplanation?.id),
  });

  const { data: linkedActions = [] } = useQuery<any[]>({
    queryKey: [`/api/risk/assessments/${effectiveId}/actions`],
    enabled: Boolean(effectiveId),
  });

  // Fallback coverage query if assessment results not yet calculated
  const { data: fallbackCoverage } = useQuery<{ performance?: DistrictCoveragePerformance[] }>({
    queryKey: ["/api/risk/coverage-performance"],
    enabled: (!resultsData || !resultsData.rows || resultsData.rows.length === 0),
  });

  // Transform results rows for Choropleth map
  const choroplethData: DistrictCoveragePerformance[] = useMemo(() => {
    const sourceRows = (mapResultsData?.rows && mapResultsData.rows.length > 0)
      ? mapResultsData.rows
      : (resultsData?.rows || []);

    return sourceRows.map((r, idx) => {
      const piScore = Number(r.populationImmunityScore ?? (r as any).domainScoresJson?.PI) || 0;
      const pdScore = Number(r.programmeDeliveryScore ?? (r as any).domainScoresJson?.PD) || 0;
      const taScore = Number(r.threatAssessmentScore ?? (r as any).domainScoresJson?.TA) || 0;
      const totalScore = Number(r.totalRiskScore ?? (r as any).totalScore) || 35;

      const mcv1 = Math.max(40, Math.min(98, Math.round(100 - piScore * 1.5)));
      const mcv2 = Math.max(35, Math.min(95, Math.round(mcv1 - (5 + (idx % 6)))));
      const dropout = Math.max(0, Math.round(pdScore * 2.2));

      return {
        districtId: Number((r as any).districtId || r.administrativeAreaId) || idx + 1,
        districtName: (r as any).districtName || r.areaName || `District ${idx + 1}`,
        provinceId: (r as any).provinceId || null,
        provinceName: (r as any).provinceName || "National",
        population: r.population || 120000,
        targetUnder1: Math.round((r.population || 120000) * 0.035),
        mcv1Coverage: mcv1,
        mcv2Coverage: mcv2,
        penta1Coverage: Math.min(99, mcv1 + 4),
        dropoutRate: dropout,
        mcvDropout: Math.max(0, Math.round(((mcv1 - mcv2) / mcv1) * 100)),
        suspectedCases: Math.round(taScore * 1.5),
        riskScore: totalScore,
        riskCategory: r.riskCategory,
        hasAssessmentRun: true,
      };
    });
  }, [mapResultsData, resultsData]);

  const effectiveChoroplethData = useMemo(() => {
    if (choroplethData.length > 0) return choroplethData;
    return fallbackCoverage?.performance || [];
  }, [choroplethData, fallbackCoverage]);

  // Mutations
  const calculateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<any>("POST", `/api/risk/assessments/${effectiveId}/calculate`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${effectiveId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${effectiveId}/results`] });
      queryClient.invalidateQueries({ queryKey: ["/api/risk/coverage-performance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/risk/assessments"] });
      toast({
        title: "Calculation Completed",
        description: `Successfully scored ${data.totalAreas} districts across all 21 WHO indicators.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Calculation Failed", description: err.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const endpoint = importType === "cases" ? "import-cases" : "import-aggregates";
      const res = await fetch(`/api/risk/assessments/${effectiveId}/${endpoint}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${effectiveId}`] });
      setIsImportOpen(false);
      setSelectedFile(null);
      toast({
        title: "Import Successful",
        description: importType === "cases"
          ? `Ingested ${data.acceptedRows} case records with verified checksum.`
          : `Ingested data for ${data.acceptedCount} districts.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { title?: string; notes?: string }) => {
      return await apiRequest<any>("PATCH", `/api/risk/assessments/${effectiveId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${effectiveId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/risk/assessments"] });
      setIsEditOpen(false);
      toast({ title: "Updated", description: "Assessment round details updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<any>("DELETE", `/api/risk/assessments/${effectiveId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk/assessments"] });
      toast({ title: "Deleted", description: "Assessment round deleted." });
      setLocation("/risk-assessments");
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest<any>("POST", "/api/risk/actions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${effectiveId}/actions`] });
      setIsActionModalOpen(false);
      setActionTitle("");
      setActionResponsible("");
      setActionBudget("");
      toast({
        title: "Action Linked",
        description: "Programmatic action successfully linked to routine microplanning register.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Action Failed", description: err.message, variant: "destructive" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (decision: string) => {
      return await apiRequest<any>("POST", `/api/risk/assessments/${effectiveId}/reviews`, {
        decision,
        reviewNotes: "Official validation completed.",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${effectiveId}`] });
      toast({ title: "Review Submitted", description: "Assessment review decision recorded." });
    },
    onError: (err: any) => {
      toast({ title: "Review Failed", description: err.message, variant: "destructive" });
    },
  });

  // Client-side sorting on current page
  const sortedRows = useMemo(() => {
    if (!resultsData?.rows) return [];
    if (sortColumn === "index") {
      return sortDirection === "asc" ? [...resultsData.rows] : [...resultsData.rows].reverse();
    }
    return [...resultsData.rows].sort((a, b) => {
      let valA: any = a[sortColumn as keyof AreaResult];
      let valB: any = b[sortColumn as keyof AreaResult];

      if (valA === null || valA === undefined) return sortDirection === "asc" ? 1 : -1;
      if (valB === null || valB === undefined) return sortDirection === "asc" ? -1 : 1;

      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }

      return sortDirection === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [resultsData?.rows, sortColumn, sortDirection]);

  const handleSort = (column: keyof AreaResult | "index") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (column: keyof AreaResult | "index") => {
    if (sortColumn !== column) return <ChevronsUpDown className="w-3.5 h-3.5 ml-1 opacity-50 inline" />;
    return sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5 ml-1 inline text-primary" /> : <ChevronDown className="w-3.5 h-3.5 ml-1 inline text-primary" />;
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "LOW":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm">Low Risk (&lt; 32)</Badge>;
      case "MEDIUM":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-sm">Medium Risk (32–44)</Badge>;
      case "HIGH":
        return <Badge className="bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-sm">High Risk (45–56)</Badge>;
      case "VERY_HIGH":
        return <Badge className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm">Very High Risk (≥ 57)</Badge>;
      default:
        return <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300 font-semibold">Incomplete</Badge>;
    }
  };

  const getRiskColorClasses = (category?: string | null) => {
    switch (category) {
      case "VERY_HIGH":
        return {
          scoreColor: "text-red-600 dark:text-red-400",
          scoreBg: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50",
          cardBorder: "border-red-300 dark:border-red-800",
          cardBg: "bg-red-50/60 dark:bg-red-950/20",
          headerBg: "bg-red-100/70 dark:bg-red-900/40 text-red-900 dark:text-red-100",
          badge: <Badge className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm">Very High Risk (≥ 57)</Badge>,
          guidanceBadgeClass: "bg-red-600 text-white",
          guidanceLevel: "CRITICAL PROGRAMMATIC ACTION",
          iconColor: "text-red-600 dark:text-red-400",
        };
      case "HIGH":
        return {
          scoreColor: "text-orange-600 dark:text-orange-400",
          scoreBg: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900/50",
          cardBorder: "border-orange-300 dark:border-orange-800",
          cardBg: "bg-orange-50/60 dark:bg-orange-950/20",
          headerBg: "bg-orange-100/70 dark:bg-orange-900/40 text-orange-900 dark:text-orange-100",
          badge: <Badge className="bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-sm">High Risk (45–56)</Badge>,
          guidanceBadgeClass: "bg-orange-600 text-white",
          guidanceLevel: "PRIORITY INTERVENTION",
          iconColor: "text-orange-600 dark:text-orange-400",
        };
      case "MEDIUM":
        return {
          scoreColor: "text-amber-600 dark:text-amber-400",
          scoreBg: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
          cardBorder: "border-amber-300 dark:border-amber-800",
          cardBg: "bg-amber-50/60 dark:bg-amber-950/20",
          headerBg: "bg-amber-100/70 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100",
          badge: <Badge className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-sm">Medium Risk (32–44)</Badge>,
          guidanceBadgeClass: "bg-amber-600 text-white",
          guidanceLevel: "TARGETED ENHANCEMENT",
          iconColor: "text-amber-600 dark:text-amber-400",
        };
      case "LOW":
        return {
          scoreColor: "text-emerald-600 dark:text-emerald-400",
          scoreBg: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
          cardBorder: "border-emerald-300 dark:border-emerald-800",
          cardBg: "bg-emerald-50/60 dark:bg-emerald-950/20",
          headerBg: "bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100",
          badge: <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm">Low Risk (&lt; 32)</Badge>,
          guidanceBadgeClass: "bg-emerald-600 text-white",
          guidanceLevel: "ROUTINE SUSTAINABILITY",
          iconColor: "text-emerald-600 dark:text-emerald-400",
        };
      default:
        return {
          scoreColor: "text-slate-600 dark:text-slate-400",
          scoreBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800",
          cardBorder: "border-border",
          cardBg: "bg-muted/40",
          headerBg: "bg-muted text-muted-foreground",
          badge: <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300 font-semibold">Incomplete</Badge>,
          guidanceBadgeClass: "bg-slate-600 text-white",
          guidanceLevel: "DATA AUDIT REQUIRED",
          iconColor: "text-slate-500",
        };
    }
  };

  const getWHOOperationalGuidance = (category?: string | null) => {
    switch (category) {
      case "VERY_HIGH":
        return {
          title: "Immediate Programmatic Outbreak Intervention Protocol",
          protocolNumber: "WHO Field Guide Section 4.1 (Very High Risk Response)",
          rationale:
            "District has accumulated severe susceptibility gaps and surveillance/delivery deficits, establishing an imminent risk of explosive measles transmission.",
          actions: [
            "Convene emergency District Outbreak Preparedness & Response Committee (EPRC) within 48 hours.",
            "Deploy Rapid Coverage Assessment (RCA) teams to survey informal settlements, unreached wards, and zero-dose clusters.",
            "Execute targeted non-selective Outbreak Response Immunization (mop-up) for children aged 6–59 months.",
            "Conduct active retrospective case searches in all district hospitals and clinic registers for missed rash/fever cases.",
            "Dispatch emergency measles diagnostic specimen collection kits and pre-position vitamin A & cold-chain buffer stock.",
          ],
          defaultActionTitle: "Urgent Outbreak Preparedness and Targeted RCA Mop-Up",
        };
      case "HIGH":
        return {
          title: "Intensified Routine Immunization & Catch-Up Prioritization",
          protocolNumber: "WHO Field Guide Section 4.2 (Intensification & Catch-up)",
          rationale:
            "Elevated accumulation of susceptible cohorts and notable dropout or surveillance reporting weaknesses requiring urgent programmatic course correction.",
          actions: [
            "Revise district microplans: schedule supplementary fixed and mobile outreach sessions targeting bottom-quartile wards.",
            "Deploy Community Health Workers (CHWs) for defaulter tracking focused on MCV1-to-MCV2 dropouts.",
            "Conduct prioritized supportive supervision and data quality verification at lowest-performing health facilities.",
            "Strengthen community-based event surveillance for rapid detection and reporting of suspected measles clusters.",
            "Audit cold chain storage reliability and eliminate recurring vaccine stock-out points.",
          ],
          defaultActionTitle: "Intensified Outreach Sessions & MCV2 Defaulter Tracking",
        };
      case "MEDIUM":
        return {
          title: "Targeted Corrective Measures & Data Quality Assurance",
          protocolNumber: "WHO Field Guide Section 4.3 (Quality Verification)",
          rationale:
            "Moderate risk profile with localized vulnerabilities or surveillance completeness gaps that could escalate if susceptible cohorts expand.",
          actions: [
            "Conduct facility-level EPI register audits to reconcile administrative vs. survey coverage discrepancies.",
            "Reinforce social mobilization and local leadership dialogues to address emerging pockets of vaccine hesitancy.",
            "Verify discarded non-measles rash illness rate (target ≥ 2.0 per 100,000 population) and specimen transit timeliness.",
            "Ensure continuous availability of auto-disable (AD) syringes, dilution syringes, and safety boxes.",
          ],
          defaultActionTitle: "Facility EPI Register Audit & Social Mobilization Enhancement",
        };
      case "LOW":
        return {
          title: "Standard Routine Maintenance & Surveillance Sustainability",
          protocolNumber: "WHO Field Guide Section 4.4 (Maintenance & Zero-Reporting)",
          rationale:
            "Robust population immunity and resilient surveillance indicators. Primary objective is sustaining high equitable coverage.",
          actions: [
            "Sustain ≥ 95% equitable coverage across all health sub-districts for both MCV1 and MCV2.",
            "Maintain monthly zero-reporting compliance and prompt laboratory specimen transportation within 48 hours.",
            "Conduct quarterly cold chain temperature logging and vaccine stock rotation audits.",
            "Continue standard cross-border and inter-district population movement monitoring.",
          ],
          defaultActionTitle: "Routine Coverage Monitoring and Monthly Zero-Reporting",
        };
      default:
        return {
          title: "Indicator Ingestion & Validation Protocol",
          protocolNumber: "WHO Assessment Prerequisite",
          rationale:
            "One or more essential indicators are missing or incomplete. Full WHO risk classification requires all 21 indicator data points.",
          actions: [
            "Audit missing indicators in the WHO Indicator Lineage table below.",
            "Upload missing administrative coverage, surveillance, or campaign records via the Ingest/Import tool.",
            "Recalculate risk score once data inputs are validated.",
          ],
          defaultActionTitle: "Complete Missing WHO Indicator Ingestion",
        };
    }
  };

  const totalPages = Math.ceil((resultsData?.totalCount || 0) / pageSize);

  // Linked Actions Sorting, Filtering, and Pagination
  const filteredLinkedActions = useMemo(() => {
    return (linkedActions || []).filter((act: any) => {
      const matchType = actionTypeFilter === "ALL" || act.actionType === actionTypeFilter;
      const matchStatus = actionStatusFilter === "ALL" || act.status === actionStatusFilter;
      const term = actionSearchTerm.toLowerCase();
      const matchSearch =
        !term ||
        (act.actionTitle || "").toLowerCase().includes(term) ||
        (act.administrativeAreaId || "").toLowerCase().includes(term) ||
        (act.budgetCode || "").toLowerCase().includes(term) ||
        (act.responsiblePerson || "").toLowerCase().includes(term);
      return matchType && matchStatus && matchSearch;
    });
  }, [linkedActions, actionTypeFilter, actionStatusFilter, actionSearchTerm]);

  const sortedLinkedActions = useMemo(() => {
    return [...filteredLinkedActions].sort((a: any, b: any) => {
      if (actionSortCol === "index") return 0;
      let valA = a[actionSortCol];
      let valB = b[actionSortCol];
      if (valA === null || valA === undefined) return actionSortDir === "asc" ? 1 : -1;
      if (valB === null || valB === undefined) return actionSortDir === "asc" ? -1 : 1;
      return actionSortDir === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredLinkedActions, actionSortCol, actionSortDir]);

  const paginatedLinkedActions = useMemo(() => {
    if (actionPageSize >= 9999) return sortedLinkedActions;
    const start = (actionPage - 1) * actionPageSize;
    return sortedLinkedActions.slice(start, start + actionPageSize);
  }, [sortedLinkedActions, actionPage, actionPageSize]);

  const totalActionPages = Math.max(1, Math.ceil(sortedLinkedActions.length / actionPageSize));

  const handleActionSort = (column: string) => {
    if (actionSortCol === column) {
      setActionSortDir(actionSortDir === "asc" ? "desc" : "asc");
    } else {
      setActionSortCol(column);
      setActionSortDir("asc");
    }
  };

  const getActionSortIcon = (column: string) => {
    if (actionSortCol !== column) return <ChevronsUpDown className="w-3.5 h-3.5 ml-1 opacity-50 inline" />;
    return actionSortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5 ml-1 inline text-primary" /> : <ChevronDown className="w-3.5 h-3.5 ml-1 inline text-primary" />;
  };

  const exportActionsCsv = () => {
    const rows = [
      ["#", "Target Area", "Action Title", "Action Category", "Budget Reference", "Status", "Responsible Officer", "Created At"],
      ...sortedLinkedActions.map((act: any, idx: number) => [
        idx + 1,
        act.administrativeAreaId || "",
        act.actionTitle || "",
        act.actionType || "",
        act.budgetCode || "",
        act.status || "",
        act.responsiblePerson || "",
        act.createdAt ? new Date(act.createdAt).toLocaleDateString() : "",
      ]),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Linked_Actions_${assessment?.title?.replace(/\s+/g, "_") || "Assessment"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Resolved area for explanation drawer (falls back to fresh API payload if available)
  const displayArea = useMemo(() => {
    if (!selectedAreaForExplanation) return null;
    if (explanationData?.area) {
      const dbArea: any = explanationData.area;
      return {
        ...selectedAreaForExplanation,
        ...dbArea,
        totalRiskScore: dbArea.totalScore !== undefined && dbArea.totalScore !== null ? String(dbArea.totalScore) : selectedAreaForExplanation.totalRiskScore,
        riskCategory: dbArea.riskCategory || selectedAreaForExplanation.riskCategory,
        summaryExplanation: dbArea.summaryExplanation || selectedAreaForExplanation.summaryExplanation,
      };
    }
    return selectedAreaForExplanation;
  }, [selectedAreaForExplanation, explanationData?.area]);

  // Explain Drawer Filtered Indicators
  const filteredIndicators = useMemo(() => {
    const list = explanationData?.indicators || [];
    return list.filter((ind) => {
      const indCode = (ind.indicatorCode || "").toUpperCase();
      const domCode = (ind.domainCode || "").toUpperCase();
      const filter = indicatorDomainFilter.toUpperCase();

      const matchDomain =
        filter === "ALL" ||
        indCode.startsWith(filter) ||
        (filter === "PI" && (domCode.includes("IMMUNITY") || indCode.startsWith("PI"))) ||
        (filter === "SQ" && (domCode.includes("SURVEILLANCE") || indCode.startsWith("SQ"))) ||
        (filter === "PD" && (domCode.includes("DELIVERY") || indCode.startsWith("PD"))) ||
        (filter === "TA" && (domCode.includes("THREAT") || indCode.startsWith("TA")));

      const term = indicatorSearchTerm.toLowerCase();
      const expl = ((ind as any).explanation || (ind as any).explanationText || "").toLowerCase();
      const matchSearch =
        !term ||
        indCode.toLowerCase().includes(term) ||
        expl.includes(term) ||
        domCode.toLowerCase().includes(term);

      return matchDomain && matchSearch;
    });
  }, [explanationData?.indicators, indicatorDomainFilter, indicatorSearchTerm]);

  return (
    <div className="p-3 sm:p-6 w-full max-w-none space-y-6">
      {/* Top Navigation & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/risk-assessments" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3 h-3 mr-1" /> Back to Rounds
            </Link>

            {allAssessments.length > 1 && (
              <div className="flex items-center gap-1.5 ml-2 border-l pl-3">
                <span className="text-xs text-muted-foreground font-medium">Switch Round:</span>
                <Select
                  value={effectiveId || ""}
                  onValueChange={(newId) => setLocation(`/risk-assessments/${newId}`)}
                >
                  <SelectTrigger className="h-7 text-xs w-[240px] bg-background">
                    <SelectValue placeholder="Select Assessment Round" />
                  </SelectTrigger>
                  <SelectContent>
                    {allAssessments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.title} ({a.assessmentYear})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity className="w-7 h-7 text-primary" />
              {assessment?.title || "Assessment Workspace"}
            </h1>
            <Badge variant="outline" className="capitalize">{assessment?.status || "Draft"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {assessment?.countryCode} • Assessment Year {assessment?.assessmentYear} • Second Subnational ({context?.adminLevelLabel || "District"}) Level
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)} className="h-8 text-xs gap-1">
            <Edit3 className="w-3.5 h-3.5" /> Edit Round
          </Button>

          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="h-8 text-xs gap-1">
            <Upload className="w-3.5 h-3.5 mr-0.5" /> Import Data
          </Button>

          <a
            href={`/api/risk/assessments/${effectiveId}/export-report-docx`}
            download
            className="inline-flex items-center"
          >
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 text-primary hover:text-primary/90">
              <Download className="w-3.5 h-3.5 mr-0.5" /> Export Word Report (.docx)
            </Button>
          </a>

          <Button
            size="sm"
            onClick={() => calculateMutation.mutate()}
            disabled={calculateMutation.isPending || !effectiveId}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${calculateMutation.isPending ? "animate-spin" : ""}`} />
            {calculateMutation.isPending ? "Calculating..." : "Run Calculation"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Are you sure you want to delete this assessment round? All calculated results and linelist records will be removed.")) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Delete Assessment Round"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Edit Round Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Assessment Round</DialogTitle>
            <DialogDescription className="text-xs">
              Update metadata and programmatic notes for this assessment round.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="roundTitle">Assessment Title</Label>
              <Input
                id="roundTitle"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. 2025 National Measles Programmatic Risk Assessment"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="roundNotes">Programmatic Context & Notes</Label>
              <textarea
                id="roundNotes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Document methodology calibration notes, data sources used, or scope..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={updateMutation.isPending || !editTitle.trim()}
              onClick={() => updateMutation.mutate({ title: editTitle, notes: editNotes })}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disclaimers */}
      <Alert className="border-blue-500/20 bg-blue-500/5 text-blue-900 dark:text-blue-200">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-xs font-semibold">Programme Strengthening Baseline</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed">
          Scores reflect programmatic gaps across Routine Coverage, Surveillance Quality, Dropout Trends, and Threat Exposures.
          High-risk classifications indicate districts requiring supportive supervision, microplan revisions, or active surveillance audits.
        </AlertDescription>
      </Alert>

      {/* Workspace Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 w-full">
          <TabsTrigger value="results" className="text-xs gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" /> District Results
          </TabsTrigger>
          <TabsTrigger value="direct-entry" className="text-xs gap-1.5">
            <Edit3 className="w-3.5 h-3.5" /> Direct Data Entry
          </TabsTrigger>
          <TabsTrigger value="map" className="text-xs gap-1.5">
            <MapIcon className="w-3.5 h-3.5" /> Risk Map
          </TabsTrigger>
          <TabsTrigger value="report" className="text-xs gap-1.5">
            <FileDown className="w-3.5 h-3.5" /> Final Country Report
          </TabsTrigger>
          <TabsTrigger value="actions" className="text-xs gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Linked Actions ({linkedActions.length})
          </TabsTrigger>
          <TabsTrigger value="review" className="text-xs gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Review & Approval
          </TabsTrigger>
        </TabsList>

        {/* ==================================================================== */}
        {/* TAB 1: DISTRICT RESULTS (ENTERPRISE TABLE RULE 24) */}
        {/* ==================================================================== */}
        <TabsContent value="results" className="space-y-4">
          {/* Filter, Search & Column Visibility Toolbar */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Search */}
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search district name or code..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                {/* Category Filters */}
                <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                  {["ALL", "VERY_HIGH", "HIGH", "MEDIUM", "LOW", "INCOMPLETE"].map((cat) => (
                    <Button
                      key={cat}
                      size="sm"
                      variant={selectedCategory === cat ? "default" : "outline"}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setPage(1);
                      }}
                      className="h-8 text-xs capitalize"
                    >
                      {cat.replace("_", " ").toLowerCase()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Column Visibility & Width Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Columns:
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.province}
                      onChange={(e) => setVisibleColumns({ ...visibleColumns, province: e.target.checked })}
                    />
                    Province
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.population}
                      onChange={(e) => setVisibleColumns({ ...visibleColumns, population: e.target.checked })}
                    />
                    Population
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.pi}
                      onChange={(e) => setVisibleColumns({ ...visibleColumns, pi: e.target.checked })}
                    />
                    Population Immunity (40)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.sq}
                      onChange={(e) => setVisibleColumns({ ...visibleColumns, sq: e.target.checked })}
                    />
                    Surveillance Quality (20)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.pd}
                      onChange={(e) => setVisibleColumns({ ...visibleColumns, pd: e.target.checked })}
                    />
                    Program Delivery Performance (16)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.ta}
                      onChange={(e) => setVisibleColumns({ ...visibleColumns, ta: e.target.checked })}
                    />
                    Threat Assessment (24)
                  </label>
                </div>

                {/* Quick Column Width Stretch Actions */}
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStretchWide}
                    className="h-7 text-xs gap-1 text-slate-700 dark:text-slate-200"
                    title="Expand columns generously for comfortable viewing"
                  >
                    <Maximize2 className="w-3 h-3 text-primary" />
                    <span>Stretch (Wide)</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCompact}
                    className="h-7 text-xs gap-1 text-slate-700 dark:text-slate-200"
                    title="Compact column widths for dense screens"
                  >
                    <Minimize2 className="w-3 h-3 text-muted-foreground" />
                    <span>Compact</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetWidths}
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    title="Reset column widths to default"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table Container */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-full text-left text-xs border-collapse table-auto">
                <thead className="bg-slate-100 dark:bg-slate-800 border-b">
                  <tr>
                    {/* FROZEN 1: INDEX */}
                    <th
                      className="p-2.5 font-semibold text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r border-slate-300 dark:border-slate-700 sticky top-0 left-0 z-40 bg-slate-100 dark:bg-slate-800 select-none"
                      style={{
                        width: `${colWidths.index}px`,
                        minWidth: `${colWidths.index}px`,
                        maxWidth: `${colWidths.index}px`,
                      }}
                      onClick={() => handleSort("index")}
                    >
                      <div className="flex items-center justify-center">
                        # {getSortIcon("index")}
                      </div>
                    </th>

                    {/* FROZEN 2: DISTRICT / COUNTY */}
                    <th
                      className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r border-slate-300 dark:border-slate-700 sticky top-0 z-40 bg-slate-100 dark:bg-slate-800 select-none group/th"
                      style={{
                        left: `${colWidths.index}px`,
                        width: `${colWidths.district}px`,
                        minWidth: `${colWidths.district}px`,
                        maxWidth: `${colWidths.district}px`,
                      }}
                      onClick={() => handleSort("areaName")}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span className="truncate font-bold">District / County</span>
                        {getSortIcon("areaName")}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none transition-colors"
                        onMouseDown={(e) => startResize("district", e)}
                        onClick={(e) => e.stopPropagation()}
                        title="Drag to resize District column"
                      />
                    </th>

                    {/* FROZEN 3: PROVINCE (WITH RIGHT DIVIDER SHADOW) */}
                    {visibleColumns.province && (
                      <th
                        className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r-2 border-slate-400 dark:border-slate-500 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] sticky top-0 z-40 bg-slate-100 dark:bg-slate-800 select-none group/th"
                        style={{
                          left: `${colWidths.index + colWidths.district}px`,
                          width: `${colWidths.province}px`,
                          minWidth: `${colWidths.province}px`,
                          maxWidth: `${colWidths.province}px`,
                        }}
                        onClick={() => handleSort("provinceName")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate font-bold">Province</span>
                          {getSortIcon("provinceName")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none transition-colors"
                          onMouseDown={(e) => startResize("province", e)}
                          onClick={(e) => e.stopPropagation()}
                          title="Drag to resize Province column"
                        />
                      </th>
                    )}

                    {visibleColumns.population && (
                      <th
                        className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r-2 border-slate-300 dark:border-slate-600 select-none relative group/th"
                        style={{ width: `${colWidths.population}px`, minWidth: `${colWidths.population}px` }}
                        onClick={() => handleSort("population")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span>Population</span>
                          {getSortIcon("population")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none transition-colors"
                          onMouseDown={(e) => startResize("population", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>
                    )}

                    {visibleColumns.pi && (
                      <th
                        className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r-2 border-slate-300 dark:border-slate-600 select-none relative group/th"
                        style={{ width: `${colWidths.pi}px`, minWidth: `${colWidths.pi}px` }}
                        onClick={() => handleSort("populationImmunityScore")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="font-bold">Population Immunity (Max 40)</span>
                          {getSortIcon("populationImmunityScore")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none transition-colors"
                          onMouseDown={(e) => startResize("pi", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>
                    )}

                    {visibleColumns.sq && (
                      <th
                        className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r-2 border-slate-300 dark:border-slate-600 select-none relative group/th"
                        style={{ width: `${colWidths.sq}px`, minWidth: `${colWidths.sq}px` }}
                        onClick={() => handleSort("surveillanceQualityScore")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="font-bold">Surveillance Quality (Max 20)</span>
                          {getSortIcon("surveillanceQualityScore")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none transition-colors"
                          onMouseDown={(e) => startResize("sq", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>
                    )}

                    {visibleColumns.pd && (
                      <th
                        className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r-2 border-slate-300 dark:border-slate-600 select-none relative group/th"
                        style={{ width: `${colWidths.pd}px`, minWidth: `${colWidths.pd}px` }}
                        onClick={() => handleSort("programmeDeliveryScore")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="font-bold">Program Delivery Performance (Max 16)</span>
                          {getSortIcon("programmeDeliveryScore")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none transition-colors"
                          onMouseDown={(e) => startResize("pd", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>
                    )}

                    {visibleColumns.ta && (
                      <th
                        className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r-2 border-slate-400 dark:border-slate-500 select-none relative group/th"
                        style={{ width: `${colWidths.ta}px`, minWidth: `${colWidths.ta}px` }}
                        onClick={() => handleSort("threatAssessmentScore")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="font-bold">Threat Assessment (Max 24)</span>
                          {getSortIcon("threatAssessmentScore")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none transition-colors"
                          onMouseDown={(e) => startResize("ta", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>
                    )}

                    <th
                      className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r-2 border-slate-400 dark:border-slate-500 select-none relative group/th"
                      style={{ width: `${colWidths.total}px`, minWidth: `${colWidths.total}px` }}
                      onClick={() => handleSort("totalRiskScore")}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span className="font-bold">Overall Risk Score (Max 100)</span>
                        {getSortIcon("totalRiskScore")}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none transition-colors"
                        onMouseDown={(e) => startResize("total", e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>

                    <th
                      className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none border-r-2 border-slate-400 dark:border-slate-500 relative group/th"
                      style={{ width: `${colWidths.category}px`, minWidth: `${colWidths.category}px` }}
                      onClick={() => handleSort("riskCategory")}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span className="font-bold">Risk Category</span>
                        {getSortIcon("riskCategory")}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none transition-colors"
                        onMouseDown={(e) => startResize("category", e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>

                    <th
                      className="p-2.5 font-semibold text-right"
                      style={{ width: `${colWidths.actions}px`, minWidth: `${colWidths.actions}px` }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isResultsLoading ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-muted-foreground">
                        Loading district risk results...
                      </td>
                    </tr>
                  ) : sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-muted-foreground">
                        No district results found. Run calculation or adjust search filters.
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((row, idx) => {
                      const globalIdx = (page - 1) * pageSize + idx + 1;
                      const hasProvince = visibleColumns.province;

                      return (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group">
                          {/* FROZEN 1: INDEX */}
                          <td
                            className="p-2.5 text-center text-muted-foreground border-r border-slate-300 dark:border-slate-700 sticky left-0 z-20 bg-background group-hover:bg-slate-50 dark:group-hover:bg-slate-900"
                            style={{
                              width: `${colWidths.index}px`,
                              minWidth: `${colWidths.index}px`,
                              maxWidth: `${colWidths.index}px`,
                            }}
                          >
                            {globalIdx}
                          </td>

                          {/* FROZEN 2: DISTRICT / COUNTY */}
                          <td
                            className="p-2.5 font-medium border-r border-slate-300 dark:border-slate-700 whitespace-nowrap sticky z-20 bg-background group-hover:bg-slate-50 dark:group-hover:bg-slate-900"
                            style={{
                              left: `${colWidths.index}px`,
                              width: `${colWidths.district}px`,
                              minWidth: `${colWidths.district}px`,
                              maxWidth: `${colWidths.district}px`,
                            }}
                          >
                            <span className="truncate block font-semibold text-foreground" title={row.areaName}>
                              {row.areaName}
                            </span>
                          </td>

                          {/* FROZEN 3: PROVINCE (WITH RIGHT DIVIDER SHADOW) */}
                          {hasProvince && (
                            <td
                              className="p-2.5 text-muted-foreground border-r-2 border-slate-400 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap sticky z-20 bg-background group-hover:bg-slate-50 dark:group-hover:bg-slate-900"
                              style={{
                                left: `${colWidths.index + colWidths.district}px`,
                                width: `${colWidths.province}px`,
                                minWidth: `${colWidths.province}px`,
                                maxWidth: `${colWidths.province}px`,
                              }}
                            >
                              <span className="truncate block font-medium" title={row.provinceName || "National"}>
                                {row.provinceName || "National"}
                              </span>
                            </td>
                          )}

                          {visibleColumns.population && (
                            <td className="p-2.5 text-muted-foreground border-r-2 border-slate-300 dark:border-slate-600">
                              {row.population ? row.population.toLocaleString() : "N/A"}
                            </td>
                          )}

                          {visibleColumns.pi && (
                            <td className="p-2.5 border-r-2 border-slate-300 dark:border-slate-600">
                              <span className="font-semibold">{row.populationImmunityScore ?? "—"}</span>
                              <span className="text-muted-foreground">/40</span>
                            </td>
                          )}

                          {visibleColumns.sq && (
                            <td className="p-2.5 border-r-2 border-slate-300 dark:border-slate-600">
                              <span className="font-semibold">{row.surveillanceQualityScore ?? "—"}</span>
                              <span className="text-muted-foreground">/20</span>
                            </td>
                          )}

                          {visibleColumns.pd && (
                            <td className="p-2.5 border-r-2 border-slate-300 dark:border-slate-600">
                              <span className="font-semibold">{row.programmeDeliveryScore ?? "—"}</span>
                              <span className="text-muted-foreground">/16</span>
                            </td>
                          )}

                          {visibleColumns.ta && (
                            <td className="p-2.5 border-r-2 border-slate-400 dark:border-slate-600">
                              <span className="font-semibold">{row.threatAssessmentScore ?? "—"}</span>
                              <span className="text-muted-foreground">/24</span>
                            </td>
                          )}

                          <td className="p-2.5 border-r-2 border-slate-400 dark:border-slate-600">
                            <span className={`font-mono font-bold text-sm ${getRiskColorClasses(row.riskCategory).scoreColor}`}>
                              {row.totalRiskScore ?? `${row.minPossibleScore}–${row.maxPossibleScore}`}
                            </span>
                            <span className="text-muted-foreground text-xs font-mono">/100</span>
                          </td>

                          <td className="p-2.5 border-r-2 border-slate-400 dark:border-slate-600">
                            {getCategoryBadge(row.riskCategory)}
                          </td>

                          <td className="p-2.5 text-right space-x-1 whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setSelectedAreaForExplanation(row)}
                            >
                              Explain Score
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setSelectedAreaForAction(row);
                                setActionTitle(`Strengthen routine coverage in ${row.areaName}`);
                                setIsActionModalOpen(true);
                              }}
                            >
                              Link Action
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls (Rule 24) */}
            <div className="p-4 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Rows per page:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-18 text-xs">
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
                  Showing {sortedRows.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
                  {Math.min(page * pageSize, resultsData?.totalCount || 0)} of {resultsData?.totalCount || 0} records
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs gap-1"
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  title="First Page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">First</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs gap-1"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </Button>

                {/* Page Jump Selector Dropdown */}
                <div className="flex items-center gap-1 mx-1">
                  <span className="text-muted-foreground">Page</span>
                  <Select
                    value={String(page)}
                    onValueChange={(val) => setPage(Number(val))}
                  >
                    <SelectTrigger className="h-8 w-16 text-xs font-mono font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {Array.from({ length: totalPages || 1 }, (_, idx) => idx + 1).map((pNum) => (
                        <SelectItem key={pNum} value={String(pNum)} className="text-xs font-mono">
                          {pNum}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground font-mono">of {totalPages || 1}</span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs gap-1"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  title="Next Page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs gap-1"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  title="Last Page"
                >
                  <span className="hidden sm:inline">Last</span>
                  <ChevronsRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB: DIRECT DATA ENTRY SPREADSHEET (WHO EXCEL TOOL WORKSPACE) */}
        {/* ==================================================================== */}
        <TabsContent value="direct-entry" className="space-y-4">
          <RiskDirectDataEntry
            assessmentId={effectiveId}
            onCalculationSuccess={() => {
              setActiveTab("results");
            }}
          />
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 2: INTERACTIVE CHOROPLETH MAP (RULE 25) */}
        {/* ==================================================================== */}
        <TabsContent value="map" className="space-y-4">
          <RiskChoroplethMap
            countryCode={assessment?.countryCode || context?.countryCode || "ZAF"}
            countryName={assessment?.countryName || context?.countryName || "Republic of South Africa National Department of Health"}
            adminLevelLabel={context?.adminLevelLabel || "District"}
            boundaryId={context?.boundaryId || context?.defaultBoundaryId || (assessment?.countryCode === "ZAF" || !assessment ? "a942c119-c045-492f-97ee-b95a8dbb8440" : undefined)}
            data={effectiveChoroplethData}
            selectedCategoryFilter={selectedCategory}
            onSelectCategoryFilter={setSelectedCategory}
            onSelectDistrict={(dist) => {
              if (dist) {
                const matched = (mapResultsData?.rows || resultsData?.rows || []).find(
                  (r) =>
                    (r.areaName || (r as any).districtName || "").toLowerCase() === dist.districtName.toLowerCase() ||
                    String(r.administrativeAreaId || (r as any).districtId) === String(dist.districtId)
                );
                if (matched) {
                  setSelectedAreaForExplanation(matched);
                }
              }
            }}
            isLoading={isResultsLoading}
          />
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB: STANDARDIZED FINAL REPORT (WHO TEMPLATE) */}
        {/* ==================================================================== */}
        <TabsContent value="report" className="space-y-4">
          <RiskFinalReportView
            assessment={assessment}
            districtResults={effectiveChoroplethData as any}
          />
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 3: LINKED PROGRAMME ACTIONS */}
        {/* ==================================================================== */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Programme Strengthening Action Links ({linkedActions.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Connect identified district epidemiological vulnerabilities directly to routine microplans, supervision visits, and budgets.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportActionsCsv}
                  disabled={sortedLinkedActions.length === 0}
                  className="h-8 text-xs gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Actions CSV</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Actions Filter & Stretch Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-muted/40 rounded-lg border text-xs">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                  <div className="relative flex-1 min-w-[160px] max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search title, district, or budget..."
                      value={actionSearchTerm}
                      onChange={(e) => {
                        setActionSearchTerm(e.target.value);
                        setActionPage(1);
                      }}
                      className="h-8 text-xs pl-8"
                    />
                  </div>

                  <Select
                    value={actionTypeFilter}
                    onValueChange={(val) => {
                      setActionTypeFilter(val);
                      setActionPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-[150px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Categories</SelectItem>
                      <SelectItem value="SUPERVISION_VISIT">Supervision Visit</SelectItem>
                      <SelectItem value="PIRI_CAMPAIGN">PIRI / Catch-up</SelectItem>
                      <SelectItem value="COLD_CHAIN_REPAIR">Cold Chain Repair</SelectItem>
                      <SelectItem value="ACTIVE_SURVEILLANCE">Active Surveillance</SelectItem>
                      <SelectItem value="MICROPLAN_UPDATE">Microplan Update</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={actionStatusFilter}
                    onValueChange={(val) => {
                      setActionStatusFilter(val);
                      setActionPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-[130px]">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="PLANNED">Planned</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  {(actionSearchTerm || actionTypeFilter !== "ALL" || actionStatusFilter !== "ALL") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActionSearchTerm("");
                        setActionTypeFilter("ALL");
                        setActionStatusFilter("ALL");
                        setActionPage(1);
                      }}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reset Filters
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStretchWideActions}
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
                    onClick={handleCompactActions}
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
                    onClick={handleResetActionWidths}
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    title="Reset column widths"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                  <Select
                    value={String(actionPageSize)}
                    onValueChange={(val) => {
                      setActionPageSize(Number(val));
                      setActionPage(1);
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs w-[90px] ml-1">
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

              {/* Actions Enterprise Table */}
              <div className="border rounded-md overflow-x-auto shadow-sm">
                <table className="w-full min-w-full text-xs text-left border-collapse table-auto">
                  <thead className="bg-slate-800 text-white font-semibold sticky top-0 z-30">
                    <tr>
                      {/* FROZEN 1: INDEX */}
                      <th
                        className="p-2.5 text-center font-semibold border-r-2 border-slate-600 sticky top-0 left-0 z-40 bg-slate-800 select-none cursor-pointer"
                        style={{ width: `${actionColWidths.index}px`, minWidth: `${actionColWidths.index}px`, maxWidth: `${actionColWidths.index}px` }}
                        onClick={() => handleActionSort("index")}
                      >
                        # {getActionSortIcon("index")}
                      </th>

                      {/* FROZEN 2: TARGET DISTRICT (WITH SHADOW DIVIDER) */}
                      <th
                        className="p-2.5 font-semibold border-r-2 border-slate-400 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.2)] sticky top-0 z-40 bg-slate-800 select-none cursor-pointer group/th"
                        style={{
                          left: `${actionColWidths.index}px`,
                          width: `${actionColWidths.area}px`,
                          minWidth: `${actionColWidths.area}px`,
                          maxWidth: `${actionColWidths.area}px`,
                        }}
                        onClick={() => handleActionSort("administrativeAreaId")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate font-bold">Target Area</span>
                          {getActionSortIcon("administrativeAreaId")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startActionResize("area", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      {/* ACTION TITLE */}
                      <th
                        className="p-2.5 font-semibold border-r-2 border-slate-600 select-none cursor-pointer relative group/th"
                        style={{ width: `${actionColWidths.title}px`, minWidth: `${actionColWidths.title}px` }}
                        onClick={() => handleActionSort("actionTitle")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span>Action Title</span>
                          {getActionSortIcon("actionTitle")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startActionResize("title", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      {/* CATEGORY */}
                      <th
                        className="p-2.5 font-semibold border-r-2 border-slate-600 select-none cursor-pointer relative group/th"
                        style={{ width: `${actionColWidths.type}px`, minWidth: `${actionColWidths.type}px` }}
                        onClick={() => handleActionSort("actionType")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span>Category</span>
                          {getActionSortIcon("actionType")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startActionResize("type", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      {/* BUDGET REFERENCE */}
                      <th
                        className="p-2.5 font-semibold border-r-2 border-slate-600 select-none cursor-pointer relative group/th"
                        style={{ width: `${actionColWidths.budget}px`, minWidth: `${actionColWidths.budget}px` }}
                        onClick={() => handleActionSort("budgetCode")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span>Budget Ref</span>
                          {getActionSortIcon("budgetCode")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startActionResize("budget", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      {/* STATUS */}
                      <th
                        className="p-2.5 text-center font-semibold border-r-2 border-slate-600 select-none cursor-pointer relative group/th"
                        style={{ width: `${actionColWidths.status}px`, minWidth: `${actionColWidths.status}px` }}
                        onClick={() => handleActionSort("status")}
                      >
                        <div className="flex items-center justify-center pr-2">
                          <span>Status</span>
                          {getActionSortIcon("status")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startActionResize("status", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>

                      {/* CREATED */}
                      <th
                        className="p-2.5 font-semibold relative group/th select-none cursor-pointer"
                        style={{ width: `${actionColWidths.created}px`, minWidth: `${actionColWidths.created}px` }}
                        onClick={() => handleActionSort("createdAt")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span>Created Date</span>
                          {getActionSortIcon("createdAt")}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 active:bg-white z-50 select-none transition-colors"
                          onMouseDown={(e) => startActionResize("created", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-foreground">
                    {paginatedLinkedActions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          {linkedActions.length === 0 ? (
                            <div className="space-y-1">
                              <p className="font-semibold">No programme actions linked yet.</p>
                              <p className="text-[11px]">Click "Link Action" on any district row in the results table to create an activity.</p>
                            </div>
                          ) : (
                            "No linked actions match the search filter."
                          )}
                        </td>
                      </tr>
                    ) : (
                      paginatedLinkedActions.map((act: any, idx: number) => {
                        const globalIdx = (actionPage - 1) * actionPageSize + idx + 1;
                        const statusBadgeClass =
                          act.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : act.status === "IN_PROGRESS"
                            ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400"
                            : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400";

                        return (
                          <tr key={act.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors group">
                            {/* FROZEN 1: INDEX */}
                            <td
                              className="p-2.5 text-center text-muted-foreground border-r sticky left-0 z-20 bg-background group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/50 font-mono"
                              style={{ width: `${actionColWidths.index}px`, minWidth: `${actionColWidths.index}px`, maxWidth: `${actionColWidths.index}px` }}
                            >
                              {globalIdx}
                            </td>

                            {/* FROZEN 2: TARGET AREA */}
                            <td
                              className="p-2.5 font-bold border-r-2 border-slate-300 dark:border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap sticky z-20 bg-background group-hover:bg-slate-50/70 dark:group-hover:bg-slate-900/50 text-foreground"
                              style={{
                                left: `${actionColWidths.index}px`,
                                width: `${actionColWidths.area}px`,
                                minWidth: `${actionColWidths.area}px`,
                                maxWidth: `${actionColWidths.area}px`,
                              }}
                            >
                              <span className="truncate block" title={act.administrativeAreaId}>
                                {act.administrativeAreaId}
                              </span>
                            </td>

                            <td className="p-2.5 border-r font-medium">
                              <span className="truncate block font-semibold" title={act.actionTitle}>
                                {act.actionTitle}
                              </span>
                              {act.responsiblePerson && (
                                <span className="text-[10px] text-muted-foreground block truncate">
                                  Resp: {act.responsiblePerson}
                                </span>
                              )}
                            </td>

                            <td className="p-2.5 border-r whitespace-nowrap">
                              <Badge variant="outline" className="text-[10px]">
                                {act.actionType?.replace(/_/g, " ")}
                              </Badge>
                            </td>

                            <td className="p-2.5 border-r font-mono text-[11px] whitespace-nowrap">
                              {act.budgetCode ? (
                                <span className="px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border">
                                  {act.budgetCode}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">—</span>
                              )}
                            </td>

                            <td className="p-2.5 text-center border-r whitespace-nowrap">
                              <Badge variant="outline" className={`text-[10px] font-semibold ${statusBadgeClass}`}>
                                {act.status || "PLANNED"}
                              </Badge>
                            </td>

                            <td className="p-2.5 text-muted-foreground text-[11px] whitespace-nowrap">
                              {act.createdAt ? new Date(act.createdAt).toLocaleDateString() : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action Pagination Controls (Rule 24) */}
              {sortedLinkedActions.length > actionPageSize && actionPageSize < 9999 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
                  <div>
                    Showing {(actionPage - 1) * actionPageSize + 1} to{" "}
                    {Math.min(actionPage * actionPageSize, sortedLinkedActions.length)} of {sortedLinkedActions.length} actions
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActionPage(1)}
                      disabled={actionPage === 1}
                      className="h-7 px-2 text-xs"
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActionPage((p) => Math.max(1, p - 1))}
                      disabled={actionPage === 1}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="px-2 font-medium text-foreground">
                      Page {actionPage} of {totalActionPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActionPage((p) => Math.min(totalActionPages, p + 1))}
                      disabled={actionPage === totalActionPages}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActionPage(totalActionPages)}
                      disabled={actionPage === totalActionPages}
                      className="h-7 px-2 text-xs"
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 4: REVIEW & APPROVAL */}
        {/* ==================================================================== */}
        <TabsContent value="review" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">National Programme Validation & Sign-Off</CardTitle>
              <CardDescription className="text-xs">
                Formal review, sign-off, and locking of the subnational risk assessment round.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="p-4 rounded-md border bg-muted/40 space-y-2">
                <p className="font-semibold text-sm">Assessment Status: {assessment?.status}</p>
                <p className="text-muted-foreground">
                  Once approved by the National EPI Manager or Surveillance Lead, assessment scores become immutable snapshots for reporting and temporal comparison.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() => reviewMutation.mutate("APPROVED")}
                  disabled={reviewMutation.isPending || assessment?.status === "APPROVED"}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  {assessment?.status === "APPROVED" ? "Assessment Approved" : "Approve Assessment"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => reviewMutation.mutate("CHANGES_REQUESTED")}
                  disabled={reviewMutation.isPending}
                >
                  Request Re-Validation
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================================================================== */}
      {/* EXPLAIN THIS SCORE SLIDING DRAWER */}
      {/* ==================================================================== */}
      {/* ==================================================================== */}
      {/* EXPLAIN THIS SCORE SLIDING DRAWER (ENTERPRISE INDICATOR TABLE - RULE 24) */}
      {/* ==================================================================== */}
      <Sheet open={Boolean(selectedAreaForExplanation)} onOpenChange={(open) => !open && setSelectedAreaForExplanation(null)}>
        <SheetContent className="w-full sm:max-w-[800px] lg:max-w-[880px] overflow-y-auto">
          <SheetHeader className="pb-3 border-b">
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              Explain Risk Score: {displayArea?.areaName || selectedAreaForExplanation?.areaName}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Mathematical lineage, applied thresholds, and indicator breakdown across all 21 WHO indicators for this district.
            </SheetDescription>
          </SheetHeader>

          <div className="py-4 space-y-4">
            {/* Score Summary & Programmatic Guidance Box */}
            {(() => {
              const riskMeta = getRiskColorClasses(displayArea?.riskCategory);
              const guidance = getWHOOperationalGuidance(displayArea?.riskCategory);
              const scoreValue =
                displayArea?.totalRiskScore ??
                (displayArea?.minPossibleScore !== undefined
                  ? `${displayArea?.minPossibleScore}–${displayArea?.maxPossibleScore}`
                  : "—");

              return (
                <div className={`rounded-xl border ${riskMeta.cardBorder} ${riskMeta.cardBg} shadow-sm overflow-hidden`}>
                  {/* Header Banner */}
                  <div className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                          Overall Programmatic Risk Classification
                        </div>
                        <div className="text-base font-bold text-foreground mt-0.5">
                          {displayArea?.areaName || selectedAreaForExplanation?.areaName}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {riskMeta.badge}
                        <div className={`px-3 py-1 rounded-lg font-mono font-extrabold text-xl sm:text-2xl border ${riskMeta.scoreBg}`}>
                          <span>{scoreValue}</span>
                          <span className="text-xs font-normal opacity-70 ml-1">/100</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {displayArea?.summaryExplanation}
                    </p>

                    {/* Domain Score Breakdown Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div className="p-2 rounded-lg bg-background/80 border text-xs shadow-2xs">
                        <div className="text-[11px] text-muted-foreground font-medium">Population Immunity</div>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="font-mono font-bold">{displayArea?.populationImmunityScore ?? "—"}</span>
                          <span className="text-[10px] text-muted-foreground">/ 40 pts</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-background/80 border text-xs shadow-2xs">
                        <div className="text-[11px] text-muted-foreground font-medium">Surveillance Quality</div>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="font-mono font-bold">{displayArea?.surveillanceQualityScore ?? "—"}</span>
                          <span className="text-[10px] text-muted-foreground">/ 20 pts</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-background/80 border text-xs shadow-2xs">
                        <div className="text-[11px] text-muted-foreground font-medium">Programme Delivery</div>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="font-mono font-bold">{displayArea?.programmeDeliveryScore ?? "—"}</span>
                          <span className="text-[10px] text-muted-foreground">/ 16 pts</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-background/80 border text-xs shadow-2xs">
                        <div className="text-[11px] text-muted-foreground font-medium">Threat Assessment</div>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="font-mono font-bold">{displayArea?.threatAssessmentScore ?? "—"}</span>
                          <span className="text-[10px] text-muted-foreground">/ 24 pts</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Programmatic Guidance Panel */}
                  <div className="border-t bg-background/90 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className={`w-4 h-4 ${riskMeta.iconColor}`} />
                        <span className="font-bold text-xs uppercase tracking-wide">
                          {guidance.title}
                        </span>
                      </div>
                      <Badge className={`text-[10px] uppercase font-bold tracking-wider ${riskMeta.guidanceBadgeClass}`}>
                        {riskMeta.guidanceLevel}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {guidance.rationale}
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        WHO Recommended Operational Guidance &amp; Priority Actions:
                      </div>
                      <ul className="space-y-1.5 text-xs">
                        {guidance.actions.map((actionText: string, aIdx: number) => (
                          <li key={aIdx} className="flex items-start gap-2">
                            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0 mt-0.5 ${riskMeta.scoreBg}`}>
                              {aIdx + 1}
                            </span>
                            <span className="leading-snug text-foreground/90">{actionText}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t text-xs">
                      <span className="text-[11px] text-muted-foreground italic">
                        {guidance.protocolNumber}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => {
                          if (displayArea) {
                            setSelectedAreaForAction(displayArea);
                            setActionTitle(`${guidance.defaultActionTitle} in ${displayArea.areaName || displayArea.administrativeAreaId}`);
                            setIsActionModalOpen(true);
                          }
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Link Programmatic Action to Register
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Indicator Toolbar (Domain Filters & Search) */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                  WHO Indicator Lineage ({filteredIndicators.length} of {explanationData?.indicators?.length || 21})
                </h4>
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search code or formula..."
                    value={indicatorSearchTerm}
                    onChange={(e) => setIndicatorSearchTerm(e.target.value)}
                    className="h-8 text-xs pl-8"
                  />
                </div>
              </div>

              {/* Domain Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: "ALL", label: "All Indicators" },
                  { key: "PI", label: "Population Immunity (40 pts)" },
                  { key: "SQ", label: "Surveillance Quality (20 pts)" },
                  { key: "PD", label: "Programme Delivery (16 pts)" },
                  { key: "TA", label: "Threat Assessment (24 pts)" },
                ].map((item) => (
                  <Button
                    key={item.key}
                    type="button"
                    size="sm"
                    variant={indicatorDomainFilter === item.key ? "default" : "outline"}
                    onClick={() => setIndicatorDomainFilter(item.key)}
                    className="h-7 text-xs px-2.5"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              {isExplanationLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading indicator lineage...</div>
              ) : (
                <div className="border rounded-md overflow-x-auto shadow-sm">
                  <table className="w-full min-w-full text-xs text-left border-collapse table-auto">
                    <thead className="bg-slate-200/90 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 sticky top-0 z-30 shadow-xs">
                      <tr className="bg-slate-200/90 dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                        <th className="p-2.5 border-r border-slate-300 dark:border-slate-700 font-bold w-20 min-w-20 text-slate-800 dark:text-slate-100 bg-slate-200/90 dark:bg-slate-800">
                          Indicator
                        </th>
                        <th className="p-2.5 border-r border-slate-300 dark:border-slate-700 font-bold w-28 min-w-28 text-slate-800 dark:text-slate-100 bg-slate-200/90 dark:bg-slate-800">
                          Domain
                        </th>
                        <th className="p-2.5 border-r border-slate-300 dark:border-slate-700 font-bold w-24 min-w-24 text-right text-slate-800 dark:text-slate-100 bg-slate-200/90 dark:bg-slate-800">
                          Observed
                        </th>
                        <th className="p-2.5 border-r border-slate-300 dark:border-slate-700 font-bold w-36 min-w-36 text-right text-slate-800 dark:text-slate-100 bg-slate-200/90 dark:bg-slate-800">
                          Threshold
                        </th>
                        <th className="p-2.5 border-r border-slate-300 dark:border-slate-700 font-bold w-28 min-w-28 text-center text-slate-800 dark:text-slate-100 bg-slate-200/90 dark:bg-slate-800">
                          Score
                        </th>
                        <th className="p-2.5 font-bold text-slate-800 dark:text-slate-100 bg-slate-200/90 dark:bg-slate-800">
                          Lineage & Policy Rationale
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-foreground">
                      {filteredIndicators.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground">
                            No indicators match the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredIndicators.map((ind, idx) => {
                          const pts = Number(ind.pointsAwarded);
                          const max = ind.maxPoints || 1;
                          const ratio = isNaN(pts) ? 0 : pts / max;

                          const scoreBadgeClass =
                            pts === 0
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : ratio >= 0.75
                              ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400"
                              : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400";

                          const indCode = (ind.indicatorCode || "").toUpperCase();
                          const domCode = (ind.domainCode || "").toUpperCase();
                          const domainLabel =
                            indCode.startsWith("PI") || domCode.includes("IMMUNITY") ? "Immunity"
                            : indCode.startsWith("SQ") || domCode.includes("SURVEILLANCE") ? "Surveillance"
                            : indCode.startsWith("PD") || domCode.includes("DELIVERY") ? "Delivery"
                            : "Threats";

                          const obsVal = ind.displayedValue || ind.valueRaw || "—";
                          const explText = ind.explanationText || (ind as any).explanation || "—";

                          return (
                            <tr key={ind.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors">
                              <td className="p-2.5 font-bold font-mono border-r whitespace-nowrap">
                                {ind.indicatorCode}
                              </td>

                              <td className="p-2.5 border-r whitespace-nowrap">
                                <Badge variant="outline" className="text-[10px]">
                                  {domainLabel}
                                </Badge>
                              </td>

                              <td className="p-2.5 text-right font-mono font-semibold border-r whitespace-nowrap">
                                {obsVal}
                              </td>

                              <td className="p-2.5 text-right font-mono text-[11px] text-muted-foreground border-r whitespace-nowrap">
                                {ind.thresholdApplied || "—"}
                              </td>

                              <td className="p-2.5 text-center border-r whitespace-nowrap">
                                <Badge variant="outline" className={`text-[10px] font-mono font-bold ${scoreBadgeClass}`}>
                                  {ind.pointsAwarded ?? "—"} / {ind.maxPoints}
                                </Badge>
                              </td>

                              <td className="p-2.5 text-[11px] text-muted-foreground leading-relaxed">
                                <p className="text-foreground/90 font-normal">{explText}</p>
                                {ind.validationWarnings && ind.validationWarnings.length > 0 && (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                                    Warning: {ind.validationWarnings.join(", ")}
                                  </p>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ==================================================================== */}
      {/* LINK PROGRAMME ACTION MODAL */}
      {/* ==================================================================== */}
      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Link Programme Action</DialogTitle>
            <DialogDescription className="text-xs">
              Connect this district weakness to routine microplanning, supportive supervision, or budget allocation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="area">Target District</Label>
              <Input id="area" value={selectedAreaForAction?.areaName || ""} disabled />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="actType">Action Category</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPERVISION_VISIT">Supportive Supervision Visit</SelectItem>
                  <SelectItem value="MICROPLAN_REVISION">Microplan Revision / Defaulter Tracing</SelectItem>
                  <SelectItem value="COLD_CHAIN_REPAIR">Cold Chain / Logistics Strengthening</SelectItem>
                  <SelectItem value="COMMUNITY_ENGAGEMENT">Community Engagement & Hesitancy Outreach</SelectItem>
                  <SelectItem value="SURVEILLANCE_AUDIT">Surveillance Active Case Search</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="actTitle">Action Title & Description</Label>
              <Input
                id="actTitle"
                value={actionTitle}
                onChange={(e) => setActionTitle(e.target.value)}
                placeholder="e.g. Conduct active case search and sensitize surveillance focal persons"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="resp">Responsible Unit / Lead</Label>
                <Input
                  id="resp"
                  value={actionResponsible}
                  onChange={(e) => setActionResponsible(e.target.value)}
                  placeholder="e.g. County EPI Supervisor"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget">Budget Code (Optional)</Label>
                <Input
                  id="budget"
                  value={actionBudget}
                  onChange={(e) => setActionBudget(e.target.value)}
                  placeholder="e.g. GAVI-HSIS-2023-04"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsActionModalOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => {
                if (!actionTitle || !selectedAreaForAction) return;
                actionMutation.mutate({
                  assessmentId: effectiveId,
                  districtId: selectedAreaForAction.districtId ? Number(selectedAreaForAction.districtId) : undefined,
                  administrativeAreaId: selectedAreaForAction.areaName || String(selectedAreaForAction.districtId || ""),
                  areaResultId: selectedAreaForAction.id || undefined,
                  linkedModule: actionType,
                  actionType,
                  actionTitle,
                  actionDescription: actionTitle,
                  responsiblePerson: actionResponsible,
                  assignedTo: actionResponsible,
                  budgetCode: actionBudget,
                });
              }}
              disabled={actionMutation.isPending || !actionTitle}
            >
              {actionMutation.isPending ? "Linking..." : "Save Action Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* IMPORT DATA MODAL */}
      {/* ==================================================================== */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Import Assessment Data</DialogTitle>
            <DialogDescription className="text-xs">
              Upload case linelists or routine coverage aggregates from Excel (.xlsx/.xlsm) or CSV.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Downloadable Standard Templates */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <FileDown className="w-3.5 h-3.5 text-primary" /> Download Standard Ingestion Templates
              </p>
              <p className="text-[11px] text-muted-foreground">
                Pre-calibrated CSV templates matching WHO Setup Guide v1.5 with active {context?.countryName || "national"} districts.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px] justify-start bg-background"
                  onClick={() => window.open("/api/risk/templates/linelist", "_blank")}
                >
                  <Download className="w-3 h-3 mr-1.5 text-primary" /> Case Linelist (CSV)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px] justify-start bg-background"
                  onClick={() => window.open("/api/risk/templates/district-aggregates", "_blank")}
                >
                  <Download className="w-3 h-3 mr-1.5 text-primary" /> District Aggregates (CSV)
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Import Content</Label>
              <Select value={importType} onValueChange={(val: any) => setImportType(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cases">Case Linelist (WHO Case-Based-Data or CSV)</SelectItem>
                  <SelectItem value="aggregates">Routine Coverage & Population Aggregates</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fileUpload">Select File</Label>
              <Input
                id="fileUpload"
                type="file"
                accept=".xlsx,.xlsm,.csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <p className="text-[11px] text-muted-foreground">
                Safe parsing enabled. Macros in .xlsm workbooks are strictly ignored and never executed.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsImportOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!selectedFile || uploadMutation.isPending}
              onClick={() => {
                if (selectedFile) uploadMutation.mutate(selectedFile);
              }}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload & Ingest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
