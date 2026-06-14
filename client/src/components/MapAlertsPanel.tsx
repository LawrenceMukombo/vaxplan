import { useState } from "react";
import { Link } from "wouter";
import {
  Bell, AlertTriangle, Info, X, CheckCircle,
  Clock, MapPin, Satellite, TrendingUp, Users,
  ChevronLeft
} from "lucide-react";
import { useGetAlerts, useDismissAlert } from "@/hooks/vgie/useVgieApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface MapAlertsPanelProps {
  onClose: () => void;
  isOpen: boolean;
  onToggleExpanded: () => void;
  positionClass: string;
}

export function MapAlertsPanel({ onClose, isOpen, onToggleExpanded, positionClass }: MapAlertsPanelProps) {
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

  return (
    <div
      className={`absolute top-16 ${positionClass} w-80 z-[1000] flex flex-col pointer-events-auto transition-all duration-300`}
      onWheelCapture={(e) => e.stopPropagation()}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      <Card className="shadow-2xl border border-white/15 bg-background/85 backdrop-blur-md rounded-xl select-none overflow-hidden max-h-[600px] flex flex-col">
        <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between border-b border-border/40 shrink-0 bg-card/50">
          <div className="flex flex-col">
            <CardTitle className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-amber-500" />
              Active Alerts
            </CardTitle>
            <span className="text-[9px] text-muted-foreground leading-normal mt-0.5">
              {criticalCount > 0 ? `${criticalCount} critical alerts` : "System notifications"}
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
            <div className="p-2 border-b border-border/30 shrink-0 bg-background/50">
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="w-full h-8 text-xs bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All severities</SelectItem>
                  <SelectItem value="critical" className="text-xs">Critical</SelectItem>
                  <SelectItem value="warning" className="text-xs">Warning</SelectItem>
                  <SelectItem value="info" className="text-xs">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-2 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="bg-card/40 border-border/50">
                      <CardContent className="p-3">
                        <Skeleton className="h-12 bg-muted rounded" />
                      </CardContent>
                    </Card>
                  ))
                : (alerts ?? []).map((alert: any) => {
                    const sc = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
                    const AlertIcon = alertTypeIcons[alert.alertType as string] ?? Bell;
                    return (
                      <Card
                        key={alert.id}
                        className={`bg-card/40 border border-border/50 border-l-4 ${sc.border} hover:border-border/80 transition-colors shadow-sm`}
                      >
                        <CardContent className="p-2.5">
                          <div className="flex items-start gap-2">
                            <AlertIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${sc.iconColor}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge className={`text-[9px] px-1 py-0 uppercase border ${sc.color}`}>
                                  {alert.severity}
                                </Badge>
                                <span className="text-[9px] text-muted-foreground uppercase tracking-wide truncate">
                                  {alert.alertType.replace(/_/g, " ")}
                                </span>
                              </div>
                              <p className="text-xs text-foreground mt-1 leading-snug">{alert.message}</p>
                              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/40">
                                {alert.settlementName ? (
                                  <Link href={`/settlements/${alert.settlementId}`}>
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer truncate max-w-[120px]">
                                      <MapPin className="w-2.5 h-2.5" /> {alert.settlementName}
                                    </span>
                                  </Link>
                                ) : <span />}
                                <span className="text-[9px] text-muted-foreground shrink-0">
                                  {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
                              onClick={() => handleDismiss(alert.id)}
                              disabled={isPending}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              {!isLoading && (!alerts || alerts.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle className="w-6 h-6 mb-2 text-emerald-600 dark:text-emerald-500" />
                  <p className="text-xs">No active alerts</p>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
