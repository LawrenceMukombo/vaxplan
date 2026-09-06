import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HeartPulse,
  Shield,
  Syringe,
  Stethoscope,
  Eye,
  EyeOff,
  WifiOff,
  ArrowLeft,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageHead } from "@/components/PageHead";
import { saveTenantsCache, loadTenantsCache, saveActiveTenant } from "@/lib/tenantCache";
import { clearLogoutState, recordOnlineAuthSession } from "@/lib/authSession";
import { queryClient } from "@/lib/queryClient";

interface PublicTenant {
  id: string;
  code: string;
  name: string;
  countryCode: string;
}

const DEFAULT_TENANTS: PublicTenant[] = [
  { id: "8c2f81fb-06f3-4688-90ea-e9ae27d73191", code: "PNG", name: "Papua New Guinea National Department of Health", countryCode: "PNG" },
  { id: "705728db-4892-49d7-9b67-35aa67c7574b", code: "SSD", name: "Republic of South Sudan Ministry of Health", countryCode: "SSD" },
  { id: "4bb7abba-11cd-4c99-96c2-eedc8a4dfd06", code: "ZMB", name: "Republic of Zambia Ministry of Health", countryCode: "ZMB" },
  { id: "22571429-f7dd-4f1d-9dea-abdfbf4dc115", code: "BW", name: "Republic of Botswana Ministry of Health", countryCode: "BWA" },
  { id: "08083581-cf5e-47d7-b3ed-a97b10be01ba", code: "KEN", name: "Republic of Kenya Ministry of Health", countryCode: "KEN" },
  { id: "1a39bf12-bf10-4415-b2dd-96f1ece09b75", code: "VNM", name: "Republic of Vietnam Ministry of Health", countryCode: "VNM" },
  { id: "c43e2923-b2d9-4175-a1a8-ff6b0cd58810", code: "ZAF", name: "Republic of South Africa National Department of Health", countryCode: "ZAF" },
];

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [keepMeSignedIn, setKeepMeSignedIn] = useState(false);
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  useEffect(() => {
    // Clear any stale pending logout flag so the user is never trapped
    clearLogoutState();
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
        if (selectedTenantId) {
          const matchedTenant = activeTenants.find((t) => t.id === selectedTenantId);
          if (matchedTenant) {
            saveActiveTenant(matchedTenant);
          }
        }
        queryClient.setQueryData(["/api/auth/user"], data.user);
        void queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
      window.location.replace("/");
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
          <div className="flex flex-col">
            <span className="font-semibold text-sm leading-tight">VaxPlan</span>
            <span className="text-[11px] text-muted-foreground leading-tight">
              Health microplanning for Ministries
            </span>
          </div>
        </a>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <a href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </a>
          </Button>
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
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <WifiOff className="h-4 w-4 shrink-0" />
                <span>You are currently offline. Connect to internet to authenticate.</span>
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
                      required
                      value={selectedTenantId}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                      data-testid="select-tenant"
                    >
                      <option value="">Select country / program...</option>
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
                    className="w-full"
                    disabled={busy || isOffline}
                    data-testid="button-submit-login"
                  >
                    {busy ? "Signing in…" : "Sign in to VaxPlan"}
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
