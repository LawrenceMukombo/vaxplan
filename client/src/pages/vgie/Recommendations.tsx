import { useState } from "react";
import { Link } from "wouter";
import {
  ClipboardList, CheckCircle, XCircle,
  Users, Zap, Sparkles
} from "lucide-react";
import {
  useGetRecommendations, useUpdateRecommendation, useGenerateRecommendations
} from "@/hooks/vgie/useVgieApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const priorityColors: Record<string, string> = {
  high: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/10 border-red-200 dark:border-red-500/20",
  medium: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
  low: "text-muted-foreground dark:text-muted-foreground bg-muted dark:bg-background border-border dark:border-border/20",
};
const statusColors: Record<string, string> = {
  pending: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
  accepted: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
  dismissed: "text-muted-foreground dark:text-muted-foreground bg-muted dark:bg-background border-border dark:border-border/20",
};

export default function Recommendations() {
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
        queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendations"] });
      },
    });
  };

  const handleDismiss = (id: number) => {
    updateRec({ id, status: "dismissed" }, {
      onSuccess: () => {
        toast({ title: "Recommendation dismissed" });
        queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendations"] });
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
        queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendations"] });
      },
      onError: () => toast({ title: "Failed to generate recommendations", variant: "destructive" }),
    });
  };

  const handleAIGenerate = async () => {
    setAiGenerating(true);
    try {
      const res = await fetch("/api/vgie/recommendations/ai-generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const text = await res.text();
      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("Server returned an unexpected response. Please try again.");
      }
      if (!res.ok) throw new Error(result.error ?? "AI generation failed");
      toast({
        title: `Generated ${result.generated} recommendations`,
        description: result.generated > 0
          ? "AI-powered analysis complete. Review and accept below."
          : `${result.skipped ?? 0} settlements already had pending recommendations.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendations"] });
    } catch (err: any) {
      toast({ title: "AI generation failed", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const highPriorityCount = (recs ?? []).filter((r: any) => r.priority === "high").length;
  const aiGeneratedCount = (recs ?? []).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Recommendations</h2>
          <p className="text-sm text-muted-foreground">{recs?.length ?? 0} results · {highPriorityCount} high priority</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleGenerate}
            disabled={generating}
            variant="outline"
            className="text-muted-foreground hover:bg-accent text-sm"
            size="sm"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            {generating ? "Generating..." : "Rule-Based"}
          </Button>
          <Button
            onClick={handleAIGenerate}
            disabled={aiGenerating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
            size="sm"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            {aiGenerating ? "AI thinking..." : "AI Generate"}
          </Button>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/10 text-xs text-muted-foreground">
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">AI Generate</span> uses GPT-4o-mini to analyze each unserved settlement and write specific, contextual vaccination recommendations based on population, access, and facility data.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 rounded" />
                </CardContent>
              </Card>
            ))
          : (recs ?? []).map((rec: any) => (
              <Card key={rec.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] px-1.5 py-0 border ${priorityColors[rec.priority]}`}>
                          {rec.priority} priority
                        </Badge>
                        <Badge className={`text-[10px] px-1.5 py-0 border ${statusColors[rec.status]}`}>
                          {rec.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1.5">{rec.recommendationType}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <Link href={`/settlements/${rec.settlementId}`}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <ClipboardList className="w-3 h-3" /> {rec.settlementName ?? `Settlement #${rec.settlementId}`}
                        </Link>
                        {rec.expectedChildren != null && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" /> {rec.expectedChildren} children U5
                          </span>
                        )}
                      </div>
                      {rec.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{rec.notes}</p>
                      )}
                    </div>
                    {rec.status === "pending" && (
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleAccept(rec.id)}
                          disabled={updating}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                          onClick={() => handleDismiss(rec.id)}
                          disabled={updating}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        {!isLoading && (!recs || recs.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CheckCircle className="w-8 h-8 mb-2 text-emerald-600 dark:text-emerald-700" />
            <p className="text-sm">No recommendations found for the current filters</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-emerald-500 hover:text-emerald-400"
              onClick={handleAIGenerate}
              disabled={aiGenerating}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate with AI now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
