import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapView } from "@/components/MapView";
import type { Facility, Village } from "@shared/schema";
import { offlineDb } from "../lib/offlineDb";
import { loadActiveTenant } from "../lib/tenantCache";

interface PublicTenant {
  id: string;
  code: string;
  name: string;
  countryCode?: string | null;
  settings?: {
    isDemo?: boolean;
    mapCenter?: [number, number];
    mapZoom?: number;
  };
}

interface MyTenant { id: string }

const FALLBACK_CENTER: [number, number] = [-6.0, 147.0];
const FALLBACK_ZOOM = 6;

export default function MapPage() {
  // Updated queries with offline fallbacks to Dexie local DB & optimal caching:
  const { data: activeTenantInfo } = useQuery<MyTenant>({
    queryKey: ["/api/me/tenant"],
    queryFn: async () => {
      if (!navigator.onLine) {
        const cached = localStorage.getItem("vaxplan_active_tenant");
        if (cached) return JSON.parse(cached);
        return { id: "default" };
      }
      const res = await fetch("/api/me/tenant");
      if (!res.ok) throw new Error("Failed to fetch tenant");
      const data = await res.json();
      localStorage.setItem("vaxplan_active_tenant", JSON.stringify(data));
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: tenants } = useQuery<PublicTenant[]>({
    queryKey: ["/api/public/tenants"],
    queryFn: async () => {
      if (!navigator.onLine) {
        const cached = localStorage.getItem("vaxplan_active_tenant");
        if (cached) return [JSON.parse(cached)];
        return [];
      }
      const res = await fetch("/api/public/tenants");
      if (!res.ok) throw new Error("Failed to fetch public tenants");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { data: facilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities", "tenant", activeTenantInfo?.id],
    queryFn: async () => {
      if (!navigator.onLine) {
        const _tid = loadActiveTenant()?.id;
        return (_tid
          ? offlineDb.facilities.where("tenantId").equals(_tid).toArray()
          : offlineDb.facilities.toArray()) as any;
      }
      const res = await fetch("/api/facilities", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch facilities");
      return res.json();
    },
    enabled: !!activeTenantInfo?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: villages } = useQuery<Village[]>({
    queryKey: ["/api/villages/summary", "tenant", activeTenantInfo?.id],
    queryFn: async () => {
      if (!navigator.onLine) {
        const _tid = loadActiveTenant()?.id;
        return (_tid
          ? offlineDb.villages.where("tenantId").equals(_tid).toArray()
          : offlineDb.villages.toArray()) as any;
      }
      const res = await fetch("/api/villages/summary", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch villages");
      return res.json();
    },
    enabled: !!activeTenantInfo?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const activeTenant = useMemo(
    () => tenants?.find((t) => t.id === activeTenantInfo?.id),
    [tenants, activeTenantInfo?.id]
  );
  const tenantCenter = activeTenant?.settings?.mapCenter;
  const tenantZoom = activeTenant?.settings?.mapZoom;

  const scopedFacilities = useMemo(
    () => (facilities ?? []).filter(
      (facility) => !facility.tenantId || facility.tenantId === activeTenantInfo?.id
    ),
    [facilities, activeTenantInfo?.id]
  );

  const scopedVillages = useMemo(
    () => (villages ?? []).filter(
      (village) => !village.tenantId || village.tenantId === activeTenantInfo?.id
    ),
    [villages, activeTenantInfo?.id]
  );

  const { center, zoom } = useMemo(() => {
    const facilityCoords = scopedFacilities.filter(
      (f) => f.latitude !== null && f.longitude !== null && !isNaN(Number(f.latitude)) && !isNaN(Number(f.longitude))
    );

    let calculatedCenter: [number, number] = tenantCenter ?? FALLBACK_CENTER;
    let calculatedZoom: number = tenantZoom ?? FALLBACK_ZOOM;

    if (!tenantCenter && facilityCoords.length > 0) {
      const avgLat =
        facilityCoords.reduce((s, f) => s + Number(f.latitude), 0) /
        facilityCoords.length;
      const avgLng =
        facilityCoords.reduce((s, f) => s + Number(f.longitude), 0) /
        facilityCoords.length;
      calculatedCenter = [avgLat, avgLng];
    }

    return { center: calculatedCenter, zoom: calculatedZoom };
  }, [scopedFacilities, tenantCenter, tenantZoom]);

  return (
    <div className="h-full">
      <MapView
        facilities={scopedFacilities}
        villages={scopedVillages}
        center={center}
        zoom={zoom}
        height="100%"
        showFacilityList={true}
      />
    </div>
  );
}

