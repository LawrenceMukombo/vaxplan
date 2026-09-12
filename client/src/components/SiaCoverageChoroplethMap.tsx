import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Tooltip as LeafletTooltip, useMap } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Layers,
  MapPin,
  Building2,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Globe2,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { getTenantMapDefaults, type TenantLike } from "@/lib/tenantGeo";
import { usePersistedBasemap, BasemapTileLayer, BasemapSwitcher, type Basemap } from "@/components/map/BasemapToggle";
import type { Facility } from "@shared/schema";

// ─── Leaflet Colored Map Pin Icon for Health Facilities ─────────────────────
export const createColoredPinIcon = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="28" height="28">
    <path d="M12 0c-4.418 0-8 3.582-8 8c0 5.25 7 13 8 15 1-2 8-9.75 8-15 0-4.418-3.582-8-8-8zm0 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "sia-hf-pin-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

function MapBoundsController({
  geoJsonData,
  defaultCenter,
  defaultZoom,
}: {
  geoJsonData: any;
  defaultCenter: [number, number];
  defaultZoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (geoJsonData && geoJsonData.features && geoJsonData.features.length > 0) {
      try {
        const geoJsonLayer = L.geoJSON(geoJsonData);
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [25, 25] });
          return;
        }
      } catch {
        // Fallback to center
      }
    }
    map.setView(defaultCenter, defaultZoom);
  }, [geoJsonData, map, defaultCenter, defaultZoom]);

  return null;
}

// ─── Data Types ─────────────────────────────────────────────────────────────
export interface DistrictCoverageItem {
  districtId: number | string;
  districtName: string;
  provinceName?: string;
  targetPop: number;
  vaccinated: number;
  coveragePercent: number;
  reportingFacilitiesCount?: number;
  totalFacilitiesCount?: number;
  coordinates?: { lat: number; lng: number };
}

export interface FacilityCoverageItem {
  id: number;
  name: string;
  district: string;
  districtId?: number;
  province?: string;
  targetPop: number;
  vaccinated: number;
  coveragePercent: number;
  hasAlert?: boolean;
  alertNote?: string;
  status: "verified" | "submitted" | "pending";
  coordinates?: { lat: number; lng: number };
}

export interface SiaCoverageChoroplethMapProps {
  countryCode?: string;
  countryName?: string;
  campaignName?: string;
  boundaryId?: string | null;
  districtsData: DistrictCoverageItem[];
  facilitiesData?: FacilityCoverageItem[];
  selectedDistrictId?: number | string | null;
  onSelectDistrict?: (district: DistrictCoverageItem | null) => void;
  onFocusFacility?: (facilityId: number, facilityName: string) => void;
  isLoading?: boolean;
  metricLabel?: string;
  targetThreshold?: number; // default 90%
}

export function SiaCoverageChoroplethMap({
  countryCode = "ZAF",
  countryName = "Republic of South Africa National Department of Health",
  campaignName = "Overall Campaign Coverage",
  boundaryId,
  districtsData = [],
  facilitiesData = [],
  selectedDistrictId,
  onSelectDistrict,
  onFocusFacility,
  isLoading = false,
  metricLabel = "Campaign Coverage",
  targetThreshold = 90,
}: SiaCoverageChoroplethMapProps) {
  // Layer & Filter Controls
  const [mapLayerMode, setMapLayerMode] = useState<"choropleth" | "facilities" | "layered">("layered");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isolateCountry, setIsolateCountry] = useState(true);
  const [basemap, setBasemap] = usePersistedBasemap();
  const geoJsonRef = useRef<L.GeoJSON | null>(null);

  // Context & Boundaries Query
  const { data: contextData } = useQuery<any>({
    queryKey: ["/api/risk/context"],
    enabled: !boundaryId,
    staleTime: 60 * 60 * 1000,
  });

  const effectiveCountryCode = countryCode || contextData?.countryCode || "ZAF";
  const effectiveBoundaryId = boundaryId || contextData?.boundaryId || null;

  const { data: geoJsonData, isLoading: isGeoLoading } = useQuery<any>({
    queryKey: [`/api/boundaries/${effectiveBoundaryId}/geojson`],
    enabled: Boolean(effectiveBoundaryId),
    staleTime: 60 * 60 * 1000,
  });

  const tenantMock: TenantLike = { countryCode: effectiveCountryCode };
  const mapDefaults = useMemo(() => getTenantMapDefaults(tenantMock), [effectiveCountryCode]);

  // Index performance data by normalized district name
  const districtMap = useMemo(() => {
    const map = new Map<string, DistrictCoverageItem>();
    for (const item of districtsData) {
      const clean = item.districtName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      map.set(clean, item);
      map.set(item.districtName.toLowerCase().trim(), item);
      map.set(String(item.districtId), item);
    }
    return map;
  }, [districtsData]);

  // Match GeoJSON features to districts
  const findDistrictForFeature = (feature: any): DistrictCoverageItem | undefined => {
    if (!feature || !feature.properties) return undefined;
    const props = feature.properties;
    const candidates = [
      props.districtId,
      props.shapeID,
      props.shapeId,
      props.ADM2_PCODE,
      props.GID_2,
      props.shapeName,
      props.ADM2_EN,
      props.ADM2_NAME,
      props.NAME_2,
      props.district,
      props.name,
    ];

    for (const c of candidates) {
      if (c !== undefined && c !== null && String(c).trim() !== "") {
        const clean = String(c).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
        if (districtMap.has(clean)) return districtMap.get(clean);
        if (districtMap.has(String(c).toLowerCase().trim())) return districtMap.get(String(c).toLowerCase().trim());
      }
    }
    return undefined;
  };

  // Color Scale for WHO Coverage Categories
  const getCoverageCategory = (coverage: number): "high" | "medium" | "low" | "critical" => {
    if (coverage >= 90) return "high";
    if (coverage >= 75) return "medium";
    if (coverage >= 50) return "low";
    return "critical";
  };

  const getCoverageColor = (coverage: number | null | undefined): string => {
    if (coverage === null || coverage === undefined || isNaN(coverage)) return "#cbd5e1"; // grey for no data
    if (coverage >= 90) return "#10b981"; // Emerald Green (Target Met)
    if (coverage >= 75) return "#f59e0b"; // Amber (Substantial Progress)
    if (coverage >= 50) return "#f97316"; // Orange (High Risk / Low Coverage)
    return "#ef4444"; // Red (Critical Lag)
  };

  // Inverted Country Mask via Turf
  const countryMaskGeoJson = useMemo(() => {
    if (!geoJsonData || !isolateCountry) return null;
    try {
      if (!geoJsonData.features || geoJsonData.features.length === 0) return null;
      return (turf as any).mask(geoJsonData);
    } catch {
      return null;
    }
  }, [geoJsonData, isolateCountry]);

  // Aggregate Metrics for Top Summary Cards (Matching Screenshot 1)
  const stats = useMemo(() => {
    if (districtsData.length === 0) {
      return {
        mean: 0,
        min: 0,
        max: 0,
        countWithData: 0,
        totalCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      };
    }

    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let countWithData = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let criticalCount = 0;

    districtsData.forEach((d) => {
      const cov = d.coveragePercent;
      if (cov !== undefined && cov !== null && !isNaN(cov)) {
        countWithData++;
        sum += cov;
        if (cov < min) min = cov;
        if (cov > max) max = cov;

        const cat = getCoverageCategory(cov);
        if (cat === "high") highCount++;
        else if (cat === "medium") mediumCount++;
        else if (cat === "low") lowCount++;
        else criticalCount++;
      }
    });

    const mean = countWithData > 0 ? Number((sum / countWithData).toFixed(1)) : 0;
    return {
      mean,
      min: min === Infinity ? 0 : Number(min.toFixed(1)),
      max: max === -Infinity ? 0 : Number(max.toFixed(1)),
      countWithData,
      totalCount: districtsData.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
    };
  }, [districtsData]);

  // Filtered Facilities for Points Layer
  const visibleFacilities = useMemo(() => {
    return facilitiesData.filter((f) => {
      if (selectedDistrictId && f.districtId && String(f.districtId) !== String(selectedDistrictId)) {
        return false;
      }
      if (selectedCategoryFilter !== "ALL") {
        const cat = getCoverageCategory(f.coveragePercent);
        if (cat !== selectedCategoryFilter.toLowerCase()) return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return f.name.toLowerCase().includes(q) || f.district.toLowerCase().includes(q);
      }
      return true;
    });
  }, [facilitiesData, selectedDistrictId, selectedCategoryFilter, searchTerm]);

  return (
    <div className="space-y-4">
      {/* ─── Top Header & Controls (Matching Screenshot 1) ───────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border/70 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Globe2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground tracking-tight">
              {countryName} &bull; {campaignName}
            </h2>
            <Badge variant="secondary" className="font-semibold text-xs bg-muted">
              {districtsData.length} Districts
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Interactive real-time choropleth visualization of campaign coverage aligned with WHO SIA benchmarks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Layer View Mode Switcher */}
          <Select
            value={mapLayerMode}
            onValueChange={(v: any) => setMapLayerMode(v)}
          >
            <SelectTrigger className="h-8 text-xs w-[160px] bg-background">
              <Layers className="h-3.5 w-3.5 mr-1.5 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="choropleth">Districts Choropleth</SelectItem>
              <SelectItem value="facilities">HF Map Pins</SelectItem>
              <SelectItem value="layered">Layered (Districts + HFs)</SelectItem>
            </SelectContent>
          </Select>

          {/* Country Isolation Toggle */}
          <Button
            variant={isolateCountry ? "default" : "outline"}
            size="sm"
            onClick={() => setIsolateCountry(!isolateCountry)}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Country Only {isolateCountry ? "(Active)" : "(Global)"}</span>
          </Button>

          {/* Basemap Selector */}
          <BasemapSwitcher basemap={basemap} onChange={setBasemap} />
        </div>
      </div>

      {/* ─── 4 Metric Summary Cards (Matching Screenshot 1) ───────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-xs border-border/60 bg-card/80">
          <CardContent className="p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              DISTRICT MEAN
            </div>
            <div className="text-xl font-bold text-foreground mt-0.5">
              {stats.mean}%
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/60 bg-card/80">
          <CardContent className="p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              DISTRICT RANGE
            </div>
            <div className="text-xl font-bold text-foreground mt-0.5">
              {stats.min}% &ndash; {stats.max}%
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/60 bg-card/80">
          <CardContent className="p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              DISTRICTS WITH DATA
            </div>
            <div className="text-xl font-bold text-foreground mt-0.5">
              {stats.countWithData} / {stats.totalCount}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/60 bg-card/80">
          <CardContent className="p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              CRITICAL / BELOW TARGET (&lt;80%)
            </div>
            <div className="text-xl font-bold text-rose-600 mt-0.5">
              {stats.criticalCount + stats.lowCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Helper Line */}
      <div className="text-xs text-muted-foreground flex items-center justify-between px-1">
        <span>
          {stats.totalCount - stats.countWithData} districts without matched data. Grey areas have no reports.
        </span>
        {selectedDistrictId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectDistrict && onSelectDistrict(null)}
            className="h-6 text-[11px] text-primary underline"
          >
            Clear Selected District
          </Button>
        )}
      </div>

      {/* ─── Interactive Map View ─────────────────────────────────────────── */}
      <div className="relative h-[520px] w-full rounded-xl overflow-hidden border border-border/70 shadow-sm bg-slate-50 dark:bg-slate-950">
        <MapContainer
          center={mapDefaults.center}
          zoom={mapDefaults.zoom}
          className="h-full w-full z-0"
          scrollWheelZoom={true}
        >
          <MapBoundsController
            geoJsonData={geoJsonData}
            defaultCenter={mapDefaults.center}
            defaultZoom={mapDefaults.zoom}
          />

          <BasemapTileLayer basemap={basemap} />

          {/* Optional Inverted Mask for Country Isolation */}
          {countryMaskGeoJson && (
            <GeoJSON
              data={countryMaskGeoJson}
              style={{
                color: "transparent",
                fillColor: "#f8fafc",
                fillOpacity: 0.95,
                weight: 0,
              }}
              interactive={false}
            />
          )}

          {/* GeoJSON District Boundaries Polygon Layer */}
          {(mapLayerMode === "choropleth" || mapLayerMode === "layered") && geoJsonData && (
            <GeoJSON
              key={`choropleth-${effectiveBoundaryId}-${selectedCategoryFilter}-${basemap}`}
              ref={geoJsonRef}
              data={geoJsonData}
              style={(feature) => {
                const dist = findDistrictForFeature(feature);
                const cov = dist?.coveragePercent;
                const isSelected = selectedDistrictId && dist && String(dist.districtId) === String(selectedDistrictId);

                // Category filter check
                if (selectedCategoryFilter !== "ALL" && dist) {
                  const cat = getCoverageCategory(dist.coveragePercent);
                  if (cat !== selectedCategoryFilter.toLowerCase()) {
                    return {
                      fillColor: "#e2e8f0",
                      fillOpacity: 0.2,
                      color: "#cbd5e1",
                      weight: 1,
                    };
                  }
                }

                const fillColor = getCoverageColor(cov);
                return {
                  fillColor,
                  fillOpacity: isSelected ? 0.95 : 0.85,
                  color: isSelected ? "#000000" : "#ffffff",
                  weight: isSelected ? 3 : 1.5,
                };
              }}
              onEachFeature={(feature, layer) => {
                const dist = findDistrictForFeature(feature);
                const name = dist?.districtName || feature.properties?.ADM2_EN || feature.properties?.name || "District";
                const cov = dist?.coveragePercent;

                layer.bindTooltip(
                  `<div class="p-1 text-xs">
                    <strong>${name}</strong>
                    <div>${metricLabel}: <strong>${cov !== undefined ? `${cov}%` : "No Data"}</strong></div>
                    ${dist ? `<div>Vaccinated: ${dist.vaccinated.toLocaleString()} / ${dist.targetPop.toLocaleString()}</div>` : ""}
                  </div>`,
                  { direction: "top", offset: [0, -10] }
                );

                layer.on({
                  click: () => {
                    if (dist && onSelectDistrict) {
                      onSelectDistrict(dist);
                    }
                  },
                });
              }}
            />
          )}

          {/* Health Facility Points / Pins Layer */}
          {(mapLayerMode === "facilities" || mapLayerMode === "layered") &&
            visibleFacilities.map((fac) => {
              const coords = fac.coordinates || { lat: -33.5 + Math.random() * 0.1, lng: 26.0 + Math.random() * 0.1 };
              const color = getCoverageColor(fac.coveragePercent);

              return (
                <Marker
                  key={fac.id}
                  position={[coords.lat, coords.lng]}
                  icon={createColoredPinIcon(color)}
                >
                  <Popup>
                    <div className="p-1 space-y-2 text-xs min-w-[210px]">
                      <div className="font-bold text-foreground text-sm flex items-center justify-between">
                        <span>{fac.name}</span>
                        {fac.hasAlert && (
                          <Badge className="bg-rose-500 text-white text-[9px]">Alert</Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground">{fac.district} &bull; {fac.province || ""}</div>

                      <div className="grid grid-cols-2 gap-1.5 p-2 bg-muted/50 rounded text-[11px]">
                        <div>Target: <strong>{fac.targetPop.toLocaleString()}</strong></div>
                        <div>Vaccinated: <strong>{fac.vaccinated.toLocaleString()}</strong></div>
                        <div>Coverage: <strong className={fac.coveragePercent >= 90 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>{fac.coveragePercent}%</strong></div>
                        <div>Status: <strong>{fac.status}</strong></div>
                      </div>

                      {fac.alertNote && (
                        <div className="text-[10px] text-rose-600 bg-rose-50 p-1 rounded">
                          {fac.alertNote}
                        </div>
                      )}

                      {onFocusFacility && (
                        <Button
                          size="sm"
                          onClick={() => onFocusFacility(fac.id, fac.name)}
                          className="w-full text-xs h-7 bg-primary text-primary-foreground font-semibold"
                        >
                          Focus Facility Dashboard &rarr;
                        </Button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
        </MapContainer>

        {/* ─── Floating Legend Bottom Left (Matching Screenshot 1) ───────── */}
        <div className="absolute bottom-4 left-4 z-[400] bg-background/95 backdrop-blur-md p-3.5 rounded-xl border border-border/80 shadow-lg text-xs min-w-[240px] space-y-2">
          <div className="font-bold text-foreground text-xs flex items-center justify-between">
            <span>WHO SIA Coverage Categories</span>
            {selectedCategoryFilter !== "ALL" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategoryFilter("ALL")}
                className="h-5 text-[10px] p-0 text-primary underline"
              >
                Reset
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <div
              className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                selectedCategoryFilter === "high" ? "bg-emerald-50 dark:bg-emerald-950/30" : "hover:bg-muted/40"
              }`}
              onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === "high" ? "ALL" : "high")}
            >
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 shrink-0" />
                <span className="text-foreground">Target Met (&ge; 90%)</span>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                {stats.highCount}
              </Badge>
            </div>

            <div
              className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                selectedCategoryFilter === "medium" ? "bg-amber-50 dark:bg-amber-950/30" : "hover:bg-muted/40"
              }`}
              onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === "medium" ? "ALL" : "medium")}
            >
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-amber-500 shrink-0" />
                <span className="text-foreground">Near Target (75&ndash;89%)</span>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                {stats.mediumCount}
              </Badge>
            </div>

            <div
              className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                selectedCategoryFilter === "low" ? "bg-orange-50 dark:bg-orange-950/30" : "hover:bg-muted/40"
              }`}
              onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === "low" ? "ALL" : "low")}
            >
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-orange-500 shrink-0" />
                <span className="text-foreground">Substantial Lag (50&ndash;74%)</span>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                {stats.lowCount}
              </Badge>
            </div>

            <div
              className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                selectedCategoryFilter === "critical" ? "bg-red-50 dark:bg-red-950/30" : "hover:bg-muted/40"
              }`}
              onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === "critical" ? "ALL" : "critical")}
            >
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-red-500 shrink-0" />
                <span className="text-foreground">Critical Lag (&lt; 50%)</span>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                {stats.criticalCount}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
