import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, GitCompare, Calendar, User, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface VersionCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  versionA?: any;
  versionB?: any;
  differences?: Array<{ field: string; valueA: any; valueB: any }>;
}

export const VersionCompareModal: React.FC<VersionCompareModalProps> = ({
  isOpen,
  onClose,
  versionA,
  versionB,
  differences = [],
}) => {
  if (!versionA || !versionB) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <GitCompare className="w-5 h-5 text-primary" />
            Side-by-Side Version Comparison
          </DialogTitle>
          <DialogDescription>
            Comparing Version {versionA.versionNumber} against Version {versionB.versionNumber}
          </DialogDescription>
        </DialogHeader>

        {/* Version Headers */}
        <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border/40 my-2">
          {/* Version A */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-bold">
                v{versionA.versionNumber}
              </Badge>
              <span className="font-semibold text-sm capitalize">{versionA.changeType}</span>
              {versionA.isCurrent && <Badge className="bg-emerald-600 text-white text-[10px]">Current</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">
              Effective: {versionA.validFrom ? format(new Date(versionA.validFrom), "dd MMM yyyy") : "N/A"}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="w-3 h-3" /> {versionA.createdBy || "System"}
            </div>
          </div>

          {/* Version B */}
          <div className="space-y-1 border-l pl-4 border-border/40">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-bold">
                v{versionB.versionNumber}
              </Badge>
              <span className="font-semibold text-sm capitalize">{versionB.changeType}</span>
              {versionB.isCurrent && <Badge className="bg-emerald-600 text-white text-[10px]">Current</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">
              Effective: {versionB.validFrom ? format(new Date(versionB.validFrom), "dd MMM yyyy") : "N/A"}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="w-3 h-3" /> {versionB.createdBy || "System"}
            </div>
          </div>
        </div>

        {/* Differences Table */}
        <div className="flex-1 overflow-y-auto border rounded-xl divide-y bg-card custom-scrollbar">
          {differences.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No differences detected between Version {versionA.versionNumber} and Version {versionB.versionNumber}.
            </div>
          ) : (
            differences.map((diff, idx) => (
              <div key={idx} className="p-3.5 grid grid-cols-12 items-center hover:bg-muted/20 transition-colors text-xs">
                <div className="col-span-3 font-semibold capitalize text-foreground truncate pr-2">
                  {diff.field.replace(/([A-Z])/g, " $1")}
                </div>

                <div className="col-span-4 p-2 rounded bg-red-500/10 text-red-700 dark:text-red-300 font-mono text-[11px] break-all border border-red-500/20">
                  {diff.valueA !== null && diff.valueA !== undefined ? String(diff.valueA) : <span className="italic opacity-60">empty</span>}
                </div>

                <div className="col-span-1 flex justify-center text-muted-foreground">
                  <ArrowRight className="w-4 h-4" />
                </div>

                <div className="col-span-4 p-2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] break-all border border-emerald-500/20">
                  {diff.valueB !== null && diff.valueB !== undefined ? String(diff.valueB) : <span className="italic opacity-60">empty</span>}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Close Comparison
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
