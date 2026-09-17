import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { FacilityCascadePicker } from "@/components/FacilityCascadePicker";
import { ReadinessChoroplethMap } from "@/components/readiness/ReadinessChoroplethMap";
import {
  Radio,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  TrendingUp,
  Download,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  Calendar,
  Building2,
  ShieldCheck,
  Activity,
  BarChart3,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Pencil,
  FileSpreadsheet,
  RefreshCw,
  Clock,
  MapPin,
  Check,
  Info,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  Cell,
} from "recharts";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { Facility, Province, District } from "@shared/schema";
import type { TenantLike } from "@/lib/tenantGeo";

// ─── Leaflet Icon Fix for Vite ───────────────────────────────────────────────
const createColoredPinIcon = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="28" height="28">
    <path d="M12 0c-4.418 0-8 3.582-8 8c0 5.25 7 13 8 15 1-2 8-9.75 8-15 0-4.418-3.582-8-8-8zm0 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "readiness-pin-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

// ─── Types & Definitions (from Week 4 Readiness Assessment_Province.xlsx) ────
export type AssessmentTier = "tier1_national" | "tier2_provincial" | "tier3_district";
export type MilestoneTimeline = "12W" | "8W" | "4W" | "2W" | "1W" | "D-1";

export interface ReadinessIndicatorDef {
  id: string;
  domainId: string;
  domainName: string;
  code: string;
  question: string;
  sourceOfVerification: string;
  milestone: MilestoneTimeline;
  weight: number;
}

export interface ReadinessScoreEntry {
  indicatorId: string;
  score: number; // 0 to 10
  notes?: string;
  evidenceVerified?: boolean;
}

export interface AssessmentRecord {
  id: string;
  campaignId: string;
  tier: AssessmentTier;
  milestone: MilestoneTimeline;
  entityId: number | string;
  entityName: string;
  parentEntityName?: string;
  provinceId?: number | null;
  provinceName?: string;
  districtId?: number | null;
  districtName?: string;
  facilityId?: number | null;
  facilityName?: string;
  assessorName: string;
  assessorRole: string;
  assessmentDate: string;
  scores: Record<string, number>; // indicatorId -> score (0-10)
  domainScores: Record<string, number>; // domainId -> percentage (0-100)
  compositeScore: number; // 0-100
  status: "ready" | "watchlist" | "not_ready";
  isSignedOff: boolean;
  notes?: string;
  coordinates?: [number, number];
  updatedAt: string;
}

export interface CorrectiveActionItem {
  id: string;
  assessmentId: string;
  entityName: string;
  domain: string;
  issue: string;
  actionRequired: string;
  responsiblePerson: string;
  deadline: string;
  status: "open" | "in_progress" | "resolved";
  priority: "high" | "medium" | "low";
}

// ─── Standard WHO/MOH SIA Readiness Indicators ──────────────────────────────
export const READINESS_DOMAINS = [
  { id: "planning", name: "Planning, Coordination & Financing", color: "#3b82f6" },
  { id: "logistics", name: "Vaccine, Cold Chain & Logistics", color: "#06b6d4" },
  { id: "training", name: "Training & Human Resources", color: "#8b5cf6" },
  { id: "mobilization", name: "Social Mobilisation & Communication", color: "#ec4899" },
  { id: "supervision", name: "Monitoring, Supervision & AEFI", color: "#10b981" },
];

export const READINESS_INDICATORS: ReadinessIndicatorDef[] = [
  // 1. Planning, Coordination & Financing
  {
    id: "ind-1",
    domainId: "planning",
    domainName: "Planning, Coordination & Financing",
    code: "1.1",
    question: "Have operational SIA components (vaccines, supplies, waste, training, comms) been planned?",
    sourceOfVerification: "Workplan with list of assigned activities and confirmed dates",
    milestone: "8W",
    weight: 1,
  },
  {
    id: "ind-2",
    domainId: "planning",
    domainName: "Planning, Coordination & Financing",
    code: "1.2",
    question: "Is there an active Inter-Agency Coordination Committee / Taskforce meeting regularly?",
    sourceOfVerification: "Minutes of coordination meetings and signed TORs",
    milestone: "8W",
    weight: 1,
  },
  {
    id: "ind-3",
    domainId: "planning",
    domainName: "Planning, Coordination & Financing",
    code: "1.3",
    question: "Is there evidenced political and administrative commitment from local authorities?",
    sourceOfVerification: "Evidence of civic leadership engagement, launch plans, ministerial circulars",
    milestone: "8W",
    weight: 1,
  },
  {
    id: "ind-4",
    domainId: "planning",
    domainName: "Planning, Coordination & Financing",
    code: "1.4",
    question: "Do validated microplans identify target population by geographic area and vaccination site?",
    sourceOfVerification: "Validated microplans, GIS maps, community catchment population lists",
    milestone: "8W",
    weight: 1.5,
  },
  {
    id: "ind-5",
    domainId: "planning",
    domainName: "Planning, Coordination & Financing",
    code: "1.5",
    question: "Are specialized strategies planned for hard-to-reach, mobile, and zero-dose populations?",
    sourceOfVerification: "Special needs team deployment rosters with dedicated transport and logistics allocation",
    milestone: "8W",
    weight: 1.5,
  },
  {
    id: "ind-6",
    domainId: "planning",
    domainName: "Planning, Coordination & Financing",
    code: "1.6",
    question: "Have operational funds been received and disbursed to the field levels for all activities?",
    sourceOfVerification: "Microplan budget disbursement vouchers and bank release confirmations",
    milestone: "4W",
    weight: 2,
  },

  // 2. Vaccine, Cold Chain & Logistics
  {
    id: "ind-7",
    domainId: "logistics",
    domainName: "Vaccine, Cold Chain & Logistics",
    code: "2.1",
    question: "Is there sufficient functional cold-chain capacity (refrigerators, freezers, cold boxes)?",
    sourceOfVerification: "Cold chain inventory survey and temperature monitoring logs",
    milestone: "8W",
    weight: 1.5,
  },
  {
    id: "ind-8",
    domainId: "logistics",
    domainName: "Vaccine, Cold Chain & Logistics",
    code: "2.2",
    question: "Are received supplies of bundled vaccines consistent with target (Target x 1.11 WMF)?",
    sourceOfVerification: "Vaccine physical delivery stock ledgers and consignment notes",
    milestone: "4W",
    weight: 2,
  },
  {
    id: "ind-9",
    domainId: "logistics",
    domainName: "Vaccine, Cold Chain & Logistics",
    code: "2.3",
    question: "Are AD syringes, mixing syringes, and safety boxes completely received and bundled?",
    sourceOfVerification: "Logistics ledger verifying 1:1 bundling of syringes and safety boxes (1 per 100)",
    milestone: "4W",
    weight: 1.5,
  },
  {
    id: "ind-10",
    domainId: "logistics",
    domainName: "Vaccine, Cold Chain & Logistics",
    code: "2.4",
    question: "Has the administrative unit secured vehicles, boats, and fuel for distribution and teams?",
    sourceOfVerification: "Transport log, fuel vouchers, vehicle allocation matrix",
    milestone: "4W",
    weight: 1.5,
  },
  {
    id: "ind-11",
    domainId: "logistics",
    domainName: "Vaccine, Cold Chain & Logistics",
    code: "2.5",
    question: "Is there an environmentally compliant waste management and sharps disposal plan in place?",
    sourceOfVerification: "Waste management protocol with designated incineration or safe burial sites",
    milestone: "4W",
    weight: 1,
  },
  {
    id: "ind-12",
    domainId: "logistics",
    domainName: "Vaccine, Cold Chain & Logistics",
    code: "2.6",
    question: "Have tally sheets, summary sheets, AEFI forms, and vaccinator pocket guides arrived?",
    sourceOfVerification: "Physical print inventory verification at health facilities",
    milestone: "2W",
    weight: 1,
  },

  // 3. Training & Human Resources
  {
    id: "ind-13",
    domainId: "training",
    domainName: "Training & Human Resources",
    code: "3.1",
    question: "Have Training of Trainers (TOT) sessions been completed for provincial and district facilitators?",
    sourceOfVerification: "Signed TOT attendance sheets, participant pre/post test scores",
    milestone: "8W",
    weight: 1,
  },
  {
    id: "ind-14",
    domainId: "training",
    domainName: "Training & Human Resources",
    code: "3.2",
    question: "Have health workers, vaccinators, and team leaders completed SIA clinical training?",
    sourceOfVerification: "Training completion register and practical reconstitution drills",
    milestone: "4W",
    weight: 1.5,
  },
  {
    id: "ind-15",
    domainId: "training",
    domainName: "Training & Human Resources",
    code: "3.3",
    question: "Have recorders, community mobilizers, and independent monitors been trained?",
    sourceOfVerification: "Mobilizer and tally recorder workshop registers",
    milestone: "2W",
    weight: 1,
  },

  // 4. Social Mobilisation & Communication
  {
    id: "ind-16",
    domainId: "mobilization",
    domainName: "Social Mobilisation & Communication",
    code: "4.1",
    question: "Are social mobilization, advocacy, and media activities being actively implemented?",
    sourceOfVerification: "Broadcasting logs, community engagement registers, poster placement reports",
    milestone: "4W",
    weight: 1.5,
  },
  {
    id: "ind-17",
    domainId: "mobilization",
    domainName: "Social Mobilisation & Communication",
    code: "4.2",
    question: "Is the community aware of the campaign dates, target ages, and fixed/outreach vaccination venues?",
    sourceOfVerification: "Rapid spot check survey of community members (caretakers) in target wards",
    milestone: "2W",
    weight: 1.5,
  },

  // 5. Monitoring, Supervision & AEFI
  {
    id: "ind-18",
    domainId: "supervision",
    domainName: "Monitoring, Supervision & AEFI",
    code: "5.1",
    question: "Is there an approved supportive supervision plan specifying names, routes, and vehicles?",
    sourceOfVerification: "Supervision deployment roster with daily itinerary mapped per supervisor",
    milestone: "4W",
    weight: 1,
  },
  {
    id: "ind-19",
    domainId: "supervision",
    domainName: "Monitoring, Supervision & AEFI",
    code: "5.2",
    question: "Have monitors been trained on Rapid Convenience Monitoring (RCM) protocols and sampling?",
    sourceOfVerification: "RCM orientation attendance and field tool distribution list",
    milestone: "2W",
    weight: 1,
  },
  {
    id: "ind-20",
    domainId: "supervision",
    domainName: "Monitoring, Supervision & AEFI",
    code: "5.3",
    question: "Are daily electronic summary aggregation workflows and AEFI emergency response kits operational?",
    sourceOfVerification: "VaxPlan summary sheet test transmission and emergency hospital AEFI kits checked",
    milestone: "1W",
    weight: 1.5,
  },
];

// ─── Initial Seed Data from Excel Spreadsheet (Zambia SIA Dataset) ────────────
const STORAGE_KEY_ASSESSMENTS = "vaxplan.campaign_readiness_assessments.v1";
const STORAGE_KEY_ACTIONS = "vaxplan.campaign_readiness_actions.v1";

function calculateScoresFromRaw(scores: Record<string, number>) {
  const domainTotals: Record<string, { totalScore: number; maxScore: number }> = {
    planning: { totalScore: 0, maxScore: 0 },
    logistics: { totalScore: 0, maxScore: 0 },
    training: { totalScore: 0, maxScore: 0 },
    mobilization: { totalScore: 0, maxScore: 0 },
    supervision: { totalScore: 0, maxScore: 0 },
  };

  let totalWeightedScore = 0;
  let totalMaxWeight = 0;

  READINESS_INDICATORS.forEach((ind) => {
    const score = scores[ind.id] ?? 0;
    domainTotals[ind.domainId].totalScore += score * ind.weight;
    domainTotals[ind.domainId].maxScore += 10 * ind.weight;

    totalWeightedScore += score * ind.weight;
    totalMaxWeight += 10 * ind.weight;
  });

  const domainScores: Record<string, number> = {};
  Object.keys(domainTotals).forEach((d) => {
    const { totalScore, maxScore } = domainTotals[d];
    domainScores[d] = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  });

  const compositeScore = totalMaxWeight > 0 ? Math.round((totalWeightedScore / totalMaxWeight) * 100) : 0;
  const status: "ready" | "watchlist" | "not_ready" =
    compositeScore >= 80 ? "ready" : compositeScore >= 60 ? "watchlist" : "not_ready";

  return { domainScores, compositeScore, status };
}

function getInitialAssessments(): AssessmentRecord[] {
  // Directly calibrated against 'National Picture' and 'Central' sheets in Week 4 Readiness Assessment_Province.xlsx
  const rawCentralScores: Record<string, number> = {
    "ind-1": 10, "ind-2": 10, "ind-3": 10, "ind-4": 10, "ind-5": 10, "ind-6": 0,
    "ind-7": 6, "ind-8": 5, "ind-9": 5, "ind-10": 5, "ind-11": 10, "ind-12": 0,
    "ind-13": 10, "ind-14": 0, "ind-15": 0,
    "ind-16": 10, "ind-17": 10,
    "ind-18": 10, "ind-19": 10, "ind-20": 8,
  };

  return [
    // ─── Tier 1: National Checks Provinces (Zambia 10 Provinces from Excel) ────
    {
      id: "ass-prov-central",
      campaignId: "campaign-mr-2026",
      tier: "tier1_national",
      milestone: "4W",
      entityId: 1,
      entityName: "Central Province",
      assessorName: "Dr. B. Chilufya (National EPI Manager)",
      assessorRole: "National Readiness Team Lead",
      assessmentDate: "2026-08-28",
      scores: rawCentralScores,
      domainScores: {
        planning: 68,
        logistics: 33,
        training: 33,
        mobilization: 96,
        supervision: 90,
      },
      compositeScore: 64,
      status: "watchlist",
      isSignedOff: true,
      notes: "Strong coordination and social mobilization. Critical delays in operational funds release and cold chain syringes bundling.",
      coordinates: [-14.44, 28.45],
      updatedAt: "2026-08-28T16:00:00Z",
    },
    {
      id: "ass-prov-copperbelt",
      campaignId: "campaign-mr-2026",
      tier: "tier1_national",
      milestone: "4W",
      entityId: 2,
      entityName: "Copperbelt Province",
      assessorName: "Dr. K. Mwansa (National Monitor)",
      assessorRole: "National Readiness Team Lead",
      assessmentDate: "2026-08-28",
      scores: {
        "ind-1": 8, "ind-2": 8, "ind-3": 8, "ind-4": 8, "ind-5": 5, "ind-6": 0,
        "ind-7": 5, "ind-8": 3, "ind-9": 3, "ind-10": 4, "ind-11": 5, "ind-12": 0,
        "ind-13": 5, "ind-14": 0, "ind-15": 0,
        "ind-16": 5, "ind-17": 4,
        "ind-18": 5, "ind-19": 5, "ind-20": 4,
      },
      domainScores: {
        planning: 58,
        logistics: 23,
        training: 17,
        mobilization: 45,
        supervision: 45,
      },
      compositeScore: 43,
      status: "not_ready",
      isSignedOff: false,
      notes: "High population density in Ndola and Kitwe. Cold chain maintenance needed before final dispatch.",
      coordinates: [-12.8, 28.2],
      updatedAt: "2026-08-28T16:15:00Z",
    },
    {
      id: "ass-prov-eastern",
      campaignId: "campaign-mr-2026",
      tier: "tier1_national",
      milestone: "4W",
      entityId: 3,
      entityName: "Eastern Province",
      assessorName: "P. Tembo (WHO Field Officer)",
      assessorRole: "National Readiness Team Lead",
      assessmentDate: "2026-08-29",
      scores: {
        "ind-1": 5, "ind-2": 5, "ind-3": 3, "ind-4": 4, "ind-5": 0, "ind-6": 0,
        "ind-7": 2, "ind-8": 0, "ind-9": 0, "ind-10": 2, "ind-11": 5, "ind-12": 0,
        "ind-13": 5, "ind-14": 0, "ind-15": 0,
        "ind-16": 2, "ind-17": 0,
        "ind-18": 3, "ind-19": 2, "ind-20": 2,
      },
      domainScores: {
        planning: 22,
        logistics: 9,
        training: 17,
        mobilization: 13,
        supervision: 25,
      },
      compositeScore: 18,
      status: "not_ready",
      isSignedOff: false,
      notes: "Severe delay in microplanning validation and logistics receipt across cross-border districts.",
      coordinates: [-13.63, 32.65],
      updatedAt: "2026-08-29T10:00:00Z",
    },
    {
      id: "ass-prov-lusaka",
      campaignId: "campaign-mr-2026",
      tier: "tier1_national",
      milestone: "4W",
      entityId: 4,
      entityName: "Lusaka Province",
      assessorName: "Dr. F. Zulu (EPI Specialist)",
      assessorRole: "National Readiness Team Lead",
      assessmentDate: "2026-08-29",
      scores: {
        "ind-1": 5, "ind-2": 5, "ind-3": 2, "ind-4": 2, "ind-5": 0, "ind-6": 0,
        "ind-7": 4, "ind-8": 2, "ind-9": 2, "ind-10": 2, "ind-11": 5, "ind-12": 0,
        "ind-13": 0, "ind-14": 0, "ind-15": 0,
        "ind-16": 0, "ind-17": 0,
        "ind-18": 4, "ind-19": 4, "ind-20": 3,
      },
      domainScores: {
        planning: 17,
        logistics: 21,
        training: 0,
        mobilization: 0,
        supervision: 36,
      },
      compositeScore: 19,
      status: "not_ready",
      isSignedOff: false,
      notes: "Urban resistance pockets and compound microplans not yet validated by ward development committees.",
      coordinates: [-15.42, 28.28],
      updatedAt: "2026-08-29T11:20:00Z",
    },
    {
      id: "ass-prov-luapula",
      campaignId: "campaign-mr-2026",
      tier: "tier1_national",
      milestone: "4W",
      entityId: 5,
      entityName: "Luapula Province",
      assessorName: "M. Mwila (UNICEF Officer)",
      assessorRole: "National Readiness Team Lead",
      assessmentDate: "2026-08-30",
      scores: {
        "ind-1": 8, "ind-2": 8, "ind-3": 8, "ind-4": 8, "ind-5": 8, "ind-6": 0,
        "ind-7": 8, "ind-8": 5, "ind-9": 5, "ind-10": 5, "ind-11": 10, "ind-12": 5,
        "ind-13": 10, "ind-14": 5, "ind-15": 0,
        "ind-16": 10, "ind-17": 8,
        "ind-18": 10, "ind-19": 10, "ind-20": 9,
      },
      domainScores: {
        planning: 53,
        logistics: 51,
        training: 50,
        mobilization: 88,
        supervision: 97,
      },
      compositeScore: 68,
      status: "watchlist",
      isSignedOff: true,
      notes: "High supervision readiness. Boat logistics secured for Bangweulu islands.",
      coordinates: [-11.2, 28.9],
      updatedAt: "2026-08-30T14:00:00Z",
    },
    {
      id: "ass-prov-muchinga",
      campaignId: "campaign-mr-2026",
      tier: "tier1_national",
      milestone: "4W",
      entityId: 6,
      entityName: "Muchinga Province",
      assessorName: "C. Banda (Provincial Assessor)",
      assessorRole: "National Readiness Team Lead",
      assessmentDate: "2026-08-30",
      scores: {
        "ind-1": 8, "ind-2": 8, "ind-3": 8, "ind-4": 8, "ind-5": 6, "ind-6": 0,
        "ind-7": 8, "ind-8": 8, "ind-9": 8, "ind-10": 8, "ind-11": 10, "ind-12": 0,
        "ind-13": 10, "ind-14": 0, "ind-15": 0,
        "ind-16": 5, "ind-17": 4,
        "ind-18": 10, "ind-19": 10, "ind-20": 8,
      },
      domainScores: {
        planning: 56,
        logistics: 69,
        training: 33,
        mobilization: 48,
        supervision: 93,
      },
      compositeScore: 65,
      status: "watchlist",
      isSignedOff: true,
      notes: "Logistics corridor along Great North Road in good standing. Vaccinator training kicks off next week.",
      coordinates: [-11.83, 31.45],
      updatedAt: "2026-08-30T15:30:00Z",
    },
    {
      id: "ass-prov-northern",
      campaignId: "campaign-mr-2026",
      tier: "tier1_national",
      milestone: "4W",
      entityId: 7,
      entityName: "Northern Province",
      assessorName: "Dr. T. Chisanga",
      assessorRole: "National Readiness Team Lead",
      assessmentDate: "2026-08-31",
      scores: {
        "ind-1": 7, "ind-2": 7, "ind-3": 6, "ind-4": 6, "ind-5": 5, "ind-6": 0,
        "ind-7": 5, "ind-8": 3, "ind-9": 3, "ind-10": 4, "ind-11": 6, "ind-12": 0,
        "ind-13": 5, "ind-14": 0, "ind-15": 0,
        "ind-16": 5, "ind-17": 4,
        "ind-18": 6, "ind-19": 5, "ind-20": 5,
      },
      domainScores: {
        planning: 50,
        logistics: 30,
        training: 17,
        mobilization: 46,
        supervision: 51,
      },
      compositeScore: 41,
      status: "not_ready",
      isSignedOff: false,
      notes: "Kasama central hub active but outer lake shore districts lag in cold box availability.",
      coordinates: [-9.8, 30.8],
      updatedAt: "2026-08-31T09:00:00Z",
    },
    {
      id: "ass-prov-southern",
      campaignId: "campaign-mr-2026",
      tier: "tier1_national",
      milestone: "4W",
      entityId: 8,
      entityName: "Southern Province",
      assessorName: "Dr. E. Mweemba",
      assessorRole: "National Readiness Team Lead",
      assessmentDate: "2026-08-31",
      scores: {
        "ind-1": 10, "ind-2": 10, "ind-3": 10, "ind-4": 10, "ind-5": 10, "ind-6": 5,
        "ind-7": 8, "ind-8": 6, "ind-9": 6, "ind-10": 6, "ind-11": 10, "ind-12": 5,
        "ind-13": 10, "ind-14": 5, "ind-15": 0,
        "ind-16": 5, "ind-17": 3,
        "ind-18": 10, "ind-19": 8, "ind-20": 7,
      },
      domainScores: {
        planning: 70,
        logistics: 60,
        training: 50,
        mobilization: 39,
        supervision: 83,
      },
      compositeScore: 66,
      status: "watchlist",
      isSignedOff: true,
      notes: "Livingstone and Choma ahead of schedule. Drought-affected pastoralist routes being updated.",
      coordinates: [-16.8, 27.0],
      updatedAt: "2026-08-31T12:00:00Z",
    },
    {
      id: "ass-prov-northwestern",
      campaignId: "campaign-mr-2026",
      tier: "tier1_national",
      milestone: "4W",
      entityId: 9,
      entityName: "North Western Province",
      assessorName: "G. Sitali",
      assessorRole: "National Readiness Team Lead",
      assessmentDate: "2026-09-01",
      scores: {
        "ind-1": 2, "ind-2": 2, "ind-3": 2, "ind-4": 2, "ind-5": 0, "ind-6": 0,
        "ind-7": 2, "ind-8": 1, "ind-9": 1, "ind-10": 2, "ind-11": 5, "ind-12": 0,
        "ind-13": 0, "ind-14": 0, "ind-15": 0,
        "ind-16": 2, "ind-17": 0,
        "ind-18": 4, "ind-19": 3, "ind-20": 3,
      },
      domainScores: {
        planning: 8,
        logistics: 15,
        training: 0,
        mobilization: 11,
        supervision: 35,
      },
      compositeScore: 16,
      status: "not_ready",
      isSignedOff: false,
      notes: "Critical bottleneck: Solwezi hub awaiting national vaccine dispatch; terrain requires 4x4 vehicles.",
      coordinates: [-12.2, 25.4],
      updatedAt: "2026-09-01T10:00:00Z",
    },
    {
      id: "ass-prov-western",
      campaignId: "campaign-mr-2026",
      tier: "tier1_national",
      milestone: "4W",
      entityId: 10,
      entityName: "Western Province",
      assessorName: "M. Akapelwa",
      assessorRole: "National Readiness Team Lead",
      assessmentDate: "2026-09-01",
      scores: {
        "ind-1": 2, "ind-2": 2, "ind-3": 2, "ind-4": 1, "ind-5": 0, "ind-6": 0,
        "ind-7": 1, "ind-8": 0, "ind-9": 0, "ind-10": 1, "ind-11": 5, "ind-12": 0,
        "ind-13": 0, "ind-14": 0, "ind-15": 0,
        "ind-16": 0, "ind-17": 0,
        "ind-18": 2, "ind-19": 1, "ind-20": 1,
      },
      domainScores: {
        planning: 9,
        logistics: 8,
        training: 0,
        mobilization: 0,
        supervision: 13,
      },
      compositeScore: 9,
      status: "not_ready",
      isSignedOff: false,
      notes: "Barotse plains flood recession requires canoes and riverine transport. High operational risk.",
      coordinates: [-15.3, 23.1],
      updatedAt: "2026-09-01T11:00:00Z",
    },

    // ─── Tier 2: Province Checks Districts (Central Province Districts from Sheet) ─
    {
      id: "ass-dist-kabwe",
      campaignId: "campaign-mr-2026",
      tier: "tier2_provincial",
      milestone: "4W",
      entityId: 101,
      entityName: "Kabwe District",
      parentEntityName: "Central Province",
      provinceId: 1,
      provinceName: "Central Province",
      districtId: 101,
      districtName: "Kabwe District",
      assessorName: "Sr. J. Banda (Provincial Supervisor)",
      assessorRole: "Provincial EPI Coordinator",
      assessmentDate: "2026-08-27",
      scores: {
        "ind-1": 10, "ind-2": 10, "ind-3": 10, "ind-4": 10, "ind-5": 10, "ind-6": 0,
        "ind-7": 10, "ind-8": 8, "ind-9": 8, "ind-10": 8, "ind-11": 10, "ind-12": 5,
        "ind-13": 10, "ind-14": 5, "ind-15": 5,
        "ind-16": 10, "ind-17": 10,
        "ind-18": 10, "ind-19": 10, "ind-20": 8,
      },
      domainScores: { planning: 71, logistics: 58, training: 67, mobilization: 100, supervision: 93 },
      compositeScore: 78,
      status: "watchlist",
      isSignedOff: true,
      notes: "Kabwe urban health posts completed microplanning. Awaiting provincial syringe dispatch.",
      coordinates: [-14.44, 28.45],
      updatedAt: "2026-08-27T17:00:00Z",
    },
    {
      id: "ass-dist-chibombo",
      campaignId: "campaign-mr-2026",
      tier: "tier2_provincial",
      milestone: "4W",
      entityId: 102,
      entityName: "Chibombo District",
      parentEntityName: "Central Province",
      provinceId: 1,
      provinceName: "Central Province",
      districtId: 102,
      districtName: "Chibombo District",
      assessorName: "Sr. J. Banda (Provincial Supervisor)",
      assessorRole: "Provincial EPI Coordinator",
      assessmentDate: "2026-08-27",
      scores: {
        "ind-1": 10, "ind-2": 10, "ind-3": 10, "ind-4": 10, "ind-5": 10, "ind-6": 5,
        "ind-7": 8, "ind-8": 8, "ind-9": 8, "ind-10": 8, "ind-11": 10, "ind-12": 5,
        "ind-13": 10, "ind-14": 8, "ind-15": 5,
        "ind-16": 10, "ind-17": 10,
        "ind-18": 10, "ind-19": 10, "ind-20": 10,
      },
      domainScores: { planning: 82, logistics: 68, training: 77, mobilization: 100, supervision: 100 },
      compositeScore: 84,
      status: "ready",
      isSignedOff: true,
      notes: "Cleared for campaign. Exceptional community mobilization by local headmen.",
      coordinates: [-14.65, 28.08],
      updatedAt: "2026-08-27T18:00:00Z",
    },
    {
      id: "ass-dist-chisamba",
      campaignId: "campaign-mr-2026",
      tier: "tier2_provincial",
      milestone: "4W",
      entityId: 103,
      entityName: "Chisamba District",
      parentEntityName: "Central Province",
      provinceId: 1,
      provinceName: "Central Province",
      districtId: 103,
      districtName: "Chisamba District",
      assessorName: "Sr. J. Banda (Provincial Supervisor)",
      assessorRole: "Provincial EPI Coordinator",
      assessmentDate: "2026-08-27",
      scores: {
        "ind-1": 10, "ind-2": 10, "ind-3": 10, "ind-4": 10, "ind-5": 10, "ind-6": 0,
        "ind-7": 6, "ind-8": 5, "ind-9": 5, "ind-10": 5, "ind-11": 10, "ind-12": 0,
        "ind-13": 10, "ind-14": 0, "ind-15": 0,
        "ind-16": 10, "ind-17": 8,
        "ind-18": 10, "ind-19": 10, "ind-20": 10,
      },
      domainScores: { planning: 71, logistics: 48, training: 33, mobilization: 90, supervision: 100 },
      compositeScore: 68,
      status: "watchlist",
      isSignedOff: true,
      notes: "Commercial farming belt requires evening vaccination post hours for farm workers.",
      coordinates: [-14.97, 28.32],
      updatedAt: "2026-08-27T18:30:00Z",
    },
    {
      id: "ass-dist-ngabwe",
      campaignId: "campaign-mr-2026",
      tier: "tier2_provincial",
      milestone: "4W",
      entityId: 104,
      entityName: "Ngabwe District",
      parentEntityName: "Central Province",
      provinceId: 1,
      provinceName: "Central Province",
      districtId: 104,
      districtName: "Ngabwe District",
      assessorName: "D. Mwamba (Logistics Officer)",
      assessorRole: "Provincial Cold Chain Officer",
      assessmentDate: "2026-08-28",
      scores: {
        "ind-1": 10, "ind-2": 10, "ind-3": 5, "ind-4": 10, "ind-5": 10, "ind-6": 0,
        "ind-7": 5, "ind-8": 3, "ind-9": 3, "ind-10": 4, "ind-11": 10, "ind-12": 0,
        "ind-13": 5, "ind-14": 0, "ind-15": 0,
        "ind-16": 5, "ind-17": 5,
        "ind-18": 10, "ind-19": 10, "ind-20": 7,
      },
      domainScores: { planning: 62, logistics: 38, training: 17, mobilization: 50, supervision: 90 },
      compositeScore: 54,
      status: "not_ready",
      isSignedOff: false,
      notes: "Hard-to-reach rural terrain. Kafue river crossing requires chartered pontoon.",
      coordinates: [-13.98, 27.5],
      updatedAt: "2026-08-28T11:00:00Z",
    },
    {
      id: "ass-dist-mumbwa",
      campaignId: "campaign-mr-2026",
      tier: "tier2_provincial",
      milestone: "4W",
      entityId: 105,
      entityName: "Mumbwa District",
      parentEntityName: "Central Province",
      provinceId: 1,
      provinceName: "Central Province",
      districtId: 105,
      districtName: "Mumbwa District",
      assessorName: "D. Mwamba (Logistics Officer)",
      assessorRole: "Provincial Cold Chain Officer",
      assessmentDate: "2026-08-28",
      scores: {
        "ind-1": 10, "ind-2": 10, "ind-3": 10, "ind-4": 10, "ind-5": 10, "ind-6": 0,
        "ind-7": 7, "ind-8": 5, "ind-9": 5, "ind-10": 5, "ind-11": 10, "ind-12": 0,
        "ind-13": 10, "ind-14": 0, "ind-15": 0,
        "ind-16": 10, "ind-17": 10,
        "ind-18": 10, "ind-19": 10, "ind-20": 8,
      },
      domainScores: { planning: 67, logistics: 51, training: 33, mobilization: 100, supervision: 93 },
      compositeScore: 67,
      status: "watchlist",
      isSignedOff: true,
      notes: "Mining and farming settlements along M9 corridor mapped. Training scheduled for Week 2.",
      coordinates: [-14.98, 27.06],
      updatedAt: "2026-08-28T12:30:00Z",
    },
    {
      id: "ass-dist-ithezitezhi",
      campaignId: "campaign-mr-2026",
      tier: "tier2_provincial",
      milestone: "4W",
      entityId: 106,
      entityName: "Itezhi-Tezhi District",
      parentEntityName: "Central Province",
      provinceId: 1,
      provinceName: "Central Province",
      districtId: 106,
      districtName: "Itezhi-Tezhi District",
      assessorName: "Sr. J. Banda (Provincial Supervisor)",
      assessorRole: "Provincial EPI Coordinator",
      assessmentDate: "2026-08-28",
      scores: {
        "ind-1": 5, "ind-2": 0, "ind-3": 5, "ind-4": 10, "ind-5": 10, "ind-6": 0,
        "ind-7": 6, "ind-8": 3, "ind-9": 3, "ind-10": 5, "ind-11": 10, "ind-12": 0,
        "ind-13": 5, "ind-14": 0, "ind-15": 0,
        "ind-16": 0, "ind-17": 0,
        "ind-18": 10, "ind-19": 5, "ind-20": 7,
      },
      domainScores: { planning: 54, logistics: 42, training: 17, mobilization: 0, supervision: 73 },
      compositeScore: 45,
      status: "not_ready",
      isSignedOff: false,
      notes: "Fishing camps along Lake Itezhi-Tezhi need specialized outreach strategy and fuel subsidies.",
      coordinates: [-15.75, 26.02],
      updatedAt: "2026-08-28T14:00:00Z",
    },
    {
      id: "ass-dist-shibuyunji",
      campaignId: "campaign-mr-2026",
      tier: "tier2_provincial",
      milestone: "4W",
      entityId: 107,
      entityName: "Shibuyunji District",
      parentEntityName: "Central Province",
      provinceId: 1,
      provinceName: "Central Province",
      districtId: 107,
      districtName: "Shibuyunji District",
      assessorName: "D. Mwamba (Logistics Officer)",
      assessorRole: "Provincial Cold Chain Officer",
      assessmentDate: "2026-08-28",
      scores: {
        "ind-1": 10, "ind-2": 5, "ind-3": 10, "ind-4": 10, "ind-5": 10, "ind-6": 0,
        "ind-7": 6, "ind-8": 5, "ind-9": 5, "ind-10": 5, "ind-11": 10, "ind-12": 0,
        "ind-13": 5, "ind-14": 0, "ind-15": 0,
        "ind-16": 10, "ind-17": 10,
        "ind-18": 10, "ind-19": 10, "ind-20": 10,
      },
      domainScores: { planning: 75, logistics: 51, training: 17, mobilization: 100, supervision: 100 },
      compositeScore: 71,
      status: "watchlist",
      isSignedOff: true,
      notes: "Traditional leaders fully engaged. Vaccinator training cascading on schedule.",
      coordinates: [-15.25, 27.68],
      updatedAt: "2026-08-28T15:00:00Z",
    },

    // ─── Tier 3: District Checks Health Facilities (Chibombo District Facilities) ─
    {
      id: "ass-hf-chibombo-rhc",
      campaignId: "campaign-mr-2026",
      tier: "tier3_district",
      milestone: "4W",
      entityId: 1001,
      entityName: "Chibombo Rural Health Centre",
      parentEntityName: "Chibombo District",
      provinceId: 1,
      provinceName: "Central Province",
      districtId: 102,
      districtName: "Chibombo District",
      facilityId: 1001,
      facilityName: "Chibombo Rural Health Centre",
      assessorName: "Nurse In-Charge M. Mulenga",
      assessorRole: "District Nursing Officer",
      assessmentDate: "2026-08-26",
      scores: {
        "ind-1": 10, "ind-2": 10, "ind-3": 10, "ind-4": 10, "ind-5": 10, "ind-6": 10,
        "ind-7": 10, "ind-8": 10, "ind-9": 10, "ind-10": 8, "ind-11": 10, "ind-12": 10,
        "ind-13": 10, "ind-14": 10, "ind-15": 8,
        "ind-16": 10, "ind-17": 10,
        "ind-18": 10, "ind-19": 10, "ind-20": 10,
      },
      domainScores: { planning: 100, logistics: 97, training: 93, mobilization: 100, supervision: 100 },
      compositeScore: 98,
      status: "ready",
      isSignedOff: true,
      notes: "Hub facility completely operational. Cold room verified at +4C. Safety boxes assembled.",
      coordinates: [-14.65, 28.08],
      updatedAt: "2026-08-26T16:00:00Z",
    },
    {
      id: "ass-hf-katuba-clinic",
      campaignId: "campaign-mr-2026",
      tier: "tier3_district",
      milestone: "4W",
      entityId: 1002,
      entityName: "Katuba Zonal Health Centre",
      parentEntityName: "Chibombo District",
      provinceId: 1,
      provinceName: "Central Province",
      districtId: 102,
      districtName: "Chibombo District",
      facilityId: 1002,
      facilityName: "Katuba Zonal Health Centre",
      assessorName: "Nurse In-Charge M. Mulenga",
      assessorRole: "District Nursing Officer",
      assessmentDate: "2026-08-26",
      scores: {
        "ind-1": 10, "ind-2": 10, "ind-3": 10, "ind-4": 10, "ind-5": 8, "ind-6": 5,
        "ind-7": 8, "ind-8": 8, "ind-9": 8, "ind-10": 8, "ind-11": 10, "ind-12": 8,
        "ind-13": 10, "ind-14": 8, "ind-15": 5,
        "ind-16": 10, "ind-17": 10,
        "ind-18": 10, "ind-19": 10, "ind-20": 10,
      },
      domainScores: { planning: 88, logistics: 83, training: 77, mobilization: 100, supervision: 100 },
      compositeScore: 90,
      status: "ready",
      isSignedOff: true,
      notes: "Sub-zonal teams deployed. Solar direct drive (SDD) refrigerator operational.",
      coordinates: [-14.78, 28.15],
      updatedAt: "2026-08-26T16:30:00Z",
    },
    {
      id: "ass-hf-chisamba-mission",
      campaignId: "campaign-mr-2026",
      tier: "tier3_district",
      milestone: "4W",
      entityId: 1003,
      entityName: "Chisamba Mission Hospital",
      parentEntityName: "Chisamba District",
      provinceId: 1,
      provinceName: "Central Province",
      districtId: 103,
      districtName: "Chisamba District",
      facilityId: 1003,
      facilityName: "Chisamba Mission Hospital",
      assessorName: "Dr. P. Silweya (Medical Supt)",
      assessorRole: "Clinical Director",
      assessmentDate: "2026-08-27",
      scores: {
        "ind-1": 10, "ind-2": 10, "ind-3": 8, "ind-4": 8, "ind-5": 8, "ind-6": 0,
        "ind-7": 6, "ind-8": 5, "ind-9": 5, "ind-10": 6, "ind-11": 10, "ind-12": 5,
        "ind-13": 10, "ind-14": 5, "ind-15": 0,
        "ind-16": 8, "ind-17": 6,
        "ind-18": 10, "ind-19": 8, "ind-20": 8,
      },
      domainScores: { planning: 72, logistics: 60, training: 50, mobilization: 70, supervision: 87 },
      compositeScore: 68,
      status: "watchlist",
      isSignedOff: false,
      notes: "Outreach vehicle requires clutch repair before rural mobile tour.",
      coordinates: [-14.97, 28.32],
      updatedAt: "2026-08-27T14:15:00Z",
    },
    {
      id: "ass-hf-ipongo-post",
      campaignId: "campaign-mr-2026",
      tier: "tier3_district",
      milestone: "4W",
      entityId: 1004,
      entityName: "Ipongo Outreach Post",
      parentEntityName: "Ngabwe District",
      provinceId: 1,
      provinceName: "Central Province",
      districtId: 104,
      districtName: "Ngabwe District",
      facilityId: 1004,
      facilityName: "Ipongo Outreach Post",
      assessorName: "D. Mwamba",
      assessorRole: "Field Monitor",
      assessmentDate: "2026-08-28",
      scores: {
        "ind-1": 5, "ind-2": 5, "ind-3": 5, "ind-4": 5, "ind-5": 5, "ind-6": 0,
        "ind-7": 2, "ind-8": 0, "ind-9": 0, "ind-10": 2, "ind-11": 5, "ind-12": 0,
        "ind-13": 0, "ind-14": 0, "ind-15": 0,
        "ind-16": 5, "ind-17": 4,
        "ind-18": 5, "ind-19": 5, "ind-20": 4,
      },
      domainScores: { planning: 42, logistics: 15, training: 0, mobilization: 45, supervision: 47 },
      compositeScore: 30,
      status: "not_ready",
      isSignedOff: false,
      notes: "Cold boxes not yet arrived at outreach post. Vaccinator training pending.",
      coordinates: [-13.85, 27.42],
      updatedAt: "2026-08-28T16:00:00Z",
    },
  ];
}

const DEFAULT_PROVINCES_BY_COUNTRY: Record<string, string[]> = {
  ZAF: [
    "Gauteng",
    "Western Cape",
    "KwaZulu-Natal",
    "Eastern Cape",
    "Free State",
    "Limpopo",
    "Mpumalanga",
    "North West",
    "Northern Cape",
  ],
  ZMB: [
    "Central Province",
    "Copperbelt Province",
    "Eastern Province",
    "Luapula Province",
    "Lusaka Province",
    "Muchinga Province",
    "Northern Province",
    "North-Western Province",
    "Southern Province",
    "Western Province",
  ],
  SSD: [
    "Central Equatoria",
    "Eastern Equatoria",
    "Western Equatoria",
    "Jonglei",
    "Unity",
    "Upper Nile",
    "Lakes",
    "Warrap",
    "Western Bahr el Ghazal",
    "Northern Bahr el Ghazal",
  ],
  PNG: [
    "National Capital District",
    "Morobe",
    "Eastern Highlands",
    "Western Highlands",
    "East New Britain",
    "Madang",
    "Enga",
  ],
};

const DEFAULT_DISTRICTS_BY_COUNTRY: Record<string, { name: string; province: string }[]> = {
  ZAF: [
    { name: "City of Johannesburg", province: "Gauteng" },
    { name: "City of Tshwane", province: "Gauteng" },
    { name: "Ekurhuleni", province: "Gauteng" },
    { name: "Sedibeng", province: "Gauteng" },
    { name: "West Rand", province: "Gauteng" },
    { name: "City of Cape Town", province: "Western Cape" },
    { name: "Cape Winelands", province: "Western Cape" },
    { name: "Garden Route", province: "Western Cape" },
    { name: "Overberg", province: "Western Cape" },
    { name: "eThekwini", province: "KwaZulu-Natal" },
    { name: "uMgungundlovu", province: "KwaZulu-Natal" },
    { name: "King Cetshwayo", province: "KwaZulu-Natal" },
    { name: "Nelson Mandela Bay", province: "Eastern Cape" },
    { name: "Buffalo City", province: "Eastern Cape" },
    { name: "Mangaung", province: "Free State" },
    { name: "Capricorn", province: "Limpopo" },
    { name: "Ehlanzeni", province: "Mpumalanga" },
    { name: "Bojanala Platinum", province: "North West" },
    { name: "Frances Baard", province: "Northern Cape" },
  ],
  ZMB: [
    { name: "Lusaka District", province: "Lusaka Province" },
    { name: "Ndola District", province: "Copperbelt Province" },
    { name: "Kitwe District", province: "Copperbelt Province" },
    { name: "Kabwe District", province: "Central Province" },
    { name: "Chibombo District", province: "Central Province" },
    { name: "Chipata District", province: "Eastern Province" },
    { name: "Choma District", province: "Southern Province" },
    { name: "Kasama District", province: "Northern Province" },
    { name: "Solwezi District", province: "North-Western Province" },
    { name: "Mansa District", province: "Luapula Province" },
    { name: "Mongu District", province: "Western Province" },
    { name: "Chinsali District", province: "Muchinga Province" },
  ],
  SSD: [
    { name: "Juba County", province: "Central Equatoria" },
    { name: "Yei County", province: "Central Equatoria" },
    { name: "Torit County", province: "Eastern Equatoria" },
    { name: "Bor County", province: "Jonglei" },
    { name: "Malakal County", province: "Upper Nile" },
    { name: "Wau County", province: "Western Bahr el Ghazal" },
  ],
};

function generateTenantInitialAssessments(
  countryCode: string,
  provincesList: Province[] = [],
  districtsList: District[] = [],
  facilitiesList: Facility[] = []
): AssessmentRecord[] {
  const code = (countryCode || "ZAF").toUpperCase();
  const records: AssessmentRecord[] = [];

  const provNames =
    provincesList.length > 0
      ? provincesList.map((p) => ({ id: p.id, name: p.name }))
      : (DEFAULT_PROVINCES_BY_COUNTRY[code] || DEFAULT_PROVINCES_BY_COUNTRY.ZAF).map((name, i) => ({ id: i + 1, name }));

  const getPresetScore = (name: string, domainIdx: number): number => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const pseudo = Math.abs((hash + domainIdx * 17) % 100);
    return Math.min(10, Math.max(3, Math.round((55 + (pseudo % 42)) / 10)));
  };

  // 1. Tier 1: National Checks Provinces
  provNames.forEach((prov, idx) => {
    const scores: Record<string, number> = {};
    READINESS_INDICATORS.forEach((ind, iIdx) => {
      scores[ind.id] = getPresetScore(prov.name, iIdx + (idx % 3));
    });
    const { domainScores, compositeScore, status } = calculateScoresFromRaw(scores);
    records.push({
      id: `ass-prov-${prov.id}-${code.toLowerCase()}`,
      campaignId: "campaign-mr-2026",
      tier: "tier1_national",
      milestone: "4W",
      entityId: prov.id,
      entityName: prov.name,
      provinceId: prov.id,
      provinceName: prov.name,
      assessorName: "National Readiness Oversight Team",
      assessorRole: "National EPI Manager",
      assessmentDate: "2026-08-28",
      scores,
      domainScores,
      compositeScore,
      status,
      isSignedOff: compositeScore >= 80,
      notes: `${prov.name} provincial readiness evaluated against WHO Week 4 milestones.`,
      updatedAt: new Date().toISOString(),
    });
  });

  // 2. Tier 2: Province Checks Districts
  const distItems: { id: number | string; name: string; provinceId?: number; provinceName: string }[] = [];
  if (districtsList.length > 0) {
    districtsList.forEach((d) => {
      const p = provincesList.find((prov) => prov.id === d.provinceId);
      distItems.push({
        id: d.id,
        name: d.name,
        provinceId: d.provinceId ?? undefined,
        provinceName: p ? p.name : "Province",
      });
    });
  } else {
    const defaults = DEFAULT_DISTRICTS_BY_COUNTRY[code] || DEFAULT_DISTRICTS_BY_COUNTRY.ZAF;
    defaults.forEach((d, i) => {
      const p = provNames.find((pn) => pn.name.toLowerCase().includes(d.province.toLowerCase())) || provNames[0];
      distItems.push({
        id: 100 + i + 1,
        name: d.name,
        provinceId: p ? p.id : 1,
        provinceName: d.province,
      });
    });
  }

  distItems.forEach((dist, idx) => {
    const scores: Record<string, number> = {};
    READINESS_INDICATORS.forEach((ind, iIdx) => {
      scores[ind.id] = getPresetScore(dist.name, iIdx + (idx % 5));
    });
    const { domainScores, compositeScore, status } = calculateScoresFromRaw(scores);
    records.push({
      id: `ass-dist-${dist.id}-${code.toLowerCase()}`,
      campaignId: "campaign-mr-2026",
      tier: "tier2_provincial",
      milestone: "4W",
      entityId: dist.id,
      entityName: dist.name,
      parentEntityName: dist.provinceName,
      provinceId: dist.provinceId,
      provinceName: dist.provinceName,
      districtId: typeof dist.id === "number" ? dist.id : undefined,
      districtName: dist.name,
      assessorName: "Provincial Field Supervisory Team",
      assessorRole: "Provincial EPI Coordinator",
      assessmentDate: "2026-08-27",
      scores,
      domainScores,
      compositeScore,
      status,
      isSignedOff: compositeScore >= 80,
      notes: `${dist.name} operational planning, cold chain logistics, and training rosters audited.`,
      updatedAt: new Date().toISOString(),
    });
  });

  // 3. Tier 3: District Checks Facilities
  if (facilitiesList.length > 0) {
    facilitiesList.slice(0, 30).forEach((fac, idx) => {
      const d = districtsList.find((dist) => dist.id === fac.districtId);
      const p = d ? provincesList.find((prov) => prov.id === d.provinceId) : undefined;
      const scores: Record<string, number> = {};
      READINESS_INDICATORS.forEach((ind, iIdx) => {
        scores[ind.id] = getPresetScore(fac.name, iIdx + (idx % 4));
      });
      const { domainScores, compositeScore, status } = calculateScoresFromRaw(scores);
      records.push({
        id: `ass-hf-${fac.id}-${code.toLowerCase()}`,
        campaignId: "campaign-mr-2026",
        tier: "tier3_district",
        milestone: "4W",
        entityId: fac.id,
        entityName: fac.name,
        parentEntityName: d ? d.name : "District",
        provinceId: d ? d.provinceId : null,
        provinceName: p ? p.name : undefined,
        districtId: fac.districtId,
        districtName: d ? d.name : undefined,
        facilityId: fac.id,
        facilityName: fac.name,
        assessorName: "District Cold Chain Supervisor",
        assessorRole: "District Nursing Officer",
        assessmentDate: "2026-08-26",
        scores,
        domainScores,
        compositeScore,
        status,
        isSignedOff: compositeScore >= 80,
        notes: `Health facility vaccine storage, cold chain integrity, and team mobilization verified.`,
        updatedAt: new Date().toISOString(),
      });
    });
  }

  return records;
}

function generateTenantInitialActions(
  countryCode: string,
  provincesList: Province[] = [],
  districtsList: District[] = []
): CorrectiveActionItem[] {
  const code = (countryCode || "ZAF").toUpperCase();
  const provName1 = provincesList[0]?.name || (code === "ZAF" ? "Gauteng" : "Central Province");
  const provName2 = provincesList[1]?.name || (code === "ZAF" ? "Western Cape" : "Copperbelt Province");
  const distName1 = districtsList[0]?.name || (code === "ZAF" ? "City of Johannesburg" : "Lusaka District");
  const distName2 = districtsList[1]?.name || (code === "ZAF" ? "City of Cape Town" : "Ndola District");
  const distName3 = districtsList[2]?.name || (code === "ZAF" ? "eThekwini" : "Chipata District");

  return [
    {
      id: `act-1-${code.toLowerCase()}`,
      assessmentId: `ass-prov-1-${code.toLowerCase()}`,
      entityName: provName1,
      domain: "Planning, Coordination & Financing",
      issue: "Operational funds disbursement tranche 1 pending final release to local sub-depots.",
      actionRequired: "Escalate to National Treasury and MoH Finance Unit for immediate transfer confirmation.",
      responsiblePerson: "National Readiness Team Lead",
      deadline: "2026-09-05",
      status: "in_progress",
      priority: "high",
    },
    {
      id: `act-2-${code.toLowerCase()}`,
      assessmentId: `ass-prov-2-${code.toLowerCase()}`,
      entityName: provName2,
      domain: "Vaccine, Cold Chain & Logistics",
      issue: "Safety boxes and AD syringes need final bundling check with vaccine consignment.",
      actionRequired: "Dispatch safety boxes and AD syringes from central medical stores to sub-depot.",
      responsiblePerson: "Logistics Focal Person",
      deadline: "2026-09-08",
      status: "open",
      priority: "high",
    },
    {
      id: `act-3-${code.toLowerCase()}`,
      assessmentId: `ass-dist-1-${code.toLowerCase()}`,
      entityName: distName1,
      domain: "Vaccine, Cold Chain & Logistics",
      issue: "Outreach vehicle fleet requires maintenance check and fuel allocation.",
      actionRequired: "Contract local transport support and preposition fuel vouchers for field teams.",
      responsiblePerson: "District Health Director",
      deadline: "2026-09-10",
      status: "in_progress",
      priority: "high",
    },
    {
      id: `act-4-${code.toLowerCase()}`,
      assessmentId: `ass-dist-2-${code.toLowerCase()}`,
      entityName: distName2,
      domain: "Social Mobilisation & Communication",
      issue: "Community awareness campaigns in informal and mobile settlements require intensified local media.",
      actionRequired: "Engage community radio broadcasts, town criers, and civic leadership forums.",
      responsiblePerson: "Health Promotion Officer",
      deadline: "2026-09-07",
      status: "open",
      priority: "medium",
    },
    {
      id: `act-5-${code.toLowerCase()}`,
      assessmentId: `ass-dist-3-${code.toLowerCase()}`,
      entityName: distName3,
      domain: "Training & Human Resources",
      issue: "Vaccinator refresher training roster has 15% pending confirmation from peripheral clinics.",
      actionRequired: "Follow up with facility in-charges and finalize standby vaccinator pool.",
      responsiblePerson: "Training Coordinator",
      deadline: "2026-09-09",
      status: "open",
      priority: "high",
    },
  ];
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CampaignReadiness() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Super User Check
  const userRole = user?.role;
  const isSuperUser =
    (user as any)?.isPlatformAdmin === true ||
    userRole === "national_admin" ||
    (Array.isArray((user as any)?.roles) && (user as any).roles.includes("national_admin")) ||
    userRole === "provincial_coordinator" ||
    userRole === "district_manager";

  // Tenant & Geographic Queries (Country Isolation & Scoping)
  const { data: tenant } = useQuery<TenantLike>({
    queryKey: ["/api/me/tenant"],
  });
  const countryCode = (tenant?.countryCode || "ZAF").toUpperCase();
  const countryName =
    (tenant as any)?.countryName ||
    (tenant as any)?.name ||
    (countryCode === "ZAF" ? "Republic of South Africa" : "Zambia");

  const { data: provinces = [] } = useQuery<Province[]>({
    queryKey: ["/api/provinces"],
  });
  const { data: districts = [] } = useQuery<District[]>({
    queryKey: ["/api/districts"],
  });
  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });

  const storageKeyAssessments = `vaxplan.campaign_readiness_assessments.${countryCode.toLowerCase()}.v2`;
  const storageKeyActions = `vaxplan.campaign_readiness_actions.${countryCode.toLowerCase()}.v2`;

  // Data State (Tenant-aware & Seeded)
  const [assessments, setAssessments] = useState<AssessmentRecord[]>(() => {
    try {
      const key = `vaxplan.campaign_readiness_assessments.${(tenant?.countryCode || "zaf").toLowerCase()}.v2`;
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Could not load stored assessments:", e);
    }
    return generateTenantInitialAssessments(countryCode, provinces, districts, facilities);
  });

  const [actions, setActions] = useState<CorrectiveActionItem[]>(() => {
    try {
      const key = `vaxplan.campaign_readiness_actions.${(tenant?.countryCode || "zaf").toLowerCase()}.v2`;
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Could not load stored action items:", e);
    }
    return generateTenantInitialActions(countryCode, provinces, districts);
  });

  // Re-sync data when country or entities change
  useEffect(() => {
    if (!countryCode) return;
    try {
      const stored = localStorage.getItem(storageKeyAssessments);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAssessments(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn("Could not reload assessments for tenant:", e);
    }
    const fresh = generateTenantInitialAssessments(countryCode, provinces, districts, facilities);
    setAssessments(fresh);
  }, [countryCode, provinces.length, districts.length, facilities.length, storageKeyAssessments]);

  useEffect(() => {
    if (!countryCode) return;
    try {
      const stored = localStorage.getItem(storageKeyActions);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActions(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn("Could not reload actions for tenant:", e);
    }
    const fresh = generateTenantInitialActions(countryCode, provinces, districts);
    setActions(fresh);
  }, [countryCode, provinces.length, districts.length, storageKeyActions]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKeyAssessments, JSON.stringify(assessments));
    } catch (e) {
      console.warn("Could not save assessments to storage:", e);
    }
  }, [assessments, storageKeyAssessments]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKeyActions, JSON.stringify(actions));
    } catch (e) {
      console.warn("Could not save actions to storage:", e);
    }
  }, [actions, storageKeyActions]);

  // Interactive Map Cross-Filter State
  const [mapCategoryFilter, setMapCategoryFilter] = useState<string>("ALL");
  const [selectedMapEntityId, setSelectedMapEntityId] = useState<number | string | null>(null);

  // Main UI Filter State
  const [activeTab, setActiveTab] = useState<"dashboard" | "checklist" | "actions">("dashboard");
  const [selectedTier, setSelectedTier] = useState<AssessmentTier>("tier1_national");
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneTimeline>("4W");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("campaign-mr-2026");

  // Geographic Cascade Picker State (Golden Rule)
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

  // Drill-Down Modal State (Clickable KPI Cards)
  const [drilldownModal, setDrilldownModal] = useState<"overall" | "ready" | "watchlist" | "bottlenecks" | null>(null);
  const [viewAssessmentDetail, setViewAssessmentDetail] = useState<AssessmentRecord | null>(null);

  // Benchmark Config Dialog State (Super Users)
  const [benchmarkDialogOpen, setBenchmarkDialogOpen] = useState(false);
  const [readyThreshold, setReadyThreshold] = useState<number>(80);
  const [watchlistThreshold, setWatchlistThreshold] = useState<number>(60);

  // Action Creator Dialog State
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [newActionTarget, setNewActionTarget] = useState("");
  const [newActionDomain, setNewActionDomain] = useState("Planning, Coordination & Financing");
  const [newActionIssue, setNewActionIssue] = useState("");
  const [newActionRequired, setNewActionRequired] = useState("");
  const [newActionPerson, setNewActionPerson] = useState("");
  const [newActionDeadline, setNewActionDeadline] = useState("");
  const [newActionPriority, setNewActionPriority] = useState<"high" | "medium" | "low">("high");

  // Checklist Form State (Data Collection Tool)
  const [checklistTier, setChecklistTier] = useState<AssessmentTier>("tier2_provincial");
  const [checklistMilestone, setChecklistMilestone] = useState<MilestoneTimeline>("4W");
  const [checklistAssessorName, setChecklistAssessorName] = useState(
    (user as any)?.displayName || (user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Field Supervisor")
  );
  const [checklistAssessorRole, setChecklistAssessorRole] = useState("Readiness Evaluator");
  const [checklistDate, setChecklistDate] = useState("2026-09-12");
  const [checklistEntityName, setChecklistEntityName] = useState("Kabwe District");
  const [checklistParentName, setChecklistParentName] = useState("Central Province");
  const [checklistScores, setChecklistScores] = useState<Record<string, number>>(() => {
    const s: Record<string, number> = {};
    READINESS_INDICATORS.forEach((i) => {
      s[i.id] = 5;
    });
    return s;
  });
  const [checklistNotes, setChecklistNotes] = useState("");

  // Live Calculations for Checklist Form
  const checklistCalculated = useMemo(() => {
    return calculateScoresFromRaw(checklistScores);
  }, [checklistScores]);

  const handleScoreChange = (indicatorId: string, val: number) => {
    setChecklistScores((prev) => ({
      ...prev,
      [indicatorId]: val,
    }));
  };

  const handleSaveChecklist = (signOff: boolean) => {
    const newRecord: AssessmentRecord = {
      id: `ass-${Date.now()}`,
      campaignId: selectedCampaignId,
      tier: checklistTier,
      milestone: checklistMilestone,
      entityId: Date.now(),
      entityName: checklistEntityName || "Assessed Unit",
      parentEntityName: checklistParentName,
      provinceId: selectedProvinceId,
      provinceName: selectedProvinceId ? `Province #${selectedProvinceId}` : undefined,
      districtId: selectedDistrictId,
      districtName: selectedDistrictId ? `District #${selectedDistrictId}` : undefined,
      facilityId: selectedFacilityId,
      facilityName: selectedFacility?.name,
      assessorName: checklistAssessorName,
      assessorRole: checklistAssessorRole,
      assessmentDate: checklistDate,
      scores: checklistScores,
      domainScores: checklistCalculated.domainScores,
      compositeScore: checklistCalculated.compositeScore,
      status: checklistCalculated.status,
      isSignedOff: signOff,
      notes: checklistNotes,
      updatedAt: new Date().toISOString(),
    };

    setAssessments((prev) => [newRecord, ...prev]);
    toast({
      title: signOff ? "Readiness Assessment Signed Off" : "Draft Assessment Saved",
      description: `${newRecord.entityName} readiness evaluated at ${newRecord.compositeScore}% (${newRecord.status.toUpperCase()}).`,
    });
    setActiveTab("dashboard");
  };

  // Filtered Assessments for Dashboard and Tables
  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      if (a.campaignId !== selectedCampaignId) return false;
      if (selectedTier && a.tier !== selectedTier) return false;
      if (selectedMilestone && a.milestone !== selectedMilestone) return false;
      if (selectedProvinceId && a.provinceId && a.provinceId !== selectedProvinceId) return false;
      if (selectedDistrictId && a.districtId && a.districtId !== selectedDistrictId) return false;
      if (selectedFacilityId && a.facilityId && a.facilityId !== selectedFacilityId) return false;
      return true;
    });
  }, [
    assessments,
    selectedCampaignId,
    selectedTier,
    selectedMilestone,
    selectedProvinceId,
    selectedDistrictId,
    selectedFacilityId,
  ]);

  // Aggregate Metrics for KPI Cards
  const kpiStats = useMemo(() => {
    const total = filteredAssessments.length;
    if (total === 0) {
      return {
        avgScore: 0,
        readyCount: 0,
        watchlistCount: 0,
        bottleneckCount: 0,
        domainAverages: { planning: 0, logistics: 0, training: 0, mobilization: 0, supervision: 0 },
      };
    }

    let scoreSum = 0;
    let readyCount = 0;
    let watchlistCount = 0;
    let bottleneckCount = 0;

    const domainSums: Record<string, number> = {
      planning: 0,
      logistics: 0,
      training: 0,
      mobilization: 0,
      supervision: 0,
    };

    filteredAssessments.forEach((a) => {
      scoreSum += a.compositeScore;
      if (a.compositeScore >= readyThreshold) readyCount++;
      else if (a.compositeScore >= watchlistThreshold) watchlistCount++;
      else bottleneckCount++;

      Object.keys(domainSums).forEach((d) => {
        domainSums[d] += a.domainScores[d] || 0;
      });
    });

    const domainAverages: Record<string, number> = {};
    Object.keys(domainSums).forEach((d) => {
      domainAverages[d] = Math.round(domainSums[d] / total);
    });

    return {
      avgScore: Math.round(scoreSum / total),
      readyCount,
      watchlistCount,
      bottleneckCount,
      domainAverages,
    };
  }, [filteredAssessments, readyThreshold, watchlistThreshold]);

  // Radar Chart Data for 5 Domains
  const radarChartData = useMemo(() => {
    return READINESS_DOMAINS.map((d) => ({
      domain: d.name.split(" ")[0], // Short name
      fullName: d.name,
      score: kpiStats.domainAverages[d.id] || 0,
      fullMark: 100,
    }));
  }, [kpiStats]);

  // Timeline Trajectory Mock Comparison (12W, 8W, 4W, 2W, 1W)
  const trajectoryData = [
    { milestone: "12W", target: 35, actual: 32, note: "Initial Planning" },
    { milestone: "8W", target: 55, actual: 48, note: "Microplan Validation" },
    { milestone: "4W (Current)", target: 75, actual: kpiStats.avgScore, note: "Week 4 Readiness Assessment" },
    { milestone: "2W", target: 90, actual: null, note: "Logistics Arrival" },
    { milestone: "1W", target: 100, actual: null, note: "Final Deployment Sign-Off" },
    { milestone: "D-1", target: 100, actual: null, note: "Go / No-Go Confirmation" },
  ];

  // League Table State (Rule 24 Enterprise-Grade Table)
  const [tableSearch, setTableSearch] = useState("");
  const [tableSortKey, setTableSortKey] = useState<string>("compositeScore");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("desc");
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);
  const [visibleColumns, setVisibleColumns] = useState({
    entity: true,
    tier: true,
    planning: true,
    logistics: true,
    training: true,
    mobilization: true,
    supervision: true,
    score: true,
    status: true,
    signedOff: true,
  });

  const searchedAssessments = useMemo(() => {
    let list = filteredAssessments;
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      list = list.filter(
        (a) =>
          a.entityName.toLowerCase().includes(q) ||
          (a.parentEntityName && a.parentEntityName.toLowerCase().includes(q)) ||
          a.assessorName.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      let valA: any = (a as any)[tableSortKey];
      let valB: any = (b as any)[tableSortKey];

      if (tableSortKey in a.domainScores) {
        valA = a.domainScores[tableSortKey] ?? 0;
        valB = b.domainScores[tableSortKey] ?? 0;
      }

      if (typeof valA === "string") {
        return tableSortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return tableSortDir === "asc" ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [filteredAssessments, tableSearch, tableSortKey, tableSortDir]);

  const totalPages = Math.max(1, Math.ceil(searchedAssessments.length / tablePageSize));
  const paginatedAssessments = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return searchedAssessments.slice(start, start + tablePageSize);
  }, [searchedAssessments, tablePage, tablePageSize]);

  // Export to CSV Functionality
  const handleExportCSV = () => {
    const headers = [
      "Entity Name",
      "Assessment Tier",
      "Milestone",
      "Parent Entity",
      "Planning (%)",
      "Logistics (%)",
      "Training (%)",
      "Social Mobilization (%)",
      "Supervision (%)",
      "Composite Readiness Score (%)",
      "Readiness Status",
      "Signed Off",
      "Assessor",
      "Date",
    ];

    const rows = searchedAssessments.map((a) => [
      `"${a.entityName}"`,
      `"${a.tier}"`,
      `"${a.milestone}"`,
      `"${a.parentEntityName || ""}"`,
      a.domainScores.planning || 0,
      a.domainScores.logistics || 0,
      a.domainScores.training || 0,
      a.domainScores.mobilization || 0,
      a.domainScores.supervision || 0,
      a.compositeScore,
      `"${a.status}"`,
      a.isSignedOff ? "Yes" : "No",
      `"${a.assessorName}"`,
      `"${a.assessmentDate}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SIA_Readiness_${selectedTier}_${selectedMilestone}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Export Complete",
      description: `Exported ${searchedAssessments.length} readiness assessment rows to CSV.`,
    });
  };

  // Add Action Item Handler
  const handleCreateAction = () => {
    if (!newActionTarget || !newActionIssue || !newActionRequired) {
      toast({
        title: "Incomplete Action Item",
        description: "Please specify target unit, issue, and corrective action.",
        variant: "destructive",
      });
      return;
    }

    const item: CorrectiveActionItem = {
      id: `act-${Date.now()}`,
      assessmentId: "manual",
      entityName: newActionTarget,
      domain: newActionDomain,
      issue: newActionIssue,
      actionRequired: newActionRequired,
      responsiblePerson: newActionPerson || "Unassigned",
      deadline: newActionDeadline || "2026-09-15",
      status: "open",
      priority: newActionPriority,
    };

    setActions((prev) => [item, ...prev]);
    setActionDialogOpen(false);
    setNewActionTarget("");
    setNewActionIssue("");
    setNewActionRequired("");
    setNewActionPerson("");
    toast({
      title: "Corrective Action Logged",
      description: `Action item assigned to ${item.responsiblePerson}.`,
    });
  };

  const handleToggleActionStatus = (id: string) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const nextStatus = a.status === "open" ? "in_progress" : a.status === "in_progress" ? "resolved" : "open";
          return { ...a, status: nextStatus };
        }
        return a;
      })
    );
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      {/* ─── Top Header & Controls ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Radio className="h-8 w-8 text-primary animate-pulse" />
              SIA Campaign Operational Readiness
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
              WHO / UNICEF Standard
            </Badge>
            {isSuperUser && (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                Super User Mode
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Hierarchical Pre-SIA Readiness Assessment across 3 Tiers (National → Province → District → Health Facility)
            monitoring the 5 core WHO operational domains.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>

          {isSuperUser && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBenchmarkDialogOpen(true)}
              className="flex items-center gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Configure Benchmarks
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => {
              setActiveTab("checklist");
            }}
            className="flex items-center gap-1.5 shadow-sm bg-primary text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            New Assessment
          </Button>
        </div>
      </div>

      {/* ─── Multi-Tier Level Switcher & Smart Cascade Filter (Golden Rule) ── */}
      <Card className="border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Tier Switcher */}
            <div className="space-y-1.5 w-full lg:w-auto">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Readiness Evaluation Tier (2-3 Levels)
              </Label>
              <div className="grid grid-cols-3 gap-1 bg-muted/60 p-1 rounded-lg border border-border/40">
                <Button
                  size="sm"
                  variant={selectedTier === "tier1_national" ? "default" : "ghost"}
                  onClick={() => setSelectedTier("tier1_national")}
                  className="text-xs font-medium h-8"
                >
                  1. National → Provinces
                </Button>
                <Button
                  size="sm"
                  variant={selectedTier === "tier2_provincial" ? "default" : "ghost"}
                  onClick={() => setSelectedTier("tier2_provincial")}
                  className="text-xs font-medium h-8"
                >
                  2. Province → Districts
                </Button>
                <Button
                  size="sm"
                  variant={selectedTier === "tier3_district" ? "default" : "ghost"}
                  onClick={() => setSelectedTier("tier3_district")}
                  className="text-xs font-medium h-8"
                >
                  3. District → HFs
                </Button>
              </div>
            </div>

            {/* Milestone Selector */}
            <div className="space-y-1.5 w-full lg:w-auto">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Milestone Timeline
              </Label>
              <Select
                value={selectedMilestone}
                onValueChange={(val) => setSelectedMilestone(val as MilestoneTimeline)}
              >
                <SelectTrigger className="h-8 text-xs font-medium w-full sm:w-[220px]">
                  <SelectValue placeholder="Select Milestone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12W">12W (Planning &amp; ICC Launch)</SelectItem>
                  <SelectItem value="8W">8W (Budget &amp; Microplans)</SelectItem>
                  <SelectItem value="4W">4W (Week 4 Assessment - Current)</SelectItem>
                  <SelectItem value="2W">2W (Syringes &amp; Social Mobilization)</SelectItem>
                  <SelectItem value="1W">1W (Final Deployment &amp; RCM)</SelectItem>
                  <SelectItem value="D-1">D-1 (Go / No-Go Confirmation)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Campaign Selection */}
            <div className="space-y-1.5 w-full lg:w-auto">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target SIA Campaign
              </Label>
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger className="h-8 text-xs font-medium w-full sm:w-[260px]">
                  <SelectValue placeholder="Select Campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="campaign-mr-2026">2026 Measles-Rubella SIA (National)</SelectItem>
                  <SelectItem value="campaign-ichd-2026">ICHD Multi-Antigen Round 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Smart-Searchable Cascading Location Picker (Golden Rule) */}
          <div className="border-t border-border/40 pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Filter by Administrative Hierarchy (Smart-Searchable Cascade):
              </Label>
              {(selectedProvinceId || selectedDistrictId || selectedFacilityId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedProvinceId(null);
                    setSelectedDistrictId(null);
                    setSelectedFacilityId(null);
                    setSelectedFacility(null);
                  }}
                  className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                >
                  Clear Filters
                </Button>
              )}
            </div>

            <FacilityCascadePicker
              value={selectedFacilityId}
              onChange={(fid, fac) => {
                setSelectedFacilityId(fid);
                setSelectedFacility(fac);
                if (fac) {
                  setSelectedDistrictId(fac.districtId);
                }
              }}
              onDistrictChange={(did) => setSelectedDistrictId(did)}
              layout="row"
              showLabels={false}
              provinceLabel="All Provinces"
              districtLabel="All Districts"
              facilityLabel="All Facilities"
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Main Tabs Navigation ─────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-lg mb-4">
          <TabsTrigger value="dashboard" className="text-xs md:text-sm flex items-center gap-1.5">
            <Activity className="h-4 w-4" />
            Readiness Dashboard
          </TabsTrigger>
          <TabsTrigger value="checklist" className="text-xs md:text-sm flex items-center gap-1.5">
            <ClipboardCheck className="h-4 w-4" />
            Checklist Tool
          </TabsTrigger>
          <TabsTrigger value="actions" className="text-xs md:text-sm flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Bottleneck Actions
            {actions.filter((a) => a.status !== "resolved").length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px] h-4">
                {actions.filter((a) => a.status !== "resolved").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: READINESS DASHBOARD                                          */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* 4 Clickable Summary Cards with Drilldown Dialogs (Golden Rule) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Overall Readiness Index */}
            <Card
              className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 group"
              onClick={() => setDrilldownModal("overall")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary">
                  Overall Readiness Index
                </CardTitle>
                <Radio className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-baseline gap-2">
                  <span>{kpiStats.avgScore}%</span>
                  <Badge
                    variant="outline"
                    className={
                      kpiStats.avgScore >= readyThreshold
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : kpiStats.avgScore >= watchlistThreshold
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        : "bg-red-500/10 text-red-600 border-red-500/20"
                    }
                  >
                    {kpiStats.avgScore >= readyThreshold
                      ? "Ready"
                      : kpiStats.avgScore >= watchlistThreshold
                      ? "Watchlist"
                      : "Critical Lag"}
                  </Badge>
                </div>
                <Progress
                  value={kpiStats.avgScore}
                  className="h-1.5 mt-2 bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-2 flex items-center justify-between">
                  <span>Target Benchmark: &gt;={readyThreshold}%</span>
                  <span className="text-[10px] text-primary underline">Click to drill down</span>
                </p>
              </CardContent>
            </Card>

            {/* Card 2: Units Ready (>= 80%) */}
            <Card
              className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-emerald-500/50 group"
              onClick={() => setDrilldownModal("ready")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-emerald-600">
                  Ready Units (&gt;={readyThreshold}%)
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 flex items-baseline gap-2">
                  <span>{kpiStats.readyCount}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    / {filteredAssessments.length} evaluated
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {filteredAssessments.length > 0
                    ? `${Math.round((kpiStats.readyCount / filteredAssessments.length) * 100)}% of administrative units cleared`
                    : "No evaluations"}
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center justify-between">
                  <span className="text-emerald-600">Green Status</span>
                  <span className="text-[10px] text-primary underline">Click to drill down</span>
                </p>
              </CardContent>
            </Card>

            {/* Card 3: Watchlist Units (60 - 79%) */}
            <Card
              className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-amber-500/50 group"
              onClick={() => setDrilldownModal("watchlist")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-amber-600">
                  Watchlist Units ({watchlistThreshold}-{readyThreshold - 1}%)
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600 flex items-baseline gap-2">
                  <span>{kpiStats.watchlistCount}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    / {filteredAssessments.length} units
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Substantial progress but require targeted logistical push
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center justify-between">
                  <span className="text-amber-600">Amber Status</span>
                  <span className="text-[10px] text-primary underline">Click to drill down</span>
                </p>
              </CardContent>
            </Card>

            {/* Card 4: Critical Bottlenecks (< 60%) */}
            <Card
              className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-red-500/50 group"
              onClick={() => setDrilldownModal("bottlenecks")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-red-600">
                  Critical Bottlenecks (&lt;{watchlistThreshold}%)
                </CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 flex items-baseline gap-2">
                  <span>{kpiStats.bottleneckCount}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    high risk units
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Risk of halting or delaying campaign start date
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center justify-between">
                  <span className="text-red-600">Red Status</span>
                  <span className="text-[10px] text-primary underline">Click to drill down</span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ─── Interactive Map & Domain Radar View ──────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Enterprise-Grade Geographic Readiness Map (Shaded Choropleth + HFs Pins Only) */}
            <div className="lg:col-span-2">
              <ReadinessChoroplethMap
                countryCode={countryCode}
                countryName={countryName}
                adminLevelLabel={
                  selectedTier === "tier1_national"
                    ? "Province"
                    : selectedTier === "tier2_provincial"
                    ? "District"
                    : "Health Facility"
                }
                assessments={filteredAssessments}
                facilities={facilities}
                selectedCategoryFilter={mapCategoryFilter}
                onSelectCategoryFilter={setMapCategoryFilter}
                selectedEntityId={selectedMapEntityId}
                onSelectEntity={(item) => setSelectedMapEntityId(item ? item.entityId : null)}
                readyThreshold={readyThreshold}
                watchlistThreshold={watchlistThreshold}
                selectedTier={selectedTier}
                selectedCampaignName={
                  selectedCampaignId === "campaign-mr-2026"
                    ? "2026 Measles-Rubella SIA"
                    : "ICHD Multi-Antigen Round 2"
                }
                onViewAssessmentDetail={(item) => setViewAssessmentDetail(item)}
              />
            </div>

            {/* Radar Chart: 5 Operational Domains (1 Col) */}
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  5 Core WHO Functional Domains
                </CardTitle>
                <CardDescription className="text-xs">
                  Readiness balance across planning, cold chain, training, communications &amp; supervision.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarChartData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="domain" tick={{ fontSize: 10, fill: "#64748b" }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" />
                      <Radar
                        name="Average Score (%)"
                        dataKey="score"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.4}
                      />
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover text-popover-foreground p-2 rounded shadow border text-xs">
                              <p className="font-semibold">{data.fullName}</p>
                              <p className="text-primary font-bold">{data.score}% ready</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t text-xs">
                  {READINESS_DOMAINS.map((d) => (
                    <div key={d.id} className="flex items-center justify-between">
                      <span className="truncate text-muted-foreground">{d.name.split(" ")[0]}:</span>
                      <span className="font-semibold">{kpiStats.domainAverages[d.id] || 0}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Trajectory Chart & Unit Comparison Chart ─────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Timeline Trajectory */}
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Timeline Countdown &amp; Trajectory (Target vs Actual)
                </CardTitle>
                <CardDescription className="text-xs">
                  Readiness progression against WHO pre-campaign milestones (12W to D-1).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trajectoryData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="milestone" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="target"
                        name="WHO Recommended Target (%)"
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        name="Assessed Readiness (%)"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 5, fill: "#2563eb" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Week 4 milestone requires min. 75% readiness. National average currently tracks at {kpiStats.avgScore}%.
                </p>
              </CardContent>
            </Card>

            {/* Readiness League Ranking Bar Chart */}
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Administrative Units Readiness Ranking
                </CardTitle>
                <CardDescription className="text-xs">
                  Comparative performance of evaluated units in current tier ({selectedTier.replace("_", " ").toUpperCase()}).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={searchedAssessments.slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="entityName"
                        tick={{ fontSize: 10 }}
                        width={90}
                      />
                      <Tooltip />
                      <Bar dataKey="compositeScore" name="Readiness Score (%)" radius={[0, 4, 4, 0]}>
                        {searchedAssessments.slice(0, 10).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.compositeScore >= readyThreshold
                                ? "#10b981"
                                : entry.compositeScore >= watchlistThreshold
                                ? "#f59e0b"
                                : "#ef4444"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Enterprise League Table (Rule 24 Compliant) ───────────────── */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    Readiness League Table &amp; Functional Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comprehensive enterprise league table with sortable columns, domain metrics, and drilldown audit trails.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search unit or assessor..."
                      value={tableSearch}
                      onChange={(e) => {
                        setTableSearch(e.target.value);
                        setTablePage(1);
                      }}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>

                  {/* Column Visibility Selector */}
                  <Select
                    onValueChange={(col) => {
                      setVisibleColumns((prev) => ({
                        ...prev,
                        [col]: !prev[col as keyof typeof prev],
                      }));
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-[130px]">
                      <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                      <span>Columns</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Toggle Planning</SelectItem>
                      <SelectItem value="logistics">Toggle Logistics</SelectItem>
                      <SelectItem value="training">Toggle Training</SelectItem>
                      <SelectItem value="mobilization">Toggle Comms</SelectItem>
                      <SelectItem value="supervision">Toggle Supervision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto border-t">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead
                        className="cursor-pointer hover:text-foreground text-xs font-semibold"
                        onClick={() => {
                          if (tableSortKey === "entityName") setTableSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          else {
                            setTableSortKey("entityName");
                            setTableSortDir("asc");
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Evaluated Unit
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead className="text-xs">Tier</TableHead>
                      {visibleColumns.planning && (
                        <TableHead
                          className="cursor-pointer text-xs text-right"
                          onClick={() => {
                            setTableSortKey("planning");
                            setTableSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                        >
                          Planning
                        </TableHead>
                      )}
                      {visibleColumns.logistics && (
                        <TableHead
                          className="cursor-pointer text-xs text-right"
                          onClick={() => {
                            setTableSortKey("logistics");
                            setTableSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                        >
                          Logistics
                        </TableHead>
                      )}
                      {visibleColumns.training && (
                        <TableHead
                          className="cursor-pointer text-xs text-right"
                          onClick={() => {
                            setTableSortKey("training");
                            setTableSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                        >
                          Training
                        </TableHead>
                      )}
                      {visibleColumns.mobilization && (
                        <TableHead
                          className="cursor-pointer text-xs text-right"
                          onClick={() => {
                            setTableSortKey("mobilization");
                            setTableSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                        >
                          Comms
                        </TableHead>
                      )}
                      {visibleColumns.supervision && (
                        <TableHead
                          className="cursor-pointer text-xs text-right"
                          onClick={() => {
                            setTableSortKey("supervision");
                            setTableSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                        >
                          Supervision
                        </TableHead>
                      )}
                      <TableHead
                        className="cursor-pointer text-xs text-right font-bold"
                        onClick={() => {
                          if (tableSortKey === "compositeScore") setTableSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          else {
                            setTableSortKey("compositeScore");
                            setTableSortDir("desc");
                          }
                        }}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Score (%)
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                      <TableHead className="text-xs text-center">Sign-Off</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAssessments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-muted-foreground text-xs">
                          No readiness assessment records found matching current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedAssessments.map((record) => (
                        <TableRow key={record.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium text-xs">
                            <div className="font-semibold text-foreground">{record.entityName}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {record.parentEntityName ? `${record.parentEntityName} • ` : ""}
                              {record.assessorName}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {record.tier === "tier1_national"
                                ? "National"
                                : record.tier === "tier2_provincial"
                                ? "Provincial"
                                : "District/HF"}
                            </Badge>
                          </TableCell>
                          {visibleColumns.planning && (
                            <TableCell className="text-xs text-right">
                              {record.domainScores.planning ?? 0}%
                            </TableCell>
                          )}
                          {visibleColumns.logistics && (
                            <TableCell className="text-xs text-right">
                              {record.domainScores.logistics ?? 0}%
                            </TableCell>
                          )}
                          {visibleColumns.training && (
                            <TableCell className="text-xs text-right">
                              {record.domainScores.training ?? 0}%
                            </TableCell>
                          )}
                          {visibleColumns.mobilization && (
                            <TableCell className="text-xs text-right">
                              {record.domainScores.mobilization ?? 0}%
                            </TableCell>
                          )}
                          {visibleColumns.supervision && (
                            <TableCell className="text-xs text-right">
                              {record.domainScores.supervision ?? 0}%
                            </TableCell>
                          )}
                          <TableCell className="text-xs text-right font-bold">
                            <span
                              className={
                                record.compositeScore >= readyThreshold
                                  ? "text-emerald-600 font-bold"
                                  : record.compositeScore >= watchlistThreshold
                                  ? "text-amber-600 font-bold"
                                  : "text-red-600 font-bold"
                              }
                            >
                              {record.compositeScore}%
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            <Badge
                              className={
                                record.compositeScore >= readyThreshold
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"
                                  : record.compositeScore >= watchlistThreshold
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]"
                                  : "bg-red-500/10 text-red-600 border-red-500/20 text-[10px]"
                              }
                            >
                              {record.compositeScore >= readyThreshold
                                ? "Ready"
                                : record.compositeScore >= watchlistThreshold
                                ? "Watchlist"
                                : "Not Ready"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            {record.isSignedOff ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                Signed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[10px]">
                                Draft
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => setViewAssessmentDetail(record)}
                                title="View Assessment Audit"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>

                              {isSuperUser && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setAssessments((prev) => prev.filter((a) => a.id !== record.id));
                                    toast({
                                      title: "Assessment Deleted",
                                      description: `Assessment for ${record.entityName} was removed.`,
                                    });
                                  }}
                                  title="Delete Assessment"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Enterprise Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <Select
                    value={String(tablePageSize)}
                    onValueChange={(v) => {
                      setTablePageSize(Number(v));
                      setTablePage(1);
                    }}
                  >
                    <SelectTrigger className="h-7 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>records per page. Total: {searchedAssessments.length}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span>
                    Page {tablePage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      disabled={tablePage <= 1}
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      disabled={tablePage >= totalPages}
                      onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: READINESS CHECKLIST (DATA COLLECTION TOOL)                   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="checklist" className="space-y-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    Pre-SIA Operational Readiness Data Collection Tool
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Record field supervisor ratings on the standard 0 to 10 scale across the 5 WHO readiness domains.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Live Calculated Score:</div>
                    <div className="text-xl font-bold flex items-center gap-1.5 justify-end">
                      <span>{checklistCalculated.compositeScore}%</span>
                      <Badge
                        className={
                          checklistCalculated.compositeScore >= readyThreshold
                            ? "bg-emerald-500 text-white"
                            : checklistCalculated.compositeScore >= watchlistThreshold
                            ? "bg-amber-500 text-white"
                            : "bg-red-500 text-white"
                        }
                      >
                        {checklistCalculated.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Metadata Section */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Evaluation Tier</Label>
                  <Select
                    value={checklistTier}
                    onValueChange={(v) => setChecklistTier(v as AssessmentTier)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tier1_national">Tier 1: National checks Province</SelectItem>
                      <SelectItem value="tier2_provincial">Tier 2: Province checks District</SelectItem>
                      <SelectItem value="tier3_district">Tier 3: District checks Health Facility</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Milestone</Label>
                  <Select
                    value={checklistMilestone}
                    onValueChange={(v) => setChecklistMilestone(v as MilestoneTimeline)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12W">12W (Planning)</SelectItem>
                      <SelectItem value="8W">8W (Microplanning)</SelectItem>
                      <SelectItem value="4W">4W (Week 4 Assessment)</SelectItem>
                      <SelectItem value="2W">2W (Syringes &amp; Comms)</SelectItem>
                      <SelectItem value="1W">1W (Final Readiness)</SelectItem>
                      <SelectItem value="D-1">D-1 (Go / No-Go)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Evaluated Unit Name</Label>
                  <Input
                    value={checklistEntityName}
                    onChange={(e) => setChecklistEntityName(e.target.value)}
                    placeholder="e.g. Kabwe District"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Assessor Name &amp; Title</Label>
                  <Input
                    value={checklistAssessorName}
                    onChange={(e) => setChecklistAssessorName(e.target.value)}
                    placeholder="e.g. Dr. B. Chilufya"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Indicators Grouped by Domain */}
              <div className="space-y-6">
                {READINESS_DOMAINS.map((domain) => {
                  const domainIndicators = READINESS_INDICATORS.filter((i) => i.domainId === domain.id);
                  const domainScore = checklistCalculated.domainScores[domain.id] || 0;

                  return (
                    <Card key={domain.id} className="border-border/60 overflow-hidden">
                      <CardHeader className="p-3 bg-muted/40 border-b flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: domain.color }}
                          />
                          <CardTitle className="text-sm font-semibold">{domain.name}</CardTitle>
                        </div>
                        <Badge variant="outline" className="bg-background text-xs font-bold">
                          Domain Score: {domainScore}%
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-4 divide-y divide-border/40">
                        {domainIndicators.map((ind) => {
                          const currentScore = checklistScores[ind.id] ?? 5;

                          return (
                            <div key={ind.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                <div className="space-y-1 pr-4">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-[10px] font-mono h-4">
                                      {ind.code}
                                    </Badge>
                                    <span className="text-xs font-semibold text-foreground">
                                      {ind.question}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                    <Info className="h-3 w-3 text-primary/70 shrink-0" />
                                    <span>Source: {ind.sourceOfVerification}</span>
                                  </div>
                                </div>

                                {/* Scoring Controller (0 to 10 scale buttons & slider) */}
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md border">
                                    <Button
                                      size="sm"
                                      variant={currentScore === 0 ? "destructive" : "ghost"}
                                      onClick={() => handleScoreChange(ind.id, 0)}
                                      className="h-6 px-2 text-[11px]"
                                    >
                                      0 (Not Started)
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={currentScore === 5 ? "default" : "ghost"}
                                      onClick={() => handleScoreChange(ind.id, 5)}
                                      className="h-6 px-2 text-[11px] bg-amber-500 text-white hover:bg-amber-600"
                                    >
                                      5 (50% Done)
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={currentScore === 10 ? "default" : "ghost"}
                                      onClick={() => handleScoreChange(ind.id, 10)}
                                      className="h-6 px-2 text-[11px] bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                      10 (Completed)
                                    </Button>
                                  </div>

                                  <div className="w-16 text-right">
                                    <span
                                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                                        currentScore >= 8
                                          ? "bg-emerald-100 text-emerald-800"
                                          : currentScore >= 5
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-red-100 text-red-800"
                                      }`}
                                    >
                                      {currentScore} / 10
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* General Observations & Recommendations */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Supervisor Observations &amp; Evidence Notes</Label>
                <Textarea
                  value={checklistNotes}
                  onChange={(e) => setChecklistNotes(e.target.value)}
                  placeholder="Record key observations, cold chain temperatures, vaccine batch numbers, or community resistance areas..."
                  className="min-h-[90px] text-xs"
                />
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between border-t bg-muted/10 p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("dashboard")}
              >
                Cancel
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSaveChecklist(false)}
                >
                  Save as Draft
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveChecklist(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  Sign Off &amp; Submit Assessment
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: BOTTLENECK & CORRECTIVE ACTIONS MATRIX                       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="actions" className="space-y-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Readiness Bottleneck Resolution Tracker
                </CardTitle>
                <CardDescription className="text-xs">
                  Track identified red flags and lagging indicators (&lt;60% score) with designated focal owners and hard deadlines before SIA launch.
                </CardDescription>
              </div>

              <Button
                size="sm"
                onClick={() => setActionDialogOpen(true)}
                className="flex items-center gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Log Corrective Action
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto border-t">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs">Target Unit</TableHead>
                      <TableHead className="text-xs">Operational Domain</TableHead>
                      <TableHead className="text-xs">Identified Bottleneck / Gap</TableHead>
                      <TableHead className="text-xs">Required Corrective Action</TableHead>
                      <TableHead className="text-xs">Focal Person</TableHead>
                      <TableHead className="text-xs">Deadline</TableHead>
                      <TableHead className="text-xs text-center">Priority</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions.map((act) => (
                      <TableRow key={act.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold text-xs text-foreground">
                          {act.entityName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {act.domain}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[220px] text-foreground">
                          {act.issue}
                        </TableCell>
                        <TableCell className="text-xs max-w-[240px] text-muted-foreground">
                          {act.actionRequired}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {act.responsiblePerson}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {act.deadline}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <Badge
                            className={
                              act.priority === "high"
                                ? "bg-red-500/10 text-red-600 border-red-500/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            }
                          >
                            {act.priority.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleActionStatus(act.id)}
                            className="h-6 text-[10px] px-2"
                          >
                            {act.status === "resolved" ? (
                              <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
                                Resolved
                              </Badge>
                            ) : act.status === "in_progress" ? (
                              <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                                In Progress
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500 text-white hover:bg-red-600">
                                Open
                              </Badge>
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => setActions((prev) => prev.filter((a) => a.id !== act.id))}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── DRILL-DOWN MODAL 1: OVERALL READINESS DRILLDOWN ──────────────── */}
      <Dialog open={drilldownModal === "overall"} onOpenChange={(open) => !open && setDrilldownModal(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              Overall Readiness Index Audit &amp; Domain Breakdown
            </DialogTitle>
            <DialogDescription>
              Disaggregation of evaluated administrative units by performance tier and operational domain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg">
                <div className="text-2xl font-bold text-emerald-600">{kpiStats.readyCount}</div>
                <div className="text-xs text-muted-foreground">Ready Units (&gt;={readyThreshold}%)</div>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg">
                <div className="text-2xl font-bold text-amber-600">{kpiStats.watchlistCount}</div>
                <div className="text-xs text-muted-foreground">Watchlist Units ({watchlistThreshold}-{readyThreshold - 1}%)</div>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{kpiStats.bottleneckCount}</div>
                <div className="text-xs text-muted-foreground">Critical Bottlenecks (&lt;{watchlistThreshold}%)</div>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Domain Score Breakdown Across All Units:
              </h4>
              {READINESS_DOMAINS.map((d) => (
                <div key={d.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{d.name}</span>
                    <span>{kpiStats.domainAverages[d.id] || 0}%</span>
                  </div>
                  <Progress value={kpiStats.domainAverages[d.id] || 0} className="h-2" />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setDrilldownModal(null)}>
              Close Audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DRILL-DOWN MODAL 2: READY UNITS (>=80%) ─────────────────────── */}
      <Dialog open={drilldownModal === "ready"} onOpenChange={(open) => !open && setDrilldownModal(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              Cleared Administrative Units (&gt;={readyThreshold}%)
            </DialogTitle>
            <DialogDescription>
              List of units that have met WHO readiness criteria and are fully authorized to launch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 my-2">
            {filteredAssessments.filter((a) => a.compositeScore >= readyThreshold).length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No units currently meet the ready benchmark.</p>
            ) : (
              filteredAssessments
                .filter((a) => a.compositeScore >= readyThreshold)
                .map((a) => (
                  <div
                    key={a.id}
                    className="p-3 border rounded-lg flex items-center justify-between hover:bg-muted/40 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{a.entityName}</div>
                      <div className="text-[11px] text-muted-foreground">{a.parentEntityName || a.tier}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-emerald-600">{a.compositeScore}%</div>
                      <div className="text-[10px] text-muted-foreground">{a.assessorName}</div>
                    </div>
                  </div>
                ))
            )}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setDrilldownModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DRILL-DOWN MODAL 3: WATCHLIST UNITS (60-79%) ─────────────────── */}
      <Dialog open={drilldownModal === "watchlist"} onOpenChange={(open) => !open && setDrilldownModal(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Watchlist Administrative Units ({watchlistThreshold}-{readyThreshold - 1}%)
            </DialogTitle>
            <DialogDescription>
              Units requiring immediate provincial focal person visits to unblock specific logistical or training bottlenecks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 my-2">
            {filteredAssessments.filter((a) => a.compositeScore >= watchlistThreshold && a.compositeScore < readyThreshold).map((a) => (
              <div
                key={a.id}
                className="p-3 border rounded-lg flex items-center justify-between hover:bg-muted/40 text-xs"
              >
                <div>
                  <div className="font-semibold text-foreground">{a.entityName}</div>
                  <div className="text-[11px] text-muted-foreground">{a.notes || "Substantial progress."}</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-amber-600">{a.compositeScore}%</div>
                  <div className="text-[10px] text-muted-foreground">{a.assessorName}</div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setDrilldownModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DRILL-DOWN MODAL 4: BOTTLENECKS (<60%) ──────────────────────── */}
      <Dialog open={drilldownModal === "bottlenecks"} onOpenChange={(open) => !open && setDrilldownModal(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              High-Risk Units with Critical Readiness Lags (&lt;{watchlistThreshold}%)
            </DialogTitle>
            <DialogDescription>
              These units present significant risk to the SIA timeline. Immediate national intervention recommended.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 my-2">
            {filteredAssessments.filter((a) => a.compositeScore < watchlistThreshold).map((a) => (
              <div
                key={a.id}
                className="p-3 border border-red-200 bg-red-50/50 dark:bg-red-950/10 rounded-lg flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-foreground">{a.entityName}</div>
                  <div className="text-[11px] text-red-700 dark:text-red-300">{a.notes || "Critical delays identified."}</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-red-600">{a.compositeScore}%</div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-6 text-[10px] mt-1"
                    onClick={() => {
                      setNewActionTarget(a.entityName);
                      setNewActionIssue(a.notes || "Critical readiness lag below 60%");
                      setActionDialogOpen(true);
                      setDrilldownModal(null);
                    }}
                  >
                    Log Corrective Action
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setDrilldownModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DETAILED ASSESSMENT VIEW MODAL ───────────────────────────────── */}
      {viewAssessmentDetail && (
        <Dialog open={!!viewAssessmentDetail} onOpenChange={(open) => !open && setViewAssessmentDetail(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{viewAssessmentDetail.entityName} - Readiness Audit</span>
                <Badge
                  className={
                    viewAssessmentDetail.compositeScore >= readyThreshold
                      ? "bg-emerald-500"
                      : viewAssessmentDetail.compositeScore >= watchlistThreshold
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }
                >
                  {viewAssessmentDetail.compositeScore}% ({viewAssessmentDetail.status.toUpperCase()})
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Assessed by {viewAssessmentDetail.assessorName} ({viewAssessmentDetail.assessorRole}) on {viewAssessmentDetail.assessmentDate}. Milestone: {viewAssessmentDetail.milestone}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {READINESS_DOMAINS.map((d) => (
                  <div key={d.id} className="p-2 border rounded-lg text-center bg-muted/20">
                    <div className="text-[11px] text-muted-foreground truncate">{d.name.split(" ")[0]}</div>
                    <div className="text-base font-bold">{viewAssessmentDetail.domainScores[d.id] ?? 0}%</div>
                  </div>
                ))}
              </div>

              {viewAssessmentDetail.notes && (
                <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                  <span className="font-semibold text-foreground">Supervisor Notes:</span>
                  <p className="text-muted-foreground">{viewAssessmentDetail.notes}</p>
                </div>
              )}

              <div className="border rounded-lg divide-y text-xs">
                <div className="p-2 bg-muted/30 font-semibold">Individual Indicator Scores:</div>
                {READINESS_INDICATORS.map((ind) => {
                  const s = viewAssessmentDetail.scores[ind.id] ?? 0;
                  return (
                    <div key={ind.id} className="p-2 flex items-center justify-between hover:bg-muted/20">
                      <div className="pr-4">
                        <span className="font-mono font-bold mr-2 text-primary">{ind.code}</span>
                        <span>{ind.question}</span>
                      </div>
                      <Badge variant="outline" className="font-bold shrink-0">
                        {s} / 10
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => setViewAssessmentDetail(null)}>
                Close Audit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── BENCHMARK CONFIGURATION DIALOG (SUPER USERS ONLY) ────────────── */}
      <Dialog open={benchmarkDialogOpen} onOpenChange={setBenchmarkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <SlidersHorizontal className="h-5 w-5" />
              Configure Readiness Benchmarks
            </DialogTitle>
            <DialogDescription>
              Adjust national threshold cutoffs for traffic-light readiness classification.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>Green / Ready Threshold (%):</span>
                <span className="font-bold text-emerald-600">&gt;= {readyThreshold}%</span>
              </Label>
              <Slider
                value={[readyThreshold]}
                min={60}
                max={95}
                step={5}
                onValueChange={(val) => setReadyThreshold(val[0])}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>Amber / Watchlist Cutoff (%):</span>
                <span className="font-bold text-amber-600">&gt;= {watchlistThreshold}%</span>
              </Label>
              <Slider
                value={[watchlistThreshold]}
                min={40}
                max={75}
                step={5}
                onValueChange={(val) => setWatchlistThreshold(val[0])}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              WHO standard recommendations are 80% for Ready and 60% for Substantial Progress.
            </p>
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setBenchmarkDialogOpen(false)}>
              Save Benchmarks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── LOG CORRECTIVE ACTION DIALOG ─────────────────────────────────── */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <AlertTriangle className="h-5 w-5" />
              Log Pre-SIA Corrective Action Item
            </DialogTitle>
            <DialogDescription>
              Assign focal owner and deadline to resolve identified readiness bottlenecks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2 text-xs">
            <div className="space-y-1">
              <Label>Target Administrative Unit</Label>
              <Input
                value={newActionTarget}
                onChange={(e) => setNewActionTarget(e.target.value)}
                placeholder="e.g. Ngabwe District"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label>Operational Domain</Label>
              <Select value={newActionDomain} onValueChange={setNewActionDomain}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {READINESS_DOMAINS.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Identified Bottleneck / Issue</Label>
              <Input
                value={newActionIssue}
                onChange={(e) => setNewActionIssue(e.target.value)}
                placeholder="e.g. Syringes and safety boxes not yet delivered to district store"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label>Corrective Action Required</Label>
              <Textarea
                value={newActionRequired}
                onChange={(e) => setNewActionRequired(e.target.value)}
                placeholder="e.g. Expedite dedicated dispatch vehicle from national medical stores"
                className="min-h-[60px] text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Responsible Focal Person</Label>
                <Input
                  value={newActionPerson}
                  onChange={(e) => setNewActionPerson(e.target.value)}
                  placeholder="e.g. District Pharmacist"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label>Resolution Deadline</Label>
                <Input
                  type="date"
                  value={newActionDeadline}
                  onChange={(e) => setNewActionDeadline(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Priority</Label>
              <Select
                value={newActionPriority}
                onValueChange={(v) => setNewActionPriority(v as any)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High (Threatens Campaign Launch)</SelectItem>
                  <SelectItem value="medium">Medium (Requires Resolution by 2W)</SelectItem>
                  <SelectItem value="low">Low (Operational Optimization)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateAction}>
              Log Action Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
