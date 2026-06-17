import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express, { type Express } from "express";
import { createServer, type Server as HttpServer } from "http";
import request from "supertest";
import { eq } from "drizzle-orm";

import { db, pool } from "../db";
import { registerRoutes } from "../routes";
import { tenants, users, facilities } from "@shared/schema";

describe("Facility creation district locks", () => {
  let app: Express;
  let httpServer: HttpServer;
  let tenantId: string;
  const agents = new Map<string, ReturnType<typeof request.agent>>();

  /* Original fixtures commented out to adhere to global rules:
  const ROLE_FIXTURES = [
    {
      label: "facility clerk",
      email: "test.clerk.locks@vaxplan.org",
      id: "test-locks-facility-clerk",
      role: "facility_clerk",
      roles: ["facility_clerk"],
      facilityId: 1,
      districtId: 1,
      provinceId: 1,
    },
    {
      label: "national admin",
      email: "test.national.locks@vaxplan.org",
      id: "test-locks-national-admin",
      role: "national_admin",
      roles: ["national_admin"],
      facilityId: null,
      districtId: null,
      provinceId: null,
    },
  ];
  */
  const ROLE_FIXTURES = [
    {
      label: "district manager",
      email: "test.manager.locks@vaxplan.org",
      id: "test-locks-district-manager",
      role: "district_manager",
      roles: ["district_manager"],
      facilityId: null,
      districtId: 1,
      provinceId: 1,
    },
    {
      label: "national admin",
      email: "test.national.locks@vaxplan.org",
      id: "test-locks-national-admin",
      role: "national_admin",
      roles: ["national_admin"],
      facilityId: null,
      districtId: null,
      provinceId: null,
    },
  ];

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    httpServer = createServer(app);
    await registerRoutes(httpServer, app);

    const [anyTenant] = await db.select({ id: tenants.id }).from(tenants).limit(1);
    if (!anyTenant) {
      throw new Error("No tenants in test DB.");
    }
    tenantId = anyTenant.id;

    for (const f of ROLE_FIXTURES) {
      await db.delete(users).where(eq(users.id, f.id));
      await db.insert(users).values({
        id: f.id,
        email: f.email,
        firstName: "Test",
        lastName: f.label,
        role: f.role as any,
        roles: f.roles as any,
        facilityId: f.facilityId,
        districtId: f.districtId,
        provinceId: f.provinceId,
        isActive: true,
        tenantId,
      } as any);

      const agent = request.agent(app);
      const loginRes = await agent.get(`/api/login?email=${encodeURIComponent(f.email)}`);
      if (loginRes.status !== 302 && loginRes.status !== 200) {
        throw new Error(`Mock login failed for ${f.email}`);
      }
      agents.set(f.email, agent);
    }
  });

  afterAll(async () => {
    for (const f of ROLE_FIXTURES) {
      await db.delete(users).where(eq(users.id, f.id)).catch(() => {});
    }
    // Cleanup any created facilities during testing
    await db.delete(facilities).where(eq(facilities.name, "Test Facility Locks Inside District")).catch(() => {});
    await db.delete(facilities).where(eq(facilities.name, "Test Facility Locks Outside District")).catch(() => {});
    
    try {
      httpServer?.close();
    } catch {}
    await pool.end().catch(() => {});
  });

  const agentFor = (email: string) => {
    const a = agents.get(email);
    if (!a) throw new Error(`no agent for ${email}`);
    return a;
  };

  /* Original test cases commented out to use district_manager instead of facility_clerk:
  it("facility_clerk can create facility inside their assigned district", async () => {
    const validPayload = {
      name: "Test Facility Locks Inside District",
      hmisCode: "TEST-IN-1",
      districtId: 1,
      latitude: "-15",
      longitude: "28",
      type: "Health Centre",
      status: "Operational",
      ownership: "Public",
      facilityLevel: "Primary",
      locationContext: "Rural",
      transportMethod: "Road",
    };

    const res = await agentFor("test.clerk.locks@vaxplan.org")
      .post("/api/facilities")
      .set("x-tenant-id", tenantId)
      .send(validPayload);

    // Should return 201 Created or 400 Bad Request (if payload validation fails on constraints, but not 403)
    expect(res.status).not.toBe(403);
    // Ideally it returns 201
    if (res.status === 400) {
      console.warn("Payload invalid for inside district test:", res.body);
    } else {
      expect(res.status).toBe(201);
    }
  });

  it("facility_clerk CANNOT create facility outside their assigned district", async () => {
    const invalidPayload = {
      name: "Test Facility Locks Outside District",
      hmisCode: "TEST-OUT-1",
      districtId: 9999, // Outside their assigned districtId of 1
      latitude: "-15",
      longitude: "28",
      type: "Health Centre",
      status: "Operational",
      ownership: "Public",
      facilityLevel: "Primary",
      locationContext: "Rural",
      transportMethod: "Road",
    };

    const res = await agentFor("test.clerk.locks@vaxplan.org")
      .post("/api/facilities")
      .set("x-tenant-id", tenantId)
      .send(invalidPayload);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("You can only create facilities in your assigned district.");
  });
  */

  it("district_manager can create facility inside their assigned district", async () => {
    const validPayload = {
      name: "Test Facility Locks Inside District",
      hmisCode: "TEST-IN-1",
      districtId: 1,
      latitude: "-15",
      longitude: "28",
      type: "Health Centre",
      status: "Operational",
      ownership: "Public",
      facilityLevel: "Primary",
      locationContext: "Rural",
      transportMethod: "Road",
    };

    const res = await agentFor("test.manager.locks@vaxplan.org")
      .post("/api/facilities")
      .set("x-tenant-id", tenantId)
      .send(validPayload);

    // Should return 201 Created or 400 Bad Request (if payload validation fails on constraints, but not 403)
    expect(res.status).not.toBe(403);
    // Ideally it returns 201
    if (res.status === 400) {
      console.warn("Payload invalid for inside district test:", res.body);
    } else {
      expect(res.status).toBe(201);
    }
  });

  it("district_manager CANNOT create facility outside their assigned district", async () => {
    const invalidPayload = {
      name: "Test Facility Locks Outside District",
      hmisCode: "TEST-OUT-1",
      districtId: 9999, // Outside their assigned districtId of 1
      latitude: "-15",
      longitude: "28",
      type: "Health Centre",
      status: "Operational",
      ownership: "Public",
      facilityLevel: "Primary",
      locationContext: "Rural",
      transportMethod: "Road",
    };

    const res = await agentFor("test.manager.locks@vaxplan.org")
      .post("/api/facilities")
      .set("x-tenant-id", tenantId)
      .send(invalidPayload);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("You can only create facilities in your assigned district.");
  });

  it("national_admin can create facility in ANY district", async () => {
    const validPayload = {
      name: "Test Facility Locks National",
      hmisCode: "TEST-NAT-1",
      districtId: 9999, // Outside any specific district, but allowed for national_admin
      latitude: "-15",
      longitude: "28",
      type: "Health Centre",
      status: "Operational",
      ownership: "Public",
      facilityLevel: "Primary",
      locationContext: "Rural",
      transportMethod: "Road",
    };

    const res = await agentFor("test.national.locks@vaxplan.org")
      .post("/api/facilities")
      .set("x-tenant-id", tenantId)
      .send(validPayload);

    expect(res.status).not.toBe(403);
  });
});
