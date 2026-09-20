import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/DataTable";
import { GeoCascadeFilter } from "@/components/GeoCascadeFilter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  ClipboardEdit,
  MessageSquare,
  Send,
  Loader2,
  History,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Radio,
  Sparkles,
  PhoneCall,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface DefaulterRow {
  id: string;
  clientId: string;
  name: string;
  dateOfBirth: string;
  parentName: string | null;
  contactPhone: string | null;
  facilityId: number;
  facilityName: string;
  villageId: number | null;
  villageName: string | null;
  districtId: number;
  districtName: string;
  provinceId: number;
  nextDoseAntigen: string;
  dueDate: string;
  daysOverdue: number;
  lastDoseAntigen: string | null;
  lastDoseDate: string | null;
}

interface QuarterlyReview {
  id: number;
  facilityId: number;
  year: number;
  quarter: number;
  topDrivers: string[];
  correctiveActions: string;
  nextSurveyDate: string | null;
  updatedAt: string;
  updatedByName: string | null;
  createdByName: string | null;
}

function previousYearQuarter(year: number, quarter: number) {
  if (quarter === 1) return { year: year - 1, quarter: 4 };
  return { year, quarter: quarter - 1 };
}

const ANTIGEN_OPTIONS = [
  { value: "all", label: "All antigens" },
  { value: "BCG", label: "BCG" },
  { value: "OPV_0", label: "OPV 0" },
  { value: "OPV_1", label: "OPV 1" },
  { value: "OPV_2", label: "OPV 2" },
  { value: "OPV_3", label: "OPV 3" },
  { value: "PENTA_1", label: "Pentavalent 1 (DTP1)" },
  { value: "PENTA_2", label: "Pentavalent 2 (DTP2)" },
  { value: "PENTA_3", label: "Pentavalent 3 (DTP3)" },
  { value: "PCV_1", label: "PCV 1" },
  { value: "PCV_2", label: "PCV 2" },
  { value: "PCV_3", label: "PCV 3" },
  { value: "ROTA_1", label: "Rotavirus 1" },
  { value: "ROTA_2", label: "Rotavirus 2" },
  { value: "ROTA_3", label: "Rotavirus 3" },
  { value: "IPV_1", label: "IPV 1" },
  { value: "IPV_2", label: "IPV 2" },
  { value: "MR_1", label: "Measles-Rubella 1 (MCV1)" },
  { value: "MR_2", label: "Measles-Rubella 2" },
];

function currentYearQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return { year, quarter };
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Defaulters() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth() as { user: any };
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [facilityId, setFacilityId] = useState<number | null>(null);
  const [antigen, setAntigen] = useState<string>("all");
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Record that the user opened a defaulter review. The audit_log entry is
  // what the guided workflow Step 12 (RED 4 / RED-Q Measure) reads to mark
  // the quarterly review as opened.
  useEffect(() => {
    fetch("/api/indicators/defaulters/review", {
      method: "POST",
      credentials: "include",
    })
      .then(() => {
        queryClient.invalidateQueries({
          queryKey: ["/api/indicators/defaulter-review-status"],
        });
      })
      .catch(() => {});
  }, [queryClient]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (provinceId) p.set("provinceId", String(provinceId));
    if (districtId) p.set("districtId", String(districtId));
    if (facilityId) p.set("facilityId", String(facilityId));
    if (antigen && antigen !== "all") p.set("antigen", antigen);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [provinceId, districtId, facilityId, antigen]);

  const { data: defaulters = [], isLoading } = useQuery<DefaulterRow[]>({
    queryKey: ["/api/indicators/defaulters", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/indicators/defaulters${queryString}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch defaulters");
      const rows = (await res.json()) as DefaulterRow[];
      return rows.map((r) => ({ ...r, id: r.clientId }));
    },
  });

  const { data: effectiveness } = useQuery<{
    windowDays: number;
    followupDays: number;
    sent: number;
    childrenReminded: number;
    converted: number;
    childrenConverted: number;
    conversionPct: number;
    breakdown?: Array<{
      id: string;
      name: string;
      sent: number;
      converted: number;
      conversionPct: number;
    }>;
  }>({
    queryKey: ["/api/reminders/effectiveness", "facility"],
    queryFn: async () => {
      const res = await fetch("/api/reminders/effectiveness?breakdown=facility", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load reminder effectiveness");
      return await res.json();
    },
  });

  const { data: lastReminded = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/reminders/recent"],
    queryFn: async () => {
      const res = await fetch("/api/reminders/recent", { credentials: "include" });
      if (!res.ok) return {};
      return (await res.json()) as Record<string, string>;
    },
  });

  const sendOne = useMutation({
    mutationFn: async (row: DefaulterRow) => {
      return await apiRequest<{ success: boolean; sentAt: string }>(
        "POST",
        "/api/reminders/send",
        {
          clientId: row.clientId,
          antigen: row.nextDoseAntigen,
          dueDate: row.dueDate,
        },
      );
    },
    onMutate: (row) => setSendingId(row.clientId),
    onSettled: () => setSendingId(null),
    onSuccess: (_data, row) => {
      toast({
        title: "Reminder sent",
        description: `SMS sent to caregiver of ${row.name}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/recent"] });
    },
    onError: (err: any, row) => {
      toast({
        title: "Could not send reminder",
        description:
          err?.message?.replace(/^\d+:\s*/, "") ||
          `Failed to send SMS to caregiver of ${row.name}.`,
        variant: "destructive",
      });
    },
  });

  const sendBulk = useMutation({
    mutationFn: async (rows: DefaulterRow[]) => {
      return await apiRequest<{ success: boolean; count: number; skipped: number; message: string }>(
        "POST",
        "/api/reminders/bulk",
        {
          reason: "defaulters",
          clientIds: rows.map((r) => ({
            clientId: r.clientId,
            antigen: r.nextDoseAntigen,
            dueDate: r.dueDate,
          })),
        },
      );
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk reminders sent",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/recent"] });
    },
    onError: (err: any) => {
      toast({
        title: "Bulk reminders failed",
        description: err?.message?.replace(/^\d+:\s*/, "") || "Could not send reminders.",
        variant: "destructive",
      });
    },
  });

  const totalOverdue = defaulters.length;
  // >=56 days past due date = >4 weeks beyond the 4-week grace cutoff
  const severe = defaulters.filter((d) => d.daysOverdue >= 56).length;
  const reachable = useMemo(
    () => defaulters.filter((d) => !!d.contactPhone),
    [defaulters],
  );

  // ─── Quarterly review note ───
  // The note is per-facility. Facility staff can only write their own facility;
  // higher roles can pick any facility via the scope filter above.
  const { year, quarter } = currentYearQuarter();
  const roles = useMemo(() => {
    const list = new Set<string>();
    if (user?.role) list.add(user.role);
    if (Array.isArray(user?.roles)) (user.roles as string[]).forEach((r) => list.add(r));
    return list;
  }, [user]);
  const isFacilityStaff = roles.has("facility_clerk") || roles.has("facility_in_charge");
  const reviewFacilityId = isFacilityStaff ? (user?.facilityId ?? null) : facilityId;
  const canWriteReview = !!reviewFacilityId && (
    !isFacilityStaff || reviewFacilityId === user?.facilityId
  );

  const reviewQueryString = useMemo(() => {
    if (!reviewFacilityId) return "";
    const p = new URLSearchParams();
    p.set("facilityId", String(reviewFacilityId));
    p.set("year", String(year));
    p.set("quarter", String(quarter));
    return `?${p.toString()}`;
  }, [reviewFacilityId, year, quarter]);

  const { data: reviewRows = [] } = useQuery<QuarterlyReview[]>({
    queryKey: ["/api/quarterly-reviews", reviewQueryString],
    queryFn: async () => {
      if (!reviewFacilityId) return [];
      const res = await fetch(`/api/quarterly-reviews${reviewQueryString}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load review");
      return (await res.json()) as QuarterlyReview[];
    },
    enabled: !!reviewFacilityId,
  });
  const existingReview = reviewRows[0] ?? null;

  // Fetch all past reviews for the facility (no year/quarter filter) so we can
  // show the previous quarter's note above the form and a short history below.
  const historyQueryString = useMemo(() => {
    if (!reviewFacilityId) return "";
    const p = new URLSearchParams();
    p.set("facilityId", String(reviewFacilityId));
    return `?${p.toString()}`;
  }, [reviewFacilityId]);

  const { data: historyRows = [] } = useQuery<QuarterlyReview[]>({
    queryKey: ["/api/quarterly-reviews", historyQueryString, "history"],
    queryFn: async () => {
      if (!reviewFacilityId) return [];
      const res = await fetch(`/api/quarterly-reviews${historyQueryString}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load review history");
      return (await res.json()) as QuarterlyReview[];
    },
    enabled: !!reviewFacilityId,
  });

  const prev = previousYearQuarter(year, quarter);
  const previousReview = useMemo(
    () =>
      historyRows.find(
        (r) => r.year === prev.year && r.quarter === prev.quarter,
      ) ?? null,
    [historyRows, prev.year, prev.quarter],
  );
  // Last 4 quarters strictly prior to the current quarter.
  const pastReviews = useMemo(
    () =>
      historyRows
        .filter(
          (r) => r.year < year || (r.year === year && r.quarter < quarter),
        )
        .slice(0, 4),
    [historyRows, year, quarter],
  );
  const [pastOpen, setPastOpen] = useState(false);
  const [recallModalOpen, setRecallModalOpen] = useState(false);

  const [driver1, setDriver1] = useState("");
  const [driver2, setDriver2] = useState("");
  const [driver3, setDriver3] = useState("");
  const [correctiveActions, setCorrectiveActions] = useState("");
  const [nextSurveyDate, setNextSurveyDate] = useState("");

  // Rehydrate the form whenever the loaded review or selected facility changes.
  useEffect(() => {
    if (existingReview) {
      const d = existingReview.topDrivers || [];
      setDriver1(d[0] ?? "");
      setDriver2(d[1] ?? "");
      setDriver3(d[2] ?? "");
      setCorrectiveActions(existingReview.correctiveActions ?? "");
      setNextSurveyDate(
        existingReview.nextSurveyDate
          ? new Date(existingReview.nextSurveyDate).toISOString().slice(0, 10)
          : "",
      );
    } else {
      setDriver1("");
      setDriver2("");
      setDriver3("");
      setCorrectiveActions("");
      setNextSurveyDate("");
    }
  }, [existingReview?.id, reviewFacilityId]);

  const saveReview = useMutation({
    mutationFn: async () => {
      const drivers = [driver1, driver2, driver3]
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return await apiRequest("POST", "/api/quarterly-reviews", {
        facilityId: reviewFacilityId,
        year,
        quarter,
        topDrivers: drivers,
        correctiveActions: correctiveActions.trim(),
        nextSurveyDate: nextSurveyDate ? nextSurveyDate : null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Quarterly review saved",
        description: `Saved for Q${quarter} ${year}. Step 12 will reflect the update.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quarterly-reviews"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/indicators/defaulter-review-status"],
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not save review",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const driversFilled = [driver1, driver2, driver3].filter((s) => s.trim().length > 0).length;
  // Original code:
  // const formValid =
  //   canWriteReview &&
  //   driversFilled >= 1 &&
  //   correctiveActions.trim().length >= 5;
  const formValid =
    totalOverdue > 0 &&
    canWriteReview &&
    driversFilled >= 1 &&
    correctiveActions.trim().length >= 5;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
          Defaulter List
        </h1>
        <p className="text-sm text-muted-foreground">
          Children with a routine vaccination dose overdue by more than 4 weeks.
          Excludes SIA / campaign doses.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Total defaulters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-defaulters-total">
              {totalOverdue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Severely overdue (&ge; 8 weeks past due)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-600">{severe.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Antigen filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={antigen} onValueChange={setAntigen}>
              <SelectTrigger data-testid="select-defaulter-antigen">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANTIGEN_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-reminder-effectiveness">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Reminder effectiveness — last {effectiveness?.windowDays ?? 30} days
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            How many SMS reminders pulled a child back to the clinic within{" "}
            {effectiveness?.followupDays ?? 14} days of the send.
          </p>
        </CardHeader>
        <CardContent>
          {!effectiveness ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : effectiveness.sent === 0 ? (
            <div className="text-sm text-muted-foreground">
              No reminders sent in the last {effectiveness.windowDays} days yet.
              Once you start sending reminders, conversion will appear here.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Reminders sent
                  </div>
                  <div
                    className="text-3xl font-bold"
                    data-testid="text-reminders-sent"
                  >
                    {effectiveness.sent.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    to {effectiveness.childrenReminded.toLocaleString()}{" "}
                    {effectiveness.childrenReminded === 1 ? "child" : "children"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Vaccinated within {effectiveness.followupDays} days
                  </div>
                  <div
                    className="text-3xl font-bold text-emerald-600"
                    data-testid="text-reminders-converted"
                  >
                    {effectiveness.converted.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {effectiveness.childrenConverted.toLocaleString()} distinct{" "}
                    {effectiveness.childrenConverted === 1 ? "child" : "children"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Conversion rate
                  </div>
                  <div
                    className={`text-3xl font-bold ${
                      effectiveness.conversionPct >= 25
                        ? "text-emerald-600"
                        : effectiveness.conversionPct >= 10
                          ? "text-amber-600"
                          : "text-rose-600"
                    }`}
                    data-testid="text-reminders-conversion-pct"
                  >
                    {effectiveness.conversionPct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    of reminders led to a recorded dose
                  </div>
                </div>
              </div>

              {effectiveness.breakdown && effectiveness.breakdown.length > 0 && (
                <div className="mt-6">
                  <div className="text-sm font-medium mb-2">
                    By facility — where reminders are (and aren't) landing
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b">
                          <th className="py-2 pr-3">Facility</th>
                          <th className="py-2 pr-3 text-right">Sent</th>
                          <th className="py-2 pr-3 text-right">Converted</th>
                          <th className="py-2 text-right">Rate</th>
                        </tr>
                      </thead>
                      <tbody data-testid="table-reminder-effectiveness-breakdown">
                        {effectiveness.breakdown.slice(0, 10).map((row) => (
                          <tr key={row.id} className="border-b last:border-b-0">
                            <td className="py-2 pr-3">{row.name}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {row.sent.toLocaleString()}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {row.converted.toLocaleString()}
                            </td>
                            <td
                              className={`py-2 text-right tabular-nums font-medium ${
                                row.conversionPct >= 25
                                  ? "text-emerald-600"
                                  : row.conversionPct >= 10
                                    ? "text-amber-600"
                                    : "text-rose-600"
                              }`}
                            >
                              {row.conversionPct.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {effectiveness.breakdown.length > 10 && (
                      <div className="text-xs text-muted-foreground mt-2">
                        Showing top 10 facilities by reminder volume.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Scope</CardTitle>
        </CardHeader>
        <CardContent>
          <GeoCascadeFilter
            provinceId={provinceId}
            districtId={districtId}
            facilityId={facilityId}
            showFacility
            onProvinceChange={(id) => {
              setProvinceId(id);
              setDistrictId(null);
              setFacilityId(null);
            }}
            onDistrictChange={(id) => {
              setDistrictId(id);
              setFacilityId(null);
            }}
            onFacilityChange={(id) => setFacilityId(id)}
            testIdPrefix="defaulters"
          />
        </CardContent>
      </Card>

      <Card data-testid="card-quarterly-review">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardEdit className="h-4 w-4" />
            Quarterly review note — Q{quarter} {year}
            {existingReview && (
              <Badge variant="outline" className="ml-2 gap-1 border-emerald-500 text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Saved
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Record what the facility / district is doing about dropout this
            quarter — the top drivers, the corrective actions planned, and when
            the next coverage survey will run. This is what Step 12 of the RED
            workflow looks for, not just opening this page.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!reviewFacilityId ? (
            <div className="text-sm text-muted-foreground">
              Pick a facility in the Scope filter above to write a review note
              for it.
            </div>
          ) : !canWriteReview ? (
            <div className="text-sm text-rose-600">
              You can only write a review note for your own facility.
            </div>
          ) : (
            <>
              {previousReview && (
                <div
                  className="rounded-md border border-muted bg-muted/40 p-3 space-y-2"
                  data-testid="panel-previous-quarter-review"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      Previous quarter — Q{previousReview.quarter} {previousReview.year}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Saved by {previousReview.updatedByName ?? previousReview.createdByName ?? "—"}
                      {" · "}
                      {formatRelative(previousReview.updatedAt)}
                    </div>
                  </div>
                  {Array.isArray(previousReview.topDrivers) && previousReview.topDrivers.length > 0 ? (
                    <div>
                      <div className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                        Top drivers
                      </div>
                      <ul className="list-disc list-inside text-sm space-y-0.5">
                        {previousReview.topDrivers.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {previousReview.correctiveActions ? (
                    <div>
                      <div className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                        Corrective actions
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {previousReview.correctiveActions}
                      </div>
                    </div>
                  ) : null}
                  {previousReview.nextSurveyDate ? (
                    <div className="text-sm">
                      <span className="text-xs uppercase text-muted-foreground tracking-wide mr-2">
                        Next survey
                      </span>
                      {new Date(previousReview.nextSurveyDate).toLocaleDateString()}
                    </div>
                  ) : null}
                  <div className="text-xs text-muted-foreground italic">
                    Read-only. Use this to carry forward or check off actions in this quarter's plan below.
                  </div>
                </div>
              )}

              {/* Original code:
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="driver1">Top dropout driver #1</Label>
                  <Input
                    id="driver1"
                    value={driver1}
                    onChange={(e) => setDriver1(e.target.value)}
                    placeholder="e.g. caregiver travel"
                    maxLength={255}
                    data-testid="input-review-driver-1"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="driver2">Top dropout driver #2</Label>
                  <Input
                    id="driver2"
                    value={driver2}
                    onChange={(e) => setDriver2(e.target.value)}
                    placeholder="e.g. stockouts in May"
                    maxLength={255}
                    data-testid="input-review-driver-2"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="driver3">Top dropout driver #3</Label>
                  <Input
                    id="driver3"
                    value={driver3}
                    onChange={(e) => setDriver3(e.target.value)}
                    placeholder="e.g. session day clashes with market"
                    maxLength={255}
                    data-testid="input-review-driver-3"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="corrective">Planned corrective actions</Label>
                <Textarea
                  id="corrective"
                  rows={4}
                  value={correctiveActions}
                  onChange={(e) => setCorrectiveActions(e.target.value)}
                  placeholder="What will the team change next quarter? Outreach to specific villages, defaulter tracing days, mobilizer follow-ups, restock plan…"
                  maxLength={4000}
                  data-testid="input-review-corrective"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="nextSurvey">Date of the next coverage survey</Label>
                  <Input
                    id="nextSurvey"
                    type="date"
                    value={nextSurveyDate}
                    onChange={(e) => setNextSurveyDate(e.target.value)}
                    data-testid="input-review-next-survey"
                  />
                </div>
                <div className="flex items-end justify-end">
                  <Button
                    onClick={() => saveReview.mutate()}
                    disabled={!formValid || saveReview.isPending}
                    data-testid="button-save-review"
                  >
                    {saveReview.isPending
                      ? "Saving…"
                      : existingReview
                        ? "Update review"
                        : "Save review"}
                  </Button>
                </div>
              </div>
              */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="driver1">Top dropout driver #1</Label>
                  <Input
                    id="driver1"
                    value={driver1}
                    onChange={(e) => setDriver1(e.target.value)}
                    placeholder="e.g. caregiver travel"
                    maxLength={255}
                    disabled={totalOverdue === 0 || !canWriteReview}
                    data-testid="input-review-driver-1"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="driver2">Top dropout driver #2</Label>
                  <Input
                    id="driver2"
                    value={driver2}
                    onChange={(e) => setDriver2(e.target.value)}
                    placeholder="e.g. stockouts in May"
                    maxLength={255}
                    disabled={totalOverdue === 0 || !canWriteReview}
                    data-testid="input-review-driver-2"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="driver3">Top dropout driver #3</Label>
                  <Input
                    id="driver3"
                    value={driver3}
                    onChange={(e) => setDriver3(e.target.value)}
                    placeholder="e.g. session day clashes with market"
                    maxLength={255}
                    disabled={totalOverdue === 0 || !canWriteReview}
                    data-testid="input-review-driver-3"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="corrective">Planned corrective actions</Label>
                <Textarea
                  id="corrective"
                  rows={4}
                  value={correctiveActions}
                  onChange={(e) => setCorrectiveActions(e.target.value)}
                  placeholder="What will the team change next quarter? Outreach to specific villages, defaulter tracing days, mobilizer follow-ups, restock plan…"
                  maxLength={4000}
                  disabled={totalOverdue === 0 || !canWriteReview}
                  data-testid="input-review-corrective"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="nextSurvey">Date of the next coverage survey</Label>
                  <Input
                    id="nextSurvey"
                    type="date"
                    value={nextSurveyDate}
                    onChange={(e) => setNextSurveyDate(e.target.value)}
                    disabled={totalOverdue === 0 || !canWriteReview}
                    data-testid="input-review-next-survey"
                  />
                </div>
                <div className="flex items-end justify-end">
                  <Button
                    onClick={() => saveReview.mutate()}
                    disabled={!formValid || saveReview.isPending}
                    data-testid="button-save-review"
                  >
                    {saveReview.isPending
                      ? "Saving…"
                      : existingReview
                        ? "Update review"
                        : "Save review"}
                  </Button>
                </div>
              </div>

              {existingReview && (
                <div className="text-xs text-muted-foreground">
                  Last saved{" "}
                  {new Date(existingReview.updatedAt).toLocaleString()}
                  {existingReview.updatedByName
                    ? ` by ${existingReview.updatedByName}`
                    : ""}
                  .
                </div>
              )}

              {pastReviews.length > 0 && (
                <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
                  <CollapsibleTrigger
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                    data-testid="toggle-past-reviews"
                  >
                    {pastOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <History className="h-4 w-4" />
                    Past reviews ({pastReviews.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent
                    className="pt-3 space-y-3"
                    data-testid="list-past-reviews"
                  >
                    {pastReviews.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-md border border-muted p-3 space-y-2"
                        data-testid={`past-review-${r.year}-q${r.quarter}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">
                            Q{r.quarter} {r.year}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Saved by {r.updatedByName ?? r.createdByName ?? "—"}
                            {" · "}
                            {new Date(r.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                        {Array.isArray(r.topDrivers) && r.topDrivers.length > 0 ? (
                          <div>
                            <div className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                              Top drivers
                            </div>
                            <ul className="list-disc list-inside text-sm space-y-0.5">
                              {r.topDrivers.map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {r.correctiveActions ? (
                          <div>
                            <div className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                              Corrective actions
                            </div>
                            <div className="text-sm whitespace-pre-wrap">
                              {r.correctiveActions}
                            </div>
                          </div>
                        ) : null}
                        {r.nextSurveyDate ? (
                          <div className="text-sm">
                            <span className="text-xs uppercase text-muted-foreground tracking-wide mr-2">
                              Next survey
                            </span>
                            {new Date(r.nextSurveyDate).toLocaleDateString()}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Defaulters</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {reachable.length.toLocaleString()} of {totalOverdue.toLocaleString()} have a
              caregiver phone on file.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setRecallModalOpen(true)}
              data-testid="button-open-caregiver-recall"
              className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
            >
              <Radio className="h-4 w-4" />
              Automated Caregiver Recall
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => sendBulk.mutate(reachable)}
              disabled={
                sendBulk.isPending || reachable.length === 0 || isLoading
              }
              data-testid="button-remind-all-defaulters"
              className="gap-1.5"
            >
              {sendBulk.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Remind all ({reachable.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading defaulter list…
            </div>
          ) : (
            <DataTable
              data={defaulters}
              searchKeys={["name", "parentName", "facilityName", "villageName"] as any}
              searchPlaceholder="Search by name, parent, facility, village…"
              exportFileName="defaulters"
              emptyMessage="No overdue children in the selected scope."
              columns={[
                { key: "name", header: "Child name" },
                {
                  key: "dateOfBirth",
                  header: "DOB",
                  render: (r) => new Date(r.dateOfBirth).toLocaleDateString(),
                },
                { key: "parentName", header: "Parent / caregiver", render: (r) => r.parentName ?? "—" },
                { key: "villageName", header: "Home village", render: (r) => r.villageName ?? "—" },
                { key: "facilityName", header: "Facility" },
                { key: "districtName", header: "District" },
                {
                  key: "lastDoseAntigen",
                  header: "Last dose",
                  render: (r) =>
                    r.lastDoseAntigen
                      ? `${r.lastDoseAntigen.replace(/_/g, " ")} · ${new Date(r.lastDoseDate!).toLocaleDateString()}`
                      : "None",
                },
                {
                  key: "nextDoseAntigen",
                  header: "Next due",
                  render: (r) => r.nextDoseAntigen.replace(/_/g, " "),
                },
                {
                  key: "daysOverdue",
                  header: "Days overdue",
                  render: (r) => (
                    <Badge
                      variant="outline"
                      className={
                        r.daysOverdue >= 56
                          ? "border-rose-500 text-rose-600"
                          : r.daysOverdue >= 42
                            ? "border-amber-500 text-amber-600"
                            : "border-muted-foreground"
                      }
                    >
                      {r.daysOverdue}
                    </Badge>
                  ),
                },
                {
                  key: "contactPhone",
                  header: "Reminder",
                  render: (r) => {
                    const last = lastReminded[r.clientId];
                    const isSending = sendingId === r.clientId && sendOne.isPending;
                    return (
                      <div className="flex flex-col items-start gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1"
                          disabled={!r.contactPhone || isSending}
                          onClick={() => sendOne.mutate(r)}
                          data-testid={`button-remind-defaulter-${r.clientId}`}
                          title={
                            r.contactPhone
                              ? `Send SMS to ${r.contactPhone}`
                              : "No caregiver phone on file"
                          }
                        >
                          {isSending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5" />
                          )}
                          Remind
                        </Button>
                        {last && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-normal"
                            data-testid={`badge-last-reminded-${r.clientId}`}
                          >
                            Last reminded {formatRelative(last)}
                          </Badge>
                        )}
                      </div>
                    );
                  },
                },
                {
                  key: "id",
                  header: "Client",
                  render: (r) => (
                    <Link href={`/clients?selectClient=${encodeURIComponent(r.clientId)}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1"
                        data-testid={`button-view-defaulter-${r.clientId}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </Link>
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <CaregiverRecallModal
        open={recallModalOpen}
        onClose={() => setRecallModalOpen(false)}
        facilityId={facilityId}
      />
    </div>
  );
}

function CaregiverRecallModal({
  open,
  onClose,
  facilityId,
}: {
  open: boolean;
  onClose: () => void;
  facilityId: number | null;
}) {
  const { toast } = useToast();
  const [antigen, setAntigen] = useState("PENTA-3");
  const [language, setLanguage] = useState<"en" | "fr" | "sw" | "pt">("en");
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<any>(null);

  const recallMutation = useMutation({
    mutationFn: async () => {
      const res: any = await apiRequest("POST", "/api/messaging/schedule-defaulter-recall", {
        facilityId: facilityId || undefined,
        antigen,
        dryRun,
      });
      return res;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: dryRun ? "Recall simulation complete" : "Recall SMS dispatched",
        description: `Processed ${data.defaultersIdentified} caregiver(s).`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Recall dispatch failed",
        description: err.message || "An error occurred during caregiver recall.",
        variant: "destructive",
      });
    },
  });

  const languageTemplates: Record<string, string> = {
    en: `VaxPlan recall: Your child is due for their ${antigen} vaccination dose. Please visit the health facility this week to keep your child protected.`,
    fr: `Rappel VaxPlan : Votre enfant doit recevoir sa dose de vaccin ${antigen}. Veuillez vous présenter au centre de santé cette semaine pour protéger votre enfant.`,
    sw: `Ukumbusho wa VaxPlan: Mtoto wako anatakiwa kupata chanjo ya ${antigen}. Tafadhali fika kituoni cha afya wiki hii ili kumlinda mtoto wako.`,
    pt: `Lembrete VaxPlan: A sua criança deve receber a dose de vacina ${antigen}. Por favor dirija-se ao centro de saúde esta semana para proteger a sua criança.`,
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Operational Capability</Badge>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <PhoneCall className="h-5 w-5 text-sky-600" />
              Automated Caregiver SMS Alerts & Defaulter Recall
            </DialogTitle>
          </div>
          <DialogDescription>
            Dispatch targeted cellular SMS messages to registered caregivers of drop-out children across health facilities and outreach catchments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Target Antigen</Label>
              <Select value={antigen} onValueChange={setAntigen}>
                <SelectTrigger>
                  <SelectValue placeholder="Select antigen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BCG">BCG (Birth dose)</SelectItem>
                  <SelectItem value="OPV-0">OPV-0 (Oral Polio Birth)</SelectItem>
                  <SelectItem value="PENTA-1">Pentavalent 1 (DTP-HepB-Hib 1)</SelectItem>
                  <SelectItem value="PENTA-2">Pentavalent 2 (DTP-HepB-Hib 2)</SelectItem>
                  <SelectItem value="PENTA-3">Pentavalent 3 (DTP-HepB-Hib 3 / Defaulter Focus)</SelectItem>
                  <SelectItem value="PCV-3">PCV 3 (Pneumococcal 3)</SelectItem>
                  <SelectItem value="ROTA-2">Rotavirus 2</SelectItem>
                  <SelectItem value="MR-1">Measles-Rubella 1 (MCV1 / Dropout)</SelectItem>
                  <SelectItem value="MR-2">Measles-Rubella 2 (MCV2)</SelectItem>
                  <SelectItem value="HPV-1">HPV 1 (Cervical Cancer Prevention)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Broadcast Language</Label>
              <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English (Official)</SelectItem>
                  <SelectItem value="fr">Français (French)</SelectItem>
                  <SelectItem value="sw">Kiswahili (East Africa)</SelectItem>
                  <SelectItem value="pt">Português (Mozambique / Angola)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
              <span>SMS Template Preview ({language.toUpperCase()})</span>
              <span>{languageTemplates[language]?.length || 0} characters (1 SMS segment)</span>
            </div>
            <div className="rounded border bg-background p-3 text-sm font-mono text-foreground leading-relaxed shadow-sm">
              "{languageTemplates[language]}"
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 bg-card shadow-sm">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold flex items-center gap-2">
                <span>Simulation / Dry-Run Mode</span>
                {dryRun && <Badge variant="secondary" className="text-xs">Safe Mode</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                Simulate recipient matching and generate audit logs without consuming SMS airtime balance.
              </p>
            </div>
            <Switch checked={dryRun} onCheckedChange={setDryRun} />
          </div>

          {result && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                <Check className="h-4 w-4 text-emerald-600" />
                Recall Process Executed Successfully ({result.dryRun ? "Dry Run" : "Live Outbound"})
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm pt-1">
                <div className="rounded bg-background/80 p-2.5 border">
                  <div className="text-xs text-muted-foreground">Caregivers Identified</div>
                  <div className="text-xl font-bold text-foreground">{result.defaultersIdentified}</div>
                </div>
                <div className="rounded bg-background/80 p-2.5 border">
                  <div className="text-xs text-muted-foreground">Messages Dispatched</div>
                  <div className="text-xl font-bold text-emerald-600">{result.messagesDispatched}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Sample Message: <span className="font-mono text-foreground">"{result.sampleMessage}"</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button
            onClick={() => recallMutation.mutate()}
            disabled={recallMutation.isPending}
            className={dryRun ? "bg-sky-600 hover:bg-sky-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
          >
            {recallMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            {dryRun ? "Simulate Recall (Dry Run)" : "Send Live Caregiver SMS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

