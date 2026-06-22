---
title: "GIS Specialist Quick Guide"
version: 1.0.0
status: Final
last_updated: 2026-06-21
audience: GIS Specialists
---

# GIS Specialist Quick Guide

## 1. Role Purpose
You ensure the spatial integrity of the VaxPlan system. You manage custom GeoJSON boundaries, resolve catchment overlaps, and validate population estimates extracted from WorldPop.

## 2. Daily Tasks
- Upload custom administrative boundaries.
- Resolve "Catchment Overlap" alerts between neighboring facilities.
- Validate the polygon mapping performed by facility users.

## 3. Key Modules Used
- **Boundary Manager:** To upload GeoJSON files.
- **Facilities (Map View):** To audit drawn polygons.
- **Recommendations:** To review zero-dose cluster mapping.

## 4. Step-by-step Workflow: Uploading Custom Boundaries
1. Navigate to **Settings -> Boundary Manager**.
2. Click **Upload Custom GeoJSON**.
3. Select the target Administrative Level (e.g., Level 2 / District).
4. Upload the file and click **Store**.

## 5. Common Mistakes
> [!WARNING]
> Do not upload extremely dense, unsimplified shapefiles. Use tools like Mapshaper to simplify polygons before uploading to prevent browser lag.

## 6. Troubleshooting Tips
> **Baby steps:** If a boundary doesn't appear, ensure the file is valid GeoJSON (not a raw Shapefile).

## 7. Escalation Path
For database-level spatial query failures (`ST_Intersects`), contact the **System Administrator**.
