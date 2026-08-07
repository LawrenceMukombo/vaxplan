import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Printer,
  ShieldAlert,
  User,
  MapPin,
  ListChecks,
} from "lucide-react";
import {
  computeChecklistScore,
  computeSectionScores,
  getScoreTrafficLight,
  getRiskClassification,
  type ChecklistAnswer,
} from "@shared/supervisionChecklist";

export interface SupervisionScorecardProps {
  visit: {
    id: number;
    facilityId: number;
    scheduledDate: string | Date;
    conductedDate?: string | Date | null;
    supervisorName?: string | null;
    supervisorRole?: string | null;
    visitType: string;
    status: string;
    score?: number | null;
    findings?: string | null;
    followUpActions?: string | null;
    checklist?: ChecklistAnswer[] | null;
  };
  facility?: {
    id: number;
    name: string;
    hmisCode?: string | null;
    facilityType?: string | null;
    districtId?: number | null;
  };
  locationName?: string;
  onClose?: () => void;
}

export function SupervisionScorecard({
  visit,
  facility,
  locationName,
  onClose,
}: SupervisionScorecardProps) {
  const checklist = visit.checklist || [];
  const overallScore = typeof visit.score === "number" ? visit.score : computeChecklistScore(checklist);
  const trafficLight = getScoreTrafficLight(overallScore);
  const risk = getRiskClassification(overallScore);
  const sectionScores = computeSectionScores(checklist);

  const answeredCount = checklist.filter((a) => a.response === "yes" || a.response === "no" || a.response === "na").length;
  const yesCount = checklist.filter((a) => a.response === "yes").length;
  const noCount = checklist.filter((a) => a.response === "no").length;

  // Parse follow-up actions JSON if structured
  let structuredActions: { action: string; severity?: string; owner?: string; targetDate?: string; escalated?: boolean }[] = [];
  if (visit.followUpActions) {
    try {
      const parsed = JSON.parse(visit.followUpActions);
      if (Array.isArray(parsed)) {
        structuredActions = parsed;
      } else if (typeof parsed === "object" && parsed !== null && (parsed as any).action) {
        structuredActions = [parsed as any];
      }
    } catch {
      if (visit.followUpActions.trim()) {
        structuredActions = [{ action: visit.followUpActions }];
      }
    }
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:p-0 print:space-y-4">
      {/* Action Header / Controls (Hidden during print) */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Supportive Supervision Scorecard</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" />
            Print Scorecard
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Facility & Visit Metadata Card */}
      <Card className="border-l-4 border-l-primary shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  {facility?.name || `Facility #${visit.facilityId}`}
                </h3>
                {facility?.hmisCode && (
                  <Badge variant="outline" className="font-mono text-xs">
                    HMIS: {facility.hmisCode}
                  </Badge>
                )}
                <Badge variant="secondary" className="capitalize text-xs">
                  {facility?.facilityType || visit.visitType}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-4 flex-wrap mt-1">
                {locationName && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {locationName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {new Date(visit.conductedDate || visit.scheduledDate).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {visit.supervisorName && (
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {visit.supervisorName} {visit.supervisorRole ? `(${visit.supervisorRole})` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Main Score & Risk Badge */}
            <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-lg border self-start md:self-auto">
              <div className="text-right">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overall Score</div>
                <div className={`text-3xl font-extrabold font-mono ${trafficLight.textClass}`}>
                  {overallScore}%
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Badge variant="outline" className={`font-semibold px-2.5 py-0.5 ${trafficLight.badgeClass}`}>
                  {trafficLight.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    risk.level === "low"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : risk.level === "medium"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                      : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                  }
                >
                  {risk.label}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Metrics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 bg-card">
          <div className="text-xs text-muted-foreground font-medium">Scored Questions</div>
          <div className="text-2xl font-bold mt-1 text-foreground">{answeredCount}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Total checklist answers</div>
        </Card>

        <Card className="p-3 bg-emerald-500/5 border-emerald-500/20">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Compliant (Yes)
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">{yesCount}</div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
            {answeredCount > 0 ? `${Math.round((yesCount / answeredCount) * 100)}% of answered` : "0%"}
          </div>
        </Card>

        <Card className="p-3 bg-rose-500/5 border-rose-500/20">
          <div className="text-xs text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" /> Non-Compliant (No)
          </div>
          <div className="text-2xl font-bold mt-1 text-rose-700 dark:text-rose-300">{noCount}</div>
          <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
            {answeredCount > 0 ? `${Math.round((noCount / answeredCount) * 100)}% of answered` : "0%"}
          </div>
        </Card>

        <Card className="p-3 bg-amber-500/5 border-amber-500/20">
          <div className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Action Items
          </div>
          <div className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-300">
            {structuredActions.length}
          </div>
          <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Corrective actions registered</div>
        </Card>
      </div>

      {/* Section-by-Section Score Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Checklist Performance by Section
          </CardTitle>
          <CardDescription className="text-xs">
            Percentage scores and traffic light breakdown for each supervisory module section.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sectionScores.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-3 text-center">
              No section score data recorded for this visit.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sectionScores.map((sec) => (
                <div key={sec.sectionId} className="border rounded-lg p-3 bg-muted/20 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground line-clamp-1">
                      {sec.sectionTitle}
                    </span>
                    <Badge variant="outline" className={`font-mono text-xs shrink-0 ${sec.trafficLight.badgeClass}`}>
                      {sec.score}%
                    </Badge>
                  </div>

                  <Progress value={sec.score} className="h-2" />

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                    <span>
                      {sec.yesCount} Yes · {sec.noCount} No · {sec.naCount} N/A
                    </span>
                    <span>{sec.scoredQuestions} questions</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supervisor Findings & Action Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supervisor Findings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-500" />
              Key Supervisor Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visit.findings ? (
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 p-3 rounded-md border">
                {visit.findings}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic bg-muted/20 p-3 rounded-md border">
                No narrative findings noted during this visit.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Corrective Action Plan */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Corrective Action Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {structuredActions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-muted/20 p-3 rounded-md border">
                No corrective action plan required for this visit.
              </p>
            ) : (
              <div className="space-y-2">
                {structuredActions.map((act, idx) => (
                  <div key={idx} className="border rounded-md p-2.5 bg-background text-xs space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-foreground">{act.action}</span>
                      {act.escalated && (
                        <Badge variant="outline" className="border-rose-500 text-rose-600 bg-rose-500/10 text-[10px]">
                          Escalated
                        </Badge>
                      )}
                    </div>
                    {(act.owner || act.targetDate || act.severity) && (
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 flex-wrap">
                        {act.severity && <span className="capitalize">Severity: {act.severity}</span>}
                        {act.owner && <span>Owner: {act.owner}</span>}
                        {act.targetDate && <span>Target: {act.targetDate}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
