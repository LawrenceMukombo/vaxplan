import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  MapContainer,
  GeoJSON,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Layers,
  MapPin,
  Search,
  RotateCcw,
  Info,
  Activity,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Filter,
} from "lucide-react";
import * as turf from "@turf/turf";
import { getTenantMapDefaults, type TenantLike } from "@/lib/tenantGeo";
import { usePersistedBasemap, BasemapTileLayer, BasemapSwitcher, type Basemap } from "@/components/map/BasemapToggle";

export interface DistrictCoveragePerformance {
  districtId: number;
  districtName: string;
  provinceId: number | null;
  provinceName: string;
  population: number;
  targetUnder1: number;
  mcv1Coverage: number;
  mcv2Coverage: number;
  penta1Coverage: number;
  dropoutRate: number;
  mcvDropout: number;
  suspectedCases: number;
  riskScore: number;
  riskCategory: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | "INCOMPLETE";
  hasAssessmentRun?: boolean;
}

interface RiskChoroplethMapProps {
  countryCode: string;
  countryName: string;
  adminLevelLabel: string;
  boundaryId?: string | null;
  data: DistrictCoveragePerformance[];
  selectedCategoryFilter?: string;
  onSelectCategoryFilter?: (category: string) => void;
  selectedDistrictId?: number | null;
  onSelectDistrict?: (district: DistrictCoveragePerformance | null) => void;
  isLoading?: boolean;
  initialMetric?: ChoroplethMetric;
  metric?: ChoroplethMetric;
  onMetricChange?: (metric: ChoroplethMetric) => void;
  isolateCountry?: boolean;
  onIsolateCountryChange?: (isolate: boolean) => void;
}

export type ChoroplethMetric = "mcv1" | "mcv2" | "dropout" | "risk";

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

export function RiskChoroplethMap({
  countryCode,
  countryName,
  adminLevelLabel,
  boundaryId,
  data,
  selectedCategoryFilter: controlledFilter,
  onSelectCategoryFilter,
  selectedDistrictId,
  onSelectDistrict,
  isLoading = false,
  initialMetric,
  metric: controlledMetric,
  onMetricChange,
  isolateCountry: controlledIsolateCountry,
  onIsolateCountryChange,
}: RiskChoroplethMapProps) {
  const [internalFilter, setInternalFilter] = useState<string>("ALL");
  const selectedCategoryFilter = controlledFilter !== undefined ? controlledFilter : internalFilter;

  const handleCategoryFilter = (cat: string) => {
    if (onSelectCategoryFilter) {
      onSelectCategoryFilter(cat);
    }
    if (controlledFilter === undefined) {
      setInternalFilter(cat);
    }
  };

  const [internalMetric, setInternalMetric] = useState<ChoroplethMetric>(initialMetric || "risk");
  const metric = controlledMetric !== undefined ? controlledMetric : internalMetric;
  const setMetric = (m: ChoroplethMetric) => {
    if (onMetricChange) onMetricChange(m);
    if (controlledMetric === undefined) setInternalMetric(m);
  };

  const [internalIsolateCountry, setInternalIsolateCountry] = useState<boolean>(true);
  const isolateCountry = controlledIsolateCountry !== undefined ? controlledIsolateCountry : internalIsolateCountry;
  const setIsolateCountry = (iso: boolean) => {
    if (onIsolateCountryChange) onIsolateCountryChange(iso);
    if (controlledIsolateCountry === undefined) setInternalIsolateCountry(iso);
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [basemap, setBasemap] = usePersistedBasemap();
  const geoJsonRef = useRef<L.GeoJSON | null>(null);

  // When a risk tier is selected from either top filter or map legend, ensure metric shows programmatic risk
  useEffect(() => {
    if (selectedCategoryFilter && selectedCategoryFilter !== "ALL") {
      setMetric("risk");
    }
  }, [selectedCategoryFilter]);

  // Fallback context query for defaultBoundaryId if not provided
  const { data: contextData } = useQuery<any>({
    queryKey: ["/api/risk/context"],
    enabled: !boundaryId,
    staleTime: 60 * 60 * 1000,
  });

  const effectiveCountryCode = countryCode || contextData?.countryCode || "ZAF";

  const effectiveBoundaryId =
    boundaryId ||
    contextData?.boundaryId ||
    contextData?.defaultBoundaryId ||
    (effectiveCountryCode === "ZAF"
      ? "a942c119-c045-492f-97ee-b95a8dbb8440"
      : effectiveCountryCode === "ZMB"
        ? "1edd5bcf-d20a-4910-a3cb-dd44c7e84c61"
        : effectiveCountryCode === "SSD"
          ? "af760f67-cc8e-4075-8938-777c387f141f"
          : effectiveCountryCode === "PNG"
            ? "90336ae8-7f06-4133-b5dd-d962a145d5c2"
            : null);

  // Fallback query if data is empty (ensures the map always renders coverage indicators)
  const { data: fallbackResponse } = useQuery<{ performance?: DistrictCoveragePerformance[] }>({
    queryKey: ["/api/risk/coverage-performance"],
    enabled: !data || data.length === 0,
    staleTime: 5 * 60 * 1000,
  });

  const effectiveData = useMemo(() => {
    if (data && data.length > 0) return data;
    if (fallbackResponse?.performance && fallbackResponse.performance.length > 0) {
      return fallbackResponse.performance;
    }
    return [];
  }, [data, fallbackResponse]);

  // GeoJSON boundary query
  const { data: geoJsonData, isLoading: isGeoLoading } = useQuery<any>({
    queryKey: [`/api/boundaries/${effectiveBoundaryId}/geojson`],
    enabled: Boolean(effectiveBoundaryId),
    staleTime: 60 * 60 * 1000, // Boundaries are static, cache for 1 hr
  });

  // Inverted country mask: covers all neighboring countries and outer world with solid clean background
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

  const tenantMock: TenantLike = { countryCode };
  const mapDefaults = useMemo(() => getTenantMapDefaults(tenantMock), [countryCode]);

  // Index performance data by normalized district name
  const districtDataMap = useMemo(() => {
    const map = new Map<string, DistrictCoveragePerformance>();
    for (const item of effectiveData) {
      const clean = item.districtName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      map.set(clean, item);
      map.set(item.districtName.toLowerCase().trim(), item);
      map.set(String(item.districtId), item);
    }
    return map;
  }, [effectiveData]);

  // Helper to find district by geojson feature properties
  const findDistrictForFeature = (feature: any): DistrictCoveragePerformance | undefined => {
    if (!feature || !feature.properties) return undefined;
    const props = feature.properties;
    const candidates = [
      props.shapeName,
      props.shapeName_1,
      props.ADM2_EN,
      props.ADM2_NAME,
      props.NAME_2,
      props.district,
      props.name,
      props.district_name,
      props.admin2Name,
      props.Name,
    ];

    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) {
        const direct = districtDataMap.get(c.toLowerCase().trim());
        if (direct) return direct;
        const clean = c.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
        const cleanMatch = districtDataMap.get(clean);
        if (cleanMatch) return cleanMatch;
      }
    }

    // Fuzzy contains match (only for non-numeric keys with meaningful length >= 4)
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) {
        const lower = c.toLowerCase().trim();
        if (lower.length >= 4 && !/^\d+$/.test(lower)) {
          const entries = Array.from(districtDataMap.entries());
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
    }

    return undefined;
  };

  // Color functions
  const getColor = (district?: DistrictCoveragePerformance): string => {
    if (!district) return "#94a3b8"; // slate-400

    if (metric === "mcv1") {
      const val = district.mcv1Coverage;
      if (val >= 90) return "#10b981"; // Target Met (>=90%)
      if (val >= 80) return "#84cc16"; // Approaching Target (80-89%)
      if (val >= 70) return "#f59e0b"; // Suboptimal (70-79%)
      return "#ef4444"; // Critical Susceptibility (<70%)
    }

    if (metric === "mcv2") {
      const val = district.mcv2Coverage;
      if (val >= 80) return "#10b981"; // Target Met (>=80%)
      if (val >= 70) return "#84cc16"; // Approaching (70-79%)
      if (val >= 60) return "#f59e0b"; // Suboptimal (60-69%)
      return "#ef4444"; // Critical (<60%)
    }

    if (metric === "dropout") {
      const val = district.dropoutRate;
      if (val <= 10) return "#10b981"; // Good Retention (<=10%)
      if (val <= 19.9) return "#f59e0b"; // High Dropout (10-20%)
      return "#ef4444"; // Severe Service Bottleneck (>20%)
    }

    // Risk score category
    switch (district.riskCategory) {
      case "LOW":
        return "#10b981";
      case "MEDIUM":
        return "#f59e0b";
      case "HIGH":
        return "#f97316";
      case "VERY_HIGH":
        return "#ef4444";
      default:
        return "#94a3b8";
    }
  };

  // Feature styling
  const styleFeature = (feature: any) => {
    const d = findDistrictForFeature(feature);
    const isSelected = selectedDistrictId && d && d.districtId === selectedDistrictId;
    const isFilteredTierActive = Boolean(selectedCategoryFilter && selectedCategoryFilter !== "ALL");
    const matchesTier = !isFilteredTierActive || (d && d.riskCategory === selectedCategoryFilter);

    if (isFilteredTierActive && !matchesTier) {
      return {
        fillColor: "#94a3b8",
        weight: 1,
        opacity: 0.35,
        color: "#cbd5e1",
        dashArray: "2",
        fillOpacity: 0.12,
      };
    }

    return {
      fillColor: getColor(d),
      weight: isSelected ? 3.5 : (isFilteredTierActive ? 2.5 : 1.5),
      opacity: 1,
      color: isSelected ? "#000000" : (isFilteredTierActive ? "#0f172a" : "#ffffff"),
      dashArray: isSelected ? "3" : undefined,
      fillOpacity: isSelected ? 0.95 : (isFilteredTierActive ? 0.9 : 0.75),
    };
  };

  // Interaction handlers
  const onEachFeature = (feature: any, layer: L.Layer) => {
    const d = findDistrictForFeature(feature);
    const featureName = feature.properties?.shapeName || feature.properties?.ADM2_EN || feature.properties?.name || "District";
    const dName = d ? d.districtName : featureName;

    // Rich Tooltip (Rule 25)
    const tooltipContent = d
      ? `
        <div style="font-family: inherit; min-width: 170px; padding: 2px;">
          <div style="font-weight: 700; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span>${d.districtName}</span>
            <span style="font-size: 10px; background: #e2e8f0; padding: 1px 5px; border-radius: 4px;">${d.provinceName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
            <span style="color: #64748b;">MCV1 Coverage:</span>
            <strong style="color: ${d.mcv1Coverage >= 90 ? '#10b981' : d.mcv1Coverage >= 80 ? '#65a30d' : '#ef4444'};">${d.mcv1Coverage}%</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
            <span style="color: #64748b;">MCV2 Coverage:</span>
            <strong style="color: ${d.mcv2Coverage >= 80 ? '#10b981' : '#f59e0b'};">${d.mcv2Coverage}%</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
            <span style="color: #64748b;">Penta1-MCV1 Dropout:</span>
            <strong style="color: ${d.dropoutRate <= 10 ? '#10b981' : '#ef4444'};">${d.dropoutRate}%</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
            <span style="color: #64748b;">Suspected Cases:</span>
            <strong>${d.suspectedCases}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; border-top: 1px dashed #e2e8f0; padding-top: 4px; margin-top: 4px;">
            <span style="color: #64748b;">Programmatic Risk:</span>
            <span style="font-weight: 700; color: ${getColor(d)};">${d.riskCategory.replace('_', ' ')} (${d.riskScore} pts)</span>
          </div>
        </div>
      `
      : `
        <div style="font-family: inherit; font-size: 12px; font-weight: 600;">
          ${featureName}
          <div style="font-size: 10px; color: #64748b; font-weight: normal;">No current performance data</div>
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
        if (d && onSelectDistrict) {
          onSelectDistrict(d);
        }
      },
    });
  };

  // Category counts for all metrics
  const categoryCounts = useMemo(() => {
    let lowRisk = 0, medRisk = 0, highRisk = 0, veryHighRisk = 0;
    let mcv1Target = 0, mcv1Suboptimal = 0, mcv1Poor = 0, mcv1Critical = 0;
    let mcv2Target = 0, mcv2Moderate = 0, mcv2Low = 0, mcv2Critical = 0;
    let dropLow = 0, dropHigh = 0, dropSevere = 0;

    for (const d of effectiveData) {
      // Risk categories
      if (d.riskCategory === "LOW") lowRisk++;
      else if (d.riskCategory === "MEDIUM") medRisk++;
      else if (d.riskCategory === "HIGH") highRisk++;
      else if (d.riskCategory === "VERY_HIGH") veryHighRisk++;

      // MCV1
      if (d.mcv1Coverage >= 90) mcv1Target++;
      else if (d.mcv1Coverage >= 80) mcv1Suboptimal++;
      else if (d.mcv1Coverage >= 70) mcv1Poor++;
      else mcv1Critical++;

      // MCV2
      if (d.mcv2Coverage >= 80) mcv2Target++;
      else if (d.mcv2Coverage >= 70) mcv2Moderate++;
      else if (d.mcv2Coverage >= 60) mcv2Low++;
      else mcv2Critical++;

      // Dropout
      if (d.dropoutRate <= 10) dropLow++;
      else if (d.dropoutRate <= 19.9) dropHigh++;
      else dropSevere++;
    }

    return {
      risk: { low: lowRisk, medium: medRisk, high: highRisk, veryHigh: veryHighRisk, total: effectiveData.length },
      mcv1: { target: mcv1Target, suboptimal: mcv1Suboptimal, poor: mcv1Poor, critical: mcv1Critical },
      mcv2: { target: mcv2Target, moderate: mcv2Moderate, low: mcv2Low, critical: mcv2Critical },
      dropout: { low: dropLow, high: dropHigh, severe: dropSevere },
    };
  }, [effectiveData]);

  // KPIs
  const summary = useMemo(() => {
    if (!effectiveData.length) return { mcv1Avg: 0, mcv2Avg: 0, dropoutAvg: 0, targetMetCount: 0, highRiskCount: 0 };
    const mcv1Sum = effectiveData.reduce((acc, d) => acc + d.mcv1Coverage, 0);
    const mcv2Sum = effectiveData.reduce((acc, d) => acc + d.mcv2Coverage, 0);
    const dropSum = effectiveData.reduce((acc, d) => acc + d.dropoutRate, 0);
    const targetMet = effectiveData.filter((d) => d.mcv1Coverage >= 90).length;
    const highRisk = effectiveData.filter((d) => d.riskCategory === "HIGH" || d.riskCategory === "VERY_HIGH").length;

    return {
      mcv1Avg: Number((mcv1Sum / effectiveData.length).toFixed(1)),
      mcv2Avg: Number((mcv2Sum / effectiveData.length).toFixed(1)),
      dropoutAvg: Number((dropSum / effectiveData.length).toFixed(1)),
      targetMetCount: targetMet,
      highRiskCount: highRisk,
    };
  }, [effectiveData]);

  const selectedDistrict = useMemo(() => {
    if (!selectedDistrictId) return null;
    return effectiveData.find((d) => d.districtId === selectedDistrictId) || null;
  }, [selectedDistrictId, effectiveData]);

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="pb-3 border-b bg-muted/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Layers className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                {countryName} • Coverage Performance & Vulnerability Map
              </CardTitle>
              {selectedCategoryFilter && selectedCategoryFilter !== "ALL" ? (
                <Badge className="text-xs bg-primary text-primary-foreground gap-1 font-semibold">
                  <Filter className="w-3 h-3" />
                  {selectedCategoryFilter.replace("_", " ")} Risk: {
                    selectedCategoryFilter === "LOW"
                      ? categoryCounts.risk.low
                      : selectedCategoryFilter === "MEDIUM"
                        ? categoryCounts.risk.medium
                        : selectedCategoryFilter === "HIGH"
                          ? categoryCounts.risk.high
                          : categoryCounts.risk.veryHigh
                  } of {effectiveData.length} {adminLevelLabel}s
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-background">
                  {effectiveData.length} {adminLevelLabel}s
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs mt-1">
              Interactive choropleth visualization of routine immunization indicators aligned with WHO VPD surveillance benchmarks.
            </CardDescription>
          </div>

            {/* Metric Selector & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={metric} onValueChange={(val: ChoroplethMetric) => setMetric(val)}>
              <SelectTrigger className="h-8 text-xs w-[220px] bg-background">
                <SelectValue placeholder="Select Layer Metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="risk">WHO Programmatic Risk Score</SelectItem>
                <SelectItem value="mcv1">Routine MCV1 Coverage (%)</SelectItem>
                <SelectItem value="mcv2">Routine MCV2 Coverage (%)</SelectItem>
                <SelectItem value="dropout">Penta1 to MCV1 Dropout (%)</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant={isolateCountry ? "secondary" : "outline"}
              className={`h-8 text-xs gap-1.5 ${isolateCountry ? "bg-primary/10 border-primary/40 text-primary font-medium" : "text-muted-foreground"}`}
              onClick={() => setIsolateCountry(!isolateCountry)}
              title={isolateCountry ? "Currently showing country only (masking neighboring nations). Click to reveal neighboring nations." : "Showing regional basemap. Click to isolate country map only."}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>{isolateCountry ? "Country Only (Active)" : "Show Neighboring Nations"}</span>
            </Button>

            {selectedCategoryFilter && selectedCategoryFilter !== "ALL" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
                onClick={() => handleCategoryFilter("ALL")}
              >
                <RotateCcw className="w-3 h-3" />
                Reset Tier Filter
              </Button>
            )}

            {selectedDistrict && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1"
                onClick={() => onSelectDistrict?.(null)}
              >
                <RotateCcw className="w-3 h-3" />
                Clear Selection ({selectedDistrict.districtName})
              </Button>
            )}
          </div>
        </div>

        {/* National Snapshot KPI Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <div className="bg-background rounded-md p-2 border flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">National MCV1 Mean</p>
              <p className="text-base font-bold text-foreground">{summary.mcv1Avg}%</p>
            </div>
            {summary.mcv1Avg >= 90 ? (
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-amber-600" />
            )}
          </div>

          <div className="bg-background rounded-md p-2 border flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">National MCV2 Mean</p>
              <p className="text-base font-bold text-foreground">{summary.mcv2Avg}%</p>
            </div>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>

          <div className="bg-background rounded-md p-2 border flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Mean Dropout Rate</p>
              <p className={`text-base font-bold ${summary.dropoutAvg <= 10 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {summary.dropoutAvg}%
              </p>
            </div>
            {summary.dropoutAvg <= 10 ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
          </div>

          <div className="bg-background rounded-md p-2 border flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">High / Very High Risk</p>
              <p className="text-base font-bold text-rose-600">
                {summary.highRiskCount} <span className="text-xs font-normal text-muted-foreground">/ {effectiveData.length}</span>
              </p>
            </div>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        {/* Map Container */}
        <div className="h-[500px] w-full relative z-0">
          <BasemapSwitcher basemap={basemap} onChange={setBasemap} className="top-3 right-3" />

          <MapContainer
            center={mapDefaults.center}
            zoom={mapDefaults.zoom}
            className="h-full w-full"
            scrollWheelZoom={true}
          >
            <BasemapTileLayer basemap={basemap} />

            {geoJsonData && (
              <>
                {isolateCountry && countryMaskGeoJson && (
                  <GeoJSON
                    key={`mask-${effectiveBoundaryId}`}
                    data={countryMaskGeoJson}
                    style={{
                      fillColor: "#f8fafc",
                      fillOpacity: 1,
                      stroke: true,
                      color: "#64748b",
                      weight: 1.5,
                      className: "dark:fill-slate-900 fill-slate-50",
                      interactive: false,
                    }}
                    interactive={false}
                  />
                )}
                <GeoJSON
                  ref={geoJsonRef}
                  key={`${effectiveBoundaryId}-${metric}-${selectedDistrictId}-${selectedCategoryFilter}-${isolateCountry}`}
                  data={geoJsonData}
                  style={styleFeature}
                  onEachFeature={onEachFeature}
                />
                <MapBoundsController
                  geoJsonData={geoJsonData}
                  defaultCenter={mapDefaults.center}
                  defaultZoom={mapDefaults.zoom}
                />
              </>
            )}
          </MapContainer>

          {/* Floating Map Legend (Rule 25) */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-background/95 backdrop-blur border rounded-md p-2.5 shadow-md text-xs space-y-1.5 max-w-xs">
            <p className="font-semibold text-[11px] border-b pb-1 text-foreground">
              {metric === "mcv1" && "MCV1 Routine Coverage (WHO Benchmark)"}
              {metric === "mcv2" && "MCV2 Routine Coverage (Target >= 80%)"}
              {metric === "dropout" && "Penta1 to MCV1 Dropout (Target <= 10%)"}
              {metric === "risk" && "WHO Measles Programmatic Risk Categories"}
            </p>

            {metric === "mcv1" && (
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-[#10b981] inline-block border border-black/10 shrink-0" />
                    <span>&ge; 90% Target Met (High population immunity)</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold ml-1.5 shrink-0">
                    {categoryCounts.mcv1.target}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-[#84cc16] inline-block border border-black/10 shrink-0" />
                    <span>80% – 89% Suboptimal immunity</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold ml-1.5 shrink-0">
                    {categoryCounts.mcv1.suboptimal}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-[#f59e0b] inline-block border border-black/10 shrink-0" />
                    <span>70% – 79% Poor coverage</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold ml-1.5 shrink-0">
                    {categoryCounts.mcv1.poor}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-[#ef4444] inline-block border border-black/10 shrink-0" />
                    <span>&lt; 70% Critical susceptibility accumulation</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold ml-1.5 shrink-0">
                    {categoryCounts.mcv1.critical}
                  </Badge>
                </div>
              </div>
            )}

            {metric === "mcv2" && (
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-[#10b981] inline-block border border-black/10 shrink-0" />
                    <span>&ge; 80% Full 2-dose protection</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold ml-1.5 shrink-0">
                    {categoryCounts.mcv2.target}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-[#84cc16] inline-block border border-black/10 shrink-0" />
                    <span>70% – 79% Moderate 2-dose completion</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold ml-1.5 shrink-0">
                    {categoryCounts.mcv2.moderate}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-[#f59e0b] inline-block border border-black/10 shrink-0" />
                    <span>60% – 69% Low 2-dose coverage</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold ml-1.5 shrink-0">
                    {categoryCounts.mcv2.low}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-[#ef4444] inline-block border border-black/10 shrink-0" />
                    <span>&lt; 60% Critical 2-dose failure</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold ml-1.5 shrink-0">
                    {categoryCounts.mcv2.critical}
                  </Badge>
                </div>
              </div>
            )}

            {metric === "dropout" && (
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-[#10b981] inline-block border border-black/10 shrink-0" />
                    <span>&le; 10% Low Dropout (System retention good)</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold ml-1.5 shrink-0">
                    {categoryCounts.dropout.low}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-[#f59e0b] inline-block border border-black/10 shrink-0" />
                    <span>10.1% – 19.9% High Dropout</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold ml-1.5 shrink-0">
                    {categoryCounts.dropout.high}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-[#ef4444] inline-block border border-black/10 shrink-0" />
                    <span>&ge; 20% Severe service delivery bottleneck</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold ml-1.5 shrink-0">
                    {categoryCounts.dropout.severe}
                  </Badge>
                </div>
              </div>
            )}

            {metric === "risk" && (
              <div className="space-y-1 text-[11px]">
                <button
                  type="button"
                  title="Click to filter map to Low Risk districts"
                  onClick={() => handleCategoryFilter(selectedCategoryFilter === "LOW" ? "ALL" : "LOW")}
                  className={`w-full flex items-center justify-between p-1.5 rounded-md transition-all text-left cursor-pointer border ${
                    selectedCategoryFilter === "LOW"
                      ? "bg-emerald-500/15 border-emerald-500 font-semibold text-emerald-900 dark:text-emerald-200 shadow-sm"
                      : "hover:bg-muted/80 border-transparent text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3.5 h-3.5 rounded bg-[#10b981] inline-block border border-black/10 shrink-0" />
                    <span className="truncate">Low Risk (&lt; 32 pts)</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold ml-2 shrink-0">
                    {categoryCounts.risk.low}
                  </Badge>
                </button>

                <button
                  type="button"
                  title="Click to filter map to Medium Risk districts"
                  onClick={() => handleCategoryFilter(selectedCategoryFilter === "MEDIUM" ? "ALL" : "MEDIUM")}
                  className={`w-full flex items-center justify-between p-1.5 rounded-md transition-all text-left cursor-pointer border ${
                    selectedCategoryFilter === "MEDIUM"
                      ? "bg-amber-500/15 border-amber-500 font-semibold text-amber-900 dark:text-amber-200 shadow-sm"
                      : "hover:bg-muted/80 border-transparent text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3.5 h-3.5 rounded bg-[#f59e0b] inline-block border border-black/10 shrink-0" />
                    <span className="truncate">Medium Risk (32–44 pts)</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold ml-2 shrink-0">
                    {categoryCounts.risk.medium}
                  </Badge>
                </button>

                <button
                  type="button"
                  title="Click to filter map to High Risk districts"
                  onClick={() => handleCategoryFilter(selectedCategoryFilter === "HIGH" ? "ALL" : "HIGH")}
                  className={`w-full flex items-center justify-between p-1.5 rounded-md transition-all text-left cursor-pointer border ${
                    selectedCategoryFilter === "HIGH"
                      ? "bg-orange-500/15 border-orange-500 font-semibold text-orange-900 dark:text-orange-200 shadow-sm"
                      : "hover:bg-muted/80 border-transparent text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3.5 h-3.5 rounded bg-[#f97316] inline-block border border-black/10 shrink-0" />
                    <span className="truncate">High Risk (45–56 pts)</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 font-bold ml-2 shrink-0">
                    {categoryCounts.risk.high}
                  </Badge>
                </button>

                <button
                  type="button"
                  title="Click to filter map to Very High Risk districts"
                  onClick={() => handleCategoryFilter(selectedCategoryFilter === "VERY_HIGH" ? "ALL" : "VERY_HIGH")}
                  className={`w-full flex items-center justify-between p-1.5 rounded-md transition-all text-left cursor-pointer border ${
                    selectedCategoryFilter === "VERY_HIGH"
                      ? "bg-rose-500/15 border-rose-500 font-semibold text-rose-900 dark:text-rose-200 shadow-sm"
                      : "hover:bg-muted/80 border-transparent text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3.5 h-3.5 rounded bg-[#ef4444] inline-block border border-black/10 shrink-0" />
                    <span className="truncate">Very High Risk (≥ 57 pts)</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold ml-2 shrink-0">
                    {categoryCounts.risk.veryHigh}
                  </Badge>
                </button>

                {selectedCategoryFilter && selectedCategoryFilter !== "ALL" && (
                  <div className="pt-1.5 border-t flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Filtered: {selectedCategoryFilter.replace('_', ' ')}</span>
                    <button
                      type="button"
                      onClick={() => handleCategoryFilter("ALL")}
                      className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Show All ({categoryCounts.risk.total})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
