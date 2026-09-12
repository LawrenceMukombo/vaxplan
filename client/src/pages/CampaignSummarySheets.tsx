import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { GeoCascadeFilter } from "@/components/GeoCascadeFilter";
import { FacilityCascadePicker } from "@/components/FacilityCascadePicker";
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Building2,
  Users,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  FileCheck,
  Activity,
  Layers,
  Sparkles,
  Info,
  Pencil,
  Lock,
  BarChart3,
  PieChart,
  SlidersHorizontal,
} from "lucide-react";
import type { Facility } from "@shared/schema";

// ─── Default Configurable Campaigns ─────────────────────────────────────────
export type CampaignType =
  | "follow_up_sia"
  | "preventive_sia"
  | "outbreak_response"
  | "targeted_catchup"
  | "ichd_multi_antigen";

export interface MultiAntigenDoseItem {
  antigen: string;
  dosesAdministered: number;
  vialsOpened: number;
  vialsWasted: number;
}

export interface SiaCampaignConfig {
  id: string;
  name: string;
  campaignType: CampaignType;
  antigen: string;
  antigens?: string[];
  isMultiAntigen?: boolean;
  targetAges: string;
  startDate: string;
  totalDays: number;
  totalTargetPop: number;
  status: "active" | "planning" | "completed";
}

export const ACTIVE_SIA_CAMPAIGNS: SiaCampaignConfig[] = [
  {
    id: "campaign-mr-2026",
    name: "National Measles-Rubella Follow-Up Campaign 2026",
    campaignType: "follow_up_sia",
    antigen: "Measles-Rubella (MR)",
    antigens: ["Measles-Rubella (MR)"],
    isMultiAntigen: false,
    targetAges: "9 to 59 months",
    startDate: "2026-09-08",
    totalDays: 7,
    totalTargetPop: 1850000,
    status: "active",
  },
  {
    id: "campaign-ichd-2026",
    name: "Integrated Child Health Days (ICHD) Multi-Antigen Round 2",
    campaignType: "ichd_multi_antigen",
    antigen: "Multi-Antigen Package (MR + bOPV + Vit A + Albendazole)",
    antigens: ["Measles-Rubella (MR)", "bOPV (Oral Polio)", "Vitamin A (100k/200k IU)", "Deworming (Albendazole)"],
    isMultiAntigen: true,
    targetAges: "0 to 59 months",
    startDate: "2026-10-01",
    totalDays: 5,
    totalTargetPop: 2150000,
    status: "active",
  },
  {
    id: "campaign-nopv2-2026",
    name: "Polio nOPV2 Outbreak Response Round 2",
    campaignType: "outbreak_response",
    antigen: "nOPV2 (Oral Polio)",
    antigens: ["nOPV2 (Oral Polio)"],
    isMultiAntigen: false,
    targetAges: "0 to 59 months",
    startDate: "2026-10-15",
    totalDays: 5,
    totalTargetPop: 2400000,
    status: "planning",
  },
  {
    id: "campaign-hpv-2026",
    name: "Sub-National HPV Catch-Up Vaccination Campaign",
    campaignType: "targeted_catchup",
    antigen: "HPV (Quadrivalent)",
    antigens: ["HPV (Quadrivalent)"],
    isMultiAntigen: false,
    targetAges: "9 to 14 years (Girls)",
    startDate: "2026-08-12",
    totalDays: 7,
    totalTargetPop: 420000,
    status: "completed",
  },
];

// ─── HF Daily Summary Sheet Record ──────────────────────────────────────────
export interface HfDailySummarySheet {
  id: string;
  campaignId: string;
  facilityId: number;
  facilityName: string;
  districtId: number;
  districtName: string;
  provinceId: number;
  provinceName: string;
  dayNumber: number;
  reportingDate: string;
  // Team tally counts
  fixedTeams: number;
  outreachTeams: number;
  mobileTeams: number;
  // Vaccinated disaggregation
  infants0to11m: number;
  underFives12to59m: number;
  children5to14y: number;
  totalVaccinated: number;
  zeroDoseIdentified: number;
  missedChildren: number;
  // Vaccine logistics
  vialsReceived: number;
  vialsOpened: number;
  dosesAdministered: number;
  vialsWasted: number;
  vialsRemaining: number;
  wastageRatePercent: number;
  // AEFI
  aefiMinor: number;
  aefiSevere: number;
  // Quality & Verification
  status: "draft" | "submitted" | "verified";
  supervisorName: string;
  remarks?: string;
  updatedAt: string;
  multiAntigenDoses?: MultiAntigenDoseItem[];
}

const STORAGE_KEY = "vaxplan_sia_summary_sheets_v1";

// Initial seed records so the page loads with realistic field operations data
function getInitialSummarySheets(): HfDailySummarySheet[] {
  return [
    {
      id: "ss-001",
      campaignId: "campaign-mr-2026",
      facilityId: 1,
      facilityName: "Addo Clinic",
      districtId: 1,
      districtName: "Cacadu Health District",
      provinceId: 1,
      provinceName: "Eastern Cape",
      dayNumber: 1,
      reportingDate: "2026-09-08",
      fixedTeams: 2,
      outreachTeams: 3,
      mobileTeams: 1,
      infants0to11m: 45,
      underFives12to59m: 210,
      children5to14y: 0,
      totalVaccinated: 255,
      zeroDoseIdentified: 18,
      missedChildren: 4,
      vialsReceived: 35,
      vialsOpened: 28,
      dosesAdministered: 255,
      vialsWasted: 2,
      vialsRemaining: 5,
      wastageRatePercent: 7.1,
      aefiMinor: 2,
      aefiSevere: 0,
      status: "verified",
      supervisorName: "Sister N. Dlamini",
      remarks: "High turnout at outreach post 1. Mobile team reached pastoralist kraals safely.",
      updatedAt: "2026-09-08T18:30:00Z",
    },
    {
      id: "ss-002",
      campaignId: "campaign-mr-2026",
      facilityId: 1,
      facilityName: "Addo Clinic",
      districtId: 1,
      districtName: "Cacadu Health District",
      provinceId: 1,
      provinceName: "Eastern Cape",
      dayNumber: 2,
      reportingDate: "2026-09-09",
      fixedTeams: 2,
      outreachTeams: 3,
      mobileTeams: 1,
      infants0to11m: 52,
      underFives12to59m: 235,
      children5to14y: 0,
      totalVaccinated: 287,
      zeroDoseIdentified: 24,
      missedChildren: 6,
      vialsReceived: 35,
      vialsOpened: 31,
      dosesAdministered: 287,
      vialsWasted: 1,
      vialsRemaining: 3,
      wastageRatePercent: 6.8,
      aefiMinor: 1,
      aefiSevere: 0,
      status: "verified",
      supervisorName: "Sister N. Dlamini",
      remarks: "Coordination with village head helped mobilize hesitant farm workers.",
      updatedAt: "2026-09-09T18:45:00Z",
    },
    {
      id: "ss-003",
      campaignId: "campaign-mr-2026",
      facilityId: 1,
      facilityName: "Addo Clinic",
      districtId: 1,
      districtName: "Cacadu Health District",
      provinceId: 1,
      provinceName: "Eastern Cape",
      dayNumber: 3,
      reportingDate: "2026-09-10",
      fixedTeams: 2,
      outreachTeams: 3,
      mobileTeams: 1,
      infants0to11m: 38,
      underFives12to59m: 198,
      children5to14y: 0,
      totalVaccinated: 236,
      zeroDoseIdentified: 12,
      missedChildren: 3,
      vialsReceived: 30,
      vialsOpened: 26,
      dosesAdministered: 236,
      vialsWasted: 2,
      vialsRemaining: 2,
      wastageRatePercent: 8.5,
      aefiMinor: 3,
      aefiSevere: 0,
      status: "submitted",
      supervisorName: "Sister N. Dlamini",
      remarks: "Rain in afternoon slowed outreach team 2. Rescheduled absent houses for Day 4 morning.",
      updatedAt: "2026-09-10T19:15:00Z",
    },
    {
      id: "ss-004",
      campaignId: "campaign-mr-2026",
      facilityId: 2,
      facilityName: "Kirkwood Community Health Centre",
      districtId: 1,
      districtName: "Cacadu Health District",
      provinceId: 1,
      provinceName: "Eastern Cape",
      dayNumber: 1,
      reportingDate: "2026-09-08",
      fixedTeams: 3,
      outreachTeams: 4,
      mobileTeams: 2,
      infants0to11m: 64,
      underFives12to59m: 310,
      children5to14y: 0,
      totalVaccinated: 374,
      zeroDoseIdentified: 31,
      missedChildren: 9,
      vialsReceived: 45,
      vialsOpened: 40,
      dosesAdministered: 374,
      vialsWasted: 2,
      vialsRemaining: 3,
      wastageRatePercent: 6.2,
      aefiMinor: 4,
      aefiSevere: 0,
      status: "verified",
      supervisorName: "Dr. P. Khumalo",
      remarks: "Strong community health worker turnout. Finger marking adherence audited at 98%.",
      updatedAt: "2026-09-08T19:00:00Z",
    },
    {
      id: "ss-005",
      campaignId: "campaign-mr-2026",
      facilityId: 2,
      facilityName: "Kirkwood Community Health Centre",
      districtId: 1,
      districtName: "Cacadu Health District",
      provinceId: 1,
      provinceName: "Eastern Cape",
      dayNumber: 2,
      reportingDate: "2026-09-09",
      fixedTeams: 3,
      outreachTeams: 4,
      mobileTeams: 2,
      infants0to11m: 58,
      underFives12to59m: 295,
      children5to14y: 0,
      totalVaccinated: 353,
      zeroDoseIdentified: 22,
      missedChildren: 5,
      vialsReceived: 42,
      vialsOpened: 38,
      dosesAdministered: 353,
      vialsWasted: 2,
      vialsRemaining: 2,
      wastageRatePercent: 6.8,
      aefiMinor: 2,
      aefiSevere: 0,
      status: "verified",
      supervisorName: "Dr. P. Khumalo",
      remarks: "Vaccine carrier ice packs replenished midday as per cold chain SOP.",
      updatedAt: "2026-09-09T18:50:00Z",
    },
  ];
}

export default function CampaignSummarySheets() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Campaign selection
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("campaign-mr-2026");
  const activeCampaign = useMemo(
    () => ACTIVE_SIA_CAMPAIGNS.find((c) => c.id === selectedCampaignId) || ACTIVE_SIA_CAMPAIGNS[0],
    [selectedCampaignId]
  );

  // Geographic filter state
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

  // Summary sheets collection
  const [sheets, setSheets] = useState<HfDailySummarySheet[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Could not load stored summary sheets:", e);
    }
    return getInitialSummarySheets();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets));
    } catch (e) {
      console.warn("Could not save summary sheets to storage:", e);
    }
  }, [sheets]);

  // Super User role gating
  const userRole = user?.role;
  const isSuperUser =
    (user as any)?.isPlatformAdmin === true ||
    userRole === "national_admin" ||
    (Array.isArray((user as any)?.roles) && (user as any).roles.includes("national_admin")) ||
    userRole === "provincial_coordinator" ||
    userRole === "district_manager";

  // Drilldown Modal State
  const [drilldownModal, setDrilldownModal] = useState<"vaccinated" | "zeroDose" | "wastage" | "verification" | null>(null);

  // Dialog & Form State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [viewDetailSheet, setViewDetailSheet] = useState<HfDailySummarySheet | null>(null);

  const [formDayNumber, setFormDayNumber] = useState<number>(1);
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formFacilityId, setFormFacilityId] = useState<number | null>(null);
  const [formFacilityName, setFormFacilityName] = useState<string>("");
  const [formDistrictId, setFormDistrictId] = useState<number>(1);
  const [formDistrictName, setFormDistrictName] = useState<string>("Cacadu Health District");
  const [formProvinceId, setFormProvinceId] = useState<number>(1);

  const [formFixedTeams, setFormFixedTeams] = useState<number>(2);
  const [formOutreachTeams, setFormOutreachTeams] = useState<number>(3);
  const [formMobileTeams, setFormMobileTeams] = useState<number>(1);

  const [formInfants, setFormInfants] = useState<number>(0);
  const [formUnderFives, setFormUnderFives] = useState<number>(0);
  const [formOlderKids, setFormOlderKids] = useState<number>(0);
  const [formZeroDose, setFormZeroDose] = useState<number>(0);
  const [formMissed, setFormMissed] = useState<number>(0);

  const [formVialsReceived, setFormVialsReceived] = useState<number>(30);
  const [formVialsOpened, setFormVialsOpened] = useState<number>(25);
  const [formVialsWasted, setFormVialsWasted] = useState<number>(1);
  const [formVialsRemaining, setFormVialsRemaining] = useState<number>(4);

  const [formAefiMinor, setFormAefiMinor] = useState<number>(0);
  const [formAefiSevere, setFormAefiSevere] = useState<number>(0);
  const [formSupervisorName, setFormSupervisorName] = useState<string>(
    (user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "") || "Facility In-Charge"
  );
  const [formRemarks, setFormRemarks] = useState<string>("");
  const [formStatus, setFormStatus] = useState<"draft" | "submitted" | "verified">("submitted");

  // Multi-Antigen per-antigen dose state
  const [formMultiAntigenDoses, setFormMultiAntigenDoses] = useState<Record<string, { doses: number; opened: number; wasted: number }>>({});

  // Calculated form total
  const formTotalVaccinated = formInfants + formUnderFives + formOlderKids;
  const formWastageRate =
    formVialsOpened > 0 ? Number(((formVialsWasted / formVialsOpened) * 100).toFixed(1)) : 0;

  // Table Management State (Global Rule 24)
  const [tableSearch, setTableSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<string>("dayNumber");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Open Edit Modal for Super Users
  const handleOpenEditModal = (sheet: HfDailySummarySheet) => {
    setEditingSheetId(sheet.id);
    setFormDayNumber(sheet.dayNumber);
    setFormDate(sheet.reportingDate);
    setFormFacilityId(sheet.facilityId);
    setFormFacilityName(sheet.facilityName);
    setFormDistrictId(sheet.districtId);
    setFormDistrictName(sheet.districtName);
    setFormProvinceId(sheet.provinceId);
    setFormFixedTeams(sheet.fixedTeams);
    setFormOutreachTeams(sheet.outreachTeams);
    setFormMobileTeams(sheet.mobileTeams);
    setFormInfants(sheet.infants0to11m);
    setFormUnderFives(sheet.underFives12to59m);
    setFormOlderKids(sheet.children5to14y);
    setFormZeroDose(sheet.zeroDoseIdentified);
    setFormMissed(sheet.missedChildren);
    setFormVialsReceived(sheet.vialsReceived);
    setFormVialsOpened(sheet.vialsOpened);
    setFormVialsWasted(sheet.vialsWasted);
    setFormVialsRemaining(sheet.vialsRemaining);
    setFormAefiMinor(sheet.aefiMinor);
    setFormAefiSevere(sheet.aefiSevere);
    setFormSupervisorName(sheet.supervisorName);
    setFormRemarks(sheet.remarks || "");
    setFormStatus(sheet.status);

    if (sheet.multiAntigenDoses && sheet.multiAntigenDoses.length > 0) {
      const map: Record<string, { doses: number; opened: number; wasted: number }> = {};
      sheet.multiAntigenDoses.forEach((item) => {
        map[item.antigen] = {
          doses: item.dosesAdministered,
          opened: item.vialsOpened,
          wasted: item.vialsWasted,
        };
      });
      setFormMultiAntigenDoses(map);
    } else {
      setFormMultiAntigenDoses({});
    }

    setDialogOpen(true);
  };

  const handleOpenNewModal = () => {
    setEditingSheetId(null);
    setFormDayNumber(1);
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormFacilityId(null);
    setFormFacilityName("");
    setFormInfants(0);
    setFormUnderFives(0);
    setFormOlderKids(0);
    setFormZeroDose(0);
    setFormMissed(0);
    setFormVialsReceived(30);
    setFormVialsOpened(25);
    setFormVialsWasted(1);
    setFormVialsRemaining(4);
    setFormAefiMinor(0);
    setFormAefiSevere(0);
    setFormRemarks("");
    setFormStatus("submitted");
    setFormMultiAntigenDoses({});
    setDialogOpen(true);
  };

  // Fetch facilities for cascade pickers
  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
    queryFn: async () => {
      const res = await fetch("/api/facilities", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Filtered sheets by campaign and geography
  const filteredSheets = useMemo(() => {
    let result = sheets.filter((s) => s.campaignId === selectedCampaignId);

    if (selectedFacilityId) {
      result = result.filter((s) => s.facilityId === selectedFacilityId);
    } else if (selectedDistrictId) {
      result = result.filter((s) => s.districtId === selectedDistrictId);
    }

    if (tableSearch) {
      const term = tableSearch.toLowerCase();
      result = result.filter(
        (s) =>
          s.facilityName.toLowerCase().includes(term) ||
          s.districtName.toLowerCase().includes(term) ||
          s.supervisorName.toLowerCase().includes(term) ||
          String(s.dayNumber).includes(term) ||
          s.reportingDate.includes(term)
      );
    }

    result.sort((a: any, b: any) => {
      const valA = a[sortField] ?? "";
      const valB = b[sortField] ?? "";
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [sheets, selectedCampaignId, selectedFacilityId, selectedDistrictId, tableSearch, sortField, sortOrder]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredSheets.length / pageSize));
  const paginatedSheets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSheets.slice(start, start + pageSize);
  }, [filteredSheets, currentPage, pageSize]);

  // Aggregate stats for current filter
  const cumulativeStats = useMemo(() => {
    const totalVaccinated = filteredSheets.reduce((sum, s) => sum + s.totalVaccinated, 0);
    const totalZeroDose = filteredSheets.reduce((sum, s) => sum + s.zeroDoseIdentified, 0);
    const totalMissed = filteredSheets.reduce((sum, s) => sum + s.missedChildren, 0);
    const totalVialsOpened = filteredSheets.reduce((sum, s) => sum + s.vialsOpened, 0);
    const totalVialsWasted = filteredSheets.reduce((sum, s) => sum + s.vialsWasted, 0);
    const avgWastage = totalVialsOpened > 0 ? ((totalVialsWasted / totalVialsOpened) * 100).toFixed(1) : "0";
    const totalAefi = filteredSheets.reduce((sum, s) => sum + s.aefiMinor + s.aefiSevere, 0);
    const verifiedCount = filteredSheets.filter((s) => s.status === "verified").length;

    return {
      totalVaccinated,
      totalZeroDose,
      totalMissed,
      totalVialsOpened,
      totalVialsWasted,
      avgWastage,
      totalAefi,
      verifiedCount,
      sheetsCount: filteredSheets.length,
    };
  }, [filteredSheets]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40 ml-1 inline" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary ml-1 inline" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />
    );
  };

  // Submit new or update existing HF Daily Summary Sheet
  const handleSaveSummarySheet = () => {
    if (!formFacilityId) {
      toast({ title: "Health Facility Required", description: "Please select the reporting health facility.", variant: "destructive" });
      return;
    }
    if (formTotalVaccinated <= 0) {
      toast({ title: "Tally Required", description: "Total vaccinated count must be greater than zero.", variant: "destructive" });
      return;
    }

    const fac = facilities.find((f) => f.id === formFacilityId);
    const multiDosesList: MultiAntigenDoseItem[] =
      activeCampaign.isMultiAntigen && activeCampaign.antigens
        ? activeCampaign.antigens.map((ag) => ({
            antigen: ag,
            dosesAdministered: formMultiAntigenDoses[ag]?.doses ?? formTotalVaccinated,
            vialsOpened: formMultiAntigenDoses[ag]?.opened ?? formVialsOpened,
            vialsWasted: formMultiAntigenDoses[ag]?.wasted ?? formVialsWasted,
          }))
        : [];

    if (editingSheetId) {
      setSheets((prev) =>
        prev.map((s) =>
          s.id === editingSheetId
            ? {
                ...s,
                dayNumber: Number(formDayNumber),
                reportingDate: formDate,
                facilityId: formFacilityId,
                facilityName: fac?.name || formFacilityName || s.facilityName,
                districtId: fac?.districtId || formDistrictId,
                districtName: formDistrictName,
                provinceId: formProvinceId,
                fixedTeams: Number(formFixedTeams),
                outreachTeams: Number(formOutreachTeams),
                mobileTeams: Number(formMobileTeams),
                infants0to11m: Number(formInfants),
                underFives12to59m: Number(formUnderFives),
                children5to14y: Number(formOlderKids),
                totalVaccinated: formTotalVaccinated,
                zeroDoseIdentified: Number(formZeroDose),
                missedChildren: Number(formMissed),
                vialsReceived: Number(formVialsReceived),
                vialsOpened: Number(formVialsOpened),
                dosesAdministered: formTotalVaccinated,
                vialsWasted: Number(formVialsWasted),
                vialsRemaining: Number(formVialsRemaining),
                wastageRatePercent: formWastageRate,
                aefiMinor: Number(formAefiMinor),
                aefiSevere: Number(formAefiSevere),
                status: formStatus,
                supervisorName: formSupervisorName,
                remarks: formRemarks,
                updatedAt: new Date().toISOString(),
                multiAntigenDoses: multiDosesList,
              }
            : s
        )
      );
      setDialogOpen(false);
      setEditingSheetId(null);
      toast({
        title: "HF Summary Sheet Updated",
        description: `Successfully modified Day ${formDayNumber} record for ${fac?.name || formFacilityName}.`,
      });
      return;
    }

    const newRecord: HfDailySummarySheet = {
      id: `ss-${Date.now()}`,
      campaignId: selectedCampaignId,
      facilityId: formFacilityId,
      facilityName: fac?.name || formFacilityName || `Facility #${formFacilityId}`,
      districtId: fac?.districtId || formDistrictId,
      districtName: formDistrictName,
      provinceId: formProvinceId,
      provinceName: "Eastern Cape",
      dayNumber: Number(formDayNumber),
      reportingDate: formDate,
      fixedTeams: Number(formFixedTeams),
      outreachTeams: Number(formOutreachTeams),
      mobileTeams: Number(formMobileTeams),
      infants0to11m: Number(formInfants),
      underFives12to59m: Number(formUnderFives),
      children5to14y: Number(formOlderKids),
      totalVaccinated: formTotalVaccinated,
      zeroDoseIdentified: Number(formZeroDose),
      missedChildren: Number(formMissed),
      vialsReceived: Number(formVialsReceived),
      vialsOpened: Number(formVialsOpened),
      dosesAdministered: formTotalVaccinated,
      vialsWasted: Number(formVialsWasted),
      vialsRemaining: Number(formVialsRemaining),
      wastageRatePercent: formWastageRate,
      aefiMinor: Number(formAefiMinor),
      aefiSevere: Number(formAefiSevere),
      status: formStatus,
      supervisorName: formSupervisorName,
      remarks: formRemarks,
      updatedAt: new Date().toISOString(),
      multiAntigenDoses: multiDosesList,
    };

    setSheets((prev) => [newRecord, ...prev.filter((s) => !(s.facilityId === newRecord.facilityId && s.dayNumber === newRecord.dayNumber && s.campaignId === newRecord.campaignId))]);
    setDialogOpen(false);

    toast({
      title: "HF Daily Summary Sheet Saved",
      description: `Recorded ${formTotalVaccinated} vaccinations for ${newRecord.facilityName} (Day ${newRecord.dayNumber}).`,
    });
  };

  const handleVerifySheet = (sheetId: string) => {
    if (!isSuperUser) {
      toast({
        title: "Permission Denied",
        description: "Only Super Users (District Managers & National Admins) can audit and verify summary sheets.",
        variant: "destructive",
      });
      return;
    }
    setSheets((prev) =>
      prev.map((s) => (s.id === sheetId ? { ...s, status: "verified", updatedAt: new Date().toISOString() } : s))
    );
    toast({ title: "Summary Sheet Verified", description: "The daily summary tally has been audited and marked verified." });
  };

  const handleDeleteSheet = (sheetId: string) => {
    if (!isSuperUser) {
      toast({
        title: "Permission Denied",
        description: "Only Super Users can delete summary sheet records.",
        variant: "destructive",
      });
      return;
    }
    setSheets((prev) => prev.filter((s) => s.id !== sheetId));
    toast({ title: "Record Removed", description: "The summary sheet record was deleted from local store." });
  };

  const handleExportCsv = () => {
    if (filteredSheets.length === 0) {
      toast({ title: "No records to export" });
      return;
    }
    const headers = [
      "Campaign ID",
      "Day",
      "Date",
      "Health Facility",
      "District",
      "Fixed Teams",
      "Outreach Teams",
      "Mobile Teams",
      "0-11m Vaccinated",
      "12-59m Vaccinated",
      "5-14y Vaccinated",
      "Total Vaccinated",
      "Zero-Dose Reached",
      "Missed Children",
      "Vials Opened",
      "Wastage %",
      "AEFI Minor",
      "AEFI Severe",
      "Status",
      "Supervisor",
    ];
    const rows = filteredSheets.map((s) => [
      s.campaignId,
      s.dayNumber,
      s.reportingDate,
      `"${s.facilityName}"`,
      `"${s.districtName}"`,
      s.fixedTeams,
      s.outreachTeams,
      s.mobileTeams,
      s.infants0to11m,
      s.underFives12to59m,
      s.children5to14y,
      s.totalVaccinated,
      s.zeroDoseIdentified,
      s.missedChildren,
      s.vialsOpened,
      s.wastageRatePercent,
      s.aefiMinor,
      s.aefiSevere,
      s.status,
      `"${s.supervisorName}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vaxplan-sia-summary-sheets-${activeCampaign.id}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "CSV Export Complete", description: `Exported ${filteredSheets.length} daily summary sheets.` });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
      {/* Header & Campaign Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">SIA Campaign Summary Sheets</h1>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-none">
              Daily Tally Aggregator
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Digital data collection tool to summarize daily team tally sheets, aggregate at Health Facility level, and report daily vaccination numbers.
          </p>
        </div>

        {/* Campaign Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-card p-2 rounded-xl border shadow-xs">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Active Campaign:</span>
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger className="w-[300px] h-8 text-xs font-semibold border-none shadow-none bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVE_SIA_CAMPAIGNS.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => {
              if (selectedFacilityId) {
                setFormFacilityId(selectedFacilityId);
                setFormFacilityName(selectedFacility?.name || "");
              }
              setDialogOpen(true);
            }}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold"
          >
            <Plus className="h-4 w-4" />
            Record Daily HF Summary Sheet
          </Button>
        </div>
      </div>

      {/* Campaign Details & Information Bar */}
      <Card className="border shadow-xs bg-purple-50/50 dark:bg-purple-950/20">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-muted-foreground">Target Antigen:</span>{" "}
              <span className="font-bold text-foreground">{activeCampaign.antigen}</span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div>
              <span className="text-muted-foreground">Target Cohort:</span>{" "}
              <span className="font-bold text-foreground">{activeCampaign.targetAges}</span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div>
              <span className="text-muted-foreground">Campaign Window:</span>{" "}
              <span className="font-bold text-foreground">
                {activeCampaign.startDate} ({activeCampaign.totalDays} Days)
              </span>
            </div>
          </div>
          <Badge
            className={`capitalize text-xs ${
              activeCampaign.status === "active"
                ? "bg-emerald-600 text-white"
                : activeCampaign.status === "planning"
                ? "bg-amber-600 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {activeCampaign.status} SIA
          </Badge>
        </CardContent>
      </Card>

      {/* Geographic Scope Filter */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-purple-600" />
            Geographic Scope & Health Facility Picker
          </CardTitle>
          <CardDescription className="text-xs">
            Filter summary sheets by Province, District, or Health Facility to inspect daily tally submissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FacilityCascadePicker
            value={selectedFacilityId}
            onChange={(facId, fac) => {
              setSelectedFacilityId(facId);
              setSelectedFacility(fac);
              if (fac) {
                setSelectedDistrictId(fac.districtId ?? null);
              }
            }}
            layout="row"
          />
        </CardContent>
      </Card>

      {/* Real-Time Aggregate Telemetry KPI Cards — All Clickable with Drill-Down */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          onClick={() => setDrilldownModal("vaccinated")}
          className="border shadow-xs cursor-pointer hover:border-purple-400 dark:hover:border-purple-600 transition-all hover:shadow-md active:scale-[0.99] group"
        >
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <span>Cumulative Vaccinated</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-purple-600 border-purple-200">
                    Drill Down
                  </Badge>
                </div>
                <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                  {cumulativeStats.totalVaccinated.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  From {cumulativeStats.sheetsCount} daily HF reports
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-[11px] font-medium text-purple-600 group-hover:underline flex items-center gap-1">
              <span>View age cohorts & team tally drill-down</span>
              <span>&rarr;</span>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setDrilldownModal("zeroDose")}
          className="border shadow-xs cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 transition-all hover:shadow-md active:scale-[0.99] group"
        >
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <span>Zero-Dose Reached</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-emerald-600 border-emerald-200">
                    Drill Down
                  </Badge>
                </div>
                <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                  {cumulativeStats.totalZeroDose.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {cumulativeStats.totalMissed} missed / absent tracked
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-[11px] font-medium text-emerald-600 group-hover:underline flex items-center gap-1">
              <span>View zero-dose & missed children registry</span>
              <span>&rarr;</span>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setDrilldownModal("wastage")}
          className="border shadow-xs cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-all hover:shadow-md active:scale-[0.99] group"
        >
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <span>Vaccine Vials Opened</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-blue-600 border-blue-200">
                    Drill Down
                  </Badge>
                </div>
                <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                  {cumulativeStats.totalVialsOpened.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Wastage Rate: <span className="font-semibold">{cumulativeStats.avgWastage}%</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-[11px] font-medium text-blue-600 group-hover:underline flex items-center gap-1">
              <span>View vial accountability & logistics</span>
              <span>&rarr;</span>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setDrilldownModal("verification")}
          className="border shadow-xs cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 transition-all hover:shadow-md active:scale-[0.99] group"
        >
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <span>Verified Sheets</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-600 border-amber-200">
                    Drill Down
                  </Badge>
                </div>
                <div className="text-2xl font-bold mt-1 text-foreground">
                  {cumulativeStats.verifiedCount} / {cumulativeStats.sheetsCount}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {cumulativeStats.totalAefi} AEFI cases logged
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-[11px] font-medium text-amber-600 group-hover:underline flex items-center gap-1">
              <span>View supervisor audit & AEFI trail</span>
              <span>&rarr;</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enterprise-Grade Summary Sheets Register (Global Rule 24) */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-purple-600" />
                Health Facility Daily Summary Sheets Register
              </CardTitle>
              <CardDescription className="text-xs">
                Audited daily compilations summarizing team tally sheets for {activeCampaign.name}.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export Register (CSV)
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search and Rows per page */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search facility, district, or date..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Rows per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-16 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-auto border rounded-md min-h-[300px]">
            {filteredSheets.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-sm text-muted-foreground space-y-2 p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <div className="font-semibold text-foreground">No Daily Summary Sheets Found</div>
                <p className="text-xs max-w-sm">
                  No summary sheets recorded for the selected geographic scope. Click "Record Daily HF Summary Sheet" to enter team tallies.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10">
                  <TableRow>
                    <TableHead onClick={() => handleSort("dayNumber")} className="cursor-pointer text-xs w-16">
                      Day {renderSortIcon("dayNumber")}
                    </TableHead>
                    <TableHead onClick={() => handleSort("reportingDate")} className="cursor-pointer text-xs">
                      Date {renderSortIcon("reportingDate")}
                    </TableHead>
                    <TableHead onClick={() => handleSort("facilityName")} className="cursor-pointer text-xs">
                      Health Facility {renderSortIcon("facilityName")}
                    </TableHead>
                    <TableHead className="text-xs">Teams</TableHead>
                    <TableHead onClick={() => handleSort("totalVaccinated")} className="cursor-pointer text-xs">
                      Total Vaccinated {renderSortIcon("totalVaccinated")}
                    </TableHead>
                    <TableHead className="text-xs">0–11m</TableHead>
                    <TableHead className="text-xs">12–59m</TableHead>
                    <TableHead className="text-xs">Zero-Dose</TableHead>
                    <TableHead className="text-xs">Vials Used</TableHead>
                    <TableHead className="text-xs">Wastage %</TableHead>
                    <TableHead onClick={() => handleSort("status")} className="cursor-pointer text-xs">
                      Status {renderSortIcon("status")}
                    </TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSheets.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/50 text-xs">
                      <TableCell className="font-bold text-purple-600">Day {s.dayNumber}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{s.reportingDate}</TableCell>
                      <TableCell className="font-medium text-foreground">{s.facilityName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.fixedTeams + s.outreachTeams + s.mobileTeams} teams
                      </TableCell>
                      <TableCell className="font-bold text-foreground">
                        {s.totalVaccinated.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.infants0to11m}</TableCell>
                      <TableCell className="text-muted-foreground">{s.underFives12to59m}</TableCell>
                      <TableCell className="font-semibold text-emerald-600">
                        {s.zeroDoseIdentified > 0 ? `+${s.zeroDoseIdentified}` : "0"}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">{s.vialsOpened}</TableCell>
                      <TableCell className="text-muted-foreground">{s.wastageRatePercent}%</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            s.status === "verified"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                              : s.status === "submitted"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                          }`}
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewDetailSheet(s)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Inspect Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {isSuperUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(s)}
                              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Edit Record (Super User)"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isSuperUser && s.status !== "verified" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVerifySheet(s.id)}
                              className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              title="Audit & Verify Sheet (Super User)"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isSuperUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSheet(s.id)}
                              className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              title="Delete Record (Super User)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground">
            <div>
              Showing{" "}
              <span className="font-semibold text-foreground">
                {filteredSheets.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * pageSize, filteredSheets.length)}
              </span>{" "}
              of <span className="font-semibold text-foreground">{filteredSheets.length}</span> summary sheets
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-xs">
                Page <span className="font-medium text-foreground">{currentPage}</span> of{" "}
                <span className="font-medium text-foreground">{totalPages}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─────────────────────────────────────────────────────────────────────────────
          RECORD DAILY HF SUMMARY SHEET MODAL (Data Collection Tool)
         ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="text-xl font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-purple-600" />
                {editingSheetId ? "Edit Health Facility Daily Summary Sheet" : "Record Health Facility Daily Summary Sheet"}
              </span>
              {isSuperUser && (
                <Badge className="bg-purple-600 text-white text-[10px]">
                  Super User Audit
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Aggregate team tally sheets (fixed, outreach, and mobile teams) for today's campaign round.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="tallies" className="flex-1 overflow-auto py-2">
            <TabsList className="grid grid-cols-3 w-full mb-4">
              <TabsTrigger value="tallies" className="text-xs">
                1. Team Tallies & Vaccinations
              </TabsTrigger>
              <TabsTrigger value="logistics" className="text-xs">
                2. Vaccine Vial Logistics
              </TabsTrigger>
              <TabsTrigger value="verification" className="text-xs">
                3. AEFI & Supervision Sign-Off
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Tallies & Vaccination Counts */}
            <TabsContent value="tallies" className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Campaign Day</Label>
                  <Select value={String(formDayNumber)} onValueChange={(val) => setFormDayNumber(Number(val))}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: activeCampaign.totalDays }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)} className="text-xs">
                          Campaign Day {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Date of Activity</Label>
                  <Input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* SMART-SEARCHABLE CASCADE FILTER PICKER (Province -> District -> Facility) */}
              <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-purple-600" />
                    Reporting Health Facility (Cascading Smart Search)
                  </span>
                  {formFacilityName && (
                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 border-purple-200">
                      Selected: {formFacilityName}
                    </Badge>
                  )}
                </div>
                <FacilityCascadePicker
                  value={formFacilityId}
                  onChange={(facId, fac) => {
                    setFormFacilityId(facId);
                    if (fac) {
                      setFormFacilityName(fac.name);
                      setFormDistrictId(fac.districtId || 1);
                    }
                  }}
                  layout="row"
                  showLabels={true}
                />
              </div>

              {/* MULTI-ANTIGEN INTERVENTION BREAKDOWN (If campaign is multi-antigen) */}
              {activeCampaign.isMultiAntigen && activeCampaign.antigens && activeCampaign.antigens.length > 0 && (
                <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      Multi-Antigen / Intervention Daily Breakdown
                    </div>
                    <Badge className="bg-purple-600 text-white text-[10px]">
                      {activeCampaign.antigens.length} Interventions Active
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {activeCampaign.antigens.map((antigen) => (
                      <div key={antigen} className="grid sm:grid-cols-4 gap-2 items-center p-2 bg-background rounded border text-xs">
                        <div className="font-semibold text-foreground sm:col-span-1">{antigen}</div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Doses Administered</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Doses"
                            value={formMultiAntigenDoses[antigen]?.doses ?? formTotalVaccinated}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setFormMultiAntigenDoses((prev) => ({
                                ...prev,
                                [antigen]: {
                                  ...(prev[antigen] || { doses: 0, opened: formVialsOpened, wasted: formVialsWasted }),
                                  doses: val,
                                },
                              }));
                            }}
                            className="h-7 text-xs mt-0.5"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Vials / Units Opened</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Opened"
                            value={formMultiAntigenDoses[antigen]?.opened ?? formVialsOpened}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setFormMultiAntigenDoses((prev) => ({
                                ...prev,
                                [antigen]: {
                                  ...(prev[antigen] || { doses: formTotalVaccinated, opened: 0, wasted: formVialsWasted }),
                                  opened: val,
                                },
                              }));
                            }}
                            className="h-7 text-xs mt-0.5"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Vials / Units Wasted</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Wasted"
                            value={formMultiAntigenDoses[antigen]?.wasted ?? formVialsWasted}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setFormMultiAntigenDoses((prev) => ({
                                ...prev,
                                [antigen]: {
                                  ...(prev[antigen] || { doses: formTotalVaccinated, opened: formVialsOpened, wasted: 0 }),
                                  wasted: val,
                                },
                              }));
                            }}
                            className="h-7 text-xs mt-0.5"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-muted/40 rounded-lg space-y-2 border">
                <div className="text-xs font-semibold text-foreground">Teams Reporting Today</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Fixed Post Teams</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formFixedTeams}
                      onChange={(e) => setFormFixedTeams(Number(e.target.value))}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Outreach Teams</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formOutreachTeams}
                      onChange={(e) => setFormOutreachTeams(Number(e.target.value))}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Mobile Teams</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formMobileTeams}
                      onChange={(e) => setFormMobileTeams(Number(e.target.value))}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-foreground">Vaccinated Counts (Summed from Tally Sheets)</div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Age 0–11 Months (Infants)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formInfants}
                      onChange={(e) => setFormInfants(Number(e.target.value))}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Age 12–59 Months (Under-5s)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formUnderFives}
                      onChange={(e) => setFormUnderFives(Number(e.target.value))}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Age 5–14 Years (Older)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formOlderKids}
                      onChange={(e) => setFormOlderKids(Number(e.target.value))}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                </div>

                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-purple-700 dark:text-purple-300">Total Vaccinated Today</div>
                    <div className="text-xs text-muted-foreground">Auto-calculated sum of all cohorts</div>
                  </div>
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {formTotalVaccinated.toLocaleString()}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label className="text-xs font-semibold text-emerald-600">Zero-Dose Children Reached</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formZeroDose}
                      onChange={(e) => setFormZeroDose(Number(e.target.value))}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-amber-600">Missed / Absent Children Logged</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formMissed}
                      onChange={(e) => setFormMissed(Number(e.target.value))}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Vaccine Logistics */}
            <TabsContent value="logistics" className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Vials Received / Starting Stock</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formVialsReceived}
                    onChange={(e) => setFormVialsReceived(Number(e.target.value))}
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Vials Opened Today</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formVialsOpened}
                    onChange={(e) => setFormVialsOpened(Number(e.target.value))}
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-rose-600">Vials Discarded / Wasted</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formVialsWasted}
                    onChange={(e) => setFormVialsWasted(Number(e.target.value))}
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-emerald-600">Usable Vials Remaining in Fridge</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formVialsRemaining}
                    onChange={(e) => setFormVialsRemaining(Number(e.target.value))}
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg border space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">Calculated Wastage Rate:</span>
                  <span className={`font-bold ${formWastageRate > 10 ? "text-rose-600" : "text-emerald-600"}`}>
                    {formWastageRate}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  WHO standard acceptable wastage for 10-dose campaign vials is &le; 10%.
                </p>
              </div>
            </TabsContent>

            {/* Tab 3: AEFI & Sign-Off */}
            <TabsContent value="verification" className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Minor AEFI Cases (Fever, Local Swelling)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formAefiMinor}
                    onChange={(e) => setFormAefiMinor(Number(e.target.value))}
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-rose-600">Severe AEFI Cases (Anaphylaxis, Admission)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formAefiSevere}
                    onChange={(e) => setFormAefiSevere(Number(e.target.value))}
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Supervisor / Compiler Name</Label>
                  <Input
                    value={formSupervisorName}
                    onChange={(e) => setFormSupervisorName(e.target.value)}
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Submission Status</Label>
                  <Select value={formStatus} onValueChange={(val: any) => setFormStatus(val)}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft" className="text-xs">Draft</SelectItem>
                      <SelectItem value="submitted" className="text-xs">Submitted to District</SelectItem>
                      <SelectItem value="verified" className="text-xs">Verified by Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Field Remarks / Supervision Notes</Label>
                <Textarea
                  placeholder="Note special events: weather constraints, community refusal areas, mobile team security, etc."
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  className="text-xs mt-1 min-h-[80px]"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveSummarySheet} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold">
              Save Daily Summary Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────────────
          INSPECT FULL SUMMARY SHEET DETAIL DIALOG
         ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={viewDetailSheet !== null} onOpenChange={(open) => !open && setViewDetailSheet(null)}>
        <DialogContent className="max-w-2xl p-6">
          {viewDetailSheet && (
            <div className="space-y-4">
              <DialogHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg font-bold">
                    HF Summary Sheet — Day {viewDetailSheet.dayNumber}
                  </DialogTitle>
                  <Badge variant="outline" className="capitalize text-xs">
                    {viewDetailSheet.status}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  {viewDetailSheet.facilityName} &bull; {viewDetailSheet.districtName} &bull; {viewDetailSheet.reportingDate}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg border text-xs">
                <div>
                  <span className="text-muted-foreground">Fixed Teams:</span>{" "}
                  <span className="font-bold">{viewDetailSheet.fixedTeams}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Outreach Teams:</span>{" "}
                  <span className="font-bold">{viewDetailSheet.outreachTeams}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mobile Teams:</span>{" "}
                  <span className="font-bold">{viewDetailSheet.mobileTeams}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground">Vaccinated Breakdown</div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="p-2 border rounded bg-card">
                    <div className="text-muted-foreground text-[10px]">0–11 Months</div>
                    <div className="font-bold text-base">{viewDetailSheet.infants0to11m}</div>
                  </div>
                  <div className="p-2 border rounded bg-card">
                    <div className="text-muted-foreground text-[10px]">12–59 Months</div>
                    <div className="font-bold text-base">{viewDetailSheet.underFives12to59m}</div>
                  </div>
                  <div className="p-2 border rounded bg-card">
                    <div className="text-muted-foreground text-[10px]">Total Vaccinated</div>
                    <div className="font-bold text-base text-purple-600">{viewDetailSheet.totalVaccinated}</div>
                  </div>
                  <div className="p-2 border rounded bg-card">
                    <div className="text-muted-foreground text-[10px]">Zero-Dose Reached</div>
                    <div className="font-bold text-base text-emerald-600">+{viewDetailSheet.zeroDoseIdentified}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground">Vaccine Vial Accountability</div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="p-2 border rounded bg-card">
                    <div className="text-muted-foreground text-[10px]">Vials Opened</div>
                    <div className="font-bold">{viewDetailSheet.vialsOpened}</div>
                  </div>
                  <div className="p-2 border rounded bg-card">
                    <div className="text-muted-foreground text-[10px]">Vials Wasted</div>
                    <div className="font-bold text-rose-600">{viewDetailSheet.vialsWasted}</div>
                  </div>
                  <div className="p-2 border rounded bg-card">
                    <div className="text-muted-foreground text-[10px]">Vials Remaining</div>
                    <div className="font-bold text-emerald-600">{viewDetailSheet.vialsRemaining}</div>
                  </div>
                  <div className="p-2 border rounded bg-card">
                    <div className="text-muted-foreground text-[10px]">Wastage Rate</div>
                    <div className="font-bold">{viewDetailSheet.wastageRatePercent}%</div>
                  </div>
                </div>
              </div>

              {viewDetailSheet.remarks && (
                <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                  <span className="font-semibold text-foreground">Supervisor Remarks:</span>
                  <p className="text-muted-foreground">{viewDetailSheet.remarks}</p>
                </div>
              )}

              <DialogFooter className="pt-2 border-t flex justify-between sm:justify-between items-center">
                <div className="text-[11px] text-muted-foreground">
                  Compiled by: <strong>{viewDetailSheet.supervisorName}</strong>
                </div>
                <Button size="sm" variant="outline" onClick={() => setViewDetailSheet(null)} className="text-xs">
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────────────
          1. DRILLDOWN MODAL: CUMULATIVE VACCINATED & AGE COHORTS
         ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={drilldownModal === "vaccinated"} onOpenChange={(open) => !open && setDrilldownModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                Cumulative Vaccinated Cohort Drill-Down
              </DialogTitle>
              <Badge className="bg-purple-600 text-white text-xs">
                {cumulativeStats.totalVaccinated.toLocaleString()} Doses Administered
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              Disaggregated vaccination tallies across age groups, delivery modalities, and health facilities for {activeCampaign.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Age Cohorts Grid */}
            <div className="space-y-2">
              <span className="font-semibold text-foreground">Target Age Cohort Disaggregation</span>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border bg-card space-y-1">
                  <div className="text-[11px] text-muted-foreground">0–11 Months (Infants)</div>
                  <div className="text-xl font-bold text-foreground">
                    {filteredSheets.reduce((sum, s) => sum + s.infants0to11m, 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-purple-600 font-medium">
                    {cumulativeStats.totalVaccinated > 0
                      ? `${((filteredSheets.reduce((sum, s) => sum + s.infants0to11m, 0) / cumulativeStats.totalVaccinated) * 100).toFixed(1)}% of total`
                      : "0%"}
                  </div>
                </div>

                <div className="p-3 rounded-lg border bg-card space-y-1">
                  <div className="text-[11px] text-muted-foreground">12–59 Months (Under-5s)</div>
                  <div className="text-xl font-bold text-foreground">
                    {filteredSheets.reduce((sum, s) => sum + s.underFives12to59m, 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-purple-600 font-medium">
                    {cumulativeStats.totalVaccinated > 0
                      ? `${((filteredSheets.reduce((sum, s) => sum + s.underFives12to59m, 0) / cumulativeStats.totalVaccinated) * 100).toFixed(1)}% of total`
                      : "0%"}
                  </div>
                </div>

                <div className="p-3 rounded-lg border bg-card space-y-1">
                  <div className="text-[11px] text-muted-foreground">5–14 Years (Older)</div>
                  <div className="text-xl font-bold text-foreground">
                    {filteredSheets.reduce((sum, s) => sum + s.children5to14y, 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-purple-600 font-medium">
                    {cumulativeStats.totalVaccinated > 0
                      ? `${((filteredSheets.reduce((sum, s) => sum + s.children5to14y, 0) / cumulativeStats.totalVaccinated) * 100).toFixed(1)}% of total`
                      : "0%"}
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Teams Contribution */}
            <div className="p-3.5 bg-muted/40 rounded-lg border space-y-2">
              <span className="font-semibold text-foreground">Delivery Modality Output</span>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-background rounded border">
                  <div className="text-muted-foreground text-[10px]">Fixed Clinic Teams</div>
                  <div className="text-base font-bold text-foreground">
                    {filteredSheets.reduce((sum, s) => sum + s.fixedTeams, 0)} Active Teams
                  </div>
                </div>
                <div className="p-2 bg-background rounded border">
                  <div className="text-muted-foreground text-[10px]">Outreach Post Teams</div>
                  <div className="text-base font-bold text-purple-600">
                    {filteredSheets.reduce((sum, s) => sum + s.outreachTeams, 0)} Active Teams
                  </div>
                </div>
                <div className="p-2 bg-background rounded border">
                  <div className="text-muted-foreground text-[10px]">Mobile / H2H Teams</div>
                  <div className="text-base font-bold text-blue-600">
                    {filteredSheets.reduce((sum, s) => sum + s.mobileTeams, 0)} Active Teams
                  </div>
                </div>
              </div>
            </div>

            {/* Top Contributing Facilities */}
            <div className="space-y-2">
              <span className="font-semibold text-foreground">Contributing Facilities in Selected Scope</span>
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {Array.from(new Set(filteredSheets.map((s) => s.facilityName))).map((facName) => {
                  const facSheets = filteredSheets.filter((s) => s.facilityName === facName);
                  const total = facSheets.reduce((acc, s) => acc + s.totalVaccinated, 0);
                  const zeroDose = facSheets.reduce((acc, s) => acc + s.zeroDoseIdentified, 0);
                  return (
                    <div key={facName} className="p-2.5 flex items-center justify-between text-xs hover:bg-muted/40">
                      <div>
                        <div className="font-medium text-foreground">{facName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {facSheets.length} daily summary sheets reported
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-purple-600">{total.toLocaleString()} vaccinated</div>
                        <div className="text-[10px] text-emerald-600">+{zeroDose} zero-dose</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button size="sm" variant="outline" onClick={() => setDrilldownModal(null)} className="text-xs">
              Close Drill-Down
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. DRILLDOWN MODAL: ZERO-DOSE & MISSED CHILDREN REGISTRY
         ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={drilldownModal === "zeroDose"} onOpenChange={(open) => !open && setDrilldownModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Zero-Dose Children & Mop-Up Registry
              </DialogTitle>
              <Badge className="bg-emerald-600 text-white text-xs">
                +{cumulativeStats.totalZeroDose.toLocaleString()} First-Time Vaccinees
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              Field discovery tracking for zero-dose infants caught by outreach teams and missed children requiring mop-up visits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-lg space-y-1">
                <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                  Zero-Dose Yield Rate
                </div>
                <div className="text-2xl font-bold text-emerald-600">
                  {cumulativeStats.totalVaccinated > 0
                    ? `${((cumulativeStats.totalZeroDose / cumulativeStats.totalVaccinated) * 100).toFixed(1)}%`
                    : "0%"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Proportion of vaccinated cohort who never received a routine immunization dose prior to SIA.
                </div>
              </div>

              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg space-y-1">
                <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                  Missed / Absent Children Logged
                </div>
                <div className="text-2xl font-bold text-amber-600">
                  {cumulativeStats.totalMissed.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Caregivers away at farm work or temporary household absence. Scheduled for mop-up sweeps.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-foreground">Zero-Dose Discovery per Health Facility</span>
              <div className="border rounded-md divide-y max-h-52 overflow-y-auto">
                {filteredSheets.map((s) => (
                  <div key={s.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-muted/40">
                    <div>
                      <div className="font-medium text-foreground">{s.facilityName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Day {s.dayNumber} ({s.reportingDate}) &bull; {s.outreachTeams} outreach teams
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-600">+{s.zeroDoseIdentified} zero-dose</span>
                      <div className="text-[10px] text-amber-600">{s.missedChildren} absent logged</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button size="sm" variant="outline" onClick={() => setDrilldownModal(null)} className="text-xs">
              Close Registry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. DRILLDOWN MODAL: VACCINE VIAL ACCOUNTABILITY & LOGISTICS
         ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={drilldownModal === "wastage"} onOpenChange={(open) => !open && setDrilldownModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-600" />
                Vaccine Vial Logistics & Wastage Breakdown
              </DialogTitle>
              <Badge variant="outline" className="text-xs font-semibold">
                Average Wastage: {cumulativeStats.avgWastage}%
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              End-of-day stock reconciliation, opened vials count, remaining cold chain balance, and wastage prevention.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 border rounded-lg bg-card">
                <div className="text-[10px] text-muted-foreground">Vials Received</div>
                <div className="text-lg font-bold text-foreground">
                  {filteredSheets.reduce((sum, s) => sum + s.vialsReceived, 0).toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 border rounded-lg bg-card">
                <div className="text-[10px] text-muted-foreground">Vials Opened</div>
                <div className="text-lg font-bold text-blue-600">
                  {cumulativeStats.totalVialsOpened.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 border rounded-lg bg-card">
                <div className="text-[10px] text-muted-foreground">Vials Wasted</div>
                <div className="text-lg font-bold text-rose-600">
                  {filteredSheets.reduce((sum, s) => sum + s.vialsWasted, 0).toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 border rounded-lg bg-card">
                <div className="text-[10px] text-muted-foreground">Vials Remaining</div>
                <div className="text-lg font-bold text-emerald-600">
                  {filteredSheets.reduce((sum, s) => sum + s.vialsRemaining, 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-foreground">Facility Daily Stock Reconciliations</span>
              <div className="border rounded-md divide-y max-h-52 overflow-y-auto">
                {filteredSheets.map((s) => (
                  <div key={s.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-muted/40">
                    <div>
                      <div className="font-medium text-foreground">{s.facilityName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Day {s.dayNumber} &bull; Received {s.vialsReceived} &bull; Opened {s.vialsOpened} &bull; Remaining {s.vialsRemaining}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${s.wastageRatePercent > 10 ? "text-rose-600" : s.wastageRatePercent > 5 ? "text-amber-600" : "text-emerald-600"}`}>
                        {s.wastageRatePercent}% Wastage
                      </span>
                      <div className="text-[10px] text-muted-foreground">{s.vialsWasted} vials discarded</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button size="sm" variant="outline" onClick={() => setDrilldownModal(null)} className="text-xs">
              Close Logistics View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. DRILLDOWN MODAL: SUPERVISOR AUDIT & VERIFICATION TRAIL
         ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={drilldownModal === "verification"} onOpenChange={(open) => !open && setDrilldownModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-amber-600" />
                Supervisor Audit & Verification Trail
              </DialogTitle>
              <Badge className="bg-amber-600 text-white text-xs">
                {cumulativeStats.verifiedCount} / {cumulativeStats.sheetsCount} Verified
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              Supervisory sign-offs, data verification completeness, and AEFI surveillance logs across all reporting units.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 border rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200">
                <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold">Verified by Supervisor</div>
                <div className="text-xl font-bold text-emerald-600">{cumulativeStats.verifiedCount}</div>
                <div className="text-[10px] text-muted-foreground">Ready for DHIS2 sync</div>
              </div>
              <div className="p-3 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border-blue-200">
                <div className="text-[10px] text-blue-800 dark:text-blue-300 font-semibold">Pending District Audit</div>
                <div className="text-xl font-bold text-blue-600">
                  {filteredSheets.filter((s) => s.status === "submitted").length}
                </div>
                <div className="text-[10px] text-muted-foreground">Submitted by facility</div>
              </div>
              <div className="p-3 border rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border-rose-200">
                <div className="text-[10px] text-rose-800 dark:text-rose-300 font-semibold">AEFI Incidents Logged</div>
                <div className="text-xl font-bold text-rose-600">{cumulativeStats.totalAefi}</div>
                <div className="text-[10px] text-muted-foreground">All resolved favorably</div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-foreground">Summary Sheets Verification Status</span>
              <div className="border rounded-md divide-y max-h-52 overflow-y-auto">
                {filteredSheets.map((s) => (
                  <div key={s.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-muted/40">
                    <div>
                      <div className="font-medium text-foreground">{s.facilityName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Day {s.dayNumber} &bull; Compiled by: {s.supervisorName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          s.status === "verified"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                        }`}
                      >
                        {s.status}
                      </Badge>
                      {isSuperUser && s.status !== "verified" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleVerifySheet(s.id)}
                          className="h-6 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
                        >
                          Audit Now
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button size="sm" variant="outline" onClick={() => setDrilldownModal(null)} className="text-xs">
              Close Audit Trail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
