import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DataTable } from "@/components/DataTable";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MicroplanRollupDashboard } from "@/components/microplan/MicroplanRollupDashboard";
import {
  Calendar,
  Sparkles,
  Plus,
  CheckCircle2,
  Trash2,
  FolderOpen,
  Eye,
  Pencil,
  PencilLine,
  Loader2,
  ShieldCheck,
  Layers,
  Activity,
  FileSpreadsheet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SessionPlan, Facility } from "@shared/schema";
import { offlineDb } from "@/lib/offlineDb";
import { hasAnyPermission, isNationalAdmin } from "@/lib/accessControl";

interface MicroplanListProps {
  planType: "routine" | "campaign";
  initialTab?: string;
}

type MicroplanRow = Record<string, any> & {
  createdAtMs: number | null;
  createdDateLabel: string;
  plannedSessionCount: number;
  completedSessionCount: number;
};

function formatFullDateTime(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCreatedDate(value: unknown): string {
  if (!value) return "Not recorded";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizedStatus(plan: any): string {
  return String(plan?.status ?? "draft").toLowerCase();
}

function isCompletedSession(session: SessionPlan): boolean {
  const status = String((session as any).status ?? "").toLowerCase();
  return Boolean(
    session.completedAt ||
      (session as any).isAchieved ||
      status === "conducted" ||
      status === "completed" ||
      status === "done"
  );
}

function isAdminUser(user: any): boolean {
  const roles = [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])].filter(Boolean);
  return Boolean(user?.isPlatformAdmin || roles.includes("national_admin"));
}

export default function MicroplanList({ planType, initialTab }: MicroplanListProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const isManagerOrAdmin = useMemo(() => {
    const roles = [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])].filter(Boolean);
    return Boolean(
      isAdminUser(user) ||
      roles.some((r: any) =>
        typeof r === "string" && (
          r.includes("supervisor") ||
          r.includes("manager") ||
          r.includes("admin") ||
          r.includes("coordinator")
        )
      ) ||
      user?.districtId ||
      user?.provinceId
    );
  }, [user]);

  const searchTab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;
  const resolvedDefaultTab = initialTab || searchTab || (isManagerOrAdmin ? (planType === "campaign" ? "realtime" : "rollup") : "plans");
  const [activeTab, setActiveTab] = useState<string>(resolvedDefaultTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (searchTab) {
      setActiveTab(searchTab);
    }
  }, [initialTab, searchTab]);

  const { data: facilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });

  const facilityMap = useMemo(() => {
    const map = new Map<number, Facility>();
    (facilities ?? []).forEach((f) => map.set(f.id, f));
    return map;
  }, [facilities]);

  const { data: microplans, isLoading: loadingPlans } = useQuery<any[]>({
    queryKey: ["/api/microplans"],
  });

  const { data: sessions } = useQuery<SessionPlan[]>({
    queryKey: ["/api/sessions"],
  });

  const sessionsByPlan = useMemo(() => {
    const m = new Map<number, SessionPlan[]>();
    for (const s of sessions ?? []) {
      if (s.microplanId == null) continue;
      const arr = m.get(s.microplanId) ?? [];
      arr.push(s);
      m.set(s.microplanId, arr);
    }
    return m;
  }, [sessions]);

  const handleDelete = async (id: number) => {
    setDeleteBusy(true);
    // Optimistically remove from query cache immediately so it disappears with zero lag
    const prevList = queryClient.getQueryData<any[]>(["/api/microplans"]);
    queryClient.setQueryData<any[]>(["/api/microplans"], (old) =>
      Array.isArray(old) ? old.filter((p: any) => p.id !== id) : old
    );

    try {
      await apiRequest("DELETE", `/api/microplans/${id}`);
      try {
        await offlineDb.microplans.delete(id);
      } catch {}
      queryClient.invalidateQueries({ queryKey: ["/api/microplans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Microplan deleted",
        description: "The microplan has been permanently deleted.",
      });
      setDeleteId(null);
    } catch (error: any) {
      if (error?.message?.includes("404") || error?.message?.includes("not found")) {
        // Idempotent: already deleted on server, clean up locally
        try {
          await offlineDb.microplans.delete(id);
        } catch {}
        queryClient.invalidateQueries({ queryKey: ["/api/microplans"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
        toast({
          title: "Microplan deleted",
          description: "The microplan has been removed.",
        });
        setDeleteId(null);
      } else {
        queryClient.setQueryData(["/api/microplans"], prevList);
        toast({
          title: "Delete failed",
          description: error?.message || "Could not delete the microplan.",
          variant: "destructive",
        });
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  const [renamePlan, setRenamePlan] = useState<{ id: number; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const handleRename = async () => {
    if (!renamePlan || !renameValue.trim()) return;
    setRenameBusy(true);
    try {
      await apiRequest("PATCH", `/api/microplans/${renamePlan.id}`, { name: renameValue.trim() });
      toast({
        title: "Microplan renamed",
        description: `Successfully renamed to "${renameValue.trim()}".`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/microplans"] });
      setRenamePlan(null);
    } catch (error: any) {
      toast({
        title: "Rename failed",
        description: error?.message || "Could not rename the microplan.",
        variant: "destructive",
      });
    } finally {
      setRenameBusy(false);
    }
  };

  const permissionState = useMemo(() => {
    const admin = isAdminUser(user) || isNationalAdmin(user);
    return {
      canView: admin || hasAnyPermission(user, ["microplans.view", "view_session_plans", "manage_session_plans"]),
      canCreate: admin || hasAnyPermission(user, ["microplans.create", "manage_session_plans"]),
      canEdit: admin || hasAnyPermission(user, ["microplans.update_draft", "manage_session_plans"]),
      canApprove: admin || hasAnyPermission(user, ["microplans.review", "microplans.approve", "approve_plans"]),
    };
  }, [user]);

  const filtered = useMemo<MicroplanRow[]>(() => {
    return (microplans ?? [])
      .filter((m) => {
        const pt = String(m.planType ?? "");
        return planType === "campaign"
          ? pt.includes("campaign")
          : !pt.includes("campaign");
      })
      .map((m) => {
        const rows = sessionsByPlan.get(Number(m.id)) ?? [];
        const completedSessionCount = rows.filter(isCompletedSession).length;
        const createdAtMs = m.createdAt ? new Date(String(m.createdAt)).getTime() : null;
        const fac = m.facilityId ? facilityMap.get(Number(m.facilityId)) : null;
          const approvedAtVal = m.approvedAt || (m.status === "approved" || m.status === "auto_approved" ? m.autoApprovedAt || m.updatedAt : null);
          const approvedAtMs = approvedAtVal ? new Date(String(approvedAtVal)).getTime() : null;
          const approvedDateLabel = approvedAtVal ? formatFullDateTime(approvedAtVal) : "—";
          const submittedDateLabel = m.submittedAt ? formatFullDateTime(m.submittedAt) : "—";
          return {
            ...m,
            period: `Q${m.quarter} ${m.year}`,
            facilityName: fac?.name ?? (m.facilityId ? `Facility #${m.facilityId}` : "Unspecified / Global"),
            districtName: (fac as any)?.districtName ?? "",
            createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null,
            createdDateLabel: formatCreatedDate(m.createdAt),
            approvedAtMs: Number.isFinite(approvedAtMs) ? approvedAtMs : null,
            approvedDateLabel,
            submittedDateLabel,
            plannedSessionCount: rows.length,
            completedSessionCount,
          };
      })
      // Sort newly created and developed draft plans to the very top!
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  }, [microplans, planType, sessionsByPlan, facilityMap]);

  const columns = useMemo(() => [
    {
      key: "name",
      header: "Plan Name",
      sortable: true,
      render: (m: any) => {
        const openPath = `/microplans/${planType === "campaign" ? "campaigns" : "routine"}/${m.id}`;
        return (
          <div className="flex items-center gap-1.5 group">
            <button
              type="button"
              onClick={() => setLocation(openPath)}
              className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline text-left text-sm"
              data-testid={`button-open-microplan-name-${m.id}`}
            >
              {m.name}
            </button>
            {permissionState.canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                title="Rename plan"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamePlan({ id: m.id, name: m.name });
                  setRenameValue(m.name);
                }}
                data-testid={`button-rename-icon-${m.id}`}
              >
                <PencilLine className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      },
    },
    {
      key: "facilityName",
      header: "Health Facility",
      sortable: true,
      render: (m: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground text-sm">{m.facilityName}</span>
          {m.districtName && (
            <span className="text-xs text-muted-foreground">{m.districtName}</span>
          )}
        </div>
      ),
    },
    {
      key: "period",
      header: "Quarter / Year",
      sortable: true,
      render: (m: any) => m.period,
    },
    {
      key: "createdAtMs",
      header: "Created",
      sortable: true,
      render: (m: any) => (
        <span className="text-sm text-muted-foreground" data-testid={`microplan-created-${m.id}`}>
          {m.createdDateLabel}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (m: any) => {
        const s = String(m.status ?? "draft").toLowerCase();
        const isApproved = s === "approved" || s === "auto_approved";
        const label =
          s === "pending"
            ? "Pending approval"
            : s === "approved"
              ? "Approved"
              : s === "auto_approved"
                ? "Auto-Approved"
                : s === "locked"
                  ? "Locked"
                  : "Draft";
        const variant: "default" | "secondary" | "outline" =
          isApproved ? "default" : s === "pending" ? "secondary" : "outline";
        return (
          <div className="space-y-1">
            <Badge variant={variant} className="gap-1 rounded-md capitalize font-medium" data-testid={`microplan-status-${m.id}`}>
              {label}
            </Badge>
            {isApproved && m.approvedDateLabel && m.approvedDateLabel !== "—" && (
              <span className="block text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                Endorsed: {m.approvedDateLabel}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "approvedAtMs",
      header: "Approved At",
      sortable: true,
      render: (m: any) => {
        if (!m.approvedDateLabel || m.approvedDateLabel === "—") {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="text-xs space-y-0.5" data-testid={`microplan-approved-at-${m.id}`}>
            <span className="font-semibold text-foreground">{m.approvedDateLabel}</span>
            {m.autoApprovedAt ? (
              <span className="block text-[10px] text-muted-foreground">Automated 14-day policy</span>
            ) : (
              <span className="block text-[10px] text-muted-foreground">Official sign-off recorded</span>
            )}
          </div>
        );
      },
    },
    {
      key: "plannedSessionCount",
      header: "Planned Sessions",
      sortable: true,
      render: (m: any) => (
        <Badge variant="secondary" className="gap-1 rounded-md" title="Total sessions scheduled in this microplan">
          <Calendar className="h-3 w-3 text-indigo-500" />
          {m.plannedSessionCount} planned
        </Badge>
      ),
    },
    {
      key: "completedSessionCount",
      header: "Completed Sessions",
      sortable: true,
      render: (m: any) => (
        <Badge variant="outline" className="gap-1 rounded-md border-emerald-500/35 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5" title="Sessions marked achieved, conducted, completed, or done">
          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          {m.completedSessionCount} done
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (m: any) => {
        const status = normalizedStatus(m);
        const openPath = `/microplans/${planType === "campaign" ? "campaigns" : "routine"}/${m.id}`;
        const isSubmitted = status === "pending" || status === "submitted";
        const isApproved = status === "approved" || status === "auto_approved";
        const isReadOnly = isApproved || isSubmitted || status === "locked" || status === "archived" || status === "superseded";
        const canEditThisPlan = permissionState.canEdit && !isReadOnly;
        const canReviewThisPlan = permissionState.canApprove && isSubmitted;
        // If a draft is visible in the user's already-scoped list, always show
        // the action. The API remains authoritative for permission and
        // geographic enforcement. Hiding this behind a second client-side
        // permission calculation made valid draft owners/admins unable to
        // discover the action when effective permissions arrived in a
        // different auth payload shape.
        const canDeleteThisPlan = status === "draft";
        const PrimaryIcon = canReviewThisPlan ? ShieldCheck : canEditThisPlan ? Pencil : Eye;
        const primaryLabel = canReviewThisPlan ? "Review" : canEditThisPlan ? "Edit Plan" : "View Plan";

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {permissionState.canView && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLocation(openPath)}
                className="order-1 rounded-xl font-semibold text-xs px-3 gap-1.5"
                data-testid={`button-open-microplan-${m.id}`}
              >
                <PrimaryIcon className="h-3.5 w-3.5" />
                {primaryLabel}
              </Button>
            )}
            {permissionState.canEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="order-3 rounded-xl font-semibold text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setRenamePlan({ id: m.id, name: m.name });
                  setRenameValue(m.name);
                }}
                title="Rename microplan"
                data-testid={`button-rename-microplan-${m.id}`}
              >
                <PencilLine className="h-3.5 w-3.5" />
                Rename
              </Button>
            )}
            {canDeleteThisPlan && (
              <Button
                size="sm"
                variant="outline"
                className="order-2 text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl font-semibold text-xs px-2 gap-1"
                onClick={() => setDeleteId(m.id)}
                title="Delete draft microplan"
                data-testid={`button-delete-microplan-${m.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete draft
              </Button>
            )}
          </div>
        );
      },
    },
  ], [permissionState, planType, setLocation]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            {planType === "campaign" ? (
              <>
                <Sparkles className="h-8 w-8 text-indigo-500" />
                SIA Campaigns
              </>
            ) : (
              <>
                <Calendar className="h-8 w-8 text-indigo-500" />
                Routine Microplanning
              </>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Manage, review, and author hierarchical health microplans for target communities.
          </p>
        </div>
        {permissionState.canCreate && (
          <Button
            onClick={() => setLocation(`/microplans/${planType === "campaign" ? "campaigns" : "routine"}/new`)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-5 py-2.5 font-bold shadow-md flex items-center gap-2 text-sm whitespace-nowrap self-start sm:self-center"
            data-testid="button-create-new-microplan"
          >
            <Plus className="h-4 w-4" />
            {planType === "campaign" ? "Create Campaign Plan" : "Create Routine Plan"}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <TabsList className="bg-muted/60 p-1 rounded-xl h-11 border border-border/40">
            {planType === "campaign" ? (
              <>
                <TabsTrigger
                  value="plans"
                  className="gap-2 rounded-lg px-4 font-bold text-xs data-[state=active]:bg-card data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm"
                  data-testid="tab-individual-plans"
                >
                  <FolderOpen className="h-4 w-4" />
                  SIA Microplans
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px] font-semibold">
                    {filtered.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="realtime"
                  className="gap-2 rounded-lg px-4 font-bold text-xs data-[state=active]:bg-card data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm"
                  data-testid="tab-campaign-realtime"
                >
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Real-Time Dashboard
                </TabsTrigger>
                <TabsTrigger
                  value="summary"
                  className="gap-2 rounded-lg px-4 font-bold text-xs data-[state=active]:bg-card data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm"
                  data-testid="tab-campaign-summary"
                >
                  <FileSpreadsheet className="h-4 w-4 text-amber-500" />
                  Campaign Summary Sheets
                </TabsTrigger>
                <TabsTrigger
                  value="rollup"
                  className="gap-2 rounded-lg px-4 font-bold text-xs data-[state=active]:bg-card data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm"
                  data-testid="tab-aggregates-rollup"
                >
                  <Layers className="h-4 w-4 text-indigo-500" />
                  District Aggregates
                </TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger
                  value="rollup"
                  className="gap-2 rounded-lg px-4 font-bold text-xs data-[state=active]:bg-card data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm"
                  data-testid="tab-aggregates-rollup"
                >
                  <Layers className="h-4 w-4" />
                  Aggregates & Rollup
                </TabsTrigger>
                <TabsTrigger
                  value="plans"
                  className="gap-2 rounded-lg px-4 font-bold text-xs data-[state=active]:bg-card data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm"
                  data-testid="tab-individual-plans"
                >
                  <FolderOpen className="h-4 w-4" />
                  Individual Microplans
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px] font-semibold">
                    {filtered.length}
                  </Badge>
                </TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        <TabsContent value="realtime" className="mt-0 focus-visible:outline-none">
          <MicroplanRollupDashboard
            initialPlanType="campaign"
            onOpenPlan={(planId, pType) => {
              setLocation(`/microplans/${pType.includes("campaign") ? "campaigns" : "routine"}/${planId}`);
            }}
          />
        </TabsContent>

        <TabsContent value="summary" className="mt-0 focus-visible:outline-none">
          <MicroplanRollupDashboard
            initialPlanType="campaign"
            onOpenPlan={(planId, pType) => {
              setLocation(`/microplans/${pType.includes("campaign") ? "campaigns" : "routine"}/${planId}`);
            }}
          />
        </TabsContent>

        <TabsContent value="rollup" className="mt-0 focus-visible:outline-none">
          <MicroplanRollupDashboard
            initialPlanType={planType}
            onOpenPlan={(planId, pType) => {
              setLocation(`/microplans/${pType.includes("campaign") ? "campaigns" : "routine"}/${planId}`);
            }}
          />
        </TabsContent>

        <TabsContent value="plans" className="mt-0 focus-visible:outline-none">
          <Card className="rounded-3xl border border-border/80 shadow-lg bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-indigo-500" />
                Saved Microplans
              </CardTitle>
              <CardDescription>
                Click a microplan's name or the Open button to edit its target locations, forecast, budgets, and scheduling parameters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPlans ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 dark:border-indigo-400"></div>
                  <p className="text-muted-foreground text-xs mt-3">Loading plans...</p>
                </div>
              ) : (
                <DataTable
                  data={filtered}
                  columns={columns}
                  searchable={true}
                  searchKeys={["name"]}
                  pageSize={10}
                  emptyMessage="No saved microplans found. Click the button above to create your first plan."
                  searchPlaceholder="Search saved plans..."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete saved microplan?"
        description="This will remove the draft microplan from active planning. Submitted, approved, returned, and rejected plans cannot be deleted."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        isPending={deleteBusy}
      />

      <Dialog
        open={renamePlan !== null}
        onOpenChange={(open) => {
          if (!open && !renameBusy) setRenamePlan(null);
        }}
      >
        <DialogContent className="sm:max-w-md" data-testid="dialog-rename-microplan">
          <DialogHeader>
            <DialogTitle>Rename Microplan</DialogTitle>
            <DialogDescription>
              Update the display name for this microplan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rename-plan-input">Microplan Name</Label>
              <Input
                id="rename-plan-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Enter plan name..."
                disabled={renameBusy}
                data-testid="input-rename-microplan"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameValue.trim() && !renameBusy) {
                    e.preventDefault();
                    void handleRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRenamePlan(null)}
              disabled={renameBusy}
              data-testid="button-cancel-rename"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleRename()}
              disabled={renameBusy || !renameValue.trim() || renameValue.trim() === renamePlan?.name}
              data-testid="button-confirm-rename"
            >
              {renameBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save Name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}







