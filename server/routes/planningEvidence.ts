import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { pool } from "../db";
import { isAuthenticated } from "../auth";
import { requireTenant } from "../auth/tenantResolver";
import { requireDbUser } from "../auth/loadDbUser";
import { ensureTenantRolesCache, hasPermission } from "../auth/authorization";
import { extensionKinds, extensionSchemas, type ExtensionKind } from "../../shared/planningExtensions";

export const planningEvidenceRouter = Router();
planningEvidenceRouter.use(isAuthenticated, requireTenant, requireDbUser);
const input = z.object({ facilityId: z.number().int().positive(), kind: z.enum(extensionKinds), microplanId: z.number().int().positive().nullable().default(null), payload: z.record(z.unknown()), requestId: z.string().uuid().optional(), version: z.number().int().positive().optional() }).strict();
const present = (row: any) => ({ id: row.id, tenantId: row.tenant_id, facilityId: row.facility_id, microplanId: row.microplan_id, kind: row.kind, payload: row.payload, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at });
async function permitted(req: any, facilityId: number, kind: ExtensionKind, write = false) {
  const facility = await pool.query("SELECT f.district_id,d.province_id FROM facilities f JOIN districts d ON d.id=f.district_id WHERE f.id=$1 AND f.tenant_id=$2", [facilityId, req.tenantId]);
  if (!facility.rows.length) return false;
  await ensureTenantRolesCache(req.tenantId);
  const context = { facilityId, districtId: facility.rows[0].district_id, provinceId: facility.rows[0].province_id, activeTenantId: req.tenantId };
  if (write && kind === "target_group") return req.dbUser.isPlatformAdmin === true || req.dbUser.role === "national_admin" || req.dbUser.roles?.includes("national_admin");
  const permissions = kind === "finance" ? (write ? ["manage_budget"] : ["view_budget"]) : kind === "household_assessment" ? (write ? ["client_logbook.create"] : ["client_logbook.view"]) : write ? ["microplans.update_draft", "microplans.review"] : ["microplans.view"];
  return permissions.some(permission => hasPermission(req.dbUser, permission, context));
}
function fail(res: any, error: any) {
  if (error.code === "42P01") return res.status(503).json({ message: "Planning evidence is not enabled yet. Apply the additive planning-evidence migration." });
  console.error("Planning evidence operation failed", error.code || error.name);
  return res.status(500).json({ message: "Unable to load or save planning evidence" });
}
planningEvidenceRouter.get("/", async (req: any, res) => {
  const facilityId = Number(req.query.facilityId);
  const kind = z.enum(extensionKinds).safeParse(req.query.kind);
  if (!Number.isSafeInteger(facilityId) || facilityId < 1 || !kind.success) return res.status(400).json({ message: "Select a facility and evidence type" });
  try {
    if (!await permitted(req, facilityId, kind.data)) return res.status(403).json({ message: "Evidence access denied" });
    const records = kind.data === "target_group"
      ? await pool.query("SELECT * FROM planning_evidence WHERE tenant_id=$1 AND kind=$2 ORDER BY updated_at DESC", [req.tenantId, kind.data])
      : await pool.query("SELECT * FROM planning_evidence WHERE tenant_id=$1 AND facility_id=$2 AND kind=$3 ORDER BY updated_at DESC", [req.tenantId, facilityId, kind.data]);
    res.json({ records: records.rows.map(present), canWrite: await permitted(req, facilityId, kind.data, true) });
  } catch (error) { fail(res, error); }
});
planningEvidenceRouter.get("/:id/history", async (req: any, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ message: "Invalid record ID" });
  try {
    const record = await pool.query("SELECT * FROM planning_evidence WHERE id=$1 AND tenant_id=$2", [req.params.id, req.tenantId]);
    if (!record.rows.length) return res.status(404).json({ message: "Evidence not found" });
    if (!await permitted(req, record.rows[0].facility_id, record.rows[0].kind)) return res.status(403).json({ message: "Evidence access denied" });
    const result = await pool.query("SELECT version,payload,changed_at,changed_by FROM planning_evidence_history WHERE evidence_id=$1 ORDER BY version DESC", [req.params.id]);
    res.json(result.rows);
  } catch (error) { fail(res, error); }
});
async function save(req: any, res: any) {
  const parsed = input.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid evidence record" });
  const { facilityId, kind, microplanId, version } = parsed.data;
  const valid = extensionSchemas[kind].safeParse(parsed.data.payload);
  if (!valid.success) return res.status(400).json({ message: valid.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") });
  const payload = valid.data as Record<string, any>;
  const id = req.params.id || parsed.data.requestId || randomUUID();
  if (!z.string().uuid().safeParse(id).success) return res.status(400).json({ message: "Invalid evidence ID" });
  let connection;
  try {
    if (!await permitted(req, facilityId, kind, true)) return res.status(403).json({ message: "Evidence write permission denied" });
    connection = await pool.connect(); await connection.query("BEGIN");
    const reject = async (status: number, message: string) => { await connection!.query("ROLLBACK"); return res.status(status).json({ message }); };
    if (kind === "red_microplanning" && !microplanId) return await reject(400, "Save a microplan before adding a RED worksheet");
    if (microplanId) {
      const plan = await connection.query("SELECT id,status FROM microplans WHERE id=$1 AND tenant_id=$2 AND facility_id=$3", [microplanId, req.tenantId, facilityId]);
      if (!plan.rows.length) return await reject(400, "Microplan must belong to this facility");
      if (kind === "red_microplanning" && plan.rows[0].status !== "draft") return await reject(409, "RED worksheets can only be edited while the microplan is a draft");
    }
    if (kind === "population_estimate") {
      const group = await connection.query("SELECT payload FROM planning_evidence WHERE id=$1 AND tenant_id=$2 AND kind='target_group'", [payload.targetGroupId, req.tenantId]);
      if (!group.rows.length || group.rows[0].payload.status !== "active") return await reject(400, "Select an active target group from this country");
    }
    if (kind === "finance" || kind === "service_review") {
      const table = kind === "finance" ? "budget_items" : "session_plans";
      const sourceId = kind === "finance" ? payload.budgetItemId : payload.sessionId;
      const source = await connection.query(`SELECT id FROM ${table} WHERE id=$1 AND tenant_id=$2 AND facility_id=$3`, [sourceId, req.tenantId, facilityId]);
      if (!source.rows.length) return await reject(400, "Linked record must belong to this facility");
    }
    let result;
    if (!req.params.id && parsed.data.requestId) {
      const existing = await connection.query("SELECT * FROM planning_evidence WHERE id=$1 AND tenant_id=$2 AND facility_id=$3 AND kind=$4", [id, req.tenantId, facilityId, kind]);
      if (existing.rows.length) {
        if (!isDeepStrictEqual(existing.rows[0].payload, payload) || existing.rows[0].microplan_id !== microplanId) return await reject(409, "This request was already saved with different content. Reload the records.");
        await connection.query("COMMIT"); return res.json(present(existing.rows[0]));
      }
    }
    if (req.params.id) {
      const previous = await connection.query("SELECT * FROM planning_evidence WHERE id=$1 AND tenant_id=$2 AND facility_id=$3 AND kind=$4 FOR UPDATE", [id, req.tenantId, facilityId, kind]);
      if (!previous.rows.length) return await reject(404, "Evidence not found");
      if (kind === "red_microplanning" && previous.rows[0].microplan_id !== microplanId) return await reject(409, "RED worksheets cannot be moved between microplans");
      if (previous.rows[0].version !== version) return await reject(409, "Evidence has changed. Reload it before saving.");
      if (kind === "finance" && !payload.correctionReason) return await reject(400, "Explain the financial correction. The previous revision will remain in history.");
      if (kind === "target_group" && ["active", "retired"].includes(previous.rows[0].payload.status)) {
        const old = previous.rows[0].payload;
        if (payload.status === "draft" || (old.status === "retired" && payload.status !== "retired")) return await reject(400, "Published group definitions cannot return to draft or be reactivated after retirement");
        if (["minimumAgeMonths", "maximumAgeMonths", "sex", "eligibility"].some(key => old[key] !== payload[key])) return await reject(400, "Retire this definition and create a new group to preserve historical estimates");
      }
      result = await connection.query("UPDATE planning_evidence SET payload=$1,microplan_id=$2,version=version+1,updated_at=now(),updated_by=$3 WHERE id=$4 RETURNING *", [payload, microplanId, req.dbUser.id, id]);
    } else {
      result = await connection.query("INSERT INTO planning_evidence(id,tenant_id,facility_id,kind,microplan_id,payload,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *", [id, req.tenantId, facilityId, kind, microplanId, payload, req.dbUser.id]);
    }
    const row = result.rows[0];
    await connection.query("INSERT INTO planning_evidence_history(evidence_id,version,payload,changed_by) VALUES($1,$2,$3,$4)", [id, row.version, { ...row.payload, microplanId }, req.dbUser.id]);
    await connection.query("COMMIT"); res.status(req.params.id ? 200 : 201).json(present(row));
  } catch (error) { if (connection) await connection.query("ROLLBACK").catch(() => {}); fail(res, error); }
  finally { connection?.release(); }
}
planningEvidenceRouter.post("/", save);
planningEvidenceRouter.put("/:id", save);
