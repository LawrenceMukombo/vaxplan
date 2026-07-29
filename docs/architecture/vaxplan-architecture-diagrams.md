# VaxPlan Architecture Diagrams

This document contains editable Mermaid diagrams for the VaxPlan application. The diagrams are intended for enterprise technical documentation, implementation planning, architecture reviews, onboarding, and slide-deck use.

For a plain-text database schema reference that does not require Mermaid rendering, see [VaxPlan Database Schema Reference](./vaxplan-database-schema.md).

## 1. System Context

```mermaid
flowchart LR
  subgraph Users["Users"]
    FacilityStaff["Facility staff"]
    DistrictUsers["District managers"]
    ProvincialUsers["Provincial coordinators"]
    NationalUsers["National admins"]
    GISUsers["GIS specialists"]
    Partners["Partner users"]
  end

  subgraph Clients["Client Applications"]
    Web["Web app / PWA"]
    Android["Android app<br/>Capacitor WebView"]
    Windows["Windows desktop<br/>Electron"]
  end

  subgraph VaxPlan["VaxPlan Platform"]
    UI["React + Vite SPA"]
    API["Express API server"]
    Realtime["Realtime service<br/>WebSocket change pokes"]
    Sync["Offline sync service"]
    Jobs["Schedulers and background jobs"]
  end

  subgraph Data["Data Layer"]
    Postgres["PostgreSQL<br/>Drizzle schema"]
    IndexedDB["IndexedDB / Dexie<br/>local offline replica"]
  end

  subgraph External["External Systems and Sources"]
    HIS["HIS / DHIS2 / FHIR"]
    GIS["GIS files, boundaries,<br/>settlements, population grids"]
    Messaging["Email / SMS / push channels"]
    Reports["PDF, Word, Excel,<br/>PowerPoint exports"]
  end

  FacilityStaff --> Web
  DistrictUsers --> Web
  ProvincialUsers --> Web
  NationalUsers --> Web
  GISUsers --> Web
  Partners --> Web
  FacilityStaff --> Android
  NationalUsers --> Windows

  Web --> UI
  Android --> UI
  Windows --> UI
  UI --> API
  UI <--> IndexedDB
  API <--> Postgres
  API <--> Realtime
  API <--> Sync
  API --> Jobs
  Sync <--> IndexedDB
  Sync <--> Postgres
  Jobs --> Postgres
  API <--> HIS
  API <--> GIS
  API <--> Messaging
  API --> Reports
```

## 2. Runtime Architecture

```mermaid
flowchart TB
  Start["server/index.ts startup"] --> Env["Load .env when available"]
  Env --> Express["Create Express app and HTTP server"]
  Express --> Security["Apply trust proxy, HTTPS redirect,<br/>native CORS allowlist"]
  Security --> Middleware["Compression, JSON parser,<br/>URL encoded parser, session middleware"]
  Middleware --> Logging["Compact API logging"]
  Logging --> RealtimeMiddleware["Realtime broadcast middleware"]
  RealtimeMiddleware --> RegisterRoutes["registerRoutes(httpServer, app)"]
  RegisterRoutes --> ModuleRoutes["Mount reports, surveillance,<br/>remote sensing and GIS routes"]
  ModuleRoutes --> Bootstrap{"SKIP_DB_BOOTSTRAP = 1?"}
  Bootstrap -- "No" --> Migrations["Apply additive bootstrap migrations"]
  Migrations --> Schedulers["Start population, stock,<br/>supervision, approval and archive jobs"]
  Bootstrap -- "Yes" --> Serve
  Schedulers --> Serve["Serve Vite in development<br/>or static bundle in production"]
  Serve --> Listen["Listen on PORT<br/>default 5000"]
```

## 3. Frontend Application Shell

```mermaid
flowchart TB
  App["client/src/App.tsx"] --> Providers["QueryClientProvider<br/>ThemeProvider<br/>TooltipProvider<br/>SidebarProvider"]
  Providers --> AuthGate{"Authenticated?"}

  AuthGate -- "No" --> PublicShell["Public shell"]
  PublicShell --> Landing["Landing"]
  PublicShell --> Signup["Signup"]
  PublicShell --> Help["Help"]
  PublicShell --> DataSources["Data sources"]

  AuthGate -- "Yes" --> AppShell["Authenticated app shell"]
  AppShell --> Sidebar["AppSidebar"]
  AppShell --> Header["Tenant switcher<br/>Global search<br/>Notifications<br/>Sync status<br/>User menu"]
  AppShell --> UX["Offline banner<br/>Install prompt<br/>Update banner<br/>Conflict badge"]
  AppShell --> Router["AuthenticatedRouter"]

  Router --> Dashboard["Dashboard"]
  Router --> Map["GIS map"]
  Router --> Facilities["Facilities"]
  Router --> Population["Population"]
  Router --> Microplans["Microplans"]
  Router --> Sessions["Sessions"]
  Router --> Stock["Stock ledger"]
  Router --> Supervision["Supervision"]
  Router --> Surveillance["Surveillance"]
  Router --> Reports["Reports"]
  Router --> Admin["Admin and settings"]
  Router --> VGIE["VGIE GIS intelligence"]
```

## 4. Backend API Modules

```mermaid
flowchart LR
  Client["React client"] --> API["Express API"]

  API --> Auth["Auth and sessions"]
  API --> Tenant["Tenant context"]
  API --> Facilities["Facilities and geography"]
  API --> GIS["GIS, boundaries,<br/>custom layers and polygons"]
  API --> Microplans["Microplans and approvals"]
  API --> Sessions["Session plans and day plans"]
  API --> Population["Population intelligence"]
  API --> Stock["Stock and cold chain"]
  API --> Reports["Reports and indicators"]
  API --> Supervision["Supervision"]
  API --> Surveillance["VPD surveillance"]
  API --> Comms["Notifications and communications"]
  API --> Sync["Offline sync batch/pull"]
  API --> Admin["User, catalogue and tenant admin"]

  Auth --> DB[(PostgreSQL)]
  Tenant --> DB
  Facilities --> DB
  GIS --> DB
  Microplans --> DB
  Sessions --> DB
  Population --> DB
  Stock --> DB
  Reports --> DB
  Supervision --> DB
  Surveillance --> DB
  Comms --> DB
  Sync --> DB
  Admin --> DB
```

## 5. Enterprise Data Model Overview

```mermaid
erDiagram
  TENANTS ||--o{ USERS : owns
  TENANTS ||--o{ USER_ROLES : defines
  TENANTS ||--o{ USER_PERMISSIONS : defines
  TENANTS ||--o{ REGIONS : contains
  REGIONS ||--o{ PROVINCES : contains
  PROVINCES ||--o{ DISTRICTS : contains
  DISTRICTS ||--o{ LLGS : contains
  DISTRICTS ||--o{ FACILITIES : contains
  DISTRICTS ||--o{ VILLAGES : contains
  FACILITIES ||--o{ VILLAGES : serves
  FACILITIES ||--o{ MICROPLANS : creates
  MICROPLANS ||--o{ SESSION_PLANS : owns
  SESSION_PLANS ||--o{ SESSION_DAY_PLANS : has
  SESSION_PLANS ||--o{ SESSION_VILLAGES : targets
  VILLAGES ||--o{ SESSION_VILLAGES : included_in
  MICROPLANS ||--o{ BUDGET_ITEMS : budgets
  MICROPLANS ||--o{ VACCINE_REQUIREMENTS : forecasts
  MICROPLANS ||--o{ MOBILIZATION_ACTIVITIES : plans
  MICROPLANS ||--o{ APPROVAL_REQUESTS : reviewed_by
  FACILITIES ||--o{ CLIENTS : registers
  CLIENTS ||--o{ CLIENT_VACCINATIONS : receives
  FACILITIES ||--o{ STOCK_TRANSACTIONS : records
  FACILITIES ||--o{ MONTHLY_REPORTS : submits
  FACILITIES ||--o{ COLD_CHAIN_EQUIPMENT : operates
  TENANTS ||--o{ ADMIN_BOUNDARIES : owns
  TENANTS ||--o{ CUSTOM_LAYERS : owns
  TENANTS ||--o{ POPULATION_GRIDS : owns
  TENANTS ||--o{ SETTLEMENTS_MASTER : owns
  FACILITIES ||--o{ FACILITY_CATCHMENTS : maps
```

## 6. RBAC and Geographic Access Control

```mermaid
flowchart TB
  Request["Incoming API request"] --> Authenticated{"Authenticated session?"}
  Authenticated -- "No" --> Deny401["401 Unauthorized"]
  Authenticated -- "Yes" --> TenantContext["Resolve active tenant"]
  TenantContext --> TenantCheck{"Tenant allowed?"}
  TenantCheck -- "No" --> Deny403Tenant["403 Cross-tenant denied"]
  TenantCheck -- "Yes" --> PermissionCheck["Expand effective permissions<br/>role defaults + tenant roles + direct overrides"]
  PermissionCheck --> HasPermission{"Required permission present?"}
  HasPermission -- "No" --> Deny403Permission["403 Permission denied"]
  HasPermission -- "Yes" --> GeoContext["Load resource geography<br/>facility / district / province"]
  GeoContext --> GeoCheck{"Within user dataAccessScope?"}
  GeoCheck -- "No" --> Deny403Geo["403 Geographic scope denied"]
  GeoCheck -- "Yes" --> Handler["Execute route handler"]
  Handler --> Audit["Audit high-risk changes"]
  Audit --> Response["Return response"]
```

## 7. Offline-First Synchronization

```mermaid
sequenceDiagram
  participant User
  participant UI as React UI
  participant Dexie as IndexedDB/Dexie
  participant Sync as syncEngine
  participant API as Express API
  participant DB as PostgreSQL

  User->>UI: Create or edit data while offline
  UI->>Dexie: Save local record
  UI->>Dexie: Add outbox item
  UI-->>User: Show pending sync state

  Note over Sync: Network returns or periodic sync fires
  Sync->>Dexie: Acquire outbox lease
  Sync->>Dexie: Read pending outbox items
  Sync->>API: POST /api/sync/batch
  API->>API: Validate tenant, RBAC, geography and domain rules
  API->>DB: Apply accepted mutations
  DB-->>API: Persisted records
  API-->>Sync: Batch results, warnings and server IDs
  Sync->>Dexie: Mark successful items done
  Sync->>API: GET /api/sync/pull?since=lastSyncAt
  API->>DB: Read tenant-scoped changes
  DB-->>API: Changed data
  API-->>Sync: Pull payload
  Sync->>Dexie: Bulk sync local replica
  Sync-->>UI: Update sync status
```

## 8. GIS and Catchment Intelligence

```mermaid
flowchart TB
  Inputs["GIS and population inputs"] --> Boundaries["Admin boundaries"]
  Inputs --> Facilities["Facility coordinates"]
  Inputs --> Villages["Villages / communities"]
  Inputs --> Settlements["Settlement layers"]
  Inputs --> PopulationGrids["Population grids"]
  Inputs --> Coverage["Imported coverage"]

  Boundaries --> Validation["Country and admin-boundary validation"]
  Facilities --> Catchments["Facility catchment polygons"]
  Villages --> Catchments
  Settlements --> GapAnalysis["Unserved / unmapped analysis"]
  PopulationGrids --> Estimates["Catchment population estimates"]
  Coverage --> GapAnalysis
  Validation --> Catchments
  Validation --> GapAnalysis

  Catchments --> Map["GIS map view"]
  GapAnalysis --> Recommendations["VGIE recommendations"]
  Estimates --> Microplans["Microplan targets"]
  Recommendations --> Sessions["Outreach and mobile sessions"]
  Map --> Review["Planner review and correction"]
  Review --> Catchments
```

## 9. Microplanning Workflow

```mermaid
flowchart TB
  Start["Start planning cycle"] --> SelectFacility["Select facility and planning period"]
  SelectFacility --> CatchmentReview["Review facility catchment<br/>villages, settlements and gaps"]
  CatchmentReview --> Population["Confirm target populations<br/>and denominator source"]
  Population --> Strategy["Select service strategy<br/>fixed, outreach, mobile"]
  Strategy --> Sessions["Create session plans"]
  Sessions --> DayPlans["Create session day plans<br/>teams, routes, supplies"]
  DayPlans --> Vaccines["Forecast vaccines and commodities"]
  Vaccines --> Budget["Estimate budget and resources"]
  Budget --> Mobilization["Plan social mobilization"]
  Mobilization --> Submit["Submit microplan"]
  Submit --> Review["District/province/national review"]
  Review --> Decision{"Approved?"}
  Decision -- "No" --> Returned["Returned for correction"]
  Returned --> CatchmentReview
  Decision -- "Yes" --> Locked["Approved / locked plan"]
  Locked --> Execute["Execute sessions"]
  Execute --> Report["Monthly reports and quarterly review"]
  Report --> NextCycle["Use evidence in next planning cycle"]
```

## 10. Deployment Topology

```mermaid
flowchart LR
  Dev["Developer workstation"] --> Git["Git repository"]
  Git --> VPS["Production VPS"]

  subgraph VPS["Ubuntu VPS"]
    Nginx["Nginx reverse proxy<br/>TLS termination"]
    PM2["PM2 process manager"]
    Node["Node.js VaxPlan app"]
    Static["Built static assets"]
  end

  subgraph Data["Managed or local data services"]
    DB["PostgreSQL database"]
    Backups["Backups / PITR"]
  end

  Browser["Browser / PWA / native shells"] --> Nginx
  Nginx --> PM2
  PM2 --> Node
  Node --> Static
  Node --> DB
  DB --> Backups

  Release["Release procedure"] --> Pull["git pull"]
  Pull --> Install["npm install"]
  Install --> SafeMigration["npm run db:safe-update"]
  SafeMigration --> Build["npm run build"]
  Build --> Restart["pm2 restart vaxplan"]
  Restart --> Logs["pm2 logs / smoke test"]
```

## 11. Integration Architecture

```mermaid
flowchart TB
  VaxPlan["VaxPlan API and services"] --> HIS["HIS interoperability service"]
  VaxPlan --> Reporting["Reporting service"]
  VaxPlan --> Messaging["Messaging service"]
  VaxPlan --> Importers["CSV, shapefile and GIS importers"]
  VaxPlan --> Catalogue["Vaccine and commodity catalogue"]

  HIS --> DHIS2["DHIS2 aggregate/tracker"]
  HIS --> FHIR["FHIR-style exchange"]
  Reporting --> PDF["PDF"]
  Reporting --> Word["Word"]
  Reporting --> Excel["Excel"]
  Reporting --> PowerPoint["PowerPoint"]
  Messaging --> Email["Email"]
  Messaging --> SMS["SMS"]
  Messaging --> Push["Device push tokens"]
  Importers --> Boundaries["Admin boundaries"]
  Importers --> Settlements["Settlement layers"]
  Importers --> Coverage["Coverage imports"]
  Catalogue --> Forecasting["Vaccine forecasting<br/>and stock planning"]
```

## 12. Scheduler and Background Job Model

```mermaid
flowchart LR
  Server["VaxPlan server startup"] --> Jobs{"Bootstrap enabled?"}
  Jobs -- "No" --> Skip["Skip schedulers"]
  Jobs -- "Yes" --> Population["Population refresh scheduler"]
  Jobs -- "Yes" --> Archive["Session archive scheduler"]
  Jobs -- "Yes" --> Stock["Stock alert digest scheduler"]
  Jobs -- "Yes" --> Supervision["Supervision digest scheduler"]
  Jobs -- "Yes" --> Approval["Approval scheduler"]
  Jobs -- "Yes" --> Microplan["Microplan approval cron"]

  Population --> DB[(PostgreSQL)]
  Archive --> DB
  Stock --> DB
  Supervision --> DB
  Approval --> DB
  Microplan --> DB

  Stock --> Notifications["Notifications / digests"]
  Supervision --> Notifications
  Approval --> Notifications
  Microplan --> Notifications
```


## 13. Source-Code Schema Inventory

The canonical schema source is `shared/schema.ts`. The table list below is grouped by enterprise domain so architects can quickly identify ownership, access-control needs, sync behavior, and reporting impact.

| Domain | Tables / Schemas | Notes |
|---|---|---|
| Tenant control plane | `tenants`, `tenant_idp_configs`, `signup_requests`, `tenant_interest_requests` | Tenant identity, country workspace setup, IdP configuration, onboarding and interest capture. |
| Auth, users and devices | `sessions`, `users`, `user_roles`, `user_permissions`, `device_tokens` | Session state, account profile, role assignments, direct permissions, notification devices. |
| Administrative geography | `regions`, `provinces`, `districts`, `llgs`, `facilities`, `villages`, `facility_excluded_villages` | Country geography hierarchy, health facilities, communities, and explicit catchment exclusions. |
| Microplanning | `microplans`, `session_plans`, `session_villages`, `session_day_plans`, `budget_items`, `vaccine_requirements`, `mobilization_activities`, `approval_requests`, `annual_immunization_plans`, `quarterly_reviews` | Facility/campaign planning cascade, session planning, day planning, resources, budgets, vaccines, mobilization and approvals. |
| GIS and catchment intelligence | `admin_boundaries`, `custom_layers`, `facility_catchments`, `gis_polygons`, `catchment_conflicts`, `settlements_master`, `population_grids`, `candidate_unmapped_settlements`, `imported_coverage`, `csv_imports`, `vgie_settlement_facility_links`, `vgie_recommendations`, `vgie_alerts`, `vgie_recommendation_rules`, `vgie_alert_rules` | GIS boundaries, country layers, facility polygons, settlement intelligence, imported coverage, unmapped community detection, recommendations and alerts. |
| Population planning | `population_data`, `population_refresh_jobs` | Denominator data, population-source traceability, population-grid refresh and status tracking. |
| Service delivery | `clients`, `client_vaccinations` | Client registry and individual vaccination events. |
| Stock, logistics and catalogue | `stock_transactions`, `monthly_reports`, `cold_chain_equipment`, `catalogue_vaccines`, `catalogue_schedule_doses`, `catalogue_commodities`, `catalogue_wastage_thresholds`, `vaccine_configurations` | Stock ledger, routine reporting, cold chain, tenant vaccine schedule, commodities and wastage thresholds. |
| Workforce and community systems | `facility_staff`, `hfc_committee_members`, `chv_profiles`, `uncovered_communities`, `hfc_committee`, `community_health_volunteers` | Health facility staffing, committees, community health volunteers, uncovered communities. |
| Supervision and surveillance | `supervision_visits`, `supervision_checklist_templates`, `vpd_linelist_templates`, `tenant_vpd_configurations`, `surveillance_cases`, `lab_samples` | Supportive supervision, checklist configuration, VPD surveillance line lists, cases and lab samples. |
| Notifications and communications | `notifications`, `message_templates`, `communications`, `communication_channels`, `delivery_logs`, `communication_logs` | Workflow notifications, message templates, outbound communication channels, delivery audit. |
| Research and knowledge hub | `research_documents`, `pilot_activities`, `pilot_updates`, `implementation_lessons`, `download_assets`, `research_interest_submissions`, `research_download_events` | Research hub content, pilot activity tracking, implementation lessons, downloads and engagement. |
| Audit, analytics and reference | `audit_logs`, `page_views`, `indicator_manual` | Audit trail, usage analytics and indicator reference documentation. |

## 14. Key Schema Fields by Domain

For exact definitions, `shared/schema.ts` remains the source of truth. These are the high-impact fields architects and implementers should know.

| Entity | Key Fields | Enterprise Meaning |
|---|---|---|
| `tenants` | `id`, `name`, `code`, `countryCode`, `status`, `settings` | Country or organization workspace. Controls configuration and tenant isolation. |
| `tenant_idp_configs` | `tenantId`, `protocol`, `issuer`, `metadata`, `enabled` | SSO/IdP integration configuration. |
| `users` | `tenantId`, `email`, `firstName`, `lastName`, `role`, `roles`, `permissions`, `dataAccessScope`, `facilityId`, `districtId`, `provinceId`, `isActive`, `passwordHash`, `isPlatformAdmin` | User identity, default and dynamic roles, direct permission overrides, geographic scope and platform-admin status. |
| `user_roles` | `tenantId`, `code`, `name`, `permissions` | Tenant-specific role catalogue. |
| `user_permissions` | `tenantId`, `code`, `name`, `description` | Tenant-specific permission catalogue. |
| `regions`, `provinces`, `districts`, `llgs` | `tenantId`, parent geography ID, `name`, `code` | Formal administrative hierarchy used for reporting, map filtering and access scope. |
| `facilities` | `tenantId`, `name`, `hmisCode`, `facilityType`, `districtId`, `latitude`, `longitude`, `catchmentPolygon`, `catchmentGridPopulation`, `externalIds`, `isActive` | Core operational planning unit. |
| `villages` | `tenantId`, `districtId`, `llgId`, `assignedFacilityId`, `latitude`, `longitude`, population fields, geometry/boundary fields | Community or settlement record used for catchment assignment and session targeting. |
| `microplans` | `tenantId`, `facilityId`, `year`, `quarter`, `planType`, `approvalStatus`, target/resource fields | Parent planning object for routine or campaign microplanning. |
| `session_plans` | `tenantId`, `microplanId`, `facilityId`, `name`, `sessionType`, `scheduledDate`, `status` | Planned fixed, outreach or mobile service event. |
| `session_villages` | `tenantId`, `sessionId`, `villageId` | Many-to-many bridge between sessions and target communities. |
| `session_day_plans` | `tenantId`, `sessionPlanId`, `sessionDate`, team/resource fields, actuals fields | Day-level operational plan and execution record. |
| `budget_items` | `tenantId`, `microplanId`, activity/cost/funding fields | Planned resource and budget lines. |
| `vaccine_requirements` | `tenantId`, `microplanId`, vaccine/commodity/quantity fields | Forecasting output for vaccines and supplies. |
| `mobilization_activities` | `tenantId`, `microplanId`, activity, owner, schedule/status fields | Demand generation and community engagement planning. |
| `approval_requests` | `tenantId`, `microplanId`, requester/reviewer/status/comment fields | Structured review and approval workflow. |
| `population_data` | `tenantId`, geography/facility/village context, source, value, category/year fields | Denominator and target population values. |
| `admin_boundaries` | `tenantId`, geography context, boundary source/type, geometry | Administrative polygons used for map display, validation and clipping. |
| `custom_layers` | `tenantId`, category/type/format, metadata, geometry/file fields | Tenant-specific operational GIS layers. |
| `facility_catchments` | `tenantId`, `facilityId`, geometry, metadata | Facility catchment polygons. |
| `gis_polygons` | `tenantId`, polygon type, geometry, metadata | General planning and validation polygons. |
| `settlements_master` | `tenantId`, geography/facility context, coordinates/geometry, population/source fields | Master settlement inventory for missed or unmapped community intelligence. |
| `population_grids` | `tenantId`, source, grid metadata, file/coverage fields | Gridded population datasets used in estimates. |
| `candidate_unmapped_settlements` | `tenantId`, geography, coordinates, match/status fields | Candidate settlements requiring review before conversion or assignment. |
| `imported_coverage` | `tenantId`, geography context, antigen/period/coverage fields | Imported coverage for triangulation and gap detection. |
| `clients` | `tenantId`, `facilityId`, `villageId`, identity/demographic fields, client identifier fields | Individual client registry. |
| `client_vaccinations` | `tenantId`, `clientId`, `facilityId`, vaccine/dose/date/batch fields | Administered antigen and dose records. |
| `stock_transactions` | `tenantId`, `facilityId`, vaccine/commodity, transaction type, quantity, batch, date fields | Stock ledger movements. |
| `monthly_reports` | `tenantId`, `facilityId`, reporting period, service and stock metrics | Routine facility report submission. |
| `cold_chain_equipment` | `tenantId`, `facilityId`, equipment, capacity, status and maintenance fields | Cold chain inventory and readiness. |
| `supervision_visits` | `tenantId`, geography/facility context, checklist, findings, action/status fields | Supportive supervision and corrective action evidence. |
| `surveillance_cases` | `tenantId`, disease, case classification, geography, dates, investigation fields | VPD surveillance case tracking. |
| `lab_samples` | `tenantId`, case reference, collection/shipment/result fields | Laboratory sample tracking. |
| `notifications` | `tenantId`, `userId`, type, title, message, status | User and workflow notification records. |
| `audit_logs` | `tenantId`, actor, action, entity, before/after, timestamp, request metadata | Audit evidence for high-risk changes. |

## 15. Key Enumerations

| Enum | Values / Purpose |
|---|---|
| `tenant_status` | Tenant lifecycle state. |
| `idp_protocol` | `oidc`, `saml`. |
| `signup_status` | Signup request lifecycle state. |
| `population_refresh_status` | Population-refresh job lifecycle state. |
| `population_refresh_trigger` | Reason/source of a population refresh. |
| `user_role` | `facility_clerk`, `facility_in_charge`, `district_manager`, `provincial_coordinator`, `national_admin`, `gis_specialist`, `facility_partner`, `district_partner`, `provincial_partner`, `national_partner`, `national_manager`. |
| `approval_status` | `draft`, `pending`, `approved`, `rejected`, `locked`, `under_review`, `returned`, `archived`, `superseded`. |
| `session_type` | `static`, `mobile`, `outreach`. |
| `transport_mode` | `walking`, `road`, `car`, `motorbike`, `donkey`, `boat`, `air`, `chopper`. |
| `population_source` | `nso`, `hmis`, `worldpop`, `survey`, `community_census`. |
| `microplan_type` | Distinguishes routine facility plans from campaign/SIA plans. |
| `session_plan_type` | Distinguishes routine and campaign session plan semantics. |
| `funding_source` | Funding source classification for budget lines. |
| `boundary_source` | Source classification for boundaries. |
| `custom_layer_category` | Category classification for custom GIS layers. |
| `custom_layer_type` | Geometry/layer type classification for custom layers. |
| `custom_layer_format` | Import/file format classification for custom layers. |
| `vpd_diseases` | Vaccine-preventable disease list for surveillance configuration. |
| `case_classification` | Surveillance case classification. |
| `commodity_type` | `diluent`, `syringe`, `safety_box`, `ppe`, `cold_chain`, `other`. |
| `dose_classification` | `routine`, `campaign`, `outbreak`, `school_based`, `other`. |
| `gis_polygon_type` | Planning/validation polygon classification. |

## 16. Detailed Domain ERDs

### 16.1 Tenant and User Domain

```mermaid
erDiagram
  TENANTS ||--o{ TENANT_IDP_CONFIGS : configures
  TENANTS ||--o{ SIGNUP_REQUESTS : receives
  TENANTS ||--o{ USERS : owns
  TENANTS ||--o{ USER_ROLES : defines
  TENANTS ||--o{ USER_PERMISSIONS : defines
  USERS ||--o{ DEVICE_TOKENS : registers
  USERS ||--o{ SESSIONS : authenticates

  TENANTS {
    string id
    string name
    string code
    string countryCode
    string status
    json settings
  }

  USERS {
    string tenantId
    string email
    string role
    json roles
    json permissions
    string dataAccessScope
    int facilityId
    int districtId
    int provinceId
  }
```

Key rules:

- A normal user operates inside one active tenant context.
- Direct permissions may extend or override role-derived capabilities.
- Geographic scope is separate from permission scope.
- Platform administration should be reserved for explicitly privileged accounts.

### 16.2 Geography, Facility and Community Domain

```mermaid
erDiagram
  TENANTS ||--o{ REGIONS : has
  REGIONS ||--o{ PROVINCES : contains
  PROVINCES ||--o{ DISTRICTS : contains
  DISTRICTS ||--o{ LLGS : contains
  DISTRICTS ||--o{ FACILITIES : contains
  DISTRICTS ||--o{ VILLAGES : contains
  LLGS ||--o{ VILLAGES : groups
  FACILITIES ||--o{ VILLAGES : serves
  FACILITIES ||--o{ FACILITY_CATCHMENTS : maps
  FACILITIES ||--o{ FACILITY_EXCLUDED_VILLAGES : excludes

  FACILITIES {
    string tenantId
    string name
    string hmisCode
    string facilityType
    int districtId
    decimal latitude
    decimal longitude
    json catchmentPolygon
    json externalIds
  }

  VILLAGES {
    string tenantId
    int districtId
    int llgId
    int assignedFacilityId
    decimal latitude
    decimal longitude
    json boundary
  }
```

Key rules:

- Facility and village data should always be filtered by active tenant.
- Facility coordinates and catchment polygons are high-impact planning fields and should be audited.
- Community assignment changes affect session planning, population estimates, reports and missed-community analysis.

### 16.3 Microplanning and Session Domain

```mermaid
erDiagram
  FACILITIES ||--o{ MICROPLANS : authors
  MICROPLANS ||--o{ SESSION_PLANS : owns
  MICROPLANS ||--o{ BUDGET_ITEMS : budgets
  MICROPLANS ||--o{ VACCINE_REQUIREMENTS : forecasts
  MICROPLANS ||--o{ MOBILIZATION_ACTIVITIES : mobilizes
  MICROPLANS ||--o{ APPROVAL_REQUESTS : reviews
  SESSION_PLANS ||--o{ SESSION_DAY_PLANS : schedules
  SESSION_PLANS ||--o{ SESSION_VILLAGES : targets
  VILLAGES ||--o{ SESSION_VILLAGES : included

  MICROPLANS {
    string tenantId
    int facilityId
    int year
    int quarter
    string planType
    string approvalStatus
  }

  SESSION_PLANS {
    string tenantId
    int microplanId
    int facilityId
    string name
    string sessionType
    date scheduledDate
    string status
  }
```

Key rules:

- A session plan should belong to a parent microplan.
- Session plan type should match parent microplan type.
- Approved or locked microplans should constrain downstream session edits.
- Budget, vaccine requirement and mobilization data should not be interpreted outside the parent microplan.

### 16.4 GIS and Population Intelligence Domain

```mermaid
erDiagram
  TENANTS ||--o{ ADMIN_BOUNDARIES : owns
  TENANTS ||--o{ CUSTOM_LAYERS : owns
  TENANTS ||--o{ GIS_POLYGONS : owns
  TENANTS ||--o{ SETTLEMENTS_MASTER : owns
  TENANTS ||--o{ POPULATION_GRIDS : owns
  TENANTS ||--o{ CANDIDATE_UNMAPPED_SETTLEMENTS : owns
  TENANTS ||--o{ IMPORTED_COVERAGE : owns
  FACILITIES ||--o{ FACILITY_CATCHMENTS : maps
  FACILITIES ||--o{ CATCHMENT_CONFLICTS : participates
  SETTLEMENTS_MASTER ||--o{ VGIE_SETTLEMENT_FACILITY_LINKS : linked_by
  VGIE_RECOMMENDATIONS ||--o{ VGIE_ALERTS : can_trigger

  SETTLEMENTS_MASTER {
    string tenantId
    int districtId
    int facilityId
    decimal latitude
    decimal longitude
    json geometry
    int population
  }

  POPULATION_GRIDS {
    string tenantId
    string source
    json metadata
    string status
  }
```

Key rules:

- Settlement and unserved-place outputs must be constrained to the active tenant/country boundary.
- Imported coverage should be treated as triangulation evidence, not as a silent replacement for operational reports.
- Population-grid outputs must retain source and vintage metadata.
- Catchment conflict records should be actionable, reviewed and auditable.

### 16.5 Service Delivery, Stock and Reporting Domain

```mermaid
erDiagram
  FACILITIES ||--o{ CLIENTS : registers
  CLIENTS ||--o{ CLIENT_VACCINATIONS : receives
  FACILITIES ||--o{ STOCK_TRANSACTIONS : records
  FACILITIES ||--o{ MONTHLY_REPORTS : submits
  FACILITIES ||--o{ COLD_CHAIN_EQUIPMENT : operates
  TENANTS ||--o{ CATALOGUE_VACCINES : configures
  CATALOGUE_VACCINES ||--o{ CATALOGUE_SCHEDULE_DOSES : defines
  TENANTS ||--o{ CATALOGUE_COMMODITIES : configures
  TENANTS ||--o{ CATALOGUE_WASTAGE_THRESHOLDS : configures

  CLIENTS {
    string tenantId
    int facilityId
    int villageId
    string clientId
    string name
    date dateOfBirth
  }

  STOCK_TRANSACTIONS {
    string tenantId
    int facilityId
    string transactionType
    int quantity
    string batchNumber
    date transactionDate
  }
```

Key rules:

- Client-level data needs tighter privacy controls than aggregate planning data.
- Stock transactions should be append-oriented where possible to preserve audit history.
- Monthly reports should be locked or versioned after formal submission/review.
- Catalogue changes affect forecasting, reports and validation of vaccination events.

### 16.6 Supervision, Surveillance and Communications Domain

```mermaid
erDiagram
  TENANTS ||--o{ SUPERVISION_CHECKLIST_TEMPLATES : configures
  FACILITIES ||--o{ SUPERVISION_VISITS : receives
  TENANTS ||--o{ VPD_LINELIST_TEMPLATES : configures
  TENANTS ||--o{ TENANT_VPD_CONFIGURATIONS : configures
  TENANTS ||--o{ SURVEILLANCE_CASES : records
  SURVEILLANCE_CASES ||--o{ LAB_SAMPLES : has
  USERS ||--o{ NOTIFICATIONS : receives
  TENANTS ||--o{ MESSAGE_TEMPLATES : defines
  TENANTS ||--o{ COMMUNICATIONS : sends
  COMMUNICATIONS ||--o{ DELIVERY_LOGS : logs

  SUPERVISION_VISITS {
    string tenantId
    int facilityId
    date visitDate
    string status
    json checklist
  }

  SURVEILLANCE_CASES {
    string tenantId
    string disease
    string caseClassification
    int facilityId
    date notificationDate
  }
```

Key rules:

- Supervision findings should lead to corrective action and closure status.
- Surveillance cases and lab samples should preserve investigation timelines.
- Notification and communication logs provide operational accountability.

## 17. Offline Local Schema and Sync Payload

The offline database is defined in `client/src/lib/offlineDb.ts`; synchronization orchestration is in `client/src/lib/syncEngine.ts`.

| Offline Entity / Structure | Purpose |
|---|---|
| `outbox` | Stores offline mutations with tenant ID, entity type, method, URL, serialized body, local ID, server ID, retry count and error state. |
| `conflictLog` | Records local and server snapshots when conflicts are resolved or local data is overwritten. |
| `syncMeta` | Stores last sync time, active synced tenant and database fingerprint metadata. |
| Local facility mirror | Offline-readable facility records. |
| Local village mirror | Offline-readable villages, coordinates and outreach-post fields. |
| Local client mirror | Client registration data and optional resolved geography names. |
| Local vaccination mirror | Vaccination events queued or synced offline. |
| Local session plan mirror | Session plan fields required for offline session management. |
| Local session day plan mirror | Day-level operational planning and execution fields. |
| Local stock transaction mirror | Offline stock ledger movement records. |

Pull sync payload families include `regions`, `provinces`, `districts`, `llgs`, `facilities`, `villages`, `clients`, `clientVaccinations`, `sessionPlans`, `sessionDayPlans`, `budgetItems`, `mobilizationActivities`, `stockTransactions`, `monthlyReports`, `populationData`, `vaccineConfigs` and `databaseFingerprint`.

```mermaid
flowchart TB
  OutboxItem["Outbox item"] --> Tenant["Validate tenant"]
  Tenant --> Auth["Validate user/session context"]
  Auth --> Permission["Validate permission"]
  Permission --> Geography["Validate geographic scope"]
  Geography --> Domain["Validate domain rules"]
  Domain --> Persist["Persist mutation"]
  Persist --> Result["Return server ID, warnings or errors"]
  Result --> Local["Update local outbox and replica"]
```

## 18. Permission and Role Summary

Default permissions are declared in `shared/permissions.ts`. The authorization layer combines built-in role permissions, tenant-defined role permissions, direct user overrides, tenant context and geographic scope.

| Role Family | Typical Scope | Typical Capabilities |
|---|---|---|
| Facility clerk | Facility | Clients, sessions, stock, mobilization and basic facility workflows. |
| Facility in-charge | Facility | Facility-level approval, reports, budget/resource planning and local management. |
| District manager | District | District review, approvals, reports, supervision and oversight. |
| Provincial coordinator | Province | Provincial oversight, reporting, approvals and selected management functions. |
| National admin / national manager | National tenant | National reporting, user/admin operations, catalogues, GIS oversight and standards alignment. |
| GIS specialist | Tenant or assigned geography | Boundaries, GIS layers, catchments and settlement intelligence. |
| Partner roles | Assigned geography | Read-oriented program visibility and reporting, generally without broad administrative privileges. |

## 19. Route and Module Map

| Frontend Module | Main Data Domains | Backend / Service Areas |
|---|---|---|
| Dashboard | Reports, microplans, sessions, stock, geography | Core routes, reporting service |
| Map | Facilities, villages, catchments, custom layers, settlements, population grids | GIS routes, VGIE routes, population intelligence service |
| Facilities | Facilities, villages, staff, catchments, cold chain | Facility routes, GIS polygon/catchment routes |
| Population | Population data, population grids, imported coverage | Population intelligence and refresh jobs |
| Microplan Wizard/List | Microplans, budgets, vaccines, mobilization, approvals | Microplan routes, approval services |
| Session Planning | Session plans, session villages, session day plans | Session routes, proximity checks, sync replay rules |
| Stock Ledger | Stock transactions, vaccine catalogue, commodities, monthly reports | Stock and catalogue routes |
| Supervision | Supervision visits, checklist templates | Supervision routes and digest job |
| Surveillance | VPD templates, cases, lab samples | Surveillance router |
| Reports | Monthly reports, indicators, exports | Reports router and reporting service |
| User Management | Users, roles, permissions, tenant context | Auth/admin routes, authorization service |
| HIS Integrations | Imported coverage, HIS mappings, reports | HIS interoperability service |
| Research Hub | Research documents, pilots, updates, lessons, downloads | Research routes/schema |

## 20. Environment, Runtime and Deployment Keys

| Key / Script | Purpose |
|---|---|
| `DATABASE_URL` | Required PostgreSQL connection string. Supabase/Upstash-style URLs automatically receive `sslmode=require` when missing. |
| `PORT` | Server listen port; defaults to `5000`. |
| `NODE_ENV` | Controls production behavior such as HTTPS redirect and static serving. |
| `SKIP_DB_BOOTSTRAP=1` | Disables bootstrap migrations and scheduler startup. |
| `npm run dev` | Runs `tsx --env-file=.env server/index.ts` for local development. |
| `npm run build` | Runs the production build script. |
| `npm run start` | Runs production bootstrap and starts compiled server output. |
| `npm run check` | TypeScript check. |
| `npm run test` | Vitest test runner with `.env`. |
| `npm run db:safe-update` | Production-safe additive migration path per deployment guide. |
| `npm run db:generate` | Drizzle migration generation. |
| `npm run db:migrate` | Migration runner. |
| `npm run cap:sync` | Build and synchronize Capacitor native shell. |
| `npm run electron:dev` | Runs web dev server plus Electron development shell. |

Deployment guardrails:

- Do not wipe production data.
- Do not overwrite official values without explicit approval.
- Prefer additive migrations.
- Avoid direct destructive `drizzle-kit push` operations in production.
- Smoke test tenant login, map, facility edit, microplanning, session planning, stock, reports and sync status after deployment.

## 21. Enterprise Data Governance Notes

| Area | Required Control |
|---|---|
| Tenant isolation | Every tenant-scoped query must filter by active tenant. |
| Geographic access | Province, district and facility records must be checked against user scope. |
| Facility coordinates and catchments | Treat as high-risk planning fields; audit changes. |
| Official population values | Protect from accidental overwrite; track source and vintage for alternatives. |
| GIS layers | Validate geometry, source, country boundary fit and tenant ownership. |
| Client data | Minimize PII, restrict exports and enforce role/geography access. |
| Stock data | Preserve ledger history and avoid destructive stock edits. |
| Reports | Lock/version submitted reports where required for official review. |
| Offline replay | Re-run authorization and domain validation during sync batch replay. |
| Audit logs | Capture actor, action, entity, before/after and timestamp for high-risk operations. |

## 22. Architecture Review Checklist

- Does every API path enforce authentication where required?
- Does every tenant-scoped entity filter by active tenant?
- Does every update path enforce RBAC and geographic scope?
- Are facility pin moves, catchment polygon changes and assignment changes audited?
- Are unserved settlements clipped or validated to the active tenant/country boundary?
- Do offline replay paths enforce the same rules as online API writes?
- Are approved or locked microplans protected from unauthorized child-session edits?
- Are imports validated for duplicates, malformed geometry and wrong-country data?
- Do reports use structured records rather than visual map state?
- Are production migrations additive unless explicitly approved?


