import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "wouter";
import {
  MapPin, Layers, X, ChevronRight, Hospital, Building2, Users, Clock,
  Ruler, Bike, Car, AlertTriangle, Sparkles, Crosshair, Map, Mountain,
  Satellite, Sun, Calendar, ListChecks, Download, FileText, Loader2,
  Syringe, Plus,
} from "lucide-react";
import { useGetSettlements, useGetFacilities, useGetSettlement, useGetRecommendations, useGetFacility, useLogOutreach } from "@/hooks/vgie/useVgieApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ───────────────────────────────────────────────────────────── */

const riskColors: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#d97706",
  low: "#65a30d",
  very_low: "#16a34a",
};

type TileMode = "dark" | "satellite";

type SettlementItem = {
  id: number; name: string; district: string;
  latitude: number; longitude: number;
  population: number; serviceStatus: "served" | "underserved" | "unserved";
  riskScore?: number | null; riskLevel?: string | null;
  isNewSettlement: boolean; childrenUnderFive?: number | null; buildingCount?: number | null;
  lastOutreachDate?: string | null;
};

type FacilityItem = {
  id: number; name: string; type: string; district: string;
  latitude: number; longitude: number; catchmentRadiusKm: number;
  province?: string | null;
};

/* ─── Basemaps ────────────────────────────────────────────────────────── */

const BASEMAPS = {
  light:     { label: "Light",     icon: Sun,       url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",     attr: "© OpenStreetMap © CARTO" },
  dark:      { label: "Dark",      icon: Map,       url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",      attr: "© OpenStreetMap © CARTO" },
  street:    { label: "Streets",   icon: Mountain,  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",                     attr: "© OpenStreetMap contributors" },
  satellite: { label: "Satellite", icon: Satellite, url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "© Esri" },
} as const;

type BasemapKey = keyof typeof BASEMAPS;

/* ─── Legend ──────────────────────────────────────────────────────────── */

const statusColors: Record<string, { dot: string; label: string }> = {
  served:      { dot: "#10b981", label: "Served" },
  underserved: { dot: "#f59e0b", label: "Underserved" },
  unserved:    { dot: "#ef4444", label: "Unserved" },
};

/* ─── Sizing ──────────────────────────────────────────────────────────── */

function getRadius(population: number): number {
  if (population > 400) return 14;
  if (population > 250) return 11;
  if (population > 100) return 8;
  return 6;
}

const outreachRecencyColors = {
  recent:   { dot: "#10b981", label: "Visited < 6 months" },
  moderate: { dot: "#f59e0b", label: "Visited 6–12 months ago" },
  overdue:  { dot: "#ef4444", label: "Never visited / >12 months" },
};

function getOutreachRecencyColor(lastOutreachDate: string | null | undefined): string {
  if (!lastOutreachDate) return outreachRecencyColors.overdue.dot;
  const monthsAgo = (Date.now() - new Date(lastOutreachDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsAgo <= 6)  return outreachRecencyColors.recent.dot;
  if (monthsAgo <= 12) return outreachRecencyColors.moderate.dot;
  return outreachRecencyColors.overdue.dot;
}

function getSettlementColor(s: SettlementItem, colorByRisk: boolean, colorByOutreach: boolean): string {
  if (colorByOutreach) return getOutreachRecencyColor(s.lastOutreachDate);
  if (colorByRisk && s.riskLevel && riskColors[s.riskLevel]) {
    return riskColors[s.riskLevel];
  }
  return statusColors[s.serviceStatus]?.dot ?? "#64748b";
}

/* ─── Client-side distance helper ───────────────────────────────────── */

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ─── Settlement detail panel ────────────────────────────────────────── */

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const PANEL_VACCINES = ["BCG", "OPV", "Penta", "PCV", "Rota", "IPV", "MR", "Td"];

function SelectedPanel({ selectedId, onClose }: { selectedId: number; onClose: () => void }) {
  const { data: detail, isLoading, refetch } = useGetSettlement(selectedId);
  const { data: recs } = useGetRecommendations({ settlementId: selectedId, status: "pending" } as any);
  const { mutate: logOutreach, isPending: outreachPending } = useLogOutreach();
  const { toast } = useToast();

  const [showOutreachForm, setShowOutreachForm] = useState(false);
  const [outreachDate, setOutreachDate] = useState(new Date().toISOString().slice(0, 10));
  const [outreachVaccines, setOutreachVaccines] = useState<string[]>([]);
  const [outreachCount, setOutreachCount] = useState("");

  const nf = (detail as any)?.nearestFacility;
  const topRec = recs?.[0] ?? null;
  const detailAny = detail as any;
  const outreachSessions: Array<{ visitDate: string; childrenVaccinated: number }> = detailAny?.outreachSessions ?? [];
  const lastSession = outreachSessions[0] ?? null;

  const toggleVaccine = (v: string) =>
    setOutreachVaccines(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const handleLogOutreach = () => {
    if (!outreachDate || outreachVaccines.length === 0 || !outreachCount) {
      toast({ title: "Fill in date, vaccines, and child count", variant: "destructive" });
      return;
    }
    logOutreach(
      { id: selectedId, data: { visitDate: outreachDate, vaccineTypes: outreachVaccines.join(", "), childrenVaccinated: parseInt(outreachCount) } },
      {
        onSuccess: () => {
          toast({ title: "Outreach logged", description: `${outreachCount} children vaccinated` });
          setShowOutreachForm(false);
          setOutreachVaccines([]);
          setOutreachCount("");
          refetch();
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="absolute top-4 right-4 z-[500] w-80">
      <Card className="bg-slate-900/97 border-slate-700 backdrop-blur-sm shadow-2xl">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {isLoading
                ? <div className="h-4 w-32 bg-slate-800 animate-pulse rounded mb-1" />
                : <p className="font-semibold text-slate-200 text-sm leading-tight truncate">{detail?.name}</p>}
              <p className="text-xs text-slate-500 mt-0.5">{detail?.district ?? "…"} District</p>
            </div>
            <Button variant="ghost" size="sm"
              className="h-6 w-6 p-0 text-slate-600 hover:text-slate-300 shrink-0"
              onClick={onClose}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          {detail && (
            <>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={`text-[10px] px-1.5 py-0 border ${
                  detail.serviceStatus === "served" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  : detail.serviceStatus === "underserved" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                  : "text-red-400 bg-red-500/10 border-red-500/20"
                }`}>{statusColors[detail.serviceStatus].label}</Badge>
                {detail.isNewSettlement && <Badge className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-400 border border-purple-500/20">NEW</Badge>}
                {detail.riskLevel && (
                  <Badge className={`text-[10px] px-1.5 py-0 border ${
                    (detail.riskLevel as string) === "critical" || detail.riskLevel === "high" ? "text-red-400 bg-red-500/10 border-red-500/20"
                    : detail.riskLevel === "medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  }`}>{detail.riskLevel?.replace("_", " ")} risk</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-3">
                <div className="p-2 rounded bg-slate-800/50">
                  <p className="text-[10px] text-slate-600 flex items-center gap-1"><Users className="w-3 h-3" /> Pop.</p>
                  <p className="text-sm font-bold text-slate-200">{detail.population.toLocaleString()}</p>
                </div>
                <div className="p-2 rounded bg-slate-800/50">
                  <p className="text-[10px] text-slate-600">Children U5</p>
                  <p className="text-sm font-bold text-slate-200">{detail.childrenUnderFive ?? "—"}</p>
                </div>
                <div className="p-2 rounded bg-slate-800/50">
                  <p className="text-[10px] text-slate-600 flex items-center gap-1"><Building2 className="w-3 h-3" /> Bldgs</p>
                  <p className="text-sm font-bold text-slate-200">{detail.buildingCount ?? "—"}</p>
                </div>
              </div>

              {/* Last outreach row */}
              <div className="mt-2 px-2 py-1.5 rounded bg-slate-800/40 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Last outreach
                </span>
                {lastSession ? (
                  <span className="text-[10px] font-medium text-emerald-400">{formatRelativeDate(lastSession.visitDate)}</span>
                ) : detailAny?.hasOutreachSession ? (
                  <span className="text-[10px] font-medium text-emerald-400">Session recorded</span>
                ) : (
                  <span className="text-[10px] text-slate-600 italic">No outreach yet</span>
                )}
              </div>

              {/* Log outreach button / inline form */}
              {!showOutreachForm ? (
                <button
                  onClick={() => setShowOutreachForm(true)}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-dashed border-slate-700 text-[10px] text-slate-500 hover:border-emerald-600 hover:text-emerald-400 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Log outreach session
                </button>
              ) : (
                <div className="mt-2 p-2.5 rounded-lg bg-slate-800/60 border border-emerald-500/20 space-y-2.5">
                  <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                    <Syringe className="w-3 h-3" /> New outreach session
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Date</p>
                      <input
                        type="date"
                        value={outreachDate}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={e => setOutreachDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Children vaccinated</p>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 24"
                        value={outreachCount}
                        onChange={e => setOutreachCount(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1.5">Vaccines covered</p>
                    <div className="flex flex-wrap gap-1">
                      {PANEL_VACCINES.map(v => (
                        <button
                          key={v}
                          onClick={() => toggleVaccine(v)}
                          className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                            outreachVaccines.includes(v)
                              ? "bg-emerald-600 border-emerald-500 text-white"
                              : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1.5 justify-end pt-0.5">
                    <Button size="sm" variant="ghost"
                      className="h-6 px-2 text-[10px] text-slate-500 hover:text-slate-300"
                      onClick={() => { setShowOutreachForm(false); setOutreachVaccines([]); setOutreachCount(""); }}
                      disabled={outreachPending}
                    >
                      Cancel
                    </Button>
                    <Button size="sm"
                      className="h-6 px-2.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleLogOutreach}
                      disabled={outreachPending}
                    >
                      {outreachPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Save
                    </Button>
                  </div>
                </div>
              )}

              {nf ? (
                <div className="mt-3 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <p className="text-[10px] text-blue-400 font-medium mb-1 flex items-center gap-1"><Hospital className="w-3 h-3" /> Nearest Facility</p>
                  <p className="text-xs text-slate-300 font-medium truncate">{nf.name}</p>
                  <p className="text-[10px] text-slate-500">{nf.type}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                    <span className="flex items-center gap-0.5"><Ruler className="w-3 h-3" /> {nf.distanceKm?.toFixed(1)} km</span>
                    {nf.travelTimeWalkingMin && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {nf.travelTimeWalkingMin} min walk</span>}
                    {nf.travelTimeMotorcycleMin && <span className="flex items-center gap-0.5"><Bike className="w-3 h-3" /> {nf.travelTimeMotorcycleMin} min moto</span>}
                    {nf.travelTimeVehicleMin && <span className="flex items-center gap-0.5"><Car className="w-3 h-3" /> {nf.travelTimeVehicleMin} min vehicle</span>}
                  </div>
                </div>
              ) : (
                <div className="mt-3 p-2.5 rounded-lg bg-slate-800/50 text-[10px] text-slate-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-600" /> No facility link data
                </div>
              )}
              {topRec ? (
                <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-[10px] text-emerald-400 font-medium mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Top Recommendation</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{topRec.recommendationType}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-[9px] px-1 py-0 border ${
                      topRec.priority === "high"   ? "text-red-400 bg-red-500/10 border-red-500/20"
                      : topRec.priority === "medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                      : "text-slate-400 bg-slate-500/10 border-slate-500/20"
                    }`}>{topRec.priority} priority</Badge>
                  </div>
                </div>
              ) : detail.serviceStatus !== "served" ? (
                <div className="mt-3 p-2 rounded-lg bg-slate-800/50 text-[10px] text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-slate-600" /> No pending recommendations
                </div>
              ) : null}
              <Link href={`/settlements/${detail.id}`}>
                <Button size="sm" className="w-full mt-3 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  View Full Details <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Facility catchment panel ───────────────────────────────────────── */

function FacilityPanel({ facilityId, activeRadiusKm, settlements, onClose }: {
  facilityId: number;
  activeRadiusKm: number;
  settlements: SettlementItem[];
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useGetFacility(facilityId);

  /* Compute purely from geometry — same source of truth as map highlight rings */
  const withinCatchment = useMemo(() => {
    if (!detail) return [] as (SettlementItem & { _distKm: number })[];
    return settlements
      .map(s => ({ ...s, _distKm: haversineKm(detail.latitude, detail.longitude, s.latitude, s.longitude) }))
      .filter(s => s._distKm <= activeRadiusKm)
      .sort((a, b) => a._distKm - b._distKm);
  }, [detail, settlements, activeRadiusKm]);

  const servedIn   = withinCatchment.filter(s => s.serviceStatus === "served").length;
  const underIn    = withinCatchment.filter(s => s.serviceStatus === "underserved").length;
  const unservedIn = withinCatchment.filter(s => s.serviceStatus === "unserved").length;
  const totalPop   = withinCatchment.reduce((n, s) => n + (s.population ?? 0), 0);
  const totalU5    = withinCatchment.reduce((n, s) => n + (s.childrenUnderFive ?? 0), 0);

  const SHOW_LIMIT = 15;
  const listed   = withinCatchment.slice(0, SHOW_LIMIT);
  const overflow = withinCatchment.length - SHOW_LIMIT;

  return (
    <div className="absolute top-4 right-4 z-[500] w-80 max-h-[calc(100vh-120px)] flex flex-col">
      <Card className="bg-slate-900/97 border-slate-700 backdrop-blur-sm shadow-2xl flex flex-col overflow-hidden">
        <CardContent className="p-4 flex flex-col gap-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 shrink-0">
            <div className="min-w-0 flex-1">
              {isLoading
                ? <div className="h-4 w-36 bg-slate-800 animate-pulse rounded mb-1" />
                : <p className="font-semibold text-slate-200 text-sm leading-tight truncate">{detail?.name}</p>}
              <p className="text-xs text-slate-500 mt-0.5">{detail?.type ?? "…"} · {detail?.district ?? "…"}</p>
            </div>
            <Button variant="ghost" size="sm"
              className="h-6 w-6 p-0 text-slate-600 hover:text-slate-300 shrink-0"
              onClick={onClose}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {detail && !isLoading && (
            <>
              {/* Catchment summary bar */}
              <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-between shrink-0">
                <span className="text-[10px] text-blue-400 flex items-center gap-1">
                  <Hospital className="w-3 h-3" /> Catchment: {activeRadiusKm} km radius
                </span>
                <span className="text-[10px] text-slate-400 font-medium">{withinCatchment.length} settlements</span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-1 mt-2 shrink-0">
                <div className="rounded bg-slate-800/50 p-1.5 text-center">
                  <p className="text-xs font-bold text-emerald-400">{servedIn}</p>
                  <p className="text-[9px] text-slate-600">Served</p>
                </div>
                <div className="rounded bg-slate-800/50 p-1.5 text-center">
                  <p className="text-xs font-bold text-amber-400">{underIn}</p>
                  <p className="text-[9px] text-slate-600">Under</p>
                </div>
                <div className="rounded bg-slate-800/50 p-1.5 text-center">
                  <p className="text-xs font-bold text-red-400">{unservedIn}</p>
                  <p className="text-[9px] text-slate-600">Unserved</p>
                </div>
              </div>

              <div className="mt-1.5 grid grid-cols-2 gap-1 shrink-0">
                <div className="rounded bg-slate-800/40 px-2 py-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-600 flex items-center gap-1"><Users className="w-3 h-3" /> Pop.</span>
                  <span className="text-[10px] font-semibold text-slate-300">{totalPop.toLocaleString()}</span>
                </div>
                {totalU5 > 0 && (
                  <div className="rounded bg-slate-800/40 px-2 py-1 flex items-center justify-between">
                    <span className="text-[10px] text-slate-600">U5</span>
                    <span className="text-[10px] font-semibold text-amber-300">{totalU5.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Settlement list */}
              <div className="mt-2.5 flex-1 overflow-y-auto min-h-0" style={{ maxHeight: "260px" }}>
                <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <ListChecks className="w-3 h-3" /> Settlements within catchment
                </p>
                {withinCatchment.length === 0 ? (
                  <p className="text-[11px] text-slate-600 italic px-1">No linked settlements within {activeRadiusKm} km</p>
                ) : (
                  <div className="space-y-0.5">
                    {listed.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-slate-800/40 hover:bg-slate-800/70 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-slate-300 font-medium truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-600">
                            {s.population.toLocaleString()} pop · {s._distKm.toFixed(1)} km
                          </p>
                        </div>
                        <Badge className={`ml-1 shrink-0 text-[9px] px-1 py-0 border ${
                          s.serviceStatus === "served"
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : s.serviceStatus === "underserved"
                              ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                              : "text-red-400 bg-red-500/10 border-red-500/20"
                        }`}>{s.serviceStatus}</Badge>
                      </div>
                    ))}
                    {overflow > 0 && (
                      <p className="text-[10px] text-slate-600 italic text-center pt-1">+{overflow} more within catchment</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Main MapView ────────────────────────────────────────────────────── */

export default function MapView() {
  const [statusFilter, setStatusFilter]     = useState<string>("all");
  const [riskFilter, setRiskFilter]         = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("district") ?? "all";
  });
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [showFacilities, setShowFacilities] = useState(true);
  const [showCatchment, setShowCatchment]   = useState(false);
  const [catchmentRadiusKm, setCatchmentRadiusKm] = useState(5);
  const [showClusters, setShowClusters]       = useState(true);
  const [colorByRisk, setColorByRisk]         = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("outreach") !== "1";
  });
  const [colorByOutreach, setColorByOutreach] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("outreach") === "1";
  });
  const [selectedId, setSelectedId]         = useState<number | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [basemap, setBasemap]               = useState<BasemapKey>("light");
  const [zoomLevel, setZoomLevel]           = useState(7);
  const [LeafletMap, setLeafletMap]         = useState<any>(null);
  const [clusterAvailable, setClusterAvailable] = useState(false);
  const [isExporting, setIsExporting]       = useState<false | "png" | "pdf">(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [showCountryOutline, setShowCountryOutline] = useState(true);
  const [showProvinces, setShowProvinces]           = useState(true);
  const [showDistricts, setShowDistricts]           = useState(false);
  const [countryGeoJson, setCountryGeoJson]         = useState<any>(null);
  const [provinceGeoJson, setProvinceGeoJson]       = useState<any>(null);
  const [districtGeoJson, setDistrictGeoJson]       = useState<any>(null);

  /* Cached full district list — populated from settlements when no district filter is active */
  const districtListRef = useRef<string[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const { data: settlements } = useGetSettlements({
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    district: districtFilter !== "all" ? districtFilter : undefined,
  } as any);
  const { data: facilities } = useGetFacilities();

  useEffect(() => {
    Promise.all([import("leaflet"), import("react-leaflet")]).then(([Lmod, RLmod]) => {
      const L = Lmod.default;
      const RL = RLmod;
      setLeafletMap({ L, RL });
      (window as any).L = L;
      // @ts-ignore
      import("leaflet.markercluster");
      import("leaflet.markercluster/dist/MarkerCluster.css");
      import("leaflet.markercluster/dist/MarkerCluster.Default.css").then(() => { setClusterAvailable(true); })
        .catch(() => {});
    });
  }, []);

  /* Lazy-load boundary GeoJSON on first toggle */
  useEffect(() => {
    if (showCountryOutline && !countryGeoJson) {
      fetch("/geo/zambia-country.geojson").then(r => r.json()).then(setCountryGeoJson).catch(() => {});
    }
  }, [showCountryOutline]);
  useEffect(() => {
    if (showProvinces && !provinceGeoJson) {
      fetch("/geo/zambia-provinces.geojson").then(r => r.json()).then(setProvinceGeoJson).catch(() => {});
    }
  }, [showProvinces]);
  useEffect(() => {
    if (showDistricts && !districtGeoJson) {
      fetch("/geo/zambia-districts.geojson").then(r => r.json()).then(setDistrictGeoJson).catch(() => {});
    }
  }, [showDistricts]);

  /* Build district list whenever we have the full (unfiltered by district) settlements */
  useEffect(() => {
    if (districtFilter === "all" && settlements && settlements.length > 0) {
      const districts = Array.from(
        new Set((settlements as SettlementItem[]).map(s => s.district).filter(Boolean))
      ).sort();
      districtListRef.current = districts;
    }
  }, [settlements, districtFilter]);

  const ZAMBIA_CENTER: [number, number] = [-13.5, 28.5];
  const ZAMBIA_ZOOM = 6;

  /* Province list from facilities */
  const provinces = Array.from(
    new Set((facilities ?? []).map((f: any) => f.province).filter(Boolean))
  ).sort() as string[];

  /* Province ↔ district cross-maps (built from facilities which carry both fields).
     Uses plain Record objects to avoid clashing with the lucide-react `Map` icon import. */
  const provinceDistrictMap = useMemo(() => {
    const rec: Record<string, string[]> = {};
    for (const f of (facilities ?? []) as FacilityItem[]) {
      const p = (f as any).province as string | undefined;
      const d = f.district;
      if (p && d) {
        if (!rec[p]) rec[p] = [];
        if (!rec[p].includes(d)) rec[p].push(d);
      }
    }
    for (const arr of Object.values(rec)) arr.sort();
    return rec;
  }, [facilities]);

  const districtProvinceMap = useMemo(() => {
    const rec: Record<string, string> = {};
    for (const f of (facilities ?? []) as FacilityItem[]) {
      const p = (f as any).province as string | undefined;
      const d = f.district;
      if (p && d) rec[d] = p;
    }
    return rec;
  }, [facilities]);

  /* Normalise a string for fuzzy matching (lowercase, strip hyphens/spaces) */
  const normalise = (s: string) => s.toLowerCase().replace(/[-\s]/g, "");

  /* District list shown in the dropdown: scoped to province when one is active */
  const cascadedDistricts = useMemo(() => {
    if (provinceFilter !== "all") {
      const inProvince = provinceDistrictMap[provinceFilter];
      if (inProvince && inProvince.length > 0) return inProvince;
    }
    return districtListRef.current;
  }, [provinceFilter, provinceDistrictMap]);

  /* Memoize to prevent ClusterLayer from rebuilding on every zoom-state change */
  const visibleSettlements = useMemo(() => {
    /* Districts that belong to the active province (used to filter settlements
       when a province is chosen but no specific district is pinned) */
    const provinceDistricts =
      provinceFilter !== "all" && districtFilter === "all"
        ? provinceDistrictMap[provinceFilter] ?? []
        : null;

    return ((settlements ?? []) as SettlementItem[]).filter(s => {
      if (riskFilter !== "all" && s.riskLevel !== riskFilter) return false;
      if (provinceDistricts && !provinceDistricts.includes(s.district)) return false;
      return true;
    });
  }, [settlements, riskFilter, provinceFilter, districtFilter, provinceDistrictMap]);

  /* Facilities are markercluster-managed — no zoom gate needed.
     Catchment circles are heavier SVG; only render at zoom ≥ 7. */
  const CATCHMENT_ZOOM_THRESHOLD = 7;

  const allFilteredFacilities = useMemo(() =>
    ((facilities ?? []) as FacilityItem[]).filter(f => {
      if (provinceFilter !== "all" && (f as any).province !== provinceFilter) return false;
      if (districtFilter !== "all" && f.district !== districtFilter) return false;
      return true;
    }),
  [facilities, provinceFilter, districtFilter]);

  const highlightedSettlementIds = useMemo(() => {
    if (!selectedFacilityId) return new Set<number>();
    const fac = ((facilities ?? []) as FacilityItem[]).find(f => f.id === selectedFacilityId);
    if (!fac) return new Set<number>();
    const ids = new Set<number>();
    for (const s of (settlements ?? []) as SettlementItem[]) {
      if (haversineKm(fac.latitude, fac.longitude, s.latitude, s.longitude) <= catchmentRadiusKm) {
        ids.add(s.id);
      }
    }
    return ids;
  }, [selectedFacilityId, facilities, settlements, catchmentRadiusKm]);

  const handleSelectSettlement = useCallback((s: SettlementItem) => {
    setSelectedId(s.id);
    setSelectedFacilityId(null);
  }, []);

  const [facilityFlyTarget, setFacilityFlyTarget] = useState<{ lat: number; lng: number; radiusKm: number } | null>(null);

  /* Handlers with fuzzy name-matching so GADM names map to DB names */
  const handleBoundaryProvince = useCallback((gadmName: string) => {
    const norm = (s: string) => s.toLowerCase().replace(/[-\s]/g, "");
    const matched = provinces.find(p => norm(p) === norm(gadmName)) ?? gadmName;
    setProvinceFilter(matched);
    /* Keep district if it belongs to this province, otherwise reset */
    if (districtFilter !== "all") {
      const inProv = provinceDistrictMap[matched] ?? [];
      if (!inProv.includes(districtFilter)) setDistrictFilter("all");
    }
  }, [provinces, districtFilter, provinceDistrictMap]);

  const handleBoundaryDistrict = useCallback((gadmName: string) => {
    const norm = (s: string) => s.toLowerCase().replace(/[-\s]/g, "");
    const allDistricts = districtListRef.current;
    const matched = allDistricts.find(d => norm(d) === norm(gadmName)) ?? gadmName;
    setDistrictFilter(matched);
    /* Auto-set province from the district→province map */
    const p = districtProvinceMap[matched];
    if (p) setProvinceFilter(p);
  }, [districtProvinceMap]);

  const handleSelectFacility = useCallback((id: number) => {
    setSelectedFacilityId(id);
    setSelectedId(null);
    const fac = ((facilities ?? []) as FacilityItem[]).find(f => f.id === id);
    if (fac) setFacilityFlyTarget({ lat: fac.latitude, lng: fac.longitude, radiusKm: catchmentRadiusKm });
  }, [facilities, catchmentRadiusKm]);

  /* Always pass facilities to the map — hoisted here so export functions can reference it */
  const visibleFacilities = showFacilities ? allFilteredFacilities : [];

  /* ── Export helpers ── */
  const captureMapCanvas = useCallback(async () => {
    const el = mapContainerRef.current;
    if (!el) throw new Error("Map container not found");
    // @ts-ignore
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(el, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#0f172a",
      scale: 2,
      logging: false,
      ignoreElements: (node: any) => {
        if (node instanceof HTMLElement && node.dataset.exportIgnore === "true") return true;
        return false;
      },
    });
  }, []);

  const exportAsPng = useCallback(async () => {
    setIsExporting("png");
    setShowExportMenu(false);
    try {
      const canvas = await captureMapCanvas();
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      const district = districtFilter !== "all" ? `-${districtFilter}` : "";
      link.download = `vaxplan-map${district}-${date}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setIsExporting(false);
    }
  }, [captureMapCanvas, districtFilter]);

  const exportAsPdf = useCallback(async () => {
    setIsExporting("pdf");
    setShowExportMenu(false);
    try {
      const [{ default: jsPDF }, canvas] = await Promise.all([
        // @ts-ignore
        import("jspdf"),
        captureMapCanvas(),
      ]);

      const date = new Date();
      const dateStr = date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const district = districtFilter !== "all" ? districtFilter : "All Districts";
      const province = provinceFilter !== "all" ? ` · ${provinceFilter} Province` : "";

      const MARGIN = 14;
      const PAGE_W = 297;
      const PAGE_H = 210;
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      const HEADER_H = 22;
      const FOOTER_H = 14;

      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, PAGE_W, PAGE_H, "F");

      pdf.setFillColor(30, 41, 59);
      pdf.rect(0, 0, PAGE_W, HEADER_H, "F");

      pdf.setTextColor(16, 185, 129);
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.text("VaxPlan · VGIE Coverage Report", MARGIN, 10);

      pdf.setTextColor(148, 163, 184);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${district}${province}`, MARGIN, 16);
      pdf.text(`Generated: ${dateStr}`, PAGE_W - MARGIN, 16, { align: "right" });

      const imgW = PAGE_W - MARGIN * 2;
      const availH = PAGE_H - HEADER_H - FOOTER_H - 4;
      const imgH = Math.min(availH, (imgW * canvas.height) / canvas.width);
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.92),
        "JPEG",
        MARGIN,
        HEADER_H + 2,
        imgW,
        imgH,
      );

      const statsY = PAGE_H - FOOTER_H + 4;
      const served = visibleSettlements.filter(s => s.serviceStatus === "served").length;
      const underserved = visibleSettlements.filter(s => s.serviceStatus === "underserved").length;
      const unserved = visibleSettlements.filter(s => s.serviceStatus === "unserved").length;
      const total = visibleSettlements.length;

      pdf.setFillColor(30, 41, 59);
      pdf.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H, "F");

      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      const stats = [
        `Settlements visible: ${total}`,
        `Served: ${served}`,
        `Underserved: ${underserved}`,
        `Unserved: ${unserved}`,
        ...(showFacilities ? [`Facilities: ${visibleFacilities.length}`] : []),
        ...(showCatchment ? [`Catchment radius: ${catchmentRadiusKm} km`] : []),
      ];
      pdf.text(stats.join("   ·   "), MARGIN, statsY);
      pdf.setTextColor(148, 163, 184);
      pdf.text("VaxPlan VGIE — Zambia MoH Immunisation Programme", PAGE_W - MARGIN, statsY, { align: "right" });

      const fileName = `vaxplan-report-${districtFilter !== "all" ? districtFilter + "-" : ""}${date.toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);
    } finally {
      setIsExporting(false);
    }
  }, [captureMapCanvas, districtFilter, provinceFilter, visibleSettlements, showFacilities, visibleFacilities, showCatchment, catchmentRadiusKm]);

  /* Bounding box to fly-to when district is selected — derived from visible settlements */
  const districtBounds = useMemo(() => {
    if (districtFilter === "all" || visibleSettlements.length === 0) return null;
    const lats = visibleSettlements.map(s => s.latitude);
    const lngs = visibleSettlements.map(s => s.longitude);
    return [
      [Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05],
      [Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05],
    ] as [[number, number], [number, number]];
  }, [districtFilter, visibleSettlements]);

  /* visibleFacilities declared earlier (above export helpers) */

  /* Catchment circles — only render when zoomed in enough to be useful */
  const catchmentFacilities = showCatchment && zoomLevel >= CATCHMENT_ZOOM_THRESHOLD
    ? allFilteredFacilities
    : [];

  const unservedCount = visibleSettlements.filter(s => s.serviceStatus === "unserved").length;
  const servedCount   = visibleSettlements.filter(s => s.serviceStatus === "served").length;

  return (
    <div ref={mapContainerRef} className="relative" style={{ height: "100%" }}>

      {/* ── Left controls panel ── */}
      <div className="absolute top-4 left-4 z-[500] flex flex-col gap-2 max-h-[calc(100vh-100px)] overflow-y-auto">
        <Card className="bg-slate-900/97 border-slate-700 backdrop-blur-sm shadow-xl">
          <CardContent className="p-3 space-y-3">

            {/* Basemap switcher */}
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Map className="w-3 h-3" /> Basemap
              </p>
              <div className="grid grid-cols-2 gap-1">
                {(Object.entries(BASEMAPS) as [BasemapKey, typeof BASEMAPS[BasemapKey]][]).map(([key, bm]) => {
                  const Icon = bm.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setBasemap(key)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] transition-colors ${
                        basemap === key
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 border border-transparent"
                      }`}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      {bm.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-800" />

            {/* Layers */}
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Layers className="w-3 h-3" /> Layers
              </p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showFacilities} onChange={e => setShowFacilities(e.target.checked)}
                    className="w-3 h-3 accent-blue-500 shrink-0" />
                  <span className="text-xs text-slate-400">Health facilities</span>
                </label>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showCatchment} onChange={e => setShowCatchment(e.target.checked)}
                      className="w-3 h-3 accent-blue-500 shrink-0" />
                    <span className="text-xs text-slate-400">Catchment radii</span>
                    {showCatchment && zoomLevel < CATCHMENT_ZOOM_THRESHOLD && (
                      <span className="text-[9px] text-amber-500 ml-auto">zoom in</span>
                    )}
                  </label>
                  {showCatchment && (
                    <div className="pl-5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-600">Radius</span>
                        <span className="text-[10px] font-semibold text-blue-400 tabular-nums">{catchmentRadiusKm} km</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={25}
                        step={1}
                        value={catchmentRadiusKm}
                        onChange={e => setCatchmentRadiusKm(Number(e.target.value))}
                        className="w-full h-1.5 rounded accent-blue-500 cursor-pointer"
                        style={{ accentColor: "#3b82f6" }}
                      />
                      <div className="flex justify-between text-[9px] text-slate-700">
                        <span>1 km</span>
                        <span>25 km</span>
                      </div>
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showClusters} onChange={(e) => setShowClusters(e.target.checked)} className="w-3 h-3 accent-purple-500" />
                  <span className="text-xs text-slate-400">Cluster markers</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={colorByRisk} onChange={(e) => { setColorByRisk(e.target.checked); if (e.target.checked) setColorByOutreach(false); }} className="w-3 h-3 accent-orange-500" />
                  <span className="text-xs text-slate-400">Color by risk</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={colorByOutreach} onChange={(e) => { setColorByOutreach(e.target.checked); if (e.target.checked) setColorByRisk(false); }} className="w-3 h-3 accent-emerald-500" />
                  <span className="text-xs text-slate-400">Outreach recency</span>
                </label>
                <div className="border-t border-slate-800/60 mt-1 pt-1.5">
                  <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-1.5">Boundaries</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showCountryOutline} onChange={e => setShowCountryOutline(e.target.checked)} className="w-3 h-3 accent-slate-400" />
                    <span className="text-xs text-slate-400">Country outline</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input type="checkbox" checked={showProvinces} onChange={e => setShowProvinces(e.target.checked)} className="w-3 h-3 accent-amber-500" />
                    <span className="text-xs text-slate-400">Province borders</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input type="checkbox" checked={showDistricts} onChange={e => setShowDistricts(e.target.checked)} className="w-3 h-3 accent-violet-500" />
                    <span className="text-xs text-slate-400">District borders</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-800" />

            {/* Filters */}
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Filters</p>
              <div className="space-y-1.5">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full h-7 text-xs bg-slate-800 border-slate-700 text-slate-300">
                    <SelectValue placeholder="Service status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="all"          className="text-xs text-slate-300">All statuses</SelectItem>
                    <SelectItem value="served"       className="text-xs text-slate-300">Served</SelectItem>
                    <SelectItem value="underserved"  className="text-xs text-slate-300">Underserved</SelectItem>
                    <SelectItem value="unserved"     className="text-xs text-slate-300">Unserved</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-full h-7 text-xs bg-slate-800 border-slate-700 text-slate-300">
                    <SelectValue placeholder="Risk level" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="all"         className="text-xs text-slate-300">All risk levels</SelectItem>
                    <SelectItem value="high_risk"   className="text-xs text-slate-300">High risk</SelectItem>
                    <SelectItem value="medium_risk" className="text-xs text-slate-300">Medium risk</SelectItem>
                    <SelectItem value="low_risk"    className="text-xs text-slate-300">Low risk</SelectItem>
                  </SelectContent>
                </Select>
                {/* Province first — constrains the district list below */}
                <Select value={provinceFilter} onValueChange={v => {
                  setProvinceFilter(v);
                  /* If the current district is not in the new province, reset it */
                  if (v !== "all" && districtFilter !== "all") {
                    const inProv = provinceDistrictMap[v] ?? [];
                    if (!inProv.includes(districtFilter)) setDistrictFilter("all");
                  }
                }}>
                  <SelectTrigger className="w-full h-7 text-xs bg-slate-800 border-slate-700 text-slate-300">
                    <SelectValue placeholder="All provinces" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 max-h-48">
                    <SelectItem value="all" className="text-xs text-slate-300">All provinces</SelectItem>
                    {provinces.map(p => (
                      <SelectItem key={p} value={p} className="text-xs text-slate-300">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* District — scoped to selected province when one is active */}
                <Select value={districtFilter} onValueChange={v => {
                  setDistrictFilter(v);
                  /* Auto-set province when a specific district is chosen */
                  if (v !== "all") {
                    const p = districtProvinceMap[v];
                    if (p) setProvinceFilter(p);
                  }
                }}>
                  <SelectTrigger className="w-full h-7 text-xs bg-slate-800 border-slate-700 text-slate-300">
                    <SelectValue placeholder="All districts" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 max-h-52">
                    <SelectItem value="all" className="text-xs text-slate-300">
                      {provinceFilter !== "all"
                        ? `All ${cascadedDistricts.length} districts`
                        : "All districts"}
                    </SelectItem>
                    {cascadedDistricts.map(d => (
                      <SelectItem key={d} value={d} className="text-xs text-slate-300">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Clear active filters */}
                {(statusFilter !== "all" || riskFilter !== "all" || districtFilter !== "all" || provinceFilter !== "all") && (
                  <button
                    onClick={() => { setStatusFilter("all"); setRiskFilter("all"); setDistrictFilter("all"); setProvinceFilter("all"); }}
                    className="w-full text-[10px] text-slate-500 hover:text-red-400 transition-colors py-0.5 flex items-center justify-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear all filters
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-800" />

            {/* Legend */}
            <div className="space-y-1.5">
              <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-1">
                {colorByOutreach ? "Outreach recency" : colorByRisk ? "Risk level" : "Service status"}
              </p>
              {colorByOutreach ? (
                Object.entries(outreachRecencyColors).map(([key, { dot, label }]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dot }} />
                    <span className="text-[11px] text-slate-500">{label}</span>
                  </div>
                ))
              ) : colorByRisk ? (
                <>
                  {Object.entries(riskColors).map(([level, color]) => (
                    <div key={level} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-[11px] text-slate-500 capitalize">{level.replace("_", " ")}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                    <span className="text-[11px] text-slate-500">No risk data</span>
                  </div>
                </>
              ) : (
                Object.entries(statusColors).map(([s, { dot, label }]) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dot }} />
                    <span className="text-[11px] text-slate-500">{label} settlement</span>
                  </div>
                ))
              )}
              {showFacilities && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded shrink-0 bg-blue-500/40 border border-blue-500/70" />
                  <span className="text-[11px] text-slate-500">Health facility</span>
                </div>
              )}
              {showCatchment && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 border border-blue-400/60" style={{ background: "rgba(59,130,246,0.1)" }} />
                  <span className="text-[11px] text-slate-500">Catchment radius ({catchmentRadiusKm} km)</span>
                </div>
              )}
              {showCountryOutline && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 shrink-0 border-t-2" style={{ borderColor: "rgba(255,255,255,0.5)" }} />
                  <span className="text-[11px] text-slate-500">Country outline</span>
                </div>
              )}
              {showProvinces && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 shrink-0 border-t border-dashed border-amber-400/80" />
                  <span className="text-[11px] text-slate-500">Province border</span>
                </div>
              )}
              {showDistricts && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 shrink-0 border-t border-violet-400/60" />
                  <span className="text-[11px] text-slate-500">District border</span>
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Stats card */}
        <Card className="bg-slate-900/97 border-slate-700 backdrop-blur-sm shadow-xl">
          <CardContent className="p-3 space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Coverage</p>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="rounded bg-slate-800/50 p-1.5">
                <p className="text-xs font-bold text-emerald-400">{servedCount}</p>
                <p className="text-[9px] text-slate-600">Served</p>
              </div>
              <div className="rounded bg-slate-800/50 p-1.5">
                <p className="text-xs font-bold text-amber-400">
                  {visibleSettlements.filter(s => s.serviceStatus === "underserved").length}
                </p>
                <p className="text-[9px] text-slate-600">Under</p>
              </div>
              <div className="rounded bg-slate-800/50 p-1.5">
                <p className="text-xs font-bold text-red-400">{unservedCount}</p>
                <p className="text-[9px] text-slate-600">Unserved</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 text-center">{visibleSettlements.length} settlements visible</p>
            {showFacilities && (
              <p className="text-[10px] text-slate-600 text-center">
                {visibleFacilities.length} facilities shown
              </p>
            )}
          </CardContent>
        </Card>

        {/* Export card */}
        <Card className="bg-slate-900/97 border-slate-700 backdrop-blur-sm shadow-xl">
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Download className="w-3 h-3" /> Export
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={exportAsPng}
                disabled={!!isExporting}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] w-full
                  bg-slate-800/60 text-slate-300 hover:bg-slate-700/80 hover:text-slate-100
                  border border-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting === "png"
                  ? <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                  : <Download className="w-3 h-3 shrink-0 text-emerald-400" />}
                <span>{isExporting === "png" ? "Capturing…" : "Save as PNG"}</span>
              </button>
              <button
                onClick={exportAsPdf}
                disabled={!!isExporting}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] w-full
                  bg-slate-800/60 text-slate-300 hover:bg-slate-700/80 hover:text-slate-100
                  border border-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting === "pdf"
                  ? <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                  : <FileText className="w-3 h-3 shrink-0 text-blue-400" />}
                <span>{isExporting === "pdf" ? "Building PDF…" : "Export PDF report"}</span>
              </button>
            </div>
            {isExporting && (
              <p className="text-[10px] text-slate-600 mt-2 text-center animate-pulse">
                Rendering map, please wait…
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Detail panels (mutually exclusive) ── */}
      {selectedId != null && (
        <SelectedPanel selectedId={selectedId} onClose={() => setSelectedId(null)} />
      )}
      {selectedFacilityId != null && selectedId == null && (
        <FacilityPanel facilityId={selectedFacilityId} activeRadiusKm={catchmentRadiusKm} settlements={visibleSettlements} onClose={() => setSelectedFacilityId(null)} />
      )}

      {/* ── Map ── */}
      <div style={{ position: "absolute", inset: 0 }}>
        {LeafletMap ? (
          <MapComponent
            RL={LeafletMap.RL}
            L={LeafletMap.L}
            settlements={visibleSettlements}
            facilities={visibleFacilities}
            catchmentFacilities={catchmentFacilities}
            catchmentRadiusKm={catchmentRadiusKm}
            center={ZAMBIA_CENTER}
            defaultZoom={ZAMBIA_ZOOM}
            basemap={BASEMAPS[basemap]}
            showCatchment={showCatchment}
            showClusters={showClusters && clusterAvailable}
            clusterAvailable={clusterAvailable}
            colorByRisk={colorByRisk}
            colorByOutreach={colorByOutreach}
            onSelect={handleSelectSettlement}
            selectedId={selectedId}
            highlightedSettlementIds={highlightedSettlementIds}
            selectedFacilityId={selectedFacilityId}
            onSelectFacility={handleSelectFacility}
            facilityFlyTarget={facilityFlyTarget}
            onZoom={setZoomLevel}
            focusBounds={districtBounds}
            countryGeoJson={showCountryOutline ? countryGeoJson : null}
            provinceGeoJson={showProvinces ? provinceGeoJson : null}
            districtGeoJson={showDistricts ? districtGeoJson : null}
            onBoundaryProvince={handleBoundaryProvince}
            onBoundaryDistrict={handleBoundaryDistrict}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-950">
            <div className="text-center text-slate-600">
              <MapPin className="w-8 h-8 mx-auto mb-2 animate-pulse" />
              <p className="text-sm">Loading map…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── MapComponent (must NOT use hooks outside MapContainer) ─────────── */

function MapComponent({
  RL, L, settlements, facilities, catchmentFacilities, catchmentRadiusKm,
  center, defaultZoom, basemap, showCatchment, showClusters, clusterAvailable,
  colorByRisk, colorByOutreach, onSelect, selectedId, highlightedSettlementIds, selectedFacilityId,
  onSelectFacility, facilityFlyTarget, onZoom, focusBounds,
  countryGeoJson, provinceGeoJson, districtGeoJson, onBoundaryProvince, onBoundaryDistrict,
}: {
  L: any; RL: any;
  settlements: SettlementItem[];
  facilities: FacilityItem[];
  catchmentFacilities: FacilityItem[];
  catchmentRadiusKm: number;
  center: [number, number];
  defaultZoom: number;
  basemap: { url: string; attr: string };
  showCatchment: boolean;
  showClusters: boolean;
  clusterAvailable: boolean;
  colorByRisk: boolean;
  colorByOutreach: boolean;
  onSelect: (s: SettlementItem) => void;
  selectedId: number | null;
  highlightedSettlementIds: Set<number>;
  selectedFacilityId: number | null;
  onSelectFacility: (id: number) => void;
  facilityFlyTarget: { lat: number; lng: number; radiusKm: number } | null;
  onZoom: (z: number) => void;
  focusBounds: [[number, number], [number, number]] | null;
  countryGeoJson: any;
  provinceGeoJson: any;
  districtGeoJson: any;
  onBoundaryProvince: (name: string) => void;
  onBoundaryDistrict: (name: string) => void;
}) {
  const { MapContainer, TileLayer, CircleMarker, Tooltip, Circle, useMap, useMapEvents, GeoJSON } = RL;

  /* Force Leaflet to recalculate container size after DOM settles */
  function InvalidateOnMount() {
    const map = useMap();
    useEffect(() => {
      map.invalidateSize();
      const t = setTimeout(() => { map.invalidateSize(); }, 200);
      return () => clearTimeout(t);
    }, [map]);
    return null;
  }

  /* Inner component to handle map events */
  function EventHandler() {
    const map = useMap();
    useMapEvents({
      zoomend: () => onZoom(map.getZoom()),
    });
    return null;
  }

  /* Fly to district bounds when focusBounds changes */
  function FlyToBounds() {
    const map = useMap();
    useEffect(() => {
      if (!focusBounds) return;
      map.fitBounds(focusBounds, { padding: [40, 40], maxZoom: 11 });
    }, [map, focusBounds]);
    return null;
  }

  /* Fly to facility catchment area when a facility is selected */
  function FlyToFacility() {
    const map = useMap();
    useEffect(() => {
      if (!facilityFlyTarget) return;
      const { lat, lng, radiusKm } = facilityFlyTarget;
      const latOff = radiusKm / 111;
      const lngOff = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
      map.fitBounds(
        [[lat - latOff, lng - lngOff], [lat + latOff, lng + lngOff]],
        { padding: [60, 60], maxZoom: 12, animate: true, duration: 0.8 },
      );
    }, [map, facilityFlyTarget]);
    return null;
  }

  /* Reset view button inside map */
  function ResetViewButton() {
    const map = useMap();
    return (
      <div
        style={{
          position: "absolute", bottom: 32, right: 12, zIndex: 999,
          display: "flex", flexDirection: "column", gap: 4,
        }}
      >
        <button
          title="Reset to Zambia"
          onClick={() => map.setView(center, defaultZoom)}
          style={{
            width: 32, height: 32, background: "#1e293b", border: "1px solid #334155",
            borderRadius: 6, color: "#94a3b8", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
        </button>
      </div>
    );
  }

  /* Zoom +/- buttons */
  function ZoomButtons() {
    const map = useMap();
    const btnStyle = {
      width: 32, height: 32, background: "#1e293b", border: "1px solid #334155",
      color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: 18, fontWeight: "bold",
      boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
    };
    return (
      <div style={{ position: "absolute", bottom: 80, right: 12, zIndex: 999, display: "flex", flexDirection: "column", gap: 2 }}>
        <button title="Zoom in" onClick={() => map.zoomIn()}
          style={{ ...btnStyle, borderRadius: "6px 6px 0 0" }}>+</button>
        <button title="Zoom out" onClick={() => map.zoomOut()}
          style={{ ...btnStyle, borderRadius: "0 0 6px 6px", borderTop: "none" }}>−</button>
      </div>
    );
  }

  const tooltipStyle = {
    fontSize: 11, background: "#1e293b", color: "#e2e8f0",
    padding: "5px 9px", borderRadius: 6, border: "1px solid #334155",
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
    lineHeight: 1.5,
  };

  return (
    <MapContainer
      center={center}
      zoom={defaultZoom}
      style={{ height: "100%", width: "100%", background: "#0f172a" }}
      zoomControl={false}
      maxBounds={[[-18.5, 21.5], [-8.0, 34.0]]}
    >
      <TileLayer url={basemap.url} attribution={basemap.attr} maxZoom={19} />

      <InvalidateOnMount />
      <EventHandler />
      <FlyToBounds />
      <FlyToFacility />
      <ZoomButtons />
      <ResetViewButton />

      {/* ── Administrative boundary overlays (rendered first — bottom of stack) ── */}
      {countryGeoJson && GeoJSON && (
        <GeoJSON
          key="country-outline"
          data={countryGeoJson}
          style={() => ({
            color: "rgba(255,255,255,0.5)",
            weight: 2.5,
            fill: false,
            interactive: false,
          })}
        />
      )}
      {provinceGeoJson && GeoJSON && (
        <GeoJSON
          key="province-borders"
          data={provinceGeoJson}
          style={() => ({
            color: "#f59e0b",
            weight: 1.5,
            fillColor: "#f59e0b",
            fillOpacity: 0.04,
            dashArray: "5 4",
          })}
          onEachFeature={(feature: any, layer: any) => {
            const name: string = feature.properties?.NAME_1 ?? "Province";
            layer.bindTooltip(
              `<span style="font-weight:600;color:#fcd34d">${name}</span>&nbsp;Province`,
              { sticky: true, opacity: 0.95, className: "leaflet-tooltip-boundary" }
            );
            layer.on("click", () => onBoundaryProvince(name));
            layer.on("mouseover", () => layer.setStyle({ fillOpacity: 0.12, weight: 2 }));
            layer.on("mouseout",  () => layer.setStyle({ fillOpacity: 0.04, weight: 1.5 }));
          }}
        />
      )}
      {districtGeoJson && GeoJSON && (
        <GeoJSON
          key="district-borders"
          data={districtGeoJson}
          style={() => ({
            color: "#a78bfa",
            weight: 0.9,
            fillColor: "#a78bfa",
            fillOpacity: 0.02,
          })}
          onEachFeature={(feature: any, layer: any) => {
            const district: string = feature.properties?.NAME_2 ?? "District";
            const province: string = feature.properties?.NAME_1 ?? "";
            layer.bindTooltip(
              `<span style="font-weight:600;color:#c4b5fd">${district}</span><br/><span style="color:#94a3b8;font-size:10px">${province} Province</span>`,
              { sticky: true, opacity: 0.95, className: "leaflet-tooltip-boundary" }
            );
            layer.on("click", () => onBoundaryDistrict(district));
            layer.on("mouseover", () => layer.setStyle({ fillOpacity: 0.1, weight: 1.5 }));
            layer.on("mouseout",  () => layer.setStyle({ fillOpacity: 0.02, weight: 0.9 }));
          }}
        />
      )}

      {/* Catchment radius circles — rendered FIRST (bottom layer) so they sit under markers.
          Uses catchmentFacilities which is NOT zoom-gated the same way as facility markers,
          so circles remain visible even when individual markers are still clustered. */}
      {catchmentFacilities.map((f) => (
        <Circle
          key={`c-${f.id}`}
          center={[f.latitude, f.longitude]}
          radius={catchmentRadiusKm * 1000}
          pathOptions={{
            color: "#3b82f6",
            weight: 1,
            fillColor: "#3b82f6",
            fillOpacity: 0.06,
            dashArray: "5 4",
          }}
        />
      ))}

      {/* Settlement markers */}
      {showClusters ? (
        <ClusterLayer L={L} RL={RL} settlements={settlements} selectedId={selectedId}
          colorByRisk={colorByRisk} colorByOutreach={colorByOutreach} onSelect={onSelect} highlightedSettlementIds={highlightedSettlementIds} />
      ) : (
        settlements.map((s) => {
          const isHighlighted = highlightedSettlementIds.has(s.id);
          return (
            <CircleMarker
              key={s.id}
              center={[s.latitude, s.longitude]}
              radius={isHighlighted ? getRadius(s.population) + 3 : getRadius(s.population)}
              pathOptions={{
                fillColor: getSettlementColor(s, colorByRisk, colorByOutreach),
                fillOpacity: 0.85,
                color: selectedId === s.id ? "#ffffff" : isHighlighted ? "#facc15" : s.isNewSettlement ? "#a855f7" : "#0f172a",
                weight: selectedId === s.id ? 2.5 : isHighlighted ? 3 : s.isNewSettlement ? 2 : 1,
              }}
              eventHandlers={{ click: () => onSelect(s) }}
            >
              <Tooltip>
                <div style={tooltipStyle}>
                  <strong>{s.name}</strong><br />
                  Pop: {s.population.toLocaleString()} · {statusColors[s.serviceStatus]?.label}
                  {s.buildingCount ? <><br />Buildings: {s.buildingCount}</> : null}
                  {s.riskLevel ? <><br />Risk: {s.riskLevel.replace("_", " ")}</> : null}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })
      )}

      {/* Facility markers — clustered when clusterAvailable, otherwise individual CircleMarkers */}
      {facilities.length > 0 && (
        clusterAvailable ? (
          <FacilityClusterLayer L={L} RL={RL} facilities={facilities}
            selectedFacilityId={selectedFacilityId} onSelectFacility={onSelectFacility} />
        ) : (
          facilities.map((f) => {
            const isSelected = selectedFacilityId === f.id;
            return (
              <CircleMarker
                key={`f-${f.id}`}
                center={[f.latitude, f.longitude]}
                radius={isSelected ? 8 : 5}
                pathOptions={{
                  fillColor: isSelected ? "#60a5fa" : "#3b82f6",
                  fillOpacity: 0.85,
                  color: isSelected ? "#ffffff" : "#93c5fd",
                  weight: isSelected ? 2.5 : 1.5,
                }}
                eventHandlers={{ click: () => onSelectFacility(f.id) }}
              >
                <Tooltip>
                  <div style={tooltipStyle}>
                    <strong>{f.name}</strong><br />
                    {f.type}<br />
                    Catchment: {f.catchmentRadiusKm} km radius
                    {(f as any).province ? <><br />{(f as any).province} Province</> : null}
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })
        )
      )}
    </MapContainer>
  );
}

/* ─── Settlement cluster layer ────────────────────────────────────────── */

function ClusterLayer({ L, RL, settlements, selectedId, colorByRisk, colorByOutreach, onSelect, highlightedSettlementIds, paneName }: {
  L: any; RL: any;
  settlements: SettlementItem[];
  selectedId: number | null;
  colorByRisk: boolean;
  colorByOutreach: boolean;
  onSelect: (s: SettlementItem) => void;
  highlightedSettlementIds?: Set<number>;
  paneName?: string;
}) {
  const map = RL.useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!map || settlements.length === 0) return;

    const mcg = (window as any).L?.markerClusterGroup;
    if (!mcg) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    const clusterGroup = mcg({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const size = count > 100 ? 44 : count > 50 ? 38 : count > 20 ? 32 : 26;
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;background:rgba(16,185,129,0.85);border:2px solid rgba(255,255,255,0.4);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${count > 99 ? 10 : 12}px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);">${count}</div>`,
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    settlements.forEach((s) => {
      const color = getSettlementColor(s, colorByRisk, colorByOutreach);
      const r = getRadius(s.population);
      const isHighlighted = highlightedSettlementIds?.has(s.id) ?? false;
      const marker = L.circleMarker([s.latitude, s.longitude], {
        radius: isHighlighted ? r + 3 : r,
        fillColor: color,
        fillOpacity: 0.9,
        color: selectedId === s.id ? "#fff" : isHighlighted ? "#facc15" : (s.isNewSettlement ? "#a855f7" : "rgba(0,0,0,0.4)"),
        weight: selectedId === s.id ? 2.5 : isHighlighted ? 3 : (s.isNewSettlement ? 2 : 1),
        ...(paneName ? { pane: paneName } : {}),
      }).bindTooltip(`<div style="font-size:11px;background:#1e293b;color:#e2e8f0;padding:4px 8px;border-radius:6px;border:1px solid #334155;line-height:1.5"><strong>${s.name}</strong><br/>Pop: ${s.population.toLocaleString()} &middot; ${statusColors[s.serviceStatus]?.label}${s.riskLevel ? `<br/>Risk: ${s.riskLevel.replace("_", " ")}` : ""}${s.buildingCount ? `<br/>Buildings: ${s.buildingCount}` : ""}${isHighlighted ? "<br/><span style='color:#facc15'>● Within catchment</span>" : ""}</div>`, { sticky: false });
      marker.on("click", () => onSelect(s));
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    layerRef.current = clusterGroup;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, settlements, selectedId, colorByRisk, colorByOutreach, highlightedSettlementIds]);

  return null;
}

/* ─── Facility cluster layer ──────────────────────────────────────────── */

function FacilityClusterLayer({ L, RL, facilities, selectedFacilityId, onSelectFacility }: {
  L: any; RL: any;
  facilities: FacilityItem[];
  selectedFacilityId?: number | null;
  onSelectFacility?: (id: number) => void;
}) {
  const map = RL.useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    const mcg = (window as any).L?.markerClusterGroup;
    if (!mcg) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (facilities.length === 0) return;

    const clusterGroup = mcg({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const size = count > 100 ? 40 : count > 50 ? 34 : count > 10 ? 28 : 22;
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;background:rgba(59,130,246,0.85);border:2px solid rgba(147,197,253,0.6);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${count > 99 ? 9 : 11}px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(59,130,246,0.4);">${count}</div>`,
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    facilities.forEach((f) => {
      const isSelected = selectedFacilityId === f.id;
      const marker = L.circleMarker([f.latitude, f.longitude], {
        radius: isSelected ? 9 : 5,
        fillColor: isSelected ? "#60a5fa" : "#3b82f6",
        fillOpacity: 0.9,
        color: isSelected ? "#ffffff" : "#93c5fd",
        weight: isSelected ? 2.5 : 1.5,
      }).bindTooltip(
        `<div style="font-size:11px;background:#1e293b;color:#e2e8f0;padding:4px 8px;border-radius:6px;border:1px solid #334155;line-height:1.5"><strong>${f.name}</strong><br/>${f.type} · ${f.catchmentRadiusKm} km catchment${(f as any).province ? `<br/>${(f as any).province} Province` : ""}<br/><span style="color:#93c5fd;font-size:10px">Click to see covered settlements</span></div>`,
        { sticky: false }
      );
      if (onSelectFacility) {
        marker.on("click", () => onSelectFacility(f.id));
      }
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    layerRef.current = clusterGroup;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, facilities, selectedFacilityId, onSelectFacility]);

  return null;
}
