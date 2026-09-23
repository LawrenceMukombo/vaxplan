/**
 * tenantCache.ts
 *
 * Small localStorage-backed cache for the cross-tenant country switcher so it
 * keeps working offline.
 *
 * Two keys are used:
 *   - `vaxplan_active_tenant`  — the tenant the user is currently viewing
 *     (written by App.tsx + TenantSwitcher). Shape: { id, code, name, ... }.
 *   - `vaxplan_tenants_cache`  — the last successfully-fetched list of active
 *     tenants from GET /api/public/tenants.
 *
 * The switcher always merges the cached list with the active tenant so the
 * currently-active country is never missing from the dropdown — that was the
 * root cause of the "active = PNG but PNG not listed" mismatch when the list
 * fetch failed offline.
 */

export interface CachedTenant {
  id: string;
  code: string;
  name: string;
  countryCode?: string | null;
  settings?: { isDemo?: boolean } | Record<string, unknown>;
}

export const DEFAULT_CANONICAL_TENANTS: CachedTenant[] = [
  { id: "c43e2923-b2d9-4175-a1a8-ff6b0cd58810", code: "ZAF", name: "Republic of South Africa National Department of Health", countryCode: "ZAF" },
  { id: "4bb7abba-11cd-4c99-96c2-eedc8a4dfd06", code: "ZMB", name: "Republic of Zambia Ministry of Health", countryCode: "ZMB" },
  { id: "705728db-4892-49d7-9b67-35aa67c7574b", code: "SSD", name: "Republic of South Sudan Ministry of Health", countryCode: "SSD" },
  { id: "8c2f81fb-06f3-4688-90ea-e9ae27d73191", code: "PNG", name: "Papua New Guinea National Department of Health", countryCode: "PNG" },
  { id: "22571429-f7dd-4f1d-9dea-abdfbf4dc115", code: "BW", name: "Republic of Botswana Ministry of Health", countryCode: "BWA" },
  { id: "08083581-cf5e-47d7-b3ed-a97b10be01ba", code: "KEN", name: "Republic of Kenya Ministry of Health", countryCode: "KEN" },
  { id: "1a39bf12-bf10-4415-b2dd-96f1ece09b75", code: "VNM", name: "Republic of Vietnam Ministry of Health", countryCode: "VNM" },
];

const TENANTS_CACHE_KEY = "vaxplan_tenants_cache";
const ACTIVE_TENANT_KEY = "vaxplan_active_tenant";

/** Persist the freshly-fetched public tenant list for offline reuse. */
export function saveTenantsCache(list: CachedTenant[]): void {
  try {
    if (Array.isArray(list) && list.length > 0) {
      localStorage.setItem(TENANTS_CACHE_KEY, JSON.stringify(list));
    }
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

/** Read the last-known tenant list (used as offline fallback / initial data). */
export function loadTenantsCache(): CachedTenant[] {
  try {
    const raw = localStorage.getItem(TENANTS_CACHE_KEY);
    if (!raw) return DEFAULT_CANONICAL_TENANTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as CachedTenant[]) : DEFAULT_CANONICAL_TENANTS;
  } catch {
    return DEFAULT_CANONICAL_TENANTS;
  }
}

/** Read the currently-active tenant object cached by App.tsx / the switcher. */
export function loadActiveTenant(): CachedTenant | null {
  try {
    const raw = localStorage.getItem(ACTIVE_TENANT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
      return parsed as CachedTenant;
    }
    return null;
  } catch {
    return null;
  }
}

/** Save the currently-active tenant object to cache. */
export function saveActiveTenant(tenant: CachedTenant): void {
  try {
    if (tenant && typeof tenant === "object" && typeof tenant.id === "string") {
      localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(tenant));
    }
  } catch {
    /* storage full / disabled */
  }
}

/**
 * Return the tenant ID the sync engine should use as its IndexedDB partition
 * key and server tenantId parameter.
 *
 * For platform super-admins the "active" tenant may differ from their home
 * tenant — they can switch between countries.  In that case we want the sync
 * engine to use the currently-viewed tenant so that each country's data is
 * stored in its own IndexedDB bucket and never mixed with another country's
 * data.  For ordinary users their home tenant is always the active one.
 */
export function getActiveSyncTenantId(user: {
  tenantId: string | null; // null is valid for users awaiting tenant provisioning
  isPlatformAdmin?: boolean;
} | null | undefined): string | null {
  if (!user) {
    const active = loadActiveTenant();
    if (active?.id) return active.id;
    return null;
  }
  if (user.isPlatformAdmin) {
    const active = loadActiveTenant();
    if (active?.id) return active.id;
    if (user.tenantId) return user.tenantId;
    const cache = loadTenantsCache();
    if (cache.length > 0 && cache[0]?.id) return cache[0].id;
    return null;
  }
  if (user.tenantId) return user.tenantId;
  const active = loadActiveTenant();
  if (active?.id) return active.id;
  const cache = loadTenantsCache();
  if (cache.length > 0 && cache[0]?.id) return cache[0].id;
  return null;
}

/**
 * Merge a base tenant list with the active tenant, de-duplicating by id and
 * guaranteeing the active tenant is always present (even if the list fetch
 * failed offline or the active tenant was filtered out as demo).
 */
export function mergeWithActive(
  list: CachedTenant[],
  active: CachedTenant | null | undefined,
): CachedTenant[] {
  const byId = new Map<string, CachedTenant>();
  for (const t of list) {
    if (t && typeof t.id === "string") byId.set(t.id, t);
  }
  if (active && typeof active.id === "string" && !byId.has(active.id)) {
    byId.set(active.id, active);
  }
  return Array.from(byId.values());
}
