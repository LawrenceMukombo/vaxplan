import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, UserMinus, ArrowLeftRight, CheckSquare, XSquare } from "lucide-react";
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

  // Per-CHV inline reassign mode
  const [reassigningChvId, setReassigningChvId] = useState<number | null>(null);

  // Bulk selection state: Set of selected CHV IDs
  const [selectedChvIds, setSelectedChvIds] = useState<Set<number>>(new Set());
  const [bulkTargetVillageId, setBulkTargetVillageId] = useState<string>("");

  const allCommunities: any[] = facility.communities || [];
  // Flat list of all CHVs in this facility (assigned + unassigned)
  const allChvsInFacility: any[] = [
    ...allCommunities.flatMap((c: any) => c.chvs),
    ...(facility.unassignedChvs || []),
  ];

  // ── Mutations ─────────────────────────────────────────────────────────────

  const updateChvMutation = useMutation({
    mutationFn: async ({ chvId, assignedVillageId }: { chvId: number; assignedVillageId: number | null }) =>
      apiRequest("PATCH", `/api/chvs/${chvId}`, { villageId: assignedVillageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chvs?pageSize=10000"] });
      setReassigningChvId(null);
      toast({ title: "CHV Assignment Updated" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const bulkReassignMutation = useMutation({
    mutationFn: async ({ chvIds, villageId }: { chvIds: number[]; villageId: number | null }) =>
      apiRequest("POST", "/api/chvs/bulk-reassign", { chvIds, villageId }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chvs?pageSize=10000"] });
      setSelectedChvIds(new Set());
      setBulkTargetVillageId("");
      toast({
        title: `Bulk update complete`,
        description: `${data.succeeded} CHV(s) reassigned${data.failed > 0 ? `, ${data.failed} failed` : ""}.`,
      });
    },
    onError: (error: any) => toast({ title: "Bulk Error", description: error.message, variant: "destructive" }),
  });

  const createChvMutation = useMutation({
    mutationFn: async (payload: { fullName: string; nrc: string; facilityId: number }) =>
      apiRequest("POST", "/api/chvs", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chvs?pageSize=10000"] });
      toast({ title: "CHV Created" });
      setNewChvName("");
      setNewChvNrc("");
      setIsAdding(false);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAssign = (chvId: string, communityId: number) =>
    updateChvMutation.mutate({ chvId: parseInt(chvId, 10), assignedVillageId: communityId });

  const handleUnassign = (chvId: number) =>
    updateChvMutation.mutate({ chvId, assignedVillageId: null });

  const handleReassign = (chvId: number, value: string) =>
    updateChvMutation.mutate({
      chvId,
      assignedVillageId: !value || value === "unassign" ? null : parseInt(value, 10),
    });

  const handleCreate = () => {
    if (!newChvName || !newChvNrc) return;
    createChvMutation.mutate({ fullName: newChvName, nrc: newChvNrc, facilityId: facility.id });
  };

  // Selection helpers
  const toggleChv = (id: number) => {
    setSelectedChvIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedChvIds.size === allChvsInFacility.length) {
      setSelectedChvIds(new Set());
    } else {
      setSelectedChvIds(new Set(allChvsInFacility.map((c: any) => c.id)));
    }
  };

  const handleBulkReassign = () => {
    if (selectedChvIds.size === 0) return;
    const villageId = !bulkTargetVillageId || bulkTargetVillageId === "unassign"
      ? null
      : parseInt(bulkTargetVillageId, 10);
    bulkReassignMutation.mutate({ chvIds: Array.from(selectedChvIds), villageId });
  };

  const handleBulkUnassign = () => {
    if (selectedChvIds.size === 0) return;
    bulkReassignMutation.mutate({ chvIds: Array.from(selectedChvIds), villageId: null });
  };

  const allSelected = allChvsInFacility.length > 0 && selectedChvIds.size === allChvsInFacility.length;
  const someSelected = selectedChvIds.size > 0;
  const isBusy = updateChvMutation.isPending || bulkReassignMutation.isPending;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h4 className="text-md font-semibold">Facility Communities</h4>
        {!isAdding ? (
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add New CHV
          </Button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <Input placeholder="Full Name" value={newChvName} onChange={(e) => setNewChvName(e.target.value)} className="w-40 h-8 text-sm" />
            <Input placeholder="NRC" value={newChvNrc} onChange={(e) => setNewChvNrc(e.target.value)} className="w-32 h-8 text-sm" />
            <Button size="sm" onClick={handleCreate} disabled={createChvMutation.isPending}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
          </div>
        )}
      </div>

      {/* ── Bulk Action Bar ────────────────────────────────────── */}
      {someSelected && (
        <div className="flex items-center gap-3 flex-wrap rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-3 py-2">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedChvIds.size} CHV{selectedChvIds.size !== 1 ? "s" : ""} selected
          </span>
          <Select value={bulkTargetVillageId} onValueChange={setBulkTargetVillageId} disabled={isBusy}>
            <SelectTrigger className="h-7 text-xs w-[200px]">
              <SelectValue placeholder="Move to community..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassign" className="italic text-muted-foreground">— Unassign —</SelectItem>
              {allCommunities.map((c: any) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name} ({c.chvs.length} CHV{c.chvs.length !== 1 ? "s" : ""})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={handleBulkReassign}
            disabled={isBusy || !bulkTargetVillageId}
          >
            <ArrowLeftRight className="h-3 w-3 mr-1" />
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={handleBulkUnassign}
            disabled={isBusy}
          >
            <UserMinus className="h-3 w-3 mr-1" />
            Unassign All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setSelectedChvIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* ── Community Table ────────────────────────────────────── */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all CHVs"
                        className="mt-0.5"
                      />
                    </TooltipTrigger>
                    <TooltipContent>{allSelected ? "Deselect all" : "Select all CHVs"}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead>Community</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned CHVs</TableHead>
              <TableHead className="text-right">Assign CHV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {facility.communities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">No communities found</TableCell>
              </TableRow>
            ) : (
              facility.communities.map((community: any) => (
                <TableRow key={community.id}>
                  {/* Community-level checkbox (selects all CHVs in this community) */}
                  <TableCell className="align-top pt-3">
                    <Checkbox
                      checked={community.chvs.length > 0 && community.chvs.every((c: any) => selectedChvIds.has(c.id))}
                      onCheckedChange={(checked) => {
                        setSelectedChvIds((prev) => {
                          const next = new Set(prev);
                          community.chvs.forEach((c: any) => checked ? next.add(c.id) : next.delete(c.id));
                          return next;
                        });
                      }}
                      disabled={community.chvs.length === 0}
                      aria-label={`Select all CHVs in ${community.name}`}
                    />
                  </TableCell>

                  <TableCell className="font-medium">{community.name}</TableCell>

                  <TableCell>
                    {community.chvs.length > 0 ? (
                      <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Covered</Badge>
                    ) : (
                      <Badge variant="destructive">Service Gap</Badge>
                    )}
                  </TableCell>

                  {/* CHV list with per-CHV checkbox + reassign */}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {community.chvs.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">None</span>
                      )}
                      {community.chvs.map((chv: any) => (
                        <div
                          key={chv.id}
                          className={`flex items-center justify-between rounded-md px-2 py-1 text-sm gap-1 ${selectedChvIds.has(chv.id) ? "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800" : "bg-muted/50"}`}
                        >
                          {/* Per-CHV checkbox */}
                          <Checkbox
                            checked={selectedChvIds.has(chv.id)}
                            onCheckedChange={() => toggleChv(chv.id)}
                            className="shrink-0"
                            aria-label={`Select ${chv.fullName}`}
                          />

                          <span className="truncate max-w-[120px] flex-1 ml-1">
                            {chv.fullName}{" "}
                            <span className="text-xs text-muted-foreground">({chv.nrc})</span>
                          </span>

                          <div className="flex items-center gap-0.5 shrink-0">
                            {/* Inline reassign */}
                            {reassigningChvId === chv.id ? (
                              <>
                                <Select onValueChange={(val) => handleReassign(chv.id, val)} disabled={isBusy}>
                                  <SelectTrigger className="h-6 text-xs w-[150px]">
                                    <SelectValue placeholder="Move to..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassign" className="italic text-muted-foreground">— Unassign —</SelectItem>
                                    {allCommunities
                                      .filter((c: any) => c.id !== community.id)
                                      .map((c: any) => (
                                        <SelectItem key={c.id} value={c.id.toString()}>
                                          {c.name} ({c.chvs.length})
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                <button className="text-xs text-muted-foreground hover:text-foreground px-1" onClick={() => setReassigningChvId(null)}>✕</button>
                              </>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-blue-600" onClick={() => setReassigningChvId(chv.id)} disabled={isBusy}>
                                      <ArrowLeftRight className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Reassign to another community</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* Unassign */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleUnassign(chv.id)} disabled={isBusy}>
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

                  {/* Assign unassigned CHV to this community */}
                  <TableCell className="text-right align-top pt-3">
                    <Select
                      onValueChange={(val) => handleAssign(val, community.id)}
                      disabled={facility.unassignedChvs.length === 0 || isBusy}
                      value=""
                    >
                      <SelectTrigger className="w-[180px] h-8 ml-auto">
                        <SelectValue placeholder={facility.unassignedChvs.length === 0 ? "No unassigned CHVs" : "Assign CHV..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {facility.unassignedChvs.map((chv: any) => (
                          <SelectItem key={chv.id} value={chv.id.toString()}>{chv.fullName}</SelectItem>
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

      {/* Unassigned pool info */}
      {facility.unassignedChvs.length > 0 && (
        <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2">
          <span className="text-sm text-amber-700 dark:text-amber-300">
            <strong>{facility.unassignedChvs.length}</strong> CHV{facility.unassignedChvs.length !== 1 ? "s" : ""} not yet assigned to a community.
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setSelectedChvIds(new Set(facility.unassignedChvs.map((c: any) => c.id)));
              }}
            >
              <CheckSquare className="h-3 w-3 mr-1" />
              Select unassigned
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
