import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Calendar as CalendarIcon,
  MapPin,
  Users,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  Check,
  X,
  Layers,
  Sparkles,
  Info,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  ArrowRight,
  RefreshCw,
  Box,
  Map as MapIcon,
  Snowflake,
  AlertOctagon,
  Navigation,
  Globe2,
  Building2,
} from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { SessionPlan, Facility, District, Village, Province } from "@shared/schema";

interface SessionMatrixCalendarProps {
  sessions: SessionPlan[];
  facilities: Facility[];
  provinces?: Province[];
  districts?: District[];
  villages?: Village[];
  onAddSession?: () => void;
  onEditSession?: (session: SessionPlan) => void;
  onValidatePlan?: () => void;
  onResolveConflict?: (session: SessionPlan) => void;
  onOpenDayPlans?: (sessionId: number) => void;
  activeCadence?: string;
  onCadenceChange?: (cadence: string) => void;
  isCreator?: boolean;
}

// ── Leaflet Helper Components ────────────────────────────────────────────────
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t1 = setTimeout(fix, 100);
    const t2 = setTimeout(fix, 400);
    const ro = new ResizeObserver(fix);
    ro.observe(map.getContainer());
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

function MapBoundsAdjuster({ facilities }: { facilities: Facility[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = facilities.filter(
      (f) =>
        f.latitude &&
        f.longitude &&
        !isNaN(Number(f.latitude)) &&
        !isNaN(Number(f.longitude)) &&
        Number(f.latitude) !== 0 &&
        Number(f.longitude) !== 0
    );

    if (valid.length > 0) {
      const bounds = L.latLngBounds(
        valid.map((f) => [Number(f.latitude), Number(f.longitude)] as [number, number])
      );
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }
  }, [facilities, map]);
  return null;
}

export function SessionMatrixCalendar({
  sessions,
  facilities,
  provinces: propsProvinces = [],
  districts = [],
  villages = [],
  onAddSession,
  onEditSession,
  onValidatePlan,
  onResolveConflict,
  onOpenDayPlans,
  activeCadence = "PIRI",
  onCadenceChange,
  isCreator = true,
}: SessionMatrixCalendarProps) {
  // Fetch provinces if not provided
  const { data: fetchedProvinces = [] } = useQuery<Province[]>({
    queryKey: ["/api/provinces"],
    enabled: (!propsProvinces || propsProvinces.length === 0),
  });
  const allProvinces = propsProvinces?.length ? propsProvinces : fetchedProvinces;

  // --- States ---
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-indexed (e.g. 9 = October)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<"calendar" | "map" | "coldchain">("calendar");
  const [searchQuery, setSearchQuery] = useState("");

  // Smart Cascade Geographic Filters: Province -> District -> Facility
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("all");

  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({
    Routine: true,
    PIRI: true,
    ORI: true,
    SIA: false,
  });
  const [dateRangeOffset, setDateRangeOffset] = useState<number>(0);

  // Cascade 1: Available Districts based on selected Province
  const availableDistricts = useMemo(() => {
    if (selectedProvince === "all") return districts;
    return districts.filter((d) => d.provinceId === Number(selectedProvince));
  }, [districts, selectedProvince]);

  // Cascade 2: Available Facilities based on selected District and Province
  const availableFacilities = useMemo(() => {
    if (selectedDistrict !== "all") {
      return facilities.filter((f) => f.districtId === Number(selectedDistrict));
    }
    if (selectedProvince !== "all") {
      const provDistrictIds = new Set(
        districts
          .filter((d) => d.provinceId === Number(selectedProvince))
          .map((d) => d.id)
      );
      return facilities.filter((f) => f.districtId && provDistrictIds.has(f.districtId));
    }
    return facilities;
  }, [facilities, districts, selectedProvince, selectedDistrict]);

  // Filter facilities by cascade and search
  const filteredFacilities = useMemo(() => {
    return availableFacilities.filter((f) => {
      if (selectedFacilityId !== "all" && f.id !== Number(selectedFacilityId)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          f.name.toLowerCase().includes(q) ||
          (f.hmisCode && f.hmisCode.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [availableFacilities, selectedFacilityId, searchQuery]);

  // Handle cascading resets
  const handleProvinceChange = (newProv: string) => {
    setSelectedProvince(newProv);
    setSelectedDistrict("all");
    setSelectedFacilityId("all");
  };

  const handleDistrictChange = (newDist: string) => {
    setSelectedDistrict(newDist);
    setSelectedFacilityId("all");
  };

  const handleClearFilters = () => {
    setSelectedProvince("all");
    setSelectedDistrict("all");
    setSelectedFacilityId("all");
    setSearchQuery("");
  };

  // Month names
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Days in selected month
  const totalDaysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Display date columns (window of 5 days for crisp tabular view)
  const visibleDays = useMemo(() => {
    const days: number[] = [];
    const start = Math.min(Math.max(1, dateRangeOffset * 5 + 1), Math.max(1, totalDaysInMonth - 4));
    for (let i = 0; i < 5 && (start + i) <= totalDaysInMonth; i++) {
      days.push(start + i);
    }
    return days;
  }, [dateRangeOffset, totalDaysInMonth]);

  // Conflict Detection Engine (5km & same-day check)
  const sessionConflicts = useMemo(() => {
    const map = new Map<number, { hasConflict: boolean; reason?: string; conflictingSession?: SessionPlan; distanceKm?: number }>();
    
    sessions.forEach((s1) => {
      if (!s1.scheduledDate) return;
      const d1 = new Date(s1.scheduledDate).toISOString().split("T")[0];
      const f1 = facilities.find((f) => f.id === s1.facilityId);

      // Check against other sessions
      for (const s2 of sessions) {
        if (s1.id === s2.id || !s2.scheduledDate) continue;
        const d2 = new Date(s2.scheduledDate).toISOString().split("T")[0];
        if (d1 === d2) {
          const f2 = facilities.find((f) => f.id === s2.facilityId);
          // If same facility or within close proximity (< 5km)
          if (s1.facilityId === s2.facilityId && s1.sessionType === s2.sessionType) {
            map.set(s1.id, {
              hasConflict: true,
              reason: `Duplicate same-day session at ${f1?.name || "Facility"}`,
              conflictingSession: s2,
              distanceKm: 0,
            });
            break;
          } else if (f1?.latitude && f1?.longitude && f2?.latitude && f2?.longitude) {
            // Rough distance approx
            const latDiff = (Number(f1.latitude) - Number(f2.latitude)) * 111;
            const lngDiff = (Number(f1.longitude) - Number(f2.longitude)) * 111 * Math.cos(Number(f1.latitude) * (Math.PI / 180));
            const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
            if (dist < 5.0 && s1.sessionType !== "static" && s2.sessionType !== "static") {
              map.set(s1.id, {
                hasConflict: true,
                reason: `Proximity Clash with ${s2.name || f2.name} (${dist.toFixed(1)} km apart on same day)`,
                conflictingSession: s2,
                distanceKm: dist,
              });
              break;
            }
          }
        }
      }
    });

    return map;
  }, [sessions, facilities]);

  // Metric stats
  const totalSessionsCount = sessions.length;
  const conflictCount = useMemo(() => {
    let count = 0;
    sessionConflicts.forEach((v) => {
      if (v.hasConflict) count++;
    });
    return count;
  }, [sessionConflicts]);

  const piriSessionsCount = useMemo(() => {
    return sessions.filter((s) => s.sessionType?.toLowerCase().includes("piri") || s.name?.toLowerCase().includes("piri")).length;
  }, [sessions]);

  // Helper to get sessions for a facility and day
  const getSessionsForFacilityDay = (facilityId: number, day: number) => {
    return sessions.filter((s) => {
      if (s.facilityId !== facilityId) return false;
      if (!s.scheduledDate) return false;
      const d = new Date(s.scheduledDate);
      return (
        d.getFullYear() === selectedYear &&
        d.getMonth() === selectedMonth &&
        d.getDate() === day
      );
    });
  };

  // Helper to calculate facility total quota in month
  const getFacilityQuota = (facilityId: number) => {
    return sessions
      .filter((s) => s.facilityId === facilityId)
      .reduce((sum, s) => sum + (s.targetPopulation || 0), 0);
  };

  // Helper to calculate cold chain liters for facility
  const getFacilityColdChainLiters = (facilityId: number) => {
    const quota = getFacilityQuota(facilityId);
    return (Math.max(1.4, (quota / 100) * 1.2)).toFixed(1);
  };

  // Default map center coordinates (calculated from facilities or default Southern Africa center)
  const defaultCenter = useMemo<[number, number]>(() => {
    const withCoords = facilities.filter((f) => f.latitude && f.longitude);
    if (withCoords.length > 0) {
      const avgLat = withCoords.reduce((acc, f) => acc + Number(f.latitude), 0) / withCoords.length;
      const avgLng = withCoords.reduce((acc, f) => acc + Number(f.longitude), 0) / withCoords.length;
      return [avgLat, avgLng];
    }
    return [-28.4793, 24.6727]; // South Africa / Regional default
  }, [facilities]);

  const hasActiveFilters = selectedProvince !== "all" || selectedDistrict !== "all" || selectedFacilityId !== "all" || searchQuery.trim() !== "";

  return (
    <div className="space-y-4">
      {/* ── 1. Top Chevron Stepper ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-1.5 p-1 bg-muted/60 rounded-xl border">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-xs shadow-sm">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
            <Check className="h-3 w-3" />
          </div>
          <div className="truncate">
            <span className="font-bold">1. Baseline Targets</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-xs shadow-sm">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
            <Check className="h-3 w-3" />
          </div>
          <div className="truncate">
            <span className="font-bold">2. Cadence Strategy</span>
            <span className="block text-[10px] opacity-80">Routine, PIRI, ORI, SIA</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-indigo-900 text-white font-semibold text-xs shadow-md border border-indigo-700">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold">
            3
          </div>
          <div className="truncate">
            <span className="font-bold">3. Session Scheduling</span>
            <span className="block text-[10px] text-indigo-200">Proximity Clash Validator</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-muted text-muted-foreground font-medium text-xs">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground font-bold">
            4
          </div>
          <div className="truncate">
            <span className="font-medium">4. Budget & Forecast</span>
          </div>
        </div>
      </div>

      {/* ── 2. Main 3-Column Layout ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* Left Column: Smart Cascade Filter & Control Sidebar */}
        <Card className="lg:col-span-3 space-y-4">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-500" />
                Session Parameters
              </CardTitle>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            
            {/* Session Types Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Session Types
              </Label>
              <div className="space-y-1.5">
                {[
                  { key: "Routine", label: "Routine (Fixed & Outreach)" },
                  { key: "PIRI", label: "PIRI (Periodic Intensification)" },
                  { key: "ORI", label: "ORI (Outbreak Response)" },
                  { key: "SIA", label: "SIA (Mass Campaigns)" },
                ].map((t) => (
                  <label
                    key={t.key}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      selectedTypes[t.key]
                        ? "bg-indigo-50 border-indigo-200 text-indigo-950 font-medium dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-200"
                        : "bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span>{t.label}</span>
                    <Checkbox
                      checked={!!selectedTypes[t.key]}
                      onCheckedChange={(c) =>
                        setSelectedTypes({ ...selectedTypes, [t.key]: !!c })
                      }
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Smart Cascade Geographic Filters */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Navigation className="h-3.5 w-3.5 text-indigo-600" />
                  Smart Location Cascade
                </Label>
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {filteredFacilities.length} {filteredFacilities.length === 1 ? 'Facility' : 'Facilities'}
                </Badge>
              </div>

              {/* Province / State Level */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Globe2 className="h-3 w-3" /> Province / Region
                </Label>
                <Select value={selectedProvince} onValueChange={handleProvinceChange}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="All Provinces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Provinces</SelectItem>
                    {allProvinces.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* District / Administrative Area Level */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> District / Admin Area
                </Label>
                <Select value={selectedDistrict} onValueChange={handleDistrictChange}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="All Districts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts ({availableDistricts.length})</SelectItem>
                    {availableDistricts.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Facility / Health Center Level */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Health Facility
                </Label>
                <Select value={selectedFacilityId} onValueChange={setSelectedFacilityId}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="All Facilities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Facilities ({availableFacilities.length})</SelectItem>
                    {availableFacilities.map((f) => (
                      <SelectItem key={f.id} value={f.id.toString()}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Month & Year Selector */}
            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Planning Month
              </Label>
              <Select
                value={`${selectedYear}-${selectedMonth}`}
                onValueChange={(val) => {
                  const [y, m] = val.split("-").map(Number);
                  setSelectedYear(y);
                  setSelectedMonth(m);
                }}
              >
                <SelectTrigger className="text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[selectedYear - 1, selectedYear, selectedYear + 1].flatMap((y) =>
                    monthNames.map((name, m) => (
                      <SelectItem key={`${y}-${m}`} value={`${y}-${m}`}>
                        {name} {y}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Cadence Quick Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Delivery Cadence
              </Label>
              <Select
                value={activeCadence}
                onValueChange={(v) => onCadenceChange?.(v)}
              >
                <SelectTrigger className="text-xs font-semibold h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Routine">Routine Regular</SelectItem>
                  <SelectItem value="PIRI">PIRI Catch-up Round</SelectItem>
                  <SelectItem value="ORI">ORI Outbreak Reactive</SelectItem>
                  <SelectItem value="SIA">SIA Supplementary Mass</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onValidatePlan}
              className="w-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 border-0 shadow-sm"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              Validate Plan & Clash Rules
            </Button>
          </CardContent>
        </Card>

        {/* Center Column: Interactive Calendar Matrix & GIS Clash Map Workspace */}
        <Card className="lg:col-span-6 space-y-4">
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <span>Session Scheduling & Proximity Clash Validator</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Interactive multi-facility calendar matrix with live 5km clash detection.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isCreator && (
                  <Button
                    size="sm"
                    onClick={onAddSession}
                    className="text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Session
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onValidatePlan}
                  className="text-xs font-semibold bg-indigo-900 text-white hover:bg-indigo-950 border-0"
                >
                  Validate Plan
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {/* Toolbar: Month Navigation, View Switchers, Search */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-foreground">
                  {monthNames[selectedMonth]} {selectedYear}
                </span>
                {viewMode === "calendar" && (
                  <div className="flex items-center ml-2 border rounded-md overflow-hidden bg-background">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-none"
                      onClick={() => {
                        if (dateRangeOffset > 0) setDateRangeOffset(dateRangeOffset - 1);
                      }}
                      disabled={dateRangeOffset <= 0}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-none"
                      onClick={() => setDateRangeOffset(dateRangeOffset + 1)}
                      disabled={(dateRangeOffset + 1) * 5 >= totalDaysInMonth}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* View Switchers */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("calendar")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    viewMode === "calendar"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" /> Calendar
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("map")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    viewMode === "map"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    <MapIcon className="h-3 w-3" /> Map
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("coldchain")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    viewMode === "coldchain"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    <Snowflake className="h-3 w-3" /> Cold Chain
                  </span>
                </button>
              </div>

              {/* Quick Search */}
              <div className="relative w-full sm:w-44">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search facilities…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {/* ── 1. Calendar Matrix Grid Table ── */}
            {viewMode === "calendar" && (
              <div className="rounded-xl border overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse min-w-[620px]">
                  <thead>
                    <tr className="bg-muted/80 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b">
                      <th className="p-2.5 min-w-[140px]">Facilities ⇅</th>
                      {visibleDays.map((day) => (
                        <th key={day} className="p-2.5 text-center min-w-[110px] border-l">
                          {monthNames[selectedMonth].slice(0, 3)} {day}
                        </th>
                      ))}
                      <th className="p-2.5 text-right min-w-[70px] border-l">Quota ⇅</th>
                      <th className="p-2.5 text-right min-w-[85px] border-l">Cold Chain ⇅</th>
                      <th className="p-2.5 text-center min-w-[70px] border-l">Conflicts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {filteredFacilities.slice(0, 10).map((facility) => {
                      const facilityQuota = getFacilityQuota(facility.id);
                      const coldChainLiters = getFacilityColdChainLiters(facility.id);
                      
                      const facilitySessions = sessions.filter((s) => s.facilityId === facility.id);
                      const hasClash = facilitySessions.some((s) => sessionConflicts.get(s.id)?.hasConflict);

                      return (
                        <tr key={facility.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-2.5 font-semibold text-foreground align-top">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{facility.name}</span>
                            </div>
                            {facility.hmisCode && (
                              <span className="text-[10px] text-muted-foreground pl-4">
                                {facility.hmisCode}
                              </span>
                            )}
                          </td>

                          {/* Day Columns */}
                          {visibleDays.map((day) => {
                            const daySessions = getSessionsForFacilityDay(facility.id, day);
                            return (
                              <td key={day} className="p-1.5 align-top border-l bg-background/50">
                                {daySessions.length === 0 ? (
                                  <div className="h-14 rounded-md border border-dashed border-muted flex items-center justify-center opacity-30 hover:opacity-100 hover:border-indigo-300 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={onAddSession}
                                      className="text-[10px] text-muted-foreground hover:text-indigo-600"
                                      title="Add session on this date"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    {daySessions.map((session) => {
                                      const conflict = sessionConflicts.get(session.id);
                                      const isClash = conflict?.hasConflict;
                                      const isHouse = session.sessionType?.toLowerCase().includes("house") || session.name?.toLowerCase().includes("house");
                                      const isMobile = session.sessionType?.toLowerCase().includes("mobile") || session.sessionType?.toLowerCase().includes("outreach");

                                      return (
                                        <Popover key={session.id}>
                                          <PopoverTrigger asChild>
                                            <div
                                              role="button"
                                              tabIndex={0}
                                              className={`p-2 rounded-lg border text-[11px] cursor-pointer shadow-xs transition-transform hover:scale-[1.02] ${
                                                isClash
                                                  ? "bg-red-50/90 border-red-300 text-red-950 font-semibold"
                                                  : isHouse
                                                  ? "bg-amber-50/90 border-amber-300 text-amber-950"
                                                  : isMobile
                                                  ? "bg-teal-50/90 border-teal-300 text-teal-950"
                                                  : "bg-emerald-50/90 border-emerald-300 text-emerald-950"
                                              }`}
                                            >
                                              <div className="font-bold truncate">
                                                {session.name || (session.sessionType === "static" ? "Fixed Post" : "Mobile Outreach")}
                                              </div>
                                              <div className="text-[10px] opacity-85 truncate">
                                                Quota: {session.targetPopulation || 120}
                                              </div>
                                              {isClash ? (
                                                <div className="text-[10px] text-red-600 font-bold flex items-center gap-1 mt-0.5">
                                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                                  CLASH ⚠️
                                                </div>
                                              ) : (
                                                <div className="text-[10px] text-emerald-700 flex items-center gap-0.5 mt-0.5">
                                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                                  Confirmed
                                                </div>
                                              )}
                                            </div>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-72 p-3 text-xs space-y-2.5 z-50">
                                            <div className="border-b pb-2">
                                              <p className="font-bold text-sm text-foreground">
                                                {facility.name} — {session.name}
                                              </p>
                                              <p className="text-[11px] text-muted-foreground">
                                                Date: {monthNames[selectedMonth]} {day}, {selectedYear}
                                              </p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                              <div>
                                                <span className="text-muted-foreground">Type:</span>
                                                <p className="font-semibold capitalize">{session.sessionType}</p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">Target Quota:</span>
                                                <p className="font-semibold">{session.targetPopulation || 120} infants</p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">Cold Chain:</span>
                                                <p className="font-semibold">~1.5 L (Allocated)</p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">Transport:</span>
                                                <p className="font-semibold capitalize">{session.transportMode || "Foot/Motorcycle"}</p>
                                              </div>
                                            </div>

                                            {isClash && (
                                              <div className="p-2 rounded-md bg-red-50 border border-red-200 text-red-900 text-[11px] space-y-1">
                                                <p className="font-bold flex items-center gap-1 text-red-700">
                                                  <AlertTriangle className="h-3.5 w-3.5" />
                                                  Conflict / Clash Alert
                                                </p>
                                                <p>{conflict?.reason}</p>
                                              </div>
                                            )}

                                            <div className="flex items-center justify-end gap-1.5 pt-1 border-t">
                                              {isClash && (
                                                <Button
                                                  size="sm"
                                                  variant="destructive"
                                                  className="h-7 text-[10px] px-2"
                                                  onClick={() => onResolveConflict?.(session)}
                                                >
                                                  Resolve / Re-plan
                                                </Button>
                                              )}
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-[10px] px-2"
                                                onClick={() => onEditSession?.(session)}
                                              >
                                                Edit
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="default"
                                                className="h-7 text-[10px] px-2 bg-indigo-600 text-white hover:bg-indigo-700"
                                                onClick={() => onOpenDayPlans?.(session.id)}
                                              >
                                                Day Plans
                                              </Button>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {/* Quota Column */}
                          <td className="p-2.5 text-right font-medium tabular-nums align-top border-l">
                            {facilityQuota > 0 ? facilityQuota.toLocaleString() : "-"}
                          </td>

                          {/* Cold Chain Liters Column */}
                          <td className="p-2.5 text-right font-medium tabular-nums align-top border-l text-sky-700 dark:text-sky-400">
                            {coldChainLiters} L
                          </td>

                          {/* Conflicts Indicator */}
                          <td className="p-2.5 text-center align-top border-l">
                            {hasClash ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-100 text-red-700 font-bold text-xs" title="Conflicts detected">
                                ⚠️
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs" title="No conflicts">
                                ✓
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── 2. Interactive GIS Clash & Route Map ── */}
            {viewMode === "map" && (
              <div className="space-y-3">
                <div className="h-[460px] w-full rounded-xl overflow-hidden border shadow-sm relative">
                  <MapContainer
                    center={defaultCenter}
                    zoom={9}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={true}
                  >
                    <InvalidateSize />
                    <MapBoundsAdjuster facilities={filteredFacilities} />
                    <TileLayer
                      attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />

                    {filteredFacilities.map((facility) => {
                      if (!facility.latitude || !facility.longitude) return null;
                      const lat = Number(facility.latitude);
                      const lng = Number(facility.longitude);
                      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;

                      const facilitySessions = sessions.filter((s) => s.facilityId === facility.id);
                      const hasClash = facilitySessions.some((s) => sessionConflicts.get(s.id)?.hasConflict);
                      const hasScheduled = facilitySessions.length > 0;

                      const markerColor = hasClash ? "#ef4444" : hasScheduled ? "#10b981" : "#6366f1";
                      const markerRadius = hasClash ? 9 : hasScheduled ? 8 : 6;

                      return (
                        <React.Fragment key={facility.id}>
                          {/* 5km Proximity Buffer Zone if Clashing */}
                          {hasClash && (
                            <Circle
                              center={[lat, lng]}
                              radius={5000} // 5km
                              pathOptions={{
                                color: "#ef4444",
                                fillColor: "#ef4444",
                                fillOpacity: 0.12,
                                weight: 1.5,
                                dashArray: "4, 6",
                              }}
                            />
                          )}

                          <CircleMarker
                            center={[lat, lng]}
                            radius={markerRadius}
                            pathOptions={{
                              color: "#ffffff",
                              weight: 2,
                              fillColor: markerColor,
                              fillOpacity: 0.95,
                            }}
                          >
                            <Tooltip direction="top" offset={[0, -6]}>
                              <div className="font-semibold text-xs">{facility.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {hasClash ? "⚠️ Proximity Clash Detected" : hasScheduled ? `✓ ${facilitySessions.length} Scheduled Sessions` : "No sessions scheduled"}
                              </div>
                            </Tooltip>
                            <Popup className="text-xs">
                              <div className="p-1 space-y-2 min-w-[200px]">
                                <div className="border-b pb-1.5">
                                  <h4 className="font-bold text-sm text-foreground">{facility.name}</h4>
                                  <p className="text-[11px] text-muted-foreground">{facility.hmisCode || "Health Facility"}</p>
                                </div>

                                <div className="space-y-1 text-[11px]">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Month Planned Sessions:</span>
                                    <span className="font-semibold">{facilitySessions.length}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Target Quota:</span>
                                    <span className="font-semibold">{getFacilityQuota(facility.id).toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cold Chain:</span>
                                    <span className="font-semibold text-sky-700">{getFacilityColdChainLiters(facility.id)} L</span>
                                  </div>
                                </div>

                                {hasClash && (
                                  <div className="p-1.5 rounded bg-red-50 border border-red-200 text-red-800 text-[10px] font-medium">
                                    ⚠️ 5km Proximity Clash on scheduled outreach dates.
                                  </div>
                                )}

                                <div className="pt-1.5 border-t flex justify-end gap-1.5">
                                  {isCreator && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[10px] px-2"
                                      onClick={onAddSession}
                                    >
                                      <Plus className="h-2.5 w-2.5 mr-1" /> Add Session
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </Popup>
                          </CircleMarker>
                        </React.Fragment>
                      );
                    })}
                  </MapContainer>

                  {/* Map Floating Legend */}
                  <div className="absolute bottom-3 right-3 z-[1000] bg-background/90 backdrop-blur-md p-2.5 rounded-lg border shadow-md text-[11px] space-y-1.5 pointer-events-auto">
                    <p className="font-bold text-xs">GIS Clash Legend</p>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-emerald-500 border border-white inline-block"></span>
                      <span>Confirmed Sessions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-red-500 border border-white inline-block"></span>
                      <span>5km Clash Conflict</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-indigo-500 border border-white inline-block"></span>
                      <span>Facility (Unscheduled)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border border-dashed border-red-500 bg-red-100/50 inline-block"></span>
                      <span>5km Proximity Buffer</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 3. View Mode: Cold Chain Storage Breakdown ── */}
            {viewMode === "coldchain" && (
              <div className="p-4 rounded-xl border bg-sky-50/40 dark:bg-sky-950/20 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Snowflake className="h-4 w-4 text-sky-600" />
                    Cold Chain Storage & Vaccine Carrier Allocation
                  </h3>
                  <Badge variant="outline" className="text-sky-700 border-sky-300">
                    WHO CCEOP Compliant
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  Estimated cold box capacity, freeze-tag monitors, and ice pack conditioning per facility outreach team.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-lg border bg-background space-y-1">
                    <p className="text-muted-foreground text-[11px]">Total Net Liters Needed</p>
                    <p className="text-xl font-bold text-sky-700">42.8 Liters</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-background space-y-1">
                    <p className="text-muted-foreground text-[11px]">Vaccine Carriers Required</p>
                    <p className="text-xl font-bold text-indigo-700">28 Units</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-background space-y-1">
                    <p className="text-muted-foreground text-[11px]">0.6L Ice Packs Conditioned</p>
                    <p className="text-xl font-bold text-emerald-700">112 Packs</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Conflict & Clash Summary Card */}
        <Card className="lg:col-span-3 space-y-4">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>Conflict & Clash Summary</span>
              {conflictCount > 0 ? (
                <Badge variant="destructive" className="text-[11px] px-1.5">
                  {conflictCount} Active ⚠️
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[11px] border-0">
                  All Clear ✓
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5 pt-4 text-xs">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/40">
                <span className="text-muted-foreground">Total Sessions:</span>
                <span className="font-bold text-sm text-foreground">{totalSessionsCount}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg border bg-red-50/70 border-red-200 text-red-900">
                <span className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  Conflicts Detected:
                </span>
                <span className="font-bold text-sm text-red-700">{conflictCount} (⚠️)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg border bg-emerald-50/70 border-emerald-200 text-emerald-900">
                <span className="font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Resolved / Safe:
                </span>
                <span className="font-bold text-sm text-emerald-700">
                  {Math.max(0, totalSessionsCount - conflictCount)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/40">
                <span className="text-muted-foreground">PIRI Cadence Sessions:</span>
                <span className="font-bold text-sm text-indigo-700">{piriSessionsCount}</span>
              </div>
            </div>

            {conflictCount > 0 && (
              <div className="p-3 rounded-lg border border-red-200 bg-red-50/50 space-y-2 text-[11px]">
                <p className="font-semibold text-red-900">Recommended Actions:</p>
                <ul className="list-disc pl-4 text-red-800 space-y-1">
                  <li>Stagger outreach dates to eliminate same-day team collisions.</li>
                  <li>Merge nearby venues into single consolidated mobile points.</li>
                  <li>Verify vaccinator lead allocations in Day Plans.</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
