---
title: "GIS Microplanning Walkthrough"
version: 1.0.0
status: Final
last_updated: 2026-06-21
audience: District Managers, GIS Specialists, Facility In-Charges
---

# GIS Microplanning Walkthrough

## 1. Module Purpose
Provides spatial visualization of the immunization network, enabling users to see facilities, communities, outreach posts, and catchments on an interactive map.

## 2. Who Uses It
- **Facility Users:** To visualize their specific catchment area.
- **District Managers:** To spot coverage gaps and unassigned HTR communities.
- **GIS Specialists:** To audit boundaries and population distribution.

## 3. Main Screens and Navigation
- **Map View:** The primary interface. Features layer toggles, a basemap selector, and interactive markers.
- **Location Intelligence Drawer:** A side-panel that slides out when clicking on the map.

## 4. Key Actions
### 4.1. Analyzing a Specific Location
1. Click any point on the map.
2. The **Location Intelligence Drawer** opens.
3. It displays the estimated population within a 1km radius, nearby facilities, and travel time.

### 4.2. Toggling Layers
1. Open the Layer Control menu (top right of the map).
2. Check or uncheck layers like "Outreach Posts", "Hard-to-Reach Communities", or "WorldPop Heatmap".

## 5. Permissions and RBAC
- Map layers available depend on the user's geographical scope. A facility user cannot view the entire country map.

## 6. Troubleshooting
> **Baby steps:** If the map is slow to load, switch the basemap from "Satellite" to "OpenStreetMap".

## 7. Related Modules
- [Location Intelligence Walkthrough](./population-intelligence-walkthrough.md)
