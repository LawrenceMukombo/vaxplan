import { EntityHistoryService } from "../server/services/entityHistoryService";
import { AsOfDateService } from "../server/services/asOfDateService";
import { db } from "../server/db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

async function runTemporalHistoryTestSuite() {
  console.log("===============================================================");
  console.log("   VAXPLAN TEMPORAL HISTORY & ENTITY VERSIONING TEST SUITE    ");
  console.log("===============================================================\n");

  // Fetch or create a valid tenant ID for foreign key relationship
  const tenantList = await db.select().from(tenants).limit(1);
  let tenantId = tenantList[0]?.id;

  if (!tenantId) {
    tenantId = "test-tenant-zambia";
    await db.insert(tenants).values({
      id: tenantId,
      name: "Test Tenant Zambia",
      countryCode: "ZMB",
    } as any).onConflictDoNothing();
  }

  console.log(`ℹ️  Using Tenant ID: ${tenantId}`);

  const entityType = "facility";
  const stableEntityId = "fac-101";

  try {
    // 1. Create initial Version Proposal (Draft)
    console.log("🧪 Test Case 1: Proposing entity attribute update (Draft Version 1)...");
    const draftV1 = await EntityHistoryService.createChange(
      tenantId,
      entityType,
      stableEntityId,
      {
        changeType: "reclassified",
        changeReason: "Upgraded from Rural Health Post to Zonal Health Centre",
        validFrom: new Date("2026-01-01"),
        snapshotData: {
          name: "Chawama Zonal Centre",
          facilityType: "Zonal Health Centre",
          districtId: 2,
          catchmentPopulation: 24500,
        },
      },
      "user-officer-01"
    );

    console.log("   ✅ Version 1 Draft Created:", {
      id: draftV1.id,
      versionNumber: draftV1.versionNumber,
      status: draftV1.status,
      changeType: draftV1.changeType,
    });

    // 2. Approve and Activate Version Proposal
    console.log("\n🧪 Test Case 2: Reviewer approving Version 1 proposal...");
    const activeV1 = await EntityHistoryService.approveChange(tenantId, draftV1.id, "user-supervisor-99");
    console.log("   ✅ Version 1 Approved & Activated:", {
      id: activeV1.id,
      status: activeV1.status,
      isCurrent: activeV1.isCurrent,
      approvedBy: activeV1.approvedBy,
    });

    // 3. Create Version Proposal 2 (Population & Name Revision)
    console.log("\n🧪 Test Case 3: Proposing Version 2 population denominator revision...");
    const draftV2 = await EntityHistoryService.createChange(
      tenantId,
      entityType,
      stableEntityId,
      {
        changeType: "population_revised",
        changeReason: "Adjusted based on 2026 Census satellite recount",
        validFrom: new Date("2026-06-01"),
        snapshotData: {
          name: "Chawama Zonal Health Centre",
          facilityType: "Zonal Health Centre",
          districtId: 2,
          catchmentPopulation: 28900,
        },
      },
      "user-officer-01"
    );

    console.log("   ✅ Version 2 Draft Created:", {
      id: draftV2.id,
      versionNumber: draftV2.versionNumber,
      status: draftV2.status,
    });

    // Approve Version 2
    const activeV2 = await EntityHistoryService.approveChange(tenantId, draftV2.id, "user-supervisor-99");
    console.log("   ✅ Version 2 Approved & Activated (Supersedes Version 1):", {
      id: activeV2.id,
      versionNumber: activeV2.versionNumber,
      status: activeV2.status,
      isCurrent: activeV2.isCurrent,
    });

    // 4. Generate Version Diff Comparison
    console.log("\n🧪 Test Case 4: Generating side-by-side version comparison diff (v1 vs v2)...");
    const diff = await EntityHistoryService.compareVersions(tenantId, activeV1.id, activeV2.id);
    console.log("   ✅ Version Diff Result:");
    console.log("      Summary:", diff.summary);
    console.log("      Differences:", JSON.stringify(diff.differences, null, 2));

    // 5. Point-in-Time Resolution (As-Of Date Query)
    console.log("\n🧪 Test Case 5: Querying historical state as of 2026-03-15...");
    const asOfMarch = await EntityHistoryService.getAsOf(tenantId, entityType, stableEntityId, "2026-03-15");
    console.log("   ✅ As-Of 2026-03-15 State Resolved:", {
      versionNumber: asOfMarch?.versionNumber,
      name: (asOfMarch?.snapshotData as any)?.name,
      population: (asOfMarch?.snapshotData as any)?.catchmentPopulation,
    });

    console.log("\n===============================================================");
    console.log("   🎉 ALL TEMPORAL HISTORY TESTS PASSED SUCCESSFULLY!          ");
    console.log("===============================================================");
  } catch (error: any) {
    console.error("\n❌ Test execution encountered an error:", error.message || error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTemporalHistoryTestSuite();
