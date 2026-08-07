# VaxPlan

> ⚠️ **Proprietary & Confidential**
> 
> This repository contains the proprietary intellectual property of **Vumbi2018**. 
> All rights are explicitly reserved. This is **NOT** an open-source project. 
> 
> You may view the source code hosted here for evaluation or portfolio review purposes only. You are strictly prohibited from copying, distributing, modifying, or using this codebase (in whole or in part) for any commercial or non-commercial purposes without explicit prior written consent or a paid commercial license.
> 
> Please refer to the `LICENSE` file for the full legal terms. For licensing inquiries, partnerships, or SaaS access, please contact the repository owner.

---

VaxPlan is an advanced, offline-first GIS microplanning and supportive supervision platform designed for national immunization and primary-care programs.

## Key Modules & Platform Features

### 1. Supportive Supervision & Performance Scorecards
- **Standardized & Short Supervision Checklists**: Supports both comprehensive 70-question national supervision templates and streamlined 35-question templates across 7 core domain sections:
  1. *Facility Readiness & Service Delivery*
  2. *Availability of RI Services*
  3. *RI Session Monitoring*
  4. *Cold Chain & Vaccine Management*
  5. *Advocacy & Social Mobilization*
  6. *Data Management & Monitoring*
  7. *Supportive Supervision & Governance*
- **Traffic Light Scoring Standard**: Visual indicator system following WHO/UNICEF guidelines:
  - 🔴 **High Risk (0% – 49.9%)**: Requires immediate intervention and corrective action plan.
  - 🟠 **Medium Risk (50.0% – 79.9%)**: Target for targeted supervisory coaching.
  - 🟢 **Low Risk (80.0% – 100.0%)**: Fully compliant with high performance.
- **Executive Facility Scorecards**: Printable scorecards (`SupervisionScorecard.tsx`) featuring facility metadata, overall risk badges, KPI tiles, section breakdowns, supervisor findings, and structured corrective action plans.
- **Comparative Supervision Scorecard Matrix**: Multi-level comparative table (`ComparativeScorecardTable.tsx`) enabling cross-boundary quality comparisons across Provinces, Districts, and Health Facilities. Includes pagination, column visibility picker, sortable headers, and CSV exports.

### 2. Strict Smart Location Cascade Filter (`GeoCascadeFilter`)
- **Strict Parent-Child Dependency**:
  - District selector remains disabled until a Province is selected.
  - Health Facility selector remains disabled until a District is selected.
- **Dynamic Parent Resolution**: Automatically filters child options to **only** display districts/facilities belonging to the active parent selection.
- **One-Click Reset**: Instant clearing of location filters returns the interface to the full national view.

### 3. GIS Spatial Microplanning & Catchment Analysis
- **Spatial Target Area Coverage**: Interactive Leaflet maps with custom vector boundaries, community pins, zero-dose settlements, and cold chain logistics overlay.
- **Offline-First Synchronization**: IndexedDB local storage guarantees continuous field operation with automatic conflict-free server sync.
- **Multi-Tenant Administration**: Role-based access control (RBAC) supporting National Admins, Provincial Coordinators, District Managers, and Facility Supervisors.

---

## Technical Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, ShadCN/Radix UI components, TanStack Query, Leaflet.
- **Backend**: Node.js, Express.js, PostgreSQL with PostGIS extension, Drizzle ORM.
- **Runtime**: PM2, Node 20+, PWA offline service workers.

---

## Technical Documentation & Guides

Comprehensive technical guides are available in the [`docs/`](./docs) directory:
- [System User Guide](./docs/USER_GUIDE.md)
- [Indicator Manual](./docs/INDICATOR_MANUAL.md)
- [Release Notes](./docs/releases.md)
- [Country Onboarding Guide](./docs/COUNTRY_ONBOARDING.md)