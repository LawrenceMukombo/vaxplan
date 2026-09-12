import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  budgetItems,
  districts,
  facilities,
  microplans,
  provinces,
  sessionPlans,
  vaccineRequirements,
} from "@shared/schema";

export interface MicroplanAggregateFilters {
  planType?: "routine" | "campaign" | "all";
  year?: number;
  quarter?: number;
  provinceId?: number;
  districtId?: number;
  allowedProvinceIds?: Set<number>;
  allowedDistrictIds?: Set<number>;
  allowedFacilityIds?: Set<number>;
  allScope?: boolean;
}

export interface VaccineAntigenSummary {
  vaccineName: string;
  dosesRequired: number;
  dosesWithWastage: number;
  vialsRequired: number;
  targetPopulation: number;
}

export interface BudgetCategorySummary {
  category: string;
  totalCost: number;
  count: number;
}

export interface BudgetFundingSummary {
  fundingSource: string;
  totalCost: number;
  count: number;
}

export interface StaffRoleSummary {
  role: string;
  headcount: number;
  days: number;
  totalCost: number;
}

export interface MicroplanSummaryMetrics {
  totalPlans: number;
  totalFacilities: number;
  facilitiesWithPlan: number;
  facilityCoveragePct: number;
  statusCounts: {
    draft: number;
    pending: number;
    approved: number;
    locked: number;
    rejected: number;
  };
  totalTargetPopulation: number;
  totalBudget: number;
  sessions: {
    total: number;
    completed: number;
    static: number;
    outreach: number;
    mobile: number;
  };
  vaccines: {
    totalDosesRequired: number;
    totalDosesWithWastage: number;
    totalVialsRequired: number;
    byAntigen: VaccineAntigenSummary[];
  };
  budgetBreakdown: {
    byCategory: BudgetCategorySummary[];
    byFundingSource: BudgetFundingSummary[];
  };
  staffingSummary: {
    totalHeadcount: number;
    totalPersonDays: number;
    roles: StaffRoleSummary[];
  };
}

export interface ProvinceRollupRow {
  provinceId: number;
  provinceName: string;
  provinceCode: string;
  totalDistricts: number;
  totalFacilities: number;
  facilitiesWithPlan: number;
  coveragePct: number;
  totalPlans: number;
  approvedPlans: number;
  pendingPlans: number;
  draftPlans: number;
  totalTargetPopulation: number;
  totalBudget: number;
  totalSessions: number;
  totalDoses: number;
}

export interface DistrictRollupRow {
  districtId: number;
  districtName: string;
  districtCode: string;
  provinceId: number;
  provinceName: string;
  totalFacilities: number;
  facilitiesWithPlan: number;
  coveragePct: number;
  totalPlans: number;
  approvedPlans: number;
  pendingPlans: number;
  draftPlans: number;
  totalTargetPopulation: number;
  totalBudget: number;
  totalSessions: number;
  totalDoses: number;
}

export interface FacilityMicroplanRow {
  facilityId: number;
  facilityName: string;
  facilityHmisCode: string;
  facilityType: string;
  districtId: number;
  districtName: string;
  provinceName: string;
  hasPlan: boolean;
  microplanId: number | null;
  microplanName: string | null;
  planType: string | null;
  year: number | null;
  quarter: number | null;
  status: string | null;
  targetPopulation: number;
  budget: number;
  plannedSessions: number;
  completedSessions: number;
  totalDosesRequired: number;
  totalVialsRequired: number;
  submittedAt: string | null;
  updatedAt: string | null;
}

export interface MicroplanAggregateResponse {
  level: "national" | "province" | "district";
  scope: {
    provinceId?: number;
    provinceName?: string;
    districtId?: number;
    districtName?: string;
  };
  summary: MicroplanSummaryMetrics;
  provinces?: ProvinceRollupRow[];
  districts?: DistrictRollupRow[];
  facilities?: FacilityMicroplanRow[];
}

export async function getMicroplanAggregations(
  db: NodePgDatabase<any>,
  tenantId: string,
  filters: MicroplanAggregateFilters = {}
): Promise<MicroplanAggregateResponse> {
  const {
    planType = "all",
    year,
    quarter,
    provinceId: filterProvinceId,
    districtId: filterDistrictId,
    allowedProvinceIds,
    allowedDistrictIds,
    allowedFacilityIds,
    allScope = true,
  } = filters;

  // 1. Fetch geographic structures for tenant
  const allProvinces = await db
    .select({
      id: provinces.id,
      name: provinces.name,
      code: provinces.code,
    })
    .from(provinces)
    .where(eq(provinces.tenantId, tenantId));

  const allDistricts = await db
    .select({
      id: districts.id,
      name: districts.name,
      code: districts.code,
      provinceId: districts.provinceId,
    })
    .from(districts)
    .where(eq(districts.tenantId, tenantId));

  const allFacilities = await db
    .select({
      id: facilities.id,
      name: facilities.name,
      hmisCode: facilities.hmisCode,
      facilityType: facilities.facilityType,
      districtId: facilities.districtId,
      isActive: facilities.isActive,
    })
    .from(facilities)
    .where(and(eq(facilities.tenantId, tenantId), eq(facilities.isActive, true)));

  // Build lookup maps
  const provinceMap = new Map<number, { id: number; name: string; code: string }>();
  allProvinces.forEach((p: any) => provinceMap.set(p.id, p));

  const districtMap = new Map<number, { id: number; name: string; code: string; provinceId: number }>();
  allDistricts.forEach((d: any) => districtMap.set(d.id, d));

  // Determine allowed geography based on role scoping
  let filteredProvinces = allProvinces;
  if (!allScope && allowedProvinceIds && allowedProvinceIds.size > 0) {
    filteredProvinces = filteredProvinces.filter((p: any) => allowedProvinceIds.has(p.id));
  }
  if (filterProvinceId) {
    filteredProvinces = filteredProvinces.filter((p: any) => p.id === filterProvinceId);
  }

  const validProvinceIds = new Set(filteredProvinces.map((p: any) => p.id));

  let filteredDistricts = allDistricts.filter((d: any) => validProvinceIds.has(d.provinceId));
  if (!allScope && allowedDistrictIds && allowedDistrictIds.size > 0) {
    filteredDistricts = filteredDistricts.filter((d: any) => allowedDistrictIds.has(d.id));
  }
  if (filterDistrictId) {
    filteredDistricts = filteredDistricts.filter((d: any) => d.id === filterDistrictId);
  }

  const validDistrictIds = new Set(filteredDistricts.map((d: any) => d.id));

  let inScopeFacilities = allFacilities.filter((f: any) => validDistrictIds.has(f.districtId));
  if (!allScope && allowedFacilityIds && allowedFacilityIds.size > 0) {
    inScopeFacilities = inScopeFacilities.filter((f: any) => allowedFacilityIds.has(f.id));
  }

  const facilityMap = new Map<number, typeof inScopeFacilities[0]>();
  inScopeFacilities.forEach((f) => facilityMap.set(f.id, f));
  const inScopeFacilityIds = Array.from(facilityMap.keys());

  // Determine current active level and scope labels
  let level: "national" | "province" | "district" = "national";
  let activeProvinceName: string | undefined;
  let activeDistrictName: string | undefined;

  if (filterDistrictId || (!allScope && allowedDistrictIds?.size === 1)) {
    level = "district";
    const dId = filterDistrictId ?? Array.from(allowedDistrictIds!)[0];
    const d = districtMap.get(dId);
    if (d) {
      activeDistrictName = d.name;
      activeProvinceName = provinceMap.get(d.provinceId)?.name;
    }
  } else if (filterProvinceId || (!allScope && allowedProvinceIds?.size === 1)) {
    level = "province";
    const pId = filterProvinceId ?? Array.from(allowedProvinceIds!)[0];
    activeProvinceName = provinceMap.get(pId)?.name;
  }

  // 2. Fetch microplans for in-scope facilities
  const rawPlans = inScopeFacilityIds.length > 0
    ? await db
        .select({
          id: microplans.id,
          facilityId: microplans.facilityId,
          name: microplans.name,
          planType: microplans.planType,
          year: microplans.year,
          quarter: microplans.quarter,
          status: microplans.status,
          targetPopulation: microplans.targetPopulation,
          budget: microplans.budget,
          staffing: microplans.staffing,
          submittedAt: microplans.submittedAt,
          updatedAt: microplans.updatedAt,
        })
        .from(microplans)
        .where(
          and(
            eq(microplans.tenantId, tenantId),
            inArray(microplans.facilityId, inScopeFacilityIds)
          )
        )
    : [];

  // Filter plans by planType, year, quarter
  const filteredPlans = rawPlans.filter((p: any) => {
    if (year && p.year !== year) return false;
    if (quarter && p.quarter !== quarter) return false;
    const pt = String(p.planType ?? "");
    if (planType === "routine" && (pt === "sia_campaign" || pt.includes("campaign"))) return false;
    if (planType === "campaign" && !(pt === "sia_campaign" || pt.includes("campaign"))) return false;
    return true;
  });

  const planIds = filteredPlans.map((p: any) => p.id);
  const planByFacilityId = new Map<number, typeof filteredPlans[0]>();
  filteredPlans.forEach((p: any) => {
    if (p.facilityId) {
      // If multiple plans for a facility in a range, keep latest or approved
      const existing = planByFacilityId.get(p.facilityId);
      if (!existing || (p.status === "approved" && existing.status !== "approved")) {
        planByFacilityId.set(p.facilityId, p);
      }
    }
  });

  // 3. Fetch session plans for in-scope microplans
  const rawSessions = planIds.length > 0
    ? await db
        .select({
          id: sessionPlans.id,
          microplanId: sessionPlans.microplanId,
          facilityId: sessionPlans.facilityId,
          sessionType: sessionPlans.sessionType,
          status: sessionPlans.status,
          approvalStatus: sessionPlans.approvalStatus,
          isAchieved: sessionPlans.isAchieved,
          completedAt: sessionPlans.completedAt,
        })
        .from(sessionPlans)
        .where(
          and(
            eq(sessionPlans.tenantId, tenantId),
            inArray(sessionPlans.microplanId, planIds)
          )
        )
    : [];

  // Sessions map by microplanId & facilityId
  const sessionsByPlanId = new Map<number, { planned: number; completed: number; static: number; outreach: number; mobile: number }>();
  let totalSessions = 0;
  let completedSessions = 0;
  let staticSessions = 0;
  let outreachSessions = 0;
  let mobileSessions = 0;

  rawSessions.forEach((s: any) => {
    totalSessions++;
    const isDone = Boolean(
      s.completedAt ||
      s.isAchieved ||
      ["completed", "conducted", "done"].includes(String(s.status ?? "").toLowerCase())
    );
    if (isDone) completedSessions++;

    const st = String(s.sessionType ?? "").toLowerCase();
    if (st === "static") staticSessions++;
    else if (st === "outreach") outreachSessions++;
    else if (st === "mobile") mobileSessions++;

    const current = sessionsByPlanId.get(s.microplanId) || { planned: 0, completed: 0, static: 0, outreach: 0, mobile: 0 };
    current.planned++;
    if (isDone) current.completed++;
    if (st === "static") current.static++;
    else if (st === "outreach") current.outreach++;
    else if (st === "mobile") current.mobile++;
    sessionsByPlanId.set(s.microplanId, current);
  });

  // 4. Fetch Vaccine Requirements for in-scope facilities
  const rawVaccines = inScopeFacilityIds.length > 0
    ? await db
        .select({
          id: vaccineRequirements.id,
          facilityId: vaccineRequirements.facilityId,
          vaccineName: vaccineRequirements.vaccineName,
          targetPopulation: vaccineRequirements.targetPopulation,
          dosesRequired: vaccineRequirements.dosesRequired,
          dosesWithWastage: vaccineRequirements.dosesWithWastage,
          vialsRequired: vaccineRequirements.vialsRequired,
          quarter: vaccineRequirements.quarter,
          year: vaccineRequirements.year,
        })
        .from(vaccineRequirements)
        .where(
          and(
            eq(vaccineRequirements.tenantId, tenantId),
            inArray(vaccineRequirements.facilityId, inScopeFacilityIds)
          )
        )
    : [];

  const filteredVaccines = rawVaccines.filter((v: any) => {
    if (year && v.year !== year) return false;
    if (quarter && v.quarter !== quarter) return false;
    return true;
  });

  const vaccinesByAntigenMap = new Map<string, VaccineAntigenSummary>();
  const vaccinesByFacilityMap = new Map<number, { doses: number; vials: number }>();
  let totalDosesRequired = 0;
  let totalDosesWithWastage = 0;
  let totalVialsRequired = 0;

  filteredVaccines.forEach((v: any) => {
    const doses = Number(v.dosesRequired) || 0;
    const dosesWastage = Number(v.dosesWithWastage) || 0;
    const vials = Number(v.vialsRequired) || 0;
    const pop = Number(v.targetPopulation) || 0;

    totalDosesRequired += doses;
    totalDosesWithWastage += dosesWastage;
    totalVialsRequired += vials;

    const antigenKey = v.vaccineName?.trim() || "Unspecified";
    const existing = vaccinesByAntigenMap.get(antigenKey) || {
      vaccineName: antigenKey,
      dosesRequired: 0,
      dosesWithWastage: 0,
      vialsRequired: 0,
      targetPopulation: 0,
    };
    existing.dosesRequired += doses;
    existing.dosesWithWastage += dosesWastage;
    existing.vialsRequired += vials;
    existing.targetPopulation += pop;
    vaccinesByAntigenMap.set(antigenKey, existing);

    const facVac = vaccinesByFacilityMap.get(v.facilityId) || { doses: 0, vials: 0 };
    facVac.doses += doses;
    facVac.vials += vials;
    vaccinesByFacilityMap.set(v.facilityId, facVac);
  });

  // 5. Fetch Budget Items for in-scope facilities
  const rawBudget = inScopeFacilityIds.length > 0
    ? await db
        .select({
          id: budgetItems.id,
          facilityId: budgetItems.facilityId,
          category: budgetItems.category,
          unitCost: budgetItems.unitCost,
          quantity: budgetItems.quantity,
          totalCost: budgetItems.totalCost,
          fundingSource: budgetItems.fundingSource,
          quarter: budgetItems.quarter,
          year: budgetItems.year,
        })
        .from(budgetItems)
        .where(
          and(
            eq(budgetItems.tenantId, tenantId),
            inArray(budgetItems.facilityId, inScopeFacilityIds)
          )
        )
    : [];

  const filteredBudget = rawBudget.filter((b: any) => {
    if (year && b.year !== year) return false;
    if (quarter && b.quarter !== quarter) return false;
    return true;
  });

  const budgetByCategoryMap = new Map<string, BudgetCategorySummary>();
  const budgetByFundingMap = new Map<string, BudgetFundingSummary>();
  let totalBudgetCents = 0;

  filteredBudget.forEach((b: any) => {
    const cost = Number(b.totalCost) || 0;
    totalBudgetCents += cost;

    const cat = b.category?.trim() || "Operational";
    const cEntry = budgetByCategoryMap.get(cat) || { category: cat, totalCost: 0, count: 0 };
    cEntry.totalCost += cost;
    cEntry.count += 1;
    budgetByCategoryMap.set(cat, cEntry);

    const fund = b.fundingSource?.trim() || "unspecified";
    const fEntry = budgetByFundingMap.get(fund) || { fundingSource: fund, totalCost: 0, count: 0 };
    fEntry.totalCost += cost;
    fEntry.count += 1;
    budgetByFundingMap.set(fund, fEntry);
  });

  // If budget items total is zero but microplans have budget, fall back to microplan.budget sums
  let totalBudget = totalBudgetCents;
  if (totalBudget === 0) {
    filteredPlans.forEach((p: any) => {
      totalBudget += Number(p.budget) || 0;
    });
  }

  // 6. Aggregate staffing data from microplans
  const staffingByRoleMap = new Map<string, StaffRoleSummary>();
  let totalHeadcount = 0;
  let totalPersonDays = 0;

  filteredPlans.forEach((p: any) => {
    if (Array.isArray(p.staffing)) {
      p.staffing.forEach((st: any) => {
        const role = String(st.role || "Staff").trim();
        const hc = Number(st.headcount ?? st.count) || 0;
        const days = Number(st.days) || 0;
        const perDiem = Number(st.perDiem ?? st.dailyRate) || 0;
        totalHeadcount += hc;
        totalPersonDays += (hc * days);

        const rEntry = staffingByRoleMap.get(role) || { role, headcount: 0, days: 0, totalCost: 0 };
        rEntry.headcount += hc;
        rEntry.days += days;
        rEntry.totalCost += (hc * days * perDiem);
        staffingByRoleMap.set(role, rEntry);
      });
    }
  });

  // 7. Calculate plan status counts and total target population
  const statusCounts = {
    draft: 0,
    pending: 0,
    approved: 0,
    locked: 0,
    rejected: 0,
  };
  let totalTargetPopulation = 0;

  filteredPlans.forEach((p: any) => {
    totalTargetPopulation += Number(p.targetPopulation) || 0;
    const s = String(p.status ?? "draft").toLowerCase();
    if (s === "approved" || s === "auto_approved") statusCounts.approved++;
    else if (s === "pending" || s === "submitted" || s === "under_review") statusCounts.pending++;
    else if (s === "locked") statusCounts.locked++;
    else if (s === "rejected" || s === "returned") statusCounts.rejected++;
    else statusCounts.draft++;
  });

  const totalFacilities = inScopeFacilities.length;
  const facilitiesWithPlan = planByFacilityId.size;
  const facilityCoveragePct = totalFacilities > 0 ? Math.round((facilitiesWithPlan / totalFacilities) * 100) : 0;

  // 8. Build Province Rollup Rows (for National Level)
  let provinceRollupRows: ProvinceRollupRow[] | undefined;
  if (level === "national") {
    provinceRollupRows = filteredProvinces.map((prov: any) => {
      const distsInProv = filteredDistricts.filter((d: any) => d.provinceId === prov.id);
      const distIdsInProv = new Set(distsInProv.map((d: any) => d.id));
      const facsInProv = inScopeFacilities.filter((f: any) => distIdsInProv.has(f.districtId));
      const facIdsInProv = new Set(facsInProv.map((f: any) => f.id));

      const plansInProv = filteredPlans.filter((p: any) => p.facilityId && facIdsInProv.has(p.facilityId));
      const plansWithFacInProv = new Set(plansInProv.map((p: any) => p.facilityId)).size;

      let pTargetPop = 0;
      let pBudget = 0;
      let pApproved = 0;
      let pPending = 0;
      let pDraft = 0;
      let pSessions = 0;
      let pDoses = 0;

      plansInProv.forEach((p: any) => {
        pTargetPop += Number(p.targetPopulation) || 0;
        pBudget += Number(p.budget) || 0;
        const s = String(p.status ?? "draft").toLowerCase();
        if (s === "approved" || s === "auto_approved") pApproved++;
        else if (s === "pending" || s === "submitted" || s === "under_review") pPending++;
        else pDraft++;

        const ses = sessionsByPlanId.get(p.id);
        if (ses) pSessions += ses.planned;
      });

      facsInProv.forEach((f: any) => {
        const v = vaccinesByFacilityMap.get(f.id);
        if (v) pDoses += v.doses;
      });

      return {
        provinceId: prov.id,
        provinceName: prov.name,
        provinceCode: prov.code,
        totalDistricts: distsInProv.length,
        totalFacilities: facsInProv.length,
        facilitiesWithPlan: plansWithFacInProv,
        coveragePct: facsInProv.length > 0 ? Math.round((plansWithFacInProv / facsInProv.length) * 100) : 0,
        totalPlans: plansInProv.length,
        approvedPlans: pApproved,
        pendingPlans: pPending,
        draftPlans: pDraft,
        totalTargetPopulation: pTargetPop,
        totalBudget: pBudget,
        totalSessions: pSessions,
        totalDoses: pDoses,
      };
    });
  }

  // 9. Build District Rollup Rows (for National and Provincial levels)
  let districtRollupRows: DistrictRollupRow[] | undefined;
  if (level === "national" || level === "province") {
    districtRollupRows = filteredDistricts.map((dist: any) => {
      const facsInDist = inScopeFacilities.filter((f: any) => f.districtId === dist.id);
      const facIdsInDist = new Set(facsInDist.map((f: any) => f.id));
      const plansInDist = filteredPlans.filter((p: any) => p.facilityId && facIdsInDist.has(p.facilityId));
      const plansWithFacInDist = new Set(plansInDist.map((p: any) => p.facilityId)).size;

      let dTargetPop = 0;
      let dBudget = 0;
      let dApproved = 0;
      let dPending = 0;
      let dDraft = 0;
      let dSessions = 0;
      let dDoses = 0;

      plansInDist.forEach((p: any) => {
        dTargetPop += Number(p.targetPopulation) || 0;
        dBudget += Number(p.budget) || 0;
        const s = String(p.status ?? "draft").toLowerCase();
        if (s === "approved" || s === "auto_approved") dApproved++;
        else if (s === "pending" || s === "submitted" || s === "under_review") dPending++;
        else dDraft++;

        const ses = sessionsByPlanId.get(p.id);
        if (ses) dSessions += ses.planned;
      });

      facsInDist.forEach((f: any) => {
        const v = vaccinesByFacilityMap.get(f.id);
        if (v) dDoses += v.doses;
      });

      return {
        districtId: dist.id,
        districtName: dist.name,
        districtCode: dist.code,
        provinceId: dist.provinceId,
        provinceName: provinceMap.get(dist.provinceId)?.name || "Unknown",
        totalFacilities: facsInDist.length,
        facilitiesWithPlan: plansWithFacInDist,
        coveragePct: facsInDist.length > 0 ? Math.round((plansWithFacInDist / facsInDist.length) * 100) : 0,
        totalPlans: plansInDist.length,
        approvedPlans: dApproved,
        pendingPlans: dPending,
        draftPlans: dDraft,
        totalTargetPopulation: dTargetPop,
        totalBudget: dBudget,
        totalSessions: dSessions,
        totalDoses: dDoses,
      };
    });
  }

  // 10. Build Facility Microplan Rows (always included or filtered when drilling down)
  const facilityRows: FacilityMicroplanRow[] = inScopeFacilities.map((fac: any) => {
    const dist = districtMap.get(fac.districtId);
    const prov = dist ? provinceMap.get(dist.provinceId) : undefined;
    const plan = planByFacilityId.get(fac.id);
    const ses = plan ? sessionsByPlanId.get(plan.id) : undefined;
    const vac = vaccinesByFacilityMap.get(fac.id);

    return {
      facilityId: fac.id,
      facilityName: fac.name,
      facilityHmisCode: fac.hmisCode,
      facilityType: fac.facilityType || "Health Center",
      districtId: fac.districtId,
      districtName: dist?.name || "Unknown",
      provinceName: prov?.name || "Unknown",
      hasPlan: Boolean(plan),
      microplanId: plan ? plan.id : null,
      microplanName: plan ? plan.name : null,
      planType: plan ? plan.planType : null,
      year: plan ? plan.year : null,
      quarter: plan ? plan.quarter : null,
      status: plan ? plan.status : null,
      targetPopulation: plan ? (Number(plan.targetPopulation) || 0) : 0,
      budget: plan ? (Number(plan.budget) || 0) : 0,
      plannedSessions: ses ? ses.planned : 0,
      completedSessions: ses ? ses.completed : 0,
      totalDosesRequired: vac ? vac.doses : 0,
      totalVialsRequired: vac ? vac.vials : 0,
      submittedAt: plan?.submittedAt ? new Date(plan.submittedAt).toISOString() : null,
      updatedAt: plan?.updatedAt ? new Date(plan.updatedAt).toISOString() : null,
    };
  });

  return {
    level,
    scope: {
      provinceId: filterProvinceId,
      provinceName: activeProvinceName,
      districtId: filterDistrictId,
      districtName: activeDistrictName,
    },
    summary: {
      totalPlans: filteredPlans.length,
      totalFacilities,
      facilitiesWithPlan,
      facilityCoveragePct,
      statusCounts,
      totalTargetPopulation,
      totalBudget,
      sessions: {
        total: totalSessions,
        completed: completedSessions,
        static: staticSessions,
        outreach: outreachSessions,
        mobile: mobileSessions,
      },
      vaccines: {
        totalDosesRequired,
        totalDosesWithWastage,
        totalVialsRequired,
        byAntigen: Array.from(vaccinesByAntigenMap.values()),
      },
      budgetBreakdown: {
        byCategory: Array.from(budgetByCategoryMap.values()),
        byFundingSource: Array.from(budgetByFundingMap.values()),
      },
      staffingSummary: {
        totalHeadcount,
        totalPersonDays,
        roles: Array.from(staffingByRoleMap.values()),
      },
    },
    provinces: provinceRollupRows,
    districts: districtRollupRows,
    facilities: facilityRows,
  };
}
