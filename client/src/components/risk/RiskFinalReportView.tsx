import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Printer,
  FileText,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  MapPin,
  Users,
  Building2,
  TrendingDown,
  Info,
} from "lucide-react";

interface AreaResult {
  id: string;
  districtId: number;
  districtName?: string;
  areaName?: string;
  provinceName?: string;
  provinceId?: number | null;
  riskCategory: string;
  totalScore?: string | null;
  totalRiskScore?: string | null;
  population?: string | number | null;
  areaKm2?: string | number | null;
  domainScoresJson?: any;
  populationImmunityScore?: string | null;
  surveillanceQualityScore?: string | null;
  programmeDeliveryScore?: string | null;
  threatAssessmentScore?: string | null;
  summaryExplanation?: string | null;
}

interface Props {
  assessment: any;
  districtResults: AreaResult[];
}

export function RiskFinalReportView({ assessment, districtResults }: Props) {
  const countryName = assessment?.tenantName || "South Africa";
  const assessmentYear = assessment?.assessmentYear || 2024;
  const baselineYears = assessment?.baselineYears || [assessmentYear - 3, assessmentYear - 2, assessmentYear - 1];
  const dateFormatted = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const totalDistricts = districtResults.length || 1;
  const totalPopulation = useMemo(() => {
    return districtResults.reduce((acc, d) => acc + (Number(d.population) || 0), 0);
  }, [districtResults]);

  // Counts & Tiers
  const stats = useMemo(() => {
    const counts = { VERY_HIGH: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const pops = { VERY_HIGH: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

    districtResults.forEach((d) => {
      const cat = (d.riskCategory || "LOW") as keyof typeof counts;
      if (counts[cat] !== undefined) {
        counts[cat]++;
        pops[cat] += Number(d.population) || 0;
      }
    });

    return { counts, pops };
  }, [districtResults]);

  // Province Breakdown
  const provinceBreakdown = useMemo(() => {
    const map = new Map<string, { VERY_HIGH: number; HIGH: number; MEDIUM: number; LOW: number; total: number }>();
    districtResults.forEach((d) => {
      const p = d.provinceName || "National";
      if (!map.has(p)) {
        map.set(p, { VERY_HIGH: 0, HIGH: 0, MEDIUM: 0, LOW: 0, total: 0 });
      }
      const item = map.get(p)!;
      const cat = (d.riskCategory || "LOW") as "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";
      if (item[cat] !== undefined) {
        item[cat]++;
      }
      item.total++;
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [districtResults]);

  // Very High & High Risk Districts
  const vhrDistricts = useMemo(() => {
    return districtResults
      .filter((d) => d.riskCategory === "VERY_HIGH")
      .sort((a, b) => Number(b.totalRiskScore || b.totalScore || 0) - Number(a.totalRiskScore || a.totalScore || 0));
  }, [districtResults]);

  const hrDistricts = useMemo(() => {
    return districtResults
      .filter((d) => d.riskCategory === "HIGH")
      .sort((a, b) => Number(b.totalRiskScore || b.totalScore || 0) - Number(a.totalRiskScore || a.totalScore || 0));
  }, [districtResults]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadDocx = () => {
    window.location.href = `/api/risk/assessments/${assessment.id}/export-report-docx`;
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar (Hidden during Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-lg p-4 print:hidden shadow-sm">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Official Country Report Preview
          </h3>
          <p className="text-xs text-muted-foreground">
            Conforming strictly to the WHO Measles Programmatic Risk Assessment Report standard. Download as Word (.docx) or print directly.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Print / Export PDF
          </Button>

          <Button size="sm" onClick={handleDownloadDocx} className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground shadow-sm">
            <Download className="w-3.5 h-3.5" /> Download Word Report (.docx)
          </Button>
        </div>
      </div>

      {/* PRINTABLE DOCUMENT BODY */}
      <div className="bg-card border rounded-lg p-8 sm:p-12 shadow-sm space-y-8 print:border-none print:shadow-none print:p-0 max-w-5xl mx-auto">
        {/* Title Header */}
        <div className="border-b pb-6 text-center space-y-2">
          <Badge variant="outline" className="mb-1 text-xs border-primary/40 text-primary uppercase font-bold tracking-wider">
            WHO Programmatic Risk Assessment Engine
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Measles Risk Assessment Final Report
          </h1>
          <h2 className="text-lg font-medium text-muted-foreground">
            Subnational Programmatic Risk Profile — {countryName}
          </h2>
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date Completed: {dateFormatted}
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Assessment Year: {assessmentYear}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Baseline Years: {baselineYears.join(", ")}
            </span>
          </div>
        </div>

        {/* Background & Executive Summary */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Background</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The World Health Organization (WHO) measles programmatic risk assessment tool identifies areas not meeting measles programmatic targets in order to guide and strengthen measles elimination program activities and reduce the risk of outbreaks. The tool assesses subnational programmatic risk across four core categories:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
            <li>
              <strong>Population immunity (40%):</strong> Assesses measles susceptibility using administrative vaccination coverage data for first-dose (MCV1) and second-dose (MCV2) measles-containing vaccine and coverage achieved during measles supplemental immunization activities (SIAs) conducted within the past three years.
            </li>
            <li>
              <strong>Surveillance quality (20%):</strong> Evaluates the ability of a district to detect and confirm cases rapidly and accurately, including the non-measles discarded rate, adequate investigation (within 48 hours with 10 core variables), adequate specimen collection (within 28 days), and timely laboratory result availability.
            </li>
            <li>
              <strong>Program performance (16%):</strong> Evaluates routine immunization services including trends in MCV1/MCV2 coverage over 3 years, dropout rates from MCV1 to MCV2, and dropout from Penta1 to MCV1.
            </li>
            <li>
              <strong>Threat assessment (24%):</strong> Accounts for factors influencing measles virus transmission, including reported cases in children &lt;5y, 5-14y, and 15+y, bordering district outbreaks, population density, and presence of vulnerable population groups.
            </li>
          </ul>
        </div>

        {/* Section 1: Overall Measles Risk Profile */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-base font-bold text-foreground flex items-center justify-between">
            <span>Section 1: Overall Measles Risk Profile</span>
            <span className="text-xs font-normal text-muted-foreground">Total Districts: {totalDistricts}</span>
          </h3>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Of the {totalDistricts} districts in {countryName}, {stats.counts.VERY_HIGH} (
            {((stats.counts.VERY_HIGH / totalDistricts) * 100).toFixed(1)}%) were categorized as <strong>Very High Risk</strong>,{" "}
            {stats.counts.HIGH} ({((stats.counts.HIGH / totalDistricts) * 100).toFixed(1)}%) as <strong>High Risk</strong>,{" "}
            {stats.counts.MEDIUM} ({((stats.counts.MEDIUM / totalDistricts) * 100).toFixed(1)}%) as <strong>Medium Risk</strong>, and{" "}
            {stats.counts.LOW} ({((stats.counts.LOW / totalDistricts) * 100).toFixed(1)}%) as <strong>Low Risk</strong>.
          </p>

          {/* Table 1: National Summary */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white font-semibold">
                <tr>
                  <th className="p-2.5">Programmatic Risk Category</th>
                  <th className="p-2.5 text-right">Number of Districts</th>
                  <th className="p-2.5 text-right">% of Districts</th>
                  <th className="p-2.5 text-right">Total Population</th>
                  <th className="p-2.5 text-right">% of Population</th>
                </tr>
              </thead>
              <tbody className="divide-y text-foreground">
                <tr className="bg-red-50/60 dark:bg-red-950/30">
                  <td className="p-2.5 font-semibold text-red-600 dark:text-red-400">Very High Risk (Score &ge; 61)</td>
                  <td className="p-2.5 text-right font-medium">{stats.counts.VERY_HIGH}</td>
                  <td className="p-2.5 text-right font-medium">{((stats.counts.VERY_HIGH / totalDistricts) * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-right">{stats.pops.VERY_HIGH.toLocaleString()}</td>
                  <td className="p-2.5 text-right">{totalPopulation ? ((stats.pops.VERY_HIGH / totalPopulation) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="bg-orange-50/60 dark:bg-orange-950/30">
                  <td className="p-2.5 font-semibold text-orange-600 dark:text-orange-400">High Risk (Score 55–60)</td>
                  <td className="p-2.5 text-right font-medium">{stats.counts.HIGH}</td>
                  <td className="p-2.5 text-right font-medium">{((stats.counts.HIGH / totalDistricts) * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-right">{stats.pops.HIGH.toLocaleString()}</td>
                  <td className="p-2.5 text-right">{totalPopulation ? ((stats.pops.HIGH / totalPopulation) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="bg-amber-50/60 dark:bg-amber-950/30">
                  <td className="p-2.5 font-semibold text-amber-600 dark:text-amber-400">Medium Risk (Score 48–54)</td>
                  <td className="p-2.5 text-right font-medium">{stats.counts.MEDIUM}</td>
                  <td className="p-2.5 text-right font-medium">{((stats.counts.MEDIUM / totalDistricts) * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-right">{stats.pops.MEDIUM.toLocaleString()}</td>
                  <td className="p-2.5 text-right">{totalPopulation ? ((stats.pops.MEDIUM / totalPopulation) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="bg-emerald-50/60 dark:bg-emerald-950/30">
                  <td className="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400">Low Risk (Score &le; 47)</td>
                  <td className="p-2.5 text-right font-medium">{stats.counts.LOW}</td>
                  <td className="p-2.5 text-right font-medium">{((stats.counts.LOW / totalDistricts) * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-right">{stats.pops.LOW.toLocaleString()}</td>
                  <td className="p-2.5 text-right">{totalPopulation ? ((stats.pops.LOW / totalPopulation) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2">
                  <td className="p-2.5">National Total</td>
                  <td className="p-2.5 text-right">{totalDistricts}</td>
                  <td className="p-2.5 text-right">100.0%</td>
                  <td className="p-2.5 text-right">{totalPopulation.toLocaleString()}</td>
                  <td className="p-2.5 text-right">100.0%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Table 1a: Province Breakdown */}
          <div className="pt-4 space-y-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Table 1a: Risk Profile — Number of Districts by Province
            </h4>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800 text-white font-semibold">
                  <tr>
                    <th className="p-2">Province</th>
                    <th className="p-2 text-right text-red-300">Very High Risk</th>
                    <th className="p-2 text-right text-orange-300">High Risk</th>
                    <th className="p-2 text-right text-amber-300">Medium Risk</th>
                    <th className="p-2 text-right text-emerald-300">Low Risk</th>
                    <th className="p-2 text-right">Total Districts</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-foreground">
                  {provinceBreakdown.map(([prov, c], idx) => (
                    <tr key={prov} className={idx % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-900/40" : ""}>
                      <td className="p-2 font-medium">{prov}</td>
                      <td className={`p-2 text-right ${c.VERY_HIGH > 0 ? "font-bold text-red-600" : "text-muted-foreground"}`}>{c.VERY_HIGH}</td>
                      <td className={`p-2 text-right ${c.HIGH > 0 ? "font-bold text-orange-600" : "text-muted-foreground"}`}>{c.HIGH}</td>
                      <td className={`p-2 text-right ${c.MEDIUM > 0 ? "font-bold text-amber-600" : "text-muted-foreground"}`}>{c.MEDIUM}</td>
                      <td className={`p-2 text-right ${c.LOW > 0 ? "font-bold text-emerald-600" : "text-muted-foreground"}`}>{c.LOW}</td>
                      <td className="p-2 text-right font-bold">{c.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 1b: Very High Risk Districts */}
          {vhrDistricts.length > 0 && (
            <div className="pt-4 space-y-2">
              <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider">
                Table 1b: Risk Scores for Very High Risk Districts (Score &ge; 61)
              </h4>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-red-800 text-white font-semibold">
                    <tr>
                      <th className="p-2">Province</th>
                      <th className="p-2">District</th>
                      <th className="p-2 text-right">Population</th>
                      <th className="p-2 text-right">Pop. Immunity (40)</th>
                      <th className="p-2 text-right">Surv. Quality (20)</th>
                      <th className="p-2 text-right">Prog. Delivery (16)</th>
                      <th className="p-2 text-right">Threat Assess. (24)</th>
                      <th className="p-2 text-right font-bold">Total Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-foreground">
                    {vhrDistricts.map((d, idx) => {
                      const domains = d.domainScoresJson || {};
                      return (
                        <tr key={d.id} className={idx % 2 === 1 ? "bg-red-50/40 dark:bg-red-950/20" : ""}>
                          <td className="p-2 text-muted-foreground">{d.provinceName || "-"}</td>
                          <td className="p-2 font-bold">{d.areaName || d.districtName}</td>
                          <td className="p-2 text-right">{(Number(d.population) || 0).toLocaleString()}</td>
                          <td className="p-2 text-right">{d.populationImmunityScore || domains.PI || "-"}</td>
                          <td className="p-2 text-right">{d.surveillanceQualityScore || domains.SQ || "-"}</td>
                          <td className="p-2 text-right">{d.programmeDeliveryScore || domains.PD || "-"}</td>
                          <td className="p-2 text-right">{d.threatAssessmentScore || domains.TA || "-"}</td>
                          <td className="p-2 text-right font-bold text-red-600 dark:text-red-400">
                            {d.totalRiskScore || d.totalScore}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 1c: High Risk Districts */}
          {hrDistricts.length > 0 && (
            <div className="pt-4 space-y-2">
              <h4 className="text-xs font-bold text-orange-600 uppercase tracking-wider">
                Table 1c: Risk Scores for High Risk Districts (Score 55–60)
              </h4>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-orange-800 text-white font-semibold">
                    <tr>
                      <th className="p-2">Province</th>
                      <th className="p-2">District</th>
                      <th className="p-2 text-right">Population</th>
                      <th className="p-2 text-right">Pop. Immunity (40)</th>
                      <th className="p-2 text-right">Surv. Quality (20)</th>
                      <th className="p-2 text-right">Prog. Delivery (16)</th>
                      <th className="p-2 text-right">Threat Assess. (24)</th>
                      <th className="p-2 text-right font-bold">Total Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-foreground">
                    {hrDistricts.map((d, idx) => {
                      const domains = d.domainScoresJson || {};
                      return (
                        <tr key={d.id} className={idx % 2 === 1 ? "bg-orange-50/40 dark:bg-orange-950/20" : ""}>
                          <td className="p-2 text-muted-foreground">{d.provinceName || "-"}</td>
                          <td className="p-2 font-bold">{d.areaName || d.districtName}</td>
                          <td className="p-2 text-right">{(Number(d.population) || 0).toLocaleString()}</td>
                          <td className="p-2 text-right">{d.populationImmunityScore || domains.PI || "-"}</td>
                          <td className="p-2 text-right">{d.surveillanceQualityScore || domains.SQ || "-"}</td>
                          <td className="p-2 text-right">{d.programmeDeliveryScore || domains.PD || "-"}</td>
                          <td className="p-2 text-right">{d.threatAssessmentScore || domains.TA || "-"}</td>
                          <td className="p-2 text-right font-bold text-orange-600 dark:text-orange-400">
                            {d.totalRiskScore || d.totalScore}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Recommended Priority Actions */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-base font-bold text-foreground">
            Section 2: Recommended Programmatic Priority Actions
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Based on the technical methodology outlined in the WHO Technical Appendix, programmatic recommendations are targeted towards subnational districts displaying actionable weaknesses across routine immunization, surveillance, and vulnerabilities:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <Card className="border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10">
              <CardHeader className="p-3.5 pb-2">
                <CardTitle className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Immediate Priorities for Very High Risk Areas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 space-y-1.5 text-muted-foreground">
                <p>• <strong>Microplanning Revisions:</strong> Update village catchment maps and health facility session frequency for all VHR districts.</p>
                <p>• <strong>Rapid Catch-up / Defaulter Tracing:</strong> Conduct targeted periodic intensification of routine immunization (PIRI) in subdistricts with MCV1 &lt; 80%.</p>
                <p>• <strong>Cold Chain Audit:</strong> Verify functional storage and temperature monitoring in remote clinics experiencing supply interruptions.</p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10">
              <CardHeader className="p-3.5 pb-2">
                <CardTitle className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" /> Surveillance Quality & Dropout Reduction
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 space-y-1.5 text-muted-foreground">
                <p>• <strong>Active Surveillance Audits:</strong> In districts with Non-measles Discarded Rate &lt; 2 per 100k, conduct weekly zero-reporting and retrospective hospital record reviews.</p>
                <p>• <strong>Specimen Collection Logistics:</strong> Strengthen reverse cold chain to ensure &ge;80% of suspected cases have serum collected within 28 days.</p>
                <p>• <strong>Dropout Tracking:</strong> Reconcile child health logbooks between Penta1 and MCV1/MCV2 to address dropout &gt; 10%.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Official Sign-off Block */}
        <div className="pt-8 border-t space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs">
            <div className="border-t pt-2">
              <span className="font-semibold block text-foreground">Compiled By:</span>
              <span className="text-muted-foreground">National EPI Risk Assessment Team</span>
            </div>
            <div className="border-t pt-2">
              <span className="font-semibold block text-foreground">Technical Review:</span>
              <span className="text-muted-foreground">Surveillance & Immunization Taskforce</span>
            </div>
            <div className="border-t pt-2">
              <span className="font-semibold block text-foreground">Approval Status:</span>
              <Badge variant="outline" className="mt-0.5 text-[10px] border-emerald-500 text-emerald-600 bg-emerald-50">
                {assessment?.status === "APPROVED" ? "Officially Approved" : "Draft / Technical Validation"}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
