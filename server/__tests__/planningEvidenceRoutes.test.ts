import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), transaction: vi.fn(), release: vi.fn(), permission: vi.fn() }));
vi.mock("../db", () => ({ pool: { query: mocks.query, connect: mocks.connect } }));
vi.mock("../auth", () => ({ isAuthenticated: (_req: any, _res: any, next: any) => next() }));
vi.mock("../auth/tenantResolver", () => ({ requireTenant: (req: any, _res: any, next: any) => { req.tenantId = "country-a"; next(); } }));
vi.mock("../auth/loadDbUser", () => ({ requireDbUser: (req: any, _res: any, next: any) => { req.dbUser = { id: "reviewer", role: "district_manager" }; next(); } }));
vi.mock("../auth/authorization", () => ({ ensureTenantRolesCache: vi.fn(), hasPermission: mocks.permission }));
import { planningEvidenceRouter } from "../routes/planningEvidence";
const app = express(); app.use(express.json()); app.use("/evidence", planningEvidenceRouter);
const id = "d9bd7202-f437-4942-a38f-e9b016899319";
const payload = { title: "Local consultation", date: "2026-09-09", facilitator: "CHV", communities: "Village A", participantGroups: "Caregivers and women's group", actualAttendance: 12, issues: "Inconvenient hours", decisions: "Change time", validation: "confirmed" };
describe("planning evidence boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.permission.mockReturnValue(true);
    mocks.query.mockResolvedValue({ rows: [{ district_id: 2, province_id: 3 }] });
    mocks.connect.mockResolvedValue({ query: mocks.transaction, release: mocks.release }); mocks.transaction.mockResolvedValue({ rows: [] });
  });
  it("requires geographic access before listing evidence", async () => {
    mocks.permission.mockReturnValue(false);
    expect((await request(app).get("/evidence?facilityId=1&kind=consultation")).status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it("rejects a foreign microplan without writing evidence", async () => {
    expect((await request(app).post("/evidence").send({ facilityId: 1, kind: "consultation", microplanId: 7, payload })).status).toBe(400);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.stringContaining("FROM microplans"), [7, "country-a", 1]);
  });
  it("restricts national target-group definitions", async () => {
    expect((await request(app).post("/evidence").send({ facilityId: 1, kind: "target_group", payload: { title: "Young children", minimumAgeMonths: 12, maximumAgeMonths: 23, eligibility: "Resident", sex: "all", overlapNotes: "Under five", status: "active" } })).status).toBe(403);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it("checks linked budget lines against the facility", async () => {
    expect((await request(app).post("/evidence").send({ facilityId: 1, kind: "finance", payload: { title: "Transport receipt", budgetItemId: 9, type: "receipt", amountMinor: 1000, currency: "ZAR", date: "2026-09-09", funder: "Government", reference: "Receipt 1" } })).status).toBe(400);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.stringContaining("FROM budget_items"), [9, "country-a", 1]);
  });
  it("requires a saved draft microplan for RED worksheets", async () => {
    const body = { facilityId: 1, kind: "red_microplanning", payload: { title: "RED", sections: {} } };
    expect((await request(app).post("/evidence").send(body)).status).toBe(400);
    mocks.transaction.mockImplementation(async (sql: string) => ({ rows: sql.includes("FROM microplans") ? [{ id: 7, status: "approved" }] : [] }));
    expect((await request(app).post("/evidence").send({ ...body, microplanId: 7 })).status).toBe(409);
    expect(mocks.transaction.mock.calls.some(([sql]) => sql.includes("INSERT INTO planning_evidence"))).toBe(false);
  });
  it("rejects stale evidence updates", async () => {
    mocks.transaction.mockImplementation(async (sql: string) => ({ rows: sql.includes("FOR UPDATE") ? [{ version: 3, payload }] : [] }));
    expect((await request(app).put(`/evidence/${id}`).send({ facilityId: 1, kind: "consultation", version: 1, payload })).status).toBe(409);
  });
});
