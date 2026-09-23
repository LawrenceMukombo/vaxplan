import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { sql as dsql, eq } from "drizzle-orm";
import { storage } from "../storage";
import { insertStockTransactionSchema, catalogueVaccines, catalogueCommodities } from "@shared/schema";
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

// POST /api/stock/import — Bulk import stock ledger transactions from CSV / JSON
stockRouter.post("/import", isAuthenticated, requireTenant, loadRole, async (req: any, res) => {
  try {
    const { rows = [], defaultFacilityId } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No data rows provided for import" });
    }

    const scope = await getGeoScope(req.dbUser, req.tenantId);

    // Pre-fetch reference facilities
    const allFacilities = await storage.getFacilities(req.tenantId);
    const facById = new Map<number, any>();
    const facByName = new Map<string, any>();
    const facByHmis = new Map<string, any>();

    for (const f of allFacilities) {
      facById.set(f.id, f);
      if (f.name) facByName.set(f.name.toLowerCase().trim(), f);
      if (f.hmisCode) facByHmis.set(String(f.hmisCode).toLowerCase().trim(), f);
    }

    // Pre-fetch catalogue vaccines & commodities
    const vaccinesList = await db
      .select()
      .from(catalogueVaccines)
      .where(eq(catalogueVaccines.tenantId, req.tenantId));
    const commoditiesList = await db
      .select()
      .from(catalogueCommodities)
      .where(eq(catalogueCommodities.tenantId, req.tenantId));

    const prodById = new Map<number, { id: number; name: string; code?: string }>();
    const prodByName = new Map<string, { id: number; name: string; code?: string }>();

    for (const v of vaccinesList) {
      prodById.set(v.id, { id: v.id, name: v.name, code: v.productId || v.name });
      prodByName.set(v.name.toLowerCase().trim(), { id: v.id, name: v.name, code: v.productId || v.name });
      if (v.productId) prodByName.set(v.productId.toLowerCase().trim(), { id: v.id, name: v.name, code: v.productId });
    }

    for (const c of commoditiesList) {
      const cid = 10000 + c.id;
      prodById.set(cid, { id: cid, name: c.name, code: c.commodityCode || c.name });
      prodByName.set(c.name.toLowerCase().trim(), { id: cid, name: c.name, code: c.commodityCode || c.name });
      if (c.commodityCode) prodByName.set(c.commodityCode.toLowerCase().trim(), { id: cid, name: c.name, code: c.commodityCode });
    }

    const validResults: any[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;

      // 1. Resolve facility
      let targetFac: any = null;
      const rawFacId = r.facilityId !== undefined && r.facilityId !== "" ? parseInt(String(r.facilityId), 10) : undefined;
      if (rawFacId && !isNaN(rawFacId) && facById.has(rawFacId)) {
        targetFac = facById.get(rawFacId);
      }

      if (!targetFac) {
        const rawHmis = r.facilityHmisCode || r.hmisCode || r.hmis;
        if (rawHmis && facByHmis.has(String(rawHmis).toLowerCase().trim())) {
          targetFac = facByHmis.get(String(rawHmis).toLowerCase().trim());
        }
      }

      if (!targetFac) {
        const rawName = r.facilityName || r.facility;
        if (rawName && facByName.has(String(rawName).toLowerCase().trim())) {
          targetFac = facByName.get(String(rawName).toLowerCase().trim());
        }
      }

      if (!targetFac && defaultFacilityId) {
        const defId = parseInt(String(defaultFacilityId), 10);
        if (!isNaN(defId) && facById.has(defId)) {
          targetFac = facById.get(defId);
        }
      }

      if (!targetFac) {
        errors.push({ row: rowNum, error: `Could not identify facility for "${r.facilityName || r.facility || r.facilityId || "Unknown"}"` });
        continue;
      }

      // Check geo scope
      if (!scope.all && scope.facilityIds && !scope.facilityIds.has(targetFac.id)) {
        errors.push({ row: rowNum, error: `Unauthorized to post stock for facility "${targetFac.name}" (ID ${targetFac.id})` });
        continue;
      }

      // 2. Resolve Product
      let targetProd: { id: number; name: string; code?: string } | null = null;
      const rawProdId = r.productId !== undefined && r.productId !== "" ? parseInt(String(r.productId), 10) : undefined;
      if (rawProdId && !isNaN(rawProdId) && prodById.has(rawProdId)) {
        targetProd = prodById.get(rawProdId)!;
      }

      if (!targetProd) {
        const rawProdName = r.vaccineName || r.productName || r.productCode || r.product || r.antigen;
        if (rawProdName) {
          const key = String(rawProdName).toLowerCase().trim();
          if (prodByName.has(key)) {
            targetProd = prodByName.get(key)!;
          } else {
            // Partial match fallback
            Array.from(prodByName.entries()).forEach(([pName, prod]) => {
              if (!targetProd && (pName.includes(key) || key.includes(pName))) {
                targetProd = prod;
              }
            });
          }
        }
      }

      if (!targetProd) {
        // Fallback to first available vaccine or default
        if (vaccinesList.length > 0) {
          const v0 = vaccinesList[0];
          targetProd = { id: v0.id, name: v0.name, code: v0.productId || v0.name };
        } else {
          targetProd = { id: 1, name: r.vaccineName || "Standard Vaccine", code: "VAX-01" };
        }
      }

      // 3. Resolve Transaction Type
      const rawType = String(r.transactionType || r.type || "receipt").toLowerCase().trim();
      let txType = "receipt";
      if (["issue", "dispense", "dispatch"].includes(rawType)) txType = "issue";
      else if (["loss", "waste", "wastage", "damaged", "expired"].includes(rawType)) txType = "loss";
      else if (["adjustment", "correction"].includes(rawType)) txType = "adjustment";
      else if (["physical_count", "count", "audit"].includes(rawType)) txType = "physical_count";

      // 4. Quantity
      const rawQty = r.quantityDoses ?? r.quantity ?? r.doses ?? r.qty;
      const parsedQty = Math.abs(parseInt(String(rawQty), 10));
      if (isNaN(parsedQty) || parsedQty <= 0) {
        errors.push({ row: rowNum, error: `Invalid quantity "${rawQty}" (must be a positive integer)` });
        continue;
      }

      // 5. Expiry Date
      let cleanExp = new Date("2099-12-31T00:00:00.000Z");
      if (r.expiryDate) {
        const d = new Date(r.expiryDate);
        if (!isNaN(d.getTime())) cleanExp = d;
      }

      // 6. Transaction Date
      let cleanTxDate = new Date();
      if (r.transactionDate) {
        const d = new Date(r.transactionDate);
        if (!isNaN(d.getTime())) cleanTxDate = d;
      }

      // 7. VVM Status
      let vvmStatus = 1;
      const rawVvm = parseInt(String(r.vvmStatus ?? 1), 10);
      if (!isNaN(rawVvm) && rawVvm >= 1 && rawVvm <= 4) {
        vvmStatus = rawVvm;
      }

      // 8. Batch
      const batchNumber = String(r.batchNumber || r.batch || "BATCH-" + Math.floor(100000 + Math.random() * 900000)).trim();

      // 9. Supplier / Recipient
      const supplierOrRecipient = r.supplierOrRecipient || r.supplier || r.recipient || (txType === "receipt" ? "National Medical Store" : "Outreach Clinic");

      // 10. Notes
      const notes = r.notes || r.reason || `Imported via Stock Ledger Bulk Importer on ${new Date().toISOString().slice(0, 10)}`;

      // Insert record
      const created = await storage.createStockTransaction(req.tenantId, {
        tenantId: req.tenantId,
        facilityId: targetFac.id,
        productId: targetProd.id,
        productCode: targetProd.code || targetProd.name,
        vaccineName: targetProd.name,
        transactionType: txType,
        quantityDoses: parsedQty,
        batchNumber,
        expiryDate: cleanExp,
        vvmStatus,
        supplierOrRecipient,
        transactionDate: cleanTxDate,
        notes,
        recordedByUserId: req.user?.id ?? req.user?.claims?.sub ?? null,
      });

      validResults.push(created);
    }

    if (validResults.length > 0) {
      await logAudit(req, "import_stock_transactions", "stock_transaction", validResults[0].id, null, {
        importedCount: validResults.length,
        errorCount: errors.length,
      });
    }

    res.json({
      success: true,
      message: `Successfully imported ${validResults.length} stock ledger transaction${validResults.length !== 1 ? "s" : ""}.`,
      importedCount: validResults.length,
      errors,
    });
  } catch (err: any) {
    console.error("POST /api/stock/import failed:", err);
    res.status(500).json({ message: safeErrorMessage(err, "Failed to import stock ledger transactions") });
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
