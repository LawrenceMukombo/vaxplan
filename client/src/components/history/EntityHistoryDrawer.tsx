import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimelineComponent } from "./TimelineComponent";
import { VersionCompareModal } from "./VersionCompareModal";
import { ViewAsOfDateControl } from "./ViewAsOfDateControl";
import { CreateChangeModal } from "./CreateChangeModal";
import { History, GitCompare, Plus, RefreshCw, Loader2, Calendar } from "lucide-react";

interface EntityHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string | number;
  entityName?: string;
}

export const EntityHistoryDrawer: React.FC<EntityHistoryDrawerProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
}) => {
  const [asOfDate, setAsOfDate] = useState<string | null>(null);
  const [selectedVersionForCompare, setSelectedVersionForCompare] = useState<any[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isProposeOpen, setIsProposeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("timeline");

  // Fetch full entity history
  const { data: history = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: [`/api/entity-history/${entityType}/${entityId}/history`],
    enabled: isOpen && !!entityId,
  });

  // Fetch as-of version if date selected
  const { data: asOfVersion } = useQuery<any>({
    queryKey: [`/api/entity-history/${entityType}/${entityId}/as-of`, asOfDate],
    enabled: isOpen && !!asOfDate,
  });

  // Fetch side-by-side comparison if two versions selected
  const { data: comparisonData } = useQuery<any>({
    queryKey: [
      `/api/entity-history/${entityType}/${entityId}/compare`,
      selectedVersionForCompare[0]?.id,
      selectedVersionForCompare[1]?.id,
    ],
    enabled: isCompareOpen && selectedVersionForCompare.length === 2,
  });

  const handleSelectForCompare = (version: any) => {
    if (selectedVersionForCompare.find((v) => v.id === version.id)) {
      setSelectedVersionForCompare(selectedVersionForCompare.filter((v) => v.id !== version.id));
    } else if (selectedVersionForCompare.length < 2) {
      const next = [...selectedVersionForCompare, version];
      setSelectedVersionForCompare(next);
      if (next.length === 2) {
        setIsCompareOpen(true);
      }
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col h-full">
          <SheetHeader className="p-6 border-b space-y-2">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-lg">
                <History className="w-5 h-5 text-primary" />
                Entity Life Story & History
              </SheetTitle>
              <Button size="sm" onClick={() => setIsProposeOpen(true)} className="gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" /> Propose Change
              </Button>
            </div>
            <SheetDescription className="text-xs">
              Complete historical version record and point-in-time audit for{" "}
              <strong className="text-foreground">{entityName || `${entityType} #${entityId}`}</strong>
            </SheetDescription>

            <div className="pt-2 flex items-center justify-between border-t border-border/40">
              <ViewAsOfDateControl
                asOfDate={asOfDate}
                onAsOfDateChange={setAsOfDate}
                entityName={entityName}
              />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="h-7 text-xs gap-1"
                disabled={isLoading}
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </SheetHeader>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {asOfDate && asOfVersion && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                <div className="font-semibold text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> State as of {asOfDate}
                </div>
                <div className="text-xs text-muted-foreground">
                  Version #{asOfVersion.versionNumber} ({asOfVersion.status}) was active on this date.
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                <span className="text-xs">Loading entity temporal history...</span>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="timeline" className="text-xs">Visual Timeline</TabsTrigger>
                  <TabsTrigger value="versions" className="text-xs">Version Registry ({history.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline">
                  <TimelineComponent
                    events={history}
                    onSelectEvent={(evt) => {
                      if (selectedVersionForCompare.length === 1) {
                        handleSelectForCompare(evt);
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="versions" className="space-y-3">
                  {history.map((v) => {
                    const isSelected = selectedVersionForCompare.some((sv) => sv.id === v.id);
                    return (
                      <div
                        key={v.id}
                        className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                          isSelected ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/20"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs">v{v.versionNumber}</span>
                            <span className="font-semibold text-xs capitalize">{v.changeType}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{v.changeSummary}</p>
                        </div>

                        <Button
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => handleSelectForCompare(v)}
                          className="h-7 text-[11px] gap-1 shrink-0"
                        >
                          <GitCompare className="w-3 h-3" />
                          {isSelected ? "Selected" : "Compare"}
                        </Button>
                      </div>
                    );
                  })}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Version Comparison Modal */}
      <VersionCompareModal
        isOpen={isCompareOpen}
        onClose={() => {
          setIsCompareOpen(false);
          setSelectedVersionForCompare([]);
        }}
        versionA={selectedVersionForCompare[0]}
        versionB={selectedVersionForCompare[1]}
        differences={comparisonData?.differences || []}
      />

      {/* Propose Change Modal */}
      <CreateChangeModal
        isOpen={isProposeOpen}
        onClose={() => setIsProposeOpen(false)}
        entityType={entityType}
        entityId={entityId}
        entityName={entityName}
        onSuccess={() => refetch()}
      />
    </>
  );
};
