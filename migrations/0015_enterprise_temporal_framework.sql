-- Enterprise time dimension and historical reference data management framework.
-- Additive migration: no existing production table or identifier is deleted.

CREATE TABLE IF NOT EXISTS temporal_entity_versions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_entity_id varchar(120) NOT NULL,
  entity_type varchar(80) NOT NULL,
  source_record_id varchar(120),
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_until timestamptz,
  status varchar(40) NOT NULL DEFAULT 'draft',
  is_current boolean NOT NULL DEFAULT false,
  is_future boolean NOT NULL DEFAULT false,
  is_correction boolean NOT NULL DEFAULT false,
  change_type varchar(80) NOT NULL DEFAULT 'creation',
  change_reason text,
  change_summary text,
  source_type varchar(80),
  source_reference varchar(255),
  source_document_url text,
  source_system varchar(120),
  created_by varchar REFERENCES users(id),
  reviewed_by varchar REFERENCES users(id),
  approved_by varchar REFERENCES users(id),
  superseded_by varchar,
  corrected_from_version_id varchar,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_snapshot jsonb,
  affected_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_temporal_valid_period CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT ck_temporal_recorded_period CHECK (recorded_until IS NULL OR recorded_until > recorded_at),
  CONSTRAINT uq_temporal_entity_version_number UNIQUE (tenant_id, entity_type, stable_entity_id, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_temporal_current_version
  ON temporal_entity_versions (tenant_id, entity_type, stable_entity_id)
  WHERE is_current = true AND recorded_until IS NULL AND status IN ('active', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_temporal_versions_tenant_entity ON temporal_entity_versions (tenant_id, entity_type, stable_entity_id);
CREATE INDEX IF NOT EXISTS idx_temporal_versions_current ON temporal_entity_versions (tenant_id, entity_type, is_current);
CREATE INDEX IF NOT EXISTS idx_temporal_versions_valid ON temporal_entity_versions (tenant_id, entity_type, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_temporal_versions_recorded ON temporal_entity_versions (tenant_id, entity_type, recorded_at, recorded_until);

CREATE TABLE IF NOT EXISTS temporal_change_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type varchar(80) NOT NULL,
  stable_entity_id varchar(120) NOT NULL,
  version_id varchar REFERENCES temporal_entity_versions(id) ON DELETE CASCADE,
  workflow_status varchar(40) NOT NULL DEFAULT 'draft',
  requested_action varchar(80) NOT NULL DEFAULT 'create_version',
  retroactive boolean NOT NULL DEFAULT false,
  requires_impact_assessment boolean NOT NULL DEFAULT false,
  requested_by varchar REFERENCES users(id),
  reviewed_by varchar REFERENCES users(id),
  approved_by varchar REFERENCES users(id),
  request_reason text,
  review_comments text,
  approval_comments text,
  impact_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_temporal_change_requests_tenant_status ON temporal_change_requests (tenant_id, workflow_status);
CREATE INDEX IF NOT EXISTS idx_temporal_change_requests_entity ON temporal_change_requests (tenant_id, entity_type, stable_entity_id);

CREATE TABLE IF NOT EXISTS temporal_audit_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type varchar(80) NOT NULL,
  stable_entity_id varchar(120) NOT NULL,
  version_id varchar REFERENCES temporal_entity_versions(id) ON DELETE SET NULL,
  event_type varchar(80) NOT NULL,
  event_summary text NOT NULL,
  previous_values jsonb,
  new_values jsonb,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_id varchar REFERENCES users(id),
  reviewer_id varchar REFERENCES users(id),
  approver_id varchar REFERENCES users(id),
  source_ip_address varchar(100),
  user_agent varchar(400),
  import_batch_id varchar,
  source_system varchar(120),
  supporting_document_url text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_temporal_audit_tenant_entity ON temporal_audit_events (tenant_id, entity_type, stable_entity_id);
CREATE INDEX IF NOT EXISTS idx_temporal_audit_occurred ON temporal_audit_events (tenant_id, occurred_at);

CREATE TABLE IF NOT EXISTS temporal_entity_lineage (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type varchar(80) NOT NULL,
  from_stable_entity_id varchar(120) NOT NULL,
  to_stable_entity_id varchar(120) NOT NULL,
  lineage_type varchar(80) NOT NULL,
  effective_at timestamptz NOT NULL,
  source_reference varchar(255),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by varchar REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_temporal_lineage_from ON temporal_entity_lineage (tenant_id, entity_type, from_stable_entity_id);
CREATE INDEX IF NOT EXISTS idx_temporal_lineage_to ON temporal_entity_lineage (tenant_id, entity_type, to_stable_entity_id);

CREATE TABLE IF NOT EXISTS temporal_role_assignments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code varchar(80) NOT NULL,
  scope_type varchar(40) NOT NULL DEFAULT 'tenant',
  scope_id varchar(120),
  effective_start timestamptz NOT NULL,
  effective_end timestamptz,
  assignment_type varchar(80) NOT NULL DEFAULT 'substantive',
  delegated_authority boolean NOT NULL DEFAULT false,
  approval_limit numeric(14,2),
  appointment_source varchar(255),
  assigned_by varchar REFERENCES users(id),
  approved_by varchar REFERENCES users(id),
  reason text,
  status varchar(40) NOT NULL DEFAULT 'pending_approval',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_temporal_role_period CHECK (effective_end IS NULL OR effective_end > effective_start)
);
CREATE INDEX IF NOT EXISTS idx_temporal_role_assignments_user ON temporal_role_assignments (tenant_id, user_id, effective_start, effective_end);
CREATE INDEX IF NOT EXISTS idx_temporal_role_assignments_scope ON temporal_role_assignments (tenant_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_temporal_role_assignments_status ON temporal_role_assignments (tenant_id, status);

CREATE TABLE IF NOT EXISTS temporal_employment_assignments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_user_id varchar REFERENCES users(id),
  stable_person_id varchar(120) NOT NULL,
  employer varchar(255),
  department varchar(255),
  programme varchar(255),
  employment_number varchar(120),
  job_title varchar(255),
  cadre varchar(120),
  employment_type varchar(80),
  contract_type varchar(80),
  employment_status varchar(80) NOT NULL DEFAULT 'active',
  duty_station varchar(255),
  facility_id integer REFERENCES facilities(id),
  district_id integer REFERENCES districts(id),
  province_id integer REFERENCES provinces(id),
  supervisor_user_id varchar REFERENCES users(id),
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  appointment_reference varchar(255),
  acting_or_substantive varchar(80),
  secondment boolean NOT NULL DEFAULT false,
  reason_for_change text,
  status varchar(40) NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by varchar REFERENCES users(id),
  approved_by varchar REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_temporal_employment_period CHECK (end_date IS NULL OR end_date > start_date)
);
CREATE INDEX IF NOT EXISTS idx_temporal_employment_person ON temporal_employment_assignments (tenant_id, stable_person_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_temporal_employment_user ON temporal_employment_assignments (tenant_id, person_user_id);

CREATE TABLE IF NOT EXISTS temporal_geography_versions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stable_geography_id varchar(120) NOT NULL,
  geography_type varchar(80) NOT NULL,
  source_record_id varchar(120),
  name varchar(255) NOT NULL,
  code varchar(120),
  parent_stable_geography_id varchar(120),
  parent_geography_type varchar(80),
  version_number integer NOT NULL DEFAULT 1,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  geometry jsonb,
  geometry_source varchar(255),
  coordinate_reference_system varchar(80) DEFAULT 'EPSG:4326',
  accuracy_rating varchar(80),
  status varchar(40) NOT NULL DEFAULT 'active',
  change_type varchar(80) NOT NULL DEFAULT 'creation',
  change_reason text,
  reviewed_by varchar REFERENCES users(id),
  approved_by varchar REFERENCES users(id),
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_temporal_geography_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX IF NOT EXISTS idx_temporal_geography_stable ON temporal_geography_versions (tenant_id, geography_type, stable_geography_id);
CREATE INDEX IF NOT EXISTS idx_temporal_geography_parent ON temporal_geography_versions (tenant_id, parent_stable_geography_id);
CREATE INDEX IF NOT EXISTS idx_temporal_geography_valid ON temporal_geography_versions (tenant_id, valid_from, valid_to);

CREATE TABLE IF NOT EXISTS temporal_population_denominators (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stable_population_id varchar(120) NOT NULL,
  geography_type varchar(80) NOT NULL,
  geography_stable_id varchar(120) NOT NULL,
  reference_year integer NOT NULL,
  reference_date timestamptz,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  source varchar(255) NOT NULL,
  dataset_version varchar(120),
  methodology text,
  population_type varchar(80) NOT NULL DEFAULT 'total',
  total_population integer,
  target_population integer,
  birth_cohort integer,
  surviving_infants integer,
  children_under_one integer,
  children_under_five integer,
  pregnant_women integer,
  women_reproductive_age integer,
  zero_dose_target_population integer,
  age_sex_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  urban_rural_classification varchar(80),
  confidence_interval varchar(120),
  quality_rating varchar(80),
  adjustment_factor numeric(10,4),
  growth_rate numeric(10,4),
  designation varchar(80) NOT NULL DEFAULT 'provisional',
  approved_planning_value boolean NOT NULL DEFAULT false,
  superseded_estimate_id varchar,
  import_batch_id varchar,
  source_file text,
  status varchar(40) NOT NULL DEFAULT 'draft',
  approved_by varchar REFERENCES users(id),
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_temporal_population_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX IF NOT EXISTS idx_temporal_population_geo_year ON temporal_population_denominators (tenant_id, geography_type, geography_stable_id, reference_year);
CREATE INDEX IF NOT EXISTS idx_temporal_population_designation ON temporal_population_denominators (tenant_id, designation, status);
CREATE INDEX IF NOT EXISTS idx_temporal_population_valid ON temporal_population_denominators (tenant_id, valid_from, valid_to);

-- Migration backfill marker: current records can be seeded as initial temporal versions
-- by a controlled staging run. This migration intentionally creates the structure only.
