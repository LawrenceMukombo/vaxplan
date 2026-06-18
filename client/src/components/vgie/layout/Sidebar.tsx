import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Map,
  Building2,
  Hospital,
  ClipboardList,
  Bell,
  Activity,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Map View", icon: Map },
  { href: "/settlements", label: "Settlements", icon: Building2 },
  { href: "/facilities", label: "Facilities", icon: Hospital },
  { href: "/recommendations", label: "Recommendations", icon: ClipboardList },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">VaxPlan VGIE</p>
            <p className="text-xs text-muted-foreground truncate">Geospatial Intelligence</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/50">
          <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">
            D
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">District Health Officer</p>
            <p className="text-xs text-muted-foreground truncate">Zambia MOH</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
