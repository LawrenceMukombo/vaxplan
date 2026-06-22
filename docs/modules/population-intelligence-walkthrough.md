---
title: "Population Intelligence Walkthrough"
version: 1.0.0
status: Final
last_updated: 2026-06-21
audience: Facility In-Charges, GIS Specialists
---

# Population Intelligence Walkthrough

## 1. Module Purpose
Leverages geospatial datasets (WorldPop/GridPop) to calculate highly accurate, hyper-local population estimates for custom geographic areas.

## 2. Who Uses It
- **Facility In-Charges:** When choosing the denominator for their microplan.
- **GIS Specialists:** To validate data accuracy.

## 3. Main Screens and Navigation
- Integrated primarily into the **Location Intelligence Drawer** and the **Microplan Wizard**.

## 4. Key Actions
### 4.1. Generating a Polygon Estimate
1. Draw a polygon in the Facility Module.
2. The system automatically triggers a PostGIS `ST_Intersects` query against the WorldPop grid.
3. The resulting population is saved and displayed on the facility's dashboard.

## 5. Permissions and RBAC
- Read-only for most users. Generated automatically upon polygon creation.

## 6. Troubleshooting
> **Baby steps:** If the GIS population reads "0", ensure the polygon was drawn in the correct country and over inhabited areas.

## 7. Related Modules
- [Polygon Drawing Walkthrough](./polygon-drawing-walkthrough.md)
