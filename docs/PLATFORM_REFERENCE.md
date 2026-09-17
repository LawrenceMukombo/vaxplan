# VaxPlan platform reference

**Applies to:** repository version 1.9.4, reviewed 14 September 2026.

This is the canonical functional map of VaxPlan. Tenant settings can disable selected modules, and role or geographic scope can further restrict access. A route existing in the application does not by itself grant permission to use it.

## Product model

VaxPlan separates data by tenant and then applies geographic scope and permissions inside that tenant. The common hierarchy is Region or Province → District → LLG or equivalent → Facility → Community or Village. Tenant labels may rename these levels without changing their relationships.

Operational planning has two distinct plan types:

- **Routine** plans cover recurring immunization delivery.
- **Campaign** plans cover SIA, outbreak response, and other time-bound delivery. Campaign work adds readiness, target quotas, summary sheets, and real-time monitoring.

Plans move through `draft`, `pending`, `under_review`, `returned`, `approved`, `rejected`, `locked`, `archived`, or `superseded` states. Available actions depend on permission, role delegation, plan type, current state, and geographic scope.

## Application routes and modules

| Area | Primary routes | What it provides |
| --- | --- | --- |
| Dashboard | `/` | Tenant and scope-aware operational overview |
| Guided planning | `/flow`, `/microplan/new` | Unified routine or campaign wizard |
| Routine microplans | `/microplans/routine`, `/microplans/routine/:id` | Plan list, authoring, review, approval, and versioned editing |
| Campaign microplans | `/microplans/campaigns`, `/microplans/campaigns/:id` | SIA and campaign planning |
| Campaign operations | `/campaigns/summary-sheets`, `/campaigns/realtime-dashboard`, `/campaigns/readiness` | Summary sheets, readiness, quotas, and live campaign monitoring |
| Planning assurance | `/plan-health`, `/planning-actions`, `/planning-evidence`, `/field-readiness` | Readiness gates, corrective actions, evidence, and field readiness |
| Sessions | `/sessions`, `/all-sessions`, `/sessions/history`, `/sessions/:id/day-plans` | Session planning, multi-day logistics, execution, and history |
| GIS and geography | `/map`, `/settlements`, `/facilities`, `/population`, `/htr`, `/missed-communities` | Facilities, communities, polygons, catchments, population, HTR and missed-area analysis |
| Client outcomes | `/clients`, `/clients/defaulters`, `/indicators/dropout`, `/indicators/zero-dose` | Client logbook, vaccinations, defaulters, dropout and zero-dose analysis |
| Logistics | `/stock`, `/cold-chain`, `/vaccines`, `/budget`, `/mobilization` | Stock transactions, equipment, forecasting, budgets and social mobilization |
| Supervision | `/supervision`, `/supervision/templates`, `/supervision-tools`, `/pce`, `/house-to-house` | Visits, checklists, scorecards, template governance and field tools |
| Surveillance and risk | `/surveillance`, `/risk-assessments`, `/risk-assessments/:id` | VPD cases, laboratory records, assessment methods, district inputs, results and actions |
| Reporting | `/reports`, `/indicators/manual`, `/national-plan`, `/standards-alignment` | Reports, definitions, annual planning, and standards/capability catalogue |
| Field operations | `/chw-field`, `/field-teams` | CHW workspace and team management |
| Administration | `/admin/users`, `/admin/staff`, `/admin/signups`, `/admin/countries`, `/admin/boundaries`, `/admin/custom-layers`, `/admin/catalogue`, `/admin/reconcile-vaccines`, `/admin/wiki` | Tenant setup, identities, geography, catalogue and content administration |
| Integration and data | `/his-integrations`, `/data-sources`, `/api-reference` | HIS configuration, provenance and API reference surfaces |
| Audit and support | `/notifications`, `/temporal-history`, `/settings`, `/help`, `/sync/conflicts`, `/desktop-hub` | Alerts, settings, audit history, documentation, offline state and conflict recovery |
| Research and VGIE | `/research`, `/research/admin`, `/vgie/recommendations`, `/vgie/alerts` | Research publications, recommendation rules and operational alerts |

Legacy links such as `/develop-microplan` redirect into the current routine microplan workspace. `/outreach-map` and `/facilities/outreach-map` open the outreach-post map within Facilities.

## Module configuration

Tenant settings can enable or disable individual capabilities. Current gates include map, facilities, settlement intelligence, population, routine plans, campaigns, campaign summaries, campaign dashboard, campaign readiness, sessions, client logbook, defaulters, dropout, zero-dose, stock, HTR, budget, vaccine calculator, mobilization, supervision, interoperability, missed communities, and field teams. Disabled modules render an explanatory disabled state rather than exposing their workspace.

Some routes are always mounted but remain protected by server-side authorization. Client-side hiding or route guards are a usability layer, not the security boundary.

## Roles, permissions, and geographic scope

Built-in role codes include:

- `facility_clerk` and `facility_in_charge`
- `district_manager` and `provincial_coordinator`
- `national_manager` and `national_admin`
- `gis_specialist`
- facility, district, provincial, and national partner roles

Tenants can also maintain role definitions and granular permissions. Users may have a primary role, additional roles, direct permission overrides, and a data-access scope. Role delegation rules prevent administrators from assigning roles above their own delegation level unless they hold exceptional delegation permission.

Hierarchical roles fail closed when no usable geographic assignment can be resolved. Facility users are facility-scoped, district users are district-scoped, provincial users are province-scoped, and authorized national users are tenant-wide. Platform-level super-administration is separate from ordinary national administration.

## Core records

The data model includes tenants and identity; administrative geography; facilities and facility staff; villages and settlements; polygons and catchments; population; microplans, versions, session plans and day plans; clients and vaccinations; budgets, vaccine requirements, mobilization and stock; cold-chain equipment; supervision visits and versioned templates; surveillance cases and laboratory samples; annual plans and quarterly reviews; notifications and communications; catalogue records; audit and temporal-history records; planning actions and evidence; and risk-assessment methods, runs, results, responses and action links.

See [the database schema guide](./architecture/vaxplan-database-schema.md) for relationship detail. Migrations remain the authority for deployed database evolution; `shared/schema.ts` is the application model and can include compatibility declarations.

## Governance and audit behavior

- Tenant context is required for tenant-owned API operations.
- Authorization is enforced on the server with permission checks and geographic scoping.
- Material administrative and workflow changes are written to audit/history records where implemented.
- Microplan versioning, temporal entity histories, report snapshots, planning-action histories, planning-evidence histories, and supervision-template versions preserve decision context.
- Approval or locking does not imply that every related record is immutable; consult the applicable workflow guide and permission policy.

## Deployment surfaces

The same application is packaged for web/PWA, Android via Capacitor, and Windows via Electron. Network detection is abstracted across these platforms. Feature availability can still vary by deployment configuration, tenant modules, browser/device capabilities, and enabled external services.

## Source-of-truth precedence

When documents disagree, use this order:

1. Executable route, authorization, service, and schema code plus applied migrations.
2. This platform reference and the current user/developer guides.
3. Module walkthroughs and release notes for their stated release.
4. Planning records, stakeholder collateral, screenshots, and exported Word manuals.
