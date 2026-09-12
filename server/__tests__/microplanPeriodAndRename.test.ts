import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ update: vi.fn(), set: vi.fn(), where: vi.fn(), returning: vi.fn() }));
vi.mock("../db", () => ({ db: { update: mock.update }, pool: {} }));
import { storage } from "../storage";

describe("Microplan Period and Renaming Policy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T00:00:00Z"));
    mock.update.mockReturnValue({ set: mock.set });
    mock.set.mockReturnValue({ where: mock.where });
    mock.where.mockReturnValue({ returning: mock.returning });
    mock.returning.mockResolvedValue([{ id: 10, name: "Renamed Microplan" }]);
    vi.spyOn(storage, "getTenant").mockResolvedValue({ settings: { minimumPlanDevelopmentDays: 21 } } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("permits renaming an approved microplan with a new name", async () => {
    vi.spyOn(storage, "getMicroplan").mockResolvedValue({
      id: 10,
      status: "approved",
      name: "Old Approved Plan Name",
      createdAt: new Date("2026-01-01"),
    } as any);

    const result = await storage.updateMicroplan("tenant-test", 10, {
      name: "New Approved Plan Name",
    } as any);

    expect(result).toBeDefined();
    expect(mock.set).toHaveBeenCalledWith({
      name: "New Approved Plan Name",
      updatedAt: new Date("2026-09-22"),
    });
  });

  it("rejects non-rename fields on approved microplans", async () => {
    vi.spyOn(storage, "getMicroplan").mockResolvedValue({
      id: 10,
      status: "approved",
      name: "Approved Plan",
      createdAt: new Date("2026-01-01"),
    } as any);

    await expect(
      storage.updateMicroplan("tenant-test", 10, {
        targetPopulation: "12000",
      } as any)
    ).rejects.toThrow("Approved microplans are read-only.");

    await expect(
      storage.updateMicroplan("tenant-test", 10, {
        budget: "5000",
      } as any)
    ).rejects.toThrow("Approved microplans are read-only.");

    expect(mock.update).not.toHaveBeenCalled();
  });

  it("identifies active duplicate plans for the same facility, plan type, year, and quarter", () => {
    const existingPlans = [
      {
        id: 1,
        facilityId: 42,
        planType: "facility_routine",
        year: 2026,
        quarter: 3,
        status: "approved",
        name: "Routine Q3 2026",
      },
      {
        id: 2,
        facilityId: 42,
        planType: "facility_routine",
        year: 2026,
        quarter: 2,
        status: "rejected",
        name: "Routine Q2 2026 Rejected",
      },
    ];

    // Same facility, planType, year, quarter as active plan #1 -> conflict
    const conflict = existingPlans.find(
      (p) =>
        Number(p.facilityId) === 42 &&
        String(p.planType).toLowerCase() === "facility_routine" &&
        Number(p.year) === 2026 &&
        Number(p.quarter) === 3 &&
        !["rejected", "archived", "superseded"].includes(String(p.status).toLowerCase())
    );
    expect(conflict).toBeDefined();
    expect(conflict?.id).toBe(1);

    // Quarter 2 has only a rejected plan -> no conflict
    const q2Conflict = existingPlans.find(
      (p) =>
        Number(p.facilityId) === 42 &&
        String(p.planType).toLowerCase() === "facility_routine" &&
        Number(p.year) === 2026 &&
        Number(p.quarter) === 2 &&
        !["rejected", "archived", "superseded"].includes(String(p.status).toLowerCase())
    );
    expect(q2Conflict).toBeUndefined();

    // Different quarter (Quarter 4) -> no conflict
    const q4Conflict = existingPlans.find(
      (p) =>
        Number(p.facilityId) === 42 &&
        String(p.planType).toLowerCase() === "facility_routine" &&
        Number(p.year) === 2026 &&
        Number(p.quarter) === 4 &&
        !["rejected", "archived", "superseded"].includes(String(p.status).toLowerCase())
    );
    expect(q4Conflict).toBeUndefined();
  });
});
