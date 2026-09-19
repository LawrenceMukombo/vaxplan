import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Layers,
  Table as TableIcon,
  Printer,
  Globe,
  Plus,
  Edit2,
  CheckCircle,
  AlertCircle,
  Clock,
  MapPin,
  Syringe,
  Filter,
  Search,
  Download,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ArrowUpDown,
  Sparkles,
  Info,
  RefreshCw,
  Eye,
  SlidersHorizontal
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ALL_NATIONAL_PRESETS,
  AGE_MILESTONES,
  ROUTE_LABELS,
  TARGET_POPULATION_GROUPS,
  resolveDoseMilestone,
  getClinicalMetadataForDose,
  type NationalSchedulePreset,
  type NationalScheduleDosePreset
} from "../../../shared/nationalSchedules";
import { useAuth } from "@/hooks/useAuth";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface ScheduleDoseItem {
  id: number;
  tenantId: string;
  vaccineId: number;
  doseCode: string;
  name: string;
  doseNumber: number;
  targetAge?: string | null;
  minimumAge?: string | null;
  maximumAge?: string | null;
  minimumInterval?: string | null;
  targetPopulationGroup?: string | null;
  route?: string | null;
  site?: string | null;
  classification: "routine" | "campaign" | "outbreak" | "school_based" | "other";
  active: boolean;
  approvalStatus: "draft" | "submitted" | "approved" | "published" | "archived";
  clinicalNotes?: string | null;
  notes?: string | null;
}

interface VaccineProductItem {
  id: number;
  productId: string;
  name: string;
  antigenName?: string | null;
  dosesPerVial: number;
  unitOfMeasure?: string | null;
  active: boolean;
}

export default function ImmunizationSchedule() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Active view tabs: 'timeline', 'matrix', 'table', 'wallchart'
  const [activeView, setActiveView] = useState<string>("timeline");

  // Filter and Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [filterRoute, setFilterRoute] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Collapsible Milestone Timeline State
  const [collapsedMilestones, setCollapsedMilestones] = useState<Record<string, boolean>>({});

  const toggleMilestoneCollapse = (milestoneId: string) => {
    setCollapsedMilestones((prev) => ({
      ...prev,
      [milestoneId]: !prev[milestoneId],
    }));
  };

  const expandAllMilestones = () => {
    setCollapsedMilestones({});
  };

  const collapseAllMilestones = () => {
    const allCollapsed: Record<string, boolean> = {};
    for (const m of AGE_MILESTONES) {
      allCollapsed[m.id] = true;
    }
    setCollapsedMilestones(allCollapsed);
  };

  // Table pagination & sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<keyof ScheduleDoseItem>("doseNumber");
  const [sortAsc, setSortAsc] = useState(true);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    doseCode: true,
    targetAge: true,
    minimumInterval: true,
    route: true,
    site: true,
    targetPopulationGroup: true,
    linkedVaccine: true,
    active: true,
    actions: true,
  });

  // Modals state
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetSearchQuery, setPresetSearchQuery] = useState("");
  const [selectedPresetCode, setSelectedPresetCode] = useState<string>("ZAF");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDose, setEditingDose] = useState<Partial<ScheduleDoseItem> | null>(null);

  // Fetch Schedule Doses
  const { data: scheduleDoses = [], isLoading: loadingDoses } = useQuery<ScheduleDoseItem[]>({
    queryKey: ["/api/catalogue/schedules"],
    queryFn: async () => {
      const res = await fetch("/api/catalogue/schedules");
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return res.json();
    }
  });

  // Fetch Vaccine Products
  const { data: vaccines = [], isLoading: loadingVaccines } = useQuery<VaccineProductItem[]>({
    queryKey: ["/api/catalogue/vaccines"],
    queryFn: async () => {
      const res = await fetch("/api/catalogue/vaccines");
      if (!res.ok) throw new Error("Failed to fetch vaccines");
      return res.json();
    }
  });

  // Map of vaccineId to Vaccine name
  const vaccineMap = useMemo(() => {
    const map = new Map<number, VaccineProductItem>();
    for (const v of vaccines) {
      map.set(v.id, v);
    }
    return map;
  }, [vaccines]);

  // Dropdown options (searchable & alphabetically sorted)
  const targetGroupFilterOptions = useMemo(() => {
    const list = TARGET_POPULATION_GROUPS.map((g) => ({ value: g.id, label: g.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "all", label: "All Target Groups" }, ...list];
  }, []);

  const routeFilterOptions = useMemo(() => {
    const list = Object.entries(ROUTE_LABELS).map(([code, r]) => ({
      value: code,
      label: `${r.label} (${r.full})`,
    })).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "all", label: "All Routes" }, ...list];
  }, []);

  const statusFilterOptions = useMemo(() => [
    { value: "all", label: "All Status" },
    { value: "active", label: "Active Only" },
    { value: "inactive", label: "Inactive Only" },
  ], []);

  const vaccineProductOptions = useMemo(() => {
    return vaccines
      .map((v) => ({
        value: String(v.id),
        label: v.name,
        subLabel: `${v.antigenName || "General"} • Code: ${v.productId}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [vaccines]);

  const ageMilestoneOptions = useMemo(() => {
    return AGE_MILESTONES.map((m) => ({
      value: m.label,
      label: m.label,
      subLabel: `Timeline: ${m.shortLabel} (${m.group})`,
    }));
  }, []);

  const routeOptions = useMemo(() => {
    return Object.entries(ROUTE_LABELS)
      .map(([code, r]) => ({
        value: code,
        label: `${r.label} - ${r.full}`,
        subLabel: `Route: ${code}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const targetPopulationGroupOptions = useMemo(() => {
    return TARGET_POPULATION_GROUPS.map((g) => ({
      value: g.id,
      label: g.label,
      subLabel: `Group: ${g.id}`,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const classificationOptions = useMemo(() => [
    { value: "routine", label: "Routine EPI Schedule" },
    { value: "campaign", label: "Supplementary / Campaign (SIA)" },
    { value: "outbreak", label: "Outbreak Response" },
    { value: "school_based", label: "School-Based Programme" },
    { value: "other", label: "Catch-up / Other" },
  ].sort((a, b) => a.label.localeCompare(b.label)), []);

  const sortedAndFilteredPresets = useMemo(() => {
    const list = Object.values(ALL_NATIONAL_PRESETS).sort((a, b) => a.countryName.localeCompare(b.countryName));
    if (!presetSearchQuery.trim()) return list;
    const q = presetSearchQuery.toLowerCase();
    return list.filter(
      (p) =>
        p.countryName.toLowerCase().includes(q) ||
        p.countryCode.toLowerCase().includes(q) ||
        p.scheduleTitle.toLowerCase().includes(q) ||
        p.authorityName.toLowerCase().includes(q)
    );
  }, [presetSearchQuery]);

  // Determine Active Country / Preset
  const detectedPreset = useMemo(() => {
    const code = (user as any)?.countryCode?.toUpperCase() || (user as any)?.tenantId?.slice(0, 3)?.toUpperCase() || "ZAF";
    return ALL_NATIONAL_PRESETS[code] || ALL_NATIONAL_PRESETS.WHO;
  }, [user]);

  // Toggle Active Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, active, name }: { id: number; active: boolean; name: string }) => {
      const res = await fetch(`/api/catalogue/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active })
      });
      if (!res.ok) throw new Error(await res.text());
      return { id, active, name };
    },
    onSuccess: ({ name, active }) => {
      toast({
        title: active ? "Dose Activated" : "Dose Deactivated",
        description: `${name} is now ${active ? "active" : "inactive"} in the national schedule.`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/catalogue/schedules"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Status Update Failed", description: err.message });
    }
  });

  // Apply Preset Mutation
  const applyPresetMutation = useMutation({
    mutationFn: async (presetKey: string) => {
      const res = await fetch("/api/catalogue/schedules/apply-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetKey })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to apply national preset");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "National Schedule Applied",
        description: data.message || `Loaded ${data.count} doses successfully.`
      });
      setPresetDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/catalogue/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalogue/vaccines"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Preset Error", description: err.message });
    }
  });

  // Save / Update Schedule Dose Mutation
  const saveDoseMutation = useMutation({
    mutationFn: async (doseData: Partial<ScheduleDoseItem>) => {
      const isNew = !doseData.id;
      const url = isNew ? "/api/catalogue/schedules" : `/api/catalogue/schedules/${doseData.id}`;
      const method = isNew ? "POST" : "PATCH";

      // Whitelist and format clean payload
      const payload: Record<string, any> = {
        name: doseData.name,
        doseCode: doseData.doseCode,
        vaccineId: Number(doseData.vaccineId),
        doseNumber: Number(doseData.doseNumber || 1),
        targetAge: doseData.targetAge || null,
        minimumAge: doseData.minimumAge || null,
        maximumAge: doseData.maximumAge || null,
        minimumInterval: doseData.minimumInterval || null,
        route: doseData.route || null,
        site: doseData.site || null,
        targetPopulationGroup: doseData.targetPopulationGroup || "infants",
        classification: ["routine", "campaign", "outbreak", "school_based", "other"].includes(doseData.classification as any)
          ? doseData.classification
          : "routine",
        active: doseData.active !== undefined ? Boolean(doseData.active) : true,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to save schedule dose");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: editingDose?.id ? "Dose Updated" : "Dose Created",
        description: "Immunization schedule changes saved successfully."
      });
      setEditDialogOpen(false);
      setEditingDose(null);
      queryClient.invalidateQueries({ queryKey: ["/api/catalogue/schedules"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Save Failed", description: err.message });
    }
  });

  // Filtered doses list
  const filteredDoses = useMemo(() => {
    return scheduleDoses.filter(dose => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const vName = vaccineMap.get(dose.vaccineId)?.name?.toLowerCase() || "";
        const match =
          dose.name.toLowerCase().includes(q) ||
          dose.doseCode.toLowerCase().includes(q) ||
          (dose.targetAge && dose.targetAge.toLowerCase().includes(q)) ||
          (dose.site && dose.site.toLowerCase().includes(q)) ||
          vName.includes(q);
        if (!match) return false;
      }

      // Target group
      if (filterGroup !== "all" && dose.targetPopulationGroup !== filterGroup) {
        return false;
      }

      // Route
      if (filterRoute !== "all" && dose.route !== filterRoute) {
        return false;
      }

      // Status
      if (filterStatus === "active" && !dose.active) return false;
      if (filterStatus === "inactive" && dose.active) return false;

      return true;
    });
  }, [scheduleDoses, searchQuery, filterGroup, filterRoute, filterStatus, vaccineMap]);

  // Sorted and Paginated Doses for Enterprise Table
  const sortedDoses = useMemo(() => {
    return [...filteredDoses].sort((a, b) => {
      let valA: any = a[sortField] ?? "";
      let valB: any = b[sortField] ?? "";

      if (sortField === "doseNumber") {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredDoses, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedDoses.length / pageSize));
  const paginatedDoses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedDoses.slice(start, start + pageSize);
  }, [sortedDoses, currentPage, pageSize]);

  const handleSort = (field: keyof ScheduleDoseItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Group doses by Age Milestone for Timeline view (using robust resolveDoseMilestone)
  const milestoneGroups = useMemo(() => {
    const groups: { milestone: typeof AGE_MILESTONES[number]; doses: ScheduleDoseItem[] }[] = [];
    const normalizedMap = new Map<string, ScheduleDoseItem[]>();

    for (const d of filteredDoses) {
      const milestone = resolveDoseMilestone(d);
      const key = milestone.id;

      if (!normalizedMap.has(key)) normalizedMap.set(key, []);
      normalizedMap.get(key)!.push(d);
    }

    for (const m of AGE_MILESTONES) {
      const items = normalizedMap.get(m.id) || [];
      if (items.length > 0 || filterGroup === "all") {
        groups.push({
          milestone: m,
          doses: items.sort((a, b) => a.doseNumber - b.doseNumber),
        });
      }
    }

    return groups;
  }, [filteredDoses, filterGroup]);

  // Unique Antigens for Matrix view
  const matrixData = useMemo(() => {
    const antigenSet = new Set<string>();
    for (const d of scheduleDoses) {
      const v = vaccineMap.get(d.vaccineId);
      const ant = v?.antigenName || d.name.split(" ")[0] || "General";
      if (ant) antigenSet.add(ant);
    }

    const antigens = Array.from(antigenSet).sort((a, b) => a.localeCompare(b));
    return {
      antigens,
      milestones: AGE_MILESTONES,
    };
  }, [scheduleDoses, vaccineMap]);

  // Handle Printable Wall-Chart Trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-2 p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. HEADER & NATIONAL POLICY CONTEXT
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b pb-6 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-xl">
              <Calendar className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  National Immunization Schedule
                </h1>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {detectedPreset.countryName} ({detectedPreset.countryCode})
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {detectedPreset.scheduleTitle} • {detectedPreset.authorityName} • Version {detectedPreset.version}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setPresetDialogOpen(true)}
          >
            <Globe className="w-4 h-4 mr-2 text-indigo-500" />
            National Presets
          </Button>

          <Button
            variant="outline"
            className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4 mr-2 text-slate-600 dark:text-slate-400" />
            Print Wall-Chart
          </Button>

          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            onClick={() => {
              setEditingDose({
                name: "",
                doseCode: "",
                doseNumber: 1,
                targetAge: "6 Weeks",
                route: "IM",
                site: "Left Anterolateral Thigh",
                targetPopulationGroup: "infants",
                classification: "routine",
                active: true,
                approvalStatus: "draft"
              });
              setEditDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Schedule Dose
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. KPI SUMMARY BANNER
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-200/60 dark:border-emerald-800/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Active Schedule Doses</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {scheduleDoses.filter(d => d.active).length} <span className="text-xs font-normal text-muted-foreground">/ {scheduleDoses.length}</span>
              </h3>
            </div>
            <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-sm">
              <Syringe className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-200/60 dark:border-blue-800/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">Milestones Covered</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {milestoneGroups.filter(g => g.doses.length > 0).length} <span className="text-xs font-normal text-muted-foreground">age steps</span>
              </h3>
            </div>
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-sm">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500/5 to-indigo-500/10 border-indigo-200/60 dark:border-indigo-800/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Vaccine Products</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {vaccines.filter(v => v.active).length} <span className="text-xs font-normal text-muted-foreground">products</span>
              </h3>
            </div>
            <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-200/60 dark:border-amber-800/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">Storage Standard</p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {detectedPreset.recommendedStorageTemp}
              </h3>
            </div>
            <div className="p-3 bg-amber-600 text-white rounded-xl shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. CONTROLS, SEARCH & VIEW SWITCHER
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border print:hidden">
        {/* View switcher tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-lg border shadow-sm">
          <Button
            variant={activeView === "timeline" ? "default" : "ghost"}
            size="sm"
            className={activeView === "timeline" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            onClick={() => setActiveView("timeline")}
          >
            <Clock className="w-4 h-4 mr-1.5" />
            Milestone Timeline
          </Button>

          <Button
            variant={activeView === "matrix" ? "default" : "ghost"}
            size="sm"
            className={activeView === "matrix" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            onClick={() => setActiveView("matrix")}
          >
            <Layers className="w-4 h-4 mr-1.5" />
            Age-Antigen Matrix
          </Button>

          <Button
            variant={activeView === "table" ? "default" : "ghost"}
            size="sm"
            className={activeView === "table" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            onClick={() => setActiveView("table")}
          >
            <TableIcon className="w-4 h-4 mr-1.5" />
            Enterprise Table
          </Button>

          <Button
            variant={activeView === "wallchart" ? "default" : "ghost"}
            size="sm"
            className={activeView === "wallchart" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            onClick={() => setActiveView("wallchart")}
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Wall-Chart View
          </Button>
        </div>

        {/* Search & Interactive Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search antigen, dose, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm bg-white dark:bg-slate-800"
            />
          </div>

          <div className="w-[170px]">
            <SearchableSelect
              value={filterGroup}
              onValueChange={setFilterGroup}
              options={targetGroupFilterOptions}
              placeholder="Target Group"
              searchPlaceholder="Search target group..."
              triggerClassName="text-xs h-9"
              width="w-[250px]"
            />
          </div>

          <div className="w-[150px]">
            <SearchableSelect
              value={filterRoute}
              onValueChange={setFilterRoute}
              options={routeFilterOptions}
              placeholder="Route"
              searchPlaceholder="Search route..."
              triggerClassName="text-xs h-9"
              width="w-[210px]"
            />
          </div>

          <div className="w-[130px]">
            <SearchableSelect
              value={filterStatus}
              onValueChange={setFilterStatus}
              options={statusFilterOptions}
              placeholder="Status"
              searchPlaceholder="Search status..."
              triggerClassName="text-xs h-9"
              width="w-[180px]"
            />
          </div>

          {(searchQuery || filterGroup !== "all" || filterRoute !== "all" || filterStatus !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setFilterGroup("all");
                setFilterRoute("all");
                setFilterStatus("all");
              }}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. VIEW 1: MILESTONE TIMELINE ROADMAP (COLLAPSIBLE)
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeView === "timeline" && (
        <div className="space-y-6">
          {/* Milestone Timeline Controls Bar */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Age Milestone Timeline ({milestoneGroups.length} Milestones)
              </span>
              <Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-800">
                {milestoneGroups.filter(g => !collapsedMilestones[g.milestone.id]).length} Expanded
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={expandAllMilestones}
              >
                <ChevronDown className="w-3.5 h-3.5 mr-1" />
                Expand All
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={collapseAllMilestones}
              >
                <ChevronRight className="w-3.5 h-3.5 mr-1" />
                Collapse All
              </Button>
            </div>
          </div>

          {loadingDoses ? (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : milestoneGroups.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                <h3 className="text-lg font-semibold">No immunization doses matched filters</h3>
                <p className="text-sm text-muted-foreground mt-1">Try resetting filters or applying a national preset.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative border-l-2 border-emerald-500/30 ml-4 md:ml-8 pl-6 md:pl-8 space-y-8">
              {milestoneGroups.map(({ milestone, doses }) => {
                if (doses.length === 0 && filterGroup !== "all") return null;
                const isCollapsed = Boolean(collapsedMilestones[milestone.id]);

                return (
                  <div key={milestone.id} className="relative group">
                    {/* Timeline Node marker */}
                    <div
                      onClick={() => toggleMilestoneCollapse(milestone.id)}
                      className="absolute -left-[35px] md:-left-[43px] top-1.5 flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-slate-900 border-2 border-emerald-500 shadow-md cursor-pointer hover:scale-115 transition-transform"
                      title={isCollapsed ? "Click to expand milestone" : "Click to collapse milestone"}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>

                    {/* Milestone Header Banner */}
                    <div
                      onClick={() => toggleMilestoneCollapse(milestone.id)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border bg-slate-50/80 dark:bg-slate-900/60 hover:bg-emerald-500/5 cursor-pointer transition-colors mb-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1 rounded bg-white dark:bg-slate-800 border text-muted-foreground">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
                          {milestone.label}
                        </h2>
                        <span className="text-xs font-medium text-muted-foreground bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border">
                          Target: {milestone.group.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant={doses.length > 0 ? "default" : "outline"}
                          className={`text-xs ${doses.length > 0 ? "bg-emerald-600 text-white" : ""}`}
                        >
                          {doses.length} {doses.length === 1 ? "antigen dose" : "antigen doses"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground hidden sm:inline">
                          {isCollapsed ? "Click to expand" : "Click to collapse"}
                        </span>
                      </div>
                    </div>

                    {/* Collapsed State Summary Row */}
                    {isCollapsed ? (
                      <div
                        onClick={() => toggleMilestoneCollapse(milestone.id)}
                        className="p-3 rounded-xl border border-dashed bg-slate-50/50 dark:bg-slate-900/30 hover:bg-emerald-50/50 cursor-pointer flex flex-wrap items-center gap-2 text-xs transition-colors"
                      >
                        <span className="font-semibold text-muted-foreground mr-1">Antigens:</span>
                        {doses.length === 0 ? (
                          <span className="text-muted-foreground italic">No antigens registered under current filter.</span>
                        ) : (
                          doses.map((dose) => {
                            const clinicalMeta = getClinicalMetadataForDose(dose.name, dose.doseCode, dose.targetAge);
                            const displayRoute = (dose.route && dose.route !== "IM") ? dose.route : (clinicalMeta.route || dose.route || "IM");
                            const routeInfo = ROUTE_LABELS[displayRoute] || ROUTE_LABELS.IM;
                            return (
                              <Badge
                                key={dose.id}
                                variant="outline"
                                className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 text-[11px] py-0.5 px-2 flex items-center gap-1.5"
                              >
                                <span className="font-bold">{dose.name}</span>
                                <span className={`text-[9px] px-1 rounded ${routeInfo.color}`}>{routeInfo.label}</span>
                              </Badge>
                            );
                          })
                        )}
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold ml-auto flex items-center gap-1">
                          + Click to View Dose Cards
                        </span>
                      </div>
                    ) : doses.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed text-sm bg-slate-50/70 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {milestone.id === "5_6y"
                                ? "School Entry Booster (5-6 Years)"
                                : milestone.id === "12y"
                                ? "Adolescent Booster (12 Years)"
                                : milestone.id === "pregnancy"
                                ? "Maternal Tetanus & Diphtheria (ANC / Pregnant Women)"
                                : `No antigens registered for ${milestone.label}`}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground pl-6">
                            {milestone.id === "5_6y"
                              ? "EPI Recommended: Td (Tetanus & reduced Diphtheria) or DTaP-IPV booster given at primary school entry to extend childhood immunity."
                              : milestone.id === "12y"
                              ? "EPI Recommended: Td booster administered at 11-12 years (Grade 7) to maintain protective antibody titers against tetanus & diphtheria."
                              : milestone.id === "pregnancy"
                              ? "EPI Recommended: Minimum 2 doses of Td during antenatal care (1st contact & 4+ weeks later) for maternal and neonatal tetanus elimination."
                              : "No antigen doses are currently assigned to this age step. Click below to configure national doses."}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 bg-white dark:bg-slate-800 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-800 text-xs font-medium"
                          onClick={() => {
                            let defaultName = "";
                            let defaultCode = "";
                            let defaultRoute: "IM" | "Oral" | "ID" | "SC" = "IM";
                            let defaultSite = "Left Upper Arm (Deltoid)";

                            if (milestone.id === "5_6y") {
                              defaultName = "Td (6 Years)";
                              defaultCode = "td_6y";
                            } else if (milestone.id === "12y") {
                              defaultName = "Td (12 Years)";
                              defaultCode = "td_12y";
                            } else if (milestone.id === "pregnancy") {
                              defaultName = "Td 1 (Pregnancy)";
                              defaultCode = "td_preg_1";
                            }

                            // Match with available vaccine in map
                            const matchedVac = Array.from(vaccineMap.values()).find(
                              (v) =>
                                v.name.toLowerCase().includes("td") ||
                                v.name.toLowerCase().includes("tetanus") ||
                                v.name.toLowerCase().includes("dtap")
                            ) || Array.from(vaccineMap.values())[0];

                            setEditingDose({
                              name: defaultName,
                              doseCode: defaultCode,
                              vaccineId: matchedVac ? matchedVac.id : undefined,
                              doseNumber: 1,
                              targetAge: milestone.label,
                              minimumAge: milestone.id === "5_6y" ? "5 Years" : milestone.id === "12y" ? "11 Years" : "1st Trimester",
                              route: defaultRoute,
                              site: defaultSite,
                              targetPopulationGroup: milestone.group,
                              classification: "routine",
                              active: true,
                              approvalStatus: "approved"
                            });
                            setEditDialogOpen(true);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Add Dose to {milestone.label}
                        </Button>
                      </div>
                    ) : (
                      /* Expanded Full Card Grid */
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {doses.map((dose) => {
                          const clinicalMeta = getClinicalMetadataForDose(dose.name, dose.doseCode, dose.targetAge);
                          const displayRoute = (dose.route && dose.route !== "IM") ? dose.route : (clinicalMeta.route || dose.route || "IM");
                          const routeInfo = ROUTE_LABELS[displayRoute] || ROUTE_LABELS.IM;
                          const vaccineProd = vaccineMap.get(dose.vaccineId);
                          const displaySite = dose.site && dose.site !== "Standard Site" && dose.site !== "Standard" ? dose.site : clinicalMeta.site;
                          const displayInterval = dose.minimumInterval && dose.minimumInterval !== "—" ? dose.minimumInterval : clinicalMeta.minimumInterval;
                          const displayNotes = dose.clinicalNotes || dose.notes || clinicalMeta.notes;

                          return (
                            <Card
                              key={dose.id}
                              className={`relative transition-all hover:shadow-md border ${
                                dose.active
                                  ? "bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700"
                                  : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 opacity-60"
                              }`}
                            >
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-base text-slate-900 dark:text-white">
                                        {dose.name}
                                      </h4>
                                      <span className="font-mono text-xs text-muted-foreground px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
                                        {dose.doseCode}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {vaccineProd ? vaccineProd.name : "Vaccine Product"} • Dose #{dose.doseNumber}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className={`text-xs px-2 py-0.5 border ${routeInfo.color}`} title={routeInfo.full}>
                                      {routeInfo.label}
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      onClick={() => {
                                        setEditingDose(dose);
                                        setEditDialogOpen(true);
                                      }}
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                  <div>
                                    <span className="text-muted-foreground block text-[11px]">Administration Site:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5 text-xs">
                                      <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                                      <span className="truncate">{displaySite}</span>
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-muted-foreground block text-[11px]">Minimum Interval:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5 text-xs">
                                      <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                                      <span className="truncate">{displayInterval}</span>
                                    </span>
                                  </div>
                                </div>

                                {/* Clinical Administration Guidelines Note */}
                                {displayNotes && (
                                  <div className="p-2 rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                                    <div className="flex items-start gap-1">
                                      <Info className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                      <span>{displayNotes}</span>
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                  <span className="text-xs text-muted-foreground capitalize">
                                    Target: {dose.targetPopulationGroup?.replace(/_/g, " ") || "Infants"}
                                  </span>

                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {dose.active ? "Active" : "Inactive"}
                                    </span>
                                    <Switch
                                      checked={dose.active}
                                      onCheckedChange={(checked) =>
                                        toggleStatusMutation.mutate({
                                          id: dose.id,
                                          active: checked,
                                          name: dose.name,
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. VIEW 2: AGE-ANTIGEN MATRIX GRID
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeView === "matrix" && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>National Age-Antigen Cross-Matrix</span>
              <Badge variant="outline" className="font-normal text-xs">
                {matrixData.antigens.length} Antigens × {matrixData.milestones.length} Age Milestones
              </Badge>
            </CardTitle>
            <CardDescription>
              Comprehensive 2D clinical matrix mapping each registered antigen to the national age milestones.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="border-collapse min-w-[900px]">
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-slate-900/60 hover:bg-transparent">
                  <TableHead className="w-[180px] font-bold text-slate-900 dark:text-white border-r">Antigen / Vaccine</TableHead>
                  {matrixData.milestones.map((m) => (
                    <TableHead key={m.id} className="text-center font-bold text-slate-800 dark:text-slate-200 border-r min-w-[100px] text-xs">
                      <div>{m.shortLabel}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{m.label}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrixData.antigens.map((antigen) => (
                  <TableRow key={antigen} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <TableCell className="font-semibold text-slate-900 dark:text-white border-r bg-slate-50/40 dark:bg-slate-900/30 text-xs">
                      {antigen}
                    </TableCell>
                    {matrixData.milestones.map((m) => {
                      const matchedDoses = scheduleDoses.filter((d) => {
                        const v = vaccineMap.get(d.vaccineId);
                        const vAntigen = v?.antigenName || d.name.split(" ")[0] || "General";
                        if (vAntigen.toLowerCase() !== antigen.toLowerCase()) return false;

                        const doseMilestone = resolveDoseMilestone(d);
                        return doseMilestone.id === m.id;
                      });

                      return (
                        <TableCell key={m.id} className="text-center p-2 border-r align-middle">
                          {matchedDoses.length > 0 ? (
                            <div className="flex flex-col gap-1 items-center">
                              {matchedDoses.map((dose) => {
                                const clinicalMeta = getClinicalMetadataForDose(dose.name, dose.doseCode, dose.targetAge);
                                const displayRoute = (dose.route && dose.route !== "IM") ? dose.route : (clinicalMeta.route || dose.route || "IM");
                                const routeInfo = ROUTE_LABELS[displayRoute] || ROUTE_LABELS.IM;
                                return (
                                  <div
                                    key={dose.id}
                                    onClick={() => {
                                      setEditingDose(dose);
                                      setEditDialogOpen(true);
                                    }}
                                    className={`cursor-pointer group flex items-center justify-between gap-1 w-full max-w-[110px] px-1.5 py-1 rounded-md text-[11px] font-medium border shadow-xs transition-all hover:scale-105 ${
                                      dose.active
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800"
                                        : "bg-slate-100 text-slate-500 border-slate-300 line-through opacity-70"
                                    }`}
                                    title={`${dose.name} - Route: ${displayRoute} (${dose.site || clinicalMeta.site})`}
                                  >
                                    <span className="truncate">{dose.name}</span>
                                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-3.5 border ${routeInfo.color}`}>
                                      {routeInfo.label}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. VIEW 3: ENTERPRISE DATA TABLE (RULE 24 COMPLIANT)
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeView === "table" && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Schedule Dose Inventory</CardTitle>
              <CardDescription>
                Sortable, paginated enterprise registry of all schedule doses with column visibility management.
              </CardDescription>
            </div>

            {/* Column Visibility Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                  Columns ({Object.values(visibleColumns).filter(Boolean).length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs font-semibold">Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.keys(visibleColumns).map((colKey) => (
                  <DropdownMenuCheckboxItem
                    key={colKey}
                    checked={visibleColumns[colKey]}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, [colKey]: !!checked }))
                    }
                    className="capitalize text-xs"
                  >
                    {colKey.replace(/([A-Z])/g, " $1")}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>

          <CardContent className="p-0">
            {loadingDoses ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900/70">
                      {visibleColumns.name && (
                        <TableHead className="cursor-pointer font-bold" onClick={() => handleSort("name")}>
                          <div className="flex items-center gap-1.5">
                            Dose Name
                            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        </TableHead>
                      )}

                      {visibleColumns.doseCode && (
                        <TableHead className="cursor-pointer font-bold" onClick={() => handleSort("doseCode")}>
                          <div className="flex items-center gap-1.5">
                            Code
                            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        </TableHead>
                      )}

                      {visibleColumns.targetAge && (
                        <TableHead className="cursor-pointer font-bold" onClick={() => handleSort("targetAge")}>
                          <div className="flex items-center gap-1.5">
                            Target Age
                            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        </TableHead>
                      )}

                      {visibleColumns.minimumInterval && (
                        <TableHead className="font-bold">Min Interval</TableHead>
                      )}

                      {visibleColumns.route && (
                        <TableHead className="cursor-pointer font-bold" onClick={() => handleSort("route")}>
                          <div className="flex items-center gap-1.5">
                            Route
                            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        </TableHead>
                      )}

                      {visibleColumns.site && (
                        <TableHead className="font-bold">Anatomical Site</TableHead>
                      )}

                      {visibleColumns.targetPopulationGroup && (
                        <TableHead className="cursor-pointer font-bold" onClick={() => handleSort("targetPopulationGroup")}>
                          <div className="flex items-center gap-1.5">
                            Target Group
                            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        </TableHead>
                      )}

                      {visibleColumns.linkedVaccine && (
                        <TableHead className="font-bold">Linked Vaccine Product</TableHead>
                      )}

                      {visibleColumns.active && (
                        <TableHead className="font-bold text-center">Status</TableHead>
                      )}

                      {visibleColumns.actions && (
                        <TableHead className="text-right font-bold">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDoses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                          No schedule doses found matching current query.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedDoses.map((dose) => {
                        const routeInfo = ROUTE_LABELS[dose.route || "IM"] || ROUTE_LABELS.IM;
                        const vaccineProd = vaccineMap.get(dose.vaccineId);

                        return (
                          <TableRow key={dose.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                            {visibleColumns.name && (
                              <TableCell className="font-semibold text-slate-900 dark:text-white">
                                {dose.name}
                              </TableCell>
                            )}

                            {visibleColumns.doseCode && (
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {dose.doseCode}
                              </TableCell>
                            )}

                            {visibleColumns.targetAge && (
                              <TableCell>
                                <Badge variant="secondary" className="font-normal text-xs">
                                  {dose.targetAge || "At Birth"}
                                </Badge>
                              </TableCell>
                            )}

                            {visibleColumns.minimumInterval && (
                              <TableCell className="text-xs text-muted-foreground">
                                {dose.minimumInterval || "—"}
                              </TableCell>
                            )}

                            {visibleColumns.route && (
                              <TableCell>
                                <Badge variant="outline" className={`text-xs px-2 py-0.5 border ${routeInfo.color}`}>
                                  {routeInfo.label}
                                </Badge>
                              </TableCell>
                            )}

                            {visibleColumns.site && (
                              <TableCell className="text-xs">
                                {dose.site || "Standard"}
                              </TableCell>
                            )}

                            {visibleColumns.targetPopulationGroup && (
                              <TableCell className="capitalize text-xs">
                                {dose.targetPopulationGroup?.replace("_", " ") || "Infants"}
                              </TableCell>
                            )}

                            {visibleColumns.linkedVaccine && (
                              <TableCell className="text-xs font-medium">
                                {vaccineProd ? vaccineProd.name : `Vaccine #${dose.vaccineId}`}
                              </TableCell>
                            )}

                            {visibleColumns.active && (
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Switch
                                    checked={dose.active}
                                    onCheckedChange={(checked) =>
                                      toggleStatusMutation.mutate({
                                        id: dose.id,
                                        active: checked,
                                        name: dose.name,
                                      })
                                    }
                                  />
                                  <Badge
                                    variant={dose.active ? "default" : "outline"}
                                    className={`text-[10px] ${
                                      dose.active ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                                    }`}
                                  >
                                    {dose.active ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                              </TableCell>
                            )}

                            {visibleColumns.actions && (
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={() => {
                                    setEditingDose(dose);
                                    setEditDialogOpen(true);
                                  }}
                                >
                                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                                  Edit
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>

          {/* Table Pagination Bar */}
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Showing</span>
              <span className="font-semibold text-foreground">
                {sortedDoses.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </span>
              <span>to</span>
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * pageSize, sortedDoses.length)}
              </span>
              <span>of</span>
              <span className="font-semibold text-foreground">{sortedDoses.length}</span>
              <span>records</span>

              <div className="ml-4 flex items-center gap-1.5">
                <span>Rows per page:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 w-16 text-xs bg-white dark:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>

              <div className="text-xs font-medium px-2">
                Page {currentPage} of {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          7. VIEW 4: CLINICAL WALL-CHART PRINTABLE VIEW
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeView === "wallchart" && (
        <div className="space-y-6">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-3">
              <Printer className="w-5 h-5 text-emerald-600" />
              <div>
                <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">Health Facility Wall-Chart Mode</h4>
                <p className="text-xs text-emerald-800 dark:text-emerald-400">
                  Formatted for mounting in vaccination rooms and clinical consultation stations. Click "Print Wall-Chart" above or below.
                </p>
              </div>
            </div>
            <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print / Save PDF
            </Button>
          </div>

          <Card className="border-2 border-slate-900 dark:border-slate-300 shadow-lg p-6 bg-white text-slate-900 print:shadow-none print:border-none print:p-0">
            {/* National Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-slate-900">
                {detectedPreset.authorityName}
              </h1>
              <h2 className="text-lg md:text-xl font-bold uppercase tracking-tight text-emerald-800 mt-0.5">
                {detectedPreset.scheduleTitle}
              </h2>
              <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-600 mt-1">
                <span>Version: {detectedPreset.version}</span>
                <span>•</span>
                <span>Storage Standard: {detectedPreset.recommendedStorageTemp}</span>
                <span>•</span>
                <span>Official EPI Guideline</span>
              </div>
            </div>

            {/* Official Wall-Chart Schedule Table */}
            <Table className="border border-slate-800 text-xs">
              <TableHeader>
                <TableRow className="bg-slate-100 border-b-2 border-slate-800">
                  <TableHead className="font-black text-slate-900 border-r border-slate-800 w-[110px]">Age / Milestone</TableHead>
                  <TableHead className="font-black text-slate-900 border-r border-slate-800 w-[180px]">Antigen / Vaccine Dose</TableHead>
                  <TableHead className="font-black text-slate-900 border-r border-slate-800 w-[70px]">Route</TableHead>
                  <TableHead className="font-black text-slate-900 border-r border-slate-800 w-[150px]">Anatomical Site</TableHead>
                  <TableHead className="font-black text-slate-900 border-r border-slate-800 w-[100px]">Min Interval</TableHead>
                  <TableHead className="font-black text-slate-900">Clinical Administration Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestoneGroups.map(({ milestone, doses }) => {
                  if (doses.length === 0) return null;

                  return doses.map((dose, idx) => {
                    const clinicalMeta = getClinicalMetadataForDose(dose.name, dose.doseCode, dose.targetAge);
                    const displaySite = dose.site && dose.site !== "Standard Site" && dose.site !== "Standard" ? dose.site : clinicalMeta.site;
                    const displayInterval = dose.minimumInterval && dose.minimumInterval !== "—" ? dose.minimumInterval : clinicalMeta.minimumInterval;
                    const displayNotes = dose.clinicalNotes || dose.notes || clinicalMeta.notes;
                    const displayRoute = dose.route || clinicalMeta.route;

                    return (
                      <TableRow key={dose.id} className="border-b border-slate-300">
                        {idx === 0 && (
                          <TableCell
                            rowSpan={doses.length}
                            className="font-black bg-slate-50 border-r border-slate-800 align-top text-xs text-slate-900"
                          >
                            {milestone.label}
                          </TableCell>
                        )}
                        <TableCell className="font-bold border-r border-slate-300 text-slate-900">
                          {dose.name} <span className="font-mono text-[10px] text-slate-500 font-normal">({dose.doseCode})</span>
                        </TableCell>
                        <TableCell className="font-bold border-r border-slate-300 text-slate-900">
                          {displayRoute}
                        </TableCell>
                        <TableCell className="border-r border-slate-300 text-slate-800 font-medium">
                          {displaySite}
                        </TableCell>
                        <TableCell className="border-r border-slate-300 text-slate-800 font-medium">
                          {displayInterval}
                        </TableCell>
                        <TableCell className="text-[11px] text-slate-700 leading-relaxed">
                          {displayNotes}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })}
              </TableBody>
            </Table>

            {/* Wall Chart Footer Guidelines */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t-2 border-slate-800 text-[11px] leading-relaxed text-slate-800">
              <div className="border p-2.5 rounded bg-slate-50">
                <h5 className="font-bold uppercase text-xs text-slate-900 mb-1">1. Cold Chain Integrity</h5>
                <p>Maintain all vaccines between +2°C and +8°C. Never freeze DTP-containing vaccines or PCV. Check VVM status before every session.</p>
              </div>

              <div className="border p-2.5 rounded bg-slate-50">
                <h5 className="font-bold uppercase text-xs text-slate-900 mb-1">2. Injection Safety</h5>
                <p>Use a new sterile auto-disable (AD) syringe for every injection. Dispose immediately into designated 5L safety box. Do not recap needles.</p>
              </div>

              <div className="border p-2.5 rounded bg-slate-50">
                <h5 className="font-bold uppercase text-xs text-slate-900 mb-1">3. Missed Doses / Catch-up</h5>
                <p>Never restart the vaccination schedule if a child returns late. Continue from the next scheduled dose respecting minimum intervals.</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          8. DIALOG: NATIONAL PRESET SELECTOR & LOADER
      ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              Load National Immunization Schedule Preset
            </DialogTitle>
            <DialogDescription>
              Select a pre-configured national immunization schedule. Applying a preset updates or inserts schedule doses safely (upsert only) without deleting existing client vaccination data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Select Country Schedule Preset ({sortedAndFilteredPresets.length})</Label>
                <div className="relative w-48">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search preset..."
                    value={presetSearchQuery}
                    onChange={(e) => setPresetSearchQuery(e.target.value)}
                    className="pl-7 h-7 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
                {sortedAndFilteredPresets.map((p) => (
                  <div
                    key={p.countryCode}
                    onClick={() => setSelectedPresetCode(p.countryCode)}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-all text-left ${
                      selectedPresetCode === p.countryCode
                        ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{p.countryName}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{p.countryCode}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.scheduleTitle}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-2 font-medium">
                      <span>{p.doses.length} Doses</span>
                      <span>•</span>
                      <span>{p.version}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Preset Details Preview */}
            {ALL_NATIONAL_PRESETS[selectedPresetCode] && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border text-xs space-y-2">
                <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{ALL_NATIONAL_PRESETS[selectedPresetCode].scheduleTitle}</span>
                  <span className="text-emerald-600 font-semibold">{ALL_NATIONAL_PRESETS[selectedPresetCode].authorityName}</span>
                </div>
                <p className="text-muted-foreground">{ALL_NATIONAL_PRESETS[selectedPresetCode].description}</p>
                <div className="pt-2 border-t flex flex-wrap gap-1">
                  {ALL_NATIONAL_PRESETS[selectedPresetCode].doses.slice(0, 8).map((d) => (
                    <Badge key={d.doseCode} variant="secondary" className="text-[10px]">
                      {d.name} ({d.targetAge})
                    </Badge>
                  ))}
                  {ALL_NATIONAL_PRESETS[selectedPresetCode].doses.length > 8 && (
                    <span className="text-[10px] text-muted-foreground self-center">
                      +{ALL_NATIONAL_PRESETS[selectedPresetCode].doses.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setPresetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={applyPresetMutation.isPending}
              onClick={() => applyPresetMutation.mutate(selectedPresetCode)}
            >
              {applyPresetMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Applying Schedule...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Apply {ALL_NATIONAL_PRESETS[selectedPresetCode]?.countryName} Preset
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────────────
          9. DIALOG: ADD / EDIT SCHEDULE DOSE
      ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingDose?.id ? "Edit Schedule Dose" : "Add New Schedule Dose"}
            </DialogTitle>
            <DialogDescription>
              Configure dose timing, target population, administration route, and anatomical site for this country.
            </DialogDescription>
          </DialogHeader>

          {editingDose && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Dose Name *</Label>
                  <Input
                    placeholder="e.g. Hexavalent 1, PCV 1"
                    value={editingDose.name || ""}
                    onChange={(e) => setEditingDose({ ...editingDose, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Dose Code *</Label>
                  <Input
                    placeholder="e.g. hexavalent_1, pcv_1"
                    value={editingDose.doseCode || ""}
                    onChange={(e) => setEditingDose({ ...editingDose, doseCode: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Linked Vaccine Product *</Label>
                  <SearchableSelect
                    value={String(editingDose.vaccineId || "")}
                    onValueChange={(val) => setEditingDose({ ...editingDose, vaccineId: Number(val) })}
                    options={vaccineProductOptions}
                    placeholder="Select Vaccine Product..."
                    searchPlaceholder="Search vaccine or antigen..."
                    triggerClassName="text-xs h-9"
                    width="w-[300px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Dose Number in Series</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={editingDose.doseNumber ?? 1}
                    onChange={(e) => setEditingDose({ ...editingDose, doseNumber: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Target Age Milestone</Label>
                  <SearchableSelect
                    value={editingDose.targetAge || "6 Weeks"}
                    onValueChange={(val) => setEditingDose({ ...editingDose, targetAge: val })}
                    options={ageMilestoneOptions}
                    placeholder="Select Age Milestone..."
                    searchPlaceholder="Search age milestone..."
                    triggerClassName="text-xs h-9"
                    width="w-[280px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Minimum Interval</Label>
                  <Input
                    placeholder="e.g. 4 Weeks, 6 Months"
                    value={editingDose.minimumInterval || ""}
                    onChange={(e) => setEditingDose({ ...editingDose, minimumInterval: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Administration Route</Label>
                  <SearchableSelect
                    value={editingDose.route || "IM"}
                    onValueChange={(val: any) => setEditingDose({ ...editingDose, route: val })}
                    options={routeOptions}
                    placeholder="Select Administration Route..."
                    searchPlaceholder="Search route..."
                    triggerClassName="text-xs h-9"
                    width="w-[260px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Anatomical Injection Site</Label>
                  <Input
                    placeholder="e.g. Left Anterolateral Thigh, Right Deltoid"
                    value={editingDose.site || ""}
                    onChange={(e) => setEditingDose({ ...editingDose, site: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Target Population Group</Label>
                  <SearchableSelect
                    value={editingDose.targetPopulationGroup || "infants"}
                    onValueChange={(val) => setEditingDose({ ...editingDose, targetPopulationGroup: val })}
                    options={targetPopulationGroupOptions}
                    placeholder="Select Target Group..."
                    searchPlaceholder="Search group..."
                    triggerClassName="text-xs h-9"
                    width="w-[280px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Classification</Label>
                  <SearchableSelect
                    value={editingDose.classification || "routine"}
                    onValueChange={(val: any) => setEditingDose({ ...editingDose, classification: val as any })}
                    options={classificationOptions}
                    placeholder="Select Classification..."
                    searchPlaceholder="Search classification..."
                    triggerClassName="text-xs h-9"
                    width="w-[260px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingDose.active ?? true}
                    onCheckedChange={(checked) => setEditingDose({ ...editingDose, active: checked })}
                  />
                  <Label className="font-normal cursor-pointer">Active in National Schedule</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={saveDoseMutation.isPending || !editingDose?.name || !editingDose?.vaccineId}
              onClick={() => editingDose && saveDoseMutation.mutate(editingDose)}
            >
              {saveDoseMutation.isPending ? "Saving..." : "Save Schedule Dose"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
