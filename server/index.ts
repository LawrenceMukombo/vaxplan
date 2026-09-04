// Load .env file for local development (Node 20.12+ built-in, no dotenv package needed)
// This runs before any other imports that touch process.env (e.g. db.ts checks DATABASE_URL).
try {
  // @ts-ignore - process.loadEnvFile is available in Node.js 20.12+
  process.loadEnvFile?.();
} catch {
  // .env file is optional - silently skip if not present (e.g. production with real env vars)
}
import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { getSession } from "./auth";
import { setupRealtime, realtimeBroadcastMiddleware } from "./services/realtime";
import { startPopulationRefreshScheduler } from "./jobs/populationRefresh";
import { startSessionArchiveScheduler } from "./jobs/sessionArchive";
import { startStockAlertDigestScheduler } from "./jobs/stockAlertDigest";
import { startSupervisionDigestScheduler } from "./jobs/supervisionDigest";
import { startApprovalScheduler } from "./jobs/approvalScheduler";
import { startMicroplanApprovalCron } from "./jobs/microplanApprovalCron";
import { seedDemoOperational } from "./migrations/006-seed-demo-operational";
/* Original Code commented out for backward-compatibility:
import { applyPerfIndexes } from "./migrations/011-perf-indexes";
*/
import { applyPerfIndexes } from "./migrations/011-perf-indexes";
import { applyVillageColumns } from "./migrations/013-village-route-columns";
import { applyOutreachColumns } from "./migrations/014-outreach-columns";
import { applyMicroplanApprovalColumns } from "./migrations/015-microplan-approval-columns";
import { applySessionsTable } from "./migrations/016-sessions-table";
import { applyWikiPages } from "./migrations/017-wiki-pages";
import { promoteAdminUser } from "./migrations/018-promote-admin";
import { applyNewUserRoles } from "./migrations/019-new-user-roles";
import { up as applyColdChainEquipment } from "./migrations/020-cold-chain-equipment";
import { up as applyStockNormalization } from "./migrations/021-normalize-stock-vaccine-names";
import { up as applyResearchHubSchema } from "./migrations/022-research-hub-schema";
import { applySafeGeometryFixes } from "./migrations/023-safe-geometry";
import { applySettlementsGisMigration } from "./migrations/024-settlements-gis-microplanning";
import { applyPolygonPlanningMigration } from "./migrations/026-polygon-planning";
import { applyPolygonLifecycleMigration } from "./migrations/028-polygon-lifecycle";
import { upsertPolygonPermissionsForAllTenants } from "./migrations/029-polygon-permissions-all-tenants";
import { applyMicroplanVersionControlMigration } from "./migrations/030-microplan-version-control";
import { upsertMicroplanVersionPermissionsForAllTenants } from "./migrations/031-microplan-version-permissions";
import { realignIdentitySequences } from "./services/identitySequences";
import { applySupervisionTemplatesSeed } from "./migrations/028-supervision-templates-seed";
const app = express();
const httpServer = createServer(app);
const skipDbBootstrap = process.env.SKIP_DB_BOOTSTRAP === '1';
const sessionMiddleware = getSession();
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}
app.set("trust proxy", 1);
// Enforce HTTPS in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});
// --- Gzip compression ---
// Must be the FIRST middleware so every response (API + static) is compressed.
// On a slow mobile connection (MTN hotspot) this can reduce sync/pull payloads
// from 1-2 MB down to 80-200 KB - a 5-10x speed improvement on large datasets.
app.use(compression({ level: 6, threshold: 1024 }));
app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
// --- CORS for packaged native apps ---
// The web app is same-origin and needs no CORS. The packaged Android
// (Capacitor) and Windows (Electron) shells, however, load their UI from a
// local origin and call this server cross-origin, so we must explicitly allow
// those origins (with credentials so the session cookie flows).
//
// Explicit allowlist only. The web app is same-origin and never needs CORS.
// Only the packaged native shells (which load from these fixed local origins)
// are allowed to make cross-origin credentialed requests.
const NATIVE_ALLOWED_ORIGINS = new Set<string>([
  "https://localhost", // Capacitor Android (androidScheme: "https")
  "capacitor://localhost", // Capacitor (iOS / alt scheme)
  "app://local", // Electron packaged app (custom secure scheme)
  // Electron dev (loadURL to dev server) - development only, never expand the
  // credentialed CORS surface to a localhost origin in production.
  ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:5000"]),
]);
function isAllowedCorsOrigin(origin: string): boolean {
  return NATIVE_ALLOWED_ORIGINS.has(origin);
}
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedCorsOrigin(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-tenant-id, x-release-token",
    );
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
  }
  next();
});
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
// Helper to inspect payloads without blocking the Event Loop or stdout with large JSON strings
function inspectPayload(payload: any): string {
  if (payload === null || payload === undefined) return "";
  if (Array.isArray(payload)) {
    if (payload.length > 5) {
      return `[Array of ${payload.length} items]`;
    }
  } else if (typeof payload === "object") {
    if (Array.isArray(payload.data) && payload.data.length > 5) {
      return `{ success: ${payload.success}, data: [Array of ${payload.data.length} items] }`;
    }
    const keys = Object.keys(payload);
    if (keys.length > 10) {
      return `[Object with ${keys.length} keys]`;
    }
  }
  const str = JSON.stringify(payload);
  return str.length > 300 ? `[Payload of ${str.length} chars]` : str;
}
/* Original middleware commented out to prevent event loop blocks and comply with Rule 2:
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Only include the response body in the log for small payloads.
      // Stringifying a 10 000-row sync/pull response causes ~50 ms of
      // CPU overhead per request and floods the console with MB of JSON.
      const contentLen = parseInt(res.getHeader("content-length") as string || "0", 10);
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(contentLen > 0 && contentLen < 2048
        ? logLine + " :: [see response]"
        : logLine);
    }
  });
  next();
});
*/
// Updated high-performance request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${inspectPayload(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });
  next();
});
// Broadcast a tenant-scoped "changed" poke after any successful mutating /api
// request so other connected clients can pull immediately (see services/realtime).
app.use(realtimeBroadcastMiddleware);
async function backfillClientIds() {
  try {
    const { clients, facilities, districts, provinces } = await import("../shared/schema");
    const { db } = await import("./db");
    const { sql, isNull, eq, and } = await import("drizzle-orm");
    const { getInitials, computeCheckDigit } = await import("./routes");
    const pendingClients = await db
      .select()
      .from(clients)
      .where(isNull(clients.clientId));
    if (pendingClients.length === 0) {
      return;
    }
    log(`Found ${pendingClients.length} clients needing Client ID backfill.`, "backfill");
    for (const client of pendingClients) {
      const [facInfo] = await db
        .select({
          facilityName: facilities.name,
          districtName: districts.name,
          provinceName: provinces.name,
        })
        .from(facilities)
        .innerJoin(districts, eq(facilities.districtId, districts.id))
        .innerJoin(provinces, eq(districts.provinceId, provinces.id))
        .where(eq(facilities.id, client.facilityId))
        .limit(1);
      const provInit = getInitials(facInfo?.provinceName || "PRV");
      const distInit = getInitials(facInfo?.districtName || "DST");
      const hfInit = getInitials(facInfo?.facilityName || "FAC");
      const regYear = client.createdAt ? new Date(client.createdAt).getFullYear() : new Date().getFullYear();
      const [maxClient] = await db
        .select({ maxSerial: sql<number>`MAX(${clients.serialNumber})` })
        .from(clients)
        .where(
          and(
            eq(clients.facilityId, client.facilityId),
            eq(clients.registrationYear, regYear),
            eq(clients.tenantId, client.tenantId)
          )
        );
      const serialNum = (maxClient?.maxSerial ?? 0) + 1;
      const serialStr = String(serialNum).padStart(4, "0");
      const prefix = `${provInit}-${distInit}-${hfInit}-${regYear}-${serialStr}`;
      const checkDigit = computeCheckDigit(prefix);
      const generatedClientId = `${prefix}-${checkDigit}`;
      await db
        .update(clients)
        .set({
          clientId: generatedClientId,
          serialNumber: serialNum,
          registrationYear: regYear,
        })
        .where(eq(clients.id, client.id));
    }
    log(`Successfully backfilled ${pendingClients.length} Client IDs.`, "backfill");
  } catch (error) {
    log(`Client ID backfill failed: ${error}`, "backfill");
  }
}
(async () => {
  if (skipDbBootstrap) {
    log("DB bootstrap disabled: skipping early identity sequence realignment", "db");
  } else {
    try {
      const { db } = await import("./db");
      await realignIdentitySequences(db as any);
      log("identity sequences realigned before route startup", "db");
    } catch (err: any) {
      log(`early identity sequence realignment warning: ${err?.message ?? err}`, "db");
    }
  }

  await registerRoutes(httpServer, app);
  // Run backfill asynchronously in the background so as not to block startup
  if (skipDbBootstrap) {
    log("DB bootstrap disabled: skipping client ID backfill", "db");
  } else {
    backfillClientIds().catch((err) => log(`Background backfill failed: ${err}`, "backfill"));
  }
  // Additive remote sensing routes (zero-touch to routes.ts)
  const { registerRemoteSensingRoutes } = await import("./services/remoteSensingService");
  registerRemoteSensingRoutes(app);
  // Reporting Engine - standalone module at /api/reports
  const { reportsRouter } = await import("./routes/reports");
  app.use("/api/reports", reportsRouter);
  // VPD Surveillance Engine
  const { surveillanceRouter } = await import("./routes/surveillance");
  app.use("/api/surveillance", surveillanceRouter);
  // VPD Risk Assessment Engine
  const { riskRouter } = await import("./routes/riskRoutes");
  app.use("/api/risk", riskRouter);
  // GIS Advanced Polygons
  const { gisPolygonsRouter } = await import("./routes/gisPolygons");
  app.use("/api/gis/polygons", gisPolygonsRouter);
  // Self-Hosted MapLibre Vector Styles & GIS Infrastructure Health
  const { mapStylesRouter } = await import("./routes/mapStyles");
  app.use("/api/maps", mapStylesRouter);
  app.use("/api/health/maps", (req, res) => res.redirect("/api/maps/health"));
  app.use("/api/health/tiles", (req, res) => res.redirect("/api/maps/health"));
  if (skipDbBootstrap) {
    log("DB bootstrap disabled: skipping startup migrations and schema/data ensure jobs", "db");
  } else {
  /* Original Code commented out for backward-compatibility:
  applyPerfIndexes()
    .then(() => log("perf indexes applied", "db"))
    .catch((err) => log(`perf indexes warning: ${err?.message ?? err}`, "db"));
  */
  applyPerfIndexes()
    .then(() => log("perf indexes applied", "db"))
    .catch((err) => log(`perf indexes warning: ${err?.message ?? err}`, "db"));
  applyVillageColumns()
    .then(() => log("village route columns migration complete", "db"))
    .catch((err) => log(`village columns warning: ${err?.message ?? err}`, "db"));
  applyOutreachColumns()
    .then(() => log("outreach columns migration complete", "db"))
    .catch((err) => log(`outreach columns warning: ${err?.message ?? err}`, "db"));
  applyMicroplanApprovalColumns()
    .then(() => log("microplan approval columns migration complete", "db"))
    .catch((err) => log(`microplan approval columns warning: ${err?.message ?? err}`, "db"));
  applySessionsTable()
    .then(() => log("sessions table ensured", "db"))
    .catch((err) => log(`sessions table warning: ${err?.message ?? err}`, "db"));
  applyWikiPages()
    .then(() => log("wiki pages table ensured", "db"))
    .catch((err) => log(`wiki pages warning: ${err?.message ?? err}`, "db"));
  // Self-healing: ensure the primary platform administrator has the correct
  // role and flags on every startup. Idempotent - no-op if already correct.
  promoteAdminUser()
    .then(() => log("admin user promotion check complete", "db"))
    .catch((err) => log(`admin promotion warning: ${err?.message ?? err}`, "db"));
  // Add new implementing-partner and national-manager enum values to user_role.
  applyNewUserRoles()
    .then(() => log("new user roles migration complete", "db"))
    .catch((err) => log(`new user roles warning: ${err?.message ?? err}`, "db"));
  // Cold chain equipment inventory table (migration 020)
  import("./db").then(({ db }) =>
    applyColdChainEquipment(db as any)
      .then(() => log("cold chain equipment table ensured", "db"))
      .catch((err) => log(`cold chain equipment migration warning: ${err?.message ?? err}`, "db"))
  ).catch((err) => log(`cold chain migration db import failed: ${err?.message ?? err}`, "db"));
  // Normalize stock vaccine names (migration 021)
  import("./db").then(({ db }) =>
    applyStockNormalization(db as any)
      .then(() => log("stock transaction vaccine names normalized", "db"))
      .catch((err) => log(`stock normalization migration warning: ${err?.message ?? err}`, "db"))
  ).catch((err) => log(`stock normalization migration db import failed: ${err?.message ?? err}`, "db"));
  // Research hub tables (migration 022)
  import("./db").then(({ db }) =>
    applyResearchHubSchema(db as any)
      .then(() => log("research hub tables and seed data ensured", "db"))
      .catch((err) => log(`research hub migration warning: ${err?.message ?? err}`, "db"))
  ).catch((err) => log(`research hub migration db import failed: ${err?.message ?? err}`, "db"));
  // Safe geometry and schema fixes (migration 023)
  import("./db").then(({ db }) =>
    applySafeGeometryFixes(db as any)
      .then(() => log("geometry schema fixes applied", "db"))
      .catch((err) => log(`geometry fixes warning: ${err?.message ?? err}`, "db"))
  ).catch((err) => log(`geometry fixes db import failed: ${err?.message ?? err}`, "db"));
  // Settlements GIS and microplanning upgrade (migration 024)
  import("./db").then(({ db }) =>
    applySettlementsGisMigration(db as any)
      .then(() => log("settlements GIS migration complete", "db"))
      .catch((err) => log(`settlements GIS migration warning: ${err?.message ?? err}`, "db"))
  ).catch((err) => log(`settlements GIS db import failed: ${err?.message ?? err}`, "db"));

  // Polygon planning metadata upgrade (migration 026)
  import("./db").then(({ db }) =>
    applyPolygonPlanningMigration(db as any)
      .then(() => log("polygon planning metadata migration complete", "db"))
      .catch((err) => log(`polygon planning metadata migration warning: ${err?.message ?? err}`, "db"))
  ).catch((err) => log(`polygon planning metadata db import failed: ${err?.message ?? err}`, "db"));

  // Versioned polygon lifecycle, approval, and impact metadata (migration 028)
  import("./db").then(({ db }) =>
    applyPolygonLifecycleMigration(db as any)
      .then(() => log("polygon lifecycle migration complete", "db"))
      .catch((err) => log(`polygon lifecycle migration warning: ${err?.message ?? err}`, "db"))
  ).catch((err) => log(`polygon lifecycle migration db import failed: ${err?.message ?? err}`, "db"));
  // Identity-backed permission and version-control setup must run in order.
  // Snapshot UPSERTs preserve explicit IDs, so realign sequences before these
  // startup inserts and permission merges touch user_roles/user_permissions.
  import("./db").then(async ({ db }) => {
    await applyMicroplanVersionControlMigration(db as any);
    await realignIdentitySequences(db as any);
    await upsertPolygonPermissionsForAllTenants(db as any);
    await upsertMicroplanVersionPermissionsForAllTenants(db as any);
    await applySupervisionTemplatesSeed();
    log("identity sequences, templates, and all-tenant lifecycle permissions ready", "db");
  }).catch((err) => log("identity sequence and lifecycle permission warning: " + String(err?.message ?? err), "db"));
  // Stock ledger columns upgrade (migration 027)
  import("./db").then(({ db }) =>
    import("./migrations/027-stock-ledger-columns").then(({ applyStockLedgerColumnsMigration }) =>
      applyStockLedgerColumnsMigration(db as any)
        .then(() => log("stock ledger columns migration complete", "db"))
        .catch((err) => log(`stock ledger columns migration warning: ${err?.message ?? err}`, "db"))
    ).catch((err) => log(`stock ledger migration import failed: ${err?.message ?? err}`, "db"))
  ).catch((err) => log(`stock ledger db import failed: ${err?.message ?? err}`, "db"));

  // Population geo-ID backfill (one-time, idempotent): fills in null districtId/provinceId
  // on population_data records that have a villageId or facilityId but are missing geo scope.
  import("./db").then(async ({ pool }) => {
    try {
      // Backfill from villages
      await (pool as any).query(`
        UPDATE population_data pd
        SET
          district_id = v.district_id,
          province_id = d.province_id
        FROM villages v
        JOIN districts d ON d.id = v.district_id
        WHERE pd.village_id = v.id
          AND pd.tenant_id = v.tenant_id
          AND (pd.district_id IS NULL OR pd.province_id IS NULL)
      `);
      // Backfill from facilities
      await (pool as any).query(`
        UPDATE population_data pd
        SET
          district_id = COALESCE(pd.district_id, f.district_id),
          province_id = COALESCE(pd.province_id, d.province_id)
        FROM facilities f
        JOIN districts d ON d.id = f.district_id
        WHERE pd.facility_id = f.id
          AND pd.tenant_id = f.tenant_id
          AND (pd.district_id IS NULL OR pd.province_id IS NULL)
      `);
      // Backfill older WorldPop/import rows that carried names/codes in metadata
      // but missed the durable village_id/facility_id links needed by tables/maps.
      await (pool as any).query(`
        UPDATE population_data pd
        SET
          village_id = v.id,
          facility_id = COALESCE(pd.facility_id, v.assigned_facility_id),
          district_id = COALESCE(pd.district_id, v.district_id),
          province_id = COALESCE(pd.province_id, d.province_id)
        FROM villages v
        JOIN districts d ON d.id = v.district_id AND d.tenant_id = v.tenant_id
        WHERE pd.tenant_id = v.tenant_id
          AND pd.village_id IS NULL
          AND pd.metadata IS NOT NULL
          AND (
            (
              COALESCE(BTRIM(pd.metadata->>'villageCode'), '') <> ''
              AND LOWER(v.code) = LOWER(BTRIM(pd.metadata->>'villageCode'))
            )
            OR (
              COALESCE(BTRIM(COALESCE(pd.metadata->>'communityName', pd.metadata->>'villageName', pd.metadata->>'catchmentName')), '') <> ''
              AND LOWER(v.name) = LOWER(BTRIM(COALESCE(pd.metadata->>'communityName', pd.metadata->>'villageName', pd.metadata->>'catchmentName')))
            )
          )
      `);
      await (pool as any).query(`
        UPDATE population_data pd
        SET
          facility_id = f.id,
          district_id = COALESCE(pd.district_id, f.district_id),
          province_id = COALESCE(pd.province_id, d.province_id)
        FROM facilities f
        JOIN districts d ON d.id = f.district_id AND d.tenant_id = f.tenant_id
        WHERE pd.tenant_id = f.tenant_id
          AND pd.facility_id IS NULL
          AND pd.metadata IS NOT NULL
          AND (
            (
              COALESCE(BTRIM(pd.metadata->>'facilityHmisCode'), '') <> ''
              AND LOWER(f.hmis_code) = LOWER(BTRIM(pd.metadata->>'facilityHmisCode'))
            )
            OR (
              COALESCE(BTRIM(COALESCE(pd.metadata->>'facilityName', pd.metadata->>'healthFacilityName', pd.metadata->>'hfName')), '') <> ''
              AND LOWER(f.name) = LOWER(BTRIM(COALESCE(pd.metadata->>'facilityName', pd.metadata->>'healthFacilityName', pd.metadata->>'hfName')))
            )
          )
      `);
      await (pool as any).query(`
        WITH latest AS (
          SELECT DISTINCT ON (tenant_id, village_id)
            tenant_id,
            village_id,
            total_population,
            under_5_population,
            source
          FROM population_data
          WHERE village_id IS NOT NULL
          ORDER BY tenant_id, village_id, year DESC, updated_at DESC NULLS LAST, id DESC
        )
        UPDATE villages v
        SET
          total_catchment_population = latest.total_population,
          under5_population = COALESCE(latest.under_5_population, v.under5_population),
          gridded_population = CASE WHEN latest.source = 'worldpop' THEN latest.total_population ELSE v.gridded_population END,
          population_source_label = CASE WHEN latest.source = 'worldpop' THEN 'WorldPop' ELSE v.population_source_label END,
          updated_at = NOW()
        FROM latest
        WHERE v.tenant_id = latest.tenant_id
          AND v.id = latest.village_id
      `);
      await (pool as any).query(`
        WITH agg AS (
          SELECT
            tenant_id,
            assigned_facility_id AS facility_id,
            COALESCE(SUM(COALESCE(gridded_population, total_catchment_population, 0)), 0)::int AS total
          FROM villages
          WHERE assigned_facility_id IS NOT NULL
          GROUP BY tenant_id, assigned_facility_id
        )
        UPDATE facilities f
        SET
          catchment_grid_population = agg.total,
          updated_at = NOW()
        FROM agg
        WHERE f.tenant_id = agg.tenant_id
          AND f.id = agg.facility_id
      `);
      log("population geo-ID backfill complete", "db");
    } catch (err: any) {
      log(`population geo-ID backfill warning: ${err?.message ?? err}`, "db");
    }
  }).catch((err) => log(`population geo-ID backfill db import failed: ${err?.message ?? err}`, "db"));
  const autoUpsertEnabled =
    process.env.ENABLE_AUTO_UPSERT === "1" ||
    (process.env.NODE_ENV !== "production" && process.env.SKIP_AUTO_UPSERT !== "1");

  if (autoUpsertEnabled) {
    // Auto-upsert database snapshot from scratch/local_database_all.jsonl.gz when
    // explicitly enabled. Production deploys should use npm run db:migrate plus
    // the controlled upsert script so bulk imports do not slow live requests.
    import("../scripts/upsert-entire-database").then(({ upsertEntireDatabase }) => {
      upsertEntireDatabase()
        .then(async () => {
          const { db } = await import("./db");
          await realignIdentitySequences(db as any);
          await upsertPolygonPermissionsForAllTenants(db as any);
          await upsertMicroplanVersionPermissionsForAllTenants(db as any);
          log("auto-upsert complete; sequences and all-tenant permissions refreshed", "db");
        })
        .catch((err) => log(`auto-upsert warning: ${err?.message ?? err}`, "db"));
    }).catch((err) => log(`auto-upsert import failed: ${err?.message ?? err}`, "db"));
  } else {
    log("auto-upsert skipped (set ENABLE_AUTO_UPSERT=1 for controlled data import)", "db");
  }
  }
  setupRealtime(httpServer, sessionMiddleware);
  if (skipDbBootstrap) {
    log("DB bootstrap disabled: skipping background schedulers, workers, and demo seed", "db");
  } else {
  startPopulationRefreshScheduler();
  startSessionArchiveScheduler();
  startStockAlertDigestScheduler();
  startSupervisionDigestScheduler();
  startApprovalScheduler();
  startMicroplanApprovalCron();
  // Initialize the UCE worker only when Redis is explicitly configured.
  if (process.env.REDIS_URL?.trim()) {
    import("./services/uce/workers").catch((err) => log(`Failed to load UCE worker: ${err}`));
  } else {
    log("REDIS_URL not configured: UCE queue worker disabled", "uce");
  }
  // Auto-run the demo operational seed on startup. Idempotent: every step
  // skips/upserts so subsequent boots are a no-op once data is in place.
  // Runs in the background so a slow seed never blocks the HTTP listener.
  //
  // Gating: by default the demo seed only runs in non-production environments
  // so real tenants on a deployed instance never get synthetic clients,
  // vaccinations, or imported coverage rows mixed into their data. To opt in
  // on production (e.g. a preview/staging deploy that should look populated),
  // set ENABLE_DEMO_SEED=1. To force-disable in dev, set SKIP_DEMO_SEED=1.
  const isProduction = process.env.NODE_ENV === "production";
  const demoSeedEnabled =
    process.env.SKIP_DEMO_SEED !== "1" &&
    (!isProduction || process.env.ENABLE_DEMO_SEED === "1");
  if (demoSeedEnabled) {
    seedDemoOperational()
      .then(() => log("demo operational seed complete", "seed"))
      .catch((err) => log(`demo operational seed failed: ${err?.message ?? err}`, "seed"));
  } else {
    log(
      `demo operational seed skipped (NODE_ENV=${process.env.NODE_ENV ?? "unset"}, set ENABLE_DEMO_SEED=1 to opt in)`,
      "seed",
    );
  }
  }
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    if (status === 500) {
      console.error("[Server Error]", err);
    }
    res.status(status).json({ message });
  });
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }
  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const portVal = process.env.PORT || "5000";
  const port = /^\d+$/.test(portVal) ? parseInt(portVal, 10) : portVal;
  if (typeof port === "number") {
    // Removed reusePort as it is a POSIX-specific flag that throws ENOTSUP on Windows.
    httpServer.listen(
      {
        port,
      },
      () => {
        log(`serving on port ${port}`);
      },
    );
  } else {
    // Listen on Unix socket or Windows named pipe path (common in Passenger / IIS setups)
    httpServer.listen(port, () => {
      log(`serving on socket/pipe ${port}`);
    });
  }
})();
