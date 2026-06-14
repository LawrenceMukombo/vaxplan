import { db } from "../db";
import { 
  villages, 
  facilities, 
  vgieRecommendations, 
  vgieAlerts, 
  vgieSettlementFacilityLinks 
} from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * VaxPlan Geospatial Intelligence Engine (VGIE) Service
 */
export class VgieService {
  /**
   * Generates AI-driven recommendations for a given tenant.
   * Scans settlements and facilities to find misalignments, underserved areas, and missing outreach.
   */
  static async generateRecommendations(tenantId: string) {
    console.log(`[VGIE] Starting recommendation engine for tenant: ${tenantId}`);

    // Fetch all villages and facilities for basic analysis
    const allVillages = await db.select().from(villages).where(eq(villages.tenantId, tenantId));
    const allFacilities = await db.select().from(facilities).where(eq(facilities.tenantId, tenantId));

    const newRecommendations: any[] = [];

    // Rule 1: High Population, Long Distance -> Propose Outreach or New Health Post
    for (const v of allVillages) {
      // Assuming distance is either calculated dynamically or stored in `distanceToFacility`
      const dist = v.distanceToFacility ? Number(v.distanceToFacility) : 0;
      const pop = v.totalCatchmentPopulation || v.griddedPopulation || 0;

      if (dist > 5 && pop > 1000) {
        newRecommendations.push({
          tenantId,
          entityType: "settlement",
          entityId: v.id,
          recommendationType: "add_outreach",
          priority: "high",
          title: `Establish Outreach for ${v.name}`,
          description: `Settlement ${v.name} has a large population (${pop}) but is >5km from a facility.`,
          reasoning: JSON.stringify({ distance: dist, population: pop, rule: "High Pop / Long Dist" }),
          status: "pending"
        });
      }
    }

    // Insert new recommendations if any exist
    if (newRecommendations.length > 0) {
      await db.insert(vgieRecommendations).values(newRecommendations);
      console.log(`[VGIE] Generated ${newRecommendations.length} new recommendations.`);
    }

    return newRecommendations;
  }

  /**
   * Analyzes the catchment and generates alerts for coverage gaps
   * e.g., flooded areas, inaccessible settlements, or large unassigned populations.
   */
  static async detectCoverageGaps(tenantId: string) {
    console.log(`[VGIE] Detecting coverage gaps for tenant: ${tenantId}`);

    // Example logic: Find hard-to-reach settlements with zero assigned facilities
    const unassignedHtr = await db.select()
      .from(villages)
      .where(
        and(
          eq(villages.tenantId, tenantId),
          eq(villages.isHardToReach, true),
          sql`${villages.assignedFacilityId} IS NULL`
        )
      );

    const newAlerts: any[] = [];

    for (const v of unassignedHtr) {
      newAlerts.push({
        tenantId,
        alertType: "unassigned_htr",
        severity: "high",
        title: `Unassigned Hard-to-Reach Settlement: ${v.name}`,
        message: `Settlement ${v.name} is marked as hard-to-reach but has no assigned health facility.`,
        status: "active"
      });
    }

    if (newAlerts.length > 0) {
      await db.insert(vgieAlerts).values(newAlerts);
      console.log(`[VGIE] Generated ${newAlerts.length} new alerts.`);
    }

    return newAlerts;
  }
}
