# Polygon lifecycle and governance

VaxPlan treats facility catchments, community boundaries, settlement areas, outreach areas, administrative boundaries, and custom planning polygons as governed geospatial records. An approved polygon is never overwritten by an edit.

## Lifecycle

1. **Draft**: a new or corrected geometry that is not operational.
2. **Submitted for review**: validation has passed and reviewers are notified.
3. **Active**: the approved version used by current operational screens.
4. **Needs correction**: a reviewer returned the proposed version with a reason.
5. **Replaced**: a formerly active version superseded by an approved replacement.
6. **Archived**: an inactive version retained for audit.
7. **Rejected** is represented by approval status rejected with lifecycle status needs correction, allowing correction and resubmission.

Only an inactive draft that has never become active can be permanently deleted. Active versions must be superseded; historical versions remain queryable.

## Permissions

| Permission | Purpose |
| --- | --- |
| polygon.view | View current polygons within geographic scope |
| polygon.create | Create initial or draft polygons |
| polygon.edit | Create correction versions and submit drafts |
| polygon.replace | Propose a completely redrawn version |
| polygon.delete_draft | Delete an unused draft |
| polygon.archive | Archive an inactive version |
| polygon.approve | Approve or return submitted versions |
| polygon.override_validation | Approve configured warnings with a reason |
| polygon.view_history | View version history |
| polygon.compare_versions | Compare area, geometry, population, and planning impact |
| polygon.recalculate_population | Refresh a version's population estimate |

Every permission is combined with tenant and geographic scope checks. The all-tenant startup upsert merges these capabilities into existing role configurations without removing custom permissions.

## Validation

Blocking validation prevents save or submission:

- non-polygon or malformed GeoJSON;
- zero or negligible area;
- self-intersection;
- a community outside its parent facility catchment;
- overlap between sibling community polygons.

Warnings require reviewer attention and, where configured, an override reason:

- facility catchment overlap beyond tolerance;
- facility or community point outside its polygon.

Area and centroid calculations are informational. Population is recalculated for every proposed version from the tenant's configured population cascade.

## Approval and historical integrity

Approval runs in a database transaction. The prior active version becomes replaced, receives valid_to, and points to the replacement. The approved proposal becomes the sole active version and receives valid_from. Legacy facility or village geometry columns are updated only at approval so existing application modules continue to read the current official boundary.

Existing microplans, sessions, reports, and population records are not rewritten. Version comparison reports area and population changes plus counts of potentially affected communities, microplans, sessions, and reports.

## API summary

- GET /api/polygons/:entityType/:entityId/current
- GET /api/polygons/:entityType/:entityId/history
- POST /api/polygons/:entityType/:entityId/validate
- POST /api/polygons/:entityType/:entityId/create
- POST /api/polygons/:entityType/:entityId/edit
- POST /api/polygons/:entityType/:entityId/replace
- POST /api/polygons/:polygonVersionId/submit
- POST /api/polygons/:polygonVersionId/approve
- POST /api/polygons/:polygonVersionId/reject
- POST /api/polygons/:polygonVersionId/archive
- DELETE /api/polygons/:polygonVersionId/draft
- GET /api/polygons/:entityType/:entityId/compare
- POST /api/polygons/:polygonVersionId/recalculate-population

All write actions create audit log entries. Submit, approve, and correction actions notify affected district, provincial, GIS, and national users.