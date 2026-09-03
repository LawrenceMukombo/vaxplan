import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  MapPin,
  Send,
  Building2,
  Users,
  Pencil,
  Trash2,
  Plus,
  Search,
  Download,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Compass,
  CheckCircle2,
  AlertCircle,
  Crosshair,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Village, Facility, District, Province } from "@shared/schema";

// Custom glowing and flashing violet pin icon for outreach posts
const OUTREACH_PIN_ICON = L.divIcon({
  html: `
    <div class="outreach-glow-marker">
      <div class="outreach-beacon-halo"></div>
      <div class="outreach-beacon-halo-delay"></div>
      <svg class="outreach-pin-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" width="26" height="36">
        <defs>
          <linearGradient id="outreachMiniGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#e879f9" />
            <stop offset="50%" stop-color="#a855f7" />
            <stop offset="100%" stop-color="#7e22ce" />
          </linearGradient>
        </defs>
        <path d="M12 0C5.37 0 0 5.37 0 12c0 9.3 12 22 12 22s12-12.7 12-22c0-6.63-5.37-12-12-12z" fill="url(#outreachMiniGrad)" stroke="#ffffff" stroke-width="1.8"/>
        <circle cx="12" cy="11" r="4.8" fill="#ffffff"/>
        <circle cx="12" cy="11" r="2.6" fill="#a855f7" class="outreach-pin-dot"/>
      </svg>
    </div>
  `,
  className: "outreach-leaflet-div-icon",
  iconSize: [32, 40],
  iconAnchor: [16, 36],
  popupAnchor: [0, -36],
});

function MiniMapLocationPicker({
  latitude,
  longitude,
  onLocationChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number, lng: number) => void;
}) {
  const defaultCenter: [number, number] = latitude && longitude ? [latitude, longitude] : [-15.4167, 28.2833];

  function MapEvents() {
    useMapEvents({
      click(e) {
        onLocationChange(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  }

  return (
    <div className="h-44 w-full rounded-xl overflow-hidden border border-border relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={latitude && longitude ? 13 : 8}
        className="h-full w-full"
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
        <MapEvents />
        {latitude !== null && longitude !== null && (
          <Marker
            position={[latitude, longitude]}
            icon={OUTREACH_PIN_ICON}
            draggable={true}
            eventHandlers={{
              dragend(e) {
                const marker = e.target;
                const pos = marker.getLatLng();
                onLocationChange(pos.lat, pos.lng);
              },
            }}
          />
        )}
      </MapContainer>
      <div className="absolute bottom-2 left-2 right-2 bg-background/85 backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] text-muted-foreground border border-border flex items-center justify-between pointer-events-none z-1000">
        <span>Click or drag the violet pin to position</span>
        <Compass className="h-3 w-3 text-purple-600 shrink-0" />
      </div>
    </div>
  );
}

export interface OutreachPostsManagerProps {
  villages: Village[];
  facilities: Facility[];
  districts: District[];
  provinces: Province[];
  selectedRegionId?: number | null;
  selectedProvinceId?: number | null;
  selectedDistrictId?: number | null;
  selectedFacilityId?: number | null;
  adminLabels?: { level1?: string; level2?: string; level3?: string; level4?: string };
  canManage?: (village?: Village) => boolean;
  onOpenOutreachModalDirectly?: (village: Village) => void;
}

export function OutreachPostsManager({
  villages,
  facilities,
  districts,
  provinces,
  selectedRegionId,
  selectedProvinceId,
  selectedDistrictId,
  selectedFacilityId,
  adminLabels = {},
  canManage = () => true,
}: OutreachPostsManagerProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "configured" | "unconfigured">("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");

  // Pagination & Sorting State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>("outreachPostName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    outreachPostName: true,
    villageName: true,
    facilityName: true,
    districtName: true,
    coordinates: true,
    distanceToFacility: true,
    population: true,
    status: true,
    actions: true,
  });

  // Modal State for CRUD
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVillage, setEditingVillage] = useState<Village | null>(null);
  const [formFacilityId, setFormFacilityId] = useState<string>("");
  const [formVillageId, setFormVillageId] = useState<string>("");
  const [formName, setFormName] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<Village | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter facilities map for rapid lookup
  const facilitiesMap = useMemo(() => {
    const map = new Map<number, Facility>();
    facilities.forEach((f) => map.set(f.id, f));
    return map;
  }, [facilities]);

  const districtsMap = useMemo(() => {
    const map = new Map<number, District>();
    districts.forEach((d) => map.set(d.id, d));
    return map;
  }, [districts]);

  // Communities available for creation in the selected facility
  const candidateVillages = useMemo(() => {
    if (!formFacilityId || formFacilityId === "all") return villages;
    const facId = Number(formFacilityId);
    return villages.filter((v) => v.assignedFacilityId === facId);
  }, [villages, formFacilityId]);

  // Filtered dataset
  const filteredVillages = useMemo(() => {
    return villages.filter((v) => {
      // Scope filters
      if (selectedFacilityId && v.assignedFacilityId !== selectedFacilityId) return false;
      if (selectedDistrictId && v.districtId !== selectedDistrictId) return false;

      // Tab filters
      if (districtFilter !== "all" && v.districtId !== Number(districtFilter)) return false;
      if (facilityFilter !== "all" && v.assignedFacilityId !== Number(facilityFilter)) return false;

      const hasOutreach = Boolean(v.outreachLatitude && v.outreachLongitude);
      if (statusFilter === "configured" && !hasOutreach) return false;
      if (statusFilter === "unconfigured" && hasOutreach) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const postName = (v.outreachPostName || "").toLowerCase();
        const commName = (v.name || "").toLowerCase();
        const facName = (facilitiesMap.get(v.assignedFacilityId ?? 0)?.name || "").toLowerCase();
        const distName = (districtsMap.get(v.districtId ?? 0)?.name || "").toLowerCase();
        return postName.includes(q) || commName.includes(q) || facName.includes(q) || distName.includes(q);
      }

      return true;
    });
  }, [
    villages,
    selectedFacilityId,
    selectedDistrictId,
    districtFilter,
    facilityFilter,
    statusFilter,
    searchQuery,
    facilitiesMap,
    districtsMap,
  ]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalVillages = villages.length;
    const configuredPosts = villages.filter((v) => v.outreachLatitude && v.outreachLongitude);
    const configuredCount = configuredPosts.length;
    const coveragePercent = totalVillages > 0 ? ((configuredCount / totalVillages) * 100).toFixed(1) : "0";

    const totalPop = configuredPosts.reduce((acc, v) => acc + (Number(v.population) || 0), 0);

    let totalDist = 0;
    let distCount = 0;
    configuredPosts.forEach((v) => {
      if (v.distanceToFacility) {
        totalDist += Number(v.distanceToFacility);
        distCount++;
      }
    });
    const avgDist = distCount > 0 ? (totalDist / distCount).toFixed(1) : "0";

    return {
      configuredCount,
      totalVillages,
      coveragePercent,
      totalPop,
      avgDist,
    };
  }, [villages]);

  // Sorting
  const sortedVillages = useMemo(() => {
    return [...filteredVillages].sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortKey === "outreachPostName") {
        valA = a.outreachPostName || a.name || "";
        valB = b.outreachPostName || b.name || "";
      } else if (sortKey === "villageName") {
        valA = a.name || "";
        valB = b.name || "";
      } else if (sortKey === "facilityName") {
        valA = facilitiesMap.get(a.assignedFacilityId ?? 0)?.name || "";
        valB = facilitiesMap.get(b.assignedFacilityId ?? 0)?.name || "";
      } else if (sortKey === "districtName") {
        valA = districtsMap.get(a.districtId ?? 0)?.name || "";
        valB = districtsMap.get(b.districtId ?? 0)?.name || "";
      } else if (sortKey === "population") {
        valA = Number(a.population) || 0;
        valB = Number(b.population) || 0;
      } else if (sortKey === "distanceToFacility") {
        valA = Number(a.distanceToFacility) || 0;
        valB = Number(b.distanceToFacility) || 0;
      } else if (sortKey === "status") {
        valA = a.outreachLatitude && a.outreachLongitude ? 1 : 0;
        valB = b.outreachLatitude && b.outreachLongitude ? 1 : 0;
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
      return sortOrder === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredVillages, sortKey, sortOrder, facilitiesMap, districtsMap]);

  // Pagination Slicing
  const totalRecords = sortedVillages.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const paginatedVillages = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedVillages.slice(start, start + pageSize);
  }, [sortedVillages, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, districtFilter, facilityFilter, pageSize]);

  // Open Modal for Create / Edit
  const handleOpenCreate = (targetVillage?: Village) => {
    if (targetVillage) {
      setEditingVillage(targetVillage);
      setFormFacilityId(targetVillage.assignedFacilityId ? String(targetVillage.assignedFacilityId) : "");
      setFormVillageId(String(targetVillage.id));
      setFormName(targetVillage.outreachPostName || `${targetVillage.name} Outreach Post`);
      setFormLat(targetVillage.outreachLatitude ? String(targetVillage.outreachLatitude) : (targetVillage.latitude ? String(targetVillage.latitude) : ""));
      setFormLng(targetVillage.outreachLongitude ? String(targetVillage.outreachLongitude) : (targetVillage.longitude ? String(targetVillage.longitude) : ""));
    } else {
      setEditingVillage(null);
      setFormFacilityId(selectedFacilityId ? String(selectedFacilityId) : "");
      setFormVillageId("");
      setFormName("");
      setFormLat("");
      setFormLng("");
    }
    setDialogOpen(true);
  };

  // Pre-fill village name if user picks village in creation mode
  const handleVillageSelect = (villageIdStr: string) => {
    setFormVillageId(villageIdStr);
    const chosen = villages.find((v) => v.id === Number(villageIdStr));
    if (chosen) {
      if (!formName || formName.endsWith("Outreach Post")) {
        setFormName(`${chosen.name} Outreach Post`);
      }
      if (!formLat && chosen.latitude) setFormLat(String(chosen.latitude));
      if (!formLng && chosen.longitude) setFormLng(String(chosen.longitude));
    }
  };

  // Save Outreach Post (Create or Update)
  const handleSave = async () => {
    const targetVillageId = editingVillage ? editingVillage.id : Number(formVillageId);
    if (!targetVillageId) {
      toast({
        title: "Community Required",
        description: "Please select the community / village for this outreach post.",
        variant: "destructive",
      });
      return;
    }

    if (!formName.trim()) {
      toast({
        title: "Post Name Required",
        description: "Please provide a descriptive name for this outreach post.",
        variant: "destructive",
      });
      return;
    }

    const latNum = parseFloat(formLat);
    const lngNum = parseFloat(formLng);
    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      toast({
        title: "Invalid Coordinates",
        description: "Latitude must be between -90 and 90; longitude must be between -180 and 180.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updated = await apiRequest<Village>("PATCH", `/api/villages/${targetVillageId}`, {
        outreachPostName: formName.trim(),
        outreachLatitude: String(latNum),
        outreachLongitude: String(lngNum),
      });

      queryClient.setQueriesData<Village[]>({ queryKey: ["/api/villages"] }, (current) =>
        Array.isArray(current)
          ? current.map((v) => (v.id === updated.id ? updated : v))
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["/api/villages"], refetchType: "none" });

      toast({
        title: "Outreach Post Saved",
        description: `Successfully configured ${formName.trim()} for ${updated.name}.`,
      });

      setDialogOpen(false);
    } catch (err: any) {
      toast({
        title: "Failed to Save Outreach Post",
        description: err.message || "An error occurred while saving the outreach post.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete / Clear Outreach Post
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const updated = await apiRequest<Village>("PATCH", `/api/villages/${deleteTarget.id}`, {
        outreachPostName: null,
        outreachLatitude: null,
        outreachLongitude: null,
      });

      queryClient.setQueriesData<Village[]>({ queryKey: ["/api/villages"] }, (current) =>
        Array.isArray(current)
          ? current.map((v) => (v.id === updated.id ? updated : v))
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["/api/villages"], refetchType: "none" });

      toast({
        title: "Outreach Post Cleared",
        description: `Removed outreach post coordinates and pin for ${deleteTarget.name}.`,
      });

      setDeleteTarget(null);
    } catch (err: any) {
      toast({
        title: "Failed to Clear Outreach Post",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      "Outreach Post Name",
      "Parent Community",
      "Linked Health Facility",
      "District",
      "Latitude",
      "Longitude",
      "Distance to Facility (km)",
      "Target Population",
      "Status",
    ];

    const rows = sortedVillages.map((v) => {
      const fac = facilitiesMap.get(v.assignedFacilityId ?? 0);
      const dist = districtsMap.get(v.districtId ?? 0);
      return [
        `"${(v.outreachPostName || "").replace(/"/g, '""')}"`,
        `"${(v.name || "").replace(/"/g, '""')}"`,
        `"${(fac?.name || "").replace(/"/g, '""')}"`,
        `"${(dist?.name || "").replace(/"/g, '""')}"`,
        v.outreachLatitude || "",
        v.outreachLongitude || "",
        v.distanceToFacility || "",
        v.population || "",
        v.outreachLatitude && v.outreachLongitude ? "Configured" : "Unconfigured",
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `outreach_posts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border/40 shadow-xs hover-elevate">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Active Outreach Posts</p>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {metrics.configuredCount.toLocaleString()}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Mapped service delivery points
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <Send className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/40 shadow-xs hover-elevate">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Community Coverage</p>
              <div className="text-2xl font-bold text-foreground">
                {metrics.coveragePercent}%
              </div>
              <p className="text-[11px] text-muted-foreground">
                {metrics.configuredCount} of {metrics.totalVillages} communities
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/40 shadow-xs hover-elevate">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Outreach Target Pop</p>
              <div className="text-2xl font-bold text-foreground">
                {metrics.totalPop.toLocaleString()}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Population reached via outreach
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/40 shadow-xs hover-elevate">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Avg Facility Distance</p>
              <div className="text-2xl font-bold text-foreground">
                {metrics.avgDist} <span className="text-sm font-normal text-muted-foreground">km</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Mean reach from host facility
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Compass className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="bg-card border-border/40 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Send className="h-5 w-5 text-purple-600" />
                <span>Outreach Posts Directory</span>
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Manage reusable immunization service delivery points, field GPS coordinates, and catchment links
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-1.5 text-xs border-border"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs border-border">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs">Toggle Visible Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.outreachPostName}
                    onCheckedChange={(c) => setVisibleColumns((prev) => ({ ...prev, outreachPostName: !!c }))}
                  >
                    Post Name
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.villageName}
                    onCheckedChange={(c) => setVisibleColumns((prev) => ({ ...prev, villageName: !!c }))}
                  >
                    Community
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.facilityName}
                    onCheckedChange={(c) => setVisibleColumns((prev) => ({ ...prev, facilityName: !!c }))}
                  >
                    Facility
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.districtName}
                    onCheckedChange={(c) => setVisibleColumns((prev) => ({ ...prev, districtName: !!c }))}
                  >
                    {adminLabels.level2 || "District"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.coordinates}
                    onCheckedChange={(c) => setVisibleColumns((prev) => ({ ...prev, coordinates: !!c }))}
                  >
                    Coordinates
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.distanceToFacility}
                    onCheckedChange={(c) => setVisibleColumns((prev) => ({ ...prev, distanceToFacility: !!c }))}
                  >
                    Distance
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.population}
                    onCheckedChange={(c) => setVisibleColumns((prev) => ({ ...prev, population: !!c }))}
                  >
                    Population
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.status}
                    onCheckedChange={(c) => setVisibleColumns((prev) => ({ ...prev, status: !!c }))}
                  >
                    Status
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="sm"
                onClick={() => handleOpenCreate()}
                className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Create Outreach Post
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-border/40 mt-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search post, village, facility..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>

            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Status Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="configured">Configured (Has Post)</SelectItem>
                <SelectItem value="unconfigured">Unconfigured (Missing Post)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={districtFilter} onValueChange={setDistrictFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={`Filter ${adminLabels.level2 || "District"}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {adminLabels.level2 || "Districts"}</SelectItem>
                {districts.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={facilityFilter} onValueChange={setFacilityFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Filter Facility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Facilities</SelectItem>
                {facilities.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-y border-border/40 select-none">
                <tr>
                  {visibleColumns.outreachPostName && (
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("outreachPostName")}>
                      <div className="flex items-center gap-1.5">
                        <span>Outreach Post Name</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.villageName && (
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("villageName")}>
                      <div className="flex items-center gap-1.5">
                        <span>Parent Community</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.facilityName && (
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("facilityName")}>
                      <div className="flex items-center gap-1.5">
                        <span>Linked Facility</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.districtName && (
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("districtName")}>
                      <div className="flex items-center gap-1.5">
                        <span>{adminLabels.level2 || "District"}</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.coordinates && (
                    <th className="px-4 py-3">Coordinates (Lat, Lng)</th>
                  )}
                  {visibleColumns.distanceToFacility && (
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("distanceToFacility")}>
                      <div className="flex items-center gap-1.5">
                        <span>Distance</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.population && (
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("population")}>
                      <div className="flex items-center gap-1.5">
                        <span>Pop. Served</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.status && (
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("status")}>
                      <div className="flex items-center gap-1.5">
                        <span>Status</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.actions && (
                    <th className="px-4 py-3 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {paginatedVillages.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Send className="h-8 w-8 text-muted-foreground/40" />
                        <p className="font-semibold text-sm">No outreach posts found</p>
                        <p className="text-xs">Adjust your search filters or create a new outreach post.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedVillages.map((v) => {
                    const fac = facilitiesMap.get(v.assignedFacilityId ?? 0);
                    const dist = districtsMap.get(v.districtId ?? 0);
                    const isConfigured = Boolean(v.outreachLatitude && v.outreachLongitude);

                    return (
                      <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                        {visibleColumns.outreachPostName && (
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {isConfigured ? (
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
                                <span>{v.outreachPostName || `${v.name} Outreach Post`}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic font-normal">Not configured</span>
                            )}
                          </td>
                        )}
                        {visibleColumns.villageName && (
                          <td className="px-4 py-3">
                            <div className="font-medium">{v.name}</div>
                            {v.isHardToReach && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/30 text-amber-600 dark:text-amber-400 mt-0.5">
                                HTR Community
                              </Badge>
                            )}
                          </td>
                        )}
                        {visibleColumns.facilityName && (
                          <td className="px-4 py-3 text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 shrink-0 text-primary/70" />
                              <span className="truncate max-w-[150px]">{fac?.name || "Unassigned"}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.districtName && (
                          <td className="px-4 py-3 text-muted-foreground">
                            {dist?.name || "-"}
                          </td>
                        )}
                        {visibleColumns.coordinates && (
                          <td className="px-4 py-3 font-mono text-[11px]">
                            {isConfigured ? (
                              <Badge variant="outline" className="bg-purple-500/5 text-purple-700 dark:text-purple-300 border-purple-500/20 font-mono">
                                {Number(v.outreachLatitude).toFixed(4)}, {Number(v.outreachLongitude).toFixed(4)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        )}
                        {visibleColumns.distanceToFacility && (
                          <td className="px-4 py-3">
                            {v.distanceToFacility ? (
                              <span className="font-mono">{Number(v.distanceToFacility).toFixed(1)} km</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        )}
                        {visibleColumns.population && (
                          <td className="px-4 py-3 font-medium">
                            {v.population ? Number(v.population).toLocaleString() : "-"}
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="px-4 py-3">
                            {isConfigured ? (
                              <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-medium">
                                Active Post
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground border-border/60">
                                Unconfigured
                              </Badge>
                            )}
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                                onClick={() => handleOpenCreate(v)}
                                title="Edit Outreach Post"
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                {isConfigured ? "Edit" : "Configure"}
                              </Button>

                              {isConfigured && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setLocation(`/map?villageId=${v.id}&outreach=true`)}
                                    title="View on Map"
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    Map
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                    onClick={() => setDeleteTarget(v)}
                                    title="Clear / Delete Outreach Post"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{totalRecords > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{" "}
              <span className="font-semibold text-foreground">{Math.min(page * pageSize, totalRecords)}</span> of{" "}
              <span className="font-semibold text-foreground">{totalRecords}</span> entries
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Rows per page:</span>
                <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
                  <SelectTrigger className="h-8 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  title="First Page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  title="Previous Page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 font-medium">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  title="Next Page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  title="Last Page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outreach Post Configuration / CRUD Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl font-sans bg-background border border-border shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-purple-600 dark:text-purple-400 flex items-center gap-2 text-lg font-bold">
              <Send className="h-5 w-5" />
              <span>{editingVillage?.outreachLatitude ? "Edit Outreach Post" : "Create New Outreach Post"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define a designated outreach vaccination point for health teams to conduct mobile immunization sessions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Facility & Village selector (if not locked to existing village) */}
            {!editingVillage ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="create-facility" className="text-xs font-semibold">
                    1. Select Health Facility
                  </Label>
                  <Select value={formFacilityId} onValueChange={(val) => { setFormFacilityId(val); setFormVillageId(""); }}>
                    <SelectTrigger id="create-facility" className="h-9 text-xs">
                      <SelectValue placeholder="Choose facility..." />
                    </SelectTrigger>
                    <SelectContent>
                      {facilities.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-village" className="text-xs font-semibold">
                    2. Select Community / Village
                  </Label>
                  <Select value={formVillageId} onValueChange={handleVillageSelect} disabled={!formFacilityId}>
                    <SelectTrigger id="create-village" className="h-9 text-xs">
                      <SelectValue placeholder={formFacilityId ? "Choose community..." : "Select facility first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {candidateVillages.map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.name} {v.outreachLatitude ? " (Has Post)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-500/20 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-purple-800 dark:text-purple-300">
                    Community: {editingVillage.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Facility: {facilitiesMap.get(editingVillage.assignedFacilityId ?? 0)?.name || "Unassigned"}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-600">
                  ID: {editingVillage.id}
                </Badge>
              </div>
            )}

            {/* Post Name */}
            <div className="space-y-1.5">
              <Label htmlFor="outreach-post-name" className="text-xs font-semibold">
                Outreach Post Name
              </Label>
              <Input
                id="outreach-post-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Village Square Outpost, Primary School Shed"
                className="h-9 text-xs"
              />
            </div>

            {/* Coordinates Inputs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Post Coordinates (Latitude & Longitude)</Label>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 text-purple-600 border-purple-500/20 hover:bg-purple-50"
                    onClick={() => {
                      const vId = editingVillage ? editingVillage.id : Number(formVillageId);
                      const target = villages.find((v) => v.id === vId);
                      if (target?.latitude && target?.longitude) {
                        setFormLat(String(target.latitude));
                        setFormLng(String(target.longitude));
                        toast({ title: "Community Center Coordinates Applied" });
                      } else {
                        toast({ title: "Community coordinates not available", variant: "destructive" });
                      }
                    }}
                  >
                    <Crosshair className="h-3 w-3 mr-1" />
                    Use Community Center
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setFormLat(String(pos.coords.latitude));
                            setFormLng(String(pos.coords.longitude));
                            toast({ title: "GPS Location Acquired" });
                          },
                          () => {
                            toast({ title: "Could not retrieve GPS location", variant: "destructive" });
                          }
                        );
                      }
                    }}
                  >
                    <Compass className="h-3 w-3 mr-1" />
                    Current GPS
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="outreach-lat" className="text-[11px] text-muted-foreground">Latitude</Label>
                  <Input
                    id="outreach-lat"
                    type="number"
                    step="any"
                    value={formLat}
                    onChange={(e) => setFormLat(e.target.value)}
                    placeholder="e.g. -15.41670"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="outreach-lng" className="text-[11px] text-muted-foreground">Longitude</Label>
                  <Input
                    id="outreach-lng"
                    type="number"
                    step="any"
                    value={formLng}
                    onChange={(e) => setFormLng(e.target.value)}
                    placeholder="e.g. 28.28330"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Interactive Mini-Map */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Interactive Location Picker</Label>
              <MiniMapLocationPicker
                latitude={formLat ? parseFloat(formLat) : null}
                longitude={formLng ? parseFloat(formLng) : null}
                onLocationChange={(lat, lng) => {
                  setFormLat(String(lat.toFixed(5)));
                  setFormLng(String(lng.toFixed(5)));
                }}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : editingVillage?.outreachLatitude ? "Update Outreach Post" : "Create Outreach Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Clear Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md font-sans bg-background border border-border shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>Clear Outreach Post?</span>
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Are you sure you want to remove the outreach post <strong>{deleteTarget?.outreachPostName || "Outreach Post"}</strong> for <strong>{deleteTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1.5 border border-border/50">
            <p className="text-foreground font-medium">What will happen:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-[11px]">
              <li>The outreach post name and GPS coordinates will be cleared.</li>
              <li>The violet pin on the GIS map will be removed.</li>
              <li>The parent community <strong>{deleteTarget?.name}</strong> will remain safe and intact in the registry.</li>
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Clearing..." : "Yes, Clear Outreach Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
