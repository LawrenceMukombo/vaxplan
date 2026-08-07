# VaxPlan Release Notes & Migration Guide

This document tracks technical releases, architectural updates, database migrations, and major feature deployment notes.

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
