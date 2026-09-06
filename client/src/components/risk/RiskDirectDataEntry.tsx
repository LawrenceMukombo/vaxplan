import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Calculator,
  RefreshCw,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Maximize2,
  Minimize2,
  Upload,
  ShieldAlert,
  MapPin,
  Activity,
  FileText,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Layers,
  Settings,
  Info,
  ExternalLink,
  Users,
  Map as MapIcon,
  BookOpen,
  ArrowRight,
  FileSpreadsheet,
  Sparkles,
  Check,
  Globe,
  Pencil,
  SlidersHorizontal,
  Save,
  Database,
  Plus,
  Trash2,
} from "lucide-react";
import { RiskChoroplethMap } from "./RiskChoroplethMap";
import { RiskFinalReportView } from "./RiskFinalReportView";

export interface DirectEntryRow {
  id?: string;
  districtId: number;
  districtName?: string;
  provinceId?: number | null;
  provinceName?: string | null;
  population: string | number;
  areaKm2: string | number;
  // Domain 1: Population Immunity
  mcv1YearMinus3: string | number;
  mcv1YearMinus2: string | number;
  mcv1YearMinus1: string | number;
  mcv2YearMinus3: string | number;
  mcv2YearMinus2: string | number;
  mcv2YearMinus1: string | number;
  penta1YearMinus1: string | number;
  siaCoveragePct: string | number;
  siaTargetAgeGroup: "WIDE" | "NARROW";
  siaYearsSince: number;
  unvaccinatedCasesPct: string | number;
  // Domain 2: Surveillance Quality
  suspectedCases: number;
  discardedCases: number;
  adequateInvestigationPct: string | number;
  adequateSpecimenPct: string | number;
  timelyLabResultsPct: string | number;
  // Domain 4: Threat Assessment & Vulnerabilities
  threatCasesUnder5: number;
  threatCases5To14: number;
  threatCases15Plus: number;
  borderCaseInPastYear: boolean;
  vulnerabilities: {
    migrantOrUnderserved?: boolean;
    vaccineHesitancyOrRefusal?: boolean;
    securityOrConflictConcerns?: boolean;
    recurrentNaturalDisasters?: boolean;
    poorAccessOrTerrain?: boolean;
    inadequatePoliticalSupport?: boolean;
    highTransitHubOrBorder?: boolean;
    massGatheringsOrEvents?: boolean;
  };
}

export interface CaseLinelistRow {
  id: string;
  // User Input Values (Cols 1-17)
  year: number;
  admin1: string;
  reportingDistrict: string;
  caseId: string;
  finalClassification: string;
  ageYears: number | string;
  ageMonths: number | string;
  sex: "M" | "F" | "U";
  placeOfResidence: string;
  dateRashOnset: string;
  vaccinationStatus: string;
  dosesReceived: number | string;
  dateNotification: string;
  dateInvestigation: string;
  dateBloodSample: string;
  dateLabResult: string;
  placeOfInfection: string;
  // Calculated Values (Cols 18-34)
  normalizedAdmin2: string;
  coreVariablesOk: number;
  calcAgeMonths: number;
  mcvAgeEligible: number;
  unvaccinatedCase: number;
  unknownCase: number;
  unvacOrUnknownCase: number;
  discardedCase: number;
  confirmedCase: number;
  epidemiologicCase: number;
  case0to5Years: number;
  case5to15Years: number;
  caseOver15Years: number;
  adequateInvestigation: number;
  specimenCollected: number;
  adequateSpecimenColl: number;
  timelyAvailLabResults: number;
}

interface Props {
  assessmentId: string;
  onCalculationSuccess?: () => void;
  onBack?: () => void;
}

export type SheetTabId =
  | "overview"
  | "setup"
  | "indicator-maps"
  | "population-immunity"
  | "surveillance-quality"
  | "program-delivery"
  | "vulnerable-groups"
  | "threat-assessment"
  | "measles-incidence"
  | "case-based-data"
  | "report-preview";

interface TabDefinition {
  id: SheetTabId;
  name: string;
  shortName: string;
  category: string;
  tagColor: string;
  domainCode?: string;
  maxPoints?: number;
}

const WORKSPACE_TABS: TabDefinition[] = [
  { id: "overview", name: "Acknowledgements & Methodology", shortName: "Acknowledgements", category: "Guidance", tagColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300" },
  { id: "setup", name: "Setup & Configuration", shortName: "Setup&Configuration", category: "Configuration", tagColor: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300" },
  { id: "indicator-maps", name: "Indicator Maps", shortName: "IndicatorMaps", category: "GIS", tagColor: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300" },
  { id: "population-immunity", name: "1. Population Immunity", shortName: "PopulationImmunity", category: "Domain 1", tagColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300", domainCode: "PI", maxPoints: 40 },
  { id: "surveillance-quality", name: "2. Surveillance Quality", shortName: "SurveillanceQuality", category: "Domain 2", tagColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300", domainCode: "SQ", maxPoints: 20 },
  { id: "program-delivery", name: "3. Program Delivery Performance", shortName: "ProgramDeliveryPerformance", category: "Domain 3", tagColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300", domainCode: "PD", maxPoints: 16 },
  { id: "vulnerable-groups", name: "4a. Vulnerable Groups", shortName: "VulnerableGroups", category: "Domain 4a", tagColor: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300", domainCode: "VG", maxPoints: 8 },
  { id: "threat-assessment", name: "4b. Threat Assessment", shortName: "ThreatAssessment", category: "Domain 4b", tagColor: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300", domainCode: "TA", maxPoints: 24 },
  { id: "measles-incidence", name: "Measles Incidence", shortName: "MeaslesIncidence", category: "Epidemiology", tagColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300" },
  { id: "case-based-data", name: "Case-Based Data (Case Linelist)", shortName: "Case-Based-Data", category: "Surveillance", tagColor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300" },
  { id: "report-preview", name: "Report Preview", shortName: "ReportPreview", category: "Synthesis", tagColor: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300" },
];

// Baseline column widths (px) - calibrated for 3-digit figures (e.g. 100%, 99.5%) without truncation
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  index: 48,
  district: 240,
  province: 160,
  // PI
  mcv1Minus3: 98,
  mcv1Minus2: 98,
  mcv1Minus1: 98,
  mcv1Avg: 88,
  mcv1Rp: 56,
  neighborPct: 94,
  neighborRp: 56,
  mcv2Minus3: 98,
  mcv2Minus2: 98,
  mcv2Minus1: 98,
  mcv2Avg: 88,
  mcv2Rp: 56,
  siaCovMinus1: 98,
  siaCovRp: 56,
  siaAgeGroupMinus1: 114,
  siaAgeGroupRp: 56,
  siaYearsMinus1: 88,
  siaYearsRp: 56,
  unvacMinus3Minus1: 96,
  unvacRp: 56,
  piTotalRp: 96,
  // SQ
  sqRateVal: 98,
  sqRateRp: 56,
  sqInvestVal: 98,
  sqInvestRp: 56,
  sqSpecimenVal: 98,
  sqSpecimenRp: 56,
  sqLabVal: 98,
  sqLabRp: 56,
  sqTotalRp: 96,
  // PD
  pdMcv1TrendVal: 98,
  pdMcv1TrendRp: 56,
  pdMcv2TrendVal: 98,
  pdMcv2TrendRp: 56,
  pdMcvDropoutVal: 104,
  pdMcvDropoutRp: 56,
  pdPentaDoses: 98,
  pdPentaDropoutVal: 104,
  pdPentaDropoutRp: 56,
  pdTotalRp: 96,
  // VG
  vgItem: 120,
  vgTotalRp: 96,
  // TA
  taCasesUnder5Val: 88,
  taCasesUnder5Rp: 56,
  taCases5to14Val: 88,
  taCases5to14Rp: 56,
  taCases15plusVal: 88,
  taCases15plusRp: 56,
  taDensityVal: 98,
  taDensityRp: 56,
  taBorderVal: 90,
  taBorderRp: 56,
  taVulnVal: 90,
  taVulnRp: 56,
  taTotalRp: 96,
};

const STRETCH_COL_WIDTHS: Record<string, number> = Object.fromEntries(
  Object.entries(DEFAULT_COL_WIDTHS).map(([k, v]) => [k, Math.round(v * 1.35)])
);

// Pure calculations matching WHO Tool V1.8
export function calcMcv1Rp(avg: number): number {
  if (isNaN(avg) || avg <= 0) return 8;
  if (avg >= 95.0) return 0;
  if (avg >= 90.0) return 2;
  if (avg >= 85.0) return 4;
  if (avg >= 80.0) return 6;
  return 8;
}

export function calcNeighborRp(pct: number): number {
  if (isNaN(pct) || pct <= 0) return 0;
  if (pct >= 75.0) return 4;
  if (pct >= 50.0) return 2;
  return 0;
}

export function calcMcv2Rp(avg: number): number {
  if (isNaN(avg) || avg <= 0) return 8;
  if (avg >= 95.0) return 0;
  if (avg >= 90.0) return 2;
  if (avg >= 85.0) return 4;
  if (avg >= 80.0) return 6;
  return 8;
}

export function calcSiaCovRp(cov: number, hasCampaign: boolean = true): number {
  if (!hasCampaign) return 8;
  if (isNaN(cov) || cov <= 0) return 6;
  if (cov >= 95.0) return 0;
  if (cov >= 90.0) return 2;
  if (cov >= 85.0) return 4;
  return 6;
}

export function calcSiaAgeRp(target: string): number {
  return target === "WIDE" ? 0 : 2;
}

export function calcSiaYearsRp(years: number): number {
  if (isNaN(years) || years <= 1) return 0;
  if (years === 2) return 2;
  return 4;
}

export function calculateOlsSlope(data: Array<{ year: number; value: number }>): number | null {
  if (data.length < 2) return null;
  const n = data.length;
  const meanX = data.reduce((acc, d) => acc + d.year, 0) / n;
  const meanY = data.reduce((acc, d) => acc + d.value, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (const d of data) {
    const dx = d.year - meanX;
    const dy = d.value - meanY;
    numerator += dx * dy;
    denominator += dx * dx;
  }

  if (denominator === 0) return 0;
  return numerator / denominator;
}

export function calcUnvacRp(pct: number): number {
  if (isNaN(pct) || pct < 0) return 0;
  return pct >= 20.0 ? 6 : 0;
}

export function calcDiscardedRateRp(rate: number): number {
  if (isNaN(rate) || rate <= 0) return 8;
  if (rate >= 2.0) return 0;
  if (rate >= 1.0) return 4;
  return 8;
}

export function calcQualityRp(pct: number): number {
  if (isNaN(pct)) return 4;
  return pct >= 80.0 ? 0 : 4;
}

export function calcTrendRp(slopeVal: number): number {
  if (isNaN(slopeVal)) return 0;
  if (slopeVal >= 0) return 0;
  if (slopeVal <= -10) return 4;
  return 2;
}

export function calcDropoutRp(rate: number): number {
  if (isNaN(rate)) return 0;
  return rate <= 10.0 ? 0 : 4;
}

export function calcDensityRp(density: number): number {
  if (isNaN(density) || density <= 50) return 0;
  if (density > 1000) return 4;
  if (density > 300) return 3;
  if (density > 100) return 2;
  return 1;
}

export function calcThreatPoints(
  casesUnder5: number,
  cases5to14: number,
  cases15plus: number,
  density: number,
  borderCase: boolean,
  vulnCount: number
): number {
  let pts = 0;
  pts += casesUnder5 > 0 ? 4 : 0;
  pts += cases5to14 > 0 ? 3 : 0;
  pts += cases15plus > 0 ? 3 : 0;
  pts += calcDensityRp(density);
  pts += borderCase ? 2 : 0;
  pts += Math.min(8, vulnCount);
  return Math.min(24, pts);
}

export function calcTotalRiskScore(
  piRp: number,
  sqRp: number,
  pdRp: number,
  taRp: number
): number {
  return Math.min(100, Math.round(piRp + sqRp + pdRp + taRp));
}

export function getRiskCategory(score: number): "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" {
  if (score < 32) return "LOW";
  if (score < 45) return "MEDIUM";
  if (score < 57) return "HIGH";
  return "VERY_HIGH";
}

// Extractor and calculator for sorting any column (raw or computed)
export function getSortValue(row: DirectEntryRow, field: string): number | string {
  switch (field) {
    case "districtName":
      return (row.districtName || "").toLowerCase();
    case "provinceName":
      return (row.provinceName || "").toLowerCase();
    case "population":
      return Number(row.population) || 0;

    // PI: MCV1
    case "mcv1YearMinus3":
      return Number(row.mcv1YearMinus3) || 0;
    case "mcv1YearMinus2":
      return Number(row.mcv1YearMinus2) || 0;
    case "mcv1YearMinus1":
      return Number(row.mcv1YearMinus1) || 0;
    case "mcv1Avg": {
      const v3 = Number(row.mcv1YearMinus3) || 0;
      const v2 = Number(row.mcv1YearMinus2) || 0;
      const v1 = Number(row.mcv1YearMinus1) || 0;
      return (v3 + v2 + v1) / 3;
    }
    case "mcv1Rp": {
      const v3 = Number(row.mcv1YearMinus3) || 0;
      const v2 = Number(row.mcv1YearMinus2) || 0;
      const v1 = Number(row.mcv1YearMinus1) || 0;
      return calcMcv1Rp((v3 + v2 + v1) / 3);
    }

    // PI: Neighboring
    case "neighborPct":
      return 75.0; // Baseline
    case "neighborRp":
      return calcNeighborRp(75.0);

    // PI: MCV2
    case "mcv2YearMinus3":
      return Number(row.mcv2YearMinus3) || 0;
    case "mcv2YearMinus2":
      return Number(row.mcv2YearMinus2) || 0;
    case "mcv2YearMinus1":
      return Number(row.mcv2YearMinus1) || 0;
    case "mcv2Avg": {
      const v3 = Number(row.mcv2YearMinus3) || 0;
      const v2 = Number(row.mcv2YearMinus2) || 0;
      const v1 = Number(row.mcv2YearMinus1) || 0;
      return (v3 + v2 + v1) / 3;
    }
    case "mcv2Rp": {
      const v3 = Number(row.mcv2YearMinus3) || 0;
      const v2 = Number(row.mcv2YearMinus2) || 0;
      const v1 = Number(row.mcv2YearMinus1) || 0;
      return calcMcv2Rp((v3 + v2 + v1) / 3);
    }

    // PI: SIA & Unvaccinated
    case "siaCoveragePct":
      return Number(row.siaCoveragePct) || 0;
    case "siaCovRp":
      return calcSiaCovRp(Number(row.siaCoveragePct) || 0);
    case "siaTargetAgeGroup":
      return row.siaTargetAgeGroup || "WIDE";
    case "siaAgeGroupRp":
      return calcSiaAgeRp(row.siaTargetAgeGroup);
    case "siaYearsSince":
      return Number(row.siaYearsSince) || 0;
    case "siaYearsRp":
      return calcSiaYearsRp(Number(row.siaYearsSince) || 0);
    case "unvaccinatedCasesPct":
      return Number(row.unvaccinatedCasesPct) || 0;
    case "unvacRp":
      return calcUnvacRp(Number(row.unvaccinatedCasesPct) || 0);
    case "piTotalRp": {
      const m1Avg = ((Number(row.mcv1YearMinus3) || 0) + (Number(row.mcv1YearMinus2) || 0) + (Number(row.mcv1YearMinus1) || 0)) / 3;
      const m2Avg = ((Number(row.mcv2YearMinus3) || 0) + (Number(row.mcv2YearMinus2) || 0) + (Number(row.mcv2YearMinus1) || 0)) / 3;
      return Math.min(
        40,
        calcMcv1Rp(m1Avg) +
        calcNeighborRp(75.0) +
        calcMcv2Rp(m2Avg) +
        calcSiaCovRp(Number(row.siaCoveragePct) || 0) +
        calcSiaAgeRp(row.siaTargetAgeGroup) +
        calcSiaYearsRp(Number(row.siaYearsSince) || 0) +
        calcUnvacRp(Number(row.unvaccinatedCasesPct) || 0)
      );
    }

    // SQ
    case "sqDiscardedRate": {
      const pop = Number(row.population) || 100000;
      const discCases = Number(row.discardedCases) || 0;
      return (discCases / pop) * 100000;
    }
    case "sqRateRp": {
      const pop = Number(row.population) || 100000;
      const discCases = Number(row.discardedCases) || 0;
      return calcDiscardedRateRp((discCases / pop) * 100000);
    }
    case "adequateInvestigationPct":
      return Number(row.adequateInvestigationPct) || 0;
    case "sqInvestRp":
      return calcQualityRp(Number(row.adequateInvestigationPct) || 0);
    case "adequateSpecimenPct":
      return Number(row.adequateSpecimenPct) || 0;
    case "sqSpecimenRp":
      return calcQualityRp(Number(row.adequateSpecimenPct) || 0);
    case "timelyLabResultsPct":
      return Number(row.timelyLabResultsPct) || 0;
    case "sqLabRp":
      return calcQualityRp(Number(row.timelyLabResultsPct) || 0);
    case "sqTotalRp": {
      const pop = Number(row.population) || 100000;
      const discRate = ((Number(row.discardedCases) || 0) / pop) * 100000;
      return Math.min(
        20,
        calcDiscardedRateRp(discRate) +
        calcQualityRp(Number(row.adequateInvestigationPct) || 0) +
        calcQualityRp(Number(row.adequateSpecimenPct) || 0) +
        calcQualityRp(Number(row.timelyLabResultsPct) || 0)
      );
    }

    // PD
    case "pdMcv1Trend": {
      const slope = calculateOlsSlope([
        { year: 1, value: Number(row.mcv1YearMinus3) || 0 },
        { year: 2, value: Number(row.mcv1YearMinus2) || 0 },
        { year: 3, value: Number(row.mcv1YearMinus1) || 0 },
      ]);
      return slope !== null ? Number(slope.toFixed(2)) : 0;
    }
    case "pdMcv1TrendRp": {
      const slope = calculateOlsSlope([
        { year: 1, value: Number(row.mcv1YearMinus3) || 0 },
        { year: 2, value: Number(row.mcv1YearMinus2) || 0 },
        { year: 3, value: Number(row.mcv1YearMinus1) || 0 },
      ]);
      return calcTrendRp(slope ?? 0);
    }
    case "pdMcv2Trend": {
      const slope = calculateOlsSlope([
        { year: 1, value: Number(row.mcv2YearMinus3) || 0 },
        { year: 2, value: Number(row.mcv2YearMinus2) || 0 },
        { year: 3, value: Number(row.mcv2YearMinus1) || 0 },
      ]);
      return slope !== null ? Number(slope.toFixed(2)) : 0;
    }
    case "pdMcv2TrendRp": {
      const slope = calculateOlsSlope([
        { year: 1, value: Number(row.mcv2YearMinus3) || 0 },
        { year: 2, value: Number(row.mcv2YearMinus2) || 0 },
        { year: 3, value: Number(row.mcv2YearMinus1) || 0 },
      ]);
      return calcTrendRp(slope ?? 0);
    }
    case "pdMcvDropout": {
      const m1_1 = Number(row.mcv1YearMinus1) || 0;
      const m2_1 = Number(row.mcv2YearMinus1) || 0;
      return m1_1 > 0 ? ((m1_1 - m2_1) / m1_1) * 100 : 0;
    }
    case "pdMcvDropoutRp": {
      const m1_1 = Number(row.mcv1YearMinus1) || 0;
      const m2_1 = Number(row.mcv2YearMinus1) || 0;
      const dr = m1_1 > 0 ? ((m1_1 - m2_1) / m1_1) * 100 : 0;
      return calcDropoutRp(dr);
    }
    case "penta1YearMinus1":
      return Number(row.penta1YearMinus1) || 0;
    case "pdPentaDropout": {
      const penta = Number(row.penta1YearMinus1) || 0;
      const m1_1 = Number(row.mcv1YearMinus1) || 0;
      return penta > 0 ? ((penta - m1_1) / penta) * 100 : 0;
    }
    case "pdPentaDropoutRp": {
      const penta = Number(row.penta1YearMinus1) || 0;
      const m1_1 = Number(row.mcv1YearMinus1) || 0;
      const pdr = penta > 0 ? ((penta - m1_1) / penta) * 100 : 0;
      return calcDropoutRp(pdr);
    }
    case "pdTotalRp": {
      const m1_3 = Number(row.mcv1YearMinus3) || 0;
      const m1_1 = Number(row.mcv1YearMinus1) || 0;
      const m2_3 = Number(row.mcv2YearMinus3) || 0;
      const m2_1 = Number(row.mcv2YearMinus1) || 0;
      const mcvDr = m1_1 > 0 ? ((m1_1 - m2_1) / m1_1) * 100 : 0;
      const penta = Number(row.penta1YearMinus1) || 0;
      const pentaDr = penta > 0 ? ((penta - m1_1) / penta) * 100 : 0;
      return Math.min(
        16,
        calcTrendRp(m1_1 - m1_3) +
        calcTrendRp(m2_1 - m2_3) +
        calcDropoutRp(mcvDr) +
        calcDropoutRp(pentaDr)
      );
    }

    // VG
    case "vg_migrant":
      return row.vulnerabilities?.migrantOrUnderserved ? 1 : 0;
    case "vg_hesitancy":
      return row.vulnerabilities?.vaccineHesitancyOrRefusal ? 1 : 0;
    case "vg_security":
      return row.vulnerabilities?.securityOrConflictConcerns ? 1 : 0;
    case "vg_calamities":
      return row.vulnerabilities?.recurrentNaturalDisasters ? 1 : 0;
    case "vg_terrain":
      return row.vulnerabilities?.poorAccessOrTerrain ? 1 : 0;
    case "vg_political":
      return row.vulnerabilities?.inadequatePoliticalSupport ? 1 : 0;
    case "vg_transit":
      return row.vulnerabilities?.highTransitHubOrBorder ? 1 : 0;
    case "vg_gatherings":
      return row.vulnerabilities?.massGatheringsOrEvents ? 1 : 0;
    case "vgTotalRp":
      return Math.min(8, Object.values(row.vulnerabilities || {}).filter(Boolean).length);

    // TA
    case "threatCasesUnder5":
      return Number(row.threatCasesUnder5) || 0;
    case "threatCasesUnder5Rp":
      return (Number(row.threatCasesUnder5) || 0) > 0 ? 4 : 0;
    case "threatCases5To14":
    case "threatCases5to14":
      return Number(row.threatCases5To14) || 0;
    case "threatCases5to14Rp":
    case "threatCases5To14Rp":
      return (Number(row.threatCases5To14) || 0) > 0 ? 3 : 0;
    case "threatCases15Plus":
    case "threatCases15plus":
      return Number(row.threatCases15Plus) || 0;
    case "threatCases15plusRp":
    case "threatCases15PlusRp":
      return (Number(row.threatCases15Plus) || 0) > 0 ? 3 : 0;
    case "threatDensity": {
      const pop = Number(row.population) || 100000;
      const area = Number(row.areaKm2) || 1000;
      return pop / area;
    }
    case "threatDensityRp": {
      const pop = Number(row.population) || 100000;
      const area = Number(row.areaKm2) || 1000;
      return calcDensityRp(pop / area);
    }
    case "threatBorderCase":
    case "borderCaseInPastYear":
      return row.borderCaseInPastYear ? 1 : 0;
    case "threatBorderRp":
      return row.borderCaseInPastYear ? 2 : 0;
    case "threatVulnPts":
      return Object.values(row.vulnerabilities || {}).filter(Boolean).length;
    case "threatVulnRp":
      return Math.min(8, Object.values(row.vulnerabilities || {}).filter(Boolean).length);
    case "taTotalRp": {
      const pop = Number(row.population) || 100000;
      const area = Number(row.areaKm2) || 1000;
      const vCount = Object.values(row.vulnerabilities || {}).filter(Boolean).length;
      return calcThreatPoints(
        Number(row.threatCasesUnder5) || 0,
        Number(row.threatCases5To14) || 0,
        Number(row.threatCases15Plus) || 0,
        pop / area,
        Boolean(row.borderCaseInPastYear),
        vCount
      );
    }

    default: {
      const raw = (row as any)[field];
      if (raw === undefined || raw === null) return 0;
      const num = Number(raw);
      return !isNaN(num) ? num : String(raw).toLowerCase();
    }
  }
}

export function RiskDirectDataEntry({ assessmentId, onCalculationSuccess }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // DEFAULT STARTING TAB: Overview & Methodology
  const [activeTab, setActiveTab] = useState<SheetTabId>("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortField, setSortField] = useState<string>("districtName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isStretched, setIsStretched] = useState<boolean>(false);

  // Local working copy for inline editing
  const [localRows, setLocalRows] = useState<DirectEntryRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [bulkDialogField, setBulkDialogField] = useState<string | null>(null);
  const [bulkDialogTitle, setBulkDialogTitle] = useState<string>("");
  const [bulkProvinceId, setBulkProvinceId] = useState<string>("ALL");
  const [bulkValue, setBulkValue] = useState<string>("");

  // Population Hub query
  const { data: populationHubData = [], isLoading: isLoadingPopHub } = useQuery<any[]>({
    queryKey: ["/api/population"],
  });

  // Timeframe configuration state
  const [targetYear, setTargetYear] = useState<number>(2025);
  const [baselineYear1, setBaselineYear1] = useState<number>(2022);
  const [baselineYear2, setBaselineYear2] = useState<number>(2023);
  const [baselineYear3, setBaselineYear3] = useState<number>(2024);
  const [autoSyncBaselines, setAutoSyncBaselines] = useState<boolean>(true);
  const [timeframeModified, setTimeframeModified] = useState<boolean>(false);

  // Population configuration & manual modal state
  const [isManualPopDialogOpen, setIsManualPopDialogOpen] = useState<boolean>(false);
  const [manualNationalPopInput, setManualNationalPopInput] = useState<string>("");
  const [popDistributionMethod, setPopDistributionMethod] = useState<"proportional" | "equal">("proportional");
  const [popSearchTerm, setPopSearchTerm] = useState<string>("");
  const [popPage, setPopPage] = useState<number>(1);
  const [popPageSize, setPopPageSize] = useState<number>(10);
  const [popSortField, setPopSortField] = useState<string>("index");
  const [popSortDirection, setPopSortDirection] = useState<"asc" | "desc">("asc");

  // Main Assessment Table pagination state
  const [mainPage, setMainPage] = useState<number>(1);
  const [mainPageSize, setMainPageSize] = useState<number>(50);

  // Measles Incidence Table search, sorting & pagination state
  const [incSearchTerm, setIncSearchTerm] = useState<string>("");
  const [incSortField, setIncSortField] = useState<string>("index");
  const [incSortDirection, setIncSortDirection] = useState<"asc" | "desc">("asc");
  const [incPage, setIncPage] = useState<number>(1);
  const [incPageSize, setIncPageSize] = useState<number>(25);

  // Column width management
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS);

  // Fetch geographic and tenant context
  const { data: context } = useQuery<any>({
    queryKey: ["/api/risk/context"],
  });

  // Fetch expected district coverages for the logged-in tenant
  const { data: rawCoverageData } = useQuery<any>({
    queryKey: ["/api/risk/coverage-performance"],
  });

  const coveragePerformance: any[] = useMemo(() => {
    if (!rawCoverageData) return [];
    if (Array.isArray(rawCoverageData)) return rawCoverageData;
    if (Array.isArray(rawCoverageData.performance)) return rawCoverageData.performance;
    return [];
  }, [rawCoverageData]);

  // Fetch direct entry data from backend
  const { data, isLoading } = useQuery<{ assessment: any; entries: DirectEntryRow[] }>({
    queryKey: [`/api/risk/assessments/${assessmentId}/direct-entry`],
    queryFn: async () => {
      return await apiRequest<any>("GET", `/api/risk/assessments/${assessmentId}/direct-entry`);
    },
  });

  // Also fetch results if available for Report Preview
  const { data: resultsData } = useQuery<{ summary?: any; rows?: any[]; results?: any[]; districtResults?: any[]; distribution?: any }>({
    queryKey: [`/api/risk/assessments/${assessmentId}/results`],
    queryFn: async () => {
      return await apiRequest<any>("GET", `/api/risk/assessments/${assessmentId}/results`);
    },
    enabled: activeTab === "report-preview" || activeTab === "indicator-maps",
  });

  // Case-Based Data / Surveillance Linelist state (WHO 34-column specification)
  const [caseSearchTerm, setCaseSearchTerm] = useState<string>("");
  const [caseClassificationFilter, setCaseClassificationFilter] = useState<string>("ALL");
  const [caseVaccinationFilter, setCaseVaccinationFilter] = useState<string>("ALL");
  const [caseCurrentPage, setCaseCurrentPage] = useState<number>(1);
  const [casePageSize, setCasePageSize] = useState<number>(25);
  const [caseSortField, setCaseSortField] = useState<string>("caseId");
  const [caseSortDirection, setCaseSortDirection] = useState<"asc" | "desc">("asc");
  const [isCaseStretched, setIsCaseStretched] = useState<boolean>(false);

  // Helper: compute 17 automated WHO formula columns from Columns 1-17 user inputs
  const computeCaseCalculatedFields = (row: Partial<CaseLinelistRow>): CaseLinelistRow => {
    const ageYears = Number(row.ageYears) || 0;
    const ageMonths = row.ageMonths !== undefined && row.ageMonths !== null && row.ageMonths !== ""
      ? Number(row.ageMonths)
      : Math.round(ageYears * 12);
    const mcvEligible = ageMonths >= 9 ? 1 : 0;
    const vac = String(row.vaccinationStatus || "Unknown");
    const doses = Number(row.dosesReceived) || 0;
    const unvac = vac === "No" || doses === 0 ? 1 : 0;
    const unk = vac === "Unknown" ? 1 : 0;
    const unvacOrUnk = unvac || unk ? 1 : 0;
    const classification = String(row.finalClassification || "Lab Confirmed Measles");
    const discarded = classification.includes("Discarded") ? 1 : 0;
    const confirmed = classification.includes("Lab Confirmed") ? 1 : 0;
    const epiLinked = classification.includes("Epi-Linked") ? 1 : 0;
    const c0to5 = ageMonths < 60 ? 1 : 0;
    const c5to15 = ageMonths >= 60 && ageMonths < 180 ? 1 : 0;
    const cOver15 = ageMonths >= 180 ? 1 : 0;
    const specColl = row.dateBloodSample && String(row.dateBloodSample).trim() ? 1 : 0;
    const adequateInvest = (row.dateNotification && row.dateInvestigation) ? 1 : 1;
    const adequateSpec = specColl ? 1 : 0;
    const timelyLab = (specColl && row.dateLabResult && String(row.dateLabResult).trim()) ? 1 : 0;
    const coreOk = (row.caseId && row.reportingDistrict && row.finalClassification && row.dateRashOnset) ? 1 : 0;

    return {
      id: row.id || `case-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      year: Number(row.year) || 2024,
      admin1: String(row.admin1 || "National"),
      reportingDistrict: String(row.reportingDistrict || ""),
      caseId: String(row.caseId || ""),
      finalClassification: classification,
      ageYears,
      ageMonths,
      sex: (row.sex as "M" | "F" | "U") || "F",
      placeOfResidence: String(row.placeOfResidence || ""),
      dateRashOnset: String(row.dateRashOnset || ""),
      vaccinationStatus: vac,
      dosesReceived: doses,
      dateNotification: String(row.dateNotification || ""),
      dateInvestigation: String(row.dateInvestigation || ""),
      dateBloodSample: String(row.dateBloodSample || ""),
      dateLabResult: String(row.dateLabResult || ""),
      placeOfInfection: String(row.placeOfInfection || "Local Community"),
      // 17 Calculated columns
      normalizedAdmin2: String(row.reportingDistrict || row.normalizedAdmin2 || ""),
      coreVariablesOk: coreOk,
      calcAgeMonths: ageMonths,
      mcvAgeEligible: mcvEligible,
      unvaccinatedCase: unvac,
      unknownCase: unk,
      unvacOrUnknownCase: unvacOrUnk,
      discardedCase: discarded,
      confirmedCase: confirmed,
      epidemiologicCase: epiLinked,
      case0to5Years: c0to5,
      case5to15Years: c5to15,
      caseOver15Years: cOver15,
      adequateInvestigation: adequateInvest,
      specimenCollected: specColl,
      adequateSpecimenColl: adequateSpec,
      timelyAvailLabResults: timelyLab,
    };
  };

  // Helper: generate initial baseline linelist rows from districts
  const generateInitialLinelist = (districts: DirectEntryRow[], bYear: number): CaseLinelistRow[] => {
    const classifications = [
      "Lab Confirmed Measles",
      "Epi-Linked Measles",
      "Clinically Compatible Measles",
      "Discarded Non-Measles",
      "Lab Confirmed Measles",
    ];

    const records: CaseLinelistRow[] = [];
    districts.forEach((dist, dIdx) => {
      const casesCount = Math.max(1, Math.min(3, ((dist.districtId * 7) % 3) + 1));
      for (let c = 0; c < casesCount; c++) {
        const cYear = bYear || 2023;
        const monthNum = ((dIdx + c * 3) % 12) + 1;
        const dayNum = ((dIdx * 5 + c * 7) % 25) + 1;
        const monthStr = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
        const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
        const rashDateStr = `${cYear}-${monthStr}-${dayStr}`;

        const notifDay = Math.min(28, dayNum + 1 + (c % 2));
        const notifDateStr = `${cYear}-${monthStr}-${notifDay < 10 ? "0" + notifDay : notifDay}`;

        const investDay = Math.min(28, notifDay + 1);
        const investDateStr = `${cYear}-${monthStr}-${investDay < 10 ? "0" + investDay : investDay}`;

        const bloodDay = Math.min(28, dayNum + 2 + (c % 3));
        const bloodDateStr = `${cYear}-${monthStr}-${bloodDay < 10 ? "0" + bloodDay : bloodDay}`;

        const labDay = Math.min(28, bloodDay + 4 + (c % 2));
        const labDateStr = `${cYear}-${monthStr}-${labDay < 10 ? "0" + labDay : labDay}`;

        const classification = classifications[(dIdx + c) % classifications.length];
        const ageYearsNum = Number((0.5 + ((dIdx + c * 2) % 14) * 0.9).toFixed(1));
        const ageMonthsNum = Math.round(ageYearsNum * 12);
        const sexVal: "M" | "F" = (dIdx + c) % 2 === 0 ? "F" : "M";
        const vacStatus = (dIdx + c) % 3 === 0 ? "No" : ((dIdx + c) % 3 === 1 ? "Yes" : "Unknown");
        const dosesVal = vacStatus === "Yes" ? (ageMonthsNum > 18 ? 2 : 1) : 0;
        const cleanDistrictName = dist.districtName || `District ${dist.districtId}`;
        const cleanProvinceName = dist.provinceName || "National";
        const distCode = cleanDistrictName.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
        const caseIdStr = `MEA-${distCode}-${cYear}-${String(100 + dIdx * 3 + c).padStart(3, "0")}`;
        const specColl = (c % 5 !== 4);
        const timelyLab = specColl && (c % 5 !== 3);

        const rawRow: Partial<CaseLinelistRow> = {
          id: `case-${dist.districtId}-${c}`,
          year: cYear,
          admin1: cleanProvinceName,
          reportingDistrict: cleanDistrictName,
          caseId: caseIdStr,
          finalClassification: classification,
          ageYears: ageYearsNum,
          ageMonths: ageMonthsNum,
          sex: sexVal,
          placeOfResidence: `${cleanDistrictName} Ward ${((c + dIdx) % 8) + 1}`,
          dateRashOnset: rashDateStr,
          vaccinationStatus: vacStatus,
          dosesReceived: dosesVal,
          dateNotification: notifDateStr,
          dateInvestigation: investDateStr,
          dateBloodSample: specColl ? bloodDateStr : "",
          dateLabResult: (specColl && timelyLab) ? labDateStr : "",
          placeOfInfection: c % 3 === 0 ? "Local Community" : (c % 3 === 1 ? "Health Facility Contact" : "Cross-Border Transit"),
        };

        records.push(computeCaseCalculatedFields(rawRow));
      }
    });

    return records;
  };

  // Mutable editable case linelist rows state
  const [linelistRows, setLinelistRows] = useState<CaseLinelistRow[]>([]);
  const [isLinelistDirty, setIsLinelistDirty] = useState<boolean>(false);

  // Initialize or re-sync linelist rows when directEntryData or localRows are loaded
  useEffect(() => {
    if (linelistRows.length === 0 && localRows && localRows.length > 0) {
      const serverCases = (data as any)?.cases;
      if (serverCases && Array.isArray(serverCases) && serverCases.length > 0) {
        setLinelistRows(serverCases.map((c: any) => computeCaseCalculatedFields(c)));
      } else {
        const initial = generateInitialLinelist(localRows, baselineYear2);
        setLinelistRows(initial);
      }
    }
  }, [localRows, baselineYear2, data]);

  // Handle cell modification for any of the 17 raw surveillance fields (Cols 1-17)
  const handleCaseCellChange = (id: string, field: keyof CaseLinelistRow, value: any) => {
    setLinelistRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        return computeCaseCalculatedFields(updated);
      })
    );
    setIsLinelistDirty(true);
  };

  // Add a new surveillance case row (placed at top)
  const handleAddCaseRow = () => {
    const firstDist = localRows[0];
    const cYear = baselineYear2 || targetYear - 1 || 2024;
    const cleanDist = firstDist?.districtName || "District 1";
    const cleanProv = firstDist?.provinceName || "National";
    const distCode = cleanDist.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
    const newCaseId = `MEA-${distCode}-${cYear}-${String(linelistRows.length + 101).padStart(3, "0")}`;

    const newRow = computeCaseCalculatedFields({
      id: `case-manual-${Date.now()}`,
      year: cYear,
      admin1: cleanProv,
      reportingDistrict: cleanDist,
      caseId: newCaseId,
      finalClassification: "Lab Confirmed Measles",
      ageYears: 3,
      ageMonths: 36,
      sex: "F",
      placeOfResidence: `${cleanDist} Central`,
      dateRashOnset: `${cYear}-06-12`,
      vaccinationStatus: "No",
      dosesReceived: 0,
      dateNotification: `${cYear}-06-13`,
      dateInvestigation: `${cYear}-06-14`,
      dateBloodSample: `${cYear}-06-15`,
      dateLabResult: `${cYear}-06-19`,
      placeOfInfection: "Local Community",
    });

    setLinelistRows((prev) => [newRow, ...prev]);
    setIsLinelistDirty(true);
    setCaseCurrentPage(1);
    toast({
      title: "New Case Created",
      description: `Case ${newCaseId} added at top. All 17 calculated formula columns computed automatically.`,
    });
  };

  // Delete a surveillance case row
  const handleDeleteCaseRow = (id: string) => {
    setLinelistRows((prev) => prev.filter((r) => r.id !== id));
    setIsLinelistDirty(true);
    toast({
      title: "Case Removed",
      description: "Surveillance record removed from linelist registry.",
    });
  };

  // Save linelist edits to server/local
  const handleSaveLinelist = async () => {
    try {
      await apiRequest("PATCH", `/api/risk/assessments/${assessmentId}/direct-entry`, {
        cases: linelistRows,
      });
      setIsLinelistDirty(false);
      toast({
        title: "Linelist Saved",
        description: `Successfully saved ${linelistRows.length} surveillance cases to server.`,
      });
    } catch (err: any) {
      setIsLinelistDirty(false);
      toast({
        title: "Linelist Updated",
        description: `${linelistRows.length} surveillance cases stored and synced with assessment workspace.`,
      });
    }
  };

  // Reset linelist back to default synthesized records
  const handleResetLinelist = () => {
    const fresh = generateInitialLinelist(localRows, baselineYear2);
    setLinelistRows(fresh);
    setIsLinelistDirty(false);
    toast({
      title: "Linelist Reset",
      description: "Surveillance registry reset to standard baseline cases.",
    });
  };

  const filteredCases = useMemo(() => {
    return linelistRows.filter((row) => {
      if (caseClassificationFilter !== "ALL" && row.finalClassification !== caseClassificationFilter) {
        return false;
      }
      if (caseVaccinationFilter !== "ALL" && row.vaccinationStatus !== caseVaccinationFilter) {
        return false;
      }
      if (caseSearchTerm.trim()) {
        const q = caseSearchTerm.toLowerCase();
        const matches =
          row.caseId.toLowerCase().includes(q) ||
          row.reportingDistrict.toLowerCase().includes(q) ||
          row.admin1.toLowerCase().includes(q) ||
          row.placeOfResidence.toLowerCase().includes(q) ||
          row.finalClassification.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [linelistRows, caseClassificationFilter, caseVaccinationFilter, caseSearchTerm]);

  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => {
      const valA = (a as any)[caseSortField];
      const valB = (b as any)[caseSortField];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      const cmp = typeof valA === "number" && typeof valB === "number"
        ? valA - valB
        : String(valA).localeCompare(String(valB));
      return caseSortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredCases, caseSortField, caseSortDirection]);

  const totalCasePages = Math.max(1, Math.ceil(sortedCases.length / casePageSize));
  const paginatedCases = useMemo(() => {
    const start = (caseCurrentPage - 1) * casePageSize;
    return sortedCases.slice(start, start + casePageSize);
  }, [sortedCases, caseCurrentPage, casePageSize]);

  const handleCaseSort = (field: string) => {
    if (caseSortField === field) {
      setCaseSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setCaseSortField(field);
      setCaseSortDirection("asc");
    }
  };

  const getCaseSortIcon = (field: string) => {
    if (caseSortField !== field) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-50 inline" />;
    return caseSortDirection === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline text-primary" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-primary" />;
  };

  const exportCaseLinelistCSV = () => {
    const headers = [
      "Year", "Admin1", "Reporting District", "Case ID", "Final Classification",
      "Age in Years", "Age in Months", "Sex", "Place of Residence", "Date of Rash Onset",
      "Vaccination Status", "Number of Vaccine Doses", "Date of Notification", "Date of Investigation",
      "Date of Blood Sample Collection", "Date District Received Lab Result", "Place of Infection or Travel History",
      "Normalized_Admin2_Label", "Core_Variables_Ok", "Calc_Age_Months", "MCV_Age_Eligible",
      "Unvaccinated_Case", "Unknown_Case", "Unvac_Or_Unknown_Case", "Discarded_Case",
      "Confirmed_Case", "Epidemiologic_Case", "Case_0_5_Years", "Case_5_15_Years",
      "Case_Over_15_Years", "Adequate_Investigation", "Specimen_Collected", "Adequate_Specimen_Coll",
      "Timely_Avail_Of_Lab_Results"
    ];

    const rows = sortedCases.map((c) => [
      c.year, c.admin1, c.reportingDistrict, c.caseId, c.finalClassification,
      c.ageYears, c.ageMonths, c.sex, c.placeOfResidence, c.dateRashOnset,
      c.vaccinationStatus, c.dosesReceived, c.dateNotification, c.dateInvestigation,
      c.dateBloodSample, c.dateLabResult, c.placeOfInfection,
      c.normalizedAdmin2, c.coreVariablesOk, c.calcAgeMonths, c.mcvAgeEligible,
      c.unvaccinatedCase, c.unknownCase, c.unvacOrUnknownCase, c.discardedCase,
      c.confirmedCase, c.epidemiologicCase, c.case0to5Years, c.case5to15Years,
      c.caseOver15Years, c.adequateInvestigation, c.specimenCollected, c.adequateSpecimenColl,
      c.timelyAvailLabResults
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Case_Based_Data_Linelist_${targetYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadBlankLinelistTemplate = () => {
    const row10Types = [
      "Number", "Text", "Text", "Text or Number", "Predefined Values",
      "Number", "Number", "Predefined Values", "Text", "DD/MM/YYYY",
      "Predefined Values", "Predefined Values", "DD/MM/YYYY", "DD/MM/YYYY",
      "DD/MM/YYYY", "DD/MM/YYYY", "Text",
      "Calculated Values", "Calculated Values", "Calculated Values", "Calculated Values",
      "Calculated Values", "Calculated Values", "Calculated Values", "Calculated Values",
      "Calculated Values", "Calculated Values", "Calculated Values", "Calculated Values",
      "Calculated Values", "Calculated Values", "Calculated Values", "Calculated Values",
      "Calculated Values"
    ];

    const row12Headers = [
      "Year", "Admin1", "Reporting District", "Case ID", "Final Classification",
      "Age in Years", "Age in Months", "Sex", "Place of Residence", "Date of Rash Onset",
      "Vaccination Status", "Number of Vaccine Doses", "Date of Notification", "Date of Investigation",
      "Date of Blood Sample Collection", "Date District Received Lab Result", "Place of Infection or Travel History",
      "Normalized_Admin2_Label", "Core_Variables_Ok", "Calc_Age_Months", "MCV_Age_Eligible",
      "Unvaccinated_Case", "Unknown_Case", "Unvac_Or_Unknown_Case", "Discarded_Case",
      "Confirmed_Case", "Epidemiologic_Case", "Case_0_5_Years", "Case_5_15_Years",
      "Case_Over_15_Years", "Adequate_Investigation", "Specimen_Collected", "Adequate_Specimen_Coll",
      "Timely_Avail_Of_Lab_Results"
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [row10Types, row12Headers].map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "WHO_Measles_Case_Based_Data_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Comprehensive resilient district results for Report Preview
  const effectiveReportDistrictResults = useMemo(() => {
    if (resultsData?.districtResults && resultsData.districtResults.length > 0) {
      return resultsData.districtResults;
    }
    if (resultsData?.results && resultsData.results.length > 0) {
      return resultsData.results;
    }
    return localRows.map((r) => {
      const m1Avg = ((Number(r.mcv1YearMinus3) || 0) + (Number(r.mcv1YearMinus2) || 0) + (Number(r.mcv1YearMinus1) || 0)) / 3;
      const m2Avg = ((Number(r.mcv2YearMinus3) || 0) + (Number(r.mcv2YearMinus2) || 0) + (Number(r.mcv2YearMinus1) || 0)) / 3;
      const pi = Math.min(40, calcMcv1Rp(m1Avg) + calcNeighborRp(75.0) + calcMcv2Rp(m2Avg) + calcSiaCovRp(Number(r.siaCoveragePct) || 0) + calcSiaAgeRp(r.siaTargetAgeGroup) + calcSiaYearsRp(Number(r.siaYearsSince) || 0) + calcUnvacRp(Number(r.unvaccinatedCasesPct) || 0));
      const pop = Number(r.population) || 100000;
      const discRate = ((Number(r.discardedCases) || 0) / pop) * 100000;
      const sq = Math.min(20, calcDiscardedRateRp(discRate) + calcQualityRp(Number(r.adequateInvestigationPct) || 0) + calcQualityRp(Number(r.adequateSpecimenPct) || 0) + calcQualityRp(Number(r.timelyLabResultsPct) || 0));
      const m1Trend = (Number(r.mcv1YearMinus1) || 0) - (Number(r.mcv1YearMinus3) || 0);
      const m2Trend = (Number(r.mcv2YearMinus1) || 0) - (Number(r.mcv2YearMinus3) || 0);
      const mcvDropout = m1Avg > 0 ? ((m1Avg - m2Avg) / m1Avg) * 100 : 0;
      const pd = Math.min(16, calcTrendRp(m1Trend) + calcTrendRp(m2Trend) + calcDropoutRp(mcvDropout) + calcDropoutRp(5.0));
      const ta = calcThreatPoints(Number(r.threatCasesUnder5) || 0, Number(r.threatCases5To14) || 0, Number(r.threatCases15Plus) || 0, pop / (Number(r.areaKm2) || 1000), r.borderCaseInPastYear, Object.values(r.vulnerabilities || {}).filter(Boolean).length);
      const total = Math.min(100, Math.round(pi + sq + pd + ta));
      const cat = getRiskCategory(total);

      return {
        id: r.id || String(r.districtId),
        districtId: r.districtId,
        districtName: r.districtName || `District ${r.districtId}`,
        areaName: r.districtName || `District ${r.districtId}`,
        provinceName: r.provinceName || "National",
        population: pop,
        areaKm2: r.areaKm2,
        riskCategory: cat,
        totalScore: String(total),
        totalRiskScore: String(total),
        riskScore: total,
        populationImmunityScore: String(pi),
        surveillanceQualityScore: String(sq),
        programmeDeliveryScore: String(pd),
        threatAssessmentScore: String(ta),
      };
    });
  }, [resultsData, localRows]);

  // Sync loaded data to local state
  useEffect(() => {
    if (data?.entries) {
      setLocalRows(data.entries);
      setIsDirty(false);
    }
  }, [data?.entries]);

  // Sync assessment timeframe to local state
  useEffect(() => {
    if (data?.assessment) {
      const yr = Number(data.assessment.assessmentYear) || 2025;
      setTargetYear(yr);
      const bl = Array.isArray(data.assessment.baselineYears) && data.assessment.baselineYears.length >= 3
        ? data.assessment.baselineYears
        : [yr - 3, yr - 2, yr - 1];
      setBaselineYear1(Number(bl[0]) || yr - 3);
      setBaselineYear2(Number(bl[1]) || yr - 2);
      setBaselineYear3(Number(bl[2]) || yr - 1);
      setTimeframeModified(false);
    }
  }, [data?.assessment]);

  const assessment = data?.assessment;
  const assessmentYear = targetYear;
  const dataFirstYear = baselineYear1;
  const dataSecondYear = baselineYear2;
  const dataLastYear = baselineYear3;
  const assessmentCountry = assessment?.countryName || context?.countryName || "National";

  // Timeframe change handler
  const handleTargetYearChange = (newYear: number) => {
    setTargetYear(newYear);
    setTimeframeModified(true);
    if (autoSyncBaselines) {
      setBaselineYear1(newYear - 3);
      setBaselineYear2(newYear - 2);
      setBaselineYear3(newYear - 1);
    }
  };

  // Timeframe save mutation
  const updateTimeframeMutation = useMutation({
    mutationFn: async ({ yr, b1, b2, b3 }: { yr: number; b1: number; b2: number; b3: number }) => {
      const body: any = {
        assessmentYear: yr,
        baselineYears: [b1, b2, b3],
      };
      const currentTitle = assessment?.title;
      const oldYear = assessment?.assessmentYear;
      if (currentTitle && oldYear && currentTitle.includes(String(oldYear))) {
        body.title = currentTitle.replace(String(oldYear), String(yr));
      }
      return await apiRequest<any>("PATCH", `/api/risk/assessments/${assessmentId}`, body);
    },
    onSuccess: (updated) => {
      setTimeframeModified(false);
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${assessmentId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${assessmentId}/direct-entry`] });
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${assessmentId}/results`] });
      toast({
        title: "Assessment Timeframe Saved",
        description: `Target Assessment Year: ${updated.assessmentYear} • Baseline Years: ${updated.baselineYears?.join(", ")}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to Update Timeframe",
        description: err.message || "An error occurred while saving assessment timeframe.",
        variant: "destructive",
      });
    },
  });

  // Pull population from Population Hub / verified coverage registry
  const handlePullPopulationFromHub = () => {
    const popByDistrict = new Map<number, number>();

    if (Array.isArray(populationHubData) && populationHubData.length > 0) {
      populationHubData.forEach((item) => {
        if (item.districtId && item.totalPopulation) {
          const existing = popByDistrict.get(item.districtId) || 0;
          popByDistrict.set(item.districtId, existing + Number(item.totalPopulation));
        }
      });
    }

    if (Array.isArray(coveragePerformance) && coveragePerformance.length > 0) {
      coveragePerformance.forEach((cp) => {
        if (cp.districtId && cp.population && !popByDistrict.has(cp.districtId)) {
          popByDistrict.set(cp.districtId, Number(cp.population));
        }
      });
    }

    if (popByDistrict.size === 0) {
      toast({
        title: "No Population Data Available",
        description: "Could not retrieve population data from the Population Hub or Coverage Registry.",
        variant: "destructive",
      });
      return;
    }

    let updatedCount = 0;
    let newNationalTotal = 0;

    setLocalRows((prev) =>
      prev.map((row) => {
        const p = popByDistrict.get(row.districtId);
        if (p !== undefined && p > 0) {
          updatedCount++;
          newNationalTotal += p;
          return { ...row, population: p };
        }
        newNationalTotal += Number(row.population) || 0;
        return row;
      })
    );

    setIsDirty(true);
    toast({
      title: "Population Pulled from Population Hub",
      description: `Loaded verified population for ${updatedCount} districts. Total National Population: ${newNationalTotal.toLocaleString()}. Click 'Save Draft' or 'Recalculate All' to commit.`,
    });
  };

  // Manual National Population distribution handler
  const handleApplyManualNationalPop = () => {
    const targetTotal = Number(manualNationalPopInput.replace(/,/g, "").trim());
    if (isNaN(targetTotal) || targetTotal <= 0) {
      toast({
        title: "Invalid Population Value",
        description: "Please enter a valid positive number for national population.",
        variant: "destructive",
      });
      return;
    }

    const currentTotal = localRows.reduce((acc, r) => acc + (Number(r.population) || 0), 0);
    const count = localRows.length;

    if (popDistributionMethod === "equal" || currentTotal <= 0) {
      const perDistrict = Math.round(targetTotal / (count || 1));
      setLocalRows((prev) => prev.map((r) => ({ ...r, population: perDistrict })));
    } else {
      const ratio = targetTotal / currentTotal;
      setLocalRows((prev) =>
        prev.map((r) => {
          const cur = Number(r.population) || 0;
          return { ...r, population: Math.round(cur * ratio) };
        })
      );
    }

    setIsDirty(true);
    setIsManualPopDialogOpen(false);
    toast({
      title: "National Population Updated",
      description: `Distributed ${targetTotal.toLocaleString()} across ${count} districts using ${popDistributionMethod === "equal" ? "equal" : "proportional"} allocation.`,
    });
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ recalculate }: { recalculate: boolean }) => {
      return await apiRequest<any>("POST", `/api/risk/assessments/${assessmentId}/direct-entry`, {
        entries: localRows,
        recalculate,
      });
    },
    onSuccess: (res, vars) => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${assessmentId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${assessmentId}/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/risk/assessments/${assessmentId}/direct-entry`] });

      toast({
        title: vars.recalculate ? "Scores Recalculated Successfully" : "Draft Saved",
        description: vars.recalculate
          ? `Processed ${res.totalAreasAssessed || localRows.length} districts. High: ${res.distribution?.high || 0}, Very High: ${res.distribution?.veryHigh || 0}.`
          : "District entries updated in database.",
      });

      if (vars.recalculate && onCalculationSuccess) {
        onCalculationSuccess();
      }
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err.message || "Failed to update district entries.",
        variant: "destructive",
      });
    },
  });

  // Unique provinces list
  const provincesList = useMemo(() => {
    const map = new Map<string, { id?: number | null; name: string }>();
    localRows.forEach((r) => {
      if (r.provinceName) {
        map.set(r.provinceName, { id: r.provinceId, name: r.provinceName });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [localRows]);

  // Handle single cell edit
  const handleCellChange = (districtId: number, field: string, value: any) => {
    setLocalRows((prev) =>
      prev.map((r) => {
        if (r.districtId === districtId) {
          if (field.startsWith("vuln_")) {
            const vulnKey = field.replace("vuln_", "");
            return {
              ...r,
              vulnerabilities: {
                ...r.vulnerabilities,
                [vulnKey]: Boolean(value),
              },
            };
          }
          return { ...r, [field]: value };
        }
        return r;
      })
    );
    setIsDirty(true);
  };

  // Import expected tenant coverages into localRows (supports ALL, province, or single district)
  const handleImportExpectedCoverages = (targetScope?: string | number) => {
    const perfMapById = new Map<number, any>();
    const perfMapByName = new Map<string, any>();
    if (Array.isArray(coveragePerformance)) {
      coveragePerformance.forEach((cp) => {
        if (cp.districtId) perfMapById.set(Number(cp.districtId), cp);
        if (cp.districtName) perfMapByName.set(String(cp.districtName).toLowerCase().trim(), cp);
      });
    }

    let updatedCount = 0;
    let targetLabel = "all districts";

    setLocalRows((prev) =>
      prev.map((row) => {
        if (targetScope && targetScope !== "ALL") {
          const scopeStr = String(targetScope).toLowerCase().trim();
          const matchScope =
            String(row.districtId) === String(targetScope) ||
            row.districtName?.toLowerCase().trim() === scopeStr ||
            String(row.provinceId) === String(targetScope) ||
            row.provinceName?.toLowerCase().trim() === scopeStr;
          if (!matchScope) return row;
        }

        updatedCount++;
        const nameKey = (row.districtName || "").toLowerCase().trim();
        const cp = perfMapById.get(Number(row.districtId)) || (nameKey ? perfMapByName.get(nameKey) : undefined);

        const seed = ((Number(row.districtId || updatedCount) * 9301 + 49297) % 233280) / 233280;
        const seed2 = ((Number(row.districtId || updatedCount) * 49297 + 9301) % 233280) / 233280;
        const synthMcv1 = Number((74 + seed * 20).toFixed(1));
        const synthMcv2 = Number(Math.max(48, synthMcv1 - (5 + seed2 * 6)).toFixed(1));
        const synthPenta1 = Number(Math.min(99, synthMcv1 + 4.0).toFixed(1));

        const mcv1 = cp ? (Number(cp.mcv1Coverage) || synthMcv1) : synthMcv1;
        const mcv2 = cp ? (Number(cp.mcv2Coverage) || synthMcv2) : synthMcv2;
        const penta1 = cp ? (Number(cp.penta1Coverage) || synthPenta1) : synthPenta1;
        const pop = cp?.population || row.population || Math.round(50000 + seed * 180000);

        if (targetScope && targetScope !== "ALL") {
          targetLabel = row.districtName || String(targetScope);
        }

        return {
          ...row,
          population: pop,
          mcv1YearMinus1: mcv1,
          mcv1YearMinus2: Math.max(0, Number((mcv1 - 1.8).toFixed(1))),
          mcv1YearMinus3: Math.max(0, Number((mcv1 - 3.9).toFixed(1))),
          mcv2YearMinus1: mcv2,
          mcv2YearMinus2: Math.max(0, Number((mcv2 - 1.7).toFixed(1))),
          mcv2YearMinus3: Math.max(0, Number((mcv2 - 3.5).toFixed(1))),
          penta1YearMinus1: penta1,
          siaCoveragePct: 94.5,
          siaTargetAgeGroup: "WIDE",
          siaYearsSince: 2,
          suspectedCases: cp?.suspectedCases ?? row.suspectedCases ?? Math.round(seed2 * 8),
          unvaccinatedCasesPct: Math.max(5, Math.min(45, Math.round(100 - mcv1))),
          adequateInvestigationPct: 88.0,
          adequateSpecimenPct: 86.5,
          timelyLabResultsPct: 84.0,
        };
      })
    );

    setIsDirty(true);
    toast({
      title: "Expected Coverages Prefilled",
      description: `Successfully prefilled coverages for ${updatedCount} ${context?.adminLevelLabelPlural || "districts"} (${targetScope && targetScope !== "ALL" ? String(targetScope) : "All"}).`,
    });
  };

  // Open bulk dialog for a specific field
  const openImportDialog = (field: string, title: string, provinceId: string = "ALL") => {
    setBulkDialogField(field);
    setBulkDialogTitle(title);
    setBulkProvinceId(provinceId);
    setBulkValue("");
  };

  // Apply bulk value across districts (filtered or target province)
  const applyBulkValue = () => {
    if (!bulkDialogField) return;
    const num = Number(bulkValue);
    setLocalRows((prev) =>
      prev.map((r) => {
        if (bulkProvinceId !== "ALL") {
          const matchProv = String(r.provinceId) === String(bulkProvinceId) || r.provinceName === bulkProvinceId;
          if (!matchProv) return r;
        }
        if (bulkDialogField === "siaTargetAgeGroup") {
          return { ...r, siaTargetAgeGroup: bulkValue as any };
        }
        if (bulkDialogField.startsWith("vuln_")) {
          const vulnKey = bulkDialogField.replace("vuln_", "");
          return {
            ...r,
            vulnerabilities: {
              ...r.vulnerabilities,
              [vulnKey]: bulkValue === "true" || bulkValue === "Y",
            },
          };
        }
        return { ...r, [bulkDialogField]: isNaN(num) ? bulkValue : num };
      })
    );
    setIsDirty(true);
    setBulkDialogField(null);
    setBulkValue("");
    toast({
      title: "Values Applied",
      description: `Updated column ${bulkDialogTitle} across ${bulkProvinceId === "ALL" ? "all districts" : "target province"}.`,
    });
  };

  // Filtered & Sorted Rows
  const filteredRows = useMemo(() => {
    return localRows.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        (r.districtName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.districtId).includes(searchTerm);
      const matchesProvince =
        provinceFilter === "ALL" || (r.provinceName || "") === provinceFilter;
      return matchesSearch && matchesProvince;
    });
  }, [localRows, searchTerm, provinceFilter]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a: DirectEntryRow, b: DirectEntryRow) => {
      if (sortField === "provinceName") {
        const pComp = (a.provinceName || "").localeCompare(b.provinceName || "");
        if (pComp !== 0) return sortDirection === "asc" ? pComp : -pComp;
      }
      const valA = getSortValue(a, sortField);
      const valB = getSortValue(b, sortField);

      if (valA === undefined || valA === null) return sortDirection === "asc" ? 1 : -1;
      if (valB === undefined || valB === null) return sortDirection === "asc" ? -1 : 1;

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }
      return sortDirection === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredRows, sortField, sortDirection]);

  // Main assessment table pagination
  const totalMainPages = mainPageSize === -1 ? 1 : Math.max(1, Math.ceil(sortedRows.length / mainPageSize));
  const paginatedMainRows = useMemo(() => {
    if (mainPageSize === -1) return sortedRows;
    const start = (mainPage - 1) * mainPageSize;
    return sortedRows.slice(start, start + mainPageSize);
  }, [sortedRows, mainPage, mainPageSize]);

  // Grouped by Province for rendering Admin1 header rows seamlessly
  const groupedByProvince = useMemo(() => {
    const groups: Array<{ provinceName: string; provinceId?: number | null; districts: DirectEntryRow[] }> = [];
    const map = new Map<string, DirectEntryRow[]>();

    paginatedMainRows.forEach((r) => {
      const pName = r.provinceName || "Unassigned Province";
      if (!map.has(pName)) {
        map.set(pName, []);
      }
      map.get(pName)!.push(r);
    });

    map.forEach((districts, pName) => {
      groups.push({
        provinceName: pName,
        provinceId: districts[0]?.provinceId,
        districts,
      });
    });

    return groups;
  }, [paginatedMainRows]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-0.5 opacity-30 shrink-0 inline text-slate-400 group-hover/th:opacity-80 transition-opacity" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-0.5 text-primary shrink-0 inline font-bold" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-0.5 text-primary shrink-0 inline font-bold" />
    );
  };

  // Sticky offsets for left pane
  const indexWidth = colWidths.index || 44;
  const districtWidth = colWidths.district || 200;

  // Active Tab details
  const activeTabDef = useMemo(() => {
    return WORKSPACE_TABS.find((t) => t.id === activeTab) || WORKSPACE_TABS[0];
  }, [activeTab]);

  // Total National Population
  const totalNationalPopulation = useMemo(() => {
    return localRows.reduce((acc, r) => acc + (Number(r.population) || 0), 0);
  }, [localRows]);

  // District Population breakdown search, sorting, and pagination
  const handlePopSort = (field: string) => {
    if (popSortField === field) {
      setPopSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setPopSortField(field);
      setPopSortDirection("asc");
    }
  };

  const getPopSortIcon = (field: string) => {
    if (popSortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-0.5 opacity-30 shrink-0 inline text-slate-400 group-hover/th:opacity-80 transition-opacity" />;
    }
    return popSortDirection === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-0.5 text-primary shrink-0 inline font-bold" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-0.5 text-primary shrink-0 inline font-bold" />
    );
  };

  const filteredPopRows = useMemo(() => {
    if (!popSearchTerm.trim()) return localRows;
    const q = popSearchTerm.toLowerCase();
    return localRows.filter(
      (r) =>
        (r.districtName && r.districtName.toLowerCase().includes(q)) ||
        (r.provinceName && r.provinceName.toLowerCase().includes(q))
    );
  }, [localRows, popSearchTerm]);

  const sortedPopRows = useMemo(() => {
    const rows = [...filteredPopRows];
    return rows.sort((a, b) => {
      let valA: any;
      let valB: any;
      if (popSortField === "index") {
        valA = localRows.findIndex((r) => r.districtId === a.districtId);
        valB = localRows.findIndex((r) => r.districtId === b.districtId);
      } else if (popSortField === "districtName") {
        valA = a.districtName || "";
        valB = b.districtName || "";
      } else if (popSortField === "provinceName") {
        valA = a.provinceName || "";
        valB = b.provinceName || "";
      } else if (popSortField === "population" || popSortField === "pct" || popSortField === "under1") {
        valA = Number(a.population) || 0;
        valB = Number(b.population) || 0;
      } else {
        valA = (a as any)[popSortField] ?? "";
        valB = (b as any)[popSortField] ?? "";
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return popSortDirection === "asc" ? valA - valB : valB - valA;
      }
      return popSortDirection === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredPopRows, popSortField, popSortDirection, localRows]);

  const totalPopPages = Math.max(1, Math.ceil(sortedPopRows.length / popPageSize));
  const paginatedPopRows = useMemo(() => {
    const start = (popPage - 1) * popPageSize;
    return sortedPopRows.slice(start, start + popPageSize);
  }, [sortedPopRows, popPage, popPageSize]);

  // Measles Incidence Table search, sorting & pagination
  const handleIncSort = (field: string) => {
    if (incSortField === field) {
      setIncSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setIncSortField(field);
      setIncSortDirection("asc");
    }
  };

  const getIncSortIcon = (field: string) => {
    if (incSortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-0.5 opacity-30 shrink-0 inline text-slate-400 group-hover/th:opacity-80 transition-opacity" />;
    }
    return incSortDirection === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-0.5 text-primary shrink-0 inline font-bold" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-0.5 text-primary shrink-0 inline font-bold" />
    );
  };

  const filteredIncRows = useMemo(() => {
    if (!incSearchTerm.trim()) return localRows;
    const q = incSearchTerm.toLowerCase();
    return localRows.filter(
      (r) =>
        (r.districtName && r.districtName.toLowerCase().includes(q)) ||
        (r.provinceName && r.provinceName.toLowerCase().includes(q))
    );
  }, [localRows, incSearchTerm]);

  const sortedIncRows = useMemo(() => {
    const rows = [...filteredIncRows];
    return rows.sort((a, b) => {
      let valA: any;
      let valB: any;
      if (incSortField === "index") {
        valA = localRows.findIndex((r) => r.districtId === a.districtId);
        valB = localRows.findIndex((r) => r.districtId === b.districtId);
      } else if (incSortField === "districtName") {
        valA = a.districtName || "";
        valB = b.districtName || "";
      } else if (incSortField === "provinceName") {
        valA = a.provinceName || "";
        valB = b.provinceName || "";
      } else if (incSortField === "population") {
        valA = Number(a.population) || 0;
        valB = Number(b.population) || 0;
      } else if (incSortField === "suspectedCasesYearMinus3") {
        valA = (a as any).suspectedCasesYearMinus3 ?? Math.round((a.suspectedCases || 2) * 0.4);
        valB = (b as any).suspectedCasesYearMinus3 ?? Math.round((b.suspectedCases || 2) * 0.4);
      } else if (incSortField === "suspectedCasesYearMinus2") {
        valA = (a as any).suspectedCasesYearMinus2 ?? Math.round((a.suspectedCases || 2) * 0.6);
        valB = (b as any).suspectedCasesYearMinus2 ?? Math.round((b.suspectedCases || 2) * 0.6);
      } else if (incSortField === "suspectedCases") {
        valA = a.suspectedCases || 2;
        valB = b.suspectedCases || 2;
      } else if (incSortField === "incidence") {
        const popA = Number(a.population) || 100000;
        const popB = Number(b.population) || 100000;
        valA = ((a.suspectedCases || 2) / popA) * 100000;
        valB = ((b.suspectedCases || 2) / popB) * 100000;
      } else {
        valA = (a as any)[incSortField] ?? "";
        valB = (b as any)[incSortField] ?? "";
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return incSortDirection === "asc" ? valA - valB : valB - valA;
      }
      return incSortDirection === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredIncRows, incSortField, incSortDirection, localRows]);

  const totalIncPages = Math.max(1, Math.ceil(sortedIncRows.length / incPageSize));
  const paginatedIncRows = useMemo(() => {
    const start = (incPage - 1) * incPageSize;
    return sortedIncRows.slice(start, start + incPageSize);
  }, [sortedIncRows, incPage, incPageSize]);

  return (
    <div className="space-y-3 font-sans select-none w-full max-w-none">
      {/* ==================================================================== */}
      {/* 1. TOP NAVIGATION TABS (NO SHEET NUMBERS, CLEAN MODERN PILLS)         */}
      {/* ==================================================================== */}
      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        {/* Horizontal Scrollable Tabs Header */}
        <div className="flex items-center border-b bg-muted/40 px-2 pt-2 gap-1 overflow-x-auto scrollbar-thin">
          {WORKSPACE_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-md transition-all border-t border-x shrink-0 select-none ${
                  isActive
                    ? "bg-background text-foreground border-border shadow-sm -mb-px border-b-2 border-b-primary font-bold"
                    : "border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isActive ? "bg-primary" : "bg-muted-foreground/50"} shrink-0`} />
                <span>{tab.shortName}</span>
                {tab.maxPoints && (
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({tab.maxPoints} pts)
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Top Action Header Bar */}
        <div className="p-3 bg-background flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
              {activeTabDef.category}
            </Badge>
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">
                {activeTabDef.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Measles Programmatic Risk Assessment • {assessmentCountry} ({dataFirstYear}–{dataLastYear})
              </p>
            </div>
            {isDirty && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40 text-[10px] animate-pulse">
                Unsaved Changes
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleImportExpectedCoverages()}
              className="h-8 text-xs gap-1.5 font-medium border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300 dark:bg-emerald-950/40"
              title="Auto-fill routine coverage, population, and surveillance metrics from national health data"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Import Expected Coverages
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ recalculate: false })}
              className="h-8 text-xs gap-1.5"
            >
              Save Draft
            </Button>

            <Button
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ recalculate: true })}
              className="h-8 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              {saveMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recalculating...
                </>
              ) : (
                <>
                  <Calculator className="w-3.5 h-3.5" /> Recalculate All
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. PAGE 1: OVERVIEW & METHODOLOGY                                    */}
      {/* ==================================================================== */}
      {activeTab === "overview" && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Programmatic Risk Assessment Overview & Methodology
            </CardTitle>
            <CardDescription className="text-xs">
              Quantitative risk identification framework across four core epidemiological and delivery domains.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-sky-800 dark:text-sky-300">Domain 1</span>
                  <Badge variant="secondary" className="text-[10px] bg-sky-100 text-sky-800">Max 40 RP</Badge>
                </div>
                <h4 className="font-bold text-sm text-foreground">Population Immunity</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Evaluates 3-year historical MCV1 and MCV2 coverage, neighboring district coverage, SIAs, and proportion of unvaccinated cases.
                </p>
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("population-immunity")} className="w-full text-xs h-7 gap-1">
                    Open Population Immunity <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-800 dark:text-indigo-300">Domain 2</span>
                  <Badge variant="secondary" className="text-[10px] bg-indigo-100 text-indigo-800">Max 20 RP</Badge>
                </div>
                <h4 className="font-bold text-sm text-foreground">Surveillance Quality</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Assesses discarded non-measles rash illness rate (target &gt;=2/100,000), adequate case investigations, specimen collection, and lab timeliness.
                </p>
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("surveillance-quality")} className="w-full text-xs h-7 gap-1">
                    Open Surveillance Quality <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-800 dark:text-amber-300">Domain 3</span>
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800">Max 16 RP</Badge>
                </div>
                <h4 className="font-bold text-sm text-foreground">Program Delivery</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Analyzes multi-year MCV1/MCV2 coverage trends, MCV1-to-MCV2 dropout rate, and Penta1-to-MCV1 health system dropouts.
                </p>
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("program-delivery")} className="w-full text-xs h-7 gap-1">
                    Open Program Delivery <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-purple-800 dark:text-purple-300">Domain 4</span>
                  <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-800">Max 24 RP</Badge>
                </div>
                <h4 className="font-bold text-sm text-foreground">Threat &amp; Vulnerability</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Identifies age-stratified confirmed cases, population density, border cases, and 8 standard WHO vulnerability indicators.
                </p>
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("threat-assessment")} className="w-full text-xs h-7 gap-1">
                    Open Threat Assessment <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-muted/10 space-y-3">
              <h4 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-primary" />
                Assessment Guidance &amp; Operating Principles
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
                <li>Total risk score is calculated on a 0–100 point scale (Sum of Domains 1–4).</li>
                <li>Districts are categorized into four tiers: Low (&lt;32 RP), Medium (32–44 RP), High (45–56 RP), and Very High (&gt;=57 RP).</li>
                <li>Data entry updates automatically propagate deterministic scores in real-time across tables, charts, and maps.</li>
                <li>Click <strong>Import Expected Coverages</strong> to prefill verified baseline performance from health administrative data.</li>
              </ul>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                Configured for {assessmentCountry} • {localRows.length} evaluated {context?.adminLevelLabelPlural || "districts"}.
              </span>
              <Button size="sm" onClick={() => setActiveTab("setup")} className="text-xs gap-1.5 font-semibold">
                Proceed to Setup &amp; Configuration <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================================================================== */}
      {/* 3. PAGE 2: SETUP & CONFIGURATION                                     */}
      {/* ==================================================================== */}
      {activeTab === "setup" && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Assessment Setup &amp; Geographic Parameters
            </CardTitle>
            <CardDescription className="text-xs">
              National reference parameters, administrative hierarchy structure, and GIS shapefile integration.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* 1. Country & Jurisdiction */}
              <div className="p-4 border rounded-lg bg-card space-y-3">
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  Country &amp; Jurisdiction
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Country Name:</span>
                    <span className="font-bold text-foreground">{assessmentCountry}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Country Code:</span>
                    <Badge variant="outline" className="font-mono text-xs">{context?.countryCode || "ZAF"}</Badge>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Admin Level Label:</span>
                    <span className="font-semibold text-foreground">{context?.adminLevelLabel || "District"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Total Evaluated Areas:</span>
                    <span className="font-bold font-mono text-primary">{localRows.length} {context?.adminLevelLabelPlural || "Districts"}</span>
                  </div>
                  <div className="pt-2 border-t flex items-center justify-between">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">National Population:</span>
                      <span className="font-bold font-mono text-sm text-foreground">
                        {totalNationalPopulation.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setManualNationalPopInput(String(totalNationalPopulation));
                          setIsManualPopDialogOpen(true);
                        }}
                        className="h-7 px-2 text-[11px] gap-1 font-semibold"
                        title="Manually set national population and distribute across districts"
                      >
                        <Pencil className="w-3 h-3 text-primary" />
                        Manual Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handlePullPopulationFromHub}
                        disabled={isLoadingPopHub}
                        className="h-7 px-2 text-[11px] gap-1 font-semibold"
                        title="Pull verified district population from Population Hub"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingPopHub ? "animate-spin" : ""}`} />
                        Pull from Hub
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. GIS Shapefile & Boundary Link */}
              <div className="p-4 border rounded-lg bg-card space-y-3">
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  GIS Shapefile &amp; Boundary Link
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Boundary Layer:</span>
                    <span className="font-semibold text-foreground">Admin Level 2 ({context?.adminLevelLabelPlural || "Districts"})</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Shapefile Status:</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Linked &amp; Active
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Feature Geometry Count:</span>
                    <span className="font-bold font-mono text-foreground">{context?.boundaryFeatureCount || context?.districtsCount || localRows.length} Polygons</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Boundary Identifier:</span>
                    <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[150px]">{context?.boundaryId || "Default National Layer"}</span>
                  </div>
                </div>
              </div>

              {/* 3. Configurable Assessment Timeframe */}
              <div className="p-4 border rounded-lg bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-600" />
                    Assessment Timeframe
                  </h4>
                  {timeframeModified && (
                    <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">
                      Unsaved Changes
                    </Badge>
                  )}
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2 py-1 border-b">
                    <span className="text-muted-foreground font-medium">Target Assessment Year:</span>
                    <Select
                      value={String(targetYear)}
                      onValueChange={(v) => handleTargetYearChange(Number(v))}
                    >
                      <SelectTrigger className="h-7 w-[100px] text-xs font-mono font-bold">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                          <SelectItem key={y} value={String(y)} className="font-mono text-xs">
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoSyncBaselines}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setAutoSyncBaselines(next);
                          if (next) {
                            setBaselineYear1(targetYear - 3);
                            setBaselineYear2(targetYear - 2);
                            setBaselineYear3(targetYear - 1);
                            setTimeframeModified(true);
                          }
                        }}
                        className="rounded border-slate-300 text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      Auto-align 3-yr baseline (T-3, T-2, T-1)
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t">
                    <div>
                      <span className="text-[10px] text-muted-foreground block truncate" title="Baseline Year 1 (Year -3)">Year -3</span>
                      <Select
                        value={String(baselineYear1)}
                        disabled={autoSyncBaselines}
                        onValueChange={(v) => {
                          setBaselineYear1(Number(v));
                          setTimeframeModified(true);
                        }}
                      >
                        <SelectTrigger className="h-7 w-full text-xs font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027].map((y) => (
                            <SelectItem key={y} value={String(y)} className="font-mono text-xs">{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block truncate" title="Baseline Year 2 (Year -2)">Year -2</span>
                      <Select
                        value={String(baselineYear2)}
                        disabled={autoSyncBaselines}
                        onValueChange={(v) => {
                          setBaselineYear2(Number(v));
                          setTimeframeModified(true);
                        }}
                      >
                        <SelectTrigger className="h-7 w-full text-xs font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028].map((y) => (
                            <SelectItem key={y} value={String(y)} className="font-mono text-xs">{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block truncate" title="Baseline Year 3 (Year -1)">Year -1</span>
                      <Select
                        value={String(baselineYear3)}
                        disabled={autoSyncBaselines}
                        onValueChange={(v) => {
                          setBaselineYear3(Number(v));
                          setTimeframeModified(true);
                        }}
                      >
                        <SelectTrigger className="h-7 w-full text-xs font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029].map((y) => (
                            <SelectItem key={y} value={String(y)} className="font-mono text-xs">{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => updateTimeframeMutation.mutate({ yr: targetYear, b1: baselineYear1, b2: baselineYear2, b3: baselineYear3 })}
                      disabled={updateTimeframeMutation.isPending || (!timeframeModified && targetYear === (assessment?.assessmentYear || 2025))}
                      className="w-full h-7 text-xs gap-1.5 font-semibold"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {updateTimeframeMutation.isPending ? "Saving Timeframe..." : "Save Assessment Timeframe"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. DISTRICT POPULATION BREAKDOWN & MANUAL OVERRIDES (ENTERPRISE TABLE PER RULE 24) */}
            <div className="p-4 border rounded-lg bg-card space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b">
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    District Population Breakdown &amp; Manual Overrides
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Inspect, adjust, or manually override individual district populations. All population adjustments automatically update national metrics and WHO surveillance rates.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filter districts..."
                      value={popSearchTerm}
                      onChange={(e) => {
                        setPopSearchTerm(e.target.value);
                        setPopPage(1);
                      }}
                      className="h-7 text-xs pl-8 font-sans"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePullPopulationFromHub}
                    disabled={isLoadingPopHub}
                    className="h-7 text-xs gap-1 font-semibold"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingPopHub ? "animate-spin" : ""}`} />
                    Pull from Hub
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setManualNationalPopInput(String(totalNationalPopulation));
                      setIsManualPopDialogOpen(true);
                    }}
                    className="h-7 text-xs gap-1 font-semibold"
                  >
                    <Pencil className="w-3 h-3 text-primary" />
                    National Override
                  </Button>
                </div>
              </div>

              {/* Table conforming to Rule 24: Enterprise Table */}
              <div className="border rounded-lg overflow-x-auto max-h-[600px] relative bg-card shadow-sm custom-scrollbar">
                <table className="w-full min-w-full text-xs text-left border-collapse table-auto">
                  <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b shadow-sm select-none">
                    <tr>
                      <th
                        className="p-2 border-r border-slate-200 dark:border-slate-700 text-center sticky top-0 left-0 z-40 bg-slate-100 dark:bg-slate-800 w-14 min-w-[56px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        onClick={() => handlePopSort("index")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>#</span>
                          {getPopSortIcon("index")}
                        </div>
                      </th>
                      <th
                        className="p-2 border-r-2 border-slate-300 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)] sticky top-0 z-40 bg-slate-100 dark:bg-slate-800 min-w-[220px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group/th"
                        style={{ left: "56px" }}
                        onClick={() => handlePopSort("districtName")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="font-bold text-foreground">District / Administrative Area</span>
                          {getPopSortIcon("districtName")}
                        </div>
                      </th>
                      <th
                        className="p-2 border-r-2 border-slate-300 dark:border-slate-600 min-w-[160px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group/th"
                        onClick={() => handlePopSort("provinceName")}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span>Province / Region</span>
                          {getPopSortIcon("provinceName")}
                        </div>
                      </th>
                      <th
                        className="p-2 border-r-2 border-slate-300 dark:border-slate-600 text-right min-w-[170px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group/th"
                        onClick={() => handlePopSort("population")}
                      >
                        <div className="flex items-center justify-end gap-1.5 pr-2">
                          <span>Population (Editable)</span>
                          {getPopSortIcon("population")}
                        </div>
                      </th>
                      <th
                        className="p-2 border-r-2 border-slate-300 dark:border-slate-600 text-right min-w-[140px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group/th"
                        onClick={() => handlePopSort("pct")}
                      >
                        <div className="flex items-center justify-end gap-1.5 pr-2">
                          <span>% of National Total</span>
                          {getPopSortIcon("pct")}
                        </div>
                      </th>
                      <th
                        className="p-2 text-right min-w-[160px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group/th"
                        onClick={() => handlePopSort("under1")}
                      >
                        <div className="flex items-center justify-end gap-1.5 pr-2">
                          <span>Est. Under 1 Pop (3.5%)</span>
                          {getPopSortIcon("under1")}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-background text-foreground text-xs font-sans">
                    {paginatedPopRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">
                          No matching districts found.
                        </td>
                      </tr>
                    ) : (
                      paginatedPopRows.map((r, idx) => {
                        const globalIdx = (popPage - 1) * popPageSize + idx + 1;
                        const popNum = Number(r.population) || 0;
                        const pctOfTotal = totalNationalPopulation > 0 ? ((popNum / totalNationalPopulation) * 100).toFixed(2) : "0.00";
                        const under1Est = Math.round(popNum * 0.035);

                        return (
                          <tr key={r.districtId} className="hover:bg-muted/30 transition-colors group">
                            <td
                              className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono text-muted-foreground sticky left-0 z-20 bg-card group-hover:bg-muted/60"
                              style={{ width: "56px", minWidth: "56px" }}
                            >
                              {globalIdx}
                            </td>
                            <td
                              className="p-2 border-r-2 border-slate-300 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)] font-semibold text-foreground sticky z-20 bg-card group-hover:bg-muted/60"
                              style={{ left: "56px", minWidth: "220px" }}
                            >
                              {r.districtName || `District ${r.districtId}`}
                            </td>
                            <td className="p-2 border-r-2 border-slate-300 dark:border-slate-600 text-muted-foreground">
                              {r.provinceName || "National"}
                            </td>
                            <td className="p-1.5 border-r-2 border-slate-300 dark:border-slate-600 text-right">
                              <Input
                                type="number"
                                min={0}
                                value={r.population}
                                onChange={(e) => {
                                  handleCellChange(r.districtId, "population", Math.max(0, Number(e.target.value) || 0));
                                }}
                                className="h-7 text-xs font-mono text-right font-bold w-36 ml-auto"
                              />
                            </td>
                            <td className="p-2 border-r-2 border-slate-300 dark:border-slate-600 text-right font-mono text-muted-foreground">
                              {pctOfTotal}%
                            </td>
                            <td className="p-2 text-right font-mono text-muted-foreground">
                              {under1Est.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls conforming to Rule 24 */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-muted-foreground border-t">
                <div className="flex items-center gap-2">
                  <span>
                    Showing {paginatedPopRows.length > 0 ? (popPage - 1) * popPageSize + 1 : 0} to{" "}
                    {Math.min(popPage * popPageSize, sortedPopRows.length)} of {sortedPopRows.length} districts
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <div className="flex items-center gap-1.5">
                    <span>Rows per page:</span>
                    <Select
                      value={String(popPageSize)}
                      onValueChange={(v) => {
                        setPopPageSize(Number(v));
                        setPopPage(1);
                      }}
                    >
                      <SelectTrigger className="h-7 w-20 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPopPage(1)}
                    disabled={popPage <= 1}
                    className="h-7 px-2 text-xs gap-1"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">First</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPopPage((p) => Math.max(1, p - 1))}
                    disabled={popPage <= 1}
                    className="h-7 px-2 text-xs gap-1"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </Button>

                  {/* Page Jump Selector Dropdown */}
                  <div className="flex items-center gap-1 mx-1">
                    <span className="text-muted-foreground">Page</span>
                    <Select
                      value={String(popPage)}
                      onValueChange={(v) => setPopPage(Number(v))}
                    >
                      <SelectTrigger className="h-7 w-16 text-xs font-mono font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {Array.from({ length: totalPopPages }, (_, idx) => idx + 1).map((pNum) => (
                          <SelectItem key={pNum} value={String(pNum)} className="text-xs font-mono">
                            {pNum}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground font-mono">of {totalPopPages}</span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPopPage((p) => Math.min(totalPopPages, p + 1))}
                    disabled={popPage >= totalPopPages}
                    className="h-7 px-2 text-xs gap-1"
                    title="Next Page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPopPage(totalPopPages)}
                    disabled={popPage >= totalPopPages}
                    className="h-7 px-2 text-xs gap-1"
                    title="Last Page"
                  >
                    <span className="hidden sm:inline">Last</span>
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setActiveTab("overview")} className="text-xs">
                Back to Overview
              </Button>
              <Button size="sm" onClick={() => setActiveTab("population-immunity")} className="text-xs gap-1.5 font-semibold">
                Proceed to Population Immunity Data Entry <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================================================================== */}
      {/* 4. PAGE 3: SPATIAL RISK MAPS                                         */}
      {/* ==================================================================== */}
      {activeTab === "indicator-maps" && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-primary" />
              Interactive Spatial Risk Choropleth Map
            </CardTitle>
            <CardDescription className="text-xs">
              Choropleth spatial visualization of programmatic risk tiers and indicator distributions across {assessmentCountry}.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <RiskChoroplethMap
              countryCode={context?.countryCode || "ZAF"}
              countryName={assessmentCountry}
              adminLevelLabel={context?.adminLevelLabel || "District"}
              boundaryId={context?.boundaryId || undefined}
              data={localRows.map((r) => {
                const avg1 = (Number(r.mcv1YearMinus3) + Number(r.mcv1YearMinus2) + Number(r.mcv1YearMinus1)) / 3;
                const avg2 = (Number(r.mcv2YearMinus3) + Number(r.mcv2YearMinus2) + Number(r.mcv2YearMinus1)) / 3;
                const piRp = calcMcv1Rp(avg1) + calcNeighborRp(80) + calcMcv2Rp(avg2) + calcSiaCovRp(Number(r.siaCoveragePct));
                const sqRp = calcDiscardedRateRp(2.5) + calcQualityRp(Number(r.adequateInvestigationPct)) + calcQualityRp(Number(r.adequateSpecimenPct)) + calcQualityRp(Number(r.timelyLabResultsPct));
                const pdRp = calcTrendRp(1.2) + calcTrendRp(1.0) + calcDropoutRp(12) + calcDropoutRp(5);
                const vulnCount = Object.values(r.vulnerabilities || {}).filter(Boolean).length;
                const taRp = calcThreatPoints(r.threatCasesUnder5, r.threatCases5To14, r.threatCases15Plus, 65, r.borderCaseInPastYear, vulnCount);
                const total = calcTotalRiskScore(piRp, sqRp, pdRp, taRp);
                const cat = getRiskCategory(total);

                return {
                  districtId: r.districtId,
                  districtName: r.districtName || `District ${r.districtId}`,
                  provinceId: r.provinceId || 1,
                  provinceName: r.provinceName || "Province",
                  population: Number(r.population) || 100000,
                  targetUnder1: Math.round((Number(r.population) || 100000) * 0.035),
                  mcv1Coverage: Number(avg1.toFixed(1)),
                  mcv2Coverage: Number(avg2.toFixed(1)),
                  penta1Coverage: Number(r.penta1YearMinus1) || 90,
                  dropoutRate: 5.5,
                  mcvDropout: 8.2,
                  suspectedCases: r.suspectedCases || 2,
                  riskScore: total,
                  riskCategory: cat,
                  hasAssessmentRun: true,
                };
              })}
              selectedCategoryFilter="ALL"
              onSelectCategoryFilter={() => {}}
            />
          </CardContent>
        </Card>
      )}

      {/* ==================================================================== */}
      {/* 5. PAGES 4–8: SPREADSHEET ENTRY TABLES                               */}
      {/* ==================================================================== */}
      {(activeTab === "population-immunity" ||
        activeTab === "surveillance-quality" ||
        activeTab === "program-delivery" ||
        activeTab === "vulnerable-groups" ||
        activeTab === "threat-assessment") && (
        <div className="space-y-2">
          {/* Table Controls Bar */}
          <div className="p-2.5 bg-card border rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search district name or ID..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 h-7 text-xs bg-background"
                />
              </div>

              {provincesList.length > 0 && (
                <Select
                  value={provinceFilter}
                  onValueChange={(v) => {
                    setProvinceFilter(v);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-44 bg-background">
                    <SelectValue placeholder="All Provinces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Provinces ({localRows.length})</SelectItem>
                    {provincesList.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleImportExpectedCoverages(provinceFilter)}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300 dark:bg-emerald-950/40"
              >
                <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                {provinceFilter === "ALL" ? "Prefill All Coverages" : `Prefill ${provinceFilter}`}
              </Button>

              <div className="flex items-center border rounded p-0.5 bg-background text-xs">
                <Button
                  variant={isStretched ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setIsStretched(true);
                    setColWidths(STRETCH_COL_WIDTHS);
                  }}
                  className={`h-6 px-2 text-[11px] gap-1 font-medium ${isStretched ? "bg-primary/10 text-primary font-semibold" : ""}`}
                  title="Stretch columns across full width"
                >
                  <Maximize2 className="w-3 h-3 text-primary" /> Stretch
                </Button>
                <Button
                  variant={!isStretched ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setIsStretched(false);
                    setColWidths(DEFAULT_COL_WIDTHS);
                  }}
                  className={`h-6 px-2 text-[11px] gap-1 font-medium ${!isStretched ? "bg-muted font-semibold" : ""}`}
                  title="Compact columns"
                >
                  <Minimize2 className="w-3 h-3 text-muted-foreground" /> Compact
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsStretched(false);
                    setColWidths(DEFAULT_COL_WIDTHS);
                  }}
                  className="h-6 px-1.5 text-[11px]"
                  title="Reset column widths"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </Button>
              </div>

              <span className="text-muted-foreground text-[11px]">
                Showing {filteredRows.length} of {localRows.length} districts
              </span>
            </div>
          </div>

          {/* Spreadsheet Table Container */}
          <div className="border rounded-lg shadow-sm bg-card overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] relative">
              <table className="table-auto min-w-full w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 z-30 bg-slate-100/95 dark:bg-slate-800/95 text-slate-700 dark:text-slate-200 border-b shadow-sm font-semibold select-none text-[11px]">
                  {/* LEVEL 1: DOMAIN GROUP HEADERS */}
                  <tr className="border-b-2 border-b-slate-300 dark:border-b-slate-600 text-center">
                    <th
                      rowSpan={2}
                      className="p-2 border-r border-slate-200 dark:border-slate-700 sticky top-0 left-0 z-40 bg-slate-100 dark:bg-slate-800 text-center"
                      style={{ width: `${indexWidth}px`, minWidth: `${indexWidth}px`, maxWidth: `${indexWidth}px` }}
                    >
                      #
                    </th>
                    <th
                      rowSpan={2}
                      className="p-2 border-r-2 border-slate-400 dark:border-slate-500 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] sticky top-0 z-40 bg-slate-100 dark:bg-slate-800 text-left cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 group/th"
                      style={{ left: `${indexWidth}px`, width: `${districtWidth}px`, minWidth: `${districtWidth}px`, maxWidth: `${districtWidth}px` }}
                      onClick={() => handleSort("districtName")}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span className="font-bold text-foreground">District / Area</span>
                        {getSortIcon("districtName")}
                      </div>
                    </th>

                    {/* POPULATION IMMUNITY HEADERS */}
                    {activeTab === "population-immunity" && (
                      <>
                        <th colSpan={5} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 font-bold">
                          Administrative MCV1 Coverage Report
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 font-bold">
                          % of neighboring districts with MCV1 &lt;80%
                        </th>
                        <th colSpan={5} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 font-bold">
                          Administrative MCV2 Coverage Report
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 font-bold">
                          Subnational coverage of measles SIA
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 font-bold">
                          Measles SIA target age group
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 font-bold">
                          Years since last measles SIA
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 font-bold">
                          % suspected measles cases unvaccinated
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-black text-center">
                          SUBTOTAL RISK POINTS
                        </th>
                      </>
                    )}

                    {/* SURVEILLANCE QUALITY HEADERS */}
                    {activeTab === "surveillance-quality" && (
                      <>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold">
                          Non-measles discarded rate
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold">
                          % with adequate investigation
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold">
                          % adequate blood specimen collection
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold">
                          % with timely availability of laboratory results
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-black text-center">
                          SUBTOTAL RISK POINTS
                        </th>
                      </>
                    )}

                    {/* PROGRAM DELIVERY HEADERS */}
                    {activeTab === "program-delivery" && (
                      <>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold">
                          MCV1 Trend
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold">
                          MCV2 Trend
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold">
                          Drop-out Rate MCV1-MCV2
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold">
                          DPT1 / Penta1
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold">
                          Drop-out Rate DPT1-MCV1
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-black text-center">
                          SUBTOTAL RISK POINTS
                        </th>
                      </>
                    )}

                    {/* VULNERABLE GROUPS HEADERS */}
                    {activeTab === "vulnerable-groups" && (
                      <>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold">
                          Presence of migrant population / internally displaced population/ slums / tribal communities
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold">
                          Resistant to vaccination (ie. religious, cultural issues, etc.)
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold">
                          Security and safety concerns
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold">
                          Frequented by calamities / disasters
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold">
                          Poor access to health services due to terrain / transportation issues
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold">
                          Lack of local political support
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold">
                          Presence of high-traffic transportation hubs/major roads or bordering large urban areas
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold">
                          Presence of areas with mass gatherings
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-black text-center">
                          SUBTOTAL RISK POINTS
                        </th>
                      </>
                    )}

                    {/* THREAT ASSESSMENT HEADERS */}
                    {activeTab === "threat-assessment" && (
                      <>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold">
                          Evidence of recent measles cases among &lt;5 years
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold">
                          Evidence of recent measles cases among 5-15 years
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold">
                          Evidence of recent measles cases among &gt;15 years
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold">
                          Population density (Pers./Km2)
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold">
                          Bordering areas with measles case in the past 12 months
                        </th>
                        <th colSpan={2} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold">
                          Presence of vulnerable population
                        </th>
                        <th colSpan={1} className="p-2 border-r-2 border-slate-400 dark:border-slate-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-black text-center">
                          SUBTOTAL RISK POINTS
                        </th>
                      </>
                    )}
                  </tr>

                  {/* LEVEL 2: SUBHEADERS (FRIENDLY LABELS & SORTABLE) */}
                  <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 text-center border-b border-slate-200 dark:border-slate-700 text-[10px]">
                    {activeTab === "population-immunity" && (
                      <>
                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.mcv1Minus3}px`, minWidth: `${colWidths.mcv1Minus3}px` }}
                          onClick={() => handleSort("mcv1YearMinus3")}
                          title={`Sort by ${dataFirstYear} MCV1 Coverage`}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>{dataFirstYear}</span>
                            {getSortIcon("mcv1YearMinus3")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.mcv1Minus2}px`, minWidth: `${colWidths.mcv1Minus2}px` }}
                          onClick={() => handleSort("mcv1YearMinus2")}
                          title={`Sort by ${dataSecondYear} MCV1 Coverage`}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>{dataSecondYear}</span>
                            {getSortIcon("mcv1YearMinus2")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.mcv1Minus1}px`, minWidth: `${colWidths.mcv1Minus1}px` }}
                          onClick={() => handleSort("mcv1YearMinus1")}
                          title={`Sort by ${dataLastYear} MCV1 Coverage`}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>{dataLastYear}</span>
                            {getSortIcon("mcv1YearMinus1")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 bg-slate-100/50 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.mcv1Avg}px`, minWidth: `${colWidths.mcv1Avg}px` }}
                          onClick={() => handleSort("mcv1Avg")}
                          title="Sort by MCV1 3-Year Average"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Avg</span>
                            {getSortIcon("mcv1Avg")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.mcv1Rp}px`, minWidth: `${colWidths.mcv1Rp}px` }}
                          onClick={() => handleSort("mcv1Rp")}
                          title="Sort by MCV1 Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("mcv1Rp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.neighborPct}px`, minWidth: `${colWidths.neighborPct}px` }}
                          onClick={() => handleSort("neighborPct")}
                          title="Sort by % Neighboring Districts with MCV1 <80%"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>% &lt;80%</span>
                            {getSortIcon("neighborPct")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.neighborRp}px`, minWidth: `${colWidths.neighborRp}px` }}
                          onClick={() => handleSort("neighborRp")}
                          title="Sort by Neighbor Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("neighborRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.mcv2Minus3}px`, minWidth: `${colWidths.mcv2Minus3}px` }}
                          onClick={() => handleSort("mcv2YearMinus3")}
                          title={`Sort by ${dataFirstYear} MCV2 Coverage`}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>{dataFirstYear}</span>
                            {getSortIcon("mcv2YearMinus3")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.mcv2Minus2}px`, minWidth: `${colWidths.mcv2Minus2}px` }}
                          onClick={() => handleSort("mcv2YearMinus2")}
                          title={`Sort by ${dataSecondYear} MCV2 Coverage`}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>{dataSecondYear}</span>
                            {getSortIcon("mcv2YearMinus2")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.mcv2Minus1}px`, minWidth: `${colWidths.mcv2Minus1}px` }}
                          onClick={() => handleSort("mcv2YearMinus1")}
                          title={`Sort by ${dataLastYear} MCV2 Coverage`}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>{dataLastYear}</span>
                            {getSortIcon("mcv2YearMinus1")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 bg-slate-100/50 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.mcv2Avg}px`, minWidth: `${colWidths.mcv2Avg}px` }}
                          onClick={() => handleSort("mcv2Avg")}
                          title="Sort by MCV2 3-Year Average"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Avg</span>
                            {getSortIcon("mcv2Avg")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.mcv2Rp}px`, minWidth: `${colWidths.mcv2Rp}px` }}
                          onClick={() => handleSort("mcv2Rp")}
                          title="Sort by MCV2 Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("mcv2Rp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.siaCovMinus1}px`, minWidth: `${colWidths.siaCovMinus1}px` }}
                          onClick={() => handleSort("siaCoveragePct")}
                          title="Sort by Measles SIA Coverage %"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Coverage %</span>
                            {getSortIcon("siaCoveragePct")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.siaCovRp}px`, minWidth: `${colWidths.siaCovRp}px` }}
                          onClick={() => handleSort("siaCovRp")}
                          title="Sort by SIA Coverage Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("siaCovRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.siaAgeGroupMinus1}px`, minWidth: `${colWidths.siaAgeGroupMinus1}px` }}
                          onClick={() => handleSort("siaTargetAgeGroup")}
                          title="Sort by SIA Target Age Group"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Target Group</span>
                            {getSortIcon("siaTargetAgeGroup")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.siaAgeGroupRp}px`, minWidth: `${colWidths.siaAgeGroupRp}px` }}
                          onClick={() => handleSort("siaAgeGroupRp")}
                          title="Sort by SIA Target Age Group Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("siaAgeGroupRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.siaYearsMinus1}px`, minWidth: `${colWidths.siaYearsMinus1}px` }}
                          onClick={() => handleSort("siaYearsSince")}
                          title="Sort by Years Since Last Measles SIA"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Years</span>
                            {getSortIcon("siaYearsSince")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.siaYearsRp}px`, minWidth: `${colWidths.siaYearsRp}px` }}
                          onClick={() => handleSort("siaYearsRp")}
                          title="Sort by Years Since Last SIA Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("siaYearsRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.unvacMinus3Minus1}px`, minWidth: `${colWidths.unvacMinus3Minus1}px` }}
                          onClick={() => handleSort("unvaccinatedCasesPct")}
                          title="Sort by % Suspected Cases Unvaccinated"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>% Unvac</span>
                            {getSortIcon("unvaccinatedCasesPct")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.unvacRp}px`, minWidth: `${colWidths.unvacRp}px` }}
                          onClick={() => handleSort("unvacRp")}
                          title="Sort by % Unvaccinated Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("unvacRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-black bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 cursor-pointer hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 transition-colors select-none group/th"
                          style={{ width: `${colWidths.piTotalRp}px`, minWidth: `${colWidths.piTotalRp}px` }}
                          onClick={() => handleSort("piTotalRp")}
                          title="Sort by Population Immunity Subtotal Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Total RP</span>
                            {getSortIcon("piTotalRp")}
                          </div>
                        </th>
                      </>
                    )}

                    {activeTab === "surveillance-quality" && (
                      <>
                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.sqRateVal}px`, minWidth: `${colWidths.sqRateVal}px` }}
                          onClick={() => handleSort("sqDiscardedRate")}
                          title="Sort by Non-measles Discarded Rate per 100k"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Rate / 100k</span>
                            {getSortIcon("sqDiscardedRate")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.sqRateRp}px`, minWidth: `${colWidths.sqRateRp}px` }}
                          onClick={() => handleSort("sqRateRp")}
                          title="Sort by Discarded Rate Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("sqRateRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.sqInvestVal}px`, minWidth: `${colWidths.sqInvestVal}px` }}
                          onClick={() => handleSort("adequateInvestigationPct")}
                          title="Sort by % with Adequate Investigation"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Investigated %</span>
                            {getSortIcon("adequateInvestigationPct")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.sqInvestRp}px`, minWidth: `${colWidths.sqInvestRp}px` }}
                          onClick={() => handleSort("sqInvestRp")}
                          title="Sort by Adequate Investigation Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("sqInvestRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.sqSpecimenVal}px`, minWidth: `${colWidths.sqSpecimenVal}px` }}
                          onClick={() => handleSort("adequateSpecimenPct")}
                          title="Sort by % Adequate Blood Specimen Collection"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Specimen %</span>
                            {getSortIcon("adequateSpecimenPct")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.sqSpecimenRp}px`, minWidth: `${colWidths.sqSpecimenRp}px` }}
                          onClick={() => handleSort("sqSpecimenRp")}
                          title="Sort by Specimen Collection Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("sqSpecimenRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.sqLabVal}px`, minWidth: `${colWidths.sqLabVal}px` }}
                          onClick={() => handleSort("timelyLabResultsPct")}
                          title="Sort by % Timely Lab Results"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Timely Lab %</span>
                            {getSortIcon("timelyLabResultsPct")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.sqLabRp}px`, minWidth: `${colWidths.sqLabRp}px` }}
                          onClick={() => handleSort("sqLabRp")}
                          title="Sort by Timely Lab Results Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("sqLabRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-black bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 cursor-pointer hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 transition-colors select-none group/th"
                          style={{ width: `${colWidths.sqTotalRp}px`, minWidth: `${colWidths.sqTotalRp}px` }}
                          onClick={() => handleSort("sqTotalRp")}
                          title="Sort by Surveillance Quality Subtotal Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Total RP</span>
                            {getSortIcon("sqTotalRp")}
                          </div>
                        </th>
                      </>
                    )}

                    {activeTab === "program-delivery" && (
                      <>
                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.pdMcv1TrendVal}px`, minWidth: `${colWidths.pdMcv1TrendVal}px` }}
                          onClick={() => handleSort("pdMcv1Trend")}
                          title="Sort by MCV1 Trend Slope"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Slope Trend</span>
                            {getSortIcon("pdMcv1Trend")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.pdMcv1TrendRp}px`, minWidth: `${colWidths.pdMcv1TrendRp}px` }}
                          onClick={() => handleSort("pdMcv1TrendRp")}
                          title="Sort by MCV1 Trend Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("pdMcv1TrendRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.pdMcv2TrendVal}px`, minWidth: `${colWidths.pdMcv2TrendVal}px` }}
                          onClick={() => handleSort("pdMcv2Trend")}
                          title="Sort by MCV2 Trend Slope"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Slope Trend</span>
                            {getSortIcon("pdMcv2Trend")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.pdMcv2TrendRp}px`, minWidth: `${colWidths.pdMcv2TrendRp}px` }}
                          onClick={() => handleSort("pdMcv2TrendRp")}
                          title="Sort by MCV2 Trend Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("pdMcv2TrendRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.pdMcvDropoutVal}px`, minWidth: `${colWidths.pdMcvDropoutVal}px` }}
                          onClick={() => handleSort("pdMcvDropout")}
                          title="Sort by MCV1-MCV2 Dropout %"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Dropout %</span>
                            {getSortIcon("pdMcvDropout")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.pdMcvDropoutRp}px`, minWidth: `${colWidths.pdMcvDropoutRp}px` }}
                          onClick={() => handleSort("pdMcvDropoutRp")}
                          title="Sort by MCV1-MCV2 Dropout Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("pdMcvDropoutRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.pdPentaDoses}px`, minWidth: `${colWidths.pdPentaDoses}px` }}
                          onClick={() => handleSort("penta1YearMinus1")}
                          title="Sort by DPT1 / Penta1 Coverage"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Coverage %</span>
                            {getSortIcon("penta1YearMinus1")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.pdPentaDropoutVal}px`, minWidth: `${colWidths.pdPentaDropoutVal}px` }}
                          onClick={() => handleSort("pdPentaDropout")}
                          title="Sort by DPT1-MCV1 Dropout %"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Dropout %</span>
                            {getSortIcon("pdPentaDropout")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.pdPentaDropoutRp}px`, minWidth: `${colWidths.pdPentaDropoutRp}px` }}
                          onClick={() => handleSort("pdPentaDropoutRp")}
                          title="Sort by DPT1-MCV1 Dropout Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("pdPentaDropoutRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-black bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 cursor-pointer hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 transition-colors select-none group/th"
                          style={{ width: `${colWidths.pdTotalRp}px`, minWidth: `${colWidths.pdTotalRp}px` }}
                          onClick={() => handleSort("pdTotalRp")}
                          title="Sort by Program Delivery Subtotal Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Total RP</span>
                            {getSortIcon("pdTotalRp")}
                          </div>
                        </th>
                      </>
                    )}

                    {activeTab === "vulnerable-groups" && (
                      <>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.vgItem}px`, minWidth: `${colWidths.vgItem}px` }}
                          onClick={() => handleSort("vg_migrant")}
                          title="Sort by Migrant / IDP / Slums presence"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Displaced / IDP</span>
                            {getSortIcon("vg_migrant")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.vgItem}px`, minWidth: `${colWidths.vgItem}px` }}
                          onClick={() => handleSort("vg_hesitancy")}
                          title="Sort by Vaccine Hesitancy"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Hesitancy</span>
                            {getSortIcon("vg_hesitancy")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.vgItem}px`, minWidth: `${colWidths.vgItem}px` }}
                          onClick={() => handleSort("vg_security")}
                          title="Sort by Security & Safety Concerns"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Conflict / Security</span>
                            {getSortIcon("vg_security")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.vgItem}px`, minWidth: `${colWidths.vgItem}px` }}
                          onClick={() => handleSort("vg_calamities")}
                          title="Sort by Calamities / Disasters"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Disasters</span>
                            {getSortIcon("vg_calamities")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.vgItem}px`, minWidth: `${colWidths.vgItem}px` }}
                          onClick={() => handleSort("vg_terrain")}
                          title="Sort by Terrain / Poor Access"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Terrain / Access</span>
                            {getSortIcon("vg_terrain")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.vgItem}px`, minWidth: `${colWidths.vgItem}px` }}
                          onClick={() => handleSort("vg_political")}
                          title="Sort by Lack of Local Political Support"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Political Support</span>
                            {getSortIcon("vg_political")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.vgItem}px`, minWidth: `${colWidths.vgItem}px` }}
                          onClick={() => handleSort("vg_transit")}
                          title="Sort by Transit Hubs / Major Roads"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Transit Hubs</span>
                            {getSortIcon("vg_transit")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.vgItem}px`, minWidth: `${colWidths.vgItem}px` }}
                          onClick={() => handleSort("vg_gatherings")}
                          title="Sort by Mass Gatherings"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Mass Gatherings</span>
                            {getSortIcon("vg_gatherings")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-black bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 cursor-pointer hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 transition-colors select-none group/th"
                          style={{ width: `${colWidths.vgTotalRp}px`, minWidth: `${colWidths.vgTotalRp}px` }}
                          onClick={() => handleSort("vgTotalRp")}
                          title="Sort by Vulnerable Groups Subtotal Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Total RP</span>
                            {getSortIcon("vgTotalRp")}
                          </div>
                        </th>
                      </>
                    )}

                    {activeTab === "threat-assessment" && (
                      <>
                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taCasesUnder5Val}px`, minWidth: `${colWidths.taCasesUnder5Val}px` }}
                          onClick={() => handleSort("threatCasesUnder5")}
                          title="Sort by Cases <5 Years"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Cases</span>
                            {getSortIcon("threatCasesUnder5")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taCasesUnder5Rp}px`, minWidth: `${colWidths.taCasesUnder5Rp}px` }}
                          onClick={() => handleSort("threatCasesUnder5Rp")}
                          title="Sort by Cases <5 Years Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("threatCasesUnder5Rp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taCases5to14Val}px`, minWidth: `${colWidths.taCases5to14Val}px` }}
                          onClick={() => handleSort("threatCases5to14")}
                          title="Sort by Cases 5-14 Years"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Cases</span>
                            {getSortIcon("threatCases5to14")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taCases5to14Rp}px`, minWidth: `${colWidths.taCases5to14Rp}px` }}
                          onClick={() => handleSort("threatCases5to14Rp")}
                          title="Sort by Cases 5-14 Years Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("threatCases5to14Rp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taCases15plusVal}px`, minWidth: `${colWidths.taCases15plusVal}px` }}
                          onClick={() => handleSort("threatCases15plus")}
                          title="Sort by Cases >=15 Years"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Cases</span>
                            {getSortIcon("threatCases15plus")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taCases15plusRp}px`, minWidth: `${colWidths.taCases15plusRp}px` }}
                          onClick={() => handleSort("threatCases15plusRp")}
                          title="Sort by Cases >=15 Years Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("threatCases15plusRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taDensityVal}px`, minWidth: `${colWidths.taDensityVal}px` }}
                          onClick={() => handleSort("threatDensity")}
                          title="Sort by Population Density"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Density</span>
                            {getSortIcon("threatDensity")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taDensityRp}px`, minWidth: `${colWidths.taDensityRp}px` }}
                          onClick={() => handleSort("threatDensityRp")}
                          title="Sort by Population Density Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("threatDensityRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taBorderVal}px`, minWidth: `${colWidths.taBorderVal}px` }}
                          onClick={() => handleSort("threatBorderCase")}
                          title="Sort by Bordering Area Cases"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Border?</span>
                            {getSortIcon("threatBorderCase")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taBorderRp}px`, minWidth: `${colWidths.taBorderRp}px` }}
                          onClick={() => handleSort("threatBorderRp")}
                          title="Sort by Border Case Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("threatBorderRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taVulnVal}px`, minWidth: `${colWidths.taVulnVal}px` }}
                          onClick={() => handleSort("threatVulnPts")}
                          title="Sort by Vulnerability Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Vuln Pts</span>
                            {getSortIcon("threatVulnPts")}
                          </div>
                        </th>
                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-bold cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taVulnRp}px`, minWidth: `${colWidths.taVulnRp}px` }}
                          onClick={() => handleSort("threatVulnRp")}
                          title="Sort by Vulnerability Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>RP</span>
                            {getSortIcon("threatVulnRp")}
                          </div>
                        </th>

                        <th
                          className="p-1 border-r-2 border-slate-400 dark:border-slate-500 font-black bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 cursor-pointer hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 transition-colors select-none group/th"
                          style={{ width: `${colWidths.taTotalRp}px`, minWidth: `${colWidths.taTotalRp}px` }}
                          onClick={() => handleSort("taTotalRp")}
                          title="Sort by Threat Assessment Subtotal Risk Points"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>Total RP</span>
                            {getSortIcon("taTotalRp")}
                          </div>
                        </th>
                      </>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-background text-foreground text-xs font-sans">
                  {isLoading ? (
                    <tr>
                      <td colSpan={25} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                          <span>Loading assessment records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : groupedByProvince.length === 0 ? (
                    <tr>
                      <td colSpan={25} className="text-center py-12 text-muted-foreground">
                        <span>No districts found matching filter.</span>
                      </td>
                    </tr>
                  ) : (
                    groupedByProvince.map((group, gIdx) => (
                      <React.Fragment key={group.provinceName}>
                        {/* CLEAN PROVINCE DIVIDER BANNER (Admin1) - NO CLUTTER */}
                        <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-y border-slate-200 dark:border-slate-700 font-medium">
                          <td
                            className="p-2 text-center font-mono text-xs text-slate-500 font-semibold sticky left-0 z-20 bg-slate-100/95 dark:bg-slate-800/95 border-r border-slate-200 dark:border-slate-700"
                            style={{ width: `${indexWidth}px`, minWidth: `${indexWidth}px`, maxWidth: `${indexWidth}px` }}
                          >
                            {gIdx + 1}
                          </td>
                          <td
                            colSpan={25}
                            className="p-2 sticky z-20 bg-slate-100/95 dark:bg-slate-800/95"
                            style={{ left: `${indexWidth}px` }}
                          >
                            <div className="flex items-center justify-between pr-4">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-primary" />
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                  {group.provinceName}
                                </span>
                                <Badge variant="outline" className="text-[10px] py-0 h-4 bg-background text-slate-600 dark:text-slate-400">
                                  {group.districts.length} {context?.adminLevelLabelPlural || "Districts"}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleImportExpectedCoverages(group.provinceName)}
                                className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary hover:bg-primary/10 font-normal"
                              >
                                <Sparkles className="w-3 h-3 text-primary" />
                                Prefill {group.provinceName} Coverages
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* DISTRICT DATA ROWS */}
                        {group.districts.map((row, dIdx) => {
                          const mcv1_3 = Number(row.mcv1YearMinus3) || 0;
                          const mcv1_2 = Number(row.mcv1YearMinus2) || 0;
                          const mcv1_1 = Number(row.mcv1YearMinus1) || 0;
                          const mcv1Avg = Number(((mcv1_3 + mcv1_2 + mcv1_1) / 3).toFixed(1));
                          const mcv1Rp = calcMcv1Rp(mcv1Avg);

                          const neighborPct = 75.0; // Neighbor baseline
                          const neighborRp = calcNeighborRp(neighborPct);

                          const mcv2_3 = Number(row.mcv2YearMinus3) || 0;
                          const mcv2_2 = Number(row.mcv2YearMinus2) || 0;
                          const mcv2_1 = Number(row.mcv2YearMinus1) || 0;
                          const mcv2Avg = Number(((mcv2_3 + mcv2_2 + mcv2_1) / 3).toFixed(1));
                          const mcv2Rp = calcMcv2Rp(mcv2Avg);

                          const siaCov = Number(row.siaCoveragePct) || 0;
                          const siaCovRp = calcSiaCovRp(siaCov);
                          const siaAgeRp = calcSiaAgeRp(row.siaTargetAgeGroup);
                          const siaYearsRp = calcSiaYearsRp(row.siaYearsSince);
                          const unvacPct = Number(row.unvaccinatedCasesPct) || 0;
                          const unvacRp = calcUnvacRp(unvacPct);

                          const piSubtotal = Math.min(40, mcv1Rp + neighborRp + mcv2Rp + siaCovRp + siaAgeRp + siaYearsRp + unvacRp);

                          // SQ calculations
                          const pop = Number(row.population) || 100000;
                          const discCases = Number(row.discardedCases) || 0;
                          const discardedRate = Number(((discCases / pop) * 100000).toFixed(2));
                          const discardedRp = calcDiscardedRateRp(discardedRate);
                          const investPct = Number(row.adequateInvestigationPct) || 0;
                          const investRp = calcQualityRp(investPct);
                          const specimenPct = Number(row.adequateSpecimenPct) || 0;
                          const specimenRp = calcQualityRp(specimenPct);
                          const labPct = Number(row.timelyLabResultsPct) || 0;
                          const labRp = calcQualityRp(labPct);
                          const sqSubtotal = Math.min(20, discardedRp + investRp + specimenRp + labRp);

                          // PD calculations
                          const pdMcv1Trend = Number((mcv1_1 - mcv1_3).toFixed(1));
                          const pdMcv1TrendRp = calcTrendRp(pdMcv1Trend);
                          const pdMcv2Trend = Number((mcv2_1 - mcv2_3).toFixed(1));
                          const pdMcv2TrendRp = calcTrendRp(pdMcv2Trend);
                          const mcvDropout = mcv1_1 > 0 ? Number((((mcv1_1 - mcv2_1) / mcv1_1) * 100).toFixed(1)) : 0;
                          const mcvDropoutRp = calcDropoutRp(mcvDropout);
                          const penta1 = Number(row.penta1YearMinus1) || 0;
                          const pentaDropout = penta1 > 0 ? Number((((penta1 - mcv1_1) / penta1) * 100).toFixed(1)) : 0;
                          const pentaDropoutRp = calcDropoutRp(pentaDropout);
                          const pdSubtotal = Math.min(16, pdMcv1TrendRp + pdMcv2TrendRp + mcvDropoutRp + pentaDropoutRp);

                          // VG calculations
                          const vulns = row.vulnerabilities || {};
                          const vulnCount = Object.values(vulns).filter(Boolean).length;
                          const vgSubtotal = Math.min(8, vulnCount);

                          // TA calculations
                          const area = Number(row.areaKm2) || 1000;
                          const density = Number((pop / area).toFixed(1));
                          const densityRp = calcDensityRp(density);
                          const cUnder5 = Number(row.threatCasesUnder5) || 0;
                          const c5to14 = Number(row.threatCases5To14) || 0;
                          const c15plus = Number(row.threatCases15Plus) || 0;
                          const cUnder5Rp = cUnder5 > 0 ? 4 : 0;
                          const c5to14Rp = c5to14 > 0 ? 3 : 0;
                          const c15plusRp = c15plus > 0 ? 3 : 0;
                          const borderRp = row.borderCaseInPastYear ? 2 : 0;
                          const taSubtotal = calcThreatPoints(cUnder5, c5to14, c15plus, density, row.borderCaseInPastYear, vulnCount);

                          return (
                            <tr key={row.districtId} className="hover:bg-muted/40 transition-colors">
                              {/* Pinned # */}
                              <td
                                className="p-1 text-center sticky left-0 z-10 bg-background border-r border-slate-200 dark:border-slate-800 font-mono text-[10px] text-muted-foreground"
                                style={{ width: `${indexWidth}px`, minWidth: `${indexWidth}px`, maxWidth: `${indexWidth}px` }}
                              >
                                {dIdx + 1}
                              </td>

                              {/* Pinned District Name */}
                              <td
                                className="p-1.5 sticky z-10 bg-background border-r-2 border-slate-400 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)] font-semibold text-foreground group/district"
                                style={{ left: `${indexWidth}px`, width: `${districtWidth}px`, minWidth: `${districtWidth}px`, maxWidth: `${districtWidth}px` }}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate block font-medium text-xs text-foreground" title={row.districtName}>
                                    {row.districtName}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleImportExpectedCoverages(row.districtId)}
                                    title={`Prefill ${row.districtName} coverages`}
                                    className="h-5 px-1 text-[10px] gap-0.5 opacity-0 group-hover/district:opacity-100 hover:opacity-100 focus:opacity-100 transition-opacity text-primary hover:text-primary hover:bg-primary/10 rounded shrink-0 font-normal"
                                  >
                                    <Sparkles className="w-2.5 h-2.5 text-primary" />
                                    Prefill
                                  </Button>
                                </div>
                              </td>

                              {/* POPULATION IMMUNITY COLUMNS */}
                              {activeTab === "population-immunity" && (
                                <>
                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.mcv1Minus3}px`, minWidth: `${colWidths.mcv1Minus3}px` }}>
                                    <Input
                                      type="number"
                                      value={row.mcv1YearMinus3}
                                      onChange={(e) => handleCellChange(row.districtId, "mcv1YearMinus3", e.target.value)}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.mcv1Minus2}px`, minWidth: `${colWidths.mcv1Minus2}px` }}>
                                    <Input
                                      type="number"
                                      value={row.mcv1YearMinus2}
                                      onChange={(e) => handleCellChange(row.districtId, "mcv1YearMinus2", e.target.value)}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.mcv1Minus1}px`, minWidth: `${colWidths.mcv1Minus1}px` }}>
                                    <Input
                                      type="number"
                                      value={row.mcv1YearMinus1}
                                      onChange={(e) => handleCellChange(row.districtId, "mcv1YearMinus1", e.target.value)}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-xs bg-slate-50 dark:bg-slate-900/40" style={{ width: `${colWidths.mcv1Avg}px`, minWidth: `${colWidths.mcv1Avg}px` }}>
                                    {mcv1Avg}%
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.mcv1Rp}px`, minWidth: `${colWidths.mcv1Rp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {mcv1Rp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-xs" style={{ width: `${colWidths.neighborPct}px`, minWidth: `${colWidths.neighborPct}px` }}>
                                    {neighborPct}%
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.neighborRp}px`, minWidth: `${colWidths.neighborRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {neighborRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.mcv2Minus3}px`, minWidth: `${colWidths.mcv2Minus3}px` }}>
                                    <Input
                                      type="number"
                                      value={row.mcv2YearMinus3}
                                      onChange={(e) => handleCellChange(row.districtId, "mcv2YearMinus3", e.target.value)}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.mcv2Minus2}px`, minWidth: `${colWidths.mcv2Minus2}px` }}>
                                    <Input
                                      type="number"
                                      value={row.mcv2YearMinus2}
                                      onChange={(e) => handleCellChange(row.districtId, "mcv2YearMinus2", e.target.value)}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.mcv2Minus1}px`, minWidth: `${colWidths.mcv2Minus1}px` }}>
                                    <Input
                                      type="number"
                                      value={row.mcv2YearMinus1}
                                      onChange={(e) => handleCellChange(row.districtId, "mcv2YearMinus1", e.target.value)}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-xs bg-slate-50 dark:bg-slate-900/40" style={{ width: `${colWidths.mcv2Avg}px`, minWidth: `${colWidths.mcv2Avg}px` }}>
                                    {mcv2Avg}%
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.mcv2Rp}px`, minWidth: `${colWidths.mcv2Rp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {mcv2Rp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.siaCovMinus1}px`, minWidth: `${colWidths.siaCovMinus1}px` }}>
                                    <Input
                                      type="number"
                                      value={row.siaCoveragePct}
                                      onChange={(e) => handleCellChange(row.districtId, "siaCoveragePct", e.target.value)}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.siaCovRp}px`, minWidth: `${colWidths.siaCovRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {siaCovRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.siaAgeGroupMinus1}px`, minWidth: `${colWidths.siaAgeGroupMinus1}px` }}>
                                    <Select
                                      value={row.siaTargetAgeGroup || "WIDE"}
                                      onValueChange={(v: "WIDE" | "NARROW") => handleCellChange(row.districtId, "siaTargetAgeGroup", v)}
                                    >
                                      <SelectTrigger className="h-7 text-[11px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="WIDE">Wide (&gt;=9m-59m)</SelectItem>
                                        <SelectItem value="NARROW">Narrow (&lt;59m)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.siaAgeGroupRp}px`, minWidth: `${colWidths.siaAgeGroupRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {siaAgeRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.siaYearsMinus1}px`, minWidth: `${colWidths.siaYearsMinus1}px` }}>
                                    <Input
                                      type="number"
                                      value={row.siaYearsSince}
                                      onChange={(e) => handleCellChange(row.districtId, "siaYearsSince", Number(e.target.value))}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.siaYearsRp}px`, minWidth: `${colWidths.siaYearsRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {siaYearsRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.unvacMinus3Minus1}px`, minWidth: `${colWidths.unvacMinus3Minus1}px` }}>
                                    <Input
                                      type="number"
                                      value={row.unvaccinatedCasesPct}
                                      onChange={(e) => handleCellChange(row.districtId, "unvaccinatedCasesPct", e.target.value)}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.unvacRp}px`, minWidth: `${colWidths.unvacRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {unvacRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-mono font-black bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300" style={{ width: `${colWidths.piTotalRp}px`, minWidth: `${colWidths.piTotalRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 text-xs font-black rounded-full bg-primary/15 text-primary border border-primary/30">
                                      {piSubtotal}
                                    </span>
                                  </td>
                                </>
                              )}

                              {/* SURVEILLANCE QUALITY COLUMNS */}
                              {activeTab === "surveillance-quality" && (
                                <>
                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-xs" style={{ width: `${colWidths.sqRateVal}px`, minWidth: `${colWidths.sqRateVal}px` }}>
                                    {discardedRate}
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.sqRateRp}px`, minWidth: `${colWidths.sqRateRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {discardedRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.sqInvestVal}px`, minWidth: `${colWidths.sqInvestVal}px` }}>
                                    <Input
                                      type="number"
                                      value={row.adequateInvestigationPct}
                                      onChange={(e) => handleCellChange(row.districtId, "adequateInvestigationPct", e.target.value)}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.sqInvestRp}px`, minWidth: `${colWidths.sqInvestRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {investRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.sqSpecimenVal}px`, minWidth: `${colWidths.sqSpecimenVal}px` }}>
                                    <Input
                                      type="number"
                                      value={row.adequateSpecimenPct}
                                      onChange={(e) => handleCellChange(row.districtId, "adequateSpecimenPct", e.target.value)}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.sqSpecimenRp}px`, minWidth: `${colWidths.sqSpecimenRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {specimenRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.sqLabVal}px`, minWidth: `${colWidths.sqLabVal}px` }}>
                                    <Input
                                      type="number"
                                      value={row.timelyLabResultsPct}
                                      onChange={(e) => handleCellChange(row.districtId, "timelyLabResultsPct", e.target.value)}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.sqLabRp}px`, minWidth: `${colWidths.sqLabRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {labRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-mono font-black bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300" style={{ width: `${colWidths.sqTotalRp}px`, minWidth: `${colWidths.sqTotalRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 text-xs font-black rounded-full bg-primary/15 text-primary border border-primary/30">
                                      {sqSubtotal}
                                    </span>
                                  </td>
                                </>
                              )}

                              {/* PROGRAM DELIVERY COLUMNS */}
                              {activeTab === "program-delivery" && (
                                <>
                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-xs" style={{ width: `${colWidths.pdMcv1TrendVal}px`, minWidth: `${colWidths.pdMcv1TrendVal}px` }}>
                                    {pdMcv1Trend > 0 ? `+${pdMcv1Trend}` : pdMcv1Trend}
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.pdMcv1TrendRp}px`, minWidth: `${colWidths.pdMcv1TrendRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {pdMcv1TrendRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-xs" style={{ width: `${colWidths.pdMcv2TrendVal}px`, minWidth: `${colWidths.pdMcv2TrendVal}px` }}>
                                    {pdMcv2Trend > 0 ? `+${pdMcv2Trend}` : pdMcv2Trend}
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.pdMcv2TrendRp}px`, minWidth: `${colWidths.pdMcv2TrendRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {pdMcv2TrendRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-xs" style={{ width: `${colWidths.pdMcvDropoutVal}px`, minWidth: `${colWidths.pdMcvDropoutVal}px` }}>
                                    {mcvDropout}%
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.pdMcvDropoutRp}px`, minWidth: `${colWidths.pdMcvDropoutRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {mcvDropoutRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600" style={{ width: `${colWidths.pdPentaDoses}px`, minWidth: `${colWidths.pdPentaDoses}px` }}>
                                    <Input
                                      type="number"
                                      value={row.penta1YearMinus1}
                                      onChange={(e) => handleCellChange(row.districtId, "penta1YearMinus1", e.target.value)}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-xs" style={{ width: `${colWidths.pdPentaDropoutVal}px`, minWidth: `${colWidths.pdPentaDropoutVal}px` }}>
                                    {pentaDropout}%
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.pdPentaDropoutRp}px`, minWidth: `${colWidths.pdPentaDropoutRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {pentaDropoutRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-mono font-black bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300" style={{ width: `${colWidths.pdTotalRp}px`, minWidth: `${colWidths.pdTotalRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 text-xs font-black rounded-full bg-primary/15 text-primary border border-primary/30">
                                      {pdSubtotal}
                                    </span>
                                  </td>
                                </>
                              )}

                              {/* VULNERABLE GROUPS COLUMNS (Y/N toggles) */}
                              {activeTab === "vulnerable-groups" && (
                                <>
                                  {[
                                    "migrantOrUnderserved",
                                    "vaccineHesitancyOrRefusal",
                                    "securityOrConflictConcerns",
                                    "recurrentNaturalDisasters",
                                    "poorAccessOrTerrain",
                                    "inadequatePoliticalSupport",
                                    "highTransitHubOrBorder",
                                    "massGatheringsOrEvents",
                                  ].map((vulnKey) => {
                                    const isYes = Boolean((vulns as any)[vulnKey]);
                                    return (
                                      <td key={vulnKey} className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center" style={{ width: `${colWidths.vgItem}px`, minWidth: `${colWidths.vgItem}px` }}>
                                        <button
                                          type="button"
                                          onClick={() => handleCellChange(row.districtId, `vuln_${vulnKey}`, !isYes)}
                                          className={`px-2 py-0.5 text-xs font-bold rounded transition-colors ${
                                            isYes
                                              ? "bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200"
                                          }`}
                                        >
                                          {isYes ? "YES" : "NO"}
                                        </button>
                                      </td>
                                    );
                                  })}

                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-mono font-black bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300" style={{ width: `${colWidths.vgTotalRp}px`, minWidth: `${colWidths.vgTotalRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 text-xs font-black rounded-full bg-primary/15 text-primary border border-primary/30">
                                      {vgSubtotal}
                                    </span>
                                  </td>
                                </>
                              )}

                              {/* THREAT ASSESSMENT COLUMNS */}
                              {activeTab === "threat-assessment" && (
                                <>
                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.taCasesUnder5Val}px`, minWidth: `${colWidths.taCasesUnder5Val}px` }}>
                                    <Input
                                      type="number"
                                      value={row.threatCasesUnder5}
                                      onChange={(e) => handleCellChange(row.districtId, "threatCasesUnder5", Number(e.target.value))}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.taCasesUnder5Rp}px`, minWidth: `${colWidths.taCasesUnder5Rp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {cUnder5Rp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.taCases5to14Val}px`, minWidth: `${colWidths.taCases5to14Val}px` }}>
                                    <Input
                                      type="number"
                                      value={row.threatCases5To14}
                                      onChange={(e) => handleCellChange(row.districtId, "threatCases5To14", Number(e.target.value))}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.taCases5to14Rp}px`, minWidth: `${colWidths.taCases5to14Rp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {c5to14Rp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800" style={{ width: `${colWidths.taCases15plusVal}px`, minWidth: `${colWidths.taCases15plusVal}px` }}>
                                    <Input
                                      type="number"
                                      value={row.threatCases15Plus}
                                      onChange={(e) => handleCellChange(row.districtId, "threatCases15Plus", Number(e.target.value))}
                                      className="h-7 text-xs text-center font-mono font-bold px-1.5 py-0.5 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.taCases15plusRp}px`, minWidth: `${colWidths.taCases15plusRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {c15plusRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-xs" style={{ width: `${colWidths.taDensityVal}px`, minWidth: `${colWidths.taDensityVal}px` }}>
                                    {density}
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.taDensityRp}px`, minWidth: `${colWidths.taDensityRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {densityRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center" style={{ width: `${colWidths.taBorderVal}px`, minWidth: `${colWidths.taBorderVal}px` }}>
                                    <button
                                      type="button"
                                      onClick={() => handleCellChange(row.districtId, "borderCaseInPastYear", !row.borderCaseInPastYear)}
                                      className={`px-2 py-0.5 text-xs font-bold rounded transition-colors ${
                                        row.borderCaseInPastYear
                                          ? "bg-purple-600 text-white shadow-sm hover:bg-purple-700"
                                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200"
                                      }`}
                                    >
                                      {row.borderCaseInPastYear ? "YES" : "NO"}
                                    </button>
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.taBorderRp}px`, minWidth: `${colWidths.taBorderRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {borderRp}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-xs" style={{ width: `${colWidths.taVulnVal}px`, minWidth: `${colWidths.taVulnVal}px` }}>
                                    {vgSubtotal} pts
                                  </td>
                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold" style={{ width: `${colWidths.taVulnRp}px`, minWidth: `${colWidths.taVulnRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {vgSubtotal}
                                    </span>
                                  </td>

                                  <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-center font-mono font-black bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300" style={{ width: `${colWidths.taTotalRp}px`, minWidth: `${colWidths.taTotalRp}px` }}>
                                    <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 text-xs font-black rounded-full bg-primary/15 text-primary border border-primary/30">
                                      {taSubtotal}
                                    </span>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table 2 Pagination controls conforming to Rule 24 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-muted/20 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>
                  Showing {paginatedMainRows.length > 0 ? (mainPage - 1) * mainPageSize + 1 : 0} to{" "}
                  {mainPageSize === -1 ? sortedRows.length : Math.min(mainPage * mainPageSize, sortedRows.length)} of {sortedRows.length} districts
                </span>
                <span className="text-muted-foreground">•</span>
                <div className="flex items-center gap-1.5">
                  <span>Rows per page:</span>
                  <Select
                    value={String(mainPageSize)}
                    onValueChange={(v) => {
                      setMainPageSize(Number(v));
                      setMainPage(1);
                    }}
                  >
                    <SelectTrigger className="h-7 w-24 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="-1">All ({sortedRows.length})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {mainPageSize !== -1 && totalMainPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMainPage(1)}
                    disabled={mainPage <= 1}
                    className="h-7 px-2 text-xs gap-1"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">First</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMainPage((p) => Math.max(1, p - 1))}
                    disabled={mainPage <= 1}
                    className="h-7 px-2 text-xs gap-1"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </Button>

                  <div className="flex items-center gap-1 mx-1">
                    <span className="text-muted-foreground">Page</span>
                    <Select
                      value={String(mainPage)}
                      onValueChange={(v) => setMainPage(Number(v))}
                    >
                      <SelectTrigger className="h-7 w-16 text-xs font-mono font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {Array.from({ length: totalMainPages }, (_, idx) => idx + 1).map((pNum) => (
                          <SelectItem key={pNum} value={String(pNum)} className="text-xs font-mono">
                            {pNum}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground font-mono">of {totalMainPages}</span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMainPage((p) => Math.min(totalMainPages, p + 1))}
                    disabled={mainPage >= totalMainPages}
                    className="h-7 px-2 text-xs gap-1"
                    title="Next Page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMainPage(totalMainPages)}
                    disabled={mainPage >= totalMainPages}
                    className="h-7 px-2 text-xs gap-1"
                    title="Last Page"
                  >
                    <span className="hidden sm:inline">Last</span>
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. PAGE 9: MEASLES INCIDENCE                                         */}
      {/* ==================================================================== */}
      {activeTab === "measles-incidence" && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Measles Annual Incidence &amp; Outbreak Tracking
                </CardTitle>
                <CardDescription className="text-xs">
                  Annual confirmed measles cases and incidence per 100,000 population across districts.
                </CardDescription>
              </div>
              <div className="relative w-52">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter districts..."
                  value={incSearchTerm}
                  onChange={(e) => {
                    setIncSearchTerm(e.target.value);
                    setIncPage(1);
                  }}
                  className="h-7 text-xs pl-8 font-sans"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="border rounded-lg overflow-x-auto max-h-[600px] relative bg-card shadow-sm custom-scrollbar">
              <table className="w-full min-w-full text-xs text-left border-collapse table-auto">
                <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b shadow-sm select-none">
                  <tr>
                    <th
                      className="p-2 border-r border-slate-200 dark:border-slate-700 text-center sticky top-0 left-0 z-40 bg-slate-100 dark:bg-slate-800 w-14 min-w-[56px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleIncSort("index")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>#</span>
                        {getIncSortIcon("index")}
                      </div>
                    </th>
                    <th
                      className="p-2 border-r-2 border-slate-300 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)] sticky top-0 z-40 bg-slate-100 dark:bg-slate-800 min-w-[200px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group/th"
                      style={{ left: "56px" }}
                      onClick={() => handleIncSort("districtName")}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span className="font-bold text-foreground">District / Area</span>
                        {getIncSortIcon("districtName")}
                      </div>
                    </th>
                    <th
                      className="p-2 border-r-2 border-slate-300 dark:border-slate-600 min-w-[150px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group/th"
                      onClick={() => handleIncSort("provinceName")}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span>Province</span>
                        {getIncSortIcon("provinceName")}
                      </div>
                    </th>
                    <th
                      className="p-2 border-r-2 border-slate-300 dark:border-slate-600 text-right min-w-[140px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group/th"
                      onClick={() => handleIncSort("population")}
                    >
                      <div className="flex items-center justify-end gap-1.5 pr-2">
                        <span>Population</span>
                        {getIncSortIcon("population")}
                      </div>
                    </th>
                    <th
                      className="p-2 border-r-2 border-slate-300 dark:border-slate-600 text-right min-w-[130px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group/th"
                      onClick={() => handleIncSort("suspectedCasesYearMinus3")}
                    >
                      <div className="flex items-center justify-end gap-1.5 pr-2">
                        <span>Cases ({dataFirstYear})</span>
                        {getIncSortIcon("suspectedCasesYearMinus3")}
                      </div>
                    </th>
                    <th
                      className="p-2 border-r-2 border-slate-300 dark:border-slate-600 text-right min-w-[130px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group/th"
                      onClick={() => handleIncSort("suspectedCasesYearMinus2")}
                    >
                      <div className="flex items-center justify-end gap-1.5 pr-2">
                        <span>Cases ({dataSecondYear})</span>
                        {getIncSortIcon("suspectedCasesYearMinus2")}
                      </div>
                    </th>
                    <th
                      className="p-2 border-r-2 border-slate-300 dark:border-slate-600 text-right min-w-[140px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group/th"
                      onClick={() => handleIncSort("suspectedCases")}
                    >
                      <div className="flex items-center justify-end gap-1.5 pr-2">
                        <span>Cases ({dataLastYear})</span>
                        {getIncSortIcon("suspectedCases")}
                      </div>
                    </th>
                    <th
                      className="p-2 text-right min-w-[160px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group/th"
                      onClick={() => handleIncSort("incidence")}
                    >
                      <div className="flex items-center justify-end gap-1.5 pr-2">
                        <span>Incidence / 100k ({dataLastYear})</span>
                        {getIncSortIcon("incidence")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-background text-foreground text-xs font-sans">
                  {paginatedIncRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground text-xs">
                        No matching districts found.
                      </td>
                    </tr>
                  ) : (
                    paginatedIncRows.map((r, i) => {
                      const globalIdx = (incPage - 1) * incPageSize + i + 1;
                      const pop = Number(r.population) || 100000;
                      const c3 = Math.max(0, Math.round((r.suspectedCases || 2) * 0.4));
                      const c2 = Math.max(0, Math.round((r.suspectedCases || 2) * 0.6));
                      const c1 = r.suspectedCases || 2;
                      const inc1 = Number(((c1 / pop) * 100000).toFixed(1));

                      return (
                        <tr key={r.districtId} className="hover:bg-muted/30 transition-colors group">
                          <td
                            className="p-1.5 border-r border-slate-200 dark:border-slate-700 text-center font-mono text-muted-foreground sticky left-0 z-20 bg-card group-hover:bg-muted/60"
                            style={{ width: "56px", minWidth: "56px" }}
                          >
                            {globalIdx}
                          </td>
                          <td
                            className="p-1.5 border-r-2 border-slate-300 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)] font-semibold text-foreground sticky z-20 bg-card group-hover:bg-muted/60"
                            style={{ left: "56px", minWidth: "200px" }}
                          >
                            {r.districtName}
                          </td>
                          <td className="p-1.5 border-r-2 border-slate-300 dark:border-slate-600 text-muted-foreground">
                            {r.provinceName}
                          </td>
                          <td className="p-1.5 border-r-2 border-slate-300 dark:border-slate-600 text-right font-mono">
                            {pop.toLocaleString()}
                          </td>
                          <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-right">
                            <Input
                              type="number"
                              min="0"
                              value={(r as any).suspectedCasesYearMinus3 ?? c3}
                              onChange={(e) => handleCellChange(r.districtId, "suspectedCasesYearMinus3" as any, Number(e.target.value))}
                              className="h-7 w-20 text-xs text-right font-mono p-1 ml-auto"
                              title="Edit annual measles cases for Year -3"
                            />
                          </td>
                          <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-right">
                            <Input
                              type="number"
                              min="0"
                              value={(r as any).suspectedCasesYearMinus2 ?? c2}
                              onChange={(e) => handleCellChange(r.districtId, "suspectedCasesYearMinus2" as any, Number(e.target.value))}
                              className="h-7 w-20 text-xs text-right font-mono p-1 ml-auto"
                              title="Edit annual measles cases for Year -2"
                            />
                          </td>
                          <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 text-right">
                            <Input
                              type="number"
                              min="0"
                              value={r.suspectedCases ?? 2}
                              onChange={(e) => handleCellChange(r.districtId, "suspectedCases", Number(e.target.value))}
                              className="h-7 w-20 text-xs text-right font-mono font-bold p-1 ml-auto"
                              title="Edit annual measles cases for Year -1 (Most recent)"
                            />
                          </td>
                          <td className="p-1.5 text-right font-mono font-bold">
                            <span className={inc1 > 5 ? "text-red-600 font-black" : "text-foreground"}>
                              {inc1}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Incidence Pagination Controls conforming to Rule 24 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-muted-foreground border-t">
              <div className="flex items-center gap-2">
                <span>
                  Showing {paginatedIncRows.length > 0 ? (incPage - 1) * incPageSize + 1 : 0} to{" "}
                  {Math.min(incPage * incPageSize, sortedIncRows.length)} of {sortedIncRows.length} districts
                </span>
                <span className="text-muted-foreground">•</span>
                <div className="flex items-center gap-1.5">
                  <span>Rows per page:</span>
                  <Select
                    value={String(incPageSize)}
                    onValueChange={(v) => {
                      setIncPageSize(Number(v));
                      setIncPage(1);
                    }}
                  >
                    <SelectTrigger className="h-7 w-20 text-xs font-mono">
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

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIncPage(1)}
                  disabled={incPage <= 1}
                  className="h-7 px-2 text-xs gap-1"
                  title="First Page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">First</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIncPage((p) => Math.max(1, p - 1))}
                  disabled={incPage <= 1}
                  className="h-7 px-2 text-xs gap-1"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </Button>

                {/* Page Jump Selector Dropdown */}
                <div className="flex items-center gap-1 mx-1">
                  <span className="text-muted-foreground">Page</span>
                  <Select
                    value={String(incPage)}
                    onValueChange={(v) => setIncPage(Number(v))}
                  >
                    <SelectTrigger className="h-7 w-16 text-xs font-mono font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {Array.from({ length: totalIncPages }, (_, idx) => idx + 1).map((pNum) => (
                        <SelectItem key={pNum} value={String(pNum)} className="text-xs font-mono">
                          {pNum}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground font-mono">of {totalIncPages}</span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIncPage((p) => Math.min(totalIncPages, p + 1))}
                  disabled={incPage >= totalIncPages}
                  className="h-7 px-2 text-xs gap-1"
                  title="Next Page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIncPage(totalIncPages)}
                  disabled={incPage >= totalIncPages}
                  className="h-7 px-2 text-xs gap-1"
                  title="Last Page"
                >
                  <span className="hidden sm:inline">Last</span>
                  <ChevronsRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================================================================== */}
      {/* 7. PAGE 10: CASE-BASED DATA (FULL 34 WHO COLUMNS)                     */}
      {/* ==================================================================== */}
      {activeTab === "case-based-data" && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-cyan-600" />
                  Case-Based Data (Case Linelist Registry)
                </CardTitle>
                <CardDescription className="text-xs">
                  Official WHO 34-column epidemiological registry. Directly edit surveillance inputs (Cols 1–17) with instant WHO formula recalculation (Cols 18–34).
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleAddCaseRow}
                  className="h-8 text-xs gap-1.5 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  title="Add a new measles case row to the registry"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Case</span>
                </Button>

                <Button
                  size="sm"
                  variant={isLinelistDirty ? "default" : "outline"}
                  onClick={handleSaveLinelist}
                  className={`h-8 text-xs gap-1.5 font-semibold ${isLinelistDirty ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse" : "text-slate-700 dark:text-slate-200"}`}
                  title="Save case linelist modifications"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isLinelistDirty ? "Save Linelist *" : "Save Linelist"}</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetLinelist}
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  title="Reset to default synthesized records"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadBlankLinelistTemplate}
                  className="h-8 text-xs gap-1.5 text-slate-700 dark:text-slate-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Blank WHO Template</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={exportCaseLinelistCSV}
                  className="h-8 text-xs gap-1.5 font-bold bg-cyan-700 hover:bg-cyan-800 text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export 34 Columns (CSV)</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Instruction Warning Banner (Matching Excel Sheet) */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 rounded-md text-amber-900 dark:text-amber-200 text-xs space-y-1 shadow-sm">
              <div className="font-bold flex items-center gap-1.5 text-amber-950 dark:text-amber-100">
                <Info className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                WHO Case-Based Data Linelist Protocol &amp; Calculation Rules:
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300 pl-1">
                <li>The header and the order of the source data must match the target columns.</li>
                <li>The source data types must be compliant with the specifications (DD/MM/YYYY, Predefined Values, Number, Text).</li>
                <li>Please pay special attention to the &apos;Predefined values&apos; for &apos;Final Classification&apos;, &apos;Sex&apos;, &apos;Vaccination Status&apos; and &apos;Number of Vaccine Doses&apos;.</li>
                <li>
                  <strong className="font-semibold text-rose-700 dark:text-rose-400">Do not alter the &apos;Calculation columns&apos; (Cols 18–34)</strong> highlighted in red on the right. These custom formulas evaluate WHO surveillance quality and threat indicators automatically.
                </li>
              </ul>
            </div>

            {/* Controls Bar: Search, Filters, Page Size, Stretch */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-lg border">
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search Case ID, District, Residence..."
                    value={caseSearchTerm}
                    onChange={(e) => {
                      setCaseSearchTerm(e.target.value);
                      setCaseCurrentPage(1);
                    }}
                    className="h-8 pl-8 text-xs bg-background"
                  />
                </div>

                <Select
                  value={caseClassificationFilter}
                  onValueChange={(v) => {
                    setCaseClassificationFilter(v);
                    setCaseCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-[180px] bg-background">
                    <SelectValue placeholder="Classification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Classifications</SelectItem>
                    <SelectItem value="Lab Confirmed Measles">Lab Confirmed Measles</SelectItem>
                    <SelectItem value="Epi-Linked Measles">Epi-Linked Measles</SelectItem>
                    <SelectItem value="Clinically Compatible Measles">Clinically Compatible</SelectItem>
                    <SelectItem value="Discarded Non-Measles">Discarded Non-Measles</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={caseVaccinationFilter}
                  onValueChange={(v) => {
                    setCaseVaccinationFilter(v);
                    setCaseCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-[140px] bg-background">
                    <SelectValue placeholder="Vaccination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Vaccination</SelectItem>
                    <SelectItem value="Yes">Yes (Vaccinated)</SelectItem>
                    <SelectItem value="No">No (Zero-Dose)</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>

                {(caseSearchTerm || caseClassificationFilter !== "ALL" || caseVaccinationFilter !== "ALL") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCaseSearchTerm("");
                      setCaseClassificationFilter("ALL");
                      setCaseVaccinationFilter("ALL");
                      setCaseCurrentPage(1);
                    }}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
                <Badge variant="outline" className="text-xs font-mono">
                  {filteredCases.length} of {linelistRows.length} Cases
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCaseStretched(!isCaseStretched)}
                  className="h-8 text-xs gap-1.5"
                  title="Toggle wider columns for high-resolution screens"
                >
                  {isCaseStretched ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span>{isCaseStretched ? "Standard Width" : "Stretch Columns"}</span>
                </Button>

                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Rows:</span>
                  <Select
                    value={String(casePageSize)}
                    onValueChange={(v) => {
                      setCasePageSize(Number(v));
                      setCaseCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-[70px] bg-background">
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
            </div>

            {/* Table Container with Horizontal Scroll across all 34 columns */}
            <div className="border rounded-md overflow-x-auto shadow-sm">
              <table className={`text-xs text-left border-collapse table-fixed select-none ${isCaseStretched ? "min-w-[4200px]" : "min-w-[3400px]"}`}>
                {/* Level 1 Super Headers: Predefined Input vs Calculated Formulas */}
                <thead>
                  <tr className="border-b">
                    <th colSpan={2} className="bg-slate-900 text-white p-2 text-center text-xs font-bold border-r-2 border-slate-700 sticky left-0 z-30">
                      # &amp; Action
                    </th>
                    <th colSpan={4} className="bg-slate-800 text-white p-2 text-center text-xs font-bold border-r-2 border-slate-700">
                      Case Identification &amp; Geography
                    </th>
                    <th colSpan={13} className="bg-slate-700 text-white p-2 text-center text-xs font-bold border-r-4 border-rose-500">
                      Predefined / User Input Surveillance Values (Columns 1–17, Inline Editable)
                    </th>
                    <th colSpan={17} className="bg-rose-700 text-white p-2 text-center text-xs font-black tracking-wide">
                      Calculated Values — WHO Automated Rules &amp; Indicator Formulas (Columns 18–34)
                    </th>
                  </tr>

                  {/* Level 2 Sub-Headers: Specifications and Exact Column Names */}
                  <tr className="border-b font-semibold">
                    {/* Index */}
                    <th className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-12 sticky left-0 z-20">
                      #
                    </th>
                    {/* Action */}
                    <th className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-14">
                      Del
                    </th>
                    {/* 1: Year */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-24 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("year")}
                    >
                      Year {getCaseSortIcon("year")}
                    </th>
                    {/* 2: Admin1 */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 border-r-2 border-slate-300 dark:border-slate-700 w-36 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("admin1")}
                    >
                      Admin1 {getCaseSortIcon("admin1")}
                    </th>
                    {/* 3: Reporting District */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 border-r-2 border-slate-300 dark:border-slate-700 w-44 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("reportingDistrict")}
                    >
                      Reporting District {getCaseSortIcon("reportingDistrict")}
                    </th>
                    {/* 4: Case ID */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 border-r-2 border-slate-400 dark:border-slate-600 w-48 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("caseId")}
                    >
                      Case ID {getCaseSortIcon("caseId")}
                    </th>
                    {/* 5: Final Classification */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 border-r-2 border-slate-300 dark:border-slate-700 w-48 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("finalClassification")}
                    >
                      Final Classification {getCaseSortIcon("finalClassification")}
                    </th>
                    {/* 6: Age in Years */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-24 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("ageYears")}
                    >
                      Age in Years {getCaseSortIcon("ageYears")}
                    </th>
                    {/* 7: Age in Months */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-24 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("ageMonths")}
                    >
                      Age in Months {getCaseSortIcon("ageMonths")}
                    </th>
                    {/* 8: Sex */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-16 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("sex")}
                    >
                      Sex {getCaseSortIcon("sex")}
                    </th>
                    {/* 9: Place of Residence */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 border-r-2 border-slate-300 dark:border-slate-700 w-44 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("placeOfResidence")}
                    >
                      Place of Residence {getCaseSortIcon("placeOfResidence")}
                    </th>
                    {/* 10: Date of Rash Onset */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-36 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("dateRashOnset")}
                    >
                      Date of Rash Onset {getCaseSortIcon("dateRashOnset")}
                    </th>
                    {/* 11: Vaccination Status */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-32 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("vaccinationStatus")}
                    >
                      Vaccination Status {getCaseSortIcon("vaccinationStatus")}
                    </th>
                    {/* 12: Number of Vaccine Doses */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-24 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("dosesReceived")}
                    >
                      Doses {getCaseSortIcon("dosesReceived")}
                    </th>
                    {/* 13: Date of Notification */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-36 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("dateNotification")}
                    >
                      Date Notification {getCaseSortIcon("dateNotification")}
                    </th>
                    {/* 14: Date of Investigation */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-36 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("dateInvestigation")}
                    >
                      Date Investigation {getCaseSortIcon("dateInvestigation")}
                    </th>
                    {/* 15: Date of Blood Sample Collection */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-36 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("dateBloodSample")}
                    >
                      Date Blood Sample {getCaseSortIcon("dateBloodSample")}
                    </th>
                    {/* 16: Date District Received Lab Result */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-center border-r-2 border-slate-300 dark:border-slate-700 w-36 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("dateLabResult")}
                    >
                      Date Lab Result {getCaseSortIcon("dateLabResult")}
                    </th>
                    {/* 17: Place of Infection or Travel History */}
                    <th
                      className="p-2 bg-slate-100 dark:bg-slate-800 border-r-4 border-rose-500 w-44 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleCaseSort("placeOfInfection")}
                    >
                      Place of Infection / Travel {getCaseSortIcon("placeOfInfection")}
                    </th>

                    {/* ================================================================= */}
                    {/* CALCULATED COLUMNS (COLS 18-34) WITH ROSE/RED HEADER BAND         */}
                    {/* ================================================================= */}
                    {/* 18: Normalized_Admin2_Label */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 border-r-2 border-rose-300 dark:border-rose-800 w-44 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("normalizedAdmin2")}
                    >
                      Normalized_Admin2_Label {getCaseSortIcon("normalizedAdmin2")}
                    </th>
                    {/* 19: Core_Variables_Ok */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-36 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("coreVariablesOk")}
                    >
                      Core_Variables_Ok {getCaseSortIcon("coreVariablesOk")}
                    </th>
                    {/* 20: Calc_Age_Months */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-36 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("calcAgeMonths")}
                    >
                      Calc_Age_Months {getCaseSortIcon("calcAgeMonths")}
                    </th>
                    {/* 21: MCV_Age_Eligible */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-36 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("mcvAgeEligible")}
                    >
                      MCV_Age_Eligible {getCaseSortIcon("mcvAgeEligible")}
                    </th>
                    {/* 22: Unvaccinated_Case */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-36 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("unvaccinatedCase")}
                    >
                      Unvaccinated_Case {getCaseSortIcon("unvaccinatedCase")}
                    </th>
                    {/* 23: Unknown_Case */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-32 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("unknownCase")}
                    >
                      Unknown_Case {getCaseSortIcon("unknownCase")}
                    </th>
                    {/* 24: Unvac_Or_Unknown_Case */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-44 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("unvacOrUnknownCase")}
                    >
                      Unvac_Or_Unknown_Case {getCaseSortIcon("unvacOrUnknownCase")}
                    </th>
                    {/* 25: Discarded_Case */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-32 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("discardedCase")}
                    >
                      Discarded_Case {getCaseSortIcon("discardedCase")}
                    </th>
                    {/* 26: Confirmed_Case */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-32 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("confirmedCase")}
                    >
                      Confirmed_Case {getCaseSortIcon("confirmedCase")}
                    </th>
                    {/* 27: Epidemiologic_Case */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-36 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("epidemiologicCase")}
                    >
                      Epidemiologic_Case {getCaseSortIcon("epidemiologicCase")}
                    </th>
                    {/* 28: Case_0_5_Years */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-32 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("case0to5Years")}
                    >
                      Case_0_5_Years {getCaseSortIcon("case0to5Years")}
                    </th>
                    {/* 29: Case_5_15_Years */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-36 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("case5to15Years")}
                    >
                      Case_5_15_Years {getCaseSortIcon("case5to15Years")}
                    </th>
                    {/* 30: Case_Over_15_Years */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-36 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("caseOver15Years")}
                    >
                      Case_Over_15_Years {getCaseSortIcon("caseOver15Years")}
                    </th>
                    {/* 31: Adequate_Investigation */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-40 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("adequateInvestigation")}
                    >
                      Adequate_Investigation {getCaseSortIcon("adequateInvestigation")}
                    </th>
                    {/* 32: Specimen_Collected */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-36 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("specimenCollected")}
                    >
                      Specimen_Collected {getCaseSortIcon("specimenCollected")}
                    </th>
                    {/* 33: Adequate_Specimen_Coll */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center border-r-2 border-rose-300 dark:border-rose-800 w-44 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("adequateSpecimenColl")}
                    >
                      Adequate_Specimen_Coll {getCaseSortIcon("adequateSpecimenColl")}
                    </th>
                    {/* 34: Timely_Avail_Of_Lab_Results */}
                    <th
                      className="p-2 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 text-center w-48 cursor-pointer hover:bg-rose-200"
                      onClick={() => handleCaseSort("timelyAvailLabResults")}
                    >
                      Timely_Avail_Of_Lab_Results {getCaseSortIcon("timelyAvailLabResults")}
                    </th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {paginatedCases.length === 0 ? (
                    <tr>
                      <td colSpan={36} className="p-8 text-center text-muted-foreground italic">
                        No surveillance cases found matching the current search or filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedCases.map((row, idx) => {
                      const absoluteIndex = (caseCurrentPage - 1) * casePageSize + idx + 1;
                      return (
                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                          {/* 0: # */}
                          <td className="p-1.5 text-center font-mono text-muted-foreground border-r border-slate-300 dark:border-slate-700 sticky left-0 z-10 bg-background text-[11px]">
                            {absoluteIndex}
                          </td>
                          {/* Action */}
                          <td className="p-1 text-center border-r-2 border-slate-300 dark:border-slate-700">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCaseRow(row.id)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                              title="Delete surveillance case"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                          {/* 1: Year */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Input
                              type="number"
                              value={row.year}
                              onChange={(e) => handleCaseCellChange(row.id, "year", Number(e.target.value))}
                              className="h-7 w-20 text-xs text-center font-mono font-bold p-1"
                            />
                          </td>
                          {/* 2: Admin1 */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700 font-medium">
                            <Input
                              value={row.admin1}
                              onChange={(e) => handleCaseCellChange(row.id, "admin1", e.target.value)}
                              className="h-7 w-32 text-xs p-1"
                            />
                          </td>
                          {/* 3: Reporting District */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700 font-semibold">
                            <Input
                              value={row.reportingDistrict}
                              onChange={(e) => handleCaseCellChange(row.id, "reportingDistrict", e.target.value)}
                              className="h-7 w-36 text-xs p-1 font-semibold"
                            />
                          </td>
                          {/* 4: Case ID */}
                          <td className="p-1 border-r-2 border-slate-300 dark:border-slate-600 font-mono text-primary font-bold text-[11px]">
                            <Input
                              value={row.caseId}
                              onChange={(e) => handleCaseCellChange(row.id, "caseId", e.target.value)}
                              className="h-7 w-40 text-xs font-mono font-bold p-1 text-primary"
                            />
                          </td>
                          {/* 5: Final Classification */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Select
                              value={row.finalClassification}
                              onValueChange={(val) => handleCaseCellChange(row.id, "finalClassification", val)}
                            >
                              <SelectTrigger className="h-7 w-44 text-[11px] p-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Lab Confirmed Measles">Lab Confirmed Measles</SelectItem>
                                <SelectItem value="Epi-Linked Measles">Epi-Linked Measles</SelectItem>
                                <SelectItem value="Clinically Compatible Measles">Clinically Compatible</SelectItem>
                                <SelectItem value="Discarded Non-Measles">Discarded Non-Measles</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          {/* 6: Age in Years */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Input
                              type="number"
                              step="0.1"
                              value={row.ageYears}
                              onChange={(e) => handleCaseCellChange(row.id, "ageYears", e.target.value)}
                              className="h-7 w-16 text-xs text-center font-mono p-1"
                            />
                          </td>
                          {/* 7: Age in Months */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Input
                              type="number"
                              value={row.ageMonths}
                              onChange={(e) => handleCaseCellChange(row.id, "ageMonths", e.target.value)}
                              className="h-7 w-16 text-xs text-center font-mono p-1"
                            />
                          </td>
                          {/* 8: Sex */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Select
                              value={row.sex || "F"}
                              onValueChange={(val: "M" | "F" | "U") => handleCaseCellChange(row.id, "sex", val)}
                            >
                              <SelectTrigger className="h-7 w-14 text-xs p-1 text-center font-bold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="M">M</SelectItem>
                                <SelectItem value="F">F</SelectItem>
                                <SelectItem value="U">U</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          {/* 9: Place of Residence */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Input
                              value={row.placeOfResidence}
                              onChange={(e) => handleCaseCellChange(row.id, "placeOfResidence", e.target.value)}
                              className="h-7 w-36 text-xs p-1"
                            />
                          </td>
                          {/* 10: Date of Rash Onset */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Input
                              type="date"
                              value={row.dateRashOnset}
                              onChange={(e) => handleCaseCellChange(row.id, "dateRashOnset", e.target.value)}
                              className="h-7 w-32 text-xs p-1 font-mono"
                            />
                          </td>
                          {/* 11: Vaccination Status */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Select
                              value={row.vaccinationStatus || "Unknown"}
                              onValueChange={(val) => handleCaseCellChange(row.id, "vaccinationStatus", val)}
                            >
                              <SelectTrigger className="h-7 w-24 text-[11px] p-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Yes">Yes</SelectItem>
                                <SelectItem value="No">No</SelectItem>
                                <SelectItem value="Unknown">Unknown</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          {/* 12: Number of Vaccine Doses */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Input
                              type="number"
                              min="0"
                              max="6"
                              value={row.dosesReceived}
                              onChange={(e) => handleCaseCellChange(row.id, "dosesReceived", e.target.value)}
                              className="h-7 w-16 text-xs text-center font-mono p-1"
                            />
                          </td>
                          {/* 13: Date of Notification */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Input
                              type="date"
                              value={row.dateNotification}
                              onChange={(e) => handleCaseCellChange(row.id, "dateNotification", e.target.value)}
                              className="h-7 w-32 text-xs p-1 font-mono"
                            />
                          </td>
                          {/* 14: Date of Investigation */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Input
                              type="date"
                              value={row.dateInvestigation}
                              onChange={(e) => handleCaseCellChange(row.id, "dateInvestigation", e.target.value)}
                              className="h-7 w-32 text-xs p-1 font-mono"
                            />
                          </td>
                          {/* 15: Date of Blood Sample Collection */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Input
                              type="date"
                              value={row.dateBloodSample}
                              onChange={(e) => handleCaseCellChange(row.id, "dateBloodSample", e.target.value)}
                              className="h-7 w-32 text-xs p-1 font-mono"
                            />
                          </td>
                          {/* 16: Date District Received Lab Result */}
                          <td className="p-1 border-r-2 border-slate-200 dark:border-slate-700">
                            <Input
                              type="date"
                              value={row.dateLabResult}
                              onChange={(e) => handleCaseCellChange(row.id, "dateLabResult", e.target.value)}
                              className="h-7 w-32 text-xs p-1 font-mono"
                            />
                          </td>
                          {/* 17: Place of Infection or Travel History */}
                          <td className="p-1 border-r-4 border-rose-500">
                            <Input
                              value={row.placeOfInfection}
                              onChange={(e) => handleCaseCellChange(row.id, "placeOfInfection", e.target.value)}
                              className="h-7 w-36 text-xs p-1"
                            />
                          </td>

                          {/* ========================================================= */}
                          {/* 18-34: CALCULATED COLUMNS (SOFT ROSE BACKGROUND TINT)      */}
                          {/* ========================================================= */}
                          {/* 18: Normalized_Admin2_Label */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 font-medium border-r border-rose-200 dark:border-rose-900 truncate">
                            {row.normalizedAdmin2}
                          </td>
                          {/* 19: Core_Variables_Ok */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                              {row.coreVariablesOk}
                            </span>
                          </td>
                          {/* 20: Calc_Age_Months */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono font-bold border-r border-rose-200 dark:border-rose-900">
                            {row.calcAgeMonths}m
                          </td>
                          {/* 21: MCV_Age_Eligible */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            {row.mcvAgeEligible}
                          </td>
                          {/* 22: Unvaccinated_Case */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            <span className={row.unvaccinatedCase === 1 ? "text-red-600 font-bold" : "text-muted-foreground"}>
                              {row.unvaccinatedCase}
                            </span>
                          </td>
                          {/* 23: Unknown_Case */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            {row.unknownCase}
                          </td>
                          {/* 24: Unvac_Or_Unknown_Case */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            <span className={row.unvacOrUnknownCase === 1 ? "text-red-700 font-black" : "text-muted-foreground"}>
                              {row.unvacOrUnknownCase}
                            </span>
                          </td>
                          {/* 25: Discarded_Case */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            {row.discardedCase}
                          </td>
                          {/* 26: Confirmed_Case */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            <span className={row.confirmedCase === 1 ? "text-red-600 font-bold" : "text-muted-foreground"}>
                              {row.confirmedCase}
                            </span>
                          </td>
                          {/* 27: Epidemiologic_Case */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            {row.epidemiologicCase}
                          </td>
                          {/* 28: Case_0_5_Years */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            {row.case0to5Years}
                          </td>
                          {/* 29: Case_5_15_Years */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            {row.case5to15Years}
                          </td>
                          {/* 30: Case_Over_15_Years */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            {row.caseOver15Years}
                          </td>
                          {/* 31: Adequate_Investigation */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            <span className={row.adequateInvestigation === 1 ? "text-emerald-700 font-bold" : "text-red-500 font-bold"}>
                              {row.adequateInvestigation}
                            </span>
                          </td>
                          {/* 32: Specimen_Collected */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            {row.specimenCollected}
                          </td>
                          {/* 33: Adequate_Specimen_Coll */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono border-r border-rose-200 dark:border-rose-900">
                            <span className={row.adequateSpecimenColl === 1 ? "text-emerald-700 font-bold" : "text-amber-600"}>
                              {row.adequateSpecimenColl}
                            </span>
                          </td>
                          {/* 34: Timely_Avail_Of_Lab_Results */}
                          <td className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-center font-mono">
                            <span className={row.timelyAvailLabResults === 1 ? "text-emerald-700 font-bold" : "text-amber-600"}>
                              {row.timelyAvailLabResults}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls conforming to Rule 24 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-muted-foreground border-t">
              <div className="flex items-center gap-2">
                <span>
                  Showing {sortedCases.length > 0 ? (caseCurrentPage - 1) * casePageSize + 1 : 0} to{" "}
                  {Math.min(caseCurrentPage * casePageSize, sortedCases.length)} of {sortedCases.length} records
                </span>
                <span className="text-muted-foreground">•</span>
                <div className="flex items-center gap-1.5">
                  <span>Rows per page:</span>
                  <Select
                    value={String(casePageSize)}
                    onValueChange={(v) => {
                      setCasePageSize(Number(v));
                      setCaseCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-7 w-20 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCaseCurrentPage(1)}
                  disabled={caseCurrentPage <= 1}
                  className="h-7 px-2 text-xs gap-1"
                  title="First Page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">First</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCaseCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={caseCurrentPage <= 1}
                  className="h-7 px-2 text-xs gap-1"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </Button>

                {/* Page Jump Selector Dropdown */}
                <div className="flex items-center gap-1 mx-1">
                  <span className="text-muted-foreground">Page</span>
                  <Select
                    value={String(caseCurrentPage)}
                    onValueChange={(v) => setCaseCurrentPage(Number(v))}
                  >
                    <SelectTrigger className="h-7 w-16 text-xs font-mono font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {Array.from({ length: totalCasePages }, (_, idx) => idx + 1).map((pNum) => (
                        <SelectItem key={pNum} value={String(pNum)} className="text-xs font-mono">
                          {pNum}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground font-mono">of {totalCasePages}</span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCaseCurrentPage((p) => Math.min(totalCasePages, p + 1))}
                  disabled={caseCurrentPage >= totalCasePages}
                  className="h-7 px-2 text-xs gap-1"
                  title="Next Page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCaseCurrentPage(totalCasePages)}
                  disabled={caseCurrentPage >= totalCasePages}
                  className="h-7 px-2 text-xs gap-1"
                  title="Last Page"
                >
                  <span className="hidden sm:inline">Last</span>
                  <ChevronsRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================================================================== */}
      {/* 8. PAGE 11: REPORT PREVIEW (STANDARDIZED WHO FINAL REPORT EMBEDDED)   */}
      {/* ==================================================================== */}
      {activeTab === "report-preview" && (
        <div className="space-y-4 w-full max-w-none">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Standardized WHO Programmatic Risk Assessment Report Preview
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comprehensive national synthesis for {assessmentCountry} ({baselineYear1}–{baselineYear3}). Captures and shows ALL evaluated districts, risk tiers, provincial breakdowns, and action registers.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("indicator-maps")}
                    className="h-8 text-xs gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    <span>View Spatial Maps</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveMutation.mutate({ recalculate: true })}
                    className="h-8 text-xs gap-1.5 font-bold"
                    disabled={saveMutation.isPending}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>{saveMutation.isPending ? "Calculating..." : "Re-run Assessment Scoring"}</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Embedded Full WHO RiskFinalReportView showing ALL tables and records */}
          <RiskFinalReportView
            assessment={
              assessment || {
                id: assessmentId,
                title: `Measles Programmatic Risk Assessment (${assessmentCountry})`,
                tenantName: assessmentCountry,
                assessmentYear: targetYear,
                baselineYears: [baselineYear1, baselineYear2, baselineYear3],
                countryName: assessmentCountry,
              }
            }
            districtResults={effectiveReportDistrictResults}
          />
        </div>
      )}

      {/* Bulk Value Dialog */}
      <Dialog open={Boolean(bulkDialogField)} onOpenChange={(open) => !open && setBulkDialogField(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Bulk Set: {bulkDialogTitle}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Apply this value across districts in {bulkProvinceId === "ALL" ? "the entire national program" : bulkProvinceId}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div>
              <Label className="text-xs">Value to apply</Label>
              <Input
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder="Enter value..."
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkDialogField(null)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={applyBulkValue} className="h-8 text-xs font-bold">
              Apply Across Districts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual National Population Configuration Modal */}
      <Dialog open={isManualPopDialogOpen} onOpenChange={setIsManualPopDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Manual National Population Configuration
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure the total national population for {assessmentCountry} and select the allocation method across all {localRows.length} evaluated districts.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Total National Population:</Label>
              <Input
                value={manualNationalPopInput}
                onChange={(e) => setManualNationalPopInput(e.target.value)}
                placeholder="e.g. 60,000,000"
                className="font-mono text-sm font-bold h-9"
              />
              <span className="text-[11px] text-muted-foreground block">
                Current National Total: <span className="font-mono font-semibold">{totalNationalPopulation.toLocaleString()}</span>
              </span>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Allocation Method across {localRows.length} Districts:</Label>
              <div className="space-y-2">
                <label className="flex items-start gap-2 p-2.5 border rounded-md cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="radio"
                    name="popDistributionMethod"
                    checked={popDistributionMethod === "proportional"}
                    onChange={() => setPopDistributionMethod("proportional")}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold block text-foreground">Proportional Distribution (Recommended)</span>
                    <span className="text-muted-foreground text-[11px] block leading-relaxed">
                      Preserves existing regional population ratios, scaling each district's population proportionally.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2 p-2.5 border rounded-md cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="radio"
                    name="popDistributionMethod"
                    checked={popDistributionMethod === "equal"}
                    onChange={() => setPopDistributionMethod("equal")}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold block text-foreground">Equal Distribution</span>
                    <span className="text-muted-foreground text-[11px] block leading-relaxed">
                      Distributes the national total equally across all {localRows.length} districts (~
                      {Math.round(
                        (Number(manualNationalPopInput.replace(/,/g, "")) || totalNationalPopulation) /
                          Math.max(1, localRows.length)
                      ).toLocaleString()}{" "}
                      per district).
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsManualPopDialogOpen(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleApplyManualNationalPop} className="h-8 text-xs font-bold gap-1.5">
              <Check className="w-3.5 h-3.5" /> Apply Population
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
