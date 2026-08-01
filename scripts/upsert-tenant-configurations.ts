/**
 * Non-destructive tenant configuration upsert for production deployments.
 *
 * This script intentionally does NOT delete, truncate, rebuild, or reseed
 * geography/facility/community/operational tables. It keeps tenant platform
 * settings, default role mappings, permission registry, vaccine configuration,
 * and VPD surveillance defaults aligned across onboarded countries.
 *
 * Run with:
 *   npx tsx --env-file=.env scripts/upsert-tenant-configurations.ts
 */

import { and, eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import {
  tenantVpdConfigurations,
  tenants,
  userPermissions,
  userRoles,
  vaccineConfigurations,
} from "../shared/schema";
import { ROLE_PERMISSIONS } from "../shared/permissions";

type JsonRecord = Record<string, unknown>;

type TenantConfig = {
  name: string;
  code: string;
  countryCode: string;
  status: "trial" | "active" | "suspended" | "archived";
  settings: JsonRecord;
};

const MODULES = {
  dashboard: true,
  map: true,
  facilities: true,
  settlements: true,
  planning: true,
  sessions: true,
  stock: true,
  supervision: true,
  surveillance: true,
  reports: true,
  catalogue: true,
  boundaries: true,
  customLayers: true,
  population: true,
  clientLogbook: true,
  defaulters: true,
  dropout: true,
  missedCommunities: true,
  houseToHouse: true,
  pce: true,
};

const TENANTS: TenantConfig[] = [
  {
    name: "Republic of Zambia Ministry of Health",
    code: "ZMB",
    countryCode: "ZMB",
    status: "active",
    settings: {
      countryDisplayName: "Zambia",
      officialName: "Republic of Zambia Ministry of Health",
      currency: "ZMW",
      currencyCode: "ZMW",
      currencySymbol: "K",
      currencyName: "Zambian Kwacha",
      languages: ["en", "ny", "bem", "ton"],
      defaultLanguage: "en",
      mapCenter: [-13.1339, 27.8493],
      mapZoom: 6,
      hasDistricts: true,
      skipRegionLevel: true,
      adminLevelLabels: {
        level1: "Region",
        level2: "Province",
        level3: "District",
        level4: "Constituency",
        level5: "Ward",
      },
      idLabel: "NRC / Health ID",
      idFormatPlaceholder: "e.g. 123456/78/9 or local child ID",
      phonePrefix: "+260",
      phonePlaceholder: "+260 97 000 0000",
      fiscalYearStart: "01-01",
      epiSchedule: "ZMB_2024",
      demographics: { births: 0.038, under1: 0.035, pregnant: 0.04, schoolEntry: 0.032, schoolExit: 0.028 },
      primaryColor: "#0284c7",
      themeGradient: "from-sky-600 to-cyan-500",
      flagColors: ["#198a00", "#ef7d00", "#000000", "#de2010"],
      modules: MODULES,
    },
  },
  {
    name: "Republic of South Sudan Ministry of Health",
    code: "SSD",
    countryCode: "SSD",
    status: "active",
    settings: {
      countryDisplayName: "South Sudan",
      officialName: "Republic of South Sudan Ministry of Health",
      currency: "SSP",
      currencyCode: "SSP",
      currencySymbol: "£",
      currencyName: "South Sudanese Pound",
      languages: ["en", "ar"],
      defaultLanguage: "en",
      mapCenter: [7.8627, 29.6949],
      mapZoom: 6,
      hasDistricts: true,
      skipRegionLevel: true,
      adminLevelLabels: {
        level1: "Region",
        level2: "State",
        level3: "County",
        level4: "Payam",
        level5: "Village",
      },
      idLabel: "National / Health ID",
      idFormatPlaceholder: "e.g. SSD child or client ID",
      phonePrefix: "+211",
      phonePlaceholder: "+211 9XX XXX XXX",
      fiscalYearStart: "01-01",
      epiSchedule: "SSD_2024",
      demographics: { births: 0.042, under1: 0.04, pregnant: 0.045, schoolEntry: 0.036, schoolExit: 0.03 },
      primaryColor: "#0f766e",
      themeGradient: "from-teal-700 to-emerald-500",
      flagColors: ["#000000", "#da121a", "#078930", "#0f47af", "#ffffff", "#fcdd09"],
      modules: MODULES,
    },
  },
  {
    name: "Papua New Guinea National Department of Health",
    code: "PNG",
    countryCode: "PNG",
    status: "active",
    settings: {
      countryDisplayName: "Papua New Guinea",
      officialName: "Papua New Guinea National Department of Health",
      currency: "PGK",
      currencyCode: "PGK",
      currencySymbol: "K",
      currencyName: "Papua New Guinean Kina",
      languages: ["en", "tpi", "ho"],
      defaultLanguage: "en",
      mapCenter: [-6.314993, 143.95555],
      mapZoom: 6,
      hasDistricts: true,
      skipRegionLevel: false,
      adminLevelLabels: {
        level1: "Region",
        level2: "Province",
        level3: "District",
        level4: "LLG",
        level5: "Ward",
      },
      idLabel: "Health Record Number",
      idFormatPlaceholder: "e.g. PNG child health book number",
      phonePrefix: "+675",
      phonePlaceholder: "+675 XXX XXXX",
      fiscalYearStart: "01-01",
      epiSchedule: "PNG_2024",
      demographics: { births: 0.032, under1: 0.03, pregnant: 0.032, schoolEntry: 0.027, schoolExit: 0.022 },
      primaryColor: "#b91c1c",
      themeGradient: "from-red-700 to-amber-500",
      flagColors: ["#ce1126", "#000000", "#fcd116", "#ffffff"],
      modules: MODULES,
    },
  },
  {
    name: "Republic of South Africa National Department of Health",
    code: "ZAF",
    countryCode: "ZAF",
    status: "active",
    settings: {
      countryDisplayName: "South Africa",
      officialName: "Republic of South Africa National Department of Health",
      currency: "ZAR",
      currencyCode: "ZAR",
      currencySymbol: "R",
      currencyName: "South African Rand",
      languages: ["en", "zu", "xh", "af", "st"],
      defaultLanguage: "en",
      mapCenter: [-30.5595, 22.9375],
      mapZoom: 5,
      hasDistricts: true,
      skipRegionLevel: true,
      adminLevelLabels: {
        level1: "Region",
        level2: "Province",
        level3: "District",
        level4: "Sub-district",
        level5: "Ward",
      },
      idLabel: "SA ID / Health ID",
      idFormatPlaceholder: "e.g. 13-digit ID or folder number",
      phonePrefix: "+27",
      phonePlaceholder: "+27 82 000 0000",
      fiscalYearStart: "04-01",
      epiSchedule: "ZAF_2024",
      demographics: { births: 0.02, under1: 0.019, pregnant: 0.021, schoolEntry: 0.018, schoolExit: 0.016 },
      primaryColor: "#16a34a",
      themeGradient: "from-green-700 to-yellow-500",
      flagColors: ["#007749", "#ffb81c", "#de3831", "#002395", "#000000", "#ffffff"],
      modules: MODULES,
    },
  },
  {
    name: "Republic of Kenya Ministry of Health",
    code: "KEN",
    countryCode: "KEN",
    status: "active",
    settings: {
      countryDisplayName: "Kenya",
      officialName: "Republic of Kenya Ministry of Health",
      currency: "KES",
      currencyCode: "KES",
      currencySymbol: "KSh",
      currencyName: "Kenyan Shilling",
      languages: ["en", "sw"],
      defaultLanguage: "en",
      mapCenter: [0.0236, 37.9062],
      mapZoom: 6,
      hasDistricts: true,
      skipRegionLevel: true,
      adminLevelLabels: {
        level1: "Region",
        level2: "County",
        level3: "Sub-County",
        level4: "Ward",
        level5: "Village",
      },
      idLabel: "National ID / CHV ID / Health ID",
      idFormatPlaceholder: "e.g. Kenyan health client ID",
      phonePrefix: "+254",
      phonePlaceholder: "+254 7XX XXX XXX",
      fiscalYearStart: "07-01",
      epiSchedule: "KEN_2024",
      demographics: { births: 0.029, under1: 0.027, pregnant: 0.03, schoolEntry: 0.026, schoolExit: 0.023 },
      primaryColor: "#166534",
      themeGradient: "from-green-800 to-red-600",
      flagColors: ["#000000", "#bb0000", "#006600", "#ffffff"],
      modules: MODULES,
    },
  },
  {
    name: "Republic of Uganda Ministry of Health",
    code: "UGA",
    countryCode: "UGA",
    status: "active",
    settings: {
      countryDisplayName: "Uganda",
      officialName: "Republic of Uganda Ministry of Health",
      currency: "UGX",
      currencyCode: "UGX",
      currencySymbol: "USh",
      currencyName: "Ugandan Shilling",
      languages: ["en", "sw"],
      defaultLanguage: "en",
      mapCenter: [1.3733, 32.2903],
      mapZoom: 7,
      hasDistricts: true,
      skipRegionLevel: false,
      adminLevelLabels: {
        level1: "Region",
        level2: "District",
        level3: "County",
        level4: "Sub-County",
        level5: "Parish",
      },
      idLabel: "NIN / Health ID",
      idFormatPlaceholder: "e.g. Ugandan NIN or health client ID",
      phonePrefix: "+256",
      phonePlaceholder: "+256 7XX XXX XXX",
      fiscalYearStart: "07-01",
      epiSchedule: "UGA_2024",
      demographics: { births: 0.036, under1: 0.034, pregnant: 0.038, schoolEntry: 0.032, schoolExit: 0.028 },
      primaryColor: "#f59e0b",
      themeGradient: "from-yellow-600 to-red-600",
      flagColors: ["#000000", "#fcdc04", "#d90000"],
      modules: MODULES,
    },
  },
  {
    name: "Republic of Vietnam Ministry of Health",
    code: "VNM",
    countryCode: "VNM",
    status: "active",
    settings: {
      countryDisplayName: "Vietnam",
      officialName: "Republic of Vietnam Ministry of Health",
      currency: "VND",
      currencyCode: "VND",
      currencySymbol: "₫",
      currencyName: "Vietnamese Dong",
      languages: ["vi", "en"],
      defaultLanguage: "vi",
      mapCenter: [14.0583, 108.2772],
      mapZoom: 5,
      hasDistricts: false,
      skipRegionLevel: true,
      adminLevelLabels: {
        level1: "Region",
        level2: "Province",
        level3: "Commune / Ward",
        level4: "Village",
        level5: "Hamlet",
      },
      idLabel: "Citizen ID / Health ID",
      idFormatPlaceholder: "e.g. CCCD or immunization client ID",
      phonePrefix: "+84",
      phonePlaceholder: "+84 9X XXX XXXX",
      fiscalYearStart: "01-01",
      epiSchedule: "VNM_2024",
      demographics: { births: 0.014, under1: 0.014, pregnant: 0.015, schoolEntry: 0.014, schoolExit: 0.013 },
      primaryColor: "#dc2626",
      themeGradient: "from-red-700 to-yellow-500",
      flagColors: ["#da251d", "#ffcd00"],
      modules: MODULES,
    },
  },
];

const VACCINE_CONFIGS = [
  { name: "BCG", targetGroup: "births", doses: 1, recommendedAge: "At birth", recommendedAgeWeeks: 0, wastageFactor: "50.00", vialsPerDose: 20, cvxCode: "19" },
  { name: "OPV", targetGroup: "under1", doses: 4, recommendedAge: "Birth, 6, 10, 14 weeks", recommendedAgeWeeks: 0, wastageFactor: "25.00", vialsPerDose: 20, cvxCode: "02" },
  { name: "Penta", targetGroup: "under1", doses: 3, recommendedAge: "6, 10, 14 weeks", recommendedAgeWeeks: 6, wastageFactor: "10.00", vialsPerDose: 1, cvxCode: "146" },
  { name: "PCV", targetGroup: "under1", doses: 3, recommendedAge: "6, 10, 14 weeks", recommendedAgeWeeks: 6, wastageFactor: "11.00", vialsPerDose: 1, cvxCode: "133" },
  { name: "Rotavirus", targetGroup: "under1", doses: 2, recommendedAge: "6, 10 weeks", recommendedAgeWeeks: 6, wastageFactor: "5.00", vialsPerDose: 1, cvxCode: "122" },
  { name: "IPV", targetGroup: "under1", doses: 2, recommendedAge: "14 weeks, 9 months", recommendedAgeWeeks: 14, wastageFactor: "5.00", vialsPerDose: 5, cvxCode: "10" },
  { name: "MR", targetGroup: "under1", doses: 2, recommendedAge: "9, 18 months", recommendedAgeWeeks: 39, wastageFactor: "15.00", vialsPerDose: 10, cvxCode: "03" },
  { name: "TT / Td", targetGroup: "pregnant", doses: 2, recommendedAge: "Pregnancy schedule", recommendedAgeWeeks: 0, wastageFactor: "10.00", vialsPerDose: 20, cvxCode: "09" },
  { name: "HPV", targetGroup: "schoolEntry", doses: 1, recommendedAge: "9-14 years", recommendedAgeWeeks: 468, wastageFactor: "5.00", vialsPerDose: 1, cvxCode: "62" },
  { name: "Yellow Fever", targetGroup: "under1", doses: 1, recommendedAge: "9 months", recommendedAgeWeeks: 39, wastageFactor: "30.00", vialsPerDose: 10, cvxCode: "37" },
  { name: "Meningitis Vaccine", targetGroup: "under1", doses: 1, recommendedAge: "9 months or campaign-specific", recommendedAgeWeeks: 39, wastageFactor: "30.00", vialsPerDose: 10, cvxCode: "108" },
  { name: "COVID-19 Vaccine", targetGroup: "schoolEntry", doses: 2, recommendedAge: "Campaign-specific", recommendedAgeWeeks: 0, wastageFactor: "10.00", vialsPerDose: 10, cvxCode: "207" },
];

const VPD_CONFIGS = [
  { disease: "afp", targetIncidenceRate: "2.00", alertThreshold: 1 },
  { disease: "measles", targetIncidenceRate: "0.00", alertThreshold: 1 },
  { disease: "nnt", targetIncidenceRate: "0.00", alertThreshold: 1 },
  { disease: "yellow_fever", targetIncidenceRate: "0.00", alertThreshold: 1 },
  { disease: "cholera", targetIncidenceRate: "0.00", alertThreshold: 1 },
  { disease: "covid19", targetIncidenceRate: "0.00", alertThreshold: 5 },
  { disease: "other", targetIncidenceRate: "0.00", alertThreshold: 1 },
] as const;

const PROTECTED_SETTINGS_KEYS = new Set([
  "api",
  "apiKeys",
  "dhis2",
  "email",
  "idp",
  "integrations",
  "oauth",
  "secrets",
  "security",
  "smartcare",
  "sms",
  "smtp",
  "sso",
  "whatsapp",
]);

function isPlainObject(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(existing: unknown, canonical: unknown): unknown {
  if (!isPlainObject(existing) || !isPlainObject(canonical)) {
    return canonical;
  }
  const merged: JsonRecord = { ...existing };
  for (const [key, value] of Object.entries(canonical)) {
    merged[key] = key in existing ? deepMerge(existing[key], value) : value;
  }
  return merged;
}

function mergeSettings(existing: unknown, canonical: JsonRecord): JsonRecord {
  const existingObject = isPlainObject(existing) ? existing : {};
  const merged = deepMerge(existingObject, canonical) as JsonRecord;
  for (const key of PROTECTED_SETTINGS_KEYS) {
    if (key in existingObject) {
      merged[key] = existingObject[key];
    }
  }
  return merged;
}

function titleCasePermission(code: string): string {
  return code
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function upsertTenant(config: TenantConfig) {
  const [existing] = await db.select().from(tenants).where(eq(tenants.code, config.code)).limit(1);
  const settings = mergeSettings(existing?.settings, config.settings);

  if (existing) {
    const [updated] = await db
      .update(tenants)
      .set({
        name: config.name,
        countryCode: config.countryCode,
        status: config.status,
        settings,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(tenants)
    .values({
      name: config.name,
      code: config.code,
      countryCode: config.countryCode,
      status: config.status,
      settings,
    })
    .returning();
  return created;
}

async function upsertRolesAndPermissions(tenantId: string) {
  const permissionCodes = new Set<string>();

  for (const [code, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    permissions.forEach((permission) => permissionCodes.add(permission));
    await db
      .insert(userRoles)
      .values({
        tenantId,
        code,
        name: titleCasePermission(code),
        permissions,
      })
      .onConflictDoUpdate({
        target: [userRoles.tenantId, userRoles.code],
        set: {
          name: titleCasePermission(code),
          permissions,
          updatedAt: new Date(),
        },
      });
  }

  for (const code of Array.from(permissionCodes).sort()) {
    await db
      .insert(userPermissions)
      .values({
        tenantId,
        code,
        name: titleCasePermission(code),
        description: `Allows users to ${code.replace(/[._-]+/g, " ")} within their authorized geographic scope.`,
      })
      .onConflictDoUpdate({
        target: [userPermissions.tenantId, userPermissions.code],
        set: {
          name: titleCasePermission(code),
          description: `Allows users to ${code.replace(/[._-]+/g, " ")} within their authorized geographic scope.`,
          updatedAt: new Date(),
        },
      });
  }
}

async function upsertVaccines(tenantId: string) {
  for (const vaccine of VACCINE_CONFIGS) {
    const existing = await db
      .select({ id: vaccineConfigurations.id })
      .from(vaccineConfigurations)
      .where(and(eq(vaccineConfigurations.tenantId, tenantId), eq(vaccineConfigurations.name, vaccine.name)))
      .limit(1);

    if (existing.length) {
      await db
        .update(vaccineConfigurations)
        .set({
          targetGroup: vaccine.targetGroup,
          doses: vaccine.doses,
          recommendedAge: vaccine.recommendedAge,
          recommendedAgeWeeks: vaccine.recommendedAgeWeeks,
          wastageFactor: vaccine.wastageFactor,
          vialsPerDose: vaccine.vialsPerDose,
          isActive: true,
          cvxCode: vaccine.cvxCode,
        })
        .where(and(eq(vaccineConfigurations.tenantId, tenantId), eq(vaccineConfigurations.name, vaccine.name)));
    } else {
      await db.insert(vaccineConfigurations).values({
        tenantId,
        ...vaccine,
        isActive: true,
      });
    }
  }
}

async function upsertVpd(tenantId: string) {
  for (const config of VPD_CONFIGS) {
    await db
      .insert(tenantVpdConfigurations)
      .values({
        tenantId,
        disease: config.disease,
        isActive: true,
        targetIncidenceRate: config.targetIncidenceRate,
        alertThreshold: config.alertThreshold,
        notifyRoles: ["district_manager", "provincial_coordinator", "national_admin"],
      })
      .onConflictDoUpdate({
        target: [tenantVpdConfigurations.tenantId, tenantVpdConfigurations.disease],
        set: {
          isActive: true,
          targetIncidenceRate: config.targetIncidenceRate,
          alertThreshold: config.alertThreshold,
          notifyRoles: ["district_manager", "provincial_coordinator", "national_admin"],
          updatedAt: new Date(),
        },
      });
  }
}

async function main() {
  console.log("Starting non-destructive tenant configuration upsert...");

  for (const config of TENANTS) {
    const tenant = await upsertTenant(config);
    await upsertRolesAndPermissions(tenant.id);
    await upsertVaccines(tenant.id);
    await upsertVpd(tenant.id);
    console.log(`  OK ${config.code}: tenant settings, roles, permissions, vaccines, and VPD defaults upserted.`);
  }

  console.log("Tenant configuration upsert complete. No geography, facility, community, or operational rows were deleted.");
}

main()
  .catch((error) => {
    console.error("Tenant configuration upsert failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
