# VaxPlan developer guide

This guide explains how to work safely in the VaxPlan repository. It describes version 1.9.4; verify commands and configuration against `package.json` before use.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `client/src` | React application, routes, pages, components, hooks, local/offline data, and client authorization helpers |
| `server` | Express API, authentication, tenant and geographic scoping, persistence, jobs, integrations, and synchronization |
| `shared` | Drizzle schemas, shared validation, permissions, feature configuration, and domain helpers |
| `migrations` | SQL evolution, including additive planning and RED changes |
| `scripts` | Imports, migration runners, deployment, seeding, GIS/population ingestion, and packaging support |
| `script/build.ts` | Production build orchestration |
| `docs` and `docs-site` | Source documentation and static documentation build |
| `android` and `electron` | Native packaging projects |

Generated directories such as `dist`, `out`, and `electron-dist` are build products. Logs, `scratch`, imported datasets, and office artifacts are not application source.

## Runtime architecture

The React client uses Wouter for routing and TanStack Query for server state. Express serves the API and production client bundle. PostgreSQL/PostGIS stores tenant and spatial data through Drizzle. Redis/BullMQ is used only where configured. The offline client maintains a Dexie/IndexedDB replica and exchanges changes through sync endpoints.

Every tenant-owned server operation must resolve tenant context. Sensitive operations also require explicit permission middleware and, where relevant, geographic scope filtering. Never rely solely on a hidden navigation item or client route guard.

## Setup

1. Install Node.js 20 or newer and PostgreSQL with PostGIS.
2. Run `npm ci`.
3. Configure a local environment file. Required values depend on the feature set, but `DATABASE_URL` and a strong `SESSION_SECRET` are baseline server requirements.
4. Apply migrations using the repository's approved safe migration procedure.
5. Run `npm run dev`.

Optional services and integrations include Redis, SMTP or SendGrid, SMS/WhatsApp providers, OpenRouteService, DHIS2 mappings, release download URLs, and Gemini-backed features. Keep secrets outside source control.

## Validation

Run the checks proportionate to the change:

```text
npm run check
npm test
npm run build
npm run docs:site
```

For schema or persistence changes, add focused tests and validate against a disposable database. For offline changes, test online creation, offline creation/editing, queued replay, retry exhaustion, reconnect, tenant change, and conflict/warning behavior. For authorization changes, test both route access and server rejection across roles and scopes.

## Database changes

- Prefer additive, reviewable migrations with safe defaults and backfills.
- Do not use destructive schema synchronization against production data.
- Treat applied SQL migrations as deployment history and `shared/schema.ts` as the application model.
- Preserve tenant identifiers, foreign keys, uniqueness rules, identity sequences, and audit/history behavior.
- Make replay or bootstrap scripts idempotent and document required feature flags.
- Back up and verify before any migration that transforms existing rows.

## Authorization changes

VaxPlan supports primary and additional roles, dynamic role records, direct permission overrides, delegation levels, and geographic data scopes. When adding an operation:

1. Define or reuse a narrowly scoped permission.
2. Enforce it in the API.
3. Apply tenant and geographic scope to reads and writes.
4. Add the client affordance only after the server boundary is correct.
5. Add allow and deny tests, including a hierarchical user with no assignment; that case should fail closed.

## Offline changes

Adding an offline-capable entity requires coordinated changes to the local schema, pull payload, local hydration, queued mutation path, server batch handler, ID reconciliation, and tests. Schema-version upgrades must preserve queued work. Do not clear an outbox as a migration shortcut.

See [Offline operation and synchronization](./OFFLINE_AND_SYNC.md).

## Documentation changes

Update documentation in the same change as behavior:

- New route or module: update `PLATFORM_REFERENCE.md` and the applicable user workflow.
- New permission, role, status, or scope behavior: update the platform reference and admin guide.
- New offline entity or recovery behavior: update `OFFLINE_AND_SYNC.md`.
- New environment or deployment step: update the deployment guide and example environment file.
- User-visible release: update `docs/releases.md` and `CHANGELOG.md`.

Avoid copying generated Markdown into multiple locations. The current exception is `docs/microplanning-workflow.md`, whose served copy under `client/public/docs` must remain byte-for-byte synchronized. Treat root Word manuals as exported snapshots unless the release process explicitly regenerates them.
