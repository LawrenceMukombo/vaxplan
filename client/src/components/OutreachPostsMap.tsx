import { useState, useMemo, useEffect } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePersistedBasemap, BasemapTileLayer, BasemapSwitcher } from "@/components/map/BasemapToggle";
import { createFacilityCircleIcon } from "@/lib/mapIcons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MapPin,
  Hospital,
  Users,
  Compass,
  Search,
  Copy,
  Check,
  RotateCcw,
  Edit3,
  Layers,
  Send,
  AlertCircle,
  Activity,
  List,
} from "lucide-react";
import type { Village, Facility, District, Province } from "@shared/schema";

// Custom violet pin icon for configured outreach posts
const createOutreachPinIcon = (isHovered = false): L.DivIcon => {
  const size = isHovered ? 34 : 28;
  const height = isHovered ? 42 : 36;
  return L.divIcon({
    html: `
      <div style="position: relative; width: ${size}px; height: ${height}px; filter: drop-shadow(0 2px 5px rgba(139, 92, 246, 0.45)); transition: transform 0.15s ease;">
        <svg width="${size}" height="${height}" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.26801 0 0 6.26801 0 14C0 23.5 12.5 35 14 36C15.5 35 28 23.5 28 14C28 6.26801 21.732 0 14 0Z" fill="#8b5cf6" stroke="#ffffff" stroke-width="2"/>
          <circle cx="14" cy="13" r="6" fill="#ffffff"/>
          <circle cx="14" cy="13" r="3" fill="#7c3aed"/>
        </svg>
      </div>
    `,
    className: "outreach-post-marker",
    iconSize: [size, height],
    iconAnchor: [size / 2, height],
    popupAnchor: [0, -height + 4],
  });
};

interface FitBoundsProps {
  bounds: L.LatLngBoundsExpression | null;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

function MapController({ bounds, defaultCenter = [-28.4793, 24.6727], defaultZoom = 6 }: FitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch {
        map.setView(defaultCenter, defaultZoom);
      }
    } else {
      map.setView(defaultCenter, defaultZoom);
    }
  }, [map, bounds, defaultCenter, defaultZoom]);

  return null;
}

export interface OutreachPostsMapProps {
  villages: Village[];
  facilities: Facility[];
  districts: District[];
  provinces: Province[];
  selectedRegionId?: number | null;
  selectedProvinceId?: number | null;
  selectedDistrictId?: number | null;
  selectedFacilityId?: number | null;
  adminLabels?: { level1?: string; level2?: string; level3?: string; level4?: string };
  onEditPost?: (village: Village) => void;
  onSwitchToTable?: () => void;
}

export function OutreachPostsMap({
  villages,
  facilities,
  districts,
  provinces: _provinces,
  selectedRegionId: _selectedRegionId,
  selectedProvinceId: _selectedProvinceId,
  selectedDistrictId,
  selectedFacilityId,
  adminLabels = {},
  onEditPost,
  onSwitchToTable,
}: OutreachPostsMapProps) {
  const [basemap, setBasemap] = usePersistedBasemap();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [districtFilter, setDistrictFilter] = useState<string>(
    selectedDistrictId ? String(selectedDistrictId) : "all"
  );
  const [facilityFilter, setFacilityFilter] = useState<string>(
    selectedFacilityId ? String(selectedFacilityId) : "all"
  );

  // Map layer controls
  const [showFlightLines, setShowFlightLines] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showReachRadius, setShowReachRadius] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Fast lookups
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

  // Extract all configured outreach posts
  const allConfiguredPosts = useMemo(() => {
    return villages.filter((v) => {
      const lat = v.outreachLatitude ? parseFloat(String(v.outreachLatitude)) : NaN;
      const lng = v.outreachLongitude ? parseFloat(String(v.outreachLongitude)) : NaN;
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }, [villages]);

  // Filtered outreach posts
  const filteredPosts = useMemo(() => {
    return allConfiguredPosts.filter((v) => {
      if (districtFilter !== "all" && v.districtId !== Number(districtFilter)) {
        return false;
      }
      if (facilityFilter !== "all" && v.assignedFacilityId !== Number(facilityFilter)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const postName = (v.outreachPostName || "").toLowerCase();
        const commName = (v.name || "").toLowerCase();
        const facName = (facilitiesMap.get(v.assignedFacilityId ?? 0)?.name || "").toLowerCase();
        const distName = (districtsMap.get(v.districtId ?? 0)?.name || "").toLowerCase();
        return (
          postName.includes(q) ||
          commName.includes(q) ||
          facName.includes(q) ||
          distName.includes(q)
        );
      }
      return true;
    });
  }, [allConfiguredPosts, districtFilter, facilityFilter, searchQuery, facilitiesMap, districtsMap]);

  // Host facilities that serve these filtered posts
  const linkedFacilities = useMemo(() => {
    const facMap = new Map<number, { facility: Facility; postCount: number }>();
    filteredPosts.forEach((p) => {
      if (p.assignedFacilityId) {
        const fac = facilitiesMap.get(p.assignedFacilityId);
        if (fac && fac.latitude && fac.longitude) {
          const curr = facMap.get(fac.id);
          if (curr) {
            curr.postCount += 1;
          } else {
            facMap.set(fac.id, { facility: fac, postCount: 1 });
          }
        }
      }
    });
    return Array.from(facMap.values());
  }, [filteredPosts, facilitiesMap]);

  // Aggregate stats
  const metrics = useMemo(() => {
    const totalPop = filteredPosts.reduce((acc, v) => acc + (Number(v.population) || 0), 0);
    let totalDist = 0;
    let distCount = 0;
    filteredPosts.forEach((v) => {
      if (v.distanceToFacility) {
        totalDist += Number(v.distanceToFacility);
        distCount++;
      }
    });
    const avgDist = distCount > 0 ? (totalDist / distCount).toFixed(1) : "0";
    return {
      displayed: filteredPosts.length,
      totalConfigured: allConfiguredPosts.length,
      totalPop,
      avgDist,
    };
  }, [filteredPosts, allConfiguredPosts]);

  // Compute map bounds
  const mapBounds = useMemo(() => {
    const coords: [number, number][] = [];
    filteredPosts.forEach((p) => {
      const lat = parseFloat(String(p.outreachLatitude));
      const lng = parseFloat(String(p.outreachLongitude));
      if (!isNaN(lat) && !isNaN(lng)) coords.push([lat, lng]);
    });
    if (showFacilities) {
      linkedFacilities.forEach(({ facility }) => {
        const lat = parseFloat(String(facility.latitude));
        const lng = parseFloat(String(facility.longitude));
        if (!isNaN(lat) && !isNaN(lng)) coords.push([lat, lng]);
      });
    }
    if (coords.length === 0) return null;
    return L.latLngBounds(coords);
  }, [filteredPosts, linkedFacilities, showFacilities]);

  // Default center calculation (fallback to first facility or average of facilities)
  const defaultCenter = useMemo<[number, number]>(() => {
    for (const f of facilities) {
      const lat = parseFloat(String(f.latitude));
      const lng = parseFloat(String(f.longitude));
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0) return [lat, lng];
    }
    return [-28.4793, 24.6727]; // South Africa default
  }, [facilities]);

  const handleCopyCoords = (id: number, lat: string | number, lng: string | number) => {
    const text = `${lat}, ${lng}`;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setDistrictFilter("all");
    setFacilityFilter("all");
  };

  return (
    <div className="space-y-4">
      {/* Top Controls & Metrics Card */}
      <Card className="bg-card border-border/50 shadow-xs">
        <CardContent className="p-4 space-y-4">
          {/* Metrics summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
              <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Configured Posts</span>
                <Send className="h-4 w-4" />
              </div>
              <div className="text-xl font-bold text-foreground">
                {metrics.displayed}
                {metrics.displayed !== metrics.totalConfigured && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    of {metrics.totalConfigured}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Mapped immunization sites</p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Target Population</span>
                <Users className="h-4 w-4" />
              </div>
              <div className="text-xl font-bold text-foreground">
                {metrics.totalPop.toLocaleString()}
              </div>
              <p className="text-[11px] text-muted-foreground">Catchment reached</p>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Host Facilities</span>
                <Hospital className="h-4 w-4" />
              </div>
              <div className="text-xl font-bold text-foreground">
                {linkedFacilities.length}
              </div>
              <p className="text-[11px] text-muted-foreground">Supporting health facilities</p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Avg HF Reach</span>
                <Compass className="h-4 w-4" />
              </div>
              <div className="text-xl font-bold text-foreground">
                {metrics.avgDist} <span className="text-xs font-normal text-muted-foreground">km</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Mean distance from post to HF</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1 border-t border-border/40">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search post name, community, facility..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>

              {/* District Filter */}
              <Select value={districtFilter} onValueChange={setDistrictFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
                  <SelectValue placeholder={`All ${adminLabels.level2 || "Districts"}`} />
                </SelectTrigger>
                <SelectContent className="text-xs max-h-64">
                  <SelectItem value="all">All {adminLabels.level2 || "Districts"}</SelectItem>
                  {districts.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Facility Filter */}
              <Select value={facilityFilter} onValueChange={setFacilityFilter}>
                <SelectTrigger className="w-[200px] h-8 text-xs bg-background">
                  <SelectValue placeholder="All Facilities" />
                </SelectTrigger>
                <SelectContent className="text-xs max-h-64">
                  <SelectItem value="all">All Facilities</SelectItem>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(searchQuery || districtFilter !== "all" || facilityFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </Button>
              )}
            </div>

            {/* Map display toggles */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Button
                variant={showFlightLines ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowFlightLines(!showFlightLines)}
                className="h-8 text-xs gap-1.5"
              >
                <Activity className="h-3.5 w-3.5 text-purple-600" />
                Flight Lines
              </Button>

              <Button
                variant={showFacilities ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowFacilities(!showFacilities)}
                className="h-8 text-xs gap-1.5"
              >
                <Hospital className="h-3.5 w-3.5 text-blue-600" />
                Facilities
              </Button>

              <Button
                variant={showReachRadius ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowReachRadius(!showReachRadius)}
                className="h-8 text-xs gap-1.5"
              >
                <Compass className="h-3.5 w-3.5 text-emerald-600" />
                5km Radius
              </Button>

              {onSwitchToTable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSwitchToTable}
                  className="h-8 text-xs gap-1.5"
                >
                  <List className="h-3.5 w-3.5" />
                  Directory Table
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map Card */}
      <div className="relative w-full h-[650px] rounded-xl overflow-hidden border border-border shadow-md bg-muted/20">
        {/* Basemap Switcher */}
        <BasemapSwitcher
          basemap={basemap}
          onChange={setBasemap}
          className="top-3 right-3"
        />

        {/* Legend Overlay (bottom left) */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-background/95 backdrop-blur-md border border-border p-3 rounded-lg shadow-lg text-xs space-y-2 max-w-xs pointer-events-auto">
          <div className="font-semibold text-foreground flex items-center gap-1.5 pb-1 border-b border-border/50">
            <Layers className="h-3.5 w-3.5 text-purple-600" />
            <span>Map Legend</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-purple-500 border border-white flex items-center justify-center shrink-0 shadow-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
            </div>
            <span className="text-foreground">Configured Outreach Post</span>
          </div>
          {showFacilities && (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-xs shrink-0"></div>
              <span className="text-muted-foreground">Host Health Facility</span>
            </div>
          )}
          {showFlightLines && (
            <div className="flex items-center gap-2">
              <div className="w-6 border-t-2 border-dashed border-purple-500 shrink-0"></div>
              <span className="text-muted-foreground">Outreach Reach Line</span>
            </div>
          )}
          {showReachRadius && (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full border border-purple-400 bg-purple-400/20 shrink-0"></div>
              <span className="text-muted-foreground">5 km Outreach Catchment</span>
            </div>
          )}
        </div>

        {/* Empty State Overlay if 0 configured posts */}
        {allConfiguredPosts.length === 0 && (
          <div className="absolute inset-0 z-[999] bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mb-4 shadow-sm">
              <Send className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No Configured Outreach Posts Found</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1 mb-5">
              There are currently 0 outreach posts with configured GPS coordinates. Go to the Directory Table to assign GPS coordinates and name outreach delivery points for communities.
            </p>
            {onSwitchToTable && (
              <Button onClick={onSwitchToTable} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
                <List className="h-4 w-4" />
                Open Outreach Directory Table
              </Button>
            )}
          </div>
        )}

        {/* Filtered 0 posts notice */}
        {allConfiguredPosts.length > 0 && filteredPosts.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-background/95 backdrop-blur-md border border-amber-500/40 text-amber-600 dark:text-amber-400 px-4 py-2 rounded-full shadow-lg text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>No configured outreach posts match your current search / filter criteria.</span>
            <button
              onClick={handleResetFilters}
              className="underline font-semibold ml-1 hover:text-foreground cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Leaflet MapContainer */}
        <MapContainer
          center={defaultCenter}
          zoom={7}
          className="w-full h-full"
          scrollWheelZoom={true}
        >
          <BasemapTileLayer basemap={basemap} />
          <MapController
            bounds={mapBounds}
            defaultCenter={defaultCenter}
          />

          {/* Host Health Facility Markers */}
          {showFacilities &&
            linkedFacilities.map(({ facility, postCount }) => {
              const lat = parseFloat(String(facility.latitude));
              const lng = parseFloat(String(facility.longitude));
              if (isNaN(lat) || isNaN(lng)) return null;

              return (
                <Marker
                  key={`fac-${facility.id}`}
                  position={[lat, lng]}
                  icon={createFacilityCircleIcon()}
                >
                  <Popup className="vaxplan-custom-popup">
                    <div className="p-1 space-y-2 min-w-[220px]">
                      <div className="flex items-center gap-2 border-b pb-1.5">
                        <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                          <Hospital className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground leading-tight">
                            {facility.name}
                          </p>
                          <Badge variant="outline" className="text-[10px] py-0 h-4 mt-0.5 border-blue-500/30 text-blue-600">
                            Host Facility
                          </Badge>
                        </div>
                      </div>

                      <div className="text-[11px] space-y-1 text-muted-foreground">
                        {facility.facilityType && (
                          <p>
                            <span className="font-medium text-foreground">Type:</span> {facility.facilityType}
                          </p>
                        )}
                        <p>
                          <span className="font-medium text-foreground">Linked Outreach Posts:</span>{" "}
                          <span className="font-semibold text-purple-600">{postCount}</span>
                        </p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {/* Flight Lines connecting Outreach Posts to Host Facilities */}
          {showFlightLines &&
            filteredPosts.map((post) => {
              const postLat = parseFloat(String(post.outreachLatitude));
              const postLng = parseFloat(String(post.outreachLongitude));
              const fac = post.assignedFacilityId ? facilitiesMap.get(post.assignedFacilityId) : null;
              if (!fac || !fac.latitude || !fac.longitude) return null;
              const facLat = parseFloat(String(fac.latitude));
              const facLng = parseFloat(String(fac.longitude));
              if (isNaN(postLat) || isNaN(postLng) || isNaN(facLat) || isNaN(facLng)) return null;

              return (
                <Polyline
                  key={`line-${post.id}-${fac.id}`}
                  positions={[
                    [postLat, postLng],
                    [facLat, facLng],
                  ]}
                  pathOptions={{
                    color: "#8b5cf6",
                    weight: 2,
                    dashArray: "5, 6",
                    opacity: 0.7,
                  }}
                />
              );
            })}

          {/* Coverage Reach Circles */}
          {showReachRadius &&
            filteredPosts.map((post) => {
              const lat = parseFloat(String(post.outreachLatitude));
              const lng = parseFloat(String(post.outreachLongitude));
              if (isNaN(lat) || isNaN(lng)) return null;
              return (
                <Circle
                  key={`circle-${post.id}`}
                  center={[lat, lng]}
                  radius={5000} // 5km
                  pathOptions={{
                    color: "#8b5cf6",
                    fillColor: "#8b5cf6",
                    fillOpacity: 0.08,
                    weight: 1,
                  }}
                />
              );
            })}

          {/* Configured Outreach Post Markers */}
          {filteredPosts.map((post) => {
            const lat = parseFloat(String(post.outreachLatitude));
            const lng = parseFloat(String(post.outreachLongitude));
            if (isNaN(lat) || isNaN(lng)) return null;

            const fac = post.assignedFacilityId ? facilitiesMap.get(post.assignedFacilityId) : null;
            const dist = districtsMap.get(post.districtId ?? 0);
            const displayName = post.outreachPostName || `${post.name} Outreach Post`;

            return (
              <Marker
                key={`post-${post.id}`}
                position={[lat, lng]}
                icon={createOutreachPinIcon()}
              >
                <Popup className="vaxplan-custom-popup">
                  <div className="p-1 space-y-2.5 min-w-[240px]">
                    {/* Header */}
                    <div className="border-b pb-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge className="bg-purple-600 hover:bg-purple-600 text-[10px] py-0 h-4 text-white">
                          Configured Outreach Post
                        </Badge>
                        {post.isHardToReach && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4 border-amber-500/40 text-amber-600">
                            HTR
                          </Badge>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-foreground leading-snug">
                        {displayName}
                      </h4>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span>Parent Community: <strong className="text-foreground">{post.name}</strong></span>
                      </p>
                    </div>

                    {/* Key Attributes */}
                    <div className="text-[11px] space-y-1.5 text-muted-foreground">
                      {fac && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Hospital className="h-3 w-3 text-blue-500" />
                            <span>Linked Facility:</span>
                          </span>
                          <span className="font-semibold text-foreground truncate max-w-[130px]" title={fac.name}>
                            {fac.name}
                          </span>
                        </div>
                      )}

                      {dist && (
                        <div className="flex items-center justify-between">
                          <span>{adminLabels.level2 || "District"}:</span>
                          <span className="font-medium text-foreground">{dist.name}</span>
                        </div>
                      )}

                      {post.distanceToFacility && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Compass className="h-3 w-3 text-amber-500" />
                            <span>Facility Reach:</span>
                          </span>
                          <span className="font-semibold text-foreground">
                            {post.distanceToFacility} km
                          </span>
                        </div>
                      )}

                      {post.population && Number(post.population) > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-emerald-500" />
                            <span>Target Population:</span>
                          </span>
                          <span className="font-semibold text-foreground">
                            {Number(post.population).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* GPS Coordinates with one-click copy */}
                      <div className="pt-1 border-t border-border/40 flex items-center justify-between">
                        <span className="font-mono text-[10px]">
                          {lat.toFixed(5)}, {lng.toFixed(5)}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyCoords(post.id, lat, lng)}
                                className="h-6 w-6 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
                              >
                                {copiedId === post.id ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">
                              {copiedId === post.id ? "Copied!" : "Copy GPS"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {onEditPost && (
                      <div className="pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditPost(post)}
                          className="w-full h-7 text-xs gap-1.5 border-purple-500/30 text-purple-600 hover:bg-purple-500/10 font-medium"
                        >
                          <Edit3 className="h-3 w-3" />
                          Configure / Edit Post
                        </Button>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
