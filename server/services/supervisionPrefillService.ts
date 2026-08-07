import { db } from "../db";
import {
  facilities,
  districts,
  provinces,
  tenants,
  users,
  facilityStaff,
  populationData,
  sessionPlans,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface SupervisionPrefillBundle {
  facility: {
    facilityId: number;
    facilityName: string;
    hmisCode: string;
    facilityType: string;
    latitude: number | null;
    longitude: number | null;
    districtId: number | null;
    districtName: string;
    provinceId: number | null;
    provinceName: string;
    countryId: string;
    countryName: string;
    contactPerson?: string | null;
    contactPhone?: string | null;
  };
  visit: {
    currentVisitDate: string;
    previousVisitDate: string | null;
    previousVisitId: number | null;
  };
  contacts: {
    person1?: { name: string; responsibility: string; source: string };
    person2?: { name: string; responsibility: string; source: string };
    person3?: { name: string; responsibility: string; source: string };
  };
  population: {
    totalCatchmentPopulation: number;
    survivingInfants: number;
    liveBirths: number;
    pregnantWomen: number;
    source: string;
    sourceYear: string;
    versionId: string | null;
    confidence: string;
    lastUpdated: string;
  };
  epiSites: {
    static: number;
    outreach: number;
    mobile: number;
    source: string;
  };
  metadata: {
    prefilledAt: string;
    asOfDate: string;
    warnings: string[];
  };
}

export async function getSupervisionPrefillBundle(
  tenantId: string,
  facilityId: number,
  checklistTemplateId?: number,
  visitDateStr?: string,
): Promise<SupervisionPrefillBundle> {
  const visitDate = visitDateStr ? new Date(visitDateStr) : new Date();
  const formattedVisitDate = visitDate.toISOString().split("T")[0];
  const warnings: string[] = [];

  // 1. Fetch Facility Details
  const facilityRows = await db
    .select({
      facility: facilities,
      district: districts,
      province: provinces,
      tenant: tenants,
    })
    .from(facilities)
    .leftJoin(districts, eq(facilities.districtId, districts.id))
    .leftJoin(provinces, eq(districts.provinceId, provinces.id))
    .leftJoin(tenants, eq(facilities.tenantId, tenants.id))
    .where(and(eq(facilities.id, facilityId), eq(facilities.tenantId, tenantId)))
    .limit(1);

  if (!facilityRows || facilityRows.length === 0) {
    throw new Error(`Health facility #${facilityId} not found in tenant ${tenantId}`);
  }

  const { facility, district, province, tenant } = facilityRows[0];

  // 2. Fetch Previous Supervision Visit
  let previousVisitDate: string | null = null;
  let previousVisitId: number | null = null;

  try {
    const prevVisits = await db.execute(sql`
      SELECT id, visit_date as "visitDate"
      FROM supervision_visits
      WHERE tenant_id = ${tenantId}
        AND facility_id = ${facilityId}
        AND status = 'completed'
      ORDER BY visit_date DESC
      LIMIT 1
    `);

    if (prevVisits && (prevVisits as any).rows && (prevVisits as any).rows.length > 0) {
      const pv = (prevVisits as any).rows[0];
      previousVisitDate = pv.visitDate ? new Date(pv.visitDate).toISOString().split("T")[0] : null;
      previousVisitId = Number(pv.id);
    }
  } catch (err) {
    warnings.push("No previous supervision visit record found for this facility.");
  }

  // 3. Fetch Staff Contacts (Check facilityStaff first, then users, then facility master)
  let person1: { name: string; responsibility: string; source: string } | undefined;
  let person2: { name: string; responsibility: string; source: string } | undefined;
  let person3: { name: string; responsibility: string; source: string } | undefined;

  let staffList: any[] = [];
  try {
    staffList = await db
      .select()
      .from(facilityStaff)
      .where(and(eq(facilityStaff.tenantId, tenantId), eq(facilityStaff.facilityId, facilityId)))
      .limit(5);
  } catch (err) {
    // fallback
  }

  if (staffList && staffList.length > 0) {
    person1 = {
      name: staffList[0].fullName || staffList[0].name || "Facility Staff",
      responsibility: staffList[0].position || staffList[0].role || "Facility In-Charge",
      source: "staff_roster",
    };
    if (staffList.length > 1) {
      person2 = {
        name: staffList[1].fullName || staffList[1].name || "EPI Officer",
        responsibility: staffList[1].position || staffList[1].role || "EPI Focal Person",
        source: "staff_roster",
      };
    }
    if (staffList.length > 2) {
      person3 = {
        name: staffList[2].fullName || staffList[2].name || "Cold Chain Staff",
        responsibility: staffList[2].position || staffList[2].role || "Cold Chain Nurse",
        source: "staff_roster",
      };
    }
  } else {
    const userList = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.facilityId, facilityId)))
      .limit(5);

    if (userList && userList.length > 0) {
      person1 = {
        name: `${userList[0].firstName || ''} ${userList[0].lastName || ''}`.trim() || userList[0].email || "Facility Staff",
        responsibility: userList[0].role || "Facility In-Charge",
        source: "user_roster",
      };
      if (userList.length > 1) {
        person2 = {
          name: `${userList[1].firstName || ''} ${userList[1].lastName || ''}`.trim() || userList[1].email || "EPI Officer",
          responsibility: userList[1].role || "EPI Focal Person",
          source: "user_roster",
        };
      }
    } else if ((facility as any).contactPerson || (facility as any).inCharge) {
      const cName = ((facility as any).contactPerson || (facility as any).inCharge || "").trim();
      const cPhone = (facility.contactPhone || (facility as any).phone || "").trim();
      person1 = {
        name: cName + (cPhone ? ` (${cPhone})` : ""),
        responsibility: "Facility In-Charge",
        source: "facility_master",
      };
    } else {
      warnings.push("No facility in-charge or staff roster entries found for this facility.");
    }
  }

  // 4. Fetch Population Denominators
  let totalPop = facility.catchmentGridPopulation || 0;
  let survivingInfants = Math.round(totalPop * 0.035);
  let liveBirths = Math.round(totalPop * 0.037);
  let pregnantWomen = Math.round(totalPop * 0.04);
  let popSource = "Facility Profile Registry";
  let popYear = String(new Date().getFullYear());
  let popVersion: string | null = "v1.0";
  let popConfidence = "Verified";

  const popRows = await db
    .select()
    .from(populationData)
    .where(and(eq(populationData.tenantId, tenantId), eq(populationData.facilityId, facilityId)))
    .orderBy(desc(populationData.year))
    .limit(1);

  if (popRows.length > 0) {
    const pr = popRows[0];
    totalPop = Number(pr.totalPopulation) || totalPop;
    survivingInfants = Number(pr.under1Population) || Math.round(totalPop * 0.035);
    pregnantWomen = Number(pr.pregnantWomen) || Math.round(totalPop * 0.04);
    popSource = pr.source ? `Population Hub (${pr.source})` : "Population Hub (Approved Denominator)";
    popYear = String(pr.year || popYear);
  } else if (totalPop === 0) {
    warnings.push("Population denominator is missing for this facility in Population Hub.");
  }

  // 5. Fetch Service Delivery Sites (Static, Outreach, Mobile)
  let staticSites = 1;
  let outreachSites = 0;
  let mobileSites = 0;

  try {
    const siteRows = await db
      .select({
        sessionType: sessionPlans.sessionType,
      })
      .from(sessionPlans)
      .where(and(eq(sessionPlans.tenantId, tenantId), eq(sessionPlans.facilityId, facilityId)));

    if (siteRows.length > 0) {
      outreachSites = siteRows.filter((s) => (s.sessionType || "").toLowerCase() === "outreach").length;
      mobileSites = siteRows.filter((s) => (s.sessionType || "").toLowerCase() === "mobile").length;
      staticSites = Math.max(1, siteRows.filter((s) => (s.sessionType || "").toLowerCase() === "fixed" || (s.sessionType || "").toLowerCase() === "static").length);
    }
  } catch (err) {
    // fallback
  }

  return {
    facility: {
      facilityId: facility.id,
      facilityName: facility.name,
      hmisCode: facility.hmisCode || `FAC-${facility.id}`,
      facilityType: facility.facilityType || "Health Facility",
      latitude: facility.latitude != null ? Number(facility.latitude) : null,
      longitude: facility.longitude != null ? Number(facility.longitude) : null,
      districtId: district ? district.id : null,
      districtName: district ? district.name : "N/A",
      provinceId: province ? province.id : null,
      provinceName: province ? province.name : "N/A",
      countryId: tenant ? tenant.id : tenantId,
      countryName: tenant ? tenant.name : tenantId,
      contactPerson: (facility as any).contactPerson || (facility as any).inCharge || null,
      contactPhone: facility.contactPhone || (facility as any).phone || null,
    },
    visit: {
      currentVisitDate: formattedVisitDate,
      previousVisitDate,
      previousVisitId,
    },
    contacts: {
      person1,
      person2,
      person3,
    },
    population: {
      totalCatchmentPopulation: totalPop,
      survivingInfants,
      liveBirths,
      pregnantWomen,
      source: popSource,
      sourceYear: popYear,
      versionId: popVersion,
      confidence: popConfidence,
      lastUpdated: new Date().toISOString(),
    },
    epiSites: {
      static: staticSites,
      outreach: outreachSites,
      mobile: mobileSites,
      source: "VaxPlan Session Sites Master Registry",
    },
    metadata: {
      prefilledAt: new Date().toISOString(),
      asOfDate: formattedVisitDate,
      warnings,
    },
  };
}
