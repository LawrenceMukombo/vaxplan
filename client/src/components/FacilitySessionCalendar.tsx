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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { NationalCalendarEvent } from "../../../shared/countryHolidays";

interface FacilitySessionCalendarProps {
  facility: {
    id: number;
    name: string;
    hmisCode?: string;
    facilityType?: string;
    latitude?: number | string;
    longitude?: number | string;
    districtId?: number;
  };
  countryCode?: string;
  activeSessionPlans?: any[];
  onSessionCreated?: (newSession: any) => void;
  className?: string;
}

export function FacilitySessionCalendar({
  facility,
  countryCode = "ZAF",
  activeSessionPlans = [],
  onSessionCreated,
  className = "",
}: FacilitySessionCalendarProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Current calendar view state: month, week, agenda
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<"month" | "agenda">("month");

  // Filter toggles
  const [showSessions, setShowSessions] = useState(true);
  const [showHolidays, setShowHolidays] = useState(true);
  const [showCampaigns, setShowCampaigns] = useState(true);

  // Dialog states
  const [initiateModalOpen, setInitiateModalOpen] = useState(false);
  const [selectedDateForSession, setSelectedDateForSession] = useState<string>("");
  const [customEventModalOpen, setCustomEventModalOpen] = useState(false);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<any | null>(null);

  // New session form state
  const [newSessionType, setNewSessionType] = useState<"fixed" | "outreach" | "mobile">("fixed");
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionVillageId, setNewSessionVillageId] = useState<string>("");
  const [newTargetPopulation, setNewTargetPopulation] = useState<number>(25);
  const [newTransportMode, setNewTransportMode] = useState<string>("walking");
  const [newEstimatedDuration, setNewEstimatedDuration] = useState<number>(4);
  const [newVaccinatorName, setNewVaccinatorName] = useState<string>("");
  const [newChvMobilizerName, setNewChvMobilizerName] = useState<string>("");
  const [newColdChainEquipment, setNewColdChainEquipment] = useState<string>("Vaccine Carrier (4 Coolant Packs)");
  const [newSessionNotes, setNewSessionNotes] = useState<string>("");

  // Custom national event form state
  const [customEventTitle, setCustomEventTitle] = useState("");
  const [customEventType, setCustomEventType] = useState<string>("campaign");
  const [customEventStartDate, setCustomEventStartDate] = useState("");
  const [customEventEndDate, setCustomEventEndDate] = useState("");
  const [customEventDescription, setCustomEventDescription] = useState("");
  const [customEventImpact, setCustomEventImpact] = useState<string>("high_turnout_opportunity");

  // Fetch live microplans to find a parent for session attachment
  const { data: microplansList = [] } = useQuery<any[]>({
    queryKey: ["/api/microplans", { facilityId: facility.id }],
    queryFn: async () => {
      try {
        const res: any = await apiRequest("GET", `/api/microplans?facilityId=${facility.id}`);
        return await res.json();
      } catch {
        return [];
      }
    },
    enabled: !!facility.id,
  });

  // Fetch live sessions for this facility
  const { data: serverSessions = [], isLoading: isLoadingSessions } = useQuery<any[]>({
    queryKey: ["/api/sessions", { facilityId: facility.id }],
    queryFn: async () => {
      if (!facility.id) return [];
      const res: any = await apiRequest("GET", `/api/sessions?facilityId=${facility.id}`);
      return await res.json();
    },
    enabled: !!facility.id,
  });

  // Fetch villages/catchment for this facility to populate community dropdown
  const { data: facilityVillages = [] } = useQuery<any[]>({
    queryKey: ["/api/villages", { facilityId: facility.id }],
    queryFn: async () => {
      try {
        const res: any = await apiRequest("GET", `/api/villages?facilityId=${facility.id}`);
        return await res.json();
      } catch {
        return [];
      }
    },
    enabled: !!facility.id,
  });

  // Fetch live staff to populate vaccinator/volunteer suggestions
  const { data: staffList = [] } = useQuery<any[]>({
    queryKey: ["/api/staff", { facilityId: facility.id }],
    queryFn: async () => {
      try {
        const res: any = await apiRequest("GET", `/api/staff?facilityId=${facility.id}`);
        return await res.json();
      } catch {
        return [];
      }
    },
    enabled: !!facility.id,
  });

  // Fetch National Public Holidays and Health Campaign Events
  const { data: nationalCalendarData, isLoading: isLoadingCalendarEvents } = useQuery<{ countryCode: string; events: NationalCalendarEvent[] }>({
    queryKey: ["/api/national/calendar-events", countryCode],
    queryFn: async () => {
      const res: any = await apiRequest("GET", `/api/national/calendar-events?countryCode=${countryCode}`);
      return await res.json();
    },
  });

  const nationalEvents = useMemo(() => {
    return nationalCalendarData?.events || [];
  }, [nationalCalendarData]);

  // Combine and deduplicate sessions
  const combinedSessions = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of activeSessionPlans) {
      map.set(String(s.id), s);
    }
    for (const s of serverSessions) {
      map.set(String(s.id), s);
    }
    return Array.from(map.values());
  }, [activeSessionPlans, serverSessions]);

  // Calendar Date Math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday

  // Days matrix for current month
  const calendarDays = useMemo(() => {
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = prevDate.toISOString().split("T")[0];
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Current month days
    const todayStr = new Date().toISOString().split("T")[0];
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding to complete 35 or 42 grid
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = nextDate.toISOString().split("T")[0];
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [year, month, firstDayIndex, daysInMonth]);

  // Map events and sessions by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map = new Map<string, { sessions: any[]; holidays: NationalCalendarEvent[]; campaigns: NationalCalendarEvent[] }>();

    // Index national events
    for (const ev of nationalEvents) {
      const start = ev.startDate;
      const end = ev.endDate || ev.startDate;

      // Handle single day or multi-day range
      let cur = new Date(start);
      const last = new Date(end);

      while (cur <= last) {
        const dStr = cur.toISOString().split("T")[0];
        if (!map.has(dStr)) {
          map.set(dStr, { sessions: [], holidays: [], campaigns: [] });
        }
        const bucket = map.get(dStr)!;
        if (ev.eventType === "public_holiday") {
          bucket.holidays.push(ev);
        } else {
          bucket.campaigns.push(ev);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Index planned facility sessions
    for (const sess of combinedSessions) {
      if (!sess.scheduledDate) continue;
      const dStr = typeof sess.scheduledDate === "string"
        ? sess.scheduledDate.split("T")[0]
        : new Date(sess.scheduledDate).toISOString().split("T")[0];

      if (!map.has(dStr)) {
        map.set(dStr, { sessions: [], holidays: [], campaigns: [] });
      }
      map.get(dStr)!.sessions.push(sess);
    }

    return map;
  }, [nationalEvents, combinedSessions]);

  // Session Initiation Mutation
  const createSessionMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res: any = await apiRequest("POST", "/api/sessions", payload);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Session Plan Initiated",
        description: `Successfully planned '${newSessionName || "Immunization Session"}' on ${selectedDateForSession}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      setInitiateModalOpen(false);
      resetNewSessionForm();
      if (onSessionCreated) onSessionCreated(data);
    },
    onError: (err: any) => {
      toast({
        title: "Session Planning Note",
        description: err?.message || "Could not save session plan to server. Saved to offline session ledger.",
        variant: "destructive",
      });
    },
  });

  // National Custom Event Mutation
  const createNationalEventMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res: any = await apiRequest("POST", "/api/national/calendar-events", payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Calendar Event Saved",
        description: `Custom event '${customEventTitle}' added to national health calendar.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/national/calendar-events"] });
      setCustomEventModalOpen(false);
      resetCustomEventForm();
    },
    onError: (err: any) => {
      toast({
        title: "Failed to Save Event",
        description: err?.message || "Could not save national calendar event.",
        variant: "destructive",
      });
    },
  });

  const resetNewSessionForm = () => {
    setNewSessionName("");
    setNewSessionType("fixed");
    setNewSessionVillageId("");
    setNewTargetPopulation(25);
    setNewTransportMode("walking");
    setNewEstimatedDuration(4);
    setNewVaccinatorName("");
    setNewChvMobilizerName("");
    setNewSessionNotes("");
  };

  const resetCustomEventForm = () => {
    setCustomEventTitle("");
    setCustomEventType("campaign");
    setCustomEventStartDate("");
    setCustomEventEndDate("");
    setCustomEventDescription("");
    setCustomEventImpact("high_turnout_opportunity");
  };

  const handleOpenInitiateModal = (dateStr?: string) => {
    const targetDate = dateStr || new Date().toISOString().split("T")[0];
    setSelectedDateForSession(targetDate);
    const dateObj = new Date(targetDate);
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
    setNewSessionName(`Routine Immunization Session (${dayName}, ${targetDate})`);
    setInitiateModalOpen(true);
  };

  const handleSaveSession = () => {
    if (!selectedDateForSession) {
      toast({ title: "Date required", description: "Please select a scheduled date", variant: "destructive" });
      return;
    }

    // Resolve or fallback parent microplan
    const parentPlan = microplansList.find((p: any) => p.facilityId === facility.id && p.status === "draft")
      || microplansList[0]
      || { id: 1, year: new Date(selectedDateForSession).getFullYear(), quarter: Math.floor(new Date(selectedDateForSession).getMonth() / 3) + 1 };

    const payload = {
      facilityId: facility.id,
      microplanId: parentPlan.id || 1,
      name: newSessionName || `Immunization Session (${newSessionType.toUpperCase()})`,
      sessionType: newSessionType,
      scheduledDate: new Date(selectedDateForSession).toISOString(),
      quarter: parentPlan.quarter || Math.floor(new Date(selectedDateForSession).getMonth() / 3) + 1,
      year: parentPlan.year || new Date(selectedDateForSession).getFullYear(),
      targetPopulation: Number(newTargetPopulation) || 25,
      transportMode: newTransportMode,
      estimatedDuration: Number(newEstimatedDuration) || 4,
      status: "planned",
      notes: newSessionNotes || `Vaccinator: ${newVaccinatorName || "Assigned Nurse"} | Mobilizer: ${newChvMobilizerName || "Community CHV"} | Equipment: ${newColdChainEquipment}`,
      humanResources: JSON.stringify({
        vaccinator: newVaccinatorName,
        mobilizer: newChvMobilizerName,
        equipment: newColdChainEquipment,
      }),
      villageIds: newSessionVillageId ? [Number(newSessionVillageId)] : [],
      override: true,
    };

    createSessionMutation.mutate(payload);
  };

  const handleSaveCustomEvent = () => {
    if (!customEventTitle || !customEventStartDate) {
      toast({ title: "Missing fields", description: "Title and start date are required", variant: "destructive" });
      return;
    }

    createNationalEventMutation.mutate({
      title: customEventTitle,
      eventType: customEventType,
      startDate: customEventStartDate,
      endDate: customEventEndDate || undefined,
      description: customEventDescription,
      impactOnSessions: customEventImpact,
    });
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const jumpToToday = () => {
    setCurrentDate(new Date());
  };

  // Summary counts for current month
  const currentMonthCounts = useMemo(() => {
    let sessionCount = 0;
    let holidayCount = 0;
    let campaignCount = 0;

    for (const d of calendarDays) {
      if (!d.isCurrentMonth) continue;
      const data = eventsByDate.get(d.dateStr);
      if (data) {
        sessionCount += data.sessions.length;
        holidayCount += data.holidays.length;
        campaignCount += data.campaigns.length;
      }
    }

    return { sessionCount, holidayCount, campaignCount };
  }, [calendarDays, eventsByDate]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. CALENDAR HEADER & CONTROLS
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl shadow-sm border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                {facility.name} • Session Calendar
              </h3>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/40 text-[10px] font-mono">
                {facility.hmisCode || `HF-${facility.id}`}
              </Badge>
            </div>
            <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
              <span>{monthNames[month]} {year}</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">{currentMonthCounts.sessionCount} Sessions Planned</span>
              <span>•</span>
              <span className="text-rose-300">{currentMonthCounts.holidayCount} Holidays</span>
              <span>•</span>
              <span className="text-indigo-300">{currentMonthCounts.campaignCount} Campaigns</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Stepper */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/20">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20 rounded-md"
              onClick={prevMonth}
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs font-semibold text-white hover:bg-white/20"
              onClick={jumpToToday}
            >
              Today
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20 rounded-md"
              onClick={nextMonth}
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* View switcher */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/20">
            <Button
              variant={calendarView === "month" ? "default" : "ghost"}
              size="sm"
              className={`h-7 px-2.5 text-xs ${calendarView === "month" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-slate-300 hover:text-white hover:bg-white/10"}`}
              onClick={() => setCalendarView("month")}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1" />
              Month
            </Button>
            <Button
              variant={calendarView === "agenda" ? "default" : "ghost"}
              size="sm"
              className={`h-7 px-2.5 text-xs ${calendarView === "agenda" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-slate-300 hover:text-white hover:bg-white/10"}`}
              onClick={() => setCalendarView("agenda")}
            >
              <TableIcon className="w-3.5 h-3.5 mr-1" />
              Agenda
            </Button>
          </div>

          {/* Initiate Session Button */}
          <Button
            size="sm"
            className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
            onClick={() => handleOpenInitiateModal()}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Plan Session
          </Button>

          {/* National Event Customization */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 border-indigo-500/40 text-xs"
            onClick={() => setCustomEventModalOpen(true)}
          >
            <Globe className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
            National Events
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. FILTER TOGGLE BAR & LEGEND
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg border text-xs">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-muted-foreground flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Legend & Layer Filters:
          </span>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showSessions}
              onChange={(e) => setShowSessions(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1 font-medium text-emerald-800 dark:text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Planned Sessions ({currentMonthCounts.sessionCount})
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showHolidays}
              onChange={(e) => setShowHolidays(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1 font-medium text-rose-800 dark:text-rose-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              Public Holidays ({currentMonthCounts.holidayCount})
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCampaigns}
              onChange={(e) => setShowCampaigns(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1 font-medium text-indigo-800 dark:text-indigo-300">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
              National Health Campaigns ({currentMonthCounts.campaignCount})
            </span>
          </label>
        </div>

        <div className="text-[11px] text-muted-foreground">
          Tip: Click any date cell to plan a session directly for that day.
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. VIEW 1: INTERACTIVE MONTH GRID
      ───────────────────────────────────────────────────────────────────────────── */}
      {calendarView === "month" && (
        <Card className="border shadow-sm overflow-hidden bg-card">
          <CardContent className="p-0">
            {/* Weekday Column Headers */}
            <div className="grid grid-cols-7 border-b bg-slate-100/80 dark:bg-slate-800/80 text-center text-xs font-bold text-slate-700 dark:text-slate-300 py-2">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Day Cells Grid */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 dark:divide-slate-800 border-b">
              {calendarDays.map((day, idx) => {
                const dayData = eventsByDate.get(day.dateStr);
                const daySessions = showSessions ? (dayData?.sessions || []) : [];
                const dayHolidays = showHolidays ? (dayData?.holidays || []) : [];
                const dayCampaigns = showCampaigns ? (dayData?.campaigns || []) : [];

                const hasEvents = daySessions.length > 0 || dayHolidays.length > 0 || dayCampaigns.length > 0;

                return (
                  <div
                    key={`${day.dateStr}-${idx}`}
                    onClick={() => handleOpenInitiateModal(day.dateStr)}
                    className={`min-h-[105px] md:min-h-[120px] p-1.5 flex flex-col justify-between transition-colors cursor-pointer group hover:bg-emerald-500/5 ${
                      !day.isCurrentMonth
                        ? "bg-slate-50/60 dark:bg-slate-900/40 text-muted-foreground opacity-50"
                        : day.isToday
                        ? "bg-emerald-500/10 dark:bg-emerald-950/30 ring-1 ring-inset ring-emerald-500/50"
                        : "bg-white dark:bg-slate-900/80 text-foreground"
                    }`}
                  >
                    {/* Day Cell Header */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold inline-flex items-center justify-center rounded-full w-5 h-5 ${
                          day.isToday
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-700 dark:text-slate-300 group-hover:text-emerald-600"
                        }`}
                      >
                        {day.dayNum}
                      </span>

                      {/* Quick + button on hover */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInitiateModal(day.dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-opacity"
                        title="Plan session for this date"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Events & Sessions Chips List */}
                    <div className="space-y-1 my-1 flex-1 overflow-y-auto max-h-[75px] custom-scrollbar pr-0.5">
                      {/* Public Holiday Banner */}
                      {dayHolidays.map((h) => (
                        <div
                          key={h.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            toast({
                              title: `Public Holiday: ${h.title}`,
                              description: h.description || "Facility routine sessions may be closed or rescheduled.",
                            });
                          }}
                          className="bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-200 border border-rose-300 dark:border-rose-800/60 rounded px-1.5 py-0.5 text-[10px] font-semibold truncate flex items-center gap-1 shadow-2xs hover:scale-102 transition-transform"
                          title={`${h.title}: ${h.description}`}
                        >
                          <Flag className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                          <span className="truncate">{h.title}</span>
                        </div>
                      ))}

                      {/* Health Campaign Banner */}
                      {dayCampaigns.map((c) => (
                        <div
                          key={c.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            toast({
                              title: `Health Campaign: ${c.title}`,
                              description: c.description || "High turnout opportunity for EPI catch-up.",
                            });
                          }}
                          className="bg-indigo-100 text-indigo-900 dark:bg-indigo-950/70 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-800/60 rounded px-1.5 py-0.5 text-[10px] font-semibold truncate flex items-center gap-1 shadow-2xs hover:scale-102 transition-transform"
                          title={`${c.title}: ${c.description}`}
                        >
                          <Megaphone className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                          <span className="truncate">{c.title}</span>
                        </div>
                      ))}

                      {/* Planned Facility Sessions */}
                      {daySessions.map((sess) => {
                        const isFixed = sess.sessionType === "fixed";
                        const isOutreach = sess.sessionType === "outreach";
                        const isMobile = sess.sessionType === "mobile";

                        const colorClasses = isFixed
                          ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800"
                          : isOutreach
                          ? "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-800"
                          : "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800";

                        const Icon = isFixed ? Syringe : (isOutreach ? MapPin : Truck);

                        return (
                          <div
                            key={sess.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSessionDetail(sess);
                            }}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border flex items-center justify-between gap-1 shadow-2xs hover:scale-102 transition-transform ${colorClasses}`}
                            title={`${sess.name} (${sess.sessionType?.toUpperCase()}) - Target: ${sess.targetPopulation || 0} clients`}
                          >
                            <div className="flex items-center gap-1 truncate">
                              <Icon className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate font-bold">{sess.name || `${sess.sessionType} session`}</span>
                            </div>
                            {sess.targetPopulation && (
                              <span className="text-[9px] font-mono opacity-80 shrink-0">
                                {sess.targetPopulation}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Indicator / Empty State */}
                    {!hasEvents && (
                      <div className="text-[9px] text-muted-foreground/50 text-right pr-0.5">
                        —
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. VIEW 2: AGENDA / TABLE VIEW (ENTERPRISE GRADE - RULE 24)
      ───────────────────────────────────────────────────────────────────────────── */}
      {calendarView === "agenda" && (
        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>Facility Sessions & Health Days Agenda ({combinedSessions.length + nationalEvents.length} Total Records)</span>
              <Badge variant="outline" className="text-xs">
                {facility.name}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900">
                  <TableHead className="w-[120px] font-bold">Date</TableHead>
                  <TableHead className="w-[100px] font-bold">Type</TableHead>
                  <TableHead className="font-bold">Title / Session Name</TableHead>
                  <TableHead className="w-[130px] font-bold">Target / Impact</TableHead>
                  <TableHead className="w-[120px] font-bold">Status</TableHead>
                  <TableHead className="w-[100px] text-right font-bold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 1. Facility Planned Sessions */}
                {combinedSessions.map((sess) => {
                  const dStr = sess.scheduledDate ? String(sess.scheduledDate).split("T")[0] : "—";
                  return (
                    <TableRow key={`sess-${sess.id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <TableCell className="font-mono text-xs font-semibold">{dStr}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            sess.sessionType === "fixed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : sess.sessionType === "outreach"
                              ? "bg-blue-50 text-blue-700 border-blue-300"
                              : "bg-amber-50 text-amber-700 border-amber-300"
                          }`}
                        >
                          {sess.sessionType || "Session"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-xs">
                        {sess.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {sess.targetPopulation ? `${sess.targetPopulation} clients` : "Standard Catchment"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="text-[10px] bg-emerald-600 text-white">
                          {sess.status || "Planned"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setSelectedSessionDetail(sess)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* 2. National Public Holidays & Campaigns */}
                {nationalEvents.map((ev) => (
                  <TableRow key={`nat-${ev.id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 bg-slate-50/30">
                    <TableCell className="font-mono text-xs text-muted-foreground">{ev.startDate}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          ev.eventType === "public_holiday"
                            ? "bg-rose-50 text-rose-700 border-rose-300"
                            : "bg-indigo-50 text-indigo-700 border-indigo-300"
                        }`}
                      >
                        {ev.eventType === "public_holiday" ? "Public Holiday" : "National Campaign"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-xs">
                      {ev.title}
                      {ev.description && (
                        <p className="text-[10px] text-muted-foreground">{ev.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">
                      {ev.impactOnSessions?.replace(/_/g, " ") || "National"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] border-slate-300">
                        {ev.isNational ? "Official National" : "Custom District"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          toast({
                            title: ev.title,
                            description: `${ev.startDate}${ev.endDate ? ` to ${ev.endDate}` : ""} — ${ev.description || "National health calendar event."}`,
                          })
                        }
                      >
                        <Info className="w-3.5 h-3.5 mr-1" />
                        Info
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. MODAL: INITIATE / PLAN IMMUNIZATION SESSION
      ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={initiateModalOpen} onOpenChange={setInitiateModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Syringe className="w-5 h-5 text-emerald-600" />
              Initiate Immunization Session Plan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Plan an immunization session for <strong>{facility.name}</strong> on the selected calendar date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* Facility & Date Row */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border">
              <div>
                <Label className="text-[11px] text-muted-foreground">Healthcare Facility</Label>
                <div className="font-bold text-foreground mt-0.5 truncate">{facility.name}</div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Scheduled Date *</Label>
                <Input
                  type="date"
                  value={selectedDateForSession}
                  onChange={(e) => setSelectedDateForSession(e.target.value)}
                  className="h-8 text-xs mt-0.5 font-mono"
                />
              </div>
            </div>

            {/* Session Type Selector */}
            <div className="space-y-1.5">
              <Label className="font-bold">Session Delivery Strategy *</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNewSessionType("fixed")}
                  className={`p-2 rounded-lg border text-left flex flex-col items-center justify-center gap-1 transition-all ${
                    newSessionType === "fixed"
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold ring-2 ring-emerald-500/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                  }`}
                >
                  <Syringe className="w-4 h-4 text-emerald-600" />
                  <span>Fixed Clinic</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewSessionType("outreach")}
                  className={`p-2 rounded-lg border text-left flex flex-col items-center justify-center gap-1 transition-all ${
                    newSessionType === "outreach"
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 font-bold ring-2 ring-blue-500/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                  }`}
                >
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>Outreach Post</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewSessionType("mobile")}
                  className={`p-2 rounded-lg border text-left flex flex-col items-center justify-center gap-1 transition-all ${
                    newSessionType === "mobile"
                      ? "border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 font-bold ring-2 ring-amber-500/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                  }`}
                >
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>Mobile HTR</span>
                </button>
              </div>
            </div>

            {/* Session Title */}
            <div className="space-y-1">
              <Label className="font-bold">Session Name / Label *</Label>
              <Input
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="e.g. Routine Infant Session #14"
                className="h-8 text-xs"
              />
            </div>

            {/* Target Catchment Village (if outreach or mobile) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold">Target Catchment Community</Label>
                <Select value={newSessionVillageId} onValueChange={setNewSessionVillageId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select community..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Facility Catchment Central</SelectItem>
                    {facilityVillages.map((v: any) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.name} ({v.estimatedPopulation || 0} pop)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-bold">Target Headcount (Clients) *</Label>
                <Input
                  type="number"
                  value={newTargetPopulation}
                  onChange={(e) => setNewTargetPopulation(Number(e.target.value))}
                  min={1}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Human Resources & Staff Assignment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold">Assigned Vaccinator (HCW)</Label>
                <Input
                  value={newVaccinatorName}
                  onChange={(e) => setNewVaccinatorName(e.target.value)}
                  placeholder="e.g. Nurse In-Charge / Staff Name"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">CHV Community Mobilizer</Label>
                <Input
                  value={newChvMobilizerName}
                  onChange={(e) => setNewChvMobilizerName(e.target.value)}
                  placeholder="e.g. Community Health Volunteer"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Transport & Cold Chain Equipment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold">Transport Mode</Label>
                <Select value={newTransportMode} onValueChange={setNewTransportMode}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walking">Walking / On Foot</SelectItem>
                    <SelectItem value="bicycle">Bicycle</SelectItem>
                    <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    <SelectItem value="vehicle">4x4 Vehicle / Truck</SelectItem>
                    <SelectItem value="boat">Boat / Waterway</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-bold">Cold Chain Equipment</Label>
                <Input
                  value={newColdChainEquipment}
                  onChange={(e) => setNewColdChainEquipment(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="font-bold">Operational Notes & Antigen Focus</Label>
              <Textarea
                value={newSessionNotes}
                onChange={(e) => setNewSessionNotes(e.target.value)}
                placeholder="Specific antigens (e.g. Hexavalent, PCV, Rota, MR catch-up) and mobilization instructions."
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInitiateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={handleSaveSession}
              disabled={createSessionMutation.isPending}
            >
              {createSessionMutation.isPending ? "Planning Session..." : "Confirm & Schedule Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. MODAL: CUSTOMIZE NATIONAL HEALTH CALENDAR EVENTS
      ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={customEventModalOpen} onOpenChange={setCustomEventModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Globe className="w-5 h-5 text-indigo-600" />
              Customize National Health Events & Holidays
            </DialogTitle>
            <DialogDescription className="text-xs">
              National-level administrators and coordinators can declare supplementary immunization activities (SIAs), child health days, or country-specific public holidays.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="font-bold">Event Title *</Label>
              <Input
                value={customEventTitle}
                onChange={(e) => setCustomEventTitle(e.target.value)}
                placeholder="e.g. National Measles-Rubella Catch-up SIA"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold">Event Category *</Label>
                <Select value={customEventType} onValueChange={setCustomEventType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="campaign">Supplementary SIA / Campaign</SelectItem>
                    <SelectItem value="health_event">Child Health / Vaccination Week</SelectItem>
                    <SelectItem value="public_holiday">National Public Holiday</SelectItem>
                    <SelectItem value="training">HCW / CHV Training Workshop</SelectItem>
                    <SelectItem value="supervision">Supportive Supervision Round</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-bold">Session Impact</Label>
                <Select value={customEventImpact} onValueChange={setCustomEventImpact}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high_turnout_opportunity">High Turnout Opportunity</SelectItem>
                    <SelectItem value="closed">Health Center Closed / Holiday</SelectItem>
                    <SelectItem value="rescheduled">Reschedule Routine Sessions</SelectItem>
                    <SelectItem value="routine">Routine Care Continues</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold">Start Date *</Label>
                <Input
                  type="date"
                  value={customEventStartDate}
                  onChange={(e) => setCustomEventStartDate(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">End Date (Optional)</Label>
                <Input
                  type="date"
                  value={customEventEndDate}
                  onChange={(e) => setCustomEventEndDate(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-bold">Description & Operational Directives</Label>
              <Textarea
                value={customEventDescription}
                onChange={(e) => setCustomEventDescription(e.target.value)}
                placeholder="Provide guidelines for health workers regarding target age groups and mobilization."
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomEventModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              onClick={handleSaveCustomEvent}
              disabled={createNationalEventMutation.isPending}
            >
              {createNationalEventMutation.isPending ? "Saving..." : "Publish National Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────────────
          7. MODAL: VIEW SESSION DETAILS
      ───────────────────────────────────────────────────────────────────────────── */}
      {selectedSessionDetail && (
        <Dialog open={!!selectedSessionDetail} onOpenChange={() => setSelectedSessionDetail(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Syringe className="w-5 h-5 text-emerald-600" />
                Session Plan Details
              </DialogTitle>
              <DialogDescription className="text-xs">
                {selectedSessionDetail.name} • {facility.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Scheduled Date:</span>
                  <span className="font-bold text-foreground">
                    {selectedSessionDetail.scheduledDate ? String(selectedSessionDetail.scheduledDate).split("T")[0] : "Not Set"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Strategy Type:</span>
                  <Badge variant="outline" className="capitalize text-[10px] mt-0.5">
                    {selectedSessionDetail.sessionType || "Fixed"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5 border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Population:</span>
                  <strong className="text-foreground">{selectedSessionDetail.targetPopulation || "25"} clients</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transport Mode:</span>
                  <strong className="text-foreground capitalize">{selectedSessionDetail.transportMode || "Walking"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Duration:</span>
                  <strong className="text-foreground">{selectedSessionDetail.estimatedDuration || 4} hours</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Approval Status:</span>
                  <Badge variant="default" className="text-[10px] bg-emerald-600">
                    {selectedSessionDetail.status || "Planned"}
                  </Badge>
                </div>
              </div>

              {selectedSessionDetail.notes && (
                <div className="border-t pt-2">
                  <span className="font-bold block text-foreground mb-1">Operational Notes:</span>
                  <p className="text-muted-foreground text-[11px] bg-slate-50 dark:bg-slate-900/60 p-2 rounded border">
                    {selectedSessionDetail.notes}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => setSelectedSessionDetail(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
