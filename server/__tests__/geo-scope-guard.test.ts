/**
 * Integration tests for ISS-02 geo-scope guards and ISS-01 productId validation.
 *
 * These tests verify:
 * 1. POST /api/stock/transaction returns 403 when a facility-scoped user
 *    attempts to record a transaction for a facility outside their scope.
 * 2. POST /api/stock/transaction returns 400 when productId is invalid
 *    (references a non-existent catalogue vaccine).
 * 3. POST /api/stock/transaction succeeds (non-403/non-401) for a user whose
 *    scope covers the target facility.
 *
 * We do NOT assert full 201 success because that requires a fully seeded DB.
 * The invariants are purely about 403 vs non-403 (geo-scope) and 4xx for bad
 * productId — independent of whether downstream Zod validation also fires.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express, { type Express } from "express";
import { createServer, type Server as HttpServer } from "http";
import request from "supertest";
import { eq } from "drizzle-orm";

import { db, pool } from "../db";
import { registerRoutes } from "../routes";
import { tenants, users } from "@shared/schema";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TENANT_ID = "test-geoscope-tenant";

const FACILITY_CLERK_IN_SCOPE = {
  id: "test-geo-clerk-inscope",
  email: "geo.clerk.inscope@vaxplan.org",
  role: "facility_clerk" as const,
  roles: ["facility_clerk"],
  facilityId: 1,
  districtId: 1,
  provinceId: 1,
  dataAccessScope: { provinces: [], districts: [], facilities: [1] },
  permissions: ["manage_stock"],
};

const FACILITY_CLERK_OUT_OF_SCOPE = {
  id: "test-geo-clerk-outscope",
  email: "geo.clerk.outscope@vaxplan.org",
  role: "facility_clerk" as const,
  roles: ["facility_clerk"],
  facilityId: 2,
  districtId: 2,
  provinceId: 1,
  dataAccessScope: { provinces: [], districts: [], facilities: [2] },
  permissions: ["manage_stock"],
};

const NATIONAL_ADMIN = {
  id: "test-geo-national-admin",
  email: "geo.national.admin@vaxplan.org",
  role: "national_admin" as const,
  roles: ["national_admin"],
  facilityId: null,
  districtId: null,
  provinceId: null,
  dataAccessScope: { provinces: [], districts: [], facilities: [] },
  permissions: [],
};

// ─── Setup ─────────────────────────────────────────────────────────────────────

describe("Geo-scope guard on POST /api/stock/transaction (ISS-02)", () => {
  let app: Express;
  let httpServer: HttpServer;
  const agents = new Map<string, ReturnType<typeof request.agent>>();

  beforeAll(async () => {
    // Ensure tenant exists
    const existing = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, TENANT_ID))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(tenants).values({
        id: TENANT_ID,
        name: "Geo Scope Test Tenant",
        country: "ZM",
      });
    }

    // Upsert test users
    for (const u of [FACILITY_CLERK_IN_SCOPE, FACILITY_CLERK_OUT_OF_SCOPE, NATIONAL_ADMIN]) {
      await db
        .insert(users)
        .values({
          id: u.id,
          tenantId: TENANT_ID,
          email: u.email,
          name: u.email,
          role: u.role,
          roles: u.roles,
          facilityId: u.facilityId,
          districtId: u.districtId,
          provinceId: u.provinceId,
          dataAccessScope: u.dataAccessScope,
          permissions: u.permissions,
          isPlatformAdmin: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }

    app = express();
    app.use(express.json());
    httpServer = createServer(app);
    await registerRoutes(app);

    // Log in each user via mock-auth
    for (const u of [FACILITY_CLERK_IN_SCOPE, FACILITY_CLERK_OUT_OF_SCOPE, NATIONAL_ADMIN]) {
      const agent = request.agent(app);
      await agent.post("/api/auth/mock-login").send({ userId: u.id });
      agents.set(u.id, agent);
    }
  });

  afterAll(async () => {
    httpServer.close();
    // Clean up test users and tenant
    for (const u of [FACILITY_CLERK_IN_SCOPE, FACILITY_CLERK_OUT_OF_SCOPE, NATIONAL_ADMIN]) {
      await db.delete(users).where(eq(users.id, u.id));
    }
    await db.delete(tenants).where(eq(tenants.id, TENANT_ID));
    await pool.end();
  });

  it("returns 403 when clerk records a transaction for an out-of-scope facility", async () => {
    const agent = agents.get(FACILITY_CLERK_OUT_OF_SCOPE.id)!;
    const res = await agent.post("/api/stock/transaction").send({
      facilityId: 1, // clerk is scoped to facility 2
      vaccineName: "BCG",
      transactionType: "receipt",
      quantityDoses: 100,
      batchNumber: "BATCH-TEST",
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      vvmStatus: 1,
      transactionDate: new Date().toISOString(),
    });
    expect(res.status).toBe(403);
  });

  it("does NOT return 403 for in-scope facility clerk", async () => {
    const agent = agents.get(FACILITY_CLERK_IN_SCOPE.id)!;
    const res = await agent.post("/api/stock/transaction").send({
      facilityId: 1, // clerk is scoped to facility 1
      vaccineName: "BCG",
      transactionType: "receipt",
      quantityDoses: 100,
      batchNumber: "BATCH-TEST-INSCOPE",
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      vvmStatus: 1,
      transactionDate: new Date().toISOString(),
    });
    // We accept any status except 403 (geo block) and 401 (auth failure)
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it("does NOT return 403 for national admin (has tenant-wide access)", async () => {
    const agent = agents.get(NATIONAL_ADMIN.id)!;
    const res = await agent.post("/api/stock/transaction").send({
      facilityId: 1,
      vaccineName: "BCG",
      transactionType: "receipt",
      quantityDoses: 100,
      batchNumber: "BATCH-TEST-NATIONAL",
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      vvmStatus: 1,
      transactionDate: new Date().toISOString(),
    });
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });
});

describe("Product ID validation on POST /api/stock/transaction (ISS-01)", () => {
  let app: Express;
  let httpServer: HttpServer;
  let adminAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    // Ensure tenant exists
    const existing = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, TENANT_ID))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(tenants).values({
        id: TENANT_ID,
        name: "Geo Scope Test Tenant",
        country: "ZM",
      });
    }

    // Ensure national admin user
    await db
      .insert(users)
      .values({
        id: NATIONAL_ADMIN.id,
        tenantId: TENANT_ID,
        email: NATIONAL_ADMIN.email,
        name: NATIONAL_ADMIN.email,
        role: NATIONAL_ADMIN.role,
        roles: NATIONAL_ADMIN.roles,
        facilityId: null,
        districtId: null,
        provinceId: null,
        dataAccessScope: NATIONAL_ADMIN.dataAccessScope,
        permissions: NATIONAL_ADMIN.permissions,
        isPlatformAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    app = express();
    app.use(express.json());
    httpServer = createServer(app);
    await registerRoutes(app);

    adminAgent = request.agent(app);
    await adminAgent.post("/api/auth/mock-login").send({ userId: NATIONAL_ADMIN.id });
  });

  afterAll(async () => {
    httpServer.close();
  });

  it("returns 400 when productId references a non-existent catalogue vaccine", async () => {
    const res = await adminAgent.post("/api/stock/transaction").send({
      facilityId: 1,
      productId: 999999, // non-existent catalogue vaccine ID
      vaccineName: "BCG",
      transactionType: "receipt",
      quantityDoses: 100,
      batchNumber: "BATCH-BAD-PRODUCT",
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      vvmStatus: 1,
      transactionDate: new Date().toISOString(),
    });
    // Should be rejected — 400 (invalid product) not 403 (geo) or 401 (auth)
    expect(res.status).toBe(400);
  });
});
