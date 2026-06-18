import { useLocation } from "wouter";
import { Bell, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useGetAlerts } from "@/hooks/vgie/useVgieApi";

const titles: Record<string, string> = {
  "/": "Dashboard Overview",
  "/map": "Map View",
  "/settlements": "Settlements",
  "/facilities": "Health Facilities",
  "/recommendations": "Recommendations",
  "/alerts": "Alerts & Notifications",
};

export function Header() {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { data: alerts } = useGetAlerts();

  const unread = alerts?.filter((a) => !a.dismissed).length ?? 0;
  const title = Object.entries(titles).find(([k]) => k === "/" ? location === "/" : location.startsWith(k))?.[1] ?? "VGIE";

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">Zambia · Lusaka / Kafue / Chilanga</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => queryClient.invalidateQueries()}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Bell className="w-4 h-4" />
          </Button>
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">Live</span>
        </div>
      </div>
    </header>
  );
}
