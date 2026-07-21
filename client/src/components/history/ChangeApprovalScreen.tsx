import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Clock, ShieldCheck, User, Calendar, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export const ChangeApprovalScreen: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState<{ [id: number]: string }>({});

  const { data: pendingChanges = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/entity-history/pending-approvals"],
  });

  const approveMutation = useMutation({
    mutationFn: async (changeId: number) => {
      const res = await fetch(`/api/entity-history/changes/${changeId}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to approve change");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Approved", description: "Entity version change approved and activated." });
      queryClient.invalidateQueries({ queryKey: ["/api/entity-history/pending-approvals"] });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Approval Failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ changeId, reason }: { changeId: number; reason: string }) => {
      const res = await fetch(`/api/entity-history/changes/${changeId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to reject change");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rejected", description: "Entity version change has been rejected." });
      queryClient.invalidateQueries({ queryKey: ["/api/entity-history/pending-approvals"] });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Rejection Failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <Clock className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
        Loading pending entity history approvals...
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Entity Version Change Approval Queue
            </CardTitle>
            <CardDescription className="text-xs">
              Review and approve temporal version proposals for users, facilities, boundaries, and population data.
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-bold">
            {pendingChanges.length} Pending
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {pendingChanges.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm border rounded-lg bg-muted/10">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            No pending entity version approvals in the queue. All historical records are up to date.
          </div>
        ) : (
          pendingChanges.map((change) => (
            <div
              key={change.id}
              className="p-4 rounded-xl border bg-card hover:border-border/80 transition-all space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500 text-white capitalize">{change.entityType}</Badge>
                  <span className="font-semibold text-sm">
                    {change.changeSummary || `Version #${change.versionNumber}`}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    v{change.versionNumber}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>Effective: {format(new Date(change.validFrom), "dd MMM yyyy")}</span>
                </div>
              </div>

              {change.changeReason && (
                <div className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-md border italic">
                  Justification: &ldquo;{change.changeReason}&rdquo;
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Created By: <strong className="text-foreground">{change.createdBy || "System"}</strong></div>
                <div>Source: <strong className="text-foreground">{change.sourceType || "Manual"}</strong></div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 max-w-sm flex items-center gap-2">
                  <Input
                    placeholder="Reason for rejection (optional)..."
                    value={rejectReason[change.id] || ""}
                    onChange={(e) =>
                      setRejectReason({ ...rejectReason, [change.id]: e.target.value })
                    }
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      rejectMutation.mutate({
                        changeId: change.id,
                        reason: rejectReason[change.id] || "",
                      })
                    }
                    disabled={rejectMutation.isPending}
                    className="h-8 text-xs gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>

                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate(change.id)}
                  disabled={approveMutation.isPending}
                  className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Activate
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
