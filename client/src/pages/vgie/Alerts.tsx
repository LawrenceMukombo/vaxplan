import { useState } from "react";
import { Link } from "wouter";
import {
  Bell, AlertTriangle, Info, X, CheckCircle,
  Clock, MapPin, Satellite, TrendingUp, Users
} from "lucide-react";
import { useGetAlerts, useDismissAlert } from "@/hooks/vgie/useVgieApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

const severityConfig = {
  critical: {
    color: "text-red-400 bg-red-500/10 border-red-500/20",
    border: "border-l-red-500",
    icon: AlertTriangle,
    iconColor: "text-red-400",
  },
  warning: {
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    border: "border-l-amber-500",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
  },
  info: {
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    border: "border-l-blue-500",
    icon: Info,
    iconColor: "text-blue-400",
  },
};

const alertTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  new_settlement_detected: Satellite,
  outreach_overdue: Clock,
  unserved_population: Users,
  population_growth: TrendingUp,
  coverage_gap: MapPin,
  satellite_detection: Satellite,
};

export default function Alerts() {
  const [severity, setSeverity] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: alerts, isLoading } = useGetAlerts({
    severity: severity !== "all" ? (severity as any) : undefined,
  });

  const { mutate: dismiss, isPending } = useDismissAlert();

  const handleDismiss = (id: number) => {
    dismiss(id, {
      onSuccess: () => {
        toast({ title: "Alert dismissed" });
        queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      },
    });
  };

  const criticalCount = (alerts ?? []).filter((a: any) => a.severity === "critical").length;
  const warningCount = (alerts ?? []).filter((a: any) => a.severity === "warning").length;
  const infoCount = (alerts ?? []).filter((a: any) => a.severity === "info").length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Alerts & Notifications</h2>
          <div className="flex items-center gap-3 mt-1">
            {criticalCount > 0 && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {criticalCount} critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {warningCount} warnings
              </span>
            )}
            {infoCount > 0 && (
              <span className="text-xs text-blue-400 flex items-center gap-1">
                <Info className="w-3 h-3" /> {infoCount} info
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <Select value={severity} onValueChange={setSeverity}>
        <SelectTrigger className="w-40 h-8 text-sm bg-slate-900 border-slate-700 text-slate-300">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-700">
          <SelectItem value="all" className="text-slate-300">All severities</SelectItem>
          <SelectItem value="critical" className="text-slate-300">Critical</SelectItem>
          <SelectItem value="warning" className="text-slate-300">Warning</SelectItem>
          <SelectItem value="info" className="text-slate-300">Info</SelectItem>
        </SelectContent>
      </Select>

      <div className="space-y-2.5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <Skeleton className="h-16 bg-slate-800 rounded" />
                </CardContent>
              </Card>
            ))
          : (alerts ?? []).map((alert: any) => {
              const sc = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
              const AlertIcon = alertTypeIcons[alert.alertType as string] ?? Bell;
              return (
                <Card
                  key={alert.id}
                  className={`bg-slate-900 border-slate-800 border-l-4 ${sc.border} hover:border-slate-700 transition-colors`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertIcon className={`w-4 h-4 mt-0.5 shrink-0 ${sc.iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-[10px] px-1.5 py-0 border ${sc.color}`}>
                            {alert.severity}
                          </Badge>
                          <span className="text-[10px] text-slate-600 uppercase tracking-wide">
                            {alert.alertType.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">{alert.message}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {alert.settlementName && (
                            <Link href={`/settlements/${alert.settlementId}`}>
                              <span className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer">
                                <MapPin className="w-3 h-3" /> {alert.settlementName}
                              </span>
                            </Link>
                          )}
                          <span className="text-xs text-slate-600">
                            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-600 hover:text-slate-300 hover:bg-slate-800 shrink-0"
                        onClick={() => handleDismiss(alert.id)}
                        disabled={isPending}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        {!isLoading && (!alerts || alerts.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <CheckCircle className="w-8 h-8 mb-2 text-emerald-700" />
            <p className="text-sm">All clear — no active alerts</p>
          </div>
        )}
      </div>
    </div>
  );
}
