import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/DataTable";
import { ApprovalBadge } from "@/components/ApprovalBadge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { offlineDb } from "@/lib/offlineDb";
import { syncEngine } from "@/lib/syncEngine";
import { useLocation } from "wouter";
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
  User,
  Undo2,
  History,
  Eye,
  Check,
  ExternalLink,
  CheckCheck,
  Sparkles,
  ShieldCheck,
  Layers,
  ListChecks,
  Users,
  Building2,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type {
  ApprovalRequest,
  Tenant,
  Province,
  District,
  Facility,
  Village,
  SessionPlan,
  PopulationData,
  Microplan,
} from "@shared/schema";
import { format } from "date-fns";
import { GeoCascadeFilter } from "@/components/GeoCascadeFilter";
import { buildGeoMaps, getRecordHierarchy } from "@/lib/geoHierarchy";

import { ChangeApprovalScreen } from "@/components/history/ChangeApprovalScreen";

type ApprovalActor = {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  roles?: string[] | null;
};

type EnrichedApprovalRequest = ApprovalRequest & {
  submitter?: ApprovalActor | null;
  resolver?: ApprovalActor | null;
};

const humanizeRole = (role?: string | null) => role
  ? role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  : "Role not recorded";

const actorName = (actor: ApprovalActor | null | undefined, fallbackId?: string | null) =>
  actor?.name || (fallbackId === "system" ? "Automated Policy" : "User record unavailable");

export default function Approvals() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedRequest, setSelectedRequest] = useState<EnrichedApprovalRequest | null>(null);
  const [detailRequest, setDetailRequest] = useState<EnrichedApprovalRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "return" | null>(null);
  const [historyMicroplanId, setHistoryMicroplanId] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [selectedHierarchyMicroplanId, setSelectedHierarchyMicroplanId] = useState<number | null>(null);

  // Bulk Approval state
  const [selectedRequestIds, setSelectedRequestIds] = useState<(string | number)[]>([]);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"approve" | "return">("approve");
  const [bulkComment, setBulkComment] = useState("");

  // Approval decisions must never be accepted locally and replayed later.
  // Clean up any stale approval outbox mutations on load.
  useEffect(() => {
    void (async () => {
      const queued = await offlineDb.outbox
        .filter((item) => /^\/api\/approvals(?:\/|$)/.test(item.url.split("?")[0]))
        .toArray();
      if (queued.length === 0) return;
      await offlineDb.outbox.bulkDelete(queued.flatMap((item) => item.id == null ? [] : [item.id]));
      const tenantId = queued[0]?.tenantId;
      if (tenantId) await syncEngine.refreshPendingCount(tenantId);
    })();
  }, []);

  const { data: requests, isLoading } = useQuery<EnrichedApprovalRequest[]>({
    queryKey: ["/api/approvals", "with-actor-identities-v1"],
    queryFn: async () => {
      const response = await fetch("/api/approvals", {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Failed to load approval workflow");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const selectedMicroplanId = selectedRequest?.entityType === "microplan"
    ? selectedRequest.entityId
    : null;

  const { data: selectedReviewHydration, isLoading: selectedReviewLoading } = useQuery<any>({
    queryKey: ["/api/microplans", selectedMicroplanId, "hydration"],
    queryFn: async () => {
      const response = await fetch(`/api/microplans/${selectedMicroplanId}/hydration`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load review progress");
      return response.json();
    },
    enabled: selectedMicroplanId !== null && actionType === "approve",
  });

  const reviewedStepCount = selectedReviewHydration?.reviewWorkflow?.stepReviews?.filter(
    (review: any) => Number(review.requestId) === Number(selectedRequest?.id),
  ).length ?? 0;
  const reviewChecklistComplete = selectedRequest?.entityType !== "microplan" || reviewedStepCount >= 11;

  const historyTargetMicroplanId = historyMicroplanId ?? (
    detailRequest?.entityType === "microplan" ? detailRequest.entityId : null
  );

  const { data: versionHistory = [], isLoading: historyLoading } = useQuery<Array<{
    id: number;
    versionLabel: string;
    eventType: string;
    status: string;
    reason: string | null;
    createdAt: string;
    createdByUserId?: string | null;
    actor?: ApprovalActor | null;
  }>>({
    queryKey: ["/api/microplans", historyTargetMicroplanId, "versions"],
    queryFn: async () => {
      const response = await fetch("/api/microplans/" + historyTargetMicroplanId + "/versions", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load microplan history");
      return response.json();
    },
    enabled: historyTargetMicroplanId !== null,
  });

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/me/tenant"],
  });

  const { data: provinces = [] } = useQuery<Province[]>({ queryKey: ["/api/provinces"] });
  const { data: districts = [] } = useQuery<District[]>({ queryKey: ["/api/districts"] });
  const { data: facilities = [] } = useQuery<Facility[]>({ queryKey: ["/api/facilities"] });
  const { data: villages = [] } = useQuery<Village[]>({ queryKey: ["/api/villages"] });
  const { data: sessionPlans = [] } = useQuery<SessionPlan[]>({ queryKey: ["/api/sessions"] });
  const { data: populationData = [] } = useQuery<PopulationData[]>({ queryKey: ["/api/population"] });
  const { data: microplans = [] } = useQuery<Microplan[]>({ queryKey: ["/api/microplans"] });

  const [geoProvinceId, setGeoProvinceId] = useState<number | null>(null);
  const [geoDistrictId, setGeoDistrictId] = useState<number | null>(null);
  const [geoFacilityId, setGeoFacilityId] = useState<number | null>(null);

  const geoMaps = useMemo(
    () => buildGeoMaps({ provinces, districts, villages, facilities }),
    [provinces, districts, villages, facilities],
  );

  const entityLookup = useMemo(() => {
    const sessionsById = new Map<number, SessionPlan>();
    sessionPlans.forEach((s) => sessionsById.set(s.id, s));
    const populationById = new Map<number, PopulationData>();
    populationData.forEach((p) => populationById.set(p.id, p));
    const microplansById = new Map<number, Microplan>();
    microplans.forEach((plan) => microplansById.set(plan.id, plan));
    return { sessionsById, populationById, microplansById };
  }, [sessionPlans, populationData, microplans]);

  const resolveGeo = (item: EnrichedApprovalRequest) => {
    let source: Record<string, unknown> | null = null;
    if (item.entityType === "session") {
      const sp = entityLookup.sessionsById.get(item.entityId);
      if (sp) source = sp as unknown as Record<string, unknown>;
    } else if (item.entityType === "population") {
      const pop = entityLookup.populationById.get(item.entityId);
      if (pop) source = pop as unknown as Record<string, unknown>;
    } else if (item.entityType === "facility") {
      source = { facilityId: item.entityId };
    } else if (item.entityType === "microplan") {
      const plan = entityLookup.microplansById.get(item.entityId);
      if (plan?.facilityId) source = { facilityId: plan.facilityId };
    }
    if (!source) return { provinceId: null, districtId: null, facilityId: null };
    const h = getRecordHierarchy(source, geoMaps);
    const fId = typeof source.facilityId === "number"
      ? source.facilityId
      : (source.facilityId !== undefined ? Number(source.facilityId) : null);
    return {
      provinceId: h.provinceId,
      districtId: h.districtId,
      facilityId: fId && !Number.isNaN(fId) ? fId : null,
    };
  };

  const applyGeoFilter = (list: EnrichedApprovalRequest[]): EnrichedApprovalRequest[] => {
    if (geoProvinceId === null && geoDistrictId === null && geoFacilityId === null) return list;
    return list.filter((r) => {
      const g = resolveGeo(r);
      if (geoProvinceId !== null && g.provinceId !== geoProvinceId) return false;
      if (geoDistrictId !== null && g.districtId !== geoDistrictId) return false;
      if (geoFacilityId !== null && g.facilityId !== geoFacilityId) return false;
      return true;
    });
  };

  const reviewAllStepsMutation = useMutation({
    mutationFn: async (microplanId: number) => {
      return apiRequest("POST", `/api/microplans/${microplanId}/review/steps-all`, {
        comment: comment.trim() || "All 11 microplan steps reviewed and verified.",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/microplans", selectedMicroplanId, "hydration"] });
      toast({
        title: "Step Reviews Recorded",
        description: "All 11 steps have been marked as reviewed. You can now approve this stage.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Review recording failed",
        description: err?.message || "Failed to record step reviews.",
        variant: "destructive",
      });
    },
  });

  const getStageInfo = (item: EnrichedApprovalRequest) => {
    const maxApprovalLevel = (tenant?.settings as any)?.maxApprovalLevel || "national";
    const stages = maxApprovalLevel === "district"
      ? ["district"]
      : maxApprovalLevel === "provincial"
      ? ["district", "provincial"]
      : ["district", "provincial", "national"];
    
    const currentIdx = stages.indexOf(item.currentLevel.toLowerCase());
    const stageNumber = currentIdx >= 0 ? currentIdx + 1 : 1;
    const totalStages = stages.length;
    const nextLevel = currentIdx >= 0 && currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;
    return { stageNumber, totalStages, nextLevel };
  };

  const actionMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      comments,
    }: {
      id: number;
      action: "approve" | "reject" | "return";
      comments: string;
    }) => {
      return apiRequest("PATCH", `/api/approvals/${id}`, {
        status: action === "approve" ? "approved" : action === "return" ? "returned" : "rejected",
        comments,
      });
    },
    onSuccess: (result: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/microplans"] });
      setSelectedRequest(null);
      setActionType(null);
      setComment("");
      toast({
        title: variables.action === "approve" ? "Approved" : variables.action === "return" ? "Returned for correction" : "Rejected",
        description: variables.action === "return"
          ? "The microplan is editable again and the correction reason was preserved."
          : variables.action === "approve" && result?.nextRequest
          ? `This stage is complete. The microplan is now awaiting ${String(result.nextRequest.currentLevel).replace(/_/g, " ")} review.`
          : "The request was updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const userRoles = useMemo(() => new Set<string>([
    String(user?.role || ""),
    ...(Array.isArray(user?.roles) ? user.roles.map(String) : []),
  ]), [user]);

  const isNationalAdmin = userRoles.has("national_admin") || userRoles.has("superuser") || Boolean((user as any)?.isPlatformAdmin);
  const isProvincialCoordinator = userRoles.has("provincial_coordinator") || isNationalAdmin;
  const isDistrictManager = userRoles.has("district_manager") || isNationalAdmin;
  const canBulkApprove = isNationalAdmin || isProvincialCoordinator || isDistrictManager;

  const getRequestEligibility = (item: EnrichedApprovalRequest) => {
    if (item.status !== "pending") return { eligible: false, reason: "Resolved" };
    const level = String(item.currentLevel).toLowerCase();

    if (level === "district" && !isDistrictManager) {
      return { eligible: false, reason: "Awaiting District Manager review" };
    }
    if (level === "provincial" && !isProvincialCoordinator) {
      return { eligible: false, reason: "Awaiting Provincial Coordinator review" };
    }
    if (level === "national" && !isNationalAdmin) {
      return { eligible: false, reason: "Awaiting National Admin review" };
    }

    if (item.entityType === "microplan") {
      if (level === "provincial") {
        const districtApproved = (requests ?? []).some(
          (r) => r.entityType === "microplan" && r.entityId === item.entityId && r.currentLevel === "district" && r.status === "approved"
        );
        if (!districtApproved) {
          return { eligible: false, reason: "Preceding District review not yet approved", precedingApproved: false };
        }
      }
      if (level === "national") {
        const districtApproved = (requests ?? []).some(
          (r) => r.entityType === "microplan" && r.entityId === item.entityId && r.currentLevel === "district" && r.status === "approved"
        );
        if (!districtApproved) {
          return { eligible: false, reason: "Preceding District review not yet approved", precedingApproved: false };
        }
      }
    }

    return { eligible: true, reason: "Ready for review & endorsement", precedingApproved: true };
  };

  const bulkActionMutation = useMutation({
    mutationFn: async ({
      requestIds,
      action,
      comments,
    }: {
      requestIds: (string | number)[];
      action: "approve" | "return";
      comments: string;
    }) => {
      return apiRequest("POST", "/api/approvals/bulk", {
        requestIds,
        action,
        comments,
      });
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/microplans"] });
      setSelectedRequestIds([]);
      setIsBulkDialogOpen(false);
      setBulkComment("");
      if (variables.action === "approve") {
        toast({
          title: "Bulk Approval Completed",
          description: `Successfully processed ${data.approvedCount} plan(s). ${data.finalApprovedCount > 0 ? `${data.finalApprovedCount} marked fully approved.` : ""} ${data.escalatedCount > 0 ? `${data.escalatedCount} escalated to the next review level.` : ""}`,
        });
      } else {
        toast({
          title: "Bulk Return Completed",
          description: `${data.returnedCount || variables.requestIds.length} microplan(s) returned to draft for corrections.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Approval Failed",
        description: error.message || "Failed to process bulk approvals.",
        variant: "destructive",
      });
    },
  });

  const enrichWithGeo = (list: EnrichedApprovalRequest[]) =>
    list.map((r) => {
      const g = resolveGeo(r);
      return {
        ...r,
        _geoProvinceId: g.provinceId,
        _geoDistrictId: g.districtId,
        _geoProvinceName:
          g.provinceId !== null ? geoMaps.provinceMap.get(g.provinceId)?.name ?? "" : "",
        _geoDistrictName:
          g.districtId !== null ? geoMaps.districtMap.get(g.districtId)?.name ?? "" : "",
      } as EnrichedApprovalRequest & {
        _geoProvinceId: number | null;
        _geoDistrictId: number | null;
        _geoProvinceName: string;
        _geoDistrictName: string;
      };
    });

  const pendingRequests = enrichWithGeo(
    applyGeoFilter(requests?.filter((r) => r.status === "pending") || []),
  );
  const approvedRequests = enrichWithGeo(
    applyGeoFilter(requests?.filter((r) => r.status === "approved") || []),
  );
  const returnedRequests = enrichWithGeo(
    applyGeoFilter(requests?.filter((r) => r.status === "returned") || []),
  );
  const rejectedRequests = enrichWithGeo(
    applyGeoFilter(requests?.filter((r) => r.status === "rejected") || []),
  );

  const eligiblePendingRequests = useMemo(() => {
    return pendingRequests.filter((r) => getRequestEligibility(r).eligible);
  }, [pendingRequests, isDistrictManager, isProvincialCoordinator, isNationalAdmin, requests]);

  const selectedRequests = useMemo(() => {
    const set = new Set(selectedRequestIds.map(Number));
    return pendingRequests.filter((r) => set.has(Number(r.id)));
  }, [pendingRequests, selectedRequestIds]);

  const selectedMicroplans = useMemo(() => {
    return selectedRequests
      .filter((r) => r.entityType === "microplan")
      .map((r) => entityLookup.microplansById.get(r.entityId))
      .filter(Boolean) as Microplan[];
  }, [selectedRequests, entityLookup]);

  const selectedFacilities = useMemo(() => {
    const facIds = new Set(selectedMicroplans.map((m) => m.facilityId).filter(Boolean));
    return Array.from(facIds).map((id) => geoMaps.facilityMap.get(id!)).filter(Boolean) as Facility[];
  }, [selectedMicroplans, geoMaps]);

  const totalTargetPop = useMemo(() => {
    return selectedMicroplans.reduce((sum, mp) => {
      const pop = populationData.find((p) => p.facilityId === mp.facilityId && (mp.year ? p.year === mp.year : true));
      return sum + Number(pop?.under1Population || pop?.totalPopulation || 0);
    }, 0);
  }, [selectedMicroplans, populationData]);

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "population":
        return User;
      case "session":
        return Clock;
      case "budget":
        return FileText;
      case "microplan":
        return FileText;
      default:
        return AlertTriangle;
    }
  };

  const columns = [
    {
      key: "entityType",
      header: "Request Type",
      sortable: true,
      render: (item: EnrichedApprovalRequest) => {
        const Icon = getEntityIcon(item.entityType);
        return (
          <div
            className="flex items-center gap-2 group cursor-pointer"
            title="Click to view details"
            onClick={(e) => {
              e.stopPropagation();
              setDetailRequest(item);
            }}
          >
            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium capitalize text-foreground group-hover:text-primary transition-colors">{item.entityType} Update</p>
              <p className="text-xs text-muted-foreground">
                ID: {item.entityId}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "currentLevel",
      header: "Level & Stage",
      sortable: true,
      render: (item: EnrichedApprovalRequest) => {
        const { stageNumber, totalStages } = getStageInfo(item);
        const eligibility = getRequestEligibility(item);
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="capitalize w-fit">
                {item.currentLevel}
              </Badge>
              {item.entityType === "microplan" && eligibility.eligible && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] py-0 px-1.5">
                  Ready for Review ✓
                </Badge>
              )}
            </div>
            {item.entityType === "microplan" && (
              <span className="text-[10px] text-muted-foreground font-medium">
                Stage {stageNumber} of {totalStages}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "_geoProvinceName",
      header: "Province",
      sortable: true,
      render: (item: EnrichedApprovalRequest) => {
        const g = resolveGeo(item);
        const name = g.provinceId !== null ? geoMaps.provinceMap.get(g.provinceId)?.name : null;
        return <span className="text-sm font-medium">{name ?? "—"}</span>;
      },
    },
    {
      key: "_geoDistrictName",
      header: "District",
      sortable: true,
      render: (item: EnrichedApprovalRequest) => {
        const g = resolveGeo(item);
        const name = g.districtId !== null ? geoMaps.districtMap.get(g.districtId)?.name : null;
        return <span className="text-sm">{name ?? "—"}</span>;
      },
    },
    {
      key: "submittedAt",
      header: "Submitted",
      sortable: true,
      render: (item: EnrichedApprovalRequest) => (
        <div className="text-xs space-y-0.5 max-w-[180px]">
          <span className="font-semibold block">{actorName(item.submitter, item.requestedById)}</span>
          <span className="block text-muted-foreground">{humanizeRole(item.submitter?.role)}</span>
          <time className="block text-muted-foreground" title={item.submittedAt ? new Date(item.submittedAt).toISOString() : undefined}>
            {item.submittedAt ? format(new Date(item.submittedAt), "MMM d, yyyy HH:mm:ss") : "Time not recorded"}
          </time>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status & Review Chain",
      render: (item: EnrichedApprovalRequest) => {
        const isPending = (item.status || "pending") === "pending";
        const level = String(item.currentLevel).toLowerCase();

        return (
          <div className="space-y-1">
            <ApprovalBadge status={item.status || "pending"} />
            {isPending && item.entityType === "microplan" && (
              <div className="text-[11px] space-y-0.5">
                {level === "provincial" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    District Approved · Awaiting Provincial
                  </span>
                ) : level === "national" ? (
                  <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 font-medium">
                    <CheckCircle2 className="h-3 w-3 text-blue-600" />
                    District/Prov. Verified · Awaiting National
                  </span>
                ) : (
                  <span className="block text-amber-700 dark:text-amber-400 font-medium">
                    Awaiting {item.currentLevel} decision
                  </span>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "resolvedAt",
      header: "Approved / Resolved",
      sortable: true,
      render: (item: EnrichedApprovalRequest) => {
        if (item.resolvedAt) {
          return (
            <div className="text-xs space-y-0.5" data-testid={`approval-resolved-at-${item.id}`}>
              <span className="font-semibold text-foreground">
                {format(new Date(item.resolvedAt), "MMM d, yyyy HH:mm")}
              </span>
              {item.resolvedById && (
                <span className="block text-[11px] text-muted-foreground truncate max-w-[140px]">
                  By: {actorName(item.resolver, item.resolvedById)}
                </span>
              )}
              {item.resolver?.role && <span className="block text-[10px] text-muted-foreground">{humanizeRole(item.resolver.role)}</span>}
            </div>
          );
        }
        if (item.entityType === "microplan") {
          const priorApproved = (requests ?? []).filter(
            (r) => r.entityType === "microplan" && r.entityId === item.entityId && r.status === "approved" && r.id !== item.id
          );
          if (priorApproved.length > 0) {
            const latest = priorApproved[0];
            return (
              <div className="text-[11px] text-muted-foreground">
                <span className="text-emerald-600 font-medium block">
                  ✓ {latest.currentLevel} approved
                </span>
                {latest.resolvedAt && (
                  <span>{format(new Date(latest.resolvedAt), "MMM d, yyyy HH:mm:ss")}</span>
                )}
                <span className="block">By {actorName(latest.resolver, latest.resolvedById)}</span>
              </div>
            );
          }
        }
        return <span className="text-muted-foreground text-xs">—</span>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: EnrichedApprovalRequest) => {
        const isMicroplan = item.entityType === "microplan";
        const targetPlan = isMicroplan ? microplans.find((m) => m.id === item.entityId) : null;
        const isCampaign = targetPlan?.planType === "sia_campaign";
        const planPath = isMicroplan ? `/microplans/${isCampaign ? "campaigns" : "routine"}/${item.entityId}` : null;

        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setDetailRequest(item);
              }}
              title="View approval audit details"
              data-testid={"button-detail-" + item.id}
            >
              <Eye className="h-4 w-4 text-primary" />
            </Button>
            {isMicroplan && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setHistoryMicroplanId(item.entityId);
                }}
                title="Version history"
                data-testid={"button-history-" + item.id}
              >
                <History className="h-4 w-4" />
              </Button>
            )}
            {isMicroplan && planPath && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5 gap-1.5 text-xs text-primary hover:text-primary font-medium border-primary/20 hover:bg-primary/5"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation(planPath);
                }}
                title={item.status === "pending" ? "Open and review microplan" : "Open and view microplan details"}
                data-testid={"button-open-plan-" + item.id}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open Plan</span>
              </Button>
            )}
            {item.status === "pending" && (
              <>
                {isMicroplan && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRequest(item);
                      setActionType("return");
                    }}
                    data-testid={"button-revert-" + item.id}
                  >
                    <Undo2 className="mr-1 h-4 w-4" />
                    Revert
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRequest(item);
                    setActionType("approve");
                  }}
                  title="Approve"
                  data-testid={"button-approve-" + item.id}
                >
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRequest(item);
                    setActionType("reject");
                  }}
                  title="Reject permanently"
                  data-testid={"button-reject-" + item.id}
                >
                  <XCircle className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const handleAction = () => {
    if (!selectedRequest || !actionType) return;
    actionMutation.mutate({
      id: selectedRequest.id,
      action: actionType,
      comments: comment,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approval Workflow</h1>
        <p className="text-muted-foreground text-sm">
          Review and approve data submissions
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {pendingRequests.length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {approvedRequests.length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {rejectedRequests.length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <GeoCascadeFilter
        provinces={provinces}
        districts={districts}
        facilities={facilities}
        provinceId={geoProvinceId}
        districtId={geoDistrictId}
        facilityId={geoFacilityId}
        onProvinceChange={setGeoProvinceId}
        onDistrictChange={setGeoDistrictId}
        onFacilityChange={setGeoFacilityId}
        showFacility
      />

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="entity-proposals">
            Entity Version Proposals
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="returned">Returned ({returnedRequests.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-4">
          {canBulkApprove && (
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-blue-50/40 to-background dark:from-primary/10 dark:via-background dark:to-background">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">
                        {isNationalAdmin ? "National Coordinator Bulk Approval" : "Provincial Coordinator Bulk Approval"}
                      </p>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] py-0 px-2 font-semibold">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Smart Batch Processing
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Bulk approve microplans across facilities once preceding review levels (District verification) have completed. Individual plans can still be inspected below anytime.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    onClick={() => {
                      const readyIds = eligiblePendingRequests.map((r) => r.id);
                      setSelectedRequestIds(readyIds);
                    }}
                    disabled={eligiblePendingRequests.length === 0}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Select Verified ({eligiblePendingRequests.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => {
                      const allPendingIds = pendingRequests.map((r) => r.id);
                      setSelectedRequestIds(allPendingIds);
                    }}
                    disabled={pendingRequests.length === 0}
                  >
                    <ListChecks className="h-3.5 w-3.5" />
                    Select All ({pendingRequests.length})
                  </Button>
                  {selectedRequestIds.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedRequestIds([])}
                    >
                      Clear ({selectedRequestIds.length})
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <DataTable
                data={pendingRequests}
                columns={columns}
                onRowClick={(item) => setDetailRequest(item)}
                searchable
                searchKeys={["entityType", "currentLevel", "_geoDistrictName", "_geoProvinceName"]}
                emptyMessage="No pending approval requests."
                enableSelection={canBulkApprove}
                selectedIds={selectedRequestIds}
                onSelectionChange={setSelectedRequestIds}
                bulkActions={
                  canBulkApprove && selectedRequestIds.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs gap-1.5 shadow-sm"
                        onClick={() => {
                          setBulkAction("approve");
                          setIsBulkDialogOpen(true);
                        }}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Bulk Approve ({selectedRequestIds.length})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        onClick={() => {
                          setBulkAction("return");
                          setIsBulkDialogOpen(true);
                        }}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Bulk Return ({selectedRequestIds.length})
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entity-proposals" className="mt-4">
          <ChangeApprovalScreen />
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <DataTable
                data={approvedRequests}
                columns={columns}
                onRowClick={(item) => setDetailRequest(item)}
                searchable
                searchKeys={["entityType", "currentLevel"]}
                emptyMessage="No approved requests."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="returned" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <DataTable
                data={returnedRequests}
                columns={columns}
                onRowClick={(item) => setDetailRequest(item)}
                searchable
                searchKeys={["entityType", "currentLevel"]}
                emptyMessage="No requests have been returned for correction."
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <DataTable
                data={rejectedRequests}
                columns={columns}
                onRowClick={(item) => setDetailRequest(item)}
                searchable
                searchKeys={["entityType", "currentLevel"]}
                emptyMessage="No rejected requests."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!selectedRequest && !!actionType}
        onOpenChange={() => {
          setSelectedRequest(null);
          setActionType(null);
          setComment("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Request" : actionType === "return" ? "Return for Correction" : "Reject Request"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium capitalize">
                {selectedRequest?.entityType} Update
              </p>
              <p className="text-xs text-muted-foreground">
                Entity ID: {selectedRequest?.entityId}
              </p>
              <p className="text-xs text-muted-foreground">
                Level: {selectedRequest?.currentLevel}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Comments {actionType !== "approve" && "(Required)"}
              </label>
              <Textarea
                placeholder={
                  actionType === "approve"
                    ? "Optional comments..."
                    : actionType === "return"
                    ? "Describe the corrections required..."
                    : "Please provide a reason for rejection..."
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                data-testid="input-approval-comment"
              />
            </div>

            {actionType === "approve" && selectedRequest?.entityType === "microplan" && (
              <div className={`rounded-md border p-3.5 text-sm space-y-2.5 ${reviewChecklistComplete ? "border-blue-200 bg-blue-50 text-blue-900" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
                <div>
                  <p className="font-semibold">
                    {(() => {
                      const { stageNumber, totalStages, nextLevel } = getStageInfo(selectedRequest);
                      if (nextLevel) {
                        return `Approving Stage ${stageNumber} (${selectedRequest.currentLevel}) will advance this plan to Stage ${stageNumber + 1} (${nextLevel.toUpperCase()}) review.`;
                      }
                      return `Approving Stage ${stageNumber} (${selectedRequest.currentLevel}) will mark this microplan as FULLY APPROVED.`;
                    })()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    The plan advances through configured levels until every assigned official has approved it.
                  </p>
                </div>
                
                <div className="pt-2 border-t border-current/20 flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    11-Step Review Checklist: {selectedReviewLoading ? "Loading…" : `${reviewedStepCount} of 11 steps completed`}
                  </span>
                  {reviewChecklistComplete ? (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                      Ready to Approve ✓
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300">
                      {11 - reviewedStepCount} remaining
                    </Badge>
                  )}
                </div>

                {!reviewChecklistComplete && !selectedReviewLoading && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                      disabled={reviewAllStepsMutation.isPending}
                      onClick={() => selectedRequest.entityId && reviewAllStepsMutation.mutate(selectedRequest.entityId)}
                    >
                      {reviewAllStepsMutation.isPending ? "Recording reviews..." : "Mark All 11 Steps Reviewed"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => {
                        const plan = microplans.find((item) => item.id === selectedRequest.entityId);
                        const routeType = plan?.planType === "sia_campaign" ? "campaigns" : "routine";
                        setLocation(`/microplans/${routeType}/${selectedRequest.entityId}`);
                      }}
                    >
                      Open Wizard Review
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                  setComment("");
                }}
                data-testid="button-cancel-action"
              >
                Cancel
              </Button>
              <Button
                variant={actionType === "approve" ? "default" : "destructive"}
                onClick={handleAction}
                disabled={
                  actionMutation.isPending ||
                  selectedReviewLoading ||
                  (actionType === "approve" && !reviewChecklistComplete) ||
                  (actionType !== "approve" && !comment.trim())
                }
                data-testid="button-confirm-action"
              >
                {actionMutation.isPending
                  ? "Processing..."
                  : actionType === "approve"
                  ? "Approve"
                  : actionType === "return"
                  ? "Return for correction"
                  : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Approval / Return Dialog for Provincial and National Coordinators */}
      <Dialog
        open={isBulkDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsBulkDialogOpen(false);
            setBulkComment("");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/20 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${bulkAction === "approve" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40" : "bg-amber-100 text-amber-800 dark:bg-amber-950/40"}`}>
                  {bulkAction === "approve" ? <CheckCheck className="h-5 w-5" /> : <Undo2 className="h-5 w-5" />}
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {bulkAction === "approve" ? "Bulk Microplan Approval" : "Bulk Return for Correction"}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {bulkAction === "approve"
                      ? "Fast-track batch approval across multiple facilities and districts"
                      : "Return multiple microplans to drafts for revised planning"}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="capitalize text-xs font-semibold px-2.5 py-1">
                {isNationalAdmin ? "National Authority" : isProvincialCoordinator ? "Provincial Authority" : "Coordinator Review"}
              </Badge>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5 overflow-y-auto min-h-0 flex-1">
            {/* Batch Metrics Card */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl border bg-muted/30">
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider block">Selected Plans</span>
                <span className="text-xl font-bold text-foreground">{selectedRequests.length}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider block">Unique Facilities</span>
                <span className="text-xl font-bold text-foreground">{selectedFacilities.length}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider block">Target Population</span>
                <span className="text-xl font-bold text-primary">
                  {totalTargetPop > 0 ? totalTargetPop.toLocaleString() : "—"}
                </span>
              </div>
            </div>

            {/* Workflow Preceding Level Verification Banner */}
            {bulkAction === "approve" ? (
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Preceding Review Level Verification Guaranteed</span>
                </div>
                <p className="leading-relaxed text-emerald-900/80 dark:text-emerald-300/80">
                  The system validates each plan in the batch against the database. For Provincial approval, all plans must be District-approved. For National approval, all plans must be District and Provincial verified. Any unverified plans will be safely skipped.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Batch Reversion to Draft Status</span>
                </div>
                <p className="leading-relaxed text-amber-900/80 dark:text-amber-300/80">
                  Returning {selectedRequests.length} microplan(s) will set their status back to draft, allowing facility and district teams to revise numbers and resubmit.
                </p>
              </div>
            )}

            {/* Selected Microplans List */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Batch Included Microplans ({selectedRequests.length})
              </label>
              <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-lg border p-2 bg-background">
                {selectedRequests.map((req) => {
                  const mp = entityLookup.microplansById.get(req.entityId);
                  const fac = mp?.facilityId ? geoMaps.facilityMap.get(mp.facilityId) : null;
                  const g = resolveGeo(req);
                  const distName = g.districtId !== null ? geoMaps.districtMap.get(g.districtId)?.name : null;
                  const provName = g.provinceId !== null ? geoMaps.provinceMap.get(g.provinceId)?.name : null;
                  const eligibility = getRequestEligibility(req);

                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/40 text-xs border border-transparent hover:border-border transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {fac?.name || mp?.name || `Microplan #${req.entityId}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[distName, provName].filter(Boolean).join(", ") || "General Scope"} · Cycle {mp?.year || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {eligibility.eligible ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] py-0 px-1.5 font-medium">
                            ✓ Pre-Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] py-0 px-1.5 font-medium">
                            {eligibility.reason}
                          </Badge>
                        )}
                        <Badge variant="outline" className="capitalize text-[10px] py-0 px-1.5">
                          {req.currentLevel}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Comments Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Batch Feedback / Comments {bulkAction === "return" ? "(Required for return)" : "(Optional)"}
              </label>
              <Textarea
                placeholder={
                  bulkAction === "approve"
                    ? "Add coordinator review notes or approval remarks (applied to all selected plans)..."
                    : "Specify the reasons and required corrections for the returning teams..."
                }
                value={bulkComment}
                onChange={(e) => setBulkComment(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="p-4 px-6 border-t bg-muted/20 shrink-0 flex items-center justify-between sm:justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsBulkDialogOpen(false);
                setBulkComment("");
              }}
              disabled={bulkActionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className={bulkAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
              onClick={() => {
                if (selectedRequestIds.length === 0) return;
                bulkActionMutation.mutate({
                  requestIds: selectedRequestIds.map(Number),
                  action: bulkAction,
                  comments: bulkComment,
                });
              }}
              disabled={
                bulkActionMutation.isPending ||
                selectedRequestIds.length === 0 ||
                (bulkAction === "return" && !bulkComment.trim())
              }
            >
              {bulkActionMutation.isPending
                ? "Processing Batch..."
                : bulkAction === "approve"
                ? `Confirm Bulk Approval (${selectedRequestIds.length})`
                : `Confirm Bulk Return (${selectedRequestIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailRequest} onOpenChange={(open) => !open && setDetailRequest(null)}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl" data-testid="dialog-approval-detail">
          <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-background via-background to-muted/40 px-5 py-4 sm:px-7">
            <DialogTitle className="flex min-w-0 flex-col gap-3 pr-8 text-lg sm:flex-row sm:items-center sm:justify-between sm:text-xl">
              <div className="flex min-w-0 items-center gap-2">
                <span>Approval Request Details</span>
                {detailRequest && <Badge variant="outline">#{detailRequest.id}</Badge>}
              </div>
              {detailRequest && <ApprovalBadge status={detailRequest.status || "pending"} />}
            </DialogTitle>
          </DialogHeader>
          {detailRequest && (() => {
            const detailMicroplan = detailRequest.entityType === "microplan"
              ? microplans.find((m) => m.id === detailRequest.entityId)
              : null;
            const detailFacility = detailMicroplan?.facilityId
              ? facilities.find((f) => f.id === detailMicroplan.facilityId)
              : (detailRequest.entityType === "facility" ? facilities.find((f) => f.id === detailRequest.entityId) : null);
            const detailGeo = resolveGeo(detailRequest);
            const detailProvince = detailGeo.provinceId !== null ? geoMaps.provinceMap.get(detailGeo.provinceId) : null;
            const detailDistrict = detailGeo.districtId !== null ? geoMaps.districtMap.get(detailGeo.districtId) : null;
            const { stageNumber, totalStages } = getStageInfo(detailRequest);
            const isCampaign = detailMicroplan?.planType === "sia_campaign";
            const planPath = detailRequest.entityType === "microplan"
              ? `/microplans/${isCampaign ? "campaigns" : "routine"}/${detailRequest.entityId}`
              : null;

            const maxApprovalLevel = (tenant?.settings as any)?.maxApprovalLevel || "national";
            const workflowLevels = maxApprovalLevel === "district"
              ? ["facility", "district"]
              : maxApprovalLevel === "provincial"
              ? ["facility", "district", "provincial"]
              : ["facility", "district", "provincial", "national"];
            const workflowRequests = (requests ?? []).filter(
              (request) => request.entityType === detailRequest.entityType && request.entityId === detailRequest.entityId,
            );
            const currentWorkflowIndex = workflowLevels.indexOf(detailRequest.currentLevel.toLowerCase());

            return (
              <div className="flex min-h-0 flex-1 flex-col text-sm">
                <Tabs defaultValue="summary" className="flex min-h-0 flex-1 flex-col">
                  <div className="shrink-0 border-b px-5 pt-3 sm:px-7">
                    <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-muted/70 p-1 sm:w-[460px]">
                      <TabsTrigger value="summary" className="py-2">Summary</TabsTrigger>
                      <TabsTrigger value="workflow" className="py-2">Workflow stage</TabsTrigger>
                      <TabsTrigger value="history" className="py-2">History</TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
                    <TabsContent value="summary" className="m-0 space-y-5">
                {/* Target Record Information Card */}
                <div className="space-y-4 rounded-xl border bg-muted/30 p-4 sm:p-5">
                  <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <span className="font-semibold text-muted-foreground uppercase text-[10px] block">Target Record</span>
                      <p className="break-words text-base font-bold text-foreground capitalize sm:text-lg">
                        {detailMicroplan?.name || `${detailRequest.entityType} #${detailRequest.entityId}`}
                      </p>
                    </div>
                    <div className="shrink-0 lg:text-right">
                      <span className="font-semibold text-muted-foreground uppercase text-[10px] block">Review Level</span>
                      <Badge variant="outline" className="max-w-full whitespace-normal text-left capitalize font-medium lg:text-right">
                        {detailRequest.currentLevel} (Stage {stageNumber} of {totalStages})
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
                    {detailFacility && (
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Facility</span>
                        <span className="font-medium text-foreground">{detailFacility.name}</span>
                      </div>
                    )}
                    {detailDistrict && (
                      <div>
                        <span className="text-muted-foreground block text-[10px]">District</span>
                        <span className="font-medium text-foreground">{detailDistrict.name}</span>
                      </div>
                    )}
                    {detailProvince && (
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Province</span>
                        <span className="font-medium text-foreground">{detailProvince.name}</span>
                      </div>
                    )}
                    {detailMicroplan && (
                      <>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Plan Type</span>
                          <span className="font-medium text-foreground capitalize">
                            {isCampaign ? "SIA Campaign" : "Routine Microplan"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Period / Cycle</span>
                          <span className="font-medium text-foreground">
                            {detailMicroplan.year} {detailMicroplan.quarter ? `Q${detailMicroplan.quarter}` : ""}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Plan Status</span>
                          <span className="font-medium text-foreground capitalize">{detailMicroplan.status || "—"}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Audit Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 space-y-1 bg-card">
                    <span className="font-bold text-[10px] text-muted-foreground uppercase block">Submission Details</span>
                    <p className="font-semibold text-foreground">
                      {detailRequest.submittedAt ? format(new Date(detailRequest.submittedAt), "MMM d, yyyy HH:mm:ss") : "—"}
                    </p>
                    <span className="text-[11px] font-medium block">{actorName(detailRequest.submitter, detailRequest.requestedById)}</span>
                    <span className="text-[11px] text-muted-foreground block">{humanizeRole(detailRequest.submitter?.role)}</span>
                    {detailRequest.submitter?.email && <span className="text-[11px] text-muted-foreground block break-all">{detailRequest.submitter.email}</span>}
                  </div>

                  <div className="rounded-lg border p-3 space-y-1 bg-card">
                    <span className="font-bold text-[10px] text-muted-foreground uppercase block">Resolution Details</span>
                    <p className="font-semibold text-foreground">
                      {detailRequest.resolvedAt ? format(new Date(detailRequest.resolvedAt), "MMM d, yyyy HH:mm:ss") : "Awaiting reviewer decision"}
                    </p>
                    <span className="text-[11px] font-medium block">
                      {detailRequest.resolvedById ? actorName(detailRequest.resolver, detailRequest.resolvedById) : "Pending"}
                    </span>
                    {detailRequest.resolver?.role && <span className="text-[11px] text-muted-foreground block">{humanizeRole(detailRequest.resolver.role)}</span>}
                    {detailRequest.resolver?.email && <span className="text-[11px] text-muted-foreground block break-all">{detailRequest.resolver.email}</span>}
                  </div>
                </div>

                {detailRequest.comments && (
                  <div className="space-y-1 rounded-xl border bg-muted/30 p-4">
                    <span className="font-bold text-[10px] text-muted-foreground uppercase block">Reviewer Notes & Justification</span>
                    <p className="italic text-foreground">{detailRequest.comments}</p>
                  </div>
                )}

                    </TabsContent>

                    <TabsContent value="workflow" className="m-0 space-y-4">
                      <div>
                        <h3 className="text-base font-semibold">Approval workflow</h3>
                        <p className="text-sm text-muted-foreground">Live progress through the configured approval hierarchy.</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {workflowLevels.map((level, index) => {
                          const stageRequest = level === "facility"
                            ? workflowRequests.slice().sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime())[0]
                            : workflowRequests.find((request) => request.currentLevel.toLowerCase() === level);
                          const complete = level === "facility" ? Boolean(stageRequest) : stageRequest?.status === "approved";
                          const current = level !== "facility" && index === currentWorkflowIndex && detailRequest.status === "pending";
                          const actor = level === "facility" ? stageRequest?.submitter : stageRequest?.resolver;
                          const actorId = level === "facility" ? stageRequest?.requestedById : stageRequest?.resolvedById;
                          const eventTime = level === "facility" ? stageRequest?.submittedAt : stageRequest?.resolvedAt;
                          return (
                            <div key={level} className={`relative overflow-hidden rounded-xl border p-4 ${current ? "border-blue-300 bg-blue-50/70 dark:bg-blue-950/20" : complete ? "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20" : "bg-card"}`}>
                              <div className="flex items-center justify-between gap-3">
                                <div className={`flex h-9 w-9 items-center justify-center rounded-full font-bold ${complete ? "bg-emerald-600 text-white" : current ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>
                                  {complete ? <Check className="h-5 w-5" /> : index + 1}
                                </div>
                                <Badge variant={current ? "default" : "outline"} className="capitalize">
                                  {complete ? "Completed" : current ? "Current stage" : "Waiting"}
                                </Badge>
                              </div>
                              <p className="mt-4 font-semibold capitalize">{level}</p>
                              <p className="text-xs text-muted-foreground">{level === "facility" ? "Plan submission" : `${humanizeRole(`${level}_coordinator`)} review`}</p>
                              {(actor || actorId) && <p className="mt-3 break-words text-xs font-medium">{actorName(actor, actorId)}</p>}
                              {actor?.role && <p className="text-xs text-muted-foreground">{humanizeRole(actor.role)}</p>}
                              {eventTime && <time className="mt-1 block text-xs text-muted-foreground">{format(new Date(eventTime), "MMM d, yyyy HH:mm:ss")}</time>}
                            </div>
                          );
                        })}
                      </div>
                    </TabsContent>

                    <TabsContent value="history" className="m-0 space-y-3">
                      <div>
                        <h3 className="text-base font-semibold">Decision and version history</h3>
                        <p className="text-sm text-muted-foreground">An immutable timeline of submissions, reviews, returns, and approvals.</p>
                      </div>
                      {historyLoading ? (
                        <Skeleton className="h-28 w-full rounded-xl" />
                      ) : versionHistory.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No audit checkpoints have been recorded yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {versionHistory.map((version) => (
                            <div key={version.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">{version.versionLabel}</Badge>
                                  <span className="font-semibold capitalize">{version.eventType.replace(/_/g, " ")}</span>
                                  <ApprovalBadge status={version.status as any} />
                                </div>
                                {version.reason && <p className="mt-2 break-words text-sm text-muted-foreground">{version.reason}</p>}
                                <p className="mt-2 text-sm font-medium">{actorName(version.actor, version.createdByUserId)}</p>
                                <p className="break-all text-xs text-muted-foreground">{humanizeRole(version.actor?.role)}{version.actor?.email ? ` · ${version.actor.email}` : ""}</p>
                              </div>
                              <time className="shrink-0 text-xs text-muted-foreground">{format(new Date(version.createdAt), "MMM d, yyyy HH:mm:ss")}</time>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>

                {/* Dialog Footer Actions */}
                <div className="shrink-0 border-t bg-background/95 px-5 py-4 backdrop-blur sm:px-7">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {planPath && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="w-full gap-1.5 font-medium sm:w-auto"
                        onClick={() => {
                          setDetailRequest(null);
                          setLocation(planPath);
                        }}
                        data-testid="button-open-plan-from-dialog"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="truncate">{detailRequest.status === "pending" ? "Open & Review Plan" : "Open Plan Details"}</span>
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:justify-end">
                    {detailRequest.status === "pending" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const req = detailRequest;
                            setDetailRequest(null);
                            setSelectedRequest(req);
                            setActionType("return");
                          }}
                        >
                          <Undo2 className="mr-1 h-3.5 w-3.5" />
                          Revert
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => {
                            const req = detailRequest;
                            setDetailRequest(null);
                            setSelectedRequest(req);
                            setActionType("approve");
                          }}
                        >
                          <CheckCircle className="mr-1 h-3.5 w-3.5" />
                          Approve
                        </Button>
                      </>
                    )}
                    <Button className="w-full lg:w-auto" variant="ghost" size="sm" onClick={() => setDetailRequest(null)}>
                      Close
                    </Button>
                  </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={historyMicroplanId !== null} onOpenChange={(open) => !open && setHistoryMicroplanId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Microplan Version History</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {historyLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : versionHistory.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No checkpoints exist yet. A version is created when the plan is submitted, returned, rejected, or approved.
              </p>
            ) : (
              versionHistory.map((version) => (
                <div key={version.id} className="flex items-start justify-between gap-4 rounded-md border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{version.versionLabel}</Badge>
                      <span className="font-medium capitalize">{version.eventType.replace(/_/g, " ")}</span>
                      <ApprovalBadge status={version.status as any} />
                    </div>
                    {version.reason && <p className="mt-2 text-sm text-muted-foreground">{version.reason}</p>}
                    <p className="mt-2 text-xs font-medium">{actorName(version.actor, version.createdByUserId)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {humanizeRole(version.actor?.role)}{version.actor?.email ? ` · ${version.actor.email}` : ""}
                    </p>
                    {version.createdByUserId && <p className="text-[10px] text-muted-foreground">Actor ID: {version.createdByUserId}</p>}
                  </div>
                  <time className="whitespace-nowrap text-xs text-muted-foreground">
                    {format(new Date(version.createdAt), "MMM d, yyyy HH:mm:ss")}
                  </time>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Approval Hierarchy Workflow</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live multi-level progress across administrative review stages
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-6 justify-center py-4">
            {(() => {
              const maxApprovalLevel = (tenant?.settings as any)?.maxApprovalLevel || "national";
              const items = [
                { level: "Facility", role: "Facility Clerk", subtext: "Submission" },
                { level: "District", role: "District Manager", subtext: "Stage 1 Review" },
                { level: "Provincial", role: "Provincial Coordinator", subtext: "Stage 2 Review" },
                { level: "National", role: "National Admin", subtext: "Final Approval" },
              ];
              const filtered = items.filter((item, index) => {
                if (maxApprovalLevel === "district") return index <= 1;
                if (maxApprovalLevel === "provincial") return index <= 2;
                return true; // national
              });

              // Resolve active microplan
              const activeMicroplanId = selectedHierarchyMicroplanId
                ?? pendingRequests.find((r) => r.entityType === "microplan")?.entityId
                ?? (requests ?? []).find((r) => r.entityType === "microplan")?.entityId
                ?? null;

              const workflowRequests = activeMicroplanId == null
                ? []
                : (requests ?? []).filter((request) => request.entityType === "microplan" && request.entityId === activeMicroplanId);

              const statusFor = (level: string) => {
                if (level === "Facility") return activeMicroplanId == null ? "waiting" : "complete";
                const stage = workflowRequests.find((request) => request.currentLevel.toLowerCase() === level.toLowerCase());
                if (!stage) {
                  // If prior level is complete, this might be pending or waiting
                  return "waiting";
                }
                return stage.status ?? "waiting";
              };

              return filtered.map((item, index) => {
                const stageStatus = statusFor(item.level);
                const isPending = stageStatus === "pending";
                const isComplete = stageStatus === "approved" || stageStatus === "complete";
                const stageRequest = item.level === "Facility"
                  ? workflowRequests.slice().sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime())[0]
                  : workflowRequests.find((request) => request.currentLevel.toLowerCase() === item.level.toLowerCase());
                const stageActor = item.level === "Facility" ? stageRequest?.submitter : stageRequest?.resolver;
                const stageActorId = item.level === "Facility" ? stageRequest?.requestedById : stageRequest?.resolvedById;
                const stageTime = item.level === "Facility" ? stageRequest?.submittedAt : stageRequest?.resolvedAt;
                return (
                  <div key={item.level} className="flex items-center gap-4">
                    <div className="text-center min-w-[120px]">
                      <div
                        className={`h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-2 transition-all shadow-sm ${
                          isComplete
                            ? "bg-emerald-600 text-white shadow-emerald-200"
                            : isPending
                            ? "bg-blue-600 text-white ring-4 ring-blue-100 shadow-blue-200"
                            : "bg-muted text-muted-foreground border"
                        }`}
                      >
                        {isComplete ? (
                          <Check className="h-6 w-6 stroke-[3]" />
                        ) : (
                          <span className="text-base font-bold">{index + 1}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground">{item.level}</p>
                      <p className="text-xs text-muted-foreground">{item.role}</p>
                      <Badge
                        variant={isComplete ? "default" : isPending ? "secondary" : "outline"}
                        className={`mt-1.5 text-[10px] font-medium capitalize ${
                          isComplete
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                            : isPending
                            ? "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100"
                            : "text-muted-foreground"
                        }`}
                      >
                        {isComplete ? "Completed ✓" : isPending ? "Current stage ⏳" : "Waiting"}
                      </Badge>
                      {stageRequest && (
                        <div className="mt-2 text-[10px] leading-4 max-w-[150px] mx-auto">
                          {isComplete && <p className="font-semibold text-foreground break-words">{actorName(stageActor, stageActorId)}</p>}
                          {isPending && <p className="font-medium text-blue-700">Awaiting {humanizeRole(item.role)}</p>}
                          {isComplete && stageActor?.role && <p className="text-muted-foreground">{humanizeRole(stageActor.role)}</p>}
                          {stageTime && <time className="block text-muted-foreground" title={new Date(stageTime).toISOString()}>{format(new Date(stageTime), "MMM d, yyyy HH:mm:ss")}</time>}
                          {stageRequest.comments && item.level !== "Facility" && <p className="mt-1 text-muted-foreground italic break-words">“{stageRequest.comments}”</p>}
                        </div>
                      )}
                    </div>
                    {index < filtered.length - 1 && (
                      <div className={`h-0.5 w-10 hidden sm:block ${isComplete ? "bg-emerald-500" : "bg-muted"}`} />
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
