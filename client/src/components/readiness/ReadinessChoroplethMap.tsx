import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  MapContainer,
  GeoJSON,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Layers,
  MapPin,
  RotateCcw,
  Info,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import * as turf from "@turf/turf";
import { getTenantMapDefaults, type TenantLike } from "@/lib/tenantGeo";
import { usePersistedBasemap, BasemapTileLayer, BasemapSwitcher } from "@/components/map/BasemapToggle";
import type { Facility } from "@shared/schema";
import type { AssessmentRecord, AssessmentTier } from "@/pages/CampaignReadiness";

// ─── Crisp Vector Map Pin for Health Facilities (HFs ONLY) ───────────────────
const createFacilityPinIcon = (score: number, readyThreshold = 80, watchlistThreshold = 60) => {
  const color =
    score >= readyThreshold
      ? "#10b981"
      : score >= watchlistThreshold
      ? "#f59e0b"
      : score > 0
      ? "#ef4444"
      : "#2563eb";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" width="22" height="30">
    <defs>
      <filter id="hfPinShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#0f172a" flood-opacity="0.35"/>
      </filter>
    </defs>
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9.2 12 22 12 22s12-12.8 12-22c0-6.63-5.37-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="1.8" filter="url(#hfPinShadow)"/>
    <circle cx="12" cy="11.5" r="5.2" fill="#ffffff"/>
    <path d="M10 14v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4M9 14h6" stroke="${color}" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: "readiness-hf-pin-icon",
    iconSize: [22, 30],
    iconAnchor: [11, 30],
    popupAnchor: [0, -30],
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
          map.fitBounds(bounds, { padding: [20, 20] });
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

export interface ReadinessChoroplethMapProps {
  countryCode?: string;
  countryName?: string;
  adminLevelLabel?: string;
  boundaryId?: string | null;
  assessments: AssessmentRecord[];
  facilities?: Facility[];
  selectedCategoryFilter?: string;
  onSelectCategoryFilter?: (filter: string) => void;
  selectedEntityId?: number | string | null;
  onSelectEntity?: (item: AssessmentRecord | null) => void;
  readyThreshold?: number;
  watchlistThreshold?: number;
  isLoading?: boolean;
  selectedTier?: AssessmentTier;
  selectedCampaignName?: string;
  onViewAssessmentDetail?: (item: AssessmentRecord) => void;
}

export function ReadinessChoroplethMap({
  countryCode = "ZAF",
  countryName = "Republic of South Africa",
  adminLevelLabel = "District",
  boundaryId,
  assessments = [],
  facilities = [],
  selectedCategoryFilter = "ALL",
  onSelectCategoryFilter,
  selectedEntityId,
  onSelectEntity,
  readyThreshold = 80,
  watchlistThreshold = 60,
  isLoading = false,
  selectedTier = "tier1_national",
  selectedCampaignName = "2026 Measles-Rubella SIA",
  onViewAssessmentDetail,
}: ReadinessChoroplethMapProps) {
  const [selectedDomain, setSelectedDomain] = useState<string>("composite");
  const [isolateCountry, setIsolateCountry] = useState<boolean>(true);
  const [showFacilities, setShowFacilities] = useState<boolean>(selectedTier === "tier3_district");
  const [basemap, setBasemap] = usePersistedBasemap();
  const geoJsonRef = useRef<L.GeoJSON | null>(null);

  // Sync facility visibility when tier switches to tier3_district
  useEffect(() => {
    if (selectedTier === "tier3_district") {
      setShowFacilities(true);
    }
  }, [selectedTier]);

  // Active tenant query
  const { data: tenant } = useQuery<any>({
    queryKey: ["/api/me/tenant"],
    staleTime: 60 * 60 * 1000,
  });

  const effectiveCountryCode = countryCode || tenant?.countryCode || "ZAF";
  const effectiveCountryName = countryName || tenant?.name || "National Department of Health";

  // Fallback context query for boundaryId if not passed
  const { data: contextData } = useQuery<any>({
    queryKey: ["/api/risk/context"],
    enabled: !boundaryId,
    staleTime: 60 * 60 * 1000,
  });

  const effectiveBoundaryId = boundaryId || contextData?.boundaryId || null;

  // GeoJSON boundary query for active country
  const { data: geoJsonData, isLoading: isGeoLoading } = useQuery<any>({
    queryKey: [`/api/boundaries/${effectiveBoundaryId}/geojson`],
    enabled: Boolean(effectiveBoundaryId),
    staleTime: 60 * 60 * 1000,
  });

  // Country boundary mask using turf.mask to prevent Zambian or other country polygon leaks
  const countryMaskGeoJson = useMemo(() => {
    if (!geoJsonData || !isolateCountry) return null;
    try {
      if (!geoJsonData.features || geoJsonData.features.length === 0) return null;
      return (turf as any).mask(geoJsonData);
    } catch (err) {
      console.warn("Could not generate country mask via turf.mask:", err);
      try {
        const worldRing = [
          [-180, -89.9],
          [-180, 89.9],
          [180, 89.9],
          [180, -89.9],
          [-180, -89.9],
        ];
        const interiorRings: any[] = [];
        for (const f of geoJsonData.features) {
          const g = f.geometry;
          if (!g) continue;
          if (g.type === "Polygon" && Array.isArray(g.coordinates?.[0])) {
            interiorRings.push(g.coordinates[0]);
          } else if (g.type === "MultiPolygon" && Array.isArray(g.coordinates)) {
            for (const poly of g.coordinates) {
              if (Array.isArray(poly?.[0])) interiorRings.push(poly[0]);
            }
          }
        }
        if (interiorRings.length === 0) return null;
        return {
          type: "Feature",
          properties: { isMask: true },
          geometry: {
            type: "Polygon",
            coordinates: [worldRing, ...interiorRings],
          },
        };
      } catch (e2) {
        return null;
      }
    }
  }, [geoJsonData, isolateCountry]);

  // Tenant Map Defaults (centers on South Africa [-29.0, 24.5] for ZAF, Zambia for ZMB, etc.)
  const tenantMock: TenantLike = { countryCode: effectiveCountryCode };
  const mapDefaults = useMemo(() => getTenantMapDefaults(tenantMock), [effectiveCountryCode]);

  // Index assessments for fast matching against GeoJSON features
  const assessmentMap = useMemo(() => {
    const map = new Map<string, AssessmentRecord>();
    for (const item of assessments) {
      const name = item.entityName || "";
      const clean = name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      map.set(clean, item);
      map.set(name.toLowerCase().trim(), item);
      map.set(String(item.entityId), item);
      if (item.districtId) map.set(String(item.districtId), item);
      if (item.provinceId) map.set(String(item.provinceId), item);
      if (item.facilityId) map.set(String(item.facilityId), item);
    }
    return map;
  }, [assessments]);

  // Match GeoJSON feature to assessment
  const findAssessmentForFeature = (feature: any): AssessmentRecord | undefined => {
    if (!feature || !feature.properties) return undefined;
    const props = feature.properties;
    const candidates = [
      props.districtId,
      props.provinceId,
      props.administrativeAreaId,
      props.shapeID,
      props.shapeId,
      props.ADM2_PCODE,
      props.ADM1_PCODE,
      props.GID_2,
      props.GID_1,
      props.shapeName,
      props.shapeName_1,
      props.ADM2_EN,
      props.ADM1_EN,
      props.ADM2_NAME,
      props.ADM1_NAME,
      props.NAME_2,
      props.NAME_1,
      props.district,
      props.province,
      props.name,
      props.district_name,
      props.province_name,
      props.admin2Name,
      props.admin1Name,
      props.Name,
    ];

    for (const c of candidates) {
      if (c !== undefined && c !== null) {
        const str = String(c).trim();
        if (str) {
          const direct = assessmentMap.get(str.toLowerCase());
          if (direct) return direct;
          const clean = str.toLowerCase().replace(/[^a-z0-9]/g, "");
          const cleanMatch = assessmentMap.get(clean);
          if (cleanMatch) return cleanMatch;
        }
      }
    }

    // Fuzzy matching for longer names
    const entries = Array.from(assessmentMap.entries());
    for (const c of candidates) {
      if (typeof c === "string" && c.trim().length >= 4) {
        const lower = c.toLowerCase().trim();
        for (let i = 0; i < entries.length; i++) {
          const [key, val] = entries[i];
          if (key.length >= 4 && !/^\d+$/.test(key)) {
            if (key.includes(lower) || lower.includes(key)) {
              return val;
            }
          }
        }
      }
    }

    return undefined;
  };

  // Compute score based on selected domain
  const getScoreForDomain = (item: AssessmentRecord): number => {
    if (selectedDomain === "planning") return item.domainScores?.planning ?? 0;
    if (selectedDomain === "logistics") return item.domainScores?.logistics ?? 0;
    if (selectedDomain === "training") return item.domainScores?.training ?? 0;
    if (selectedDomain === "mobilization") return item.domainScores?.mobilization ?? 0;
    if (selectedDomain === "supervision") return item.domainScores?.supervision ?? 0;
    return item.compositeScore ?? 0;
  };

  // Color generator for shaded choropleth polygons
  const getShadingColor = (item?: AssessmentRecord): string => {
    if (!item) return "#94a3b8"; // Slate for unassessed
    const score = getScoreForDomain(item);
    if (score >= readyThreshold) return "#10b981"; // Emerald Green
    if (score >= watchlistThreshold) return "#f59e0b"; // Amber
    return "#ef4444"; // Crimson Red
  };

  // Shading style for each administrative polygon
  const styleFeature = (feature: any) => {
    const item = findAssessmentForFeature(feature);
    const isSelected = selectedEntityId && item && String(item.entityId) === String(selectedEntityId);
    const isFilteredTierActive = Boolean(selectedCategoryFilter && selectedCategoryFilter !== "ALL");
    const matchesCategory = !isFilteredTierActive || (item && item.status === selectedCategoryFilter);

    if (isFilteredTierActive && !matchesCategory) {
      return {
        fillColor: "#94a3b8",
        weight: 1,
        opacity: 0.25,
        color: "#cbd5e1",
        dashArray: "3",
        fillOpacity: 0.1,
      };
    }

    const fillColor = getShadingColor(item);
    const isEvaluated = Boolean(item);

    return {
      fillColor,
      weight: isSelected ? 3.5 : (isFilteredTierActive ? 2.5 : 1.5),
      opacity: 1,
      color: isSelected ? "#000000" : (isFilteredTierActive ? "#0f172a" : "#ffffff"),
      dashArray: isSelected ? "3" : (isEvaluated ? undefined : "4 2"),
      fillOpacity: isSelected ? 0.95 : (isEvaluated ? 0.78 : 0.18),
    };
  };

  // Interaction handlers on each administrative polygon
  const onEachFeature = (feature: any, layer: L.Layer) => {
    const item = findAssessmentForFeature(feature);
    const featureName =
      feature.properties?.shapeName ||
      feature.properties?.ADM2_EN ||
      feature.properties?.ADM1_EN ||
      feature.properties?.name ||
      "Administrative Area";

    const score = item ? getScoreForDomain(item) : 0;
    const statusLabel =
      score >= readyThreshold
        ? "READY (>=80%)"
        : score >= watchlistThreshold
        ? "WATCHLIST (60-79%)"
        : "CRITICAL LAG (<60%)";

    const tooltipContent = item
      ? `
        <div style="font-family: inherit; min-width: 200px; padding: 2px;">
          <div style="font-weight: 700; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span>${item.entityName}</span>
            <span style="font-size: 10px; background: #e2e8f0; padding: 1px 5px; border-radius: 4px; font-weight: 600;">${item.parentEntityName || "Admin Unit"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; align-items: center;">
            <span style="color: #64748b; font-weight: 500;">Composite Readiness:</span>
            <strong style="color: ${getShadingColor(item)}; font-size: 13px;">${item.compositeScore}%</strong>
          </div>
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; color: ${getShadingColor(item)};">
            ● ${statusLabel}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3px; font-size: 10.5px; border-top: 1px dashed #e2e8f0; padding-top: 4px;">
            <div>Planning: <strong>${item.domainScores?.planning ?? 0}%</strong></div>
            <div>Logistics: <strong>${item.domainScores?.logistics ?? 0}%</strong></div>
            <div>Training: <strong>${item.domainScores?.training ?? 0}%</strong></div>
            <div>Comms: <strong>${item.domainScores?.mobilization ?? 0}%</strong></div>
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 6px; text-align: right;">
            ${item.isSignedOff ? "✓ Signed Off" : "⏳ In Progress"}
          </div>
        </div>
      `
      : `
        <div style="font-family: inherit; font-size: 12px; font-weight: 600; padding: 2px;">
          ${featureName}
          <div style="font-size: 10px; color: #64748b; font-weight: normal; margin-top: 2px;">No readiness evaluation recorded</div>
        </div>
      `;

    layer.bindTooltip(tooltipContent, {
      sticky: true,
      direction: "top",
      className: "bg-background text-foreground shadow-lg border rounded-md p-2",
    });

    layer.on({
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({
          weight: 3,
          color: "#2563eb",
          fillOpacity: 0.9,
        });
      },
      mouseout: (e) => {
        if (geoJsonRef.current) {
          geoJsonRef.current.resetStyle(e.target);
        }
      },
      click: () => {
        if (item) {
          if (onSelectEntity) onSelectEntity(item);
          if (onViewAssessmentDetail) onViewAssessmentDetail(item);
        }
      },
    });
  };

  // Facilities with readiness mapping
  const mappedFacilities = useMemo(() => {
    if (!showFacilities || !facilities || facilities.length === 0) return [];
    return facilities.filter((f) => f.latitude && f.longitude).slice(0, 150); // limit to 150 for snappy rendering
  }, [showFacilities, facilities]);

  // Readiness KPI summary
  const summaryStats = useMemo(() => {
    const total = assessments.length;
    if (total === 0) return { total: 0, avg: 0, ready: 0, watchlist: 0, notReady: 0 };
    let ready = 0, watchlist = 0, notReady = 0, sum = 0;
    for (const a of assessments) {
      const score = getScoreForDomain(a);
      sum += score;
      if (score >= readyThreshold) ready++;
      else if (score >= watchlistThreshold) watchlist++;
      else notReady++;
    }
    return {
      total,
      avg: Math.round(sum / total),
      ready,
      watchlist,
      notReady,
    };
  }, [assessments, selectedDomain, readyThreshold, watchlistThreshold]);

  return (
    <Card className="shadow-sm border-border/60 overflow-hidden">
      <CardHeader className="pb-3 border-b bg-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span>{effectiveCountryName}</span>
              <span className="text-xs font-normal text-muted-foreground">• {selectedCampaignName} Readiness</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Interactive choropleth visualization of campaign readiness milestones aligned with WHO SIA guidelines.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Domain Metric Selector */}
            <Select value={selectedDomain} onValueChange={setSelectedDomain}>
              <SelectTrigger className="h-8 text-xs font-medium w-[210px] bg-background">
                <SelectValue placeholder="Select Evaluation Domain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="composite">Overall Composite Readiness</SelectItem>
                <SelectItem value="planning">Planning & Coordination</SelectItem>
                <SelectItem value="logistics">Vaccine & Cold Chain</SelectItem>
                <SelectItem value="training">Training & Staff</SelectItem>
                <SelectItem value="mobilization">Social Mobilisation</SelectItem>
                <SelectItem value="supervision">Monitoring & AEFI</SelectItem>
              </SelectContent>
            </Select>

            {/* Health Facility Marker Overlay Toggle */}
            {facilities && facilities.length > 0 && (
              <Button
                variant={showFacilities ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setShowFacilities(!showFacilities)}
                title={showFacilities ? "Hide Health Facility Pins" : "Show Health Facility Pins"}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Facilities ({mappedFacilities.length})</span>
              </Button>
            )}

            {/* Country Isolation Toggle */}
            <Button
              variant={isolateCountry ? "secondary" : "outline"}
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setIsolateCountry(!isolateCountry)}
              title={isolateCountry ? "Showing Country Only" : "Showing Full Context"}
            >
              {isolateCountry ? "Country Only (Active)" : "Global View"}
            </Button>
          </div>
        </div>

        {/* Sub-header KPI Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t mt-2">
          <div className="bg-muted/40 rounded-lg p-2 flex flex-col">
            <span className="text-[11px] text-muted-foreground">Units Evaluated</span>
            <span className="text-sm font-bold text-foreground">{summaryStats.total} {adminLevelLabel}s</span>
          </div>
          <div className="bg-muted/40 rounded-lg p-2 flex flex-col">
            <span className="text-[11px] text-muted-foreground">National Readiness</span>
            <span className="text-sm font-bold text-primary">{summaryStats.avg}% Avg</span>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-2 flex flex-col border border-emerald-500/20">
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Cleared Units (&gt;={readyThreshold}%)</span>
            <span className="text-sm font-bold text-emerald-600">{summaryStats.ready} Ready</span>
          </div>
          <div className="bg-red-500/10 rounded-lg p-2 flex flex-col border border-red-500/20">
            <span className="text-[11px] text-red-700 dark:text-red-400 font-medium">Critical Lag (&lt;{watchlistThreshold}%)</span>
            <span className="text-sm font-bold text-red-600">{summaryStats.notReady} Bottlenecks</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        <div className="h-[460px] w-full relative">
          <MapContainer
            center={mapDefaults.center}
            zoom={mapDefaults.zoom}
            maxBounds={mapDefaults.maxBounds}
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <MapBoundsController
              geoJsonData={geoJsonData}
              defaultCenter={mapDefaults.center}
              defaultZoom={mapDefaults.zoom}
            />

            <BasemapTileLayer basemap={basemap} />

            {/* Inverted Country Mask: prevents Zambia or foreign boundaries from bleeding */}
            {countryMaskGeoJson && (
              <GeoJSON
                key={`mask-${effectiveCountryCode}-${isolateCountry}`}
                data={countryMaskGeoJson}
                style={{
                  fillColor: "#f8fafc",
                  fillOpacity: 0.96,
                  color: "#cbd5e1",
                  weight: 1.5,
                  stroke: true,
                }}
                interactive={false}
              />
            )}

            {/* Main Shaded Administrative Area Choropleth */}
            {geoJsonData && (
              <GeoJSON
                key={`choropleth-${effectiveCountryCode}-${selectedDomain}-${selectedCategoryFilter}-${readyThreshold}-${watchlistThreshold}`}
                ref={geoJsonRef}
                data={geoJsonData}
                style={styleFeature}
                onEachFeature={onEachFeature}
              />
            )}

            {/* Health Facility Markers (HFs ONLY) */}
            {showFacilities && mappedFacilities.map((facility) => {
              const facAssessment = assessmentMap.get(String(facility.id)) || assessmentMap.get(facility.name.toLowerCase().trim());
              const score = facAssessment ? facAssessment.compositeScore : 0;
              const rawLat = facility.latitude;
              const rawLng = facility.longitude;
              const lat = typeof rawLat === "string" ? parseFloat(rawLat) : typeof rawLat === "number" ? rawLat : null;
              const lng = typeof rawLng === "string" ? parseFloat(rawLng) : typeof rawLng === "number" ? rawLng : null;
              if (lat === null || isNaN(lat) || lng === null || isNaN(lng)) return null;

              return (
                <Marker
                  key={`hf-${facility.id}`}
                  position={[lat, lng]}
                  icon={createFacilityPinIcon(score, readyThreshold, watchlistThreshold)}
                >
                  <Popup>
                    <div className="p-1 space-y-1 text-xs min-w-[190px]">
                      <div className="font-bold text-sm text-foreground">{facility.name}</div>
                      <div className="text-[11px] text-muted-foreground">{facility.facilityType || "Health Facility"}</div>
                      <div className="flex items-center justify-between pt-1 border-t mt-1">
                        <span>Readiness Score:</span>
                        <Badge
                          className={
                            score >= readyThreshold
                              ? "bg-emerald-500"
                              : score >= watchlistThreshold
                              ? "bg-amber-500"
                              : score > 0
                              ? "bg-red-500"
                              : "bg-muted text-foreground"
                          }
                        >
                          {score > 0 ? `${score}%` : "Pending"}
                        </Badge>
                      </div>
                      {facAssessment && (
                        <div className="grid grid-cols-2 gap-1 text-[10px] pt-1">
                          <div>Planning: {facAssessment.domainScores?.planning ?? 0}%</div>
                          <div>Logistics: {facAssessment.domainScores?.logistics ?? 0}%</div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Floating Basemap Switcher Control */}
          <div className="absolute right-3 top-3 z-[1000]">
            <BasemapSwitcher basemap={basemap} onChange={setBasemap} />
          </div>

          {/* Interactive Legend Box (Matching VPD Risk Assessment Map) */}
          <div className="absolute left-3 bottom-3 z-[1000] bg-background/95 backdrop-blur-sm p-2.5 rounded-lg shadow-lg border text-xs max-w-[240px]">
            <div className="font-semibold text-xs mb-1.5 flex items-center justify-between">
              <span>Readiness Benchmarks</span>
              {selectedCategoryFilter !== "ALL" && onSelectCategoryFilter && (
                <button
                  onClick={() => onSelectCategoryFilter("ALL")}
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                >
                  <RotateCcw className="h-2.5 w-2.5" /> Reset
                </button>
              )}
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => onSelectCategoryFilter && onSelectCategoryFilter(selectedCategoryFilter === "ready" ? "ALL" : "ready")}
                className={`w-full flex items-center justify-between p-1 rounded transition-colors text-left ${
                  selectedCategoryFilter === "ready" ? "bg-emerald-500/20 font-semibold" : "hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 shrink-0" />
                  <span>Ready (&gt;={readyThreshold}%)</span>
                </div>
                <Badge variant="outline" className="text-[10px] h-4 px-1">{summaryStats.ready}</Badge>
              </button>

              <button
                type="button"
                onClick={() => onSelectCategoryFilter && onSelectCategoryFilter(selectedCategoryFilter === "watchlist" ? "ALL" : "watchlist")}
                className={`w-full flex items-center justify-between p-1 rounded transition-colors text-left ${
                  selectedCategoryFilter === "watchlist" ? "bg-amber-500/20 font-semibold" : "hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500 shrink-0" />
                  <span>Watchlist ({watchlistThreshold}-{readyThreshold - 1}%)</span>
                </div>
                <Badge variant="outline" className="text-[10px] h-4 px-1">{summaryStats.watchlist}</Badge>
              </button>

              <button
                type="button"
                onClick={() => onSelectCategoryFilter && onSelectCategoryFilter(selectedCategoryFilter === "not_ready" ? "ALL" : "not_ready")}
                className={`w-full flex items-center justify-between p-1 rounded transition-colors text-left ${
                  selectedCategoryFilter === "not_ready" ? "bg-red-500/20 font-semibold" : "hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-red-500 shrink-0" />
                  <span>Critical Lag (&lt;{watchlistThreshold}%)</span>
                </div>
                <Badge variant="outline" className="text-[10px] h-4 px-1">{summaryStats.notReady}</Badge>
              </button>

              <div className="flex items-center justify-between p-1 text-muted-foreground pt-1 border-t mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-400 opacity-30 border border-slate-500 shrink-0" />
                  <span className="text-[11px]">Unassessed Area</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
