/* Original Code commented out to add useRef:
import { useState, useMemo, useCallback, useEffect } from "react";
*/
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePersistedBasemap, BasemapTileLayer } from "@/components/map/BasemapToggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/DataTable";
import { getRecordHierarchy as getRecordHierarchySh, buildGeoMaps as buildGeoMapsSh, withGeoColumns } from "@/lib/geoHierarchy";
import {
  Users,
  Plus,
  Download,
  Building2,
  Globe,
  ClipboardList,
  FileText,
  BarChart3,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Send,
  Clock,
  CornerUpLeft,
  Archive,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { canCreateData, canDeleteData } from "@/lib/permissions";
import { PopulationDialog } from "@/components/PopulationDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
// XLSX is loaded lazily on-demand only when the user clicks Export.
import type { 
  PopulationData, 
  Region, 
  Province, 
  District, 
  Village,
  Facility
} from "@shared/schema";

type PopulationSource = "nso" | "hmis" | "worldpop" | "survey" | "community_census";

interface TabConfig {
  value: PopulationSource;
  label: string;
  icon: typeof Users;
  description: string;
}

const TAB_CONFIG: TabConfig[] = [
  {
    value: "nso",
    label: "NSO Census",
    icon: Building2,
    description: "National Statistical Office official census data",
  },
  {
    value: "hmis",
    label: "HMIS (eNHIS)",
    icon: BarChart3,
    description: "Health Management Information System population estimates",
  },
  {
    value: "worldpop",
    label: "WorldPop",
    icon: Globe,
    description: "WorldPop geospatial population estimates",
  },
  {
    value: "survey",
    label: "Surveys",
    icon: ClipboardList,
    description: "Survey-based population data collection",
  },
  {
    value: "community_census",
    label: "Community Census",
    icon: FileText,
    description: "Community-conducted local census data",
  },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

/* Original Code commented out to adhere to global rules and prevent leaflet tile crash:
// Helper component to update map viewport dynamically on filter updates
function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}
*/

/* Previous attempt commented out to add value-based ref comparison to prevent infinite loop:
// Helper component to update map viewport dynamically on filter updates
// Updated to prevent Leaflet from failing with "Attempted to load an infinite number of tiles" by validating coordinates and zoom.
function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (
      center &&
      Array.isArray(center) &&
      center.length === 2 &&
      typeof center[0] === "number" &&
      typeof center[1] === "number" &&
      !isNaN(center[0]) &&
      !isNaN(center[1]) &&
      typeof zoom === "number" &&
      !isNaN(zoom) &&
      isFinite(zoom)
    ) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}
*/

// Helper component to update map viewport dynamically on filter updates
// Uses refs to track value-based changes of coordinates and zoom. This prevents infinite render loop cascades
// and Leaflet's "Attempted to load an infinite number of tiles" error when parent state changes trigger re-renders.
function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const [lat, lng] = center || [NaN, NaN];
  
  const prevCenterRef = useRef<[number, number]>([lat, lng]);
  const prevZoomRef = useRef<number>(zoom);

  useEffect(() => {
    const prevCenter = prevCenterRef.current;
    const prevZoom = prevZoomRef.current;

    // Compare values instead of array references to avoid rendering cascades
    const centerPropsChanged = prevCenter[0] !== lat || prevCenter[1] !== lng;
    const zoomPropsChanged = prevZoom !== zoom;

    if (centerPropsChanged || zoomPropsChanged) {
      if (
        typeof lat === "number" &&
        typeof lng === "number" &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        typeof zoom === "number" &&
        !isNaN(zoom) &&
        isFinite(zoom)
      ) {
        map.setView([lat, lng], zoom);
        prevCenterRef.current = [lat, lng];
        prevZoomRef.current = zoom;
      }
    }
  }, [map, lat, lng, zoom]);

  return null;
}

// Helper component to listen to click events on the map canvas itself
function MapEventsHandler({ onMapClick }: { onMapClick: () => void }) {
  useMapEvents({
    click: () => {
      onMapClick();
    }
  });
  return null;
}

interface WorkflowStepperProps {
  status: string;
}

function WorkflowStepper({ status }: WorkflowStepperProps) {
  const steps = [
    { key: "draft", label: "Draft", desc: "Creation & Edit" },
    { key: "pending", label: "Submitted", desc: "Awaiting Review" },
    { key: "under_review", label: "In Review", desc: "Detailed Check" },
    { key: "approved", label: "Approved", desc: "Locked & Active" },
  ];

  // Determine current step index
  let currentIndex = 0;
  if (status === "pending") currentIndex = 1;
  else if (status === "under_review") currentIndex = 2;
  else if (status === "approved" || status === "locked") currentIndex = 3;
  else if (status === "returned") currentIndex = 0; // returns to draft state visually
  else if (status === "rejected") currentIndex = 2; // failed during review

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-muted">
      {steps.map((step, index) => {
        const isCompleted = currentIndex > index || (currentIndex === index && status !== "returned" && status !== "rejected");
        const isCurrent = currentIndex === index;
        const isReturnedState = isCurrent && status === "returned";
        const isRejectedState = isCurrent && status === "rejected";

        let markerColor = "bg-slate-200 dark:bg-muted ring-transparent";
        let titleColor = "text-muted-foreground";

        if (isCompleted) {
          markerColor = "bg-green-500 ring-green-100 dark:ring-green-950/50";
          titleColor = "text-foreground font-semibold";
        } else if (isCurrent) {
          if (isReturnedState) {
            markerColor = "bg-orange-500 ring-orange-100 dark:ring-orange-950/50";
            titleColor = "text-orange-600 dark:text-orange-400 font-semibold";
          } else if (isRejectedState) {
            markerColor = "bg-red-500 ring-red-100 dark:ring-red-950/50";
            titleColor = "text-red-600 dark:text-red-400 font-semibold";
          } else {
            markerColor = "bg-indigo-650 ring-indigo-100 dark:ring-indigo-950/50";
            titleColor = "text-indigo-600 dark:text-indigo-400 font-semibold";
          }
        }

        return (
          <div key={step.key} className="relative flex gap-4 text-xs items-start">
            <span className={`absolute -left-[22px] flex h-[14px] w-[14px] items-center justify-center rounded-full ring-4 ${markerColor}`} />
            <div className="flex flex-col">
              <span className={titleColor}>
                {step.label}
                {isReturnedState && " (Returned)"}
                {isRejectedState && " (Rejected)"}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{step.desc}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Original Code commented out to adhere to global rules:
// Helper to extract coordinates safely from jsonb coordinates
const getAdminCoordinates = (adminRecord: any): [number, number] | null => {
  if (!adminRecord || !adminRecord.coordinates) return null;
  try {
    const coords = typeof adminRecord.coordinates === "string" 
      ? JSON.parse(adminRecord.coordinates) 
      : adminRecord.coordinates;
    
    if (Array.isArray(coords) && coords.length === 2) {
      const [c1, c2] = coords;
      if (typeof c1 === "number" && typeof c2 === "number") {
        if (Math.abs(c1) < Math.abs(c2)) {
          return [c1, c2];
        } else {
          return [c2, c1];
        }
      }
    }
    if (coords.type === "Point" && Array.isArray(coords.coordinates)) {
      const [lng, lat] = coords.coordinates;
      return [Number(lat), Number(lng)];
    }
  } catch (e) {
    // Ignore parse errors
  }
  return null;
};
*/

// Helper to extract coordinates safely from jsonb coordinates.
// Refactored to explicitly validate against NaN to prevent Leaflet infinite tile crashes.
const getAdminCoordinates = (adminRecord: any): [number, number] | null => {
  if (!adminRecord || !adminRecord.coordinates) return null;
  try {
    const coords = typeof adminRecord.coordinates === "string" 
      ? JSON.parse(adminRecord.coordinates) 
      : adminRecord.coordinates;
    
    if (Array.isArray(coords) && coords.length === 2) {
      const [c1, c2] = coords;
      if (typeof c1 === "number" && typeof c2 === "number" && !isNaN(c1) && !isNaN(c2)) {
        if (Math.abs(c1) < Math.abs(c2)) {
          return [c1, c2];
        } else {
          return [c2, c1];
        }
      }
    }
    if (coords.type === "Point" && Array.isArray(coords.coordinates)) {
      const [lng, lat] = coords.coordinates;
      const nLat = Number(lat);
      const nLng = Number(lng);
      if (!isNaN(nLat) && !isNaN(nLng)) {
        return [nLat, nLng];
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
  return null;
};

export default function Population() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [basemap] = usePersistedBasemap("positron");
  
  const [activeTab, setActiveTab] = useState<PopulationSource | "comparison">("nso");
  // Note: existing selectedProvince/selectedDistrict filters above are unified with the shared GeoCascadeFilter contract (Province → District) plus a Year filter unique to Population.
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedFacility, setSelectedFacility] = useState<string>("all");
  const [selectedRecord, setSelectedRecord] = useState<(PopulationData & { metadata?: any }) | null>(null);
  const initialPopulationParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const appliedInitialPopulationParamsRef = useRef(false);

  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentAction, setCommentAction] = useState<"return" | "reject" | "reopen" | null>(null);
  const [reviewerComment, setReviewerComment] = useState("");

  /* Original Code commented out for backward-compatibility:
  const [selectedYear, setSelectedYear] = useState<string>("all");
  */
  const [selectedYear, setSelectedYear] = useState<string>(CURRENT_YEAR.toString());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PopulationData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<PopulationData | null>(null);

  // Retrieve Tenant Context for multitenant support and premium dynamic terminology translation
  const { data: tenantInfo } = useQuery<any>({
    queryKey: ["/api/me/tenant"],
  });

  // Reset all geographic filters on tenant/country switch to prevent cross-tenant ID bleed
  useEffect(() => {
    if (tenantInfo?.id) {
      setSelectedRegion("all");
      setSelectedProvince("all");
      setSelectedDistrict("all");
      setSelectedFacility("all");
      setSelectedYear("all");
      setSelectedRecord(null);
    }
  }, [tenantInfo?.id]);

  // Reset selected record when changing tabs to prevent state leakage
  useEffect(() => {
    setSelectedRecord(null);
  }, [activeTab]);


  const skipRegionLevel = tenantInfo?.settings?.skipRegionLevel ?? (tenantInfo?.countryCode === "ZMB" || false);
  const rawAdminLabels = tenantInfo?.settings?.adminLevelLabels ?? {
    level1: "Region",
    level2: "Province",
    level3: "District",
    level4: "Constituency",
    level5: "Ward",
  };
  const adminLabels = skipRegionLevel ? {
    level1: rawAdminLabels.level2 || "Province",
    level2: rawAdminLabels.level3 || "District",
    level3: rawAdminLabels.level4 || "Constituency",
    level4: rawAdminLabels.level5 || "Ward",
    level5: "Village",
  } : rawAdminLabels;

  const { data: regions, isLoading: loadingRegions } = useQuery<Region[]>({
    queryKey: ["/api/regions"],
  });

  /*
  // Original Code: Standard static query which does not support tenant cache scopes
  const { data: provinces, isLoading: loadingProvinces } = useQuery<Province[]>({
    queryKey: ["/api/provinces"],
  });

  const { data: districts, isLoading: loadingDistricts } = useQuery<District[]>({
    queryKey: ["/api/districts"],
  });
  */

  /*
  // Pre-Refactored Code: Scoped to tenant ID but lacked custom queryFn.
  // This caused the default getQueryFn to fetch "/api/provinces/:tenantId", which resolved to a single province in routes.ts rather than an array.
  const { data: provinces, isLoading: loadingProvinces } = useQuery<Province[]>({
    queryKey: ["/api/provinces", tenantInfo?.id],
    enabled: !!tenantInfo?.id,
  });

  const { data: districts, isLoading: loadingDistricts } = useQuery<District[]>({
    queryKey: ["/api/districts", tenantInfo?.id],
    enabled: !!tenantInfo?.id,
  });
  */

  // Updated Code: Scope queries to tenant ID and use custom queryFn to fetch the array of all provinces/districts for the tenant.
  const { data: provinces, isLoading: loadingProvinces } = useQuery<Province[]>({
    queryKey: ["/api/provinces", tenantInfo?.id],
    queryFn: async () => {
      const res = await fetch("/api/provinces", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch provinces");
      return res.json();
    },
    enabled: !!tenantInfo?.id,
  });

  const { data: districts, isLoading: loadingDistricts } = useQuery<District[]>({
    queryKey: ["/api/districts", tenantInfo?.id],
    queryFn: async () => {
      const res = await fetch("/api/districts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch districts");
      return res.json();
    },
    enabled: !!tenantInfo?.id,
  });

  const { data: villages, isLoading: loadingVillages } = useQuery<Village[]>({
    queryKey: ["/api/villages"],
  });

  const { data: facilities, isLoading: loadingFacilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });

  /* Original Code:
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (activeTab !== "comparison") {
      params.set("source", activeTab);
    }
    if (selectedYear !== "all") params.set("year", selectedYear);
    return params.toString();
  }, [activeTab, selectedYear]);
  */
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (activeTab !== "comparison") {
      params.set("source", activeTab);
    }
    if (selectedYear !== "all") params.set("year", selectedYear);
    if (selectedProvince !== "all") params.set("provinceId", selectedProvince);
    if (selectedDistrict !== "all") params.set("districtId", selectedDistrict);
    if (selectedFacility !== "all") params.set("facilityId", selectedFacility);
    
    // When no geographical scope filters are selected, exclude village-level records 
    // to avoid downloading a 17MB nationwide dataset for the data grid.
    if (selectedProvince === "all" && selectedDistrict === "all" && selectedFacility === "all") {
      params.set("excludeVillages", "true");
    }
    return params.toString();
  }, [activeTab, selectedYear, selectedProvince, selectedDistrict, selectedFacility]);

  // Separate lightweight query for the heatmap — always includes village-level
  // records (with coordinates) so the density map shows even when the data grid
  // omits them for performance. Only fetches the fields needed for the map.
  const heatmapQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedYear !== "all") params.set("year", selectedYear);
    if (selectedProvince !== "all") params.set("provinceId", selectedProvince);
    if (selectedDistrict !== "all") params.set("districtId", selectedDistrict);
    if (selectedFacility !== "all") params.set("facilityId", selectedFacility);
    // NOTE: no excludeVillages — we NEED village records for the map dots
    return params.toString();
  }, [selectedYear, selectedProvince, selectedDistrict, selectedFacility]);

  const { data: heatmapPopData = [] } = useQuery<PopulationData[]>({
    queryKey: ["/api/population/heatmap", heatmapQueryParams],
    queryFn: async () => {
      const res = await fetch(`/api/population?${heatmapQueryParams}`);
      if (!res.ok) throw new Error("Failed to fetch heatmap population data");
      return res.json();
    },
    // Stale time 5 min — heatmap doesn't need to update as frequently as the table
    staleTime: 5 * 60 * 1000,
  });

  const { data: populationData, isLoading: loadingPopulation } = useQuery<PopulationData[]>({
    queryKey: ["/api/population", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/population?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch population data");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/population/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/population');
      }});
      toast({
        title: "Record Deleted",
        description: "Population record has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setDeletingRecord(null);
      setSelectedRecord(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete record.",
        variant: "destructive",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest<PopulationData>("POST", `/api/population/${id}/submit`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/population"] });
      setSelectedRecord(data);
      toast({
        title: "Submitted for Review",
        description: "The population record has been submitted for review.",
      });
    },
    onError: (err) => {
      toast({
        title: "Submission Failed",
        description: err instanceof Error ? err.message : "Failed to submit record.",
        variant: "destructive"
      });
    }
  });

  const reviewMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest<PopulationData>("POST", `/api/population/${id}/review`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/population"] });
      setSelectedRecord(data);
      toast({
        title: "Review Started",
        description: "The population record status is now set to Under Review.",
      });
    },
    onError: (err) => {
      toast({
        title: "Action Failed",
        description: err instanceof Error ? err.message : "Failed to begin review.",
        variant: "destructive"
      });
    }
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, comments }: { id: number; comments?: string }) => {
      return await apiRequest<PopulationData>("POST", `/api/population/${id}/approve`, { comments });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/population"] });
      setSelectedRecord(data);
      toast({
        title: "Record Approved",
        description: "The population record has been approved and locked.",
      });
    },
    onError: (err) => {
      toast({
        title: "Approval Failed",
        description: err instanceof Error ? err.message : "Failed to approve record.",
        variant: "destructive"
      });
    }
  });

  const workflowActionMutation = useMutation({
    mutationFn: async ({ id, action, comments }: { id: number; action: "return" | "reject" | "reopen"; comments?: string }) => {
      const endpoint = action === "return" ? "return" : action === "reject" ? "reject" : "reopen";
      return await apiRequest<PopulationData>("POST", `/api/population/${id}/${endpoint}`, { comments });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/population"] });
      setSelectedRecord(data);
      const actionLabels = {
        return: "Returned for Correction",
        reject: "Record Rejected",
        reopen: "Record Reopened"
      };
      toast({
        title: actionLabels[variables.action],
        description: `Successfully processed workflow action.`,
      });
      setCommentDialogOpen(false);
      setReviewerComment("");
    },
    onError: (err) => {
      toast({
        title: "Action Failed",
        description: err instanceof Error ? err.message : "Failed to perform action.",
        variant: "destructive"
      });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest<PopulationData>("POST", `/api/population/${id}/archive`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/population"] });
      setSelectedRecord(data);
      toast({
        title: "Record Archived",
        description: "The population record has been archived.",
      });
    },
    onError: (err) => {
      toast({
        title: "Action Failed",
        description: err instanceof Error ? err.message : "Failed to archive record.",
        variant: "destructive"
      });
    }
  });

  // 1. Memoized maps for quick O(1) lookups
  const provinceMap = useMemo(() => {
    const map = new Map<number, Province>();
    if (provinces) {
      provinces.forEach(p => map.set(Number(p.id), p));
    }
    return map;
  }, [provinces]);

  const districtMap = useMemo(() => {
    const map = new Map<number, District>();
    if (districts) {
      districts.forEach(d => map.set(Number(d.id), d));
    }
    return map;
  }, [districts]);

  const villageMap = useMemo(() => {
    const map = new Map<number, Village>();
    if (villages) {
      villages.forEach(v => map.set(Number(v.id), v));
    }
    return map;
  }, [villages]);

  const facilityMap = useMemo(() => {
    const map = new Map<number, Facility>();
    if (facilities) {
      facilities.forEach(f => map.set(Number(f.id), f));
    }
    return map;
  }, [facilities]);


  useEffect(() => {
    if (appliedInitialPopulationParamsRef.current) return;
    if (loadingProvinces || loadingDistricts || loadingFacilities) return;

    const yearParam = initialPopulationParams.get("year");
    const sourceParam = initialPopulationParams.get("source") as PopulationSource | null;
    const facilityParam = initialPopulationParams.get("facilityId");
    const districtParam = initialPopulationParams.get("districtId");
    const provinceParam = initialPopulationParams.get("provinceId");

    if (yearParam && YEARS.includes(Number(yearParam))) {
      setSelectedYear(yearParam);
    }
    if (sourceParam && TAB_CONFIG.some((tab) => tab.value === sourceParam)) {
      setActiveTab(sourceParam);
    }

    if (facilityParam) {
      const facility = facilityMap.get(Number(facilityParam));
      if (facility) {
        setSelectedFacility(facilityParam);
        if (facility.districtId) {
          setSelectedDistrict(String(facility.districtId));
          const district = districtMap.get(Number(facility.districtId));
          if (district?.provinceId) setSelectedProvince(String(district.provinceId));
        }
      }
    } else {
      if (districtParam && districtMap.has(Number(districtParam))) {
        setSelectedDistrict(districtParam);
        const district = districtMap.get(Number(districtParam));
        if (district?.provinceId) setSelectedProvince(String(district.provinceId));
      } else if (provinceParam && provinceMap.has(Number(provinceParam))) {
        setSelectedProvince(provinceParam);
      }
    }

    appliedInitialPopulationParamsRef.current = true;
  }, [districtMap, facilityMap, initialPopulationParams, loadingDistricts, loadingFacilities, loadingProvinces, provinceMap]);
  /* ORIGINAL CODE (Commented out to adhere to global rules):
  // Helper to trace geographic hierarchy for any population record.
  const getRecordHierarchy = useCallback((record: PopulationData) => {
    let districtId: number | null = null;
    let provinceId: number | null = null;

    if (record.villageId) {
      const v = villageMap.get(Number(record.villageId));
      if (v) districtId = Number(v.districtId);
    } else if (record.facilityId) {
      const f = facilityMap.get(Number(record.facilityId));
      if (f) districtId = Number(f.districtId);
    }

    if (!districtId && record.districtId) {
      districtId = Number(record.districtId);
    }

    if (districtId) {
      const d = districtMap.get(districtId);
      if (d) provinceId = Number(d.provinceId);
    }

    if (!provinceId && record.provinceId) {
      provinceId = Number(record.provinceId);
    }

    let regionId: number | null = null;
    if (provinceId) {
      const p = provinceMap.get(provinceId);
      if (p) regionId = Number(p.regionId);
    }

    return { regionId, provinceId, districtId };
  }, [provinceMap, districtMap, villageMap, facilityMap]);
  */

  // REFACTORED CODE:
  // Helper to trace geographic hierarchy for any population record.
  // Delegates Province/District resolution to the shared `getRecordHierarchySh` helper
  // (consistent rules across every page) and only layers on the Region lookup that is
  // specific to this page.
  const getRecordHierarchy = useCallback((record: PopulationData) => {
    const base = getRecordHierarchySh(record as unknown as Record<string, unknown>, {
      provinceMap,
      districtMap,
      villageMap,
      facilityMap,
    });

    let regionId: number | null = null;
    if (base.provinceId) {
      const p = provinceMap.get(Number(base.provinceId));
      if (p) regionId = Number((p as any).regionId);
    }

    return { regionId, provinceId: base.provinceId, districtId: base.districtId };
  }, [provinceMap, districtMap, villageMap, facilityMap]);

  const userCanApproveRecord = useCallback((currentUser: any, record: PopulationData | null): boolean => {
    if (!currentUser || !record) return false;
    
    // Check roles
    const roles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.role];
    const isApproverRole = roles.some((r: string) => 
      ["national_admin", "gis_specialist", "provincial_coordinator", "district_manager"].includes(r)
    );
    
    if (!isApproverRole) return false;
    if (currentUser.isPlatformAdmin || roles.includes("national_admin") || roles.includes("gis_specialist")) {
      return true;
    }
    
    const hierarchy = getRecordHierarchy(record);
    
    // Check provincial coordinator access
    if (roles.includes("provincial_coordinator")) {
      if (!currentUser.provinceId || !hierarchy.provinceId) return false;
      return Number(currentUser.provinceId) === Number(hierarchy.provinceId);
    }
    
    // Check district manager access
    if (roles.includes("district_manager")) {
      if (!currentUser.districtId || !hierarchy.districtId) return false;
      return Number(currentUser.districtId) === Number(hierarchy.districtId);
    }
    
    return false;
  }, [getRecordHierarchy]);

  const filteredPopulationData = useMemo(() => {
    if (!populationData) return [];
    return populationData.filter((item) => {
      if (activeTab !== "comparison" && item.source !== activeTab) {
        return false;
      }
      
      const hierarchy = getRecordHierarchy(item);
      
      if (selectedRegion !== "all" && Number(hierarchy.regionId) !== Number(selectedRegion)) {
        return false;
      }
      if (selectedProvince !== "all" && Number(hierarchy.provinceId) !== Number(selectedProvince)) {
        return false;
      }
      if (selectedDistrict !== "all" && Number(hierarchy.districtId) !== Number(selectedDistrict)) {
        return false;
      }
      if (selectedFacility !== "all") {
        if (item.facilityId) {
          if (Number(item.facilityId) !== Number(selectedFacility)) return false;
        } else if (item.villageId) {
          const v = villageMap.get(Number(item.villageId));
          if (!v || Number(v.assignedFacilityId) !== Number(selectedFacility)) return false;
        } else {
          return false; // exclude high-level records when facility filter is set
        }
      }
      return true;
    });
  }, [populationData, activeTab, selectedRegion, selectedProvince, selectedDistrict, selectedFacility, getRecordHierarchy, villageMap]);

  // Compute exact coordinates and populations for the density heatmap.
  // Uses heatmapPopData (which always includes village-level records) rather than
  // filteredPopulationData (which excludes villages for performance on the grid).
  const heatmapPoints = useMemo(() => {
    const points: { name: string; lat: number; lng: number; population: number }[] = [];
    const seen = new Set<string>();
    heatmapPopData.forEach(item => {
      let lat: number | null = null;
      let lng: number | null = null;
      let name = "";
      if (item.villageId) {
        const v = villageMap.get(item.villageId);
        if (v && v.latitude && v.longitude) {
          lat = Number(v.latitude);
          lng = Number(v.longitude);
          name = v.name;
        }
      } else if (item.facilityId) {
        const f = facilityMap.get(item.facilityId);
        if (f && f.latitude && f.longitude) {
          lat = Number(f.latitude);
          lng = Number(f.longitude);
          name = f.name;
        }
      }
      
      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        // Deduplicate by rounding coords to avoid stacking overlapping dots
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        if (!seen.has(key)) {
          seen.add(key);
          points.push({
            name,
            lat,
            lng,
            population: item.totalPopulation
          });
        }
      }
    });
    return points;
  }, [heatmapPopData, villageMap, facilityMap]);

  const defaultCenterAndZoom = useMemo(() => {
    const code = tenantInfo?.countryCode;
    if (code === "ZMB") {
      return { center: [-13.13, 27.85] as [number, number], zoom: 6 };
    }
    if (code === "PNG") {
      return { center: [-6.31, 143.95] as [number, number], zoom: 6 };
    }
    return { center: [-6.31, 143.95] as [number, number], zoom: 6 };
  }, [tenantInfo?.countryCode]);

  const { mapCenter, mapZoom } = useMemo(() => {
    if (selectedFacility !== "all") {
      const f = facilityMap.get(Number(selectedFacility));
      const coords = getAdminCoordinates(f);
      if (coords) return { mapCenter: coords, mapZoom: 12 };
    }

    if (selectedDistrict !== "all") {
      const d = districtMap.get(Number(selectedDistrict));
      const coords = getAdminCoordinates(d);
      if (coords) return { mapCenter: coords, mapZoom: 10 };
      
      const dPoints = heatmapPoints.filter(p => {
        const item = filteredPopulationData.find(x => x.villageId ? villageMap.get(x.villageId)?.name === p.name : false);
        return item ? Number(item.districtId) === Number(selectedDistrict) : false;
      });
      if (dPoints.length > 0) {
        let sumLat = 0, sumLng = 0;
        dPoints.forEach(p => { sumLat += p.lat; sumLng += p.lng; });
        return { mapCenter: [sumLat / dPoints.length, sumLng / dPoints.length] as [number, number], mapZoom: 10 };
      }
    }
    
    if (selectedProvince !== "all") {
      const p = provinceMap.get(Number(selectedProvince));
      const coords = getAdminCoordinates(p);
      if (coords) return { mapCenter: coords, mapZoom: 8 };
    }

    if (heatmapPoints.length > 0) {
      let sumLat = 0;
      let sumLng = 0;
      heatmapPoints.forEach(p => {
        sumLat += p.lat;
        sumLng += p.lng;
      });
      return { mapCenter: [sumLat / heatmapPoints.length, sumLng / heatmapPoints.length] as [number, number], mapZoom: 7 };
    }

    return { mapCenter: defaultCenterAndZoom.center, mapZoom: defaultCenterAndZoom.zoom };
  }, [selectedFacility, selectedDistrict, selectedProvince, heatmapPoints, districtMap, provinceMap, facilityMap, defaultCenterAndZoom, filteredPopulationData, villageMap]);

  // Memoized multi-source comparison summaries
  const comparisonSummary = useMemo(() => {
    if (activeTab !== "comparison" || !populationData) return null;

    const geoFiltered = populationData.filter((item) => {
      const hierarchy = getRecordHierarchy(item);
      
      if (selectedRegion !== "all" && Number(hierarchy.regionId) !== Number(selectedRegion)) {
        return false;
      }
      if (selectedProvince !== "all" && Number(hierarchy.provinceId) !== Number(selectedProvince)) {
        return false;
      }
      if (selectedDistrict !== "all" && Number(hierarchy.districtId) !== Number(selectedDistrict)) {
        return false;
      }
      if (selectedFacility !== "all") {
        if (item.facilityId) {
          if (Number(item.facilityId) !== Number(selectedFacility)) return false;
        } else if (item.villageId) {
          const v = villageMap.get(Number(item.villageId));
          if (!v || Number(v.assignedFacilityId) !== Number(selectedFacility)) return false;
        } else {
          return false;
        }
      }
      return true;
    });

    const sums: Record<string, { total: number; under1: number; under5: number; pregnant: number; count: number }> = {
      nso: { total: 0, under1: 0, under5: 0, pregnant: 0, count: 0 },
      hmis: { total: 0, under1: 0, under5: 0, pregnant: 0, count: 0 },
      worldpop: { total: 0, under1: 0, under5: 0, pregnant: 0, count: 0 },
      survey: { total: 0, under1: 0, under5: 0, pregnant: 0, count: 0 },
      community_census: { total: 0, under1: 0, under5: 0, pregnant: 0, count: 0 },
    };

    geoFiltered.forEach((record) => {
      const s = record.source;
      if (sums[s]) {
        sums[s].total += record.totalPopulation || 0;
        sums[s].under1 += record.under1Population || 0;
        sums[s].under5 += record.under5Population || 0;
        sums[s].pregnant += record.pregnantWomen || 0;
        sums[s].count += 1;
      }
    });

    return sums;
  }, [activeTab, populationData, selectedRegion, selectedProvince, selectedDistrict, getRecordHierarchy]);

  const activeSourcesStats = useMemo(() => {
    if (!comparisonSummary) return null;

    const sources = Object.entries(comparisonSummary)
      .filter(([_, stats]) => stats.count > 0)
      .map(([source, stats]) => ({
        source,
        label: TAB_CONFIG.find(t => t.value === source)?.label || source,
        ...stats
      }));

    if (sources.length === 0) return null;

    const nsoBaseline = comparisonSummary.nso;

    const list = sources.map((s) => {
      let devPercent = 0;
      if (s.source !== "nso" && nsoBaseline.total > 0) {
        devPercent = ((s.total - nsoBaseline.total) / nsoBaseline.total) * 100;
      }
      return {
        ...s,
        devPercent,
      };
    });

    const totalSum = sources.reduce((sum, s) => sum + s.total, 0);
    const meanEstimate = totalSum / sources.length;

    const variance = sources.reduce((sum, s) => sum + Math.pow(s.total - meanEstimate, 2), 0) / sources.length;
    const stdDeviation = Math.sqrt(variance);

    const totals = sources.map((s) => s.total);
    const maxTotal = Math.max(...totals);
    const minTotal = Math.min(...totals);
    const gap = maxTotal - minTotal;
    const gapPercent = meanEstimate > 0 ? (gap / meanEstimate) * 100 : 0;

    return {
      sourcesList: list,
      meanEstimate,
      stdDeviation,
      gap,
      gapPercent,
      nsoBaseline,
    };
  }, [comparisonSummary]);

  const isNational = useMemo(() => {
    return user?.role === "national_admin" || user?.role === "gis_specialist" || user?.isPlatformAdmin ||
      (Array.isArray(user?.roles) && (user.roles as string[]).some(r => ["national_admin", "gis_specialist"].includes(r)));
  }, [user]);

  const isProvinceLocked = useMemo(() => !isNational && !!(user?.provinceId || user?.districtId || user?.facilityId), [isNational, user]);
  const isDistrictLocked = useMemo(() => !isNational && !!(user?.districtId || user?.facilityId), [isNational, user]);
  const isFacilityLocked = useMemo(() => !isNational && !!user?.facilityId, [isNational, user]);

  const filteredProvinces = useMemo(() => {
    if (!provinces) return [];
    if (isProvinceLocked && user?.provinceId) {
      return provinces.filter(p => Number(p.id) === Number(user.provinceId));
    }
    if (isProvinceLocked && user?.districtId) {
      const dist = districtMap.get(Number(user.districtId));
      if (dist) return provinces.filter(p => Number(p.id) === Number(dist.provinceId));
    }
    if (isProvinceLocked && user?.facilityId) {
      const fac = facilityMap.get(Number(user.facilityId));
      if (fac) {
        const dist = districtMap.get(Number(fac.districtId));
        if (dist) return provinces.filter(p => Number(p.id) === Number(dist.provinceId));
      }
    }
    if (selectedRegion === "all") return provinces;
    return provinces.filter(p => Number(p.regionId) === Number(selectedRegion));
  }, [provinces, selectedRegion, isProvinceLocked, user, districtMap, facilityMap]);

  const filteredDistricts = useMemo(() => {
    if (!districts) return [];
    if (isDistrictLocked && user?.districtId) {
      return districts.filter(d => Number(d.id) === Number(user.districtId));
    }
    if (isDistrictLocked && user?.facilityId) {
      const fac = facilityMap.get(Number(user.facilityId));
      if (fac) {
        return districts.filter(d => Number(d.id) === Number(fac.districtId));
      }
    }
    if (selectedProvince !== "all") {
      return districts.filter(d => Number(d.provinceId) === Number(selectedProvince));
    }
    if (!isNational && user?.provinceId) {
      return districts.filter(d => Number(d.provinceId) === Number(user.provinceId));
    }
    if (selectedRegion !== "all" && provinces) {
      const allowedProvinceIds = new Set(
        provinces
          .filter(p => Number(p.regionId) === Number(selectedRegion))
          .map(p => Number(p.id))
      );
      return districts.filter(d => allowedProvinceIds.has(Number(d.provinceId)));
    }
    return districts;
  }, [districts, provinces, selectedRegion, selectedProvince, isDistrictLocked, user, facilityMap, isNational]);

  const filteredFacilities = useMemo(() => {
    if (!facilities) return [];
    if (isFacilityLocked && user?.facilityId) {
      return facilities.filter(f => Number(f.id) === Number(user.facilityId));
    }
    if (selectedDistrict !== "all") {
      return facilities.filter(f => Number(f.districtId) === Number(selectedDistrict));
    }
    if (selectedProvince !== "all") {
      const allowedDistrictIds = new Set(filteredDistricts.map(d => Number(d.id)));
      return facilities.filter(f => allowedDistrictIds.has(Number(f.districtId)));
    }
    if (!isNational && user?.districtId) {
      return facilities.filter(f => Number(f.districtId) === Number(user.districtId));
    }
    if (!isNational && user?.provinceId) {
      const allowedDistrictIds = new Set(
        districts?.filter(d => Number(d.provinceId) === Number(user.provinceId)).map(d => Number(d.id)) || []
      );
      return facilities.filter(f => allowedDistrictIds.has(Number(f.districtId)));
    }
    return facilities;
  }, [facilities, selectedDistrict, selectedProvince, filteredDistricts, isFacilityLocked, user, isNational, districts]);

  // Pre-populate and lock filters on load based on user role
  useEffect(() => {
    if (!user || loadingProvinces || loadingDistricts || loadingFacilities) return;

    if (user.facilityId) {
      const fId = Number(user.facilityId);
      const fac = facilityMap.get(fId);
      if (fac) {
        setSelectedFacility(fId.toString());
        const dId = fac.districtId;
        if (dId) {
          setSelectedDistrict(dId.toString());
          const dist = districtMap.get(Number(dId));
          if (dist && dist.provinceId) {
            setSelectedProvince(dist.provinceId.toString());
          }
        }
      }
    } else if (user.districtId) {
      const dId = Number(user.districtId);
      setSelectedDistrict(dId.toString());
      const dist = districtMap.get(dId);
      if (dist && dist.provinceId) {
        setSelectedProvince(dist.provinceId.toString());
      }
    } else if (user.provinceId) {
      const pId = Number(user.provinceId);
      setSelectedProvince(pId.toString());
    }
  }, [user, loadingProvinces, loadingDistricts, loadingFacilities, facilityMap, districtMap, provinceMap]);

  const isLoading = loadingRegions || loadingProvinces || loadingDistricts || loadingVillages || loadingPopulation || loadingFacilities;

  const getLocationName = (data: PopulationData): string => {
    if (data.villageId) {
      const village = villages?.find(v => v.id === data.villageId);
      return village?.name || `Village ${data.villageId}`;
    }
    if (data.districtId) {
      const district = districts?.find(d => d.id === data.districtId);
      return district?.name || `District ${data.districtId}`;
    }
    if (data.provinceId) {
      const province = provinces?.find(p => p.id === data.provinceId);
      return province?.name || `Province ${data.provinceId}`;
    }
    return "National";
  };

  const getLocationType = (data: PopulationData): string => {
    if (data.villageId) return "Village";
    if (data.districtId) return skipRegionLevel ? adminLabels.level2 : adminLabels.level3;
    if (data.provinceId) return skipRegionLevel ? adminLabels.level1 : adminLabels.level2;
    return "National";
  };

  const handleAddRecord = () => {
    setEditingRecord(null);
    setDialogOpen(true);
  };

  const handleEditRecord = (record: PopulationData) => {
    setEditingRecord(record);
    setDialogOpen(true);
  };

  const handleDeleteClick = (record: PopulationData) => {
    setDeletingRecord(record);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingRecord) {
      deleteMutation.mutate(deletingRecord.id);
    }
  };

  const getProvinceNameForRecord = (item: PopulationData) => {
    const h = getRecordHierarchy(item);
    if (!h.provinceId) return "—";
    return provinceMap.get(Number(h.provinceId))?.name ?? "—";
  };

  const getDistrictNameForRecord = (item: PopulationData) => {
    const h = getRecordHierarchy(item);
    if (!h.districtId) return "—";
    return districtMap.get(Number(h.districtId))?.name ?? "—";
  };

  const getFacilityNameForRecord = (item: PopulationData) => {
    if (item.facilityId) {
      return facilityMap.get(Number(item.facilityId))?.name ?? "—";
    }
    if (item.villageId) {
      const v = villageMap.get(Number(item.villageId));
      if (v && v.assignedFacilityId) {
        return facilityMap.get(Number(v.assignedFacilityId))?.name ?? "—";
      }
    }
    return "—";
  };

  const getCommunityNameForRecord = (item: PopulationData) => {
    if (item.villageId) {
      return villageMap.get(Number(item.villageId))?.name ?? "—";
    }
    return "—";
  };

  const columns = [
    {
      key: "_geoProvinceName",
      header: adminLabels.level1 || "Province",
      sortable: true,
      render: (item: PopulationData) => (
        <span className="text-sm">{getProvinceNameForRecord(item)}</span>
      ),
    },
    {
      key: "_geoDistrictName",
      header: adminLabels.level2 || "District",
      sortable: true,
      render: (item: PopulationData) => (
        <span className="text-sm">{getDistrictNameForRecord(item)}</span>
      ),
    },
    {
      key: "_geoFacilityName",
      header: "Facility",
      sortable: true,
      render: (item: PopulationData) => (
        <span className="text-sm font-medium">{getFacilityNameForRecord(item)}</span>
      ),
    },
    {
      key: "_geoCommunityName",
      header: "Community / Catchment",
      sortable: true,
      render: (item: PopulationData) => (
        <span className="text-sm">{getCommunityNameForRecord(item)}</span>
      ),
    },
    {
      key: "year",
      header: "Year",
      sortable: true,
      render: (item: PopulationData) => (
        <span className="font-mono">{item.year}</span>
      ),
    },
    {
      key: "totalPopulation",
      header: "Total Pop",
      sortable: true,
      render: (item: PopulationData) => (
        <span className="font-mono font-medium">
          {item.totalPopulation?.toLocaleString() || "-"}
        </span>
      ),
    },
    {
      key: "under1Population",
      header: "Under 1",
      sortable: true,
      render: (item: PopulationData) => (
        <span className="font-mono">
          {item.under1Population?.toLocaleString() || "-"}
        </span>
      ),
    },
    {
      key: "under5Population",
      header: "Under 5",
      sortable: true,
      render: (item: PopulationData) => (
        <span className="font-mono">
          {item.under5Population?.toLocaleString() || "-"}
        </span>
      ),
    },
    {
      key: "pregnantWomen",
      header: "Pregnant Women",
      sortable: true,
      render: (item: PopulationData) => (
        <span className="font-mono">
          {item.pregnantWomen?.toLocaleString() || "-"}
        </span>
      ),
    },
    {
      key: "approvalStatus",
      header: "Status",
      sortable: true,
      render: (item: PopulationData) => {
        const statusColors: Record<string, string> = {
          draft: "secondary",
          pending: "outline",
          under_review: "outline",
          approved: "default",
          returned: "outline",
          rejected: "destructive",
          locked: "secondary",
          archived: "outline",
          superseded: "outline",
        };
        const statusLabels: Record<string, string> = {
          draft: "Draft",
          pending: "Submitted",
          under_review: "Under Review",
          approved: "Approved",
          returned: "Returned",
          rejected: "Rejected",
          locked: "Locked",
          archived: "Archived",
          superseded: "Superseded",
        };
        const badgeClasses: Record<string, string> = {
          draft: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-250 dark:border-gray-700",
          pending: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/35 text-blue-400 border-blue-900/50",
          under_review: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/35 text-yellow-400 border-yellow-900/50",
          approved: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/35 text-green-400 border-green-900/50",
          returned: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/35 text-orange-400 border-orange-900/50",
          rejected: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/35 text-red-400 border-red-900/50",
          locked: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/35 text-purple-400 border-purple-900/50",
          archived: "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-850 text-zinc-400 border-zinc-700",
          superseded: "bg-muted text-foreground border-border dark:bg-background text-muted-foreground border-border",
        };
        return (
          <Badge 
            variant={statusColors[item.approvalStatus || "draft"] as any}
            className={`text-[11px] font-semibold py-0.5 px-2 rounded-full ${badgeClasses[item.approvalStatus || "draft"]}`}
          >
            {statusLabels[item.approvalStatus || "draft"]}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: PopulationData) => {
        const isLockedStatus = ["pending", "under_review", "approved", "locked", "archived", "superseded"].includes(item.approvalStatus || "");
        const canEdit = !isLockedStatus && (item.approvalStatus === "draft" || item.approvalStatus === "returned" || isNational);
        return (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRecord(item);
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
            >
              Review
            </Button>
            {canCreateData(user) && canEdit && (
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditRecord(item);
                }}
                data-testid={`button-edit-${item.id}`}
                className="h-7 w-7"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDeleteData(user) && canEdit && (
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(item);
                }}
                data-testid={`button-delete-${item.id}`}
                className="h-7 w-7 text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const handleExport = async () => {
    try {
      if (filteredPopulationData.length === 0) {
        toast({
          title: "No Data",
          description: "No population data available to export.",
          variant: "destructive",
        });
        return;
      }

      const XLSX = await import("@e965/xlsx");
      const tabLabel = TAB_CONFIG.find(t => t.value === activeTab)?.label || activeTab;
      const exportData = filteredPopulationData.map((item) => ({
        [adminLabels.level1 || "Province"]: getProvinceNameForRecord(item),
        [adminLabels.level2 || "District"]: getDistrictNameForRecord(item),
        Location: getLocationName(item),
        "Location Type": getLocationType(item),
        Year: item.year,
        "Total Population": item.totalPopulation,
        Male: item.malePopulation || "",
        Female: item.femalePopulation || "",
        "Under 1": item.under1Population || "",
        "Under 5": item.under5Population || "",
        "Pregnant Women": item.pregnantWomen || "",
        "Growth Rate": item.growthRate ? `${item.growthRate}%` : "",
        Confidence: item.confidenceScore ? `${item.confidenceScore}%` : "",
        Status: item.approvalStatus || "draft",
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, tabLabel);
      XLSX.writeFile(wb, `population_${activeTab}_${new Date().toISOString().split("T")[0]}.xlsx`);

      toast({
        title: "Export Successful",
        description: `${tabLabel} population data has been exported.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export population data.",
        variant: "destructive",
      });
    }
  };

  const handleResetFilters = () => {
    if (!isProvinceLocked) {
      setSelectedRegion("all");
      setSelectedProvince("all");
    }
    if (!isDistrictLocked) {
      setSelectedDistrict("all");
    }
    if (!isFacilityLocked) {
      setSelectedFacility("all");
    }
    setSelectedYear(CURRENT_YEAR.toString());
  };

  const totalPopulation = useMemo(() => {
    return filteredPopulationData.reduce((sum, item) => sum + (item.totalPopulation || 0), 0);
  }, [filteredPopulationData]);

  const recordCount = filteredPopulationData.length;

  if (isLoading && !populationData) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Population Data Management</h1>
          <p className="text-muted-foreground text-sm">
            Multi-source population data with location filtering
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canCreateData(user) && (
            <Button onClick={handleAddRecord} data-testid="button-add-population">
              <Plus className="h-4 w-4 mr-1" />
              Add Record
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} data-testid="button-export-population">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${skipRegionLevel ? "lg:grid-cols-5" : "lg:grid-cols-6"} gap-4`}>
            {/* If skipRegionLevel is true (Zambia), the redundant Region selector is hidden completely */}
            {!skipRegionLevel && (
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Region</label>
                <Select
                  value={selectedRegion}
                  onValueChange={(val) => {
                    setSelectedRegion(val);
                    setSelectedProvince("all");
                    setSelectedDistrict("all");
                    setSelectedFacility("all");
                  }}
                  disabled={isProvinceLocked}
                >
                  <SelectTrigger data-testid="select-region">
                    <SelectValue placeholder="All Regions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regions?.map((region) => (
                      <SelectItem key={region.id} value={region.id.toString()}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">{adminLabels.level1}</label>
              <Select
                value={selectedProvince}
                onValueChange={(val) => {
                  setSelectedProvince(val);
                  setSelectedDistrict("all");
                  setSelectedFacility("all");
                }}
                disabled={isProvinceLocked}
              >
                <SelectTrigger data-testid="select-province">
                  <SelectValue placeholder={`All ${adminLabels.level1}s`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {adminLabels.level1}s</SelectItem>
                  {filteredProvinces.map((province) => (
                    <SelectItem key={province.id} value={province.id.toString()}>
                      {province.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">{adminLabels.level2}</label>
              <Select
                value={selectedDistrict}
                onValueChange={(val) => {
                  setSelectedDistrict(val);
                  setSelectedFacility("all");
                }}
                disabled={isDistrictLocked}
              >
                <SelectTrigger data-testid="select-district">
                  <SelectValue placeholder={`All ${adminLabels.level2}s`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {adminLabels.level2}s</SelectItem>
                  {filteredDistricts.map((district) => (
                    <SelectItem key={district.id} value={district.id.toString()}>
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Health Facility</label>
              <Select
                value={selectedFacility}
                onValueChange={setSelectedFacility}
                disabled={isFacilityLocked}
              >
                <SelectTrigger data-testid="select-facility">
                  <SelectValue placeholder="All Facilities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Facilities</SelectItem>
                  {filteredFacilities.map((facility) => (
                    <SelectItem key={facility.id} value={facility.id.toString()}>
                      {facility.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger data-testid="select-year">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={handleResetFilters}
                className="w-full"
                data-testid="button-reset-filters"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Population Density Heatmap Card */}
      <Card className="border border-border/80 overflow-hidden shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-500" />
            Population Density Heatmap ({selectedYear === "all" ? "All Years" : selectedYear})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 relative">
          <div className="h-[400px] w-full relative z-10">
            {isLoading ? (
              <div className="h-full w-full flex items-center justify-center bg-secondary/20">
                <Skeleton className="h-full w-full" />
              </div>
            ) : heatmapPoints.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-secondary/10 text-muted-foreground p-6 text-center">
                <Globe className="h-10 w-10 text-muted-foreground/50 mb-2 animate-pulse" />
                <p className="font-semibold text-sm">No mapped population data</p>
                <p className="text-xs">No records with coordinates exist for the selected filters.</p>
              </div>
            ) : (
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                scrollWheelZoom={true}
                className="h-full w-full"
              >
                {/* Commented out original static TileLayer and replaced with dynamic BasemapTileLayer */}
                {/*
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                */}
                <BasemapTileLayer basemap={basemap} />
                <MapUpdater center={mapCenter} zoom={mapZoom} />
                <MapEventsHandler onMapClick={handleResetFilters} />
                {heatmapPoints.map((point, index) => {
                  const maxPop = Math.max(...heatmapPoints.map(p => p.population), 1);
                  const ratio = point.population / maxPop;
                  const hue = 100 - 100 * ratio; // 100 is green-yellow, 0 is red
                  const color = `hsl(${hue}, 100%, 45%)`;
                  const radius = 6 + 18 * Math.sqrt(ratio);
                  return (
                    <CircleMarker
                      key={`${point.name}-${index}-${point.population}`}
                      center={[point.lat, point.lng]}
                      radius={radius}
                      fillColor={color}
                      color={color}
                      weight={1.5}
                      fillOpacity={0.65}
                      eventHandlers={{
                        click: (e) => {
                          if (e.originalEvent) {
                            e.originalEvent.stopPropagation();
                          }
                          // Filter grid to match the clicked marker's province and district
                          const v = villages?.find(
                            (vl) =>
                              vl.name === point.name &&
                              vl.latitude &&
                              Number(vl.latitude) === point.lat &&
                              vl.longitude &&
                              Number(vl.longitude) === point.lng
                          );
                          if (v) {
                            const d = districtMap.get(Number(v.districtId));
                            if (d && d.provinceId) setSelectedProvince(d.provinceId.toString());
                            if (v.districtId) setSelectedDistrict(v.districtId.toString());
                          } else {
                            const f = facilities?.find(
                              (fl) =>
                                fl.name === point.name &&
                                fl.latitude &&
                                Number(fl.latitude) === point.lat &&
                                fl.longitude &&
                                Number(fl.longitude) === point.lng
                            );
                            if (f) {
                              const d = districtMap.get(Number(f.districtId));
                              if (d && d.provinceId) setSelectedProvince(d.provinceId.toString());
                              if (f.districtId) setSelectedDistrict(f.districtId.toString());
                            }
                          }
                        }
                      }}
                    >
                      <Tooltip sticky>
                        <div className="p-1 space-y-0.5">
                          <p className="font-bold text-sm">{point.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Population: <span className="font-mono font-semibold text-foreground">{point.population.toLocaleString()}</span>
                          </p>
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            )}
            
            {heatmapPoints.length > 0 && (
              <div className="absolute bottom-4 right-4 z-[1000] bg-background/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-lg space-y-2 text-xs">
                <p className="font-semibold text-foreground">Population Scale</p>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[hsl(100,100%,45%)]" />
                  <span className="text-muted-foreground">Lowest Density</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[hsl(50,100%,45%)]" />
                  <span className="text-muted-foreground">Moderate Density</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[hsl(0,100%,45%)]" />
                  <span className="text-muted-foreground">Highest Density</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/50 border border-border p-1 rounded-xl">
          {TAB_CONFIG.map((tab) => (
            <TabsTrigger 
              key={tab.value} 
              value={tab.value}
              className="flex items-center gap-1.5 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              data-testid={`tab-${tab.value}`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
          <TabsTrigger
            value="comparison"
            className="flex items-center gap-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-semibold"
            data-testid="tab-comparison"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Source Comparison & Deviations</span>
          </TabsTrigger>
        </TabsList>

        {TAB_CONFIG.map((tab) => {
          const isCurrentTabSelected = selectedRecord && selectedRecord.source === tab.value;
          return (
            <TabsContent key={tab.value} value={tab.value} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className={isCurrentTabSelected ? "lg:col-span-8 space-y-4" : "lg:col-span-12 space-y-4"}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <tab.icon className="h-5 w-5" />
                            {tab.label}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">{tab.description}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Records:</span>{" "}
                            <span className="font-medium" data-testid="text-record-count">{recordCount}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Pop:</span>{" "}
                            <span className="font-medium font-mono" data-testid="text-total-population">
                              {totalPopulation.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <DataTable
                        data={withGeoColumns(filteredPopulationData as any[], { provinceMap, districtMap, villageMap, facilityMap }) as any}
                        columns={columns}
                        searchable
                        searchKeys={["year"]}
                        emptyMessage={`No ${tab.label} population data available.`}
                        onRowClick={(item) => setSelectedRecord(item as PopulationData)}
                      />
                    </CardContent>
                  </Card>
                </div>
                {isCurrentTabSelected && (
                  <div className="lg:col-span-4 space-y-4">
                    <Card className="border border-border shadow-md bg-card sticky top-6">
                      <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <CardTitle className="text-base font-bold flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-indigo-500" />
                            Review & Workflow
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">Status details and action logs</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setSelectedRecord(null)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-5">
                        {/* Workflow Stepper */}
                        <div className="p-3 bg-muted dark:bg-background rounded-xl border border-slate-100 dark:border-border">
                          <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Approval Lifecycle</p>
                          <WorkflowStepper status={selectedRecord.approvalStatus || "draft"} />
                        </div>

                        {/* Explanation Box answering the core question */}
                        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-950/30 rounded-xl space-y-1.5 text-xs text-indigo-900/80 dark:text-indigo-300">
                          <p className="font-bold flex items-center gap-1 text-indigo-700 dark:text-indigo-400">
                            <AlertCircle className="h-3.5 w-3.5 animate-pulse" />
                            When does approval of population occur?
                          </p>
                          <p className="leading-relaxed">
                            Approval of population data occurs after the data is drafted/imported, and then formally submitted for review. Reviewers track and approve records to authorize them for cold chain microplanning, moving status from <strong>Draft</strong> &rarr; <strong>Submitted</strong> &rarr; <strong>Under Review</strong> &rarr; <strong>Approved</strong>.
                          </p>
                        </div>

                        {/* Geographic Hierarchy Details */}
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold text-foreground uppercase tracking-wider">Geographic Info</p>
                          <div className="grid grid-cols-2 gap-2 p-3 bg-muted/30 border border-border rounded-xl">
                            <div>
                              <span className="text-muted-foreground block text-[10px]">Province</span>
                              <span className="font-medium text-foreground">{getProvinceNameForRecord(selectedRecord)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px]">District</span>
                              <span className="font-medium text-foreground">{getDistrictNameForRecord(selectedRecord)}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground block text-[10px]">Health Facility</span>
                              <span className="font-medium text-foreground">{getFacilityNameForRecord(selectedRecord)}</span>
                            </div>
                            {selectedRecord.villageId && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground block text-[10px]">Community / Catchment</span>
                                <span className="font-medium text-foreground">{getCommunityNameForRecord(selectedRecord)}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground block text-[10px]">Year</span>
                              <span className="font-medium text-foreground">{selectedRecord.year}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px]">Confidence</span>
                              <span className="font-medium text-foreground">{selectedRecord.confidenceScore ? `${selectedRecord.confidenceScore}%` : "N/A"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Demographics Metrics */}
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold text-foreground uppercase tracking-wider">Demographic Metrics</p>
                          <div className="grid grid-cols-2 gap-2 p-3 bg-muted/30 border border-border rounded-xl font-mono">
                            <div>
                              <span className="text-muted-foreground block text-[10px] font-sans">Total Population</span>
                              <span className="font-bold text-foreground text-sm">{selectedRecord.totalPopulation?.toLocaleString() || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] font-sans">Under 1 Year</span>
                              <span className="font-bold text-foreground text-sm">{selectedRecord.under1Population?.toLocaleString() || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] font-sans">Under 5 Years</span>
                              <span className="font-bold text-foreground text-sm">{selectedRecord.under5Population?.toLocaleString() || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] font-sans">Pregnant Women</span>
                              <span className="font-bold text-foreground text-sm">{selectedRecord.pregnantWomen?.toLocaleString() || "—"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Audit Trail & Comments */}
                        <div className="space-y-2.5 text-xs border-t border-border pt-4">
                          <p className="font-semibold text-foreground uppercase tracking-wider">Audit Trail & Feedback</p>
                          
                          <div className="space-y-2">
                            {selectedRecord.metadata?.submittedBy && (
                              <div className="flex justify-between text-muted-foreground border-b border-dashed border-border/60 pb-1">
                                <span>Submitted By:</span>
                                <span className="text-foreground text-right font-medium">
                                  {selectedRecord.metadata.submittedBy} <br/>
                                  <span className="text-[10px] text-muted-foreground">{(selectedRecord.metadata.submittedAt ? new Date(selectedRecord.metadata.submittedAt).toLocaleDateString() : "")}</span>
                                </span>
                              </div>
                            )}
                            {selectedRecord.metadata?.underReviewBy && (
                              <div className="flex justify-between text-muted-foreground border-b border-dashed border-border/60 pb-1">
                                <span>Reviewed By:</span>
                                <span className="text-foreground text-right font-medium">
                                  {selectedRecord.metadata.underReviewBy} <br/>
                                  <span className="text-[10px] text-muted-foreground">{(selectedRecord.metadata.underReviewAt ? new Date(selectedRecord.metadata.underReviewAt).toLocaleDateString() : "")}</span>
                                </span>
                              </div>
                            )}
                            {selectedRecord.metadata?.approvedBy && (
                              <div className="flex justify-between text-muted-foreground border-b border-dashed border-border/60 pb-1">
                                <span>Approved By:</span>
                                <span className="text-foreground text-right font-medium">
                                  {selectedRecord.metadata.approvedBy} <br/>
                                  <span className="text-[10px] text-muted-foreground">{(selectedRecord.metadata.approvedAt ? new Date(selectedRecord.metadata.approvedAt).toLocaleDateString() : "")}</span>
                                </span>
                              </div>
                            )}
                            {selectedRecord.metadata?.returnedBy && (
                              <div className="flex justify-between text-muted-foreground border-b border-dashed border-border/60 pb-1">
                                <span>Returned By:</span>
                                <span className="text-foreground text-right font-medium">
                                  {selectedRecord.metadata.returnedBy} <br/>
                                  <span className="text-[10px] text-muted-foreground">{(selectedRecord.metadata.returnedAt ? new Date(selectedRecord.metadata.returnedAt).toLocaleDateString() : "")}</span>
                                </span>
                              </div>
                            )}
                            {selectedRecord.metadata?.rejectedBy && (
                              <div className="flex justify-between text-muted-foreground border-b border-dashed border-border/60 pb-1">
                                <span>Rejected By:</span>
                                <span className="text-foreground text-right font-medium">
                                  {selectedRecord.metadata.rejectedBy} <br/>
                                  <span className="text-[10px] text-muted-foreground">{(selectedRecord.metadata.rejectedAt ? new Date(selectedRecord.metadata.rejectedAt).toLocaleDateString() : "")}</span>
                                </span>
                              </div>
                            )}
                            {selectedRecord.metadata?.reopenedBy && (
                              <div className="flex justify-between text-muted-foreground border-b border-dashed border-border/60 pb-1">
                                <span>Reopened By:</span>
                                <span className="text-foreground text-right font-medium">
                                  {selectedRecord.metadata.reopenedBy} <br/>
                                  <span className="text-[10px] text-muted-foreground">{(selectedRecord.metadata.reopenedAt ? new Date(selectedRecord.metadata.reopenedAt).toLocaleDateString() : "")}</span>
                                </span>
                              </div>
                            )}
                          </div>

                          {selectedRecord.metadata?.comments && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-950/20 rounded-xl space-y-1 mt-2 text-amber-900/80 dark:text-amber-300">
                              <p className="font-semibold flex items-center gap-1">
                                Reviewer Comments:
                              </p>
                              <p className="italic">"{selectedRecord.metadata.comments}"</p>
                            </div>
                          )}
                        </div>

                        {/* Workflow Buttons */}
                        <div className="space-y-2 border-t border-border pt-4">
                          <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Available Actions</p>
                          
                          {/* Draft/Returned: Submit */}
                          {(selectedRecord.approvalStatus === "draft" || selectedRecord.approvalStatus === "returned") && canCreateData(user) && (
                            <Button
                              className="w-full justify-center bg-indigo-650 hover:bg-indigo-500 text-white rounded-xl shadow"
                              onClick={() => submitMutation.mutate(selectedRecord.id)}
                              disabled={submitMutation.isPending}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Submit for Review
                            </Button>
                          )}

                          {/* Pending: Review (Mark Under Review) */}
                          {selectedRecord.approvalStatus === "pending" && userCanApproveRecord(user, selectedRecord) && (
                            <Button
                              className="w-full justify-center bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl shadow"
                              onClick={() => reviewMutation.mutate(selectedRecord.id)}
                              disabled={reviewMutation.isPending}
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Mark Under Review
                            </Button>
                          )}

                          {/* Under Review or Pending: Approve / Return / Reject */}
                          {(selectedRecord.approvalStatus === "pending" || selectedRecord.approvalStatus === "under_review") && userCanApproveRecord(user, selectedRecord) && (
                            <div className="grid grid-cols-1 gap-2">
                              <Button
                                className="w-full justify-center bg-green-600 hover:bg-green-500 text-white rounded-xl shadow"
                                onClick={() => approveMutation.mutate({ id: selectedRecord.id })}
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Approve Record
                              </Button>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  variant="outline"
                                  className="justify-center border-orange-500/35 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-orange-600 dark:text-orange-400 rounded-xl"
                                  onClick={() => {
                                    setCommentAction("return");
                                    setCommentDialogOpen(true);
                                  }}
                                >
                                  <CornerUpLeft className="h-4 w-4 mr-1.5" />
                                  Return
                                </Button>
                                <Button
                                  variant="outline"
                                  className="justify-center border-red-500/35 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-600 rounded-xl"
                                  onClick={() => {
                                    setCommentAction("reject");
                                    setCommentDialogOpen(true);
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-1.5" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Approved / Rejected: Reopen */}
                          {(selectedRecord.approvalStatus === "approved" || selectedRecord.approvalStatus === "rejected") && userCanApproveRecord(user, selectedRecord) && (
                            <Button
                              variant="outline"
                              className="w-full justify-center border-indigo-500/35 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl"
                              onClick={() => {
                                setCommentAction("reopen");
                                setCommentDialogOpen(true);
                              }}
                            >
                              <Unlock className="h-4 w-4 mr-2" />
                              Reopen for Correction
                            </Button>
                          )}

                          {/* Approved: Archive (Only National Admins) */}
                          {selectedRecord.approvalStatus === "approved" && isNational && (
                            <Button
                              variant="outline"
                              className="w-full justify-center border-zinc-500/35 hover:bg-zinc-50 dark:hover:bg-zinc-950/20 text-zinc-600 dark:text-zinc-400 rounded-xl"
                              onClick={() => archiveMutation.mutate(selectedRecord.id)}
                              disabled={archiveMutation.isPending}
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Archive Record
                            </Button>
                          )}

                          {/* Edit/Delete for draft/returned */}
                          {!["pending", "under_review", "approved", "locked", "archived", "superseded"].includes(selectedRecord.approvalStatus || "") && (selectedRecord.approvalStatus === "draft" || selectedRecord.approvalStatus === "returned" || isNational) && (
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-border/80">
                              {canCreateData(user) && (
                                <Button
                                  variant="secondary"
                                  className="justify-center rounded-xl"
                                  onClick={() => handleEditRecord(selectedRecord)}
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                  Edit Data
                                </Button>
                              )}
                              {canDeleteData(user) && (
                                <Button
                                  variant="ghost"
                                  className="justify-center text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                                  onClick={() => handleDeleteClick(selectedRecord)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                  Delete
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>
          );
        })}

        <TabsContent value="comparison" className="space-y-6">
          {!activeSourcesStats ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No population records exist for the selected filters to compute comparative statistics.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border border-border bg-card">
                  <CardContent className="p-4 space-y-2">
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">NSO Census Baseline</span>
                    <span className="text-2xl font-bold font-mono block text-foreground">
                      {activeSourcesStats.nsoBaseline.total.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Primary administrative baseline
                    </span>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card">
                  <CardContent className="p-4 space-y-2">
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Mean Estimate</span>
                    <span className="text-2xl font-bold font-mono block text-indigo-500 dark:text-indigo-400">
                      {Math.round(activeSourcesStats.meanEstimate).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Consensus average of active sources
                    </span>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card">
                  <CardContent className="p-4 space-y-2">
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Standard Deviation</span>
                    <span className="text-2xl font-bold font-mono block text-foreground">
                      {Math.round(activeSourcesStats.stdDeviation).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Spread variance between estimates
                    </span>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card">
                  <CardContent className="p-4 space-y-2">
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Discrepancy Gap</span>
                    <span className="text-2xl font-bold font-mono block text-foreground">
                      {activeSourcesStats.gap.toLocaleString()}
                    </span>
                    <Badge variant="outline" className={`text-[10px] py-0 px-2 rounded mt-1 ${
                      activeSourcesStats.gapPercent > 15 
                        ? "bg-red-500/10 text-red-500 border-red-500/20" 
                        : activeSourcesStats.gapPercent > 5 
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    }`}>
                      {activeSourcesStats.gapPercent.toFixed(1)}% Gap
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Deviation Details Table Card */}
              <Card className="border border-border bg-card">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-500" />
                    Multi-Source Population Divergence
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse text-foreground">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                        <th className="pb-3 pl-2">Data Source</th>
                        <th className="pb-3 text-right">Total Population</th>
                        <th className="pb-3 text-right">Under 1</th>
                        <th className="pb-3 text-right">Under 5</th>
                        <th className="pb-3 text-right">Pregnant Women</th>
                        <th className="pb-3 text-right">Divergence from Census</th>
                        <th className="pb-3 pr-2 text-right">Records Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSourcesStats.sourcesList.map((s) => {
                        const absDev = Math.abs(s.devPercent);
                        let badgeColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                        let statusText = "High Consensus";
                        if (s.source !== "nso") {
                          if (absDev > 15) {
                            badgeColor = "bg-red-500/10 text-red-500 border-red-500/20";
                            statusText = "High Discrepancy";
                          } else if (absDev > 5) {
                            badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                            statusText = "Moderate Divergence";
                          }
                        } else {
                          badgeColor = "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
                          statusText = "Baseline";
                        }

                        return (
                          <tr key={s.source} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="py-3 pl-2 font-medium flex items-center gap-2">
                              {s.label}
                            </td>
                            <td className="py-3 text-right font-mono">{s.total.toLocaleString()}</td>
                            <td className="py-3 text-right font-mono">{s.under1.toLocaleString()}</td>
                            <td className="py-3 text-right font-mono">{s.under5.toLocaleString()}</td>
                            <td className="py-3 text-right font-mono">{s.pregnant.toLocaleString()}</td>
                            <td className="py-3 text-right">
                              {s.source === "nso" ? (
                                <Badge className={badgeColor} variant="outline">
                                  Baseline Reference
                                </Badge>
                              ) : (
                                <Badge className={badgeColor} variant="outline">
                                  {s.devPercent > 0 ? "+" : ""}{s.devPercent.toFixed(1)}% ({statusText})
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 pr-2 text-right font-mono text-muted-foreground">{s.count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Operational Recommendations Card */}
              {(() => {
                const maxDev = Math.max(...activeSourcesStats.sourcesList.map(s => Math.abs(s.devPercent)));
                let adviceTitle = "High Alignment Detected";
                let adviceDesc = "All configured population datasets are within 5% of the NSO baseline. This high consensus indicates high data confidence. You can proceed with standard cold chain microplanning, buffer stocks, and session approvals using NSO Census figures directly.";
                let adviceBg = "bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400";
                let adviceIconColor = "text-emerald-500";

                if (maxDev > 15) {
                  adviceTitle = "Critical Geographic Target Discrepancy Warning";
                  adviceDesc = "A deviation exceeding 15% has been detected between NSO and secondary sources (e.g. WorldPop or Community headcounts). Proceeding with standard NSO estimates risks severe vaccine stockouts in high-growth districts, or wasting expensive vials in declining catchments. Action: We highly recommend mobilizing local Community Health Workers (CHWs) to conduct household verification in these catchments before allocating vaccine vials or cold chain budgets.";
                  adviceBg = "bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-400";
                  adviceIconColor = "text-red-500";
                } else if (maxDev > 5) {
                  adviceTitle = "Moderate Discrepancy Identified - Microplanning Review Recommended";
                  adviceDesc = "A moderate deviation (5% - 15%) exists between census estimates and active clinic registrations. Recommend using the consensus weighted population mean of " + Math.round(activeSourcesStats.meanEstimate).toLocaleString() + " for resource budgeting, while scheduling a quick catchment check to reconcile registration gaps.";
                  adviceBg = "bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400";
                  adviceIconColor = "text-amber-500";
                }

                return (
                  <Card className={`border ${adviceBg}`}>
                    <CardContent className="p-5 flex gap-4 items-start">
                      <AlertCircle className={`h-6 w-6 shrink-0 mt-0.5 ${adviceIconColor}`} />
                      <div className="space-y-2">
                        <h4 className="font-bold text-base text-foreground">{adviceTitle}</h4>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {adviceDesc}
                        </p>
                        <div className="flex gap-2 pt-2">
                          {maxDev > 15 && (
                            <Button 
                              size="sm" 
                              className="bg-red-600 hover:bg-red-500 text-white rounded-xl"
                              onClick={() => toast({ title: "Verification Task Queued", description: "CHW Headcount task registered for high-deviation villages." })}
                            >
                              Launch CHW Headcount Task
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="rounded-xl border-current text-foreground" onClick={() => window.print()}>
                            Print Deviation Report
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </>
          )}
        </TabsContent>
      </Tabs>

      <PopulationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editData={editingRecord}
        defaultSource={activeTab === "comparison" ? undefined : activeTab}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Population Record"
        description={`Are you sure you want to delete this population record for ${deletingRecord ? getLocationName(deletingRecord) : "this location"}? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        isPending={deleteMutation.isPending}
      />

      {/* Reviewer Comments Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {commentAction === "return" && (
                <>
                  <CornerUpLeft className="h-5 w-5 text-orange-500" />
                  Return for Correction
                </>
              )}
              {commentAction === "reject" && (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Reject Record
                </>
              )}
              {commentAction === "reopen" && (
                <>
                  <Unlock className="h-5 w-5 text-indigo-500" />
                  Reopen Record
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {commentAction === "return" && "Please provide feedback or instructions explaining why this record is being returned for correction."}
              {commentAction === "reject" && "Please state the reasons for rejecting this population record. This will be logged permanently in the audit trail."}
              {commentAction === "reopen" && "Please specify the correction needed that justifies reopening this approved/rejected record."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="comments">Reviewer Comments</Label>
              <Textarea
                id="comments"
                placeholder="Enter comments here..."
                value={reviewerComment}
                onChange={(e) => setReviewerComment(e.target.value)}
                className="h-24 rounded-xl resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              className={
                commentAction === "return"
                  ? "bg-orange-600 hover:bg-orange-500 text-white rounded-xl"
                  : commentAction === "reject"
                  ? "bg-red-600 hover:bg-red-500 text-white rounded-xl"
                  : "bg-indigo-650 hover:bg-indigo-500 text-white rounded-xl"
              }
              onClick={() => {
                if (selectedRecord && commentAction) {
                  workflowActionMutation.mutate({
                    id: selectedRecord.id,
                    action: commentAction,
                    comments: reviewerComment,
                  });
                }
              }}
              disabled={workflowActionMutation.isPending}
            >
              {commentAction === "return" ? "Return for Correction" : commentAction === "reject" ? "Reject Record" : "Reopen Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
