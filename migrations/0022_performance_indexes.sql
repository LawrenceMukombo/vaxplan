-- Performance indexes for slow queries identified in production profiling
-- All use IF NOT EXISTS — safe to run repeatedly, zero data loss.

-- villages: speeds up the community-routes endpoint which queries
-- assigned_facility_id on every Facilities page open (~1,500ms -> ~50ms)
CREATE INDEX IF NOT EXISTS idx_villages_tenant_facility
  ON villages (tenant_id, assigned_facility_id)
  WHERE assigned_facility_id IS NOT NULL;

-- villages: speeds up district-scoped PostGIS proximity fallback
CREATE INDEX IF NOT EXISTS idx_villages_tenant_district
  ON villages (tenant_id, district_id);

-- villages: partial index for the coordinate check in the spatial fallback
CREATE INDEX IF NOT EXISTS idx_villages_tenant_coords
  ON villages (tenant_id)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- facilities: speeds up the full-list query (4,300 rows, ~1,600ms -> ~100ms)
CREATE INDEX IF NOT EXISTS idx_facilities_tenant
  ON facilities (tenant_id);

-- facilities: speeds up the district-scoped facility filter
CREATE INDEX IF NOT EXISTS idx_facilities_tenant_district
  ON facilities (tenant_id, district_id);
