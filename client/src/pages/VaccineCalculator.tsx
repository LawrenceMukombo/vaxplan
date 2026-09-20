import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Syringe,
  Calculator,
  Download,
  RefreshCw,
  Users,
  Thermometer,
  Settings2,
  Plus,
  Edit2,
  Check,
  AlertTriangle,
  Link2,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Facility, PopulationData, Tenant, VaccineConfig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { FacilityCascadePicker } from "@/components/FacilityCascadePicker";
import { offlineDb } from "../lib/offlineDb";
import { calculateLifeCourseForecast } from "@shared/lifeCourseForecast";

const fallbackVaccineSchedule = [
  { id: 1, name: "BCG", target: "births", doses: 1, wastage: 50, vialsPerDose: 20, recommendedAge: "Birth" },
  { id: 2, name: "OPV-0", target: "births", doses: 1, wastage: 15, vialsPerDose: 20, recommendedAge: "Birth" },
  { id: 3, name: "OPV-1,2,3", target: "under1", doses: 3, wastage: 15, vialsPerDose: 20, recommendedAge: "6, 10, 14 weeks" },
  { id: 4, name: "Penta-1,2,3", target: "under1", doses: 3, wastage: 10, vialsPerDose: 10, recommendedAge: "6, 10, 14 weeks" },
  { id: 5, name: "PCV-1,2,3", target: "under1", doses: 3, wastage: 5, vialsPerDose: 4, recommendedAge: "6, 10, 14 weeks" },
  { id: 6, name: "IPV-1,2", target: "under1", doses: 2, wastage: 10, vialsPerDose: 10, recommendedAge: "14 weeks, 9 months" },
  { id: 7, name: "Rota-1,2", target: "under1", doses: 2, wastage: 5, vialsPerDose: 1, recommendedAge: "6, 10 weeks" },
  { id: 8, name: "MR-1", target: "under1", doses: 1, wastage: 15, vialsPerDose: 10, recommendedAge: "9 months" },
  { id: 9, name: "MR-2", target: "schoolEntry", doses: 1, wastage: 15, vialsPerDose: 10, recommendedAge: "18 months / 4-5 years" },
  { id: 10, name: "Td-1,2+", target: "pregnant", doses: 2, wastage: 10, vialsPerDose: 20, recommendedAge: "Pregnancy / Childbearing age" },
];

function wastagePercent(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  // Legacy calculator rows stored factors such as 1.10; current schema and
  // catalogue rows store percentages such as 10.00.
  const percent = numeric > 1 && numeric < 2 ? (numeric - 1) * 100 : numeric;
  return Math.max(0, Math.min(99, Math.round(percent * 100) / 100));
}

const defaultDemographics = {
  births: 0.032,
  under1: 0.030,
  pregnant: 0.032,
  schoolEntry: 0.027,
  schoolExit: 0.022,
};

const legacySummaryVariants: Record<string, string[]> = {
  IPV: ["IPV-"],
  MR: ["MR-"],
  OPV: ["OPV-"],
  PCV: ["PCV-"],
  PENTA: ["PENTA-"],
  ROTAVIRUS: ["ROTA-", "ROTAVIRUS-"],
};

function removeLegacySummaryDuplicates(configs: VaccineConfig[]): VaccineConfig[] {
  const names = configs.map((config) => config.name.trim().toUpperCase());

  return configs.filter((config) => {
    const name = config.name.trim().toUpperCase();
    const doseSpecificPrefixes = legacySummaryVariants[name];
    if (!doseSpecificPrefixes) return true;

    return !names.some((candidate) =>
      doseSpecificPrefixes.some((prefix) => candidate.startsWith(prefix))
    );
  });
}

export default function VaccineCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedFacility, setSelectedFacility] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const f = new URLSearchParams(window.location.search).get("facility");
    return f && !Number.isNaN(Number(f)) ? f : null;
  });
  const [selectedQuarter, setSelectedQuarter] = useState(
    Math.ceil((new Date().getMonth() + 1) / 3)
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string>("auto");
  const [selectedPopSource, setSelectedPopSource] = useState<string>("auto");
  const [isPopDialogOpen, setIsPopDialogOpen] = useState(false);
  const [customPop, setCustomPop] = useState({
    total: "",
    under1: "",
    pregnant: "",
    schoolEntry: "",
  });
  const [isManualPopActive, setIsManualPopActive] = useState(false);
  const [coverageTarget, setCoverageTarget] = useState(95);

  // Modal edit states
  const [editingConfig, setEditingConfig] = useState<Partial<VaccineConfig> | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // New config form states
  const [newConfig, setNewConfig] = useState({
    name: "",
    targetGroup: "under1",
    doses: 1,
    recommendedAge: "",
    recommendedAgeWeeks: 0,
    wastageFactor: "10.00",
    vialsPerDose: 1,
    isActive: true,
  });

  const [isCustomAntigen, setIsCustomAntigen] = useState(false);

  const { data: facilities, isLoading: loadingFacilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
    queryFn: async () => {
      if (!navigator.onLine) {
        return (await offlineDb.facilities.toArray()) as any[];
      }
      const res = await fetch("/api/facilities");
      if (!res.ok) throw new Error("Failed to fetch facilities");
      return res.json();
    }
  });

  const { data: populationData, isLoading: loadingPopulation } = useQuery<PopulationData[]>({
    queryKey: ["/api/population"],
    queryFn: async () => {
      if (!navigator.onLine) {
        return (await offlineDb.populationData.toArray()) as any[];
      }
      const res = await fetch("/api/population");
      if (!res.ok) throw new Error("Failed to fetch population data");
      return res.json();
    }
  });

  const { data: activeTenant, isLoading: loadingTenant } = useQuery<Tenant>({
    queryKey: ["/api/me/tenant"],
    queryFn: async () => {
      if (!navigator.onLine) {
        const cached = localStorage.getItem("vaxplan_active_tenant");
        if (cached) return JSON.parse(cached);
        return { id: user?.tenantId || "default", name: "Ministry of Health", code: "MOH", countryCode: "ZMB", settings: {} } as Tenant;
      }
      const res = await fetch("/api/me/tenant");
      if (!res.ok) throw new Error("Failed to fetch active tenant");
      const data = await res.json();
      localStorage.setItem("vaxplan_active_tenant", JSON.stringify(data));
      return data;
    }
  });

  const { data: vaccineConfigs, isLoading: loadingConfigs } = useQuery<VaccineConfig[]>({
    queryKey: ["/api/vaccines/config"],
    queryFn: async () => {
      if (!navigator.onLine) {
        const localConfigs = await offlineDb.vaccineConfigs.toArray();
        if (localConfigs.length > 0) return localConfigs as any[];
        return fallbackVaccineSchedule as any[];
      }
      const res = await fetch("/api/vaccines/config");
      if (!res.ok) throw new Error("Failed to fetch vaccine configurations");
      return res.json();
    }
  });

  const facilityId = selectedFacility ? Number(selectedFacility) : null;
  const currentYear = new Date().getFullYear();

  const { data: villages = [] } = useQuery<any[]>({
    queryKey: [`/api/villages?facilityId=${facilityId ?? ""}`],
    enabled: !!facilityId,
    queryFn: async () => {
      if (!facilityId) return [];
      if (!navigator.onLine) {
        return (await offlineDb.villages.where("assignedFacilityId").equals(facilityId).toArray()) as any[];
      }
      const res = await fetch(`/api/villages?facilityId=${facilityId}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: microplans = [] } = useQuery<any[]>({
    queryKey: ["/api/microplans"],
    enabled: !!facilityId,
    queryFn: async () => {
      if (!navigator.onLine) {
        return (await offlineDb.microplans.toArray()) as any[];
      }
      const res = await fetch("/api/microplans");
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: [`/api/sessions?facilityId=${facilityId ?? ""}`],
    enabled: !!facilityId,
    queryFn: async () => {
      if (!facilityId) return [];
      if (!navigator.onLine) {
        return (await offlineDb.sessionPlans.where("facilityId").equals(facilityId).toArray()) as any[];
      }
      const res = await fetch(`/api/sessions?facilityId=${facilityId}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: sessionVillageLinks = [] } = useQuery<any[]>({
    queryKey: ["/api/sessions/villages"],
    enabled: !!facilityId,
    queryFn: async () => {
      if (!navigator.onLine) {
        return ((await offlineDb.sessionVillageLinks?.toArray().catch(() => [])) || []) as any[];
      }
      const res = await fetch("/api/sessions/villages");
      if (!res.ok) return [];
      return res.json();
    }
  });

  // API Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof newConfig) => {
      return (await apiRequest("POST", "/api/vaccines/config", data)) as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vaccines/config"] });
      toast({ title: "Success", description: "Vaccine configuration added successfully" });
      setIsAddDialogOpen(false);
      setNewConfig({
        name: "",
        targetGroup: "under1",
        doses: 1,
        recommendedAge: "",
        recommendedAgeWeeks: 0,
        wastageFactor: "10.00",
        vialsPerDose: 1,
        isActive: true,
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to add vaccine configuration", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<VaccineConfig> }) => {
      return (await apiRequest("PATCH", `/api/vaccines/config/${id}`, data)) as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vaccines/config"] });
      toast({ title: "Success", description: "Vaccine configuration updated successfully" });
      setIsEditDialogOpen(false);
      setEditingConfig(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update vaccine configuration", variant: "destructive" });
    },
  });

  const isNationalAdmin = user?.role === "national_admin";

  const activeSchedule = useMemo(() => {
    if (!vaccineConfigs || vaccineConfigs.length === 0) {
      return fallbackVaccineSchedule;
    }
    const activeConfigs = removeLegacySummaryDuplicates(
      vaccineConfigs.filter((config) => config.isActive)
    );
    return activeConfigs
      .map((c) => ({
        id: c.id,
        name: c.name,
        target: c.targetGroup,
        doses: c.doses,
        wastage: wastagePercent(c.wastageFactor),
        vialsPerDose: c.vialsPerDose,
        recommendedAge: c.recommendedAge,
      }));
  }, [vaccineConfigs]);

  const latestCommunityPopulation = useMemo(() => {
    const rowsByVillage = new Map<number, PopulationData[]>();
    const assignedIds = new Set(villages.map((v: any) => Number(v.id)));
    for (const row of populationData || []) {
      const villageId = Number(row.villageId);
      if (!row.villageId || !assignedIds.has(villageId)) continue;
      rowsByVillage.set(villageId, [...(rowsByVillage.get(villageId) || []), row]);
    }

    const latest = new Map<number, PopulationData>();
    rowsByVillage.forEach((rows: PopulationData[], villageId: number) => {
      rows.sort((a: PopulationData, b: PopulationData) => Number(b.year) - Number(a.year) || Number(b.id) - Number(a.id));
      latest.set(villageId, rows[0]);
    });
    return latest;
  }, [populationData, villages]);

  const selectedFacilityData = useMemo(() => {
    return facilities?.find((f) => String(f.id) === String(selectedFacility)) || null;
  }, [facilities, selectedFacility]);

  const demographics = useMemo(() => {
    const settings = (activeTenant?.settings || {}) as Record<string, any>;
    return (settings.demographics || defaultDemographics) as typeof defaultDemographics;
  }, [activeTenant]);

  const facilityPopulation = useMemo(() => {
    if (!selectedFacility) return null;
    const selectedFacilityId = Number(selectedFacility);

    // 1. Manual Custom Override
    if (isManualPopActive && customPop.total && !isNaN(Number(customPop.total))) {
      const total = Number(customPop.total);
      const under1 = customPop.under1 && !isNaN(Number(customPop.under1))
        ? Number(customPop.under1)
        : Math.round(total * (demographics.under1 || 0.038));
      const pregnant = customPop.pregnant && !isNaN(Number(customPop.pregnant))
        ? Number(customPop.pregnant)
        : Math.round(total * (demographics.pregnant || 0.041));
      const schoolEntry = customPop.schoolEntry && !isNaN(Number(customPop.schoolEntry))
        ? Number(customPop.schoolEntry)
        : Math.round(total * (demographics.schoolEntry || 0.032));
      const schoolExit = Math.round(total * (demographics.schoolExit || 0.030));

      return {
        facilityId: selectedFacilityId,
        totalPopulation: total,
        under1Population: under1,
        pregnantWomen: pregnant,
        schoolEntry,
        schoolExit,
        populationSource: "manual",
        sourceLabel: "Manual Custom Entry",
        year: currentYear,
      };
    }

    // 2. Specific Data Source Selection
    const allFacilityRows = (populationData || []).filter(
      (p) => Number(p.facilityId) === selectedFacilityId
    );

    if (selectedPopSource !== "auto" && selectedPopSource !== "communities") {
      const sourceRows = allFacilityRows.filter(
        (p) => String(p.source || (p as any).populationSource || "").toLowerCase() === selectedPopSource.toLowerCase()
      );
      if (sourceRows.length > 0) {
        const sorted = sourceRows.sort((a, b) => Number(b.year) - Number(a.year) || Number(b.id) - Number(a.id));
        const row = sorted[0];
        const total = Number(row.totalPopulation || 0);
        const under1 = row.under1Population ?? Math.round(total * (demographics.under1 || 0.038));
        const pregnant = row.pregnantWomen ?? Math.round(total * (demographics.pregnant || 0.041));
        const schoolEntry = row.schoolEntry ?? Math.round(total * (demographics.schoolEntry || 0.032));
        const schoolExit = row.schoolExit ?? Math.round(total * (demographics.schoolExit || 0.030));

        const sourceLabel =
          selectedPopSource === "nso" ? `NSO Census Projections · ${row.year || currentYear}` :
          selectedPopSource === "hmis" ? `HMIS Health Records · ${row.year || currentYear}` :
          selectedPopSource === "worldpop" ? `WorldPop Satellite Estimate · ${row.year || currentYear}` :
          selectedPopSource === "survey" ? `EPI Coverage Survey · ${row.year || currentYear}` :
          `${selectedPopSource.toUpperCase()} Records · ${row.year || currentYear}`;

        return {
          ...row,
          facilityId: selectedFacilityId,
          totalPopulation: total,
          under1Population: under1,
          pregnantWomen: pregnant,
          schoolEntry,
          schoolExit,
          populationSource: selectedPopSource,
          sourceLabel,
        };
      }
    }

    // 3. Assigned communities aggregation (default bottom-up)
    if (latestCommunityPopulation.size > 0 && selectedPopSource !== "facility_only") {
      return Array.from(latestCommunityPopulation.values()).reduce((total: any, row: any) => ({
        ...total,
        year: Math.max(Number(total.year || 0), Number(row.year || 0)),
        totalPopulation: Number(total.totalPopulation || 0) + Number(row.totalPopulation || 0),
        under1Population: Number(total.under1Population || 0) + (row.under1Population ?? Math.round(Number(row.totalPopulation || 0) * (demographics.under1 || 0.038))),
        pregnantWomen: Number(total.pregnantWomen || 0) + (row.pregnantWomen ?? Math.round(Number(row.totalPopulation || 0) * (demographics.pregnant || 0.041))),
        schoolEntry: Number(total.schoolEntry || 0) + (row.schoolEntry ?? Math.round(Number(row.totalPopulation || 0) * (demographics.schoolEntry || 0.032))),
        schoolExit: Number(total.schoolExit || 0) + (row.schoolExit ?? Math.round(Number(row.totalPopulation || 0) * (demographics.schoolExit || 0.030))),
      }), {
        facilityId: selectedFacilityId,
        populationSource: "communities",
        sourceLabel: `${latestCommunityPopulation.size} assigned communities · latest record each`,
      });
    }

    // 4. Facility direct record fallback
    const facilityDirectRows = allFacilityRows.filter((p) => !p.villageId);
    if (facilityDirectRows.length > 0) {
      const best = facilityDirectRows.sort((a, b) => Number(b.year) - Number(a.year) || Number(b.id) - Number(a.id))[0];
      const total = Number(best.totalPopulation || 0);
      return {
        ...best,
        totalPopulation: total,
        under1Population: best.under1Population ?? Math.round(total * (demographics.under1 || 0.038)),
        pregnantWomen: best.pregnantWomen ?? Math.round(total * (demographics.pregnant || 0.041)),
        schoolEntry: best.schoolEntry ?? Math.round(total * (demographics.schoolEntry || 0.032)),
        schoolExit: best.schoolExit ?? Math.round(total * (demographics.schoolExit || 0.030)),
        sourceLabel: `Facility direct population record · ${best.year || currentYear}`,
      };
    }

    // 5. Catchment Grid Estimate fallback
    const catchmentPop = Number(selectedFacilityData?.catchmentGridPopulation || 5000);
    return {
      facilityId: selectedFacilityId,
      totalPopulation: catchmentPop,
      under1Population: Math.round(catchmentPop * (demographics.under1 || 0.038)),
      pregnantWomen: Math.round(catchmentPop * (demographics.pregnant || 0.041)),
      schoolEntry: Math.round(catchmentPop * (demographics.schoolEntry || 0.032)),
      schoolExit: Math.round(catchmentPop * (demographics.schoolExit || 0.030)),
      populationSource: "catchment",
      sourceLabel: `Catchment Grid Estimate · ${currentYear}`,
    };
  }, [selectedFacility, selectedFacilityData, populationData, latestCommunityPopulation, selectedPopSource, isManualPopActive, customPop, demographics, currentYear]);

  const availablePlans = useMemo(() => microplans.filter((plan: any) =>
    Number(plan.facilityId) === facilityId && (selectedQuarter ? Number(plan.quarter) === selectedQuarter : true)
  ).sort((a: any, b: any) => Number(b.year) - Number(a.year)), [microplans, facilityId, selectedQuarter]);

  const selectedPlan = useMemo(() => {
    if (selectedPlanId === "none") return null;
    if (selectedPlanId !== "auto") {
      return availablePlans.find((plan: any) => String(plan.id) === selectedPlanId) ||
             microplans.find((plan: any) => String(plan.id) === selectedPlanId && Number(plan.facilityId) === facilityId) ||
             null;
    }
    return availablePlans.find((plan: any) => Number(plan.year) === currentYear && plan.status !== "archived") ||
           availablePlans[0] ||
           null;
  }, [availablePlans, microplans, selectedPlanId, facilityId, currentYear]);

  const planSessions = useMemo(() => {
    if (!selectedPlan) return [];
    return sessions.filter((session: any) => {
      if (Number(session.facilityId) !== facilityId) return false;
      if (Number(session.microplanId) === Number(selectedPlan.id)) return true;
      return (
        Number(session.quarter) === Number(selectedPlan.quarter) &&
        Number(session.year) === Number(selectedPlan.year)
      );
    });
  }, [sessions, facilityId, selectedPlan]);

  const totalPlannedContacts = useMemo(() => {
    if (!selectedPlan) return 0;
    const directTarget = Number(selectedPlan.targetPopulation || 0);
    const sessionTargetSum = planSessions.reduce(
      (sum: number, s: any) => sum + Number(s.targetPopulation || s.effectiveTargetPopulation || s.target || 0),
      0
    );
    return sessionTargetSum > 0 ? sessionTargetSum : directTarget;
  }, [selectedPlan, planSessions]);

  const linkedPlanTarget = useMemo(() => {
    return totalPlannedContacts;
  }, [totalPlannedContacts]);

  const communityRequirements = useMemo(() => {
    if (!facilityPopulation) return [];
    const facilityTotalPop = Number(facilityPopulation.totalPopulation || 0);
    const facilityUnder1 = Number(facilityPopulation.under1Population ?? Math.round(facilityTotalPop * (demographics.under1 || 0.038)));
    const facilityPregnant = Number(facilityPopulation.pregnantWomen ?? Math.round(facilityTotalPop * (demographics.pregnant || 0.041)));
    const facilitySchoolEntry = Number(facilityPopulation.schoolEntry ?? Math.round(facilityTotalPop * (demographics.schoolEntry || 0.032)));
    const facilitySchoolExit = Number(facilityPopulation.schoolExit ?? Math.round(facilityTotalPop * (demographics.schoolExit || 0.030)));

    const linksByVillage = new Map<number, any[]>();
    const sessionById = new Map(planSessions.map((session: any) => [Number(session.id), session]));
    
    // Check junction records
    for (const link of sessionVillageLinks) {
      const session = sessionById.get(Number(link.sessionId));
      if (!session) continue;
      const id = Number(link.villageId);
      linksByVillage.set(id, [...(linksByVillage.get(id) || []), session]);
    }

    // Check direct communities array on sessions
    for (const session of planSessions) {
      if (Array.isArray(session.communities)) {
        for (const c of session.communities) {
          const villageId = Number(c.id);
          const existing = linksByVillage.get(villageId) || [];
          if (!existing.some((s: any) => Number(s.id) === Number(session.id))) {
            linksByVillage.set(villageId, [...existing, session]);
          }
        }
      }
    }

    // Proportional fallback if sessions exist but no explicit village junction is mapped
    if (planSessions.length > 0 && Array.from(linksByVillage.values()).every((arr) => arr.length === 0)) {
      for (const village of villages) {
        linksByVillage.set(Number(village.id), planSessions);
      }
    }

    const baselineVillageWeights = villages.map((village: any) => {
      const popRecord = latestCommunityPopulation.get(Number(village.id));
      return Math.max(1, Number(popRecord?.totalPopulation || village.population || 100));
    });
    const totalBaselineWeight = baselineVillageWeights.reduce((sum, w) => sum + w, 0) || 1;

    const isBottomUpCommunities = !selectedPopSource || selectedPopSource === "communities" || selectedPopSource === "auto";

    return villages.map((village: any, villageIndex: number) => {
      const popRecord = latestCommunityPopulation.get(Number(village.id));
      const villageWeight = baselineVillageWeights[villageIndex] / totalBaselineWeight;

      let villageTotalPop: number;
      let villageUnder1: number;
      let villagePregnant: number;
      let villageSchoolEntry: number;
      let villageSchoolExit: number;

      if (isBottomUpCommunities && !isManualPopActive) {
        villageTotalPop = Number(popRecord?.totalPopulation || village.population || 0);
        villageUnder1 = Number(popRecord?.under1Population ?? Math.round(villageTotalPop * (demographics.under1 || 0.038)));
        villagePregnant = Number(popRecord?.pregnantWomen ?? Math.round(villageTotalPop * (demographics.pregnant || 0.041)));
        villageSchoolEntry = Number(popRecord?.schoolEntry ?? Math.round(villageTotalPop * (demographics.schoolEntry || 0.032)));
        villageSchoolExit = Number(popRecord?.schoolExit ?? Math.round(villageTotalPop * (demographics.schoolExit || 0.030)));
      } else {
        // Dynamically scale each community's population and cohort targets to the selected facility demographic source or manual entry
        villageTotalPop = Math.max(1, Math.round(facilityTotalPop * villageWeight));
        villageUnder1 = Math.max(1, Math.round(facilityUnder1 * villageWeight));
        villagePregnant = Math.max(1, Math.round(facilityPregnant * villageWeight));
        villageSchoolEntry = Math.max(1, Math.round(facilitySchoolEntry * villageWeight));
        villageSchoolExit = Math.max(1, Math.round(facilitySchoolExit * villageWeight));
      }

      const linkedSessions = selectedPlan ? (linksByVillage.get(Number(village.id)) || []) : [];
      const scheduledTarget = selectedPlan
        ? linkedSessions.reduce((sum, session) => sum + Number(session.targetPopulation || session.effectiveTargetPopulation || 0), 0)
        : 0;

      const requirements = activeSchedule.map((vaccine) => {
        const annualCohort =
          vaccine.target === "under1" || vaccine.target === "birth" ? villageUnder1
          : vaccine.target === "pregnant" ? villagePregnant
          : vaccine.target === "schoolEntry" ? villageSchoolEntry
          : vaccine.target === "schoolExit" ? villageSchoolExit
          : Math.round(villageTotalPop * (demographics[vaccine.target as keyof typeof demographics] || 0.038));

        const quarterlyCohort = Math.max(1, Math.ceil(annualCohort / 4));
        const forecast = calculateLifeCourseForecast({
          population: quarterlyCohort,
          coveragePercent: coverageTarget,
          dosesPerPerson: vaccine.doses,
          dosesPerVial: vaccine.vialsPerDose,
          wastagePercent: vaccine.wastage,
          peoplePerSession: 40,
        });
        return {
          name: vaccine.name,
          vials: forecast.vials,
          doses: forecast.supplyDoses,
          administrationDoses: forecast.administrationDoses,
          targetPop: forecast.peopleToReach,
        };
      });

      return {
        village,
        totalPopulation: villageTotalPop,
        linkedSessions,
        scheduledTarget,
        requirements,
        totalVials: requirements.reduce((sum, req) => sum + req.vials, 0),
      };
    }).sort((a: any, b: any) => b.totalVials - a.totalVials);
  }, [villages, latestCommunityPopulation, planSessions, sessionVillageLinks, activeSchedule, demographics, coverageTarget, selectedPlan, facilityPopulation, selectedPopSource, isManualPopActive]);

  const calculations = useMemo(() => {
    if (!facilityPopulation) return [];
    const totalPop = Number(facilityPopulation.totalPopulation || 0);

    return activeSchedule.map((vaccine) => {
      const communityForecasts = communityRequirements
        .map((community: any) => community.requirements.find((requirement: any) => requirement.name === vaccine.name))
        .filter(Boolean);

      if (communityForecasts.length > 0) {
        return {
          ...vaccine,
          targetPop: communityForecasts.reduce((sum: number, item: any) => sum + item.targetPop, 0),
          dosesNeeded: communityForecasts.reduce((sum: number, item: any) => sum + item.administrationDoses, 0),
          dosesWithWastage: communityForecasts.reduce((sum: number, item: any) => sum + item.doses, 0),
          vialsNeeded: communityForecasts.reduce((sum: number, item: any) => sum + item.vials, 0),
          quarterlyVials: communityForecasts.reduce((sum: number, item: any) => sum + item.vials, 0),
        };
      }

      const explicitCohort =
        vaccine.target === "under1" || vaccine.target === "birth" ? facilityPopulation.under1Population
        : vaccine.target === "pregnant" ? facilityPopulation.pregnantWomen
        : vaccine.target === "schoolEntry" ? facilityPopulation.schoolEntry
        : vaccine.target === "schoolExit" ? facilityPopulation.schoolExit
        : Math.round(totalPop * (demographics[vaccine.target as keyof typeof demographics] || 0.038));

      const annualCohort = Number(explicitCohort || Math.round(totalPop * 0.038));
      const forecast = calculateLifeCourseForecast({
        population: Math.max(1, Math.ceil(annualCohort / 4)),
        coveragePercent: coverageTarget,
        dosesPerPerson: vaccine.doses,
        dosesPerVial: vaccine.vialsPerDose,
        wastagePercent: vaccine.wastage,
        peoplePerSession: 40,
      });

      return {
        ...vaccine,
        targetPop: forecast.peopleToReach,
        dosesNeeded: forecast.administrationDoses,
        dosesWithWastage: forecast.supplyDoses,
        vialsNeeded: forecast.vials,
        quarterlyVials: forecast.vials,
      };
    });
  }, [facilityPopulation, activeSchedule, coverageTarget, demographics, communityRequirements]);

  const totalVials = calculations.reduce((sum, c) => sum + c.quarterlyVials, 0);
  const totalDoses = calculations.reduce((sum, c) => sum + c.dosesWithWastage, 0);

  const handleEditClick = (config: any) => {
    const dbConfig = vaccineConfigs?.find((c) => c.id === config.id);
    if (dbConfig) {
      setEditingConfig({ ...dbConfig });
      setIsEditDialogOpen(true);
    } else {
      // For fallback schedules, construct dummy config edit structure
      setEditingConfig({
        id: config.id,
        name: config.name,
        targetGroup: config.target,
        doses: config.doses,
        recommendedAge: config.recommendedAge,
        recommendedAgeWeeks: 0,
        wastageFactor: config.wastage.toFixed(2),
        vialsPerDose: config.vialsPerDose,
        isActive: true,
      } as any);
      setIsEditDialogOpen(true);
    }
  };

  const handleUpdateConfig = () => {
    if (!editingConfig || editingConfig.id === undefined) return;
    updateMutation.mutate({
      id: editingConfig.id,
      data: editingConfig,
    });
  };

  const handleAddConfig = () => {
    createMutation.mutate(newConfig);
  };

  const [isImporting, setIsImporting] = useState(false);
  const handleImportTemplate = async () => {
    setIsImporting(true);
    try {
      let importedCount = 0;
      for (const antigen of fallbackVaccineSchedule) {
        const exists = vaccineConfigs?.some((c) => c.name.toLowerCase() === antigen.name.toLowerCase());
        if (!exists) {
          await apiRequest("POST", "/api/vaccines/config", {
            name: antigen.name,
            targetGroup: antigen.target,
            doses: antigen.doses,
            recommendedAge: antigen.recommendedAge,
            recommendedAgeWeeks: antigen.name === "BCG" || antigen.name === "OPV-0" ? 0 : 6,
            wastageFactor: antigen.wastage.toFixed(2),
            vialsPerDose: antigen.vialsPerDose,
            isActive: true,
          });
          importedCount++;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/vaccines/config"] });
      toast({
        title: "Template Imported",
        description: importedCount > 0 
          ? `Successfully imported ${importedCount} standard EPI antigens.`
          : "All standard EPI antigens are already configured.",
      });
    } catch (err: any) {
      toast({
        title: "Import Failed",
        description: err.message || "Failed to import EPI antigens",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (loadingFacilities || loadingPopulation || loadingTenant || loadingConfigs) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
            EPI Vaccine Calculator
          </h1>
          <p className="text-muted-foreground text-sm">
            Calculate vaccine requirements and adjust tenant-level schedules dynamically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isNationalAdmin && (
            <>
              <Button
                onClick={handleImportTemplate}
                variant="outline"
                className="border-dashed flex items-center gap-1.5"
                disabled={isImporting}
              >
                {isImporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                Import EPI Calculator Template
              </Button>
              <Button onClick={() => setIsAddDialogOpen(true)} variant="default">
                <Plus className="h-4 w-4 mr-1" />
                Add Antigen
              </Button>
            </>
          )}
          <Button variant="outline" data-testid="button-export-requirements">
            <Download className="h-4 w-4 mr-1" />
            Export Requirements
          </Button>
        </div>
      </div>

      <Card className="backdrop-blur-md bg-card/60 border border-border/40">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary animate-pulse" />
            Calculation Parameters
          </CardTitle>
          <CardDescription>
            Select microplanning facility, quarter, existing operational plan, and demographic data source.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="space-y-2 md:col-span-4">
              <Label>Facility</Label>
              <FacilityCascadePicker
                value={selectedFacility ? Number(selectedFacility) : null}
                onChange={(id) => setSelectedFacility(id ? String(id) : "")}
                showLabels={false}
                testIdPrefix="calculator-facility"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Quarter</Label>
              <Select
                value={selectedQuarter.toString()}
                onValueChange={(v) => setSelectedQuarter(parseInt(v))}
              >
                <SelectTrigger data-testid="select-calculator-quarter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                  <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                  <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                  <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-3">
              <Label className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Existing plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={!facilityId}>
                <SelectTrigger data-testid="select-calculator-plan">
                  <SelectValue placeholder="Use matching plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto: latest matching plan</SelectItem>
                  {availablePlans.map((plan: any) => (
                    <SelectItem key={plan.id} value={String(plan.id)}>
                      {plan.name} · {plan.year} Q{plan.quarter}
                    </SelectItem>
                  ))}
                  <SelectItem value="none">None: standalone calculation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-3">
              <Label className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> Population Source</span>
                {isManualPopActive && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] py-0 px-1.5">
                    Manual Override
                  </Badge>
                )}
              </Label>
              <Select
                value={isManualPopActive ? "manual" : selectedPopSource}
                onValueChange={(v) => {
                  if (v === "manual") {
                    setIsManualPopActive(true);
                    setIsPopDialogOpen(true);
                  } else {
                    setIsManualPopActive(false);
                    setSelectedPopSource(v);
                  }
                }}
                disabled={!facilityId}
              >
                <SelectTrigger data-testid="select-population-source">
                  <SelectValue placeholder="Select Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto: Assigned Communities Sum</SelectItem>
                  <SelectItem value="communities">Assigned Communities (Bottom-Up)</SelectItem>
                  <SelectItem value="nso">NSO Census Projections</SelectItem>
                  <SelectItem value="hmis">HMIS Health Facility Records</SelectItem>
                  <SelectItem value="worldpop">WorldPop High-Resolution Satellite</SelectItem>
                  <SelectItem value="survey">EPI Coverage Survey</SelectItem>
                  <SelectItem value="manual">Manual Entry / Custom Override...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-12 lg:col-span-4">
              <Label className="flex items-center justify-between">
                <span>Coverage Target (%)</span>
                <span className="font-semibold text-primary">{coverageTarget}%</span>
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={50}
                  max={100}
                  value={coverageTarget}
                  onChange={(e) => setCoverageTarget(parseInt(e.target.value) || 95)}
                  className="w-20 font-mono"
                  data-testid="input-coverage-target"
                />
                <Progress value={coverageTarget} className="flex-1 h-2.5" />
              </div>
            </div>
          </div>

          {selectedPlan ? (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-y-2">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span className="font-medium flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-primary" /> Linked to {selectedPlan.name}
                </span>
                <span className="font-semibold text-foreground">
                  {planSessions.length} planned session{planSessions.length === 1 ? "" : "s"}
                </span>
                <span className="font-semibold text-foreground">
                  {totalPlannedContacts.toLocaleString()} planned contacts
                </span>
                <Badge variant="outline" className="capitalize">{selectedPlan.status || "draft"}</Badge>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-muted bg-muted/20 px-4 py-3 text-sm flex items-center gap-2 text-muted-foreground">
              <Link2 className="h-4 w-4" />
              <span>No plan selected — 0 planned sessions · 0 planned contacts</span>
            </div>
          )}
        </CardContent>
      </Card>

      {facilityPopulation && (
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/0 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground font-medium">Population Base</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-xs text-primary hover:bg-primary/10 gap-1"
                      onClick={() => {
                        setCustomPop({
                          total: String(facilityPopulation.totalPopulation || ""),
                          under1: String(facilityPopulation.under1Population || ""),
                          pregnant: String(facilityPopulation.pregnantWomen || ""),
                          schoolEntry: String(facilityPopulation.schoolEntry || ""),
                        });
                        setIsPopDialogOpen(true);
                      }}
                      title="Adjust population or switch source"
                    >
                      <Edit2 className="h-3 w-3" />
                      Adjust
                    </Button>
                  </div>
                  <p className="text-3xl font-bold font-mono tracking-tight">
                    {facilityPopulation.totalPopulation?.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {facilityPopulation.sourceLabel || "Standard population record"}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-primary/0 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Doses (Q{selectedQuarter})</p>
                  <p className="text-3xl font-bold font-mono tracking-tight mt-1">
                    {totalDoses.toLocaleString()}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Syringe className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-primary/0 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Vials Required (Q{selectedQuarter})</p>
                  <p className="text-3xl font-bold font-mono tracking-tight mt-1">
                    {totalVials.toLocaleString()}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Thermometer className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedFacility && communityRequirements.length > 0 && (
        <Card className="border border-border/40 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Community Requirements</CardTitle>
            <CardDescription>
              Quarterly requirements for each community assigned to this health facility. Population comes from the latest community record; session targets come from the linked plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Community</TableHead><TableHead className="text-right">Population</TableHead>
                  <TableHead className="text-right">Plan sessions</TableHead><TableHead className="text-right">Planned contacts</TableHead>
                  <TableHead>Quarterly antigen requirements</TableHead><TableHead className="text-right">Total vials</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {communityRequirements.map(({ village, totalPopulation, linkedSessions, scheduledTarget, requirements, totalVials }: any) => (
                    <TableRow key={village.id}>
                      <TableCell><div className="font-medium">{village.name}</div><div className="text-xs text-muted-foreground">{village.code || village.villageCode || "Assigned community"}</div></TableCell>
                      <TableCell className="text-right font-mono">{totalPopulation ? totalPopulation.toLocaleString() : "—"}</TableCell>
                      <TableCell className="text-right">{linkedSessions.length}</TableCell>
                      <TableCell className="text-right font-mono">{scheduledTarget ? scheduledTarget.toLocaleString() : "—"}</TableCell>
                      <TableCell><div className="flex flex-wrap gap-1">
                        {requirements.map((req: any) => <Badge key={req.name} variant="secondary" className="font-normal">{req.name}: {req.vials} vials</Badge>)}
                      </div></TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">{totalVials.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-border/40 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Antigen Matrix & Requirements</CardTitle>
          <CardDescription>
            Lists active immunizations, schedules, and dynamic calculations per dose requirements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedFacility ? (
            <div className="text-center py-12 text-muted-foreground">
              <Syringe className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              Select a facility above to calculate operational vaccine requirements.
            </div>
          ) : !facilityPopulation ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500/50 mb-3" />
              No demographic population data available for this facility in {new Date().getFullYear()}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Antigen</TableHead>
                    <TableHead>Target Group</TableHead>
                    <TableHead className="text-right">Recommended Age</TableHead>
                    <TableHead className="text-right">Target Pop.</TableHead>
                    <TableHead className="text-right">Doses/Person</TableHead>
                    <TableHead className="text-right">Wastage Rate</TableHead>
                    <TableHead className="text-right">Total Doses</TableHead>
                    <TableHead className="text-right">Q{selectedQuarter} Vials</TableHead>
                    {isNationalAdmin && <TableHead className="text-center">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculations.map((calc) => (
                    <TableRow key={calc.name} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Syringe className="h-4 w-4 text-primary/70" />
                          {calc.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {calc.target.replace(/([A-Z])/g, " $1").trim()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {calc.recommendedAge}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {calc.targetPop.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{calc.doses}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="text-xs">
                          {calc.wastage}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {calc.dosesWithWastage.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                        {calc.quarterlyVials.toLocaleString()}
                      </TableCell>
                      {isNationalAdmin && (
                        <TableCell className="text-center">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditClick(calc)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Antigen Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Antigen</DialogTitle>
            <DialogDescription>
              Modify vaccine schedule targets, doses, recommended ages, and wastage multipliers.
            </DialogDescription>
          </DialogHeader>
          {editingConfig && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Antigen Name</Label>
                <Select
                  value={fallbackVaccineSchedule.some(a => a.name === editingConfig.name) ? editingConfig.name : "Custom"}
                  onValueChange={(val) => {
                    if (val === "Custom") {
                      setEditingConfig({ ...editingConfig, name: "" });
                    } else {
                      const standard = fallbackVaccineSchedule.find((a) => a.name === val);
                      if (standard) {
                        setEditingConfig({
                          ...editingConfig,
                          name: standard.name,
                          targetGroup: standard.target,
                          doses: standard.doses,
                          recommendedAge: standard.recommendedAge,
                          wastageFactor: standard.wastage.toFixed(2),
                          vialsPerDose: standard.vialsPerDose,
                        });
                      }
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-edit-antigen">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fallbackVaccineSchedule.map((antigen) => (
                      <SelectItem key={antigen.name} value={antigen.name}>
                        {antigen.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="Custom">Custom / Other</SelectItem>
                  </SelectContent>
                </Select>
                {(!fallbackVaccineSchedule.some(a => a.name === editingConfig.name)) && (
                  <Input
                    className="mt-2"
                    placeholder="Enter custom antigen name"
                    value={editingConfig.name || ""}
                    onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Group</Label>
                  <Select
                    value={editingConfig.targetGroup || "under1"}
                    onValueChange={(v) => setEditingConfig({ ...editingConfig, targetGroup: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="births">Births</SelectItem>
                      <SelectItem value="under1">Under 1 Child</SelectItem>
                      <SelectItem value="pregnant">Pregnant Women</SelectItem>
                      <SelectItem value="schoolEntry">School Entry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Required Doses</Label>
                  <Input
                    type="number"
                    value={editingConfig.doses || 1}
                    onChange={(e) => setEditingConfig({ ...editingConfig, doses: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Recommended Age weeks</Label>
                  <Input
                    type="number"
                    value={editingConfig.recommendedAgeWeeks || 0}
                    onChange={(e) => setEditingConfig({ ...editingConfig, recommendedAgeWeeks: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Wastage Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={99}
                    value={wastagePercent(editingConfig.wastageFactor ?? 10)}
                    onChange={(e) => setEditingConfig({ ...editingConfig, wastageFactor: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vials Packaging (vials/dose)</Label>
                  <Input
                    type="number"
                    value={editingConfig.vialsPerDose || 1}
                    onChange={(e) => setEditingConfig({ ...editingConfig, vialsPerDose: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Recommended Age Desc</Label>
                  <Input
                    value={editingConfig.recommendedAge || ""}
                    onChange={(e) => setEditingConfig({ ...editingConfig, recommendedAge: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateConfig}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Antigen Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Vaccine Config</DialogTitle>
            <DialogDescription>
              Create a custom vaccine profile for this tenant country program.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Antigen Name</Label>
              <Select
                value={isCustomAntigen ? "Custom" : newConfig.name || ""}
                onValueChange={(val) => {
                  if (val === "Custom") {
                    setIsCustomAntigen(true);
                    setNewConfig({
                      ...newConfig,
                      name: "",
                      targetGroup: "under1",
                      doses: 1,
                      recommendedAge: "",
                      recommendedAgeWeeks: 0,
                      wastageFactor: "10.00",
                      vialsPerDose: 1,
                    });
                  } else {
                    setIsCustomAntigen(false);
                    const standard = fallbackVaccineSchedule.find((a) => a.name === val);
                    if (standard) {
                      setNewConfig({
                        name: standard.name,
                        targetGroup: standard.target,
                        doses: standard.doses,
                        recommendedAge: standard.recommendedAge,
                        recommendedAgeWeeks: standard.name === "BCG" || standard.name === "OPV-0" ? 0 : 6,
                        wastageFactor: standard.wastage.toFixed(2),
                        vialsPerDose: standard.vialsPerDose,
                        isActive: true,
                      });
                    }
                  }
                }}
              >
                <SelectTrigger data-testid="select-add-antigen">
                  <SelectValue placeholder="Select standard antigen..." />
                </SelectTrigger>
                <SelectContent>
                  {fallbackVaccineSchedule.map((antigen) => (
                    <SelectItem key={antigen.name} value={antigen.name}>
                      {antigen.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="Custom">Custom / Other</SelectItem>
                </SelectContent>
              </Select>
              {isCustomAntigen && (
                <Input
                  className="mt-2"
                  placeholder="Enter custom antigen name"
                  value={newConfig.name}
                  onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Group</Label>
                <Select
                  value={newConfig.targetGroup}
                  onValueChange={(v) => setNewConfig({ ...newConfig, targetGroup: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="births">Births</SelectItem>
                    <SelectItem value="under1">Under 1 Child</SelectItem>
                    <SelectItem value="pregnant">Pregnant Women</SelectItem>
                    <SelectItem value="schoolEntry">School Entry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Required Doses</Label>
                <Input
                  type="number"
                  value={newConfig.doses}
                  onChange={(e) => setNewConfig({ ...newConfig, doses: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recommended Age weeks</Label>
                <Input
                  type="number"
                  value={newConfig.recommendedAgeWeeks}
                  onChange={(e) => setNewConfig({ ...newConfig, recommendedAgeWeeks: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Wastage Rate (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={99}
                  value={newConfig.wastageFactor}
                  onChange={(e) => setNewConfig({ ...newConfig, wastageFactor: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vials Packaging (vials/dose)</Label>
                <Input
                  type="number"
                  value={newConfig.vialsPerDose}
                  onChange={(e) => setNewConfig({ ...newConfig, vialsPerDose: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Recommended Age Desc</Label>
                <Input
                  placeholder="e.g. 6, 10, 14 weeks"
                  value={newConfig.recommendedAge}
                  onChange={(e) => setNewConfig({ ...newConfig, recommendedAge: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddConfig}>Create Config</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Population Source & Custom Override Dialog */}
      <Dialog open={isPopDialogOpen} onOpenChange={setIsPopDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Population Source & Manual Cohorts
            </DialogTitle>
            <DialogDescription>
              Select an official demographic data source or specify custom catchment population cohorts for vaccine requirement calculations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-semibold">Demographic Data Source</Label>
              <Select
                value={isManualPopActive ? "manual" : selectedPopSource}
                onValueChange={(val) => {
                  if (val === "manual") {
                    setIsManualPopActive(true);
                  } else {
                    setIsManualPopActive(false);
                    setSelectedPopSource(val);
                  }
                }}
              >
                <SelectTrigger data-testid="select-modal-population-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto: Assigned Communities Sum</SelectItem>
                  <SelectItem value="communities">Assigned Communities (Bottom-Up Sum)</SelectItem>
                  <SelectItem value="nso">NSO Census Projections</SelectItem>
                  <SelectItem value="hmis">HMIS Health Facility Records</SelectItem>
                  <SelectItem value="worldpop">WorldPop High-Resolution Satellite Model</SelectItem>
                  <SelectItem value="survey">EPI Cluster Coverage Survey</SelectItem>
                  <SelectItem value="manual">Manual Entry / Custom Population Override</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border p-4 bg-muted/20 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isManualPopActive ? "Custom Cohort Values" : "Active Cohort Projections"}
                </span>
                {isManualPopActive ? (
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                    Custom Override Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]">
                    Database Synced
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Total Catchment Population</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 6968"
                    value={isManualPopActive ? customPop.total : (facilityPopulation?.totalPopulation ? String(facilityPopulation.totalPopulation) : "")}
                    onChange={(e) => {
                      setIsManualPopActive(true);
                      const totalVal = e.target.value;
                      const num = Number(totalVal) || 0;
                      setCustomPop({
                        total: totalVal,
                        under1: customPop.under1 || String(Math.round(num * (demographics.under1 || 0.03))),
                        pregnant: customPop.pregnant || String(Math.round(num * (demographics.pregnant || 0.032))),
                        schoolEntry: customPop.schoolEntry || String(Math.round(num * (demographics.schoolEntry || 0.027))),
                      });
                    }}
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Base denominator used across operational antigen allocations.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Under-1 Cohort (Infants)</Label>
                    <span className="text-[10px] text-muted-foreground">{Math.round((demographics.under1 || 0.03) * 100)}%</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="e.g. 209"
                    value={isManualPopActive ? customPop.under1 : (facilityPopulation?.under1Population ? String(facilityPopulation.under1Population) : "")}
                    onChange={(e) => {
                      setIsManualPopActive(true);
                      setCustomPop({ ...customPop, under1: e.target.value });
                    }}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Pregnant Women</Label>
                    <span className="text-[10px] text-muted-foreground">{Math.round((demographics.pregnant || 0.032) * 100)}%</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="e.g. 223"
                    value={isManualPopActive ? customPop.pregnant : (facilityPopulation?.pregnantWomen ? String(facilityPopulation.pregnantWomen) : "")}
                    onChange={(e) => {
                      setIsManualPopActive(true);
                      setCustomPop({ ...customPop, pregnant: e.target.value });
                    }}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">School Entry (4-5 yrs)</Label>
                    <span className="text-[10px] text-muted-foreground">{Math.round((demographics.schoolEntry || 0.027) * 100)}%</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="e.g. 188"
                    value={isManualPopActive ? customPop.schoolEntry : (facilityPopulation?.schoolEntry ? String(facilityPopulation.schoolEntry) : "")}
                    onChange={(e) => {
                      setIsManualPopActive(true);
                      setCustomPop({ ...customPop, schoolEntry: e.target.value });
                    }}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsManualPopActive(false);
                setSelectedPopSource("auto");
                setCustomPop({ total: "", under1: "", pregnant: "", schoolEntry: "" });
                setIsPopDialogOpen(false);
                toast({
                  title: "Reset to Database Default",
                  description: "Population calculation restored to official community and facility records.",
                });
              }}
            >
              Reset to Default Sources
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  setIsPopDialogOpen(false);
                  toast({
                    title: "Population Updated",
                    description: isManualPopActive
                      ? "Custom population cohorts applied to vaccine calculator."
                      : `Population source updated to ${selectedPopSource.toUpperCase()}.`,
                  });
                }}
              >
                Apply
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
