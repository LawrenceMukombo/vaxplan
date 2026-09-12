import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), transaction: vi.fn(), release: vi.fn(), permission: vi.fn() }));
vi.mock("../db", () => ({ pool: { query: mocks.query, connect: mocks.connect } }));
vi.mock("../auth", () => ({ isAuthenticated: (_req: any, _res: any, next: any) => next() }));
vi.mock("../auth/tenantResolver", () => ({ requireTenant: (req: any, _res: any, next: any) => { req.tenantId = "country-a"; next(); } }));
vi.mock("../auth/loadDbUser", () => ({ requireDbUser: (req: any, _res: any, next: any) => { req.dbUser = { id: "reviewer" }; next(); } }));
vi.mock("../auth/authorization", () => ({ ensureTenantRolesCache: vi.fn(), hasPermission: mocks.permission }));
import { planningActionsRouter } from "../routes/planningActions";
const app = express(); app.use(express.json()); app.use("/actions", planningActionsRouter);
const id = "d9bd7202-f437-4942-a38f-e9b016899319";
const action = { title: "Arrange meeting", problem: "Inconvenient service hours", status: "agreed", owner: "Facility lead", dueDate: "2026-10-01", sourceType: "manual", sourceId: null };

describe("planning actions API", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.permission.mockReturnValue(true);
    mocks.query.mockResolvedValue({ rows: [{ id: 1, district_id: 2, province_id: 3 }] });
    mocks.connect.mockResolvedValue({ query: mocks.transaction, release: mocks.release });
    mocks.transaction.mockResolvedValue({ rows: [] });
  });
  it("refuses facility reads outside the authorized scope", async () => {
    mocks.permission.mockReturnValue(false);
    expect((await request(app).get("/actions?facilityId=1")).status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][1]).toEqual([1, "country-a"]);
  });
  it("rejects injected tenant scope before opening a transaction", async () => {
    expect((await request(app).post("/actions").send({ facilityId: 1, tenantId: "country-b", action })).status).toBe(400);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it("rejects cross-facility review links and rolls back", async () => {
    const result = await request(app).post("/actions").send({ facilityId: 1, action: { ...action, sourceType: "quarterly_review", sourceId: 90 } });
    expect(result.status).toBe(400);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.stringContaining("quarterly_reviews"), [90, "country-a", 1]);
    expect(mocks.transaction).toHaveBeenCalledWith("ROLLBACK");
  });
  it("rejects stale edits without writing history", async () => {
    mocks.transaction.mockImplementation(async (sql: string) => ({ rows: sql.includes("FOR UPDATE") ? [{ version: 3, payload: action, updated_by: "other" }] : [] }));
    expect((await request(app).put(`/actions/${id}`).send({ facilityId: 1, version: 2, action })).status).toBe(409);
    expect(mocks.transaction.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(false);
  });
  it("prevents users verifying their own completion", async () => {
    mocks.transaction.mockImplementation(async (sql: string) => ({ rows: sql.includes("FOR UPDATE") ? [{ version: 3, payload: { ...action, status: "completed" }, updated_by: "reviewer" }] : [] }));
    expect((await request(app).put(`/actions/${id}`).send({ facilityId: 1, version: 3, action: { ...action, status: "verified", evidence: "Meeting minutes" } })).status).toBe(403);
  });
  it("commits the new action and audit revision together", async () => {
    mocks.transaction.mockImplementation(async (sql: string) => ({ rows: sql.startsWith("INSERT INTO planning_actions(") ? [{ id, version: 1, payload: action, tenant_id: "country-a", facility_id: 1 }] : [] }));
    const result = await request(app).post("/actions").send({ facilityId: 1, action });
    expect(result.status).toBe(201);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO planning_action_history"), expect.any(Array));
    expect(mocks.transaction).toHaveBeenCalledWith("COMMIT");
    expect(mocks.release).toHaveBeenCalled();
  });
});
