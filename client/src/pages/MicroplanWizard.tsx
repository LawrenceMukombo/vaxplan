import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Save,
  Send,
  Trash2,
  Plus,
  Loader2,
  Pencil,
  ArrowLeft,
  AlertCircle,
  X,
  ZoomIn,
  ZoomOut,
  Locate,
  Satellite,
  Map as MapIcon,
  Maximize2,
  HelpCircle,
  Sparkles,
  Calendar,
  Printer,
} from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DataTable } from "@/components/DataTable";
import { usePersistedBasemap, BasemapTileLayer, BasemapSwitcher } from "@/components/map/BasemapToggle";
import { canApproveSessionPlan } from "@/lib/permissions";
import { FacilityCascadePicker } from "@/components/FacilityCascadePicker";
import { SubmissionConfirmation } from "@/components/SubmissionConfirmation";
import { intersect as turfIntersect, polygon as turfPolygon, multiPolygon as turfMultiPolygon } from "@turf/turf";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCachedPopulation, setCachedPopulation } from "@/lib/populationCache";
import {
  estimateCatchmentPopulation,
  type CatchmentEstimateResult,
  type CatchmentCell,
} from "@/lib/worldpopCatchment";
import type {
  Microplan,
  Facility,
  Village,
  SessionPlan,
  SessionDayPlan,
  BudgetItem,
  VaccineRequirement,
  MobilizationActivity,
  SupervisionVisit,
  PopulationData,
  HtrScore,
} from "@shared/schema";
import {
  getMinScheduleDate,
  toDateInputValue,
  isAtLeastDaysAhead,
} from "@shared/schedulingDates";

// --- Step metadata --------------------------------------------------------
export type StepDef = {
  id: number;
  title: string;
  whatToDo: string[];
};

export const STEPS: StepDef[] = [
  {
    id: 1,
    title: "Coverage & denominators",
    whatToDo: [
      "Enter DTP1, DTP3, MCV1, MCV2 coverage % from last full year.",
      "Confirm the denominator scenario that will drive all downstream planning fields.",
      "Dropout from DTP1->DTP3 and DTP1->MCV1 is calculated for you.",
      "List stockout events, AEFI cases, and sessions planned vs held.",
    ],
  },
  {
    id: 2,
    title: "Catchment & communities",
    whatToDo: [
      "List every community served: village, hamlet, IDP camp, school.",
      "Record target population and the delivery strategy (fixed / outreach / mobile).",
      "Mark the source of the population number (NSO, HMIS, WorldPop, survey, census).",
    ],
  },
  {
    id: 3,
    title: "Risk scoring",
    whatToDo: [
      "Score each community 1-5 on distance, terrain, season, and insecurity.",
      "Tick 'missed (no contact in 12 months)' for any community you have not visited.",
      "Tick 'zero-dose hotspot' where you know unimmunised children live.",
    ],
  },
  {
    id: 4,
    title: "Session calendar",
    whatToDo: [
      "Plan one session per community per month for the next 12 months.",
      "Pick the date and session type (static / outreach / mobile).",
      "Add a catch-up row for any community marked missed in Step 3.",
    ],
  },
  {
    id: 5,
    title: "Staffing per session day",
    whatToDo: [
      "For every session day, name the vaccinator, recorder, and supervisor.",
      "Set the daily target and per-diem per role.",
      "For SIA campaigns, choose team type: house-to-house or fixed.",
    ],
  },
  {
    id: 6,
    title: "Vaccine forecasting",
    whatToDo: [
      "Default wastage: BCG 40%, MR/OPV 25%, Penta/PCV 11%, IPV/Rota 5%.",
      "Doses = target x doses per child x (1 + wastage). Vials, syringes, safety boxes follow.",
      "Add cold-chain sizing: cold boxes, ice packs, carriers per session.",
    ],
  },
  {
    id: 7,
    title: "Demand generation",
    whatToDo: [
      "Pick announcement channels per session day (megaphone, religious leader, SMS).",
      "Name a focal point with a phone number for every community.",
      "Confirm HFC and CHV readiness as supporting community-mobilization evidence.",
    ],
  },
  {
    id: 8,
    title: "Logistics & transport",
    whatToDo: [
      "Set transport mode per session day: foot, motorbike, 4WD, boat.",
      "Record distance km and estimated fuel litres.",
      "Tick the security clearance box if it applies.",
    ],
  },
  {
    id: 9,
    title: "Budget",
    whatToDo: [
      "Add one line per cost: Personnel, Transport, Supplies, Per Diem, Cold Chain, Training, Communication.",
      "Pick the funding source: Govt, Gavi, WHO, UNICEF, Other.",
      "Total is calculated from quantity x unit cost.",
    ],
  },
  {
    id: 10,
    title: "Supervision plan",
    whatToDo: [
      "At least one supportive supervision visit per quarter.",
      "Name the supervisor and the checklist they will use.",
      "Capture follow-up actions you expect to take.",
    ],
  },
  {
    id: 11,
    title: "Submit for approval",
    whatToDo: [
      "Review the summary below.",
      "Only the facility-in-charge can submit.",
      "Submitting sends the plan to district -> provincial -> national approvers.",
    ],
  },
  {
    id: 12,
    title: "Execution & review",
    whatToDo: [
      "After approval, this view shows live doses given, defaulters, and missed communities.",
      "Use quarterly review evidence to feed the next Step 1 coverage and denominator review.",
    ],
  },
];

export const ANTIGENS: Array<{ name: string; doses: number; wastage: number }> = [
  { name: "BCG", doses: 1, wastage: 40 },
  { name: "OPV", doses: 4, wastage: 25 },
  { name: "Penta", doses: 3, wastage: 11 },
  { name: "PCV", doses: 3, wastage: 11 },
  { name: "IPV", doses: 1, wastage: 5 },
  { name: "MR", doses: 2, wastage: 25 },
  { name: "Rota", doses: 2, wastage: 5 },
];

export const BUDGET_CATEGORIES = [
  "Personnel",
  "Transport",
  "Supplies",
  "Per Diem",
  "Cold Chain",
  "Training",
  "Communication",
];

export const FUNDING_SOURCES = [
  { value: "government", label: "Government" },
  { value: "gavi", label: "Gavi" },
  { value: "who", label: "WHO" },
  { value: "unicef", label: "UNICEF" },
  { value: "other", label: "Other" },
];

// --- Helpers --------------------------------------------------------------
export function currentQuarter() {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

export function WhatToDo({ bullets }: { bullets: string[] }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
      <p className="mb-1 font-medium text-foreground">What to do</p>
      <ul className="list-disc space-y-0.5 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

// Task #101 / #130 - context the wizard needs to send the user back to a
// village session once the microplan exists. Persisted to sessionStorage so
// it survives hard reloads and clean-URL navigations (e.g. `/microplan/new?id=`).
type ReturnVillage = {
  villageId: number;
  name: string;
  lat: number | null;
  lng: number | null;
  isHardToReach: boolean;
};

const RETURN_VILLAGE_STORAGE_PREFIX = "microplan:returnVillage:";
const returnVillageStorageKey = (id: number | null) =>
  `${RETURN_VILLAGE_STORAGE_PREFIX}${id ?? "new"}`;

function readStoredReturnVillage(id: number | null): ReturnVillage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(returnVillageStorageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.villageId !== "number") return null;
    return {
      villageId: parsed.villageId,
      name: typeof parsed.name === "string" ? parsed.name : "",
      lat: typeof parsed.lat === "number" ? parsed.lat : null,
      lng: typeof parsed.lng === "number" ? parsed.lng : null,
      isHardToReach: !!parsed.isHardToReach,
    };
  } catch {
    return null;
  }
}

function writeStoredReturnVillage(id: number | null, v: ReturnVillage) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(returnVillageStorageKey(id), JSON.stringify(v));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function clearStoredReturnVillage(id: number | null) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(returnVillageStorageKey(id));
  } catch {
    /* ignore */
  }
}

// Audit metadata for a village that was removed from a facility's catchment in
// Step 2 of the wizard. Surfaced in the "Previously removed" panel so staff can
// see who removed each community, when, and (optionally) why before deciding
// whether to add it back.
export type ExcludedVillageDetail = {
  villageId: number;
  removedAt: string | null;
  removedByUserId: string | null;
  removedByName: string | null;
  reason: string | null;
};

// --- Page -----------------------------------------------------------------
// Props:
//   prePlanType: when the route already declares the intent (e.g.
//   /microplans/routine vs /microplans/campaigns) the plan-type chooser is
//   locked to that value and a badge is shown in the header. /flow leaves
//   it undefined -> the chooser defaults to "routine" but stays editable.
type MicroplanWizardProps = {
  prePlanType?: "routine" | "campaign";
};

export default function MicroplanWizard({ prePlanType }: MicroplanWizardProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [active, setActive] = useState(1);
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [microplanId, setMicroplanId] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // --- Plan type (routine vs SIA campaign) ------------------------------
  // The wizard is the same template for both flows; only the planType and
  // a handful of SIA-only fields differ. When the route pre-selects a type
  // (Routine Microplan / SIA Campaigns sidebar entries) we lock the chooser.
  const [planType, setPlanType] = useState<"routine" | "campaign">(prePlanType ?? "routine");
  const planTypeLocked = !!prePlanType;
  useEffect(() => {
    if (prePlanType) setPlanType(prePlanType);
  }, [prePlanType]);

  // SIA-only metadata. Stored on the microplan record so per-session data
  // (forecasting, supervision plan, etc.) inherits the campaign context.
  // Defaults match the polio SIA pattern most ministries run; they're free
  // text so unusual campaigns (measles follow-up, HPV catch-up, etc.) work
  // without code changes.
  const [campaignAntigen, setCampaignAntigen] = useState("Polio");
  const [campaignTargetAge, setCampaignTargetAge] = useState("0-59 months");
  const [campaignScope, setCampaignScope] = useState<"National" | "Sub-national" | "Targeted">("National");
  // IDs selected when scope is Sub-national or Targeted.
  const [campaignScopeDetails, setCampaignScopeDetails] = useState<{
    provinceIds: number[];
    districtIds: number[];
    facilityIds: number[];
  }>({ provinceIds: [], districtIds: [], facilityIds: [] });


  // Task #101 - when the user lands here from a village pin that had no
  // routine microplan, the map passes the facility to prefill plus the
  // village context so we can hand them back to the New Session dialog
  // once a microplan exists.
  const initialQueryParams = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search);
  }, []);
  const queryFacilityId = (() => {
    const raw = initialQueryParams?.get("facilityId");
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  })();
  // Task #130 - initialize from URL when present, otherwise restore from
  // sessionStorage so a hard reload or in-app revisit keeps the banner alive.
  const [returnVillage, setReturnVillage] = useState<ReturnVillage | null>(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const idRaw = sp.get("returnVillageId");
    if (idRaw) {
      const id = Number(idRaw);
      if (Number.isFinite(id)) {
        const lat = Number(sp.get("returnVillageLat"));
        const lng = Number(sp.get("returnVillageLng"));
        return {
          villageId: id,
          name: sp.get("returnVillageName") ?? "",
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          isHardToReach: sp.get("returnVillageHtr") === "1",
        };
      }
    }
    const idParam = sp.get("id");
    const wizardId =
      idParam && !Number.isNaN(Number(idParam)) ? Number(idParam) : null;
    return readStoredReturnVillage(wizardId) ?? readStoredReturnVillage(null);
  });

  const [facilityId, setFacilityId] = useState<number | null>(
    queryFacilityId ?? user?.facilityId ?? null,
  );
  const [name, setName] = useState("");
  // Year & quarter default to "today" for new microplans but must become
  // editable once we resume an existing draft so the Step 1 inputs reflect
  // the saved values instead of silently overwriting them.
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(currentQuarter());

  // Resume an existing draft via either the path param (/microplans/routine/:id,
  // /microplans/campaigns/:id) or the legacy `?id=` query string. The path-param
  // form is what SessionsHub / the map popups link to - without honouring it the
  // wizard silently stayed in "new microplan" mode and hid the saved plan
  // (along with its planned sessions) from the user.
  const [, routineParams] = useRoute("/microplans/routine/:id");
  const [, campaignParams] = useRoute("/microplans/campaigns/:id");
  const routeIdRaw = routineParams?.id ?? campaignParams?.id ?? null;
  useEffect(() => {
    if (routeIdRaw && !Number.isNaN(Number(routeIdRaw))) {
      setMicroplanId(Number(routeIdRaw));
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id && !Number.isNaN(Number(id))) {
      setMicroplanId(Number(id));
      return;
    }
    setMicroplanId(null);
    setActive(1);
  }, [routeIdRaw]);

  // Sync facility from user when it arrives - but never override an explicit
  // ?facilityId= prefill coming from the village pin (Task #101).
  useEffect(() => {
    if (queryFacilityId) return;
    if (user?.facilityId && !facilityId) setFacilityId(user.facilityId);
  }, [user, facilityId, queryFacilityId]);

  // Task #130 - keep sessionStorage in sync with the live context so a reload
  // restores the banner. Once we have a real microplanId we migrate the entry
  // off the "new" bucket onto the id-keyed bucket.
  useEffect(() => {
    if (!returnVillage) return;
    if (microplanId) {
      writeStoredReturnVillage(microplanId, returnVillage);
      clearStoredReturnVillage(null);
    } else {
      writeStoredReturnVillage(null, returnVillage);
    }
  }, [returnVillage, microplanId]);

  const clearReturnVillage = () => {
    clearStoredReturnVillage(microplanId);
    clearStoredReturnVillage(null);
    setReturnVillage(null);
  };

  const continueToVillageSession = () => {
    if (!returnVillage || !microplanId) return;
    const qs = new URLSearchParams({
      unservedVillageId: String(returnVillage.villageId),
      unservedName: returnVillage.name,
      unservedHtr: returnVillage.isHardToReach ? "1" : "0",
      prefillKind: "village",
      autoOpen: "1",
    });
    if (returnVillage.lat != null) qs.set("unservedLat", String(returnVillage.lat));
    if (returnVillage.lng != null) qs.set("unservedLng", String(returnVillage.lng));
    clearReturnVillage();
    setLocation(`/sessions/microplan/${microplanId}?${qs.toString()}`);
  };

  // --- Data fetches -------------------------------------------------------
  const { data: facilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });
  const { data: villages } = useQuery<Village[]>({
    queryKey: ["/api/villages"],
  });
  // Consolidated hydration: one request returns the microplan plus every
  // per-microplan / per-facility row the wizard's resume effects need. This
  // replaces 8 separate round trips (sessions, day plans, supervision visits,
  // population, htr scores, vaccine reqs, mobilization, budget) - see
  // GET /api/microplans/:id/hydration.
  type MicroplanHydration = {
    microplan: Microplan;
    sessions: SessionPlan[];
    sessionDayPlans: SessionDayPlan[];
    supervisionVisits: SupervisionVisit[];
    population: PopulationData[];
    vaccineRequirements: VaccineRequirement[];
    mobilization: MobilizationActivity[];
    budgetItems: BudgetItem[];
    htrScores: HtrScore[];
    excludedVillageIds?: number[];
    excludedVillages?: ExcludedVillageDetail[];
  };
  const { data: hydration } = useQuery<MicroplanHydration>({
    queryKey: ["/api/microplans", microplanId, "hydration"],
    queryFn: async () => {
      const res = await fetch(`/api/microplans/${microplanId}/hydration`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load microplan");
      return res.json();
    },
    enabled: !!microplanId,
  });
  const microplan = hydration?.microplan;

  const { data: staffRoster } = useQuery<any[]>({
    queryKey: ["/api/facilities", facilityId, "staff"],
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}/staff`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load staff roster");
      return res.json();
    },
    enabled: !!facilityId,
  });

  const { data: facilityChvs = [] } = useQuery<any[]>({
    queryKey: ["/api/facilities", facilityId, "chvs", planType],
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}/chvs?planType=${planType}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!facilityId,
    staleTime: 60_000,
  });

  const { data: dbPopulation } = useQuery<any[]>({
    queryKey: ["/api/population", facilityId, year],
    enabled: !microplanId && !!facilityId && !!year,
    queryFn: async () => {
      const r = await fetch(`/api/population?facilityId=${facilityId}&year=${year}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    }
  });

  // Note: dbPopulation useEffect moved below communities state declaration to resolve TS2448/TS2454

  useEffect(() => {
    if (microplan) {
      if (microplan.facilityId) setFacilityId(microplan.facilityId);
      if (microplan.name) setName(microplan.name);
      // Mirror the saved year/quarter/planType into Step 1 so reopening an
      // existing microplan shows it exactly as the author left it instead of
      // silently snapping back to "today's" period or the default plan type.
      if (typeof microplan.year === "number") setYear(microplan.year);
      if (typeof microplan.quarter === "number") setQuarter(microplan.quarter);
      if (microplan.planType) {
        // DB enum values are `facility_routine` / `sia_campaign`; the wizard
        // works in the shorter `routine` / `campaign` vocabulary.
        const mapped =
          (microplan.planType as string) === "sia_campaign" || (microplan.planType as string) === "campaign"
            ? "campaign"
            : "routine";
        setPlanType(mapped);
      }
      // Rehydrate campaign-specific fields for SIA campaigns.
      if ((microplan as any).campaignAntigen) setCampaignAntigen((microplan as any).campaignAntigen);
      if ((microplan as any).campaignTargetAge) setCampaignTargetAge((microplan as any).campaignTargetAge);
      if ((microplan as any).campaignScope) {
        setCampaignScope((microplan as any).campaignScope as "National" | "Sub-national" | "Targeted");
      }
      if ((microplan as any).campaignScopeDetails) {
        const sd = (microplan as any).campaignScopeDetails;
        setCampaignScopeDetails({
          provinceIds: Array.isArray(sd.provinceIds) ? sd.provinceIds : [],
          districtIds: Array.isArray(sd.districtIds) ? sd.districtIds : [],
          facilityIds: Array.isArray(sd.facilityIds) ? sd.facilityIds : [],
        });
      }
    }
  }, [microplan]);


  const facility = useMemo(
    () => facilities?.find((f) => f.id === facilityId) ?? null,
    [facilities, facilityId],
  );

  // Track villages the user explicitly removed from this facility's catchment
  // in Step 2. Persisted server-side per facility (see
  // /api/facilities/:id/excluded-villages and task #167) so the choice
  // follows the user across devices, browsers, and cache clears.
  //
  // Legacy localStorage key (kept only to migrate users transitioning off the
  // browser-only persistence). Once the server has any value for the facility
  // we treat the server as the source of truth and drop the local copy.
  const legacyExcludedKey = facilityId
    ? `microplan-excluded-villages:${facilityId}`
    : null;
  const loadLegacyExcluded = (key: string | null): number[] => {
    if (!key || typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((n: any) => typeof n === "number")
        : [];
    } catch {
      return [];
    }
  };

  // Fetch the server-side list whenever a facility is selected. We also pull
  // it out of the microplan hydration response (cheaper, no extra round trip)
  // when a microplan is loaded; both paths converge on the same query cache.
  const excludedQueryKey = facilityId
    ? ["/api/facilities", facilityId, "excluded-villages"] as const
    : null;
  const { data: excludedFromServer, isSuccess: excludedLoaded } = useQuery<{
    facilityId: number;
    villageIds: number[];
    villages?: ExcludedVillageDetail[];
  }>({
    queryKey: excludedQueryKey ?? ["/api/facilities", "none", "excluded-villages"],
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}/excluded-villages`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load excluded villages");
      return res.json();
    },
    enabled: !!facilityId,
  });

  const [excludedVillageIds, setExcludedVillageIds] = useState<Set<number>>(
    () => new Set<number>(),
  );
  const [excludedDetails, setExcludedDetails] = useState<Map<number, ExcludedVillageDetail>>(
    () => new Map(),
  );
  const [excludedReady, setExcludedReady] = useState<boolean>(false);
  const loadedExcludedFacilityRef = useRef<number | null>(null);

  // Reset the readiness flag whenever the facility changes so the catchment
  // seed effect waits for the server response before populating from
  // facilityVillages - otherwise a previously-removed village could slip
  // back in during the moment between switch and server response.
  useEffect(() => {
    if (loadedExcludedFacilityRef.current !== facilityId) {
      setExcludedReady(false);
      setExcludedVillageIds(new Set<number>());
      setExcludedDetails(new Map());
      loadedExcludedFacilityRef.current = facilityId;
    }
  }, [facilityId]);

  // Hydrate excludedVillageIds from whichever source resolves first:
  //   1. the per-microplan hydration payload (preferred - already in flight)
  //   2. the dedicated /excluded-villages query for the facility
  //   3. legacy localStorage values (one-shot migration to the server)
  useEffect(() => {
    if (!facilityId) return;
    const fromHydrationIds = hydration?.excludedVillageIds;
    const fromHydrationDetails = hydration?.excludedVillages;
    const fromQueryIds = excludedFromServer?.villageIds;
    const fromQueryDetails = excludedFromServer?.villages;
    let serverIds: number[] | null = null;
    let serverDetails: ExcludedVillageDetail[] | null = null;
    if (Array.isArray(fromHydrationIds)) {
      serverIds = fromHydrationIds;
      serverDetails = Array.isArray(fromHydrationDetails) ? fromHydrationDetails : null;
    } else if (Array.isArray(fromQueryIds)) {
      serverIds = fromQueryIds;
      serverDetails = Array.isArray(fromQueryDetails) ? fromQueryDetails : null;
    }
    if (serverIds === null) return;

    const next = new Set<number>(serverIds);
    const detailMap = new Map<number, ExcludedVillageDetail>();
    if (serverDetails) {
      for (const d of serverDetails) {
        if (typeof d?.villageId === "number") detailMap.set(d.villageId, d);
      }
    }
    // Migrate any legacy localStorage entries the user accumulated before
    // server persistence existed. We push them to the server once and then
    // clear the key so subsequent loads use the server copy directly.
    const legacy = loadLegacyExcluded(legacyExcludedKey);
    const missing = legacy.filter((id) => !next.has(id));
    if (missing.length > 0) {
      missing.forEach((id) => next.add(id));
      void apiRequest("PUT", `/api/facilities/${facilityId}/excluded-villages`, {
        villageIds: Array.from(next),
      }).then(() => {
        try {
          if (legacyExcludedKey) localStorage.removeItem(legacyExcludedKey);
        } catch {
          // ignore
        }
        queryClient.invalidateQueries({ queryKey: ["/api/facilities", facilityId, "excluded-villages"] });
      }).catch((e) => console.warn("Failed to migrate excluded villages:", e));
    } else if (legacyExcludedKey) {
      try {
        localStorage.removeItem(legacyExcludedKey);
      } catch {
        // ignore
      }
    }
    setExcludedVillageIds(next);
    setExcludedDetails(detailMap);
    setExcludedReady(true);
  }, [facilityId, hydration?.excludedVillageIds, hydration?.excludedVillages, excludedFromServer, excludedLoaded, legacyExcludedKey]);

  // Persist the desired exclusion set with optional per-village reason. The
  // server preserves the original removedAt/removedByUserId on entries that
  // were already excluded, so a no-op resave from a different user doesn't
  // overwrite the audit trail.
  const persistExcluded = (
    next: Set<number>,
    reasonByVillage?: Map<number, string | null>,
  ) => {
    if (!facilityId) return;
    const villageIdList: number[] = [];
    next.forEach((id) => villageIdList.push(id));
    const payloadVillages = villageIdList.map((villageId) => ({
      villageId,
      reason: reasonByVillage?.get(villageId) ?? null,
    }));
    void apiRequest("PUT", `/api/facilities/${facilityId}/excluded-villages`, {
      villages: payloadVillages,
    })
      .then((data: any) => {
        if (data && Array.isArray(data.villages)) {
          const map = new Map<number, ExcludedVillageDetail>();
          for (const d of data.villages as ExcludedVillageDetail[]) {
            if (typeof d?.villageId === "number") map.set(d.villageId, d);
          }
          setExcludedDetails(map);
        }
        queryClient.invalidateQueries({
          queryKey: ["/api/facilities", facilityId, "excluded-villages"],
        });
      })
      .catch((e) => {
        console.warn("Failed to persist excluded villages:", e);
      });
  };

  const facilityVillages = useMemo(() => {
    if (!villages || !facility) return [] as Village[];
    return villages.filter(
      (v) =>
        v.assignedFacilityId === facility.id &&
        !excludedVillageIds.has(v.id)
    );

  }, [villages, facility, excludedVillageIds]);

  // Villages the user previously removed from this facility's catchment.
  // Surfaced in Step 2 so a misclick is reversible without re-typing names.
  const excludedFacilityVillages = useMemo(() => {
    if (!villages || !facility) return [] as Village[];
    return villages.filter(
      (v) =>
        excludedVillageIds.has(v.id) &&
        (v.assignedFacilityId === facility.id ||
          v.districtId === facility.districtId),
    );
  }, [villages, facility, excludedVillageIds]);

  // --- Microplan ensure (idempotent via in-flight ref) -------------------
  const ensureInFlight = useRef<Promise<number> | null>(null);
  const ensureMicroplan = async (): Promise<number> => {
    if (microplanId) return microplanId;
    if (ensureInFlight.current) return ensureInFlight.current;
    if (!facilityId) throw new Error("Pick a facility first.");
    const p = (async () => {
      const isCampaign = planType === "campaign";
      const created = await apiRequest<Microplan>("POST", "/api/microplans", {
        facilityId,
        name:
          name.trim() ||
          `${isCampaign ? "SIA" : "Routine"} microplan Q${quarter} ${year}`,
        planType: isCampaign ? "sia_campaign" : "facility_routine",
        year,
        quarter,
        status: "draft",
        ...(isCampaign
          ? {
              campaignAntigen,
              campaignTargetAge,
              campaignScope,
              campaignScopeDetails: campaignScope !== "National" ? campaignScopeDetails : null,
            }
          : {}),
      });
      setMicroplanId(created.id);
      queryClient.invalidateQueries({ queryKey: ["/api/microplans"] });
      return created.id;
    })();
    ensureInFlight.current = p;
    try {
      return await p;
    } finally {
      ensureInFlight.current = null;
    }
  };

  const patchMicroplan = async (id: number, patch: Record<string, unknown>) => {
    await apiRequest("PATCH", `/api/microplans/${id}`, patch);
    queryClient.invalidateQueries({ queryKey: ["/api/microplans", id] });
  };

  const [sessionIdMap, setSessionIdMap] = useState<Record<string, number>>({});
  const [dayPlanIdMap, setDayPlanIdMap] = useState<Record<string, number>>({});

  // --- Rehydration data (resume case) -------------------------------------
  // Derived from the single /api/microplans/:id/hydration call above so each
  // step's resume effect doesn't trigger its own request.
  const existingSessions = hydration?.sessions;
  const existingPopulation = hydration?.population;
  const existingHtr = hydration?.htrScores;
  const existingVaccineReqs = hydration?.vaccineRequirements;
  const existingMobilization = hydration?.mobilization;
  const existingBudget = hydration?.budgetItems;
  const existingSupervision = hydration?.supervisionVisits;
  const existingDayPlans = hydration?.sessionDayPlans;

  // --- Save draft --------------------------------------------------------
  const saveDraft = async () => {
    // Persist the current step through the shared save path so a manual save
    // also benefits from validation-error focus. persistStep handles its own
    // error toasts and field focus; we only add the success confirmation.
    // Capture the dispatched snapshot up front so concurrent edits aren't
    // wrongly marked clean.
    const snap = snapshotForStep(active);
    setSaveStatus("saving");
    const ok = await persistStep(active);
    if (ok) {
      savedSnapshots.current[active] = snap;
      setLastSavedAt(Date.now());
      setSaveStatus("saved");
      toast({
        title: "Draft saved",
        description: "You can leave and come back without losing progress.",
      });
    } else {
      setSaveStatus("idle");
    }
  };

  // --- Step state --------------------------------------------------------
  type CoverageRow = {
    dtp1: string;
    dtp3: string;
    mcv1: string;
    mcv2: string;
    stockouts: string;
    aefi: string;
    sessionsPlanned: string;
    sessionsHeld: string;
    // Raw numbers for auto-calculation
    dtp1Doses: string;     // Actual DTP1 doses given
    dtp3Doses: string;     // Actual DTP3 doses given
    mcv1Doses: string;     // Actual MCV1 doses given
    mcv2Doses: string;     // Actual MCV2 doses given
    targetInfants: string; // Denominator: surviving infants / target population
    denominatorScenarioId: string;
    denominatorSource: "nso" | "hmis" | "worldpop" | "survey" | "community_census";
    denominatorMethod: "authoritative_total" | "spatial_allocation" | "direct_community";
    denominatorYear: string;
    denominatorConfidence: "high" | "medium" | "low";
    denominatorStatus: "draft" | "ready" | "needs_review";
    denominatorVersion: string;
    denominatorOverrideReason: string;
    // SIA-specific raw counts
    vaccinated: string;    // Total vaccinated (SIA)
    targetSIA: string;     // SIA target population
    siaVaccineCoverage: string; // SIA coverage %
  };
  const [coverage, setCoverage] = useState<CoverageRow>({
    dtp1: "",
    dtp3: "",
    mcv1: "",
    mcv2: "",
    stockouts: "0",
    aefi: "0",
    sessionsPlanned: "0",
    sessionsHeld: "0",
    dtp1Doses: "",
    dtp3Doses: "",
    mcv1Doses: "",
    mcv2Doses: "",
    targetInfants: "",
    denominatorScenarioId: "",
    denominatorSource: "nso",
    denominatorMethod: "authoritative_total",
    denominatorYear: String(year),
    denominatorConfidence: "medium",
    denominatorStatus: "draft",
    denominatorVersion: "v1",
    denominatorOverrideReason: "",
    vaccinated: "",
    targetSIA: "",
    siaVaccineCoverage: "",
  });

  useEffect(() => {
    const stash = (microplan as any)?.staffing;
    if (stash && typeof stash === "object" && !Array.isArray(stash)) {
      if (stash.coverageReview) {
        setCoverage((prev) => ({ ...prev, ...stash.coverageReview }));
      }
      if (stash.coldChain) {
        setColdChain((prev) => ({ ...prev, ...stash.coldChain }));
      }
    }
  }, [microplan]);

  type CommunityRow = {
    id?: number;
    villageId?: number;
    name: string;
    type: "village" | "hamlet" | "idp" | "school";
    targetPopulation: string;
    source: "nso" | "hmis" | "worldpop" | "survey" | "community_census";
    strategy: "static" | "outreach" | "mobile";
    saved?: boolean;
    rowId: string;
    latitude?: string;
    longitude?: string;
    latLngDirty?: boolean;
    focalPersonName?: string;
    focalPersonPhone?: string;
    focalChvId?: number | string | null;
    focalPersonSource?: string;
    communicationContactMade?: boolean;
    outsideFollowUpCheck?: boolean;
    // Cross-border coordination (Sheet 1.1 / 1.2)
    isCrossBorder?: boolean;
    borderCountry?: string;
    isCrossingPoint?: boolean;
    crossingType?: string;
    dailyMovementVolume?: string | number;
    // Sheet 1.1 - Border village inter-country coordination
    borderVillageCountry?: string;
    borderVillageFacilityName?: string;
    // Sheet 1.0 - Settlement classification + risk flags
    settlementType?: string;
    highRisk?: boolean;
    highRiskReason?: string;
    // Sheet 1.0 - Direct population capture
    totalCatchmentPopulation?: string | number;
    under5Population?: string | number;
    distanceToFacility?: string | number | null;
    distanceKm?: string | number | null;
    travelTimeMinutes?: string | number | null;
    // Population columns - dual source
    gridPop?: string;          // WorldPop / gridded raster estimate (auto-fetched)
    surveyPop?: string;        // NSO / HMIS / Survey / Census (manual entry)
  };
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const lastCommunityBalanceSignature = useRef<string | null>(null);

  function planningNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }

  function communityPopulationWeight(row: CommunityRow): number {
    const currentTarget = planningNumber(row.targetPopulation);
    if (currentTarget > 0) return currentTarget;
    const authoritativeTotal = planningNumber(row.surveyPop ?? row.totalCatchmentPopulation);
    const worldPopTotal = planningNumber(row.gridPop);
    return authoritativeTotal || worldPopTotal || 1;
  }

  function balanceCommunityTargets(rows: CommunityRow[], targetInfants: number): CommunityRow[] {
    const denominator = planningNumber(targetInfants);
    if (!rows.length || denominator <= 0) return rows;
    const weights = rows.map(communityPopulationWeight);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight <= 0) return rows;

    const rawShares = weights.map((weight) => (weight / totalWeight) * denominator);
    const targets = rawShares.map(Math.floor);
    let remainder = denominator - targets.reduce((sum, value) => sum + value, 0);
    const order = rawShares
      .map((share, index) => ({
        index,
        remainder: share - targets[index],
        weight: weights[index],
      }))
      .sort((a, b) => b.remainder - a.remainder || b.weight - a.weight);

    for (let i = 0; i < order.length && remainder > 0; i += 1, remainder -= 1) {
      targets[order[i].index] += 1;
    }

    return rows.map((row, index) => {
      const nextTarget = String(targets[index]);
      return String(row.targetPopulation ?? "") === nextTarget ? row : { ...row, targetPopulation: nextTarget };
    });
  }

  useEffect(() => {
    const denominator = planningNumber(coverage.targetInfants);
    if (!communities.length || denominator <= 0) return;
    const signature = JSON.stringify({
      source: coverage.denominatorSource,
      scenario: coverage.denominatorScenarioId,
      denominator,
      rows: communities.map((row) => [
        row.rowId,
        row.villageId ?? null,
        row.source,
        row.gridPop ?? null,
        row.surveyPop ?? null,
        row.totalCatchmentPopulation ?? null,
      ]),
    });
    if (lastCommunityBalanceSignature.current === signature) return;
    lastCommunityBalanceSignature.current = signature;

    setCommunities((prev) => {
      const sourceAligned = prev.map((row) => ({
        ...row,
        source: coverage.denominatorSource || row.source,
      }));
      const balanced = balanceCommunityTargets(sourceAligned, denominator);
      const changed = balanced.some(
        (row, index) =>
          row.targetPopulation !== prev[index]?.targetPopulation ||
          row.source !== prev[index]?.source,
      );
      return changed ? balanced : prev;
    });
  }, [
    coverage.denominatorSource,
    coverage.denominatorScenarioId,
    coverage.targetInfants,
    communities.length,
    communities
      .map((row) =>
        [
          row.rowId,
          row.villageId ?? "",
          row.source,
          row.gridPop ?? "",
          row.surveyPop ?? "",
          row.totalCatchmentPopulation ?? "",
        ].join(":"),
      )
      .join("|"),
  ]);

  // Fill missing total/under-5 values from already captured target infants or
  // community population sources so Step 2 does not ask users to retype data.
  useEffect(() => {
    if (!communities.length) return;
    setCommunities((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        const target = planningNumber(row.targetPopulation);
        const sourceTotal = planningNumber(row.surveyPop ?? row.totalCatchmentPopulation ?? row.gridPop);
        const estimatedTotal = sourceTotal || (target > 0 ? Math.round(target / 0.04) : 0);
        const estimatedUnder5 = estimatedTotal > 0 ? Math.round(estimatedTotal * 0.17) : (target > 0 ? target * 5 : 0);
        const patch: Partial<CommunityRow> = {};
        if ((!row.totalCatchmentPopulation || Number(row.totalCatchmentPopulation) <= 0) && estimatedTotal > 0) {
          patch.totalCatchmentPopulation = String(estimatedTotal);
          if (!row.surveyPop && sourceTotal) patch.surveyPop = String(sourceTotal);
        }
        if ((!row.under5Population || Number(row.under5Population) <= 0) && estimatedUnder5 > 0) {
          patch.under5Population = String(estimatedUnder5);
        }
        if (Object.keys(patch).length === 0) return row;
        changed = true;
        return { ...row, ...patch };
      });
      return changed ? next : prev;
    });
  }, [communities.map((row) => [row.rowId, row.targetPopulation, row.surveyPop ?? "", row.gridPop ?? "", row.totalCatchmentPopulation ?? "", row.under5Population ?? ""].join(":")).join("|")]);
  useEffect(() => {
    const total = communities.reduce((sum, row) => sum + (parseInt(row.targetPopulation || "0", 10) || 0), 0);
    if (total <= 0) return;
    const nextInfants = String(total);
    setCoverage((prev) => {
      if (prev.denominatorScenarioId || planningNumber(prev.targetInfants) > 0) return prev;
      return prev.targetInfants === nextInfants ? prev : { ...prev, targetInfants: nextInfants };
    });
  }, [communities]);

  useEffect(() => {
    if (microplanId || !dbPopulation || !dbPopulation.length || !communities.length) return;
    const allZero = communities.every(c => c.targetPopulation === "0" || !c.targetPopulation);
    if (!allZero) return;

    setCommunities(prev =>
      prev.map(c => {
        const hit = dbPopulation.find(p => p.villageId === c.villageId);
        if (!hit) return c;
        return {
          ...c,
          targetPopulation: String(hit.totalPopulation ?? c.targetPopulation),
          under5Population: hit.under5Population != null ? String(hit.under5Population) : c.under5Population,
          totalCatchmentPopulation: hit.totalPopulation != null ? String(hit.totalPopulation) : c.totalCatchmentPopulation,
        };
      })
    );
  }, [microplanId, dbPopulation, communities.length]);
  // Initial seed from facility villages (only when there are no saved
  // communities to hydrate). Population merge happens in a later effect.
  useEffect(() => {
    // Wait until exclusions for the current facility have been loaded from
    // localStorage; otherwise a previously removed village can slip back into
    // the seed before `excludedVillageIds` rehydrates.
    if (!excludedReady) return;
    if (!facilityVillages.length || communities.length) return;
    setCommunities(
      facilityVillages.map((v) => ({
        villageId: v.id,
        name: v.name,
        type: "village",
        targetPopulation: "0",
        source: "nso",
        strategy: v.isHardToReach ? "outreach" : "static",
        saved: false,
        rowId: `v${v.id}`,
        latitude: v.latitude != null ? String(v.latitude) : undefined,
        longitude: v.longitude != null ? String(v.longitude) : undefined,
        focalPersonName: (v as any).focalPersonName ?? undefined,
        focalPersonPhone: (v as any).focalPersonPhone ?? undefined,
        communicationContactMade: !!(v as any).focalPersonCommChecked,
        outsideFollowUpCheck: !!(v as any).outsideFollowUpMade,
        isCrossBorder: !!(v as any).isCrossBorder,
        borderCountry: (v as any).borderCountry ?? undefined,
        isCrossingPoint: !!(v as any).isCrossingPoint,
        crossingType: (v as any).crossingType ?? undefined,
        dailyMovementVolume: (v as any).dailyMovementVolume ?? undefined,
        // Sheet 1.1 border village coordination
        borderVillageCountry: (v as any).borderVillageCountry ?? undefined,
        borderVillageFacilityName: (v as any).borderVillageFacilityName ?? undefined,
        // Sheet 1.0 settlement classification
        settlementType: (v as any).settlementType ?? "village",
        highRisk: !!(v as any).highRisk,
        highRiskReason: (v as any).highRiskReason ?? undefined,
        // Sheet 1.0 population and access metadata
        totalCatchmentPopulation: (v as any).totalCatchmentPopulation ?? (v as any).population ?? undefined,
        under5Population: (v as any).under5Population ?? ((v as any).population != null ? Math.round(Number((v as any).population) * 0.17) : undefined),
        distanceToFacility: (v as any).distanceToFacility ?? undefined,
        travelTimeMinutes: (v as any).travelTimeMinutes ?? undefined,
        gridPop: (v as any).griddedPopulation != null ? String((v as any).griddedPopulation) : undefined,
        surveyPop: (v as any).totalCatchmentPopulation != null ? String((v as any).totalCatchmentPopulation) : ((v as any).population != null ? String((v as any).population) : undefined),
      })),
    );
  }, [facilityVillages, communities.length, excludedReady]);

  // Rehydrate Step 2 from saved population rows for this facility & year so
  // re-saves PATCH instead of inserting duplicates.
  const hydratedRef = useRef({
    communities: false,
    risk: false,
    calendar: false,
    dayPlans: false,
    vaccines: false,
    mobilization: false,
    budget: false,
    supervision: false,
  });
  useEffect(() => {
    if (!microplanId || !existingPopulation || hydratedRef.current.communities) return;
    if (!communities.length) return;
    setCommunities((prev) =>
      prev.map((c) => {
        const hit = existingPopulation.find(
          (p) => p.villageId && p.villageId === c.villageId,
        );
        if (!hit) return c;
        const meta = (hit.metadata as any) ?? {};
        return {
          ...c,
          id: hit.id,
          targetPopulation: String(hit.totalPopulation ?? c.targetPopulation),
          source: (hit.source as any) ?? c.source,
          type: (meta.type as any) ?? c.type,
          strategy: (meta.strategy as any) ?? c.strategy,
          saved: true,
        };
      }),
    );
    hydratedRef.current.communities = true;
  }, [microplanId, existingPopulation, communities.length]);

  type RiskRow = {
    id?: number;
    villageId?: number;
    name: string;
    distance: number;
    terrain: number;
    season: number;
    insecurity: number;
    missed: boolean;
    zeroDose: boolean;
  };
  const [risk, setRisk] = useState<RiskRow[]>([]);
  useEffect(() => {
    if (!communities.length) return;
    setRisk((prev) => {
      if (prev.length === communities.length) return prev;
      return communities.map((c) => ({
        villageId: c.villageId,
        name: c.name,
        distance: 3,
        terrain: 3,
        season: 3,
        insecurity: 1,
        missed: false,
        zeroDose: false,
      }));
    });
  }, [communities]);

  // Rehydrate Step 3 from saved HTR scores.
  useEffect(() => {
    if (!microplanId || !existingHtr || hydratedRef.current.risk) return;
    if (!risk.length) return;
    setRisk((prev) =>
      prev.map((r) => {
        const hit = existingHtr.find((h) => h.villageId === r.villageId);
        if (!hit) return r;
        const cm = (hit.comments ?? "").toString();
        return {
          ...r,
          id: hit.id,
          distance: hit.distanceScore ?? r.distance,
          terrain: hit.terrainScore ?? r.terrain,
          season: hit.seasonalScore ?? r.season,
          insecurity: (hit as any).insecurityScore ?? r.insecurity,
          missed: cm.includes("missed_12mo"),
          zeroDose: cm.includes("zero_dose_hotspot"),
        };
      }),
    );
    hydratedRef.current.risk = true;
  }, [microplanId, existingHtr, risk.length]);

  type CalendarRow = {
    rowId: string;
    name: string;
    villageId?: number;
    sessionType: "static" | "outreach" | "mobile";
    scheduledDate: string;
    catchUp?: boolean;
  };
  const [calendar, setCalendar] = useState<CalendarRow[]>([]);

  // Rehydrate Step 4 from saved sessions, building the calendar back from
  // the persisted rows so Step 11's summary reflects what's on the server.
  useEffect(() => {
    if (!existingSessions || !microplanId || hydratedRef.current.calendar) return;
    const mine = existingSessions.filter((s) => s.microplanId === microplanId);
    if (!mine.length) return;
    const rows: CalendarRow[] = [];
    const idMap: Record<string, number> = {};
    mine
      .slice()
      .sort((a, b) => {
        const ad = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
        const bd = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
        return ad - bd;
      })
      .forEach((s, idx) => {
        const date = s.scheduledDate
          ? new Date(s.scheduledDate).toISOString().slice(0, 10)
          : "";
        // Session name format from this wizard: `${community} ${YYYY-MM-DD}`.
        // Strip a trailing date if present, otherwise fall back to full name.
        const trimmed = (s.name ?? "").replace(/\s+\d{4}-\d{2}-\d{2}$/, "").trim();
        const rowId = `srv-${s.id}`;
        rows.push({
          rowId,
          name: trimmed || s.name || `Session ${idx + 1}`,
          sessionType: (s.sessionType as any) ?? "static",
          scheduledDate: date,
        });
        idMap[rowId] = s.id;
      });
    setCalendar(rows);
    setSessionIdMap((prev) => ({ ...prev, ...idMap }));
    hydratedRef.current.calendar = true;
  }, [existingSessions, microplanId]);

  function generateCalendar(
    months: number = 12,
    startYear?: number,
    startMonth?: number,
  ) {
    if (!communities.length) return;
    // Only the four supported periods are allowed; anything else falls back to
    // a full 12-month calendar so a stale value can never produce odd lengths.
    const safeMonths = [1, 3, 6, 12].includes(months) ? months : 12;
    const today = new Date();
    // Default to the current month so existing behaviour is unchanged when the
    // planner doesn't pick a start month.
    const baseYear =
      typeof startYear === "number" ? startYear : today.getFullYear();
    const baseMonth =
      typeof startMonth === "number" ? startMonth : today.getMonth();
    // The earliest date a session is allowed to be scheduled (UTC midnight),
    // i.e. today + the lead-time minimum. Any generated session before this
    // would later fail the >=7-day lead-time check, so we skip those rows.
    const minDate = getMinScheduleDate();
    const minDateValue = toDateInputValue(minDate);
    const rows: CalendarRow[] = [];
    let skippedCount = 0;
    communities.forEach((c, idx) => {
      for (let m = 0; m < safeMonths; m++) {
        const d = new Date(baseYear, baseMonth + m, 15);
        const dateValue = d.toISOString().slice(0, 10);
        // Skip any session that falls before the lead-time minimum so the
        // generated calendar only ever contains schedulable sessions.
        if (!isAtLeastDaysAhead(dateValue)) {
          skippedCount++;
          continue;
        }
        rows.push({
          rowId: `${c.rowId}-m${m}`,
          name: c.name,
          villageId: c.villageId,
          sessionType: c.strategy,
          scheduledDate: dateValue,
        });
      }
    });
    setCalendar(rows);
    if (skippedCount > 0) {
      toast({
        title: rows.length
          ? `Skipped ${skippedCount} past ${
              skippedCount === 1 ? "session" : "sessions"
            }`
          : "No schedulable sessions",
        description: rows.length
          ? `${skippedCount} ${
              skippedCount === 1 ? "session was" : "sessions were"
            } before the earliest schedulable date (${minDateValue}) and were left out. ${
              rows.length
            } schedulable ${
              rows.length === 1 ? "session" : "sessions"
            } generated.`
          : `Every session in this range falls before the earliest schedulable date (${minDateValue}). Pick a later start month to generate sessions.`,
        variant: rows.length ? "default" : "destructive",
      });
    }
  }

  const calendarSignature = calendar
    .map((c) => [c.rowId, c.villageId ?? "", c.name, c.scheduledDate, c.sessionType].join("~"))
    .join("|");
  const communitySignature = communities
    .map((c) => [c.rowId, c.villageId ?? "", c.name, c.targetPopulation, c.strategy, c.focalPersonName ?? "", c.focalPersonPhone ?? "", c.distanceToFacility ?? ""].join("~"))
    .join("|");

  function getCalendarCommunity(row: CalendarRow): CommunityRow | undefined {
    return communities.find(
      (c) =>
        (row.villageId != null && c.villageId === row.villageId) ||
        c.rowId === row.rowId ||
        c.name.trim().toLowerCase() === row.name.trim().toLowerCase(),
    );
  }

  function getSessionLabel(row: CalendarRow): string {
    return `${row.name} - ${row.scheduledDate || "date not set"}`;
  }

  function getSessionTarget(row: CalendarRow): string {
    const community = getCalendarCommunity(row);
    const target = planningNumber(community?.targetPopulation);
    return String(target);
  }

  function getSessionDistance(row: CalendarRow): string {
    const community = getCalendarCommunity(row);
    const distance = community?.distanceToFacility;
    const parsed = distance == null || distance === "" ? NaN : Number(distance);
    return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "0";
  }

  function defaultStaffName(roleHints: string[]): string {
    const roster = staffRoster ?? [];
    const hit = roster.find((s: any) => {
      const haystack = `${s.role ?? ""} ${s.position ?? ""} ${s.title ?? ""}`.toLowerCase();
      return roleHints.some((hint) => haystack.includes(hint));
    }) ?? roster[0];
    return hit?.name ?? hit?.fullName ?? "";
  }

  function findCommunityChv(community: CommunityRow | undefined): any | undefined {
    if (!community) return undefined;
    return facilityChvs.find((c: any) => {
      if (community.villageId != null && Number(c.villageId) === Number(community.villageId)) return true;
      const unit = String(c.communityUnit ?? "").trim().toLowerCase();
      return !!community.name && unit === community.name.trim().toLowerCase();
    });
  }

  function getDefaultFocal(row: CalendarRow): { focalPoint: string; focalPhone: string } {
    const community = getCalendarCommunity(row);
    const communityName = community?.focalPersonName?.trim() || "";
    const communityPhone = community?.focalPersonPhone?.trim() || "";
    if (communityName || communityPhone) {
      return { focalPoint: communityName, focalPhone: communityPhone };
    }
    const chv = findCommunityChv(community);
    if (chv) {
      return {
        focalPoint: String(chv.name ?? chv.fullName ?? ""),
        focalPhone: String(chv.contactPhone ?? chv.phone ?? ""),
      };
    }
    const staff = (staffRoster ?? []).find((s: any) => {
      const role = String(s.role ?? s.position ?? "").toLowerCase();
      return role.includes("in_charge") || role.includes("in-charge") || role.includes("supervisor");
    });
    return {
      focalPoint: String(staff?.name ?? staff?.fullName ?? ""),
      focalPhone: String(staff?.contactPhone ?? staff?.phone ?? ""),
    };
  }

  useEffect(() => {
    if (!communities.length || !facilityChvs.length) return;
    setCommunities((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (row.focalPersonName?.trim() || row.focalPersonPhone?.trim()) return row;
        const chv = findCommunityChv(row);
        if (!chv) return row;
        changed = true;
        return {
          ...row,
          focalChvId: chv.id,
          focalPersonName: chv.name ?? chv.fullName ?? "",
          focalPersonPhone: chv.contactPhone ?? chv.phone ?? "",
          focalPersonSource: "CHV registry",
        };
      });
      return changed ? next : prev;
    });
  }, [communitySignature, facilityChvs]);
  function rowsChanged<T>(a: T[], b: T[]): boolean {
    return JSON.stringify(a) !== JSON.stringify(b);
  }
  type StaffRow = {
    rowId: string;
    sessionLabel: string;
    vaccinator: string;
    recorder: string;
    supervisor: string;
    teamType: string;
    target: string;
    perDiem: string;
    // Sheet 3 - Vitamin A & scissors
    vitaminABlueCaps?: string;
    vitaminARedCaps?: string;
    scissorsCount?: string;
  };
  const [staffing, setStaffing] = useState<StaffRow[]>([]);
  useEffect(() => {
    setStaffing((prev) => {
      if (!calendar.length) return prev.length ? [] : prev;
      const prevById = new Map(prev.map((row) => [row.rowId, row]));
      const next = calendar.map((c) => {
        const existing = prevById.get(c.rowId);
        const defaultTarget = getSessionTarget(c);
        return {
          rowId: c.rowId,
          sessionLabel: getSessionLabel(c),
          vaccinator: existing?.vaccinator ?? defaultStaffName(["vaccinator", "nurse"]),
          recorder: existing?.recorder ?? defaultStaffName(["recorder", "data", "clerk"]),
          supervisor: existing?.supervisor ?? defaultStaffName(["supervisor", "in-charge", "in_charge"]),
          teamType: existing?.teamType ?? (c.sessionType === "static" ? "fixed" : "house_to_house"),
          target: existing?.target && existing.target !== "0" ? existing.target : defaultTarget,
          perDiem: existing?.perDiem ?? "0",
          vitaminABlueCaps: existing?.vitaminABlueCaps ?? "0",
          vitaminARedCaps: existing?.vitaminARedCaps ?? "0",
          scissorsCount: existing?.scissorsCount ?? "0",
        };
      });
      return rowsChanged(prev, next) ? next : prev;
    });
  }, [calendarSignature, communitySignature, staffRoster]);

  type VaccineRow = {
    id?: number;
    name: string;
    target: string;
    doses: number;
    wastage: string;
  };
  const [vaccines, setVaccines] = useState<VaccineRow[]>(
    ANTIGENS.map((a) => ({
      name: a.name,
      target: "0",
      doses: a.doses,
      wastage: String(a.wastage),
    })),
  );
  const [coldChain, setColdChain] = useState({
    coldBoxes: "1",
    icePacks: "4",
    carriers: "1",
  });

  // Rehydrate Step 6 from saved vaccine requirements.
  useEffect(() => {
    if (!microplanId || !existingVaccineReqs || hydratedRef.current.vaccines) return;
    const mine = existingVaccineReqs.filter(
      (v) => v.quarter === quarter && v.year === year,
    );
    if (!mine.length) return;
    setVaccines((prev) =>
      prev.map((v) => {
        const hit = mine.find((r) => r.vaccineName === v.name);
        if (!hit) return v;
        return {
          ...v,
          id: hit.id,
          target: String(hit.targetPopulation ?? 0),
          // Guard: if wastageRate is null/undefined, keep the antigen default.
          // String(null) = "null" which makes parseFloat("null") = NaN later.
          wastage: hit.wastageRate != null ? String(hit.wastageRate) : v.wastage,
        };
      }),
    );
    hydratedRef.current.vaccines = true;
  }, [microplanId, existingVaccineReqs, quarter, year]);

  type MobRow = {
    id?: number;
    rowId: string;
    sessionLabel: string;
    channels: string[];
    focalPoint: string;
    focalPhone: string;
    iec: string[];
  };
  const [mobilization, setMobilization] = useState<MobRow[]>([]);
  useEffect(() => {
    setMobilization((prev) => {
      if (!calendar.length) return prev.length ? [] : prev;
      const prevById = new Map(prev.map((row) => [row.rowId, row]));
      const next = calendar.map((c) => {
        const existing = prevById.get(c.rowId);
        const focal = getDefaultFocal(c);
        return {
          rowId: c.rowId,
          sessionLabel: getSessionLabel(c),
          channels: existing?.channels?.length ? existing.channels : ["megaphone"],
          focalPoint: existing?.focalPoint?.trim() ? existing.focalPoint : focal.focalPoint,
          focalPhone: existing?.focalPhone?.trim() ? existing.focalPhone : focal.focalPhone,
          iec: existing?.iec ?? [],
          ...(existing?.id ? { id: existing.id } : {}),
        };
      });
      return rowsChanged(prev, next) ? next : prev;
    });
  }, [calendarSignature, communitySignature, facilityChvs, staffRoster]);

  // Rehydrate Step 7 by matching saved mobilization activities back to their
  // session row via the description prefix that this wizard writes.
  useEffect(() => {
    if (!microplanId || !existingMobilization || hydratedRef.current.mobilization)
      return;
    if (!mobilization.length) return;
    setMobilization((prev) =>
      prev.map((m) => {
        const hit = existingMobilization.find((a) =>
          (a.description ?? "").startsWith(m.sessionLabel),
        );
        if (!hit) return m;
        const desc = hit.description ?? "";
        const focalMatch = desc.match(/focal:\s*([^;]*?)\s*([\d+\-\s]*)?;/);
        const iecMatch = desc.match(/IEC:\s*(.*)$/);
        const channels = (hit.activityType ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const iec = iecMatch
          ? iecMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        let focalPoint = m.focalPoint;
        let focalPhone = m.focalPhone;
        if (focalMatch) {
          const inner = focalMatch[0].replace(/^focal:\s*/, "").replace(/;$/, "");
          const parts = inner.trim().split(/\s+/);
          const last = parts[parts.length - 1] ?? "";
          if (/^[\d+\-]+$/.test(last) && parts.length > 1) {
            focalPhone = last;
            focalPoint = parts.slice(0, -1).join(" ");
          } else {
            focalPoint = inner.trim();
          }
        }
        return {
          ...m,
          id: hit.id,
          channels: channels.length ? channels : m.channels,
          focalPoint,
          focalPhone,
          iec,
        };
      }),
    );
    hydratedRef.current.mobilization = true;
  }, [microplanId, existingMobilization, mobilization.length]);

  type TransportRow = {
    rowId: string;
    sessionLabel: string;
    mode: "walking" | "road" | "car" | "motorbike" | "donkey" | "boat" | "air" | "chopper";
    distanceKm: string;
    fuelLitres: string;
    vehicle: string;
    cleared: boolean;
  };
  const [transport, setTransport] = useState<TransportRow[]>([]);
  useEffect(() => {
    setTransport((prev) => {
      if (!calendar.length) return prev.length ? [] : prev;
      const prevById = new Map(prev.map((row) => [row.rowId, row]));
      const next = calendar.map((c) => {
        const existing = prevById.get(c.rowId);
        return {
          rowId: c.rowId,
          sessionLabel: getSessionLabel(c),
          mode: existing?.mode ?? (c.sessionType === "mobile" ? "motorbike" : c.sessionType === "outreach" ? "road" : "walking"),
          distanceKm: existing?.distanceKm && existing.distanceKm !== "0" ? existing.distanceKm : getSessionDistance(c),
          fuelLitres: existing?.fuelLitres ?? "0",
          vehicle: existing?.vehicle ?? "",
          cleared: existing?.cleared ?? false,
        };
      });
      return rowsChanged(prev, next) ? next : prev;
    });
  }, [calendarSignature, communitySignature]);

  // Rehydrate Step 5 (staffing) + Step 8 (transport) from saved session day
  // plans. Fetched once per session whose id we know, so resaves PATCH the
  // same row instead of inserting another.
  useEffect(() => {
    if (!microplanId || hydratedRef.current.dayPlans) return;
    if (!calendar.length) return;
    if (!existingDayPlans) return;
    const sessionIds = calendar
      .map((c) => sessionIdMap[c.rowId])
      .filter((v): v is number => !!v);
    if (sessionIds.length === 0) return;
    try {
      const sessionIdSet = new Set(sessionIds);
      const bySessionId: Record<number, SessionDayPlan> = {};
      for (const dp of existingDayPlans) {
        if (!sessionIdSet.has(dp.sessionPlanId)) continue;
        // Storage orders by sessionPlanId, dayNumber, so the first row per
        // session is the lowest dayNumber - matching the prior `arr[0]` behavior.
        if (!bySessionId[dp.sessionPlanId]) bySessionId[dp.sessionPlanId] = dp;
      }
      const dayIdMap: Record<string, number> = {};
      setStaffing((prev) =>
        prev.map((s) => {
          const sid = sessionIdMap[s.rowId];
          const dp = sid ? bySessionId[sid] : undefined;
          if (!dp) return s;
          dayIdMap[s.rowId] = dp.id;
          const notes = dp.executionNotes ?? "";
          const grab = (k: string) => {
            const m = notes.match(new RegExp(`${k}:([^;]+)`));
            return m ? m[1].trim() : "";
          };
          return {
            ...s,
            vaccinator: grab("vaccinator") || s.vaccinator,
            recorder: grab("recorder") || s.recorder,
            supervisor: grab("supervisor") || s.supervisor,
            teamType: grab("team") || s.teamType,
            perDiem: grab("perDiem") || s.perDiem,
            target: String(dp.targetPopulation ?? s.target),
          };
        }),
      );
      setTransport((prev) =>
        prev.map((t) => {
          const sid = sessionIdMap[t.rowId];
          const dp = sid ? bySessionId[sid] : undefined;
          if (!dp) return t;
          const notes = dp.executionNotes ?? "";
          const vehicleMatch = notes.match(/vehicle:([^;]+)/);
          return {
            ...t,
            mode: (dp.transportType as any) ?? t.mode,
            distanceKm: String(dp.distanceKm ?? t.distanceKm),
            fuelLitres: String(dp.fuelLiters ?? t.fuelLitres),
            vehicle: vehicleMatch ? vehicleMatch[1].trim() : t.vehicle,
            cleared: /security_cleared/.test(notes),
          };
        }),
      );
      setDayPlanIdMap((prev) => ({ ...prev, ...dayIdMap }));
      hydratedRef.current.dayPlans = true;
      // Re-baseline step 5 snapshot after hydration finishes so any pre-existing
      // staffing assignments are treated as "already saved" and not re-triggered.
      // Without this, the auto-save fires immediately on first render of step 5.
      setTimeout(() => { savedSnapshots.current[5] = snapshotForStep(5); }, 0);
    } catch (e) {
      console.warn("Could not hydrate session day plans:", e);
    }
  }, [microplanId, calendar, sessionIdMap, existingDayPlans]);

  type BudgetRow = {
    id?: number;
    rowId: string;
    category: string;
    description: string;
    quantity: string;
    unitCost: string;
    fundingSource: string;
  };
  const [budget, setBudget] = useState<BudgetRow[]>([
    {
      rowId: "b1",
      category: "Personnel",
      description: "",
      quantity: "1",
      unitCost: "0",
      fundingSource: "government",
    },
  ]);

  // Rehydrate Step 9 from saved budget items.
  useEffect(() => {
    if (!microplanId || !existingBudget || hydratedRef.current.budget) return;
    if (!existingBudget.length) return;
    setBudget(
      existingBudget.map((b) => ({
        id: b.id,
        rowId: `srv-b-${b.id}`,
        category: b.category,
        description: b.description,
        quantity: String(b.quantity ?? "1"),
        unitCost: String(b.unitCost ?? "0"),
        fundingSource: (b.fundingSource as any) ?? "government",
      })),
    );
    hydratedRef.current.budget = true;
  }, [microplanId, existingBudget]);

  type SupRow = {
    id?: number;
    rowId: string;
    quarter: number;
    scheduledDate: string;
    supervisorName: string;
    checklist: string;
    followUp: string;
  };
  const [supervision, setSupervision] = useState<SupRow[]>([
    {
      rowId: "s1",
      quarter,
      scheduledDate: new Date(year, (quarter - 1) * 3 + 1, 15).toISOString().slice(0, 10),
      supervisorName: "",
      checklist: "WHO RED checklist",
      followUp: "",
    },
  ]);

  // Rehydrate Step 10 from saved supervision visits for this microplan.
  useEffect(() => {
    if (!microplanId || !existingSupervision || hydratedRef.current.supervision)
      return;
    if (!existingSupervision.length) return;
    setSupervision(
      existingSupervision.map((v) => {
        const dt = v.scheduledDate ? new Date(v.scheduledDate) : new Date();
        const checklistArr = Array.isArray(v.checklist) ? (v.checklist as any[]) : [];
        const checklistLabel =
          (checklistArr[0] && (checklistArr[0].label as string)) || "WHO RED checklist";
        return {
          id: v.id,
          rowId: `srv-s-${v.id}`,
          quarter: Math.ceil((dt.getUTCMonth() + 1) / 3),
          scheduledDate: dt.toISOString().slice(0, 10),
          supervisorName: v.supervisorName ?? "",
          checklist: checklistLabel,
          followUp: v.followUpActions ?? "",
        };
      }),
    );
    hydratedRef.current.supervision = true;
  }, [microplanId, existingSupervision]);

  // --- Per-step persistence ----------------------------------------------
  const [busy, setBusy] = useState(false);

  // Inline auto-save status shown next to the Save Draft button so planners can
  // tell a background save is underway (especially on slow connections) without
  // relying on transient toasts.
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // --- Validation error focus --------------------------------------------
  // When a save (manual, auto, or on Next) detects a validation problem we
  // record which step + field/row is at fault here, switch the wizard to that
  // step, and let the step component scroll/highlight/focus the offending
  // input. Cleared at the start of every save and when the user edits the
  // flagged field.
  const [errorFocus, setErrorFocus] = useState<{
    step: number;
    rowId?: string;
    field?: string;
    message: string;
  } | null>(null);

  // --- Background auto-save ----------------------------------------------
  // Per-step snapshot of the last-persisted user-editable data, so the
  // debounced auto-save only fires when something actually changed and the
  // first visit to a step doesn't trigger a needless save.
  const savedSnapshots = useRef<Record<number, string>>({});
  const autoSaveInFlight = useRef(false);
  // Set when a debounced save fires while another save is still in flight (or
  // when edits arrive mid-save). Bumping autoSaveTick re-runs the effect with
  // fresh state so the newer edits are persisted deterministically.
  const pendingResave = useRef(false);
  const [autoSaveTick, setAutoSaveTick] = useState(0);
  // Synchronous mirror of `busy` so the debounced auto-save callback always
  // sees the latest in-flight state without depending on a (possibly stale)
  // captured `busy` value. Set in lockstep with setBusy at every save site.
  const busyRef = useRef(false);

  // Serialise only the user-editable data for a step (no server ids / saved
  // flags) so the snapshot is stable across a save round-trip and only real
  // edits mark the step dirty.
  function snapshotForStep(step: number): string {
    switch (step) {
      case 1:
        return JSON.stringify({
          coverage,
          planType,
          campaignAntigen,
          campaignTargetAge,
          campaignScope,
          campaignScopeDetails,
        });
      case 2:
        return JSON.stringify(
          communities.map((c) => ({
            name: c.name,
            type: c.type,
            targetPopulation: c.targetPopulation,
            source: c.source,
            strategy: c.strategy,
            villageId: c.villageId,
            latitude: c.latitude,
            longitude: c.longitude,
          })),
        );
      case 3:
        return JSON.stringify(risk);
      case 4:
        return JSON.stringify(
          calendar.map((c) => ({
            name: c.name,
            villageId: c.villageId,
            sessionType: c.sessionType,
            scheduledDate: c.scheduledDate,
          })),
        );
      case 5:
        return JSON.stringify(staffing);
      case 6:
        return JSON.stringify(vaccines);
      case 7:
        return JSON.stringify(mobilization);
      case 8:
        return JSON.stringify({ staffing, transport });
      case 9:
        return JSON.stringify(budget);
      case 10:
        return JSON.stringify(supervision);
      default:
        return "";
    }
  }

  // Debounced background auto-save. After the planner stops editing the
  // current step for a short interval, persist it through the same path as a
  // manual save. We skip saving when there's no facility yet, when nothing
  // changed since the last save, on the first visit to a step (baseline only),
  // and while another save is in flight.
  useEffect(() => {
    if (!facilityId) return;
    if (active < 1 || active > 10) return; // only steps with a persist path
    const snap = snapshotForStep(active);
    const saved = savedSnapshots.current[active];
    if (saved === undefined) {
      // First time we've seen this step's data - establish a baseline so we
      // don't auto-save unedited (e.g. freshly hydrated) content.
      savedSnapshots.current[active] = snap;
      return;
    }
    if (saved === snap) return; // nothing changed
    const timer = setTimeout(async () => {
      // Another save is still in flight - don't fire a second concurrent save.
      // Use the synchronous busyRef (not the captured `busy`, which can be
      // stale) so a manual/Next save started after this timer was scheduled is
      // always observed. Remember outstanding work so we re-evaluate on settle.
      if (autoSaveInFlight.current || busyRef.current) {
        pendingResave.current = true;
        return;
      }
      autoSaveInFlight.current = true;
      setSaveStatus("saving");
      try {
        const ok = await persistStep(active, { silent: true });
        if (ok) {
          // Mark ONLY the snapshot we actually dispatched as clean - never the
          // current UI state, which may have newer edits made while the save
          // was in flight. Marking those clean would silently drop them.
          savedSnapshots.current[active] = snap;
          setLastSavedAt(Date.now());
          setSaveStatus("saved");
          // Auto-save runs silently in the background - no toast interruption.
        } else {
          setSaveStatus("idle");
        }
      } finally {
        autoSaveInFlight.current = false;
        // If edits arrived during the save (snapshot moved on) or a debounced
        // save fired while we were busy, schedule another pass with fresh state.
        if (pendingResave.current || snapshotForStep(active) !== savedSnapshots.current[active]) {
          pendingResave.current = false;
          setAutoSaveTick((t) => t + 1);
        }
      }
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoSaveTick,
    active,
    facilityId,
    coverage,
    planType,
    campaignAntigen,
    campaignTargetAge,
    campaignScope,
    communities,
    risk,
    calendar,
    staffing,
    vaccines,
    mobilization,
    budget,
    supervision,
    transport,
  ]);

  // --- Per-row deletion helpers ------------------------------------------
  // Each helper removes the row from local state and, when the row has
  // already been saved to the server, deletes the matching backend row so it
  // doesn't reappear when the microplan is reopened. Saved rows (those with a
  // server `id`) require a confirm dialog before any DELETE is sent so a
  // misclick on the trash icon can't silently destroy server data.
  type PendingDelete =
    | { kind: "community"; index: number; label: string }
    | { kind: "mobilization"; index: number; label: string }
    | { kind: "budget"; index: number; label: string }
    | { kind: "supervision"; index: number; label: string };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function performDeleteCommunity(index: number, reason?: string | null) {
    const row = communities[index];
    if (!row) return;
    if (row.id) {
      try {
        /* Original Code commented out for backward-compatibility and strict traceability (Graceful 404 handling):
        await apiRequest("DELETE", `/api/population/${row.id}`);
        queryClient.invalidateQueries({ queryKey: ["/api/population"] });
        */
        await apiRequest("DELETE", `/api/population/${row.id}`);
        queryClient.invalidateQueries({ queryKey: ["/api/population"] });
      } catch (e: any) {
        /* Original Code commented out for backward-compatibility (Surfacing 404 error was blocking UI state filter):
        toast({
          title: "Could not delete community",
          description: e?.message ?? String(e),
          variant: "destructive",
        });
        return;
        */
        if (e?.message?.includes("404")) {
          console.warn("Community already deleted on server (404). Proceeding with local state update.");
        } else {
          toast({
            title: "Could not delete community",
            description: e?.message ?? String(e),
            variant: "destructive",
          });
          return;
        }
      }
    }
    setCommunities(communities.filter((_, i) => i !== index));
    // Remember that the user explicitly removed this facility village so the
    // seed effect doesn't re-add it the next time the microplan is opened.
    if (row.villageId) {
      const trimmed = typeof reason === "string" ? reason.trim().slice(0, 500) : "";
      const reasonValue = trimmed.length > 0 ? trimmed : null;
      setExcludedVillageIds((prev) => {
        if (prev.has(row.villageId!)) return prev;
        const next = new Set<number>(prev);
        next.add(row.villageId!);
        const reasonMap = new Map<number, string | null>();
        reasonMap.set(row.villageId!, reasonValue);
        persistExcluded(next, reasonMap);
        return next;
      });
    }
  }

  async function performDeleteMobilizationRow(index: number) {
    const row = mobilization[index];
    if (!row) return;
    if (row.id) {
      try {
        /* Original Code commented out for backward-compatibility and strict traceability (Graceful 404 handling):
        await apiRequest("DELETE", `/api/mobilization/${row.id}`);
        queryClient.invalidateQueries({ queryKey: ["/api/mobilization"] });
        */
        await apiRequest("DELETE", `/api/mobilization/${row.id}`);
        queryClient.invalidateQueries({ queryKey: ["/api/mobilization"] });
      } catch (e: any) {
        /* Original Code commented out for backward-compatibility (Surfacing 404 error was blocking UI state filter):
        toast({
          title: "Could not delete mobilization row",
          description: e?.message ?? String(e),
          variant: "destructive",
        });
        return;
        */
        if (e?.message?.includes("404")) {
          console.warn("Mobilization row already deleted on server (404). Proceeding with local state update.");
        } else {
          toast({
            title: "Could not delete mobilization row",
            description: e?.message ?? String(e),
            variant: "destructive",
          });
          return;
        }
      }
    }
    setMobilization(mobilization.filter((_, i) => i !== index));
  }

  async function performDeleteBudgetRow(index: number) {
    const row = budget[index];
    if (!row) return;
    if (row.id) {
      try {
        /* Original Code commented out for backward-compatibility and strict traceability (Graceful 404 handling):
        await apiRequest("DELETE", `/api/budget-items/${row.id}`);
        queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
        */
        await apiRequest("DELETE", `/api/budget-items/${row.id}`);
        queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      } catch (e: any) {
        /* Original Code commented out for backward-compatibility (Surfacing 404 error was blocking UI state filter):
        toast({
          title: "Could not delete budget line",
          description: e?.message ?? String(e),
          variant: "destructive",
        });
        return;
        */
        if (e?.message?.includes("404")) {
          console.warn("Budget line already deleted on server (404). Proceeding with local state update.");
        } else {
          toast({
            title: "Could not delete budget line",
            description: e?.message ?? String(e),
            variant: "destructive",
          });
          return;
        }
      }
    }
    setBudget(budget.filter((_, i) => i !== index));
  }

  async function performDeleteSupervisionRow(index: number) {
    const row = supervision[index];
    if (!row) return;
    if (row.id) {
      try {
        /* Original Code commented out for backward-compatibility and strict traceability (Graceful 404 handling):
        await apiRequest("DELETE", `/api/supervision-visits/${row.id}`);
        queryClient.invalidateQueries({ queryKey: ["/api/supervision-visits"] });
        */
        await apiRequest("DELETE", `/api/supervision-visits/${row.id}`);
        queryClient.invalidateQueries({ queryKey: ["/api/supervision-visits"] });
      } catch (e: any) {
        /* Original Code commented out for backward-compatibility (Surfacing 404 error was blocking UI state filter):
        toast({
          title: "Could not delete supervision visit",
          description: e?.message ?? String(e),
          variant: "destructive",
        });
        return;
        */
        if (e?.message?.includes("404")) {
          console.warn("Supervision visit already deleted on server (404). Proceeding with local state update.");
        } else {
          toast({
            title: "Could not delete supervision visit",
            description: e?.message ?? String(e),
            variant: "destructive",
          });
          return;
        }
      }
    }
    setSupervision(supervision.filter((_, i) => i !== index));
  }

  // Reason capture for removing a facility village from the catchment. We
  // show this whenever the community row maps to a real `villageId` so the
  // "Previously removed" panel can later explain *why* the community was
  // taken out. For unsaved rows the dialog is purely informational; for
  // saved rows it doubles as the destructive-action confirmation.
  type PendingCommunityRemoval = {
    index: number;
    label: string;
    hasServerRow: boolean;
  };
  const [pendingCommunityRemoval, setPendingCommunityRemoval] =
    useState<PendingCommunityRemoval | null>(null);
  const [removalReason, setRemovalReason] = useState("");

  function deleteCommunity(index: number) {
    const row = communities[index];
    if (!row) return;
    // A facility-village row: prompt for an optional reason so the audit
    // trail can answer "why was this community taken out of the catchment?".
    if (row.villageId) {
      setRemovalReason("");
      setPendingCommunityRemoval({
        index,
        label: row.name?.trim() || "this community",
        hasServerRow: !!row.id,
      });
      return;
    }
    // Manually-entered communities without a villageId: no audit value in
    // capturing a reason. Keep the existing confirm-only flow for saved
    // rows and the immediate delete for unsaved ones.
    if (row.id) {
      setPendingDelete({
        kind: "community",
        index,
        label: row.name?.trim() || "this community",
      });
      return;
    }
    void performDeleteCommunity(index);
  }

  async function confirmCommunityRemoval() {
    if (!pendingCommunityRemoval) return;
    setDeleteBusy(true);
    try {
      await performDeleteCommunity(pendingCommunityRemoval.index, removalReason);
      setPendingCommunityRemoval(null);
      setRemovalReason("");
    } finally {
      setDeleteBusy(false);
    }
  }

  function deleteMobilizationRow(index: number) {
    const row = mobilization[index];
    if (!row) return;
    if (row.id) {
      setPendingDelete({
        kind: "mobilization",
        index,
        label: row.sessionLabel?.trim() || "this mobilization activity",
      });
      return;
    }
    void performDeleteMobilizationRow(index);
  }

  function deleteBudgetRow(index: number) {
    const row = budget[index];
    if (!row) return;
    if (row.id) {
      setPendingDelete({
        kind: "budget",
        index,
        label: row.description?.trim() || "this budget line",
      });
      return;
    }
    void performDeleteBudgetRow(index);
  }

  function deleteSupervisionRow(index: number) {
    const row = supervision[index];
    if (!row) return;
    if (row.id) {
      setPendingDelete({
        kind: "supervision",
        index,
        label: row.supervisorName?.trim()
          ? `the supervision visit by ${row.supervisorName.trim()}`
          : "this supervision visit",
      });
      return;
    }
    void performDeleteSupervisionRow(index);
  }

  async function confirmPendingDelete() {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    try {
      if (pendingDelete.kind === "community") {
        await performDeleteCommunity(pendingDelete.index);
      } else if (pendingDelete.kind === "mobilization") {
        await performDeleteMobilizationRow(pendingDelete.index);
      } else if (pendingDelete.kind === "budget") {
        await performDeleteBudgetRow(pendingDelete.index);
      } else if (pendingDelete.kind === "supervision") {
        await performDeleteSupervisionRow(pendingDelete.index);
      }
      setPendingDelete(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function persistStep(
    step: number,
    opts: { silent?: boolean } = {},
  ): Promise<boolean> {
    const { silent } = opts;
    busyRef.current = true;
    setBusy(true);
    // A fresh save attempt clears any previously flagged field.
    setErrorFocus(null);
    // Set by the per-step logic below when a validation error should pull the
    // user to a specific field/row instead of just showing a toast.
    let focusTarget:
      | { step: number; rowId?: string; field?: string; message: string }
      | null = null;
    try {
      if (!facilityId) {
        focusTarget = {
          step,
          field: "facility",
          message: "Pick a facility before saving.",
        };
        if (!silent) {
          toast({
            title: "Pick a facility first",
            description: "Choose a facility before the microplan can be saved.",
            variant: "destructive",
          });
        }
        return false;
      }
      const mpId = await ensureMicroplan();

      if (step === 1) {
        const patch: Record<string, unknown> = {
          staffing: { coverageReview: coverage, staffing: (microplan as any)?.staffing?.staffing ?? [] },
        };
        // Always persist campaign metadata for SIA microplans; no-op for routine.
        if (planType === "campaign") {
          patch.campaignAntigen = campaignAntigen;
          patch.campaignTargetAge = campaignTargetAge;
          patch.campaignScope = campaignScope;
          // Only store scope details when Sub-national or Targeted is selected.
          patch.campaignScopeDetails =
            campaignScope !== "National" ? campaignScopeDetails : null;
        }
        await patchMicroplan(mpId, patch);
      } else if (step === 2) {
        const districtId = facility?.districtId;
        const nextRows = [...communities];
        for (let i = 0; i < nextRows.length; i++) {
          const row = nextRows[i];
          let vid = row.villageId;
          const latNum =
            row.latitude && row.latitude.trim() !== "" ? row.latitude.trim() : null;
          const lngNum =
            row.longitude && row.longitude.trim() !== "" ? row.longitude.trim() : null;
          // Persist newly added (manually typed) communities to villages first.
          if (!vid && row.name.trim() && districtId) {
            // If the typed name matches a previously-excluded village for this
            // facility, reuse that village (and lift the exclusion) instead of
            // creating a duplicate. This is the un-exclude path the user gets
            // when they manually re-add a community they had removed earlier.
            const typed = row.name.trim().toLowerCase();
            const revived = (villages ?? []).find(
              (v) =>
                excludedVillageIds.has(v.id) &&
                v.name.trim().toLowerCase() === typed &&
                (v.assignedFacilityId === facilityId ||
                  v.districtId === districtId),
            );
            if (revived) {
              vid = revived.id;
              nextRows[i] = { ...row, villageId: vid, latLngDirty: false };
              setExcludedVillageIds((prev) => {
                if (!prev.has(revived.id)) return prev;
                const next = new Set<number>(prev);
                next.delete(revived.id);
                persistExcluded(next);
                return next;
              });
              if (row.latLngDirty && (latNum || lngNum)) {
                try {
                  await apiRequest("PATCH", `/api/villages/${vid}`, {
                    ...(latNum ? { latitude: latNum } : {}),
                    ...(lngNum ? { longitude: lngNum } : {}),
                  });
                } catch (e) {
                  console.warn("Could not update village coordinates:", e);
                }
              }
            } else {
              try {
                const v = await apiRequest<Village>("POST", "/api/villages", {
                  name: row.name.trim(),
                  districtId,
                  assignedFacilityId: facilityId,
                  ...(latNum ? { latitude: latNum } : {}),
                  ...(lngNum ? { longitude: lngNum } : {}),
                });
                vid = v.id;
                nextRows[i] = { ...row, villageId: vid, latLngDirty: false };
              } catch (e) {
                console.warn("Could not create village:", e);
                continue;
              }
            }
          } else if (vid && row.latLngDirty && (latNum || lngNum)) {
            // User moved/typed coordinates for an existing village - persist them.
            try {
              await apiRequest("PATCH", `/api/villages/${vid}`, {
                ...(latNum ? { latitude: latNum } : {}),
                ...(lngNum ? { longitude: lngNum } : {}),
              });
              nextRows[i] = { ...row, latLngDirty: false };
            } catch (e) {
              console.warn("Could not update village coordinates:", e);
            }
          }
          // Persist focal-person and cross-border fields for any existing village.
          if (vid) {
            try {
              const villagePatch: Record<string, unknown> = {};
              if (row.focalPersonName !== undefined) villagePatch.focalPersonName = row.focalPersonName || null;
              if (row.focalPersonPhone !== undefined) villagePatch.focalPersonPhone = row.focalPersonPhone || null;
              if (row.communicationContactMade !== undefined) villagePatch.focalPersonCommChecked = !!row.communicationContactMade;
              if (row.outsideFollowUpCheck !== undefined) villagePatch.outsideFollowUpMade = !!row.outsideFollowUpCheck;
              if (row.isCrossBorder !== undefined) villagePatch.isCrossBorder = !!row.isCrossBorder;
              if (row.borderCountry !== undefined) villagePatch.borderCountry = row.borderCountry || null;
              if (row.isCrossingPoint !== undefined) villagePatch.isCrossingPoint = !!row.isCrossingPoint;
              if (row.crossingType !== undefined) villagePatch.crossingType = row.crossingType || null;
              if (row.dailyMovementVolume !== undefined) villagePatch.dailyMovementVolume = row.dailyMovementVolume ? parseInt(String(row.dailyMovementVolume), 10) : null;
              // Sheet 1.1 - Border village inter-country coordination
              if (row.borderVillageCountry !== undefined) villagePatch.borderVillageCountry = row.borderVillageCountry || null;
              if (row.borderVillageFacilityName !== undefined) villagePatch.borderVillageFacilityName = row.borderVillageFacilityName || null;
              // Sheet 1.0 - Settlement classification and risk
              if (row.settlementType !== undefined) villagePatch.settlementType = row.settlementType || "village";
              if (row.highRisk !== undefined) villagePatch.highRisk = !!row.highRisk;
              if (row.highRiskReason !== undefined) villagePatch.highRiskReason = row.highRiskReason || null;              // Sheet 1.0 population fields used by the communities/facilities module.
              const officialPopulation = row.surveyPop ?? row.totalCatchmentPopulation;
              if (officialPopulation !== undefined) villagePatch.totalCatchmentPopulation = officialPopulation ? parseInt(String(officialPopulation), 10) : null;
              if (row.gridPop !== undefined) villagePatch.griddedPopulation = row.gridPop ? parseInt(String(row.gridPop), 10) : null;
              if (row.under5Population !== undefined) villagePatch.under5Population = row.under5Population ? parseInt(String(row.under5Population), 10) : null;
              if (Object.keys(villagePatch).length > 0) {
                await apiRequest("PATCH", `/api/villages/${vid}`, villagePatch);
              }
            } catch (e) {
              console.warn("Could not update village focal/cross-border fields:", e);
            }
          }
        }
        // Bulk upsert population rows in a single request. Per-row results let
        // us map server-assigned ids back to local state and surface partial
        // failures without aborting the batch.
        type PopBulkResult = {
          clientId?: string;
          ok: boolean;
          id?: number;
          error?: string;
        };
        const popItems: Array<{ clientId: string; id: number | null; [k: string]: any }> = [];
        const popRowIndex: Record<string, number> = {};
        for (let i = 0; i < nextRows.length; i++) {
          const row = nextRows[i];
          const vid = row.villageId;
          if (!vid) continue;
          const target = parseInt(row.targetPopulation || "0", 10);
          if (target <= 0) continue;
          const clientRowId = `pop-${i}`;
          popRowIndex[clientRowId] = i;
          popItems.push({
            clientId: clientRowId,
            id: row.id ?? null,
            villageId: vid,
            facilityId,
            source: row.source,
            year,
            totalPopulation: target,
            approvalStatus: "draft",
                        metadata: {
              strategy: row.strategy,
              type: row.type,
              focalPersonName: row.focalPersonName || null,
              focalPersonPhone: row.focalPersonPhone || null,
              focalChvId: row.focalChvId ?? null,
              focalPersonSource:
                row.focalPersonSource ||
                (row.focalChvId ? "CHV registry" : row.focalPersonName ? "Community register" : null),
              communicationContactMade: !!row.communicationContactMade,
              outsideFollowUpCheck: !!row.outsideFollowUpCheck,
              totalCatchmentPopulation: row.totalCatchmentPopulation ?? null,
              under5Population: row.under5Population ?? null,
            },
          });
        }
        if (popItems.length > 0) {
          const resp = await apiRequest<{ results: PopBulkResult[] }>(
            "POST",
            "/api/population/bulk",
            { items: popItems },
          );
          const failures: string[] = [];
          let firstFailRow: string | undefined;
          let firstFailMsg: string | undefined;
          for (const r of resp.results ?? []) {
            const idx = typeof r.clientId === "string" ? popRowIndex[r.clientId] : undefined;
            if (r.ok && idx != null) {
              nextRows[idx] = {
                ...nextRows[idx],
                ...(r.id != null ? { id: r.id } : {}),
                saved: true,
              };
            } else if (!r.ok) {
              failures.push(r.error || "unknown error");
              if (firstFailRow === undefined && typeof r.clientId === "string") {
                firstFailRow = r.clientId;
                firstFailMsg = r.error || "This population row could not be saved.";
              }
            }
          }
          if (failures.length > 0) {
            console.warn(`Population bulk save: ${failures.length} row(s) skipped:`, failures);
            focusTarget = {
              step: 2,
              rowId: firstFailRow,
              message:
                firstFailMsg ??
                "Fix the highlighted community - it was rejected on save.",
            };
            if (!silent) {
              toast({
                title: `${failures.length} population row(s) skipped`,
                description: failures[0],
                variant: "destructive",
              });
            }
          }
        }
        setCommunities(nextRows);
        queryClient.invalidateQueries({ queryKey: ["/api/population"] });
      } else if (step === 3) {
        // Bulk upsert HTR scores. The single-item POST is already keyed on
        // villageId (upsert) so the bulk endpoint preserves that semantic
        // and never produces duplicate rows.
        type HtrBulkResult = {
          clientId?: string;
          ok: boolean;
          id?: number;
          error?: string;
        };
        const items: any[] = [];
        for (let i = 0; i < risk.length; i++) {
          const r = risk[i];
          if (!r.villageId) continue;
          const composite = Math.round(
            (r.distance + r.terrain + r.season + r.insecurity) * 5,
          );
          items.push({
            clientId: `htr-${i}`,
            villageId: r.villageId,
            distanceScore: r.distance,
            terrainScore: r.terrain,
            seasonalScore: r.season,
            insecurityScore: r.insecurity,
            compositeScore: composite,
            interventionPriority:
              composite >= 70 ? "high" : composite >= 50 ? "medium" : "low",
            comments:
              [r.missed ? "missed_12mo" : null, r.zeroDose ? "zero_dose_hotspot" : null]
                .filter(Boolean)
                .join("; ") || null,
          });
        }
        if (items.length > 0) {
          const resp = await apiRequest<{ results: HtrBulkResult[] }>(
            "POST",
            "/api/htr-scores/bulk",
            { items },
          );
          const failures: string[] = [];
          let firstFailRow: string | undefined;
          let firstFailMsg: string | undefined;
          for (const r of resp.results ?? []) {
            if (!r.ok) {
              failures.push(r.error || "unknown error");
              if (firstFailRow === undefined && typeof r.clientId === "string") {
                firstFailRow = r.clientId;
                firstFailMsg = r.error || "This risk row could not be saved.";
              }
            }
          }
          if (failures.length > 0) {
            console.warn(`HTR bulk save: ${failures.length} row(s) skipped:`, failures);
            focusTarget = {
              step: 3,
              rowId: firstFailRow,
              message:
                firstFailMsg ??
                "Fix the highlighted risk row - it was rejected on save.",
            };
            if (!silent) {
              toast({
                title: `${failures.length} HTR row(s) skipped`,
                description: failures[0],
                variant: "destructive",
              });
            }
          }
        }
        queryClient.invalidateQueries({ queryKey: ["/api/htr-scores"] });
      } else if (step === 4) {
        // Bulk upsert: one request for the whole calendar instead of one PATCH
        // /POST per row. Server returns per-row results so a single bad row
        // (lead-time conflict, etc.) is reported alongside the saved siblings
        // rather than aborting the batch.
        const persisted: Record<string, number> = { ...sessionIdMap };
        const items = calendar
          .filter((row) => !!row.scheduledDate)
          .map((row) => ({
            clientId: row.rowId,
            id: persisted[row.rowId] ?? null,
            facilityId,
            microplanId: mpId,
            name: `${row.name} ${row.scheduledDate}`,
            sessionType: row.sessionType,
            quarter,
            year,
            scheduledDate: row.scheduledDate,
            status: "planned",
            approvalStatus: "draft",
          }));
        if (items.length > 0) {
          type SessionBulkResult = {
            clientId?: string;
            ok: boolean;
            id?: number;
            error?: string;
          };
          const resp = await apiRequest<{ results: SessionBulkResult[] }>(
            "POST",
            "/api/sessions/bulk",
            { items },
          );
          const failures: string[] = [];
          let firstFailRow: string | undefined;
          let firstFailMsg: string | undefined;
          for (const r of resp.results ?? []) {
            if (r.ok && r.id != null && typeof r.clientId === "string") {
              persisted[r.clientId] = r.id;
            } else if (!r.ok) {
              failures.push(r.error || "unknown error");
              if (firstFailRow === undefined && typeof r.clientId === "string") {
                firstFailRow = r.clientId;
                firstFailMsg = r.error || "This session could not be saved.";
              }
            }
          }
          if (failures.length > 0) {
            console.warn(`Session bulk save: ${failures.length} row(s) skipped:`, failures);
            // Pull the user straight to the offending row instead of leaving
            // them to hunt for it after a toast. A toast still fires for
            // context, but the highlighted date field is the primary fix path.
            focusTarget = {
              step: 4,
              rowId: firstFailRow,
              message:
                firstFailMsg ??
                "Fix the highlighted session date - it was rejected on save.",
            };
            if (!silent) {
              toast({
                title: `${failures.length} session row(s) need fixing`,
                description: failures[0],
                variant: "destructive",
              });
            }
          }
        }
        setSessionIdMap(persisted);
        queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      } else if (step === 8) {
        // Bulk upsert day plans in a single request. Each item is either an
        // update (id) or a create (sessionPlanId) - the server picks the
        // right path per item.
        const nextIdMap: Record<string, number> = { ...dayPlanIdMap };
        const items: any[] = [];
        for (let i = 0; i < staffing.length; i++) {
          const s = staffing[i];
          const sid = sessionIdMap[s.rowId];
          if (!sid) continue;
          const t = transport[i];
          const existingId = nextIdMap[s.rowId];
          items.push({
            clientId: s.rowId,
            id: existingId ?? null,
            sessionPlanId: sid,
            dayNumber: 1,
            sessionDate: calendar[i].scheduledDate,
            communitiesVisited: [calendar[i].name],
            targetPopulation: parseInt(s.target || "0", 10),
            vaccinesRequired: {},
            vaccinatorsCount: s.vaccinator ? 1 : 0,
            recordersCount: s.recorder ? 1 : 0,
            supervisorsCount: s.supervisor ? 1 : 0,
            distanceKm: t?.distanceKm ?? "0",
            transportType: t?.mode ?? "road",
            fuelLiters: t?.fuelLitres ?? "0",
            // Sheet 3 - Vitamin A supplements + scissors
            vitaminABlueCaps: s.vitaminABlueCaps ? parseInt(String(s.vitaminABlueCaps), 10) : 0,
            vitaminARedCaps: s.vitaminARedCaps ? parseInt(String(s.vitaminARedCaps), 10) : 0,
            scissorsCount: s.scissorsCount ? parseInt(String(s.scissorsCount), 10) : 0,
            executionNotes: [
              s.vaccinator && `vaccinator:${s.vaccinator}`,
              s.recorder && `recorder:${s.recorder}`,
              s.supervisor && `supervisor:${s.supervisor}`,
              s.teamType && `team:${s.teamType}`,
              s.perDiem && `perDiem:${s.perDiem}`,
              t?.vehicle && `vehicle:${t.vehicle}`,
              t?.cleared ? "security_cleared" : null,
            ]
              .filter(Boolean)
              .join("; "),
          });
        }
        if (items.length > 0) {
          type DayBulkResult = {
            clientId?: string;
            ok: boolean;
            id?: number;
            error?: string;
          };
          const resp = await apiRequest<{ results: DayBulkResult[] }>(
            "POST",
            "/api/sessions/days/bulk",
            { items },
          );
          const failures: string[] = [];
          for (const r of resp.results ?? []) {
            if (r.ok && r.id != null && typeof r.clientId === "string") {
              nextIdMap[r.clientId] = r.id;
            } else if (!r.ok) {
              failures.push(r.error || "unknown error");
            }
          }
          if (failures.length > 0) {
            console.warn(`Day plan bulk save: ${failures.length} row(s) skipped:`, failures);
            toast({
              title: `${failures.length} day plan row(s) skipped`,
              description: failures[0],
              variant: "destructive",
            });
          }
        }
        setDayPlanIdMap(nextIdMap);
      } else if (step === 5) {
        // Step 5 also writes a structured staffing roster to
        // microplans.staffing so supervision / budget / reports can read
        // it without parsing executionNotes. The per-session-day write
        // (vaccinator/recorder/supervisor counts + perDiem in notes)
        // still happens in step 8 alongside transport.
        const roster = staffing.map((s) => ({
          rowId: s.rowId,
          sessionLabel: s.sessionLabel,
          vaccinator: s.vaccinator ?? "",
          recorder: s.recorder ?? "",
          supervisor: s.supervisor ?? "",
          teamType: s.teamType ?? "fixed",
          target: parseInt(s.target || "0", 10),
          perDiem: parseFloat(s.perDiem || "0"),
        }));
        const prev = (microplan as any)?.staffing ?? {};
        const prevObj = prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {};
        await patchMicroplan(mpId, {
          staffing: { ...prevObj, roster, rosterUpdatedAt: new Date().toISOString() },
        });

        // Also persist each row's staff names into session_day_plans so the data
        // survives a page reload without having to re-visit step 8.
        const dayItems5: any[] = [];
        for (let si5 = 0; si5 < staffing.length; si5++) {
          const s5 = staffing[si5];
          const sid5 = sessionIdMap[s5.rowId];
          if (!sid5) continue;
          const existingId5 = dayPlanIdMap[s5.rowId];
          const notes5 = [
            s5.vaccinator && ("vaccinator:" + s5.vaccinator),
            s5.recorder && ("recorder:" + s5.recorder),
            s5.supervisor && ("supervisor:" + s5.supervisor),
            s5.teamType && ("team:" + s5.teamType),
            s5.perDiem && ("perDiem:" + s5.perDiem),
          ].filter(Boolean).join("; ");
          dayItems5.push({
            clientId: s5.rowId,
            id: existingId5 ?? null,
            sessionPlanId: sid5,
            dayNumber: 1,
            sessionDate: calendar[si5]?.scheduledDate,
            communitiesVisited: [calendar[si5]?.name].filter(Boolean),
            targetPopulation: parseInt(s5.target || "0", 10),
            vaccinesRequired: {},
            vaccinatorsCount: s5.vaccinator ? 1 : 0,
            recordersCount: s5.recorder ? 1 : 0,
            supervisorsCount: s5.supervisor ? 1 : 0,
            distanceKm: transport[si5]?.distanceKm ?? "0",
            transportType: transport[si5]?.mode ?? "road",
            fuelLiters: transport[si5]?.fuelLitres ?? "0",
            executionNotes: notes5,
          });
        }
        if (dayItems5.length > 0) {
          try {
            type DayBulkResult5 = { clientId?: string; ok: boolean; id?: number; error?: string };
            const resp5 = await apiRequest<{ results: DayBulkResult5[] }>(
              "POST",
              "/api/sessions/days/bulk",
              { items: dayItems5 },
            );
            const nextIdMap5: Record<string, number> = { ...dayPlanIdMap };
            for (const r5 of resp5.results ?? []) {
              if (r5.ok && r5.id != null && typeof r5.clientId === "string") {
                nextIdMap5[r5.clientId] = r5.id;
              }
            }
            setDayPlanIdMap(nextIdMap5);
          } catch (e5) {
            console.warn("[Step5] Could not persist staff to day plans:", e5);
          }
        }
      } else if (step === 6) {
        // Persist cold chain requirements to microplans.staffing first
        try {
          const prev = (microplan as any)?.staffing ?? {};
          const prevObj = prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {};
          await patchMicroplan(mpId, {
            staffing: { ...prevObj, coldChain },
          });
        } catch (e) {
          console.warn("[Step6] Could not persist cold chain to microplan:", e);
        }

        // Bulk upsert vaccine requirements in a single request.
        const nextVaccines = [...vaccines];
        const indexByClientId = new Map<string, number>();
        const items: any[] = [];
        for (let i = 0; i < nextVaccines.length; i++) {
          const v = nextVaccines[i];
          const target = parseInt(v.target || "0", 10);
          if (!target) continue;
          const wast = parseFloat(v.wastage || "0");
          const dosesReq = target * v.doses;
          const dosesWithWastage = Math.ceil(dosesReq * (1 + wast / 100));

          let dosesPerVial = 10;
          const nameUpper = v.name.toUpperCase();
          if (nameUpper.includes("BCG")) dosesPerVial = 20;
          else if (nameUpper.includes("OPV")) dosesPerVial = 20;
          else if (nameUpper.includes("PENTA")) dosesPerVial = 10;
          else if (nameUpper.includes("PCV")) dosesPerVial = 4;
          else if (nameUpper.includes("IPV")) dosesPerVial = 5;
          else if (nameUpper.includes("ROTA")) dosesPerVial = 1;
          else if (nameUpper.includes("MR") || nameUpper.includes("MEASLES")) dosesPerVial = 10;
          else if (nameUpper.includes("TT") || nameUpper.includes("TD")) dosesPerVial = 10;

          const vials = Math.ceil(dosesWithWastage / dosesPerVial);
          const clientId = `vr-${i}`;
          indexByClientId.set(clientId, i);
          items.push({
            clientId,
            id: v.id ?? null,
            facilityId,
            vaccineName: v.name,
            targetPopulation: target,
            dosesRequired: dosesReq,
            wastageRate: String(wast),
            dosesWithWastage,
            vialsRequired: vials,
            quarter,
            year,
          });
        }
        if (items.length > 0) {
          const resp = await apiRequest<{ results: Array<{ clientId?: string; ok: boolean; id?: number; error?: string }> }>(
            "POST",
            "/api/vaccine-requirements/bulk",
            { items },
          );
          const failures: string[] = [];
          let firstFailRow: string | undefined;
          let firstFailMsg: string | undefined;
          for (const r of resp.results ?? []) {
            if (r.ok && r.id != null && typeof r.clientId === "string") {
              const idx = indexByClientId.get(r.clientId);
              if (idx != null) nextVaccines[idx] = { ...nextVaccines[idx], id: r.id };
            } else if (!r.ok) {
              failures.push(r.error || "unknown error");
              if (firstFailRow === undefined && typeof r.clientId === "string") {
                firstFailRow = r.clientId;
                firstFailMsg = r.error || "This vaccine row could not be saved.";
              }
            }
          }
          if (failures.length > 0) {
            console.warn(`Vaccine req bulk save: ${failures.length} row(s) skipped:`, failures);
            focusTarget = {
              step: 6,
              rowId: firstFailRow,
              message:
                firstFailMsg ??
                "Fix the highlighted vaccine row - it was rejected on save.",
            };
            if (!silent) {
              toast({
                title: `${failures.length} vaccine row(s) skipped`,
                description: failures[0],
                variant: "destructive",
              });
            }
          }
        }
        setVaccines(nextVaccines);
        queryClient.invalidateQueries({ queryKey: ["/api/vaccine-requirements"] });
      } else if (step === 7) {
        const nextMob = [...mobilization];
        const indexByClientId = new Map<string, number>();
        const items: any[] = [];
        for (let i = 0; i < nextMob.length; i++) {
          const m = nextMob[i];
          if (!m.focalPoint && m.channels.length === 0) continue;
          const clientId = `mob-${i}`;
          indexByClientId.set(clientId, i);
          items.push({
            clientId,
            id: m.id ?? null,
            facilityId,
            activityType: m.channels.join(",") || "announcement",
            description: `${m.sessionLabel} - focal: ${m.focalPoint} ${m.focalPhone}; IEC: ${m.iec.join(", ")}`,
            targetAudience: "community",
            status: "planned",
          });
        }
        if (items.length > 0) {
          const resp = await apiRequest<{ results: Array<{ clientId?: string; ok: boolean; id?: number; error?: string }> }>(
            "POST",
            "/api/mobilization/bulk",
            { items },
          );
          const failures: string[] = [];
          let firstFailRow: string | undefined;
          let firstFailMsg: string | undefined;
          for (const r of resp.results ?? []) {
            if (r.ok && r.id != null && typeof r.clientId === "string") {
              const idx = indexByClientId.get(r.clientId);
              if (idx != null) nextMob[idx] = { ...nextMob[idx], id: r.id };
            } else if (!r.ok) {
              failures.push(r.error || "unknown error");
              if (firstFailRow === undefined && typeof r.clientId === "string") {
                firstFailRow = r.clientId;
                firstFailMsg = r.error || "This mobilization row could not be saved.";
              }
            }
          }
          if (failures.length > 0) {
            console.warn(`Mobilization bulk save: ${failures.length} row(s) skipped:`, failures);
            focusTarget = {
              step: 7,
              rowId: firstFailRow,
              message:
                firstFailMsg ??
                "Fix the highlighted mobilization row - it was rejected on save.",
            };
            if (!silent) {
              toast({
                title: `${failures.length} mobilization row(s) skipped`,
                description: failures[0],
                variant: "destructive",
              });
            }
          }
        }
        setMobilization(nextMob);
        queryClient.invalidateQueries({ queryKey: ["/api/mobilization"] });
      } else if (step === 9) {
        const nextBudget = [...budget];
        const indexByClientId = new Map<string, number>();
        const items: any[] = [];
        for (let i = 0; i < nextBudget.length; i++) {
          const b = nextBudget[i];
          if (!b.description.trim()) continue;
          const qty = parseInt(b.quantity || "0", 10);
          const unit = parseFloat(b.unitCost || "0");
          const total = qty * unit;
          const clientId = `bud-${i}`;
          indexByClientId.set(clientId, i);
          items.push({
            clientId,
            id: b.id ?? null,
            facilityId,
            category: b.category,
            description: b.description,
            unitCost: String(unit),
            quantity: qty,
            totalCost: String(total),
            quarter,
            year,
            fundingSource: b.fundingSource,
            approvalStatus: "draft",
          });
        }
        if (items.length > 0) {
          const resp = await apiRequest<{ results: Array<{ clientId?: string; ok: boolean; id?: number; error?: string }> }>(
            "POST",
            "/api/budget-items/bulk",
            { items },
          );
          const failures: string[] = [];
          let firstFailRow: string | undefined;
          let firstFailMsg: string | undefined;
          for (const r of resp.results ?? []) {
            if (r.ok && r.id != null && typeof r.clientId === "string") {
              const idx = indexByClientId.get(r.clientId);
              if (idx != null) nextBudget[idx] = { ...nextBudget[idx], id: r.id };
            } else if (!r.ok) {
              failures.push(r.error || "unknown error");
              if (firstFailRow === undefined && typeof r.clientId === "string") {
                firstFailRow = r.clientId;
                firstFailMsg = r.error || "This budget line could not be saved.";
              }
            }
          }
          if (failures.length > 0) {
            console.warn(`Budget bulk save: ${failures.length} row(s) skipped:`, failures);
            focusTarget = {
              step: 9,
              rowId: firstFailRow,
              message:
                firstFailMsg ??
                "Fix the highlighted budget line - it was rejected on save.",
            };
            if (!silent) {
              toast({
                title: `${failures.length} budget row(s) skipped`,
                description: failures[0],
                variant: "destructive",
              });
            }
          }
        }
        setBudget(nextBudget);
        queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      } else if (step === 10) {
        const nextSup = [...supervision];
        const indexByClientId = new Map<string, number>();
        const items: any[] = [];
        for (let i = 0; i < nextSup.length; i++) {
          const v = nextSup[i];
          if (!v.supervisorName.trim()) continue;
          const clientId = `sup-${i}`;
          indexByClientId.set(clientId, i);
          items.push({
            clientId,
            id: v.id ?? null,
            facilityId,
            microplanId: mpId,
            scheduledDate: v.scheduledDate,
            supervisorName: v.supervisorName,
            visitType: "routine",
            status: "scheduled",
            checklist: [{ key: "type", label: v.checklist, response: "na" }],
            followUpActions: v.followUp || null,
          });
        }
        if (items.length > 0) {
          const resp = await apiRequest<{ results: Array<{ clientId?: string; ok: boolean; id?: number; error?: string }> }>(
            "POST",
            "/api/supervision-visits/bulk",
            { items },
          );
          const failures: string[] = [];
          let firstFailRow: string | undefined;
          let firstFailMsg: string | undefined;
          for (const r of resp.results ?? []) {
            if (r.ok && r.id != null && typeof r.clientId === "string") {
              const idx = indexByClientId.get(r.clientId);
              if (idx != null) nextSup[idx] = { ...nextSup[idx], id: r.id };
            } else if (!r.ok) {
              failures.push(r.error || "unknown error");
              if (firstFailRow === undefined && typeof r.clientId === "string") {
                firstFailRow = r.clientId;
                firstFailMsg = r.error || "This supervision visit could not be saved.";
              }
            }
          }
          if (failures.length > 0) {
            console.warn(`Supervision bulk save: ${failures.length} row(s) skipped:`, failures);
            focusTarget = {
              step: 10,
              rowId: firstFailRow,
              message:
                firstFailMsg ??
                "Fix the highlighted supervision visit - it was rejected on save.",
            };
            if (!silent) {
              toast({
                title: `${failures.length} supervision row(s) skipped`,
                description: failures[0],
                variant: "destructive",
              });
            }
          }
        }
        setSupervision(nextSup);
        queryClient.invalidateQueries({ queryKey: ["/api/supervision-visits"] });
      }
      // A per-row validation rejection isn't a thrown error, but we still
      // treat it as a failed save so callers don't advance past the problem.
      if (focusTarget) return false;
      return true;
    } catch (e: any) {
      if (!silent) {
        toast({
          title: `Could not save step ${step}`,
          description: e?.message ?? String(e),
          variant: "destructive",
        });
      }
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
      if (focusTarget) {
        setErrorFocus(focusTarget);
        setActive(focusTarget.step);
      }
    }
  }

  async function handleNext() {
    const stepErrors = validationErrors.filter((error) => error.step === active);
    if (stepErrors.length > 0) {
      const first = stepErrors[0];
      setErrorFocus({ step: first.step, rowId: first.id, message: first.message });
      toast({
        title: `Step ${active} needs attention`,
        description: first.message,
        variant: "destructive",
      });
      return;
    }
    // Capture the dispatched snapshot before the save so edits made during the
    // request aren't wrongly marked clean (mirrors the auto-save fix).
    const snap = snapshotForStep(active);
    const ok = await persistStep(active);
    if (ok) {
      // Mark the step we just saved as clean so auto-save doesn't re-fire it.
      savedSnapshots.current[active] = snap;
      if (active < 11) setActive(active + 1);
    }
  }

  function buildSubmissionSnapshot() {
    const generatedAt = new Date().toISOString();
    const totalBudget = budget.reduce(
      (sum, b) => sum + Number(b.quantity || 0) * Number(b.unitCost || 0),
      0,
    );
    const communityRows = communities.map((row, index) => ({
      rowId: row.rowId ?? `community-${index + 1}`,
      id: row.id ?? null,
      villageId: row.villageId ?? null,
      name: row.name,
      type: row.type ?? row.settlementType ?? "village",
      targetPopulation: Number(row.targetPopulation || 0),
      totalCatchmentPopulation: Number(row.totalCatchmentPopulation || row.surveyPop || 0),
      under5Population: Number(row.under5Population || 0),
      source: row.source ?? "nso",
      strategy: row.strategy ?? "static",
      focalChvId: row.focalChvId ?? null,
      focalPersonName: row.focalPersonName || "",
      focalPersonPhone: row.focalPersonPhone || "",
      focalPersonSource: row.focalPersonSource || (row.focalChvId ? "CHV registry" : ""),
      communicationContactMade: !!row.communicationContactMade,
      outsideFollowUpCheck: !!row.outsideFollowUpCheck,
      highRisk: !!row.highRisk,
      highRiskReason: row.highRiskReason || "",
      isCrossBorder: !!row.isCrossBorder,
      borderCountry: row.borderCountry || "",
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      distanceToFacility: row.distanceToFacility ?? row.distanceKm ?? null,
    }));

    return {
      schemaVersion: 1,
      generatedAt,
      submittedBy: user ? {
        id: user.id,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "",
        role: user.role || "",
      } : null,
      microplan: {
        id: microplanId,
        name,
        planType,
        year,
        quarter,
        facilityId,
        facilityName: facility?.name ?? "",
        districtId: facility?.districtId ?? null,
      },
      coverage,
      communities: communityRows,
      risk,
      sessionCalendar: calendar,
      staffing,
      vaccineForecast: vaccines,
      coldChain,
      mobilization,
      transport,
      budget,
      budgetTotal: totalBudget,
      supervision,
      facilityStaff: staffRoster,
      facilityChvs,
      referenceSources: [
        "microplan wizard state",
        "facility village registry",
        "facility CHV registry",
        "facility staff roster",
        "stock ledger balance endpoint",
      ],
    };
  }
  async function handleSubmit() {
    if (!microplanId) {
      toast({ title: "Nothing to submit yet", variant: "destructive" });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const prevStaffing = (microplan as any)?.staffing;
      const prevStaffingObj =
        prevStaffing && typeof prevStaffing === "object" && !Array.isArray(prevStaffing)
          ? prevStaffing
          : {};
      await patchMicroplan(microplanId, {
        staffing: {
          ...prevStaffingObj,
          roster: staffing,
          submissionSnapshot: buildSubmissionSnapshot(),
          submissionSnapshotUpdatedAt: new Date().toISOString(),
        },
      });

      // File a real approval request so the microplan flows through the same
      // hierarchical approvals pipeline used by session plans, population and
      // budget items. The server-side POST /api/approvals handler mirrors the
      // submission onto microplans.status = "pending" automatically.
      await apiRequest("POST", "/api/approvals", {
        entityType: "microplan",
        entityId: microplanId,
        currentLevel: "district",
        status: "pending",
        comments: "Microplan submitted for review.",
      });
      toast({
        title: "Microplan submitted",
        description: "Sent to district approvers. Track progress on the Approvals page.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/microplans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      // Commented out to prevent backward jump
      // setActive(12);
      setShowConfirmation(true);
    } catch (e: any) {
      toast({
        title: "Submit failed",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // --- Render ------------------------------------------------------------
  const stepDef = STEPS.find((s) => s.id === active)!;
  const status = microplan?.status ?? "draft";
  const isReadOnly = status !== "draft";
  const facilityLabel = facility?.name ?? "No facility selected";
  // Facility staff (clerk + in-charge) author and submit microplans; higher
  // roles act as reviewers/approvers. national_admin is included so platform
  // admins can unblock submissions during support.
  const canSubmit =
    user?.role === "facility_clerk" ||
    user?.role === "facility_in_charge" ||
    user?.role === "national_admin";

  const validationErrors = useMemo(() => {
    const errors: Array<{ step: number; message: string; id: string }> = [];

    // 1. Roster assignments (Step 5)
    if (!staffing || staffing.length === 0) {
      errors.push({
        step: 5,
        id: "roster-empty",
        message: "Roster assignments are missing. You must schedule staffing for sessions.",
      });
    } else {
      const rosterNames = new Set((staffRoster || []).map((s) => s.name?.trim().toLowerCase()));
      staffing.forEach((s, idx) => {
        const sessionLabel = s.sessionLabel || `Session ${idx + 1}`;
        if (!s.vaccinator || !s.vaccinator.trim()) {
          errors.push({
            step: 5,
            id: `staff-vaccinator-missing-${idx}`,
            message: `Staffing: Vaccinator is not assigned for ${sessionLabel}.`,
          });
        } else if (!rosterNames.has(s.vaccinator.trim().toLowerCase())) {
          errors.push({
            step: 5,
            id: `staff-vaccinator-invalid-${idx}`,
            message: `Staffing: Vaccinator '${s.vaccinator}' assigned to ${sessionLabel} is not in the facility staff roster.`,
          });
        }

        if (!s.recorder || !s.recorder.trim()) {
          errors.push({
            step: 5,
            id: `staff-recorder-missing-${idx}`,
            message: `Staffing: Recorder is not assigned for ${sessionLabel}.`,
          });
        } else if (!rosterNames.has(s.recorder.trim().toLowerCase())) {
          errors.push({
            step: 5,
            id: `staff-recorder-invalid-${idx}`,
            message: `Staffing: Recorder '${s.recorder}' assigned to ${sessionLabel} is not in the facility staff roster.`,
          });
        }

        if (!s.supervisor || !s.supervisor.trim()) {
          errors.push({
            step: 5,
            id: `staff-supervisor-missing-${idx}`,
            message: `Staffing: Supervisor is not assigned for ${sessionLabel}.`,
          });
        } else if (!rosterNames.has(s.supervisor.trim().toLowerCase())) {
          errors.push({
            step: 5,
            id: `staff-supervisor-invalid-${idx}`,
            message: `Staffing: Supervisor '${s.supervisor}' assigned to ${sessionLabel} is not in the facility staff roster.`,
          });
        }
      });
    }

    // 2. Budget (Step 9)
    const hasBudgetItems = budget && budget.some(
      (b) => b.description && b.description.trim() && parseInt(b.quantity || "0", 10) > 0 && parseFloat(b.unitCost || "0") > 0
    );
    if (!hasBudgetItems) {
      errors.push({
        step: 9,
        id: "budget-empty",
        message: "Budget: At least one budget item with description, quantity, and unit cost must be present.",
      });
    }

    // 3. Communities (Step 2)
    // Only validate communities the user has explicitly included in this microplan:
    // a community is considered "active" if it has been saved to the DB (c.saved === true)
    // OR if the user has already entered a non-zero population for it.
    const activeCommunities = communities
      ? communities.filter((c) => c.saved === true || parseInt(c.targetPopulation || "0", 10) > 0)
      : [];

    if (activeCommunities.length === 0) {
      errors.push({
        step: 2,
        id: "communities-empty",
        message: "Communities: No catchment villages/communities have been configured for this microplan. Go to Step 2 and set populations for at least one community.",
      });
    } else {
      activeCommunities.forEach((c, idx) => {
        const name = c.name || `Community ${idx + 1}`;
        const pop = parseInt(c.targetPopulation || "0", 10);
        if (isNaN(pop) || pop <= 0) {
          errors.push({
            step: 2,
            id: `community-pop-${idx}`,
            message: `Communities: '${name}' target population must be greater than 0.`,
          });
        }
        if (!c.strategy || !["static", "outreach", "mobile"].includes(c.strategy)) {
          errors.push({
            step: 2,
            id: `community-strategy-${idx}`,
            message: `Communities: '${name}' must have a valid strategy (fixed/outreach/mobile).`,
          });
        }
        const phone = c.focalPersonPhone || "";
        const phoneClean = phone.trim();
        const isValidPhone = /^\+?[\d\s\-()]{7,20}$/.test(phoneClean);
        if (!phoneClean) {
          errors.push({
            step: 2,
            id: `community-phone-missing-${idx}`,
            message: `Communities: '${name}' is missing a focal person phone number.`,
          });
        } else if (!isValidPhone) {
          errors.push({
            step: 2,
            id: `community-phone-invalid-${idx}`,
            message: `Communities: '${name}' focal point phone '${phoneClean}' is not a valid phone number.`,
          });
        }
        if (!c.focalPersonName || !c.focalPersonName.trim()) {
          errors.push({
            step: 2,
            id: `community-focal-name-missing-${idx}`,
            message: `Communities: '${name}' is missing focal person name.`,
          });
        }
        if (!c.communicationContactMade) {
          errors.push({
            step: 2,
            id: `community-contact-not-made-${idx}`,
            message: `Communities: '${name}' contact checkbox 'Communication Contact Made' must be checked.`,
          });
        }
        if (!c.outsideFollowUpCheck) {
          errors.push({
            step: 2,
            id: `community-followup-not-made-${idx}`,
            message: `Communities: '${name}' contact checkbox 'Follow-up made outside platform' must be confirmed.`,
          });
        }
      });
    }

    // 4. Calendar (Step 4)
    if (!calendar || calendar.length === 0) {
      errors.push({
        step: 4,
        id: "calendar-empty",
        message: "Calendar: No sessions have been scheduled in the calendar.",
      });
    } else {
      const datesSeen = new Set<string>();
      const duplicateDates = new Set<string>();
      calendar.forEach((c) => {
        if (c.scheduledDate) {
          if (datesSeen.has(c.scheduledDate)) {
            duplicateDates.add(c.scheduledDate);
          }
          datesSeen.add(c.scheduledDate);
        }
      });

      calendar.forEach((c, idx) => {
        const sessionName = c.name || `Session ${idx + 1}`;
        if (!c.scheduledDate) {
          errors.push({
            step: 4,
            id: `calendar-date-missing-${idx}`,
            message: `Calendar: '${sessionName}' does not have a scheduled date.`,
          });
        } else {
          if (duplicateDates.has(c.scheduledDate)) {
            errors.push({
              step: 4,
              id: `calendar-date-overlap-${idx}`,
              message: `Calendar: Overlap detected for '${sessionName}'. Multiple sessions are scheduled on ${c.scheduledDate}.`,
            });
          }
          if (!isAtLeastDaysAhead(c.scheduledDate, 7)) {
            errors.push({
              step: 4,
              id: `calendar-date-leadtime-${idx}`,
              message: `Calendar: '${sessionName}' scheduled on ${c.scheduledDate} does not satisfy the 7-day lead-time policy.`,
            });
          }
        }
      });
    }

    // 5. Vaccine forecasting (Step 6)
    if (!vaccines || vaccines.length === 0) {
      errors.push({
        step: 6,
        id: "vaccines-empty",
        message: "Vaccines: Vaccine requirements must be available before continuing.",
      });
    } else {
      vaccines.forEach((v, idx) => {
        const target = parseInt(v.target || "0", 10);
        const wastage = parseFloat(v.wastage || "0");
        if (!Number.isFinite(target) || target <= 0) {
          errors.push({
            step: 6,
            id: `vr-${idx}`,
            message: `Vaccines: ${v.name} target population must be greater than 0.`,
          });
        }
        if (!Number.isFinite(wastage) || wastage < 0) {
          errors.push({
            step: 6,
            id: `vr-${idx}`,
            message: `Vaccines: ${v.name} wastage percentage must be valid.`,
          });
        }
      });
    }
    // 5. Mobilization (Step 7)
    if (!mobilization || mobilization.length === 0) {
      errors.push({
        step: 7,
        id: "mobilization-empty",
        message: "Mobilization: Mobilization details must be defined.",
      });
    } else {
      mobilization.forEach((m, idx) => {
        const sessionLabel = m.sessionLabel || `Session ${idx + 1}`;
        if (!m.channels || m.channels.length === 0) {
          errors.push({
            step: 7,
            id: `mob-channels-empty-${idx}`,
            message: `Mobilization: Select at least one announcement channel for ${sessionLabel}.`,
          });
        }
        if (!m.focalPoint || !m.focalPoint.trim()) {
          errors.push({
            step: 7,
            id: `mob-focal-missing-${idx}`,
            message: `Mobilization: Focal point name is missing for ${sessionLabel}.`,
          });
        }
        const phone = m.focalPhone || "";
        const phoneClean = phone.trim();
        const isValidPhone = /^\+?[\d\s\-()]{7,20}$/.test(phoneClean);
        if (!phoneClean) {
          errors.push({
            step: 7,
            id: `mob-phone-missing-${idx}`,
            message: `Mobilization: Focal phone number is missing for ${sessionLabel}.`,
          });
        } else if (!isValidPhone) {
          errors.push({
            step: 7,
            id: `mob-phone-invalid-${idx}`,
            message: `Mobilization: Focal phone '${phoneClean}' for ${sessionLabel} is not valid.`,
          });
        }
      });
    }

    // 6. Logistics & transport (Step 8)
    if (!transport || transport.length === 0) {
      errors.push({
        step: 8,
        id: "transport-empty",
        message: "Logistics: Transport rows are missing. Finish Step 4 first.",
      });
    } else {
      transport.forEach((t, idx) => {
        const label = t.sessionLabel || `Session ${idx + 1}`;
        if (!t.sessionLabel || !/\d{4}-\d{2}-\d{2}/.test(t.sessionLabel)) {
          errors.push({
            step: 8,
            id: `transport-date-missing-${idx}`,
            message: `Logistics: ${label} is missing the session date from Step 4.`,
          });
        }
        const distance = parseFloat(t.distanceKm || "0");
        if (!Number.isFinite(distance) || distance < 0) {
          errors.push({
            step: 8,
            id: `transport-distance-invalid-${idx}`,
            message: `Logistics: Distance for ${label} must be a valid number.`,
          });
        }
        if (!t.mode) {
          errors.push({
            step: 8,
            id: `transport-mode-missing-${idx}`,
            message: `Logistics: Transport mode is required for ${label}.`,
          });
        }
      });
    }
    return errors;
  }, [communities, calendar, staffing, staffRoster, vaccines, mobilization, transport, budget]);

  const { data: readiness } = useQuery<any>({
    queryKey: ["/api/microplans/readiness", facilityId, year],
    queryFn: async () => {
      const res = await fetch(`/api/microplans/readiness/${facilityId}?year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load microplanning readiness");
      return res.json();
    },
    enabled: !!facilityId,
    staleTime: 60_000,
  });
  const blockingReadinessItems = readiness?.items?.filter((item: any) => item.status === "blocking") ?? [];
  const warningReadinessItems = readiness?.items?.filter((item: any) => item.status === "warning") ?? [];

  return (
    <div className="flex h-full min-h-[calc(100vh-3.5rem)] flex-col">
      {/* Sticky header (Original line commented out to satisfy rule 1)
      <div className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
      */}
      <div className="sticky top-0 z-[1050] border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-9 gap-1"
              onClick={() => setLocation(planType === "campaign" ? "/microplans/campaigns" : "/microplans/routine")}
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Microplan</p>
                <Badge
                  variant={planType === "campaign" ? "default" : "secondary"}
                  className="gap-1"
                  data-testid="badge-plan-type"
                >
                  {planType === "campaign" ? (
                    <>
                      <Sparkles className="h-3 w-3" /> SIA Campaign
                    </>
                  ) : (
                    <>
                      <Calendar className="h-3 w-3" /> Routine
                    </>
                  )}
                </Badge>
              </div>
              <h1 className="truncate text-lg font-semibold" data-testid="wizard-title">
                {name ||
                  `${planType === "campaign" ? "SIA" : "Routine"} microplan Q${quarter} ${year}`}
              </h1>
              <p className="text-xs text-muted-foreground">{facilityLabel}</p>
            </div>
          </div>
          <Badge variant={status === "draft" ? "outline" : "default"}>
            {status}
          </Badge>
        </div>
        {/* Task #101 - return-to-village banner */}
        {returnVillage && (
          <div
            className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs"
            data-testid="banner-return-to-village"
          >
            <span className="min-w-0">
              {microplanId ? (
                <>
                  Microplan started. You can now continue to plan a session for{" "}
                  <span className="font-semibold">
                    {returnVillage.name || "the selected village"}
                  </span>
                  .
                </>
              ) : (
                <>
                  After this microplan is saved, you'll return to plan a session
                  for{" "}
                  <span className="font-semibold">
                    {returnVillage.name || "the selected village"}
                  </span>
                  .
                </>
              )}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={microplanId ? "default" : "outline"}
                disabled={!microplanId}
                onClick={continueToVillageSession}
                data-testid="button-continue-to-village-session"
              >
                Continue to session
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={clearReturnVillage}
                aria-label="Dismiss return-to-village reminder"
                data-testid="button-dismiss-return-to-village"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Original Saved-microplans picker commented out here to be moved below the wizard stepper for visibility:
      {!microplanId && (
        <SavedMicroplansPanel
          planType={planType}
          onOpen={(id) =>
            setLocation(
              `/microplans/${planType === "campaign" ? "campaigns" : "routine"}/${id}`,
            )
          }
        />
      )}
      */}

      {facilityId && readiness?.summary?.status !== "ready" && (
        <div className="px-4 pt-4">
          <Card className={blockingReadinessItems.length > 0 ? "border-destructive/40 bg-destructive/5" : "border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20"}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Microplanning Readiness Check</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    VaxPlan checks reference data first so health workers do not have to retype information during planning.
                  </p>
                </div>
                <Badge variant={blockingReadinessItems.length > 0 ? "destructive" : "outline"}>
                  {blockingReadinessItems.length > 0 ? `${blockingReadinessItems.length} item(s) need fixing` : "Can continue with warnings"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {[...blockingReadinessItems, ...warningReadinessItems].map((item: any) => (
                <div key={item.key} className="rounded-md border bg-background p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-medium">{item.label}</p>
                    <Badge variant={item.status === "blocking" ? "destructive" : "outline"}>
                      {item.status === "blocking" ? "Fix first" : "Review"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                  {item.actionHref && item.actionLabel && (
                    <Button asChild variant="ghost" size="sm" className="mt-2 h-auto px-0 text-xs text-primary hover:text-primary">
                      <Link href={item.actionHref}>{item.actionLabel}</Link>
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
      {/* Body: stepper + content */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Left rail */}
        <nav className="w-64 shrink-0 overflow-y-auto" aria-label="Microplan steps">
          <ol className="space-y-1">
            {STEPS.map((s) => {
              const isActive = s.id === active;
              const done = s.id < active;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setActive(s.id)}
                    className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:bg-muted"
                    }`}
                    data-testid={`step-button-${s.id}`}
                  >
                    {done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">
                        Step {s.id}
                      </span>
                      <span className="block font-medium leading-tight">
                        {s.title}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {active === 11 && showConfirmation && status !== "draft" ? (
            <SubmissionConfirmation
              microplan={microplan ?? null}
              submittedByName={
                user
                  ? `${user.firstName || ""} ${user.lastName || ""}`.trim() +
                    ` (${user.role ? user.role.replace(/_/g, " ") : "staff"})`
                  : "Facility Officer"
              }
              nextApprovalStep="District Review"
              responsibleRole="District Health Officer / Team"
              facilityLabel={facilityLabel}
              onViewDetails={() => setShowConfirmation(false)}
              onClose={() => setLocation(planType === "campaign" ? "/microplans/campaigns" : "/microplans/routine")}
            />
          ) : (
            <Card className="flex flex-1 flex-col overflow-hidden">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Step {stepDef.id} - {stepDef.title}
                </CardTitle>
              <div className="flex items-center gap-2">
                {returnToSummary && active !== 11 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReturnToSummary(false);
                      setActive(11);
                    }}
                    data-testid="button-back-to-summary"
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" /> Back to summary
                  </Button>
                )}
                {/* Duplicate action button at the top of the card so it's always
                    reachable when the step content is long and the footer is
                    off-screen, and so toasts at the bottom can't obscure it. */}
                {active === 11 ? (
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!canSubmit || busy || !microplanId || validationErrors.length > 0}
                    data-testid="button-submit-top"
                  >
                    {busy ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="mr-1 h-3 w-3" />
                    )}
                    Submit
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleNext}
                    disabled={busy || active >= 12 || !facilityId}
                    data-testid="button-next-top"
                  >
                    {busy ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    Next <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>

              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
              <WhatToDo bullets={stepDef.whatToDo} />

              {/* Facility & name (always available, drives ensureMicroplan) */}
              {!microplanId && (
                <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                  <div
                    className={
                      errorFocus?.field === "facility"
                        ? "rounded-md ring-1 ring-destructive p-2"
                        : undefined
                    }
                  >
                    <Label className="mb-2 block">Facility</Label>
                    <FacilityCascadePicker
                      value={facilityId}
                      onChange={(id) => {
                        setFacilityId(id);
                        if (errorFocus?.field === "facility") setErrorFocus(null);
                      }}
                      required
                      testIdPrefix="wizard"
                    />
                    {errorFocus?.field === "facility" && (
                      <p
                        className="mt-1 text-xs text-destructive"
                        data-testid="facility-error"
                      >
                        {errorFocus.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Plan name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={`Microplan Q${quarter} ${year}`}
                      data-testid="input-microplan-name"
                    />
                  </div>
                </div>
              )}

              <fieldset disabled={isReadOnly} className="contents space-y-4">
                {active === 1 && (
                <Step1
                  facilityId={facilityId}
                  year={year}
                  coverage={coverage}
                  setCoverage={setCoverage}
                  planType={planType}
                  setPlanType={setPlanType}
                  planTypeLocked={planTypeLocked}
                  campaignAntigen={campaignAntigen}
                  setCampaignAntigen={setCampaignAntigen}
                  campaignTargetAge={campaignTargetAge}
                  setCampaignTargetAge={setCampaignTargetAge}
                  campaignScope={campaignScope}
                  setCampaignScope={setCampaignScope}
                  campaignScopeDetails={campaignScopeDetails}
                  setCampaignScopeDetails={setCampaignScopeDetails}
                />
              )}
              {active === 2 && (
                <Step2
                  targetInfants={parseFloat(coverage.targetInfants || "0")}
                  communities={communities}
                  setCommunities={setCommunities}
                  onDelete={deleteCommunity}
                  facility={facility}
                  microplan={microplan}
                  excludedVillages={excludedFacilityVillages}
                  excludedDetails={excludedDetails}
                  readOnly={isReadOnly}
                  facilityChvs={facilityChvs}
                  planType={planType}
                  onRestoreVillage={(v) => {
                    setCommunities([
                      ...communities,
                      {
                        villageId: v.id,
                        name: v.name,
                        type: "village",
                        targetPopulation: "0",
                        source: "nso",
                        strategy: v.isHardToReach ? "outreach" : "static",
                        saved: false,
                        rowId: `v${v.id}-${Date.now()}`,
                        latitude: v.latitude != null ? String(v.latitude) : undefined,
                        longitude: v.longitude != null ? String(v.longitude) : undefined,
                      },
                    ]);
                    setExcludedVillageIds((prev) => {
                      if (!prev.has(v.id)) return prev;
                      const next = new Set<number>(prev);
                      next.delete(v.id);
                      persistExcluded(next);
                      return next;
                    });
                  }}
                  errorRowId={
                    errorFocus?.step === 2 ? errorFocus.rowId : undefined
                  }
                  errorMessage={
                    errorFocus?.step === 2 ? errorFocus.message : undefined
                  }
                  onClearError={() => setErrorFocus(null)}
                />
              )}
              {active === 3 && (
                <Step3
                  risk={risk}
                  setRisk={setRisk}
                  errorRowId={
                    errorFocus?.step === 3 ? errorFocus.rowId : undefined
                  }
                  errorMessage={
                    errorFocus?.step === 3 ? errorFocus.message : undefined
                  }
                  onClearError={() => setErrorFocus(null)}
                />
              )}
              {active === 4 && (
                <Step4
                  calendar={calendar}
                  setCalendar={setCalendar}
                  generate={generateCalendar}
                  errorRowId={
                    errorFocus?.step === 4 ? errorFocus.rowId : undefined
                  }
                  errorMessage={
                    errorFocus?.step === 4 ? errorFocus.message : undefined
                  }
                  onClearError={() => setErrorFocus(null)}
                  communities={communities}
                />
              )}
              {active === 5 && (
                <Step5 staffing={staffing} setStaffing={setStaffing} facilityId={facilityId} />
              )}
              {active === 6 && (
                <Step6
                  vaccines={vaccines}
                  setVaccines={setVaccines}
                  coldChain={coldChain}
                  setColdChain={setColdChain}
                  errorRowId={
                    errorFocus?.step === 6 ? errorFocus.rowId : undefined
                  }
                  errorMessage={
                    errorFocus?.step === 6 ? errorFocus.message : undefined
                  }
                  onClearError={() => setErrorFocus(null)}
                  facilityId={facilityId}
                  targetInfants={parseFloat(coverage.targetInfants || "0")}
                  communities={communities}
                />
              )}
              {active === 7 && (
                <div className="space-y-4">
                  <Step7
                    mobilization={mobilization}
                    setMobilization={setMobilization}
                    onDelete={deleteMobilizationRow}
                    errorRowId={
                      errorFocus?.step === 7 ? errorFocus.rowId : undefined
                    }
                    errorMessage={
                      errorFocus?.step === 7 ? errorFocus.message : undefined
                    }
                    onClearError={() => setErrorFocus(null)}
                  />
                  <div className="grid gap-4 xl:grid-cols-2">
                    <StepHfcBoard facilityId={facilityId} />
                    <StepChvProfile facilityId={facilityId} villages={communities} planType={planType} />
                  </div>
                </div>
              )}
              {active === 8 && (
                <Step8 transport={transport} setTransport={setTransport} />
              )}
              {active === 9 && (
                <Step9
                  budget={budget}
                  setBudget={setBudget}
                  onDelete={deleteBudgetRow}
                  errorRowId={
                    errorFocus?.step === 9 ? errorFocus.rowId : undefined
                  }
                  errorMessage={
                    errorFocus?.step === 9 ? errorFocus.message : undefined
                  }
                  onClearError={() => setErrorFocus(null)}
                />
              )}
              {active === 10 && (
                <Step10
                  supervision={supervision}
                  setSupervision={setSupervision}
                  onDelete={deleteSupervisionRow}
                  errorRowId={
                    errorFocus?.step === 10 ? errorFocus.rowId : undefined
                  }
                  errorMessage={
                    errorFocus?.step === 10 ? errorFocus.message : undefined
                  }
                  onClearError={() => setErrorFocus(null)}
                  facilityId={facilityId}
                />
              )}
              {active === 11 && (
                <Step11
                  microplan={microplan ?? null}
                  facilityLabel={facilityLabel}
                  coverage={coverage}
                  communities={communities}
                  risk={risk}
                  calendar={calendar}
                  staffing={staffing}
                  vaccines={vaccines}
                  coldChain={coldChain}
                  mobilization={mobilization}
                  transport={transport}
                  budget={budget}
                  supervision={supervision}
                  validationErrors={validationErrors}
                  onEdit={(step) => {
                    setReturnToSummary(true);
                    setActive(step);
                  }}
                />
              )}
              {active === 12 && (
                <Step12 microplanId={microplanId} facilityId={facilityId} />
              )}              </fieldset>
            </CardContent>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-background p-3">
              <Button
                variant="outline"
                onClick={() => setActive(Math.max(1, active - 1))}
                disabled={active === 1 || busy}
                data-testid="button-back"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {saveStatus !== "idle" && (
                  <span
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                    aria-live="polite"
                    data-testid="text-autosave-status"
                  >
                    {saveStatus === "saving" ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        {lastSavedAt
                          ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )}`
                          : "All changes saved"}
                      </>
                    )}
                  </span>
                )}
                <Button
                  variant="outline"
                  onClick={saveDraft}
                  disabled={busy || !facilityId || isReadOnly}
                  data-testid="button-save-draft"
                >
                  <Save className="mr-1 h-4 w-4" /> Save Draft
                </Button>
                {active === 11 ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit || busy || !microplanId || validationErrors.length > 0 || isReadOnly}
                    data-testid="button-submit"
                  >
                    {busy ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1 h-4 w-4" />
                    )}
                    Submit for approval
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={busy || active >= 12 || !facilityId}
                    data-testid="button-next"
                  >
                    {busy ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : null}
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
          )}
        </div>
      </div>
      {/* Saved-microplans list removed to be rendered on its own dedicated page */}
      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setPendingDelete(null);
        }}
        title="Delete saved row?"
        description={
          pendingDelete
            ? `This will permanently delete ${pendingDelete.label} from this microplan. This cannot be undone.`
            : ""
        }
        onConfirm={() => void confirmPendingDelete()}
        isPending={deleteBusy}
      />
      <Dialog
        open={pendingCommunityRemoval !== null}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) {
            setPendingCommunityRemoval(null);
            setRemovalReason("");
          }
        }}
      >
        <DialogContent data-testid="dialog-remove-community">
          <DialogHeader>
            <DialogTitle>
              Remove {pendingCommunityRemoval?.label ?? "this community"} from the catchment?
            </DialogTitle>
            <DialogDescription>
              {pendingCommunityRemoval?.hasServerRow
                ? "This deletes the saved community row from this microplan and remembers the removal so the seed list won't add it back. You can restore it later from the Previously removed panel."
                : "We'll remember this removal so the catchment won't re-add it the next time the microplan is opened. You can restore it later from the Previously removed panel."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="removal-reason">Reason (optional)</Label>
            <Textarea
              id="removal-reason"
              value={removalReason}
              onChange={(e) => setRemovalReason(e.target.value.slice(0, 500))}
              placeholder="e.g. Now served by another facility, abandoned hamlet, duplicate entry..."
              maxLength={500}
              rows={3}
              data-testid="input-removal-reason"
            />
            <p className="text-xs text-muted-foreground">
              Shown alongside the removal in the Previously removed panel so other staff
              understand why this community was taken out.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (deleteBusy) return;
                setPendingCommunityRemoval(null);
                setRemovalReason("");
              }}
              disabled={deleteBusy}
              data-testid="button-cancel-removal"
            >
              Cancel
            </Button>
            <Button
              variant={pendingCommunityRemoval?.hasServerRow ? "destructive" : "default"}
              onClick={() => void confirmCommunityRemoval()}
              disabled={deleteBusy}
              data-testid="button-confirm-removal"
            >
              {deleteBusy ? "Removing..." : "Remove from catchment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Formats the timestamp for the "Previously removed" panel. Falls back to the
// raw value when the timestamp is unparseable so we never silently hide audit
// data the server actually supplied.
export function formatRemovedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// --- Step components ------------------------------------------------------
import {
  NumberField,
  Step1,
  Step2,
  Step2Map,
  Step3,
  Step4,
  AddStaffDialog,
  Step5,
  AddColdChainDialog,
  Step6,
  Step7,
  StepHfcBoard,
  StepChvProfile,
  Step8,
  Step9,
  Step10,
  Tick,
  SummaryCard,
  EmptyState,
  Step11,
  SavedMicroplansPanel,
  Step12
} from './MicroplanWizardSteps';
