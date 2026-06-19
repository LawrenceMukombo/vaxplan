import type { CatalogueScheduleDose } from "./schema";

export interface DoseStage {
  code: string;
  label: string;
  antigen: string;
  doseNumber: number;
  configId: number;
}

const DOSE_LIST_SUFFIX = /^(.+?)[-_\s]+(\d+(?:\s*[,/]\s*\d+)*\+?)\s*$/;

function stripDoseListSuffix(name: string): string {
  const m = name.match(DOSE_LIST_SUFFIX);
  return m ? m[1].trim() : name;
}

function normalizeCode(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "_");
}

export interface CanonicalizePerAntigenResult {
  perAntigen: Record<string, number>;
  perAntigenUnmapped: Record<string, number>;
  unmappedCodes: string[];
}

/**
 * Validate a perAntigen payload against the tenant's vaccine schedule.
 * Known codes are canonicalized to the schedule's exact code (case- and
 * whitespace-insensitive). Unknown codes are kept under `perAntigenUnmapped`
 * so older offline-outbox entries / stale clients still count toward totals
 * without polluting per-antigen rollups.
 */
export function canonicalizePerAntigen(
  raw: Record<string, unknown> | null | undefined,
  doses: CatalogueScheduleDose[] | undefined | null,
): CanonicalizePerAntigenResult {
  const stages = expandVaccineSchedule(doses);
  const lookup = new Map<string, string>();
  for (const s of stages) {
    lookup.set(s.code, s.code);
    lookup.set(s.code.toUpperCase(), s.code);
    lookup.set(s.code.replace(/\s+/g, "_").toUpperCase(), s.code);
  }
  const perAntigen: Record<string, number> = {};
  const perAntigenUnmapped: Record<string, number> = {};
  for (const [rawKey, rawVal] of Object.entries(raw ?? {})) {
    const key = String(rawKey).trim();
    if (!key) continue;
    const val = Number(rawVal);
    if (!Number.isFinite(val) || val < 0) continue;
    const canonical =
      lookup.get(key) ??
      lookup.get(key.toUpperCase()) ??
      lookup.get(key.replace(/\s+/g, "_").toUpperCase());
    if (canonical) {
      perAntigen[canonical] = (perAntigen[canonical] ?? 0) + val;
    } else {
      perAntigenUnmapped[key] = (perAntigenUnmapped[key] ?? 0) + val;
    }
  }
  return {
    perAntigen,
    perAntigenUnmapped,
    unmappedCodes: Object.keys(perAntigenUnmapped),
  };
}

export function expandVaccineSchedule(
  doses: CatalogueScheduleDose[] | undefined | null,
): DoseStage[] {
  if (!doses || doses.length === 0) return [];

  const stages: DoseStage[] = [];

  for (const dose of doses) {
    if (!dose || dose.active === false) continue;
    const rawName = (dose.name || "").trim();
    if (!rawName) continue;

    const antigenLabel = stripDoseListSuffix(rawName);

    stages.push({
      code: normalizeCode(dose.doseCode || rawName),
      label: rawName,
      antigen: antigenLabel,
      doseNumber: dose.doseNumber || 1,
      configId: dose.vaccineId,
    });
  }

  return stages;
}

export function normalizeStockVaccineName(input: string): string {
  if (!input) return "";
  let value = input.trim().toUpperCase();

  // Replace e.g., "PENTA DOSE 1", "PENTA DOSE-1", "PENTADOSE 1", "PENTADOSE1" with "PENTA-1"
  value = value.replace(/DOSE\s*-?\s*([0-9]+)/g, "-$1");

  // Remove spaces
  value = value.replace(/\s+/g, "");

  // Standardize single trailing digit pattern, e.g. "PENTA1" -> "PENTA-1"
  value = value.replace(/^([A-Z]+)-?([0-9]+)$/, "$1-$2");

  const mapping: Record<string, string> = {
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

