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
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Package,
  Building2,
  Shield,
  UserPlus,
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
import { CommunityPopulationIntelligence } from "@/components/ui/population/CommunityPopulationIntelligence";
import { useLinkCommunity, useConvertToCommunity } from "@/hooks/vgie/useVgieApi";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCountryConfig } from "@/lib/countryConfig";
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
import { normalizeStockVaccineName } from "@shared/vaccineSchedule";
import {
  StepDef, STEPS, ANTIGENS, BUDGET_CATEGORIES, FUNDING_SOURCES, WhatToDo,
  ExcludedVillageDetail, currentQuarter, formatRemovedAt
} from './MicroplanWizard';


export function NumberField({
  label,
  value,
  onChange,
  testId,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId?: string;
  suffix?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export function Step1({
  facilityId,
  year,
  coverage,
  setCoverage,
  planType,
  setPlanType,
  planTypeLocked,
  campaignAntigen,
  setCampaignAntigen,
  campaignTargetAge,
  setCampaignTargetAge,
  campaignScope,
  setCampaignScope,
  campaignScopeDetails,
  setCampaignScopeDetails,
}: {
  facilityId: number | null;
  year: number;
  coverage: any;
  setCoverage: (v: any) => void;
  planType: "routine" | "campaign";
  setPlanType: (v: "routine" | "campaign") => void;
  planTypeLocked: boolean;
  campaignAntigen: string;
  setCampaignAntigen: (v: string) => void;
  campaignTargetAge: string;
  setCampaignTargetAge: (v: string) => void;
  campaignScope: "National" | "Sub-national" | "Targeted";
  setCampaignScope: (v: "National" | "Sub-national" | "Targeted") => void;
  campaignScopeDetails: { provinceIds: number[]; districtIds: number[]; facilityIds: number[] };
  setCampaignScopeDetails: (v: { provinceIds: number[]; districtIds: number[]; facilityIds: number[] }) => void;
}) {
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [hasFetchedHistory, setHasFetchedHistory] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<"none" | "filled" | "error">("none");
  const { user } = useAuth();
  const canOverrideDenominator = ["district_manager", "provincial_coordinator", "national_admin", "gis_specialist"].includes(String(user?.role || ""));
  const { data: prefillBundle, isLoading: loadingPrefill } = useQuery<any>({
    queryKey: ["/api/microplans/prefill", facilityId, year],
    queryFn: async () => {
      const res = await fetch(`/api/microplans/prefill/${facilityId}?year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load microplanning prefills");
      return res.json();
    },
    enabled: !!facilityId,
    staleTime: 60_000,
  });
  const populationScenarios = prefillBundle?.populationScenarios ?? [];
  const { data: populationHubRows = [] } = useQuery<PopulationData[]>({
    queryKey: ["/api/population", "wizard-denominator-sources", facilityId],
    queryFn: async () => {
      const res = await fetch(`/api/population?facilityId=${facilityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load Population Hub sources");
      return res.json();
    },
    enabled: !!facilityId,
    staleTime: 60_000,
  });

  const getScenarioTargetInfants = (scenario: any) => {
    const explicitTarget = Number(scenario?.targetInfants ?? 0);
    if (Number.isFinite(explicitTarget) && explicitTarget > 0) return explicitTarget;
    const totalPopulation = Number(scenario?.totalPopulation ?? 0);
    return Number.isFinite(totalPopulation) && totalPopulation > 0 ? Math.round(totalPopulation * 0.035) : 0;
  };

  const populationHubScenarios = useMemo(() => {
    const sourceLabels: Record<string, string> = {
      nso: "NSO authoritative total",
      hmis: "Imported DHIS2/HMIS denominator",
      worldpop: "WorldPop raster estimate",
      survey: "Local survey",
      community_census: "Community census",
    };
    const methodForSource = (source: string) => {
      if (source === "worldpop") return "Spatial population estimate";
      if (source === "hmis") return "Imported programme denominator";
      if (source === "survey" || source === "community_census") return "Direct community count";
      return "Authoritative total";
    };
    const specificity = (row: any) => {
      if (row?.facilityId && !row?.villageId) return 5;
      if (row?.villageId) return 4;
      if (row?.districtId) return 3;
      if (row?.provinceId) return 2;
      return 1;
    };
    const grouped = new Map<string, any[]>();
    for (const row of populationHubRows ?? []) {
      const rowYear = Number(row.year ?? 0);
      if (!Number.isFinite(rowYear) || rowYear > year) continue;
      const source = String(row.source ?? "unknown");
      grouped.set(source, [...(grouped.get(source) ?? []), row]);
    }

    return Array.from(grouped.entries()).flatMap(([source, rows]) => {
      const latestYear = Math.max(...rows.map((row) => Number(row.year ?? 0)).filter(Number.isFinite));
      const latestRows = rows.filter((row) => Number(row.year ?? 0) === latestYear);
      const bestLevel = Math.max(...latestRows.map(specificity));
      const selectedRows = latestRows.filter((row) => specificity(row) === bestLevel);
      if (selectedRows.length === 0) return [];
      const totalPopulation = selectedRows.reduce((sum, row) => sum + (Number(row.totalPopulation) || 0), 0);
      const targetInfants = selectedRows.reduce((sum, row) => sum + (Number(row.under1Population) || 0), 0);
      const underFive = selectedRows.reduce((sum, row) => sum + (Number(row.under5Population) || 0), 0);
      const pregnantWomen = selectedRows.reduce((sum, row) => sum + (Number(row.pregnantWomen) || 0), 0);
      const flags = selectedRows.some((row) => String(row.approvalStatus ?? "draft") !== "approved")
        ? ["Some Population Hub rows are not approved yet"]
        : [];
      if (bestLevel < 5) flags.push("Best available source is not a facility-level aggregate");
      return [{
        id: `population:${source}:${latestYear}`,
        sourceType: source,
        sourceName: sourceLabels[source] ?? source.replace(/_/g, " "),
        method: methodForSource(source),
        scenarioYear: latestYear,
        confidence: source === "nso" || source === "hmis" ? "high" : "medium",
        status: selectedRows.every((row) => String(row.approvalStatus ?? "draft") === "approved") ? "approved" : "draft",
        version: `v${latestYear}`,
        totalPopulation,
        targetInfants: targetInfants || Math.round(totalPopulation * 0.035),
        underFive,
        pregnantWomen,
        metadataSource: sourceLabels[source] ?? source,
        lastUpdated: selectedRows.map((row) => row.updatedAt || row.createdAt).filter(Boolean).sort().pop() ?? null,
        dataQualityFlags: flags,
        populationRecordIds: selectedRows.map((row) => Number(row.id)).filter(Number.isFinite),
      }];
    });
  }, [populationHubRows, year]);

  const derivedPopulationSources = useMemo(() => {
    if (!facilityId || !prefillBundle) return [];
    const sources: any[] = [];
    const communities = Array.isArray(prefillBundle.communities) ? prefillBundle.communities : [];
    const communityTotal = communities.reduce((sum: number, community: any) => {
      const value = [
        community.totalCatchmentPopulation,
        community.griddedPopulation,
        community.population,
        community.estimatedPopulation,
      ]
        .map((v) => Number(v))
        .find((v) => Number.isFinite(v) && v > 0);
      return sum + (value ?? 0);
    }, 0);
    const communityUnderFive = communities.reduce((sum: number, community: any) => {
      const value = Number(community.under5Population ?? community.underFivePopulation ?? 0);
      return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0);
    if (communityTotal > 0) {
      sources.push({
        id: `derived:linked-communities:${year}`,
        sourceType: "community_census",
        sourceName: "Linked community records",
        method: "Sum of linked community population",
        scenarioYear: year,
        confidence: "medium",
        status: "ready",
        version: "current",
        totalPopulation: communityTotal,
        targetInfants: communityTotal,
        underFive: communityUnderFive,
        pregnantWomen: Math.round(communityTotal * 0.04),
        metadataSource: "Linked community records",
        lastUpdated: null,
        dataQualityFlags: ["Derived from communities linked to this facility"],
        populationRecordIds: [],
      });
    }

    const catchmentPopulation = Number(
      prefillBundle.officialCatchment?.populationEstimate ??
      prefillBundle.catchment?.populationEstimate ??
      prefillBundle.facility?.catchmentGridPopulation ??
      0
    );
    if (Number.isFinite(catchmentPopulation) && catchmentPopulation > 0) {
      sources.push({
        id: `derived:facility-catchment:${year}`,
        sourceType: "worldpop",
        sourceName: "Facility catchment estimate",
        method: "Catchment population estimate",
        scenarioYear: year,
        confidence: "medium",
        status: "ready",
        version: "current",
        totalPopulation: catchmentPopulation,
        targetInfants: catchmentPopulation,
        underFive: Number(prefillBundle.officialCatchment?.under5Population ?? 0),
        pregnantWomen: Math.round(catchmentPopulation * 0.04),
        metadataSource: "Facility catchment estimate",
        lastUpdated: prefillBundle.officialCatchment?.updatedAt ?? null,
        dataQualityFlags: ["Derived from the facility catchment estimate"],
        populationRecordIds: [],
      });
    }

    const currentDenominator = Number(coverage.targetInfants ?? 0);
    if (sources.length === 0 && Number.isFinite(currentDenominator) && currentDenominator > 0) {
      sources.push({
        id: `derived:current-denominator:${year}`,
        sourceType: "survey",
        sourceName: "Current prefilled denominator",
        method: "Current wizard prefill",
        scenarioYear: year,
        confidence: "low",
        status: "review",
        version: "current",
        totalPopulation: currentDenominator,
        targetInfants: currentDenominator,
        underFive: 0,
        pregnantWomen: 0,
        metadataSource: "Current wizard prefill",
        lastUpdated: null,
        dataQualityFlags: ["Review this source before submission"],
        populationRecordIds: [],
      });
    }

    return sources;
  }, [coverage.targetInfants, facilityId, prefillBundle, year]);

  const availablePopulationSources = useMemo(() => {
    const byId = new Map<string, any>();
    [...populationScenarios, ...populationHubScenarios, ...derivedPopulationSources].forEach((scenario: any) => {
      if (scenario?.id && !byId.has(scenario.id)) byId.set(scenario.id, scenario);
    });
    return Array.from(byId.values());
  }, [derivedPopulationSources, populationHubScenarios, populationScenarios]);

  const selectedScenario =
    availablePopulationSources.find((s: any) => s.id === coverage.denominatorScenarioId) ??
    availablePopulationSources.find((s: any) => s.id === prefillBundle?.selectedPopulationScenario?.id) ??
    availablePopulationSources[0] ??
    null;
  const populationHubHref = facilityId
    ? `/population?facilityId=${facilityId}&year=${year}&returnTo=${encodeURIComponent("/microplans/routine/new")}`
    : "/population";

  const applyPopulationScenario = (scenario: any) => {
    if (!scenario) return;
    const scenarioTargetInfants = getScenarioTargetInfants(scenario);
    setCoverage((prev: any) => ({
      ...prev,
      denominatorScenarioId: scenario.id,
      denominatorSource: scenario.sourceType,
      denominatorMethod: scenario.method,
      denominatorYear: String(scenario.scenarioYear || year),
      denominatorConfidence: scenario.confidence || "medium",
      denominatorStatus: scenario.status || "draft",
      denominatorVersion: scenario.version || "v1",
      denominatorOverrideReason: scenario.dataQualityFlags?.length ? scenario.dataQualityFlags.join("; ") : "",
      targetInfants: scenarioTargetInfants > 0 ? String(scenarioTargetInfants) : prev.targetInfants || "",
    }));
  };

  useEffect(() => {
    if (!selectedScenario) return;
    if (coverage.denominatorScenarioId) return;
    applyPopulationScenario(selectedScenario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenario?.id]);

  useEffect(() => {
    if (!facilityId) {
      setHistoricalData(null);
      setHistoryStatus("none");
      return;
    }
    const isCoverageEmpty = !coverage.targetInfants && !coverage.dtp1Doses && !coverage.dtp3Doses && !coverage.mcv1Doses && !coverage.mcv2Doses;

    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const queryYear = year - 1;
        const res = await fetch(`/api/facilities/${facilityId}/historical-coverage?year=${queryYear}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setHistoricalData(data);
          if (data.hasHistoricalData || data.targetInfants > 0) {
            setHistoryStatus("filled");
            if (isCoverageEmpty) {
              setCoverage((prev: any) => ({
                ...prev,
                targetInfants: prev.denominatorScenarioId || prev.targetInfants ? prev.targetInfants : String(data.targetInfants || ""),
                dtp1Doses: String(data.dosesByAntigen?.DTP1 || ""),
                dtp3Doses: String(data.dosesByAntigen?.DTP3 || ""),
                mcv1Doses: String(data.dosesByAntigen?.MCV1 || ""),
                mcv2Doses: String(data.dosesByAntigen?.MCV2 || ""),
                dtp1: String(data.coverageRates?.DTP1 || "0"),
                dtp3: String(data.coverageRates?.DTP3 || "0"),
                mcv1: String(data.coverageRates?.MCV1 || "0"),
                mcv2: String(data.coverageRates?.MCV2 || "0"),
              }));
            }
          } else {
            setHistoryStatus("none");
          }
        } else {
          setHistoryStatus("error");
        }
      } catch (err) {
        console.error("Error fetching historical coverage:", err);
        setHistoryStatus("error");
      } finally {
        setLoadingHistory(false);
        setHasFetchedHistory(true);
      }
    }

    loadHistory();
  }, [facilityId, year]);

  const dtp1 = parseFloat(coverage.dtp1 || "0");
  const dtp3 = parseFloat(coverage.dtp3 || "0");
  const mcv1 = parseFloat(coverage.mcv1 || "0");
  const dropDtp = dtp1 > 0 ? Math.round(((dtp1 - dtp3) / dtp1) * 100) : 0;
  const dropMcv = dtp1 > 0 ? Math.round(((dtp1 - mcv1) / dtp1) * 100) : 0;
  const set = (k: string, v: string) => setCoverage({ ...coverage, [k]: v });

  // -- Scope details: fetch provinces + districts ---------------------------
  const needsScopeDetails = planType === "campaign" && campaignScope !== "National";

  const { data: provinces = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/provinces"],
    queryFn: async () => {
      const r = await fetch("/api/provinces", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: needsScopeDetails,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allDistricts = [] } = useQuery<{ id: number; name: string; provinceId: number }[]>({
    queryKey: ["/api/districts"],
    queryFn: async () => {
      const r = await fetch("/api/districts", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: needsScopeDetails,
    staleTime: 5 * 60 * 1000,
  });

  // Filter districts by selected provinces (if any provinces chosen).
  const visibleDistricts = campaignScopeDetails.provinceIds.length > 0
    ? allDistricts.filter((d) => campaignScopeDetails.provinceIds.includes(d.provinceId))
    : allDistricts;

  // Helper toggles
  const toggleId = (
    key: "provinceIds" | "districtIds" | "facilityIds",
    id: number,
  ) => {
    const current = campaignScopeDetails[key];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    const patch = { ...campaignScopeDetails, [key]: next };
    // When a province is deselected, drop any districts that belonged to it.
    if (key === "provinceIds") {
      patch.districtIds = patch.districtIds.filter((did) => {
        const d = allDistricts.find((x) => x.id === did);
        return d ? patch.provinceIds.includes(d.provinceId) : true;
      });
    }
    setCampaignScopeDetails(patch);
  };

  const clearScope = (key: "provinceIds" | "districtIds" | "facilityIds") =>
    setCampaignScopeDetails({ ...campaignScopeDetails, [key]: [] });

  const provincesById = Object.fromEntries(provinces.map((p) => [p.id, p.name]));
  const districtsById = Object.fromEntries(allDistricts.map((d) => [d.id, d.name]));

  return (
    <div className="space-y-3">
      {historyStatus === "filled" && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 text-xs flex items-center gap-2">
          <span>Info: Historical coverage data for last year ({year - 1}) has been auto-filled (target: {historicalData?.targetInfants} infants). You may review and override these values.</span>
        </div>
      )}
      {historyStatus === "none" && hasFetchedHistory && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800 text-xs flex items-center gap-2">
          <span>Warning: No historical coverage found for this facility in the database. Please enter baseline numbers manually.</span>
        </div>
      )}
      {/* Plan type chooser - same template, two flavours. Locked when the
          user entered via /microplans/routine or /microplans/campaigns. */}
      <div className="rounded-md border bg-muted/30 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Plan type</p>
            <p className="text-xs text-muted-foreground">
              {planType === "campaign"
                ? "Supplementary Immunization Activity (SIA / campaign)."
                : "Routine immunization microplan for the quarter."}
            </p>
          </div>
          <Select
            value={planType}
            onValueChange={(v) => setPlanType(v as "routine" | "campaign")}
            disabled={planTypeLocked}
          >
            <SelectTrigger className="w-[220px]" data-testid="select-plan-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="routine">Routine immunization</SelectItem>
              <SelectItem value="campaign">SIA / Campaign</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {planType === "campaign" && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">Antigen</Label>
                <Input
                  value={campaignAntigen}
                  onChange={(e) => setCampaignAntigen(e.target.value)}
                  placeholder="e.g. Polio, Measles"
                  data-testid="input-campaign-antigen"
                />
              </div>
              <div>
                <Label className="text-xs">Target age group</Label>
                <Input
                  value={campaignTargetAge}
                  onChange={(e) => setCampaignTargetAge(e.target.value)}
                  placeholder="e.g. 0-59 months"
                  data-testid="input-campaign-target-age"
                />
              </div>
              <div>
                <Label className="text-xs">Scope</Label>
                <Select
                  value={campaignScope}
                  onValueChange={(v) => {
                    setCampaignScope(v as "National" | "Sub-national" | "Targeted");
                    // Reset details when switching back to National.
                    if (v === "National") {
                      setCampaignScopeDetails({ provinceIds: [], districtIds: [], facilityIds: [] });
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-campaign-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="National"> National</SelectItem>
                    <SelectItem value="Sub-national"> Sub-national (Provinces / Districts)</SelectItem>
                    <SelectItem value="Targeted"> Targeted (Specific facilities)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* -- Sub-national / Targeted scope picker ---------------- */}
            {campaignScope !== "National" && (
              <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                  {campaignScope === "Targeted" ? "Select target facilities" : "Select geographic scope"}
                </p>

                {/* Province multi-select */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">Provinces</Label>
                    {campaignScopeDetails.provinceIds.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => clearScope("provinceIds")}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {/* Selected badges */}
                  {campaignScopeDetails.provinceIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {campaignScopeDetails.provinceIds.map((pid) => (
                        <span
                          key={pid}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                        >
                          {provincesById[pid] ?? `Province ${pid}`}
                          <button
                            type="button"
                            onClick={() => toggleId("provinceIds", pid)}
                            className="hover:text-destructive"
                            aria-label="Remove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <Select
                    value={undefined}
                    onValueChange={(v) => toggleId("provinceIds", Number(v))}
                  >
                    <SelectTrigger className="h-8 text-xs" data-testid="select-province">
                      <SelectValue placeholder={provinces.length === 0 ? "Loading..." : "Add province..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces
                        .filter((p) => !campaignScopeDetails.provinceIds.includes(p.id))
                        .map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* District multi-select - cascades from province selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">
                      Districts
                      {campaignScopeDetails.provinceIds.length > 0 && (
                        <span className="ml-1 text-muted-foreground">(filtered by selected provinces)</span>
                      )}
                    </Label>
                    {campaignScopeDetails.districtIds.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => clearScope("districtIds")}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {campaignScopeDetails.districtIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {campaignScopeDetails.districtIds.map((did) => (
                        <span
                          key={did}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300"
                        >
                          {districtsById[did] ?? `District ${did}`}
                          <button
                            type="button"
                            onClick={() => toggleId("districtIds", did)}
                            className="hover:text-destructive"
                            aria-label="Remove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <Select
                    value={undefined}
                    onValueChange={(v) => toggleId("districtIds", Number(v))}
                  >
                    <SelectTrigger className="h-8 text-xs" data-testid="select-district">
                      <SelectValue placeholder={visibleDistricts.length === 0 ? "Loading..." : "Add district..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleDistricts
                        .filter((d) => !campaignScopeDetails.districtIds.includes(d.id))
                        .map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Summary pill when scope is Sub-national */}
                {campaignScope === "Sub-national" &&
                  (campaignScopeDetails.provinceIds.length > 0 || campaignScopeDetails.districtIds.length > 0) && (
                    <p className="text-xs text-muted-foreground">
                      Campaign will cover{" "}
                      <strong>{campaignScopeDetails.provinceIds.length} province(s)</strong> and{" "}
                      <strong>{campaignScopeDetails.districtIds.length} district(s)</strong>.
                    </p>
                  )}

                {/* Targeted scope: show district-filtered facility note */}
                {campaignScope === "Targeted" && (
                  <p className="text-xs text-muted-foreground italic">
                    Select provinces/districts above to narrow down facilities, then tag specific facilities
                    in Step 2 (Communities) or use the session planner per facility.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <div className="rounded-md border bg-blue-50/60 p-3 text-sm dark:bg-blue-950/20">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">Population Source</p>
            <p className="text-xs text-muted-foreground">
              Choose the population source this plan will use. VaxPlan can offer Population Hub records, linked community totals, or facility catchment estimates.
            </p>
          </div>
          <Badge variant={selectedScenario?.status === "approved" ? "default" : selectedScenario ? "outline" : "destructive"}>
            {loadingPrefill ? "Loading" : selectedScenario?.status === "approved" ? "Approved" : selectedScenario ? "Selected" : "Missing"}
          </Badge>
        </div>
        {!facilityId ? (
          <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
            Select a facility first so VaxPlan can load available population sources.
          </div>
        ) : loadingPrefill ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-24" />
          </div>
        ) : availablePopulationSources.length === 0 ? (
          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p>
              No population source was found for this facility. Open Population Hub to enter or approve all available source data before final submission.
            </p>
            <Button asChild size="sm" variant="outline" className="bg-background">
              <Link href={populationHubHref}>Open Population Hub</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Select population source</Label>
              <Select
                value={selectedScenario?.id || coverage.denominatorScenarioId || ""}
                onValueChange={(id) => {
                  const scenario = availablePopulationSources.find((s: any) => s.id === id);
                  applyPopulationScenario(scenario);
                }}
              >
                <SelectTrigger data-testid="select-denominator-source"><SelectValue placeholder="Select population source" /></SelectTrigger>
                <SelectContent>
                  {availablePopulationSources.map((scenario: any) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      {scenario.sourceName} · {scenario.scenarioYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedScenario && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Source", selectedScenario.sourceName],
                  ["Method", selectedScenario.method],
                  ["Year", selectedScenario.scenarioYear],
                  ["Confidence", selectedScenario.confidence],
                  ["Status", selectedScenario.status],
                  ["Version", selectedScenario.version],
                  ["Updated", selectedScenario.lastUpdated ? new Date(selectedScenario.lastUpdated).toLocaleDateString() : "Not recorded"],
                  ["Target infants", Number(selectedScenario.targetInfants || 0).toLocaleString()],
                  ["Total population", Number(selectedScenario.totalPopulation || 0).toLocaleString()],
                  ["Under 5", Number(selectedScenario.underFive || 0).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md border bg-background p-2">
                    <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
                    <p className="mt-1 font-medium capitalize">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {selectedScenario?.dataQualityFlags?.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                {selectedScenario.dataQualityFlags.join("; ")}
              </div>
            )}

            {canOverrideDenominator ? (
              <div className="rounded-md border bg-background p-3">
                <Label className="text-xs">Override note</Label>
                <Textarea
                  value={coverage.denominatorOverrideReason || ""}
                  onChange={(e) => setCoverage({ ...coverage, denominatorOverrideReason: e.target.value })}
                  placeholder="Explain why this population source was changed or corrected."
                  className="min-h-[64px]"
                  data-testid="textarea-denominator-note"
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Official population details are managed in Population Hub. Facility users can select a source and add planning notes, but metadata changes require district or national review.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="DTP1 %" value={coverage.dtp1} onChange={(v) => set("dtp1", v)} testId="input-dtp1" suffix="%" />
        <NumberField label="DTP3 %" value={coverage.dtp3} onChange={(v) => set("dtp3", v)} testId="input-dtp3" suffix="%" />
        <NumberField label="MCV1 %" value={coverage.mcv1} onChange={(v) => set("mcv1", v)} testId="input-mcv1" suffix="%" />
        <NumberField label="MCV2 %" value={coverage.mcv2} onChange={(v) => set("mcv2", v)} testId="input-mcv2" suffix="%" />
      </div>

      {/* Raw Numbers section - enter doses + denominator, auto-calculates coverage % */}
      <div className="rounded-md border bg-muted/30 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Raw Numbers (optional - auto-calculates coverage %)
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => {
              // Calculate coverage from raw numbers
              const target = parseFloat(coverage.targetInfants || "0");
              const updates: Partial<typeof coverage> = {};
              if (target > 0) {
                const dtp1d = parseFloat(coverage.dtp1Doses || "0");
                const dtp3d = parseFloat(coverage.dtp3Doses || "0");
                const mcv1d = parseFloat(coverage.mcv1Doses || "0");
                const mcv2d = parseFloat(coverage.mcv2Doses || "0");
                if (dtp1d > 0) updates.dtp1 = Math.min(Math.round((dtp1d / target) * 100), 100).toString();
                if (dtp3d > 0) updates.dtp3 = Math.min(Math.round((dtp3d / target) * 100), 100).toString();
                if (mcv1d > 0) updates.mcv1 = Math.min(Math.round((mcv1d / target) * 100), 100).toString();
                if (mcv2d > 0) updates.mcv2 = Math.min(Math.round((mcv2d / target) * 100), 100).toString();
              }
              // SIA coverage
              const siaTgt = parseFloat(coverage.targetSIA || "0");
              const siaVax = parseFloat(coverage.vaccinated || "0");
              if (siaTgt > 0 && siaVax > 0) {
                updates.siaVaccineCoverage = Math.min(Math.round((siaVax / siaTgt) * 100), 100).toString();
              }
              if (Object.keys(updates).length > 0) setCoverage({ ...coverage, ...updates });
            }}
          >
             Calculate Coverage %
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField
            label="Target Infants / Denominator"
            value={coverage.targetInfants}
            onChange={(v) => set("targetInfants", v)}
            testId="input-target-infants"
          />
          <NumberField
            label="DTP1 Doses Given"
            value={coverage.dtp1Doses}
            onChange={(v) => {
              const t = parseFloat(coverage.targetInfants || "0");
              const d = parseFloat(v || "0");
              const pct = t > 0 && d > 0 ? String(Math.min(Math.round((d / t) * 100), 100)) : coverage.dtp1;
              setCoverage({ ...coverage, dtp1Doses: v, dtp1: pct });
            }}
            testId="input-dtp1-doses"
          />
          <NumberField
            label="DTP3 Doses Given"
            value={coverage.dtp3Doses}
            onChange={(v) => {
              const t = parseFloat(coverage.targetInfants || "0");
              const d = parseFloat(v || "0");
              const pct = t > 0 && d > 0 ? String(Math.min(Math.round((d / t) * 100), 100)) : coverage.dtp3;
              setCoverage({ ...coverage, dtp3Doses: v, dtp3: pct });
            }}
            testId="input-dtp3-doses"
          />
          <NumberField
            label="MCV1 Doses Given"
            value={coverage.mcv1Doses}
            onChange={(v) => {
              const t = parseFloat(coverage.targetInfants || "0");
              const d = parseFloat(v || "0");
              const pct = t > 0 && d > 0 ? String(Math.min(Math.round((d / t) * 100), 100)) : coverage.mcv1;
              setCoverage({ ...coverage, mcv1Doses: v, mcv1: pct });
            }}
            testId="input-mcv1-doses"
          />
          <NumberField
            label="MCV2 Doses Given"
            value={coverage.mcv2Doses}
            onChange={(v) => {
              const t = parseFloat(coverage.targetInfants || "0");
              const d = parseFloat(v || "0");
              const pct = t > 0 && d > 0 ? String(Math.min(Math.round((d / t) * 100), 100)) : coverage.mcv2;
              setCoverage({ ...coverage, mcv2Doses: v, mcv2: pct });
            }}
            testId="input-mcv2-doses"
          />
          {planType === "campaign" && (
            <>
              <NumberField
                label="SIA Target Population"
                value={coverage.targetSIA}
                onChange={(v) => set("targetSIA", v)}
                testId="input-target-sia"
              />
              <NumberField
                label="Total Vaccinated (SIA)"
                value={coverage.vaccinated}
                onChange={(v) => {
                  const t = parseFloat(coverage.targetSIA || "0");
                  const d = parseFloat(v || "0");
                  const pct = t > 0 && d > 0 ? String(Math.min(Math.round((d / t) * 100), 100)) : coverage.siaVaccineCoverage;
                  setCoverage({ ...coverage, vaccinated: v, siaVaccineCoverage: pct });
                }}
                testId="input-vaccinated"
              />
              {parseFloat(coverage.siaVaccineCoverage || "0") > 0 && (
                <div className="flex flex-col justify-center">
                  <p className="text-xs text-muted-foreground">SIA Coverage</p>
                  <p className={`text-2xl font-bold ${parseFloat(coverage.siaVaccineCoverage) >= 95 ? "text-green-600" : parseFloat(coverage.siaVaccineCoverage) >= 80 ? "text-amber-600" : "text-destructive"}`}>
                    {parseFloat(coverage.siaVaccineCoverage).toFixed(1)}%
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
        <div className="text-sm">
          Dropout DTP1-&gt;DTP3
          <div className={`text-lg font-semibold ${dropDtp > 10 ? "text-amber-600" : ""}`}>{dropDtp}%</div>
        </div>
        <div className="text-sm">
          Dropout DTP1-&gt;MCV1
          <div className={`text-lg font-semibold ${dropMcv > 10 ? "text-amber-600" : ""}`}>{dropMcv}%</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Stockouts" value={coverage.stockouts} onChange={(v) => set("stockouts", v)} />
        <NumberField label="AEFI cases" value={coverage.aefi} onChange={(v) => set("aefi", v)} />
        <NumberField label="Sessions planned" value={coverage.sessionsPlanned} onChange={(v) => set("sessionsPlanned", v)} />
        <NumberField label="Sessions held" value={coverage.sessionsHeld} onChange={(v) => set("sessionsHeld", v)} />
      </div>
    </div>
  );
}

export function Step2({
  communities,
  setCommunities,
  onDelete,
  facility,
  microplan,
  excludedVillages,
  excludedDetails,
  onRestoreVillage,
  errorRowId,
  errorMessage,
  onClearError,
  targetInfants = 0,
  readOnly,
  facilityChvs = [],
  planType = "routine",
}: {
  communities: any[];
  setCommunities: (v: any[]) => void;
  onDelete: (index: number) => void | Promise<void>;
  facility: Facility | null;
  microplan?: any;
  excludedVillages: Village[];
  excludedDetails: Map<number, ExcludedVillageDetail>;
  onRestoreVillage: (v: Village) => void;
  errorRowId?: string;
  errorMessage?: string;
  onClearError?: () => void;
  targetInfants?: number;
  readOnly?: boolean;
  facilityChvs?: any[];
  planType?: string;
}) {
  const { data: tenant } = useQuery<any>({ queryKey: ["/api/me/tenant"] });
  const countryConfig = getCountryConfig(tenant);
  const settings = tenant?.settings?.demographics || {};
  const under1Ratio = settings.under1 !== undefined ? Number(settings.under1) : 0.04;

  const sumCommunityUnder1 = communities.reduce((acc, c) => acc + Math.round(parseFloat(c.targetPopulation || "0")), 0);
  const denominatorGap = targetInfants - sumCommunityUnder1;
  const diffPercent = targetInfants > 0 ? Math.abs(denominatorGap) / targetInfants : 0;
  const showMismatchWarning = targetInfants > 0 && diffPercent > 0.10;
  const denominatorStatus = targetInfants <= 0
    ? "No Step 1 denominator"
    : denominatorGap === 0
      ? "Balanced"
      : denominatorGap > 0
        ? `${denominatorGap.toLocaleString()} infants not allocated`
        : `${Math.abs(denominatorGap).toLocaleString()} infants over allocated`;
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const errorRowRef = useRef<HTMLInputElement | null>(null);

  const [showGaps, setShowGaps] = useState(false);
  const [gapGeojson, setGapGeojson] = useState<any>(null);
  const [loadingGaps, setLoadingGaps] = useState(false);
  const [flaggingUncovered, setFlaggingUncovered] = useState(false);
  // Map draw mode: 'none' | 'facility' (draw facility catchment) | 'community' (draw community circle)
  const [drawMode, setDrawMode] = useState<"none" | "facility" | "community">("none");
  const [facilityPolygon, setFacilityPolygon] = useState<any>(null);

  const { data: catchment } = useQuery<any>({
    queryKey: [`/api/facilities/${facility?.id}/catchments`],
    enabled: !!facility?.id,
    queryFn: async () => {
      if (!facility?.id) return null;
      const res = await fetch(`/api/facilities/${facility.id}/catchments`, { credentials: "include" });
      if (!res.ok) return null;
      const arr = await res.json();
      return arr.length > 0 ? arr[0] : null;
    }
  });

  const { data: unmappedSuggestions, refetch: refetchUnmapped } = useQuery<any[]>({
    queryKey: ["/api/villages/suggest-unmapped", facility?.id],
    enabled: !!facility?.id,
    queryFn: async () => {
      const res = await fetch(`/api/villages/suggest-unmapped?facilityId=${facility?.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Fetch all communities in facility catchment (covered + uncovered)
  const { data: catchmentCommunities, refetch: refetchCatchment, isLoading: loadingCatchment } = useQuery<any>({
    queryKey: ["/api/spatial/uncovered-communities", facility?.id, communities.length],
    enabled: !!facility?.id,
    retry: 1,
    staleTime: 30000,
    queryFn: async () => {
      // Updated search radius to 25km per user request (was 15km originally)
      const params = new URLSearchParams({ facilityId: String(facility?.id), radiusKm: "25" });
      if (microplan?.id) params.set("microplanId", String(microplan.id));
      // Abort after 20 seconds to prevent the panel from spinning forever if
      // the PostGIS spatial query is slow or the connection is poor.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch(`/api/spatial/uncovered-communities?${params}`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) return null;
        return res.json();
      } catch {
        // Network error or timeout - return null so the UI shows "failed to load"
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    },
  });

  const localCoverageCommunities = useMemo(() => {
    return communities.map((c, index) => ({
      id: c.villageId ?? c.rowId ?? `local-${index}`,
      name: c.name || `Community ${index + 1}`,
      settlementType: c.settlementType || c.type || "village",
      distanceKm: null,
      gridPop: Number(c.gridPop || 0),
      hmisNsoPop: Number(c.surveyPop || c.totalCatchmentPopulation || 0),
      targetPopulation: Number(c.targetPopulation || 0),
      highRisk: !!c.highRisk,
      covered: true,
      latitude: c.latitude != null ? Number(c.latitude) : null,
      longitude: c.longitude != null ? Number(c.longitude) : null,
      localFallback: true,
    }));
  }, [communities]);
  const coverageRows = catchmentCommunities?.communities?.length > 0
    ? catchmentCommunities.communities
    : localCoverageCommunities;
  const coverageTotal = catchmentCommunities?.total ?? coverageRows.length;
  const coverageUncovered = catchmentCommunities?.uncoveredCount ?? coverageRows.filter((c: any) => !c.covered).length;
  const usingLocalCoverageFallback = !catchmentCommunities?.communities?.length && localCoverageCommunities.length > 0;

  useEffect(() => {
    if (showGaps && facility?.id) {
      setLoadingGaps(true);
      fetch(`/api/spatial/coverage-gaps?level=district&code=${encodeURIComponent(facility.districtId || '')}`, { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          setGapGeojson(data.gapGeoJSON);
        })
        .catch(err => console.error("Failed to load gaps:", err))
        .finally(() => setLoadingGaps(false));
    } else {
      setGapGeojson(null);
    }
  }, [showGaps, facility?.id, facility?.districtId]);

  function checkBoundaryOverlap(newBoundary: any, ignoreIdx?: number): string | null {
    if (!newBoundary) return null;
    try {
      let poly1: any;
      if (newBoundary.type === "Polygon") {
        poly1 = turfPolygon(newBoundary.coordinates);
      } else if (newBoundary.type === "MultiPolygon") {
        poly1 = turfMultiPolygon(newBoundary.coordinates);
      } else {
        return null;
      }

      for (let i = 0; i < communities.length; i++) {
        if (ignoreIdx !== undefined && i === ignoreIdx) continue;
        const other = communities[i];
        if (!other.boundary) continue;

        let poly2: any;
        if (other.boundary.type === "Polygon") {
          poly2 = turfPolygon(other.boundary.coordinates);
        } else if (other.boundary.type === "MultiPolygon") {
          poly2 = turfMultiPolygon(other.boundary.coordinates);
        } else {
          continue;
        }

        const overlap = turfIntersect({
          type: "FeatureCollection",
          features: [
            { type: "Feature", properties: {}, geometry: newBoundary },
            { type: "Feature", properties: {}, geometry: other.boundary }
          ]
        });

        if (overlap) {
          return other.name || `Community #${i + 1}`;
        }
      }
    } catch (err) {
      console.error("Turf overlap check error:", err);
    }
    return null;
  }

  // Scroll the flagged community into view and focus its population input
  // whenever a new validation error points at this step.
  useEffect(() => {
    if (errorRowId && errorRowRef.current) {
      errorRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      errorRowRef.current.focus();
    }
  }, [errorRowId]);
  const { toast } = useToast();
  const linkCommunityMutation = useLinkCommunity();
  const convertToCommunityMutation = useConvertToCommunity();
  const [selectedLinkCommunityMap, setSelectedLinkCommunityMap] = useState<Record<number, number>>({});
  const [estimate, setEstimate] = useState<
    | {
        index: number;
        lat: number;
        lng: number;
        radiusKm: number;
        status: "loading" | "done";
        progress: { done: number; total: number };
        streamingCells: CatchmentCell[];
        result?: CatchmentEstimateResult;
      }
    | null
  >(null);
  const estimateAbortRef = useRef<AbortController | null>(null);
  const estimateFlushTimerRef = useRef<number | null>(null);

  type BulkRowStatus =
    | { state: "pending" }
    | { state: "running" }
    | { state: "ok"; total: number }
    | { state: "nodata" }
    | { state: "error"; message: string }
    | { state: "skipped" };
  const [bulkEstimate, setBulkEstimate] = useState<
    | {
        radiusKm: number;
        phase: "confirm" | "running" | "done";
        rows: Array<{ index: number; name: string; status: BulkRowStatus }>;
      }
    | null
  >(null);
  const bulkAbortRef = useRef<AbortController | null>(null);

  const update = (i: number, patch: any) => {
    if (patch.boundary) {
      const overlapName = checkBoundaryOverlap(patch.boundary, i);
      if (overlapName) {
        toast({
          title: "Boundary Overlap Detected",
          description: `The boundary for this community overlaps with "${overlapName}". Overlapping community boundaries are not allowed.`,
          variant: "destructive"
        });
        return;
      }
    }
    const next = [...communities];
    const merged = { ...next[i], ...patch };
    // Auto-update target when gridPop or surveyPop changes (but not when targetPopulation is explicitly set)
    if (("gridPop" in patch || "surveyPop" in patch) && !("targetPopulation" in patch)) {
      const gridVal = parseInt(merged.gridPop || "0", 10);
      const surveyVal = parseInt(merged.surveyPop || "0", 10);
      const best = Math.max(gridVal, surveyVal);
      if (best > 0) merged.targetPopulation = String(Math.round(best * under1Ratio));
    }
    next[i] = merged;
    setCommunities(next);
    // Editing the flagged row clears the highlight so the inline message
    // doesn't linger once the planner has acted on it.
    if (errorRowId && `pop-${i}` === errorRowId) onClearError?.();
  };

  const [showFocalChvForm, setShowFocalChvForm] = useState(false);
  const [savingFocalChv, setSavingFocalChv] = useState(false);
  const [focalChvForm, setFocalChvForm] = useState({
    name: "",
    contactPhone: "",
    nrc: "",
    gender: "female",
  });

  const normalizeText = (value: unknown) => String(value ?? "").trim().toLowerCase();
  const selectedCommunity = selectedIdx !== null ? communities[selectedIdx] : null;
  const safeFacilityChvs = Array.isArray(facilityChvs) ? facilityChvs : [];
  const matchedCommunityChvs = selectedCommunity
    ? safeFacilityChvs.filter((chv: any) => {
        if (!chv) return false;
        if (selectedCommunity.villageId != null && Number(chv.villageId) === Number(selectedCommunity.villageId)) return true;
        return normalizeText(chv.communityUnit) === normalizeText(selectedCommunity.name);
      })
    : [];
  const matchedCommunityChvIds = new Set(matchedCommunityChvs.map((chv: any) => String(chv.id)));
  const communityChvOptions = selectedCommunity
    ? [
        ...matchedCommunityChvs,
        ...safeFacilityChvs.filter((chv: any) => chv && !matchedCommunityChvIds.has(String(chv.id))),
      ]
    : safeFacilityChvs;

  function assignFocalChv(index: number, chv: any) {
    update(index, {
      focalChvId: chv.id,
      focalPersonName: chv.name ?? chv.fullName ?? "",
      focalPersonPhone: chv.contactPhone ?? chv.phone ?? "",
      focalPersonSource: "CHV registry",
      communicationContactMade: !!(chv.contactPhone ?? chv.phone),
    });
  }

  async function addFocalChv() {
    if (selectedIdx === null || !facility?.id) return;
    if (!focalChvForm.name.trim()) {
      toast({ title: "CHV name is required", variant: "destructive" });
      return;
    }
    const routinePlan = planType !== "campaign";
    if (routinePlan && focalChvForm.nrc.trim()) {
      const idVal = countryConfig.formatSpec.validateId(focalChvForm.nrc.trim());
      if (!idVal.valid) {
        toast({
          title: `${countryConfig.idShortLabel || "ID"} format invalid`,
          description: idVal.message,
          variant: "destructive",
        });
        return;
      }
    }
    setSavingFocalChv(true);
    try {
      const community = communities[selectedIdx];
      const body = {
        name: focalChvForm.name.trim(),
        fullName: focalChvForm.name.trim(),
        nrc: focalChvForm.nrc.trim() || null,
        gender: focalChvForm.gender,
        contactPhone: focalChvForm.contactPhone.trim() || null,
        phone: focalChvForm.contactPhone.trim() || null,
        educationLevel: "Secondary",
        trainingStatus: "trained",
        campaignRole: "social_mobilizer",
        communityUnit: community?.name || "",
        villageId: community?.villageId ? Number(community.villageId) : null,
        active: true,
        employmentStatus: "Active - In-service",
      };
      const created = await apiRequest<any>(
        "POST",
        `/api/facilities/${facility.id}/chvs?planType=${planType}`,
        body,
      );
      assignFocalChv(selectedIdx, created);
      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${facility.id}/chvs`, planType] });
      queryClient.invalidateQueries({ queryKey: ["/api/facilities", facility.id, "chvs", planType] });
      setFocalChvForm({ name: "", contactPhone: "", nrc: "", gender: "female" });
      setShowFocalChvForm(false);
      toast({ title: "CHV added and assigned" });
    } catch (e: any) {
      toast({
        title: "Could not add CHV",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setSavingFocalChv(false);
    }
  }
  const runEstimate = async (index: number, radiusKm: number) => {
    const c = communities[index];
    if (!c) return;
    const lat = parseFloat(c.latitude);
    const lng = parseFloat(c.longitude);
    if (isNaN(lat) || isNaN(lng)) return;
    estimateAbortRef.current?.abort();
    const ctrl = new AbortController();
    estimateAbortRef.current = ctrl;
    if (estimateFlushTimerRef.current != null) {
      clearTimeout(estimateFlushTimerRef.current);
      estimateFlushTimerRef.current = null;
    }
    setEstimate({
      index,
      lat,
      lng,
      radiusKm,
      status: "loading",
      progress: { done: 0, total: 0 },
      streamingCells: [],
    });
    // Buffer streaming cells and flush at most every ~100ms so a large
    // catchment doesn't trigger thousands of React renders.
    const cellBuffer: CatchmentCell[] = [];
    const flush = () => {
      estimateFlushTimerRef.current = null;
      if (ctrl.signal.aborted || cellBuffer.length === 0) return;
      const snapshot = cellBuffer.slice();
      setEstimate((prev) =>
        prev && prev.index === index && prev.radiusKm === radiusKm && prev.status === "loading"
          ? { ...prev, streamingCells: snapshot }
          : prev,
      );
    };
    const scheduleFlush = () => {
      if (estimateFlushTimerRef.current != null) return;
      estimateFlushTimerRef.current = window.setTimeout(flush, 100);
    };
    const result = await estimateCatchmentPopulation({
      lat,
      lng,
      radiusKm,
      villageId: c.villageId,
      signal: ctrl.signal,
      onProgress: (done, total) => {
        setEstimate((prev) =>
          prev && prev.index === index && prev.radiusKm === radiusKm
            ? { ...prev, progress: { done, total } }
            : prev,
        );
      },
      onCell: (cell) => {
        cellBuffer.push({ ...cell });
        scheduleFlush();
      },
    });
    if (estimateFlushTimerRef.current != null) {
      clearTimeout(estimateFlushTimerRef.current);
      estimateFlushTimerRef.current = null;
    }
    if (ctrl.signal.aborted) return;
    setEstimate((prev) =>
      prev && prev.index === index && prev.radiusKm === radiusKm
        ? { ...prev, status: "done", result, streamingCells: [] }
        : prev,
    );
  };

  const [inlineLoadingIndex, setInlineLoadingIndex] = useState<number | null>(null);

  const handleInlineFetch = async (index: number) => {
    const c = communities[index];
    if (!c) return;
    const lat = parseFloat(c.latitude);
    const lng = parseFloat(c.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    setInlineLoadingIndex(index);
    try {
      const result = await estimateCatchmentPopulation({
        lat,
        lng,
        radiusKm: 2,
        villageId: c.villageId,
      });

      if (result.status === "ok") {
        const gridPop = String(result.total);
        const gridVal = result.total;
        const targetPop = String(Math.round(gridVal * under1Ratio));
        update(index, {
          gridPop,
          targetPopulation: targetPop,
          source: "worldpop",
        });
        toast({
          title: "Grid estimate applied",
          description: `Grid Pop set to ${gridVal.toLocaleString()} from WorldPop (2 km radius). Target = ${parseInt(targetPop).toLocaleString()}.`,
        });
      } else {
        toast({
          title: "Estimation failed",
          description: result.status === "nodata" ? "No population data available for this area." : (result as any).message || "No population data available.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Estimation error",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setInlineLoadingIndex(null);
    }
  };

  const openEstimate = (index: number) => {
    runEstimate(index, 2);
  };
  const closeEstimate = () => {
    estimateAbortRef.current?.abort();
    estimateAbortRef.current = null;
    if (estimateFlushTimerRef.current != null) {
      clearTimeout(estimateFlushTimerRef.current);
      estimateFlushTimerRef.current = null;
    }
    setEstimate(null);
  };
  const acceptEstimate = () => {
    if (!estimate || estimate.result?.status !== "ok") return;
    const gridPop = String(estimate.result.total);
    const gridVal = estimate.result.total;
    const targetPop = String(Math.round(gridVal * under1Ratio));
    update(estimate.index, {
      gridPop,
      targetPopulation: targetPop,
      source: "worldpop",
    });
    toast({
      title: "Grid estimate applied",
      description: `Grid Pop set to ${gridVal.toLocaleString()} from WorldPop (${estimate.radiusKm} km radius). Target = ${parseInt(targetPop).toLocaleString()}.`,
    });
    closeEstimate();
  };
  const openBulkEstimate = () => {
    const rows = communities
      .map((c, index) => {
        const lat = parseFloat(c.latitude);
        const lng = parseFloat(c.longitude);
        const hasCoords = !isNaN(lat) && !isNaN(lng);
        return {
          index,
          name: c.name || `Community ${index + 1}`,
          status: hasCoords
            ? ({ state: "pending" } as BulkRowStatus)
            : ({ state: "skipped" } as BulkRowStatus),
        };
      });
    setBulkEstimate({ radiusKm: 2, phase: "confirm", rows });
  };
  const closeBulkEstimate = () => {
    bulkAbortRef.current?.abort();
    bulkAbortRef.current = null;
    setBulkEstimate(null);
  };
  const runBulkEstimate = async () => {
    if (!bulkEstimate) return;
    const radiusKm = bulkEstimate.radiusKm;
    const eligible = bulkEstimate.rows.filter((r) => r.status.state !== "skipped");
    if (eligible.length === 0) {
      setBulkEstimate({ ...bulkEstimate, phase: "done" });
      return;
    }
    estimateAbortRef.current?.abort();
    estimateAbortRef.current = null;
    setEstimate(null);
    bulkAbortRef.current?.abort();
    const ctrl = new AbortController();
    bulkAbortRef.current = ctrl;

    setBulkEstimate({
      ...bulkEstimate,
      phase: "running",
      rows: bulkEstimate.rows.map((r) =>
        r.status.state === "skipped" ? r : { ...r, status: { state: "pending" } },
      ),
    });

    const updateRow = (index: number, status: BulkRowStatus) => {
      setBulkEstimate((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((r) => (r.index === index ? { ...r, status } : r)),
            }
          : prev,
      );
    };
    const successes = new Map<number, number>();

    const queue = [...eligible];
    const concurrency = Math.min(2, queue.length);
    let okCount = 0;
    let nodataCount = 0;
    let errorCount = 0;
    const worker = async () => {
      while (queue.length > 0) {
        if (ctrl.signal.aborted) return;
        const row = queue.shift()!;
        const c = communities[row.index];
        if (!c) continue;
        const lat = parseFloat(c.latitude);
        const lng = parseFloat(c.longitude);
        if (isNaN(lat) || isNaN(lng)) {
          updateRow(row.index, { state: "skipped" });
          continue;
        }
        updateRow(row.index, { state: "running" });
        try {
          const result = await estimateCatchmentPopulation({
            lat,
            lng,
            radiusKm,
            villageId: c.villageId,
            signal: ctrl.signal,
          });
          if (ctrl.signal.aborted) return;
          if (result.status === "ok") {
            successes.set(row.index, result.total);
            updateRow(row.index, { state: "ok", total: result.total });
            okCount++;
          } else if (result.status === "nodata") {
            updateRow(row.index, { state: "nodata" });
            nodataCount++;
          } else {
            updateRow(row.index, { state: "error", message: result.message });
            errorCount++;
          }
        } catch (err: any) {
          if (ctrl.signal.aborted) return;
          updateRow(row.index, {
            state: "error",
            message: err?.message || "Failed",
          });
          errorCount++;
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    if (ctrl.signal.aborted) return;
    if (successes.size > 0) {
      const next = communities.map((c, i) => {
        const total = successes.get(i);
        if (total == null) return c;
        const target = Math.round(total * under1Ratio);
        return { ...c, gridPop: String(total), targetPopulation: String(target), source: "worldpop" as const };
      });
      setCommunities(next);
    }
    setBulkEstimate((prev) => (prev ? { ...prev, phase: "done" } : prev));
    const allFailed = okCount === 0 && errorCount > 0;
    toast({
      title: allFailed
        ? "Bulk estimate failed"
        : errorCount > 0
        ? "Bulk estimate finished with errors"
        : "Bulk estimate complete",
      description: `${okCount} updated - ${nodataCount} no-data - ${errorCount} failed`,
      variant: allFailed ? "destructive" : undefined,
    });
  };

  const add = (lat?: number, lng?: number) => {
    const newRow: any = {
      name: "",
      type: "village",
      targetPopulation: "0",
      source: "nso",
      strategy: "static",
      rowId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    if (lat != null && lng != null) {
      newRow.latitude = lat.toFixed(6);
      newRow.longitude = lng.toFixed(6);
      newRow.latLngDirty = true;
    }
    const next = [...communities, newRow];
    setCommunities(next);
    setSelectedIdx(next.length - 1);
  };

  return (
    <div className="space-y-4">
      {showMismatchWarning && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800 text-xs flex items-center gap-2">
          <span>Warning: Sum of community under-1 targets ({sumCommunityUnder1} infants) differs from facility target infants in Step 1 ({targetInfants} infants) by more than 10%. Please verify targets.</span>
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Map + Table - 3 columns */}
        <div className="xl:col-span-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Click anywhere on the map to drop a new community. Drag pins to fine-tune coordinates.
              Pin numbers match the rows below.
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Draw catchment polygon */}
              <Button
                size="sm"
                variant={drawMode === "facility" ? "default" : "outline"}
                onClick={() => setDrawMode(drawMode === "facility" ? "none" : "facility")}
                title="Draw facility catchment polygon on map"
                disabled={readOnly}
              >
                <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polygon points="3,12 9,3 21,3 21,21 3,21" /><circle cx="3" cy="12" r="1.5" fill="currentColor" /><circle cx="9" cy="3" r="1.5" fill="currentColor" /><circle cx="21" cy="3" r="1.5" fill="currentColor" /><circle cx="21" cy="21" r="1.5" fill="currentColor" /><circle cx="3" cy="21" r="1.5" fill="currentColor" /></svg>
                {drawMode === "facility" ? "Stop Drawing" : "Draw Catchment"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={openBulkEstimate}
                disabled={
                  readOnly ||
                  communities.filter(
                    (c) =>
                      c.latitude &&
                      c.longitude &&
                      !isNaN(parseFloat(c.latitude)) &&
                      !isNaN(parseFloat(c.longitude)),
                  ).length === 0
                }
                title="Estimate population from WorldPop for every pinned community"
                data-testid="button-estimate-all-from-map"
              >
                <MapIcon className="mr-1 h-4 w-4" /> Estimate all from map
              </Button>
              <Button size="sm" variant="outline" onClick={() => add()} data-testid="button-add-community" disabled={readOnly}>
                <Plus className="mr-1 h-4 w-4" /> Add community
              </Button>
            </div>
          </div>

          {drawMode === "facility" && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-primary/10 border border-primary/20 text-primary">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              <span><strong>Draw Catchment Mode:</strong> Click on the map to place polygon vertices. Click the first point again (or press Escape) to close and save the catchment polygon.</span>
            </div>
          )}

          <Step2Map
            facility={facility}
            communities={communities}
            selectedIdx={selectedIdx}
            drawMode={drawMode}
            onMapClick={(lat, lng) => add(lat, lng)}
            onPinDrag={(i, lat, lng) => {
              update(i, {
                latitude: lat.toFixed(6),
                longitude: lng.toFixed(6),
                latLngDirty: true,
              });
            }}
            onPinClick={(i) => setSelectedIdx(i)}
            onPolygonDrawn={(geojson) => {
              setFacilityPolygon(geojson);
              setDrawMode("none");
              toast({ title: "Catchment Polygon Saved", description: "Facility catchment boundary drawn. Population will be estimated from this polygon." });
            }}
            catchment={catchment}
            gapGeojson={gapGeojson}
            showGaps={showGaps}
            facilityPolygon={facilityPolygon}
            catchmentPreview={
              estimate
                ? {
                    lat: estimate.lat,
                    lng: estimate.lng,
                    radiusKm: estimate.radiusKm,
                    cells:
                      estimate.status === "done" && estimate.result
                        ? (estimate.result as any).cells ?? null
                        : estimate.streamingCells.length > 0
                          ? estimate.streamingCells
                          : null,
                  }
                : null
            }
            readOnly={readOnly}
          />

          {excludedVillages.length > 0 && (
            <div
              className="rounded-md border border-dashed bg-muted/30 p-3"
              data-testid="section-previously-removed"
            >
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Previously removed ({excludedVillages.length})
              </div>
              <TooltipProvider delayDuration={200}>
                <ul className="space-y-2">
                  {excludedVillages.map((v) => {
                    const detail = excludedDetails.get(v.id);
                    const removedAtLabel = formatRemovedAt(detail?.removedAt ?? null);
                    const removedBy = detail?.removedByName?.trim();
                    const meta: string[] = [];
                    if (removedAtLabel) meta.push(`Removed ${removedAtLabel}`);
                    if (removedBy) meta.push(`by ${removedBy}`);
                    const metaLine = meta.join(" ");
                    const reason = detail?.reason?.trim();
                    return (
                      <li
                        key={v.id}
                        className="flex flex-wrap items-center gap-2"
                        data-testid={`excluded-village-${v.id}`}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRestoreVillage(v)}
                          data-testid={`button-restore-village-${v.id}`}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Add back {v.name}
                        </Button>
                        {metaLine && (
                          <span
                            className="text-xs text-muted-foreground"
                            data-testid={`excluded-village-meta-${v.id}`}
                          >
                            {metaLine}
                          </span>
                        )}
                        {reason && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center text-muted-foreground hover:text-foreground"
                                aria-label={`Reason: ${reason}`}
                                data-testid={`excluded-village-reason-${v.id}`}
                              >
                                <HelpCircle className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs font-semibold">Reason</p>
                              <p className="text-xs">{reason}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </TooltipProvider>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  {/* Original code:
                  <th className="p-2 w-8">#</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Type</th>
                  <th className="p-2" title="WorldPop / gridded raster population estimate">WorldPop</th>
                  <th className="p-2" title="NSO / HMIS / Survey / Census population (manual entry)">Survey/HMIS/NSO Pop </th>
                  <th className="p-2">Target Pop</th>
                  <th className="p-2">Source</th>
                  <th className="p-2">Strategy</th>
                  <th className="p-2">Coordinates</th>
                  <th className="p-2"></th>
                  */}
                  <th className="p-2 w-8">#</th>
                  <th className="p-2 min-w-[150px] md:min-w-[200px]">Name</th>
                  <th className="p-2 w-28">Type</th>
                  <th className="p-2" title="WorldPop / gridded raster population estimate">WorldPop</th>
                  <th className="p-2" title="NSO / HMIS / Survey / Census population (manual entry)">Survey/HMIS/NSO Pop </th>
                  <th className="p-2">Target Pop (&lt;1 yr)</th>
                  <th className="p-2 w-28">Source</th>
                  <th className="p-2 w-28">Strategy</th>
                  <th className="p-2 min-w-[150px]">Coordinates</th>
                  <th className="p-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {communities.map((c, i) => {
                  const hasCoords =
                    c.latitude && c.longitude &&
                    !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude));
                  const isError = errorRowId != null && `pop-${i}` === errorRowId;
                  return (
                    <tr
                      key={c.rowId}
                      className={`border-b cursor-pointer ${
                        selectedIdx === i ? "bg-primary/5" : ""
                      }`}
                      onClick={() => setSelectedIdx(i)}
                      data-testid={`row-community-${i}`}
                    >
                      <td className="p-1 text-center text-xs font-mono text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="p-1">
                        {/* Original code:
                        <Input
                          value={c.name}
                          onChange={(e) => update(i, { name: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                        />
                        */}
                        <div className="flex flex-col gap-1">
                          <Input
                            className="min-w-[150px] md:min-w-[200px]"
                            value={c.name}
                            onChange={(e) => update(i, { name: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex gap-1 items-center px-1">
                            {c.villageId ? (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1 py-0.5 rounded">
                                Registered Community
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1 py-0.5 rounded">
                                Draft/Unregistered
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-1">
                        {/* Original code:
                        <Select value={c.type} onValueChange={(v) => update(i, { type: v })}>
                          <SelectTrigger onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                        */}
                        <Select value={c.type} onValueChange={(v) => update(i, { type: v })}>
                          <SelectTrigger className="w-28" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="village">Village</SelectItem>
                            <SelectItem value="hamlet">Hamlet</SelectItem>
                            <SelectItem value="idp">IDP camp</SelectItem>
                            <SelectItem value="school">School</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      {/* Grid Pop - WorldPop/gridded estimate */}
                      <td className="p-1">
                        <div className="flex items-center gap-1">
                          {inlineLoadingIndex === i ? (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono px-2 py-1 bg-muted rounded">
                              <Loader2 className="h-3 w-3 animate-spin" /> Fetching...
                            </span>
                          ) : (
                            <>
                              <span className={`text-xs font-mono px-2 py-1 rounded min-w-[52px] text-center ${
                                c.gridPop && c.gridPop !== "0"
                                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                                  : "text-muted-foreground"
                              }`}>
                                {c.gridPop && c.gridPop !== "0" ? Number(c.gridPop).toLocaleString() : "-"}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[10px]"
                                disabled={!hasCoords}
                                title={hasCoords ? "Estimate grid population from WorldPop" : "Drop a pin first"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInlineFetch(i);
                                }}
                                data-testid={`button-estimate-from-map-${i}`}
                              >
                                Fetch
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                      {/* Survey Pop - NSO / HMIS / Census manual entry */}
                      <td className="p-1">
                        <Input
                          ref={isError ? errorRowRef : undefined}
                          type="number"
                          className={`w-24 ${isError ? "border-destructive ring-1 ring-destructive" : ""}`}
                          placeholder="Enter"
                          value={c.surveyPop ?? ""}
                          onChange={(e) => update(i, { surveyPop: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          title="Enter population from NSO / HMIS / Survey / Census"
                        />
                        {isError && errorMessage && (
                          <p className="mt-1 text-xs text-destructive" data-testid="community-row-error">{errorMessage}</p>
                        )}
                      </td>
                      {/* Target Pop - best available: manual override, else max(gridPop, surveyPop) */}
                      <td className="p-1">
                        <Input
                          type="number"
                          className="w-20 font-semibold"
                          value={c.targetPopulation}
                          onChange={(e) => update(i, { targetPopulation: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          title="Final target population (auto-set from Grid or Survey pop, editable)"
                        />
                      </td>
                      <td className="p-1">
                        {/* Original code:
                        <Select value={c.source} onValueChange={(v) => update(i, { source: v })}>
                          <SelectTrigger onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                        */}
                        <Select value={c.source} onValueChange={(v) => update(i, { source: v })}>
                          <SelectTrigger className="w-28" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nso">NSO</SelectItem>
                            <SelectItem value="hmis">HMIS</SelectItem>
                            <SelectItem value="worldpop">WorldPop</SelectItem>
                            <SelectItem value="survey">Survey</SelectItem>
                            <SelectItem value="community_census">Community census</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-1">
                        {/* Original code:
                        <Select value={c.strategy} onValueChange={(v) => update(i, { strategy: v })}>
                          <SelectTrigger onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                        */}
                        <Select value={c.strategy} onValueChange={(v) => update(i, { strategy: v })}>
                          <SelectTrigger className="w-28" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="static">Fixed</SelectItem>
                            <SelectItem value="outreach">Outreach</SelectItem>
                            <SelectItem value="mobile">Mobile</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-1 text-xs font-mono">
                        {hasCoords ? (
                          <span className="text-foreground" data-testid={`text-coords-${i}`}>
                            {parseFloat(c.latitude).toFixed(4)}, {parseFloat(c.longitude).toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">no pin</span>
                        )}
                      </td>
                      <td className="p-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(i);
                          }}
                          data-testid={`button-delete-community-${i}`}
                          aria-label="Delete community"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {communities.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-4 text-center text-sm text-muted-foreground">
                      No communities yet - click on the map to drop one, or use Add community.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-4">
          {/* Coverage Gap Panel - full community list */}
        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                Coverage Gap Analysis
                {coverageTotal > 0 && (
                  <span className="text-[10px] font-normal text-muted-foreground">
                    ({coverageUncovered} uncovered / {coverageTotal} total)
                  </span>
                )}
              </span>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => refetchCatchment()} title="Refresh">
                <Loader2 className={`h-3.5 w-3.5 ${loadingCatchment ? "animate-spin" : ""} text-primary`} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-gaps"
                  checked={showGaps}
                  onCheckedChange={(v) => setShowGaps(!!v)}
                />
                <Label htmlFor="show-gaps" className="text-xs font-medium cursor-pointer select-none">
                  Highlight Uncovered Areas on Map
                </Label>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="text-[10px] h-7 px-2"
                onClick={async () => {
                  try {
                    setFlaggingUncovered(true);
                    const res = await fetch("/api/spatial/flag-uncovered", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                    });
                    if (!res.ok) throw new Error("Failed to dispatch alerts");
                    const data = await res.json();
                    toast({
                      title: "Alerts Dispatched",
                      description: `Flagged ${data.flaggedCount} uncovered settlements.`,
                    });
                  } catch (err: any) {
                    toast({ title: "Failed", description: err.message, variant: "destructive" });
                  } finally {
                    setFlaggingUncovered(false);
                  }
                }}
                disabled={flaggingUncovered || readOnly}
              >
                {flaggingUncovered ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Flagging...</> : "Flag to District"}
              </Button>
            </div>

            <div className={`rounded-md border p-2 text-[11px] ${denominatorGap === 0 ? "border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300" : "border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Denominator reconciliation</span>
                <span>{denominatorStatus}</span>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-muted-foreground">
                <span>Step 1: {targetInfants.toLocaleString()}</span>
                <span>Allocated: {sumCommunityUnder1.toLocaleString()}</span>
                <span>Communities: {communities.length.toLocaleString()}</span>
              </div>
            </div>
            {usingLocalCoverageFallback && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-[11px] text-muted-foreground">
                Showing planned communities from this microplan while spatial gap results load or are unavailable.
              </div>
            )}

            {/* Full community table */}
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded border border-border/40">
              <table className="w-full text-[10px]">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="p-1.5 text-left font-semibold">Community</th>
                    <th className="p-1.5 text-right font-semibold">Dist (km)</th>
                    <th className="p-1.5 text-right font-semibold">WorldPop</th>
                    <th className="p-1.5 text-right font-semibold">Official pop</th>
                    <th className="p-1.5 text-center font-semibold">Status</th>
                    <th className="p-1.5 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageRows.length > 0 ? (
                    coverageRows.map((c: any, idx: number) => (
                      <tr key={c.id ?? idx} className={`border-b border-border/20 ${c.covered ? "opacity-60" : "bg-destructive/5 hover:bg-destructive/10"} transition-colors`}>
                        <td className="p-1.5">
                          <div className="flex items-start gap-1">
                            {c.highRisk && <span className="text-destructive font-bold" title="High risk">Warning:</span>}
                            <div>
                              <div className="font-semibold text-foreground leading-tight">{c.name}</div>
                              <div className="text-muted-foreground capitalize">{c.settlementType}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-1.5 text-right font-mono text-muted-foreground">{c.distanceKm?.toFixed(1)}</td>
                        <td className="p-1.5 text-right font-mono">
                          {c.gridPop > 0 ? (
                            <span className="text-blue-600 dark:text-blue-400">{c.gridPop.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-1.5 text-right font-mono">
                          {c.hmisNsoPop > 0 ? (
                            <span className="text-green-600 dark:text-green-400">{c.hmisNsoPop.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-1.5 text-center">
                          {c.covered ? (
                            <span className="text-green-600 dark:text-green-400 font-bold">Done Planned</span>
                          ) : (
                            <span className="text-destructive font-bold">Warning: Not planned</span>
                          )}
                        </td>
                        <td className="p-1.5 text-center">
                          {!c.covered && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[9px] font-bold text-primary hover:text-primary hover:underline"
                              onClick={() => {
                                const worldPop = Number(c.gridPop || 0);
                                const newRow = {
                                  name: c.name,
                                  type: c.settlementType || "village",
                                  targetPopulation: worldPop > 0 ? String(Math.round(worldPop * under1Ratio)) : "0",
                                  gridPop: String(worldPop || 0),
                                  surveyPop: c.hmisNsoPop > 0 ? String(c.hmisNsoPop) : undefined,
                                  source: "worldpop",
                                  strategy: "outreach",
                                  latitude: String(c.latitude),
                                  longitude: String(c.longitude),
                                  villageId: c.id,
                                  rowId: `v${c.id}-gap-${Date.now()}`,
                                };
                                setCommunities([...communities, newRow]);
                                setSelectedIdx(communities.length);
                                toast({ title: "Added", description: `"${c.name}" added to plan.` });
                              }}
                              disabled={readOnly}
                            >
                              + Add
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-muted-foreground">
                        {loadingCatchment ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading catchment communities...
                          </span>
                        ) : catchmentCommunities === null ? (
                          <span className="flex items-center justify-center gap-1.5 text-muted-foreground">
                            <X className="h-3.5 w-3.5" /> Spatial gap results unavailable. Planned communities remain listed when available.
                          </span>
                        ) : (
                          "No planned or nearby communities found for this facility."
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Unmapped Suggestions Panel - enhanced */}
        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>Unmapped Settlements</span>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal bg-muted">
                  GIS Sync
                </Badge>
              </span>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => refetchUnmapped()} title="Refresh suggestions">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 max-h-[420px] overflow-y-auto">
            {unmappedSuggestions && unmappedSuggestions.length > 0 ? (
              <div className="space-y-3">
                {unmappedSuggestions.map((s: any) => {
                  const registeredCommunities = communities.filter(c => c.villageId);
                  const selectedCommunityId = selectedLinkCommunityMap[s.id] || "";
                  const hasDryTime = s.dry_season_travel_time != null;
                  const hasRainyTime = s.rainy_season_travel_time != null;
                  const isHighRisk = s.risk_level === "high" || s.risk_level === "very_high";

                  return (
                    <div key={s.id} className="p-3 border rounded-lg text-xs hover:bg-accent/40 transition-colors space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            {s.name}
                            {isHighRisk && (
                              <span className="text-[9px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1 py-0.5 rounded">
                                High Risk
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground capitalize">
                            {s.settlement_type ?? s.placeType ?? "settlement"}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted/80 px-1.5 py-0.5 rounded">
                          {s.distance_km?.toFixed(1)} km
                        </span>
                      </div>

                      {/* Travel Times & Mode */}
                      {(s.travel_mode || hasDryTime || hasRainyTime) && (
                        <div className="text-[10px] bg-muted/30 p-1.5 rounded space-y-0.5 text-muted-foreground">
                          {s.travel_mode && (
                            <div>
                              <span>Planned travel mode: </span>
                              <strong className="text-foreground capitalize">{s.travel_mode}</strong>
                            </div>
                          )}
                          {(hasDryTime || hasRainyTime) && (
                            <div className="flex gap-2">
                              {hasDryTime && (
                                <span>Dry season: <strong>{s.dry_season_travel_time}m</strong></span>
                              )}
                              {hasRainyTime && (
                                <span>Rainy season: <strong>{s.rainy_season_travel_time}m</strong></span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                        <span> Est. Population: <strong className="text-foreground">{s.population > 0 ? Number(s.population).toLocaleString() : "-"}</strong></span>
                        <span>Link Status: <span className="capitalize">{s.link_status ?? "unassigned"}</span></span>
                      </div>

                      {/* Link to existing community action */}
                      <div className="pt-1.5 border-t border-dashed space-y-1.5">
                        <div className="text-[10px] font-medium text-muted-foreground">Link to existing community:</div>
                        <div className="flex gap-1.5 items-center">
                          <select
                            className="bg-background border border-input text-[11px] rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-primary h-7 text-foreground"
                            value={selectedCommunityId}
                            onChange={(e) => {
                              setSelectedLinkCommunityMap({
                                ...selectedLinkCommunityMap,
                                [s.id]: Number(e.target.value)
                              });
                            }}
                            disabled={readOnly}
                          >
                            <option value="">Select community...</option>
                            {registeredCommunities.map(c => (
                              <option key={c.villageId} value={c.villageId}>
                                {c.name} (ID: {c.villageId})
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-[10px]"
                            disabled={readOnly || !selectedCommunityId || linkCommunityMutation.isPending}
                            onClick={() => {
                              linkCommunityMutation.mutate(
                                { id: s.id, communityId: Number(selectedCommunityId) },
                                {
                                  onSuccess: () => {
                                    refetchUnmapped();
                                    refetchCatchment();
                                    setSelectedLinkCommunityMap({
                                      ...selectedLinkCommunityMap,
                                      [s.id]: 0
                                    });
                                  }
                                }
                              );
                            }}
                          >
                            {linkCommunityMutation.isPending && linkCommunityMutation.variables?.id === s.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Link"
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Convert or Local Add action */}
                      <div className="flex gap-2 justify-end pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                          disabled={readOnly}
                          onClick={() => {
                            const bestPop = s.population || 120;
                            const newRow = {
                              name: s.name,
                              type: s.settlement_type || "village",
                              targetPopulation: String(bestPop),
                              gridPop: "0",
                              surveyPop: String(bestPop),
                              source: "nso" as any,
                              strategy: "outreach" as const,
                              latitude: String(s.latitude),
                              longitude: String(s.longitude),
                              rowId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            };
                            setCommunities([...communities, newRow]);
                            setSelectedIdx(communities.length);
                            toast({ title: "Draft Community Added", description: `Added "${s.name}" locally.` });
                          }}
                        >
                          Add as Local Draft
                        </Button>

                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2.5 text-[10px] bg-primary text-primary-foreground font-medium"
                          disabled={readOnly || convertToCommunityMutation.isPending}
                          onClick={() => {
                            convertToCommunityMutation.mutate(s.id, {
                              onSuccess: (data: any) => {
                                const newCommunity = data.data || data;
                                const bestPop = s.population || 120;
                                const newRow = {
                                  villageId: newCommunity.id,
                                  name: newCommunity.name || s.name,
                                  type: newCommunity.settlementType || s.settlement_type || "village",
                                  targetPopulation: String(bestPop),
                                  gridPop: String(newCommunity.griddedPopulation || 0),
                                  surveyPop: String(newCommunity.totalCatchmentPopulation || bestPop),
                                  source: "nso" as any,
                                  strategy: newCommunity.isHardToReach ? "outreach" : "static" as any,
                                  latitude: newCommunity.latitude ? String(newCommunity.latitude) : String(s.latitude),
                                  longitude: newCommunity.longitude ? String(newCommunity.longitude) : String(s.longitude),
                                  rowId: `v${newCommunity.id}`,
                                  saved: true,
                                };
                                setCommunities([...communities, newRow]);
                                setSelectedIdx(communities.length);
                                refetchUnmapped();
                                refetchCatchment();
                              }
                            });
                          }}
                        >
                          {convertToCommunityMutation.isPending && convertToCommunityMutation.variables === s.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Convert to Registered"
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-6">
                No unmapped settlements found nearby. All master settlements are accounted for.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>

      {/* Selected Community Details Panel */}
      {selectedIdx !== null && communities[selectedIdx] && (
        <Card className="border border-primary/20 shadow-sm bg-card" data-testid="selected-community-details">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span>Community Focal Person & Contact Details</span>
              <span className="text-primary font-mono bg-primary/10 px-2 py-0.5 rounded text-xs font-bold">
                #{selectedIdx + 1} {communities[selectedIdx].name || "Unnamed"}
              </span>
            </CardTitle>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedIdx(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,1.3fr)_auto]">
              <div>
                <Label className="text-xs font-semibold">Registered CHV focal person</Label>
                <Select
                  value={communities[selectedIdx].focalChvId ? String(communities[selectedIdx].focalChvId) : "__manual__"}
                  onValueChange={(value) => {
                    if (value === "__manual__") {
                      update(selectedIdx, { focalChvId: null, focalPersonSource: "Manual entry" });
                      return;
                    }
                    const selected = safeFacilityChvs.find((chv: any) => String(chv.id) === value);
                    if (selected) assignFocalChv(selectedIdx, selected);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a registered CHV" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual__">Manual focal person</SelectItem>
                    {communityChvOptions.map((chv: any) => (
                      <SelectItem key={chv.id} value={String(chv.id)}>
                        {(chv.name ?? chv.fullName ?? "Unnamed CHV")}
                        {(chv.contactPhone || chv.phone) ? ` - ${chv.contactPhone || chv.phone}` : ""}
                        {chv.communityUnit ? ` (${chv.communityUnit})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Matched CHVs for this community appear first; other facility CHVs remain available if the focal person covers more than one community.
                </p>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFocalChvForm((v) => !v)}
                  disabled={readOnly}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add CHV here
                </Button>
              </div>
            </div>

            {showFocalChvForm && (
              <div className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-4">
                <div>
                  <Label className="text-xs font-semibold">CHV full name *</Label>
                  <Input
                    className="mt-1"
                    value={focalChvForm.name}
                    onChange={(e) => setFocalChvForm({ ...focalChvForm, name: e.target.value })}
                    placeholder="e.g. Ban Hio Yet"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Phone</Label>
                  <Input
                    className="mt-1"
                    value={focalChvForm.contactPhone}
                    onChange={(e) => setFocalChvForm({ ...focalChvForm, contactPhone: e.target.value })}
                    placeholder={countryConfig.phonePlaceholder || "+27 82 123 4567"}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">{countryConfig.idShortLabel || "National ID"} {planType !== "campaign" ? "*" : ""}</Label>
                  <Input
                    className="mt-1"
                    value={focalChvForm.nrc}
                    onChange={(e) => setFocalChvForm({ ...focalChvForm, nrc: e.target.value })}
                    placeholder={countryConfig.idFormatPlaceholder || "9001015009087"}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button type="button" size="sm" onClick={addFocalChv} disabled={savingFocalChv}>
                    {savingFocalChv ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                    Save & assign
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowFocalChvForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs font-semibold">Focal Person Name</Label>
                <Input
                  placeholder="Focal point name"
                  className="mt-1"
                  value={communities[selectedIdx].focalPersonName || ""}
                  onChange={(e) => update(selectedIdx, { focalPersonName: e.target.value, focalPersonSource: "Manual entry" })}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Focal Person Phone</Label>
                <Input
                  placeholder={countryConfig.phonePlaceholder || "+27 82 123 4567"}
                  className="mt-1"
                  value={communities[selectedIdx].focalPersonPhone || ""}
                  onChange={(e) => update(selectedIdx, { focalPersonPhone: e.target.value, focalPersonSource: communities[selectedIdx].focalPersonSource || "Manual entry" })}
                />
              </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="comm-contact"
                checked={!!communities[selectedIdx].communicationContactMade}
                onCheckedChange={(v) => update(selectedIdx, { communicationContactMade: !!v })}
              />
              <Label htmlFor="comm-contact" className="text-xs font-medium cursor-pointer select-none">
                Communication Contact Made
              </Label>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="outside-followup"
                checked={!!communities[selectedIdx].outsideFollowUpCheck}
                onCheckedChange={(v) => update(selectedIdx, { outsideFollowUpCheck: !!v })}
              />
              <Label htmlFor="outside-followup" className="text-xs font-medium cursor-pointer select-none">
                Outside Follow-Up Required
              </Label>
            </div>
            </div>
          </CardContent>
          {/* Cross-Border Coordination Section */}
          <div className="border-t border-border/40 px-4 py-3 space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Cross-Border Coordination</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-cross-border"
                  checked={!!communities[selectedIdx].isCrossBorder}
                  onCheckedChange={(v) => update(selectedIdx, { isCrossBorder: !!v })}
                />
                <Label htmlFor="is-cross-border" className="text-xs font-medium cursor-pointer select-none">
                  Cross-border community
                </Label>
              </div>
              {communities[selectedIdx].isCrossBorder && (
                <>
                  <div>
                    <Label className="text-xs font-semibold">Neighboring country</Label>
                    <Input
                      placeholder="e.g. Zimbabwe"
                      className="mt-1"
                      value={communities[selectedIdx].borderCountry || ""}
                      onChange={(e) => update(selectedIdx, { borderCountry: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Checkbox
                      id="is-crossing-point"
                      checked={!!communities[selectedIdx].isCrossingPoint}
                      onCheckedChange={(v) => update(selectedIdx, { isCrossingPoint: !!v })}
                    />
                    <Label htmlFor="is-crossing-point" className="text-xs font-medium cursor-pointer select-none">
                      Border crossing point
                    </Label>
                  </div>
                  {communities[selectedIdx].isCrossingPoint && (
                    <>
                      <div>
                        <Label className="text-xs font-semibold">Crossing type</Label>
                        <Select
                          value={communities[selectedIdx].crossingType || ""}
                          onValueChange={(v) => update(selectedIdx, { crossingType: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="formal">Formal (official port)</SelectItem>
                            <SelectItem value="informal">Informal (unmanned crossing)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Daily movement volume (est.)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 500"
                          className="mt-1"
                          value={communities[selectedIdx].dailyMovementVolume || ""}
                          onChange={(e) => update(selectedIdx, { dailyMovementVolume: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          {/* Settlement Classification & Population - Sheet 1.0 */}
          <div className="border-t border-border/40 px-4 py-3 space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Settlement Classification &amp; Population (Sheet 1.0)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Settlement Type</Label>
                <Select
                  value={communities[selectedIdx].settlementType || "village"}
                  onValueChange={(v) => update(selectedIdx, { settlementType: v })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="village">Village</SelectItem>
                    <SelectItem value="peri_urban">Peri-urban</SelectItem>
                    <SelectItem value="urban">Urban</SelectItem>
                    <SelectItem value="idp_camp">IDP Camp</SelectItem>
                    <SelectItem value="refugee_camp">Refugee Camp</SelectItem>
                    <SelectItem value="nomadic">Nomadic</SelectItem>
                    <SelectItem value="island">Island</SelectItem>
                    <SelectItem value="institution">Institution</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Total Catchment Population</Label>
                <Input
                  type="number" min={0} placeholder="e.g. 1500" className="mt-1"
                  value={communities[selectedIdx].totalCatchmentPopulation || ""}
                  onChange={(e) => update(selectedIdx, { totalCatchmentPopulation: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Under-5 Population</Label>
                <Input
                  type="number" min={0} placeholder="e.g. 240" className="mt-1"
                  value={communities[selectedIdx].under5Population || ""}
                  onChange={(e) => update(selectedIdx, { under5Population: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="high-risk"
                  checked={!!communities[selectedIdx].highRisk}
                  onCheckedChange={(v) => update(selectedIdx, { highRisk: !!v })}
                />
                <Label htmlFor="high-risk" className="text-xs font-medium cursor-pointer select-none text-destructive">High-Risk Community</Label>
              </div>
              {communities[selectedIdx].highRisk && (
                <div className="lg:col-span-2">
                  <Label className="text-xs font-semibold">High-Risk Reason</Label>
                  <Input
                    placeholder="e.g. Zero-dose hotspot, conflict-affected, remote" className="mt-1"
                    value={communities[selectedIdx].highRiskReason || ""}
                    onChange={(e) => update(selectedIdx, { highRiskReason: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>
          {/* Border Village Inter-Country Coordination - Sheet 1.1 */}
          {communities[selectedIdx].isCrossBorder && (
            <div className="border-t border-border/40 px-4 py-3 space-y-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Border Village Coordination (Sheet 1.1)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Neighboring Country Name</Label>
                  <Input
                    placeholder="e.g. Mozambique" className="mt-1"
                    value={communities[selectedIdx].borderVillageCountry || ""}
                    onChange={(e) => update(selectedIdx, { borderVillageCountry: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Neighboring Country Facility Name</Label>
                  <Input
                    placeholder="e.g. Matola Health Centre" className="mt-1"
                    value={communities[selectedIdx].borderVillageFacilityName || ""}
                    onChange={(e) => update(selectedIdx, { borderVillageFacilityName: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Dialog: Estimate Single Catchment */}
      <Dialog
        open={estimate !== null}
        onOpenChange={(open) => {
          if (!open) closeEstimate();
        }}
      >
        <DialogContent data-testid="dialog-estimate-catchment">
          <DialogHeader>
            <DialogTitle>Estimate population from map</DialogTitle>
            <DialogDescription>
              {estimate && (
                <>
                  Summing WorldPop 1&nbsp;km cells inside a circle around{" "}
                  <span className="font-mono">
                    {estimate.lat.toFixed(4)}, {estimate.lng.toFixed(4)}
                  </span>
                  .
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {estimate && (
            <CommunityPopulationIntelligence
              lat={estimate.lat}
              lng={estimate.lng}
              initialRadiusKm={2}
              onAcceptEstimate={(total) => {
                const targetPop = String(Math.round(total * under1Ratio));
                update(estimate.index, {
                  gridPop: String(total),
                  targetPopulation: targetPop,
                  source: "worldpop",
                });
                toast({
                  title: "Population estimate applied",
                  description: `Grid Pop set to ${total.toLocaleString()}. Target = ${parseInt(targetPop).toLocaleString()}.`,
                });
                closeEstimate();
              }}
            />
          )}

          <DialogFooter className="mt-4 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeEstimate}
              data-testid="button-catchment-cancel"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Bulk Estimate Catchments */}
      <Dialog
        open={bulkEstimate !== null}
        onOpenChange={(open) => {
          if (!open) closeBulkEstimate();
        }}
      >
        <DialogContent data-testid="dialog-bulk-estimate-catchment">
          <DialogHeader>
            <DialogTitle>Estimate all from map</DialogTitle>
            <DialogDescription>
              {bulkEstimate && bulkEstimate.phase === "confirm" && (
                <>
                  This will overwrite the target population on every community
                  that has a pin with a fresh WorldPop estimate. Communities
                  without coordinates will be skipped.
                </>
              )}
              {bulkEstimate && bulkEstimate.phase === "running" && (
                <>Sampling WorldPop cells for each community...</>
              )}
              {bulkEstimate && bulkEstimate.phase === "done" && (() => {
                const okN = bulkEstimate.rows.filter((r) => r.status.state === "ok").length;
                const errN = bulkEstimate.rows.filter((r) => r.status.state === "error").length;
                if (okN === 0 && errN > 0) {
                  return (
                    <>No rows could be estimated. See the per-row reason below - you can enter populations manually for now.</>
                  );
                }
                if (okN === 0) {
                  return <>No rows were updated.</>;
                }
                if (errN > 0) {
                  return (
                    <>Done - {okN} row{okN === 1 ? "" : "s"} updated from WorldPop. {errN} failed (see below).</>
                  );
                }
                return <>Done. Successful rows now use WorldPop as their source.</>;
              })()}
            </DialogDescription>
          </DialogHeader>

          {bulkEstimate && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Shared catchment radius
                </Label>
                <div className="mt-1 flex gap-2">
                  {[1, 2, 3].map((r) => (
                    <Button
                      key={r}
                      type="button"
                      size="sm"
                      variant={bulkEstimate.radiusKm === r ? "default" : "outline"}
                      onClick={() =>
                        setBulkEstimate((prev) =>
                          prev ? { ...prev, radiusKm: r } : prev,
                        )
                      }
                      disabled={bulkEstimate.phase === "running"}
                      data-testid={`button-bulk-catchment-radius-${r}`}
                    >
                      {r} km
                    </Button>
                  ))}
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto rounded-md border bg-muted/30 text-sm">
                <table className="w-full">
                  <thead className="sticky top-0 border-b bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2">Community</th>
                      <th className="p-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkEstimate.rows.map((r) => (
                      <tr
                        key={r.index}
                        className="border-b last:border-0"
                        data-testid={`row-bulk-estimate-${r.index}`}
                      >
                        <td className="p-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{r.index + 1}
                          </span>{" "}
                          {r.name}
                        </td>
                        <td className="p-2 text-xs">
                          {r.status.state === "skipped" && (
                            <span className="text-muted-foreground">
                              No pin - skipped
                            </span>
                          )}
                          {r.status.state === "pending" && (
                            <span className="text-muted-foreground">
                              {bulkEstimate.phase === "running"
                                ? "Waiting..."
                                : "Ready"}
                            </span>
                          )}
                          {r.status.state === "running" && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Sampling...
                            </span>
                          )}
                          {r.status.state === "ok" && (
                            <span className="text-foreground" data-testid={`text-bulk-ok-${r.index}`}>
                              ~ {r.status.total.toLocaleString()} people
                            </span>
                          )}
                          {r.status.state === "nodata" && (
                            <span className="text-muted-foreground">
                              No data in this area
                            </span>
                          )}
                          {r.status.state === "error" && (
                            <span className="text-destructive">
                              {r.status.message}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {bulkEstimate.phase === "done" && (
                <div className="text-xs text-muted-foreground">
                  {bulkEstimate.rows.filter((r) => r.status.state === "ok").length}{" "}
                  updated -{" "}
                  {
                    bulkEstimate.rows.filter((r) => r.status.state === "nodata")
                      .length
                  }{" "}
                  no-data -{" "}
                  {
                    bulkEstimate.rows.filter((r) => r.status.state === "error")
                      .length
                  }{" "}
                  failed -{" "}
                  {
                    bulkEstimate.rows.filter((r) => r.status.state === "skipped")
                      .length
                  }{" "}
                  skipped
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeBulkEstimate}
              data-testid="button-bulk-catchment-cancel"
            >
              {bulkEstimate?.phase === "running" ? "Stop" : "Close"}
            </Button>
            {bulkEstimate?.phase !== "done" && (
              <Button
                type="button"
                onClick={runBulkEstimate}
                disabled={
                  !bulkEstimate ||
                  bulkEstimate.phase === "running" ||
                  bulkEstimate.rows.every((r) => r.status.state === "skipped")
                }
                data-testid="button-bulk-catchment-run"
              >
                {bulkEstimate?.phase === "confirm"
                  ? `Overwrite ${
                      bulkEstimate.rows.filter(
                        (r) => r.status.state !== "skipped",
                      ).length
                    } row(s)`
                  : "Running..."}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Step 2 Map -----------------------------------------------------------
export function Step2Map({
  facility,
  communities,
  selectedIdx,
  drawMode,
  onMapClick,
  onPinDrag,
  onPinClick,
  onPolygonDrawn,
  catchmentPreview,
  catchment,
  gapGeojson,
  showGaps,
  facilityPolygon,
  readOnly,
}: {
  facility: Facility | null;
  communities: any[];
  selectedIdx: number | null;
  drawMode?: "none" | "facility" | "community";
  onMapClick: (lat: number, lng: number) => void;
  onPinDrag: (i: number, lat: number, lng: number) => void;
  onPinClick: (i: number) => void;
  onPolygonDrawn?: (geojson: any) => void;
  catchmentPreview?: {
    lat: number;
    lng: number;
    radiusKm: number;
    cells?: Array<{
      lat: number;
      lng: number;
      latStepDeg: number;
      lngStepDeg: number;
      status: "ok" | "nodata" | "error";
      value?: number;
    }> | null;
  } | null;
  catchment?: any;
  gapGeojson?: any;
  showGaps?: boolean;
  facilityPolygon?: any;
  readOnly?: boolean;
}) {
  const facilityLat = facility?.latitude != null ? parseFloat(String(facility.latitude)) : null;
  const facilityLng = facility?.longitude != null ? parseFloat(String(facility.longitude)) : null;

  // Lazy-load Leaflet so the wizard's earlier steps don't pay the bundle cost.
  const [leaflet, setLeaflet] = useState<any>(null);
  const [showPopulation, setShowPopulation] = useState(false);
  // WorldPop proxy is now live - server-side route tries WOPR -> Stats API -> local DB.
  const [populationUnavailable, setPopulationUnavailable] = useState(false);
  const [localGridCells, setLocalGridCells] = useState<any[] | null>(null);
  const [loadingLocalGrid, setLoadingLocalGrid] = useState(false);
  const [infoMode, setInfoMode] = useState(false);

  useEffect(() => {
    if (showPopulation && !localGridCells && !loadingLocalGrid && facilityLat != null && facilityLng != null) {
      setLoadingLocalGrid(true);
      fetch("/api/population/estimate-polygon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: facilityLat,
          longitude: facilityLng,
          radiusKm: 10, // Fetch local grids in a 10km radius around the facility
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch local grids");
          return res.json();
        })
        .then((data) => {
          if (data && Array.isArray(data.cells)) {
            setLocalGridCells(data.cells);
          }
        })
        .catch((err) => {
          console.warn("[Step2Map] Failed to load offline population grids:", err);
        })
        .finally(() => {
          setLoadingLocalGrid(false);
        });
    }
  }, [showPopulation, localGridCells, loadingLocalGrid, facilityLat, facilityLng]);
  // Polygon draw vertices (for facility catchment drawing)
  const [drawVertices, setDrawVertices] = useState<[number, number][]>([]);
  const [infoPopup, setInfoPopup] = useState<
    | {
        lat: number;
        lng: number;
        status: "loading" | "ok" | "nodata" | "error";
        value?: number;
        message?: string;
        cached?: boolean;
        cachedAt?: number;
      }
    | null
  >(null);
  const popErrorToastedRef = useRef(false);
  const { toast } = useToast();
  useEffect(() => {
    let active = true;
    Promise.all([
      import("react-leaflet"),
      import("leaflet"),
      import("@/lib/mapIcons"),
      // @ts-ignore - leaflet css
      import("leaflet/dist/leaflet.css"),
    ]).then(([rl, L, icons]) => {
      if (!active) return;
      icons.applyDefaultLeafletPinIcon();
      setLeaflet({ rl, L: L.default ?? L, icons });
    });
    return () => {
      active = false;
    };
  }, []);

  // facilityLat and facilityLng moved to the top of Step2Map to prevent block-scoped variable usage before declaration.

  const center = useMemo<[number, number]>(() => {
    if (facilityLat != null && facilityLng != null && !isNaN(facilityLat) && !isNaN(facilityLng)) {
      return [facilityLat, facilityLng];
    }
    const first = communities.find(
      (c) => c.latitude && c.longitude && !isNaN(parseFloat(c.latitude)),
    );
    if (first) {
      return [parseFloat(first.latitude), parseFloat(first.longitude)];
    }
    return [-13.13, 27.85]; // Zambia fallback
  }, [facilityLat, facilityLng, communities]);

  const [basemap, setBasemap] = usePersistedBasemap("osm");
  const mapRef = useRef<any>(null);

  // Reset draw vertices when draw mode changes.
  // IMPORTANT: must be declared here (before the early return below) so the
  // hook call count is the same on every render - React's rules of hooks.
  useEffect(() => {
    if (drawMode !== "facility") setDrawVertices([]);
  }, [drawMode]);

  if (!leaflet) {
    return (
      <div className="h-[360px] w-full rounded-xl border border-dashed border-border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading map...
      </div>
    );
  }

  const { MapContainer, TileLayer, WMSTileLayer, Marker, Popup, Circle: LCircle, Rectangle: LRectangle, Tooltip: LTooltip, useMapEvents, useMap, Polygon: LPolygon, GeoJSON: LGeoJSON, Polyline: LPolyline } = leaflet.rl;

  /* Original Code commented out to prevent Leaflet infinite tile crashes:
  function Recenter({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      map.setView(center, map.getZoom());
    }, [center[0], center[1]]);
    return null;
  }
  */
  // Updated Code: Uses refs to track value-based coordinate updates and validates against NaN.
  // This prevents infinite render loop cascades and Leaflet's "Attempted to load an infinite number of tiles" error.
  function Recenter({ center }: { center: [number, number] }) {
    const map = useMap();
    const [lat, lng] = center || [NaN, NaN];
    const prevCenterRef = useRef<[number, number]>([lat, lng]);

    useEffect(() => {
      const prevCenter = prevCenterRef.current;
      const centerChanged = prevCenter[0] !== lat || prevCenter[1] !== lng;

      if (centerChanged) {
        if (
          typeof lat === "number" &&
          typeof lng === "number" &&
          !isNaN(lat) &&
          !isNaN(lng)
        ) {
          map.setView([lat, lng], map.getZoom());
          prevCenterRef.current = [lat, lng];
        }
      }
    }, [map, lat, lng]);
    return null;
  }

  function MapRefCatcher() {
    const map = useMap();
    useEffect(() => {
      mapRef.current = map;
    }, [map]);
    return null;
  }

  const geocodedPoints: [number, number][] = [];
  if (facilityLat != null && facilityLng != null && !isNaN(facilityLat) && !isNaN(facilityLng)) {
    geocodedPoints.push([facilityLat, facilityLng]);
  }
  for (const c of communities) {
    if (!c.latitude || !c.longitude) continue;
    const lat = parseFloat(c.latitude);
    const lng = parseFloat(c.longitude);
    if (isNaN(lat) || isNaN(lng)) continue;
    geocodedPoints.push([lat, lng]);
  }
  const canFitBounds = geocodedPoints.length > 0;

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleLocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 14),
      (err) => console.error("Geolocation error:", err),
    );
  };
  const handleFitBounds = () => {
    if (!canFitBounds || !mapRef.current) return;
    if (geocodedPoints.length === 1) {
      mapRef.current.setView(geocodedPoints[0], 14);
      return;
    }
    const bounds = leaflet.L.latLngBounds(geocodedPoints);
    mapRef.current.fitBounds(bounds, { padding: [40, 40] });
  };
  const L = leaflet.L;
  const { createFilledPinIcon, createFacilityCircleIcon } = leaflet.icons;

  const facilityIcon = createFacilityCircleIcon();
  const pinBlue = createFilledPinIcon("blue");
  const pinGreen = createFilledPinIcon("green");
  const pinAmber = createFilledPinIcon("amber");

  /* Original Code commented out for backward-compatibility:
  async function fetchPopulationAt(map: any, latlng: any) {
    const lat = latlng.lat;
    const lng = latlng.lng;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;

    if (offline) {
      const hit = getCachedPopulation(lat, lng);
      if (hit) {
        return { status: "ok" as const, value: hit.value, cached: true, cachedAt: hit.cachedAt };
      }
      return { status: "error" as const, message: "Offline and no cached estimate for this spot." };
    }

    const size = map.getSize();
    const point = map.latLngToContainerPoint(latlng);
    const bounds = map.getBounds();
    const sw = L.CRS.EPSG3857.project(bounds.getSouthWest());
    const ne = L.CRS.EPSG3857.project(bounds.getNorthEast());
    const params = new URLSearchParams({
      service: "WMS",
      version: "1.3.0",
      request: "GetFeatureInfo",
      layers: "wpGlobal:ppp_2020_1km_Aggregated",
      query_layers: "wpGlobal:ppp_2020_1km_Aggregated",
      crs: "EPSG:3857",
      bbox: `${sw.x},${sw.y},${ne.x},${ne.y}`,
      width: String(size.x),
      height: String(size.y),
      i: String(Math.round(point.x)),
      j: String(Math.round(point.y)),
      info_format: "application/json",
      feature_count: "1",
    });
    const url = `https://ogc.worldpop.org/geoserver/wpGlobal/ows?${params.toString()}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const feat = json?.features?.[0];
      const props = feat?.properties ?? {};
      const raw =
        props.GRAY_INDEX ?? props.gray_index ?? props.PALETTE_INDEX ?? props.value ?? null;
      const num = raw == null ? null : Number(raw);
      if (num == null || !isFinite(num) || num < 0) {
        return { status: "nodata" as const };
      }
      setCachedPopulation(lat, lng, num);
      return { status: "ok" as const, value: num };
    } catch (err: any) {
      const hit = getCachedPopulation(lat, lng);
      if (hit) {
        return { status: "ok" as const, value: hit.value, cached: true, cachedAt: hit.cachedAt };
      }
      return {
        status: "error" as const,
        message: err?.name === "AbortError" ? "Request timed out." : "Couldn't reach WorldPop.",
      };
    } finally {
      clearTimeout(timer);
    }
  }
  */

  // Modified Code: Fetch single-point population from database-backed endpoint
  async function fetchPopulationAt(map: any, latlng: any) {
    const lat = latlng.lat;
    const lng = latlng.lng;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;

    if (offline) {
      const hit = getCachedPopulation(lat, lng);
      if (hit) {
        return { status: "ok" as const, value: hit.value, cached: true, cachedAt: hit.cachedAt };
      }
      return { status: "error" as const, message: "Offline and no cached estimate for this spot." };
    }

    try {
      const res = await fetch("/api/population/estimate-polygon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const num = json.totalPopulation;
      if (num == null || !isFinite(num) || num < 0) {
        return { status: "nodata" as const };
      }
      setCachedPopulation(lat, lng, num);
      return { status: "ok" as const, value: num };
    } catch (err: any) {
      const hit = getCachedPopulation(lat, lng);
      if (hit) {
        return { status: "ok" as const, value: hit.value, cached: true, cachedAt: hit.cachedAt };
      }
      return {
        status: "error" as const,
        message: "Failed to estimate population from database.",
      };
    }
  }

  function ClickCatcher() {
    const map = useMapEvents({
      click(e: any) {
        if (infoMode) {
          const { lat, lng } = e.latlng;
          setInfoPopup({ lat, lng, status: "loading" });
          fetchPopulationAt(map, e.latlng).then((res) => {
            setInfoPopup({ lat, lng, ...res });
          });
          return;
        }
        if (readOnly) return;
        if (drawMode === "facility") {
          const pt: [number, number] = [e.latlng.lat, e.latlng.lng];
          setDrawVertices((prev) => {
            // If click is within ~20px of first vertex, close polygon
            if (prev.length >= 3) {
              const firstPt = prev[0];
              const mapPt = map.latLngToContainerPoint(L.latLng(firstPt));
              const clickPt = map.latLngToContainerPoint(e.latlng);
              const dist = Math.hypot(mapPt.x - clickPt.x, mapPt.y - clickPt.y);
              if (dist < 24) {
                // Close polygon
                const coords = [...prev, prev[0]].map(([la, ln]) => [ln, la] as [number, number]);
                const geojson = { type: "Polygon", coordinates: [coords] };
                onPolygonDrawn?.(geojson);
                return [];
              }
            }
            return [...prev, pt];
          });
          return;
        }
        onMapClick(e.latlng.lat, e.latlng.lng);
      },
      dblclick(e: any) {
        if (drawMode === "facility" && drawVertices.length >= 3) {
          const coords = [...drawVertices, drawVertices[0]].map(([la, ln]) => [ln, la] as [number, number]);
          const geojson = { type: "Polygon", coordinates: [coords] };
          onPolygonDrawn?.(geojson);
          setDrawVertices([]);
        }
      },
      keydown(e: any) {
        if (e.originalEvent?.key === "Escape" && drawMode === "facility") {
          if (drawVertices.length >= 3) {
            const coords = [...drawVertices, drawVertices[0]].map(([la, ln]) => [ln, la] as [number, number]);
            onPolygonDrawn?.({ type: "Polygon", coordinates: [coords] });
          }
          setDrawVertices([]);
        }
      },
    });
    return null;
  }

  // (drawMode reset effect moved above the leaflet early-return to comply with
  // the Rules of Hooks - hooks must be called unconditionally on every render.)

  // Build a numbered DivIcon for each community
  const buildNumberedIcon = (n: number, color: string, highlighted: boolean) =>
    L.divIcon({
      className: "step2-pin",
      html:
        `<div style="position:relative;width:30px;height:38px;">` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 24 32" style="${
          highlighted ? "filter:drop-shadow(0 0 4px rgba(37,99,235,0.9));" : ""
        }">` +
        `<path d="M12 0C5.37 0 0 5.37 0 12c0 9.3 12 20 12 20s12-10.7 12-20c0-6.63-5.37-12-12-12z" fill="${color}"/>` +
        `</svg>` +
        `<span style="position:absolute;top:5px;left:0;right:0;text-align:center;color:#fff;font-size:11px;font-weight:700;font-family:sans-serif;">${n}</span>` +
        `</div>`,
      iconSize: [30, 38],
      iconAnchor: [15, 38],
      popupAnchor: [0, -38],
    });

  return (
    <div
      className={`min-h-[520px] h-[calc(100vh-420px)] max-h-[700px] w-full rounded-xl overflow-hidden border border-border shadow-inner relative ${
        drawMode === "facility" ? "[&_.leaflet-container]:cursor-crosshair" :
        infoMode ? "[&_.leaflet-container]:cursor-help" : ""
      }`}
    >
      <BasemapSwitcher basemap={basemap} onChange={setBasemap} />
      <MapContainer center={center} zoom={11} className="h-full w-full z-0" zoomControl={false}>
        <BasemapTileLayer basemap={basemap} />
        {showPopulation && (
          <WMSTileLayer
            url="https://ogc.worldpop.org/geoserver/wpGlobal/ows"
            layers="wpGlobal:ppp_2020_1km_Aggregated"
            format="image/png"
            transparent={true}
            opacity={0.6}
            version="1.3.0"
            attribution="Population &copy; WorldPop"
            eventHandlers={{
              tileerror: () => {
                if (popErrorToastedRef.current) return;
                popErrorToastedRef.current = true;
                toast({
                  title: "Offline population grids active",
                  description: "Could not load live WorldPop tiles. Displaying local database grids instead.",
                });
              },
            }}
          />
        )}
        {showPopulation && localGridCells && localGridCells.length > 0 && (() => {
          const ramp = ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#b10026"];
          const thresholds = [5, 15, 30, 75, 150, 300, 600];
          const colorFor = (v: number) => {
            for (let i = 0; i < thresholds.length; i++) {
              if (v < thresholds[i]) return ramp[i];
            }
            return ramp[ramp.length - 1];
          };
          return localGridCells.map((c, i) => {
            const bounds: [[number, number], [number, number]] = [
              [c.lat - c.latStepDeg / 2, c.lng - c.lngStepDeg / 2],
              [c.lat + c.latStepDeg / 2, c.lng + c.lngStepDeg / 2],
            ];
            const val = c.value || 0;
            const fillColor = colorFor(val);
            return (
              <LRectangle
                key={`grid-cell-${i}`}
                bounds={bounds}
                pathOptions={{
                  color: "#d97706",
                  weight: 0.5,
                  opacity: 0.3,
                  fillColor,
                  fillOpacity: val > 0 ? 0.45 : 0.05,
                }}
              >
                <LTooltip direction="top" sticky>
                  <div className="text-xs">
                    <strong>{Math.round(val).toLocaleString()}</strong> people/km2
                    <div className="text-[10px] text-muted-foreground">Local Population Grid</div>
                  </div>
                </LTooltip>
              </LRectangle>
            );
          });
        })()}
        <MapRefCatcher />
        <ClickCatcher />
        <Recenter center={center} />

        {infoPopup && (
          <Popup
            position={[infoPopup.lat, infoPopup.lng]}
            eventHandlers={{ remove: () => setInfoPopup(null) }}
          >
            <div className="text-xs" data-testid="popup-population-info">
              <div className="font-semibold">Population estimate</div>
              <div className="text-muted-foreground">
                {infoPopup.lat.toFixed(4)}, {infoPopup.lng.toFixed(4)}
              </div>
              {infoPopup.status === "loading" && (
                <div className="mt-1 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Looking up...
                </div>
              )}
              {infoPopup.status === "ok" && infoPopup.value != null && (
                <div className="mt-1">
                  ~ <strong>{Math.round(infoPopup.value).toLocaleString()}</strong> people/km2
                  <div className="text-muted-foreground">
                    WorldPop 2020, 1&nbsp;km grid
                  </div>
                  {infoPopup.cached && (
                    <div className="text-muted-foreground italic" data-testid="text-population-cached">
                      cached
                      {infoPopup.cachedAt
                        ? ` - ${new Date(infoPopup.cachedAt).toLocaleDateString()}`
                        : ""}
                    </div>
                  )}
                </div>
              )}
              {infoPopup.status === "nodata" && (
                <div className="mt-1 text-muted-foreground">
                  No population data for this cell.
                </div>
              )}
              {infoPopup.status === "error" && (
                <div className="mt-1 text-muted-foreground">
                  {infoPopup.message ?? "Lookup failed."}
                </div>
              )}
            </div>
          </Popup>
        )}

        {catchmentPreview?.cells && catchmentPreview.cells.length > 0 && (() => {
          // Fixed people/km2 buckets (WorldPop 1km grid). Using absolute
          // thresholds keeps streamed cells stable as new samples arrive -
          // a cell never gets recoloured just because a higher-valued cell
          // showed up later in the run.
          const ramp = ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"];
          const thresholds = [10, 50, 200, 750];
          const colorFor = (v: number) => {
            for (let i = 0; i < thresholds.length; i++) {
              if (v < thresholds[i]) return ramp[i];
            }
            return ramp[ramp.length - 1];
          };
          return catchmentPreview.cells.map((c, i) => {
            const bounds: [[number, number], [number, number]] = [
              [c.lat - c.latStepDeg / 2, c.lng - c.lngStepDeg / 2],
              [c.lat + c.latStepDeg / 2, c.lng + c.lngStepDeg / 2],
            ];
            const isOk = c.status === "ok" && typeof c.value === "number";
            const isError = c.status === "error";
            const fillColor = isOk
              ? colorFor(c.value as number)
              : isError
                ? "#dc2626"
                : "#9ca3af";
            const strokeColor = isOk ? "#7f1d1d" : isError ? "#7f1d1d" : "#6b7280";
            return (
              <LRectangle
                key={`cell-${i}`}
                bounds={bounds}
                pathOptions={{
                  color: strokeColor,
                  weight: 1,
                  opacity: isOk ? 0.6 : 0.8,
                  fillColor,
                  fillOpacity: isOk ? 0.55 : 0.25,
                  dashArray: isOk ? undefined : "3 3",
                }}
              >
                <LTooltip direction="top" sticky>
                  <div className="text-xs">
                    {isOk ? (
                      <>
                        <strong>{Math.round(c.value as number).toLocaleString()}</strong>{" "}
                        people/km2
                      </>
                    ) : isError ? (
                      <span>Lookup failed</span>
                    ) : (
                      <span>No data</span>
                    )}
                  </div>
                </LTooltip>
              </LRectangle>
            );
          });
        })()}

        {catchment && catchment.geojson && (
          <LGeoJSON
            data={catchment.geojson}
            pathOptions={{
              color: "#3b82f6",
              weight: 3,
              fillColor: "#3b82f6",
              fillOpacity: 0.05,
              dashArray: "5 5",
            }}
          />
        )}

        {/* Drawn facility catchment polygon */}
        {facilityPolygon && (
          <LGeoJSON
            key={JSON.stringify(facilityPolygon)}
            data={facilityPolygon as any}
            pathOptions={{
              color: "#16a34a",
              weight: 3,
              fillColor: "#16a34a",
              fillOpacity: 0.12,
              dashArray: "6 4",
            }}
          />
        )}

        {/* Draw-in-progress: vertices polyline */}
        {drawMode === "facility" && drawVertices.length > 0 && (
          <>
            <LPolyline
              positions={drawVertices}
              pathOptions={{ color: "#f97316", weight: 2.5, dashArray: "4 4" }}
            />
            {drawVertices.map((pt, i) => (
              <LCircle
                key={i}
                center={pt}
                radius={50}
                pathOptions={{
                  color: i === 0 ? "#dc2626" : "#f97316",
                  fillColor: i === 0 ? "#dc2626" : "#fff",
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
            ))}
            {drawVertices.length >= 3 && (
              <LPolyline
                positions={[drawVertices[drawVertices.length - 1], drawVertices[0]]}
                pathOptions={{ color: "#f97316", weight: 1.5, dashArray: "2 6", opacity: 0.5 }}
              />
            )}
          </>
        )}

        {showGaps && gapGeojson && (
          <LGeoJSON
            data={gapGeojson}
            pathOptions={{
              color: "#dc2626",
              weight: 2,
              fillColor: "#dc2626",
              fillOpacity: 0.25,
            }}
          />
        )}

        {communities
          .filter((c) => {
            const coords = c.boundary?.coordinates?.[0];
            return Array.isArray(coords) && coords.length >= 4;
          })
          .map((c, idx) => {
            const ring = c.boundary.coordinates[0] as number[][];
            const positions = ring.map((pt: any) => [pt[1], pt[0]] as [number, number]);
            const colors = ["#2563eb", "#ea580c", "#16a34a", "#db2777", "#9333ea", "#0d9488", "#ca8a04"];
            const color = colors[idx % colors.length];
            return (
              <LPolygon
                key={`community-boundary-${idx}`}
                positions={positions}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: selectedIdx === idx ? 0.25 : 0.1,
                  weight: selectedIdx === idx ? 3 : 2,
                }}
              />
            );
          })}

        {catchmentPreview && (
          <LCircle
            center={[catchmentPreview.lat, catchmentPreview.lng]}
            radius={catchmentPreview.radiusKm * 1000}
            pathOptions={{
              color: "#2563eb",
              weight: 2,
              fillColor: "#2563eb",
              fillOpacity: catchmentPreview.cells && catchmentPreview.cells.length > 0 ? 0 : 0.15,
            }}
          />
        )}

        {facilityLat != null && facilityLng != null && !isNaN(facilityLat) && !isNaN(facilityLng) && (
          <Marker position={[facilityLat, facilityLng]} icon={facilityIcon}>
            <Popup>
              <strong>{facility?.name}</strong>
              <div className="text-xs text-muted-foreground">Health facility</div>
            </Popup>
          </Marker>
        )}

        {communities.map((c, i) => {
          if (!c.latitude || !c.longitude) return null;
          const lat = parseFloat(c.latitude);
          const lng = parseFloat(c.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;
          const color =
            c.strategy === "outreach"
              ? "#f59e0b"
              : c.strategy === "mobile"
              ? "#10b981"
              : "#2563eb";
          const icon = buildNumberedIcon(i + 1, color, selectedIdx === i);
          return (
            <Marker
              key={c.rowId}
              position={[lat, lng]}
              icon={icon}
              draggable={!readOnly}
              eventHandlers={{
                dragend: (e: any) => {
                  const ll = e.target.getLatLng();
                  onPinDrag(i, ll.lat, ll.lng);
                },
                click: () => onPinClick(i),
              }}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold">{c.name || `Community #${i + 1}`}</div>
                  <div className="text-muted-foreground">
                    {lat.toFixed(5)}, {lng.toFixed(5)}
                  </div>
                  <div className="text-muted-foreground">Strategy: {c.strategy}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Unused colour locals kept for tree-shaking-friendly variable usage */}
        <span style={{ display: "none" }}>{[pinBlue, pinGreen, pinAmber].length}</span>
      </MapContainer>
      <div className="absolute top-2 right-2 z-[400] flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (populationUnavailable) {
              setInfoMode(false);
              return;
            }
            setInfoMode((v) => {
              const next = !v;
              if (next && !showPopulation) setShowPopulation(true);
              if (!next) setInfoPopup(null);
              return next;
            });
          }}
          disabled={populationUnavailable}
          title={
            populationUnavailable
              ? "Population layer is temporarily unavailable."
              : infoMode
              ? "Click the map to add a community"
              : "Click the map to look up an estimated population"
          }
          className={`rounded-full px-3 py-1 text-xs font-medium shadow transition-colors inline-flex items-center gap-1 ${
            populationUnavailable
              ? "bg-muted text-muted-foreground cursor-not-allowed opacity-70"
              : infoMode
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-background/90 text-foreground hover:bg-background"
          }`}
          data-testid="button-toggle-population-info"
        >
          <HelpCircle className="h-3 w-3" />
          {infoMode ? "Info on" : "Info"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (populationUnavailable) return;
            setShowPopulation((v) => !v);
          }}
          disabled={populationUnavailable}
          title={
            populationUnavailable
              ? "Population layer is temporarily unavailable."
              : showPopulation
              ? "Hide population density"
              : "Show population density"
          }
          className={`rounded-full px-3 py-1 text-xs font-medium shadow transition-colors ${
            populationUnavailable
              ? "bg-muted text-muted-foreground cursor-not-allowed opacity-70"
              : showPopulation
              ? "bg-orange-600 text-white hover:bg-orange-700"
              : "bg-background/90 text-foreground hover:bg-background"
          }`}
          data-testid="button-toggle-population"
        >
          Population
        </button>
        <div className="flex flex-col gap-1 rounded-lg bg-background/90 p-1 shadow border border-border">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom in"
            aria-label="Zoom in"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground"
            data-testid="button-step2-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom out"
            aria-label="Zoom out"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground"
            data-testid="button-step2-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleLocate}
            title="Locate me"
            aria-label="Locate me"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground"
            data-testid="button-step2-locate"
          >
            <Locate className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleFitBounds}
            disabled={!canFitBounds}
            title="Fit all pins"
            aria-label="Fit all pins"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
            data-testid="button-step2-fit-bounds"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setBasemap((b) => (b === "osm" ? "satellite" : "osm"))}
            title={basemap === "osm" ? "Switch to satellite" : "Switch to street map"}
            aria-label={basemap === "osm" ? "Switch to satellite" : "Switch to street map"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground"
            data-testid="button-step2-basemap-toggle"
          >
            {basemap === "osm" ? <Satellite className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {showPopulation && (
        <div
          className="absolute bottom-4 left-4 z-[400] rounded-lg bg-background/90 px-2.5 py-1.5 text-[10px] shadow border border-border"
          data-testid="legend-population"
        >
          <div className="mb-1 font-semibold text-foreground">Population density</div>
          <div
            className="h-2 w-32 rounded"
            style={{
              background:
                "linear-gradient(to right, #ffffcc, #ffeda0, #fed976, #feb24c, #fd8d3c, #fc4e2a, #e31a1c, #b10026)",
            }}
          />
          <div className="mt-0.5 flex justify-between text-muted-foreground font-semibold">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      )}
      {(() => {
        const cells = catchmentPreview?.cells ?? [];
        const hasCells = cells.length > 0;
        const okValues = hasCells
          ? cells
              .filter((c) => c.status === "ok" && typeof c.value === "number")
              .map((c) => c.value as number)
          : [];
        const hasNoData = hasCells && cells.some((c) => c.status === "nodata");
        const hasError = hasCells && cells.some((c) => c.status === "error");
        const minV = okValues.length > 0 ? Math.min(...okValues) : null;
        const maxV = okValues.length > 0 ? Math.max(...okValues) : null;
        const ramp = ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"];
        const popDensityBottom = hasCells ? "bottom-[88px]" : "bottom-2";
        return (
          <>
            {showPopulation && !populationUnavailable && (
              <div
                className={`absolute ${popDensityBottom} right-2 z-[400] rounded-lg bg-background/90 px-2 py-1 text-[10px] shadow`}
              >
                <div className="mb-1 font-medium">Population density</div>
                <div
                  className="h-2 w-32 rounded"
                  style={{
                    background:
                      "linear-gradient(to right, #ffffcc, #ffeda0, #fed976, #feb24c, #fd8d3c, #fc4e2a, #e31a1c, #b10026)",
                  }}
                />
                <div className="mt-0.5 flex justify-between text-muted-foreground">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            )}
            {hasCells && (
              <div
                className="absolute bottom-2 right-2 z-[400] rounded-lg bg-background/90 px-2 py-1 text-[10px] shadow"
                data-testid="legend-catchment-cells"
              >
                <div className="mb-1 font-medium">Catchment cells (people/km2)</div>
                {minV != null && maxV != null ? (
                  <>
                    <div
                      className="h-2 w-32 rounded"
                      style={{
                        background: `linear-gradient(to right, ${ramp.join(", ")})`,
                      }}
                    />
                    <div className="mt-0.5 flex justify-between text-muted-foreground">
                      <span>{Math.round(minV).toLocaleString()}</span>
                      <span>{Math.round(maxV).toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">No sampled values</div>
                )}
                {(hasNoData || hasError) && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {hasNoData && (
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block h-3 w-4 rounded-sm border border-dashed"
                          style={{ borderColor: "#6b7280", background: "#9ca3af66" }}
                        />
                        No data
                      </span>
                    )}
                    {hasError && (
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block h-3 w-4 rounded-sm border border-dashed"
                          style={{ borderColor: "#7f1d1d", background: "#dc262640" }}
                        />
                        Lookup failed
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        );
      })()}
      <div className="absolute bottom-2 left-2 z-[400] flex flex-wrap gap-2 rounded-lg bg-background/90 px-2 py-1 text-[10px] shadow">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-600" />
          Facility
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
          Fixed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          Outreach
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Mobile
        </span>
      </div>
    </div>
  );
}

export function Step3({
  risk,
  setRisk,
  errorRowId,
  errorMessage,
  onClearError,
}: {
  risk: any[];
  setRisk: (v: any[]) => void;
  errorRowId?: string;
  errorMessage?: string;
  onClearError?: () => void;
}) {
  const errorRowRef = useRef<HTMLTableRowElement | null>(null);

  // Scroll the flagged risk row into view and focus it whenever a new
  // validation error points at this step. The row carries tabIndex={-1} so
  // it can receive focus even though its only controls are sliders/checkboxes.
  useEffect(() => {
    if (errorRowId && errorRowRef.current) {
      errorRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      errorRowRef.current.focus();
    }
  }, [errorRowId]);

  const upd = (i: number, patch: any) => {
    const next = [...risk];
    next[i] = { ...next[i], ...patch };
    setRisk(next);
    // Editing the flagged row clears the highlight.
    if (errorRowId && `htr-${i}` === errorRowId) onClearError?.();
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-2">Community</th>
            <th className="p-2">Distance</th>
            <th className="p-2">Terrain</th>
            <th className="p-2">Season</th>
            <th className="p-2">Insecurity</th>
            <th className="p-2">Missed</th>
            <th className="p-2">Zero-dose</th>
          </tr>
        </thead>
        <tbody>
          {risk.map((r, i) => {
            const isError = errorRowId != null && `htr-${i}` === errorRowId;
            return (
            <tr
              key={i}
              ref={isError ? errorRowRef : undefined}
              tabIndex={isError ? -1 : undefined}
              className={`border-b outline-none ${isError ? "ring-1 ring-destructive" : ""}`}
            >
              <td className="p-2">
                {r.name}
                {isError && errorMessage && (
                  <p
                    className="mt-1 text-xs text-destructive"
                    data-testid="risk-row-error"
                  >
                    {errorMessage}
                  </p>
                )}
              </td>
              {(["distance", "terrain", "season", "insecurity"] as const).map((k) => (
                <td key={k} className="p-2">
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[r[k]]}
                      min={1}
                      max={5}
                      step={1}
                      onValueChange={(v) => upd(i, { [k]: v[0] })}
                      className="w-24"
                    />
                    <span className="w-4 text-xs">{r[k]}</span>
                  </div>
                </td>
              ))}
              <td className="p-2">
                <Checkbox checked={r.missed} onCheckedChange={(v) => upd(i, { missed: !!v })} />
              </td>
              <td className="p-2">
                <Checkbox checked={r.zeroDose} onCheckedChange={(v) => upd(i, { zeroDose: !!v })} />
              </td>
            </tr>
            );
          })}
          {risk.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-center text-muted-foreground">
                Finish Step 2 first.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Step4({
  calendar,
  setCalendar,
  generate,
  errorRowId,
  errorMessage,
  onClearError,
  communities,
}: {
  calendar: any[];
  setCalendar: (v: any[]) => void;
  generate: (months: number, startYear?: number, startMonth?: number) => void;
  errorRowId?: string;
  errorMessage?: string;
  onClearError?: () => void;
  communities: any[];
}) {
  // Chosen calendar length, in months. Drives how many monthly sessions are
  // generated per community.
  const [period, setPeriod] = useState("12");
  // Chosen start month/year for the generated calendar. Defaults to the current
  // month so behaviour is unchanged when the planner doesn't touch it.
  const now = new Date();
  const [startMonth, setStartMonth] = useState(String(now.getMonth()));
  const [startYear, setStartYear] = useState(String(now.getFullYear()));
  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  // Offer the current year plus a few ahead so planners can build next-year
  // microplans in advance.
  const YEAR_OPTIONS = Array.from(
    { length: 4 },
    (_, i) => now.getFullYear() + i,
  );
  // Whether the chosen start month/year falls before the current month. Used to
  // surface a gentle, non-blocking warning since past months can collide with
  // the >=7-day lead-time check later in the wizard.
  const startIsInPast =
    Number(startYear) < now.getFullYear() ||
    (Number(startYear) === now.getFullYear() &&
      Number(startMonth) < now.getMonth());
  const errorRowRef = useRef<HTMLInputElement | null>(null);

  // Scroll the flagged row into view and focus its date input whenever a new
  // validation error points at this step.
  useEffect(() => {
    if (errorRowId && errorRowRef.current) {
      errorRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      errorRowRef.current.focus();
    }
  }, [errorRowId]);

  const upd = (i: number, patch: any) => {
    const next = [...calendar];
    next[i] = { ...next[i], ...patch };
    setCalendar(next);
    // Editing the flagged row clears the highlight so the inline message
    // doesn't linger once the planner has acted on it.
    if (errorRowId && calendar[i]?.rowId === errorRowId) onClearError?.();
  };
  const remove = (i: number) => setCalendar(calendar.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Label className="text-xs text-muted-foreground">Start month</Label>
        <Select value={startMonth} onValueChange={setStartMonth}>
          <SelectTrigger className="w-36" data-testid="select-calendar-start-month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={i} value={String(i)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={startYear} onValueChange={setStartYear}>
          <SelectTrigger className="w-28" data-testid="select-calendar-start-year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="text-xs text-muted-foreground">Calendar period</Label>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44" data-testid="select-calendar-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 month</SelectItem>
            <SelectItem value="3">Quarterly (3 months)</SelectItem>
            <SelectItem value="6">6 months</SelectItem>
            <SelectItem value="12">12 months</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            generate(Number(period), Number(startYear), Number(startMonth))
          }
          data-testid="button-generate-calendar"
        >
          Generate calendar
        </Button>
      </div>
      {startIsInPast && (
        <p
          className="text-right text-xs text-amber-600 dark:text-amber-500"
          data-testid="text-start-month-past-warning"
        >
          This start month is in the past - some sessions may fail the lead-time
          check.
        </p>
      )}
      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b bg-background text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2">Community</th>
              <th className="p-2">Target Pop.</th>
              <th className="p-2">Distance</th>
              <th className="p-2">Strategy</th>
              <th className="p-2">Date</th>
              <th className="p-2">Type</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {calendar.map((c, i) => {
              const isError = errorRowId != null && c.rowId === errorRowId;
              const matched = communities.find(comm => comm.name === c.name || comm.villageId === c.villageId);
              const targetPop = matched?.targetPopulation ?? "-";
              const distance = matched?.distanceToFacility != null ? `${Number(matched.distanceToFacility).toFixed(1)} km` : "-";
              const strategy = matched?.strategy ?? "-";
              return (
                <tr key={c.rowId} className="border-b">
                  <td className="p-1">{c.name}</td>
                  <td className="p-1 text-xs text-muted-foreground font-mono">{Number(targetPop).toLocaleString()}</td>
                  <td className="p-1 text-xs text-muted-foreground font-mono">{distance}</td>
                  <td className="p-1 text-xs capitalize text-muted-foreground">{strategy}</td>
                  <td className="p-1">
                    <Input
                      ref={isError ? errorRowRef : undefined}
                      type="date"
                      className={isError ? "border-destructive ring-1 ring-destructive" : undefined}
                      value={c.scheduledDate}
                      onChange={(e) => upd(i, { scheduledDate: e.target.value })}
                      data-testid={`input-session-date-${i}`}
                    />
                    {isError && errorMessage && (
                      <p
                        className="mt-1 text-xs text-destructive"
                        data-testid="calendar-row-error"
                      >
                        {errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="p-1">
                    <Select value={c.sessionType} onValueChange={(v) => upd(i, { sessionType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="static">Static</SelectItem>
                        <SelectItem value="outreach">Outreach</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-1">
                    <Button size="icon" variant="ghost" onClick={() => remove(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {calendar.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  No sessions yet - choose a period and click "Generate calendar" to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Reusable inline AddStaffDialog component inside the wizard to easily register staff on the fly
export function AddStaffDialog({ facilityId }: { facilityId: number | null }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("vaccinator");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { data: tenant } = useQuery<any>({ queryKey: ["/api/me/tenant"] });
  const countryConfig = getCountryConfig(tenant);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId) return;
    if (!fullName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    if (phone.trim()) {
      const phoneVal = countryConfig.formatSpec.validatePhone(phone.trim());
      if (!phoneVal.valid) {
        toast({ title: "Invalid Phone Number", description: phoneVal.message, variant: "destructive" });
        return;
      }
    }

    try {
      setSubmitting(true);
      await apiRequest("POST", `/api/facilities/${facilityId}/staff`, {
        fullName: fullName.trim(),
        role,
        contactPhone: phone.trim() ? countryConfig.formatSpec.normalizePhone(phone.trim()) : null,
        isActive: true,
      });

      // Refetch the staff roster so dropdowns update immediately
      await queryClient.invalidateQueries({ queryKey: ["/api/facilities", facilityId, "staff"] });

      toast({
        title: "Staff Added",
        description: `Successfully added ${fullName} to the roster.`,
      });
      setOpen(false);
      setFullName("");
      setPhone("");
    } catch (error: any) {
      toast({
        title: "Failed to add staff",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!facilityId) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} type="button">
        <Plus className="mr-1 h-4 w-4" /> Add Staff Member
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]" data-testid="dialog-add-staff-inline">
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
              <DialogDescription>
                Register a new vaccinator, recorder, or supervisor for this facility.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="staff-name">Full Name</Label>
                <Input
                  id="staff-name"
                  placeholder="e.g. Mary Tembo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="staff-role">Role / Position</Label>
                <Select value={role} onValueChange={setRole} disabled={submitting}>
                  <SelectTrigger id="staff-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vaccinator">Vaccinator</SelectItem>
                    <SelectItem value="recorder">Recorder</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="facility_in_charge">Facility In-Charge</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="staff-phone">Phone Number</Label>
                <Input
                  id="staff-phone"
                  placeholder={countryConfig.phonePlaceholder || "+27 82 123 4567"}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Staff"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Step5({ staffing, setStaffing, facilityId }: { staffing: any[]; setStaffing: (v: any[]) => void; facilityId: number | null }) {
  const upd = (i: number, patch: any) => {
    const next = [...staffing];
    next[i] = { ...next[i], ...patch };
    setStaffing(next);
  };

  const { data: roster } = useQuery<any[]>({
    queryKey: ["/api/facilities", facilityId, "staff"],
    enabled: !!facilityId,
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}/staff`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const staffOptions = roster || [];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center bg-muted/20 p-2 rounded-md border border-border/60">
        <span className="text-xs text-muted-foreground">Assign a vaccinator, recorder, and supervisor for each session day.</span>
        <AddStaffDialog facilityId={facilityId} />
      </div>
      <div className="max-h-[420px] overflow-x-auto">
        <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-2">Session day</th>
            <th className="p-2 w-48">Vaccinator</th>
            <th className="p-2 w-48">Recorder</th>
            <th className="p-2 w-48">Supervisor</th>
            <th className="p-2">Team</th>
            <th className="p-2">Target</th>
            <th className="p-2">Per-diem</th>
            <th className="p-2" title="Vitamin A Blue Caps (6-11 months)">Vit A Blue</th>
            <th className="p-2" title="Vitamin A Red Caps (12-59 months)">Vit A Red</th>
            <th className="p-2" title="Scissors / Sharps count">Scissors</th>
          </tr>
        </thead>
        <tbody>
          {staffing.map((s, i) => (
            <tr key={s.rowId} className="border-b">
              <td className="p-2 text-xs">{s.sessionLabel}</td>
              <td className="p-1">
                <Select value={s.vaccinator} onValueChange={(v) => upd(i, { vaccinator: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Select vaccinator" /></SelectTrigger>
                  <SelectContent>
                    {staffOptions.map(staff => (
                      <SelectItem key={staff.id} value={staff.name}>
                        {staff.name} ({staff.role})
                      </SelectItem>
                    ))}
                    {s.vaccinator && !staffOptions.some(st => st.name === s.vaccinator) && (
                      <SelectItem value={s.vaccinator}>{s.vaccinator} (custom)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </td>
              <td className="p-1">
                <Select value={s.recorder} onValueChange={(v) => upd(i, { recorder: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Select recorder" /></SelectTrigger>
                  <SelectContent>
                    {staffOptions.map(staff => (
                      <SelectItem key={staff.id} value={staff.name}>
                        {staff.name} ({staff.role})
                      </SelectItem>
                    ))}
                    {s.recorder && !staffOptions.some(st => st.name === s.recorder) && (
                      <SelectItem value={s.recorder}>{s.recorder} (custom)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </td>
              <td className="p-1">
                <Select value={s.supervisor} onValueChange={(v) => upd(i, { supervisor: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Select supervisor" /></SelectTrigger>
                  <SelectContent>
                    {staffOptions.map(staff => (
                      <SelectItem key={staff.id} value={staff.name}>
                        {staff.name} ({staff.role})
                      </SelectItem>
                    ))}
                    {s.supervisor && !staffOptions.some(st => st.name === s.supervisor) && (
                      <SelectItem value={s.supervisor}>{s.supervisor} (custom)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </td>
              <td className="p-1">
                <Select value={s.teamType} onValueChange={(v) => upd(i, { teamType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="house_to_house">House-to-house</SelectItem>
                  </SelectContent>
                </Select>
              </td>
              <td className="p-1"><Input type="number" value={s.target} onChange={(e) => upd(i, { target: e.target.value })} /></td>
              <td className="p-1"><Input type="number" value={s.perDiem} onChange={(e) => upd(i, { perDiem: e.target.value })} /></td>
              {/* Sheet 3 - Vitamin A + Scissors */}
              <td className="p-1"><Input type="number" min={0} placeholder="0" className="w-16" value={s.vitaminABlueCaps ?? ""} onChange={(e) => upd(i, { vitaminABlueCaps: e.target.value })} title="Vitamin A Blue Caps (6-11 months)" /></td>
              <td className="p-1"><Input type="number" min={0} placeholder="0" className="w-16" value={s.vitaminARedCaps ?? ""} onChange={(e) => upd(i, { vitaminARedCaps: e.target.value })} title="Vitamin A Red Caps (12-59 months)" /></td>
              <td className="p-1"><Input type="number" min={0} placeholder="0" className="w-16" value={s.scissorsCount ?? ""} onChange={(e) => upd(i, { scissorsCount: e.target.value })} title="Scissors / Sharps" /></td>
            </tr>
          ))}
          {staffing.length === 0 && (
            <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Finish Step 4 first.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// Reusable inline AddColdChainDialog component inside the wizard to easily register equipment on the fly
export function AddColdChainDialog({ facilityId, onAdded }: { facilityId: number | null; onAdded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [equipmentType, setEquipmentType] = useState("cold_box");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [capacityLiters, setCapacityLiters] = useState("");
  const [condition, setCondition] = useState("functional");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId) return;

    try {
      setSubmitting(true);
      await apiRequest("POST", `/api/facilities/${facilityId}/cold-chain`, {
        equipmentType,
        brand: brand.trim() || null,
        model: model.trim() || null,
        serialNumber: serialNumber.trim() || null,
        capacityLiters: capacityLiters ? parseFloat(capacityLiters) : null,
        condition,
        isActive: true,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/facilities", facilityId, "cold-chain"] });

      toast({
        title: "Equipment Registered",
        description: `Successfully added ${equipmentType.replace("_", " ")} to the facility inventory.`,
      });
      setOpen(false);
      setBrand("");
      setModel("");
      setSerialNumber("");
      setCapacityLiters("");
      if (onAdded) onAdded();
    } catch (error: any) {
      toast({
        title: "Failed to add equipment",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!facilityId) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} type="button">
        <Plus className="mr-1 h-4 w-4" /> Add Equipment
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Register Cold Chain Equipment</DialogTitle>
              <DialogDescription>
                Add cold boxes, vaccine carriers, or refrigerators to this facility's active inventory.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="equip-type">Equipment Type</Label>
                <Select value={equipmentType} onValueChange={setEquipmentType} disabled={submitting}>
                  <SelectTrigger id="equip-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cold_box">Cold Box</SelectItem>
                    <SelectItem value="vaccine_carrier">Vaccine Carrier</SelectItem>
                    <SelectItem value="refrigerator">Refrigerator</SelectItem>
                    <SelectItem value="freezer">Freezer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="equip-brand">Brand</Label>
                <Input
                  id="equip-brand"
                  placeholder="e.g. Apex, Dometic"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="equip-model">Model</Label>
                <Input
                  id="equip-model"
                  placeholder="e.g. CFX 35"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="equip-serial">Serial Number</Label>
                  <Input
                    id="equip-serial"
                    placeholder="S/N"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="equip-capacity">Capacity (Liters)</Label>
                  <Input
                    id="equip-capacity"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 20"
                    value={capacityLiters}
                    onChange={(e) => setCapacityLiters(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="equip-condition">Condition</Label>
                <Select value={condition} onValueChange={setCondition} disabled={submitting}>
                  <SelectTrigger id="equip-condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="functional">Functional</SelectItem>
                    <SelectItem value="needs_repair">Needs Repair</SelectItem>
                    <SelectItem value="non_functional">Non-Functional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Equipment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Step6({
  vaccines,
  setVaccines,
  coldChain,
  setColdChain,
  errorRowId,
  errorMessage,
  onClearError,
  facilityId,
  targetInfants = 0,
  communities = [],
}: {
  vaccines: any[];
  setVaccines: (v: any[]) => void;
  coldChain: any;
  setColdChain: (v: any) => void;
  errorRowId?: string;
  errorMessage?: string;
  onClearError?: () => void;
  facilityId: number | null;
  targetInfants?: number;
  communities?: any[];
}) {
  const errorRowRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const { user } = useAuth(); // needed for Requisition Slip "Prepared By" field
  const [requisitionOpen, setRequisitionOpen] = useState(false);

  // Scroll the flagged vaccine row into view and focus its target input
  // whenever a new validation error points at this step.
  useEffect(() => {
    if (errorRowId && errorRowRef.current) {
      errorRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      errorRowRef.current.focus();
    }
  }, [errorRowId]);

  const upd = (i: number, patch: any) => {
    const next = [...vaccines];
    next[i] = { ...next[i], ...patch };
    setVaccines(next);
    // Editing the flagged row clears the highlight.
    if (errorRowId && `vr-${i}` === errorRowId) onClearError?.();
  };

  const { data: facility } = useQuery<any>({
    queryKey: ["/api/facilities", facilityId],
    enabled: !!facilityId,
  });

  const { data: tenant } = useQuery<any>({
    queryKey: ["/api/me/tenant"],
  });

  const { data: allProvinces } = useQuery<any[]>({
    queryKey: ["/api/provinces"],
  });

  const { data: allDistricts } = useQuery<any[]>({
    queryKey: ["/api/districts"],
  });

  const facilityDistrict = allDistricts?.find((d) => d.id === facility?.districtId);
  const facilityProvince = allProvinces?.find((p) => p.id === facilityDistrict?.provinceId);

  const districtName = facilityDistrict?.name || "-";
  const provinceName = facilityProvince?.name || "-";
  const countryName = tenant?.name || "-";

  const { data: stockBalance } = useQuery<any>({
    queryKey: ["/api/facilities", facilityId, "stock-balance"],
    enabled: !!facilityId,
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}/stock-balance`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    }
  });

  const { data: dbColdChain = [], refetch: refetchDbColdChain } = useQuery<any[]>({
    queryKey: ["/api/facilities", facilityId, "cold-chain"],
    enabled: !!facilityId,
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}/cold-chain`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const availableColdBoxes = dbColdChain.filter(
    (e) => e.equipmentType === "cold_box" && e.condition === "functional"
  ).length;

  const availableCarriers = dbColdChain.filter(
    (e) => e.equipmentType === "vaccine_carrier" && e.condition === "functional"
  ).length;

  const reqColdBoxes = parseInt(coldChain.coldBoxes || "0", 10);
  const reqCarriers = parseInt(coldChain.carriers || "0", 10);

  const coldBoxWarning = reqColdBoxes > availableColdBoxes;
  const carrierWarning = reqCarriers > availableCarriers;

  const sumCommunityUnder1 = communities.reduce((acc, c) => acc + Math.round(parseFloat(c.targetPopulation || "0") * 0.04), 0);

  // Sync vaccine targets on hydration if empty
  useEffect(() => {
    const defaultTgt = targetInfants > 0 ? targetInfants : sumCommunityUnder1;
    if (defaultTgt > 0) {
      const allZeroOrEmpty = vaccines.every(v => v.target === "0" || !v.target || v.target === "");
      if (allZeroOrEmpty) {
        setVaccines(vaccines.map(v => ({ ...v, target: String(defaultTgt) })));
      }
    }
  }, [targetInfants, sumCommunityUnder1]);

  const handleSyncTargets = () => {
    const defaultTgt = targetInfants > 0 ? targetInfants : sumCommunityUnder1;
    if (defaultTgt > 0) {
      setVaccines(vaccines.map(v => ({ ...v, target: String(defaultTgt) })));
      toast({
        title: "Targets Synced",
        description: `Synced routine vaccine targets to ${defaultTgt} (from Step 1/2).`,
      });
    } else {
      toast({
        title: "Sync Failed",
        description: "No target infants entered in Step 1 or Step 2 catchment population.",
        variant: "destructive",
      });
    }
  };

  const stockMap = new Map<string, number>();
  if (stockBalance && Array.isArray(stockBalance.stock)) {
    stockBalance.stock.forEach((s: any) => {
      const key = normalizeStockVaccineName(String(s.antigen ?? s.vaccineName ?? ""));
      if (key) stockMap.set(key, Number(s.balance ?? s.quantityDoses ?? 0));
    });
  } else if (stockBalance && typeof stockBalance === "object") {
    Object.entries(stockBalance).forEach(([name, balance]) => {
      const key = normalizeStockVaccineName(name);
      if (key) stockMap.set(key, Number(balance ?? 0));
    });
  }

  // Calculate stock deficiencies
  const deficiencies = vaccines.map((v) => {
    const tgt = parseInt(v.target || "0", 10);
    const w = parseFloat(v.wastage || "0");
    const dosesReq = tgt * v.doses;
    const requiredDoses = Math.ceil(dosesReq * (1 + w / 100));

    // We assume 10 doses per vial
    const requiredVials = Math.ceil(requiredDoses / 10);

    const stockAvailable = stockMap.get(normalizeStockVaccineName(v.name)) ?? 0;
    const shortageDoses = Math.max(0, requiredDoses - stockAvailable);
    const shortageVials = Math.ceil(shortageDoses / 10);

    return {
      antigen: v.name,
      requiredDoses,
      requiredVials,
      stockAvailable,
      shortageDoses,
      shortageVials,
      hasShortage: shortageDoses > 0,
    };
  });

  const hasAnyShortage = deficiencies.some(d => d.hasShortage);

  // ─────────────────────────────────────────────────────────────────────────
  // IMMUNIZATION SESSION LOGISTICS CATALOGUE FORECASTING (Syringes, Diluents, PPEs, Data Tools)
  // ─────────────────────────────────────────────────────────────────────────
  const totalSessionDays = communities?.length || 1;
  const totalTargetInfants = targetInfants > 0 ? targetInfants : (sumCommunityUnder1 > 0 ? sumCommunityUnder1 : 50);

  const bcgVaccine = vaccines.find(v => v.name.toUpperCase().includes("BCG"));
  const bcgTarget = bcgVaccine ? parseInt(bcgVaccine.target || "0", 10) : totalTargetInfants;
  const bcgWastage = bcgVaccine ? parseFloat(bcgVaccine.wastage || "50") : 50;
  const bcgDosesWastage = Math.ceil(bcgTarget * 1 * (1 + bcgWastage / 100));
  const bcgVials = Math.ceil(bcgDosesWastage / 20);

  const mrVaccine = vaccines.find(v => v.name.toUpperCase().includes("MR") || v.name.toUpperCase().includes("MEASLES"));
  const mrTarget = mrVaccine ? parseInt(mrVaccine.target || "0", 10) : totalTargetInfants;
  const mrWastage = mrVaccine ? parseFloat(mrVaccine.wastage || "25") : 25;
  const mrDosesWastage = Math.ceil(mrTarget * 1 * (1 + mrWastage / 100));
  const mrVials = Math.ceil(mrDosesWastage / 10);

  let otherInjectableDoses = 0;
  vaccines.forEach(v => {
    const nameUpper = v.name.toUpperCase();
    if (!nameUpper.includes("BCG") && !nameUpper.includes("OPV") && !nameUpper.includes("ROTA")) {
      const tgt = parseInt(v.target || "0", 10);
      const w = parseFloat(v.wastage || "10");
      otherInjectableDoses += Math.ceil(tgt * v.doses * (1 + w / 100));
    }
  });

  const adSyringes005ml = Math.ceil(bcgDosesWastage * 1.1);
  const adSyringes05ml = Math.ceil(otherInjectableDoses * 1.1);
  const reconSyringes5ml = Math.ceil(bcgVials * 1.05);
  const reconSyringes2ml = Math.ceil(mrVials * 1.05);
  const totalSyringes = adSyringes005ml + adSyringes05ml + reconSyringes5ml + reconSyringes2ml;

  const safetyBoxes5L = Math.ceil(totalSyringes / 100);
  const bcgDiluentAmpoules = bcgVials;
  const mrDiluentAmpoules = mrVials;

  const examinationGlovesPairs = totalSessionDays * 2 * 2;
  const handSanitizerBottles = Math.ceil(totalSessionDays / 5) || 1;
  const cottonWoolRolls = Math.ceil(totalSyringes / 250) || 1;
  const tallySheets = totalSessionDays * 2;
  const childHealthCards = Math.ceil(totalTargetInfants * 1.05);
  const registerBooklets = Math.ceil(totalTargetInfants / 200) || 1;
  const aefiReportForms = 1;
  const vaccineCarriers = coldChain.carriers || Math.max(1, Math.ceil(totalSessionDays / 3));
  const icePacks = vaccineCarriers * 4;
  const foamPads = vaccineCarriers;

  const sessionLogisticsItems = [
    { category: "Injection Devices", item: "Auto-Disable (AD) Syringes 0.05 ml (BCG)", qty: adSyringes005ml, unit: "pieces", formula: "1 per BCG dose + 10% wastage" },
    { category: "Injection Devices", item: "Auto-Disable (AD) Syringes 0.5 ml (Penta/PCV/MR/IPV)", qty: adSyringes05ml, unit: "pieces", formula: "1 per injectable dose + 10% wastage" },
    { category: "Injection Devices", item: "Reconstitution Syringes 5 ml (BCG)", qty: reconSyringes5ml, unit: "pieces", formula: "1 per BCG vial + 5% buffer" },
    { category: "Injection Devices", item: "Reconstitution Syringes 2 ml (MR)", qty: reconSyringes2ml, unit: "pieces", formula: "1 per MR vial + 5% buffer" },
    { category: "Diluents", item: "BCG Vaccine Diluent", qty: bcgDiluentAmpoules, unit: "ampoules", formula: "1 ampoule per BCG vial" },
    { category: "Diluents", item: "MR Vaccine Diluent", qty: mrDiluentAmpoules, unit: "ampoules", formula: "1 ampoule per MR vial" },
    { category: "Waste Management", item: "Safety Boxes (5 Litre)", qty: safetyBoxes5L, unit: "boxes", formula: "1 box per 100 used syringes" },
    { category: "PPE & Hygiene", item: "Examination Gloves", qty: examinationGlovesPairs, unit: "pairs", formula: "2 pairs per HCW / session day" },
    { category: "PPE & Hygiene", item: "Hand Sanitizer (500 ml)", qty: handSanitizerBottles, unit: "bottles", formula: "1 bottle per 5 session days" },
    { category: "PPE & Hygiene", item: "Absorbent Cotton Wool (500g)", qty: cottonWoolRolls, unit: "rolls", formula: "1 roll per 250 vaccinations" },
    { category: "Recording Tools", item: "EPI Tallysheets (Routine/Campaign)", qty: tallySheets, unit: "sheets", formula: "2 sheets per session day" },
    { category: "Recording Tools", item: "Child Health Immunization Cards (HBR)", qty: childHealthCards, unit: "cards", formula: "1 card per target infant + 5% buffer" },
    { category: "Recording Tools", item: "Facility Immunization Register Book", qty: registerBooklets, unit: "booklets", formula: "1 booklet per 200 infants" },
    { category: "Recording Tools", item: "AEFI Investigation & Reporting Form", qty: aefiReportForms, unit: "sets", formula: "1 set per health facility" },
    { category: "Cold Chain Accessories", item: "Vaccine Carriers (4 Litre)", qty: vaccineCarriers, unit: "carriers", formula: "1 per active session day / team" },
    { category: "Cold Chain Accessories", item: "Cool Water Packs / Ice Packs", qty: icePacks, unit: "packs", formula: "4 icepacks per carrier" },
    { category: "Cold Chain Accessories", item: "Foam Pads", qty: foamPads, unit: "pads", formula: "1 pad per carrier" },
  ];

  return (
    <div className="space-y-4">
      {hasAnyShortage && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3" data-testid="stock-warning-box">
          <div className="flex items-start gap-2.5 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">Vaccine Stock Deficiency Warning</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current health facility stock is insufficient to cover the planned target population requirements.
              </p>
            </div>
          </div>

          <table className="w-full text-xs text-left border-collapse mt-2">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-semibold">
                <th className="py-1">Antigen</th>
                <th className="py-1 text-right">Required (Doses)</th>
                <th className="py-1 text-right">Available (Doses)</th>
                <th className="py-1 text-right text-destructive">Shortage (Doses / Vials)</th>
              </tr>
            </thead>
            <tbody>
              {deficiencies.filter(d => d.hasShortage).map(d => (
                <tr key={d.antigen} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5 font-medium">{d.antigen}</td>
                  <td className="py-1.5 text-right font-mono">{d.requiredDoses.toLocaleString()}</td>
                  <td className="py-1.5 text-right font-mono">{d.stockAvailable.toLocaleString()}</td>
                  <td className="py-1.5 text-right text-destructive font-mono font-semibold">
                    -{d.shortageDoses.toLocaleString()} ({d.shortageVials} vials)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end gap-2 pt-2 border-t border-destructive/10">
            <Button
              size="sm"
              variant="outline"
              className="text-xs font-semibold"
              onClick={() => setRequisitionOpen(true)}
            >
              Generate Requisition Slip
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Routine Vaccines Target Requirements</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={handleSyncTargets}
          >
             Sync Targets with Step 1/2 ({targetInfants > 0 ? targetInfants : sumCommunityUnder1} infants)
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Antigen</th>
                <th className="p-2">Target pop.</th>
                <th className="p-2">Doses/child</th>
                <th className="p-2">Wastage %</th>
                <th className="p-2">Doses w/ wastage</th>
                <th className="p-2">Vials (10/vial)</th>
              </tr>
            </thead>
            <tbody>
              {vaccines.map((v, i) => {
                const tgt = parseInt(v.target || "0", 10);
                const w = parseFloat(v.wastage || "0");
                const dosesReq = tgt * v.doses;
                const total = Math.ceil(dosesReq * (1 + w / 100));
                const vials = Math.ceil(total / 10);
                const isError = errorRowId != null && `vr-${i}` === errorRowId;
                return (
                  <tr key={v.name} className={`border-b ${isError ? "ring-1 ring-destructive" : ""}`}>
                    <td className="p-2 font-medium">{v.name}</td>
                    <td className="p-1">
                      <Input
                        ref={isError ? errorRowRef : undefined}
                        type="number"
                        className={isError ? "border-destructive ring-1 ring-destructive" : undefined}
                        value={v.target}
                        onChange={(e) => upd(i, { target: e.target.value })}
                      />
                      {isError && errorMessage && (
                        <p
                          className="mt-1 text-xs text-destructive"
                          data-testid="vaccine-row-error"
                        >
                          {errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="p-2 text-center">{v.doses}</td>
                    <td className="p-1"><Input type="number" value={v.wastage} onChange={(e) => upd(i, { wastage: e.target.value })} /></td>
                    <td className="p-2">{total.toLocaleString()}</td>
                    <td className="p-2">{vials.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── BUNDLED IMMUNIZATION SESSION LOGISTICS CATALOGUE ─────────────────── */}
      <div className="space-y-2 border rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Bundled Immunization Session Logistics & Equipment Catalogue
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically calculated for syringes, diluents, safety boxes, PPEs, tallysheets, and data tools based on target doses ({totalTargetInfants} infants / {totalSessionDays} session days).
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-semibold border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
            {sessionLogisticsItems.length} Logistics Catalogue Items
          </Badge>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card mt-2">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/60 text-muted-foreground font-bold uppercase text-[10px]">
                <th className="p-2.5">Category</th>
                <th className="p-2.5">Item Name</th>
                <th className="p-2.5 text-right">Forecasted Qty</th>
                <th className="p-2.5">Unit</th>
                <th className="p-2.5">WHO / EPI Standard Formula</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sessionLogisticsItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-muted/30 transition-colors">
                  <td className="p-2.5">
                    <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wider">
                      {item.category}
                    </Badge>
                  </td>
                  <td className="p-2.5 font-semibold text-foreground">{item.item}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {item.qty.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-muted-foreground capitalize">{item.unit}</td>
                  <td className="p-2.5 text-muted-foreground italic">{item.formula}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Required Logistics & Cold Chain Sizing
          </span>
          <AddColdChainDialog facilityId={facilityId} onAdded={refetchDbColdChain} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <NumberField label="Cold boxes required" value={coldChain.coldBoxes} onChange={(v) => setColdChain({ ...coldChain, coldBoxes: v })} />
            <div className="text-xs text-muted-foreground flex flex-col gap-0.5 mt-1">
              <span>Inventory: <strong>{availableColdBoxes}</strong> functional cold boxes.</span>
              {coldBoxWarning && (
                <span className="text-destructive font-medium">
                  Warning: Required cold boxes exceed inventory ({availableColdBoxes} available).
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <NumberField label="Ice packs required" value={coldChain.icePacks} onChange={(v) => setColdChain({ ...coldChain, icePacks: v })} />
            <div className="text-xs text-muted-foreground mt-1">
              <span>Inventory: Standard sets matching cold boxes.</span>
            </div>
          </div>
          <div className="space-y-1">
            <NumberField label="Carriers required" value={coldChain.carriers} onChange={(v) => setColdChain({ ...coldChain, carriers: v })} />
            <div className="text-xs text-muted-foreground flex flex-col gap-0.5 mt-1">
              <span>Inventory: <strong>{availableCarriers}</strong> functional carriers.</span>
              {carrierWarning && (
                <span className="text-destructive font-medium">
                  Warning: Required carriers exceed inventory ({availableCarriers} available).
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={requisitionOpen} onOpenChange={setRequisitionOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-requisition-slip">
          <DialogHeader className="print:hidden">
            <DialogTitle>Stock Requisition Slip</DialogTitle>
            <DialogDescription>
              Review and print the suggested stock requisition slip for this microplan.
            </DialogDescription>
          </DialogHeader>

          {/* Printable Area */}
          <div className="p-6 border rounded-lg bg-card text-foreground font-sans print:border-0 print:p-0" id="requisition-print-area">
            {/* Header */}
            <div className="text-center space-y-1 pb-4 border-b">
              <h2 className="text-lg font-bold uppercase tracking-wider">Vaccine Requisition Slip</h2>
              <p className="text-xs text-muted-foreground">National Immunization Programme - Microplanning Logistics</p>
            </div>

            {/* Original Info Grid */}
            {/* <div className="grid grid-cols-2 gap-4 text-xs py-4">...</div> */}
            {/* Added geographical metadata (Country, Province, District, HF) & preparer details */}
            <div className="grid grid-cols-2 gap-4 text-xs py-4 border-b">
              <div className="space-y-2">
                <div>
                  <span className="font-semibold text-muted-foreground block uppercase text-[10px]">Country</span>
                  <span className="font-medium text-foreground text-sm">{countryName}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block uppercase text-[10px]">Province / State</span>
                  <span className="font-medium text-foreground text-sm">{provinceName}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block uppercase text-[10px]">District / County</span>
                  <span className="font-medium text-foreground text-sm">{districtName}</span>
                </div>
              </div>
              <div className="space-y-2 text-right">
                <div>
                  <span className="font-semibold text-muted-foreground block uppercase text-[10px]">Health Facility</span>
                  <span className="font-medium text-foreground text-sm">{facility?.name || "-"}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block uppercase text-[10px]">Prepared By</span>
                  <span className="font-medium text-foreground text-sm">{user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "-"}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block uppercase text-[10px]">Requisition Date</span>
                  <span className="font-medium text-foreground text-sm">{new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full text-xs text-left border-collapse mt-4">
              <thead>
                <tr className="border-b border-black font-semibold text-muted-foreground uppercase text-[10px]">
                  <th className="py-2">Antigen</th>
                  <th className="py-2 text-right">Doses Short</th>
                  <th className="py-2 text-right">Suggested Order (Vials)</th>
                  <th className="py-2 text-right">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {deficiencies.filter(d => d.hasShortage).map(d => (
                  <tr key={d.antigen} className="border-b border-border/60">
                    <td className="py-2.5 font-bold text-foreground">{d.antigen}</td>
                    <td className="py-2.5 text-right font-mono">{d.shortageDoses.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-primary">{d.shortageVials.toLocaleString()}</td>
                    <td className="py-2.5 text-right italic text-muted-foreground">For microplan target coverage</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Session Logistics & Equipment Catalogue Table in Requisition Slip */}
            <div className="mt-6 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Bundled Session Supplies & Logistics Requisition</h4>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-black font-semibold text-muted-foreground uppercase text-[10px]">
                    <th className="py-2">Category</th>
                    <th className="py-2">Catalogue Item</th>
                    <th className="py-2 text-right">Required Qty</th>
                    <th className="py-2">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-b">
                  {sessionLogisticsItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 font-medium text-muted-foreground text-[10px] uppercase">{item.category}</td>
                      <td className="py-1.5 font-semibold text-foreground">{item.item}</td>
                      <td className="py-1.5 text-right font-mono font-bold text-foreground">{item.qty.toLocaleString()}</td>
                      <td className="py-1.5 text-muted-foreground capitalize text-[10px]">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-12 text-center text-xs mt-8 border-t border-dashed">
              <div className="space-y-2">
                <div className="border-b border-black h-8 w-48 mx-auto flex items-end justify-center pb-1 font-medium text-foreground">
                  {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "-"}
                </div>
                <span className="font-medium text-muted-foreground uppercase text-[10px]">Prepared By (Logged In User)</span>
              </div>
              <div className="space-y-2">
                <div className="border-b border-black h-8 w-48 mx-auto" />
                <span className="font-medium text-muted-foreground uppercase text-[10px]">Approved By (District Logistics Officer)</span>
              </div>
            </div>
          </div>

          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setRequisitionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const printContent = document.getElementById("requisition-print-area")?.innerHTML;
                if (printContent) {
                  const printWindow = window.open("", "_blank");
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Vaccine Requisition Slip</title>
                          <style>
                            body { font-family: sans-serif; padding: 40px; color: #000; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border-bottom: 1px solid #000; padding: 8px; text-align: left; }
                            th { font-size: 10px; text-transform: uppercase; color: #555; }
                            .text-right { text-align: right; }
                            .text-center { text-align: center; }
                            .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
                            .pt-12 { padding-top: 48px; }
                            .border-b { border-bottom: 1px solid #000; }
                            .border-t { border-top: 1px solid #000; }
                            .mx-auto { margin-left: auto; margin-right: auto; }
                            .w-48 { width: 192px; }
                            .pb-4 { padding-bottom: 16px; }
                            .uppercase { text-transform: uppercase; }
                            .text-xs { font-size: 12px; }
                            .text-sm { font-size: 14px; }
                            .font-mono { font-family: monospace; }
                            .font-bold { font-weight: bold; }
                            .space-y-2 > * + * { margin-top: 8px; }
                            .text-muted-foreground { color: #666; }
                            .font-semibold { font-weight: 600; }
                            .font-medium { font-weight: 500; }
                            .block { display: block; }
                          </style>
                        </head>
                        <body>
                          ${printContent}
                          <script>
                            window.onload = function() { window.print(); window.close(); }
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }
                }
              }}
            >
              Print Requisition Slip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const MOB_CHANNELS = ["megaphone", "religious_leader", "sms", "radio", "community_meeting"];
const IEC_MATERIALS = ["posters", "leaflets", "banners", "stickers"];

export function Step7({
  mobilization,
  setMobilization,
  onDelete,
  errorRowId,
  errorMessage,
  onClearError,
}: {
  mobilization: any[];
  setMobilization: (v: any[]) => void;
  onDelete: (index: number) => void | Promise<void>;
  errorRowId?: string;
  errorMessage?: string;
  onClearError?: () => void;
}) {
  const errorRowRef = useRef<HTMLInputElement | null>(null);

  // Scroll the flagged mobilization row into view and focus its focal-point
  // input whenever a new validation error points at this step.
  useEffect(() => {
    if (errorRowId && errorRowRef.current) {
      errorRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      errorRowRef.current.focus();
    }
  }, [errorRowId]);

  const upd = (i: number, patch: any) => {
    const next = [...mobilization];
    next[i] = { ...next[i], ...patch };
    setMobilization(next);
    // Editing the flagged row clears the highlight.
    if (errorRowId && `mob-${i}` === errorRowId) onClearError?.();
  };
  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <div className="max-h-[420px] overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-2">Session day</th>
            <th className="p-2">Channels</th>
            <th className="p-2">Focal point</th>
            <th className="p-2">Phone</th>
            <th className="p-2">IEC materials</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {mobilization.map((m, i) => {
            const isError = errorRowId != null && `mob-${i}` === errorRowId;
            return (
            <tr key={m.rowId} className={`border-b align-top ${isError ? "ring-1 ring-destructive" : ""}`}>
              <td className="p-2 text-xs">{m.sessionLabel}</td>
              <td className="p-2">
                <div className="flex flex-wrap gap-1">
                  {MOB_CHANNELS.map((c) => (
                    <label key={c} className="flex items-center gap-1 text-xs">
                      <Checkbox checked={m.channels.includes(c)} onCheckedChange={() => upd(i, { channels: toggle(m.channels, c) })} />
                      {c.replace("_", " ")}
                    </label>
                  ))}
                </div>
              </td>
              <td className="p-1">
                <Input
                  ref={isError ? errorRowRef : undefined}
                  className={isError ? "border-destructive ring-1 ring-destructive" : undefined}
                  value={m.focalPoint}
                  onChange={(e) => upd(i, { focalPoint: e.target.value })}
                />
                {isError && errorMessage && (
                  <p
                    className="mt-1 text-xs text-destructive"
                    data-testid="mobilization-row-error"
                  >
                    {errorMessage}
                  </p>
                )}
              </td>
              <td className="p-1"><Input value={m.focalPhone} onChange={(e) => upd(i, { focalPhone: e.target.value })} /></td>
              <td className="p-2">
                <div className="flex flex-wrap gap-1">
                  {IEC_MATERIALS.map((c) => (
                    <label key={c} className="flex items-center gap-1 text-xs">
                      <Checkbox checked={m.iec.includes(c)} onCheckedChange={() => upd(i, { iec: toggle(m.iec, c) })} />
                      {c}
                    </label>
                  ))}
                </div>
              </td>
              <td className="p-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(i)}
                  data-testid={`button-delete-mobilization-${i}`}
                  aria-label="Delete mobilization row"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
            );
          })}
          {mobilization.length === 0 && (
            <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Finish Step 4 first.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- Step HFC Board (Sheet 9) ---------------------------------------------
export function StepHfcBoard({ facilityId }: { facilityId: number | null }) {
  const { toast } = useToast();
  const { data: tenant } = useQuery<any>({ queryKey: ["/api/me/tenant"] });
  const countryConfig = getCountryConfig(tenant);
  const { data: members = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/facilities/${facilityId}/hfc-committee`],
    enabled: !!facilityId,
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}/hfc-committee`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [form, setForm] = useState<any>({
    memberName: "", gender: "female", position: "Member",
    yearsOfService: "", isChairperson: false, contactPhone: "",
    committeeEstablishedDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  function resetForm() {
    setForm({ memberName: "", gender: "female", position: "Member", yearsOfService: "", isChairperson: false, contactPhone: "", committeeEstablishedDate: "" });
    setEditId(null);
  }

  async function handleSave() {
    if (!facilityId || !form.memberName.trim()) {
      toast({ title: "Member name is required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const url = editId
        ? `/api/facilities/${facilityId}/hfc-committee/${editId}`
        : `/api/facilities/${facilityId}/hfc-committee`;
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, yearsOfService: form.yearsOfService ? Number(form.yearsOfService) : null }),
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${facilityId}/hfc-committee`] });
      toast({ title: editId ? "Member updated" : "Member added" });
      resetForm();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!facilityId) return;
    try {
      await fetch(`/api/facilities/${facilityId}/hfc-committee/${id}`, { method: "DELETE", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${facilityId}/hfc-committee`] });
      toast({ title: "Member removed" });
    } catch { toast({ title: "Delete failed", variant: "destructive" }); }
  }

  return (
    <div className="space-y-5">
      {/* WhatToDo is rendered by the outer wizard wrapper (line 3157) for all steps */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">{editId ? "Edit HFC Member" : "Add HFC Member"}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Full Name *</Label>
            <Input value={form.memberName} onChange={(e) => setForm({ ...form, memberName: e.target.value })} placeholder="e.g. Mary Banda" />
          </div>
          <div>
            <Label className="text-xs">Gender</Label>
            <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Position</Label>
            <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Chairperson">Chairperson</SelectItem>
                <SelectItem value="Secretary">Secretary</SelectItem>
                <SelectItem value="Treasurer">Treasurer</SelectItem>
                <SelectItem value="Member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Years of Service</Label>
            <Input type="number" min={0} value={form.yearsOfService} onChange={(e) => setForm({ ...form, yearsOfService: e.target.value })} placeholder="0" />
          </div>
          <div>
            <Label className="text-xs">Contact Phone</Label>
            <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder={countryConfig.phonePlaceholder || "+27 82 123 4567"} />
          </div>
          <div>
            <Label className="text-xs">Committee Established</Label>
            <Input type="date" value={form.committeeEstablishedDate} onChange={(e) => setForm({ ...form, committeeEstablishedDate: e.target.value })} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="chk-chairperson" checked={form.isChairperson} onCheckedChange={(v) => setForm({ ...form, isChairperson: !!v })} />
          <Label htmlFor="chk-chairperson" className="text-xs">Mark as Chairperson</Label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
            {editId ? "Update Member" : "Add Member"}
          </Button>
          {editId && <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>}
        </div>
      </div>
      {isLoading ? <Skeleton className="h-24 w-full" /> : members.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">No HFC members added yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>{["Name","Gender","Position","Years","Phone",""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{m.memberName}{m.isChairperson && <Badge className="ml-1 text-[10px] h-4" variant="secondary">Chair</Badge>}</td>
                  <td className="px-3 py-2 capitalize">{m.gender}</td>
                  <td className="px-3 py-2">{m.position}</td>
                  <td className="px-3 py-2">{m.yearsOfService ?? "-"}</td>
                  <td className="px-3 py-2">{m.contactPhone || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditId(m.id); setForm({ memberName: m.memberName, gender: m.gender||"female", position: m.position||"Member", yearsOfService: m.yearsOfService??"", isChairperson: !!m.isChairperson, contactPhone: m.contactPhone||"", committeeEstablishedDate: m.committeeEstablishedDate||"" }); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Step CHV Profile (Sheet 10) ------------------------------------------
const CHV_CAMPAIGN_ROLES = [
  { value: "social_mobilizer", label: "Social Mobilizer" },
  { value: "community_guide", label: "Community Guide" },
  { value: "recorder", label: "Recorder" },
  { value: "volunteer_vaccinator", label: "Volunteer Vaccinator" },
];
const CHV_EDUCATION_LEVELS = ["Primary", "Secondary", "Certificate", "Diploma", "Degree"];

export function StepChvProfile({ facilityId, villages, planType = "routine" }: { facilityId: number | null; villages: any[]; planType?: string }) {
  const { toast } = useToast();
  const { data: tenant } = useQuery<any>({ queryKey: ["/api/me/tenant"] });
  const countryConfig = getCountryConfig(tenant);

  const { data: staffList } = useQuery<any[]>({
    queryKey: ["/api/facilities", Number(facilityId), "staff"],
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}/staff`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch facility staff");
      return res.json();
    },
    enabled: !!facilityId,
  });

  const CHW_EMPLOYMENT_STATUS = [
    "Active - In-service",
    "Active - Intern",
    "Inactive - Suspended",
    "Inactive - Resigned",
    "Inactive - Retired",
    "Inactive - Deceased",
    "Not commenced",
    "Other - Unclassified"
  ];
  const { data: chvs = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/facilities/${facilityId}/chvs`, planType],
    enabled: !!facilityId,
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}/chvs?planType=${planType}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [form, setForm] = useState<any>({
    name: "", nrc: "", contactPhone: "", gender: "female", yearsOfService: "", educationLevel: "Secondary",
    trainingStatus: "trained", communityUnit: "", campaignRole: "social_mobilizer",
    villageId: "", active: true,
    employmentStatus: "Active - In-service", supervisorId: "",
  });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  function resetForm() {
    setForm({ name: "", nrc: "", contactPhone: "", gender: "female", yearsOfService: "", educationLevel: "Secondary", trainingStatus: "trained", communityUnit: "", campaignRole: "social_mobilizer", villageId: "", active: true, employmentStatus: "Active - In-service", supervisorId: "" });
    setEditId(null);
  }

  async function handleSave() {
    if (!facilityId || !form.name.trim()) {
      toast({ title: "CHV name is required", variant: "destructive" }); return;
    }
    if (form.nrc && form.nrc.trim()) {
      const idVal = countryConfig.formatSpec.validateId(form.nrc.trim());
      if (!idVal.valid) {
        toast({
          title: `Invalid ${countryConfig.idShortLabel || "ID"} format`,
          description: idVal.message,
          variant: "destructive",
        });
        return;
      }
    }
    if (form.contactPhone && form.contactPhone.trim()) {
      const phoneVal = countryConfig.formatSpec.validatePhone(form.contactPhone.trim());
      if (!phoneVal.valid) {
        toast({
          title: "Invalid Phone Number",
          description: phoneVal.message,
          variant: "destructive",
        });
        return;
      }
    }
    setSaving(true);
    try {
      const baseUrl = editId ? `/api/facilities/${facilityId}/chvs/${editId}` : `/api/facilities/${facilityId}/chvs`;
      const url = `${baseUrl}?planType=${planType}`;
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          nrc: form.nrc ? countryConfig.formatSpec.normalizeId(form.nrc.trim()) : null,
          contactPhone: form.contactPhone ? countryConfig.formatSpec.normalizePhone(form.contactPhone.trim()) : null,
          phone: form.contactPhone ? countryConfig.formatSpec.normalizePhone(form.contactPhone.trim()) : null,
          yearsOfService: form.yearsOfService ? Number(form.yearsOfService) : null,
          villageId: form.villageId ? Number(form.villageId) : null,
          employmentStatus: form.employmentStatus,
          supervisorId: form.supervisorId && form.supervisorId !== "none" ? Number(form.supervisorId) : null
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${facilityId}/chvs`, planType] });
      toast({ title: editId ? "CHV updated" : "CHV added" });
      resetForm();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!facilityId) return;
    try {
      await fetch(`/api/facilities/${facilityId}/chvs/${id}?planType=${planType}`, { method: "DELETE", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${facilityId}/chvs`, planType] });
      toast({ title: "CHV removed" });
    } catch { toast({ title: "Delete failed", variant: "destructive" }); }
  }

  const safeVillages = Array.isArray(villages) ? villages : [];
  const villageMap = Object.fromEntries(
    safeVillages.filter((v) => v && v.villageId).map((v) => [String(v.villageId), v.name || ""])
  );

  return (
    <div className="space-y-5">
      {/* WhatToDo is rendered by the outer wizard wrapper (line 3157) for all steps */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">{editId ? "Edit CHV" : "Add Community Health Volunteer"}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Full Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grace Mutale" />
          </div>
          <div>
            <Label className="text-xs">{countryConfig.idLabel || "National ID Number"}</Label>
            <Input value={form.nrc} onChange={(e) => setForm({ ...form, nrc: e.target.value })} placeholder={countryConfig.idFormatPlaceholder || "9001015009087"} />
          </div>
          <div>
            <Label className="text-xs">Contact Phone</Label>
            <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder={countryConfig.phonePlaceholder || "+27 82 123 4567"} />
          </div>
          <div>
            <Label className="text-xs">Gender</Label>
            <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Campaign Role</Label>
            <Select value={form.campaignRole} onValueChange={(v) => setForm({ ...form, campaignRole: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHV_CAMPAIGN_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Education Level</Label>
            <Select value={form.educationLevel} onValueChange={(v) => setForm({ ...form, educationLevel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHV_EDUCATION_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Training Status</Label>
            <Select value={form.trainingStatus} onValueChange={(v) => setForm({ ...form, trainingStatus: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trained">Trained</SelectItem>
                <SelectItem value="untrained">Untrained</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Years of Service</Label>
            <Input type="number" min={0} value={form.yearsOfService} onChange={(e) => setForm({ ...form, yearsOfService: e.target.value })} placeholder="0" />
          </div>
          <div>
            <Label className="text-xs">Community Unit</Label>
            <Input value={form.communityUnit} onChange={(e) => setForm({ ...form, communityUnit: e.target.value })} placeholder="e.g. Chipata South CU" />
          </div>
          <div>
            <Label className="text-xs">Responsible Village</Label>
            <Select value={String(form.villageId || "")} onValueChange={(v) => setForm({ ...form, villageId: v === "__none__" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Select village" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">- None -</SelectItem>
                {safeVillages.filter((v) => v && v.villageId).map((v) => (
                  <SelectItem key={v.villageId} value={String(v.villageId)}>{v.name || ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Employment Status</Label>
            <Select value={form.employmentStatus} onValueChange={(v) => setForm({ ...form, employmentStatus: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHW_EMPLOYMENT_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Supervisor (Facility Staff)</Label>
            <Select value={form.supervisorId || "none"} onValueChange={(v) => setForm({ ...form, supervisorId: v })}>
              <SelectTrigger><SelectValue placeholder="Select supervisor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Supervisor</SelectItem>
                {(staffList || []).map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.fullName} ({s.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
            {editId ? "Update CHV" : "Add CHV"}
          </Button>
          {editId && <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>}
        </div>
      </div>
      {isLoading ? <Skeleton className="h-24 w-full" /> : chvs.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">No CHVs added yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>{["Name","Gender","Phone","Role","Education","Training","Village",""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {chvs.map((c: any) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 capitalize">{c.gender}</td>
                  <td className="px-3 py-2">{c.contactPhone || c.phone || "-"}</td>
                  <td className="px-3 py-2">{CHV_CAMPAIGN_ROLES.find((r) => r.value === c.campaignRole)?.label ?? c.campaignRole}</td>
                  <td className="px-3 py-2">{c.educationLevel}</td>
                  <td className="px-3 py-2">
                    <Badge variant={c.trainingStatus === "trained" ? "default" : "outline"} className="text-[10px] h-4">
                      {c.trainingStatus === "trained" ? "Trained" : "Untrained"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{c.villageId ? (villageMap[String(c.villageId)] ?? `ID ${c.villageId}`) : "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditId(c.id); setForm({ name: c.name, nrc: c.nrc || "", contactPhone: c.contactPhone || c.phone || "", gender: c.gender||"female", yearsOfService: c.yearsOfService??"", educationLevel: c.educationLevel||"Secondary", trainingStatus: c.trainingStatus||"trained", communityUnit: c.communityUnit||"", campaignRole: c.campaignRole||"social_mobilizer", villageId: c.villageId??"", active: c.active, employmentStatus: c.employmentStatus || "Active - In-service", supervisorId: c.supervisorId?.toString() || "" }); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Step8({ transport, setTransport }: { transport: any[]; setTransport: (v: any[]) => void }) {
  const upd = (i: number, patch: any) => {
    const next = [...transport];
    next[i] = { ...next[i], ...patch };
    setTransport(next);
  };
  return (
    <div className="max-h-[420px] overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-2">Session day</th>
            <th className="p-2">Mode</th>
            <th className="p-2">Distance km</th>
            <th className="p-2">Fuel L</th>
            <th className="p-2">Vehicle / boat</th>
            <th className="p-2">Cleared</th>
          </tr>
        </thead>
        <tbody>
          {transport.map((t, i) => (
            <tr key={t.rowId} className="border-b">
              <td className="p-2 text-xs">{t.sessionLabel}</td>
              <td className="p-1">
                <Select value={t.mode} onValueChange={(v) => upd(i, { mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walking">Foot</SelectItem>
                    <SelectItem value="car">Car</SelectItem>
                    <SelectItem value="motorbike">Motorbike</SelectItem>
                    <SelectItem value="donkey">Donkey</SelectItem>
                    <SelectItem value="boat">Boat</SelectItem>
                    <SelectItem value="air">Air</SelectItem>
                    <SelectItem value="chopper">Chopper</SelectItem>
                  </SelectContent>
                </Select>
              </td>
              <td className="p-1"><Input type="number" value={t.distanceKm} onChange={(e) => upd(i, { distanceKm: e.target.value })} /></td>
              <td className="p-1"><Input type="number" value={t.fuelLitres} onChange={(e) => upd(i, { fuelLitres: e.target.value })} /></td>
              <td className="p-1"><Input value={t.vehicle} onChange={(e) => upd(i, { vehicle: e.target.value })} /></td>
              <td className="p-2"><Checkbox checked={t.cleared} onCheckedChange={(v) => upd(i, { cleared: !!v })} /></td>
            </tr>
          ))}
          {transport.length === 0 && (
            <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Finish Step 4 first.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Step9({
  budget,
  setBudget,
  onDelete,
  errorRowId,
  errorMessage,
  onClearError,
}: {
  budget: any[];
  setBudget: (v: any[]) => void;
  onDelete: (index: number) => void | Promise<void>;
  errorRowId?: string;
  errorMessage?: string;
  onClearError?: () => void;
}) {
  const errorRowRef = useRef<HTMLInputElement | null>(null);

  // Scroll the flagged budget line into view and focus its description input
  // whenever a new validation error points at this step.
  useEffect(() => {
    if (errorRowId && errorRowRef.current) {
      errorRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      errorRowRef.current.focus();
    }
  }, [errorRowId]);

  const upd = (i: number, patch: any) => {
    const next = [...budget];
    next[i] = { ...next[i], ...patch };
    setBudget(next);
    // Editing the flagged row clears the highlight.
    if (errorRowId && `bud-${i}` === errorRowId) onClearError?.();
  };
  const add = () =>
    setBudget([
      ...budget,
      {
        rowId: `b-${Date.now()}`,
        category: "Transport",
        description: "",
        quantity: "1",
        unitCost: "0",
        fundingSource: "government",
      },
    ]);
  const remove = (i: number) => onDelete(i);
  const total = budget.reduce(
    (s, b) => s + parseFloat(b.unitCost || "0") * parseInt(b.quantity || "0", 10),
    0,
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Total: {total.toLocaleString()}</p>
        <Button size="sm" variant="outline" onClick={add} data-testid="button-add-budget">
          <Plus className="mr-1 h-4 w-4" /> Add line
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2">Category</th>
              <th className="p-2">Description</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Unit</th>
              <th className="p-2">Total</th>
              <th className="p-2">Funding</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {budget.map((b, i) => {
              const isError = errorRowId != null && `bud-${i}` === errorRowId;
              return (
              <tr key={b.rowId} className={`border-b ${isError ? "ring-1 ring-destructive" : ""}`}>
                <td className="p-1">
                  <Select value={b.category} onValueChange={(v) => upd(i, { category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUDGET_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1">
                  <Input
                    ref={isError ? errorRowRef : undefined}
                    className={isError ? "border-destructive ring-1 ring-destructive" : undefined}
                    value={b.description}
                    onChange={(e) => upd(i, { description: e.target.value })}
                  />
                  {isError && errorMessage && (
                    <p
                      className="mt-1 text-xs text-destructive"
                      data-testid="budget-row-error"
                    >
                      {errorMessage}
                    </p>
                  )}
                </td>
                <td className="p-1"><Input type="number" value={b.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} /></td>
                <td className="p-1"><Input type="number" value={b.unitCost} onChange={(e) => upd(i, { unitCost: e.target.value })} /></td>
                <td className="p-2">{(parseFloat(b.unitCost || "0") * parseInt(b.quantity || "0", 10)).toLocaleString()}</td>
                <td className="p-1">
                  <Select value={b.fundingSource} onValueChange={(v) => upd(i, { fundingSource: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FUNDING_SOURCES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1">
                  <Button size="icon" variant="ghost" onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Reusable inline AddSupervisorDialog component for Step 10
// Follows WHO RED guidelines: supportive supervision is an external oversight mechanism.
// Supervisors are drawn from the District, Province, or National levels (never local clinic staff).
export function AddSupervisorDialog({
  facilityId,
  facilityDetails,
  onSupervisorAdded,
}: {
  facilityId: number | null;
  facilityDetails?: {
    id?: number;
    name?: string;
    districtId?: number;
    districtName?: string;
    provinceId?: number;
    provinceName?: string;
  };
  onSupervisorAdded?: (supervisorName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<"district" | "province" | "national">("district");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("District EPI Supervisor");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { toast } = useToast();
  const { data: tenant } = useQuery<any>({ queryKey: ["/api/me/tenant"] });
  const countryConfig = getCountryConfig(tenant);

  const districtName = facilityDetails?.districtName || "District";
  const provinceName = facilityDetails?.provinceName || "Province";

  const handleLevelChange = (newLevel: "district" | "province" | "national") => {
    setLevel(newLevel);
    if (newLevel === "district") {
      setRole("District EPI Supervisor");
    } else if (newLevel === "province") {
      setRole("Provincial EPI Coordinator");
    } else {
      setRole("National EPI Supervisor");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId) return;
    if (!fullName.trim()) {
      toast({ title: "Name is required", description: "Please enter the supervisor's full name.", variant: "destructive" });
      return;
    }

    if (phone.trim()) {
      const phoneVal = countryConfig.formatSpec.validatePhone(phone.trim());
      if (!phoneVal.valid) {
        toast({ title: "Invalid Phone Number", description: phoneVal.message, variant: "destructive" });
        return;
      }
    }

    try {
      setSubmitting(true);
      const data: any = await apiRequest("POST", `/api/facilities/${facilityId}/supervisors`, {
        name: fullName.trim(),
        role: role.trim() || undefined,
        level,
        phone: phone.trim() ? countryConfig.formatSpec.normalizePhone(phone.trim()) : undefined,
        email: email.trim() || undefined,
      });

      // Refetch the supervisors list so dropdowns update immediately
      await queryClient.invalidateQueries({ queryKey: ["/api/facilities", facilityId, "supervisors"] });

      const createdName = data?.supervisor?.name || fullName.trim();
      toast({
        title: "Supervisor Added",
        description: `Successfully registered ${createdName} at the ${level} level.`,
      });

      onSupervisorAdded?.(createdName);
      setOpen(false);
      setFullName("");
      setPhone("");
      setEmail("");
      setLevel("district");
      setRole("District EPI Supervisor");
    } catch (error: any) {
      toast({
        title: "Failed to add supervisor",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!facilityId) return null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        type="button"
        className="gap-1.5"
        data-testid="button-add-supervisor"
      >
        <UserPlus className="h-4 w-4 text-primary" /> Add Supervisor
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]" data-testid="dialog-add-supervisor">
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> Add Supportive Supervisor
              </DialogTitle>
              <DialogDescription>
                Register an external supportive supervisor from the District ({districtName}), Province ({provinceName}), or National MOH level.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {/* Level selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supervisory Level</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLevelChange("district")}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      level === "district"
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                        : "border-border/70 hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Building2 className="h-4 w-4 mb-1" />
                    <span>District Level</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-full font-normal">
                      {districtName}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLevelChange("province")}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      level === "province"
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-600"
                        : "border-border/70 hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Building2 className="h-4 w-4 mb-1" />
                    <span>Province Level</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-full font-normal">
                      {provinceName}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLevelChange("national")}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      level === "national"
                        ? "border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-600"
                        : "border-border/70 hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Shield className="h-4 w-4 mb-1" />
                    <span>National Level</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Ministry / WHO</span>
                  </button>
                </div>
              </div>

              {/* Supervisor Name */}
              <div className="space-y-1">
                <Label htmlFor="supervisor-name">Full Name <span className="text-destructive">*</span></Label>
                <Input
                  id="supervisor-name"
                  placeholder="e.g. Dr. Derek Mthembu"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={submitting}
                  autoFocus
                />
              </div>

              {/* Designation / Role */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label htmlFor="supervisor-role">Position / Role</Label>
                  <span className="text-[11px] text-muted-foreground">Custom or select preset</span>
                </div>
                <Select value={role} onValueChange={setRole} disabled={submitting}>
                  <SelectTrigger id="supervisor-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {level === "district" && (
                      <SelectGroup>
                        <SelectLabel>District Roles</SelectLabel>
                        <SelectItem value="District EPI Supervisor">District EPI Supervisor</SelectItem>
                        <SelectItem value="District Health Officer (DHO)">District Health Officer (DHO)</SelectItem>
                        <SelectItem value="District Surveillance Officer">District Surveillance Officer</SelectItem>
                        <SelectItem value="Sub-District Coordinator">Sub-District Coordinator</SelectItem>
                        <SelectItem value="Cold Chain & Vaccine Logistics Officer">Cold Chain & Vaccine Logistics Officer</SelectItem>
                        <SelectItem value="M&E / HMIS Officer">M&E / HMIS Officer</SelectItem>
                      </SelectGroup>
                    )}
                    {level === "province" && (
                      <SelectGroup>
                        <SelectLabel>Provincial Roles</SelectLabel>
                        <SelectItem value="Provincial EPI Coordinator">Provincial EPI Coordinator</SelectItem>
                        <SelectItem value="Provincial Surveillance Officer">Provincial Surveillance Officer</SelectItem>
                        <SelectItem value="Provincial Cold Chain Officer">Provincial Cold Chain Officer</SelectItem>
                        <SelectItem value="Provincial Child Health Officer">Provincial Child Health Officer</SelectItem>
                      </SelectGroup>
                    )}
                    {level === "national" && (
                      <SelectGroup>
                        <SelectLabel>National Roles</SelectLabel>
                        <SelectItem value="National EPI Supervisor">National EPI Supervisor</SelectItem>
                        <SelectItem value="National EPI Manager">National EPI Manager</SelectItem>
                        <SelectItem value="WHO / UNICEF External Supervisor">WHO / UNICEF External Supervisor</SelectItem>
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="supervisor-phone">Phone Number</Label>
                  <Input
                    id="supervisor-phone"
                    placeholder={countryConfig.phonePlaceholder || "+27 82 123 4567"}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="supervisor-email">Email (Optional)</Label>
                  <Input
                    id="supervisor-email"
                    type="email"
                    placeholder="official@health.gov"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" /> Save Supervisor
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Step10({
  supervision,
  setSupervision,
  onDelete,
  errorRowId,
  errorMessage,
  onClearError,
  facilityId,
}: {
  supervision: any[];
  setSupervision: (v: any[]) => void;
  onDelete: (index: number) => void | Promise<void>;
  errorRowId?: string;
  errorMessage?: string;
  onClearError?: () => void;
  facilityId: number | null;
}) {
  const errorRowRef = useRef<HTMLButtonElement | null>(null);

  // Fetch supervisors from District, Province, and National levels
  // WHO RED requirement: supportive supervision must be external oversight (not same facility staff)
  const { data: supervisorData, isLoading: loadingSupervisors } = useQuery<{
    facility?: {
      id: number;
      name: string;
      districtId: number;
      districtName: string;
      provinceId: number;
      provinceName: string;
    };
    district: any[];
    province: any[];
    national: any[];
    all: any[];
  }>({
    queryKey: ["/api/facilities", facilityId, "supervisors"],
    enabled: !!facilityId,
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}/supervisors`, { credentials: "include" });
      if (!res.ok) return { district: [], province: [], national: [], all: [] };
      return res.json();
    },
  });

  const { data: templates } = useQuery<any[]>({
    queryKey: ["/api/supervision-checklist-templates"],
    queryFn: async () => {
      const res = await fetch("/api/supervision-checklist-templates", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const templateOptions = templates || [];

  const upd = (i: number, patch: any) => {
    const next = [...supervision];
    next[i] = { ...next[i], ...patch };
    setSupervision(next);
    // Editing the flagged row clears the highlight.
    if (errorRowId && `sup-${i}` === errorRowId) onClearError?.();
  };
  const add = () =>
    setSupervision([
      ...supervision,
      {
        rowId: `s-${Date.now()}`,
        quarter: currentQuarter(),
        scheduledDate: new Date().toISOString().slice(0, 10),
        supervisorName: "",
        checklist: "WHO RED checklist",
        followUp: "",
      },
    ]);
  const remove = (i: number) => onDelete(i);

  const districtName = supervisorData?.facility?.districtName || "District";
  const provinceName = supervisorData?.facility?.provinceName || "Province";

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-muted/20 p-2.5 rounded-md border border-border/60">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-primary shrink-0" />
          <span>
            Supportive supervision is external oversight: select supervisors from the <strong>{districtName}</strong> district, <strong>{provinceName}</strong> province, or <strong>National</strong> MOH level.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AddSupervisorDialog
            facilityId={facilityId}
            facilityDetails={supervisorData?.facility}
            onSupervisorAdded={(newName) => {
              const emptyIdx = supervision.findIndex((s) => !s.supervisorName || !s.supervisorName.trim());
              if (emptyIdx !== -1) {
                upd(emptyIdx, { supervisorName: newName });
              }
            }}
          />
          <Button size="sm" variant="outline" onClick={add} data-testid="button-add-supervision">
            <Plus className="mr-1 h-4 w-4" /> Add visit
          </Button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-2">Qtr</th>
            <th className="p-2">Date</th>
            <th className="p-2 w-56">Supervisor</th>
            <th className="p-2 w-48">Checklist</th>
            <th className="p-2">Follow-up</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {supervision.map((v, i) => {
            const isError = errorRowId != null && `sup-${i}` === errorRowId;
            return (
              <tr key={v.rowId} className={`border-b align-top ${isError ? "ring-1 ring-destructive" : ""}`}>
                <td className="p-1">
                  <Select value={String(v.quarter)} onValueChange={(x) => upd(i, { quarter: Number(x) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((q) => (<SelectItem key={q} value={String(q)}>Q{q}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1"><Input type="date" value={v.scheduledDate} onChange={(e) => upd(i, { scheduledDate: e.target.value })} /></td>
                <td className="p-1">
                  <Select value={v.supervisorName} onValueChange={(x) => upd(i, { supervisorName: x })}>
                    <SelectTrigger ref={isError ? errorRowRef : undefined} className={isError ? "border-destructive ring-1 ring-destructive" : undefined}>
                      <SelectValue placeholder={loadingSupervisors ? "Loading supervisors..." : "Select supervisor"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {supervisorData?.district && supervisorData.district.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-xs font-semibold text-primary flex items-center gap-1.5 px-2 py-1 bg-primary/5 rounded">
                            <Building2 className="h-3 w-3" />
                            District Supervisors ({districtName})
                          </SelectLabel>
                          {supervisorData.district.map((sup) => (
                            <SelectItem key={sup.id} value={sup.name}>
                              <span className="font-medium">{sup.name}</span>
                              <span className="text-muted-foreground ml-1 text-xs">({sup.role})</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}

                      {supervisorData?.province && supervisorData.province.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 rounded mt-1">
                            <Building2 className="h-3 w-3" />
                            Provincial Supervisors ({provinceName})
                          </SelectLabel>
                          {supervisorData.province.map((sup) => (
                            <SelectItem key={sup.id} value={sup.name}>
                              <span className="font-medium">{sup.name}</span>
                              <span className="text-muted-foreground ml-1 text-xs">({sup.role})</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}

                      {supervisorData?.national && supervisorData.national.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded mt-1">
                            <Shield className="h-3 w-3" />
                            National Supervisors
                          </SelectLabel>
                          {supervisorData.national.map((sup) => (
                            <SelectItem key={sup.id} value={sup.name}>
                              <span className="font-medium">{sup.name}</span>
                              <span className="text-muted-foreground ml-1 text-xs">({sup.role})</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}

                      {/* Fallback for already saved custom or assigned supervisor */}
                      {v.supervisorName &&
                        !supervisorData?.all?.some((s) => s.name === v.supervisorName) && (
                          <SelectGroup>
                            <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1 mt-1">
                              Assigned Supervisor
                            </SelectLabel>
                            <SelectItem value={v.supervisorName}>
                              <span className="font-medium">{v.supervisorName}</span>
                              <span className="text-muted-foreground ml-1 text-xs">(assigned)</span>
                            </SelectItem>
                          </SelectGroup>
                        )}

                      {(!supervisorData?.all || supervisorData.all.length === 0) && !v.supervisorName && (
                        <div className="p-2 text-xs text-muted-foreground text-center">
                          No supervisors found. Use "+ Add Supervisor" above.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {isError && errorMessage && (
                    <p
                      className="mt-1 text-xs text-destructive"
                      data-testid="supervision-row-error"
                    >
                      {errorMessage}
                    </p>
                  )}
                </td>
                <td className="p-1">
                  <Select value={v.checklist} onValueChange={(x) => upd(i, { checklist: x })}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Select checklist" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WHO RED checklist">WHO RED checklist (Default)</SelectItem>
                      {templateOptions.map((t) => (
                        <SelectItem key={t.id} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                      {v.checklist && v.checklist !== "WHO RED checklist" && !templateOptions.some((t) => t.name === v.checklist) && (
                        <SelectItem value={v.checklist}>{v.checklist} (custom)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1"><Textarea rows={2} value={v.followUp} onChange={(e) => upd(i, { followUp: e.target.value })} /></td>
                <td className="p-1">
                  <Button size="icon" variant="ghost" onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Tick({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  ) : (
    <Circle className="h-4 w-4 text-muted-foreground" />
  );
}

export function SummaryCard({
  step,
  title,
  filled,
  onEdit,
  children,
}: {
  step: number;
  title: string;
  filled: boolean;
  onEdit: (step: number) => void;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      value={`step-${step}`}
      className="rounded-md border bg-card"
      data-testid={`summary-card-${step}`}
    >
      <div className="flex items-center justify-between gap-2 pr-2">
        <AccordionTrigger className="flex-1 px-3 py-2 hover:no-underline">
          <span className="flex items-center gap-2 text-left">
            <Tick ok={filled} />
            <span className="text-sm font-medium">
              Step {step} - {title}
            </span>
            {filled ? (
              <Badge variant="outline" className="ml-2 text-xs">
                Complete
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-2 border-amber-400 text-xs text-amber-700">
                Empty
              </Badge>
            )}
          </span>
        </AccordionTrigger>
        <Button
          size="sm"
          variant="ghost"
          className={filled ? undefined : "text-primary underline-offset-2 hover:underline"}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(step);
          }}
          data-testid={`button-edit-step-${step}`}
        >
          {filled ? (
            <>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </>
          ) : (
            <>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </>
          )}
        </Button>
      </div>
      <AccordionContent className="px-3 pb-3">{children}</AccordionContent>
    </AccordionItem>
  );
}

export function EmptyState() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
      <AlertCircle className="h-4 w-4 text-amber-500" />
      Nothing entered yet.
    </div>
  );
}

export function Step11({
  microplan,
  facilityLabel,
  coverage,
  communities,
  risk,
  calendar,
  staffing,
  vaccines,
  coldChain,
  mobilization,
  transport,
  budget,
  supervision,
  validationErrors,
  onEdit,
}: {
  microplan: Microplan | null;
  facilityLabel: string;
  coverage: any;
  communities: any[];
  risk: any[];
  calendar: any[];
  staffing: any[];
  vaccines: any[];
  coldChain: any;
  mobilization: any[];
  transport: any[];
  budget: any[];
  supervision: any[];
  validationErrors: Array<{ step: number; message: string; id: string }>;
  onEdit: (step: number) => void;
}) {
  const status = microplan?.status ?? "draft";

  const dtp1 = parseFloat(coverage.dtp1 || "0");
  const dtp3 = parseFloat(coverage.dtp3 || "0");
  const mcv1 = parseFloat(coverage.mcv1 || "0");
  const dropDtp = dtp1 > 0 ? Math.round(((dtp1 - dtp3) / dtp1) * 100) : 0;
  const dropMcv = dtp1 > 0 ? Math.round(((dtp1 - mcv1) / dtp1) * 100) : 0;

  const filledStep1 =
    dtp1 > 0 ||
    parseFloat(coverage.dtp3 || "0") > 0 ||
    parseFloat(coverage.mcv1 || "0") > 0 ||
    parseFloat(coverage.mcv2 || "0") > 0;
  const filledStep2 = communities.length > 0;
  const filledStep3 =
    risk.length > 0 && risk.some((r) => r.missed || r.zeroDose || r.distance !== 3 || r.terrain !== 3 || r.season !== 3 || r.insecurity !== 1);
  const filledStep4 = calendar.length > 0;
  const filledStep5 =
    staffing.length > 0 && staffing.some((s) => s.vaccinator || s.recorder || s.supervisor);
  const filledStep6 = vaccines.some((v) => parseInt(v.target || "0", 10) > 0);
  const filledStep7 =
    mobilization.length > 0 &&
    mobilization.some((m) => m.focalPoint || (m.channels && m.channels.length > 0));
  const filledStep8 =
    transport.length > 0 &&
    transport.some(
      (t) => parseFloat(t.distanceKm || "0") > 0 || parseFloat(t.fuelLitres || "0") > 0 || t.vehicle,
    );
  const filledStep9 = budget.some((b) => b.description && b.description.trim());
  const filledStep10 = supervision.some((s) => s.supervisorName && s.supervisorName.trim());

  const monthsCovered = new Set(
    calendar.filter((c) => c.scheduledDate).map((c) => c.scheduledDate.slice(0, 7)),
  ).size;
  const sessionsByType = calendar.reduce<Record<string, number>>((acc, c) => {
    acc[c.sessionType] = (acc[c.sessionType] || 0) + 1;
    return acc;
  }, {});

  const budgetTotal = budget.reduce(
    (s, b) => s + parseFloat(b.unitCost || "0") * parseInt(b.quantity || "0", 10),
    0,
  );

  return (
    <div className="space-y-3">
      {validationErrors && validationErrors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-1.5 font-bold">
              <AlertCircle className="h-4 w-4" /> Pre-Submission Validation Checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground mb-2">
              The following {validationErrors.length} requirement(s) must be satisfied before this microplan can be submitted:
            </p>
            <ul className="space-y-1.5 list-none pl-0">
              {validationErrors.map((err) => (
                <li key={err.id} className="flex items-start gap-1.5">
                  <span className="text-destructive font-semibold min-w-[50px] inline-block">Step {err.step}:</span>
                  <button
                    onClick={() => onEdit(err.step)}
                    className="text-left text-blue-600 hover:text-blue-800 hover:underline focus:outline-hidden"
                  >
                    {err.message}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{facilityLabel}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Review every step below before submitting. Click <b>Edit</b> on any card to fix it - use the
          "Back to summary" button at the top of the step to return here.
        </CardContent>
      </Card>

      <Accordion type="multiple" className="space-y-2">
        <SummaryCard step={1} title="Coverage review" filled={filledStep1} onEdit={onEdit}>
          {filledStep1 ? (
            <div className="space-y-2 text-sm">
              <table className="w-full">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-1">DTP1</th>
                    <th className="py-1">DTP3</th>
                    <th className="py-1">MCV1</th>
                    <th className="py-1">MCV2</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1">{coverage.dtp1 || "0"}%</td>
                    <td className="py-1">{coverage.dtp3 || "0"}%</td>
                    <td className="py-1">{coverage.mcv1 || "0"}%</td>
                    <td className="py-1">{coverage.mcv2 || "0"}%</td>
                  </tr>
                </tbody>
              </table>
              <div className="text-xs text-muted-foreground">
                Dropout DTP1-&gt;DTP3: <b>{dropDtp}%</b> - DTP1-&gt;MCV1: <b>{dropMcv}%</b>
              </div>
              <div className="text-xs text-muted-foreground">
                Stockouts: <b>{coverage.stockouts || "0"}</b> - AEFI: <b>{coverage.aefi || "0"}</b> -
                Sessions planned/held: <b>{coverage.sessionsPlanned || "0"}</b>/
                <b>{coverage.sessionsHeld || "0"}</b>
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </SummaryCard>

        <SummaryCard step={2} title="Catchment & communities" filled={filledStep2} onEdit={onEdit}>
          {filledStep2 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-left uppercase text-muted-foreground">
                  <tr>
                    <th className="p-1">Name</th>
                    <th className="p-1">Type</th>
                    <th className="p-1">Target</th>
                    <th className="p-1">Source</th>
                    <th className="p-1">Strategy</th>
                  </tr>
                </thead>
                <tbody>
                  {communities.map((c, i) => (
                    <tr key={c.rowId || i} className="border-b">
                      <td className="p-1">{c.name || <em className="text-muted-foreground">(unnamed)</em>}</td>
                      <td className="p-1">{c.type}</td>
                      <td className="p-1">{c.targetPopulation || "0"}</td>
                      <td className="p-1">{c.source}</td>
                      <td className="p-1">{c.strategy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </SummaryCard>

        <SummaryCard step={3} title="Risk scoring" filled={filledStep3} onEdit={onEdit}>
          {risk.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-left uppercase text-muted-foreground">
                  <tr>
                    <th className="p-1">Community</th>
                    <th className="p-1">Dist</th>
                    <th className="p-1">Terr</th>
                    <th className="p-1">Seas</th>
                    <th className="p-1">Insec</th>
                    <th className="p-1">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {risk.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-1">{r.name}</td>
                      <td className="p-1">{r.distance}</td>
                      <td className="p-1">{r.terrain}</td>
                      <td className="p-1">{r.season}</td>
                      <td className="p-1">{r.insecurity}</td>
                      <td className="p-1">
                        {[r.missed && "missed", r.zeroDose && "zero-dose"].filter(Boolean).join(", ") || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </SummaryCard>

        <SummaryCard step={4} title="Session calendar" filled={filledStep4} onEdit={onEdit}>
          {filledStep4 ? (
            <div className="space-y-2 text-sm">
              <div className="text-xs text-muted-foreground">
                <b>{calendar.length}</b> sessions across <b>{monthsCovered}</b> months -{" "}
                {Object.entries(sessionsByType)
                  .map(([t, n]) => `${t}: ${n}`)
                  .join(" - ")}
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 border-b bg-background text-left uppercase text-muted-foreground">
                    <tr>
                      <th className="p-1">Community</th>
                      <th className="p-1">Date</th>
                      <th className="p-1">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendar.map((c, i) => (
                      <tr key={c.rowId || i} className="border-b">
                        <td className="p-1">{c.name}</td>
                        <td className="p-1">{c.scheduledDate}</td>
                        <td className="p-1">{c.sessionType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </SummaryCard>

        <SummaryCard step={5} title="Staffing per session day" filled={filledStep5} onEdit={onEdit}>
          {staffing.length > 0 ? (
            <div className="max-h-48 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-left uppercase text-muted-foreground">
                  <tr>
                    <th className="p-1">Session</th>
                    <th className="p-1">Vaccinator</th>
                    <th className="p-1">Recorder</th>
                    <th className="p-1">Supervisor</th>
                    <th className="p-1">Team</th>
                    <th className="p-1">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {staffing.map((s, i) => (
                    <tr key={s.rowId || i} className="border-b">
                      <td className="p-1">{s.sessionLabel}</td>
                      <td className="p-1">{s.vaccinator || "-"}</td>
                      <td className="p-1">{s.recorder || "-"}</td>
                      <td className="p-1">{s.supervisor || "-"}</td>
                      <td className="p-1">{s.teamType}</td>
                      <td className="p-1">{s.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </SummaryCard>

        <SummaryCard step={6} title="Vaccine forecasting" filled={filledStep6} onEdit={onEdit}>
          {filledStep6 ? (
            <div className="space-y-2 text-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b text-left uppercase text-muted-foreground">
                    <tr>
                      <th className="p-1">Antigen</th>
                      <th className="p-1">Target</th>
                      <th className="p-1">Doses</th>
                      <th className="p-1">Wastage %</th>
                      <th className="p-1">Vials</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaccines.map((v) => {
                      const tgt = parseInt(v.target || "0", 10) || 0;
                      // Sanitize: the string "null" is truthy but parses to NaN
                      const wastageStr = (v.wastage === "null" || !v.wastage) ? "0" : v.wastage;
                      const w = parseFloat(wastageStr);
                      const safeW = isFinite(w) ? w : 0;
                      const safeDoses = v.doses || 1;
                      const total = Math.ceil(tgt * safeDoses * (1 + safeW / 100));
                      const vials = Math.ceil(total / 10);
                      return (
                        <tr key={v.name} className="border-b">
                          <td className="p-1 font-medium">{v.name}</td>
                          <td className="p-1">{tgt}</td>
                          <td className="p-1">{isFinite(total) ? total.toLocaleString() : "-"}</td>
                          <td className="p-1">{isFinite(safeW) ? `${safeW}%` : "-"}</td>
                          <td className="p-1">{isFinite(vials) ? vials.toLocaleString() : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-muted-foreground">
                Cold chain - boxes: <b>{coldChain.coldBoxes}</b> - ice packs: <b>{coldChain.icePacks}</b> -
                carriers/session: <b>{coldChain.carriers}</b>
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </SummaryCard>

        <SummaryCard step={7} title="Social mobilization" filled={filledStep7} onEdit={onEdit}>
          {mobilization.length > 0 ? (
            <div className="max-h-48 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-left uppercase text-muted-foreground">
                  <tr>
                    <th className="p-1">Session</th>
                    <th className="p-1">Channels</th>
                    <th className="p-1">Focal point</th>
                    <th className="p-1">Phone</th>
                    <th className="p-1">IEC</th>
                  </tr>
                </thead>
                <tbody>
                  {mobilization.map((m, i) => (
                    <tr key={m.rowId || i} className="border-b">
                      <td className="p-1">{m.sessionLabel}</td>
                      <td className="p-1">{(m.channels || []).join(", ") || "-"}</td>
                      <td className="p-1">{m.focalPoint || "-"}</td>
                      <td className="p-1">{m.focalPhone || "-"}</td>
                      <td className="p-1">{(m.iec || []).join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </SummaryCard>

        <SummaryCard step={8} title="Transport" filled={filledStep8} onEdit={onEdit}>
          {transport.length > 0 ? (
            <div className="max-h-48 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-left uppercase text-muted-foreground">
                  <tr>
                    <th className="p-1">Session</th>
                    <th className="p-1">Mode</th>
                    <th className="p-1">Distance km</th>
                    <th className="p-1">Fuel L</th>
                    <th className="p-1">Vehicle</th>
                    <th className="p-1">Cleared</th>
                  </tr>
                </thead>
                <tbody>
                  {transport.map((t, i) => (
                    <tr key={t.rowId || i} className="border-b">
                      <td className="p-1">{t.sessionLabel}</td>
                      <td className="p-1">{t.mode}</td>
                      <td className="p-1">{t.distanceKm}</td>
                      <td className="p-1">{t.fuelLitres}</td>
                      <td className="p-1">{t.vehicle || "-"}</td>
                      <td className="p-1">{t.cleared ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </SummaryCard>

        <SummaryCard step={9} title="Budget" filled={filledStep9} onEdit={onEdit}>
          {filledStep9 ? (
            <div className="space-y-2 text-sm">
              <div className="text-xs text-muted-foreground">
                Grand total: <b>{budgetTotal.toLocaleString()}</b>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b text-left uppercase text-muted-foreground">
                    <tr>
                      <th className="p-1">Category</th>
                      <th className="p-1">Description</th>
                      <th className="p-1">Qty</th>
                      <th className="p-1">Unit</th>
                      <th className="p-1">Funding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budget.map((b, i) => (
                      <tr key={b.rowId || i} className="border-b">
                        <td className="p-1">{b.category}</td>
                        <td className="p-1">{b.description || "-"}</td>
                        <td className="p-1">{b.quantity}</td>
                        <td className="p-1">{b.unitCost}</td>
                        <td className="p-1">{b.fundingSource}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </SummaryCard>

        <SummaryCard step={10} title="Supervision plan" filled={filledStep10} onEdit={onEdit}>
          {supervision.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-left uppercase text-muted-foreground">
                  <tr>
                    <th className="p-1">Qtr</th>
                    <th className="p-1">Date</th>
                    <th className="p-1">Supervisor</th>
                    <th className="p-1">Checklist</th>
                    <th className="p-1">Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {supervision.map((v, i) => (
                    <tr key={v.rowId || i} className="border-b align-top">
                      <td className="p-1">Q{v.quarter}</td>
                      <td className="p-1">{v.scheduledDate}</td>
                      <td className="p-1">{v.supervisorName || "-"}</td>
                      <td className="p-1">{v.checklist}</td>
                      <td className="p-1">{v.followUp || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </SummaryCard>
      </Accordion>

      <div className="rounded-md border bg-muted/30 p-3 text-sm flex items-center justify-between gap-4">
        <div>
          <p>
            Current status: <Badge variant="outline">{status}</Badge>
          </p>
          {status === "submitted" && (
            <p className="mt-1 text-muted-foreground">
              Awaiting district approval.
            </p>
          )}
        </div>
        {microplan?.id && (
          <Link href={`/microplans/${microplan.id}/print`}>
            <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-print-preview">
              <Printer className="h-4 w-4" /> Print Preview
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function formatSavedMicroplanCreatedDate(value: unknown): string {
  if (!value) return "Not recorded";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

function isSavedMicroplanSessionCompleted(session: SessionPlan): boolean {
  const status = String((session as any).status ?? "").toLowerCase();
  return Boolean(
    session.completedAt ||
      (session as any).isAchieved ||
      status === "conducted" ||
      status === "completed" ||
      status === "done"
  );
}
// Listing of saved microplans for the current planType, with a per-plan count
// of planned / completed sessions. Renders only when the wizard is in "list
// mode" (no microplanId selected). Clicking Open navigates to the path-param
// route so the wizard hydrates that plan.
export function SavedMicroplansPanel({
  planType,
  onOpen,
}: {
  planType: "routine" | "campaign";
  onOpen: (id: number) => void;
}) {
  const { data: microplans } = useQuery<any[]>({
    queryKey: ["/api/microplans"],
  });
  const { data: sessions } = useQuery<SessionPlan[]>({
    queryKey: ["/api/sessions"],
  });
  const sessionsByPlan = useMemo(() => {
    const m = new Map<number, SessionPlan[]>();
    for (const s of sessions ?? []) {
      if (s.microplanId == null) continue;
      const arr = m.get(s.microplanId) ?? [];
      arr.push(s);
      m.set(s.microplanId, arr);
    }
    return m;
  }, [sessions]);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  // const [isOpen, setIsOpen] = useState(true); // Commented out to collapse by default to prevent squeezing the wizard card
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    setDeleteBusy(true);
    try {
      await apiRequest("DELETE", `/api/microplans/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/microplans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Microplan deleted",
        description: "The microplan has been permanently deleted.",
      });
      setDeleteId(null);
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Could not delete the microplan.",
        variant: "destructive",
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  // The DB column `plan_type` uses values like "facility_routine" /
  // "sia_campaign" while this page thinks in "routine" / "campaign". Map both.
  const filtered = useMemo(() => {
    return (microplans ?? [])
      .filter((m) => {
        const pt = String(m.planType ?? "");
        return planType === "campaign"
          ? pt.includes("campaign")
          : !pt.includes("campaign");
      })
      .map((m) => {
        const rows = sessionsByPlan.get(Number(m.id)) ?? [];
        const createdAtMs = m.createdAt ? new Date(String(m.createdAt)).getTime() : null;
        return {
          ...m,
          period: `Q${m.quarter} ${m.year}`,
          createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null,
          createdDateLabel: formatSavedMicroplanCreatedDate(m.createdAt),
          plannedSessionCount: rows.length,
          completedSessionCount: rows.filter(isSavedMicroplanSessionCompleted).length,
        };
      });
  }, [microplans, planType, sessionsByPlan]);

  const columns = useMemo(() => [
    {
      key: "name",
      header: "Plan Name",
      sortable: true,
      render: (m: any) => (
        <button
          onClick={() => onOpen(m.id)}
          className="font-medium text-primary hover:underline text-left"
          data-testid={`button-open-microplan-name-${m.id}`}
        >
          {m.name}
        </button>
      ),
    },
    {
      key: "period",
      header: "Period",
      sortable: true,
      render: (m: any) => m.period,
    },
    {
      key: "createdAtMs",
      header: "Created",
      sortable: true,
      render: (m: any) => <span className="text-xs text-muted-foreground">{m.createdDateLabel}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (m: any) => {
        const s = String(m.status ?? "draft").toLowerCase();
        const label =
          s === "pending"
            ? "Pending approval"
            : s === "approved"
              ? "Approved"
              : s === "locked"
                ? "Locked"
                : "Draft";
        const variant: "default" | "secondary" | "outline" =
          s === "approved" ? "default" : s === "pending" ? "secondary" : "outline";
        return (
          <Badge variant={variant} className="gap-1" data-testid={`microplan-status-${m.id}`}>
            {label}
          </Badge>
        );
      },
    },
    {
      key: "plannedSessionCount",
      header: "Planned Sessions",
      sortable: true,
      render: (m: any) => (
        <Badge variant="secondary" className="gap-1">
          <Calendar className="h-3 w-3" />
          {m.plannedSessionCount} planned
        </Badge>
      ),
    },
    {
      key: "completedSessionCount",
      header: "Completed Sessions",
      sortable: true,
      render: (m: any) => (
        <Badge variant="outline" className="gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          {m.completedSessionCount} done
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (m: any) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpen(m.id)}
            data-testid={`button-open-microplan-${m.id}`}
          >
            Open
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteId(m.id)}
            data-testid={`button-delete-microplan-${m.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ], [sessionsByPlan, onOpen]);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      /* className="border-b bg-muted/20 px-4 py-3" // Commented out to use border-t at bottom */
      className="border-t bg-muted/20 px-4 py-3"
    >
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm hover:opacity-80 transition-opacity"
            data-testid="toggle-saved-microplans"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div>
              <h2 className="text-sm font-semibold select-none">
                Saved microplans ({filtered.length})
              </h2>
              {!isOpen && (
                <p className="text-[11px] text-muted-foreground font-normal">
                  Click to expand and view or load saved plans
                </p>
              )}
            </div>
          </button>
        </CollapsibleTrigger>
      </div>

      {/* Commented out original CollapsibleContent to restrict vertical height and table page size:
      <CollapsibleContent className="mt-4 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Open one to see its planned sessions
          </p>
        </div>
        <DataTable
          data={filtered}
          columns={columns}
          searchable={true}
          searchKeys={["name"]}
          pageSize={10}
          emptyMessage="No saved microplans found"
          searchPlaceholder="Search saved microplans..."
        />
      </CollapsibleContent>
      */}
      <CollapsibleContent className="mt-4 space-y-4 max-h-[300px] overflow-y-auto pr-1">
        <div>
          <p className="text-xs text-muted-foreground">
            Open one to see its planned sessions
          </p>
        </div>
        <DataTable
          data={filtered}
          columns={columns}
          searchable={true}
          searchKeys={["name"]}
          pageSize={5}
          emptyMessage="No saved microplans found"
          searchPlaceholder="Search saved microplans..."
        />
      </CollapsibleContent>

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete saved microplan?"
        description="This will permanently delete this microplan and all of its planned sessions. This action cannot be undone."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        isPending={deleteBusy}
      />
    </Collapsible>
  );
}

export function Step12({
  microplanId,
  facilityId,
}: {
  microplanId: number | null;
  facilityId: number | null;
}) {
  const { data: sessions } = useQuery<SessionPlan[]>({
    queryKey: ["/api/sessions"],
    enabled: !!microplanId,
  });
  const mine = (sessions ?? []).filter((s) => s.microplanId === microplanId);
  const dosesThisMonth = mine.reduce((sum, s) => {
    const v = (s as any).vaccinatedCounts;
    return sum + (v?.totals ?? 0);
  }, 0);
  const completed = mine.filter((s) => s.completedAt).length;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Sessions in plan</p><p className="text-2xl font-semibold">{mine.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Completed</p><p className="text-2xl font-semibold">{completed}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Doses recorded</p><p className="text-2xl font-semibold">{dosesThisMonth}</p></CardContent></Card>
      </div>
      <p className="text-sm text-muted-foreground">
        Once the microplan is approved and execution begins, this view will show live counters.
      </p>
    </div>
  );
}
