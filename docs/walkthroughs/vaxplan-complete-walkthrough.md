---
title: VaxPlan Complete Walkthrough and User Guide
version: 1.0.0
status: Final
last_updated: 2026-06-21
audience: Facility users, district users, national administrators, GIS specialists, developers, partners
---

# VaxPlan Complete Walkthrough and User Guide

**Reach Every Child. Plan Every Session.**

---

## 1. Cover Section
**Product Name:** VaxPlan
**Tagline:** Reach Every Child. Plan Every Session.
**Document Version:** 1.0.0
**Intended Audience:** Ministry of Health staff at all levels (Facility, District, Provincial, National), GIS Specialists, System Administrators, Donors, Partners, and Implementation Teams.
**Status:** Approved for Training and Reference.

---

## 2. Executive Overview
VaxPlan is a GIS-enabled, offline-first, multi-tenant digital public infrastructure platform for immunization microplanning. It replaces paper-based microplanning and session tracking with a live geospatial engine.

**Core Capabilities:**
- **GIS-Enabled Microplanning:** Map every facility, community, and outreach session.
- **Facility and Community Mapping:** Register fixed sites and map out their precise catchment areas.
- **Population Intelligence:** Intersect drawn boundaries with WorldPop raster grids to extract hyper-local population denominators.
- **Zero-Dose Identification:** Analyze missing geographic coverage to identify unreached settlements.
- **Session Planning:** Build actionable quarterly plans linked to specific locations and staff.
- **Forecasting:** Predict vaccine and cold-chain needs based on session targets.
- **Dashboards:** Roll up coverage and dropout metrics seamlessly from the facility to the national level.
- **Supervision:** Schedule, execute, and score supportive supervision visits.
- **Research Support:** Manage pilot programs and document implementation learnings.

---

## 3. User Roles and Access Levels
VaxPlan uses strict Role-Based Access Control (RBAC). A user can only access data within their assigned geographical hierarchy and country (Tenant).

- **Facility User / Clerk:** Authors microplans and captures session results. (Restricted to their own facility).
- **Facility In-Charge:** Same as clerk but holds the authority to submit microplans for district approval.
- **District Manager:** Reviews, approves, or rejects facility microplans. Views rolled-up district coverage. Plans supervision visits. Cannot author facility microplans.
- **Provincial Coordinator:** Monitors province-wide KPIs, approves district-level aggregated plans, and requests inter-district stock reallocations.
- **National Administrator:** Configures the tenant. Manages user roles, baseline facility/village data, custom boundaries, and vaccine schedules. Views national dashboards.
- **GIS Specialist:** Specialized role for managing complex spatial datasets, drawing custom polygons, and validating WorldPop intersections.
- **System Administrator (Super Admin):** Manages the global platform, onboards new countries (Tenants), and manages safe deployments.
- **Viewer / Read-Only:** Can browse dashboards and reports but cannot edit data (often assigned to partners or researchers).

---

## 4. Platform Navigation
- **Sidebar:** The primary navigation menu on the left. It is collapsible for maximum map space. Only modules you have permission to access are visible.
- **Global Search (Command Menu):** Press `Ctrl+K` / `Cmd+K` to search for modules, dashboards, or quick actions anywhere.
- **Country Selector:** (Super Admins only) Located top-left to switch between Ministry of Health tenants.
- **User Menu:** Top-right corner. Access theme toggles, language preferences, and logout.
- **Sync Indicator:** A cloud icon in the header displays your offline/online status. When offline, items are queued in an outbox. When online, clicking the icon forces an immediate sync.

---

## 5. Dashboard Module
**Purpose:** Provides a high-level overview of key performance indicators (KPIs).
- **Key Indicators:** Coverage rates, zero-dose counts, dropout rates (e.g., Penta1 → Penta3), and stock alerts.
- **Filters:** Adjust by Year, Quarter, Province, District, or Facility. All charts update reactively.
- **Cross-Filtering:** Clicking on a specific bar chart segment or map region filters the other tables and KPIs on the page.
- **Interpretation:** Use the dashboard to quickly spot failing districts or unexpected stockouts before drilling into specific reports.

---

## 6. Facilities Module
**Purpose:** The registry of all physical health infrastructure.
- **Facilities Table:** Features horizontal scroll, pagination, column visibility toggles, and sorting.
- **Sticky Action Column:** Ensures the "Edit/View" button is always reachable.
- **Detail View:** Click a row to open the facility.
- **Tabs:**
  - **General:** Name, type, ID, and GPS coordinates.
  - **Communities Served:** Villages assigned to this facility's catchment.
  - **Polygon Drawing:** Map view to visually trace the exact geographic border of the facility's responsibility.
  - **Staff Roster:** Users attached to the facility.
  - **Cold Chain:** Refrigerator and freezer inventory management.

---

## 7. Communities and Settlements Module
**Purpose:** Managing the smallest operational geographic units.
- **Registering:** National Admins can bulk upload via CSV. District/Facility users can add missing communities manually via the Communities tab.
- **Access Categories:** Track travel mode (walk, vehicle, boat) and precise coordinates.
- **HTR (Hard-To-Reach):** A flag indicating the settlement faces severe geographical or security barriers.
- **District Responsibility:** Settlements unassigned to a facility or located >50km from a facility fall to the District Manager to cover via mobile teams.

---

## 8. GIS Microplanning and Map View
**Purpose:** Spatial visualization of the immunization network.
- **Basemap Selector:** Choose between OpenStreetMap or high-res ArcGIS Satellite Imagery.
- **Map Layers:** Toggle Facilities, Communities, Outreach Posts, Heatmaps, and Travel Time zones.
- **Click-based Intelligence:** Clicking any point on the map retrieves the estimated population within a 1km radius and the travel time to the nearest facility.

---

## 9. Location Intelligence Drawer
**Purpose:** A contextual side-panel that opens when interacting with the map.
- **Data Displayed:** Shows nearby facilities, distance (road vs. straight-line), and estimated population clusters from WorldPop.
- **Actionable Insights:** Suggests actions like "Establish new outreach post" if a high-population zero-dose cluster is detected far from existing services.

---

## 10. Polygon Drawing and Catchment Management
**Purpose:** Define exact operational borders for accurate denominator extraction.
- **Drawing:** Use Leaflet Geoman tools on the map to draw custom polygons around a facility's catchment.
- **Exclusion Rules:** The system warns if the polygon stretches beyond realistic bounds (e.g., >50km) or overlaps a neighboring facility's catchment (triggering a Harmonization Request).
- **Population Summary:** Upon saving, the area is calculated, and the polygon is stored safely in the `gis_polygons` table.

---

## 11. Population Intelligence
**Purpose:** Generating accurate denominators for planning.
- **Official Population:** Standard demographic estimates loaded by the Ministry.
- **Calculated GridPop / WorldPop:** When a custom polygon is saved, VaxPlan uses PostGIS `ST_Intersects` against WorldPop raster data to calculate the exact number of people living inside that shape.
- **Discrepancy Badges:** If the Official Population and the WorldPop estimate differ wildly, a warning badge prompts the user to select the most realistic denominator for their microplan.

> [!WARNING]
> Do not overwrite official population figures directly. VaxPlan stores both the official registry value and the GIS-calculated value side-by-side to allow data-driven decision making.

---

## 12. Microplanning Wizard
**Purpose:** The core workflow for building a quarterly action plan.
1. **Scope:** Select Quarter and Year.
2. **Catchment Review:** Confirm which villages are served.
3. **Population Review:** Select the denominator (Official vs. GIS calculated).
4. **Vaccine Forecasting:** Select the required antigens. The system auto-calculates doses based on the denominator, doses-per-child, and wastage rates.
5. **Session Planning:** Allocate the number of planned outreach trips per village.
6. **Logistics & HR:** Note transport needs, cold boxes, and lead vaccinators.
7. **Approval:** Submit the draft to the District Manager.

---

## 13. Social Mobilization / ACSM Section
**Purpose:** Advocacy, Communication, and Social Mobilization (ACSM).
- Maps community stakeholders (village heads, religious leaders, traditional healers, schools).
- **Health Facility Polio Social Mobilization Plan:** Integrated template targeting specific mobilization activities with planned dates, responsible persons, and recorded success stories.

---

## 14. Sessions Module
**Purpose:** Executing the microplan.
- **Session Types:** Fixed (at facility), Outreach (community visit), Mobile (nomadic tracking).
- **Calendar:** Drag-and-drop calendar view of all planned sessions.
- **Session Status:** Planned → In-Progress → Achieved (or Cancelled/Missed).
- **Execution:** Offline-capable screen to tally vaccinated children against antigen types.

---

## 15. Stock Ledger and Forecasting
**Purpose:** Managing cold-chain inventory.
- Auto-deducts stock when a session is marked "Achieved".
- Triggers low-stock and expiry alerts on the dashboard.
- Forecasts future needs in the Microplan Wizard based on historical wastage rates and upcoming target cohorts.

---

## 16. Recommendations Module
**Purpose:** AI and Rule-based guidance.
- Evaluates the database to find Unserved Settlements (Zero-Dose) and generates pending recommendations (e.g., "Establish quarterly outreach").
- Managers review, prioritize (High/Medium/Low), and mark them as "Actioned" or "Dismissed".

---

## 17. Hard-to-Reach (HTR) Module
**Purpose:** Specialized tracking for difficult geographies.
- Settlements flagged as HTR are automatically highlighted in Missed Community reports.
- Requires explicit justification in the Microplan Wizard if an HTR community has zero planned outreach sessions.

---

## 18. Supervision Tools
**Purpose:** Managing Integrated Supportive Supervision (ISS).
- Schedule visits to facilities. Use offline-capable checklists to score compliance. Scores roll up to the District/Provincial dashboards.

---

## 19. Research Module
**Purpose:** A repository for implementation learnings and pilot tracking.
- Upload operational research documents, pilot results, and white papers to a central, searchable library accessible by partners and national admins.

---

## 20. Alerts and Notifications
**Purpose:** Automated system warnings.
- Types: Stockouts, Missed Sessions, Disease Outbreak (VPD) thresholds, and Catchment Overlaps.
- Notifications are routed to the in-app bell icon and can integrate with Twilio SMS/WhatsApp.

---

## 21. Client Logbook, Defaulter List, Dropout Rates, Missed Communities
- **Client Logbook:** Line-listing of vaccinated children.
- **Defaulters & Dropouts:** Calculates children who received Penta1 but missed Penta3 past their due date. Generates actionable follow-up lists.
- **Missed Communities:** A report specifically highlighting villages that had a planned session that was never executed.

---

## 22. HIS Integrations
**Purpose:** Interoperability with broader Health Information Systems.
- VaxPlan can be configured to push aggregate indicator data (e.g., Doses Administered) to a national DHIS2 instance using standard API payloads.

---

## 23. Admin Guide
**Purpose:** Tenant configuration.
- National Admins manage the staff roster, password resets, facility coordinates, base vaccine schedules, and custom administrative labels via the "Settings" and "Administration" sidebar tabs.

---

## 24. Data Safety and Governance
> [!IMPORTANT]
> **Data safety:** VaxPlan follows a strictly NO WIPE, NO OVERWRITE, UPSERT-ONLY approach for production data. 

- Data is strongly isolated by Tenant (Country).
- Deleted records are typically "soft-deleted" (marked inactive) to preserve audit trails.

---

## 25. Deployment and Release Walkthrough
**Purpose:** Safely updating the VaxPlan server.
- **Safe Migrations:** Never use standard destructive Drizzle pushes in production. Use the specialized `npm run db:safe-update` command which leverages `scripts/safe-migration.ts`.
- **Process:** 
  1. SSH into VPS.
  2. Pull code (`git pull origin main`).
  3. Run safe schema update (`npm run db:safe-update`).
  4. Build (`npm run build`).
  5. Restart PM2 (`pm2 restart vaxplan`).

---

## 26. Release History and Implementation Walkthroughs

### Phase 1: Location Intelligence Drawer
* **Objective:** Bring spatial awareness to the map interface.
* **Changes:** Added horizontal scroll to Facilities Table, built GIS API routes, and created the interactive side-drawer.
* **Verification:** Command-line build passing.

### Phase 2: Custom Catchment Drawing & Population Intelligence
* **Objective:** Allow users to draw exact facility boundaries.
* **Changes:** Integrated Leaflet Geoman, created `gis_polygons` PostGIS table, and implemented WorldPop raster intersection logic.
* **Verification:** Safe server migration script validated. Data integrity preserved.

### Phase 3: Deployment Hardening
* **Objective:** Standardize VPS deployment.
* **Changes:** Developed `production_deployment_sop.md` and refined custom `.env` parsing for isolated production environments.
* **Verification:** Zero downtime PM2 restarts achieved.

---

## 27. Troubleshooting Guide

### Issue: Map Layers Not Loading
**Symptom:** The map is blank or grey.
**Likely Cause:** Offline mode kicked in before tiles were cached, or the basemap provider is blocked by a firewall.
**Baby-step fix:** Check your internet connection. Click the Sync icon. If online, switch the basemap toggle to "OpenStreetMap" as it requires less bandwidth than Satellite.
**When to escalate:** If maps never load on a stable connection for multiple users.

### Issue: Polygon Population Says "Calculating..." indefinitely
**Symptom:** Saved a polygon but the population summary fails to load.
**Likely Cause:** The PostGIS intersection query timed out on a massive polygon.
**Baby-step fix:** Delete the polygon and draw a slightly smaller, more accurate boundary closer to the facility.
**When to escalate:** If the server logs show a spatial indexing error.

---

## 28. Glossary
- **ACSM:** Advocacy, Communication, and Social Mobilization.
- **Catchment:** The geographical area and population a specific health facility is responsible for.
- **GridPop / WorldPop:** High-resolution geospatial datasets estimating human population distribution.
- **HTR:** Hard-to-Reach.
- **PostGIS:** The spatial database extension for PostgreSQL used to calculate polygon areas and intersections.
- **Safe Migration:** A database deployment protocol that only adds columns/tables and never drops data.
- **Zero-Dose:** A child or community that has not received even the first dose of a basic vaccine (e.g., Penta1 or OPV1).

---

## 29. Appendices
### Administrator Checklist (Monthly)
- [ ] Review Unresolved Catchment Overlaps.
- [ ] Monitor Stockout Alerts on the National Dashboard.
- [ ] Ensure all District Managers have approved pending microplans.
- [ ] Run `npm run check` and review server logs for silent errors.
