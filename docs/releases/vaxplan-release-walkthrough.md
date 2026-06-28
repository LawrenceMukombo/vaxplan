---
title: "Release Walkthrough"
version: 1.0.0
status: Final
last_updated: 2026-06-21
audience: Developers, SysAdmins, Implementers
---

# Release History and Walkthroughs

This document tracks major feature implementations and their architectural impact on VaxPlan.

## Phase 1: Location Intelligence Drawer
**Objective:** Provide spatial awareness to the GIS map.
- **Changes Made:** 
  - Implemented the `Location Intelligence Drawer` to appear when a map point is clicked.
  - Added horizontal scroll to the Facilities table.
  - Developed the GIS Location Intelligence API backend routes.
- **User Impact:** Users can now click anywhere on the map to see a 1km radius population estimate.
- **Data Safety Confirmation:** All API queries are read-only (`ST_Distance`, `ST_DWithin`).

## Phase 2: Custom Catchment Drawing & Population Intelligence
**Objective:** Allow Facility In-Charges to digitally trace their precise geographic responsibility.
- **Changes Made:**
  - Integrated `Leaflet Geoman` for polygon drawing.
  - Created the `gis_polygons` PostGIS table.
  - Implemented WorldPop raster intersection logic to extract highly accurate population counts.
- **User Impact:** Facilities can move from radius-based guessing to exact boundary mapping.
- **Data Safety Confirmation:** Schema additions were additive. No existing data was dropped.

## Phase 3: Deployment Hardening
**Objective:** Secure the Hostinger VPS deployment pipeline.
- **Changes Made:**
  - Standardized the deployment SOP.
  - Implemented `safe-migration.ts` to bypass destructive Drizzle operations in production.
- **User Impact:** Zero downtime deployments.
- **Data Safety Confirmation:** Enforced the No-Wipe, Upsert-only database rule at the script level.

## Phase 4: Indicator Documentation
**Objective:** Ensure spatial features are reflected in platform KPIs.
- **Changes Made:**
  - Added the "GIS Catchment Population" metric to the `DEFAULT_INDICATORS` payload.
  - Updated in-app FAQs.
- **User Impact:** Clear transparency on how population denominators are calculated.
- **Data Safety Confirmation:** Safe upsert of default indicator arrays.

## Phase 5: API & Routing Hardening
**Objective:** Fix routing priority, column mappings, and missing boundary polygon population fallbacks.
- **Changes Made:**
  - Swapped routing priority so `/api/population/worldpop-point` resolves correctly before `/api/population/:id`.
  - Corrected database query column mappings for villages (`total_catchment_population`) and facilities (`facility_type`, `operational_status`).
  - Standardized `SMTP_PASS` / `SMTP_PASSWORD` fallback configurations for production mailer and messaging modules.
  - Implemented a warnings-guarded interactive verification prompt in the local Hostinger deploy script.
  - Patched boundary polygon click events in [MapView.tsx](file:///c:/vaxplan/client/src/components/MapView.tsx) to execute the asynchronous radial population fallback fetch if the local raster has no data.
- **User Impact:** No more 400 Bad Request or 500 Internal Server errors when navigating the map, and clicking administrative boundary polygons now correctly displays gridded population estimates.
- **Data Safety Confirmation:** Backup generated on VPS, all database migrations applied safely, and data was upserted idempotently without dropping tables.

