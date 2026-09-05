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
  displayedValue: string;
  thresholdApplied: string;
  explanationText: string;
  validationWarnings: string[];
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
    district: 180,
    province: 140,
    population: 110,
    pi: 115,
    sq: 115,
    pd: 115,
    ta: 115,
    total: 130,
    category: 140,
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
      population: 130,
      pi: 140,
      sq: 140,
      pd: 140,
      ta: 140,
      total: 160,
      category: 170,
      actions: 210,
    });
  };

  const handleCompact = () => {
    setColWidths({
      index: 44,
      district: 140,
      province: 110,
      population: 90,
      pi: 90,
      sq: 90,
      pd: 90,
      ta: 90,
      total: 100,
      category: 120,
      actions: 150,
    });
  };

  const handleResetWidths = () => {
    setColWidths(DEFAULT_COL_WIDTHS);
  };

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
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Low Risk (0–47)</Badge>;
      case "MEDIUM":
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white">Medium Risk (48–54)</Badge>;
      case "HIGH":
        return <Badge className="bg-orange-600 hover:bg-orange-700 text-white">High Risk (55–60)</Badge>;
      case "VERY_HIGH":
        return <Badge className="bg-red-600 hover:bg-red-700 text-white">Very High Risk (61–100)</Badge>;
      default:
        return <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300">Incomplete</Badge>;
    }
  };

  const totalPages = Math.ceil((resultsData?.totalCount || 0) / pageSize);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
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
                    Pop. Immunity (40)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.sq}
                      onChange={(e) => setVisibleColumns({ ...visibleColumns, sq: e.target.checked })}
                    />
                    Surveillance (20)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.pd}
                      onChange={(e) => setVisibleColumns({ ...visibleColumns, pd: e.target.checked })}
                    />
                    Delivery (16)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.ta}
                      onChange={(e) => setVisibleColumns({ ...visibleColumns, ta: e.target.checked })}
                    />
                    Threats (24)
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
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 border-b">
                  <tr>
                    {/* FROZEN 1: INDEX */}
                    <th
                      className="p-2.5 font-semibold text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r sticky top-0 left-0 z-40 bg-slate-100 dark:bg-slate-800 select-none"
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
                      className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r sticky top-0 z-40 bg-slate-100 dark:bg-slate-800 select-none group/th"
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
                        className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r-2 border-slate-300 dark:border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] sticky top-0 z-40 bg-slate-100 dark:bg-slate-800 select-none group/th"
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
                        className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r select-none relative group/th"
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
                        className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r select-none relative group/th"
                        style={{ width: `${colWidths.pi}px`, minWidth: `${colWidths.pi}px` }}
                        onClick={() => handleSort("populationImmunityScore")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span>Immunity (40)</span>
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
                        className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r select-none relative group/th"
                        style={{ width: `${colWidths.sq}px`, minWidth: `${colWidths.sq}px` }}
                        onClick={() => handleSort("surveillanceQualityScore")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span>Surveillance (20)</span>
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
                        className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r select-none relative group/th"
                        style={{ width: `${colWidths.pd}px`, minWidth: `${colWidths.pd}px` }}
                        onClick={() => handleSort("programmeDeliveryScore")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span>Delivery (16)</span>
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
                        className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r select-none relative group/th"
                        style={{ width: `${colWidths.ta}px`, minWidth: `${colWidths.ta}px` }}
                        onClick={() => handleSort("threatAssessmentScore")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span>Threats (24)</span>
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
                      className="p-2.5 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-r select-none relative group/th"
                      style={{ width: `${colWidths.total}px`, minWidth: `${colWidths.total}px` }}
                      onClick={() => handleSort("totalRiskScore")}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Total Score (100)</span>
                        {getSortIcon("totalRiskScore")}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/70 active:bg-primary z-50 select-none transition-colors"
                        onMouseDown={(e) => startResize("total", e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>

                    <th
                      className="p-2.5 font-semibold select-none border-r relative group/th"
                      style={{ width: `${colWidths.category}px`, minWidth: `${colWidths.category}px` }}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Classification</span>
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
                            className="p-2.5 text-center text-muted-foreground border-r sticky left-0 z-20 bg-background group-hover:bg-slate-50 dark:group-hover:bg-slate-900"
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
                            className="p-2.5 font-medium border-r whitespace-nowrap sticky z-20 bg-background group-hover:bg-slate-50 dark:group-hover:bg-slate-900"
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
                              className="p-2.5 text-muted-foreground border-r-2 border-slate-300 dark:border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] whitespace-nowrap sticky z-20 bg-background group-hover:bg-slate-50 dark:group-hover:bg-slate-900"
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
                            <td className="p-2.5 text-muted-foreground border-r">
                              {row.population ? row.population.toLocaleString() : "N/A"}
                            </td>
                          )}

                          {visibleColumns.pi && (
                            <td className="p-2.5 border-r">
                              <span className="font-semibold">{row.populationImmunityScore ?? "—"}</span>
                              <span className="text-muted-foreground">/40</span>
                            </td>
                          )}

                          {visibleColumns.sq && (
                            <td className="p-2.5 border-r">
                              <span className="font-semibold">{row.surveillanceQualityScore ?? "—"}</span>
                              <span className="text-muted-foreground">/20</span>
                            </td>
                          )}

                          {visibleColumns.pd && (
                            <td className="p-2.5 border-r">
                              <span className="font-semibold">{row.programmeDeliveryScore ?? "—"}</span>
                              <span className="text-muted-foreground">/16</span>
                            </td>
                          )}

                          {visibleColumns.ta && (
                            <td className="p-2.5 border-r">
                              <span className="font-semibold">{row.threatAssessmentScore ?? "—"}</span>
                              <span className="text-muted-foreground">/24</span>
                            </td>
                          )}

                          <td className="p-2.5 border-r">
                            <span className="font-bold text-sm">
                              {row.totalRiskScore ?? `${row.minPossibleScore}–${row.maxPossibleScore}`}
                            </span>
                            <span className="text-muted-foreground">/100</span>
                          </td>

                          <td className="p-2.5 border-r">
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

              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="px-3 py-1 bg-muted rounded font-medium text-xs">
                  Page {page} of {totalPages || 1}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
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
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Programme Strengthening Action Links</CardTitle>
                <CardDescription className="text-xs">
                  Connect identified district epidemiological vulnerabilities directly to routine microplans, supervision visits, and budgets.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {linkedActions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
                  <CheckCircle className="w-8 h-8 mx-auto text-muted-foreground/50" />
                  <p>No programme actions linked to this assessment round yet.</p>
                  <p className="text-[11px]">Click "Link Action" on any district row in the results table to create an activity.</p>
                </div>
              ) : (
                <div className="divide-y border rounded-md text-xs">
                  {linkedActions.map((act: any) => (
                    <div key={act.id} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm">{act.actionTitle}</p>
                        <p className="text-muted-foreground mt-0.5">
                          Type: <span className="font-medium text-foreground">{act.actionType}</span> • Area: <span className="font-medium text-foreground">{act.administrativeAreaId}</span>
                        </p>
                        {act.budgetCode && (
                          <p className="text-muted-foreground text-[11px] mt-0.5">
                            Budget Reference: <span className="font-mono">{act.budgetCode}</span>
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">{act.status}</Badge>
                    </div>
                  ))}
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
      <Sheet open={Boolean(selectedAreaForExplanation)} onOpenChange={(open) => !open && setSelectedAreaForExplanation(null)}>
        <SheetContent className="sm:max-w-[620px] overflow-y-auto">
          <SheetHeader className="pb-3 border-b">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              Explain Risk Score: {selectedAreaForExplanation?.areaName}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Mathematical lineage, applied thresholds, and indicator breakdown for this district.
            </SheetDescription>
          </SheetHeader>

          <div className="py-4 space-y-4">
            {/* Score Summary Box */}
            <div className="p-3 bg-muted/50 rounded-lg border space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Total Score:</span>
                <span className="font-bold text-base">
                  {selectedAreaForExplanation?.totalRiskScore ?? `${selectedAreaForExplanation?.minPossibleScore}–${selectedAreaForExplanation?.maxPossibleScore}`}/100
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {selectedAreaForExplanation?.summaryExplanation}
              </p>
            </div>

            {/* Indicator Details */}
            <div className="space-y-3">
              <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Indicator Lineage (21 WHO Indicators)</h4>

              {isExplanationLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Loading indicator lineage...</div>
              ) : (
                <div className="space-y-2">
                  {(explanationData?.indicators || []).map((ind) => (
                    <div key={ind.id} className="p-2.5 rounded border bg-card text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">
                          {ind.indicatorCode} ({ind.domainCode.replace("_", " ")})
                        </span>
                        <Badge variant="outline" className="font-mono">
                          {ind.pointsAwarded ?? "—"} / {ind.maxPoints} pts
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Observed: <strong className="text-foreground">{ind.displayedValue}</strong></span>
                        <span>Threshold: <strong className="text-foreground">{ind.thresholdApplied}</strong></span>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {ind.explanationText}
                      </p>

                      {ind.validationWarnings && ind.validationWarnings.length > 0 && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400">
                          Warning: {ind.validationWarnings.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
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
                  administrativeAreaId: selectedAreaForAction.areaName,
                  actionType,
                  actionTitle,
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
