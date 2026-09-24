import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Map,
  Users,
  Calendar,
  Shield,
  Cloud,
  BarChart3,
  Globe,
  Stethoscope,
  Syringe,
  HeartPulse,
  Activity,
  Pill,
  Building2,
  ArrowRight,
  Eye,
  EyeOff,
  Smartphone,
  Monitor,
  RefreshCw,
  Cpu,
  Navigation,
  MessageSquare,
  CheckCircle2,
  Sparkles,
  Compass,
  ShieldCheck,
  Check,
  Truck,
  WifiOff,
  ArrowUpRight,
  FileText,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageHead } from "@/components/PageHead";
import { versionLabel, APP_VERSION } from "@/lib/version";
import { getDomainLinks } from "@/lib/navigation";
import { saveTenantsCache, loadTenantsCache, saveActiveTenant, loadActiveTenant, DEFAULT_CANONICAL_TENANTS } from "@/lib/tenantCache";
import { clearLogoutState, recordOnlineAuthSession } from "@/lib/authSession";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { isNationalAdmin, canAccessAdministration } from "@/lib/accessControl";

interface PersonaStory {
  tag: string;
  quote: string;
  role: string;
  location: string;
  initials: string;
}

const DEFAULT_PERSONA_STORIES: Record<"chw" | "facility" | "manager", PersonaStory> = {
  chw: {
    tag: "Voice from the Field",
    quote:
      "During rainy seasons, our paper tally sheets often got soaked and unreadable while crossing the river. With VaxPlan cached on our phones, our outreach team has the whole settlement list, carrier packing counts, and village maps safe and offline.",
    role: "Sr. Community Health Nurse",
    location: "Western Highlands Province",
    initials: "RN",
  },
  facility: {
    tag: "District Management Impact",
    quote:
      "Consolidating 38 health center microplans used to take four weeks of manual Excel reconciling. With VaxPlan, we reviewed, adjusted, and approved the entire district operational plan in under 48 hours.",
    role: "District Medical Officer of Health",
    location: "Ministry of Health District Operations",
    initials: "DM",
  },
  manager: {
    tag: "Global Strategic Value",
    quote:
      "For the first time, our technical partner review had zero unmapped settlements and 100% verified population denominators. Funding approvals happened without delay because the data was backed by spatial evidence.",
    role: "National EPI Program Manager",
    location: "Department of Public Health & Disease Control",
    initials: "NE",
  },
};

const LANDING_STORIES_STORAGE_KEY = "vaxplan_landing_stories_v1";

interface PublicTenant {
  id: string;
  code: string;
  name: string;
  countryCode: string;
}

const DEFAULT_TENANTS: PublicTenant[] = DEFAULT_CANONICAL_TENANTS as PublicTenant[];


const features = [
  {
    icon: Map,
    title: "Interactive GIS Mapping",
    description:
      "Visualize health facilities, villages, and catchment areas with offline-capable maps and satellite imagery — wherever your clinics are.",
  },
  {
    icon: Syringe,
    title: "Immunization Session Planning",
    description:
      "Plan outreach and fixed-post vaccination sessions with intelligent village assignment by distance, population, terrain, and cold chain.",
  },
  {
    icon: Users,
    title: "Multi-Source Population Data",
    description:
      "Fuse census, HMIS, DHIS2, WorldPop and local enumeration sources with confidence scoring — country-by-country.",
  },
  {
    icon: Pill,
    title: "Vaccine & Supply Forecasting",
    description:
      "Auto-calculate vaccine, diluent, syringe, and safety-box requirements per session, per facility, per district.",
  },
  {
    icon: Shield,
    title: "Hierarchical Approvals",
    description:
      "Facility → District → Province → National workflows that mirror how Ministries of Health actually approve microplans.",
  },
  {
    icon: Cloud,
    title: "Offline-First Design",
    description:
      "Built for last-mile health workers. Capture in the bush, sync when bandwidth returns. No data lost.",
  },
  {
    icon: BarChart3,
    title: "Budget Planning",
    description:
      "Per-country currency, allowances, fuel and per-diem rates — generate defensible budgets that survive donor review.",
  },
  {
    icon: HeartPulse,
    title: "Hard-to-Reach Scoring",
    description:
      "Quantify equity: which villages get reached last, how far the nearest cold chain is, where children are missed.",
  },
];

const trustPoints = [
  "BYO single sign-on (OIDC, SAML)",
  "Per-country data isolation",
  "DHIS2 / SmartCare / eLMIS / iHRIS friendly",
  "Audit log on every change",
];

function PasswordLoginDialog({
  open,
  onOpenChange,
  tenants: propTenants,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenants?: PublicTenant[];
}) {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const active = loadActiveTenant();
      return active?.id ? String(active.id) : localStorage.getItem("vaxplan_last_tenant_id") || DEFAULT_TENANTS[0].id;
    }
    return DEFAULT_TENANTS[0].id;
  });
  const [keepMeSignedIn, setKeepMeSignedIn] = useState(false);

  const { data: fetchedTenants } = useQuery<PublicTenant[]>({
    queryKey: ["/api/public/tenants"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/public/tenants", { credentials: "include" });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            saveTenantsCache(list);
            return list;
          }
        }
      } catch (e) {
        console.warn("Could not fetch public tenants:", e);
      }
      const cached = loadTenantsCache();
      return cached && cached.length > 0 ? (cached as PublicTenant[]) : DEFAULT_TENANTS;
    },
    initialData: () => {
      const cached = loadTenantsCache();
      return cached && cached.length > 0 ? (cached as PublicTenant[]) : DEFAULT_TENANTS;
    },
  });

  const candidateTenants =
    propTenants && propTenants.length > 0
      ? propTenants
      : fetchedTenants && fetchedTenants.length > 0
        ? fetchedTenants
        : DEFAULT_TENANTS;

  const validTenants = candidateTenants.filter(
    (t) => t && typeof t.id === "string" && typeof t.name === "string"
  );
  const activeTenants = validTenants.length > 0 ? validTenants : DEFAULT_TENANTS;

  function resetState() {
    setError(null);
    setNotice(null);
    setBusy(false);
    const active = loadActiveTenant();
    setSelectedTenantId(active?.id ? String(active.id) : localStorage.getItem("vaxplan_last_tenant_id") || DEFAULT_TENANTS[0].id);
    setKeepMeSignedIn(false);
  }

  useEffect(() => {
    if (open) {
      clearLogoutState();
      const active = loadActiveTenant();
      const lastTenantId = active?.id ? String(active.id) : localStorage.getItem("vaxplan_last_tenant_id") || DEFAULT_TENANTS[0].id;
      if (lastTenantId && (!selectedTenantId || selectedTenantId === "")) {
        setSelectedTenantId(lastTenantId);
      }
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          email: email.trim(), 
          password, 
          tenantId: selectedTenantId, 
          keepMeSignedIn,
          userIdleTimeout: localStorage.getItem("vaxplan_user_idle_timeout") || "default"
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Login failed.");
        return;
      }
      clearLogoutState();
      if (data?.user) {
        recordOnlineAuthSession(data.user);
        if (selectedTenantId) {
          const matchedTenant = activeTenants.find((t) => t.id === selectedTenantId);
          if (matchedTenant) {
            saveActiveTenant(matchedTenant);
          }
        }
        queryClient.setQueryData(["/api/auth/user"], data.user);
        void queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
      const urlParams = new URLSearchParams(window.location.search);
      const redirectParam = urlParams.get("redirect");
      const sessionRedirect = typeof window !== "undefined" ? sessionStorage.getItem("vaxplan_login_redirect") : null;
      const target = redirectParam || sessionRedirect || "/";
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem("vaxplan_login_redirect");
        } catch {}
      }
      const safeTarget = target.startsWith("/") && !target.startsWith("//") ? target : "/";
      window.location.replace(safeTarget);
    } catch (err) {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      setNotice(
        data?.message ||
          "If an account exists for that email, your administrator has been notified to help you reset your password.",
      );
    } catch (err) {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setMode("login");
          resetState();
        }
      }}
    >
      <DialogContent className="p-0 overflow-hidden sm:max-w-3xl gap-0">
        <DialogTitle className="sr-only">Sign in to VaxPlan</DialogTitle>
        <DialogDescription className="sr-only">
          Sign in with the email and password your VaxPlan administrator gave you.
        </DialogDescription>
        <div className="grid md:grid-cols-2">
          {/* Brand panel */}
          <div className="relative hidden md:flex flex-col justify-between p-8 bg-gradient-to-br from-primary via-sky-700 to-sky-800 text-white overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-10">
              <Syringe className="absolute top-6 left-6 h-24 w-24 -rotate-12" />
              <HeartPulse className="absolute bottom-10 left-10 h-28 w-28" />
              <Stethoscope className="absolute top-1/2 right-4 h-32 w-32 rotate-12" />
            </div>
            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-semibold">VaxPlan</span>
                <span className="text-xs text-white/80">
                  Health microplanning for Ministries
                </span>
              </div>
            </div>
            <div className="relative space-y-3">
              <h2 className="text-2xl font-bold leading-snug">
                Reach every child.
                <br />
                Plan every session.
              </h2>
              <p className="text-sm text-white/85 max-w-xs">
                Secure, country-isolated microplanning for national immunization
                programs — from the capital down to the last village.
              </p>
            </div>
            <div className="relative flex items-center justify-between text-xs text-white/80 pt-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 shrink-0" />
                <span>Encrypted · Audit-logged · Isolated</span>
              </div>
              <span className="font-mono text-[11px] text-white/90 bg-white/15 px-2 py-0.5 rounded-full border border-white/20">
                v{APP_VERSION}
              </span>
            </div>
          </div>

          {/* Form panel */}
          <div className="p-8 flex flex-col justify-center">
            {mode === "login" ? (
              <>
                <div className="mb-6 space-y-1">
                  <h3 className="text-xl font-semibold tracking-tight">Welcome back</h3>
                  <p className="text-sm text-muted-foreground">
                    Sign in to your VaxPlan account to continue.
                  </p>
                </div>
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-tenant">Country / Program</Label>
                    <select
                      id="pw-tenant"
                      required
                      value={selectedTenantId || activeTenants[0]?.id || ""}
                      onChange={(e) => {
                        setSelectedTenantId(e.target.value);
                        if (typeof window !== "undefined") {
                          localStorage.setItem("vaxplan_last_tenant_id", e.target.value);
                        }
                      }}
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                      data-testid="select-tenant"
                    >
                      {activeTenants.map((t) => (
                        <option key={t.id} value={t.id} className="bg-background text-foreground py-1">
                          {t.name} ({t.code || t.countryCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-email">Email</Label>
                    <Input
                      id="pw-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@ministry.gov"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pw-password">Password</Label>
                      <button
                        type="button"
                        onClick={() => {
                          resetState();
                          setMode("forgot");
                        }}
                        className="text-xs text-primary hover:underline"
                        data-testid="button-forgot-password"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="pw-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <Checkbox
                      id="keep-me-signed-in"
                      checked={keepMeSignedIn}
                      onCheckedChange={(checked: any) => setKeepMeSignedIn(!!checked)}
                      data-testid="checkbox-keep-me-signed-in"
                    />
                    <Label
                      htmlFor="keep-me-signed-in"
                      className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-muted-foreground"
                    >
                      Keep me signed in on this computer
                    </Label>
                  </div>
                  {error && (
                    <div className="text-sm text-destructive" data-testid="text-login-error">
                      {error}
                    </div>
                  )}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={busy}
                    data-testid="button-submit-login"
                  >
                    {busy ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
                <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground space-y-2">
                  <p>
                    Need access?{" "}
                    <a href="/signup" className="text-primary font-medium hover:underline">
                      Request an account
                    </a>
                  </p>
                  <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/75 pt-1">
                    <span className="inline-flex items-center gap-1.5 font-mono bg-muted/60 px-2 py-0.5 rounded border border-border/50 text-foreground/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      App v{APP_VERSION}
                    </span>
                    <span>·</span>
                    <span>Multi-Tenant Health Microplanning</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6 space-y-1">
                  <h3 className="text-xl font-semibold tracking-tight">Reset your password</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter your email and we'll notify your VaxPlan administrator to
                    help you regain access.
                  </p>
                </div>
                <form onSubmit={submitForgot} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@ministry.gov"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-forgot-email"
                    />
                  </div>
                  {notice && (
                    <div
                      className="text-sm rounded-md bg-primary/10 text-foreground px-3 py-2"
                      data-testid="text-forgot-notice"
                    >
                      {notice}
                    </div>
                  )}
                  {error && (
                    <div className="text-sm text-destructive" data-testid="text-forgot-error">
                      {error}
                    </div>
                  )}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={busy}
                    data-testid="button-submit-forgot"
                  >
                    {busy ? "Sending…" : "Send reset request"}
                  </Button>
                </form>
                <button
                  type="button"
                  onClick={() => {
                    resetState();
                    setMode("login");
                  }}
                  className="mt-6 text-center text-sm text-primary hover:underline mx-auto"
                  data-testid="button-back-to-login"
                >
                  ← Back to sign in
                </button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TenantCard({ tenant, onSelect }: { tenant: PublicTenant; onSelect?: (tenantId: string) => void }) {
  return (
    <Card
      className="hover-elevate cursor-pointer border hover:border-primary/50 transition-all group"
      onClick={() => onSelect?.(tenant.id)}
      data-testid={`card-tenant-${tenant.code}`}
    >
      <CardContent className="p-5 flex items-start gap-4">
        <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors flex items-center justify-center font-bold text-sm tracking-wider">
          {tenant.countryCode}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors" data-testid={`text-tenant-name-${tenant.code}`}>
            {tenant.name}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Globe className="h-3 w-3 text-emerald-500" />
            <span>Ministry of Health · Active Program</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Landing() {
  const { data: fetchedTenants } = useQuery<PublicTenant[]>({
    queryKey: ["/api/public/tenants"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/public/tenants", { credentials: "include" });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            saveTenantsCache(list);
            return list;
          }
        }
      } catch (e) {
        console.warn("Could not fetch public tenants:", e);
      }
      const cached = loadTenantsCache();
      return cached && cached.length > 0 ? (cached as PublicTenant[]) : DEFAULT_TENANTS;
    },
    initialData: () => {
      const cached = loadTenantsCache();
      return cached && cached.length > 0 ? (cached as PublicTenant[]) : DEFAULT_TENANTS;
    },
  });

  const rawTenants = (fetchedTenants && fetchedTenants.length > 0) ? fetchedTenants : DEFAULT_TENANTS;
  const tenants = rawTenants.filter(
    (t) => t && typeof t.id === "string" && typeof t.name === "string"
  );
  const activeTenantsList = tenants.length > 0 ? tenants : DEFAULT_TENANTS;
  const [roadmapFilter, setRoadmapFilter] = useState<"all" | "field" | "desktop" | "systems" | "ai" | "community">("all");
  const [activeRoleTab, setActiveRoleTab] = useState<"chw" | "facility" | "manager">("chw");
  const [loginOpen, setLoginOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.location.search.includes("login") || window.location.hash === "#login";
    }
    return false;
  });
  const { researchUrl, docsUrl } = getDomainLinks();

  const [personaStories, setPersonaStories] = useState<Record<"chw" | "facility" | "manager", PersonaStory>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(LANDING_STORIES_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            chw: { ...DEFAULT_PERSONA_STORIES.chw, ...(parsed.chw || {}) },
            facility: { ...DEFAULT_PERSONA_STORIES.facility, ...(parsed.facility || {}) },
            manager: { ...DEFAULT_PERSONA_STORIES.manager, ...(parsed.manager || {}) },
          };
        }
      } catch (e) {
        console.warn("Could not read landing stories from localStorage:", e);
      }
    }
    return DEFAULT_PERSONA_STORIES;
  });

  const [editingStoryRole, setEditingStoryRole] = useState<"chw" | "facility" | "manager" | null>(null);
  const [storyFormData, setStoryFormData] = useState<PersonaStory>({
    tag: "",
    quote: "",
    role: "",
    location: "",
    initials: "",
  });

  const { user } = useAuth();
  const isAdmin = Boolean(
    user && (
      user.isPlatformAdmin ||
      isNationalAdmin(user) ||
      canAccessAdministration(user) ||
      user.role === "national_admin" ||
      (Array.isArray((user as any).roles) &&
        (user as any).roles.some((r: unknown) => typeof r === "string" && r.toLowerCase().includes("admin")))
    )
  );

  const handleOpenEditStory = (role: "chw" | "facility" | "manager") => {
    if (!isAdmin) return;
    setStoryFormData({ ...personaStories[role] });
    setEditingStoryRole(role);
  };

  const handleSaveStory = () => {
    if (!editingStoryRole) return;
    const updated: Record<"chw" | "facility" | "manager", PersonaStory> = {
      ...personaStories,
      [editingStoryRole]: {
        tag: storyFormData.tag.trim() || DEFAULT_PERSONA_STORIES[editingStoryRole].tag,
        quote: storyFormData.quote.trim() || DEFAULT_PERSONA_STORIES[editingStoryRole].quote,
        role: storyFormData.role.trim() || DEFAULT_PERSONA_STORIES[editingStoryRole].role,
        location: storyFormData.location.trim() || DEFAULT_PERSONA_STORIES[editingStoryRole].location,
        initials: (storyFormData.initials.trim() || DEFAULT_PERSONA_STORIES[editingStoryRole].initials).slice(0, 4).toUpperCase(),
      },
    };
    setPersonaStories(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LANDING_STORIES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save stories to localStorage:", e);
      }
    }
    setEditingStoryRole(null);
  };

  const handleResetStory = () => {
    if (!editingStoryRole) return;
    const defaultStory = DEFAULT_PERSONA_STORIES[editingStoryRole];
    setStoryFormData({ ...defaultStory });
    const updated = {
      ...personaStories,
      [editingStoryRole]: defaultStory,
    };
    setPersonaStories(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LANDING_STORIES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save stories to localStorage:", e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHead
        title="VaxPlan · Health Microplanning for Ministries"
        description="Multi-tenant GIS microplanning platform for national immunization and primary-care programs. Map facilities, plan sessions, forecast vaccines, approve budgets."
        image="/og-card.png"
      />
      <PasswordLoginDialog open={loginOpen} onOpenChange={setLoginOpen} tenants={activeTenantsList} />

      {/* Edit Story Dialog */}
      {isAdmin && (
        <Dialog open={editingStoryRole !== null} onOpenChange={(open) => { if (!open) setEditingStoryRole(null); }}>
          <DialogContent className="sm:max-w-[540px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                Edit Testimonial &amp; Field Story
              </DialogTitle>
              <DialogDescription>
                Customize the quote, role, and location for this testimonial card. Edits are saved locally in your browser.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="story-tag">Badge / Category Tag</Label>
                <Input
                  id="story-tag"
                  value={storyFormData.tag}
                  onChange={(e) => setStoryFormData((prev) => ({ ...prev, tag: e.target.value }))}
                  placeholder="e.g. Voice from the Field"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="story-quote">Testimonial Quote</Label>
                <Textarea
                  id="story-quote"
                  rows={4}
                  value={storyFormData.quote}
                  onChange={(e) => setStoryFormData((prev) => ({ ...prev, quote: e.target.value }))}
                  placeholder="Enter field quote or testimonial..."
                  className="resize-y"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="story-role">Author Title / Role</Label>
                  <Input
                    id="story-role"
                    value={storyFormData.role}
                    onChange={(e) => setStoryFormData((prev) => ({ ...prev, role: e.target.value }))}
                    placeholder="e.g. Sr. Community Health Nurse"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="story-initials">Avatar Initials</Label>
                  <Input
                    id="story-initials"
                    maxLength={4}
                    value={storyFormData.initials}
                    onChange={(e) => setStoryFormData((prev) => ({ ...prev, initials: e.target.value.toUpperCase() }))}
                    placeholder="e.g. RN"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="story-location">Location / Organization</Label>
                <Input
                  id="story-location"
                  value={storyFormData.location}
                  onChange={(e) => setStoryFormData((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. Western Highlands Province"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetStory}
                className="text-muted-foreground gap-1.5"
                title="Reset this story card to original default content"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to Default
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingStoryRole(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveStory}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3" data-testid="brand-header">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">VaxPlan</span>
                <span className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                  v{APP_VERSION}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Health microplanning for Ministries
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a href={researchUrl} className="text-sm font-medium hover:underline text-muted-foreground">Research</a>
            <a href={docsUrl} className="text-sm font-medium hover:underline text-muted-foreground">Docs</a>
            <Button variant="outline" asChild data-testid="button-request-access">
              <a href="/signup">Request access</a>
            </Button>
            <Button onClick={() => setLoginOpen(true)} data-testid="button-login">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 md:py-32">
          {/* Health-themed background motif */}
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] dark:opacity-[0.08]">
            <div className="absolute top-10 left-[8%] -rotate-12">
              <Syringe className="h-32 w-32" />
            </div>
            <div className="absolute top-1/3 right-[10%] rotate-12">
              <Stethoscope className="h-40 w-40" />
            </div>
            <div className="absolute bottom-10 left-[20%]">
              <HeartPulse className="h-28 w-28" />
            </div>
            <div className="absolute bottom-20 right-[20%] -rotate-6">
              <Activity className="h-32 w-32" />
            </div>
          </div>

          <div className="container mx-auto px-4 max-w-6xl text-center">
            <p className="text-sm uppercase tracking-widest text-primary font-semibold mb-4">
              Intelligent Microplanning for Last-Mile Immunisation Delivery
            </p>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Reach every child. <span className="text-primary">Plan every session.</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              A spatial microplanning platform for immunization, primary care, and outreach —
              built side-by-side with frontline health workers and national EPI managers to map facilities,
              forecast vaccines, budget sessions, and approve plans, all the way down to the last village.
            </p>

            {/* Field & Health Manager Trust Badges */}
            <div className="mt-8 flex flex-wrap justify-center gap-2.5 max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                <WifiOff className="h-3.5 w-3.5" />
                100% Offline-Ready for Remote Field Teams
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                <ShieldCheck className="h-3.5 w-3.5" />
                WHO RED &amp; UNICEF IIP Standard
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-medium">
                <Shield className="h-3.5 w-3.5" />
                Per-Country Isolated Data Sovereignty
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                GAVI 5.0 Zero-Dose Elimination Focus
              </div>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" asChild data-testid="button-get-started">
                <a href="#features">Explore Platform Features</a>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="#roles">For Health Workers &amp; Managers</a>
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLoginOpen(true)}>
                Request Demo / Sign In
              </Button>
            </div>

            {/* Quick-Jump Persona Links */}
            <div className="mt-8 pt-6 border-t border-border/40 max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">See how VaxPlan empowers you:</span>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <a
                  href="#roles"
                  onClick={() => setActiveRoleTab("chw")}
                  className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors font-medium underline decoration-dotted"
                >
                  <Syringe className="h-3 w-3 text-emerald-500" />
                  Field Vaccinators &amp; CHWs
                </a>
                <span>•</span>
                <a
                  href="#roles"
                  onClick={() => setActiveRoleTab("facility")}
                  className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors font-medium underline decoration-dotted"
                >
                  <Building2 className="h-3 w-3 text-blue-500" />
                  Facility In-Charges
                </a>
                <span>•</span>
                <a
                  href="#roles"
                  onClick={() => setActiveRoleTab("manager")}
                  className="inline-flex items-center gap-1 hover:text-purple-600 transition-colors font-medium underline decoration-dotted"
                >
                  <BarChart3 className="h-3 w-3 text-purple-500" />
                  District &amp; National Directors
                </a>
              </div>
            </div>
            
          </div>
        </section>

        {/* Dedicated Persona Section: Health Workers & Managers Alike */}
        <section id="roles" className="py-20 bg-muted/20 border-y">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-12">
              <Badge className="mb-3 px-3 py-1 text-xs uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-none">
                Human-Centered Healthcare
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Built with Empathy for Health Workers and Managers Alike
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Whether you are walking across muddy footpaths to conduct an outreach session under a village tree,
                or validating district-wide vaccine cold chain allocations, VaxPlan adapts seamlessly to your environment.
              </p>

              {/* Role Selection Pills */}
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveRoleTab("chw")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-xs ${
                    activeRoleTab === "chw"
                      ? "bg-emerald-600 text-white shadow-emerald-500/25"
                      : "bg-background border hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Syringe className="h-4 w-4" />
                  Frontline Vaccinators &amp; CHWs
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRoleTab("facility")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-xs ${
                    activeRoleTab === "facility"
                      ? "bg-blue-600 text-white shadow-blue-500/25"
                      : "bg-background border hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Facility In-Charges &amp; Outreach Supervisors
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRoleTab("manager")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-xs ${
                    activeRoleTab === "manager"
                      ? "bg-purple-600 text-white shadow-purple-500/25"
                      : "bg-background border hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  District &amp; National Health Directors
                </button>
              </div>
            </div>

            {/* Persona Content Display */}
            {activeRoleTab === "chw" && (
              <div className="grid lg:grid-cols-12 gap-8 items-center bg-card border rounded-3xl p-8 lg:p-12 shadow-sm animate-in fade-in duration-300">
                <div className="lg:col-span-7 space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                    <WifiOff className="h-3.5 w-3.5" />
                    Last-Mile Usability Where Roads &amp; Cellular Signals End
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-bold">
                    For Community Health Workers &amp; Field Vaccinators
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Designed for field conditions: bright outdoor screens, one-handed mobile touch targets (≥44px),
                    and full functionality with zero cell reception. Focus on vaccinating children rather than wrestling with paper forms.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-background border">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Map className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">100% Offline GPS Maps</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          View village boundaries, terrain, and walk routes without any cellular data connection.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-background border">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Syringe className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Carrier Packing Advisor</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Instantly calculates exact vials, diluents, and safety boxes to pack into cold boxes for today's session.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-background border">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Zero-Dose Child Tagger</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Quick child registration with oversized buttons designed for fast outdoor use and zero typos.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-background border">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <RefreshCw className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Auto-Sync on Return</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          All local registrations sync automatically the moment you return to the clinic's Wi-Fi or mobile reception.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-background border border-emerald-500/20 rounded-2xl p-6 lg:p-8 flex flex-col justify-between relative group">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-none font-medium">
                        {personaStories.chw.tag}
                      </Badge>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-md border border-emerald-500/20 bg-background/50 hover:bg-background shadow-xs transition-colors"
                          onClick={() => handleOpenEditStory("chw")}
                          title="Edit this testimonial card"
                          data-testid="button-edit-story-chw"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit Story</span>
                        </Button>
                      )}
                    </div>
                    <blockquote className="text-base italic text-foreground leading-relaxed">
                      "{personaStories.chw.quote}"
                    </blockquote>
                  </div>
                  <div className="pt-6 border-t border-emerald-500/20 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                      {personaStories.chw.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{personaStories.chw.role}</div>
                      <div className="text-xs text-muted-foreground">{personaStories.chw.location}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeRoleTab === "facility" && (
              <div className="grid lg:grid-cols-12 gap-8 items-center bg-card border rounded-3xl p-8 lg:p-12 shadow-sm animate-in fade-in duration-300">
                <div className="lg:col-span-7 space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                    <Building2 className="h-3.5 w-3.5" />
                    Evidence-Based Planning &amp; Flawless Cold Chain Readiness
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-bold">
                    For Facility In-Charges &amp; Outreach Supervisors
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Transform subjective guesswork into defensible, GIS-grounded operations. Auto-generate session schedules,
                    verify refrigerator capacity limits, and build budgets that survive rigorous district reviews.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-background border">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                        <Compass className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">WHO RED Strategy Sorter</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Automatically categorizes villages into Fixed (&lt;5km), Outreach (5–15km), and Mobile (&gt;15km) strategies.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-background border">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Cold Chain Storage Alerts</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Validates required vaccine net volume against available CCE refrigerator liters to prevent stock spoilage.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-background border">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Automated Operational Budgets</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Converts travel days, vehicle modes (motorbike, 4x4, boat, walking), and team size into exact fuel and per-diem costs.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-background border">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Transparent Multi-Tier Sign-Off</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          One-click submission to District Health Officers with complete audit trails and feedback notes.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-background border border-blue-500/20 rounded-2xl p-6 lg:p-8 flex flex-col justify-between relative group">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="bg-blue-500/20 text-blue-800 dark:text-blue-200 border-none font-medium">
                        {personaStories.facility.tag}
                      </Badge>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-md border border-blue-500/20 bg-background/50 hover:bg-background shadow-xs transition-colors"
                          onClick={() => handleOpenEditStory("facility")}
                          title="Edit this testimonial card"
                          data-testid="button-edit-story-facility"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit Story</span>
                        </Button>
                      )}
                    </div>
                    <blockquote className="text-base italic text-foreground leading-relaxed">
                      "{personaStories.facility.quote}"
                    </blockquote>
                  </div>
                  <div className="pt-6 border-t border-blue-500/20 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                      {personaStories.facility.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{personaStories.facility.role}</div>
                      <div className="text-xs text-muted-foreground">{personaStories.facility.location}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeRoleTab === "manager" && (
              <div className="grid lg:grid-cols-12 gap-8 items-center bg-card border rounded-3xl p-8 lg:p-12 shadow-sm animate-in fade-in duration-300">
                <div className="lg:col-span-7 space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    National Equity, GAVI 5.0 Targeting &amp; Donor Governance
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-bold">
                    For National EPI Directors &amp; Global Health Partners
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Gain bird’s-eye visibility across all provinces and districts. Track national immunization equity,
                    zero-dose settlement hot spots, and generate audit-proof donor reports for WHO, UNICEF, and Gavi.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-background border">
                      <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">GAVI Zero-Dose Heatmaps</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Spatially pinpoint unvaccinated cohorts and unreached settlements to channel equity funding where it matters most.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-background border">
                      <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Strict Country Data Isolation</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          National data sovereignty is guaranteed through isolated tenant architecture, strict RBAC, and full audit logging.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-background border">
                      <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Official WHO Microplan Exports</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Export complete national and district microplans directly to standardized WHO RED PDF and Word documents in seconds.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-background border">
                      <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Macro-to-Micro Analytics</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Seamlessly drill down from national coverage targets to province, district, facility, and individual village sessions.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-background border border-purple-500/20 rounded-2xl p-6 lg:p-8 flex flex-col justify-between relative group">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="bg-purple-500/20 text-purple-800 dark:text-purple-200 border-none font-medium">
                        {personaStories.manager.tag}
                      </Badge>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-md border border-purple-500/20 bg-background/50 hover:bg-background shadow-xs transition-colors"
                          onClick={() => handleOpenEditStory("manager")}
                          title="Edit this testimonial card"
                          data-testid="button-edit-story-manager"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit Story</span>
                        </Button>
                      )}
                    </div>
                    <blockquote className="text-base italic text-foreground leading-relaxed">
                      "{personaStories.manager.quote}"
                    </blockquote>
                  </div>
                  <div className="pt-6 border-t border-purple-500/20 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                      {personaStories.manager.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{personaStories.manager.role}</div>
                      <div className="text-xs text-muted-foreground">{personaStories.manager.location}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* The Problem Section */}
        <section className="py-20 bg-muted/30 border-y">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="text-3xl font-bold mb-6">The Challenge</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Despite global progress in immunisation, millions of children remain unvaccinated or under-vaccinated due to:
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 text-left">
              <div className="bg-background p-6 rounded-xl border shadow-sm">
                <Building2 className="h-8 w-8 text-destructive mb-4" />
                <h3 className="font-semibold mb-2">Poor Microplanning</h3>
                <p className="text-sm text-muted-foreground">At the facility level with inaccurate or outdated population data.</p>
              </div>
              <div className="bg-background p-6 rounded-xl border shadow-sm">
                <Map className="h-8 w-8 text-destructive mb-4" />
                <h3 className="font-semibold mb-2">Weak Mapping</h3>
                <p className="text-sm text-muted-foreground">Unclear catchment areas and limited visibility of hard-to-reach communities.</p>
              </div>
              <div className="bg-background p-6 rounded-xl border shadow-sm">
                <Calendar className="h-8 w-8 text-destructive mb-4" />
                <h3 className="font-semibold mb-2">Inefficient Scheduling</h3>
                <p className="text-sm text-muted-foreground">Suboptimal outreach session planning resulting in missed populations.</p>
              </div>
            </div>
            <p className="mt-8 text-sm text-muted-foreground italic">
              These challenges are consistently highlighted in global immunisation strengthening frameworks (WHO, 2013; UNICEF, 2018; Gavi, 2020).
            </p>
          </div>
        </section>

        {/* Live tenants */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 text-sm text-primary mb-2">
                <Globe className="h-4 w-4" />
                Country workspaces configured for testing and demonstration
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">
                Designed for multi-country and single-country implementation
              </h2>
              <p className="mt-4 text-muted-foreground text-sm max-w-2xl mx-auto">
                These workspaces are configured to demonstrate how VaxPlan can support either a single national implementation or a multi-country deployment model. They do not represent official national production use unless separately confirmed.
              </p>
            </div>

            <div
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto"
              data-testid="grid-tenants"
            >
              {activeTenantsList.map((t) => (
                <TenantCard key={t.id} tenant={t} />
              ))}
              <Card className="border-dashed hover-elevate" data-testid="card-tenant-cta">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">Your Ministry next?</div>
                    <a
                      href="/signup"
                      className="text-xs text-primary inline-flex items-center gap-1 mt-1 hover:underline"
                    >
                      Request onboarding <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Features / The Solution */}
        <section id="features" className="py-24 bg-muted/40 border-y">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">The Solution: GIS-Powered Intelligence</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                VaxPlan transforms traditional microplanning into a data-driven system. It integrates population data, catchment areas, service schedules, optimization logic, and coverage gap analysis.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { title: "GIS-Based Catchment Mapping", desc: "Visualise real service areas and identify underserved populations.", icon: Map },
                { title: "Microplanning Engine", desc: "Automatically generate outreach plans based on population needs and facility capacity.", icon: Building2 },
                { title: "Zero-Dose Tracking", desc: "Identify children who have not received any routine vaccines.", icon: Users },
                { title: "Coverage Gap Analysis", desc: "Detect missed communities and low-coverage pockets.", icon: EyeOff },
                { title: "Session Optimization", desc: "Recommend optimal outreach schedules based on geography and demand.", icon: Calendar },
                { title: "Real-Time Dashboards", desc: "Monitor coverage, session performance, and planning gaps.", icon: BarChart3 },
                { title: "Offline-First Capability", desc: "Supports low-connectivity environments for field usability.", icon: Cloud },
              ].map((feature, i) => (
                <Card key={i} className="hover-elevate border-none shadow-sm">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-xl mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Operational Capabilities Section */}
        <section id="capabilities" className="py-24 bg-gradient-to-b from-background via-muted/15 to-background border-t">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-12">
              <Badge className="mb-3 px-3 py-1 text-xs uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-none font-semibold">
                Operational Capabilities
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for the Last Mile: Production-Ready Innovations</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                VaxPlan equips health systems with production-grade digital tools—delivering offline-first field execution, automated systems interoperability, AI forecasting, and real-time community engagement.
              </p>

              {/* Category Filter Chips */}
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {[
                  { key: "all", label: "All Capabilities", count: 6 },
                  { key: "field", label: "Field & Mobile Workers", count: 2 },
                  { key: "desktop", label: "Desktop & Offline Facilities", count: 1 },
                  { key: "systems", label: "Data & Systems Interoperability", count: 1 },
                  { key: "ai", label: "AI & Predictive Logistics", count: 1 },
                  { key: "community", label: "Caregiver & Community", count: 1 },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setRoadmapFilter(f.key as any)}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      roadmapFilter === f.key
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border"
                    }`}
                  >
                    <span>{f.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        roadmapFilter === f.key
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-background text-muted-foreground"
                      }`}
                    >
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  id: "android-app",
                  title: "CHW Field Workspace (PWA & Mobile)",
                  desc: "Fully-featured offline-first mobile workspace for community health workers (CHWs) to map villages, register zero-dose children, and record sessions in real time with zero connectivity.",
                  status: "Operational",
                  tagColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
                  icon: Smartphone,
                  category: "field",
                  audience: "Community Health Workers & Vaccinators",
                  highlights: ["Zero-connectivity offline sync", "Oversized touch targets (≥44px)", "GPS settlement geofencing"],
                  route: "/chw-field",
                  actionLabel: "Launch CHW Field Workspace",
                },
                {
                  id: "windows-desktop",
                  title: "Desktop Offline Planning Hub",
                  desc: "Dedicated offline client for facility managers and district offices in remote low-connectivity posts, supporting local microplan editing, spatial cache, and delta sync.",
                  status: "Operational",
                  tagColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
                  icon: Monitor,
                  category: "desktop",
                  audience: "Facility In-Charges & District Health Officers",
                  highlights: ["Embedded local database", "High-res offline boundary cache", "Low-bandwidth delta synchronization"],
                  route: "/desktop-hub",
                  actionLabel: "Open Desktop Offline Hub",
                },
                {
                  id: "dhis2-ingest",
                  title: "Direct DHIS2 & HIS Integration",
                  desc: "Bi-directional integration with national DHIS2 instances to pull routine immunization coverage statistics, target populations, and synchronize microplanning indicators.",
                  status: "Operational",
                  tagColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
                  icon: RefreshCw,
                  category: "systems",
                  audience: "EPI Data Officers & National M&E Teams",
                  highlights: ["Automated population sync", "Coverage cross-validation", "National data warehouse export"],
                  route: "/his-integrations",
                  actionLabel: "Configure DHIS2 Sync",
                },
                {
                  id: "ai-stock-logistics",
                  title: "AI Predictive Stock & Cold Chain Logistics",
                  desc: "Machine learning models analyzing stock consumption and storage limits to forecast and prevent vaccine stockouts before outreach campaigns begin.",
                  status: "Operational",
                  tagColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
                  icon: Cpu,
                  category: "ai",
                  audience: "Cold Chain Officers & Supply Chain Managers",
                  highlights: ["Wastage trend forecasting", "Fridge surge capacity alerts", "Dynamic buffer calculations"],
                  route: "/cold-chain",
                  actionLabel: "Launch AI Stock Logistics",
                },
                {
                  id: "route-optimization",
                  title: "Dynamic Route & Session Planning",
                  desc: "Advanced GIS routing algorithms factoring in weather, road types, and seasonal river crossings to plan the safest and most efficient path for health workers.",
                  status: "Operational",
                  tagColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
                  icon: Navigation,
                  category: "field",
                  audience: "Mobile Outreach Teams & Field Supervisors",
                  highlights: ["River crossing hazard detection", "Fuel consumption budgeting", "Motorbike vs 4x4 route logic"],
                  route: "/session-planning",
                  actionLabel: "Plan Optimized Routes",
                },
                {
                  id: "caregiver-sms",
                  title: "Automated Caregiver SMS & Recall Alerts",
                  desc: "Localized SMS broadcasting to notify mothers and caregivers of upcoming outreach sessions in their immediate village, boosting coverage rates.",
                  status: "Operational",
                  tagColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
                  icon: MessageSquare,
                  category: "community",
                  audience: "Mothers, Caregivers & Village Elders",
                  highlights: ["Local dialect broadcast", "Outreach date reminders", "Zero-dose defaulter recall"],
                  route: "/defaulters",
                  actionLabel: "Broadcast Caregiver Alerts",
                },
              ]
                .filter((item) => roadmapFilter === "all" || item.category === roadmapFilter)
                .map((item) => (
                  <Card
                    key={item.id}
                    className="hover-elevate relative overflow-hidden border bg-card/60 backdrop-blur transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="p-6 pb-2">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <item.icon className="h-5 w-5" />
                          </div>
                          <Badge variant="outline" className={`${item.tagColor} text-[11px] font-semibold px-2.5 py-0.5 inline-flex items-center gap-1.5`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {item.status}
                          </Badge>
                        </div>

                        <div className="mb-2">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            {item.audience}
                          </span>
                          <h3 className="font-bold text-lg leading-snug mt-0.5">{item.title}</h3>
                        </div>

                        <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>

                    <div className="p-6 pt-3 border-t bg-muted/20 flex flex-col justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-foreground/80 mb-2 flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-primary" /> Key Capabilities
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {item.highlights.map((h, hi) => (
                            <span
                              key={hi}
                              className="inline-flex items-center text-[10.5px] px-2 py-0.5 rounded-md bg-background border text-muted-foreground"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="w-full text-xs font-semibold gap-1.5 border-primary/30 hover:bg-primary/10 hover:text-primary transition-all mt-1"
                        data-testid={`roadmap-action-${item.id}`}
                      >
                        <Link href={!user ? `/login?redirect=${encodeURIComponent(item.route)}` : item.route}>
                          <span>{item.actionLabel}</span>
                          <ArrowRight className="h-3.5 w-3.5 ml-auto text-primary" />
                        </Link>
                      </Button>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-16">
              <Badge className="mb-3 px-3 py-1 text-xs uppercase tracking-wider bg-primary/15 text-primary border-none">
                Operational Workflow
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                A closed-loop operational journey connecting national guidance to frontline village outreach.
              </p>
            </div>

            <div className="space-y-5">
              {[
                {
                  step: "Step 1: Data Integration",
                  role: "M&E & Data Officers",
                  roleBadge: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
                  desc: "Import facility master lists, population censuses, WorldPop rasters, and DHIS2 reporting figures.",
                },
                {
                  step: "Step 2: Mapping & Analysis",
                  role: "District GIS Focal Points",
                  roleBadge: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
                  desc: "Automatically map communities to nearest service delivery points, calculating terrain and road network distances.",
                },
                {
                  step: "Step 3: Gap Identification",
                  role: "Facility In-Charges & CHWs",
                  roleBadge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  desc: "Highlight unreached settlements, zero-dose clusters, and hard-to-reach populations beyond 5km boundaries.",
                },
                {
                  step: "Step 4: Microplan Generation",
                  role: "Health Teams & Supervisors",
                  roleBadge: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
                  desc: "Auto-generate actionable outreach schedules, carrier supply packing lists, and transport budget requirements.",
                },
                {
                  step: "Step 5: Monitoring & Feedback",
                  role: "Provincial & National Reviewers",
                  roleBadge: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  desc: "Review session coverage in real-time, approve district plans with digital audit trails, and continuously refine strategies.",
                },
              ].map((item, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-5 sm:items-center p-6 rounded-2xl bg-card border hover:shadow-md transition-all">
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="flex-shrink-0 h-13 w-13 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shadow-xs">
                      {i + 1}
                    </div>
                    <div className="sm:hidden">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${item.roleBadge}`}>
                        {item.role}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{item.step}</h3>
                      <span className={`hidden sm:inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${item.roleBadge}`}>
                        Lead: {item.role}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* National Programs & Country Tenancies Section */}
        <section id="countries" className="py-20 bg-background border-t">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-12">
              <Badge className="mb-3 px-3 py-1 text-xs uppercase tracking-wider bg-primary/10 text-primary border-none">
                National Health Systems
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Supported National Immunization Programs
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                VaxPlan provides sovereign, country-isolated workspaces configured with national EPI schedules, administrative boundaries, target population groups, and public health calendars.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTenantsList.map((tenant) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  onSelect={(tId) => {
                    if (typeof window !== "undefined") {
                      localStorage.setItem("vaxplan_last_tenant_id", tId);
                    }
                    setLoginOpen(true);
                  }}
                />
              ))}
            </div>

            <div className="mt-8 text-center">
              <p className="text-xs text-muted-foreground">
                Click any country above to sign in directly with your national program credentials.
              </p>
            </div>
          </div>
        </section>

        {/* Standards Alignment */}
        <section className="py-20 bg-muted/30 border-y">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-6">Standards Alignment</h2>
            <p className="text-lg text-muted-foreground mb-8">
              VaxPlan is designed to align with global immunisation microplanning frameworks and digital health principles:
            </p>
            <div className="grid sm:grid-cols-3 gap-6 text-left">
              <div className="bg-background p-6 rounded-xl border">
                <h4 className="font-bold text-primary mb-2">WHO</h4>
                <p className="text-sm">Immunisation microplanning guidance (WHO, 2013)</p>
              </div>
              <div className="bg-background p-6 rounded-xl border">
                <h4 className="font-bold text-primary mb-2">UNICEF</h4>
                <p className="text-sm">Data-driven service delivery approaches (UNICEF, 2018)</p>
              </div>
              <div className="bg-background p-6 rounded-xl border">
                <h4 className="font-bold text-primary mb-2">Gavi</h4>
                <p className="text-sm">Health system strengthening priorities (Gavi, 2020)</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 bg-primary text-primary-foreground text-center">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to improve immunisation coverage in your system?
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-10">
              Moves from static planning to adaptive intelligence. Bridges data gaps in rural and urban health systems.
              Supports equitable vaccine distribution. Enables evidence-based decision-making at all levels.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto text-primary" onClick={() => setLoginOpen(true)}>
                Explore Dashboard
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-primary-foreground/20 hover:bg-primary-foreground/10 text-primary-foreground" asChild>
                <a href="/signup">Integrate VaxPlan</a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-2 pb-8 mb-8 border-b text-xs text-muted-foreground">
            {trustPoints.map((p) => (
              <Badge key={p} variant="secondary" className="font-normal">
                {p}
              </Badge>
            ))}
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary text-primary-foreground flex items-center justify-center">
                <HeartPulse className="h-3 w-3" />
              </div>
              <span>VaxPlan · Health Microplanning Platform</span>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 text-xs">
              <a href="#features" className="text-primary hover:underline font-medium">
                Features
              </a>
              <a href={researchUrl} className="text-primary hover:underline font-medium">
                Research
              </a>
              <a href={docsUrl} className="text-primary hover:underline font-medium">
                Docs
              </a>
              <a href="/help" className="text-primary hover:underline font-medium">
                Help Center
              </a>
              <a
                href="/help"
                className="text-primary hover:underline"
                data-testid="link-footer-help"
              >
                Help &amp; User Guide
              </a>
              <a
                href="/data-sources"
                className="text-primary hover:underline font-medium"
                data-testid="link-footer-data-sources"
              >
                Data Sources
              </a>
              <span className="hidden lg:inline text-muted-foreground ml-2">
                Built for national immunization programs · Multi-tenant SaaS
              </span>
            </div>
          </div>
          <div className="mt-3 text-center text-[11px] text-muted-foreground/80" data-testid="landing-version">
            {versionLabel()}
          </div>
        </div>
      </footer>

    </div>
  );
}
