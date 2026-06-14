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
  high: "text-red-400 bg-red-500/10 border-red-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};
const statusColors: Record<string, string> = {
  pending: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  accepted: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  dismissed: "text-slate-500 bg-slate-500/10 border-slate-600/20",
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
  const aiGeneratedCount = (recs ?? []).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Recommendations</h2>
          <p className="text-sm text-slate-500">{recs?.length ?? 0} results · {highPriorityCount} high priority</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleGenerate}
            disabled={generating}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 text-sm"
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

      <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-xs text-slate-500">
        <span className="text-emerald-400 font-medium">AI Generate</span> uses GPT-4o-mini to analyze each unserved settlement and write specific, contextual vaccination recommendations based on population, access, and facility data.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36 h-8 text-sm bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all" className="text-slate-300">All statuses</SelectItem>
            <SelectItem value="pending" className="text-slate-300">Pending</SelectItem>
            <SelectItem value="accepted" className="text-slate-300">Accepted</SelectItem>
            <SelectItem value="dismissed" className="text-slate-300">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36 h-8 text-sm bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all" className="text-slate-300">All priorities</SelectItem>
            <SelectItem value="high" className="text-slate-300">High</SelectItem>
            <SelectItem value="medium" className="text-slate-300">Medium</SelectItem>
            <SelectItem value="low" className="text-slate-300">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <Skeleton className="h-16 bg-slate-800 rounded" />
                </CardContent>
              </Card>
            ))
          : (recs ?? []).map((rec: any) => (
              <Card key={rec.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
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
                      <p className="text-sm font-medium text-slate-200 mt-1.5">{rec.recommendationType}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <Link href={`/settlements/${rec.settlementId}`}
                          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                        >
                          <ClipboardList className="w-3 h-3" /> {rec.settlementName ?? `Settlement #${rec.settlementId}`}
                        </Link>
                        {rec.expectedChildren != null && (
                          <span className="text-xs text-slate-600 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {rec.expectedChildren} children U5
                          </span>
                        )}
                      </div>
                      {rec.notes && (
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{rec.notes}</p>
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
                          className="h-7 px-2 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800"
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
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <CheckCircle className="w-8 h-8 mb-2 text-emerald-700" />
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
