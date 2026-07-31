import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, UserMinus, ArrowLeftRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ExpandedFacilityDetailsProps {
  facility: any;
}

export function ExpandedFacilityDetails({ facility }: ExpandedFacilityDetailsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newChvName, setNewChvName] = useState("");
  const [newChvNrc, setNewChvNrc] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  // Tracks which CHV is in "reassign mode" (shows the Move To dropdown)
  const [reassigningChvId, setReassigningChvId] = useState<number | null>(null);

  const updateChvMutation = useMutation({
    mutationFn: async ({ chvId, assignedVillageId }: { chvId: number; assignedVillageId: number | null }) => {
      return apiRequest("PATCH", `/api/chvs/${chvId}`, { villageId: assignedVillageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chvs?pageSize=10000"] });
      setReassigningChvId(null);
      toast({ title: "CHV Assignment Updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createChvMutation = useMutation({
    mutationFn: async (payload: { fullName: string; nrc: string; facilityId: number }) => {
      return apiRequest("POST", "/api/chvs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chvs?pageSize=10000"] });
      toast({ title: "CHV Created" });
      setNewChvName("");
      setNewChvNrc("");
      setIsAdding(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAssign = (chvId: string, communityId: number) => {
    updateChvMutation.mutate({ chvId: parseInt(chvId, 10), assignedVillageId: communityId });
  };

  const handleUnassign = (chvId: number) => {
    updateChvMutation.mutate({ chvId, assignedVillageId: null });
  };

  const handleReassign = (chvId: number, value: string) => {
    if (!value || value === "unassign") {
      updateChvMutation.mutate({ chvId, assignedVillageId: null });
    } else {
      updateChvMutation.mutate({ chvId, assignedVillageId: parseInt(value, 10) });
    }
  };

  const handleCreate = () => {
    if (!newChvName || !newChvNrc) return;
    createChvMutation.mutate({ fullName: newChvName, nrc: newChvNrc, facilityId: facility.id });
  };

  const allCommunities: any[] = facility.communities || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h4 className="text-md font-semibold">Facility Communities</h4>
        {!isAdding ? (
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add New CHV
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Full Name"
              value={newChvName}
              onChange={(e) => setNewChvName(e.target.value)}
              className="w-40 h-8 text-sm"
            />
            <Input
              placeholder="NRC"
              value={newChvNrc}
              onChange={(e) => setNewChvNrc(e.target.value)}
              className="w-32 h-8 text-sm"
            />
            <Button size="sm" onClick={handleCreate} disabled={createChvMutation.isPending}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Community</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned CHVs</TableHead>
              <TableHead className="text-right">Assign CHV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {facility.communities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No communities found
                </TableCell>
              </TableRow>
            ) : (
              facility.communities.map((community: any) => (
                <TableRow key={community.id}>
                  {/* Community name */}
                  <TableCell className="font-medium">{community.name}</TableCell>

                  {/* Coverage badge */}
                  <TableCell>
                    {community.chvs.length > 0 ? (
                      <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                        Covered
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Service Gap</Badge>
                    )}
                  </TableCell>

                  {/* CHV list with inline reassign */}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {community.chvs.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">None</span>
                      )}
                      {community.chvs.map((chv: any) => (
                        <div
                          key={chv.id}
                          className="flex items-center justify-between bg-muted/50 rounded-md px-2 py-1 text-sm gap-1"
                        >
                          {/* Name */}
                          <span className="truncate max-w-[130px]">
                            {chv.fullName}{" "}
                            <span className="text-xs text-muted-foreground">({chv.nrc})</span>
                          </span>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            {reassigningChvId === chv.id ? (
                              <>
                                {/* Move-to dropdown */}
                                <Select
                                  onValueChange={(val) => handleReassign(chv.id, val)}
                                  disabled={updateChvMutation.isPending}
                                >
                                  <SelectTrigger className="h-6 text-xs w-[160px]">
                                    <SelectValue placeholder="Move to..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassign" className="text-muted-foreground italic">
                                      — Unassign (no community) —
                                    </SelectItem>
                                    {allCommunities
                                      .filter((c: any) => c.id !== community.id)
                                      .map((c: any) => (
                                        <SelectItem key={c.id} value={c.id.toString()}>
                                          {c.name}{" "}
                                          <span className="text-muted-foreground ml-1">
                                            ({c.chvs.length} CHV{c.chvs.length !== 1 ? "s" : ""})
                                          </span>
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                {/* Cancel reassign mode */}
                                <button
                                  className="text-xs text-muted-foreground hover:text-foreground px-1"
                                  onClick={() => setReassigningChvId(null)}
                                  title="Cancel"
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-blue-600"
                                      onClick={() => setReassigningChvId(chv.id)}
                                      disabled={updateChvMutation.isPending}
                                    >
                                      <ArrowLeftRight className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Reassign to another community</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* Unassign (remove from community) */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleUnassign(chv.id)}
                                    disabled={updateChvMutation.isPending}
                                  >
                                    <UserMinus className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Unassign from this community</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TableCell>

                  {/* Assign unassigned CHV */}
                  <TableCell className="text-right">
                    <Select
                      onValueChange={(val) => handleAssign(val, community.id)}
                      disabled={facility.unassignedChvs.length === 0 || updateChvMutation.isPending}
                      value=""
                    >
                      <SelectTrigger className="w-[180px] h-8 ml-auto">
                        <SelectValue
                          placeholder={
                            facility.unassignedChvs.length === 0
                              ? "No unassigned CHVs"
                              : "Assign CHV..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {facility.unassignedChvs.map((chv: any) => (
                          <SelectItem key={chv.id} value={chv.id.toString()}>
                            {chv.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {facility.unassignedChvs.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <strong>{facility.unassignedChvs.length}</strong> CHV(s) in this facility not yet assigned to a community.
        </div>
      )}
    </div>
  );
}
