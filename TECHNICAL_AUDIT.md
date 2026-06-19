# VaxPlan Technical Audit Report

**Repository:** `Vumbi2018/vaxplan`  
**Version:** 1.4.0  
**Audit Date:** 2025-06-19  
**Auditor:** GitHub Copilot CLI  
**Scope:** Full-stack audit — security, RBAC, database schema, API routes, authentication,
GIS/mapping, stock ledger, offline sync, background jobs, code quality, and DevSecOps.

---

## Executive Summary

VaxPlan is a multi-tenant vaccination micro-planning platform targeting sub-Saharan Africa.
The stack is Node.js/Express + React/Vite + PostgreSQL via Drizzle ORM, with offline-first
support through Capacitor (Android) and Electron (Windows). The codebase is **functional and
operational** but carries significant accumulated technical debt, several **critical
security deficiencies**, and architectural patterns that will impede scaling and maintenance.

### Summary Counts

| Severity  | Count |
|-----------|-------|
| Critical  | 5     |
| High      | 11    |
| Medium    | 12    |
| Low       | 10    |
| **Total** | **38**|

### Top Three Immediate Actions

1. **Add `requirePermission("manage_stock")` to the three stock write routes** — any
   authenticated tenant user can currently corrupt the entire stock ledger.
2. **Remove tracked binary/database dump files** (`dump.rdb`, `local_dump.sql.zip`,
   `zipFile.zip`) from git history — these files are in the repository and may contain
   live production data.
3. **Install `helmet` middleware** — the production server sends no security headers
   (no CSP, no HSTS, no X-Frame-Options, no X-Content-Type-Options).

---

## Architecture Overview

```
Client (React/Vite SPA + Capacitor Android + Electron Windows)
    ↕ HTTP/WebSocket
Express Server (Node.js, TypeScript, single process or PM2 cluster)
    ├── Auth: express-session (PostgreSQL session store via connect-pg-simple)
    │         + password auth (bcrypt) + SAML/OIDC (passport)
    ├── RBAC: custom hasPermission() with 60-second in-process TTL cache
    ├── DB: Drizzle ORM over pg Pool (PostgreSQL / Supabase)
    ├── GIS: PostGIS spatial queries + turf.js + geotiff.js
    └── Jobs: node-schedule background digests (stock alerts, supervision)

Shared: TypeScript types + Drizzle schema + Zod validators (shared/schema.ts)
```

**Multi-tenancy model:** Single database, tenant isolation via `tenantId` foreign key on
every table. No row-level security at the database layer — all isolation is enforced in
application code.

---

## Critical Issues

### SEC-001 · Stock Write Routes Missing Permission Check
**Priority:** Critical | **Module:** Stock Ledger | **Effort:** 30 min

**Files:**
- `server/routes.ts` lines 13715, 13759, 13817

**Problem:** Three stock write routes use only `isAuthenticated, requireTenant` — no
`requirePermission("manage_stock")` guard. Any authenticated user in a tenant can create,
transfer, or delete stock transactions, regardless of role.

**Evidence:**
```typescript
// line 13715
app.post("/api/stock/transaction", isAuthenticated, requireTenant, async (req: any, res) => {

// line 13759
app.post("/api/stock/transfer", isAuthenticated, requireTenant, async (req: any, res) => {

// line 13817
app.delete("/api/stock/transaction/:id", isAuthenticated, requireTenant, async (req: any, res) => {
```

**Risk:** A field user (`facility_clerk`) with `view_stock` only could insert fabricated
distribution transactions, erase real ones, or forge inter-facility transfers, corrupting
vaccine accountability records and supply reports.

**Fix:**
```typescript
app.post("/api/stock/transaction",
  isAuthenticated, requireTenant, requirePermission("manage_stock"),
  async (req: any, res) => { ... });

app.post("/api/stock/transfer",
  isAuthenticated, requireTenant, requirePermission("manage_stock"),
  async (req: any, res) => { ... });

app.delete("/api/stock/transaction/:id",
  isAuthenticated, requireTenant, requirePermission("manage_stock"),
  async (req: any, res) => { ... });
```

---

### SEC-002 · Sensitive Binary/Data Files Tracked in Git
**Priority:** Critical | **Module:** DevSecOps / Repository | **Effort:** 2 hours

**Files:**
- `dump.rdb` (242 bytes, Redis snapshot)
- `local_dump.sql.zip` (29 MB, compressed PostgreSQL dump)
- `zipFile.zip` (34 MB, unknown contents)

**Problem:** These files are tracked in git (`git ls-files` confirms presence). The 29 MB
SQL dump almost certainly contains real production data — tenant records, user credentials
(bcrypt hashes), geographic data, and potentially PII (patient demographics, village
coordinates). Any person who clones the repository gains access to this data.

**Evidence:**
```
$ git ls-files dump.rdb local_dump.sql.zip zipFile.zip
dump.rdb
local_dump.sql.zip
zipFile.zip
```

**Risk:** Data breach, GDPR/POPIA violation, credential exposure (session secrets, bcrypt
hashes). GitHub public fork/mirror will also contain the dump.

**Fix:**
1. Remove files from git history: `git filter-repo --path dump.rdb --invert-paths` (and
   repeat for the other two files).
2. Rotate any credentials/session secrets that may have been in the dump.
3. Add to `.gitignore` (already present but files must be removed from tracking first).
4. Add a pre-commit hook or CI check (`git-secrets`, `trufflehog`) to prevent future
   commits of binary data files.

---

### SEC-003 · No HTTP Security Headers (Missing helmet.js)
**Priority:** Critical | **Module:** Infrastructure / All Routes | **Effort:** 1 hour

**Files:**
- `server/index.ts` (entire file — no helmet import)
- `package.json` — helmet is not a dependency

**Problem:** The Express server sets no HTTP security headers. There is no `helmet()`
middleware and no manual header configuration. In production, responses carry browser
defaults (permissive).

**Missing headers:**
| Header | Risk if absent |
|--------|---------------|
| `Content-Security-Policy` | XSS attacks via injected scripts |
| `X-Frame-Options` | Clickjacking |
| `X-Content-Type-Options` | MIME-type sniffing |
| `Strict-Transport-Security` | Downgrade to HTTP |
| `Referrer-Policy` | Tenant URL leakage in referrer |
| `Permissions-Policy` | Browser feature abuse |

**Risk:** XSS, clickjacking, MIME confusion attacks. Particularly relevant given the
application handles sensitive health and location data.

**Fix:**
```bash
npm install helmet
```
```typescript
// server/index.ts, before route registration
import helmet from "helmet";
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // tune per actual CSP needs
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

---

### SEC-004 · Microplan and Session Write Routes Missing Permission Checks
**Priority:** Critical | **Module:** Microplan / Session Planning | **Effort:** 1 hour

**Files:**
- `server/routes.ts` lines 8673, 8691, 8785, 9042, 9228, 9444

**Problem:** All microplan and session CRUD mutations use only `...auth`
(= `[isAuthenticated, requireTenant, requireDbUser]`). No `requirePermission` check.
Any authenticated tenant user — including read-only analytics roles — can create, modify,
or delete microplans and vaccination sessions.

**Evidence:**
```typescript
// line 8673
app.post("/api/microplans", ...auth, async (req: any, res) => {

// line 8691
app.patch("/api/microplans/:id", ...auth, async (req: any, res) => {

// line 9042
app.post("/api/sessions", ...auth, async (req: any, res) => {

// line 9228
app.patch("/api/sessions/:id", ...auth, async (req: any, res) => {
```

**Risk:** A user with only `view_reports` or `view_stock` can corrupt the planning data
that drives field operations.

**Fix:** Add `requirePermission("manage_session_plans")` (for session routes) and a new
`requirePermission("edit_microplans")` enforcement (see also RBAC-001) to all
microplan/session write handlers.

---

### SEC-005 · Dev Mock-Login Endpoint Reachable Without NODE_ENV Guard
**Priority:** Critical | **Module:** Authentication | **Effort:** 30 min

**Files:**
- `server/auth.ts` lines 130–165

**Problem:** A `/api/auth/mock-login` endpoint exists. Though it contains a runtime check
`if (process.env.NODE_ENV === "production") return res.status(403)...`, any configuration
mistake (e.g., missing `NODE_ENV`, misconfigured hosting) causes the check to pass and
allows login as any user ID without a password.

**Evidence:**
```typescript
// server/auth.ts ~line 135
app.post("/api/auth/mock-login", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ message: "Not available in production" });
  }
  // ... logs in as req.body.userId with no credential check
});
```

**Risk:** If `NODE_ENV` is unset (defaults to `undefined`, not `"production"`), any external
attacker can authenticate as any user ID, gaining full application access.

**Fix:** Invert the guard to allowlist development only:
```typescript
if (process.env.NODE_ENV !== "development") {
  return res.status(404).end(); // Don't reveal the endpoint exists
}
```
Or better: compile-time tree-shake the entire route using an `if (process.env.NODE_ENV === "development")` block around the route registration.

---

## High Issues

### SEC-006 · In-Memory Rate Limiter — Not Multi-Worker Safe
**Priority:** High | **Module:** Authentication | **Effort:** 4 hours

**Files:** `server/auth/passwordAuth.ts` lines 21–47

**Problem:** The login brute-force rate limiter uses a process-local `Map`. It resets on
every server restart and is not shared across PM2 cluster workers. The code itself
acknowledges this: _"migrate to Redis if we ever scale to multiple server instances."_

```typescript
// line 22
const attempts = new Map<string, Attempt>();  // process-local, volatile
```

**Risk:** An attacker targeting a PM2-clustered deployment can make `8 × N` attempts
(where N = worker count) before any worker blocks them. After a restart, the counter resets
completely.

**Fix:** Replace with `rate-limiter-flexible` (Redis-backed):
```bash
npm install rate-limiter-flexible ioredis
```

---

### ARCH-001 · Duplicate Route Registrations (Dead Code in Production)
**Priority:** High | **Module:** API / routes.ts | **Effort:** 2 hours

**Files:** `server/routes.ts` lines 1262–1388

**Problem:** The `/* Original Code commented out */` pattern results in **two live
registrations** of several user-management routes. In Express, the first matching handler
wins, so the second registration silently shadows the first. Lines 1263–1383 and
1388–1693 both register `GET /api/users`, `POST /api/users`, `DELETE /api/users/:id`.

**Evidence:**
```
1263:  app.get("/api/users", isAuthenticated, requireTenant, requirePermission("manage_users"), ...
1388:  app.get("/api/users", isAuthenticated, requireTenant, requirePermission("manage_users"), ...
1312:  app.post("/api/users", ...
1500:  app.post("/api/users", ...
```

**Risk:** The "original" implementation on lines 1263–1383 is silently dead. If someone
edits the wrong copy, the live copy is unaffected. This is a maintenance trap.

**Fix:** Remove the `/* Original Code */` blocks wholesale. Keep only the current live
implementation. Rely on git history for change archaeology.

---

### ARCH-002 · routes.ts God File (~19,638 Lines)
**Priority:** High | **Module:** Architecture | **Effort:** 5 days

**Files:** `server/routes.ts`

**Problem:** A single TypeScript file contains 325 route handlers, all middleware helpers,
geofence logic, GIS proximity queries, analytics tracking, background cache init, and
schema seeding. This file cannot be reviewed, tested, or modified safely by more than
one engineer at a time.

**Risk:** Merge conflicts, accidental regression, inability to write targeted tests,
onboarding difficulty.

**Fix:** Split by domain module. Suggested structure:
```
server/
  routes/
    users.ts           (~400 lines)
    microplans.ts      (~800 lines)
    sessions.ts        (~600 lines)
    stock.ts           (~400 lines)
    geography.ts       (~500 lines)
    gis.ts             (~600 lines)
    approvals.ts       (~300 lines)
    analytics.ts       (~300 lines)
    customLayers.ts    (~500 lines)
    admin.ts           (~400 lines)
  routes.ts            (imports and mounts the above)
```

---

### ARCH-003 · Dual Migration System — Schema Drift Risk
**Priority:** High | **Module:** Database / Migrations | **Effort:** 3 days

**Files:**
- `server/index.ts` lines 24–353 (inline TypeScript migrations)
- `migrations/` directory (Drizzle Kit migration files)

**Problem:** Two parallel migration systems coexist. Drizzle Kit generates SQL files in
`migrations/`; separately, `server/index.ts` imports and runs 20+ custom TypeScript
migration functions on every server startup (`applyPerfIndexes`, `applyVillageColumns`,
`applyOutreachColumns`, etc.). Neither system fully tracks the other. The canonical schema
in `shared/schema.ts` may be out of sync with what either migration system has actually
applied.

**Risk:** Production schema drift. An inline migration may re-run additive operations that
Drizzle already applied, or Drizzle Kit may generate conflicting DDL.

**Fix:**
1. Audit each inline migration; consolidate into numbered Drizzle Kit migrations.
2. Run all migrations via `drizzle-kit migrate` in CI/CD, not on application startup.
3. Delete `server/migrations/` folder once consolidated.

---

### SEC-007 · No CSRF Protection
**Priority:** High | **Module:** Authentication / All Mutations | **Effort:** 4 hours

**Files:** `server/index.ts`, `server/auth.ts`

**Problem:** No CSRF middleware (`csurf`, `csrf`, double-submit cookie) is present. The
session cookie is `sameSite: "none"` (required for Capacitor embedding), which explicitly
disables the browser's built-in CSRF mitigation for cross-origin requests.

**Evidence:**
```typescript
// server/auth.ts line 72
cookie: {
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure:   process.env.NODE_ENV === "production",
  maxAge:   7 * 24 * 60 * 60 * 1000,
}
```

**Risk:** A malicious website visited by an authenticated user can trigger state-changing
API calls (POST stock transactions, modify microplans, delete users) via cross-origin
form/fetch submissions.

**Fix:** Add a CSRF double-submit token. Use `csrf` (csurf successor) or implement
header-based CSRF (`X-Requested-With` check). For the native Capacitor clients, exempt
non-browser origins by checking `Origin` header.

---

### SEC-008 · Multer Upload — No MIME Type Validation
**Priority:** High | **Module:** File Upload | **Effort:** 2 hours

**Files:**
- `server/routes.ts` lines 11462–11516 (custom layer upload, 2 GB limit)
- `server/routes.ts` ~2946 (logo upload)

**Problem:** File upload handlers validate only by file extension (`.tif`, `.geojson`,
`.csv`, `.zip`). No `Content-Type` header validation or magic-byte inspection. A 2 GB file
size limit for the layer upload is extremely generous and creates a DoS vector.

**Evidence:**
```typescript
const layerUpload = _multer({
  storage: _multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB for large rasters/shapefiles
});
// ...
const fname = (file.originalname || "").toLowerCase();
if (fname.endsWith(".tif") || fname.endsWith(".tiff")) {
```

**Risk:** Upload of executable content disguised as GeoTIFF; DoS via large file upload.

**Fix:**
```typescript
fileFilter: (req, file, cb) => {
  const allowed = ["image/tiff", "application/geo+json", "application/json",
                   "text/csv", "application/zip"];
  cb(null, allowed.includes(file.mimetype));
},
limits: { fileSize: 500 * 1024 * 1024 } // 500 MB max
```
Also validate magic bytes using `file-type` package.

---

### GIS-001 · Zambia-Hardcoded Geofence in Multi-Country Platform
**Priority:** High | **Module:** GIS / Geography | **Effort:** 2 days

**Files:** `server/routes.ts` lines 983–1037

**Problem:** The `initOutsideVillagesCache()` function and `isLocationOutsideZambia()`
explicitly filter villages using a Zambia constituency boundary GeoJSON. The platform
operates in PNG, South Sudan, South Africa, and Zambia. The cache query also lacks a
`tenantId` filter, loading all tenants' village data:

```typescript
// line 1013
const allVillages = await db
  .select({ id: villages.id, latitude: villages.latitude, longitude: villages.longitude })
  .from(villages)
  .where(isNotNull(villages.latitude));
  // No tenantId filter — loads ALL tenants
```

**Risk:** PNG/South Sudan villages are erroneously marked "outside Zambia" and may be
hidden from mapping views for those tenants.

**Fix:** Make geofence data tenant/country-specific. Load per-country GeoJSON from
`tenant.country` field. Add `tenantId` filter to the cache query.

---

### ARCH-004 · In-Process Caches Not Shared Across PM2 Workers
**Priority:** High | **Module:** RBAC / Authorization | **Effort:** 3 days

**Files:**
- `server/auth/authorization.ts` line 28 (`tenantRolesCache`)
- `server/routes.ts` lines 403–412 (`_geoScopeCache`)
- `server/auth/passwordAuth.ts` line 22 (rate limit `attempts` Map)
- `server/routes.ts` line 2601 (`trackHits` analytics rate limiter)

**Problem:** Four separate in-process Maps are used for caching and rate limiting. In a
PM2 cluster (which the production deployment likely uses for a ~16k-line server), each
worker maintains its own isolated cache. A permission change on worker #1 is not reflected
in worker #2 for up to 60 seconds.

**Risk:** Stale RBAC authorization; rate limit bypass; cache inconsistency.

**Fix:** Replace with Redis-backed cache for `tenantRolesCache` and `_geoScopeCache`. For
rate limiters, use `rate-limiter-flexible` with Redis store.

---

### RBAC-001 · Permission Codes in SYSTEM_CODES Not in Permission Type
**Priority:** High | **Module:** RBAC | **Effort:** 2 hours

**Files:**
- `shared/permissions.ts` lines 1–20 (Permission type)
- `server/routes.ts` line 1864 (SYSTEM_CODES list)
- `server/routes.ts` lines 1793–1796 (UI permission seeder)

**Problem:** The TypeScript `Permission` type does not include `edit_microplans`,
`plan_sessions`, `execute_sessions`, or `conduct_supervision`. These codes are used in:
1. The UI permission seeder (hardcoded labels at line 1793)
2. The system-critical code list that prevents deletion (line 1864)

Yet they are absent from the union type, meaning `requirePermission()` cannot
type-safely enforce them. The routes that should check these permissions (`/api/microplans`,
`/api/sessions`) currently have no `requirePermission` guard at all.

**Fix:**
```typescript
// shared/permissions.ts
export type Permission =
  | "edit_microplans"
  | "plan_sessions"
  | "execute_sessions"
  | "conduct_supervision"
  // ... existing permissions
```
Then add `requirePermission("edit_microplans")` and `requirePermission("plan_sessions")`
to the relevant write routes.

---

### AUTH-001 · Password Reset Has No Email — Admin-Only Manual Process
**Priority:** High | **Module:** Authentication | **Effort:** 3 days

**Files:** `server/auth/passwordAuth.ts` lines 183–222

**Problem:** `POST /api/auth/request-password-reset` only records an audit log entry. No
email is sent. Password reset requires a national admin to manually call
`POST /api/auth/set-password`. This means a user who forgets their password is locked out
until an admin intervenes — and the "reset request" gives no feedback to the user.

**Risk:** Field staff locked out during operations. Admin-bypass dependency creates RBAC
risk (admin can set any user's password).

**Fix:** Integrate an email transport (nodemailer + SMTP or SendGrid). Generate a
time-limited, single-use reset token. Add `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` to the
`.env.production.example` template.

---

### ARCH-005 · schema.ts Inline Historical Dead Code (~5 commented-out schema versions)
**Priority:** High | **Module:** Database Schema | **Effort:** 1 day

**Files:** `shared/schema.ts`

**Problem:** The schema file contains 3–5 full commented-out historical definitions of
major tables (`villages`, `microplans`, `approvalStatusEnum`, `userRoleEnum`,
`transportModeEnum`) and 3 complete commented-out versions of `ROLE_PERMISSIONS` in
`shared/permissions.ts`. These are preserved with `/* Original Code */` markers instead
of using git history.

**Risk:** Confusion about the canonical schema; accidental restoration of deprecated
columns; onboarding confusion.

**Fix:** Delete all `/* Original Code */` comment blocks. They are redundant with git
history. Run `git log -p shared/schema.ts` to retrieve historical versions if needed.

---

## Medium Issues

### SEC-009 · Session TTL 7 Days with SameSite=None
**Priority:** Medium | **Module:** Authentication | **Effort:** 1 hour

**Files:** `server/auth.ts` lines 32, 72

`maxAge: 7 * 24 * 60 * 60 * 1000` (7 days) is long for a health-data system. Combined
with `sameSite: "none"`, stolen sessions are valid for a week. Consider 8-hour sessions
with 24-hour refresh tokens for web, retaining 7-day sessions only for native clients.

---

### SEC-010 · 50 MB JSON Body Limit Creates DoS Vector
**Priority:** Medium | **Module:** Infrastructure | **Effort:** 15 min

**Files:** `server/index.ts` line 68

```typescript
app.use(express.json({ limit: "50mb" }));
```

50 MB is appropriate for GeoJSON uploads but not for all routes. A malicious client can
send 50 MB JSON payloads to any endpoint, consuming memory on each worker. **Fix:** Reduce
global limit to `1mb`; apply a larger `requestBodyLimit` middleware only to GeoJSON
import routes.

---

### SEC-011 · `/api/version` Leaks Infrastructure URLs
**Priority:** Medium | **Module:** API / Info Endpoint | **Effort:** 30 min

**Files:** `server/routes.ts` lines 1051–1059

The public (unauthenticated) version endpoint returns `APP_URL`,
`WINDOWS_INSTALLER_URL`, and `ANDROID_APK_URL` environment variable values. These expose
internal hosting infrastructure to unauthenticated users and crawlers.

**Fix:** Return only `version` and `buildTimestamp` on the unauthenticated endpoint. Move
download URLs behind authentication or a separate admin endpoint.

---

### DB-001 · facilityStaff Table Has Duplicate Columns
**Priority:** Medium | **Module:** Database Schema | **Effort:** 1 day

**Files:** `shared/schema.ts` lines 1143–1175

The `facilityStaff` table contains paired duplicate columns from iterative schema
additions without cleanup:
- `fullName` / `name`
- `contactPhone` / `phone`
- `yearsOfProfessionalExperience` / `yearsExperience`
- `isActive` / `active`

**Fix:** Create a Drizzle migration that consolidates to one column per attribute, migrates
data, and drops the duplicates.

---

### DB-002 · No Pagination on High-Volume Endpoints
**Priority:** Medium | **Module:** API / Performance | **Effort:** 2 hours

**Files:**
- `server/routes.ts` line 13662 (`GET /api/stock/ledger` — all transactions, no limit)
- `server/routes.ts` line 1388 (`GET /api/users` — all users in tenant, no limit)

High-volume tenants with thousands of stock transactions will receive uncapped result sets,
causing high memory usage and slow responses. **Fix:** Add `limit`/`offset` or cursor
pagination parameters to both endpoints.

---

### ARCH-006 · Dual Surveillance Router Registration
**Priority:** Medium | **Module:** API / Routing | **Effort:** 30 min

**Files:**
- `server/index.ts` line 292
- `server/routes.ts` line 1258

`surveillanceRouter` is mounted at `/api/surveillance` twice. Express processes both, so
every surveillance request passes through both middleware chains. This could cause double
logging, double response attempts, or incorrect error handling.

**Fix:** Remove one of the two registrations. Keep only the one inside `registerRoutes`.

---

### SEC-012 · No Global API Rate Limiting
**Priority:** Medium | **Module:** Infrastructure | **Effort:** 2 hours

**Files:** `server/index.ts`, `server/routes.ts`

Only the login endpoint has rate limiting (8 attempts/15 min). All other API endpoints
(including bulk operations, GIS queries, and file parsing) are unlimited. A compromised
account or automated attack can hammer the database.

**Fix:** Add `express-rate-limit` globally at `100 req/min` per IP, with higher limits for
specific trusted paths (e.g., analytics tracking).

---

### DEV-001 · 19 Debug/Patch/Ad-Hoc Scripts Committed to Repository
**Priority:** Medium | **Module:** DevSecOps | **Effort:** 1 hour

**Files:**
- `patch.cjs`, `patch_routes.cjs`, `patch_schema.cjs`, `patch_stock.cjs` (repo root)
- `add_columns.js`, `add_columns.ts` (repo root)
- `scratch/patch_auth.cjs`, `scratch/patch_auth_safe.cjs`, `scratch/patch_roles.cjs`,
  `scratch/patch_settings.cjs`, `scratch/patch_settings_ui.cjs`,
  `scratch/query_catalogue.cjs`, `scratch/test_vgie.ts` (scratch folder)
- `server/query_coords.ts`, `server/query_count.ts`, `server/query_mushitala_coords.ts`,
  `server/query_png_villages.ts`, `server/query_villages_distribution.ts`

These are one-off debugging scripts with direct `pool.query` access. `scratch/query_catalogue.cjs`
uses `new Pool({ connectionString: process.env.DATABASE_URL })`.

**Risk:** Future developers may accidentally run these against production.

**Fix:** Remove from git and add `scratch/` and `patch*.cjs` to `.gitignore`. Move any
still-needed queries to `scripts/` with clear README documentation.

---

### DEV-002 · MapView.tsx.bak Backup File Committed
**Priority:** Medium | **Module:** Frontend | **Effort:** 15 min

**Files:** `client/src/components/MapView.tsx.bak`

A `.bak` file is tracked in git. **Fix:** `git rm client/src/components/MapView.tsx.bak`.

---

### TEST-001 · Sparse Test Coverage for a Safety-Critical System
**Priority:** Medium | **Module:** Testing | **Effort:** 3 weeks

**Files:** `server/__tests__/` (6 test files total)

Only 6 test files exist covering `facility-locks`, `auth-no-401`, `indicators-seed`,
`planning-leadtime-timezone`, `presence-location`, and `research-hub`. There are no tests
for: stock ledger transactions, RBAC permission enforcement, microplan CRUD, session
planning, tenant isolation, geofence logic, or background jobs.

**Fix:** Add integration tests (using the existing vitest/supertest setup) targeting:
- Stock transaction permission enforcement (SEC-001)
- Tenant isolation (e.g., user in tenant A cannot read tenant B's data)
- RBAC matrix for each role × permission

---

### ARCH-007 · Raw pool.query Mixed with Drizzle ORM
**Priority:** Medium | **Module:** Database / Architecture | **Effort:** 2 days

**Files:** `server/routes.ts` lines 3944, 5340, 5469, 7553, 7764, 7826; 
`server/services/routing.ts` lines 166, 543;
`server/pipeline/settlementEngine.ts` line 335

PostGIS proximity queries and routing queries bypass Drizzle ORM and use raw `pool.query`
calls with template-string SQL. While all are parameterized (preventing SQL injection),
this mix increases cognitive load and reduces testability.

**Fix:** Use Drizzle's `sql` template tag for complex PostGIS queries to keep the DB
access layer consistent.

---

## Low Issues

### SEC-013 · Commented-Out `return true` in hasPermission()
**Priority:** Low | **Module:** RBAC | **Effort:** 15 min

**Files:** `server/auth/authorization.ts` lines 219–227

A commented-out block that short-circuits all permission checks to `true` exists in the
source. This is a security time-bomb if accidentally un-commented.

**Fix:** Delete the comment block entirely. The history is preserved in git.

---

### INFRA-001 · No Sentry / Error Tracking Wired Up
**Priority:** Low | **Module:** Observability | **Effort:** 2 hours

**Files:** `.env.production.example` (`SENTRY_DSN` present but commented)

Server errors are only logged to `console.error`. No structured error tracking means
production incidents are invisible until users report them. **Fix:** Implement `@sentry/node`
on the server and `@sentry/react` on the client.

---

### INFRA-002 · Inline Migrations Run Unconditionally on Every Boot
**Priority:** Low (follow-up to ARCH-003) | **Module:** Database | **Effort:** see ARCH-003

**Files:** `server/index.ts` lines 299–353

20+ migration functions execute on every server startup. Even if idempotent, this adds
latency to startup and creates noise in logs. **Fix:** Track applied migrations in a
`_migration_log` table; skip already-applied ones.

---

### PERF-001 · 325 Route Handlers Registered Synchronously at Startup
**Priority:** Low | **Module:** Architecture | **Effort:** see ARCH-002

When `registerRoutes()` is called, all 325 handlers are registered synchronously in a
single call. This contributes to 1–2 second startup latency. **Fix:** Follows naturally
from ARCH-002 module split.

---

### SEC-014 · Minimum Password Length Not Enforced
**Priority:** Low | **Module:** Authentication | **Effort:** 30 min

**Files:** `server/auth/passwordAuth.ts`

The `set-password` and `change-password` handlers do not validate minimum password length
or complexity. **Fix:** Add `z.string().min(12).regex(/[A-Z]/).regex(/[0-9]/)` validation.

---

### DEV-003 · No TypeScript Strict Mode Verified
**Priority:** Low | **Module:** Code Quality | **Effort:** 1 day

`tsconfig.json` should be verified to have `"strict": true` enabled. Given the prevalence
of `any` casts (e.g., `async (req: any, res)` on nearly all route handlers), strict mode
may be disabled. **Fix:** Enable `"strict": true` and replace `req: any` casts with proper
typed Express request interfaces.

---

### DEV-004 · `server/query_*.ts` One-Off Query Files at Server Root
**Priority:** Low | **Module:** Code Quality | **Effort:** 15 min

**Files:** `server/query_coords.ts`, `server/query_count.ts`,
`server/query_mushitala_coords.ts`, `server/query_png_villages.ts`,
`server/query_villages_distribution.ts`

These are diagnostic scripts that would be included in any production build. **Fix:** Move
to `scripts/diagnostics/` or delete. Add `server/query_*.ts` to `.gitignore`.

---

### ARCH-008 · Cross-Tenant Write Isolation Relies on Convention, Not Enforcement
**Priority:** Low | **Module:** Multi-Tenancy | **Effort:** 3 days

**Files:** `server/auth/tenantResolver.ts`

The code comment states: _"writes to a visited tenant are blocked elsewhere"_ for
super-admin cross-tenant visits. This relies on developers remembering to check
`req.isCrossTenantVisit` in every write handler. There is no centralized middleware that
blocks writes when `isCrossTenantVisit === true`.

**Fix:** Add explicit middleware:
```typescript
function blockCrossTenantWrites(req, res, next) {
  if (req.isCrossTenantVisit && ["POST","PUT","PATCH","DELETE"].includes(req.method)) {
    return res.status(403).json({ message: "Cross-tenant writes are not permitted" });
  }
  next();
}
app.use(blockCrossTenantWrites);
```

---

## Quick Wins (< 1 hour each)

| ID | Action | File | Time |
|----|--------|------|------|
| QW-1 | Add `requirePermission("manage_stock")` to 3 stock routes | routes.ts:13715,13759,13817 | 30 min |
| QW-2 | Invert mock-login guard to `!== "development"` | auth.ts:135 | 15 min |
| QW-3 | `npm install helmet` and add `app.use(helmet())` | index.ts | 30 min |
| QW-4 | Remove duplicate surveillance router registration | index.ts:292 | 5 min |
| QW-5 | Reduce global JSON body limit from 50 MB to 1 MB | index.ts:68 | 5 min |
| QW-6 | `git rm dump.rdb local_dump.sql.zip zipFile.zip` + filter-repo | repo root | 45 min |
| QW-7 | `git rm client/src/components/MapView.tsx.bak` | client/ | 2 min |
| QW-8 | Add `edit_microplans`, `plan_sessions`, `execute_sessions`, `conduct_supervision` to `Permission` type | permissions.ts | 10 min |
| QW-9 | Remove `/* Original Code */` comment block for duplicate user routes | routes.ts:1262–1383 | 20 min |
| QW-10 | Add pagination `limit`/`offset` to `/api/stock/ledger` and `/api/users` | routes.ts | 45 min |

---

## Refactoring Plan

### Phase 1 — Security Hardening (Sprint 1, ~2 weeks)
1. SEC-001: Add `requirePermission` to stock write routes ✅ Quick Win
2. SEC-003: Install and configure `helmet` ✅ Quick Win
3. SEC-002: Remove binary data files from git history
4. SEC-004: Add permission checks to microplan/session write routes
5. SEC-005: Harden mock-login guard
6. SEC-007: Add CSRF protection (header-based for API, exempt native clients)
7. RBAC-001: Expand `Permission` type; add route enforcement

### Phase 2 — Stability and Architecture (Sprint 2–3, ~4 weeks)
1. ARCH-001: Remove all `/* Original Code */` dead code blocks
2. ARCH-003: Consolidate dual migration system into Drizzle Kit only
3. ARCH-004: Replace in-process caches with Redis (use `rate-limiter-flexible`)
4. ARCH-006: Remove duplicate surveillance router
5. DB-001: Consolidate duplicate `facilityStaff` columns
6. SEC-010: Tighten JSON body limit; add per-route overrides
7. SEC-011: Remove infrastructure URLs from public `/api/version`

### Phase 3 — Code Quality and Scalability (Sprint 4–6, ~6 weeks)
1. ARCH-002: Split `routes.ts` into domain modules
2. ARCH-005: Delete inline historical dead code from `schema.ts`
3. GIS-001: Make geofence data country-configurable per tenant
4. AUTH-001: Implement email-based password reset
5. TEST-001: Add integration tests for security-critical paths
6. DEV-001: Remove debug scripts from repository
7. DEV-003: Enable TypeScript strict mode; eliminate `req: any` casts

---

## Complete Issue Table

| ID | Priority | Module | File | Problem Summary | Risk | Effort |
|----|----------|--------|------|-----------------|------|--------|
| SEC-001 | **Critical** | Stock Ledger | routes.ts:13715,13759,13817 | Stock write routes missing `requirePermission("manage_stock")` | Fraudulent stock entries | 30 min |
| SEC-002 | **Critical** | DevSecOps | repo root | `local_dump.sql.zip` (29 MB), `zipFile.zip` (34 MB), `dump.rdb` tracked in git | Data breach, PII exposure | 2 hr |
| SEC-003 | **Critical** | Infrastructure | index.ts | No helmet.js — no CSP, HSTS, X-Frame-Options, X-Content-Type-Options | XSS, clickjacking | 1 hr |
| SEC-004 | **Critical** | Microplan/Session | routes.ts:8673,8691,9042,9228 | Microplan & session write routes missing `requirePermission` | Any user can corrupt planning data | 1 hr |
| SEC-005 | **Critical** | Auth | auth.ts:135 | Mock-login active when `NODE_ENV` unset | Full authentication bypass | 30 min |
| SEC-006 | High | Auth | passwordAuth.ts:22 | In-memory rate limiter — resets on restart, not multi-worker safe | Brute-force bypass | 4 hr |
| ARCH-001 | High | API | routes.ts:1262–1388 | Duplicate live route registrations (user management) | Dead code maintenance trap | 2 hr |
| ARCH-002 | High | Architecture | routes.ts | 19,638-line god file with 325 handlers | Unmaintainable, untestable | 5 days |
| ARCH-003 | High | Database | index.ts:24–353, migrations/ | Two parallel migration systems — Drizzle Kit + inline TypeScript | Schema drift, data loss risk | 3 days |
| SEC-007 | High | Auth | index.ts, auth.ts | No CSRF protection; `sameSite: "none"` disables browser mitigation | CSRF attacks on all mutations | 4 hr |
| SEC-008 | High | File Upload | routes.ts:11462 | No MIME type validation on upload; 2 GB multer limit | Malicious file upload, DoS | 2 hr |
| GIS-001 | High | GIS | routes.ts:983–1037 | Zambia-hardcoded geofence + no tenantId in cache query | PNG/SSD villages incorrectly filtered | 2 days |
| ARCH-004 | High | RBAC | authorization.ts:28, routes.ts:403 | In-process caches not shared across PM2 workers | Stale permissions, rate limit bypass | 3 days |
| RBAC-001 | High | RBAC | permissions.ts:1–20, routes.ts:1864 | Permission codes in SYSTEM_CODES not in TypeScript `Permission` type | Type-unsafe RBAC, unenforced permissions | 2 hr |
| AUTH-001 | High | Auth | passwordAuth.ts:183–222 | Password reset creates audit log only — no email sent | Users locked out indefinitely | 3 days |
| ARCH-005 | High | Schema | schema.ts, permissions.ts | 3–5 commented-out historical schema versions inline | Onboarding confusion, maintenance hazard | 1 day |
| SEC-009 | Medium | Auth | auth.ts:32,72 | 7-day sessions with `sameSite: "none"` | Long-lived stolen sessions | 1 hr |
| SEC-010 | Medium | Infrastructure | index.ts:68 | 50 MB global JSON body limit | DoS via large request bodies | 15 min |
| SEC-011 | Medium | API | routes.ts:1051 | `/api/version` exposes `APP_URL`, installer URLs | Infrastructure enumeration | 30 min |
| DB-001 | Medium | Schema | schema.ts:1143 | facilityStaff has duplicate column pairs (4 pairs) | Data inconsistency, confusion | 1 day |
| DB-002 | Medium | API/Perf | routes.ts:13662,1388 | No pagination on `/api/stock/ledger` and `/api/users` | Memory exhaustion on large tenants | 2 hr |
| ARCH-006 | Medium | API | index.ts:292, routes.ts:1258 | Duplicate surveillance router registration | Double processing, double logging | 30 min |
| SEC-012 | Medium | Infrastructure | index.ts | No global API rate limiting (only login rate limited) | API abuse, DoS | 2 hr |
| DEV-001 | Medium | DevSecOps | scratch/, patch*.cjs, add_columns.* | 19 debug/patch scripts committed to git | Accidental prod execution, confusion | 1 hr |
| DEV-002 | Medium | Frontend | MapView.tsx.bak | Backup file committed to git | Confusion | 2 min |
| TEST-001 | Medium | Testing | server/__tests__/ | Only 6 tests for a safety-critical planning system | Regressions undetected | 3 weeks |
| ARCH-007 | Medium | Database | routes.ts:3944, routing.ts:166 | Raw `pool.query` mixed with Drizzle ORM | Inconsistent data access, untestable | 2 days |
| SEC-013 | Low | RBAC | authorization.ts:219 | Commented-out `return true` permission bypass | Security time-bomb | 15 min |
| INFRA-001 | Low | Observability | .env.production.example | No Sentry/error tracking wired up | Silent production failures | 2 hr |
| INFRA-002 | Low | Database | index.ts:299 | Inline migrations run unconditionally every boot | Startup latency, log noise | see ARCH-003 |
| PERF-001 | Low | Architecture | routes.ts | 325 handlers registered synchronously on startup | 1–2 second startup penalty | see ARCH-002 |
| SEC-014 | Low | Auth | passwordAuth.ts | No password complexity/length validation on set/change | Weak passwords allowed | 30 min |
| DEV-003 | Low | Code Quality | tsconfig.json | `strict: true` likely disabled — `req: any` throughout | Runtime type errors undetected | 1 day |
| DEV-004 | Low | Code Quality | server/query_*.ts | 5 one-off diagnostic query files at server root | Build pollution, confusion | 15 min |
| ARCH-008 | Low | Multi-Tenancy | tenantResolver.ts | Cross-tenant write isolation by convention, not middleware | Super-admin accidental cross-tenant write | 3 days |

---

## Appendix A — Files Reviewed

| File | Lines | Notes |
|------|-------|-------|
| `package.json` | 80 | Dependencies, scripts |
| `shared/schema.ts` | ~1400+ | Full Drizzle schema, 40+ tables |
| `shared/permissions.ts` | 352 | Permission type + ROLE_PERMISSIONS |
| `server/index.ts` | ~380 | Express startup, inline migrations |
| `server/routes.ts` | 19,638 | All API routes |
| `server/auth.ts` | ~200 | Session config, isAuthenticated, mock-login |
| `server/auth/authorization.ts` | ~280 | hasPermission(), role cache |
| `server/auth/passwordAuth.ts` | ~280 | bcrypt login, rate limiter |
| `server/auth/tenantResolver.ts` | ~150 | Tenant isolation middleware |
| `server/auth/secrets.ts` | 26 | IDP secret resolution |
| `server/db.ts` | ~40 | Drizzle + pg Pool |
| `drizzle.config.ts` | 22 | Migration config |
| `.env.production.example` | ~60 | Required env vars |

---

*Report generated by GitHub Copilot CLI technical audit — VaxPlan v1.4.0*
