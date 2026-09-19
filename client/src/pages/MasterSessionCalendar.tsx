import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Syringe,
  MapPin,
  Truck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  Flag,
  Globe,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  CalendarDays,
  Users,
  Thermometer,
  Eye,
  Info,
  Layers,
  X,
  Megaphone,
  Download,
  Printer,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GeoCascadeFilter } from "@/components/GeoCascadeFilter";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { NationalCalendarEvent } from "../../../shared/countryHolidays";

/** Return the canonical YYYY-MM-DD used everywhere in the calendar. */
function getSessionDate(session: any): string {
  const raw = session?.scheduledDate ?? session?.date ?? session?.sessionDate;
  if (raw) {
    const text = String(raw);
    const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (iso) return iso;
    const parsed = new Date(raw);
    if (Number.isFinite(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    }
  }

  // Some legacy imports stored the exact date in the session name but left
  // scheduled_date null. Recover that explicit value without inventing a date
  // for quarter-only plans.
  return String(session?.name ?? "").match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? "";
}

type CalendarView = "month" | "quarter" | "halfyear" | "year" | "agenda";

function PlanningMonthCard({
  date,
  sessions,
  nationalEvents,
  onDate,
  onSession,
  onNationalEvent,
  onShowMonth,
}: {
  date: Date;
  sessions: any[];
  nationalEvents: NationalCalendarEvent[];
  onDate: (date: string) => void;
  onSession: (session: any) => void;
  onNationalEvent: (event: NationalCalendarEvent) => void;
  onShowMonth: (date: Date) => void;
}) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthSessions = sessions.filter((session) => getSessionDate(session).startsWith(prefix));
  const monthEvents = nationalEvents.filter((event) => {
    const start = event.startDate?.slice(0, 10) ?? "";
    const end = (event.endDate || event.startDate)?.slice(0, 10) ?? start;
    return start.slice(0, 7) <= prefix && end.slice(0, 7) >= prefix;
  });
  const target = monthSessions.reduce(
    (sum, session) => sum + (Number(session.effectiveTargetPopulation ?? session.targetPopulation) || 0),
    0,
  );
  const cells = Array.from({ length: firstDay + days }, (_, index) => index < firstDay ? null : index - firstDay + 1);

  return (
    <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
      <CardHeader className="p-3 pb-2 bg-muted/25">
        <div className="flex items-start justify-between gap-2">
          <div>
            <button type="button" onClick={() => onShowMonth(date)} className="text-left hover:text-emerald-700 hover:underline underline-offset-2">
              <CardTitle className="text-sm">{date.toLocaleString(undefined, { month: "long" })} {year}</CardTitle>
            </button>
            <CardDescription className="text-[10px] mt-0.5">
              {monthSessions.length} sessions · {target.toLocaleString()} target
            </CardDescription>
          </div>
          <button type="button" onClick={() => onShowMonth(date)} aria-label={`Open ${date.toLocaleString(undefined, { month: "long" })} ${year}`}>
            <Badge variant={monthEvents.length ? "default" : "secondary"} className="text-[9px] cursor-pointer hover:ring-2 hover:ring-emerald-300">
              {monthEvents.length} events
            </Badge>
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <div className="grid grid-cols-7 text-center text-[9px] text-muted-foreground mb-1">
          {['S','M','T','W','T','F','S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, index) => {
            if (!day) return <div key={`blank-${index}`} className="h-8" />;
            const dateString = `${prefix}-${String(day).padStart(2, "0")}`;
            const daySessions = monthSessions.filter((session) => getSessionDate(session) === dateString);
            const dayEvents = monthEvents.filter((event) => {
              const start = event.startDate.slice(0, 10);
              const end = (event.endDate || event.startDate).slice(0, 10);
              return dateString >= start && dateString <= end;
            });
            return (
              <button
                key={dateString}
                type="button"
                onClick={() => daySessions[0] ? onSession(daySessions[0]) : dayEvents[0] ? onNationalEvent(dayEvents[0]) : onDate(dateString)}
                className={`h-8 rounded text-[10px] flex flex-col items-center justify-center border transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 ${
                  daySessions.length || dayEvents.length ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-semibold" : "border-transparent"
                }`}
                title={daySessions.length ? `${daySessions.length} session(s)` : dayEvents.length ? dayEvents.map((event) => event.title).join(', ') : `Plan session for ${dateString}`}
              >
                <span>{day}</span>
                <span className="flex gap-0.5 h-1">
                  {daySessions.length > 0 && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                  {dayEvents.length > 0 && <span className="w-1 h-1 rounded-full bg-purple-500" />}
                </span>
              </button>
            );
          })}
        </div>
        {(monthSessions.length > 0 || monthEvents.length > 0) && (
          <div className="mt-2 pt-2 border-t space-y-1">
            {monthSessions.slice(0, 2).map((session) => (
              <button key={session.id} type="button" onClick={() => onSession(session)} className="block w-full text-left text-[10px] truncate hover:text-emerald-700">
                <span className="font-mono text-muted-foreground">{getSessionDate(session).slice(8)}</span> · {session.name}
              </button>
            ))}
            {monthEvents.slice(0, 1).map((event) => (
              <button key={event.id} type="button" onClick={() => onNationalEvent(event)} className="block w-full text-left text-[10px] truncate text-purple-700 hover:underline">
                {event.title}
              </button>
            ))}
            {monthSessions.length + monthEvents.length > 3 && (
              <button
                type="button"
                onClick={() => onShowMonth(date)}
                className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline underline-offset-2"
              >
                +{monthSessions.length + monthEvents.length - 3} more — view month
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MasterSessionCalendar() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Geographic Hierarchy Cascading State (National / Provincial / District / Facility)
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(
    user?.provinceId ? Number(user.provinceId) : null
  );
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(
    user?.districtId ? Number(user.districtId) : null
  );
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(
    user?.facilityId ? Number(user.facilityId) : null
  );

  // Calendar view state: month, week, agenda
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [searchQuery, setSearchQuery] = useState("");

  // Card drilldown active state
  const [activeCardDrilldown, setActiveCardDrilldown] = useState<"total" | "outreach" | "mobile" | "target_children" | "national_events" | null>(null);

  // Filter toggles
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showSessions, setShowSessions] = useState(true);
  const [showHolidays, setShowHolidays] = useState(true);
  const [showCampaigns, setShowCampaigns] = useState(true);

  // Dialog states
  const [initiateModalOpen, setInitiateModalOpen] = useState(false);
  const [selectedDateForSession, setSelectedDateForSession] = useState<string>("");
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<any | null>(null);
  const [selectedEventDetail, setSelectedEventDetail] = useState<NationalCalendarEvent | null>(null);

  // Form state for creating a new session
  const [newSessionFacilityId, setNewSessionFacilityId] = useState<number | null>(selectedFacilityId);
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionStrategy, setNewSessionStrategy] = useState<"fixed" | "outreach" | "mobile">("outreach");
  const [newSessionVillageName, setNewSessionVillageName] = useState("");
  const [newSessionTargetChildren, setNewSessionTargetChildren] = useState<number>(35);
  const [newSessionTargetWomen, setNewSessionTargetWomen] = useState<number>(10);
  const [newSessionTeamLead, setNewSessionTeamLead] = useState("");
  const [newSessionNotes, setNewSessionNotes] = useState("");

  // Determine Country Code from user / tenant
  const countryCode = useMemo(() => {
    const raw = (user as any)?.countryCode || (user as any)?.tenantId?.slice(0, 3) || "ZAF";
    return String(raw).toUpperCase();
  }, [user]);

  // Query National Public Holidays and Health Campaigns
  const { data: nationalEvents = [] } = useQuery<NationalCalendarEvent[]>({
    queryKey: ["/api/national/calendar-events", countryCode],
    queryFn: async () => {
      const res = await fetch(`/api/national/calendar-events?countryCode=${encodeURIComponent(countryCode)}`, {
        credentials: "include"
      });
      if (!res.ok) return [];
      const payload = await res.json();
      // The API returns metadata plus an `events` array. Accept a raw array as
      // well for backwards compatibility, but never leak an object into the
      // render path where `.forEach` / `.filter` are used.
      if (Array.isArray(payload)) return payload;
      return Array.isArray(payload?.events) ? payload.events : [];
    },
    staleTime: 1000 * 60 * 30,
  });

  // Query Facilities for dropdown selection
  const { data: facilitiesList = [] } = useQuery<any[]>({
    queryKey: ["/api/facilities"],
    queryFn: async () => {
      const res = await fetch("/api/facilities", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const facilityMap = useMemo(() => {
    const map = new Map<number, any>();
    facilitiesList.forEach(f => map.set(f.id, f));
    return map;
  }, [facilitiesList]);

  // Query All Sessions across the system
  const { data: allSessions = [], isLoading: isLoadingSessions } = useQuery<any[]>({
    queryKey: ["/api/sessions", selectedFacilityId],
    queryFn: async () => {
      const url = selectedFacilityId
        ? `/api/sessions?facilityId=${selectedFacilityId}`
        : `/api/sessions`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Filter sessions according to active GeoHierarchy, Search, Strategy & Status
  const filteredSessions = useMemo(() => {
    return allSessions.filter((session) => {
      // 1. Facility Filter
      if (selectedFacilityId && session.facilityId !== selectedFacilityId) {
        return false;
      }
      // 2. District Filter
      if (selectedDistrictId && !selectedFacilityId) {
        const fac = facilityMap.get(session.facilityId);
        if (fac && fac.districtId && Number(fac.districtId) !== selectedDistrictId) {
          return false;
        }
      }
      // 3. Province Filter
      if (selectedProvinceId && !selectedDistrictId && !selectedFacilityId) {
        const fac = facilityMap.get(session.facilityId);
        if (fac && fac.provinceId && Number(fac.provinceId) !== selectedProvinceId) {
          return false;
        }
      }

      // 4. Strategy Filter
      if (strategyFilter !== "all" && session.sessionType !== strategyFilter && session.strategy !== strategyFilter) {
        return false;
      }

      // 5. Status Filter
      if (statusFilter !== "all" && session.status !== statusFilter) {
        return false;
      }

      // 6. Text Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const facName = facilityMap.get(session.facilityId)?.name?.toLowerCase() || "";
        const match =
          (session.name && session.name.toLowerCase().includes(q)) ||
          (session.location && session.location.toLowerCase().includes(q)) ||
          (session.villageName && session.villageName.toLowerCase().includes(q)) ||
          facName.includes(q);
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      const aDate = getSessionDate(a);
      const bDate = getSessionDate(b);
      if (!aDate && !bDate) return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      if (!aDate) return 1;
      if (!bDate) return -1;
      return aDate.localeCompare(bDate);
    });
  }, [allSessions, selectedFacilityId, selectedDistrictId, selectedProvinceId, strategyFilter, statusFilter, searchQuery, facilityMap]);

  // Mutation to Create / Initiate a New Session Plan
  const createSessionMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res: any = await apiRequest("POST", "/api/sessions", payload);
      return res.json();
    },
    onSuccess: (newSession) => {
      toast({
        title: "Session Plan Scheduled",
        description: `Successfully planned "${newSession.name || 'Immunization Session'}" on ${newSession.date || 'selected date'}.`
      });
      setInitiateModalOpen(false);
      resetNewSessionForm();
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Session Creation Failed",
        description: err.message || "Failed to schedule session."
      });
    }
  });

  const resetNewSessionForm = () => {
    setNewSessionName("");
    setNewSessionDate("");
    setNewSessionStrategy("outreach");
    setNewSessionVillageName("");
    setNewSessionTargetChildren(35);
    setNewSessionTargetWomen(10);
    setNewSessionTeamLead("");
    setNewSessionNotes("");
  };

  const handleOpenInitiateModal = (dateStr?: string) => {
    const today = new Date();
    const fallbackTodayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const targetDate = dateStr || fallbackTodayStr;

    setSelectedDateForSession(targetDate);
    setNewSessionDate(targetDate);
    setNewSessionFacilityId(selectedFacilityId || (facilitiesList[0]?.id ?? null));

    // Check if there are national campaigns or events on this date
    const matchingEvents = nationalEvents.filter(ev => {
      const sDate = ev.startDate ? String(ev.startDate).split("T")[0] : "";
      const eDate = ev.endDate ? String(ev.endDate).split("T")[0] : sDate;
      return targetDate >= sDate && targetDate <= eDate;
    });

    const eventTitle = matchingEvents.length > 0 ? ` (${matchingEvents[0].title})` : "";
    setNewSessionName(`Outreach Session - ${targetDate}${eventTitle ? ' - ' + matchingEvents[0].title : ''}`);
    setInitiateModalOpen(true);
  };

  const handleSaveSession = () => {
    if (!newSessionFacilityId) {
      toast({ variant: "destructive", title: "Select Facility", description: "Please select a health facility for this session." });
      return;
    }
    if (!newSessionDate) {
      toast({ variant: "destructive", title: "Select Date", description: "Please specify the session execution date." });
      return;
    }

    const payload = {
      facilityId: newSessionFacilityId,
      name: newSessionName || `Routine Session - ${newSessionDate}`,
      date: newSessionDate,
      sessionType: newSessionStrategy,
      strategy: newSessionStrategy,
      status: "planned",
      targetChildren: Number(newSessionTargetChildren) || 0,
      targetPregnantWomen: Number(newSessionTargetWomen) || 0,
      location: newSessionVillageName || "Community Outreach Site",
      villageName: newSessionVillageName || undefined,
      teamLeader: newSessionTeamLead || undefined,
      notes: newSessionNotes || undefined,
    };

    createSessionMutation.mutate(payload);
  };

  // Calendar Calculation Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const rangeStart = useMemo(() => {
    if (calendarView === "quarter") return new Date(year, Math.floor(month / 3) * 3, 1);
    if (calendarView === "halfyear") return new Date(year, month < 6 ? 0 : 6, 1);
    if (calendarView === "year") return new Date(year, 0, 1);
    return new Date(year, month, 1);
  }, [calendarView, year, month]);
  const rangeMonthCount = calendarView === "quarter" ? 3 : calendarView === "halfyear" ? 6 : calendarView === "year" ? 12 : 1;
  const planningMonths = useMemo(
    () => Array.from({ length: rangeMonthCount }, (_, index) => new Date(rangeStart.getFullYear(), rangeStart.getMonth() + index, 1)),
    [rangeStart, rangeMonthCount],
  );
  const navigationStep = calendarView === "quarter" ? 3 : calendarView === "halfyear" ? 6 : calendarView === "year" ? 12 : 1;
  const rangeTitle = calendarView === "quarter"
    ? `Q${Math.floor(rangeStart.getMonth() / 3) + 1} ${rangeStart.getFullYear()}`
    : calendarView === "halfyear"
      ? `${rangeStart.getMonth() === 0 ? "Jan–Jun" : "Jul–Dec"} ${rangeStart.getFullYear()}`
      : calendarView === "year"
        ? String(rangeStart.getFullYear())
        : `${new Date(year, month, 1).toLocaleString(undefined, { month: "long" })} ${year}`;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Calendar Day Cell Matrix (Timezone-safe local formatting)
  const calendarCells = useMemo(() => {
    const cells: {
      date: Date;
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Previous month filler days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      cells.push({
        date: d,
        dateString: str,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: str === todayStr,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const str = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      cells.push({
        date: d,
        dateString: str,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: str === todayStr,
      });
    }

    // Next month filler days to complete grid (multiples of 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      cells.push({
        date: d,
        dateString: str,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: str === todayStr,
      });
    }

    return cells;
  }, [year, month, firstDayOfMonth, daysInMonth, daysInPrevMonth]);

  // Map events to date strings (handling multi-day spans & timezone-safe date matching)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, { sessions: any[]; holidays: NationalCalendarEvent[]; campaigns: NationalCalendarEvent[] }>();

    calendarCells.forEach((cell) => {
      map.set(cell.dateString, { sessions: [], holidays: [], campaigns: [] });
    });

    if (showSessions) {
      filteredSessions.forEach((s) => {
        const dStr = getSessionDate(s);
        if (dStr && map.has(dStr)) {
          map.get(dStr)!.sessions.push(s);
        }
      });
    }

    nationalEvents.forEach((ev) => {
      const sDate = ev.startDate ? String(ev.startDate).split("T")[0] : "";
      const eDate = ev.endDate ? String(ev.endDate).split("T")[0] : sDate;

      if (!sDate) return;

      calendarCells.forEach((cell) => {
        const dStr = cell.dateString;
        if (dStr >= sDate && dStr <= eDate) {
          const entry = map.get(dStr);
          if (entry) {
            if (ev.eventType === "public_holiday" && showHolidays) {
              if (!entry.holidays.some(h => h.id === ev.id)) {
                entry.holidays.push(ev);
              }
            } else if ((ev.eventType === "campaign" || ev.eventType === "health_event" || ev.eventType === "si_window" || ev.eventType === "training" || ev.eventType === "supervision") && showCampaigns) {
              if (!entry.campaigns.some(c => c.id === ev.id)) {
                entry.campaigns.push(ev);
              }
            }
          }
        }
      });
    });

    return map;
  }, [calendarCells, filteredSessions, nationalEvents, showSessions, showHolidays, showCampaigns]);

  // Aggregate KPI Statistics
  const stats = useMemo(() => {
    const total = filteredSessions.length;
    const fixedCount = filteredSessions.filter(s => s.sessionType === "fixed" || s.strategy === "fixed").length;
    const outreachCount = filteredSessions.filter(s => s.sessionType === "outreach" || s.strategy === "outreach").length;
    const mobileCount = filteredSessions.filter(s => s.sessionType === "mobile" || s.strategy === "mobile").length;
    const totalChildren = filteredSessions.reduce(
      (acc, s) => acc + (Number(s.effectiveTargetPopulation ?? s.targetPopulation ?? s.targetChildren) || 0),
      0,
    );

    return {
      total,
      fixedCount,
      outreachCount,
      mobileCount,
      totalChildren,
      holidaysCount: nationalEvents.filter(e => e.eventType === "public_holiday").length,
      campaignsCount: nationalEvents.filter(e => e.eventType === "campaign" || e.eventType === "health_event" || e.eventType === "si_window").length,
    };
  }, [filteredSessions, nationalEvents]);

  // KPI Card Drilldown Handlers
  const handleTotalSessionsDrilldown = () => {
    if (activeCardDrilldown === "total") {
      setActiveCardDrilldown(null);
      setStrategyFilter("all");
    } else {
      setActiveCardDrilldown("total");
      setStrategyFilter("all");
      setShowSessions(true);
    }
  };

  const handleOutreachMobileDrilldown = () => {
    if (activeCardDrilldown === "outreach") {
      setActiveCardDrilldown("mobile");
      setStrategyFilter("mobile");
    } else if (activeCardDrilldown === "mobile") {
      setActiveCardDrilldown(null);
      setStrategyFilter("all");
    } else {
      setActiveCardDrilldown("outreach");
      setStrategyFilter("outreach");
      setShowSessions(true);
    }
  };

  const handleTargetChildrenDrilldown = () => {
    if (activeCardDrilldown === "target_children") {
      setActiveCardDrilldown(null);
    } else {
      setActiveCardDrilldown("target_children");
      setCalendarView("agenda");
    }
  };

  const handleNationalEventsDrilldown = () => {
    if (activeCardDrilldown === "national_events") {
      setActiveCardDrilldown(null);
    } else {
      setActiveCardDrilldown("national_events");
      setShowHolidays(true);
      setShowCampaigns(true);
      setCalendarView("month");
    }
  };

  // Facility Options for Select
  const facilityOptions = useMemo(() => {
    return facilitiesList.map(f => ({
      value: String(f.id),
      label: f.name,
      subLabel: f.facilityType ? `Type: ${f.facilityType}` : undefined
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [facilitiesList]);

  // Events on the date currently selected in initiate modal
  const modalDateEvents = useMemo(() => {
    if (!selectedDateForSession) return [];
    return nationalEvents.filter(ev => {
      const sDate = ev.startDate ? String(ev.startDate).split("T")[0] : "";
      const eDate = ev.endDate ? String(ev.endDate).split("T")[0] : sDate;
      return selectedDateForSession >= sDate && selectedDateForSession <= eDate;
    });
  }, [selectedDateForSession, nationalEvents]);

  return (
    <div className="space-y-6 p-3 sm:p-4 md:p-8 max-w-[1700px] mx-auto">
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. HEADER & GLOBAL CONTROLS
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b pb-6 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-xl">
              <CalendarDays className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Session & Event Calendar
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Multi-level master schedule of routine fixed sessions, outreach visits, mobile clinics, and national public health campaigns.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-xs sm:text-sm"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Schedule
          </Button>

          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm text-xs sm:text-sm"
            onClick={() => handleOpenInitiateModal()}
          >
            <Plus className="w-4 h-4 mr-2" />
            Plan New Session
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. HIERARCHICAL GEOGRAPHIC CASCADE FILTER BAR (RESPONSIVE)
      ───────────────────────────────────────────────────────────────────────────── */}
      <Card className="bg-muted/30 border shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <GeoCascadeFilter
            provinceId={selectedProvinceId}
            districtId={selectedDistrictId}
            facilityId={selectedFacilityId}
            onProvinceChange={setSelectedProvinceId}
            onDistrictChange={setSelectedDistrictId}
            onFacilityChange={setSelectedFacilityId}
            showFacility={true}
            strictCascade
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. INTERACTIVE KPI SUMMARY STATS CARDS (WITH DRILLDOWN)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
        {/* Card 1: Total Planned Sessions */}
        <Card
          onClick={handleTotalSessionsDrilldown}
          className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-200/60 dark:border-emerald-800/40 relative overflow-hidden ${
            activeCardDrilldown === "total" ? "ring-2 ring-emerald-600 dark:ring-emerald-400 shadow-md" : ""
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Total Planned Sessions
                </p>
                {activeCardDrilldown === "total" && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-emerald-200 text-emerald-800">
                    Filtered
                  </Badge>
                )}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {stats.total}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.fixedCount} Fixed • {stats.outreachCount} Outreach • {stats.mobileCount} Mobile
              </p>
            </div>
            <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-sm shrink-0">
              <Syringe className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Outreach & Mobile Visits */}
        <Card
          onClick={handleOutreachMobileDrilldown}
          className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-200/60 dark:border-blue-800/40 relative overflow-hidden ${
            activeCardDrilldown === "outreach" || activeCardDrilldown === "mobile" ? "ring-2 ring-blue-600 dark:ring-blue-400 shadow-md" : ""
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  Outreach & Mobile Visits
                </p>
                {(activeCardDrilldown === "outreach" || activeCardDrilldown === "mobile") && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-blue-200 text-blue-800 capitalize">
                    {activeCardDrilldown}
                  </Badge>
                )}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {stats.outreachCount + stats.mobileCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Targeting hard-to-reach communities (Click to filter)
              </p>
            </div>
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-sm shrink-0">
              <Truck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Target Children */}
        <Card
          onClick={handleTargetChildrenDrilldown}
          className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-200/60 dark:border-amber-800/40 relative overflow-hidden ${
            activeCardDrilldown === "target_children" ? "ring-2 ring-amber-600 dark:ring-amber-400 shadow-md" : ""
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Target Children
                </p>
                {activeCardDrilldown === "target_children" && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-200 text-amber-800">
                    Agenda List
                  </Badge>
                )}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {stats.totalChildren.toLocaleString()}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Beneficiaries to vaccinate (Click for agenda view)
              </p>
            </div>
            <div className="p-3 bg-amber-600 text-white rounded-xl shadow-sm shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: National Events */}
        <Card
          onClick={handleNationalEventsDrilldown}
          className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-200/60 dark:border-purple-800/40 relative overflow-hidden ${
            activeCardDrilldown === "national_events" ? "ring-2 ring-purple-600 dark:ring-purple-400 shadow-md" : ""
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                  National Events & SIAs
                </p>
                {activeCardDrilldown === "national_events" && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-purple-200 text-purple-800">
                    Highlighted
                  </Badge>
                )}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {stats.holidaysCount + stats.campaignsCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.holidaysCount} Public Holidays • {stats.campaignsCount} Health Campaigns
              </p>
            </div>
            <div className="p-3 bg-purple-600 text-white rounded-xl shadow-sm shrink-0">
              <Flag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. CALENDAR TOOLBAR & VIEW SWITCHER (RESPONSIVE)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border shadow-sm">
        {/* Date Month Navigation */}
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentDate(new Date(rangeStart.getFullYear(), rangeStart.getMonth() - navigationStep, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <h2 className="text-base sm:text-lg font-bold min-w-[160px] text-center text-slate-900 dark:text-white">
            {rangeTitle}
          </h2>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentDate(new Date(rangeStart.getFullYear(), rangeStart.getMonth() + navigationStep, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-emerald-600 font-semibold ml-1"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
        </div>

        {/* Search, Filter & View Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-initial min-w-[150px] sm:min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-background w-full"
            />
          </div>

          {/* Strategy selector */}
          <Select
            value={strategyFilter}
            onValueChange={(val) => {
              setStrategyFilter(val);
              if (activeCardDrilldown) setActiveCardDrilldown(null);
            }}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="Strategy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Strategies</SelectItem>
              <SelectItem value="fixed">Fixed</SelectItem>
              <SelectItem value="outreach">Outreach</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
            </SelectContent>
          </Select>

          {/* Planning horizon */}
          <Select value={calendarView} onValueChange={(value) => setCalendarView(value as CalendarView)}>
            <SelectTrigger className="h-8 w-[150px] text-xs font-medium">
              <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month detail</SelectItem>
              <SelectItem value="quarter">Quarter · 3 months</SelectItem>
              <SelectItem value="halfyear">Half-year · 6 months</SelectItem>
              <SelectItem value="year">Annual · 12 months</SelectItem>
              <SelectItem value="agenda">Agenda list</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. CALENDAR MONTH GRID OR AGENDA LIST VIEW
      ───────────────────────────────────────────────────────────────────────────── */}
      {calendarView === "month" ? (
        <div className="border rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center font-semibold text-xs py-2 text-muted-foreground">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* 6x7 Month Day Cells Grid */}
          <div className="grid grid-cols-7 divide-x divide-y border-b">
            {calendarCells.map((cell, idx) => {
              const dayEvents = eventsByDate.get(cell.dateString) || { sessions: [], holidays: [], campaigns: [] };
              const hasNational = dayEvents.holidays.length > 0 || dayEvents.campaigns.length > 0;
              const hasSessions = dayEvents.sessions.length > 0;

              const isHighlightedForNational = activeCardDrilldown === "national_events" && hasNational;
              const isHighlightedForTarget = activeCardDrilldown === "target_children" && dayEvents.sessions.some(
                (s) => Number(s.effectiveTargetPopulation ?? s.targetPopulation ?? s.targetChildren ?? 0) > 0,
              );

              return (
                <div
                  key={`${cell.dateString}-${idx}`}
                  onClick={() => handleOpenInitiateModal(cell.dateString)}
                  className={`min-h-[105px] sm:min-h-[120px] md:min-h-[135px] p-1.5 flex flex-col justify-between transition-all cursor-pointer group relative ${
                    cell.isCurrentMonth
                      ? "bg-white dark:bg-slate-900 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
                      : "bg-slate-50/50 dark:bg-slate-950/40 text-muted-foreground opacity-60 hover:opacity-90"
                  } ${cell.isToday ? "ring-2 ring-emerald-500 ring-inset" : ""} ${
                    isHighlightedForNational ? "ring-2 ring-purple-500 ring-inset bg-purple-50/20" : ""
                  } ${
                    isHighlightedForTarget ? "ring-2 ring-amber-500 ring-inset bg-amber-50/20" : ""
                  }`}
                  title={`Click to plan an immunization session for ${cell.dateString}`}
                >
                  <div className="flex items-center justify-between mb-1 pointer-events-none">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        cell.isToday
                          ? "bg-emerald-600 text-white shadow-sm"
                          : cell.isCurrentMonth
                          ? "text-slate-800 dark:text-slate-200"
                          : "text-muted-foreground"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200">
                      + Plan
                    </span>
                  </div>

                  {/* Day Events Container */}
                  <div className="space-y-1 flex-1 overflow-y-auto max-h-[90px] pr-0.5">
                    {/* Public Holidays */}
                    {dayEvents.holidays.map((h, hIdx) => (
                      <div
                        key={`h-${hIdx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEventDetail(h);
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-medium flex items-center gap-1 border border-purple-200/60 truncate cursor-pointer hover:bg-purple-100 transition-colors shadow-2xs"
                        title={`Public Holiday: ${h.title} (Click for details)`}
                      >
                        <Flag className="w-2.5 h-2.5 shrink-0 text-purple-600" />
                        <span className="truncate">{h.title}</span>
                      </div>
                    ))}

                    {/* Campaigns & SIAs */}
                    {dayEvents.campaigns.map((c, cIdx) => (
                      <div
                        key={`c-${cIdx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEventDetail(c);
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-medium flex items-center gap-1 border border-blue-200/60 truncate cursor-pointer hover:bg-blue-100 transition-colors shadow-2xs"
                        title={`Campaign: ${c.title} (Click for details)`}
                      >
                        <Megaphone className="w-2.5 h-2.5 shrink-0 text-blue-600" />
                        <span className="truncate">{c.title}</span>
                      </div>
                    ))}

                    {/* Immunization Sessions */}
                    {dayEvents.sessions.map((s, sIdx) => {
                      const isOutreach = s.sessionType === "outreach" || s.strategy === "outreach";
                      const isMobile = s.sessionType === "mobile" || s.strategy === "mobile";
                      const facName = facilityMap.get(s.facilityId)?.name || "Facility";

                      return (
                        <div
                          key={`s-${s.id || sIdx}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSessionDetail(s);
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center justify-between gap-1 cursor-pointer transition-transform hover:scale-[1.02] border truncate shadow-2xs ${
                            isMobile
                              ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-100"
                              : isOutreach
                              ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-100"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100"
                          }`}
                          title={`Click to view: ${s.name || 'Session'} @ ${facName}`}
                        >
                          <div className="flex items-center gap-1 truncate">
                            {isMobile ? <Truck className="w-2.5 h-2.5 shrink-0 text-amber-600" /> : isOutreach ? <MapPin className="w-2.5 h-2.5 shrink-0 text-blue-600" /> : <Syringe className="w-2.5 h-2.5 shrink-0 text-emerald-600" />}
                            <span className="truncate">{s.name || facName}</span>
                          </div>
                          {Number(s.effectiveTargetPopulation ?? s.targetPopulation ?? s.targetChildren ?? 0) > 0 && (
                            <span className="text-[9px] opacity-80 shrink-0 font-mono font-semibold">
                              {Number(s.effectiveTargetPopulation ?? s.targetPopulation ?? s.targetChildren).toLocaleString()} target
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : calendarView === "agenda" ? (
        /* Agenda List Table View */
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Planned Sessions Agenda</CardTitle>
            <CardDescription className="text-xs">Chronological listing of scheduled immunization activities across facilities.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Session Name</TableHead>
                    <TableHead className="text-xs font-semibold">Facility</TableHead>
                    <TableHead className="text-xs font-semibold">Strategy</TableHead>
                    <TableHead className="text-xs font-semibold">Location / Catchment</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Target Children</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-xs text-muted-foreground">
                        No session plans found matching the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSessions.map((session) => {
                      const fac = facilityMap.get(session.facilityId);
                      return (
                        <TableRow key={session.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setSelectedSessionDetail(session)}>
                          <TableCell className="text-xs font-mono font-medium whitespace-nowrap">
                            {getSessionDate(session) || "Not scheduled"}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-slate-900 dark:text-white">
                            {session.name || "Immunization Session"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {fac?.name || `Facility #${session.facilityId}`}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="capitalize text-[10px]">
                              {session.sessionType || session.strategy || "Outreach"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {session.communities?.length
                              ? session.communities.map((community: any) => community.name).join(", ")
                              : "No communities linked"}
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold">
                            {Number(session.effectiveTargetPopulation ?? session.targetPopulation ?? session.targetChildren ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            <Badge variant="secondary" className="capitalize text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              {session.status || "Planned"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-4 ${calendarView === "quarter" ? "md:grid-cols-3" : calendarView === "halfyear" ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"}`}>
          {planningMonths.map((planningMonth) => (
            <PlanningMonthCard
              key={`${planningMonth.getFullYear()}-${planningMonth.getMonth()}`}
              date={planningMonth}
              sessions={filteredSessions}
              nationalEvents={nationalEvents}
              onDate={handleOpenInitiateModal}
              onSession={setSelectedSessionDetail}
              onNationalEvent={setSelectedEventDetail}
              onShowMonth={(date) => {
                setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
                setCalendarView("month");
              }}
            />
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. MODAL: INITIATE / SCHEDULE NEW SESSION PLAN
      ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={initiateModalOpen} onOpenChange={setInitiateModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Plus className="w-5 h-5 text-emerald-600" />
              Schedule Immunization Session
            </DialogTitle>
            <DialogDescription className="text-xs">
              Plan and allocate a new fixed, outreach, or mobile session on the national master schedule.
            </DialogDescription>
          </DialogHeader>

          {/* National Event / Holiday Alert if selected date matches */}
          {modalDateEvents.length > 0 && (
            <div className="space-y-2">
              {modalDateEvents.map(ev => (
                <div
                  key={ev.id}
                  className={`p-2.5 rounded-lg text-xs border flex items-start gap-2 ${
                    ev.eventType === "public_holiday"
                      ? "bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950/40 dark:text-purple-200"
                      : "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
                  }`}
                >
                  {ev.eventType === "public_holiday" ? (
                    <Flag className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  ) : (
                    <Megaphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold">{ev.title}</span>
                    {ev.description && <p className="text-[11px] opacity-90 mt-0.5">{ev.description}</p>}
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 bg-white/70 dark:bg-black/30 rounded">
                      {ev.impactOnSessions === "closed" ? "⚠️ Clinic May Be Closed (Public Holiday)" : "✨ High Turnout Opportunity"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label>Health Facility *</Label>
              <SearchableSelect
                value={newSessionFacilityId ? String(newSessionFacilityId) : ""}
                onValueChange={(val) => setNewSessionFacilityId(Number(val))}
                options={facilityOptions}
                placeholder="Select Health Facility..."
                searchPlaceholder="Search facility name..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Execution Date *</Label>
                <Input
                  type="date"
                  value={newSessionDate}
                  onChange={(e) => {
                    setNewSessionDate(e.target.value);
                    setSelectedDateForSession(e.target.value);
                  }}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Delivery Strategy *</Label>
                <Select value={newSessionStrategy} onValueChange={(val: any) => setNewSessionStrategy(val)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Facility Session</SelectItem>
                    <SelectItem value="outreach">Outreach Mobile Post</SelectItem>
                    <SelectItem value="mobile">Hard-to-Reach Mobile Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Session Title / Name</Label>
              <Input
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="e.g. Outreach Clinic - Zone 4"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Target Village / Community Location</Label>
              <Input
                value={newSessionVillageName}
                onChange={(e) => setNewSessionVillageName(e.target.value)}
                placeholder="e.g. Hermiston Village Community Hall"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Target Children (Under 1y / 5y)</Label>
                <Input
                  type="number"
                  min="0"
                  value={newSessionTargetChildren}
                  onChange={(e) => setNewSessionTargetChildren(Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Target Pregnant Women (ANC)</Label>
                <Input
                  type="number"
                  min="0"
                  value={newSessionTargetWomen}
                  onChange={(e) => setNewSessionTargetWomen(Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Assigned Team Leader / HCW</Label>
              <Input
                value={newSessionTeamLead}
                onChange={(e) => setNewSessionTeamLead(e.target.value)}
                placeholder="e.g. Sister Nomsa Khumalo (Nurse)"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Planning Notes & Logistics Requirements</Label>
              <Textarea
                value={newSessionNotes}
                onChange={(e) => setNewSessionNotes(e.target.value)}
                placeholder="Cold chain carriers, transport route, community mobilizer details..."
                className="h-20 text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setInitiateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              disabled={createSessionMutation.isPending || !newSessionDate || !newSessionFacilityId}
              onClick={handleSaveSession}
            >
              {createSessionMutation.isPending ? "Scheduling..." : "Schedule Session Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────────────
          7. MODAL: SESSION DETAILS & REVIEW
      ───────────────────────────────────────────────────────────────────────────── */}
      {selectedSessionDetail && (
        <Dialog open={!!selectedSessionDetail} onOpenChange={() => setSelectedSessionDetail(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="w-5 h-5 text-emerald-600" />
                {selectedSessionDetail.name || "Session Plan Details"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Review scheduled parameters, logistics, and target beneficiaries.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Facility:</span>
                  <span className="font-bold text-foreground">
                    {facilityMap.get(selectedSessionDetail.facilityId)?.name || `Facility #${selectedSessionDetail.facilityId}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Date:</span>
                  <span className="font-bold text-foreground">
                    {getSessionDate(selectedSessionDetail) || "Not scheduled"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Strategy:</span>
                  <Badge variant="outline" className="capitalize mt-0.5">
                    {selectedSessionDetail.sessionType || selectedSessionDetail.strategy || "Outreach"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Status:</span>
                  <Badge variant="secondary" className="capitalize mt-0.5 bg-emerald-100 text-emerald-800">
                    {selectedSessionDetail.status || "Planned"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground block text-[11px]">Target Community / Site:</span>
                {selectedSessionDetail.communities?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSessionDetail.communities.map((community: any) => (
                      <Badge key={community.id} variant="outline" className="font-medium">
                        {community.name}
                        {community.isHardToReach ? " · HTR" : ""}
                        {community.distanceKm != null ? ` · ${community.distanceKm.toFixed(1)} km` : ""}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="font-medium text-amber-700">No communities linked to this session</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Target Population:</span>
                  <span className="font-bold text-base text-emerald-600">
                    {Number(selectedSessionDetail.effectiveTargetPopulation ?? selectedSessionDetail.targetPopulation ?? 0).toLocaleString()}
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedSessionDetail.targetPopulationSource === "session_plan"
                      ? "Saved session target"
                      : selectedSessionDetail.targetPopulationSource === "linked_community_under1"
                        ? "Latest registered under-1 population across linked communities"
                        : "No denominator available"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Estimated Duration:</span>
                  <span className="font-bold text-base text-blue-600">
                    {selectedSessionDetail.estimatedDuration
                      ? `${selectedSessionDetail.estimatedDuration} min`
                      : "Not recorded"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Parent Microplan:</span>
                  <p className="font-medium">{selectedSessionDetail.microplanName || `Microplan #${selectedSessionDetail.microplanId}`}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedSessionDetail.microplanYear || selectedSessionDetail.year} Q{selectedSessionDetail.microplanQuarter || selectedSessionDetail.quarter}
                    {selectedSessionDetail.microplanStatus ? ` · ${selectedSessionDetail.microplanStatus}` : ""}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Logistics:</span>
                  <p className="font-medium capitalize">
                    {selectedSessionDetail.transportMode
                      ? `${selectedSessionDetail.transportMode.replaceAll("_", " ")} transport`
                      : "Transport not recorded"}
                  </p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    Approval: {selectedSessionDetail.approvalStatus || "draft"}
                  </p>
                </div>
              </div>

              {(selectedSessionDetail.campaignAntigen || selectedSessionDetail.campaignTargetAge || selectedSessionDetail.outreachPurpose) && (
                <div className="space-y-1 pt-2 border-t">
                  <span className="text-muted-foreground block text-[11px]">Programme Context:</span>
                  <p className="font-medium">
                    {[
                      selectedSessionDetail.campaignAntigen,
                      selectedSessionDetail.campaignTargetAge,
                      selectedSessionDetail.outreachPurpose?.replaceAll("_", " "),
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
              )}

              {selectedSessionDetail.notes && (
                <div className="space-y-1 pt-2 border-t">
                  <span className="text-muted-foreground block text-[11px]">Notes:</span>
                  <p className="text-muted-foreground bg-muted/20 p-2 rounded text-xs">{selectedSessionDetail.notes}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedSessionDetail(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          8. MODAL: NATIONAL EVENT DETAILS & OPPORTUNITY TO PLAN
      ───────────────────────────────────────────────────────────────────────────── */}
      {selectedEventDetail && (
        <Dialog open={!!selectedEventDetail} onOpenChange={() => setSelectedEventDetail(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                {selectedEventDetail.eventType === "public_holiday" ? (
                  <Flag className="w-5 h-5 text-purple-600" />
                ) : (
                  <Megaphone className="w-5 h-5 text-blue-600" />
                )}
                {selectedEventDetail.title}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {selectedEventDetail.eventType === "public_holiday" ? "National Public Holiday" : "Health Campaign / SIA Window"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="bg-muted/40 p-3 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start Date:</span>
                  <span className="font-bold">{selectedEventDetail.startDate}</span>
                </div>
                {selectedEventDetail.endDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">End Date:</span>
                    <span className="font-bold">{selectedEventDetail.endDate}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Impact on Sessions:</span>
                  <Badge variant="outline" className="capitalize text-[10px]">
                    {selectedEventDetail.impactOnSessions?.replace(/_/g, " ") || "Routine"}
                  </Badge>
                </div>
              </div>

              {selectedEventDetail.description && (
                <div>
                  <span className="text-muted-foreground block text-[11px] mb-1">Description & Guidelines:</span>
                  <p className="text-foreground text-xs leading-relaxed bg-muted/20 p-2.5 rounded border">
                    {selectedEventDetail.description}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setSelectedEventDetail(null)}>
                Close
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  const d = selectedEventDetail.startDate;
                  setSelectedEventDetail(null);
                  handleOpenInitiateModal(d);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Plan Session for this Date
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
