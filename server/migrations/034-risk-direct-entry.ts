/**
 * Migration 034 — risk_direct_entry
 * 
 * Safely creates the risk_district_data_entry table to support direct tabular
 * data entry mirroring the WHO Excel Risk Assessment Tool sheets:
 * - Population Immunity
 * - Surveillance Quality
 * - Program Delivery Performance
 * - Vulnerable Groups & Threat Assessment
 * 
 * Non-destructive and idempotent: uses IF NOT EXISTS and ON CONFLICT.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function applyRiskDirectEntrySchema(db: NodePgDatabase<any>): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_district_data_entry (
      id                          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id                   VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      assessment_id               VARCHAR NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
      district_id                 INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      province_id                 INTEGER REFERENCES provinces(id) ON DELETE SET NULL,
      population                  NUMERIC(12, 2) DEFAULT 100000,
      area_km2                    NUMERIC(12, 2) DEFAULT 2500,
      mcv1_year_minus3            NUMERIC(5, 2) DEFAULT 80.00,
      mcv1_year_minus2            NUMERIC(5, 2) DEFAULT 82.00,
      mcv1_year_minus1            NUMERIC(5, 2) DEFAULT 85.00,
      mcv2_year_minus3            NUMERIC(5, 2) DEFAULT 70.00,
      mcv2_year_minus2            NUMERIC(5, 2) DEFAULT 72.00,
      mcv2_year_minus1            NUMERIC(5, 2) DEFAULT 75.00,
      penta1_year_minus1          NUMERIC(5, 2) DEFAULT 90.00,
      sia_coverage_pct            NUMERIC(5, 2) DEFAULT 92.00,
      sia_target_age_group        VARCHAR(20) DEFAULT 'WIDE',
      sia_years_since             INTEGER DEFAULT 2,
      unvaccinated_cases_pct      NUMERIC(5, 2) DEFAULT 15.00,
      suspected_cases             INTEGER DEFAULT 12,
      discarded_cases             INTEGER DEFAULT 3,
      adequate_investigation_pct  NUMERIC(5, 2) DEFAULT 85.00,
      adequate_specimen_pct       NUMERIC(5, 2) DEFAULT 85.00,
      timely_lab_results_pct      NUMERIC(5, 2) DEFAULT 85.00,
      threat_cases_under5         INTEGER DEFAULT 0,
      threat_cases_5_to_14        INTEGER DEFAULT 0,
      threat_cases_15_plus        INTEGER DEFAULT 0,
      border_case_in_past_year    BOOLEAN DEFAULT FALSE,
      vulnerabilities             JSONB DEFAULT '{"migrantOrUnderserved":false,"vaccineHesitancyOrRefusal":false,"securityOrConflictConcerns":false,"recurrentNaturalDisasters":false,"poorAccessOrTerrain":false,"inadequatePoliticalSupport":false,"highTransitHubOrBorder":false,"massGatheringsOrEvents":false}'::jsonb,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT idx_risk_dist_entry_unique UNIQUE(assessment_id, district_id)
    );
    CREATE INDEX IF NOT EXISTS idx_risk_dist_entry_tenant ON risk_district_data_entry(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_risk_dist_entry_assessment ON risk_district_data_entry(assessment_id);
  `);
}
