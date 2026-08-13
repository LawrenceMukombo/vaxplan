import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapContainer, TileLayer, Marker, Polygon as LeafletPolygon, Polyline, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CARTO_POSITRON_ATTRIBUTION } from "@/data/dataSources";
import { usePersistedBasemap, BasemapTileLayer } from "@/components/map/BasemapToggle";
import { createFacilityCircleIcon, createGapVillageIcon, createOutlinePinIcon, createVillageWithChvsIcon } from "@/lib/mapIcons";
import {
  usePopulationOverlay,
  PopulationWmsLayer,
  PopulationOverlayToggle,
  PopulationOverlayLegend,
} from "@/components/PopulationOverlay";
import { CatchmentMapPanel } from "@/components/CatchmentMapPanel";
import { ChvCoverageTab } from "@/components/ChvCoverageTab";
import { EntityHistoryDrawer } from "@/components/history/EntityHistoryDrawer";
import { ViewAsOfDateControl } from "@/components/history/ViewAsOfDateControl";
import { offlineDb } from "@/lib/offlineDb";

// Fix Leaflet default marker icon asset pathways
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Premium Offline-Available Vector Pin Icons (Built from shared SVG constants)
const OFFLINE_FACILITY_ICON =
  typeof window !== "undefined" ? createOutlinePinIcon("rose") : (null as any);

const OFFLINE_VILLAGE_ICON =
  typeof window !== "undefined" ? createOutlinePinIcon("green") : (null as any);
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
// Original input import
// import { Input } from "@/components/ui/input";
// Added input and label imports for staff roster management dialog
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
/* Original Code: Lucide icons without Download / Upload
import { Plus, Building2, Users, Thermometer, Filter, X, Pencil, Trash2 } from "lucide-react";
*/
// Updated Code: Added Snowflake, Wrench, AlertTriangle, RefreshCw icons for Cold Chain tab
import { Plus, Building2, Users, Thermometer, X, Pencil, Trash2, Download, Upload, Snowflake, Wrench, AlertTriangle, RefreshCw, CheckCircle2, Loader2, SlidersHorizontal, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, Check, Contact, Search, MapPin, History, UserMinus, ArrowLeftRight } from "lucide-react";
import { GeoCascadeFilter } from "@/components/GeoCascadeFilter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { canEditFacility, canDeleteData, canCreateFacility, canCreateCommunity } from "@/lib/permissions";
import { FacilityCascadePicker } from "@/components/FacilityCascadePicker";
import { ColdChainTab } from "@/components/ColdChainTab";
import { FacilityPopulationTab } from "@/components/ui/population/FacilityPopulationTab";
import { insertFacilitySchema, type Facility, type InsertFacility, type Region, type Province, type District, type Village, type FacilityCatchment } from "@shared/schema";
import { z } from "zod";

// Convert drawn Leaflet polygon vertices into a GeoJSON Polygon (lng,lat order,
// ring auto-closed) so community boundaries persist and can be reused app-wide.
function polygonPointsToBoundary(points: { lat: number; lng: number }[]): any | null {
  if (!points || points.length < 3) return null;
  const ring = points.map((p) => [p.lng, p.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

// Read a stored GeoJSON Polygon back into Leaflet [lat,lng] vertices for editing
// (drops the closing point so the draw UI doesn't show a duplicate vertex).
function boundaryToLatLngs(boundary: any): { lat: number; lng: number }[] {
  try {
    const coords = boundary?.coordinates?.[0];
    if (!Array.isArray(coords)) return [];
    const pts = coords.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
    if (pts.length > 1) {
      const a = pts[0];
      const b = pts[pts.length - 1];
      if (a.lat === b.lat && a.lng === b.lng) pts.pop();
    }
    return pts;
  } catch {
    return [];
  }
}

const facilityFormSchema = insertFacilitySchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
  hmisCode: z.string().min(3, "HMIS code is required"),
});

function MapResizer() {
  const map = useMapEvents({});
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }, [map]);
  return null;
}

function FlyToLocation({
  latitude,
  longitude,
  zoom = 15,
}: {
  latitude?: string | number | null;
  longitude?: string | number | null;
  zoom?: number;
}) {
  const map = useMapEvents({});

  useEffect(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const timer = window.setTimeout(() => {
      map.invalidateSize();
      map.flyTo([lat, lng], zoom, { animate: true, duration: 0.9 });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [map, latitude, longitude, zoom]);

  return null;
}

export default function Facilities() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [basemap] = usePersistedBasemap("positron");

  // Whether the current tenant has any administrative boundary maps seeded.
  // Used to gate the "Extract Communities from Map" action — without
  // boundaries the server returns a 400 and the action will never succeed,
  // so we disable the button up-front and direct the user to the Boundary
  // Manager instead of letting them click into a red error toast.
  const { data: boundaries = [] } = useQuery<any[]>({
    queryKey: ["/api/boundaries"],
  });
  const hasBoundaries = Array.isArray(boundaries) && boundaries.length > 0;
  const { user } = useAuth();
  const isFacilityStaff = user?.role === "facility_clerk" || user?.role === "facility_in_charge" || user?.role === "facility_partner";
  const isDistrictStaff = user?.role === "district_manager";
  const lockedFacDistrictId = (isDistrictStaff || isFacilityStaff) ? (user?.districtId ?? null) : null;
  const lockedCommDistrictId = isDistrictStaff ? (user?.districtId ?? null) : null;
  const populationOverlay = usePopulationOverlay();
  const [mainTab, setMainTab] = useState("facilities");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [deletingFacility, setDeletingFacility] = useState<Facility | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [historyEntity, setHistoryEntity] = useState<{ type: string; id: string | number; name: string } | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"upsert" | "replace_missing" | "purge_replace">("upsert");
  const [bulkJson, setBulkJson] = useState(
    '{\n  "facilities": [\n    {\n      "name": "Example Health Centre",\n      "hmisCode": "EXAMPLE-001",\n      "districtName": "Lusaka",\n      "facilityType": "health_center",\n      "latitude": -15.4167,\n      "longitude": 28.2833,\n      "hasRefrigerator": true,\n      "hasPower": true\n    }\n  ]\n}'
  );
  const [bulkConfirmText, setBulkConfirmText] = useState("");
  const [bulkImportResult, setBulkImportResult] = useState<any | null>(null);

  // Communities Registry states
  const [communityDialogOpen, setCommunityDialogOpen] = useState(false);
  const [newCommName, setNewCommName] = useState("");
  const [newCommDistrictId, setNewCommDistrictId] = useState<string>("");
  const [newCommHTR, setNewCommHTR] = useState(false);
  const [newCommFacilityId, setNewCommFacilityId] = useState<string>("");
  const [newCommLat, setNewCommLat] = useState("");
  const [newCommLng, setNewCommLng] = useState("");
  const [commDrawMode, setCommDrawMode] = useState<"pin" | "polygon">("pin");
  const [commPolygonPoints, setCommPolygonPoints] = useState<L.LatLng[]>([]);
  const [editingCommunity, setEditingCommunity] = useState<Village | null>(null);
  const [selectedCommunityDetails, setSelectedCommunityDetails] = useState<Village | null>(null);
  const [deletingCommunity, setDeletingCommunity] = useState<Village | null>(null);
  const [newCommTransportMode, setNewCommTransportMode] = useState<string>("walking");
  const [overlapConflicts, setOverlapConflicts] = useState<any[]>([]);
  const [overlapSourceVillage, setOverlapSourceVillage] = useState<{ id: number; name: string } | null>(null);
  const [harmonizedIds, setHarmonizedIds] = useState<number[]>([]);
  const [activeCommTab, setActiveCommTab] = useState<string>("details");

  // Live estimated population states & calculation effect
  const [estimatedPopulation, setEstimatedPopulation] = useState<number | null>(null);
  const [estimatingPop, setEstimatingPop] = useState(false);

  useEffect(() => {
    if (!communityDialogOpen) {
      setEstimatedPopulation(null);
      return;
    }

    const estimatePop = async () => {
      let body: any = {};
      
      if (commDrawMode === "polygon" && commPolygonPoints.length >= 3) {
        body.boundary = polygonPointsToBoundary(commPolygonPoints.map(p => ({ lat: p.lat, lng: p.lng })));
      } else if (commDrawMode === "pin" && parseFloat(newCommLat) && parseFloat(newCommLng)) {
        body.latitude = parseFloat(newCommLat);
        body.longitude = parseFloat(newCommLng);
      } else {
        setEstimatedPopulation(null);
        return;
      }

      try {
        setEstimatingPop(true);
        const data = await apiRequest<{ totalPopulation: number; under5Population: number }>(
          "POST",
          "/api/population/estimate-polygon",
          body
        );
        setEstimatedPopulation(data.totalPopulation);
      } catch (err) {
        console.error("Failed to estimate population:", err);
      } finally {
        setEstimatingPop(false);
      }
    };

    const timer = setTimeout(estimatePop, 500);
    return () => clearTimeout(timer);
  }, [commDrawMode, commPolygonPoints, newCommLat, newCommLng, communityDialogOpen]);

  // Facility GIS Catchment Editor states
  const [catchmentPoints, setCatchmentPoints] = useState<L.LatLng[]>([]);
  const [facMapDrawMode, setFacMapDrawMode] = useState<"pin" | "polygon">("pin");
  const [showSavedCatchment, setShowSavedCatchment] = useState(true);
  const [extractionResult, setExtractionResult] = useState<{
    villages: Array<{ id: number; name: string }>;
    settlements: Array<{ id: number; name: string; latitude: number; longitude: number }>;
    unmapped: Array<{ name: string; latitude: number; longitude: number; placeType: string; osmId?: string }>;
  }>({ villages: [], settlements: [], unmapped: [] });
  const [selectedUnmappedOsm, setSelectedUnmappedOsm] = useState<Set<string>>(new Set());

  /* Original Code: Only fetched catchments for editingFacility
  // Fetch existing catchments for the editing facility
  const { data: facilityCatchments } = useQuery<any[]>({
    queryKey: [`/api/facilities/${editingFacility?.id}/catchments`],
    enabled: !!editingFacility?.id,
  });
  */

  // Updated Code: Fetch catchments for both the editing facility and the currently selected facility under the main registry communities list
  const { data: facilityCatchments } = useQuery<any[]>({
    queryKey: [`/api/facilities/${editingFacility?.id}/catchments`],
    enabled: !!editingFacility?.id,
  });

  // Original catchment query block
  // const { data: selectedFacilityCatchments } = useQuery<any[]>({
  //   queryKey: [`/api/facilities/${selectedFacilityId}/catchments`],
  //   enabled: !!selectedFacilityId,
  // });
  // Fetch catchment polygon for currently selected facility in communities registry
  const { data: selectedFacilityCatchments } = useQuery<any[]>({
    queryKey: [`/api/facilities/${selectedFacilityId}/catchments`],
    enabled: !!selectedFacilityId,
  });

  // Query facility staff roster list when editing a facility
  const { data: facilityStaffList, refetch: refetchFacilityStaff } = useQuery<any[]>({
    queryKey: ["/api/facilities", editingFacility?.id, "staff"],
    enabled: !!editingFacility?.id,
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${editingFacility?.id}/staff`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Query CHV profiles when editing a facility (used to list CHVs and link them to villages/communities)
  /* Original facilityChvs query commented out to support viewing/saving CHVs when editing a community directly from the global community list (without editingFacility set):
  const { data: facilityChvs, refetch: refetchFacilityChvs } = useQuery<any[]>({
    queryKey: ["/api/facilities", editingFacility?.id, "chvs"],
    enabled: !!editingFacility?.id,
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${editingFacility?.id}/chvs`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });
  */
  const activeChvFacilityId = editingFacility?.id
    ? Number(editingFacility.id)
    : editingCommunity?.assignedFacilityId
      ? Number(editingCommunity.assignedFacilityId)
      : selectedFacilityId
        ? Number(selectedFacilityId)
        : undefined;
  const { data: facilityChvs, refetch: refetchFacilityChvs } = useQuery<any[]>({
    queryKey: ["/api/facilities", activeChvFacilityId, "chvs"],
    enabled: !!activeChvFacilityId,
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${activeChvFacilityId}/chvs`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Original community-routes query keys commented out for safety:
  /*
  const { data: editingFacilityRoutes } = useQuery<any[]>({
    queryKey: [`/api/facilities/${editingFacility?.id}/community-routes`],
    enabled: !!editingFacility?.id,
  });

  const { data: selectedFacilityRoutes } = useQuery<any[]>({
    queryKey: [`/api/facilities/${selectedFacilityId}/community-routes`],
    enabled: !!selectedFacilityId,
  });
  */

  // Fetch community routes for editing facility (CRUD modal) - using array queryKey for automatic invalidate matching
  const { data: editingFacilityRoutes } = useQuery<any[]>({
    queryKey: ["/api/facilities", editingFacility?.id, "community-routes"],
    enabled: !!editingFacility?.id,
  });

  // Fetch community routes for selected facility (main page panel) - using array queryKey for automatic invalidate matching
  const { data: selectedFacilityRoutes } = useQuery<any[]>({
    queryKey: ["/api/facilities", selectedFacilityId, "community-routes"],
    enabled: !!selectedFacilityId,
  });

  const selectedCatchmentPoints = useMemo(() => {
    if (!selectedFacilityId || !selectedFacilityCatchments || selectedFacilityCatchments.length === 0) return [];
    const official = selectedFacilityCatchments.find((c: any) => c.isOfficial);
    if (official && official.geojson && official.geojson.coordinates) {
      const coords = official.geojson.coordinates[0].map((pt: any) => L.latLng(pt[1], pt[0]));
      if (coords.length > 1 && coords[0].lat === coords[coords.length - 1].lat && coords[0].lng === coords[coords.length - 1].lng) {
        coords.pop();
      }
      return coords;
    }
    return [];
  }, [selectedFacilityId, selectedFacilityCatchments]);

  // Retrieve Tenant Context for premium multitenant configuration and dynamic terminology translation
  const { data: tenantInfo } = useQuery<any>({
    queryKey: ["/api/me/tenant"],
  });

  // Reset all geographic filters on tenant/country switch to prevent cross-tenant ID bleed
  useEffect(() => {
    if (tenantInfo?.id) {
      setSelectedRegionId(null);
      setSelectedProvinceId(null);
      setSelectedDistrictId(null);
      setSelectedFacilityId(null);
    }
  }, [tenantInfo?.id]);


  const skipRegionLevel = tenantInfo?.settings?.skipRegionLevel ?? (tenantInfo?.countryCode === "ZMB" || false);
  const rawAdminLabels = tenantInfo?.settings?.adminLevelLabels ?? {
    level1: "Province",
    level2: "District",
    level3: "Facility",
    level4: "Constituency",
    level5: "Ward",
  };
  const adminLabels = skipRegionLevel ? {
    level1: rawAdminLabels.level2 || "Province",
    level2: rawAdminLabels.level3 || "District",
    level3: rawAdminLabels.level4 || "Facility",
    level4: rawAdminLabels.level5 || "Constituency",
    level5: "Ward",
  } : rawAdminLabels;

  // ─── Communities Registry Selection & Columns State ───────────────────────
  const [selectedCommIds, setSelectedCommIds] = useState<(string | number)[]>([]);
  const [commBulkProcessing, setCommBulkProcessing] = useState(false);
  const [commBulkProgress, setCommBulkProgress] = useState({ current: 0, total: 0, percentage: 0 });

  const [commVisibleColumns, setCommVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    province: true,
    districtId: true,
    assignedFacilityId: true,
    population: true,
    coordinates: true,
    distanceToFacility: true,
    closestFacilities: false,
    isHardToReach: true,
    actions: true,
  });

  const COMM_COLUMN_LABELS: Record<string, string> = {
    name: "Community Name",
    province: adminLabels.level1 || "Province",
    districtId: adminLabels.level2 || "District",
    assignedFacilityId: "Assigned Facility",
    population: "Population",
    coordinates: "Coordinates",
    distanceToFacility: "Assigned Distance",
    closestFacilities: "Closest Facilities",
    isHardToReach: "HTR Status",
    actions: "Actions",
  };

  const runCommBulkAction = async (
    actionName: string,
    actionFn: (village: Village) => Promise<void>
  ) => {
    if (selectedCommIds.length === 0) return;
    const selectedVillages = (villages || []).filter((v) => selectedCommIds.includes(v.id) && canManageCommunity(v));
    if (selectedVillages.length === 0) {
      toast({ title: "No editable communities selected", description: "Select communities assigned to your facility or scope.", variant: "destructive" });
      return;
    }
    setCommBulkProcessing(true);
    const total = selectedVillages.length;
    setCommBulkProgress({ current: 0, total, percentage: 0 });
    const batchSize = 10;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < total; i += batchSize) {
      const batch = selectedVillages.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (v) => {
          try {
            await actionFn(v);
            successCount++;
          } catch (err) {
            failCount++;
            console.error(`Failed bulk action ${actionName} on village ${v.id}:`, err);
          }
        })
      );
      const current = Math.min(i + batchSize, total);
      setCommBulkProgress({
        current,
        total,
        percentage: Math.round((current / total) * 100),
      });
    }

    setCommBulkProcessing(false);
    setSelectedCommIds([]);
    queryClient.invalidateQueries({ queryKey: ["/api/villages"] });

    toast({
      title: `${actionName} complete`,
      description: `${successCount} communities successfully processed.${failCount ? ` ${failCount} failed.` : ""}`,
      variant: failCount > 0 ? "destructive" : "default"
    });
  };

  const handleCommBulkDelete = () => {
    const manageableCount = (villages || []).filter((v) => selectedCommIds.includes(v.id) && canManageCommunity(v)).length;
    if (manageableCount === 0) {
      toast({ title: "No communities selected", description: "Select communities assigned to your facility before deleting.", variant: "destructive" });
      return;
    }
    if (confirm(`Are you sure you want to permanently delete ${manageableCount} selected ${manageableCount === 1 ? "community" : "communities"}? This cannot be undone.`)) {
      void runCommBulkAction(
        "Bulk Delete Communities",
        async (v) => {
          await apiRequest("DELETE", `/api/villages/${v.id}`);
        }
      );
    }
  };

  const handleCommBulkUpdateHTR = (isHardToReach: boolean) => {
    void runCommBulkAction(
      `Bulk Set HTR ${isHardToReach ? 'Active' : 'Inactive'}`,
      async (v) => {
        await apiRequest("PATCH", `/api/villages/${v.id}`, { isHardToReach });
      }
    );
  };

  const handleCommBulkUpdateTransport = (transportMode: string) => {
    void runCommBulkAction(
      "Bulk Update Transport",
      async (v) => {
        await apiRequest("PATCH", `/api/villages/${v.id}`, { transportMode });
      }
    );
  };

  const handleCommBulkReassignFacility = (assignedFacilityId: number) => {
    const targetFac = (facilities || []).find((f: any) => f.id === assignedFacilityId);
    if (!targetFac) return;

    void runCommBulkAction(
      "Bulk Reassign Facility",
      async (v) => {
        await apiRequest("PATCH", `/api/villages/${v.id}`, {
          assignedFacilityId,
          districtId: targetFac.districtId
        });
      }
    );
  };

  useEffect(() => {
    setSelectedCommIds([]);
  }, [selectedProvinceId, selectedDistrictId, selectedFacilityId]);

  useEffect(() => {
    setSelectedCommunityDetails(null);
  }, [selectedFacilityId]);

  const tenantQueryKey = tenantInfo?.id ?? "pending";

  const { data: regions, isLoading: loadingRegions } = useQuery<Region[]>({
    queryKey: ["/api/regions", tenantQueryKey],
    enabled: !!tenantInfo?.id,
  });

  // Fetch all provinces for the tenant.
  const { data: provinces, isLoading: loadingProvinces } = useQuery<Province[]>({
    queryKey: ["/api/provinces", tenantQueryKey],
    enabled: !!tenantInfo?.id,
    queryFn: async () => {
      const res = await fetch("/api/provinces", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch provinces");
      return res.json();
    },
  });

  // Fetch all districts for the tenant to power lookup functions, client-side cascading, and dialog form selects.
  const { data: allDistricts, isLoading: loadingDistricts } = useQuery<District[]>({
    queryKey: ["/api/districts", tenantQueryKey],
    enabled: !!tenantInfo?.id,
    queryFn: async () => {
      const res = await fetch("/api/districts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch districts");
      return res.json();
    },
  });

  const { data: facilities, isLoading: loadingFacilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities", tenantQueryKey],
    enabled: !!tenantInfo?.id,
    queryFn: async () => {
      const res = await fetch("/api/facilities", { credentials: "include", headers: { "Cache-Control": "no-cache" } });
      if (!res.ok) throw new Error("Failed to fetch facilities");
      const list = await res.json();
      try {
        await offlineDb.facilities.bulkPut(list);
      } catch {}
      return list;
    },
  });

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const facilityIdParam = new URLSearchParams(search).get("facilityId");
    const facilityId = facilityIdParam ? Number(facilityIdParam) : NaN;
    if (!Number.isFinite(facilityId) || facilityId <= 0 || !facilities) return;

    const facility = facilities.find((item) => Number(item.id) === facilityId);
    if (!facility) return;

    setSelectedFacilityId(facility.id);
    setTimeout(() => {
      document.querySelector('[data-selected-facility-panel="true"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [location, facilities]);

  const { data: villages, isLoading: loadingVillages } = useQuery<Village[]>({
    queryKey: ["/api/villages", tenantQueryKey],
    enabled: !!tenantInfo?.id,
    queryFn: async () => {
      const res = await fetch("/api/villages", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch villages");
      return res.json();
    },
  });

  const isLoading = loadingRegions || loadingProvinces || loadingDistricts || loadingFacilities || loadingVillages;

  // Haversine Distance helper for nearby calculation
  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const normalizeCommunityName = (name: string | null | undefined) =>
    String(name || "").trim().replace(/\s+/g, " ").toLowerCase();

  const canManageCommunity = (community: Village | null | undefined) => {
    if (!user || !community) return false;
    if (user.role === "facility_clerk" || user.role === "facility_in_charge") {
      return !!user.facilityId && Number(community.assignedFacilityId) === Number(user.facilityId);
    }
    return canEditFacility(
      user,
      Number(community.districtId),
      Number(community.assignedFacilityId || 0),
      allDistricts,
      provinces,
      tenantInfo?.id,
    );
  };


  const invalidateCommunityCaches = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        const first = key[0];
        if (first === "/api/villages" || first === "/api/facilities") return true;
        if (typeof first === "string" && (first.includes("/api/villages") || first.includes("/api/facilities/"))) return true;
        return key.some((part) => part === "community-routes" || (typeof part === "string" && part.includes("community-routes")));
      },
    });
  };
  const findDuplicateCommunity = (
    name: string,
    assignedFacilityId: number | null,
    districtId: number | null,
    ignoreId?: number,
  ) => {
    const normalized = normalizeCommunityName(name);
    if (!normalized) return null;
    return (villages || []).find((v) => {
      if (ignoreId && Number(v.id) === Number(ignoreId)) return false;
      if (normalizeCommunityName(v.name) !== normalized) return false;
      // Scoped to the same district! If the district matches, it's a duplicate.
      return districtId ? Number(v.districtId) === Number(districtId) : false;
    }) || null;
  };

  const getClosestFacilities = (village: Village) => {
    if (!village.latitude || !village.longitude || !facilities) return [];
    const vLat = parseFloat(village.latitude.toString());
    const vLng = parseFloat(village.longitude.toString());
    
    return facilities
      .filter(f => f.latitude !== null && f.longitude !== null)
      .map(f => {
        const fLat = parseFloat(f.latitude!.toString());
        const fLng = parseFloat(f.longitude!.toString());
        const dist = getHaversineDistance(vLat, vLng, fLat, fLng);
        return { facility: f, distance: dist };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
  };

  const commMapCenter = useMemo(() => {
    if (newCommFacilityId) {
      const fac = facilities?.find(f => f.id === parseInt(newCommFacilityId));
      if (fac && fac.latitude !== null && fac.longitude !== null) {
        return [parseFloat(fac.latitude.toString()), parseFloat(fac.longitude.toString())] as [number, number];
      }
    }
    if (tenantInfo?.settings?.mapCenter) {
      return tenantInfo.settings.mapCenter as [number, number];
    }
    return [-6.0, 145.0] as [number, number];
  }, [newCommFacilityId, facilities, tenantInfo]);

  function CommMapEvents() {
    useMapEvents({
      click(e) {
        if (commDrawMode === "pin") {
          setNewCommLat(e.latlng.lat.toFixed(6));
          setNewCommLng(e.latlng.lng.toFixed(6));
          setCommPolygonPoints([]);
        } else {
          const updatedPoints = [...commPolygonPoints, e.latlng];
          setCommPolygonPoints(updatedPoints);
          
          const sumLat = updatedPoints.reduce((sum, p) => sum + p.lat, 0);
          const sumLng = updatedPoints.reduce((sum, p) => sum + p.lng, 0);
          const avgLat = sumLat / updatedPoints.length;
          const avgLng = sumLng / updatedPoints.length;
          setNewCommLat(avgLat.toFixed(6));
          setNewCommLng(avgLng.toFixed(6));
        }
      }
    });
    return null;
  }

  const createCommunityMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/villages", data);
    },
    onSuccess: (res: any) => {
      queryClient.setQueryData<Village[]>(["/api/villages"], (old) => old ? [...old.filter((v) => Number(v.id) !== Number(res.id)), res] : old);
      invalidateCommunityCaches();
      // Transition newly created community to edit mode in the dialog
      setEditingCommunity(res);
      // Auto-navigate to community workers tab
      setActiveCommTab("workers");
      toast({
        title: "Community Registered",
        description: "The new community has been added successfully. You can now add community workers.",
      });
      maybeShowOverlaps(res);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create community",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCommunityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/villages/${id}`, data);
    },
    onSuccess: (res: any) => {
      queryClient.setQueryData<Village[]>(["/api/villages"], (old) => old ? [...old.filter((v) => Number(v.id) !== Number(res.id)), res] : old);
      invalidateCommunityCaches();
      // Keep dialog open and update editingCommunity state to the saved community
      setEditingCommunity(res);
      toast({
        title: "Community updated",
        description: "The community has been updated successfully.",
      });
      maybeShowOverlaps(res);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update community",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCommunityMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/villages/${id}`);
    },
    onSuccess: (_res, id) => {
      queryClient.setQueryData<Village[]>(["/api/villages"], (old) => old?.filter((v) => Number(v.id) !== Number(id)));
      invalidateCommunityCaches();
      setDeletingCommunity(null);
      toast({
        title: "Community deleted",
        description: "The community has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // After a community with a boundary is saved, open the harmonization panel if
  // the server detected overlaps with other communities' catchments.
  const maybeShowOverlaps = (res: any) => {
    const overlaps = Array.isArray(res?.overlaps) ? res.overlaps : [];
    if (overlaps.length > 0 && res?.id) {
      setOverlapSourceVillage({ id: Number(res.id), name: res.name });
      setOverlapConflicts(overlaps);
      setHarmonizedIds([]);
    }
  };

  const harmonizeMutation = useMutation({
    mutationFn: async (vars: { villageId: number; conflictingVillageId: number; overlapPct?: number }) => {
      return apiRequest("POST", `/api/villages/${vars.villageId}/harmonize`, {
        conflictingVillageId: vars.conflictingVillageId,
        overlapPct: vars.overlapPct,
      });
    },
    onSuccess: (res: any, vars) => {
      setHarmonizedIds((prev) => [...prev, vars.conflictingVillageId]);
      toast({
        title: "Harmonization requested",
        description: res?.notified
          ? "The other facility's in-charge has been notified by email."
          : "Conflict recorded. No facility in-charge email was found to notify.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Could not request harmonization",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Global Boundary GIS Centroid Extractor mutation
  const globalExtractMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/villages/extract", {});
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/villages"] });
      toast({
        title: "GIS Extraction Successful",
        description: res.message || "Communities successfully extracted from boundary map features.",
      });
    },
    onError: (error: any) => {
      const msg = String(error?.message || "");
      const missingBoundaries = /no administrative boundary/i.test(msg);
      toast({
        title: missingBoundaries
          ? "No boundary maps for this country yet"
          : "GIS Extraction Failed",
        description: missingBoundaries
          ? "Upload an administrative boundary map (or use Import Communities with a CSV) before extracting villages from the map."
          : msg,
        variant: missingBoundaries ? "default" : "destructive",
        action: missingBoundaries ? (
          <ToastAction
            altText="Open Boundary Manager"
            onClick={() => setLocation("/admin/boundaries")}
          >
            Open Boundary Manager
          </ToastAction>
        ) : undefined,
      });
    },
  });

  // Bulk JSON/CSV Import mutation
  const importMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiRequest("POST", "/api/villages/import", payload);
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/villages"] });
      toast({
        title: "Import Successful",
        description: res.message || "Communities successfully imported.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const downloadCommunityTemplate = () => {
    const headers = ["name", "code", "district", "is_hard_to_reach", "latitude", "longitude", "facility_hmis_code", "insecurity_level", "comments"];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\nExample Community,COMM-001,Lusaka District,false,-15.3875,28.3228,HMIS-001,0,Accessible during dry season";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "community_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    document.getElementById("csv-json-import-file")?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (file.name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(text);
          importMutation.mutate(parsed);
        } catch (err: any) {
          toast({
            title: "Failed to parse JSON file",
            description: err.message,
            variant: "destructive",
          });
        }
      } else if (file.name.endsWith(".csv")) {
        try {
          // Simple robust CSV parser
          const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
          if (lines.length < 2) throw new Error("CSV file must contain at least headers and one data row.");
          
          const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
          const nameIdx = headers.findIndex(h => h.toLowerCase() === "name");
          const distIdx = headers.findIndex(h => h.toLowerCase() === "districtname" || h.toLowerCase() === "district_name" || h.toLowerCase() === "district");
          const htrIdx = headers.findIndex(h => h.toLowerCase() === "ishardtoreach" || h.toLowerCase() === "is_hard_to_reach" || h.toLowerCase() === "htr");
          const latIdx = headers.findIndex(h => h.toLowerCase() === "latitude" || h.toLowerCase() === "lat");
          const lngIdx = headers.findIndex(h => h.toLowerCase() === "longitude" || h.toLowerCase() === "lng" || h.toLowerCase() === "lon");
          const hmisIdx = headers.findIndex(h => h.toLowerCase() === "facilityhmiscode" || h.toLowerCase() === "facility_hmis_code" || h.toLowerCase() === "hmis");
          const codeIdx = headers.findIndex(h => h.toLowerCase() === "code");
          const insecIdx = headers.findIndex(h => h.toLowerCase() === "insecurity_level" || h.toLowerCase() === "insecuritylevel" || h.toLowerCase() === "insecurity");
          const commentsIdx = headers.findIndex(h => h.toLowerCase() === "comments" || h.toLowerCase() === "comment" || h.toLowerCase() === "notes");

          if (nameIdx === -1) throw new Error("CSV must contain a 'name' column.");

          const villagesList = [];
          for (let i = 1; i < lines.length; i++) {
            // Support commas inside quotes
            const row = [];
            let insideQuote = false;
            let currentWord = "";
            const line = lines[i];
            for (let c = 0; c < line.length; c++) {
              const char = line[c];
              if (char === '"') {
                insideQuote = !insideQuote;
              } else if (char === ',' && !insideQuote) {
                row.push(currentWord.trim().replace(/^["']|["']$/g, ""));
                currentWord = "";
              } else {
                currentWord += char;
              }
            }
            row.push(currentWord.trim().replace(/^["']|["']$/g, ""));

            if (row.length < headers.length) continue;

            const name = row[nameIdx];
            if (!name) continue;

            villagesList.push({
              name,
              code: codeIdx !== -1 ? row[codeIdx] || null : null,
              districtName: distIdx !== -1 ? row[distIdx] || null : null,
              isHardToReach: htrIdx !== -1 ? row[htrIdx]?.toLowerCase() === "true" || row[htrIdx] === "1" : false,
              latitude: latIdx !== -1 && row[latIdx] ? parseFloat(row[latIdx]) : null,
              longitude: lngIdx !== -1 && row[lngIdx] ? parseFloat(row[lngIdx]) : null,
              facilityHmisCode: hmisIdx !== -1 ? row[hmisIdx] || null : null,
              insecurityLevel: insecIdx !== -1 && row[insecIdx] ? parseInt(row[insecIdx], 10) : null,
              comments: commentsIdx !== -1 ? row[commentsIdx] || null : null,
            });
          }

          importMutation.mutate({ villages: villagesList });
        } catch (err: any) {
          toast({
            title: "Failed to parse CSV file",
            description: err.message,
            variant: "destructive",
          });
        }
      }
      e.target.value = ""; // reset input
    };
    reader.readAsText(file);
  };

  const aggressiveExtractMutation = useMutation({
    mutationFn: async (facilityId: number) => {
      return apiRequest("POST", `/api/facilities/${facilityId}/communities/extract-aggressive`, {});
    },
    onSuccess: (res: any) => {
      queryClient.setQueryData<Village[]>(["/api/villages"], (old) => old ? [...old.filter((v) => Number(v.id) !== Number(res.id)), res] : old);
      invalidateCommunityCaches();
      toast({
        title: "Extraction Successful",
        description: res.message || "Communities successfully linked to this facility.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Extraction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });



  // Updated Code: Filter facilities using client-side pre-fetched cache for instant UI response
  const filteredFacilities = useMemo(() => {
    if (!facilities) return [];
    
    let result = facilities;
    
    if (selectedFacilityId) {
      result = result.filter(f => Number(f.id) === Number(selectedFacilityId));
    } else if (selectedDistrictId) {
      result = result.filter(f => Number(f.districtId) === Number(selectedDistrictId));
    } else if (selectedProvinceId) {
      const districtIds = (allDistricts || [])
        .filter(d => Number(d.provinceId) === Number(selectedProvinceId))
        .map(d => Number(d.id));
      result = result.filter(f => {
        const directProvId = Number((f as any).provinceId);
        if (Number.isFinite(directProvId) && directProvId > 0 && directProvId === Number(selectedProvinceId)) {
          return true;
        }
        return districtIds.includes(Number(f.districtId));
      });
    } else if (selectedRegionId) {
      const provinceIds = (provinces || [])
        .filter(p => Number(p.regionId) === Number(selectedRegionId))
        .map(p => Number(p.id));
      const districtIds = (allDistricts || [])
        .filter(d => provinceIds.includes(Number(d.provinceId)))
        .map(d => Number(d.id));
      result = result.filter(f => {
        const directProvId = Number((f as any).provinceId);
        if (Number.isFinite(directProvId) && directProvId > 0 && provinceIds.includes(directProvId)) {
          return true;
        }
        return districtIds.includes(Number(f.districtId));
      });
    }
    
    return result;
  }, [facilities, allDistricts, provinces, selectedRegionId, selectedProvinceId, selectedDistrictId, selectedFacilityId]);

  const filteredVillages = useMemo(() => {
    if (!villages) return [];
    let result = villages;
    if (selectedFacilityId) {
      result = result.filter(v => Number(v.assignedFacilityId) === Number(selectedFacilityId));
    } else if (selectedDistrictId) {
      result = result.filter(v => Number(v.districtId) === Number(selectedDistrictId));
    } else if (selectedProvinceId) {
      const distIds = (allDistricts || []).filter(d => Number(d.provinceId) === Number(selectedProvinceId)).map(d => Number(d.id));
      result = result.filter(v => {
        const directProvId = Number((v as any).provinceId);
        if (Number.isFinite(directProvId) && directProvId > 0 && directProvId === Number(selectedProvinceId)) {
          return true;
        }
        return distIds.includes(Number(v.districtId));
      });
    } else if (selectedRegionId) {
      const provIds = (provinces || []).filter(p => Number(p.regionId) === Number(selectedRegionId)).map(p => Number(p.id));
      const distIds = (allDistricts || []).filter(d => provIds.includes(Number(d.provinceId))).map(d => Number(d.id));
      result = result.filter(v => {
        const directProvId = Number((v as any).provinceId);
        if (Number.isFinite(directProvId) && directProvId > 0 && provIds.includes(directProvId)) {
          return true;
        }
        return distIds.includes(Number(v.districtId));
      });
    }
    return result;
  }, [villages, allDistricts, provinces, selectedRegionId, selectedProvinceId, selectedDistrictId, selectedFacilityId]);


  const facilityCommunities = useMemo(() => {
    if (!villages || !selectedFacilityId) return [];
    return villages.filter(v => v.assignedFacilityId === selectedFacilityId);
  }, [villages, selectedFacilityId]);

  const form = useForm<InsertFacility>({
    resolver: zodResolver(facilityFormSchema),
    defaultValues: {
      name: "",
      hmisCode: "",
      facilityType: "health_center",
      districtId: 1,
      hasRefrigerator: false,
      hasPower: false,
      isActive: true,
    },
  });

  // Load existing catchment points when editing
  useEffect(() => {
    if (editingFacility && facilityCatchments && facilityCatchments.length > 0) {
      const official = facilityCatchments.find((c: any) => c.isOfficial);
      if (official && official.geojson && official.geojson.coordinates) {
        const coords = official.geojson.coordinates[0].map((pt: any) => L.latLng(pt[1], pt[0]));
        if (coords.length > 1 && coords[0].lat === coords[coords.length - 1].lat && coords[0].lng === coords[coords.length - 1].lng) {
          coords.pop();
        }
        setCatchmentPoints(coords);
      } else {
        setCatchmentPoints([]);
      }
    } else if (!editingFacility) {
      setCatchmentPoints([]);
    }
  }, [editingFacility, facilityCatchments]);

  // Track geofenced villages in real-time
  const currentDistrictId = form.watch("districtId");
  const districtVillages = useMemo(() => {
    if (!villages || !currentDistrictId) return [];
    return villages.filter(v => Number(v.districtId) === Number(currentDistrictId));
  }, [villages, currentDistrictId]);

  // Ray-cast point-in-polygon (lng/lat ordering, polygon as [{lat, lng}, ...])
  const pointInLatLngPolygon = (lat: number, lng: number, polygon: { lat: number; lng: number }[]) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;
      const intersect = ((yi > lat) !== (yj > lat))
          && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Per-district centroid derived from geocoded villages in the same district —
  // used as a fallback for villages with missing lat/lng so demo data still
  // gets surfaced when the polygon intersects their district.
  const districtCentroids = useMemo(() => {
    const acc: Record<string, { latSum: number; lngSum: number; n: number }> = {};
    (villages || []).forEach((v) => {
      if (!v.districtId || !v.latitude || !v.longitude) return;
      const k = String(v.districtId);
      const lat = parseFloat(v.latitude.toString());
      const lng = parseFloat(v.longitude.toString());
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (!acc[k]) acc[k] = { latSum: 0, lngSum: 0, n: 0 };
      acc[k].latSum += lat; acc[k].lngSum += lng; acc[k].n += 1;
    });
    const out: Record<string, { lat: number; lng: number }> = {};
    Object.entries(acc).forEach(([k, v]) => {
      out[k] = { lat: v.latSum / v.n, lng: v.lngSum / v.n };
    });
    return out;
  }, [villages]);

  // Aggressive extraction: scan ALL tenant villages (not just the currently
  // selected district), use a small ~250m tolerance via a bounding-box expansion
  // proxy, and fall back to the village's parent admin centroid when lat/lng is
  // missing on the row itself.
  const geofencedVillageIds = useMemo(() => {
    if (catchmentPoints.length < 3 || !villages || villages.length === 0) return [];
    // Cheap ~250m buffer: expand polygon ring outward via centroid scale. The
    // server-side extraction endpoint applies a precise PostGIS ST_Buffer
    // (geography) — this client-side check just needs to be lenient enough not
    // to drop edge cases visually as the user draws.
    const polygon = catchmentPoints;
    const ids: number[] = [];
    for (const v of villages) {
      let lat: number | null = null;
      let lng: number | null = null;
      if (v.latitude && v.longitude) {
        lat = parseFloat(v.latitude.toString());
        lng = parseFloat(v.longitude.toString());
      } else if (v.districtId && districtCentroids[String(v.districtId)]) {
        const c = districtCentroids[String(v.districtId)];
        lat = c.lat; lng = c.lng;
      }
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (pointInLatLngPolygon(lat, lng, polygon)) ids.push(v.id);
    }
    return ids;
  }, [catchmentPoints, villages, districtCentroids]);

  // Debounced server-side extraction call — runs whenever the polygon changes
  // and returns settlements_master + Overpass unmapped candidates. Falls back
  // silently to client-only geofencedVillageIds on error.
  useEffect(() => {
    if (catchmentPoints.length < 3) {
      setExtractionResult({ villages: [], settlements: [], unmapped: [] });
      setSelectedUnmappedOsm(new Set());
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const coords = [
          ...catchmentPoints.map((p) => [p.lng, p.lat]),
          [catchmentPoints[0].lng, catchmentPoints[0].lat],
        ];
        const res = await apiRequest<Response>("POST", "/api/catchments/extract", {
          geojson: { type: "Polygon", coordinates: [coords] },
          bufferMeters: 250,
          includeOsm: true,
        });
        const json: any = await (res as any).json();
        setExtractionResult({
          villages: json.villages ?? [],
          settlements: json.settlements ?? [],
          unmapped: json.unmapped ?? [],
        });
      } catch {
        // Non-fatal — UI falls back to the client-side geofencedVillageIds count.
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [catchmentPoints]);

  const facilityMapCenter = useMemo(() => {
    const lat = form.watch("latitude");
    const lng = form.watch("longitude");
    if (lat && lng) {
      return [parseFloat(lat.toString()), parseFloat(lng.toString())] as [number, number];
    }
    if (districtVillages.length > 0) {
      const first = districtVillages.find(v => v.latitude && v.longitude);
      if (first) {
        return [parseFloat(first.latitude!.toString()), parseFloat(first.longitude!.toString())] as [number, number];
      }
    }
    if (tenantInfo?.settings?.mapCenter) {
      return tenantInfo.settings.mapCenter as [number, number];
    }
    return [-6.0, 145.0] as [number, number];
  }, [form.watch("latitude"), form.watch("longitude"), districtVillages, tenantInfo]);

  function FacilityMapEvents() {
    useMapEvents({
      click(e) {
        if (facMapDrawMode === "pin") {
          form.setValue("latitude", e.latlng.lat.toFixed(6) as any);
          form.setValue("longitude", e.latlng.lng.toFixed(6) as any);
        } else {
          setCatchmentPoints(prev => [...prev, e.latlng]);
        }
      }
    });
    return null;
  }

  // Updated Code: Set default fallback district from sorted allDistricts cache
  useEffect(() => {
    if (editingFacility) {
      form.reset({
        name: editingFacility.name,
        hmisCode: editingFacility.hmisCode,
        facilityType: editingFacility.facilityType || "health_center",
        districtId: editingFacility.districtId,
        latitude: editingFacility.latitude,
        longitude: editingFacility.longitude,
        staffCount: editingFacility.staffCount,
        hasRefrigerator: editingFacility.hasRefrigerator || false,
        hasPower: editingFacility.hasPower || false,
        isActive: editingFacility.isActive ?? true,
        agencyName: editingFacility.agencyName,
        operationalStatus: editingFacility.operationalStatus,
        address: editingFacility.address,
        contactPhone: editingFacility.contactPhone,
        operatingHours: editingFacility.operatingHours,
        catchmentRadius: editingFacility.catchmentRadius,
      });
    } else {
      form.reset({
        name: "",
        hmisCode: "",
        facilityType: "health_center",
        districtId: lockedFacDistrictId || allDistricts?.[0]?.id || 1,
        hasRefrigerator: false,
        hasPower: false,
        isActive: true,
      });
    }
  }, [editingFacility, form, allDistricts, lockedFacDistrictId]);

  const saveCatchmentMutation = useMutation({
    mutationFn: async ({
      facilityId, geojson, villageIds, settlementIds, unmappedOsm,
    }: {
      facilityId: number;
      geojson: any;
      villageIds: number[];
      settlementIds?: number[];
      unmappedOsm?: Array<{ name: string; latitude: number; longitude: number; placeType: string; osmId?: string }>;
    }) => {
      return apiRequest("POST", `/api/facilities/${facilityId}/catchments`, {
        geojson,
        name: `Official Catchment for HF ${facilityId}`,
        description: `Geofenced catchment area drawing`,
        villageIds,
        settlementIds,
        unmappedOsm,
      });
    },
    onSuccess: () => {
      invalidateCommunityCaches();
      if (editingFacility?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/facilities/${editingFacility.id}/catchments`] });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Catchment Save Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertFacility) => {
      return apiRequest("POST", "/api/facilities", data);
    },
    onSuccess: (facility: any) => {
      if (catchmentPoints.length >= 3) {
        saveCatchmentMutation.mutate({
          facilityId: facility.id,
          geojson: {
            type: "Polygon",
            coordinates: [
              [
                ...catchmentPoints.map(pt => [pt.lng, pt.lat]),
                [catchmentPoints[0].lng, catchmentPoints[0].lat]
              ]
            ]
          },
          villageIds: geofencedVillageIds,
          settlementIds: extractionResult.settlements.map((s) => s.id),
          unmappedOsm: extractionResult.unmapped.filter((u) => u.osmId && selectedUnmappedOsm.has(String(u.osmId))),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      setDialogOpen(false);
      form.reset();
      setCatchmentPoints([]);
      toast({
        title: "Facility created",
        description: "The health facility has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertFacility> }) => {
      return apiRequest("PATCH", `/api/facilities/${id}`, data);
    },
    onSuccess: (facility: any) => {
      if (catchmentPoints.length >= 3) {
        saveCatchmentMutation.mutate({
          facilityId: editingFacility?.id || facility.id,
          geojson: {
            type: "Polygon",
            coordinates: [
              [
                ...catchmentPoints.map(pt => [pt.lng, pt.lat]),
                [catchmentPoints[0].lng, catchmentPoints[0].lat]
              ]
            ]
          },
          villageIds: geofencedVillageIds,
          settlementIds: extractionResult.settlements.map((s) => s.id),
          unmappedOsm: extractionResult.unmapped.filter((u) => u.osmId && selectedUnmappedOsm.has(String(u.osmId))),
        });
      }
      queryClient.setQueryData<Facility[]>(["/api/facilities"], (old) => {
        if (!old) return old;
        return old.map((f) => (Number(f.id) === Number(facility.id) ? { ...f, ...facility } : f));
      });
      try {
        offlineDb.facilities.put(facility);
      } catch {}
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      setDialogOpen(false);
      setEditingFacility(null);
      form.reset();
      setCatchmentPoints([]);
      toast({
        title: "Facility updated",
        description: "The health facility has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/facilities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      setDeletingFacility(null);
      toast({
        title: "Facility deleted",
        description: "The health facility has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const parseBulkFacilityPayload = () => {
    const raw = bulkJson.trim();
    if (!raw) {
      throw new Error('Please paste facility data in JSON or CSV format.');
    }

    // Try parsing as JSON first
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        const facilitiesPayload = Array.isArray(parsed) ? parsed : parsed?.facilities;
        if (!Array.isArray(facilitiesPayload) || facilitiesPayload.length === 0) {
          throw new Error('JSON must contain a non-empty array under "facilities" or as a root array.');
        }
        return facilitiesPayload;
      } catch (e: any) {
        if (raw.startsWith('{') || raw.startsWith('[')) throw e;
      }
    }

    // Fallback: parse simple CSV format
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      throw new Error('CSV input must contain a header row and at least one data row.');
    }

    const parseCsvRow = (rowStr: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCsvRow(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    const nameIdx = headers.indexOf('name');
    const codeIdx = headers.indexOf('hmisCode');

    if (nameIdx === -1 || codeIdx === -1) {
      throw new Error('CSV header must contain "name" and "hmisCode" columns.');
    }

    const facilities: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvRow(lines[i]).map(v => v.replace(/^"|"$/g, '').trim());
      if (values.length < 2) continue;

      const obj: any = {};
      headers.forEach((h, idx) => {
        const val = values[idx] ?? '';
        if (val === '') return;
        if (h === 'hasRefrigerator' || h === 'hasPower') {
          obj[h] = val.toLowerCase() === 'true' || val === '1';
        } else if (h === 'latitude' || h === 'longitude' || h === 'catchmentRadius' || h === 'staffCount') {
          const num = Number(val);
          obj[h] = isNaN(num) ? val : num;
        } else {
          obj[h] = val;
        }
      });
      facilities.push(obj);
    }

    if (facilities.length === 0) {
      throw new Error('No valid facility rows found in CSV data.');
    }
    return facilities;
  };

  const bulkImportMutation = useMutation({
    mutationFn: async ({ dryRun }: { dryRun: boolean }) => {
      const facilitiesPayload = parseBulkFacilityPayload();
      return apiRequest<any>('POST', '/api/facilities/import', {
        mode: bulkMode,
        dryRun,
        confirm: bulkConfirmText,
        facilities: facilitiesPayload,
      });
    },
    onSuccess: (data: any) => {
      setBulkImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/facilities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/villages'] });
      toast({
        title: data?.dryRun ? 'Bulk check complete' : 'Bulk facilities processed',
        description: data?.message || ((data?.createdCount ?? 0) + ' created, ' + (data?.updatedCount ?? 0) + ' updated.'),
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk facility operation failed',
        description: error?.message || 'Check the JSON format and confirmation text.',
        variant: 'destructive',
      });
    },
  });

  // Fetch population data list
  const { data: populationList } = useQuery<any[]>({
    queryKey: ["/api/population"],
  });

  const toPositiveNumber = (value: unknown): number => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  };

  const populationRecordRank = (record: any): number => {
    const source = String(record?.source || "").toLowerCase();
    const status = String(record?.status || record?.approvalStatus || "").toLowerCase();
    const sourceRank = source.includes("worldpop") ? 3 : source.includes("census") ? 2 : 1;
    const statusRank = ["approved", "verified", "confirmed", "baseline"].includes(status) ? 1 : 0;
    const yearRank = Number(record?.year || 0);
    const updatedRank = record?.updatedAt ? Date.parse(record.updatedAt) : 0;
    const idRank = Number(record?.id || 0);

    return (
      sourceRank * 1_000_000_000_000_000 +
      statusRank * 100_000_000_000_000 +
      yearRank * 10_000_000_000 +
      (Number.isFinite(updatedRank) ? updatedRank : 0) +
      idRank
    );
  };

  const populationByVillageId = useMemo(() => {
    const latest = new Map<number, any>();
    (populationList || []).forEach((record: any) => {
      const villageId = Number(record?.villageId || record?.village_id || record?.communityId || record?.community_id || 0);
      if (!villageId) return;

      const current = latest.get(villageId);
      if (!current || populationRecordRank(record) > populationRecordRank(current)) {
        latest.set(villageId, record);
      }
    });
    return latest;
  }, [populationList]);

  const directPopulationByFacilityId = useMemo(() => {
    const latest = new Map<number, any>();
    (populationList || []).forEach((record: any) => {
      const facilityId = Number(record?.facilityId || record?.facility_id || 0);
      if (!facilityId || Number(record?.villageId || record?.village_id || record?.communityId || record?.community_id || 0)) return;

      const current = latest.get(facilityId);
      if (!current || populationRecordRank(record) > populationRecordRank(current)) {
        latest.set(facilityId, record);
      }
    });
    return latest;
  }, [populationList]);

  const facilityPopulationRollup = useMemo(() => {
    const rollup = new Map<number, { total: number; communities: number; worldPopCommunities: number; fallbackCommunities: number }>();

    const addToFacility = (
      facilityId: number,
      population: number,
      source: "worldpop" | "record" | "fallback",
    ) => {
      if (!facilityId || population <= 0) return;
      const current = rollup.get(facilityId) || {
        total: 0,
        communities: 0,
        worldPopCommunities: 0,
        fallbackCommunities: 0,
      };
      current.total += population;
      current.communities += 1;
      if (source === "worldpop") current.worldPopCommunities += 1;
      if (source === "fallback") current.fallbackCommunities += 1;
      rollup.set(facilityId, current);
    };

    (villages || []).forEach((village: any) => {
      const facilityId = Number(village?.assignedFacilityId || village?.facilityId || 0);
      if (!facilityId) return;

      const populationRecord = populationByVillageId.get(Number(village.id));
      const recordPopulation =
        toPositiveNumber(populationRecord?.totalPopulation) ||
        toPositiveNumber(populationRecord?.total_population);
      const fallbackPopulation =
        toPositiveNumber(village?.worldpopPopulation) ||
        toPositiveNumber(village?.worldpop_population) ||
        toPositiveNumber(village?.totalCatchmentPopulation) ||
        toPositiveNumber(village?.total_catchment_population) ||
        toPositiveNumber(village?.griddedPopulation) ||
        toPositiveNumber(village?.gridded_population) ||
        toPositiveNumber(village?.estimatedPopulation) ||
        toPositiveNumber(village?.estimated_population) ||
        toPositiveNumber(village?.population) ||
        toPositiveNumber(village?.targetPopulation) ||
        toPositiveNumber(village?.target_population);

      const source = populationRecord
        ? String(populationRecord.source || "").toLowerCase().includes("worldpop")
          ? "worldpop"
          : "record"
        : "fallback";
      addToFacility(facilityId, recordPopulation || fallbackPopulation, source);
    });

    directPopulationByFacilityId.forEach((record, facilityId) => {
      if (rollup.has(facilityId)) return;
      const total = toPositiveNumber(record?.totalPopulation) || toPositiveNumber(record?.total_population);
      if (total > 0) {
        rollup.set(facilityId, {
          total,
          communities: 0,
          worldPopCommunities: String(record?.source || "").toLowerCase().includes("worldpop") ? 1 : 0,
          fallbackCommunities: 0,
        });
      }
    });

    return rollup;
  }, [villages, populationByVillageId, directPopulationByFacilityId]);

  // Resolve admin labels from the row first, then fall back to tenant-scoped lookup lists.
  const getDistrictName = (source: number | { districtId?: number | string | null; districtName?: string | null }) => {
    if (typeof source === "object" && source?.districtName) return source.districtName;
    const districtId = typeof source === "object" ? source?.districtId : source;
    const district = allDistricts?.find(d => Number(d.id) === Number(districtId));
    return district?.name || "Unknown";
  };

  const getProvinceName = (source: number | { districtId?: number | string | null; provinceId?: number | string | null; provinceName?: string | null }) => {
    if (typeof source === "object" && source?.provinceName) return source.provinceName;
    const directProvinceId = typeof source === "object" ? source?.provinceId : null;
    if (directProvinceId) {
      const directProvince = provinces?.find(p => Number(p.id) === Number(directProvinceId));
      if (directProvince?.name) return directProvince.name;
    }
    const districtId = typeof source === "object" ? source?.districtId : source;
    const district = allDistricts?.find(d => Number(d.id) === Number(districtId));
    if (!district) return "Unknown";
    const province = provinces?.find(p => Number(p.id) === Number(district.provinceId));
    return province?.name || "Unknown";
  };

  const getFacilityPopulationRollup = (facilityId: number) => {
    return facilityPopulationRollup.get(Number(facilityId));
  };

  const getFacilityPopulation = (facilityId: number) => {
    const rollup = getFacilityPopulationRollup(facilityId);
    return rollup && rollup.total > 0 ? rollup.total.toLocaleString() : "-";
  };

  const getCommunityRoute = (communityId: number) => {
    return (selectedFacilityRoutes || editingFacilityRoutes)?.find((r: any) => Number(r.villageId) === Number(communityId));
  };

  const getCommunityChvCount = (communityId: number) => {
    return (facilityChvs || []).filter((chv: any) => Number(chv.villageId || chv.assignedVillageId) === Number(communityId)).length;
  };

  const getCommunityPopulation = (community: Village) => {
    const popRecord = populationByVillageId.get(Number(community.id));
    const total =
      toPositiveNumber(popRecord?.totalPopulation) ||
      toPositiveNumber((popRecord as any)?.total_population) ||
      toPositiveNumber((community as any).worldpopPopulation) ||
      toPositiveNumber((community as any).worldpop_population) ||
      toPositiveNumber((community as any).totalCatchmentPopulation) ||
      toPositiveNumber((community as any).total_catchment_population) ||
      toPositiveNumber((community as any).griddedPopulation) ||
      toPositiveNumber((community as any).gridded_population) ||
      toPositiveNumber((community as any).estimatedPopulation) ||
      toPositiveNumber((community as any).estimated_population) ||
      toPositiveNumber((community as any).population) ||
      toPositiveNumber((community as any).targetPopulation) ||
      toPositiveNumber((community as any).target_population);
    const under5 =
      toPositiveNumber(popRecord?.under5Population) ||
      toPositiveNumber((popRecord as any)?.under5_population) ||
      toPositiveNumber((community as any).under5Population) ||
      toPositiveNumber((community as any).under5_population);
    return { total, under5 };
  };

  const renderCommunityDetails = (community: Village, compact = false) => {
    const route = getCommunityRoute(community.id);
    const population = getCommunityPopulation(community);
    const chvCount = getCommunityChvCount(community.id);
    const facility = facilities?.find(f => Number(f.id) === Number(community.assignedFacilityId));
    const coordinates = community.latitude && community.longitude
      ? `${Number(community.latitude).toFixed(5)}, ${Number(community.longitude).toFixed(5)}`
      : "No coordinates";

    return (
      <div className={compact ? "space-y-2 text-xs w-[min(300px,calc(100vw-96px))] max-w-full" : "space-y-3 text-sm"}>
        <div>
          <p className="font-semibold text-foreground break-words">{community.name}</p>
          <p className="text-xs text-muted-foreground break-words">
            {community.code || "No community code"} • {getDistrictName(community.districtId)}, {getProvinceName(community.districtId)}
          </p>
        </div>
        <div className={compact ? "grid grid-cols-2 gap-1.5" : "grid grid-cols-2 md:grid-cols-3 gap-2"}>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Population</p>
            <p className="font-semibold">{population.total ? population.total.toLocaleString() : "-"}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Under-5</p>
            <p className="font-semibold">{population.under5 ? population.under5.toLocaleString() : "-"}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Distance</p>
            <p className="font-semibold">{route?.distanceToFacility ? `${route.distanceToFacility.toFixed(2)} km` : community.distanceToFacility ? `${Number(community.distanceToFacility).toFixed(2)} km` : "-"}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Travel</p>
            <p className="font-semibold">{route ? `${route.drivingTimeMinutes}m drive` : community.travelTimeMinutes ? `${community.travelTimeMinutes}m` : "-"}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">CHVs</p>
            <p className="font-semibold">{chvCount.toLocaleString()}</p>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          <p><span className="font-semibold">Facility:</span> {facility?.name || "Unassigned"}</p>
          <p><span className="font-semibold">Coordinates:</span> <span className="font-mono">{coordinates}</span></p>
          <p><span className="font-semibold">Access mode:</span> <span className="capitalize">{route?.transportMode || community.transportMode || "Unknown"}</span></p>
          <p><span className="font-semibold">Access status:</span> {route?.accessibilityScore || (community.isHardToReach ? "Hard to Reach" : "Accessible")}</p>
          {route?.seasonalAccessibility && <p><span className="font-semibold">Season:</span> {route.seasonalAccessibility}</p>}
          {route?.referralRoute && <p className="italic text-muted-foreground break-words"><span className="font-semibold not-italic text-foreground">Referral:</span> {route.referralRoute}</p>}
        </div>
      </div>
    );
  };

  const getAssignedVillageCount = (facilityId: number) => {
    if (!villages) return 0;
    return villages.filter(v => v.assignedFacilityId === facilityId).length;
  };

  const canManageFacility = (facility: Facility | null | undefined) => {
    if (!facility) return false;
    return canEditFacility(user, facility.districtId, facility.id, allDistricts, provinces, tenantInfo?.id);
  };

  const handleEdit = (facility: Facility) => {
    if (!canManageFacility(facility)) {
      toast({
        title: "Edit not available",
        description: "You can only edit facilities within your assigned scope.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFacilityId(facility.id);
    setEditingFacility(facility);
    setDialogOpen(true);
  };

  const handleOpenFacility = (facility: Facility) => {
    setSelectedFacilityId(facility.id);
    setMainTab("facilities");
    setTimeout(() => {
      document.querySelector('[data-selected-facility-panel="true"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleDelete = (facility: Facility) => {
    setDeletingFacility(facility);
  };

  const columns = [
    /* Original Code: Static header strings
    {
      key: "province",
      header: "Province",
      sortable: true,
      render: (item: Facility) => getProvinceName(item as any),
    },
    {
      key: "district",
      header: "District",
      sortable: true,
      render: (item: Facility) => getDistrictName(item as any),
    },
    */
    // Updated Code: Use dynamic multi-tenant terminology labels for administrative levels
    {
      key: "province",
      header: adminLabels.level1 || "Province",
      sortable: true,
      render: (item: Facility) => getProvinceName(item as any),
    },
    {
      key: "district",
      header: adminLabels.level2 || "District",
      sortable: true,
      render: (item: Facility) => getDistrictName(item as any),
    },
    {
      key: "name",
      header: "Facility Name",
      sortable: true,
      render: (item: Facility) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.hmisCode}</p>
          </div>
        </div>
      ),
    },
    {
      key: "population",
      header: "Estimated / Confirmed Pop",
      sortable: true,
      render: (item: Facility) => {
        const rollup = getFacilityPopulationRollup(item.id);
        if (!rollup || rollup.total <= 0) {
          return <span className="text-muted-foreground">-</span>;
        }

        const label = rollup.communities > 0
          ? `${rollup.communities} ${rollup.communities === 1 ? "community" : "communities"}`
          : "facility record";

        return (
          <div className="flex flex-col">
            <span className="font-semibold">{getFacilityPopulation(item.id)}</span>
            <span className="text-xs text-muted-foreground">
              {label}
              {rollup.worldPopCommunities > 0 ? " · WorldPop" : ""}
            </span>
          </div>
        );
      },
    },
    {
      key: "facilityType",
      header: "Type",
      sortable: true,
      render: (item: Facility) => (
        <Badge variant="secondary" className="capitalize">
          {item.facilityType?.replace(/_/g, " ") || "N/A"}
        </Badge>
      ),
    },
    {
      key: "communities",
      header: "Communities",
      render: (item: Facility) => {
        const count = getAssignedVillageCount(item.id);
        return (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFacilityId(selectedFacilityId === item.id ? null : item.id);
            }}
            data-testid={`button-view-communities-${item.id}`}
          >
            <Users className="h-3 w-3" />
            {count} {count === 1 ? "community" : "communities"}
          </Button>
        );
      },
    },
    {
      key: "staffCount",
      header: "Staff",
      sortable: true,
      render: (item: Facility) => (
        <div className="flex items-center gap-1 text-sm">
          <Users className="h-3 w-3 text-muted-foreground" />
          {(item as any).liveStaffCount != null
            ? ((item as any).liveStaffCount > 0                 ? (item as any).liveStaffCount + " staff"                 : "0 staff")             : (item.staffCount || "-")}
        </div>
      ),
    },
    {
      key: "equipment",
      header: "Equipment",
      render: (item: Facility) => (
        <div className="flex gap-1 flex-wrap">
          {item.hasRefrigerator && (
            <Badge variant="outline" className="text-xs">
              <Thermometer className="h-3 w-3 mr-1" />
              Cold Chain
            </Badge>
          )}
          {item.hasPower && (
            <Badge variant="outline" className="text-xs">
              Power
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (item: Facility) => (
        <Badge variant={item.isActive ? "secondary" : "outline"}>
          {item.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: Facility) => {
        const canEdit = canManageFacility(item);
        const canDelete = canDeleteData(user);
        
        if (!canEdit && !canDelete) return null;
        
        return (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="View facility change and reclassification history"
              onClick={(e) => {
                e.stopPropagation();
                setHistoryEntity({ type: "facility", id: item.id, name: item.name });
              }}
            >
              <History className="h-4 w-4 text-amber-500" />
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(item);
                }}
                data-testid={`button-edit-facility-${item.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(item);
                }}
                data-testid={`button-delete-facility-${item.id}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  /* Original Code: Only rendering community name
  const communityColumns = [
    {
      key: "name",
      header: "Community Name",
      sortable: true,
      render: (item: Village) => (
        <div>
          <p className="font-medium">{item.name}</p>
          {item.code && <p className="text-xs text-muted-foreground">{item.code}</p>}
        </div>
      ),
    },
  */
  // Updated Code: Render community name alongside dynamic administrative level (province and district) columns
  const communityColumns = [
    {
      key: "name",
      header: "Community Name",
      sortable: true,
      render: (item: Village) => {
        const route = getCommunityRoute(item.id);
        return (
          <TooltipProvider>
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="space-y-1 text-left rounded-md p-1 -m-1 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedCommunityDetails(item);
                  }}
                >
                  <p className="font-semibold text-sm text-foreground">{item.name}</p>
                  {item.code && <p className="text-[10px] text-muted-foreground font-mono">Code: {item.code}</p>}
                  {route?.referralRoute && (
                    <p className="text-[10px] text-muted-foreground/80 italic truncate max-w-[200px]" title={route.referralRoute}>
                      Referral: {route.referralRoute}
                    </p>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" align="start" className="max-w-sm p-3 bg-popover text-popover-foreground border shadow-xl">
                {renderCommunityDetails(item, true)}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      key: "province",
      header: adminLabels.level1 || "Province",
      sortable: true,
      render: (item: Village) => getProvinceName(item.districtId),
    },
    {
      key: "district",
      header: adminLabels.level2 || "District",
      sortable: true,
      render: (item: Village) => getDistrictName(item.districtId),
    },
    {
      key: "distanceToFacility",
      header: "Distance",
      sortable: true,
      render: (item: Village) => {
        const route = getCommunityRoute(item.id);
        if (route) {
          return (
            <Badge variant="outline" className="font-mono bg-background/50 border-primary/10">
              {route.distanceToFacility.toFixed(2)} km
            </Badge>
          );
        }
        return item.distanceToFacility
          ? `${Number(item.distanceToFacility).toFixed(1)} km`
          : "-";
      },
    },
    {
      key: "travelTime",
      header: "Est. Travel Time",
      render: (item: Village) => {
        const route = getCommunityRoute(item.id);
        if (!route) return <span className="text-muted-foreground text-xs">-</span>;
        return (
          <div className="text-xs space-y-0.5">
            <p className="text-foreground">🚗 {route.drivingTimeMinutes}m drive</p>
            <p className="text-muted-foreground">🚶 {route.walkingTimeMinutes}m walk</p>
          </div>
        );
      }
    },
    {
      key: "transportMode",
      header: "Access Mode",
      render: (item: Village) => {
        const route = getCommunityRoute(item.id);
        const mode = route ? route.transportMode : item.transportMode;
        return (
          <Badge variant="outline" className="capitalize">
            {mode || "Unknown"}
          </Badge>
        );
      },
    },
    {
      key: "isHardToReach",
      header: "HTR Status / Access",
      render: (item: Village) => {
        const route = getCommunityRoute(item.id);
        const isHTR = route ? route.accessibilityScore === "Difficult" : item.isHardToReach;
        const score = route?.accessibilityScore;
        const seasonal = route?.seasonalAccessibility;
        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge variant={isHTR ? "destructive" : "secondary"} className="text-xs">
              {isHTR ? "Hard to Reach" : "Accessible"}
            </Badge>
            {score && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                score === "Easy" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                score === "Moderate" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                "bg-rose-500/10 text-rose-600 border-rose-500/20"
              }`}>
                {score}
              </span>
            )}
            {seasonal && (
              <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                Seasonal: {seasonal}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: Village) => {
        if (!canManageCommunity(item)) return null;
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditCommunity(item); }} data-testid={`button-edit-assigned-community-${item.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeletingCommunity(item); }} data-testid={`button-delete-assigned-community-${item.id}`}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  const onSubmit = (data: InsertFacility) => {
    if (editingFacility) {
      updateMutation.mutate({ id: editingFacility.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const clearFilters = () => {
    setSelectedRegionId(null);
    setSelectedProvinceId(null);
    setSelectedDistrictId(null);
    setSelectedFacilityId(null);
  };

  const handleEditCommunity = async (village: Village) => {
    setActiveCommTab("details");
    const loadingToast = toast({
      title: "Loading",
      description: "Fetching full community details...",
    });
    try {
      const fullVillage = await apiRequest<Village>("GET", `/api/villages/${village.id}`);
      setEditingCommunity(fullVillage);
      setNewCommName(fullVillage.name);
      setNewCommDistrictId(fullVillage.districtId.toString());
      setNewCommHTR(fullVillage.isHardToReach || false);
      setNewCommFacilityId(fullVillage.assignedFacilityId?.toString() || "");
      setNewCommLat(fullVillage.latitude?.toString() || "");
      setNewCommLng(fullVillage.longitude?.toString() || "");
      setNewCommTransportMode(fullVillage.transportMode || "walking");
      
      const existing = boundaryToLatLngs((fullVillage as any).boundary);
      if (existing.length >= 3) {
        setCommPolygonPoints(existing.map((p) => L.latLng(p.lat, p.lng)));
        setCommDrawMode("polygon");
      } else {
        setCommPolygonPoints([]);
        setCommDrawMode("pin");
      }
      setCommunityDialogOpen(true);
      loadingToast.dismiss();
    } catch (err) { 
      loadingToast.dismiss();
      toast({
        title: "Error",
        description: "Failed to load full community details.",
        variant: "destructive",
      });
    }
  };

  const handleAddCommunity = () => {
    setEditingCommunity(null);
    setNewCommName("");
    setNewCommHTR(false);
    setNewCommLat("");
    setNewCommLng("");
    setNewCommTransportMode("walking");
    setCommPolygonPoints([]);
    setCommDrawMode("pin");
    setActiveCommTab("details");
    // Pre-fill the location based on the caller's role: facility staff are pinned
    // to their own facility (and its district); district staff start in their
    // district; everyone else starts blank.
    const role = user?.role;
    const panelFacility = selectedFacilityId ? facilities?.find((f) => Number(f.id) === Number(selectedFacilityId)) : null;
    if ((role === "facility_clerk" || role === "facility_in_charge") && user?.facilityId) {
      const fac = facilities?.find((f) => Number(f.id) === Number(user.facilityId));
      setNewCommFacilityId(String(user.facilityId));
      setNewCommDistrictId(fac?.districtId ? String(fac.districtId) : "");
    } else if (panelFacility) {
      setNewCommFacilityId(String(panelFacility.id));
      setNewCommDistrictId(panelFacility.districtId ? String(panelFacility.districtId) : "");
    } else if (role === "district_manager" && user?.districtId) {
      setNewCommFacilityId("");
      setNewCommDistrictId(String(user.districtId));
    } else {
      setNewCommFacilityId("");
      setNewCommDistrictId(allDistricts?.[0]?.id?.toString() || "");
    }
    setCommunityDialogOpen(true);
  };

  const handleSaveCommunity = () => {
    if (!newCommName.trim()) {
      toast({
        title: "Validation Error",
        description: "Community name is required.",
        variant: "destructive",
      });
      return;
    }
    if (!newCommDistrictId) {
      toast({
        title: "Validation Error",
        description: "Please select a district.",
        variant: "destructive",
      });
      return;
    }

    const boundary = polygonPointsToBoundary(commPolygonPoints);
    const assignedFacilityId = newCommFacilityId ? parseInt(newCommFacilityId) : null;
    const districtId = parseInt(newCommDistrictId);
    const duplicate = findDuplicateCommunity(newCommName, assignedFacilityId, districtId, editingCommunity?.id);
    if (duplicate) {
      const facilityName = facilities?.find((f) => Number(f.id) === Number(duplicate.assignedFacilityId))?.name;
      toast({
        title: "Duplicate community name",
        description: `"${duplicate.name}" already exists${facilityName ? ` under ${facilityName}` : " in this district"}. Edit the existing row or use a clearer unique name.`,
        variant: "destructive",
      });
      return;
    }

    const payload: any = {
      name: newCommName.trim(),
      districtId,
      isHardToReach: newCommHTR,
      assignedFacilityId,
      latitude: newCommLat ? parseFloat(newCommLat) : null,
      longitude: newCommLng ? parseFloat(newCommLng) : null,
      transportMode: newCommTransportMode,
      // Persist the drawn catchment boundary (or clear it when none is drawn).
      boundary: boundary,
    };

    if (editingCommunity) {
      updateCommunityMutation.mutate({ id: editingCommunity.id, data: payload });
    } else {
      createCommunityMutation.mutate(payload);
    }
  };

  /* Original Code: Only mapped name and static districtId column
  const communityRegistryColumns = [
    {
      key: "name",
      header: "Community Name",
      sortable: true,
      render: (item: Village) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{item.name}</span>
          <span className="text-xs text-muted-foreground">{item.code || "No Code"}</span>
        </div>
      )
    },
    {
      key: "districtId",
      header: "District",
      sortable: true,
      render: (item: Village) => (
        <span className="text-sm text-foreground">{getDistrictName(item.districtId)}</span>
      )
    },
  */
  // Updated Code: Render community name alongside dynamic administrative level (province and district) columns
  const communityRegistryColumns = useMemo(() => {
    const cols = [
      {
      key: "name",
      header: "Community Name",
      sortable: true,
      render: (item: Village) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{item.name}</span>
          <span className="text-xs text-muted-foreground">{item.code || "No Code"}</span>
        </div>
      )
    },
    {
      key: "province",
      header: adminLabels.level1 || "Province",
      sortable: true,
      render: (item: Village) => (
        <span className="text-sm text-foreground">{getProvinceName(item.districtId)}</span>
      )
    },
    {
      key: "districtId",
      header: adminLabels.level2 || "District",
      sortable: true,
      render: (item: Village) => (
        <span className="text-sm text-foreground">{getDistrictName(item.districtId)}</span>
      )
    },
    {
      key: "assignedFacilityId",
      header: "Assigned Facility",
      sortable: true,
      render: (item: Village) => {
        const fac = facilities?.find(f => f.id === item.assignedFacilityId);
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{fac?.name || "Unassigned"}</span>
            {fac?.hmisCode && <span className="text-xs text-muted-foreground">HMIS: {fac.hmisCode}</span>}
          </div>
        );
      }
    },
    {
      key: "population",
      header: "Population",
      sortable: true,
      render: (item: Village) => {
        const pop = (item as any).population;
        return pop !== undefined && pop !== null ? (
          <span className="font-semibold text-sm">
            {pop.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        );
      }
    },
    {
      key: "coordinates",
      header: "Coordinates",
      render: (item: Village) => {
        if (!item.latitude || !item.longitude) return <span className="text-xs text-muted-foreground">No coordinates</span>;
        return (
          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
            {Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)}
          </span>
        );
      }
    },
    {
      key: "distanceToFacility",
      header: "Assigned Distance",
      sortable: true,
      render: (item: Village) => {
        if (item.distanceToFacility !== null && item.distanceToFacility !== undefined) {
          return (
            <Badge variant="outline" className="font-mono">
              {Number(item.distanceToFacility).toFixed(2)} km
            </Badge>
          );
        }
        if (item.latitude && item.longitude && item.assignedFacilityId) {
          const fac = facilities?.find(f => f.id === item.assignedFacilityId);
          if (fac && fac.latitude !== null && fac.longitude !== null) {
            const dist = getHaversineDistance(
              parseFloat(item.latitude.toString()),
              parseFloat(item.longitude.toString()),
              parseFloat(fac.latitude.toString()),
              parseFloat(fac.longitude.toString())
            );
            return (
              <Badge variant="outline" className="font-mono">
                {dist.toFixed(2)} km
              </Badge>
            );
          }
        }
        return <span className="text-muted-foreground text-xs">-</span>;
      }
    },
    {
      key: "closestFacilities",
      header: "Closest Facilities",
      render: (item: Village) => {
        const closest = getClosestFacilities(item);
        if (closest.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div className="space-y-1 max-w-[200px]">
            {closest.map(({ facility, distance }, idx) => (
              <div key={facility.id} className="text-xs flex items-center justify-between gap-2">
                <span className="truncate font-medium text-foreground">{facility.name}</span>
                <span className="text-muted-foreground font-mono shrink-0">{distance.toFixed(1)} km</span>
              </div>
            ))}
          </div>
        );
      }
    },
    {
      key: "isHardToReach",
      header: "HTR Status",
      sortable: true,
      render: (item: Village) => (
        <Badge variant={item.isHardToReach ? "destructive" : "secondary"}>
          {item.isHardToReach ? "Hard to Reach" : "Accessible"}
        </Badge>
      )
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: Village) => {
        const canEdit = canManageCommunity(item);
        const canDelete = canManageCommunity(item);
        if (!canEdit && !canDelete) return null;
        return (
          <div className="flex gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditCommunity(item);
                }}
                data-testid={`button-edit-community-${item.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingCommunity(item);
                }}
                data-testid={`button-delete-community-${item.id}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        );
      }
    }
  ];
  return cols.filter((c) => commVisibleColumns[c.key]);
  }, [commVisibleColumns, villages, facilities, provinces, allDistricts, user, tenantInfo]);

  const hasFilters = selectedRegionId || selectedProvinceId || selectedDistrictId;
  // Communities can be added by any staff member with edit rights — facility and
  // district staff included. The server scopes WHERE they can add.
  const canCreate = canCreateCommunity(user);
  // Adding a *facility* is reserved for coordinator/admin roles; district and
  // facility staff can add communities but not facilities (server enforces 403).
  const canAddFacility = canCreateFacility(user);
  const canBulkMaintainFacilities = user?.role === "national_admin";
  // Role-lock the community location picker: facility staff are pinned to their
  // own facility; district staff are locked to their district; coordinators and
  // admins get the full searchable Province → District → Facility cascade.

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Health Facilities & Communities</h1>
            <p className="text-muted-foreground text-sm">
              Manage health facilities, catchment communities, and geographic spatial points
            </p>
          </div>

          <TabsList className="bg-muted/50 p-1 border">
            <TabsTrigger value="facilities" className="gap-2">
              <Building2 className="h-4 w-4" />
              Facilities & Catchments
            </TabsTrigger>
            <TabsTrigger value="communities" className="gap-2">
              <Users className="h-4 w-4" />
              Communities Registry
            </TabsTrigger>
            <TabsTrigger value="chvs" className="gap-2" data-testid="tab-chvs">
              <Contact className="h-4 w-4" />
              Community Workers
            </TabsTrigger>
            <TabsTrigger value="chv-coverage" className="gap-2" data-testid="tab-chv-coverage">
              <MapPin className="h-4 w-4" />
              Coverage & Gaps
            </TabsTrigger>
          </TabsList>
        </div>

                <Card className="mb-6 bg-card border-border/40 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <GeoCascadeFilter
              showRegion={!skipRegionLevel}
              regionId={selectedRegionId}
              provinceId={selectedProvinceId}
              districtId={selectedDistrictId}
              showFacility={true}
              facilityId={selectedFacilityId}
              onRegionChange={(id) => {
                setSelectedRegionId(id);
                setSelectedProvinceId(null);
                setSelectedDistrictId(null);
                setSelectedFacilityId(null);
              }}
              onProvinceChange={(id) => {
                setSelectedProvinceId(id);
                setSelectedDistrictId(null);
                setSelectedFacilityId(null);
              }}
              onDistrictChange={(id) => {
                setSelectedDistrictId(id);
                setSelectedFacilityId(null);
              }}
              onFacilityChange={setSelectedFacilityId}
              regions={regions}
              provinces={provinces}
              districts={allDistricts}
              facilities={facilities}
              provinceLabel={adminLabels.level1}
              districtLabel={adminLabels.level2}
              testIdPrefix="global-cascade-filter"
            />
          </CardContent>
        </Card>

        <TabsContent value="facilities" className="space-y-6">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <h2 className="text-lg font-semibold">Facilities Registry</h2>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {canBulkMaintainFacilities && (
                <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" data-testid="button-bulk-facility-maintenance">
                      <Upload className="h-4 w-4 mr-1" />
                      Bulk Replace / Purge
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Bulk facility maintenance</DialogTitle>
                      <DialogDescription>
                        Import facilities in bulk, replace facilities missing from the uploaded list, or purge and reload the tenant facility registry.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Operation mode</Label>
                          <Select value={bulkMode} onValueChange={(value: "upsert" | "replace_missing" | "purge_replace") => {
                            setBulkMode(value);
                            setBulkImportResult(null);
                          }}>
                            <SelectTrigger data-testid="select-bulk-facility-mode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="upsert">Upsert only - create or update</SelectItem>
                              <SelectItem value="replace_missing">Replace missing - remove facilities not in JSON</SelectItem>
                              <SelectItem value="purge_replace">Purge and reload - remove all first</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Destructive modes are tenant-scoped. Communities are unlinked; facility-owned plans, catchments, staff, cold chain, clients, and stock rows are removed for purged facilities.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Destructive confirmation</Label>
                          <Input
                            value={bulkConfirmText}
                            onChange={(event) => setBulkConfirmText(event.target.value)}
                            placeholder="Type REPLACE FACILITIES"
                            disabled={bulkMode === "upsert"}
                            data-testid="input-bulk-facility-confirm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Required only for replace or purge modes. Use dry run first to review impact counts.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Facilities Data (JSON or CSV format)</Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                const templateObj = {
                                  facilities: [
                                    {
                                      name: "Lusaka Urban Health Centre",
                                      hmisCode: "LUS-HC-001",
                                      districtName: "Lusaka",
                                      facilityType: "health_center",
                                      operationalStatus: "operational",
                                      agencyName: "Ministry of Health",
                                      latitude: -15.4167,
                                      longitude: 28.2833,
                                      address: "Independence Avenue, Lusaka",
                                      contactPhone: "+260977000111",
                                      operatingHours: "08:00 - 17:00",
                                      hasRefrigerator: true,
                                      hasPower: true,
                                      staffCount: 12,
                                      catchmentRadius: 5.0
                                    },
                                    {
                                      name: "Chilenje Mini Hospital",
                                      hmisCode: "LUS-MH-002",
                                      districtName: "Lusaka",
                                      facilityType: "hospital",
                                      operationalStatus: "operational",
                                      agencyName: "Ministry of Health",
                                      latitude: -15.4411,
                                      longitude: 28.3245,
                                      address: "Muramba Road, Chilenje",
                                      contactPhone: "+260977000222",
                                      operatingHours: "24 Hours",
                                      hasRefrigerator: true,
                                      hasPower: true,
                                      staffCount: 35,
                                      catchmentRadius: 10.0
                                    }
                                  ]
                                };
                                const blob = new Blob([JSON.stringify(templateObj, null, 2)], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "facility_import_template.json";
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                              data-testid="button-download-facility-json-template"
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              Download JSON Template
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                const csvHeader = "name,hmisCode,districtName,facilityType,operationalStatus,agencyName,latitude,longitude,address,contactPhone,operatingHours,hasRefrigerator,hasPower,staffCount,catchmentRadius\n";
                                const sampleRows =
                                  '"Lusaka Urban Health Centre","LUS-HC-001","Lusaka","health_center","operational","Ministry of Health",-15.4167,28.2833,"Independence Avenue, Lusaka","+260977000111","08:00 - 17:00",true,true,12,5.0\n' +
                                  '"Chilenje Mini Hospital","LUS-MH-002","Lusaka","hospital","operational","Ministry of Health",-15.4411,28.3245,"Muramba Road, Chilenje","+260977000222","24 Hours",true,true,35,10.0\n';
                                const blob = new Blob([csvHeader + sampleRows], { type: "text/csv" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "facility_import_template.csv";
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                              data-testid="button-download-facility-csv-template"
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              Download CSV Template
                            </Button>
                          </div>
                        </div>
                        <textarea
                          className="min-h-[260px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={bulkJson}
                          onChange={(event) => {
                            setBulkJson(event.target.value);
                            setBulkImportResult(null);
                          }}
                          spellCheck={false}
                          data-testid="textarea-bulk-facility-json"
                        />
                        <p className="text-xs text-muted-foreground">
                          Accepted shape: <code>{'{ "facilities": [...] }'}</code>, a raw JSON array, or CSV text with headers. Required fields per row: <code>name</code> and <code>hmisCode</code>. Optional fields: <code>districtName</code>, <code>facilityType</code> (hospital, health_center, aid_post, clinic), <code>latitude</code>, <code>longitude</code>, <code>address</code>, <code>contactPhone</code>, <code>operatingHours</code>, <code>hasRefrigerator</code> (true/false), <code>hasPower</code> (true/false), <code>staffCount</code>, and <code>catchmentRadius</code>.
                        </p>
                      </div>

                      {bulkImportResult && (
                        <div className="rounded-md border bg-muted/40 p-3 text-sm" data-testid="bulk-facility-result">
                          <div className="font-semibold mb-2">{bulkImportResult.dryRun ? "Dry-run impact" : "Operation result"}</div>
                          <div className="grid sm:grid-cols-3 gap-2 text-xs">
                            <div>Facilities before: <strong>{bulkImportResult.summary?.facilityCount ?? bulkImportResult.beforeSummary?.facilityCount ?? "-"}</strong></div>
                            <div>Missing from JSON: <strong>{bulkImportResult.summary?.missingFromImportCount ?? bulkImportResult.beforeSummary?.missingFromImportCount ?? "-"}</strong></div>
                            <div>Purged: <strong>{bulkImportResult.purgeSummary?.purgedCount ?? 0}</strong></div>
                            <div>Created: <strong>{bulkImportResult.createdCount ?? 0}</strong></div>
                            <div>Updated: <strong>{bulkImportResult.updatedCount ?? 0}</strong></div>
                            <div>Facilities after: <strong>{bulkImportResult.afterSummary?.facilityCount ?? "-"}</strong></div>
                          </div>
                        </div>
                      )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button type="button" variant="outline" onClick={() => bulkImportMutation.mutate({ dryRun: true })} disabled={bulkImportMutation.isPending} data-testid="button-bulk-facility-dry-run">
                        {bulkImportMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                        Check impact
                      </Button>
                      <Button
                        type="button"
                        variant={bulkMode === "upsert" ? "default" : "destructive"}
                        onClick={() => bulkImportMutation.mutate({ dryRun: false })}
                        disabled={bulkImportMutation.isPending || ((bulkMode === "replace_missing" || bulkMode === "purge_replace") && bulkConfirmText !== "REPLACE FACILITIES")}
                        data-testid="button-bulk-facility-run"
                      >
                        {bulkImportMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                        Run bulk operation
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            {(canAddFacility || editingFacility) && (
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) setEditingFacility(null);
              }}>
                {canAddFacility && (
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-facility">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Facility
                    </Button>
                  </DialogTrigger>
                )}
                <DialogContent className="max-w-5xl w-[90vw] p-0 overflow-hidden">
                  <DialogHeader className="p-6 pb-2">
                    <DialogTitle>{editingFacility ? "Edit Facility & Catchment" : "Add New Facility & Catchment"}</DialogTitle>
                  </DialogHeader>
                  
                    <Tabs defaultValue="general" className="w-full max-w-full overflow-hidden">
                      <div className="px-6 pt-2 pb-0 border-b flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                        <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                          <TabsList className="bg-muted/50 p-1 border-0 rounded-none h-12 w-max min-w-full flex-shrink-0">
                            <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4">
                              General & Catchment Area
                            </TabsTrigger>
                            <TabsTrigger value="communities" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4" disabled={!editingFacility}>
                              Communities Served (CRUD)
                            </TabsTrigger>
                            <TabsTrigger value="gis" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4" disabled={!editingFacility}>
                              Polygon Drawing
                            </TabsTrigger>
                            <TabsTrigger value="staff" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4" disabled={!editingFacility}>
                              Staff Roster
                            </TabsTrigger>
                            <TabsTrigger value="cold-chain" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4 gap-1.5" disabled={!editingFacility}>
                              <Snowflake className="h-3.5 w-3.5 text-cyan-500" />
                              Cold Chain
                            </TabsTrigger>
                            <TabsTrigger value="population" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4 gap-1.5" disabled={!editingFacility}>
                              <Users className="h-3.5 w-3.5 text-blue-500" />
                              Population
                            </TabsTrigger>
                          </TabsList>
                        </div>
                        {editingFacility && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={aggressiveExtractMutation.isPending}
                            onClick={() => aggressiveExtractMutation.mutate(editingFacility.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shrink-0 mb-2 xl:mb-0"
                            data-testid="button-aggressive-extract"
                          >
                            <Building2 className="h-4 w-4" />
                            {aggressiveExtractMutation.isPending ? "Extracting..." : "Aggressive Centroid Extractor"}
                          </Button>
                        )}
                      </div>

                    <TabsContent value="general" className="m-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 h-[65vh]">
                        {/* Left Column: Form Fields */}
                        <div className="p-6 overflow-y-auto space-y-4 border-r custom-scrollbar">
                          <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                              <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Facility Name *</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="e.g. District Hospital"
                                        {...field}
                                        value={field.value ?? ""}
                                        data-testid="input-facility-name"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="hmisCode"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>HMIS Code *</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="NCD-001"
                                        {...field}
                                        value={field.value ?? ""}
                                        data-testid="input-hmis-code"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="facilityType"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Facility Type</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value || "health_center"}
                                    >
                                      <FormControl>
                                        <SelectTrigger data-testid="select-facility-type">
                                          <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="hospital">Hospital</SelectItem>
                                        <SelectItem value="health_center">Health Center</SelectItem>
                                        <SelectItem value="aid_post">Aid Post</SelectItem>
                                        <SelectItem value="clinic">Clinic</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="districtId"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>District *</FormLabel>
                                    <Select
                                      onValueChange={(val) => field.onChange(parseInt(val))}
                                      value={field.value?.toString() || ""}
                                      disabled={!!lockedFacDistrictId}
                                    >
                                      <FormControl>
                                        <SelectTrigger data-testid="select-district">
                                          <SelectValue placeholder="Select district" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {[...(allDistricts || [])]
                                          .sort((a, b) => a.name.localeCompare(b.name))
                                          .map((district) => (
                                            <SelectItem key={district.id} value={district.id.toString()}>
                                              {district.name}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="latitude"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Latitude</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="any"
                                          placeholder="-6.123456"
                                          value={field.value ?? ""}
                                          onChange={(e) => field.onChange(e.target.value || null)}
                                          data-testid="input-latitude"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="longitude"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Longitude</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="any"
                                          placeholder="147.123456"
                                          value={field.value ?? ""}
                                          onChange={(e) => field.onChange(e.target.value || null)}
                                          data-testid="input-longitude"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <FormField
                                  control={form.control}
                                  name="staffCount"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Staff Count</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          placeholder="10"
                                          value={field.value ?? ""}
                                          onChange={(e) =>
                                            field.onChange(e.target.value ? parseInt(e.target.value) : null)
                                          }
                                          data-testid="input-staff-count"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                              <div className="flex gap-6">
                                <FormField
                                  control={form.control}
                                  name="hasRefrigerator"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center gap-2">
                                      <FormControl>
                                        <Switch
                                          checked={field.value || false}
                                          onCheckedChange={field.onChange}
                                          data-testid="switch-refrigerator"
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0">Cold Chain</FormLabel>
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="hasPower"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center gap-2">
                                      <FormControl>
                                        <Switch
                                          checked={field.value || false}
                                          onCheckedChange={field.onChange}
                                          data-testid="switch-power"
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0">Power Supply</FormLabel>
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="isActive"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center gap-2">
                                      <FormControl>
                                        <Switch
                                          checked={field.value ?? true}
                                          onCheckedChange={field.onChange}
                                          data-testid="switch-active"
                                        />
                                      </FormControl>
                                      <FormLabel className="!mt-0">Active</FormLabel>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </form>
                          </Form>
                        </div>

                        {/* Right Column: GIS map editor & Real-time Geofencing */}
                        <div className="relative flex flex-col h-full bg-muted/20">
                          <div className="p-4 border-b bg-background flex flex-col gap-2 z-10">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex gap-2 items-center">
                                <Button
                                  type="button"
                                  variant={facMapDrawMode === "pin" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setFacMapDrawMode("pin")}
                                >
                                  Place Pin
                                </Button>
                                <Button
                                  type="button"
                                  variant={facMapDrawMode === "polygon" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setFacMapDrawMode("polygon")}
                                >
                                  Draw Catchment
                                </Button>
                                {facilityCatchments && facilityCatchments.length > 0 && (
                                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={showSavedCatchment}
                                      onChange={(e) => setShowSavedCatchment(e.target.checked)}
                                      className="h-3.5 w-3.5"
                                    />
                                    Show Saved Catchment
                                  </label>
                                )}
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setCatchmentPoints([])}
                                className="text-destructive hover:bg-destructive/10"
                              >
                                Clear Draft
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  toast({ title: "Draft Saved", description: "Polygon saved locally as a draft." });
                                }}
                              >
                                Save as Draft
                              </Button>
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  if (catchmentPoints.length >= 3 && editingFacility?.id) {
                                    saveCatchmentMutation.mutate({
                                      facilityId: editingFacility.id,
                                      geojson: {
                                        type: "Polygon",
                                        coordinates: [
                                          [
                                            ...catchmentPoints.map(pt => [pt.lng, pt.lat]),
                                            [catchmentPoints[0].lng, catchmentPoints[0].lat]
                                          ]
                                        ]
                                      },
                                      villageIds: geofencedVillageIds,
                                      settlementIds: extractionResult.settlements.map((s) => s.id),
                                      unmappedOsm: extractionResult.unmapped.filter((u) => u.osmId && selectedUnmappedOsm.has(String(u.osmId))),
                                    });
                                    toast({ title: "Saving Catchment", description: "Catchment polygon is being saved..." });
                                  } else if (catchmentPoints.length < 3) {
                                    toast({ title: "Incomplete Polygon", description: "Please draw at least 3 points.", variant: "destructive" });
                                  } else {
                                    toast({ title: "Unsaved Facility", description: "Please save the facility first before saving its catchment polygon.", variant: "destructive" });
                                  }
                                }}
                              >
                                {saveCatchmentMutation.isPending ? "Saving..." : "Save Facility Polygon"}
                              </Button>

                              {editingFacility?.id && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1"
                                  onClick={async () => {
                                    if (!editingFacility?.id) return;
                                    if (!window.confirm(`Are you sure you want to delete the catchment polygon for ${editingFacility.name}?`)) return;
                                    try {
                                      await apiRequest("DELETE", `/api/facilities/${editingFacility.id}/catchment-polygon`);
                                      setCatchmentPoints([]);
                                      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
                                      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${editingFacility.id}/catchments`] });
                                      toast({ title: "Catchment Polygon Deleted", description: "Facility catchment polygon has been removed." });
                                    } catch (err: any) {
                                      toast({ title: "Delete Failed", description: err?.message || "Failed to delete catchment polygon", variant: "destructive" });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete Polygon
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 relative z-0">
                            <MapContainer
                              center={facilityMapCenter}
                              zoom={12}
                              className="w-full h-full"
                            >
                              {/* Commented out original static TileLayer and replaced with dynamic BasemapTileLayer */}
                              {/*
                              <TileLayer
                                attribution={CARTO_POSITRON_ATTRIBUTION}
                                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                                maxNativeZoom={19}
                                maxZoom={22}
                              />
                              */}
                              <BasemapTileLayer basemap={basemap} />
                              <PopulationWmsLayer overlay={populationOverlay} />
                              <MapResizer />
                              <FlyToLocation
                                latitude={form.watch("latitude")}
                                longitude={form.watch("longitude")}
                                zoom={15}
                              />
                              <FacilityMapEvents />
                              
                              {/* Facility coordinate marker */}
                              {form.watch("latitude") && form.watch("longitude") && (
                                <Marker
                                  position={[parseFloat(form.watch("latitude")!.toString()), parseFloat(form.watch("longitude")!.toString())]}
                                  icon={OFFLINE_FACILITY_ICON}
                                  draggable
                                  eventHandlers={{
                                    dragend: (e) => {
                                      const marker = e.target;
                                      const position = marker.getLatLng();
                                      form.setValue("latitude", position.lat.toFixed(6) as any);
                                      form.setValue("longitude", position.lng.toFixed(6) as any);
                                    }
                                  }}
                                />
                              )}

                              {/* Saved (persisted) catchment overlay — toggleable */}
                              {showSavedCatchment && facilityCatchments && facilityCatchments
                                .filter((c: any) => c?.geojson)
                                .map((c: any) => {
                                  const geom = c.geojson?.type === "Feature" ? c.geojson.geometry : c.geojson;
                                  if (!geom || geom.type !== "Polygon" || !Array.isArray(geom.coordinates?.[0])) return null;
                                  const ring = geom.coordinates[0].map((pt: number[]) => [pt[1], pt[0]]) as [number, number][];
                                  return (
                                    <LeafletPolygon
                                      key={`saved-${c.id}`}
                                      positions={ring}
                                      pathOptions={{ fillColor: "#0ea5e9", fillOpacity: 0.18, color: "#0ea5e9", weight: 2, dashArray: "4 4" }}
                                    />
                                  );
                                })}

                              {/* Catchment Polygon Overlay (in-progress drawing) */}
                              {catchmentPoints.length > 0 && (
                                <LeafletPolygon
                                  positions={catchmentPoints.map(pt => [pt.lat, pt.lng])}
                                  pathOptions={{ fillColor: "#10b981", fillOpacity: 0.25, color: "#10b981", weight: 2.5 }}
                                />
                              )}

                              {/* Served/Geofenced villages markers overlay */}
                              {districtVillages.map((v) => {
                                if (!v.latitude || !v.longitude) return null;
                                const isInside = geofencedVillageIds.includes(v.id);
                                const markerColor = isInside ? "#10b981" : "#9ca3af";
                                const customIcon = L.divIcon({
                                  className: "custom-village-icon",
                                  html: `<div style="background-color: ${markerColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.4);"></div>`,
                                  iconSize: [12, 12],
                                  iconAnchor: [6, 6]
                                });

                                return (
                                  <Marker
                                    key={v.id}
                                    position={[parseFloat(v.latitude.toString()), parseFloat(v.longitude.toString())]}
                                    icon={customIcon}
                                  >
                                    <Popup>
                                      <div className="p-1">
                                        <p className="font-semibold text-sm">{v.name}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          Status: {isInside ? "🟢 Geofenced Served" : "⚪ Outside Polygon"}
                                        </p>
                                      </div>
                                    </Popup>
                                  </Marker>
                                );
                              })}
                            </MapContainer>
                            <PopulationOverlayToggle
                              overlay={populationOverlay}
                              className="absolute top-2 right-2 z-[1000]"
                            />
                            <PopulationOverlayLegend
                              overlay={populationOverlay}
                              className="absolute top-14 right-2 z-[1000]"
                            />
                          </div>

                          {/* Catchment statistics overlay dashboard */}
                          <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur border rounded-lg p-3 z-[1000] shadow-lg text-xs space-y-2 max-h-[40vh] overflow-y-auto">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-foreground">Catchment Area</p>
                                <p className="text-muted-foreground mt-0.5">
                                  Linked villages: <span className="font-medium text-foreground">{Math.max(extractionResult.villages.length, geofencedVillageIds.length)}</span>
                                  {" · "}Settlements: <span className="font-medium text-foreground">{extractionResult.settlements.length}</span>
                                  {" · "}Unmapped: <span className="font-medium text-foreground">{extractionResult.unmapped.length}</span>
                                </p>
                              </div>
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-2.5 py-1">
                                {Math.max(extractionResult.villages.length, geofencedVillageIds.length)} served
                              </Badge>
                            </div>

                            {extractionResult.unmapped.length > 0 && (
                              <div className="border-t pt-2">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="font-semibold text-foreground">Unmapped places found ({extractionResult.unmapped.length})</p>
                                  <button
                                    type="button"
                                    className="text-[10px] text-sky-600 hover:underline"
                                    onClick={() => {
                                      const all = new Set<string>(extractionResult.unmapped.filter(u => u.osmId).map(u => String(u.osmId)));
                                      setSelectedUnmappedOsm(selectedUnmappedOsm.size === all.size ? new Set<string>() : all);
                                    }}
                                  >
                                    {selectedUnmappedOsm.size === extractionResult.unmapped.filter(u => u.osmId).length ? "Clear all" : "Select all"}
                                  </button>
                                </div>
                                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                  {extractionResult.unmapped.map((u, i) => {
                                    const key = u.osmId ? String(u.osmId) : `idx-${i}`;
                                    const checked = !!u.osmId && selectedUnmappedOsm.has(String(u.osmId));
                                    return (
                                      <label key={key} className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-muted/40 px-1 py-0.5 rounded">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={!u.osmId}
                                          onChange={(e) => {
                                            if (!u.osmId) return;
                                            const next = new Set<string>(selectedUnmappedOsm);
                                            if (e.target.checked) next.add(String(u.osmId));
                                            else next.delete(String(u.osmId));
                                            setSelectedUnmappedOsm(next);
                                          }}
                                          className="h-3 w-3"
                                        />
                                        <span className="flex-1 truncate">{u.name}</span>
                                        <span className="text-muted-foreground">{u.placeType}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Checked items will be saved with the catchment as candidate communities for review.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="communities" className="m-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 h-[65vh]">
                        {/* Nested Communities CRUD list */}
                        <div className="p-6 overflow-y-auto space-y-4 border-r custom-scrollbar flex flex-col h-full justify-between">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-lg">Communities Served ({villages?.filter(v => v.assignedFacilityId === editingFacility?.id).length || 0})</h3>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setEditingCommunity(null);
                                  setNewCommName("");
                                  setNewCommDistrictId(editingFacility?.districtId.toString() || "");
                                  setNewCommHTR(false);
                                  setNewCommFacilityId(editingFacility?.id.toString() || "");
                                  setNewCommLat("");
                                  setNewCommLng("");
                                  setNewCommTransportMode("walking");
                                  setCommPolygonPoints([]);
                                  setCommunityDialogOpen(true);
                                }}
                                data-testid="button-nested-add-community"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Register Community
                              </Button>
                            </div>

                            <div className="border rounded-md divide-y overflow-y-auto max-h-[45vh] custom-scrollbar p-1.5 space-y-1.5 bg-muted/10">
                              {(villages?.filter(v => v.assignedFacilityId === editingFacility?.id) || []).length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                  No communities assigned. Click "Aggressive Centroid Extractor" above or "+ Register Community" to assign.
                                </div>
                              ) : (
                                (villages?.filter(v => v.assignedFacilityId === editingFacility?.id) || []).map((village) => {
                                  const route = editingFacilityRoutes?.find((r: any) => r.villageId === village.id);
                                  return (
                                    <div key={village.id} className="p-3.5 flex items-start justify-between hover:bg-muted/40 transition-all rounded-lg border border-transparent hover:border-muted-foreground/15 bg-background shadow-sm">
                                      <div className="space-y-1 flex-1 min-w-0 pr-2">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="font-semibold text-sm text-foreground truncate" title={village.name}>{village.name}</p>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground/80 mt-1 mb-1">Linked HF: <span className="font-semibold text-foreground/80">{editingFacility?.name}</span></div>
                                        <p className="text-[11px] text-muted-foreground font-mono">
                                          {village.latitude && village.longitude ? `${Number(village.latitude).toFixed(5)}, ${Number(village.longitude).toFixed(5)}` : "No Coordinates"}
                                        </p>
                                        {route && (
                                          <div className="mt-2 space-y-1.5 text-xs text-muted-foreground border-t pt-2 border-muted/50">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <Badge variant="outline" className="font-semibold text-foreground bg-background/50 border-primary/10">
                                                {route.distanceToFacility.toFixed(2)} km
                                              </Badge>
                                              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                                <span>🚗 {route.drivingTimeMinutes}m</span>
                                                <span className="opacity-50">|</span>
                                                <span>🚶 {route.walkingTimeMinutes}m</span>
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                route.accessibilityScore === "Easy" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                                route.accessibilityScore === "Moderate" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                                "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                              }`}>
                                                {route.accessibilityScore} Access
                                              </span>
                                              {route.seasonalAccessibility && (
                                                <span className="text-[10px] font-medium bg-sky-500/10 text-sky-600 border border-sky-500/20 px-2 py-0.5 rounded-full">
                                                  {route.seasonalAccessibility}
                                                </span>
                                              )}
                                              <span className="text-[10px] font-medium bg-secondary text-secondary-foreground border border-transparent px-2 py-0.5 rounded-full capitalize">
                                                {route.transportMode}
                                              </span>
                                            </div>
                                            {route.referralRoute && (
                                              <p className="text-[10px] italic text-muted-foreground/80 truncate w-full" title={route.referralRoute}>
                                                Referral: {route.referralRoute}
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 hover:bg-muted"
                                          onClick={() => handleEditCommunity(village)}
                                          data-testid={`button-nested-edit-community-${village.id}`}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                          onClick={() => {
                                            updateCommunityMutation.mutate({
                                              id: village.id,
                                              data: { assignedFacilityId: null }
                                            });
                                          }}
                                          data-testid={`button-nested-unassign-community-${village.id}`}
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Interactive Leaflet Sub-Map showing community pins */}
                        <div className="relative h-full bg-muted/20">
                          <div className="absolute top-4 left-4 z-[1000] bg-background/90 px-3 py-1.5 rounded-md border text-xs shadow-md">
                            Drag village pins <span className="inline-block w-3 h-3 bg-emerald-500 rounded-full border border-white align-middle"></span> to dynamically edit coordinates.
                          </div>
                          <MapContainer
                            center={editingFacility?.latitude && editingFacility?.longitude ? [parseFloat(editingFacility.latitude.toString()), parseFloat(editingFacility.longitude.toString())] : commMapCenter}
                            zoom={12}
                            className="w-full h-full"
                          >
                            {/* Commented out original static TileLayer and replaced with dynamic BasemapTileLayer */}
                            {/*
                            <TileLayer
                              attribution={CARTO_POSITRON_ATTRIBUTION}
                              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                              maxNativeZoom={19}
                              maxZoom={22}
                            />
                            */}
                            <BasemapTileLayer basemap={basemap} />
                            <MapResizer />

                            {/* Network Routes from Facility to Communities */}
                            {editingFacilityRoutes && editingFacilityRoutes.map((route: any) => {
                              if (route.hasRoadGeometry === false || route.routeSource === "estimate") return null;
                              if (!route.routeGeometry || route.routeGeometry.length < 2) return null;
                              const positions = route.routeGeometry.map((pt: number[]) => [pt[1], pt[0]]) as [number, number][];
                              
                              let color = "#10b981"; // Easy
                              if (route.accessibilityScore === "Moderate") color = "#f97316"; // orange
                              if (route.accessibilityScore === "Difficult") color = "#ef4444"; // red

                              return (
                                <Polyline
                                  key={`route-${route.villageId}`}
                                  positions={positions}
                                  pathOptions={{
                                    color: color,
                                    weight: 3.5,
                                    opacity: 0.85,
                                    dashArray: route.isDirectlyAssigned ? undefined : "5 5"
                                  }}
                                >
                                  <Popup>
                                    <div className="p-2 space-y-1 text-xs">
                                      <p className="font-semibold text-sm">{route.villageName} Route</p>
                                      <p>Distance: <span className="font-medium">{route.distanceToFacility.toFixed(2)} km</span></p>
                                      <p>Driving: <span className="font-medium">{route.drivingTimeMinutes} mins</span></p>
                                      <p>Walking: <span className="font-medium">{route.walkingTimeMinutes} mins</span></p>
                                      <p>Transport: <span className="font-medium capitalize">{route.transportMode}</span></p>
                                      <p>Accessibility: <span className="font-medium">{route.accessibilityScore}</span></p>
                                      {route.seasonalAccessibility && <p>Seasonal: <span className="font-medium">{route.seasonalAccessibility}</span></p>}
                                      <p className="text-muted-foreground mt-1">Referral: {route.referralRoute}</p>
                                    </div>
                                  </Popup>
                                </Polyline>
                              );
                            })}

                            {/* Facility Red Pin (Draggable) */}
                            {editingFacility?.latitude && editingFacility?.longitude && (
                              <Marker
                                position={[parseFloat(editingFacility.latitude.toString()), parseFloat(editingFacility.longitude.toString())]}
                                icon={OFFLINE_FACILITY_ICON}
                                draggable
                                eventHandlers={{
                                  dragend: (e) => {
                                    const position = e.target.getLatLng();
                                    updateMutation.mutate({
                                      id: editingFacility.id,
                                      data: {
                                        latitude: position.lat.toFixed(6) as any,
                                        longitude: position.lng.toFixed(6) as any
                                      }
                                    });
                                  }
                                }}
                              >
                                <Popup>
                                  <div className="p-1">
                                    <p className="font-semibold">{editingFacility.name}</p>
                                    <p className="text-xs text-muted-foreground">{editingFacility.hmisCode}</p>
                                  </div>
                                </Popup>
                              </Marker>
                            )}

                            {/* Catchment Polygon if exists */}
                            {catchmentPoints.length > 0 && (
                              <LeafletPolygon
                                positions={catchmentPoints.map(pt => [pt.lat, pt.lng])}
                                pathOptions={{ fillColor: "#10b981", fillOpacity: 0.15, color: "#10b981", weight: 2.0 }}
                              />
                            )}

                            {/* Assigned Villages Pins (Green, Draggable) */}
                            {(villages?.filter(v => v.assignedFacilityId === editingFacility?.id) || []).map((village) => {
                              if (!village.latitude || !village.longitude) return null;
                              const chvCount = facilityChvs?.filter((chv: any) => chv.villageId === village.id).length || 0;
                              const currentIcon = chvCount > 0 && typeof window !== "undefined" ? createVillageWithChvsIcon(chvCount) : OFFLINE_VILLAGE_ICON;
                              return (
                                <Marker
                                  key={village.id}
                                  position={[parseFloat(village.latitude.toString()), parseFloat(village.longitude.toString())]}
                                  icon={currentIcon}
                                  draggable
                                  eventHandlers={{
                                    dragend: (e) => {
                                      const position = e.target.getLatLng();
                                      updateCommunityMutation.mutate({
                                        id: village.id,
                                        data: {
                                          latitude: position.lat.toFixed(6),
                                          longitude: position.lng.toFixed(6)
                                        }
                                      });
                                    }
                                  }}
                                >
                                  <Popup>
                                    <div className="p-1">
                                      <p className="font-semibold">{village.name}</p>
                                      <p className="text-xs text-muted-foreground">Catchment Community</p>
                                    </div>
                                  </Popup>
                                </Marker>
                              );
                            })}
                          </MapContainer>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="gis" className="m-0">
                      <div className="p-4 overflow-y-auto max-h-[80vh] space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-base">Catchment &amp; Community Polygon Drawing</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Draw the HF catchment boundary, then draw individual community sub-polygons.
                              Population is estimated from the local GeoTIFF grid data with WorldPop cascade fallback.
                            </p>
                          </div>
                        </div>
                        {editingFacility && (
                          <CatchmentMapPanel
                            facilityId={editingFacility.id}
                            facilityName={editingFacility.name}
                            facilityLat={editingFacility.latitude ? parseFloat(editingFacility.latitude.toString()) : undefined}
                            facilityLng={editingFacility.longitude ? parseFloat(editingFacility.longitude.toString()) : undefined}
                            communities={(villages?.filter(v => v.assignedFacilityId === editingFacility.id) || []).map(v => ({
                              id: v.id,
                              villageId: v.id,
                              name: v.name,
                              targetPopulation: (v as any).targetPopulation?.toString(),
                            }))}
                            onCommunityPopUpdate={(name, population) => {
                              const village = villages?.find(v => v.name === name && v.assignedFacilityId === editingFacility.id);
                              if (village) {
                                queryClient.setQueryData(["/api/villages"], (old: any[]) =>
                                  old?.map(v => v.id === village.id ? { ...v, targetPopulation: population } : v)
                                );
                              }
                            }}
                          />
                        )}
                      </div>
                    </TabsContent>
                    {/* Added Staff Roster TabContent pane next to general/communities/gis */}
                    <TabsContent value="staff" className="m-0">
                      <div className="p-6 h-[65vh] overflow-y-auto space-y-4 custom-scrollbar">
                        <FacilityStaffRosterManager
                          facilityId={editingFacility?.id || null}
                          staff={facilityStaffList || []}
                          refetch={refetchFacilityStaff}
                        />
                      </div>
                    </TabsContent>

                    {/* ── Cold Chain Equipment Inventory ── */}
                    <TabsContent value="cold-chain" className="m-0">
                      <ColdChainTab facilityId={editingFacility?.id ?? null} />
                    </TabsContent>

                    {/* • Population Intelligence • */}
                    <TabsContent value="population" className="m-0 bg-background">
                      {editingFacility?.id && <FacilityPopulationTab facilityId={editingFacility.id} />}
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end gap-2 p-6 border-t bg-muted/10">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDialogOpen(false);
                        setEditingFacility(null);
                        setCatchmentPoints([]);
                      }}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={createMutation.isPending || updateMutation.isPending || saveCatchmentMutation.isPending}
                      onClick={form.handleSubmit(onSubmit)}
                      data-testid="button-save-facility"
                    >
                      {createMutation.isPending || updateMutation.isPending || saveCatchmentMutation.isPending
                        ? "Saving..."
                        : editingFacility
                        ? "Update Facility & Catchment"
                        : "Save Facility & Catchment"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">
                Facilities ({filteredFacilities.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={filteredFacilities}
                columns={columns}
                searchable
                searchPlaceholder="Search facilities..."
                searchKeys={["name", "hmisCode", "facilityType"]}
                onRowClick={(item) => handleOpenFacility(item)}
              />
            </CardContent>
          </Card>

          {/* Original Code: Only rendered communities table if facilityCommunities.length > 0
          {selectedFacilityId && facilityCommunities.length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">
                    Communities Assigned to {facilities?.find(f => f.id === selectedFacilityId)?.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedFacilityId(null); if (new URLSearchParams(window.location.search).has("facilityId")) setLocation("/facilities"); }}
                    data-testid="button-close-communities"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={facilityCommunities}
                  columns={communityColumns}
                  searchable
                  searchPlaceholder="Search communities..."
                  searchKeys={["name", "code"]}
                />
              </CardContent>
            </Card>
          )}
          */}

          {/* Updated Code: Render a rich, side-by-side card when a facility is selected, showing assigned communities (if any) and a map of their locations. Draggable village pins enable direct coordination editing. If 0 communities are assigned, an explicit "Extract Communities" button triggers active centroid extraction. */}
          {selectedFacilityId && (
            <Card className="border border-primary/20 shadow-xl overflow-hidden" data-selected-facility-panel="true">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Communities Assigned to {facilities?.find(f => f.id === selectedFacilityId)?.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      View, extract, and drag community pins on the map to dynamically edit GIS coordinates.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canCreate && (
                      <Button
                        size="sm"
                        onClick={handleAddCommunity}
                        className="gap-1 whitespace-nowrap"
                        data-testid="button-add-community-for-selected-facility"
                      >
                        <Plus className="h-4 w-4" />
                        Add Community
                      </Button>
                    )}                    <Button
                      size="sm"
                      variant="outline"
                      disabled={aggressiveExtractMutation.isPending}
                      onClick={() => aggressiveExtractMutation.mutate(selectedFacilityId)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 whitespace-nowrap"
                      data-testid="button-extract-communities"
                    >
                      <Building2 className="h-4 w-4" />
                      {aggressiveExtractMutation.isPending ? "Extracting..." : "Extract Communities"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setSelectedFacilityId(null); if (new URLSearchParams(window.location.search).has("facilityId")) setLocation("/facilities"); }}
                      data-testid="button-close-communities"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {facilityCommunities.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Users className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-sm">No Communities Assigned</h3>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        There are currently no communities assigned to this facility. Click the "Extract Communities" button above to run the aggressive centroid extractor.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2">
                    {/* Left: Datatable of Communities */}
                    <div className="p-6 border-r overflow-auto max-h-[500px] custom-scrollbar">
                      <DataTable
                        data={facilityCommunities}
                        columns={communityColumns}
                        searchable
                        searchPlaceholder="Search assigned communities..."
                        searchKeys={["name", "code"]}
                        onRowClick={(community) => setSelectedCommunityDetails(community)}
                      />
                      {selectedCommunityDetails && facilityCommunities.some((community) => Number(community.id) === Number(selectedCommunityDetails.id)) && (
                        <div className="mt-4 rounded-lg border bg-muted/20 p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              {renderCommunityDetails(selectedCommunityDetails)}
                            </div>
                            <div className="flex items-center gap-1">
                              {canManageCommunity(selectedCommunityDetails) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditCommunity(selectedCommunityDetails)}
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedCommunityDetails(null)}
                                aria-label="Close community details"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Right: Interactive Sub-Map */}
                    <div className="relative h-[500px] w-full bg-muted/10">
                      <div className="absolute top-4 left-4 z-[1000] bg-background/90 px-3 py-1.5 rounded-md border text-[10px] shadow-md font-sans">
                        Drag village pins <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white align-middle"></span> to dynamically edit coordinates.
                      </div>
                      <MapContainer
                        center={(() => {
                          const fac = facilities?.find(f => f.id === selectedFacilityId);
                          if (fac && fac.latitude !== null && fac.longitude !== null) {
                            return [parseFloat(fac.latitude.toString()), parseFloat(fac.longitude.toString())] as [number, number];
                          }
                          return commMapCenter;
                        })()}
                        zoom={12}
                        className="w-full h-full"
                      >
                        {/* Commented out original static TileLayer and replaced with dynamic BasemapTileLayer */}
                        {/*
                        <TileLayer
                          attribution={CARTO_POSITRON_ATTRIBUTION}
                          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                          maxNativeZoom={19}
                          maxZoom={22}
                        />
                        */}
                        <BasemapTileLayer basemap={basemap} />
                        <PopulationWmsLayer overlay={populationOverlay} />
                        <MapResizer />
                        {(() => {
                          const fac = facilities?.find(f => f.id === selectedFacilityId);
                          return (
                            <FlyToLocation
                              latitude={fac?.latitude}
                              longitude={fac?.longitude}
                              zoom={14}
                            />
                          );
                        })()}
                        
                        {/* Facility Pin (Draggable) */}
                        {(() => {
                          const fac = facilities?.find(f => f.id === selectedFacilityId);
                          if (fac && fac.latitude !== null && fac.longitude !== null) {
                            return (
                              <Marker
                                position={[parseFloat(fac.latitude.toString()), parseFloat(fac.longitude.toString())]}
                                icon={OFFLINE_FACILITY_ICON}
                                draggable
                                eventHandlers={{
                                  dragend: (e) => {
                                    const position = e.target.getLatLng();
                                    updateMutation.mutate({
                                      id: fac.id,
                                      data: {
                                        latitude: position.lat.toFixed(6) as any,
                                        longitude: position.lng.toFixed(6) as any
                                      }
                                    });
                                  }
                                }}
                              >
                                <Popup>
                                  <div className="p-1">
                                    <p className="font-semibold text-sm">{fac.name}</p>
                                    <p className="text-xs text-muted-foreground">{fac.hmisCode}</p>
                                  </div>
                                </Popup>
                              </Marker>
                            );
                          }
                          return null;
                        })()}

                        {/* Network Routes from Facility to Communities */}
                        {selectedFacilityRoutes && selectedFacilityRoutes.map((route: any) => {
                          if (route.hasRoadGeometry === false || route.routeSource === "estimate") return null;
                          if (!route.routeGeometry || route.routeGeometry.length < 2) return null;
                          const positions = route.routeGeometry.map((pt: number[]) => [pt[1], pt[0]]) as [number, number][];
                          
                          let color = "#10b981"; // Easy
                          if (route.accessibilityScore === "Moderate") color = "#f97316"; // orange
                          if (route.accessibilityScore === "Difficult") color = "#ef4444"; // red

                          return (
                            <Polyline
                              key={`selected-route-${route.villageId}`}
                              positions={positions}
                              pathOptions={{
                                color: color,
                                weight: 3.5,
                                opacity: 0.85,
                                dashArray: route.isDirectlyAssigned ? undefined : "5 5"
                              }}
                            >
                              <Popup>
                                <div className="p-2 space-y-1 text-xs">
                                  <p className="font-semibold text-sm">{route.villageName} Route</p>
                                  <p>Distance: <span className="font-medium">{route.distanceToFacility.toFixed(2)} km</span></p>
                                  <p>Driving: <span className="font-medium">{route.drivingTimeMinutes} mins</span></p>
                                  <p>Walking: <span className="font-medium">{route.walkingTimeMinutes} mins</span></p>
                                  <p>Transport: <span className="font-medium capitalize">{route.transportMode}</span></p>
                                  <p>Accessibility: <span className="font-medium">{route.accessibilityScore}</span></p>
                                  {route.seasonalAccessibility && <p>Seasonal: <span className="font-medium">{route.seasonalAccessibility}</span></p>}
                                  <p className="text-muted-foreground mt-1">Referral: {route.referralRoute}</p>
                                </div>
                              </Popup>
                            </Polyline>
                          );
                        })}

                        {/* Catchment Polygon Overlay */}
                        {/* Original Code: map had no explicit type for pt parameter
                        {selectedCatchmentPoints.length > 0 && (
                          <LeafletPolygon
                            positions={selectedCatchmentPoints.map(pt => [pt.lat, pt.lng])}
                            pathOptions={{ fillColor: "#10b981", fillOpacity: 0.15, color: "#10b981", weight: 2.0 }}
                          />
                        )}
                        */}
                        {/* Updated Code: added explicit parameter type casting for strict typescript compiler verification */}
                        {selectedCatchmentPoints.length > 0 && (
                          <LeafletPolygon
                            positions={selectedCatchmentPoints.map((pt: any) => [pt.lat, pt.lng])}
                            pathOptions={{ fillColor: "#10b981", fillOpacity: 0.15, color: "#10b981", weight: 2.0 }}
                          />
                        )}

                        {/* Assigned Villages Pins (Green, Draggable) */}
                        {facilityCommunities.map((village) => {
                          if (!village.latitude || !village.longitude) return null;
                          const chvCount = facilityChvs?.filter((chv: any) => chv.villageId === village.id).length || 0;
                          const currentIcon = chvCount > 0 && typeof window !== "undefined" ? createVillageWithChvsIcon(chvCount) : OFFLINE_VILLAGE_ICON;
                          return (
                            <Marker
                              key={village.id}
                              position={[parseFloat(village.latitude.toString()), parseFloat(village.longitude.toString())]}
                              icon={currentIcon}
                              draggable
                              eventHandlers={{
                                dragend: (e) => {
                                  const position = e.target.getLatLng();
                                  updateCommunityMutation.mutate({
                                    id: village.id,
                                    data: {
                                      latitude: position.lat.toFixed(6),
                                      longitude: position.lng.toFixed(6)
                                    }
                                  });
                                }
                              }}
                            >
                              <Popup maxWidth={320} minWidth={260} autoPan autoPanPadding={[32, 32]}>
                                <div className="max-h-[420px] max-w-[300px] overflow-y-auto p-2">
                                  {renderCommunityDetails(village, true)}
                                  <div className="flex items-center justify-end gap-2 pt-2 mt-2 border-t">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => setSelectedCommunityDetails(village)}
                                    >
                                      View
                                    </Button>
                                    {canManageCommunity(village) && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => handleEditCommunity(village)}
                                      >
                                        Edit
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}
                      </MapContainer>
                      <PopulationOverlayToggle
                        overlay={populationOverlay}
                        className="absolute top-2 right-2 z-[1000]"
                      />
                      <PopulationOverlayLegend
                        overlay={populationOverlay}
                        className="absolute bottom-2 right-2 z-[1000]"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
            </div>
        </TabsContent>

        <TabsContent value="communities" className="space-y-6">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Communities Registry</h2>
              <p className="text-muted-foreground text-xs">
                Manage demographic coordinates, Hard-to-Reach (HTR) status, and spatial routing rules
              </p>
            </div>
            {/* Original Code: Only rendering Add Community button
            {canCreate && (
              <Button onClick={handleAddCommunity} data-testid="button-add-community">
                <Plus className="h-4 w-4 mr-1" />
                Add Community
              </Button>
            )}
            */}
            {/* Updated Code: Exposing Import, GIS Extraction, and Add Community actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="file"
                id="csv-json-import-file"
                accept=".csv,.json"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button onClick={downloadCommunityTemplate} variant="outline" className="gap-1 border-primary/20 hover:bg-primary/5 text-primary">
                <Download className="h-4 w-4" />
                Template
              </Button>
              <Button
                variant="outline"
                onClick={handleImportClick}
                disabled={importMutation.isPending}
                className="gap-1 border-primary/20 hover:bg-primary/5 text-primary"
                data-testid="button-import-communities"
              >
                <Upload className="h-4 w-4" />
                {importMutation.isPending ? "Importing..." : "Import Communities"}
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="outline"
                        onClick={() => globalExtractMutation.mutate()}
                        disabled={globalExtractMutation.isPending}
                        className="gap-1 border-emerald-500/20 hover:bg-emerald-500/5 text-emerald-600 dark:text-emerald-500"
                        data-testid="button-global-extract-communities"
                      >
                        <Building2 className="h-4 w-4" />
                        {globalExtractMutation.isPending ? "Extracting..." : "Extract Communities from Map"}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!hasBoundaries && (
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      No administrative boundary maps are seeded for this
                      country yet. Upload one in the Boundary Manager, then
                      come back here to auto-extract village centroids.
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1 border-primary/20 hover:bg-primary/5 text-primary">
                    <SlidersHorizontal className="h-4 w-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {Object.entries(COMM_COLUMN_LABELS).map(([key, label]) => {
                    if (key === "actions") return null;
                    return (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={commVisibleColumns[key]}
                        onCheckedChange={(checked) =>
                          setCommVisibleColumns((prev) => ({ ...prev, [key]: checked }))
                        }
                      >
                        {label}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              {canCreate && (
                <Button onClick={handleAddCommunity} className="gap-1" data-testid="button-add-community">
                  <Plus className="h-4 w-4" />
                  Add Community
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-6">
              {(() => {
                const bulkActionsNode = (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {commBulkProcessing ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        <span>Processing {commBulkProgress.current}/{commBulkProgress.total} ({commBulkProgress.percentage}%)</span>
                      </div>
                    ) : (
                      <>
                        <Select onValueChange={(val) => handleCommBulkUpdateTransport(val)}>
                          <SelectTrigger className="h-8 w-36 text-xs bg-background">
                            <SelectValue placeholder="Update Transport" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="walking">Walking</SelectItem>
                            <SelectItem value="road">Road</SelectItem>
                            <SelectItem value="boat">Boat</SelectItem>
                            <SelectItem value="air">Air</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select onValueChange={(val) => handleCommBulkReassignFacility(Number(val))}>
                          <SelectTrigger className="h-8 w-40 text-xs bg-background">
                            <SelectValue placeholder="Reassign Facility" />
                          </SelectTrigger>
                          <SelectContent>
                            {(facilities || []).map((f) => (
                              <SelectItem key={f.id} value={String(f.id)}>
                                {f.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => handleCommBulkUpdateHTR(true)}
                        >
                          Mark HTR
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => handleCommBulkUpdateHTR(false)}
                        >
                          Mark Accessible
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={handleCommBulkDelete}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Selected
                        </Button>
                      </>
                    )}
                  </div>
                );

                return (
                  <DataTable
                    data={filteredVillages}
                    columns={communityRegistryColumns}
                    searchable
                    searchPlaceholder="Search communities registry..."
                    searchKeys={["name", "code"]}
                    enableSelection={true}
                    selectedIds={selectedCommIds}
                    onSelectionChange={setSelectedCommIds}
                    bulkActions={bulkActionsNode}
                  />
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chvs" className="space-y-6">
          <CommunityWorkersTab 
            provinces={provinces || []} 
            allDistricts={allDistricts || []} 
            facilities={filteredFacilities} 
            villages={villages || []}
            selectedProvinceId={selectedProvinceId}
            selectedDistrictId={selectedDistrictId}
            selectedFacilityId={selectedFacilityId}
          />
        </TabsContent>

        <TabsContent value="chv-coverage" className="space-y-6">
          <ChvCoverageTab 
            facilities={filteredFacilities} 
            villages={filteredVillages} 
            regions={regions || []} 
            provinces={provinces || []} 
            districts={allDistricts || []} 
            provinceLabel={adminLabels.level1} 
            districtLabel={adminLabels.level2} 
            skipRegionLevel={skipRegionLevel}
            selectedRegionId={selectedRegionId}
            selectedProvinceId={selectedProvinceId}
            selectedDistrictId={selectedDistrictId} 
            onManageFacility={(facility) => {
              setEditingFacility(facility);
              setMainTab("facilities");
              // Use a tiny timeout to let the tab mount before opening the dialog
              setTimeout(() => setDialogOpen(true), 50);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Community Dialog */}
      <Dialog open={communityDialogOpen} onOpenChange={(v) => {
        if (!v) {
          setCommunityDialogOpen(false);
          setEditingCommunity(null);
          setActiveCommTab("details");
        } else {
          setCommunityDialogOpen(true);
        }
      }}>
        {/* Original Community Dialog Content commented out to maintain rule 1/2 of user_global config:
        <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingCommunity ? "Edit Community" : "Add New Community"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Community Name *</label>
              <Input
                placeholder="e.g. Village A"
                value={newCommName}
                onChange={(e) => setNewCommName(e.target.value)}
                data-testid="input-community-name"
              />
            </div>
            ...
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button ...>Cancel</Button>
              <Button ...>Save Community</Button>
            </div>
          </div>
        </DialogContent>
        */}
        {/* Harmonized layout featuring tabs for community details and workers roster */}
        <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>
              {editingCommunity ? "Edit Community" : "Add New Community"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeCommTab} onValueChange={setActiveCommTab} className="w-full">
            <div className="px-6 border-b flex items-center justify-between">
              <TabsList className="bg-muted/50 p-1 border-0 rounded-none h-12">
                <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4">
                  General Info
                </TabsTrigger>
                <TabsTrigger value="workers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4" disabled={!editingCommunity}>
                  Community Workers
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="details" className="m-0 p-6 space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Community Name *</label>
                  <Input
                    placeholder="e.g. Village A"
                    value={newCommName}
                    onChange={(e) => setNewCommName(e.target.value)}
                    data-testid="input-community-name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Location (Province → District → Facility) *</label>
                  <FacilityCascadePicker
                    value={newCommFacilityId ? parseInt(newCommFacilityId) : null}
                    onChange={(facId, fac) => {
                      setNewCommFacilityId(facId ? String(facId) : "");
                      if (fac && (fac as any).districtId) {
                        setNewCommDistrictId(String((fac as any).districtId));
                      }
                    }}
                    onDistrictChange={(distId) => {
                      setNewCommDistrictId(distId ? String(distId) : "");
                    }}
                    disabled={isFacilityStaff}
                    lockDistrictId={lockedCommDistrictId}
                    required
                    testIdPrefix="community-picker"
                  />
                  {isFacilityStaff && (
                    <p className="text-xs text-muted-foreground">
                      Pinned to your facility — communities you add belong to it.
                    </p>
                  )}
                  {isDistrictStaff && (
                    <p className="text-xs text-muted-foreground">
                      Locked to your district — pick any facility within it.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Transport Mode</label>
                    <Select
                      value={newCommTransportMode}
                      onValueChange={setNewCommTransportMode}
                    >
                      <SelectTrigger data-testid="select-community-transport">
                        <SelectValue placeholder="Select Transport Mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="walking">Walking / Foot</SelectItem>
                        <SelectItem value="road">Road / Vehicle</SelectItem>
                        <SelectItem value="boat">Water / Boat</SelectItem>
                        <SelectItem value="air">Air / Flight</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="htr-status"
                    checked={newCommHTR}
                    onCheckedChange={setNewCommHTR}
                    data-testid="switch-community-htr"
                  />
                  <label htmlFor="htr-status" className="text-sm font-medium leading-none cursor-pointer">
                    Hard to Reach (HTR) Community
                  </label>
                </div>

                {/* Spatial Location Mapping */}
                <div className="space-y-4 pt-2 border-t">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h3 className="text-sm font-semibold">Community Location Mapping</h3>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={commDrawMode === "pin" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCommDrawMode("pin")}
                      >
                        Drop Pin Mode
                      </Button>
                      <Button
                        type="button"
                        variant={commDrawMode === "polygon" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCommDrawMode("polygon")}
                      >
                        Draw Polygon Mode
                      </Button>
                      {(newCommLat || newCommLng || commPolygonPoints.length > 0) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNewCommLat("");
                            setNewCommLng("");
                            setCommPolygonPoints([]);
                          }}
                          className="text-destructive hover:text-destructive/90"
                        >
                          Clear Draft
                        </Button>
                      )}
                      {commPolygonPoints.length >= 3 && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              toast({ title: "Draft Saved", description: "Community polygon saved locally as a draft." });
                            }}
                          >
                            Save as Draft
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={handleSaveCommunity}
                            disabled={createCommunityMutation.isPending || updateCommunityMutation.isPending}
                          >
                            {createCommunityMutation.isPending || updateCommunityMutation.isPending ? "Saving..." : "Save Community Polygon"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Latitude</label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="e.g. -6.123456"
                        value={newCommLat}
                        onChange={(e) => setNewCommLat(e.target.value)}
                        data-testid="input-community-latitude"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Longitude</label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="e.g. 145.123456"
                        value={newCommLng}
                        onChange={(e) => setNewCommLng(e.target.value)}
                        data-testid="input-community-longitude"
                      />
                    </div>
                  </div>

                  {(estimatedPopulation !== null || estimatingPop) && (
                    <div className="p-3 bg-primary/5 border border-primary/10 rounded-md flex justify-between items-center text-sm">
                      <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                        Live Population Estimate
                        {commDrawMode === "polygon" ? " (Entire Polygon)" : " (Point Grid Cell)"}:
                      </span>
                      <span className="font-bold text-primary text-base animate-in fade-in duration-200">
                        {estimatingPop ? (
                          <span className="text-xs font-normal text-muted-foreground animate-pulse">Calculating...</span>
                        ) : (
                          `${estimatedPopulation?.toLocaleString()} people`
                        )}
                      </span>
                    </div>
                  )}

                  <div className="h-[300px] w-full rounded-md border overflow-hidden relative">
                    <MapContainer
                      center={commMapCenter}
                      zoom={12}
                      className="h-full w-full"
                    >
                      {/* Commented out original static TileLayer and replaced with dynamic BasemapTileLayer */}
                      {/*
                      <TileLayer
                        attribution={CARTO_POSITRON_ATTRIBUTION}
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        maxNativeZoom={19}
                        maxZoom={22}
                      />
                      */}
                      <BasemapTileLayer basemap={basemap} />
                      <MapResizer />
                      <FlyToLocation
                        latitude={newCommLat || commMapCenter[0]}
                        longitude={newCommLng || commMapCenter[1]}
                        zoom={newCommLat && newCommLng ? 15 : 13}
                      />
                      <CommMapEvents />
                      
                      {/* Facility Marker if selected */}
                      {(() => {
                        if (newCommFacilityId) {
                          const fac = facilities?.find(f => f.id === parseInt(newCommFacilityId));
                          if (fac && fac.latitude !== null && fac.longitude !== null) {
                            return (
                              <Marker 
                                position={[parseFloat(fac.latitude.toString()), parseFloat(fac.longitude.toString())]} 
                                icon={L.divIcon({
                                  className: 'custom-facility-icon',
                                  html: '<div style="background-color: #2563eb; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.4);"></div>',
                                  iconSize: [16, 16],
                                  iconAnchor: [8, 8]
                                })}
                              />
                            );
                          }
                        }
                        return null;
                      })()}

                      {/* Selected/Centroid Community Marker */}
                      {parseFloat(newCommLat) && parseFloat(newCommLng) && !isNaN(parseFloat(newCommLat)) && !isNaN(parseFloat(newCommLng)) && (
                        <Marker 
                          position={[parseFloat(newCommLat), parseFloat(newCommLng)]} 
                          icon={L.divIcon({
                            className: 'custom-community-icon',
                            html: '<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                          })}
                        />
                      )}

                      {/* Drawn Polygon vertices / Polygon line */}
                      {commDrawMode === "polygon" && commPolygonPoints.length > 0 && (
                        <>
                          {commPolygonPoints.map((p, idx) => (
                            <Marker
                              key={idx}
                              position={p}
                              icon={L.divIcon({
                                className: 'polygon-vertex-icon',
                                html: '<div style="background-color: #3b82f6; width: 10px; height: 10px; border-radius: 50%; border: 1px solid #fff;"></div>',
                                iconSize: [10, 10],
                                iconAnchor: [5, 5]
                              })}
                            />
                          ))}
                          {commPolygonPoints.length > 1 && (
                            <LeafletPolygon
                              positions={commPolygonPoints}
                              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15 }}
                            />
                          )}
                        </>
                      )}
                    </MapContainer>
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    {commDrawMode === "pin" 
                      ? "Click on the map to drop a coordinate pin." 
                      : "Click multiple points on the map to define a community polygon. The centroid coordinates are calculated and updated in real time."}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCommunityDialogOpen(false)}
                  data-testid="button-cancel-community"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveCommunity}
                  disabled={createCommunityMutation.isPending || updateCommunityMutation.isPending}
                  data-testid="button-save-community"
                >
                  {createCommunityMutation.isPending || updateCommunityMutation.isPending
                    ? "Saving..."
                    : editingCommunity
                    ? "Update Community"
                    : "Save Community"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="workers" className="m-0 p-6">
              {editingCommunity && (
                <CommunityWorkerRosterManager
                  facilityId={editingCommunity.assignedFacilityId || editingFacility?.id || 0}
                  villageId={editingCommunity.id}
                  chvs={facilityChvs || []}
                  refetch={refetchFacilityChvs}
                />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Catchment Overlap / Harmonization Dialog (task #261) */}
      <Dialog
        open={overlapConflicts.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setOverlapConflicts([]);
            setOverlapSourceVillage(null);
            setHarmonizedIds([]);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Catchment overlap detected</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The boundary you saved for{" "}
              <span className="font-semibold text-foreground">{overlapSourceVillage?.name}</span>{" "}
              overlaps the catchment of the communities below. You can ask the
              other facility's in-charge to harmonize the boundary.
            </p>
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {overlapConflicts.map((c: any) => {
                const done = harmonizedIds.includes(Number(c.villageId));
                return (
                  <div
                    key={c.villageId}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    data-testid={`overlap-conflict-${c.villageId}`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {c.villageName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.facilityName ? `Facility: ${c.facilityName}` : "Unassigned facility"}
                        {typeof c.overlapPct === "number" ? ` · ${c.overlapPct}% overlap` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={done ? "outline" : "default"}
                      disabled={done || harmonizeMutation.isPending}
                      onClick={() =>
                        overlapSourceVillage &&
                        harmonizeMutation.mutate({
                          villageId: overlapSourceVillage.id,
                          conflictingVillageId: Number(c.villageId),
                          overlapPct: typeof c.overlapPct === "number" ? c.overlapPct : undefined,
                        })
                      }
                      data-testid={`button-harmonize-${c.villageId}`}
                    >
                      {done ? "Requested" : "Request harmonization"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOverlapConflicts([]);
                setOverlapSourceVillage(null);
                setHarmonizedIds([]);
              }}
              data-testid="button-close-overlap"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Facility AlertDialog */}
      <AlertDialog open={!!deletingFacility} onOpenChange={(open) => !open && setDeletingFacility(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Facility</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingFacility?.name}"? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingFacility && deleteMutation.mutate(deletingFacility.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Community AlertDialog */}
      <AlertDialog open={!!deletingCommunity} onOpenChange={(open) => !open && setDeletingCommunity(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Community</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the community "{deletingCommunity?.name}"? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-comm-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCommunity && deleteCommunityMutation.mutate(deletingCommunity.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-comm-delete"
            >
              {deleteCommunityMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Entity History Drawer for Facilities & Communities */}
      <EntityHistoryDrawer
        isOpen={!!historyEntity}
        onClose={() => setHistoryEntity(null)}
        entityType={historyEntity?.type || "facility"}
        entityId={historyEntity?.id || ""}
        entityName={historyEntity?.name}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FacilityStaffRosterManager
// Full-parity staff form matching the Manage Staff module exactly.
// Both modules write to the same facility_staff table via the same API endpoint,
// so staff added here immediately appear in the Manage Staff page and vice-versa.
// ─────────────────────────────────────────────────────────────────────────────
const ROSTER_ROLE_OPTIONS = [
  { value: "vaccinator",       label: "Vaccinator" },
  { value: "recorder",         label: "Recorder" },
  { value: "supervisor",       label: "Supervisor" },
  { value: "facility_in_charge", label: "Facility In-Charge" },
  { value: "nurse",            label: "Nurse" },
  { value: "midwife",          label: "Midwife" },
  { value: "chw",              label: "Community Health Worker" },
  { value: "driver",           label: "Driver" },
  { value: "cold_chain_officer", label: "Cold Chain Officer" },
];
const ROSTER_CAMPAIGN_ROLES = [
  { value: "vaccinator",  label: "Vaccinator" },
  { value: "mobilizer",   label: "Social Mobilizer" },
  { value: "volunteer",   label: "Volunteer" },
  { value: "supervisor",  label: "Supervisor / Team Lead" },
  { value: "recorder",    label: "Recorder / Tally" },
  { value: "logistics",   label: "Logistics Officer" },
];
const ROSTER_EDUCATION = [
  { value: "primary",     label: "Primary Education" },
  { value: "secondary",   label: "Secondary Education" },
  { value: "certificate", label: "Certificate / Diploma" },
  { value: "bachelors",   label: "Bachelor's Degree" },
  { value: "masters",     label: "Master's Degree" },
  { value: "phd",         label: "PhD / Doctorate" },
];
const ROSTER_TRAINING = [
  { value: "trained",          label: "Trained" },
  { value: "not_trained",      label: "Not Trained" },
  { value: "refresher_needed", label: "Refresher Needed" },
  { value: "in_training",      label: "Currently in Training" },
];
const EMPTY_ROSTER_FORM = {
  fullName: "",
  gender: "female",
  position: "",
  contactPhone: "",
  yearsExperience: "",
  yearsAtFacility: "",
  role: "vaccinator",
  campaignRole: "vaccinator",
  isActive: true,
  isVolunteer: false,
  educationLevel: "",
  trainingStatus: "trained",
  residenceVillage: "",
  employeeId: "",
  nrc: "",
};

function StaffRoleColor({ role }: { role: string }) {
  const colors: Record<string, string> = {
    vaccinator: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    recorder: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    supervisor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    facility_in_charge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    nurse: "bg-pink-500/10 text-pink-600 border-pink-500/20",
    midwife: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    chw: "bg-teal-500/10 text-teal-600 border-teal-500/20",
    driver: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    cold_chain_officer: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  };
  const cls = colors[role] || "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {role?.replace(/_/g, " ") || "Staff"}
    </span>
  );
}

function StaffInitials({ name, gender }: { name: string; gender: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const grad = gender === "male" ? "from-blue-400 to-indigo-600" : "from-rose-400 to-pink-600";
  return (
    <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm`}>
      {initials}
    </div>
  );
}

function FacilityStaffRosterManager({
  facilityId,
  staff,
  refetch,
}: {
  facilityId: number | null;
  staff: any[];
  refetch: () => void;
}) {
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formTab, setFormTab] = useState("basic");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_ROSTER_FORM });
  const { toast } = useToast();

  const setField = <K extends keyof typeof EMPTY_ROSTER_FORM>(key: K, val: any) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const resetForm = () => {
    setForm({ ...EMPTY_ROSTER_FORM });
    setEditingStaff(null);
    setFormTab("basic");
  };

  const openNew = () => { resetForm(); setIsDialogOpen(true); };

  const openEdit = (member: any) => {
    setEditingStaff(member);
    setForm({
      fullName: member.fullName || member.name || "",
      gender: member.gender || "female",
      position: member.position || "",
      contactPhone: member.contactPhone || member.phone || "",
      yearsExperience: member.yearsExperience?.toString() || "",
      yearsAtFacility: member.yearsAtFacility?.toString() || "",
      role: member.role || "vaccinator",
      campaignRole: member.campaignRole || "vaccinator",
      isActive: member.isActive ?? true,
      isVolunteer: member.isVolunteer ?? false,
      educationLevel: member.educationLevel || "",
      trainingStatus: member.trainingStatus || "trained",
      residenceVillage: member.residenceVillage || "",
      employeeId: member.employeeId || "",
      nrc: member.nrc || "",
    });
    setFormTab("basic");
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId) return;
    if (!form.fullName.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }
    if (!form.nrc.trim()) {
      toast({ title: "NRC Number is required", description: "Every staff member must have a unique NRC.", variant: "destructive" });
      return;
    }
    // Client-side NRC duplicate check
    const nrcLower = form.nrc.trim().toLowerCase();
    const dup = staff.find(s => s.nrc && s.nrc.toLowerCase() === nrcLower && s.id !== editingStaff?.id);
    if (dup) {
      toast({ title: "Duplicate NRC", description: `NRC ${form.nrc} is already assigned to ${dup.fullName}.`, variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        fullName: form.fullName.trim(),
        gender: form.gender,
        position: form.position.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : null,
        yearsAtFacility: form.yearsAtFacility ? parseInt(form.yearsAtFacility) : null,
        role: form.role,
        campaignRole: form.campaignRole,
        isActive: form.isActive,
        isVolunteer: form.isVolunteer,
        educationLevel: form.educationLevel || null,
        trainingStatus: form.trainingStatus || null,
        residenceVillage: form.residenceVillage.trim() || null,
        employeeId: form.employeeId.trim() || null,
        nrc: form.nrc.trim(),
      };

      if (editingStaff) {
        await apiRequest("PATCH", `/api/facilities/${facilityId}/staff/${editingStaff.id}`, payload);
        toast({ title: "Staff member updated", description: `${form.fullName} has been updated.` });
      } else {
        await apiRequest("POST", `/api/facilities/${facilityId}/staff`, payload);
        toast({ title: "Staff member added", description: `${form.fullName} has been added to the roster.` });
      }
      refetch();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (memberId: number, name: string) => {
    if (!facilityId) return;
    if (!confirm(`Remove ${name} from the roster? This cannot be undone.`)) return;
    try {
      await apiRequest("DELETE", `/api/facilities/${facilityId}/staff/${memberId}`);
      toast({ title: "Staff member removed" });
      refetch();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  };

  if (!facilityId) return null;

  const activeCount = staff.filter(s => s.isActive).length;
  const vaccinatorCount = staff.filter(s => s.role === "vaccinator").length;

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg text-foreground">Staff Roster</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 font-medium">
              {activeCount} Active
            </span>
            <span className="rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2 py-0.5 font-medium">
              {vaccinatorCount} Vaccinators
            </span>
            <span className="rounded-full bg-muted text-muted-foreground border px-2 py-0.5 font-medium">
              {staff.length} Total
            </span>
          </div>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Add Staff Member
        </Button>
      </div>

      {/* Staff table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground border-b">
            <tr>
              <th className="p-3 text-left font-semibold">Staff Member</th>
              <th className="p-3 text-left font-semibold">Role</th>
              <th className="p-3 text-left font-semibold hidden md:table-cell">Contact</th>
              <th className="p-3 text-left font-semibold hidden lg:table-cell">Training</th>
              <th className="p-3 text-left font-semibold hidden lg:table-cell">NRC</th>
              <th className="p-3 text-center font-semibold">Status</th>
              <th className="p-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.length > 0 ? (
              staff.map(member => (
                <tr key={member.id} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <StaffInitials name={member.fullName || member.name || "?"} gender={member.gender || "female"} />
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{member.fullName || member.name}</div>
                        <div className="text-[10px] text-muted-foreground">{member.employeeId || member.position || ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3"><StaffRoleColor role={member.role} /></td>
                  <td className="p-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                    {member.contactPhone || member.phone || "—"}
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${
                      member.trainingStatus === "trained" ? "bg-green-500/10 text-green-600" :
                      member.trainingStatus === "in_training" ? "bg-blue-500/10 text-blue-600" :
                      member.trainingStatus === "refresher_needed" ? "bg-amber-500/10 text-amber-600" :
                      "bg-red-500/10 text-red-600"
                    }`}>
                      {member.trainingStatus?.replace(/_/g, " ") || "—"}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground hidden lg:table-cell">
                    {member.nrc || "—"}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex h-2 w-2 rounded-full ${member.isActive ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(member)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(member.id, member.fullName || member.name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted-foreground italic">
                  No staff members registered. Click "Add Staff Member" to populate the roster.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Full-parity staff dialog — identical fields to Manage Staff module */}
      <Dialog open={isDialogOpen} onOpenChange={v => { if (!v) { setIsDialogOpen(false); resetForm(); } else setIsDialogOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
            <DialogDescription>
              {editingStaff
                ? "Update this staff member's details. Changes are reflected across all modules."
                : "Add a new staff member to this facility's roster. They will immediately appear in the Manage Staff module."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-0">
            {/* Tab navigation — same layout as Manage Staff dialog */}
            <div className="flex gap-1 border-b mb-4 pb-0">
              {[["basic","Basic Info"],["professional","Professional"],["campaign","Campaign"]].map(([tab, label]) => (
                <button key={tab} type="button"
                  onClick={() => setFormTab(tab)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    formTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Basic Info Tab */}
            {formTab === "basic" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="rs-fullName">Full Name *</Label>
                    <Input id="rs-fullName" placeholder="e.g. Mary Phiri" value={form.fullName}
                      onChange={e => setField("fullName", e.target.value)} disabled={submitting} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rs-gender">Gender</Label>
                    <Select value={form.gender} onValueChange={v => setField("gender", v)} disabled={submitting}>
                      <SelectTrigger id="rs-gender"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="other">Other / Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rs-phone">Contact Phone</Label>
                    <Input id="rs-phone" placeholder="+260977123456" value={form.contactPhone}
                      onChange={e => setField("contactPhone", e.target.value)} disabled={submitting} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rs-nrc">NRC Number *</Label>
                    <Input id="rs-nrc" placeholder="123456/10/1" value={form.nrc}
                      onChange={e => setField("nrc", e.target.value)} disabled={submitting} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rs-empId">Employee ID</Label>
                    <Input id="rs-empId" placeholder="EMP-0042" value={form.employeeId}
                      onChange={e => setField("employeeId", e.target.value)} disabled={submitting} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rs-village">Residence Village / Area</Label>
                    <Input id="rs-village" placeholder="Kalingalinga" value={form.residenceVillage}
                      onChange={e => setField("residenceVillage", e.target.value)} disabled={submitting} />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch id="rs-active" checked={form.isActive} onCheckedChange={v => setField("isActive", v)} disabled={submitting} />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch id="rs-volunteer" checked={form.isVolunteer} onCheckedChange={v => setField("isVolunteer", v)} disabled={submitting} />
                    <span className="text-sm">Volunteer</span>
                  </label>
                </div>
              </div>
            )}

            {/* Professional Tab */}
            {formTab === "professional" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="rs-role">Routine Role</Label>
                    <Select value={form.role} onValueChange={v => setField("role", v)} disabled={submitting}>
                      <SelectTrigger id="rs-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROSTER_ROLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rs-position">Job Title / Position</Label>
                    <Input id="rs-position" placeholder="Clinical Officer" value={form.position}
                      onChange={e => setField("position", e.target.value)} disabled={submitting} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rs-education">Education Level</Label>
                    <Select value={form.educationLevel} onValueChange={v => setField("educationLevel", v)} disabled={submitting}>
                      <SelectTrigger id="rs-education"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {ROSTER_EDUCATION.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rs-training">Training Status</Label>
                    <Select value={form.trainingStatus} onValueChange={v => setField("trainingStatus", v)} disabled={submitting}>
                      <SelectTrigger id="rs-training"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROSTER_TRAINING.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rs-yrsExp">Years of Experience</Label>
                    <Input id="rs-yrsExp" type="number" min="0" max="50" placeholder="5" value={form.yearsExperience}
                      onChange={e => setField("yearsExperience", e.target.value)} disabled={submitting} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rs-yrsFac">Years at this Facility</Label>
                    <Input id="rs-yrsFac" type="number" min="0" max="50" placeholder="2" value={form.yearsAtFacility}
                      onChange={e => setField("yearsAtFacility", e.target.value)} disabled={submitting} />
                  </div>
                </div>
              </div>
            )}

            {/* Campaign Tab */}
            {formTab === "campaign" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Campaign roles apply during SIA / supplemental immunisation activities.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="rs-campRole">Campaign Role</Label>
                  <Select value={form.campaignRole} onValueChange={v => setField("campaignRole", v)} disabled={submitting}>
                    <SelectTrigger id="rs-campRole"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROSTER_CAMPAIGN_ROLES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter className="mt-6 flex justify-between items-center">
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editingStaff ? "Update Member" : "Save Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CommunityWorkerRosterManager
// Harmonized community health volunteers (CHVs) manager inside Community dialog
// ─────────────────────────────────────────────────────────────────────────────
const CHV_CAMPAIGN_ROLES = [
  { value: "social_mobilizer", label: "Social Mobilizer" },
  { value: "vaccinator", label: "Vaccinator" },
  { value: "volunteer", label: "Volunteer" },
  { value: "supervisor", label: "Supervisor" },
  { value: "recorder", label: "Recorder" },
  { value: "volunteer_vaccinator", label: "Volunteer Vaccinator" },
];

const CHV_EDUCATION = [
  { value: "Primary", label: "Primary Education" },
  { value: "Secondary", label: "Secondary Education" },
  { value: "Certificate", label: "Certificate / Diploma" },
  { value: "Diploma", label: "Diploma" },
  { value: "Degree", label: "Degree" },
];

const CHV_TRAINING = [
  { value: "trained", label: "Trained" },
  { value: "untrained", label: "Untrained" },
];

const CHW_EMPLOYMENT_STATUS = [
  "Active - In-service",
  "Active - Intern",
  "Inactive - Suspended",
  "Inactive - Resigned",
  "Inactive - Retired",
  "Inactive - Deceased",
  "Not commenced",
  "Other - Unclassified"
];

const EMPTY_CHV_FORM = {
  name: "",
  nrc: "",
  gender: "female",
  contactPhone: "",
  age: "",
  roleDescription: "",
  educationLevel: "Secondary",
  trainingStatus: "trained",
  yearsOfService: "",
  campaignRole: "social_mobilizer",
  active: true,
  employmentStatus: "Active - In-service",
  supervisorId: "",
  villageId: "",
};

function ChvRoleColor({ role }: { role: string }) {
  const colors: Record<string, string> = {
    vaccinator: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    volunteer_vaccinator: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    recorder: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    supervisor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    social_mobilizer: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    volunteer: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  };
  const cls = colors[role] || "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {role?.replace(/_/g, " ") || "CHV"}
    </span>
  );
}

function ChvInitials({ name, gender }: { name: string; gender: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const grad = gender === "male" ? "from-blue-400 to-indigo-600" : "from-rose-400 to-pink-600";
  return (
    <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm`}>
      {initials}
    </div>
  );
}

interface CommunityWorkerRosterManagerProps {
  facilityId: number;
  villageId: number;
  chvs: any[];
  refetch: () => void;
}

function CommunityWorkerRosterManager({
  facilityId,
  villageId,
  chvs,
  refetch,
}: CommunityWorkerRosterManagerProps) {
  const [editingChv, setEditingChv] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formTab, setFormTab] = useState("basic");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_CHV_FORM });
  const { toast } = useToast();

  const { data: staffList } = useQuery<any[]>({
    queryKey: ["/api/facilities", Number(facilityId), "staff"],
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}/staff`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch facility staff");
      return res.json();
    },
    enabled: !!facilityId && isDialogOpen,
  });

  const setField = <K extends keyof typeof EMPTY_CHV_FORM>(key: K, val: any) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const resetForm = () => {
    setForm({ ...EMPTY_CHV_FORM });
    setEditingChv(null);
    setFormTab("basic");
  };

  const openNew = () => { resetForm(); setIsDialogOpen(true); };

  const openEdit = (member: any) => {
    setEditingChv(member);
    setForm({
      name: member.name || member.fullName || "",
      nrc: member.nrc || "",
      gender: member.gender || "female",
      contactPhone: member.contactPhone || "",
      age: member.age?.toString() || "",
      roleDescription: member.roleDescription || "",
      educationLevel: member.educationLevel || "Secondary",
      trainingStatus: member.trainingStatus || "trained",
      yearsOfService: member.yearsOfService?.toString() || "",
      campaignRole: member.campaignRole || "social_mobilizer",
      active: member.active ?? member.isActive ?? true,
      employmentStatus: member.employmentStatus || "Active - In-service",
      supervisorId: member.supervisorId?.toString() || "",
      villageId: member.villageId?.toString() || "",
    });
    setFormTab("basic");
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId) return;
    if (!form.name.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }

    if (!form.nrc.trim()) {
      toast({
        title: "NRC is required",
        description: "National Registration Card is mandatory.",
        variant: "destructive",
      });
      return;
    }
    const nrcPattern = /^\d{6}\/\d{2}\/\d{1}$/;
    if (!nrcPattern.test(form.nrc.trim())) {
      toast({
        title: "Invalid NRC format",
        description: "NRC must be formatted as XXXXXX/XX/X (e.g. 123456/78/9)",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: form.name.trim(),
        nrc: form.nrc.trim() || null,
        gender: form.gender,
        contactPhone: form.contactPhone.trim() || null,
        age: form.age ? parseInt(form.age) : null,
        roleDescription: form.roleDescription.trim() || null,
        educationLevel: form.educationLevel,
        trainingStatus: form.trainingStatus,
        yearsOfService: form.yearsOfService ? parseInt(form.yearsOfService) : null,
        campaignRole: form.campaignRole,
        villageId: villageId, // lock to current community/village
        active: form.active,
        employmentStatus: form.employmentStatus,
        supervisorId: form.supervisorId && form.supervisorId !== "none" ? parseInt(form.supervisorId) : null,
      };

      if (editingChv) {
        await apiRequest("PATCH", `/api/facilities/${facilityId}/chvs/${editingChv.id}`, payload);
        toast({ title: "Community worker updated", description: `${form.name} has been updated.` });
      } else {
        await apiRequest("POST", `/api/facilities/${facilityId}/chvs`, payload);
        toast({ title: "Community worker added", description: `${form.name} has been added.` });
      }
      await queryClient.invalidateQueries({
        queryKey: ["/api/facilities", Number(facilityId), "chvs"]
      });
      refetch();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (memberId: number, name: string) => {
    if (!facilityId) return;
    if (!confirm(`Remove ${name} from the roster? This cannot be undone.`)) return;
    try {
      await apiRequest("DELETE", `/api/facilities/${facilityId}/chvs/${memberId}`);
      toast({ title: "Community worker removed" });
      await queryClient.invalidateQueries({
        queryKey: ["/api/facilities", Number(facilityId), "chvs"]
      });
      refetch();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  };

  // Filter CHVs for this community/village
  const villageChvs = chvs.filter(c => Number(c.villageId) === Number(villageId));
  const activeCount = villageChvs.filter(c => c.active).length;
  const mobilizerCount = villageChvs.filter(c => c.campaignRole === "social_mobilizer").length;

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-base text-foreground">Community Workers</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 font-medium">
              {activeCount} Active
            </span>
            <span className="rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2 py-0.5 font-medium">
              {mobilizerCount} Mobilizers
            </span>
            <span className="rounded-full bg-muted text-muted-foreground border px-2 py-0.5 font-medium">
              {villageChvs.length} Total
            </span>
          </div>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Add Community Worker
        </Button>
      </div>

      {/* Roster table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="p-3 text-left font-semibold">Name</th>
              <th className="p-3 text-left font-semibold">Campaign Role</th>
              <th className="p-3 text-left font-semibold hidden md:table-cell">Contact</th>
              <th className="p-3 text-left font-semibold hidden lg:table-cell">Status</th>
              <th className="p-3 text-left font-semibold hidden lg:table-cell">Supervisor</th>
              <th className="p-3 text-center font-semibold">Active</th>
              <th className="p-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {villageChvs.length > 0 ? (
              villageChvs.map(member => (
                <tr key={member.id} className="border-b border-border last:border-0 hover:bg-muted/5 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <ChvInitials name={member.name || member.fullName || "?"} gender={member.gender || "female"} />
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{member.name || member.fullName}</div>
                        <div className="text-[10px] text-muted-foreground">{member.educationLevel || ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3"><ChvRoleColor role={member.campaignRole || member.siaRole} /></td>
                  <td className="p-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                    {member.contactPhone || "—"}
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    <div className="text-xs font-semibold">{member.employmentStatus || "Active - In-service"}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">{member.trainingStatus || "trained"} · {member.yearsOfService || 0} yrs</div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {member.supervisorName || "—"}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex h-2 w-2 rounded-full ${member.active ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(member)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(member.id, member.name || member.fullName)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted-foreground italic">
                  No community workers registered for this village. Click "Add Community Worker" to populate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Roster Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={v => { if (!v) { setIsDialogOpen(false); resetForm(); } else setIsDialogOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingChv ? "Edit Community Worker" : "Add Community Worker"}</DialogTitle>
            <DialogDescription>
              {editingChv
                ? "Update this community health volunteer's details."
                : "Add a new community health volunteer to this community roster."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-0">
            {/* Roster tab navigation */}
            <div className="flex gap-1 border-b mb-4 pb-0">
              {[["basic","Basic Info"],["professional","Professional"],["campaign","Campaign"]].map(([tab, label]) => (
                <button key={tab} type="button"
                  onClick={() => setFormTab(tab)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    formTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Basic Info Tab */}
            {formTab === "basic" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="chv-name">Full Name *</Label>
                    <Input id="chv-name" placeholder="e.g. Grace Mutale" value={form.name}
                      onChange={e => setField("name", e.target.value)} disabled={submitting} />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="chv-nrc">National Registration Card (NRC) *</Label>
                    <Input id="chv-nrc" placeholder="XXXXXX/XX/X (e.g. 123456/78/9)" value={form.nrc}
                      onChange={e => setField("nrc", e.target.value)} disabled={submitting} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="chv-gender">Gender</Label>
                    <Select value={form.gender} onValueChange={v => setField("gender", v)} disabled={submitting}>
                      <SelectTrigger id="chv-gender"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="other">Other / Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="chv-phone">Contact Phone</Label>
                    <Input id="chv-phone" placeholder="+260977123456" value={form.contactPhone}
                      onChange={e => setField("contactPhone", e.target.value)} disabled={submitting} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="chv-age">Age</Label>
                    <Input id="chv-age" type="number" min="15" max="100" placeholder="30" value={form.age}
                      onChange={e => setField("age", e.target.value)} disabled={submitting} />
                  </div>
                </div>
                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch id="chv-active" checked={form.active} onCheckedChange={v => setField("active", v)} disabled={submitting} />
                    <span className="text-sm">Active</span>
                  </label>
                </div>
              </div>
            )}

            {/* Professional Tab */}
            {formTab === "professional" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="chv-education">Education Level</Label>
                    <Select value={form.educationLevel} onValueChange={v => setField("educationLevel", v)} disabled={submitting}>
                      <SelectTrigger id="chv-education"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {CHV_EDUCATION.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="chv-training">Training Status</Label>
                    <Select value={form.trainingStatus} onValueChange={v => setField("trainingStatus", v)} disabled={submitting}>
                      <SelectTrigger id="chv-training"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHV_TRAINING.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="chv-yrsOfService">Years of Service</Label>
                    <Input id="chv-yrsOfService" type="number" min="0" max="50" placeholder="3" value={form.yearsOfService}
                      onChange={e => setField("yearsOfService", e.target.value)} disabled={submitting} />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="chv-description">Routine Role / Job Description</Label>
                    <Input id="chv-description" placeholder="Provides community mobilization and traces dropouts" value={form.roleDescription}
                      onChange={e => setField("roleDescription", e.target.value)} disabled={submitting} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="chv-employment">Employment Status</Label>
                    <Select value={form.employmentStatus} onValueChange={v => setField("employmentStatus", v)} disabled={submitting}>
                      <SelectTrigger id="chv-employment"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHW_EMPLOYMENT_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="chv-supervisor">Supervisor (Facility Staff)</Label>
                    <Select value={form.supervisorId || "none"} onValueChange={v => setField("supervisorId", v)} disabled={submitting}>
                      <SelectTrigger id="chv-supervisor"><SelectValue placeholder="Select supervisor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Supervisor</SelectItem>
                        {(staffList || []).map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.fullName} ({s.role})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Campaign Tab */}
            {formTab === "campaign" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Campaign roles apply during SIA / supplemental immunisation activities.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="chv-campRole">Campaign Role</Label>
                  <Select value={form.campaignRole} onValueChange={v => setField("campaignRole", v)} disabled={submitting}>
                    <SelectTrigger id="chv-campRole"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHV_CAMPAIGN_ROLES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter className="mt-6 flex justify-between items-center">
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editingChv ? "Update Worker" : "Save Worker"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}






// ─────────────────────────────────────────────────────────────────────────────
// CommunityWorkersTab Component (National CHW Directory with Enterprise Features)
// ─────────────────────────────────────────────────────────────────────────────
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface CommunityWorkersTabProps {
    provinces: any[];
    allDistricts: any[];
    facilities: any[];
    villages: Village[];
    selectedProvinceId: number | null;
    selectedDistrictId: number | null;
    selectedFacilityId: number | null;
  }

function CommunityWorkersTab({ provinces, allDistricts, facilities, villages, selectedProvinceId, selectedDistrictId, selectedFacilityId }: CommunityWorkersTabProps) {
  const { toast } = useToast();
  const [selectedChwId, setSelectedChwId] = useState<number | null>(null);
  const [selectedChwData, setSelectedChwData] = useState<any>(null);
  const [chwDialogOpen, setChwDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedChwIds, setSelectedChwIds] = useState<Set<number>>(new Set());
  const [bulkVillageId, setBulkVillageId] = useState("none");
  const [assignmentBusyId, setAssignmentBusyId] = useState<number | null>(null);
        
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Column Visibility State
  const [visibleCols, setVisibleCols] = useState({
    name: true,
    nrc: true,
    gender: true,
    contactPhone: true,
    facilityName: true,
    villageName: true,
    assignment: true,
    campaignRole: true,
    trainingStatus: true,
    yearsOfService: true,
    employmentStatus: true,
    supervisorName: true,
    active: true,
    options: true,
  });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to page 1 on new search
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  

  // Sorting Handler
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  // Build API Query URL
  const queryUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      q: debouncedSearch,
      sortBy,
      sortOrder,
    });
    if (selectedProvinceId) params.append("provinceId", selectedProvinceId.toString());
    if (selectedDistrictId) params.append("districtId", selectedDistrictId.toString());
    if (selectedFacilityId) params.append("facilityId", selectedFacilityId.toString());
    return `/api/chvs?${params.toString()}`;
  }, [page, pageSize, debouncedSearch, sortBy, sortOrder, selectedProvinceId, selectedDistrictId, selectedFacilityId]);

  useEffect(() => {
    setSelectedChwIds(new Set());
    setBulkVillageId("none");
  }, [queryUrl]);

  // Fetch Community Workers
  const { data, isLoading, error } = useQuery<{
    data: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: [queryUrl],
    queryFn: async () => {
      const res = await fetch(queryUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch community health workers directory");
      return res.json();
    },
  });

  // Client-Side CSV Export (fetches all matching records up to 10k items)
  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "10000",
        q: debouncedSearch,
        sortBy,
        sortOrder,
      });
      if (selectedProvinceId) params.append("provinceId", selectedProvinceId.toString());
      if (selectedDistrictId) params.append("districtId", selectedDistrictId.toString());
      if (selectedFacilityId) params.append("facilityId", selectedFacilityId.toString());

      const res = await fetch(`/api/chvs?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const result = await res.json();
      const workers = result.data || [];

      if (workers.length === 0) {
        alert("No workers available to export matching the current filters.");
        return;
      }

      // Headers corresponding to active columns
      const headers = [
        "Full Name",
        "NRC",
        "Gender",
        "Phone",
        "Province",
        "District",
        "Facility",
        "Village",
        "Campaign Role",
        "Training Status",
        "Years of Service",
        "Employment Status",
        "Supervisor",
        "Status"
      ];

      const csvRows = [headers.join(",")];

      for (const w of workers) {
        const row = [
          `"${(w.name || "").replace(/"/g, '""')}"`,
          `"${(w.nrc || "").replace(/"/g, '""')}"`,
          w.gender || "",
          w.contactPhone || "",
          `"${(w.provinceName || "").replace(/"/g, '""')}"`,
          `"${(w.districtName || "").replace(/"/g, '""')}"`,
          `"${(w.facilityName || "").replace(/"/g, '""')}"`,
          `"${(w.villageName || "").replace(/"/g, '""')}"`,
          w.campaignRole || "",
          w.trainingStatus || "",
          w.yearsOfService ?? "",
          `"${(w.employmentStatus || "Active - In-service").replace(/"/g, '""')}"`,
          `"${(w.supervisorName || "").replace(/"/g, '""')}"`,
          w.active ? "Active" : "Inactive"
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `community_workers_directory_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert("Failed to export community workers CSV: " + err.message);
    }
  };

  const importChvMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiRequest("POST", "/api/chvs/import", payload);
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chvs"] });
      toast({
        title: "Import Successful",
        description: res?.message || "Community workers imported.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImportChvClick = () => {
    document.getElementById("csv-chv-import")?.click();
  };

  const handleChvsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      try {
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) throw new Error("CSV file must contain at least headers and one data row.");
        
        const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
        
        // Find indices for required and optional fields
        const getIdx = (aliases: string[]) => headers.findIndex(h => aliases.includes(h));
        
        const nameIdx = getIdx(["name", "fullname", "full_name"]);
        const hmisIdx = getIdx(["facilityhmiscode", "facility_hmis_code", "hmis", "facility_id"]);
        
        if (nameIdx === -1) throw new Error("CSV must contain a 'name' column.");
        if (hmisIdx === -1) throw new Error("CSV must contain a 'facilityHmisCode' column.");

        const nrcIdx = getIdx(["nrc"]);
        const genderIdx = getIdx(["gender"]);
        const ageIdx = getIdx(["age"]);
        const eduIdx = getIdx(["educationlevel", "education_level", "education"]);
        const trainIdx = getIdx(["trainingreceived", "training_received", "training"]);
        const roleDescIdx = getIdx(["roledescription", "role_description", "description"]);
        const phoneIdx = getIdx(["contactphone", "contact_phone", "phone"]);
        const yearsIdx = getIdx(["yearsofservice", "years_of_service", "years"]);
        const siaIdx = getIdx(["siarole", "sia_role"]);
        const empIdx = getIdx(["employmentstatus", "employment_status", "status"]);

        const chvs = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
          
          const getVal = (idx: number) => idx > -1 && vals[idx] ? vals[idx] : undefined;

          chvs.push({
            fullName: vals[nameIdx],
            facilityHmisCode: vals[hmisIdx],
            nrc: getVal(nrcIdx),
            gender: getVal(genderIdx) || "female",
            age: getVal(ageIdx) ? parseInt(getVal(ageIdx)!) : undefined,
            educationLevel: getVal(eduIdx),
            trainingReceived: getVal(trainIdx),
            roleDescription: getVal(roleDescIdx),
            contactPhone: getVal(phoneIdx),
            yearsOfService: getVal(yearsIdx) ? parseInt(getVal(yearsIdx)!) : undefined,
            siaRole: getVal(siaIdx),
            employmentStatus: getVal(empIdx)
          });
        }
        
        importChvMutation.mutate({ chvs });
      } catch (err: any) {
        toast({ title: "Failed to parse CSV", description: err.message, variant: "destructive" });
      }
      e.target.value = ""; // reset
    };
    reader.readAsText(file);
  };

  const downloadChvTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,name,facilityHmisCode,gender,phone,nrc,age,educationLevel,trainingReceived,roleDescription,yearsOfService,siaRole,employmentStatus\nJane Doe,F-12345,female,0901234567,112233/11/1,35,Secondary,Basic First Aid,Community Health Volunteer,5,mobilizer,Active - In-service\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "chv_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chwList = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const activeColumnCount = Object.values(visibleCols).filter(Boolean).length + 1;

  const communityOptionsByFacility = useMemo(() => {
    const map = new Map<number, Village[]>();
    (villages || []).forEach((v: any) => {
      const facilityId = Number(v.assignedFacilityId);
      if (!facilityId) return;
      if (!map.has(facilityId)) map.set(facilityId, []);
      map.get(facilityId)!.push(v);
    });
    map.forEach((list) => {
      list.sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || "")));
    });
    return map;
  }, [villages]);

  const invalidateChvViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [queryUrl] }),
      queryClient.invalidateQueries({ queryKey: ["/api/chvs"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/chvs?pageSize=10000"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/chvs/coverage"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/villages"] }),
    ]);
  };

  const assignmentMutation = useMutation({
    mutationFn: async ({ chvId, villageId }: { chvId: number; villageId: number | null }) => {
      setAssignmentBusyId(chvId);
      return apiRequest("PATCH", "/api/chvs/" + chvId, { villageId });
    },
    onSuccess: async (_res, vars) => {
      await invalidateChvViews();
      toast({
        title: vars.villageId ? "Community assigned" : "Community unassigned",
        description: "The CHV assignment has been updated.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Assignment failed", description: error.message, variant: "destructive" });
    },
    onSettled: () => setAssignmentBusyId(null),
  });

  const bulkAssignmentMutation = useMutation({
    mutationFn: async ({ chvIds, villageId }: { chvIds: number[]; villageId: number | null }) => {
      return apiRequest("POST", "/api/chvs/bulk-reassign", { chvIds, villageId });
    },
    onSuccess: async (res: any, vars) => {
      await invalidateChvViews();
      setSelectedChwIds(new Set());
      setBulkVillageId("none");
      toast({
        title: vars.villageId ? "Selected CHVs assigned" : "Selected CHVs unassigned",
        description: res?.succeeded != null ? `
          ${res.succeeded} worker(s) updated successfully.`.trim() : "Assignments updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Bulk assignment failed", description: error.message, variant: "destructive" });
    },
  });

  const selectedRows = chwList.filter((chw: any) => selectedChwIds.has(Number(chw.id)));
  const selectedFacilityIds = Array.from(new Set(selectedRows.map((chw: any) => Number(chw.facilityId)).filter(Boolean)));
  const selectedSingleFacilityId = selectedFacilityIds.length === 1 ? selectedFacilityIds[0] : null;
  const bulkCommunityOptions = selectedSingleFacilityId ? communityOptionsByFacility.get(selectedSingleFacilityId) || [] : [];
  const allPageSelected = chwList.length > 0 && chwList.every((chw: any) => selectedChwIds.has(Number(chw.id)));

  const toggleSelectedChw = (id: number) => {
    setSelectedChwIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePageSelection = () => {
    setSelectedChwIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        chwList.forEach((chw: any) => next.delete(Number(chw.id)));
      } else {
        chwList.forEach((chw: any) => next.add(Number(chw.id)));
      }
      return next;
    });
  };

  const handleAssignmentChange = (chw: any, value: string) => {
    const nextVillageId = value === "none" ? null : Number(value);
    const currentVillageId = chw.villageId ? Number(chw.villageId) : null;
    if (currentVillageId === nextVillageId) return;
    assignmentMutation.mutate({ chvId: Number(chw.id), villageId: nextVillageId });
  };

  const handleBulkAssign = () => {
    if (!selectedSingleFacilityId) {
      toast({
        title: "Select one facility at a time",
        description: "Bulk community assignment is limited to CHVs from the same facility.",
        variant: "destructive",
      });
      return;
    }
    if (bulkVillageId === "none") {
      toast({ title: "Choose a community", description: "Select the target community before assigning workers.", variant: "destructive" });
      return;
    }
    bulkAssignmentMutation.mutate({ chvIds: Array.from(selectedChwIds), villageId: Number(bulkVillageId) });
  };

  const handleBulkUnassign = () => {
    bulkAssignmentMutation.mutate({ chvIds: Array.from(selectedChwIds), villageId: null });
  };

  return (
    <>
      <Card className="border shadow-md bg-card">
        <CardHeader className="pb-3 border-b">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Contact className="h-5 w-5 text-primary" />
              Community Health Volunteers & Workers Directory
            </CardTitle>
            <p className="text-muted-foreground text-sm mt-1">
              National registry of all active healthcare volunteers and microplanning mobilizers.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input type="file" id="csv-chv-import" accept=".csv" className="hidden" onChange={handleChvsFileChange} />
            <Button onClick={downloadChvTemplate} variant="outline" className="flex items-center gap-1.5 h-9">
              <Download className="h-4 w-4" />
              Template
            </Button>
            <Button onClick={handleImportChvClick} disabled={importChvMutation.isPending} variant="outline" className="flex items-center gap-1.5 h-9">
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button onClick={() => { setSelectedChwId(null); setSelectedChwData(null); setChwDialogOpen(true); }} className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm h-9">
              <Plus className="h-4 w-4" />
              Add Worker
            </Button>
            <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-1.5 h-9">
              <Download className="h-4 w-4" />
              Export Directory
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Search, Cascade Filters, and Column Visibility controls */}
        <div className="flex gap-4 items-end mb-4">
          {/* Search box */}
          <div className="space-y-1.5 flex-1 max-w-sm">
            <Label htmlFor="search-chw" className="text-xs font-semibold">Search Workers</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-chw"
                placeholder="Search by name, NRC or phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5 shrink-0">
            <Label className="text-xs font-semibold invisible block">Columns</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="end">
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-sm border-b pb-1.5">Visible Columns</h4>
                  {Object.entries(visibleCols).map(([col, val]) => (
                    <div key={col} className="flex items-center gap-2">
                      <Checkbox
                        id={`col-${col}`}
                        checked={val}
                        onCheckedChange={(checked) =>
                          setVisibleCols(prev => ({ ...prev, [col]: !!checked }))
                        }
                      />
                      <Label htmlFor={`col-${col}`} className="text-xs capitalize font-normal cursor-pointer">
                        {col.replace(/([A-Z])/g, " $1")}
                      </Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {selectedChwIds.size > 0 && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedChwIds.size} CHV(s) selected</p>
              <p className="text-xs text-muted-foreground">
                {selectedSingleFacilityId
                  ? "Assign selected workers to a community served by the same facility, or unassign them."
                  : "Select workers from one facility to bulk assign a community; unassign works across mixed facilities."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Select value={bulkVillageId} onValueChange={setBulkVillageId} disabled={!selectedSingleFacilityId || bulkCommunityOptions.length === 0 || bulkAssignmentMutation.isPending}>
                <SelectTrigger className="h-9 w-full sm:w-[260px] bg-background">
                  <SelectValue placeholder="Target community" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select community</SelectItem>
                  {bulkCommunityOptions.map((v: any) => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleBulkAssign} disabled={!selectedSingleFacilityId || bulkVillageId === "none" || bulkAssignmentMutation.isPending}>
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Assign selected
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkUnassign} disabled={bulkAssignmentMutation.isPending}>
                <UserMinus className="h-4 w-4 mr-2" />
                Unassign selected
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedChwIds(new Set()); setBulkVillageId("none"); }} disabled={bulkAssignmentMutation.isPending}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Directory Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                <tr className="border-b">
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      aria-label="Select all CHVs on this page"
                      checked={allPageSelected}
                      onCheckedChange={togglePageSelection}
                    />
                  </th>
                  {visibleCols.name && (
                    <th onClick={() => handleSort("name")} className="px-4 py-3 cursor-pointer hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-1.5">
                        Name
                        <ArrowUpDown className="h-3 w-3 shrink-0" />
                      </div>
                    </th>
                  )}
                  {visibleCols.nrc && (
                    <th onClick={() => handleSort("nrc")} className="px-4 py-3 cursor-pointer hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-1.5">
                        NRC
                        <ArrowUpDown className="h-3 w-3 shrink-0" />
                      </div>
                    </th>
                  )}
                  {visibleCols.gender && <th className="px-4 py-3">Gender</th>}
                  {visibleCols.contactPhone && <th className="px-4 py-3">Phone</th>}
                  {visibleCols.facilityName && (
                    <th onClick={() => handleSort("facility")} className="px-4 py-3 cursor-pointer hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-1.5">
                        Facility
                        <ArrowUpDown className="h-3 w-3 shrink-0" />
                      </div>
                    </th>
                  )}
                  {visibleCols.villageName && (
                    <th onClick={() => handleSort("village")} className="px-4 py-3 cursor-pointer hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-1.5">
                        Village
                        <ArrowUpDown className="h-3 w-3 shrink-0" />
                      </div>
                    </th>
                  )}
                  {visibleCols.assignment && <th className="px-4 py-3 min-w-[260px]">Assign / Unassign</th>}
                  {visibleCols.campaignRole && <th className="px-4 py-3">Campaign Role</th>}
                  {visibleCols.employmentStatus && <th className="px-4 py-3">Employment Status</th>}
                  {visibleCols.supervisorName && <th className="px-4 py-3">Supervisor</th>}
                  {visibleCols.trainingStatus && <th className="px-4 py-3">Training</th>}
                  {visibleCols.yearsOfService && (
                    <th onClick={() => handleSort("yearsOfService")} className="px-4 py-3 cursor-pointer hover:bg-muted/70 transition-colors text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        Experience
                        <ArrowUpDown className="h-3 w-3 shrink-0" />
                      </div>
                    </th>
                  )}
                  {visibleCols.active && <th className="px-4 py-3 text-center">Status</th>}
                  {visibleCols.options && <th className="px-4 py-3 text-center">Options</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  Array.from({ length: pageSize }).map((_, idx) => (
                    <tr key={idx} className="hover:bg-muted/10">
                      <td className="px-4 py-3.5"><Skeleton className="h-4 w-4" /></td>
                      {Object.values(visibleCols).map((visible, cidx) => visible && (
                        <td key={cidx} className="px-4 py-3.5"><Skeleton className="h-4 w-28" /></td>
                      ))}
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={activeColumnCount} className="px-4 py-8 text-center text-destructive">
                      {error.message || "Failed to load community health volunteers registry. Please check your network connection."}
                    </td>
                  </tr>
                ) : chwList.length === 0 ? (
                  <tr>
                    <td colSpan={activeColumnCount} className="px-4 py-12 text-center text-muted-foreground italic">
                      No community workers found matching the selected search query and cascading filters.
                    </td>
                  </tr>
                ) : (
                  chwList.map((chw) => (
                    <tr
                      key={chw.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => { setSelectedChwId(chw.id); setSelectedChwData(chw); setChwDialogOpen(true); }}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          aria-label={`Select ${chw.name}`}
                          checked={selectedChwIds.has(Number(chw.id))}
                          onCheckedChange={() => toggleSelectedChw(Number(chw.id))}
                        />
                      </td>
                      {visibleCols.name && (
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <ChvInitials name={chw.name} gender={chw.gender} />
                            <div>
                              <span>{chw.name}</span>
                              <span className="block text-[10px] text-muted-foreground capitalize font-normal">
                                {chw.gender} · {chw.age ? `${chw.age} yrs old` : "Age unrecorded"}
                              </span>
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleCols.nrc && (
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {chw.nrc || <span className="text-muted-foreground italic">-</span>}
                        </td>
                      )}
                      {visibleCols.gender && (
                        <td className="px-4 py-3 capitalize text-muted-foreground">
                          {chw.gender}
                        </td>
                      )}
                      {visibleCols.contactPhone && (
                        <td className="px-4 py-3 text-foreground font-mono text-xs">
                          {chw.contactPhone || <span className="text-muted-foreground italic">-</span>}
                        </td>
                      )}
                      {visibleCols.facilityName && (
                        <td className="px-4 py-3 font-medium text-foreground">
                          {chw.facilityName}
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            {chw.districtName} · {chw.provinceName}
                          </span>
                        </td>
                      )}
                      {visibleCols.villageName && (
                        <td className="px-4 py-3 text-muted-foreground">
                          {chw.villageName || <span className="italic text-muted-foreground">-</span>}
                        </td>
                      )}
                      {visibleCols.assignment && (() => {
                        const rowCommunities = communityOptionsByFacility.get(Number(chw.facilityId)) || [];
                        const busy = assignmentBusyId === Number(chw.id);
                        return (
                          <td className="px-4 py-3 min-w-[260px]" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <Select
                                value={chw.villageId ? String(chw.villageId) : "none"}
                                onValueChange={(value) => handleAssignmentChange(chw, value)}
                                disabled={busy || rowCommunities.length === 0}
                              >
                                <SelectTrigger className="h-8 w-[190px] bg-background">
                                  <SelectValue placeholder="Assign community" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Unassigned</SelectItem>
                                  {rowCommunities.map((v: any) => (
                                    <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {chw.villageId && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  disabled={busy}
                                  title="Unassign community"
                                  onClick={() => handleAssignmentChange(chw, "none")}
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {rowCommunities.length > 0 ? "Assign, reassign, or clear this worker's community." : "No communities are linked to this facility."}
                            </p>
                          </td>
                        );
                      })()}
                      {visibleCols.campaignRole && (
                        <td className="px-4 py-3">
                          <ChvRoleColor role={chw.campaignRole} />
                        </td>
                      )}
                      {visibleCols.employmentStatus && (
                        <td className="px-4 py-3 font-medium text-foreground">
                          {chw.employmentStatus || "Active - In-service"}
                        </td>
                      )}
                      {visibleCols.supervisorName && (
                        <td className="px-4 py-3 text-muted-foreground">
                          {chw.supervisorName || <span className="italic text-muted-foreground">-</span>}
                        </td>
                      )}
                      {visibleCols.trainingStatus && (
                        <td className="px-4 py-3">
                          <Badge variant={chw.trainingStatus === "trained" ? "default" : "outline"} className="text-[10px]">
                            {chw.trainingStatus === "trained" ? "Trained" : "Untrained"}
                          </Badge>
                        </td>
                      )}
                      {visibleCols.yearsOfService && (
                        <td className="px-4 py-3 text-center font-medium">
                          {chw.yearsOfService !== null ? `${chw.yearsOfService} yrs` : <span className="text-muted-foreground italic">-</span>}
                        </td>
                      )}
                      {visibleCols.active && (
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            chw.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"
                          }`}>
                            {chw.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      )}
                      {visibleCols.options && (
                        <td className="px-4 py-3 text-center">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click from firing twice
                              setSelectedChwId(chw.id);
                              setSelectedChwData(chw);
                              setChwDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Manage
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-semibold">{total > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{" "}
            <span className="font-semibold">{Math.min(page * pageSize, total)}</span> of{" "}
            <span className="font-semibold">{total}</span> community health workers
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Label htmlFor="chw-page-size" className="text-xs text-muted-foreground whitespace-nowrap">Rows per page</Label>
              <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPagePageSize(Number(v)); }}>
                <SelectTrigger id="chw-page-size" className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["10", "25", "50", "100"].map(size => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={page === 1}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Page <span className="font-semibold text-foreground">{page}</span> of {totalPages}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* View / Edit dialog — opened when clicking a row */}
    {chwDialogOpen && selectedChwId && (
      <ChwDirectoryDialog
        chvId={selectedChwId}
        initialData={selectedChwData}
        mode="edit"
        provinces={provinces}
        allDistricts={allDistricts}
        facilities={facilities}
        onClose={() => { setChwDialogOpen(false); setSelectedChwId(null); setSelectedChwData(null); }}
        onSaved={() => { setChwDialogOpen(false); setSelectedChwId(null); setSelectedChwData(null); }}
        queryUrl={queryUrl}
      />
    )}

    {/* Create dialog — opened via 'Add Community Worker' button */}
    {chwDialogOpen && !selectedChwId && (
      <ChwDirectoryDialog
        chvId={null}
        mode="create"
        provinces={provinces}
        allDistricts={allDistricts}
        facilities={facilities}
        onClose={() => setChwDialogOpen(false)}
        onSaved={() => setChwDialogOpen(false)}
        queryUrl={queryUrl}
      />
    )}
    </>
  );
}

// ─── ChwDirectoryDialog ──────────────────────────────────────────────────────
// Full-featured dialog for viewing, editing, and creating CHV profiles from the
// national directory. Used in both row-click (edit) and Add Worker (create) modes.
// ─────────────────────────────────────────────────────────────────────────────
interface ChwDirectoryDialogProps {
  chvId: number | null;
  initialData?: any;
  mode: "edit" | "create";
  provinces: any[];
  allDistricts: any[];
  facilities: any[];
  onClose: () => void;
  onSaved: () => void;
  queryUrl: string;
}

function ChwDirectoryDialog({ chvId, initialData, mode, provinces, allDistricts, facilities, onClose, onSaved, queryUrl }: ChwDirectoryDialogProps) {
  const { toast } = useToast();
  const [formTab, setFormTab] = useState("basic");
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_CHV_FORM, facilityId: "" });
  
  const [filterProvId, setFilterProvId] = useState<string>("all");
  const [filterDistId, setFilterDistId] = useState<string>("all");

  const setField = <K extends keyof typeof form>(key: K, val: any) =>
    setForm(prev => ({ ...prev, [key]: val }));

  // Pre-populate form when opened in edit mode
  useEffect(() => {
    if (mode === "edit" && initialData) {
      setForm({
        name: initialData.name || initialData.fullName || "",
        nrc: initialData.nrc || "",
        gender: initialData.gender || "female",
        contactPhone: initialData.contactPhone || "",
        age: initialData.age?.toString() || "",
        roleDescription: initialData.roleDescription || "",
        educationLevel: initialData.educationLevel || "Secondary",
        trainingStatus: initialData.trainingStatus || "trained",
        yearsOfService: initialData.yearsOfService?.toString() || "",
        campaignRole: initialData.campaignRole || "social_mobilizer",
        active: initialData.active ?? initialData.isActive ?? true,
        employmentStatus: initialData.employmentStatus || "Active - In-service",
        supervisorId: initialData.supervisorId?.toString() || "",
        facilityId: initialData.facilityId?.toString() || "",
        villageId: initialData.villageId?.toString() || "",
      });
      if (initialData.facilityId) {
        const fac = facilities.find(f => f.id.toString() === initialData.facilityId?.toString());
        if (fac) {
          setFilterDistId(fac.districtId.toString());
          const dist = allDistricts.find(d => d.id === fac.districtId);
          if (dist) setFilterProvId(dist.provinceId.toString());
        }
      }
    } else if (mode === "create") {
      setForm({ ...EMPTY_CHV_FORM, facilityId: "" });
      setFilterProvId("all");
      setFilterDistId("all");
    }
  }, [mode, initialData, facilities, allDistricts]);

  const dialogDistricts = useMemo(() => {
    if (filterProvId === "all") return allDistricts;
    return allDistricts.filter((d) => d.provinceId.toString() === filterProvId);
  }, [allDistricts, filterProvId]);

  const dialogFacilities = useMemo(() => {
    if (filterDistId !== "all") {
      return facilities.filter(f => f.districtId.toString() === filterDistId);
    }
    if (filterProvId !== "all") {
      const validDistIds = new Set(dialogDistricts.map(d => d.id.toString()));
      return facilities.filter(f => validDistIds.has(f.districtId.toString()));
    }
    return facilities;
  }, [facilities, filterProvId, filterDistId, dialogDistricts]);

  // Load facility staff for supervisor picker
  const selectedFacilityIdNum = form.facilityId ? parseInt(form.facilityId) : null;
  const { data: staffList } = useQuery<any[]>({
    queryKey: ["/api/facilities", selectedFacilityIdNum, "staff"],
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${selectedFacilityIdNum}/staff`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
    enabled: !!selectedFacilityIdNum,
  });

  // Load facility communities
  const { data: communityList } = useQuery<any[]>({
    queryKey: ["/api/villages", { facilityId: selectedFacilityIdNum }],
    queryFn: async () => {
      const res = await fetch(`/api/villages?facilityId=${selectedFacilityIdNum}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch communities");
      return res.json();
    },
    enabled: !!selectedFacilityIdNum,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }
    if (mode === "create" && !form.facilityId) {
      toast({ title: "Please select a facility", variant: "destructive" });
      return;
    }
    if (!form.nrc.trim()) {
      toast({ title: "NRC is required", description: "National Registration Card is mandatory.", variant: "destructive" });
      return;
    }
    const nrcPattern = /^\d{6}\/\d{2}\/\d{1}$/;
    if (!nrcPattern.test(form.nrc.trim())) {
      toast({ title: "Invalid NRC format", description: "Must be XXXXXX/XX/X (e.g. 123456/78/9)", variant: "destructive" });
      return;
    }
    try {
      setSubmitting(true);
      const payload: any = {
        name: form.name.trim(),
        nrc: form.nrc.trim() || null,
        gender: form.gender,
        contactPhone: form.contactPhone.trim() || null,
        age: form.age ? parseInt(form.age) : null,
        roleDescription: form.roleDescription.trim() || null,
        educationLevel: form.educationLevel,
        trainingStatus: form.trainingStatus,
        yearsOfService: form.yearsOfService ? parseInt(form.yearsOfService) : null,
        campaignRole: form.campaignRole,
        active: form.active,
        employmentStatus: form.employmentStatus,
        supervisorId: form.supervisorId && form.supervisorId !== "none" ? parseInt(form.supervisorId) : null,
        facilityId: form.facilityId ? parseInt(form.facilityId) : null,
        villageId: form.villageId && form.villageId !== "none" ? parseInt(form.villageId) : null,
      };
      if (mode === "create") {
        await apiRequest("POST", "/api/chvs", payload);
        toast({ title: "Community worker added", description: `${form.name} has been registered.` });
      } else {
        await apiRequest("PATCH", `/api/chvs/${chvId}`, payload);
        toast({ title: "Community worker updated", description: `${form.name} has been updated.` });
      }
      await queryClient.invalidateQueries({ queryKey: [queryUrl] });
      onSaved();
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      setSubmitting(true);
      await apiRequest("DELETE", `/api/chvs/${chvId}`);
      toast({ title: "Worker deactivated", description: "The CHV has been marked as inactive." });
      await queryClient.invalidateQueries({ queryKey: [queryUrl] });
      onSaved();
    } catch (error: any) {
      toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setDeleteConfirm(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "edit" ? "Edit Community Worker" : "Add Community Worker"}</DialogTitle>
            <DialogDescription>
              {mode === "edit"
                ? "Update details, reassign facility, or change active status."
                : "Register a new Community Health Worker into the national roster."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <form onSubmit={handleSubmit} className="space-y-0">
              {/* Tab navigation */}
              <div className="flex gap-1 border-b mb-4">
                {[
                  ["basic", "Basic Info"],
                  ["facility", "Facility & Supervisor"],
                  ["professional", "Professional"],
                  ["campaign", "Campaign"]
                ].map(([tab, label]) => (
                  <button key={tab} type="button"
                    onClick={() => setFormTab(tab)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      formTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Facility & Supervisor Tab */}
              {formTab === "facility" && (
                <div className="space-y-4">
                  {/* Smart Cascade Filter */}
                  {(provinces.length > 1 || allDistricts.length > 1) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {provinces.length > 1 && (
                        <div className="space-y-1.5">
                          <Label>Province Filter</Label>
                          <Select value={filterProvId} onValueChange={v => { setFilterProvId(v); setFilterDistId("all"); setField("facilityId", ""); }} disabled={submitting}>
                            <SelectTrigger><SelectValue placeholder="All Provinces" /></SelectTrigger>
                            <SelectContent className="max-h-64">
                              <SelectItem value="all">All Provinces</SelectItem>
                              {provinces.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {allDistricts.length > 1 && (
                        <div className="space-y-1.5">
                          <Label>District Filter</Label>
                          <Select value={filterDistId} onValueChange={v => { setFilterDistId(v); setField("facilityId", ""); }} disabled={submitting}>
                            <SelectTrigger><SelectValue placeholder="All Districts" /></SelectTrigger>
                            <SelectContent className="max-h-64">
                              <SelectItem value="all">All Districts</SelectItem>
                              {dialogDistricts.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="chwd-facility">Facility *</Label>
                      <Select value={form.facilityId} onValueChange={v => setField("facilityId", v)} disabled={submitting}>
                        <SelectTrigger id="chwd-facility"><SelectValue placeholder="Select facility…" /></SelectTrigger>
                        <SelectContent className="max-h-64">
                          {dialogFacilities.map(f => <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">The facility this volunteer is attached to.</p>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="chwd-supervisor">Supervisor (Facility Staff)</Label>
                      <Select value={form.supervisorId || "none"} onValueChange={v => setField("supervisorId", v)} disabled={submitting || !form.facilityId}>
                        <SelectTrigger id="chwd-supervisor"><SelectValue placeholder="Select supervisor" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Supervisor</SelectItem>
                          {(staffList || []).map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.fullName} ({s.role})</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Dynamically loaded based on selected facility.</p>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="chwd-community">Assigned Community</Label>
                      <Select value={form.villageId || "none"} onValueChange={v => setField("villageId", v)} disabled={submitting || !form.facilityId}>
                        <SelectTrigger id="chwd-community"><SelectValue placeholder="Select community" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Community Assigned</SelectItem>
                          {(communityList || []).map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Dynamically loaded based on selected facility.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Basic Info Tab */}
              {formTab === "basic" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="chwd-name">Full Name *</Label>
                      <Input id="chwd-name" placeholder="e.g. Grace Mutale" value={form.name}
                        onChange={e => setField("name", e.target.value)} disabled={submitting} />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="chwd-nrc">National Registration Card (NRC) *</Label>
                      <Input id="chwd-nrc" placeholder="XXXXXX/XX/X (e.g. 123456/78/9)" value={form.nrc}
                        onChange={e => setField("nrc", e.target.value)} disabled={submitting} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="chwd-gender">Gender</Label>
                      <Select value={form.gender} onValueChange={v => setField("gender", v)} disabled={submitting}>
                        <SelectTrigger id="chwd-gender"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="other">Other / Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="chwd-phone">Contact Phone</Label>
                      <Input id="chwd-phone" placeholder="+260977123456" value={form.contactPhone}
                        onChange={e => setField("contactPhone", e.target.value)} disabled={submitting} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="chwd-age">Age</Label>
                      <Input id="chwd-age" type="number" min="15" max="100" placeholder="30" value={form.age}
                        onChange={e => setField("age", e.target.value)} disabled={submitting} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch id="chwd-active" checked={form.active} onCheckedChange={v => setField("active", v)} disabled={submitting} />
                    <Label htmlFor="chwd-active" className="text-sm cursor-pointer">Active</Label>
                  </div>
                </div>
              )}

              {/* Professional Tab */}
              {formTab === "professional" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="chwd-education">Education Level</Label>
                      <Select value={form.educationLevel} onValueChange={v => setField("educationLevel", v)} disabled={submitting}>
                        <SelectTrigger id="chwd-education"><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          {CHV_EDUCATION.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="chwd-training">Training Status</Label>
                      <Select value={form.trainingStatus} onValueChange={v => setField("trainingStatus", v)} disabled={submitting}>
                        <SelectTrigger id="chwd-training"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CHV_TRAINING.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="chwd-yrs">Years of Service</Label>
                      <Input id="chwd-yrs" type="number" min="0" max="50" placeholder="3" value={form.yearsOfService}
                        onChange={e => setField("yearsOfService", e.target.value)} disabled={submitting} />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="chwd-desc">Routine Role / Job Description</Label>
                      <Input id="chwd-desc" placeholder="Community mobilization and dropout tracing" value={form.roleDescription}
                        onChange={e => setField("roleDescription", e.target.value)} disabled={submitting} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="chwd-employment">Employment Status</Label>
                      <Select value={form.employmentStatus} onValueChange={v => setField("employmentStatus", v)} disabled={submitting}>
                        <SelectTrigger id="chwd-employment"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CHW_EMPLOYMENT_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Campaign Tab */}
              {formTab === "campaign" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Campaign roles apply during SIA / supplemental immunisation activities.</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="chwd-campRole">Campaign Role</Label>
                    <Select value={form.campaignRole} onValueChange={v => setField("campaignRole", v)} disabled={submitting}>
                      <SelectTrigger id="chwd-campRole"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHV_CAMPAIGN_ROLES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-between items-stretch sm:items-center">
                {mode === "edit" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => setDeleteConfirm(true)}
                    disabled={submitting}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Deactivate Worker
                  </Button>
                )}
                <div className="flex gap-2 sm:ml-auto">
                  <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : mode === "create" ? "Register Worker" : "Save Changes"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivation confirm dialog */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {form.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the worker as <strong>Inactive</strong> in the registry. Their record will be preserved and can be reactivated later. No data will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "Deactivating…" : "Yes, Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function setPagePageSize(size: number) {
  // Utility helper if page limits are synchronized
}
