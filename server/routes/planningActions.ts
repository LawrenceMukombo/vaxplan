import { Router } from "express";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { pool } from "../db";
import { isAuthenticated } from "../auth";
import { requireTenant } from "../auth/tenantResolver";
import { requireDbUser } from "../auth/loadDbUser";
import { ensureTenantRolesCache, hasPermission } from "../auth/authorization";
import { canTransitionAction, planningActionSchema } from "../../shared/planningActions";

export const planningActionsRouter = Router();
planningActionsRouter.use(isAuthenticated, requireTenant, requireDbUser);
const envelope = z.object({ facilityId: z.number().int().positive(), action: planningActionSchema, requestId: z.string().uuid().optional(), version: z.number().int().positive().optional() }).strict();
const present = (row: any) => ({ ...row.payload, id: row.id, tenantId: row.tenant_id, facilityId: row.facility_id, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, updatedBy: row.updated_by });

async function allowed(req: any, facilityId: number, write = false, verify = false) {
  const { rows } = await pool.query("SELECT f.id, f.district_id, d.province_id FROM facilities f JOIN districts d ON d.id=f.district_id WHERE f.id=$1 AND f.tenant_id=$2", [facilityId, req.tenantId]);
  if (!rows.length) return false;
  await ensureTenantRolesCache(req.tenantId);
  const context = { facilityId, districtId: rows[0].district_id, provinceId: rows[0].province_id, activeTenantId: req.tenantId };
  const permissions = verify ? ["microplans.review"] : write ? ["microplans.update_draft", "microplans.review"] : ["microplans.view"];
  return permissions.some(permission => hasPermission(req.dbUser, permission, context));
}
function failure(res: any, error: any) {
  if (error.code === "42P01") return res.status(503).json({ message: "The action register has not been enabled. Apply the additive planning-actions migration." });
  console.error("Planning action operation failed", error.code || error.name);
  return res.status(500).json({ message: "Unable to save or load planning actions. Please retry." });
}

planningActionsRouter.get("/", async (req: any, res) => {
  const facilityId = Number(req.query.facilityId);
  if (!Number.isSafeInteger(facilityId) || facilityId < 1) return res.status(400).json({ message: "Select a facility" });
  try {
    if (!await allowed(req, facilityId)) return res.status(403).json({ message: "Facility access denied" });
    const { rows } = await pool.query("SELECT * FROM planning_actions WHERE tenant_id=$1 AND facility_id=$2 ORDER BY updated_at DESC", [req.tenantId, facilityId]);
    res.json({ actions: rows.map(present), canWrite: await allowed(req, facilityId, true), canVerify: await allowed(req, facilityId, true, true) });
  } catch (error) { failure(res, error); }
});

planningActionsRouter.get("/summary/facilities", async (req: any, res) => {
  const ids = String(req.query.facilityIds || "").split(",").filter(Boolean).map(Number);
  if (!ids.length || ids.length > 1000 || ids.some(id => !Number.isSafeInteger(id) || id < 1)) return res.status(400).json({ message: "Select up to 1000 valid facilities" });
  try {
    const roles = new Set([req.dbUser.role, ...(Array.isArray(req.dbUser.roles) ? req.dbUser.roles : [])]);
    const unrestricted = req.dbUser.isPlatformAdmin === true || roles.has("national_admin");
    const permittedIds: number[] = unrestricted ? ids : [];
    if (!unrestricted) {
      for (let offset = 0; offset < ids.length; offset += 20) {
        const batch = ids.slice(offset, offset + 20);
        const checks = await Promise.all(batch.map(async id => ({ id, ok: await allowed(req, id) })));
        permittedIds.push(...checks.filter(check => check.ok).map(check => check.id));
      }
    }
    if (!permittedIds.length) return res.json({ facilities: {} });
    const { rows } = await pool.query("SELECT facility_id,payload FROM planning_actions WHERE tenant_id=$1 AND facility_id=ANY($2::int[])", [req.tenantId, permittedIds]);
    const facilities: Record<string, { recorded: number; assigned: number; completed: number; verified: number; overdue: number; blocked: number }> = {};
    const today = new Date().toISOString().slice(0, 10);
    for (const id of permittedIds) facilities[id] = { recorded: 0, assigned: 0, completed: 0, verified: 0, overdue: 0, blocked: 0 };
    for (const row of rows) {
      const item = facilities[row.facility_id]; const action = row.payload || {};
      item.recorded += 1;
      if (action.owner && action.dueDate) item.assigned += 1;
      if (["completed", "verified"].includes(action.status)) item.completed += 1;
      if (action.status === "verified") item.verified += 1;
      if (action.status === "blocked") item.blocked += 1;
      if (action.dueDate && action.dueDate < today && !["completed", "verified", "cancelled"].includes(action.status)) item.overdue += 1;
    }
    res.json({ facilities });
  } catch (error) { failure(res, error); }
});

planningActionsRouter.get("/:id/history", async (req: any, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ message: "Invalid action ID" });
  try {
    const { rows } = await pool.query("SELECT facility_id FROM planning_actions WHERE id=$1 AND tenant_id=$2", [req.params.id, req.tenantId]);
    if (!rows.length) return res.status(404).json({ message: "Action not found" });
    if (!await allowed(req, rows[0].facility_id)) return res.status(403).json({ message: "Facility access denied" });
    const history = await pool.query("SELECT version, payload, changed_at, changed_by FROM planning_action_history WHERE action_id=$1 ORDER BY version DESC", [req.params.id]);
    res.json(history.rows);
  } catch (error) { failure(res, error); }
});

async function save(req: any, res: any) {
  const parsed = envelope.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues.map(issue => issue.message).join("; ") });
  const { facilityId, action, version } = parsed.data;
  const id = req.params.id || parsed.data.requestId || randomUUID();
  if (!z.string().uuid().safeParse(id).success) return res.status(400).json({ message: "Invalid action ID" });
  let connection;
  try {
    if (!await allowed(req, facilityId, true, action.status === "verified")) return res.status(403).json({ message: "Action permission denied" });
    connection = await pool.connect();
    await connection.query("BEGIN");
    const abort = async (status: number, message: string) => { await connection!.query("ROLLBACK"); return res.status(status).json({ message }); };
    if (action.evidenceId) {
      const evidence = await connection.query("SELECT id,kind FROM planning_evidence WHERE id=$1 AND tenant_id=$2 AND facility_id=$3", [action.evidenceId, req.tenantId, facilityId]);
      if (!evidence.rows.length) return await abort(400, "Evidence must belong to this facility");
      if (["consultation", "barrier"].includes(action.sourceType) && evidence.rows[0].kind !== action.sourceType) return await abort(400, "Evidence type does not match the action source");
    }
    if (action.microplanId) {
      const plan = await connection.query("SELECT id FROM microplans WHERE id=$1 AND tenant_id=$2 AND facility_id=$3", [action.microplanId, req.tenantId, facilityId]);
      if (!plan.rows.length) return await abort(400, "Microplan must belong to this facility");
    }
    if (action.communityId) {
      const community = await connection.query("SELECT id FROM villages WHERE id=$1 AND tenant_id=$2 AND assigned_facility_id=$3", [action.communityId, req.tenantId, facilityId]);
      if (!community.rows.length) return await abort(400, "Community must belong to this facility");
    }
    if (action.sourceId) {
      const table = action.sourceType === "supervision" ? "supervision_visits" : action.sourceType === "microplan" ? "microplans" : "quarterly_reviews";
      const source = await connection.query(`SELECT id FROM ${table} WHERE id=$1 AND tenant_id=$2 AND facility_id=$3`, [action.sourceId, req.tenantId, facilityId]);
      if (!source.rows.length) return await abort(400, "Source must belong to the same facility and country");
    }
    let result;
    if (!req.params.id && parsed.data.requestId) {
      const existing = await connection.query("SELECT * FROM planning_actions WHERE id=$1 AND tenant_id=$2 AND facility_id=$3", [id, req.tenantId, facilityId]);
      if (existing.rows.length) {
        if (!isDeepStrictEqual(existing.rows[0].payload, action)) return await abort(409, "This request was already saved with different content. Reload the register.");
        await connection.query("COMMIT"); return res.json(present(existing.rows[0]));
      }
    }
    if (req.params.id) {
      const old = await connection.query("SELECT * FROM planning_actions WHERE id=$1 AND tenant_id=$2 AND facility_id=$3 FOR UPDATE", [id, req.tenantId, facilityId]);
      if (!old.rows.length) return await abort(404, "Action not found");
      const previous = old.rows[0];
      if (version !== previous.version) return await abort(409, "This action changed. Reload it before saving.");
      if (!canTransitionAction(previous.payload.status, action.status)) return await abort(400, "Invalid action status transition");
      if (previous.payload.sourceType !== action.sourceType || previous.payload.sourceId !== action.sourceId || (previous.payload.evidenceId || null) !== action.evidenceId) return await abort(400, "The original action source cannot be changed");
      if (action.status === "verified" && previous.updated_by === req.dbUser.id) return await abort(403, "A different reviewer must verify completion");
      if (previous.payload.status === "verified" && action.status === "verified") return await abort(400, "Reopen a verified action before editing it");
      result = await connection.query("UPDATE planning_actions SET payload=$1, version=version+1, updated_at=now(), updated_by=$2 WHERE id=$3 RETURNING *", [JSON.stringify(action), req.dbUser.id, id]);
    } else {
      if (!["proposed", "agreed"].includes(action.status)) return await abort(400, "New actions must be proposed or agreed");
      result = await connection.query("INSERT INTO planning_actions(id,tenant_id,facility_id,payload,updated_by) VALUES($1,$2,$3,$4,$5) RETURNING *", [id, req.tenantId, facilityId, JSON.stringify(action), req.dbUser.id]);
    }
    const row = result.rows[0];
    await connection.query("INSERT INTO planning_action_history(action_id,version,payload,changed_by) VALUES($1,$2,$3,$4)", [id, row.version, row.payload, req.dbUser.id]);
    await connection.query("COMMIT");
    res.status(req.params.id ? 200 : 201).json(present(row));
  } catch (error) {
    if (connection) await connection.query("ROLLBACK").catch(() => {});
    failure(res, error);
  } finally { connection?.release(); }
}
planningActionsRouter.post("/", save);
planningActionsRouter.put("/:id", save);
