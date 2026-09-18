# VaxPlan Release Notes & Migration Guide

This document tracks technical releases, architectural updates, database migrations, and major feature deployment notes.

---

## Release v1.9.4 (2026-09-14)

### Highlights

- **DHIS2 country connector hardening:** added tenant-specific root OU, data set, facility-level and authentication configuration; read-only connection testing; compatible facility UID mapping; URL normalization; and fail-closed production imports/exports. Individual-level Tracker remains outside the supported scope.

- **End-to-end planning assurance:** routine and campaign microplans now connect to Plan Health, action ownership, evidence records, field-readiness review, approvals, version history, and printable outputs.
- **Campaign operations:** added readiness assessment, summary sheets, target quotas, RED-aligned planning, and a real-time campaign dashboard.
- **Surveillance and risk:** added VPD case/laboratory workflows and configurable assessment methodologies with district input, mapped results, vulnerability review, and linked actions.
- **Field and logistics expansion:** added or expanded cold-chain inventory, catalogue management, CHW field workspace, field teams, stock, client outcomes, and reconciliation for unmapped vaccine codes.
- **Offline resilience:** added offline sign-in support after online provisioning, push-before-pull batch synchronization, forced retry, stuck-item counts, conflict review, warning events, and tenant-switch cache protection.
- **Governance:** expanded roles and permission delegation, geographic fail-closed scoping, planning evidence history, temporal views, supervision template versioning, and audit coverage.

### Upgrade notes

1. Back up the database and verify the restore procedure.
2. Apply the normal numbered migrations and the additive planning/RED migrations using the approved safe migration workflow.
3. Confirm the production schema contains the stock, microplan approval, client/logbook, planning action, and planning evidence columns required by this release.
4. Build the application, run TypeScript and automated tests, and validate login, tenant scope, one routine plan, one campaign plan, one offline replay, and one report before reopening field access.
5. Review tenant module settings because newly available modules default to enabled unless explicitly disabled.

### Documentation

The canonical current-state references are [Platform reference](./PLATFORM_REFERENCE.md), [End-user guide](./USER_GUIDE.md), [Developer guide](./DEVELOPER_GUIDE.md), and [Offline operation and synchronization](./OFFLINE_AND_SYNC.md).

---

## Release v1.9.2 (2026-08-07)

### Highlights
- **Strict Smart Location Cascade Filter**:
  - Enforced strict parent-child dependencies across location selectors (**Province** → **District** → **Health Facility**).
  - Downstream selectors (District/Facility) remain disabled until parent selection is made.
  - Dropdown options strictly display only direct children belonging to the active parent selection.
  - Clearing a parent selection immediately clears and locks downstream child selectors.

### Components Updated
- `GeoCascadeFilter.tsx`: Enhanced `filteredDistricts` and `filteredFacilities` logic with dual `id` and `name` parent resolution.
- `ComparativeScorecardTable.tsx`: Enabled `strictCascade={true}` and location cascade state filtering.

---

## Release v1.9.0 (2026-08-07)

### Highlights
- **Supportive Supervision Scorecards & Comparative Matrix**:
  - Implemented `SupervisionScorecard.tsx` executive facility view with traffic light score indicator, KPI metrics, section breakdown, supervisor findings, and printable corrective action plans.
  - Implemented `ComparativeScorecardTable.tsx` comparative quality matrix for Province, District, and Health Facility scope comparison.
  - Integrated global WHO/UNICEF Traffic Light Risk Classification standard:
    - 🔴 **High Risk (0% – 49.9%)**
    - 🟠 **Medium Risk (50.0% – 79.9%)**
    - 🟢 **Low Risk (80.0% – 100.0%)**
- **Supportive Supervision Checklists**:
  - Created 35-question short supportive supervision template (5 questions x 7 sections).
  - Maintained full 70-question national template.

---

## Release v1.5.0 (2026-07-21)

### Highlights
- **Enterprise Entity History & Audit Versioning**:
  - Point-in-time state resolution as of any specified calendar date.
  - Snapshot freezing for reporting continuity.
