/**
 * VaxPlan GIS — Centralized Basemap Provider Registry
 *
 * Provides authoritative definitions for all map basemaps in VaxPlan.
 * Supports both modern MapLibre GL JS vector styles and Leaflet raster tiles.
 * Isolates CARTO to optional/disabled-by-default to prevent watermark regressions.
 */

export type BasemapEngine = "raster" | "vector" | "hybrid";
export type BasemapType =
  | "light"
  | "streets"
  | "dark"
  | "satellite"
  | "terrain"
  | "humanitarian"
  | "custom";

export interface BasemapProvider {
  /** Unique stable identifier */
  id: string;
  /** User-facing display name */
  displayName: string;
  /** Source provider or standard */
  provider: "vaxplan" | "openstreetmap" | "esri" | "opentopomap" | "carto" | "custom";
  /** Rendering engine support */
  engine: BasemapEngine;
  /** Visual category */
  type: BasemapType;
  /** Vector tile style JSON endpoint (for MapLibre GL JS) */
  styleUrl?: string;
  /** Raster tile template URL (for Leaflet or raster fallbacks) */
  tileUrl: string;
  /** Standard legal attribution */
  attribution: string;
  /** Whether an external API key is strictly required */
  requiresApiKey: boolean;
  /** Optional environment variable name supplying the key */
  apiKeyEnvVar?: string;
  /** Whether this layer can be packaged for offline use */
  supportsOffline: boolean;
  /** Whether this provider is enabled for users */
  enabled: boolean;
  /** Optional country scoping (ISO 3-letter codes) */
  countryScope?: string[];
  /** Maximum zoom level natively available from tile source */
  maxNativeZoom: number;
  /** Maximum zoom level supported by the client viewer (via overzooming) */
  maxZoom: number;
  /** Minimum zoom level */
  minZoom: number;
  /** UI badge text, e.g. "VaxPlan Vector", "Offline Ready" */
  badge?: string;
  /** Lucide icon name hint for UI selectors */
  iconHint?: "sun" | "compass" | "moon" | "satellite" | "mountain" | "map" | "layers";
}

// Configurable tile server host (defaults to current origin or maps.vaxplan.org when self-hosted)
const TILE_SERVICE_HOST = (typeof import.meta !== "undefined" && import.meta.env?.VITE_TILE_SERVICE_HOST)
  ? import.meta.env.VITE_TILE_SERVICE_HOST
  : "";

// User-provided official CARTO Basemaps API key
const DEFAULT_CARTO_API_KEY = "cb1_2wxx_1_19a2e48a7de2e23331436131";

export const CARTO_API_KEY = (typeof import.meta !== "undefined" && import.meta.env?.VITE_CARTO_API_KEY)
  ? import.meta.env.VITE_CARTO_API_KEY
  : DEFAULT_CARTO_API_KEY;

export const HAS_CARTO_KEY = Boolean(CARTO_API_KEY);

/** Standard CARTO tile key query parameter */
export const CARTO_KEY_PARAM = CARTO_API_KEY ? `?key=${CARTO_API_KEY}` : "";

/**
 * Authoritative VaxPlan Basemap Providers
 */
export const BASEMAP_REGISTRY: Record<string, BasemapProvider> = {
  // 1. Primary Clean Baseline — VaxPlan Light (Clean Light Canvas)
  // Low visual noise so immunization pins, clinics, and unserved clusters pop immediately.
  vaxplan_light: {
    id: "vaxplan_light",
    displayName: "VaxPlan Light",
    provider: "vaxplan",
    engine: "hybrid",
    type: "light",
    styleUrl: TILE_SERVICE_HOST
      ? `${TILE_SERVICE_HOST}/styles/vaxplan-light/style.json`
      : "/api/maps/styles/vaxplan-light/style.json",
    tileUrl: HAS_CARTO_KEY
      ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${CARTO_KEY_PARAM}`
      : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: HAS_CARTO_KEY
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    requiresApiKey: false,
    supportsOffline: true,
    enabled: true,
    minZoom: 1,
    maxNativeZoom: 18,
    maxZoom: 22,
    badge: "Recommended",
    iconHint: "sun",
  },

  // 2. High-Readability Operational Streets — VaxPlan Streets
  vaxplan_streets: {
    id: "vaxplan_streets",
    displayName: "VaxPlan Streets",
    provider: "vaxplan",
    engine: "hybrid",
    type: "streets",
    styleUrl: TILE_SERVICE_HOST
      ? `${TILE_SERVICE_HOST}/styles/vaxplan-streets/style.json`
      : "/api/maps/styles/vaxplan-streets/style.json",
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    requiresApiKey: false,
    supportsOffline: true,
    enabled: true,
    minZoom: 1,
    maxNativeZoom: 19,
    maxZoom: 22,
    iconHint: "compass",
  },

  // 3. Dark Mode Operational Canvas — VaxPlan Dark
  vaxplan_dark: {
    id: "vaxplan_dark",
    displayName: "VaxPlan Dark",
    provider: "vaxplan",
    engine: "hybrid",
    type: "dark",
    styleUrl: TILE_SERVICE_HOST
      ? `${TILE_SERVICE_HOST}/styles/vaxplan-dark/style.json`
      : "/api/maps/styles/vaxplan-dark/style.json",
    tileUrl: HAS_CARTO_KEY
      ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${CARTO_KEY_PARAM}`
      : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: HAS_CARTO_KEY
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    requiresApiKey: false,
    supportsOffline: true,
    enabled: true,
    minZoom: 1,
    maxNativeZoom: 18,
    maxZoom: 22,
    iconHint: "moon",
  },

  // 4. Satellite Imagery
  satellite: {
    id: "satellite",
    displayName: "Satellite Imagery",
    provider: "esri",
    engine: "raster",
    type: "satellite",
    tileUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    requiresApiKey: false,
    supportsOffline: false,
    enabled: true,
    minZoom: 1,
    maxNativeZoom: 17,
    maxZoom: 22,
    iconHint: "satellite",
  },

  // 5. Terrain & Topography
  terrain: {
    id: "terrain",
    displayName: "Terrain Map",
    provider: "opentopomap",
    engine: "raster",
    type: "terrain",
    tileUrl: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "Map data: &copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href='https://opentopomap.org'>OpenTopoMap</a>",
    requiresApiKey: false,
    supportsOffline: false,
    enabled: true,
    minZoom: 1,
    maxNativeZoom: 17,
    maxZoom: 22,
    iconHint: "mountain",
  },

  // 6. OpenStreetMap Standard
  openstreetmap: {
    id: "openstreetmap",
    displayName: "OpenStreetMap",
    provider: "openstreetmap",
    engine: "raster",
    type: "streets",
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    requiresApiKey: false,
    supportsOffline: true,
    enabled: true,
    minZoom: 1,
    maxNativeZoom: 19,
    maxZoom: 22,
    iconHint: "map",
  },

  // 7. Humanitarian OpenStreetMap
  humanitarian: {
    id: "humanitarian",
    displayName: "Humanitarian Map",
    provider: "openstreetmap",
    engine: "raster",
    type: "humanitarian",
    tileUrl: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors, Tiles by Humanitarian OpenStreetMap Team",
    requiresApiKey: false,
    supportsOffline: true,
    enabled: true,
    minZoom: 1,
    maxNativeZoom: 19,
    maxZoom: 22,
    iconHint: "layers",
  },

  // 8. CARTO Positron (Key authenticated - no watermark)
  carto_positron: {
    id: "carto_positron",
    displayName: "CARTO Positron",
    provider: "carto",
    engine: "raster",
    type: "light",
    tileUrl: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${CARTO_KEY_PARAM}`,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    requiresApiKey: true,
    apiKeyEnvVar: "VITE_CARTO_API_KEY",
    supportsOffline: false,
    enabled: true,
    minZoom: 1,
    maxNativeZoom: 18,
    maxZoom: 22,
    iconHint: "sun",
  },

  // 9. CARTO Voyager (Key authenticated - no watermark)
  carto_voyager: {
    id: "carto_voyager",
    displayName: "CARTO Voyager",
    provider: "carto",
    engine: "raster",
    type: "streets",
    tileUrl: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${CARTO_KEY_PARAM}`,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    requiresApiKey: true,
    apiKeyEnvVar: "VITE_CARTO_API_KEY",
    supportsOffline: false,
    enabled: true,
    minZoom: 1,
    maxNativeZoom: 18,
    maxZoom: 22,
    iconHint: "compass",
  },
};

/**
 * Legacy string alias mapping to maintain 100% backward compatibility
 * with all existing components across the application.
 */
export const LEGACY_BASEMAP_ALIAS_MAP: Record<string, string> = {
  osm: "openstreetmap",
  positron: "vaxplan_light",
  voyager: "vaxplan_streets",
  carto: "vaxplan_streets",
  light: "vaxplan_light",
  dark: "vaxplan_dark",
  boundary: "vaxplan_light",
  satellite: "satellite",
  terrain: "terrain",
  humanitarian: "humanitarian",
};

/**
 * Resolves a basemap key (whether modern or legacy alias) to its canonical BasemapProvider.
 * Falls back safely to VaxPlan Light or OpenStreetMap.
 */
export function getBasemapProvider(key: string): BasemapProvider {
  if (BASEMAP_REGISTRY[key]) {
    return BASEMAP_REGISTRY[key];
  }
  const aliasedKey = LEGACY_BASEMAP_ALIAS_MAP[key];
  if (aliasedKey && BASEMAP_REGISTRY[aliasedKey]) {
    return BASEMAP_REGISTRY[aliasedKey];
  }
  return BASEMAP_REGISTRY.vaxplan_light || BASEMAP_REGISTRY.openstreetmap;
}

/**
 * Returns all active, enabled basemap providers suitable for presentation in UI switchers.
 */
export function getEnabledBasemapProviders(): BasemapProvider[] {
  return Object.values(BASEMAP_REGISTRY).filter((provider) => provider.enabled);
}

/**
 * Check if a provider requires an API key that is currently missing.
 */
export function isBasemapMissingApiKey(provider: BasemapProvider): boolean {
  if (!provider.requiresApiKey) return false;
  if (provider.provider === "carto" && !HAS_CARTO_KEY) return true;
  return false;
}
