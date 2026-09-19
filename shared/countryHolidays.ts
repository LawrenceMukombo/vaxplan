export interface NationalCalendarEvent {
  id: string;
  tenantId?: string;
  countryCode: string;
  title: string;
  eventType: "public_holiday" | "health_event" | "campaign" | "si_window" | "training" | "supervision";
  startDate: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  isNational: boolean;
  description?: string;
  impactOnSessions?: "closed" | "rescheduled" | "high_turnout_opportunity" | "routine";
  color?: string;
  customized?: boolean;
}

/**
 * Standard public holidays and official health campaign calendar for South Africa (ZAF)
 */
export const SOUTH_AFRICA_CALENDAR_EVENTS: NationalCalendarEvent[] = [
  // Public Holidays 2025-2026
  { id: "zaf_new_years", countryCode: "ZAF", title: "New Year's Day", eventType: "public_holiday", startDate: "2025-01-01", isNational: true, impactOnSessions: "closed", description: "National Public Holiday. Routine fixed sessions closed; emergency care only." },
  { id: "zaf_human_rights", countryCode: "ZAF", title: "Human Rights Day", eventType: "public_holiday", startDate: "2025-03-21", isNational: true, impactOnSessions: "closed", description: "National Public Holiday. Fixed clinics closed." },
  { id: "zaf_good_friday", countryCode: "ZAF", title: "Good Friday", eventType: "public_holiday", startDate: "2025-04-18", isNational: true, impactOnSessions: "closed", description: "Christian Holy Day. Facility sessions suspended." },
  { id: "zaf_family_day", countryCode: "ZAF", title: "Family Day (Easter Monday)", eventType: "public_holiday", startDate: "2025-04-21", isNational: true, impactOnSessions: "closed", description: "Public Holiday following Easter Sunday." },
  { id: "zaf_freedom_day", countryCode: "ZAF", title: "Freedom Day", eventType: "public_holiday", startDate: "2025-04-27", isNational: true, impactOnSessions: "closed", description: "Commemoration of first democratic elections." },
  { id: "zaf_freedom_day_obs", countryCode: "ZAF", title: "Freedom Day (Observed)", eventType: "public_holiday", startDate: "2025-04-28", isNational: true, impactOnSessions: "closed", description: "Public holiday observed as 27 April falls on Sunday." },
  { id: "zaf_workers_day", countryCode: "ZAF", title: "Workers' Day", eventType: "public_holiday", startDate: "2025-05-01", isNational: true, impactOnSessions: "closed", description: "International Workers' Day." },
  { id: "zaf_youth_day", countryCode: "ZAF", title: "Youth Day", eventType: "public_holiday", startDate: "2025-06-16", isNational: true, impactOnSessions: "closed", description: "National Youth Day commemoration." },
  { id: "zaf_womens_day", countryCode: "ZAF", title: "National Women's Day", eventType: "public_holiday", startDate: "2025-08-09", isNational: true, impactOnSessions: "closed", description: "Celebration of women's contribution to South Africa." },
  { id: "zaf_heritage_day", countryCode: "ZAF", title: "Heritage Day", eventType: "public_holiday", startDate: "2025-09-24", isNational: true, impactOnSessions: "closed", description: "National cultural heritage celebration." },
  { id: "zaf_reconciliation", countryCode: "ZAF", title: "Day of Reconciliation", eventType: "public_holiday", startDate: "2025-12-16", isNational: true, impactOnSessions: "closed", description: "Promoting national unity and harmony." },
  { id: "zaf_xmas", countryCode: "ZAF", title: "Christmas Day", eventType: "public_holiday", startDate: "2025-12-25", isNational: true, impactOnSessions: "closed", description: "Christmas Day." },
  { id: "zaf_goodwill", countryCode: "ZAF", title: "Day of Goodwill", eventType: "public_holiday", startDate: "2025-12-26", isNational: true, impactOnSessions: "closed", description: "Day of Goodwill (Boxing Day)." },

  // Official EPI & Public Health Campaign Events
  { id: "zaf_avw_2025", countryCode: "ZAF", title: "African Vaccination Week (AVW)", eventType: "campaign", startDate: "2025-04-24", endDate: "2025-04-30", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "High-intensity intensification of routine immunization (IRI) and catch-up for zero-dose children across all districts." },
  { id: "zaf_child_health_days_1", countryCode: "ZAF", title: "National Child Health Days (Round 1)", eventType: "campaign", startDate: "2025-05-12", endDate: "2025-05-18", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Integrated vitamin A supplementation, deworming, and routine EPI catch-up." },
  { id: "zaf_hpv_round_1", countryCode: "ZAF", title: "Grade 5 HPV School Vaccination (Round 1)", eventType: "si_window", startDate: "2025-02-10", endDate: "2025-03-14", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Outreach teams deploy to primary schools to administer HPV Dose 1 to 9-year-old girls." },
  { id: "zaf_hpv_round_2", countryCode: "ZAF", title: "Grade 5 HPV School Vaccination (Round 2)", eventType: "si_window", startDate: "2025-09-01", endDate: "2025-10-03", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Second round HPV school outreach." },
  { id: "zaf_world_polio_day", countryCode: "ZAF", title: "World Polio Day & Acute Flaccid Paralysis (AFP) Review", eventType: "health_event", startDate: "2025-10-24", isNational: true, impactOnSessions: "routine", description: "Global Polio Eradication Initiative advocacy and AFP active surveillance audit." },
  { id: "zaf_measles_catchup", countryCode: "ZAF", title: "National Measles Catch-up SIAs Window", eventType: "campaign", startDate: "2025-11-03", endDate: "2025-11-14", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Supplementary Immunization Activity for children aged 6-59 months." },

  // 2026 Public Holidays & Official Health Campaigns
  { id: "zaf_new_years_2026", countryCode: "ZAF", title: "New Year's Day", eventType: "public_holiday", startDate: "2026-01-01", isNational: true, impactOnSessions: "closed", description: "National Public Holiday." },
  { id: "zaf_hpv_round_1_2026", countryCode: "ZAF", title: "Grade 5 HPV School Vaccination (Round 1)", eventType: "si_window", startDate: "2026-02-09", endDate: "2026-03-13", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Outreach teams deploy to primary schools to administer HPV Dose 1 to 9-year-old girls." },
  { id: "zaf_human_rights_2026", countryCode: "ZAF", title: "Human Rights Day", eventType: "public_holiday", startDate: "2026-03-21", isNational: true, impactOnSessions: "closed", description: "National Public Holiday." },
  { id: "zaf_good_friday_2026", countryCode: "ZAF", title: "Good Friday", eventType: "public_holiday", startDate: "2026-04-03", isNational: true, impactOnSessions: "closed", description: "Christian Holy Day." },
  { id: "zaf_family_day_2026", countryCode: "ZAF", title: "Family Day", eventType: "public_holiday", startDate: "2026-04-06", isNational: true, impactOnSessions: "closed", description: "Public Holiday following Easter." },
  { id: "zaf_avw_2026", countryCode: "ZAF", title: "African Vaccination Week (AVW)", eventType: "campaign", startDate: "2026-04-24", endDate: "2026-04-30", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Intensification of routine immunization across South Africa." },
  { id: "zaf_freedom_day_2026", countryCode: "ZAF", title: "Freedom Day", eventType: "public_holiday", startDate: "2026-04-27", isNational: true, impactOnSessions: "closed", description: "National Freedom Day." },
  { id: "zaf_workers_day_2026", countryCode: "ZAF", title: "Workers' Day", eventType: "public_holiday", startDate: "2026-05-01", isNational: true, impactOnSessions: "closed", description: "International Workers' Day." },
  { id: "zaf_child_health_days_1_2026", countryCode: "ZAF", title: "National Child Health Days (Round 1)", eventType: "campaign", startDate: "2026-05-11", endDate: "2026-05-17", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Integrated vitamin A supplementation, deworming, and routine EPI catch-up." },
  { id: "zaf_youth_day_2026", countryCode: "ZAF", title: "Youth Day", eventType: "public_holiday", startDate: "2026-06-16", isNational: true, impactOnSessions: "closed", description: "National Youth Day." },
  { id: "zaf_womens_day_2026", countryCode: "ZAF", title: "National Women's Day", eventType: "public_holiday", startDate: "2026-08-09", isNational: true, impactOnSessions: "closed", description: "National Women's Day." },
  { id: "zaf_womens_day_obs_2026", countryCode: "ZAF", title: "National Women's Day (Observed)", eventType: "public_holiday", startDate: "2026-08-10", isNational: true, impactOnSessions: "closed", description: "Public holiday observed as 9 August falls on Sunday." },
  { id: "zaf_hpv_round_2_2026", countryCode: "ZAF", title: "Grade 5 HPV School Vaccination (Round 2)", eventType: "si_window", startDate: "2026-09-01", endDate: "2026-10-02", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Second round HPV school outreach." },
  { id: "zaf_heritage_day_2026", countryCode: "ZAF", title: "Heritage Day", eventType: "public_holiday", startDate: "2026-09-24", isNational: true, impactOnSessions: "closed", description: "National Heritage Day." },
  { id: "zaf_child_health_days_2_2026", countryCode: "ZAF", title: "National Child Health Days (Round 2)", eventType: "campaign", startDate: "2026-10-12", endDate: "2026-10-18", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Integrated child health week, vitamin A, and zero-dose catch-up." },
  { id: "zaf_world_polio_2026", countryCode: "ZAF", title: "World Polio Day & AFP Review", eventType: "health_event", startDate: "2026-10-24", isNational: true, impactOnSessions: "routine", description: "World Polio Day advocacy and AFP active surveillance audit." },
  { id: "zaf_measles_catchup_2026", countryCode: "ZAF", title: "National Measles Catch-up SIAs Window", eventType: "campaign", startDate: "2026-11-02", endDate: "2026-11-13", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Supplementary Immunization Activity for children aged 6-59 months." },
  { id: "zaf_reconciliation_2026", countryCode: "ZAF", title: "Day of Reconciliation", eventType: "public_holiday", startDate: "2026-12-16", isNational: true, impactOnSessions: "closed", description: "Day of Reconciliation." },
  { id: "zaf_xmas_2026", countryCode: "ZAF", title: "Christmas Day", eventType: "public_holiday", startDate: "2026-12-25", isNational: true, impactOnSessions: "closed", description: "Christmas Day." },
  { id: "zaf_goodwill_2026", countryCode: "ZAF", title: "Day of Goodwill", eventType: "public_holiday", startDate: "2026-12-26", isNational: true, impactOnSessions: "closed", description: "Day of Goodwill." },
];

/**
 * Standard public holidays and official health campaign calendar for Zambia (ZMB)
 */
export const ZAMBIA_CALENDAR_EVENTS: NationalCalendarEvent[] = [
  { id: "zmb_new_year", countryCode: "ZMB", title: "New Year's Day", eventType: "public_holiday", startDate: "2025-01-01", isNational: true, impactOnSessions: "closed", description: "Public Holiday in Zambia." },
  { id: "zmb_youth_day", countryCode: "ZMB", title: "Youth Day", eventType: "public_holiday", startDate: "2025-03-12", isNational: true, impactOnSessions: "closed", description: "National Youth Day." },
  { id: "zmb_good_friday", countryCode: "ZMB", title: "Good Friday", eventType: "public_holiday", startDate: "2025-04-18", isNational: true, impactOnSessions: "closed", description: "Good Friday." },
  { id: "zmb_easter_mon", countryCode: "ZMB", title: "Easter Monday", eventType: "public_holiday", startDate: "2025-04-21", isNational: true, impactOnSessions: "closed", description: "Easter Monday." },
  { id: "zmb_labour_day", countryCode: "ZMB", title: "Labour Day", eventType: "public_holiday", startDate: "2025-05-01", isNational: true, impactOnSessions: "closed", description: "Labour Day." },
  { id: "zmb_avw_2025", countryCode: "ZMB", title: "African Vaccination Week & Child Health Week (Round 1)", eventType: "campaign", startDate: "2025-04-24", endDate: "2025-04-30", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "MoH nationwide intensification with outreach posts at all health zones." },
  { id: "zmb_africa_freedom", countryCode: "ZMB", title: "Africa Freedom Day", eventType: "public_holiday", startDate: "2025-05-25", isNational: true, impactOnSessions: "closed", description: "Africa Freedom Day." },
  { id: "zmb_heroes_day", countryCode: "ZMB", title: "Heroes' Day", eventType: "public_holiday", startDate: "2025-07-07", isNational: true, impactOnSessions: "closed", description: "Heroes' Day." },
  { id: "zmb_unity_day", countryCode: "ZMB", title: "Unity Day", eventType: "public_holiday", startDate: "2025-07-08", isNational: true, impactOnSessions: "closed", description: "Unity Day." },
  { id: "zmb_farmers_day", countryCode: "ZMB", title: "Farmers' Day", eventType: "public_holiday", startDate: "2025-08-04", isNational: true, impactOnSessions: "closed", description: "Farmers' Day." },
  { id: "zmb_prayer_day", countryCode: "ZMB", title: "National Prayer Day", eventType: "public_holiday", startDate: "2025-10-18", isNational: true, impactOnSessions: "closed", description: "National Prayer Day." },
  { id: "zmb_independence", countryCode: "ZMB", title: "Independence Day", eventType: "public_holiday", startDate: "2025-10-24", isNational: true, impactOnSessions: "closed", description: "61st Independence Day." },
  { id: "zmb_child_health_2", countryCode: "ZMB", title: "Child Health Week (Round 2)", eventType: "campaign", startDate: "2025-11-17", endDate: "2025-11-22", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Integrated vitamin A, deworming, and Penta/MR/PCV catch-up." },
  { id: "zmb_xmas", countryCode: "ZMB", title: "Christmas Day", eventType: "public_holiday", startDate: "2025-12-25", isNational: true, impactOnSessions: "closed", description: "Christmas Day." },
];

/**
 * Standard public holidays and official health campaign calendar for South Sudan (SSD)
 */
export const SOUTH_SUDAN_CALENDAR_EVENTS: NationalCalendarEvent[] = [
  { id: "ssd_new_year", countryCode: "SSD", title: "New Year's Day", eventType: "public_holiday", startDate: "2025-01-01", isNational: true, impactOnSessions: "closed", description: "Public Holiday in South Sudan." },
  { id: "ssd_peace_agreement", countryCode: "SSD", title: "Comprehensive Peace Agreement Day", eventType: "public_holiday", startDate: "2025-01-09", isNational: true, impactOnSessions: "closed", description: "CPA Signing Anniversary." },
  { id: "ssd_easter", countryCode: "SSD", title: "Easter Public Holidays", eventType: "public_holiday", startDate: "2025-04-18", endDate: "2025-04-21", isNational: true, impactOnSessions: "closed", description: "Good Friday to Easter Monday." },
  { id: "ssd_avw", countryCode: "SSD", title: "African Vaccination Week & PIRI Outreach Campaign", eventType: "campaign", startDate: "2025-04-24", endDate: "2025-04-30", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Periodic Intensification of Routine Immunization across hard-to-reach payams." },
  { id: "ssd_spla_day", countryCode: "SSD", title: "SPLA Day", eventType: "public_holiday", startDate: "2025-05-16", isNational: true, impactOnSessions: "closed", description: "National Heroes and SPLA Day." },
  { id: "ssd_independence", countryCode: "SSD", title: "Independence Day", eventType: "public_holiday", startDate: "2025-07-09", isNational: true, impactOnSessions: "closed", description: "South Sudan Independence Day." },
  { id: "ssd_martyrs_day", countryCode: "SSD", title: "Martyrs' Day", eventType: "public_holiday", startDate: "2025-07-30", isNational: true, impactOnSessions: "closed", description: "Dr. John Garang Memorial." },
  { id: "ssd_polio_nid", countryCode: "SSD", title: "National Polio Immunization Days (NIDs)", eventType: "campaign", startDate: "2025-10-14", endDate: "2025-10-17", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "House-to-house bOPV campaign for all children under 5 years." },
  { id: "ssd_xmas", countryCode: "SSD", title: "Christmas Public Holiday", eventType: "public_holiday", startDate: "2025-12-24", endDate: "2025-12-26", isNational: true, impactOnSessions: "closed", description: "Christmas Holidays." },
];

/**
 * Standard public holidays and official health campaign calendar for Papua New Guinea (PNG)
 */
export const PNG_CALENDAR_EVENTS: NationalCalendarEvent[] = [
  { id: "png_new_year", countryCode: "PNG", title: "New Year's Day", eventType: "public_holiday", startDate: "2025-01-01", isNational: true, impactOnSessions: "closed", description: "New Year's Day." },
  { id: "png_somare_day", countryCode: "PNG", title: "National Somare Day", eventType: "public_holiday", startDate: "2025-02-26", isNational: true, impactOnSessions: "closed", description: "Grand Chief Sir Michael Somare Remembrance." },
  { id: "png_easter", countryCode: "PNG", title: "Easter Weekend", eventType: "public_holiday", startDate: "2025-04-18", endDate: "2025-04-21", isNational: true, impactOnSessions: "closed", description: "Good Friday to Easter Monday." },
  { id: "png_avw", countryCode: "PNG", title: "World Immunization Week & Supplementary SIA", eventType: "campaign", startDate: "2025-04-24", endDate: "2025-04-30", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "Immunization catch-up in provincial aid posts." },
  { id: "png_kings_bday", countryCode: "PNG", title: "King's Birthday", eventType: "public_holiday", startDate: "2025-06-09", isNational: true, impactOnSessions: "closed", description: "Official King's Birthday." },
  { id: "png_remembrance", countryCode: "PNG", title: "Remembrance Day", eventType: "public_holiday", startDate: "2025-07-23", isNational: true, impactOnSessions: "closed", description: "National Remembrance Day." },
  { id: "png_repentance", countryCode: "PNG", title: "National Repentance Day", eventType: "public_holiday", startDate: "2025-08-26", isNational: true, impactOnSessions: "closed", description: "National Day of Repentance." },
  { id: "png_independence", countryCode: "PNG", title: "Independence 50th Jubilee", eventType: "public_holiday", startDate: "2025-09-16", isNational: true, impactOnSessions: "closed", description: "PNG 50th Independence Day Celebration." },
  { id: "png_xmas", countryCode: "PNG", title: "Christmas & Boxing Day", eventType: "public_holiday", startDate: "2025-12-25", endDate: "2025-12-26", isNational: true, impactOnSessions: "closed", description: "Christmas Holidays." },
];

/**
 * Generic WHO AFRO Regional Public Health Events
 */
export const WHO_AFRO_CALENDAR_EVENTS: NationalCalendarEvent[] = [
  { id: "who_avw", countryCode: "WHO", title: "African Vaccination Week (AVW)", eventType: "campaign", startDate: "2025-04-24", endDate: "2025-04-30", isNational: true, impactOnSessions: "high_turnout_opportunity", description: "WHO AFRO regional campaign to promote vaccine uptake and equity." },
  { id: "who_world_health", countryCode: "WHO", title: "World Health Day", eventType: "health_event", startDate: "2025-04-07", isNational: true, impactOnSessions: "routine", description: "Global health advocacy." },
  { id: "who_malaria_day", countryCode: "WHO", title: "World Malaria Day", eventType: "health_event", startDate: "2025-04-25", isNational: true, impactOnSessions: "routine", description: "Malaria vaccination and prevention advocacy." },
  { id: "who_polio_day", countryCode: "WHO", title: "World Polio Day", eventType: "health_event", startDate: "2025-10-24", isNational: true, impactOnSessions: "routine", description: "Global Polio Eradication Initiative." },
  { id: "who_universal_health", countryCode: "WHO", title: "Universal Health Coverage Day", eventType: "health_event", startDate: "2025-12-12", isNational: true, impactOnSessions: "routine", description: "Universal health coverage advocacy." },
];

export const ALL_COUNTRY_CALENDAR_EVENTS: Record<string, NationalCalendarEvent[]> = {
  ZAF: SOUTH_AFRICA_CALENDAR_EVENTS,
  ZMB: ZAMBIA_CALENDAR_EVENTS,
  SSD: SOUTH_SUDAN_CALENDAR_EVENTS,
  PNG: PNG_CALENDAR_EVENTS,
  WHO: WHO_AFRO_CALENDAR_EVENTS,
};

export function getNationalCalendarEventsForCountry(countryCode?: string | null): NationalCalendarEvent[] {
  if (!countryCode) return SOUTH_AFRICA_CALENDAR_EVENTS;
  const upper = countryCode.toUpperCase();
  return ALL_COUNTRY_CALENDAR_EVENTS[upper] || ALL_COUNTRY_CALENDAR_EVENTS[upper.slice(0, 3)] || WHO_AFRO_CALENDAR_EVENTS;
}
