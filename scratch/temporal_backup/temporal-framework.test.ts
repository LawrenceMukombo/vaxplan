import { describe, expect, it, beforeEach } from "vitest";
import { db } from "../db";
import { users, tenants } from "@shared/schema";
import { temporalService } from "../services/temporalService";
import { getEffectivePermissions } from "../auth/authorization";

describe("Temporal framework integration tests", () => {
  const tenantId = "test-tenant-temp";
  let testUser: any;

  beforeEach(async () => {
    // Seed test tenant if not present
    await db.insert(tenants).values({
      id: tenantId,
      name: "Temporal Test Tenant",
      code: "temptest",
      countryCode: "ZMB",
    }).onConflictDoNothing();

    // Create a clean test user
    const email = `temp-${Date.now()}@example.com`;
    const [insertedUser] = await db.insert(users).values({
      tenantId,
      email,
      firstName: "Temp",
      lastName: "Tester",
      roles: ["facility_clerk"],
      dataAccessScope: { provinces: [], districts: [], facilities: [] },
      isActive: true,
    }).returning();

    testUser = insertedUser;
  });

  it("1. prevents overlapping role assignments for the same user & role", async () => {
    const actor = { userId: testUser.id };
    const now = new Date();

    // 1st assignment: active now, for next 5 days
    const start1 = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const end1 = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    await temporalService.createRoleAssignment(tenantId, {
      userId: testUser.id,
      roleCode: "district_manager",
      effectiveStart: start1,
      effectiveEnd: end1,
      status: "active",
    }, actor);

    // 2nd assignment: overlapping with the 1st
    const start2 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const end2 = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

    await expect(
      temporalService.createRoleAssignment(tenantId, {
        userId: testUser.id,
        roleCode: "district_manager",
        effectiveStart: start2,
        effectiveEnd: end2,
        status: "active",
      }, actor)
    ).rejects.toThrow(/overlaps/);
  });

  it("2. resolves dynamic permissions using active temporal role assignments", async () => {
    const actor = { userId: testUser.id };
    const now = new Date();

    // Assign "gis_specialist" temporally
    await temporalService.createRoleAssignment(tenantId, {
      userId: testUser.id,
      roleCode: "gis_specialist",
      effectiveStart: new Date(now.getTime() - 10000),
      status: "active",
    }, actor);

    // Assert that the user resolves to gis_specialist roles/permissions
    const activeRoles = await temporalService.getRoleAssignmentsAsOf(tenantId, testUser.id, now);
    expect(activeRoles.some(r => r.roleCode === "gis_specialist")).toBe(true);

    const permissions = await getEffectivePermissions(testUser, tenantId);
    expect(permissions).toBeDefined();
  });

  it("3. executes scheduled dynamic activations and expirations", async () => {
    const actor = { userId: testUser.id };
    const now = new Date();

    // Propose an approved role assignment scheduled to start 5 seconds ago
    const startTime = new Date(now.getTime() - 5000);
    await temporalService.createRoleAssignment(tenantId, {
      userId: testUser.id,
      roleCode: "national_admin",
      effectiveStart: startTime,
      status: "approved", // approved status is ready to be activated by scheduler
    }, actor);

    // Execute activations
    const summary = await temporalService.activateScheduledVersions(tenantId, now);
    expect(summary.activatedRoles).toBeGreaterThanOrEqual(1);
  });
});
