export interface NationalScheduleDosePreset {
  doseCode: string;
  name: string;
  antigen: string;
  vaccineProductId: string;
  vaccineName: string;
  doseNumber: number;
  targetAge: string;
  minimumAge?: string;
  maximumAge?: string;
  minimumInterval?: string;
  route: "IM" | "Oral" | "ID" | "SC";
  site: string;
  targetPopulationGroup: "infants" | "children" | "school_age" | "adolescents" | "pregnant_women" | "adults";
  classification: "routine" | "campaign" | "outbreak" | "school_based" | "other";
  notes?: string;
}

export interface NationalSchedulePreset {
  countryCode: string;
  countryName: string;
  authorityName: string;
  scheduleTitle: string;
  version: string;
  effectiveYear: string;
  description: string;
  hexColor: string;
  recommendedStorageTemp: string;
  milestones: string[];
  doses: NationalScheduleDosePreset[];
}

export interface ClinicalAdministrationMetadata {
  route: "IM" | "Oral" | "ID" | "SC";
  site: string;
  minimumInterval: string;
  notes: string;
  targetPopulationGroup: "infants" | "children" | "school_age" | "adolescents" | "pregnant_women" | "adults";
}

export const AGE_MILESTONES = [
  { id: "birth", label: "At Birth", shortLabel: "Birth", targetDays: 0, group: "infants" },
  { id: "6w", label: "6 Weeks", shortLabel: "6w", targetDays: 42, group: "infants" },
  { id: "10w", label: "10 Weeks", shortLabel: "10w", targetDays: 70, group: "infants" },
  { id: "14w", label: "14 Weeks", shortLabel: "14w", targetDays: 98, group: "infants" },
  { id: "6m", label: "6 Months", shortLabel: "6m", targetDays: 180, group: "infants" },
  { id: "9m", label: "9 Months", shortLabel: "9m", targetDays: 270, group: "infants" },
  { id: "12m", label: "12 Months", shortLabel: "12m", targetDays: 365, group: "children" },
  { id: "18m", label: "18 Months", shortLabel: "18m", targetDays: 545, group: "children" },
  { id: "5_6y", label: "5-6 Years", shortLabel: "5-6y", targetDays: 2000, group: "school_age" },
  { id: "9y_hpv", label: "9 Years", shortLabel: "9y", targetDays: 3285, group: "adolescents" },
  { id: "12y", label: "12 Years", shortLabel: "12y", targetDays: 4380, group: "adolescents" },
  { id: "pregnancy", label: "Pregnant Women", shortLabel: "Pregnancy", targetDays: 7000, group: "pregnant_women" },
] as const;

export const ROUTE_LABELS: Record<string, { label: string; full: string; color: string }> = {
  IM: { label: "IM", full: "Intramuscular", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-300" },
  Oral: { label: "Oral", full: "Oral Drops / Solution", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-300" },
  ID: { label: "ID", full: "Intradermal", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 border-purple-300" },
  SC: { label: "SC", full: "Subcutaneous", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 border-emerald-300" }
};

export const TARGET_POPULATION_GROUPS = [
  { id: "infants", label: "Infants (0-11 months)", badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  { id: "children", label: "Young Children (12-59 months)", badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
  { id: "school_age", label: "School Age Children (5-9 years)", badgeClass: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" },
  { id: "adolescents", label: "Adolescents (9-14 years)", badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" },
  { id: "pregnant_women", label: "Pregnant Women (Maternal EPI)", badgeClass: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300" },
  { id: "adults", label: "Adults & High Risk", badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
];

export function getClinicalMetadataForDose(name?: string, doseCode?: string, targetAge?: string | null): ClinicalAdministrationMetadata {
  const combo = `${name || ""} ${doseCode || ""} ${targetAge || ""}`.toLowerCase();

  // BCG
  if (combo.includes("bcg")) {
    return {
      route: "ID",
      site: "Right Upper Arm (Deltoid insertion)",
      minimumInterval: "At Birth",
      targetPopulationGroup: "infants",
      notes: "0.05 ml intradermal with 26G sterile AD syringe. Inject strictly into dermis until wheal forms. Protect reconstituted vial from sunlight; use within 6 hours."
    };
  }

  // OPV Birth (0)
  if (combo.includes("opv_0") || combo.includes("opv-0") || combo.includes("opv 0") || combo.includes("opv0") || (combo.includes("opv") && combo.includes("birth"))) {
    return {
      route: "Oral",
      site: "Mouth (on tongue / 2 drops)",
      minimumInterval: "At Birth (within 14 days)",
      targetPopulationGroup: "infants",
      notes: "2 oral drops directly on tongue. Administer at birth before discharge. Readminister once if infant regurgitates within 10 minutes."
    };
  }

  // OPV Routine (1, 2, 3)
  if (combo.includes("opv")) {
    const isDose1 = combo.includes("1");
    const isDose2 = combo.includes("2");
    return {
      route: "Oral",
      site: "Mouth (on tongue / 2 drops)",
      minimumInterval: isDose1 ? "6 Weeks" : (isDose2 ? "4 Weeks after OPV 1" : "4 Weeks after OPV 2"),
      targetPopulationGroup: "infants",
      notes: "2 oral drops. Maintain cold chain +2°C to +8°C with functional VVM. If vomited or spat out, repeat dose once immediately."
    };
  }

  // Rotavirus (1, 2, 3)
  if (combo.includes("rota")) {
    const isDose1 = combo.includes("1");
    return {
      route: "Oral",
      site: "Mouth (inner cheek / oral applicator)",
      minimumInterval: isDose1 ? "6 Weeks" : "4 Weeks after Rotavirus 1",
      targetPopulationGroup: "infants",
      notes: "Administer full single-dose liquid tube slowly against inside of cheek. Do not inject. Complete series before 24 weeks of age."
    };
  }

  // Hexavalent / Pentavalent (DTP-HepB-Hib / DTaP-IPV-HB-Hib)
  if (combo.includes("penta") || combo.includes("hexavalent") || combo.includes("dtap") || combo.includes("dtp")) {
    const isBooster = combo.includes("4") || combo.includes("booster") || combo.includes("18m");
    const isDose1 = combo.includes("1") && !isBooster;
    const isDose2 = combo.includes("2");
    const isDose3 = combo.includes("3");
    return {
      route: "IM",
      site: isBooster ? "Left Upper Arm (Deltoid)" : "Left Anterolateral Thigh",
      minimumInterval: isDose1 ? "6 Weeks" : (isDose2 ? "4 Weeks after Dose 1" : (isDose3 ? "4 Weeks after Dose 2" : "12 Months after primary series")),
      targetPopulationGroup: isBooster ? "children" : "infants",
      notes: "0.5 ml intramuscular injection with 23G (25mm) AD syringe at 90° angle into vastus lateralis. Shake thoroughly before drawing. Never freeze."
    };
  }

  // PCV (Pneumococcal Conjugate)
  if (combo.includes("pcv") || combo.includes("pneumo")) {
    const isDose1 = combo.includes("1");
    const isDose2 = combo.includes("2");
    return {
      route: "IM",
      site: "Right Anterolateral Thigh",
      minimumInterval: isDose1 ? "6 Weeks" : (isDose2 ? "4-8 Weeks after PCV 1" : "6 Months after PCV 2"),
      targetPopulationGroup: "infants",
      notes: "0.5 ml intramuscular injection in right anterolateral thigh (opposite limb from Pentavalent/Hexavalent). Never freeze."
    };
  }

  // IPV (Inactivated Polio)
  if (combo.includes("ipv")) {
    const isDose2 = combo.includes("2");
    return {
      route: "IM",
      site: "Right Anterolateral Thigh / Right Deltoid",
      minimumInterval: isDose2 ? "4 Months after IPV 1" : "14 Weeks of Age",
      targetPopulationGroup: isDose2 ? "children" : "infants",
      notes: "0.5 ml IM (or 0.1 ml ID for fractional fIPV). Synergistic protection with bOPV. Maintain cold chain +2°C to +8°C."
    };
  }

  // Measles / Measles-Rubella (MR-1, MR-2)
  if (combo.includes("mr") || combo.includes("measles") || combo.includes("rubella")) {
    const isDose2 = combo.includes("2");
    const is6m = combo.includes("6m") || combo.includes("6 month");
    return {
      route: "SC",
      site: "Right Upper Arm (Deltoid)",
      minimumInterval: is6m ? "6 Months (Supplementary / Outbreak)" : (isDose2 ? "6 Months after Dose 1" : "9 Months of Age"),
      targetPopulationGroup: isDose2 ? "children" : "infants",
      notes: "0.5 ml subcutaneous injection at 45° angle. Reconstitute only with matching cold diluent. Protect from light and discard unused vial after 6 hours."
    };
  }

  // Yellow Fever
  if (combo.includes("yellow")) {
    return {
      route: "SC",
      site: "Left Upper Arm (Deltoid)",
      minimumInterval: "Single dose at 9 Months",
      targetPopulationGroup: "infants",
      notes: "0.5 ml subcutaneous injection. Single dose confers life-long immunity. Reconstitute with supplied diluent; discard after 6 hours."
    };
  }

  // Meningitis (MenA)
  if (combo.includes("men") || combo.includes("meningitis")) {
    return {
      route: "IM",
      site: "Left Anterolateral Thigh / Left Deltoid",
      minimumInterval: "Single dose at 9 Months",
      targetPopulationGroup: "infants",
      notes: "0.5 ml intramuscular injection. Shake gently before administration."
    };
  }

  // Malaria (RTS,S / R21)
  if (combo.includes("malaria")) {
    const isDose4 = combo.includes("4");
    return {
      route: "IM",
      site: "Left Anterolateral Thigh",
      minimumInterval: isDose4 ? "12-18 Months after Dose 3" : "4 Weeks between primary doses",
      targetPopulationGroup: isDose4 ? "children" : "infants",
      notes: "0.5 ml IM injection. Administer 4-dose schedule to prevent severe Plasmodium falciparum malaria in endemic districts."
    };
  }

  // HPV
  if (combo.includes("hpv") || combo.includes("papilloma")) {
    const isDose2 = combo.includes("2");
    return {
      route: "IM",
      site: "Left Upper Arm (Deltoid)",
      minimumInterval: isDose2 ? "6 Months after HPV 1" : "Single / Initial dose at 9-14 Years",
      targetPopulationGroup: "adolescents",
      notes: "0.5 ml intramuscular injection in deltoid. Target adolescent girls 9-14 years before sexual debut to prevent cervical cancer."
    };
  }

  // Td / Tetanus-Diphtheria
  if (combo.includes("td") || combo.includes("tt") || combo.includes("tetanus")) {
    const isPreg = combo.includes("preg") || combo.includes("anc") || combo.includes("matern");
    const isSchool = combo.includes("6") || combo.includes("12") || combo.includes("school");
    return {
      route: "IM",
      site: "Left Upper Arm (Deltoid)",
      minimumInterval: isPreg ? "At least 4 weeks between ANC doses; 2+ weeks prior to delivery" : (isSchool ? "5 Years between booster doses" : "10 Years"),
      targetPopulationGroup: isPreg ? "pregnant_women" : (isSchool ? "school_age" : "adults"),
      notes: "0.5 ml intramuscular injection. For pregnant women, minimum 2 doses during pregnancy prevents maternal and neonatal tetanus."
    };
  }

  // Fallback default
  return {
    route: "IM",
    site: "Anterolateral Thigh / Deltoid Muscle",
    minimumInterval: "Standard EPI Interval (4 Weeks)",
    targetPopulationGroup: "infants",
    notes: "0.5 ml intramuscular injection. Maintain cold chain +2°C to +8°C. Use auto-disable syringe."
  };
}

export function resolveDoseMilestone(dose: { name?: string; doseCode?: string; targetAge?: string | null }): typeof AGE_MILESTONES[number] {
  const targetAge = (dose.targetAge || "").trim().toLowerCase();
  const name = (dose.name || "").trim().toLowerCase();
  const code = (dose.doseCode || "").trim().toLowerCase();
  const combo = `${name} ${code}`.toLowerCase();

  // 1. If targetAge has an explicit non-birth milestone, respect it
  if (targetAge.includes("6") && (targetAge.includes("w") || targetAge.includes("week"))) {
    return AGE_MILESTONES[1]; // 6 Weeks
  }
  if (targetAge.includes("10") && (targetAge.includes("w") || targetAge.includes("week"))) {
    return AGE_MILESTONES[2]; // 10 Weeks
  }
  if (targetAge.includes("14") && (targetAge.includes("w") || targetAge.includes("week"))) {
    return AGE_MILESTONES[3]; // 14 Weeks
  }
  if (targetAge.includes("6") && (targetAge.includes("m") || targetAge.includes("month"))) {
    return AGE_MILESTONES[4]; // 6 Months
  }
  if (targetAge.includes("9") && (targetAge.includes("m") || targetAge.includes("month"))) {
    return AGE_MILESTONES[5]; // 9 Months
  }
  if (targetAge.includes("12") && (targetAge.includes("m") || targetAge.includes("month"))) {
    return AGE_MILESTONES[6]; // 12 Months
  }
  if (targetAge.includes("18") && (targetAge.includes("m") || targetAge.includes("month"))) {
    return AGE_MILESTONES[7]; // 18 Months
  }
  if (targetAge.includes("5") || (targetAge.includes("6") && (targetAge.includes("y") || targetAge.includes("year")))) {
    return AGE_MILESTONES[8]; // 5-6 Years
  }
  if (targetAge.includes("9") && (targetAge.includes("y") || targetAge.includes("year") || targetAge.includes("hpv"))) {
    return AGE_MILESTONES[9]; // 9 Years
  }
  if (targetAge.includes("12") && (targetAge.includes("y") || targetAge.includes("year"))) {
    return AGE_MILESTONES[10]; // 12 Years
  }
  if (targetAge.includes("preg") || targetAge.includes("anc") || targetAge.includes("wom") || targetAge.includes("matern")) {
    return AGE_MILESTONES[11]; // Pregnant Women
  }

  // 2. Intelligent inference based on standard antigen name & doseCode (heals legacy default "At Birth" records)
  // Check Birth vaccines first
  if (combo.includes("bcg") || combo.includes("opv_0") || combo.includes("opv-0") || combo.includes("opv 0") || combo.includes("opv0") || combo.includes("hepb_0") || combo.includes("hepb-0") || combo.includes("hepb0")) {
    return AGE_MILESTONES[0]; // Birth
  }

  // 6 Weeks / Dose 1
  if (combo.includes("penta_1") || combo.includes("penta-1") || combo.includes("penta 1") || combo.includes("penta1") ||
      combo.includes("hexavalent 1") || combo.includes("hexavalent_1") || combo.includes("hexavalent-1") ||
      combo.includes("dtap_ipv_hb_hib_1") || combo.includes("pcv_1") || combo.includes("pcv-1") || combo.includes("pcv 1") || combo.includes("pcv1") ||
      combo.includes("rota_1") || combo.includes("rota-1") || combo.includes("rota 1") || combo.includes("rota1") ||
      combo.includes("opv_1") || combo.includes("opv-1") || combo.includes("opv 1") || combo.includes("opv1")) {
    return AGE_MILESTONES[1]; // 6 Weeks
  }

  // 10 Weeks / Dose 2
  if (combo.includes("penta_2") || combo.includes("penta-2") || combo.includes("penta 2") || combo.includes("penta2") ||
      combo.includes("hexavalent 2") || combo.includes("hexavalent_2") || combo.includes("hexavalent-2") ||
      combo.includes("dtap_ipv_hb_hib_2") || combo.includes("opv_2") || combo.includes("opv-2") || combo.includes("opv 2") || combo.includes("opv2") ||
      combo.includes("rota_2") || combo.includes("rota-2") || combo.includes("rota 2") || combo.includes("rota2") ||
      combo.includes("pcv_2") || combo.includes("pcv-2") || combo.includes("pcv 2") || combo.includes("pcv2")) {
    return AGE_MILESTONES[2]; // 10 Weeks
  }

  // 14 Weeks / Dose 3
  if (combo.includes("penta_3") || combo.includes("penta-3") || combo.includes("penta 3") || combo.includes("penta3") ||
      combo.includes("hexavalent 3") || combo.includes("hexavalent_3") || combo.includes("hexavalent-3") ||
      combo.includes("dtap_ipv_hb_hib_3") || combo.includes("ipv_1") || combo.includes("ipv-1") || combo.includes("ipv 1") || combo.includes("ipv1") ||
      combo.includes("opv_3") || combo.includes("opv-3") || combo.includes("opv 3") || combo.includes("opv3") ||
      combo.includes("pcv_3") || combo.includes("pcv-3") || combo.includes("pcv 3") || combo.includes("pcv3") ||
      combo.includes("rota_3") || combo.includes("rota-3") || combo.includes("rota 3")) {
    return AGE_MILESTONES[3]; // 14 Weeks
  }

  // 6 Months
  if (combo.includes("measles_6m") || combo.includes("measles 6m") || combo.includes("measles_0") ||
      combo.includes("malaria_1") || combo.includes("malaria-1") || combo.includes("malaria 1") || combo.includes("malaria1")) {
    return AGE_MILESTONES[4]; // 6 Months
  }

  // 9 Months
  if (combo.includes("mr_1") || combo.includes("mr-1") || combo.includes("mr 1") || combo.includes("mr1") ||
      combo.includes("measles_1") || combo.includes("measles-1") || combo.includes("measles 1") || combo.includes("measles1") ||
      combo.includes("yellow_fever") || combo.includes("yellow fever") || combo.includes("men_a") || combo.includes("mena") || combo.includes("meningitis") ||
      combo.includes("malaria_2") || combo.includes("malaria-2") || combo.includes("malaria 2") || combo.includes("malaria2")) {
    return AGE_MILESTONES[5]; // 9 Months
  }

  // 12 Months
  if (combo.includes("measles_2") || combo.includes("measles-2") || combo.includes("measles 2") || combo.includes("measles2") ||
      combo.includes("tcv") || combo.includes("typhoid") ||
      combo.includes("malaria_3") || combo.includes("malaria-3") || combo.includes("malaria 3") || combo.includes("malaria3")) {
    return AGE_MILESTONES[6]; // 12 Months
  }

  // 18 Months
  if (combo.includes("mr_2") || combo.includes("mr-2") || combo.includes("mr 2") || combo.includes("mr2") ||
      combo.includes("hexavalent 4") || combo.includes("hexavalent_4") || combo.includes("hexavalent-4") ||
      combo.includes("dtap_ipv_hb_hib_4") || combo.includes("dpt booster") || combo.includes("dpt_booster") || combo.includes("booster") ||
      combo.includes("ipv_2") || combo.includes("ipv-2") || combo.includes("ipv 2") || combo.includes("ipv2") ||
      combo.includes("malaria_4") || combo.includes("malaria-4") || combo.includes("malaria 4") || combo.includes("malaria4")) {
    return AGE_MILESTONES[7]; // 18 Months
  }

  // 5-6 Years
  if (combo.includes("td_6y") || combo.includes("td 6y") || combo.includes("6y") || combo.includes("school entry") || combo.includes("dtp_5")) {
    return AGE_MILESTONES[8]; // 5-6 Years
  }

  // 9 Years (HPV)
  if (combo.includes("hpv") || combo.includes("hpv_1") || combo.includes("hpv-1") || combo.includes("hpv 1") ||
      combo.includes("hpv_2") || combo.includes("hpv-2") || combo.includes("hpv 2") || combo.includes("human papilloma")) {
    return AGE_MILESTONES[9]; // 9 Years
  }

  // 12 Years
  if (combo.includes("td_12y") || combo.includes("td 12y") || combo.includes("12y")) {
    return AGE_MILESTONES[10]; // 12 Years
  }

  // Pregnant Women
  if (combo.includes("preg") || combo.includes("anc") || combo.includes("tt") || combo.includes("tetanus") || combo.includes("td_preg") || combo.includes("maternal")) {
    return AGE_MILESTONES[11]; // Pregnant Women
  }

  // Explicit check for targetAge containing birth
  if (targetAge.includes("birth") || targetAge === "0" || targetAge.includes("0d") || targetAge.includes("0 d") || targetAge.includes("newborn")) {
    return AGE_MILESTONES[0]; // At Birth
  }

  return AGE_MILESTONES[0];
}

/**
 * 1. South Africa - National Department of Health (EPI-SA)
 * Uses Hexavalent (DTaP-IPV-HB-Hib / Hexaxim) at 6w, 10w, 14w, 18m; PCV at 6w, 14w, 9m; Rotavirus at 6w, 14w; Measles at 6m, 12m; Td at 6y, 12y; HPV at 9y.
 */
export const SOUTH_AFRICA_PRESET: NationalSchedulePreset = {
  countryCode: "ZAF",
  countryName: "South Africa",
  authorityName: "National Department of Health (NDoH)",
  scheduleTitle: "Expanded Programme on Immunisation in South Africa (EPI-SA)",
  version: "2025-2026 Revision",
  effectiveYear: "2025",
  description: "Official NDoH schedule utilizing hexavalent (DTaP-IPV-HB-Hib), 3-dose PCV schedule (2+1), rotavirus, 6m/12m measles, grade 5 HPV, and school entry Td boosters.",
  hexColor: "#007A4D",
  recommendedStorageTemp: "+2°C to +8°C",
  milestones: ["At Birth", "6 Weeks", "10 Weeks", "14 Weeks", "6 Months", "9 Months", "12 Months", "18 Months", "6 Years", "9 Years", "12 Years", "Pregnant Women"],
  doses: [
    {
      doseCode: "bcg_birth",
      name: "BCG",
      antigen: "Tuberculosis",
      vaccineProductId: "vaccine_bcg",
      vaccineName: "BCG Vaccine",
      doseNumber: 1,
      targetAge: "At Birth",
      minimumAge: "At Birth",
      maximumAge: "12 Months",
      route: "ID",
      site: "Right Upper Arm (Deltoid insertion)",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "Give as soon after birth as possible. 0.05 ml intradermal."
    },
    {
      doseCode: "opv_0",
      name: "OPV (0)",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "Bivalent OPV",
      doseNumber: 0,
      targetAge: "At Birth",
      minimumAge: "At Birth",
      maximumAge: "2 Weeks",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "Birth dose. Do not give after 2 weeks of age."
    },
    {
      doseCode: "dtap_ipv_hb_hib_1",
      name: "Hexavalent 1 (DTaP-IPV-HB-Hib)",
      antigen: "DTP-Polio-HepB-Hib",
      vaccineProductId: "vaccine_hexavalent",
      vaccineName: "Hexavalent (DTaP-IPV-HB-Hib)",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "IM",
      site: "Left Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "0.5 ml intramuscular. Hexavalent formulation."
    },
    {
      doseCode: "pcv_1",
      name: "PCV 1",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV-10 / PCV-13",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "IM",
      site: "Right Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "0.5 ml intramuscular."
    },
    {
      doseCode: "rota_1",
      name: "Rotavirus 1",
      antigen: "Rotavirus",
      vaccineProductId: "vaccine_rota",
      vaccineName: "Rotavirus Oral Vaccine",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      maximumAge: "12 Weeks",
      route: "Oral",
      site: "Mouth (oral applicator)",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "Administer whole single-dose tube orally."
    },
    {
      doseCode: "dtap_ipv_hb_hib_2",
      name: "Hexavalent 2 (DTaP-IPV-HB-Hib)",
      antigen: "DTP-Polio-HepB-Hib",
      vaccineProductId: "vaccine_hexavalent",
      vaccineName: "Hexavalent (DTaP-IPV-HB-Hib)",
      doseNumber: 2,
      targetAge: "10 Weeks",
      minimumAge: "10 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Left Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "0.5 ml intramuscular."
    },
    {
      doseCode: "dtap_ipv_hb_hib_3",
      name: "Hexavalent 3 (DTaP-IPV-HB-Hib)",
      antigen: "DTP-Polio-HepB-Hib",
      vaccineProductId: "vaccine_hexavalent",
      vaccineName: "Hexavalent (DTaP-IPV-HB-Hib)",
      doseNumber: 3,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Left Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "0.5 ml intramuscular."
    },
    {
      doseCode: "pcv_2",
      name: "PCV 2",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV-10 / PCV-13",
      doseNumber: 2,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      minimumInterval: "8 Weeks",
      route: "IM",
      site: "Right Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "0.5 ml intramuscular."
    },
    {
      doseCode: "rota_2",
      name: "Rotavirus 2",
      antigen: "Rotavirus",
      vaccineProductId: "vaccine_rota",
      vaccineName: "Rotavirus Oral Vaccine",
      doseNumber: 2,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      maximumAge: "24 Weeks",
      minimumInterval: "4 Weeks",
      route: "Oral",
      site: "Mouth (oral applicator)",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "Must be given before 24 weeks of age."
    },
    {
      doseCode: "measles_1",
      name: "Measles 1",
      antigen: "Measles",
      vaccineProductId: "vaccine_mr",
      vaccineName: "Measles Vaccine",
      doseNumber: 1,
      targetAge: "6 Months",
      minimumAge: "6 Months",
      route: "SC",
      site: "Right Upper Arm (Deltoid)",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "0.5 ml subcutaneous. Recommended at 6 months in EPI-SA."
    },
    {
      doseCode: "pcv_3",
      name: "PCV 3 (Booster)",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV-10 / PCV-13",
      doseNumber: 3,
      targetAge: "9 Months",
      minimumAge: "9 Months",
      minimumInterval: "6 Months",
      route: "IM",
      site: "Left Anterolateral Thigh / Left Deltoid",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "0.5 ml intramuscular booster."
    },
    {
      doseCode: "measles_2",
      name: "Measles 2",
      antigen: "Measles",
      vaccineProductId: "vaccine_mr",
      vaccineName: "Measles Vaccine",
      doseNumber: 2,
      targetAge: "12 Months",
      minimumAge: "12 Months",
      minimumInterval: "6 Months",
      route: "SC",
      site: "Right Upper Arm (Deltoid)",
      targetPopulationGroup: "children",
      classification: "routine",
      notes: "0.5 ml subcutaneous. Second routine dose."
    },
    {
      doseCode: "dtap_ipv_hb_hib_4",
      name: "Hexavalent 4 (Booster)",
      antigen: "DTP-Polio-HepB-Hib",
      vaccineProductId: "vaccine_hexavalent",
      vaccineName: "Hexavalent (DTaP-IPV-HB-Hib)",
      doseNumber: 4,
      targetAge: "18 Months",
      minimumAge: "18 Months",
      minimumInterval: "12 Months",
      route: "IM",
      site: "Left Upper Arm (Deltoid)",
      targetPopulationGroup: "children",
      classification: "routine",
      notes: "0.5 ml intramuscular booster."
    },
    {
      doseCode: "td_6y",
      name: "Td (6 Years)",
      antigen: "Tetanus-Diphtheria",
      vaccineProductId: "vaccine_td",
      vaccineName: "Tetanus and reduced Diphtheria (Td)",
      doseNumber: 1,
      targetAge: "6 Years",
      minimumAge: "5 Years",
      route: "IM",
      site: "Left Upper Arm (Deltoid)",
      targetPopulationGroup: "school_age",
      classification: "routine",
      notes: "School entry booster. 0.5 ml intramuscular."
    },
    {
      doseCode: "hpv_1",
      name: "HPV 1",
      antigen: "Human Papillomavirus",
      vaccineProductId: "vaccine_hpv",
      vaccineName: "HPV Bivalent / Quadrivalent",
      doseNumber: 1,
      targetAge: "9 Years",
      minimumAge: "9 Years",
      route: "IM",
      site: "Right Upper Arm (Deltoid)",
      targetPopulationGroup: "adolescents",
      classification: "routine",
      notes: "Administered in Grade 5 school vaccination campaigns. 0.5 ml IM."
    },
    {
      doseCode: "hpv_2",
      name: "HPV 2",
      antigen: "Human Papillomavirus",
      vaccineProductId: "vaccine_hpv",
      vaccineName: "HPV Bivalent / Quadrivalent",
      doseNumber: 2,
      targetAge: "9 Years",
      minimumAge: "9 Years",
      minimumInterval: "6 Months",
      route: "IM",
      site: "Right Upper Arm (Deltoid)",
      targetPopulationGroup: "adolescents",
      classification: "routine",
      notes: "6 months after HPV 1."
    },
    {
      doseCode: "td_12y",
      name: "Td (12 Years)",
      antigen: "Tetanus-Diphtheria",
      vaccineProductId: "vaccine_td",
      vaccineName: "Tetanus and reduced Diphtheria (Td)",
      doseNumber: 2,
      targetAge: "12 Years",
      minimumAge: "11 Years",
      route: "IM",
      site: "Left Upper Arm (Deltoid)",
      targetPopulationGroup: "adolescents",
      classification: "routine",
      notes: "Grade 7 school booster. 0.5 ml IM."
    },
    {
      doseCode: "td_preg_1",
      name: "Td 1 (Pregnancy)",
      antigen: "Tetanus-Diphtheria",
      vaccineProductId: "vaccine_td",
      vaccineName: "Tetanus and reduced Diphtheria (Td)",
      doseNumber: 1,
      targetAge: "Pregnant Women",
      minimumAge: "1st Trimester",
      route: "IM",
      site: "Left Upper Arm (Deltoid)",
      targetPopulationGroup: "pregnant_women",
      classification: "routine",
      notes: "Given at first antenatal care (ANC) contact."
    },
    {
      doseCode: "td_preg_2",
      name: "Td 2 (Pregnancy)",
      antigen: "Tetanus-Diphtheria",
      vaccineProductId: "vaccine_td",
      vaccineName: "Tetanus and reduced Diphtheria (Td)",
      doseNumber: 2,
      targetAge: "Pregnant Women",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Left Upper Arm (Deltoid)",
      targetPopulationGroup: "pregnant_women",
      classification: "routine",
      notes: "At least 4 weeks after Td 1, preferably 2+ weeks before delivery."
    }
  ]
};

/**
 * 2. Zambia - Ministry of Health EPI Schedule
 */
export const ZAMBIA_PRESET: NationalSchedulePreset = {
  countryCode: "ZMB",
  countryName: "Zambia",
  authorityName: "Ministry of Health (MoH)",
  scheduleTitle: "National Child Immunisation Schedule - Zambia EPI",
  version: "2024-2025 Revised",
  effectiveYear: "2024",
  description: "Zambia MoH national schedule incorporating Pentavalent, bOPV, fIPV/IPV, PCV, Rotavirus, Measles-Rubella (9m & 18m), and adolescent HPV.",
  hexColor: "#198754",
  recommendedStorageTemp: "+2°C to +8°C",
  milestones: ["At Birth", "6 Weeks", "10 Weeks", "14 Weeks", "9 Months", "18 Months", "9-14 Years", "Pregnant Women"],
  doses: [
    {
      doseCode: "bcg_birth",
      name: "BCG",
      antigen: "Tuberculosis",
      vaccineProductId: "vaccine_bcg",
      vaccineName: "BCG Vaccine",
      doseNumber: 1,
      targetAge: "At Birth",
      minimumAge: "At Birth",
      route: "ID",
      site: "Right Upper Arm",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_0",
      name: "OPV-0",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 0,
      targetAge: "At Birth",
      minimumAge: "At Birth",
      maximumAge: "2 Weeks",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "penta_1",
      name: "PENTA-1 (DTP-HepB-Hib)",
      antigen: "DTP-HepB-Hib",
      vaccineProductId: "vaccine_penta",
      vaccineName: "Pentavalent Vaccine",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "IM",
      site: "Left Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_1",
      name: "OPV-1",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "pcv_1",
      name: "PCV-1",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV Vaccine",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "IM",
      site: "Right Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "rota_1",
      name: "Rotavirus-1",
      antigen: "Rotavirus",
      vaccineProductId: "vaccine_rota",
      vaccineName: "Rotavirus Vaccine",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "Oral",
      site: "Mouth",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "penta_2",
      name: "PENTA-2 (DTP-HepB-Hib)",
      antigen: "DTP-HepB-Hib",
      vaccineProductId: "vaccine_penta",
      vaccineName: "Pentavalent Vaccine",
      doseNumber: 2,
      targetAge: "10 Weeks",
      minimumAge: "10 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Left Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_2",
      name: "OPV-2",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 2,
      targetAge: "10 Weeks",
      minimumAge: "10 Weeks",
      minimumInterval: "4 Weeks",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "pcv_2",
      name: "PCV-2",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV Vaccine",
      doseNumber: 2,
      targetAge: "10 Weeks",
      minimumAge: "10 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Right Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "rota_2",
      name: "Rotavirus-2",
      antigen: "Rotavirus",
      vaccineProductId: "vaccine_rota",
      vaccineName: "Rotavirus Vaccine",
      doseNumber: 2,
      targetAge: "10 Weeks",
      minimumAge: "10 Weeks",
      minimumInterval: "4 Weeks",
      route: "Oral",
      site: "Mouth",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "penta_3",
      name: "PENTA-3 (DTP-HepB-Hib)",
      antigen: "DTP-HepB-Hib",
      vaccineProductId: "vaccine_penta",
      vaccineName: "Pentavalent Vaccine",
      doseNumber: 3,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Left Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_3",
      name: "OPV-3",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 3,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      minimumInterval: "4 Weeks",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "pcv_3",
      name: "PCV-3",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV Vaccine",
      doseNumber: 3,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Right Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "ipv_1",
      name: "IPV-1",
      antigen: "Inactivated Polio",
      vaccineProductId: "vaccine_ipv",
      vaccineName: "IPV Vaccine",
      doseNumber: 1,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      route: "IM",
      site: "Right Outer Thigh (separate site)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "mr_1",
      name: "MR-1 (Measles-Rubella)",
      antigen: "Measles-Rubella",
      vaccineProductId: "vaccine_mr",
      vaccineName: "Measles-Rubella (MR)",
      doseNumber: 1,
      targetAge: "9 Months",
      minimumAge: "9 Months",
      route: "SC",
      site: "Left Upper Arm",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "mr_2",
      name: "MR-2 (Measles-Rubella)",
      antigen: "Measles-Rubella",
      vaccineProductId: "vaccine_mr",
      vaccineName: "Measles-Rubella (MR)",
      doseNumber: 2,
      targetAge: "18 Months",
      minimumAge: "18 Months",
      minimumInterval: "6 Months",
      route: "SC",
      site: "Left Upper Arm",
      targetPopulationGroup: "children",
      classification: "routine"
    },
    {
      doseCode: "hpv_1",
      name: "HPV-1 (Girls 9-14y)",
      antigen: "Human Papillomavirus",
      vaccineProductId: "vaccine_hpv",
      vaccineName: "HPV Vaccine",
      doseNumber: 1,
      targetAge: "9-14 Years",
      minimumAge: "9 Years",
      route: "IM",
      site: "Left Upper Arm (Deltoid)",
      targetPopulationGroup: "adolescents",
      classification: "routine"
    },
    {
      doseCode: "td_preg",
      name: "Td (Tetanus-Diphtheria for Pregnant Women)",
      antigen: "Tetanus-Diphtheria",
      vaccineProductId: "vaccine_td",
      vaccineName: "Td Vaccine",
      doseNumber: 1,
      targetAge: "Pregnant Women",
      route: "IM",
      site: "Left Upper Arm (Deltoid)",
      targetPopulationGroup: "pregnant_women",
      classification: "routine"
    }
  ]
};

/**
 * 3. South Sudan - Ministry of Health EPI Schedule
 */
export const SOUTH_SUDAN_PRESET: NationalSchedulePreset = {
  countryCode: "SSD",
  countryName: "South Sudan",
  authorityName: "Ministry of Health (MoH)",
  scheduleTitle: "South Sudan Expanded Programme on Immunization",
  version: "2024 Revision",
  effectiveYear: "2024",
  description: "Official South Sudan national EPI schedule including Yellow Fever at 9 months alongside Measles, Pentavalent, PCV, bOPV, and IPV.",
  hexColor: "#006400",
  recommendedStorageTemp: "+2°C to +8°C",
  milestones: ["At Birth", "6 Weeks", "10 Weeks", "14 Weeks", "9 Months", "18 Months", "Pregnant Women"],
  doses: [
    {
      doseCode: "bcg_birth",
      name: "BCG",
      antigen: "Tuberculosis",
      vaccineProductId: "vaccine_bcg",
      vaccineName: "BCG Vaccine",
      doseNumber: 1,
      targetAge: "At Birth",
      minimumAge: "At Birth",
      route: "ID",
      site: "Right Upper Arm",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_0",
      name: "OPV-0",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 0,
      targetAge: "At Birth",
      minimumAge: "At Birth",
      maximumAge: "2 Weeks",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "penta_1",
      name: "PENTA-1",
      antigen: "DTP-HepB-Hib",
      vaccineProductId: "vaccine_penta",
      vaccineName: "Pentavalent Vaccine",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "IM",
      site: "Left Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_1",
      name: "OPV-1",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "pcv_1",
      name: "PCV-1",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV Vaccine",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "IM",
      site: "Right Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "rota_1",
      name: "Rotavirus-1",
      antigen: "Rotavirus",
      vaccineProductId: "vaccine_rota",
      vaccineName: "Rotavirus Vaccine",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "Oral",
      site: "Mouth",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "penta_2",
      name: "PENTA-2",
      antigen: "DTP-HepB-Hib",
      vaccineProductId: "vaccine_penta",
      vaccineName: "Pentavalent Vaccine",
      doseNumber: 2,
      targetAge: "10 Weeks",
      minimumAge: "10 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Left Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_2",
      name: "OPV-2",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 2,
      targetAge: "10 Weeks",
      minimumAge: "10 Weeks",
      minimumInterval: "4 Weeks",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "pcv_2",
      name: "PCV-2",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV Vaccine",
      doseNumber: 2,
      targetAge: "10 Weeks",
      minimumAge: "10 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Right Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "penta_3",
      name: "PENTA-3",
      antigen: "DTP-HepB-Hib",
      vaccineProductId: "vaccine_penta",
      vaccineName: "Pentavalent Vaccine",
      doseNumber: 3,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Left Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_3",
      name: "OPV-3",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 3,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      minimumInterval: "4 Weeks",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "pcv_3",
      name: "PCV-3",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV Vaccine",
      doseNumber: 3,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Right Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "ipv_1",
      name: "IPV-1",
      antigen: "Inactivated Polio",
      vaccineProductId: "vaccine_ipv",
      vaccineName: "IPV Vaccine",
      doseNumber: 1,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      route: "IM",
      site: "Right Outer Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "measles_1",
      name: "Measles-1",
      antigen: "Measles",
      vaccineProductId: "vaccine_mr",
      vaccineName: "Measles Vaccine",
      doseNumber: 1,
      targetAge: "9 Months",
      minimumAge: "9 Months",
      route: "SC",
      site: "Left Upper Arm",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "yellow_fever_1",
      name: "Yellow Fever",
      antigen: "Yellow Fever",
      vaccineProductId: "vaccine_yellow_fever",
      vaccineName: "Yellow Fever Vaccine",
      doseNumber: 1,
      targetAge: "9 Months",
      minimumAge: "9 Months",
      route: "SC",
      site: "Right Upper Arm",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "measles_2",
      name: "Measles-2",
      antigen: "Measles",
      vaccineProductId: "vaccine_mr",
      vaccineName: "Measles Vaccine",
      doseNumber: 2,
      targetAge: "18 Months",
      minimumAge: "18 Months",
      minimumInterval: "6 Months",
      route: "SC",
      site: "Left Upper Arm",
      targetPopulationGroup: "children",
      classification: "routine"
    },
    {
      doseCode: "td_preg",
      name: "Td (Tetanus-Diphtheria for Women)",
      antigen: "Tetanus-Diphtheria",
      vaccineProductId: "vaccine_td",
      vaccineName: "Td Vaccine",
      doseNumber: 1,
      targetAge: "Pregnant Women",
      route: "IM",
      site: "Left Upper Arm",
      targetPopulationGroup: "pregnant_women",
      classification: "routine"
    }
  ]
};

/**
 * 4. Papua New Guinea - National Department of Health
 */
export const PNG_PRESET: NationalSchedulePreset = {
  countryCode: "PNG",
  countryName: "Papua New Guinea",
  authorityName: "National Department of Health (NDoH)",
  scheduleTitle: "Papua New Guinea National Immunisation Schedule",
  version: "2024 Revision",
  effectiveYear: "2024",
  description: "PNG National EPI schedule featuring birth Hepatitis B (HepB-0), Pentavalent + PCV + OPV series at 1m, 2m, 3m, 6m Measles, and 9m & 18m MR.",
  hexColor: "#CE1126",
  recommendedStorageTemp: "+2°C to +8°C",
  milestones: ["At Birth", "1 Month", "2 Months", "3 Months", "6 Months", "9 Months", "18 Months", "Pregnant Women"],
  doses: [
    {
      doseCode: "bcg_birth",
      name: "BCG",
      antigen: "Tuberculosis",
      vaccineProductId: "vaccine_bcg",
      vaccineName: "BCG Vaccine",
      doseNumber: 1,
      targetAge: "At Birth",
      minimumAge: "At Birth",
      route: "ID",
      site: "Right Upper Arm",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "hepb_0",
      name: "Hepatitis B (0)",
      antigen: "Hepatitis B",
      vaccineProductId: "vaccine_hepb",
      vaccineName: "HepB Monovalent",
      doseNumber: 0,
      targetAge: "At Birth",
      minimumAge: "At Birth",
      maximumAge: "24 Hours",
      route: "IM",
      site: "Left Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "Give within 24 hours of birth."
    },
    {
      doseCode: "penta_1",
      name: "Penta-1 (DTP-HepB-Hib)",
      antigen: "DTP-HepB-Hib",
      vaccineProductId: "vaccine_penta",
      vaccineName: "Pentavalent Vaccine",
      doseNumber: 1,
      targetAge: "1 Month",
      minimumAge: "4 Weeks",
      route: "IM",
      site: "Left Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "pcv_1",
      name: "PCV-1",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV Vaccine",
      doseNumber: 1,
      targetAge: "1 Month",
      minimumAge: "4 Weeks",
      route: "IM",
      site: "Right Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_1",
      name: "OPV-1",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 1,
      targetAge: "1 Month",
      minimumAge: "4 Weeks",
      route: "Oral",
      site: "Mouth",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "penta_2",
      name: "Penta-2 (DTP-HepB-Hib)",
      antigen: "DTP-HepB-Hib",
      vaccineProductId: "vaccine_penta",
      vaccineName: "Pentavalent Vaccine",
      doseNumber: 2,
      targetAge: "2 Months",
      minimumAge: "8 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Left Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "pcv_2",
      name: "PCV-2",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV Vaccine",
      doseNumber: 2,
      targetAge: "2 Months",
      minimumAge: "8 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Right Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_2",
      name: "OPV-2",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 2,
      targetAge: "2 Months",
      minimumAge: "8 Weeks",
      minimumInterval: "4 Weeks",
      route: "Oral",
      site: "Mouth",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "penta_3",
      name: "Penta-3 (DTP-HepB-Hib)",
      antigen: "DTP-HepB-Hib",
      vaccineProductId: "vaccine_penta",
      vaccineName: "Pentavalent Vaccine",
      doseNumber: 3,
      targetAge: "3 Months",
      minimumAge: "12 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Left Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "pcv_3",
      name: "PCV-3",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV Vaccine",
      doseNumber: 3,
      targetAge: "3 Months",
      minimumAge: "12 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Right Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_3",
      name: "OPV-3",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 3,
      targetAge: "3 Months",
      minimumAge: "12 Weeks",
      minimumInterval: "4 Weeks",
      route: "Oral",
      site: "Mouth",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "ipv_1",
      name: "IPV-1",
      antigen: "Inactivated Polio",
      vaccineProductId: "vaccine_ipv",
      vaccineName: "IPV Vaccine",
      doseNumber: 1,
      targetAge: "3 Months",
      minimumAge: "12 Weeks",
      route: "IM",
      site: "Right Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "measles_6m",
      name: "Measles (6 Months)",
      antigen: "Measles",
      vaccineProductId: "vaccine_mr",
      vaccineName: "Measles Vaccine",
      doseNumber: 1,
      targetAge: "6 Months",
      minimumAge: "6 Months",
      route: "SC",
      site: "Left Upper Arm",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "mr_1",
      name: "MR-1",
      antigen: "Measles-Rubella",
      vaccineProductId: "vaccine_mr",
      vaccineName: "Measles-Rubella (MR)",
      doseNumber: 2,
      targetAge: "9 Months",
      minimumAge: "9 Months",
      route: "SC",
      site: "Left Upper Arm",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "mr_2",
      name: "MR-2",
      antigen: "Measles-Rubella",
      vaccineProductId: "vaccine_mr",
      vaccineName: "Measles-Rubella (MR)",
      doseNumber: 3,
      targetAge: "18 Months",
      minimumAge: "18 Months",
      minimumInterval: "6 Months",
      route: "SC",
      site: "Left Upper Arm",
      targetPopulationGroup: "children",
      classification: "routine"
    }
  ]
};

/**
 * 5. WHO Global / AFRO Standard Schedule
 */
export const WHO_AFRO_PRESET: NationalSchedulePreset = {
  countryCode: "WHO",
  countryName: "WHO AFRO Baseline",
  authorityName: "World Health Organization (WHO AFRO)",
  scheduleTitle: "WHO Recommended Routine Immunization Schedule",
  version: "2025 Standard Baseline",
  effectiveYear: "2025",
  description: "Universal WHO AFRO baseline reference schedule including standard EPI vaccines, Malaria (R21 / RTS,S), Meningitis A, Yellow Fever, Typhoid (TCV), and HPV.",
  hexColor: "#0093D5",
  recommendedStorageTemp: "+2°C to +8°C",
  milestones: ["At Birth", "6 Weeks", "10 Weeks", "14 Weeks", "6 Months", "9 Months", "12 Months", "18 Months", "9-14 Years", "Pregnant Women"],
  doses: [
    {
      doseCode: "bcg_birth",
      name: "BCG",
      antigen: "Tuberculosis",
      vaccineProductId: "vaccine_bcg",
      vaccineName: "BCG",
      doseNumber: 1,
      targetAge: "At Birth",
      minimumAge: "At Birth",
      route: "ID",
      site: "Right Upper Arm",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_0",
      name: "OPV-0",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 0,
      targetAge: "At Birth",
      minimumAge: "At Birth",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "penta_1",
      name: "Penta-1",
      antigen: "DTP-HepB-Hib",
      vaccineProductId: "vaccine_penta",
      vaccineName: "Pentavalent (DTP-HepB-Hib)",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "IM",
      site: "Left Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_1",
      name: "OPV-1",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "pcv_1",
      name: "PCV-1",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "IM",
      site: "Right Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "rota_1",
      name: "Rotavirus-1",
      antigen: "Rotavirus",
      vaccineProductId: "vaccine_rota",
      vaccineName: "Rotavirus Vaccine",
      doseNumber: 1,
      targetAge: "6 Weeks",
      minimumAge: "6 Weeks",
      route: "Oral",
      site: "Mouth",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "penta_2",
      name: "Penta-2",
      antigen: "DTP-HepB-Hib",
      vaccineProductId: "vaccine_penta",
      vaccineName: "Pentavalent (DTP-HepB-Hib)",
      doseNumber: 2,
      targetAge: "10 Weeks",
      minimumAge: "10 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Left Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_2",
      name: "OPV-2",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 2,
      targetAge: "10 Weeks",
      minimumAge: "10 Weeks",
      minimumInterval: "4 Weeks",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "pcv_2",
      name: "PCV-2",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV",
      doseNumber: 2,
      targetAge: "10 Weeks",
      minimumAge: "10 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Right Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "rota_2",
      name: "Rotavirus-2",
      antigen: "Rotavirus",
      vaccineProductId: "vaccine_rota",
      vaccineName: "Rotavirus Vaccine",
      doseNumber: 2,
      targetAge: "10 Weeks",
      minimumAge: "10 Weeks",
      minimumInterval: "4 Weeks",
      route: "Oral",
      site: "Mouth",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "penta_3",
      name: "Penta-3",
      antigen: "DTP-HepB-Hib",
      vaccineProductId: "vaccine_penta",
      vaccineName: "Pentavalent (DTP-HepB-Hib)",
      doseNumber: 3,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Left Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "opv_3",
      name: "OPV-3",
      antigen: "Polio (Oral)",
      vaccineProductId: "vaccine_opv",
      vaccineName: "bOPV",
      doseNumber: 3,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      minimumInterval: "4 Weeks",
      route: "Oral",
      site: "Mouth (2 drops)",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "pcv_3",
      name: "PCV-3",
      antigen: "Pneumococcal Conjugate",
      vaccineProductId: "vaccine_pcv",
      vaccineName: "PCV",
      doseNumber: 3,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      minimumInterval: "4 Weeks",
      route: "IM",
      site: "Right Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "ipv_1",
      name: "IPV-1",
      antigen: "Inactivated Polio",
      vaccineProductId: "vaccine_ipv",
      vaccineName: "IPV",
      doseNumber: 1,
      targetAge: "14 Weeks",
      minimumAge: "14 Weeks",
      route: "IM",
      site: "Right Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "malaria_1",
      name: "Malaria-1 (RTS,S / R21)",
      antigen: "Malaria",
      vaccineProductId: "vaccine_malaria",
      vaccineName: "Malaria Vaccine",
      doseNumber: 1,
      targetAge: "6 Months",
      minimumAge: "5 Months",
      route: "IM",
      site: "Left Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine",
      notes: "In malaria endemic areas."
    },
    {
      doseCode: "mr_1",
      name: "MR-1",
      antigen: "Measles-Rubella",
      vaccineProductId: "vaccine_mr",
      vaccineName: "Measles-Rubella (MR)",
      doseNumber: 1,
      targetAge: "9 Months",
      minimumAge: "9 Months",
      route: "SC",
      site: "Right Upper Arm",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "yellow_fever_1",
      name: "Yellow Fever",
      antigen: "Yellow Fever",
      vaccineProductId: "vaccine_yellow_fever",
      vaccineName: "Yellow Fever Vaccine",
      doseNumber: 1,
      targetAge: "9 Months",
      minimumAge: "9 Months",
      route: "SC",
      site: "Left Upper Arm",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "men_a_1",
      name: "MenA (Meningitis A)",
      antigen: "Meningococcal A",
      vaccineProductId: "vaccine_meningitis",
      vaccineName: "Meningitis A Conjugate",
      doseNumber: 1,
      targetAge: "9 Months",
      minimumAge: "9 Months",
      route: "IM",
      site: "Left Anterolateral Thigh",
      targetPopulationGroup: "infants",
      classification: "routine"
    },
    {
      doseCode: "mr_2",
      name: "MR-2",
      antigen: "Measles-Rubella",
      vaccineProductId: "vaccine_mr",
      vaccineName: "Measles-Rubella (MR)",
      doseNumber: 2,
      targetAge: "18 Months",
      minimumAge: "18 Months",
      minimumInterval: "6 Months",
      route: "SC",
      site: "Right Upper Arm",
      targetPopulationGroup: "children",
      classification: "routine"
    },
    {
      doseCode: "hpv_1",
      name: "HPV-1",
      antigen: "Human Papillomavirus",
      vaccineProductId: "vaccine_hpv",
      vaccineName: "HPV Vaccine",
      doseNumber: 1,
      targetAge: "9-14 Years",
      minimumAge: "9 Years",
      route: "IM",
      site: "Left Upper Arm",
      targetPopulationGroup: "adolescents",
      classification: "routine"
    },
    {
      doseCode: "td_preg",
      name: "Td (Tetanus-Diphtheria)",
      antigen: "Tetanus-Diphtheria",
      vaccineProductId: "vaccine_td",
      vaccineName: "Td Vaccine",
      doseNumber: 1,
      targetAge: "Pregnant Women",
      route: "IM",
      site: "Left Upper Arm",
      targetPopulationGroup: "pregnant_women",
      classification: "routine"
    }
  ]
};

export const ALL_NATIONAL_PRESETS: Record<string, NationalSchedulePreset> = {
  ZAF: SOUTH_AFRICA_PRESET,
  ZMB: ZAMBIA_PRESET,
  SSD: SOUTH_SUDAN_PRESET,
  PNG: PNG_PRESET,
  WHO: WHO_AFRO_PRESET
};

export function getPresetForCountry(countryCode?: string | null): NationalSchedulePreset {
  if (!countryCode) return WHO_AFRO_PRESET;
  const upper = countryCode.toUpperCase();
  return ALL_NATIONAL_PRESETS[upper] || ALL_NATIONAL_PRESETS[upper.slice(0, 3)] || WHO_AFRO_PRESET;
}
