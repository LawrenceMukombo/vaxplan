# VaxPlan — Comprehensive End-User Guide & Feature Manual

> A complete, enterprise-grade manual for the VaxPlan GIS microplanning, geospatial intelligence, and immunization campaign management platform.

**Audience:** Ministry of Health staff at every level — community health workers, facility clerks, facility in-charges, district health management teams, provincial coordinators, national EPI managers, GIS specialists, and platform super administrators.

**Version:** VaxPlan Enterprise Version 1.9.4 (Active Release).

---

## Table of Contents

1. [What VaxPlan Does & System Architecture](#1-what-vaxplan-does--system-architecture)
2. [Roles at a Glance & RBAC Permissions Matrix](#2-roles-at-a-glance--rbac-permissions-matrix)
3. [Signing In, Multi-Tenant Switcher, SSO & Session Security](#3-signing-in-multi-tenant-switcher-sso--session-security)
4. [Home Dashboard, Country KPIs & Smart Geographic Cascade Filters](#4-home-dashboard-country-kpis--smart-geographic-cascade-filters)
5. [Facility Staff — Complete Daily Operational Workflows](#5-facility-staff--complete-daily-operational-workflows)
   - 5.1 [4-Cadence Microplanning Wizard (Routine, PIRI, ORI, SIA)](#51-4-cadence-microplanning-wizard-routine-piri-ori-sia)
   - 5.2 [Session Planning (Fixed, Outreach, Mobile) & 5km Proximity Clash Validator](#52-session-planning-fixed-outreach-mobile--5km-proximity-clash-validator)
   - 5.3 [Conducting Sessions in the Field & Real-Time Vaccination Logging](#53-conducting-sessions-in-the-field--real-time-vaccination-logging)
   - 5.4 [Session Closeout, Daily Summary Sheets & Target Quota Reconciliation](#54-session-closeout-daily-summary-sheets--target-quota-reconciliation)
   - 5.5 [Electronic Immunization Registry (EIR), Digital Logbook, Defaulter Tracking & SMS Reminders](#55-electronic-immunization-registry-eir-digital-logbook-defaulter-tracking--sms-reminders)
   - 5.6 [Vaccine Cold Chain Equipment Inventory (CCEOP Compliant), Stock Ledgers & Wastage](#56-vaccine-cold-chain-equipment-inventory-cceop-compliant-stock-ledgers--wastage)
   - 5.7 [Offline Mode, Service Worker PWA Cache, IndexedDB Outbox & Device Tokens](#57-offline-mode-service-worker-pwa-cache-indexeddb-outbox--device-tokens)
   - 5.8 [Community Catchment Management & Settlement Assignment Matrix](#58-community-catchment-management--settlement-assignment-matrix)
6. [District Managers — Multi-Tier Approvals, Cross-Facility Intelligence & Oversight](#6-district-managers--multi-tier-approvals-cross-facility-intelligence--oversight)
7. [Provincial Coordinators — Province-Wide Rollups, Plan Sign-Off & Supply Reallocation](#7-provincial-coordinators--province-wide-rollups-plan-sign-off--supply-reallocation)
8. [National Administrators — Platform Governance, Staff Batch Operations & Live Presence](#8-national-administrators--platform-governance-staff-batch-operations--live-presence)
9. [Tenant Onboarding & Multi-Country Governance](#9-tenant-onboarding--multi-country-governance)
10. [Map, Boundary & Polygon Management](#10-map-boundary--polygon-management)
11. [Advanced Geospatial Intelligence & Zero-Dose Targeting](#11-advanced-geospatial-intelligence--zero-dose-targeting)
    - 11.1 [WorldPop High-Resolution Zonal Population Statistics & Polygon Demographics](#111-worldpop-high-resolution-zonal-population-statistics--polygon-demographics)
    - 11.2 [Remote Sensing Settlement Gap Detection & Unserved Cluster Suitability Scoring (0–100)](#112-remote-sensing-settlement-gap-detection--unserved-cluster-suitability-scoring-0100)
    - 11.3 [Outreach Site Placement, Multi-Modal Travel Isochrones & Live Community Assets](#113-outreach-site-placement-multi-modal-travel-isochrones--live-community-assets)
    - 11.4 [VGIE Intelligent Recommendations (Rule-Based & Generative AI) & Automated Coverage Alerts](#114-vgie-intelligent-recommendations-rule-based--generative-ai--automated-coverage-alerts)
12. [Supportive Supervision, National Checklists & Executive Scorecards](#12-supportive-supervision-national-checklists--executive-scorecards)
    - 12.1 [7-Domain Assessment Framework & Traffic Light Scoring](#121-7-domain-assessment-framework--traffic-light-scoring)
    - 12.2 [Standardized Checklists (WHO Short 35-Q & National Full 70-Q)](#122-standardized-checklists-who-short-35-q--national-full-70-q)
    - 12.3 [Custom Checklist Builder with Conditional Logic & Repeatables](#123-custom-checklist-builder-with-conditional-logic--repeatables)
    - 12.4 [Executive Facility Scorecards & Action Item Tracking](#124-executive-facility-scorecards--action-item-tracking)
    - 12.5 [Comparative Scorecard Matrix & Smart GeoCascadeFilter](#125-comparative-scorecard-matrix--smart-geocascadefilter)
13. [Vaccine-Preventable Disease (VPD) Surveillance & Multi-Criteria Risk Assessment](#13-vaccine-preventable-disease-vpd-surveillance--multi-criteria-risk-assessment)
    - 13.1 [Integrated Epidemiological Signal & Case Surveillance](#131-integrated-epidemiological-signal--case-surveillance)
    - 13.2 [Configurable Risk Assessment Methodology](#132-configurable-risk-assessment-methodology)
    - 13.3 [AI-Assisted Intervention Planning & Corrective Action Linkages](#133-ai-assisted-intervention-planning--corrective-action-linkages)
14. [Health Information Systems (HIS) Interoperability & DHIS2 Sync](#14-health-information-systems-his-interoperability--dhis2-sync)
    - 14.1 [Bi-Directional Integration Architecture & ADX/DataValueSets Sync](#141-bi-directional-integration-architecture--adxdatavaluesets-sync)
    - 14.2 [Org Unit Mapping, Data Element Mapping & Payload Validation](#142-org-unit-mapping-data-element-mapping--payload-validation)
    - 14.3 [Automated Scheduled Sync & Sync History Logs](#143-automated-scheduled-sync--sync-history-logs)
15. [In-App Wiki & Documentation Knowledge Base](#15-in-app-wiki--documentation-knowledge-base)
16. [Reports, Data Exports & Indicator Reference Manual](#16-reports-data-exports--indicator-reference-manual)
17. [Troubleshooting, Error Codes & Frequently Asked Questions](#17-troubleshooting-error-codes--frequently-asked-questions)
18. [Data Sources, Open-Source Acknowledgements & Disputed Boundaries Policy](#18-data-sources-open-source-acknowledgements--disputed-boundaries-policy)
19. [Comprehensive Immunization & Microplanning Glossary](#19-comprehensive-immunization--microplanning-glossary)

---

## 1. What VaxPlan Does & System Architecture

VaxPlan is an enterprise, multi-country digital health platform engineered to operationalize the WHO/UNICEF **Reaching Every District (RED)** and **Reaching Every Community (REC)** immunization strategies. It transitions static, paper-bound annual microplans into dynamic, geospatial, data-driven operational calendars.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VAXPLAN PLATFORM ARCHITECTURE                     │
├──────────────────────┬───────────────────────────────┬──────────────────────┤
│ GIS & POPULATION     │ MICROPLANNING & SESSIONS      │ GOVERNANCE & INTEROP │
├──────────────────────┼───────────────────────────────┼──────────────────────┤
│ • WorldPop Rasters   │ • 4-Cadence Wizard            │ • Multi-Tenant Scope │
│ • Polygon Population │ • 5km Proximity Clash Check   │ • DHIS2 Sync Engine  │
│ • Remote Sensing Gaps│ • Client EIR & Defaulters     │ • Supportive Superv. │
│ • 100-Point AI Score │ • Cold Chain & Stock Ledger   │ • VPD Risk & Alerts  │
└──────────────────────┴───────────────────────────────┴──────────────────────┘
```

### Core Strategic Pillars:
1. **Multi-Tenant Country Isolation**: Strict cryptographic isolation ensures each sovereign Ministry of Health operates within an independent data boundary with localized administrative hierarchies (e.g., Province/District in Zambia/South Africa, State/County in South Sudan).
2. **Geospatial Precision**: Integration of 100m grid WorldPop estimates, GRID3 building footprints, and OpenStreetMap road networks allows real-world walking and driving isochrone modeling rather than abstract circular buffers.
3. **Four-Cadence Microplanning**: Full support for routine immunization, periodic intensification (PIRI), outbreak response (ORI), and supplementary immunization activities (SIA).
4. **Offline-First Resilience**: Field workers in zero-connectivity areas capture sessions, register children, and track stocks via IndexedDB local caching and Progressive Web App (PWA) service workers, with cryptographic device tokens authorizing seamless background sync.
5. **Standards Compliance**: Native bi-directional sync with DHIS2 via ADX and DataValueSets, alignment with WHO CCEOP cold chain standards, and exportable returns in standard PDF/Excel formats.

---

## 2. Roles at a Glance & RBAC Permissions Matrix

VaxPlan implements strict, granular Role-Based Access Control (RBAC). Access is bound to both a functional permission set and a geographic scope.

| Role | Geographic Scope | Primary Responsibilities |
| :--- | :--- | :--- |
| **Community Health Worker (CHW)** | Community / Village | Defaulter tracing, community mobilization, household enumeration. |
| **Facility Clerk** | Single Facility | Authors microplans, records vaccinations in client logbooks, logs stock receipts and wastage. |
| **Facility In-Charge** | Single Facility | Reviews and submits quarterly microplans, closes out sessions, approves local stock transfers. |
| **District Manager** | District (ADM2) | Reviews and approves facility microplans, schedules supportive supervision visits, monitors cold chain inventory. |
| **Provincial Coordinator** | Province (ADM1) | Oversees district performance, signs off on regional SIA campaigns, reallocates vaccine buffers across districts. |
| **National EPI Manager** | Entire Country (Tenant) | National target setting, vaccine catalogue governance, schedule adjustments, DHIS2 sync configuration. |
| **GIS Specialist** | Entire Country (Tenant) | Ingests GeoJSON boundaries, manages custom layers, reviews remote sensing settlement gaps. |
| **Super Admin** | Platform-Wide | Provisions new national tenants, configures global SSO, monitors system health and audit logs. |

---

## 3. Signing In, Multi-Tenant Switcher, SSO & Session Security

### Authentication Mechanisms:
- **Email & Password**: Standard credential authentication with bcrypt hashing (work factor 12). Passwords require minimum 8 characters.
- **Single Sign-On (SSO)**: SAML 2.0 and OpenID Connect (OIDC) integrations allowing health workers to authenticate via national government identity providers.
- **Multi-Tenant Switcher**: For platform administrators and multi-country coordinators, the top header bar features a tenant switcher dropdown allowing instant context switching between authorized national tenants without re-authenticating.

### Session Security & Automatic Timeout:
- **Heartbeat & Inactivity Tracking**: Active tabs transmit a quiet background heartbeat (`/api/auth/ping`). When no user interaction occurs for the configured threshold (default 15 minutes), a modal warning displays.
- **Graceful Lock & Re-Auth**: Upon session expiry, client state in active forms is cached locally to prevent data loss, and the user is redirected to the secure login prompt.

---

## 4. Home Dashboard, Country KPIs & Smart Geographic Cascade Filters

The Executive Home Dashboard provides real-time situational awareness across five core health performance dimensions:

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Target Coverage │ │ Zero-Dose Count │ │ Dropout Rate    │ │ Stock Health    │
│     87.4%       │ │     4,120       │ │   4.2% (Penta)  │ │   94.8% Stable  │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Key Capabilities:
- **Interactive Geospatial Overview**: Displays all health facilities, active session pins, and settlement risk bands overlaid on administrative boundaries.
- **Smart Location Cascade Filter (`GeoCascadeFilter`)**:
  - Selecting a **Province** immediately restricts all downstream District dropdowns.
  - Selecting a **District** restricts the Facility picker strictly to facilities within that district.
  - Visual breadcrumbs and a one-click Clear (`X`) button allow rapid resets back to national aggregation.
- **Cross-Filtering**: Clicking any bar or donut segment in coverage charts filters the facility list and map pins dynamically.

---

## 5. Facility Staff — Complete Daily Operational Workflows

### 5.1 4-Cadence Microplanning Wizard (Routine, PIRI, ORI, SIA)
The 5-stage Microplanning Wizard guides facility in-charges through creating structured, executable operational plans:

1. **Cadence & Horizon**:
   - `Routine`: Standard quarterly/annual planning cycle.
   - `Periodic Intensification of Routine Immunization (PIRI)`: Targeted catch-up campaigns for unreached pockets.
   - `Outbreak Response Immunization (ORI)`: Rapid containment campaigns for measles, cholera, or cVDPV outbreaks.
   - `Supplemental Immunization Activities (SIA)`: Mass nationwide campaigns.
2. **Demographics & Target Pre-Fill**: Automatically pulls target under-1 population, surviving infants, and pregnant women from WorldPop and national census statistics.
3. **Session Strategy Formulation**: Defines the optimal ratio of Fixed, Outreach, and Mobile sessions.
4. **Logistics & Cold Chain Calculation**: Auto-forecasts doses, diluents, AD syringes, safety boxes, and ice pack requirements based on target populations and target wastage factors.
5. **Readiness Audit & Submission**: Calculates a 0–100% Readiness Score. If score >= 80%, the plan can be formally submitted to the District Manager.

### 5.2 Session Planning (Fixed, Outreach, Mobile) & 5km Proximity Clash Validator
When scheduling outreach sessions, VaxPlan prevents resource competition and geographic overlaps:
- **5km Proximity Conflict Engine**: When a session date and location are chosen, the backend evaluates all existing sessions within a 5 km radius on the same date.
- **Conflict Warning**: If an overlap is detected, the system displays an alert with the conflicting team's details, enabling coordinators to adjust dates or relocate the session.

### 5.3 Conducting Sessions in the Field & Real-Time Vaccination Logging
In the field, teams record children and administered doses directly in the **Client Logbook**:
- Search by Child Name, Unique Health ID, or Caregiver Contact.
- Rapid antigen checkboxes with automatic age validation (e.g., verifying interval between Penta1 and Penta2).
- Batch tally recording for mass campaign modalities.

### 5.4 Session Closeout, Daily Summary Sheets & Target Quota Reconciliation
At the end of each session day:
- **Dose Reconciliation**: Enter vials opened, doses administered, doses wasted, and unopened vials returned to cold storage.
- **Summary Sheet Generation**: Automatic compilation of the official daily return with automatic calculation of closed vial wastage and open vial wastage rates.

### 5.5 Electronic Immunization Registry (EIR), Digital Logbook, Defaulter Tracking & SMS Reminders
- **Dropout Computation**: Automated tracking of cohort attrition (e.g., Penta1 to Penta3, BCG to MCV1).
- **Defaulter Worklist**: Identifies children overdue by >14 days. CHWs can trigger automated, localized SMS appointment reminders directly from the list.

### 5.6 Vaccine Cold Chain Equipment Inventory (CCEOP Compliant), Stock Ledgers & Wastage
- **Equipment Inventory**: Detailed logs of refrigerators, freezers, cold boxes, and vaccine carriers, tracking functional status, power source (Solar Direct Drive, Electric, Gas/Kerosene), and PQS pre-qualification codes.
- **Stock Ledger**: Complete batch/lot number tracking, vial expiration dates, minimum/maximum stock thresholds, and stockout alerts.

### 5.7 Offline Mode, Service Worker PWA Cache, IndexedDB Outbox & Device Tokens
- **PWA Service Worker**: Caches application assets, forms, and up to 2,500 basemap map tiles.
- **IndexedDB Outbox**: Field transactions are stored locally with optimistic UI updates.
- **Signed Device Tokens (`/api/auth/device-token`)**: Authorizes field tablets to push queued sync batches without re-prompting for credentials.

### 5.8 Community Catchment Management & Settlement Assignment Matrix
- View and update the assignment of villages, settlements, and nomadic camps to facility catchments.
- Reassign unserved communities to balance workload across neighboring facilities.

---

## 6. District Managers — Multi-Tier Approvals, Cross-Facility Intelligence & Oversight

District Managers oversee program execution across all facilities in their jurisdiction:
- **Approval Workflow**: Review submitted facility microplans with line-item inspection of target populations, session calendars, and budget requests. Actions include **Approve**, **Request Changes** (with feedback notes), or **Reject**.
- **Supervision Scheduling**: Assign supervisory visits to high-risk facilities flagged by coverage gaps or high vaccine wastage.
- **Resource Rebalancing**: Monitor district-level vaccine stock balances and initiate inter-facility stock transfers to prevent stockouts.

---

## 7. Provincial Coordinators — Province-Wide Rollups, Plan Sign-Off & Supply Reallocation

Provincial Coordinators provide strategic regional governance:
- **Aggregated Approval**: Sign off on consolidated district campaign plans for provincial SIAs.
- **Inter-District Reallocation**: Coordinate with national depots to shift cold chain capacity and stock buffers between districts.
- **Equity Monitoring**: Identify lagging districts and prioritize technical support visits.

---

## 8. National Administrators — Platform Governance, Staff Batch Operations & Live Presence

National Administrators manage sovereign platform operations:
- **Staff Management Bulk Operations**: Multi-select staff in the User/Staff directory to perform bulk activation/suspension, role updates, or bulk deletion in batches of 10.
- **Vaccine Catalogue Administration**: Define authoritative antigen schedules, mandatory dose intervals, and standard wastage coefficients.
- **Live User Presence & GIS Activity**: View live active sessions on an interactive map showing connected health workers, device types, and geographic distribution.
- **Audit Logs & Safe Additive Migrations**: Review timestamped audit records for all critical system actions. All database schema evolutions follow strict additive protocols ensuring zero data loss.

---

## 9. Tenant Onboarding & Multi-Country Governance

Platform Super Admins can rapidly onboard new Ministries of Health:
1. **Tenant Provisioning**: Set country name, ISO-3 code, local currency, time zone, and localized administrative hierarchy terminology (e.g., Province/District vs. Region/Sub-County).
2. **Boundary & Facility Ingestion**: Batch import GeoBoundaries ADM1/ADM2/ADM3 layers and national Master Facility Lists (MFL) via CSV.
3. **SSO & Domain Binding**: Bind national government email domains (e.g., `@moh.gov.zm`) to automatically route users to the appropriate tenant.

---

## 10. Map, Boundary & Polygon Management

- **Dual-Source Boundaries**: Automated ingestion from the GeoBoundaries API combined with custom GeoJSON file uploads for sub-district health boundaries (e.g., Payams or Health Areas).
- **Interactive Polygon Catchment Builder**: Draw, edit, and save custom geographic catchment polygons directly in the browser.
- **Custom Spatial Layers**: Overlay health infrastructure, water points, road networks, and elevation layers onto standard map views.
- **Boundary Disclaimer Policy**: Prominent disclaimers indicate that digital boundaries are operational planning aids and do not imply official sovereignty endorsements.

---

## 11. Advanced Geospatial Intelligence & Zero-Dose Targeting

### 11.1 WorldPop High-Resolution Zonal Population Statistics & Polygon Demographics
VaxPlan integrates 100m resolution WorldPop gridded population rasters:
- **Polygon Zonal Population Estimation (`/api/population/estimate-polygon`)**: When a user draws a custom polygon or selects a catchment area, the system executes real-time spatial zonal statistics to extract exact population counts, under-1 infants, and under-5 cohorts.

### 11.2 Remote Sensing Settlement Gap Detection & Unserved Cluster Suitability Scoring (0–100)
- **Settlement Gap Detection (`/api/remote-sensing/gaps`)**: Cross-references building footprints against known health facility catchment buffers to identify unreached settlements.
- **Outreach Suitability Scoring (0–100)**: Evaluates candidate outreach sites across six weighted criteria:
  1. *Population Size* (Target cohort headcount)
  2. *Zero-Dose Probability* (Estimated unvaccinated density)
  3. *Distance to Fixed Facility* (Access barrier severity)
  4. *Outreach Gap* (Distance from existing outreach sites)
  5. *Road Access & Travel Time* (Team feasibility)
  6. *Nearby Community Assets* (Availability of schools, churches, or markets)

### 11.3 Outreach Site Placement, Multi-Modal Travel Isochrones & Live Community Assets
- **Multi-Modal Isochrones**: Renders walking (1h, 2h, 3h), cycling (30m, 60m), and driving (30m, 60m, 90m) accessibility zones computed on OpenStreetMap routing graphs.
- **Community Asset Extraction**: Scans a 3km radius for schools, places of worship, water points, and transport hubs to serve as session venues.

### 11.4 VGIE Intelligent Recommendations (Rule-Based & Generative AI) & Automated Coverage Alerts
- **Rule-Based Engine**: Generates prioritized operational actions (e.g., "Establish monthly mobile outreach" for settlements >10km from a facility).
- **Generative AI Assistant**: Leverages secure LLMs to synthesize complex demographic, coverage, and stock trends into structured strategic intervention proposals.
- **Automated Alerts**: Flags high-risk conditions including unassigned hard-to-reach settlements, sudden dropout spikes, and cold chain capacity deficits.

---

## 12. Supportive Supervision, National Checklists & Executive Scorecards

### 12.1 7-Domain Assessment Framework & Traffic Light Scoring
Evaluates health facility operational quality across 7 standard domains:
1. *Planning & Microplanning Quality*
2. *Vaccine Management & Cold Chain Integrity*
3. *Immunization Service Delivery & Safety*
4. *Data Quality, Monitoring & Logbook Accuracy*
5. *Community Engagement & Demand Generation*
6. *Adverse Events Following Immunization (AEFI) Surveillance*
7. *Programme Management & Governance*

**Traffic Light Scoring Bands**:
- 🔴 **High Risk (<50.0%)**: Critical operational deficiencies requiring urgent district intervention.
- 🟠 **Medium Risk (50.0% – 79.9%)**: Moderate performance with targeted corrective actions required.
- 🟢 **Low Risk (>=80.0%)**: Strong compliance with national standards.

### 12.2 Standardized Checklists (WHO Short 35-Q & National Full 70-Q)
Pre-configured, validated templates optimized for rapid field assessments or comprehensive annual evaluations.

### 12.3 Custom Checklist Builder with Conditional Logic & Repeatables
National administrators can build bespoke checklist templates featuring:
- Conditional follow-up questions revealed only on specific trigger responses.
- Repeatable sub-sections (e.g., evaluating multiple vaccinators independently).
- GPS coordinate capture and photo upload fields.

### 12.4 Executive Facility Scorecards & Action Item Tracking
Generates clean, printable executive facility scorecards with domain score breakdowns, qualitative supervisor observations, and assigned corrective action matrices with responsible owners and due dates.

### 12.5 Comparative Scorecard Matrix & Smart GeoCascadeFilter
Enables cross-district and cross-facility comparative performance benchmarking with sortable enterprise tables, column visibility customization, risk filters, and Excel export.

---

## 13. Vaccine-Preventable Disease (VPD) Surveillance & Multi-Criteria Risk Assessment

### 13.1 Integrated Epidemiological Signal & Case Surveillance
Tracks suspected and laboratory-confirmed cases for key priority antigens: Measles, Polio (AFP), Yellow Fever, Cholera, Neonatal Tetanus, and Meningitis.

### 13.2 Configurable Risk Assessment Methodology
Combines four weighted risk dimensions into a localized district risk index:
- Historical Outbreak Frequency (30%)
- Zero-Dose & Under-Immunized Population Density (30%)
- Immunization Coverage Gaps & Dropout Rates (25%)
- Cold Chain & Logistics Vulnerability (15%)

### 13.3 AI-Assisted Intervention Planning & Corrective Action Linkages
Automatically recommends targeted mitigation packages (e.g., reactive ring vaccination or preventive SIA prioritization) linked directly to the planning actions registry.

---

## 14. Health Information Systems (HIS) Interoperability & DHIS2 Sync

### 14.1 Bi-Directional Integration Architecture & ADX/DataValueSets Sync
VaxPlan features a native integration engine for DHIS2:
- **Data Ingestion**: Imports historical district coverage figures and official census denominators from DHIS2.
- **Aggregate Export**: Compiles completed microplan session results and coverage tallies into standard DHIS2 `dataValueSets` JSON payloads for direct API transmission.

### 14.2 Org Unit Mapping, Data Element Mapping & Payload Validation
- Maps VaxPlan facilities and districts to DHIS2 Organisation Unit UID strings.
- Maps VaxPlan antigen doses to DHIS2 Data Elements and Category Option Combos.
- Built-in dry-run payload validator catches schema mismatches before transmission.

### 14.3 Automated Scheduled Sync & Sync History Logs
Configurable automated cron synchronization with full audit logging of HTTP status codes, transferred records, and error diagnostics.

---

## 15. In-App Wiki & Documentation Knowledge Base

Accessible under **Administration → Wiki / Docs** (`/admin/wiki`):
- **National Admin & GIS Markdown Editor**: Live side-by-side markdown editor for authoring, updating, and publishing national operational standard operating procedures (SOPs).
- **Gamified Learning Hub**: Integrates knowledge mastery badges for health workers mastering core immunization indicators.
- **Automated Site Generation**: Compiles into the standalone documentation portal via `docs-site/build.mjs`.

---

## 16. Reports, Data Exports & Indicator Reference Manual

- **Automated Standard Returns**: One-click generation of Quarterly Microplan Summaries (PDF), District Coverage Compendiums (PDF/Excel), Stock Ledger Audits (Excel), and Supervisory Visit Scorecards (PDF).
- **Indicator Reference Manual**: Detailed reference of standard WHO/Gavi indicators complete with explicit numerator/denominator definitions, mathematical formulas, and practical calculation examples.
- **Knowledge Mastery Tracker**: Gamified learning path guiding users from *EPI Novice* to *EPI Mastery Legend*.

---

## 17. Troubleshooting, Error Codes & Frequently Asked Questions

| Symptom / Error | Root Cause | Solution |
| :--- | :--- | :--- |
| **"403 Forbidden: Scope Mismatch"** | Attempting to view or edit records outside your assigned geographic boundary. | Contact your District or National Admin to adjust your assigned facility or district scope. |
| **"Proximity Conflict Detected"** | Another outreach session is scheduled within 5km on the same date. | Inspect the conflicting session details and adjust your team's date or select an alternative community venue. |
| **"Sync Pending in Outbox"** | Device is currently offline or experiencing intermittent connectivity. | Ensure network connectivity is restored; the background PWA worker will automatically push queued batches. |
| **"Map Tiles Not Loading"** | Browser cache limits reached or network blocking tile domains. | Hard-refresh the browser (`Ctrl + F5`) or verify that OpenStreetMap and ArcGIS tile services are whitelisted in your proxy. |

---

## 18. Data Sources, Open-Source Acknowledgements & Disputed Boundaries Policy

VaxPlan aggregates and credits authoritative open datasets:
- **Administrative Boundaries**: GeoBoundaries (William & Mary Open Research Lab) and OCHA HDX.
- **Population Rasters**: WorldPop Project (University of Southampton).
- **Settlement Footprints**: GRID3 (Center for International Earth Science Information Network - CIESIN).
- **Basemaps & Routing**: OpenStreetMap contributors and CartoDB.
- **Disputed Boundaries Policy**: Digital representations of borders and administrative areas are operational planning aids only and do not express any opinion concerning the legal status of any country, territory, or sovereign entity.

---

## 19. Comprehensive Immunization & Microplanning Glossary

- **AD Syringe**: Auto-Disable Syringe engineered to lock after a single injection to prevent reuse and bloodborne transmission.
- **Antigen**: A biological preparation (vaccine) that stimulates an immune response against a specific infectious disease.
- **Catchment Area**: The defined geographic territory and constituent communities for which a specific health facility is responsible.
- **CCEOP**: Cold Chain Equipment Optimization Platform (Gavi/WHO initiative setting standards for high-performing cold chain devices).
- **Closed Vial Wastage**: Vaccine loss occurring before a vial is opened, typically due to expiration, cold chain failure (heat/freeze exposure), or physical breakage.
- **Defaulter**: A child who initiated an immunization schedule (e.g., received Penta1) but missed subsequent scheduled doses within the prescribed time window.
- **Dropout Rate**: The mathematical proportion of children who started a multi-dose vaccine series but failed to complete it, calculated as: `((Dose 1 - Dose 3) / Dose 1) * 100`.
- **EIR**: Electronic Immunization Registry (digital system recording individual-level client vaccination records).
- **Fixed-Site Session**: Immunization services delivered directly within the physical premises of a static health facility.
- **Mobile Session**: Immunization delivery conducted by specialized outreach teams traveling to highly remote, nomadic, or riverine communities requiring multi-day travel.
- **Open Vial Wastage**: Vaccine doses discarded after a multi-dose vial has been opened due to vial expiration limits (e.g., reconstitutable vaccines discarded after 6 hours).
- **Outreach Session**: Immunization services delivered at a designated community venue (e.g., school, church, village square) located away from the fixed health facility.
- **PIRI**: Periodic Intensification of Routine Immunization (time-bound catch-up campaigns to boost routine coverage).
- **RED / REC Strategy**: Reaching Every District / Reaching Every Community (WHO operational framework focused on microplanning, community outreach, supportive supervision, and monitoring).
- **SIA**: Supplementary Immunization Activity (mass vaccination campaign targeting entire age cohorts regardless of prior vaccination history).
- **Solar Direct Drive (SDD)**: Solar-powered refrigeration technology operating directly from solar panels without requiring chemical storage batteries.
- **Target Population (Denominator)**: The estimated cohort of eligible individuals (e.g., children under 1 year, surviving infants, pregnant women) residing in a defined catchment area during a planning cycle.
- **VGIE**: VaxPlan Geospatial Intelligence Engine (the platform's spatial analytics and recommendation subsystem).
- **WorldPop**: Open high-resolution spatial demographic dataset combining census, satellite imagery, and machine learning to map population distributions.
- **Zero-Dose Child**: An infant who has received no doses of standard routine vaccines, operationally measured as having missed the first dose of DTP-containing vaccine (DTP1 / Penta1).
