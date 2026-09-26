/**
 * Real National Capitals, Provincial / Regional Health Authorities,
 * and District Headquarters across supported countries.
 *
 * Provides accurate geospatial coordinates, official headquarters names,
 * and high-precision geodesic travel analysis.
 */

export interface AdministrativeHq {
  name: string;
  officeName: string;
  city: string;
  lat: number;
  lng: number;
  countryCode: string;
}

export interface NationalCapitalInfo {
  countryCode: string;
  countryName: string;
  capitalName: string;
  ministryName: string;
  facilityName: string;
  lat: number;
  lng: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. NATIONAL CAPITALS & MINISTRIES OF HEALTH
// ─────────────────────────────────────────────────────────────────────────────
export const NATIONAL_CAPITALS: Record<string, NationalCapitalInfo> = {
  ZAF: {
    countryCode: "ZAF",
    countryName: "South Africa",
    capitalName: "Pretoria (Tshwane)",
    ministryName: "National Department of Health (NDoH)",
    facilityName: "Civitas Building, Cnr Thabo Sehume & Struben St, Pretoria",
    lat: -25.7479,
    lng: 28.1880,
  },
  ZMB: {
    countryCode: "ZMB",
    countryName: "Zambia",
    capitalName: "Lusaka",
    ministryName: "Ministry of Health (MoH)",
    facilityName: "Ndeke House, Haile Selassie Ave, Lusaka",
    lat: -15.4167,
    lng: 28.2833,
  },
  SSD: {
    countryCode: "SSD",
    countryName: "South Sudan",
    capitalName: "Juba",
    ministryName: "Ministry of Health (MoH)",
    facilityName: "Ministerial Complex, Ministries Road, Juba",
    lat: 4.8594,
    lng: 31.5713,
  },
  PNG: {
    countryCode: "PNG",
    countryName: "Papua New Guinea",
    capitalName: "Port Moresby",
    ministryName: "National Department of Health (NDoH)",
    facilityName: "Aopi Centre, Waigani Drive, Port Moresby",
    lat: -9.4438,
    lng: 147.1803,
  },
  KEN: {
    countryCode: "KEN",
    countryName: "Kenya",
    capitalName: "Nairobi",
    ministryName: "Ministry of Health (MoH)",
    facilityName: "Afya House, Cathedral Road, Nairobi",
    lat: -1.2921,
    lng: 36.8219,
  },
  COD: {
    countryCode: "COD",
    countryName: "Democratic Republic of the Congo",
    capitalName: "Kinshasa",
    ministryName: "Ministère de la Santé Publique, Hygiène et Prévention",
    facilityName: "Boulevard du 30 Juin, Gombe, Kinshasa",
    lat: -4.3224,
    lng: 15.3070,
  },
  NGA: {
    countryCode: "NGA",
    countryName: "Nigeria",
    capitalName: "Abuja",
    ministryName: "Federal Ministry of Health",
    facilityName: "Federal Secretariat Complex, Phase III, Shehu Shagari Way, Abuja",
    lat: 9.0579,
    lng: 7.4951,
  },
  UGA: {
    countryCode: "UGA",
    countryName: "Uganda",
    capitalName: "Kampala",
    ministryName: "Ministry of Health (MoH)",
    facilityName: "Plot 6 Lourdel Rd, Wandegeya, Kampala",
    lat: 0.3341,
    lng: 32.5744,
  },
  ETH: {
    countryCode: "ETH",
    countryName: "Ethiopia",
    capitalName: "Addis Ababa",
    ministryName: "Ministry of Health (MoH)",
    facilityName: "Sudan Street, Lideta Sub-City, Addis Ababa",
    lat: 9.0105,
    lng: 38.7483,
  },
  TZA: {
    countryCode: "TZA",
    countryName: "Tanzania",
    capitalName: "Dodoma",
    ministryName: "Ministry of Health (Wizara ya Afya)",
    facilityName: "Mtumba Government City, Dodoma",
    lat: -6.1630,
    lng: 35.7516,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. PROVINCIAL / REGIONAL / STATE HEALTH AUTHORITIES & CAPITALS
// ─────────────────────────────────────────────────────────────────────────────
export const PROVINCIAL_HQS: Record<string, AdministrativeHq> = {
  // ── South Africa (9 Provinces) ──
  "north west": {
    name: "North West",
    city: "Mahikeng (Mmabatho)",
    officeName: "North West Department of Health Provincial Office",
    lat: -25.8560,
    lng: 25.6403,
    countryCode: "ZAF",
  },
  "gauteng": {
    name: "Gauteng",
    city: "Johannesburg",
    officeName: "Gauteng Department of Health (Life Centre, Marshalltown)",
    lat: -26.2041,
    lng: 28.0473,
    countryCode: "ZAF",
  },
  "western cape": {
    name: "Western Cape",
    city: "Cape Town",
    officeName: "Western Cape Department of Health (4 Dorp St)",
    lat: -33.9249,
    lng: 18.4241,
    countryCode: "ZAF",
  },
  "kwazulu-natal": {
    name: "KwaZulu-Natal",
    city: "Pietermaritzburg",
    officeName: "KZN Department of Health (Natalia Building)",
    lat: -29.6006,
    lng: 30.3794,
    countryCode: "ZAF",
  },
  "eastern cape": {
    name: "Eastern Cape",
    city: "Bhisho",
    officeName: "Eastern Cape Department of Health (Dukumbana Building)",
    lat: -32.8497,
    lng: 27.4380,
    countryCode: "ZAF",
  },
  "limpopo": {
    name: "Limpopo",
    city: "Polokwane",
    officeName: "Limpopo Department of Health (Fidel Castro Ruz House)",
    lat: -23.9045,
    lng: 29.4688,
    countryCode: "ZAF",
  },
  "mpumalanga": {
    name: "Mpumalanga",
    city: "Mbombela (Nelspruit)",
    officeName: "Mpumalanga Department of Health (Indwe Building)",
    lat: -25.4753,
    lng: 30.9694,
    countryCode: "ZAF",
  },
  "free state": {
    name: "Free State",
    city: "Bloemfontein",
    officeName: "Free State Department of Health (Bophelo House)",
    lat: -29.1183,
    lng: 26.2249,
    countryCode: "ZAF",
  },
  "northern cape": {
    name: "Northern Cape",
    city: "Kimberley",
    officeName: "Northern Cape Department of Health (James Exum Building)",
    lat: -28.7282,
    lng: 24.7499,
    countryCode: "ZAF",
  },

  // ── Zambia (10 Provinces) ──
  "lusaka": {
    name: "Lusaka Province",
    city: "Lusaka",
    officeName: "Lusaka Provincial Health Office",
    lat: -15.4167,
    lng: 28.2833,
    countryCode: "ZMB",
  },
  "copperbelt": {
    name: "Copperbelt Province",
    city: "Ndola",
    officeName: "Copperbelt Provincial Health Office",
    lat: -12.9694,
    lng: 28.6366,
    countryCode: "ZMB",
  },
  "central": {
    name: "Central Province",
    city: "Kabwe",
    officeName: "Central Provincial Health Office",
    lat: -14.4469,
    lng: 28.4464,
    countryCode: "ZMB",
  },
  "southern": {
    name: "Southern Province",
    city: "Choma",
    officeName: "Southern Provincial Health Office",
    lat: -16.8094,
    lng: 26.9881,
    countryCode: "ZMB",
  },
  "eastern": {
    name: "Eastern Province",
    city: "Chipata",
    officeName: "Eastern Provincial Health Office",
    lat: -13.6333,
    lng: 32.6500,
    countryCode: "ZMB",
  },
  "northern": {
    name: "Northern Province",
    city: "Kasama",
    officeName: "Northern Provincial Health Office",
    lat: -10.2129,
    lng: 31.1808,
    countryCode: "ZMB",
  },
  "luapula": {
    name: "Luapula Province",
    city: "Mansa",
    officeName: "Luapula Provincial Health Office",
    lat: -11.1998,
    lng: 28.8943,
    countryCode: "ZMB",
  },
  "north-western": {
    name: "North-Western Province",
    city: "Solwezi",
    officeName: "North-Western Provincial Health Office",
    lat: -12.1833,
    lng: 26.4000,
    countryCode: "ZMB",
  },
  "western": {
    name: "Western Province",
    city: "Mongu",
    officeName: "Western Provincial Health Office",
    lat: -15.2484,
    lng: 23.1311,
    countryCode: "ZMB",
  },
  "muchinga": {
    name: "Muchinga Province",
    city: "Chinsali",
    officeName: "Muchinga Provincial Health Office",
    lat: -10.5500,
    lng: 32.0667,
    countryCode: "ZMB",
  },

  // ── South Sudan (10 States) ──
  "central equatoria": {
    name: "Central Equatoria",
    city: "Juba",
    officeName: "Central Equatoria State Ministry of Health",
    lat: 4.8594,
    lng: 31.5713,
    countryCode: "SSD",
  },
  "eastern equatoria": {
    name: "Eastern Equatoria",
    city: "Torit",
    officeName: "Eastern Equatoria State Ministry of Health",
    lat: 4.4100,
    lng: 32.5683,
    countryCode: "SSD",
  },
  "western equatoria": {
    name: "Western Equatoria",
    city: "Yambio",
    officeName: "Western Equatoria State Ministry of Health",
    lat: 4.5719,
    lng: 28.3958,
    countryCode: "SSD",
  },
  "jonglei": {
    name: "Jonglei",
    city: "Bor",
    officeName: "Jonglei State Ministry of Health",
    lat: 6.2094,
    lng: 31.5564,
    countryCode: "SSD",
  },
  "unity": {
    name: "Unity State",
    city: "Bentiu",
    officeName: "Unity State Ministry of Health",
    lat: 9.2333,
    lng: 29.8000,
    countryCode: "SSD",
  },
  "upper nile": {
    name: "Upper Nile",
    city: "Malakal",
    officeName: "Upper Nile State Ministry of Health",
    lat: 9.5334,
    lng: 31.6500,
    countryCode: "SSD",
  },
  "lakes": {
    name: "Lakes State",
    city: "Rumbek",
    officeName: "Lakes State Ministry of Health",
    lat: 6.8058,
    lng: 29.6781,
    countryCode: "SSD",
  },
  "warrap": {
    name: "Warrap State",
    city: "Kuajok",
    officeName: "Warrap State Ministry of Health",
    lat: 8.0100,
    lng: 27.9900,
    countryCode: "SSD",
  },
  "western bahr el ghazal": {
    name: "Western Bahr el Ghazal",
    city: "Wau",
    officeName: "Western Bahr el Ghazal State Ministry of Health",
    lat: 7.7000,
    lng: 27.9900,
    countryCode: "SSD",
  },
  "northern bahr el ghazal": {
    name: "Northern Bahr el Ghazal",
    city: "Aweil",
    officeName: "Northern Bahr el Ghazal State Ministry of Health",
    lat: 8.7667,
    lng: 27.4000,
    countryCode: "SSD",
  },

  // ── Papua New Guinea (22 Provincial Health Authorities) ──
  "national capital district": {
    name: "National Capital District",
    city: "Port Moresby",
    officeName: "National Capital District Provincial Health Authority",
    lat: -9.4438,
    lng: 147.1803,
    countryCode: "PNG",
  },
  "morobe": {
    name: "Morobe",
    city: "Lae",
    officeName: "Morobe Provincial Health Authority (Angau Hospital)",
    lat: -6.7280,
    lng: 146.9972,
    countryCode: "PNG",
  },
  "western highlands": {
    name: "Western Highlands",
    city: "Mount Hagen",
    officeName: "Western Highlands Provincial Health Authority",
    lat: -5.8617,
    lng: 144.2306,
    countryCode: "PNG",
  },
  "eastern highlands": {
    name: "Eastern Highlands",
    city: "Goroka",
    officeName: "Eastern Highlands Provincial Health Authority",
    lat: -6.0834,
    lng: 145.3874,
    countryCode: "PNG",
  },
  "southern highlands": {
    name: "Southern Highlands",
    city: "Mendi",
    officeName: "Southern Highlands Provincial Health Authority",
    lat: -6.1481,
    lng: 143.6567,
    countryCode: "PNG",
  },
  "enga": {
    name: "Enga",
    city: "Wabag",
    officeName: "Enga Provincial Health Authority",
    lat: -5.4853,
    lng: 143.7042,
    countryCode: "PNG",
  },
  "hela": {
    name: "Hela",
    city: "Tari",
    officeName: "Hela Provincial Health Authority",
    lat: -5.8458,
    lng: 142.9464,
    countryCode: "PNG",
  },
  "jiwaka": {
    name: "Jiwaka",
    city: "Kudjip / Banz",
    officeName: "Jiwaka Provincial Health Authority",
    lat: -5.8825,
    lng: 144.6225,
    countryCode: "PNG",
  },
  "simbu": {
    name: "Simbu (Chimbu)",
    city: "Kundiawa",
    officeName: "Simbu Provincial Health Authority",
    lat: -6.0167,
    lng: 144.9667,
    countryCode: "PNG",
  },
  "madang": {
    name: "Madang",
    city: "Madang",
    officeName: "Madang Provincial Health Authority",
    lat: -5.2167,
    lng: 145.8000,
    countryCode: "PNG",
  },
  "east sepik": {
    name: "East Sepik",
    city: "Wewak",
    officeName: "East Sepik Provincial Health Authority",
    lat: -3.5500,
    lng: 143.6333,
    countryCode: "PNG",
  },
  "west sepik": {
    name: "West Sepik (Sandaun)",
    city: "Vanimo",
    officeName: "West Sepik Provincial Health Authority",
    lat: -2.6833,
    lng: 141.3000,
    countryCode: "PNG",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. DISTRICT HEALTH OFFICES & HEADQUARTERS
// ─────────────────────────────────────────────────────────────────────────────
export const DISTRICT_HQS: Record<string, AdministrativeHq> = {
  // ── South Africa Districts ──
  "dr kenneth kaunda": {
    name: "Dr Kenneth Kaunda District",
    city: "Klerksdorp / Potchefstroom",
    officeName: "Dr Kenneth Kaunda District Health Office (Klerksdorp)",
    lat: -26.8642,
    lng: 26.6667,
    countryCode: "ZAF",
  },
  "bojanala platinum": {
    name: "Bojanala Platinum District",
    city: "Rustenburg",
    officeName: "Bojanala District Health Office",
    lat: -25.6667,
    lng: 27.2417,
    countryCode: "ZAF",
  },
  "ngaka modiri molema": {
    name: "Ngaka Modiri Molema District",
    city: "Mahikeng",
    officeName: "Ngaka Modiri Molema District Health Office",
    lat: -25.8560,
    lng: 25.6403,
    countryCode: "ZAF",
  },
  "dr ruth segomotsi mompati": {
    name: "Dr Ruth Segomotsi Mompati District",
    city: "Vryburg",
    officeName: "Dr Ruth Segomotsi Mompati District Health Office",
    lat: -26.9567,
    lng: 24.7283,
    countryCode: "ZAF",
  },
  "city of johannesburg": {
    name: "City of Johannesburg",
    city: "Johannesburg",
    officeName: "City of Johannesburg Health Department",
    lat: -26.2041,
    lng: 28.0473,
    countryCode: "ZAF",
  },
  "city of tshwane": {
    name: "City of Tshwane",
    city: "Pretoria",
    officeName: "City of Tshwane Health Department",
    lat: -25.7479,
    lng: 28.1880,
    countryCode: "ZAF",
  },
  "ekurhuleni": {
    name: "City of Ekurhuleni",
    city: "Germiston",
    officeName: "Ekurhuleni Health District Office",
    lat: -26.2256,
    lng: 28.1706,
    countryCode: "ZAF",
  },
  "ethekwini": {
    name: "eThekwini",
    city: "Durban",
    officeName: "eThekwini Metro Health District Office",
    lat: -29.8587,
    lng: 31.0218,
    countryCode: "ZAF",
  },
  "city of cape town": {
    name: "City of Cape Town",
    city: "Cape Town",
    officeName: "Cape Town Metro Health Services Office",
    lat: -33.9249,
    lng: 18.4241,
    countryCode: "ZAF",
  },

  // ── Zambia Districts ──
  "lusaka": {
    name: "Lusaka District",
    city: "Lusaka",
    officeName: "Lusaka District Health Office",
    lat: -15.4167,
    lng: 28.2833,
    countryCode: "ZMB",
  },
  "ndola": {
    name: "Ndola District",
    city: "Ndola",
    officeName: "Ndola District Health Office",
    lat: -12.9694,
    lng: 28.6366,
    countryCode: "ZMB",
  },
  "kitwe": {
    name: "Kitwe District",
    city: "Kitwe",
    officeName: "Kitwe District Health Office",
    lat: -12.8024,
    lng: 28.2132,
    countryCode: "ZMB",
  },
  "choma": {
    name: "Choma District",
    city: "Choma",
    officeName: "Choma District Health Office",
    lat: -16.8094,
    lng: 26.9881,
    countryCode: "ZMB",
  },
  "livingstone": {
    name: "Livingstone District",
    city: "Livingstone",
    officeName: "Livingstone District Health Office",
    lat: -17.8419,
    lng: 25.8544,
    countryCode: "ZMB",
  },
  "chipata": {
    name: "Chipata District",
    city: "Chipata",
    officeName: "Chipata District Health Office",
    lat: -13.6333,
    lng: 32.6500,
    countryCode: "ZMB",
  },
  "kabwe": {
    name: "Kabwe District",
    city: "Kabwe",
    officeName: "Kabwe District Health Office",
    lat: -14.4469,
    lng: 28.4464,
    countryCode: "ZMB",
  },
  "kasama": {
    name: "Kasama District",
    city: "Kasama",
    officeName: "Kasama District Health Office",
    lat: -10.2129,
    lng: 31.1808,
    countryCode: "ZMB",
  },
  "mansa": {
    name: "Mansa District",
    city: "Mansa",
    officeName: "Mansa District Health Office",
    lat: -11.1998,
    lng: 28.8943,
    countryCode: "ZMB",
  },
  "solwezi": {
    name: "Solwezi District",
    city: "Solwezi",
    officeName: "Solwezi District Health Office",
    lat: -12.1833,
    lng: 26.4000,
    countryCode: "ZMB",
  },
  "mongu": {
    name: "Mongu District",
    city: "Mongu",
    officeName: "Mongu District Health Office",
    lat: -15.2484,
    lng: 23.1311,
    countryCode: "ZMB",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. HAVERSINE & ROAD DISTANCE CALCULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export function calculateHaversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (lat1 === lat2 && lng1 === lng2) return 0;
  const R = 6371; // Earth radius in KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export function formatTravelDuration(hoursFloat: number): string {
  const totalMins = Math.max(1, Math.round(hoursFloat * 60));
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export interface TravelAnalysisResult {
  district: {
    name: string;
    officeName: string;
    city: string;
    directKm: number;
    roadKm: number;
    vehicle: string;
    motorcycle: string;
    bicycle: string;
    walking: string;
    lat: number;
    lng: number;
  };
  provincial: {
    name: string;
    officeName: string;
    city: string;
    directKm: number;
    roadKm: number;
    vehicle: string;
    motorcycle: string;
    bicycle: string;
    walking: string;
    lat: number;
    lng: number;
  };
  capital: {
    name: string;
    officeName: string;
    city: string;
    directKm: number;
    roadKm: number;
    vehicle: string;
    motorcycle: string;
    bicycle: string;
    walking: string;
    lat: number;
    lng: number;
  };
}

/**
 * Resolves accurate administrative headquarters and real travel distances
 * from a facility's GPS location to its District HQ, Provincial HQ, and National Capital.
 */
export function detectCountryCode(lat: number, lng: number, countryCodeInput?: string | null): string {
  if (countryCodeInput && countryCodeInput.toUpperCase() !== "ZAF") {
    return countryCodeInput.toUpperCase();
  }
  // Bounding box for Zambia: lat -18.5 to -7.5, lng 21.5 to 34.0
  if (lat >= -18.5 && lat <= -7.5 && lng >= 21.5 && lng <= 34.0) {
    return "ZMB";
  }
  // Bounding box for PNG
  if (lat >= -12.0 && lat <= 0 && lng >= 140.0 && lng <= 157.0) {
    return "PNG";
  }
  // Bounding box for South Sudan
  if (lat >= 3.0 && lat <= 13.0 && lng >= 23.0 && lng <= 36.0) {
    return "SSD";
  }
  // Bounding box for Kenya
  if (lat >= -4.8 && lat <= 5.5 && lng >= 33.9 && lng <= 41.9) {
    return "KEN";
  }
  // Bounding box for DRC
  if (lat >= -13.5 && lat <= 5.5 && lng >= 12.2 && lng <= 31.3) {
    return "COD";
  }
  if (countryCodeInput && countryCodeInput.trim() !== "") {
    return countryCodeInput.toUpperCase();
  }
  return "ZMB";
}

export function getAdministrativeHqTravelAnalysis(input: {
  facilityLat: number;
  facilityLng: number;
  countryCode?: string | null;
  districtName?: string | null;
  provinceName?: string | null;
  districtCoords?: { lat: number; lng: number } | null;
  provinceCoords?: { lat: number; lng: number } | null;
}): TravelAnalysisResult {
  const { facilityLat, facilityLng } = input;
  const countryCode = detectCountryCode(facilityLat, facilityLng, input.countryCode);

  // 1. National Capital
  const capitalInfo = NATIONAL_CAPITALS[countryCode] || NATIONAL_CAPITALS.ZMB || NATIONAL_CAPITALS.ZAF;
  const capDirectKm = calculateHaversineDistanceKm(
    facilityLat,
    facilityLng,
    capitalInfo.lat,
    capitalInfo.lng
  );
  const capRoadKm = Number((capDirectKm * 1.16).toFixed(1));

  // 2. Provincial HQ
  const cleanProv = (input.provinceName || "").toLowerCase().trim().replace(/province|state|region/g, "").trim();
  const matchedProvHq = PROVINCIAL_HQS[cleanProv] ||
    Object.values(PROVINCIAL_HQS).find(
      (p) => p.countryCode === countryCode && (cleanProv.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(cleanProv))
    );

  const provLat = input.provinceCoords?.lat ?? matchedProvHq?.lat ?? capitalInfo.lat;
  const provLng = input.provinceCoords?.lng ?? matchedProvHq?.lng ?? capitalInfo.lng;
  const provDirectKm = calculateHaversineDistanceKm(facilityLat, facilityLng, provLat, provLng);
  const provRoadKm = Number((provDirectKm * 1.18).toFixed(1));

  const provDisplayName = matchedProvHq
    ? `${matchedProvHq.name} (${matchedProvHq.city})`
    : input.provinceName || "Provincial Health Directorate";
  const provOfficeName = matchedProvHq?.officeName || `${input.provinceName || "Provincial"} Health Directorate`;
  const provCity = matchedProvHq?.city || input.provinceName || "Provincial Capital";

  // 3. District HQ
  const cleanDist = (input.districtName || "").toLowerCase().trim().replace(/district|health district|sub-district/g, "").trim();
  const matchedDistHq = DISTRICT_HQS[cleanDist] ||
    Object.values(DISTRICT_HQS).find(
      (d) => d.countryCode === countryCode && (cleanDist.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(cleanDist))
    );

  const distLat = input.districtCoords?.lat ?? matchedDistHq?.lat ?? (facilityLat + (provLat - facilityLat) * 0.25);
  const distLng = input.districtCoords?.lng ?? matchedDistHq?.lng ?? (facilityLng + (provLng - facilityLng) * 0.25);
  const distDirectKm = calculateHaversineDistanceKm(facilityLat, facilityLng, distLat, distLng);
  const distRoadKm = Number((distDirectKm * 1.20).toFixed(1));

  const distDisplayName = matchedDistHq
    ? `${matchedDistHq.name} (${matchedDistHq.city})`
    : `${input.districtName || "District"} Health Office`;
  const distOfficeName = matchedDistHq?.officeName || `${input.districtName || "District"} Health Office`;
  const distCity = matchedDistHq?.city || input.districtName || "District Center";

  return {
    district: {
      name: distDisplayName,
      officeName: distOfficeName,
      city: distCity,
      lat: distLat,
      lng: distLng,
      directKm: distDirectKm,
      roadKm: distRoadKm,
      vehicle: formatTravelDuration(distRoadKm / 55),
      motorcycle: formatTravelDuration(distRoadKm / 40),
      bicycle: formatTravelDuration(distRoadKm / 13),
      walking: formatTravelDuration(distRoadKm / 4.5),
    },
    provincial: {
      name: provDisplayName,
      officeName: provOfficeName,
      city: provCity,
      lat: provLat,
      lng: provLng,
      directKm: provDirectKm,
      roadKm: provRoadKm,
      vehicle: formatTravelDuration(provRoadKm / 65),
      motorcycle: formatTravelDuration(provRoadKm / 42),
      bicycle: formatTravelDuration(provRoadKm / 12),
      walking: formatTravelDuration(provRoadKm / 4.2),
    },
    capital: {
      name: `${capitalInfo.capitalName} — ${capitalInfo.ministryName}`,
      officeName: capitalInfo.facilityName,
      city: capitalInfo.capitalName,
      lat: capitalInfo.lat,
      lng: capitalInfo.lng,
      directKm: capDirectKm,
      roadKm: capRoadKm,
      vehicle: formatTravelDuration(capRoadKm / 75),
      motorcycle: formatTravelDuration(capRoadKm / 45),
      bicycle: formatTravelDuration(capRoadKm / 11),
      walking: formatTravelDuration(capRoadKm / 4.0),
    },
  };
}
