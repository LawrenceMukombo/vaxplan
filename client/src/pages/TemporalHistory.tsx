import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/DataTable";
import { EntityHistoryDrawer } from "@/components/history/EntityHistoryDrawer";
import { ViewAsOfDateControl } from "@/components/history/ViewAsOfDateControl";
import { ChangeApprovalScreen } from "@/components/history/ChangeApprovalScreen";
import { VersionCompareModal } from "@/components/history/VersionCompareModal";
import {
  History,
  GitCommit,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Download,
  Calendar,
  FileSpreadsheet,
  Layers,
  Building2,
  Users,
  MapPin,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TemporalHistory() {
  const [activeTab, setActiveTab] = useState("ledger");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [asOfDate, setAsOfDate] = useState<string | null>(null);

  // Drawer / Modal states
  const [drawerEntity, setDrawerEntity] = useState<{
    type: string;
    id: string;
    name?: string;
  } | null>(null);

  const [compareVersions, setCompareVersions] = useState<{
    v1: string;
    v2: string;
    entityName?: string;
  } | null>(null);

  const { toast } = useToast();

  // Fetch pending change proposals count
  const { data: pendingApprovals } = useQuery<any[]>({
    queryKey: ["/api/entity-history/pending-approvals"],
  });

  // Build query URL based on filters
  const { data: historyVersions, isLoading, isError } = useQuery<any[]>({
    queryKey: ["/api/entity-history/all", entityTypeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityTypeFilter !== "all") params.set("entityType", entityTypeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/entity-history/history?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        // Fallback demo mock if endpoint is returning structured list
        return [];
      }
      return res.json();
    },
  });

  // Filtered dataset
  const filteredData = useMemo(() => {
    const list = historyVersions || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.stableEntityId?.toLowerCase().includes(q) ||
        item.changeType?.toLowerCase().includes(q) ||
        item.changeReason?.toLowerCase().includes(q) ||
        item.createdBy?.toLowerCase().includes(q)
    );
  }, [historyVersions, searchQuery]);

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredData || filteredData.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    const headers = [
      "Version ID",
      "Entity Type",
      "Entity ID",
      "Version #",
      "Change Type",
      "Valid From",
      "Valid To",
      "Status",
      "Reason",
      "Author",
    ];
    const rows = filteredData.map((v) => [
      v.id,
      v.entityType,
      v.stableEntityId,
      v.versionNumber,
      v.changeType,
      v.validFrom ? new Date(v.validFrom).toLocaleDateString() : "",
      v.validTo ? new Date(v.validTo).toLocaleDateString() : "Current",
      v.status,
      `"${(v.changeReason || "").replace(/"/g, '""')}"`,
      v.createdBy || "",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vaxplan_temporal_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export complete", description: "Temporal history ledger exported to CSV." });
  };

  const columns = [
    {
      key: "entityType",
      header: "Entity Type",
      sortable: true,
      render: (item: any) => (
        <div className="flex items-center gap-2">
          {item.entityType === "facility" ? (
            <Building2 className="h-4 w-4 text-blue-500" />
          ) : item.entityType === "user" ? (
            <Users className="h-4 w-4 text-emerald-500" />
          ) : item.entityType === "community" ? (
            <MapPin className="h-4 w-4 text-amber-500" />
          ) : (
            <Layers className="h-4 w-4 text-purple-500" />
          )}
          <span className="capitalize font-medium text-xs">{item.entityType}</span>
        </div>
      ),
    },
    {
      key: "stableEntityId",
      header: "Entity ID",
      sortable: true,
      render: (item: any) => <span className="font-mono text-xs">{item.stableEntityId}</span>,
    },
    {
      key: "versionNumber",
      header: "Version",
      sortable: true,
      render: (item: any) => (
        <Badge variant="outline" className="font-mono text-xs">
          v{item.versionNumber}
        </Badge>
      ),
    },
    {
      key: "changeType",
      header: "Change Type",
      sortable: true,
      render: (item: any) => (
        <Badge variant="secondary" className="capitalize text-xs">
          {item.changeType?.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "validFrom",
      header: "Effective Period",
      sortable: true,
      render: (item: any) => (
        <div className="text-xs text-muted-foreground">
          <span>{item.validFrom ? new Date(item.validFrom).toLocaleDateString() : "—"}</span>
          <span className="mx-1">→</span>
          <span>{item.validTo ? new Date(item.validTo).toLocaleDateString() : "Current"}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (item: any) => {
        let variant: "default" | "secondary" | "outline" | "destructive" = "secondary";
        if (item.status === "active") variant = "default";
        if (item.status === "pending_review") variant = "outline";
        if (item.status === "corrected") variant = "destructive";
        return (
          <Badge variant={variant} className="capitalize text-xs">
            {item.status?.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
    {
      key: "changeReason",
      header: "Reason / Justification",
      render: (item: any) => (
        <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
          {item.changeReason || "No reason specified"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: any) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() =>
              setDrawerEntity({
                type: item.entityType,
                id: item.stableEntityId,
                name: `${item.entityType.toUpperCase()} #${item.stableEntityId}`,
              })
            }
          >
            <History className="h-3.5 w-3.5 mr-1 text-primary" /> History
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header with As-Of Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Enterprise Temporal History & Audit Engine</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track full version history, inspect point-in-time entity state, and manage governance approvals across VaxPlan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View As Of Date Picker */}
          <ViewAsOfDateControl asOfDate={asOfDate} onAsOfDateChange={setAsOfDate} />

          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Version Records</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{historyVersions?.length || 0}</h3>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <GitCommit className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Approvals</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {pendingApprovals?.length || 0}
              </h3>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Entities</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {historyVersions?.filter((v) => v.status === "active").length || 0}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">As-Of State Mode</p>
              <h3 className="text-sm font-semibold text-foreground mt-1">
                {asOfDate ? new Date(asOfDate).toLocaleDateString() : "Real-time Live"}
              </h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
              <Calendar className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 border">
          <TabsTrigger value="ledger" className="gap-2">
            <GitCommit className="h-4 w-4" /> Version History Ledger
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-2 relative">
            <ShieldCheck className="h-4 w-4" /> Governance & Approvals
            {(pendingApprovals?.length || 0) > 0 && (
              <Badge className="ml-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4">
                {pendingApprovals?.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Version History Ledger */}
        <TabsContent value="ledger" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-lg">Entity Version Ledger</CardTitle>
                  <CardDescription>
                    Browse immutable temporal versions across health facilities, users, communities, and reference datasets.
                  </CardDescription>
                </div>

                {/* Filters Bar */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search entity ID, reason..."
                      className="pl-9 h-9 text-xs"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                    <SelectTrigger className="w-40 h-9 text-xs">
                      <SelectValue placeholder="Entity Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Entity Types</SelectItem>
                      <SelectItem value="facility">Health Facility</SelectItem>
                      <SelectItem value="user">User / Staff</SelectItem>
                      <SelectItem value="community">Community</SelectItem>
                      <SelectItem value="population">Population</SelectItem>
                      <SelectItem value="vaccine_schedule">Vaccine Schedule</SelectItem>
                      <SelectItem value="stock_reference">Stock Reference</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36 h-9 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending_review">Pending Review</SelectItem>
                      <SelectItem value="superseded">Superseded</SelectItem>
                      <SelectItem value="corrected">Corrected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                data={filteredData}
                columns={columns}
                searchable={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Governance & Approvals */}
        <TabsContent value="approvals" className="space-y-4">
          <ChangeApprovalScreen />
        </TabsContent>
      </Tabs>

      {/* Entity History Drawer */}
      <EntityHistoryDrawer
        isOpen={!!drawerEntity}
        onClose={() => setDrawerEntity(null)}
        entityType={drawerEntity?.type || "facility"}
        entityId={drawerEntity?.id || ""}
        entityName={drawerEntity?.name}
      />

      {/* Version Comparison Modal */}
      {compareVersions && (
        <VersionCompareModal
          isOpen={true}
          onClose={() => setCompareVersions(null)}
          versionA={compareVersions.v1}
          versionB={compareVersions.v2}
        />
      )}
    </div>
  );
}
