import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DataTable } from "@/components/DataTable";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import {
  Calendar,
  Sparkles,
  Plus,
  CheckCircle2,
  Trash2,
  FolderOpen,
  Eye,
  Pencil,
  ShieldCheck
} from "lucide-react";
import type { SessionPlan } from "@shared/schema";
import { ROLE_PERMISSIONS, type Permission } from "@shared/permissions";

interface MicroplanListProps {
  planType: "routine" | "campaign";
}

type MicroplanRow = Record<string, any> & {
  createdAtMs: number | null;
  createdDateLabel: string;
  plannedSessionCount: number;
  completedSessionCount: number;
};

function formatCreatedDate(value: unknown): string {
  if (!value) return "Not recorded";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(date);
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

function permissionsForUser(user: any): Set<Permission> {
  const roles = new Set<string>([
    user?.role,
    ...(Array.isArray(user?.roles) ? user.roles : []),
  ].filter(Boolean));
  const permissions = new Set<Permission>();
  roles.forEach((role) => (ROLE_PERMISSIONS[role] ?? []).forEach((permission) => permissions.add(permission)));
  if (Array.isArray(user?.permissions)) {
    user.permissions.forEach((permission: Permission) => permissions.add(permission));
  }
  return permissions;
}

function isAdminUser(user: any): boolean {
  const roles = [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])].filter(Boolean);
  return Boolean(user?.isPlatformAdmin || roles.includes("national_admin"));
}

export default function MicroplanList({ planType }: MicroplanListProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
    try {
      await apiRequest("DELETE", `/api/microplans/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/microplans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Microplan deleted",
        description: "The microplan has been permanently deleted.",
      });
      setDeleteId(null);
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Could not delete the microplan.",
        variant: "destructive",
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  const permissionState = useMemo(() => {
    const permissions = permissionsForUser(user);
    const admin = isAdminUser(user);
    return {
      canView: admin || permissions.has("view_session_plans") || permissions.has("manage_session_plans") || permissions.has("approve_plans"),
      canCreate: admin || permissions.has("manage_session_plans"),
      canEdit: admin || permissions.has("manage_session_plans"),
      canApprove: admin || permissions.has("approve_plans"),
      canDelete: admin || permissions.has("manage_session_plans"),
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
        return {
          ...m,
          period: `Q${m.quarter} ${m.year}`,
          createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null,
          createdDateLabel: formatCreatedDate(m.createdAt),
          plannedSessionCount: rows.length,
          completedSessionCount,
        };
      });
  }, [microplans, planType, sessionsByPlan]);

  const columns = useMemo(() => [
    {
      key: "name",
      header: "Plan Name",
      sortable: true,
      render: (m: any) => (
        <button
          onClick={() => setLocation(`/microplans/${planType === "campaign" ? "campaigns" : "routine"}/${m.id}`)}
          className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline text-left text-sm"
          data-testid={`button-open-microplan-name-${m.id}`}
        >
          {m.name}
        </button>
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
        const label =
          s === "pending"
            ? "Pending approval"
            : s === "approved"
              ? "Approved"
              : s === "locked"
                ? "Locked"
                : "Draft";
        const variant: "default" | "secondary" | "outline" =
          s === "approved" ? "default" : s === "pending" ? "secondary" : "outline";
        return (
          <Badge variant={variant} className="gap-1 rounded-md capitalize" data-testid={`microplan-status-${m.id}`}>
            {label}
          </Badge>
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
        const isReadOnly = status === "pending" || status === "submitted" || status === "locked";
        const canEditThisPlan = permissionState.canEdit && !isReadOnly;
        const canReviewThisPlan = permissionState.canApprove && isSubmitted;
        const canDeleteThisPlan = permissionState.canDelete && ["draft", "returned", "rejected"].includes(status);
        const PrimaryIcon = canReviewThisPlan ? ShieldCheck : canEditThisPlan ? Pencil : Eye;
        const primaryLabel = canReviewThisPlan ? "Review" : canEditThisPlan ? "Edit Plan" : "View Plan";

        return (
          <div className="flex items-center gap-2">
            {permissionState.canView && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLocation(openPath)}
                className="rounded-xl font-semibold text-xs px-3 gap-1.5"
                data-testid={`button-open-microplan-${m.id}`}
              >
                <PrimaryIcon className="h-3.5 w-3.5" />
                {primaryLabel}
              </Button>
            )}
            {canDeleteThisPlan && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 rounded-xl"
                onClick={() => setDeleteId(m.id)}
                title="Delete draft microplan"
                data-testid={`button-delete-microplan-${m.id}`}
              >
                <Trash2 className="h-4 w-4" />
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

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete saved microplan?"
        description="This will permanently delete this microplan and all of its planned sessions. This action cannot be undone."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        isPending={deleteBusy}
      />
    </div>
  );
}







