import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, MapPin, Building2, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { loadActiveTenant } from "@/lib/tenantCache";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Province, District, Facility, Village } from "@shared/schema";

export interface VillageCascadePickerProps {
  value: number | null | undefined;
  onChange: (villageId: number | null, village: Village | null) => void;
  disabled?: boolean;
  required?: boolean;
  showLabels?: boolean;
  layout?: "row" | "stacked" | "grid";
  provinceLabel?: string;
  districtLabel?: string;
  facilityLabel?: string;
  villageLabel?: string;
  testIdPrefix?: string;
  className?: string;
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
 * Searchable cascading Province → District → [Facility (Optional)] → Village picker.
 *
 * - Solves the critical performance bottleneck where tens of thousands of villages
 *   were previously loaded in a single flat list.
 * - Zero eager village downloads: only fetches villages when a district is selected.
 * - Supports editing: auto-resolves parent hierarchy if an initial villageId is passed.
 */
export function VillageCascadePicker({
  value,
  onChange,
  disabled = false,
  required = false,
  showLabels = true,
  layout = "stacked",
  provinceLabel,
  districtLabel,
  facilityLabel = "Health Facility (Optional Filter)",
  villageLabel = "Village / Community",
  testIdPrefix = "village-cascade",
  className,
}: VillageCascadePickerProps) {
  const { data: tenantInfo } = useQuery<any>({
    queryKey: ["/api/me/tenant"],
  });

  const skipRegionLevel = tenantInfo?.settings?.skipRegionLevel ?? false;
  const rawAdminLabels = tenantInfo?.settings?.adminLevelLabels ?? {
    level1: "Region",
    level2: "Province",
    level3: "District",
    level4: "Constituency",
    level5: "Ward",
  };
  const adminLabels = skipRegionLevel
    ? {
        level1: rawAdminLabels.level2 || "Province",
        level2: rawAdminLabels.level3 || "District",
        level3: rawAdminLabels.level4 || "Constituency",
        level4: rawAdminLabels.level5 || "Ward",
        level5: "Village",
      }
    : rawAdminLabels;

  const resolvedProvLabel = provinceLabel || (skipRegionLevel ? adminLabels.level1 : "Province");
  const resolvedDistLabel = districtLabel || (skipRegionLevel ? adminLabels.level2 : "District");

  const cachedActiveTenant = loadActiveTenant();
  const activeTenantId = tenantInfo?.id || tenantInfo?.activeTenant?.id || cachedActiveTenant?.id;

  // Reset cascade selections if tenant switches
  const prevTenantIdRef = useRef(activeTenantId);
  useEffect(() => {
    if (prevTenantIdRef.current && prevTenantIdRef.current !== activeTenantId) {
      setProvinceId(null);
      setDistrictId(null);
      setFacilityId(null);
      onChange(null, null);
    }
    prevTenantIdRef.current = activeTenantId;
  }, [activeTenantId, onChange]);

  // 1. Fetch Provinces
  const { data: provinces } = useQuery<Province[]>({
    queryKey: ["/api/provinces", activeTenantId],
    queryFn: () => fetchJson<Province[]>("/api/provinces", activeTenantId),
    enabled: !!activeTenantId,
  });

  // 2. Fetch Districts
  const { data: districts } = useQuery<District[]>({
    queryKey: ["/api/districts", activeTenantId],
    queryFn: () => fetchJson<District[]>("/api/districts", activeTenantId),
    enabled: !!activeTenantId,
  });

  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [facilityId, setFacilityId] = useState<number | null>(null);

  const [provOpen, setProvOpen] = useState(false);
  const [distOpen, setDistOpen] = useState(false);
  const [facOpen, setFacOpen] = useState(false);
  const [vilOpen, setVilOpen] = useState(false);

  // 3. Fetch Facilities for selected district (only when districtId is selected)
  const { data: facilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities", activeTenantId, districtId],
    queryFn: () =>
      fetchJson<Facility[]>(
        districtId ? `/api/facilities?districtId=${districtId}` : "/api/facilities",
        activeTenantId,
      ),
    enabled: !!activeTenantId && !!districtId,
  });

  // 4. Fetch Villages ONLY for selected district (or facility)
  const { data: villages, isLoading: isLoadingVillages } = useQuery<Village[]>({
    queryKey: ["/api/villages", activeTenantId, districtId, facilityId],
    queryFn: () => {
      let url = `/api/villages?districtId=${districtId}`;
      if (facilityId) {
        url += `&facilityId=${facilityId}`;
      }
      return fetchJson<Village[]>(url, activeTenantId);
    },
    enabled: !!activeTenantId && !!districtId,
  });

  // 5. Pre-resolve hierarchy when an initial `value` (villageId) is provided
  useEffect(() => {
    if (!value) return;
    let isMounted = true;

    async function resolveVillageHierarchy() {
      try {
        const v = await fetchJson<Village>(`/api/villages/${value}`, activeTenantId);
        if (!isMounted || !v) return;

        if (v.districtId) {
          setDistrictId(Number(v.districtId));
        }
        if (v.assignedFacilityId) {
          setFacilityId(Number(v.assignedFacilityId));
        }

        // Derive province from district
        if (v.districtId && districts) {
          const d = districts.find((item) => Number(item.id) === Number(v.districtId));
          if (d && (d as any).provinceId) {
            setProvinceId(Number((d as any).provinceId));
          }
        }
      } catch (err) {
        console.warn("Failed to resolve village hierarchy for id", value, err);
      }
    }

    resolveVillageHierarchy();
    return () => {
      isMounted = false;
    };
  }, [value, activeTenantId, districts]);

  const sortedProvinces = useMemo(
    () => [...(provinces ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [provinces],
  );

  const filteredDistricts = useMemo(() => {
    if (!provinceId) return [];
    return (districts ?? [])
      .filter((d) => Number((d as any).provinceId) === Number(provinceId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [districts, provinceId]);

  const sortedFacilities = useMemo(() => {
    return [...(facilities ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [facilities]);

  const sortedVillages = useMemo(() => {
    return [...(villages ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [villages]);

  const selectedProvince = useMemo(
    () => provinces?.find((p) => Number(p.id) === Number(provinceId)) ?? null,
    [provinces, provinceId],
  );

  const selectedDistrict = useMemo(
    () => districts?.find((d) => Number(d.id) === Number(districtId)) ?? null,
    [districts, districtId],
  );

  const selectedFacility = useMemo(
    () => facilities?.find((f) => Number(f.id) === Number(facilityId)) ?? null,
    [facilities, facilityId],
  );

  const selectedVillage = useMemo(
    () => villages?.find((v) => Number(v.id) === Number(value)) ?? null,
    [villages, value],
  );

  const handleProvinceSelect = (newProvId: number) => {
    if (newProvId === provinceId) {
      setProvOpen(false);
      return;
    }
    setProvinceId(newProvId);
    setDistrictId(null);
    setFacilityId(null);
    onChange(null, null);
    setProvOpen(false);
    setDistOpen(true);
  };

  const handleDistrictSelect = (newDistId: number) => {
    if (newDistId === districtId) {
      setDistOpen(false);
      return;
    }
    setDistrictId(newDistId);
    setFacilityId(null);
    onChange(null, null);
    setDistOpen(false);
    setVilOpen(true);
  };

  const handleFacilitySelect = (newFacId: number | null) => {
    setFacilityId(newFacId);
    onChange(null, null);
    setFacOpen(false);
    setVilOpen(true);
  };

  const handleVillageSelect = (newVilId: number) => {
    const v = villages?.find((item) => Number(item.id) === Number(newVilId)) ?? null;
    onChange(newVilId, v);
    setVilOpen(false);
  };

  const isRow = layout === "row";
  const isGrid = layout === "grid";

  return (
    <div
      className={cn(
        "w-full space-y-3",
        isRow ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 space-y-0" : "",
        isGrid ? "grid grid-cols-1 md:grid-cols-2 gap-3 space-y-0" : "",
        className,
      )}
    >
      {/* ── 1. PROVINCE ──────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        {showLabels && (
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {resolvedProvLabel} {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        <Popover open={provOpen} onOpenChange={setProvOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={provOpen}
              disabled={disabled}
              data-testid={`${testIdPrefix}-province-trigger`}
              className="w-full justify-between font-normal text-left truncate"
            >
              <span className="truncate">
                {selectedProvince ? selectedProvince.name : `Select ${resolvedProvLabel.toLowerCase()}...`}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder={`Search ${resolvedProvLabel.toLowerCase()}...`} />
              <CommandList>
                <CommandEmpty>No {resolvedProvLabel.toLowerCase()} found.</CommandEmpty>
                <CommandGroup>
                  {sortedProvinces.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.name}
                      onSelect={() => handleProvinceSelect(Number(p.id))}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          Number(provinceId) === Number(p.id) ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {p.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── 2. DISTRICT ──────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        {showLabels && (
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {resolvedDistLabel} {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        <Popover open={distOpen} onOpenChange={setDistOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={distOpen}
              disabled={disabled || !provinceId}
              data-testid={`${testIdPrefix}-district-trigger`}
              className="w-full justify-between font-normal text-left truncate"
            >
              <span className="truncate">
                {selectedDistrict
                  ? selectedDistrict.name
                  : !provinceId
                    ? `Select ${resolvedProvLabel.toLowerCase()} first`
                    : `Select ${resolvedDistLabel.toLowerCase()}...`}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder={`Search ${resolvedDistLabel.toLowerCase()}...`} />
              <CommandList>
                <CommandEmpty>No {resolvedDistLabel.toLowerCase()} found.</CommandEmpty>
                <CommandGroup>
                  {filteredDistricts.map((d) => (
                    <CommandItem
                      key={d.id}
                      value={d.name}
                      onSelect={() => handleDistrictSelect(Number(d.id))}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          Number(districtId) === Number(d.id) ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {d.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── 3. FACILITY (OPTIONAL FILTER) ────────────────────────────── */}
      <div className="space-y-1.5">
        {showLabels && (
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {facilityLabel}
          </Label>
        )}
        <Popover open={facOpen} onOpenChange={setFacOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={facOpen}
              disabled={disabled || !districtId}
              data-testid={`${testIdPrefix}-facility-trigger`}
              className="w-full justify-between font-normal text-left truncate"
            >
              <span className="truncate">
                {selectedFacility
                  ? selectedFacility.name
                  : !districtId
                    ? "Select district first"
                    : "All facilities in district"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search facilities..." />
              <CommandList>
                <CommandEmpty>No facilities found in this district.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all-facilities-option"
                    onSelect={() => handleFacilitySelect(null)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        facilityId === null ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="font-medium text-primary">All facilities in district</span>
                  </CommandItem>
                  {sortedFacilities.map((f) => (
                    <CommandItem
                      key={f.id}
                      value={f.name}
                      onSelect={() => handleFacilitySelect(Number(f.id))}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          Number(facilityId) === Number(f.id) ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {f.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── 4. VILLAGE / COMMUNITY ───────────────────────────────────── */}
      <div className="space-y-1.5">
        {showLabels && (
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Home className="h-3.5 w-3.5" />
            {villageLabel} {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        <Popover open={vilOpen} onOpenChange={setVilOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={vilOpen}
              disabled={disabled || !districtId}
              data-testid={`${testIdPrefix}-village-trigger`}
              className={cn(
                "w-full justify-between font-normal text-left truncate",
                !value && "text-muted-foreground",
              )}
            >
              <span className="truncate">
                {isLoadingVillages
                  ? "Loading villages..."
                  : selectedVillage
                    ? selectedVillage.name
                    : !districtId
                      ? `Select ${resolvedDistLabel.toLowerCase()} first`
                      : sortedVillages.length === 0
                        ? "No villages registered in this district"
                        : `Select village (${sortedVillages.length} available)...`}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search village by name..." />
              <CommandList>
                <CommandEmpty>
                  {isLoadingVillages ? "Fetching villages..." : "No village found."}
                </CommandEmpty>
                <CommandGroup heading={`Villages in ${selectedDistrict?.name || "District"}`}>
                  {sortedVillages.map((v) => (
                    <CommandItem
                      key={v.id}
                      value={`${v.name} ${v.code || ""}`}
                      onSelect={() => handleVillageSelect(Number(v.id))}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          Number(value) === Number(v.id) ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{v.name}</span>
                        {v.code && (
                          <span className="text-[11px] text-muted-foreground">Code: {v.code}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
