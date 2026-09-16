import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { sql as dsql } from "drizzle-orm";
import { storage } from "../storage";
import { insertStockTransactionSchema } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { requireTenant } from "../auth/tenantResolver";
import { requireDbUser } from "../auth/loadDbUser";
import { safeErrorMessage } from "../errorUtils";
import { logAudit, getGeoScope, recordInGeoScope } from "../routes";

export const stockRouter = Router();
const auth = [isAuthenticated, requireTenant, requireDbUser] as const;

async function loadRole(req: any, _res: any, next: any) {
  if (req.user?.dbRole) return next();
  try {
    const u = req.dbUser ?? (await storage.getUser(req.user.claims.sub));
    req.user.dbRole = u?.role;
  } catch {}
  next();
}

// ─── AI Predictive Stock Logistics (Task Layer 4) ────────────────────────
// GET /api/stock/predictive-forecast (Evaluates stock trajectories, cold chain volume, and outreach surge)
stockRouter.get("/predictive-forecast", ...auth, async (req: any, res) => {
  try {
    const facilityId = req.query.facilityId ? parseInt(req.query.facilityId, 10) : undefined;
    const antigen = req.query.antigen ? String(req.query.antigen) : undefined;
    const daysAhead = req.query.daysAhead ? parseInt(req.query.daysAhead, 10) : 60;

    const { getPredictiveStockForecast } = await import("../services/aiStockPredictorService");

    // If facilityId specified, return detailed single-facility forecast
    if (facilityId) {
      const forecast = await getPredictiveStockForecast(req.tenantId, facilityId, { antigen, daysAhead });
      if (!forecast) return res.status(404).json({ message: "Facility not found or inactive" });
      return res.json(forecast);
    }

    // Otherwise evaluate all active tenant facilities and return summary list
    const facRows = await db.execute(dsql`
      SELECT id, name FROM facilities WHERE tenant_id = ${req.tenantId} AND is_active = true ORDER BY name ASC LIMIT 25
    `);
    const allFacs = (facRows as any).rows ?? [];
    const reports = await Promise.all(
      allFacs.map((f: any) => getPredictiveStockForecast(req.tenantId, f.id, { antigen, daysAhead }))
    );

    const validReports = reports.filter(Boolean);
    res.json({
      totalFacilitiesAnalyzed: validReports.length,
      criticalRiskCount: validReports.filter((r: any) => r.overallRisk === "critical").length,
      highRiskCount: validReports.filter((r: any) => r.overallRisk === "high").length,
      facilityReports: validReports,
    });
  } catch (err: any) {
    console.error("GET /api/stock/predictive-forecast error:", err);
    res.status(500).json({ message: safeErrorMessage(err, "Failed to compute predictive stock forecast") });
  }
});

// ─── Stock Ledger Transactions — WHO RED stock card transactions ────────────
// GET /api/stock/ledger — Fetch stock ledger card history for a facility
stockRouter.get("/ledger", ...auth, async (req: any, res) => {
  try {
    const facilityIdRaw = req.query.facilityId as string | undefined;
    const districtIdRaw = req.query.districtId as string | undefined;
    const provinceIdRaw = req.query.provinceId as string | undefined;
    const productIdRaw = req.query.productId as string | undefined;

    const facilityId = facilityIdRaw ? parseInt(facilityIdRaw) : undefined;
    const districtId = districtIdRaw ? parseInt(districtIdRaw) : undefined;
    const provinceId = provinceIdRaw ? parseInt(provinceIdRaw) : undefined;
    const productId = productIdRaw ? parseInt(productIdRaw) : undefined;

    if (facilityIdRaw && (facilityId === undefined || isNaN(facilityId))) {
      return res.status(400).json({ message: "Invalid facility ID parameter" });
    }
    if (productIdRaw && (productId === undefined || isNaN(productId))) {
      return res.status(400).json({ message: "Invalid product ID parameter" });
    }

    let list = await storage.getStockTransactions(req.tenantId, facilityId, productId);
    const scope = await getGeoScope(req.dbUser, req.tenantId);

    let geoMaps: any = null;
    if (provinceId || districtId) {
      const allFacilities = await storage.getFacilities(req.tenantId);
      const allDistricts = await storage.getDistricts(req.tenantId);
      const districtMap = new Map(allDistricts.map((d) => [d.id, d]));
      geoMaps = { allFacilities, districtMap };
    }

    list = list.filter((t: any) => {
      if (!recordInGeoScope(scope, { facilityId: t.facilityId })) return false;

      if (geoMaps) {
        const fac = geoMaps.allFacilities.find((f: any) => f.id === t.facilityId);
        if (!fac) return false;
        if (districtId && fac.districtId !== districtId) return false;
        if (provinceId) {
          const dist = geoMaps.districtMap.get(fac.districtId);
          if (!dist || dist.provinceId !== provinceId) return false;
        }
      }
      return true;
    });

    res.json(list);
  } catch (err: any) {
    console.error("GET /api/stock/ledger failed:", err);
    res.status(500).json({ message: "Failed to fetch stock transactions" });
  }
});

// POST /api/stock/transaction — Log a stock ledger card transaction (receipt, issue, loss, adjustment)
stockRouter.post("/transaction", isAuthenticated, requireTenant, loadRole, async (req: any, res) => {
  try {
    const rawExp = req.body.expiryDate;
    const cleanExp = rawExp && !isNaN(new Date(rawExp).getTime()) ? new Date(rawExp) : new Date("2099-12-31T00:00:00.000Z");

    const payload = {
      ...req.body,
      tenantId: req.tenantId,
      batchNumber: req.body.batchNumber ? String(req.body.batchNumber) : "N/A",
      expiryDate: cleanExp,
      vvmStatus: typeof req.body.vvmStatus === "number" ? req.body.vvmStatus : 1,
      transactionDate:
        req.body.transactionDate && !isNaN(new Date(req.body.transactionDate).getTime())
          ? new Date(req.body.transactionDate)
          : new Date(),
    };

    const parsed = insertStockTransactionSchema.parse(payload);

    const scope = await getGeoScope(req.dbUser, req.tenantId);
    if (!scope.all && scope.facilityIds && !scope.facilityIds.has(parsed.facilityId)) {
      return res.status(403).json({ message: "Not authorized to post transactions for this facility." });
    }
    const transaction = await storage.createStockTransaction(req.tenantId, {
      ...parsed,
      recordedByUserId: req.user?.id ?? req.user?.claims?.sub ?? null,
    });
    await logAudit(req, "create_stock_transaction", "stock_transaction", transaction.id, null, {
      facilityId: transaction.facilityId,
      productId: transaction.productId,
      transactionType: transaction.transactionType,
      quantityDoses: transaction.quantityDoses,
    });
    res.status(201).json(transaction);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid payload details", errors: err.errors });
    }
    console.error("POST /api/stock/transaction failed:", err);
    res.status(500).json({ message: "Failed to register stock transaction" });
  }
});

// POST /api/stock/transfer — Atomically record a paired issue (source) + receipt (dest)
stockRouter.post("/transfer", isAuthenticated, requireTenant, async (req: any, res) => {
  try {
    const transferSchema = z.object({
      sourceFacilityId: z.number().int().positive(),
      destFacilityId: z.number().int().positive(),
      productId: z.number().int().positive(),
      batchNumber: z.string().min(1),
      expiryDate: z.string().min(1),
      vvmStatus: z.number().int().min(1).max(4).default(1),
      quantityDoses: z.number().int().positive(),
      sourceFacilityName: z.string().optional(),
      destFacilityName: z.string().optional(),
      reason: z.string().optional(),
    });
    const parsed = transferSchema.parse(req.body);
    if (parsed.sourceFacilityId === parsed.destFacilityId) {
      return res.status(400).json({ message: "Source and destination facilities must differ" });
    }
    const sourceName = parsed.sourceFacilityName ?? `Facility ${parsed.sourceFacilityId}`;
    const destName = parsed.destFacilityName ?? `Facility ${parsed.destFacilityId}`;
    const reason = parsed.reason ?? "Suggested transfer (batch near expiry)";

    const pair = await storage.createStockTransferPair(req.tenantId, {
      sourceFacilityId: parsed.sourceFacilityId,
      destFacilityId: parsed.destFacilityId,
      productId: parsed.productId,
      batchNumber: parsed.batchNumber,
      expiryDate: new Date(parsed.expiryDate),
      vvmStatus: parsed.vvmStatus,
      quantityDoses: parsed.quantityDoses,
      sourceSupplierOrRecipient: destName,
      destSupplierOrRecipient: sourceName,
      sourceNotes: `Transfer to ${destName}: ${reason}`,
      destNotes: `Transfer from ${sourceName}: ${reason}`,
      recordedByUserId: req.user?.id ?? req.user?.claims?.sub ?? null,
    });

    await logAudit(req, "create_stock_transfer", "stock_transaction", pair.issue.id, null, {
      sourceFacilityId: parsed.sourceFacilityId,
      destFacilityId: parsed.destFacilityId,
      productId: parsed.productId,
      batchNumber: parsed.batchNumber,
      quantityDoses: parsed.quantityDoses,
      issueId: pair.issue.id,
      receiptId: pair.receipt.id,
    });

    res.status(201).json(pair);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid payload details", errors: err.errors });
    }
    console.error("POST /api/stock/transfer failed:", err);
    res.status(500).json({ message: "Failed to record stock transfer" });
  }
});

// DELETE /api/stock/transaction/:id — Revert/delete a stock card entry
stockRouter.delete("/transaction/:id", isAuthenticated, requireTenant, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid transaction ID" });
    const deleted = await storage.deleteStockTransaction(req.tenantId, id);
    if (!deleted) return res.status(404).json({ message: "Stock transaction entry not found" });
    await logAudit(req, "delete_stock_transaction", "stock_transaction", id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/stock/transaction/:id failed:", err);
    res.status(500).json({ message: "Failed to revert stock transaction" });
  }
});

export default stockRouter;
