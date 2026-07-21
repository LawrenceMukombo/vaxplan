-- Enterprise time dimension and historical reference data management framework.
-- Additive migration: no existing production table or identifier is deleted.

CREATE TABLE IF NOT EXISTS entity_history_versions (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stable_entity_id varchar(255) NOT NULL,
  entity_type varchar(100) NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  country_id integer,
  province_id integer,
  district_id integer,
  facility_id integer,
  valid_from timestamp NOT NULL DEFAULT now(),
  valid_to timestamp,
  recorded_at timestamp NOT NULL DEFAULT now(),
  recorded_until timestamp,
  status varchar(50) NOT NULL DEFAULT 'active',
  is_current boolean NOT NULL DEFAULT true,
  change_type varchar(100) NOT NULL DEFAULT 'created',
  change_reason text,
  change_summary text,
  source_type varchar(100) DEFAULT 'manual',
  source_reference text,
  source_document_url text,
  created_by varchar(255),
  reviewed_by varchar(255),
  approved_by varchar(255),
  approved_at timestamp,
  superseded_by integer,
  corrected_from_version_id integer,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  snapshot_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_hist_tenant ON entity_history_versions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_entity_hist_type_entity ON entity_history_versions (tenant_id, entity_type, stable_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_hist_current ON entity_history_versions (tenant_id, entity_type, stable_entity_id, is_current);
CREATE INDEX IF NOT EXISTS idx_entity_hist_valid_dates ON entity_history_versions (tenant_id, valid_from, valid_to);

CREATE TABLE IF NOT EXISTS user_assignment_history (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_id integer REFERENCES entity_history_versions(id) ON DELETE CASCADE,
  user_id varchar(255) NOT NULL,
  role_id varchar(100),
  role_name varchar(255),
  assignment_type varchar(50) NOT NULL DEFAULT 'substantive',
  country_id integer,
  province_id integer,
  district_id integer,
  facility_id integer,
  valid_from timestamp NOT NULL DEFAULT now(),
  valid_to timestamp,
  status varchar(50) NOT NULL DEFAULT 'active',
  assigned_by varchar(255),
  approved_by varchar(255),
  reason text,
  permissions jsonb DEFAULT '[]'::jsonb,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_assign_hist_tenant ON user_assignment_history (tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_assign_hist_user ON user_assignment_history (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS facility_history_versions (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_id integer REFERENCES entity_history_versions(id) ON DELETE CASCADE,
  facility_id integer NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  name varchar(255) NOT NULL,
  hmis_code varchar(100),
  facility_type varchar(100),
  ownership varchar(100),
  operational_status varchar(50) DEFAULT 'operational',
  country_id integer,
  province_id integer,
  district_id integer,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  catchment_polygon jsonb,
  cold_chain_status varchar(50) DEFAULT 'No',
  staff_count integer DEFAULT 0,
  valid_from timestamp NOT NULL DEFAULT now(),
  valid_to timestamp,
  status varchar(50) DEFAULT 'active',
  change_reason text,
  approved_by varchar(255),
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fac_hist_tenant ON facility_history_versions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fac_hist_facility ON facility_history_versions (tenant_id, facility_id);

CREATE TABLE IF NOT EXISTS community_history_versions (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_id integer REFERENCES entity_history_versions(id) ON DELETE CASCADE,
  village_id integer NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  name varchar(255) NOT NULL,
  code varchar(100),
  assigned_facility_id integer,
  district_id integer,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  catchment_polygon jsonb,
  is_hard_to_reach boolean DEFAULT false,
  terrain_difficulty integer,
  population_estimate integer,
  valid_from timestamp NOT NULL DEFAULT now(),
  valid_to timestamp,
  status varchar(50) DEFAULT 'active',
  change_reason text,
  approved_by varchar(255),
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_hist_tenant ON community_history_versions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comm_hist_village ON community_history_versions (tenant_id, village_id);

CREATE TABLE IF NOT EXISTS population_history_versions (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_id integer REFERENCES entity_history_versions(id) ON DELETE CASCADE,
  population_entity_id varchar(255) NOT NULL,
  geographic_unit_type varchar(50) NOT NULL,
  geographic_unit_id integer NOT NULL,
  source varchar(100) NOT NULL,
  source_year integer NOT NULL,
  dataset_version varchar(100),
  method varchar(100),
  total_population integer NOT NULL,
  target_infants integer,
  under_one integer,
  under_five integer,
  women_of_reproductive_age integer,
  confidence varchar(50),
  planning_status varchar(50) DEFAULT 'official',
  used_in_microplans jsonb DEFAULT '[]'::jsonb,
  valid_from timestamp NOT NULL DEFAULT now(),
  valid_to timestamp,
  status varchar(50) DEFAULT 'active',
  change_reason text,
  approved_by varchar(255),
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pop_hist_tenant ON population_history_versions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pop_hist_geo ON population_history_versions (tenant_id, geographic_unit_type, geographic_unit_id);

CREATE TABLE IF NOT EXISTS vaccine_schedule_history_versions (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_id integer REFERENCES entity_history_versions(id) ON DELETE CASCADE,
  schedule_id integer NOT NULL,
  antigen_code varchar(100) NOT NULL,
  dose_number integer NOT NULL,
  vaccine_product_id integer,
  doses_per_vial integer,
  wastage_rate_default numeric(5, 2),
  target_group varchar(100),
  recommended_age_months numeric(5, 2),
  minimum_interval_days integer,
  valid_from timestamp NOT NULL DEFAULT now(),
  valid_to timestamp,
  status varchar(50) DEFAULT 'active',
  change_reason text,
  approved_by varchar(255),
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vax_sched_hist_tenant ON vaccine_schedule_history_versions (tenant_id);

CREATE TABLE IF NOT EXISTS stock_reference_history_versions (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_id integer REFERENCES entity_history_versions(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  product_name varchar(255) NOT NULL,
  antigen_code varchar(100),
  vial_size integer,
  doses_per_vial integer,
  cold_chain_category varchar(100),
  storage_volume_cm3 numeric(10, 2),
  diluent_volume_cm3 numeric(10, 2),
  buffer_stock_factor numeric(5, 2),
  valid_from timestamp NOT NULL DEFAULT now(),
  valid_to timestamp,
  status varchar(50) DEFAULT 'active',
  change_reason text,
  approved_by varchar(255),
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_ref_hist_tenant ON stock_reference_history_versions (tenant_id);

CREATE TABLE IF NOT EXISTS report_entity_snapshots (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_type varchar(100) NOT NULL,
  report_id varchar(255) NOT NULL,
  entity_type varchar(100) NOT NULL,
  entity_id varchar(255) NOT NULL,
  version_id integer REFERENCES entity_history_versions(id) ON DELETE SET NULL,
  frozen_snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  as_of_date timestamp NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_entity_snaps_report ON report_entity_snapshots (tenant_id, report_type, report_id);
