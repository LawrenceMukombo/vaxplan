import { lazy, Suspense, useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { canViewSiteAnalytics, canApproveSessionPlan } from "@/lib/permissions";
import { SiteActivityPanel } from "@/components/SiteActivityPanel";
import {
  Building2,
  Users,
  Calendar,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Clock,
  CheckCircle2,
  DollarSign,
  Activity,
  Syringe,
  ClipboardCheck,
  Download,
  FileText,
  Info,
  Database,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation, useSearch } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { Facility, Village, SessionPlan, BudgetItem, ApprovalRequest, PopulationData, StockTransaction, CatalogueVaccine } from "@shared/schema";
import { deriveSessionLifecycle } from "@/lib/sessionStatus";
import { summarizeFacilityAlerts, loadStockThreshold } from "@/lib/stockAlerts";
import { Package } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
const MapView = lazy(() =>
  import("@/components/MapView").then((module) => ({ default: module.MapView })),
);
const VgieDashboard = lazy(() => import("@/pages/vgie/Dashboard"));

function DeferredDashboardMap({ facilities, villages }: { facilities: Facility[]; villages: Village[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={containerRef} className="h-full w-full">
      {shouldLoad ? (
        <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
          <MapView facilities={facilities} villages={villages} height="100%" />
        </Suspense>
      ) : (
        <Skeleton className="h-full w-full rounded-none" />
      )}
    </div>
  );
}

/* Original Code:
interface StatsData {
  totalFacilities: number;
  totalVillages: number;
  htrVillages: number;
  totalSessions: number;
  totalPopulation: number;
  activeFacilities: number;
}
*/
interface StatsData {
  totalFacilities: number;
  totalVillages: number;
  assignedVillages: number;
  htrVillages: number;
  totalSessions: number;
  totalPopulation: number;
  activeFacilities: number;
  submittedPlans?: number;
  approvedPlans?: number;
  autoApprovedPlans?: number;
  facilitiesWithApprovedPlans?: number;
}

interface CoverageVaccine {
  vaccineName: string;
  targetPopulation: number;
  dosesRequired: number;
  administered: number;
  coveragePct: number;
}

interface CoverageData {
  quarter: number;
  year: number;
  facilityId: number | null;
  vaccines: CoverageVaccine[];
  totals: {
    targetPopulation: number;
    administered: number;
    coveragePct: number;
  };
}

const CURRENT_DATE = new Date();
const CURRENT_YEAR = CURRENT_DATE.getUTCFullYear();
const CURRENT_QUARTER = Math.floor(CURRENT_DATE.getUTCMonth() / 3) + 1;
const COVERAGE_STORAGE_KEY = "vaxplan_dashboard_coverage_filters";

const isFacilityScopedRole = (role?: string) =>
  role === "facility_clerk" || role === "facility_in_charge" || role === "facility_partner";

interface ZeroDoseSummary {
  total: number;
  denominator: number;
  pct: number;
  underImmunized: { total: number; denominator: number; pct: number };
  byDistrict: Array<{
    districtId: number;
    districtName: string;
    zeroDose: number;
    underImmunized: number;
    denominator: number;
    pct: number;
    underImmunizedPct: number;
  }>;
}
interface DropoutSummary {
  dtp1_dtp3: { num: number; denom: number; rate: number; byDistrict: Array<{ districtId: number; districtName: string; dtp1: number; dtp3: number; rate: number }> };
  dtp1_mcv1: { num: number; denom: number; rate: number; byDistrict: Array<{ districtId: number; districtName: string; dtp1: number; mcv1: number; rate: number }> };
}

interface QuarterlyReviewCoverage {
  year: number;
  quarter: number;
  totalFacilities: number;
  facilitiesWithReview: number;
  coveragePct: number;
}

function dropoutBadgeClass(rate: number) {
  if (rate > 10) return "border-rose-500 text-rose-600";
  if (rate >= 5) return "border-amber-500 text-amber-600";
  return "border-emerald-500 text-emerald-600";
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-600 border-emerald-500 bg-emerald-500/10";
  if (score >= 60) return "text-amber-600 border-amber-500 bg-amber-500/10";
  return "text-rose-600 border-rose-500 bg-rose-500/10";
}

function denominatorTone(score: number | null) {
  if (score === null) return { label: "Unscored", className: "border-slate-400 text-slate-600 bg-slate-500/10" };
  if (score >= 85) return { label: "High confidence", className: "border-emerald-500 text-emerald-600 bg-emerald-500/10" };
  if (score >= 70) return { label: "Medium confidence", className: "border-amber-500 text-amber-600 bg-amber-500/10" };
  return { label: "Needs review", className: "border-rose-500 text-rose-600 bg-rose-500/10" };
}

function PlanHealthCard({
  metrics,
}: {
  metrics: Array<{ label: string; score: number; detail: string; href?: string }>;
}) {
  const score = metrics.length
    ? Math.round(metrics.reduce((sum, metric) => sum + metric.score, 0) / metrics.length)
    : 0;
  const blockerCount = metrics.filter((metric) => metric.score < 60).length;

  return (
    <Card data-testid="card-plan-health-score">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Plan Health Score
          </CardTitle>
          <Badge variant="outline" className={scoreTone(score)}>
            {score >= 80 ? "Ready" : score >= 60 ? "Watch" : "Action needed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-4xl font-bold leading-none" data-testid="text-plan-health-score">
              {score}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Composite of denominator, catchment, session, approval, budget, review, and stock readiness.
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-foreground">
              {blockerCount} blocker{blockerCount === 1 ? "" : "s"}
            </div>
            <div className="text-xs text-muted-foreground">below 60%</div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Facility readiness drivers</span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/plan-health">Open facility scores</Link>
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {metrics.map((metric) => {
            const row = (
              <div className="space-y-1 rounded-lg border bg-muted/20 px-3 py-2 hover:bg-muted/35 transition-colors">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-foreground">{metric.label}</span>
                  <span className={`font-mono font-bold ${metric.score >= 80 ? "text-emerald-600" : metric.score >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                    {metric.score}%
                  </span>
                </div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${metric.score >= 80 ? "bg-emerald-500" : metric.score >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${Math.max(0, Math.min(metric.score, 100))}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">{metric.detail}</p>
              </div>
            );
            return metric.href ? (
              <Link key={metric.label} href={metric.href} className="block">
                {row}
              </Link>
            ) : (
              <div key={metric.label}>{row}</div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DenominatorConfidenceCard({
  records,
  fallbackPopulation,
}: {
  records: PopulationData[] | undefined;
  fallbackPopulation: number;
}) {
  const summary = useMemo(() => {
    const rows = records ?? [];
    const scored = rows
      .map((row) => Number((row as any).confidenceScore))
      .filter((n) => Number.isFinite(n));
    const avg = scored.length
      ? Math.round(scored.reduce((sum, n) => sum + n, 0) / scored.length)
      : null;
    const approved = rows.filter((row) => row.approvalStatus === "approved").length;
    const latestYear = rows.length ? Math.max(...rows.map((row) => Number(row.year) || 0)) : null;
    const sourceCounts = new Map<string, number>();
    rows.forEach((row) => {
      const key = String(row.source || "unknown").toUpperCase();
      sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
    });
    const sources = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const totalPopulation = rows.reduce((sum, row) => sum + Number(row.totalPopulation || 0), 0);
    return {
      avg,
      approved,
      total: rows.length,
      latestYear,
      sources,
      totalPopulation: totalPopulation || fallbackPopulation,
    };
  }, [records, fallbackPopulation]);

  const tone = denominatorTone(summary.avg);
  const approvalPct = summary.total ? Math.round((summary.approved / summary.total) * 100) : 0;

  return (
    <Card data-testid="card-denominator-confidence">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-sky-500" />
            Denominator Confidence
          </CardTitle>
          <Badge variant="outline" className={tone.className}>
            {tone.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">Confidence</div>
            <div className="text-xl font-bold" data-testid="text-denominator-confidence">
              {summary.avg === null ? "--" : `${summary.avg}%`}
            </div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">Approved</div>
            <div className="text-xl font-bold">{approvalPct}%</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">Year</div>
            <div className="text-xl font-bold">{summary.latestYear || "n/a"}</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Planning denominator</span>
            <span className="font-mono font-semibold">
              {summary.totalPopulation.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {summary.sources.length === 0 ? (
              <Badge variant="outline">No source records</Badge>
            ) : (
              summary.sources.map(([source, count]) => (
                <Badge key={source} variant="secondary" className="text-[10px]">
                  {source} ({count})
                </Badge>
              ))
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Badge reflects available confidence scores, approval status, recency, and source mix for population records in scope.
          </p>
        </div>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href="/population">Review denominators</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ImmunizationIndicatorCards() {
  const { data: zd, isLoading: zdLoading } = useQuery<ZeroDoseSummary>({
    queryKey: ["/api/indicators/zero-dose"],
  });
  const { data: dr, isLoading: drLoading } = useQuery<DropoutSummary>({
    queryKey: ["/api/indicators/dropout"],
  });

  const topZeroDose = (zd?.byDistrict ?? []).slice(0, 5);
  const maxZd = Math.max(1, ...topZeroDose.map((d) => d.zeroDose));

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
      <Card data-testid="card-zero-dose">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Zero-dose children
            </CardTitle>
            <Link
              href="/indicators/zero-dose"
              className="text-xs font-semibold text-primary hover:underline"
              data-testid="link-zero-dose-details"
            >
              By village →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          {zdLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !zd || zd.denominator === 0 ? (
            <p className="text-sm text-muted-foreground">
              No eligible children (≥12 months) registered yet.
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-rose-600" data-testid="text-zero-dose-total">
                  {zd.total.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  of {zd.denominator.toLocaleString()} children ≥12 mo · {zd.pct}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Children ≥12 months with no DTP1 (Pentavalent-1) dose recorded. Excludes SIA / campaign doses.
              </p>
              <div className="space-y-1.5 pt-1">
                {topZeroDose.length === 0 ? (
                  <p className="text-xs text-muted-foreground">All districts at 0%.</p>
                ) : (
                  topZeroDose.map((d) => (
                    <div key={d.districtId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate text-foreground">{d.districtName}</span>
                        <span className="font-mono text-muted-foreground">
                          {d.zeroDose} ({d.pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${(d.zeroDose / maxZd) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-under-immunized">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Syringe className="h-5 w-5 text-amber-500" />
              Under-immunized children
            </CardTitle>
            <Link
              href="/indicators/zero-dose"
              className="text-xs font-semibold text-primary hover:underline"
              data-testid="link-under-immunized-details"
            >
              By village →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          {zdLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !zd || zd.denominator === 0 ? (
            <p className="text-sm text-muted-foreground">
              No eligible children (≥12 months) registered yet.
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-3xl font-bold text-amber-600"
                  data-testid="text-under-immunized-total"
                >
                  {zd.underImmunized.total.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  of {zd.underImmunized.denominator.toLocaleString()} children ≥12 mo · {zd.underImmunized.pct}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Children ≥12 months who received DTP1 but not DTP3 (Pentavalent-3). Excludes SIA / campaign doses.
              </p>
              <div className="space-y-1.5 pt-1">
                {zd.byDistrict.filter((d) => d.underImmunized > 0).length === 0 ? (
                  <p className="text-xs text-muted-foreground">All districts at 0%.</p>
                ) : (
                  [...zd.byDistrict]
                    .sort((a, b) => b.underImmunized - a.underImmunized)
                    .slice(0, 5)
                    .map((d) => {
                      const maxUI = Math.max(
                        1,
                        ...zd.byDistrict.map((x) => x.underImmunized),
                      );
                      return (
                        <div key={d.districtId} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium truncate text-foreground">
                              {d.districtName}
                            </span>
                            <span className="font-mono text-muted-foreground">
                              {d.underImmunized} ({d.underImmunizedPct}%)
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${(d.underImmunized / maxUI) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-dropout">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Dropout rates
            </CardTitle>
            <Link
              href="/indicators/dropout"
              className="text-xs font-semibold text-primary hover:underline"
              data-testid="link-dropout-details"
            >
              Per-facility view →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {drLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !dr || dr.dtp1_dtp3.denom === 0 ? (
            <p className="text-sm text-muted-foreground">
              No DTP1 doses recorded yet — cannot compute dropout.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">DTP1 → DTP3</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold" data-testid="text-dropout-dtp3">
                      {dr.dtp1_dtp3.rate}%
                    </span>
                    <Badge variant="outline" className={dropoutBadgeClass(dr.dtp1_dtp3.rate)}>
                      {dr.dtp1_dtp3.rate > 10 ? "High" : dr.dtp1_dtp3.rate >= 5 ? "Watch" : "OK"}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {dr.dtp1_dtp3.num.toLocaleString()} DTP3 of {dr.dtp1_dtp3.denom.toLocaleString()} DTP1
                  </div>
                </div>
                <div className="rounded-xl border p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">DTP1 → MCV1</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold" data-testid="text-dropout-mcv1">
                      {dr.dtp1_mcv1.rate}%
                    </span>
                    <Badge variant="outline" className={dropoutBadgeClass(dr.dtp1_mcv1.rate)}>
                      {dr.dtp1_mcv1.rate > 10 ? "High" : dr.dtp1_mcv1.rate >= 5 ? "Watch" : "OK"}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {dr.dtp1_mcv1.num.toLocaleString()} MCV1 of {dr.dtp1_mcv1.denom.toLocaleString()} DTP1
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Top districts by DTP1→DTP3 dropout
                </p>
                {dr.dtp1_dtp3.byDistrict.slice(0, 4).map((d) => (
                  <div key={d.districtId} className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate text-foreground">{d.districtName}</span>
                    <Badge variant="outline" className={dropoutBadgeClass(d.rate)}>
                      {d.rate}%
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                WHO formula: (DTP1 − DTPn) / DTP1 × 100. Routine RI doses only (excludes campaign).
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type SupervisionVisitLite = {
  id: number;
  facilityId: number;
  scheduledDate: string;
  conductedDate: string | null;
  status: string;
  score: number | null;
};

function quarterStart(year: number, quarter: number) {
  return new Date(Date.UTC(year, (quarter - 1) * 3, 1));
}
function quarterEnd(year: number, quarter: number) {
  return new Date(Date.UTC(year, quarter * 3, 1));
}

interface TenantSummary { id: string; name: string; code: string; settings?: Record<string, any> | null }

function SupervisionCoverageByDistrictCard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [provinceFilter, setProvinceFilter] = useState<string>("all");
  const { data: visits, isLoading: loadingVisits } = useQuery<SupervisionVisitLite[]>({
    queryKey: ["/api/supervision-visits"],
  });
  const { data: facilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });
  const { data: districts } = useQuery<any[]>({
    queryKey: ["/api/districts"],
  });
  const { data: provinces } = useQuery<any[]>({
    queryKey: ["/api/provinces"],
  });
  const { data: tenant } = useQuery<TenantSummary>({
    queryKey: ["/api/me/tenant"],
    retry: false,
  });

  const provinceOptions = useMemo(() => {
    const present = new Set<number>();
    (districts || []).forEach((d: any) => {
      const pid = Number(d.provinceId);
      if (pid) present.add(pid);
    });
    return (provinces || [])
      .filter((p: any) => present.has(Number(p.id)))
      .map((p: any) => ({ id: Number(p.id), name: String(p.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [provinces, districts]);

  const selectedProvince = useMemo(() => {
    if (provinceFilter === "all") return null;
    const pid = Number(provinceFilter);
    return provinceOptions.find((p) => p.id === pid) || null;
  }, [provinceFilter, provinceOptions]);

  const provinceLabel = selectedProvince ? selectedProvince.name : "All provinces";

  const qStart = quarterStart(CURRENT_YEAR, CURRENT_QUARTER);
  const qEnd = quarterEnd(CURRENT_YEAR, CURRENT_QUARTER);
  const overdueThresholdMs = 90 * 86_400_000;
  const now = Date.now();

  const rows = useMemo(() => {
    if (!facilities || !districts) return [];
    const facByDistrict = new Map<number, Facility[]>();
    facilities.forEach((f) => {
      const did = Number((f as any).districtId);
      if (!did) return;
      const list = facByDistrict.get(did) || [];
      list.push(f);
      facByDistrict.set(did, list);
    });

    const visitsByFacility = new Map<number, SupervisionVisitLite[]>();
    (visits || []).forEach((v) => {
      const list = visitsByFacility.get(v.facilityId) || [];
      list.push(v);
      visitsByFacility.set(v.facilityId, list);
    });

    const filteredDistricts = selectedProvince
      ? districts.filter((d: any) => Number(d.provinceId) === selectedProvince.id)
      : districts;

    return filteredDistricts
      .map((d: any) => {
        const facs = facByDistrict.get(Number(d.id)) || [];
        const total = facs.length;
        let visitedThisQuarter = 0;
        let overdue = 0;
        let scoreSum = 0;
        let scoreN = 0;
        facs.forEach((f) => {
          const fv = visitsByFacility.get(Number(f.id)) || [];
          const conducted = fv
            .filter((v) => v.status === "conducted")
            .map((v) => ({ ...v, when: new Date(v.conductedDate || v.scheduledDate) }))
            .sort((a, b) => +b.when - +a.when);
          const inQuarter = conducted.some(
            (v) => v.when >= qStart && v.when < qEnd,
          );
          if (inQuarter) visitedThisQuarter++;
          const last = conducted[0];
          if (!last || now - +last.when > overdueThresholdMs) overdue++;
          if (last && typeof last.score === "number") {
            scoreSum += last.score;
            scoreN++;
          }
        });
        return {
          districtId: Number(d.id),
          districtName: d.name as string,
          total,
          visitedThisQuarter,
          overdue,
          avgScore: scoreN ? Math.round(scoreSum / scoreN) : null,
          visitedPct: total ? Math.round((visitedThisQuarter / total) * 100) : 0,
          overduePct: total ? Math.round((overdue / total) * 100) : 0,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => a.visitedPct - b.visitedPct || b.overduePct - a.overduePct);
  }, [facilities, districts, visits, qStart.getTime(), qEnd.getTime(), selectedProvince]);

  const totals = useMemo(() => {
    const totalFac = rows.reduce((s, r) => s + r.total, 0);
    const visited = rows.reduce((s, r) => s + r.visitedThisQuarter, 0);
    const overdue = rows.reduce((s, r) => s + r.overdue, 0);
    const scored = rows.filter((r) => r.avgScore !== null);
    const avg = scored.length
      ? Math.round(scored.reduce((s, r) => s + (r.avgScore || 0), 0) / scored.length)
      : null;
    return {
      totalFac,
      visited,
      overdue,
      visitedPct: totalFac ? Math.round((visited / totalFac) * 100) : 0,
      overduePct: totalFac ? Math.round((overdue / totalFac) * 100) : 0,
      avg,
    };
  }, [rows]);

  const quarterLabel = `Q${CURRENT_QUARTER} ${CURRENT_YEAR}`;
  const qStartIso = qStart.toISOString().slice(0, 10);
  const qEndIso = qEnd.toISOString().slice(0, 10);

  const tenantBrand = useMemo(() => {
    const tenantSettings = (tenant?.settings || {}) as Record<string, any>;
    const rawColor =
      typeof tenantSettings.brandColor === "string" ? tenantSettings.brandColor.trim() : "";
    const brandColor = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : "";
    const rawLogo =
      typeof tenantSettings.brandLogoDataUrl === "string"
        ? tenantSettings.brandLogoDataUrl.trim()
        : "";
    const brandLogo = /^data:image\/(png|jpe?g|svg\+xml|webp|gif);base64,/.test(rawLogo)
      ? rawLogo
      : "";
    return {
      tenantName: tenant?.name ?? "VaxPlan",
      brandColor,
      brandLogo,
      headingColor: brandColor || "#333",
    };
  }, [tenant?.name, tenant?.settings]);

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const handleExportCsv = () => {
    if (rows.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No districts with facilities yet.",
        variant: "destructive",
      });
      return;
    }
    const lines: string[] = [];
    lines.push(escapeCsv(tenantBrand.tenantName));
    lines.push(`Supervision coverage by district — ${quarterLabel}`);
    lines.push(`Province,${provinceLabel}`);
    lines.push(`Quarter window,${qStartIso} to ${qEndIso}`);
    lines.push(`Overdue threshold,No conducted visit in last 90 days`);
    lines.push(`Generated,${new Date().toISOString()}`);
    lines.push("");
    lines.push(
      ["District", "Facilities", `Visited ${quarterLabel} (count)`, `Visited ${quarterLabel} (%)`, "Overdue (count)", "Overdue (%)", "Avg last score (%)"]
        .map(escapeCsv)
        .join(","),
    );
    for (const r of rows) {
      lines.push(
        [
          r.districtName,
          r.total,
          r.visitedThisQuarter,
          `${r.visitedPct}%`,
          r.overdue,
          `${r.overduePct}%`,
          r.avgScore === null ? "" : `${r.avgScore}%`,
        ]
          .map(escapeCsv)
          .join(","),
      );
    }
    lines.push(
      [
        "TOTAL",
        totals.totalFac,
        totals.visited,
        `${totals.visitedPct}%`,
        totals.overdue,
        `${totals.overduePct}%`,
        totals.avg === null ? "" : `${totals.avg}%`,
      ]
        .map(escapeCsv)
        .join(","),
    );

    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const provinceSlug = selectedProvince
      ? `-${selectedProvince.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`
      : "";
    a.download = `supervision-by-district-Q${CURRENT_QUARTER}-${CURRENT_YEAR}${provinceSlug}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export ready",
      description: `${quarterLabel} supervision scorecard downloaded.`,
    });
  };

  const handleExportPdf = () => {
    if (rows.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No districts with facilities yet.",
        variant: "destructive",
      });
      return;
    }
    const escapeHtml = (val: any): string => {
      if (val === null || val === undefined) return "";
      return String(val)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };

    const generatedAt = new Date().toLocaleString();
    const bodyRows = rows
      .map(
        (r) => `<tr>
          <td>${escapeHtml(r.districtName)}</td>
          <td class="num">${r.total}</td>
          <td class="num">${r.visitedThisQuarter} / ${r.total} (${r.visitedPct}%)</td>
          <td class="num">${r.overdue} (${r.overduePct}%)</td>
          <td class="num">${r.avgScore === null ? "—" : `${r.avgScore}%`}</td>
        </tr>`,
      )
      .join("");

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Supervision coverage by district — ${escapeHtml(quarterLabel)}</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 11px; margin: 0; padding: 16px; }
  h1 { font-size: 18px; margin: 0 0 4px 0; color: ${tenantBrand.headingColor}; }
  .meta { color: #444; font-size: 10px; margin-bottom: 2px; }
  .header { border-bottom: 3px solid ${tenantBrand.headingColor}; padding-bottom: 8px; margin-bottom: 12px; display: flex; align-items: center; gap: 14px; }
  .header .brand-logo { max-height: 56px; max-width: 120px; object-fit: contain; }
  .header .header-text { flex: 1; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; page-break-inside: auto; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #bbb; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: ${tenantBrand.brandColor || "#f1f1f1"}; color: ${tenantBrand.brandColor ? "#fff" : "#111"}; font-weight: 600; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .total-row td { font-weight: 600; background: #f7f7f7; }
  .note { color: #555; font-size: 10px; margin-top: 8px; }
  .print-hint { background: #fffbe6; border: 1px solid #ffe58f; padding: 8px 12px; margin-bottom: 12px; font-size: 11px; }
  @media print { .print-hint { display: none; } }
</style>
</head>
<body>
  <div class="print-hint">Use your browser's <strong>Print</strong> dialog and choose "Save as PDF" to export.</div>
  <div class="header">
    ${tenantBrand.brandLogo ? `<img class="brand-logo" src="${escapeHtml(tenantBrand.brandLogo)}" alt="${escapeHtml(tenantBrand.tenantName)} logo" />` : ""}
    <div class="header-text">
      <h1>Supervision coverage by district</h1>
      <div class="meta"><strong>${escapeHtml(tenantBrand.tenantName)}</strong></div>
      <div class="meta">Province: <strong>${escapeHtml(provinceLabel)}</strong></div>
      <div class="meta">Quarter: <strong>${escapeHtml(quarterLabel)}</strong> (${escapeHtml(qStartIso)} to ${escapeHtml(qEndIso)})</div>
      <div class="meta">Generated: ${escapeHtml(generatedAt)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>District</th>
        <th class="num">Facilities</th>
        <th class="num">Visited ${escapeHtml(quarterLabel)}</th>
        <th class="num">Overdue (&gt;90d)</th>
        <th class="num">Avg last score</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
      <tr class="total-row">
        <td>Total</td>
        <td class="num">${totals.totalFac}</td>
        <td class="num">${totals.visited} / ${totals.totalFac} (${totals.visitedPct}%)</td>
        <td class="num">${totals.overdue} (${totals.overduePct}%)</td>
        <td class="num">${totals.avg === null ? "—" : `${totals.avg}%`}</td>
      </tr>
    </tbody>
  </table>
  <p class="note">"Visited this quarter" counts facilities with at least one conducted visit in the quarter window above. "Overdue" = no conducted visit in the last 90 days.</p>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    });
  </script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) {
      toast({
        title: "Pop-up blocked",
        description: "Allow pop-ups for this site to export the PDF.",
        variant: "destructive",
      });
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();

    toast({
      title: "PDF ready to print",
      description: `Use your browser's print dialog and choose "Save as PDF".`,
    });
  };

  return (
    <Card data-testid="card-supervision-by-district">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-indigo-500" />
            Supervision coverage by district
            <span className="text-xs font-normal text-muted-foreground ml-1">
              · {quarterLabel}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={provinceFilter} onValueChange={setProvinceFilter}>
              <SelectTrigger
                className="h-8 w-[180px] text-xs"
                data-testid="select-supervision-province"
              >
                <SelectValue placeholder="All provinces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-supervision-province-all">
                  All provinces
                </SelectItem>
                {provinceOptions.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={String(p.id)}
                    data-testid={`option-supervision-province-${p.id}`}
                  >
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              data-testid="button-export-supervision-csv"
              title="Download as CSV"
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPdf}
              disabled={rows.length === 0}
              data-testid="button-export-supervision-pdf"
              title="Open printable PDF view"
            >
              <FileText className="h-4 w-4 mr-1" />
              PDF
            </Button>
            <Link
              href="/supervision"
              className="text-xs font-semibold text-primary hover:underline"
              data-testid="link-supervision-all"
            >
              Open supervision →
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {loadingVisits ? (
          <Skeleton className="h-32 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No districts with facilities yet, or no visits scheduled.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="rounded-md border p-2">
                <div className="text-muted-foreground">Facilities</div>
                <div className="text-lg font-semibold">{totals.totalFac}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-muted-foreground">Visited this quarter</div>
                <div className="text-lg font-semibold text-emerald-600">{totals.visitedPct}%</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-muted-foreground">Overdue (&gt;90d)</div>
                <div className="text-lg font-semibold text-rose-600">{totals.overduePct}%</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-muted-foreground">Avg last score</div>
                <div className="text-lg font-semibold">
                  {totals.avg === null ? "—" : `${totals.avg}%`}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 px-2 font-medium">District</th>
                    <th className="py-2 px-2 font-medium text-right">Facilities</th>
                    <th className="py-2 px-2 font-medium text-right">Visited Q{CURRENT_QUARTER}</th>
                    <th className="py-2 px-2 font-medium text-right">Overdue</th>
                    <th className="py-2 px-2 font-medium text-right">Avg score</th>
                    <th className="py-2 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.districtId}
                      className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                      onClick={() => setLocation(`/supervision?districtId=${r.districtId}`)}
                      data-testid={`row-supervision-district-${r.districtId}`}
                    >
                      <td className="py-2 px-2 font-medium">{r.districtName}</td>
                      <td className="py-2 px-2 text-right">{r.total}</td>
                      <td className="py-2 px-2 text-right">
                        <Badge
                          variant="outline"
                          className={
                            r.visitedPct >= 80
                              ? "border-emerald-500 text-emerald-600"
                              : r.visitedPct >= 50
                              ? "border-amber-500 text-amber-600"
                              : "border-rose-500 text-rose-600"
                          }
                        >
                          {r.visitedThisQuarter}/{r.total} · {r.visitedPct}%
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Badge
                          variant="outline"
                          className={
                            r.overduePct === 0
                              ? "border-emerald-500 text-emerald-600"
                              : r.overduePct <= 25
                              ? "border-amber-500 text-amber-600"
                              : "border-rose-500 text-rose-600"
                          }
                        >
                          {r.overdue} ({r.overduePct}%)
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right">
                        {r.avgScore === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={
                              r.avgScore >= 80
                                ? "text-emerald-600 font-medium"
                                : r.avgScore >= 60
                                ? "text-amber-600 font-medium"
                                : "text-rose-600 font-medium"
                            }
                          >
                            {r.avgScore}%
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-xs text-muted-foreground">
                        View →
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              "Visited this quarter" counts facilities with at least one conducted visit between{" "}
              {qStart.toISOString().slice(0, 10)} and {qEnd.toISOString().slice(0, 10)}. "Overdue" =
              no conducted visit in the last 90 days. Click a district to see its facilities.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [liveTime, setLiveTime] = useState(new Date());
  const [deepDiveTab, setDeepDiveTab] = useState("supervision");

  const facilityLocked = isFacilityScopedRole(user?.role) && !!user?.facilityId;

  const [coverageFilters, setCoverageFilters] = useState(() => {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    let stored: { quarter?: number; year?: number; facilityId?: number | null } = {};
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(COVERAGE_STORAGE_KEY);
        if (raw) stored = JSON.parse(raw);
      } catch {}
    }
    const parseInt10 = (v: string | null) =>
      v && /^\d+$/.test(v) ? parseInt(v, 10) : undefined;

    const quarter =
      parseInt10(params.get("quarter")) ?? stored.quarter ?? CURRENT_QUARTER;
    const year = parseInt10(params.get("year")) ?? stored.year ?? CURRENT_YEAR;

    let facilityId: number | null;
    if (facilityLocked) {
      facilityId = Number(user!.facilityId);
    } else {
      const fp = params.get("facilityId");
      if (fp === "all") facilityId = null;
      else if (fp && /^\d+$/.test(fp)) facilityId = parseInt(fp, 10);
      else if (stored.facilityId === null) facilityId = null;
      else if (typeof stored.facilityId === "number") facilityId = stored.facilityId;
      else facilityId = null;
    }
    return {
      quarter: quarter >= 1 && quarter <= 4 ? quarter : CURRENT_QUARTER,
      year,
      facilityId,
    };
  });

  const displayName = useMemo(() => {
    if (user?.firstName || user?.lastName) {
      return [user.firstName, user.lastName].filter(Boolean).join(" ");
    }
    if (user?.email) {
      return user.email.split("@")[0];
    }
    return "Officer";
  }, [user]);

  // Dynamic live date & time updating every second
  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const greeting = useMemo(() => {
    const hr = liveTime.getHours();
    if (hr < 12) return "Good morning";
    if (hr < 18) return "Good afternoon";
    return "Good evening";
  }, [liveTime]);

  const formattedTime = useMemo(() => {
    return (
      liveTime.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }) +
      " � " +
      liveTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  }, [liveTime]);

  const { data: facilities, isLoading: loadingFacilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
    staleTime: 10 * 60 * 1000, // 10 min - facility list changes rarely
  });

  /* Original Code:
  const { data: villages, isLoading: loadingVillages } = useQuery<Village[]>({
    queryKey: ["/api/villages/summary"],
    staleTime: 10 * 60 * 1000, // 10 min - village list changes rarely
  });

  const { data: sessions, isLoading: loadingSessions } = useQuery<SessionPlan[]>({
    queryKey: ["/api/sessions"],
    staleTime: 5 * 60 * 1000,
  });

  // stats is computed locally from facilities/villages/sessions/population below
  // to avoid a redundant server round-trip that fetches the same data again
  const { data: stats } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
    staleTime: 10 * 60 * 1000,
    // Not in isLoading - we compute locally when data is available
  });

  const { data: budgetItems, isLoading: loadingBudget } = useQuery<BudgetItem[]>({
    queryKey: ["/api/budget-items"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: approvals, isLoading: loadingApprovals } = useQuery<ApprovalRequest[]>({
    queryKey: ["/api/approvals"],
    enabled: canApproveSessionPlan(user),
    retry: false,
    staleTime: 2 * 60 * 1000,
  });

  const { data: populationDataList } = useQuery<PopulationData[]>({
    queryKey: ["/api/population"],
    staleTime: 10 * 60 * 1000, // population data rarely changes intra-session
  });
  */
  // villages query removed to optimize dashboard performance for national level
  const villages: Village[] = [];

  const { data: sessions, isLoading: loadingSessions } = useQuery<SessionPlan[]>({
    queryKey: ["/api/sessions"],
  });

  const scopedFacilityId = facilityLocked ? Number(user?.facilityId) : null;
  const statsUrl = scopedFacilityId ? `/api/stats?facilityId=${scopedFacilityId}&scope=assigned` : "/api/stats";
  const populationUrl = scopedFacilityId
    ? `/api/population?excludeVillages=true&facilityId=${scopedFacilityId}`
    : "/api/population?excludeVillages=true";
  const stockLedgerUrl = scopedFacilityId ? `/api/stock/ledger?facilityId=${scopedFacilityId}` : "/api/stock/ledger";

  const { data: stats, isLoading: loadingStats } = useQuery<StatsData>({
    queryKey: [statsUrl],
  });

  const { data: budgetItems, isLoading: loadingBudget } = useQuery<BudgetItem[]>({
    queryKey: ["/api/budget-items"],
  });

  const { data: approvals, isLoading: loadingApprovals } = useQuery<ApprovalRequest[]>({
    queryKey: ["/api/approvals"],
    enabled: canApproveSessionPlan(user),
    retry: false,
  });

  const { data: populationDataList, isLoading: loadingPopulation } = useQuery<PopulationData[]>({
    queryKey: [populationUrl],
  });

  const { data: allDistricts } = useQuery<any[]>({
    queryKey: ["/api/districts"],
    staleTime: 30 * 60 * 1000, // district list is near-static
  });

  const { data: provinces } = useQuery<any[]>({
    queryKey: ["/api/provinces"],
    staleTime: 30 * 60 * 1000, // province list is near-static
  });

  const { data: stockTransactions } = useQuery<StockTransaction[]>({
    queryKey: [stockLedgerUrl],
    staleTime: 5 * 60 * 1000,
  });

  const { data: vaccineConfigs } = useQuery<CatalogueVaccine[]>({
    queryKey: ["/api/catalogue/vaccines"],
    staleTime: 30 * 60 * 1000, // vaccine config is near-static
  });

  const stockAlertSummaries = useMemo(() => {
    if (!stockTransactions) return [];
    const threshold = loadStockThreshold();
    return summarizeFacilityAlerts(stockTransactions, vaccineConfigs, threshold);
  }, [stockTransactions, vaccineConfigs]);

  const scopedStockAlerts = useMemo(() => {
    const list = user?.facilityId
      ? stockAlertSummaries.filter(
          (s) => s.facilityId === Number(user.facilityId),
        )
      : stockAlertSummaries;
    const totals = list.reduce(
      (acc, s) => {
        acc.lowStock += s.lowStockAntigens.length;
        acc.outOfStock += s.outOfStockAntigens.length;
        acc.nearExpiry += s.nearExpiryBatches;
        acc.expiringSoon += s.expiringSoonBatches;
        acc.expired += s.expiredBatches;
        if (
          s.lowStockAntigens.length +
            s.outOfStockAntigens.length +
            s.nearExpiryBatches >
          0
        )
          acc.facilitiesAtRisk++;
        return acc;
      },
      {
        lowStock: 0,
        outOfStock: 0,
        nearExpiry: 0,
        expiringSoon: 0,
        expired: 0,
        facilitiesAtRisk: 0,
      },
    );
    return { list, totals };
  }, [stockAlertSummaries, user?.facilityId]);

  const topAlertFacilities = useMemo(() => {
    if (!facilities || user?.facilityId) return [];
    const fmap = new Map(facilities.map((f) => [Number(f.id), f.name]));
    return [...scopedStockAlerts.list]
      .map((s) => ({
        ...s,
        name: fmap.get(s.facilityId) ?? `Facility #${s.facilityId}`,
        score:
          s.outOfStockAntigens.length * 3 +
          s.lowStockAntigens.length * 2 +
          s.expiringSoonBatches * 2 +
          s.nearExpiryBatches,
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [scopedStockAlerts.list, facilities, user?.facilityId]);

  const coverageQueryString = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("quarter", String(coverageFilters.quarter));
    qs.set("year", String(coverageFilters.year));
    if (coverageFilters.facilityId !== null) {
      qs.set("facilityId", String(coverageFilters.facilityId));
    }
    return qs.toString();
  }, [coverageFilters]);

  const { data: coverage, isLoading: loadingCoverage } = useQuery<CoverageData>({
    queryKey: [`/api/coverage?${coverageQueryString}`],
  });

  const quarterlyReviewCoverageUrl = scopedFacilityId
    ? `/api/indicators/quarterly-review-coverage?year=${CURRENT_YEAR}&quarter=${CURRENT_QUARTER}&facilityId=${scopedFacilityId}`
    : `/api/indicators/quarterly-review-coverage?year=${CURRENT_YEAR}&quarter=${CURRENT_QUARTER}`;
  const { data: quarterlyReviewCoverage } = useQuery<QuarterlyReviewCoverage>({
    queryKey: [quarterlyReviewCoverageUrl],
    staleTime: 5 * 60 * 1000,
  });

  // Persist coverage filter selection across reloads (URL + localStorage).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        COVERAGE_STORAGE_KEY,
        JSON.stringify(coverageFilters),
      );
    } catch {}

    const params = new URLSearchParams(window.location.search);
    params.set("quarter", String(coverageFilters.quarter));
    params.set("year", String(coverageFilters.year));
    if (facilityLocked) {
      params.delete("facilityId");
    } else if (coverageFilters.facilityId === null) {
      params.set("facilityId", "all");
    } else {
      params.set("facilityId", String(coverageFilters.facilityId));
    }
    const next = `${window.location.pathname}?${params.toString()}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      setLocation(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverageFilters, facilityLocked]);

  // Sync state in if the user opens a fresh URL with different params.
  useEffect(() => {
    const params = new URLSearchParams(searchString || "");
    const qRaw = params.get("quarter");
    const yRaw = params.get("year");
    const fRaw = params.get("facilityId");
    setCoverageFilters((prev) => {
      const next = { ...prev };
      if (qRaw && /^[1-4]$/.test(qRaw)) next.quarter = parseInt(qRaw, 10);
      if (yRaw && /^\d{4}$/.test(yRaw)) next.year = parseInt(yRaw, 10);
      if (!facilityLocked) {
        if (fRaw === "all") next.facilityId = null;
        else if (fRaw && /^\d+$/.test(fRaw)) next.facilityId = parseInt(fRaw, 10);
      } else if (user?.facilityId) {
        next.facilityId = Number(user.facilityId);
      }
      if (
        next.quarter === prev.quarter &&
        next.year === prev.year &&
        next.facilityId === prev.facilityId
      ) {
        return prev;
      }
      return next;
    });
  }, [searchString, facilityLocked, user?.facilityId]);

  const facilityOptions = useMemo<Facility[]>(() => {
    if (!facilities) return [];
    return [...facilities].sort((a: Facility, b: Facility) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  }, [facilities]);

  const selectedFacilityName = useMemo(() => {
    if (coverageFilters.facilityId === null) return "All facilities";
    const f = facilityOptions.find(
      (f: Facility) => Number(f.id) === coverageFilters.facilityId,
    );
    return f?.name || `Facility #${coverageFilters.facilityId}`;
  }, [coverageFilters.facilityId, facilityOptions]);

  const yearOptions = useMemo<number[]>(() => {
    const years: number[] = [];
    for (let y = CURRENT_YEAR - 3; y <= CURRENT_YEAR + 1; y++) years.push(y);
    if (!years.includes(coverageFilters.year)) years.push(coverageFilters.year);
    return years.sort((a, b) => b - a);
  }, [coverageFilters.year]);

  const htrVillages = stats?.htrVillages || 0;
  const pendingSessions = sessions?.filter((s) => s.status === "planned")?.length || 0;

  // Task #51: surface sessions that should already have been implemented
  // (pending or in-progress with a scheduled date today or earlier). These
  // are the ones HCWs need to either report on or replan.
  const sessionsPendingImplementation = useMemo(() => {
    if (!sessions) return { total: 0, overdue: 0 };
    let total = 0;
    let overdue = 0;
    for (const s of sessions) {
      const lc = deriveSessionLifecycle(s as any);
      if (lc.phase === "pending" || lc.phase === "in_progress") {
        total++;
        if (lc.isOverdue) overdue++;
      }
    }
    return { total, overdue };
  }, [sessions]);

  // Resolve scoped annual population for the logged entity
  const annualPopulationDisplay = useMemo(() => {
    if (!populationDataList) {
      return { value: stats?.totalPopulation || 0, label: "Target Population" };
    }

    const availableYears = Array.from(new Set(populationDataList.map((p) => p.year))).sort(
      (a, b) => b - a
    );
    const yearsToScan = availableYears.length > 0 ? availableYears : [2026, 2025, 2024, 2023, 2022];

    const findRecordForYears = (criteriaFn: (p: PopulationData) => boolean) => {
      for (const year of yearsToScan) {
        const found = populationDataList.find((p) => p.year === year && criteriaFn(p));
        if (found) {
          return found;
        }
      }
      return null;
    };

    // 1. Facility level
    if (user?.facilityId) {
      const facilityIdNum = Number(user.facilityId);
      const record = findRecordForYears(
        (p) => Number(p.facilityId) === facilityIdNum && !p.villageId
      );
      if (record) {
        return {
          value: record.totalPopulation,
          label: `Facility Annual (${record.year} · ${record.source.toUpperCase()})`,
        };
      }
    }

    // 2. District level
    let targetDistrictId: number | null = null;
    if (user?.districtId) {
      targetDistrictId = Number(user.districtId);
    } else if (user?.facilityId && facilities) {
      const facilityIdNum = Number(user.facilityId);
      const facility = facilities.find((f) => Number(f.id) === facilityIdNum);
      if (facility?.districtId) {
        targetDistrictId = Number(facility.districtId);
      }
    }

    if (targetDistrictId) {
      const record = findRecordForYears(
        (p) => Number(p.districtId) === targetDistrictId && !p.facilityId && !p.villageId
      );
      if (record) {
        return {
          value: record.totalPopulation,
          label: `District Annual (${record.year} · ${record.source.toUpperCase()})`,
        };
      }
    }

    // 3. Provincial level
    let targetProvinceId: number | null = null;
    if (user?.provinceId) {
      targetProvinceId = Number(user.provinceId);
    } else if (targetDistrictId && allDistricts) {
      const district = allDistricts.find((d) => Number(d.id) === targetDistrictId);
      if (district?.provinceId) {
        targetProvinceId = Number(district.provinceId);
      }
    }

    if (targetProvinceId) {
      const record = findRecordForYears(
        (p) => Number(p.provinceId) === targetProvinceId && !p.districtId && !p.facilityId && !p.villageId
      );
      if (record) {
        return {
          value: record.totalPopulation,
          label: `Provincial Annual (${record.year} · ${record.source.toUpperCase()})`,
        };
      }
    }

    // 4. National level
    const record = findRecordForYears(
      (p) => !p.provinceId && !p.districtId && !p.facilityId && !p.villageId
    );
    if (record) {
      return {
        value: record.totalPopulation,
        label: `National Annual (${record.year} · ${record.source.toUpperCase()})`,
      };
    }

    // 5. Fallback
    return {
      value: stats?.totalPopulation || 0,
      label: "Target Population",
    };
  }, [user, populationDataList, facilities, allDistricts, provinces, stats]);

  // ─── Dynamic Microplanning Progress Metrics ───────────────────────────────
  
  // 1. Sessions Conducted / Completed
  const completedSessionsCount = useMemo(() => {
    if (!sessions) return 0;
    return sessions.filter((s) => s.status === "conducted" || s.status === "completed").length;
  }, [sessions]);

  const totalSessionsCount = useMemo(() => {
    if (!sessions) return 0;
    return sessions.length;
  }, [sessions]);

  const sessionsPercentage = useMemo(() => {
    if (totalSessionsCount === 0) return 0;
    return Math.round((completedSessionsCount / totalSessionsCount) * 100);
  }, [completedSessionsCount, totalSessionsCount]);

  /* Original Code:
  // 2. Catchment Villages Assigned to Facilities
  const assignedVillagesCount = useMemo(() => {
    if (!villages) return 0;
    return villages.filter((v) => v.assignedFacilityId !== null).length;
  }, [villages]);

  const totalVillagesCount = useMemo(() => {
    if (!villages) return 0;
    return villages.length;
  }, [villages]);

  const villagesPercentage = useMemo(() => {
    if (totalVillagesCount === 0) return 0;
    return Math.round((assignedVillagesCount / totalVillagesCount) * 100);
  }, [assignedVillagesCount, totalVillagesCount]);
  */
  // 2. Catchment Villages Assigned to Facilities (Using precomputed backend stats)
  const assignedVillagesCount = useMemo(() => {
    return stats?.assignedVillages || 0;
  }, [stats]);

  const totalVillagesCount = useMemo(() => {
    return stats?.totalVillages || 0;
  }, [stats]);

  const villagesPercentage = useMemo(() => {
    if (totalVillagesCount === 0) return 0;
    return Math.round((assignedVillagesCount / totalVillagesCount) * 100);
  }, [assignedVillagesCount, totalVillagesCount]);

  // 3. Approved Budgets
  const totalBudgetSum = useMemo(() => {
    if (!budgetItems) return 0;
    return budgetItems.reduce((sum, item) => sum + Number(item.totalCost), 0);
  }, [budgetItems]);

  const approvedBudgetSum = useMemo(() => {
    if (!budgetItems) return 0;
    return budgetItems
      .filter((item) => item.approvalStatus === "approved")
      .reduce((sum, item) => sum + Number(item.totalCost), 0);
  }, [budgetItems]);

  const budgetPercentage = useMemo(() => {
    if (totalBudgetSum === 0) return 0;
    return Math.round((approvedBudgetSum / totalBudgetSum) * 100);
  }, [approvedBudgetSum, totalBudgetSum]);

  const denominatorConfidenceScore = useMemo(() => {
    if (!populationDataList?.length) return 0;
    const scored = populationDataList
      .map((p) => Number((p as any).confidenceScore))
      .filter((n) => Number.isFinite(n));
    if (scored.length === 0) return 50;
    return Math.round(scored.reduce((sum, n) => sum + n, 0) / scored.length);
  }, [populationDataList]);

  const facilityPlanCoveragePct = useMemo(() => {
    const total = stats?.totalFacilities || facilities?.length || 0;
    if (!total) return 0;
    return Math.round(((stats?.facilitiesWithApprovedPlans || 0) / total) * 100);
  }, [stats, facilities]);

  const stockReadinessPct = useMemo(() => {
    const total = stats?.activeFacilities || facilities?.length || 0;
    if (!total) return 100;
    const risk = Math.min(total, scopedStockAlerts.totals.facilitiesAtRisk || 0);
    return Math.max(0, Math.round(((total - risk) / total) * 100));
  }, [stats, facilities, scopedStockAlerts.totals.facilitiesAtRisk]);

  const planHealthMetrics = useMemo(
    () => [
      {
        label: "Denominator confidence",
        score: denominatorConfidenceScore,
        detail: `${populationDataList?.length || 0} population records in scope`,
        href: "/population",
      },
      {
        label: "Catchment assignment",
        score: villagesPercentage,
        detail: `${assignedVillagesCount.toLocaleString()} of ${totalVillagesCount.toLocaleString()} communities linked to facilities`,
        href: "/map",
      },
      {
        label: "Sessions completed",
        score: sessionsPercentage,
        detail: `${completedSessionsCount.toLocaleString()} of ${totalSessionsCount.toLocaleString()} sessions conducted`,
        href: "/all-sessions",
      },
      {
        label: "Approved facility plans",
        score: facilityPlanCoveragePct,
        detail: `${stats?.facilitiesWithApprovedPlans || 0} of ${stats?.totalFacilities || facilities?.length || 0} facilities have approved plans`,
        href: "/approvals",
      },
      {
        label: "Budget approval",
        score: budgetPercentage,
        detail: `$${approvedBudgetSum.toLocaleString()} approved of $${totalBudgetSum.toLocaleString()} planned`,
        href: "/microplans/routine",
      },
      {
        label: "Quarterly review coverage",
        score: quarterlyReviewCoverage?.coveragePct ?? 0,
        detail: `${quarterlyReviewCoverage?.facilitiesWithReview || 0} of ${quarterlyReviewCoverage?.totalFacilities || 0} facilities have Q${CURRENT_QUARTER} review notes`,
        href: "/clients/defaulters",
      },
      {
        label: "Stock readiness",
        score: stockReadinessPct,
        detail: `${scopedStockAlerts.totals.facilitiesAtRisk} facilities currently have active stock risk`,
        href: "/stock",
      },
    ],
    [
      denominatorConfidenceScore,
      populationDataList,
      villagesPercentage,
      assignedVillagesCount,
      totalVillagesCount,
      sessionsPercentage,
      completedSessionsCount,
      totalSessionsCount,
      facilityPlanCoveragePct,
      stats,
      facilities,
      budgetPercentage,
      approvedBudgetSum,
      totalBudgetSum,
      quarterlyReviewCoverage,
      stockReadinessPct,
      scopedStockAlerts.totals.facilitiesAtRisk,
    ],
  );

  // 4. Pending Approvals list
  const pendingApprovals = useMemo(() => {
    if (!approvals) return [];
    return approvals.filter((a) => a.status === "pending");
  }, [approvals]);

  // 5. Recent Context-aware Activity Feed
  const recentActivities = useMemo(() => {
    const list = [];
    
    if (sessions && sessions.length > 0) {
      const sorted = [...sessions].sort((a, b) => b.id - a.id).slice(0, 2);
      sorted.forEach((s) => {
        list.push({
          action: s.status === "planned" ? "Microplan drafted" : `Session marked ${s.status}`,
          facility: s.name,
          time: "Just now",
          status: s.approvalStatus || "draft",
        });
      });
    }
    
    if (budgetItems && budgetItems.length > 0) {
      const sorted = [...budgetItems].sort((a, b) => b.id - a.id).slice(0, 2);
      sorted.forEach((b) => {
        list.push({
          action: `Budget item: ${b.description}`,
          facility: `Allocated cost: $${Number(b.totalCost).toLocaleString()}`,
          time: "Recently updated",
          status: b.approvalStatus || "draft",
        });
      });
    }

    // Standard Fallbacks
    if (list.length < 4) {
      list.push(
        {
          action: "HTR assessment completed",
          facility: "Hilltop Aid Post",
          time: "2 hours ago",
          status: "pending",
        },
        {
          action: "Population data updated",
          facility: "Mountview Health Centre",
          time: "5 hours ago",
          status: "approved",
        }
      );
    }
    
    return list.slice(0, 4);
  }, [sessions, budgetItems]);

  // Only block render on the truly critical first-paint queries.
  // Secondary data (population, districts, provinces, stock, stats) renders progressively.
  const isLoading =
    loadingFacilities ||
    loadingSessions ||
    loadingBudget;

  const coverageBarColor = (pct: number) => {
    if (pct >= 80) return "bg-emerald-500";
    if (pct >= 50) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              Q{coverageFilters.quarter} {coverageFilters.year} dashboard
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {greeting}, {displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.facilityId && facilities?.find((f) => f.id === user.facilityId)?.name
                ? facilities.find((f) => f.id === user.facilityId)?.name
                : "All facilities"} - Focus on missed children, plan readiness, and the next action to unblock service delivery.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href="/microplans/routine">Plan sessions</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/clients/defaulters">Review defaulters</Link>
            </Button>
            <Badge variant="outline" className="gap-1 px-3 py-1.5 font-mono">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {formattedTime}
            </Badge>
          </div>
        </div>
      </div>

      <Card data-testid="card-dashboard-navigation">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Dashboard navigation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Equity signals", href: "#equity", icon: AlertTriangle, detail: "Zero-dose and dropout" },
              { label: "Operations", href: "#operations", icon: Calendar, detail: "Sessions and approvals" },
              { label: "Coverage", href: "#coverage", icon: Syringe, detail: "Antigen progress" },
              { label: "Map", href: "#map", icon: Building2, detail: "Facilities and catchments" },
              { label: "Missed communities", href: "/missed-communities", icon: Users, detail: "No recent contact" },
              { label: "Stock ledger", href: "/stock", icon: Package, detail: "Supply risks" },
              { label: "Approvals", href: "/approvals", icon: CheckCircle2, detail: "Plans awaiting review" },
              { label: "Reports", href: "/reports", icon: FileText, detail: "Exports and reviews" },
            ].map((item) => {
              const Icon = item.icon;
              const content = (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-3 transition-colors hover:border-primary hover:bg-muted/35">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{item.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.detail}</div>
                  </div>
                </div>
              );
              return item.href.startsWith("#") ? (
                <a key={item.label} href={item.href} className="block">
                  {content}
                </a>
              ) : (
                <Link key={item.label} href={item.href} className="block">
                  {content}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <section id="equity" className="space-y-4" data-testid="section-equity-first-dashboard">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Equity command center</h2>
            <p className="text-sm text-muted-foreground">
              Start here: zero-dose, under-immunized, dropout, denominator confidence, and plan readiness are the primary dashboard signals.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/missed-communities">Open missed communities</Link>
          </Button>
        </div>
        <ImmunizationIndicatorCards />
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <PlanHealthCard metrics={planHealthMetrics} />
          <DenominatorConfidenceCard
            records={populationDataList}
            fallbackPopulation={annualPopulationDisplay.value}
          />
        </div>
      </section>

      <section id="operations" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Operations snapshot</h2>
            <p className="text-sm text-muted-foreground">A compact view of the work queue. Detailed readiness now lives in Plan Health above.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            [1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatsCard
                title="Planned Sessions"
                value={pendingSessions}
                subtitle="Sessions pending this quarter"
                icon={Calendar}
                href="/microplans/routine"
                testId="stats-planned-sessions"
              />
              <StatsCard
                title="Pending Implementation"
                value={sessionsPendingImplementation.total}
                subtitle={
                  sessionsPendingImplementation.overdue > 0
                    ? `${sessionsPendingImplementation.overdue} overdue - needs attention`
                    : "Sessions to conduct or report"
                }
                icon={Clock}
                href="/microplans/routine"
                testId="link-pending-implementation"
              />
              <StatsCard
                title="Pending Review"
                value={stats?.submittedPlans || 0}
                subtitle={`${stats?.approvedPlans || 0} approved - ${stats?.autoApprovedPlans || 0} auto-approved`}
                icon={CheckCircle2}
                href="/approvals"
                testId="stats-pending-review"
              />
              <StatsCard
                title="Stock Alerts"
                value={
                  scopedStockAlerts.totals.lowStock +
                  scopedStockAlerts.totals.outOfStock +
                  scopedStockAlerts.totals.nearExpiry
                }
                subtitle={
                  user?.facilityId
                    ? `${scopedStockAlerts.totals.lowStock + scopedStockAlerts.totals.outOfStock} low/out - ${scopedStockAlerts.totals.nearExpiry} expiring <=60d`
                    : `${scopedStockAlerts.totals.facilitiesAtRisk} facilities at risk - ${scopedStockAlerts.totals.expiringSoon} batches <=30d`
                }
                icon={Package}
                href="/stock"
                testId="link-stock-alerts"
              />
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          {(scopedStockAlerts.totals.lowStock + scopedStockAlerts.totals.outOfStock + scopedStockAlerts.totals.nearExpiry > 0) && (
            <Card data-testid="card-stock-alerts">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-amber-500" />
                    Supply risks
                    <TooltipProvider>
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-help">
                            <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[300px] text-xs leading-relaxed z-50">
                          Counts represent facility-level incidents, not distinct antigen names.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                  <Link href="/stock" className="text-xs font-semibold text-primary hover:underline" data-testid="link-open-stock-ledger">
                    Open ledger
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: "Out", value: scopedStockAlerts.totals.outOfStock, tone: "text-rose-600", note: "stockouts" },
                    { label: "Low", value: scopedStockAlerts.totals.lowStock, tone: "text-amber-600", note: "low stock" },
                    { label: "<=30d", value: scopedStockAlerts.totals.expiringSoon, tone: "text-rose-600", note: "expiring" },
                    { label: "<=60d", value: scopedStockAlerts.totals.nearExpiry, tone: "text-amber-600", note: "expiring" },
                  ].map((metric) => (
                    <Link key={metric.label} href="/stock" className="block rounded-lg border p-3 transition-colors hover:border-primary">
                      <p className="text-[11px] uppercase font-semibold text-muted-foreground">{metric.label}</p>
                      <p className={`text-2xl font-bold ${metric.tone}`}>{metric.value}</p>
                      <p className="text-[11px] text-muted-foreground">{metric.note}</p>
                    </Link>
                  ))}
                </div>
                {topAlertFacilities.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Highest-risk facilities</p>
                    {topAlertFacilities.map((f) => (
                      <div key={f.facilityId} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2" data-testid={`row-stock-alert-${f.facilityId}`}>
                        <span className="truncate text-sm font-medium text-foreground">{f.name}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {f.outOfStockAntigens.length > 0 && <Badge variant="outline" className="border-rose-500 text-rose-600 bg-rose-500/10 text-[10px]">{f.outOfStockAntigens.length} out</Badge>}
                          {f.lowStockAntigens.length > 0 && <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10 text-[10px]">{f.lowStockAntigens.length} low</Badge>}
                          {f.expiringSoonBatches > 0 && <Badge variant="outline" className="border-rose-500 text-rose-600 bg-rose-500/10 text-[10px]">{f.expiringSoonBatches} {"<=30d"}</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Approval queue</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-3">
                {pendingApprovals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-6 text-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    <p className="mt-2 text-sm font-semibold text-foreground">No pending approvals</p>
                    <p className="max-w-[240px] text-xs text-muted-foreground">Microplans and budgets are clear for now.</p>
                  </div>
                ) : (
                  pendingApprovals.slice(0, 4).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold capitalize text-foreground">{item.entityType.replace(/_/g, " ")}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3 text-primary" />
                          Submitted {new Date(item.submittedAt || "").toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 capitalize text-xs">{item.currentLevel}</Badge>
                    </div>
                  ))
                )}
                <Button variant="outline" className="w-full gap-1" asChild data-testid="button-view-approvals">
                  <Link href="/approvals">
                    Open approvals
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="coverage" className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Syringe className="h-5 w-5 text-primary" />
                Vaccine coverage
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={String(coverageFilters.quarter)} onValueChange={(v) => setCoverageFilters((p) => ({ ...p, quarter: parseInt(v, 10) }))}>
                  <SelectTrigger className="h-8 w-[110px]" data-testid="select-coverage-quarter">
                    <SelectValue placeholder="Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={String(coverageFilters.year)} onValueChange={(v) => setCoverageFilters((p) => ({ ...p, year: parseInt(v, 10) }))}>
                  <SelectTrigger className="h-8 w-[110px]" data-testid="select-coverage-year">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
                {facilityLocked ? (
                  <Badge variant="outline" data-testid="badge-coverage-facility-locked">{selectedFacilityName}</Badge>
                ) : (
                  <Select value={coverageFilters.facilityId === null ? "all" : String(coverageFilters.facilityId)} onValueChange={(v) => setCoverageFilters((p) => ({ ...p, facilityId: v === "all" ? null : parseInt(v, 10) }))}>
                    <SelectTrigger className="h-8 w-[200px]" data-testid="select-coverage-facility">
                      <SelectValue placeholder="Facility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All facilities</SelectItem>
                      {facilityOptions.map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {coverage && <Badge variant="secondary">{coverage.totals.coveragePct}% overall</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {loadingCoverage ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !coverage || coverage.vaccines.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-6 text-center">
                <Syringe className="h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-semibold text-foreground">No vaccine targets set</p>
                <p className="max-w-[320px] text-xs text-muted-foreground">Add vaccine requirements for this quarter to track coverage against target population.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {coverage.vaccines.map((v) => (
                  <div key={v.vaccineName} className="space-y-2 rounded-lg border bg-card p-3" data-testid={`coverage-${v.vaccineName}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{v.vaccineName}</span>
                      <span className="font-mono text-base font-bold text-foreground">{v.coveragePct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full transition-all duration-500 ${coverageBarColor(v.coveragePct)}`} style={{ width: `${Math.min(v.coveragePct, 100)}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{v.administered.toLocaleString()} administered of {v.targetPopulation.toLocaleString()} target</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="map" className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Facility and catchment map</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-80">
              <DeferredDashboardMap facilities={facilities || []} villages={villages || []} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">Recent activity</CardTitle>
              <Button variant="ghost" size="sm" asChild data-testid="button-view-all-activity">
                <Link href="/reports">View reports</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity, i) => (
                <div key={i} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{activity.action}</p>
                    <p className="truncate text-xs text-muted-foreground">{activity.facility}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                  <Badge variant={activity.status === "approved" ? "secondary" : "outline"} className="shrink-0 text-xs capitalize">
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {canViewSiteAnalytics(user) && <SiteActivityPanel />}

      <Tabs value={deepDiveTab} onValueChange={setDeepDiveTab} className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Deep dives</h2>
            <p className="text-sm text-muted-foreground">Detailed analytics that are not repeated in the executive dashboard.</p>
          </div>
          <TabsList className="w-fit">
            <TabsTrigger value="supervision">Supervision</TabsTrigger>
            <TabsTrigger value="vgie">VGIE analytics</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="supervision" className="space-y-6 focus-visible:outline-none">
          <SupervisionCoverageByDistrictCard />
        </TabsContent>
        <TabsContent value="vgie" className="focus-visible:outline-none">
          {deepDiveTab === "vgie" && (
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
              <VgieDashboard />
            </Suspense>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
