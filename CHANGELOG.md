# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.2] - 2026-08-07

### Added
- **Strict Smart Location Cascade Filter (`GeoCascadeFilter`)**:
  - Enforced strict parent-to-child cascading behavior across location dropdowns (**Province** → **District** → **Health Facility**).
  - District dropdown is locked until a Province is selected; Health Facility dropdown is locked until a District is selected.
  - Downstream child options dynamically filter to strictly show **only** the direct children belonging to the active parent.
  - Clearing a parent selection immediately clears and locks all child selections.
- **Supportive Supervision Executive Scorecard (`SupervisionScorecard.tsx`)**:
  - Individual facility scorecard popup featuring facility metadata prefilling, overall traffic light badge, KPI summary tiles (Scored, Compliant, Non-compliant, Actions), section score breakdown, supervisor qualitative findings, and structured corrective action plan.
  - Native print and PDF export support (`window.print()`).
- **Comparative Supervision Scorecard Matrix (`ComparativeScorecardTable.tsx`)**:
  - Multi-level comparative table comparing supportive supervision quality scores across **Provinces**, **Districts**, and **Health Facilities**.
  - Built-in Enterprise Table features: pagination (10, 25, 50, 100), sortable headers with wrapped section titles, column picker popover, risk level dropdown, search, and CSV export.
- **Traffic Light Score Visual Standard (`@shared/supervisionChecklist`)**:
  - 🔴 **High Risk (0% – 49.9%)**: Red badge & background.
  - 🟠 **Medium Risk (50.0% – 79.9%)**: Amber badge & background.
  - 🟢 **Low Risk (80.0% – 100.0%)**: Green badge & background.
- **Streamlined Supportive Supervision Templates**:
  - Created 35-question short supportive supervision template (5 questions x 7 sections) alongside the 70-question national template.

### Fixed
- **Table Header Wrapping**: Replaced fixed text truncation on comparative matrix header cells with clean multi-line wrapping (`whitespace-normal break-words`).
- **Dynamic Province Resolution**: Facilities and districts without inline `province` strings automatically resolve their actual Province boundary via `districtId -> provinceId -> provinces` query lookup.

---

## [1.5.0] - 2026-07-21

### Added
- **Enterprise Entity History Tracking**:
  - Implemented versioning schema across Users/Staff, Health Facilities, Communities, Population Denominators, Vaccine Schedules, and Stock Reference data.
  - Built frontend history component suite (`EntityHistoryDrawer`, `TimelineComponent`, `VersionCompareModal`, `ViewAsOfDateControl`, `CreateChangeModal`, `ChangeApprovalScreen`).

---

## [1.4.0] - 2026-06-19
### Changed
- Initial introduction of the changelog feature to better track deployment versions.
