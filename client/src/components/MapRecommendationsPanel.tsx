import { useState } from "react";
import { Link } from "wouter";
import {
  ClipboardList, CheckCircle, XCircle,
  Users, Zap, Sparkles, X, ChevronLeft
} from "lucide-react";
import {
  useGetRecommendations, useUpdateRecommendation, useGenerateRecommendations
} from "@/hooks/vgie/useVgieApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const priorityColors: Record<string, string> = {
  high: "text-red-400 bg-red-500/10 border-red-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};
const statusColors: Record<string, string> = {
  pending: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  accepted: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  dismissed: "text-slate-500 bg-slate-500/10 border-slate-600/20",
};

interface MapRecommendationsPanelProps {
  onClose: () => void;
  isOpen: boolean;
  onToggleExpanded: () => void;
  positionClass: string;
}

export function MapRecommendationsPanel({ onClose, isOpen, onToggleExpanded, positionClass }: MapRecommendationsPanelProps) {
  const [priority, setPriority] = useState<string>("all");
  const [status, setStatus] = useState<string>("pending");
  const [aiGenerating, setAiGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: recs, isLoading } = useGetRecommendations({
    priority: priority !== "all" ? (priority as any) : undefined,
    status: status !== "all" ? (status as any) : undefined,
  });

  const { mutate: updateRec, isPending: updating } = useUpdateRecommendation();
  const { mutate: generate, isPending: generating } = useGenerateRecommendations();

  const handleAccept = (id: number) => {
    updateRec({ id, status: "accepted" }, {
      onSuccess: () => {
        toast({ title: "Recommendation accepted" });
        queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      },
    });
  };

  const handleDismiss = (id: number) => {
    updateRec({ id, status: "dismissed" }, {
      onSuccess: () => {
        toast({ title: "Recommendation dismissed" });
        queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      },
    });
  };

  const handleGenerate = () => {
    generate(undefined, {
      onSuccess: (result: any) => {
        toast({
          title: `Generated ${result.generated} new recommendations`,
          description: `${result.skipped} settlements already had recommendations.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      },
      onError: () => toast({ title: "Failed to generate recommendations", variant: "destructive" }),
    });
  };

  const handleAIGenerate = async () => {
    setAiGenerating(true);
    try {
      const res = await fetch("/api/ai/recommendations/generate", { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "AI failed");
      toast({
        title: `AI generated ${result.generated} recommendations`,
        description: "LLM-powered analysis complete. Review and accept below.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
    } catch (err: any) {
      toast({ title: "AI generation failed", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const highPriorityCount = (recs ?? []).filter((r: any) => r.priority === "high").length;

  return (
    <div
      className={`absolute top-16 ${positionClass} w-[360px] z-[1000] flex flex-col pointer-events-auto transition-all duration-300`}
      onWheelCapture={(e) => e.stopPropagation()}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      <Card className="shadow-2xl border border-white/15 bg-background/85 backdrop-blur-md rounded-xl select-none overflow-hidden max-h-[600px] flex flex-col">
        <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between border-b border-border/40 shrink-0 bg-card/50">
          <div className="flex flex-col">
            <CardTitle className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
              Recommendations
            </CardTitle>
            <span className="text-[9px] text-muted-foreground leading-normal mt-0.5">
              {recs?.length ?? 0} results · {highPriorityCount} high priority
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-full hover:bg-muted text-muted-foreground"
              onClick={onToggleExpanded}
            >
              <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-90" : "-rotate-90"}`} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-full hover:bg-muted text-muted-foreground"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>

        {isOpen && (
          <>
            <div className="p-2 border-b border-border/30 shrink-0 bg-background/50 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  variant="outline"
                  className="flex-1 h-7 text-xs bg-card/50"
                  size="sm"
                >
                  <Zap className="w-3 h-3 mr-1 text-amber-500" />
                  {generating ? "Generating..." : "Rule-Based"}
                </Button>
                <Button
                  onClick={handleAIGenerate}
                  disabled={aiGenerating}
                  className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  size="sm"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  {aiGenerating ? "AI thinking..." : "AI Generate"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="flex-1 h-7 text-[10px] bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-[10px]">All statuses</SelectItem>
                    <SelectItem value="pending" className="text-[10px]">Pending</SelectItem>
                    <SelectItem value="accepted" className="text-[10px]">Accepted</SelectItem>
                    <SelectItem value="dismissed" className="text-[10px]">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="flex-1 h-7 text-[10px] bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-[10px]">All priorities</SelectItem>
                    <SelectItem value="high" className="text-[10px]">High</SelectItem>
                    <SelectItem value="medium" className="text-[10px]">Medium</SelectItem>
                    <SelectItem value="low" className="text-[10px]">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-2 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="bg-card/40 border-border/50">
                      <CardContent className="p-3">
                        <Skeleton className="h-16 bg-muted rounded" />
                      </CardContent>
                    </Card>
                  ))
                : (recs ?? []).map((rec: any) => (
                    <Card key={rec.id} className="bg-card/40 border border-border/50 hover:border-border/80 transition-colors shadow-sm">
                      <CardContent className="p-2.5 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Badge className={`text-[9px] px-1 py-0 uppercase border ${priorityColors[rec.priority]}`}>
                              {rec.priority}
                            </Badge>
                            <Badge className={`text-[9px] px-1 py-0 uppercase border ${statusColors[rec.status]}`}>
                              {rec.status}
                            </Badge>
                          </div>
                          {rec.status === "pending" && (
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="sm"
                                className="h-6 w-6 p-0 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400"
                                onClick={() => handleAccept(rec.id)}
                                disabled={updating}
                              >
                                <CheckCircle className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDismiss(rec.id)}
                                disabled={updating}
                              >
                                <XCircle className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs font-medium text-foreground leading-snug">{rec.recommendationType}</p>
                        
                        <div className="flex items-center justify-between pt-1 border-t border-border/40 mt-0.5">
                          <Link href={`/settlements/${rec.settlementId}`}>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer truncate max-w-[150px]">
                              <ClipboardList className="w-2.5 h-2.5" /> {rec.settlementName ?? `Settlement #${rec.settlementId}`}
                            </span>
                          </Link>
                          {rec.expectedChildren != null && (
                            <span className="text-[9px] text-muted-foreground flex items-center gap-1 shrink-0">
                              <Users className="w-2.5 h-2.5" /> {rec.expectedChildren} U5
                            </span>
                          )}
                        </div>
                        {rec.notes && (
                          <p className="text-[10px] text-muted-foreground/80 leading-relaxed bg-muted/30 p-1.5 rounded mt-0.5">
                            {rec.notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              {!isLoading && (!recs || recs.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle className="w-6 h-6 mb-2 text-emerald-600 dark:text-emerald-500" />
                  <p className="text-xs">No recommendations found</p>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
