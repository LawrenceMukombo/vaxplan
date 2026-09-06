"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/db.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = __toESM(require("pg"), 1);

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  DEFAULT_STOCK_ALERT_DIGEST: () => DEFAULT_STOCK_ALERT_DIGEST,
  FACILITY_AUTHOR_ROLES: () => FACILITY_AUTHOR_ROLES,
  SELF_SIGNUP_ROLES: () => SELF_SIGNUP_ROLES,
  adminBoundaries: () => adminBoundaries,
  adminBoundariesRelations: () => adminBoundariesRelations,
  annualImmunizationPlans: () => annualImmunizationPlans,
  approvalRequests: () => approvalRequests,
  approvalStatusEnum: () => approvalStatusEnum,
  auditLogs: () => auditLogs,
  boundarySourceEnum: () => boundarySourceEnum,
  budgetItems: () => budgetItems,
  candidateUnmappedSettlements: () => candidateUnmappedSettlements,
  candidateUnmappedSettlementsRelations: () => candidateUnmappedSettlementsRelations,
  caseClassificationEnum: () => caseClassificationEnum,
  catalogueCommodities: () => catalogueCommodities,
  catalogueScheduleDoses: () => catalogueScheduleDoses,
  catalogueVaccines: () => catalogueVaccines,
  catalogueWastageThresholds: () => catalogueWastageThresholds,
  catchmentConflicts: () => catchmentConflicts,
  chvProfiles: () => chvProfiles,
  clientBulkActionLogs: () => clientBulkActionLogs,
  clientDuplicateCandidates: () => clientDuplicateCandidates,
  clientImportBatches: () => clientImportBatches,
  clientVaccinations: () => clientVaccinations,
  clientVaccinationsRelations: () => clientVaccinationsRelations,
  clients: () => clients,
  clientsRelations: () => clientsRelations,
  coldChainEquipment: () => coldChainEquipment,
  coldChainEquipmentRelations: () => coldChainEquipmentRelations,
  commodityTypeEnum: () => commodityTypeEnum,
  communicationChannels: () => communicationChannels,
  communicationLogs: () => communicationLogs,
  communications: () => communications,
  communityHealthVolunteers: () => communityHealthVolunteers,
  communityHealthVolunteersRelations: () => communityHealthVolunteersRelations,
  communityHistoryVersions: () => communityHistoryVersions,
  coverageCsvRowSchema: () => coverageCsvRowSchema,
  csvImports: () => csvImports,
  customLayerCategoryEnum: () => customLayerCategoryEnum,
  customLayerFormatEnum: () => customLayerFormatEnum,
  customLayerTypeEnum: () => customLayerTypeEnum,
  customLayers: () => customLayers,
  customLayersRelations: () => customLayersRelations,
  deliveryLogs: () => deliveryLogs,
  deviceTokens: () => deviceTokens,
  districts: () => districts,
  districtsRelations: () => districtsRelations,
  doseClassificationEnum: () => doseClassificationEnum,
  downloadAssets: () => downloadAssets,
  downloadAssetsRelations: () => downloadAssetsRelations,
  entityHistoryVersions: () => entityHistoryVersions,
  facilities: () => facilities,
  facilitiesRelations: () => facilitiesRelations,
  facilityCatchments: () => facilityCatchments,
  facilityCatchmentsRelations: () => facilityCatchmentsRelations,
  facilityExcludedVillages: () => facilityExcludedVillages,
  facilityHistoryVersions: () => facilityHistoryVersions,
  facilityStaff: () => facilityStaff,
  facilityStaffRelations: () => facilityStaffRelations,
  fundingSourceEnum: () => fundingSourceEnum,
  gisPolygonTypeEnum: () => gisPolygonTypeEnum,
  gisPolygons: () => gisPolygons,
  gisPolygonsRelations: () => gisPolygonsRelations,
  hfcCommittee: () => hfcCommittee,
  hfcCommitteeMembers: () => hfcCommitteeMembers,
  hfcCommitteeRelations: () => hfcCommitteeRelations,
  htrScores: () => htrScores,
  idpProtocolEnum: () => idpProtocolEnum,
  implementationLessons: () => implementationLessons,
  implementationLessonsRelations: () => implementationLessonsRelations,
  importedCoverage: () => importedCoverage,
  indicatorManual: () => indicatorManual,
  insertAdminBoundarySchema: () => insertAdminBoundarySchema,
  insertAnnualImmunizationPlanSchema: () => insertAnnualImmunizationPlanSchema,
  insertApprovalRequestSchema: () => insertApprovalRequestSchema,
  insertBudgetItemSchema: () => insertBudgetItemSchema,
  insertCandidateUnmappedSettlementSchema: () => insertCandidateUnmappedSettlementSchema,
  insertCatalogueCommoditySchema: () => insertCatalogueCommoditySchema,
  insertCatalogueScheduleDoseSchema: () => insertCatalogueScheduleDoseSchema,
  insertCatalogueVaccineSchema: () => insertCatalogueVaccineSchema,
  insertCatalogueWastageThresholdSchema: () => insertCatalogueWastageThresholdSchema,
  insertCatchmentConflictSchema: () => insertCatchmentConflictSchema,
  insertChvProfileSchema: () => insertChvProfileSchema,
  insertClientImportBatchSchema: () => insertClientImportBatchSchema,
  insertClientSchema: () => insertClientSchema,
  insertClientVaccinationSchema: () => insertClientVaccinationSchema,
  insertColdChainEquipmentSchema: () => insertColdChainEquipmentSchema,
  insertCommunityHealthVolunteerSchema: () => insertCommunityHealthVolunteerSchema,
  insertCommunityHistoryVersionSchema: () => insertCommunityHistoryVersionSchema,
  insertCsvImportSchema: () => insertCsvImportSchema,
  insertCustomLayerSchema: () => insertCustomLayerSchema,
  insertDistrictSchema: () => insertDistrictSchema,
  insertDownloadAssetSchema: () => insertDownloadAssetSchema,
  insertEntityHistoryVersionSchema: () => insertEntityHistoryVersionSchema,
  insertFacilityCatchmentSchema: () => insertFacilityCatchmentSchema,
  insertFacilityHistoryVersionSchema: () => insertFacilityHistoryVersionSchema,
  insertFacilitySchema: () => insertFacilitySchema,
  insertFacilityStaffSchema: () => insertFacilityStaffSchema,
  insertGisPolygonSchema: () => insertGisPolygonSchema,
  insertHfcCommitteeMemberSchema: () => insertHfcCommitteeMemberSchema,
  insertHfcCommitteeSchema: () => insertHfcCommitteeSchema,
  insertImplementationLessonSchema: () => insertImplementationLessonSchema,
  insertImportedCoverageSchema: () => insertImportedCoverageSchema,
  insertIndicatorManualSchema: () => insertIndicatorManualSchema,
  insertLabSampleSchema: () => insertLabSampleSchema,
  insertLlgSchema: () => insertLlgSchema,
  insertMicroplanSchema: () => insertMicroplanSchema,
  insertMobilizationActivitySchema: () => insertMobilizationActivitySchema,
  insertMonthlyReportSchema: () => insertMonthlyReportSchema,
  insertPilotActivitySchema: () => insertPilotActivitySchema,
  insertPilotUpdateSchema: () => insertPilotUpdateSchema,
  insertPopulationDataSchema: () => insertPopulationDataSchema,
  insertPopulationGridSchema: () => insertPopulationGridSchema,
  insertPopulationHistoryVersionSchema: () => insertPopulationHistoryVersionSchema,
  insertProvinceSchema: () => insertProvinceSchema,
  insertQuarterlyReviewSchema: () => insertQuarterlyReviewSchema,
  insertRegionSchema: () => insertRegionSchema,
  insertReportEntitySnapshotSchema: () => insertReportEntitySnapshotSchema,
  insertResearchDocumentSchema: () => insertResearchDocumentSchema,
  insertResearchInterestSubmissionSchema: () => insertResearchInterestSubmissionSchema,
  insertRiskActionLinkSchema: () => insertRiskActionLinkSchema,
  insertRiskAreaEdgeSchema: () => insertRiskAreaEdgeSchema,
  insertRiskAreaResultSchema: () => insertRiskAreaResultSchema,
  insertRiskAssessmentRunSchema: () => insertRiskAssessmentRunSchema,
  insertRiskAssessmentSchema: () => insertRiskAssessmentSchema,
  insertRiskCaseRawSchema: () => insertRiskCaseRawSchema,
  insertRiskDistrictDataEntrySchema: () => insertRiskDistrictDataEntrySchema,
  insertRiskDomainResultSchema: () => insertRiskDomainResultSchema,
  insertRiskIndicatorResultSchema: () => insertRiskIndicatorResultSchema,
  insertRiskMethodologyProfileSchema: () => insertRiskMethodologyProfileSchema,
  insertRiskMethodologySchema: () => insertRiskMethodologySchema,
  insertRiskMethodologyVersionSchema: () => insertRiskMethodologyVersionSchema,
  insertRiskVulnerabilityResponseSchema: () => insertRiskVulnerabilityResponseSchema,
  insertSessionDayPlanSchema: () => insertSessionDayPlanSchema,
  insertSessionPlanSchema: () => insertSessionPlanSchema,
  insertSettlementMasterSchema: () => insertSettlementMasterSchema,
  insertSignupRequestSchema: () => insertSignupRequestSchema,
  insertStockReferenceHistoryVersionSchema: () => insertStockReferenceHistoryVersionSchema,
  insertStockTransactionSchema: () => insertStockTransactionSchema,
  insertSupervisionChecklistTemplateSchema: () => insertSupervisionChecklistTemplateSchema,
  insertSupervisionQuestionBankSchema: () => insertSupervisionQuestionBankSchema,
  insertSupervisionVisitSchema: () => insertSupervisionVisitSchema,
  insertSurveillanceCaseSchema: () => insertSurveillanceCaseSchema,
  insertTenantIdpConfigSchema: () => insertTenantIdpConfigSchema,
  insertTenantInterestRequestSchema: () => insertTenantInterestRequestSchema,
  insertTenantSchema: () => insertTenantSchema,
  insertTenantVpdConfigurationSchema: () => insertTenantVpdConfigurationSchema,
  insertUncoveredCommunitySchema: () => insertUncoveredCommunitySchema,
  insertUserAssignmentHistorySchema: () => insertUserAssignmentHistorySchema,
  insertUserPermissionSchema: () => insertUserPermissionSchema,
  insertUserRoleSchema: () => insertUserRoleSchema,
  insertUserSchema: () => insertUserSchema,
  insertVaccineConfigSchema: () => insertVaccineConfigSchema,
  insertVaccineRequirementSchema: () => insertVaccineRequirementSchema,
  insertVaccineScheduleHistoryVersionSchema: () => insertVaccineScheduleHistoryVersionSchema,
  insertVgieAlertRuleSchema: () => insertVgieAlertRuleSchema,
  insertVgieAlertSchema: () => insertVgieAlertSchema,
  insertVgieRecommendationRuleSchema: () => insertVgieRecommendationRuleSchema,
  insertVgieRecommendationSchema: () => insertVgieRecommendationSchema,
  insertVgieSettlementFacilityLinkSchema: () => insertVgieSettlementFacilityLinkSchema,
  insertVillageSchema: () => insertVillageSchema,
  insertVpdLinelistTemplateSchema: () => insertVpdLinelistTemplateSchema,
  labSamples: () => labSamples,
  llgs: () => llgs,
  llgsRelations: () => llgsRelations,
  messageTemplates: () => messageTemplates,
  microplanTypeEnum: () => microplanTypeEnum,
  microplanVersions: () => microplanVersions,
  microplanVersionsRelations: () => microplanVersionsRelations,
  microplans: () => microplans,
  microplansRelations: () => microplansRelations,
  mobilizationActivities: () => mobilizationActivities,
  monthlyReports: () => monthlyReports,
  monthlyReportsRelations: () => monthlyReportsRelations,
  notifications: () => notifications,
  pageViews: () => pageViews,
  pilotActivities: () => pilotActivities,
  pilotActivitiesRelations: () => pilotActivitiesRelations,
  pilotUpdates: () => pilotUpdates,
  pilotUpdatesRelations: () => pilotUpdatesRelations,
  populationData: () => populationData,
  populationGrids: () => populationGrids,
  populationGridsRelations: () => populationGridsRelations,
  populationHistoryVersions: () => populationHistoryVersions,
  populationRefreshJobs: () => populationRefreshJobs,
  populationRefreshStatusEnum: () => populationRefreshStatusEnum,
  populationRefreshTriggerEnum: () => populationRefreshTriggerEnum,
  populationSourceEnum: () => populationSourceEnum,
  provinces: () => provinces,
  provincesRelations: () => provincesRelations,
  quarterlyReviews: () => quarterlyReviews,
  regions: () => regions,
  regionsRelations: () => regionsRelations,
  reportEntitySnapshots: () => reportEntitySnapshots,
  researchDocuments: () => researchDocuments,
  researchDocumentsRelations: () => researchDocumentsRelations,
  researchDownloadEvents: () => researchDownloadEvents,
  researchDownloadEventsRelations: () => researchDownloadEventsRelations,
  researchInterestSubmissions: () => researchInterestSubmissions,
  riskActionLinks: () => riskActionLinks,
  riskAreaEdges: () => riskAreaEdges,
  riskAreaResults: () => riskAreaResults,
  riskAssessmentRuns: () => riskAssessmentRuns,
  riskAssessments: () => riskAssessments,
  riskCaseRaw: () => riskCaseRaw,
  riskDistrictDataEntry: () => riskDistrictDataEntry,
  riskDomainResults: () => riskDomainResults,
  riskIndicatorResults: () => riskIndicatorResults,
  riskMethodologies: () => riskMethodologies,
  riskMethodologyProfiles: () => riskMethodologyProfiles,
  riskMethodologyVersions: () => riskMethodologyVersions,
  riskVulnerabilityResponses: () => riskVulnerabilityResponses,
  selectCatalogueCommoditySchema: () => selectCatalogueCommoditySchema,
  selectCatalogueScheduleDoseSchema: () => selectCatalogueScheduleDoseSchema,
  selectCatalogueVaccineSchema: () => selectCatalogueVaccineSchema,
  selectCatalogueWastageThresholdSchema: () => selectCatalogueWastageThresholdSchema,
  selectClientImportBatchSchema: () => selectClientImportBatchSchema,
  selectCommunityHistoryVersionSchema: () => selectCommunityHistoryVersionSchema,
  selectEntityHistoryVersionSchema: () => selectEntityHistoryVersionSchema,
  selectFacilityHistoryVersionSchema: () => selectFacilityHistoryVersionSchema,
  selectGisPolygonSchema: () => selectGisPolygonSchema,
  selectPopulationHistoryVersionSchema: () => selectPopulationHistoryVersionSchema,
  selectReportEntitySnapshotSchema: () => selectReportEntitySnapshotSchema,
  selectRiskActionLinkSchema: () => selectRiskActionLinkSchema,
  selectRiskAreaEdgeSchema: () => selectRiskAreaEdgeSchema,
  selectRiskAreaResultSchema: () => selectRiskAreaResultSchema,
  selectRiskAssessmentRunSchema: () => selectRiskAssessmentRunSchema,
  selectRiskAssessmentSchema: () => selectRiskAssessmentSchema,
  selectRiskCaseRawSchema: () => selectRiskCaseRawSchema,
  selectRiskDistrictDataEntrySchema: () => selectRiskDistrictDataEntrySchema,
  selectRiskDomainResultSchema: () => selectRiskDomainResultSchema,
  selectRiskIndicatorResultSchema: () => selectRiskIndicatorResultSchema,
  selectRiskMethodologyProfileSchema: () => selectRiskMethodologyProfileSchema,
  selectRiskMethodologySchema: () => selectRiskMethodologySchema,
  selectRiskMethodologyVersionSchema: () => selectRiskMethodologyVersionSchema,
  selectRiskVulnerabilityResponseSchema: () => selectRiskVulnerabilityResponseSchema,
  selectStockReferenceHistoryVersionSchema: () => selectStockReferenceHistoryVersionSchema,
  selectSupervisionQuestionBankSchema: () => selectSupervisionQuestionBankSchema,
  selectUserAssignmentHistorySchema: () => selectUserAssignmentHistorySchema,
  selectVaccineScheduleHistoryVersionSchema: () => selectVaccineScheduleHistoryVersionSchema,
  selectVgieAlertRuleSchema: () => selectVgieAlertRuleSchema,
  selectVgieRecommendationRuleSchema: () => selectVgieRecommendationRuleSchema,
  sessionDayPlans: () => sessionDayPlans,
  sessionDayPlansRelations: () => sessionDayPlansRelations,
  sessionPlanTypeEnum: () => sessionPlanTypeEnum,
  sessionPlans: () => sessionPlans,
  sessionPlansRelations: () => sessionPlansRelations,
  sessionTypeEnum: () => sessionTypeEnum,
  sessionVillages: () => sessionVillages,
  sessionVillagesRelations: () => sessionVillagesRelations,
  sessions: () => sessions,
  settlementsMaster: () => settlementsMaster,
  settlementsMasterRelations: () => settlementsMasterRelations,
  signupRequests: () => signupRequests,
  signupStatusEnum: () => signupStatusEnum,
  stockAlertDigestSettingsSchema: () => stockAlertDigestSettingsSchema,
  stockReferenceHistoryVersions: () => stockReferenceHistoryVersions,
  stockTransactions: () => stockTransactions,
  stockTransactionsRelations: () => stockTransactionsRelations,
  supervisionChecklistTemplates: () => supervisionChecklistTemplates,
  supervisionQuestionBank: () => supervisionQuestionBank,
  supervisionTemplateAuditLogs: () => supervisionTemplateAuditLogs,
  supervisionTemplateVersions: () => supervisionTemplateVersions,
  supervisionVisits: () => supervisionVisits,
  surveillanceCases: () => surveillanceCases,
  tenantEmailSettingsSchema: () => tenantEmailSettingsSchema,
  tenantIdpConfigs: () => tenantIdpConfigs,
  tenantInterestRequests: () => tenantInterestRequests,
  tenantSecuritySettingsSchema: () => tenantSecuritySettingsSchema,
  tenantStatusEnum: () => tenantStatusEnum,
  tenantVpdConfigurations: () => tenantVpdConfigurations,
  tenants: () => tenants,
  transportModeEnum: () => transportModeEnum,
  uncoveredCommunities: () => uncoveredCommunities,
  userAssignmentHistory: () => userAssignmentHistory,
  userPermissions: () => userPermissions,
  userRoleEnum: () => userRoleEnum,
  userRoles: () => userRoles,
  users: () => users,
  usersRelations: () => usersRelations,
  vaccineConfigurations: () => vaccineConfigurations,
  vaccineConfigurationsRelations: () => vaccineConfigurationsRelations,
  vaccineRequirements: () => vaccineRequirements,
  vaccineScheduleHistoryVersions: () => vaccineScheduleHistoryVersions,
  vgieAlertRules: () => vgieAlertRules,
  vgieAlertRulesRelations: () => vgieAlertRulesRelations,
  vgieAlerts: () => vgieAlerts,
  vgieRecommendationRules: () => vgieRecommendationRules,
  vgieRecommendationRulesRelations: () => vgieRecommendationRulesRelations,
  vgieRecommendations: () => vgieRecommendations,
  vgieSettlementFacilityLinks: () => vgieSettlementFacilityLinks,
  villages: () => villages,
  villagesRelations: () => villagesRelations,
  vpdDiseasesEnum: () => vpdDiseasesEnum,
  vpdLinelistTemplates: () => vpdLinelistTemplates
});
var import_drizzle_orm2 = require("drizzle-orm");
var import_pg_core2 = require("drizzle-orm/pg-core");
var import_drizzle_zod2 = require("drizzle-zod");
var import_zod = require("zod");

// shared/vaccineSchedule.ts
function normalizeStockVaccineName(input) {
  if (!input) return "";
  let value = input.trim().toUpperCase();
  value = value.replace(/DOSE\s*-?\s*([0-9]+)/g, "-$1");
  value = value.replace(/\s+/g, "");
  value = value.replace(/^([A-Z]+)-?([0-9]+)$/, "$1-$2");
  const mapping = {
    "BCG": "BCG",
    "OPV": "OPV",
    "OPV-0": "OPV",
    "OPV-1": "OPV",
    "OPV-2": "OPV",
    "OPV-3": "OPV",
    "IPV": "IPV",
    "IPV-1": "IPV",
    "IPV-2": "IPV",
    "PCV": "PCV",
    "PCV-1": "PCV",
    "PCV-2": "PCV",
    "PCV-3": "PCV",
    "PENTA": "PENTA",
    "PENTA-1": "PENTA",
    "PENTA-2": "PENTA",
    "PENTA-3": "PENTA",
    "ROTA": "ROTAVIRUS",
    "ROTA-1": "ROTAVIRUS",
    "ROTA-2": "ROTAVIRUS",
    "ROTAVIRUS": "ROTAVIRUS",
    "MR": "MR",
    "MR-1": "MR",
    "MR-2": "MR",
    "TT": "TT",
    "TT-1": "TT",
    "TT-2": "TT",
    "HPV": "HPV",
    "COVID-19": "COVID-19",
    "TD": "TD"
  };
  return mapping[value] ?? input.trim();
}

// shared/riskSchema.ts
var import_drizzle_orm = require("drizzle-orm");
var import_pg_core = require("drizzle-orm/pg-core");
var import_drizzle_zod = require("drizzle-zod");
var riskMethodologies = (0, import_pg_core.pgTable)("risk_methodologies", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  key: (0, import_pg_core.varchar)("key", { length: 100 }).notNull().unique(),
  // e.g. "who_measles"
  name: (0, import_pg_core.varchar)("name", { length: 255 }).notNull(),
  disease: (0, import_pg_core.varchar)("disease", { length: 100 }).notNull(),
  // "measles", "rubella", "polio", etc.
  description: (0, import_pg_core.text)("description"),
  sourceOrg: (0, import_pg_core.varchar)("source_org", { length: 255 }).default("WHO"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
});
var riskMethodologyVersions = (0, import_pg_core.pgTable)("risk_methodology_versions", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  methodologyId: (0, import_pg_core.varchar)("methodology_id").notNull().references(() => riskMethodologies.id, { onDelete: "cascade" }),
  version: (0, import_pg_core.varchar)("version", { length: 100 }).notNull(),
  // e.g. "WHO_MEASLES_GLOBAL_RECONCILED_V1"
  status: (0, import_pg_core.varchar)("status", { length: 50 }).notNull().default("published"),
  // published, draft, retired
  rulesJson: (0, import_pg_core.jsonb)("rules_json").notNull(),
  checksum: (0, import_pg_core.varchar)("checksum", { length: 128 }).notNull(),
  effectiveDate: (0, import_pg_core.timestamp)("effective_date").defaultNow().notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
}, (table) => ({
  methodologyVersionIdx: (0, import_pg_core.uniqueIndex)("idx_risk_meth_ver_unique").on(table.methodologyId, table.version)
}));
var riskMethodologyProfiles = (0, import_pg_core.pgTable)("risk_methodology_profiles", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  versionId: (0, import_pg_core.varchar)("version_id").notNull().references(() => riskMethodologyVersions.id, { onDelete: "cascade" }),
  profileName: (0, import_pg_core.varchar)("profile_name", { length: 255 }).notNull(),
  overridesJson: (0, import_pg_core.jsonb)("overrides_json").notNull().default({}),
  // e.g. MCV1 schedule age, SIA exemption policy, etc.
  approvedBy: (0, import_pg_core.varchar)("approved_by", { length: 255 }),
  approvedAt: (0, import_pg_core.timestamp)("approved_at"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
}, (table) => ({
  tenantProfileIdx: (0, import_pg_core.index)("idx_risk_profile_tenant").on(table.tenantId)
}));
var riskAssessments = (0, import_pg_core.pgTable)("risk_assessments", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title: (0, import_pg_core.varchar)("title", { length: 255 }).notNull(),
  methodologyVersionId: (0, import_pg_core.varchar)("methodology_version_id").notNull().references(() => riskMethodologyVersions.id),
  profileId: (0, import_pg_core.varchar)("profile_id").references(() => riskMethodologyProfiles.id, { onDelete: "set null" }),
  assessmentYear: (0, import_pg_core.integer)("assessment_year").notNull(),
  // e.g. 2023
  baselineYears: (0, import_pg_core.jsonb)("baseline_years").notNull().default([2020, 2021, 2022]),
  status: (0, import_pg_core.varchar)("status", { length: 50 }).notNull().default("draft"),
  // draft, importing, validation_required, ready_to_calculate, calculating, calculated, under_review, approved, superseded
  activeRunId: (0, import_pg_core.varchar)("active_run_id"),
  notes: (0, import_pg_core.text)("notes"),
  reportConfigJson: (0, import_pg_core.jsonb)("report_config_json").default({}),
  createdByUserId: (0, import_pg_core.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedByUserId: (0, import_pg_core.varchar)("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: (0, import_pg_core.timestamp)("approved_at"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
}, (table) => ({
  tenantAssessmentIdx: (0, import_pg_core.index)("idx_risk_assessment_tenant").on(table.tenantId)
}));
var riskAssessmentRuns = (0, import_pg_core.pgTable)("risk_assessment_runs", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  assessmentId: (0, import_pg_core.varchar)("assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  runNumber: (0, import_pg_core.integer)("run_number").notNull().default(1),
  calculatedAt: (0, import_pg_core.timestamp)("calculated_at").defaultNow().notNull(),
  calculatedByUserId: (0, import_pg_core.varchar)("calculated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  isOfficial: (0, import_pg_core.boolean)("is_official").notNull().default(false),
  inputChecksum: (0, import_pg_core.varchar)("input_checksum", { length: 128 }),
  summaryStats: (0, import_pg_core.jsonb)("summary_stats").notNull().default({}),
  executionLog: (0, import_pg_core.text)("execution_log")
}, (table) => ({
  assessmentRunIdx: (0, import_pg_core.index)("idx_risk_run_assessment").on(table.assessmentId),
  tenantRunIdx: (0, import_pg_core.index)("idx_risk_run_tenant").on(table.tenantId)
}));
var riskAreaResults = (0, import_pg_core.pgTable)("risk_area_results", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  runId: (0, import_pg_core.varchar)("run_id").notNull().references(() => riskAssessmentRuns.id, { onDelete: "cascade" }),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  districtId: (0, import_pg_core.integer)("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  provinceId: (0, import_pg_core.integer)("province_id").references(() => provinces.id, { onDelete: "set null" }),
  totalScore: (0, import_pg_core.decimal)("total_score", { precision: 5, scale: 2 }),
  riskCategory: (0, import_pg_core.varchar)("risk_category", { length: 50 }).notNull(),
  // LOW, MEDIUM, HIGH, VERY_HIGH, INCOMPLETE
  completenessRate: (0, import_pg_core.decimal)("completeness_rate", { precision: 5, scale: 2 }).notNull().default("100.00"),
  population: (0, import_pg_core.decimal)("population", { precision: 12, scale: 2 }),
  areaKm2: (0, import_pg_core.decimal)("area_km2", { precision: 12, scale: 2 }),
  populationDensity: (0, import_pg_core.decimal)("population_density", { precision: 12, scale: 2 }),
  domainScoresJson: (0, import_pg_core.jsonb)("domain_scores_json").notNull().default({}),
  summaryExplanation: (0, import_pg_core.text)("summary_explanation"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
}, (table) => ({
  runDistrictIdx: (0, import_pg_core.uniqueIndex)("idx_risk_area_run_district").on(table.runId, table.districtId),
  tenantAreaIdx: (0, import_pg_core.index)("idx_risk_area_tenant").on(table.tenantId)
}));
var riskDomainResults = (0, import_pg_core.pgTable)("risk_domain_results", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  runId: (0, import_pg_core.varchar)("run_id").notNull().references(() => riskAssessmentRuns.id, { onDelete: "cascade" }),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  districtId: (0, import_pg_core.integer)("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  domainCode: (0, import_pg_core.varchar)("domain_code", { length: 50 }).notNull(),
  // PI, SQ, PDP, TA
  domainScore: (0, import_pg_core.decimal)("domain_score", { precision: 5, scale: 2 }).notNull(),
  maxScore: (0, import_pg_core.decimal)("max_score", { precision: 5, scale: 2 }).notNull(),
  domainRiskCategory: (0, import_pg_core.varchar)("domain_risk_category", { length: 50 })
}, (table) => ({
  runDistrictDomainIdx: (0, import_pg_core.uniqueIndex)("idx_risk_domain_run_dist_code").on(table.runId, table.districtId, table.domainCode)
}));
var riskIndicatorResults = (0, import_pg_core.pgTable)("risk_indicator_results", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  runId: (0, import_pg_core.varchar)("run_id").notNull().references(() => riskAssessmentRuns.id, { onDelete: "cascade" }),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  districtId: (0, import_pg_core.integer)("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  domainCode: (0, import_pg_core.varchar)("domain_code", { length: 50 }).notNull(),
  indicatorCode: (0, import_pg_core.varchar)("indicator_code", { length: 50 }).notNull(),
  // PI1, PI2... TA6
  valueRaw: (0, import_pg_core.text)("value_raw"),
  valueAnalytical: (0, import_pg_core.decimal)("value_analytical", { precision: 12, scale: 4 }),
  numerator: (0, import_pg_core.decimal)("numerator", { precision: 12, scale: 4 }),
  denominator: (0, import_pg_core.decimal)("denominator", { precision: 12, scale: 4 }),
  pointsAwarded: (0, import_pg_core.decimal)("points_awarded", { precision: 5, scale: 2 }).notNull(),
  maxPoints: (0, import_pg_core.decimal)("max_points", { precision: 5, scale: 2 }).notNull(),
  thresholdApplied: (0, import_pg_core.text)("threshold_applied"),
  formulaUsed: (0, import_pg_core.text)("formula_used"),
  valueState: (0, import_pg_core.varchar)("value_state", { length: 50 }).notNull().default("OBSERVED"),
  // OBSERVED, VERIFIED_ZERO, MISSING, INVALID, NOT_INTRODUCED, NOT_APPLICABLE, POLICY_ASSIGNED
  explanation: (0, import_pg_core.text)("explanation").notNull(),
  neighboursBreakdownJson: (0, import_pg_core.jsonb)("neighbours_breakdown_json")
}, (table) => ({
  runDistrictIndicatorIdx: (0, import_pg_core.uniqueIndex)("idx_risk_indicator_run_dist_code").on(table.runId, table.districtId, table.indicatorCode)
}));
var riskCaseRaw = (0, import_pg_core.pgTable)("risk_case_raw", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId: (0, import_pg_core.varchar)("assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  sourceRowIndex: (0, import_pg_core.integer)("source_row_index"),
  caseId: (0, import_pg_core.varchar)("case_id", { length: 255 }),
  year: (0, import_pg_core.integer)("year").notNull(),
  provinceName: (0, import_pg_core.varchar)("province_name", { length: 255 }),
  districtName: (0, import_pg_core.varchar)("district_name", { length: 255 }),
  districtId: (0, import_pg_core.integer)("district_id").references(() => districts.id, { onDelete: "set null" }),
  finalClassification: (0, import_pg_core.varchar)("final_classification", { length: 100 }).notNull(),
  // LAB_CONFIRMED_MEASLES, EPI_LINKED_MEASLES, CLINICALLY_COMPATIBLE_MEASLES, DISCARDED_NON_MEASLES, CONFIRMED_RUBELLA, PENDING, UNCLASSIFIED
  sourceClassification: (0, import_pg_core.varchar)("source_classification", { length: 255 }),
  ageYears: (0, import_pg_core.decimal)("age_years", { precision: 5, scale: 2 }),
  ageMonths: (0, import_pg_core.integer)("age_months"),
  sex: (0, import_pg_core.varchar)("sex", { length: 10 }),
  placeOfResidence: (0, import_pg_core.varchar)("place_of_residence", { length: 255 }),
  rashOnsetDate: (0, import_pg_core.timestamp)("rash_onset_date"),
  notificationDate: (0, import_pg_core.timestamp)("notification_date"),
  investigationDate: (0, import_pg_core.timestamp)("investigation_date"),
  bloodSpecimenDate: (0, import_pg_core.timestamp)("blood_specimen_date"),
  labResultDate: (0, import_pg_core.timestamp)("lab_result_date"),
  vaccinationStatus: (0, import_pg_core.varchar)("vaccination_status", { length: 50 }),
  // VACCINATED, UNVACCINATED, UNKNOWN, CONFLICTING
  dosesCount: (0, import_pg_core.integer)("doses_count"),
  isAdequateInvestigation: (0, import_pg_core.boolean)("is_adequate_investigation").notNull().default(false),
  isAdequateSpecimen: (0, import_pg_core.boolean)("is_adequate_specimen").notNull().default(false),
  isTimelyLabResult: (0, import_pg_core.boolean)("is_timely_lab_result").notNull().default(false),
  isQualifyingMeaslesThreat: (0, import_pg_core.boolean)("is_qualifying_measles_threat").notNull().default(false),
  isEpiLinked: (0, import_pg_core.boolean)("is_epi_linked").notNull().default(false),
  isDiscarded: (0, import_pg_core.boolean)("is_discarded").notNull().default(false),
  validationFlags: (0, import_pg_core.jsonb)("validation_flags").notNull().default([]),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
}, (table) => ({
  assessmentCaseIdx: (0, import_pg_core.index)("idx_risk_case_assessment").on(table.assessmentId),
  tenantCaseIdx: (0, import_pg_core.index)("idx_risk_case_tenant").on(table.tenantId),
  districtYearIdx: (0, import_pg_core.index)("idx_risk_case_district_year").on(table.districtId, table.year)
}));
var riskAreaEdges = (0, import_pg_core.pgTable)("risk_area_edges", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  districtIdA: (0, import_pg_core.integer)("district_id_a").notNull().references(() => districts.id, { onDelete: "cascade" }),
  districtIdB: (0, import_pg_core.integer)("district_id_b").notNull().references(() => districts.id, { onDelete: "cascade" }),
  edgeType: (0, import_pg_core.varchar)("edge_type", { length: 50 }).notNull().default("land_border"),
  // land_border, island_link, transport_corridor, cross_border
  isApproved: (0, import_pg_core.boolean)("is_approved").notNull().default(true),
  notes: (0, import_pg_core.text)("notes"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
}, (table) => ({
  edgeUniqueIdx: (0, import_pg_core.uniqueIndex)("idx_risk_area_edge_unique").on(table.tenantId, table.districtIdA, table.districtIdB),
  tenantEdgeIdx: (0, import_pg_core.index)("idx_risk_edge_tenant").on(table.tenantId)
}));
var riskVulnerabilityResponses = (0, import_pg_core.pgTable)("risk_vulnerability_responses", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId: (0, import_pg_core.varchar)("assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  districtId: (0, import_pg_core.integer)("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  factorKey: (0, import_pg_core.varchar)("factor_key", { length: 100 }).notNull(),
  isPresent: (0, import_pg_core.boolean)("is_present").notNull().default(false),
  evidenceText: (0, import_pg_core.text)("evidence_text"),
  reviewerNotes: (0, import_pg_core.text)("reviewer_notes"),
  updatedByUserId: (0, import_pg_core.varchar)("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
}, (table) => ({
  assessmentDistrictFactorIdx: (0, import_pg_core.uniqueIndex)("idx_risk_vuln_unique").on(table.assessmentId, table.districtId, table.factorKey)
}));
var riskActionLinks = (0, import_pg_core.pgTable)("risk_action_links", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId: (0, import_pg_core.varchar)("assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  areaResultId: (0, import_pg_core.varchar)("area_result_id").references(() => riskAreaResults.id, { onDelete: "cascade" }),
  districtId: (0, import_pg_core.integer)("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  indicatorCode: (0, import_pg_core.varchar)("indicator_code", { length: 50 }),
  actionTitle: (0, import_pg_core.varchar)("action_title", { length: 255 }).notNull(),
  actionDescription: (0, import_pg_core.text)("action_description").notNull(),
  linkedModule: (0, import_pg_core.varchar)("linked_module", { length: 50 }).notNull(),
  // microplan, supervision, budget, surveillance
  linkedEntityId: (0, import_pg_core.varchar)("linked_entity_id", { length: 255 }),
  responsiblePerson: (0, import_pg_core.varchar)("responsible_person", { length: 255 }),
  targetCompletionDate: (0, import_pg_core.timestamp)("target_completion_date"),
  budgetEstimateUsd: (0, import_pg_core.decimal)("budget_estimate_usd", { precision: 12, scale: 2 }),
  createdByUserId: (0, import_pg_core.varchar)("created_by_user_id"),
  status: (0, import_pg_core.varchar)("status", { length: 50 }).notNull().default("open"),
  // open, in_progress, completed, deferred
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
}, (table) => ({
  assessmentActionIdx: (0, import_pg_core.index)("idx_risk_action_assessment").on(table.assessmentId),
  tenantActionIdx: (0, import_pg_core.index)("idx_risk_action_tenant").on(table.tenantId)
}));
var riskDistrictDataEntry = (0, import_pg_core.pgTable)("risk_district_data_entry", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId: (0, import_pg_core.varchar)("assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  districtId: (0, import_pg_core.integer)("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  provinceId: (0, import_pg_core.integer)("province_id").references(() => provinces.id, { onDelete: "set null" }),
  population: (0, import_pg_core.decimal)("population", { precision: 12, scale: 2 }).default("100000"),
  areaKm2: (0, import_pg_core.decimal)("area_km2", { precision: 12, scale: 2 }).default("2500"),
  mcv1YearMinus3: (0, import_pg_core.decimal)("mcv1_year_minus3", { precision: 5, scale: 2 }).default("80.00"),
  mcv1YearMinus2: (0, import_pg_core.decimal)("mcv1_year_minus2", { precision: 5, scale: 2 }).default("82.00"),
  mcv1YearMinus1: (0, import_pg_core.decimal)("mcv1_year_minus1", { precision: 5, scale: 2 }).default("85.00"),
  mcv2YearMinus3: (0, import_pg_core.decimal)("mcv2_year_minus3", { precision: 5, scale: 2 }).default("70.00"),
  mcv2YearMinus2: (0, import_pg_core.decimal)("mcv2_year_minus2", { precision: 5, scale: 2 }).default("72.00"),
  mcv2YearMinus1: (0, import_pg_core.decimal)("mcv2_year_minus1", { precision: 5, scale: 2 }).default("75.00"),
  penta1YearMinus1: (0, import_pg_core.decimal)("penta1_year_minus1", { precision: 5, scale: 2 }).default("90.00"),
  siaCoveragePct: (0, import_pg_core.decimal)("sia_coverage_pct", { precision: 5, scale: 2 }).default("92.00"),
  siaTargetAgeGroup: (0, import_pg_core.varchar)("sia_target_age_group", { length: 20 }).default("WIDE"),
  siaYearsSince: (0, import_pg_core.integer)("sia_years_since").default(2),
  unvaccinatedCasesPct: (0, import_pg_core.decimal)("unvaccinated_cases_pct", { precision: 5, scale: 2 }).default("15.00"),
  suspectedCases: (0, import_pg_core.integer)("suspected_cases").default(12),
  discardedCases: (0, import_pg_core.integer)("discarded_cases").default(3),
  adequateInvestigationPct: (0, import_pg_core.decimal)("adequate_investigation_pct", { precision: 5, scale: 2 }).default("85.00"),
  adequateSpecimenPct: (0, import_pg_core.decimal)("adequate_specimen_pct", { precision: 5, scale: 2 }).default("85.00"),
  timelyLabResultsPct: (0, import_pg_core.decimal)("timely_lab_results_pct", { precision: 5, scale: 2 }).default("85.00"),
  threatCasesUnder5: (0, import_pg_core.integer)("threat_cases_under5").default(0),
  threatCases5To14: (0, import_pg_core.integer)("threat_cases_5_to_14").default(0),
  threatCases15Plus: (0, import_pg_core.integer)("threat_cases_15_plus").default(0),
  borderCaseInPastYear: (0, import_pg_core.boolean)("border_case_in_past_year").default(false),
  vulnerabilities: (0, import_pg_core.jsonb)("vulnerabilities").default({
    migrantOrUnderserved: false,
    vaccineHesitancyOrRefusal: false,
    securityOrConflictConcerns: false,
    recurrentNaturalDisasters: false,
    poorAccessOrTerrain: false,
    inadequatePoliticalSupport: false,
    highTransitHubOrBorder: false,
    massGatheringsOrEvents: false
  }),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
}, (table) => ({
  assessmentDistrictEntryIdx: (0, import_pg_core.uniqueIndex)("idx_risk_dist_entry_unique").on(table.assessmentId, table.districtId),
  tenantDistEntryIdx: (0, import_pg_core.index)("idx_risk_dist_entry_tenant").on(table.tenantId),
  assessmentEntryIdx: (0, import_pg_core.index)("idx_risk_dist_entry_assessment").on(table.assessmentId)
}));
var insertRiskMethodologySchema = (0, import_drizzle_zod.createInsertSchema)(riskMethodologies);
var selectRiskMethodologySchema = (0, import_drizzle_zod.createSelectSchema)(riskMethodologies);
var insertRiskMethodologyVersionSchema = (0, import_drizzle_zod.createInsertSchema)(riskMethodologyVersions);
var selectRiskMethodologyVersionSchema = (0, import_drizzle_zod.createSelectSchema)(riskMethodologyVersions);
var insertRiskMethodologyProfileSchema = (0, import_drizzle_zod.createInsertSchema)(riskMethodologyProfiles);
var selectRiskMethodologyProfileSchema = (0, import_drizzle_zod.createSelectSchema)(riskMethodologyProfiles);
var insertRiskAssessmentSchema = (0, import_drizzle_zod.createInsertSchema)(riskAssessments);
var selectRiskAssessmentSchema = (0, import_drizzle_zod.createSelectSchema)(riskAssessments);
var insertRiskAssessmentRunSchema = (0, import_drizzle_zod.createInsertSchema)(riskAssessmentRuns);
var selectRiskAssessmentRunSchema = (0, import_drizzle_zod.createSelectSchema)(riskAssessmentRuns);
var insertRiskAreaResultSchema = (0, import_drizzle_zod.createInsertSchema)(riskAreaResults);
var selectRiskAreaResultSchema = (0, import_drizzle_zod.createSelectSchema)(riskAreaResults);
var insertRiskDomainResultSchema = (0, import_drizzle_zod.createInsertSchema)(riskDomainResults);
var selectRiskDomainResultSchema = (0, import_drizzle_zod.createSelectSchema)(riskDomainResults);
var insertRiskIndicatorResultSchema = (0, import_drizzle_zod.createInsertSchema)(riskIndicatorResults);
var selectRiskIndicatorResultSchema = (0, import_drizzle_zod.createSelectSchema)(riskIndicatorResults);
var insertRiskCaseRawSchema = (0, import_drizzle_zod.createInsertSchema)(riskCaseRaw);
var selectRiskCaseRawSchema = (0, import_drizzle_zod.createSelectSchema)(riskCaseRaw);
var insertRiskAreaEdgeSchema = (0, import_drizzle_zod.createInsertSchema)(riskAreaEdges);
var selectRiskAreaEdgeSchema = (0, import_drizzle_zod.createSelectSchema)(riskAreaEdges);
var insertRiskVulnerabilityResponseSchema = (0, import_drizzle_zod.createInsertSchema)(riskVulnerabilityResponses);
var selectRiskVulnerabilityResponseSchema = (0, import_drizzle_zod.createSelectSchema)(riskVulnerabilityResponses);
var insertRiskActionLinkSchema = (0, import_drizzle_zod.createInsertSchema)(riskActionLinks);
var selectRiskActionLinkSchema = (0, import_drizzle_zod.createSelectSchema)(riskActionLinks);
var insertRiskDistrictDataEntrySchema = (0, import_drizzle_zod.createInsertSchema)(riskDistrictDataEntry);
var selectRiskDistrictDataEntrySchema = (0, import_drizzle_zod.createSelectSchema)(riskDistrictDataEntry);

// shared/schema.ts
var tenantStatusEnum = (0, import_pg_core2.pgEnum)("tenant_status", [
  "trial",
  "active",
  "suspended",
  "archived"
]);
var idpProtocolEnum = (0, import_pg_core2.pgEnum)("idp_protocol", ["oidc", "saml"]);
var signupStatusEnum = (0, import_pg_core2.pgEnum)("signup_status", [
  "pending",
  "approved",
  "rejected",
  "expired"
]);
var populationRefreshStatusEnum = (0, import_pg_core2.pgEnum)("population_refresh_status", [
  "pending",
  "running",
  "succeeded",
  "failed"
]);
var populationRefreshTriggerEnum = (0, import_pg_core2.pgEnum)("population_refresh_trigger", [
  "manual",
  "scheduled"
]);
var tenants = (0, import_pg_core2.pgTable)("tenants", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  code: (0, import_pg_core2.varchar)("code", { length: 10 }).notNull().unique(),
  countryCode: (0, import_pg_core2.varchar)("country_code", { length: 3 }).notNull(),
  status: tenantStatusEnum("status").default("trial").notNull(),
  settings: (0, import_pg_core2.jsonb)("settings").notNull().default({}),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
});
var tenantIdpConfigs = (0, import_pg_core2.pgTable)(
  "tenant_idp_configs",
  {
    id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    protocol: idpProtocolEnum("protocol").notNull(),
    displayName: (0, import_pg_core2.varchar)("display_name", { length: 255 }).notNull(),
    emailDomain: (0, import_pg_core2.varchar)("email_domain", { length: 255 }).notNull(),
    issuerUrl: (0, import_pg_core2.varchar)("issuer_url"),
    clientId: (0, import_pg_core2.varchar)("client_id"),
    clientSecretRef: (0, import_pg_core2.varchar)("client_secret_ref"),
    entryPoint: (0, import_pg_core2.varchar)("entry_point"),
    certRef: (0, import_pg_core2.varchar)("cert_ref"),
    isActive: (0, import_pg_core2.boolean)("is_active").default(true),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
  },
  (table) => [(0, import_pg_core2.index)("idx_idp_email_domain").on(table.emailDomain)]
);
var signupRequests = (0, import_pg_core2.pgTable)(
  "signup_requests",
  {
    id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    email: (0, import_pg_core2.varchar)("email", { length: 255 }).notNull(),
    fullName: (0, import_pg_core2.varchar)("full_name", { length: 255 }).notNull(),
    requestedRole: (0, import_pg_core2.varchar)("requested_role", { length: 50 }).notNull(),
    facilityId: (0, import_pg_core2.integer)("facility_id"),
    districtId: (0, import_pg_core2.integer)("district_id"),
    provinceId: (0, import_pg_core2.integer)("province_id"),
    justification: (0, import_pg_core2.text)("justification"),
    status: signupStatusEnum("status").default("pending").notNull(),
    approverUserId: (0, import_pg_core2.varchar)("approver_user_id"),
    decisionReason: (0, import_pg_core2.text)("decision_reason"),
    decidedAt: (0, import_pg_core2.timestamp)("decided_at"),
    expiresAt: (0, import_pg_core2.timestamp)("expires_at"),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
  },
  (table) => [
    (0, import_pg_core2.index)("idx_signup_tenant_status").on(table.tenantId, table.status),
    (0, import_pg_core2.index)("idx_signup_email").on(table.email)
  ]
);
var tenantInterestRequests = (0, import_pg_core2.pgTable)(
  "tenant_interest_requests",
  {
    id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
    countryCode: (0, import_pg_core2.varchar)("country_code", { length: 3 }).notNull(),
    // ISO-3166 alpha-3
    countryName: (0, import_pg_core2.varchar)("country_name", { length: 255 }).notNull(),
    organization: (0, import_pg_core2.varchar)("organization", { length: 255 }),
    fullName: (0, import_pg_core2.varchar)("full_name", { length: 255 }).notNull(),
    email: (0, import_pg_core2.varchar)("email", { length: 255 }).notNull(),
    requestedRole: (0, import_pg_core2.varchar)("requested_role", { length: 50 }).notNull(),
    justification: (0, import_pg_core2.text)("justification"),
    status: signupStatusEnum("status").default("pending").notNull(),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
  },
  (table) => [
    (0, import_pg_core2.index)("idx_tenant_interest_country").on(table.countryCode),
    (0, import_pg_core2.index)("idx_tenant_interest_status").on(table.status)
  ]
);
var userRoleEnum = (0, import_pg_core2.pgEnum)("user_role", [
  "facility_clerk",
  "facility_in_charge",
  "district_manager",
  "provincial_coordinator",
  "national_admin",
  "gis_specialist",
  "facility_partner",
  "district_partner",
  "provincial_partner",
  "national_partner",
  "national_manager"
]);
var approvalStatusEnum = (0, import_pg_core2.pgEnum)("approval_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
  "locked",
  "under_review",
  "returned",
  "archived",
  "superseded"
]);
var sessionTypeEnum = (0, import_pg_core2.pgEnum)("session_type", [
  "static",
  "mobile",
  "outreach"
]);
var transportModeEnum = (0, import_pg_core2.pgEnum)("transport_mode", [
  "walking",
  "road",
  "car",
  "motorbike",
  "donkey",
  "boat",
  "air",
  "chopper"
]);
var populationSourceEnum = (0, import_pg_core2.pgEnum)("population_source", [
  "nso",
  "hmis",
  "worldpop",
  "survey",
  "community_census"
]);
var sessions = (0, import_pg_core2.pgTable)(
  "sessions",
  {
    sid: (0, import_pg_core2.varchar)("sid").primaryKey(),
    sess: (0, import_pg_core2.jsonb)("sess").notNull(),
    expire: (0, import_pg_core2.timestamp)("expire").notNull()
  },
  (table) => [(0, import_pg_core2.index)("IDX_session_expire").on(table.expire)]
);
var users = (0, import_pg_core2.pgTable)("users", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  email: (0, import_pg_core2.varchar)("email"),
  firstName: (0, import_pg_core2.varchar)("first_name"),
  lastName: (0, import_pg_core2.varchar)("last_name"),
  profileImageUrl: (0, import_pg_core2.varchar)("profile_image_url"),
  role: userRoleEnum("role").default("facility_clerk").notNull(),
  roles: (0, import_pg_core2.jsonb)("roles").default([]).notNull(),
  permissions: (0, import_pg_core2.jsonb)("permissions").default([]).notNull(),
  dataAccessScope: (0, import_pg_core2.jsonb)("data_access_scope").default({ provinces: [], districts: [], facilities: [] }).notNull(),
  facilityId: (0, import_pg_core2.integer)("facility_id"),
  districtId: (0, import_pg_core2.integer)("district_id"),
  provinceId: (0, import_pg_core2.integer)("province_id"),
  hmisCode: (0, import_pg_core2.varchar)("hmis_code"),
  isActive: (0, import_pg_core2.boolean)("is_active").default(true),
  // Optional bcrypt password hash. Populated only for users who sign in via
  // the email+password path (POST /api/auth/login-password). Users who sign
  // in via tenant SSO, OIDC, or device tokens leave this null. The
  // column is intentionally not selected in any list endpoint.
  passwordHash: (0, import_pg_core2.varchar)("password_hash"),
  // Cross-tenant platform super-admin. Orthogonal to `role` (which is still
  // tenant-scoped — e.g. national_admin OF a specific Ministry). When true,
  // hasPermission() short-circuits to allow everything in every tenant.
  // Set this *only* via direct DB action — there is intentionally no API to
  // grant it, so a compromised tenant admin can never escalate to platform.
  isPlatformAdmin: (0, import_pg_core2.boolean)("is_platform_admin").default(false).notNull(),
  // Per-user notification preferences. Currently honoured: { supervisionDigest: boolean }.
  // Default is "opt-in" (key absent or true → digest is sent); set to false to opt out.
  notificationPrefs: (0, import_pg_core2.jsonb)("notification_prefs").default({}).notNull(),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => [
  (0, import_pg_core2.index)("idx_users_tenant").on(table.tenantId),
  (0, import_pg_core2.unique)("uq_users_tenant_email").on(table.tenantId, table.email)
]);
var userRoles = (0, import_pg_core2.pgTable)(
  "user_roles",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    code: (0, import_pg_core2.varchar)("code", { length: 50 }).notNull(),
    name: (0, import_pg_core2.varchar)("name", { length: 100 }).notNull(),
    permissions: (0, import_pg_core2.jsonb)("permissions").default([]).notNull(),
    // array of Permission strings
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
  },
  (table) => [
    (0, import_pg_core2.index)("idx_user_roles_tenant").on(table.tenantId),
    (0, import_pg_core2.unique)("uq_user_roles_tenant_code").on(table.tenantId, table.code)
  ]
);
var userPermissions = (0, import_pg_core2.pgTable)(
  "user_permissions",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    code: (0, import_pg_core2.varchar)("code", { length: 100 }).notNull(),
    name: (0, import_pg_core2.varchar)("name", { length: 100 }).notNull(),
    description: (0, import_pg_core2.text)("description"),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
  },
  (table) => [
    (0, import_pg_core2.index)("idx_user_permissions_tenant").on(table.tenantId),
    (0, import_pg_core2.unique)("uq_user_permissions_tenant_code").on(table.tenantId, table.code)
  ]
);
var deviceTokens = (0, import_pg_core2.pgTable)("device_tokens", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  userId: (0, import_pg_core2.varchar)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  tokenHash: (0, import_pg_core2.varchar)("token_hash", { length: 128 }).notNull().unique(),
  platform: (0, import_pg_core2.varchar)("platform", { length: 32 }).notNull(),
  // "windows" | "android" | "web"
  deviceLabel: (0, import_pg_core2.varchar)("device_label", { length: 255 }),
  // user-friendly label, e.g. hostname
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
  lastUsedAt: (0, import_pg_core2.timestamp)("last_used_at"),
  expiresAt: (0, import_pg_core2.timestamp)("expires_at").notNull(),
  revokedAt: (0, import_pg_core2.timestamp)("revoked_at")
}, (table) => [
  (0, import_pg_core2.index)("idx_device_tokens_user").on(table.userId),
  (0, import_pg_core2.index)("idx_device_tokens_hash").on(table.tokenHash)
]);
var regions = (0, import_pg_core2.pgTable)("regions", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  code: (0, import_pg_core2.varchar)("code", { length: 10 }).notNull(),
  coordinates: (0, import_pg_core2.jsonb)("coordinates"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => [
  (0, import_pg_core2.index)("idx_regions_tenant").on(table.tenantId),
  (0, import_pg_core2.unique)("regions_tenant_code_unique").on(table.tenantId, table.code)
]);
var provinces = (0, import_pg_core2.pgTable)("provinces", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  code: (0, import_pg_core2.varchar)("code", { length: 10 }).notNull(),
  regionId: (0, import_pg_core2.integer)("region_id").references(() => regions.id),
  coordinates: (0, import_pg_core2.jsonb)("coordinates"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => [
  (0, import_pg_core2.index)("idx_provinces_tenant").on(table.tenantId),
  (0, import_pg_core2.unique)("provinces_tenant_code_unique").on(table.tenantId, table.code)
]);
var districts = (0, import_pg_core2.pgTable)("districts", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  code: (0, import_pg_core2.varchar)("code", { length: 10 }).notNull(),
  provinceId: (0, import_pg_core2.integer)("province_id").notNull().references(() => provinces.id),
  coordinates: (0, import_pg_core2.jsonb)("coordinates"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => [
  (0, import_pg_core2.index)("idx_districts_tenant").on(table.tenantId),
  (0, import_pg_core2.unique)("districts_tenant_code_unique").on(table.tenantId, table.code)
]);
var llgs = (0, import_pg_core2.pgTable)("llgs", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  code: (0, import_pg_core2.varchar)("code", { length: 50 }),
  districtId: (0, import_pg_core2.integer)("district_id").notNull().references(() => districts.id),
  coordinates: (0, import_pg_core2.jsonb)("coordinates"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => [(0, import_pg_core2.index)("idx_llgs_tenant").on(table.tenantId)]);
var facilities = (0, import_pg_core2.pgTable)("facilities", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  hmisCode: (0, import_pg_core2.varchar)("hmis_code", { length: 50 }).notNull(),
  facilityType: (0, import_pg_core2.varchar)("facility_type", { length: 100 }),
  agencyName: (0, import_pg_core2.varchar)("agency_name", { length: 100 }),
  operationalStatus: (0, import_pg_core2.varchar)("operational_status", { length: 50 }),
  districtId: (0, import_pg_core2.integer)("district_id").notNull().references(() => districts.id),
  latitude: (0, import_pg_core2.decimal)("latitude", { precision: 10, scale: 7 }),
  longitude: (0, import_pg_core2.decimal)("longitude", { precision: 10, scale: 7 }),
  address: (0, import_pg_core2.text)("address"),
  contactPhone: (0, import_pg_core2.varchar)("contact_phone", { length: 50 }),
  operatingHours: (0, import_pg_core2.varchar)("operating_hours", { length: 100 }),
  hasRefrigerator: (0, import_pg_core2.boolean)("has_refrigerator").default(false),
  hasPower: (0, import_pg_core2.boolean)("has_power").default(false),
  staffCount: (0, import_pg_core2.integer)("staff_count"),
  catchmentRadius: (0, import_pg_core2.decimal)("catchment_radius", { precision: 10, scale: 2 }),
  isActive: (0, import_pg_core2.boolean)("is_active").default(true),
  // GeoJSON polygon describing the HF's drawn catchment area boundary.
  // Drawn in Step 2 of the wizard; locked after first save.
  catchmentPolygon: (0, import_pg_core2.jsonb)("catchment_polygon"),
  // Estimated total population inside the catchment polygon from grid tiles.
  catchmentGridPopulation: (0, import_pg_core2.integer)("catchment_grid_population"),
  // External IdP-side identifiers (DHIS2 UID, SmartCare GUID, eLMIS, iHRIS, etc.).
  // Keyed by IdP code so the same facility can carry multiple cross-references.
  externalIds: (0, import_pg_core2.jsonb)("external_ids").default({}),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => [
  (0, import_pg_core2.index)("idx_facilities_tenant").on(table.tenantId),
  (0, import_pg_core2.unique)("facilities_tenant_hmis_unique").on(table.tenantId, table.hmisCode)
]);
var villages = (0, import_pg_core2.pgTable)("villages", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  code: (0, import_pg_core2.varchar)("code", { length: 50 }),
  districtId: (0, import_pg_core2.integer)("district_id").notNull().references(() => districts.id),
  llgId: (0, import_pg_core2.integer)("llg_id").references(() => llgs.id),
  assignedFacilityId: (0, import_pg_core2.integer)("assigned_facility_id").references(() => facilities.id),
  latitude: (0, import_pg_core2.decimal)("latitude", { precision: 10, scale: 7 }),
  longitude: (0, import_pg_core2.decimal)("longitude", { precision: 10, scale: 7 }),
  distanceToFacility: (0, import_pg_core2.decimal)("distance_to_facility", { precision: 10, scale: 2 }),
  travelTimeMinutes: (0, import_pg_core2.integer)("travel_time_minutes"),
  terrainDifficulty: (0, import_pg_core2.integer)("terrain_difficulty"),
  isHardToReach: (0, import_pg_core2.boolean)("is_hard_to_reach").default(false),
  seasonalAccessibility: (0, import_pg_core2.varchar)("seasonal_accessibility", { length: 100 }),
  transportMode: transportModeEnum("transport_mode"),
  insecurityLevel: (0, import_pg_core2.integer)("insecurity_level"),
  comments: (0, import_pg_core2.text)("comments"),
  accessibilityScore: (0, import_pg_core2.varchar)("accessibility_score", { length: 50 }),
  referralRoute: (0, import_pg_core2.text)("referral_route"),
  boundary: (0, import_pg_core2.jsonb)("boundary"),
  // Drawn community polygon (Step 2 wizard). Distinct from boundary: this is
  // the polygon drawn by the HF planner inside their catchment, used for
  // population estimation and coverage gap detection.
  catchmentPolygon: (0, import_pg_core2.jsonb)("catchment_polygon"),
  // Population estimated from WorldPop/GHS-POP grid tiles intersecting this polygon.
  griddedPopulation: (0, import_pg_core2.integer)("gridded_population"),
  // Human-readable label for the manual population source (NSO, HMIS, survey, etc.)
  populationSourceLabel: (0, import_pg_core2.varchar)("population_source_label", { length: 100 }),
  // Color hex code for rendering this community's polygon on the map.
  polygonColor: (0, import_pg_core2.varchar)("polygon_color", { length: 7 }),
  // Outreach Post Configuration
  outreachLatitude: (0, import_pg_core2.decimal)("outreach_latitude", { precision: 10, scale: 7 }),
  outreachLongitude: (0, import_pg_core2.decimal)("outreach_longitude", { precision: 10, scale: 7 }),
  outreachPostName: (0, import_pg_core2.varchar)("outreach_post_name", { length: 255 }),
  // Focal Person / Social Mobilization details
  focalPersonName: (0, import_pg_core2.varchar)("focal_person_name", { length: 255 }),
  focalPersonPhone: (0, import_pg_core2.varchar)("focal_person_phone", { length: 50 }),
  focalPersonCommChecked: (0, import_pg_core2.boolean)("focal_person_comm_checked").default(false).notNull(),
  outsideFollowUpMade: (0, import_pg_core2.boolean)("outside_follow_up_made").default(false).notNull(),
  // Cross-border and crossing point details
  isCrossBorder: (0, import_pg_core2.boolean)("is_cross_border").default(false).notNull(),
  borderCountry: (0, import_pg_core2.varchar)("border_country", { length: 100 }),
  isCrossingPoint: (0, import_pg_core2.boolean)("is_crossing_point").default(false).notNull(),
  crossingType: (0, import_pg_core2.varchar)("crossing_type", { length: 50 }),
  // 'formal' | 'informal'
  dailyMovementVolume: (0, import_pg_core2.integer)("daily_movement_volume"),
  // Sheet 1.1 — Border village inter-country coordination
  // Which country is responsible for vaccinating this border village?
  borderVillageCountry: (0, import_pg_core2.varchar)("border_village_country", { length: 100 }),
  // Which health facility across the border is the responsible counterpart?
  borderVillageFacilityName: (0, import_pg_core2.varchar)("border_village_facility_name", { length: 255 }),
  // Sheet 1.0 — Settlement classification (15 types)
  // Values: village | estate | market | transport_station | school | church | mosque |
  //         temple | seasonal | nomadic | pastoral | border_village | high_risk |
  //         hard_to_reach | crossing_point
  settlementType: (0, import_pg_core2.varchar)("settlement_type", { length: 50 }).default("village"),
  // Sheet 1.0 — High-risk classification
  highRisk: (0, import_pg_core2.boolean)("high_risk").default(false).notNull(),
  highRiskReason: (0, import_pg_core2.varchar)("high_risk_reason", { length: 255 }),
  // border, informal_settlement, mobile_pop, outbreak_area
  // Sheet 1.0 — Direct population capture per settlement
  // (Supplements populationData table which holds historical multi-source records)
  totalCatchmentPopulation: (0, import_pg_core2.integer)("total_catchment_population"),
  under5Population: (0, import_pg_core2.integer)("under5_population"),
  // VGIE Spatial Intelligence fields
  confidenceScore: (0, import_pg_core2.decimal)("confidence_score", { precision: 5, scale: 2 }),
  detectionSource: (0, import_pg_core2.varchar)("detection_source", { length: 50 }),
  isMappedInHmis: (0, import_pg_core2.boolean)("is_mapped_in_hmis").default(false),
  lastVerified: (0, import_pg_core2.timestamp)("last_verified"),
  linkedSettlementId: (0, import_pg_core2.integer)("linked_settlement_id"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => [
  (0, import_pg_core2.index)("idx_villages_tenant").on(table.tenantId),
  (0, import_pg_core2.index)("idx_villages_district").on(table.districtId),
  (0, import_pg_core2.index)("idx_villages_facility").on(table.assignedFacilityId),
  (0, import_pg_core2.index)("idx_villages_name").on(table.name)
]);
var catchmentConflicts = (0, import_pg_core2.pgTable)("catchment_conflicts", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  villageId: (0, import_pg_core2.integer)("village_id").notNull().references(() => villages.id, { onDelete: "cascade" }),
  conflictingVillageId: (0, import_pg_core2.integer)("conflicting_village_id").notNull().references(() => villages.id, { onDelete: "cascade" }),
  conflictingFacilityId: (0, import_pg_core2.integer)("conflicting_facility_id").references(() => facilities.id, { onDelete: "set null" }),
  overlapPct: (0, import_pg_core2.decimal)("overlap_pct", { precision: 6, scale: 2 }),
  status: (0, import_pg_core2.varchar)("status", { length: 20 }).notNull().default("open"),
  requestedByUserId: (0, import_pg_core2.varchar)("requested_by_user_id"),
  note: (0, import_pg_core2.text)("note"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  resolvedAt: (0, import_pg_core2.timestamp)("resolved_at")
}, (table) => [(0, import_pg_core2.index)("idx_catchment_conflicts_tenant").on(table.tenantId)]);
var vgieSettlementFacilityLinks = (0, import_pg_core2.pgTable)("vgie_settlement_facility_links", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  villageId: (0, import_pg_core2.integer)("village_id").notNull().references(() => villages.id, { onDelete: "cascade" }),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
  linkageType: (0, import_pg_core2.varchar)("linkage_type", { length: 50 }).notNull(),
  // primary, secondary, outreach
  travelTimeMins: (0, import_pg_core2.integer)("travel_time_mins"),
  transportMode: (0, import_pg_core2.varchar)("transport_mode", { length: 50 }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
});
var vgieRecommendations = (0, import_pg_core2.pgTable)("vgie_recommendations", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  entityType: (0, import_pg_core2.varchar)("entity_type", { length: 50 }).notNull(),
  // settlement, facility, session
  entityId: (0, import_pg_core2.integer)("entity_id").notNull(),
  recommendationType: (0, import_pg_core2.varchar)("recommendation_type", { length: 100 }).notNull(),
  // e.g. add_outreach, realign_catchment, assign_chw
  priority: (0, import_pg_core2.varchar)("priority", { length: 20 }).notNull(),
  // high, medium, low
  title: (0, import_pg_core2.varchar)("title", { length: 255 }).notNull(),
  description: (0, import_pg_core2.text)("description"),
  reasoning: (0, import_pg_core2.jsonb)("reasoning"),
  // JSON block explaining why the AI suggested this
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).notNull().default("pending"),
  // pending, accepted, rejected, implemented
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
});
var vgieAlerts = (0, import_pg_core2.pgTable)("vgie_alerts", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  locationGeom: (0, import_pg_core2.jsonb)("location_geom"),
  // Point or Polygon GeoJSON
  alertType: (0, import_pg_core2.varchar)("alert_type", { length: 100 }).notNull(),
  // flood, population_displacement, disease_outbreak
  severity: (0, import_pg_core2.varchar)("severity", { length: 50 }).notNull(),
  title: (0, import_pg_core2.varchar)("title", { length: 255 }).notNull(),
  message: (0, import_pg_core2.text)("message"),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).notNull().default("active"),
  // active, resolved
  villageId: (0, import_pg_core2.integer)("village_id").references(() => villages.id, { onDelete: "cascade" }),
  facilityId: (0, import_pg_core2.integer)("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
});
var facilityExcludedVillages = (0, import_pg_core2.pgTable)("facility_excluded_villages", {
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
  villageId: (0, import_pg_core2.integer)("village_id").notNull().references(() => villages.id, { onDelete: "cascade" }),
  removedByUserId: (0, import_pg_core2.varchar)("removed_by_user_id"),
  reason: (0, import_pg_core2.text)("reason"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => [
  (0, import_pg_core2.unique)("facility_excluded_villages_pk").on(table.tenantId, table.facilityId, table.villageId),
  (0, import_pg_core2.index)("idx_facility_excluded_villages_facility").on(table.tenantId, table.facilityId)
]);
var populationData = (0, import_pg_core2.pgTable)("population_data", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  provinceId: (0, import_pg_core2.integer)("province_id").references(() => provinces.id),
  districtId: (0, import_pg_core2.integer)("district_id").references(() => districts.id),
  villageId: (0, import_pg_core2.integer)("village_id").references(() => villages.id),
  facilityId: (0, import_pg_core2.integer)("facility_id").references(() => facilities.id),
  source: populationSourceEnum("source").notNull(),
  year: (0, import_pg_core2.integer)("year").notNull(),
  totalPopulation: (0, import_pg_core2.integer)("total_population").notNull(),
  malePopulation: (0, import_pg_core2.integer)("male_population"),
  femalePopulation: (0, import_pg_core2.integer)("female_population"),
  under1Population: (0, import_pg_core2.integer)("under_1_population"),
  under5Population: (0, import_pg_core2.integer)("under_5_population"),
  pregnantWomen: (0, import_pg_core2.integer)("pregnant_women"),
  schoolEntry: (0, import_pg_core2.integer)("school_entry"),
  schoolExit: (0, import_pg_core2.integer)("school_exit"),
  growthRate: (0, import_pg_core2.decimal)("growth_rate", { precision: 5, scale: 2 }),
  confidenceScore: (0, import_pg_core2.decimal)("confidence_score", { precision: 5, scale: 2 }),
  metadata: (0, import_pg_core2.jsonb)("metadata"),
  approvalStatus: approvalStatusEnum("approval_status").default("draft"),
  createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedByUserId: (0, import_pg_core2.varchar)("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedByUserId: (0, import_pg_core2.varchar)("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => [
  (0, import_pg_core2.index)("idx_population_tenant").on(table.tenantId),
  (0, import_pg_core2.uniqueIndex)("uq_pop_village_year_source").on(table.tenantId, table.villageId, table.year, table.source).where(import_drizzle_orm2.sql`${table.villageId} IS NOT NULL`),
  (0, import_pg_core2.uniqueIndex)("uq_pop_facility_year_source").on(table.tenantId, table.facilityId, table.year, table.source).where(import_drizzle_orm2.sql`${table.villageId} IS NULL AND ${table.facilityId} IS NOT NULL`),
  (0, import_pg_core2.uniqueIndex)("uq_pop_district_year_source").on(table.tenantId, table.districtId, table.year, table.source).where(import_drizzle_orm2.sql`${table.villageId} IS NULL AND ${table.facilityId} IS NULL AND ${table.districtId} IS NOT NULL`),
  (0, import_pg_core2.uniqueIndex)("uq_pop_province_year_source").on(table.tenantId, table.provinceId, table.year, table.source).where(import_drizzle_orm2.sql`${table.villageId} IS NULL AND ${table.facilityId} IS NULL AND ${table.districtId} IS NULL AND ${table.provinceId} IS NOT NULL`),
  (0, import_pg_core2.uniqueIndex)("uq_pop_national_year_source").on(table.tenantId, table.year, table.source).where(import_drizzle_orm2.sql`${table.villageId} IS NULL AND ${table.facilityId} IS NULL AND ${table.districtId} IS NULL AND ${table.provinceId} IS NULL`)
]);
var microplanTypeEnum = (0, import_pg_core2.pgEnum)("microplan_type", [
  "facility_routine",
  "sia_campaign"
]);
var sessionPlanTypeEnum = (0, import_pg_core2.pgEnum)("session_plan_type", [
  "routine",
  "campaign"
]);
var microplans = (0, import_pg_core2.pgTable)("microplans", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  facilityId: (0, import_pg_core2.integer)("facility_id").references(() => facilities.id),
  // Nullable for high-level SIA
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  planType: microplanTypeEnum("plan_type").notNull().default("facility_routine"),
  year: (0, import_pg_core2.integer)("year").notNull(),
  quarter: (0, import_pg_core2.integer)("quarter").notNull(),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("draft"),
  // draft, pending, approved, locked, auto_approved
  // SIA Campaign specific fields:
  campaignAntigen: (0, import_pg_core2.varchar)("campaign_antigen", { length: 100 }),
  campaignTargetAge: (0, import_pg_core2.varchar)("campaign_target_age", { length: 100 }),
  campaignScope: (0, import_pg_core2.varchar)("campaign_scope", { length: 100 }),
  // National, Sub-national, Targeted
  // When campaignScope is "Sub-national" or "Targeted", this stores the selected
  // geographic scope: { provinceIds: number[], districtIds: number[], facilityIds: number[] }
  campaignScopeDetails: (0, import_pg_core2.jsonb)("campaign_scope_details").$type(),
  targetPopulation: (0, import_pg_core2.integer)("target_population"),
  budget: (0, import_pg_core2.decimal)("budget", { precision: 12, scale: 2 }),
  // Structured staffing roster (WHO/UNICEF microplanning element 6 - Human Resources).
  // Array of { role, headcount, days, perDiem } rows. Free-form jsonb to keep the
  // schema flexible while the UI iterates.
  staffing: (0, import_pg_core2.jsonb)("staffing").default([]),
  // Notification and Auto-Approval tracking
  submittedAt: (0, import_pg_core2.timestamp)("submitted_at"),
  autoApproveAt: (0, import_pg_core2.timestamp)("auto_approve_at"),
  reminderSentAt: (0, import_pg_core2.timestamp)("reminder_sent_at"),
  districtEditReason: (0, import_pg_core2.text)("district_edit_reason"),
  createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedByUserId: (0, import_pg_core2.varchar)("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedByUserId: (0, import_pg_core2.varchar)("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => [(0, import_pg_core2.index)("idx_microplans_tenant").on(table.tenantId)]);
var microplanVersions = (0, import_pg_core2.pgTable)("microplan_versions", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  microplanId: (0, import_pg_core2.integer)("microplan_id").notNull().references(() => microplans.id, { onDelete: "cascade" }),
  versionNumber: (0, import_pg_core2.integer)("version_number").notNull(),
  versionLabel: (0, import_pg_core2.varchar)("version_label", { length: 50 }).notNull(),
  eventType: (0, import_pg_core2.varchar)("event_type", { length: 50 }).notNull(),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).notNull(),
  reason: (0, import_pg_core2.text)("reason"),
  snapshot: (0, import_pg_core2.jsonb)("snapshot").notNull(),
  createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").notNull().defaultNow()
}, (table) => [
  (0, import_pg_core2.index)("idx_microplan_versions_tenant_plan").on(table.tenantId, table.microplanId),
  (0, import_pg_core2.unique)("uq_microplan_versions_plan_number").on(table.microplanId, table.versionNumber)
]);
var sessionPlans = (0, import_pg_core2.pgTable)("session_plans", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id),
  // Every session MUST belong to a parent microplan. Enforced by server validation
  // (POST/PATCH /api/sessions verify parent exists, same tenant, matching planType,
  // and parent is not locked).
  microplanId: (0, import_pg_core2.integer)("microplan_id").notNull().references(() => microplans.id, { onDelete: "cascade" }),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  sessionType: sessionTypeEnum("session_type").notNull(),
  quarter: (0, import_pg_core2.integer)("quarter").notNull(),
  year: (0, import_pg_core2.integer)("year").notNull(),
  scheduledDate: (0, import_pg_core2.timestamp)("scheduled_date"),
  transportMode: transportModeEnum("transport_mode"),
  estimatedDuration: (0, import_pg_core2.integer)("estimated_duration"),
  targetPopulation: (0, import_pg_core2.integer)("target_population"),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("planned"),
  approvalStatus: approvalStatusEnum("approval_status").default("draft"),
  notes: (0, import_pg_core2.text)("notes"),
  humanResources: (0, import_pg_core2.text)("human_resources"),
  keyStakeholders: (0, import_pg_core2.text)("key_stakeholders"),
  vaccineAdjustments: (0, import_pg_core2.jsonb)("vaccine_adjustments").default({}),
  // Strict enum, copied from parent microplan at write-time. Never set directly by clients.
  planType: sessionPlanTypeEnum("plan_type").notNull().default("routine"),
  // @deprecated — these mirror the parent microplan's campaign fields. Server copies
  // them on create from the parent and rejects client-supplied values. Kept on the row
  // for read-time convenience and to avoid breaking offline clients.
  campaignAntigen: (0, import_pg_core2.varchar)("campaign_antigen", { length: 100 }),
  campaignTargetAge: (0, import_pg_core2.varchar)("campaign_target_age", { length: 100 }),
  campaignScope: (0, import_pg_core2.varchar)("campaign_scope", { length: 100 }),
  teamType: (0, import_pg_core2.varchar)("team_type", { length: 100 }),
  geojson: (0, import_pg_core2.jsonb)("geojson"),
  // Georeferenced custom geofence plotted by the health worker
  isAchieved: (0, import_pg_core2.boolean)("is_achieved").default(false).notNull(),
  // real-time map checklist progress tracking
  // Outreach intent — set automatically when a session is created from a map
  // prefill (e.g. the "Plan defaulter follow-up here" button on the zero-dose /
  // under-immunized pins). Persisting an explicit purpose keeps the signal
  // alive even if a planner renames the session, so downstream views can
  // filter and badge defaulter follow-ups reliably. Null for sessions created
  // through the normal flow.
  outreachPurpose: (0, import_pg_core2.varchar)("outreach_purpose", { length: 32 }),
  // Completion tracking — set when the facility marks the session done. Drives the
  // 1-month auto-archive from the live map and powers the Session History view.
  completedAt: (0, import_pg_core2.timestamp)("completed_at"),
  // Per-antigen vaccinated counts captured at mark-done time. Shape:
  //   { totals: number, perAntigen: Record<string, number>, actualDate?: string, note?: string }
  vaccinatedCounts: (0, import_pg_core2.jsonb)("vaccinated_counts"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => [
  (0, import_pg_core2.index)("idx_session_plans_tenant").on(table.tenantId),
  (0, import_pg_core2.index)("idx_session_plans_microplan").on(table.microplanId),
  (0, import_pg_core2.index)("idx_session_plans_completed_at").on(table.completedAt)
]);
var sessionVillages = (0, import_pg_core2.pgTable)("session_villages", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  sessionId: (0, import_pg_core2.integer)("session_id").notNull().references(() => sessionPlans.id, { onDelete: "cascade" }),
  villageId: (0, import_pg_core2.integer)("village_id").notNull().references(() => villages.id),
  orderIndex: (0, import_pg_core2.integer)("order_index")
}, (table) => [(0, import_pg_core2.index)("idx_session_villages_tenant").on(table.tenantId)]);
var fundingSourceEnum = (0, import_pg_core2.pgEnum)("funding_source", [
  "government",
  "gavi",
  "who",
  "unicef",
  "other",
  "unspecified"
]);
var budgetItems = (0, import_pg_core2.pgTable)("budget_items", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id),
  sessionId: (0, import_pg_core2.integer)("session_id").references(() => sessionPlans.id, { onDelete: "cascade" }),
  category: (0, import_pg_core2.varchar)("category", { length: 100 }).notNull(),
  description: (0, import_pg_core2.varchar)("description", { length: 255 }).notNull(),
  unitCost: (0, import_pg_core2.decimal)("unit_cost", { precision: 12, scale: 2 }).notNull(),
  quantity: (0, import_pg_core2.integer)("quantity").notNull(),
  totalCost: (0, import_pg_core2.decimal)("total_cost", { precision: 12, scale: 2 }).notNull(),
  quarter: (0, import_pg_core2.integer)("quarter").notNull(),
  year: (0, import_pg_core2.integer)("year").notNull(),
  approvalStatus: approvalStatusEnum("approval_status").default("draft"),
  // Funding source classification (Gavi HSS reporting). Legacy rows default to
  // 'unspecified' and surface a "needs classification" hint in the UI.
  fundingSource: fundingSourceEnum("funding_source").notNull().default("unspecified"),
  // Free-text descriptor used when `fundingSource === 'other'`.
  fundingSourceOther: (0, import_pg_core2.varchar)("funding_source_other", { length: 255 }),
  // Provenance of this budget line. 'manual' for hand-entered rows,
  // 'roster_sync' for lines auto-created by the microplan roster sync
  // (Sync to Budget action / per-day Personnel snapshot). Lets reviewers
  // tell auto-computed lines apart from typed ones at a glance.
  source: (0, import_pg_core2.varchar)("source", { length: 32 }).notNull().default("manual"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => [(0, import_pg_core2.index)("idx_budget_items_tenant").on(table.tenantId)]);
var vaccineRequirements = (0, import_pg_core2.pgTable)("vaccine_requirements", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id),
  vaccineName: (0, import_pg_core2.varchar)("vaccine_name", { length: 100 }).notNull(),
  targetPopulation: (0, import_pg_core2.integer)("target_population").notNull(),
  dosesRequired: (0, import_pg_core2.integer)("doses_required").notNull(),
  wastageRate: (0, import_pg_core2.decimal)("wastage_rate", { precision: 5, scale: 2 }).notNull(),
  dosesWithWastage: (0, import_pg_core2.integer)("doses_with_wastage").notNull(),
  vialsRequired: (0, import_pg_core2.integer)("vials_required").notNull(),
  quarter: (0, import_pg_core2.integer)("quarter").notNull(),
  year: (0, import_pg_core2.integer)("year").notNull(),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => [(0, import_pg_core2.index)("idx_vaccine_req_tenant").on(table.tenantId)]);
var mobilizationActivities = (0, import_pg_core2.pgTable)("mobilization_activities", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id),
  activityType: (0, import_pg_core2.varchar)("activity_type", { length: 100 }).notNull(),
  description: (0, import_pg_core2.text)("description"),
  targetAudience: (0, import_pg_core2.varchar)("target_audience", { length: 100 }),
  scheduledDate: (0, import_pg_core2.timestamp)("scheduled_date"),
  estimatedAttendance: (0, import_pg_core2.integer)("estimated_attendance"),
  materialsNeeded: (0, import_pg_core2.jsonb)("materials_needed"),
  budgetAllocation: (0, import_pg_core2.decimal)("budget_allocation", { precision: 12, scale: 2 }),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("planned"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => [(0, import_pg_core2.index)("idx_mobilization_tenant").on(table.tenantId)]);
var approvalRequests = (0, import_pg_core2.pgTable)("approval_requests", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  entityType: (0, import_pg_core2.varchar)("entity_type", { length: 50 }).notNull(),
  entityId: (0, import_pg_core2.integer)("entity_id").notNull(),
  requestedById: (0, import_pg_core2.varchar)("requested_by_id").notNull().references(() => users.id),
  currentLevel: (0, import_pg_core2.varchar)("current_level", { length: 50 }).notNull(),
  status: approvalStatusEnum("status").default("pending"),
  comments: (0, import_pg_core2.text)("comments"),
  submittedAt: (0, import_pg_core2.timestamp)("submitted_at").defaultNow(),
  resolvedAt: (0, import_pg_core2.timestamp)("resolved_at"),
  resolvedById: (0, import_pg_core2.varchar)("resolved_by_id").references(() => users.id)
}, (table) => [(0, import_pg_core2.index)("idx_approval_req_tenant").on(table.tenantId)]);
var populationRefreshJobs = (0, import_pg_core2.pgTable)(
  "population_refresh_jobs",
  {
    id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    triggeredBy: populationRefreshTriggerEnum("triggered_by").notNull(),
    triggeredByUserId: (0, import_pg_core2.varchar)("triggered_by_user_id"),
    rasterPath: (0, import_pg_core2.varchar)("raster_path", { length: 500 }).notNull(),
    minPopulation: (0, import_pg_core2.integer)("min_population").notNull(),
    status: populationRefreshStatusEnum("status").notNull().default("pending"),
    startedAt: (0, import_pg_core2.timestamp)("started_at").defaultNow(),
    completedAt: (0, import_pg_core2.timestamp)("completed_at"),
    rowsInserted: (0, import_pg_core2.integer)("rows_inserted"),
    cellsScanned: (0, import_pg_core2.integer)("cells_scanned"),
    cellsAboveThreshold: (0, import_pg_core2.integer)("cells_above_threshold"),
    durationMs: (0, import_pg_core2.integer)("duration_ms"),
    errorMessage: (0, import_pg_core2.text)("error_message"),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
  },
  (table) => [
    (0, import_pg_core2.index)("idx_pop_refresh_tenant_started").on(table.tenantId, table.startedAt),
    (0, import_pg_core2.index)("idx_pop_refresh_status").on(table.status)
  ]
);
var auditLogs = (0, import_pg_core2.pgTable)("audit_logs", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  userId: (0, import_pg_core2.varchar)("user_id").references(() => users.id),
  action: (0, import_pg_core2.varchar)("action", { length: 100 }).notNull(),
  entityType: (0, import_pg_core2.varchar)("entity_type", { length: 50 }),
  entityId: (0, import_pg_core2.integer)("entity_id"),
  oldValue: (0, import_pg_core2.jsonb)("old_value"),
  newValue: (0, import_pg_core2.jsonb)("new_value"),
  ipAddress: (0, import_pg_core2.varchar)("ip_address", { length: 50 }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => [(0, import_pg_core2.index)("idx_audit_logs_tenant").on(table.tenantId)]);
var pageViews = (0, import_pg_core2.pgTable)("page_views", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  userId: (0, import_pg_core2.varchar)("user_id").references(() => users.id),
  path: (0, import_pg_core2.varchar)("path", { length: 300 }).notNull(),
  ipAddress: (0, import_pg_core2.varchar)("ip_address", { length: 100 }),
  country: (0, import_pg_core2.varchar)("country", { length: 120 }),
  region: (0, import_pg_core2.varchar)("region", { length: 120 }),
  city: (0, import_pg_core2.varchar)("city", { length: 120 }),
  latitude: (0, import_pg_core2.decimal)("latitude", { precision: 10, scale: 6 }),
  longitude: (0, import_pg_core2.decimal)("longitude", { precision: 10, scale: 6 }),
  userAgent: (0, import_pg_core2.varchar)("user_agent", { length: 400 }),
  createdAt: (0, import_pg_core2.timestamp)("created_at", { withTimezone: true }).defaultNow(),
  // Presence freshness, kept separate from createdAt so heartbeats can mark a
  // user "still here" without mutating the immutable event time that visit/
  // trend/top-page analytics are aggregated on.
  lastSeenAt: (0, import_pg_core2.timestamp)("last_seen_at", { withTimezone: true })
}, (table) => [
  (0, import_pg_core2.index)("idx_page_views_tenant_created").on(table.tenantId, table.createdAt),
  (0, import_pg_core2.index)("idx_page_views_tenant_user").on(table.tenantId, table.userId),
  (0, import_pg_core2.index)("idx_page_views_tenant_last_seen").on(table.tenantId, table.lastSeenAt)
]);
var htrScores = (0, import_pg_core2.pgTable)("htr_scores", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  villageId: (0, import_pg_core2.integer)("village_id").notNull().references(() => villages.id),
  distanceScore: (0, import_pg_core2.integer)("distance_score"),
  terrainScore: (0, import_pg_core2.integer)("terrain_score"),
  seasonalScore: (0, import_pg_core2.integer)("seasonal_score"),
  coverageScore: (0, import_pg_core2.integer)("coverage_score"),
  insecurityScore: (0, import_pg_core2.integer)("insecurity_score"),
  compositeScore: (0, import_pg_core2.integer)("composite_score"),
  interventionPriority: (0, import_pg_core2.varchar)("intervention_priority", { length: 50 }),
  comments: (0, import_pg_core2.text)("comments"),
  calculatedAt: (0, import_pg_core2.timestamp)("calculated_at").defaultNow()
}, (table) => [(0, import_pg_core2.index)("idx_htr_scores_tenant").on(table.tenantId)]);
var hfcCommitteeMembers = (0, import_pg_core2.pgTable)(
  "hfc_committee_members",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    memberName: (0, import_pg_core2.varchar)("member_name", { length: 255 }).notNull(),
    gender: (0, import_pg_core2.varchar)("gender", { length: 20 }).notNull().default("female"),
    position: (0, import_pg_core2.varchar)("position", { length: 100 }).notNull().default("Member"),
    yearsOfService: (0, import_pg_core2.integer)("years_of_service"),
    isChairperson: (0, import_pg_core2.boolean)("is_chairperson").default(false).notNull(),
    contactPhone: (0, import_pg_core2.varchar)("contact_phone", { length: 50 }),
    committeeEstablishedDate: (0, import_pg_core2.timestamp)("committee_established_date"),
    isActive: (0, import_pg_core2.boolean)("is_active").default(true).notNull(),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
  },
  (table) => [
    (0, import_pg_core2.index)("idx_hfc_members_facility").on(table.tenantId, table.facilityId)
  ]
);
var chvProfiles = (0, import_pg_core2.pgTable)(
  "chv_profiles",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    assignedVillageId: (0, import_pg_core2.integer)("assigned_village_id").references(() => villages.id, { onDelete: "set null" }),
    fullName: (0, import_pg_core2.varchar)("full_name", { length: 255 }).notNull(),
    nrc: (0, import_pg_core2.varchar)("nrc", { length: 50 }).notNull(),
    gender: (0, import_pg_core2.varchar)("gender", { length: 20 }).notNull().default("female"),
    age: (0, import_pg_core2.integer)("age"),
    educationLevel: (0, import_pg_core2.varchar)("education_level", { length: 50 }).default("primary"),
    trainingReceived: (0, import_pg_core2.text)("training_received"),
    roleDescription: (0, import_pg_core2.text)("role_description"),
    contactPhone: (0, import_pg_core2.varchar)("contact_phone", { length: 50 }),
    yearsOfService: (0, import_pg_core2.integer)("years_of_service"),
    // SIA campaign role: vaccinator | mobilizer | volunteer | supervisor
    siaRole: (0, import_pg_core2.varchar)("sia_role", { length: 50 }).default("mobilizer"),
    isActive: (0, import_pg_core2.boolean)("is_active").default(true).notNull(),
    employmentStatus: (0, import_pg_core2.varchar)("employment_status", { length: 50 }).default("Active - In-service"),
    supervisorId: (0, import_pg_core2.integer)("supervisor_id").references(() => facilityStaff.id, { onDelete: "set null" }),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
  },
  (table) => [
    (0, import_pg_core2.index)("idx_chv_profiles_facility").on(table.tenantId, table.facilityId),
    (0, import_pg_core2.index)("idx_chv_profiles_village").on(table.assignedVillageId)
  ]
);
var facilityStaff = (0, import_pg_core2.pgTable)(
  "facility_staff",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    fullName: (0, import_pg_core2.varchar)("full_name", { length: 255 }).notNull(),
    name: (0, import_pg_core2.varchar)("name", { length: 255 }),
    employeeId: (0, import_pg_core2.varchar)("employee_id", { length: 100 }),
    nrc: (0, import_pg_core2.varchar)("nrc", { length: 100 }),
    history: (0, import_pg_core2.jsonb)("history").default([]),
    gender: (0, import_pg_core2.varchar)("gender", { length: 20 }).default("female"),
    position: (0, import_pg_core2.varchar)("position", { length: 100 }),
    contactPhone: (0, import_pg_core2.varchar)("contact_phone", { length: 50 }),
    phone: (0, import_pg_core2.varchar)("phone", { length: 50 }),
    yearsOfProfessionalExperience: (0, import_pg_core2.integer)("years_of_professional_experience"),
    yearsExperience: (0, import_pg_core2.integer)("years_experience"),
    yearsAtFacility: (0, import_pg_core2.integer)("years_at_facility"),
    role: (0, import_pg_core2.varchar)("role", { length: 100 }),
    campaignRole: (0, import_pg_core2.varchar)("campaign_role", { length: 100 }).default("vaccinator"),
    isActive: (0, import_pg_core2.boolean)("is_active").default(true).notNull(),
    active: (0, import_pg_core2.boolean)("active").default(true).notNull(),
    educationLevel: (0, import_pg_core2.varchar)("education_level", { length: 100 }),
    trainingStatus: (0, import_pg_core2.varchar)("training_status", { length: 100 }),
    residenceVillage: (0, import_pg_core2.varchar)("residence_village", { length: 255 }),
    isVolunteer: (0, import_pg_core2.boolean)("is_volunteer").default(false).notNull(),
    userId: (0, import_pg_core2.varchar)("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
  },
  (table) => [
    (0, import_pg_core2.index)("idx_facility_staff_facility").on(table.tenantId, table.facilityId),
    (0, import_pg_core2.index)("idx_facility_staff_user").on(table.userId)
  ]
);
var uncoveredCommunities = (0, import_pg_core2.pgTable)(
  "uncovered_communities",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    // If linked to a known village record
    villageId: (0, import_pg_core2.integer)("village_id").references(() => villages.id, { onDelete: "cascade" }),
    // For uncovered areas that don't map to a village yet (geometry-only gap)
    villageName: (0, import_pg_core2.varchar)("village_name", { length: 255 }),
    estimatedPopulation: (0, import_pg_core2.integer)("estimated_population"),
    // Which administrative level was notified
    flaggedLevel: (0, import_pg_core2.varchar)("flagged_level", { length: 30 }).default("district"),
    flaggedAt: (0, import_pg_core2.timestamp)("flagged_at").defaultNow(),
    resolvedAt: (0, import_pg_core2.timestamp)("resolved_at"),
    resolvedByUserId: (0, import_pg_core2.varchar)("resolved_by_user_id"),
    note: (0, import_pg_core2.text)("note")
  },
  (table) => [
    (0, import_pg_core2.index)("idx_uncovered_communities_facility").on(table.tenantId, table.facilityId),
    (0, import_pg_core2.index)("idx_uncovered_communities_resolved").on(table.resolvedAt)
  ]
);
var usersRelations = (0, import_drizzle_orm2.relations)(users, ({ one }) => ({
  facility: one(facilities, {
    fields: [users.facilityId],
    references: [facilities.id]
  }),
  district: one(districts, {
    fields: [users.districtId],
    references: [districts.id]
  }),
  province: one(provinces, {
    fields: [users.provinceId],
    references: [provinces.id]
  })
}));
var regionsRelations = (0, import_drizzle_orm2.relations)(regions, ({ many }) => ({
  provinces: many(provinces)
}));
var provincesRelations = (0, import_drizzle_orm2.relations)(provinces, ({ one, many }) => ({
  region: one(regions, {
    fields: [provinces.regionId],
    references: [regions.id]
  }),
  districts: many(districts)
}));
var districtsRelations = (0, import_drizzle_orm2.relations)(districts, ({ one, many }) => ({
  province: one(provinces, {
    fields: [districts.provinceId],
    references: [provinces.id]
  }),
  llgs: many(llgs),
  facilities: many(facilities),
  villages: many(villages)
}));
var llgsRelations = (0, import_drizzle_orm2.relations)(llgs, ({ one, many }) => ({
  district: one(districts, {
    fields: [llgs.districtId],
    references: [districts.id]
  }),
  villages: many(villages)
}));
var facilitiesRelations = (0, import_drizzle_orm2.relations)(facilities, ({ one, many }) => ({
  district: one(districts, {
    fields: [facilities.districtId],
    references: [districts.id]
  }),
  villages: many(villages),
  sessionPlans: many(sessionPlans),
  budgetItems: many(budgetItems),
  vaccineRequirements: many(vaccineRequirements),
  mobilizationActivities: many(mobilizationActivities)
}));
var villagesRelations = (0, import_drizzle_orm2.relations)(villages, ({ one, many }) => ({
  district: one(districts, {
    fields: [villages.districtId],
    references: [districts.id]
  }),
  llg: one(llgs, {
    fields: [villages.llgId],
    references: [llgs.id]
  }),
  assignedFacility: one(facilities, {
    fields: [villages.assignedFacilityId],
    references: [facilities.id]
  }),
  populationData: many(populationData),
  htrScores: many(htrScores)
}));
var microplansRelations = (0, import_drizzle_orm2.relations)(microplans, ({ one, many }) => ({
  tenant: one(tenants, { fields: [microplans.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [microplans.facilityId], references: [facilities.id] }),
  sessionPlans: many(sessionPlans),
  versions: many(microplanVersions)
}));
var microplanVersionsRelations = (0, import_drizzle_orm2.relations)(microplanVersions, ({ one }) => ({
  microplan: one(microplans, {
    fields: [microplanVersions.microplanId],
    references: [microplans.id]
  })
}));
var sessionPlansRelations = (0, import_drizzle_orm2.relations)(sessionPlans, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [sessionPlans.facilityId],
    references: [facilities.id]
  }),
  microplan: one(microplans, {
    fields: [sessionPlans.microplanId],
    references: [microplans.id]
  }),
  sessionVillages: many(sessionVillages)
}));
var sessionVillagesRelations = (0, import_drizzle_orm2.relations)(sessionVillages, ({ one }) => ({
  session: one(sessionPlans, {
    fields: [sessionVillages.sessionId],
    references: [sessionPlans.id]
  }),
  village: one(villages, {
    fields: [sessionVillages.villageId],
    references: [villages.id]
  })
}));
var insertTenantSchema = (0, import_drizzle_zod2.createInsertSchema)(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertTenantIdpConfigSchema = (0, import_drizzle_zod2.createInsertSchema)(tenantIdpConfigs).omit({
  id: true,
  createdAt: true
});
var SELF_SIGNUP_ROLES = [
  "facility_clerk",
  "facility_in_charge",
  "district_manager",
  "provincial_coordinator",
  "gis_specialist"
];
var insertSignupRequestSchema = (0, import_drizzle_zod2.createInsertSchema)(signupRequests).omit({
  id: true,
  status: true,
  approverUserId: true,
  decisionReason: true,
  decidedAt: true,
  createdAt: true
}).extend({
  requestedRole: import_zod.z.enum(SELF_SIGNUP_ROLES),
  email: import_zod.z.string().email().max(255),
  fullName: import_zod.z.string().min(2).max(255),
  justification: import_zod.z.string().max(2e3).optional().nullable()
});
var insertUserSchema = (0, import_drizzle_zod2.createInsertSchema)(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertUserRoleSchema = (0, import_drizzle_zod2.createInsertSchema)(userRoles).omit({
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
var insertUserPermissionSchema = (0, import_drizzle_zod2.createInsertSchema)(userPermissions).omit({
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
var insertRegionSchema = (0, import_drizzle_zod2.createInsertSchema)(regions).omit({
  createdAt: true
});
var insertProvinceSchema = (0, import_drizzle_zod2.createInsertSchema)(provinces).omit({
  createdAt: true
});
var insertDistrictSchema = (0, import_drizzle_zod2.createInsertSchema)(districts).omit({
  createdAt: true
});
var insertLlgSchema = (0, import_drizzle_zod2.createInsertSchema)(llgs).omit({
  createdAt: true
});
var insertFacilitySchema = (0, import_drizzle_zod2.createInsertSchema)(facilities).omit({
  createdAt: true,
  updatedAt: true
});
var insertVillageSchema = (0, import_drizzle_zod2.createInsertSchema)(villages).omit({
  createdAt: true,
  updatedAt: true
});
var insertPopulationDataSchema = (0, import_drizzle_zod2.createInsertSchema)(populationData).omit({
  createdAt: true,
  updatedAt: true
});
var insertMicroplanSchema = (0, import_drizzle_zod2.createInsertSchema)(microplans).omit({
  createdAt: true,
  updatedAt: true
});
var insertSessionPlanSchema = (0, import_drizzle_zod2.createInsertSchema)(sessionPlans).omit({
  createdAt: true,
  updatedAt: true,
  planType: true,
  campaignAntigen: true,
  campaignTargetAge: true,
  campaignScope: true
});
var insertBudgetItemSchema = (0, import_drizzle_zod2.createInsertSchema)(budgetItems).omit({
  createdAt: true
}).superRefine((data, ctx) => {
  if (!data.fundingSource || data.fundingSource === "unspecified") {
    ctx.addIssue({
      code: import_zod.z.ZodIssueCode.custom,
      path: ["fundingSource"],
      message: "Pick a funding source (Govt / Gavi / WHO / UNICEF / Other)."
    });
  }
  if (data.fundingSource === "other") {
    const v = (data.fundingSourceOther ?? "").toString().trim();
    if (!v) {
      ctx.addIssue({
        code: import_zod.z.ZodIssueCode.custom,
        path: ["fundingSourceOther"],
        message: "Specify the funding source when 'Other' is selected."
      });
    }
  }
}).transform((data) => ({
  ...data,
  // Normalize: drop any stale specify-text when source isn't 'other'.
  fundingSourceOther: data.fundingSource === "other" ? data.fundingSourceOther : null
}));
var insertVaccineRequirementSchema = (0, import_drizzle_zod2.createInsertSchema)(vaccineRequirements).omit({
  createdAt: true
});
var boundarySourceEnum = (0, import_pg_core2.pgEnum)("boundary_source", [
  "geoboundaries",
  "gadm",
  "ocha_hdx",
  "natural_earth",
  "custom"
]);
var adminBoundaries = (0, import_pg_core2.pgTable)("admin_boundaries", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  adminLevel: (0, import_pg_core2.integer)("admin_level").notNull(),
  // 0=country, 1=region, 2=province, 3=district, 4=ward, 5=village
  levelName: (0, import_pg_core2.varchar)("level_name", { length: 100 }).notNull(),
  // e.g. "Province", "District"
  source: boundarySourceEnum("source").default("geoboundaries").notNull(),
  countryCode: (0, import_pg_core2.varchar)("country_code", { length: 3 }).notNull(),
  // ISO-3166 Alpha-3
  featureCount: (0, import_pg_core2.integer)("feature_count").default(0),
  // Full GeoJSON FeatureCollection
  geojson: (0, import_pg_core2.jsonb)("geojson").notNull().default({}),
  // Bounding box [minLng, minLat, maxLng, maxLat]
  bbox: (0, import_pg_core2.jsonb)("bbox").default(null),
  isActive: (0, import_pg_core2.boolean)("is_active").default(true).notNull(),
  fetchedAt: (0, import_pg_core2.timestamp)("fetched_at").defaultNow(),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantLevelIdx: (0, import_pg_core2.index)("admin_boundaries_tenant_level_idx").on(table.tenantId, table.adminLevel),
  tenantCodeIdx: (0, import_pg_core2.index)("admin_boundaries_tenant_code_idx").on(table.tenantId, table.countryCode)
}));
var customLayerCategoryEnum = (0, import_pg_core2.pgEnum)("custom_layer_category", [
  "road_network",
  "travel_time",
  "schools",
  "health_features",
  "water",
  "terrain",
  "settlement",
  "other"
]);
var customLayerTypeEnum = (0, import_pg_core2.pgEnum)("custom_layer_type", [
  "vector",
  "raster"
]);
var customLayerFormatEnum = (0, import_pg_core2.pgEnum)("custom_layer_format", [
  "geojson",
  "shapefile",
  "csv",
  "geotiff"
]);
var customLayers = (0, import_pg_core2.pgTable)("custom_layers", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: (0, import_pg_core2.varchar)("name", { length: 200 }).notNull(),
  description: (0, import_pg_core2.text)("description"),
  category: customLayerCategoryEnum("category").default("other").notNull(),
  layerType: customLayerTypeEnum("layer_type").notNull(),
  format: customLayerFormatEnum("format").notNull(),
  // Vector layers store their GeoJSON FeatureCollection here.
  geojson: (0, import_pg_core2.jsonb)("geojson").default(null),
  featureCount: (0, import_pg_core2.integer)("feature_count").default(0),
  // Raster layers (GeoTIFF) store a server file path instead of inline geojson.
  filePath: (0, import_pg_core2.varchar)("file_path", { length: 500 }),
  fileSizeBytes: (0, import_pg_core2.integer)("file_size_bytes"),
  // Bounding box [minLng, minLat, maxLng, maxLat]
  bbox: (0, import_pg_core2.jsonb)("bbox").default(null),
  // Display styling for vector layers: { color, weight, fillOpacity, pointRadius }
  style: (0, import_pg_core2.jsonb)("style").default({}),
  // Tag so planning/calculation features can pull this layer in.
  usableInPlanning: (0, import_pg_core2.boolean)("usable_in_planning").default(false).notNull(),
  isActive: (0, import_pg_core2.boolean)("is_active").default(true).notNull(),
  uploadedByUserId: (0, import_pg_core2.varchar)("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("custom_layers_tenant_idx").on(table.tenantId),
  tenantCategoryIdx: (0, import_pg_core2.index)("custom_layers_tenant_category_idx").on(table.tenantId, table.category)
}));
var facilityCatchments = (0, import_pg_core2.pgTable)("facility_catchments", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
  drawnByUserId: (0, import_pg_core2.varchar)("drawn_by_user_id").references(() => users.id, { onDelete: "set null" }),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  description: (0, import_pg_core2.text)("description"),
  // GeoJSON Polygon or MultiPolygon
  geojson: (0, import_pg_core2.jsonb)("geojson").notNull(),
  // Calculated server-side using Turf.js area()
  areaSqKm: (0, import_pg_core2.decimal)("area_sq_km", { precision: 12, scale: 4 }),
  // Optional estimated population within catchment
  populationEstimate: (0, import_pg_core2.integer)("population_estimate"),
  // Is this the official/approved catchment for this facility?
  isOfficial: (0, import_pg_core2.boolean)("is_official").default(false).notNull(),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("facility_catchments_tenant_idx").on(table.tenantId),
  facilityIdx: (0, import_pg_core2.index)("facility_catchments_facility_idx").on(table.facilityId)
}));
var vaccineConfigurations = (0, import_pg_core2.pgTable)("vaccine_configurations", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: (0, import_pg_core2.varchar)("name", { length: 100 }).notNull(),
  targetGroup: (0, import_pg_core2.varchar)("target_group", { length: 50 }).notNull(),
  // 'under1', 'births', 'pregnant', 'schoolEntry'
  doses: (0, import_pg_core2.integer)("doses").notNull(),
  recommendedAge: (0, import_pg_core2.varchar)("recommended_age", { length: 100 }).notNull(),
  // e.g. "6, 10, 14 weeks"
  recommendedAgeWeeks: (0, import_pg_core2.integer)("recommended_age_weeks").notNull().default(0),
  // used for due list calculation
  wastageFactor: (0, import_pg_core2.decimal)("wastage_factor", { precision: 5, scale: 2 }).notNull(),
  // e.g. 11.00, 40.00
  vialsPerDose: (0, import_pg_core2.integer)("vials_per_dose").notNull(),
  // e.g. 10, 20
  isActive: (0, import_pg_core2.boolean)("is_active").default(true).notNull(),
  // WHO SMART Guidelines IMMZ alignment — standard codes for interoperability
  // with HL7 FHIR Immunization.vaccineCode (CVX) and WHO ATC drug codes.
  // Nullable until tenants run the backfill (/api/admin/vaccine-codes/backfill).
  cvxCode: (0, import_pg_core2.varchar)("cvx_code", { length: 16 }),
  whoAtcCode: (0, import_pg_core2.varchar)("who_atc_code", { length: 16 }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("vaccine_config_tenant_idx").on(table.tenantId)
}));
var clients = (0, import_pg_core2.pgTable)("clients", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
  villageId: (0, import_pg_core2.integer)("village_id").notNull().references(() => villages.id, { onDelete: "cascade" }),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  clientType: (0, import_pg_core2.varchar)("client_type", { length: 50 }).notNull(),
  // 'child', 'pregnant_woman'
  dateOfBirth: (0, import_pg_core2.timestamp)("date_of_birth").notNull(),
  gender: (0, import_pg_core2.varchar)("gender", { length: 20 }),
  // 'male', 'female'
  parentName: (0, import_pg_core2.varchar)("parent_name", { length: 255 }),
  // mother or father name for child
  contactPhone: (0, import_pg_core2.varchar)("contact_phone", { length: 50 }),
  catchmentStatus: (0, import_pg_core2.varchar)("catchment_status", { length: 50 }).notNull().default("catchment"),
  // 'catchment', 'non-catchment'
  contraindications: (0, import_pg_core2.jsonb)("contraindications").default([]).notNull(),
  // e.g. ["Penta: Severe Allergy"]
  refusalReason: (0, import_pg_core2.text)("refusal_reason"),
  // e.g. "Religious grounds" or "Fear of side effects"
  isRefusal: (0, import_pg_core2.boolean)("is_refusal").default(false).notNull(),
  // Cross-border registry columns:
  isCrossBorder: (0, import_pg_core2.boolean)("is_cross_border").default(false).notNull(),
  countryOfOrigin: (0, import_pg_core2.varchar)("country_of_origin", { length: 100 }),
  foreignResidence: (0, import_pg_core2.text)("foreign_residence"),
  borderPointOfEntry: (0, import_pg_core2.varchar)("border_point_of_entry", { length: 100 }),
  // UCE Communication Preferences
  whatsappAvailable: (0, import_pg_core2.boolean)("whatsapp_available").default(false).notNull(),
  hasApp: (0, import_pg_core2.boolean)("has_app").default(false).notNull(),
  email: (0, import_pg_core2.varchar)("email", { length: 255 }),
  preferredLanguage: (0, import_pg_core2.varchar)("preferred_language", { length: 50 }).default("en").notNull(),
  preferredChannel: (0, import_pg_core2.varchar)("preferred_channel", { length: 50 }),
  clientId: (0, import_pg_core2.varchar)("client_id", { length: 100 }),
  serialNumber: (0, import_pg_core2.integer)("serial_number"),
  registrationYear: (0, import_pg_core2.integer)("registration_year"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("clients_tenant_idx").on(table.tenantId),
  facilityIdx: (0, import_pg_core2.index)("clients_facility_idx").on(table.facilityId),
  villageIdx: (0, import_pg_core2.index)("clients_village_idx").on(table.villageId)
}));
var clientVaccinations = (0, import_pg_core2.pgTable)("client_vaccinations", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  clientId: (0, import_pg_core2.varchar)("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  vaccineConfigId: (0, import_pg_core2.integer)("vaccine_config_id").notNull().references(() => vaccineConfigurations.id, { onDelete: "cascade" }),
  vaccineName: (0, import_pg_core2.varchar)("vaccine_name", { length: 100 }).notNull(),
  // e.g. "Penta-1" or "BCG"
  administeredDate: (0, import_pg_core2.timestamp)("administered_date").notNull(),
  batchNumber: (0, import_pg_core2.varchar)("batch_number", { length: 100 }),
  expiryDate: (0, import_pg_core2.timestamp)("expiry_date"),
  vvmStatus: (0, import_pg_core2.integer)("vvm_status"),
  // 1, 2, 3, 4
  administeredByUserId: (0, import_pg_core2.varchar)("administered_by_user_id").references(() => users.id, { onDelete: "set null" }),
  scheduleDoseId: (0, import_pg_core2.integer)("schedule_dose_id"),
  stockTransactionId: (0, import_pg_core2.integer)("stock_transaction_id"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("client_vac_tenant_idx").on(table.tenantId),
  clientIdx: (0, import_pg_core2.index)("client_vac_client_idx").on(table.clientId)
}));
var sessionDayPlans = (0, import_pg_core2.pgTable)("session_day_plans", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sessionPlanId: (0, import_pg_core2.integer)("session_plan_id").notNull().references(() => sessionPlans.id, { onDelete: "cascade" }),
  dayNumber: (0, import_pg_core2.integer)("day_number").notNull(),
  // Day 1, Day 2...
  sessionDate: (0, import_pg_core2.timestamp)("session_date").notNull(),
  communitiesVisited: (0, import_pg_core2.jsonb)("communities_visited").default([]).notNull(),
  // Array of village IDs or village names
  targetPopulation: (0, import_pg_core2.integer)("target_population").notNull(),
  vaccinesRequired: (0, import_pg_core2.jsonb)("vaccines_required").default({}).notNull(),
  // map of vaccineConfigId -> count (doses)
  vitaminADoses: (0, import_pg_core2.integer)("vitamin_a_doses").default(0).notNull(),
  dewormingDoses: (0, import_pg_core2.integer)("deworming_doses").default(0).notNull(),
  vaccineCarriers: (0, import_pg_core2.integer)("vaccine_carriers").default(1).notNull(),
  icePacks: (0, import_pg_core2.integer)("ice_packs").default(4).notNull(),
  chalkSticks: (0, import_pg_core2.integer)("chalk_sticks").default(6).notNull(),
  tallySheets: (0, import_pg_core2.integer)("tally_sheets").default(2).notNull(),
  distanceKm: (0, import_pg_core2.decimal)("distance_km", { precision: 8, scale: 2 }),
  transportType: (0, import_pg_core2.varchar)("transport_type", { length: 50 }),
  // road, walking, boat, air
  fuelLiters: (0, import_pg_core2.decimal)("fuel_liters", { precision: 8, scale: 2 }).default("0.00").notNull(),
  actualVaccinated: (0, import_pg_core2.integer)("actual_vaccinated"),
  actualVialsUsed: (0, import_pg_core2.integer)("actual_vials_used"),
  actualVialsWasted: (0, import_pg_core2.integer)("actual_vials_wasted"),
  executionStatus: (0, import_pg_core2.varchar)("execution_status", { length: 50 }).default("planned"),
  executionNotes: (0, import_pg_core2.text)("execution_notes"),
  executedAt: (0, import_pg_core2.timestamp)("executed_at"),
  teamCount: (0, import_pg_core2.integer)("team_count").default(1),
  vaccinatorsCount: (0, import_pg_core2.integer)("vaccinators_count").default(1),
  volunteersCount: (0, import_pg_core2.integer)("volunteers_count").default(1),
  recordersCount: (0, import_pg_core2.integer)("recorders_count").default(0),
  supervisorsCount: (0, import_pg_core2.integer)("supervisors_count").default(0),
  // Named lead vaccinator for this session-day. Required by WHO core element 6
  // (Human Resources): every scheduled session-day must have a named accountable
  // vaccinator. Drives Step 5 ("Workforce & teaming") completion in the guided workflow.
  leadVaccinator: (0, import_pg_core2.varchar)("lead_vaccinator", { length: 255 }),
  indelibleMarkers: (0, import_pg_core2.integer)("indelible_markers").default(0),
  coldBoxes: (0, import_pg_core2.integer)("cold_boxes").default(0),
  // Sheet 3 — Vitamin A capsule types (per WHO SIA planning)
  // Blue capsules: 6-11 months (100,000 IU). Red capsules: 12-59 months (200,000 IU).
  vitaminABlueCaps: (0, import_pg_core2.integer)("vitamin_a_blue_caps").default(0).notNull(),
  vitaminARedCaps: (0, import_pg_core2.integer)("vitamin_a_red_caps").default(0).notNull(),
  // Sheet 3 — Scissors for OPV polio campaigns
  scissorsCount: (0, import_pg_core2.integer)("scissors_count").default(0).notNull(),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("session_day_tenant_idx").on(table.tenantId),
  sessionPlanIdx: (0, import_pg_core2.index)("session_day_plan_idx").on(table.sessionPlanId)
}));
var stockTransactions = (0, import_pg_core2.pgTable)("stock_transactions", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
  productId: (0, import_pg_core2.integer)("product_id").notNull(),
  // Links to catalogue vaccine ID or commodity ID (10000 + id)
  productCode: (0, import_pg_core2.varchar)("product_code", { length: 100 }),
  // snapshot of product code
  vaccineName: (0, import_pg_core2.varchar)("vaccine_name", { length: 100 }),
  // Legacy / Snapshot name
  transactionType: (0, import_pg_core2.varchar)("transaction_type", { length: 50 }).notNull(),
  // 'receipt', 'issue', 'loss', 'adjustment'
  quantityDoses: (0, import_pg_core2.integer)("quantity_doses").notNull(),
  batchNumber: (0, import_pg_core2.varchar)("batch_number", { length: 100 }).notNull(),
  expiryDate: (0, import_pg_core2.timestamp)("expiry_date").notNull(),
  vvmStatus: (0, import_pg_core2.integer)("vvm_status").notNull(),
  // 1, 2, 3, 4
  supplierOrRecipient: (0, import_pg_core2.varchar)("supplier_or_recipient", { length: 255 }),
  // e.g. "National Store" or "Outreach Team A"
  transactionDate: (0, import_pg_core2.timestamp)("transaction_date").defaultNow().notNull(),
  notes: (0, import_pg_core2.text)("notes"),
  recordedByUserId: (0, import_pg_core2.varchar)("recorded_by_user_id").references(() => users.id, { onDelete: "set null" }),
  balanceBefore: (0, import_pg_core2.integer)("balance_before"),
  balanceAfter: (0, import_pg_core2.integer)("balance_after"),
  sourceModule: (0, import_pg_core2.varchar)("source_module", { length: 100 }),
  sourceRecordId: (0, import_pg_core2.varchar)("source_record_id", { length: 100 }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("stock_txn_tenant_idx").on(table.tenantId),
  facilityIdx: (0, import_pg_core2.index)("stock_txn_facility_idx").on(table.facilityId)
}));
var monthlyReports = (0, import_pg_core2.pgTable)("monthly_reports", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
  month: (0, import_pg_core2.integer)("month").notNull(),
  // 1 - 12
  year: (0, import_pg_core2.integer)("year").notNull(),
  immunizations: (0, import_pg_core2.jsonb)("immunizations").default({}).notNull(),
  // map of antigen/dose -> count, e.g. { BCG: 50, "Penta-1": 45 }
  stockSummary: (0, import_pg_core2.jsonb)("stock_summary").default({}).notNull(),
  // map of vaccine -> stock details (opening, received, administered, wasted, closing, wastageRate)
  surveillance: (0, import_pg_core2.jsonb)("surveillance").default({}).notNull(),
  // cases count, e.g. { measles: 0, afp: 1, nnt: 0, aefi: 1 }
  submittedById: (0, import_pg_core2.varchar)("submitted_by_id").references(() => users.id, { onDelete: "set null" }),
  approvalStatus: approvalStatusEnum("approval_status").default("draft").notNull(),
  createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedByUserId: (0, import_pg_core2.varchar)("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedByUserId: (0, import_pg_core2.varchar)("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("monthly_rep_tenant_idx").on(table.tenantId),
  facilityIdx: (0, import_pg_core2.index)("monthly_rep_facility_idx").on(table.facilityId)
}));
var settlementsMaster = (0, import_pg_core2.pgTable)(
  "settlements_master",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
    placeType: (0, import_pg_core2.varchar)("place_type", { length: 100 }).notNull(),
    // village, hamlet, suburb, neighbourhood, locality, town
    latitude: (0, import_pg_core2.decimal)("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: (0, import_pg_core2.decimal)("longitude", { precision: 10, scale: 7 }).notNull(),
    geojson: (0, import_pg_core2.jsonb)("geojson").notNull().default({}),
    // GeoJSON Point geometry
    provinceName: (0, import_pg_core2.varchar)("province_name", { length: 100 }),
    districtName: (0, import_pg_core2.varchar)("district_name", { length: 100 }),
    constituencyName: (0, import_pg_core2.varchar)("constituency_name", { length: 100 }),
    wardName: (0, import_pg_core2.varchar)("ward_name", { length: 100 }),
    healthCatchment: (0, import_pg_core2.varchar)("health_catchment", { length: 255 }),
    // linked health catchment area
    populationEstimate: (0, import_pg_core2.integer)("population_estimate").default(0).notNull(),
    under5Population: (0, import_pg_core2.integer)("under5_population").default(0).notNull(),
    buildingCount: (0, import_pg_core2.integer)("building_count").default(0).notNull(),
    source: (0, import_pg_core2.varchar)("source", { length: 100 }).default("osm").notNull(),
    // osm, grid3, manual_input
    sourceConfidence: (0, import_pg_core2.decimal)("source_confidence", { precision: 5, scale: 2 }).default("0.90").notNull(),
    nearestHealthFacility: (0, import_pg_core2.varchar)("nearest_health_facility", { length: 255 }),
    distanceToFacilityKm: (0, import_pg_core2.decimal)("distance_to_facility_km", { precision: 8, scale: 2 }),
    estimatedTravelTime: (0, import_pg_core2.integer)("estimated_travel_time"),
    // minutes
    accessibilityScore: (0, import_pg_core2.decimal)("accessibility_score", { precision: 5, scale: 2 }),
    // 1.0 to 4.0
    hardToReach: (0, import_pg_core2.boolean)("hard_to_reach").default(false).notNull(),
    validationStatus: (0, import_pg_core2.varchar)("validation_status", { length: 50 }).default("approved").notNull(),
    // approved, pending, needs_review, duplicate
    // Additive columns for Settlements GIS upgrade
    provinceId: (0, import_pg_core2.integer)("province_id"),
    districtId: (0, import_pg_core2.integer)("district_id"),
    linkedCommunityId: (0, import_pg_core2.integer)("linked_community_id"),
    linkedFacilityId: (0, import_pg_core2.integer)("linked_facility_id"),
    nearestFacilityId: (0, import_pg_core2.integer)("nearest_facility_id"),
    distanceToLinkedFacilityKm: (0, import_pg_core2.decimal)("distance_to_linked_facility_km", { precision: 8, scale: 2 }),
    estimatedWalkingTimeMinutes: (0, import_pg_core2.integer)("estimated_walking_time_minutes"),
    estimatedDrivingTimeMinutes: (0, import_pg_core2.integer)("estimated_driving_time_minutes"),
    travelModePlanning: (0, import_pg_core2.varchar)("travel_mode_planning", { length: 50 }),
    drySeasonTravelTimeMinutes: (0, import_pg_core2.integer)("dry_season_travel_time_minutes"),
    rainySeasonTravelTimeMinutes: (0, import_pg_core2.integer)("rainy_season_travel_time_minutes"),
    linkStatus: (0, import_pg_core2.varchar)("link_status", { length: 50 }).default("unassigned"),
    linkMethod: (0, import_pg_core2.varchar)("link_method", { length: 50 }),
    linkConfidence: (0, import_pg_core2.decimal)("link_confidence", { precision: 5, scale: 2 }),
    linkNotes: (0, import_pg_core2.text)("link_notes"),
    serviceStatus: (0, import_pg_core2.varchar)("service_status", { length: 50 }).default("unserved"),
    riskLevel: (0, import_pg_core2.varchar)("risk_level", { length: 50 }).default("low"),
    isActive: (0, import_pg_core2.boolean)("is_active").default(true),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
  },
  (table) => ({
    tenantIdx: (0, import_pg_core2.index)("idx_settlements_tenant").on(table.tenantId),
    adminSearchIdx: (0, import_pg_core2.index)("idx_settlements_admin").on(table.tenantId, table.provinceName, table.districtName, table.wardName),
    statusIdx: (0, import_pg_core2.index)("idx_settlements_status").on(table.tenantId, table.validationStatus)
  })
);
var populationGrids = (0, import_pg_core2.pgTable)(
  "population_grids",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    populationTotal: (0, import_pg_core2.integer)("population_total").notNull(),
    under5Population: (0, import_pg_core2.integer)("under5_population").default(0).notNull(),
    geojson: (0, import_pg_core2.jsonb)("geojson").notNull().default({}),
    // GeoJSON Polygon
    rasterCell: (0, import_pg_core2.varchar)("raster_cell", { length: 100 }),
    // Row/Col unique index
    densityClassification: (0, import_pg_core2.varchar)("density_classification", { length: 50 }),
    // Extreme, High, Medium, Low, Scattered
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
  },
  (table) => ({
    tenantIdx: (0, import_pg_core2.index)("idx_pop_grids_tenant").on(table.tenantId),
    densityIdx: (0, import_pg_core2.index)("idx_pop_grids_density").on(table.tenantId, table.densityClassification)
  })
);
var candidateUnmappedSettlements = (0, import_pg_core2.pgTable)(
  "candidate_unmapped_settlements",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    latitude: (0, import_pg_core2.decimal)("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: (0, import_pg_core2.decimal)("longitude", { precision: 10, scale: 7 }).notNull(),
    geojson: (0, import_pg_core2.jsonb)("geojson").notNull().default({}),
    // GeoJSON Point
    estimatedPopulation: (0, import_pg_core2.integer)("estimated_population").default(0).notNull(),
    buildingCount: (0, import_pg_core2.integer)("building_count").default(0).notNull(),
    nearestNamedSettlement: (0, import_pg_core2.varchar)("nearest_named_settlement", { length: 255 }),
    nearestFacility: (0, import_pg_core2.varchar)("nearest_facility", { length: 255 }),
    distanceToFacility: (0, import_pg_core2.decimal)("distance_to_facility", { precision: 8, scale: 2 }),
    confidenceScore: (0, import_pg_core2.decimal)("confidence_score", { precision: 5, scale: 2 }).default("0.75").notNull(),
    validationStatus: (0, import_pg_core2.varchar)("validation_status", { length: 50 }).default("pending").notNull(),
    // pending, validated, rejected
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
  },
  (table) => ({
    tenantIdx: (0, import_pg_core2.index)("idx_candidates_tenant").on(table.tenantId),
    statusIdx: (0, import_pg_core2.index)("idx_candidates_status").on(table.tenantId, table.validationStatus)
  })
);
var importedCoverage = (0, import_pg_core2.pgTable)(
  "imported_coverage",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    period: (0, import_pg_core2.varchar)("period", { length: 10 }).notNull(),
    // "YYYYMM"
    antigen: (0, import_pg_core2.varchar)("antigen", { length: 50 }).notNull(),
    dosesAdministered: (0, import_pg_core2.integer)("doses_administered").notNull().default(0),
    targetPopOverride: (0, import_pg_core2.integer)("target_pop_override"),
    source: (0, import_pg_core2.varchar)("source", { length: 20 }).notNull(),
    // "dhis2" | "csv"
    sourceRef: (0, import_pg_core2.varchar)("source_ref", { length: 255 }),
    // csvImportId or dhis2 integrationId
    importedByUserId: (0, import_pg_core2.varchar)("imported_by_user_id").references(() => users.id, { onDelete: "set null" }),
    importedAt: (0, import_pg_core2.timestamp)("imported_at").defaultNow().notNull()
  },
  (table) => ({
    tenantIdx: (0, import_pg_core2.index)("idx_imported_coverage_tenant").on(table.tenantId),
    facilityIdx: (0, import_pg_core2.index)("idx_imported_coverage_facility").on(table.tenantId, table.facilityId, table.period),
    uniqRow: (0, import_pg_core2.unique)("imported_coverage_unique").on(
      table.tenantId,
      table.facilityId,
      table.period,
      table.antigen,
      table.source
    )
  })
);
var csvImports = (0, import_pg_core2.pgTable)(
  "csv_imports",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    filename: (0, import_pg_core2.varchar)("filename", { length: 255 }).notNull(),
    rowCount: (0, import_pg_core2.integer)("row_count").notNull().default(0),
    errorCount: (0, import_pg_core2.integer)("error_count").notNull().default(0),
    importedCount: (0, import_pg_core2.integer)("imported_count").notNull().default(0),
    status: (0, import_pg_core2.varchar)("status", { length: 20 }).notNull().default("preview"),
    // preview | committed | failed
    errorReport: (0, import_pg_core2.jsonb)("error_report").default([]).notNull(),
    // [{row, field, message}]
    uploadedByUserId: (0, import_pg_core2.varchar)("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    uploadedAt: (0, import_pg_core2.timestamp)("uploaded_at").defaultNow().notNull()
  },
  (table) => ({
    tenantIdx: (0, import_pg_core2.index)("idx_csv_imports_tenant").on(table.tenantId)
  })
);
var vpdDiseasesEnum = (0, import_pg_core2.pgEnum)("vpd_diseases", [
  "afp",
  "measles",
  "nnt",
  "yellow_fever",
  "cholera",
  "covid19",
  "other"
]);
var caseClassificationEnum = (0, import_pg_core2.pgEnum)("case_classification", [
  "suspected",
  "probable",
  "confirmed",
  "discarded"
]);
var vpdLinelistTemplates = (0, import_pg_core2.pgTable)(
  "vpd_linelist_templates",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    disease: vpdDiseasesEnum("disease").notNull(),
    name: (0, import_pg_core2.varchar)("name", { length: 200 }).notNull(),
    description: (0, import_pg_core2.text)("description"),
    fields: (0, import_pg_core2.jsonb)("fields").default([]).notNull(),
    // Custom form fields definition
    isActive: (0, import_pg_core2.boolean)("is_active").notNull().default(true),
    createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
  },
  (table) => ({
    tenantIdx: (0, import_pg_core2.index)("idx_vpd_linelist_template_tenant").on(table.tenantId)
  })
);
var tenantVpdConfigurations = (0, import_pg_core2.pgTable)(
  "tenant_vpd_configurations",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    disease: vpdDiseasesEnum("disease").notNull(),
    isActive: (0, import_pg_core2.boolean)("is_active").notNull().default(true),
    targetIncidenceRate: (0, import_pg_core2.decimal)("target_incidence_rate", { precision: 8, scale: 2 }),
    // per 100k
    alertThreshold: (0, import_pg_core2.integer)("alert_threshold").default(1),
    notifyRoles: (0, import_pg_core2.jsonb)("notify_roles").default(["district_manager", "provincial_coordinator"]).notNull(),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
  },
  (table) => ({
    tenantIdx: (0, import_pg_core2.index)("idx_tenant_vpd_config_tenant").on(table.tenantId),
    uniqTenantDisease: (0, import_pg_core2.unique)("uq_tenant_vpd_config_disease").on(table.tenantId, table.disease)
  })
);
var surveillanceCases = (0, import_pg_core2.pgTable)(
  "surveillance_cases",
  {
    id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    villageId: (0, import_pg_core2.integer)("village_id").references(() => villages.id, { onDelete: "set null" }),
    clientId: (0, import_pg_core2.varchar)("client_id").references(() => clients.id, { onDelete: "set null" }),
    // Optional link to existing client
    disease: vpdDiseasesEnum("disease").notNull(),
    patientName: (0, import_pg_core2.varchar)("patient_name", { length: 255 }).notNull(),
    patientAgeMonths: (0, import_pg_core2.integer)("patient_age_months"),
    patientGender: (0, import_pg_core2.varchar)("patient_gender", { length: 20 }),
    dateOfOnset: (0, import_pg_core2.timestamp)("date_of_onset").notNull(),
    dateReported: (0, import_pg_core2.timestamp)("date_reported").defaultNow().notNull(),
    classification: caseClassificationEnum("classification").default("suspected").notNull(),
    investigatorUserId: (0, import_pg_core2.varchar)("investigator_user_id").references(() => users.id, { onDelete: "set null" }),
    investigationDate: (0, import_pg_core2.timestamp)("investigation_date"),
    clinicalNotes: (0, import_pg_core2.text)("clinical_notes"),
    gpsLatitude: (0, import_pg_core2.decimal)("gps_latitude", { precision: 10, scale: 7 }),
    gpsLongitude: (0, import_pg_core2.decimal)("gps_longitude", { precision: 10, scale: 7 }),
    status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("open").notNull(),
    // open, under_investigation, closed
    templateId: (0, import_pg_core2.integer)("template_id").references(() => vpdLinelistTemplates.id, { onDelete: "set null" }),
    formData: (0, import_pg_core2.jsonb)("form_data").default({}).notNull(),
    // Custom fields answers
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
  },
  (table) => ({
    tenantIdx: (0, import_pg_core2.index)("idx_surveillance_cases_tenant").on(table.tenantId),
    facilityIdx: (0, import_pg_core2.index)("idx_surveillance_cases_facility").on(table.facilityId),
    diseaseIdx: (0, import_pg_core2.index)("idx_surveillance_cases_disease").on(table.tenantId, table.disease)
  })
);
var labSamples = (0, import_pg_core2.pgTable)(
  "lab_samples",
  {
    id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
    caseId: (0, import_pg_core2.varchar)("case_id").notNull().references(() => surveillanceCases.id, { onDelete: "cascade" }),
    sampleType: (0, import_pg_core2.varchar)("sample_type", { length: 100 }).notNull(),
    // Stool, Blood, Swab
    dateCollected: (0, import_pg_core2.timestamp)("date_collected").notNull(),
    dateSent: (0, import_pg_core2.timestamp)("date_sent"),
    dateReceived: (0, import_pg_core2.timestamp)("date_received"),
    dateResults: (0, import_pg_core2.timestamp)("date_results"),
    result: (0, import_pg_core2.varchar)("result", { length: 100 }),
    // positive, negative, inconclusive, pending
    labName: (0, import_pg_core2.varchar)("lab_name", { length: 255 }),
    notes: (0, import_pg_core2.text)("notes"),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
  },
  (table) => ({
    caseIdx: (0, import_pg_core2.index)("idx_lab_samples_case").on(table.caseId)
  })
);
var supervisionVisits = (0, import_pg_core2.pgTable)(
  "supervision_visits",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    microplanId: (0, import_pg_core2.integer)("microplan_id").references(() => microplans.id, { onDelete: "set null" }),
    sessionPlanId: (0, import_pg_core2.integer)("session_plan_id").references(() => sessionPlans.id, { onDelete: "set null" }),
    scheduledDate: (0, import_pg_core2.timestamp)("scheduled_date").notNull(),
    conductedDate: (0, import_pg_core2.timestamp)("conducted_date"),
    supervisorUserId: (0, import_pg_core2.varchar)("supervisor_user_id").references(() => users.id, { onDelete: "set null" }),
    supervisorName: (0, import_pg_core2.varchar)("supervisor_name", { length: 255 }),
    visitType: (0, import_pg_core2.varchar)("visit_type", { length: 40 }).notNull().default("routine"),
    // routine | followup | adhoc | campaign
    status: (0, import_pg_core2.varchar)("status", { length: 20 }).notNull().default("scheduled"),
    // scheduled | conducted | cancelled | missed
    templateId: (0, import_pg_core2.integer)("template_id"),
    // optional configurable checklist template used for this visit
    checklist: (0, import_pg_core2.jsonb)("checklist").default([]).notNull(),
    score: (0, import_pg_core2.integer)("score"),
    // 0-100 derived from checklist
    gpsLatitude: (0, import_pg_core2.decimal)("gps_latitude", { precision: 10, scale: 6 }),
    // captured visit GPS
    gpsLongitude: (0, import_pg_core2.decimal)("gps_longitude", { precision: 10, scale: 6 }),
    findings: (0, import_pg_core2.text)("findings"),
    followUpActions: (0, import_pg_core2.text)("follow_up_actions"),
    nextVisitDate: (0, import_pg_core2.timestamp)("next_visit_date"),
    createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
  },
  (table) => ({
    tenantIdx: (0, import_pg_core2.index)("idx_supervision_tenant").on(table.tenantId),
    facilityIdx: (0, import_pg_core2.index)("idx_supervision_facility").on(table.tenantId, table.facilityId),
    scheduledIdx: (0, import_pg_core2.index)("idx_supervision_scheduled").on(table.tenantId, table.scheduledDate)
  })
);
var supervisionChecklistTemplates = (0, import_pg_core2.pgTable)(
  "supervision_checklist_templates",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: (0, import_pg_core2.varchar)("name", { length: 200 }).notNull(),
    category: (0, import_pg_core2.varchar)("category", { length: 50 }).notNull().default("supervision"),
    description: (0, import_pg_core2.text)("description"),
    sections: (0, import_pg_core2.jsonb)("sections").default([]).notNull(),
    // ChecklistSection[]
    items: (0, import_pg_core2.jsonb)("items").default([]).notNull(),
    // ChecklistTemplateItem[]
    isActive: (0, import_pg_core2.boolean)("is_active").notNull().default(true),
    // published & usable by lower levels
    createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
  },
  (table) => ({
    tenantIdx: (0, import_pg_core2.index)("idx_supervision_template_tenant").on(table.tenantId)
  })
);
var insertSupervisionChecklistTemplateSchema = (0, import_drizzle_zod2.createInsertSchema)(supervisionChecklistTemplates, {
  isActive: import_zod.z.boolean().optional()
}).omit({
  tenantId: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true
});
var annualImmunizationPlans = (0, import_pg_core2.pgTable)(
  "annual_immunization_plans",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    year: (0, import_pg_core2.integer)("year").notNull(),
    status: (0, import_pg_core2.varchar)("status", { length: 20 }).notNull().default("draft"),
    // draft | submitted | approved | superseded
    totalTargetPopulation: (0, import_pg_core2.integer)("total_target_population"),
    survivingInfants: (0, import_pg_core2.integer)("surviving_infants"),
    pregnantWomen: (0, import_pg_core2.integer)("pregnant_women"),
    budgetEnvelope: (0, import_pg_core2.decimal)("budget_envelope", { precision: 14, scale: 2 }),
    fundingMix: (0, import_pg_core2.jsonb)("funding_mix").default({}),
    // { government: pct, gavi: pct, who: pct, unicef: pct, other: pct }
    priorities: (0, import_pg_core2.text)("priorities"),
    // narrative — top strategic priorities for the year
    targetsByAntigen: (0, import_pg_core2.jsonb)("targets_by_antigen").default({}),
    // { BCG: pct, DTP3: pct, MCV1: pct, ... }
    narrative: (0, import_pg_core2.text)("narrative"),
    // long-form plan text / link to PDF
    approvedAt: (0, import_pg_core2.timestamp)("approved_at"),
    approvedByUserId: (0, import_pg_core2.varchar)("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
  },
  (table) => ({
    tenantIdx: (0, import_pg_core2.index)("idx_annual_plan_tenant").on(table.tenantId),
    yearIdx: (0, import_pg_core2.index)("idx_annual_plan_tenant_year").on(table.tenantId, table.year)
  })
);
var insertAnnualImmunizationPlanSchema = (0, import_drizzle_zod2.createInsertSchema)(annualImmunizationPlans).omit({
  createdAt: true,
  updatedAt: true,
  approvedAt: true
});
var quarterlyReviews = (0, import_pg_core2.pgTable)(
  "quarterly_reviews",
  {
    id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    year: (0, import_pg_core2.integer)("year").notNull(),
    quarter: (0, import_pg_core2.integer)("quarter").notNull(),
    topDrivers: (0, import_pg_core2.jsonb)("top_drivers").default([]).notNull(),
    correctiveActions: (0, import_pg_core2.text)("corrective_actions").notNull(),
    nextSurveyDate: (0, import_pg_core2.timestamp)("next_survey_date"),
    createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedByUserId: (0, import_pg_core2.varchar)("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
  },
  (table) => ({
    tenantIdx: (0, import_pg_core2.index)("idx_quarterly_reviews_tenant").on(table.tenantId),
    facilityIdx: (0, import_pg_core2.index)("idx_quarterly_reviews_facility").on(table.tenantId, table.facilityId),
    uqFacilityPeriod: (0, import_pg_core2.unique)("uq_quarterly_reviews_facility_period").on(
      table.tenantId,
      table.facilityId,
      table.year,
      table.quarter
    )
  })
);
var adminBoundariesRelations = (0, import_drizzle_orm2.relations)(adminBoundaries, ({ one }) => ({
  tenant: one(tenants, { fields: [adminBoundaries.tenantId], references: [tenants.id] })
}));
var customLayersRelations = (0, import_drizzle_orm2.relations)(customLayers, ({ one }) => ({
  tenant: one(tenants, { fields: [customLayers.tenantId], references: [tenants.id] }),
  uploadedBy: one(users, { fields: [customLayers.uploadedByUserId], references: [users.id] })
}));
var facilityCatchmentsRelations = (0, import_drizzle_orm2.relations)(facilityCatchments, ({ one }) => ({
  tenant: one(tenants, { fields: [facilityCatchments.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [facilityCatchments.facilityId], references: [facilities.id] }),
  drawnBy: one(users, { fields: [facilityCatchments.drawnByUserId], references: [users.id] })
}));
var vaccineConfigurationsRelations = (0, import_drizzle_orm2.relations)(vaccineConfigurations, ({ one, many }) => ({
  tenant: one(tenants, { fields: [vaccineConfigurations.tenantId], references: [tenants.id] }),
  clientVaccinations: many(clientVaccinations)
}));
var clientsRelations = (0, import_drizzle_orm2.relations)(clients, ({ one, many }) => ({
  tenant: one(tenants, { fields: [clients.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [clients.facilityId], references: [facilities.id] }),
  village: one(villages, { fields: [clients.villageId], references: [villages.id] }),
  vaccinations: many(clientVaccinations)
}));
var clientVaccinationsRelations = (0, import_drizzle_orm2.relations)(clientVaccinations, ({ one }) => ({
  tenant: one(tenants, { fields: [clientVaccinations.tenantId], references: [tenants.id] }),
  client: one(clients, { fields: [clientVaccinations.clientId], references: [clients.id] }),
  vaccineConfig: one(vaccineConfigurations, { fields: [clientVaccinations.vaccineConfigId], references: [vaccineConfigurations.id] }),
  administeredBy: one(users, { fields: [clientVaccinations.administeredByUserId], references: [users.id] })
}));
var sessionDayPlansRelations = (0, import_drizzle_orm2.relations)(sessionDayPlans, ({ one }) => ({
  tenant: one(tenants, { fields: [sessionDayPlans.tenantId], references: [tenants.id] }),
  sessionPlan: one(sessionPlans, { fields: [sessionDayPlans.sessionPlanId], references: [sessionPlans.id] })
}));
var stockTransactionsRelations = (0, import_drizzle_orm2.relations)(stockTransactions, ({ one }) => ({
  tenant: one(tenants, { fields: [stockTransactions.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [stockTransactions.facilityId], references: [facilities.id] }),
  recordedBy: one(users, { fields: [stockTransactions.recordedByUserId], references: [users.id] })
}));
var monthlyReportsRelations = (0, import_drizzle_orm2.relations)(monthlyReports, ({ one }) => ({
  tenant: one(tenants, { fields: [monthlyReports.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [monthlyReports.facilityId], references: [facilities.id] }),
  submittedBy: one(users, { fields: [monthlyReports.submittedById], references: [users.id] })
}));
var settlementsMasterRelations = (0, import_drizzle_orm2.relations)(settlementsMaster, ({ one }) => ({
  tenant: one(tenants, { fields: [settlementsMaster.tenantId], references: [tenants.id] })
}));
var populationGridsRelations = (0, import_drizzle_orm2.relations)(populationGrids, ({ one }) => ({
  tenant: one(tenants, { fields: [populationGrids.tenantId], references: [tenants.id] })
}));
var candidateUnmappedSettlementsRelations = (0, import_drizzle_orm2.relations)(candidateUnmappedSettlements, ({ one }) => ({
  tenant: one(tenants, { fields: [candidateUnmappedSettlements.tenantId], references: [tenants.id] })
}));
var insertAdminBoundarySchema = (0, import_drizzle_zod2.createInsertSchema)(adminBoundaries).omit({
  id: true,
  fetchedAt: true,
  createdAt: true,
  updatedAt: true
});
var insertFacilityCatchmentSchema = (0, import_drizzle_zod2.createInsertSchema)(facilityCatchments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertCustomLayerSchema = (0, import_drizzle_zod2.createInsertSchema)(customLayers).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertVaccineConfigSchema = (0, import_drizzle_zod2.createInsertSchema)(vaccineConfigurations).omit({
  tenantId: true,
  createdAt: true
});
var insertClientSchema = (0, import_drizzle_zod2.createInsertSchema)(clients).omit({
  createdAt: true,
  updatedAt: true
}).extend({
  villageId: import_zod.z.number().optional().nullable(),
  dateOfBirth: import_zod.z.coerce.date()
});
var insertClientVaccinationSchema = (0, import_drizzle_zod2.createInsertSchema)(clientVaccinations).omit({
  createdAt: true
}).extend({
  administeredDate: import_zod.z.coerce.date(),
  expiryDate: import_zod.z.coerce.date().optional().nullable()
});
var insertSessionDayPlanSchema = (0, import_drizzle_zod2.createInsertSchema)(sessionDayPlans).omit({
  tenantId: true,
  createdAt: true
}).extend({
  sessionDate: import_zod.z.coerce.date(),
  executedAt: import_zod.z.coerce.date().optional().nullable()
});
var insertStockTransactionSchema = (0, import_drizzle_zod2.createInsertSchema)(stockTransactions).omit({
  createdAt: true
}).extend({
  productId: import_zod.z.number().int().positive(),
  productCode: import_zod.z.string().optional().nullable(),
  vaccineName: import_zod.z.string().optional().nullable().transform((val) => val ? normalizeStockVaccineName(val) : val),
  expiryDate: import_zod.z.coerce.date(),
  transactionDate: import_zod.z.coerce.date().optional()
});
var insertMonthlyReportSchema = (0, import_drizzle_zod2.createInsertSchema)(monthlyReports).omit({
  createdAt: true
});
var insertSettlementMasterSchema = (0, import_drizzle_zod2.createInsertSchema)(settlementsMaster).omit({
  createdAt: true,
  updatedAt: true
});
var insertPopulationGridSchema = (0, import_drizzle_zod2.createInsertSchema)(populationGrids).omit({
  createdAt: true
});
var insertCandidateUnmappedSettlementSchema = (0, import_drizzle_zod2.createInsertSchema)(candidateUnmappedSettlements).omit({
  createdAt: true,
  updatedAt: true
});
var insertImportedCoverageSchema = (0, import_drizzle_zod2.createInsertSchema)(importedCoverage).omit({
  importedAt: true
});
var insertCsvImportSchema = (0, import_drizzle_zod2.createInsertSchema)(csvImports).omit({
  uploadedAt: true
});
var coverageCsvRowSchema = import_zod.z.object({
  facility_external_id: import_zod.z.string().min(1, "facility_external_id required"),
  period: import_zod.z.string().regex(/^\d{4}-?\d{2}$/, 'period must be "YYYYMM" or "YYYY-MM"').transform((p) => p.replace("-", "")),
  antigen: import_zod.z.string().min(1, "antigen required").transform((a) => a.trim().toUpperCase()),
  doses_administered: import_zod.z.coerce.number().int().nonnegative(),
  target_pop_override: import_zod.z.coerce.number().int().nonnegative().optional().nullable()
});
var insertMobilizationActivitySchema = (0, import_drizzle_zod2.createInsertSchema)(mobilizationActivities).omit({
  createdAt: true
});
var insertApprovalRequestSchema = (0, import_drizzle_zod2.createInsertSchema)(approvalRequests).omit({
  submittedAt: true,
  resolvedAt: true
});
var insertTenantInterestRequestSchema = (0, import_drizzle_zod2.createInsertSchema)(tenantInterestRequests).omit({
  id: true,
  status: true,
  createdAt: true
}).extend({
  requestedRole: import_zod.z.enum(SELF_SIGNUP_ROLES),
  email: import_zod.z.string().email().max(255),
  fullName: import_zod.z.string().min(2).max(255),
  countryCode: import_zod.z.string().length(3).regex(/^[A-Z]{3}$/, "ISO-3 country code"),
  countryName: import_zod.z.string().min(2).max(255),
  organization: import_zod.z.string().max(255).optional().nullable(),
  justification: import_zod.z.string().max(2e3).optional().nullable()
});
var insertSupervisionVisitSchema = (0, import_drizzle_zod2.createInsertSchema)(supervisionVisits).omit({
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
var insertQuarterlyReviewSchema = (0, import_drizzle_zod2.createInsertSchema)(quarterlyReviews).omit({
  tenantId: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  facilityId: import_zod.z.number().int().positive(),
  year: import_zod.z.number().int().min(2e3).max(2100),
  quarter: import_zod.z.number().int().min(1).max(4),
  topDrivers: import_zod.z.array(import_zod.z.string().trim().min(1).max(255)).min(1).max(3),
  correctiveActions: import_zod.z.string().trim().min(5).max(4e3),
  nextSurveyDate: import_zod.z.union([import_zod.z.string(), import_zod.z.date()]).nullable().optional()
});
var notifications = (0, import_pg_core2.pgTable)(
  "notifications",
  {
    id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: (0, import_pg_core2.varchar)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: (0, import_pg_core2.varchar)("type", { length: 50 }).notNull(),
    title: (0, import_pg_core2.varchar)("title", { length: 255 }).notNull(),
    body: (0, import_pg_core2.text)("body"),
    data: (0, import_pg_core2.jsonb)("data").default({}).notNull(),
    readAt: (0, import_pg_core2.timestamp)("read_at"),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull()
  },
  (table) => [
    (0, import_pg_core2.index)("idx_notifications_user_unread").on(table.userId, table.readAt),
    (0, import_pg_core2.index)("idx_notifications_tenant").on(table.tenantId)
  ]
);
var DEFAULT_STOCK_ALERT_DIGEST = {
  enabled: true,
  frequency: "weekly",
  thresholdMonths: 1,
  recipientRoles: ["facility_clerk", "facility_in_charge"]
};
var stockAlertDigestSettingsSchema = import_zod.z.object({
  enabled: import_zod.z.boolean(),
  frequency: import_zod.z.enum(["daily", "weekly"]),
  thresholdMonths: import_zod.z.number().positive(),
  recipientRoles: import_zod.z.array(import_zod.z.string()).optional()
});
var tenantSecuritySettingsSchema = import_zod.z.object({
  idleTimeoutMinutes: import_zod.z.number().min(1).max(1440).optional()
});
var emailOrEmpty = import_zod.z.string().trim().max(254).refine((v) => v === "" || import_zod.z.string().email().safeParse(v).success, {
  message: "Must be a valid email address"
});
var tenantEmailSettingsSchema = import_zod.z.object({
  fromAddress: emailOrEmpty.optional(),
  fromName: import_zod.z.string().trim().max(120).optional(),
  replyTo: emailOrEmpty.optional()
});
var insertCatchmentConflictSchema = (0, import_drizzle_zod2.createInsertSchema)(catchmentConflicts).omit({
  createdAt: true,
  resolvedAt: true
});
var FACILITY_AUTHOR_ROLES = [
  "provincial_coordinator",
  "national_admin",
  "gis_specialist",
  "district_manager"
];
var indicatorManual = (0, import_pg_core2.pgTable)(
  "indicator_manual",
  {
    id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
    tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    category: (0, import_pg_core2.varchar)("category", { length: 255 }).notNull(),
    subCategory: (0, import_pg_core2.varchar)("sub_category", { length: 255 }).notNull(),
    name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
    numerator: (0, import_pg_core2.text)("numerator").notNull(),
    numeratorSource: (0, import_pg_core2.text)("numerator_source").notNull(),
    denominator: (0, import_pg_core2.text)("denominator").notNull(),
    denominatorSource: (0, import_pg_core2.text)("denominator_source").notNull(),
    calculation: (0, import_pg_core2.text)("calculation").notNull(),
    calculationExample: (0, import_pg_core2.text)("calculation_example").notNull(),
    reference: (0, import_pg_core2.text)("reference"),
    referenceUrl: (0, import_pg_core2.text)("reference_url"),
    createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
  },
  (table) => [
    (0, import_pg_core2.index)("idx_indicator_manual_tenant").on(table.tenantId)
  ]
);
var insertIndicatorManualSchema = (0, import_drizzle_zod2.createInsertSchema)(indicatorManual).omit({
  createdAt: true,
  updatedAt: true
});
var messageTemplates = (0, import_pg_core2.pgTable)("message_templates", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  category: (0, import_pg_core2.varchar)("category", { length: 100 }).notNull(),
  language: (0, import_pg_core2.varchar)("language", { length: 50 }).notNull(),
  channel: (0, import_pg_core2.varchar)("channel", { length: 50 }),
  body: (0, import_pg_core2.text)("body").notNull(),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
});
var communications = (0, import_pg_core2.pgTable)("communications", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  eventId: (0, import_pg_core2.varchar)("event_id"),
  recipientId: (0, import_pg_core2.varchar)("recipient_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  messageType: (0, import_pg_core2.varchar)("message_type", { length: 100 }).notNull(),
  priority: (0, import_pg_core2.varchar)("priority", { length: 50 }).notNull().default("medium"),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).notNull().default("pending"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull()
});
var communicationChannels = (0, import_pg_core2.pgTable)("communication_channels", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  communicationId: (0, import_pg_core2.varchar)("communication_id").notNull().references(() => communications.id, { onDelete: "cascade" }),
  channel: (0, import_pg_core2.varchar)("channel", { length: 50 }).notNull(),
  attempted: (0, import_pg_core2.boolean)("attempted").default(false).notNull(),
  delivered: (0, import_pg_core2.boolean)("delivered").default(false).notNull(),
  responseCode: (0, import_pg_core2.varchar)("response_code", { length: 100 }),
  deliveryTime: (0, import_pg_core2.timestamp)("delivery_time"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull()
});
var deliveryLogs = (0, import_pg_core2.pgTable)("delivery_logs", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  communicationId: (0, import_pg_core2.varchar)("communication_id").notNull().references(() => communications.id, { onDelete: "cascade" }),
  provider: (0, import_pg_core2.varchar)("provider", { length: 100 }).notNull(),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).notNull(),
  response: (0, import_pg_core2.text)("response"),
  timestamp: (0, import_pg_core2.timestamp)("timestamp").defaultNow().notNull()
});
var communicationLogs = (0, import_pg_core2.pgTable)("communication_logs", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").references(() => tenants.id),
  channel: (0, import_pg_core2.text)("channel").notNull(),
  // 'whatsapp', 'sms', 'email'
  destination: (0, import_pg_core2.text)("destination").notNull(),
  status: (0, import_pg_core2.text)("status").notNull(),
  // 'delivered', 'failed', 'queued'
  providerResponse: (0, import_pg_core2.text)("provider_response"),
  fallbackTriggered: (0, import_pg_core2.boolean)("fallback_triggered").default(false),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull()
});
var insertVpdLinelistTemplateSchema = (0, import_drizzle_zod2.createInsertSchema)(vpdLinelistTemplates).omit({
  createdAt: true,
  updatedAt: true
});
var insertTenantVpdConfigurationSchema = (0, import_drizzle_zod2.createInsertSchema)(tenantVpdConfigurations).omit({
  createdAt: true,
  updatedAt: true
});
var insertSurveillanceCaseSchema = (0, import_drizzle_zod2.createInsertSchema)(surveillanceCases).omit({
  createdAt: true,
  updatedAt: true
}).extend({
  dateOfOnset: import_zod.z.coerce.date(),
  dateReported: import_zod.z.coerce.date().optional()
});
var insertLabSampleSchema = (0, import_drizzle_zod2.createInsertSchema)(labSamples).omit({
  createdAt: true,
  updatedAt: true
}).extend({
  dateCollected: import_zod.z.coerce.date(),
  dateSent: import_zod.z.coerce.date().optional().nullable(),
  dateReceived: import_zod.z.coerce.date().optional().nullable(),
  dateResults: import_zod.z.coerce.date().optional().nullable()
});
var facilityStaffRelations = (0, import_drizzle_orm2.relations)(facilityStaff, ({ one }) => ({
  tenant: one(tenants, { fields: [facilityStaff.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [facilityStaff.facilityId], references: [facilities.id] })
}));
var insertFacilityStaffSchema = (0, import_drizzle_zod2.createInsertSchema)(facilityStaff).omit({
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
var hfcCommittee = (0, import_pg_core2.pgTable)("hfc_committee", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
  memberName: (0, import_pg_core2.varchar)("member_name", { length: 255 }).notNull(),
  gender: (0, import_pg_core2.varchar)("gender", { length: 20 }),
  // male | female | other
  position: (0, import_pg_core2.varchar)("position", { length: 100 }),
  // Chairperson, Secretary, Treasurer, Member
  yearsOfService: (0, import_pg_core2.integer)("years_of_service"),
  isChairperson: (0, import_pg_core2.boolean)("is_chairperson").default(false).notNull(),
  contactPhone: (0, import_pg_core2.varchar)("contact_phone", { length: 50 }),
  committeeEstablishedDate: (0, import_pg_core2.varchar)("committee_established_date", { length: 20 }),
  // ISO date string
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => [
  (0, import_pg_core2.index)("idx_hfc_committee_tenant").on(table.tenantId),
  (0, import_pg_core2.index)("idx_hfc_committee_facility").on(table.facilityId)
]);
var hfcCommitteeRelations = (0, import_drizzle_orm2.relations)(hfcCommittee, ({ one }) => ({
  tenant: one(tenants, { fields: [hfcCommittee.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [hfcCommittee.facilityId], references: [facilities.id] })
}));
var insertHfcCommitteeSchema = (0, import_drizzle_zod2.createInsertSchema)(hfcCommittee).omit({
  createdAt: true,
  updatedAt: true
});
var communityHealthVolunteers = (0, import_pg_core2.pgTable)("community_health_volunteers", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
  villageId: (0, import_pg_core2.integer)("village_id").references(() => villages.id, { onDelete: "set null" }),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  nrc: (0, import_pg_core2.varchar)("nrc", { length: 50 }),
  gender: (0, import_pg_core2.varchar)("gender", { length: 20 }),
  yearsOfService: (0, import_pg_core2.integer)("years_of_service"),
  educationLevel: (0, import_pg_core2.varchar)("education_level", { length: 100 }),
  // Primary, Secondary, Certificate, Diploma, Degree
  trainingStatus: (0, import_pg_core2.varchar)("training_status", { length: 50 }).default("untrained"),
  // trained | untrained
  communityUnit: (0, import_pg_core2.varchar)("community_unit", { length: 255 }),
  // The community health unit they belong to
  campaignRole: (0, import_pg_core2.varchar)("campaign_role", { length: 100 }),
  active: (0, import_pg_core2.boolean)("active").default(true).notNull(),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => [
  (0, import_pg_core2.index)("idx_chv_tenant").on(table.tenantId),
  (0, import_pg_core2.index)("idx_chv_facility").on(table.facilityId)
]);
var communityHealthVolunteersRelations = (0, import_drizzle_orm2.relations)(communityHealthVolunteers, ({ one }) => ({
  tenant: one(tenants, { fields: [communityHealthVolunteers.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [communityHealthVolunteers.facilityId], references: [facilities.id] }),
  village: one(villages, { fields: [communityHealthVolunteers.villageId], references: [villages.id] })
}));
var insertCommunityHealthVolunteerSchema = (0, import_drizzle_zod2.createInsertSchema)(communityHealthVolunteers).omit({
  createdAt: true,
  updatedAt: true
});
var insertHfcCommitteeMemberSchema = (0, import_drizzle_zod2.createInsertSchema)(hfcCommitteeMembers).omit({
  tenantId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  /* Original definition commented out to support empty strings pre-coercion for date:
  committeeEstablishedDate: z.coerce.date().optional().nullable(),
  */
  committeeEstablishedDate: import_zod.z.preprocess((val) => val === "" ? null : val, import_zod.z.coerce.date().optional().nullable())
});
var insertChvProfileSchema = (0, import_drizzle_zod2.createInsertSchema)(chvProfiles).omit({
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
var insertUncoveredCommunitySchema = (0, import_drizzle_zod2.createInsertSchema)(uncoveredCommunities).omit({
  tenantId: true,
  flaggedAt: true,
  resolvedAt: true
});
var coldChainEquipment = (0, import_pg_core2.pgTable)("cold_chain_equipment", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
  // Equipment classification
  equipmentType: (0, import_pg_core2.varchar)("equipment_type", { length: 60 }).notNull(),
  // refrigerator | freezer | icm | cold_box | vaccine_carrier | generator | temperature_logger | other
  brand: (0, import_pg_core2.varchar)("brand", { length: 100 }),
  model: (0, import_pg_core2.varchar)("model", { length: 100 }),
  serialNumber: (0, import_pg_core2.varchar)("serial_number", { length: 100 }),
  catalogNumber: (0, import_pg_core2.varchar)("catalog_number", { length: 100 }),
  // WHO PIS catalog ref
  // Physical specs
  capacityLiters: (0, import_pg_core2.decimal)("capacity_liters", { precision: 8, scale: 2 }),
  netStorageCapacityLiters: (0, import_pg_core2.decimal)("net_storage_capacity_liters", { precision: 8, scale: 2 }),
  temperatureMin: (0, import_pg_core2.decimal)("temperature_min", { precision: 5, scale: 1 }),
  // °C
  temperatureMax: (0, import_pg_core2.decimal)("temperature_max", { precision: 5, scale: 1 }),
  // °C
  // Power & energy
  powerSource: (0, import_pg_core2.varchar)("power_source", { length: 40 }),
  // solar | electric | gas | kerosene | battery | solar_dc | none
  energyConsumptionKwhDay: (0, import_pg_core2.decimal)("energy_consumption_kwh_day", { precision: 6, scale: 2 }),
  // Provenance & lifecycle
  manufactureYear: (0, import_pg_core2.integer)("manufacture_year"),
  installationDate: (0, import_pg_core2.varchar)("installation_date", { length: 20 }),
  // ISO date string YYYY-MM-DD
  purchaseCost: (0, import_pg_core2.decimal)("purchase_cost", { precision: 14, scale: 2 }),
  purchaseCurrency: (0, import_pg_core2.varchar)("purchase_currency", { length: 5 }).default("USD"),
  warrantyExpiry: (0, import_pg_core2.varchar)("warranty_expiry", { length: 20 }),
  supplier: (0, import_pg_core2.varchar)("supplier", { length: 255 }),
  donorFunded: (0, import_pg_core2.boolean)("donor_funded").default(false),
  fundingSource: (0, import_pg_core2.varchar)("funding_source", { length: 100 }),
  // Maintenance & condition
  condition: (0, import_pg_core2.varchar)("condition", { length: 30 }).notNull().default("functional"),
  // functional | needs_repair | non_functional | condemned | decommissioned
  lastServiceDate: (0, import_pg_core2.varchar)("last_service_date", { length: 20 }),
  nextServiceDue: (0, import_pg_core2.varchar)("next_service_due", { length: 20 }),
  lastTemperatureCheck: (0, import_pg_core2.varchar)("last_temperature_check", { length: 20 }),
  maintenanceNotes: (0, import_pg_core2.text)("maintenance_notes"),
  // Flags & metadata
  isActive: (0, import_pg_core2.boolean)("is_active").default(true).notNull(),
  notes: (0, import_pg_core2.text)("notes"),
  externalId: (0, import_pg_core2.varchar)("external_id", { length: 100 }),
  // for IGA system round-trip matching
  createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedByUserId: (0, import_pg_core2.varchar)("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
}, (table) => [
  (0, import_pg_core2.index)("idx_cce_tenant").on(table.tenantId),
  (0, import_pg_core2.index)("idx_cce_facility").on(table.facilityId),
  (0, import_pg_core2.index)("idx_cce_condition").on(table.tenantId, table.condition)
]);
var coldChainEquipmentRelations = (0, import_drizzle_orm2.relations)(coldChainEquipment, ({ one }) => ({
  tenant: one(tenants, { fields: [coldChainEquipment.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [coldChainEquipment.facilityId], references: [facilities.id] }),
  createdBy: one(users, { fields: [coldChainEquipment.createdByUserId], references: [users.id] })
}));
var insertColdChainEquipmentSchema = (0, import_drizzle_zod2.createInsertSchema)(coldChainEquipment).omit({
  tenantId: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  equipmentType: import_zod.z.enum([
    "refrigerator",
    "freezer",
    "icm",
    "cold_box",
    "vaccine_carrier",
    "generator",
    "temperature_logger",
    "other"
  ]),
  condition: import_zod.z.enum([
    "functional",
    "needs_repair",
    "non_functional",
    "condemned",
    "decommissioned"
  ]).default("functional"),
  powerSource: import_zod.z.enum([
    "solar",
    "electric",
    "gas",
    "kerosene",
    "battery",
    "solar_dc",
    "none"
  ]).optional().nullable(),
  /* Original fields commented out to support empty string preprocessing:
  capacityLiters: z.coerce.number().positive().optional().nullable(),
  netStorageCapacityLiters: z.coerce.number().positive().optional().nullable(),
  temperatureMin: z.coerce.number().optional().nullable(),
  temperatureMax: z.coerce.number().optional().nullable(),
  manufactureYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  purchaseCost: z.coerce.number().nonnegative().optional().nullable(),
  energyConsumptionKwhDay: z.coerce.number().nonnegative().optional().nullable(),
  */
  capacityLiters: import_zod.z.preprocess((val) => val === "" ? null : val, import_zod.z.coerce.number().positive().optional().nullable()),
  netStorageCapacityLiters: import_zod.z.preprocess((val) => val === "" ? null : val, import_zod.z.coerce.number().positive().optional().nullable()),
  temperatureMin: import_zod.z.preprocess((val) => val === "" ? null : val, import_zod.z.coerce.number().optional().nullable()),
  temperatureMax: import_zod.z.preprocess((val) => val === "" ? null : val, import_zod.z.coerce.number().optional().nullable()),
  manufactureYear: import_zod.z.preprocess((val) => val === "" ? null : val, import_zod.z.coerce.number().int().min(1950).max(2100).optional().nullable()),
  purchaseCost: import_zod.z.preprocess((val) => val === "" ? null : val, import_zod.z.coerce.number().nonnegative().optional().nullable()),
  energyConsumptionKwhDay: import_zod.z.preprocess((val) => val === "" ? null : val, import_zod.z.coerce.number().nonnegative().optional().nullable()),
  donorFunded: import_zod.z.boolean().optional(),
  isActive: import_zod.z.boolean().optional()
});
var insertVgieSettlementFacilityLinkSchema = (0, import_drizzle_zod2.createInsertSchema)(vgieSettlementFacilityLinks).omit({
  createdAt: true
});
var insertVgieRecommendationSchema = (0, import_drizzle_zod2.createInsertSchema)(vgieRecommendations).omit({
  createdAt: true,
  updatedAt: true
});
var insertVgieAlertSchema = (0, import_drizzle_zod2.createInsertSchema)(vgieAlerts).omit({
  createdAt: true,
  updatedAt: true
});
var researchDocuments = (0, import_pg_core2.pgTable)("research_documents", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull(),
  title: (0, import_pg_core2.varchar)("title", { length: 255 }).notNull(),
  slug: (0, import_pg_core2.varchar)("slug", { length: 255 }).notNull(),
  abstract: (0, import_pg_core2.text)("abstract"),
  documentType: (0, import_pg_core2.varchar)("document_type", { length: 100 }).notNull(),
  authors: (0, import_pg_core2.varchar)("authors", { length: 255 }),
  organizations: (0, import_pg_core2.varchar)("organizations", { length: 255 }),
  publicationDate: (0, import_pg_core2.varchar)("publication_date", { length: 20 }),
  year: (0, import_pg_core2.integer)("year"),
  version: (0, import_pg_core2.varchar)("version", { length: 50 }).default("1.0.0"),
  country: (0, import_pg_core2.varchar)("country", { length: 100 }),
  region: (0, import_pg_core2.varchar)("region", { length: 100 }),
  language: (0, import_pg_core2.varchar)("language", { length: 50 }).default("en"),
  tags: (0, import_pg_core2.jsonb)("tags").default(import_drizzle_orm2.sql`'[]'::jsonb`),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("Draft").notNull(),
  visibility: (0, import_pg_core2.varchar)("visibility", { length: 50 }).default("Public").notNull(),
  fileUrl: (0, import_pg_core2.varchar)("file_url", { length: 512 }),
  fileName: (0, import_pg_core2.varchar)("file_name", { length: 255 }),
  fileType: (0, import_pg_core2.varchar)("file_type", { length: 100 }),
  fileSize: (0, import_pg_core2.integer)("file_size"),
  thumbnailUrl: (0, import_pg_core2.varchar)("thumbnail_url", { length: 512 }),
  citationText: (0, import_pg_core2.text)("citation_text"),
  doi: (0, import_pg_core2.varchar)("doi", { length: 100 }),
  license: (0, import_pg_core2.varchar)("license", { length: 100 }).default("CC BY 4.0"),
  isFeatured: (0, import_pg_core2.boolean)("is_featured").default(false).notNull(),
  downloadCount: (0, import_pg_core2.integer)("download_count").default(0).notNull(),
  createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedByUserId: (0, import_pg_core2.varchar)("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  publishedByUserId: (0, import_pg_core2.varchar)("published_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull(),
  publishedAt: (0, import_pg_core2.timestamp)("published_at"),
  archivedAt: (0, import_pg_core2.timestamp)("archived_at")
}, (table) => [
  (0, import_pg_core2.index)("idx_research_doc_tenant").on(table.tenantId),
  (0, import_pg_core2.index)("idx_research_doc_status").on(table.status)
]);
var pilotActivities = (0, import_pg_core2.pgTable)("pilot_activities", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull(),
  title: (0, import_pg_core2.varchar)("title", { length: 255 }).notNull(),
  slug: (0, import_pg_core2.varchar)("slug", { length: 255 }).notNull(),
  summary: (0, import_pg_core2.text)("summary"),
  country: (0, import_pg_core2.varchar)("country", { length: 100 }).notNull(),
  province: (0, import_pg_core2.varchar)("province", { length: 100 }),
  district: (0, import_pg_core2.varchar)("district", { length: 100 }),
  facility: (0, import_pg_core2.varchar)("facility", { length: 255 }),
  communities: (0, import_pg_core2.text)("communities"),
  latitude: (0, import_pg_core2.decimal)("latitude", { precision: 9, scale: 6 }),
  longitude: (0, import_pg_core2.decimal)("longitude", { precision: 9, scale: 6 }),
  startDate: (0, import_pg_core2.varchar)("start_date", { length: 20 }),
  endDate: (0, import_pg_core2.varchar)("end_date", { length: 20 }),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("Planned").notNull(),
  pilotType: (0, import_pg_core2.varchar)("pilot_type", { length: 100 }),
  partners: (0, import_pg_core2.varchar)("partners", { length: 255 }),
  ministryFocalPoint: (0, import_pg_core2.varchar)("ministry_focal_point", { length: 255 }),
  technicalLead: (0, import_pg_core2.varchar)("technical_lead", { length: 255 }),
  objectives: (0, import_pg_core2.text)("objectives"),
  researchQuestions: (0, import_pg_core2.text)("research_questions"),
  methodology: (0, import_pg_core2.text)("methodology"),
  indicators: (0, import_pg_core2.jsonb)("indicators").default(import_drizzle_orm2.sql`'[]'::jsonb`),
  baselineFindings: (0, import_pg_core2.text)("baseline_findings"),
  achievements: (0, import_pg_core2.text)("achievements"),
  challenges: (0, import_pg_core2.text)("challenges"),
  lessonsLearned: (0, import_pg_core2.text)("lessons_learned"),
  recommendations: (0, import_pg_core2.text)("recommendations"),
  ethicsStatus: (0, import_pg_core2.varchar)("ethics_status", { length: 100 }),
  visibility: (0, import_pg_core2.varchar)("visibility", { length: 50 }).default("Public").notNull(),
  isFeatured: (0, import_pg_core2.boolean)("is_featured").default(false).notNull(),
  createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedByUserId: (0, import_pg_core2.varchar)("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull(),
  publishedAt: (0, import_pg_core2.timestamp)("published_at")
}, (table) => [
  (0, import_pg_core2.index)("idx_pilot_act_tenant").on(table.tenantId),
  (0, import_pg_core2.index)("idx_pilot_act_status").on(table.status)
]);
var pilotUpdates = (0, import_pg_core2.pgTable)("pilot_updates", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  pilotId: (0, import_pg_core2.integer)("pilot_id").notNull().references(() => pilotActivities.id, { onDelete: "cascade" }),
  title: (0, import_pg_core2.varchar)("title", { length: 255 }).notNull(),
  updateDate: (0, import_pg_core2.varchar)("update_date", { length: 20 }).notNull(),
  updateType: (0, import_pg_core2.varchar)("update_type", { length: 100 }),
  description: (0, import_pg_core2.text)("description"),
  achievements: (0, import_pg_core2.text)("achievements"),
  challenges: (0, import_pg_core2.text)("challenges"),
  nextSteps: (0, import_pg_core2.text)("next_steps"),
  attachments: (0, import_pg_core2.jsonb)("attachments").default(import_drizzle_orm2.sql`'[]'::jsonb`),
  createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
}, (table) => [
  (0, import_pg_core2.index)("idx_pilot_upd_pilot").on(table.pilotId)
]);
var implementationLessons = (0, import_pg_core2.pgTable)("implementation_lessons", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull(),
  title: (0, import_pg_core2.varchar)("title", { length: 255 }).notNull(),
  slug: (0, import_pg_core2.varchar)("slug", { length: 255 }).notNull(),
  category: (0, import_pg_core2.varchar)("category", { length: 100 }).notNull(),
  context: (0, import_pg_core2.text)("context"),
  whatWasTested: (0, import_pg_core2.text)("what_was_tested"),
  whatWorked: (0, import_pg_core2.text)("what_worked"),
  whatDidNotWork: (0, import_pg_core2.text)("what_did_not_work"),
  recommendation: (0, import_pg_core2.text)("recommendation"),
  pilotId: (0, import_pg_core2.integer)("pilot_id").references(() => pilotActivities.id, { onDelete: "set null" }),
  documentId: (0, import_pg_core2.integer)("document_id").references(() => researchDocuments.id, { onDelete: "set null" }),
  tags: (0, import_pg_core2.jsonb)("tags").default(import_drizzle_orm2.sql`'[]'::jsonb`),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("Published").notNull(),
  visibility: (0, import_pg_core2.varchar)("visibility", { length: 50 }).default("Public").notNull(),
  author: (0, import_pg_core2.varchar)("author", { length: 255 }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
}, (table) => [
  (0, import_pg_core2.index)("idx_impl_lesson_tenant").on(table.tenantId),
  (0, import_pg_core2.index)("idx_impl_lesson_category").on(table.category)
]);
var downloadAssets = (0, import_pg_core2.pgTable)("download_assets", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull(),
  title: (0, import_pg_core2.varchar)("title", { length: 255 }).notNull(),
  slug: (0, import_pg_core2.varchar)("slug", { length: 255 }).notNull(),
  description: (0, import_pg_core2.text)("description"),
  category: (0, import_pg_core2.varchar)("category", { length: 100 }).notNull(),
  recommendedAudience: (0, import_pg_core2.varchar)("recommended_audience", { length: 255 }),
  fileUrl: (0, import_pg_core2.varchar)("file_url", { length: 512 }),
  fileName: (0, import_pg_core2.varchar)("file_name", { length: 255 }),
  fileType: (0, import_pg_core2.varchar)("file_type", { length: 100 }),
  fileSize: (0, import_pg_core2.integer)("file_size"),
  version: (0, import_pg_core2.varchar)("version", { length: 50 }).default("1.0.0"),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("Published").notNull(),
  visibility: (0, import_pg_core2.varchar)("visibility", { length: 50 }).default("Public").notNull(),
  downloadCount: (0, import_pg_core2.integer)("download_count").default(0).notNull(),
  createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedByUserId: (0, import_pg_core2.varchar)("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
}, (table) => [
  (0, import_pg_core2.index)("idx_download_asset_tenant").on(table.tenantId)
]);
var researchInterestSubmissions = (0, import_pg_core2.pgTable)("research_interest_submissions", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull(),
  fullName: (0, import_pg_core2.varchar)("full_name", { length: 255 }).notNull(),
  organization: (0, import_pg_core2.varchar)("organization", { length: 255 }),
  role: (0, import_pg_core2.varchar)("role", { length: 255 }),
  email: (0, import_pg_core2.varchar)("email", { length: 255 }).notNull(),
  country: (0, import_pg_core2.varchar)("country", { length: 100 }),
  areaOfInterest: (0, import_pg_core2.varchar)("area_of_interest", { length: 255 }),
  message: (0, import_pg_core2.text)("message"),
  consent: (0, import_pg_core2.boolean)("consent").default(false).notNull(),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("pending").notNull(),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
}, (table) => [
  (0, import_pg_core2.index)("idx_res_interest_tenant").on(table.tenantId)
]);
var researchDownloadEvents = (0, import_pg_core2.pgTable)("research_download_events", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  documentId: (0, import_pg_core2.integer)("document_id").references(() => researchDocuments.id, { onDelete: "cascade" }),
  assetId: (0, import_pg_core2.integer)("asset_id").references(() => downloadAssets.id, { onDelete: "cascade" }),
  userId: (0, import_pg_core2.varchar)("user_id").references(() => users.id, { onDelete: "set null" }),
  ipHash: (0, import_pg_core2.varchar)("ip_hash", { length: 64 }),
  userAgent: (0, import_pg_core2.text)("user_agent"),
  downloadedAt: (0, import_pg_core2.timestamp)("downloaded_at").defaultNow().notNull()
});
var researchDocumentsRelations = (0, import_drizzle_orm2.relations)(researchDocuments, ({ one, many }) => ({
  createdBy: one(users, { fields: [researchDocuments.createdByUserId], references: [users.id] }),
  lessons: many(implementationLessons)
}));
var pilotActivitiesRelations = (0, import_drizzle_orm2.relations)(pilotActivities, ({ one, many }) => ({
  createdBy: one(users, { fields: [pilotActivities.createdByUserId], references: [users.id] }),
  updates: many(pilotUpdates),
  lessons: many(implementationLessons)
}));
var pilotUpdatesRelations = (0, import_drizzle_orm2.relations)(pilotUpdates, ({ one }) => ({
  pilot: one(pilotActivities, { fields: [pilotUpdates.pilotId], references: [pilotActivities.id] }),
  createdBy: one(users, { fields: [pilotUpdates.createdByUserId], references: [users.id] })
}));
var implementationLessonsRelations = (0, import_drizzle_orm2.relations)(implementationLessons, ({ one }) => ({
  pilot: one(pilotActivities, { fields: [implementationLessons.pilotId], references: [pilotActivities.id] }),
  document: one(researchDocuments, { fields: [implementationLessons.documentId], references: [researchDocuments.id] })
}));
var downloadAssetsRelations = (0, import_drizzle_orm2.relations)(downloadAssets, ({ one }) => ({
  createdBy: one(users, { fields: [downloadAssets.createdByUserId], references: [users.id] })
}));
var researchDownloadEventsRelations = (0, import_drizzle_orm2.relations)(researchDownloadEvents, ({ one }) => ({
  document: one(researchDocuments, { fields: [researchDownloadEvents.documentId], references: [researchDocuments.id] }),
  asset: one(downloadAssets, { fields: [researchDownloadEvents.assetId], references: [downloadAssets.id] })
}));
var insertResearchDocumentSchema = (0, import_drizzle_zod2.createInsertSchema)(researchDocuments).omit({
  createdAt: true,
  updatedAt: true
}).extend({
  slug: import_zod.z.string().optional()
});
var insertPilotActivitySchema = (0, import_drizzle_zod2.createInsertSchema)(pilotActivities).omit({
  createdAt: true,
  updatedAt: true
}).extend({
  slug: import_zod.z.string().optional()
});
var insertPilotUpdateSchema = (0, import_drizzle_zod2.createInsertSchema)(pilotUpdates).omit({
  createdAt: true,
  updatedAt: true
});
var insertImplementationLessonSchema = (0, import_drizzle_zod2.createInsertSchema)(implementationLessons).omit({
  createdAt: true,
  updatedAt: true
}).extend({
  slug: import_zod.z.string().optional()
});
var insertDownloadAssetSchema = (0, import_drizzle_zod2.createInsertSchema)(downloadAssets).omit({
  createdAt: true,
  updatedAt: true
}).extend({
  slug: import_zod.z.string().optional()
});
var insertResearchInterestSubmissionSchema = (0, import_drizzle_zod2.createInsertSchema)(researchInterestSubmissions).omit({
  createdAt: true,
  updatedAt: true
});
var commodityTypeEnum = (0, import_pg_core2.pgEnum)("commodity_type", ["diluent", "syringe", "safety_box", "ppe", "cold_chain", "other", "recording_tools", "it_equipment", "transport", "stationaries", "social_mob"]);
var doseClassificationEnum = (0, import_pg_core2.pgEnum)("dose_classification", ["routine", "campaign", "outbreak", "school_based", "other"]);
var catalogueVaccines = (0, import_pg_core2.pgTable)("catalogue_vaccines", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  productId: (0, import_pg_core2.varchar)("product_id", { length: 100 }).notNull(),
  // e.g., 'vaccine_product_penta'
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  antigenName: (0, import_pg_core2.varchar)("antigen_name", { length: 255 }),
  category: (0, import_pg_core2.varchar)("category", { length: 100 }).default("Vaccine"),
  presentation: (0, import_pg_core2.varchar)("presentation", { length: 100 }),
  // e.g., 'Liquid', 'Lyophilized'
  dosesPerVial: (0, import_pg_core2.integer)("doses_per_vial").notNull().default(1),
  unitOfMeasure: (0, import_pg_core2.varchar)("unit_of_measure", { length: 50 }).default("vials"),
  storageTemperature: (0, import_pg_core2.varchar)("storage_temperature", { length: 50 }).default("+2 to +8 \xB0C"),
  wastageThreshold: (0, import_pg_core2.decimal)("wastage_threshold", { precision: 5, scale: 2 }).default("10.00"),
  // Legacy fallback
  stockManaged: (0, import_pg_core2.boolean)("stock_managed").default(true).notNull(),
  forecastable: (0, import_pg_core2.boolean)("forecastable").default(true).notNull(),
  requisitionable: (0, import_pg_core2.boolean)("requisitionable").default(true).notNull(),
  requiresDiluent: (0, import_pg_core2.boolean)("requires_diluent").default(false).notNull(),
  requiresInjectionDevice: (0, import_pg_core2.boolean)("requires_injection_device").default(true).notNull(),
  requiresSafetyBox: (0, import_pg_core2.boolean)("requires_safety_box").default(true).notNull(),
  routineUse: (0, import_pg_core2.boolean)("routine_use").default(true).notNull(),
  campaignUse: (0, import_pg_core2.boolean)("campaign_use").default(false).notNull(),
  outbreakUse: (0, import_pg_core2.boolean)("outbreak_use").default(false).notNull(),
  modules: (0, import_pg_core2.jsonb)("modules").default({}).notNull(),
  active: (0, import_pg_core2.boolean)("active").default(true).notNull(),
  approvalStatus: approvalStatusEnum("approval_status").default("draft").notNull(),
  effectiveStartDate: (0, import_pg_core2.timestamp)("effective_start_date").defaultNow(),
  effectiveEndDate: (0, import_pg_core2.timestamp)("effective_end_date"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_catalogue_vaccines_tenant").on(table.tenantId),
  productIdx: (0, import_pg_core2.index)("idx_catalogue_vaccines_product").on(table.productId)
}));
var catalogueScheduleDoses = (0, import_pg_core2.pgTable)("catalogue_schedule_doses", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  vaccineId: (0, import_pg_core2.integer)("vaccine_id").notNull().references(() => catalogueVaccines.id, { onDelete: "cascade" }),
  doseCode: (0, import_pg_core2.varchar)("dose_code", { length: 100 }).notNull(),
  name: (0, import_pg_core2.varchar)("name", { length: 100 }).notNull(),
  // e.g., PENTA-1
  doseNumber: (0, import_pg_core2.integer)("dose_number").notNull().default(1),
  targetAge: (0, import_pg_core2.varchar)("target_age", { length: 100 }),
  minimumAge: (0, import_pg_core2.varchar)("minimum_age", { length: 100 }),
  maximumAge: (0, import_pg_core2.varchar)("maximum_age", { length: 100 }),
  minimumInterval: (0, import_pg_core2.varchar)("minimum_interval", { length: 100 }),
  targetPopulationGroup: (0, import_pg_core2.varchar)("target_population_group", { length: 100 }).default("infants"),
  route: (0, import_pg_core2.varchar)("route", { length: 100 }),
  // e.g., 'IM', 'Oral'
  site: (0, import_pg_core2.varchar)("site", { length: 100 }),
  // e.g., 'Left Thigh'
  classification: doseClassificationEnum("classification").default("routine").notNull(),
  stockDeducting: (0, import_pg_core2.boolean)("stock_deducting").default(true).notNull(),
  active: (0, import_pg_core2.boolean)("active").default(true).notNull(),
  effectiveStartDate: (0, import_pg_core2.timestamp)("effective_start_date").defaultNow(),
  approvalStatus: approvalStatusEnum("approval_status").default("draft").notNull(),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_catalogue_doses_tenant").on(table.tenantId),
  vaccineIdx: (0, import_pg_core2.index)("idx_catalogue_doses_vaccine").on(table.vaccineId)
}));
var catalogueCommodities = (0, import_pg_core2.pgTable)("catalogue_commodities", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  commodityCode: (0, import_pg_core2.varchar)("commodity_code", { length: 100 }).notNull(),
  type: commodityTypeEnum("type").notNull(),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  category: (0, import_pg_core2.varchar)("category", { length: 100 }),
  unitOfMeasure: (0, import_pg_core2.varchar)("unit_of_measure", { length: 50 }).default("pieces"),
  packSize: (0, import_pg_core2.integer)("pack_size").default(100).notNull(),
  stockManaged: (0, import_pg_core2.boolean)("stock_managed").default(true).notNull(),
  forecastable: (0, import_pg_core2.boolean)("forecastable").default(true).notNull(),
  requisitionable: (0, import_pg_core2.boolean)("requisitionable").default(true).notNull(),
  sessionSupply: (0, import_pg_core2.boolean)("session_supply").default(true).notNull(),
  linkedVaccineId: (0, import_pg_core2.integer)("linked_vaccine_id").references(() => catalogueVaccines.id, { onDelete: "set null" }),
  consumptionRule: (0, import_pg_core2.jsonb)("consumption_rule").default({}),
  bufferPercentage: (0, import_pg_core2.decimal)("buffer_percentage", { precision: 5, scale: 2 }).default("10.00"),
  minimumStockThreshold: (0, import_pg_core2.integer)("minimum_stock_threshold").default(0),
  maximumStockThreshold: (0, import_pg_core2.integer)("maximum_stock_threshold").default(0),
  reorderLevel: (0, import_pg_core2.integer)("reorder_level").default(0),
  modules: (0, import_pg_core2.jsonb)("modules").default({}).notNull(),
  active: (0, import_pg_core2.boolean)("active").default(true).notNull(),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_catalogue_commodities_tenant").on(table.tenantId),
  commodityCodeIdx: (0, import_pg_core2.index)("idx_catalogue_commodities_code").on(table.commodityCode)
}));
var catalogueWastageThresholds = (0, import_pg_core2.pgTable)("catalogue_wastage_thresholds", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  vaccineId: (0, import_pg_core2.integer)("vaccine_id").notNull().references(() => catalogueVaccines.id, { onDelete: "cascade" }),
  wastageRate: (0, import_pg_core2.decimal)("wastage_rate", { precision: 5, scale: 2 }).notNull(),
  wastageFactor: (0, import_pg_core2.decimal)("wastage_factor", { precision: 5, scale: 2 }).notNull(),
  minAcceptable: (0, import_pg_core2.decimal)("min_acceptable", { precision: 5, scale: 2 }),
  maxAcceptable: (0, import_pg_core2.decimal)("max_acceptable", { precision: 5, scale: 2 }),
  strategy: (0, import_pg_core2.varchar)("strategy", { length: 100 }).default("routine"),
  // 'fixed', 'outreach', 'campaign', 'htr'
  active: (0, import_pg_core2.boolean)("active").default(true).notNull(),
  notes: (0, import_pg_core2.text)("notes"),
  effectiveStartDate: (0, import_pg_core2.timestamp)("effective_start_date").defaultNow(),
  effectiveEndDate: (0, import_pg_core2.timestamp)("effective_end_date"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_catalogue_wastage_tenant").on(table.tenantId),
  vaccineIdx: (0, import_pg_core2.index)("idx_catalogue_wastage_vaccine").on(table.vaccineId)
}));
var insertCatalogueVaccineSchema = (0, import_drizzle_zod2.createInsertSchema)(catalogueVaccines);
var selectCatalogueVaccineSchema = (0, import_drizzle_zod2.createSelectSchema)(catalogueVaccines);
var insertCatalogueScheduleDoseSchema = (0, import_drizzle_zod2.createInsertSchema)(catalogueScheduleDoses);
var selectCatalogueScheduleDoseSchema = (0, import_drizzle_zod2.createSelectSchema)(catalogueScheduleDoses);
var insertCatalogueCommoditySchema = (0, import_drizzle_zod2.createInsertSchema)(catalogueCommodities);
var selectCatalogueCommoditySchema = (0, import_drizzle_zod2.createSelectSchema)(catalogueCommodities);
var insertCatalogueWastageThresholdSchema = (0, import_drizzle_zod2.createInsertSchema)(catalogueWastageThresholds);
var selectCatalogueWastageThresholdSchema = (0, import_drizzle_zod2.createSelectSchema)(catalogueWastageThresholds);
var gisPolygonTypeEnum = (0, import_pg_core2.pgEnum)("gis_polygon_type", [
  "catchment",
  "outreach_area",
  "administrative_boundary",
  "custom"
]);
var gisPolygons = (0, import_pg_core2.pgTable)("gis_polygons", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  ownerType: (0, import_pg_core2.varchar)("owner_type", { length: 50 }).notNull(),
  // 'facility', 'district', 'province', 'village', etc.
  ownerId: (0, import_pg_core2.integer)("owner_id").notNull(),
  polygonType: gisPolygonTypeEnum("polygon_type").notNull().default("catchment"),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }),
  description: (0, import_pg_core2.text)("description"),
  geometry: (0, import_pg_core2.jsonb)("geometry").notNull(),
  // Stores GeoJSON natively
  areaSqKm: (0, import_pg_core2.decimal)("area_sq_km", { precision: 10, scale: 2 }),
  perimeterKm: (0, import_pg_core2.decimal)("perimeter_km", { precision: 10, scale: 2 }),
  source: (0, import_pg_core2.varchar)("source", { length: 100 }),
  // 'manual', 'buffer', 'convex_hull', 'import'
  method: (0, import_pg_core2.varchar)("method", { length: 100 }),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("active"),
  version: (0, import_pg_core2.integer)("version").default(1),
  previousVersionId: (0, import_pg_core2.integer)("previous_version_id"),
  replacedVersionId: (0, import_pg_core2.integer)("replaced_version_id"),
  parentFacilityId: (0, import_pg_core2.integer)("parent_facility_id"),
  isActive: (0, import_pg_core2.boolean)("is_active").default(true),
  validFrom: (0, import_pg_core2.timestamp)("valid_from").defaultNow(),
  validTo: (0, import_pg_core2.timestamp)("valid_to"),
  changeType: (0, import_pg_core2.varchar)("change_type", { length: 50 }).default("created"),
  changeReason: (0, import_pg_core2.text)("change_reason"),
  submittedBy: (0, import_pg_core2.varchar)("submitted_by", { length: 255 }),
  submittedAt: (0, import_pg_core2.timestamp)("submitted_at"),
  rejectionReason: (0, import_pg_core2.text)("rejection_reason"),
  metadataJson: (0, import_pg_core2.jsonb)("metadata_json").default({}),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow(),
  centroid: (0, import_pg_core2.jsonb)("centroid"),
  populationEstimate: (0, import_pg_core2.integer)("population_estimate"),
  populationSource: (0, import_pg_core2.varchar)("population_source", { length: 100 }),
  populationSourceYear: (0, import_pg_core2.integer)("population_source_year"),
  populationMethod: (0, import_pg_core2.varchar)("population_method", { length: 100 }),
  confidence: (0, import_pg_core2.varchar)("confidence", { length: 50 }),
  validationStatus: (0, import_pg_core2.varchar)("validation_status", { length: 50 }).default("draft"),
  approvalStatus: (0, import_pg_core2.varchar)("approval_status", { length: 50 }).default("draft"),
  overrideReason: (0, import_pg_core2.text)("override_reason"),
  createdBy: (0, import_pg_core2.varchar)("created_by", { length: 255 }),
  approvedBy: (0, import_pg_core2.varchar)("approved_by", { length: 255 }),
  approvedAt: (0, import_pg_core2.timestamp)("approved_at")
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_gis_polygons_tenant").on(table.tenantId),
  ownerIdx: (0, import_pg_core2.index)("idx_gis_polygons_owner").on(table.ownerType, table.ownerId),
  ownerVersionIdx: (0, import_pg_core2.index)("idx_gis_polygons_owner_version").on(table.tenantId, table.ownerType, table.ownerId, table.version)
}));
var gisPolygonsRelations = (0, import_drizzle_orm2.relations)(gisPolygons, ({ one }) => ({
  tenant: one(tenants, {
    fields: [gisPolygons.tenantId],
    references: [tenants.id]
  })
}));
var insertGisPolygonSchema = (0, import_drizzle_zod2.createInsertSchema)(gisPolygons);
var selectGisPolygonSchema = (0, import_drizzle_zod2.createSelectSchema)(gisPolygons);
var vgieRecommendationRules = (0, import_pg_core2.pgTable)("vgie_recommendation_rules", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  description: (0, import_pg_core2.text)("description"),
  category: (0, import_pg_core2.varchar)("category", { length: 100 }).notNull(),
  // 'accessibility', 'population', 'coverage', 'infrastructure'
  conditionSql: (0, import_pg_core2.text)("condition_sql").notNull(),
  // Evaluated logic expression
  recommendationText: (0, import_pg_core2.text)("recommendation_text").notNull(),
  priority: (0, import_pg_core2.varchar)("priority", { length: 50 }).notNull().default("medium"),
  // 'high', 'medium', 'low'
  isActive: (0, import_pg_core2.boolean)("is_active").default(true).notNull(),
  createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_vgie_rec_rules_tenant").on(table.tenantId)
}));
var vgieAlertRules = (0, import_pg_core2.pgTable)("vgie_alert_rules", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  description: (0, import_pg_core2.text)("description"),
  severity: (0, import_pg_core2.varchar)("severity", { length: 50 }).notNull().default("warning"),
  // 'critical', 'warning', 'info'
  triggerCondition: (0, import_pg_core2.text)("trigger_condition").notNull(),
  alertTemplate: (0, import_pg_core2.text)("alert_template").notNull(),
  isActive: (0, import_pg_core2.boolean)("is_active").default(true).notNull(),
  createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_vgie_alert_rules_tenant").on(table.tenantId)
}));
var vgieRecommendationRulesRelations = (0, import_drizzle_orm2.relations)(vgieRecommendationRules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [vgieRecommendationRules.tenantId],
    references: [tenants.id]
  })
}));
var vgieAlertRulesRelations = (0, import_drizzle_orm2.relations)(vgieAlertRules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [vgieAlertRules.tenantId],
    references: [tenants.id]
  })
}));
var insertVgieRecommendationRuleSchema = (0, import_drizzle_zod2.createInsertSchema)(vgieRecommendationRules);
var selectVgieRecommendationRuleSchema = (0, import_drizzle_zod2.createSelectSchema)(vgieRecommendationRules);
var insertVgieAlertRuleSchema = (0, import_drizzle_zod2.createInsertSchema)(vgieAlertRules);
var selectVgieAlertRuleSchema = (0, import_drizzle_zod2.createSelectSchema)(vgieAlertRules);
var entityHistoryVersions = (0, import_pg_core2.pgTable)("entity_history_versions", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  stableEntityId: (0, import_pg_core2.varchar)("stable_entity_id", { length: 255 }).notNull(),
  entityType: (0, import_pg_core2.varchar)("entity_type", { length: 100 }).notNull(),
  // 'user' | 'facility' | 'community' | 'population' | 'vaccine_schedule' | 'stock_reference'
  versionNumber: (0, import_pg_core2.integer)("version_number").notNull().default(1),
  countryId: (0, import_pg_core2.integer)("country_id"),
  provinceId: (0, import_pg_core2.integer)("province_id"),
  districtId: (0, import_pg_core2.integer)("district_id"),
  facilityId: (0, import_pg_core2.integer)("facility_id"),
  validFrom: (0, import_pg_core2.timestamp)("valid_from").notNull().defaultNow(),
  validTo: (0, import_pg_core2.timestamp)("valid_to"),
  recordedAt: (0, import_pg_core2.timestamp)("recorded_at").notNull().defaultNow(),
  recordedUntil: (0, import_pg_core2.timestamp)("recorded_until"),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).notNull().default("active"),
  // 'draft' | 'pending_review' | 'approved' | 'active' | 'superseded' | 'rejected' | 'corrected' | 'cancelled'
  isCurrent: (0, import_pg_core2.boolean)("is_current").notNull().default(true),
  changeType: (0, import_pg_core2.varchar)("change_type", { length: 100 }).notNull().default("created"),
  // 'created' | 'updated' | 'reclassified' | 'transferred' | 'role_changed' | 'realigned' | 'corrected' | 'status_changed' | 'catchment_updated'
  changeReason: (0, import_pg_core2.text)("change_reason"),
  changeSummary: (0, import_pg_core2.text)("change_summary"),
  sourceType: (0, import_pg_core2.varchar)("source_type", { length: 100 }).default("manual"),
  // 'manual' | 'census' | 'survey' | 'gis_import' | 'gazette' | 'administrative_order' | 'system'
  sourceReference: (0, import_pg_core2.text)("source_reference"),
  sourceDocumentUrl: (0, import_pg_core2.text)("source_document_url"),
  createdBy: (0, import_pg_core2.varchar)("created_by", { length: 255 }),
  reviewedBy: (0, import_pg_core2.varchar)("reviewed_by", { length: 255 }),
  approvedBy: (0, import_pg_core2.varchar)("approved_by", { length: 255 }),
  approvedAt: (0, import_pg_core2.timestamp)("approved_at"),
  supersededBy: (0, import_pg_core2.integer)("superseded_by"),
  correctedFromVersionId: (0, import_pg_core2.integer)("corrected_from_version_id"),
  metadataJson: (0, import_pg_core2.jsonb)("metadata_json").default({}),
  snapshotData: (0, import_pg_core2.jsonb)("snapshot_data").default({}),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_entity_hist_tenant").on(table.tenantId),
  entityTypeIdx: (0, import_pg_core2.index)("idx_entity_hist_type_entity").on(table.tenantId, table.entityType, table.stableEntityId),
  isCurrentIdx: (0, import_pg_core2.index)("idx_entity_hist_current").on(table.tenantId, table.entityType, table.stableEntityId, table.isCurrent),
  validFromToIdx: (0, import_pg_core2.index)("idx_entity_hist_valid_dates").on(table.tenantId, table.validFrom, table.validTo)
}));
var userAssignmentHistory = (0, import_pg_core2.pgTable)("user_assignment_history", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  versionId: (0, import_pg_core2.integer)("version_id").references(() => entityHistoryVersions.id, { onDelete: "cascade" }),
  userId: (0, import_pg_core2.varchar)("user_id", { length: 255 }).notNull(),
  roleId: (0, import_pg_core2.varchar)("role_id", { length: 100 }),
  roleName: (0, import_pg_core2.varchar)("role_name", { length: 255 }),
  assignmentType: (0, import_pg_core2.varchar)("assignment_type", { length: 50 }).notNull().default("substantive"),
  // 'substantive' | 'acting' | 'delegated' | 'temporary' | 'expired'
  countryId: (0, import_pg_core2.integer)("country_id"),
  provinceId: (0, import_pg_core2.integer)("province_id"),
  districtId: (0, import_pg_core2.integer)("district_id"),
  facilityId: (0, import_pg_core2.integer)("facility_id"),
  validFrom: (0, import_pg_core2.timestamp)("valid_from").notNull().defaultNow(),
  validTo: (0, import_pg_core2.timestamp)("valid_to"),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).notNull().default("active"),
  assignedBy: (0, import_pg_core2.varchar)("assigned_by", { length: 255 }),
  approvedBy: (0, import_pg_core2.varchar)("approved_by", { length: 255 }),
  reason: (0, import_pg_core2.text)("reason"),
  permissions: (0, import_pg_core2.jsonb)("permissions").default([]),
  metadataJson: (0, import_pg_core2.jsonb)("metadata_json").default({}),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_user_assign_hist_tenant").on(table.tenantId),
  userIdx: (0, import_pg_core2.index)("idx_user_assign_hist_user").on(table.tenantId, table.userId)
}));
var facilityHistoryVersions = (0, import_pg_core2.pgTable)("facility_history_versions", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  versionId: (0, import_pg_core2.integer)("version_id").references(() => entityHistoryVersions.id, { onDelete: "cascade" }),
  facilityId: (0, import_pg_core2.integer)("facility_id").notNull(),
  versionNumber: (0, import_pg_core2.integer)("version_number").notNull().default(1),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  hmisCode: (0, import_pg_core2.varchar)("hmis_code", { length: 100 }),
  facilityType: (0, import_pg_core2.varchar)("facility_type", { length: 100 }),
  ownership: (0, import_pg_core2.varchar)("ownership", { length: 100 }),
  operationalStatus: (0, import_pg_core2.varchar)("operational_status", { length: 50 }).default("operational"),
  countryId: (0, import_pg_core2.integer)("country_id"),
  provinceId: (0, import_pg_core2.integer)("province_id"),
  districtId: (0, import_pg_core2.integer)("district_id"),
  latitude: (0, import_pg_core2.decimal)("latitude", { precision: 10, scale: 7 }),
  longitude: (0, import_pg_core2.decimal)("longitude", { precision: 10, scale: 7 }),
  catchmentPolygon: (0, import_pg_core2.jsonb)("catchment_polygon"),
  coldChainStatus: (0, import_pg_core2.varchar)("cold_chain_status", { length: 50 }).default("No"),
  staffCount: (0, import_pg_core2.integer)("staff_count").default(0),
  validFrom: (0, import_pg_core2.timestamp)("valid_from").notNull().defaultNow(),
  validTo: (0, import_pg_core2.timestamp)("valid_to"),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("active"),
  changeReason: (0, import_pg_core2.text)("change_reason"),
  approvedBy: (0, import_pg_core2.varchar)("approved_by", { length: 255 }),
  metadataJson: (0, import_pg_core2.jsonb)("metadata_json").default({}),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_fac_hist_tenant").on(table.tenantId),
  facIdx: (0, import_pg_core2.index)("idx_fac_hist_facility").on(table.tenantId, table.facilityId)
}));
var communityHistoryVersions = (0, import_pg_core2.pgTable)("community_history_versions", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  versionId: (0, import_pg_core2.integer)("version_id").references(() => entityHistoryVersions.id, { onDelete: "cascade" }),
  villageId: (0, import_pg_core2.integer)("village_id").notNull(),
  versionNumber: (0, import_pg_core2.integer)("version_number").notNull().default(1),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  code: (0, import_pg_core2.varchar)("code", { length: 100 }),
  assignedFacilityId: (0, import_pg_core2.integer)("assigned_facility_id"),
  districtId: (0, import_pg_core2.integer)("district_id"),
  latitude: (0, import_pg_core2.decimal)("latitude", { precision: 10, scale: 7 }),
  longitude: (0, import_pg_core2.decimal)("longitude", { precision: 10, scale: 7 }),
  catchmentPolygon: (0, import_pg_core2.jsonb)("catchment_polygon"),
  isHardToReach: (0, import_pg_core2.boolean)("is_hard_to_reach").default(false),
  terrainDifficulty: (0, import_pg_core2.integer)("terrain_difficulty"),
  populationEstimate: (0, import_pg_core2.integer)("population_estimate"),
  validFrom: (0, import_pg_core2.timestamp)("valid_from").notNull().defaultNow(),
  validTo: (0, import_pg_core2.timestamp)("valid_to"),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("active"),
  changeReason: (0, import_pg_core2.text)("change_reason"),
  approvedBy: (0, import_pg_core2.varchar)("approved_by", { length: 255 }),
  metadataJson: (0, import_pg_core2.jsonb)("metadata_json").default({}),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_comm_hist_tenant").on(table.tenantId),
  villageIdx: (0, import_pg_core2.index)("idx_comm_hist_village").on(table.tenantId, table.villageId)
}));
var populationHistoryVersions = (0, import_pg_core2.pgTable)("population_history_versions", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  versionId: (0, import_pg_core2.integer)("version_id").references(() => entityHistoryVersions.id, { onDelete: "cascade" }),
  populationEntityId: (0, import_pg_core2.varchar)("population_entity_id", { length: 255 }).notNull(),
  geographicUnitType: (0, import_pg_core2.varchar)("geographic_unit_type", { length: 50 }).notNull(),
  geographicUnitId: (0, import_pg_core2.integer)("geographic_unit_id").notNull(),
  source: (0, import_pg_core2.varchar)("source", { length: 100 }).notNull(),
  sourceYear: (0, import_pg_core2.integer)("source_year").notNull(),
  datasetVersion: (0, import_pg_core2.varchar)("dataset_version", { length: 100 }),
  method: (0, import_pg_core2.varchar)("method", { length: 100 }),
  totalPopulation: (0, import_pg_core2.integer)("total_population").notNull(),
  targetInfants: (0, import_pg_core2.integer)("target_infants"),
  underOne: (0, import_pg_core2.integer)("under_one"),
  underFive: (0, import_pg_core2.integer)("under_five"),
  womenOfReproductiveAge: (0, import_pg_core2.integer)("women_of_reproductive_age"),
  confidence: (0, import_pg_core2.varchar)("confidence", { length: 50 }),
  planningStatus: (0, import_pg_core2.varchar)("planning_status", { length: 50 }).default("official"),
  usedInMicroplans: (0, import_pg_core2.jsonb)("used_in_microplans").default([]),
  validFrom: (0, import_pg_core2.timestamp)("valid_from").notNull().defaultNow(),
  validTo: (0, import_pg_core2.timestamp)("valid_to"),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("active"),
  changeReason: (0, import_pg_core2.text)("change_reason"),
  approvedBy: (0, import_pg_core2.varchar)("approved_by", { length: 255 }),
  metadataJson: (0, import_pg_core2.jsonb)("metadata_json").default({}),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_pop_hist_tenant").on(table.tenantId),
  geoIdx: (0, import_pg_core2.index)("idx_pop_hist_geo").on(table.tenantId, table.geographicUnitType, table.geographicUnitId)
}));
var vaccineScheduleHistoryVersions = (0, import_pg_core2.pgTable)("vaccine_schedule_history_versions", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  versionId: (0, import_pg_core2.integer)("version_id").references(() => entityHistoryVersions.id, { onDelete: "cascade" }),
  scheduleId: (0, import_pg_core2.integer)("schedule_id").notNull(),
  antigenCode: (0, import_pg_core2.varchar)("antigen_code", { length: 100 }).notNull(),
  doseNumber: (0, import_pg_core2.integer)("dose_number").notNull(),
  vaccineProductId: (0, import_pg_core2.integer)("vaccine_product_id"),
  dosesPerVial: (0, import_pg_core2.integer)("doses_per_vial"),
  wastageFactor: (0, import_pg_core2.decimal)("wastage_factor", { precision: 5, scale: 2 }),
  targetAgeGroup: (0, import_pg_core2.varchar)("target_age_group", { length: 100 }),
  validFrom: (0, import_pg_core2.timestamp)("valid_from").notNull().defaultNow(),
  validTo: (0, import_pg_core2.timestamp)("valid_to"),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("active"),
  changeReason: (0, import_pg_core2.text)("change_reason"),
  approvedBy: (0, import_pg_core2.varchar)("approved_by", { length: 255 }),
  metadataJson: (0, import_pg_core2.jsonb)("metadata_json").default({}),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_vac_sched_hist_tenant").on(table.tenantId),
  schedIdx: (0, import_pg_core2.index)("idx_vac_sched_hist_id").on(table.tenantId, table.scheduleId)
}));
var stockReferenceHistoryVersions = (0, import_pg_core2.pgTable)("stock_reference_history_versions", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  versionId: (0, import_pg_core2.integer)("version_id").references(() => entityHistoryVersions.id, { onDelete: "cascade" }),
  itemId: (0, import_pg_core2.integer)("item_id"),
  equipmentId: (0, import_pg_core2.integer)("equipment_id"),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  minStockLevel: (0, import_pg_core2.integer)("min_stock_level"),
  maxStockLevel: (0, import_pg_core2.integer)("max_stock_level"),
  bufferStockPolicy: (0, import_pg_core2.text)("buffer_stock_policy"),
  equipmentStatus: (0, import_pg_core2.varchar)("equipment_status", { length: 50 }),
  locationFacilityId: (0, import_pg_core2.integer)("location_facility_id"),
  ownership: (0, import_pg_core2.varchar)("ownership", { length: 100 }),
  validFrom: (0, import_pg_core2.timestamp)("valid_from").notNull().defaultNow(),
  validTo: (0, import_pg_core2.timestamp)("valid_to"),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).default("active"),
  changeReason: (0, import_pg_core2.text)("change_reason"),
  approvedBy: (0, import_pg_core2.varchar)("approved_by", { length: 255 }),
  metadataJson: (0, import_pg_core2.jsonb)("metadata_json").default({}),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_stock_ref_hist_tenant").on(table.tenantId)
}));
var reportEntitySnapshots = (0, import_pg_core2.pgTable)("report_entity_snapshots", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  reportType: (0, import_pg_core2.varchar)("report_type", { length: 100 }).notNull(),
  reportId: (0, import_pg_core2.varchar)("report_id", { length: 255 }).notNull(),
  facilityVersionId: (0, import_pg_core2.integer)("facility_version_id"),
  geographyVersionId: (0, import_pg_core2.integer)("geography_version_id"),
  populationVersionId: (0, import_pg_core2.integer)("population_version_id"),
  vaccineScheduleVersionId: (0, import_pg_core2.integer)("vaccine_schedule_version_id"),
  userRoleVersionId: (0, import_pg_core2.integer)("user_role_version_id"),
  snapshotData: (0, import_pg_core2.jsonb)("snapshot_data").notNull().default({}),
  frozenAt: (0, import_pg_core2.timestamp)("frozen_at").notNull().defaultNow(),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_rep_snaps_tenant").on(table.tenantId),
  reportIdx: (0, import_pg_core2.index)("idx_rep_snaps_report").on(table.tenantId, table.reportType, table.reportId)
}));
var insertEntityHistoryVersionSchema = (0, import_drizzle_zod2.createInsertSchema)(entityHistoryVersions);
var selectEntityHistoryVersionSchema = (0, import_drizzle_zod2.createSelectSchema)(entityHistoryVersions);
var insertUserAssignmentHistorySchema = (0, import_drizzle_zod2.createInsertSchema)(userAssignmentHistory);
var selectUserAssignmentHistorySchema = (0, import_drizzle_zod2.createSelectSchema)(userAssignmentHistory);
var insertFacilityHistoryVersionSchema = (0, import_drizzle_zod2.createInsertSchema)(facilityHistoryVersions);
var selectFacilityHistoryVersionSchema = (0, import_drizzle_zod2.createSelectSchema)(facilityHistoryVersions);
var insertCommunityHistoryVersionSchema = (0, import_drizzle_zod2.createInsertSchema)(communityHistoryVersions);
var selectCommunityHistoryVersionSchema = (0, import_drizzle_zod2.createSelectSchema)(communityHistoryVersions);
var insertPopulationHistoryVersionSchema = (0, import_drizzle_zod2.createInsertSchema)(populationHistoryVersions);
var selectPopulationHistoryVersionSchema = (0, import_drizzle_zod2.createSelectSchema)(populationHistoryVersions);
var insertVaccineScheduleHistoryVersionSchema = (0, import_drizzle_zod2.createInsertSchema)(vaccineScheduleHistoryVersions);
var selectVaccineScheduleHistoryVersionSchema = (0, import_drizzle_zod2.createSelectSchema)(vaccineScheduleHistoryVersions);
var insertStockReferenceHistoryVersionSchema = (0, import_drizzle_zod2.createInsertSchema)(stockReferenceHistoryVersions);
var selectStockReferenceHistoryVersionSchema = (0, import_drizzle_zod2.createSelectSchema)(stockReferenceHistoryVersions);
var insertReportEntitySnapshotSchema = (0, import_drizzle_zod2.createInsertSchema)(reportEntitySnapshots);
var selectReportEntitySnapshotSchema = (0, import_drizzle_zod2.createSelectSchema)(reportEntitySnapshots);
var supervisionQuestionBank = (0, import_pg_core2.pgTable)("supervision_question_bank", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  category: (0, import_pg_core2.varchar)("category", { length: 100 }).notNull().default("supervision"),
  programModule: (0, import_pg_core2.varchar)("program_module", { length: 100 }).default("epi"),
  indicatorMapping: (0, import_pg_core2.varchar)("indicator_mapping", { length: 255 }),
  dataElementMapping: (0, import_pg_core2.varchar)("data_element_mapping", { length: 255 }),
  questionText: (0, import_pg_core2.text)("question_text").notNull(),
  shortLabel: (0, import_pg_core2.varchar)("short_label", { length: 200 }),
  answerType: (0, import_pg_core2.varchar)("answer_type", { length: 50 }).notNull().default("yes_no"),
  options: (0, import_pg_core2.jsonb)("options").default([]),
  scoreWeight: (0, import_pg_core2.decimal)("score_weight", { precision: 5, scale: 2 }).default("1.0"),
  helpText: (0, import_pg_core2.text)("help_text"),
  tags: (0, import_pg_core2.jsonb)("tags").default([]),
  isGlobal: (0, import_pg_core2.boolean)("is_global").default(false),
  createdByUserId: (0, import_pg_core2.varchar)("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at").defaultNow().notNull()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_sup_qbank_tenant").on(table.tenantId),
  categoryIdx: (0, import_pg_core2.index)("idx_sup_qbank_category").on(table.tenantId, table.category)
}));
var supervisionTemplateVersions = (0, import_pg_core2.pgTable)("supervision_template_versions", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  templateId: (0, import_pg_core2.integer)("template_id").notNull(),
  versionNumber: (0, import_pg_core2.integer)("version_number").notNull().default(1),
  name: (0, import_pg_core2.varchar)("name", { length: 255 }).notNull(),
  category: (0, import_pg_core2.varchar)("category", { length: 100 }).notNull().default("supervision"),
  description: (0, import_pg_core2.text)("description"),
  applicableLevel: (0, import_pg_core2.varchar)("applicable_level", { length: 50 }).default("facility"),
  sections: (0, import_pg_core2.jsonb)("sections").default([]).notNull(),
  items: (0, import_pg_core2.jsonb)("items").default([]).notNull(),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).notNull().default("published"),
  changeSummary: (0, import_pg_core2.text)("change_summary"),
  publishedByUserId: (0, import_pg_core2.varchar)("published_by_user_id").references(() => users.id, { onDelete: "set null" }),
  publishedAt: (0, import_pg_core2.timestamp)("published_at").defaultNow().notNull(),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_sup_tmpl_vers_tenant").on(table.tenantId),
  tmplVersionIdx: (0, import_pg_core2.index)("idx_sup_tmpl_vers_num").on(table.tenantId, table.templateId, table.versionNumber)
}));
var supervisionTemplateAuditLogs = (0, import_pg_core2.pgTable)("supervision_template_audit_logs", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  templateId: (0, import_pg_core2.integer)("template_id").notNull(),
  action: (0, import_pg_core2.varchar)("action", { length: 100 }).notNull(),
  // created, draft_updated, published, archived, duplicated, imported
  performedByUserId: (0, import_pg_core2.varchar)("performed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  performedByUserName: (0, import_pg_core2.varchar)("performed_by_user_name", { length: 255 }),
  reason: (0, import_pg_core2.text)("reason"),
  metadata: (0, import_pg_core2.jsonb)("metadata").default({}),
  timestamp: (0, import_pg_core2.timestamp)("timestamp").defaultNow().notNull()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_sup_tmpl_audit_tenant").on(table.tenantId)
}));
var clientImportBatches = (0, import_pg_core2.pgTable)("client_import_batches", {
  id: (0, import_pg_core2.varchar)("id").primaryKey().default(import_drizzle_orm2.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  fileName: (0, import_pg_core2.varchar)("file_name", { length: 255 }).notNull(),
  fileType: (0, import_pg_core2.varchar)("file_type", { length: 20 }).notNull().default("csv"),
  totalRows: (0, import_pg_core2.integer)("total_rows").notNull().default(0),
  validRows: (0, import_pg_core2.integer)("valid_rows").notNull().default(0),
  invalidRows: (0, import_pg_core2.integer)("invalid_rows").notNull().default(0),
  duplicateRows: (0, import_pg_core2.integer)("duplicate_rows").notNull().default(0),
  importedCount: (0, import_pg_core2.integer)("imported_count").notNull().default(0),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).notNull().default("completed"),
  errors: (0, import_pg_core2.jsonb)("errors").default([]),
  importedByUserId: (0, import_pg_core2.varchar)("imported_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow().notNull()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_client_import_tenant").on(table.tenantId)
}));
var clientDuplicateCandidates = (0, import_pg_core2.pgTable)("client_duplicate_candidates", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  primaryClientId: (0, import_pg_core2.varchar)("primary_client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  duplicateClientId: (0, import_pg_core2.varchar)("duplicate_client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  matchReason: (0, import_pg_core2.varchar)("match_reason", { length: 255 }).notNull(),
  // e.g. "Facility + Name + DOB", "Phone + Child Name"
  confidenceScore: (0, import_pg_core2.decimal)("confidence_score", { precision: 5, scale: 2 }).default("0.90"),
  status: (0, import_pg_core2.varchar)("status", { length: 50 }).notNull().default("pending"),
  // pending, merged, dismissed
  detectedAt: (0, import_pg_core2.timestamp)("detected_at").defaultNow().notNull()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_client_dupes_tenant").on(table.tenantId),
  primaryClientIdx: (0, import_pg_core2.index)("idx_client_dupes_primary").on(table.primaryClientId)
}));
var clientBulkActionLogs = (0, import_pg_core2.pgTable)("client_bulk_action_logs", {
  id: (0, import_pg_core2.integer)("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: (0, import_pg_core2.varchar)("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  actionType: (0, import_pg_core2.varchar)("action_type", { length: 100 }).notNull(),
  // archive, restore, delete, assign_facility, status_update, add_tag, remove_tag
  affectedCount: (0, import_pg_core2.integer)("affected_count").notNull().default(0),
  clientIds: (0, import_pg_core2.jsonb)("client_ids").notNull().default([]),
  reason: (0, import_pg_core2.text)("reason"),
  performedByUserId: (0, import_pg_core2.varchar)("performed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  performedByUserName: (0, import_pg_core2.varchar)("performed_by_user_name", { length: 255 }),
  metadata: (0, import_pg_core2.jsonb)("metadata").default({}),
  timestamp: (0, import_pg_core2.timestamp)("timestamp").defaultNow().notNull()
}, (table) => ({
  tenantIdx: (0, import_pg_core2.index)("idx_client_bulk_log_tenant").on(table.tenantId)
}));
var insertSupervisionQuestionBankSchema = (0, import_drizzle_zod2.createInsertSchema)(supervisionQuestionBank);
var selectSupervisionQuestionBankSchema = (0, import_drizzle_zod2.createSelectSchema)(supervisionQuestionBank);
var insertClientImportBatchSchema = (0, import_drizzle_zod2.createInsertSchema)(clientImportBatches);
var selectClientImportBatchSchema = (0, import_drizzle_zod2.createSelectSchema)(clientImportBatches);

// server/db.ts
var { Pool } = import_pg.default;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var connString = process.env.DATABASE_URL;
if ((connString.includes("supabase.co") || connString.includes("upstash.io")) && !connString.includes("sslmode=")) {
  connString += connString.includes("?") ? "&sslmode=require" : "?sslmode=require";
}
var pool = new Pool({ connectionString: connString });
var db = (0, import_node_postgres.drizzle)(pool, { schema: schema_exports });

// scripts/railway-bootstrap.ts
var import_drizzle_orm3 = require("drizzle-orm");
var import_child_process = require("child_process");
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`Running command: ${command} ${args.join(" ")}`);
    const child = (0, import_child_process.spawn)(command, args, {
      stdio: "inherit",
      shell: true
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command ${command} exited with code ${code}`));
      }
    });
    child.on("error", (err) => {
      reject(err);
    });
  });
}
async function bootstrap() {
  console.log("[Railway Bootstrap] Starting database migration...");
  try {
    await runCommand("node", ["dist/migrate.cjs"]);
    console.log("[Railway Bootstrap] Migrations applied successfully.");
  } catch (err) {
    console.error("[Railway Bootstrap] Migration run failed:", err.message);
    process.exit(1);
  }
  console.log("[Railway Bootstrap] Checking database content state...");
  try {
    const result = await db.execute(import_drizzle_orm3.sql`SELECT COUNT(*)::int as count FROM tenants`);
    const count = result.rows[0]?.count ?? 0;
    if (count === 0) {
      console.log("[Railway Bootstrap] Database is empty (0 tenants found). Triggering first-run database seed...");
      await runCommand("npx", ["tsx", "scripts/seed-all.ts"]);
      console.log("[Railway Bootstrap] Seeding sequence completed successfully.");
    } else {
      console.log(`[Railway Bootstrap] Database already initialized with ${count} tenant(s). Skipping seeding.`);
    }
  } catch (err) {
    console.error("[Railway Bootstrap] Error checking database state:", err.message);
  }
  console.log("[Railway Bootstrap] Bootstrapping complete.");
  process.exit(0);
}
bootstrap().catch((err) => {
  console.error("[Railway Bootstrap] Uncaught error during bootstrap:", err);
  process.exit(1);
});
//# sourceMappingURL=railway-bootstrap.cjs.map
