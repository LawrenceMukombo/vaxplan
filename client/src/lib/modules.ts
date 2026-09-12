import {
  Map,
  Globe,
  Building,
  Hospital,
  Users,
  MapPin,
  Radio,
  Calendar,
  CalendarDays,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  Target,
  FileText,
  DollarSign,
  Calculator,
  Package,
  Share2,
  Sparkles,
  ClipboardCheck,
  Snowflake,
  Home,
  ShieldCheck,
  Activity,
  BookOpen,
  BarChart3,
  Terminal,
  Database,
  Wrench,
  Settings,
  HelpCircle,
  CheckCircle,
  Smartphone,
  Monitor,
  UserPlus,
  Layers,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";

export const DEFAULT_MODULES = {
  // 1. Core GIS & Master Data
  map: true,
  outreachMap: true,
  settlementIntel: true,
  facilities: true,
  population: true,
  boundaries: true,

  // 2. Routine Microplanning & Sessions
  routine: true,
  sessions: true,
  planHealth: true,
  planningActions: true,
  planningEvidence: true,
  nationalPlan: true,

  // 3. SIA Campaigns (Supplementary Immunization)
  campaigns: true,
  campaignReadiness: true,
  campaignSupervision: true,
  houseToHouse: true,
  pce: true,
  campaignSummaries: true,
  campaignDashboard: true,

  // 4. Coverage, Defaulters & EPI
  clientLogbook: true,
  defaulters: true,
  dropout: true,
  zeroDose: true,
  missedCommunities: true,
  recommendations: true,

  // 5. Logistics & Cold Chain
  stock: true,
  coldChain: true,
  htr: true,
  calculator: true,
  budget: true,
  mobilization: true,

  // 6. Field & Offline Tools
  chwField: true,
  desktopHub: true,
  fieldTeams: true,
  syncConflicts: true,

  // 7. Surveillance & Supervision
  riskAssessment: true,
  surveillance: true,
  supervision: true,
  supervisionTools: true,
  research: true,

  // 8. Analytics & Reports
  reports: true,
  indicators: true,
  standards: true,
  history: true,

  // 9. Administration & Governance
  approvals: true,
  userManagement: true,
  staffManagement: true,
  signups: true,
  interop: true,
  customLayers: true,
  catalogue: true,
  wiki: true,
  dataSources: true,
  apiReference: true,
};

export type ModuleKey = keyof typeof DEFAULT_MODULES;

export interface ModuleMetadata {
  key: ModuleKey;
  title: string;
  description: string;
  category: "core" | "planning" | "sia" | "clinical" | "logistics" | "field" | "surveillance" | "analytics" | "admin";
  icon: any;
  userToggleable: boolean; // If true, regular users can also toggle visibility in their personal sidebar view
}

export const MODULE_CATEGORIES = [
  { id: "core", name: "Core GIS & Master Data", color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10 hover:bg-sky-500/15 dark:bg-sky-400/10 dark:hover:bg-sky-400/15" },
  { id: "planning", name: "Routine Microplanning & Sessions", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/15" },
  { id: "sia", name: "SIA Campaigns", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10 hover:bg-purple-500/15 dark:bg-purple-400/10 dark:hover:bg-purple-400/15" },
  { id: "clinical", name: "Coverage & Defaulters (EPI)", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-400/10 dark:hover:bg-amber-400/15" },
  { id: "logistics", name: "Logistics & Cold Chain", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10 hover:bg-indigo-500/15 dark:bg-indigo-400/10 dark:hover:bg-indigo-400/15" },
  { id: "field", name: "Field & Offline Tools", color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10 hover:bg-teal-500/15 dark:bg-teal-400/10 dark:hover:bg-teal-400/15" },
  { id: "surveillance", name: "Surveillance & Supervision", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10 hover:bg-rose-500/15 dark:bg-rose-400/10 dark:hover:bg-rose-400/15" },
  { id: "analytics", name: "Analytics & Reports", color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10 hover:bg-violet-500/15 dark:bg-violet-400/10 dark:hover:bg-violet-400/15" },
  { id: "admin", name: "System Administration", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-500/10 hover:bg-slate-500/15 dark:bg-slate-400/10 dark:hover:bg-slate-400/15" },
] as const;

export const MODULE_METADATA: ModuleMetadata[] = [
  // 1. Core GIS & Master Data
  {
    key: "map",
    title: "Map View",
    description: "Visual GIS mapping layers, catchment polygons, and village pins.",
    category: "core",
    icon: Map,
    userToggleable: false, // Essential base
  },
  {
    key: "outreachMap",
    title: "Outreach Map",
    description: "Catchment accessibility, outreach post radius, and travel buffers.",
    category: "core",
    icon: MapPin,
    userToggleable: true,
  },
  {
    key: "settlementIntel",
    title: "Settlements Intelligence",
    description: "GeoNames settlements exploration, search, and satellite basemap overlays.",
    category: "core",
    icon: Building,
    userToggleable: true,
  },
  {
    key: "facilities",
    title: "Facilities Registry",
    description: "Health centers, health posts, and assigned community catchments.",
    category: "core",
    icon: Hospital,
    userToggleable: false, // Essential base
  },
  {
    key: "population",
    title: "Population Denominators",
    description: "Demographic denominators, birth cohort ratios, and WorldPop rasters.",
    category: "core",
    icon: Users,
    userToggleable: false, // Essential base
  },
  {
    key: "boundaries",
    title: "Boundary Manager",
    description: "Administrative boundary GeoJSON and spatial shapefile management.",
    category: "core",
    icon: Map,
    userToggleable: true,
  },

  // 2. Routine Microplanning & Sessions
  {
    key: "routine",
    title: "Routine Microplanning",
    description: "End-to-end WHO RED microplanning wizard and annual operational plan builder.",
    category: "planning",
    icon: Calendar,
    userToggleable: false, // Essential base
  },
  {
    key: "sessions",
    title: "Sessions Hub",
    description: "Immunization session calendar, outreach execution schedule, and day-plans.",
    category: "planning",
    icon: CalendarDays,
    userToggleable: false, // Essential base
  },
  {
    key: "planHealth",
    title: "Plan Health",
    description: "Quality scorecard and readiness audit assessing microplan compliance.",
    category: "planning",
    icon: ClipboardCheck,
    userToggleable: true,
  },
  {
    key: "planningActions",
    title: "Planning Actions",
    description: "Prioritized recommendations and corrective actions across microplans.",
    category: "planning",
    icon: ClipboardList,
    userToggleable: true,
  },
  {
    key: "planningEvidence",
    title: "Planning Evidence",
    description: "Audit trail, stakeholder sign-offs, and microplan validation evidence.",
    category: "planning",
    icon: FileText,
    userToggleable: true,
  },
  {
    key: "nationalPlan",
    title: "National Immunization Plan",
    description: "National high-level strategy overview, targets, and executive policy alignment.",
    category: "planning",
    icon: FileText,
    userToggleable: true,
  },

  // 3. SIA Campaigns (Supplementary Immunization)
  {
    key: "campaigns",
    title: "SIA Microplans",
    description: "Supplementary immunization activities, polio, measles, and mass campaign microplanning.",
    category: "sia",
    icon: Sparkles,
    userToggleable: true,
  },
  {
    key: "campaignReadiness",
    title: "Readiness Assessment",
    description: "Pre-campaign operational readiness checklist, milestone tracking, and logistics checks.",
    category: "sia",
    icon: Radio,
    userToggleable: true,
  },
  {
    key: "campaignSupervision",
    title: "Campaign Supervision Checklist",
    description: "WHO-standard supervisory checklist and real-time field monitoring for SIA campaigns.",
    category: "sia",
    icon: ClipboardCheck,
    userToggleable: true,
  },
  {
    key: "houseToHouse",
    title: "House-to-House Tracking",
    description: "Household chalk tallying, rapid door-to-door monitoring, and finger-marking verification.",
    category: "sia",
    icon: Home,
    userToggleable: true,
  },
  {
    key: "pce",
    title: "Post-Campaign Evaluation (PCE)",
    description: "WHO/UNICEF standard post-campaign evaluation checklist, independent monitoring, and rapid convenience surveys.",
    category: "sia",
    icon: ClipboardCheck,
    userToggleable: true,
  },
  {
    key: "campaignSummaries",
    title: "Campaign Summary Sheets",
    description: "Consolidated district and facility summary sheets with targets, doses, vials, budget, and wastage.",
    category: "sia",
    icon: FileSpreadsheet,
    userToggleable: true,
  },
  {
    key: "campaignDashboard",
    title: "Real-Time Campaign Dashboard",
    description: "Live campaign coverage rollup, real-time administrative progress, and session completion indicators.",
    category: "sia",
    icon: Activity,
    userToggleable: true,
  },

  // 4. Coverage, Defaulters & EPI
  {
    key: "clientLogbook",
    title: "Client Logbook",
    description: "Digital immunization registry of infants, children, and maternal dose history.",
    category: "clinical",
    icon: ClipboardList,
    userToggleable: false, // Essential base
  },
  {
    key: "defaulters",
    title: "Defaulter Tracking",
    description: "Identify and generate recall tracing lists for dropouts and overdue children.",
    category: "clinical",
    icon: AlertTriangle,
    userToggleable: true,
  },
  {
    key: "dropout",
    title: "Dropout Rates",
    description: "Track DTP1-DTP3 and BCG-MCV1 immunization drop-out curves.",
    category: "clinical",
    icon: TrendingUp,
    userToggleable: true,
  },
  {
    key: "zeroDose",
    title: "Zero-Dose Villages",
    description: "Geographic identification and targeting of unreached zero-dose children.",
    category: "clinical",
    icon: Target,
    userToggleable: true,
  },
  {
    key: "missedCommunities",
    title: "Missed Communities",
    description: "Detect villages and settlements without scheduled outreach visits.",
    category: "clinical",
    icon: AlertTriangle,
    userToggleable: true,
  },
  {
    key: "recommendations",
    title: "RED Recommendations & Alerts",
    description: "WHO Reach Every District guidance, automated alerts, and operational insights.",
    category: "clinical",
    icon: ClipboardCheck,
    userToggleable: true,
  },

  // 5. Logistics & Cold Chain
  {
    key: "stock",
    title: "Stock Ledger",
    description: "Vaccine ledger, transaction tracking, vial batch numbers, and wastage monitoring.",
    category: "logistics",
    icon: Package,
    userToggleable: false, // Essential base
  },
  {
    key: "coldChain",
    title: "Cold Chain Inventory",
    description: "Catalog refrigerators, WHO PQS equipment status, and storage volume limits.",
    category: "logistics",
    icon: Snowflake,
    userToggleable: true,
  },
  {
    key: "htr",
    title: "Hard-to-Reach Scores",
    description: "Multi-criteria accessibility scoring factoring in terrain, rivers, and seasonal roads.",
    category: "logistics",
    icon: AlertTriangle,
    userToggleable: true,
  },
  {
    key: "calculator",
    title: "Vaccine Calculator",
    description: "Antigen requirements, vial wastage estimates, and syringe volume calculations.",
    category: "logistics",
    icon: Calculator,
    userToggleable: true,
  },
  {
    key: "budget",
    title: "Operational Budget",
    description: "Outreach per-diems, boat fuel, vehicle hire, and operational expense projections.",
    category: "logistics",
    icon: DollarSign,
    userToggleable: true,
  },
  {
    key: "mobilization",
    title: "Social Mobilization",
    description: "Community engagement strategy, megaphone mobilizers, and SMS announcements.",
    category: "logistics",
    icon: Share2,
    userToggleable: true,
  },

  // 6. Field & Offline Tools
  {
    key: "chwField",
    title: "CHW Mobile Field Workspace",
    description: "Touch-optimized Android/mobile workspace for offline zero-dose registration and mapping.",
    category: "field",
    icon: Smartphone,
    userToggleable: true,
  },
  {
    key: "desktopHub",
    title: "Desktop Offline Hub",
    description: "Native Windows desktop management hub with air-gapped USB sync and cache manager.",
    category: "field",
    icon: Monitor,
    userToggleable: true,
  },
  {
    key: "fieldTeams",
    title: "Mobile Field Teams",
    description: "Personnel coordination, satellite/radio communications, and vehicle assignments.",
    category: "field",
    icon: Radio,
    userToggleable: true,
  },
  {
    key: "syncConflicts",
    title: "Sync Conflicts",
    description: "Offline-first data conflict review, resolution queue, and manual reconciliations.",
    category: "field",
    icon: RefreshCw,
    userToggleable: true,
  },

  // 7. Surveillance & Supervision
  {
    key: "riskAssessment",
    title: "VPD Risk Assessment",
    description: "Epidemiological risk scoring for Measles, Polio, Cholera, and Yellow Fever outbreaks.",
    category: "surveillance",
    icon: Activity,
    userToggleable: true,
  },
  {
    key: "surveillance",
    title: "Disease Surveillance",
    description: "Acute flaccid paralysis (AFP) and rash fever case investigation logbook.",
    category: "surveillance",
    icon: ShieldCheck,
    userToggleable: true,
  },
  {
    key: "supervision",
    title: "Supportive Supervision",
    description: "Supportive supervision field visits, supervisory checklists, and corrective action plans.",
    category: "surveillance",
    icon: ClipboardCheck,
    userToggleable: true,
  },
  {
    key: "supervisionTools",
    title: "Supervision Checklist Tools",
    description: "Digital supervisory checklists, scoring rubrics, and feedback logbook.",
    category: "surveillance",
    icon: ClipboardList,
    userToggleable: true,
  },
  {
    key: "research",
    title: "Research & Evidence Hub",
    description: "Implementation science documentation, pilot activity logs, and technical briefs.",
    category: "surveillance",
    icon: BookOpen,
    userToggleable: true,
  },

  // 8. Analytics & Reports
  {
    key: "reports",
    title: "Analytics & Multi-Tab Reports",
    description: "Comprehensive coverage, dropout, missed communities, and session reports with Excel/CSV export.",
    category: "analytics",
    icon: BarChart3,
    userToggleable: false, // Essential base
  },
  {
    key: "indicators",
    title: "EPI Indicator Manual",
    description: "Reference guide for national immunization indicators, formulas, and targets.",
    category: "analytics",
    icon: BookOpen,
    userToggleable: true,
  },
  {
    key: "standards",
    title: "Standards Alignment",
    description: "WHO, UNICEF, and Gavi technical guidelines compliance verification audit.",
    category: "analytics",
    icon: ShieldCheck,
    userToggleable: true,
  },
  {
    key: "history",
    title: "Temporal History",
    description: "Historical snapshots and temporal record auditing across time periods.",
    category: "analytics",
    icon: Database,
    userToggleable: true,
  },

  // 9. Administration & Governance
  {
    key: "approvals",
    title: "Approvals Workflow",
    description: "Multi-tier microplan review, rejection feedback, and formal approval audit trail.",
    category: "admin",
    icon: CheckCircle,
    userToggleable: false, // Admin controlled
  },
  {
    key: "userManagement",
    title: "User Management",
    description: "RBAC user account administration, facility scope assignments, and password resets.",
    category: "admin",
    icon: Users,
    userToggleable: false,
  },
  {
    key: "staffManagement",
    title: "Facility Staff",
    description: "Health worker personnel records, professional qualifications, and facility roster.",
    category: "admin",
    icon: Users,
    userToggleable: false,
  },
  {
    key: "signups",
    title: "Access Requests",
    description: "Review and approve pending staff account registrations.",
    category: "admin",
    icon: UserPlus,
    userToggleable: false,
  },
  {
    key: "interop",
    title: "HIS & DHIS2 Interoperability",
    description: "Bi-directional data exchange with DHIS2, coverage import, and population denominators.",
    category: "admin",
    icon: Share2,
    userToggleable: false,
  },
  {
    key: "customLayers",
    title: "Custom GIS Layers",
    description: "High-resolution drone rasters, Cloud-Optimized GeoTIFFs, and custom WMS layers.",
    category: "admin",
    icon: Layers,
    userToggleable: false,
  },
  {
    key: "catalogue",
    title: "Vaccine & Supply Catalogue",
    description: "Standard national antigen dose definitions, cold chain specifications, and supplies.",
    category: "admin",
    icon: Package,
    userToggleable: false,
  },
  {
    key: "wiki",
    title: "Knowledge Base & Wiki",
    description: "In-app operational field manual and technical wiki documentation.",
    category: "admin",
    icon: BookOpen,
    userToggleable: false,
  },
  {
    key: "dataSources",
    title: "Data Sources & Credits",
    description: "Attribution and licensing for OpenStreetMap, WorldPop, and boundary providers.",
    category: "admin",
    icon: Database,
    userToggleable: true,
  },
  {
    key: "apiReference",
    title: "Developer API Reference",
    description: "Interactive OpenAPI documentation and system endpoints specification.",
    category: "admin",
    icon: Terminal,
    userToggleable: true,
  },
];

const USER_MODULE_STORAGE_KEY = "vaxplan.user.modules";

/**
 * Retrieve user-specific module visibility preferences from localStorage.
 */
export function getUserModulePreferences(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(USER_MODULE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Persist a user's personal preference for a specific module's sidebar visibility.
 */
export function setUserModulePreference(key: string, enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const current = getUserModulePreferences();
    current[key] = enabled;
    window.localStorage.setItem(USER_MODULE_STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event("vaxplan-modules-updated"));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Reset all user-specific module preferences to organization defaults.
 */
export function resetUserModulePreferences(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_MODULE_STORAGE_KEY);
    window.dispatchEvent(new Event("vaxplan-modules-updated"));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Determine whether a module should be displayed to a user.
 * Admin (tenant-level) setting ALWAYS takes precedence over user preference.
 */
export function isModuleVisible(
  key: string,
  tenantModules?: Record<string, boolean>,
  userModules?: Record<string, boolean>
): boolean {
  // 1. If admin/tenant explicitly disabled the module, it is hidden for EVERYONE
  if (tenantModules && tenantModules[key] === false) {
    return false;
  }
  // 2. If the user personally hid this module (for userToggleable modules)
  if (userModules && userModules[key] === false) {
    return false;
  }
  // 3. Fallback to default
  const defaultVal = (DEFAULT_MODULES as Record<string, boolean>)[key];
  return defaultVal !== false;
}
