import { useState, useMemo } from "react";
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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/DataTable";
import { ApprovalBadge } from "@/components/ApprovalBadge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
  User,
  Undo2,
  History,
} from "lucide-react";
import type {
  ApprovalRequest,
  Tenant,
  Province,
  District,
  Facility,
  Village,
  SessionPlan,
  PopulationData,
} from "@shared/schema";
import { format } from "date-fns";
import { GeoCascadeFilter } from "@/components/GeoCascadeFilter";
import { buildGeoMaps, getRecordHierarchy } from "@/lib/geoHierarchy";

import { ChangeApprovalScreen } from "@/components/history/ChangeApprovalScreen";

export default function Approvals() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "return" | null>(null);
  const [historyMicroplanId, setHistoryMicroplanId] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const { data: requests, isLoading } = useQuery<ApprovalRequest[]>({
    queryKey: ["/api/approvals"],
  });

  const { data: versionHistory = [], isLoading: historyLoading } = useQuery<Array<{
    id: number;
    versionLabel: string;
    eventType: string;
    status: string;
    reason: string | null;
    createdAt: string;
  }>>({
    queryKey: ["/api/microplans", historyMicroplanId, "versions"],
    queryFn: async () => {
      const response = await fetch("/api/microplans/" + historyMicroplanId + "/versions", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load microplan history");
      return response.json();
    },
    enabled: historyMicroplanId !== null,
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
    return { sessionsById, populationById };
  }, [sessionPlans, populationData]);

  const resolveGeo = (item: ApprovalRequest) => {
    let source: Record<string, unknown> | null = null;
    if (item.entityType === "session") {
      const sp = entityLookup.sessionsById.get(item.entityId);
      if (sp) source = sp as unknown as Record<string, unknown>;
    } else if (item.entityType === "population") {
      const pop = entityLookup.populationById.get(item.entityId);
      if (pop) source = pop as unknown as Record<string, unknown>;
    } else if (item.entityType === "facility") {
      source = { facilityId: item.entityId };
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

  const applyGeoFilter = (list: ApprovalRequest[]): ApprovalRequest[] => {
    if (geoProvinceId === null && geoDistrictId === null && geoFacilityId === null) return list;
    return list.filter((r) => {
      const g = resolveGeo(r);
      if (geoProvinceId !== null && g.provinceId !== geoProvinceId) return false;
      if (geoDistrictId !== null && g.districtId !== geoDistrictId) return false;
      if (geoFacilityId !== null && g.facilityId !== geoFacilityId) return false;
      return true;
    });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      setSelectedRequest(null);
      setActionType(null);
      setComment("");
      toast({
        title: variables.action === "approve" ? "Approved" : variables.action === "return" ? "Returned for correction" : "Rejected",
        description: variables.action === "return" ? "The microplan is editable again and the correction reason was preserved." : "The request was updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const enrichWithGeo = (list: ApprovalRequest[]) =>
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
      } as ApprovalRequest & {
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
      render: (item: ApprovalRequest) => {
        const Icon = getEntityIcon(item.entityType);
        return (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium capitalize">{item.entityType} Update</p>
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
      header: "Level",
      render: (item: ApprovalRequest) => (
        <Badge variant="outline" className="capitalize">
          {item.currentLevel}
        </Badge>
      ),
    },
    {
      key: "_geoProvinceName",
      header: "Province",
      sortable: true,
      render: (item: ApprovalRequest) => {
        const g = resolveGeo(item);
        const name = g.provinceId !== null ? geoMaps.provinceMap.get(g.provinceId)?.name : null;
        return <span className="text-sm">{name ?? "—"}</span>;
      },
    },
    {
      key: "_geoDistrictName",
      header: "District",
      sortable: true,
      render: (item: ApprovalRequest) => {
        const g = resolveGeo(item);
        const name = g.districtId !== null ? geoMaps.districtMap.get(g.districtId)?.name : null;
        return <span className="text-sm">{name ?? "—"}</span>;
      },
    },
    {
      key: "submittedAt",
      header: "Submitted",
      sortable: true,
      render: (item: ApprovalRequest) => (
        <span className="text-sm">
          {item.submittedAt
            ? format(new Date(item.submittedAt), "MMM d, yyyy HH:mm")
            : "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: ApprovalRequest) => (
        <ApprovalBadge status={item.status || "pending"} />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: ApprovalRequest) => {
        const isMicroplan = item.entityType === "microplan";
        return (
          <div className="flex items-center gap-1">
            {isMicroplan && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHistoryMicroplanId(item.entityId)}
                title="Version history"
                data-testid={"button-history-" + item.id}
              >
                <History className="h-4 w-4" />
              </Button>
            )}
            {item.status === "pending" && (
              <>
                {isMicroplan && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
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
                  onClick={() => {
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
                  onClick={() => {
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
                <p className="text-2xl font-bold text-destructive">
                  {rejectedRequests.length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <GeoCascadeFilter
        provinceId={geoProvinceId}
        districtId={geoDistrictId}
        facilityId={geoFacilityId}
        onProvinceChange={setGeoProvinceId}
        onDistrictChange={setGeoDistrictId}
        onFacilityChange={setGeoFacilityId}
        showFacility
        provinces={provinces}
        districts={districts}
        facilities={facilities}
        testIdPrefix="approvals"
      />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="entity-history" data-testid="tab-entity-history">
            Entity Version Proposals
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            Approved
          </TabsTrigger>
          <TabsTrigger value="returned" data-testid="tab-returned">
            Returned ({returnedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">
            Rejected
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entity-history" className="mt-4">
          <ChangeApprovalScreen />
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <DataTable
                data={pendingRequests}
                columns={columns}
                searchable
                searchKeys={["entityType", "currentLevel"]}
                emptyMessage="No pending approval requests."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <DataTable
                data={approvedRequests}
                columns={columns}
                searchable
                searchKeys={["entityType", "currentLevel"]}
                emptyMessage="No approved requests yet."
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
                  </div>
                  <time className="whitespace-nowrap text-xs text-muted-foreground">
                    {format(new Date(version.createdAt), "MMM d, yyyy HH:mm")}
                  </time>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Approval Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 justify-center">
            {(() => {
              const maxApprovalLevel = (tenant?.settings as any)?.maxApprovalLevel || "national";
              const items = [
                { level: "Facility", role: "Facility Clerk" },
                { level: "District", role: "District Manager" },
                { level: "Provincial", role: "Provincial Coordinator" },
                { level: "National", role: "National Admin" },
              ];
              const filtered = items.filter((item, index) => {
                if (maxApprovalLevel === "district") return index <= 1;
                if (maxApprovalLevel === "provincial") return index <= 2;
                return true; // national
              });
              return filtered.map((item, index) => (
                <div key={item.level} className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      <span className="text-lg font-bold text-primary">
                        {index + 1}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{item.level}</p>
                    <p className="text-xs text-muted-foreground">{item.role}</p>
                  </div>
                  {index < filtered.length - 1 && (
                    <div className="h-0.5 w-8 bg-muted hidden sm:block" />
                  )}
                </div>
              ));
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
