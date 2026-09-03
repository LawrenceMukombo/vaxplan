/**
 * Standard National ID and Phone formats by country.
 * Used across client and server for dynamic localization, validation, and placeholders.
 */

export interface CountryFormatSpec {
  countryCode: string;
  countryName: string;
  idLabel: string;
  idShortLabel: string;
  idPlaceholder: string;
  idPatternHelp: string;
  phonePrefix: string;
  phonePlaceholder: string;
  phonePatternHelp: string;
  validateId: (id: string) => { valid: boolean; message?: string; normalized?: string };
  validatePhone: (phone: string) => { valid: boolean; message?: string; normalized?: string };
  normalizeId: (id: string) => string;
  normalizePhone: (phone: string) => string;
}

const clean = (val: string) => (val || "").trim();
const stripSpaces = (val: string) => (val || "").replace(/[\s\-_()]/g, "");

export const COUNTRY_FORMATS: Record<string, CountryFormatSpec> = {
  // ───── South Africa ─────
  ZAF: {
    countryCode: "ZAF",
    countryName: "South Africa",
    idLabel: "South African ID Number",
    idShortLabel: "ID Number",
    idPlaceholder: "9001015009087",
    idPatternHelp: "13 numeric digits (YYMMDDSSSSCAZ)",
    phonePrefix: "+27",
    phonePlaceholder: "+27 82 123 4567",
    phonePatternHelp: "+27 followed by 9 digits (or local 0XX XXX XXXX)",
    normalizeId: (id: string) => clean(id).replace(/[\s\-_]/g, ""),
    normalizePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (p.startsWith("+27")) return p;
      if (p.startsWith("27") && p.length === 11) return `+${p}`;
      if (p.startsWith("0") && p.length === 10) return `+27${p.slice(1)}`;
      return p.startsWith("+") ? p : `+27${p}`;
    },
    validateId: (id: string) => {
      const c = clean(id).replace(/[\s\-_]/g, "");
      if (!c) return { valid: false, message: "South African ID number is required" };
      if (!/^\d{13}$/.test(c)) {
        return {
          valid: false,
          message: "Invalid South African ID format. Must be exactly 13 numeric digits (e.g. 9001015009087)."
        };
      }
      return { valid: true, normalized: c };
    },
    validatePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (!p) return { valid: true, normalized: "" };
      // +27 followed by 9 digits, or 0 followed by 9 digits
      if (!/^(\+27|27|0)[1-9]\d{8}$/.test(p) && !/^\+?\d{9,15}$/.test(p)) {
        return {
          valid: false,
          message: "Invalid South African phone number. Must be +27 followed by 9 digits or local 10 digits (e.g. +27 82 123 4567 or 082 123 4567)."
        };
      }
      return { valid: true, normalized: COUNTRY_FORMATS.ZAF.normalizePhone(phone) };
    }
  },

  // ───── Zambia ─────
  ZMB: {
    countryCode: "ZMB",
    countryName: "Zambia",
    idLabel: "National Registration Card (NRC)",
    idShortLabel: "NRC",
    idPlaceholder: "123456/78/9",
    idPatternHelp: "XXXXXX/XX/X (6 digits / 2 digits / 1 digit)",
    phonePrefix: "+260",
    phonePlaceholder: "+260 97 123 4567",
    phonePatternHelp: "+260 followed by 9 digits (or local 09X / 07X)",
    normalizeId: (id: string) => {
      const c = clean(id);
      // If entered as 9 digits without slashes, format as XXXXXX/XX/X
      const numOnly = c.replace(/\D/g, "");
      if (numOnly.length === 9 && !c.includes("/")) {
        return `${numOnly.slice(0, 6)}/${numOnly.slice(6, 8)}/${numOnly.slice(8)}`;
      }
      return c;
    },
    normalizePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (p.startsWith("+260")) return p;
      if (p.startsWith("260") && p.length === 12) return `+${p}`;
      if (p.startsWith("0") && p.length === 10) return `+260${p.slice(1)}`;
      return p.startsWith("+") ? p : `+260${p}`;
    },
    validateId: (id: string) => {
      const c = clean(id);
      if (!c) return { valid: false, message: "NRC is required" };
      const numOnly = c.replace(/\D/g, "");
      if (!/^\d{6}\/\d{2}\/\d{1}$/.test(c) && numOnly.length !== 9) {
        return {
          valid: false,
          message: "Invalid NRC format. Must be XXXXXX/XX/X (e.g. 123456/78/9)."
        };
      }
      return { valid: true, normalized: COUNTRY_FORMATS.ZMB.normalizeId(id) };
    },
    validatePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (!p) return { valid: true, normalized: "" };
      if (!/^(\+260|260|0)[79]\d{8}$/.test(p) && !/^\+?\d{9,15}$/.test(p)) {
        return {
          valid: false,
          message: "Invalid Zambian phone number. Must be +260 followed by 9 digits or local 10 digits (e.g. +260 97 123 4567 or 0977123456)."
        };
      }
      return { valid: true, normalized: COUNTRY_FORMATS.ZMB.normalizePhone(phone) };
    }
  },

  // ───── Kenya ─────
  KEN: {
    countryCode: "KEN",
    countryName: "Kenya",
    idLabel: "National ID Number",
    idShortLabel: "National ID",
    idPlaceholder: "12345678",
    idPatternHelp: "7 or 8 numeric digits",
    phonePrefix: "+254",
    phonePlaceholder: "+254 712 345678",
    phonePatternHelp: "+254 followed by 9 digits (or local 07XX / 01XX)",
    normalizeId: (id: string) => clean(id).replace(/[\s\-_]/g, ""),
    normalizePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (p.startsWith("+254")) return p;
      if (p.startsWith("254") && p.length === 12) return `+${p}`;
      if (p.startsWith("0") && p.length === 10) return `+254${p.slice(1)}`;
      return p.startsWith("+") ? p : `+254${p}`;
    },
    validateId: (id: string) => {
      const c = clean(id).replace(/[\s\-_]/g, "");
      if (!c) return { valid: false, message: "National ID is required" };
      if (!/^\d{7,8}$/.test(c)) {
        return {
          valid: false,
          message: "Invalid Kenyan National ID. Must be 7 or 8 numeric digits (e.g. 12345678)."
        };
      }
      return { valid: true, normalized: c };
    },
    validatePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (!p) return { valid: true, normalized: "" };
      if (!/^(\+254|254|0)[17]\d{8}$/.test(p) && !/^\+?\d{9,15}$/.test(p)) {
        return {
          valid: false,
          message: "Invalid Kenyan phone number (e.g. +254 712 345678 or 0712345678)."
        };
      }
      return { valid: true, normalized: COUNTRY_FORMATS.KEN.normalizePhone(phone) };
    }
  },

  // ───── Vietnam ─────
  VNM: {
    countryCode: "VNM",
    countryName: "Vietnam",
    idLabel: "Citizen Identity Card (CCCD / CMND)",
    idShortLabel: "CCCD / CMND",
    idPlaceholder: "001099001234",
    idPatternHelp: "12 digits (CCCD) or 9 digits (CMND)",
    phonePrefix: "+84",
    phonePlaceholder: "+84 91 234 5678",
    phonePatternHelp: "+84 followed by 9 digits (or local 09X / 03X)",
    normalizeId: (id: string) => clean(id).replace(/[\s\-_]/g, ""),
    normalizePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (p.startsWith("+84")) return p;
      if (p.startsWith("84") && p.length >= 11) return `+${p}`;
      if (p.startsWith("0") && p.length === 10) return `+84${p.slice(1)}`;
      return p.startsWith("+") ? p : `+84${p}`;
    },
    validateId: (id: string) => {
      const c = clean(id).replace(/[\s\-_]/g, "");
      if (!c) return { valid: false, message: "CCCD / CMND is required" };
      if (!/^(\d{12}|\d{9})$/.test(c)) {
        return {
          valid: false,
          message: "Invalid Vietnamese CCCD/CMND. Must be 12 digits (CCCD) or 9 digits (CMND) (e.g. 001099001234)."
        };
      }
      return { valid: true, normalized: c };
    },
    validatePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (!p) return { valid: true, normalized: "" };
      if (!/^(\+84|84|0)[35789]\d{8}$/.test(p) && !/^\+?\d{9,15}$/.test(p)) {
        return {
          valid: false,
          message: "Invalid Vietnamese phone number (e.g. +84 91 234 5678 or 0912345678)."
        };
      }
      return { valid: true, normalized: COUNTRY_FORMATS.VNM.normalizePhone(phone) };
    }
  },

  // ───── Papua New Guinea ─────
  PNG: {
    countryCode: "PNG",
    countryName: "Papua New Guinea",
    idLabel: "National Identity (NID) Number",
    idShortLabel: "NID",
    idPlaceholder: "1001234567",
    idPatternHelp: "8 to 12 alphanumeric characters",
    phonePrefix: "+675",
    phonePlaceholder: "+675 7123 4567",
    phonePatternHelp: "+675 followed by 8 digits (or local 7XXX XXXX)",
    normalizeId: (id: string) => clean(id).toUpperCase().replace(/[\s\-_]/g, ""),
    normalizePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (p.startsWith("+675")) return p;
      if (p.startsWith("675") && p.length === 11) return `+${p}`;
      return p.startsWith("+") ? p : `+675${p}`;
    },
    validateId: (id: string) => {
      const c = clean(id).replace(/[\s\-_]/g, "");
      if (!c) return { valid: false, message: "NID number is required" };
      if (!/^[A-Za-z0-9]{6,14}$/.test(c)) {
        return {
          valid: false,
          message: "Invalid Papua New Guinea NID number (e.g. 1001234567)."
        };
      }
      return { valid: true, normalized: c.toUpperCase() };
    },
    validatePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (!p) return { valid: true, normalized: "" };
      if (!/^(\+675|675)?[78]\d{7}$/.test(p) && !/^\+?\d{8,15}$/.test(p)) {
        return {
          valid: false,
          message: "Invalid Papua New Guinea phone number (e.g. +675 7123 4567)."
        };
      }
      return { valid: true, normalized: COUNTRY_FORMATS.PNG.normalizePhone(phone) };
    }
  },

  // ───── South Sudan ─────
  SSD: {
    countryCode: "SSD",
    countryName: "South Sudan",
    idLabel: "National ID Number",
    idShortLabel: "National ID",
    idPlaceholder: "SSD1234567",
    idPatternHelp: "6 to 15 alphanumeric characters",
    phonePrefix: "+211",
    phonePlaceholder: "+211 92 123 4567",
    phonePatternHelp: "+211 followed by 9 digits (or local 09X XXX XXX)",
    normalizeId: (id: string) => clean(id).toUpperCase().replace(/[\s]/g, ""),
    normalizePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (p.startsWith("+211")) return p;
      if (p.startsWith("211") && p.length === 12) return `+${p}`;
      if (p.startsWith("0") && p.length === 10) return `+211${p.slice(1)}`;
      return p.startsWith("+") ? p : `+211${p}`;
    },
    validateId: (id: string) => {
      const c = clean(id).replace(/[\s]/g, "");
      if (!c) return { valid: false, message: "National ID is required" };
      if (!/^[A-Za-z0-9\/-]{5,15}$/.test(c)) {
        return {
          valid: false,
          message: "Invalid South Sudan National ID (e.g. SSD1234567)."
        };
      }
      return { valid: true, normalized: c.toUpperCase() };
    },
    validatePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (!p) return { valid: true, normalized: "" };
      if (!/^(\+211|211|0)9\d{8}$/.test(p) && !/^\+?\d{9,15}$/.test(p)) {
        return {
          valid: false,
          message: "Invalid South Sudan phone number (e.g. +211 92 123 4567 or 0921234567)."
        };
      }
      return { valid: true, normalized: COUNTRY_FORMATS.SSD.normalizePhone(phone) };
    }
  },

  // ───── Botswana ─────
  BWA: {
    countryCode: "BWA",
    countryName: "Botswana",
    idLabel: "Omang (National ID) Number",
    idShortLabel: "Omang ID",
    idPlaceholder: "123412345",
    idPatternHelp: "9 numeric digits",
    phonePrefix: "+267",
    phonePlaceholder: "+267 71 234 567",
    phonePatternHelp: "+267 followed by 7 or 8 digits",
    normalizeId: (id: string) => clean(id).replace(/[\s\-_]/g, ""),
    normalizePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (p.startsWith("+267")) return p;
      if (p.startsWith("267")) return `+${p}`;
      return p.startsWith("+") ? p : `+267${p}`;
    },
    validateId: (id: string) => {
      const c = clean(id).replace(/[\s\-_]/g, "");
      if (!c) return { valid: false, message: "Omang ID is required" };
      if (!/^\d{9}$/.test(c)) {
        return {
          valid: false,
          message: "Invalid Botswana Omang ID. Must be exactly 9 numeric digits (e.g. 123412345)."
        };
      }
      return { valid: true, normalized: c };
    },
    validatePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (!p) return { valid: true, normalized: "" };
      if (!/^(\+267|267)?[7]\d{7}$/.test(p) && !/^\+?\d{8,15}$/.test(p)) {
        return {
          valid: false,
          message: "Invalid Botswana phone number (e.g. +267 71 234 567)."
        };
      }
      return { valid: true, normalized: COUNTRY_FORMATS.BWA.normalizePhone(phone) };
    }
  },

  // ───── Nigeria ─────
  NGA: {
    countryCode: "NGA",
    countryName: "Nigeria",
    idLabel: "National Identification Number (NIN)",
    idShortLabel: "NIN",
    idPlaceholder: "12345678901",
    idPatternHelp: "11 numeric digits",
    phonePrefix: "+234",
    phonePlaceholder: "+234 803 123 4567",
    phonePatternHelp: "+234 followed by 10 digits (or local 080X / 070X)",
    normalizeId: (id: string) => clean(id).replace(/[\s\-_]/g, ""),
    normalizePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (p.startsWith("+234")) return p;
      if (p.startsWith("234") && p.length === 13) return `+${p}`;
      if (p.startsWith("0") && p.length === 11) return `+234${p.slice(1)}`;
      return p.startsWith("+") ? p : `+234${p}`;
    },
    validateId: (id: string) => {
      const c = clean(id).replace(/[\s\-_]/g, "");
      if (!c) return { valid: false, message: "NIN is required" };
      if (!/^\d{11}$/.test(c)) {
        return {
          valid: false,
          message: "Invalid Nigeria NIN. Must be exactly 11 numeric digits (e.g. 12345678901)."
        };
      }
      return { valid: true, normalized: c };
    },
    validatePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (!p) return { valid: true, normalized: "" };
      if (!/^(\+234|234|0)[789]\d{9}$/.test(p) && !/^\+?\d{10,15}$/.test(p)) {
        return {
          valid: false,
          message: "Invalid Nigeria phone number (e.g. +234 803 123 4567 or 08031234567)."
        };
      }
      return { valid: true, normalized: COUNTRY_FORMATS.NGA.normalizePhone(phone) };
    }
  },

  // ───── Malawi ─────
  MWI: {
    countryCode: "MWI",
    countryName: "Malawi",
    idLabel: "National ID Number",
    idShortLabel: "National ID",
    idPlaceholder: "MW12345678",
    idPatternHelp: "8 to 12 alphanumeric characters",
    phonePrefix: "+265",
    phonePlaceholder: "+265 99 123 4567",
    phonePatternHelp: "+265 followed by 9 digits (or local 099 / 088)",
    normalizeId: (id: string) => clean(id).toUpperCase().replace(/[\s\-_]/g, ""),
    normalizePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (p.startsWith("+265")) return p;
      if (p.startsWith("265") && p.length === 12) return `+${p}`;
      if (p.startsWith("0") && p.length === 10) return `+265${p.slice(1)}`;
      return p.startsWith("+") ? p : `+265${p}`;
    },
    validateId: (id: string) => {
      const c = clean(id).replace(/[\s\-_]/g, "");
      if (!c) return { valid: false, message: "National ID is required" };
      if (!/^[A-Za-z0-9]{6,14}$/.test(c)) {
        return {
          valid: false,
          message: "Invalid Malawi National ID (e.g. MW12345678)."
        };
      }
      return { valid: true, normalized: c.toUpperCase() };
    },
    validatePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (!p) return { valid: true, normalized: "" };
      if (!/^(\+265|265|0)[89]\d{8}$/.test(p) && !/^\+?\d{9,15}$/.test(p)) {
        return {
          valid: false,
          message: "Invalid Malawi phone number (e.g. +265 99 123 4567 or 0991234567)."
        };
      }
      return { valid: true, normalized: COUNTRY_FORMATS.MWI.normalizePhone(phone) };
    }
  },

  // ───── Uganda ─────
  UGA: {
    countryCode: "UGA",
    countryName: "Uganda",
    idLabel: "National Identification Number (NIN)",
    idShortLabel: "NIN",
    idPlaceholder: "CM9001015009087",
    idPatternHelp: "14 alphanumeric characters",
    phonePrefix: "+256",
    phonePlaceholder: "+256 77 123 4567",
    phonePatternHelp: "+256 followed by 9 digits (or local 07X)",
    normalizeId: (id: string) => clean(id).toUpperCase().replace(/[\s\-_]/g, ""),
    normalizePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (p.startsWith("+256")) return p;
      if (p.startsWith("256") && p.length === 12) return `+${p}`;
      if (p.startsWith("0") && p.length === 10) return `+256${p.slice(1)}`;
      return p.startsWith("+") ? p : `+256${p}`;
    },
    validateId: (id: string) => {
      const c = clean(id).replace(/[\s\-_]/g, "");
      if (!c) return { valid: false, message: "Uganda NIN is required" };
      if (!/^[A-Za-z0-9]{10,16}$/.test(c)) {
        return {
          valid: false,
          message: "Invalid Uganda NIN format (e.g. CM9001015009087)."
        };
      }
      return { valid: true, normalized: c.toUpperCase() };
    },
    validatePhone: (phone: string) => {
      const p = stripSpaces(phone);
      if (!p) return { valid: true, normalized: "" };
      if (!/^(\+256|256|0)[7]\d{8}$/.test(p) && !/^\+?\d{9,15}$/.test(p)) {
        return {
          valid: false,
          message: "Invalid Uganda phone number (e.g. +256 77 123 4567 or 0771234567)."
        };
      }
      return { valid: true, normalized: COUNTRY_FORMATS.UGA.normalizePhone(phone) };
    }
  },
};

export const DEFAULT_GLOBAL_FORMAT: CountryFormatSpec = {
  countryCode: "GLOBAL",
  countryName: "Global",
  idLabel: "National ID Number",
  idShortLabel: "National ID",
  idPlaceholder: "ID12345678",
  idPatternHelp: "Valid national identification number (5-20 characters)",
  phonePrefix: "+1",
  phonePlaceholder: "+1 555 123 4567",
  phonePatternHelp: "International E.164 phone format (e.g. +...)",
  normalizeId: (id: string) => clean(id).replace(/[\s]/g, ""),
  normalizePhone: (phone: string) => stripSpaces(phone),
  validateId: (id: string) => {
    const c = clean(id).replace(/[\s]/g, "");
    if (!c) return { valid: false, message: "National ID number is required" };
    if (!/^[A-Za-z0-9\/\-_]{4,25}$/.test(c)) {
      return {
        valid: false,
        message: "Invalid National ID format. Must be 4 to 25 alphanumeric characters."
      };
    }
    return { valid: true, normalized: c };
  },
  validatePhone: (phone: string) => {
    const p = stripSpaces(phone);
    if (!p) return { valid: true, normalized: "" };
    if (!/^\+?[1-9]\d{6,14}$/.test(p) && !/^0\d{7,14}$/.test(p)) {
      return {
        valid: false,
        message: "Invalid phone number. Must be a valid phone number (e.g. +27 82 123 4567)."
      };
    }
    return { valid: true, normalized: p };
  }
};

/**
 * Returns the country format specification for a given country code or tenant object.
 */
export function getCountryFormat(countryCodeOrTenant?: string | { countryCode?: string | null; code?: string | null } | null): CountryFormatSpec {
  if (!countryCodeOrTenant) return DEFAULT_GLOBAL_FORMAT;
  let code = "";
  if (typeof countryCodeOrTenant === "string") {
    code = countryCodeOrTenant.trim().toUpperCase();
  } else {
    code = (countryCodeOrTenant.countryCode || countryCodeOrTenant.code || "").trim().toUpperCase();
  }

  // Common aliases
  if (code === "BW") code = "BWA";
  if (code === "ZA") code = "ZAF";
  if (code === "ZM") code = "ZMB";
  if (code === "KE") code = "KEN";
  if (code === "VN") code = "VNM";
  if (code === "PG") code = "PNG";
  if (code === "SS") code = "SSD";
  if (code === "NG") code = "NGA";
  if (code === "MW") code = "MWI";
  if (code === "UG") code = "UGA";

  return COUNTRY_FORMATS[code] || DEFAULT_GLOBAL_FORMAT;
}
