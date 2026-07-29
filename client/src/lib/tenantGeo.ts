export type TenantLike = {
  countryCode?: string | null;
  code?: string | null;
  settings?: Record<string, any> | null;
};

export type TenantMapDefaults = {
  center: [number, number];
  zoom: number;
  maxBounds?: [[number, number], [number, number]];
};

const DEFAULTS_BY_CODE: Record<string, TenantMapDefaults> = {
  ZMB: { center: [-13.133897, 27.849332], zoom: 6, maxBounds: [[-18.5, 21.5], [-8.0, 34.0]] },
  SSD: { center: [7.87, 29.69], zoom: 6, maxBounds: [[3.3, 23.4], [12.8, 36.2]] },
  PNG: { center: [-6.314993, 143.95555], zoom: 6, maxBounds: [[-12.5, 140.0], [0.0, 160.5]] },
  ZAF: { center: [-29.0, 24.5], zoom: 5, maxBounds: [[-35.5, 16.0], [-21.0, 33.5]] },
};

const FALLBACK: TenantMapDefaults = { center: [-6.314993, 143.95555], zoom: 6 };

export function tenantCodeOf(tenant?: TenantLike | null): string {
  return String(tenant?.countryCode || tenant?.code || "").toUpperCase();
}

export function getTenantMapDefaults(tenant?: TenantLike | null): TenantMapDefaults {
  const code = tenantCodeOf(tenant);
  const fromCode = DEFAULTS_BY_CODE[code] || FALLBACK;
  const settings = tenant?.settings || {};
  const center = Array.isArray(settings.mapCenter) && settings.mapCenter.length >= 2
    ? [Number(settings.mapCenter[0]), Number(settings.mapCenter[1])] as [number, number]
    : fromCode.center;
  const zoom = Number(settings.mapZoom || fromCode.zoom || FALLBACK.zoom);
  const maxBounds = Array.isArray(settings.mapBounds) && settings.mapBounds.length === 2
    ? settings.mapBounds as [[number, number], [number, number]]
    : fromCode.maxBounds;
  return { center, zoom, maxBounds };
}

export function getTenantMaxBounds(tenant?: TenantLike | null) {
  return getTenantMapDefaults(tenant).maxBounds;
}
