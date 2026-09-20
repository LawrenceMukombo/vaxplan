import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  HeartPulse,
  Shield,
  Syringe,
  Stethoscope,
  Eye,
  EyeOff,
  WifiOff,
  ArrowLeft,
  UserCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageHead } from "@/components/PageHead";
import { saveTenantsCache, loadTenantsCache, saveActiveTenant, loadActiveTenant, DEFAULT_CANONICAL_TENANTS } from "@/lib/tenantCache";
import {
  clearLogoutState,
  recordOnlineAuthSession,
  saveOfflineCredentials,
  verifyOfflineCredentials,
  getCachedOfflineAccounts,
} from "@/lib/authSession";
import { queryClient } from "@/lib/queryClient";

interface PublicTenant {
  id: string;
  code: string;
  name: string;
  countryCode: string;
}

const DEFAULT_TENANTS: PublicTenant[] = DEFAULT_CANONICAL_TENANTS as PublicTenant[];

export default function LoginPage() {
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
  const [cachedAccounts, setCachedAccounts] = useState<{ email: string; name?: string; tenantId?: string | null }[]>([]);
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  useEffect(() => {
    // Clear any stale pending logout flag so the user is never trapped
    clearLogoutState();

    // Check cached offline accounts
    const accounts = getCachedOfflineAccounts();
    setCachedAccounts(accounts);

    // Pre-populate email from last session or cached accounts if available
    const lastEmail = localStorage.getItem("vaxplan_last_email") || (accounts.length > 0 ? accounts[0].email : "");
    if (lastEmail && !email) {
      setEmail(lastEmail);
    }

    // Pre-populate active tenant from cache or last tenant if available
    const active = loadActiveTenant();
    const lastTenantId = active?.id ? String(active.id) : localStorage.getItem("vaxplan_last_tenant_id") || DEFAULT_TENANTS[0].id;
    if (lastTenantId) {
      setSelectedTenantId(lastTenantId);
    }
  }, []);

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

  const validTenants = (fetchedTenants || DEFAULT_TENANTS).filter(
    (t) => t && typeof t.id === "string" && typeof t.name === "string"
  );
  const activeTenants = validTenants.length > 0 ? validTenants : DEFAULT_TENANTS;

  function resetState() {
    setError(null);
    setNotice(null);
    setBusy(false);
    setSelectedTenantId("");
    setKeepMeSignedIn(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const targetEmail = email.trim();
    const targetTenantId = selectedTenantId || localStorage.getItem("vaxplan_last_tenant_id") || DEFAULT_TENANTS[0].id;

    // If device is offline, authenticate against cached credentials
    if (!navigator.onLine) {
      try {
        const offlineResult = await verifyOfflineCredentials(targetEmail, password, targetTenantId);
        if (!offlineResult.success) {
          setError(offlineResult.message || "Offline authentication failed.");
          return;
        }

        clearLogoutState();
        if (offlineResult.user) {
          recordOnlineAuthSession(offlineResult.user);
          const tId = targetTenantId || offlineResult.tenantId || DEFAULT_TENANTS[0].id;
          if (tId) {
            const matchedTenant = activeTenants.find((t) => t.id === tId) || DEFAULT_TENANTS.find(t => t.id === tId) || {
              id: tId,
              name: "Republic of South Africa National Department of Health",
              code: "ZAF",
              countryCode: "ZAF"
            };
            saveActiveTenant(matchedTenant);
          }
          queryClient.setQueryData(["/api/auth/user"], offlineResult.user);
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
        return;
      } catch (offlineErr: any) {
        setError(offlineErr?.message || "Offline authentication failed.");
        return;
      } finally {
        setBusy(false);
      }
    }

    // Online authentication flow
    try {
      const res = await fetch("/api/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: targetEmail,
          password,
          tenantId: targetTenantId,
          keepMeSignedIn,
          userIdleTimeout: localStorage.getItem("vaxplan_user_idle_timeout") || "default",
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
        // Securely cache hashed offline credentials for seamless offline access
        void saveOfflineCredentials(targetEmail, password, data.user, targetTenantId);
        if (targetTenantId) {
          const matchedTenant = activeTenants.find((t) => t.id === targetTenantId);
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
      // Graceful fallback to cached credentials if network drops mid-request
      try {
        const offlineResult = await verifyOfflineCredentials(targetEmail, password, targetTenantId);
        if (offlineResult.success && offlineResult.user) {
          clearLogoutState();
          recordOnlineAuthSession(offlineResult.user);
          const tId = targetTenantId || offlineResult.tenantId;
          if (tId) {
            const matchedTenant = activeTenants.find((t) => t.id === tId);
            if (matchedTenant) {
              saveActiveTenant(matchedTenant);
            }
          }
          queryClient.setQueryData(["/api/auth/user"], offlineResult.user);
          window.location.replace("/");
          return;
        }
      } catch {}
      setError("Network error. Unable to connect to server, and no valid offline credentials were found.");
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
          "If an account exists for that email, your administrator has been notified to help you reset your password."
      );
    } catch (err) {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col justify-between">
      <PageHead
        title="Sign In · VaxPlan"
        description="Sign in to your national or program VaxPlan account."
        image="/og-card.png"
      />

      {/* Header bar */}
      <header className="w-full border-b bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm">VaxPlan</span>
            <span className="text-[10px] text-muted-foreground">
              Health microplanning for Ministries
            </span>
          </div>
        </a>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </a>
        </div>
      </header>

      {/* Centered Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-4xl rounded-2xl border bg-card shadow-lg overflow-hidden grid md:grid-cols-2">
          {/* Brand & Mission Banner (Left Column) */}
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
                <span className="font-semibold tracking-wide">VaxPlan</span>
                <span className="text-xs text-white/80">
                  Immunization & Primary Healthcare
                </span>
              </div>
            </div>
            <div className="relative space-y-3 my-auto py-8">
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
            <div className="relative flex items-center gap-2 text-xs text-white/80">
              <Shield className="h-4 w-4" />
              Encrypted · Audit-logged · Country-isolated
            </div>
          </div>

          {/* Form Panel (Right Column) */}
          <div className="p-6 sm:p-8 flex flex-col justify-center">
            {isOffline && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                  <WifiOff className="h-4 w-4 shrink-0" />
                  <span>Offline Mode — Sign in to access your local field data.</span>
                </div>

                {cachedAccounts.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Recent:
                    </span>
                    {cachedAccounts.slice(0, 3).map((acc) => (
                      <Badge
                        key={acc.email}
                        variant="outline"
                        onClick={() => {
                          setEmail(acc.email);
                          if (acc.tenantId) setSelectedTenantId(acc.tenantId);
                        }}
                        className="cursor-pointer text-[11px] hover:bg-muted py-0.5"
                      >
                        {acc.email}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mode === "login" ? (
              <>
                <div className="mb-6 space-y-1">
                  <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Sign in with your national or program credentials.
                  </p>
                </div>
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-tenant" className="text-xs font-medium">
                      Country / Program
                    </Label>
                    <select
                      id="login-tenant"
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
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.code || t.countryCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-xs font-medium">
                      Email address
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="user@ministry.gov"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" className="text-xs font-medium">
                        Password
                      </Label>
                      {!isOffline && (
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
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="login-password"
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
                      className="text-xs font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-muted-foreground"
                    >
                      Keep me signed in on this computer
                    </Label>
                  </div>
                  {error && (
                    <div className="text-xs rounded-md bg-destructive/10 text-destructive p-2.5 font-medium" data-testid="text-login-error">
                      {error}
                    </div>
                  )}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    disabled={busy}
                    data-testid="button-submit-login"
                  >
                    {busy
                      ? isOffline
                        ? "Verifying offline…"
                        : "Signing in…"
                      : isOffline
                        ? "Sign in (Offline Mode)"
                        : "Sign in to VaxPlan"}
                  </Button>
                </form>
                <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground space-y-2">
                  <p>
                    Don't have an account?{" "}
                    <a href="/signup" className="text-primary font-medium hover:underline">
                      Request access
                    </a>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6 space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight">Reset your password</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Enter your email and your administrator will be notified to assist you.
                  </p>
                </div>
                <form onSubmit={submitForgot} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs font-medium">
                      Email address
                    </Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      placeholder="user@ministry.gov"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-forgot-email"
                    />
                  </div>
                  {notice && (
                    <div
                      className="text-xs rounded-md bg-primary/10 text-foreground p-3"
                      data-testid="text-forgot-notice"
                    >
                      {notice}
                    </div>
                  )}
                  {error && (
                    <div className="text-xs rounded-md bg-destructive/10 text-destructive p-2.5" data-testid="text-forgot-error">
                      {error}
                    </div>
                  )}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={busy || isOffline}
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
                  className="mt-6 text-center text-xs text-primary hover:underline mx-auto block"
                  data-testid="button-back-to-login"
                >
                  ← Back to sign in
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} VaxPlan · Multi-Tenant Health Microplanning Platform
      </footer>
    </div>
  );
}
