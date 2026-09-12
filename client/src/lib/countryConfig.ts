import { getCountryFormat, CountryFormatSpec } from "@shared/countryFormats";

export interface CountryConfig {
  code: string;
  name: string;
  officialName: string;
  flagEmoji: string;
  
  // Identification & Phone
  idLabel: string;
  idShortLabel?: string;
  idFormatPlaceholder: string;
  idPatternHelp?: string;
  phonePrefix: string;
  phonePlaceholder: string;
  phonePatternHelp?: string;
  formatSpec?: CountryFormatSpec;
  
  // Currency
  currencyCode: string;
  currencySymbol: string;
  currencyName: string;
  
  // Administrative Hierarchy
  adminLabels: {
    level1: string;
    level2: string;
    level3: string;
    level4: string;
  };
  hasDistricts: boolean;
  
  // Theme & National Colors
  flagColors: string[];
  primaryColor: string;
  themeGradient: string;
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
  };

  // National GIS & Catchment Norms
  defaultExtractionRadiusKm?: number;
  maxExtractionRadiusKm?: number;

  // National Demographic Ratios (Official Census Breakdown)
  demographicRatios?: {
    under1Percent: number;
    under5Percent: number;
    pregnantPercent: number;
    girls9to14Percent?: number;
  };

  // Operational Immunization Delivery Norms
  operationalNorms?: {
    maxChildrenPerSessionDay: number;
    defaultBufferStockPercent: number;
    standardVaccineCarrierLitres: number;
    minSessionLeadDays: number;
  };
}

export * from "@shared/countryFormats";

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  ZMB: {
    code: "ZMB",
    name: "Zambia",
    officialName: "Republic of Zambia Ministry of Health",
    flagEmoji: "🇿🇲",
    idLabel: "NRC Number",
    idFormatPlaceholder: "123456/11/1",
    phonePrefix: "+260",
    phonePlaceholder: "+260 97 1234567",
    currencyCode: "ZMW",
    currencySymbol: "K",
    currencyName: "Zambian Kwacha",
    adminLabels: {
      level1: "Province",
      level2: "District",
      level3: "Sub-District",
      level4: "Zone / Village",
    },
    hasDistricts: true,
    flagColors: ["#197b30", "#de2010", "#000000", "#ef7d00"],
    primaryColor: "#166534",
    themeGradient: "linear-gradient(135deg, #166534 0%, #15803d 50%, #ea580c 100%)",
    badgeStyle: {
      bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-500/30",
    },
    defaultExtractionRadiusKm: 25,
    maxExtractionRadiusKm: 50,
    demographicRatios: {
      under1Percent: 4.0,
      under5Percent: 18.0,
      pregnantPercent: 5.0,
      girls9to14Percent: 3.5,
    },
    operationalNorms: {
      maxChildrenPerSessionDay: 60,
      defaultBufferStockPercent: 25,
      standardVaccineCarrierLitres: 2.6,
      minSessionLeadDays: 7,
    },
  },

  VNM: {
    code: "VNM",
    name: "Vietnam",
    officialName: "Republic of Vietnam Ministry of Health",
    flagEmoji: "🇻🇳",
    idLabel: "CCCD / CMND Number",
    idFormatPlaceholder: "012345678901",
    phonePrefix: "+84",
    phonePlaceholder: "+84 91 234 5678",
    currencyCode: "VND",
    currencySymbol: "₫",
    currencyName: "Vietnamese Đồng",
    adminLabels: {
      level1: "Province",
      level2: "Commune / Ward",
      level3: "District (Abolished)",
      level4: "Village",
    },
    hasDistricts: false,
    flagColors: ["#da251d", "#ffde00"],
    primaryColor: "#dc2626",
    themeGradient: "linear-gradient(135deg, #991b1b 0%, #dc2626 60%, #eab308 100%)",
    badgeStyle: {
      bg: "bg-red-500/10 dark:bg-red-500/20",
      text: "text-red-700 dark:text-red-300",
      border: "border-red-500/30",
    },
    defaultExtractionRadiusKm: 15,
    maxExtractionRadiusKm: 35,
    demographicRatios: {
      under1Percent: 1.8,
      under5Percent: 7.5,
      pregnantPercent: 2.1,
      girls9to14Percent: 2.8,
    },
    operationalNorms: {
      maxChildrenPerSessionDay: 80,
      defaultBufferStockPercent: 20,
      standardVaccineCarrierLitres: 1.7,
      minSessionLeadDays: 7,
    },
  },

  ZAF: {
    code: "ZAF",
    name: "South Africa",
    officialName: "National Department of Health South Africa",
    flagEmoji: "🇿🇦",
    idLabel: "South African ID Number",
    idFormatPlaceholder: "9001015009087",
    phonePrefix: "+27",
    phonePlaceholder: "+27 82 123 4567",
    currencyCode: "ZAR",
    currencySymbol: "R",
    currencyName: "South African Rand",
    adminLabels: {
      level1: "Province",
      level2: "District / Metro",
      level3: "Sub-District",
      level4: "Facility Catchment",
    },
    hasDistricts: true,
    flagColors: ["#007a4d", "#ffb81c", "#000000", "#de3831", "#002395"],
    primaryColor: "#047857",
    themeGradient: "linear-gradient(135deg, #047857 0%, #0284c7 50%, #d97706 100%)",
    badgeStyle: {
      bg: "bg-teal-500/10 dark:bg-teal-500/20",
      text: "text-teal-700 dark:text-teal-300",
      border: "border-teal-500/30",
    },
    defaultExtractionRadiusKm: 20,
    maxExtractionRadiusKm: 45,
    demographicRatios: {
      under1Percent: 2.2,
      under5Percent: 9.8,
      pregnantPercent: 2.5,
      girls9to14Percent: 3.0,
    },
    operationalNorms: {
      maxChildrenPerSessionDay: 75,
      defaultBufferStockPercent: 20,
      standardVaccineCarrierLitres: 2.6,
      minSessionLeadDays: 7,
    },
  },

  PNG: {
    code: "PNG",
    name: "Papua New Guinea",
    officialName: "National Department of Health Papua New Guinea",
    flagEmoji: "🇵🇬",
    idLabel: "NID Number",
    idFormatPlaceholder: "1001234567",
    phonePrefix: "+675",
    phonePlaceholder: "+675 7123 4567",
    currencyCode: "PGK",
    currencySymbol: "K",
    currencyName: "PNG Kina",
    adminLabels: {
      level1: "Province",
      level2: "District",
      level3: "LLG",
      level4: "Ward",
    },
    hasDistricts: true,
    flagColors: ["#000000", "#d21034", "#ffd100"],
    primaryColor: "#be123c",
    themeGradient: "linear-gradient(135deg, #9f1239 0%, #e11d48 50%, #d97706 100%)",
    badgeStyle: {
      bg: "bg-rose-500/10 dark:bg-rose-500/20",
      text: "text-rose-700 dark:text-rose-300",
      border: "border-rose-500/30",
    },
    defaultExtractionRadiusKm: 30,
    maxExtractionRadiusKm: 60,
    demographicRatios: {
      under1Percent: 3.8,
      under5Percent: 17.2,
      pregnantPercent: 4.8,
      girls9to14Percent: 3.6,
    },
    operationalNorms: {
      maxChildrenPerSessionDay: 50,
      defaultBufferStockPercent: 30,
      standardVaccineCarrierLitres: 2.6,
      minSessionLeadDays: 14,
    },
  },

  MWI: {
    code: "MWI",
    name: "Malawi",
    officialName: "Ministry of Health Republic of Malawi",
    flagEmoji: "🇲🇼",
    idLabel: "National ID Number",
    idFormatPlaceholder: "MW123456789",
    phonePrefix: "+265",
    phonePlaceholder: "+265 99 123 4567",
    currencyCode: "MWK",
    currencySymbol: "MK",
    currencyName: "Malawian Kwacha",
    adminLabels: {
      level1: "Region",
      level2: "District",
      level3: "Traditional Authority",
      level4: "Village",
    },
    hasDistricts: true,
    flagColors: ["#000000", "#d21034", "#007a3d"],
    primaryColor: "#007a3d",
    themeGradient: "linear-gradient(135deg, #000000 0%, #d21034 50%, #007a3d 100%)",
    badgeStyle: {
      bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-500/30",
    },
    defaultExtractionRadiusKm: 25,
    maxExtractionRadiusKm: 50,
    demographicRatios: {
      under1Percent: 4.0,
      under5Percent: 17.5,
      pregnantPercent: 5.0,
      girls9to14Percent: 3.5,
    },
    operationalNorms: {
      maxChildrenPerSessionDay: 60,
      defaultBufferStockPercent: 25,
      standardVaccineCarrierLitres: 2.6,
      minSessionLeadDays: 7,
    },
  },

  KEN: {
    code: "KEN",
    name: "Kenya",
    officialName: "Ministry of Health Republic of Kenya",
    flagEmoji: "🇰🇪",
    idLabel: "National ID Number",
    idFormatPlaceholder: "34567890",
    phonePrefix: "+254",
    phonePlaceholder: "+254 712 345678",
    currencyCode: "KES",
    currencySymbol: "KSh",
    currencyName: "Kenyan Shilling",
    adminLabels: {
      level1: "County",
      level2: "Sub-County",
      level3: "Ward",
      level4: "Village",
    },
    hasDistricts: true,
    flagColors: ["#000000", "#bb0000", "#006600"],
    primaryColor: "#166534",
    themeGradient: "linear-gradient(135deg, #0f172a 0%, #991b1b 50%, #166534 100%)",
    badgeStyle: {
      bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-500/30",
    },
  },

  UGA: {
    code: "UGA",
    name: "Uganda",
    officialName: "Ministry of Health Republic of Uganda",
    flagEmoji: "🇺🇬",
    idLabel: "NIN Number",
    idFormatPlaceholder: "CM9001015009087",
    phonePrefix: "+256",
    phonePlaceholder: "+256 77 123 4567",
    currencyCode: "UGX",
    currencySymbol: "USh",
    currencyName: "Ugandan Shilling",
    adminLabels: {
      level1: "Region",
      level2: "District",
      level3: "Sub-County",
      level4: "Parish / Village",
    },
    hasDistricts: true,
    flagColors: ["#000000", "#fcd116", "#d21034"],
    primaryColor: "#ca8a04",
    themeGradient: "linear-gradient(135deg, #18181b 0%, #ca8a04 50%, #dc2626 100%)",
    badgeStyle: {
      bg: "bg-amber-500/10 dark:bg-amber-500/20",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-500/30",
    },
  },

  SSD: {
    code: "SSD",
    name: "South Sudan",
    officialName: "Republic of South Sudan Ministry of Health",
    flagEmoji: "🇸🇸",
    idLabel: "National ID Number",
    idShortLabel: "National ID",
    idFormatPlaceholder: "SSD1234567",
    idPatternHelp: "6 to 15 alphanumeric characters",
    phonePrefix: "+211",
    phonePlaceholder: "+211 92 123 4567",
    phonePatternHelp: "+211 followed by 9 digits",
    formatSpec: getCountryFormat("SSD"),
    currencyCode: "SSP",
    currencySymbol: "SS£",
    currencyName: "South Sudanese Pound",
    adminLabels: {
      level1: "State",
      level2: "County",
      level3: "Payam",
      level4: "Boma",
    },
    hasDistricts: true,
    flagColors: ["#000000", "#da121a", "#078930", "#0f47af", "#fcdd09"],
    primaryColor: "#078930",
    themeGradient: "linear-gradient(135deg, #078930 0%, #0f47af 50%, #da121a 100%)",
    badgeStyle: {
      bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-500/30",
    },
  },

  BWA: {
    code: "BWA",
    name: "Botswana",
    officialName: "Republic of Botswana Ministry of Health",
    flagEmoji: "🇧🇼",
    idLabel: "Omang (National ID) Number",
    idShortLabel: "Omang ID",
    idFormatPlaceholder: "123412345",
    idPatternHelp: "9 numeric digits",
    phonePrefix: "+267",
    phonePlaceholder: "+267 71 234 567",
    phonePatternHelp: "+267 followed by 7 or 8 digits",
    formatSpec: getCountryFormat("BWA"),
    currencyCode: "BWP",
    currencySymbol: "P",
    currencyName: "Botswana Pula",
    adminLabels: {
      level1: "District",
      level2: "Sub-District",
      level3: "Village",
      level4: "Ward / Locality",
    },
    hasDistricts: true,
    flagColors: ["#75aadb", "#000000", "#ffffff"],
    primaryColor: "#0284c7",
    themeGradient: "linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #18181b 100%)",
    badgeStyle: {
      bg: "bg-sky-500/10 dark:bg-sky-500/20",
      text: "text-sky-700 dark:text-sky-300",
      border: "border-sky-500/30",
    },
  },
};

export const DEFAULT_COUNTRY_CONFIG: CountryConfig & { formatSpec: CountryFormatSpec } = {
  ...COUNTRY_CONFIGS.ZMB,
  formatSpec: getCountryFormat("ZMB"),
  idShortLabel: getCountryFormat("ZMB").idShortLabel,
  idPatternHelp: getCountryFormat("ZMB").idPatternHelp,
  phonePatternHelp: getCountryFormat("ZMB").phonePatternHelp,
};

export function getCountryConfig(tenant: any): CountryConfig & { formatSpec: CountryFormatSpec } {
  if (!tenant) return DEFAULT_COUNTRY_CONFIG;
  
  const code = (tenant.countryCode || tenant.code || "").toUpperCase();
  const formatSpec = getCountryFormat(code);
  const baseConfig = COUNTRY_CONFIGS[code] || {
    code: code || "GLOBAL",
    name: tenant.name || "Global Health",
    officialName: tenant.name || "Ministry of Health",
    flagEmoji: "🌐",
    idLabel: formatSpec.idLabel,
    idShortLabel: formatSpec.idShortLabel,
    idFormatPlaceholder: formatSpec.idPlaceholder,
    idPatternHelp: formatSpec.idPatternHelp,
    phonePrefix: formatSpec.phonePrefix,
    phonePlaceholder: formatSpec.phonePlaceholder,
    phonePatternHelp: formatSpec.phonePatternHelp,
    formatSpec,
    currencyCode: tenant.settings?.currency || "USD",
    currencySymbol: tenant.settings?.currencySymbol || "$",
    currencyName: "United States Dollar",
    adminLabels: {
      level1: tenant.settings?.adminLevelLabels?.level1 || "Province",
      level2: tenant.settings?.adminLevelLabels?.level2 || "District",
      level3: tenant.settings?.adminLevelLabels?.level3 || "Sub-District",
      level4: tenant.settings?.adminLevelLabels?.level4 || "Village",
    },
    hasDistricts: true,
    flagColors: ["#0284c7", "#0369a1"],
    primaryColor: "#0284c7",
    themeGradient: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
    badgeStyle: {
      bg: "bg-sky-500/10 dark:bg-sky-500/20",
      text: "text-sky-700 dark:text-sky-300",
      border: "border-sky-500/30",
    },
    defaultExtractionRadiusKm: 25,
    maxExtractionRadiusKm: 50,
    demographicRatios: {
      under1Percent: 4.0,
      under5Percent: 18.0,
      pregnantPercent: 5.0,
      girls9to14Percent: 3.5,
    },
    operationalNorms: {
      maxChildrenPerSessionDay: 60,
      defaultBufferStockPercent: 25,
      standardVaccineCarrierLitres: 2.6,
      minSessionLeadDays: 7,
    },
  };

  // Merge any dynamic settings overrides
  const settings = tenant.settings || {};
  return {
    ...baseConfig,
    formatSpec,
    currencyCode: settings.currency || baseConfig.currencyCode,
    currencySymbol: settings.currencySymbol || baseConfig.currencySymbol,
    idLabel: settings.idLabel || formatSpec.idLabel || baseConfig.idLabel,
    idShortLabel: formatSpec.idShortLabel || baseConfig.idShortLabel,
    idFormatPlaceholder: formatSpec.idPlaceholder || baseConfig.idFormatPlaceholder,
    idPatternHelp: formatSpec.idPatternHelp || baseConfig.idPatternHelp,
    phonePrefix: settings.phonePrefix || formatSpec.phonePrefix || baseConfig.phonePrefix,
    phonePlaceholder: formatSpec.phonePlaceholder || baseConfig.phonePlaceholder,
    phonePatternHelp: formatSpec.phonePatternHelp || baseConfig.phonePatternHelp,
    adminLabels: {
      ...baseConfig.adminLabels,
      ...(settings.adminLevelLabels || {}),
    },
    hasDistricts: code === "VNM" ? false : baseConfig.hasDistricts,
    defaultExtractionRadiusKm: settings.defaultExtractionRadiusKm || baseConfig.defaultExtractionRadiusKm || 25,
    maxExtractionRadiusKm: settings.maxExtractionRadiusKm || baseConfig.maxExtractionRadiusKm || 50,
    demographicRatios: {
      ...baseConfig.demographicRatios,
      ...(settings.demographicRatios || {}),
    },
    operationalNorms: {
      ...baseConfig.operationalNorms,
      ...(settings.operationalNorms || {}),
    },
  };
}
