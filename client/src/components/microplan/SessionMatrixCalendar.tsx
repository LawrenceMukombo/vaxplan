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
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  usePersistedBasemap,
  BasemapTileLayer,
  BasemapSwitcher,
} from "@/components/map/BasemapToggle";
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
  Lock,
} from "lucide-react";
import { MapContainer, CircleMarker, Circle, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { SessionPlan, Facility, District, Village, Province, PopulationData } from "@shared/schema";

interface SessionMatrixCalendarProps {
  sessions: SessionPlan[];
  facilities: Facility[];
  provinces?: Province[];
  districts?: District[];
  villages?: Village[];
  initialFacilityId?: number;
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
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
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
  initialFacilityId,
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

  // Fetch population data records for target population fallback
  const { data: populationRecords = [] } = useQuery<PopulationData[]>({
    queryKey: ["/api/population"],
  });

  // Basemap persistence (clean raster/vector without watermark)
  const [basemap, setBasemap] = usePersistedBasemap("vaxplan_streets");

  // Helper to parse session scheduledDate safely without UTC day-shifting
  const parseSessionDate = (scheduledDate: string | Date | null | undefined): { year: number; month: number; day: number; dateKey: string } | null => {
    if (!scheduledDate) return null;
    if (typeof scheduledDate === "string") {
      const match = scheduledDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // 0-indexed
        const day = parseInt(match[3], 10);
        const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return { year, month, day, dateKey };
      }
    }
    const d = new Date(scheduledDate);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { year, month, day, dateKey };
  };

  // --- States ---
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<"calendar" | "map" | "coldchain">("calendar");
  const [dayViewMode, setDayViewMode] = useState<"all" | "window">("all");
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

  // Auto-select initial facility from parent microplan on mount
  useEffect(() => {
    if (initialFacilityId && facilities.length > 0) {
      const fac = facilities.find((f) => f.id === Number(initialFacilityId));
      if (fac) {
        setSelectedFacilityId(String(fac.id));
        if (fac.districtId) {
          setSelectedDistrict(String(fac.districtId));
          const dist = districts.find((d) => d.id === fac.districtId);
          if (dist?.provinceId) {
            setSelectedProvince(String(dist.provinceId));
          }
        }
      }
    }
  }, [initialFacilityId, facilities, districts]);

  // Cascade 1: Available Districts based on selected Province
  const availableDistricts = useMemo(() => {
    if (selectedProvince === "all") return [];
    return districts.filter((d) => d.provinceId === Number(selectedProvince));
  }, [districts, selectedProvince]);

  // Cascade 2: Available Facilities based on selected District
  const availableFacilities = useMemo(() => {
    if (selectedDistrict === "all") return [];
    return facilities.filter((f) => f.districtId === Number(selectedDistrict));
  }, [facilities, selectedDistrict]);

  // Facilities that have at least one session in this microplan/view
  const facilitiesWithSessions = useMemo(() => {
    const ids = new Set(sessions.map((s) => s.facilityId).filter(Boolean));
    return facilities.filter((f) => ids.has(f.id));
  }, [sessions, facilities]);

  // Filter facilities by cascade and search.
  // Default (no cascade active): show only facilities that have sessions so
  // the matrix isn't swamped with 4000+ empty rows when the user first loads.
  // When ANY cascade level is set, expand to that geographic pool.
  const filteredFacilities = useMemo(() => {
    let pool: Facility[];

    if (selectedDistrict !== "all") {
      // Level 3: district chosen — show all facilities in that district
      pool = availableFacilities;
    } else if (selectedProvince !== "all") {
      // Level 2: province chosen — show all facilities in province districts
      const provDistrictIds = new Set(
        districts
          .filter((d) => d.provinceId === Number(selectedProvince))
          .map((d) => d.id)
      );
      pool = facilities.filter((f) => f.districtId && provDistrictIds.has(f.districtId));
    } else if (searchQuery.trim()) {
      // Search override — scan all facilities
      pool = facilities;
    } else {
      // Default: show only facilities that have sessions
      pool = facilitiesWithSessions.length > 0 ? facilitiesWithSessions : facilities;
    }

    return pool.filter((f) => {
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
  }, [facilities, districts, facilitiesWithSessions, availableFacilities, selectedProvince, selectedDistrict, selectedFacilityId, searchQuery]);

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

  const handleFacilityChange = (newFacId: string) => {
    setSelectedFacilityId(newFacId);
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

  // Smart Session Summary for the currently active/selected facility
  const facilitySessionsSummary = useMemo(() => {
    const targetFacId = selectedFacilityId !== "all" 
      ? Number(selectedFacilityId) 
      : (initialFacilityId ? Number(initialFacilityId) : (facilitiesWithSessions[0]?.id ?? null));

    if (!targetFacId) return { targetFacility: null, sessionsInMonth: [], sessionsInOtherMonths: [], allFacSessions: [] };

    const targetFacility = facilities.find((f) => f.id === targetFacId) ?? null;
    const facSessions = sessions.filter((s) => s.facilityId === targetFacId);

    const sessionsInMonth: Array<{ session: SessionPlan; day: number; dateKey: string }> = [];
    const sessionsInOtherMonths: Array<{ session: SessionPlan; year: number; month: number; day: number; dateKey: string }> = [];

    facSessions.forEach((s) => {
      const p = parseSessionDate(s.scheduledDate);
      if (!p) return;
      if (p.year === selectedYear && p.month === selectedMonth) {
        sessionsInMonth.push({ session: s, day: p.day, dateKey: p.dateKey });
      } else {
        sessionsInOtherMonths.push({ session: s, year: p.year, month: p.month, day: p.day, dateKey: p.dateKey });
      }
    });

    sessionsInMonth.sort((a, b) => a.day - b.day);
    sessionsInOtherMonths.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    return { targetFacility, sessionsInMonth, sessionsInOtherMonths, allFacSessions: facSessions };
  }, [selectedFacilityId, initialFacilityId, facilitiesWithSessions, facilities, sessions, selectedYear, selectedMonth]);

  // Auto-jump month when selecting a facility that has sessions in a different month
  useEffect(() => {
    const targetFacId = selectedFacilityId !== "all" 
      ? Number(selectedFacilityId) 
      : (initialFacilityId ? Number(initialFacilityId) : null);

    if (!targetFacId) return;

    const facSessions = sessions.filter((s) => s.facilityId === targetFacId);
    if (facSessions.length === 0) return;

    const currentHas = facSessions.some((s) => {
      const p = parseSessionDate(s.scheduledDate);
      return p && p.year === selectedYear && p.month === selectedMonth;
    });

    if (!currentHas) {
      // Find first session date and switch to it automatically
      for (const s of facSessions) {
        const p = parseSessionDate(s.scheduledDate);
        if (p) {
          setSelectedYear(p.year);
          setSelectedMonth(p.month);
          setDateRangeOffset(Math.floor((p.day - 1) / 5));
          break;
        }
      }
    }
  }, [selectedFacilityId, initialFacilityId, sessions]);

  // Display date columns: either all days (1..totalDaysInMonth) with horizontal scroll, or 5-day window
  const visibleDays = useMemo(() => {
    if (dayViewMode === "all") {
      const days: number[] = [];
      for (let i = 1; i <= totalDaysInMonth; i++) {
        days.push(i);
      }
      return days;
    }
    const days: number[] = [];
    const start = Math.min(Math.max(1, dateRangeOffset * 5 + 1), Math.max(1, totalDaysInMonth - 4));
    for (let i = 0; i < 5 && (start + i) <= totalDaysInMonth; i++) {
      days.push(start + i);
    }
    return days;
  }, [dayViewMode, dateRangeOffset, totalDaysInMonth]);

  // Conflict Detection Engine (5km & same-day check)
  const sessionConflicts = useMemo(() => {
    const map = new Map<number, { hasConflict: boolean; reason?: string; conflictingSession?: SessionPlan; distanceKm?: number }>();
    
    sessions.forEach((s1) => {
      const p1 = parseSessionDate(s1.scheduledDate);
      if (!p1) return;
      const d1 = p1.dateKey;
      const f1 = facilities.find((f) => f.id === s1.facilityId);

      // Check against other sessions
      for (const s2 of sessions) {
        if (s1.id === s2.id) continue;
        const p2 = parseSessionDate(s2.scheduledDate);
        if (!p2) continue;
        const d2 = p2.dateKey;
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
            const latDiff = (Number(f1.latitude) - Number(f2.latitude)) * 111;
            const lngDiff = (Number(f1.longitude) - Number(f2.longitude)) * 111 * Math.cos(Number(f1.latitude) * (Math.PI / 180));
            const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
            if (dist < 5.0 && s1.sessionType !== "static" && s2.sessionType !== "static") {
              map.set(s1.id, {
                hasConflict: true,
                reason: `Proximity Clash with ${s2.name || f2?.name} (${dist.toFixed(1)} km apart on same day)`,
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

  // Helper to get sessions for a facility and day using parseSessionDate
  const getSessionsForFacilityDay = (facilityId: number, day: number) => {
    return sessions.filter((s) => {
      if (s.facilityId !== facilityId) return false;
      const p = parseSessionDate(s.scheduledDate);
      if (!p) return false;
      return (
        p.year === selectedYear &&
        p.month === selectedMonth &&
        p.day === day
      );
    });
  };

  // Robust Target Population / Quota resolver (handles multi-source population and facility attributes)
  const getFacilityQuota = (facilityId: number) => {
    // 1. If scheduled sessions have target population, sum them
    const sessionSum = sessions
      .filter((s) => s.facilityId === facilityId)
      .reduce((sum, s) => sum + (s.targetPopulation || 0), 0);
    if (sessionSum > 0) return sessionSum;

    // 2. Check population data records
    const popRecord = populationRecords.find(
      (p) => Number(p.facilityId) === facilityId && (p.under1Population || p.under5Population || p.totalPopulation)
    );
    if (popRecord) {
      return popRecord.under1Population || popRecord.under5Population || popRecord.totalPopulation || 0;
    }

    // 3. Sum up assigned village populations
    const villagePopSum = villages
      .filter((v) => Number(v.assignedFacilityId) === facilityId)
      .reduce((sum, v) => sum + (v.under5Population || v.totalCatchmentPopulation || v.griddedPopulation || 0), 0);
    if (villagePopSum > 0) return villagePopSum;

    // 4. Check facility direct properties
    const fac = facilities.find((f) => f.id === facilityId);
    if (fac) {
      if (fac.catchmentGridPopulation && fac.catchmentGridPopulation > 0) {
        return Math.round(fac.catchmentGridPopulation * 0.04);
      }
      const anyFac = fac as any;
      if (anyFac.targetPopulation) return Number(anyFac.targetPopulation);
      if (anyFac.targetUnder1) return Number(anyFac.targetUnder1);
      if (anyFac.catchmentPopulation) return Number(anyFac.catchmentPopulation);
      if (anyFac.population) return Number(anyFac.population);
    }

    return 0;
  };

  // Helper to calculate cold chain liters for facility
  const getFacilityColdChainLiters = (facilityId: number) => {
    const quota = getFacilityQuota(facilityId);
    if (quota > 0) {
      return (Math.max(1.4, (quota / 100) * 1.2)).toFixed(1);
    }
    return "1.5";
  };

  // Map Facilities: When a specific facility is selected, show selected HF + neighbor facilities in its district / vicinity
  const mapFacilities = useMemo(() => {
    if (selectedFacilityId !== "all") {
      const selectedFac = facilities.find((f) => f.id === Number(selectedFacilityId));
      if (selectedFac) {
        const neighbors = facilities.filter((f) => {
          if (f.id === selectedFac.id) return true;
          // Same district neighbor
          if (selectedFac.districtId && f.districtId === selectedFac.districtId) return true;
          // Proximity neighbor within 25km
          if (selectedFac.latitude && selectedFac.longitude && f.latitude && f.longitude) {
            const latDiff = (Number(selectedFac.latitude) - Number(f.latitude)) * 111;
            const lngDiff = (Number(selectedFac.longitude) - Number(f.longitude)) * 111 * Math.cos(Number(selectedFac.latitude) * (Math.PI / 180));
            const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
            return dist <= 25;
          }
          return false;
        });
        return neighbors.length > 0 ? neighbors : [selectedFac];
      }
    }
    return filteredFacilities;
  }, [selectedFacilityId, facilities, filteredFacilities]);

  // Default map center coordinates
  const defaultCenter = useMemo<[number, number]>(() => {
    const targetPool = mapFacilities.length > 0 ? mapFacilities : facilities;
    const withCoords = targetPool.filter((f) => f.latitude && f.longitude);
    if (withCoords.length > 0) {
      const avgLat = withCoords.reduce((acc, f) => acc + Number(f.latitude), 0) / withCoords.length;
      const avgLng = withCoords.reduce((acc, f) => acc + Number(f.longitude), 0) / withCoords.length;
      return [avgLat, avgLng];
    }
    return [-28.4793, 24.6727];
  }, [mapFacilities, facilities]);

  // Smart Cascade Searchable Options
  const provinceOptions = useMemo(() => [
    { value: "all", label: "All Provinces / Regions" },
    ...allProvinces.map((p) => {
      const distCount = districts.filter((d) => d.provinceId === p.id).length;
      return {
        value: p.id.toString(),
        label: p.name,
        subLabel: distCount > 0 ? `${distCount} ${distCount === 1 ? 'district' : 'districts'}` : undefined,
      };
    }),
  ], [allProvinces, districts]);

  const districtOptions = useMemo(() => {
    if (selectedProvince === "all") return [];
    return [
      { value: "all", label: `All Districts in Selected Province (${availableDistricts.length})` },
      ...availableDistricts.map((d) => {
        const facCount = facilities.filter((f) => f.districtId === d.id).length;
        return {
          value: d.id.toString(),
          label: d.name,
          subLabel: facCount > 0 ? `${facCount} ${facCount === 1 ? 'facility' : 'facilities'}` : undefined,
        };
      }),
    ];
  }, [selectedProvince, availableDistricts, facilities]);

  const facilityOptions = useMemo(() => {
    if (selectedDistrict === "all") return [];
    return [
      { value: "all", label: `All Facilities in Selected District (${availableFacilities.length})` },
      ...availableFacilities.map((f) => ({
        value: f.id.toString(),
        label: f.name,
        subLabel: f.hmisCode ? `HMIS: ${f.hmisCode}` : f.facilityType || undefined,
      })),
    ];
  }, [selectedDistrict, availableFacilities]);

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
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-semibold">
                  {filteredFacilities.length} {filteredFacilities.length === 1 ? 'Facility' : 'Facilities'}
                </Badge>
              </div>

              {/* 1. Province / Region Level (Searchable) */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Globe2 className="h-3 w-3 text-indigo-500" /> Province / Region
                  </span>
                  <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">Level 1</span>
                </Label>
                <SearchableSelect
                  value={selectedProvince}
                  onValueChange={handleProvinceChange}
                  options={provinceOptions}
                  placeholder="All Provinces"
                  searchPlaceholder="Search province or region..."
                  sortAlphabetical={false}
                  triggerClassName="h-8 text-xs font-medium"
                />
              </div>

              {/* 2. District / Admin Area Level (Searchable & Strict Cascade) */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-indigo-500" /> District / Admin Area
                    {selectedProvince === "all" && <Lock className="h-2.5 w-2.5 opacity-60 ml-0.5" />}
                  </span>
                  <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">Level 2</span>
                </Label>
                <SearchableSelect
                  value={selectedDistrict}
                  onValueChange={handleDistrictChange}
                  options={districtOptions}
                  disabled={selectedProvince === "all" || availableDistricts.length === 0}
                  placeholder={
                    selectedProvince === "all"
                      ? "🔒 Select Province first"
                      : `All Districts (${availableDistricts.length})`
                  }
                  searchPlaceholder="Search district..."
                  sortAlphabetical={false}
                  triggerClassName="h-8 text-xs font-medium"
                />
              </div>

              {/* 3. Health Facility Level (Searchable & Strict Cascade) */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-indigo-500" /> Health Facility
                    {selectedDistrict === "all" && <Lock className="h-2.5 w-2.5 opacity-60 ml-0.5" />}
                  </span>
                  <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">Level 3</span>
                </Label>
                <SearchableSelect
                  value={selectedFacilityId}
                  onValueChange={handleFacilityChange}
                  options={facilityOptions}
                  disabled={selectedDistrict === "all" || availableFacilities.length === 0}
                  placeholder={
                    selectedDistrict === "all"
                      ? "🔒 Select District first"
                      : `All Facilities (${availableFacilities.length})`
                  }
                  searchPlaceholder="Search health facility..."
                  sortAlphabetical={false}
                  triggerClassName="h-8 text-xs font-medium"
                />
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-foreground">
                  {monthNames[selectedMonth]} {selectedYear}
                </span>

                {viewMode === "calendar" && (
                  <div className="flex items-center gap-1.5 ml-1">
                    {/* Day View Mode Switcher: Full Month vs 5-Day Window */}
                    <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border text-xs">
                      <button
                        type="button"
                        onClick={() => setDayViewMode("all")}
                        className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-all ${
                          dayViewMode === "all"
                            ? "bg-background shadow-xs text-foreground font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Full Month (1–{totalDaysInMonth})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDayViewMode("window")}
                        className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-all ${
                          dayViewMode === "window"
                            ? "bg-background shadow-xs text-foreground font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        5-Day Window
                      </button>
                    </div>

                    {dayViewMode === "window" && (
                      <div className="flex items-center border rounded-md overflow-hidden bg-background">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-none"
                          onClick={() => {
                            if (dateRangeOffset > 0) setDateRangeOffset(dateRangeOffset - 1);
                          }}
                          disabled={dateRangeOffset <= 0}
                          title="Previous 5 days"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-none"
                          onClick={() => setDateRangeOffset(dateRangeOffset + 1)}
                          disabled={(dateRangeOffset + 1) * 5 >= totalDaysInMonth}
                          title="Next 5 days"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
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

            {/* Smart Session Alerts & Quick-Jump Pills */}
            {viewMode === "calendar" && (
              <div className="space-y-2">
                {/* Other Month Notification */}
                {facilitySessionsSummary.sessionsInOtherMonths.length > 0 && facilitySessionsSummary.sessionsInMonth.length === 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs">
                    <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                      <Info className="h-4 w-4 shrink-0 text-indigo-600" />
                      <span>
                        <strong>{facilitySessionsSummary.targetFacility?.name || "Selected facility"}</strong> has <strong>{facilitySessionsSummary.sessionsInOtherMonths.length} planned session{facilitySessionsSummary.sessionsInOtherMonths.length === 1 ? "" : "s"}</strong> scheduled in <strong>{monthNames[facilitySessionsSummary.sessionsInOtherMonths[0].month]} {facilitySessionsSummary.sessionsInOtherMonths[0].year}</strong>.
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-indigo-600 text-white hover:bg-indigo-700 border-0"
                      onClick={() => {
                        setSelectedYear(facilitySessionsSummary.sessionsInOtherMonths[0].year);
                        setSelectedMonth(facilitySessionsSummary.sessionsInOtherMonths[0].month);
                        setDateRangeOffset(Math.floor((facilitySessionsSummary.sessionsInOtherMonths[0].day - 1) / 5));
                      }}
                    >
                      View {monthNames[facilitySessionsSummary.sessionsInOtherMonths[0].month]} {facilitySessionsSummary.sessionsInOtherMonths[0].year} →
                    </Button>
                  </div>
                )}

                {/* Current Month Active Session Pills */}
                {facilitySessionsSummary.sessionsInMonth.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {facilitySessionsSummary.sessionsInMonth.length} Planned Session{facilitySessionsSummary.sessionsInMonth.length === 1 ? "" : "s"} in {monthNames[selectedMonth]}:
                    </span>
                    {facilitySessionsSummary.sessionsInMonth.map(({ session, day }) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => {
                          if (dayViewMode === "window") {
                            setDateRangeOffset(Math.floor((day - 1) / 5));
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-[11px] font-medium text-emerald-950 dark:text-emerald-100 hover:bg-emerald-100 transition-colors shadow-2xs"
                      >
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">{monthNames[selectedMonth].slice(0, 3)} {day}:</span>
                        <span className="truncate max-w-[130px]">{session.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 1. Calendar Matrix Grid Table ── */}
            {viewMode === "calendar" && (
              <div className="rounded-xl border overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse min-w-[620px]">
                  <thead>
                    <tr className="bg-muted/80 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b">
                      <th className="p-2.5 min-w-[150px] sticky left-0 bg-muted/95 z-10 border-r shadow-xs">Facilities ⇅</th>
                      {visibleDays.map((day) => {
                        const dayHasSession = filteredFacilities.slice(0, 10).some((f) => getSessionsForFacilityDay(f.id, day).length > 0);
                        return (
                          <th
                            key={day}
                            className={`p-2 text-center border-l transition-colors ${
                              dayViewMode === "all" ? "min-w-[72px]" : "min-w-[110px]"
                            } ${
                              dayHasSession
                                ? "bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-bold border-emerald-300 dark:border-emerald-800"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>{monthNames[selectedMonth].slice(0, 3)} {day}</span>
                              {dayHasSession && (
                                <span
                                  className="h-2 w-2 rounded-full bg-emerald-600 inline-block shrink-0"
                                  title="Scheduled sessions on this day"
                                />
                              )}
                            </div>
                          </th>
                        );
                      })}
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
                          <td className="p-2.5 font-semibold text-foreground align-top sticky left-0 bg-background/95 z-10 border-r shadow-xs">
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
                              <td key={day} className={`p-1.5 align-top border-l bg-background/50 ${dayViewMode === "all" ? "min-w-[72px]" : "min-w-[110px]"}`}>
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

                    {filteredFacilities.length === 0 && (
                      <tr>
                        <td colSpan={visibleDays.length + 4} className="p-8 text-center text-muted-foreground">
                          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                          <p className="font-semibold text-sm">No health facilities found</p>
                          <p className="text-xs text-muted-foreground mt-1">Try selecting a different District or clearing filters.</p>
                          <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={handleClearFilters}>
                            Clear Location Filters
                          </Button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── 2. Interactive GIS Clash & Route Map ── */}
            {viewMode === "map" && (
              <div className="space-y-3">
                <div className="h-[480px] w-full rounded-xl overflow-hidden border shadow-sm relative">
                  <MapContainer
                    center={defaultCenter}
                    zoom={9}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={true}
                  >
                    <InvalidateSize />
                    <MapBoundsAdjuster facilities={mapFacilities} />
                    <BasemapTileLayer basemap={basemap} />

                    {mapFacilities.map((facility) => {
                      if (!facility.latitude || !facility.longitude) return null;
                      const lat = Number(facility.latitude);
                      const lng = Number(facility.longitude);
                      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;

                      const isSelected = selectedFacilityId !== "all" && facility.id === Number(selectedFacilityId);
                      const isNeighbor = selectedFacilityId !== "all" && !isSelected;

                      const facilitySessions = sessions.filter((s) => s.facilityId === facility.id);
                      const hasClash = facilitySessions.some((s) => sessionConflicts.get(s.id)?.hasConflict);
                      const hasScheduled = facilitySessions.length > 0;

                      const markerColor = isSelected
                        ? "#f59e0b"
                        : hasClash
                        ? "#ef4444"
                        : hasScheduled
                        ? "#10b981"
                        : "#6366f1";
                      const markerRadius = isSelected ? 12 : hasClash ? 9 : hasScheduled ? 8 : 6;

                      const facilityTargetQuota = getFacilityQuota(facility.id);
                      const facilityColdChain = getFacilityColdChainLiters(facility.id);

                      return (
                        <React.Fragment key={facility.id}>
                          {/* Selected Facility Pulse Ring */}
                          {isSelected && (
                            <CircleMarker
                              center={[lat, lng]}
                              radius={20}
                              pathOptions={{
                                color: "#f59e0b",
                                weight: 2.5,
                                fillColor: "#f59e0b",
                                fillOpacity: 0.25,
                              }}
                            />
                          )}

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
                              color: isSelected ? "#ffffff" : isNeighbor ? "#e2e8f0" : "#ffffff",
                              weight: isSelected ? 3 : 2,
                              fillColor: markerColor,
                              fillOpacity: 0.95,
                            }}
                          >
                            <Tooltip direction="top" offset={[0, -6]}>
                              <div className="font-semibold text-xs">
                                {isSelected ? `⭐ ${facility.name} (Selected Facility)` : isNeighbor ? `📍 ${facility.name} (Neighbor Facility)` : facility.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {hasClash ? "⚠️ Proximity Clash Detected" : hasScheduled ? `✓ ${facilitySessions.length} Scheduled Sessions` : "No sessions scheduled"}
                              </div>
                            </Tooltip>
                            <Popup className="text-xs">
                              <div className="p-1 space-y-2 min-w-[210px]">
                                <div className="border-b pb-1.5">
                                  <div className="flex items-center justify-between gap-1">
                                    <h4 className="font-bold text-sm text-foreground">{facility.name}</h4>
                                    {isSelected && (
                                      <Badge className="text-[9px] bg-amber-500 text-white font-bold px-1.5 py-0">
                                        Selected
                                      </Badge>
                                    )}
                                    {isNeighbor && (
                                      <Badge variant="outline" className="text-[9px] text-indigo-700 border-indigo-300 font-medium px-1.5 py-0">
                                        Neighbor
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">{facility.hmisCode || "Health Facility"}</p>
                                </div>

                                <div className="space-y-1 text-[11px]">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Month Planned Sessions:</span>
                                    <span className="font-semibold">{facilitySessions.length}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Target Quota:</span>
                                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                      {facilityTargetQuota > 0 ? facilityTargetQuota.toLocaleString() : "120 infants"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cold Chain:</span>
                                    <span className="font-semibold text-sky-700">{facilityColdChain} L</span>
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

                  {/* Basemap Switcher Control */}
                  <BasemapSwitcher basemap={basemap} onChange={setBasemap} />

                  {/* Map Floating Legend */}
                  <div className="absolute bottom-3 right-3 z-[1000] bg-background/90 backdrop-blur-md p-2.5 rounded-lg border shadow-md text-[11px] space-y-1.5 pointer-events-auto">
                    <p className="font-bold text-xs">GIS Clash Legend</p>
                    {selectedFacilityId !== "all" && (
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-amber-500 border-2 border-white inline-block"></span>
                        <span className="font-medium">Selected Facility</span>
                      </div>
                    )}
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
