import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  ClipboardList, CheckCircle, XCircle,
  Users, Zap, Sparkles, Plus, Settings, Edit3, Trash2, MoreHorizontal, Filter, AlertTriangle
} from "lucide-react";
import {
  useGetRecommendations, useUpdateRecommendation, useGenerateRecommendations,
  useGetRecommendationRules, useCreateRecommendationRule, useUpdateRecommendationRule, useDeleteRecommendationRule
} from "@/hooks/vgie/useVgieApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { GeoCascadeFilter } from "@/components/GeoCascadeFilter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const priorityColors: Record<string, string> = {
  high: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/10 border-red-200 dark:border-red-500/20",
  medium: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
  low: "text-muted-foreground dark:text-muted-foreground bg-muted dark:bg-background border-border dark:border-border/20",
};

const statusColors: Record<string, string> = {
  pending: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
  accepted: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
  dismissed: "text-muted-foreground dark:text-muted-foreground bg-muted dark:bg-background border-border dark:border-border/20",
};

export default function Recommendations() {
  const [activeTab, setActiveTab] = useState<string>("active");
  const [priority, setPriority] = useState<string>("all");
  const [status, setStatus] = useState<string>("pending");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [facilityId, setFacilityId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Recommendations Data
  const { data: recs, isLoading } = useGetRecommendations({
    priority: priority !== "all" ? (priority as any) : undefined,
    status: status !== "all" ? (status as any) : undefined,
    provinceId: provinceId?.toString(),
    districtId: districtId?.toString(),
    facilityId: facilityId?.toString(),
  } as any);

  const { mutate: updateRec, isPending: updating } = useUpdateRecommendation();
  const { mutate: generate, isPending: generating } = useGenerateRecommendations();

  // Rules Data
  const { data: rules, isLoading: loadingRules } = useGetRecommendationRules();
  const createRuleMutation = useCreateRecommendationRule();
  const updateRuleMutation = useUpdateRecommendationRule();
  const deleteRuleMutation = useDeleteRecommendationRule();

  // Rule dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);

  // Form states for rule
  const [ruleForm, setRuleForm] = useState({
    name: "",
    description: "",
    category: "accessibility",
    conditionSql: "",
    recommendationText: "",
    priority: "medium",
    isActive: true,
  });

  // Table Sorting, Pagination & Columns
  const [ruleSearch, setRuleSearch] = useState("");
  const [rulePage, setRulePage] = useState(1);
  const [rulePageSize, setRulePageSize] = useState(10);
  const [ruleSortColumn, setRuleSortColumn] = useState<string>("name");
  const [ruleSortDirection, setRuleSortDirection] = useState<"asc" | "desc">("asc");
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    description: true,
    category: true,
    conditionSql: true,
    priority: true,
    isActive: true,
    actions: true,
  });

  const handleAccept = (id: number) => {
    updateRec({ id, status: "accepted" }, {
      onSuccess: () => {
        toast({ title: "Recommendation accepted" });
        queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendations"] });
      },
    });
  };

  const handleDismiss = (id: number) => {
    updateRec({ id, status: "dismissed" }, {
      onSuccess: () => {
        toast({ title: "Recommendation dismissed" });
        queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendations"] });
      },
    });
  };

  const handleGenerate = () => {
    generate(undefined, {
      onSuccess: (result: any) => {
        toast({
          title: `Generated ${result.generated} new recommendations`,
          description: `Analysis completed. Found ${result.alertsGenerated ?? 0} new coverage alerts.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/vgie/alerts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/vgie/dashboard/summary"] });
      },
      onError: () => toast({ title: "Failed to generate recommendations", variant: "destructive" }),
    });
  };

  const handleAIGenerate = async () => {
    setAiGenerating(true);
    try {
      const res = await fetch("/api/vgie/recommendations/ai-generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const text = await res.text();
      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("Server returned an unexpected response. Please try again.");
      }
      if (!res.ok) throw new Error(result.error ?? "AI generation failed");
      toast({
        title: `Generated ${result.generated} recommendations`,
        description: result.generated > 0
          ? "AI-powered analysis complete. Review and accept below."
          : `${result.skipped ?? 0} settlements already had pending recommendations.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendations"] });
    } catch (err: any) {
      toast({ title: "AI generation failed", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  // Rule Form submits
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    createRuleMutation.mutate(ruleForm, {
      onSuccess: () => {
        setIsAddOpen(false);
        setRuleForm({
          name: "",
          description: "",
          category: "accessibility",
          conditionSql: "",
          recommendationText: "",
          priority: "medium",
          isActive: true,
        });
      }
    });
  };

  const handleEditRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRule) return;
    updateRuleMutation.mutate({ id: selectedRule.id, ...ruleForm }, {
      onSuccess: () => {
        setIsEditOpen(false);
        setSelectedRule(null);
      }
    });
  };

  const handleOpenEdit = (rule: any) => {
    setSelectedRule(rule);
    setRuleForm({
      name: rule.name,
      description: rule.description || "",
      category: rule.category,
      conditionSql: rule.conditionSql,
      recommendationText: rule.recommendationText,
      priority: rule.priority,
      isActive: rule.isActive,
    });
    setIsEditOpen(true);
  };

  const handleDeleteRule = (id: number) => {
    if (confirm("Are you sure you want to delete this recommendation rule?")) {
      deleteRuleMutation.mutate(id);
    }
  };

  const handleToggleActiveRule = (rule: any) => {
    updateRuleMutation.mutate({ id: rule.id, isActive: !rule.isActive });
  };

  // Rules sorting & filtering logic
  const filteredRules = useMemo(() => {
    let list = rules || [];
    if (ruleSearch) {
      const q = ruleSearch.toLowerCase();
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        r.conditionSql.toLowerCase().includes(q)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      let valA = a[ruleSortColumn];
      let valB = b[ruleSortColumn];

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return ruleSortDirection === "asc" ? -1 : 1;
      if (valA > valB) return ruleSortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [rules, ruleSearch, ruleSortColumn, ruleSortDirection]);

  // Paginated rules
  const paginatedRules = useMemo(() => {
    const start = (rulePage - 1) * rulePageSize;
    return filteredRules.slice(start, start + rulePageSize);
  }, [filteredRules, rulePage, rulePageSize]);

  const totalRulePages = Math.ceil(filteredRules.length / rulePageSize);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Recommendations & Rules Engine
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure dynamic rules and manage automated actions to address immunisation gaps.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleGenerate}
            disabled={generating}
            variant="outline"
            className="text-foreground border hover:bg-accent text-sm"
            size="sm"
          >
            <Zap className="w-4 h-4 mr-1.5 text-amber-400" />
            {generating ? "Running Analysis..." : "Run Catchment Analysis"}
          </Button>
          <Button
            onClick={handleAIGenerate}
            disabled={aiGenerating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm"
            size="sm"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            {aiGenerating ? "AI Processing..." : "AI Generate Recs"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0">
          <TabsTrigger
            value="active"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-4 py-2"
          >
            Active Recommendations ({recs?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger
            value="rules"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-4 py-2"
          >
            Rules Configuration ({rules?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-5 focus-visible:outline-none">
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-muted-foreground flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">AI Recommendation Generator</span> uses advanced gridded spatial calculations alongside local healthcare metrics to propose actions for unassigned, isolated or high-risk settlements.
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <GeoCascadeFilter
              provinceId={provinceId}
              districtId={districtId}
              facilityId={facilityId}
              onProvinceChange={setProvinceId}
              onDistrictChange={setDistrictId}
              onFacilityChange={setFacilityId}
              showFacility={true}
            />

            {(status !== "all" || priority !== "all" || provinceId || districtId || facilityId) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStatus("all");
                  setPriority("all");
                  setProvinceId(null);
                  setDistrictId(null);
                  setFacilityId(null);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Listing */}
          <div className="grid gap-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Skeleton className="h-16 w-full rounded" />
                  </CardContent>
                </Card>
              ))
            ) : (recs ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed rounded-xl bg-card">
                <CheckCircle className="w-10 h-10 mb-2.5 text-emerald-600 dark:text-emerald-500" />
                <p className="text-sm font-semibold">No recommendations found</p>
                <p className="text-xs text-muted-foreground mt-0.5">Try running catchment analysis to find new coverage opportunities.</p>
              </div>
            ) : (
              (recs ?? []).map((rec: any) => (
                <Card key={rec.id} className="hover:border-primary/50 transition-colors bg-card shadow-sm">
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] uppercase font-semibold px-2 py-0 border ${priorityColors[rec.priority]}`}>
                          {rec.priority}
                        </Badge>
                        <Badge className={`text-[10px] uppercase font-semibold px-2 py-0 border ${statusColors[rec.status]}`}>
                          {rec.status}
                        </Badge>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground mt-2">{rec.recommendationType}</h4>
                      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                        <Link
                          href={`/settlements/${rec.settlementId}`}
                          className="text-primary hover:underline font-medium flex items-center gap-1.5"
                        >
                          <ClipboardList className="w-3.5 h-3.5" /> {rec.settlementName ?? `Settlement #${rec.settlementId}`}
                        </Link>
                        {rec.expectedChildren != null && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> {rec.expectedChildren} children U5
                          </span>
                        )}
                      </div>
                      {rec.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed mt-2 bg-muted/30 p-2.5 rounded-lg border border-border/40 max-w-3xl">
                          {rec.description}
                        </p>
                      )}
                    </div>
                    {rec.status === "pending" && (
                      <div className="flex gap-2 shrink-0 self-end md:self-center">
                        <Button
                          size="sm"
                          className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          onClick={() => handleAccept(rec.id)}
                          disabled={updating}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900/30"
                          onClick={() => handleDismiss(rec.id)}
                          disabled={updating}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Dismiss
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 focus-visible:outline-none">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Search rules..."
                className="w-64 h-9 text-sm"
                value={ruleSearch}
                onChange={e => setRuleSearch(e.target.value)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                    <Filter className="w-3.5 h-3.5" /> Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {Object.keys(visibleColumns).map(col => (
                    <DropdownMenuCheckboxItem
                      key={col}
                      checked={visibleColumns[col]}
                      onCheckedChange={checked => setVisibleColumns(prev => ({ ...prev, [col]: checked }))}
                      className="capitalize"
                    >
                      {col.replace(/([A-Z])/g, " $1")}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <Button onClick={() => setIsAddOpen(true)} size="sm" className="h-9 font-semibold gap-1.5">
                <Plus className="w-4 h-4" /> Add Rule
              </Button>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Recommendation Rule</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddRule} className="space-y-4 pt-2">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Rule Name</Label>
                    <Input
                      id="name"
                      required
                      value={ruleForm.name}
                      onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Defaulter Alert"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={ruleForm.description}
                      onChange={e => setRuleForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="What does this rule identify?"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={ruleForm.category}
                        onValueChange={v => setRuleForm(p => ({ ...p, category: v }))}
                      >
                        <SelectTrigger id="category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="accessibility">Accessibility</SelectItem>
                          <SelectItem value="population">Population</SelectItem>
                          <SelectItem value="coverage">Coverage</SelectItem>
                          <SelectItem value="infrastructure">Infrastructure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={ruleForm.priority}
                        onValueChange={v => setRuleForm(p => ({ ...p, priority: v }))}
                      >
                        <SelectTrigger id="priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="conditionSql">SQL Condition (evaluated on villages)</Label>
                      <span className="text-[10px] text-muted-foreground font-mono">village columns: assigned_facility_id, distance_to_facility, etc.</span>
                    </div>
                    <Input
                      id="conditionSql"
                      required
                      value={ruleForm.conditionSql}
                      onChange={e => setRuleForm(p => ({ ...p, conditionSql: e.target.value }))}
                      placeholder="e.g. is_hard_to_reach = true AND assigned_facility_id IS NULL"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="recommendationText">Action/Recommendation Text</Label>
                    <Textarea
                      id="recommendationText"
                      required
                      value={ruleForm.recommendationText}
                      onChange={e => setRuleForm(p => ({ ...p, recommendationText: e.target.value }))}
                      placeholder="What action should be recommended when this triggers?"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={ruleForm.isActive}
                      onCheckedChange={checked => setRuleForm(p => ({ ...p, isActive: checked }))}
                    />
                    <Label htmlFor="isActive">Active Rule</Label>
                  </div>
                  <DialogFooter className="pt-2">
                    <DialogClose asChild>
                      <Button variant="outline" type="button">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" className="bg-primary">Save Rule</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Rules Table */}
          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="overflow-x-auto relative">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    {visibleColumns.name && (
                      <TableHead
                        onClick={() => {
                          setRuleSortColumn("name");
                          setRuleSortDirection(p => p === "asc" ? "desc" : "asc");
                        }}
                        className="cursor-pointer font-bold text-foreground"
                      >
                        Rule Name {ruleSortColumn === "name" && (ruleSortDirection === "asc" ? "▲" : "▼")}
                      </TableHead>
                    )}
                    {visibleColumns.description && <TableHead className="font-bold text-foreground">Description</TableHead>}
                    {visibleColumns.category && (
                      <TableHead
                        onClick={() => {
                          setRuleSortColumn("category");
                          setRuleSortDirection(p => p === "asc" ? "desc" : "asc");
                        }}
                        className="cursor-pointer font-bold text-foreground"
                      >
                        Category {ruleSortColumn === "category" && (ruleSortDirection === "asc" ? "▲" : "▼")}
                      </TableHead>
                    )}
                    {visibleColumns.conditionSql && <TableHead className="font-mono text-xs font-bold text-foreground">SQL Condition</TableHead>}
                    {visibleColumns.priority && (
                      <TableHead
                        onClick={() => {
                          setRuleSortColumn("priority");
                          setRuleSortDirection(p => p === "asc" ? "desc" : "asc");
                        }}
                        className="cursor-pointer font-bold text-foreground"
                      >
                        Priority {ruleSortColumn === "priority" && (ruleSortDirection === "asc" ? "▲" : "▼")}
                      </TableHead>
                    )}
                    {visibleColumns.isActive && <TableHead className="font-bold text-foreground">Status</TableHead>}
                    {visibleColumns.actions && <TableHead className="w-20 text-right font-bold text-foreground">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingRules ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Object.keys(visibleColumns).filter(c => visibleColumns[c]).map((_, idx) => (
                          <TableCell key={idx}>
                            <Skeleton className="h-6 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : paginatedRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={Object.keys(visibleColumns).filter(c => visibleColumns[c]).length} className="text-center py-8 text-muted-foreground">
                        No rules matching filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRules.map(rule => (
                      <TableRow key={rule.id} className="hover:bg-muted/10 transition-colors">
                        {visibleColumns.name && (
                          <TableCell className="font-medium text-foreground">
                            {rule.name}
                          </TableCell>
                        )}
                        {visibleColumns.description && (
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {rule.description || "—"}
                          </TableCell>
                        )}
                        {visibleColumns.category && (
                          <TableCell className="capitalize text-xs">
                            {rule.category}
                          </TableCell>
                        )}
                        {visibleColumns.conditionSql && (
                          <TableCell className="font-mono text-xs text-slate-400 bg-slate-900/5 dark:bg-slate-900/40 p-1.5 rounded border border-border/20 max-w-[250px] truncate">
                            {rule.conditionSql}
                          </TableCell>
                        )}
                        {visibleColumns.priority && (
                          <TableCell>
                            <Badge className={`text-[10px] uppercase px-1.5 py-0 border ${priorityColors[rule.priority]}`}>
                              {rule.priority}
                            </Badge>
                          </TableCell>
                        )}
                        {visibleColumns.isActive && (
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={rule.isActive}
                                onCheckedChange={() => handleToggleActiveRule(rule)}
                              />
                              <span className="text-xs text-muted-foreground">
                                {rule.isActive ? "Active" : "Disabled"}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        {visibleColumns.actions && (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenEdit(rule)} className="gap-2 text-xs">
                                  <Edit3 className="w-3.5 h-3.5 text-primary" /> Edit Rule
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteRule(rule.id)} className="gap-2 text-xs text-rose-500 hover:text-rose-600">
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Delete Rule
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalRulePages > 1 && (
              <div className="flex items-center justify-between p-4 border-t bg-muted/10">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Page size:</span>
                  <Select
                    value={String(rulePageSize)}
                    onValueChange={v => {
                      setRulePageSize(Number(v));
                      setRulePage(1);
                    }}
                  >
                    <SelectTrigger className="h-7 w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>
                    Showing {(rulePage - 1) * rulePageSize + 1} - {Math.min(rulePage * rulePageSize, filteredRules.length)} of {filteredRules.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setRulePage(p => Math.max(1, p - 1))}
                    disabled={rulePage === 1}
                  >
                    {"<"}
                  </Button>
                  {Array.from({ length: totalRulePages }).map((_, idx) => (
                    <Button
                      key={idx}
                      variant={rulePage === idx + 1 ? "default" : "outline"}
                      className="h-8 w-8 text-xs font-semibold"
                      onClick={() => setRulePage(idx + 1)}
                    >
                      {idx + 1}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setRulePage(p => Math.min(totalRulePages, p + 1))}
                    disabled={rulePage === totalRulePages}
                  >
                    {">"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Edit Rule Dialog */}
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Recommendation Rule</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditRule} className="space-y-4 pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Rule Name</Label>
                  <Input
                    id="edit-name"
                    required
                    value={ruleForm.name}
                    onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={ruleForm.description}
                    onChange={e => setRuleForm(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-category">Category</Label>
                    <Select
                      value={ruleForm.category}
                      onValueChange={v => setRuleForm(p => ({ ...p, category: v }))}
                    >
                      <SelectTrigger id="edit-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accessibility">Accessibility</SelectItem>
                        <SelectItem value="population">Population</SelectItem>
                        <SelectItem value="coverage">Coverage</SelectItem>
                        <SelectItem value="infrastructure">Infrastructure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-priority">Priority</Label>
                    <Select
                      value={ruleForm.priority}
                      onValueChange={v => setRuleForm(p => ({ ...p, priority: v }))}
                    >
                      <SelectTrigger id="edit-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-conditionSql">SQL Condition (evaluated on villages)</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">village columns: assigned_facility_id, distance_to_facility, etc.</span>
                  </div>
                  <Input
                    id="edit-conditionSql"
                    required
                    value={ruleForm.conditionSql}
                    onChange={e => setRuleForm(p => ({ ...p, conditionSql: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-recommendationText">Action/Recommendation Text</Label>
                  <Textarea
                    id="edit-recommendationText"
                    required
                    value={ruleForm.recommendationText}
                    onChange={e => setRuleForm(p => ({ ...p, recommendationText: e.target.value }))}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-isActive"
                    checked={ruleForm.isActive}
                    onCheckedChange={checked => setRuleForm(p => ({ ...p, isActive: checked }))}
                  />
                  <Label htmlFor="edit-isActive">Active Rule</Label>
                </div>
                <DialogFooter className="pt-2">
                  <DialogClose asChild>
                    <Button variant="outline" type="button" onClick={() => setSelectedRule(null)}>Cancel</Button>
                  </DialogClose>
                  <Button type="submit" className="bg-primary">Save Changes</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
