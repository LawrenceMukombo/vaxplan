# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Research Hub Public Access:** The Research Hub is now publicly accessible via the `doc.vaxplan.org` subdomain without requiring authentication.
- **Sidebar Navigation:** The Research Hub has been added directly to the main sidebar for authenticated users.
- **Strict Session Timeouts:** Implemented strict, platform-wide automatic session timeouts. 
  - Configurable Idle Timeout (default 30 mins) and Absolute Timeout (default 8 hours).
  - Enforced globally on both the frontend (cross-tab synchronization, warning modals, offline cache locking) and backend (Express middleware, session touch suppression).
- Added an automated `release` script in `package.json` to handle version bumps and changelog updates.

### Fixed
- Fixed an issue where the `AI Copilot` and `AI Recommendations` features were pointing to an invalid `gemini-2.5-flash` model endpoint, resulting in 500 server errors. The endpoints now correctly target `gemini-1.5-flash`.
- Fixed the foreign key constraints to include `ON DELETE CASCADE` on `session_villages` and `budget_items`. This resolves the `500 Internal Server Error` encountered when deleting a microplan.
- Resolved `ERESOLVE` peer dependency conflicts during `npm install` by enforcing an override for `@react-leaflet/core` required by `react-leaflet-cluster`.
- Fixed an issue where background API polling indefinitely kept user sessions alive by explicitly disabling Express-session rolling updates and carefully controlling backend activity tracking.

## [1.5.0] - 2026-07-21

### Added
- **Enterprise Entity History Tracking**:
  - Implemented versioning schema across Users/Staff, Health Facilities, Communities, Population Denominators, Vaccine Schedules, and Stock Reference data (`entity_history_versions`, `user_assignment_history`, `facility_history_versions`, `community_history_versions`, `population_history_versions`, `vaccine_schedule_history_versions`, `stock_reference_history_versions`).
  - Added central `EntityHistoryService` and `AsOfDateService` for point-in-time state resolution as of any specified calendar date.
  - Built frontend history component suite: `EntityHistoryDrawer`, `TimelineComponent`, `VersionCompareModal`, `ViewAsOfDateControl`, `CreateChangeModal`, and `ChangeApprovalScreen`.
  - Added history drawer triggers to `UserManagement.tsx` and `Facilities.tsx`.
  - Added snapshot freezing (`report_entity_snapshots`) for original vs. restated historical reporting.

### Fixed
- **Leaflet Cluster Bubbles**: Resolved marker clustering issue in `ChvCoverageTab.tsx` by flattening markers passed to `MarkerClusterGroup`.
- **Community Popup Metadata**: Enhanced community map popups and highlighted cards to display Linked Health Facility name, distance (km), and driving/walking time (min).

## [1.4.0] - 2026-06-19
### Changed
- Initial introduction of the changelog feature to better track deployment versions.
