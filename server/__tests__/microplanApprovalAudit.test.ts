import { describe, expect, it, vi, beforeEach } from "vitest";
import { getMicroplanApprovalAudit } from "../services/microplanApprovalService";

describe("getMicroplanApprovalAudit", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
    };
  });

  it("returns null when microplan is null or lacks id", async () => {
    const res = await getMicroplanApprovalAudit(mockDb, "tenant-1", null);
    expect(res).toBeNull();
  });

  it("extracts full approval details for officially approved microplan", async () => {
    const approvalReq = {
      id: 101,
      tenantId: "tenant-1",
      entityType: "microplan",
      entityId: 42,
      currentLevel: "district",
      status: "approved",
      comments: "Endorsed after district supervision review.",
      submittedAt: new Date("2026-09-01T08:30:00Z"),
      resolvedAt: new Date("2026-09-10T14:45:00Z"),
      requestedById: "user-author-1",
      resolvedById: "user-approver-1",
    };

    const approverUser = {
      id: "user-approver-1",
      firstName: "Sarah",
      lastName: "Jenkins",
      email: "sarah.j@moh.gov",
      role: "district_supervisor",
    };

    const authorUser = {
      id: "user-author-1",
      firstName: "David",
      lastName: "Moyo",
      email: "david.moyo@clinic.org",
      role: "facility_in_charge",
    };

    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: any) => ({
        where: vi.fn().mockImplementation(() => ({
          orderBy: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([approvalReq]),
          })),
          limit: vi.fn().mockImplementation(() => {
            return Promise.resolve([approverUser]);
          }),
        })),
      })),
    }));

    const plan = {
      id: 42,
      status: "approved",
      approvedAt: new Date("2026-09-10T14:45:00Z"),
      submittedAt: new Date("2026-09-01T08:30:00Z"),
      approvedByUserId: "user-approver-1",
      createdByUserId: "user-author-1",
    };

    const audit = await getMicroplanApprovalAudit(mockDb, "tenant-1", plan);
    expect(audit).toBeDefined();
    expect(audit?.isApproved).toBe(true);
    expect(audit?.isAutoApproved).toBe(false);
    expect(audit?.approvedAt).toBe("2026-09-10T14:45:00.000Z");
    expect(audit?.approvedDateLabel).toBeTruthy();
    expect(audit?.approvedByName).toBe("Sarah Jenkins");
    expect(audit?.approvedByRole).toBe("District Supervisor");
    expect(audit?.submittedAt).toBe("2026-09-01T08:30:00.000Z");
    expect(audit?.comments).toBe("Endorsed after district supervision review.");
  });

  it("correctly identifies automated 14-day policy auto-approval", async () => {
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          orderBy: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    }));

    const autoApprovedPlan = {
      id: 99,
      status: "auto_approved",
      autoApprovedAt: new Date("2026-09-08T10:00:00Z"),
      submittedAt: new Date("2026-08-25T10:00:00Z"),
      approvedAt: new Date("2026-09-08T10:00:00Z"),
    };

    const audit = await getMicroplanApprovalAudit(mockDb, "tenant-1", autoApprovedPlan);
    expect(audit).toBeDefined();
    expect(audit?.isApproved).toBe(true);
    expect(audit?.isAutoApproved).toBe(true);
    expect(audit?.approvedByName).toBe("Automated Approval Policy");
    expect(audit?.approvedByRole).toBe("14-Day Inactivity Rule");
    expect(audit?.approvedAt).toBe("2026-09-08T10:00:00.000Z");
  });
});
