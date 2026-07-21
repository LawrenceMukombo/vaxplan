import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History, Calendar, FileText, Send, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string | number;
  entityName?: string;
  onSuccess?: () => void;
}

export const CreateChangeModal: React.FC<CreateChangeModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [changeType, setChangeType] = useState("updated");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [changeReason, setChangeReason] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [sourceType, setSourceType] = useState("manual");
  const [sourceReference, setSourceReference] = useState("");
  const [sourceDocumentUrl, setSourceDocumentUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeReason.trim()) {
      toast({
        title: "Justification Required",
        description: "Please provide a clear reason for proposing this change.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/entity-history/${entityType}/${entityId}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeType,
          changeReason,
          changeSummary: changeSummary || `${entityType} updated`,
          sourceType,
          sourceReference,
          sourceDocumentUrl,
          validFrom,
          snapshotData: {
            updatedAt: new Date().toISOString(),
            proposedBy: "User",
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to submit change proposal");

      toast({
        title: "Change Proposal Created",
        description: "Your proposed version change has been submitted for review/approval.",
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Propose Entity Change
          </DialogTitle>
          <DialogDescription>
            Propose a version change for <strong>{entityName || `${entityType} #${entityId}`}</strong> with temporal tracking.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Change Type</label>
            <Select value={changeType} onValueChange={setChangeType}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">General Update</SelectItem>
                <SelectItem value="role_changed">Role / Rank Assignment</SelectItem>
                <SelectItem value="transferred">Facility / Location Transfer</SelectItem>
                <SelectItem value="reclassified">Type / Designation Reclassification</SelectItem>
                <SelectItem value="catchment_updated">Catchment / Boundary Update</SelectItem>
                <SelectItem value="population_revised">Population Denominator Revision</SelectItem>
                <SelectItem value="status_changed">Operational Status Change</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" /> Effective Date (valid_from)
            </label>
            <Input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Change Summary</label>
            <Input
              placeholder="e.g. Promoted to Acting District EPI Officer"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">
              Reason / Justification <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Provide official reason or administrative order details..."
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              className="min-h-[80px] text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Source Type</label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Admin Edit</SelectItem>
                  <SelectItem value="gazette">Government Gazette</SelectItem>
                  <SelectItem value="administrative_order">Administrative Order</SelectItem>
                  <SelectItem value="census">NSO Census</SelectItem>
                  <SelectItem value="survey">Survey / Assessment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Source Reference</label>
              <Input
                placeholder="Order / Letter #"
                value={sourceReference}
                onChange={(e) => setSourceReference(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              <Send className="w-3.5 h-3.5" /> Submit Change
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
