import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { mapStylesRouter } from "../routes/mapStyles";

describe("Self-Hosted Map Styles & GIS Service", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/maps", mapStylesRouter);

  it("serves valid MapLibre v8 style for VaxPlan Light", async () => {
    const res = await request(app).get("/api/maps/styles/vaxplan-light/style.json");
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(8);
    expect(res.body.name).toBe("VaxPlan Light");
    expect(res.body.metadata["vaxplan:selfHosted"]).toBe(true);
    expect(res.body.sources["vaxplan-basemap-source"]).toBeDefined();
    expect(res.body.layers).toHaveLength(2);
    expect(res.headers["cache-control"]).toContain("public");
  });

  it("serves valid MapLibre v8 style for VaxPlan Streets", async () => {
    const res = await request(app).get("/api/maps/styles/vaxplan-streets/style.json");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("VaxPlan Streets");
  });

  it("serves valid MapLibre v8 style for VaxPlan Dark", async () => {
    const res = await request(app).get("/api/maps/styles/vaxplan-dark/style.json");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("VaxPlan Dark");
    expect(res.body.layers[0].paint["background-color"]).toBe("#0f172a");
  });

  it("returns 404 for an invalid styleId", async () => {
    const res = await request(app).get("/api/maps/styles/non-existent-style/style.json");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("STYLE_NOT_FOUND");
  });

  it("serves country map packages manifest", async () => {
    const res = await request(app).get("/api/maps/packages");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalPackages).toBeGreaterThanOrEqual(4);
    expect(res.body.packages.some((p: any) => p.countryCode === "ZAF")).toBe(true);
    expect(res.body.packages.some((p: any) => p.countryCode === "ZMB")).toBe(true);
  });
});
