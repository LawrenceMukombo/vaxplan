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

## 5. Step-by-step Workflow: Auditing Catchments & Auto-Clipping Overlaps
1. Navigate to **Facilities** -> Select target Health Facility -> Open **Catchment Map**.
2. Audit the facility boundary and community sub-polygons against satellite and terrain basemaps.
3. If an overlap warning or invalid geometry flag is raised:
   - Click **Edit vertices** or **Replace** to adjust points with live emerald edge snapping.
   - For community sub-polygons, click **`⚡ Auto-Clip to Free Space`** to automatically trim overlapping segments against neighboring boundaries in 1-click.
4. Scroll down to **"🎯 Missed Communities & Gap Analysis"**:
   - Inspect **Orphaned Zero-Dose Places** (settlements outside any health facility catchment).
   - Inspect **Uncovered Catchment Area** (interior gaps rendered as red-hatched polygons).
   - Assign uncovered settlements by updating or redrawing community boundaries.
5. Click **"Save All"** to synchronize the topology across all users.

## 6. Common Mistakes
> [!WARNING]
> Do not upload extremely dense, unsimplified shapefiles. Use tools like Mapshaper to simplify polygons before uploading to prevent browser lag.
> Never approve overlapping facility catchments without validating with both facility in-charges.

## 7. Troubleshooting Tips
> **Baby steps:** If a boundary doesn't appear, ensure the file is valid GeoJSON (not a raw Shapefile).
> If a drawn polygon shows self-intersection, press `Ctrl+Z` to undo the crossing vertex or click **`⚡ Auto-Clip to Free Space`** to clean up the boundary.

## 8. Escalation Path
For database-level spatial query failures (`ST_Intersects`), contact the **System Administrator**.
