import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express, { type Express } from "express";
import { createServer, type Server as HttpServer } from "http";
import request from "supertest";
import { eq } from "drizzle-orm";

import { db, pool } from "../db";
import { registerRoutes } from "../routes";
import { up as applyResearchHubSchema } from "../migrations/022-research-hub-schema";
import {
  researchDocuments,
  pilotActivities,
  downloadAssets,
  researchInterestSubmissions,
  researchDownloadEvents,
  tenants
} from "@shared/schema";

let app: Express;
let httpServer: HttpServer;
let adminAgent: ReturnType<typeof request.agent>;
let publicAgent: ReturnType<typeof request.agent>;
let activeTenantId: string;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  httpServer = createServer(app);
  await registerRoutes(httpServer, app);

  // Run research hub schema migration to ensure tables exist in the test DB
  await applyResearchHubSchema(db as any).catch((err) => {
    console.error("Failed to apply research hub schema migration:", err);
  });

  // Get an active tenant ID
  const [row] = await db.select({ id: tenants.id }).from(tenants).limit(1);
  activeTenantId = row?.id || "default-tenant-uuid";

  // Login as admin
  adminAgent = request.agent(app);
  const loginRes = await adminAgent.get("/api/login?email=dev.admin@vaxplan.org");
  if (loginRes.status !== 302 && loginRes.status !== 200) {
    throw new Error(`Admin login failed: ${loginRes.status}`);
  }

  // Create public agent
  publicAgent = request.agent(app);
});

afterAll(async () => {
  try {
    httpServer?.close();
  } catch {
    // ignore
  }
  await pool.end().catch(() => {});
});

describe("VaxPlan Research & Pilots Hub API Endpoints", () => {
  describe("GET /api/research/documents", () => {
    it("allows public user to view published documents", async () => {
      const res = await publicAgent.get("/api/research/documents").set("x-tenant-id", activeTenantId);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Public users should only see Published & Public documents
      res.body.forEach((doc: any) => {
        expect(doc.status).toBe("Published");
        expect(doc.visibility).toBe("Public");
      });
    });

    it("allows admin user to search all documents, including drafts", async () => {
      // First, create a draft document as admin
      const createRes = await adminAgent
        .post("/api/research/documents")
        .set("x-tenant-id", activeTenantId)
        .send({
          title: "Test Draft Document",
          slug: "test-draft-document-test",
          abstract: "Testing admin drafts visibility",
          documentType: "Research Papers",
          authors: "Test Author",
          organizations: "Test Org",
          year: 2026,
          status: "Draft",
          visibility: "Internal",
        });
      expect(createRes.status).toBe(210);
      const draftDocId = createRes.body.id;

      // Public users should NOT see this draft
      const pubRes = await publicAgent.get("/api/research/documents").set("x-tenant-id", activeTenantId);
      const foundInPub = pubRes.body.find((d: any) => d.id === draftDocId);
      expect(foundInPub).toBeUndefined();

      // Admin users should see this draft
      const adminRes = await adminAgent.get("/api/research/documents").set("x-tenant-id", activeTenantId);
      const foundInAdmin = adminRes.body.find((d: any) => d.id === draftDocId);
      expect(foundInAdmin).toBeDefined();
      expect(foundInAdmin.title).toBe("Test Draft Document");

      // Cleanup
      await db.delete(researchDocuments).where(eq(researchDocuments.id, draftDocId));
    });
  });

  describe("GET /api/research/documents/:id", () => {
    it("returns 403 for unauthorized access to drafts", async () => {
      // Create a draft document as admin
      const createRes = await adminAgent
        .post("/api/research/documents")
        .set("x-tenant-id", activeTenantId)
        .send({
          title: "Restricted Draft Document",
          slug: "restricted-draft-document-test",
          abstract: "Testing restricted detail access",
          documentType: "White Papers",
          authors: "Test Author",
          year: 2026,
          status: "Draft",
          visibility: "Restricted",
        });
      expect(createRes.status).toBe(210);
      const draftDocId = createRes.body.id;

      // Public request should return 403
      const res = await publicAgent.get(`/api/research/documents/${draftDocId}`).set("x-tenant-id", activeTenantId);
      expect(res.status).toBe(403);

      // Admin request should return 200
      const resAdmin = await adminAgent.get(`/api/research/documents/${draftDocId}`).set("x-tenant-id", activeTenantId);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.title).toBe("Restricted Draft Document");

      // Cleanup
      await db.delete(researchDocuments).where(eq(researchDocuments.id, draftDocId));
    });
  });

  describe("POST /api/research/submissions", () => {
    it("allows public user to submit collaboration interest form", async () => {
      const res = await publicAgent
        .post("/api/research/submissions")
        .set("x-tenant-id", activeTenantId)
        .send({
          fullName: "Dr. Jane Smith",
          organization: "WHO Representative Office",
          role: "EPI Consultant",
          email: "jane.smith@who.int",
          country: "Zambia",
          areaOfInterest: "Research collaboration",
          message: "Interested in the Morobe and Chibombo GIS mapping datasets.",
          consent: true,
        });

      expect(res.status).toBe(210);
      expect(res.body.id).toBeDefined();
      expect(res.body.fullName).toBe("Dr. Jane Smith");
      expect(res.body.status).toBe("pending");

      // Verify it's stored in the database
      const [stored] = await db
        .select()
        .from(researchInterestSubmissions)
        .where(eq(researchInterestSubmissions.id, res.body.id))
        .limit(1);
      expect(stored).toBeDefined();
      expect(stored.email).toBe("jane.smith@who.int");

      // Cleanup
      await db.delete(researchInterestSubmissions).where(eq(researchInterestSubmissions.id, res.body.id));
    });
  });

  describe("POST /api/research/download/:id", () => {
    it("increments download count and records a research download event", async () => {
      // Find a seeded document
      const [seededDoc] = await db
        .select()
        .from(researchDocuments)
        .where(eq(researchDocuments.slug, "vaxplan-white-paper"))
        .limit(1);
      expect(seededDoc).toBeDefined();

      const initialCount = seededDoc.downloadCount;

      const res = await publicAgent
        .post(`/api/research/download/${seededDoc.id}`)
        .set("x-tenant-id", activeTenantId)
        .send({ type: "document" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.newCount).toBe(initialCount + 1);

      // Verify DB was updated
      const [updatedDoc] = await db
        .select()
        .from(researchDocuments)
        .where(eq(researchDocuments.id, seededDoc.id))
        .limit(1);
      expect(updatedDoc.downloadCount).toBe(initialCount + 1);

      // Verify a download event was created
      const [event] = await db
        .select()
        .from(researchDownloadEvents)
        .where(eq(researchDownloadEvents.documentId, seededDoc.id))
        .limit(1);
      expect(event).toBeDefined();
      expect(event.ipHash).toBeDefined();

      // Cleanup event
      await db.delete(researchDownloadEvents).where(eq(researchDownloadEvents.id, event.id));
      // Revert download count
      await db
        .update(researchDocuments)
        .set({ downloadCount: initialCount })
        .where(eq(researchDocuments.id, seededDoc.id));
    });
  });
});
