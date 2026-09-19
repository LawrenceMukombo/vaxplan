import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { X, MapPin, Lock } from "lucide-react";
import { pluralize } from "@/lib/utils";
import type { Province, District, Facility, Region } from "@shared/schema";

export interface GeoCascadeFilterProps {
  provinceId: number | null;
  districtId: number | null;
  facilityId?: number | null;
  regionId?: number | null;
  onProvinceChange: (id: number | null) => void;
  onDistrictChange: (id: number | null) => void;
  onFacilityChange?: (id: number | null) => void;
  onRegionChange?: (id: number | null) => void;
  showFacility?: boolean;
  showRegion?: boolean;
  provinces?: Province[] | null;
  districts?: District[] | null;
  facilities?: Facility[] | null;
  regions?: Region[] | null;
  provinceLabel?: string;
  districtLabel?: string;
  facilityLabel?: string;
  regionLabel?: string;
  className?: string;
  testIdPrefix?: string;
  /**
   * When true (default), each downstream selector is locked until its parent
   * is selected — District is disabled until Province is chosen, Facility is
   * disabled until District is chosen. This enforces the true cascading UX and
   * prevents planners from skipping a level.
   *
   * Set to false only in rare contexts where all levels should remain
   * independently interactive (e.g. admin batch-edit screens).
   */
  strictCascade?: boolean;
}

async function fetchJson<T>(url: string, tenantId?: string | null): Promise<T> {
  const fullUrl = tenantId
    ? `${url}${url.includes("?") ? "&" : "?"}tenantId=${encodeURIComponent(tenantId)}`
    : url;
  const headers: Record<string, string> = { "Cache-Control": "no-cache" };
  if (tenantId) headers["x-tenant-id"] = tenantId;
  const res = await fetch(fullUrl, { credentials: "include", headers });
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

/**
 * Cascading Province → District → (optional) Facility filter bar.
 *
 * - Tenant-scoped: relies on the server's session-aware endpoints
 *   (`/api/provinces`, `/api/districts`, `/api/facilities`) when callers
 *   don't pass their own lists.
 * - Pure controlled component: parent owns the selected IDs.
 * - Cascading: changing a parent clears the child selection.
 * - Smart cascade (strictCascade=true, default): District is disabled until a
 *   Province is selected; Facility is disabled until a District is selected.
 *   This mirrors the OSM / GIS convention of progressive geographic narrowing.
 */
export function GeoCascadeFilter({
  provinceId,
  districtId,
  facilityId,
  regionId,
  onProvinceChange,
  onDistrictChange,
  onFacilityChange,
  onRegionChange,
  showFacility = false,
  showRegion = false,
  provinces: providedProvinces,
  districts: providedDistricts,
  facilities: providedFacilities,
  regions: providedRegions,
  provinceLabel = "Province",
  districtLabel = "District",
  facilityLabel = "Facility",
  regionLabel = "Region",
  className,
  testIdPrefix = "geo",
  strictCascade = true,
}: GeoCascadeFilterProps) {
  const { user } = useAuth();
  
  // Resolve user role scoping
  const userRole = user?.role;
  const isPlatformAdmin = user?.isPlatformAdmin === true;
  const isNationalAdmin = userRole === "national_admin" || (Array.isArray(user?.roles) && user.roles.includes("national_admin"));
  const isGisSpecialist = userRole === "gis_specialist" || (Array.isArray(user?.roles) && user.roles.includes("gis_specialist"));
  const hasAdminBypass = isPlatformAdmin || isNationalAdmin || isGisSpecialist;

  const isFacilityUser = !hasAdminBypass && (userRole === "facility_clerk" || userRole === "facility_in_charge" || (Array.isArray(user?.roles) && (user.roles.includes("facility_clerk") || user.roles.includes("facility_in_charge"))));
  const isDistrictUser = !hasAdminBypass && (userRole === "district_manager" || (Array.isArray(user?.roles) && user.roles.includes("district_manager")));
  const isProvinceUser = !hasAdminBypass && (userRole === "provincial_coordinator" || (Array.isArray(user?.roles) && user.roles.includes("provincial_coordinator")));

  // Tenant context — used as a cache scope so switching countries refetches.
  const { data: tenantInfo } = useQuery<any>({
    queryKey: ["/api/me/tenant"],
  });

  const activeTenantId = tenantInfo?.activeTenant?.id || tenantInfo?.id;

  const { data: fetchedRegions } = useQuery<Region[]>({
    queryKey: ["/api/regions", activeTenantId],
    queryFn: () => fetchJson<Region[]>("/api/regions", activeTenantId),
    enabled: showRegion && providedRegions === undefined,
  });

  const { data: fetchedProvinces } = useQuery<Province[]>({
    queryKey: ["/api/provinces", activeTenantId],
    queryFn: () => fetchJson<Province[]>("/api/provinces", activeTenantId),
    enabled: providedProvinces === undefined,
  });

  const { data: fetchedDistricts } = useQuery<District[]>({
    queryKey: ["/api/districts", activeTenantId],
    queryFn: () => fetchJson<District[]>("/api/districts", activeTenantId),
    enabled: providedDistricts === undefined,
  });

  const { data: fetchedFacilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities", activeTenantId],
    queryFn: () => fetchJson<Facility[]>("/api/facilities", activeTenantId),
    enabled: showFacility && providedFacilities === undefined,
  });

  const provinces = providedProvinces ?? fetchedProvinces ?? [];
  const districts = providedDistricts ?? fetchedDistricts ?? [];
  const facilities = providedFacilities ?? fetchedFacilities ?? [];
  const regions = providedRegions ?? fetchedRegions ?? [];
  const usesDistrictLevel = (tenantInfo?.activeTenant?.settings ?? tenantInfo?.settings)?.hasDistricts !== false;

  useEffect(() => {
    if (!usesDistrictLevel && districtId !== null) {
      onDistrictChange(null);
    }
  }, [usesDistrictLevel, districtId, onDistrictChange]);

  // Enforce preselection via useEffect
  useEffect(() => {
    if (!user) return;

    if (isFacilityUser) {
      if (user.provinceId && provinceId !== user.provinceId) {
        onProvinceChange(user.provinceId);
      }
      if (user.districtId && districtId !== user.districtId) {
        onDistrictChange(user.districtId);
      }
      if (showFacility && onFacilityChange && user.facilityId && facilityId !== user.facilityId) {
        onFacilityChange(user.facilityId);
      }
    } else if (isDistrictUser) {
      if (user.provinceId && provinceId !== user.provinceId) {
        onProvinceChange(user.provinceId);
      }
      if (user.districtId && districtId !== user.districtId) {
        onDistrictChange(user.districtId);
      }
    } else if (isProvinceUser) {
      if (user.provinceId && provinceId !== user.provinceId) {
        onProvinceChange(user.provinceId);
      }
    }
  }, [user, provinceId, districtId, facilityId, isFacilityUser, isDistrictUser, isProvinceUser, showFacility]);

  const sortedRegions = useMemo(
    () => [...regions].sort((a, b) => a.name.localeCompare(b.name)),
    [regions],
  );

  
  const sortedProvinces = useMemo(() => {
    let list = provinces;
    if (isProvinceUser || isDistrictUser || isFacilityUser) {
      if (user?.provinceId) {
        list = list.filter((p) => Number(p.id) === Number(user.provinceId));
      }
    }
    if (showRegion && regionId) {
      list = list.filter((p) => Number((p as any).regionId) === Number(regionId));
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [provinces, regionId, showRegion, isProvinceUser, isDistrictUser, isFacilityUser, user?.provinceId]);

  const filteredDistricts = useMemo(() => {
    let list = districts;
    if (isDistrictUser || isFacilityUser) {
      if (user?.districtId) {
        list = list.filter((d) => Number(d.id) === Number(user.districtId) || String(d.id) === String(user.districtId));
      }
    } else if (provinceId) {
      const targetProv = provinces.find((p) => Number(p.id) === Number(provinceId) || String(p.id) === String(provinceId));
      list = list.filter((d) => {
        const dProvId = (d as any).provinceId;
        if (dProvId != null && (Number(dProvId) === Number(provinceId) || String(dProvId) === String(provinceId))) {
          return true;
        }
        if (targetProv && (d as any).provinceName) {
          return (d as any).provinceName.toLowerCase() === targetProv.name.toLowerCase();
        }
        return false;
      });
    } else if (strictCascade) {
      return [];
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [districts, provinces, provinceId, isDistrictUser, isFacilityUser, user?.districtId, strictCascade]);

  const filteredFacilities = useMemo(() => {
    if (!showFacility) return [];
    let list = facilities;
    
    if (isFacilityUser) {
      if (user?.facilityId) {
        list = list.filter((f) => Number(f.id) === Number(user.facilityId) || String(f.id) === String(user.facilityId));
      }
    } else if (usesDistrictLevel && districtId) {
      const targetDist = districts.find((d) => Number(d.id) === Number(districtId) || String(d.id) === String(districtId));
      list = list.filter((f) => {
        const fDistId = (f as any).districtId;
        if (fDistId != null && (Number(fDistId) === Number(districtId) || String(fDistId) === String(districtId))) {
          return true;
        }
        if (targetDist && (f as any).districtName) {
          return (f as any).districtName.toLowerCase() === targetDist.name.toLowerCase();
        }
        return false;
      });
    } else if (provinceId) {
      const targetProv = provinces.find((p) => Number(p.id) === Number(provinceId) || String(p.id) === String(provinceId));
      const targetDistIds = new Set(
        districts
          .filter((d) => {
            const dProvId = (d as any).provinceId;
            return (dProvId != null && (Number(dProvId) === Number(provinceId) || String(dProvId) === String(provinceId))) ||
              (targetProv && (d as any).provinceName && (d as any).provinceName.toLowerCase() === targetProv.name.toLowerCase());
          })
          .map((d) => Number(d.id))
      );

      list = list.filter((f) => {
        const directProvinceId = (f as any).provinceId;
        if (directProvinceId != null && (Number(directProvinceId) === Number(provinceId) || String(directProvinceId) === String(provinceId))) {
          return true;
        }
        if (targetProv && (f as any).province && (f as any).province.toLowerCase() === targetProv.name.toLowerCase()) {
          return true;
        }
        const fDistId = Number((f as any).districtId);
        if (Number.isFinite(fDistId) && targetDistIds.has(fDistId)) {
          return true;
        }
        return false;
      });
    } else if (strictCascade) {
      return [];
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [facilities, districts, provinces, provinceId, districtId, showFacility, usesDistrictLevel, isFacilityUser, user?.facilityId, strictCascade]);

  // Precompute statistics for dropdown labels
  const provinceStats = useMemo(() => {
    const map = new Map<number, { districts: number; facilities: number }>();
    provinces.forEach((p) => {
      const pId = Number(p.id);
      const dInP = districts.filter((d) => {
        const dProvId = (d as any).provinceId;
        if (dProvId != null && (Number(dProvId) === pId || String(dProvId) === String(p.id))) return true;
        return (d as any).provinceName && (d as any).provinceName.toLowerCase() === p.name.toLowerCase();
      });
      const dIds = new Set(dInP.map((d) => Number(d.id)));
      const fInP = facilities.filter((f) => {
        const fDistId = Number((f as any).districtId);
        const fProvId = (f as any).provinceId;
        return (Number.isFinite(fDistId) && dIds.has(fDistId)) ||
          (fProvId != null && (Number(fProvId) === pId || String(fProvId) === String(p.id)));
      });
      map.set(pId, { districts: dInP.length, facilities: fInP.length });
    });
    return map;
  }, [provinces, districts, facilities]);

  const districtStats = useMemo(() => {
    const map = new Map<number, number>();
    districts.forEach((d) => {
      const dId = Number(d.id);
      const count = facilities.filter((f) => Number((f as any).districtId) === dId).length;
      map.set(dId, count);
    });
    return map;
  }, [districts, facilities]);

  // Lock status considering user-role scopes
  const provinceLocked = isProvinceUser || isDistrictUser || isFacilityUser;
  const districtLocked = !usesDistrictLevel || isDistrictUser || isFacilityUser || (strictCascade && !provinceId);
  const facilityLocked = isFacilityUser || (strictCascade && (!provinceId || (usesDistrictLevel && !districtId)));

  const hasSelection =
    (showRegion && regionId && !provinceLocked) ||
    (provinceId !== null && !provinceLocked) ||
    (usesDistrictLevel && districtId !== null && !districtLocked) ||
    (showFacility && facilityId && !facilityLocked);

  const clearAll = () => {
    if (showRegion && onRegionChange) onRegionChange(null);
    if (!provinceLocked) onProvinceChange(null);
    if (!districtLocked) onDistrictChange(null);
    if (showFacility && onFacilityChange && !facilityLocked) onFacilityChange(null);
  };

  const handleRegion = (val: string) => {
    if (!onRegionChange) return;
    const id = val === "all" ? null : Number(val);
    onRegionChange(id);
    onProvinceChange(null);
    onDistrictChange(null);
    if (showFacility && onFacilityChange) onFacilityChange(null);
  };

  const handleProvince = (val: string) => {
    const id = val === "all" ? null : Number(val);
    onProvinceChange(id);
    onDistrictChange(null);
    if (showFacility && onFacilityChange) onFacilityChange(null);
  };

  const handleDistrict = (val: string) => {
    const id = val === "all" ? null : Number(val);
    if (id !== null) {
      const d = districts.find((dd) => Number(dd.id) === id || String(dd.id) === String(id));
      if (d) {
        const dProvId = Number((d as any).provinceId);
        if (Number.isFinite(dProvId) && dProvId > 0 && Number(provinceId) !== dProvId) {
          onProvinceChange(dProvId);
        }
      }
    }
    // Parent callbacks commonly clear their descendants. Apply the selected
    // district after synchronising its province so the requested value is not
    // immediately reset by the parent change.
    onDistrictChange(id);
    if (showFacility && onFacilityChange) onFacilityChange(null);
  };

  const handleFacility = (val: string) => {
    if (!onFacilityChange) return;
    const id = val === "all" ? null : Number(val);
    if (id !== null) {
      const fac = facilities.find((f) => Number(f.id) === id || String(f.id) === String(id));
      if (fac) {
        const facDistId = Number((fac as any).districtId);
        if (Number.isFinite(facDistId) && facDistId > 0) {
          const d = districts.find((dd) => Number(dd.id) === facDistId || String(dd.id) === String(facDistId));
          if (d) {
            const dProvId = Number((d as any).provinceId);
            if (Number.isFinite(dProvId) && dProvId > 0 && Number(provinceId) !== dProvId) {
              onProvinceChange(dProvId);
            }
          }
          if (Number(districtId) !== facDistId) {
            onDistrictChange(facDistId);
          }
        }
      }
    }
    // Apply the leaf last because either parent callback may clear it.
    onFacilityChange(id);
  };

  // Searchable Select Options for each cascading level
  const regionOptions = useMemo(() => [
    { value: "all", label: `All ${regionLabel}s` },
    ...sortedRegions.map((r) => ({ value: r.id.toString(), label: r.name }))
  ], [sortedRegions, regionLabel]);

  const provinceOptions = useMemo(() => [
    { value: "all", label: `All ${provinceLabel}s` },
    ...sortedProvinces.map((p) => {
      const stats = provinceStats.get(Number(p.id));
      return {
        value: p.id.toString(),
        label: p.name,
        subLabel: stats && stats.districts > 0 ? `${stats.districts} ${stats.districts === 1 ? districtLabel : `${districtLabel}s`}` : undefined
      };
    })
  ], [sortedProvinces, provinceLabel, provinceStats, districtLabel]);

  const districtOptions = useMemo(() => [
    { value: "all", label: `All ${districtLabel}s` },
    ...filteredDistricts.map((d) => {
      const facCount = districtStats.get(Number(d.id));
      return {
        value: d.id.toString(),
        label: d.name,
        subLabel: facCount !== undefined && facCount > 0 ? `${facCount} ${facCount === 1 ? facilityLabel : `${facilityLabel}s`}` : undefined
      };
    })
  ], [filteredDistricts, districtLabel, districtStats, facilityLabel]);

  const facilityOptions = useMemo(() => [
    { value: "all", label: `All ${pluralize(facilityLabel)}` },
    ...filteredFacilities.map((f) => ({
      value: f.id.toString(),
      label: f.name,
      subLabel: f.facilityType ? f.facilityType.toUpperCase() : undefined
    }))
  ], [filteredFacilities, facilityLabel]);

  return (
    <div
      className={`flex flex-wrap items-end gap-3 w-full ${className ?? ""}`}
      data-testid={`${testIdPrefix}-cascade-filter`}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground self-center sm:self-end pb-0 sm:pb-2.5 shrink-0">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        Filter by location
      </div>

      {showRegion && (
        <div className="w-full sm:w-auto flex-1 min-w-[170px] max-w-full sm:max-w-[260px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {regionLabel}
          </label>
          <SearchableSelect
            value={regionId?.toString() ?? "all"}
            onValueChange={handleRegion}
            options={regionOptions}
            placeholder={`All ${regionLabel}s`}
            searchPlaceholder={`Search ${regionLabel.toLowerCase()}...`}
            sortAlphabetical={false}
          />
        </div>
      )}

      {/* Province — top of cascade */}
      <div className="w-full sm:w-auto flex-1 min-w-[170px] max-w-full sm:max-w-[260px]">
        <label className={`text-xs font-medium mb-1 flex items-center justify-between ${provinceLocked ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
          <span className="flex items-center gap-1">
            {provinceLabel}
            {provinceLocked && <Lock className="h-2.5 w-2.5 opacity-60" />}
          </span>
          <span className="text-[9px] text-primary/70 font-mono">Level 1</span>
        </label>
        <SearchableSelect
          value={provinceId?.toString() ?? "all"}
          onValueChange={handleProvince}
          options={provinceOptions}
          disabled={provinceLocked || sortedProvinces.length === 0}
          placeholder={`All ${provinceLabel}s`}
          searchPlaceholder={`Search ${provinceLabel.toLowerCase()}...`}
          sortAlphabetical={false}
        />
      </div>

      {usesDistrictLevel && (
        <div className="w-full sm:w-auto flex-1 min-w-[170px] max-w-full sm:max-w-[260px]">
          <label className={`text-xs font-medium mb-1 flex items-center justify-between ${districtLocked ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
            <span className="flex items-center gap-1">
              {districtLabel}
              {districtLocked && <Lock className="h-2.5 w-2.5 opacity-60" />}
            </span>
            <span className="text-[9px] text-primary/70 font-mono">Level 2</span>
          </label>
          <SearchableSelect
            value={districtId?.toString() ?? "all"}
            onValueChange={handleDistrict}
            options={districtOptions}
            disabled={districtLocked || filteredDistricts.length === 0}
            placeholder={
              districtLocked
                ? `🔒 Select ${provinceLabel.toLowerCase()} first`
                : `All ${districtLabel}s`
            }
            searchPlaceholder={`Search ${districtLabel.toLowerCase()}...`}
            sortAlphabetical={false}
          />
        </div>
      )}

      {/* Facility — locked until District selected in strict mode */}
      {showFacility && (
        <div className="w-full sm:w-auto flex-1 min-w-[190px] max-w-full sm:max-w-[300px]">
          <label className={`text-xs font-medium mb-1 flex items-center justify-between ${facilityLocked ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
            <span className="flex items-center gap-1">
              {facilityLabel}
              {facilityLocked && <Lock className="h-2.5 w-2.5 opacity-60" />}
              {!facilityLocked && <span className="opacity-50 text-[10px]">(optional)</span>}
            </span>
            <span className="text-[9px] text-primary/70 font-mono">Facility</span>
          </label>
          <SearchableSelect
            value={facilityId?.toString() ?? "all"}
            onValueChange={handleFacility}
            options={facilityOptions}
            disabled={facilityLocked || filteredFacilities.length === 0}
            placeholder={
              facilityLocked
                ? `🔒 Select ${(usesDistrictLevel ? districtLabel : provinceLabel).toLowerCase()} first`
                : `All ${pluralize(facilityLabel)}`
            }
            searchPlaceholder={`Search ${facilityLabel.toLowerCase()}...`}
            sortAlphabetical={false}
          />
        </div>
      )}

      {hasSelection && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearAll}
          data-testid={`${testIdPrefix}-clear-filter`}
          className="h-9 self-end"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
