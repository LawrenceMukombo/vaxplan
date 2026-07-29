# VaxPlan Database Schema Reference

This document is a plain-text, renderer-independent view of the VaxPlan database schema. It is based on `shared/schema.ts` and the current application architecture.

Use this file when Mermaid diagrams do not render or when reviewers need to see the database model directly.

## 1. Schema Overview

VaxPlan is a multi-tenant platform. Most operational tables include `tenantId` and must be queried within the active tenant context.

Core model:

```text
tenants
  -> users / user_roles / user_permissions / device_tokens
  -> regions -> provinces -> districts -> llgs -> villages
  -> facilities -> microplans -> session_plans -> session_day_plans
  -> facilities -> clients -> client_vaccinations
  -> facilities -> stock_transactions / monthly_reports / cold_chain_equipment
  -> admin_boundaries / custom_layers / gis_polygons / facility_catchments
  -> settlements_master / population_grids / candidate_unmapped_settlements
  -> supervision_visits / surveillance_cases / lab_samples
  -> notifications / communications / audit_logs
```

## 2. Tenant, Authentication and Access Control

| Table | Key Columns | Purpose |
|---|---|---|
| `tenants` | `id`, `name`, `code`, `countryCode`, `status`, `settings`, `createdAt`, `updatedAt` | Country or organization workspace. |
| `tenant_idp_configs` | `id`, `tenantId`, `protocol`, `issuer`, `metadata`, `enabled`, `createdAt`, `updatedAt` | Tenant identity provider configuration. |
| `signup_requests` | `id`, tenant/request fields, `status`, applicant/contact fields, `createdAt`, `updatedAt` | User or organization onboarding approval. |
| `tenant_interest_requests` | `id`, organization/contact fields, interest metadata, `createdAt` | Tenant interest capture. |
| `sessions` | `sid`, `sess`, `expire` | Express session storage. |
| `users` | `id`, `tenantId`, `email`, `firstName`, `lastName`, `role`, `roles`, `permissions`, `dataAccessScope`, `facilityId`, `districtId`, `provinceId`, `hmisCode`, `isActive`, `passwordHash`, `isPlatformAdmin`, `notificationPrefs`, `createdAt`, `updatedAt` | User identity, role, permissions and geographic access scope. |
| `user_roles` | `id`, `tenantId`, `code`, `name`, `description`, `permissions`, `isSystem`, `createdAt`, `updatedAt` | Tenant-specific role definitions. |
| `user_permissions` | `id`, `tenantId`, `code`, `name`, `description`, `module`, `createdAt`, `updatedAt` | Tenant-specific permission catalogue. |
| `device_tokens` | `id`, `tenantId`, `userId`, `token`, `platform`, `isActive`, `createdAt`, `updatedAt` | Push or device notification registration. |

Important rules:

- `users.tenantId` defines the user's home tenant.
- `users.roles` and `user_roles.permissions` support dynamic RBAC.
- `users.facilityId`, `users.districtId`, `users.provinceId` and `users.dataAccessScope` drive row-level geographic access.
- `isPlatformAdmin` is privileged and should be tightly controlled.

## 3. Administrative Geography and Facilities

| Table | Key Columns | Purpose |
|---|---|---|
| `regions` | `id`, `tenantId`, `name`, `code`, `createdAt`, `updatedAt` | Highest optional subnational geography. |
| `provinces` | `id`, `tenantId`, `regionId`, `name`, `code`, `createdAt`, `updatedAt` | Province/state level. |
| `districts` | `id`, `tenantId`, `provinceId`, `name`, `code`, `createdAt`, `updatedAt` | District level and common management scope. |
| `llgs` | `id`, `tenantId`, `districtId`, `name`, `code`, `createdAt`, `updatedAt` | Ward/LLG/local planning unit. |
| `facilities` | `id`, `tenantId`, `name`, `hmisCode`, `facilityType`, `agencyName`, `operationalStatus`, `districtId`, `latitude`, `longitude`, `address`, `contact`, `operatingHours`, `hasRefrigerator`, `hasPower`, `staffCount`, `catchmentRadius`, `catchmentPolygon`, `catchmentGridPopulation`, `externalIds`, `isActive`, `createdAt`, `updatedAt` | Health facility and main planning unit. |
| `villages` | `id`, `tenantId`, `name`, `districtId`, `llgId`, `assignedFacilityId`, `latitude`, `longitude`, population fields, outreach post fields, boundary/geometry fields, `createdAt`, `updatedAt` | Community, village or settlement served by facilities. |
| `facility_excluded_villages` | `id`, `tenantId`, `facilityId`, `villageId`, `reason`, `createdAt` | Explicit exclusion of villages from a facility catchment. |

Primary relationships:

```text
regions.id -> provinces.regionId
provinces.id -> districts.provinceId
districts.id -> llgs.districtId
districts.id -> facilities.districtId
districts.id -> villages.districtId
llgs.id -> villages.llgId
facilities.id -> villages.assignedFacilityId
facilities.id -> facility_excluded_villages.facilityId
villages.id -> facility_excluded_villages.villageId
```

## 4. Microplanning and Session Planning

| Table | Key Columns | Purpose |
|---|---|---|
| `annual_immunization_plans` | `id`, `tenantId`, `year`, geography scope fields, plan/target/budget fields, `createdAt`, `updatedAt` | Annual national or subnational immunization plan. |
| `microplans` | `id`, `tenantId`, `facilityId`, `year`, `quarter`, `planType`, `status`/`approvalStatus`, target population fields, resource fields, `createdAt`, `updatedAt` | Facility or campaign microplan container. |
| `session_plans` | `id`, `tenantId`, `microplanId`, `facilityId`, `name`, `sessionType`, `planType`, `scheduledDate`, location/target/status fields, `createdAt`, `updatedAt` | Planned fixed, outreach or mobile session. |
| `session_villages` | `id`, `tenantId`, `sessionId`, `villageId`, target fields, `createdAt` | Many-to-many bridge between sessions and villages. |
| `session_day_plans` | `id`, `tenantId`, `sessionPlanId`, `dayNumber`, `sessionDate`, team/resource/transport/supply/actuals fields, `createdAt`, `updatedAt` | Operational day plan for a session. |
| `budget_items` | `id`, `tenantId`, `microplanId`, activity/item fields, cost fields, funding fields, `createdAt`, `updatedAt` | Microplan budget lines. |
| `vaccine_requirements` | `id`, `tenantId`, `microplanId`, vaccine/commodity fields, quantity fields, `createdAt`, `updatedAt` | Vaccine and commodity forecast. |
| `mobilization_activities` | `id`, `tenantId`, `microplanId`, activity, owner, schedule/status fields, `createdAt`, `updatedAt` | Social mobilization and community engagement plan. |
| `approval_requests` | `id`, `tenantId`, `microplanId`, requester/reviewer/status/comment fields, `createdAt`, `updatedAt` | Microplan review and approval workflow. |
| `quarterly_reviews` | `id`, `tenantId`, `year`, `quarter`, geography/facility fields, review metrics, notes, `createdAt`, `updatedAt` | Quarterly performance review. |

Primary relationships:

```text
facilities.id -> microplans.facilityId
microplans.id -> session_plans.microplanId
facilities.id -> session_plans.facilityId
session_plans.id -> session_villages.sessionId
villages.id -> session_villages.villageId
session_plans.id -> session_day_plans.sessionPlanId
microplans.id -> budget_items.microplanId
microplans.id -> vaccine_requirements.microplanId
microplans.id -> mobilization_activities.microplanId
microplans.id -> approval_requests.microplanId
```

Business rules:

- Session plans should be children of a parent microplan.
- Routine and campaign/SIA plan types should not be mixed.
- Approved or locked microplans should restrict child session edits.
- Budgets, vaccines and mobilization records belong to the parent microplan.

## 5. GIS, Catchments, Settlements and Population

| Table | Key Columns | Purpose |
|---|---|---|
| `admin_boundaries` | `id`, `tenantId`, geography fields, boundary source/type, geometry, metadata, `createdAt`, `updatedAt` | Country and subnational boundary polygons. |
| `custom_layers` | `id`, `tenantId`, `name`, category/type/format, geometry/file metadata, style fields, `createdAt`, `updatedAt` | Tenant-defined GIS layers. |
| `facility_catchments` | `id`, `tenantId`, `facilityId`, geometry, metadata, `createdAt`, `updatedAt` | Facility catchment polygon records. |
| `gis_polygons` | `id`, `tenantId`, polygon type, geometry, metadata, owner/context fields, `createdAt`, `updatedAt` | General planning and validation polygons. |
| `catchment_conflicts` | `id`, `tenantId`, facility/village/context fields, conflict metadata, status, `createdAt`, `updatedAt` | Overlap or disputed assignment records. |
| `settlements_master` | `id`, `tenantId`, geography/facility context, name, coordinates, geometry, population/source fields, status, `createdAt`, `updatedAt` | Master settlement inventory. |
| `population_grids` | `id`, `tenantId`, source, grid metadata, file/coverage fields, status, `createdAt`, `updatedAt` | Gridded population source records. |
| `candidate_unmapped_settlements` | `id`, `tenantId`, geography, coordinates, match/status fields, source metadata, `createdAt`, `updatedAt` | Candidate missed or unmapped settlements. |
| `imported_coverage` | `id`, `tenantId`, geography/facility context, antigen/period/coverage fields, source metadata, `createdAt`, `updatedAt` | Imported coverage values for triangulation. |
| `csv_imports` | `id`, `tenantId`, filename, import type, status, summary/error fields, `createdAt`, `updatedAt` | Import tracking. |
| `population_data` | `id`, `tenantId`, geography/facility/village context, source, category, value/year fields, `createdAt`, `updatedAt` | Operational population denominators and targets. |
| `population_refresh_jobs` | `id`, `tenantId`, status, trigger, source metadata, timing/error fields, `createdAt`, `updatedAt` | Population refresh lifecycle tracking. |

VGIE tables:

| Table | Purpose |
|---|---|
| `vgie_settlement_facility_links` | Links settlements to facilities and supports settlement assignment review. |
| `vgie_recommendations` | Stores GIS intelligence recommendations. |
| `vgie_alerts` | Stores GIS intelligence alerts. |
| `vgie_recommendation_rules` | Configurable recommendation rules. |
| `vgie_alert_rules` | Configurable alert rules. |

GIS rules:

- Tenant/country boundary validation is critical.
- Unserved places must not appear in neighboring countries.
- Facility pin movement and catchment polygon edits should be audited.
- Population grid outputs should retain source and vintage metadata.

## 6. Service Delivery, Stock, Catalogue and Reporting

| Table | Key Columns | Purpose |
|---|---|---|
| `clients` | `id`, `tenantId`, `facilityId`, `villageId`, client identifier fields, demographic fields, parent/contact fields, status fields, `createdAt`, `updatedAt` | Client registry. |
| `client_vaccinations` | `id`, `tenantId`, `clientId`, `facilityId`, vaccine/dose/date/batch fields, worker fields, `createdAt`, `updatedAt` | Vaccination event records. |
| `stock_transactions` | `id`, `tenantId`, `facilityId`, vaccine/commodity fields, transaction type, quantity, batch, VVM/status/date fields, notes, `createdAt`, `updatedAt` | Stock ledger movement. |
| `monthly_reports` | `id`, `tenantId`, `facilityId`, reporting period fields, service/stock/coverage metrics, status, `createdAt`, `updatedAt` | Routine monthly report. |
| `cold_chain_equipment` | `id`, `tenantId`, `facilityId`, equipment type/model/capacity/status fields, maintenance fields, `createdAt`, `updatedAt` | Cold-chain inventory and readiness. |
| `vaccine_configurations` | `id`, `tenantId`, vaccine/schedule/target fields, `createdAt`, `updatedAt` | Tenant vaccine configuration. |
| `catalogue_vaccines` | `id`, `tenantId`, vaccine code/name, classification fields, active status, `createdAt`, `updatedAt` | Vaccine catalogue. |
| `catalogue_schedule_doses` | `id`, `tenantId`, vaccineId, dose number/name/timing fields, `createdAt`, `updatedAt` | Vaccine schedule dose definitions. |
| `catalogue_commodities` | `id`, `tenantId`, commodity code/name/type fields, active status, `createdAt`, `updatedAt` | Commodity catalogue. |
| `catalogue_wastage_thresholds` | `id`, `tenantId`, vaccine/commodity context, threshold fields, `createdAt`, `updatedAt` | Wastage alert thresholds. |

Primary relationships:

```text
facilities.id -> clients.facilityId
villages.id -> clients.villageId
clients.id -> client_vaccinations.clientId
facilities.id -> stock_transactions.facilityId
facilities.id -> monthly_reports.facilityId
facilities.id -> cold_chain_equipment.facilityId
catalogue_vaccines.id -> catalogue_schedule_doses.vaccineId
```

## 7. Workforce, Supervision, Surveillance and Communications

| Domain | Tables | Purpose |
|---|---|---|
| Facility workforce | `facility_staff`, `hfc_committee_members`, `chv_profiles`, `hfc_committee`, `community_health_volunteers`, `uncovered_communities` | Staff, committee, CHV and uncovered-community records. |
| Supervision | `supervision_visits`, `supervision_checklist_templates` | Supportive supervision, checklist templates and corrective-action evidence. |
| Surveillance | `vpd_linelist_templates`, `tenant_vpd_configurations`, `surveillance_cases`, `lab_samples` | VPD surveillance configuration, case records and lab samples. |
| Notifications | `notifications` | In-app and workflow notifications. |
| Communications | `message_templates`, `communications`, `communication_channels`, `delivery_logs`, `communication_logs` | Outbound communication configuration and delivery audit. |

## 8. Research, Audit, Analytics and Reference

| Table | Purpose |
|---|---|
| `research_documents` | Research hub documents. |
| `pilot_activities` | Pilot activity records. |
| `pilot_updates` | Pilot update records. |
| `implementation_lessons` | Implementation learning records. |
| `download_assets` | Downloadable research or knowledge assets. |
| `research_interest_submissions` | Research interest forms. |
| `research_download_events` | Download engagement tracking. |
| `audit_logs` | Audit trail for important system actions. |
| `page_views` | Usage analytics. |
| `indicator_manual` | Indicator definitions and reference content. |

## 9. Important Enums

| Enum | Values / Use |
|---|---|
| `tenant_status` | Tenant lifecycle. |
| `idp_protocol` | `oidc`, `saml`. |
| `signup_status` | Signup request lifecycle. |
| `population_refresh_status` | Population refresh lifecycle. |
| `population_refresh_trigger` | Population refresh reason/source. |
| `user_role` | `facility_clerk`, `facility_in_charge`, `district_manager`, `provincial_coordinator`, `national_admin`, `gis_specialist`, `facility_partner`, `district_partner`, `provincial_partner`, `national_partner`, `national_manager`. |
| `approval_status` | `draft`, `pending`, `approved`, `rejected`, `locked`, `under_review`, `returned`, `archived`, `superseded`. |
| `session_type` | `static`, `mobile`, `outreach`. |
| `transport_mode` | `walking`, `road`, `car`, `motorbike`, `donkey`, `boat`, `air`, `chopper`. |
| `population_source` | `nso`, `hmis`, `worldpop`, `survey`, `community_census`. |
| `microplan_type` | Routine vs campaign/SIA planning type. |
| `session_plan_type` | Routine vs campaign session type. |
| `funding_source` | Budget funding source. |
| `boundary_source` | GIS boundary source. |
| `custom_layer_category` | Custom layer category. |
| `custom_layer_type` | Custom layer geometry/type. |
| `custom_layer_format` | Custom layer file/import format. |
| `vpd_diseases` | Surveillance disease list. |
| `case_classification` | Surveillance case classification. |
| `commodity_type` | `diluent`, `syringe`, `safety_box`, `ppe`, `cold_chain`, `other`. |
| `dose_classification` | `routine`, `campaign`, `outbreak`, `school_based`, `other`. |
| `gis_polygon_type` | GIS polygon classification. |

## 10. Offline Database Schema

The browser/native offline store is not PostgreSQL. It is an IndexedDB database managed through Dexie in `client/src/lib/offlineDb.ts`.

Important offline structures:

| Offline Structure | Purpose |
|---|---|
| `outbox` | Offline mutation queue. Stores tenant ID, entity type, HTTP method, URL, serialized body, local ID, server ID, retries and last error. |
| `conflictLog` | Stores conflict snapshots: local value, server value, entity and resolution timestamp. |
| `syncMeta` | Stores `lastSyncAt`, synced tenant ID and database fingerprint metadata. |
| Local entity mirrors | Local copies of facilities, villages, clients, vaccinations, session plans, session day plans, stock transactions and other sync payload records. |

Sync pull payloads include:

```text
regions
provinces
districts
llgs
facilities
villages
clients
clientVaccinations
sessionPlans
sessionDayPlans
budgetItems
mobilizationActivities
stockTransactions
monthlyReports
populationData
vaccineConfigs
databaseFingerprint
```

## 11. Schema Governance Rules

| Rule | Meaning |
|---|---|
| Tenant isolation | Tenant-scoped records must be filtered by active tenant. |
| Geographic access | Province, district and facility scope must be enforced for scoped users. |
| Facility edit auditing | Facility coordinates, catchment polygon and assignment changes are high-impact. |
| Microplan locking | Approved/locked plans should restrict downstream edits. |
| Offline parity | Offline sync replay must enforce the same validation as online API writes. |
| GIS country boundary control | Imported layers, unserved settlements and settlement candidates must be validated against the active country boundary. |
| Official population protection | Official denominator values should not be silently overwritten by imports or grids. |
| Stock ledger integrity | Prefer append-style stock transactions over destructive edits. |
| Client privacy | Client-level data should have stricter access and export controls than aggregate planning data. |

