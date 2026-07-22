import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Filter,
  MapPinned,
  Search,
  ShieldCheck,
  Syringe,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BudgetItem,
  Facility,
  MobilizationActivity,
  PopulationData,
  SessionPlan,
  SupervisionVisit,
  VaccineRequirement,
  Village,
} from "@shared/schema";
type QuarterlyReview = {
  id: number;
  facilityId: number;
  year: number;
  quarter: number;
  updatedAt: string | null;
};
type HealthMetric = {
  key: string;
  label: string;
  met: boolean;
  detail: string;
  href: string;
};
const CURRENT_DATE = new Date();
const CURRENT_YEAR = CURRENT_DATE.getUTCFullYear();
const CURRENT_QUARTER = Math.floor(CURRENT_DATE.getUTCMonth() / 3) + 1;
function scoreClass(score: number) {
  if (score >= 80) return "border-emerald-500 text-emerald-700 bg-emerald-500/10";
  if (score >= 60) return "border-amber-500 text-amber-700 bg-amber-500/10";
  return "border-rose-500 text-rose-700 bg-rose-500/10";
}
function getSessionFacilityId(session: SessionPlan): number | null {
  return Number((session as any).facilityId ?? (session as any).healthFacilityId ?? null) || null;
}
function isConducted(session: SessionPlan) {
  const status = String((session as any).status || "").toLowerCase();
  return status === "conducted" || status === "completed" || status === "done";
}
function hasVaccines(session: SessionPlan) {
  const required = (session as any).vaccinesRequired;
  if (Array.isArray(required)) return required.length > 0;
  if (required && typeof required === "object") return Object.keys(required).length > 0;
  if (typeof required === "string") return required.trim().length > 2;
  return false;
}
function hasStaffing(session: SessionPlan) {
  return Boolean(
    (session as any).vaccinatorName ||
      (session as any).teamLead ||
      (session as any).staffing ||
      Number((session as any).vaccinatorsCount || 0) > 0,
  );
}
export default function PlanHealth() {
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState("all");
  const { data: facilities = [] } = useQuery<Facility[]>({ queryKey: ["/api/facilities"] });
  const { data: villages = [] } = useQuery<Village[]>({ queryKey: ["/api/villages"] });
  const { data: population = [] } = useQuery<PopulationData[]>({ queryKey: ["/api/population"] });
  const { data: sessions = [] } = useQuery<SessionPlan[]>({ queryKey: ["/api/sessions"] });
  const { data: budget = [] } = useQuery<BudgetItem[]>({ queryKey: ["/api/budget-items"] });
  const { data: vaccines = [] } = useQuery<VaccineRequirement[]>({ queryKey: ["/api/vaccine-requirements"] });
  const { data: mobilization = [] } = useQuery<MobilizationActivity[]>({ queryKey: ["/api/mobilization"] });
  const { data: supervision = [] } = useQuery<SupervisionVisit[]>({ queryKey: ["/api/supervision-visits"] });
  const { data: reviews = [] } = useQuery<QuarterlyReview[]>({ queryKey: ["/api/quarterly-reviews"] });
  const rows = useMemo(() => {
    const safeFacilities = Array.isArray(facilities) ? facilities : [];
    const safeVillages = Array.isArray(villages) ? villages : [];
    const safeSessions = Array.isArray(sessions) ? sessions : [];
    const safeBudget = Array.isArray(budget) ? budget : [];
    const safeMobilization = Array.isArray(mobilization) ? mobilization : [];
    const safeSupervision = Array.isArray(supervision) ? supervision : [];
    const safePopulation = Array.isArray(population) ? population : [];
    const safeVaccines = Array.isArray(vaccines) ? vaccines : [];
    const safeReviews = Array.isArray(reviews) ? reviews : [];
    return safeFacilities.map((facility) => {
      const facilityId = Number(facility.id);
      const facilityVillages = safeVillages.filter((v: any) => Number(v.assignedFacilityId) === facilityId);
      const facilitySessions = safeSessions.filter((s) => getSessionFacilityId(s) === facilityId);
      const conductedSessions = facilitySessions.filter(isConducted);
      const facilityBudget = safeBudget.filter((b: any) => Number(b.facilityId) === facilityId);
      const facilityMobilization = safeMobilization.filter((m: any) => Number(m.facilityId) === facilityId);
      const facilitySupervision = safeSupervision.filter((v) => Number(v.facilityId) === facilityId);
      const facilityPopulation = safePopulation.filter((p: any) => Number(p.facilityId) === facilityId);
      const facilityVaccines = safeVaccines.filter((v: any) => Number(v.facilityId) === facilityId);
      const review = safeReviews.find(
        (r) =>
          Number(r.facilityId) === facilityId &&
          Number(r.year) === CURRENT_YEAR &&
          Number(r.quarter) === CURRENT_QUARTER,
      );
      const plannedVillageIds = new Set(
        facilitySessions
          .flatMap((s: any) => [
            s.villageId,
            ...(Array.isArray(s.villageIds) ? s.villageIds : []),
            ...(Array.isArray(s.linkedVillageIds) ? s.linkedVillageIds : []),
          ])
          .map(Number)
          .filter(Boolean),
      );
      const villagesCovered =
        facilityVillages.length === 0 ||
        facilityVillages.every((v) => plannedVillageIds.has(Number(v.id)));
      const htrScored =
        facilityVillages.length === 0 ||
        facilityVillages.every((v: any) => v.htrScore != null || v.htrCategory || v.hardToReach || v.htrStatus);
      const transportBudgeted = facilityBudget.some((b: any) =>
        /transport|fuel|vehicle|motorbike|boat/i.test(`${b.category || ""} ${b.description || ""} ${b.item || ""}`),
      );
      const defaulterReview = Boolean(review) || conductedSessions.some((s: any) =>
        /defaulter|dropout|zero-dose|zero dose/i.test(`${s.outreachPurpose || ""} ${s.notes || ""}`),
      );
      const accessVillages = facilityVillages
        .map((v: any) => ({
          name: v.name,
          distanceKm: v.distanceToFacility != null ? Number(v.distanceToFacility) : null,
          travelTimeMin: v.travelTimeMinutes != null ? Number(v.travelTimeMinutes) : null,
        }))
        .filter((v) => v.distanceKm !== null || v.travelTimeMin !== null);
      const distances = accessVillages.map((v) => v.distanceKm).filter((d): d is number => d !== null && Number.isFinite(d));
      const travelTimes = accessVillages.map((v) => v.travelTimeMin).filter((t): t is number => t !== null && Number.isFinite(t));
      const farthestCommunity = accessVillages
        .filter((v): v is { name: string; distanceKm: number; travelTimeMin: number | null } => v.distanceKm !== null && Number.isFinite(v.distanceKm))
        .sort((a, b) => b.distanceKm - a.distanceKm)[0] ?? null;
      const accessSummary = {
        mapped: accessVillages.length,
        total: facilityVillages.length,
        avgDistanceKm: distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : null,
        maxDistanceKm: farthestCommunity?.distanceKm ?? null,
        farthestCommunityName: farthestCommunity?.name ?? null,
        avgTravelTimeMin: travelTimes.length ? Math.round(travelTimes.reduce((sum, value) => sum + value, 0) / travelTimes.length) : null,
        htrSignals: accessVillages.filter((v) => (v.distanceKm !== null && v.distanceKm >= 5) || (v.travelTimeMin !== null && v.travelTimeMin >= 60)).length,
      };
      const metrics: HealthMetric[] = [
        {
          key: "denominator",
          label: "Denominator complete",
          met: facilityPopulation.length > 0 || facilityVillages.every((v: any) => Number(v.population || v.totalPopulation || 0) > 0),
          detail: `${facilityPopulation.length} population record(s), ${facilityVillages.length} communities`,
          href: "/population",
        },
        {
          key: "htr",
          label: "HTR scored",
          met: htrScored,
          detail: htrScored ? "Communities have HTR signal" : "Some communities need HTR scoring",
          href: "/htr",
        },
        {
          key: "sessions",
          label: "Sessions cover communities",
          met: facilitySessions.length > 0 && villagesCovered,
          detail: `${facilitySessions.length} planned session(s), ${plannedVillageIds.size}/${facilityVillages.length} communities linked`,
          href: "/microplans/routine",
        },
        {
          key: "vaccines",
          label: "Vaccines forecast",
          met: facilityVaccines.length > 0 || facilitySessions.some(hasVaccines),
          detail: `${facilityVaccines.length} requirement row(s) plus session forecasts`,
          href: "/vaccines",
        },
        {
          key: "staffing",
          label: "Staffing assigned",
          met: facilitySessions.some(hasStaffing),
          detail: "At least one session has named team or staffing counts",
          href: "/microplans/routine",
        },
        {
          key: "transport",
          label: "Transport budgeted",
          met: transportBudgeted,
          detail: transportBudgeted ? "Transport or fuel budget present" : "No transport/fuel budget found",
          href: "/budget",
        },
        {
          key: "mobilization",
          label: "Mobilization planned",
          met: facilityMobilization.length > 0,
          detail: `${facilityMobilization.length} activity row(s)`,
          href: "/mobilization",
        },
        {
          key: "supervision",
          label: "Supervision scheduled",
          met: facilitySupervision.some((v) => v.status === "scheduled" || v.status === "conducted"),
          detail: `${facilitySupervision.length} supervision visit(s)`,
          href: "/supervision",
        },
        {
          key: "doses",
          label: "Doses recorded",
          met: conductedSessions.length > 0,
          detail: `${conductedSessions.length} conducted session(s)`,
          href: "/clients",
        },
        {
          key: "defaulters",
          label: "Defaulters reviewed",
          met: defaulterReview,
          detail: review ? "Quarterly review note saved" : "Needs defaulter/dropout review evidence",
          href: "/clients/defaulters",
        },
      ];
      const met = metrics.filter((m) => m.met).length;
      const score = Math.round((met / metrics.length) * 100);
      return { facility, score, met, total: metrics.length, metrics, accessSummary };
    });
  }, [budget, facilities, mobilization, population, reviews, sessions, supervision, vaccines, villages]);
  const filtered = useMemo(() => {
    const safeRows = Array.isArray(rows) ? rows : [];
    return safeRows
      .filter((row) => row.facility.name.toLowerCase().includes(search.toLowerCase()))
      .filter((row) => {
        if (scoreFilter === "ready") return row.score >= 80;
        if (scoreFilter === "watch") return row.score >= 60 && row.score < 80;
        if (scoreFilter === "action") return row.score < 60;
        return true;
      })
      .sort((a, b) => a.score - b.score || a.facility.name.localeCompare(b.facility.name));
  }, [rows, search, scoreFilter]);
  const summary = useMemo(() => {
    const total = rows.length || 1;
    return {
      avg: Math.round(rows.reduce((sum, r) => sum + r.score, 0) / total),
      action: rows.filter((r) => r.score < 60).length,
      ready: rows.filter((r) => r.score >= 80).length,
    };
  }, [rows]);
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facility Plan Health</h1>
          <p className="text-sm text-muted-foreground">
            Per-facility closure from microplan to execution to quarterly review evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/microplans/routine">Open microplans</Link>
          </Button>
          <Button asChild>
            <Link href="/clients/defaulters">Review defaulters</Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Average score</div>
            <div className="mt-1 text-3xl font-bold">{summary.avg}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Ready facilities</div>
            <div className="mt-1 text-3xl font-bold text-emerald-600">{summary.ready}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Need action</div>
            <div className="mt-1 text-3xl font-bold text-rose-600">{summary.action}</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Facility readiness matrix
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search facility"
                  className="pl-8 w-[220px]"
                />
              </div>
              <Select value={scoreFilter} onValueChange={setScoreFilter}>
                <SelectTrigger className="w-[170px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All scores</SelectItem>
                  <SelectItem value="action">Action needed</SelectItem>
                  <SelectItem value="watch">Watch</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtered.map((row) => (
            <div key={row.facility.id} className="rounded-lg border p-4" data-testid={`plan-health-${row.facility.id}`}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-foreground">{row.facility.name}</h2>
                    <Badge variant="outline" className={scoreClass(row.score)}>
                      {row.score}% - {row.met}/{row.total}
                    </Badge>
                  </div>
                  <Progress value={row.score} className="mt-3 h-2 max-w-xl" />
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                      <span className="font-medium text-foreground">Access mapped</span>
                      <div>{row.accessSummary.mapped}/{row.accessSummary.total} communities</div>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                      <span className="font-medium text-foreground">Avg distance</span>
                      <div>{row.accessSummary.avgDistanceKm != null ? `${row.accessSummary.avgDistanceKm.toFixed(1)} km` : "Missing"}</div>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                      <span className="font-medium text-foreground">Avg travel time</span>
                      <div>{row.accessSummary.avgTravelTimeMin != null ? `${row.accessSummary.avgTravelTimeMin} min` : "Missing"}</div>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                      <span className="font-medium text-foreground">Farthest community</span>
                      <div className="truncate">{row.accessSummary.farthestCommunityName ? `${row.accessSummary.farthestCommunityName} - ${row.accessSummary.maxDistanceKm?.toFixed(1)} km` : "Missing"}</div>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                      <span className="font-medium text-foreground">HTR access signals</span>
                      <div>{row.accessSummary.htrSignals} community(s)</div>
                    </div>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/supervision?facilityId=${row.facility.id}`}>Schedule supervision</Link>
                </Button>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                {row.metrics.map((metric) => (
                  <Link
                    key={metric.key}
                    href={metric.href}
                    className={`rounded-md border p-2 transition-colors hover:border-primary ${
                      metric.met ? "bg-emerald-500/5" : "bg-rose-500/5"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      {metric.met ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                      )}
                      {metric.label}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{metric.detail}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}