/**
 * Migration 032 — risk_assessment_schema
 * 
 * Safely creates all tables for the VPD Programmatic Risk Assessment Engine:
 * - risk_methodologies
 * - risk_methodology_versions
 * - risk_methodology_profiles
 * - risk_assessments
 * - risk_assessment_runs
 * - risk_area_results
 * - risk_domain_results
 * - risk_indicator_results
 * - risk_case_raw
 * - risk_area_edges
 * - risk_vulnerability_responses
 * - risk_action_links
 * 
 * Safe to re-run: uses IF NOT EXISTS and ON CONFLICT DO NOTHING.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { WHO_MEASLES_GLOBAL_RECONCILED_V1 } from "../services/risk/methodologyRegistry";

export async function applyRiskAssessmentSchema(db: NodePgDatabase<any>): Promise<void> {
  // 1. Create Tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_methodologies (
      id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      key                  VARCHAR(100) NOT NULL UNIQUE,
      name                 VARCHAR(255) NOT NULL,
      disease              VARCHAR(100) NOT NULL,
      description          TEXT,
      source_org           VARCHAR(255) DEFAULT 'WHO',
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_methodology_versions (
      id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      methodology_id       VARCHAR NOT NULL REFERENCES risk_methodologies(id) ON DELETE CASCADE,
      version              VARCHAR(100) NOT NULL,
      status               VARCHAR(50) NOT NULL DEFAULT 'published',
      rules_json           JSONB NOT NULL,
      checksum             VARCHAR(128) NOT NULL,
      effective_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT idx_risk_meth_ver_unique UNIQUE(methodology_id, version)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_methodology_profiles (
      id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id            VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      version_id           VARCHAR NOT NULL REFERENCES risk_methodology_versions(id) ON DELETE CASCADE,
      profile_name         VARCHAR(255) NOT NULL,
      overrides_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
      approved_by          VARCHAR(255),
      approved_at          TIMESTAMPTZ,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_risk_profile_tenant ON risk_methodology_profiles(tenant_id);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_assessments (
      id                      VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id               VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title                   VARCHAR(255) NOT NULL,
      methodology_version_id  VARCHAR NOT NULL REFERENCES risk_methodology_versions(id),
      profile_id              VARCHAR REFERENCES risk_methodology_profiles(id) ON DELETE SET NULL,
      assessment_year         INTEGER NOT NULL,
      baseline_years          JSONB NOT NULL DEFAULT '[2020, 2021, 2022]'::jsonb,
      status                  VARCHAR(50) NOT NULL DEFAULT 'draft',
      active_run_id           VARCHAR,
      notes                   TEXT,
      created_by_user_id      VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      approved_by_user_id     VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      approved_at             TIMESTAMPTZ,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_risk_assessment_tenant ON risk_assessments(tenant_id);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_assessment_runs (
      id                      VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id           VARCHAR NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
      tenant_id               VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      run_number              INTEGER NOT NULL DEFAULT 1,
      calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      calculated_by_user_id   VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      is_official             BOOLEAN NOT NULL DEFAULT FALSE,
      input_checksum          VARCHAR(128),
      summary_stats           JSONB NOT NULL DEFAULT '{}'::jsonb,
      execution_log           TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_risk_run_assessment ON risk_assessment_runs(assessment_id);
    CREATE INDEX IF NOT EXISTS idx_risk_run_tenant ON risk_assessment_runs(tenant_id);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_area_results (
      id                      VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id                  VARCHAR NOT NULL REFERENCES risk_assessment_runs(id) ON DELETE CASCADE,
      tenant_id               VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      district_id             INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      province_id             INTEGER REFERENCES provinces(id) ON DELETE SET NULL,
      total_score             NUMERIC(5, 2),
      risk_category           VARCHAR(50) NOT NULL,
      completeness_rate       NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
      population              NUMERIC(12, 2),
      area_km2                NUMERIC(12, 2),
      population_density      NUMERIC(12, 2),
      domain_scores_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
      summary_explanation     TEXT,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT idx_risk_area_run_district UNIQUE(run_id, district_id)
    );
    CREATE INDEX IF NOT EXISTS idx_risk_area_tenant ON risk_area_results(tenant_id);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_domain_results (
      id                      VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id                  VARCHAR NOT NULL REFERENCES risk_assessment_runs(id) ON DELETE CASCADE,
      tenant_id               VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      district_id             INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      domain_code             VARCHAR(50) NOT NULL,
      domain_score            NUMERIC(5, 2) NOT NULL,
      max_score               NUMERIC(5, 2) NOT NULL,
      domain_risk_category    VARCHAR(50),
      CONSTRAINT idx_risk_domain_run_dist_code UNIQUE(run_id, district_id, domain_code)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_indicator_results (
      id                      VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id                  VARCHAR NOT NULL REFERENCES risk_assessment_runs(id) ON DELETE CASCADE,
      tenant_id               VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      district_id             INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      domain_code             VARCHAR(50) NOT NULL,
      indicator_code          VARCHAR(50) NOT NULL,
      value_raw               TEXT,
      value_analytical        NUMERIC(12, 4),
      numerator               NUMERIC(12, 4),
      denominator             NUMERIC(12, 4),
      points_awarded          NUMERIC(5, 2) NOT NULL,
      max_points              NUMERIC(5, 2) NOT NULL,
      threshold_applied       TEXT,
      formula_used            TEXT,
      value_state             VARCHAR(50) NOT NULL DEFAULT 'OBSERVED',
      explanation             TEXT NOT NULL,
      neighbours_breakdown_json JSONB,
      CONSTRAINT idx_risk_indicator_run_dist_code UNIQUE(run_id, district_id, indicator_code)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_case_raw (
      id                          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id                   VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      assessment_id               VARCHAR NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
      source_row_index            INTEGER,
      case_id                     VARCHAR(255),
      year                        INTEGER NOT NULL,
      province_name               VARCHAR(255),
      district_name               VARCHAR(255),
      district_id                 INTEGER REFERENCES districts(id) ON DELETE SET NULL,
      final_classification        VARCHAR(100) NOT NULL,
      source_classification       VARCHAR(255),
      age_years                   NUMERIC(5, 2),
      age_months                  INTEGER,
      sex                         VARCHAR(10),
      place_of_residence          VARCHAR(255),
      rash_onset_date             TIMESTAMPTZ,
      notification_date           TIMESTAMPTZ,
      investigation_date          TIMESTAMPTZ,
      blood_specimen_date         TIMESTAMPTZ,
      lab_result_date             TIMESTAMPTZ,
      vaccination_status          VARCHAR(50),
      doses_count                 INTEGER,
      is_adequate_investigation   BOOLEAN NOT NULL DEFAULT FALSE,
      is_adequate_specimen        BOOLEAN NOT NULL DEFAULT FALSE,
      is_timely_lab_result        BOOLEAN NOT NULL DEFAULT FALSE,
      is_qualifying_measles_threat BOOLEAN NOT NULL DEFAULT FALSE,
      is_epi_linked               BOOLEAN NOT NULL DEFAULT FALSE,
      is_discarded                BOOLEAN NOT NULL DEFAULT FALSE,
      validation_flags            JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_risk_case_assessment ON risk_case_raw(assessment_id);
    CREATE INDEX IF NOT EXISTS idx_risk_case_tenant ON risk_case_raw(tenant_id);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_area_edges (
      id                          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id                   VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      district_id_a               INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      district_id_b               INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      edge_type                   VARCHAR(50) NOT NULL DEFAULT 'land_border',
      is_approved                 BOOLEAN NOT NULL DEFAULT TRUE,
      notes                       TEXT,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT idx_risk_area_edge_unique UNIQUE(tenant_id, district_id_a, district_id_b)
    );
    CREATE INDEX IF NOT EXISTS idx_risk_edge_tenant ON risk_area_edges(tenant_id);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_vulnerability_responses (
      id                          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id                   VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      assessment_id               VARCHAR NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
      district_id                 INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      factor_key                  VARCHAR(100) NOT NULL,
      is_present                  BOOLEAN NOT NULL DEFAULT FALSE,
      evidence_text               TEXT,
      reviewer_notes              TEXT,
      updated_by_user_id          VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT idx_risk_vuln_unique UNIQUE(assessment_id, district_id, factor_key)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_action_links (
      id                          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id                   VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      assessment_id               VARCHAR NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
      area_result_id              VARCHAR REFERENCES risk_area_results(id) ON DELETE CASCADE,
      district_id                 INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      indicator_code              VARCHAR(50),
      action_title                VARCHAR(255) NOT NULL,
      action_description          TEXT NOT NULL,
      linked_module               VARCHAR(50) NOT NULL,
      linked_entity_id            VARCHAR(255),
      responsible_person          VARCHAR(255),
      target_completion_date      TIMESTAMPTZ,
      status                      VARCHAR(50) NOT NULL DEFAULT 'PROPOSED',
      budget_estimate_usd         NUMERIC(12, 2),
      created_by_user_id          VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 2. Safe Seed: WHO Reconciled Methodology Package
  const methId = "who_measles";
  await db.execute(sql`
    INSERT INTO risk_methodologies (id, key, name, disease, description, source_org)
    VALUES (
      ${methId},
      'who_measles',
      ${WHO_MEASLES_GLOBAL_RECONCILED_V1.name},
      'measles',
      'Standardized subnational measles programmatic risk assessment tool with 21 indicators across 4 domains (Population Immunity, Surveillance Quality, Programme Delivery, Threat Assessment).',
      'World Health Organization (WHO)'
    )
    ON CONFLICT (key) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description;
  `);

  const verId = WHO_MEASLES_GLOBAL_RECONCILED_V1.code; // "WHO_MEASLES_GLOBAL_RECONCILED_V1"
  await db.execute(sql`
    INSERT INTO risk_methodology_versions (id, methodology_id, version, status, rules_json, checksum)
    VALUES (
      ${verId},
      ${methId},
      '1.0.0',
      'published',
      ${JSON.stringify(WHO_MEASLES_GLOBAL_RECONCILED_V1)}::jsonb,
      'who-measles-v1-reconciled-sha256'
    )
    ON CONFLICT (id) DO NOTHING;
  `);
}
