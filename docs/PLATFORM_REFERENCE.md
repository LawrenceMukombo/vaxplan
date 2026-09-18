# VaxPlan Platform Reference Manual

**Applies to:** Repository version 1.9.4, reviewed September 2026.

This is the canonical functional specification and route reference for VaxPlan. Access to routes is governed by tenant configuration, assigned user roles, and geographic access scopes.

---

## 1. Product Model & Operational Cadences

VaxPlan separates data strictly by sovereign tenant (Ministry of Health). Within each tenant, data access is scoped hierarchically: `Country → Province / Region → District / County → Facility → Community / Settlement`.

### Microplanning Cadences:
1. **Routine Immunization (`routine`)**: Continuous quarterly or annual operational plans for fixed, outreach, and mobile sessions.
2. **Periodic Intensification of Routine Immunization (`periodic_intensification` / PIRI)**: Time-bound intensified catch-up sessions targeting low-coverage communities.
3. **Outbreak Response Immunization (`outbreak_response` / ORI)**: Rapid ring-vaccination and containment campaigns triggered by epidemiological surveillance signals.
4. **Supplemental Immunization Activities (`supplemental` / SIA)**: High-volume mass campaigns (e.g., national measles-rubella or bOPV campaigns).

---

## 2. Complete Application Routes & Modules Inventory

| Category | Primary Routes | Capabilities & Functionality |
| :--- | :--- | :--- |
| **Dashboards** | `/` | Operational KPI cards, interactive geospatial overview, and Smart GeoCascade filtering. |
| **Guided Planning** | `/flow`, `/microplan/new` | 5-stage unified wizard for routine, PIRI, ORI, and SIA microplanning. |
| **Routine Plans** | `/microplans/routine`, `/microplans/routine/:id` | Facility plan authoring, demographic pre-fill, resource calculation, and approval routing. |
| **Campaigns** | `/microplans/campaigns`, `/microplans/campaigns/:id` | High-level SIA planning, multi-facility coordination, and campaign horizons. |
| **Campaign Ops** | `/campaigns/summary-sheets`, `/campaigns/realtime-dashboard`, `/campaigns/readiness` | Daily summary returns, real-time quota tracking, and multi-domain readiness audits. |
| **Planning Assurance**| `/plan-health`, `/planning-actions`, `/planning-evidence`, `/field-readiness` | Quality gates, corrective action plans with assigned owners, and historical evidence trails. |
| **Sessions** | `/sessions`, `/all-sessions`, `/sessions/history`, `/sessions/:id/day-plans` | Session planning, 5km proximity clash detection, multi-day logistics, and closeout tallies. |
| **GIS & Demographics**| `/map`, `/settlements`, `/facilities`, `/population`, `/htr`, `/missed-communities` | WorldPop zonal population estimation (`/api/population/estimate-polygon`), remote sensing gap analysis (`/api/remote-sensing/gaps`), catchment polygon drawing, and travel-time isochrones. |
| **Client Outcomes** | `/clients`, `/clients/defaulters`, `/indicators/dropout`, `/indicators/zero-dose` | Electronic Immunization Registry (EIR), client logbook, automated dropout rate analysis, zero-dose tracking, and SMS reminders. |
| **Logistics & Stock** | `/stock`, `/cold-chain`, `/vaccines`, `/budget`, `/mobilization` | Batch/lot stock ledger, CCEOP cold chain equipment inventory, vaccine forecasting, and social mobilization plans. |
| **Supervision** | `/supervision`, `/supervision/templates`, `/supervision-tools`, `/pce`, `/house-to-house` | 7-domain supervisory visits, custom checklist builder with conditional logic, traffic-light scoring, and executive scorecards. |
| **Surveillance & Risk**| `/surveillance`, `/risk-assessments`, `/risk-assessments/:id` | VPD case surveillance, 4-factor risk scoring methodology, AI decision support, and linked interventions. |
| **Analytics & Reports**| `/reports`, `/indicators/manual`, `/national-plan`, `/standards-alignment` | PDF/Excel exports, indicator reference manual with knowledge mastery gamification, and WHO/UNICEF/Gavi alignment matrix. |
| **Field Operations** | `/chw-field`, `/field-teams` | Community health worker logbook, household tracking, and mobile field team rosters. |
| **Administration** | `/admin/users`, `/admin/staff`, `/admin/signups`, `/admin/countries`, `/admin/boundaries`, `/admin/custom-layers`, `/admin/catalogue`, `/admin/reconcile-vaccines`, `/admin/wiki` | User management with batch actions, country onboarding, GeoBoundaries ingestion, vaccine catalogue, and in-app markdown wiki editor. |
| **Integrations** | `/his-integrations`, `/data-sources`, `/api-reference` | Bi-directional DHIS2 integration, data source provenance, and interactive 11-module REST API reference. |
| **System & Support** | `/notifications`, `/temporal-history`, `/settings`, `/help`, `/sync/conflicts`, `/desktop-hub` | Audit logs, temporal history, offline IndexedDB sync conflict recovery, and desktop hub. |

---

## 3. Interoperability & External Connectors

### DHIS2 Integration Engine (`/his-integrations`)
- **Supported Standards**: DHIS2 Web API v2.36+, ADX (Aggregate Data Exchange), and standard `dataValueSets` JSON.
- **Org Unit Resolution**: Dynamic mapping of VaxPlan facility codes and district polygons to DHIS2 Organisation Unit UIDs.
- **Aggregate Export**: Automated extraction of completed microplan sessions and vaccination totals mapped directly to DHIS2 Data Elements and Category Option Combos.
- **Security**: Server-side credential management using environment variable references with dry-run payload verification.

---

## 4. Security & Governance Principles

1. **Server-Side Enforcement**: All authorization policies, permission sets, and geographic scopes are validated on the server. Client-side route guards serve purely for UI state management.
2. **Data Safety Protocol**: Safe additive database schema updates (`npm run db:push` or versioned migrations) ensure existing operational records, audit histories, and uploaded assets are never destroyed or overwritten.
3. **Audit Trail**: All administrative actions, role assignments, microplan status transitions, and data sync executions are permanently recorded in the audit log.
