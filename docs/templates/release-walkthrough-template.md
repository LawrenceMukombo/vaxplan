---
title: "[Release/Phase Name] Walkthrough"
version: 1.0.0
status: Draft
last_updated: YYYY-MM-DD
audience: Developers, System Administrators, Implementers
---

# Release Walkthrough: [Release/Phase Name]

## 1. Objective
[Explain the primary goal of this release or phase.]

## 2. Changes Made
[List the major features, bug fixes, or enhancements introduced.]
- Feature A
- Feature B

## 3. Files and Modules Affected
[List the core files, database tables, or modules that were significantly altered.]
- `src/components/...`
- `gis_polygons` table

## 4. User Impact
[Explain how this changes the user experience or workflow.]

## 5. Technical Impact
[Detail the technical changes: new dependencies, infrastructure shifts, schema updates.]

## 6. Verification
[Describe how this release was tested and verified.]
- [x] Command-line build passing
- [x] Schema migration tested

## 7. Data Safety Confirmation
> [!IMPORTANT]
> **Data safety:** VaxPlan follows a no-wipe, no-overwrite, upsert-only approach for production data.

[Confirm that no destructive operations occurred during this release.]
