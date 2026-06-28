# Microplanning Readiness and Prefill

VaxPlan treats the Population Hub and facility reference data as the source of truth for routine microplanning. The Routine Microplanning Wizard should consume clean prefills and ask health workers only for decisions, confirmation, and local notes.

## Population Hub Denominators

Population source options are exposed through `GET /api/population-scenarios?facilityId=&year=`. The endpoint groups existing `population_data` rows by source and year and returns scenario summaries:

- source name
- method
- year
- confidence
- approval status
- version
- total population
- target infants
- under-five population
- data quality flags

The wizard stores the selected scenario in its Step 1 coverage-review payload. Facility users can select an available source but cannot edit official method, year, confidence, status, or version metadata. District, provincial, national, and GIS roles may add override notes.

## Readiness Check

`GET /api/microplans/readiness/:facilityId?year=` returns green/amber/red readiness items before planning starts. It checks existing platform data:

- facility profile and map point
- official facility catchment polygon
- linked communities
- community coordinates and polygons
- communities inside the facility catchment
- community polygon overlap
- Population Hub scenario availability
- staff roster
- cold-chain equipment
- vaccine catalogue
- stock history

Blocking issues should be fixed before submission. Amber issues can be completed later but are shown early so workers know what is missing.

## Prefill Bundle

`GET /api/microplans/prefill/:facilityId?year=` returns the wizard bundle:

- facility
- communities
- official catchment
- population scenarios and selected scenario
- staff roster
- cold chain
- vaccine catalogue/config
- stock history
- previous microplans
- readiness summary
- denominator override permission

The wizard Step 1 Population Source card consumes this bundle and fills downstream denominator fields from the selected scenario.

## Polygon Validation Rules

Facility validation endpoint: `POST /api/geospatial/facility/:facilityId/validate`

Community validation endpoint: `POST /api/geospatial/community/:communityId/validate`

Current validation uses Turf.js and existing GeoJSON fields. It checks that map areas are polygons, calculates area, warns on unusually large polygons, checks whether facility/community points sit inside their parent catchment, and detects sibling community polygon overlap. If PostGIS topology checks are available in a deployment, these endpoints can be extended without changing the frontend contract.

## WorldPop Calculation Workflow

Population calculation endpoints:

- `POST /api/geospatial/facility/:facilityId/calculate-population`
- `POST /api/geospatial/community/:communityId/calculate-population`

The current implementation reads local `population_grids` rows and calculates intersecting grid totals. It returns calculation status, total population, under-five population, method, confidence, and whether the result was persisted. It does not overwrite official Population Hub records automatically. Production deployments can replace this with a background raster worker using geotiff.js or Python rasterio/rasterstats while preserving the endpoint shape.

## Override Rules

Facility health workers may select a source and submit notes. Official denominator metadata is protected. Override capability is limited to:

- district_manager
- provincial_coordinator
- national_admin
- gis_specialist

Every future write endpoint that changes official scenario metadata should require a reason and write an audit log before changing approved data.