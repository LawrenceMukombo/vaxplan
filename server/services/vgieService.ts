import { db } from "../db";
import { 
  villages, 
  facilities, 
  vgieRecommendations, 
  vgieAlerts, 
  vgieSettlementFacilityLinks,
  vgieRecommendationRules,
  vgieAlertRules,
  sessionPlans
} from "../../shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

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

    // Fetch active recommendation rules from db
    const activeRules = await db
      .select()
      .from(vgieRecommendationRules)
      .where(
        and(
          eq(vgieRecommendationRules.tenantId, tenantId),
          eq(vgieRecommendationRules.isActive, true)
        )
      );

    const newRecommendations: any[] = [];

    for (const rule of activeRules) {
      try {
        // Query villages that match rule.conditionSql
        const matchingVillages = await db
          .select({
            id: villages.id,
            name: villages.name,
            under5Population: villages.under5Population,
            griddedPopulation: villages.griddedPopulation,
            distanceToFacility: villages.distanceToFacility,
            isHardToReach: villages.isHardToReach,
            highRisk: villages.highRisk,
          })
          .from(villages)
          .where(
            and(
              eq(villages.tenantId, tenantId),
              sql.raw(rule.conditionSql)
            )
          );

        for (const v of matchingVillages) {
          // Check if a pending recommendation for this settlement already exists for this rule name/type
          const [exists] = await db
            .select()
            .from(vgieRecommendations)
            .where(
              and(
                eq(vgieRecommendations.tenantId, tenantId),
                eq(vgieRecommendations.entityType, "settlement"),
                eq(vgieRecommendations.entityId, v.id),
                eq(vgieRecommendations.status, "pending"),
                eq(vgieRecommendations.recommendationType, rule.recommendationText)
              )
            )
            .limit(1);

          if (!exists) {
            newRecommendations.push({
              tenantId,
              entityType: "settlement",
              entityId: v.id,
              recommendationType: rule.recommendationText,
              priority: rule.priority,
              title: `${rule.name}: ${v.name}`,
              description: `Settlement ${v.name} triggered rule "${rule.name}" (${rule.description}). Action recommended: ${rule.recommendationText}`,
              reasoning: JSON.stringify({ rule: rule.name, condition: rule.conditionSql }),
              status: "pending"
            });
          }
        }
      } catch (err: any) {
        console.error(`[VGIE] Failed to evaluate rule "${rule.name}":`, err.message);
      }
    }

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

    // Fetch active alert rules from db
    const activeAlertRules = await db
      .select()
      .from(vgieAlertRules)
      .where(
        and(
          eq(vgieAlertRules.tenantId, tenantId),
          eq(vgieAlertRules.isActive, true)
        )
      );

    const newAlerts: any[] = [];

    for (const rule of activeAlertRules) {
      try {
        const matchingVillages = await db
          .select()
          .from(villages)
          .where(
            and(
              eq(villages.tenantId, tenantId),
              sql.raw(rule.triggerCondition)
            )
          );

        for (const v of matchingVillages) {
          const [exists] = await db
            .select()
            .from(vgieAlerts)
            .where(
              and(
                eq(vgieAlerts.tenantId, tenantId),
                eq(vgieAlerts.alertType, rule.name),
                eq(vgieAlerts.villageId, v.id),
                eq(vgieAlerts.status, "active")
              )
            )
            .limit(1);

          if (!exists) {
            let message = rule.alertTemplate
              .replace("{{grid_pop}}", String(v.griddedPopulation ?? "unknown"))
              .replace("{{nso_pop}}", String(v.totalCatchmentPopulation ?? "unknown"))
              .replace("{{building_count}}", "15+");
            
            newAlerts.push({
              tenantId,
              alertType: rule.name,
              severity: rule.severity,
              title: `${rule.name}: ${v.name}`,
              message: message,
              villageId: v.id,
              status: "active"
            });
          }
        }
      } catch (err: any) {
        console.warn(`[VGIE Alert Rules] Skipping rule "${rule.name}" SQL trigger evaluation:`, err.message);
        
        if (rule.name === "Population Spike") {
          const allV = await db.select().from(villages).where(eq(villages.tenantId, tenantId));
          for (const v of allV) {
            const grid = v.griddedPopulation ?? 0;
            const census = v.totalCatchmentPopulation ?? 0;
            if (grid > 0 && census > 0) {
              const diffPct = Math.abs(grid - census) / census * 100;
              if (diffPct > 25) {
                const [exists] = await db
                  .select()
                  .from(vgieAlerts)
                  .where(
                    and(
                      eq(vgieAlerts.tenantId, tenantId),
                      eq(vgieAlerts.alertType, rule.name),
                      eq(vgieAlerts.villageId, v.id),
                      eq(vgieAlerts.status, "active")
                    )
                  )
                  .limit(1);

                if (!exists) {
                  newAlerts.push({
                    tenantId,
                    alertType: rule.name,
                    severity: rule.severity,
                    title: `Population Mismatch: ${v.name}`,
                    message: `Population mismatch detected: GridPop estimates ${grid} vs NSO census ${census}.`,
                    villageId: v.id,
                    status: "active"
                  });
                }
              }
            }
          }
        }
      }
    }

    if (newAlerts.length > 0) {
      await db.insert(vgieAlerts).values(newAlerts);
      console.log(`[VGIE] Generated ${newAlerts.length} new alerts.`);
    }

    return newAlerts;
  }
}
