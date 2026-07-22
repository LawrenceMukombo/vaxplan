import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, UserMinus, UserPlus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ExpandedFacilityDetailsProps {
  facility: any;
}

export function ExpandedFacilityDetails({ facility }: ExpandedFacilityDetailsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newChvName, setNewChvName] = useState("");
  const [newChvNrc, setNewChvNrc] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Mutations
  const updateChvMutation = useMutation({
    mutationFn: async ({ chvId, assignedVillageId }: { chvId: number, assignedVillageId: number | null }) => {
      const res = await apiRequest("PATCH", `/api/chvs/${chvId}`, { villageId: assignedVillageId });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chvs?pageSize=10000"] });
      toast({ title: "CHV Assignment Updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const createChvMutation = useMutation({
    mutationFn: async (payload: { fullName: string, nrc: string, facilityId: number }) => {
      const res = await apiRequest("POST", "/api/chvs", payload);
      return res;
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
    }
  });

  const handleAssign = (chvId: string, communityId: number) => {
    updateChvMutation.mutate({ chvId: parseInt(chvId, 10), assignedVillageId: communityId });
  };

  const handleUnassign = (chvId: number) => {
    updateChvMutation.mutate({ chvId, assignedVillageId: null });
  };

  const handleCreate = () => {
    if (!newChvName || !newChvNrc) return;
    createChvMutation.mutate({
      fullName: newChvName,
      nrc: newChvNrc,
      facilityId: facility.id
    });
  };

  return (
    <div className="space-y-6">
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
              onChange={e => setNewChvName(e.target.value)} 
              className="w-40 h-8 text-sm"
            />
            <Input 
              placeholder="NRC" 
              value={newChvNrc} 
              onChange={e => setNewChvNrc(e.target.value)} 
              className="w-32 h-8 text-sm"
            />
            <Button size="sm" onClick={handleCreate} disabled={createChvMutation.isPending}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
          </div>
        )}
      </div>

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
                <TableCell colSpan={4} className="text-center text-muted-foreground">No communities found</TableCell>
              </TableRow>
            ) : (
              facility.communities.map((community: any) => (
                <TableRow key={community.id}>
                  <TableCell className="font-medium">{community.name}</TableCell>
                  <TableCell>
                    {community.chvs.length > 0 ? (
                      <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Covered</Badge>
                    ) : (
                      <Badge variant="destructive">Service Gap</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {community.chvs.map((chv: any) => (
                        <div key={chv.id} className="flex items-center justify-between bg-muted/50 rounded-md px-2 py-1 text-sm">
                          <span>{chv.fullName} <span className="text-xs text-muted-foreground">({chv.nrc})</span></span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => handleUnassign(chv.id)}
                            disabled={updateChvMutation.isPending}
                            title="Unassign CHV"
                          >
                            <UserMinus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {community.chvs.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Select 
                      onValueChange={(val) => handleAssign(val, community.id)}
                      disabled={facility.unassignedChvs.length === 0 || updateChvMutation.isPending}
                      value=""
                    >
                      <SelectTrigger className="w-[180px] h-8 ml-auto">
                        <SelectValue placeholder={facility.unassignedChvs.length === 0 ? "No unassigned CHVs" : "Assign CHV..."} />
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
          <strong>{facility.unassignedChvs.length}</strong> CHV(s) available in this facility waiting for assignment.
        </div>
      )}
    </div>
  );
}
