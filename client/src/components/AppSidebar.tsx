import { useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { versionLabel, APP_VERSION, formatBuildTime } from "@/lib/version";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Map,
  Building,
  Hospital,
  Users,
  Calendar,
  CalendarDays,
  CheckCircle,
  AlertTriangle,
  Settings,
  HelpCircle,
  UserPlus,
  HeartPulse,
  Globe,
  ClipboardList,
  ClipboardCheck,
  Database,
  Package,
  Share2,
  Sparkles,
  ShieldCheck,
  Target,
  TrendingUp,
  Wrench,
  ChevronDown,
  ChevronRight,
  FileText,
  BookOpen,
  Layers,
  Radio,
  BarChart3,
  Terminal,
  Activity,
  Home,
  Bell,
  Snowflake,
  MapPin,
  Smartphone,
  Monitor,
  SlidersHorizontal,
  RotateCcw,
  Check,
  FileSpreadsheet,
  DollarSign,
  Calculator,
  RefreshCw,
  Handshake,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import type { User, ApprovalRequest } from "@shared/schema";
import {
  DEFAULT_MODULES,
  MODULE_CATEGORIES,
  MODULE_METADATA,
  ModuleKey,
  getUserModulePreferences,
  setUserModulePreference,
  resetUserModulePreferences,
  isModuleVisible,
} from "@/lib/modules";
import {
  canAccessAdministration,
  canAccessClientLogbook,
  canAccessDefaulterList,
  canAccessDropoutRates,
  canAccessHisIntegrations,
  canAccessUserManagement,
  hasAnyPermission,
} from "@/lib/accessControl";

interface TenantSummary {
  id: string;
  name: string;
  code: string;
  settings?: {
    modules?: Record<string, boolean>;
  };
}

interface AppSidebarProps {
  user: User;
}

interface NavItem {
  title: string;
  path: string;
  icon: any;
  moduleKey?: ModuleKey;
  badge?: string | number;
  superAdminOnly?: boolean;
  wikiAdminOnly?: boolean;
  reconcileOnly?: boolean;
  permissionCheck?: (user: User) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIZED NAVIGATION MODULES
// ─────────────────────────────────────────────────────────────────────────────

// 1. Overview & Core GIS
const overviewNavItems: NavItem[] = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "Map View", path: "/map", icon: Map, moduleKey: "map" },
  { title: "Outreach Map", path: "/facilities/outreach-map", icon: MapPin, moduleKey: "outreachMap" },
  { title: "Settlements", path: "/settlements", icon: Building, moduleKey: "settlementIntel" },
  { title: "Facilities", path: "/facilities", icon: Hospital, moduleKey: "facilities" },
  { title: "Population Hub", path: "/population", icon: Users, moduleKey: "population" },
  {
    title: "Boundary Manager",
    path: "/admin/boundaries",
    icon: Map,
    moduleKey: "boundaries",
    permissionCheck: (u) => hasAnyPermission(u, ["manage_boundaries", "polygons.view", "polygons.create", "polygons.update"]),
  },
];

// 2. Routine Microplanning & Sessions
const planningNavItems: NavItem[] = [
  { title: "Routine Microplan", path: "/microplans/routine", icon: Calendar, moduleKey: "routine" },
  { title: "Immunization Schedule", path: "/immunization-schedule", icon: Calendar, moduleKey: "routine" },
  { title: "Calendar", path: "/calendar", icon: CalendarDays, moduleKey: "sessions" },
  { title: "Sessions Hub", path: "/all-sessions", icon: CalendarDays, moduleKey: "sessions" },
  { title: "Plan Health", path: "/plan-health", icon: ClipboardCheck, moduleKey: "planHealth" },
  { title: "Planning Actions", path: "/planning-actions", icon: ClipboardList, moduleKey: "planningActions" },
  { title: "Planning Evidence", path: "/planning-evidence", icon: FileText, moduleKey: "planningEvidence" },
  { title: "National Plan", path: "/national-plan", icon: FileText, moduleKey: "nationalPlan" },
];

// 3. SIA Campaigns (Supplementary Immunization) - EVERYTHING related to SIA campaigns in one place!
const siaNavItems: NavItem[] = [
  { title: "SIA Microplans", path: "/microplans/campaigns", icon: Sparkles, moduleKey: "campaigns" },
  { title: "Readiness Assessment", path: "/campaigns/readiness", icon: Radio, moduleKey: "campaignReadiness" },
  { title: "Supervision Checklist", path: "/supervision-tools", icon: ClipboardCheck, moduleKey: "campaignSupervision" },
  { title: "House-to-House", path: "/house-to-house", icon: Home, moduleKey: "houseToHouse" },
  { title: "PCE (Post-Campaign)", path: "/pce", icon: ClipboardCheck, moduleKey: "pce" },
  { title: "Summary Sheets", path: "/campaigns/summary-sheets", icon: FileSpreadsheet, moduleKey: "campaignSummaries" },
  { title: "Real-Time Dashboard", path: "/campaigns/realtime-dashboard", icon: Activity, moduleKey: "campaignDashboard" },
];

// 4. Coverage, Defaulters & EPI
const clinicalNavItems: NavItem[] = [
  {
    title: "Client Logbook",
    path: "/clients",
    icon: ClipboardList,
    moduleKey: "clientLogbook",
    permissionCheck: (u) => canAccessClientLogbook(u),
  },
  {
    title: "Defaulter List",
    path: "/clients/defaulters",
    icon: AlertTriangle,
    moduleKey: "defaulters",
    permissionCheck: (u) => canAccessDefaulterList(u),
  },
  {
    title: "Dropout Rates",
    path: "/indicators/dropout",
    icon: TrendingUp,
    moduleKey: "dropout",
    permissionCheck: (u) => canAccessDropoutRates(u),
  },
  { title: "Zero-Dose Villages", path: "/indicators/zero-dose", icon: Target, moduleKey: "zeroDose" },
  { title: "Missed Communities", path: "/missed-communities", icon: AlertTriangle, moduleKey: "missedCommunities" },
  { title: "Recommendations", path: "/vgie/recommendations", icon: ClipboardCheck, moduleKey: "recommendations" },
  { title: "Alerts & Notices", path: "/vgie/alerts", icon: Bell, moduleKey: "recommendations" },
];

// 5. Logistics & Cold Chain
const logisticsNavItems: NavItem[] = [
  { title: "Stock Ledger", path: "/stock", icon: Package, moduleKey: "stock" },
  { title: "Cold Chain Inventory", path: "/cold-chain", icon: Snowflake, moduleKey: "coldChain" },
  { title: "Hard-to-Reach", path: "/htr", icon: AlertTriangle, moduleKey: "htr" },
  { title: "Vaccine Calculator", path: "/vaccines", icon: Calculator, moduleKey: "calculator" },
  { title: "Operational Budget", path: "/budget", icon: DollarSign, moduleKey: "budget" },
  { title: "Social Mobilization", path: "/mobilization", icon: Share2, moduleKey: "mobilization" },
];

// 6. Field & Offline Tools
const fieldNavItems: NavItem[] = [
  { title: "CHW Mobile Workspace", path: "/chw-field", icon: Smartphone, moduleKey: "chwField" },
  { title: "Desktop Offline Hub", path: "/desktop-hub", icon: Monitor, moduleKey: "desktopHub" },
  {
    title: "Field Teams",
    path: "/field-teams",
    icon: Radio,
    moduleKey: "fieldTeams",
    permissionCheck: (u) =>
      ["district_manager", "provincial_coordinator", "national_admin", "gis_specialist"].includes(u.role || "") ||
      Boolean((u as any).isPlatformAdmin),
  },
  { title: "Sync Conflicts", path: "/sync/conflicts", icon: RefreshCw, moduleKey: "syncConflicts" },
];

// 7. Surveillance & Supervision
const surveillanceNavItems: NavItem[] = [
  { title: "VPD Risk Assessment", path: "/risk-assessments", icon: Activity, moduleKey: "riskAssessment" },
  { title: "Surveillance", path: "/surveillance", icon: ShieldCheck, moduleKey: "surveillance" },
  { title: "Supervision Tools", path: "/supervision-tools", icon: ClipboardCheck, moduleKey: "supervisionTools" },
  { title: "Supportive Supervision", path: "/supervision", icon: ClipboardList, moduleKey: "supervision" },
  { title: "Research Module", path: "/research", icon: BookOpen, moduleKey: "research" },
];

// 8. Analytics & Reports
const analyticsNavItems: NavItem[] = [
  { title: "Reports Hub", path: "/reports", icon: BarChart3, moduleKey: "reports" },
  { title: "Indicator Manual", path: "/indicators/manual", icon: BookOpen, moduleKey: "indicators" },
  { title: "Temporal History", path: "/temporal-history", icon: Database, moduleKey: "history" },
  { title: "Standards Alignment", path: "/standards-alignment", icon: ShieldCheck, moduleKey: "standards" },
];

// 9. Workflow & Approvals
const workflowNavItems: NavItem[] = [
  { title: "Approvals", path: "/approvals", icon: CheckCircle, moduleKey: "approvals" },
];

// 10. Administration & Governance
const adminNavItems: NavItem[] = [
  {
    title: "Partnership Enquiries",
    path: "/admin/partners",
    icon: Handshake,
    moduleKey: "userManagement",
    permissionCheck: (u) => canAccessAdministration(u),
  },
  {
    title: "User Management",
    path: "/admin/users",
    icon: Users,
    moduleKey: "userManagement",
    permissionCheck: (u) => canAccessUserManagement(u),
  },
  {
    title: "Access Requests",
    path: "/admin/signups",
    icon: UserPlus,
    moduleKey: "signups",
    permissionCheck: (u) => hasAnyPermission(u, ["users.create", "users.update", "manage_users"]),
  },
  {
    title: "Manage Staff",
    path: "/admin/staff",
    icon: Users,
    moduleKey: "staffManagement",
    permissionCheck: (u) => hasAnyPermission(u, ["users.view", "users.update", "manage_users"]),
  },
  {
    title: "HIS Integrations",
    path: "/his-integrations",
    icon: Share2,
    moduleKey: "interop",
    permissionCheck: (u) => canAccessHisIntegrations(u),
  },
  {
    title: "Country Onboarding",
    path: "/admin/countries",
    icon: Globe,
    superAdminOnly: true,
  },
  {
    title: "Custom Layers",
    path: "/admin/custom-layers",
    icon: Layers,
    moduleKey: "customLayers",
    permissionCheck: (u) => hasAnyPermission(u, ["manage_boundaries", "polygons.view", "polygons.create", "polygons.update"]),
  },
  {
    title: "Catalogue",
    path: "/admin/catalogue",
    icon: Package,
    moduleKey: "catalogue",
    permissionCheck: (u) => hasAnyPermission(u, ["reference_data.view", "reference_data.manage"]),
  },
  {
    title: "Wiki / Docs",
    path: "/admin/wiki",
    icon: BookOpen,
    moduleKey: "wiki",
    wikiAdminOnly: true,
  },
  { title: "Reconcile Vaccines", path: "/admin/reconcile-vaccines", icon: Wrench, reconcileOnly: true },
  { title: "Data Sources", path: "/data-sources", icon: Database, moduleKey: "dataSources" },
  { title: "API Reference", path: "/api-reference", icon: Terminal, moduleKey: "apiReference" },
  { title: "Settings", path: "/settings", icon: Settings },
  { title: "Help", path: "/help", icon: HelpCircle },
];

/**
 * A SidebarGroup whose label acts as an interactive accordion toggle.
 */
function CollapsibleSection({
  label,
  storageKey,
  badge,
  colorClass,
  bgClass,
  children,
}: {
  label: string;
  storageKey: string;
  badge?: number;
  colorClass?: string;
  bgClass?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem(`vaxplan.sidebar.section.${storageKey}`);
      return raw === null ? true : raw === "1";
    } catch {
      return true;
    }
  });
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(`vaxplan.sidebar.section.${storageKey}`, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  if (isCollapsed) {
    return (
      <SidebarGroup className="py-1 px-1">
        <div className="h-px my-1.5 bg-sidebar-border/60 mx-1" title={label} />
        <SidebarGroupContent className="w-full">{children}</SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel asChild>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 rounded-lg transition-colors text-left ${bgClass ?? ""}`}
          data-testid={`sidebar-section-toggle-${storageKey}`}
        >
          <span className={`flex items-center gap-2 font-semibold tracking-wide uppercase text-[11px] ${colorClass ?? ""}`}>
            {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
            {label}
          </span>
          {badge !== undefined && badge > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-bold">
              {badge > 99 ? "99+" : badge}
            </Badge>
          )}
        </button>
      </SidebarGroupLabel>
      <SidebarGroupContent className={open ? "" : "hidden"}>{children}</SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ user }: AppSidebarProps) {
  const [location] = useLocation();
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;
  const [customizationOpen, setCustomizationOpen] = useState(false);

  // User-specific module visibility preferences
  const [userPrefs, setUserPrefs] = useState<Record<string, boolean>>(() => getUserModulePreferences());

  useEffect(() => {
    const handleUpdate = () => setUserPrefs(getUserModulePreferences());
    window.addEventListener("vaxplan-modules-updated", handleUpdate);
    return () => window.removeEventListener("vaxplan-modules-updated", handleUpdate);
  }, []);

  const canAccessApprovals = ["district_manager", "provincial_coordinator", "national_admin"].includes(user.role || "");
  const isNationalAdmin = user.role === "national_admin";
  const isPlatformAdmin = (user as any).isPlatformAdmin === true;
  const isFacilityStaff = user.role === "facility_clerk" || user.role === "facility_in_charge" || user.role === "facility_partner";
  const canAccessAdmin = canAccessAdministration(user);
  const canEditWiki = isNationalAdmin || user.role === "gis_specialist" || isPlatformAdmin;
  const canReconcile = isNationalAdmin || user.role === "district_manager";

  const { data: tenant } = useQuery<TenantSummary>({ queryKey: ["/api/me/tenant"], retry: false });
  const tenantModules = {
    ...DEFAULT_MODULES,
    ...((tenant as any)?.settings?.modules || {}),
  };

  // Helper filter: checks both tenant/admin module enablement AND user preference AND RBAC
  const filterNavItems = (items: NavItem[]): NavItem[] => {
    return items.filter((item) => {
      // 1. Module enablement check (Tenant setting takes precedence, then user preference)
      if (item.moduleKey && !isModuleVisible(item.moduleKey, tenantModules, userPrefs)) {
        return false;
      }
      // 2. Super admin constraint
      if (item.superAdminOnly && !isPlatformAdmin) {
        return false;
      }
      // 3. Wiki editor constraint
      if (item.wikiAdminOnly && !canEditWiki) {
        return false;
      }
      // 4. Reconcile constraint
      if (item.reconcileOnly && !canReconcile) {
        return false;
      }
      // 5. Facility staff restriction on developer API
      if (item.path === "/api-reference" && isFacilityStaff) {
        return false;
      }
      // 6. Custom RBAC permission check
      if (item.permissionCheck && !item.permissionCheck(user)) {
        return false;
      }
      return true;
    });
  };

  const visibleOverview = filterNavItems(overviewNavItems);
  const visiblePlanning = filterNavItems(planningNavItems);
  const visibleSia = filterNavItems(siaNavItems);
  const visibleClinical = filterNavItems(clinicalNavItems);
  const visibleLogistics = filterNavItems(logisticsNavItems);
  const visibleField = filterNavItems(fieldNavItems);
  const visibleSurveillance = filterNavItems(surveillanceNavItems);
  const visibleAnalytics = filterNavItems(analyticsNavItems);
  const visibleWorkflow = canAccessApprovals ? filterNavItems(workflowNavItems) : [];
  const visibleAdmin = canAccessAdmin ? filterNavItems(adminNavItems) : [];

  // Real pending-approvals count
  const { data: approvalRequests } = useQuery<ApprovalRequest[]>({
    queryKey: ["/api/approvals"],
    enabled: canAccessApprovals,
    retry: false,
  });
  const pendingApprovalsCount = approvalRequests
    ? approvalRequests.filter((r) => r.status === "pending").length
    : undefined;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={isCollapsed ? "p-2 flex flex-col items-center justify-center gap-2" : "p-3 border-b border-sidebar-border/40"}>
        {isCollapsed ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-sky-600 to-sky-700 text-white shadow-md shadow-primary/30 ring-1 ring-white/20 shrink-0" title={`VaxPlan v${APP_VERSION}`}>
            <HeartPulse className="h-4 w-4" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-sky-600 to-sky-700 text-white shadow-md shadow-primary/30 ring-1 ring-white/20 shrink-0">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm truncate leading-tight tracking-tight" data-testid="text-brand-name" title={`VaxPlan v${APP_VERSION}`}>VaxPlan</span>
                </div>
                <span className="text-[11px] text-muted-foreground truncate leading-tight" data-testid="text-tenant-name">
                  {tenant?.name ?? "Health Microplanning"}
                </span>
              </div>
            </div>
            <SidebarTrigger className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* 1. Overview & GIS */}
        {visibleOverview.length > 0 && (
          <CollapsibleSection label="Overview & GIS" storageKey="overview" colorClass="text-sky-600 dark:text-sky-400" bgClass="bg-sky-500/10 hover:bg-sky-500/15 dark:bg-sky-400/10 dark:hover:bg-sky-400/15">
            <SidebarMenu>
              {visibleOverview.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location === item.path} tooltip={item.title}>
                    <Link href={item.path} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleSection>
        )}

        {/* 2. Routine Microplanning & Sessions */}
        {visiblePlanning.length > 0 && (
          <CollapsibleSection label="Routine Microplanning & Sessions" storageKey="planning" colorClass="text-emerald-600 dark:text-emerald-400" bgClass="bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/15">
            <SidebarMenu>
              {visiblePlanning.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location === item.path} tooltip={item.title}>
                    <Link href={item.path} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleSection>
        )}

        {/* 3. SIA Campaigns (Supplementary Immunization) */}
        {visibleSia.length > 0 && (
          <CollapsibleSection
            label="SIA Campaigns"
            storageKey="sia"
            colorClass="text-purple-600 dark:text-purple-400"
            bgClass="bg-purple-500/10 hover:bg-purple-500/15 dark:bg-purple-400/10 dark:hover:bg-purple-400/15"
          >
            <SidebarMenu>
              {visibleSia.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location === item.path} tooltip={item.title}>
                    <Link href={item.path} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleSection>
        )}

        {/* 3. Coverage, Defaulters & EPI */}
        {visibleClinical.length > 0 && (
          <CollapsibleSection label="Coverage & EPI" storageKey="clinical" colorClass="text-amber-600 dark:text-amber-400" bgClass="bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-400/10 dark:hover:bg-amber-400/15">
            <SidebarMenu>
              {visibleClinical.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location === item.path} tooltip={item.title}>
                    <Link href={item.path} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleSection>
        )}

        {/* 4. Logistics & Cold Chain */}
        {visibleLogistics.length > 0 && (
          <CollapsibleSection label="Logistics & Cold Chain" storageKey="logistics" colorClass="text-indigo-600 dark:text-indigo-400" bgClass="bg-indigo-500/10 hover:bg-indigo-500/15 dark:bg-indigo-400/10 dark:hover:bg-indigo-400/15">
            <SidebarMenu>
              {visibleLogistics.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location === item.path} tooltip={item.title}>
                    <Link href={item.path} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleSection>
        )}

        {/* 5. Field & Offline Operations */}
        {visibleField.length > 0 && (
          <CollapsibleSection label="Field & Offline Tools" storageKey="field" colorClass="text-teal-600 dark:text-teal-400" bgClass="bg-teal-500/10 hover:bg-teal-500/15 dark:bg-teal-400/10 dark:hover:bg-teal-400/15">
            <SidebarMenu>
              {visibleField.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location === item.path} tooltip={item.title}>
                    <Link href={item.path} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleSection>
        )}

        {/* 6. Surveillance & Supervision */}
        {visibleSurveillance.length > 0 && (
          <CollapsibleSection label="Surveillance & Supervision" storageKey="surveillance" colorClass="text-rose-600 dark:text-rose-400" bgClass="bg-rose-500/10 hover:bg-rose-500/15 dark:bg-rose-400/10 dark:hover:bg-rose-400/15">
            <SidebarMenu>
              {visibleSurveillance.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location === item.path} tooltip={item.title}>
                    <Link href={item.path} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleSection>
        )}

        {/* 7. Analytics & Reports */}
        {visibleAnalytics.length > 0 && (
          <CollapsibleSection label="Analytics & Reports" storageKey="analytics" colorClass="text-violet-600 dark:text-violet-400" bgClass="bg-violet-500/10 hover:bg-violet-500/15 dark:bg-violet-400/10 dark:hover:bg-violet-400/15">
            <SidebarMenu>
              {visibleAnalytics.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location === item.path} tooltip={item.title}>
                    <Link href={item.path} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleSection>
        )}

        {/* 8. Approvals Workflow */}
        {visibleWorkflow.length > 0 && (
          <CollapsibleSection
            label="Workflow"
            storageKey="workflow"
            badge={pendingApprovalsCount}
            colorClass="text-amber-600 dark:text-amber-400"
            bgClass="bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-400/10 dark:hover:bg-amber-400/15"
          >
            <SidebarMenu>
              {visibleWorkflow.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location === item.path} tooltip={item.title}>
                    <Link href={item.path} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {pendingApprovalsCount !== undefined && pendingApprovalsCount > 0 && (
                        <Badge variant="secondary" className="ml-auto text-xs font-bold">
                          {pendingApprovalsCount > 99 ? "99+" : pendingApprovalsCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleSection>
        )}

        {/* 9. System Administration */}
        {visibleAdmin.length > 0 && (
          <CollapsibleSection label="Administration" storageKey="admin" colorClass="text-slate-600 dark:text-slate-400" bgClass="bg-slate-500/10 hover:bg-slate-500/15 dark:bg-slate-400/10 dark:hover:bg-slate-400/15">
            <SidebarMenu>
              {visibleAdmin.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location === item.path} tooltip={item.title}>
                    <Link href={item.path} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleSection>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/40 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
        <div className="group-data-[collapsible=icon]:hidden space-y-2">
          {/* User Sidebar Customization Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCustomizationOpen(true)}
            className="w-full text-xs gap-1.5 justify-center rounded-xl border-dashed hover:bg-accent/40 text-muted-foreground hover:text-foreground"
            data-testid="button-customize-sidebar"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Customize Sidebar
          </Button>

          <div className="text-[10px] text-muted-foreground/35 text-center font-mono select-none">
            {versionLabel()}
          </div>
          <div className="flex items-center justify-center">
            <Link
              href="/help"
              className="text-[11px] text-primary/70 hover:text-primary hover:underline flex items-center gap-1 transition-colors"
              data-testid="sidebar-help-link"
            >
              <HelpCircle className="h-3 w-3" />
              Help &amp; User Guide
            </Link>
          </div>
        </div>
      </SidebarFooter>

      {/* User Personal Sidebar Customization Modal */}
      <SidebarCustomizationModal
        open={customizationOpen}
        onClose={() => setCustomizationOpen(false)}
        tenantModules={tenantModules}
        userPrefs={userPrefs}
        isAdmin={isPlatformAdmin || isNationalAdmin}
      />
    </Sidebar>
  );
}

/**
 * Interactive dialog allowing users to toggle personal visibility of optional modules.
 * Note: Admin/Tenant disabled modules cannot be enabled by users.
 */
function SidebarCustomizationModal({
  open,
  onClose,
  tenantModules,
  userPrefs,
  isAdmin = false,
}: {
  open: boolean;
  onClose: () => void;
  tenantModules: Record<string, boolean>;
  userPrefs: Record<string, boolean>;
  isAdmin?: boolean;
}) {
  const toggleableModules = isAdmin
    ? MODULE_METADATA
    : MODULE_METADATA.filter((m) => m.userToggleable);

  const handleToggle = (key: string, currentVal: boolean) => {
    setUserModulePreference(key, !currentVal);
  };

  const handleReset = () => {
    resetUserModulePreferences();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold">Personal Sidebar Navigation</DialogTitle>
                  {isAdmin && (
                    <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] px-2 py-0.5">
                      Admin Mode: All Modules Configurable
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  {isAdmin
                    ? "As an administrator, you have full control to toggle all modules on or off for your workspace view."
                    : "Show or hide optional modules to streamline your daily workflow. Modules disabled by your administrator are locked."}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 text-xs rounded-xl"
              title="Reset personal toggles to organization default"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Defaults
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {MODULE_CATEGORIES.map((category) => {
            const modulesInCategory = toggleableModules.filter((m) => m.category === category.id);
            if (modulesInCategory.length === 0) return null;

            return (
              <div key={category.id} className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                  <span className={`text-xs font-bold uppercase tracking-wider ${category.color}`}>
                    {category.name}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {modulesInCategory.map((mod) => {
                    const Icon = mod.icon;
                    const isTenantDisabled = tenantModules[mod.key] === false;
                    const isVisible = isTenantDisabled ? false : userPrefs[mod.key] !== false;

                    return (
                      <div
                        key={mod.key}
                        className={`flex items-start justify-between p-3 rounded-xl border transition-all ${
                          isTenantDisabled
                            ? "opacity-50 bg-muted/40 border-dashed border-border cursor-not-allowed"
                            : "bg-card/50 hover:bg-accent/20 border-border/70 shadow-sm"
                        }`}
                      >
                        <div className="flex gap-2.5 min-w-0 pr-2">
                          <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border ${
                            isVisible && !isTenantDisabled
                              ? `${category.bg} ${category.color} border-primary/20`
                              : "bg-muted text-muted-foreground border-border"
                          }`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                              <span>{mod.title}</span>
                              {isTenantDisabled && (
                                <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-muted text-muted-foreground">
                                  Disabled by Admin
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                              {mod.description}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 self-center">
                          <Switch
                            checked={isVisible}
                            disabled={isTenantDisabled}
                            onCheckedChange={() => handleToggle(mod.key, isVisible)}
                            className="data-[state=checked]:bg-primary"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="p-4 border-t border-border bg-muted/20">
          <Button onClick={onClose} className="rounded-xl px-6 font-semibold">
            <Check className="h-4 w-4 mr-1.5" /> Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
