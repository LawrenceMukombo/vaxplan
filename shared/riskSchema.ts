import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tenants, districts, provinces, users } from "./schema";

// ============================================================================
// 1. METHODOLOGY REGISTRY & VERSIONING
// ============================================================================

export const riskMethodologies = pgTable("risk_methodologies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(), // e.g. "who_measles"
  name: varchar("name", { length: 255 }).notNull(),
  disease: varchar("disease", { length: 100 }).notNull(), // "measles", "rubella", "polio", etc.
  description: text("description"),
  sourceOrg: varchar("source_org", { length: 255 }).default("WHO"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const riskMethodologyVersions = pgTable("risk_methodology_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  methodologyId: varchar("methodology_id").notNull().references(() => riskMethodologies.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 100 }).notNull(), // e.g. "WHO_MEASLES_GLOBAL_RECONCILED_V1"
  status: varchar("status", { length: 50 }).notNull().default("published"), // published, draft, retired
  rulesJson: jsonb("rules_json").notNull(),
  checksum: varchar("checksum", { length: 128 }).notNull(),
  effectiveDate: timestamp("effective_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  methodologyVersionIdx: uniqueIndex("idx_risk_meth_ver_unique").on(table.methodologyId, table.version),
}));

export const riskMethodologyProfiles = pgTable("risk_methodology_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  versionId: varchar("version_id").notNull().references(() => riskMethodologyVersions.id, { onDelete: "cascade" }),
  profileName: varchar("profile_name", { length: 255 }).notNull(),
  overridesJson: jsonb("overrides_json").notNull().default({}), // e.g. MCV1 schedule age, SIA exemption policy, etc.
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantProfileIdx: index("idx_risk_profile_tenant").on(table.tenantId),
}));

// ============================================================================
// 2. ASSESSMENT RUNS & LIFECYCLE
// ============================================================================

export const riskAssessments = pgTable("risk_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  methodologyVersionId: varchar("methodology_version_id").notNull().references(() => riskMethodologyVersions.id),
  profileId: varchar("profile_id").references(() => riskMethodologyProfiles.id, { onDelete: "set null" }),
  assessmentYear: integer("assessment_year").notNull(), // e.g. 2023
  baselineYears: jsonb("baseline_years").notNull().default([2020, 2021, 2022]),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, importing, validation_required, ready_to_calculate, calculating, calculated, under_review, approved, superseded
  activeRunId: varchar("active_run_id"),
  notes: text("notes"),
  reportConfigJson: jsonb("report_config_json").default({}),
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedByUserId: varchar("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantAssessmentIdx: index("idx_risk_assessment_tenant").on(table.tenantId),
}));

export const riskAssessmentRuns = pgTable("risk_assessment_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  runNumber: integer("run_number").notNull().default(1),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  calculatedByUserId: varchar("calculated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  isOfficial: boolean("is_official").notNull().default(false),
  inputChecksum: varchar("input_checksum", { length: 128 }),
  summaryStats: jsonb("summary_stats").notNull().default({}),
  executionLog: text("execution_log"),
}, (table) => ({
  assessmentRunIdx: index("idx_risk_run_assessment").on(table.assessmentId),
  tenantRunIdx: index("idx_risk_run_tenant").on(table.tenantId),
}));

// ============================================================================
// 3. GRANULAR ASSESSMENT RESULTS & EXPLANATIONS
// ============================================================================

export const riskAreaResults = pgTable("risk_area_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => riskAssessmentRuns.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  districtId: integer("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  provinceId: integer("province_id").references(() => provinces.id, { onDelete: "set null" }),
  totalScore: decimal("total_score", { precision: 5, scale: 2 }),
  riskCategory: varchar("risk_category", { length: 50 }).notNull(), // LOW, MEDIUM, HIGH, VERY_HIGH, INCOMPLETE
  completenessRate: decimal("completeness_rate", { precision: 5, scale: 2 }).notNull().default("100.00"),
  population: decimal("population", { precision: 12, scale: 2 }),
  areaKm2: decimal("area_km2", { precision: 12, scale: 2 }),
  populationDensity: decimal("population_density", { precision: 12, scale: 2 }),
  domainScoresJson: jsonb("domain_scores_json").notNull().default({}),
  summaryExplanation: text("summary_explanation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  runDistrictIdx: uniqueIndex("idx_risk_area_run_district").on(table.runId, table.districtId),
  tenantAreaIdx: index("idx_risk_area_tenant").on(table.tenantId),
}));

export const riskDomainResults = pgTable("risk_domain_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => riskAssessmentRuns.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  districtId: integer("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  domainCode: varchar("domain_code", { length: 50 }).notNull(), // PI, SQ, PDP, TA
  domainScore: decimal("domain_score", { precision: 5, scale: 2 }).notNull(),
  maxScore: decimal("max_score", { precision: 5, scale: 2 }).notNull(),
  domainRiskCategory: varchar("domain_risk_category", { length: 50 }),
}, (table) => ({
  runDistrictDomainIdx: uniqueIndex("idx_risk_domain_run_dist_code").on(table.runId, table.districtId, table.domainCode),
}));

export const riskIndicatorResults = pgTable("risk_indicator_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => riskAssessmentRuns.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  districtId: integer("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  domainCode: varchar("domain_code", { length: 50 }).notNull(),
  indicatorCode: varchar("indicator_code", { length: 50 }).notNull(), // PI1, PI2... TA6
  valueRaw: text("value_raw"),
  valueAnalytical: decimal("value_analytical", { precision: 12, scale: 4 }),
  numerator: decimal("numerator", { precision: 12, scale: 4 }),
  denominator: decimal("denominator", { precision: 12, scale: 4 }),
  pointsAwarded: decimal("points_awarded", { precision: 5, scale: 2 }).notNull(),
  maxPoints: decimal("max_points", { precision: 5, scale: 2 }).notNull(),
  thresholdApplied: text("threshold_applied"),
  formulaUsed: text("formula_used"),
  valueState: varchar("value_state", { length: 50 }).notNull().default("OBSERVED"), // OBSERVED, VERIFIED_ZERO, MISSING, INVALID, NOT_INTRODUCED, NOT_APPLICABLE, POLICY_ASSIGNED
  explanation: text("explanation").notNull(),
  neighboursBreakdownJson: jsonb("neighbours_breakdown_json"),
}, (table) => ({
  runDistrictIndicatorIdx: uniqueIndex("idx_risk_indicator_run_dist_code").on(table.runId, table.districtId, table.indicatorCode),
}));

// ============================================================================
// 4. SURVEILLANCE CASE LINE-LIST (STANDARDIZED & DEDUPLICATED)
// ============================================================================

export const riskCaseRaw = pgTable("risk_case_raw", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId: varchar("assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  sourceRowIndex: integer("source_row_index"),
  caseId: varchar("case_id", { length: 255 }),
  year: integer("year").notNull(),
  provinceName: varchar("province_name", { length: 255 }),
  districtName: varchar("district_name", { length: 255 }),
  districtId: integer("district_id").references(() => districts.id, { onDelete: "set null" }),
  finalClassification: varchar("final_classification", { length: 100 }).notNull(), // LAB_CONFIRMED_MEASLES, EPI_LINKED_MEASLES, CLINICALLY_COMPATIBLE_MEASLES, DISCARDED_NON_MEASLES, CONFIRMED_RUBELLA, PENDING, UNCLASSIFIED
  sourceClassification: varchar("source_classification", { length: 255 }),
  ageYears: decimal("age_years", { precision: 5, scale: 2 }),
  ageMonths: integer("age_months"),
  sex: varchar("sex", { length: 10 }),
  placeOfResidence: varchar("place_of_residence", { length: 255 }),
  rashOnsetDate: timestamp("rash_onset_date"),
  notificationDate: timestamp("notification_date"),
  investigationDate: timestamp("investigation_date"),
  bloodSpecimenDate: timestamp("blood_specimen_date"),
  labResultDate: timestamp("lab_result_date"),
  vaccinationStatus: varchar("vaccination_status", { length: 50 }), // VACCINATED, UNVACCINATED, UNKNOWN, CONFLICTING
  dosesCount: integer("doses_count"),
  isAdequateInvestigation: boolean("is_adequate_investigation").notNull().default(false),
  isAdequateSpecimen: boolean("is_adequate_specimen").notNull().default(false),
  isTimelyLabResult: boolean("is_timely_lab_result").notNull().default(false),
  isQualifyingMeaslesThreat: boolean("is_qualifying_measles_threat").notNull().default(false),
  isEpiLinked: boolean("is_epi_linked").notNull().default(false),
  isDiscarded: boolean("is_discarded").notNull().default(false),
  validationFlags: jsonb("validation_flags").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  assessmentCaseIdx: index("idx_risk_case_assessment").on(table.assessmentId),
  tenantCaseIdx: index("idx_risk_case_tenant").on(table.tenantId),
  districtYearIdx: index("idx_risk_case_district_year").on(table.districtId, table.year),
}));

// ============================================================================
// 5. TOPOLOGY / ADJACENCY GRAPH
// ============================================================================

export const riskAreaEdges = pgTable("risk_area_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  districtIdA: integer("district_id_a").notNull().references(() => districts.id, { onDelete: "cascade" }),
  districtIdB: integer("district_id_b").notNull().references(() => districts.id, { onDelete: "cascade" }),
  edgeType: varchar("edge_type", { length: 50 }).notNull().default("land_border"), // land_border, island_link, transport_corridor, cross_border
  isApproved: boolean("is_approved").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  edgeUniqueIdx: uniqueIndex("idx_risk_area_edge_unique").on(table.tenantId, table.districtIdA, table.districtIdB),
  tenantEdgeIdx: index("idx_risk_edge_tenant").on(table.tenantId),
}));

// ============================================================================
// 6. VULNERABLE POPULATION RESPONSES (8 FACTORS)
// ============================================================================

export const riskVulnerabilityResponses = pgTable("risk_vulnerability_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId: varchar("assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  districtId: integer("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  factorKey: varchar("factor_key", { length: 100 }).notNull(),
  isPresent: boolean("is_present").notNull().default(false),
  evidenceText: text("evidence_text"),
  reviewerNotes: text("reviewer_notes"),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  assessmentDistrictFactorIdx: uniqueIndex("idx_risk_vuln_unique").on(table.assessmentId, table.districtId, table.factorKey),
}));

// ============================================================================
// 7. ACTION LINKS (CONNECTING GAPS TO ROUTINE MICROPLANS & SUPERVISION)
// ============================================================================

export const riskActionLinks = pgTable("risk_action_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId: varchar("assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  areaResultId: varchar("area_result_id").references(() => riskAreaResults.id, { onDelete: "cascade" }),
  districtId: integer("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  indicatorCode: varchar("indicator_code", { length: 50 }),
  actionTitle: varchar("action_title", { length: 255 }).notNull(),
  actionDescription: text("action_description").notNull(),
  linkedModule: varchar("linked_module", { length: 50 }).notNull(), // microplan, supervision, budget, surveillance
  linkedEntityId: varchar("linked_entity_id", { length: 255 }),
  responsiblePerson: varchar("responsible_person", { length: 255 }),
  targetCompletionDate: timestamp("target_completion_date"),
  budgetEstimateUsd: decimal("budget_estimate_usd", { precision: 12, scale: 2 }),
  createdByUserId: varchar("created_by_user_id"),
  status: varchar("status", { length: 50 }).notNull().default("open"), // open, in_progress, completed, deferred
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  assessmentActionIdx: index("idx_risk_action_assessment").on(table.assessmentId),
  tenantActionIdx: index("idx_risk_action_tenant").on(table.tenantId),
}));

// ============================================================================
// 8. DIRECT DISTRICT DATA ENTRY (MATCHING WHO EXCEL TEMPLATE)
// ============================================================================

export const riskDistrictDataEntry = pgTable("risk_district_data_entry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId: varchar("assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  districtId: integer("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  provinceId: integer("province_id").references(() => provinces.id, { onDelete: "set null" }),
  population: decimal("population", { precision: 12, scale: 2 }).default("100000"),
  areaKm2: decimal("area_km2", { precision: 12, scale: 2 }).default("2500"),
  mcv1YearMinus3: decimal("mcv1_year_minus3", { precision: 5, scale: 2 }).default("80.00"),
  mcv1YearMinus2: decimal("mcv1_year_minus2", { precision: 5, scale: 2 }).default("82.00"),
  mcv1YearMinus1: decimal("mcv1_year_minus1", { precision: 5, scale: 2 }).default("85.00"),
  mcv2YearMinus3: decimal("mcv2_year_minus3", { precision: 5, scale: 2 }).default("70.00"),
  mcv2YearMinus2: decimal("mcv2_year_minus2", { precision: 5, scale: 2 }).default("72.00"),
  mcv2YearMinus1: decimal("mcv2_year_minus1", { precision: 5, scale: 2 }).default("75.00"),
  penta1YearMinus1: decimal("penta1_year_minus1", { precision: 5, scale: 2 }).default("90.00"),
  siaCoveragePct: decimal("sia_coverage_pct", { precision: 5, scale: 2 }).default("92.00"),
  siaTargetAgeGroup: varchar("sia_target_age_group", { length: 20 }).default("WIDE"),
  siaYearsSince: integer("sia_years_since").default(2),
  unvaccinatedCasesPct: decimal("unvaccinated_cases_pct", { precision: 5, scale: 2 }).default("15.00"),
  suspectedCases: integer("suspected_cases").default(12),
  discardedCases: integer("discarded_cases").default(3),
  adequateInvestigationPct: decimal("adequate_investigation_pct", { precision: 5, scale: 2 }).default("85.00"),
  adequateSpecimenPct: decimal("adequate_specimen_pct", { precision: 5, scale: 2 }).default("85.00"),
  timelyLabResultsPct: decimal("timely_lab_results_pct", { precision: 5, scale: 2 }).default("85.00"),
  threatCasesUnder5: integer("threat_cases_under5").default(0),
  threatCases5To14: integer("threat_cases_5_to_14").default(0),
  threatCases15Plus: integer("threat_cases_15_plus").default(0),
  borderCaseInPastYear: boolean("border_case_in_past_year").default(false),
  vulnerabilities: jsonb("vulnerabilities").default({
    migrantOrUnderserved: false,
    vaccineHesitancyOrRefusal: false,
    securityOrConflictConcerns: false,
    recurrentNaturalDisasters: false,
    poorAccessOrTerrain: false,
    inadequatePoliticalSupport: false,
    highTransitHubOrBorder: false,
    massGatheringsOrEvents: false,
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  assessmentDistrictEntryIdx: uniqueIndex("idx_risk_dist_entry_unique").on(table.assessmentId, table.districtId),
  tenantDistEntryIdx: index("idx_risk_dist_entry_tenant").on(table.tenantId),
  assessmentEntryIdx: index("idx_risk_dist_entry_assessment").on(table.assessmentId),
}));

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

export const insertRiskMethodologySchema = createInsertSchema(riskMethodologies);
export const selectRiskMethodologySchema = createSelectSchema(riskMethodologies);
export type RiskMethodology = typeof riskMethodologies.$inferSelect;
export type InsertRiskMethodology = typeof riskMethodologies.$inferInsert;

export const insertRiskMethodologyVersionSchema = createInsertSchema(riskMethodologyVersions);
export const selectRiskMethodologyVersionSchema = createSelectSchema(riskMethodologyVersions);
export type RiskMethodologyVersion = typeof riskMethodologyVersions.$inferSelect;
export type InsertRiskMethodologyVersion = typeof riskMethodologyVersions.$inferInsert;

export const insertRiskMethodologyProfileSchema = createInsertSchema(riskMethodologyProfiles);
export const selectRiskMethodologyProfileSchema = createSelectSchema(riskMethodologyProfiles);
export type RiskMethodologyProfile = typeof riskMethodologyProfiles.$inferSelect;
export type InsertRiskMethodologyProfile = typeof riskMethodologyProfiles.$inferInsert;

export const insertRiskAssessmentSchema = createInsertSchema(riskAssessments);
export const selectRiskAssessmentSchema = createSelectSchema(riskAssessments);
export type RiskAssessment = typeof riskAssessments.$inferSelect;
export type InsertRiskAssessment = typeof riskAssessments.$inferInsert;

export const insertRiskAssessmentRunSchema = createInsertSchema(riskAssessmentRuns);
export const selectRiskAssessmentRunSchema = createSelectSchema(riskAssessmentRuns);
export type RiskAssessmentRun = typeof riskAssessmentRuns.$inferSelect;
export type InsertRiskAssessmentRun = typeof riskAssessmentRuns.$inferInsert;

export const insertRiskAreaResultSchema = createInsertSchema(riskAreaResults);
export const selectRiskAreaResultSchema = createSelectSchema(riskAreaResults);
export type RiskAreaResult = typeof riskAreaResults.$inferSelect;
export type InsertRiskAreaResult = typeof riskAreaResults.$inferInsert;

export const insertRiskDomainResultSchema = createInsertSchema(riskDomainResults);
export const selectRiskDomainResultSchema = createSelectSchema(riskDomainResults);
export type RiskDomainResult = typeof riskDomainResults.$inferSelect;
export type InsertRiskDomainResult = typeof riskDomainResults.$inferInsert;

export const insertRiskIndicatorResultSchema = createInsertSchema(riskIndicatorResults);
export const selectRiskIndicatorResultSchema = createSelectSchema(riskIndicatorResults);
export type RiskIndicatorResult = typeof riskIndicatorResults.$inferSelect;
export type InsertRiskIndicatorResult = typeof riskIndicatorResults.$inferInsert;

export const insertRiskCaseRawSchema = createInsertSchema(riskCaseRaw);
export const selectRiskCaseRawSchema = createSelectSchema(riskCaseRaw);
export type RiskCaseRaw = typeof riskCaseRaw.$inferSelect;
export type InsertRiskCaseRaw = typeof riskCaseRaw.$inferInsert;

export const insertRiskAreaEdgeSchema = createInsertSchema(riskAreaEdges);
export const selectRiskAreaEdgeSchema = createSelectSchema(riskAreaEdges);
export type RiskAreaEdge = typeof riskAreaEdges.$inferSelect;
export type InsertRiskAreaEdge = typeof riskAreaEdges.$inferInsert;

export const insertRiskVulnerabilityResponseSchema = createInsertSchema(riskVulnerabilityResponses);
export const selectRiskVulnerabilityResponseSchema = createSelectSchema(riskVulnerabilityResponses);
export type RiskVulnerabilityResponse = typeof riskVulnerabilityResponses.$inferSelect;
export type InsertRiskVulnerabilityResponse = typeof riskVulnerabilityResponses.$inferInsert;

export const insertRiskActionLinkSchema = createInsertSchema(riskActionLinks);
export const selectRiskActionLinkSchema = createSelectSchema(riskActionLinks);
export type RiskActionLink = typeof riskActionLinks.$inferSelect;
export type InsertRiskActionLink = typeof riskActionLinks.$inferInsert;

export const insertRiskDistrictDataEntrySchema = createInsertSchema(riskDistrictDataEntry);
export const selectRiskDistrictDataEntrySchema = createSelectSchema(riskDistrictDataEntry);
export type RiskDistrictDataEntry = typeof riskDistrictDataEntry.$inferSelect;
export type InsertRiskDistrictDataEntry = typeof riskDistrictDataEntry.$inferInsert;


