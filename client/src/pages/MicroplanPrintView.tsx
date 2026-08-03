import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Printer, ArrowLeft, Calendar, ShieldCheck, MapPin, Syringe, ClipboardList, Wallet, FileText, Check, Square, Download, Layers, Truck, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePersistedBasemap, BASEMAP_CONFIGS } from "@/components/map/BasemapToggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  District,
  Province,
} from "@shared/schema";

type PrintCommunity = {
  id: number | string;
  name: string;
  type: string;
  targetPopulation: number;
  source: string;
  strategy: string;
  focalPersonName: string;
  focalPersonPhone: string;
  focalPersonSource?: string;
  communicationContactMade: boolean;
  outsideFollowUpCheck: boolean;
  distanceToFacility?: string | number | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
};

type MicroplanHydration = {
  microplan: Microplan;
  sessions: SessionPlan[];
  sessionDayPlans: SessionDayPlan[];
  supervisionVisits: SupervisionVisit[];
  population: PopulationData[];
  vaccineRequirements: VaccineRequirement[];
  mobilization: MobilizationActivity[];
  budgetItems: BudgetItem[];
  excludedVillageIds?: number[];
};

export default function MicroplanPrintView() {
  const { id } = useParams<{ id: string }>();
  const microplanId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [printSize, setPrintSize] = useState<"A4" | "A3" | "A2" | "A1" | "A0">("A4");
  const [basemap] = usePersistedBasemap("positron");

  const [leaflet, setLeaflet] = useState<any>(null);

  // Dynamic Leaflet import to prevent SSR build issues
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

  // Fetch all microplan details
  const { data: hydration, isLoading: loadingHydration } = useQuery<MicroplanHydration>({
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

  const { data: facilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });

  const { data: villages } = useQuery<Village[]>({
    queryKey: ["/api/villages"],
  });

  const { data: districts } = useQuery<District[]>({
    queryKey: ["/api/districts"],
  });

  const { data: provinces } = useQuery<Province[]>({
    queryKey: ["/api/provinces"],
  });

  const microplan = hydration?.microplan;

  const isCampaign = useMemo(() => {
    return microplan ? microplan.planType === "sia_campaign" : false;
  }, [microplan]);

  const coldChainReq = useMemo(() => {
    return (microplan as any)?.staffing?.coldChain || { coldBoxes: "0", icePacks: "0", carriers: "0" };
  }, [microplan]);

  const reqColdBoxes = useMemo(() => parseInt(coldChainReq.coldBoxes || "0", 10), [coldChainReq]);
  const reqCarriers = useMemo(() => parseInt(coldChainReq.carriers || "0", 10), [coldChainReq]);

  const facility = useMemo(() => {
    if (!microplan || !facilities) return null;
    return facilities.find((f) => f.id === microplan.facilityId) ?? null;
  }, [microplan, facilities]);

  const district = useMemo(() => {
    if (!facility || !districts) return null;
    return districts.find((d) => d.id === facility.districtId) ?? null;
  }, [facility, districts]);

  const province = useMemo(() => {
    if (!district || !provinces) return null;
    return provinces.find((p) => p.id === district.provinceId) ?? null;
  }, [district, provinces]);

  const { data: staffProfile } = useQuery<any[]>({
    queryKey: [`/api/facilities/${facility?.id}/staff`],
    enabled: !!facility?.id,
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facility?.id}/staff`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: hfcMembers = [] } = useQuery<any[]>({
    queryKey: [`/api/facilities/${facility?.id}/hfc-committee`, isCampaign],
    enabled: !!facility?.id,
    queryFn: async () => {
      const url = `/api/facilities/${facility?.id}/hfc-committee` + (isCampaign ? "?planType=campaign" : "");
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: chvProfiles = [] } = useQuery<any[]>({
    queryKey: [`/api/facilities/${facility?.id}/chvs`, isCampaign],
    enabled: !!facility?.id,
    queryFn: async () => {
      const url = `/api/facilities/${facility?.id}/chvs` + (isCampaign ? "?planType=campaign" : "");
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: dbColdChain = [] } = useQuery<any[]>({
    queryKey: [`/api/facilities/${facility?.id}/cold-chain`],
    enabled: !!facility?.id,
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facility?.id}/cold-chain`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const availableColdBoxes = useMemo(() => {
    return dbColdChain.filter((e) => e.equipmentType === "cold_box" && e.condition === "functional").length;
  }, [dbColdChain]);

  const availableCarriers = useMemo(() => {
    return dbColdChain.filter((e) => e.equipmentType === "vaccine_carrier" && e.condition === "functional").length;
  }, [dbColdChain]);

  const mapHeightClass = useMemo(() => {
    switch (printSize) {
      case "A0": return "h-[700px]";
      case "A1": return "h-[580px]";
      case "A2": return "h-[480px]";
      case "A3": return "h-[400px]";
      case "A4":
      default: return "h-[320px]";
    }
  }, [printSize]);

  // Fetch catchment boundary if available
  const { data: catchment } = useQuery<any>({
    queryKey: [`/api/facilities/${facility?.id}/catchments`],
    enabled: !!facility?.id,
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facility?.id}/catchments`, { credentials: "include" });
      if (!res.ok) return null;
      const arr = await res.json();
      return arr.length > 0 ? arr[0] : null;
    },
  });

  const submissionSnapshot = useMemo(() => {
    const staffObj = (microplan as any)?.staffing;
    if (!staffObj || typeof staffObj !== "object" || Array.isArray(staffObj)) return null;
    return staffObj.submissionSnapshot ?? null;
  }, [microplan]);

  const mappedCommunities = useMemo<PrintCommunity[]>(() => {
    if (Array.isArray((submissionSnapshot as any)?.communities) && (submissionSnapshot as any).communities.length > 0) {
      return (submissionSnapshot as any).communities.map((c: any, index: number) => ({
        id: c.villageId ?? c.id ?? `snapshot-community-${index}`,
        name: c.name ?? `Community ${index + 1}`,
        type: c.type || "village",
        targetPopulation: Number(c.targetPopulation || 0),
        source: c.source || "nso",
        strategy: c.strategy || "static",
        focalPersonName: c.focalPersonName || "",
        focalPersonPhone: c.focalPersonPhone || "",
        focalPersonSource: c.focalPersonSource || (c.focalChvId ? "CHV registry" : ""),
        communicationContactMade: !!c.communicationContactMade,
        outsideFollowUpCheck: !!c.outsideFollowUpCheck,
        distanceToFacility: c.distanceToFacility ?? null,
        latitude: c.latitude ?? null,
        longitude: c.longitude ?? null,
      }));
    }
    if (!villages || !facility || !hydration) return [];
    const excluded = new Set(hydration.excludedVillageIds ?? []);

    // Build a set of village names from this microplan's scheduled sessions.
    // Sessions are named "{villageName} {date}" so we strip the trailing date.
    const sessionVillageNames = new Set(
      (hydration.sessions ?? []).map((s) =>
        (s.name ?? "").replace(/\s+\d{4}-\d{2}-\d{2}$/, "").trim().toLowerCase()
      )
    );

    // If the microplan has sessions, only show villages that match a session.
    // If there are no sessions yet (blank plan), fall back to facility-assigned villages.
    const activeVillages = villages.filter((v) => {
      if (excluded.has(v.id)) return false;
      if (sessionVillageNames.size > 0) {
        return sessionVillageNames.has(v.name.trim().toLowerCase());
      }
      // Fallback: facility-assigned or district-scoped
      return v.assignedFacilityId === facility.id || v.districtId === facility.districtId;
    });

    return activeVillages.map((v) => {
      const popRecord = hydration.population?.find((p) => p.villageId === v.id);
      const meta = (popRecord?.metadata as any) ?? {};
      return {
        id: v.id,
        name: v.name,
        type: meta.type || "village",
        targetPopulation: popRecord?.totalPopulation ?? 0,
        source: popRecord?.source || "nso",
        strategy: meta.strategy || (v.isHardToReach ? "outreach" : "static"),
        focalPersonName: v.focalPersonName || (popRecord?.metadata as any)?.focalPersonName || "",
        focalPersonPhone: v.focalPersonPhone || (popRecord?.metadata as any)?.focalPersonPhone || "",
        focalPersonSource: (popRecord?.metadata as any)?.focalPersonSource || ((popRecord?.metadata as any)?.focalChvId ? "CHV registry" : ""),
        communicationContactMade: v.focalPersonCommChecked || (popRecord?.metadata as any)?.communicationContactMade || false,
        outsideFollowUpCheck: v.outsideFollowUpMade || (popRecord?.metadata as any)?.outsideFollowUpCheck || false,
        distanceToFacility: v.distanceToFacility,
        latitude: v.latitude,
        longitude: v.longitude,
      };
    });
  }, [villages, facility, hydration, submissionSnapshot]);

  // Map center calculation
  const mapCenter = useMemo<[number, number]>(() => {
    if (facility?.latitude != null && facility?.longitude != null) {
      return [parseFloat(String(facility.latitude)), parseFloat(String(facility.longitude))];
    }
    const first = mappedCommunities.find((c) => c.latitude && c.longitude);
    if (first) {
      return [parseFloat(String(first.latitude)), parseFloat(String(first.longitude))];
    }
    return [-13.13, 27.85]; // Zambia fallback
  }, [facility, mappedCommunities]);

  // Rehydrate staffing roster details from microplan staffing JSONB field
  const staffingRoster = useMemo(() => {
    if (Array.isArray((submissionSnapshot as any)?.staffing) && (submissionSnapshot as any).staffing.length > 0) {
      return (submissionSnapshot as any).staffing;
    }
    if (!microplan) return [];
    const staffObj = (microplan as any).staffing;
    if (staffObj && Array.isArray(staffObj.roster)) {
      return staffObj.roster;
    }
    // Fallback if not saved yet: build from calendar
    return (hydration?.sessions || []).map((s) => {
      const vName = (s.name ?? "").replace(/\s+\d{4}-\d{2}-\d{2}$/, "").trim();
      return {
        rowId: String(s.id),
        sessionLabel: `${vName} — ${s.scheduledDate ? new Date(s.scheduledDate).toISOString().slice(0, 10) : ""}`,
        vaccinator: "—",
        recorder: "—",
        supervisor: "—",
        teamType: "fixed",
        target: 0,
        perDiem: 0,
      };
    });
  }, [microplan, hydration?.sessions, submissionSnapshot]);

  // Rehydrate supportive supervision details
  const mappedSupervision = useMemo(() => {
    if (!hydration?.supervisionVisits) return [];
    return hydration.supervisionVisits.map((v) => {
      const dt = v.scheduledDate ? new Date(v.scheduledDate) : new Date();
      const checklistArr = Array.isArray(v.checklist) ? (v.checklist as any[]) : [];
      const checklistLabel =
        (checklistArr[0] && (checklistArr[0].label as string)) || "WHO RED checklist";
      return {
        id: v.id,
        quarter: Math.ceil((dt.getUTCMonth() + 1) / 3),
        scheduledDate: v.scheduledDate,
        supervisorName: v.supervisorName ?? "—",
        checklist: checklistLabel,
        followUp: v.followUpActions ?? "—",
      };
    });
  }, [hydration?.supervisionVisits]);

  // Calculation helpers
  const budgetTotal = useMemo(() => {
    if (!hydration?.budgetItems) return 0;
    return hydration.budgetItems.reduce(
      (sum, b) => sum + Number(b.unitCost || 0) * Number(b.quantity || 0),
      0
    );
  }, [hydration?.budgetItems]);

  const targetPopulationTotal = useMemo(() => {
    if (!mappedCommunities) return 0;
    return mappedCommunities.reduce((sum, c) => sum + c.targetPopulation, 0);
  }, [mappedCommunities]);

  if (loadingHydration || !microplan || !facility) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Hydrating printable microplan details…</p>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    const pt = isCampaign ? "campaigns" : "routine";
    setLocation(`/microplans/${pt}/${microplan.id}`);
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import("@e965/xlsx");
      const wb = XLSX.utils.book_new();

      // Sheet 0: Cover Page
      const coverData = [
        ["NATIONAL IMMUNIZATION PROGRAM"],
        ["HEALTH FACILITY MICROPLAN & OPERATIONAL PLAYBOOK"],
        [],
        ["Microplan Name", microplan?.name || "—"],
        ["Facility Name", facility?.name || "—"],
        ["HMIS Code", facility?.hmisCode || "—"],
        ["District", district?.name || "—"],
        ["Province", province?.name || "—"],
        ["Plan Type", isCampaign ? "SIA Campaign" : "Routine Immunization (RI)"],
        ["Year", microplan?.year || new Date().getFullYear()],
        ["Quarter", `Quarter ${microplan?.quarter || 1}`],
        ["Status", microplan?.status || "—"],
        ["Generated Date", new Date().toLocaleDateString()],
        [],
        ["Total Target Population", targetPopulationTotal],
        ["Total Planned Budget", `$ ${budgetTotal.toLocaleString()}`],
        ["Total Sessions", hydration?.sessions?.length ?? 0],
      ];
      const wsCover = XLSX.utils.aoa_to_sheet(coverData);
      XLSX.utils.book_append_sheet(wb, wsCover, "Cover Page");

      // Sheet 1: Instructions
      const instructionsData = [
        ["MICROPLANNING WORKBOOK INSTRUCTIONS"],
        [],
        ["Sheet Name", "Description & Instructions for Completion"],
        ["Cover Page", "Identifies the planning document, facility name, year, and key targets."],
        ["1.0 List of Villages", "Lists all registered catchment communities, their targets, and delivery strategies."],
        ["1.1 Cross-border Villages", "Lists villages near borders requiring cross-border health coordination."],
        ["1.2 International Cross-border Points", "Identifies formal/informal crossing points and SIA coverage strategies."],
        ["2.0 Health Facility Mapping", "Documents geographical coordinates, infrastructure, and staff counts."],
        ["3.0 Team Movement Plan", "Specifies daily destinations, vaccinators, and supply forecasts for Days 1-5."],
        ["3.1 Border Team Plan", "Daily vaccination calendar at border crossing points."],
        ["3.2 Static Team Plan", "Plans static post immunization activities inside the health facility."],
        ["4.0 Summary Teams Plan", "Consolidates workforce (vaccinators, volunteers) and overall supplies."],
        ["5.0 Cold Chain Assessment", "Compares cold boxes/carriers required against available stock to flag shortfalls."],
        ["6.0 ACSM Mapping", "Maps community leaders, traditional healers, and religious heads for mobilization."],
        ["6.1 ACSM Plan", "Tracks community mobilization activities, audiences, dates, and progress."],
        ["7.0 Contact Directory", "Lists key contacts, phone numbers, and supervisor team assignments."],
        ["8.0 HF Staff Profile", "Lists available professional staff, years of experience, and campaign roles."],
        ["9.0 HFC Board", "Profiles HFC governance members overseeing campaign accountability."],
        ["10.0 CHV Profile", "Profiles Community Health Volunteers (CHVs) and their assigned SIA roles."],
      ];
      const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
      XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

      // Sheet 1.0: List of Villages
      const villagesHeaders = [
        "Village Name", "Type", "Target Population", "Delivery Strategy", "Focal Person", "Focal Phone", "Contact Made", "Follow-up Confirmed", "Distance to Facility (km)"
      ];
      const villagesRows = mappedCommunities.map(c => [
        c.name, c.type, c.targetPopulation, c.strategy, c.focalPersonName, c.focalPersonPhone,
        c.communicationContactMade ? "Yes" : "No", c.outsideFollowUpCheck ? "Yes" : "No", c.distanceToFacility || 0
      ]);
      const wsVillages = XLSX.utils.aoa_to_sheet([villagesHeaders, ...villagesRows]);
      XLSX.utils.book_append_sheet(wb, wsVillages, "1.0 List of Villages");

      // Sheet 1.1: Cross-border Villages
      const cbHeaders = [
        "Border Country", "Border Village Name", "Cross-Border Coordination Required", "Serving Health Facility", "Comments"
      ];
      const cbRows = mappedCommunities
        .filter(c => c.strategy === "outreach" || (c.distanceToFacility != null && Number(c.distanceToFacility) > 8))
        .map(c => [
          "Neighboring Country", c.name, "Yes", facility?.name || "—", "High-risk mobile border community"
        ]);
      const wsCb = XLSX.utils.aoa_to_sheet([cbHeaders, ...cbRows.length ? cbRows : [["—", "—", "—", "—", "—"]]]);
      XLSX.utils.book_append_sheet(wb, wsCb, "1.1 Cross-border Villages");

      // Sheet 1.2: International Cross-border Points
      const crossingHeaders = [
        "Border Crossing Name", "Nearest Village", "Serving Health Facility", "Crossing Type", "Daily People Movement", "SIA Strategy"
      ];
      const crossingRows = (hydration?.sessions || [])
        .filter(s => s.sessionType === "mobile")
        .map(s => {
          const vName = (s.name ?? "").replace(/\s+\d{4}-\d{2}-\d{2}$/, "").trim();
          return [
            `${vName} Crossing`, vName, facility?.name || "—", "Informal Crossing", "150-250 people/day", "Mobile Transit Point Team"
          ];
        });
      const wsCrossing = XLSX.utils.aoa_to_sheet([crossingHeaders, ...crossingRows.length ? crossingRows : [["—", "—", "—", "—", "—", "—"]]]);
      XLSX.utils.book_append_sheet(wb, wsCrossing, "1.2 Cross-border Points");

      // Sheet 2: Health Facility Mapping
      const mapHeaders = [
        "Facility Name", "HMIS Code", "Facility Type", "Latitude", "Longitude", "Catchment Radius (km)", "Refrigerator", "Power Status", "Staff Count"
      ];
      const mapRows = [[
        facility?.name || "—", facility?.hmisCode || "—", facility?.facilityType || "—",
        facility?.latitude || "—", facility?.longitude || "—", facility?.catchmentRadius || "—",
        facility?.hasRefrigerator ? "Yes" : "No", facility?.hasPower ? "Yes" : "No", facility?.staffCount || 0
      ]];
      const wsMap = XLSX.utils.aoa_to_sheet([mapHeaders, ...mapRows]);
      XLSX.utils.book_append_sheet(wb, wsMap, "2.0 HF Mapping");

      // Sheet 3: Individual Team Microplan / Movement Plan
      const teamHeaders = [
        "Day", "Session Label / Site", "Destinations / Villages", "Estimated Target Population", "Doses Forecast", "Markers Req.", "Vaccine Carriers", "Vitamin A", "Scissors / Safety Boxes"
      ];
      const teamRows = (hydration?.sessions || [])
        .slice()
        .sort((a, b) => {
          const ad = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
          const bd = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
          return ad - bd;
        })
        .map((s, idx) => {
          const vName = (s.name ?? "").replace(/\s+\d{4}-\d{2}-\d{2}$/, "").trim();
          const pop = mappedCommunities.find(c => c.name.toLowerCase() === vName.toLowerCase())?.targetPopulation ?? 0;
          const doses = pop * 1;
          return [
            `Day ${idx + 1}`, s.name || "—", vName, pop, doses, Math.ceil(doses / 10), 2, Math.ceil(pop * 0.9), 1
          ];
        });
      const wsTeam = XLSX.utils.aoa_to_sheet([teamHeaders, ...teamRows.length ? teamRows : [["—", "—", "—", "—", "—", "—", "—", "—", "—"]]]);
      XLSX.utils.book_append_sheet(wb, wsTeam, "3.0 Movement Plan");

      // Sheet 3.1: Team Plan for Cross-border Points
      const cbTeamRows = (hydration?.sessions || [])
        .filter(s => s.sessionType === "mobile")
        .map((s, idx) => {
          const vName = (s.name ?? "").replace(/\s+\d{4}-\d{2}-\d{2}$/, "").trim();
          return [
            `Day ${idx + 1}`, `${vName} Crossing`, 120, 150, 15, 100, 2, 1
          ];
        });
      const wsCbTeam = XLSX.utils.aoa_to_sheet([
        ["Day", "Crossing Point", "Target Population", "OPV Doses", "Markers", "Vitamin A", "Vaccine Carriers", "Scissors"],
        ...cbTeamRows.length ? cbTeamRows : [["—", "—", "—", "—", "—", "—", "—", "—"]]
      ]);
      XLSX.utils.book_append_sheet(wb, wsCbTeam, "3.1 Border Team Plan");

      // Sheet 3.2: Health Facility Static Team Plan
      const staticRows = (hydration?.sessions || [])
        .filter(s => s.sessionType === "static")
        .map((s, idx) => {
          const vName = (s.name ?? "").replace(/\s+\d{4}-\d{2}-\d{2}$/, "").trim();
          const pop = mappedCommunities.find(c => c.name.toLowerCase() === vName.toLowerCase())?.targetPopulation ?? 0;
          return [
            `Day ${idx + 1}`, s.name || "—", pop, pop * 1, Math.ceil(pop * 0.1), Math.ceil(pop * 0.9), 1
          ];
        });
      const wsStaticTeam = XLSX.utils.aoa_to_sheet([
        ["Day", "Static Post Name", "Target Population", "OPV Doses", "Markers", "Vitamin A", "Scissors"],
        ...staticRows.length ? staticRows : [["—", "—", "—", "—", "—", "—", "—"]]
      ]);
      XLSX.utils.book_append_sheet(wb, wsStaticTeam, "3.2 Static Team Plan");

      // Sheet 4: Summary Teams Plan
      const summaryHeaders = [
        "Indicator/Item", "Required Number", "Available Number", "Shortfall / Surplus"
      ];
      const summaryRows = [
        ["Vaccinators", hydration?.sessions?.length ? Math.ceil(hydration.sessions.length * 1.5) : 0, staffProfile?.length || facility?.staffCount || 0, Math.max(0, (hydration?.sessions?.length ? Math.ceil(hydration.sessions.length * 1.5) : 0) - (staffProfile?.length || facility?.staffCount || 0))],
        ["Supervisors", Math.ceil((hydration?.sessions?.length || 0) / 3), 2, Math.max(0, Math.ceil((hydration?.sessions?.length || 0) / 3) - 2)],
        ["Vaccine Carriers", reqCarriers, availableCarriers, Math.max(0, reqCarriers - availableCarriers)],
        ["Cold Boxes", reqColdBoxes, availableColdBoxes, Math.max(0, reqColdBoxes - availableColdBoxes)],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
      XLSX.utils.book_append_sheet(wb, wsSummary, "4.0 Summary Teams Plan");

      // Sheet 5: Cold Chain
      const ccHeaders = [
        "Facility / Hub",
        "RI Service Provided",
        "Is SIA Post",
        "Number of Teams",
        "OPV Doses Forecasted",
        "Vaccine Carriers Req",
        "Vaccine Carriers Avail",
        "Vaccine Carrier Shortage",
        "Cold Boxes Req",
        "Cold Boxes Avail",
        "Cold Box Shortage"
      ];

      const carrierShortage = Math.max(0, reqCarriers - availableCarriers);
      const coldBoxShortage = Math.max(0, reqColdBoxes - availableColdBoxes);

      const ccSummaryRow = [
        facility?.name || "—",
        "Yes",
        isCampaign ? "Yes" : "No",
        hydration?.sessions?.length || 0,
        targetPopulationTotal * 2,
        reqCarriers,
        availableCarriers,
        carrierShortage,
        reqColdBoxes,
        availableColdBoxes,
        coldBoxShortage
      ];

      const ccInventoryHeaders = [
        "", // blank column spacer
        "Equipment Type", "Brand", "Model", "Serial Number", "Catalog Number", "Capacity (L)", "Power Source", "Condition", "Status"
      ];

      const ccInventoryRows = (dbColdChain || []).map((e: any) => [
        "", // spacer
        e.equipmentType || "—",
        e.brand || "—",
        e.model || "—",
        e.serialNumber || "—",
        e.catalogNumber || "—",
        e.capacityLiters || "—",
        e.powerSource || "—",
        e.condition || "—",
        e.isActive ? "Active" : "Inactive"
      ]);

      const ccData = [
        ccHeaders,
        ccSummaryRow,
        [],
        ["FACILITY COLD CHAIN EQUIPMENT ROSTER"],
        ccInventoryHeaders,
        ...ccInventoryRows.length ? ccInventoryRows : [["", "No cold chain equipment registered in database.", "", "", "", "", "", "", "", ""]]
      ];
      const wsColdChain = XLSX.utils.aoa_to_sheet(ccData);
      XLSX.utils.book_append_sheet(wb, wsColdChain, "5.0 Cold Chain");

      // Sheet 6: ACSM Mapping
      const acsmMapHeaders = [
        "Village Head / Opinion Leader", "Stakeholder Category", "Community Area", "Contact Phone", "Resources Requested", "Mobilization Action Needed"
      ];
      const acsmMapRows = mappedCommunities.map(c => [
        c.focalPersonName || "—", "Village Head", c.name, c.focalPersonPhone || "—", "Chalk, Megaphone", `Coordinate date on ${c.name}`
      ]);
      const wsAcsmMap = XLSX.utils.aoa_to_sheet([acsmMapHeaders, ...acsmMapRows.length ? acsmMapRows : [["—", "—", "—", "—", "—", "—"]]]);
      XLSX.utils.book_append_sheet(wb, wsAcsmMap, "6.0 ACSM Mapping");

      // Sheet 6.1: ACSM Plan
      const acsmPlanHeaders = [
        "ACSM Activity Description", "Target Audience", "Scheduled Date", "Responsible Person / Focal", "Beneficiaries Estimated", "Completion Status"
      ];
      const acsmPlanRows = (hydration?.mobilization || []).map(m => {
        const desc = m.description || "";
        const focalMatch = desc.match(/focal:\s*([^;]*?)\s*([\d+\-\s]*)?;/);
        let focalPoint = "—";
        if (focalMatch) {
          const inner = focalMatch[0].replace(/^focal:\s*/, "").replace(/;$/, "");
          const parts = inner.trim().split(/\s+/);
          const last = parts[parts.length - 1] ?? "";
          if (/^[\d+\-]+$/.test(last) && parts.length > 1) {
            focalPoint = parts.slice(0, -1).join(" ");
          } else {
            focalPoint = inner.trim();
          }
        }
        return [
          m.activityType || "—",
          m.targetAudience || "—",
          m.scheduledDate ? new Date(m.scheduledDate).toLocaleDateString() : "—",
          focalPoint,
          m.estimatedAttendance || 0,
          m.status || "Planned"
        ];
      });
      const wsAcsmPlan = XLSX.utils.aoa_to_sheet([acsmPlanHeaders, ...acsmPlanRows.length ? acsmPlanRows : [["—", "—", "—", "—", "—", "—"]]]);
      XLSX.utils.book_append_sheet(wb, wsAcsmPlan, "6.1 ACSM Plan");

      // Sheet 7: Contact Numbers and Supervisors List
      const contactHeaders = [
        "Designation", "Full Name", "Contact Phone Number", "Teams Supervised"
      ];
      const contactRows = staffingRoster.map((s: any) => [
        "Session Vaccinator / Supervisor Team", `${s.vaccinator} / ${s.supervisor}`, "—", s.sessionLabel
      ]);
      const wsContacts = XLSX.utils.aoa_to_sheet([contactHeaders, ...contactRows.length ? contactRows : [["—", "—", "—", "—"]]]);
      XLSX.utils.book_append_sheet(wb, wsContacts, "7.0 Contact Directory");

      // Sheet 8: Health Facility Staff Profile
      const staffHeaders = [
        "Staff Name", "Gender", "Position", "Years Experience", "Years at Facility", "Campaign / RI Role"
      ];
      const staffRows = (staffProfile || []).map((s: any) => [
        s.name, s.gender || "—", s.position || "—", s.yearsExperience || 0, s.yearsAtFacility || 0, s.campaignRole || "—"
      ]);
      const wsStaff = XLSX.utils.aoa_to_sheet([staffHeaders, ...staffRows.length ? staffRows : [["—", "—", "—", "—", "—", "—"]]]);
      XLSX.utils.book_append_sheet(wb, wsStaff, "8.0 HF Staff Profile");

      // Sheet 9: Health Facility Committee (HFC)
      const hfcHeaders = [
        "Committee Position", "Member Name", "Gender", "Phone Number", "Years of Service"
      ];
      const hfcRows = (hfcMembers || []).map((m: any) => [
        m.isChairperson ? `${m.position} (Chairperson)` : m.position,
        m.memberName,
        m.gender || "—",
        m.contactPhone || "—",
        m.yearsOfService != null ? `${m.yearsOfService} years` : "—"
      ]);
      const wsHfc = XLSX.utils.aoa_to_sheet([hfcHeaders, ...hfcRows.length ? hfcRows : [["—", "No HFC members registered in database.", "—", "—", "—"]]]);
      XLSX.utils.book_append_sheet(wb, wsHfc, "9.0 HFC Board");

      // Sheet 10: Community Health Volunteers (CHV) Profile
      const chvHeaders = [
        "CHV Name", "Gender", "Residence Village", "Education Level", "Training Status", "Assigned SIA Role"
      ];
      const chvRows = (chvProfiles || []).map((c: any) => {
        const vMatch = villages?.find((v) => v.id === c.villageId);
        return [
          c.name || "—",
          c.gender || "—",
          vMatch?.name || "Catchment",
          c.educationLevel || "—",
          c.trainingStatus || "—",
          c.campaignRole || "—"
        ];
      });
      const wsChv = XLSX.utils.aoa_to_sheet([chvHeaders, ...chvRows.length ? chvRows : [["—", "—", "—", "—", "—", "—"]]]);
      XLSX.utils.book_append_sheet(wb, wsChv, "10.0 CHV Profile");

      XLSX.writeFile(wb, `${microplan.name.replace(/\s+/g, "_")}_Operational_Microplan.xlsx`);
      toast({
        title: "Workbook Exported",
        description: "The complete operational microplan Excel workbook has been generated and downloaded successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Export Failed",
        description: err.message || "Failed to generate Excel workbook",
        variant: "destructive",
      });
    }
  };

  const MapComponent = () => {
    if (!leaflet || !facility) return null;
    const { MapContainer, TileLayer, Marker, Popup, Polygon: LPolygon, GeoJSON: LGeoJSON } = leaflet.rl;

    return (
      <div className={`${mapHeightClass} print-map-container w-full border rounded-lg overflow-hidden relative print:border-black`}>
        <MapContainer center={mapCenter} zoom={11} className="h-full w-full z-0" zoomControl={false}>
          {/* Commented out original static TileLayer and replaced with dynamic loading matching the user's preferred print/screen basemap */}
          {/*
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          */}
          {(() => {
            const config = BASEMAP_CONFIGS[basemap] || BASEMAP_CONFIGS.positron;
            return (
              <TileLayer
                key={basemap}
                url={config.url}
                attribution={config.attribution}
                maxNativeZoom={config.maxNativeZoom}
                maxZoom={config.maxZoom || 19}
              />
            );
          })()}
          {/* Facility pin */}
          <Marker position={mapCenter}>
            <Popup>
              <div className="text-xs">
                <strong>{facility.name}</strong>
                <p>Health Facility Center</p>
              </div>
            </Popup>
          </Marker>

          {/* Catchment boundary polygon */}
          {catchment && catchment.geojson && (
            <LGeoJSON
              data={catchment.geojson}
              style={{
                color: "#2563eb",
                weight: 2,
                fillColor: "#3b82f6",
                fillOpacity: 0.1,
              }}
            />
          )}

          {/* Community points */}
          {mappedCommunities.map((c) => {
            if (c.latitude == null || c.longitude == null) return null;
            const lat = parseFloat(String(c.latitude));
            const lng = parseFloat(String(c.longitude));
            if (isNaN(lat) || isNaN(lng)) return null;

            return (
              <Marker key={c.id} position={[lat, lng]}>
                <Popup>
                  <div className="text-xs">
                    <strong>{c.name}</strong>
                    <p>Strategy: {c.strategy}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        <div className="absolute bottom-2 right-2 bg-white/95 px-2 py-1.5 rounded-md text-[10px] font-medium border shadow-xs z-10 text-foreground flex flex-col gap-0.5 print:border-black">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full inline-block border border-blue-600" />
            <span>Facility Center</span>
          </div>
          {catchment && (
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-2 bg-blue-500/10 border border-blue-600 inline-block" />
              <span>Catchment Area</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block border border-emerald-600" />
            <span>Community Location</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-muted text-foreground p-4 md:p-8 flex flex-col gap-6 print:bg-white print:p-0 print:text-black">
      {/* Print Style Injector */}
      <style>{`
        @media print {
          @page {
            size: ${printSize.toLowerCase()} landscape;
            margin: 10mm;
          }
          body {
            background: #fff !important;
            color: #000 !important;
            font-size: 11px !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            border-radius: 0.5rem !important;
            background: #fff !important;
            page-break-inside: avoid;
          }
          .print-table th, .print-table td {
            border-color: #cbd5e1 !important;
            padding: 4px 6px !important;
          }
          .print-page-break {
            page-break-before: always;
          }
          .print-map-container {
            height: ${
              printSize === "A0" ? "1400px" :
              printSize === "A1" ? "1000px" :
              printSize === "A2" ? "720px" :
              printSize === "A3" ? "480px" :
              "320px"
            } !important;
          }
        }
      `}</style>

      {/* Top action header (no-print) */}
      <div className="no-print bg-background border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleBack} className="gap-1.5 font-sans">
            <ArrowLeft className="h-4 w-4" /> Back to Wizard
          </Button>
          <div>
            <h1 className="text-base font-bold font-sans">Print & Export Center</h1>
            <p className="text-xs text-muted-foreground font-sans">Configure print formats, download workbook, or print plan</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Print Size Selection */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground font-sans">Print Format:</label>
            <Select value={printSize} onValueChange={(v: any) => setPrintSize(v)}>
              <SelectTrigger className="w-[110px] h-8 text-xs font-sans">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4 (Landscape)</SelectItem>
                <SelectItem value="A3">A3 (Landscape)</SelectItem>
                <SelectItem value="A2">A2 (Landscape)</SelectItem>
                <SelectItem value="A1">A1 (Landscape)</SelectItem>
                <SelectItem value="A0">A0 (Landscape)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5 border-emerald-600 text-emerald-600 hover:bg-emerald-50 h-8 text-xs font-sans font-semibold">
            <Download className="h-3.5 w-3.5" /> Export Workbook (.xlsx)
          </Button>

          <Button size="sm" onClick={handlePrint} className="gap-1.5 shadow-xs h-8 text-xs font-sans font-semibold">
            <Printer className="h-3.5 w-3.5" /> Print Microplan
          </Button>
        </div>
      </div>

      {/* Printable Area */}
      <div className="flex flex-col gap-8 w-full max-w-[1200px] mx-auto bg-white p-6 md:p-10 border rounded-2xl shadow-sm print:shadow-none print:border-0 print:p-0 print:max-w-none">

        {/* Document Header */}
        <div className="flex items-start justify-between border-b pb-4 border-border">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground print:text-foreground">National Immunization Program</p>
            <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              {microplan.name}
            </h2>
            <p className="text-sm text-muted-foreground print:text-foreground">
              Facility: <strong>{facility.name}</strong> &middot; District: <strong>{district?.name || "—"}</strong> &middot; Province: <strong>{province?.name || "—"}</strong>
            </p>
          </div>
          <div className="text-right space-y-1">
            <Badge variant="outline" className="capitalize text-xs font-semibold px-2.5 py-1 print:border-black">
              Status: {microplan.status}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              Quarter {microplan.quarter}, {microplan.year}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">
              Generated {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Section 1: Executive Summary & Map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
          {/* Summary Box */}
          <Card className="print-card border shadow-xs bg-muted/50">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-bold border-b pb-1.5 text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" /> Executive Plan Summary
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground font-medium">Plan Type:</span>
                  <p className="font-semibold capitalize">{isCampaign ? "SIA Campaign" : "Routine Services"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Target Population:</span>
                  <p className="font-bold text-primary">{targetPopulationTotal.toLocaleString()} Infants</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Catchment Communities:</span>
                  <p className="font-semibold">{mappedCommunities.length} registered villages</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Planned Sessions:</span>
                  <p className="font-semibold">{hydration?.sessions?.length ?? 0} sessions</p>
                </div>
                {isCampaign && (
                  <>
                    <div>
                      <span className="text-muted-foreground font-medium">Campaign Antigen:</span>
                      <p className="font-semibold">{(microplan as any).campaignAntigen || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium">Target Age Group:</span>
                      <p className="font-semibold">{(microplan as any).campaignTargetAge || "—"}</p>
                    </div>
                  </>
                )}
                <div className="col-span-2 pt-2 border-t mt-2">
                  <span className="text-muted-foreground font-medium">Total Planned Budget:</span>
                  <p className="text-base font-extrabold text-foreground">$ {budgetTotal.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Catchment Map */}
          <Card className="print-card border shadow-xs">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold border-b pb-1.5 mb-3 text-foreground flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" /> Catchment GIS Map
              </h3>
              <MapComponent />
            </CardContent>
          </Card>
        </div>

        {/* Section 2: Catchment Communities Table */}
        <div className="print-page-break space-y-3">
          <h3 className="text-base font-bold border-b pb-1 text-foreground flex items-center gap-1.5">
            <UsersIcon className="h-5 w-5 text-primary" /> 1. Communities served & Target Populations
          </h3>
          <table className="w-full text-left text-xs border print-table border-collapse">
            <thead>
              <tr className="bg-muted border-b print:bg-slate-200">
                <th className="p-2 font-bold border">Community Name</th>
                <th className="p-2 font-bold border">Type</th>
                <th className="p-2 font-bold border">Target Population</th>
                <th className="p-2 font-bold border">Delivery Strategy</th>
                <th className="p-2 font-bold border">Focal Person</th>
                <th className="p-2 font-bold border">Focal Phone</th>
                <th className="p-2 font-bold border">Source</th>
                <th className="p-2 font-bold border text-center">Contact Made</th>
                <th className="p-2 font-bold border text-center">Follow-up confirmed</th>
              </tr>
            </thead>
            <tbody>
              {mappedCommunities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-muted-foreground">No communities registered.</td>
                </tr>
              ) : (
                mappedCommunities.map((c) => {
                  return (
                    <tr key={c.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 border font-medium">{c.name}</td>
                      <td className="p-2 border capitalize">{c.type}</td>
                      <td className="p-2 border font-bold text-foreground">
                        {c.targetPopulation.toLocaleString()}
                      </td>
                      <td className="p-2 border capitalize">{c.strategy}</td>
                      <td className="p-2 border">{c.focalPersonName || "—"}</td>
                      <td className="p-2 border">{c.focalPersonPhone || "—"}</td>
                      <td className="p-2 border">{c.focalPersonSource || "—"}</td>
                      <td className="p-2 border text-center">
                        {c.communicationContactMade ? (
                          <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <Square className="h-4 w-4 text-foreground mx-auto" />
                        )}
                      </td>
                      <td className="p-2 border text-center">
                        {c.outsideFollowUpCheck ? (
                          <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <Square className="h-4 w-4 text-foreground mx-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Section 3: Session Calendar */}
        <div className="print-page-break space-y-3">
          <h3 className="text-base font-bold border-b pb-1 text-foreground flex items-center gap-1.5">
            <Calendar className="h-5 w-5 text-primary" /> 2. Session Calendar (12-Month Schedule)
          </h3>
          <table className="w-full text-left text-xs border print-table border-collapse">
            <thead>
              <tr className="bg-muted border-b print:bg-slate-200">
                <th className="p-2 font-bold border">Target Community</th>
                <th className="p-2 font-bold border">Scheduled Date</th>
                <th className="p-2 font-bold border">Strategy</th>
                <th className="p-2 font-bold border">Target Population</th>
                <th className="p-2 font-bold border">Distance from HF</th>
              </tr>
            </thead>
            <tbody>
              {(!hydration?.sessions || hydration.sessions.length === 0) ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">No sessions scheduled.</td>
                </tr>
              ) : (
                hydration.sessions
                  .slice()
                  .sort((a, b) => {
                    const ad = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
                    const bd = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
                    return ad - bd;
                  })
                  .map((s) => {
                    const vName = (s.name ?? "").replace(/\s+\d{4}-\d{2}-\d{2}$/, "").trim();
                    const vMatch = mappedCommunities.find((c) => c.name.toLowerCase() === vName.toLowerCase());
                    const dist = vMatch?.distanceToFacility != null ? `${vMatch.distanceToFacility} km` : "—";
                    const pop = vMatch?.targetPopulation ?? 0;

                    return (
                      <tr key={s.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 border font-medium">{vName}</td>
                        <td className="p-2 border font-mono">
                          {s.scheduledDate ? new Date(s.scheduledDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                        </td>
                        <td className="p-2 border capitalize">{s.sessionType}</td>
                        <td className="p-2 border font-bold">
                          {pop.toLocaleString()}
                        </td>
                        <td className="p-2 border">{dist}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Section 4: Staffing Roster */}
        <div className="print-page-break space-y-3">
          <h3 className="text-base font-bold border-b pb-1 text-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-5 w-5 text-primary" /> 3. Staffing & Session Day Roster
          </h3>
          <table className="w-full text-left text-xs border print-table border-collapse">
            <thead>
              <tr className="bg-muted border-b print:bg-slate-200">
                <th className="p-2 font-bold border">Session Name / Label</th>
                <th className="p-2 font-bold border">Vaccinator Name</th>
                <th className="p-2 font-bold border">Recorder Name</th>
                <th className="p-2 font-bold border">Supervisor Name</th>
                <th className="p-2 font-bold border">Team Type</th>
                <th className="p-2 font-bold border text-right">Daily Target</th>
                <th className="p-2 font-bold border text-right">Daily Per Diem</th>
              </tr>
            </thead>
            <tbody>
              {staffingRoster.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">No roster details configured.</td>
                </tr>
              ) : (
                staffingRoster.map((s: any) => (
                  <tr key={s.rowId} className="border-b hover:bg-muted/50">
                    <td className="p-2 border font-medium">{s.sessionLabel}</td>
                    <td className="p-2 border">{s.vaccinator || "—"}</td>
                    <td className="p-2 border">{s.recorder || "—"}</td>
                    <td className="p-2 border">{s.supervisor || "—"}</td>
                    <td className="p-2 border capitalize">{s.teamType}</td>
                    <td className="p-2 border text-right font-mono">{s.target}</td>
                    <td className="p-2 border text-right font-mono">$ {Number(s.perDiem || 0).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Section 5: Vaccine Requirements & Requisition Slip */}
        <div className="print-page-break grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
          {/* Forecasting */}
          <div className="space-y-3">
            <h3 className="text-base font-bold border-b pb-1 text-foreground flex items-center gap-1.5">
              <Syringe className="h-5 w-5 text-primary" /> 4a. Vaccine Doses Forecast
            </h3>
            <table className="w-full text-left text-xs border print-table border-collapse">
              <thead>
                <tr className="bg-muted border-b print:bg-slate-200">
                  <th className="p-2 font-bold border">Antigen</th>
                  <th className="p-2 font-bold border text-right">Target Pop</th>
                  <th className="p-2 font-bold border text-right">Wastage %</th>
                  <th className="p-2 font-bold border text-right">Total Doses</th>
                  <th className="p-2 font-bold border text-right">Suggested Vials</th>
                </tr>
              </thead>
              <tbody>
                {(!hydration?.vaccineRequirements || hydration.vaccineRequirements.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">No vaccine forecasting configured.</td>
                  </tr>
                ) : (
                  hydration.vaccineRequirements.map((v) => {
                    return (
                      <tr key={v.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 border font-medium">{v.vaccineName}</td>
                        <td className="p-2 border text-right font-mono">{v.targetPopulation.toLocaleString()}</td>
                        <td className="p-2 border text-right font-mono">{v.wastageRate}%</td>
                        <td className="p-2 border text-right font-bold font-mono">{v.dosesWithWastage.toLocaleString()}</td>
                        <td className="p-2 border text-right font-bold font-mono">{v.vialsRequired.toLocaleString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Requisition Slip */}
          <div className="space-y-3">
            <h3 className="text-base font-bold border-b pb-1 text-foreground flex items-center gap-1.5">
              <FileText className="h-5 w-5 text-primary" /> 4b. Stock Requisition Slip
            </h3>
            <div className="border border-border rounded-lg p-4 bg-muted space-y-4 text-xs print:bg-white print:border-black print:text-black">
              <div className="flex justify-between items-start border-b pb-2 border-border print:border-black">
                <div>
                  <p className="font-bold uppercase tracking-wider text-foreground">Official Stock Requisition</p>
                  <p className="text-[10px] text-muted-foreground">ID: REQ-MP-{microplan.id}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{facility.name}</p>
                  <p className="text-[10px] text-muted-foreground">Date: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b font-semibold text-foreground print:text-black print:border-black">
                    <th className="py-1">Antigen Name</th>
                    <th className="py-1 text-right">Doses Requested</th>
                    <th className="py-1 text-right">Recommended Vials</th>
                  </tr>
                </thead>
                <tbody>
                  {(hydration?.vaccineRequirements || []).map((v) => {
                    return (
                      <tr key={v.id} className="border-b border-slate-100 print:border-border">
                        <td className="py-1.5 font-medium">{v.vaccineName}</td>
                        <td className="py-1.5 text-right font-mono">{v.dosesWithWastage.toLocaleString()}</td>
                        <td className="py-1.5 text-right font-bold font-mono">{v.vialsRequired.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border print:border-black text-[10px]">
                <div className="space-y-4">
                  <p>Requisitioned By:</p>
                  <div className="border-b border-slate-400 w-32 h-4" />
                  <p className="text-[9px] text-muted-foreground">Facility In-Charge Signature</p>
                </div>
                <div className="space-y-4 text-right flex flex-col items-end">
                  <p>Authorized By:</p>
                  <div className="border-b border-slate-400 w-32 h-4" />
                  <p className="text-[9px] text-muted-foreground">District Vaccine Officer Signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5b: Cold Chain Sizing & Inventory */}
        <div className="print-page-break space-y-3">
          <h3 className="text-base font-bold border-b pb-1 text-foreground flex items-center gap-1.5">
            <Layers className="h-5 w-5 text-primary" /> 4c. Cold Chain Capacity & Equipment Inventory
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
            <div className="border rounded-xl p-4 bg-muted/50 print:bg-white print:border-black space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase mb-2 print:text-black">Required vs Available Sizing</h4>
              <table className="w-full text-xs border border-collapse print-table">
                <thead>
                  <tr className="bg-muted print:bg-slate-200">
                    <th className="p-1.5 border font-semibold">Equipment Type</th>
                    <th className="p-1.5 border font-semibold text-center">Required (wizard)</th>
                    <th className="p-1.5 border font-semibold text-center">Available (inventory)</th>
                    <th className="p-1.5 border font-semibold text-center">Shortage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-1.5 border font-medium">Cold Boxes</td>
                    <td className="p-1.5 border text-center font-mono">{reqColdBoxes}</td>
                    <td className="p-1.5 border text-center font-mono">{availableColdBoxes}</td>
                    <td className="p-1.5 border text-center font-mono font-bold text-red-600">
                      {Math.max(0, reqColdBoxes - availableColdBoxes)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-1.5 border font-medium">Vaccine Carriers</td>
                    <td className="p-1.5 border text-center font-mono">{reqCarriers}</td>
                    <td className="p-1.5 border text-center font-mono">{availableCarriers}</td>
                    <td className="p-1.5 border text-center font-mono font-bold text-red-600">
                      {Math.max(0, reqCarriers - availableCarriers)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="border rounded-xl p-4 bg-muted/50 print:bg-white print:border-black space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase mb-2 print:text-black">Active Facility Cold Chain Roster</h4>
              <table className="w-full text-[10px] border border-collapse print-table">
                <thead>
                  <tr className="bg-muted print:bg-slate-200">
                    <th className="p-1.5 border font-semibold">Classification</th>
                    <th className="p-1.5 border font-semibold">Brand / Model</th>
                    <th className="p-1.5 border font-semibold">Condition</th>
                    <th className="p-1.5 border font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dbColdChain.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-muted-foreground">No cold chain equipment registered in database.</td>
                    </tr>
                  ) : (
                    dbColdChain.map((e: any) => (
                      <tr key={e.id} className="border-b hover:bg-muted/50">
                        <td className="p-1.5 border capitalize">{e.equipmentType?.replace("_", " ") || "—"}</td>
                        <td className="p-1.5 border">{e.brand || "—"} &middot; {e.model || "—"}</td>
                        <td className="p-1.5 border capitalize">{e.condition || "—"}</td>
                        <td className="p-1.5 border text-center">
                          <Badge variant="outline" className={`text-[9px] px-1 py-0.2 ${e.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-muted text-muted-foreground"}`}>
                            {e.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section 6: Budget Allocation */}
        <div className="print-page-break space-y-3">
          <h3 className="text-base font-bold border-b pb-1 text-foreground flex items-center gap-1.5">
            <Wallet className="h-5 w-5 text-primary" /> 5. Microplan Budget Allocation
          </h3>
          <table className="w-full text-left text-xs border print-table border-collapse">
            <thead>
              <tr className="bg-muted border-b print:bg-slate-200">
                <th className="p-2 font-bold border">Category</th>
                <th className="p-2 font-bold border">Cost Item Description</th>
                <th className="p-2 font-bold border text-right">Quantity</th>
                <th className="p-2 font-bold border text-right">Unit Cost ($)</th>
                <th className="p-2 font-bold border text-right">Total Cost ($)</th>
                <th className="p-2 font-bold border">Funding Source</th>
              </tr>
            </thead>
            <tbody>
              {(!hydration?.budgetItems || hydration.budgetItems.length === 0) ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">No budget items added.</td>
                </tr>
              ) : (
                hydration.budgetItems.map((b) => {
                  const qty = Number(b.quantity || 0);
                  const uc = Number(b.unitCost || 0);
                  const total = qty * uc;
                  return (
                    <tr key={b.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 border font-medium capitalize">{b.category}</td>
                      <td className="p-2 border">{b.description}</td>
                      <td className="p-2 border text-right font-mono">{qty.toLocaleString()}</td>
                      <td className="p-2 border text-right font-mono">$ {uc.toLocaleString()}</td>
                      <td className="p-2 border text-right font-bold font-mono">$ {total.toLocaleString()}</td>
                      <td className="p-2 border capitalize">{b.fundingSource}</td>
                    </tr>
                  );
                })
              )}
              <tr className="bg-muted font-bold print:bg-muted">
                <td colSpan={4} className="p-2 border text-right">Grand Total Cost:</td>
                <td className="p-2 border text-right font-bold text-primary font-mono">$ {budgetTotal.toLocaleString()}</td>
                <td className="p-2 border" />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 6b: Transport & Logistics Plan */}
        <div className="print-page-break space-y-3">
          <h3 className="text-base font-bold border-b pb-1 text-foreground flex items-center gap-1.5">
            <Truck className="h-5 w-5 text-primary" /> 5b. Transport & Logistics Plan
          </h3>
          <table className="w-full text-left text-xs border print-table border-collapse">
            <thead>
              <tr className="bg-muted border-b print:bg-slate-200">
                <th className="p-2 font-bold border">Session site / Destination</th>
                <th className="p-2 font-bold border">Transport Mode</th>
                <th className="p-2 font-bold border">Vehicle details</th>
                <th className="p-2 font-bold border text-right">Distance (km)</th>
                <th className="p-2 font-bold border text-right">Estimated Fuel (L)</th>
                <th className="p-2 font-bold border text-center">Security Cleared</th>
              </tr>
            </thead>
            <tbody>
              {(!hydration?.sessions || hydration.sessions.length === 0) ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">No transport details available.</td>
                </tr>
              ) : (
                hydration.sessions.map((s) => {
                  const dp = hydration.sessionDayPlans?.find((p) => p.sessionPlanId === s.id);
                  const mode = dp?.transportType || "road";
                  const distance = dp?.distanceKm != null ? `${dp.distanceKm} km` : "—";
                  const fuel = dp?.fuelLiters != null ? `${dp.fuelLiters} L` : "—";
                  const notes = dp?.executionNotes || "";
                  const vehicleMatch = notes.match(/vehicle:([^;]+)/);
                  const vehicle = vehicleMatch ? vehicleMatch[1].trim() : "—";
                  const isCleared = /security_cleared/.test(notes);

                  return (
                    <tr key={s.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 border font-medium">{s.name}</td>
                      <td className="p-2 border capitalize">{mode}</td>
                      <td className="p-2 border">{vehicle}</td>
                      <td className="p-2 border text-right font-mono">{distance}</td>
                      <td className="p-2 border text-right font-mono">{fuel}</td>
                      <td className="p-2 border text-center">
                        {isCleared ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">Cleared</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Section 6c: Social Mobilization Plan */}
        <div className="print-page-break space-y-3">
          <h3 className="text-base font-bold border-b pb-1 text-foreground flex items-center gap-1.5">
            <MessageSquare className="h-5 w-5 text-primary" /> 5c. Social Mobilization & Community Engagement
          </h3>
          <table className="w-full text-left text-xs border print-table border-collapse">
            <thead>
              <tr className="bg-muted border-b print:bg-slate-200">
                <th className="p-2 font-bold border">ACSM Activity Type</th>
                <th className="p-2 font-bold border">Session / Location Details</th>
                <th className="p-2 font-bold border">Focal Person</th>
                <th className="p-2 font-bold border">Focal Phone</th>
                <th className="p-2 font-bold border">IEC Materials Checklist</th>
                <th className="p-2 font-bold border text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {(!hydration?.mobilization || hydration.mobilization.length === 0) ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">No community mobilization activities planned.</td>
                </tr>
              ) : (
                hydration.mobilization.map((m) => {
                  const desc = m.description || "";
                  const focalMatch = desc.match(/focal:\s*([^;]*?)\s*([\d+\-\s]*)?;/);
                  const iecMatch = desc.match(/IEC:\s*(.*)$/);
                  let focalPoint = "—";
                  let focalPhone = "—";
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
                  const iec = iecMatch ? iecMatch[1].trim() : "—";
                  const trimmedDesc = desc.replace(/^.*?—\s*/, "");

                  return (
                    <tr key={m.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 border font-medium capitalize">{m.activityType?.replace("_", " ")}</td>
                      <td className="p-2 border">{trimmedDesc || desc}</td>
                      <td className="p-2 border">{focalPoint}</td>
                      <td className="p-2 border font-mono">{focalPhone}</td>
                      <td className="p-2 border">{iec}</td>
                      <td className="p-2 border text-center capitalize">
                        <Badge variant="outline" className={`text-[10px] ${m.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-foreground"}`}>
                          {m.status || "Planned"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Section 7: Supervision Plan */}
        <div className="print-page-break space-y-3">
          <h3 className="text-base font-bold border-b pb-1 text-foreground flex items-center gap-1.5">
            <ClipboardList className="h-5 w-5 text-primary" /> 6. Supportive Supervision & Checklists
          </h3>
          <table className="w-full text-left text-xs border print-table border-collapse">
            <thead>
              <tr className="bg-muted border-b print:bg-slate-200">
                <th className="p-2 font-bold border">Quarter</th>
                <th className="p-2 font-bold border">Scheduled Date</th>
                <th className="p-2 font-bold border">Supervisor Name</th>
                <th className="p-2 font-bold border">Checklist Template</th>
                <th className="p-2 font-bold border">Expected Follow-up Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappedSupervision.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">No supervision visits scheduled.</td>
                </tr>
              ) : (
                mappedSupervision.map((v) => (
                  <tr key={v.id} className="border-b hover:bg-muted/50 align-top">
                    <td className="p-2 border font-medium">Quarter {v.quarter}</td>
                    <td className="p-2 border font-mono">
                      {v.scheduledDate ? new Date(v.scheduledDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                    </td>
                    <td className="p-2 border">{v.supervisorName}</td>
                    <td className="p-2 border">{v.checklist}</td>
                    <td className="p-2 border">{v.followUp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Section 7b: Health Facility Committee (HFC) Governance Board */}
        <div className="print-page-break space-y-3">
          <h3 className="text-base font-bold border-b pb-1 text-foreground flex items-center gap-1.5">
            <UsersIcon className="h-5 w-5 text-primary" /> 6b. Health Facility Governance Board (HFC Committee)
          </h3>
          <table className="w-full text-left text-xs border print-table border-collapse">
            <thead>
              <tr className="bg-muted border-b print:bg-slate-200">
                <th className="p-2 font-bold border">Committee Position</th>
                <th className="p-2 font-bold border">Member Name</th>
                <th className="p-2 font-bold border">Gender</th>
                <th className="p-2 font-bold border">Contact Phone Number</th>
                <th className="p-2 font-bold border text-right">Years of Service</th>
                <th className="p-2 font-bold border text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {hfcMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">No HFC governance board members registered in database.</td>
                </tr>
              ) : (
                hfcMembers.map((m: any) => (
                  <tr key={m.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 border font-medium capitalize">{m.isChairperson ? `${m.position} (Chairperson)` : m.position}</td>
                    <td className="p-2 border">{m.memberName}</td>
                    <td className="p-2 border capitalize">{m.gender || "—"}</td>
                    <td className="p-2 border font-mono">{m.contactPhone || "—"}</td>
                    <td className="p-2 border text-right font-mono">{m.yearsOfService != null ? `${m.yearsOfService} yrs` : "—"}</td>
                    <td className="p-2 border text-center">
                      <Badge variant="outline" className={`text-[10px] ${m.isActive === false ? "bg-muted text-muted-foreground" : "bg-emerald-50 text-emerald-700"}`}>
                        {m.isActive === false ? "Inactive" : "Active"}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Section 7c: Community Health Volunteers (CHV) Profiles */}
        <div className="print-page-break space-y-3">
          <h3 className="text-base font-bold border-b pb-1 text-foreground flex items-center gap-1.5">
            <UsersIcon className="h-5 w-5 text-primary" /> 6c. Community Health Volunteers (CHV) Roster
          </h3>
          <table className="w-full text-left text-xs border print-table border-collapse">
            <thead>
              <tr className="bg-muted border-b print:bg-slate-200">
                <th className="p-2 font-bold border">CHV Name</th>
                <th className="p-2 font-bold border">Gender</th>
                <th className="p-2 font-bold border">Residence Village</th>
                <th className="p-2 font-bold border">Education Level</th>
                <th className="p-2 font-bold border">Assigned Campaign/RI Role</th>
                <th className="p-2 font-bold border">Training Status</th>
                <th className="p-2 font-bold border text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {chvProfiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">No community health volunteers registered in database.</td>
                </tr>
              ) : (
                chvProfiles.map((c: any) => {
                  const vMatch = villages?.find((v) => v.id === c.villageId);
                  return (
                    <tr key={c.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 border font-medium">{c.name}</td>
                      <td className="p-2 border capitalize">{c.gender || "—"}</td>
                      <td className="p-2 border">{vMatch?.name || "Catchment"}</td>
                      <td className="p-2 border capitalize">{c.educationLevel || "—"}</td>
                      <td className="p-2 border capitalize">{c.campaignRole || "—"}</td>
                      <td className="p-2 border capitalize">{c.trainingStatus || "—"}</td>
                      <td className="p-2 border text-center">
                        <Badge variant="outline" className={`text-[10px] ${c.active === false ? "bg-muted text-muted-foreground" : "bg-emerald-50 text-emerald-700"}`}>
                          {c.active === false ? "Inactive" : "Active"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Section 8: Signature Approval Sign-Off Block */}
        <div className="print-page-break pt-8 border-t border-border print:border-black mt-8 space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground print:text-black">Microplan Authorization & Approval Sign-Off</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3 text-xs">
            {/* Signature 1 */}
            <div className="border border-border p-4 rounded-xl space-y-4 print:border-black print:rounded-none">
              <p className="font-semibold text-foreground print:text-black">1. Prepared By (Facility In-Charge):</p>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">___________________________</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Signature:</span>
                  <span className="font-medium">___________________________</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">______ / ______ / 20___</span>
                </div>
              </div>
            </div>

            {/* Signature 2 */}
            <div className="border border-border p-4 rounded-xl space-y-4 print:border-black print:rounded-none">
              <p className="font-semibold text-foreground print:text-black">2. Reviewed By (District Medical Officer):</p>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">___________________________</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Signature:</span>
                  <span className="font-medium">___________________________</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">______ / ______ / 20___</span>
                </div>
              </div>
            </div>

            {/* Signature 3 */}
            <div className="border border-border p-4 rounded-xl space-y-4 print:border-black print:rounded-none">
              <p className="font-semibold text-foreground print:text-black">3. Approved By (Provincial Coordinator):</p>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">___________________________</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Signature:</span>
                  <span className="font-medium">___________________________</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">______ / ______ / 20___</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Simple fallback replacement of missing Users icon
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
