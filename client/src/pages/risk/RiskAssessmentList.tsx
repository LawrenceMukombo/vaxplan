import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ShieldAlert,
  Activity,
  Plus,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  MapPin,
  Search,
  Filter,
  Download,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  BookOpen,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { loadActiveTenant } from "@/lib/tenantCache";
import { RiskChoroplethMap, type DistrictCoveragePerformance } from "@/components/risk/RiskChoroplethMap";

interface RiskAssessmentItem {
  id: string;
  countryCode: string;
  title: string;
  assessmentYear: number;
  status: "DRAFT" | "IMPORTING" | "VALIDATION_REQUIRED" | "READY_TO_CALCULATE" | "CALCULATING" | "CALCULATED" | "UNDER_REVIEW" | "APPROVED" | "SUPERSEDED";
  administrativeLevelName: string;
  approvedAt?: string | null;
  createdAt: string;
}

interface RiskContextData {
  tenantId: string;
  countryCode: string;
  countryName: string;
  adminLevelLabel: string;
  adminLevelLabelPlural: string;
  districtsCount: number;
  boundaryId: string | null;
  boundaryFeatureCount: number;
  districts: Array<{ id: number; name: string; code: string; provinceId: number | null }>;
}

export default function RiskAssessmentList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"overview" | "table" | "rounds" | "guidance">("overview");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictCoveragePerformance | null>(null);

  // Read active tenant from cache as initial fallback
  const cachedTenant = useMemo(() => loadActiveTenant(), []);

  // Queries
  const { data: activeTenant } = useQuery<any>({
    queryKey: ["/api/me/tenant"],
  });

  const { data: context, isLoading: isContextLoading } = useQuery<RiskContextData>({
    queryKey: ["/api/risk/context"],
  });

  const { data: coverageData, isLoading: isCoverageLoading } = useQuery<{
    districtsCount: number;
    latestRunId: string | null;
    performance: DistrictCoveragePerformance[];
  }>({
    queryKey: ["/api/risk/coverage-performance"],
  });

  const { data: assessments = [], isLoading: isAssessmentsLoading } = useQuery<RiskAssessmentItem[]>({
    queryKey: ["/api/risk/assessments"],
  });

  // Effective Country Identity
  const activeCountryCode = context?.countryCode || activeTenant?.countryCode || cachedTenant?.countryCode || "ZAF";
  const activeCountryName = context?.countryName || activeTenant?.name || cachedTenant?.name || "Republic of South Africa";
  const adminLevel = context?.adminLevelLabel || (activeCountryCode === "SSD" ? "County" : "District");
  const adminLevelPlural = context?.adminLevelLabelPlural || (activeCountryCode === "SSD" ? "Counties" : "Districts");
  const totalUnitsCount = context?.districtsCount || coverageData?.districtsCount || 0;

  // Form State for New Assessment
  const [title, setTitle] = useState(`${new Date().getFullYear()} Measles Programmatic Risk Assessment`);
  const [assessmentYear, setAssessmentYear] = useState(new Date().getFullYear());
  const [formCountryCode, setFormCountryCode] = useState(activeCountryCode);
  const [formAdminLevel, setFormAdminLevel] = useState(adminLevel);

  useEffect(() => {
    if (activeCountryCode) {
      setFormCountryCode(activeCountryCode);
      setFormAdminLevel(adminLevel);
      setTitle(`${assessmentYear} ${activeCountryCode} Measles Programmatic Risk Assessment`);
    }
  }, [activeCountryCode, adminLevel, assessmentYear]);

  // Enterprise Table State (Rule 24)
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [sortColumn, setSortColumn] = useState<keyof DistrictCoveragePerformance>("districtName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    province: true,
    mcv1: true,
    mcv2: true,
    dropout: true,
    suspectedCases: true,
    riskScore: true,
    riskCategory: true,
  });

  // Create Mutation with robust error handling
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest<RiskAssessmentItem>("POST", "/api/risk/assessments", payload);
    },
    onSuccess: (newAssessment) => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk/assessments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/risk/coverage-performance"] });
      setIsCreateOpen(false);
      toast({
        title: "Assessment Round Created",
        description: `Assessment "${newAssessment.title}" created successfully for ${activeCountryName}.`,
      });
      setLocation(`/risk-assessments/${newAssessment.id}`);
    },
    onError: (err: any) => {
      toast({
        title: "Creation Failed",
        description: err.message || "Failed to create assessment round. Please check server logs.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      title,
      assessmentYear: Number(assessmentYear),
      countryCode: formCountryCode,
      administrativeLevelName: formAdminLevel,
      methodologyVersionId: "WHO_MEASLES_GLOBAL_RECONCILED_V1",
    });
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case "CALCULATED":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white"><Activity className="w-3 h-3 mr-1" /> Calculated</Badge>;
      case "UNDER_REVIEW":
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white"><Clock className="w-3 h-3 mr-1" /> Under Review</Badge>;
      case "READY_TO_CALCULATE":
        return <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white">Ready to Calculate</Badge>;
      case "VALIDATION_REQUIRED":
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Issues Detected</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  // Filter & Sort Table Rows (Rule 24)
  const filteredPerformanceRows = useMemo(() => {
    let rows = coverageData?.performance || [];

    if (selectedCategoryFilter !== "ALL") {
      rows = rows.filter((r) => r.riskCategory === selectedCategoryFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.districtName.toLowerCase().includes(q) ||
          r.provinceName.toLowerCase().includes(q) ||
          String(r.districtId).includes(q)
      );
    }

    return [...rows].sort((a, b) => {
      const valA = a[sortColumn];
      const valB = b[sortColumn];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }
      return sortDirection === "asc"
        ? String(valA || "").localeCompare(String(valB || ""))
        : String(valB || "").localeCompare(String(valA || ""));
    });
  }, [coverageData, selectedCategoryFilter, searchTerm, sortColumn, sortDirection]);

  // Paginated Rows
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPerformanceRows.slice(start, start + pageSize);
  }, [filteredPerformanceRows, page, pageSize]);

  const totalPages = Math.ceil(filteredPerformanceRows.length / pageSize) || 1;

  const handleSort = (col: keyof DistrictCoveragePerformance) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (col: keyof DistrictCoveragePerformance) => {
    if (sortColumn !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 text-muted-foreground/60" />;
    return sortDirection === "asc" ? <ChevronUp className="w-3 h-3 ml-1 text-primary" /> : <ChevronDown className="w-3 h-3 ml-1 text-primary" />;
  };

  const exportTableCSV = () => {
    if (!filteredPerformanceRows.length) return;
    const headers = ["District ID", "District Name", "Province", "MCV1 Coverage %", "MCV2 Coverage %", "Penta1-MCV1 Dropout %", "Suspected Measles Cases", "Risk Score", "Risk Category"];
    const csvContent = [
      headers.join(","),
      ...filteredPerformanceRows.map((r) =>
        [
          r.districtId,
          `"${r.districtName}"`,
          `"${r.provinceName}"`,
          r.mcv1Coverage,
          r.mcv2Coverage,
          r.dropoutRate,
          r.suspectedCases,
          r.riskScore,
          r.riskCategory,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeCountryCode}_district_coverage_risk_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldAlert className="w-8 h-8 text-primary" />
              VPD Programmatic Risk Assessment
            </h1>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              WHO Aligned
            </Badge>
            <Badge variant="secondary" className="text-xs font-semibold">
              {activeCountryName} ({activeCountryCode})
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs md:text-sm mt-1">
            Subnational programmatic vulnerability scoring, surveillance sensitivity audits, and immunization microplan strengthening across {totalUnitsCount} {adminLevelPlural.toLowerCase()}.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shrink-0">
                <Plus className="w-4 h-4" />
                New Risk Assessment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Create Assessment Round</DialogTitle>
                  <DialogDescription>
                    Configure a new subnational programmatic risk assessment round for {activeCountryName}.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="methodology">Assessment Methodology</Label>
                    <Select defaultValue="WHO_MEASLES_GLOBAL_RECONCILED_V1">
                      <SelectTrigger>
                        <SelectValue placeholder="Select methodology" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WHO_MEASLES_GLOBAL_RECONCILED_V1">
                          WHO Measles Programmatic Risk Assessment (Reconciled V1.0)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Supported 21 indicators covering Population Immunity (40 pts), Surveillance Quality (20 pts), Programme Delivery (16 pts), and Threat Assessment (24 pts).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Round Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="year">Assessment Year</Label>
                      <Input
                        id="year"
                        type="number"
                        min={2020}
                        max={2030}
                        value={assessmentYear}
                        onChange={(e) => setAssessmentYear(Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Select value={formCountryCode} onValueChange={setFormCountryCode}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ZAF">South Africa (ZAF)</SelectItem>
                          <SelectItem value="SSD">South Sudan (SSD)</SelectItem>
                          <SelectItem value="ZMB">Zambia (ZMB)</SelectItem>
                          <SelectItem value="PNG">Papua New Guinea (PNG)</SelectItem>
                          <SelectItem value="KEN">Kenya (KEN)</SelectItem>
                          <SelectItem value="BWA">Botswana (BWA)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminLevel">Assessment Unit Label</Label>
                    <Select value={formAdminLevel} onValueChange={setFormAdminLevel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="District">District (Admin Level 2)</SelectItem>
                        <SelectItem value="County">County (Admin Level 2)</SelectItem>
                        <SelectItem value="Sub-County">Sub-County (Admin Level 2)</SelectItem>
                        <SelectItem value="Municipality">Municipality (Admin Level 2)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Assessment"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Public Health / WHO Policy Guideline Alert */}
      <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200">
        <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <div>
          <AlertTitle className="font-semibold text-sm">Public Health Decision-Making Guidance</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed mt-1">
            This module is designed exclusively for <strong>immunization programme strengthening</strong> and identifying operational vulnerabilities in routine coverage and disease surveillance.
            In accordance with the <em>WHO Measles Programmatic Risk Assessment Technical Appendix</em>, findings <strong>must not be interpreted as predictive forecasts</strong> that an outbreak will occur, nor can risk scores alone be used to automatically recommend, approve, or schedule Supplementary Immunization Activities (SIAs).
          </AlertDescription>
        </div>
      </Alert>

      {/* Dynamic Geographic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Active Rounds</CardDescription>
            <CardTitle className="text-2xl font-bold">{assessments.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Multi-year national assessment rounds
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Active Methodology</CardDescription>
            <CardTitle className="text-sm font-bold truncate">WHO Measles Reconciled V1.0</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            21 standardized WHO indicators
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Assessment Units</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {totalUnitsCount} {adminLevelPlural}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {activeCountryName} • Level 2 Boundaries
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Routine Integration</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Connected</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Linked to microplans & supervision
          </CardContent>
        </Card>
      </div>

      {/* Main Module Tabs */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <Layers className="w-3.5 h-3.5" />
            Coverage Map & Analytics
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-1.5 text-xs">
            <Activity className="w-3.5 h-3.5" />
            District Performance Register ({totalUnitsCount})
          </TabsTrigger>
          <TabsTrigger value="rounds" className="gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5" />
            Assessment Rounds ({assessments.length})
          </TabsTrigger>
          <TabsTrigger value="guidance" className="gap-1.5 text-xs">
            <BookOpen className="w-3.5 h-3.5" />
            WHO Guidance & Documentation
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INTERACTIVE CHOROPLETH COVERAGE MAP (RULE 25) */}
        <TabsContent value="overview" className="space-y-4">
          <RiskChoroplethMap
            countryCode={activeCountryCode}
            countryName={activeCountryName}
            adminLevelLabel={adminLevel}
            boundaryId={context?.boundaryId}
            data={coverageData?.performance || []}
            selectedDistrictId={selectedDistrict?.districtId}
            onSelectDistrict={(dist) => {
              setSelectedDistrict(dist);
              if (dist) {
                toast({
                  title: `${dist.districtName} (${dist.provinceName})`,
                  description: `MCV1 Coverage: ${dist.mcv1Coverage}% • MCV2: ${dist.mcv2Coverage}% • Dropout: ${dist.dropoutRate}% • Risk Category: ${dist.riskCategory}`,
                });
              }
            }}
            isLoading={isCoverageLoading || isContextLoading}
          />
        </TabsContent>

        {/* TAB 2: ENTERPRISE DISTRICT PERFORMANCE TABLE (RULE 24) */}
        <TabsContent value="table" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Subnational Performance & Vulnerability Register
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comprehensive routine coverage rates, dropout metrics, and programmatic risk scores for {activeCountryName}.
                  </CardDescription>
                </div>

                {/* Filter and Export Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder={`Search ${adminLevelPlural.toLowerCase()}...`}
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                      className="h-8 pl-8 text-xs w-[180px] md:w-[220px]"
                    />
                  </div>

                  <Select
                    value={selectedCategoryFilter}
                    onValueChange={(val) => {
                      setSelectedCategoryFilter(val);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-[140px]">
                      <SelectValue placeholder="Risk Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Categories</SelectItem>
                      <SelectItem value="LOW">Low Risk</SelectItem>
                      <SelectItem value="MEDIUM">Medium Risk</SelectItem>
                      <SelectItem value="HIGH">High Risk</SelectItem>
                      <SelectItem value="VERY_HIGH">Very High Risk</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportTableCSV}>
                    <Download className="w-3 h-3" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/50 border-b font-medium text-muted-foreground">
                    <tr>
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("districtName")}>
                        <div className="flex items-center">
                          {adminLevel} Name {getSortIcon("districtName")}
                        </div>
                      </th>
                      {visibleColumns.province && (
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("provinceName")}>
                          <div className="flex items-center">
                            Province {getSortIcon("provinceName")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.mcv1 && (
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("mcv1Coverage")}>
                          <div className="flex items-center">
                            MCV1 Coverage {getSortIcon("mcv1Coverage")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.mcv2 && (
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("mcv2Coverage")}>
                          <div className="flex items-center">
                            MCV2 Coverage {getSortIcon("mcv2Coverage")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.dropout && (
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("dropoutRate")}>
                          <div className="flex items-center">
                            Penta1-MCV1 Dropout {getSortIcon("dropoutRate")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.suspectedCases && (
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("suspectedCases")}>
                          <div className="flex items-center">
                            Suspected Cases {getSortIcon("suspectedCases")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.riskScore && (
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("riskScore")}>
                          <div className="flex items-center">
                            Risk Score {getSortIcon("riskScore")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.riskCategory && (
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("riskCategory")}>
                          <div className="flex items-center">
                            Category {getSortIcon("riskCategory")}
                          </div>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          No {adminLevelPlural.toLowerCase()} match your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((d) => (
                        <tr
                          key={d.districtId}
                          onClick={() => setSelectedDistrict(d)}
                          className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                            selectedDistrict?.districtId === d.districtId ? "bg-primary/5 font-medium" : ""
                          }`}
                        >
                          <td className="p-3 font-semibold text-foreground flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                            {d.districtName}
                          </td>
                          {visibleColumns.province && <td className="p-3 text-muted-foreground">{d.provinceName}</td>}
                          {visibleColumns.mcv1 && (
                            <td className="p-3">
                              <span className={`font-semibold ${d.mcv1Coverage >= 90 ? 'text-emerald-600' : d.mcv1Coverage >= 80 ? 'text-lime-600' : 'text-rose-600'}`}>
                                {d.mcv1Coverage}%
                              </span>
                            </td>
                          )}
                          {visibleColumns.mcv2 && (
                            <td className="p-3">
                              <span className={`font-semibold ${d.mcv2Coverage >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {d.mcv2Coverage}%
                              </span>
                            </td>
                          )}
                          {visibleColumns.dropout && (
                            <td className="p-3">
                              <span className={`font-semibold ${d.dropoutRate <= 10 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {d.dropoutRate}%
                              </span>
                            </td>
                          )}
                          {visibleColumns.suspectedCases && (
                            <td className="p-3 text-muted-foreground font-mono">{d.suspectedCases}</td>
                          )}
                          {visibleColumns.riskScore && (
                            <td className="p-3 font-bold font-mono text-foreground">{d.riskScore}</td>
                          )}
                          {visibleColumns.riskCategory && (
                            <td className="p-3">
                              {d.riskCategory === "LOW" && <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Low</Badge>}
                              {d.riskCategory === "MEDIUM" && <Badge className="bg-amber-600 text-white hover:bg-amber-700">Medium</Badge>}
                              {d.riskCategory === "HIGH" && <Badge className="bg-orange-600 text-white hover:bg-orange-700">High</Badge>}
                              {d.riskCategory === "VERY_HIGH" && <Badge className="bg-rose-600 text-white hover:bg-rose-700">Very High</Badge>}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination (Rule 24) */}
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
                    Showing {filteredPerformanceRows.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
                    {Math.min(page * pageSize, filteredPerformanceRows.length)} of {filteredPerformanceRows.length} records
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
                    Page {page} of {totalPages}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: ASSESSMENT ROUNDS REGISTER */}
        <TabsContent value="rounds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Assessment Rounds Register
              </CardTitle>
              <CardDescription className="text-xs">
                Official programmatic risk assessments created under {activeCountryName}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isAssessmentsLoading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  Loading risk assessment rounds...
                </div>
              ) : assessments.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <ShieldAlert className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                  <p className="text-muted-foreground font-medium">No assessment rounds configured yet for {activeCountryName}.</p>
                  <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Create Initial Round
                  </Button>
                </div>
              ) : (
                <div className="divide-y border rounded-md">
                  {assessments.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-base hover:underline cursor-pointer" onClick={() => setLocation(`/risk-assessments/${a.id}`)}>
                            {a.title}
                          </h4>
                          {getStatusBadge(a.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Assessment Year: {a.assessmentYear}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> Country: {a.countryCode} ({a.administrativeLevelName})
                          </span>
                          <span>Created: {new Date(a.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setLocation(`/risk-assessments/${a.id}`)}>
                          Open Workspace <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: WHO GUIDANCE & DOCUMENTATION */}
        <TabsContent value="guidance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  WHO Measles Programmatic Risk Assessment Tool
                </CardTitle>
                <CardDescription className="text-xs">
                  Reference: Measles Risk Assessment Tool v1.8 & Setup Guide v1.5
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                <p>
                  The World Health Organization (WHO) measles programmatic risk assessment tool helps national programmes identify areas not meeting measles programmatic targets, and based on the findings, guide and strengthen measles elimination programme activities and reduce outbreak risks.
                </p>
                <div className="space-y-2 border-t pt-3">
                  <h5 className="font-bold text-foreground">The Four Assessment Domains:</h5>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Population Immunity (Max 40 pts):</strong> Assesses susceptibility using routine MCV1, MCV2, recent SIAs (within 3 years), and proportion of suspected cases with unknown or zero vaccination.</li>
                    <li><strong>Surveillance Quality (Max 20 pts):</strong> Evaluates non-measles discarded rate, adequate investigation within 48h, specimen collection within 28 days, and timely lab results.</li>
                    <li><strong>Programme Delivery Performance (Max 16 pts):</strong> Assesses 3-year MCV1/MCV2 trend slopes and dropouts from DPT1/Penta1 to MCV1 and MCV1 to MCV2.</li>
                    <li><strong>Threat Assessment (Max 24 pts):</strong> Accounts for cases in key age groups (&lt;5y, 5-14y, 15+y), cases in contiguous neighbouring districts, population density, and 8 vulnerable population factors.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  Documentation & Guidelines Package
                </CardTitle>
                <CardDescription className="text-xs">
                  Standard WHO references embedded in VaxPlan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="divide-y border rounded-md">
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">WHO VPD Surveillance Standards</p>
                      <p className="text-muted-foreground text-[11px]">Surveillance standards for measles, rubella, and VPDs.</p>
                    </div>
                    <a
                      href="https://www.who.int/teams/immunization-vaccines-and-biologicals/immunization-analysis-and-insights/surveillance/surveillance-for-vpds/vpd-surveillance-standards"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        WHO Standards <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">Technical Appendix</p>
                      <p className="text-muted-foreground text-[11px]">Detailed indicator formulas, threshold criteria, and scoring rationales.</p>
                    </div>
                    <Badge variant="outline">Included in RA/docs</Badge>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">MRAT Country Report Template</p>
                      <p className="text-muted-foreground text-[11px]">Word/PDF standardized report template for national presentations.</p>
                    </div>
                    <Badge variant="outline">Included in RA/docs</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
