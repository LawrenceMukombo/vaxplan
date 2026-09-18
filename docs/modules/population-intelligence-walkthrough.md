---
title: "Population Intelligence Walkthrough"
version: 1.9.4
status: Active
last_updated: 2026-09-18
audience: Facility In-Charges, District Managers, GIS Specialists, National Planners
---

# Population Intelligence Walkthrough

## 1. Module Purpose
Provides high-resolution demographic intelligence by executing spatial zonal statistics on 100m WorldPop gridded population rasters, high-resolution building footprints (GRID3), and administrative boundary polygons.

---

## 2. Core Capabilities

### 2.1 Polygon Zonal Population Estimation (`/api/population/estimate-polygon`)
- When drawing or editing custom catchment polygons, VaxPlan executes real-time spatial aggregation to estimate:
  - Total population headcount
  - Infants under 1 year (typically ~3.5%–4.0%)
  - Children under 5 years (typically ~15%–18%)
  - Pregnant women and Women of Childbearing Age (WCBA)

### 2.2 Remote Sensing Settlement Gap Detection (`/api/remote-sensing/gaps`)
- Identifies unreached building clusters located outside active health facility catchment buffers.
- Ranks candidate unserved clusters on a 0–100 Outreach Suitability scale factoring in population density, road travel times, and existing outreach gaps.

### 2.3 Multi-Modal Travel Isochrones
- Computes walking (1h, 2h, 3h), cycling (30m, 60m), and driving (30m, 60m, 90m) accessibility contours on OpenStreetMap path networks.
