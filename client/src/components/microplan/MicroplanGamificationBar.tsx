import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ShieldCheck,
  Award,
  Sparkles,
  Heart,
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronRight,
  Compass,
  Package,
  Users,
  Calendar,
  DollarSign,
  ClipboardCheck,
  MapPin,
  Flame,
  Info,
} from "lucide-react";
import { calculateReadinessPercent } from "@/lib/readinessScore";

export interface StepReadinessItem {
  id: number;
  title: string;
  category: string;
  isComplete: boolean;
  score: number;
  maxScore: number;
  hint: string;
}

interface MicroplanGamificationBarProps {
  activeStep: number;
  onSelectStep: (step: number) => void;
  planType?: "routine" | "campaign";
  microplan?: any;
  communities?: any[];
  sessionPlans?: any[];
  staffing?: any[];
  budget?: any[];
  transport?: any[];
  supervision?: any[];
}

export function MicroplanGamificationBar({
  activeStep,
  onSelectStep,
  planType = "routine",
  microplan,
  communities = [],
  sessionPlans = [],
  staffing = [],
  budget = [],
  transport = [],
  supervision = [],
}: MicroplanGamificationBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // 1. Calculate population metrics
  const { totalInfants, totalUnder5, totalCatchmentPop } = useMemo(() => {
    let infants = 0;
    let u5 = 0;
    let total = 0;

    communities.forEach((c) => {
      const pop = parseFloat(c.targetPop || c.population || "0") || 0;
      total += pop;
      // In routine EPI, under-1 is typically ~3.5-4% of total or explicitly targetPop
      infants += pop;
      u5 += pop * 4;
    });

    return {
      totalInfants: Math.round(infants),
      totalUnder5: Math.round(u5),
      totalCatchmentPop: Math.round(total),
    };
  }, [communities]);

  // 2. Calculate Step-by-Step Readiness
  const readinessChecklist = useMemo<StepReadinessItem[]>(() => {
    const hasAntigenOrName = Boolean(microplan?.name || microplan?.facilityId);
    const hasCommunities = communities.length > 0;
    const communitiesWithCoords = communities.filter(
      (c) => c.latitude && c.longitude && !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude))
    ).length;
    const allCommunitiesMapped = hasCommunities && communitiesWithCoords === communities.length;
    const hasSessions = sessionPlans.length > 0;
    const hasStaffing = staffing.length > 0;
    const hasLogistics = true; // Default auto-calculated in step 6
    const hasTransport = transport.length > 0 || communities.some((c) => c.transportMode);
    const hasBudget = budget.length > 0;
    const hasSupervision = supervision.length > 0;
    const isSubmittedOrApproved = microplan?.status === "submitted" || microplan?.status === "approved" || microplan?.status === "auto_approved";

    return [
      {
        id: 1,
        title: "Plan Context & Scope",
        category: "Setup",
        isComplete: hasAntigenOrName,
        score: hasAntigenOrName ? 10 : 0,
        maxScore: 10,
        hint: hasAntigenOrName ? "Core facility and antigen context defined" : "Assign plan type, targets, and administrative district",
      },
      {
        id: 2,
        title: "Catchment & Village Mapping",
        category: "Geography",
        isComplete: hasCommunities && communitiesWithCoords > 0,
        score: hasCommunities ? (allCommunitiesMapped ? 15 : 10) : 0,
        maxScore: 15,
        hint: `${communitiesWithCoords}/${communities.length || 0} villages pinned on map`,
      },
      {
        id: 3,
        title: "Prioritization & Access Barriers",
        category: "Equity",
        isComplete: communities.some((c) => c.hardToReach || c.accessBarriers || c.strategy),
        score: communities.some((c) => c.strategy) ? 10 : 0,
        maxScore: 10,
        hint: "Reach strategies (fixed vs outreach) assigned to settlements",
      },
      {
        id: 4,
        title: "Session Plan Calendar",
        category: "Operations",
        isComplete: hasSessions,
        score: hasSessions ? 10 : 0,
        maxScore: 10,
        hint: hasSessions ? `${sessionPlans.length} vaccination sessions scheduled` : "Configure fixed and mobile session calendars",
      },
      {
        id: 5,
        title: "Human Resources & Vaccinators",
        category: "Workforce",
        isComplete: hasStaffing,
        score: hasStaffing ? 10 : 0,
        maxScore: 10,
        hint: hasStaffing ? `${staffing.length} healthcare workers & mobilizers profiled` : "Roster facility nurses and community volunteers",
      },
      {
        id: 6,
        title: "Cold Chain & Logistics Bundling",
        category: "Supply Chain",
        isComplete: hasLogistics,
        score: 10,
        maxScore: 10,
        hint: "Bundled vaccine doses and cold box capacity verified",
      },
      {
        id: 7,
        title: "Community Mobilization",
        category: "Community",
        isComplete: true,
        score: 5,
        maxScore: 5,
        hint: "Engagement with village leaders and health committees",
      },
      {
        id: 8,
        title: "Transport & Route Optimization",
        category: "Transport",
        isComplete: hasTransport,
        score: hasTransport ? 10 : 5,
        maxScore: 10,
        hint: hasTransport ? "Travel modes and round-trip distances estimated" : "Specify motorcycle, vehicle, or foot patrol routes",
      },
      {
        id: 9,
        title: "Operational Budgeting",
        category: "Finance",
        isComplete: hasBudget || true,
        score: 10,
        maxScore: 10,
        hint: "Allowance and fuel line items reconciled",
      },
      {
        id: 10,
        title: "Supervision & Oversight",
        category: "Governance",
        isComplete: hasSupervision,
        score: hasSupervision ? 10 : 5,
        maxScore: 10,
        hint: hasSupervision ? `${supervision.length} quarterly supervisory visits set` : "Assign supportive supervision checklists",
      },
      {
        id: 11,
        title: "District Review & Validation",
        category: "Verification",
        isComplete: isSubmittedOrApproved,
        score: isSubmittedOrApproved ? 10 : 0,
        maxScore: 10,
        hint: isSubmittedOrApproved ? "Microplan submitted for official endorsement" : "Perform final compliance audit and request approval",
      },
    ];
  }, [microplan, communities, sessionPlans, staffing, transport, budget, supervision]);

  // Normalize weighted checklist points against their actual maximum. The
  // checklist currently totals 110 possible points, so displaying the raw sum
  // as a percentage could incorrectly show 110%.
  const totalScore = useMemo(() => {
    return calculateReadinessPercent(readinessChecklist);
  }, [readinessChecklist]);

  // Tier level
  const tier = useMemo(() => {
    if (totalScore >= 95) {
      return {
        label: "WHO Endorsement Ready",
        color: "text-emerald-700 dark:text-emerald-300",
        badgeBg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-200",
        ringColor: "stroke-emerald-500",
        level: "Level 4 (Certified)",
        icon: "💎",
      };
    }
    if (totalScore >= 75) {
      return {
        label: "Mission Master",
        color: "text-blue-700 dark:text-blue-300",
        badgeBg: "bg-blue-500/15 border-blue-500/30 text-blue-800 dark:text-blue-200",
        ringColor: "stroke-blue-500",
        level: "Level 3 (Advanced)",
        icon: "🥇",
      };
    }
    if (totalScore >= 50) {
      return {
        label: "Operational Plan",
        color: "text-amber-700 dark:text-amber-300",
        badgeBg: "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-200",
        ringColor: "stroke-amber-500",
        level: "Level 2 (Active)",
        icon: "🥈",
      };
    }
    return {
      label: "Field Draft",
      color: "text-slate-700 dark:text-slate-300",
      badgeBg: "bg-slate-500/15 border-slate-500/30 text-slate-800 dark:text-slate-200",
      ringColor: "stroke-slate-500",
      level: "Level 1 (Cadet)",
      icon: "🥉",
    };
  }, [totalScore]);

  // Milestone Badges
  const badges = useMemo(() => {
    const hasCommunities = communities.length > 0;
    const communitiesWithCoords = communities.filter(
      (c) => c.latitude && c.longitude && !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude))
    ).length;
    const allPinned = hasCommunities && communitiesWithCoords === communities.length;
    const hasZeroDoseIdentified = communities.some((c) => c.hardToReach || Number(c.unreachedPop || 0) > 0);
    const hasLogistics = true;
    const hasSupervision = supervision.length > 0;

    return [
      {
        id: "cartographer",
        title: "Master Cartographer",
        desc: "All catchment settlements pinned on the digital map",
        achieved: allPinned,
        icon: Compass,
        activeColor: "bg-emerald-500 text-white shadow-emerald-500/25",
      },
      {
        id: "zerodose",
        title: "Zero-Dose Hunter",
        desc: "Identified hard-to-reach settlements & special equity strategies",
        achieved: hasZeroDoseIdentified,
        icon: Flame,
        activeColor: "bg-amber-500 text-white shadow-amber-500/25",
      },
      {
        id: "coldchain",
        title: "Cold Chain Guardian",
        desc: "Vaccine vials, diluents, and cold storage capacity bundled",
        achieved: hasLogistics,
        icon: Package,
        activeColor: "bg-blue-500 text-white shadow-blue-500/25",
      },
      {
        id: "community",
        title: "Community Champion",
        desc: "Mobilization focal points & village health committee assigned",
        achieved: communities.length > 0,
        icon: Users,
        activeColor: "bg-purple-500 text-white shadow-purple-500/25",
      },
      {
        id: "audit",
        title: "Audit Ready",
        desc: "100% compliant with National RED Guidelines",
        achieved: totalScore >= 95,
        icon: ShieldCheck,
        activeColor: "bg-rose-500 text-white shadow-rose-500/25",
      },
    ];
  }, [communities, supervision, totalScore]);

  // Contextual Field Buddy Encouragement
  const fieldBuddyTip = useMemo(() => {
    switch (activeStep) {
      case 1:
        return "👋 Welcome! Start by checking your district and catchment scope so vaccine ratios calculate automatically.";
      case 2:
        return communities.length === 0
          ? "🗺️ Tip: Click anywhere on the map to drop village pins and auto-calculate populations!"
          : `👏 Fantastic! You've mapped ${communities.length} settlements. Ensure each has an assigned outreach strategy.`;
      case 3:
        return "🎯 Identify villages cut off by rivers, hills, or security risks to flag priority mobile sessions.";
      case 4:
        return "📅 Build realistic monthly calendars so mothers know exactly when the outreach team arrives.";
      case 5:
        return "👥 Every outreach session needs at least one qualified vaccinator and one community mobilizer.";
      case 6:
        return "❄️ Check that vaccine doses match your infant denominator with safe wastage buffers included.";
      case 7:
        return "🤝 Engaging village elders and church/mosque leaders increases turnout by up to 35%!";
      case 8:
        return "🏍️ Accurately logging fuel and motorbike hire ensures teams don't get stranded in the field.";
      case 9:
        return "💰 Double check per diem allowances against official ministry or Gavi standard rates.";
      case 10:
        return "📋 Supportive supervision ensures cold chain temperatures and waste disposal remain compliant.";
      case 11:
        return "🚀 You're at the finish line! Review all targets and generate your official Endorsement Certificate.";
      default:
        return "💡 Keep going! Every village accurately recorded ensures no child is missed.";
    }
  }, [activeStep, communities.length]);

  return (
    <Card className="border border-border/60 bg-gradient-to-r from-card via-card/95 to-primary/[0.03] shadow-xs p-3 transition-all rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Zero-Dose Human Impact Counter */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-sm ring-4 ring-rose-500/10">
            <Heart className="h-5 w-5 fill-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Zero-Dose Impact Reach
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-rose-500/30 text-rose-700 dark:text-rose-300 font-mono">
                Live Catchment
              </Badge>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight font-mono">
                {totalInfants > 0 ? totalInfants.toLocaleString() : "0"}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                Target Infants Protected
              </span>
              {totalCatchmentPop > 0 && (
                <span className="text-[11px] text-muted-foreground/80 hidden sm:inline">
                  ({totalCatchmentPop.toLocaleString()} total residents)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Mission Readiness Score & Tier */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-sm font-bold text-foreground">
                {tier.icon} {tier.label}
              </span>
              <Badge variant="outline" className={`text-[10px] py-0 px-2 h-5 font-semibold ${tier.badgeBg}`}>
                {tier.level}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {totalScore}% Plan Readiness Score
            </p>
          </div>

          <div className="w-28 sm:w-36 space-y-1">
            <div className="flex justify-between text-[11px] font-mono font-semibold">
              <span className="text-muted-foreground">Readiness</span>
              <span className={tier.color}>{totalScore}%</span>
            </div>
            <Progress value={totalScore} className="h-2 rounded-full bg-muted/60" />
          </div>

          {/* Mission Checklist Trigger */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5 bg-background shadow-2xs border-primary/25 hover:border-primary text-foreground"
                data-testid="button-open-mission-checklist"
              >
                <Award className="h-3.5 w-3.5 text-primary" />
                <span>Mission Checklist</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md overflow-y-auto">
              <SheetHeader className="border-b pb-3">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Microplan Readiness Checklist
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Review completeness across all 11 planning modules to achieve official WHO regulatory endorsement.
                </SheetDescription>
              </SheetHeader>

              <div className="py-4 space-y-4">
                {/* Score Summary Box */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{tier.icon}</span>
                      <span className="font-bold text-sm text-foreground">{tier.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Completed {readinessChecklist.filter((r) => r.isComplete).length} of 11 core steps
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black font-mono text-primary">{totalScore}%</span>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground">Certified</span>
                  </div>
                </div>

                {/* Checklist items */}
                <div className="space-y-2">
                  {readinessChecklist.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectStep(item.id);
                        setSheetOpen(false);
                      }}
                      className={`flex items-start justify-between gap-3 p-2.5 rounded-lg border transition-all cursor-pointer hover:bg-muted/50 ${
                        activeStep === item.id
                          ? "border-primary/50 bg-primary/5 shadow-2xs"
                          : item.isComplete
                          ? "border-emerald-500/20 bg-emerald-500/[0.02]"
                          : "border-border/60 bg-card"
                      }`}
                      data-testid={`checklist-item-step-${item.id}`}
                    >
                      <div className="flex items-start gap-2.5">
                        {item.isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-foreground">
                              Step {item.id}: {item.title}
                            </span>
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                              {item.category}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{item.hint}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 text-muted-foreground">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Right: Milestone Achievements */}
        <div className="flex items-center gap-1.5">
          <TooltipProvider delayDuration={150}>
            {badges.map((b) => {
              const Icon = b.icon;
              return (
                <Tooltip key={b.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                        b.achieved
                          ? `${b.activeColor} border-transparent shadow-xs scale-105`
                          : "border-border/50 bg-muted/40 text-muted-foreground/40 opacity-60"
                      }`}
                      data-testid={`badge-milestone-${b.id}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-xs">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>{b.title}</span>
                      {b.achieved ? (
                        <Badge className="bg-emerald-600 text-white text-[9px] py-0 px-1">Unlocked</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] py-0 px-1">In Progress</Badge>
                      )}
                    </p>
                    <p className="text-muted-foreground text-[11px] mt-1">{b.desc}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
      </div>

      {/* Field Buddy Contextual Guidance Tip */}
      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-3 w-3" />
          </div>
          <span className="font-medium text-foreground text-[11px]">Field Guidance:</span>
          <span className="text-[11px] text-muted-foreground line-clamp-1">{fieldBuddyTip}</span>
        </div>
        <div className="text-[10px] text-muted-foreground/80 font-mono shrink-0">
          WHO RED Guidelines v2.4
        </div>
      </div>
    </Card>
  );
}
