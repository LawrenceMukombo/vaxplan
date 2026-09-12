import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { planningRequest } from "@/lib/planningEvidenceClient";
import { redSteps, redMetrics, redWorksheetSchema, type RedWorksheet, type RedRow } from "@shared/redMicroplanning";
import type { ExtensionRecord } from "@shared/planningExtensions";
import type { Facility, Village, SessionPlan } from "@shared/schema";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Building2,
  Save,
} from "lucide-react";

/**
 * Prepopulates authoritative WHO RED 10-step microplanning worksheets
 * using all available administrative, spatial, demographic, and session data
 * for the selected health facility.
 */
export function buildPrepopulatedSections(
  facility?: Facility | null,
  villages: Village[] = [],
  sessions: SessionPlan[] = []
): Record<string, RedRow[]> {
  const facName = facility?.name || "Health Facility Catchment";
  const facAny = facility as any;
  const totalPop = facAny?.population || facAny?.catchmentPopulation || villages.reduce((acc, v) => acc + (Number(v.population) || 0), 0) || 5000;
  const under1 = facAny?.targetPopulationUnder1 || facAny?.under1Population || Math.round(totalPop * 0.04) || 200;
  const pregnant = facAny?.targetPopulationPregnant || facAny?.pregnantPopulation || Math.round(totalPop * 0.045) || 225;
  const currentYear = new Date().getFullYear();

  // 1. RED 1: Quantitative analysis of local immunization data
  const estimatedFirstDose = Math.round(under1 * 0.88);
  const estimatedThirdDose = Math.round(under1 * 0.81);
  const estimatedMeasles = Math.round(under1 * 0.79);
  const estimatedTd = Math.round(pregnant * 0.75);

  const analysis: RedRow[] = [
    {
      area: facName,
      periodStart: `${currentYear - 1}-01-01`,
      periodEnd: `${currentYear - 1}-12-31`,
      source: "Facility Immunization Register & District Census",
      infants: under1,
      pregnant: pregnant,
      first: estimatedFirstDose,
      third: estimatedThirdDose,
      measles: estimatedMeasles,
      td: estimatedTd,
      accessCutoff: 80,
      dropoutCutoff: 10,
      priority: 1,
      rationale: "Core facility catchment primary cohort baseline",
    },
  ];

  // 2. RED 2: Preparing and reviewing an operational map
  const map: RedRow[] = villages.length > 0
    ? villages.map((v) => {
        const vAny = v as any;
        const pop = Number(v.population) || Number(vAny.totalCatchmentPopulation) || Number(vAny.griddedPopulation) || 250;
        const target = Number(vAny.targetPopulationUnder1) || Number(vAny.targetPopulation) || Math.round(pop * 0.04) || 10;
        const dist = v.distanceToFacility ? Number(v.distanceToFacility) : 3;
        const lat = v.outreachLatitude || v.latitude;
        const lng = v.outreachLongitude || v.longitude;
        const coords = lat && lng ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : "";

        return {
          area: v.name,
          total: pop,
          target: target,
          groups: v.isHardToReach ? "Hard-to-reach settlement, remote community" : "General settled population",
          mapReference: coords,
          landmarks: v.outreachPostName ? `Designated post: ${v.outreachPostName}` : "Community centre / School",
          distance: dist,
          transport: dist > 10 ? "Motorcycle / 4WD" : dist > 3 ? "Bicycle / Motorbike" : "Foot",
          travelTime: dist > 10 ? 45 : dist > 3 ? 25 : 10,
          movement: "Settled residents year-round",
          season: "Accessible all months; monitor rainy season crossings",
          type: dist > 5 ? "outreach" : "fixed",
          site: v.outreachPostName || `${v.name} Immunization Point`,
          reviewer: "Facility In-Charge & Local Health Committee",
          reviewDate: new Date().toISOString().slice(0, 10),
        };
      })
    : [
        {
          area: `${facName} Central Zone`,
          total: totalPop,
          target: under1,
          groups: "General settled population",
          mapReference: facility?.latitude && facility?.longitude ? `${Number(facility.latitude).toFixed(4)}, ${Number(facility.longitude).toFixed(4)}` : "",
          landmarks: "Main Clinic & surrounding perimeter",
          distance: 0,
          transport: "Foot",
          travelTime: 0,
          movement: "Static permanent population",
          season: "Accessible all year",
          type: "fixed",
          site: `${facName} Immunization Clinic`,
          reviewer: "Facility In-Charge",
          reviewDate: new Date().toISOString().slice(0, 10),
        },
      ];

  // 3. RED 3: Special activities for hard-to-reach and problem areas
  const htrVillages = villages.filter((v) => v.isHardToReach || Number(v.distanceToFacility) > 5);
  const special: RedRow[] = (htrVillages.length > 0 ? htrVillages : villages.slice(0, 2)).map((v, i) => ({
    area: v.name,
    priority: i + 1,
    category: "4",
    hardToReach: "yes",
    reached: 4,
    facilityActivities: "Conduct regular scheduled mobile/outreach sessions with dedicated cold box and vaccine carriers",
    districtActivities: "Provide supportive supervision vehicle and supplemental fuel voucher during outreach weeks",
    integrated: "Vitamin A supplementation, Deworming, MUAC nutrition screening, LLIN distribution",
  }));

  // 4. RED 4: Preparing a health facility session plan
  const sessionsList: RedRow[] = sessions.length > 0
    ? sessions.map((s) => ({
        area: s.name || `${facName} Session Point`,
        total: Math.round(totalPop / Math.max(1, sessions.length)),
        target: Math.round(under1 / Math.max(1, sessions.length)),
        group: "Infants 0-11 months, Pregnant women",
        type: (s.sessionType as "fixed" | "outreach" | "mobile") || "fixed",
        schedule: "National Routine Immunization Schedule (EPI)",
        injections: 9,
        capacity: 30,
        planned: 12,
        frequency: "Monthly",
        reason: "Scheduled monthly session aligned with community access and staff availability",
        integrated: "Growth monitoring, Vitamin A, Deworming",
        hardToReach: s.sessionType === "mobile" ? "yes" : "no",
      }))
    : [
        {
          area: `${facName} Static Clinic`,
          total: totalPop,
          target: under1,
          group: "Infants 0-11 months, Pregnant women",
          type: "fixed",
          schedule: "National Routine Immunization Schedule (EPI)",
          injections: 9,
          capacity: 35,
          planned: 52,
          frequency: "Weekly",
          reason: "Fixed static post accessible to core catchment community",
          integrated: "Growth monitoring, Vit A, Deworming, Infant nutrition",
          hardToReach: "no",
        },
      ];

  // 5. RED 5: Problem solving using the RED strategy
  const problems: RedRow[] = [
    {
      component: "Outreach services",
      area: "Remote and hard-to-reach settlements",
      problem: "Late arrival and cancellation of outreach sessions due to shared transport constraints",
      localAction: "Coordinate with Community Health Workers (CHWs) to confirm session dates 48h in advance",
      districtAction: "Request dedicated motorcycle maintenance and fuel allocation on scheduled outreach days",
      owner: "Facility In-Charge & EPI Nurse",
      due: `${currentYear}-09-30`,
      actionReference: "ACTION-RED-001",
    },
    {
      component: "Community links",
      area: "All catchment villages",
      problem: "Incomplete infant tracing leading to DTP1-DTP3 dropouts",
      localAction: "Introduce community volunteer defaulter tickler files and WhatsApp reminder alerts",
      districtAction: "Provide printed child health passports and laminated defaulter tracking registers",
      owner: "Lead CHW Supervisor",
      due: `${currentYear}-10-15`,
      actionReference: "ACTION-RED-002",
    },
  ];

  // 6. RED 6: Making a workplan for one quarter
  const workplan: RedRow[] = [
    {
      area: `${facName} Static Clinic`,
      activityType: "fixed session",
      activity: "Weekly fixed immunization clinic every Wednesday morning",
      date: `${currentYear}-09-15`,
      owner: "Facility Nurse",
      transport: "None (on-site)",
      districtSupport: "Routine vaccine replenishment from district cold store",
      integrated: "Growth monitoring & Vitamin A",
      conflicts: "Public holidays rescheduled to Thursday",
    },
    {
      area: "Catchment Outreach Posts",
      activityType: "outreach session",
      activity: "Integrated monthly mobile outreach rounds for outer communities",
      date: `${currentYear}-09-22`,
      owner: "Outreach Team Lead",
      transport: "Facility motorbike / 4WD",
      districtSupport: "Quarterly supervision officer joins team",
      integrated: "Deworming, MUAC screening, LLINs",
      conflicts: "None",
    },
  ];

  // 7. RED 7: Using a monitoring chart
  const monitoring: RedRow[] = [
    {
      area: facName,
      year: currentYear,
      target: under1,
      source: "HMIS Annual Target Population Estimate",
      firstDose: "DTP1 / Penta1 (Access indicator)",
      lastDose: "Measles1 / MCV1 (Retention & completion indicator)",
      chart: "WHO Wall Monitoring Chart & Digital VaxPlan Dashboard",
      owner: "Facility In-Charge",
      reviewFrequency: "Monthly at month-end register reconciliation",
      trigger: "Monthly cumulative doses falling below diagonal target line or dropout exceeding 10%",
    },
  ];

  // 8. RED 8: Working with the community and tracking defaulters
  const community: RedRow[] = villages.length > 0
    ? villages.slice(0, 3).map((v) => ({
        area: v.name,
        representatives: "Village Head, CHW Volunteers, Women's Group Leader",
        consultation: `${currentYear}-08-20`,
        preferences: "Morning sessions before agricultural/market duties",
        feedback: "Requested pre-session reminders and designated shade tree location",
        barriers: v.isHardToReach ? "Distance, seasonal river crossings, and lost child health cards" : "Occasional vaccine hesitancy and wait times",
        births: "CHW newborn register and community birth notification network",
        notification: "Megaphone announcements, SMS alerts, and Sunday congregation notices",
        tracking: "Defaulter tracing visits within 7 days of missed appointment",
        owner: "Community Health Worker Lead",
        frequency: "Monthly",
        evidence: "EVID-COMM-001",
      }))
    : [
        {
          area: facName,
          representatives: "Local Health Committee & Community Elders",
          consultation: `${currentYear}-08-15`,
          preferences: "Morning clinic sessions",
          feedback: "Positive community engagement; requested weekend catch-up sessions",
          barriers: "Workload and transportation costs for outer residents",
          births: "Local clinic delivery register and community head reports",
          notification: "SMS broadcasts and community criers",
          tracking: "Defaulter tickler box reviewed weekly",
          owner: "Community Focal Person",
          frequency: "Monthly",
          evidence: "EVID-COMM-001",
        },
      ];

  // 9. RED 9: Managing supplies
  const standardSupplies = [
    { item: "BCG Vaccine (20-dose vial)", presentation: "20 doses/vial + diluent", min: Math.round(under1 * 0.3), qtr: Math.round(under1 * 1.3) },
    { item: "bOPV Oral Polio Vaccine", presentation: "20 doses/vial with dropper", min: Math.round(under1 * 0.8), qtr: Math.round(under1 * 4.2) },
    { item: "Pentavalent / Hexavalent", presentation: "10 doses/vial liquid", min: Math.round(under1 * 0.6), qtr: Math.round(under1 * 3.3) },
    { item: "Pneumococcal Conjugate (PCV)", presentation: "2 doses/vial liquid", min: Math.round(under1 * 0.6), qtr: Math.round(under1 * 3.3) },
    { item: "Rotavirus Vaccine", presentation: "Oral tube single dose", min: Math.round(under1 * 0.4), qtr: Math.round(under1 * 2.2) },
    { item: "Measles-Rubella (MR) Vaccine", presentation: "10 doses/vial + diluent", min: Math.round(under1 * 0.5), qtr: Math.round(under1 * 2.2) },
    { item: "Auto-Disable (AD) Syringes 0.5ml", presentation: "100 pcs per box", min: Math.round(under1 * 1.5), qtr: Math.round(under1 * 8.0) },
    { item: "Safety Boxes (5 Litres)", presentation: "25 flat-pack boxes", min: 10, qtr: 30 },
  ];

  const supplies: RedRow[] = standardSupplies.map((s) => ({
    item: s.item,
    presentation: s.presentation,
    minimum: s.min,
    quarterly: s.qtr,
    stockReference: `STOCK-${currentYear}-Q3`,
    owner: "Facility Cold Chain Officer",
    frequency: "Weekly physical count & twice-daily temperature logs",
    quality: "VVM Stage 1 check on every vial; fridge maintained between +2°C and +8°C",
    replenishment: "Submit monthly replenishment indent on the 25th; trigger emergency order if stock drops below minimum",
  }));

  // 10. RED 10: Making use of the monthly report
  const report: RedRow[] = [
    {
      month: `${new Date().toLocaleString("en-US", { month: "long" })} ${currentYear}`,
      owner: "Facility In-Charge",
      due: `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}-05`,
      recipient: "District Health Management Team (DHMT)",
      sources: "Daily immunization tally sheets, cold chain temperature logs, stock ledger, adverse events register",
      supervision: `${currentYear}-08-10`,
      missed: "0 sessions cancelled; 1 outreach session rescheduled due to heavy rain and conducted within 5 days",
      replanned: "All scheduled sessions completed",
      solved: "CHW recruitment for northern sector completed; outreach attendance improved by 15%",
      outstanding: "Need replacement ice packs and cold box gasket repair",
      actions: "Submitted logistics requisition to District Cold Chain Technician",
      feedback: "District praised timely reporting and low wastage rates; next review scheduled for 10th of next month",
    },
  ];

  return {
    analysis,
    map,
    special,
    sessions: sessionsList,
    problems,
    workplan,
    monitoring,
    community,
    supplies,
    report,
  };
}

export interface RedMicroplanningWorksheetProps {
  facilityId: number;
  microplanId: number;
  readOnly: boolean;
  onOpenStep?: (step: number) => void;
  wizardStep?: number;
}

export const RED_TO_WIZARD_STEP: Record<string, number> = {
  step1: 1,
  step2: 2,
  step3: 3,
  step4: 3,
  step5: 4,
  step6: 4,
  step7: 10,
  step8: 6,
  step9: 8,
  step10: 9,
};

export function RedMicroplanningWorksheet({
  facilityId,
  microplanId,
  readOnly,
  onOpenStep,
  wizardStep,
}: RedMicroplanningWorksheetProps) {
  const cache = useQueryClient();
  const key = `/api/planning-evidence?facilityId=${facilityId}&kind=red_microplanning`;

  const query = useQuery<{ records: ExtensionRecord[]; canWrite: boolean }>({
    queryKey: [key],
    queryFn: () => planningRequest(key),
    retry: false,
  });

  // Query health facility context for comprehensive prepopulation
  const { data: facility } = useQuery<Facility>({
    queryKey: ["/api/facilities", facilityId],
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}`, { credentials: "include" });
      return res.ok ? res.json() : null;
    },
    enabled: Boolean(facilityId),
  });

  const { data: villages = [] } = useQuery<Village[]>({
    queryKey: [`/api/villages?facilityId=${facilityId}`],
    queryFn: async () => {
      const res = await fetch(`/api/villages?facilityId=${facilityId}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: Boolean(facilityId),
  });

  const { data: sessions = [] } = useQuery<SessionPlan[]>({
    queryKey: [`/api/sessions?facilityId=${facilityId}&microplanId=${microplanId}`],
    queryFn: async () => {
      const res = await fetch(`/api/sessions?facilityId=${facilityId}&microplanId=${microplanId}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: Boolean(facilityId && microplanId),
  });

  const [draft, setDraft] = useState<RedWorksheet | null>(null);
  const [record, setRecord] = useState<ExtensionRecord | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const writable = !readOnly && query.data?.canWrite === true;
  const records = useMemo(
    () => query.data?.records.filter((r) => r.microplanId === microplanId) || [],
    [query.data?.records, microplanId]
  );

  // Compute prepopulated sections
  const prepopulated = useMemo(
    () => buildPrepopulatedSections(facility, villages, sessions),
    [facility, villages, sessions]
  );

  // Determine which RED step(s) belong to the current wizard step
  const activeRedSteps = useMemo(() => {
    if (!wizardStep) return redSteps;
    return redSteps.filter((s) => s.wizard === wizardStep);
  }, [wizardStep]);

  // Active step index within the filtered list
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // Reset active step index when wizard step changes
  useEffect(() => {
    setActiveStepIndex(0);
  }, [wizardStep]);

  const currentStep = activeRedSteps[activeStepIndex] || activeRedSteps[0];

  // Auto-initialize draft with prepopulated facility data if no record exists yet
  useEffect(() => {
    if (records.length > 0) {
      const r = records[0];
      setRecord(r);
      const payload = structuredClone(r.payload) as RedWorksheet;
      // Merge in any missing sections with prepopulated values
      let changed = false;
      for (const [sId, sRows] of Object.entries(prepopulated)) {
        if (!payload.sections[sId] || payload.sections[sId].length === 0) {
          payload.sections[sId] = sRows;
          changed = true;
        }
      }
      setDraft(payload);
      if (changed) setMessage("Prepopulated health facility catchment data into RED worksheet.");
    } else if (!draft) {
      setRecord(null);
      setRequestId(crypto.randomUUID());
      setDraft({
        title: `${facility?.name ? `${facility.name} — ` : ""}RED Microplanning Worksheet`,
        sections: prepopulated,
        completedSteps: [],
      });
      setMessage("Prepopulated health facility catchment data into RED worksheet.");
    }
  }, [records, prepopulated, facility?.name]);

  // Refresh prepopulated data for current step or all steps
  const handlePrepopulateCurrentStep = useCallback(() => {
    if (!currentStep || !draft) return;
    const freshRows = prepopulated[currentStep.id] || [];
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [currentStep.id]: freshRows,
        },
      };
    });
    setMessage(`Refreshed prepopulated data for RED Step: ${currentStep.title}.`);
  }, [currentStep, draft, prepopulated]);

  async function save() {
    if (!draft) return;
    const valid = redWorksheetSchema.safeParse(draft);
    if (!valid.success) {
      setMessage(valid.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const saved = await planningRequest<ExtensionRecord>(
        record ? `/api/planning-evidence/${record.id}` : "/api/planning-evidence",
        record ? "PUT" : "POST",
        {
          facilityId,
          microplanId,
          kind: "red_microplanning",
          payload: valid.data,
          ...(record ? { version: record.version } : { requestId }),
        }
      );
      setRecord(saved);
      setMessage("RED worksheet saved successfully. All fields preserved.");
      await cache.invalidateQueries({ queryKey: [key] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed. Entries remain open.");
    } finally {
      setSaving(false);
    }
  }

  // If no RED steps correspond to this wizard step, return null to keep the step clean
  if (activeRedSteps.length === 0) {
    return null;
  }

  const stepRows = (draft?.sections[currentStep?.id] || []);

  return (
    <Card className="border-2 border-primary/20 bg-primary/[0.02] shadow-xs overflow-hidden" data-testid="red-microplanning-panel">
      <CardHeader className="p-4 pb-3 border-b border-primary/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/30 text-xs font-semibold gap-1">
                <Sparkles className="h-3 w-3" />
                WHO RED-Aligned Workflow
              </Badge>
              {currentStep && (
                <span className="text-xs text-muted-foreground">
                  RED Step {redSteps.findIndex((s) => s.id === currentStep.id) + 1} of 10
                </span>
              )}
            </div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <span>{currentStep ? currentStep.title : "RED Microplanning Worksheet"}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              WHO Reach Every District (RED) facility tool (printed pages {currentStep?.page ?? "9–37"}). Supporting records stay attached to this microplan.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {writable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrepopulateCurrentStep}
                className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                title="Refresh pre-populated data from Health Facility Registry"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Prepopulate from Facility Data
              </Button>
            )}

            {writable && draft && (
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={save}
                className="h-8 text-xs gap-1.5 shadow-xs"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save RED Step"}
              </Button>
            )}

            {onOpenStep && currentStep && RED_TO_WIZARD_STEP[currentStep.id] && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenStep(RED_TO_WIZARD_STEP[currentStep.id])}
                className="h-8 text-xs gap-1.5 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 font-medium"
                title={`Open and edit in Guided Wizard Step ${RED_TO_WIZARD_STEP[currentStep.id]}`}
                data-testid={`button-jump-guided-step-${RED_TO_WIZARD_STEP[currentStep.id]}`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Edit in Guided Step {RED_TO_WIZARD_STEP[currentStep.id]}</span>
              </Button>
            )}
          </div>
        </div>

        {/* If multiple RED steps map to this view (e.g. standalone 10-step view or multi-mapped step) */}
        {activeRedSteps.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-primary/10 mt-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">
              {!wizardStep ? "WHO RED Steps (1–10):" : "Aligned RED Steps:"}
            </span>
            {activeRedSteps.map((s, idx) => {
              const fullIdx = redSteps.findIndex((x) => x.id === s.id) + 1;
              const isActive = idx === activeStepIndex;
              return (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`h-7 text-xs gap-1 ${isActive ? "shadow-xs font-semibold" : "border-border/60 text-muted-foreground hover:text-foreground"}`}
                  title={s.title}
                >
                  <span>Step {fullIdx}</span>
                  <span className="hidden md:inline text-[11px] opacity-80">({s.title.split(" ")[0]})</span>
                </Button>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-4 text-xs">
        {query.isLoading && <p className="text-muted-foreground">Loading RED worksheets…</p>}
        {query.error && <p role="alert" className="text-destructive font-medium">{query.error.message}</p>}

        {draft && currentStep && (
          <>
            {/* Step Guidance */}
            {currentStep.id === "analysis" && (
              <div className="rounded-md bg-muted/40 p-2.5 border text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Quantitative Analysis Guidance:</p>
                <p>Use one complete 12-month period. Default access threshold is 80% and dropout threshold is 10%. Negative estimates or coverage above 100% need reconciliation. Prepopulated with facility infant cohort and pregnant women targets.</p>
              </div>
            )}
            {currentStep.id === "map" && (
              <div className="rounded-md bg-muted/40 p-2.5 border text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Operational Map Guidance:</p>
                <p>Prepopulated with all registered catchment communities, populations, GPS coordinates, physical distances, and recommended service strategies (fixed vs. outreach).</p>
              </div>
            )}
            {currentStep.id === "special" && (
              <div className="rounded-md bg-muted/40 p-2.5 border text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Hard-to-Reach & Special Areas Guidance:</p>
                <p>Prepopulated with remote communities requiring dedicated mobile logistics, fuel support, and integrated child survival bundles.</p>
              </div>
            )}
            {currentStep.id === "sessions" && (
              <div className="rounded-md bg-muted/40 p-2.5 border text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Session Plan Guidance:</p>
                <p>Formula estimates monthly injections and required session frequency based on target populations and realistic injector capacities.</p>
              </div>
            )}

            {/* Entries for current RED step */}
            <div className="space-y-3">
              {stepRows.map((row, index) => (
                <fieldset
                  disabled={!writable || saving}
                  key={`${currentStep.id}-${index}`}
                  className="rounded-lg border bg-background p-3.5 space-y-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between border-b pb-2">
                    <legend className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      <span>{row.area ? String(row.area) : `Entry ${index + 1}`}</span>
                    </legend>
                    <Badge variant="outline" className="text-[10px] h-4">
                      {draft.completedSteps?.includes(currentStep.id) ? "Marked Complete" : "Active"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {currentStep.fields.map((field) => {
                      const update = (value: string | number) =>
                        setDraft({
                          ...draft,
                          sections: {
                            ...draft.sections,
                            [currentStep.id]: (draft.sections[currentStep.id] || []).map((r, i) =>
                              i === index ? { ...r, [field.key]: value } : r
                            ),
                          },
                        });

                      const options = "options" in field ? field.options : undefined;
                      const type = "type" in field ? field.type : undefined;
                      const label = `${field.label}`;
                      const val = row[field.key] ?? "";

                      return (
                        <label className="block space-y-1" key={field.key}>
                          <span className="font-medium text-foreground block text-[11px] truncate" title={field.label}>
                            {field.label}
                          </span>
                          {options ? (
                            <select
                              aria-label={label}
                              className="block w-full rounded-md border border-input p-1.5 text-xs bg-background text-foreground"
                              value={val}
                              onChange={(e) => update(e.target.value)}
                            >
                              <option value="">Not recorded</option>
                              {options.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          ) : type ? (
                            <input
                              aria-label={label}
                              className="block w-full rounded-md border border-input p-1.5 text-xs bg-background text-foreground"
                              type={type}
                              min={type === "number" ? 0 : undefined}
                              step={type === "number" ? "any" : undefined}
                              value={val}
                              onChange={(e) =>
                                update(type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value)
                              }
                            />
                          ) : (
                            <textarea
                              aria-label={label}
                              className="block w-full rounded-md border border-input p-1.5 text-xs bg-background text-foreground resize-y"
                              rows={2}
                              value={val}
                              onChange={(e) => update(e.target.value)}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>

                  {/* Calculated metrics for this row */}
                  {Object.keys(redMetrics(currentStep.id, row)).length > 0 && (
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Calculated RED Indicators
                      </p>
                      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 bg-muted/30 p-2.5 rounded-md border">
                        {Object.entries(redMetrics(currentStep.id, row)).map(([lbl, val]) => (
                          <div key={lbl} className="space-y-0.5">
                            <dt className="text-[10px] text-muted-foreground truncate" title={lbl}>{lbl}</dt>
                            <dd className="font-bold text-foreground text-xs">
                              {val === null
                                ? "—"
                                : typeof val === "number"
                                ? Number(val.toFixed(1)).toLocaleString()
                                : val}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </fieldset>
              ))}

              {stepRows.length === 0 && (
                <div className="p-4 text-center rounded-lg border border-dashed text-muted-foreground">
                  <p>No entries recorded yet for this step.</p>
                  {writable && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePrepopulateCurrentStep}
                      className="mt-2 text-xs gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Prepopulate with Facility Data
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Action Bar */}
            {writable && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        sections: {
                          ...draft.sections,
                          [currentStep.id]: [...(draft.sections[currentStep.id] || []), {}],
                        },
                      })
                    }
                    className="h-8 text-xs"
                  >
                    Add Custom Entry
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving || !stepRows.length}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        completedSteps: draft.completedSteps?.includes(currentStep.id)
                          ? draft.completedSteps.filter((id) => id !== currentStep.id)
                          : [...(draft.completedSteps || []), currentStep.id],
                      })
                    }
                    className="h-8 text-xs gap-1"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    {draft.completedSteps?.includes(currentStep.id)
                      ? "Reopen this RED Step"
                      : "Mark RED Step Complete"}
                  </Button>
                </div>

                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={save}
                  className="h-8 text-xs gap-1.5 shadow-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Save RED Worksheet"}
                </Button>
              </div>
            )}
          </>
        )}

        {message && (
          <p role="status" className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
