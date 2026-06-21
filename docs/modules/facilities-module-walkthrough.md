---
title: "Facilities Module Walkthrough"
version: 1.0.0
status: Final
last_updated: 2026-06-21
audience: All Users
---

# Facilities Module Walkthrough

## 1. Module Purpose
The Facilities Module acts as the core registry for all health infrastructure. It stores metadata, coordinates, assigned communities, and cold-chain equipment details for each fixed site.

## 2. Who Uses It
- **Facility Users:** View their own facility details, assign communities, and draw catchments.
- **District Managers:** View all facilities in the district.
- **National Admins:** Create new facilities and configure global attributes.

## 3. Main Screens and Navigation
- **Facilities Table:** A list view of all accessible facilities with horizontal scroll, pagination, and robust filtering.
- **Facility Detail View:** Accessible by clicking any row in the table. Contains tabs for General Info, Communities Served, Polygon Drawing, Staff Roster, and Cold Chain.

## 4. Key Actions
### 4.1. Assigning a Community
1. Open a facility and go to the **Communities Served** tab.
2. Search for the target community using the search bar.
3. Click the **+** or **Assign** button.
4. The community's population is now added to the facility's denominator pool.

### 4.2. Drawing a Polygon Catchment
1. Navigate to the **Polygon Drawing** tab.
2. Use the Leaflet Geoman tools on the left of the map to trace the boundary.
3. Click **Save**. The system will calculate the precise geographic area.

## 5. Permissions and RBAC
- Only National Admins can physically delete a facility (though soft-delete is preferred).
- Facility Users can edit their own facility's polygon, but District Managers cannot draw it for them.

## 6. Troubleshooting
> **Baby steps:** If a facility is missing from the table, check if the "Status" filter is set to "Active Only". 

## 7. Related Modules
- [GIS Microplanning Walkthrough](./gis-microplanning-walkthrough.md)
- [Polygon Drawing Walkthrough](./polygon-drawing-walkthrough.md)
