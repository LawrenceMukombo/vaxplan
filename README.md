# VaxPlan

> **Proprietary and confidential.** VaxPlan is proprietary software owned by Vumbi2018. See [LICENSE](./LICENSE) for the applicable terms.

VaxPlan is a multi-tenant, offline-capable immunization planning and field-operations platform. It combines routine and campaign microplanning, GIS catchment intelligence, session execution, client vaccination records, vaccine and cold-chain logistics, supportive supervision, surveillance, risk assessment, reporting, and governance in one application.

The application currently reports version **1.9.4** in `package.json`. The source code, not screenshots or historical stakeholder material, is the authority for current behavior.

## Current capabilities

- Routine and supplementary immunization activity microplans, printable plans, approvals, version history, readiness checks, action registers, and evidence records.
- Campaign summary sheets, readiness assessments, target quotas, and a real-time campaign dashboard.
- Facilities, outreach posts, settlements, administrative boundaries, custom layers, catchment polygons, population denominators, hard-to-reach scoring, missed-community and zero-dose views.
- Session planning, multi-day field plans, execution history, client logbook, defaulters, dropout indicators, stock ledger, vaccine calculator, budget and mobilization workspaces.
- Supportive supervision visits, versioned checklist templates, scorecards, PCE, house-to-house tools, and corrective actions.
- Vaccine-preventable disease surveillance, laboratory samples, configurable risk methodologies, district data entry, choropleth results, and action links.
- Tenant administration, country onboarding, dynamic roles and permissions, geographic data scopes, catalogue management, audit/history views, notifications, and HIS integration surfaces.
- Offline authentication and a Dexie/IndexedDB replica with queued writes, automatic and manual synchronization, retry recovery, and conflict review.
- Web/PWA, Android/Capacitor, and Windows/Electron packaging.

## Technology

- React 18, TypeScript, Vite, TanStack Query, Tailwind CSS, Radix UI, Leaflet and MapLibre.
- Node.js and Express, PostgreSQL/PostGIS, Drizzle ORM, Redis/BullMQ where configured.
- Vitest for automated tests; Capacitor for Android; Electron Forge for Windows.

## Local development

Requirements: Node.js 20 or newer and PostgreSQL with PostGIS. Redis is optional for deployments that enable queued messaging or background work.

1. Copy `.env.production.example` to a local environment file and supply at least `DATABASE_URL` and `SESSION_SECRET`. Never commit credentials.
2. Install dependencies with `npm ci`.
3. Apply the approved database migration procedure for the target environment. For existing databases, prefer `npm run db:safe-update`; do not assume `db:push` is safe for production data.
4. Start the development server with `npm run dev` and open `http://localhost:5000` unless `PORT` overrides it.

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the TypeScript development server |
| `npm run check` | Run TypeScript validation |
| `npm test` | Run the Vitest suite |
| `npm run build` | Create the production web/server bundle |
| `npm run docs:site` | Build the documentation site |
| `npm run docs:pdf` | Build the user-guide PDF |
| `npm run build:android` | Build and synchronize the Android project |
| `npm run build:windows` | Build the Windows desktop package |

`npm start` is production-oriented and runs the bundled bootstrap before starting `dist/index.cjs`. Use it only after `npm run build` and with a production-ready environment.

## Documentation

Start with the [documentation index](./docs/README.md). The canonical references are:

- [Platform reference](./docs/PLATFORM_REFERENCE.md) — modules, routes, roles, status models, and source-of-truth rules.
- [User guide](./docs/USER_GUIDE.md) — task-focused workflows for field, district, provincial, national, and platform users.
- [Developer guide](./docs/DEVELOPER_GUIDE.md) — repository structure, architecture, validation, migrations, and documentation maintenance.
- [Offline and synchronization guide](./docs/OFFLINE_AND_SYNC.md) — local data behavior, queued writes, retries, conflicts, and recovery.
- [Safe deployment guide](./docs/deployment/vaxplan-safe-deployment-guide.md) — production deployment and data-safety controls.
- [Release notes](./docs/releases.md) and [changelog](./CHANGELOG.md) — user-facing and repository release history.

Historical Word manuals and stakeholder documents remain in the repository as publication artifacts. They are not the canonical reference for current application behavior unless regenerated from the current Markdown sources.
