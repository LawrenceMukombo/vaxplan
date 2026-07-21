import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { EntityHistoryService } from "../services/entityHistoryService";
import { AsOfDateService } from "../services/asOfDateService";

describe("EntityHistoryService and Temporal Versioning", () => {
  const tenantId = "test-tenant-1";

  it("should create initial entity change proposal", async () => {
    const created = await EntityHistoryService.createChange(
      tenantId,
      "facility",
      "101",
      {
        changeType: "reclassified",
        changeReason: "Upgraded to District Hospital",
        validFrom: new Date("2026-01-01"),
        snapshotData: {
          name: "Kaunga Health Post",
          facilityType: "Health Post",
          districtId: 5,
        },
      },
      "user-admin"
    );

    expect(created).toBeDefined();
    expect(created.stableEntityId).toBe("101");
    expect(created.versionNumber).toBe(1);
    expect(created.changeType).toBe("reclassified");
    expect(created.status).toBe("draft");
  });

  it("should approve and activate entity version", async () => {
    const created = await EntityHistoryService.createChange(
      tenantId,
      "user",
      "user-100",
      {
        changeType: "role_changed",
        changeReason: "Promoted to District Officer",
        validFrom: new Date("2025-06-01"),
        snapshotData: {
          role: "district_manager",
          districtId: 2,
        },
      },
      "user-admin"
    );

    const approved = await EntityHistoryService.approveChange(
      tenantId,
      created.id,
      "user-reviewer"
    );

    expect(approved).toBeDefined();
    expect(approved.status).toBe("active");
    expect(approved.isCurrent).toBe(true);
    expect(approved.approvedBy).toBe("user-reviewer");
  });

  it("should resolve point-in-time state as of target date", async () => {
    const pastDate = new Date("2025-12-31");
    const asOf = await AsOfDateService.getFacilityDetailsAsOf(
      tenantId,
      101,
      pastDate
    );

    expect(asOf).toBeDefined();
  });

  it("should generate side-by-side version comparison diff", async () => {
    const v1 = await EntityHistoryService.createChange(
      tenantId,
      "community",
      " village-50",
      {
        changeType: "created",
        validFrom: new Date("2025-01-01"),
        snapshotData: { name: "Mushitala Village", population: 1200 },
      }
    );

    const v2 = await EntityHistoryService.createChange(
      tenantId,
      "community",
      " village-50",
      {
        changeType: "population_revised",
        validFrom: new Date("2026-01-01"),
        snapshotData: { name: "Mushitala Village", population: 1550 },
      }
    );

    const comparison = await EntityHistoryService.compareVersions(
      tenantId,
      v1.id,
      v2.id
    );

    expect(comparison.differences).toBeDefined();
    expect(comparison.differences.some((d) => d.field === "population")).toBe(true);
  });
});
