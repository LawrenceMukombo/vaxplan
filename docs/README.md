# VaxPlan documentation

This directory documents version 1.9.4 of the repository. Use the documents under **Canonical product documentation** for current behavior. Planning notes, stakeholder collateral, screenshots, and old exported manuals may describe a particular release rather than the live application.

## Canonical product documentation

| Document | Audience | Purpose |
| --- | --- | --- |
| [Platform reference](./PLATFORM_REFERENCE.md) | Everyone | Complete module and route catalogue, roles, permissions, statuses, and terminology |
| [End-user guide](./USER_GUIDE.md) | Program and field users | Operational workflows by role |
| [Developer guide](./DEVELOPER_GUIDE.md) | Engineers and maintainers | Architecture, repository layout, migrations, testing, builds, and documentation rules |
| [Offline and sync](./OFFLINE_AND_SYNC.md) | Field users, support, engineers | Offline sign-in, local data, outbox, retry, conflicts, and troubleshooting |
| [Indicator manual](./INDICATOR_MANUAL.md) | M&E and program teams | Indicator definitions and interpretation |
| [Country onboarding](./COUNTRY_ONBOARDING.md) | Platform and national administrators | Tenant, geography, facility, catalogue, and user setup |
| [DHIS2 country integration](./DHIS2_INTEGRATION.md) | National administrators and integration engineers | Configure, validate, map, and operate a country DHIS2 connection |
| [Safe deployment guide](./deployment/vaxplan-safe-deployment-guide.md) | Operators | Data-safe production deployment |
| [Release notes](./releases.md) | Users and operators | Release highlights and upgrade implications |

## Workflow guides

- [Facility quick start](./QUICKSTART_FACILITY.md)
- [Complete walkthrough](./walkthroughs/vaxplan-complete-walkthrough.md)
- [Microplanning workflow](./microplanning-workflow.md)
- [Microplanning readiness prefill](./microplanning-readiness-prefill.md)
- [Planning evidence workflow](./modules/planning-evidence-workflow.md)
- [Microplan approval policy](./modules/microplan-approval-policy.md)
- [RED microplanning](./modules/red-microplanning-wizard.md)
- [Facilities](./modules/facilities-module-walkthrough.md), [GIS](./modules/gis-microplanning-walkthrough.md), and [polygon drawing](./modules/polygon-drawing-walkthrough.md)
- [Population intelligence](./modules/population-intelligence-walkthrough.md)
- [Sessions](./modules/sessions-walkthrough.md)
- [Supportive supervision](./modules/supervision-tools-walkthrough.md)
- [Administration](./modules/admin-management-walkthrough.md)

## Technical references

- [Architecture diagrams](./architecture/vaxplan-architecture-diagrams.md)
- [Database schema guide](./architecture/vaxplan-database-schema.md)
- [Temporal framework](./architecture/enterprise-temporal-framework.md)
- [Polygon lifecycle](./polygon-lifecycle.md)
- [Email configuration](./email-setup.md)
- [WHO, UNICEF, Gavi and MoH alignment](./who-unicef-gavi-alignment.md)

## Status of other material

- `planning-*-implementation*.md` files are implementation records, not user instructions.
- Files under `templates/` are authoring templates.
- `VAXPLAN_*` stakeholder, business, organizational, and slide-deck sources are communications collateral. Validate quantitative, roadmap, security, and standards claims before external reuse.
- Root-level `.docx` manuals are retained publication snapshots. Their filenames do not establish that they reflect version 1.9.4.
- `client/public/docs/microplanning-workflow.md` is the application-served copy of the microplanning guide. Keep it synchronized with `docs/microplanning-workflow.md` when that guide changes.

## Documentation maintenance rule

For every user-visible change, update the relevant canonical guide and `docs/releases.md` in the same change. When routes, role gates, module flags, schemas, environment variables, or offline entities change, also update `PLATFORM_REFERENCE.md`, `DEVELOPER_GUIDE.md`, or `OFFLINE_AND_SYNC.md` as applicable. Run `npm run docs:site` and a link check before release.
