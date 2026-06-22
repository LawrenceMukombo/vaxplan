import { db } from "../db";
import { tenants, vgieRecommendationRules, vgieAlertRules } from "../../shared/schema";
import { eq } from "drizzle-orm";

export async function seedVgieRules() {
  console.log("Seeding VGIE Recommendation and Alert Rules...");
  
  // Get all tenants
  const allTenants = await db.select().from(tenants);
  
  if (allTenants.length === 0) {
    console.log("No tenants found, skipping VGIE rules seeding.");
    return;
  }

  const defaultRecommendationRules = [
    {
      name: "Unassigned Settlement",
      description: "Settlement lacks a linked facility in the microplan.",
      category: "service_delivery",
      conditionSql: "linked_facility_id IS NULL",
      recommendationText: "Map nearest facility or evaluate for outreach session.",
      priority: "high"
    },
    {
      name: "Hard to Reach Area",
      description: "Settlement is classified as hard-to-reach geographically.",
      category: "service_delivery",
      conditionSql: "hard_to_reach = true",
      recommendationText: "Include in mobile or specialized outreach microplan.",
      priority: "high"
    },
    {
      name: "Distant Settlement",
      description: "Settlement is further than 5km from nearest facility.",
      category: "service_delivery",
      conditionSql: "distance_to_facility_km > 5",
      recommendationText: "Evaluate for standard outreach sessions.",
      priority: "medium"
    }
  ];

  const defaultAlertRules = [
    {
      name: "Population Spike",
      description: "Significant mismatch between GridPop and census data",
      severity: "warning",
      triggerCondition: "population_mismatch_pct > 25",
      alertTemplate: "Population mismatch detected: GridPop estimates {{grid_pop}} vs NSO census {{nso_pop}}.",
    },
    {
      name: "Unmapped Settlement Detected",
      description: "New candidate settlement detected from satellite imagery",
      severity: "info",
      triggerCondition: "validation_status = 'pending'",
      alertTemplate: "New unmapped settlement detected with estimated {{building_count}} structures.",
    }
  ];

  let rulesAdded = 0;

  for (const tenant of allTenants) {
    // 1. Recommendations
    for (const rule of defaultRecommendationRules) {
      const existing = await db.select()
        .from(vgieRecommendationRules)
        .where(eq(vgieRecommendationRules.tenantId, tenant.id));
        
      const exists = existing.find((e: any) => e.name === rule.name);
      if (!exists) {
        await db.insert(vgieRecommendationRules).values({
          ...rule,
          tenantId: tenant.id,
          isActive: true
        });
        rulesAdded++;
      }
    }
    
    // 2. Alerts
    for (const rule of defaultAlertRules) {
      const existing = await db.select()
        .from(vgieAlertRules)
        .where(eq(vgieAlertRules.tenantId, tenant.id));
        
      const exists = existing.find((e: any) => e.name === rule.name);
      if (!exists) {
        await db.insert(vgieAlertRules).values({
          ...rule,
          tenantId: tenant.id,
          isActive: true
        });
        rulesAdded++;
      }
    }
  }

  console.log(`VGIE rules seeding completed. Added ${rulesAdded} new rules.`);
}
